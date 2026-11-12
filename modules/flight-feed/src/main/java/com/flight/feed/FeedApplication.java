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
import jakarta.ws.rs.QueryParam;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
		try {
			java.nio.file.Path last = Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "flight-feed-last.txt");

			if (Files.exists(last)) {
				String[] lines = Files.readString(last).split("\n", 2);

				_lastRun = lines[0].trim();
				_lastResult = (lines.length > 1) ? lines[1].trim() : _lastResult;
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read the last feed run: " + exception.getMessage());
		}

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

	private final Map<String, Object[]> _lookups = new ConcurrentHashMap<>();

	private final Map<Long, long[]> _lookupHits = new ConcurrentHashMap<>();

	/**
	 * Status of any flight by number, from the provider: today's times, delay, terminal and gate. Signed-in users only,
	 * about 20 lookups an hour each, answers are kept for 10 minutes, and it shares the monthly call limit of the sync.
	 */
	@GET
	@Path("/lookup")
	@Produces(MediaType.APPLICATION_JSON)
	public Response lookup(@Context HttpServletRequest request, @QueryParam("flight") String flight) {
		try {
			User user = _user(request);

			if (user == null) {
				return _error(401, "Please sign in to see the full status of a flight");
			}

			String number = (flight == null) ? "" : flight.toUpperCase().replaceAll("[\\s-]", "");

			if (!number.matches("[A-Z0-9]{2}\\d{1,4}[A-Z]?")) {
				return _error(400, "Type a flight number such as AI101 or 6E606");
			}

			JSONObject out = JSONFactoryUtil.createJSONObject();

			out.put("callsLeft", Math.max(0, _number(_setting("FEED_MONTHLY_LIMIT"), 90) - _usage()[0]));

			if (!_enabled()) {
				out.put("available", false);
				out.put("reason", "The flight data service is not connected yet.");

				return Response.ok(out.toString()).build();
			}

			Object[] hit = _lookups.get(number);

			if ((hit != null) && ((System.currentTimeMillis() - (Long)hit[0]) < 600_000L)) {
				return Response.ok((String)hit[1]).build();
			}

			long now = System.currentTimeMillis();
			long[] hits = _lookupHits.compute(user.getUserId(), (id, old) -> ((old == null) || ((now - old[1]) > 3_600_000L)) ? new long[] {1, now} : new long[] {old[0] + 1, old[1]});

			if (hits[0] > 20) {
				return _error(429, "You have looked up many flights in the last hour. Please try again later.");
			}

			if (_usage()[0] >= _number(_setting("FEED_MONTHLY_LIMIT"), 90)) {
				out.put("available", false);
				out.put("reason", "This month's flight data lookups are used up. Live aircraft tracking still works.");

				return Response.ok(out.toString()).build();
			}

			JSONObject answer = _get(_baseUrl() + "/flights?access_key=" + URLEncoder.encode(_setting("FEED_API_KEY"), "UTF-8") + "&limit=10&flight_iata=" + number);

			_addCall();

			if (answer.has("error")) {
				out.put("available", false);
				out.put("reason", "The flight data service said: " + answer.getJSONObject("error").getString("message"));

				return Response.ok(out.toString()).build();
			}

			JSONArray data = answer.getJSONArray("data");
			List<JSONObject> rows = new ArrayList<>();

			for (int i = 0; (data != null) && (i < data.length()); i++) {
				JSONObject f = data.getJSONObject(i);

				if ((f.getJSONObject("flight") != null) && f.getJSONObject("flight").isNull("codeshared")) {
					rows.add(f);
				}
			}

			// the flights closest to now first: today's flight before last week's
			long nowMillis = System.currentTimeMillis();

			rows.sort((a, b) -> Long.compare(_distance(a, nowMillis), _distance(b, nowMillis)));

			JSONArray flights = JSONFactoryUtil.createJSONArray();

			for (int i = 0; (i < rows.size()) && (i < 3); i++) {
				flights.put(_shape(rows.get(i)));
			}

			out.put("available", true);
			out.put("flights", flights);
			out.put("callsLeft", Math.max(0, _number(_setting("FEED_MONTHLY_LIMIT"), 90) - _usage()[0]));

			_lookups.put(number, new Object[] {System.currentTimeMillis(), out.toString()});

			return Response.ok(out.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Flight lookup failed", exception);

			return _error(502, "The flight data service did not answer. Try again in a moment.");
		}
	}

	private static long _distance(JSONObject f, long now) {
		Date d = _time(f.getJSONObject("departure"), "scheduled");

		return (d == null) ? Long.MAX_VALUE : Math.abs(d.getTime() - now);
	}

	private static JSONObject _shape(JSONObject f) {
		JSONObject out = JSONFactoryUtil.createJSONObject();

		out.put("flight", f.getJSONObject("flight").getString("iata"));
		out.put("airline", f.getJSONObject("airline") == null ? "" : f.getJSONObject("airline").getString("name"));
		out.put("status", f.getString("flight_status"));
		out.put("date", f.getString("flight_date"));
		out.put("departure", _part(f.getJSONObject("departure")));
		out.put("arrival", _part(f.getJSONObject("arrival")));

		return out;
	}

	private static JSONObject _part(JSONObject p) {
		JSONObject out = JSONFactoryUtil.createJSONObject();

		if (p == null) {
			return out;
		}

		out.put("iata", p.getString("iata"));
		out.put("airport", p.getString("airport"));
		out.put("terminal", p.getString("terminal"));
		out.put("gate", p.getString("gate"));
		out.put("delay", Math.max(p.getInt("delay"), 0));

		for (String key : new String[] {"scheduled", "estimated", "actual"}) {
			Date d = _time(p, key);

			out.put(key, (d == null) ? "" : Instant.ofEpochMilli(d.getTime()).toString());
		}

		return out;
	}

	private static User _user(HttpServletRequest request) {
		try {
			HttpSession session = PortalSessionContext.get(request.getSession().getId());

			Object userId = (session == null) ? null : session.getAttribute("USER_ID");

			User user = (userId == null) ? null : UserLocalServiceUtil.fetchUser(Long.parseLong(String.valueOf(userId)));

			return ((user != null) && !user.isGuestUser() && user.isActive()) ? user : null;
		}
		catch (Exception exception) {
			return null;
		}
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

			try {
				Files.writeString(Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "flight-feed-last.txt"), _lastRun + "\n" + _lastResult);
			}
			catch (Exception exception) {
				_log.warn("Could not save the last feed run: " + exception.getMessage());
			}

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

		// A codeshare is the same plane sold under another airline's number: keep only the operating flight.
		if (!f.getJSONObject("flight").isNull("codeshared")) {
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

			if (number.equals(String.valueOf(v.get("flightNumber"))) && (v.get("departureTime") instanceof Date) && day.equals(_day((Date)v.get("departureTime"))) &&
				String.valueOf(airports.get(dep.getString("iata"))).equals(String.valueOf(v.get("r_originAirport_c_airportId")))) {
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
