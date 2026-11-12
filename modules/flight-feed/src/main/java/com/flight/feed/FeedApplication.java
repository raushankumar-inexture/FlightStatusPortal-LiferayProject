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

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Deactivate;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

/**
 * Keeps flights up to date: the provider sync (AviationStack by default), a free live check of planes in the air,
 * a webhook for pushed changes and a one-flight lookup. Settings are in bundles/data/flight-feed.properties
 * (see FeedSupport). Only flights this feed created (source = "feed") are ever changed; flights an
 * administrator typed in are left alone.
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

	private static final List<String> _STATUSES = Arrays.asList("OnTime", "Delayed", "Boarding", "Departed", "Landed", "Cancelled");

	private final Object _lock = new Object();

	private String _lastRun = "never";

	private String _lastResult = "The feed has not run yet.";

	private String _liveLast = "not yet";

	private int _liveUpdated = 0;

	private ScheduledExecutorService _scheduler;

	/** Full status answers kept for 10 minutes: flight number to {time, json}. */
	private final Map<String, Object[]> _lookups = new ConcurrentHashMap<>();

	/** Lookups per user in the last hour: user id to {count, first time}. */
	private final Map<Long, long[]> _lookupHits = new ConcurrentHashMap<>();

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
			java.nio.file.Path last = FeedSupport.dataFile("flight-feed-last.txt");

			if (Files.exists(last)) {
				String[] lines = Files.readString(last).split("\n", 2);

				_lastRun = lines[0].trim();
				_lastResult = (lines.length > 1) ? lines[1].trim() : _lastResult;
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read the last feed run: " + exception.getMessage());
		}

		// Two threads, so a slow provider sync never delays the live check.
		_scheduler = Executors.newScheduledThreadPool(
			2,
			runnable -> {
				Thread thread = new Thread(runnable, "flight-feed");

				thread.setDaemon(true);

				return thread;
			});

		// Every 2 minutes: the free live check of planes in the air.
		_scheduler.scheduleWithFixedDelay(() -> _run("Live position check", this::_liveCheck), 1, 2, TimeUnit.MINUTES);

		// Every 2 minutes: the provider sync, but only when the key is set and the wait time has passed (it uses the monthly calls).
		_scheduler.scheduleWithFixedDelay(
			() -> _run(
				"Flight feed sync",
				() -> {
					long wait = FeedSupport.number("FEED_INTERVAL_HOURS", 8) * 3_600_000L;

					if (FeedSupport.enabled() && ((System.currentTimeMillis() - _lastRunMillis()) >= wait)) {
						_sync();
					}
				}),
			1, 2, TimeUnit.MINUTES);
	}

	@Deactivate
	protected void deactivate() {
		if (_scheduler != null) {
			_scheduler.shutdownNow();
		}
	}

	private interface Job {

		void run() throws Exception;

	}

	private static void _run(String name, Job job) {
		try {
			job.run();
		}
		catch (Exception exception) {
			_log.error(name + " failed", exception);
		}
	}

	/* ---------- Admin dashboard ---------- */

	/** For the admin dashboard: is the feed connected, when did it last run, how many calls are left. */
	@GET
	@Path("/status")
	@Produces(MediaType.APPLICATION_JSON)
	public Response status(@Context HttpServletRequest request) {
		if (_admin(request) == null) {
			return _error(403, "Only administrators can see the feed");
		}

		JSONObject out = JSONFactoryUtil.createJSONObject();

		out.put("enabled", FeedSupport.enabled());
		out.put("lastRun", _lastRun);
		out.put("lastResult", _lastResult);
		out.put("callsThisMonth", FeedSupport.callsUsed());
		out.put("monthlyLimit", FeedSupport.monthlyLimit());
		out.put("airports", FeedSupport.get("FEED_AIRPORTS") == null ? "" : FeedSupport.get("FEED_AIRPORTS"));
		out.put("liveLast", _liveLast);
		out.put("liveUpdated", _liveUpdated);
		out.put("webhookOn", FeedSupport.get("FEED_WEBHOOK_SECRET") != null);

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

			if (!FeedSupport.enabled()) {
				return _error(400, "The feed is not connected. Add FEED_API_KEY to bundles/data/flight-feed.properties.");
			}

			return Response.ok(_sync()).build();
		}
		catch (Exception exception) {
			_log.error("Flight feed sync failed", exception);

			return _error(500, "The sync failed: " + exception.getMessage());
		}
	}

	/* ---------- Full status of one flight (signed-in users) ---------- */

	@GET
	@Path("/lookup")
	@Produces(MediaType.APPLICATION_JSON)
	public Response lookup(@Context HttpServletRequest request, @QueryParam("flight") String flight) {
		try {
			User user = _sessionUser(request);

			if (user == null) {
				return _error(401, "Please sign in to see the full status of a flight");
			}

			String number = (flight == null) ? "" : flight.toUpperCase().replaceAll("[\\s-]", "");

			if (!number.matches("[A-Z0-9]{2}\\d{1,4}[A-Z]?")) {
				return _error(400, "Type a flight number such as AI101 or 6E606");
			}

			JSONObject out = JSONFactoryUtil.createJSONObject();

			out.put("callsLeft", FeedSupport.callsLeft());

			if (!FeedSupport.enabled()) {
				return Response.ok(_unavailable(out, "The flight data service is not connected yet.")).build();
			}

			Object[] hit = _lookups.get(number);

			if ((hit != null) && ((System.currentTimeMillis() - (Long)hit[0]) < 600_000L)) {
				return Response.ok((String)hit[1]).build();
			}

			if (_tooManyLookups(user)) {
				return _error(429, "You have looked up many flights in the last hour. Please try again later.");
			}

			if (FeedSupport.callsLeft() <= 0) {
				return Response.ok(_unavailable(out, "This month's flight data lookups are used up. Live aircraft tracking still works.")).build();
			}

			JSONObject answer = FeedSupport.flights("limit=10&flight_iata=" + number);

			if (answer.has("error")) {
				return Response.ok(_unavailable(out, "The flight data service said: " + answer.getJSONObject("error").getString("message"))).build();
			}

			out.put("available", true);
			out.put("flights", _closestToNow(answer.getJSONArray("data")));
			out.put("callsLeft", FeedSupport.callsLeft());

			_remember(number, out.toString());

			return Response.ok(out.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Flight lookup failed", exception);

			return _error(502, "The flight data service did not answer. Try again in a moment.");
		}
	}

	private static String _unavailable(JSONObject out, String reason) {
		out.put("available", false);
		out.put("reason", reason);

		return out.toString();
	}

	/** At most 20 lookups an hour per user. */
	private boolean _tooManyLookups(User user) {
		long now = System.currentTimeMillis();

		long[] hits = _lookupHits.compute(
			user.getUserId(), (id, old) -> ((old == null) || ((now - old[1]) > 3_600_000L)) ? new long[] {1, now} : new long[] {old[0] + 1, old[1]});

		return hits[0] > 20;
	}

	private void _remember(String number, String json) {
		long now = System.currentTimeMillis();

		_lookups.values().removeIf(old -> (now - (Long)old[0]) >= 600_000L);
		_lookups.put(number, new Object[] {now, json});
	}

	/** The 3 operating flights (no codeshares) whose departure is closest to now: today's flight before last week's. */
	private static JSONArray _closestToNow(JSONArray data) {
		long now = System.currentTimeMillis();
		List<JSONObject> rows = new ArrayList<>();

		for (int i = 0; (data != null) && (i < data.length()); i++) {
			JSONObject f = data.getJSONObject(i);

			if ((f.getJSONObject("flight") != null) && f.getJSONObject("flight").isNull("codeshared")) {
				rows.add(f);
			}
		}

		rows.sort((a, b) -> Long.compare(_distance(a, now), _distance(b, now)));

		JSONArray flights = JSONFactoryUtil.createJSONArray();

		for (int i = 0; (i < rows.size()) && (i < 3); i++) {
			JSONObject f = rows.get(i);
			JSONObject out = JSONFactoryUtil.createJSONObject();

			out.put("flight", f.getJSONObject("flight").getString("iata"));
			out.put("airline", f.getJSONObject("airline") == null ? "" : f.getJSONObject("airline").getString("name"));
			out.put("status", f.getString("flight_status"));
			out.put("date", f.getString("flight_date"));
			out.put("departure", _part(f.getJSONObject("departure")));
			out.put("arrival", _part(f.getJSONObject("arrival")));

			flights.put(out);
		}

		return flights;
	}

	private static long _distance(JSONObject f, long now) {
		Date d = FeedSupport.time(f.getJSONObject("departure"), "scheduled");

		return (d == null) ? Long.MAX_VALUE : Math.abs(d.getTime() - now);
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
			Date d = FeedSupport.time(p, key);

			out.put(key, (d == null) ? "" : Instant.ofEpochMilli(d.getTime()).toString());
		}

		return out;
	}

	/* ---------- Free live check ---------- */

	/**
	 * For each flight that should be in the air right now (at most 12 a round), finds the plane on adsb.fi and
	 * lets LiveCheck work out the new landing time. Changed flights are picked up by the alert module,
	 * which sends the e-mails and notifications.
	 */
	private void _liveCheck() throws Exception {
		Map<Long, String> codes = new HashMap<>();

		_airports().forEach((code, id) -> codes.put(id, code));

		long now = System.currentTimeMillis();
		int checked = 0, updated = 0;

		for (ObjectEntry entry : _flights()) {
			Map<String, Serializable> v = entry.getValues();

			if (!_isFlying(v, now)) {
				continue;
			}

			String callsign = LiveCheck.callsign(String.valueOf(v.get("flightNumber")).toUpperCase());
			double[] to = LiveCheck.place(codes.get(_id(v.get("r_destinationAirport_c_airportId"))));

			if ((callsign == null) || (to == null)) {
				continue;
			}

			JSONObject plane = LiveCheck.plane(callsign);

			Thread.sleep(1100);

			Map<String, Serializable> changes = (plane == null) ? Collections.emptyMap() : LiveCheck.changes(v, plane, to, now);

			if (!changes.isEmpty()) {
				_save(entry, changes);

				updated++;
			}

			if (++checked >= 12) {
				break;
			}
		}

		_liveLast = Instant.now() + " (" + checked + " flights checked, " + updated + " updated)";
		_liveUpdated += updated;
	}

	/** A feed flight that is not finished and should be flying now, or leaves within 30 minutes. */
	private static boolean _isFlying(Map<String, Serializable> v, long now) {
		String status = String.valueOf(v.get("showstatus"));

		if (!"feed".equals(String.valueOf(v.get("source"))) || "Landed".equals(status) || "Cancelled".equals(status) ||
			!(v.get("departureTime") instanceof Date) || !(v.get("arrivalTime") instanceof Date)) {

			return false;
		}

		return (((Date)v.get("departureTime")).getTime() <= (now + (30 * 60_000L))) && (((Date)v.get("arrivalTime")).getTime() >= (now - (3 * 3_600_000L)));
	}

	private static Long _id(Object value) {
		try {
			return Long.valueOf(String.valueOf(value));
		}
		catch (NumberFormatException exception) {
			return null;
		}
	}

	/* ---------- Webhook ---------- */

	/**
	 * A flight data provider (or any system) can push a change here the moment it happens.
	 * Send POST /o/flight-feed/webhook with the header X-Webhook-Secret (FEED_WEBHOOK_SECRET in flight-feed.properties)
	 * and a JSON body such as {"flight":"AI101","date":"2026-11-12","status":"Delayed","delayMinutes":25,
	 * "arrivalTime":"2026-11-12T14:30:00Z","depGate":"A4"}. Only flights from the feed are changed.
	 */
	@POST
	@Path("/webhook")
	@Consumes(MediaType.APPLICATION_JSON)
	@Produces(MediaType.APPLICATION_JSON)
	public Response webhook(@HeaderParam("X-Webhook-Secret") String secret, String body) {
		try {
			String expected = FeedSupport.get("FEED_WEBHOOK_SECRET");

			if (expected == null) {
				return _error(503, "The webhook is switched off. Add FEED_WEBHOOK_SECRET to flight-feed.properties.");
			}

			if ((secret == null) || !java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8))) {
				return _error(403, "Wrong secret");
			}

			JSONObject json = JSONFactoryUtil.createJSONObject(body);
			String number = json.getString("flight").toUpperCase().replaceAll("\\s", "");

			if (number.isEmpty()) {
				return _error(400, "flight is required");
			}

			Map<String, Serializable> changes = _webhookChanges(json);
			String day = json.getString("date");
			int changed = 0;

			for (ObjectEntry entry : _flights()) {
				Map<String, Serializable> v = entry.getValues();

				if (number.equals(String.valueOf(v.get("flightNumber")).toUpperCase()) && "feed".equals(String.valueOf(v.get("source"))) &&
					(day.isEmpty() || ((v.get("departureTime") instanceof Date) && day.equals(FeedSupport.day((Date)v.get("departureTime")))))) {

					_save(entry, changes);

					changed++;
				}
			}

			_log.info("Flight feed webhook: " + number + " changed on " + changed + " flight(s)");

			return Response.ok("{\"changed\":" + changed + "}").build();
		}
		catch (IllegalArgumentException exception) {
			return _error(400, exception.getMessage());
		}
		catch (Exception exception) {
			_log.error("Flight feed webhook failed", exception);

			return _error(400, "Could not use the message: " + exception.getMessage());
		}
	}

	/** The values a webhook message wants to change. Throws IllegalArgumentException for a bad message. */
	private static Map<String, Serializable> _webhookChanges(JSONObject json) {
		Map<String, Serializable> changes = new HashMap<>();
		String status = json.getString("status");

		if (!status.isEmpty()) {
			if (!_STATUSES.contains(status)) {
				throw new IllegalArgumentException("status must be " + String.join(", ", _STATUSES));
			}

			changes.put("showstatus", status);
		}

		if (json.has("delayMinutes")) {
			changes.put("delayMinutes", Math.max(0, json.getInt("delayMinutes")));
		}

		for (String name : new String[] {"departureTime", "arrivalTime"}) {
			if (!json.getString(name).isEmpty()) {
				changes.put(name, Date.from(OffsetDateTime.parse(json.getString(name)).toInstant()));
			}
		}

		for (String name : new String[] {"depGate", "arrGate", "depTerminal", "arrTerminal"}) {
			if (json.has(name)) {
				changes.put(name, json.getString(name));
			}
		}

		if (changes.isEmpty()) {
			throw new IllegalArgumentException("Nothing to change");
		}

		return changes;
	}

	/* ---------- Provider sync ---------- */

	/** One round: ask the provider for departures of each airport and create or update the feed's flights. */
	private String _sync() throws Exception {
		synchronized (_lock) {
			Map<String, Long> airports = _airports();
			Map<String, ObjectEntry> index = _flightIndex();

			String list = FeedSupport.get("FEED_AIRPORTS");
			String[] codes = (list == null) ? airports.keySet().toArray(new String[0]) : list.toUpperCase().split("\\s*,\\s*");

			int[] counts = new int[3];	// skipped, created, updated
			int calls = 0;
			String problem = "";

			for (String code : codes) {
				if (!airports.containsKey(code)) {
					continue;
				}

				if (FeedSupport.callsLeft() <= 0) {
					problem = " Stopped: the monthly call limit was reached.";

					break;
				}

				JSONObject answer = FeedSupport.flights("limit=100&dep_iata=" + code);

				calls++;

				if (answer.has("error")) {
					problem = " The provider said: " + answer.getJSONObject("error").getString("message");

					break;
				}

				JSONArray data = answer.getJSONArray("data");

				for (int i = 0; (data != null) && (i < data.length()); i++) {
					counts[_upsert(data.getJSONObject(i), airports, index)]++;
				}
			}

			_lastRun = Instant.now().toString();
			_lastResult = counts[1] + " new, " + counts[2] + " updated, " + counts[0] + " skipped (" + calls + " calls)." + problem;

			_log.info("Flight feed: " + _lastResult);

			try {
				Files.writeString(FeedSupport.dataFile("flight-feed-last.txt"), _lastRun + "\n" + _lastResult);
			}
			catch (Exception exception) {
				_log.warn("Could not save the last feed run: " + exception.getMessage());
			}

			return "{\"result\":\"" + _lastResult.replace("\"", "'") + "\"}";
		}
	}

	/** 1 = created, 2 = updated, 0 = skipped. */
	private int _upsert(JSONObject f, Map<String, Long> airports, Map<String, ObjectEntry> index) throws Exception {
		Map<String, Serializable> values = _values(f, airports);

		if (values == null) {
			return 0;
		}

		String key = _key(values);
		ObjectEntry existing = index.get(key);

		if (existing == null) {
			index.put(key, _create(values));

			return 1;
		}

		// A flight an administrator typed in is never changed by the feed.
		if (!"feed".equals(String.valueOf(existing.getValues().get("source")))) {
			return 0;
		}

		_save(existing, values);

		return 2;
	}

	/** The flight's number, day and departure airport: the same key means the same flight. */
	private static String _key(Map<String, Serializable> values) {
		return values.get("flightNumber") + "|" + FeedSupport.day((Date)values.get("departureTime")) + "|" + values.get("r_originAirport_c_airportId");
	}

	/** The object values for one provider flight, or null when it should be skipped. */
	private static Map<String, Serializable> _values(JSONObject f, Map<String, Long> airports) {
		String number = f.getJSONObject("flight") == null ? "" : f.getJSONObject("flight").getString("iata");
		JSONObject dep = f.getJSONObject("departure"), arr = f.getJSONObject("arrival");

		if (number.isEmpty() || (dep == null) || (arr == null) || !airports.containsKey(dep.getString("iata")) || !airports.containsKey(arr.getString("iata"))) {
			return null;
		}

		// A codeshare is the same plane sold under another airline's number: keep only the operating flight.
		if (!f.getJSONObject("flight").isNull("codeshared")) {
			return null;
		}

		Date depTime = FeedSupport.time(dep, dep.getString("estimated").isEmpty() ? "scheduled" : "estimated");
		Date arrTime = FeedSupport.time(arr, arr.getString("estimated").isEmpty() ? "scheduled" : "estimated");

		if (depTime == null) {
			return null;
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

		// Scheduled times, terminals and gates, shown next to the expected times on the Flight Status page.
		Date schedDep = FeedSupport.time(dep, "scheduled"), schedArr = FeedSupport.time(arr, "scheduled");

		if (schedDep != null) {
			values.put("scheduledDeparture", schedDep);
		}

		if (schedArr != null) {
			values.put("scheduledArrival", schedArr);
		}

		values.put("depTerminal", dep.getString("terminal"));
		values.put("depGate", dep.getString("gate"));
		values.put("arrTerminal", arr.getString("terminal"));
		values.put("arrGate", arr.getString("gate"));

		if (arrTime != null) {
			values.put("arrivalTime", arrTime);
			values.put("flightDurationMinutes", (int)Math.max(0, (arrTime.getTime() - depTime.getTime()) / 60000));
		}

		return values;
	}

	/* ---------- Flights and airports ---------- */

	private ObjectDefinition _definition(String name) throws Exception {
		return _objectDefinitionLocalService.getObjectDefinition(PortalUtil.getDefaultCompanyId(), name);
	}

	/** Airport code to airport id. */
	private Map<String, Long> _airports() throws Exception {
		Map<String, Long> airports = new HashMap<>();

		for (ObjectEntry airport : _objectEntryLocalService.getObjectEntries(0, _definition("C_Airport").getObjectDefinitionId(), 0, 500)) {
			airports.put(String.valueOf(airport.getValues().get("code")).toUpperCase(), airport.getObjectEntryId());
		}

		return airports;
	}

	private List<ObjectEntry> _flights() throws Exception {
		return _objectEntryLocalService.getObjectEntries(FeedSupport.siteId(), _definition("C_Flight").getObjectDefinitionId(), 0, 1000);
	}

	/** The saved flights by key, read once per sync so each provider flight is found without reading them all again. */
	private Map<String, ObjectEntry> _flightIndex() throws Exception {
		Map<String, ObjectEntry> index = new HashMap<>();

		for (ObjectEntry entry : _flights()) {
			Map<String, Serializable> v = entry.getValues();

			if (v.get("departureTime") instanceof Date) {
				index.put(String.valueOf(v.get("flightNumber")) + "|" + FeedSupport.day((Date)v.get("departureTime")) + "|" + v.get("r_originAirport_c_airportId"), entry);
			}
		}

		return index;
	}

	private ServiceContext _context() throws Exception {
		long companyId = PortalUtil.getDefaultCompanyId();

		ServiceContext sc = new ServiceContext();

		sc.setCompanyId(companyId);
		sc.setScopeGroupId(FeedSupport.siteId());
		sc.setUserId(UserLocalServiceUtil.getDefaultUserId(companyId));

		return sc;
	}

	private ObjectEntry _create(Map<String, Serializable> values) throws Exception {
		ServiceContext sc = _context();

		return _objectEntryLocalService.addObjectEntry(sc.getScopeGroupId(), sc.getUserId(), _definition("C_Flight").getObjectDefinitionId(), 0L, null, values, sc);
	}

	/** Saves new values on a flight and keeps every other value. */
	private void _save(ObjectEntry entry, Map<String, Serializable> changes) throws Exception {
		ServiceContext sc = _context();

		Map<String, Serializable> merged = new HashMap<>(entry.getValues());

		merged.putAll(changes);

		_objectEntryLocalService.updateObjectEntry(sc.getUserId(), entry.getObjectEntryId(), entry.getObjectEntryFolderId(), merged, sc);
	}

	private long _lastRunMillis() {
		try {
			return Instant.parse(_lastRun).toEpochMilli();
		}
		catch (Exception exception) {
			return 0;
		}
	}

	/* ---------- Users and errors ---------- */

	/** The signed-in, active user of this request, or null. */
	private static User _sessionUser(HttpServletRequest request) {
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

	private static User _admin(HttpServletRequest request) {
		try {
			User user = _sessionUser(request);

			return ((user != null) && UserLocalServiceUtil.hasRoleUser(user.getCompanyId(), "Administrator", user.getUserId(), true)) ? user : null;
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
