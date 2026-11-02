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
	{path: 'boarding', slug: 'boarding-pass', label: 'Boarding Pass', auth: true},
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
const classOf = (v) => (CLASS_LABEL[v] ? v : 'Economy');
const statusClass = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

const showRoute = (r) => !r.hidden && (!r.auth || Liferay.ThemeDisplay.isSignedIn());

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
			? [['dashboard', 'Dashboard'], ['flights', 'Flights'], ['airports', 'Airports'], ['gates', 'Gates']]
				.map((t) => `<a href="${root}/admin?tab=${t[0]}" class="${current === 'admin' && tab === t[0] ? 'active' : ''}">${t[1]}</a>`).join('') +
				`<a href="${root}/live-map" class="${current === 'live' ? 'active' : ''}">Live Map</a>` +
				`<a class="fa-auth" href="${root}/home?viewsite=1">View site</a>`
			: ROUTES.filter(showRoute).map((r) => `<a href="${root}/${r.slug}" class="${r.path === current ? 'active' : ''}">${r.label}</a>`).join('') +
				(admin ? `<a class="fa-auth" href="${root}/admin">Admin</a>` : '');
		const footerLinks = adminMode
			? '<span>Admin Portal</span>'
			: ROUTES.filter(showRoute).map((r) => `<a href="${root}/${r.slug}">${r.label}</a>`).join('') + '<span class="fa-sep">&middot;</span><span>Live flight information</span>';

		this.innerHTML =
			'<header class="fa-header"><div class="fa-nav"><a class="fa-brand" href="' + root + (adminMode ? '/admin' : '/home') + '"><span class="fa-logo">' + ICONS.plane + '</span>Flight Status <b>' + (adminMode ? 'Admin' : 'Portal') + '</b></a>' +
			'<button class="fa-burger" type="button" aria-label="Menu">&#9776;</button>' +
			'<nav class="fa-links">' + links + this.authLinks(root, current) + '</nav></div></header>' +
			'<main class="fa-view"><div class="fa-msg">Loading...</div></main>' +
			'<footer class="fa-footer"><span>&copy; ' + new Date().getFullYear() + ' Flight Status Portal</span><span class="fa-sep">&middot;</span>' + footerLinks + '</footer>';

		this.querySelector('.fa-burger').addEventListener('click', () => this.querySelector('.fa-links').classList.toggle('open'));

		const view = this.querySelector('.fa-view');
		this['view_' + current](view, q).catch((e) => (view.innerHTML = `<div class="fa-msg">Error: ${esc(e.message)}</div>`));
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
		const apById = Object.fromEntries(airports.map((a) => [a.id, a]));
		const tabs = [['dashboard', 'Dashboard'], ['flights', 'Flights (' + flights.length + ')'], ['airports', 'Airports (' + airports.length + ')'], ['gates', 'Gates (' + gates.length + ')'], ['bookings', 'Bookings (' + bookings.length + ')']];

		let body = '';
		if (tab === 'dashboard') {
			const delayed = flights.filter((f) => f.showstatus && f.showstatus.key === 'Delayed').length;
			body = '<div class="fa-stats" style="margin:0 0 1.5rem">' +
				[['plane', flights.length, 'Flights'], ['building', airports.length, 'Airports'], ['gate', gates.length, 'Gates'], ['clock', delayed, 'Delayed flights']]
					.map((s) => `<div class="fa-stat"><span class="fa-ico">${ICONS[s[0]]}</span><div><b>${s[1]}</b><span>${s[2]}</span></div></div>`).join('') + '</div>' +
				'<div class="fa-adminbtns"><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button><button class="fa-btn block-auto" data-add="airports">+ Add Airport</button><button class="fa-btn block-auto" data-add="gates">+ Add Gate</button><button class="fa-btn block-auto" data-add="bookings">+ Add Booking</button></div>';
		} else if (tab === 'flights') {
			body = '<div class="fa-head"><h2>Flights</h2><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button></div>' +
				this.adminTable(['Flight', 'Route', 'Departure', 'Status', 'Delay'], flights.map((f) => {
					const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId];
					return [f.id, [esc(f.flightNumber) + (airlineOf(f.flightNumber, f.airline) ? '<br><small>' + esc(airlineOf(f.flightNumber, f.airline)) + '</small>' : ''), esc((o ? o.code : '?') + ' → ' + (d ? d.code : '?')), fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime),
						'<span class="fa-badge ' + statusClass(f.showstatus ? f.showstatus.name : '') + '">' + esc(f.showstatus ? f.showstatus.name : '') + '</span>', (f.delayMinutes || 0) + ' min']];
				}));
		} else if (tab === 'bookings') {
			body = '<div class="fa-head"><h2>Bookings</h2><button class="fa-btn block-auto" data-add="bookings">+ Add Booking</button></div>' +
				this.adminTable(['PNR', 'Passenger', 'Flight', 'Route', 'Class', 'Status'], bookings.map((b) => [b.id, [esc(b.pnr), esc(b.firstName + ' ' + b.lastName), esc(b.flightNumber + (airlineOf(b.flightNumber, (flights.find((x) => x.flightNumber === b.flightNumber) || {}).airline) ? ' · ' + airlineOf(b.flightNumber, (flights.find((x) => x.flightNumber === b.flightNumber) || {}).airline) : '')),
					(() => { const f = flights.find((x) => x.flightNumber === b.flightNumber), o = f && apById[f.r_originAirport_c_airportId], d = f && apById[f.r_destinationAirport_c_airportId]; return esc(o && d ? o.code + ' → ' + d.code : '?'); })(),
					esc(CLASS_LABEL[classOf(b.travelClass)]),
					'<span class="fa-badge ' + (b.bookingStatus === 'CheckedIn' ? 'landed' : b.bookingStatus === 'Cancelled' ? 'delayed' : 'ontime') + '">' + esc(b.bookingStatus === 'CheckedIn' ? 'Checked in' : b.bookingStatus) + '</span>']]));
		} else {
			const E = ENT[tab], items = tab === 'airports' ? airports : gates;
			body = '<div class="fa-head"><h2>' + E.plural + '</h2><button class="fa-btn block-auto" data-add="' + tab + '">+ Add ' + E.label + '</button></div>' +
				this.adminTable(E.cols.map((c) => c[1]), items.map((it) => [it.id, E.cols.map((c) => esc(it[c[0]]))]));
		}

		view.innerHTML = '<div class="fa-title"><h1>Admin Portal</h1><p>Manage flights, airports, gates and bookings. Changes appear on the public pages straight away.</p></div>' +
			(notice ? `<div class="fa-notice ${notice.error ? 'error' : ''}">${esc(notice.text)}</div>` : '') + body;

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
				`<label>Delay (minutes)<input name="delayMinutes" type="number" min="0" value="${item ? item.delayMinutes || 0 : 0}" /></label>`;
		} else if (kind === 'bookings') {
			const pnr = item ? item.pnr : Array.from({length: 6}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
			const apOpts = data.airports.map((a) => [a.id, a.city + ', ' + a.country + ' (' + a.code + ')']);
			const cur = item ? data.flights.find((f) => f.flightNumber === item.flightNumber) : data.flights[0];
			fields = `<label>Booking code (PNR)<input name="pnr" required maxlength="12" value="${esc(pnr)}" /></label>` +
				`<div class="fa-two"><label>From (city, country)<select name="from">${opt(apOpts, cur && cur.r_originAirport_c_airportId)}</select></label>` +
				`<label>To (city, country)<select name="to">${opt(apOpts, cur && cur.r_destinationAirport_c_airportId)}</select></label></div>` +
				`<label>Flight<select name="flightNumber"></select><span class="fa-hint fa-routehint"></span></label>` +
				`<div class="fa-two"><label>First name<input name="firstName" required value="${esc(item ? item.firstName : '')}" /></label>` +
				`<label>Last name<input name="lastName" required value="${esc(item ? item.lastName : '')}" /></label></div>` +
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
		if (kind === 'bookings') {
			const fillFlights = (keep) => {
				const match = data.flights.filter((f) => String(f.r_originAirport_c_airportId) === form.from.value && String(f.r_destinationAirport_c_airportId) === form.to.value);
				form.flightNumber.innerHTML = match.map((f) => `<option value="${esc(f.flightNumber)}">${esc(f.flightNumber + (airlineOf(f.flightNumber, f.airline) ? ' ' + airlineOf(f.flightNumber, f.airline) : '') + ' · ' + fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime))}</option>`).join('');
				if (keep && match.some((f) => f.flightNumber === keep)) form.flightNumber.value = keep;
				form.querySelector('.fa-routehint').textContent = match.length ? '' : 'No flight on this route yet. Add the flight first in the Flights tab.';
			};
			form.from.addEventListener('change', () => fillFlights());
			form.to.addEventListener('change', () => fillFlights());
			fillFlights(item && item.flightNumber);
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
				if (!form.flightNumber.value) { err.textContent = 'No flight on this route yet. Add the flight first in the Flights tab.'; err.hidden = false; return; }
				const pnrValue = form.pnr.value.trim().toUpperCase();
				if (data.bookings.some((b) => b.pnr.toUpperCase() === pnrValue && (!item || b.id !== item.id))) { err.textContent = 'This booking code already exists.'; err.hidden = false; return; }
				payload = {pnr: pnrValue, flightNumber: form.flightNumber.value, firstName: form.firstName.value.trim(), lastName: form.lastName.value.trim(), travelClass: form.travelClass.value, bookingStatus: form.bookingStatus.value};
			} else {
				payload = Object.fromEntries(E.fields.map((f) => [f.k, form[f.k].value.trim()]));
			}
			const btn = form.querySelector('button[type=submit]');
			btn.disabled = true;
			try {
				if (item) await this.apiWrite('PATCH', E.item + item.id, payload);
				else await this.apiWrite('POST', E.create, payload);
				modal.remove();
				this._airports = null;
				await this.renderAdmin(view, kind, {text: E.label + (item ? ' updated.' : ' added.')});
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
			return `<span class="fa-user">Hi, ${esc(t.getUserName())}</span><a class="fa-auth" href="${t.getPathContext()}/c/portal/logout">Logout</a>`;
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

	async view_login(view) {
		if (Liferay.ThemeDisplay.isSignedIn()) {
			location.href = this._root + '/home';
			return;
		}
		view.innerHTML = '<div class="fa-auth-box"><h1>Welcome back</h1><p>Sign in to your Flight Status account.</p>' +
			'<form class="fa-authform"><label>Email address<input name="login" type="email" required autocomplete="username" /></label>' +
			'<label>Password<input name="password" type="password" required autocomplete="current-password" /></label>' +
			'<div class="fa-error" hidden></div><button class="fa-btn block" type="submit">Sign in</button></form>' +
			'<p class="fa-alt">New here? <a href="' + this._root + '/register">Create an account</a></p></div>';
		const form = view.querySelector('form'), err = view.querySelector('.fa-error');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			const btn = form.querySelector('button');
			btn.disabled = true;
			try {
				const home = this._root + '/home';
				const res = await this.post(await this.loginUrl('%2Flogin%2Flogin'), {login: form.login.value, password: form.password.value, saveLastPath: 'false', redirect: home});
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
		view.innerHTML = '<div class="fa-auth-box"><h1>Create your account</h1><p>Register to access the Flight Status Portal.</p>' +
			'<form class="fa-authform"><div class="fa-two"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>' +
			'<label>Username<input name="screenName" required pattern="[A-Za-z0-9._-]+" title="Letters, numbers, dot, dash or underscore" /></label>' +
			'<label>Email address<input name="emailAddress" type="email" required autocomplete="email" /></label>' +
			'<label>Password<input name="password1" type="password" required autocomplete="new-password" /></label>' +
			'<label>Confirm password<input name="password2" type="password" required autocomplete="new-password" /></label>' +
			'<div class="fa-error" hidden></div><button class="fa-btn block" type="submit">Create account</button></form>' +
			'<p class="fa-alt">Already registered? <a href="' + this._root + '/login">Sign in</a></p></div>';
		const form = view.querySelector('form'), err = view.querySelector('.fa-error');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			if (form.password1.value !== form.password2.value) {
				err.textContent = 'Passwords do not match.';
				err.hidden = false;
				return;
			}
			const btn = form.querySelector('button');
			btn.disabled = true;
			try {
				const home = this._root + '/home';
				const res = await this.post(await this.loginUrl('%2Flogin%2Fcreate_account'), {
					cmd: 'add', firstName: form.firstName.value, lastName: form.lastName.value, screenName: form.screenName.value,
					emailAddress: form.emailAddress.value, password1: form.password1.value, password2: form.password2.value,
					birthdayMonth: 0, birthdayDay: 1, birthdayYear: 1970, languageId: 'en_US', saveLastPath: 'false', redirect: home,
				});
				if (res.ok && new URL(res.url).pathname.startsWith(this._root)) {
					location.href = home;
					return;
				}
				err.textContent = 'Could not create the account. The email or username may already be in use, or the password is too weak.';
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
		const o = ap[f.originAirportId], d = ap[f.destinationAirportId];
		return `<div class="fa-row"><div class="fa-num">${logoHtml(f.flightNumber, f.airline) || '<span class="fa-ico sm">' + ICONS.plane + '</span>'}<span class="fa-flightname">${esc(f.flightNumber)}${f.airline ? '<small>' + esc(f.airline) + '</small>' : ''}</span></div>` +
			`<div class="fa-route"><div><b>${esc(o ? o.code : f.originAirportId)}</b><small>${esc(o ? o.city : '')}</small></div>` +
			`<span class="fa-line"></span><div><b>${esc(d ? d.code : f.destinationAirportId)}</b><small>${esc(d ? d.city : '')}</small></div></div>` +
			`<div class="fa-times"><div><small>Departs</small><b>${fmtTime(f.departureTime)}</b></div><div><small>Arrives</small><b>${fmtTime(f.arrivalTime)}</b></div><div><small>Date</small><b>${fmtDate(f.departureTime)}</b></div></div>` +
			`<div class="fa-state"><span class="fa-badge ${statusClass(f.status)}">${esc(f.status)}</span>${f.delayMinutes ? `<small>+${esc(f.delayMinutes)} min</small>` : ''}</div></div>`;
	}

	async view_home(view) {
		const [flights, ap] = await Promise.all([this.flights(), this.airports()]);
		const r = this._root;
		const popular = Object.values(ap).slice(0, 4);
		const features = [
			{icon: 'clock', title: 'Real-time updates', text: 'Departure, arrival and delay information straight from the airline systems.'},
			{icon: 'search', title: 'Fast flight search', text: 'Look up any flight by number or status in seconds.'},
			{icon: 'building', title: 'Airport directory', text: 'Browse every airport we cover with codes, names and cities.'},
			{icon: 'gate', title: 'Gate information', text: 'Know your terminal and gate before you head to the airport.'},
			{icon: 'bell', title: 'Delay awareness', text: 'Delayed flights are highlighted with the exact minutes of delay.'},
			{icon: 'shield', title: 'Reliable data', text: 'One source of truth that every page of the portal reads from.'},
		];
		const served = Object.values(ap).filter((a) => flights.some((f) => f.originAirportId == a.id || f.destinationAirportId == a.id));
		const star = served.length ? served[Math.floor(Date.now() / 86400000) % served.length] : null;
		view.innerHTML =
			'<section class="fa-hero"' + (star ? ' data-photo-city="' + esc(star.city) + '" data-photo-country="' + esc(star.country) + '" data-photo-overlay="linear-gradient(135deg, rgba(11,95,255,.8), rgba(18,39,92,.9))"' : '') + '><span class="fa-pill">Live flight tracking</span><h1>Know where your flight is, <em>before you leave</em></h1>' +
			'<p>Check live departures, arrivals, gates and delays across all airports in one place.</p>' +
			'<form class="fa-form"><input placeholder="Enter flight number, e.g. DL250" /><button class="fa-btn" type="submit">Search flight</button></form>' +
			(star ? '<small class="fa-herocap">Featured destination: ' + esc(star.city) + '</small>' : '') + '</section>' +
			this.statTiles(this.stats(flights, ap)) +
			['Domestic', 'International'].map((k) => {
				const hits = flights.filter((f) => kindOf(f, ap) === k).slice(0, 3);
				return '<section class="fa-section"><div class="fa-head"><h2>' + k + ' flights</h2><a href="' + r + '/flight-status">View all &rarr;</a></div>' +
					(hits.length ? hits.map((f) => this.flightRow(f, ap)).join('') : '<div class="fa-msg">No ' + k.toLowerCase() + ' flights found.</div>') + '</section>';
			}).join('') +
			'<section class="fa-section"><div class="fa-head"><h2>Airports</h2><a href="' + r + '/airports">All airports &rarr;</a></div><div class="fa-grid">' +
			popular.map((a) => `<div class="fa-card"><div class="fa-cardphoto" data-photo-city="${esc(a.city)}" data-photo-country="${esc(a.country)}"><span class="fa-code">${esc(a.code)}</span></div><b>${esc(a.city)}</b><span>${esc(a.name)}</span></div>`).join('') + '</div><p class="fa-credit">City photos: Wikipedia &amp; Wikimedia Commons &middot; Airline logos: pics.avs.io</p></section>' +
			'<section class="fa-section"><div class="fa-head"><h2>Everything you need</h2></div><div class="fa-grid three">' +
			features.map((f) => `<div class="fa-card"><span class="fa-ico">${ICONS[f.icon]}</span><b>${f.title}</b><span>${f.text}</span></div>`).join('') + '</div></section>' +
			'<section class="fa-cta"><div><h2>Ready to check your flight?</h2><p>Search by flight number or browse everything that is flying today.</p></div>' +
			'<a class="fa-btn" href="' + r + '/search">Search flights</a></section>';
 		fillPhotos(view);
		view.querySelector('form').addEventListener('submit', (e) => {
			e.preventDefault();
			location.href = r + '/search?q=' + encodeURIComponent(view.querySelector('input').value.trim());
		});
	}

	async view_flights(view) {
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
					'<div class="fa-tabs"><button class="fa-tab ' + (kind === 'all' ? 'active' : '') + '" data-k="all">All flights (' + flights.length + ')</button>' +
					kinds.map((k) => `<button class="fa-tab ${kind === k ? 'active' : ''}" data-k="${k}">${k} (${flights.filter((f) => kindOf(f, ap) === k).length})</button>`).join('') + '</div>' +
					'<div class="fa-chips"><button class="fa-chip ' + (filter === 'all' ? 'active' : '') + '" data-f="all">All (' + flights.length + ')</button>' +
					statuses.map((s) => `<button class="fa-chip ${filter === s ? 'active' : ''}" data-f="${esc(s)}">${esc(s)} (${flights.filter((f) => f.status === s).length})</button>`).join('') + '</div>' +
					(hits.length ? hits.map((f) => this.flightRow(f, ap)).join('') : '<div class="fa-msg">No flights found.</div>');
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
		const params = new URLSearchParams(location.search);
		const airports = Object.values(ap).sort((x, y) => x.city.localeCompare(y.city));
		const localDay = (v) => { const d = parseDate(v); return d ? d.toLocaleDateString('en-CA') : ''; };
		let tab = q ? 'keyword' : 'route';

		const opts = (sel) => '<option value="">Any airport</option>' + airports.map((a) => `<option value="${esc(a.id)}" ${String(a.id) === String(sel) ? 'selected' : ''}>${esc(a.city + ' (' + a.code + '), ' + a.country)}</option>`).join('');
		view.innerHTML = '<div class="fa-title"><h1>Search Flights</h1><p>Find flights by route and date, or by flight number, airline, airport or city.</p></div>' +
			'<div class="fa-tabs"><button class="fa-tab" data-t="route">By route and date</button><button class="fa-tab" data-t="keyword">By flight number</button></div>' +
			'<form class="fa-routeform"><label>From<select name="from">' + opts(params.get('from')) + '</select></label>' +
			'<button class="fa-swap" type="button" title="Swap">&#8644;</button>' +
			'<label>To<select name="to">' + opts(params.get('to')) + '</select></label>' +
			'<label>Date<input type="date" name="date" value="' + esc(params.get('date') || '') + '" /></label>' +
			'<button class="fa-btn" type="submit">Search flights</button></form>' +
			'<form class="fa-form wide fa-keywordform"><input placeholder="e.g. DL250, IndiGo, Delayed, JFK, Los Angeles" /><button class="fa-btn" type="submit">Search</button></form>' +
			'<div class="fa-msg"></div><div class="fa-results"></div>';
		const msg = view.querySelector('.fa-msg'), out = view.querySelector('.fa-results');
		const routeForm = view.querySelector('.fa-routeform'), keywordForm = view.querySelector('.fa-keywordform'), input = keywordForm.querySelector('input');
		input.value = q;

		const showTab = () => {
			view.querySelectorAll('.fa-tab').forEach((b) => b.classList.toggle('active', b.dataset.t === tab));
			routeForm.hidden = tab !== 'route';
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
			history.replaceState(null, '', location.pathname + (keep.toString() ? '?' + keep : ''));
			if (from && from === to) { msg.textContent = 'Choose two different airports.'; out.innerHTML = ''; return; }
			const onRoute = flights.filter((f) => (!from || String(f.originAirportId) === from) && (!to || String(f.destinationAirportId) === to));
			const hits = onRoute.filter((f) => !date || localDay(f.departureTime) === date)
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
		keywordForm.addEventListener('submit', (e) => { e.preventDefault(); renderKeyword(input.value); });
		showTab();
		if (tab === 'route') renderRoute(); else renderKeyword(q);
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
		return `<div class="fa-pass"><div class="fa-pass-top"><span>${ICONS.plane} Flight Status Portal</span><b>BOARDING PASS${p.travelClass && p.travelClass !== 'null' ? ' &middot; ' + esc(CLASS_LABEL[classOf(p.travelClass)]).toUpperCase() : ''}</b></div>` +
			`<div class="fa-pass-body"><div class="fa-pass-main">` +
			`<div class="fa-pass-route"><div><b>${esc(p.origin)}</b><span>${esc(p.originCity)}</span></div><i>${ICONS.plane}</i><div><b>${esc(p.destination)}</b><span>${esc(p.destinationCity)}</span></div></div>` +
			`<div class="fa-pass-grid"><div><span>Passenger</span><b>${esc(p.passengerName)}</b></div><div><span>Flight</span><b>${esc(p.flightNumber)}</b></div><div><span>Airline</span><b class="fa-airlinecell">${logoHtml(p.flightNumber, (this._airlines && this._airlines[p.flightNumber]) || '')}${esc((this._airlines && this._airlines[p.flightNumber]) || airlineOf(p.flightNumber, '') || '-')}</b></div>` +
			`<div><span>Date</span><b>${esc(fmtDate(p.departureTime))}</b></div><div><span>Departs</span><b>${fmtTime(p.departureTime)}</b></div>` +
			`<div><span>Boarding</span><b>${esc(boarding)}</b></div><div><span>Gate</span><b>${esc(p.gate)}</b></div>` +
			`<div><span>Seat</span><b>${esc(p.seat)}</b></div><div><span>PNR</span><b>${esc(p.pnr)}</b></div>` +
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
			box.innerHTML = '<form class="fa-bpform fa-find"><p class="fa-hint">Enter the booking code (PNR) and last name from your ticket to check in.</p>' +
				'<div class="fa-two"><label>Booking code (PNR)<input name="pnr" required maxlength="12" placeholder="e.g. K7QX2M" autocomplete="off" /></label>' +
				'<label>Last name<input name="lastName" required maxlength="40" autocomplete="off" /></label></div>' +
				'<div class="fa-error" hidden></div><button class="fa-btn" type="submit">Find my booking</button></form><div class="fa-bpstep"></div><div class="fa-bpresult"></div>';
			const find = box.querySelector('.fa-find'), findErr = find.querySelector('.fa-error'), step = box.querySelector('.fa-bpstep');

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
			const f = flights.find((x) => x.flightNumber === b.flightNumber);
			step.innerHTML = '<form class="fa-bpform"><div class="fa-found"><b>Booking found</b><span>' + esc(b.passengerName) + ' &middot; ' + esc(f ? label(f) : b.flightNumber) + ' &middot; <b>' + esc(CLASS_LABEL[classOf(b.travelClass)]) + '</b></span></div>' +
				'<div class="fa-seatwrap"><b>Choose your seat: <span class="fa-seatpick">none</span></b><div class="fa-seats"></div>' +
				'<p class="fa-seatkey"><i class="free"></i> Free <i class="taken"></i> Taken <i class="mine"></i> Your seat</p></div>' +
				'<div class="fa-error" hidden></div><button class="fa-btn" type="submit">Check in and get boarding pass</button></form>';
			const form = step.querySelector('form'), err = form.querySelector('.fa-error'), grid = form.querySelector('.fa-seats');

			const drawSeats = () => {
				let html = '';
				const mine = CLASS_ROWS[classOf(b.travelClass)];
				for (let r = 1; r <= 20; r++) {
					const zone = Object.entries(CLASS_ROWS).find((z) => z[1][0] === r);
					if (zone) html += '<div class="fa-seatzone">' + CLASS_LABEL[zone[0]] + (zone[0] === classOf(b.travelClass) ? ' (your class)' : '') + '</div>';
					const inClass = r >= mine[0] && r <= mine[1];
					html += '<div class="fa-seatrow"><span>' + r + '</span>' + 'ABCDEF'.split('').map((c, i) => {
						const id = r + c, isTaken = taken.includes(id), off = isTaken || !inClass;
						return (i === 3 ? '<em></em>' : '') + `<button type="button" class="fa-seat ${isTaken ? 'taken' : ''} ${!inClass ? 'other' : ''} ${seat === id ? 'mine' : ''}" data-s="${id}" ${off ? 'disabled' : ''}>${c}</button>`;
					}).join('') + '</div>';
				}
				grid.innerHTML = html;
				form.querySelector('.fa-seatpick').textContent = seat || 'none';
				grid.querySelectorAll('.fa-seat:not(.taken):not(.other)').forEach((btn) => btn.addEventListener('click', () => { seat = btn.dataset.s; drawSeats(); }));
			};
			const loadSeats = async () => {
				try { taken = await call('GET', '/seats?siteId=' + site + '&flight=' + encodeURIComponent(b.flightNumber)); } catch (e) { taken = []; }
				if (taken.includes(seat)) seat = '';
				drawSeats();
			};
			loadSeats();

			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				err.hidden = true;
				if (!seat) { err.textContent = 'Please choose a seat.'; err.hidden = false; return; }
				const btn = form.querySelector('button[type=submit]');
				btn.disabled = true;
				try {
					const pass = await call('POST', '/pass', {siteId: site, pnr: b.pnr, lastName, seat});
					step.innerHTML = '';
					showPass(box.querySelector('.fa-bpresult'), pass);
				} catch (x) {
					err.textContent = x.message;
					err.hidden = false;
					btn.disabled = false;
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
