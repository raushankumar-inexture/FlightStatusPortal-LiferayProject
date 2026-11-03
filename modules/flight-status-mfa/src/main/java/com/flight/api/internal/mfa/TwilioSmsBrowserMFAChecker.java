package com.flight.api.internal.mfa;

import com.liferay.multi.factor.authentication.spi.checker.browser.BrowserMFAChecker;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.model.Phone;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.util.ParamUtil;
import com.liferay.portal.kernel.util.Portal;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.Serializable;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

import java.nio.charset.StandardCharsets;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

/**
 * Second login step: a one-time code sent by SMS. Twilio Verify creates, sends
 * and checks the code (so it also works on a Twilio trial account); this class
 * only starts the verification and asks Twilio whether the typed code is right.
 *
 * Settings (environment variables of the Liferay process):
 * TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (or TWILIO_API_KEY_SID with
 * TWILIO_API_KEY_SECRET) and TWILIO_VERIFY_SERVICE_SID.
 */
@Component(
	property = "service.ranking:Integer=400",
	service = BrowserMFAChecker.class
)
public class TwilioSmsBrowserMFAChecker implements BrowserMFAChecker {

	private static final Log _log = LogFactoryUtil.getLog(
		TwilioSmsBrowserMFAChecker.class);

	private static final long _CODE_LIFETIME_MILLIS = 10 * 60 * 1000;

	private static final int _MAX_ATTEMPTS = 5;

	private static final long _SEND_COOLDOWN_MILLIS = 30 * 1000;

	private static final String _CHALLENGE_KEY =
		TwilioSmsBrowserMFAChecker.class.getName() + ".challenge";

	private static final String _VERIFIED_KEY =
		TwilioSmsBrowserMFAChecker.class.getName() + ".verifiedUserId";

	private static final Pattern _E164_PATTERN =
		Pattern.compile("\\+[1-9][0-9]{7,14}");

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

		Settings settings = Settings.read();

		if (!settings.isComplete()) {
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
				"A verification code was sent recently. Wait a few seconds and sign in again.");

			return;
		}

		try {
			String[] result = _post(
				"https://verify.twilio.com/v2/Services/" + settings.verifySid +
					"/Verifications",
				settings, "To=" + _encode(phoneNumber) + "&Channel=sms");

			if (!result[0].startsWith("2")) {
				_log.error("Twilio Verify could not start: HTTP " + result[0] + " " + result[1]);

				_LAST_CODE_SENT.remove(userId);

				_writeMessage(
					response,
					"The verification code could not be sent. Try again later.");

				return;
			}
		}
		catch (IOException ioException) {
			_log.error("Twilio Verify could not be reached", ioException);

			_LAST_CODE_SENT.remove(userId);

			_writeMessage(
				response, "The verification code could not be sent. Try again later.");

			return;
		}

		session.setAttribute(
			_CHALLENGE_KEY,
			new OtpChallenge(userId, phoneNumber, now + _CODE_LIFETIME_MILLIS));

		_writeCodeInput(response);
	}

	@Override
	public boolean isBrowserVerified(HttpServletRequest request, long userId) {

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

		Settings settings = Settings.read();

		if (!settings.isComplete()) {
			return false;
		}

		try {
			String[] result = _post(
				"https://verify.twilio.com/v2/Services/" + settings.verifySid +
					"/VerificationCheck",
				settings, "To=" + _encode(challenge.phoneNumber) + "&Code=" + _encode(code));

			if (result[0].startsWith("2") &&
				Pattern.compile("\"status\"\\s*:\\s*\"approved\"").matcher(
					result[1]).find()) {

				session.removeAttribute(_CHALLENGE_KEY);
				session.setAttribute(_VERIFIED_KEY, userId);

				return true;
			}
		}
		catch (IOException ioException) {
			_log.error("Twilio Verify could not be reached", ioException);
		}

		_incrementAttempts(session, challenge);

		return false;
	}

	private static String _encode(String value) throws IOException {
		return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
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

	/** @return {status code, response body} */
	private static String[] _post(String endpoint, Settings settings, String formData)
		throws IOException {

		HttpURLConnection connection =
			(HttpURLConnection)new URL(endpoint).openConnection();

		connection.setConnectTimeout(10_000);
		connection.setReadTimeout(15_000);
		connection.setRequestMethod("POST");
		connection.setDoOutput(true);
		connection.setRequestProperty(
			"Authorization",
			"Basic " + Base64.getEncoder().encodeToString(
				(settings.loginName + ":" + settings.secret).getBytes(
					StandardCharsets.UTF_8)));
		connection.setRequestProperty(
			"Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");

		try {
			try (OutputStream outputStream = connection.getOutputStream()) {
				outputStream.write(formData.getBytes(StandardCharsets.UTF_8));
			}

			int statusCode = connection.getResponseCode();

			InputStream inputStream =
				(statusCode >= 400) ? connection.getErrorStream() :
					connection.getInputStream();

			String body = "";

			if (inputStream != null) {
				ByteArrayOutputStream buffer = new ByteArrayOutputStream();

				inputStream.transferTo(buffer);

				body = buffer.toString(StandardCharsets.UTF_8);
			}

			return new String[] {String.valueOf(statusCode), body};
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

	private static class Settings {

		private static Settings read() {
			Settings settings = new Settings();

			settings.accountSid = System.getenv("TWILIO_ACCOUNT_SID");
			settings.verifySid = System.getenv("TWILIO_VERIFY_SERVICE_SID");

			String apiKeySid = System.getenv("TWILIO_API_KEY_SID");
			String apiKeySecret = System.getenv("TWILIO_API_KEY_SECRET");

			if ((apiKeySid != null) && apiKeySid.matches("SK[0-9a-fA-F]{32}") &&
				(apiKeySecret != null) && !apiKeySecret.isBlank()) {

				settings.loginName = apiKeySid;
				settings.secret = apiKeySecret;
			}
			else {
				settings.loginName = settings.accountSid;
				settings.secret = System.getenv("TWILIO_AUTH_TOKEN");
			}

			return settings;
		}

		private boolean isComplete() {
			return (accountSid != null) &&
				accountSid.matches("AC[0-9a-fA-F]{32}") &&
				(secret != null) && !secret.isBlank() &&
				(verifySid != null) && verifySid.matches("VA[0-9a-fA-F]{32}");
		}

		private String accountSid;
		private String loginName;
		private String secret;
		private String verifySid;

	}

	private static class OtpChallenge implements Serializable {

		private static final long serialVersionUID = 2L;

		private OtpChallenge(long userId, String phoneNumber, long expiresAt) {
			this.userId = userId;
			this.phoneNumber = phoneNumber;
			this.expiresAt = expiresAt;
		}

		private int attempts;

		private final long expiresAt;

		private final String phoneNumber;

		private final long userId;
	}

}
