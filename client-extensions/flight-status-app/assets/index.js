const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getFetch = () => (window.Liferay && Liferay.Util && Liferay.Util.fetch ? Liferay.Util.fetch : fetch);
const SITE_ID = () => Liferay.ThemeDisplay.getScopeGroupId();

const ROUTES = [
	{path: 'home', slug: 'home', label: 'Home'},
	{path: 'flights', slug: 'flight-status', label: 'Flight Status'},
	{path: 'search', slug: 'search', label: 'Search'},
	{path: 'airports', slug: 'airports', label: 'Airports'},
	{path: 'gates', slug: 'gates', label: 'Gates'},
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
const statusClass = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

const pageInfo = () => {
	const parts = location.pathname.replace(/\/$/, '').split('/');
	const route = ROUTES.find((r) => r.slug === parts[parts.length - 1]);
	return {route: route ? route.path : 'home', root: (route ? parts.slice(0, -1) : parts).join('/')};
};

class FlightStatusApp extends HTMLElement {
	connectedCallback() {
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
		const items = (await this.json('/o/c/flights/scopes/' + SITE_ID() + '?pageSize=200&sort=departureTime:asc')).items;
		return items.map((f) => ({
			id: f.id,
			flightNumber: f.flightNumber,
			status: f.showstatus ? f.showstatus.name : '',
			departureTime: f.departureTime,
			arrivalTime: f.arrivalTime,
			delayMinutes: f.delayMinutes || 0,
			originAirportId: f.r_originAirport_c_airportId,
			destinationAirportId: f.r_destinationAirport_c_airportId,
			gateId: f.r_gate_c_airportId,
		}));
	}

	async airports() {
		if (!this._airports) {
			const items = (await this.json('/o/c/airports/?pageSize=100')).items;
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
		if (admin && !viewingSite && current !== 'admin' && !editing) {
			location.replace(root + '/admin');
			return;
		}

		const adminMode = admin && !viewingSite;
		const tab = params.get('tab') || 'dashboard';
		this._adminTab = tab;
		const links = adminMode
			? [['dashboard', 'Dashboard'], ['flights', 'Flights'], ['airports', 'Airports'], ['gates', 'Gates']]
				.map((t) => `<a href="${root}/admin?tab=${t[0]}" class="${current === 'admin' && tab === t[0] ? 'active' : ''}">${t[1]}</a>`).join('') +
				`<a class="fa-auth" href="${root}/home?viewsite=1">View site</a>`
			: ROUTES.filter((r) => !r.hidden).map((r) => `<a href="${root}/${r.slug}" class="${r.path === current ? 'active' : ''}">${r.label}</a>`).join('') +
				(admin ? `<a class="fa-auth" href="${root}/admin">Admin</a>` : '');
		const footerLinks = adminMode
			? '<span>Admin Portal</span>'
			: ROUTES.filter((r) => !r.hidden).map((r) => `<a href="${root}/${r.slug}">${r.label}</a>`).join('') + '<span class="fa-sep">&middot;</span><span>Live flight information</span>';

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
		const [flightsRaw, airportsRaw, gatesRaw] = await Promise.all([
			this.json(ENT.flights.list), this.json(ENT.airports.list), this.json(ENT.gates.list),
		]);
		const airports = airportsRaw.items, gates = gatesRaw.items, flights = flightsRaw.items;
		const apById = Object.fromEntries(airports.map((a) => [a.id, a]));
		const tabs = [['dashboard', 'Dashboard'], ['flights', 'Flights (' + flights.length + ')'], ['airports', 'Airports (' + airports.length + ')'], ['gates', 'Gates (' + gates.length + ')']];

		let body = '';
		if (tab === 'dashboard') {
			const delayed = flights.filter((f) => f.showstatus && f.showstatus.key === 'Delayed').length;
			body = '<div class="fa-stats" style="margin:0 0 1.5rem">' +
				[['plane', flights.length, 'Flights'], ['building', airports.length, 'Airports'], ['gate', gates.length, 'Gates'], ['clock', delayed, 'Delayed flights']]
					.map((s) => `<div class="fa-stat"><span class="fa-ico">${ICONS[s[0]]}</span><div><b>${s[1]}</b><span>${s[2]}</span></div></div>`).join('') + '</div>' +
				'<div class="fa-adminbtns"><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button><button class="fa-btn block-auto" data-add="airports">+ Add Airport</button><button class="fa-btn block-auto" data-add="gates">+ Add Gate</button></div>';
		} else if (tab === 'flights') {
			body = '<div class="fa-head"><h2>Flights</h2><button class="fa-btn block-auto" data-add="flights">+ Add Flight</button></div>' +
				this.adminTable(['Flight', 'Route', 'Departure', 'Status', 'Delay'], flights.map((f) => {
					const o = apById[f.r_originAirport_c_airportId], d = apById[f.r_destinationAirport_c_airportId];
					return [f.id, [esc(f.flightNumber), esc((o ? o.code : '?') + ' → ' + (d ? d.code : '?')), fmtDate(f.departureTime) + ' ' + fmtTime(f.departureTime),
						'<span class="fa-badge ' + statusClass(f.showstatus ? f.showstatus.name : '') + '">' + esc(f.showstatus ? f.showstatus.name : '') + '</span>', (f.delayMinutes || 0) + ' min']];
				}));
		} else {
			const E = ENT[tab], items = tab === 'airports' ? airports : gates;
			body = '<div class="fa-head"><h2>' + E.plural + '</h2><button class="fa-btn block-auto" data-add="' + tab + '">+ Add ' + E.label + '</button></div>' +
				this.adminTable(E.cols.map((c) => c[1]), items.map((it) => [it.id, E.cols.map((c) => esc(it[c[0]]))]));
		}

		view.innerHTML = '<div class="fa-title"><h1>Admin Portal</h1><p>Manage flights, airports and gates. Changes appear on the public pages straight away.</p></div>' +
			(notice ? `<div class="fa-notice ${notice.error ? 'error' : ''}">${esc(notice.text)}</div>` : '') + body;

		view.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => this.adminForm(view, b.dataset.add, null, {airports, flights, gates})));
		view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
			const list = tab === 'flights' ? flights : tab === 'airports' ? airports : gates;
			this.adminForm(view, tab, list.find((x) => String(x.id) === b.dataset.edit), {airports, flights, gates});
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
			fields = `<label>Flight number<input name="flightNumber" required value="${esc(item ? item.flightNumber : '')}" /></label>` +
				`<label>Status<select name="showstatus">${opt(E.statuses, item && item.showstatus ? item.showstatus.key : 'OnTime')}</select></label>` +
				`<div class="fa-two"><label>From<select name="origin" required>${opt(apOpts, item && item.r_originAirport_c_airportId)}</select></label>` +
				`<label>To<select name="destination" required>${opt(apOpts, item && item.r_destinationAirport_c_airportId)}</select></label></div>` +
				`<div class="fa-two"><label>Departure<input name="departureTime" type="datetime-local" required value="${toLocal(item && item.departureTime)}" /></label>` +
				`<label>Arrival<input name="arrivalTime" type="datetime-local" required value="${toLocal(item && item.arrivalTime)}" /></label></div>` +
				`<label>Delay (minutes)<input name="delayMinutes" type="number" min="0" value="${item ? item.delayMinutes || 0 : 0}" /></label>`;
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
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			err.hidden = true;
			let payload;
			if (kind === 'flights') {
				const dep = new Date(form.departureTime.value), arr = new Date(form.arrivalTime.value);
				if (form.origin.value === form.destination.value) { err.textContent = 'Origin and destination must be different.'; err.hidden = false; return; }
				if (!(arr > dep)) { err.textContent = 'Arrival must be after departure.'; err.hidden = false; return; }
				payload = {
					flightNumber: form.flightNumber.value.trim(), showstatus: form.showstatus.value,
					departureTime: dep.toISOString(), arrivalTime: arr.toISOString(),
					flightDurationMinutes: Math.round((arr - dep) / 60000), delayMinutes: Number(form.delayMinutes.value || 0),
					r_originAirport_c_airportId: Number(form.origin.value), r_destinationAirport_c_airportId: Number(form.destination.value),
					r_gate_c_airportId: Number(form.origin.value),
				};
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
		return `<div class="fa-row"><div class="fa-num"><span class="fa-ico sm">${ICONS.plane}</span>${esc(f.flightNumber)}</div>` +
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
		view.innerHTML =
			'<section class="fa-hero"><span class="fa-pill">Live flight tracking</span><h1>Know where your flight is, <em>before you leave</em></h1>' +
			'<p>Check live departures, arrivals, gates and delays across all airports in one place.</p>' +
			'<form class="fa-form"><input placeholder="Enter flight number, e.g. DL250" /><button class="fa-btn" type="submit">Search flight</button></form></section>' +
			this.statTiles(this.stats(flights, ap)) +
			['Domestic', 'International'].map((k) => {
				const hits = flights.filter((f) => kindOf(f, ap) === k).slice(0, 3);
				return '<section class="fa-section"><div class="fa-head"><h2>' + k + ' flights</h2><a href="' + r + '/flight-status">View all &rarr;</a></div>' +
					(hits.length ? hits.map((f) => this.flightRow(f, ap)).join('') : '<div class="fa-msg">No ' + k.toLowerCase() + ' flights found.</div>') + '</section>';
			}).join('') +
			'<section class="fa-section"><div class="fa-head"><h2>Airports</h2><a href="' + r + '/airports">All airports &rarr;</a></div><div class="fa-grid">' +
			popular.map((a) => `<div class="fa-card"><span class="fa-code">${esc(a.code)}</span><b>${esc(a.city)}</b><span>${esc(a.name)}</span></div>`).join('') + '</div></section>' +
			'<section class="fa-section"><div class="fa-head"><h2>Everything you need</h2></div><div class="fa-grid three">' +
			features.map((f) => `<div class="fa-card"><span class="fa-ico">${ICONS[f.icon]}</span><b>${f.title}</b><span>${f.text}</span></div>`).join('') + '</div></section>' +
			'<section class="fa-cta"><div><h2>Ready to check your flight?</h2><p>Search by flight number or browse everything that is flying today.</p></div>' +
			'<a class="fa-btn" href="' + r + '/search">Search flights</a></section>';
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
		view.innerHTML = '<div class="fa-title"><h1>Search Flights</h1><p>Find a flight by number, status, airport code or city.</p></div>' +
			'<form class="fa-form wide"><input placeholder="e.g. DL250, Delayed, JFK, Los Angeles" /><button class="fa-btn" type="submit">Search</button></form><div class="fa-msg"></div><div class="fa-results"></div>';
		const input = view.querySelector('input');
		input.value = q;
		const render = (term) => {
			const t = term.trim().toLowerCase();
			const hits = flights.filter((f) => {
				const o = ap[f.originAirportId] || {}, d = ap[f.destinationAirportId] || {};
				return !t || [f.flightNumber, f.status, o.code, o.city, d.code, d.city].join(' ').toLowerCase().includes(t);
			});
			view.querySelector('.fa-msg').textContent = hits.length ? hits.length + ' flight(s) found' : 'No flights match your search.';
			view.querySelector('.fa-results').innerHTML = hits.map((f) => this.flightRow(f, ap)).join('');
		};
		view.querySelector('form').addEventListener('submit', (e) => {
			e.preventDefault();
			render(input.value);
		});
		render(q);
	}

	async view_airports(view) {
		const [ap, flights] = await Promise.all([this.airports(), this.flights()]);
		const list = Object.values(ap);
		const count = (id) => flights.filter((f) => f.originAirportId == id || f.destinationAirportId == id).length;
		view.innerHTML = '<div class="fa-title"><h1>Airports</h1><p>' + list.length + ' airports in our network.</p></div><div class="fa-grid">' +
			(list.map((a) => `<div class="fa-card"><span class="fa-code">${esc(a.code)}</span><b>${esc(a.name)}</b><span>${esc(a.city)}${a.country ? ', ' + esc(a.country) : ''}</span><small>${count(a.id)} flight(s) today</small></div>`).join('') || '<div class="fa-msg">No airports found.</div>') + '</div>';
	}

	async view_gates(view) {
		const items = (await this.json('/o/c/gates/scopes/' + SITE_ID() + '?pageSize=100')).items;
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
