const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);
const SITE_ID = () => Liferay.ThemeDisplay.getScopeGroupId();

const ROUTES = [
	{path: 'home', slug: 'home', label: 'Home'},
	{path: 'flights', slug: 'flight-status', label: 'Flight Status'},
	{path: 'search', slug: 'search', label: 'Search'},
	{path: 'airports', slug: 'airports', label: 'Airports'},
	{path: 'gates', slug: 'gates', label: 'Gates'},
	{path: 'live', slug: 'live-map', label: 'Live Map'},
	{path: 'board', slug: 'airport-board', label: 'Airport Board'},
	{path: 'boarding', slug: 'boarding-pass', label: 'Boarding Pass', auth: true, menu: true},
	{path: 'ontime', slug: 'on-time-performance', label: 'On-time'},
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
const showPhoto = (el, city, country, overlay) => cityPhoto(city, country).then((url) => {
	if (url && el.isConnected) {
		el.style.backgroundImage = (overlay ? overlay + ',' : '') + 'url("' + url + '")';
		el.classList.add('has-photo');
	}
});
const fillPhotos = (root) => root.querySelectorAll('[data-photo-city]').forEach((el) => showPhoto(el, el.dataset.photoCity, el.dataset.photoCountry || '', el.dataset.photoOverlay || ''));
const logoHtml = (flightNumber, airline, cls) => {
	const a = AIRLINES.find((x) => x[1] === airline) || AIRLINES.find((x) => String(flightNumber).toUpperCase().startsWith(x[0]));
	return a ? `<img class="fa-airlogo ${cls || ''}" alt="" src="https://pics.avs.io/120/120/${a[0]}.png">` : '';
};
const CLASS_LABEL = {First: 'First Class', Business: 'Business Class', Economy: 'Economy Class'};
const CLASS_ROWS = {First: [1, 2], Business: [3, 6], Economy: [7, 20]};
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

	async flights() {
		const items = await this.json('/o/flight-live/flights?siteId=' + SITE_ID());
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
		})).sort((x, y) => String(x.departureTime).localeCompare(String(y.departureTime)));
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

		const adminMode = admin && !viewingSite;
		const tab = params.get('tab') || 'dashboard';
		this._adminTab = tab;
		const links = adminMode
			? [['dashboard', 'Dashboard'], ['flights', 'Flights'], ['airports', 'Airports'], ['gates', 'Gates'], ['reservations', 'Reservations']]
				.map((t) => `<a href="${root}/admin?tab=${t[0]}" class="${current === 'admin' && tab === t[0] ? 'active' : ''}">${t[1]}</a>`).join('') +
				`<a href="${root}/live-map" class="${current === 'live' ? 'active' : ''}">Live Map</a>` +
				`<a class="fa-auth" href="${root}/home?viewsite=1">View site</a>`
			: ROUTES.filter(showRoute).map((r) => `<a href="${root}/${r.slug}" class="${r.path === current ? 'active' : ''}">${r.label}</a>`).join('') +
				(admin ? `<a class="fa-auth" href="${root}/admin">Admin</a>` : '');
		const footerLinks = adminMode
			? '<span>Admin Portal</span>'
			: ROUTES.filter(showRoute).map((r) => `<a href="${root}/${r.slug}">${r.label}</a>`).join('') + '<span class="fa-sep">&middot;</span><span>Live flight information</span>';

		const crumbLabel = (ROUTES.find((r) => r.path === current) || {}).label;
		const crumbs = (!adminMode && crumbLabel && !['home', 'login', 'register'].includes(current))
			? '<nav class="fa-crumbs" aria-label="Breadcrumb"><a href="' + root + '/home">Home</a><span>&rsaquo;</span><b>' + esc(crumbLabel) + '</b></nav>' : '';

		this.innerHTML =
			'<header class="fa-header"><div class="fa-nav"><a class="fa-brand" href="' + root + (adminMode ? '/admin' : '/home') + '"><span class="fa-logo">' + ICONS.plane + '</span>Flight Status <b>' + (adminMode ? 'Admin' : 'Portal') + '</b></a>' +
			'<button class="fa-burger" type="button" aria-label="Menu">&#9776;</button>' +
			'<nav class="fa-links">' + links + this.authLinks(root, current) + '</nav></div></header>' +
			crumbs +
			'<main class="fa-view"><div class="fa-skel"><i></i><i></i><i></i></div></main>' +
			'<footer class="fa-footer"><span>&copy; ' + new Date().getFullYear() + ' Flight Status Portal</span><span class="fa-sep">&middot;</span>' + footerLinks +
			'<span class="fa-sep">&middot;</span><button type="button" class="fa-legal" data-legal="privacy">Privacy</button><button type="button" class="fa-legal" data-legal="terms">Terms</button><button type="button" class="fa-legal" data-legal="cookies">Cookies</button></footer>';
		this.classList.toggle('has-crumbs', !!crumbs);

		this.querySelector('.fa-burger').addEventListener('click', () => this.querySelector('.fa-links').classList.toggle('open'));
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
			if (topic) showPhoto(banner, topic, '', 'linear-gradient(90deg, rgba(15,30,80,.9) 0%, rgba(15,30,80,.6) 55%, rgba(15,30,80,.22) 100%)');
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

	bindShell() {
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
			'<div class="fa-stats fa-livestats" style="margin:0 0 1rem"></div>' +
			'<form class="fa-livebar fa-citybar"><input class="fa-citysearch" placeholder="Flights over a city, e.g. Ahmedabad" /><button class="fa-btn" type="submit">Show flights</button><button class="fa-btn fa-btn-light fa-cityclear" type="button" hidden>Show full map</button></form>' +
			'<div class="fa-livebar"><input class="fa-livesearch" placeholder="Find a callsign, e.g. AIC101 or IGO" /><span class="fa-livestate">Loading...</span></div>' +
			'<div class="fa-map"></div><div class="fa-citylist"></div><p class="fa-credit">Aircraft data: <a href="https://adsb.fi" target="_blank" rel="noopener">adsb.fi</a> open data &middot; Routes: adsbdb.com &middot; Photos: Planespotters.net &middot; Map &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</p>';
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
			bookings: {
				label: 'Booking', plural: 'Bookings', list: '/o/c/bookings/scopes/' + site + '?pageSize=200', create: '/o/c/bookings/scopes/' + site, item: '/o/c/bookings/',
			},
			flights: {
				label: 'Flight', plural: 'Flights', list: '/o/c/flights/scopes/' + site + '?pageSize=200&sort=departureTime:asc', create: '/o/c/flights/scopes/' + site, item: '/o/c/flights/', statuses,
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
		if (tab === 'reservations') { try { passes = (await this.json('/o/c/boardingpasses/scopes/' + SITE_ID() + '?pageSize=200')).items || []; } catch (e) {} }
		const apById = Object.fromEntries(airports.map((a) => [a.id, a]));
		const tabs = [['dashboard', 'Dashboard'], ['flights', 'Flights (' + flights.length + ')'], ['airports', 'Airports (' + airports.length + ')'], ['gates', 'Gates (' + gates.length + ')'], ['bookings', 'Bookings (' + bookings.length + ')'], ['reservations', 'Reservations']];

		let body = '';
		if (tab === 'dashboard') {
			const delayed = flights.filter((f) => f.showstatus && f.showstatus.key === 'Delayed').length;
			body = '<div class="fa-stats" style="margin:0 0 1.5rem">' +
				[['plane', flights.length, 'Flights'], ['building', airports.length, 'Airports'], ['gate', gates.length, 'Gates'], ['clock', delayed, 'Delayed flights']]
					.map((s) => `<div class="fa-stat"><span class="fa-ico">${ICONS[s[0]]}</span><div><b>${s[1]}</b><span>${s[2]}</span></div></div>`).join('') + '</div>' +
				'<div class="fa-adminbtns"><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button><button class="fa-btn block-auto" data-add="airports">+ Add Airport</button><button class="fa-btn block-auto" data-add="gates">+ Add Gate</button><button class="fa-btn block-auto" data-add="bookings">+ Add Booking</button></div>';
		} else if (tab === 'flights') {
			body = '<div class="fa-head"><h2>Flights</h2><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button></div>' +
				this.adminTable(['Flight', 'Route', 'Departure', 'Status', 'Delay', 'Bookings'], flights.map((f) => {
					const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId];
					return [f.id, [esc(f.flightNumber) + (airlineOf(f.flightNumber, f.airline) ? '<br><small>' + esc(airlineOf(f.flightNumber, f.airline)) + '</small>' : ''), esc((o ? o.code : '?') + ' → ' + (d ? d.code : '?')), fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime),
						'<span class="fa-badge ' + statusClass(f.showstatus ? f.showstatus.name : '') + '">' + esc(f.showstatus ? f.showstatus.name : '') + '</span>', (f.delayMinutes || 0) + ' min', String(bookings.filter((b) => String(b.flightId) === String(f.id) || (!b.flightId && b.flightNumber === f.flightNumber)).length)]];
				}));
		} else if (tab === 'bookings') {
			body = '<div class="fa-head"><h2>Bookings</h2><button class="fa-btn block-auto" data-add="bookings">+ Add Booking</button></div>' +
				this.adminTable(['PNR', 'Passenger', 'Flight', 'Date', 'Route', 'Class', 'Status'], bookings.map((b) => {
					const f = flights.find((x) => String(x.id) === String(b.flightId)) || flights.find((x) => x.flightNumber === b.flightNumber) || {};
					const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId], air = airlineOf(b.flightNumber, f.airline);
					return [b.id, [esc(b.pnr), esc(b.firstName + ' ' + b.lastName), esc(b.flightNumber + (air ? ' · ' + air : '')), esc(f.departureTime ? fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime) : '?'),
						esc(o && d ? o.code + ' → ' + d.code : '?'), esc(CLASS_LABEL[classOf(b.travelClass)]),
						'<span class="fa-badge ' + (b.bookingStatus === 'CheckedIn' ? 'landed' : b.bookingStatus === 'Cancelled' ? 'delayed' : 'ontime') + '">' + esc(b.bookingStatus === 'CheckedIn' ? 'Checked in' : b.bookingStatus) + '</span>']];
				}));
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
			const E = ENT[tab], items = tab === 'airports' ? airports : gates;
			body = '<div class="fa-head"><h2>' + E.plural + '</h2><button class="fa-btn block-auto" data-add="' + tab + '">+ Add ' + E.label + '</button></div>' +
				this.adminTable(E.cols.map((c) => c[1]), items.map((it) => [it.id, E.cols.map((c) => esc(it[c[0]]))]));
		}

		view.innerHTML = '<div class="fa-title"><h1>Admin Portal</h1><p>Manage flights, airports, gates and bookings. Changes appear on the public pages straight away.</p></div>' +
			(notice ? `<div class="fa-notice ${notice.error ? 'error' : ''}">${esc(notice.text)}</div>` : '') + body;

		if (tab === 'reservations') this.bindReservations(view, reservations);
		view.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => this.adminForm(view, b.dataset.add, null, {airports, flights, gates, bookings})));
		view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
			const list = tab === 'flights' ? flights : tab === 'airports' ? airports : tab === 'bookings' ? bookings : gates;
			this.adminForm(view, tab, list.find((x) => String(x.id) === b.dataset.edit), {airports, flights, gates, bookings});
		}));
		view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
			if (!confirm('Delete this ' + ENT[tab].label.toLowerCase() + '? This cannot be undone.')) return;
			try {
				await this.apiWrite('DELETE', ENT[tab].item + b.dataset.del);
				this._airports = null;
				await this.renderAdmin(view, tab, {text: ENT[tab].label + ' deleted.'});
			} catch (e) {
				await this.renderAdmin(view, tab, {error: true, text: 'Could not delete: ' + e.message + (tab === 'airports' ? ' (an airport used by flights cannot be deleted)' : '')});
			}
		}));
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
			rows.map((r) => '<tr>' + r[1].map((c) => '<td>' + c + '</td>').join('') + `<td class="fa-actions"><button class="fa-link" data-edit="${r[0]}">Edit</button><button class="fa-link danger" data-del="${r[0]}">Delete</button></td></tr>`).join('') +
			'</tbody></table></div>';
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
			fields = E.fields.map((f) => `<label>${f.l}<input name="${f.k}" ${f.req ? 'required' : ''} value="${esc(item ? item[f.k] : '')}" /></label>`).join('');
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
				payload = Object.fromEntries(E.fields.map((f) => [f.k, form[f.k].value.trim()]));
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
			const items = ROUTES.filter((r) => r.menu && r.auth).map((r) => `<a href="${root}/${r.slug}" class="${r.path === current ? 'active' : ''}">${r.label}</a>`).join('');
			return '<div class="fa-bellwrap"><button type="button" class="fa-bell" aria-label="Notifications">' + ICONS.bell + '<span class="fa-bellcount" hidden></span></button><div class="fa-notes" hidden></div></div>' +
				'<div class="fa-usermenu"><button type="button" class="fa-userbtn" aria-haspopup="true" aria-expanded="false"><span class="fa-avatar">' + esc(name.trim().charAt(0).toUpperCase()) + '</span><span class="fa-uname">' + esc(name) + '</span><span class="fa-caret">&#9662;</span></button>' +
				'<div class="fa-usermenu-list" hidden><div class="fa-umhead">Signed in as<b>' + esc(name) + '</b></div>' + items +
				`<a class="fa-logout" href="${t.getPathContext()}/c/portal/logout?referer=${encodeURIComponent(root + '/login')}">Logout</a></div></div>`;
		}
		return `<a class="fa-auth ${current === 'login' ? 'active' : ''}" href="${root}/login">Login</a><a class="fa-auth primary ${current === 'register' ? 'active' : ''}" href="${root}/register">Register</a>`;
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

	// Login and Register share one look: an airport or aircraft picture (loaded from Wikipedia, never stored) beside the form.
	authShell(title, cardTitle, subtitle, formHtml, altHtml) {
		const topics = ['Cloud', 'Cumulus cloud', 'Airbus A350', 'Boeing 787 Dreamliner', 'Indira Gandhi International Airport', 'Dubai International Airport'];
		const topic = topics[Math.floor(Date.now() / 86400000) % topics.length];
		return '<div class="fa-authpage" data-photo-city="' + esc(topic) + '" data-photo-overlay="linear-gradient(180deg, rgba(12,34,92,.50), rgba(8,18,50,.84))"><div class="fa-authwrap">' +
			'<h1 class="fa-authtitle">' + title + '</h1>' +
			'<section class="fa-authcard2"><header>' + cardTitle + '</header><div class="fa-authbody">' + (subtitle ? '<p class="fa-authsub">' + subtitle + '</p>' : '') + formHtml + altHtml + '</div></section>' +
			'<small class="fa-authcredit">Background: ' + esc(topic) + ' &middot; Wikipedia / Wikimedia Commons</small></div></div>';
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
		fillPhotos(view);
		this.pwdToggle(view);
		const form = view.querySelector('form'), err = view.querySelector('.fa-error');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			const btn = form.querySelector('button[type=submit]');
			btn.disabled = true;
			try {
				const home = this._root + '/home';
				const res = await this.post(await this.loginUrl('%2Flogin%2Flogin'), {login: form.login.value, password: form.password.value, rememberMe: form.rememberMe.checked ? 'true' : 'false', saveLastPath: 'false', redirect: home});
				const signInPath = await this.signInPath();
				if (res.ok && !new URL(res.url).pathname.startsWith(signInPath)) {
					location.href = home;
					return;
				}
				err.textContent = 'Incorrect email or password.';
			} catch (x) {
				err.textContent = 'Could not sign in: ' + x.message;
			}
			err.hidden = false;
			btn.disabled = false;
		});
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
			'<div class="fa-two"><label>Password<span class="fa-pwd"><input name="password1" type="password" required autocomplete="new-password" /></span></label>' +
			'<label>Confirm password<span class="fa-pwd"><input name="password2" type="password" required autocomplete="new-password" /></span></label></div>' +
			'<div class="fa-error" hidden></div><button class="fa-btn block" type="submit">CREATE ACCOUNT</button></form>',
			'<p class="fa-alt">Already have an account? <a href="' + this._root + '/login">Log in</a></p>');
		fillPhotos(view);
		const form = view.querySelector('form'), err = view.querySelector('.fa-error');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			if (form.password1.value !== form.password2.value) {
				err.textContent = 'Passwords do not match.';
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
			'<section class="fa-herox"' + (star ? ' data-photo-city="' + esc(star.city) + '" data-photo-country="' + esc(star.country) + '" data-photo-overlay="linear-gradient(180deg, rgba(8,18,50,.30) 0%, rgba(8,18,50,.55) 55%, rgba(8,18,50,.86) 100%)"' : '') + '>' +
			'<div class="fa-herox-in"><span class="fa-pill">&#9679; Live flight tracking</span><h1>Know where your flight is, <em>before you leave</em></h1>' +
			'<p>Live departures, arrivals, gates and delays across every airport we cover, plus real aircraft on the map.</p>' +
			(star ? '<small class="fa-herocap">Featured destination: ' + esc(star.city) + '</small>' : '') + '</div></section>' +
			'<section class="fa-searchcard"><div class="fa-stabs"><button type="button" class="active" data-t="num">Flight number</button><button type="button" data-t="route">Route &amp; date</button><button type="button" data-t="board">Airport board</button></div>' +
			'<form class="fa-sform" data-p="num"><input name="q" placeholder="Flight number, airline or city, e.g. AI101 or IndiGo" /><button class="fa-btn" type="submit">Search flight</button></form>' +
			'<form class="fa-sform" data-p="route" hidden><label>From<select name="from">' + airportOpts('') + '</select></label><label>To<select name="to">' + airportOpts('') + '</select></label><label>Date<input type="date" name="date" /></label><button class="fa-btn" type="submit">Search flights</button></form>' +
			'<form class="fa-sform" data-p="board" hidden><label>Airport<select name="airport">' + Object.values(ap).sort((x, y) => x.city.localeCompare(y.city)).map((a) => `<option value="${esc(a.code)}">${esc(a.city)} (${esc(a.code)}) - ${esc(a.name)}</option>`).join('') + '</select></label><button class="fa-btn" type="submit">Open board</button></form>' +
			(routes.length ? '<div class="fa-poproutes"><span>Popular routes</span>' + routes.map((f) => `<a href="${r}/search?from=${esc(f.originAirportId)}&to=${esc(f.destinationAirportId)}">${esc((ap[f.originAirportId] || {}).code || '?')} &rarr; ${esc((ap[f.destinationAirportId] || {}).code || '?')}</a>`).join('') + '</div>' : '') + '</section>' +
			this.statTiles(this.stats(flights, ap)) +
			'<section class="fa-checkin"><div class="fa-ck-text"><span class="fa-pill dark">Online check-in</span><h2>Check in and get your boarding pass</h2><p>Enter the booking code (PNR) and last name from your ticket. Check-in is free, and you can choose your own seat before the flight lands.</p></div>' +
			'<form class="fa-ckform"><input name="pnr" placeholder="PNR / booking code" autocomplete="off" maxlength="12" /><input name="last" placeholder="Last name" autocomplete="off" maxlength="40" /><button class="fa-btn" type="submit" disabled>Check in</button><small>' + (Liferay.ThemeDisplay.isSignedIn() ? 'Your booking code is on your ticket.' : 'You will be asked to sign in first.') + '</small></form></section>' +
			'<section class="fa-live fa-reveal"><div class="fa-live-text"><span class="fa-pill dark"><i class="fa-dot"></i> Live now</span><h2>Aircraft flying over India right now</h2><p>Real positions from open ADS-B data, refreshed every 20 seconds. Open the full map and click any plane to see where it is going, with its photo.</p>' +
			'<div class="fa-livestats"><div><b data-live="air">-</b><span>In the air</span></div><div><b data-live="alt">-</b><span>Average altitude</span></div><div><b data-live="ground">-</b><span>On the ground</span></div></div><a class="fa-btn" href="' + r + '/live-map">Open the live map</a></div><div class="fa-minimap tall"></div></section>' +
			['Domestic', 'International'].map((k) => {
				const hits = flights.filter((f) => kindOf(f, ap) === k).slice(0, 3);
				return '<section class="fa-section"><div class="fa-head"><h2>' + k + ' flights</h2><a href="' + r + '/flight-status">View all &rarr;</a></div>' +
					(hits.length ? hits.map((f) => this.flightRow(f, ap)).join('') : '<div class="fa-msg">No ' + k.toLowerCase() + ' flights found.</div>') + '</section>';
			}).join('') +
			'<section class="fa-section fa-reveal"><div class="fa-head"><h2>Popular destinations</h2><a href="' + r + '/airports">All airports &rarr;</a></div><div class="fa-destgrid">' +
			served.slice(0, 6).map((a) => {
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
 		fillPhotos(view);
		this.bindMiniMaps(view);
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

	async view_flights(view) {
		await this.loadFlightAlerts();
		this.bindFlightAlerts(view);
		const load = async () => {
			const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
			let filter = this._filter || 'all';
			let kind = this._kind || 'all';
			const statuses = [...new Set(flights.map((f) => f.status))];
			const kinds = ['Domestic', 'International'];
			const draw = () => {
				const hits = flights.filter((f) => (filter === 'all' || f.status === filter) && (kind === 'all' || kindOf(f, ap) === kind));
				view.innerHTML = '<div class="fa-title"><h1>Flight Status</h1><p>Live departures and arrivals. Updated ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ' &middot; refreshes automatically.</p></div>' +
					this.statTiles(this.stats(flights, ap)) +
					'<div class="fa-split"><div class="fa-main">' +
					'<div class="fa-tabs"><button class="fa-tab ' + (kind === 'all' ? 'active' : '') + '" data-k="all">All flights (' + flights.length + ')</button>' +
					kinds.map((k) => `<button class="fa-tab ${kind === k ? 'active' : ''}" data-k="${k}">${k} (${flights.filter((f) => kindOf(f, ap) === k).length})</button>`).join('') + '</div>' +
					'<div class="fa-chips"><button class="fa-chip ' + (filter === 'all' ? 'active' : '') + '" data-f="all">All (' + flights.length + ')</button>' +
					statuses.map((s) => `<button class="fa-chip ${filter === s ? 'active' : ''}" data-f="${esc(s)}">${esc(s)} (${flights.filter((f) => f.status === s).length})</button>`).join('') + '</div>' +
					(hits.length ? hits.map((f) => this.flightRow(f, ap)).join('') : '<div class="fa-msg">No flights found.</div>') +
					'</div>' + this.sidePanel(flights, ap) + '</div>';
				this.bindMiniMaps(view);
				view.querySelectorAll('.fa-tab').forEach((b) => b.addEventListener('click', () => {
					kind = this._kind = b.dataset.k;
					draw();
				}));
				view.querySelectorAll('.fa-chip').forEach((b) => b.addEventListener('click', () => {
					filter = this._filter = b.dataset.f;
					draw();
				}));
			};
			draw();
		};
		await load();
		clearInterval(this._timer);
		this._timer = setInterval(() => load().catch(() => {}), 30000);
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

		const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
		await this.loadFlightAlerts();
		this.bindFlightAlerts(view);
		const followed = flights.filter((flight) => this._followingFlights.has(String(flight.id)));
		view.innerHTML = '<div class="fa-title"><h1>My Flight Alerts</h1><p>We will email you when a followed flight’s status, delay or gate changes.</p></div>' +
			(followed.length ? followed.map((flight) => this.flightRow(flight, ap)).join('') : '<p class="fa-msg">You are not following any flights yet. Browse <a href="' + this._root + '/flight-status">flight status</a> and choose “Get email alerts”.</p>');
	}

	async view_airports(view) {
		const [ap, flights] = await Promise.all([this.airports(), this.flights()]);
		const list = Object.values(ap);
		const count = (id) => flights.filter((f) => f.originAirportId == id || f.destinationAirportId == id).length;
		view.innerHTML = '<div class="fa-title"><h1>Airports</h1><p>' + list.length + ' airports in our network.</p></div><div class="fa-grid">' +
			(list.map((a) => `<div class="fa-card"><div class="fa-cardphoto" data-photo-city="${esc(a.city)}" data-photo-country="${esc(a.country)}"><span class="fa-code">${esc(a.code)}</span></div><b>${esc(a.name)}</b><span>${esc(a.city)}${a.country ? ', ' + esc(a.country) : ''}</span><small>${count(a.id)} flight(s) today</small></div>`).join('') || '<div class="fa-msg">No airports found.</div>') + '</div><p class="fa-credit">City photos: Wikipedia &amp; Wikimedia Commons</p>';
		fillPhotos(view);
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

	passHtml(p, ap) {
		const dep = parseDate(p.departureTime);
		const boarding = dep ? new Date(dep.getTime() - 45 * 60000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
		let qr = '';
		try {
			const code = window.qrcode(0, 'M');
			code.addData(['FSP', p.pnr, p.flightNumber, p.seat, p.passengerName].join('|'));
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
			`<div><span>Class</span><b>${esc(p.travelClass && p.travelClass !== 'null' ? CLASS_LABEL[classOf(p.travelClass)] : 'Economy Class')}</b></div></div></div>` +
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
		const [flights, ap] = await Promise.all([this.flights(), this.airports(), this.loadQr().catch(() => {})]);
		this._airlines = Object.fromEntries(flights.map((f) => [f.flightNumber, f.airline]));
		let tab = 'new', seat = '', taken = [];

		const call = async (method, path, body) => {
			const res = await getFetch()(api + path, {method, credentials: 'include', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
			let data = {};
			try { data = await res.json(); } catch (e) {}
			if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
			return data;
		};
		// Paid seat: server makes a Stripe Checkout page, we go there, Stripe sends the user back with a session_id, and the server checks it at /pass
		const payForSeat = async (b, lastName) => {
			const order = await call('POST', '/payment/order', {siteId: site, pnr: b.pnr, lastName, seat, returnUrl: location.origin + location.pathname});
			location.href = order.url;
			return new Promise(() => {});
		};
		const printPass = () => {
			document.body.classList.add('fa-print-mode');
			window.print();
			setTimeout(() => document.body.classList.remove('fa-print-mode'), 500);
		};
		const showPass = (box, p) => {
			box.innerHTML = this.passHtml(p, ap) + '<div class="fa-pass-actions"><button class="fa-btn" type="button">Print / Save as PDF</button></div>';
			box.querySelector('button').addEventListener('click', printPass);
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
					'<div class="fa-summary"></div><div class="fa-error" hidden></div><button class="fa-btn" type="submit">Check in and get boarding pass</button></div>' +
					'<div class="fa-ckcard fa-plane"><h3>' + esc(b.flightNumber) + ' &middot; Cabin</h3><div class="fa-seats"></div></div></form>';
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
					form.querySelector('.fa-summary').innerHTML = seat ? '<span>Your seat</span><b>' + seat + '</b><small>' + kind + '</small><em>' + (fee ? 'Extra &#8377;' + fee : 'Free') + '</em>' : '<span>Pick a seat on the plane</span>';
					form.querySelector('button[type=submit]').textContent = fee ? 'Pay \u20b9' + fee + ' and check in' : 'Check in and get boarding pass';
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
			if (sessionId) { seat = new URLSearchParams(location.search).get('seat') || ''; history.replaceState(null, '', location.pathname); setTimeout(() => form.requestSubmit(), 400); }

			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				err.hidden = true;
				if (!seat) { err.textContent = 'Please choose a seat.'; err.hidden = false; return; }
				const btn = form.querySelector('button[type=submit]');
				btn.disabled = true;
				try {
					const pay = sessionId ? {sessionId} : seatFee(seat) ? await payForSeat(b, lastName) : {};
					const pass = await call('POST', '/pass', {siteId: site, pnr: b.pnr, lastName, seat, ...pay});
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
	}
}

if (!customElements.get('flight-status-app')) {
	customElements.define('flight-status-app', FlightStatusApp);
}
