package com.flight.api;

public class FlightDTO {
    public long id;
    public String flightNumber;
    public String status;
    public String departureTime;
    public String arrivalTime;
    public int flightDurationMinutes;
    public int delayMinutes;
    public long originAirportId;
    public long destinationAirportId;
    public long gateId;
}
