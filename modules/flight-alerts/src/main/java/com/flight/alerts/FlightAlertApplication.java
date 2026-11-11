package com.flight.alerts;

import com.liferay.expando.kernel.model.ExpandoColumn;
import com.liferay.expando.kernel.model.ExpandoColumnConstants;
import com.liferay.expando.kernel.model.ExpandoTable;
import com.liferay.expando.kernel.model.ExpandoTableConstants;
import com.liferay.expando.kernel.model.ExpandoValue;
import com.liferay.expando.kernel.service.ExpandoColumnLocalServiceUtil;
import com.liferay.expando.kernel.service.ExpandoTableLocalServiceUtil;
import com.liferay.expando.kernel.service.ExpandoValueLocalServiceUtil;
import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;
import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.dao.orm.QueryUtil;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.security.auth.AuthTokenUtil;
import com.liferay.portal.kernel.security.auth.PrincipalException;
import com.liferay.portal.kernel.service.ServiceContext;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.servlet.PortalSessionContext;
import com.liferay.portal.kernel.util.PortalUtil;
import com.liferay.portal.kernel.util.PrefsPropsUtil;
import com.liferay.portal.kernel.util.PropsKeys;
import com.liferay.portal.kernel.util.PropsUtil;
import com.liferay.portal.kernel.util.HtmlUtil;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.File;
import java.io.Serializable;

import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Properties;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Deactivate;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

@Component(
	property = {
		JaxrsWhiteboardConstants.JAX_RS_APPLICATION_BASE + "=/flight-alerts",
		JaxrsWhiteboardConstants.JAX_RS_NAME + "=flight.Alerts",
		"liferay.access.control.disable=true"
	},
	service = Application.class
)
public class FlightAlertApplication extends Application {

	private static final Log _log = LogFactoryUtil.getLog(
		FlightAlertApplication.class);

	private static final String _ALERTS_COLUMN = "flightAlertFlightIds";

	private static final long _SITE_ID = 34157L;

	private static final HttpClient _HTTP_CLIENT = HttpClient.newBuilder().
		connectTimeout(Duration.ofSeconds(10)).build();

	private static final Map<Long, FlightState> _flightStates =
		new HashMap<>();

	/** Boarding passes whose flight was already followed for their owner. */
	private static final Set<Long> _passesFollowed = new HashSet<>();

	@Override
	public Set<Object> getSingletons() {
		return Collections.singleton(this);
	}

	@GET
	@Path("/subscriptions")
	@Produces(MediaType.APPLICATION_JSON)
	public Response subscriptions(@Context HttpServletRequest request) {
		try {
			User user = _user(request);

			if (user == null) {
				return _error(401, "Please log in to manage flight alerts");
			}

			_ensureColumn(user.getCompanyId());

			JSONArray ids = JSONFactoryUtil.createJSONArray();

			for (String id : _flightIds(user)) {
				ids.put(id);
			}

			return Response.ok(ids.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Could not load flight alert subscriptions", exception);

			return _error(500, "Could not load flight alerts");
		}
	}

	@POST
	@Path("/subscriptions")
	@Consumes(MediaType.APPLICATION_JSON)
	@Produces(MediaType.APPLICATION_JSON)
	public Response updateSubscription(
		@Context HttpServletRequest request, String body) {

		try {
			User user = _user(request);

			if (user == null) {
				return _error(401, "Please log in to manage flight alerts");
			}

			try {
				AuthTokenUtil.checkCSRFToken(
					request, FlightAlertApplication.class.getName());
			}
			catch (PrincipalException principalException) {
				return _error(403, "Please refresh the page and try again");
			}

			JSONObject input;

			try {
				input = JSONFactoryUtil.createJSONObject(body);
			}
			catch (Exception exception) {
				return _error(400, "Send a valid flight alert request");
			}

			Object flightIdValue = input.get("flightId");
			Object followingValue = input.get("following");

			if (!(flightIdValue instanceof Number) ||
				!(followingValue instanceof Boolean)) {

				return _error(400, "Send a valid flight alert request");
			}

			long flightId = ((Number)flightIdValue).longValue();
			boolean following = (Boolean)followingValue;

			if (flightId <= 0) {
				return _error(400, "Choose a valid flight");
			}

			ObjectEntry flight = _objectEntryLocalService.fetchObjectEntry(
				flightId);

			if ((flight == null) ||
				(flight.getObjectDefinitionId() !=
					_definition().getObjectDefinitionId()) ||
				(flight.getGroupId() != _SITE_ID)) {

				return _error(404, "Flight not found");
			}

			_ensureColumn(user.getCompanyId());

			Set<String> ids = new LinkedHashSet<>(
				Arrays.asList(_flightIds(user)));
			String key = String.valueOf(flightId);

			if (following) {
				ids.add(key);
			}
			else {
				ids.remove(key);
			}

			_saveFlightIds(user, ids.toArray(new String[0]));

			JSONObject result = JSONFactoryUtil.createJSONObject();

			result.put("following", following);

			return Response.ok(result.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Could not update a flight alert subscription", exception);

			return _error(500, "Could not update flight alerts");
		}
	}

	/** Notifications the bell in the header shows: newest first, only the signed-in user's own. */
	@GET
	@Path("/notifications")
	@Produces(MediaType.APPLICATION_JSON)
	public Response notifications(@Context HttpServletRequest request) {
		try {
			User user = _user(request);

			if (user == null) {
				return _error(401, "Please log in");
			}

			List<ObjectEntry> mine = _myNotifications(user);

			mine.sort((a, b) -> b.getCreateDate().compareTo(a.getCreateDate()));

			JSONArray out = JSONFactoryUtil.createJSONArray();

			for (ObjectEntry entry : mine.subList(0, Math.min(30, mine.size()))) {
				Map<String, Serializable> v = entry.getValues();
				JSONObject n = JSONFactoryUtil.createJSONObject();

				n.put("id", entry.getObjectEntryId());
				n.put("flightId", _string(v.get("flightId")));
				n.put("flightNumber", _string(v.get("flightNumber")));
				n.put("message", _string(v.get("message")));
				n.put("seen", "yes".equals(_string(v.get("seen"))));
				n.put("time", entry.getCreateDate().getTime());

				out.put(n);
			}

			return Response.ok(out.toString()).build();
		}
		catch (Exception exception) {
			_log.error("Could not load notifications", exception);

			return _error(500, "Could not load notifications");
		}
	}

	@POST
	@Path("/notifications/read")
	@Produces(MediaType.APPLICATION_JSON)
	public Response markRead(@Context HttpServletRequest request) {
		try {
			User user = _user(request);

			if (user == null) {
				return _error(401, "Please log in");
			}

			AuthTokenUtil.checkCSRFToken(request, FlightAlertApplication.class.getName());

			for (ObjectEntry entry : _myNotifications(user)) {
				if ("yes".equals(_string(entry.getValues().get("seen")))) {
					continue;
				}

				Map<String, Serializable> values = new HashMap<>(entry.getValues());

				values.put("seen", "yes");

				ServiceContext sc = new ServiceContext();

				sc.setCompanyId(user.getCompanyId());
				sc.setScopeGroupId(_SITE_ID);
				sc.setUserId(user.getUserId());

				_objectEntryLocalService.updateObjectEntry(
					user.getUserId(), entry.getObjectEntryId(), entry.getObjectEntryFolderId(), values, sc);
			}

			return Response.ok("{}").build();
		}
		catch (PrincipalException principalException) {
			return _error(403, "Please refresh the page and try again");
		}
		catch (Exception exception) {
			_log.error("Could not mark notifications as read", exception);

			return _error(500, "Could not update notifications");
		}
	}

	private List<ObjectEntry> _myNotifications(User user) throws Exception {
		List<ObjectEntry> mine = new ArrayList<>();

		for (ObjectEntry entry : _objectEntryLocalService.getObjectEntries(
				_SITE_ID, _notificationDefinition(user.getCompanyId()).getObjectDefinitionId(), 0, 1000)) {

			if (String.valueOf(user.getUserId()).equals(_string(entry.getValues().get("recipientId")))) {
				mine.add(entry);
			}
		}

		return mine;
	}

	private ObjectDefinition _notificationDefinition(long companyId) throws Exception {
		return _objectDefinitionLocalService.getObjectDefinition(companyId, "C_FlightNotification");
	}

	private void _notify(User user, long flightId, String flightNumber, String text) {
		try {
			Map<String, Serializable> values = new HashMap<>();

			values.put("recipientId", String.valueOf(user.getUserId()));
			values.put("flightId", String.valueOf(flightId));
			values.put("flightNumber", flightNumber);
			values.put("message", text);
			values.put("seen", "no");

			ServiceContext sc = new ServiceContext();

			sc.setCompanyId(user.getCompanyId());
			sc.setScopeGroupId(_SITE_ID);
			sc.setUserId(user.getUserId());

			_objectEntryLocalService.addObjectEntry(
				_SITE_ID, user.getUserId(), _notificationDefinition(user.getCompanyId()).getObjectDefinitionId(),
				0L, null, values, sc);
		}
		catch (Exception exception) {
			_log.error("Could not save a notification for user " + user.getUserId(), exception);
		}
	}

	@Activate
	protected void activate() {
		_loadState();

		_scheduler = Executors.newSingleThreadScheduledExecutor(
			runnable -> {
				Thread thread = new Thread(runnable, "flight-alert-email");

				thread.setDaemon(true);

				return thread;
			});

		_scheduler.scheduleWithFixedDelay(
			() -> {
				try {
					_checkFlightChanges();
				}
				catch (Exception exception) {
					_log.error("Could not check for flight changes", exception);
				}
			},
			15, 30, TimeUnit.SECONDS);
	}

	@Deactivate
	protected void deactivate() {
		if (_scheduler != null) {
			_scheduler.shutdownNow();
		}
	}

	private void _checkFlightChanges() throws Exception {
		Map<Long, FlightState> currentStates = new HashMap<>();

		for (ObjectEntry entry : _objectEntryLocalService.getObjectEntries(
				_SITE_ID, _definition().getObjectDefinitionId(), 0, 1000)) {

			Map<String, Serializable> values = entry.getValues();

			currentStates.put(
				entry.getObjectEntryId(),
				new FlightState(
					_string(values.get("flightNumber")),
					_string(values.get("showstatus")),
					_string(values.get("delayMinutes")),
					_string(values.get("r_gate_c_airportId"))));
		}

		if (!_flightStates.isEmpty()) {
			for (Map.Entry<Long, FlightState> entry : currentStates.entrySet()) {
				FlightState previous = _flightStates.get(entry.getKey());
				FlightState current = entry.getValue();

				if ((previous != null) && !previous.equals(current)) {
					_sendChangeAlerts(entry.getKey(), previous, current);
				}
			}
		}

		boolean changed = !_flightStates.equals(currentStates);

		_flightStates.clear();
		_flightStates.putAll(currentStates);

		changed = _followFlightsOfPasses(currentStates) || changed;

		if (changed) {
			_saveState();
		}
	}

	/** Passengers who checked in follow their flight automatically. */
	private boolean _followFlightsOfPasses(Map<Long, FlightState> states)
		throws Exception {

		ObjectDefinition definition =
			_objectDefinitionLocalService.fetchObjectDefinition(
				PortalUtil.getDefaultCompanyId(), "C_BoardingPass");

		if (definition == null) {
			return false;
		}

		boolean changed = false;

		for (ObjectEntry pass : _objectEntryLocalService.getObjectEntries(
				_SITE_ID, definition.getObjectDefinitionId(), 0, 1000)) {

			if (!_passesFollowed.add(pass.getObjectEntryId())) {
				continue;
			}

			changed = true;

			String flightNumber = _string(pass.getValues().get("flightNumber"));
			String passFlightId = _string(pass.getValues().get("flightId"));
			User user = UserLocalServiceUtil.fetchUser(pass.getUserId());

			if ((user == null) || user.isGuestUser()) {
				continue;
			}

			for (Map.Entry<Long, FlightState> entry : states.entrySet()) {
				if (!flightNumber.equals(entry.getValue().flightNumber)) {
					continue;
				}

				if (!passFlightId.isEmpty() && !"null".equals(passFlightId) &&
					!passFlightId.equals(String.valueOf(entry.getKey()))) {

					continue;
				}

				_ensureColumn(user.getCompanyId());

				Set<String> ids = new LinkedHashSet<>(
					Arrays.asList(_flightIds(user)));

				if (ids.add(String.valueOf(entry.getKey()))) {
					_saveFlightIds(user, ids.toArray(new String[0]));
				}
			}
		}

		ObjectDefinition bookings = _objectDefinitionLocalService.fetchObjectDefinition(
			PortalUtil.getDefaultCompanyId(), "C_Booking");

		for (ObjectEntry booking : (bookings == null) ? new ArrayList<ObjectEntry>() :
				_objectEntryLocalService.getObjectEntries(_SITE_ID, bookings.getObjectDefinitionId(), 0, 1000)) {

			String email = _string(booking.getValues().get("email")).trim();
			String flightId = _string(booking.getValues().get("flightId")).trim();

			if (email.isEmpty() || flightId.isEmpty() || !_passesFollowed.add(-booking.getObjectEntryId())) {
				continue;
			}

			changed = true;

			User user = UserLocalServiceUtil.fetchUserByEmailAddress(PortalUtil.getDefaultCompanyId(), email);

			if ((user != null) && !user.isGuestUser()) {
				_ensureColumn(user.getCompanyId());

				Set<String> ids = new LinkedHashSet<>(Arrays.asList(_flightIds(user)));

				if (ids.add(flightId)) {
					_saveFlightIds(user, ids.toArray(new String[0]));
				}
			}
		}

		return changed;
	}

	private static File _stateFile() {
		return new File(
			PropsUtil.get(PropsKeys.LIFERAY_HOME) + "/data",
			"flight-alert-state.json");
	}

	/** The last known flight states survive a restart, so changes made while the server was down are still reported. */
	private static synchronized void _loadState() {
		File file = _stateFile();

		if (!file.isFile()) {
			return;
		}

		try {
			JSONObject json = JSONFactoryUtil.createJSONObject(
				Files.readString(file.toPath(), StandardCharsets.UTF_8));

			JSONObject flights = json.getJSONObject("flights");

			if (flights != null) {
				for (String key : flights.keySet()) {
					JSONObject f = flights.getJSONObject(key);

					_flightStates.put(
						Long.parseLong(key),
						new FlightState(
							f.getString("n"), f.getString("s"), f.getString("d"),
							f.getString("g")));
				}
			}

			JSONArray passes = json.getJSONArray("passes");

			for (int i = 0; (passes != null) && (i < passes.length()); i++) {
				_passesFollowed.add(passes.getLong(i));
			}
		}
		catch (Exception exception) {
			_log.error("Could not read the saved flight alert state", exception);
		}
	}

	private static synchronized void _saveState() {
		try {
			JSONObject flights = JSONFactoryUtil.createJSONObject();

			for (Map.Entry<Long, FlightState> entry : _flightStates.entrySet()) {
				JSONObject f = JSONFactoryUtil.createJSONObject();

				f.put("n", entry.getValue().flightNumber);
				f.put("s", entry.getValue().status);
				f.put("d", entry.getValue().delay);
				f.put("g", entry.getValue().gate);

				flights.put(String.valueOf(entry.getKey()), f);
			}

			JSONArray passes = JSONFactoryUtil.createJSONArray();

			for (long id : _passesFollowed) {
				passes.put(id);
			}

			JSONObject json = JSONFactoryUtil.createJSONObject();

			json.put("flights", flights);
			json.put("passes", passes);

			File file = _stateFile();

			file.getParentFile().mkdirs();

			File temp = new File(file.getPath() + ".tmp");

			Files.writeString(temp.toPath(), json.toString(), StandardCharsets.UTF_8);
			Files.move(
				temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
		}
		catch (Exception exception) {
			_log.error("Could not save the flight alert state", exception);
		}
	}

	private ObjectDefinition _definition() throws Exception {
		return _objectDefinitionLocalService.getObjectDefinition(
			PortalUtil.getDefaultCompanyId(), "C_Flight");
	}

	private static String[] _flightIds(User user) throws Exception {
		return ExpandoValueLocalServiceUtil.getData(
			user.getCompanyId(), User.class.getName(),
			ExpandoTableConstants.DEFAULT_TABLE_NAME, _ALERTS_COLUMN,
			user.getUserId(), new String[0]);
	}

	private static String _pretty(String status) {
		return status.replaceAll("([a-z])([A-Z])", "$1 $2");
	}

	private static String _string(Object value) {
		return (value == null) ? "" : String.valueOf(value);
	}

	private void _ensureColumn(long companyId) throws Exception {
		synchronized (FlightAlertApplication.class) {
			ExpandoTable table =
				ExpandoTableLocalServiceUtil.fetchDefaultTable(
					companyId, User.class.getName());

			if (table == null) {
				table = ExpandoTableLocalServiceUtil.addDefaultTable(
					companyId, User.class.getName());
			}

			ExpandoColumn column = ExpandoColumnLocalServiceUtil.fetchColumn(
				table.getTableId(), _ALERTS_COLUMN);

			if (column == null) {
				ExpandoColumnLocalServiceUtil.addColumn(
					table.getTableId(), _ALERTS_COLUMN,
					ExpandoColumnConstants.STRING_ARRAY);
			}
		}
	}

	private void _saveFlightIds(User user, String[] ids) throws Exception {
		ExpandoValue value = ExpandoValueLocalServiceUtil.getValue(
			user.getCompanyId(), User.class.getName(),
			ExpandoTableConstants.DEFAULT_TABLE_NAME, _ALERTS_COLUMN,
			user.getUserId());

		if (value == null) {
			ExpandoValueLocalServiceUtil.addValue(
				user.getCompanyId(), User.class.getName(),
				ExpandoTableConstants.DEFAULT_TABLE_NAME, _ALERTS_COLUMN,
				user.getUserId(), ids);
		}
		else {
			value.setStringArray(ids);

			ExpandoValueLocalServiceUtil.updateExpandoValue(value);
		}
	}

	private void _sendChangeAlerts(
			long flightId, FlightState previous, FlightState current)
		throws Exception {

		Map<Long, Set<Long>> subscribers = _subscribers();
		Set<Long> userIds = subscribers.getOrDefault(
			flightId, Collections.emptySet());

		if (userIds.isEmpty()) {
			return;
		}

		List<String> changes = new ArrayList<>();

		if (!previous.status.equals(current.status)) {
			changes.add(
				"Status: " + _pretty(previous.status) + " -> " +
					_pretty(current.status));
		}

		if (!previous.delay.equals(current.delay)) {
			changes.add(
				"Delay: " + previous.delay + " -> " + current.delay +
					" minutes");
		}

		if (!previous.gate.equals(current.gate)) {
			changes.add(
				"Gate: " + _gate(previous.gate) + " -> " +
					_gate(current.gate));
		}

		if (changes.isEmpty()) {
			return;
		}

		for (long userId : userIds) {
			User user = UserLocalServiceUtil.fetchUser(userId);

			if ((user == null) || !user.isActive() ||
				user.getEmailAddress().isEmpty()) {

				continue;
			}

			_notify(user, flightId, current.flightNumber, String.join("; ", changes));

			try {
				_sendEmail(user, current, changes);
			}
			catch (Exception exception) {
				_log.error(
					"Could not send a flight alert for user " + userId +
						" and flight " + flightId,
					exception);
			}
		}
	}

	/**
	 * A mail setting: the value in bundles/data/alert-smtp.properties wins (works however Liferay was
	 * started, for example from an IDE), otherwise the environment variable of the same name.
	 */
	private static String _setting(String name) {
		try {
			File file = new File(PropsUtil.get(PropsKeys.LIFERAY_HOME) + "/data", "alert-smtp.properties");

			if (file.exists()) {
				Properties properties = new Properties();

				try (java.io.InputStream in = Files.newInputStream(file.toPath())) {
					properties.load(in);
				}

				String value = properties.getProperty(name);

				if ((value != null) && !value.isBlank()) {
					return value.trim();
				}
			}
		}
		catch (Exception exception) {
			_log.warn("Could not read alert-smtp.properties: " + exception.getMessage());
		}

		return System.getenv(name);
	}

	/** Sends through the SMTP server in the settings above, or through Twilio Email when that sender is configured. */
	private void _sendEmail(User user, FlightState flight, List<String> changes)
		throws Exception {

		String twilioFrom = System.getenv("TWILIO_EMAIL_FROM_ADDRESS");

		if ((twilioFrom != null) && !twilioFrom.isBlank()) {
			_sendTwilioEmail(user, flight, changes);

			return;
		}

		String fromAddress = _setting("FLIGHT_ALERT_FROM_ADDRESS");

		if ((fromAddress == null) || fromAddress.isBlank()) {
			fromAddress = PrefsPropsUtil.getString(
				user.getCompanyId(), PropsKeys.ADMIN_EMAIL_FROM_ADDRESS);
		}

		String smtpHost = _setting("FLIGHT_ALERT_SMTP_HOST");

		StringBuilder html = new StringBuilder(
			"<h2>Your followed flight has changed</h2><p><strong>Flight: ").
				append(HtmlUtil.escape(flight.flightNumber)).
				append("</strong></p><ul>");

		for (String change : changes) {
			html.append("<li>").append(HtmlUtil.escape(change)).append("</li>");
		}

		html.append("</ul><p>Flight Status Portal</p>");

		if ((smtpHost != null) && !smtpHost.isBlank()) {
			_sendSmtp(
				smtpHost, fromAddress, user, "Flight " + flight.flightNumber + " update",
				html.toString());

			_log.info(
				"Flight alert for " + flight.flightNumber + " sent to " +
					user.getEmailAddress());

			return;
		}

		throw new IllegalStateException(
			"Email NOT sent to " + user.getEmailAddress() +
				": SMTP is not configured (fill bundles/data/alert-smtp.properties)");
	}

	/**
	 * Sends straight through an SMTP server named in the environment:
	 * FLIGHT_ALERT_SMTP_HOST, FLIGHT_ALERT_SMTP_PORT (587), FLIGHT_ALERT_SMTP_USER,
	 * FLIGHT_ALERT_SMTP_PASSWORD and FLIGHT_ALERT_SMTP_STARTTLS (true/false).
	 */
	private void _sendSmtp(
			String host, String fromAddress, User user, String subject, String html)
		throws Exception {

		String port = _setting("FLIGHT_ALERT_SMTP_PORT");
		String smtpUser = _setting("FLIGHT_ALERT_SMTP_USER");
		String password = _setting("FLIGHT_ALERT_SMTP_PASSWORD");
		boolean auth = (smtpUser != null) && !smtpUser.isBlank();

		Properties properties = new Properties();

		properties.put("mail.smtp.host", host);
		properties.put("mail.smtp.port", ((port == null) || port.isBlank()) ? "587" : port);
		properties.put("mail.smtp.auth", String.valueOf(auth));
		properties.put(
			"mail.smtp.starttls.enable",
			String.valueOf(!"false".equalsIgnoreCase(_setting("FLIGHT_ALERT_SMTP_STARTTLS"))));
		properties.put("mail.smtp.connectiontimeout", "10000");
		properties.put("mail.smtp.timeout", "15000");

		Session session = Session.getInstance(properties);

		MimeMessage message = new MimeMessage(session);

		message.setFrom(new InternetAddress(fromAddress, "Flight Status Alerts"));
		message.setRecipient(
			Message.RecipientType.TO,
			new InternetAddress(user.getEmailAddress(), user.getFullName()));
		message.setSubject(subject, "UTF-8");
		message.setContent(html, "text/html; charset=UTF-8");

		try (Transport transport = session.getTransport("smtp")) {
			if (auth) {
				transport.connect(host, smtpUser, password);
			}
			else {
				transport.connect();
			}

			transport.sendMessage(message, message.getAllRecipients());
		}
	}

	private void _sendTwilioEmail(
			User user, FlightState flight, List<String> changes)
		throws Exception {

		String accountSid = System.getenv("TWILIO_ACCOUNT_SID");
		String authToken = System.getenv("TWILIO_AUTH_TOKEN");
		String fromAddress = System.getenv("TWILIO_EMAIL_FROM_ADDRESS");

		if ((accountSid == null) || accountSid.isBlank() ||
			(authToken == null) || authToken.isBlank() ||
			(fromAddress == null) || fromAddress.isBlank()) {

			throw new IllegalStateException(
				"Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and " +
					"TWILIO_EMAIL_FROM_ADDRESS to send flight alerts");
		}

		String fromName = System.getenv("TWILIO_EMAIL_FROM_NAME");

		if ((fromName == null) || fromName.isBlank()) {
			fromName = "Flight Status Alerts";
		}

		String subject = "Flight " + flight.flightNumber + " update";
		StringBuilder html = new StringBuilder(
			"<h2>Your followed flight has changed</h2><p><strong>Flight: ").
				append(HtmlUtil.escape(flight.flightNumber)).
				append("</strong></p><ul>");

		for (String change : changes) {
			html.append("<li>").append(HtmlUtil.escape(change)).append("</li>");
		}

		html.append("</ul>");

		JSONObject from = JSONFactoryUtil.createJSONObject();

		from.put("address", fromAddress);
		from.put("name", fromName);

		JSONObject recipient = JSONFactoryUtil.createJSONObject();

		recipient.put("address", user.getEmailAddress());
		recipient.put("name", user.getFullName());

		JSONArray recipients = JSONFactoryUtil.createJSONArray();

		recipients.put(recipient);

		JSONObject content = JSONFactoryUtil.createJSONObject();

		content.put("subject", subject);
		content.put("html", html.toString());

		JSONObject payload = JSONFactoryUtil.createJSONObject();

		payload.put("from", from);
		payload.put("to", recipients);
		payload.put("content", content);

		String credentials = Base64.getEncoder().encodeToString(
			(accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8));

		HttpRequest request = HttpRequest.newBuilder(
				URI.create("https://comms.twilio.com/v1/Emails")).
			timeout(Duration.ofSeconds(20)).
			header("Authorization", "Basic " + credentials).
			header("Content-Type", "application/json").
			POST(
				HttpRequest.BodyPublishers.ofString(
					payload.toString(), StandardCharsets.UTF_8)).
			build();

		HttpResponse<Void> response = _HTTP_CLIENT.send(
			request, HttpResponse.BodyHandlers.discarding());

		if ((response.statusCode() < 200) || (response.statusCode() >= 300)) {
			throw new IllegalStateException(
				"Twilio Email API returned HTTP " + response.statusCode());
		}
	}

	private Map<Long, Set<Long>> _subscribers() throws Exception {
		Map<Long, Set<Long>> subscribers = new HashMap<>();
		long companyId = PortalUtil.getDefaultCompanyId();
		ExpandoTable table =
			ExpandoTableLocalServiceUtil.fetchDefaultTable(
				companyId, User.class.getName());

		if (table == null) {
			return subscribers;
		}

		ExpandoColumn column = ExpandoColumnLocalServiceUtil.fetchColumn(
			table.getTableId(), _ALERTS_COLUMN);

		if (column == null) {
			return subscribers;
		}

		for (ExpandoValue value :
				ExpandoValueLocalServiceUtil.getDefaultTableColumnValues(
					companyId, PortalUtil.getClassNameId(User.class),
					_ALERTS_COLUMN, QueryUtil.ALL_POS, QueryUtil.ALL_POS)) {

			String[] flightIds = value.getStringArray();

			if (flightIds == null) {
				continue;
			}

			for (String id : flightIds) {
				long flightId = Long.parseLong(id);

				subscribers.computeIfAbsent(
					flightId, ignored -> new HashSet<>()).add(
						value.getClassPK());
			}
		}

		return subscribers;
	}

	private String _gate(String gateId) {
		if (gateId.isEmpty()) {
			return "unassigned";
		}

		try {
			ObjectEntry gate = _objectEntryLocalService.fetchObjectEntry(
				Long.parseLong(gateId));

			if (gate == null) {
				return gateId;
			}

			Map<String, Serializable> values = gate.getValues();
			String gateNumber = _string(values.get("gateNumber"));
			String terminal = _string(values.get("terminal"));

			if (gateNumber.isEmpty()) {
				return gateId;
			}

			return terminal.isEmpty() ? gateNumber :
				gateNumber + " (Terminal " + terminal + ")";
		}
		catch (Exception exception) {
			_log.error("Could not resolve gate " + gateId, exception);

			return gateId;
		}
	}

	private User _user(HttpServletRequest request) {
		try {
			HttpSession session = request.getSession(false);

			if (session == null) {
				return null;
			}

			HttpSession portalSession = PortalSessionContext.get(
				session.getId());

			if (portalSession == null) {
				return null;
			}

			Object userId = portalSession.getAttribute("USER_ID");

			if (userId == null) {
				return null;
			}

			User user = UserLocalServiceUtil.fetchUser(
				Long.parseLong(String.valueOf(userId)));

			return ((user == null) || user.isGuestUser() ||
				!user.isActive()) ? null : user;
		}
		catch (Exception exception) {
			_log.error("Could not identify the signed-in user", exception);

			return null;
		}
	}

	private Response _error(int status, String message) {
		JSONObject json = JSONFactoryUtil.createJSONObject();

		json.put("error", message);

		return Response.status(status).entity(json.toString()).build();
	}

	private ScheduledExecutorService _scheduler;

	private static class FlightState {

		private FlightState(
			String flightNumber, String status, String delay, String gate) {

			this.flightNumber = flightNumber;
			this.status = status;
			this.delay = delay;
			this.gate = gate;
		}

		@Override
		public boolean equals(Object object) {
			if (this == object) {
				return true;
			}

			if (!(object instanceof FlightState)) {
				return false;
			}

			FlightState flightState = (FlightState)object;

			return flightNumber.equals(flightState.flightNumber) &&
				status.equals(flightState.status) &&
				delay.equals(flightState.delay) && gate.equals(flightState.gate);
		}

		@Override
		public int hashCode() {
			return java.util.Objects.hash(flightNumber, status, delay, gate);
		}

		private final String delay;

		private final String flightNumber;

		private final String gate;

		private final String status;
	}

	@Reference
	private ObjectDefinitionLocalService _objectDefinitionLocalService;

	@Reference
	private ObjectEntryLocalService _objectEntryLocalService;

}
