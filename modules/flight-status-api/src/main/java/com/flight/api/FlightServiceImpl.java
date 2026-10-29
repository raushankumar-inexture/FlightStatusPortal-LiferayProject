package com.flight.api;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectDefinitionLocalService;
import com.liferay.object.service.ObjectEntryLocalService;

import com.liferay.portal.kernel.service.ServiceContext;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

@Component(service = FlightService.class)
public class FlightServiceImpl implements FlightService {

    public static final long _SITE_ID = 34157L;
    private static final long COMPANY_ID = 20097L;

    @Reference
    private ObjectDefinitionLocalService objectDefinitionLocalService;

    @Reference
    private ObjectEntryLocalService objectEntryLocalService;

    private long getUserId() {
        return 20125L;
    }

    private ServiceContext getServiceContext(long groupId) {
        ServiceContext sc = new ServiceContext();
        sc.setScopeGroupId(groupId);
        sc.setCompanyId(COMPANY_ID);
        sc.setUserId(getUserId());
        return sc;
    }

    private Date parseDate(String s) throws Exception {
        if (s == null) return null;
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(s);
    }

    private static long objectId(String erc) {
        if ("Airport".equals(erc)) return 34259L;
        if ("Gate".equals(erc)) return 34319L;
        if ("Flight".equals(erc)) return 34435L;
        throw new IllegalArgumentException(erc);
    }

    private long addObject(String erc, long groupId, Map<String, Object> values) throws Exception {
        ObjectDefinition od = objectDefinitionLocalService.getObjectDefinition(objectId(erc));
        Map<String, java.io.Serializable> v = new HashMap<>();
        for (Map.Entry<String, Object> e : values.entrySet()) {
            v.put(e.getKey(), (java.io.Serializable) e.getValue());
        }
        ObjectEntry entry = objectEntryLocalService.addObjectEntry(
                getUserId(), groupId, od.getObjectDefinitionId(), 0L, null, v, getServiceContext(groupId));
        return entry.getObjectEntryId();
    }

    private static long toLong(Object o) {
        return (o == null) ? 0L : Long.parseLong(String.valueOf(o));
    }

    private static int toInt(Object o) {
        return (o == null) ? 0 : Integer.parseInt(String.valueOf(o));
    }

    private static String toStr(Object o) {
        return (o == null) ? "" : String.valueOf(o);
    }

    @Override
    public List<FlightDTO> searchFlights() throws Exception {
        List<FlightDTO> list = new java.util.ArrayList<>();
        ObjectDefinition od = objectDefinitionLocalService.getObjectDefinition(objectId("Flight"));
        List<ObjectEntry> entries = objectEntryLocalService.getObjectEntries(
                _SITE_ID, od.getObjectDefinitionId(), 0, 100);
        for (ObjectEntry e : entries) {
            Map<String, Object> v = (Map<String, Object>)(Map<?,?>) e.getValues();
            FlightDTO d = new FlightDTO();
            d.id = e.getObjectEntryId();
            d.flightNumber = toStr(v.get("flightNumber"));
            d.status = toStr(v.get("showstatus"));
            d.departureTime = toStr(v.get("departureTime"));
            d.arrivalTime = toStr(v.get("arrivalTime"));
            d.flightDurationMinutes = toInt(v.get("flightDurationMinutes"));
            d.delayMinutes = toInt(v.get("delayMinutes"));
            d.originAirportId = toLong(v.get("r_originAirport_c_airportId"));
            d.destinationAirportId = toLong(v.get("r_destinationAirport_c_airportId"));
            d.gateId = toLong(v.get("r_gate_c_airportId"));
            list.add(d);
        }
        return list;
    }

    @Override
    public long addAirport(AirportDTO dto) throws Exception {
        Map<String, Object> v = new HashMap<>();
        v.put("code", dto.code);
        v.put("name", dto.name);
        v.put("city", dto.city);
        return addObject("Airport", 0L, v);
    }

    @Override
    public long addGate(GateDTO dto) throws Exception {
        Map<String, Object> v = new HashMap<>();
        v.put("gateNumber", dto.gateNumber);
        v.put("terminal", dto.terminal);
        return addObject("Gate", _SITE_ID, v);
    }

    @Override
    public long addFlight(FlightRequestDTO dto) throws Exception {
        Map<String, Object> v = new HashMap<>();
        v.put("flightNumber", dto.flightNumber);
        v.put("showstatus", dto.status);
        v.put("departureTime", parseDate(dto.departureTime));
        v.put("arrivalTime", parseDate(dto.arrivalTime));
        v.put("flightDurationMinutes", dto.flightDurationMinutes);
        v.put("delayMinutes", dto.delayMinutes);
        v.put("r_originAirport_c_airportId", dto.originAirportId);
        v.put("r_destinationAirport_c_airportId", dto.destinationAirportId);
        v.put("r_gate_c_airportId", dto.gateId);
        return addObject("Flight", _SITE_ID, v);
    }
}
