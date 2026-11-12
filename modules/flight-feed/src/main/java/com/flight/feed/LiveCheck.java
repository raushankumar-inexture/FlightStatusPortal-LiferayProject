package com.flight.feed;

import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;

import java.io.InputStream;
import java.io.Serializable;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/**
 * The free live check: finds a plane on adsb.fi and works out the landing time from the distance left and the speed.
 * Airline callsigns and airport positions come from live-data.properties.
 */
final class LiveCheck {

	private static final Log _log = LogFactoryUtil.getLog(LiveCheck.class);

	private static final Properties _data = new Properties();

	static {
		try (InputStream in = LiveCheck.class.getResourceAsStream("/live-data.properties")) {
			_data.load(in);
		}
		catch (Exception exception) {
			_log.error("Could not read live-data.properties: " + exception);
		}
	}

	/** The radio callsign of a flight number (AI101 gives AIC101), or null when the airline is not known. */
	static String callsign(String number) {
		String prefix = _data.getProperty("airline." + number.substring(0, Math.min(2, number.length())));

		return (prefix == null) ? null : prefix + number.substring(2);
	}

	/** {latitude, longitude} of an airport, or null when it is not known. */
	static double[] place(String code) {
		String value = (code == null) ? null : _data.getProperty("airport." + code);

		if (value == null) {
			return null;
		}

		String[] parts = value.split(",");

		return new double[] {Double.parseDouble(parts[0]), Double.parseDouble(parts[1])};
	}

	/** The plane flying under this callsign, or null. Free adsb.fi data. */
	static JSONObject plane(String callsign) {
		try {
			JSONArray list = FeedSupport.getJson("https://opendata.adsb.fi/api/v2/callsign/" + callsign).getJSONArray("ac");

			for (int i = 0; (list != null) && (i < list.length()); i++) {
				if (list.getJSONObject(i).has("lat") && list.getJSONObject(i).has("lon")) {
					return list.getJSONObject(i);
				}
			}
		}
		catch (Exception exception) {
			_log.debug("No live position for " + callsign + ": " + exception.getMessage());
		}

		return null;
	}

	/**
	 * The new values for a flight from where its plane is now, or an empty map when nothing worth changing.
	 * A plane on the ground near its destination is Landed. A plane in the air gets a new arrival time
	 * (8 minutes are added for the approach and taxi) and delay, but only when the time moves 5 minutes or more.
	 */
	static Map<String, Serializable> changes(Map<String, Serializable> flight, JSONObject plane, double[] to, long now) {
		Map<String, Serializable> changes = new HashMap<>();

		double km = _km(plane.getDouble("lat"), plane.getDouble("lon"), to[0], to[1]);

		if ("ground".equals(plane.getString("alt_baro"))) {
			if ((km < 10) && (((Date)flight.get("departureTime")).getTime() < now)) {
				changes.put("showstatus", "Landed");
				changes.put("arrivalTime", new Date(now));
			}

			return changes;
		}

		long eta = now + Math.round((km / (Math.max(plane.getDouble("gs"), 150) * 1.852)) * 3_600_000L) + 8 * 60_000L;

		if (Math.abs(eta - ((Date)flight.get("arrivalTime")).getTime()) < 5 * 60_000L) {
			return changes;
		}

		changes.put("arrivalTime", new Date(eta));

		if (flight.get("scheduledArrival") instanceof Date) {
			int late = (int)Math.max(0, (eta - ((Date)flight.get("scheduledArrival")).getTime()) / 60_000L);

			changes.put("delayMinutes", late);
			changes.put("showstatus", (late >= 15) ? "Delayed" : "Departed");
		}
		else if (!"Delayed".equals(String.valueOf(flight.get("showstatus")))) {
			changes.put("showstatus", "Departed");
		}

		return changes;
	}

	private static double _km(double lat1, double lon1, double lat2, double lon2) {
		double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
		double a = Math.pow(Math.sin(dLat / 2), 2) + (Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2));

		return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

}
