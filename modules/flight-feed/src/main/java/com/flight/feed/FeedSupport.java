package com.flight.feed;

import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.util.PropsKeys;
import com.liferay.portal.kernel.util.PropsUtil;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Date;
import java.util.Properties;

/**
 * Settings (bundles/data/flight-feed.properties), the monthly call counter and the web calls of the flight feed.
 * The settings file is read again only when it changes.
 */
final class FeedSupport {

	private static final Log _log = LogFactoryUtil.getLog(FeedSupport.class);

	private static final Properties _properties = new Properties();

	private static long _loaded = -1;

	static Path dataFile(String name) {
		return Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", name);
	}

	/** A setting from the properties file, or an environment variable of the same name. */
	static synchronized String get(String name) {
		try {
			Path file = dataFile("flight-feed.properties");
			long modified = Files.exists(file) ? Files.getLastModifiedTime(file).toMillis() : -1;

			if (modified != _loaded) {
				_properties.clear();

				if (modified >= 0) {
					try (InputStream in = Files.newInputStream(file)) {
						_properties.load(in);
					}
				}

				_loaded = modified;
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read flight-feed.properties: " + exception.getMessage());
		}

		String value = _properties.getProperty(name);

		return ((value != null) && !value.isBlank()) ? value.trim() : System.getenv(name);
	}

	static long number(String name, long fallback) {
		try {
			return Long.parseLong(get(name).trim());
		}
		catch (Exception exception) {
			return fallback;
		}
	}

	static boolean enabled() {
		String key = get("FEED_API_KEY");

		return (key != null) && !key.isBlank();
	}

	/** The site that holds the flights (FEED_SITE_ID, default 34157). */
	static long siteId() {
		return number("FEED_SITE_ID", 34157);
	}

	static String baseUrl() {
		String url = get("FEED_BASE_URL");

		return ((url == null) || url.isBlank()) ? "http://api.aviationstack.com/v1" : url.replaceAll("/+$", "");
	}

	/* Monthly call counter, kept in a small file so a restart does not forget: "2026-11 42". */

	static long monthlyLimit() {
		return number("FEED_MONTHLY_LIMIT", 90);
	}

	static long callsUsed() {
		try {
			Path file = dataFile("flight-feed-usage.txt");

			if (Files.exists(file)) {
				String[] parts = Files.readString(file).trim().split(" ");

				if (parts[0].equals(YearMonth.now().toString())) {
					return Long.parseLong(parts[1]);
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read the feed usage: " + exception.getMessage());
		}

		return 0;
	}

	static long callsLeft() {
		return Math.max(0, monthlyLimit() - callsUsed());
	}

	static synchronized void addCall() {
		try {
			Files.writeString(dataFile("flight-feed-usage.txt"), YearMonth.now() + " " + (callsUsed() + 1));
		}
		catch (Exception exception) {
			_log.warn("Could not save the feed usage: " + exception.getMessage());
		}
	}

	/* Web calls. */

	static JSONObject getJson(String address) throws Exception {
		HttpURLConnection connection = (HttpURLConnection)new URL(address).openConnection();

		connection.setConnectTimeout(10_000);
		connection.setReadTimeout(20_000);

		try (InputStream in = (connection.getResponseCode() >= 400) ? connection.getErrorStream() : connection.getInputStream()) {
			return JSONFactoryUtil.createJSONObject(new String(in.readAllBytes(), StandardCharsets.UTF_8));
		}
		finally {
			connection.disconnect();
		}
	}

	/** One call to the provider's /flights list, for example flights("limit=100&dep_iata=DEL"). It counts as one call. */
	static JSONObject flights(String query) throws Exception {
		JSONObject answer = getJson(baseUrl() + "/flights?access_key=" + URLEncoder.encode(get("FEED_API_KEY"), "UTF-8") + "&" + query);

		addCall();

		return answer;
	}

	/* Times. */

	/**
	 * A time from the provider. AviationStack writes airport LOCAL times with a +00:00 ending, so by default
	 * (FEED_TIMES_ARE_LOCAL not "false") the clock part is read in the airport's own time zone.
	 */
	static Date time(JSONObject part, String key) {
		String text = part.getString(key);

		if (text.length() < 19) {
			return null;
		}

		try {
			if ("false".equalsIgnoreCase(get("FEED_TIMES_ARE_LOCAL")) || part.getString("timezone").isEmpty()) {
				return Date.from(OffsetDateTime.parse(text).toInstant());
			}

			return Date.from(LocalDateTime.parse(text.substring(0, 19)).atZone(ZoneId.of(part.getString("timezone"))).toInstant());
		}
		catch (Exception exception) {
			return null;
		}
	}

	static String day(Date date) {
		return Instant.ofEpochMilli(date.getTime()).toString().substring(0, 10);
	}

}
