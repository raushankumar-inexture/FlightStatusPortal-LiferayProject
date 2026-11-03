package com.flight.api.internal.mfa;

import com.liferay.multi.factor.authentication.spi.checker.browser.BrowserMFAChecker;
import com.liferay.portal.kernel.model.Phone;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.util.ParamUtil;
import com.liferay.portal.kernel.util.Portal;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.io.OutputStream;
import java.io.Serializable;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

import java.nio.charset.StandardCharsets;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

@Component(
	property = "service.ranking:Integer=400",
	service = BrowserMFAChecker.class
)
public class TwilioSmsBrowserMFAChecker implements BrowserMFAChecker {

	private static final long _CODE_LIFETIME_MILLIS = 5 * 60 * 1000;

	private static final int _MAX_ATTEMPTS = 5;

	private static final long _SEND_COOLDOWN_MILLIS = 60 * 1000;

	private static final String _CHALLENGE_KEY =
		TwilioSmsBrowserMFAChecker.class.getName() + ".challenge";

	private static final String _VERIFIED_KEY =
		TwilioSmsBrowserMFAChecker.class.getName() + ".verifiedUserId";

	private static final Pattern _E164_PATTERN =
		Pattern.compile("\\+[1-9][0-9]{7,14}");

	private static final SecureRandom _RANDOM = new SecureRandom();

	private static final Map<Long, Long> _LAST_CODE_SENT = new ConcurrentHashMap<>();

	@Override
	public void includeBrowserVerification(
			HttpServletRequest request, HttpServletResponse response, long userId)
		throws Exception {

		HttpSession session = _getSession(request, true);

		Object value = session.getAttribute(_CHALLENGE_KEY);

		if (value instanceof OtpChallenge) {
			OtpChallenge challenge = (OtpChallenge)value;

			if ((challenge.userId == userId) &&
				(challenge.expiresAt > System.currentTimeMillis())) {

				_writeCodeInput(response);

				return;
			}
		}

		session.removeAttribute(_CHALLENGE_KEY);

		String accountSid = System.getenv("TWILIO_ACCOUNT_SID");
		String authToken = System.getenv("TWILIO_AUTH_TOKEN");
		String fromNumber = System.getenv("TWILIO_FROM_NUMBER");

		if (!_isTwilioConfigured(accountSid, authToken, fromNumber)) {
			_writeMessage(
				response,
				"SMS verification is not configured. Contact your administrator.");

			return;
		}

		String phoneNumber = _getPrimaryPhoneNumber(userId);

		if ((phoneNumber == null) || !_E164_PATTERN.matcher(phoneNumber).matches()) {
			_writeMessage(
				response,
				"Add a primary phone number in international format to your Liferay profile before signing in.");

			return;
		}

		long now = System.currentTimeMillis();

		if (!_reserveSend(userId, now)) {
			_writeMessage(
				response,
				"A verification code was sent recently. Wait one minute and try again.");

			return;
		}

		String code = String.format(
			Locale.ROOT, "%06d", _RANDOM.nextInt(1_000_000));
		byte[] salt = new byte[16];

		_RANDOM.nextBytes(salt);

		try {
			_sendSms(
				accountSid, authToken, fromNumber, phoneNumber,
				"Your Flight Status Portal login code is " + code +
					". It expires in 5 minutes. Do not share it.");
		}
		catch (IOException exception) {
			_LAST_CODE_SENT.remove(userId, now);

			throw exception;
		}

		session.setAttribute(
			_CHALLENGE_KEY,
			new OtpChallenge(
				userId, salt, _hashCode(salt, code),
				now + _CODE_LIFETIME_MILLIS));

		_writeCodeInput(response);
	}

	@Override
	public boolean isBrowserVerified(
		HttpServletRequest request, long userId) {

		HttpSession session = _getSession(request, false);

		if (session == null) {
			return false;
		}

		Object verifiedUserId = session.getAttribute(_VERIFIED_KEY);

		return (verifiedUserId instanceof Long) &&
			(((Long)verifiedUserId).longValue() == userId);
	}

	@Override
	public boolean verifyBrowserRequest(
			HttpServletRequest request, HttpServletResponse response, long userId)
		throws Exception {

		HttpSession session = _getSession(request, false);

		if (session == null) {
			return false;
		}

		Object value = session.getAttribute(_CHALLENGE_KEY);

		if (!(value instanceof OtpChallenge)) {
			return false;
		}

		OtpChallenge challenge = (OtpChallenge)value;

		if ((challenge.userId != userId) ||
			(challenge.expiresAt <= System.currentTimeMillis())) {

			session.removeAttribute(_CHALLENGE_KEY);

			return false;
		}

		String code = ParamUtil.getString(request, "twilioOtp");

		if (!code.matches("[0-9]{6}")) {
			_incrementAttempts(session, challenge);

			return false;
		}

		if (!MessageDigest.isEqual(
				challenge.codeHash, _hashCode(challenge.salt, code))) {

			_incrementAttempts(session, challenge);

			return false;
		}

		session.removeAttribute(_CHALLENGE_KEY);
		session.setAttribute(_VERIFIED_KEY, userId);

		return true;
	}

	private static byte[] _hashCode(byte[] salt, String code)
		throws NoSuchAlgorithmException {

		MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");

		messageDigest.update(salt);

		return messageDigest.digest(code.getBytes(StandardCharsets.UTF_8));
	}

	private static void _incrementAttempts(
		HttpSession session, OtpChallenge challenge) {

		challenge.attempts++;

		if (challenge.attempts >= _MAX_ATTEMPTS) {
			session.removeAttribute(_CHALLENGE_KEY);
		}
		else {
			session.setAttribute(_CHALLENGE_KEY, challenge);
		}
	}

	private static boolean _isTwilioConfigured(
		String accountSid, String authToken, String fromNumber) {

		return (accountSid != null) &&
			accountSid.matches("AC[0-9a-fA-F]{32}") &&
			(authToken != null) && !authToken.isBlank() &&
			(fromNumber != null) &&
			_E164_PATTERN.matcher(fromNumber).matches();
	}

	private static void _sendSms(
			String accountSid, String authToken, String fromNumber,
			String toNumber, String message)
		throws IOException {

		String endpoint =
			"https://api.twilio.com/2010-04-01/Accounts/" + accountSid +
				"/Messages.json";
		HttpURLConnection connection =
			(HttpURLConnection)new URL(endpoint).openConnection();

		connection.setConnectTimeout(10_000);
		connection.setReadTimeout(10_000);
		connection.setRequestMethod("POST");
		connection.setDoOutput(true);
		connection.setRequestProperty(
			"Authorization",
			"Basic " + Base64.getEncoder().encodeToString(
				(accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8)));
		connection.setRequestProperty(
			"Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");

		String formData =
			"To=" + URLEncoder.encode(toNumber, StandardCharsets.UTF_8.name()) +
				"&From=" +
					URLEncoder.encode(fromNumber, StandardCharsets.UTF_8.name()) +
				"&Body=" +
					URLEncoder.encode(message, StandardCharsets.UTF_8.name());

		try {
			try (OutputStream outputStream = connection.getOutputStream()) {
				outputStream.write(formData.getBytes(StandardCharsets.UTF_8));
			}

			int statusCode = connection.getResponseCode();

			if ((statusCode < 200) || (statusCode >= 300)) {
				throw new IOException(
					"Twilio rejected the SMS request (HTTP " + statusCode + ")");
			}
		}
		finally {
			connection.disconnect();
		}
	}

	private static void _writeCodeInput(HttpServletResponse response)
		throws IOException {

		response.getWriter().write(
			"<div class=\"form-group\"><label for=\"flight-status-twilio-otp\">" +
				"Enter the 6-digit code sent to your primary phone number" +
					"</label><input id=\"flight-status-twilio-otp\" " +
						"name=\"twilioOtp\" type=\"text\" inputmode=\"numeric\" " +
						"autocomplete=\"one-time-code\" pattern=\"[0-9]{6}\" " +
						"maxlength=\"6\" required></div>");
	}

	private static void _writeMessage(
			HttpServletResponse response, String message)
		throws IOException {

		response.getWriter().write(
			"<div class=\"alert alert-danger\" role=\"alert\">" + message +
				"</div>");
	}

	private static boolean _reserveSend(long userId, long now) {
		synchronized (_LAST_CODE_SENT) {
			_LAST_CODE_SENT.entrySet().removeIf(
				entry -> (now - entry.getValue()) >
					(10 * _SEND_COOLDOWN_MILLIS));

			Long lastSent = _LAST_CODE_SENT.get(userId);

			if ((lastSent != null) &&
				((now - lastSent) < _SEND_COOLDOWN_MILLIS)) {

				return false;
			}

			_LAST_CODE_SENT.put(userId, now);

			return true;
		}
	}

	private String _getPrimaryPhoneNumber(long userId) {
		User user = UserLocalServiceUtil.fetchUser(userId);

		if (user == null) {
			return null;
		}

		List<Phone> phones = user.getPhones();

		for (Phone phone : phones) {
			if (phone.isPrimary()) {
				return phone.getNumber();
			}
		}

		return null;
	}

	private HttpSession _getSession(
		HttpServletRequest request, boolean create) {

		return _portal.getOriginalServletRequest(request).getSession(create);
	}

	@Reference
	private Portal _portal;

	private static class OtpChallenge implements Serializable {

		private static final long serialVersionUID = 1L;

		private OtpChallenge(
			long userId, byte[] salt, byte[] codeHash, long expiresAt) {

			this.userId = userId;
			this.salt = salt;
			this.codeHash = codeHash;
			this.expiresAt = expiresAt;
		}

		private int attempts;

		private final byte[] codeHash;

		private final long expiresAt;

		private final byte[] salt;

		private final long userId;
	}

}
