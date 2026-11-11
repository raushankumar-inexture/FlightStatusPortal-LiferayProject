package com.flight.auth;

import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.util.PropsKeys;
import com.liferay.portal.kernel.util.PropsUtil;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * The login ticket: a small signed JWT (HS256) that is handed out only after the password and the
 * e-mail code were right. It lives 2 minutes and works once.
 */
public class Tickets {

	private static final SecureRandom _RANDOM = new SecureRandom();

	private static final Map<String, Long> _used = new ConcurrentHashMap<>();

	/** A new ticket for this user. */
	public static String create(long userId) throws Exception {
		String header = _b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

		JSONObject claims = JSONFactoryUtil.createJSONObject();

		claims.put("sub", userId);
		claims.put("jti", Long.toHexString(_RANDOM.nextLong()) + Long.toHexString(_RANDOM.nextLong()));
		claims.put("exp", System.currentTimeMillis() / 1000 + 120);

		String body = header + "." + _b64(claims.toString().getBytes(StandardCharsets.UTF_8));

		return body + "." + _sign(body);
	}

	/** The user id in a good ticket, or 0 when it is wrong, expired or already used. */
	public static long check(String ticket) {
		try {
			String[] parts = ticket.split("\\.");

			if (parts.length != 3) {
				return 0;
			}

			String body = parts[0] + "." + parts[1];

			if (!MessageDigest.isEqual(_sign(body).getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
				return 0;
			}

			JSONObject claims = JSONFactoryUtil.createJSONObject(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));

			long now = System.currentTimeMillis() / 1000;

			_used.values().removeIf((exp) -> exp < now);

			if ((claims.getLong("exp") < now) || (_used.putIfAbsent(claims.getString("jti"), claims.getLong("exp")) != null)) {
				return 0;
			}

			return claims.getLong("sub");
		}
		catch (Exception exception) {
			return 0;
		}
	}

	private static String _b64(byte[] bytes) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private static String _sign(String text) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");

		mac.init(new SecretKeySpec(_secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));

		return _b64(mac.doFinal(text.getBytes(StandardCharsets.UTF_8)));
	}

	/** The signing secret lives in bundles/data/auth-secret.txt (not in Git). It is made on first use. */
	private static synchronized String _secret() throws Exception {
		Path file = Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "auth-secret.txt");

		if (!Files.exists(file)) {
			byte[] bytes = new byte[32];

			_RANDOM.nextBytes(bytes);

			Files.writeString(file, Base64.getEncoder().encodeToString(bytes));

			Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
		}

		return Files.readString(file).trim();
	}

}
