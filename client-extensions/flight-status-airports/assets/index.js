const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);

class FlightStatusAirports extends HTMLElement {
async connectedCallback() {
this.innerHTML =
'<section class="fa-section">' +
'<div class="fa-section__header">' +
'<h2 class="fa-section__title">Airports</h2>' +
'<p class="fa-section__subtitle">Browse airports and cities.</p>' +
'</div>' +
'<div class="fa-input-group fa-mb-6">' +
'<input class="fa-input" type="text" id="airport-search" placeholder="Search airports..." />' +
'</div>' +
'<div id="airport-msg" class="fa-text-secondary fa-mb-4">Loading...</div>' +
'<div class="fa-grid fa-grid--4" id="airport-grid"></div>' +
'</section>';
const msg = this.querySelector('#airport-msg');
const grid = this.querySelector('#airport-grid');
const search = this.querySelector('#airport-search');
let allItems = [];

try {
const res = await getFetch()('/o/c/airports/?pageSize=100', {credentials: 'include'});
if (!res.ok) throw new Error('HTTP ' + res.status);
allItems = (await res.json()).items;
msg.textContent = allItems.length ? '' : 'No airports found.';
render(allItems);
} catch (e) {
msg.textContent = 'Error: ' + e.message;
}

search.addEventListener('input', (e) => {
const term = e.target.value.toLowerCase();
const filtered = allItems.filter((a) =>
(a.code + ' ' + a.name + ' ' + a.city).toLowerCase().includes(term)
);
render(filtered);
});

function render(items) {
grid.innerHTML = items
.map((a) => `<div class="fa-card fa-card--interactive"><div class="fa-card__header"><div class="fa-card__title">${esc(a.code)}</div><span class="fa-badge fa-badge--info">${esc(a.country || '')}</span></div><div class="fa-card__subtitle">${esc(a.name)}</div><div class="fa-text-muted">${esc(a.city)}</div></div>`)
.join('');
}
}
}

if (!customElements.get('flight-status-airports')) {
customElements.define('flight-status-airports', FlightStatusAirports);
}
