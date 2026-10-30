package com.flight.api;

import com.liferay.portal.kernel.json.JSONArray;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;

import java.io.InputStream;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

import java.nio.charset.StandardCharsets;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Pulls live ADS-B positions from the free adsb.fi open data API and caches
 * the merged result so every visitor shares the same upstream requests
 * (adsb.fi allows about one request per second).
 */
public class LiveTracker {

    private static final String _BASE = "https://opendata.adsb.fi/api/v2";

    private static final long _CACHE_MILLIS = 20_000L;

    private static final int _RADIUS_NM = 250;

    /** Centre points that together cover India. */
    private static final double[][] _CENTRES = {
        {28.6, 77.1}, {19.1, 72.9}, {13.1, 80.2}, {22.6, 88.4}
    };

    private static JSONArray _cache = JSONFactoryUtil.createJSONArray();
    private static long _cachedAt;

    public static synchronized JSONArray getAircraft() {
        long now = System.currentTimeMillis();

        if ((now - _cachedAt) < _CACHE_MILLIS) {
            return _cache;
        }

        Map<String, JSONObject> byHex = new LinkedHashMap<>();
        boolean any = false;

        for (double[] c : _CENTRES) {
            try {
                String body = _get(_BASE + "/lat/" + c[0] + "/lon/" + c[1] + "/dist/" + _RADIUS_NM);
                JSONArray list = JSONFactoryUtil.createJSONObject(body).getJSONArray("aircraft");

                any = true;

                for (int i = 0; (list != null) && (i < list.length()); i++) {
                    JSONObject a = list.getJSONObject(i);

                    if (!a.has("lat") || !a.has("lon") || !a.has("hex")) {
                        continue;
                    }

                    JSONObject out = JSONFactoryUtil.createJSONObject();

                    out.put("hex", a.getString("hex"));
                    out.put("callsign", a.getString("flight").trim());
                    out.put("lat", a.getDouble("lat"));
                    out.put("lon", a.getDouble("lon"));
                    out.put("onGround", "ground".equals(a.getString("alt_baro")));
                    out.put("altitude", a.getInt("alt_baro", 0));
                    out.put("speed", Math.round(a.getDouble("gs")));
                    out.put("track", Math.round(a.getDouble("track")));
                    out.put("type", a.getString("t"));
                    out.put("registration", a.getString("r"));

                    byHex.put(a.getString("hex"), out);
                }

            }
            catch (InterruptedException interruptedException) {
                Thread.currentThread().interrupt();

                break;
            }
            catch (Exception exception) {
                // one region failing should not break the rest
            }
        }

        if (any) {
            JSONArray merged = JSONFactoryUtil.createJSONArray();

            for (JSONObject o : byHex.values()) {
                merged.put(o);
            }

            _cache = merged;
        }

        _cachedAt = now;

        return _cache;
    }

    private static final int _CITY_RADIUS_KM = 50;

    private static final double _KM_PER_NM = 1.852;

    private static final int _MAX_CITIES = 100;

    private static final Map<String, double[]> _places = new LinkedHashMap<>();
    private static final Map<String, Object[]> _cityCache = new LinkedHashMap<>();

    /**
     * Finds every airborne aircraft within 50 km of the named city. The city
     * is looked up once with OpenStreetMap Nominatim; aircraft come from
     * adsb.fi and are cached for 20 seconds per city.
     *
     * @return null when the city cannot be found
     */
    public static synchronized JSONObject getAircraftNear(String city) throws Exception {
        String key = city.trim().toLowerCase(Locale.ROOT);

        double[] place = _places.get(key);

        if (place == null) {
            JSONArray found = JSONFactoryUtil.createJSONArray(
                _get(
                    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
                        URLEncoder.encode(city.trim(), StandardCharsets.UTF_8)));

            if (found.length() == 0) {
                return null;
            }

            JSONObject hit = found.getJSONObject(0);

            place = new double[] {hit.getDouble("lat"), hit.getDouble("lon")};

            if (_places.size() >= _MAX_CITIES) {
                _places.remove(_places.keySet().iterator().next());
            }

            _places.put(key, place);
            _names.put(key, hit.getString("display_name"));
        }

        Object[] cached = _cityCache.get(key);
        long now = System.currentTimeMillis();

        if ((cached != null) && ((now - (Long)cached[0]) < _CACHE_MILLIS)) {
            return (JSONObject)cached[1];
        }

        String body = _get(
            _BASE + "/lat/" + place[0] + "/lon/" + place[1] + "/dist/" +
                (int)Math.ceil(_CITY_RADIUS_KM / _KM_PER_NM));

        JSONArray list = JSONFactoryUtil.createJSONObject(body).getJSONArray("aircraft");

        List<JSONObject> near = new ArrayList<>();

        for (int i = 0; (list != null) && (i < list.length()); i++) {
            JSONObject a = list.getJSONObject(i);

            if (!a.has("lat") || !a.has("lon") || "ground".equals(a.getString("alt_baro"))) {
                continue;
            }

            double km = _distanceKm(place[0], place[1], a.getDouble("lat"), a.getDouble("lon"));

            if (km > _CITY_RADIUS_KM) {
                continue;
            }

            JSONObject out = JSONFactoryUtil.createJSONObject();

            out.put("hex", a.getString("hex"));
            out.put("callsign", a.getString("flight").trim());
            out.put("lat", a.getDouble("lat"));
            out.put("lon", a.getDouble("lon"));
            out.put("onGround", false);
            out.put("altitude", a.getInt("alt_baro", 0));
            out.put("speed", Math.round(a.getDouble("gs")));
            out.put("track", Math.round(a.getDouble("track")));
            out.put("type", a.getString("t"));
            out.put("registration", a.getString("r"));
            out.put("distanceKm", Math.round(km * 10) / 10.0);

            near.add(out);
        }

        near.sort(Comparator.comparingDouble(o -> o.getDouble("distanceKm")));

        JSONArray sorted = JSONFactoryUtil.createJSONArray();

        near.forEach(sorted::put);

        JSONObject result = JSONFactoryUtil.createJSONObject();

        result.put("city", _names.get(key));
        result.put("lat", place[0]);
        result.put("lon", place[1]);
        result.put("radiusKm", _CITY_RADIUS_KM);
        result.put("aircraft", sorted);

        if (_cityCache.size() >= _MAX_CITIES) {
            _cityCache.remove(_cityCache.keySet().iterator().next());
        }

        _cityCache.put(key, new Object[] {now, result});

        return result;
    }

    private static final Map<String, Object[]> _areaCache = new LinkedHashMap<>();

    /**
     * Aircraft around any point on Earth (the area the visitor is looking at
     * on the map). The centre is snapped to a 1 degree grid and the radius
     * to a fixed step so nearby views share one cached upstream request.
     */
    public static synchronized JSONArray getAircraftArea(double lat, double lon, int nm) throws Exception {
        double sLat = Math.max(-85, Math.min(85, Math.round(lat)));
        double sLon = Math.max(-180, Math.min(180, Math.round(lon)));
        int sNm = (nm <= 60) ? 60 : (nm <= 120) ? 120 : (nm <= 190) ? 190 : 250;

        String key = sLat + "," + sLon + "," + sNm;
        long now = System.currentTimeMillis();
        Object[] cached = _areaCache.get(key);

        if ((cached != null) && ((now - (Long)cached[0]) < _CACHE_MILLIS)) {
            return (JSONArray)cached[1];
        }

        JSONArray list = JSONFactoryUtil.createJSONObject(
            _get(_BASE + "/lat/" + sLat + "/lon/" + sLon + "/dist/" + sNm)).getJSONArray("aircraft");

        JSONArray out = JSONFactoryUtil.createJSONArray();

        for (int i = 0; (list != null) && (i < list.length()); i++) {
            JSONObject a = list.getJSONObject(i);

            if (!a.has("lat") || !a.has("lon") || !a.has("hex")) {
                continue;
            }

            JSONObject o = JSONFactoryUtil.createJSONObject();

            o.put("hex", a.getString("hex"));
            o.put("callsign", a.getString("flight").trim());
            o.put("lat", a.getDouble("lat"));
            o.put("lon", a.getDouble("lon"));
            o.put("onGround", "ground".equals(a.getString("alt_baro")));
            o.put("altitude", a.getInt("alt_baro", 0));
            o.put("speed", Math.round(a.getDouble("gs")));
            o.put("track", Math.round(a.getDouble("track")));
            o.put("type", a.getString("t"));
            o.put("registration", a.getString("r"));

            out.put(o);
        }

        if (_areaCache.size() >= 300) {
            _areaCache.remove(_areaCache.keySet().iterator().next());
        }

        _areaCache.put(key, new Object[] {now, out});

        return out;
    }

    private static final Map<String, String> _names = new LinkedHashMap<>();

    private static double _distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double h = Math.pow(Math.sin(dLat / 2), 2) +
            (Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2));

        return 6371 * 2 * Math.asin(Math.sqrt(h));
    }

    private static long _lastCall;

    private static void _throttle() throws InterruptedException {
        long wait = (_lastCall + 1100) - System.currentTimeMillis();

        if (wait > 0) {
            Thread.sleep(wait);
        }

        _lastCall = System.currentTimeMillis();
    }

    private static String _get(String url) throws Exception {
        _throttle();

        HttpURLConnection connection = (HttpURLConnection)new URL(url).openConnection();

        connection.setConnectTimeout(5000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("User-Agent", "FlightStatusPortal/1.0");

        try (InputStream inputStream = connection.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
        finally {
            connection.disconnect();
        }
    }
}
