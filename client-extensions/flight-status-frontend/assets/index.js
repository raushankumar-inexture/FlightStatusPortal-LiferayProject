import "./components.js";

class FlightStatusFrontend extends HTMLElement {
connectedCallback() {
this.innerHTML =
'<section class="fa-section">' +
'<div class="fa-section__header fa-flex fa-justify-between fa-items-center">' +
'<div>' +
'<h2 class="fa-section__title">Flight Status</h2>' +
'<p class="fa-section__subtitle">Live departures, arrivals and delays.</p>' +
'</div>' +
'<button class="fa-btn fa-btn--primary fa-btn--sm" id="refresh-btn">Refresh</button>' +
'</div>' +
'</section>' +
'<div class="fa-section">' +
'<p class="fa-text-secondary fa-mb-4" id="flight-msg">Loading...</p>' +
'<div class="fa-list" id="flight-list"></div>' +
'</div>';
this.querySelector('#refresh-btn').addEventListener('click', () => this.load());
this.load();
}

async load() {
const msg = this.querySelector('#flight-msg');
const list = this.querySelector('#flight-list');
const fetchFn = window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = (v) => {
const d = new Date(String(v).replace(' ', 'T') + 'Z');
return isNaN(d) ? esc(v) : d.toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'});
};

msg.hidden = false;
msg.textContent = 'Loading...';

try {
const [res, airRes] = await Promise.all([
fetchFn('/o/flight/search', {credentials: 'include'}),
fetchFn('/o/c/airports/?pageSize=100', {credentials: 'include'}),
]);
if (!res.ok) throw new Error('HTTP ' + res.status);
const flights = await res.json();
const airports = {};
if (airRes.ok) {
(await airRes.json()).items.forEach((a) => (airports[a.id] = a.code));
}
const code = (id) => esc(airports[id] || id);

if (!flights.length) {
msg.textContent = 'No flights found.';
list.innerHTML = '<div class="fa-empty-state"><div class="fa-empty-state__icon">&#128680;</div><div class="fa-empty-state__title">No flights found</div><div class="fa-empty-state__subtitle">No upcoming flights match your criteria.</div></div>';
return;
}

list.innerHTML = flights
.map((f) => {
const cls = String(f.status).toLowerCase().replace(/[^a-z]/g, '');
return `<div class="fa-flight-card"><div class="fa-flight-number">${esc(f.flightNumber)}</div><div class="fa-flight-route"><span class="fa-flight-airport">${code(f.originAirportId)}</span><span class="fa-flight-arrow">&rarr;</span><span class="fa-flight-airport">${code(f.destinationAirportId)}</span></div><div class="fa-flight-times">${fmt(f.departureTime)} – ${fmt(f.arrivalTime)}</div><div class="fa-flight-meta"><span class="fa-badge fa-badge--${cls}">${esc(f.status)}</span>${f.delayMinutes ? '<br>+' + esc(f.delayMinutes) + ' min' : ''}</div></div>`;
})
.join('');
msg.hidden = true;
} catch (e) {
msg.textContent = 'Error: ' + e.message;
}
}
}

if (!customElements.get('flight-status-frontend')) {
customElements.define('flight-status-frontend', FlightStatusFrontend);
}
