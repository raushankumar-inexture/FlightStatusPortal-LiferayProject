package com.flight.api;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;
import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.util.PortalUtil;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.Serializable;

import java.text.SimpleDateFormat;

import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

/**
 * Read-only public endpoint: live aircraft positions for the Live Map page.
 * Kept in its own application so opening it to every visitor does not open
 * the flight management endpoints.
 */
@Component(
    property = {
        JaxrsWhiteboardConstants.JAX_RS_APPLICATION_BASE + "=/flight-live",
        JaxrsWhiteboardConstants.JAX_RS_NAME + "=flight.Live",
        "liferay.access.control.disable=true"
    },
    service = Application.class
)
public class LiveApplication extends Application {

    @Reference
    private ObjectDefinitionLocalService _objectDefinitionLocalService;

    @Reference
    private ObjectEntryLocalService _objectEntryLocalService;

    @Override
    public Set<Object> getSingletons() {
        return Collections.singleton(this);
    }

    @GET
    @Path("/aircraft")
    @Produces(MediaType.APPLICATION_JSON)
    public Response aircraft() {
        return Response.ok(LiveTracker.getAircraft().toString()).build();
    }

    @GET
    @Path("/city")
    @Produces(MediaType.APPLICATION_JSON)
    public Response city(@QueryParam("name") String name) {
        if ((name == null) || name.trim().isEmpty() || (name.length() > 80)) {
            return Response.status(400).entity("{\"error\":\"Enter a city name\"}").build();
        }

        try {
            com.liferay.portal.kernel.json.JSONObject result = LiveTracker.getAircraftNear(name);

            if (result == null) {
                return Response.status(404).entity("{\"error\":\"City not found\"}").build();
            }

            return Response.ok(result.toString()).build();
        }
        catch (Exception exception) {
            return Response.status(502).entity("{\"error\":\"Live data unavailable right now\"}").build();
        }
    }

    @GET
    @Path("/area")
    @Produces(MediaType.APPLICATION_JSON)
    public Response area(
        @QueryParam("lat") double lat, @QueryParam("lon") double lon, @QueryParam("nm") int nm) {

        if ((Math.abs(lat) > 90) || (Math.abs(lon) > 180) || (nm < 1)) {
            return Response.status(400).entity("{\"error\":\"Bad area\"}").build();
        }

        try {
            return Response.ok(LiveTracker.getAircraftArea(lat, lon, nm).toString()).build();
        }
        catch (Exception exception) {
            return Response.status(502).entity("{\"error\":\"Live data unavailable right now\"}").build();
        }
    }

    /** Read-only list of flights, so visitors who cannot call the Objects API can still see them. */
    @GET
    @Path("/flights")
    @Produces(MediaType.APPLICATION_JSON)
    public Response flights(@QueryParam("siteId") long siteId) {
        try {
            JSONArray out = JSONFactoryUtil.createJSONArray();

            for (ObjectEntry entry : _entries("C_Flight", siteId)) {
                Map<String, Serializable> v = entry.getValues();

                JSONObject flight = JSONFactoryUtil.createJSONObject();

                flight.put("id", entry.getObjectEntryId());
                flight.put("flightNumber", _text(v.get("flightNumber")));
                flight.put("showstatus", _text(v.get("showstatus")).replaceAll("([a-z])([A-Z])", "$1 $2"));
                flight.put("departureTime", _time(v.get("departureTime")));
                flight.put("arrivalTime", _time(v.get("arrivalTime")));
                flight.put("delayMinutes", _number(v.get("delayMinutes")));
                flight.put("originAirportId", _number(v.get("r_originAirport_c_airportId")));
                flight.put("destinationAirportId", _number(v.get("r_destinationAirport_c_airportId")));
                flight.put("gateId", _number(v.get("r_gate_c_airportId")));

                out.put(flight);
            }

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            return Response.status(500).entity("{\"error\":\"Could not load flights\"}").build();
        }
    }

    /** Read-only list of gates. */
    @GET
    @Path("/gates")
    @Produces(MediaType.APPLICATION_JSON)
    public Response gates(@QueryParam("siteId") long siteId) {
        try {
            JSONArray out = JSONFactoryUtil.createJSONArray();

            for (ObjectEntry entry : _entries("C_Gate", siteId)) {
                Map<String, Serializable> v = entry.getValues();

                JSONObject gate = JSONFactoryUtil.createJSONObject();

                gate.put("id", entry.getObjectEntryId());
                gate.put("gateNumber", _text(v.get("gateNumber")));
                gate.put("terminal", _text(v.get("terminal")));

                out.put(gate);
            }

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            return Response.status(500).entity("{\"error\":\"Could not load gates\"}").build();
        }
    }

    /** Read-only list of airports (these belong to the whole portal, not to one site). */
    @GET
    @Path("/airports")
    @Produces(MediaType.APPLICATION_JSON)
    public Response airports() {
        try {
            JSONArray out = JSONFactoryUtil.createJSONArray();

            for (ObjectEntry entry : _entries("C_Airport", 0)) {
                Map<String, Serializable> v = entry.getValues();

                JSONObject airport = JSONFactoryUtil.createJSONObject();

                airport.put("id", entry.getObjectEntryId());
                airport.put("code", _text(v.get("code")));
                airport.put("name", _text(v.get("name")));
                airport.put("city", _text(v.get("city")));
                airport.put("country", _text(v.get("country")));

                out.put(airport);
            }

            return Response.ok(out.toString()).build();
        }
        catch (Exception exception) {
            return Response.status(500).entity("{\"error\":\"Could not load airports\"}").build();
        }
    }

    private List<ObjectEntry> _entries(String objectName, long siteId) throws Exception {
        ObjectDefinition definition = _objectDefinitionLocalService.getObjectDefinition(
            PortalUtil.getDefaultCompanyId(), objectName);

        return _objectEntryLocalService.getObjectEntries(siteId, definition.getObjectDefinitionId(), 0, 500);
    }

    private String _text(Object value) {
        return (value == null) ? "" : String.valueOf(value);
    }

    private long _number(Object value) {
        return (value == null) ? 0L : Long.parseLong(String.valueOf(value));
    }

    private String _time(Object value) {
        if (!(value instanceof Date)) {
            return "";
        }

        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

        format.setTimeZone(TimeZone.getTimeZone("UTC"));

        return format.format((Date)value);
    }
}
