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
import com.liferay.portal.kernel.util.PortalUtil;

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

import java.io.Serializable;

import java.security.SecureRandom;

import java.text.SimpleDateFormat;

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
                    out.put(_pass(entry));
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
        @QueryParam("lastName") String lastName) {

        try {
            if (_user(request) == null) {
                return _error(401, "Please log in");
            }

            ObjectEntry booking = _findBooking(siteId, pnr, lastName);

            if (booking == null) {
                return _error(404, "Booking not found. Check the PNR and last name.");
            }

            String problem = _bookingProblem(booking);

            if (problem != null) {
                return _error(409, problem);
            }

            return Response.ok(_bookingJson(booking).toString()).build();
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
                ObjectEntry booking = _findBooking(siteId, input.getString("pnr"), input.getString("lastName"));

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

                return Response.ok(_pass(created).toString()).build();
            }
        }
        catch (Exception exception) {
            _log.error("Could not create the boarding pass", exception);

            return _error(500, "Could not create the boarding pass");
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

    private ObjectEntry _findBooking(long siteId, String pnr, String lastName) throws Exception {
        if ((pnr == null) || (lastName == null) || pnr.trim().isEmpty() || lastName.trim().isEmpty()) {
            return null;
        }

        for (ObjectEntry entry : _entries("C_Booking", siteId)) {
            Map<String, Serializable> b = entry.getValues();

            if (pnr.trim().equalsIgnoreCase(String.valueOf(b.get("pnr"))) &&
                lastName.trim().equalsIgnoreCase(String.valueOf(b.get("lastName")))) {

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

    private JSONObject _pass(ObjectEntry entry) {
        Map<String, Serializable> v = entry.getValues();

        JSONObject json = JSONFactoryUtil.createJSONObject();

        json.put("id", entry.getObjectEntryId());

        for (String key : new String[] {
                "pnr", "flightNumber", "passengerName", "seat", "origin", "originCity", "destination",
                "destinationCity", "gate", "passengerEmail", "travelClass"
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
