package com.flight.auth;

import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.model.Contact;
import com.liferay.portal.kernel.model.ListType;
import com.liferay.portal.kernel.model.Phone;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.security.auth.AuthTokenUtil;
import com.liferay.portal.kernel.security.auth.PrincipalException;
import com.liferay.portal.kernel.security.auth.Authenticator;
import com.liferay.portal.kernel.service.ListTypeLocalServiceUtil;
import com.liferay.portal.kernel.service.PhoneLocalServiceUtil;
import com.liferay.portal.kernel.service.ServiceContext;
import com.liferay.portal.kernel.servlet.PortalSessionContext;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.util.HtmlUtil;
import com.liferay.portal.kernel.util.PortalUtil;
import com.liferay.portal.kernel.util.PropsKeys;
import com.liferay.portal.kernel.util.PropsUtil;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import jakarta.ws.rs.Consumes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Base64;
import java.util.List;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.HashMap;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

/**
 * Two-step login. Step 1 checks the password and sends a 6-digit code by SMS (Twilio Verify) when the
 * user has a phone number, otherwise by e-mail. Step 2 checks the code and
 * hands out a login ticket (a short JWT). The ticket is turned into a real Liferay session by
 * FlightTicketAutoLogin. Administrators use the password only (their address may have no inbox).
 */
@Component(
	property = {
		JaxrsWhiteboardConstants.JAX_RS_APPLICATION_BASE + "=/flight-auth",
		JaxrsWhiteboardConstants.JAX_RS_NAME + "=flight.Auth",
		"liferay.access.control.disable=true"
	},
	service = Application.class
)
public class AuthApplication extends Application {

	private static final Log _log = LogFactoryUtil.getLog(AuthApplication.class);

	private static final SecureRandom _RANDOM = new SecureRandom();

	private static final long _CODE_LIFETIME = 5 * 60 * 1000;

	private static final long _RESEND_WAIT = 30 * 1000;

	private static final int _MAX_CODE_TRIES = 5;

	/** A code that was e-mailed and not used yet. */
	private static class Challenge {

		long userId;
		String email;
		String name;
		String phone;
		String via;
		String codeHash;
		long expires;
		long lastSent;
		int tries;

	}

	private final java.util.Map<String, Challenge> _challenges = new ConcurrentHashMap<>();

	@Override
	public Set<Object> getSingletons() {
		return Collections.singleton(this);
	}

	@Consumes(MediaType.APPLICATION_JSON)
	@POST
	@Path("/login")
	@Produces(MediaType.APPLICATION_JSON)
	public Response login(String body) {
		try {
			JSONObject input = JSONFactoryUtil.createJSONObject(body);

			String email = input.getString("email").trim().toLowerCase();
			long now = System.currentTimeMillis();

			long companyId = PortalUtil.getDefaultCompanyId();

			int result = Authenticator.FAILURE;

			try {
				result = UserLocalServiceUtil.authenticateByEmailAddress(
					companyId, email, input.getString("password"), new HashMap<>(), new HashMap<>(), new HashMap<>());
			}
			catch (Exception exception) {
				_log.warn("Login check failed: " + exception.getMessage());
			}

			if (result != Authenticator.SUCCESS) {
				// No lock-out (it would let anyone block a real user). A short pause just slows down password guessing.
				Thread.sleep(1000);

				return _error(401, "Incorrect email or password.");
			}

			User user = UserLocalServiceUtil.getUserByEmailAddress(companyId, email);

			if (!user.isActive()) {
				return _error(401, "Incorrect email or password.");
			}

			JSONObject out = JSONFactoryUtil.createJSONObject();

			if (UserLocalServiceUtil.hasRoleUser(companyId, "Administrator", user.getUserId(), true)) {
				out.put("ticket", Tickets.create(user.getUserId()));

				return Response.ok(out.toString()).build();
			}

			Challenge challenge = new Challenge();

			challenge.userId = user.getUserId();
			challenge.email = user.getEmailAddress();
			challenge.name = user.getFullName();
			challenge.phone = _primaryPhone(user);
			challenge.via = ((challenge.phone != null) && _twilioReady()) ? "sms" : "email";

			String id = Long.toHexString(_RANDOM.nextLong()) + Long.toHexString(_RANDOM.nextLong());

			_challenges.values().removeIf((c) -> c.expires < now);

			try {
				_sendCode(id, challenge);
			}
			catch (Exception exception) {
				if (!"sms".equals(challenge.via)) {
					throw exception;
				}

				_log.warn("SMS could not be sent, using e-mail: " + exception.getMessage());

				challenge.via = "email";

				_sendCode(id, challenge);
			}

			_challenges.put(id, challenge);

			out.put("challenge", id);
			out.put("via", challenge.via);
			out.put("sent", _target(challenge));
			out.put("canEmail", true);

			return Response.ok(out.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Login failed", exception);

			return _error(500, "Could not start the login. Please try again.");
		}
	}

	@Consumes(MediaType.APPLICATION_JSON)
	@POST
	@Path("/verify")
	@Produces(MediaType.APPLICATION_JSON)
	public Response verify(String body) {
		try {
			JSONObject input = JSONFactoryUtil.createJSONObject(body);

			String id = input.getString("challenge");
			Challenge challenge = _challenges.get(id);

			if ((challenge == null) || (challenge.expires < System.currentTimeMillis())) {
				_challenges.remove(id);

				return _error(410, "The code has expired. Log in again.");
			}

			if (++challenge.tries > _MAX_CODE_TRIES) {
				_challenges.remove(id);

				return _error(429, "Too many wrong codes. Log in again.");
			}

			String code = input.getString("code").trim();

			boolean right = "sms".equals(challenge.via) ? _smsCheck(challenge.phone, code) :
				MessageDigest.isEqual(_hash(id, code).getBytes(StandardCharsets.UTF_8), challenge.codeHash.getBytes(StandardCharsets.UTF_8));

			if (!right) {
				return _error(401, "That code is not right.");
			}

			_challenges.remove(id);

			JSONObject out = JSONFactoryUtil.createJSONObject();

			out.put("ticket", Tickets.create(challenge.userId));

			return Response.ok(out.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Code check failed", exception);

			return _error(500, "Could not check the code. Please try again.");
		}
	}

	@Consumes(MediaType.APPLICATION_JSON)
	@POST
	@Path("/resend")
	@Produces(MediaType.APPLICATION_JSON)
	public Response resend(String body) {
		try {
			JSONObject input = JSONFactoryUtil.createJSONObject(body);

			String id = input.getString("challenge");
			Challenge challenge = _challenges.get(id);

			if ((challenge == null) || (challenge.expires < System.currentTimeMillis())) {
				return _error(410, "The code has expired. Log in again.");
			}

			if ((System.currentTimeMillis() - challenge.lastSent) < _RESEND_WAIT) {
				return _error(429, "Please wait a few seconds before asking for a new code.");
			}

			if ("email".equals(input.getString("via"))) {
				challenge.via = "email";
			}

			_sendCode(id, challenge);

			JSONObject out = JSONFactoryUtil.createJSONObject();

			out.put("via", challenge.via);
			out.put("sent", _target(challenge));

			return Response.ok(out.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Could not send the code again", exception);

			return _error(500, "Could not send the code. Please try again.");
		}
	}

	/** Makes a new code, keeps only its hash, and e-mails it. */
	private void _sendCode(String id, Challenge challenge) throws Exception {
		if ("sms".equals(challenge.via)) {
			_smsStart(challenge.phone);
		}
		else {
			String code = String.format("%06d", _RANDOM.nextInt(1_000_000));

			_sendMail(challenge, code);

			challenge.codeHash = _hash(id, code);
		}


		challenge.expires = System.currentTimeMillis() + _CODE_LIFETIME;
		challenge.lastSent = System.currentTimeMillis();
		challenge.tries = 0;
	}

	/** Saves the signed-in user's mobile number (international format) as the primary phone. */
	@Consumes(MediaType.APPLICATION_JSON)
	@POST
	@Path("/phone")
	@Produces(MediaType.APPLICATION_JSON)
	public Response savePhone(@Context HttpServletRequest request, String body) {
		try {
			User user = _sessionUser(request);

			if (user == null) {
				return _error(401, "Please log in");
			}

			try {
				AuthTokenUtil.checkCSRFToken(request, AuthApplication.class.getName());
			}
			catch (PrincipalException principalException) {
				return _error(403, "Please refresh the page and try again");
			}

			return _savePhone(user, JSONFactoryUtil.createJSONObject(body).getString("phone"));
		}
		catch (Exception exception) {
			_log.error("Could not save the phone number", exception);

			return _error(500, "Could not save the phone number.");
		}
	}

	/** Used right after sign-up, when the new session has no security token yet: the email and password prove who is asking. */
	@Consumes(MediaType.APPLICATION_JSON)
	@POST
	@Path("/signup-phone")
	@Produces(MediaType.APPLICATION_JSON)
	public Response signupPhone(String body) {
		try {
			JSONObject input = JSONFactoryUtil.createJSONObject(body);

			String email = input.getString("email").trim().toLowerCase();
			long companyId = PortalUtil.getDefaultCompanyId();

			int result = UserLocalServiceUtil.authenticateByEmailAddress(
				companyId, email, input.getString("password"), new HashMap<>(), new HashMap<>(), new HashMap<>());

			if (result != Authenticator.SUCCESS) {
				return _error(401, "Incorrect email or password.");
			}

			return _savePhone(UserLocalServiceUtil.getUserByEmailAddress(companyId, email), input.getString("phone"));
		}
		catch (Exception exception) {
			_log.error("Could not save the phone number", exception);

			return _error(500, "Could not save the phone number.");
		}
	}

	private Response _savePhone(User user, String phone) throws Exception {
		String number = phone.replaceAll("[\\s-]", "");

		if (!number.matches("\\+[1-9][0-9]{7,14}")) {
			return _error(400, "Enter the mobile number with the country code, for example +919876543210.");
		}

		Phone old = null;

		for (Phone existing : user.getPhones()) {
			if (existing.isPrimary()) {
				old = existing;
			}
		}

		if (old != null) {
			PhoneLocalServiceUtil.updatePhone(old.getExternalReferenceCode(), old.getPhoneId(), number, "", old.getListTypeId(), true);
		}
		else {
			ListType type = ListTypeLocalServiceUtil.getListType(user.getCompanyId(), "personal", "com.liferay.portal.kernel.model.Contact.phone");

			ServiceContext serviceContext = new ServiceContext();

			serviceContext.setCompanyId(user.getCompanyId());
			serviceContext.setUserId(user.getUserId());

			PhoneLocalServiceUtil.addPhone(null, user.getUserId(), Contact.class.getName(), user.getContactId(), number, "", type.getListTypeId(), true, serviceContext);
		}

		return Response.ok("{}").build();
	}

	private static User _sessionUser(HttpServletRequest request) {
		try {
			HttpSession session = PortalSessionContext.get(request.getSession().getId());

			Object userId = (session == null) ? null : session.getAttribute("USER_ID");

			User user = (userId == null) ? null : UserLocalServiceUtil.fetchUser(Long.parseLong(String.valueOf(userId)));

			return ((user == null) || user.isGuestUser() || !user.isActive()) ? null : user;
		}
		catch (Exception exception) {
			return null;
		}
	}

	/** The user's primary phone when it is written in international format, otherwise null. */
	private static String _primaryPhone(User user) throws Exception {
		List<Phone> phones = user.getPhones();

		for (Phone phone : phones) {
			String number = phone.getNumber().replaceAll("[\\s-]", "");

			if (phone.isPrimary() && number.matches("\\+[1-9][0-9]{7,14}")) {
				return number;
			}
		}

		return null;
	}

	/** Where the code went, with part of it hidden. */
	private static String _target(Challenge challenge) {
		return "sms".equals(challenge.via) ? (challenge.phone.substring(0, 3) + "\u2022\u2022\u2022\u2022\u2022" + challenge.phone.substring(challenge.phone.length() - 3)) : _mask(challenge.email);
	}

	/** A Twilio setting: bundles/data/twilio.properties first, then the environment. */
	private static String _twilio(String name) {
		try {
			File file = new File(PropsUtil.get(PropsKeys.LIFERAY_HOME) + "/data", "twilio.properties");

			if (file.exists()) {
				Properties properties = new Properties();

				try (InputStream in = Files.newInputStream(file.toPath())) {
					properties.load(in);
				}

				String value = properties.getProperty(name);

				if ((value != null) && !value.isBlank()) {
					return value.trim();
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read twilio.properties: " + exception.getMessage());
		}

		return System.getenv(name);
	}

	private static boolean _twilioReady() {
		return (_twilio("TWILIO_ACCOUNT_SID") != null) && (_twilio("TWILIO_AUTH_TOKEN") != null) && (_twilio("TWILIO_VERIFY_SERVICE_SID") != null);
	}

	/** Twilio Verify makes, sends and remembers the code, so nothing is stored here. */
	private static void _smsStart(String phone) throws Exception {
		JSONObject result = _twilioPost("Verifications", "To=" + URLEncoder.encode(phone, "UTF-8") + "&Channel=sms");

		if (!result.has("sid")) {
			throw new IllegalStateException("Twilio did not send the SMS: " + result.getString("message"));
		}
	}

	private static boolean _smsCheck(String phone, String code) throws Exception {
		JSONObject result = _twilioPost("VerificationCheck", "To=" + URLEncoder.encode(phone, "UTF-8") + "&Code=" + URLEncoder.encode(code, "UTF-8"));

		return "approved".equals(result.getString("status"));
	}

	private static JSONObject _twilioPost(String path, String form) throws Exception {
		HttpURLConnection connection = (HttpURLConnection)new URL("https://verify.twilio.com/v2/Services/" + _twilio("TWILIO_VERIFY_SERVICE_SID") + "/" + path).openConnection();

		connection.setConnectTimeout(10_000);
		connection.setReadTimeout(15_000);
		connection.setRequestMethod("POST");
		connection.setDoOutput(true);
		connection.setRequestProperty("Authorization", "Basic " + Base64.getEncoder().encodeToString((_twilio("TWILIO_ACCOUNT_SID") + ":" + _twilio("TWILIO_AUTH_TOKEN")).getBytes(StandardCharsets.UTF_8)));
		connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

		try {
			try (OutputStream out = connection.getOutputStream()) {
				out.write(form.getBytes(StandardCharsets.UTF_8));
			}

			try (InputStream in = (connection.getResponseCode() >= 400) ? connection.getErrorStream() : connection.getInputStream()) {
				return JSONFactoryUtil.createJSONObject(new String(in.readAllBytes(), StandardCharsets.UTF_8));
			}
		}
		finally {
			connection.disconnect();
		}
	}

	private static String _hash(String id, String code) throws Exception {
		StringBuilder hex = new StringBuilder();

		for (byte b : MessageDigest.getInstance("SHA-256").digest((id + ":" + code).getBytes(StandardCharsets.UTF_8))) {
			hex.append(String.format("%02x", b));
		}

		return hex.toString();
	}

	private static String _mask(String email) {
		int at = email.indexOf('@');

		return (at > 1) ? email.charAt(0) + "***" + email.substring(at - 1) : email;
	}

	private Response _error(int status, String message) {
		JSONObject json = JSONFactoryUtil.createJSONObject();

		json.put("error", message);

		return Response.status(status).entity(json.toString()).type(MediaType.APPLICATION_JSON).build();
	}

	/** A mail setting: bundles/data/alert-smtp.properties first (the account used for flight alerts), then the environment. */
	private static String _setting(String name) {
		try {
			File file = new File(PropsUtil.get(PropsKeys.LIFERAY_HOME) + "/data", "alert-smtp.properties");

			if (file.exists()) {
				Properties properties = new Properties();

				try (InputStream in = Files.newInputStream(file.toPath())) {
					properties.load(in);
				}

				String value = properties.getProperty(name);

				if ((value != null) && !value.isBlank()) {
					return value.trim();
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read alert-smtp.properties: " + exception.getMessage());
		}

		return System.getenv(name);
	}

	private void _sendMail(Challenge challenge, String code) throws Exception {
		String host = _setting("FLIGHT_ALERT_SMTP_HOST");
		String from = _setting("FLIGHT_ALERT_FROM_ADDRESS");

		if ((host == null) || host.isBlank() || (from == null) || from.isBlank()) {
			throw new IllegalStateException("SMTP is not configured (bundles/data/alert-smtp.properties)");
		}

		String user = _setting("FLIGHT_ALERT_SMTP_USER");
		boolean auth = (user != null) && !user.isBlank();
		String port = _setting("FLIGHT_ALERT_SMTP_PORT");

		Properties properties = new Properties();

		properties.put("mail.smtp.host", host);
		properties.put("mail.smtp.port", ((port == null) || port.isBlank()) ? "587" : port);
		properties.put("mail.smtp.auth", String.valueOf(auth));
		properties.put("mail.smtp.starttls.enable", String.valueOf(!"false".equalsIgnoreCase(_setting("FLIGHT_ALERT_SMTP_STARTTLS"))));
		properties.put("mail.smtp.connectiontimeout", "10000");
		properties.put("mail.smtp.timeout", "15000");

		Session session = Session.getInstance(properties);

		MimeMessage message = new MimeMessage(session);

		message.setFrom(new InternetAddress(from, "Flight Status Portal"));
		message.setRecipient(Message.RecipientType.TO, new InternetAddress(challenge.email, challenge.name));
		message.setSubject("Your Flight Status login code: " + code, "UTF-8");
		message.setContent(
			"<h2>Your login code</h2><p style=\"font-size:28px;letter-spacing:6px\"><strong>" + HtmlUtil.escape(code) +
				"</strong></p><p>It works for 5 minutes. If you did not try to log in, ignore this email and consider changing your password.</p><p>Flight Status Portal</p>",
			"text/html; charset=UTF-8");

		try (Transport transport = session.getTransport("smtp")) {
			if (auth) {
				transport.connect(host, user, _setting("FLIGHT_ALERT_SMTP_PASSWORD"));
			}
			else {
				transport.connect();
			}

			transport.sendMessage(message, message.getAllRecipients());
		}
	}

}
