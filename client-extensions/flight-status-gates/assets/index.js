const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);

class FlightStatusGates extends HTMLElement {
	async connectedCallback() {
		this.innerHTML = '<div class="fx-app"><h2>Gates</h2><div class="fx-msg">Loading...</div><div class="fx-grid"></div></div>';
		const msg = this.querySelector('.fx-msg');
		try {
			const siteId = window.Liferay && Liferay.ThemeDisplay ? Liferay.ThemeDisplay.getScopeGroupId() : 34157;
			const res = await getFetch()('/o/c/gates/scopes/' + siteId + '?pageSize=100', {credentials: 'include'});
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const items = (await res.json()).items;
			msg.textContent = items.length ? '' : 'No gates found.';
			this.querySelector('.fx-grid').innerHTML = items
				.map((g) => `<div class="fx-card"><b>Gate ${esc(g.gateNumber)}</b>Terminal ${esc(g.terminal)}</div>`)
				.join('');
		} catch (e) {
			msg.textContent = 'Error: ' + e.message;
		}
	}
}

if (!customElements.get('flight-status-gates')) {
	customElements.define('flight-status-gates', FlightStatusGates);
}
