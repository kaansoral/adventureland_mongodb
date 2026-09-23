const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { extract, read } = require("./helpers/server_vm");

const servers = ["I", "II", "PVP"].map((name, index) => ({
	region: "US",
	name,
	address: "game.example",
	path: "/ws" + index + "/",
	info: { players: index ? 10 : 49, pvp: name === "PVP" },
}));
const character = (home) => ({ info: { p: { home } } });
function chooser(characters = [character("USII")]) {
	const context = vm.createContext({
		Dev: false,
		SEO_ORIGIN: "https://adventure.land",
		region_coords: { US: [0, 0] },
		require: () => ({ lookup: () => ({ ll: [0, 0] }) }),
		get_ip: () => "127.0.0.1",
		gf: (entity, key, fallback) => entity?.info?.[key] ?? fallback,
		get_browser_servers: async () => servers,
		get_characters: async () => characters,
		characters_to_client: (value) => value,
		servers_to_client: (domain, value) => value,
		get_user_data: async () => ({}),
		nunjucks: { render: (template, data) => data },
		console,
	});
	for (const name of ["select_server", "render_selection", "selection_info"])
		vm.runInContext(extract(read("adventure_functions.js"), name), context);
	return context;
}

test("fresh homes override missing and stale account summaries", () => {
	const context = chooser();
	for (const summary of [[], [{ home: "USI" }]]) {
		const user = { info: { characters: summary } };
		assert.equal(context.select_server({}, user, servers, [character("USII")]), servers[1]);
	}
	assert.equal(context.select_server({}, { info: { characters: [{ home: "USII" }] } }, servers), servers[1]);
	assert.equal(context.select_server({}, {}, servers, [character("USI")]), servers[0]);
});

test("unavailable homes cannot bypass the supplied server list; another available home is preferred", () => {
	const context = chooser();
	assert.equal(context.select_server({}, {}, servers, [character("EUI"), character("USII")]), servers[1]);
	assert.equal(context.select_server({}, {}, servers.slice(0, 1), [character("USII")]), servers[0]);
	assert.equal(context.select_server({}, {}, [], []), null);
});

test("first-time and development selection retain their existing defaults", () => {
	const context = chooser();
	assert.equal(context.select_server({}, {}, servers, []), servers[0]);
	assert.equal(context.select_server({}, {}, servers, [character()]), servers[0]);
	context.Dev = true;
	assert.equal(context.select_server({}, {}, servers, [character("USII")]), servers[0]);
});

test("initial pages and sign-in fragments load the authoritative homes before selecting", async () => {
	const context = chooser();
	let page;
	const response = {
		status() {
			return this;
		},
		send(data) {
			page = data;
		},
	};
	await context.render_selection({}, response, { info: { characters: [] } }, {});
	assert.equal(page.server, servers[1]);
	assert.equal(page.domain.server_explicit, false);
	const fragment = await context.selection_info({}, {}, {});
	assert.equal(fragment.html.server, servers[1]);
	assert.equal(fragment.html.domain.characters[0].info.p.home, "USII");
	assert.equal(fragment.html.domain.servers, servers);
	await context.render_selection({}, response, {}, {}, 80, servers[0]);
	assert.equal(page.server, servers[0]);
	assert.equal(page.domain.server_explicit, true);
	await context.render_selection({}, response, {}, { url_address: servers[0].address, url_path: servers[0].path });
	assert.equal(page.server, servers[0]);
	assert.equal(page.domain.server_explicit, true);
});

function client() {
	const calls = [],
		labels = {};
	const dom = (selector) => ({
		removeAttr() {
			return this;
		},
		remove() {
			return this;
		},
		html(value) {
			labels[selector] = value;
			return this;
		},
		toggle() {
			return this;
		},
		each() {
			return this;
		},
	});
	const phrases = require("../../js/phrases");
	const phrase = phrases.create("en", require("../../languages/en/interface"));
	phrase.escape = phrases.escape;
	const context = vm.createContext({
		X: { servers },
		server_address: servers[0].address,
		server_path: servers[0].path,
		server_names: { US: "Americas", EU: "Europas", ASIA: "Eastlands" },
		selection_server_explicit: false,
		character: null,
		observing: null,
		socket_welcomed: true,
		socket: { connected: true },
		auth_sent: null,
		user_id: "test",
		user_auth: "test",
		phrase,
		$: dom,
		location: { search: "?code=2" },
		history: { replaceState: (...args) => calls.push(["history", ...args]) },
		mssince: (value) => Date.now() - value,
		init_socket(args) {
			calls.push(["connect", args.selection]);
			context.socket_welcomed = false;
		},
		ui_log: (text) => calls.push(["log", text]),
		observe_character: () => false,
		log_in: (...args) => calls.push(["auth", ...args]),
	});
	context.window = context;
	for (const name of [
		"home_server_name",
		"home_server_label",
		"select_login_server",
		"update_login_server",
		"enter_selected_character",
		"hide_character_home",
	]) {
		vm.runInContext(extract(read("js/functions.js"), name), context);
	}
	return { context, calls, labels };
}

test("sign-in reconnects to home and character entry waits for welcome", () => {
	const { context, calls, labels } = client();
	context.select_login_server(servers[1], false);
	assert.equal(context.server_path, servers[1].path);
	assert.deepEqual(calls, [["connect", true]]);
	assert.match(labels[".selection-destination"], /Americas II/);
	context.enter_selected_character("Wizard", "CH_wizard");
	assert.equal(
		calls.some((call) => call[0] === "auth"),
		false,
	);
	context.socket_welcomed = true;
	context.enter_selected_character("Wizard", "CH_wizard");
	assert.deepEqual(calls.at(-1), ["auth", "test", "CH_wizard", "test"]);
});

test("an in-progress anonymous connection may be replaced before character authentication", () => {
	const { context, calls } = client();
	context.socket_welcomed = false;
	context.select_login_server(servers[1], false);
	assert.deepEqual(calls, [["connect", true]]);
	assert.equal(context.server_path, servers[1].path);
	context.auth_sent = new Date();
	context.select_login_server(servers[0], true);
	assert.equal(context.server_path, servers[1].path);
});

test("explicit clicks and server bookmarks survive sign-in preference; reload URL keeps the choice", () => {
	const { context, calls } = client();
	context.select_login_server(servers[0], true);
	context.select_login_server(servers[1], false);
	assert.equal(context.server_path, servers[0].path);
	assert.equal(calls[0][3], "/server/US/I/?code=2");
	assert.equal(
		calls.some((call) => call[0] === "connect"),
		false,
	);
	context.select_login_server(servers[1], true);
	assert.equal(context.server_path, servers[1].path);
});

test("initial render sets the destination without opening a second startup socket", () => {
	const { context, calls } = client();
	context.socket = null;
	context.select_login_server(servers[1], false);
	assert.equal(context.server_path, servers[1].path);
	assert.equal(calls.length, 0);
});

test("online character observation and active gameplay are preserved", () => {
	const { context, calls } = client();
	context.observe_character = () => true;
	context.enter_selected_character("Online", "CH_online");
	assert.equal(calls.length, 0);
	for (const key of ["character", "observing"]) {
		context[key] = {};
		context.select_login_server(servers[1], key === "character");
		assert.equal(context.server_path, servers[0].path);
		context[key] = null;
	}
	context.select_login_server({ address: "not-listed", path: "/" }, true);
	assert.equal(calls.length, 0);
	assert.equal(context.home_server_name("USII"), "Americas II");
});

test("clicking the selected server can retry a disconnected connection", () => {
	const { context, calls } = client();
	context.socket.connected = false;
	context.select_login_server(servers[0], true);
	assert.ok(calls.some((call) => call[0] === "connect"));
});

test("manual server selection can leave an online character's observer view", () => {
	const { context, calls } = client();
	context.observing = { name: "Online" };
	context.select_login_server(servers[1], true);
	assert.equal(context.server_path, servers[1].path);
	assert.ok(calls.some((call) => call[0] === "connect"));
});
