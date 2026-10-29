const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);

class FlightStatusSearch extends HTMLElement {
	async connectedCallback() {
		const q = new URLSearchParams(window.location.search).get('q') || '';
		this.innerHTML = '<div class="fx-app"><h2>Search Flights</h2><form class="fx-form"><input name="q" placeholder="Flight number or status" />' +
			'<button class="fx-btn" type="submit">Search</button></form><div class="fx-msg">Loading...</div><div class="fx-results"></div></div>';
		const input = this.querySelector('input');
		input.value = q;
		this.querySelector('form').addEventListener('submit', (e) => {
			e.preventDefault();
			this.render(input.value);
		});
		try {
			const res = await getFetch()('/o/flight/search', {credentials: 'include'});
			if (!res.ok) throw new Error('HTTP ' + res.status);
			this.flights = await res.json();
			this.render(q);
		} catch (e) {
			this.querySelector('.fx-msg').textContent = 'Error: ' + e.message;
		}
	}

	render(term) {
		const t = term.trim().toLowerCase();
		const hits = this.flights.filter((f) => !t || (f.flightNumber + ' ' + f.status).toLowerCase().includes(t));
		this.querySelector('.fx-msg').textContent = hits.length ? hits.length + ' flight(s) found' : 'No flights match your search.';
		this.querySelector('.fx-results').innerHTML = hits
			.map((f) => `<div class="fx-row"><b>${esc(f.flightNumber)}</b><span>${esc(f.departureTime)}</span><span class="fx-badge ${String(f.status).toLowerCase().replace(/[^a-z]/g, '')}">${esc(f.status)}</span></div>`)
			.join('');
	}
}

if (!customElements.get('flight-status-search')) {
	customElements.define('flight-status-search', FlightStatusSearch);
}
