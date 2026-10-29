class FlightStatusFrontend extends HTMLElement {
	connectedCallback() {
		this.innerHTML =
			'<div class="fs-app"><div class="fs-header"><h2>Flight Status</h2>' +
			'<button class="fs-refresh" type="button">Refresh</button></div>' +
			'<div class="fs-msg">Loading...</div><div class="fs-list"></div></div>';
		this.querySelector('.fs-refresh').addEventListener('click', () => this.load());
		this.load();
	}

	async load() {
		const msg = this.querySelector('.fs-msg');
		const list = this.querySelector('.fs-list');
		const fetchFn = window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch;
		const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
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
				list.innerHTML = '';
				return;
			}

			list.innerHTML = flights
				.map((f) => {
					const cls = String(f.status).toLowerCase().replace(/[^a-z]/g, '');
					return `<div class="fs-card"><div class="fs-num">${esc(f.flightNumber)}</div>` +
						`<div><div class="fs-route"><span>${code(f.originAirportId)}</span><span class="fs-arrow">&rarr;</span><span>${code(f.destinationAirportId)}</span></div>` +
						`<div class="fs-times">${fmt(f.departureTime)} &ndash; ${fmt(f.arrivalTime)}</div></div>` +
						`<div><span class="fs-badge ${cls}">${esc(f.status)}</span>` +
						(f.delayMinutes ? `<span class="fs-delay">+${esc(f.delayMinutes)} min</span>` : '') + '</div></div>';
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
