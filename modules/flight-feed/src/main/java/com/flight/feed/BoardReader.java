package com.flight.feed;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
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

		try (InputStream in = BoardReader.class.getResourceAsStream("/boards.properties")) {
			_config.load(in);
		}
		catch (Exception exception) {
			_log.error("Could not read boards.properties: " + exception);
		}
	}

	String lastResult() {
		return _lastResult;
	}

	/** One round over every airport in boards.properties (or BOARD_AIRPORTS). */
	synchronized void run() throws Exception {
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

		StringBuilder result = new StringBuilder();

		for (String code : codes) {
			try {
				int[] counts = _readAirport(code);

				result.append(code).append(' ').append(counts[0]).append(" new, ").append(counts[1]).append(" changed; ");
			}
			catch (Exception exception) {
				_log.warn("Board " + code + " failed: " + exception);

				result.append(code).append(" failed; ");
			}
		}

		_lastResult = Instant.now() + " " + result;
		_firstRound = false;

		_cleanOld();
	}

	/** {new, changed} */
	private int[] _readAirport(String code) throws Exception {
		String base = _config.getProperty("airport." + code + ".url").replaceAll("/+$", "");
		ZoneId zone = ZoneId.of(_config.getProperty("airport." + code + ".zone", _config.getProperty("zone", "Asia/Kolkata")));
		ZonedDateTime now = ZonedDateTime.now(zone);
		LocalDate today = now.toLocalDate();

		// The whole day on the first round and once each new day; afterwards only the slots around now.
		Set<String> slots = new LinkedHashSet<>();

		if (_firstRound || !today.toString().equals(_fullDay.get(code))) {
			slots.addAll(java.util.Arrays.asList("1", "2", "3", "4"));
		}
		else {
			for (int hour : new int[] {Math.max(0, now.getHour() - 3), now.getHour(), Math.min(23, now.getHour() + 3)}) {
				slots.add(hour < 6 ? "1" : (hour < 12) ? "2" : (hour < 18) ? "3" : "4");
			}
		}

		String source = _dataSource(base);
		int created = 0, changed = 0;

		for (String direction : new String[] {"A", "D"}) {
			for (String slot : slots) {
				for (Map<String, String> row : _readSlot(base, source, direction, today, slot)) {
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

		if (slots.size() == 4) {
			_fullDay.put(code, today.toString());
		}

		return new int[] {created, changed};
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
			List<Map<String, String>> found = _parse(answer.getString("FlightHtml"));

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
		Date scheduled = _at(day, row.get("scheduled"), zone, null);

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

		Date estimated = row.get("estimated").isEmpty() ? null : _at(day, row.get("estimated"), zone, scheduled);

		if (estimated != null) {
			values.put("estimated", estimated);
		}

		values.put("terminal", row.get("terminal"));
		values.put("spot", row.get("spot"));
		values.put("statusText", row.get("status"));

		String key = code + "|" + direction + "|" + day + "|" + row.get("flightNumber") + "|" + row.get("scheduled");
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

		for (String name : new String[] {"terminal", "spot", "statusText", "airline", "otherCity", "otherCode"}) {
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

	private static String _post(String address, String json) throws Exception {
		HttpURLConnection connection = (HttpURLConnection)new URL(address).openConnection();

		connection.setRequestMethod("POST");
		connection.setRequestProperty("Content-Type", "application/json");
		connection.setRequestProperty("User-Agent", _AGENT);
		connection.setConnectTimeout(15_000);
		connection.setReadTimeout(40_000);
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

	/** Once a day: remove board rows older than 3 days. */
	private void _cleanOld() throws Exception {
		String today = LocalDate.now().toString();

		if (today.equals(_cleaned)) {
			return;
		}

		_cleaned = today;

		long companyId = PortalUtil.getDefaultCompanyId();
		ObjectDefinition definition = _definitions.getObjectDefinition(companyId, "C_BoardFlight");
		long limit = System.currentTimeMillis() - (3 * 86_400_000L);
		int removed = 0;

		for (ObjectEntry entry : _entries.getObjectEntries(FeedSupport.siteId(), definition.getObjectDefinitionId(), 0, 5000)) {
			Object scheduled = entry.getValues().get("scheduled");

			if ((scheduled instanceof Date) && (((Date)scheduled).getTime() < limit)) {
				_entries.deleteObjectEntry(entry);

				removed++;
			}
		}

		if (removed > 0) {
			_log.info("Boards: removed " + removed + " old rows");
		}
	}

	private static final String _AGENT = "FlightStatusPortalStudentProject/1.0";

	private static final Log _log = LogFactoryUtil.getLog(BoardReader.class);

	private final Properties _config = new Properties();

	private final ObjectDefinitionLocalService _definitions;

	private final ObjectEntryLocalService _entries;

	private final Map<String, String> _fullDay = new HashMap<>();

	private final Map<String, String> _sources = new HashMap<>();

	private boolean _firstRound = true;

	private String _cleaned = "";

	private String _lastResult = "not yet";

}
