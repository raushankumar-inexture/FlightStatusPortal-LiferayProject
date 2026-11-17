package com.flight.feed;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;
import com.liferay.petra.lang.SafeCloseable;
import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.security.auth.CompanyThreadLocal;
import com.liferay.portal.kernel.service.ServiceContext;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.util.PortalUtil;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.Serializable;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the public arrivals and departures boards of airport websites (the Adani airports share one board system)
 * and keeps them as BoardFlight entries. Airports and web addresses are in boards.properties; settings
 * (BOARD_INTERVAL_MINUTES, BOARD_AIRPORTS) are in flight-feed.properties. Each board is asked politely:
 * a clear program name, a pause between requests, and only the time slots around now except for one full read a day.
 */
final class BoardReader {

	BoardReader(ObjectDefinitionLocalService definitions, ObjectEntryLocalService entries) {
		_definitions = definitions;
		_entries = entries;

		_loadConfig();
		_loadStatus();
	}

	/** The airports: boards.properties inside the module, then bundles/data/boards.properties on top (add or change airports without code). */
	private synchronized void _loadConfig() {
		Properties config = new Properties();

		try (InputStream in = BoardReader.class.getResourceAsStream("/boards.properties")) {
			config.load(in);
		}
		catch (Exception exception) {
			_log.error("Could not read boards.properties: " + exception);
		}

		try {
			java.nio.file.Path file = FeedSupport.dataFile("boards.properties");

			if (java.nio.file.Files.exists(file)) {
				try (InputStream in = java.nio.file.Files.newInputStream(file)) {
					config.load(in);
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read bundles/data/boards.properties: " + exception);
		}

		_config.clear();
		_config.putAll(config);
	}

	/** How each airport board is doing: last good read, failures in a row, rows, the day it was read in full. Kept in a small file so a restart does not forget. */
	static final class Status {

		long lastOk;
		long lastTry;
		int failures;
		int rows;
		String error = "";
		String fullDay = "";

	}

	private void _loadStatus() {
		try {
			java.nio.file.Path file = FeedSupport.dataFile("board-status.json");

			if (java.nio.file.Files.exists(file)) {
				JSONObject json = JSONFactoryUtil.createJSONObject(java.nio.file.Files.readString(file));

				for (java.util.Iterator<String> it = json.keys(); it.hasNext();) {
					String code = it.next();
					JSONObject o = json.getJSONObject(code);
					Status status = new Status();

					status.lastOk = o.getLong("lastOk");
					status.lastTry = o.getLong("lastTry");
					status.failures = o.getInt("failures");
					status.rows = o.getInt("rows");
					status.error = o.getString("error");
					status.fullDay = o.getString("fullDay");

					_status.put(code, status);
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read board-status.json: " + exception);
		}
	}

	private synchronized void _saveStatus() {
		try {
			JSONObject json = JSONFactoryUtil.createJSONObject();

			for (Map.Entry<String, Status> entry : _status.entrySet()) {
				Status s = entry.getValue();
				JSONObject o = JSONFactoryUtil.createJSONObject();

				o.put("lastOk", s.lastOk);
				o.put("lastTry", s.lastTry);
				o.put("failures", s.failures);
				o.put("rows", s.rows);
				o.put("error", s.error);
				o.put("fullDay", s.fullDay);

				json.put(entry.getKey(), o);
			}

			java.nio.file.Files.writeString(FeedSupport.dataFile("board-status.json"), json.toString());
		}
		catch (Exception exception) {
			_log.warn("Could not save board-status.json: " + exception);
		}
	}

	/** The state of each airport that is configured now. */
	synchronized Map<String, Status> statuses() {
		Map<String, Status> out = new java.util.TreeMap<>();

		for (String code : _codes()) {
			if (_status.containsKey(code)) {
				out.put(code, _status.get(code));
			}
		}

		return out;
	}

	private Set<String> _codes() {
		String wanted = FeedSupport.get("BOARD_AIRPORTS");
		Set<String> codes = new LinkedHashSet<>();

		for (String key : _config.stringPropertyNames()) {
			if (key.startsWith("airport.") && key.endsWith(".url")) {
				codes.add(key.substring(8, key.length() - 4));
			}
		}

		if (wanted != null) {
			codes.retainAll(java.util.Arrays.asList(wanted.toUpperCase().split("\\s*,\\s*")));
		}

		return codes;
	}

	String lastResult() {
		return _lastResult;
	}

	/** One round over every airport in boards.properties (or BOARD_AIRPORTS). A failing airport never stops the others. */
	void run() throws Exception {
		_loadConfig();

		StringBuilder result = new StringBuilder();

		for (String code : _codes()) {
			result.append(_readOne(code));
		}

		_lastResult = Instant.now() + " " + result;

		_cleanOld();
	}

	/**
	 * Reads one airport now, in the background, when the page asks for it and the last read is older than
	 * BOARD_REFRESH_MINUTES (default 2). Returns true when a read was started. This keeps the airport someone is looking at fresh
	 * without reading every airport all the time.
	 */
	boolean refresh(String code) {
		code = (code == null) ? "" : code.trim().toUpperCase();

		if (!_codes().contains(code)) {
			return false;
		}

		Status status = _status.computeIfAbsent(code, k -> new Status());

		synchronized (status) {
			if ((System.currentTimeMillis() - status.lastTry) < (FeedSupport.number("BOARD_REFRESH_MINUTES", 2) * 60_000L)) {
				return false;
			}

			// Marked now, so two quick page requests start only one read.
			status.lastTry = System.currentTimeMillis();
		}

		String airport = code;

		_refresher.execute(() -> _readOne(airport));

		return true;
	}

	void stop() {
		_refresher.shutdownNow();
	}

	/** One airport, one read at a time (a round and a page request never read the same board together). Returns a line for the result text. */
	private String _readOne(String code) {
		Object lock = _locks.computeIfAbsent(code, k -> new Object());

		synchronized (lock) {
			Status status = _status.computeIfAbsent(code, k -> new Status());

			status.lastTry = System.currentTimeMillis();

			try {
				int[] counts = _readAirport(code, status);

				status.lastOk = System.currentTimeMillis();
				status.failures = 0;
				status.error = "";

				return code + ' ' + counts[0] + " new, " + counts[1] + " changed; ";
			}
			catch (Exception exception) {
				status.failures++;
				status.error = String.valueOf(exception.getMessage()).replaceAll("\\s+", " ");

				if (status.error.length() > 160) {
					status.error = status.error.substring(0, 160);
				}

				_log.warn("Board " + code + " failed (" + status.failures + " in a row): " + exception);

				return code + " failed; ";
			}
			finally {
				_saveStatus();
			}
		}
	}

	/** {new, changed} */
	private int[] _readAirport(String code, Status status) throws Exception {
		String base = _config.getProperty("airport." + code + ".url").replaceAll("/+$", "");
		ZoneId zone = ZoneId.of(_config.getProperty("airport." + code + ".zone", _config.getProperty("zone", "Asia/Kolkata")));
		ZonedDateTime now = ZonedDateTime.now(zone);
		LocalDate today = now.toLocalDate();

		// Airports with their own board system (type in boards.properties); the default is the Adani board system below.
		String type = _config.getProperty("airport." + code + ".type", "adani");

		if (!"adani".equals(type)) {
			return _readOther(code, status, base, type, today, zone);
		}

		// The whole day on the first round and once each new day; afterwards only the slots around now.
		Set<String> slots = new LinkedHashSet<>();

		if (!today.toString().equals(status.fullDay)) {
			slots.addAll(java.util.Arrays.asList("1", "2", "3", "4"));
		}
		else {
			for (int hour : new int[] {Math.max(0, now.getHour() - 3), now.getHour(), Math.min(23, now.getHour() + 3)}) {
				slots.add(hour < 6 ? "1" : (hour < 12) ? "2" : (hour < 18) ? "3" : "4");
			}
		}

		String source = _dataSource(base);
		int created = 0, changed = 0, read = 0;

		for (String direction : new String[] {"A", "D"}) {
			for (String slot : slots) {
				for (Map<String, String> row : _readSlot(base, source, direction, today, slot)) {
					read++;

					int result = _save(code, direction, today, zone, row);

					if (result == 1) {
						created++;
					}
					else if (result == 2) {
						changed++;
					}
				}
			}
		}

		// A whole day with no flights at all means the page changed or the board is empty: count it as a failure, not as a quiet day.
		if ((slots.size() == 4) && (read == 0)) {
			throw new IllegalStateException("The board returned no flights for the whole day");
		}

		if (slots.size() == 4) {
			status.fullDay = today.toString();
		}

		status.rows = (slots.size() == 4) ? read : Math.max(status.rows, read);

		return new int[] {created, changed};
	}

	/** Airports that give the whole day in one answer (Delhi: type dial, Hyderabad: type hyderabad). {new, changed} */
	private int[] _readOther(String code, Status status, String base, String type, LocalDate today, ZoneId zone) throws Exception {
		int created = 0, changed = 0, read = 0;

		for (String direction : new String[] {"A", "D"}) {
			List<Map<String, String>> rows = "dial".equals(type) ? _delhiRows(base, direction) : _hyderabadRows(base, direction);

			for (Map<String, String> row : rows) {
				read++;

				int result = _save(code, direction, today, zone, row);

				if (result == 1) {
					created++;
				}
				else if (result == 2) {
					changed++;
				}
			}
		}

		if (read == 0) {
			throw new IllegalStateException("The board returned no flights (the page may have changed)");
		}

		status.fullDay = today.toString();
		status.rows = read;

		return new int[] {created, changed};
	}

	/** Delhi: one answer per direction and flight kind (D = domestic, I = international). It has the city name but no airport code and no estimated time, only a status text. */
	private List<Map<String, String>> _delhiRows(String base, String direction) throws Exception {
		List<Map<String, String>> rows = new ArrayList<>();

		for (String kind : new String[] {"D", "I"}) {
			JSONArray list = JSONFactoryUtil.createJSONArray(
				_get(base + "/dial-api/flight-info/flight/" + ("A".equals(direction) ? "arrival" : "departure") + "?FltWay=" + kind + "&Terminal=&search=&loadMore=true"));

			for (int i = 0; i < list.length(); i++) {
				JSONObject o = list.getJSONObject(i);
				Map<String, String> row = new HashMap<>();

				row.put("day", o.getString("FLIGHTDATE"));
				row.put("keyPart", o.getString("AIRPORT_DESCRIPTION").replaceAll("\\W", ""));
				row.put("scheduled", o.getString("SCHEDULED_TIME"));
				row.put("estimated", "");
				row.put("airline", o.getString("airline_name"));
				row.put("otherCity", o.getString("AIRPORT_DESCRIPTION"));
				row.put("otherCode", "");
				row.put("flightNumber", o.getString("FLIGHTNUMBER").replaceAll("\\s+", ""));
				row.put("terminal", o.getString("terminal").replaceFirst("^T(?=\\d)", ""));  // the page adds the T itself
				row.put("spot", o.getString("GATE_BELT").replaceAll("[_-]+", ""));
				row.put("status", o.getString("FLIGHT_STATUS_DESCRIPTION"));

				rows.add(row);

				Thread.sleep(0);
			}

			Thread.sleep(1200);
		}

		return rows;
	}

	/** Hyderabad: one answer per direction with scheduled, estimated and actual times (yyyyMMddHHmmss), the other airport's code and a status word. */
	private List<Map<String, String>> _hyderabadRows(String base, String direction) throws Exception {
		boolean arrivals = "A".equals(direction);
		List<Map<String, String>> rows = new ArrayList<>();

		JSONArray list = JSONFactoryUtil.createJSONObject(_get(base + "/next-api/flights?type=" + (arrivals ? "arrivals" : "departures") + "&flightType=all&limit=2000")).getJSONArray("data");

		for (int i = 0; i < list.length(); i++) {
			JSONObject o = list.getJSONObject(i);
			String scheduled = o.getString("rawScheduledTime");
			String estimated = o.getString("rawEstimatedTime").isEmpty() ? o.getString("rawActualTime") : o.getString("rawEstimatedTime");

			if (scheduled.length() < 12) {
				continue;
			}

			Map<String, String> row = new HashMap<>();

			row.put("day", scheduled.substring(0, 4) + "-" + scheduled.substring(4, 6) + "-" + scheduled.substring(6, 8));
			row.put("scheduled", scheduled.substring(8, 10) + ":" + scheduled.substring(10, 12));
			row.put("estimated", (estimated.length() < 12) ? "" : estimated.substring(8, 10) + ":" + estimated.substring(10, 12));
			row.put("airline", o.getString("airlineName"));
			row.put("otherCity", o.getString(arrivals ? "originCity" : "destinationCity"));
			row.put("otherCode", o.getString(arrivals ? "origin" : "destination"));
			row.put("flightNumber", o.getString("flightNumber").replaceAll("\\s+", ""));
			row.put("terminal", "");
			row.put("spot", o.getString(arrivals ? "belt" : "gate"));
			row.put("status", o.getString("statusDescription"));

			rows.add(row);
		}

		return rows;
	}

	/** All the pages of one time slot of one board. */
	private List<Map<String, String>> _readSlot(String base, String source, String direction, LocalDate day, String slot) throws Exception {
		List<Map<String, String>> rows = new ArrayList<>();

		for (int page = 1; page <= 30; page++) {
			JSONObject body = JSONFactoryUtil.createJSONObject();

			body.put("Terminal", "");
			body.put("Date", day + "T00:00:00");
			body.put("SearchText", "");
			body.put("PageNumber", String.valueOf(page));
			body.put("IsLoadMore", page > 1);
			body.put("TabName", direction);
			body.put("timeslot", slot);
			body.put("DataSourceId", source);
			body.put("ServiceType", "Passenger");

			JSONObject answer = JSONFactoryUtil.createJSONObject(_post(base + "/api/sitecore/FlightStatus/Search", body.toString()));

			if (!answer.has("FlightHtml")) {
				throw new IllegalStateException("The board answer has no flight list (the page may have changed)");
			}

			List<Map<String, String>> found = _parse(answer.getString("FlightHtml"));

			// Rows are in the page but none could be read: the layout changed.
			if (found.isEmpty() && (answer.getString("FlightHtml").split("flightListRow", -1).length > 2)) {
				throw new IllegalStateException("The board rows could not be read (the page layout changed)");
			}

			rows.addAll(found);

			Thread.sleep(1200);

			if (answer.getBoolean("IsLastPage") || found.isEmpty()) {
				break;
			}
		}

		return rows;
	}

	private static final Pattern _ROW_SPLIT = Pattern.compile("<div class=\"flightListRow\">");

	private static final Pattern _TIME_COLUMN = Pattern.compile("fontMedium\">(.*?)</div>", Pattern.DOTALL);

	private static final Pattern _REGULAR_TIME = Pattern.compile("<span class=\"regularTime\">\\s*([0-9:]+)\\s*</span>");

	private static final Pattern _AIRLINE = Pattern.compile("<label>(.*?)</label>\\s*(.*?)\\s*</h6>", Pattern.DOTALL);

	private static final Pattern _NUMBER = Pattern.compile("Flight No</span>\\s*([A-Z0-9]{2}\\s*\\d+[A-Z]?)");

	private static final Pattern _TERMINAL = Pattern.compile("Terminal</span>\\s*([^<\\s]*)");

	private static final Pattern _SPOT = Pattern.compile("(?:Baggage Belt|Gate)</span>\\s*([^<\\s]*)");

	private static final Pattern _STATUS = Pattern.compile("<button class=\"statusButton ?[a-z ]*\">(.*?)</button>", Pattern.DOTALL);

	private static final Pattern _OTHER = Pattern.compile("^(.*?)\\s*\\(([A-Z]{3})\\)$");

	/** The rows of one answer: scheduled, estimated, airline, city, code, flight, terminal, spot and status. */
	static List<Map<String, String>> _parse(String html) {
		List<Map<String, String>> rows = new ArrayList<>();
		String[] parts = _ROW_SPLIT.split(html);

		for (int i = 1; i < parts.length; i++) {
			String part = parts[i];
			Matcher column = _TIME_COLUMN.matcher(part), number = _NUMBER.matcher(part), airline = _AIRLINE.matcher(part);

			if (!column.find() || !number.find() || !airline.find()) {
				continue;
			}

			Matcher regular = _REGULAR_TIME.matcher(column.group(1));
			String rest = column.group(1).replaceAll("(?s)<span class=\"regularTime\">.*?</span>", "").replaceAll("<[^>]+>", "").trim();
			String scheduled = regular.find() ? regular.group(1) : rest, estimated = regular.find(0) ? rest : "";

			Matcher other = _OTHER.matcher(airline.group(2).replaceAll("\\s+", " ").trim());
			Matcher terminal = _TERMINAL.matcher(part), spot = _SPOT.matcher(part), status = _STATUS.matcher(part);

			Map<String, String> row = new HashMap<>();

			row.put("scheduled", scheduled);
			row.put("estimated", estimated);
			row.put("airline", _text(airline.group(1)));
			row.put("otherCity", other.find() ? other.group(1) : airline.group(2).trim());
			row.put("otherCode", other.find(0) ? other.group(2) : "");
			row.put("flightNumber", number.group(1).replaceAll("\\s+", ""));
			row.put("terminal", terminal.find() ? terminal.group(1) : "");
			row.put("spot", spot.find() ? spot.group(1) : "");
			row.put("status", status.find() ? _text(status.group(1)) : "");

			rows.add(row);
		}

		return rows;
	}

	private static String _text(String html) {
		return html.replaceAll("<[^>]+>", "").replace("&amp;", "&").replaceAll("\\s+", " ").trim();
	}

	/** 1 = created, 2 = changed, 0 = the same. */
	private int _save(String code, String direction, LocalDate day, ZoneId zone, Map<String, String> row) throws Exception {
		// Some boards give the day with every row; the Adani boards are read one day at a time.
		LocalDate rowDay = row.containsKey("day") ? LocalDate.parse(row.get("day")) : day;

		Date scheduled = _at(rowDay, row.get("scheduled"), zone, null);

		if (scheduled == null) {
			return 0;
		}

		Map<String, Serializable> values = new HashMap<>();

		values.put("airportCode", code);
		values.put("direction", direction);
		values.put("flightNumber", row.get("flightNumber"));
		values.put("airline", row.get("airline"));
		values.put("otherCode", row.get("otherCode"));
		values.put("otherCity", row.get("otherCity"));
		values.put("scheduled", scheduled);

		Date estimated = row.get("estimated").isEmpty() ? null : _at(rowDay, row.get("estimated"), zone, scheduled);

		if (estimated != null) {
			values.put("estimated", estimated);
		}

		values.put("terminal", row.get("terminal"));
		values.put("spot", row.get("spot"));
		values.put("statusText", row.get("status"));

		// The row is known by its flight and its time; Delhi moves the time when a flight is late, so there the other city is used instead of the time.
		String key = code + "|" + direction + "|" + rowDay + "|" + row.get("flightNumber") + "|" + (row.containsKey("keyPart") ? row.get("keyPart") : row.get("scheduled"));
		long siteId = FeedSupport.siteId();
		long companyId = PortalUtil.getDefaultCompanyId();
		ObjectDefinition definition = _definitions.getObjectDefinition(companyId, "C_BoardFlight");

		ServiceContext sc = new ServiceContext();

		sc.setCompanyId(companyId);
		sc.setScopeGroupId(siteId);
		sc.setUserId(UserLocalServiceUtil.getDefaultUserId(companyId));

		ObjectEntry existing = _entries.fetchObjectEntry(key, definition.getObjectDefinitionId(), companyId);

		if (existing == null) {
			_entries.addOrUpdateObjectEntry(key, siteId, sc.getUserId(), definition.getObjectDefinitionId(), 0L, values, sc);

			return 1;
		}

		Map<String, Serializable> old = existing.getValues();
		boolean same = true;

		for (String name : new String[] {"scheduled", "terminal", "spot", "statusText", "airline", "otherCity", "otherCode"}) {
			same &= String.valueOf(values.get(name)).equals(String.valueOf(old.get(name)));
		}

		same &= String.valueOf(values.get("estimated")).equals(String.valueOf(old.get("estimated")));

		if (same) {
			return 0;
		}

		Map<String, Serializable> merged = new HashMap<>(old);

		merged.putAll(values);

		_entries.updateObjectEntry(sc.getUserId(), existing.getObjectEntryId(), existing.getObjectEntryFolderId(), merged, sc);

		return 2;
	}

	/** HH:mm on a day in the airport's time zone. An estimated time that is more than 12 hours from the scheduled one belongs to the next or the previous day. */
	private static Date _at(LocalDate day, String clock, ZoneId zone, Date near) {
		try {
			ZonedDateTime time = day.atTime(LocalTime.parse(clock)).atZone(zone);

			if (near != null) {
				long gap = time.toInstant().toEpochMilli() - near.getTime();

				if (gap > 12 * 3_600_000L) {
					time = time.minusDays(1);
				}
				else if (gap < -12 * 3_600_000L) {
					time = time.plusDays(1);
				}
			}

			return Date.from(time.toInstant());
		}
		catch (Exception exception) {
			return null;
		}
	}

	/** The board's data source id is in the page itself. */
	private String _dataSource(String base) throws Exception {
		String known = _sources.get(base);

		if (known != null) {
			return known;
		}

		HttpURLConnection connection = (HttpURLConnection)new URL(base + "/en/flight-status?flightType=A").openConnection();

		connection.setRequestProperty("User-Agent", _AGENT);
		connection.setConnectTimeout(15_000);
		connection.setReadTimeout(30_000);

		try (InputStream in = connection.getInputStream()) {
			Matcher matcher = Pattern.compile("id=\"DataSourceId\" value=\"([^\"]*)\"").matcher(new String(in.readAllBytes(), StandardCharsets.UTF_8));

			if (!matcher.find()) {
				throw new IllegalStateException("No data source id on " + base);
			}

			_sources.put(base, matcher.group(1));

			return matcher.group(1);
		}
		finally {
			connection.disconnect();
		}
	}

	private static String _get(String address) throws Exception {
		HttpURLConnection connection = (HttpURLConnection)new URL(address).openConnection();

		connection.setRequestProperty("User-Agent", _AGENT);
		connection.setRequestProperty("Accept", "application/json");
		connection.setConnectTimeout(15_000);
		connection.setReadTimeout((int)(FeedSupport.number("BOARD_READ_TIMEOUT_SECONDS", 90) * 1000L));

		try (InputStream in = connection.getInputStream()) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		finally {
			connection.disconnect();
		}
	}

	private static String _post(String address, String json) throws Exception {
		HttpURLConnection connection = (HttpURLConnection)new URL(address).openConnection();

		connection.setRequestMethod("POST");
		connection.setRequestProperty("Content-Type", "application/json");
		connection.setRequestProperty("User-Agent", _AGENT);
		connection.setConnectTimeout(15_000);
		connection.setReadTimeout((int)(FeedSupport.number("BOARD_READ_TIMEOUT_SECONDS", 90) * 1000L));
		connection.setDoOutput(true);

		try (OutputStream out = connection.getOutputStream()) {
			out.write(json.getBytes(StandardCharsets.UTF_8));
		}

		try (InputStream in = connection.getInputStream()) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		finally {
			connection.disconnect();
		}
	}

	/**
	 * Once a day: remove board rows older than 3 days, in chunks so any number of rows is cleaned. The delete needs the company set
	 * (a background thread has none, and Liferay then fails with "Feature flag ... is not available for company 0").
	 */
	private void _cleanOld() throws Exception {
		String today = LocalDate.now().toString();

		if (today.equals(_cleaned)) {
			return;
		}

		long companyId = PortalUtil.getDefaultCompanyId();
		ObjectDefinition definition = _definitions.getObjectDefinition(companyId, "C_BoardFlight");
		long limit = System.currentTimeMillis() - (3 * 86_400_000L);
		int removed = 0, start = 0, chunk = 2000;

		try (SafeCloseable closeable = CompanyThreadLocal.setCompanyIdWithSafeCloseable(companyId)) {
			while (true) {
				List<ObjectEntry> rows = _entries.getObjectEntries(FeedSupport.siteId(), definition.getObjectDefinitionId(), start, start + chunk);

				if (rows.isEmpty()) {
					break;
				}

				int kept = 0;

				for (ObjectEntry entry : rows) {
					Object scheduled = entry.getValues().get("scheduled");

					if ((scheduled instanceof Date) && (((Date)scheduled).getTime() < limit)) {
						_entries.deleteObjectEntry(entry);

						removed++;
					}
					else {
						kept++;
					}
				}

				// Deleted rows are gone from the list, so only the kept ones move the start.
				start += kept;
			}
		}

		// Marked as done only when it worked, so a failure is tried again in the next round.
		_cleaned = today;

		if (removed > 0) {
			_log.info("Boards: removed " + removed + " old rows");
		}
	}

	private static final String _AGENT = "FlightStatusPortalStudentProject/1.0";

	private static final Log _log = LogFactoryUtil.getLog(BoardReader.class);

	private final Properties _config = new Properties();

	private final ObjectDefinitionLocalService _definitions;

	private final ObjectEntryLocalService _entries;

	private final Map<String, Status> _status = new java.util.concurrent.ConcurrentHashMap<>();

	private final Map<String, String> _sources = new java.util.concurrent.ConcurrentHashMap<>();

	private final Map<String, Object> _locks = new java.util.concurrent.ConcurrentHashMap<>();

	private final java.util.concurrent.ExecutorService _refresher = java.util.concurrent.Executors.newFixedThreadPool(
		2,
		runnable -> {
			Thread thread = new Thread(runnable, "flight-feed-board-refresh");

			thread.setDaemon(true);

			return thread;
		});

	private String _cleaned = "";

	private String _lastResult = "not yet";

}
