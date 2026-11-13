import "./components.js";

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
			'<section class="fa-hero">' +
			'<span class="fa-hero__badge">&#9992; Live Flight Data</span>' +
			'<h1 class="fa-hero__title">Flight Status Portal</h1>' +
			'<p class="fa-hero__subtitle">Check live departures, arrivals and delays in one place.</p>' +
			'<div class="fa-input-group" style="max-width:560px;margin:0 auto;">' +
			'<input class="fa-input" name="q" placeholder="Enter flight number, e.g. DL250" />' +
			'<button class="fa-btn fa-btn--gold fa-btn--lg" type="submit">Search</button>' +
			'</div>' +
			'</section>' +
			'<div class="fa-section">' +
			'<div class="fa-section__header">' +
			'<h2 class="fa-section__title">Upcoming Flights</h2>' +
			'<p class="fa-section__subtitle">Latest departures and arrivals.</p>' +
			'</div>' +
			'<div class="fa-grid fa-grid--3"><div class="fa-skeleton fa-skeleton--card"></div><div class="fa-skeleton fa-skeleton--card"></div><div class="fa-skeleton fa-skeleton--card"></div></div>' +
			'</div>' +
			'<div class="fa-section">' +
			'<div class="fa-section__header">' +
			'<h2 class="fa-section__title">Explore</h2>' +
			'<p class="fa-section__subtitle">Quick access to all portal features.</p>' +
			'</div>' +
			'<div class="fa-grid fa-grid--4">' +
			cards.map((c) => `<a class="fa-card fa-card--interactive" href="${c.href}"><div class="fa-card__header"><span class="fa-card__title">${c.icon}</span><span class="fa-badge fa-badge--info">${c.title}</span></div><div class="fa-card__subtitle">${c.text}</div></a>`).join('') +
			'</div>' +
			'</div>';

		this.querySelector('form').addEventListener('submit', (e) => {
			e.preventDefault();
			const q = this.querySelector('input').value.trim();
			window.location.href = root + '/search' + (q ? '?q=' + encodeURIComponent(q) : '');
		});
		this.load();
	}

	async load() {
		const grid = this.querySelector('.fa-grid');
		const fetchFn = window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch;
		const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

		try {
			const res = await fetchFn('/o/flight/search', {credentials: 'include'});
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const flights = (await res.json()).slice(0, 3);

			grid.innerHTML = flights.length
				? flights.map((f) => `<div class="fa-flight-card"><div class="fa-flight-number">${esc(f.flightNumber)}</div><div class="fa-flight-route"><span class="fa-flight-airport">${esc(f.originAirportCode || f.origin)}</span><span class="fa-flight-arrow">&rarr;</span><span class="fa-flight-airport">${esc(f.destinationAirportCode || f.destination)}</span></div><div class="fa-flight-times">${esc(f.departureTime)} – ${esc(f.arrivalTime)}</div><div class="fa-flight-meta"><span class="fa-badge fa-badge--${String(f.status).toLowerCase().replace(/[^a-z]/g, '')}">${esc(f.status)}</span>${f.delayMinutes ? '<br>+' + esc(f.delayMinutes) + ' min' : ''}</div></div>`).join('')
				: '<div class="fa-empty-state"><div class="fa-empty-state__icon">&#128680;</div><div class="fa-empty-state__title">No flights found</div><div class="fa-empty-state__subtitle">No upcoming flights match your criteria.</div></div>';
		} catch (e) {
			grid.textContent = 'Error: ' + e.message;
		}
	}
}

if (!customElements.get('flight-status-home')) {
	customElements.define('flight-status-home', FlightStatusHome);
}
