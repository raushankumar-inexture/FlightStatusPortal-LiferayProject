const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);

class FlightStatusSearch extends HTMLElement {
	async connectedCallback() {
		const q = new URLSearchParams(window.location.search).get('q') || '';
		this.innerHTML = '<section class="fa-section">' +
			'<div class="fa-section__header">' +
			'<h2 class="fa-section__title">Search Flights</h2>' +
			'<p class="fa-section__subtitle">Find a flight by number or route.</p>' +
			'</div>' +
			'<div class="fa-input-group">' +
			'<input class="fa-input" name="q" placeholder="Flight number or status" value="' + esc(q) + '" />' +
			'<button class="fa-btn fa-btn--primary" type="submit">Search</button>' +
			'</div>' +
			'</section>' +
			'<div class="fa-section">' +
			'<div class="fa-section__header">' +
			'<h2 class="fa-section__title">Results</h2>' +
			'<p class="fa-section__subtitle" id="search-msg">Loading...</p>' +
			'</div>' +
			'<div class="fa-grid fa-grid--3" id="search-results"></div>' +
			'</div>';
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
			this.querySelector('#search-msg').textContent = 'Error: ' + e.message;
		}
	}

	render(term) {
		const t = term.trim().toLowerCase();
		const hits = this.flights.filter((f) => !t || (f.flightNumber + ' ' + f.status).toLowerCase().includes(t));
		this.querySelector('#search-msg').textContent = hits.length ? hits.length + ' flight(s) found' : 'No flights match your search.';
		this.querySelector('#search-results').innerHTML = hits
			.map((f) => `<div class="fa-flight-card"><div class="fa-flight-number">${esc(f.flightNumber)}</div><div class="fa-flight-route"><span class="fa-flight-airport">${esc(f.origin || '—')}</span><span class="fa-flight-arrow">&rarr;</span><span class="fa-flight-airport">${esc(f.destination || '—')}</span></div><div class="fa-flight-times">${esc(f.departureTime)}</div><div class="fa-flight-meta"><span class="fa-badge fa-badge--${String(f.status).toLowerCase().replace(/[^a-z]/g, '')}">${esc(f.status)}</span>${f.delayMinutes ? '<br>+' + esc(f.delayMinutes) + ' min' : ''}</div></div>`)
			.join('');
	}
}

if (!customElements.get('flight-status-search')) {
	customElements.define('flight-status-search', FlightStatusSearch);
}
