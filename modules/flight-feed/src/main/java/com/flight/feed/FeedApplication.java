package com.flight.feed;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;
import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.security.auth.AuthTokenUtil;
import com.liferay.portal.kernel.security.auth.PrincipalException;
import com.liferay.portal.kernel.service.ServiceContext;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.servlet.PortalSessionContext;
import com.liferay.portal.kernel.util.PortalUtil;
import com.liferay.portal.kernel.util.PropsKeys;
import com.liferay.portal.kernel.util.PropsUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.InputStream;
import java.io.Serializable;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Deactivate;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

/**
 * Keeps flights up to date from a real flight data provider (AviationStack by default).
 * Settings are in bundles/data/flight-feed.properties. Only flights this feed created (source = "feed")
 * are ever changed; flights an administrator typed in are left alone.
 */
@Component(
	property = {
		JaxrsWhiteboardConstants.JAX_RS_APPLICATION_BASE + "=/flight-feed",
		JaxrsWhiteboardConstants.JAX_RS_NAME + "=flight.Feed",
		"liferay.access.control.disable=true"
	},
	service = Application.class
)
public class FeedApplication extends Application {

	private static final Log _log = LogFactoryUtil.getLog(FeedApplication.class);

	private static final long _SITE_ID = 34157;

	private final Object _lock = new Object();

	private String _lastRun = "never";

	private String _lastResult = "The feed has not run yet.";

	private ScheduledExecutorService _scheduler;

	@Reference
	private ObjectDefinitionLocalService _objectDefinitionLocalService;

	@Reference
	private ObjectEntryLocalService _objectEntryLocalService;

	@Override
	public Set<Object> getSingletons() {
		return Collections.singleton(this);
	}

	@Activate
	protected void activate() {
		_scheduler = Executors.newSingleThreadScheduledExecutor(
			runnable -> {
				Thread thread = new Thread(runnable, "flight-feed");

				thread.setDaemon(true);

				return thread;
			});

		// Looks every 10 minutes; a real call happens only when the key is set and the wait time has passed.
		_scheduler.scheduleWithFixedDelay(
			() -> {
				try {
					long hours = _number(_setting("FEED_INTERVAL_HOURS"), 8);

					if (_enabled() && ((System.currentTimeMillis() - _lastRunMillis()) >= (hours * 3_600_000L))) {
						_sync();
					}
				}
				catch (Exception exception) {
					_log.error("Flight feed check failed", exception);
				}
			},
			1, 10, TimeUnit.MINUTES);
	}

	@Deactivate
	protected void deactivate() {
		if (_scheduler != null) {
			_scheduler.shutdownNow();
		}
	}

	/** For the admin dashboard: is the feed connected, when did it last run, how many calls are left. */
	@GET
	@Path("/status")
	@Produces(MediaType.APPLICATION_JSON)
	public Response status(@Context HttpServletRequest request) {
		if (_admin(request) == null) {
			return _error(403, "Only administrators can see the feed");
		}

		JSONObject out = JSONFactoryUtil.createJSONObject();

		out.put("enabled", _enabled());
		out.put("lastRun", _lastRun);
		out.put("lastResult", _lastResult);
		out.put("callsThisMonth", _usage()[0]);
		out.put("monthlyLimit", _number(_setting("FEED_MONTHLY_LIMIT"), 90));
		out.put("airports", _setting("FEED_AIRPORTS") == null ? "" : _setting("FEED_AIRPORTS"));

		return Response.ok(out.toString()).build();
	}

	/** "Sync now" button on the admin dashboard. */
	@POST
	@Path("/sync")
	@Produces(MediaType.APPLICATION_JSON)
	public Response syncNow(@Context HttpServletRequest request) {
		try {
			if (_admin(request) == null) {
				return _error(403, "Only administrators can run the feed");
			}

			try {
				AuthTokenUtil.checkCSRFToken(request, FeedApplication.class.getName());
			}
			catch (PrincipalException principalException) {
				return _error(403, "Please refresh the page and try again");
			}

			if (!_enabled()) {
				return _error(400, "The feed is not connected. Add FEED_API_KEY to bundles/data/flight-feed.properties.");
			}

			return Response.ok(_sync()).build();
		}
		catch (Exception exception) {
			_log.error("Flight feed sync failed", exception);

			return _error(500, "The sync failed: " + exception.getMessage());
		}
	}

	/** One round: ask the provider for departures of each airport and create or update the feed's flights. */
	private String _sync() throws Exception {
		synchronized (_lock) {
			long companyId = PortalUtil.getDefaultCompanyId();
			long userId = UserLocalServiceUtil.getDefaultUserId(companyId);

			ObjectDefinition flightDefinition = _objectDefinitionLocalService.getObjectDefinition(companyId, "C_Flight");
			ObjectDefinition airportDefinition = _objectDefinitionLocalService.getObjectDefinition(companyId, "C_Airport");

			Map<String, Long> airports = new HashMap<>();

			for (ObjectEntry airport : _objectEntryLocalService.getObjectEntries(0, airportDefinition.getObjectDefinitionId(), 0, 500)) {
				airports.put(String.valueOf(airport.getValues().get("code")).toUpperCase(), airport.getObjectEntryId());
			}

			String list = _setting("FEED_AIRPORTS");

			String[] codes = ((list == null) || list.isBlank()) ? airports.keySet().toArray(new String[0]) : list.toUpperCase().split("\\s*,\\s*");

			int created = 0, updated = 0, skipped = 0, calls = 0;
			String problem = "";

			for (String code : codes) {
				if (!airports.containsKey(code)) {
					continue;
				}

				if (_usage()[0] >= _number(_setting("FEED_MONTHLY_LIMIT"), 90)) {
					problem = " Stopped: the monthly call limit was reached.";

					break;
				}

				JSONObject answer = _get(_baseUrl() + "/flights?access_key=" + URLEncoder.encode(_setting("FEED_API_KEY"), "UTF-8") + "&limit=100&dep_iata=" + code);

				calls++;

				_addCall();

				if (answer.has("error")) {
					problem = " The provider said: " + answer.getJSONObject("error").getString("message");

					break;
				}

				JSONArray data = answer.getJSONArray("data");

				for (int i = 0; (data != null) && (i < data.length()); i++) {
					int result = _upsert(data.getJSONObject(i), flightDefinition, airports, companyId, userId);

					if (result == 1) {
						created++;
					}
					else if (result == 2) {
						updated++;
					}
					else {
						skipped++;
					}
				}
			}

			_lastRun = Instant.now().toString();
			_lastResult = created + " new, " + updated + " updated, " + skipped + " skipped (" + calls + " calls)." + problem;

			_log.info("Flight feed: " + _lastResult);

			return "{\"result\":\"" + _lastResult.replace("\"", "'") + "\"}";
		}
	}

	/** 1 = created, 2 = updated, 0 = skipped. */
	private int _upsert(JSONObject f, ObjectDefinition definition, Map<String, Long> airports, long companyId, long userId) throws Exception {
		String number = f.getJSONObject("flight") == null ? "" : f.getJSONObject("flight").getString("iata");
		JSONObject dep = f.getJSONObject("departure"), arr = f.getJSONObject("arrival");

		if (number.isEmpty() || (dep == null) || (arr == null) || !airports.containsKey(dep.getString("iata")) || !airports.containsKey(arr.getString("iata"))) {
			return 0;
		}

		Date depTime = _time(dep, dep.getString("estimated").isEmpty() ? "scheduled" : "estimated");
		Date arrTime = _time(arr, arr.getString("estimated").isEmpty() ? "scheduled" : "estimated");

		if (depTime == null) {
			return 0;
		}

		int delay = Math.max(dep.getInt("delay"), 0);
		String state = f.getString("flight_status");
		String status = "landed".equals(state) ? "Landed" : "active".equals(state) ? "Departed" : "cancelled".equals(state) ? "Cancelled" :
			(("incident".equals(state) || "diverted".equals(state) || (delay >= 15)) ? "Delayed" : "OnTime");

		Map<String, Serializable> values = new HashMap<>();

		values.put("flightNumber", number);
		values.put("airline", f.getJSONObject("airline") == null ? "" : f.getJSONObject("airline").getString("name"));
		values.put("departureTime", depTime);
		values.put("showstatus", status);
		values.put("delayMinutes", delay);
		values.put("source", "feed");
		values.put("r_originAirport_c_airportId", airports.get(dep.getString("iata")));
		values.put("r_destinationAirport_c_airportId", airports.get(arr.getString("iata")));

		if (arrTime != null) {
			values.put("arrivalTime", arrTime);
			values.put("flightDurationMinutes", (int)Math.max(0, (arrTime.getTime() - depTime.getTime()) / 60000));
		}

		ServiceContext sc = new ServiceContext();

		sc.setCompanyId(companyId);
		sc.setScopeGroupId(_SITE_ID);
		sc.setUserId(userId);

		String day = _day(depTime);

		for (ObjectEntry existing : _objectEntryLocalService.getObjectEntries(_SITE_ID, definition.getObjectDefinitionId(), 0, 1000)) {
			Map<String, Serializable> v = existing.getValues();

			if (number.equals(String.valueOf(v.get("flightNumber"))) && (v.get("departureTime") instanceof Date) && day.equals(_day((Date)v.get("departureTime")))) {
				if (!"feed".equals(String.valueOf(v.get("source")))) {
					return 0;
				}

				Map<String, Serializable> merged = new HashMap<>(v);

				merged.putAll(values);

				_objectEntryLocalService.updateObjectEntry(userId, existing.getObjectEntryId(), existing.getObjectEntryFolderId(), merged, sc);

				return 2;
			}
		}

		_objectEntryLocalService.addObjectEntry(_SITE_ID, userId, definition.getObjectDefinitionId(), 0L, null, values, sc);

		return 1;
	}

	private static String _day(Date date) {
		return Instant.ofEpochMilli(date.getTime()).toString().substring(0, 10);
	}

	/**
	 * A time from the provider. AviationStack writes airport LOCAL times with a +00:00 ending, so by default
	 * (FEED_TIMES_ARE_LOCAL not "false") the clock part is read in the airport's own time zone.
	 */
	private static Date _time(JSONObject part, String key) {
		String text = part.getString(key);

		if (text.length() < 19) {
			return null;
		}

		try {
			if ("false".equalsIgnoreCase(_setting("FEED_TIMES_ARE_LOCAL")) || part.getString("timezone").isEmpty()) {
				return Date.from(OffsetDateTime.parse(text).toInstant());
			}

			return Date.from(LocalDateTime.parse(text.substring(0, 19)).atZone(ZoneId.of(part.getString("timezone"))).toInstant());
		}
		catch (Exception exception) {
			return null;
		}
	}

	private static String _baseUrl() {
		String url = _setting("FEED_BASE_URL");

		return ((url == null) || url.isBlank()) ? "http://api.aviationstack.com/v1" : url.replaceAll("/+$", "");
	}

	private static JSONObject _get(String address) throws Exception {
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

	private static boolean _enabled() {
		String key = _setting("FEED_API_KEY");

		return (key != null) && !key.isBlank();
	}

	private long _lastRunMillis() {
		try {
			return Instant.parse(_lastRun).toEpochMilli();
		}
		catch (Exception exception) {
			return 0;
		}
	}

	private static long _number(String value, long fallback) {
		try {
			return Long.parseLong(value.trim());
		}
		catch (Exception exception) {
			return fallback;
		}
	}

	/** A setting from bundles/data/flight-feed.properties, or an environment variable of the same name. */
	private static String _setting(String name) {
		try {
			java.nio.file.Path file = Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "flight-feed.properties");

			if (Files.exists(file)) {
				Properties properties = new Properties();

				try (InputStream in = Files.newInputStream(file)) {
					properties.load(in);
				}

				String value = properties.getProperty(name);

				if ((value != null) && !value.isBlank()) {
					return value.trim();
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read flight-feed.properties: " + exception.getMessage());
		}

		return System.getenv(name);
	}

	/** Calls made this month, kept in a small file so a restart does not forget: {month, calls}. */
	private static long[] _usage() {
		try {
			java.nio.file.Path file = Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "flight-feed-usage.txt");

			if (Files.exists(file)) {
				String[] parts = Files.readString(file).trim().split(" ");

				if (parts[0].equals(YearMonth.now().toString())) {
					return new long[] {Long.parseLong(parts[1])};
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read the feed usage: " + exception.getMessage());
		}

		return new long[] {0};
	}

	private static void _addCall() {
		try {
			Files.writeString(Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "flight-feed-usage.txt"), YearMonth.now() + " " + (_usage()[0] + 1));
		}
		catch (Exception exception) {
			_log.warn("Could not save the feed usage: " + exception.getMessage());
		}
	}

	private static User _admin(HttpServletRequest request) {
		try {
			HttpSession session = PortalSessionContext.get(request.getSession().getId());

			Object userId = (session == null) ? null : session.getAttribute("USER_ID");

			User user = (userId == null) ? null : UserLocalServiceUtil.fetchUser(Long.parseLong(String.valueOf(userId)));

			return ((user != null) && !user.isGuestUser() && user.isActive() &&
				UserLocalServiceUtil.hasRoleUser(user.getCompanyId(), "Administrator", user.getUserId(), true)) ? user : null;
		}
		catch (Exception exception) {
			return null;
		}
	}

	private static Response _error(int status, String message) {
		JSONObject json = JSONFactoryUtil.createJSONObject();

		json.put("error", message);

		return Response.status(status).entity(json.toString()).type(MediaType.APPLICATION_JSON).build();
	}

}
