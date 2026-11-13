import "./components.js";

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);

class FlightStatusGates extends HTMLElement {
async connectedCallback() {
this.innerHTML =
'<section class="fa-section">' +
'<div class="fa-section__header">' +
'<h2 class="fa-section__title">Gates</h2>' +
'<p class="fa-section__subtitle">Terminals and gate information.</p>' +
'</div>' +
'<div id="gate-msg" class="fa-text-secondary fa-mb-4">Loading...</div>' +
'<div class="fa-grid fa-grid--4" id="gate-grid"></div>' +
'</section>';
const msg = this.querySelector('#gate-msg');
const grid = this.querySelector('#gate-grid');

try {
const siteId = window.Liferay && Liferay.ThemeDisplay ? Liferay.ThemeDisplay.getScopeGroupId() : 34157;
const res = await getFetch()('/o/c/gates/scopes/' + siteId + '?pageSize=100', {credentials: 'include'});
if (!res.ok) throw new Error('HTTP ' + res.status);
const items = (await res.json()).items;
msg.textContent = items.length ? '' : 'No gates found.';
grid.innerHTML = items
.map((g) => `<div class="fa-card fa-card--interactive"><div class="fa-card__header"><div class="fa-card__title">Gate ${esc(g.gateNumber)}</div><span class="fa-badge fa-badge--info">Terminal ${esc(g.terminal)}</span></div><div class="fa-card__subtitle">Gate ${esc(g.gateNumber)}</div></div>`)
.join('');
} catch (e) {
msg.textContent = 'Error: ' + e.message;
}
}
}

if (!customElements.get('flight-status-gates')) {
customElements.define('flight-status-gates', FlightStatusGates);
}
