package com.flight.api;

import java.util.List;

public interface FlightService {
    List<FlightDTO> searchFlights() throws Exception;
    long addAirport(AirportDTO dto) throws Exception;
    long addGate(GateDTO dto) throws Exception;
    long addFlight(FlightRequestDTO dto) throws Exception;
}
