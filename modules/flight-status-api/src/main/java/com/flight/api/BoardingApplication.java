package com.flight.api;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;
import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.security.auth.PrincipalException;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.security.auth.AuthTokenUtil;
import com.liferay.portal.kernel.service.ServiceContext;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.servlet.PortalSessionContext;
import com.liferay.portal.kernel.util.HtmlUtil;
import com.liferay.portal.kernel.util.PortalUtil;
import com.liferay.portal.kernel.util.PropsKeys;
import com.liferay.portal.kernel.util.PropsUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
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


import java.security.MessageDigest;
import java.security.SecureRandom;

import java.text.SimpleDateFormat;

import java.util.ArrayList;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

/**
 * Seat reservations and boarding passes for registered users. Liferay's own
 * Objects API hides site objects from normal users, so this application
 * checks the signed-in user itself and reads and writes the objects for them.
 */
@Component(
    property = {
        JaxrsWhiteboardConstants.JAX_RS_APPLICATION_BASE + "=/flight-boarding",
        JaxrsWhiteboardConstants.JAX_RS_NAME + "=flight.Boarding",
        "liferay.access.control.disable=true"
    },
    service = Application.class
)
public class BoardingApplication extends Application {

    private static final Log _log = LogFactoryUtil.getLog(BoardingApplication.class);

    private static final Object _LOCK = new Object();

    private static final String _PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static final SecureRandom _RANDOM = new SecureRandom();

    @Reference
    private ObjectDefinitionLocalService _objectDefinitionLocalService;

    @Reference
    private ObjectEntryLocalService _objectEntryLocalService;

    @Override
    public Set<Object> getSingletons() {
        return Collections.singleton(this);
    }

    /** Seats already taken on one flight (no names). */
    @GET
    @Path("/seats")
    @Produces(MediaType.APPLICATION_JSON)
    public Response seats(
        @Context HttpServletRequest request, @QueryParam("siteId") long siteId,
        @QueryParam("flight") String flight) {

        try {
            if (_user(request) == null) {
                return _error(401, "Please log in");
            }

            return Response.ok(_takenSeats(siteId, flight).toString()).build();
        }
        catch (Exception exception) {
            return _error(500, "Could not load seats");
        }
    }

    /** The signed-in user's own assistance requests (wheelchair, help with luggage and so on). */
    @GET
    @Path("/assist")
    @Produces(MediaType.APPLICATION_JSON)
    public Response assistList(@Context HttpServletRequest request, @QueryParam("siteId") long siteId) {
        try {
            User user = _user(request);

            if (user == null) {
                return _error(401, "Please log in");
            }

            JSONArray out = JSONFactoryUtil.createJSONArray();

            for (ObjectEntry entry : _entries("C_AssistanceRequest", siteId)) {
                if (entry.getUserId() == user.getUserId()) {
                    JSONObject json = JSONFactoryUtil.createJSONObject();

                    json.put("id", entry.getObjectEntryId());

                    for (String key : new String[] {"pnr", "assistanceType", "note", "requestStatus"}) {
                        json.put(key, String.valueOf(entry.getValues().get(key)));
                    }

                    out.put(json);
                }
            }

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            return _error(500, "Could not load your assistance requests");
        }
    }

    /** Asks the airport for help on a boarding pass the signed-in user owns. Body: siteId, pnr, type, note. */
    @Consumes(MediaType.APPLICATION_JSON)
    @POST
    @Path("/assist")
    @Produces(MediaType.APPLICATION_JSON)
    public Response assistCreate(@Context HttpServletRequest request, String body) {
        try {
            User user = _user(request);

            if (user == null) {
                return _error(401, "Please log in");
            }

            try {
                AuthTokenUtil.checkCSRFToken(request, BoardingApplication.class.getName());
            }
            catch (PrincipalException principalException) {
                return _error(403, "Please refresh the page and try again");
            }

            JSONObject input = JSONFactoryUtil.createJSONObject(body);

            long siteId = input.getLong("siteId");
            String pnr = input.getString("pnr").trim();
            String type = input.getString("type").trim();
            String note = input.getString("note").trim();

            if ((type.length() < 2) || (type.length() > 60) || (note.length() > 200)) {
                return _error(400, "Choose the kind of help. The note can be 200 letters at most.");
            }

            ObjectEntry pass = null;

            for (ObjectEntry entry : _entries("C_BoardingPass", siteId)) {
                if ((entry.getUserId() == user.getUserId()) && pnr.equalsIgnoreCase(String.valueOf(entry.getValues().get("pnr")))) {
                    pass = entry;

                    break;
                }
            }

            if (pass == null) {
                return _error(404, "You have no boarding pass with this booking code.");
            }

            for (ObjectEntry entry : _entries("C_AssistanceRequest", siteId)) {
                Map<String, Serializable> v = entry.getValues();

                if (pnr.equalsIgnoreCase(String.valueOf(v.get("pnr"))) && type.equalsIgnoreCase(String.valueOf(v.get("assistanceType"))) &&
                    "Open".equals(String.valueOf(v.get("requestStatus")))) {

                    return _error(409, "You already asked for this help. The airport team will contact you.");
                }
            }

            Map<String, Serializable> values = new HashMap<>();

            values.put("pnr", pnr.toUpperCase());
            values.put("passengerName", String.valueOf(pass.getValues().get("passengerName")));
            values.put("flightNumber", String.valueOf(pass.getValues().get("flightNumber")));
            values.put("assistanceType", type);
            values.put("note", note);
            values.put("requestStatus", "Open");

            _add("C_AssistanceRequest", siteId, user, values);

            return Response.ok("{\"ok\":true}").build();
        }
        catch (Exception exception) {
            _log.error("Could not save the assistance request", exception);

            return _error(500, "Could not send your request");
        }
    }

    /** The signed-in user's own boarding passes. */
    @GET
    @Path("/passes")
    @Produces(MediaType.APPLICATION_JSON)
    public Response passes(@Context HttpServletRequest request, @QueryParam("siteId") long siteId) {
        try {
            User user = _user(request);

            if (user == null) {
                return _error(401, "Please log in");
            }

            JSONArray out = JSONFactoryUtil.createJSONArray();

            for (ObjectEntry entry : _entries("C_BoardingPass", siteId)) {
                if (entry.getUserId() == user.getUserId()) {
                    out.put(_pass(entry, _baseUrl(request)));
                }
            }

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            return _error(500, "Could not load boarding passes");
        }
    }

    /** Looks up a booking by PNR and last name so the user can see it before choosing a seat. */
    @GET
    @Path("/booking")
    @Produces(MediaType.APPLICATION_JSON)
    public Response booking(
        @Context HttpServletRequest request, @QueryParam("siteId") long siteId, @QueryParam("pnr") String pnr,
        @QueryParam("lastName") String lastName, @QueryParam("firstName") String firstName) {

        try {
            if (_user(request) == null) {
                return _error(401, "Please log in");
            }

            ObjectEntry booking = _findBooking(siteId, pnr, lastName, firstName);

            if (booking == null) {
                return _error(404, "Booking not found. Check the PNR and last name.");
            }

            String problem = _bookingProblem(booking);

            if (problem != null) {
                return _error(409, problem);
            }

            JSONObject json = _bookingJson(booking);
            JSONArray passengers = JSONFactoryUtil.createJSONArray();

            // Everyone on the same booking code, so the page can offer the next passenger.
            for (ObjectEntry member : _party(siteId, pnr)) {
                Map<String, Serializable> m = member.getValues();
                JSONObject p = JSONFactoryUtil.createJSONObject();

                p.put("firstName", String.valueOf(m.get("firstName")));
                p.put("lastName", String.valueOf(m.get("lastName")));
                p.put("done", _bookingProblem(member) != null);

                passengers.put(p);
            }

            json.put("passengers", passengers);

            return Response.ok(json.toString()).build();
        }
        catch (Exception exception) {
            return _error(500, "Could not look up the booking");
        }
    }

    /** Checks in a booking: reserves the seat and creates the boarding pass. */
    @Consumes(MediaType.APPLICATION_JSON)
    @POST
    @Path("/pass")
    @Produces(MediaType.APPLICATION_JSON)
    public Response createPass(@Context HttpServletRequest request, String body) {
        try {
            User user = _user(request);

            if (user == null) {
                return _error(401, "Please log in");
            }

            try {
                AuthTokenUtil.checkCSRFToken(request, BoardingApplication.class.getName());
            }
            catch (PrincipalException principalException) {
                return _error(403, "Please refresh the page and try again");
            }

            JSONObject input = JSONFactoryUtil.createJSONObject(body);

            long siteId = input.getLong("siteId");
            String seat = input.getString("seat").trim().toUpperCase();

            if (!seat.matches("(?:[1-9]|1[0-9]|20)[A-F]")) {
                return _error(400, "Choose a valid seat");
            }

            synchronized (_LOCK) {
                ObjectEntry booking = _findBooking(siteId, input.getString("pnr"), input.getString("lastName"), input.getString("firstName"));

                if (booking == null) {
                    return _error(404, "Booking not found. Check the PNR and last name.");
                }

                String problem = _bookingProblem(booking);

                if (problem != null) {
                    return _error(409, problem);
                }

                Map<String, Serializable> b = booking.getValues();

                String travelClass = _travelClass(b);

                if (!_seatInClass(seat, travelClass)) {
                    return _error(400, "That seat is not in your " + travelClass + " class");
                }

                String bag = _bag(input.getString("bag"));
                String meal = input.getString("meal").trim();

                if (!_addOnsOk(bag, meal)) {
                    return _error(400, "Choose a valid baggage and meal option");
                }

                int total = _seatFee(seat) + _bagFee(bag) + _mealFee(meal);

                if ((total > 0) && !_paid(input, String.valueOf(b.get("pnr")), seat, total, bag, meal)) {
                    return _error(402, "Payment was not completed");
                }

                String flightNumber = String.valueOf(b.get("flightNumber"));
                String flightKey = _flightKey(b);

                ObjectEntry flight = _findFlight(siteId, flightNumber, _flightId(b));

                if (flight == null) {
                    return _error(404, "Flight not found");
                }

                Map<String, Serializable> f = flight.getValues();

                if ("Landed".equals(String.valueOf(f.get("showstatus")))) {
                    return _error(409, "This flight has already landed");
                }

                if (_takenSeats(siteId, flightKey).toString().contains("\"" + seat + "\"")) {
                    return _error(409, "Seat just taken, choose another");
                }

                Map<String, Serializable> airports = new HashMap<>();

                for (ObjectEntry airport : _entries("C_Airport", 0)) {
                    airports.put(String.valueOf(airport.getObjectEntryId()), (Serializable)airport.getValues());
                }

                Map<String, Serializable> origin = _airport(airports, f.get("r_originAirport_c_airportId"));
                Map<String, Serializable> destination = _airport(airports, f.get("r_destinationAirport_c_airportId"));

                Map<String, Serializable> reservation = new HashMap<>();

                reservation.put("flightNumber", flightKey);
                reservation.put("seat", seat);

                _add("C_SeatReservation", siteId, user, reservation);

                Map<String, Serializable> pass = new HashMap<>();

                pass.put("pnr", String.valueOf(b.get("pnr")));
                pass.put("flightNumber", flightNumber);
                pass.put("flightId", String.valueOf(flight.getObjectEntryId()));
                pass.put("passengerName", b.get("firstName") + " " + b.get("lastName"));
                pass.put("seat", seat);
                pass.put("travelClass", travelClass);
                pass.put("baggageKg", "0".equals(bag) ? "" : bag);
                pass.put("meal", meal);
                pass.put("origin", String.valueOf(origin.get("code")));
                pass.put("originCity", String.valueOf(origin.get("city")));
                pass.put("destination", String.valueOf(destination.get("code")));
                pass.put("destinationCity", String.valueOf(destination.get("city")));
                pass.put("gate", _gate(siteId, flightNumber));
                pass.put("departureTime", (Date)f.get("departureTime"));
                pass.put("passengerEmail", user.getEmailAddress());

                ObjectEntry created = _add("C_BoardingPass", siteId, user, pass);

                Map<String, Serializable> checkedIn = new HashMap<>(b);

                checkedIn.put("bookingStatus", "CheckedIn");

                ServiceContext serviceContext = new ServiceContext();

                serviceContext.setCompanyId(user.getCompanyId());
                serviceContext.setScopeGroupId(siteId);
                serviceContext.setUserId(user.getUserId());

                _objectEntryLocalService.updateObjectEntry(
                    user.getUserId(), booking.getObjectEntryId(), booking.getObjectEntryFolderId(), checkedIn,
                    serviceContext);

                return Response.ok(_pass(created, _baseUrl(request)).toString()).build();
            }
        }
        catch (Exception exception) {
            _log.error("Could not create the boarding pass", exception);

            return _error(500, "Could not create the boarding pass");
        }
    }

    /** Creates a Stripe Checkout session for a paid seat. The price is worked out here, never taken from the browser. */
    @Consumes(MediaType.APPLICATION_JSON)
    @POST
    @Path("/payment/order")
    @Produces(MediaType.APPLICATION_JSON)
    public Response paymentOrder(@Context HttpServletRequest request, String body) {
        try {
            if (_user(request) == null) {
                return _error(401, "Please log in");
            }

            try {
                AuthTokenUtil.checkCSRFToken(request, BoardingApplication.class.getName());
            }
            catch (PrincipalException principalException) {
                return _error(403, "Please refresh the page and try again");
            }

            JSONObject input = JSONFactoryUtil.createJSONObject(body);

            long siteId = input.getLong("siteId");
            String seat = input.getString("seat").trim().toUpperCase();
            String returnUrl = input.getString("returnUrl");

            ObjectEntry booking = _findBooking(siteId, input.getString("pnr"), input.getString("lastName"), input.getString("firstName"));

            if ((booking == null) || (_bookingProblem(booking) != null) ||
                !seat.matches("(?:[1-9]|1[0-9]|20)[A-F]") || !_seatInClass(seat, _travelClass(booking.getValues())) ||
                _takenSeats(siteId, _flightKey(booking.getValues())).toString().contains("\"" + seat + "\"")) {

                return _error(409, "This seat cannot be booked");
            }

            String bag = _bag(input.getString("bag"));
            String meal = input.getString("meal").trim();

            if (!_addOnsOk(bag, meal)) {
                return _error(400, "Choose a valid baggage and meal option");
            }

            int fee = _seatFee(seat);

            if ((fee + _bagFee(bag) + _mealFee(meal)) == 0) {
                return _error(400, "Nothing to pay for");
            }

            String pnr = String.valueOf(booking.getValues().get("pnr"));

            String back = returnUrl + "?pnr=" + _enc(pnr) + "&last=" + _enc(input.getString("lastName"));

            StringBuilder items = new StringBuilder();
            int index = 0;

            if (fee > 0) {
                items.append(_item(index++, "Seat " + seat, fee));
            }

            if (_bagFee(bag) > 0) {
                items.append(_item(index++, "Extra baggage +" + bag + " kg", _bagFee(bag)));
            }

            if (_mealFee(meal) > 0) {
                items.append(_item(index++, "Meal: " + meal, _mealFee(meal)));
            }

            JSONObject session = _stripe(
                "POST", "/checkout/sessions",
                "mode=payment&success_url=" + _enc(back + "&seat=" + seat + "&bag=" + bag + "&meal=" + meal + "&session_id={CHECKOUT_SESSION_ID}") +
                    "&cancel_url=" + _enc(back) + items + "&metadata[pnr]=" + _enc(pnr) + "&metadata[seat]=" + seat +
                        "&metadata[bag]=" + bag + "&metadata[meal]=" + _enc(meal));

            if (!session.has("url")) {
                return _error(502, "Could not start the payment");
            }

            JSONObject out = JSONFactoryUtil.createJSONObject();

            out.put("url", session.getString("url"));

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            _log.error("Could not create the payment session", exception);

            return _error(500, "Could not start the payment");
        }
    }

    /** Extra fee in rupees: first row of a class is extra legroom, A/F window, C/D aisle, B/E middle is free. */
    private static int _seatFee(String seat) {
        int row = Integer.parseInt(seat.substring(0, seat.length() - 1));
        char letter = seat.charAt(seat.length() - 1);

        if ((row == 1) || (row == 3) || (row == 7)) {
            return 500;
        }

        if ((letter == 'A') || (letter == 'F')) {
            return 300;
        }

        return ((letter == 'C') || (letter == 'D')) ? 200 : 0;
    }

    /** True when Stripe says this session is paid, for this PNR, seat, baggage and meal, with the right amount. */
    private boolean _paid(JSONObject input, String pnr, String seat, int total, String bag, String meal) throws Exception {
        String sessionId = input.getString("sessionId");

        if (!sessionId.matches("cs_[A-Za-z0-9_]+")) {
            return false;
        }

        JSONObject session = _stripe("GET", "/checkout/sessions/" + sessionId, null);
        JSONObject metadata = session.getJSONObject("metadata");

        if (!"paid".equals(session.getString("payment_status")) || (session.getInt("amount_total") != (total * 100)) ||
            (metadata == null) || !pnr.equals(metadata.getString("pnr")) || !seat.equals(metadata.getString("seat")) ||
            !bag.equals(metadata.getString("bag")) || !meal.equals(metadata.getString("meal"))) {

            return false;
        }

        _log.info("Payment " + sessionId + " for " + pnr + " seat " + seat + ", bag " + bag + ", meal '" + meal + "': Rs " + total);

        return true;
    }

    /** Extra baggage in kg ("0" when none) and its price in rupees. */
    private static String _bag(String kg) {
        kg = kg.trim();

        return kg.isEmpty() ? "0" : kg;
    }

    private static int _bagFee(String kg) {
        return "10".equals(kg) ? 800 : "20".equals(kg) ? 1500 : "30".equals(kg) ? 2000 : 0;
    }

    private static int _mealFee(String meal) {
        return "veg".equals(meal) ? 250 : "nonveg".equals(meal) ? 300 : "snack".equals(meal) ? 150 : 0;
    }

    private static boolean _addOnsOk(String bag, String meal) {
        return bag.matches("0|10|20|30") && meal.matches("|veg|nonveg|snack");
    }

    private static String _item(int index, String name, int rupees) throws Exception {
        return "&line_items[" + index + "][quantity]=1&line_items[" + index + "][price_data][currency]=inr&line_items[" + index +
            "][price_data][unit_amount]=" + (rupees * 100) + "&line_items[" + index + "][price_data][product_data][name]=" + _enc(name);
    }

    private static String _enc(String value) throws Exception {
        return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
    }

    private JSONObject _stripe(String method, String path, String body) throws Exception {
        String key = System.getenv("STRIPE_SECRET_KEY");

        if (key == null) {
            // Not started through setenv.sh (for example from an IDE): read the key from the data folder instead
            java.nio.file.Path file = Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "stripe-key.txt");

            if (Files.exists(file)) {
                key = Files.readString(file).trim();
            }
        }

        if (key == null) {
            throw new IllegalStateException("Stripe key is not set");
        }

        HttpURLConnection connection = (HttpURLConnection)new URL("https://api.stripe.com/v1" + path).openConnection();

        connection.setRequestMethod(method);
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(15_000);
        connection.setRequestProperty(
            "Authorization", "Basic " + Base64.getEncoder().encodeToString((key + ":").getBytes(StandardCharsets.UTF_8)));

        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
        }

        try (InputStream in = (connection.getResponseCode() >= 400) ? connection.getErrorStream() : connection.getInputStream()) {
            return JSONFactoryUtil.createJSONObject(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
        finally {
            connection.disconnect();
        }
    }

    private JSONObject _bookingJson(ObjectEntry booking) throws Exception {
        Map<String, Serializable> b = booking.getValues();

        JSONObject json = JSONFactoryUtil.createJSONObject();

        json.put("pnr", String.valueOf(b.get("pnr")));
        json.put("flightNumber", String.valueOf(b.get("flightNumber")));
        json.put("flightKey", _flightKey(b));
        json.put("flightId", _flightId(b));
        json.put("passengerName", b.get("firstName") + " " + b.get("lastName"));
        json.put("firstName", String.valueOf(b.get("firstName")));
        json.put("travelClass", _travelClass(b));

        return json;
    }

    /** First, Business or Economy (older bookings without a class are Economy). */
    private String _travelClass(Map<String, Serializable> values) {
        String value = String.valueOf(values.get("travelClass"));

        return ("First".equals(value) || "Business".equals(value)) ? value : "Economy";
    }

    /** First class is rows 1-2, Business rows 3-6 and Economy rows 7-20. */
    private boolean _seatInClass(String seat, String travelClass) {
        int row = Integer.parseInt(seat.substring(0, seat.length() - 1));

        if ("First".equals(travelClass)) {
            return row <= 2;
        }

        if ("Business".equals(travelClass)) {
            return (row >= 3) && (row <= 6);
        }

        return row >= 7;
    }

    /** Null when the booking can be checked in, otherwise the message to show. */
    private String _bookingProblem(ObjectEntry booking) {
        String status = String.valueOf(booking.getValues().get("bookingStatus"));

        if ("CheckedIn".equals(status)) {
            return "Already checked in";
        }

        if ("Cancelled".equals(status)) {
            return "This booking was cancelled";
        }

        return null;
    }

    /** Everyone booked under one booking code (one booking code can hold several passengers). */
    private List<ObjectEntry> _party(long siteId, String pnr) throws Exception {
        List<ObjectEntry> party = new ArrayList<>();

        if ((pnr == null) || pnr.trim().isEmpty()) {
            return party;
        }

        for (ObjectEntry entry : _entries("C_Booking", siteId)) {
            if (pnr.trim().equalsIgnoreCase(String.valueOf(entry.getValues().get("pnr")))) {
                party.add(entry);
            }
        }

        return party;
    }

    /**
     * The booking of one passenger. The booking code plus the last name of anyone on it proves who is asking. Without a first name the
     * first passenger with that last name who is not checked in yet is returned; with a first name that passenger is returned.
     */
    private ObjectEntry _findBooking(long siteId, String pnr, String lastName, String firstName) throws Exception {
        if ((lastName == null) || lastName.trim().isEmpty()) {
            return null;
        }

        List<ObjectEntry> party = _party(siteId, pnr);
        ObjectEntry first = null;

        for (ObjectEntry entry : party) {
            Map<String, Serializable> b = entry.getValues();

            if (lastName.trim().equalsIgnoreCase(String.valueOf(b.get("lastName")))) {
                if (first == null) {
                    first = entry;
                }

                if (((firstName == null) || firstName.trim().isEmpty()) && (_bookingProblem(entry) == null)) {
                    return entry;
                }
            }
        }

        if (first == null) {
            return null;
        }

        if ((firstName == null) || firstName.trim().isEmpty()) {
            return first;
        }

        for (ObjectEntry entry : party) {
            if (firstName.trim().equalsIgnoreCase(String.valueOf(entry.getValues().get("firstName")))) {
                return entry;
            }
        }

        return null;
    }

    private ObjectEntry _add(String objectName, long siteId, User user, Map<String, Serializable> values)
        throws Exception {

        ObjectDefinition definition = _definition(objectName);

        ServiceContext serviceContext = new ServiceContext();

        serviceContext.setCompanyId(user.getCompanyId());
        serviceContext.setScopeGroupId(siteId);
        serviceContext.setUserId(user.getUserId());

        return _objectEntryLocalService.addObjectEntry(
            siteId, user.getUserId(), definition.getObjectDefinitionId(), 0L, null, values, serviceContext);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Serializable> _airport(Map<String, Serializable> airports, Object id) {
        Object airport = airports.get(String.valueOf(id));

        return (airport == null) ? new HashMap<>() : (Map<String, Serializable>)airport;
    }

    private ObjectDefinition _definition(String objectName) throws Exception {
        return _objectDefinitionLocalService.getObjectDefinition(PortalUtil.getDefaultCompanyId(), objectName);
    }

    private List<ObjectEntry> _entries(String objectName, long siteId) throws Exception {
        return _objectEntryLocalService.getObjectEntries(
            siteId, _definition(objectName).getObjectDefinitionId(), 0, 1000);
    }

    private Response _error(int status, String message) {
        JSONObject json = JSONFactoryUtil.createJSONObject();

        json.put("error", message);

        return Response.status(status).entity(json.toString()).build();
    }

    /** The flight a booking is for: the exact flight when the booking names one, otherwise the first with that number. */
    private ObjectEntry _findFlight(long siteId, String flightNumber, String flightId) throws Exception {
        for (ObjectEntry entry : _entries("C_Flight", siteId)) {
            if (!flightNumber.equals(String.valueOf(entry.getValues().get("flightNumber")))) {
                continue;
            }

            if (flightId.isEmpty() || flightId.equals(String.valueOf(entry.getObjectEntryId()))) {
                return entry;
            }
        }

        return null;
    }

    private String _flightId(Map<String, Serializable> booking) {
        Object id = booking.get("flightId");

        return ((id == null) || "null".equals(String.valueOf(id))) ? "" : String.valueOf(id).trim();
    }

    /** Seats are kept per flight: number plus id for dated flights, the number alone for older bookings. */
    private String _flightKey(Map<String, Serializable> booking) {
        String id = _flightId(booking);

        return String.valueOf(booking.get("flightNumber")) + (id.isEmpty() ? "" : "#" + id);
    }

    /** Gates are shared out between flights so every pass shows one. */
    private String _gate(long siteId, String flightNumber) throws Exception {
        List<ObjectEntry> gates = _entries("C_Gate", siteId);

        if (gates.isEmpty()) {
            return "TBA";
        }

        int sum = 0;

        for (char c : flightNumber.toCharArray()) {
            sum += c;
        }

        return String.valueOf(gates.get(sum % gates.size()).getValues().get("gateNumber"));
    }

    private String _newPnr() {
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < 6; i++) {
            sb.append(_PNR_CHARS.charAt(_RANDOM.nextInt(_PNR_CHARS.length())));
        }

        return sb.toString();
    }

    /**
     * What a phone shows when someone scans the QR code of a boarding pass: a small read-only page that
     * says whether the pass is real and shows the flight, seat and gate. The link carries a signed token,
     * so it cannot be guessed or edited. No email, phone number or booking code is shown.
     */
    @GET
    @Path("/check")
    @Produces("text/html; charset=UTF-8")
    public Response check(@QueryParam("t") String token) {
        try {
            long id = _passIdFromToken((token == null) ? "" : token);

            ObjectEntry entry = (id == 0) ? null : _objectEntryLocalService.fetchObjectEntry(id);

            if ((entry == null) || (entry.getObjectDefinitionId() != _definition("C_BoardingPass").getObjectDefinitionId())) {
                return Response.status(404).header("Cache-Control", "no-store").entity(
                    PassPage.message(
                        "invalid", "Not a valid boarding pass", "This code is not a real boarding pass, or it was changed after it was made.",
                        new String[] {
                            "Ask the passenger to open their boarding pass in the Flight Status Portal.", "Scan the new QR code again.",
                            "If it still fails, send the passenger to the airline desk."
                        })).build();
            }

            Map<String, Serializable> v = entry.getValues();

            ObjectEntry flight = _findFlight(entry.getGroupId(), String.valueOf(v.get("flightNumber")), String.valueOf(v.get("flightId")));
            Map<String, Serializable> f = (flight == null) ? new HashMap<>() : flight.getValues();

            String flightStatus = _clean(f.get("showstatus"));
            int delay = 0;

            try {
                delay = Integer.parseInt(_clean(f.get("delayMinutes")));
            }
            catch (NumberFormatException numberFormatException) {
            }

            String[] names = String.valueOf(v.get("passengerName")).trim().split("\\s+");
            String shortName = (names.length > 1) ? names[0] + " " + names[names.length - 1].charAt(0) + "." : names[0];

            // The flight's own time when we have it (it moves with a delay), else the time saved on the pass.
            Object time = (f.get("departureTime") instanceof Date) ? f.get("departureTime") : v.get("departureTime");
            long departs = (time instanceof Date) ? ((Date)time).getTime() : 0;

            Map<String, String> d = new HashMap<>();

            d.put("name", shortName);
            d.put("pnr", _clean(v.get("pnr")));
            d.put("flightNumber", _clean(v.get("flightNumber")));
            d.put("airline", _clean(f.get("airline")));
            d.put("origin", _clean(v.get("origin")));
            d.put("originCity", _clean(v.get("originCity")));
            d.put("destination", _clean(v.get("destination")));
            d.put("destinationCity", _clean(v.get("destinationCity")));
            d.put("departIso", _iso(departs));
            d.put("boardingIso", _iso(departs - (45 * 60_000L)));
            d.put("gate", _clean(v.get("gate")));
            d.put("seat", _clean(v.get("seat")));
            d.put("terminal", _clean(f.get("depTerminal")));
            d.put("boardedIso", _clean(v.get("boardedAt")));

            String travelClass = _clean(v.get("travelClass"));

            d.put("travelClass", travelClass.isEmpty() ? "Economy" : travelClass);

            String baggage = _clean(v.get("baggageKg"));
            String meal = _clean(v.get("meal"));

            d.put("baggage", "0".equals(baggage) ? "" : baggage);
            d.put("meal", meal.isEmpty() ? "" : "veg".equals(meal) ? "Vegetarian meal" : "nonveg".equals(meal) ? "Non-vegetarian meal" : "Snack box");

            // What the flight is doing, in words and colour.
            String statusText = "Not available", statusClass = "";

            if ("Cancelled".equals(flightStatus)) {
                statusText = "Cancelled";
                statusClass = "cancelled";
            }
            else if ("Delayed".equals(flightStatus) || (delay > 0)) {
                statusText = (delay > 0) ? "Delayed +" + delay + " min" : "Delayed";
                statusClass = "delayed";
            }
            else if ("OnTime".equals(flightStatus)) {
                statusText = "On time";
                statusClass = "ontime";
            }
            else if ("Boarding".equals(flightStatus)) {
                statusText = "Boarding";
            }
            else if ("Departed".equals(flightStatus) || "Landed".equals(flightStatus)) {
                statusText = flightStatus;
                statusClass = "done";
            }

            d.put("statusText", statusText);
            d.put("statusClass", statusClass);

            boolean left = "Departed".equals(flightStatus) || "Landed".equals(flightStatus) || ((departs > 0) && (departs < (System.currentTimeMillis() - (3 * 3_600_000L))));

            d.put("state", "Cancelled".equals(flightStatus) ? "cancelled" : !d.get("boardedIso").isEmpty() ? "boarded" : left ? "departed" : "valid");

            return Response.ok(PassPage.pass(d)).header("Cache-Control", "no-store").build();
        }
        catch (Exception exception) {
            _log.error("Could not check the boarding pass", exception);

            return Response.status(500).header("Cache-Control", "no-store").entity(
                PassPage.message(
                    "problem", "We could not check this pass", "Something went wrong on our side. This does not mean the pass is fake.",
                    new String[] {"Wait a moment and scan the QR code again.", "If it still fails, check the pass at the airline desk."})).build();
        }
    }

    private static String _clean(Object value) {
        return (value == null) ? "" : String.valueOf(value).replace("null", "").trim();
    }

    private static String _iso(long millis) {
        if (millis <= 0) {
            return "";
        }

        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

        format.setTimeZone(TimeZone.getTimeZone("UTC"));

        return format.format(new Date(millis));
    }


    /** Gate staff (administrators only): the full details of a scanned boarding pass. */
    @GET
    @Path("/gate/lookup")
    @Produces(MediaType.APPLICATION_JSON)
    public Response gateLookup(@Context HttpServletRequest request, @QueryParam("code") String code) {
        try {
            if (_admin(request) == null) {
                return _error(403, "Only administrators can use the gate screen");
            }

            ObjectEntry entry = _scannedPass(code);

            if (entry == null) {
                return _error(404, "This is not a valid boarding pass");
            }

            JSONObject json = _pass(entry, _baseUrl(request));

            json.put("boardedAt", String.valueOf(entry.getValues().get("boardedAt")).replace("null", ""));

            return Response.ok(json.toString()).build();
        }
        catch (Exception exception) {
            _log.error("Gate lookup failed", exception);

            return _error(500, "Could not check the boarding pass");
        }
    }

    /** Gate staff (administrators only): marks the scanned boarding pass as boarded. */
    @Consumes(MediaType.APPLICATION_JSON)
    @POST
    @Path("/gate/board")
    @Produces(MediaType.APPLICATION_JSON)
    public Response gateBoard(@Context HttpServletRequest request, String body) {
        try {
            User admin = _admin(request);

            if (admin == null) {
                return _error(403, "Only administrators can use the gate screen");
            }

            try {
                AuthTokenUtil.checkCSRFToken(request, BoardingApplication.class.getName());
            }
            catch (PrincipalException principalException) {
                return _error(403, "Please refresh the page and try again");
            }

            ObjectEntry entry = _scannedPass(JSONFactoryUtil.createJSONObject(body).getString("code"));

            if (entry == null) {
                return _error(404, "This is not a valid boarding pass");
            }

            Map<String, Serializable> values = new HashMap<>(entry.getValues());

            String already = String.valueOf(values.get("boardedAt")).replace("null", "");

            if (!already.isEmpty()) {
                return _error(409, "Already boarded at " + already);
            }

            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

            format.setTimeZone(TimeZone.getTimeZone("UTC"));

            values.put("boardedAt", format.format(new Date()));

            ServiceContext serviceContext = new ServiceContext();

            serviceContext.setCompanyId(admin.getCompanyId());
            serviceContext.setScopeGroupId(entry.getGroupId());
            serviceContext.setUserId(admin.getUserId());

            _objectEntryLocalService.updateObjectEntry(
                admin.getUserId(), entry.getObjectEntryId(), entry.getObjectEntryFolderId(), values, serviceContext);

            JSONObject out = JSONFactoryUtil.createJSONObject();

            out.put("boardedAt", String.valueOf(values.get("boardedAt")));

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            _log.error("Could not mark the pass as boarded", exception);

            return _error(500, "Could not mark the pass as boarded");
        }
    }

    /** The boarding pass behind a scanned QR link (or just its token); null when the code is wrong. */
    private ObjectEntry _scannedPass(String code) throws Exception {
        String token = (code == null) ? "" : code.trim();

        int at = token.indexOf("t=");

        if (at >= 0) {
            token = token.substring(at + 2).split("[&#\\s]")[0];
        }

        long id = _passIdFromToken(token);

        ObjectEntry entry = (id == 0) ? null : _objectEntryLocalService.fetchObjectEntry(id);

        return ((entry != null) && (entry.getObjectDefinitionId() == _definition("C_BoardingPass").getObjectDefinitionId())) ? entry : null;
    }

    private User _admin(HttpServletRequest request) {
        try {
            User user = _user(request);

            return ((user != null) && UserLocalServiceUtil.hasRoleUser(user.getCompanyId(), "Administrator", user.getUserId(), true)) ? user : null;
        }
        catch (Exception exception) {
            return null;
        }
    }

    /** The address people reach the site at: bundles/data/public-url.txt if it exists, otherwise the address of this request. */
    private static String _baseUrl(HttpServletRequest request) {
        try {
            java.io.File file = new java.io.File(PropsUtil.get(PropsKeys.LIFERAY_HOME) + "/data", "public-url.txt");

            if (file.exists()) {
                String value = Files.readString(file.toPath()).trim();

                if (!value.isEmpty()) {
                    return value.replaceAll("/+$", "");
                }
            }
        }
        catch (Exception exception) {
            _log.warn("Could not read public-url.txt: " + exception.getMessage());
        }

        int port = request.getServerPort();

        return request.getScheme() + "://" + request.getServerName() + (((port == 80) || (port == 443)) ? "" : ":" + port);
    }

    private static String _passToken(long id) throws Exception {
        return id + "." + _sign("pass-qr|" + id);
    }

    private static long _passIdFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            long id = Long.parseLong(parts[0]);

            return MessageDigest.isEqual(_sign("pass-qr|" + id).getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8)) ? id : 0;
        }
        catch (Exception exception) {
            return 0;
        }
    }

    /** Signed with the same secret file as the login tickets (bundles/data/auth-secret.txt), but over a different text, so the two can never be mixed up. */
    private static String _sign(String text) throws Exception {
        java.nio.file.Path file = Paths.get(PropsUtil.get(PropsKeys.LIFERAY_HOME), "data", "auth-secret.txt");

        if (!Files.exists(file)) {
            throw new IllegalStateException("auth-secret.txt does not exist yet (it is made by the login module)");
        }

        Mac mac = Mac.getInstance("HmacSHA256");

        mac.init(new SecretKeySpec(Files.readString(file).trim().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));

        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(text.getBytes(StandardCharsets.UTF_8)));
    }

    private JSONObject _pass(ObjectEntry entry, String baseUrl) {
        Map<String, Serializable> v = entry.getValues();

        JSONObject json = JSONFactoryUtil.createJSONObject();

        json.put("id", entry.getObjectEntryId());

        for (String key : new String[] {
                "pnr", "flightNumber", "passengerName", "seat", "origin", "originCity", "destination",
                "destinationCity", "gate", "passengerEmail", "travelClass", "baggageKg", "meal"
            }) {

            json.put(key, String.valueOf(v.get(key)));
        }

        Object time = v.get("departureTime");

        if (time instanceof Date) {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

            format.setTimeZone(TimeZone.getTimeZone("UTC"));

            json.put("departureTime", format.format((Date)time));
        }

        json.put("created", entry.getCreateDate().getTime());

        try {
            json.put("checkUrl", baseUrl + "/o/flight-boarding/check?t=" + _passToken(entry.getObjectEntryId()));
        }
        catch (Exception exception) {
            _log.warn("Could not sign the boarding pass link: " + exception.getMessage());
        }

        return json;
    }

    private JSONArray _takenSeats(long siteId, String flight) throws Exception {
        JSONArray taken = JSONFactoryUtil.createJSONArray();

        for (ObjectEntry entry : _entries("C_SeatReservation", siteId)) {
            if (String.valueOf(entry.getValues().get("flightNumber")).equals(flight)) {
                taken.put(String.valueOf(entry.getValues().get("seat")));
            }
        }

        return taken;
    }

    /**
     * The signed-in user, read from the portal's own session (the session id
     * cookie is the proof of login). Null for guests.
     */
    private User _user(HttpServletRequest request) {
        try {
            HttpSession session = PortalSessionContext.get(request.getSession().getId());

            if (session == null) {
                return null;
            }

            Object userId = session.getAttribute("USER_ID");

            if (userId == null) {
                return null;
            }

            User user = UserLocalServiceUtil.fetchUser(Long.parseLong(String.valueOf(userId)));

            return ((user == null) || user.isGuestUser() || !user.isActive()) ? null : user;
        }
        catch (Exception exception) {
            return null;
        }
    }

}
