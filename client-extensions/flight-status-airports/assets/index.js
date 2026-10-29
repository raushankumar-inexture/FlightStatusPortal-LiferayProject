const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);

class FlightStatusAirports extends HTMLElement {
	async connectedCallback() {
		this.innerHTML = '<div class="fx-app"><h2>Airports</h2><div class="fx-msg">Loading...</div><div class="fx-grid"></div></div>';
		const msg = this.querySelector('.fx-msg');
		try {
			const res = await getFetch()('/o/c/airports/?pageSize=100', {credentials: 'include'});
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const items = (await res.json()).items;
			msg.textContent = items.length ? '' : 'No airports found.';
			this.querySelector('.fx-grid').innerHTML = items
				.map((a) => `<div class="fx-card"><b>${esc(a.code)}</b>${esc(a.name)}<br><small>${esc(a.city)}</small></div>`)
				.join('');
		} catch (e) {
			msg.textContent = 'Error: ' + e.message;
		}
	}
}

if (!customElements.get('flight-status-airports')) {
	customElements.define('flight-status-airports', FlightStatusAirports);
}
