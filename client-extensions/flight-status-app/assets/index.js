const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);
const SITE_ID = () => Liferay.ThemeDisplay.getScopeGroupId();

const ROUTES = [
	{path: 'home', slug: 'home', label: 'Home'},
	{path: 'flights', slug: 'flight-status', group: 'Flights', label: 'Flight Status'},
	{path: 'search', slug: 'search', group: 'Flights', label: 'Search'},
	{path: 'airports', slug: 'airports', group: 'Airports', label: 'Airports', help: ['To and from the airport', 'Taxi, bus, train and parking for each airport', 'building']},
	{path: 'gates', slug: 'gates', group: 'Airports', label: 'Gates'},
	{path: 'live', slug: 'live-map', label: 'Live Map'},
	{path: 'board', slug: 'airport-board', group: 'Flights', label: 'Airport Board'},
	{path: 'boarding', slug: 'boarding-pass', label: 'Boarding Pass', auth: true, menu: true, help: ['Special assistance', 'Ask for a wheelchair or help with luggage on your boarding pass', 'users']},
	{path: 'ontime', slug: 'on-time-performance', group: 'Flights', label: 'On-time'},
	{path: 'alerts', slug: 'my-alerts', label: 'My Alerts', auth: true, menu: true},
	{path: 'login', slug: 'login', label: 'Login', hidden: true},
	{path: 'register', slug: 'register', label: 'Register', hidden: true},
	{path: 'admin', slug: 'admin', label: 'Admin', hidden: true},
];

const ICONS = {
	plane: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
	search: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
	building: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>',
	gate: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r="1"/></svg>',
	clock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
	bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
	grid: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
	ticket: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M13 6v12" stroke-dasharray="2 2"/></svg>',
	users: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/></svg>',
	map: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><path d="M8 2v16M16 6v16"/></svg>',
	out: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
	scan: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></svg>',
	shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
};

const parseDate = (v) => {
	let str = String(v).replace(' ', 'T').replace(/\.0$/, '');
	if (!/(Z|[+-]\d\d:?\d\d)$/.test(str)) str += 'Z';
	const d = new Date(str);
	return isNaN(d) ? null : d;
};
const fmtTime = (v) => {
	const d = parseDate(v);
	return d ? d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : esc(v);
};
const fmtDate = (v) => {
	const d = parseDate(v);
	return d ? d.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}) : '';
};
const kindOf = (f, ap) => {
	const o = ap[f.originAirportId], d = ap[f.destinationAirportId];
	return o && d && o.country && o.country === d.country ? 'Domestic' : 'International';
};
const AIRLINES = [['6E', 'IndiGo'], ['AI', 'Air India'], ['IX', 'Air India Express'], ['QP', 'Akasa Air'], ['SG', 'SpiceJet'], ['UK', 'Vistara'], ['EK', 'Emirates'], ['QR', 'Qatar Airways'], ['EY', 'Etihad Airways'],
	['SQ', 'Singapore Airlines'], ['LH', 'Lufthansa'], ['BA', 'British Airways'], ['AF', 'Air France'], ['KL', 'KLM'], ['TK', 'Turkish Airlines'], ['QF', 'Qantas'], ['DL', 'Delta Air Lines'], ['UA', 'United Airlines'], ['AA', 'American Airlines']];
const airlineOf = (flightNumber, airline) => airline || (AIRLINES.find((a) => String(flightNumber).toUpperCase().startsWith(a[0])) || ['', ''])[1];
// Photos are never stored in the code: city pictures come from Wikipedia when the page opens,
// airline logos from a public logo service, and aircraft photos from Planespotters.
const photoCache = {};
const cityPhoto = (city, country) => {
	const key = city + '|' + country;
	if (!photoCache[key]) {
		photoCache[key] = (async () => {
			try {
				const saved = sessionStorage.getItem('faPhoto:' + key);
				if (saved !== null) return saved;
			} catch (e) {}
			let url = '';
			try {
				const title = (city === 'New York' ? 'New York City' : city).replace(/ /g, '_');
				const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
				if (res.ok) {
					const d = await res.json(), src = d.thumbnail && d.thumbnail.source;
					if (src && d.type === 'standard' && !/Flag_of|\.svg/i.test(src)) url = src.replace(/\/\d+px-/, '/960px-');
				}
			} catch (e) {}
			if (!url) {
				try {
					const res = await fetch('https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(city + ' skyline') + '&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=960&format=json&origin=*');
					const pages = Object.values(((await res.json()).query || {}).pages || {}).sort((a, b) => a.index - b.index);
					const hit = pages.find((pg) => pg.thumbnail && !/Flag_of|\.svg/i.test(pg.thumbnail.source));
					if (hit) url = hit.thumbnail.source;
				} catch (e) {}
			}
			try { sessionStorage.setItem('faPhoto:' + key, url); } catch (e) {}
			return url;
		})();
	}
	return photoCache[key];
};
// Aviation photos saved in assets/hero (credits: Wikimedia Commons). One is picked at random on each page load, never the same one twice in a row.
const HERO_PHOTOS = [
	['1.jpg', 'Jordi Cucurull', 'CC BY-SA 2.0'], ['2.jpg', 'Harry Knight', 'CC0'], ['3.jpg', 'Bahnfrend', 'CC BY-SA 4.0'], ['4.jpg', 'SuFlyer', 'CC0'],
	['5.jpg', 'Timothy A. Gonsalves', 'CC BY-SA 4.0'], ['6.jpg', 'Timothy A. Gonsalves', 'CC BY-SA 4.0'], ['7.jpg', 'Biswarup Ganguly', 'CC BY 3.0'], ['8.jpg', 'Sunnya343', 'CC BY-SA 4.0'],
	['9.jpg', 'Apurba Biswas', 'CC0'], ['10.jpg', 'ANKAN', 'CC BY-SA 4.0'], ['11.jpg', 'Josekuttypanackal', 'CC BY 3.0'], ['12.jpg', 'Krish Aarush', 'CC BY-SA 4.0'],
	['13.jpg', 'iMahesh', 'CC BY-SA 4.0'], ['14.jpg', 'Wolfgang Moroder', 'CC BY-SA 3.0'], ['15.jpg', 'Bernard Gagnon', 'CC BY 4.0'], ['16.jpg', 'The Cosmonaut', 'CC BY-SA 2.5'],
	['17.jpg', 'Diliff', 'CC BY-SA 3.0'], ['18.jpg', 'Diego Delso', 'CC BY-SA 4.0'], ['19.jpg', 'Johannes Groll', 'CC0'], ['20.jpg', 'Anna Tsolidou', 'CC BY-SA 4.0'],
	['21.jpg', 'Sam Ferrara', 'CC0'], ['22.jpg', 'Martin Falbisoner', 'CC BY-SA 4.0'], ['23.jpg', 'Basile Morin', 'CC BY-SA 4.0'], ['24.jpg', 'Wilfredor', 'CC0'],
	['25.jpg', 'Pierre Blaché', 'CC0'], ['26.jpg', 'Vyacheslav Argenberg', 'CC BY 4.0'],
];
// The pictures for the login and register pages (files in assets/hero, listed above): 3 aircraft and 2 airports.
const AUTH_PHOTOS = ['1.jpg', '3.jpg', '7.jpg', '8.jpg', '9.jpg'];
const HERO = (() => {
	let i = Math.floor(Math.random() * HERO_PHOTOS.length);
	try {
		if (i === Number(sessionStorage.getItem('faHero'))) i = (i + 1) % HERO_PHOTOS.length;
		sessionStorage.setItem('faHero', i);
	} catch (e) {}
	return HERO_PHOTOS[i];
})();
const heroBg = (overlay) => overlay + ',url("/o/flight-status-app/hero/' + HERO[0] + '")';
const showPhoto = (el, city, country, overlay) => cityPhoto(city, country).then((url) => {
	if (url && el.isConnected) {
		el.style.backgroundImage = (overlay ? overlay + ',' : '') + 'url("' + url + '")';
		el.classList.add('has-photo');
	}
});
const fillPhotos = (root) => root.querySelectorAll('[data-hero]').forEach((el) => { el.style.backgroundImage = heroBg(el.dataset.photoOverlay); el.classList.add('has-photo'); });
const fillCityPhotos = (root) => root.querySelectorAll('[data-photo-city]').forEach((el) => showPhoto(el, el.dataset.photoCity, el.dataset.photoCountry || '', el.dataset.photoOverlay || ''));
const fillAllPhotos = (root) => { fillPhotos(root); fillCityPhotos(root); };
const logoHtml = (flightNumber, airline, cls) => {
	const a = AIRLINES.find((x) => x[1] === airline) || AIRLINES.find((x) => String(flightNumber).toUpperCase().startsWith(x[0]));
	return a ? `<img class="fa-airlogo ${cls || ''}" alt="" src="https://pics.avs.io/120/120/${a[0]}.png">` : '';
};
const CLASS_LABEL = {First: 'First Class', Business: 'Business Class', Economy: 'Economy Class'};
const CLASS_ROWS = {First: [1, 2], Business: [3, 6], Economy: [7, 20]};
// Add-ons (the server works out the real price): [code, label, rupees]
const BAGGAGE = [['0', 'No extra baggage', 0], ['10', '+10 kg', 800], ['20', '+20 kg', 1500], ['30', '+30 kg', 2000]];
const MEALS = [['', 'No meal', 0], ['veg', 'Vegetarian meal', 250], ['nonveg', 'Non-vegetarian meal', 300], ['snack', 'Snack box', 150]];
const addOnText = (bag, meal) => [bag && bag !== '0' && bag !== 'null' ? 'Extra baggage +' + bag + ' kg' : '', (MEALS.find((m) => m[0] === meal && meal) || [])[1] || ''].filter(Boolean).join(' \u00b7 ');
const seatSvg = (c) => '<svg class="fa-sv ' + c + '" viewBox="0 0 24 24" aria-hidden="true"><rect class="bk" x="4" y="2" width="16" height="13" rx="4"/><rect class="cs" x="2" y="17" width="20" height="5" rx="2.5"/><rect class="gl" x="7" y="4" width="10" height="3.5" rx="1.75"/></svg>';
// Extra fee in rupees (the server works out the real price): first row of a class = legroom, A/F window, C/D aisle
const seatFee = (id) => { const r = parseInt(id, 10), c = id.slice(-1); return [1, 3, 7].includes(r) ? 500 : 'AF'.includes(c) ? 300 : 'CD'.includes(c) ? 200 : 0; };
const classOf = (v) => (CLASS_LABEL[v] ? v : 'Economy');
const statusClass = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

const showRoute = (r) => !r.hidden && !r.menu && (!r.auth || Liferay.ThemeDisplay.isSignedIn());

const pageInfo = () => {
	const parts = location.pathname.replace(/\/$/, '').split('/');
	const route = ROUTES.find((r) => r.slug === parts[parts.length - 1]);
	return {route: route ? route.path : 'home', root: (route ? parts.slice(0, -1) : parts).join('/')};
};

class FlightStatusApp extends HTMLElement {
	connectedCallback() {
		// A logo that cannot be loaded is replaced by the plane icon.
		this.addEventListener('error', (e) => {
			if (e.target.classList && e.target.classList.contains('fa-airlogo')) {
				const icon = document.createElement('span');
				icon.className = 'fa-ico sm';
				icon.innerHTML = ICONS.plane;
				e.target.replaceWith(icon);
			}
		}, true);
		this.route();
	}

	fitToControlMenu() {
		const apply = () => {
			const bar = document.querySelector('.control-menu, #ControlMenu, [class*="control-menu-level-1"]');
			const h = bar ? bar.getBoundingClientRect().height : 0;
			if (h > 0) this.style.setProperty('--fa-top', Math.round(bar.getBoundingClientRect().bottom) + 'px');
		};
		apply();
		window.addEventListener('load', apply, {once: true});
		[300, 1000, 2500].forEach((ms) => setTimeout(apply, ms));
	}

	disconnectedCallback() {
		clearInterval(this._timer);
	}

	async json(url) {
		const res = await getFetch()(url, {credentials: 'include'});
		if (!res.ok) throw new Error('HTTP ' + res.status);
		return res.json();
	}

	async loadFlightAlerts() {
		this._followingFlights = new Set();

		if (Liferay.ThemeDisplay.isSignedIn()) {
			const ids = await this.json('/o/flight-alerts/subscriptions');

			this._followingFlights = new Set(ids.map(String));
		}
	}

	// Search box above a list: hides the rows or cards that do not match while you type, and stays applied when the page refreshes itself.
	// With opts.table it also sorts by a clicked column header and shows the rows a page at a time.
	setupFilter(view, opts) {
		if (this._filterKey !== opts.key) { this._filterKey = opts.key; this._filterText = ''; this._sort = null; this._page = 1; }
		view._filterOpts = opts;
		if (view._filterBound) return view._filterApply();
		view._filterBound = true;
		const value = (row, col) => { const c = row.children[col], v = c && c.querySelector('[data-v]'); return v ? v.dataset.v : (c ? c.textContent.trim() : ''); };
		const compare = (x, y) => (/^-?\d/.test(x) && /^-?\d/.test(y)) ? parseFloat(x) - parseFloat(y) : x.localeCompare(y);
		const apply = view._filterApply = () => {
			const o = view._filterOpts, items = view.querySelectorAll(o.items);
			observer.disconnect();
			let bar = view.querySelector('.fa-filterbar');
			const title = view.querySelector('.fa-title');
			if (items.length && !bar && title) {
				title.insertAdjacentHTML('afterend', '<div class="fa-filterbar"><input class="fa-filter" type="search" autocomplete="off" /><span class="fa-filtercount"></span><span class="fa-pager"></span></div><div class="fa-msg fa-filterempty" hidden>Nothing matches your search.</div>');
				bar = view.querySelector('.fa-filterbar');
			}
			if (bar) {
				const box = bar.querySelector('input'), text = this._filterText || '', q = text.trim().toLowerCase();
				box.placeholder = o.placeholder;
				if (box.value !== text) box.value = text;
				if (this._filterFocus && document.activeElement !== box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
				let list = [...items];
				if (o.table) {
					list.forEach((r, i) => { if (r._i === undefined) r._i = i; });
					const sort = this._sort;
					list.sort((x, y) => sort ? compare(value(x, sort.col), value(y, sort.col)) * sort.dir : x._i - y._i);
					const body = list[0] && list[0].parentNode;
					if (body) list.forEach((r) => body.appendChild(r));
					view.querySelectorAll('.fa-table thead th').forEach((th, i) => { th.classList.toggle('sortable', !!th.textContent.trim()); th.classList.toggle('asc', !!sort && sort.col === i && sort.dir > 0); th.classList.toggle('desc', !!sort && sort.col === i && sort.dir < 0); });
				}
				const match = list.filter((el) => !q || el.textContent.toLowerCase().includes(q));
				const size = this._pageSize || 25, pages = Math.max(1, Math.ceil(match.length / size));
				if ((this._page || 1) > pages) this._page = pages;
				const page = this._page || 1, shownRows = o.table ? match.slice((page - 1) * size, page * size) : match;
				list.forEach((el) => { el.hidden = true; });
				shownRows.forEach((el) => { el.hidden = false; });
				bar.querySelector('.fa-filtercount').textContent = q ? 'Showing ' + match.length + ' of ' + items.length : '';
				bar.querySelector('.fa-pager').innerHTML = (o.table && items.length > 10)
					? '<select class="fa-pagesize" aria-label="Rows per page">' + [10, 25, 50, 100].map((n) => '<option' + (n === size ? ' selected' : '') + '>' + n + '</option>').join('') + '</select> per page ' +
						'<button type="button" class="fa-pageprev" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Previous page">&lsaquo;</button> ' + (match.length ? (page - 1) * size + 1 : 0) + '&ndash;' + Math.min(page * size, match.length) + ' of ' + match.length +
						' <button type="button" class="fa-pagenext" ' + (page >= pages ? 'disabled' : '') + ' aria-label="Next page">&rsaquo;</button>' : '';
				view.querySelector('.fa-filterempty').hidden = !(q && !match.length);
				view.querySelectorAll('.fa-chipstrip .fa-chip').forEach((c) => c.classList.toggle('active', c.dataset.q.toLowerCase() === q));
			}
			observer.observe(view, {childList: true, subtree: true});
		};
		const observer = new MutationObserver(apply);
		view.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('fa-filter')) { this._filterText = e.target.value; this._filterFocus = true; this._page = 1; apply(); } });
		view.addEventListener('change', (e) => { if (e.target.classList && e.target.classList.contains('fa-pagesize')) { this._pageSize = Number(e.target.value); this._page = 1; apply(); } });
		view.addEventListener('click', (e) => {
			const t = e.target.closest ? e.target : e.target.parentElement;
			const chip = t.closest('.fa-chipstrip .fa-chip'), th = t.closest('.fa-table thead th'), nav = t.closest('.fa-pageprev, .fa-pagenext');
			if (chip) { this._filterText = chip.dataset.q; this._filterFocus = false; this._page = 1; apply(); }
			else if (nav) { this._page = (this._page || 1) + (nav.classList.contains('fa-pagenext') ? 1 : -1); apply(); }
			else if (th && view._filterOpts.table && th.textContent.trim()) {
				const col = [...th.parentNode.children].indexOf(th);
				this._sort = (this._sort && this._sort.col === col) ? {col, dir: -this._sort.dir} : {col, dir: 1};
				this._page = 1;
				apply();
			}
		});
		view.addEventListener('pointerdown', (e) => { if (!(e.target.closest && e.target.closest('.fa-filterbar'))) this._filterFocus = false; });
		apply();
	}

	// A small "are you sure" box that replaces the browser's confirm dialog.
	confirmBox(text) {
		return new Promise((resolve) => {
			const el = document.createElement('div');
			el.className = 'fa-confirm';
			el.tabIndex = -1;
			el.innerHTML = '<div class="fa-confirmbox" role="dialog" aria-modal="true"><h3>Are you sure?</h3><p>' + esc(text) + '</p><div class="fa-confirmbtns"><button type="button" class="fa-chip" data-r="0">Cancel</button><button type="button" class="fa-btn danger" data-r="1">Delete</button></div></div>';
			const done = (v) => { el.remove(); resolve(v); };
			el.addEventListener('click', (e) => { const r = e.target.closest('[data-r]'); if (r) done(r.dataset.r === '1'); else if (e.target === el) done(false); });
			el.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(false); });
			this.appendChild(el);
			el.querySelector('[data-r="0"]').focus();
		});
	}

	bindFlightAlerts(view) {
		if (view.dataset.flightAlertsBound) return;
		view.dataset.flightAlertsBound = 'true';
		view.addEventListener('click', async (event) => {
			const button = event.target instanceof Element ? event.target.closest('.fa-alert-toggle') : null;
			if (!button || !view.contains(button)) return;
			const flightId = button.dataset.flightId;
			const following = !this._followingFlights.has(flightId);
			button.disabled = true;
			try {
				const response = await getFetch()('/o/flight-alerts/subscriptions', {
					method: 'POST',
					credentials: 'include',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({flightId: Number(flightId), following}),
				});
				if (!response.ok) {
					let message = 'HTTP ' + response.status;
					try {
						const error = await response.json();
						if (error.error) message = error.error;
					} catch (e) {}
					throw new Error(message);
				}
				const result = await response.json();
				if (result.following) this._followingFlights.add(flightId);
				else this._followingFlights.delete(flightId);
				view.querySelectorAll('.fa-alert-toggle[data-flight-id="' + flightId + '"]').forEach((item) => {
					item.textContent = result.following ? 'Following' : 'Get email alerts';
					item.setAttribute('aria-pressed', String(result.following));
				});
				if (!result.following && this._currentRoute === 'alerts') {
					button.closest('.fa-row').remove();
				}
			} catch (error) {
				let message = view.querySelector('.fa-alert-message');
				if (!message) {
					message = document.createElement('p');
					message.className = 'fa-alert-message';
					view.prepend(message);
				}
				message.textContent = 'Could not update flight alert: ' + error.message;
			} finally {
				button.disabled = false;
			}
		});
	}

	// `all` also returns the flights the admin typed in (hidden from the public lists when PUBLIC_FLIGHTS=live); the boarding pass page needs them for existing bookings.
	async flights(all) {
		const items = await this.json('/o/flight-live/flights?siteId=' + SITE_ID() + (all ? '&all=true' : ''));
		return items.map((f) => ({
			id: f.id,
			flightNumber: f.flightNumber,
			airline: airlineOf(f.flightNumber, f.airline),
			status: f.showstatus,
			departureTime: f.departureTime,
			arrivalTime: f.arrivalTime,
			delayMinutes: f.delayMinutes || 0,
			originAirportId: f.originAirportId,
			destinationAirportId: f.destinationAirportId,
			gateId: f.gateId,
			scheduledDeparture: f.scheduledDeparture,
			scheduledArrival: f.scheduledArrival,
			depTerminal: f.depTerminal && f.depTerminal !== 'null' ? f.depTerminal : '',
			arrTerminal: f.arrTerminal && f.arrTerminal !== 'null' ? f.arrTerminal : '',
			depGate: f.depGate && f.depGate !== 'null' ? f.depGate : '',
			arrGate: f.arrGate && f.arrGate !== 'null' ? f.arrGate : '',
			source: f.source,
		})).sort((x, y) => {
			// Flights from 6 hours ago onwards come first (soonest first); older flights come after (most recent first).
			const limit = Date.now() - 6 * 3600000, a = (parseDate(x.departureTime) || 0).valueOf(), b = (parseDate(y.departureTime) || 0).valueOf();
			return (a >= limit) !== (b >= limit) ? (a >= limit ? -1 : 1) : (a >= limit ? a - b : b - a);
		});
	}

	async airports() {
		if (!this._airports) {
			const items = await this.json('/o/flight-live/airports');
			this._airports = Object.fromEntries(items.map((a) => [a.id, a]));
		}
		return this._airports;
	}

	async route() {
		const {route: current, root} = pageInfo();
		this._root = root;
		this._currentRoute = current;
		const editing = /[?&]p_l_mode=edit/.test(location.search) || !!document.querySelector('.page-editor, .page-editor__toolbar, .control-menu-level-2, [class*="page-editor"]') || document.body.classList.contains('has-edit-mode-menu');
		this.classList.toggle('fa-editing', editing);
		this.fitToControlMenu();
		const params = new URLSearchParams(location.search);
		const q = params.get('q') || '';

		const admin = await this.isAdmin();
		this._isAdmin = admin;
		let viewingSite = false;
		try {
			if (params.get('viewsite') === '1') sessionStorage.setItem('faViewSite', '1');
			if (current === 'admin') sessionStorage.removeItem('faViewSite');
			viewingSite = sessionStorage.getItem('faViewSite') === '1';
		} catch (e) {}

		// Administrators live in the admin area unless they chose "View site".
		if (admin && !viewingSite && current !== 'admin' && current !== 'live' && !editing) {
			location.replace(root + '/admin');
			return;
		}

		if (params.get('flightTicket')) { params.delete('flightTicket'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '')); }
		try {
			const phone = sessionStorage.getItem('faPendingPhone');
			if (phone && Liferay.ThemeDisplay.isSignedIn()) {
				sessionStorage.removeItem('faPendingPhone');
				getFetch()('/o/flight-auth/phone', {method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({phone})}).catch(() => {});
			}
		} catch (e) {}
		const adminMode = admin && !viewingSite;
		const tab = params.get('tab') || 'dashboard';
		this._adminTab = tab;
		const sidebarMode = adminMode && current === 'admin';
		const links = sidebarMode ? '' : adminMode
			? [['dashboard', 'Dashboard'], ['flights', 'Flights'], ['airports', 'Airports'], ['gates', 'Gates'], ['reservations', 'Reservations']]
				.map((t) => `<a href="${root}/admin?tab=${t[0]}" class="${current === 'admin' && tab === t[0] ? 'active' : ''}">${t[1]}</a>`).join('') +
				`<a href="${root}/live-map" class="${current === 'live' ? 'active' : ''}">Live Map</a>` +
				`<a class="fa-auth" href="${root}/home?viewsite=1">View site</a>`
			: this.navLinks(root, current);

		const crumbLabel = (ROUTES.find((r) => r.path === current) || {}).label;
		const crumbs = (!adminMode && crumbLabel && !['home', 'login', 'register'].includes(current))
			? '<nav class="fa-crumbs" aria-label="Breadcrumb"><a href="' + root + '/home">Home</a><span>&rsaquo;</span><b>' + esc(crumbLabel) + '</b></nav>' : '';

		const sideItems = [['dashboard', 'Dashboard', 'grid'], ['flights', 'Flights', 'plane'], ['airports', 'Airports', 'building'], ['gates', 'Gates', 'gate'], ['bookings', 'Bookings', 'ticket'], ['reservations', 'Reservations', 'users'], ['gate', 'Gate scan', 'scan'], ['track', 'Track flight', 'search'], ['assistance', 'Assistance', 'users'], ['notices', 'Notices', 'bell'], ['guides', 'Airport guide', 'map'], ['terminals', 'Terminals', 'building'], ['pickups', 'Pick-up points', 'gate'], ['helpoptions', 'Help options', 'shield']];
		const sidebar = sidebarMode ? '<aside class="fa-sidebar"><nav>' + sideItems.map((t) => `<a href="${root}/admin?tab=${t[0]}" class="${tab === t[0] ? 'active' : ''}">${ICONS[t[2]]}<span>${t[1]}</span></a>`).join('') +
			`<a href="${root}/live-map">${ICONS.map}<span>Live Map</span></a><a class="fa-sideout" href="${root}/home?viewsite=1">${ICONS.out}<span>View site</span></a></nav></aside>` : '';
		this.classList.toggle('has-sidebar', sidebarMode);
		this.innerHTML =
			'<header class="fa-header"><div class="fa-header__inner"><a class="fa-brand" href="' + root + (adminMode ? '/admin' : '/home') + '"><span class="fa-brand__logo">' + ICONS.plane + '</span>Flight Status <b>' + (adminMode ? 'Admin' : 'Portal') + '</b></a>' +
			'<button class="fa-burger" type="button" aria-label="Menu">&#9776;</button>' +
			'<nav class="fa-nav-links">' + links + this.authLinks(root, current) + '</nav></div></header>' +
			crumbs + '<div class="fa-container">' +
			(sidebarMode ? '' : '<div class="fa-alerts' + (crumbs ? '' : ' first') + '" hidden></div>') +
			(sidebarMode ? '<div class="fa-adminshell"><aside class="fa-sidebar"><nav>' + sideItems.map((t) => `<a href="${root}/admin?tab=${t[0]}" class="${tab === t[0] ? 'active' : ''}">${ICONS[t[2]]}<span>${t[1]}</span></a>`).join('') +
			`<a href="${root}/live-map">${ICONS.map}<span>Live Map</span></a><a class="fa-sideout" href="${root}/home?viewsite=1">${ICONS.out}<span>View site</span></a></nav></aside>` : '') +
			'<main class="fa-view"><div class="fa-skel"><i></i><i></i><i></i></div></main>' +
			(sidebarMode ? '</div>' : '') +
			'</div>' +
			'<footer class="fa-footer"><div class="fa-footer__inner">' +
			(adminMode
				? '<div class="fa-footer__brand">&copy; ' + new Date().getFullYear() + ' Flight Status Portal</div><div class="fa-footer__links"><span>Admin Portal</span>' + this.legalLinks() + '</div>'
				: '<div class="fa-footer__brand">Flight Status Portal</div>' + this.footerHtml(root)) +
			'</div></footer>';
		this.classList.toggle('has-bigfooter', !adminMode);
		this.classList.toggle('has-crumbs', !!crumbs);
		this.loadNotices();

		this.querySelector('.fa-burger').addEventListener('click', (e) => {
			const open = this.querySelector('.fa-nav-links').classList.toggle('fa-nav-links--open');
			e.currentTarget.setAttribute('aria-expanded', String(open));
		});
		this.bindShell();

		const view = this.querySelector('.fa-view');
		if (this._viewObserver) this._viewObserver.disconnect();
		this._viewObserver = new MutationObserver(() => this.enhance(view));
		this._viewObserver.observe(view, {childList: true});
		this['view_' + current](view, q).then(() => this.enhance(view)).catch((e) => (view.innerHTML = `<div class="fa-msg">Error: ${esc(e.message)}</div>`));
	}

	async getLive() {
		const now = Date.now();
		if (!this._live || now - this._live.at > 20000) {
			let list = [];
			try { list = await this.json('/o/flight-live/aircraft'); } catch (e) {}
			this._live = {at: now, list};
		}
		return this._live.list;
	}

	sidePanel(flights, ap) {
		const late = flights.filter((f) => Number(f.delayMinutes) > 0 || statusClass(f.status) === 'delayed')
			.sort((a, b) => (Number(b.delayMinutes) || 0) - (Number(a.delayMinutes) || 0)).slice(0, 5);
		const r = this._root;
		return '<aside class="fa-aside">' +
			'<section class="fa-panel"><h3>Delays right now</h3>' + (late.length ? late.map((f) => {
				const o = ap[f.originAirportId] || {}, d = ap[f.destinationAirportId] || {};
				return `<div class="fa-late"><div><b>${esc(f.flightNumber)}</b><span>${esc(o.code || '?')} &rarr; ${esc(d.code || '?')}</span></div><em>${Number(f.delayMinutes) > 0 ? '+' + esc(f.delayMinutes) + ' min' : esc(f.status)}</em></div>`;
			}).join('') : '<p class="fa-panelnote">No delays at the moment.</p>') + '</section>' +
			'<section class="fa-panel"><h3>Aircraft in the air</h3><div class="fa-minimap"></div><p class="fa-panelnote fa-minimeta">Loading live aircraft...</p><a class="fa-panellink" href="' + r + '/live-map">Open the live map &rarr;</a></section>' +
			'<section class="fa-panel"><h3>Quick links</h3><a class="fa-panellink" href="' + r + '/airport-board">Airport departures and arrivals &rarr;</a><a class="fa-panellink" href="' + r + '/on-time-performance">On-time performance &rarr;</a><a class="fa-panellink" href="' + r + '/search">Search by route and date &rarr;</a></section></aside>';
	}

	// A small, non-interactive map of the aircraft over India. Used on Home and next to the flight lists.
	async bindMiniMaps(root) {
		const boxes = Array.from(root.querySelectorAll('.fa-minimap')).filter((el) => !el._leaflet_id);
		if (!boxes.length) return;
		try { await this.loadLeaflet(); } catch (e) { return; }
		const live = await this.getLive();
		const air = live.filter((a) => !a.onGround);
		const alt = air.length ? Math.round(air.reduce((t, a) => t + (Number(a.altitude) || 0), 0) / air.length) : 0;
		root.querySelectorAll('[data-live="air"]').forEach((el) => (el.textContent = air.length.toLocaleString()));
		root.querySelectorAll('[data-live="alt"]').forEach((el) => (el.textContent = alt.toLocaleString() + ' ft'));
		root.querySelectorAll('[data-live="ground"]').forEach((el) => (el.textContent = (live.length - air.length).toLocaleString()));
		root.querySelectorAll('.fa-minimeta').forEach((el) => (el.textContent = air.length ? air.length + ' aircraft in the air over India right now.' : 'Live aircraft are not available right now.'));
		boxes.forEach((el) => {
			if (!el.isConnected || el._leaflet_id) return;
			const map = L.map(el, {zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false}).setView([22.5, 80], el.classList.contains('tall') ? 5 : 4);
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 8}).addTo(map);
			air.forEach((a) => L.circleMarker([a.lat, a.lon], {radius: 3.2, color: '#fff', weight: 1, fillColor: '#0b5fff', fillOpacity: .95}).addTo(map));
		});
	}

	// Fade sections in as they scroll into view, count numbers up, and put a photo on page banners.
	enhance(view) {
		const banner = view.querySelector('.fa-title:not([data-pb])');
		if (banner) {
			banner.dataset.pb = '1';
			const topics = {flights: 'Airliner', search: 'Air travel', airports: 'Airport', gates: 'Airport terminal', live: 'Air traffic control', ontime: 'Airline', board: 'Airport terminal'};
			const topic = topics[this._currentRoute];
			if (topic) { banner.style.backgroundImage = heroBg('linear-gradient(90deg, rgba(15,30,80,.9) 0%, rgba(15,30,80,.6) 55%, rgba(15,30,80,.22) 100%)'); banner.classList.add('has-photo'); }
		}
		const items = view.querySelectorAll('.fa-reveal:not([data-seen])');
		if (!items.length) return;
		if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			items.forEach((el) => { el.dataset.seen = '1'; el.classList.add('in'); this.countUp(el, true); });
			return;
		}
		const io = new IntersectionObserver((entries) => entries.forEach((en) => {
			if (!en.isIntersecting) return;
			en.target.classList.add('in');
			this.countUp(en.target);
			io.unobserve(en.target);
		}), {threshold: .12});
		items.forEach((el) => { el.dataset.seen = '1'; io.observe(el); });
	}

	countUp(root, instant) {
		root.querySelectorAll('[data-count]').forEach((el) => {
			const target = Number(el.dataset.count), suffix = el.dataset.suffix || '';
			if (instant || !target) { el.textContent = target + suffix; return; }
			const start = performance.now(), dur = 1100;
			const tick = (now) => {
				const t = Math.min(1, (now - start) / dur);
				el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
				if (t < 1) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
	}

	// The bell: unread count, a list of flight changes, and a pop-up for news that arrived since the last visit.
	bindBell(btn, panel) {
		const badge = btn.querySelector('.fa-bellcount');
		const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
		let seenTop = null;
		try { seenTop = sessionStorage.getItem('faNoteTop'); } catch (e) {}
		const load = async () => {
			let list;
			try { list = await this.json('/o/flight-alerts/notifications'); } catch (e) { return; }
			const unread = list.filter((n) => !n.seen);
			badge.textContent = unread.length > 9 ? '9+' : unread.length;
			badge.hidden = !unread.length;
			panel.innerHTML = '<div class="fa-notehead"><b>Notifications</b><button type="button" class="fa-markall">Mark all as read</button></div>' +
				(list.length ? list.map((n) => `<a class="fa-note ${n.seen ? '' : 'new'}" href="${this._root}/flight-status"><b>${esc(n.flightNumber)}</b><span>${esc(n.message.replace(/ -> /g, ' → '))}</span><small>${ago(n.time)}</small></a>`).join('') : '<p class="fa-panelnote">No notifications yet.</p>');
			panel.querySelector('.fa-markall').addEventListener('click', async () => { await getFetch()('/o/flight-alerts/notifications/read', {method: 'POST', credentials: 'include'}); load(); });
			const top = list.reduce((m, n) => Math.max(m, n.id), 0);
			const fresh = unread.filter((n) => seenTop !== null && n.id > Number(seenTop));
			if (fresh.length) this.toast('<b>' + esc(fresh[0].flightNumber) + '</b> ' + esc(fresh[0].message.replace(/ -> /g, ' → ')) + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' more)' : ''));
			if (top) { seenTop = String(Math.max(Number(seenTop || 0), top)); try { sessionStorage.setItem('faNoteTop', seenTop); } catch (e) {} }
		};
		btn.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
		panel.addEventListener('click', (e) => e.stopPropagation());
		document.addEventListener('click', () => { panel.hidden = true; });
		clearInterval(this._bellTimer);
		this._bellTimer = setInterval(load, 30000);
		document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
		load();
	}

	toast(html) {
		const t = document.createElement('div');
		t.className = 'fa-toast';
		t.innerHTML = '<span>' + ICONS.bell + '</span><div>' + html + '</div>';
		this.appendChild(t);
		setTimeout(() => t.remove(), 8000);
	}

	// The menu: pages with a group (see ROUTES) share one drop-down; the others are plain links.
	navLinks(root, current) {
		const routes = ROUTES.filter(showRoute);
		const link = (r) => `<a href="${root}/${r.slug}" class="fa-nav-link ${r.path === current ? 'active' : ''}">${r.label}</a>`;
		const shown = new Set();
		return routes.map((r) => {
			if (!r.group) return link(r);
			if (shown.has(r.group)) return '';
			shown.add(r.group);
			const members = routes.filter((x) => x.group === r.group);
			return `<div class="fa-drop ${members.some((m) => m.path === current) ? 'active' : ''}"><button type="button" class="fa-dropbtn" aria-haspopup="true">${esc(r.group)} <span>&#9662;</span></button><div class="fa-dropmenu">${members.map(link).join('')}</div></div>`;
		}).join('') + this.helpMenu(root, routes, current);
	}

	// A "Help" drop-down with every page in ROUTES that has a `help` entry (the same ones as the Home page cards).
	helpMenu(root, routes, current) {
		const helps = ROUTES.filter((r) => r.help);
		if (!helps.length) return '';
		return `<div class="fa-drop ${helps.some((r) => r.path === current && !r.group) ? 'active' : ''}"><button type="button" class="fa-dropbtn" aria-haspopup="true">Help <span>&#9662;</span></button><div class="fa-dropmenu">${helps.map((r) => `<a href="${root}/${r.slug}">${esc(r.help[0])}</a>`).join('')}</div></div>`;
	}

	legalLinks() {
		return ['privacy', 'terms', 'cookies'].map((k) => `<button type="button" class="fa-legal" data-legal="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('');
	}

	// The page footer: one column for each menu group, one for the signed-in user's pages, one for the legal links.
	footerHtml(root) {
		const col = (title, items) => items.length ? `<div class="fa-footcol"><h4>${esc(title)}</h4>${items.join('')}</div>` : '';
		const link = (r) => `<a href="${root}/${r.slug}">${r.label}</a>`;
		const routes = ROUTES.filter(showRoute);
		const groups = [...new Set(routes.filter((r) => r.group).map((r) => r.group))];
		const mine = ROUTES.filter((r) => r.menu && (!r.auth || Liferay.ThemeDisplay.isSignedIn()));
		return '<div class="fa-footcols">' +
			`<div class="fa-footbrand"><a class="fa-brand" href="${root}/home"><span class="fa-logo">${ICONS.plane}</span>Flight Status <b>Portal</b></a><p>Live flight information for every airport we cover.</p></div>` +
			col('Explore', routes.filter((r) => !r.group).map(link)) + groups.map((g) => col(g, routes.filter((r) => r.group === g).map(link))).join('') +
			col('Help', ROUTES.filter((r) => r.help).map((r) => `<a href="${root}/${r.slug}">${esc(r.help[0])}</a>`)) + col('My account', mine.map(link)) + col('Legal', this.legalLinks().split('</button>').filter(Boolean).map((b) => b + '</button>')) +
			'</div><div class="fa-footbar"><span>&copy; ' + new Date().getFullYear() + ' Flight Status Portal</span><span>Photo: ' + esc(HERO[1]) + ' (' + HERO[2] + '), Wikimedia Commons</span></div>';
	}

	bindShell() {
		this.querySelectorAll('.fa-dropbtn').forEach((b) => b.addEventListener('click', (e) => {
			e.stopPropagation();
			const open = b.parentElement.classList.contains('open');
			this.querySelectorAll('.fa-drop.open').forEach((d) => d.classList.remove('open'));
			b.parentElement.classList.toggle('open', !open);
		}));
		document.addEventListener('click', () => this.querySelectorAll('.fa-drop.open').forEach((d) => d.classList.remove('open')));
		const btn = this.querySelector('.fa-userbtn'), list = this.querySelector('.fa-usermenu-list');
		if (btn && list) {
			const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				list.hidden = !list.hidden;
				btn.setAttribute('aria-expanded', String(!list.hidden));
			});
			document.addEventListener('click', close);
			document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
		}
		const bell = this.querySelector('.fa-bell');
		if (bell) this.bindBell(bell, this.querySelector('.fa-notes'));
		this.querySelectorAll('[data-legal]').forEach((b) => b.addEventListener('click', () => this.legalDialog(b.dataset.legal)));
		let accepted = false;
		try { accepted = localStorage.getItem('faCookieNotice') === 'yes'; } catch (e) {}
		if (!accepted) {
			const bar = document.createElement('div');
			bar.className = 'fa-cookie';
			bar.innerHTML = '<p><b>We only use essential cookies.</b> A session cookie keeps you signed in, and your browser remembers small display settings. No advertising or tracking cookies.</p>' +
				'<div><button type="button" class="fa-btn" data-ck="ok">Got it</button><button type="button" class="fa-ckmore" data-ck="more">Details</button></div>';
			this.appendChild(bar);
			bar.querySelector('[data-ck=ok]').addEventListener('click', () => { try { localStorage.setItem('faCookieNotice', 'yes'); } catch (e) {} bar.remove(); });
			bar.querySelector('[data-ck=more]').addEventListener('click', () => this.legalDialog('cookies'));
		}
	}

	legalDialog(kind) {
		const pages = {
			privacy: ['Privacy', '<p>When you register we store your name, screen name, email address and a scrambled form of your password. Flight alerts you follow and boarding passes you create are linked to your account, and only you (and the administrator) can see them.</p><p>We do not sell your data and we do not use advertising trackers.</p><p>Some pictures and data come from free public services: Wikipedia and Wikimedia Commons (city and airport photos), pics.avs.io (airline logos), Planespotters.net (aircraft photos), adsb.fi and adsbdb.com (live aircraft and routes) and OpenStreetMap (map tiles). Your browser contacts them directly or through our server, so they can see your IP address.</p>'],
			terms: ['Terms of use', '<p>Flight information, live aircraft positions and routes are shown for convenience and can be late, incomplete or wrong. Always confirm times, gates and check-in with your airline before you travel.</p><p>Boarding passes created in this portal are for information only. Use your airline\'s own pass at the airport.</p><p>Please keep your login details private. You are responsible for activity on your account.</p>'],
			cookies: ['Cookies and storage', '<p><b>Essential cookie:</b> a session cookie keeps you signed in until you log out.</p><p><b>Browser storage:</b> we remember that you read this notice, your chosen view in some pages, and the addresses of city photos so pages load faster.</p><p>We do not set advertising or analytics cookies.</p>'],
		};
		const [title, body] = pages[kind];
		const modal = document.createElement('div');
		modal.className = 'fa-modal';
		modal.innerHTML = '<div class="fa-modalbox fa-legalbox"><h2>' + title + '</h2>' + body + '<div><button class="fa-btn" type="button">Close</button></div></div>';
		this.appendChild(modal);
		const close = () => modal.remove();
		modal.querySelector('button').addEventListener('click', close);
		modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
	}

	async isAdmin() {
		if (!Liferay.ThemeDisplay.isSignedIn()) return false;
		if (this._admin === undefined) {
			try {
				const user = await this.json('/o/headless-admin-user/v1.0/my-user-account');
				this._admin = (user.roleBriefs || []).some((r) => r.name === 'Administrator');
			} catch (e) {
				this._admin = false;
			}
		}
		return this._admin;
	}

	async signInPath() {
		if (!this._signInPath) {
			const res = await fetch(location.origin + Liferay.ThemeDisplay.getPathContext() + '/c/portal/login', {credentials: 'include'});
			this._signInPath = new URL(res.url).pathname;
		}
		return this._signInPath;
	}

	loadLeaflet() {
		if (window.L) return Promise.resolve();
		if (!window._faLeaflet) {
			window._faLeaflet = new Promise((resolve, reject) => {
				const css = document.createElement('link');
				css.rel = 'stylesheet';
				css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
				document.head.appendChild(css);
				const js = document.createElement('script');
				js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
				js.onload = resolve;
				js.onerror = () => reject(new Error('Could not load the map library'));
				document.head.appendChild(js);
			});
		}
		return window._faLeaflet;
	}

	async view_live(view) {
		view.innerHTML = '<div class="fa-title"><h1>Live Aircraft Tracking</h1><p>Real aircraft over India, from public ADS-B data. Updates every 20 seconds.</p></div>' +
			'<div class="fa-trackslot"></div><div class="fa-stats fa-livestats" style="margin:0 0 1rem"></div>' +
			'<form class="fa-livebar fa-citybar"><input class="fa-citysearch" placeholder="Flights over a city, e.g. Ahmedabad" /><button class="fa-btn" type="submit">Show flights</button><button class="fa-btn fa-btn-light fa-cityclear" type="button" hidden>Show full map</button></form>' +
			'<div class="fa-livebar"><input class="fa-livesearch" placeholder="Find a callsign, e.g. AIC101 or IGO" /><span class="fa-livestate">Loading...</span></div>' +
			'<div class="fa-map"></div><div class="fa-citylist"></div><p class="fa-credit">Aircraft data: <a href="https://adsb.fi" target="_blank" rel="noopener">adsb.fi</a> open data &middot; Routes: adsbdb.com &middot; Photos: Planespotters.net &middot; Map &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</p>';
		this.bindTrack(view.querySelector('.fa-trackslot'));
		await this.loadLeaflet();
		const map = L.map(view.querySelector('.fa-map'), {zoomControl: true}).setView([22.5, 80], 5);
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 12, attribution: '&copy; OpenStreetMap contributors'}).addTo(map);
		const layer = L.layerGroup().addTo(map);
		const state = view.querySelector('.fa-livestate'), stats = view.querySelector('.fa-livestats'), search = view.querySelector('.fa-livesearch');
		let aircraft = [], base = [], area = [], city = null, ring = null, areaNote = '';
		const cityForm = view.querySelector('.fa-citybar'), cityInput = view.querySelector('.fa-citysearch'), cityClear = view.querySelector('.fa-cityclear'), cityList = view.querySelector('.fa-citylist');

		const icon = (a) => L.divIcon({
			className: 'fa-plane',
			html: `<svg viewBox="0 0 24 24" width="26" height="26" style="transform:rotate(${Number(a.track) || 0}deg)" fill="${a.onGround ? '#8a94a8' : '#0b5fff'}" stroke="#fff" stroke-width="1"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`,
			iconSize: [26, 26], iconAnchor: [13, 13],
		});

		const routeLayer = L.layerGroup().addTo(map), routeCache = new Map();
		const getRoute = (callsign) => {
			const key = String(callsign || '').trim().toUpperCase();
			if (!/^[0-9A-Z]{3,8}$/.test(key)) return Promise.resolve({});
			if (!routeCache.has(key)) routeCache.set(key, Promise.race([this.json('/o/flight-live/route?callsign=' + key), new Promise((resolve) => setTimeout(() => resolve({}), 12000))]).catch(() => ({})));
			const pending = routeCache.get(key);
			pending.then((r) => { if (!r.origin) routeCache.delete(key); });
			return pending;
		};
		const place = (p) => (p && p.code ? esc((p.city || p.name || '') + ' (' + p.code + ')') : '?');
		// A Leaflet popup rebuilds itself from its stored text when it is updated, so the route and
		// photo text are kept in the marker's own variables and set again through setContent().
		const drawRouteLine = (r, a) => {
			routeLayer.clearLayers();
			if (!r || !r.origin || !r.destination) return;
			const o = [r.origin.lat, r.origin.lon], d = [r.destination.lat, r.destination.lon];
			if (o.every(Number.isFinite) && d.every(Number.isFinite)) {
				L.polyline([o, [a.lat, a.lon], d], {color: '#0b5fff', weight: 2, dashArray: '6 6'}).addTo(routeLayer);
				[[o, r.origin], [d, r.destination]].forEach((x) => L.circleMarker(x[0], {radius: 5, color: '#0b5fff', fillColor: '#fff', fillOpacity: 1, weight: 2}).addTo(routeLayer).bindTooltip(x[1].code, {permanent: true, direction: 'top'}));
			}
		};
		const routeText = (r) => (!r.origin || !r.destination ? 'Route not available'
			: `<b>From:</b> ${place(r.origin)}<br><b>To:</b> ${place(r.destination)}` + (r.airline ? `<br><small>${esc(r.airline)}</small>` : ''));
		const planePhotos = new Map();
		const getPlanePhoto = (hex) => {
			if (!planePhotos.has(hex)) planePhotos.set(hex, this.json('/o/flight-live/photo?hex=' + encodeURIComponent(hex)).catch(() => ({})));
			return planePhotos.get(hex);
		};
		const photoText = (p) => (p.src ? `<a href="${esc(p.link)}" target="_blank" rel="noopener"><img src="${esc(p.src)}" alt="Aircraft photo"></a><small>Photo: ${esc(p.photographer)} &middot; Planespotters.net</small>` : '');

		const addPlane = (a) => {
			const base = `<b>${esc(a.callsign || a.hex)}</b><br>${esc(a.type || '')} ${a.registration ? '&middot; ' + esc(a.registration) : ''}<br>` +
				(a.onGround ? 'On ground' : `Altitude: ${Number(a.altitude).toLocaleString()} ft`) + `<br>Speed: ${esc(a.speed)} kt &middot; Heading: ${esc(a.track)}&deg;`;
			let routeHtml = 'Looking up the route...', photoHtml = '', route = null;
			const content = () => base + `<div class="fa-planeroute">${routeHtml}</div><div class="fa-planephoto">${photoHtml}</div>`;
			const marker = L.marker([a.lat, a.lon], {icon: icon(a)}).addTo(layer).bindPopup(content(), {autoPanPaddingTopLeft: [20, 70], autoPanPaddingBottomRight: [20, 20], maxWidth: 260});
			marker.on('popupopen', (ev) => {
				const popup = ev.popup;
				if (route && route.origin) drawRouteLine(route, a);
				else { routeLayer.clearLayers(); route = null; routeHtml = 'Looking up the route...'; popup.setContent(content()); }
				if (!route) {
					getRoute(a.callsign).then((r) => {
						route = r;
						routeHtml = routeText(r);
						if (popup.isOpen()) { popup.setContent(content()); drawRouteLine(r, a); }
					});
				}
				if (!photoHtml) {
					getPlanePhoto(a.hex).then((p) => {
						photoHtml = photoText(p);
						if (photoHtml && popup.isOpen()) popup.setContent(content());
					});
				}
			});
			marker.on('popupclose', () => routeLayer.clearLayers());
		};

		const fillRoutes = async () => {
			const cells = Array.from(cityList.querySelectorAll('[data-route-cs]')).slice(0, 12);
			for (const td of cells) {
				const r = await getRoute(td.dataset.routeCs);
				if (!td.isConnected) return;
				td.textContent = r.origin && r.destination ? r.origin.code + ' → ' + r.destination.code : '-';
			}
		};

		const draw = (fit) => {
			const term = search.value.trim().toLowerCase();
			const all = city ? city.aircraft : aircraft;
			const shown = all.filter((a) => !term || (a.callsign + ' ' + a.registration + ' ' + a.type).toLowerCase().includes(term));
			layer.clearLayers();
			shown.forEach(addPlane);
			if (ring) { ring.remove(); ring = null; }
			if (city) {
				ring = L.circle([city.lat, city.lon], {radius: city.radiusKm * 1000, color: '#0b5fff', weight: 1, fillOpacity: .05}).addTo(map);
				if (!city.fitted) { map.fitBounds(ring.getBounds()); city.fitted = true; }
			}
			else if (fit === true && term && shown.length) map.fitBounds(L.latLngBounds(shown.map((a) => [a.lat, a.lon])).pad(0.3), {maxZoom: 9});
			const air = all.filter((a) => !a.onGround);
			const avg = (k) => (air.length ? Math.round(air.reduce((t, a) => t + (Number(a[k]) || 0), 0) / air.length) : 0);
			stats.innerHTML = [['plane', all.length, city ? 'Flights over the city' : 'Aircraft tracked'], ['clock', air.length, 'In the air'], ['building', all.length - air.length, 'On the ground'], ['shield', avg('altitude').toLocaleString() + ' ft', 'Average altitude']]
				.map((s) => `<div class="fa-stat"><span class="fa-ico">${ICONS[s[0]]}</span><div><b>${esc(s[1])}</b><span>${s[2]}</span></div></div>`).join('');
			cityList.innerHTML = city ? `<h2 class="fa-h2">${shown.length} flight(s) within ${city.radiusKm} km of ${esc(city.name)}</h2>` +
				(shown.length ? '<div class="fa-tablewrap"><table class="fa-table"><thead><tr><th>Callsign</th><th>Route</th><th>Aircraft</th><th>Altitude</th><th>Speed</th><th>Heading</th><th>Distance</th></tr></thead><tbody>' +
					shown.map((a) => `<tr><td><b>${esc(a.callsign || a.hex)}</b></td><td data-route-cs="${esc(a.callsign)}">...</td><td>${esc(a.type || '')} ${esc(a.registration || '')}</td><td>${Number(a.altitude).toLocaleString()} ft</td><td>${esc(a.speed)} kt</td><td>${esc(a.track)}&deg;</td><td>${esc(a.distanceKm)} km</td></tr>`).join('') + '</tbody></table></div>' : '<p class="fa-empty">No aircraft are flying over this city right now.</p>') : '';
			fillRoutes();
			state.textContent = (term ? shown.length + ' match(es) &middot; ' : '').replace('&middot;', '·') + 'Updated ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}) + (city ? '' : areaNote);
		};

		const merge = () => {
			const byHex = new Map();
			base.forEach((a) => byHex.set(a.hex, a));
			area.forEach((a) => byHex.set(a.hex, a));
			aircraft = Array.from(byHex.values());
		};

		const loadArea = async () => {
			if (city) return;
			const c = map.getCenter(), ne = map.getBounds().getNorthEast();
			const nm = Math.ceil(map.distance(c, ne) / 1852);
			try {
				area = await this.json('/o/flight-live/area?lat=' + c.lat.toFixed(2) + '&lon=' + c.lng.toFixed(2) + '&nm=' + Math.min(nm, 250));
				const overIndia = c.lat > 5 && c.lat < 37 && c.lng > 67 && c.lng < 98 && map.getZoom() >= 5;
				areaNote = (nm > 250 && !overIndia) ? ' · Zoom in to see all planes in this area' : '';
			} catch (e) {
				areaNote = '';
			}
			merge();
			draw();
		};

		const refresh = async () => {
			try {
				if (city) {
						const fresh = await this.json('/o/flight-live/city?name=' + encodeURIComponent(city.query));
						city = Object.assign(fresh, {query: city.query, name: city.name, fitted: true});
					}
					else {
						base = await this.json('/o/flight-live/aircraft');
						await loadArea();
						return;
					}
				draw();
			} catch (e) {
				state.textContent = 'Live data unavailable right now: ' + e.message;
			}
		};
		search.addEventListener('input', () => draw(true));
		cityForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const q = cityInput.value.trim();
			if (!q) return;
			state.textContent = 'Looking for ' + q + '...';
			try {
				const res = await this.json('/o/flight-live/city?name=' + encodeURIComponent(q));
				city = Object.assign(res, {query: q, name: String(res.city || q).split(',')[0]});
				cityClear.hidden = false;
				draw();
			} catch (err) {
				state.textContent = /404/.test(err.message) ? 'City not found. Check the spelling.' : 'Live data unavailable right now: ' + err.message;
			}
		});
		let moveTimer;
		map.on('moveend', () => {
			clearTimeout(moveTimer);
			moveTimer = setTimeout(loadArea, 700);
		});
		cityClear.addEventListener('click', () => {
			city = null; cityInput.value = ''; cityClear.hidden = true;
			map.setView([22.5, 80], 5);
			draw();
		});
		await refresh();
		clearInterval(this._timer);
		this._timer = setInterval(refresh, 20000);
	}

	async view_admin(view) {
		if (!(await this.isAdmin())) {
			view.innerHTML = '<div class="fa-auth-box"><h1>Admin only</h1><p>You need to sign in as an administrator to manage flights, airports and gates.</p>' +
				'<a class="fa-btn block" style="display:block;text-align:center;text-decoration:none" href="' + this._root + '/login">Go to login</a></div>';
			return;
		}
		await this.renderAdmin(view, new URLSearchParams(location.search).get('tab') || 'dashboard');
	}

	adminEntities() {
		const site = SITE_ID();
		const statuses = [['OnTime', 'On Time'], ['Delayed', 'Delayed'], ['Boarding', 'Boarding'], ['Departed', 'Departed'], ['Landed', 'Landed'], ['Cancelled', 'Cancelled']];
		return {
			airports: {
				label: 'Airport', plural: 'Airports', list: '/o/c/airports/?pageSize=200', create: '/o/c/airports', item: '/o/c/airports/',
				fields: [{k: 'code', l: 'Code (e.g. DEL)', req: true}, {k: 'name', l: 'Airport name', req: true}, {k: 'city', l: 'City', req: true}, {k: 'country', l: 'Country', req: true}],
				cols: [['code', 'Code'], ['name', 'Name'], ['city', 'City'], ['country', 'Country']],
			},
			gates: {
				label: 'Gate', plural: 'Gates', list: '/o/c/gates/scopes/' + site + '?pageSize=200', create: '/o/c/gates/scopes/' + site, item: '/o/c/gates/',
				fields: [{k: 'gateNumber', l: 'Gate number (e.g. A1)', req: true}, {k: 'terminal', l: 'Terminal (e.g. T1)', req: true}],
				cols: [['gateNumber', 'Gate'], ['terminal', 'Terminal']],
			},
			notices: {
				label: 'Notice', plural: 'Notices', list: '/o/c/notices/scopes/' + site + '?pageSize=200', create: '/o/c/notices/scopes/' + site, item: '/o/c/notices/',
				fields: [{k: 'message', l: 'Message shown at the top of the pages', req: true}, {k: 'level', l: 'Type', type: 'select', options: [['info', 'Information'], ['warning', 'Warning'], ['alert', 'Urgent']]}, {k: 'active', l: 'Show it now', type: 'checkbox'}],
				cols: [['message', 'Message'], ['level', 'Type'], ['active', 'Shown']],
			},
			guides: {
				label: 'Guide entry', plural: 'Airport guide', list: '/o/c/airportguides/scopes/' + site + '?pageSize=200', create: '/o/c/airportguides/scopes/' + site, item: '/o/c/airportguides/',
				fields: [{k: 'airportCode', l: 'Airport', type: 'airport', req: true}, {k: 'category', l: 'Category (for example Taxi, Metro, Bus, Parking)', type: 'suggest', req: true}, {k: 'title', l: 'Title', req: true}, {k: 'details', l: 'Details (fares, timings, where to find it)', type: 'textarea'}, {k: 'pickupPoints', l: 'Pick-up points (one on each line, for example Terminal 1: Arrivals Exit Gate)', type: 'textarea'}, {k: 'link', l: 'Link (optional)'}, {k: 'imageUrl', l: 'Photo link (optional, a city photo is used when empty)'}],
				cols: [['airportCode', 'Airport'], ['category', 'Category'], ['title', 'Title'], ['details', 'Details']],
			},
			terminals: {
				label: 'Terminal', plural: 'Terminals', list: '/o/c/airportterminals/scopes/' + site + '?pageSize=200', create: '/o/c/airportterminals/scopes/' + site, item: '/o/c/airportterminals/',
				fields: [{k: 'airportCode', l: 'Airport', type: 'airport', req: true}, {k: 'name', l: 'Terminal name (for example Terminal 1)', req: true}, {k: 'latitude', l: 'Latitude (optional, from Google Maps: right-click the place and copy the numbers)'}, {k: 'longitude', l: 'Longitude (optional)'}],
				cols: [['airportCode', 'Airport'], ['name', 'Terminal'], ['latitude', 'Latitude'], ['longitude', 'Longitude']],
			},
			pickups: {
				label: 'Pick-up point', plural: 'Pick-up points', list: '/o/c/pickuppoints/scopes/' + site + '?pageSize=200', create: '/o/c/pickuppoints/scopes/' + site, item: '/o/c/pickuppoints/',
				fields: [{k: 'airportCode', l: 'Airport', type: 'airport', req: true}, {k: 'category', l: 'Category (the same word as in the Airport guide, for example Taxi)', type: 'suggest', req: true}, {k: 'terminal', l: 'Terminal (the same name as in Terminals)', type: 'suggest', req: true}, {k: 'name', l: 'Name of the place (for example Arrivals Exit Gate)', req: true}, {k: 'steps', l: 'How to get there from the terminal (one step on each line)', type: 'textarea'}, {k: 'latitude', l: 'Latitude (optional)'}, {k: 'longitude', l: 'Longitude (optional)'}],
				cols: [['airportCode', 'Airport'], ['category', 'Category'], ['terminal', 'Terminal'], ['name', 'Place'], ['steps', 'Steps']],
			},
			assistance: {
				label: 'Request', plural: 'Assistance requests', list: '/o/c/assistancerequests/scopes/' + site + '?pageSize=200&sort=dateCreated:desc', create: '/o/c/assistancerequests/scopes/' + site, item: '/o/c/assistancerequests/', noAdd: true,
				fields: [{k: 'requestStatus', l: 'Status', type: 'select', options: [['Open', 'Open'], ['Done', 'Done']]}],
				cols: [['pnr', 'PNR'], ['passengerName', 'Passenger'], ['flightNumber', 'Flight'], ['assistanceType', 'Help needed'], ['note', 'Note'], ['requestStatus', 'Status']],
			},
			helpoptions: {
				label: 'Help option', plural: 'Help options', list: '/o/c/assistanceoptions/scopes/' + site + '?pageSize=200', create: '/o/c/assistanceoptions/scopes/' + site, item: '/o/c/assistanceoptions/',
				fields: [{k: 'name', l: 'Kind of help passengers can ask for', req: true}],
				cols: [['name', 'Help option']],
			},
			bookings: {
				label: 'Booking', plural: 'Bookings', list: '/o/c/bookings/scopes/' + site + '?pageSize=200', create: '/o/c/bookings/scopes/' + site, item: '/o/c/bookings/',
			},
			flights: {
				label: 'Flight', plural: 'Flights', list: '/o/c/flights/scopes/' + site + '?pageSize=500&sort=departureTime:asc', create: '/o/c/flights/scopes/' + site, item: '/o/c/flights/', statuses,
			},
		};
	}

	async apiWrite(method, url, body) {
		const res = await getFetch()(url, {method, credentials: 'include', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
		if (!res.ok) {
			let msg = 'HTTP ' + res.status;
			try {
				const j = await res.json();
				msg = j.title || j.message || msg;
			} catch (e) {}
			throw new Error(msg);
		}
		return res.status === 204 ? null : res.json();
	}

	async renderAdmin(view, tab, notice) {
		this._adminTab = tab;
		const ENT = this.adminEntities();
		const [flightsRaw, airportsRaw, gatesRaw, bookingsRaw] = await Promise.all([
			this.json(ENT.flights.list), this.json(ENT.airports.list), this.json(ENT.gates.list), this.json(ENT.bookings.list),
		]);
		const airports = airportsRaw.items, gates = gatesRaw.items, flights = flightsRaw.items, bookings = bookingsRaw.items;
		let passes = [], reservations = [];
		if (tab === 'reservations' || tab === 'dashboard') { try { passes = (await this.json('/o/c/boardingpasses/scopes/' + SITE_ID() + '?pageSize=200')).items || []; } catch (e) {} }
		let openHelp = 0;
		try { openHelp = ((await this.json(ENT.assistance.list)).items || []).filter((x) => x.requestStatus === 'Open').length; } catch (e) {}
		const apById = Object.fromEntries(airports.map((a) => [a.id, a]));
		const tabs = [['dashboard', 'Dashboard'], ['flights', 'Flights (' + flights.length + ')'], ['airports', 'Airports (' + airports.length + ')'], ['gates', 'Gates (' + gates.length + ')'], ['bookings', 'Bookings (' + bookings.length + ')'], ['reservations', 'Reservations']];

		let body = '';
		if (tab === 'dashboard') {
			const isDelayed = (f) => (f.showstatus && f.showstatus.key === 'Delayed') || Number(f.delayMinutes) > 0;
			const colors = {ontime: '#1f9d55', delayed: '#d64545', boarding: '#e0a800', departed: '#1146d6', landed: '#6b7790', cancelled: '#444b5e'};
			const byStatus = {};
			flights.forEach((f) => { const n = f.showstatus ? f.showstatus.name : 'Unknown'; byStatus[n] = (byStatus[n] || 0) + 1; });
			let acc = 0;
			const stops = Object.entries(byStatus).map(([n, c]) => { const from = acc / (flights.length || 1) * 100; acc += c; return (colors[statusClass(n)] || '#9aa6c0') + ' ' + from + '% ' + acc / (flights.length || 1) * 100 + '%'; }).join(',');
			const days = {};
			flights.forEach((f) => { const k = String(f.departureTime).slice(0, 10); days[k] = (days[k] || 0) + 1; });
			const dayList = Object.entries(days).sort().slice(-8), maxDay = Math.max(...dayList.map((d) => d[1]), 1);
			const late = flights.filter(isDelayed).sort((x, y) => (Number(y.delayMinutes) || 0) - (Number(x.delayMinutes) || 0)).slice(0, 6);
			const waiting = bookings.filter((x) => x.bookingStatus !== 'CheckedIn' && !passes.some((p) => p.pnr === x.pnr));
			const events = [];
			bookings.forEach((x) => events.push({t: Date.parse(x.dateCreated) || 0, icon: 'ticket', text: 'Booking <b>' + esc(x.pnr) + '</b> for ' + esc(x.firstName + ' ' + x.lastName) + ' on ' + esc(x.flightNumber)}));
			passes.forEach((p) => events.push({t: Date.parse(p.dateCreated) || 0, icon: 'users', text: esc(p.creator ? p.creator.name : 'A passenger') + ' checked in <b>' + esc(p.pnr) + '</b>, seat ' + esc(p.seat)}));
			events.sort((x, y) => y.t - x.t);
			const tiles = [['plane', flights.length, 'Flights'], ['clock', flights.filter(isDelayed).length, 'Delayed flights'], ['ticket', bookings.length, 'Bookings'], ['users', passes.length, 'Checked in'], ['building', airports.length, 'Airports'], ['gate', gates.length, 'Gates'], ['bell', openHelp, 'Open help requests', 'assistance']];
			body = '<div class="fa-adminbtns"><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button><button class="fa-btn block-auto" data-add="bookings">+ Add Booking</button><button class="fa-btn block-auto" data-add="airports">+ Add Airport</button><button class="fa-btn block-auto" data-add="gates">+ Add Gate</button><button class="fa-btn block-auto" data-add="notices">+ Add Notice</button><button class="fa-btn block-auto" data-add="guides">+ Add Guide entry</button></div>' +
				'<div class="fa-dashtiles">' + tiles.map((t) => `<${t[3] ? 'a href="' + this._root + '/admin?tab=' + t[3] + '"' : 'div'} class="fa-stat"><span class="fa-ico">${ICONS[t[0]]}</span><div><b>${t[1]}</b><span>${t[2]}</span></div></${t[3] ? 'a' : 'div'}>`).join('') + '</div>' +
				'<div class="fa-dashgrid">' +
				'<section class="fa-dashcard"><h3>Flights by status</h3><div class="fa-donutwrap"><div class="fa-donut" style="background:conic-gradient(' + (stops || '#e3e9f6 0% 100%') + ')"><span>' + flights.length + '<small>flights</small></span></div><ul class="fa-legend">' +
					Object.entries(byStatus).map(([n, c]) => `<li><i style="background:${colors[statusClass(n)] || '#9aa6c0'}"></i>${esc(n)} <b>${c}</b></li>`).join('') + '</ul></div></section>' +
				'<section class="fa-dashcard"><h3>Flights by day</h3><div class="fa-dbars">' + (dayList.map((d) => `<div class="fa-dbar"><b>${d[1]}</b><i style="height:${Math.max(6, d[1] / maxDay * 100)}%"></i><span>${esc(new Date(d[0] + 'T00:00:00Z').toLocaleDateString([], {day: 'numeric', month: 'short', timeZone: 'UTC'}))}</span></div>`).join('') || '<p class="fa-panelnote">No flights yet.</p>') + '</div></section>' +
				'<section class="fa-dashcard"><h3>Needs attention</h3><h4>Delayed flights (' + flights.filter(isDelayed).length + ')</h4>' + (late.length ? late.map((f) => `<div class="fa-late"><div><b>${esc(f.flightNumber)}</b><span>${esc(fmtDate(f.departureTime))}</span></div><em>${Number(f.delayMinutes) > 0 ? '+' + esc(f.delayMinutes) + ' min' : esc(f.showstatus ? f.showstatus.name : '')}</em></div>`).join('') : '<p class="fa-panelnote">No delays right now.</p>') +
					'<h4>Not checked in (' + waiting.length + ')</h4>' + (waiting.slice(0, 5).map((x) => `<div class="fa-late"><div><b>${esc(x.pnr)}</b><span>${esc(x.firstName + ' ' + x.lastName)}</span></div><em class="muted">${esc(x.flightNumber)}</em></div>`).join('') || '<p class="fa-panelnote">Everyone has checked in.</p>') + '</section>' +
				'<section class="fa-dashcard fa-feedcard"><h3>Live flight data</h3><p class="fa-panelnote">Checking...</p></section>' +
				'<section class="fa-dashcard"><h3>Recent activity</h3>' + (events.slice(0, 8).map((e) => `<div class="fa-event"><span class="fa-ico sm">${ICONS[e.icon]}</span><div>${e.text}<small>${e.t ? esc(new Date(e.t).toLocaleString([], {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})) : ''}</small></div></div>`).join('') || '<p class="fa-panelnote">Nothing yet.</p>') + '</section>' +
				'</div>';
		} else if (tab === 'flights') {
			body = '<div class="fa-head"><h2>Flights</h2><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button></div>' +
				this.adminTable(['Flight', 'Route', 'Departure', 'Status', 'Delay', 'Bookings'], flights.map((f) => {
					const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId];
					return [f.id, [esc(f.flightNumber) + (airlineOf(f.flightNumber, f.airline) ? '<br><small>' + esc(airlineOf(f.flightNumber, f.airline)) + '</small>' : '') + (f.source === 'feed' ? ' <span class="fa-badge feedtag">Live feed</span>' : ''), esc((o ? o.code : '?') + ' → ' + (d ? d.code : '?')), '<span data-v="' + (Date.parse(f.departureTime) || 0) + '">' + fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime) + '</span>',
						'<span class="fa-badge ' + statusClass(f.showstatus ? f.showstatus.name : '') + '">' + esc(f.showstatus ? f.showstatus.name : '') + '</span>', (f.delayMinutes || 0) + ' min', String(bookings.filter((b) => String(b.flightId) === String(f.id) || (!b.flightId && b.flightNumber === f.flightNumber)).length)]];
				}));
		} else if (tab === 'bookings') {
			body = '<div class="fa-head"><h2>Bookings</h2><button class="fa-btn block-auto" data-add="bookings">+ Add Booking</button></div>' +
				this.adminTable(['PNR', 'Passenger', 'Flight', 'Date', 'Route', 'Class', 'Status'], bookings.map((b) => {
					const f = flights.find((x) => String(x.id) === String(b.flightId)) || flights.find((x) => x.flightNumber === b.flightNumber) || {};
					const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId], air = airlineOf(b.flightNumber, f.airline);
					return [b.id, [esc(b.pnr), esc(b.firstName + ' ' + b.lastName), esc(b.flightNumber + (air ? ' · ' + air : '')), '<span data-v="' + (Date.parse(f.departureTime) || 0) + '">' + esc(f.departureTime ? fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime) : '?') + '</span>',
						esc(o && d ? o.code + ' → ' + d.code : '?'), esc(CLASS_LABEL[classOf(b.travelClass)]),
						'<span class="fa-badge ' + (b.bookingStatus === 'CheckedIn' ? 'landed' : b.bookingStatus === 'Cancelled' ? 'delayed' : 'ontime') + '">' + esc(b.bookingStatus === 'CheckedIn' ? 'Checked in' : b.bookingStatus) + '</span>']];
				}));
		} else if (tab === 'track') {
			body = '<div class="fa-trackslot"></div><p class="fa-panelnote fa-trackquota"></p>';
		} else if (tab === 'gate') {
			body = '<div class="fa-head"><h2>Gate scan</h2></div><div class="fa-gate"><div class="fa-gatebar"><input class="fa-gatecode" placeholder="Scan the QR, or paste the link or code from the boarding pass" autocomplete="off" /><button class="fa-btn block-auto fa-gatego" type="button">Check pass</button><button class="fa-chip fa-gatecam" type="button">Use camera</button></div>' +
				'<video class="fa-gatevideo" hidden playsinline muted></video><div class="fa-gateresult"><p class="fa-panelnote">Scan a boarding pass QR with the camera, or paste its link, to see the passenger and mark them as boarded.</p></div></div>';
		} else if (tab === 'reservations') {
			// One list of who booked which flight: every booking, plus passes whose booking was deleted
			const used = new Set(), pairs = [];
			bookings.forEach((b) => { const p = passes.find((x) => x.pnr === b.pnr); if (p) used.add(p.id); pairs.push([b, p]); });
			passes.forEach((p) => { if (!used.has(p.id)) pairs.push([null, p]); });
			reservations = pairs.map(([b, p]) => {
				const num = b ? b.flightNumber : p.flightNumber;
				const f = flights.find((x) => String(x.id) === String((b && b.flightId) || (p && p.flightId))) || flights.find((x) => x.flightNumber === num) || {};
				const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId], dep = f.departureTime || (p && p.departureTime) || '';
				return {pnr: b ? b.pnr : p.pnr, name: b ? b.firstName + ' ' + b.lastName : p.passengerName, account: p && p.creator ? p.creator.name : '', email: (p && p.passengerEmail) || (b && b.email) || '',
					flight: num, air: airlineOf(num, f.airline) || '', dep, ts: Date.parse(dep) || 0, route: o && d ? o.code + ' → ' + d.code : p ? p.origin + ' → ' + p.destination : '?',
					cls: CLASS_LABEL[classOf(b ? b.travelClass : p.travelClass)], seat: p ? p.seat : '', status: !b ? 'Booking deleted' : p ? 'Checked in' : 'Booked', created: Date.parse((b || p).dateCreated) || 0};
			});
			const count = (s) => reservations.filter((r) => r.status === s).length;
			const heads = [['Passenger', 'name'], ['Account', 'account'], ['Flight', 'flight'], ['Departure', 'ts'], ['Route', 'route'], ['Class', 'cls'], ['Seat', 'seat'], ['PNR', 'pnr'], ['Status', 'status']];
			body = '<div class="fa-head"><h2>Reservations</h2></div><div class="fa-rescards">' +
				[['Total', reservations.length], ['Checked in', count('Checked in')], ['Not checked in', count('Booked')], ['Booking deleted', count('Booking deleted')]].map((c) => '<div><b>' + c[1] + '</b><span>' + c[0] + '</span></div>').join('') + '</div>' +
				'<div class="fa-resbar"><input class="fa-resq" type="search" placeholder="Search name, email, account, PNR or flight" />' +
				'<select class="fa-resflight"><option value="">All flights</option>' + [...new Set(reservations.map((r) => r.flight))].sort().map((n) => '<option>' + esc(n) + '</option>').join('') + '</select>' +
				'<select class="fa-resstatus"><option value="">All statuses</option><option>Booked</option><option>Checked in</option><option>Booking deleted</option></select>' +
				'<input class="fa-resdate" type="date" title="Departure date" /><button class="fa-chip fa-resclear" type="button">Clear</button><span class="fa-rescount"></span></div>' +
				'<div class="fa-tablewrap"><table class="fa-table"><thead><tr>' + heads.map((h) => '<th data-s="' + h[1] + '" class="fa-sortable">' + h[0] + '</th>').join('') + '</tr></thead><tbody></tbody></table></div><div class="fa-msg fa-resempty" hidden>No reservations match.</div>';
		} else {
			const E = ENT[tab], items = tab === 'airports' ? airports : tab === 'gates' ? gates : (await this.json(E.list)).items;
			this._adminItems = items;
			const show = (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : esc(v));
			body = '<div class="fa-head"><h2>' + E.plural + '</h2>' + (E.noAdd ? '' : '<button class="fa-btn block-auto" data-add="' + tab + '">+ Add ' + E.label + '</button>') + '</div>' +
				this.adminTable(E.cols.map((c) => c[1]), items.map((it) => [it.id, E.cols.map((c) => show(it[c[0]]))]));
		}

		const count = (list, pick) => { const m = {}; list.forEach((x) => { const k = pick(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]); };
		const chips = (pairs) => '<div class="fa-chipstrip"><button type="button" class="fa-chip active" data-q="">All</button>' + pairs.map((p) => `<button type="button" class="fa-chip" data-q="${esc(p[0])}">${esc(p[2] || p[0])} (${p[1]})</button>`).join('') + '</div>';
		if (tab === 'flights') body = chips(count(flights, (f) => f.showstatus && f.showstatus.name)) + body;
		else if (tab === 'airports') body = chips(count(airports, (a) => a.country)) + body;
		else if (tab === 'gates') body = chips(count(gates, (g) => g.terminal).map((p) => [p[0], p[1], 'Terminal ' + p[0]])) + body;
		else if (tab === 'bookings') body = chips(count(bookings, (b) => b.bookingStatus).map((p) => [p[0] === 'CheckedIn' ? 'Checked in' : p[0], p[1]])) + body;
		view.innerHTML = '<div class="fa-title"><h1>Admin Portal</h1><p>Manage flights, airports, gates and bookings. Changes appear on the public pages straight away.</p></div>' +
			(notice ? `<div class="fa-notice ${notice.error ? 'error' : ''}">${esc(notice.text)}</div>` : '') + body;

		this.querySelectorAll('.fa-sidebar a[href*="tab=assistance"]').forEach((a) => { a.querySelector('.fa-count')?.remove(); if (openHelp) a.insertAdjacentHTML('beforeend', '<em class="fa-count">' + openHelp + '</em>'); });
		const adminSearch = {flights: 'Search flight, airline, route or status', airports: 'Search airport code, name, city or country', gates: 'Search gate or terminal', bookings: 'Search PNR, passenger, flight or status'};
		if (adminSearch[tab]) this.setupFilter(view, {key: 'admin-' + tab, items: '.fa-table tbody tr', placeholder: adminSearch[tab], table: true});
		if (tab === 'reservations') this.bindReservations(view, reservations);
		if (tab === 'gate') this.bindGate(view);
		if (tab === 'track') {
			this.bindTrack(view.querySelector('.fa-trackslot'));
			fetch('/o/flight-feed/status', {credentials: 'include'}).then((r) => r.json()).then((st) => { view.querySelector('.fa-trackquota').textContent = st.enabled ? 'Flight data lookups used this month: ' + st.callsThisMonth + ' of ' + st.monthlyLimit + ' (shared with the daily sync). Live aircraft tracking has no limit.' : 'The flight data service is not connected. Live aircraft tracking still works.'; }).catch(() => {});
		}
		if (tab === 'dashboard') this.bindFeed(view);
		view.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => this.adminForm(view, b.dataset.add, null, {airports, flights, gates, bookings, items: this._adminItems || []})));
		view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
			const list = {flights, airports, bookings, gates}[tab] || this._adminItems;
			this.adminForm(view, tab, list.find((x) => String(x.id) === b.dataset.edit), {airports, flights, gates, bookings, items: this._adminItems || []});
		}));
		view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
			if (!(await this.confirmBox('Delete this ' + ENT[tab].label.toLowerCase() + '? This cannot be undone.'))) return;
			try {
				await this.apiWrite('DELETE', ENT[tab].item + b.dataset.del);
				this._airports = null;
				await this.renderAdmin(view, tab, {text: ENT[tab].label + ' deleted.'});
			} catch (e) {
				await this.renderAdmin(view, tab, {error: true, text: 'Could not delete: ' + e.message + (tab === 'airports' ? ' (an airport used by flights cannot be deleted)' : '')});
			}
		}));
	}

	// "Track a flight": type any flight number, see the aircraft live on a map (anyone) and, when signed in, today's status, delay, terminal and gate.
	async bindTrack(root) {
		if (!root) return;
		root.innerHTML = '<section class="fa-track"><h3>Track a flight</h3><p class="fa-hint">Type any flight number from any airport, for example AI101, 6E606 or EK512.</p>' +
			'<form class="fa-trackform"><input name="q" placeholder="Flight number, e.g. AI101" autocomplete="off" maxlength="10" /><button class="fa-btn" type="submit">Track</button></form><div class="fa-trackout"></div></section>';
		const form = root.querySelector('form'), out = root.querySelector('.fa-trackout');
		const signedIn = Liferay.ThemeDisplay.isSignedIn();
		const LABEL = {scheduled: 'Scheduled', active: 'In the air', landed: 'Landed', cancelled: 'Cancelled', incident: 'Incident', diverted: 'Diverted'};
		const when = (iso) => (iso ? esc(fmtDate(iso) + ' ' + fmtTime(iso)) : '-');
		let timer = null, map = null, marker = null, current = '';
		const planeIcon = (a) => L.divIcon({className: 'fa-plane', iconSize: [30, 30], iconAnchor: [15, 15],
			html: '<svg viewBox="0 0 24 24" width="30" height="30" style="transform:rotate(' + (Number(a.track) || 0) + 'deg)" fill="' + (a.onGround ? '#8a94a8' : '#0b5fff') + '" stroke="#fff" stroke-width="1"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>'});
		const statusCard = (f) => {
			const d = f.departure || {}, a = f.arrival || {}, delay = Number(d.delay) || 0;
			return '<div class="fa-trackcard"><div class="fa-trackhead"><b>' + esc(f.flight) + '</b> <span>' + esc(f.airline) + '</span><i class="fa-badge ' + (f.status === 'active' ? 'departed' : f.status === 'landed' ? 'landed' : f.status === 'cancelled' ? 'delayed' : 'ontime') + '">' + esc(LABEL[f.status] || f.status) + '</i></div>' +
				'<div class="fa-trackroute"><div><b>' + esc(d.iata) + '</b><span>' + esc(d.airport) + '</span></div><em>&rarr;</em><div><b>' + esc(a.iata) + '</b><span>' + esc(a.airport) + '</span></div></div>' +
				'<dl class="fa-kv">' + [['Departs', when(d.scheduled)], ['Expected', when(d.estimated || d.scheduled)], ['Arrives', when(a.estimated || a.scheduled)], ['Delay', delay ? '+' + delay + ' min' : 'On time'],
					['Departure terminal / gate', esc((d.terminal || '-') + ' / ' + (d.gate || '-'))], ['Arrival terminal / gate', esc((a.terminal || '-') + ' / ' + (a.gate || '-'))]].map((r) => '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('') + '</dl></div>';
		};
		const tiles = (a) => '<div class="fa-tracktiles">' + [['Altitude', a.onGround ? 'On the ground' : Number(a.altitude).toLocaleString() + ' ft'], ['Speed', a.speed + ' kt'], ['Heading', a.track + '\u00b0'], ['Position', Number(a.lat).toFixed(2) + ', ' + Number(a.lon).toFixed(2)], ['Aircraft', esc([a.type, a.registration].filter(Boolean).join(' \u00b7 ') || '-')]]
			.map((t) => '<div><span>' + t[0] + '</span><b>' + t[1] + '</b></div>').join('') + '</div>';
		const show = async (q) => {
			current = q;
			clearInterval(timer);
			out.innerHTML = '<p class="fa-panelnote">Looking up ' + esc(q) + '...</p>';
			const [live, full] = await Promise.all([
				this.json('/o/flight-live/track?q=' + encodeURIComponent(q)).catch((e) => ({error: e.message, aircraft: []})),
				signedIn ? fetch('/o/flight-feed/lookup?flight=' + encodeURIComponent(q), {credentials: 'include'}).then((r) => r.json()).catch(() => ({available: false, reason: 'The flight data service did not answer.'})) : Promise.resolve(null),
			]);
			const a = (live.aircraft || []).sort((x, y) => Number(x.onGround) - Number(y.onGround))[0];
			let html = '';
			if (full && full.available && full.flights && full.flights.length) html += full.flights.map(statusCard).join('');
			else if (full && !full.available) html += '<p class="fa-panelnote">' + esc(full.reason || full.error || 'Full status is not available.') + '</p>';
			else if (full && full.error) html += '<p class="fa-panelnote">' + esc(full.error) + '</p>';
			else if (full) html += '<p class="fa-panelnote">No scheduled flight was found for ' + esc(q) + ' today.</p>';
			else html += '<p class="fa-panelnote"><a href="' + this._root + '/login">Sign in</a> to see scheduled times, delay, terminal and gate.</p>';
			if (live.error) html += '<p class="fa-panelnote">' + esc(live.error) + '</p>';
			else if (a) html += '<div class="fa-trackcard"><div class="fa-trackhead"><b>' + esc(a.callsign) + '</b> <span>in the air now</span><i class="fa-badge departed">Live</i></div><p class="fa-trackroutetxt fa-panelnote"></p>' + tiles(a) + '<div class="fa-trackmap"></div><p class="fa-trackphoto"></p><p class="fa-credit">Aircraft position: adsb.fi open data, updated every 20 seconds.</p></div>';
			else html += '<p class="fa-panelnote">No aircraft is broadcasting under ' + esc(q) + ' right now. The flight may not have left yet, may have landed, or may be outside radio coverage.</p>';
			out.innerHTML = html;
			if (!a || live.error) return;
			await this.loadLeaflet();
			const el = out.querySelector('.fa-trackmap');
			if (!el) return;
			map = L.map(el).setView([a.lat, a.lon], 6);
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 12, attribution: '&copy; OpenStreetMap contributors'}).addTo(map);
			marker = L.marker([a.lat, a.lon], {icon: planeIcon(a)}).addTo(map);
			this.json('/o/flight-live/route?callsign=' + encodeURIComponent(a.callsign)).then((r) => { const t = out.querySelector('.fa-trackroutetxt'); if (t && r && r.origin && r.destination) t.textContent = 'Route: ' + (r.origin.city || r.origin.name || '') + ' (' + r.origin.code + ') to ' + (r.destination.city || r.destination.name || '') + ' (' + r.destination.code + ')'; }).catch(() => {});
			this.json('/o/flight-live/photo?hex=' + encodeURIComponent(a.hex)).then((p) => { const t = out.querySelector('.fa-trackphoto'); if (t && p && p.url) t.innerHTML = '<img src="' + esc(p.url) + '" alt="" style="max-width:260px;border-radius:8px">' + (p.credit ? '<small>' + esc(p.credit) + '</small>' : ''); }).catch(() => {});
			timer = setInterval(async () => {
				if (!root.isConnected || current !== q) return clearInterval(timer);
				try {
					const again = ((await this.json('/o/flight-live/track?q=' + encodeURIComponent(q))).aircraft || [])[0];
					if (!again) return;
					marker.setLatLng([again.lat, again.lon]).setIcon(planeIcon(again));
					map.panTo([again.lat, again.lon]);
					const old = out.querySelector('.fa-tracktiles');
					if (old) old.outerHTML = tiles(again);
				} catch (e) {}
			}, 20000);
		};
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const q = form.q.value.trim();
			if (q) show(q);
		});
		const preset = new URLSearchParams(location.search).get('track');
		if (preset) { form.q.value = preset; show(preset); }
	}

	// Dashboard card for the real flight data feed: connected or not, last sync, calls used, and a Sync now button.
	async bindFeed(view) {
		const card = view.querySelector('.fa-feedcard');
		if (!card) return;
		const draw = async (message) => {
			let s;
			try {
				const res = await fetch('/o/flight-feed/status', {credentials: 'include'});
				if (!res.ok) throw new Error('HTTP ' + res.status);
				s = await res.json();
			} catch (e) {
				card.innerHTML = '<h3>Live flight data</h3><p class="fa-panelnote">The feed is not available (' + esc(e.message) + ').</p>';
				return;
			}
			card.innerHTML = '<h3>Live flight data</h3>' + (s.enabled
				? '<p>Connected. Last sync: <b>' + (s.lastRun === 'never' ? 'never' : esc(fmtDate(s.lastRun) + ' ' + fmtTime(s.lastRun))) + '</b></p><p class="fa-panelnote">' + esc(message || s.lastResult) + '</p><p>Calls this month: <b>' + esc(s.callsThisMonth) + ' of ' + esc(s.monthlyLimit) + '</b></p><p class="fa-panelnote">Live check of planes in the air (every 2 minutes, free): <b>' + esc(s.liveLast && s.liveLast.indexOf('T') > 0 ? fmtTime(s.liveLast.split(' ')[0]) + ' ' + s.liveLast.slice(s.liveLast.indexOf(' ')) : (s.liveLast || 'not yet')) + '</b><br>Airport boards: <b>' + esc(s.boards || 'not yet') + '</b><br>Webhook: <b>' + (s.webhookOn ? 'on (POST /o/flight-feed/webhook)' : 'off') + '</b></p><button class="fa-btn block-auto fa-feedsync" type="button">Sync now</button>'
				: '<p>Not connected.</p><p class="fa-panelnote">Add <b>FEED_API_KEY</b> to <b>bundles/data/flight-feed.properties</b> (a free key from aviationstack.com) to load real flights and delays automatically. Flights you type in yourself are never changed by the feed.</p>');
			const btn = card.querySelector('.fa-feedsync');
			if (btn) btn.addEventListener('click', async () => {
				btn.disabled = true;
				btn.textContent = 'Syncing...';
				try {
					const out = await getFetch()('/o/flight-feed/sync', {method: 'POST', credentials: 'include'});
					const data = await out.json();
					draw(out.ok ? JSON.parse(JSON.stringify(data)).result : data.error);
				} catch (e) {
					draw('The sync failed: ' + e.message);
				}
			});
		};
		draw();
	}

	// Gate scan: look up a boarding pass from its QR link and mark the passenger as boarded.
	bindGate(view) {
		const input = view.querySelector('.fa-gatecode'), out = view.querySelector('.fa-gateresult'), video = view.querySelector('.fa-gatevideo');
		let stream = null;
		const stopCamera = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; video.hidden = true; };
		const show = (p) => {
			const at = (v) => esc(fmtDate(v) + ' ' + fmtTime(v));
			const boarded = p.boardedAt ? '<div class="fa-gatestate ok">Boarded at ' + esc(fmtTime(p.boardedAt)) + '</div>' : '<div class="fa-gatestate">Not boarded yet</div>';
			out.innerHTML = '<div class="fa-gatecard">' + boarded + '<h3>' + esc(p.passengerName) + '</h3><dl class="fa-kv">' +
				[['Flight', p.flightNumber], ['Route', p.origin + ' \u2192 ' + p.destination], ['Departs', ''], ['Gate', p.gate], ['Seat', p.seat], ['Class', p.travelClass && p.travelClass !== 'null' ? p.travelClass : 'Economy'], ['PNR', p.pnr], ['Email', p.passengerEmail], ['Extras', addOnText(p.baggageKg, p.meal) || '-']]
					.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + (r[0] === 'Departs' ? at(p.departureTime) : esc(r[1])) + '</dd></div>').join('') + '</dl>' +
				(p.boardedAt ? '' : '<button class="fa-btn block-auto fa-gateboard" type="button">Mark as boarded</button>') + '<div class="fa-error" hidden></div></div>';
			const btn = out.querySelector('.fa-gateboard');
			if (btn) btn.addEventListener('click', async () => {
				btn.disabled = true;
				try {
					await this.gateCall('POST', '/gate/board', {code: input.value});
					check();
				} catch (x) {
					const err = out.querySelector('.fa-error');
					err.textContent = x.message;
					err.hidden = false;
					btn.disabled = false;
				}
			});
		};
		const check = async () => {
			if (!input.value.trim()) return;
			out.innerHTML = '<p class="fa-panelnote">Checking...</p>';
			try {
				show(await this.gateCall('GET', '/gate/lookup?code=' + encodeURIComponent(input.value.trim())));
			} catch (x) {
				out.innerHTML = '<div class="fa-gatecard"><div class="fa-gatestate bad">' + esc(x.message) + '</div></div>';
			}
		};
		view.querySelector('.fa-gatego').addEventListener('click', check);
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
		view.querySelector('.fa-gatecam').addEventListener('click', async () => {
			if (stream) return stopCamera();
			if (!window.isSecureContext || !navigator.mediaDevices) { out.innerHTML = '<p class="fa-panelnote">The camera works only on localhost or HTTPS. Paste the link from the pass instead.</p>'; return; }
			try {
				if (!window.jsQR) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; sc.onload = ok; sc.onerror = () => no(new Error('Could not load the scanner')); document.head.appendChild(sc); });
				stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
				video.srcObject = stream;
				video.hidden = false;
				await video.play();
				const canvas = document.createElement('canvas'), g = canvas.getContext('2d', {willReadFrequently: true});
				const tick = () => {
					if (!stream) return;
					if (video.videoWidth) {
						canvas.width = video.videoWidth;
						canvas.height = video.videoHeight;
						g.drawImage(video, 0, 0);
						const hit = window.jsQR(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
						if (hit && hit.data) { input.value = hit.data; stopCamera(); check(); return; }
					}
					requestAnimationFrame(tick);
				};
				tick();
			} catch (x) {
				stopCamera();
				out.innerHTML = '<p class="fa-panelnote">Could not start the camera: ' + esc(x.message) + '</p>';
			}
		});
	}

	async gateCall(method, path, body) {
		const res = await getFetch()('/o/flight-boarding' + path, {method, credentials: 'include', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
		let data = {};
		try { data = await res.json(); } catch (e) {}
		if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
		return data;
	}

	bindReservations(view, rows) {
		const q = view.querySelector('.fa-resq'), fl = view.querySelector('.fa-resflight'), st = view.querySelector('.fa-resstatus'), dt = view.querySelector('.fa-resdate');
		let sort = 'created', dir = -1;
		const draw = () => {
			const t = q.value.trim().toLowerCase();
			const list = rows.filter((r) => (!t || [r.pnr, r.name, r.account, r.email, r.flight, r.air].join(' ').toLowerCase().includes(t)) && (!fl.value || r.flight === fl.value) && (!st.value || r.status === st.value) &&
				(!dt.value || (r.dep && new Date(r.dep).toLocaleDateString('en-CA') === dt.value))).sort((a, b) => (a[sort] > b[sort] ? 1 : a[sort] < b[sort] ? -1 : 0) * dir);
			view.querySelector('tbody').innerHTML = list.map((r) => '<tr><td>' + esc(r.name) + (r.email ? '<br><small>' + esc(r.email) + '</small>' : '') + '</td><td>' + (r.account ? esc(r.account) : '-') + '</td>' +
				'<td>' + esc(r.flight) + (r.air ? '<br><small>' + esc(r.air) + '</small>' : '') + '</td><td>' + (r.dep ? esc(fmtDate(r.dep) + ' ' + fmtTime(r.dep)) : '?') + '</td><td>' + esc(r.route) + '</td><td>' + esc(r.cls) + '</td>' +
				'<td>' + (r.seat ? esc(r.seat) + (seatFee(r.seat) ? ' <small>(&#8377;' + seatFee(r.seat) + ' seat)</small>' : '') : '-') + '</td><td>' + esc(r.pnr) + '</td>' +
				'<td><span class="fa-badge ' + (r.status === 'Checked in' ? 'landed' : r.status === 'Booked' ? 'ontime' : 'delayed') + '">' + esc(r.status) + '</span></td></tr>').join('');
			view.querySelector('.fa-rescount').textContent = 'Showing ' + list.length + ' of ' + rows.length;
			view.querySelector('.fa-resempty').hidden = !!list.length;
		};
		[q, fl, st, dt].forEach((el) => el.addEventListener('input', draw));
		view.querySelector('.fa-resclear').addEventListener('click', () => { q.value = fl.value = st.value = dt.value = ''; draw(); });
		view.querySelectorAll('th[data-s]').forEach((th) => th.addEventListener('click', () => { dir = sort === th.dataset.s ? -dir : 1; sort = th.dataset.s; draw(); }));
		draw();
	}

	adminTable(headers, rows) {
		if (!rows.length) return '<div class="fa-msg">Nothing here yet. Use the Add button.</div>';
		return '<div class="fa-tablewrap"><table class="fa-table"><thead><tr>' + headers.map((h) => '<th>' + h + '</th>').join('') + '<th></th></tr></thead><tbody>' +
			rows.map((r) => '<tr>' + r[1].map((c) => '<td>' + c + '</td>').join('') + `<td class="fa-actions"><button class="fa-iconbtn" data-edit="${r[0]}" title="Edit" aria-label="Edit"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button><button class="fa-iconbtn danger" data-del="${r[0]}" title="Delete" aria-label="Delete"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button></td></tr>`).join('') +
			'</tbody></table></div>';
	}

	// One field of the simple add/edit form: text (default), textarea, select, checkbox, airport (an airport code) or suggest (text with ideas from what was typed before).
	fieldHtml(f, item, data) {
		const value = item ? item[f.k] : '';
		const label = (input) => `<label>${f.l}${input}</label>`;
		if (f.type === 'checkbox') return `<label class="fa-check"><input name="${f.k}" type="checkbox" ${(item ? item[f.k] : true) ? 'checked' : ''} /> ${f.l}</label>`;
		if (f.type === 'textarea') return label(`<textarea name="${f.k}" rows="4" ${f.req ? 'required' : ''}>${esc(value)}</textarea>`);
		const options = f.type === 'airport' ? data.airports.map((a) => [a.code, a.code + ' \u2013 ' + a.city]) : f.options;
		if (options) return label(`<select name="${f.k}" ${f.req ? 'required' : ''}>${options.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(value) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`);
		const list = f.type === 'suggest' ? `list="fa-list-${f.k}"` : '';
		const ideas = f.type === 'suggest' ? `<datalist id="fa-list-${f.k}">${[...new Set((data.items || []).map((x) => x[f.k]).filter(Boolean))].map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>` : '';
		return label(`<input name="${f.k}" ${list} ${f.req ? 'required' : ''} value="${esc(value)}" />${ideas}`);
	}

	adminForm(view, kind, item, data) {
		const ENT = this.adminEntities(), E = ENT[kind];
		const toLocal = (v) => {
			const d = parseDate(v);
			if (!d) return '';
			const p = (n) => String(n).padStart(2, '0');
			return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
		};
		const opt = (arr, sel) => arr.map((a) => `<option value="${esc(a[0])}" ${String(a[0]) === String(sel) ? 'selected' : ''}>${esc(a[1])}</option>`).join('');
		let fields;
		if (kind === 'flights') {
			const apOpts = data.airports.map((a) => [a.id, a.code + ' – ' + a.city]);
			fields = `<div class="fa-two"><label>Flight number<input name="flightNumber" required value="${esc(item ? item.flightNumber : '')}" /></label>` +
				`<label>Airline<select name="airline"><option value="">(choose or type the flight number)</option>${AIRLINES.map((a) => `<option value="${esc(a[1])}" ${a[1] === airlineOf(item && item.flightNumber, item && item.airline) ? 'selected' : ''}>${esc(a[1] + ' (' + a[0] + ')')}</option>`).join('')}</select></label></div>` +
				`<label>Status<select name="showstatus">${opt(E.statuses, item && item.showstatus ? item.showstatus.key : 'OnTime')}</select></label>` +
				`<div class="fa-two"><label>From<select name="origin" required>${opt(apOpts, item && item.r_originAirport_c_airportId)}</select></label>` +
				`<label>To<select name="destination" required>${opt(apOpts, item && item.r_destinationAirport_c_airportId)}</select></label></div>` +
				`<div class="fa-two"><label>Departure<input name="departureTime" type="datetime-local" required value="${toLocal(item && item.departureTime)}" /></label>` +
				`<label>Arrival<input name="arrivalTime" type="datetime-local" required value="${toLocal(item && item.arrivalTime)}" /></label></div>` +
				`<label>Delay (minutes)<input name="delayMinutes" type="number" min="0" value="${item ? item.delayMinutes || 0 : 0}" /></label>` +
				(item ? '' : `<label>Also create the same flight for the next (days)<input name="repeat" type="number" min="0" max="30" value="0" /><span class="fa-hint">0 adds only this flight. The most you can add is 30 days.</span></label>`);
		} else if (kind === 'bookings') {
			const pnr = item ? item.pnr : Array.from({length: 6}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
			const apOpts = data.airports.map((a) => [a.id, a.city + ', ' + a.country + ' (' + a.code + ')']);
			const cur = item ? (data.flights.find((f) => String(f.id) === String(item.flightId)) || data.flights.find((f) => f.flightNumber === item.flightNumber)) : data.flights[0];
			const today = new Date().toLocaleDateString('en-CA');
			const startDay = cur && item ? (parseDate(cur.departureTime) || new Date()).toLocaleDateString('en-CA') : today;
			fields = `<label>Booking code (PNR)<input name="pnr" required maxlength="12" value="${esc(pnr)}" /></label>` +
				`<div class="fa-two"><label>From (city, country)<select name="from">${opt(apOpts, cur && cur.r_originAirport_c_airportId)}</select></label>` +
				`<label>To (city, country)<select name="to">${opt(apOpts, cur && cur.r_destinationAirport_c_airportId)}</select></label></div>` +
				`<div class="fa-two"><label>Date<input type="date" name="date" required value="${startDay}" /></label><label>Flight<select name="flightId"></select></label></div>` +
				`<div class="fa-routehint-box"><span class="fa-hint fa-routehint"></span><div class="fa-createflight"></div></div>` +
				`<div class="fa-two"><label>First name<input name="firstName" required value="${esc(item ? item.firstName : '')}" /></label>` +
				`<label>Last name<input name="lastName" required value="${esc(item ? item.lastName : '')}" /></label></div>` +
				`<label>Passenger email (optional, gives flight notifications)<input name="email" type="email" value="${esc(item ? item.email || '' : '')}" /></label>` +
				`<div class="fa-two"><label>Class<select name="travelClass">${opt(Object.entries(CLASS_LABEL), classOf(item && item.travelClass))}</select></label>` +
				`<label>Status<select name="bookingStatus">${opt([['Booked', 'Booked'], ['CheckedIn', 'Checked in'], ['Cancelled', 'Cancelled']], item ? item.bookingStatus : 'Booked')}</select></label></div>`;
		} else {
			fields = E.fields.map((f) => this.fieldHtml(f, item, data)).join('');
		}
		const modal = document.createElement('div');
		modal.className = 'fa-modal';
		modal.innerHTML = `<div class="fa-modalbox"><h2>${item ? 'Edit' : 'Add'} ${E.label}</h2><form class="fa-authform">${fields}<div class="fa-error" hidden></div>` +
			'<div class="fa-two"><button class="fa-btn block" type="submit">Save</button><button class="fa-btn block ghost" type="button" data-cancel>Cancel</button></div></form></div>';
		this.appendChild(modal);
		modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
		const form = modal.querySelector('form'), err = modal.querySelector('.fa-error');
		if (kind === 'flights') {
			form.flightNumber.addEventListener('input', () => {
				const guess = airlineOf(form.flightNumber.value, '');
				if (guess) form.airline.value = guess;
			});
		}
		const dayOf = (v) => { const d = parseDate(v); return d ? d.toLocaleDateString('en-CA') : ''; };
		const flightPayload = (tpl, dateStr) => {
			const tdep = parseDate(tpl.departureTime), tarr = parseDate(tpl.arrivalTime);
			const dep = new Date(dateStr + 'T' + String(tdep.getHours()).padStart(2, '0') + ':' + String(tdep.getMinutes()).padStart(2, '0') + ':00');
			const arr = new Date(dep.getTime() + (tarr - tdep));
			return {
				flightNumber: tpl.flightNumber, airline: tpl.airline || airlineOf(tpl.flightNumber, ''), showstatus: 'OnTime',
				departureTime: dep.toISOString(), arrivalTime: arr.toISOString(), flightDurationMinutes: Math.round((arr - dep) / 60000), delayMinutes: 0,
				r_originAirport_c_airportId: tpl.r_originAirport_c_airportId, r_destinationAirport_c_airportId: tpl.r_destinationAirport_c_airportId,
				r_gate_c_airportId: tpl.r_gate_c_airportId || tpl.r_originAirport_c_airportId,
			};
		};
		if (kind === 'bookings') {
			const fillFlights = (keepId) => {
				const day = form.date.value;
				const onRoute = data.flights.filter((f) => String(f.r_originAirport_c_airportId) === form.from.value && String(f.r_destinationAirport_c_airportId) === form.to.value);
				const match = onRoute.filter((f) => dayOf(f.departureTime) === day).sort((x, y) => String(x.departureTime).localeCompare(String(y.departureTime)));
				form.flightId.innerHTML = match.map((f) => `<option value="${esc(f.id)}">${esc(f.flightNumber + (airlineOf(f.flightNumber, f.airline) ? ' ' + airlineOf(f.flightNumber, f.airline) : '') + ' · ' + fmtTime(f.departureTime))}</option>`).join('');
				if (keepId && match.some((f) => String(f.id) === String(keepId))) form.flightId.value = String(keepId);
				const hint = form.querySelector('.fa-routehint'), box = form.querySelector('.fa-createflight');
				box.innerHTML = '';
				if (match.length) { hint.textContent = ''; return; }
				if (!onRoute.length) { hint.textContent = 'No flight on this route yet. Add the flight first in the Flights tab.'; return; }
				hint.textContent = 'No flight on this route on ' + fmtDate(day + 'T12:00:00') + '. You can create it from an existing flight:';
				const seen = new Set();
				onRoute.filter((f) => !seen.has(f.flightNumber) && seen.add(f.flightNumber)).slice(0, 4).forEach((tpl) => {
					const b = document.createElement('button');
					b.type = 'button';
					b.className = 'fa-btn ghost fa-small';
					b.textContent = 'Create ' + tpl.flightNumber + ' for ' + fmtDate(day + 'T12:00:00');
					b.addEventListener('click', async () => {
						b.disabled = true;
						try {
							const created = await this.apiWrite('POST', ENT.flights.create, flightPayload(tpl, day));
							data.flights.push(created);
							fillFlights(created.id);
						} catch (x) {
							hint.textContent = 'Could not create the flight: ' + x.message;
							b.disabled = false;
						}
					});
					box.appendChild(b);
				});
			};
			form.from.addEventListener('change', () => fillFlights());
			form.to.addEventListener('change', () => fillFlights());
			form.date.addEventListener('change', () => fillFlights());
			fillFlights(item && (item.flightId || (cur0 => cur0 && cur0.id)(data.flights.find((f) => f.flightNumber === item.flightNumber))));
		}
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			let payload;
			if (kind === 'flights') {
				const dep = new Date(form.departureTime.value), arr = new Date(form.arrivalTime.value);
				if (form.origin.value === form.destination.value) { err.textContent = 'Origin and destination must be different.'; err.hidden = false; return; }
				if (!(arr > dep)) { err.textContent = 'Arrival must be after departure.'; err.hidden = false; return; }
				payload = {
					flightNumber: form.flightNumber.value.trim(), airline: form.airline.value || airlineOf(form.flightNumber.value, ''), showstatus: form.showstatus.value,
					departureTime: dep.toISOString(), arrivalTime: arr.toISOString(),
					flightDurationMinutes: Math.round((arr - dep) / 60000), delayMinutes: Number(form.delayMinutes.value || 0),
					r_originAirport_c_airportId: Number(form.origin.value), r_destinationAirport_c_airportId: Number(form.destination.value),
					r_gate_c_airportId: Number(form.origin.value),
				};
			} else if (kind === 'bookings') {
				const picked = data.flights.find((f) => String(f.id) === form.flightId.value);
				if (!picked) { err.textContent = 'Choose a flight for this date, or create it first.'; err.hidden = false; return; }
				const pnrValue = form.pnr.value.trim().toUpperCase();
				if (data.bookings.some((b) => b.pnr.toUpperCase() === pnrValue && (!item || b.id !== item.id))) { err.textContent = 'This booking code already exists.'; err.hidden = false; return; }
				payload = {pnr: pnrValue, flightNumber: picked.flightNumber, flightId: String(picked.id), email: form.email.value.trim(), firstName: form.firstName.value.trim(), lastName: form.lastName.value.trim(), travelClass: form.travelClass.value, bookingStatus: form.bookingStatus.value};
			} else {
				payload = Object.fromEntries(E.fields.map((f) => [f.k, f.type === 'checkbox' ? form[f.k].checked : form[f.k].value.trim()]));
			}
			const btn = form.querySelector('button[type=submit]');
			btn.disabled = true;
			try {
				let extra = 0;
				if (item) await this.apiWrite('PATCH', E.item + item.id, payload);
				else {
					await this.apiWrite('POST', E.create, payload);
					extra = kind === 'flights' ? Math.max(0, Math.min(30, Math.floor(Number(form.repeat.value) || 0))) : 0;
					for (let i = 1; i <= extra; i++) {
						const dep = new Date(payload.departureTime), arr = new Date(payload.arrivalTime);
						dep.setDate(dep.getDate() + i);
						arr.setDate(arr.getDate() + i);
						await this.apiWrite('POST', E.create, Object.assign({}, payload, {departureTime: dep.toISOString(), arrivalTime: arr.toISOString()}));
					}
				}
				modal.remove();
				this._airports = null;
				await this.renderAdmin(view, kind, {text: E.label + (item ? ' updated.' : extra ? 's added: ' + (extra + 1) + ' days.' : ' added.')});
			} catch (x) {
				err.textContent = 'Could not save: ' + x.message;
				err.hidden = false;
				btn.disabled = false;
			}
		});
	}

	authLinks(root, current) {
		const t = Liferay.ThemeDisplay;
		if (t.isSignedIn()) {
			const name = t.getUserName() || 'Account';
			const items = ROUTES.filter((r) => r.menu && r.auth).map((r) => `<a href="${root}/${r.slug}" class="fa-nav-link ${r.path === current ? 'active' : ''}">${r.label}</a>`).join('') + (this._isAdmin ? `<a href="${root}/admin" class="fa-nav-link">Admin portal</a>` : '');
			return '<div class="fa-bellwrap"><button type="button" class="fa-bell" aria-label="Notifications">' + ICONS.bell + '<span class="fa-bellcount" hidden></span></button><div class="fa-notes" hidden></div></div>' +
				'<div class="fa-usermenu"><button type="button" class="fa-userbtn" aria-haspopup="true" aria-expanded="false"><span class="fa-avatar">' + esc(name.trim().charAt(0).toUpperCase()) + '</span><span class="fa-uname">' + esc(name) + '</span><span class="fa-caret">&#9662;</span></button>' +
				'<div class="fa-usermenu-list" hidden><div class="fa-umhead">Signed in as<b>' + esc(name) + '</b></div>' + items +
				`<a class="fa-logout" href="${t.getPathContext()}/c/portal/logout?referer=${encodeURIComponent(root + '/login')}">Logout</a></div></div>`;
		}
			return `<a class="fa-btn fa-btn--outline fa-auth ${current === 'login' ? 'active' : ''}" href="${root}/login">Login</a><a class="fa-btn fa-btn--gold fa-auth ${current === 'register' ? 'active' : ''}" href="${root}/register">Register</a>`;
	}

	async loginUrl(extra) {
		const P = '_com_liferay_login_web_portlet_LoginPortlet_';
		const path = await this.signInPath();
		return location.origin + path + '?p_p_id=com_liferay_login_web_portlet_LoginPortlet&p_p_lifecycle=1&p_p_state=maximized&p_p_mode=view&' + P + 'jakarta.portlet.action=' + extra + '&' + P + 'mvcRenderCommandName=' + extra + '&p_auth=' + Liferay.authToken;
	}

	async post(url, fields) {
		const P = '_com_liferay_login_web_portlet_LoginPortlet_';
		const body = new URLSearchParams();
		Object.entries(fields).forEach(([k, v]) => body.append(P + k, v));
		return fetch(url, {method: 'POST', body, credentials: 'include'});
	}

	// One of the login pictures (AUTH_PHOTOS, saved in assets/hero), picked at random each time a login or register page is drawn, never the same twice in a row.
	authPhoto() {
		// Never one of the last two pictures shown (the page can be drawn twice while it loads).
		let recent = [];
		try { recent = (sessionStorage.getItem('faAuthPhoto') || '').split(',').filter(Boolean).map(Number); } catch (e) {}
		const choices = AUTH_PHOTOS.map((f, n) => n).filter((n) => !recent.includes(n));
		const i = choices[Math.floor(Math.random() * choices.length)];
		try { sessionStorage.setItem('faAuthPhoto', [i].concat(recent).slice(0, 2).join(',')); } catch (e) {}
		const credit = HERO_PHOTOS.find((p) => p[0] === AUTH_PHOTOS[i]) || [];
		return {file: AUTH_PHOTOS[i], credit: credit[1] ? credit[1] + ' (' + credit[2] + '), Wikimedia Commons' : 'Wikimedia Commons'};
	}

	// Login and Register share one look: an aircraft or airport picture beside the form. The photographer is named in the footer and in a hover text, not on the picture.
	authShell(title, cardTitle, subtitle, formHtml, altHtml) {
		const photo = this.authPhoto();
		Promise.resolve().then(() => { const credit = this.querySelector('.fa-footbar span:last-child'); if (credit) credit.textContent = 'Photo: ' + photo.credit; });
		return '<div class="fa-authpage has-photo" title="Photo: ' + esc(photo.credit) + '" style="background-image: linear-gradient(180deg, rgba(12,34,92,.50), rgba(8,18,50,.84)), url(\'/o/flight-status-app/hero/' + esc(photo.file) + '\')"><div class="fa-authwrap">' +
			'<h1 class="fa-authtitle">' + title + '</h1>' +
			'<section class="fa-authcard2"><header>' + cardTitle + '</header><div class="fa-authbody">' + (subtitle ? '<p class="fa-authsub">' + subtitle + '</p>' : '') + formHtml + altHtml + '</div></section>' +
			'</div></div>';
	}

	pwdToggle(view) {
		view.querySelectorAll('.fa-eye').forEach((btn) => btn.addEventListener('click', () => {
			const input = btn.previousElementSibling;
			const show = input.type === 'password';
			input.type = show ? 'text' : 'password';
			btn.textContent = show ? 'Hide' : 'Show';
		}));
	}

	async view_login(view) {
		if (Liferay.ThemeDisplay.isSignedIn()) {
			location.href = this._root + '/home';
			return;
		}
		const forgot = Liferay.ThemeDisplay.getPathContext() + '/c/portal/login?p_p_id=com_liferay_login_web_portlet_LoginPortlet&p_p_lifecycle=0&p_p_state=maximized&p_p_mode=view&_com_liferay_login_web_portlet_LoginPortlet_mvcRenderCommandName=%2Flogin%2Fforgot_password';
		view.innerHTML = this.authShell('Login to Flight Status Portal', 'Login', '',
			'<form class="fa-authform"><label>Email address<input name="login" type="email" required autocomplete="username" placeholder="name@domain.com" /></label>' +
			'<label>Password<span class="fa-pwd"><input name="password" type="password" required autocomplete="current-password" placeholder="Your password" /><button type="button" class="fa-eye" aria-label="Show password">Show</button></span></label>' +
			'<div class="fa-authrow"><label class="fa-check"><input type="checkbox" name="rememberMe" checked /> Remember me</label><a class="fa-forgot" href="' + forgot + '">Forgot password?</a></div>' +
			'<div class="fa-error" hidden></div><button class="fa-btn block" type="submit">LOG IN</button></form>',
			'<p class="fa-alt">Don\'t have an account? <a href="' + this._root + '/register">Create a new account</a></p>');
		fillAllPhotos(view);
		this.pwdToggle(view);
		// Two steps: password first, then the 6-digit code we e-mail. After the code the server gives a short login ticket (a JWT).
		const form = view.querySelector('form');
		let challenge = '';
		const codeStep = (d) => '<p class="fa-hint">We sent a 6-digit code by ' + (d.via === 'sms' ? 'SMS' : 'email') + ' to <b>' + esc(d.sent) + '</b>. It works for 5 minutes.</p>' +
			'<label>Login code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required placeholder="123456" /></label>' +
			'<div class="fa-error" hidden></div><button class="fa-btn block" type="submit">VERIFY AND LOG IN</button>' +
			'<p class="fa-alt"><a href="#" class="fa-resend">Send the code again</a>' + (d.via === 'sms' ? ' &middot; <a href="#" class="fa-email">Send by email instead</a>' : '') + ' &middot; <a href="#" class="fa-back">Use a different account</a></p>';
		const showStep = (d) => { form.innerHTML = codeStep(d); form.code.focus(); };
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const err = form.querySelector('.fa-error'), btn = form.querySelector('button[type=submit]');
			err.hidden = true;
			btn.disabled = true;
			try {
				const data = challenge ? await this.authCall('/verify', {challenge, code: form.code.value.trim()}) : await this.authCall('/login', {email: form.login.value.trim(), password: form.password.value});
				if (data.ticket) {
					location.href = this._root + '/home?flightTicket=' + encodeURIComponent(data.ticket);
					return;
				}
				challenge = data.challenge;
				showStep(data);
			} catch (x) {
				err.textContent = x.message;
				err.hidden = false;
				btn.disabled = false;
			}
		});
		form.addEventListener('click', async (e) => {
			const link = e.target.closest('.fa-resend, .fa-back, .fa-email');
			if (!link) return;
			e.preventDefault();
			if (link.classList.contains('fa-back')) return this.view_login(view);
			const err = form.querySelector('.fa-error');
			try {
				const d = await this.authCall('/resend', {challenge, via: link.classList.contains('fa-email') ? 'email' : ''});
				showStep(d);
				form.querySelector('.fa-error').textContent = 'A new code was sent.';
				form.querySelector('.fa-error').hidden = false;
				return;
			} catch (x) {
				err.textContent = x.message;
			}
			err.hidden = false;
		});
	}

	async authCall(path, body) {
		const res = await fetch('/o/flight-auth' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
		let data = {};
		try { data = await res.json(); } catch (e) {}
		if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
		return data;
	}


	async view_register(view) {
		if (Liferay.ThemeDisplay.isSignedIn()) {
			location.href = this._root + '/home';
			return;
		}
		view.innerHTML = this.authShell('Create your Flight Status account', 'Register', 'Track flights, follow alerts and get your boarding pass.',
			'<form class="fa-authform"><div class="fa-two"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>' +
			'<label>Username<input name="screenName" required pattern="[A-Za-z0-9._-]+" title="Letters, numbers, dot, dash or underscore" /></label>' +
			'<label>Email address<input name="emailAddress" type="email" required autocomplete="email" placeholder="name@domain.com" /></label>' +
			'<label>Mobile number<input name="phone" type="tel" required autocomplete="tel" placeholder="+919876543210" /></label><p class="fa-hint">We text a login code to this number. Include the country code, or type a 10-digit Indian number.</p>' +
			'<div class="fa-two"><label>Password<span class="fa-pwd"><input name="password1" type="password" required autocomplete="new-password" /></span></label>' +
			'<label>Confirm password<span class="fa-pwd"><input name="password2" type="password" required autocomplete="new-password" /></span></label></div>' +
			'<div class="fa-error" hidden></div><button class="fa-btn block" type="submit">CREATE ACCOUNT</button></form>',
			'<p class="fa-alt">Already have an account? <a href="' + this._root + '/login">Log in</a></p>');
		fillAllPhotos(view);
		const form = view.querySelector('form'), err = view.querySelector('.fa-error');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			if (form.password1.value !== form.password2.value) {
				err.textContent = 'Passwords do not match.';
				err.hidden = false;
				return;
			}
			// +country code and digits; a plain 10-digit Indian number gets +91
			let phone = form.phone.value.replace(/[\s()-]/g, '');
			if (/^0?[6-9]\d{9}$/.test(phone)) phone = '+91' + phone.slice(-10);
			if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
				err.textContent = 'Enter your mobile number with the country code, for example +919876543210.';
				err.hidden = false;
				return;
			}
			const btn = form.querySelector('button[type=submit]');
			btn.disabled = true;
			try {
				const home = this._root + '/home';
				const res = await this.post(await this.loginUrl('%2Flogin%2Fcreate_account'), {
					cmd: 'add', firstName: form.firstName.value, lastName: form.lastName.value, screenName: form.screenName.value,
					emailAddress: form.emailAddress.value, password1: form.password1.value, password2: form.password2.value,
					birthdayMonth: 0, birthdayDay: 1, birthdayYear: 1970, languageId: 'en_US', saveLastPath: 'false', redirect: home,
				});
				// Liferay answers with the form again and an error box when something is wrong; otherwise the account exists and is signed in.
				const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
				const alertBox = doc.querySelector('.alert-danger, .alert-error');
				if (!alertBox) {
					// Save the number now (the email and password prove who is asking); if that fails it is kept and saved on the next page.
					try {
						const saved = await fetch('/o/flight-auth/signup-phone', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: form.emailAddress.value.trim(), password: form.password1.value, phone})});
						if (!saved.ok) sessionStorage.setItem('faPendingPhone', phone);
					} catch (e) {
						sessionStorage.setItem('faPendingPhone', phone);
					}
					location.href = home;
					return;
				}
				err.textContent = alertBox.textContent.replace(/\s+/g, ' ').replace(/^\s*(Close\s*)?(Error:?\s*)?/i, '').trim() || 'Could not create the account. Please check your details.';
			} catch (x) {
				err.textContent = 'Could not register: ' + x.message;
			}
			err.hidden = false;
			btn.disabled = false;
		});
	}

	stats(flights, ap) {
		const delayed = flights.filter((f) => f.delayMinutes > 0 || statusClass(f.status) === 'delayed').length;
		const onTime = flights.length ? Math.round(((flights.length - delayed) / flights.length) * 100) : 100;
		return [
			{icon: 'plane', value: flights.length, label: 'Flights tracked'},
			{icon: 'shield', value: onTime + '%', label: 'On-time rate'},
			{icon: 'clock', value: delayed, label: 'Delayed flights'},
			{icon: 'building', value: Object.keys(ap).length, label: 'Airports'},
		];
	}

	// "Need help?" shortcuts on the Home page: every page in ROUTES that has a `help` entry.
	helpRow(root) {
		const cards = ROUTES.filter((r) => r.help).map((r) => `<a class="fa-helpcard" href="${root}/${r.slug}"><span class="fa-ico">${ICONS[r.help[2]]}</span><div><b>${esc(r.help[0])}</b><span>${esc(r.help[1])}</span></div></a>`);
		return cards.length ? '<section class="fa-section fa-helprow"><div class="fa-head"><h2>Need help?</h2></div><div class="fa-helpgrid">' + cards.join('') + '</div></section>' : '';
	}

	statTiles(stats) {
		return '<div class="fa-stats">' + stats.map((s) => `<div class="fa-stat"><span class="fa-ico">${ICONS[s.icon]}</span><div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div></div>`).join('') + '</div>';
	}

	flightRow(f, ap) {
		const o = ap[f.originAirportId] || {}, d = ap[f.destinationAirportId] || {};
		const following = this._followingFlights && this._followingFlights.has(String(f.id));
		const alertControl = Liferay.ThemeDisplay.isSignedIn()
			? `<button class="fa-alert-toggle" type="button" data-flight-id="${esc(f.id)}" aria-pressed="${following}">${following ? 'Following' : 'Get email alerts'}</button>`
			: `<a class="fa-alert-login" href="${this._root}/login">Sign in for email alerts</a>`;
		const dep = parseDate(f.departureTime), arr = parseDate(f.arrivalTime);
		const mins = dep && arr ? Math.round((arr - dep) / 60000) : 0;
		const duration = mins > 0 ? Math.floor(mins / 60) + 'h ' + String(mins % 60).padStart(2, '0') + 'm' : '';
		return `<article class="fa-fcard s-${statusClass(f.status)}">` +
			`<div class="fa-fc-air">${logoHtml(f.flightNumber, f.airline) || '<span class="fa-ico sm">' + ICONS.plane + '</span>'}<div><b>${esc(f.flightNumber)}</b>${f.airline ? '<span>' + esc(f.airline) + '</span>' : ''}</div></div>` +
			`<div class="fa-fc-route"><div class="fa-fc-end"><time>${fmtTime(f.departureTime)}</time><b>${esc(o.code || f.originAirportId)}</b><span>${esc(o.city || '')}</span></div>` +
			`<div class="fa-fc-mid"><span class="fa-fc-dur">${esc(duration)}</span><div class="fa-fc-track"><i></i>${ICONS.plane}</div><span class="fa-fc-date">${esc(fmtDate(f.departureTime))}</span></div>` +
			`<div class="fa-fc-end right"><time>${fmtTime(f.arrivalTime)}</time><b>${esc(d.code || f.destinationAirportId)}</b><span>${esc(d.city || '')}</span></div></div>` +
			`<div class="fa-fc-state"><span class="fa-badge ${statusClass(f.status)}">${esc(f.status)}</span>${Number(f.delayMinutes) > 0 ? `<small class="late">+${esc(f.delayMinutes)} min delay</small>` : ''}${alertControl}</div></article>`;
	}

	async view_home(view) {
		const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
		await this.loadFlightAlerts();
		this.bindFlightAlerts(view);
		const r = this._root;
		const popular = Object.values(ap).slice(0, 4);
		const features = [
			{icon: 'clock', title: 'Real-time updates', text: 'Departure, arrival and delay information straight from the airline systems.'},
			{icon: 'search', title: 'Fast flight search', text: 'Look up any flight by number or status in seconds.'},
			{icon: 'building', title: 'Airport directory', text: 'Browse every airport we cover with codes, names and cities.'},
			{icon: 'gate', title: 'Gate information', text: 'Know your terminal and gate before you head to the airport.'},
			{icon: 'bell', title: 'Email flight alerts', text: 'Follow a flight to get an email when its status, delay or gate changes.'},
			{icon: 'shield', title: 'Reliable data', text: 'One source of truth that every page of the portal reads from.'},
		];
		const airlines = [...new Set(flights.map((f) => f.airline).filter(Boolean))];
		const served = Object.values(ap).filter((a) => flights.some((f) => f.originAirportId == a.id || f.destinationAirportId == a.id));
		const star = served.length ? served[Math.floor(Date.now() / 86400000) % served.length] : null;
		const airportOpts = (sel) => '<option value="">Any airport</option>' + Object.values(ap).sort((x, y) => x.city.localeCompare(y.city)).map((a) => `<option value="${esc(a.id)}" data-code="${esc(a.code)}" ${String(a.id) === String(sel) ? 'selected' : ''}>${esc(a.city)} (${esc(a.code)})</option>`).join('');
		const routeKey = (f) => f.originAirportId + '>' + f.destinationAirportId;
		const seen = new Set();
		const routes = flights.filter((f) => !seen.has(routeKey(f)) && seen.add(routeKey(f))).slice(0, 8);
		view.innerHTML =
			'<section class="fa-herox" data-hero="1" title="Photo: ' + esc(HERO[1]) + ' (' + HERO[2] + '), Wikimedia Commons" data-photo-overlay="linear-gradient(180deg, rgba(8,18,50,.30) 0%, rgba(8,18,50,.55) 55%, rgba(8,18,50,.86) 100%)">' +
			'<div class="fa-herox-in"><span class="fa-pill">&#9679; Live flight tracking</span><h1>Know where your flight is, <em>before you leave</em></h1>' +
			'<p>Live departures, arrivals, gates and delays across every airport we cover, plus real aircraft on the map.</p>' +
			'</div><div class="fa-heropanel"><div><b data-live="air">-</b><span>Aircraft in the air now</span></div><div><b data-lbcount>-</b><span>Airports with live boards</span></div><div><b>20s</b><span>Aircraft position refresh</span></div></div></section>' +
			'<section class="fa-searchcard"><div class="fa-stabs"><button type="button" class="active" data-t="num">Flight number</button><button type="button" data-t="route">Route &amp; date</button><button type="button" data-t="board">Airport board</button></div>' +
			'<form class="fa-sform" data-p="num"><input name="q" placeholder="Flight number, airline or city, e.g. AI101 or IndiGo" /><button class="fa-btn" type="submit">Search flight</button></form>' +
			'<form class="fa-sform" data-p="route" hidden><label>From<select name="from">' + airportOpts('') + '</select></label><label>To<select name="to">' + airportOpts('') + '</select></label><label>Date<input type="date" name="date" /></label><button class="fa-btn" type="submit">Search flights</button></form>' +
			'<form class="fa-sform" data-p="board" hidden><label>Airport<select name="airport">' + Object.values(ap).sort((x, y) => x.city.localeCompare(y.city)).map((a) => `<option value="${esc(a.code)}">${esc(a.city)} (${esc(a.code)}) - ${esc(a.name)}</option>`).join('') + '</select></label><button class="fa-btn" type="submit">Open board</button></form>' +
			(routes.length ? '<div class="fa-poproutes"><span>Popular routes</span>' + routes.map((f) => `<a href="${r}/search?from=${esc(f.originAirportId)}&to=${esc(f.destinationAirportId)}">${esc((ap[f.originAirportId] || {}).code || '?')} &rarr; ${esc((ap[f.destinationAirportId] || {}).code || '?')}</a>`).join('') + '</div>' : '') + '</section>' +
			this.statTiles(this.stats(flights, ap)) +
			'<div class="fa-homegrid"><section class="fa-section fa-liveboard"><div class="fa-head"><div><span class="fa-eyebrow">Live from the airports</span><h2>Arrivals and departures right now</h2></div><a class="fa-headlink" href="' + r + '/flight-status">Open the full boards &rarr;</a></div>' +
			'<div class="fa-lbtabs" role="tablist"></div><div class="fa-lbbody"><div class="fa-skel"><i></i><i></i><i></i></div></div></section>' + this.helpRow(r) +
			'<section class="fa-checkin"><div class="fa-ck-text"><span class="fa-pill dark">Online check-in</span><h2>Check in and get your boarding pass</h2><p>Enter the booking code (PNR) and last name from your ticket. Check-in is free, and you can choose your own seat before the flight lands.</p></div>' +
			'<form class="fa-ckform"><input name="pnr" placeholder="PNR / booking code" autocomplete="off" maxlength="12" /><input name="last" placeholder="Last name" autocomplete="off" maxlength="40" /><button class="fa-btn" type="submit" disabled>Check in</button><small>' + (Liferay.ThemeDisplay.isSignedIn() ? 'Your booking code is on your ticket.' : 'You will be asked to sign in first.') + '</small></form></section>' +
			'<section class="fa-live fa-reveal"><div class="fa-live-text"><span class="fa-pill dark"><i class="fa-dot"></i> Live now</span><h2>Aircraft flying over India right now</h2><p>Real positions from open ADS-B data, refreshed every 20 seconds. Open the full map and click any plane to see where it is going, with its photo.</p>' +
			'<div class="fa-livestats"><div><b data-live="air">-</b><span>In the air</span></div><div><b data-live="alt">-</b><span>Average altitude</span></div><div><b data-live="ground">-</b><span>On the ground</span></div></div><a class="fa-btn" href="' + r + '/live-map">Open the live map</a></div><div class="fa-minimap tall"></div></section></div>' +
			'<div class="fa-twocol">' + ['Domestic', 'International'].map((k) => {
				const hits = flights.filter((f) => kindOf(f, ap) === k).slice(0, 3);
				return '<section class="fa-section"><div class="fa-head"><h2>' + k + ' flights</h2><a href="' + r + '/flight-status">View all &rarr;</a></div>' +
					(hits.length ? hits.map((f) => this.flightRow(f, ap)).join('') : '<div class="fa-msg">No ' + k.toLowerCase() + ' flights found.</div>') + '</section>';
			}).join('') + '</div>' +
			'<section class="fa-section fa-reveal"><div class="fa-head"><h2>Popular destinations</h2><a href="' + r + '/airports">All airports &rarr;</a></div><div class="fa-destgrid">' +
			served.slice(0, 12).map((a) => {
				const n = flights.filter((f) => f.originAirportId == a.id || f.destinationAirportId == a.id).length;
				return `<a class="fa-dest" href="${r}/airport-board?airport=${esc(a.code)}" data-photo-city="${esc(a.city)}" data-photo-country="${esc(a.country)}" data-photo-overlay="linear-gradient(180deg, rgba(8,18,50,.05) 30%, rgba(8,18,50,.85))"><span class="fa-destcount">${n} flight${n === 1 ? '' : 's'}</span><b>${esc(a.city)}</b><small>${esc(a.country)} &middot; ${esc(a.code)}</small></a>`;
			}).join('') + '</div><p class="fa-credit">City photos: Wikipedia &amp; Wikimedia Commons</p></section>' +
			'<section class="fa-steps fa-reveal"><div class="fa-head"><h2>How it works</h2></div><div class="fa-stepgrid">' +
			[['search', '1', 'Search', 'Find a flight by number, route, date or airline.'], ['bell', '2', 'Follow', 'Tap "Get email alerts" to hear about delays and gate changes.'], ['gate', '3', 'Check in', 'Enter your booking code, choose your seat and get your boarding pass.'], ['plane', '4', 'Fly', 'Watch your aircraft live on the map until it lands.']]
				.map((x) => `<div class="fa-step"><span class="fa-stepno">${x[1]}</span><span class="fa-ico">${ICONS[x[0]]}</span><b>${x[2]}</b><p>${x[3]}</p></div>`).join('') + '</div></section>' +
			(airlines.length ? '<section class="fa-section fa-reveal"><div class="fa-head"><h2>Airlines we track</h2></div><div class="fa-airlines">' + airlines.map((n) => `<div class="fa-airline">${logoHtml('', n)}<span>${esc(n)}</span></div>`).join('') + '</div></section>' : '') +
			'<section class="fa-counters fa-reveal"><div><b data-count="' + flights.length + '">0</b><span>Flights tracked</span></div><div><b data-count="' + Object.keys(ap).length + '">0</b><span>Airports</span></div><div><b data-count="' + airlines.length + '">0</b><span>Airlines</span></div><div><b data-count="' + this.stats(flights, ap)[1].value.replace('%', '') + '" data-suffix="%">0</b><span>On-time rate</span></div></section>' +
			'<section class="fa-cta"><div><h2>Ready to check your flight?</h2><p>Search by flight number or browse everything that is flying today.</p></div>' +
			'<a class="fa-btn" href="' + r + '/search">Search flights</a></section>';
 		fillAllPhotos(view);
		this.bindMiniMaps(view);
		this.bindLiveBoard(view, ap);
		const ck = view.querySelector('.fa-ckform');
		ck.addEventListener('input', () => { ck.querySelector('button').disabled = !(ck.pnr.value.trim() && ck.last.value.trim()); });
		ck.addEventListener('submit', (e) => {
			e.preventDefault();
			location.href = r + '/boarding-pass?pnr=' + encodeURIComponent(ck.pnr.value.trim()) + '&last=' + encodeURIComponent(ck.last.value.trim());
		});
		view.querySelectorAll('.fa-stabs button').forEach((b) => b.addEventListener('click', () => {
			view.querySelectorAll('.fa-stabs button').forEach((x) => x.classList.toggle('active', x === b));
			view.querySelectorAll('.fa-sform').forEach((f) => { f.hidden = f.dataset.p !== b.dataset.t; });
		}));
		view.querySelector('.fa-sform[data-p="num"]').addEventListener('submit', (e) => {
			e.preventDefault();
			location.href = r + '/search?q=' + encodeURIComponent(e.target.q.value.trim());
		});
		view.querySelector('.fa-sform[data-p="route"]').addEventListener('submit', (e) => {
			e.preventDefault();
			const p = new URLSearchParams();
			['from', 'to', 'date'].forEach((k) => { if (e.target[k].value) p.set(k, e.target[k].value); });
			location.href = r + '/search' + (p.toString() ? '?' + p : '');
		});
		view.querySelector('.fa-sform[data-p="board"]').addEventListener('submit', (e) => {
			e.preventDefault();
			location.href = r + '/airport-board?airport=' + encodeURIComponent(e.target.airport.value);
		});
	}

	// Home page: the airports whose own board we read, with the arrivals or departures around now. A tab for each airport.
	async bindLiveBoard(view, ap) {
		const box = view.querySelector('.fa-liveboard');
		if (!box) return;
		const tabs = box.querySelector('.fa-lbtabs'), body = box.querySelector('.fa-lbbody');
		let boards = [];
		try { boards = await this.json('/o/flight-live/boards?siteId=' + SITE_ID()); } catch (e) {}
		view.querySelectorAll('[data-lbcount]').forEach((e) => { e.textContent = boards.length; });
		if (!boards.length) { box.hidden = true; return; }
		const city = (code) => (Object.values(ap).find((a) => a.code === code) || {}).city || code;
		const st = this._lb = this._lb || {code: '', dir: 'A'};
		if (!boards.some((b) => b.airportCode === st.code)) st.code = boards.some((b) => b.airportCode === 'AMD') ? 'AMD' : boards[0].airportCode;
		const draw = async () => {
			tabs.innerHTML = boards.map((b) => `<button type="button" role="tab" class="fa-lbtab ${b.airportCode === st.code ? 'active' : ''}" data-c="${esc(b.airportCode)}"><b>${esc(b.airportCode)}</b><span>${esc(city(b.airportCode))}</span></button>`).join('') +
				'<span class="fa-lbdir"><button type="button" class="' + (st.dir === 'A' ? 'active' : '') + '" data-d="A">Arrivals</button><button type="button" class="' + (st.dir === 'D' ? 'active' : '') + '" data-d="D">Departures</button></span>';
			const from = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime();
			let rows = [];
			try { rows = await this.json('/o/flight-live/board?siteId=' + SITE_ID() + '&airport=' + st.code + '&dir=' + st.dir + '&from=' + from + '&to=' + (from + 86400000)); } catch (e) {}
			const when = (r) => Date.parse(r.estimated || r.scheduled) || 0;
			const now = Date.now(), sorted = rows.slice().sort((a, b) => when(a) - when(b)), recent = sorted.filter((r) => when(r) < now).slice(-3).concat(sorted.filter((r) => when(r) >= now).slice(0, 5));
			const label = (r) => {
				const t = String(r.statusText).toLowerCase();
				if (t.includes('cancel')) return ['Cancelled', 'cancelled'];
				if (t.includes('delay')) return ['Delayed', 'delayed'];
				if (st.dir === 'A') return (t.includes('arrived') || t.includes('baggage')) ? ['Arrived', 'landed'] : ['Expected', 'ontime'];
				return t.includes('depart') ? ['Departed', 'departed'] : /board|final|gate|check|security/.test(t) ? ['Boarding', 'boarding'] : ['Scheduled', 'ontime'];
			};
			body.innerHTML = '<div class="fa-lbrows">' + (recent.length ? recent.map((r) => { const l = label(r); return `<div class="fa-lbrow"><time>${fmtTime(r.estimated || r.scheduled)}</time><span class="fa-lbfl"><b>${esc(r.flightNumber)}</b><small>${esc(r.airline)}</small></span><span class="fa-lbto"><b>${esc(r.otherCode)}</b><small>${esc(r.otherCity)}</small></span><span class="fa-lbterm">${r.terminal ? 'T' + esc(r.terminal) : ''}</span><i class="fa-badge ${l[1]}">${l[0]}</i></div>`; }).join('') : '<p class="fa-panelnote">No more flights on this board today.</p>') +
				'</div><a class="fa-btn block-auto" href="' + this._root + '/flight-status?airport=' + encodeURIComponent(st.code) + '&dir=' + (st.dir === 'A' ? 'arr' : 'dep') + '">View the full ' + esc(city(st.code)) + ' board</a>';
		};
		tabs.addEventListener('click', (e) => {
			const c = e.target.closest('[data-c]'), d = e.target.closest('[data-d]');
			if (c) st.code = c.dataset.c; else if (d) st.dir = d.dataset.d; else return;
			draw();
		});
		draw();
	}

	// Flight Status: a search card (Flight No. / Route / Airport) and an airport board whose rows open to show the details of a flight.
	async view_flights(view) {
		await this.loadFlightAlerts();
		const guides = await this.guideRows();
		this.bindFlightAlerts(view);
		const day = (v) => { const d = parseDate(v); return d ? d.toLocaleDateString('en-CA') : ''; };
		const todayKey = new Date().toLocaleDateString('en-CA'), tomorrowKey = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
		const st = this._fs = this._fs || {tab: 'airport', airport: '', date: todayKey, dir: 'dep', terminal: '', airline: '', from: '', to: '', open: new Set()};
		const SITES = {'Air India': 'https://www.airindia.com', 'IndiGo': 'https://www.goindigo.in', 'SpiceJet': 'https://www.spicejet.com', 'Akasa Air': 'https://www.akasaair.com', 'Air India Express': 'https://www.airindiaexpress.com', 'Emirates': 'https://www.emirates.com', 'Singapore Airlines': 'https://www.singaporeair.com', 'American Airlines': 'https://www.aa.com', 'Delta Air Lines': 'https://www.delta.com', 'United Airlines': 'https://www.united.com', 'British Airways': 'https://www.britishairways.com', 'Virgin Atlantic': 'https://www.virginatlantic.com'};
		const COORDS = {DEL: [28.56, 77.10], BOM: [19.09, 72.87], BLR: [13.20, 77.71], CCU: [22.65, 88.45], MAA: [12.99, 80.17], HYD: [17.24, 78.43], AMD: [23.08, 72.63], JFK: [40.64, -73.78], LAX: [33.94, -118.41], DXB: [25.25, 55.36], LHR: [51.47, -0.45], SIN: [1.36, 103.99]};
		const WX = {0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'};
		let flights = [], ap = {};
		const load = async () => { [flights, ap] = await Promise.all([this.flights(), this.airports()]); };
		await load();
		// Airports whose own arrivals and departures board we read (BoardFlight rows). Their other airports may not be in our list: bap holds those.
		const boardCodes = new Set((await this.json('/o/flight-live/boards?siteId=' + SITE_ID()).catch(() => [])).map((b) => b.airportCode));
		const bap = {}, boardCache = {};
		const airportOf = (id) => ap[id] || bap[id] || {};
		const airports = Object.values(ap).sort((a, b) => String(a.city).localeCompare(String(b.city)));
		const wanted = new URLSearchParams(location.search), wantedAirport = wanted.get('airport') && Object.values(ap).find((a) => a.code === wanted.get('airport').toUpperCase());
		if (wantedAirport) { st.tab = 'airport'; st.airport = String(wantedAirport.id); st.dir = wanted.get('dir') === 'dep' ? 'dep' : 'arr'; st.date = todayKey; st.terminal = ''; st.airline = ''; }
		if (!st.airport || !ap[st.airport]) {
			const counts = {};
			flights.forEach((f) => { counts[f.originAirportId] = (counts[f.originAirportId] || 0) + 1; });
			st.airport = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || (airports[0] ? String(airports[0].id) : '');
		}

		const status = (f) => {
			if (f.source === 'board') return {label: f.boardLabel, cls: f.boardClass, note: f.boardNote};
			const d = Number(f.delayMinutes) || 0, s = f.status;
			if (['Departed', 'Landed', 'Cancelled', 'Boarding'].includes(s)) return {label: s, cls: statusClass(s), note: (d > 0 && s !== 'Cancelled') ? '+' + d + ' min' : ''};
			if (s === 'Delayed' || d >= 15) return {label: 'Delayed', cls: 'delayed', note: '+' + d + ' min'};
			return {label: 'Scheduled', cls: 'ontime', note: 'On time'};
		};
		const arrivals = () => st.tab === 'airport' && st.dir === 'arr';
		// A row of the airport's own board as a flight the page can show. The words on the boards are turned into one of our status classes.
		const boardStatus = (text, dir) => {
			const t = String(text).toLowerCase();
			if (t.includes('cancel')) return {label: 'Cancelled', cls: 'cancelled', note: ''};
			if (t.includes('delay')) return {label: 'Delayed', cls: 'delayed', note: ''};
			if (dir === 'A' && (t.includes('arrived') || t.includes('baggage') || t.includes('landed'))) return {label: 'Arrived', cls: 'landed', note: text === 'Arrived' ? '' : text};
			if (dir === 'D' && t.includes('depart')) return {label: 'Departed', cls: 'departed', note: ''};
			if (dir === 'D' && /board|final|gate|check|security/.test(t)) return {label: /board|final/.test(t) ? 'Boarding' : 'Check-in', cls: 'boarding', note: text};
			return {label: dir === 'A' ? 'Expected' : 'Scheduled', cls: 'ontime', note: text};
		};
		const boardAirportId = (code, city, here) => {
			if (code === here.code) return String(here.id);
			const real = Object.values(ap).find((a) => a.code === code);
			if (real) return String(real.id);
			bap['b:' + code] = {id: 'b:' + code, code, city: city || code, name: city || code, country: ''};
			return 'b:' + code;
		};
		const titleCase = (t) => String(t).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
		const boardToFlight = (r, code, dir) => {
			const here = ap[st.airport], other = boardAirportId(r.otherCode, r.otherCity, here), arr = dir === 'A';
			const late = Math.max(0, Math.round((Date.parse(r.estimated || r.scheduled) - Date.parse(r.scheduled)) / 60000)), bs = boardStatus(r.statusText, dir);
			return {id: 'b' + r.id, source: 'board', boardDir: dir, flightNumber: r.flightNumber, airline: titleCase(r.airline), delayMinutes: late, status: bs.label,
				boardLabel: bs.label, boardClass: bs.cls, boardNote: bs.note || (late >= 5 && bs.cls !== 'landed' && bs.cls !== 'departed' ? '+' + late + ' min' : ''),
				originAirportId: arr ? other : String(here.id), destinationAirportId: arr ? String(here.id) : other,
				departureTime: arr ? '' : (r.estimated || r.scheduled), scheduledDeparture: arr ? '' : r.scheduled, arrivalTime: arr ? (r.estimated || r.scheduled) : '', scheduledArrival: arr ? r.scheduled : '',
				depTerminal: arr ? '' : r.terminal, arrTerminal: arr ? r.terminal : '', depGate: arr ? '' : r.spot, arrGate: '', belt: arr ? r.spot : ''};
		};
		const boardKey = () => { const a = ap[st.airport]; return (st.tab === 'airport' && a && boardCodes.has(a.code)) ? a.code + '|' + (st.dir === 'arr' ? 'A' : 'D') + '|' + st.date : ''; };
		const boardRows = () => { const rows = boardCache[boardKey()]; return rows && rows.length ? rows : null; };
		const ensureBoard = async (force) => {
			const key = boardKey();
			if (!key || (boardCache[key] && !force)) return;
			const [code, dir, date] = key.split('|'), from = new Date(date + 'T00:00:00').getTime();
			try {
				const rows = await this.json('/o/flight-live/board?siteId=' + SITE_ID() + '&airport=' + code + '&dir=' + dir + '&from=' + from + '&to=' + (from + 86400000));
				boardCache[key] = rows.map((r) => boardToFlight(r, code, dir));
			} catch (e) {}
		};
		const termOf = (f) => (arrivals() ? f.arrTerminal : f.depTerminal) || '';
		const inScope = () => {
			if (boardRows()) return boardRows();
			if (st.tab === 'airport') {
				const key = arrivals() ? 'destinationAirportId' : 'originAirportId';
				return flights.filter((f) => String(f[key]) === String(st.airport) && day(arrivals() ? (f.arrivalTime || f.departureTime) : f.departureTime) === st.date);
			}
			return flights.filter((f) => (!st.from || String(f.originAirportId) === st.from) && (!st.to || String(f.destinationAirportId) === st.to) && day(f.departureTime) === st.date);
		};
		const results = () => {
			const t = (f) => String(arrivals() ? (f.arrivalTime || f.departureTime) : f.departureTime);
			const part = (f) => !(boardRows() && arrivals() && st.arrState) || (st.arrState === 'arrived' ? f.boardClass === 'landed' : f.boardClass !== 'landed' && f.boardClass !== 'cancelled');
			return inScope().filter((f) => !st.terminal || termOf(f) === st.terminal).filter((f) => !st.airline || f.airline === st.airline).filter(part).sort((a, b) => t(a).localeCompare(t(b)));
		};
		const options = (list, current, all) => '<option value="">' + all + '</option>' + list.map((x) => '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(current) ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('');
		const airportOptions = (current, all) => options(airports.map((a) => [String(a.id), a.city + ' (' + a.code + ')']), current, all);
		const dateControls = () => '<div class="fa-fsdate"><button type="button" class="fa-chip ' + (st.date === todayKey ? 'active' : '') + '" data-d="' + todayKey + '">Today</button><button type="button" class="fa-chip ' + (st.date === tomorrowKey ? 'active' : '') + '" data-d="' + tomorrowKey + '">Tomorrow</button><input type="date" class="fa-fsdateinput" value="' + st.date + '" /></div>';

		const boardDetails = (f, o, d, s) => {
			const arr = f.boardDir === 'A', sched = arr ? f.scheduledArrival : f.scheduledDeparture, when = arr ? f.arrivalTime : f.departureTime, done = s.cls === 'landed' || s.cls === 'departed';
			const here = arr ? d : o, site = SITES[f.airline];
			return '<div class="fa-fdetail"><div class="fa-fplaces"><div>' + esc(o.name || o.city || '') + '<b>' + esc(o.code || '') + '</b></div><div class="r">' + esc(d.name || d.city || '') + '<b>' + esc(d.code || '') + '</b></div></div>' +
				'<div class="fa-ftimes"><div><b>' + fmtTime(sched) + '</b><small>Scheduled</small></div><div class="c"><i>' + esc(s.label) + '</i><small>' + esc(s.note) + '</small></div><div class="r"><b>' + fmtTime(when) + '</b><small>' + (done ? (arr ? 'Arrived' : 'Departed') : 'Expected') + '</small></div></div>' +
				'<div class="fa-fcols"><div class="fa-perfcard"><h4>At ' + esc(here.code || 'the airport') + '</h4><p>' + (termOf(f) ? 'Terminal <b>' + esc(termOf(f)) + '</b>' : 'Terminal not listed') + (arr ? (f.belt ? ' &middot; Baggage belt <b>' + esc(f.belt) + '</b>' : '') : (f.depGate ? ' &middot; Gate <b>' + esc(f.depGate) + '</b>' : '')) + '</p><p class="fa-panelnote">Live from the airport\'s own flight board.</p></div></div>' +
				'<div class="fa-factions"><button class="fa-btn block-auto" type="button" data-track="' + esc(f.flightNumber) + '">Track live</button>' + this.guideButton(here, guides, 'To and from ' + (here.code || 'the airport')) + (site ? '<a class="fa-chip" href="' + site + '" target="_blank" rel="noopener">' + esc(f.airline) + ' website</a>' : '') + '</div></div>';
		};
		const details = (f, o, d, s) => {
			if (f.source === 'board') return boardDetails(f, o, d, s);
			const dep = parseDate(f.departureTime), arr = parseDate(f.arrivalTime), mins = dep && arr ? Math.round((arr - dep) / 60000) : 0;
			const dur = mins > 0 ? Math.floor(mins / 60) + 'h ' + String(mins % 60).padStart(2, '0') + 'm' : '';
			const pct = s.label === 'Landed' ? 100 : s.label === 'Departed' ? 50 : 0;
			const past = flights.filter((x) => x.flightNumber === f.flightNumber && x.status !== 'Cancelled');
			const good = past.filter((x) => x.status !== 'Delayed' && (Number(x.delayMinutes) || 0) < 15).length;
			const perf = past.length >= 3 ? '<div class="fa-perf"><span>On-time</span><b>' + Math.round(good * 100 / past.length) + '%</b></div><div class="fa-perfbar"><i style="width:' + Math.round(good * 100 / past.length) + '%"></i></div><small>Based on ' + past.length + ' recorded flights</small>' : '<p class="fa-panelnote">Not enough data yet (' + past.length + ' recorded flight' + (past.length === 1 ? '' : 's') + ').</p>';
			const site = SITES[f.airline];
			const follow = Liferay.ThemeDisplay.isSignedIn() ? '<button class="fa-alert-toggle" type="button" data-flight-id="' + esc(f.id) + '" aria-pressed="' + (this._followingFlights && this._followingFlights.has(String(f.id))) + '">' + (this._followingFlights && this._followingFlights.has(String(f.id)) ? 'Following' : 'Get email alerts') + '</button>' : '<a class="fa-alert-login" href="' + this._root + '/login">Sign in for email alerts</a>';
			const place = (p, term, gate) => esc(p.name || p.city || '') + '<b>' + esc(p.code || '') + (term ? ' &middot; Terminal ' + esc(term) : '') + (gate ? ' &middot; Gate ' + esc(gate) : '') + '</b>';
			return '<div class="fa-fdetail"><div class="fa-fplaces"><div>' + place(o, f.depTerminal, f.depGate) + '</div><div class="r">' + place(d, f.arrTerminal, f.arrGate) + '</div></div>' +
				'<div class="fa-fbar"><i class="fa-fbarfill" style="width:' + pct + '%"></i><span class="fa-fplane" style="left:' + pct + '%">' + ICONS.plane + '</span></div>' +
				'<div class="fa-ftimes"><div><b>' + fmtTime(f.departureTime) + '</b><small class="' + status(f).cls + '">' + (s.note || s.label) + '</small><small>Scheduled ' + fmtTime(f.scheduledDeparture || f.departureTime) + '</small></div><div class="c"><i>' + esc(s.label) + '</i><small>' + esc(dur) + '</small></div>' +
				'<div class="r"><b>' + (f.arrivalTime ? fmtTime(f.arrivalTime) : '-') + '</b><small>Scheduled ' + (f.scheduledArrival || f.arrivalTime ? fmtTime(f.scheduledArrival || f.arrivalTime) : '-') + '</small></div></div>' +
				'<div class="fa-fcols"><div class="fa-wxcard fa-wx" data-code="' + esc(d.code) + '"><h4>Weather at ' + esc(d.city || d.code) + '</h4><p class="fa-wxtext">Loading...</p></div><div class="fa-perfcard"><h4>Flight performance</h4>' + perf + '</div></div>' +
				'<div class="fa-factions"><button class="fa-btn block-auto" type="button" data-track="' + esc(f.flightNumber) + '">Track live</button>' + follow + this.guideButton(o, guides, 'Getting to ' + (o.code || 'the airport')) + (site ? '<a class="fa-chip" href="' + site + '" target="_blank" rel="noopener">' + esc(f.airline) + ' website</a>' : '') + '</div></div>';
		};
		const row = (f) => {
			const o = airportOf(f.originAirportId), d = airportOf(f.destinationAirportId), s = status(f), air = st.tab === 'airport', open = st.open.has(String(f.id));
			const other = air ? (arrivals() ? o : d) : null, time = arrivals() ? (f.arrivalTime || f.departureTime) : f.departureTime;
			const term = arrivals() ? f.arrTerminal : f.depTerminal, spot = arrivals() ? (f.belt ? 'Belt ' + f.belt : (f.arrGate ? 'Gate ' + f.arrGate : '')) : (f.depGate ? 'Gate ' + f.depGate : '');
			const place = air ? '<span class="fa-fplace"><b>' + (term ? 'T' + esc(term) : '&mdash;') + '</b><small>' + esc(spot) + '</small></span>' : '';
			return '<div class="fa-frow' + (open ? ' open' : '') + '"><button type="button" class="fa-fhead' + (air ? ' fa-fhead--air' : '') + '" data-id="' + esc(f.id) + '" aria-expanded="' + open + '">' +
				'<span class="fa-fair">' + (logoHtml(f.flightNumber, f.airline) || '') + '<span><b>' + esc(airlineOf(f.flightNumber, f.airline) || '') + '</b><small>' + esc(f.flightNumber) + '</small></span></span>' +
				'<span class="fa-fto"><b>' + esc(air ? (other.code || '?') : (o.code || '?') + ' → ' + (d.code || '?')) + '</b><small>' + esc(air ? (other.city || '') : (o.city || '') + ' to ' + (d.city || '')) + '</small></span>' +
				'<span class="fa-ftime"><b>' + fmtTime(time) + '</b>' + (f.source === 'board' && (arrivals() ? f.scheduledArrival : f.scheduledDeparture) && fmtTime(arrivals() ? f.scheduledArrival : f.scheduledDeparture) !== fmtTime(time) ? '<small>Sched ' + fmtTime(arrivals() ? f.scheduledArrival : f.scheduledDeparture) + '</small>' : '') + (f.source !== 'board' && f.scheduledDeparture && !arrivals() && fmtTime(f.scheduledDeparture) !== fmtTime(f.departureTime) ? '<small>Sched ' + fmtTime(f.scheduledDeparture) + '</small>' : '') + '</span>' +
				place + '<span class="fa-fstat"><i class="fa-badge ' + s.cls + '">' + esc(s.label) + '</i>' + (s.note ? '<small class="' + s.cls + '">' + esc(s.note) + '</small>' : '') + '</span>' +
				'<span class="fa-fmore">' + (open ? 'Hide details' : 'View details') + '</span></button>' + (open ? details(f, o, d, s) : '') + '</div>';
		};

		const fillWeather = () => view.querySelectorAll('.fa-wx[data-code]').forEach(async (el) => {
			const code = el.dataset.code, c = COORDS[code], text = el.querySelector('.fa-wxtext');
			if (!c) { text.textContent = 'Weather is not available for this airport.'; return; }
			this._wx = this._wx || {};
			try {
				if (!this._wx[code] || Date.now() - this._wx[code].at > 600000) {
					const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c[0] + '&longitude=' + c[1] + '&current=temperature_2m,weather_code');
					const j = await res.json();
					this._wx[code] = {at: Date.now(), t: Math.round(j.current.temperature_2m), w: WX[j.current.weather_code] || 'Weather'};
				}
				text.innerHTML = '<b>' + this._wx[code].t + '°C</b> ' + esc(this._wx[code].w);
			} catch (e) { text.textContent = 'Weather is not available right now.'; }
		});
		const drawResults = () => {
			const box = view.querySelector('.fa-fsresults');
			if (!box) return;
			if (st.tab === 'flight') { box.innerHTML = ''; return; }
			const list = results();
			box.innerHTML = '<div class="fa-fshead"><h2>' + (st.tab === 'airport' ? esc(airportOf(st.airport).city || 'Airport') + ' ' + (arrivals() ? 'arrivals' : 'departures') : 'Flights on this route') + '</h2><span>' + list.length + ' flight' + (list.length === 1 ? '' : 's') + ' on ' + esc(fmtDate(st.date + 'T12:00:00')) + '</span>' + (st.tab === 'airport' ? this.guideButton(ap[st.airport], guides, 'To and from this airport') : '') + '</div>' +
				(boardRows() ? '<p class="fa-panelnote">Live from the airport\'s own arrivals and departures board.</p>' : '') + (list.length && st.tab === 'airport' ? '<div class="fa-fthead fa-fthead--air" aria-hidden="true"><span>Airline</span><span>' + (arrivals() ? 'From' : 'To') + '</span><span>' + (arrivals() ? 'Arrival' : 'Departure') + '</span><span>' + (arrivals() ? 'Terminal / belt' : 'Terminal / gate') + '</span><span>Status</span><span></span></div>' : '') + (list.length ? list.map(row).join('') : '<div class="fa-msg">No flights found for this day. Try another day or airport. Our live data covers only some flights each day.</div>');
			box.querySelectorAll('.fa-fhead').forEach((b) => b.addEventListener('click', () => { st.open.has(b.dataset.id) ? st.open.delete(b.dataset.id) : st.open.add(b.dataset.id); drawResults(); }));
			box.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => { st.tab = 'flight'; st.track = b.dataset.track; drawPane(); window.scrollTo({top: 0, behavior: 'smooth'}); }));
			fillWeather();
		};
		const drawPane = async () => {
			view.querySelectorAll('.fa-fstab').forEach((b) => b.classList.toggle('active', b.dataset.t === st.tab));
			const pane = view.querySelector('.fa-fspane');
			if (st.tab === 'airport') await ensureBoard();
			if (st.tab === 'flight') {
				pane.innerHTML = '<div class="fa-trackslot"></div>';
				this.bindTrack(pane.querySelector('.fa-trackslot'));
				if (st.track) { const f = pane.querySelector('.fa-trackform'); f.q.value = st.track; f.requestSubmit(); st.track = ''; }
			} else if (st.tab === 'route') {
				pane.innerHTML = '<div class="fa-fsctl"><label>From<select class="fa-fsfrom">' + airportOptions(st.from, 'Any airport') + '</select></label><label>To<select class="fa-fsto">' + airportOptions(st.to, 'Any airport') + '</select></label><div>' + dateControls() + '</div></div>';
			} else {
				const scoped = inScope();
				const terms = [...new Set(scoped.map(termOf).filter(Boolean))].sort(), lines = [...new Set(scoped.map((f) => f.airline).filter(Boolean))].sort();
				pane.innerHTML = '<div class="fa-fsctl"><label>Airport<select class="fa-fsairport">' + airportOptions(st.airport, '').replace('<option value=""></option>', '') + '</select></label><div>' + dateControls() + '</div>' +
					'<div class="fa-fsdir"><button type="button" class="' + (st.dir === 'dep' ? 'active' : '') + '" data-dir="dep">Departures</button><button type="button" class="' + (st.dir === 'arr' ? 'active' : '') + '" data-dir="arr">Arrivals</button></div>' +
					(boardRows() && arrivals() ? '<div class="fa-fsdir fa-fsarr">' + [['', 'All'], ['arrived', 'Arrived'], ['arriving', 'Arriving']].map((x) => '<button type="button" class="' + ((st.arrState || '') === x[0] ? 'active' : '') + '" data-arr="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' : '') +
					'<label>Terminal<select class="fa-fsterm">' + options(terms.map((t) => [t, 'Terminal ' + t]), st.terminal, 'All terminals') + '</select></label><label>Airline<select class="fa-fsline">' + options(lines.map((l) => [l, l]), st.airline, 'All airlines') + '</select></label></div>';
			}
			drawResults();
		};
		const bindPane = (e) => {
			const t = e.target;
			if (t.classList.contains('fa-fsairport')) { st.airport = t.value; st.terminal = ''; st.airline = ''; }
			else if (t.classList.contains('fa-fsfrom')) st.from = t.value;
			else if (t.classList.contains('fa-fsto')) st.to = t.value;
			else if (t.classList.contains('fa-fsterm')) st.terminal = t.value;
			else if (t.classList.contains('fa-fsline')) st.airline = t.value;
			else if (t.classList.contains('fa-fsdateinput')) { if (!t.value) return; st.date = t.value; st.terminal = ''; st.airline = ''; }
			else return;
			drawPane();
		};

		view.innerHTML = '<div class="fa-title"><h1>Flight Status Today</h1><p>Live departures and arrivals. Updated <span class="fa-fsstamp"></span> &middot; refreshes automatically.</p></div>' +
			'<section class="fa-fscard"><div class="fa-stabs fa-fstabs"><button type="button" class="fa-fstab" data-t="flight">Flight No.</button><button type="button" class="fa-fstab" data-t="route">Route</button><button type="button" class="fa-fstab" data-t="airport">Airport</button></div><div class="fa-fspane"></div></section>' +
			'<div class="fa-fsresults"></div>';
		const stamp = () => { const el = view.querySelector('.fa-fsstamp'); if (el) el.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}); };
		stamp();
		view.querySelectorAll('.fa-fstab').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.t; st.terminal = ''; st.airline = ''; drawPane(); }));
		view.querySelector('.fa-fscard').addEventListener('change', bindPane);
		view.querySelector('.fa-fscard').addEventListener('click', (e) => {
			const chip = e.target.closest('[data-d]'), dir = e.target.closest('[data-dir]'), arrState = e.target.closest('[data-arr]');
			if (chip) { st.date = chip.dataset.d; st.terminal = ''; st.airline = ''; drawPane(); }
			else if (arrState) { st.arrState = arrState.dataset.arr; drawPane(); }
			else if (dir) { st.dir = dir.dataset.dir; st.terminal = ''; drawPane(); }
		});
		drawPane();
		clearInterval(this._timer);
		this._timer = setInterval(async () => { try { await load(); if (boardKey()) await ensureBoard(true); stamp(); if (st.tab !== 'flight') drawResults(); } catch (e) {} }, 30000);
	}

	async view_search(view, q) {
		const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
		await this.loadFlightAlerts();
		this.bindFlightAlerts(view);
		const params = new URLSearchParams(location.search);
		const airports = Object.values(ap).sort((x, y) => x.city.localeCompare(y.city));
		const localDay = (v) => { const d = parseDate(v); return d ? d.toLocaleDateString('en-CA') : ''; };
		let tab = q ? 'keyword' : 'route';

		const opts = (sel) => '<option value="">Any airport</option>' + airports.map((a) => `<option value="${esc(a.id)}" ${String(a.id) === String(sel) ? 'selected' : ''}>${esc(a.city + ' (' + a.code + '), ' + a.country)}</option>`).join('');
		view.innerHTML = '<div class="fa-title"><h1>Search Flights</h1><p>Find flights by route and date, or by flight number, airline, airport or city.</p></div>' +
			'<div class="fa-split"><div class="fa-main">' +
			'<div class="fa-tabs"><button class="fa-tab" data-t="route">By route and date</button><button class="fa-tab" data-t="keyword">By flight number</button></div>' +
			'<form class="fa-routeform"><label>From<select name="from">' + opts(params.get('from')) + '</select></label>' +
			'<button class="fa-swap" type="button" title="Swap">&#8644;</button>' +
			'<label>To<select name="to">' + opts(params.get('to')) + '</select></label>' +
			'<label>Date<input type="date" name="date" value="' + esc(params.get('date') || '') + '" /></label>' +
			'<label>Airline<select name="airline"><option value="">Any airline</option>' + [...new Set(flights.map((f) => f.airline).filter(Boolean))].sort().map((a) => `<option ${a === params.get('airline') ? 'selected' : ''}>${esc(a)}</option>`).join('') + '</select></label>' +
			'<button class="fa-btn" type="submit">Search flights</button></form>' +
			'<div class="fa-quick"><div><span>Date</span><button type="button" data-d="">Any date</button>' + [-1, 0, 1, 2, 3].map((n) => '<button type="button" data-d="' + n + '">' + ['Yesterday', 'Today', 'Tomorrow', 'In 2 days', 'In 3 days'][n + 1] + '</button>').join('') + '</div>' +
			'<div><span>Departs</span><button type="button" data-t="" class="active">Any time</button><button type="button" data-t="0-6">00:00 - 06:00</button><button type="button" data-t="6-12">06:00 - 12:00</button><button type="button" data-t="12-18">12:00 - 18:00</button><button type="button" data-t="18-24">18:00 - 24:00</button></div></div>' +
			'<form class="fa-form wide fa-keywordform"><input placeholder="e.g. DL250, IndiGo, Delayed, JFK, Los Angeles" /><button class="fa-btn" type="submit">Search</button></form>' +
			'<div class="fa-msg"></div><div class="fa-results"></div></div>' + this.sidePanel(flights, ap) + '</div>';
		this.bindMiniMaps(view);
		const msg = view.querySelector('.fa-msg'), out = view.querySelector('.fa-results');
		const routeForm = view.querySelector('.fa-routeform'), keywordForm = view.querySelector('.fa-keywordform'), input = keywordForm.querySelector('input'), quick = view.querySelector('.fa-quick');
		let slot = params.get('slot') || '';
		const syncSlot = () => quick.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('active', b.dataset.t === slot));
		const dayValue = (offset) => { const d = new Date(); d.setDate(d.getDate() + Number(offset)); return d.toLocaleDateString('en-CA'); };
		input.value = q;

		const showTab = () => {
			view.querySelectorAll('.fa-tab').forEach((b) => b.classList.toggle('active', b.dataset.t === tab));
			routeForm.hidden = tab !== 'route';
			quick.hidden = tab !== 'route';
			keywordForm.hidden = tab !== 'keyword';
		};

		const renderKeyword = (term) => {
			const t = term.trim().toLowerCase();
			const hits = flights.filter((f) => {
				const o = ap[f.originAirportId] || {}, d = ap[f.destinationAirportId] || {};
				return !t || [f.flightNumber, f.airline, f.status, o.code, o.city, d.code, d.city].join(' ').toLowerCase().includes(t);
			});
			msg.textContent = hits.length ? hits.length + ' flight(s) found' : 'No flights match your search.';
			out.innerHTML = hits.map((f) => this.flightRow(f, ap)).join('');
		};

		const renderRoute = () => {
			const from = routeForm.from.value, to = routeForm.to.value, date = routeForm.date.value;
			const keep = new URLSearchParams();
			if (from) keep.set('from', from);
			if (to) keep.set('to', to);
			if (date) keep.set('date', date);
			const airline = routeForm.airline.value;
			if (airline) keep.set('airline', airline);
			if (slot) keep.set('slot', slot);
			history.replaceState(null, '', location.pathname + (keep.toString() ? '?' + keep : ''));
			if (from && from === to) { msg.textContent = 'Choose two different airports.'; out.innerHTML = ''; return; }
			const onRoute = flights.filter((f) => (!from || String(f.originAirportId) === from) && (!to || String(f.destinationAirportId) === to));
			const inSlot = (f) => {
				if (!slot) return true;
				const d = parseDate(f.departureTime);
				const [lo, hi] = slot.split('-').map(Number);
				return d && d.getHours() >= lo && d.getHours() < hi;
			};
			const hits = onRoute.filter((f) => (!date || localDay(f.departureTime) === date) && (!airline || f.airline === airline) && inSlot(f))
				.sort((x, y) => String(x.departureTime).localeCompare(String(y.departureTime)));
			const name = (id) => (ap[id] ? ap[id].city : 'any airport');
			const where = (from || to ? ' from ' + name(from) + ' to ' + name(to) : '') + (date ? ' on ' + fmtDate(date + 'T12:00:00') : '');
			if (hits.length) {
				msg.textContent = hits.length + ' flight(s) found' + where;
				out.innerHTML = hits.map((f) => this.flightRow(f, ap)).join('');
				return;
			}
			msg.textContent = 'No flights found' + where + '.';
			const other = onRoute.filter((f) => date);
			out.innerHTML = other.length
				? '<h3 class="fa-subhead">Other dates for this route</h3>' + other.map((f) => this.flightRow(f, ap)).join('')
				: '<div class="fa-msg">Try another date, or choose "Any airport" to see more routes.</div>';
		};

		view.querySelectorAll('.fa-tab').forEach((b) => b.addEventListener('click', () => {
			tab = b.dataset.t;
			showTab();
			if (tab === 'route') renderRoute(); else renderKeyword(input.value);
		}));
		view.querySelector('.fa-swap').addEventListener('click', () => {
			const x = routeForm.from.value;
			routeForm.from.value = routeForm.to.value;
			routeForm.to.value = x;
			renderRoute();
		});

		routeForm.addEventListener('submit', (e) => { e.preventDefault(); renderRoute(); });
		quick.addEventListener('click', (e) => {
			const b = e.target.closest('button');
			if (!b) return;
			if (b.dataset.d !== undefined) routeForm.date.value = b.dataset.d === '' ? '' : dayValue(b.dataset.d);
			if (b.dataset.t !== undefined) { slot = b.dataset.t; syncSlot(); }
			renderRoute();
		});
		syncSlot();
		keywordForm.addEventListener('submit', (e) => { e.preventDefault(); renderKeyword(input.value); });
		showTab();
		if (tab === 'route') renderRoute(); else renderKeyword(q);
	}

	async view_alerts(view) {
		if (!Liferay.ThemeDisplay.isSignedIn()) {
			view.innerHTML = '<div class="fa-title"><h1>My Flight Alerts</h1></div><p class="fa-msg">Sign in to follow flights and receive email updates.</p><a class="fa-btn" href="' + this._root + '/login">Sign in</a>';
			return;
		}

		// Load and draw again every 30 seconds, so a delay or gate change made by the admin shows without a reload
		const load = async () => {
			const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
			await this.loadFlightAlerts();
			this.bindFlightAlerts(view);
			const followed = flights.filter((flight) => this._followingFlights.has(String(flight.id)));
			view.innerHTML = '<div class="fa-title"><h1>My Flight Alerts</h1><p>We will email you when a followed flight’s status, delay or gate changes.</p></div>' +
				(followed.length ? followed.map((flight) => this.flightRow(flight, ap)).join('') : '<p class="fa-msg">You are not following any flights yet. Browse <a href="' + this._root + '/flight-status">flight status</a> and choose “Get email alerts”.</p>');
		};
		await load();
		this.setupFilter(view, {key: 'alerts', items: '.fa-fcard', placeholder: 'Search your followed flights'});
		clearInterval(this._timer);
		this._timer = setInterval(() => load().catch(() => {}), 30000);
	}

	// All the guide entries written by the admin (read once per page).
	guideRows() {
		this._guides = this._guides || this.json('/o/flight-live/guides?siteId=' + SITE_ID()).catch(() => []);
		return this._guides;
	}

	// A "To and from the airport" link, only for an airport that has guide entries. It opens the guide page of that airport.
	guideButton(airport, rows, label) {
		if (!airport || !airport.code || !rows.some((g) => g.airportCode.toUpperCase() === airport.code.toUpperCase())) return '';
		return `<a class="fa-chip fa-getthere" href="${this._root}/airports?airport=${encodeURIComponent(airport.code)}">${esc(label)}</a>`;
	}

	// The guide page of one airport (/airports?airport=DEL): a tab for each category the admin wrote about, and for the chosen tab
	// a big photo beside the text and the pick-up points. A photo is the entry's own, else the category's (assets/guide/<category>.jpg
	// listed in credits.json), else a photo of the airport's city.
	async guidePage(view, code) {
		const site = SITE_ID(), query = '?siteId=' + site + '&airport=' + encodeURIComponent(code);
		const [ap, rows, terminals, pickups] = await Promise.all([
			this.airports(), this.guideRows(), this.json('/o/flight-live/terminals' + query).catch(() => []), this.json('/o/flight-live/pickups' + query).catch(() => [])]);
		const airport = Object.values(ap).find((a) => a.code.toUpperCase() === code.toUpperCase());
		const mine = rows.filter((g) => g.airportCode.toUpperCase() === code.toUpperCase());
		const back = `<a class="fa-backlink" href="${this._root}/airports">&larr; All airports</a>`;
		if (!airport || !mine.length) {
			view.innerHTML = `<div class="fa-title"><h1>To and from the airport</h1><p>${airport ? 'No travel information has been added for ' + esc(airport.name) + ' yet.' : 'We could not find this airport.'}</p></div>${back}`;
			return;
		}
		const credits = await (this._guideCredits = this._guideCredits || this.json('/o/flight-status-app/guide/credits.json').catch(() => ({})));
		const slug = (c) => String(c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		const lines = (text) => String(text || '').split('\n').map((x) => x.trim()).filter(Boolean);
		const categories = [...new Set(mine.map((g) => g.category))];
		const params = new URLSearchParams(location.search);
		let tab = params.get('tab'), terminal = params.get('terminal');
		if (!categories.includes(tab)) tab = categories[0];
		if (!terminals.some((t) => t.name === terminal)) terminal = terminals.length ? terminals[0].name : '';
		const isNum = (a, b) => isFinite(parseFloat(a)) && isFinite(parseFloat(b));
		const termOf = (name) => terminals.find((t) => t.name === name);
		const place = (p) => [p.name, p.terminal, airport.name].filter(Boolean).join(', ');
		// Google Maps walking directions from the terminal to the place: by position when we have it, else by name.
		const navUrl = (p) => {
			const t = termOf(p.terminal);
			const from = t && isNum(t.latitude, t.longitude) ? t.latitude + ',' + t.longitude : [p.terminal, airport.name].filter(Boolean).join(', ');
			const to = isNum(p.latitude, p.longitude) ? p.latitude + ',' + p.longitude : place(p);
			return 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + encodeURIComponent(from) + '&destination=' + encodeURIComponent(to);
		};
		const photo = (r) => {
			if (/^(https?:\/\/|\/)/i.test(r.imageUrl)) return `<div class="fa-guideimg has-photo" style="background-image:url('${esc(r.imageUrl)}')"></div>`;
			if (credits[slug(r.category)]) return `<div class="fa-guideimg has-photo" title="Photo: ${esc(credits[slug(r.category)])}" style="background-image:url('/o/flight-status-app/guide/${esc(slug(r.category))}.jpg')"></div>`;
			return `<div class="fa-guideimg" data-photo-city="${esc(airport.city)}" data-photo-country="${esc(airport.country)}"></div>`;
		};
		const panel = (r, hasPoints) => `<div class="fa-guidepanel">${photo(r)}<div class="fa-guideinfo"><h2>${esc(r.title)}</h2>${lines(r.details).map((x) => '<p>' + esc(x) + '</p>').join('')}` +
			(!hasPoints && lines(r.pickupPoints).length ? '<h3>Pick-up points</h3><ul>' + lines(r.pickupPoints).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
			(/^https?:\/\//i.test(r.link) ? `<a class="fa-btn block-auto" href="${esc(r.link)}" target="_blank" rel="noopener">Know more</a>` : '') + '</div></div>';
		const pointCard = (p) => `<div class="fa-pickup"><div><b>${esc(p.name)}</b> <span class="fa-chip small">${esc(p.terminal)}</span>` +
			(lines(p.steps).length ? '<ol>' + lines(p.steps).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '<p class="fa-panelnote">Walking steps have not been added yet.</p>') +
			`</div><a class="fa-btn block-auto" href="${esc(navUrl(p))}" target="_blank" rel="noopener">Navigate in Google Maps</a></div>`;
		const hasMapData = terminals.some((t) => isNum(t.latitude, t.longitude)) || pickups.some((p) => isNum(p.latitude, p.longitude));
		let map = null, layer = null;
		const drawMap = async (list) => {
			const box = view.querySelector('.fa-guidemap');
			if (!box || !hasMapData) return;
			try { await this.loadLeaflet(); } catch (e) { return; }
			if (!map) {
				map = L.map(box, {scrollWheelZoom: false});
				L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);
			}
			if (layer) layer.remove();
			layer = L.layerGroup().addTo(map);
			const spots = [];
			terminals.filter((t) => isNum(t.latitude, t.longitude)).forEach((t) => {
				const here = t.name === terminal;
				L.circleMarker([t.latitude, t.longitude], {radius: here ? 10 : 7, color: '#fff', weight: 2, fillColor: '#0b5fff', fillOpacity: 1}).bindTooltip(t.name, {permanent: here}).addTo(layer);
				spots.push([parseFloat(t.latitude), parseFloat(t.longitude)]);
			});
			list.filter((p) => isNum(p.latitude, p.longitude)).forEach((p) => {
				L.circleMarker([p.latitude, p.longitude], {radius: 8, color: '#fff', weight: 2, fillColor: '#ffb800', fillOpacity: 1}).bindTooltip(p.name, {permanent: true, direction: 'top'}).addTo(layer);
				spots.push([parseFloat(p.latitude), parseFloat(p.longitude)]);
			});
			if (spots.length) map.fitBounds(spots, {padding: [40, 40], maxZoom: 18});
			setTimeout(() => map.invalidateSize(), 100);
		};
		const draw = () => {
			view.querySelectorAll('.fa-guidetabs .fa-tab').forEach((b) => b.classList.toggle('active', b.dataset.t === tab));
			view.querySelectorAll('.fa-terminalbar .fa-chip').forEach((b) => b.classList.toggle('active', b.dataset.n === terminal));
			const inTab = pickups.filter((p) => p.category === tab);
			const shown = inTab.filter((p) => !terminal || p.terminal === terminal);
			const box = view.querySelector('.fa-guideview');
			box.innerHTML = mine.filter((g) => g.category === tab).map((r) => panel(r, inTab.length > 0)).join('') +
				(inTab.length ? '<section class="fa-pickups"><h3>Pick-up points' + (terminal ? ' at ' + esc(terminal) : '') + '</h3>' + (shown.map(pointCard).join('') || '<p class="fa-panelnote">No pick-up point is listed for this terminal in this category.</p>') + '</section>' : '');
			fillAllPhotos(box);
			drawMap(shown);
		};
		const url = () => history.replaceState(null, '', location.pathname + '?airport=' + encodeURIComponent(code) + '&tab=' + encodeURIComponent(tab) + (terminal ? '&terminal=' + encodeURIComponent(terminal) : ''));
		view.innerHTML = `<div class="fa-title"><h1>To and from ${esc(airport.name)}</h1><p>${esc(airport.city)}${airport.country ? ', ' + esc(airport.country) : ''}. Choose how you want to travel.</p></div>${back}` +
			(terminals.length ? `<div class="fa-terminalbar"><span>Where are you?</span>${terminals.map((t) => `<button type="button" class="fa-chip" data-n="${esc(t.name)}">${esc(t.name)}</button>`).join('')}</div>` : '') +
			`<div class="fa-tabs fa-guidetabs">${categories.map((c) => `<button type="button" class="fa-tab" data-t="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="fa-guidegrid${hasMapData ? ' has-map' : ''}"><div class="fa-guideview"></div>${hasMapData ? '<div class="fa-guidemap"></div>' : ''}</div>` +
			`<p class="fa-panelnote">Times, routes and prices can change. Check the airport or operator website before you travel. Photos: Wikimedia Commons. <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(airport.name)}" target="_blank" rel="noopener">Open the airport in Google Maps</a></p>`;
		view.querySelectorAll('.fa-guidetabs .fa-tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; url(); draw(); }));
		view.querySelectorAll('.fa-terminalbar .fa-chip').forEach((b) => b.addEventListener('click', () => { terminal = b.dataset.n; url(); draw(); }));
		draw();
	}

	async view_airports(view) {
		const wanted = new URLSearchParams(location.search).get('airport');
		if (wanted) return this.guidePage(view, wanted);
		const [ap, flights, guides, boards] = await Promise.all([this.airports(), this.flights(), this.guideRows(), this.json('/o/flight-live/boards?siteId=' + SITE_ID()).catch(() => [])]);
		const boardCodes = new Set(boards.map((b) => b.airportCode));
		const list = Object.values(ap);
		const count = (id) => flights.filter((f) => f.originAirportId == id || f.destinationAirportId == id).length;
		view.innerHTML = '<div class="fa-title"><h1>Airports</h1><p>' + list.length + ' airports in our network.</p></div><div class="fa-grid">' +
			(list.map((a) => `<div class="fa-card"><div class="fa-cardphoto" data-photo-city="${esc(a.city)}" data-photo-country="${esc(a.country)}"><span class="fa-code">${esc(a.code)}</span></div><b>${esc(a.name)}</b><span>${esc(a.city)}${a.country ? ', ' + esc(a.country) : ''}</span>${boardCodes.has(a.code) ? `<a class="fa-livetag" href="${this._root}/flight-status?airport=${esc(a.code)}&dir=arr">Live arrivals &amp; departures</a>` : `<small>${count(a.id) ? count(a.id) + ' flights today' : 'No flights today'}</small>`}${this.guideButton(a, guides, 'To and from the airport')}</div>`).join('') || '<div class="fa-msg">No airports found.</div>') + '</div><p class="fa-credit">City photos: Wikipedia &amp; Wikimedia Commons</p>';
		fillAllPhotos(view);
		this.setupFilter(view, {key: 'airports', items: '.fa-card', placeholder: 'Search airport code, name, city or country'});
	}


	loadQr() {
		if (window.qrcode) return Promise.resolve();
		if (!window._faQr) {
			window._faQr = new Promise((resolve, reject) => {
				const js = document.createElement('script');
				js.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
				js.onload = resolve;
				js.onerror = () => reject(new Error('Could not load the QR code library'));
				document.head.appendChild(js);
			});
		}
		return window._faQr;
	}

	// Notices the admin switched on, shown under the menu on every page. A visitor can close one; it stays closed for the rest of the visit.
	async loadNotices() {
		const box = this.querySelector('.fa-alerts');
		if (!box) return;
		const closed = (() => { try { return JSON.parse(sessionStorage.getItem('faClosedNotices') || '[]'); } catch (e) { return []; } })();
		try {
			const list = (await this.json('/o/flight-live/notices?siteId=' + SITE_ID())).filter((n) => !closed.includes(n.id));
			box.innerHTML = list.map((n) => `<div class="fa-alertbar ${esc(n.level)}"><span>${ICONS.bell}</span><p>${esc(n.message)}</p><button type="button" data-id="${esc(n.id)}" aria-label="Close">&times;</button></div>`).join('');
			box.hidden = !list.length;
			this.classList.toggle('has-notices', !!list.length && box.classList.contains('first'));
			box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
				try { sessionStorage.setItem('faClosedNotices', JSON.stringify(closed.concat(b.dataset.id))); } catch (e) {}
				b.parentElement.remove();
				if (!box.children.length) { box.hidden = true; this.classList.remove('has-notices'); }
			}));
		} catch (e) {
			box.hidden = true;
		}
	}

	// "Special assistance" under a boarding pass: ask for help (the kinds come from the admin's list) and see the answer of the airport team.
	async bindAssist(root, pass, site, call) {
		try {
			const [options, mine] = await Promise.all([this.json('/o/flight-live/assist-options?siteId=' + site), call('GET', '/assist?siteId=' + site)]);
			const asked = mine.filter((r) => r.pnr.toUpperCase() === String(pass.pnr).toUpperCase());
			root.innerHTML = '<h3>Special assistance</h3>' +
				(asked.map((r) => `<p class="fa-assistrow"><b>${esc(r.assistanceType)}</b>${r.note && r.note !== 'null' ? ' &middot; ' + esc(r.note) : ''} <span class="fa-badge ${r.requestStatus === 'Done' ? 'landed' : 'boarding'}">${r.requestStatus === 'Done' ? 'Done' : 'Requested'}</span></p>`).join('') || '<p class="fa-panelnote">Need a wheelchair or help with luggage? Tell the airport team before you travel.</p>') +
				(options.length ? '<form class="fa-assistform"><select name="type" required>' + options.map((o) => '<option>' + esc(o.name) + '</option>').join('') + '</select><input name="note" maxlength="200" placeholder="Anything we should know (optional)" /><button class="fa-btn block-auto" type="submit">Ask for help</button><div class="fa-error" hidden></div></form>' : '');
			const form = root.querySelector('form');
			if (!form) return;
			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				try {
					await call('POST', '/assist', {siteId: site, pnr: pass.pnr, type: form.type.value, note: form.note.value});
					this.bindAssist(root, pass, site, call);
				} catch (x) {
					const err = form.querySelector('.fa-error');
					err.textContent = x.message;
					err.hidden = false;
				}
			});
		} catch (e) {
			root.innerHTML = '';
		}
	}

	passHtml(p, ap) {
		const dep = parseDate(p.departureTime);
		const boarding = dep ? new Date(dep.getTime() - 45 * 60000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
		let qr = '';
		try {
			const code = window.qrcode(0, 'M');
			// A link to the pass check page (signed, so it cannot be changed); the old text is used if the server sends no link
			code.addData(p.checkUrl || ['FSP', p.pnr, p.flightNumber, p.seat, p.passengerName].join('|'));
			code.make();
			qr = code.createSvgTag(4);
		} catch (e) {}
		return `<div class="fa-pass"><div class="fa-pass-top"><span>${ICONS.plane} Flight Status Portal</span><b>${seatFee(p.seat) ? '<i class="fa-paidbadge">Paid seat &#8377;' + seatFee(p.seat) + '</i>' : ''}BOARDING PASS${p.travelClass && p.travelClass !== 'null' ? ' &middot; ' + esc(CLASS_LABEL[classOf(p.travelClass)]).toUpperCase() : ''}</b></div>` +
			`<div class="fa-pass-body"><div class="fa-pass-main">` +
			`<div class="fa-pass-route"><div><b>${esc(p.origin)}</b><span>${esc(p.originCity)}</span></div><i>${ICONS.plane}</i><div><b>${esc(p.destination)}</b><span>${esc(p.destinationCity)}</span></div></div>` +
			`<div class="fa-pass-grid"><div><span>Passenger</span><b>${esc(p.passengerName)}</b></div><div><span>Flight</span><b>${esc(p.flightNumber)}</b></div><div><span>Airline</span><b class="fa-airlinecell">${logoHtml(p.flightNumber, (this._airlines && this._airlines[p.flightNumber]) || '')}${esc((this._airlines && this._airlines[p.flightNumber]) || airlineOf(p.flightNumber, '') || '-')}</b></div>` +
			`<div><span>Date</span><b>${esc(fmtDate(p.departureTime))}</b></div><div><span>Departs</span><b>${fmtTime(p.departureTime)}</b></div>` +
			`<div><span>Boarding</span><b>${esc(boarding)}</b></div><div><span>Gate</span><b>${esc(p.gate)}</b></div>` +
			`<div><span>Seat</span><b>${esc(p.seat)}${seatFee(p.seat) ? ' <small>(paid &#8377;' + seatFee(p.seat) + ')</small>' : ''}</b></div><div><span>PNR</span><b>${esc(p.pnr)}</b></div>` +
			`<div><span>Class</span><b>${esc(p.travelClass && p.travelClass !== 'null' ? CLASS_LABEL[classOf(p.travelClass)] : 'Economy Class')}</b></div>${addOnText(p.baggageKg, p.meal) ? '<div><span>Extras</span><b>' + esc(addOnText(p.baggageKg, p.meal)) + '</b></div>' : ''}</div></div>` +
			`<div class="fa-pass-qr">${qr}<span>${esc(p.pnr)}</span></div></div></div>`;
	}

	async view_boarding(view) {
		if (!Liferay.ThemeDisplay.isSignedIn()) {
			view.innerHTML = '<div class="fa-auth-box"><h1>Log in to get your boarding pass</h1><p>Boarding passes are only for registered users.</p>' +
				'<a class="fa-btn block" style="text-align:center;text-decoration:none" href="' + this._root + '/login">Login</a>' +
				'<p class="fa-alt">New here? <a href="' + this._root + '/register">Create an account</a></p></div>';
			return;
		}
		const api = '/o/flight-boarding', site = SITE_ID();
		const [flights, ap] = await Promise.all([this.flights(true), this.airports(), this.loadQr().catch(() => {})]);
		this._airlines = Object.fromEntries(flights.map((f) => [f.flightNumber, f.airline]));
		let tab = 'new', seat = '', taken = [], bag = '0', meal = '';
		const addOnFees = () => (BAGGAGE.find((x) => x[0] === bag) || [0, 0, 0])[2] + (MEALS.find((x) => x[0] === meal) || [0, 0, 0])[2];

		const call = async (method, path, body) => {
			const res = await getFetch()(api + path, {method, credentials: 'include', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
			let data = {};
			try { data = await res.json(); } catch (e) {}
			if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
			return data;
		};
		// Paid seat: server makes a Stripe Checkout page, we go there, Stripe sends the user back with a session_id, and the server checks it at /pass
		const payForSeat = async (b, lastName) => {
			const order = await call('POST', '/payment/order', {siteId: site, pnr: b.pnr, lastName, seat, bag, meal, returnUrl: location.origin + location.pathname});
			location.href = order.url;
			return new Promise(() => {});
		};
		const printPass = () => {
			document.body.classList.add('fa-print-mode');
			window.print();
			setTimeout(() => document.body.classList.remove('fa-print-mode'), 500);
		};
		const showPass = (box, p) => {
			box.innerHTML = this.passHtml(p, ap) + '<div class="fa-pass-actions"><button class="fa-btn" type="button">Print / Save as PDF</button><button class="fa-chip fa-needhelp" type="button">Need assistance?</button></div><div class="fa-assist"></div>';
			box.querySelector('button').addEventListener('click', printPass);
			box.querySelector('.fa-needhelp').addEventListener('click', () => {
				const panel = box.querySelector('.fa-assist'), pick = panel.querySelector('select');
				panel.scrollIntoView({behavior: 'smooth', block: 'center'});
				if (pick) pick.focus();
			});
			this.bindAssist(box.querySelector('.fa-assist'), p, site, call);
			box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
		};
		const label = (f) => {
			const o = ap[f.originAirportId] || {}, d = ap[f.destinationAirportId] || {};
			return f.flightNumber + (f.airline ? ' ' + f.airline : '') + ' · ' + (o.code || '?') + ' → ' + (d.code || '?') + ' · ' + fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime);
		};

		const draw = () => {
			view.innerHTML = '<div class="fa-title"><h1>Boarding Pass</h1><p>Check in with your booking code, choose your seat, then print or save your boarding pass.</p></div>' +
				'<div class="fa-tabs"><button class="fa-tab ' + (tab === 'new' ? 'active' : '') + '" data-t="new">New boarding pass</button>' +
				'<button class="fa-tab ' + (tab === 'mine' ? 'active' : '') + '" data-t="mine">My boarding passes</button></div><div class="fa-bp"></div>';
			view.querySelectorAll('.fa-tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; draw(); }));
			(tab === 'new' ? drawNew : drawMine)(view.querySelector('.fa-bp'));
		};

		const drawNew = (box) => {
			seat = '';
			box.innerHTML = '<form class="fa-bpform fa-find fa-findbar">' +
					'<label>Booking code (PNR)<input name="pnr" required maxlength="12" placeholder="e.g. K7QX2M" autocomplete="off" /></label>' +
					'<label>Last name<input name="lastName" required maxlength="40" autocomplete="off" /></label>' +
					'<button class="fa-btn" type="submit">Find my booking</button><div class="fa-error" hidden></div></form>' +
					'<div class="fa-bpstep"></div><div class="fa-bpresult"></div>';
			const find = box.querySelector('.fa-find'), findErr = find.querySelector('.fa-error'), step = box.querySelector('.fa-bpstep');
			const wanted = new URLSearchParams(location.search);
			if (wanted.get('pnr') && wanted.get('last')) {
				find.pnr.value = wanted.get('pnr');
				find.lastName.value = wanted.get('last');
				setTimeout(() => find.requestSubmit(), 50);
			}

			find.addEventListener('submit', async (e) => {
				e.preventDefault();
				findErr.hidden = true;
				step.innerHTML = '';
				box.querySelector('.fa-bpresult').innerHTML = '';
				seat = '';
				try {
					const b = await call('GET', '/booking?siteId=' + site + '&pnr=' + encodeURIComponent(find.pnr.value.trim()) + '&lastName=' + encodeURIComponent(find.lastName.value.trim()));
					drawCheckin(box, step, b, find.lastName.value.trim());
				} catch (x) {
					findErr.textContent = x.message;
					findErr.hidden = false;
				}
			});
		};

		const drawCheckin = (box, step, b, lastName) => {
			const f = flights.find((x) => String(x.id) === String(b.flightId)) || flights.find((x) => x.flightNumber === b.flightNumber);
			const o = f ? (ap[f.originAirportId] || {}) : {}, d = f ? (ap[f.destinationAirportId] || {}) : {};
				const kv = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
				step.innerHTML = '<form class="fa-bpform fa-ckform"><div class="fa-ckcard fa-ckside"><h3>Seat Selection</h3><dl class="fa-kv">' + kv('Passenger', esc(b.passengerName)) + kv('Flight', esc(b.flightNumber) + (f && f.airline ? ' &middot; ' + esc(f.airline) : '')) +
					kv('Route', f ? esc((o.code || '?') + ' \u2192 ' + (d.code || '?')) : '-') + kv('Departs', f ? esc(fmtDate(f.departureTime) + ' \u00b7 ' + fmtTime(f.departureTime)) : '-') + kv('Class', esc(CLASS_LABEL[classOf(b.travelClass)])) + kv('PNR', esc(b.pnr)) + '</dl>' +
					'<h4>Seats</h4><div class="fa-key">' + [['', 'Available'], ['paid', 'Paid seat'], ['leg', 'Extra legroom'], ['taken', 'Occupied'], ['mine', 'Your seat']].map((k) => '<span>' + seatSvg(k[0]) + k[1] + '</span>').join('') + '</div>' +
					'<h4>Seat prices</h4><table class="fa-fees"><tr><td>Extra legroom (first row of a class)</td><td>&#8377;500</td></tr><tr><td>Window seat</td><td>&#8377;300</td></tr><tr><td>Aisle seat</td><td>&#8377;200</td></tr><tr><td>Middle seat</td><td>Free</td></tr></table>' +
					'<h4>Add-ons</h4><div class="fa-addons"><label>Extra baggage<select name="bag">' + BAGGAGE.map((x) => '<option value="' + x[0] + '">' + x[1] + (x[2] ? ' &middot; &#8377;' + x[2] : '') + '</option>').join('') + '</select></label>' +
					'<label>Meal<select name="meal">' + MEALS.map((x) => '<option value="' + x[0] + '">' + x[1] + (x[2] ? ' &middot; &#8377;' + x[2] : '') + '</option>').join('') + '</select></label></div>' +
					'<div class="fa-summary"></div><div class="fa-error" hidden></div><button class="fa-btn" type="submit">Check in and get boarding pass</button></div>' +
					'<div class="fa-ckcard fa-cabin"><h3>' + esc(b.flightNumber) + ' &middot; Cabin</h3><div class="fa-seats"></div></div></form>';
			const form = step.querySelector('form'), err = form.querySelector('.fa-error'), grid = form.querySelector('.fa-seats');

			const drawSeats = () => {
				let html = '<div class="fa-seatrow fa-seathead"><span></span>' + 'ABCDEF'.split('').map((c, i) => (i === 3 ? '<em></em>' : '') + '<b>' + c + '</b>').join('') + '</div>';
				const mine = CLASS_ROWS[classOf(b.travelClass)];
				for (let r = 1; r <= 20; r++) {
					const zone = Object.entries(CLASS_ROWS).find((z) => z[1][0] === r);
					if (zone) html += '<div class="fa-seatzone">' + CLASS_LABEL[zone[0]] + (zone[0] === classOf(b.travelClass) ? ' (your class)' : '') + '</div>';
					const inClass = r >= mine[0] && r <= mine[1];
					html += '<div class="fa-seatrow"><span>' + r + '</span>' + 'ABCDEF'.split('').map((c, i) => {
						const id = r + c, isTaken = taken.includes(id), off = isTaken || !inClass;
						return (i === 3 ? '<em></em>' : '') + `<button type="button" class="fa-seat ${isTaken ? 'taken' : ''} ${!inClass ? 'other' : ''} ${seat === id ? 'mine' : ''} ${seatFee(id) ? 'paid' : ''} ${[1, 3, 7].includes(r) ? 'leg' : ''}" data-s="${id}" title="Seat ${id} \u00b7 ${seatFee(id) ? 'Extra Rs ' + seatFee(id) : 'Free'}" aria-label="Seat ${id}" ${off ? 'disabled' : ''}>${seatSvg('')}</button>`;
					}).join('') + '</div>';
				}
				const keep = grid.scrollTop;
				grid.innerHTML = html;
				grid.scrollTop = keep;
				const fee = seat ? seatFee(seat) : 0, r = parseInt(seat, 10), kind = [1, 3, 7].includes(r) ? 'Extra legroom' : 'AF'.includes(seat.slice(-1)) ? 'Window' : 'CD'.includes(seat.slice(-1)) ? 'Aisle' : 'Middle';
					const add = addOnFees(), total = fee + add;
					form.querySelector('.fa-summary').innerHTML = (seat ? '<span>Your seat</span><b>' + seat + '</b><small>' + kind + '</small><em>' + (fee ? 'Extra &#8377;' + fee : 'Free') + '</em>' : '<span>Pick a seat on the plane</span>') +
						(add ? '<div class="fa-sumadd"><small>' + esc(addOnText(bag, meal)) + ' &middot; &#8377;' + add + '</small></div>' : '') + (total ? '<div class="fa-sumadd total">Total <b>&#8377;' + total + '</b></div>' : '');
					form.querySelector('button[type=submit]').textContent = total ? 'Pay \u20b9' + total + ' and check in' : 'Check in and get boarding pass';
				grid.querySelectorAll('.fa-seat:not(.taken):not(.other)').forEach((btn) => btn.addEventListener('click', () => { seat = btn.dataset.s; drawSeats(); }));
			};
			const loadSeats = async () => {
				try { taken = await call('GET', '/seats?siteId=' + site + '&flight=' + encodeURIComponent(b.flightKey || b.flightNumber)); } catch (e) { taken = []; }
				if (taken.includes(seat)) seat = '';
				drawSeats();
				const mineZone = Array.from(grid.querySelectorAll('.fa-seatzone')).find((z) => z.textContent.includes('your class'));
				if (mineZone && !grid.scrollTop) grid.scrollTop = Math.max(0, mineZone.offsetTop - 44);
			};
			loadSeats();
			// Back from Stripe: pick the paid seat again and finish the check-in
			let sessionId = new URLSearchParams(location.search).get('session_id');
			form.bag.addEventListener('change', () => { bag = form.bag.value; drawSeats(); });
			form.meal.addEventListener('change', () => { meal = form.meal.value; drawSeats(); });
			if (sessionId) {
				const back = new URLSearchParams(location.search);
				seat = back.get('seat') || '';
				bag = back.get('bag') || '0';
				meal = back.get('meal') || '';
				form.bag.value = bag;
				form.meal.value = meal;
				history.replaceState(null, '', location.pathname);
				setTimeout(() => form.requestSubmit(), 400);
			}

			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				err.hidden = true;
				if (!seat) { err.textContent = 'Please choose a seat.'; err.hidden = false; return; }
				const btn = form.querySelector('button[type=submit]');
				btn.disabled = true;
				try {
					const pay = sessionId ? {sessionId} : (seatFee(seat) + addOnFees()) ? await payForSeat(b, lastName) : {};
					const pass = await call('POST', '/pass', {siteId: site, pnr: b.pnr, lastName, seat, bag, meal, ...pay});
					step.innerHTML = '';
					showPass(box.querySelector('.fa-bpresult'), pass);
				} catch (x) {
					err.textContent = x.message;
					err.hidden = false;
					btn.disabled = false;
					sessionId = '';
					loadSeats();
				}
			});
		};

		const drawMine = async (box) => {
			box.innerHTML = '<div class="fa-msg">Loading...</div>';
			let list = [];
			try { list = await call('GET', '/passes?siteId=' + site); } catch (e) { box.innerHTML = `<div class="fa-msg">${esc(e.message)}</div>`; return; }
			list.sort((a, b) => b.created - a.created);
			if (!list.length) { box.innerHTML = '<div class="fa-msg">You have no boarding passes yet.</div>'; return; }
			box.innerHTML = '<div class="fa-tablewrap"><table class="fa-table"><thead><tr><th>Flight</th><th>Route</th><th>Date</th><th>Seat</th><th>PNR</th><th></th></tr></thead><tbody>' +
				list.map((p, i) => `<tr><td><b>${esc(p.flightNumber)}</b>${this._airlines && this._airlines[p.flightNumber] ? '<br><small>' + esc(this._airlines[p.flightNumber]) + '</small>' : ''}</td><td>${esc(p.origin)} → ${esc(p.destination)}</td><td>${esc(fmtDate(p.departureTime))} ${fmtTime(p.departureTime)}</td><td>${esc(p.seat)}</td><td>${esc(p.pnr)}</td><td><button class="fa-chip" data-i="${i}">View</button></td></tr>`).join('') +
				'</tbody></table></div><div class="fa-bpresult"></div>';
			box.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => showPass(box.querySelector('.fa-bpresult'), list[Number(b.dataset.i)])));
			this.setupFilter(view, {key: 'passes', items: '.fa-table tbody tr', placeholder: 'Search PNR, flight or route'});
		};

		draw();
	}

	async view_board(view) {
		const [flights, ap, gates] = await Promise.all([this.flights(), this.airports(), this.json('/o/flight-live/gates?siteId=' + SITE_ID())]);
		const airports = Object.values(ap).sort((a, b) => a.city.localeCompare(b.city));
		const used = new Set(flights.flatMap((f) => [String(f.originAirportId), String(f.destinationAirportId)]));
		let code = new URLSearchParams(location.search).get('airport') || '';
		if (!airports.some((a) => a.code === code)) code = (airports.find((a) => a.code === 'DEL') || airports.find((a) => used.has(String(a.id))) || airports[0] || {}).code;
		let tab = 'dep';
		const gateOf = (f) => (gates.length ? gates[Array.from(String(f.flightNumber)).reduce((t, c) => t + c.charCodeAt(0), 0) % gates.length].gateNumber : '-');

		view.innerHTML = '<div class="fa-title"><h1>Airport Board</h1><p>Departures and arrivals for one airport. Refreshes every 30 seconds.</p></div>' +
			'<div class="fa-boardhero"><div><b class="fa-boardcity"></b><span class="fa-boardname"></span></div></div>' +
			'<div class="fa-boardbar"><label>Airport<select class="fa-boardsel">' + airports.map((a) => `<option value="${esc(a.code)}" ${a.code === code ? 'selected' : ''}>${esc(a.city + ' (' + a.code + ') - ' + a.name)}</option>`).join('') + '</select></label>' +
			'<div class="fa-tabs" style="margin:0"><button class="fa-tab active" data-t="dep">Departures</button><button class="fa-tab" data-t="arr">Arrivals</button></div><span class="fa-livestate"></span></div><div class="fa-boardwrap"></div>';
		const sel = view.querySelector('.fa-boardsel'), wrap = view.querySelector('.fa-boardwrap'), state = view.querySelector('.fa-livestate'), banner = view.querySelector('.fa-boardhero');
		const setBanner = () => {
			const here = airports.find((a) => a.code === code);
			banner.style.backgroundImage = '';
			banner.classList.remove('has-photo');
			if (!here) return;
			banner.querySelector('.fa-boardcity').textContent = here.city + ', ' + here.country;
			banner.querySelector('.fa-boardname').textContent = here.name + ' (' + here.code + ')';
			showPhoto(banner, here.city, here.country, 'linear-gradient(0deg, rgba(10,21,56,.85), rgba(10,21,56,.15))');
		};

		const draw = (list) => {
			const here = airports.find((a) => a.code === code);
			const dep = tab === 'dep';
			const rows = list.filter((f) => String(dep ? f.originAirportId : f.destinationAirportId) === String(here && here.id))
				.sort((a, b) => String(dep ? a.departureTime : a.arrivalTime).localeCompare(String(dep ? b.departureTime : b.arrivalTime)));
			if (!rows.length) { wrap.innerHTML = '<div class="fa-msg">No ' + (dep ? 'departures' : 'arrivals') + ' for this airport.</div>'; return; }
			wrap.innerHTML = '<div class="fa-board"><table><thead><tr><th>Time</th><th>Flight</th><th>' + (dep ? 'To' : 'From') + '</th><th>Gate</th><th>Status</th></tr></thead><tbody>' +
				rows.map((f) => {
					const when = dep ? f.departureTime : f.arrivalTime, other = ap[dep ? f.destinationAirportId : f.originAirportId] || {};
					const d = parseDate(when), late = Number(f.delayMinutes) || 0;
					const est = d && late ? new Date(d.getTime() + late * 60000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
					return `<tr><td><b>${fmtTime(when)}</b><small>${esc(fmtDate(when))}</small>${est ? '<small class="late">Est. ' + est + '</small>' : ''}</td>` +
						`<td><div class="fa-fl">${logoHtml(f.flightNumber, f.airline)}<div><b>${esc(f.flightNumber)}</b>${f.airline ? '<small>' + esc(f.airline) + '</small>' : ''}</div></div></td>` +
						`<td><b>${esc(other.city || '?')}</b><small>${esc(other.code || '')}${other.country ? ' &middot; ' + esc(other.country) : ''}</small></td>` +
						`<td><b>${esc(gateOf(f))}</b></td><td><span class="fa-badge ${statusClass(f.status)}">${esc(f.status)}${late ? ' +' + late + ' min' : ''}</span></td></tr>`;
				}).join('') + '</tbody></table></div><p class="fa-credit">City photos: Wikipedia &amp; Wikimedia Commons &middot; Airline logos: pics.avs.io</p>';
		};

		let current = flights;
		const refresh = async () => {
			try {
				current = await this.flights();
				state.textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
			} catch (e) {
				state.textContent = 'Could not refresh right now';
			}
			draw(current);
		};
		sel.addEventListener('change', () => { code = sel.value; history.replaceState(null, '', location.pathname + '?airport=' + code); setBanner(); draw(current); });
		view.querySelectorAll('.fa-tab').forEach((b) => b.addEventListener('click', () => {
			tab = b.dataset.t;
			view.querySelectorAll('.fa-tab').forEach((x) => x.classList.toggle('active', x === b));
			draw(current);
		}));
		state.textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
		setBanner();
		draw(current);
		clearInterval(this._timer);
		this._timer = setInterval(refresh, 30000);
	}

	async view_ontime(view) {
		const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
		const isLate = (f) => Number(f.delayMinutes) > 0 || statusClass(f.status) === 'delayed' || statusClass(f.status) === 'cancelled';
		const group = (keyFn) => {
			const map = {};
			flights.forEach((f) => { const k = keyFn(f); if (!k) return; const g = map[k] = map[k] || {name: k, total: 0, late: 0, delayMins: 0}; g.total++; if (isLate(f)) g.late++; g.delayMins += Number(f.delayMinutes) || 0; });
			return Object.values(map).map((g) => Object.assign(g, {rate: Math.round(((g.total - g.late) / g.total) * 100), avg: g.late ? Math.round(g.delayMins / g.late) : 0})).sort((x, y) => y.rate - x.rate || y.total - x.total);
		};
		const byAirline = group((f) => f.airline || 'Unknown airline');
		const byAirport = group((f) => (ap[f.originAirportId] ? ap[f.originAirportId].city + ' (' + ap[f.originAirportId].code + ')' : ''));
		const total = flights.length, late = flights.filter(isLate).length;
		const avg = late ? Math.round(flights.reduce((t, f) => t + (Number(f.delayMinutes) || 0), 0) / late) : 0;
		const table = (title, rows, col) => '<section class="fa-section"><div class="fa-head"><h2>' + title + '</h2></div><div class="fa-tablewrap"><table class="fa-table fa-otp"><thead><tr><th>' + col + '</th><th>Flights</th><th>On time</th><th>Delayed</th><th>Avg delay</th><th>On-time rate</th></tr></thead><tbody>' +
			rows.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td>${g.total}</td><td>${g.total - g.late}</td><td>${g.late}</td><td>${g.avg ? g.avg + ' min' : '-'}</td><td><div class="fa-bar ${g.rate >= 80 ? 'good' : g.rate >= 60 ? 'mid' : 'bad'}"><i style="width:${g.rate}%"></i></div><b>${g.rate}%</b></td></tr>`).join('') + '</tbody></table></div></section>';
		view.innerHTML = '<div class="fa-title"><h1>On-time Performance</h1><p>How reliable each airline and airport is, from the flights in our network.</p></div>' +
			this.statTiles([{icon: 'shield', value: (total ? Math.round(((total - late) / total) * 100) : 100) + '%', label: 'Overall on-time rate'}, {icon: 'plane', value: total, label: 'Flights counted'}, {icon: 'clock', value: late, label: 'Delayed or cancelled'}, {icon: 'bell', value: avg ? avg + ' min' : '-', label: 'Average delay'}]) +
			table('By airline', byAirline, 'Airline') + table('By departure airport', byAirport, 'Airport') +
			'<p class="fa-credit">A flight counts as late when it is marked Delayed or Cancelled, or has delay minutes.</p>';
	}

	async view_gates(view) {
		const items = await this.json('/o/flight-live/gates?siteId=' + SITE_ID());
		const terminals = {};
		items.forEach((g) => (terminals[g.terminal] = terminals[g.terminal] || []).push(g));
		view.innerHTML = '<div class="fa-title"><h1>Gates</h1><p>' + items.length + ' gates across ' + Object.keys(terminals).length + ' terminals.</p></div>' +
			(Object.keys(terminals).sort().map((t) => `<section class="fa-section"><div class="fa-head"><h2>Terminal ${esc(t)}</h2></div><div class="fa-grid">` +
				terminals[t].map((g) => `<div class="fa-card"><span class="fa-ico">${ICONS.gate}</span><b>Gate ${esc(g.gateNumber)}</b><span>Terminal ${esc(g.terminal)}</span></div>`).join('') + '</div></section>').join('') || '<div class="fa-msg">No gates found.</div>');
		this.setupFilter(view, {key: 'gates', items: '.fa-card', placeholder: 'Search gate or terminal'});
	}
}

if (!customElements.get('flight-status-app')) {
	customElements.define('flight-status-app', FlightStatusApp);
}
