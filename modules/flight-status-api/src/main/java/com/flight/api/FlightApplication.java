package com.flight.api;

import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Collections;
import java.util.Set;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.jaxrs.whiteboard.JaxrsWhiteboardConstants;

@Component(
    property = {
        JaxrsWhiteboardConstants.JAX_RS_APPLICATION_BASE + "=/flight",
        JaxrsWhiteboardConstants.JAX_RS_NAME + "=flight.Flight",
        "auth.verifier.guest.allowed=true",
        "liferay.auth.verifier=true"
    },
    service = Application.class
)
public class FlightApplication extends Application {

    @Reference
    private FlightService flightService;

    @Override
    public Set<Object> getSingletons() {
        return Collections.singleton(this);
    }

    @POST
    @Path("/airports")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addAirport(AirportDTO dto) throws Exception {
        long id = flightService.addAirport(dto);
        JSONObject json = JSONFactoryUtil.createJSONObject();
        json.put("id", id);
        return Response.ok(json.toString()).build();
    }

    @POST
    @Path("/gates")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addGate(GateDTO dto) throws Exception {
        long id = flightService.addGate(dto);
        JSONObject json = JSONFactoryUtil.createJSONObject();
        json.put("id", id);
        return Response.ok(json.toString()).build();
    }

    @POST
    @Path("/flights")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addFlight(FlightRequestDTO dto) throws Exception {
        long id = flightService.addFlight(dto);
        JSONObject json = JSONFactoryUtil.createJSONObject();
        json.put("id", id);
        return Response.ok(json.toString()).build();
    }

    @GET
    @Path("/search")
    @Produces(MediaType.APPLICATION_JSON)
    public Response search() throws Exception {
        JSONArray array = JSONFactoryUtil.createJSONArray();

        for (FlightDTO f : flightService.searchFlights()) {
            array.put(
                JSONFactoryUtil.createJSONObject().put(
                    "id", f.id
                ).put(
                    "flightNumber", f.flightNumber
                ).put(
                    "status", f.status
                ).put(
                    "departureTime", f.departureTime
                ).put(
                    "arrivalTime", f.arrivalTime
                ).put(
                    "flightDurationMinutes", f.flightDurationMinutes
                ).put(
                    "delayMinutes", f.delayMinutes
                ).put(
                    "originAirportId", f.originAirportId
                ).put(
                    "destinationAirportId", f.destinationAirportId
                ).put(
                    "gateId", f.gateId
                ));
        }

        return Response.ok(array.toString()).build();
    }
}
