package com.flight.api;

import com.liferay.portal.kernel.util.HtmlUtil;

import java.io.InputStream;

import java.nio.charset.StandardCharsets;

import java.util.Map;

/**
 * The page a phone shows after scanning a boarding pass QR code: a real-looking pass with the verified state,
 * route, times, gate and seat. The look is in boarding-check.html, this class only fills it in.
 * States: valid, boarded, departed, cancelled, invalid, problem.
 */
final class PassPage {

    private static final String _PLANE =
        "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z\"/></svg>";

    private static final String _TEMPLATE = _load();

    /** A pass that could be checked. d holds: state, name, pnr, flightNumber, airline, origin, originCity, destination, destinationCity,
     *  departIso, boardingIso, gate, seat, travelClass, terminal, statusText, statusClass, boardedIso, baggage, meal, reason. */
    static String pass(Map<String, String> d) {
        String state = d.get("state");

        String title = "valid".equals(state) ? "Valid" : "boarded".equals(state) ? "Boarded" : "cancelled".equals(state) ? "Flight cancelled" : "Flight departed";
        String sub = "valid".equals(state) ? "This boarding pass is real and not changed." : "boarded".equals(state) ?
            "Scanned at the gate" : "cancelled".equals(state) ? "Please ask the airline for help." : "This flight has already left.";

        StringBuilder out = new StringBuilder();

        out.append(_head(true));
        out.append("<div class=\"banner\"><span class=\"ico\">").append("cancelled".equals(state) ? "!" : "&#10003;").append("</span><div>").append(title);

        if ("boarded".equals(state)) {
            out.append(" at <time datetime=\"").append(_e(d.get("boardedIso"))).append("\" data-f=\"time\">").append(_e(d.get("boardedIso"))).append("</time>");
        }

        out.append("<small>").append(_e(sub)).append("</small></div></div>");

        out.append("<section class=\"route\" aria-label=\"Route\"><div class=\"end\"><span class=\"code\">").append(_e(d.get("origin"))).append("</span><span class=\"city\">").append(_e(d.get("originCity"))).append("</span></div>");
        out.append("<div class=\"way\"><i></i>").append(_PLANE).append("<i></i></div>");
        out.append("<div class=\"end right\"><span class=\"code\">").append(_e(d.get("destination"))).append("</span><span class=\"city\">").append(_e(d.get("destinationCity"))).append("</span></div></section>");

        out.append("<div class=\"meta\"><span><b>").append(_e(d.get("flightNumber"))).append("</b>");

        if (!d.get("airline").isEmpty()) {
            out.append(" &middot; ").append(_e(d.get("airline")));
        }

        out.append("</span><span><time datetime=\"").append(_e(d.get("departIso"))).append("\" data-f=\"date\">").append(_e(d.get("departIso"))).append("</time></span></div>");

        out.append("<div class=\"grid\">");
        out.append(_cell("Departs", "<time datetime=\"" + _e(d.get("departIso")) + "\" data-f=\"time\">" + _e(d.get("departIso")) + "</time>", ""));
        out.append(_cell("Boarding", "<time datetime=\"" + _e(d.get("boardingIso")) + "\" data-f=\"time\">" + _e(d.get("boardingIso")) + "</time>", ""));
        out.append(_cell("Class", _e(d.get("travelClass")), ""));
        out.append(_cell("Gate", _e(d.get("gate")), "big"));
        out.append(_cell("Seat", _e(d.get("seat")), "big"));
        out.append(_cell("Terminal", d.get("terminal").isEmpty() ? "&mdash;" : _e(d.get("terminal")), ""));
        out.append("</div>");

        out.append("<div class=\"status\"><div><small style=\"display:block;color:var(--muted);font-size:.68rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase\">Flight status</small></div>");
        out.append("<span class=\"pill ").append(_e(d.get("statusClass"))).append("\">").append(_e(d.get("statusText"))).append("</span></div>");

        out.append("<div class=\"tear\"></div>");

        out.append("<div class=\"foot\"><div><small>Passenger</small><b>").append(_e(d.get("name"))).append("</b></div><div class=\"pnr\"><small>Booking code</small><b>").append(_e(d.get("pnr"))).append("</b></div>");

        if (!d.get("baggage").isEmpty() || !d.get("meal").isEmpty()) {
            out.append("<div class=\"tags\">");

            if (!d.get("baggage").isEmpty()) {
                out.append("<span class=\"tag\">Extra baggage +").append(_e(d.get("baggage"))).append(" kg</span>");
            }

            if (!d.get("meal").isEmpty()) {
                out.append("<span class=\"tag\">").append(_e(d.get("meal"))).append("</span>");
            }

            out.append("</div>");
        }

        out.append("</div>");
        out.append("<div class=\"note\"><b>Checked at <span id=\"checked\"></span></b> on this phone. Times are shown in your phone's time zone. Gate and status can change, so check the airport screens.</div>");

        return _TEMPLATE.replace("{{title}}", "Boarding pass " + _e(d.get("flightNumber"))).replace("{{state}}", _e(state)).replace("{{body}}", out.toString());
    }

    /** A code that is not a real pass (invalid) or a problem while checking (problem). */
    static String message(String state, String headline, String text, String[] help) {
        StringBuilder out = new StringBuilder();

        out.append(_head(false));
        out.append("<div class=\"banner\"><span class=\"ico\">").append("problem".equals(state) ? "!" : "&#10007;").append("</span><div>").append(_e(headline)).append("</div></div>");
        out.append("<p class=\"msg\">").append(_e(text)).append("</p>");

        if (help.length > 0) {
            out.append("<ol class=\"help\">");

            for (String line : help) {
                out.append("<li>").append(_e(line)).append("</li>");
            }

            out.append("</ol>");
        }

        return _TEMPLATE.replace("{{title}}", _e(headline)).replace("{{state}}", _e(state)).replace("{{body}}", out.toString());
    }

    private static String _head(boolean verified) {
        return "<header class=\"head\"><div class=\"brand\"><span class=\"logo\">" + _PLANE + "</span><span>Flight Status <b>Portal</b></span></div>" +
            (verified ? "<span class=\"seal\">&#10003; Verified</span>" : "") + "</header>";
    }

    private static String _cell(String label, String value, String css) {
        return "<div class=\"cell " + css + "\"><small>" + label + "</small><b>" + value + "</b></div>";
    }

    private static String _e(String value) {
        return HtmlUtil.escape((value == null) ? "" : value);
    }

    private static String _load() {
        try (InputStream in = PassPage.class.getResourceAsStream("/boarding-check.html")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        catch (Exception exception) {
            return "<!doctype html><title>{{title}}</title><main class=\"{{state}}\">{{body}}</main>";
        }
    }

}
