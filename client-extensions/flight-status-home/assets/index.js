class FlightStatusHome extends HTMLElement {
	connectedCallback() {
		const base = this.getAttribute('flight-page') || '/web/flight-status-portal/flight-status';

		const root = base.replace(/\/[^/]*$/, '');
		const cards = [
			{icon: '&#9992;', title: 'Flight Status', text: 'Live departures, arrivals and delays.', href: base},
			{icon: '&#128269;', title: 'Search Flights', text: 'Find a flight by number or route.', href: root + '/search'},
			{icon: '&#127970;', title: 'Airports', text: 'Browse airports and cities.', href: root + '/airports'},
			{icon: '&#128682;', title: 'Gates', text: 'Terminals and gate information.', href: root + '/gates'},
		];

		this.innerHTML =
			'<div class="fh-hero"><h1>Flight Status Portal</h1>' +
			'<p>Check live departures, arrivals and delays in one place.</p>' +
			'<form class="fh-search"><input name="q" placeholder="Enter flight number, e.g. DL250" />' +
			'<button class="fh-btn" type="submit">Search</button></form></div>' +
			'<div class="fh-section"><h2>Upcoming flights</h2><div class="fh-grid">Loading...</div></div>' +
			'<div class="fh-section"><h2>Explore</h2><div class="fh-cards">' +
			cards.map((c) => `<a class="fh-card" href="${c.href}"><span class="fh-icon">${c.icon}</span><b>${c.title}</b><span>${c.text}</span></a>`).join('') +
			'</div></div>';

		this.querySelector('form').addEventListener('submit', (e) => {
			e.preventDefault();
			const q = this.querySelector('input').value.trim();
			window.location.href = root + '/search' + (q ? '?q=' + encodeURIComponent(q) : '');
		});
		this.load();
	}

	async load() {
		const grid = this.querySelector('.fh-grid');
		const fetchFn = window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch;
		const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

		try {
			const res = await fetchFn('/o/flight/search', {credentials: 'include'});
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const flights = (await res.json()).slice(0, 3);

			grid.innerHTML = flights.length
				? flights.map((f) => `<div class="fh-row"><b>${esc(f.flightNumber)}</b><span>${esc(f.departureTime)}</span><span class="fh-badge ${String(f.status).toLowerCase().replace(/[^a-z]/g, '')}">${esc(f.status)}</span></div>`).join('')
				: 'No flights found.';
		} catch (e) {
			grid.textContent = 'Error: ' + e.message;
		}
	}
}

if (!customElements.get('flight-status-home')) {
	customElements.define('flight-status-home', FlightStatusHome);
}
