const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const nunjucks = require("nunjucks");
const localization = require("../../languages");
const { create_steam_signup } = require("../../steam_signup");
const { load, read, root, transactions } = require("./helpers/server_vm");

const PID = "76561198000000000";
const ORIGIN = "https://adventure.land";
const COOKIE = "al_steam_signup";

// The real routes, signup handler and transaction helper, with an isolated store
// and simulated Steam responses. No live accounts, credentials or network calls.
function setup({ beforeCommit, host = "adventure.land", local = false } = {}) {
	const s = {
		time: Date.parse("2026-09-15T12:00:00Z"),
		jar: {},
		calls: [],
		forms: [],
		sent: [],
		ownership: { ownsapp: true, permanent: true, usercanceled: false },
		verification: "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
	};
	const context = vm.createContext({
		console: { log() {}, error() {}, info() {} },
		crypto,
		Buffer,
		localization,
		Dev: false,
		Local: local,
		secure_cookies: !local,
		really_old: new Date(0),
		options: { cookie_key: "auth", base_url: local ? "http://adventure.test" : ORIGIN },
		keys: { steam_publisher_web_apikey: crypto.randomBytes(32).toString("hex") },
		get_user: async (req) => (req.cookies.auth ? { _id: "US_signed_in" } : null),
		get_user_by_email: async (email) =>
			[...s.records.values()].find((user) => user.email && user.email.includes(email)),
		get_domain: async (req, user) => ({ ...localization.domain_fields(req, user), domain: host, tauri: !!s.tauri }),
		gf: (obj, field, fallback) => (obj && obj.info && obj.info[field] !== undefined ? obj.info[field] : fallback),
		msince: () => 999,
		selection_info: async () => ({ type: "content", html: "" }),
		get_signupth: async () => 1,
		get_ip_info: async () => ({ info: {} }),
		get_referrer: async () => null,
		random_string: (length) => crypto.randomBytes(length).toString("hex").slice(0, length),
		a_rand: () => 0,
		get_ip: () => "192.0.2.1",
		get_country: () => "US",
		send_verification_email: (domain, user) => s.sent.push(user._id),
		add_event() {},
		increase_signupth() {},
		put_ip_info: async () => {},
		nunjucks: {
			render: (file, data) => {
				s.forms.push(data);
				return data;
			},
		},
		require: (name) => {
			assert.equal(name, "./steam_signup");
			return {
				create_steam_signup: (options) =>
					create_steam_signup({ ...options, now: () => s.time, request: steam_request }),
			};
		},
	});
	async function steam_request(url, options) {
		const address = new URL(url);
		s.calls.push({ address, options });
		assert.equal(options.redirect, "error");
		assert.ok(options.signal instanceof AbortSignal);
		if (s.timeout)
			return new Promise((resolve, reject) => {
				options.signal.addEventListener(
					"abort",
					() => {
						s.aborted = true;
						reject(new Error("fixture timeout"));
					},
					{ once: true },
				);
			});
		if (s.failure) throw new Error(context.keys.steam_publisher_web_apikey + url);
		if (address.hostname === "steamcommunity.com") {
			assert.equal(address.href, "https://steamcommunity.com/openid/login");
			assert.equal(options.method, "POST");
			assert.equal(options.body.get("openid.mode"), "check_authentication");
			assert.equal(options.body.get("state"), null);
			return { ok: true, text: async () => s.verification };
		}
		assert.equal(address.origin, "https://partner.steam-api.com");
		assert.equal(address.pathname, "/ISteamUser/CheckAppOwnership/v4/");
		assert.equal(address.searchParams.get("appid"), "777150");
		assert.equal(address.searchParams.get("steamid"), PID);
		assert.equal(address.searchParams.get("key"), context.keys.steam_publisher_web_apikey);
		return {
			ok: !s.httpError,
			text: async () => (s.badJson ? "invalid" : JSON.stringify({ appownership: s.ownership })),
		};
	}
	Object.assign(s, transactions(context, [], beforeCommit), { context });
	load(context, "common/js/common_functions.js", ["isEmailValid", "purify_email"]);
	load(context, "adventure_functions.js", ["hash_password", "get_new_auth", "set_cookie"]);
	load(context, "api.js", ["signup_or_login_api"]);
	// Execute the actual main.js wiring, including response initialization.
	const main = read("main.js");
	vm.runInContext(
		main.slice(main.indexOf('var steam_signup = require("./steam_signup")'), main.indexOf('app.get("/steam-signup"')),
		context,
	);
	s.call = async (
		action,
		{
			body = {},
			cookies = s.jar,
			method = ["start", "complete"].includes(action) ? "POST" : "GET",
			url = "/steam-signup",
			headers = {},
		} = {},
	) => {
		const req = {
			method,
			body,
			cookies: { ...cookies },
			originalUrl: url,
			ip: "192.0.2.1",
			headers: {
				host,
				origin: local ? "http://adventure.test" : "https://" + host,
				"accept-language": "ru",
				...headers,
			},
			get(name) {
				return this.headers[name.toLowerCase()];
			},
		};
		const res = {
			code: 200,
			headers: {},
			cookies: [],
			set(values) {
				Object.assign(this.headers, values);
				return this;
			},
			status(code) {
				this.code = code;
				return this;
			},
			cookie(name, value, options) {
				s.jar[name] = value;
				this.cookies.push({ name, value, options });
				return this;
			},
			clearCookie(name, options) {
				assert.equal(options.maxAge, undefined);
				delete s.jar[name];
				this.cleared = { name, options };
			},
			redirect(code, location) {
				this.code = code;
				this.location = location;
			},
			send(data) {
				this.data = data;
			},
		};
		await context.steam_signup[action](req, res, (error) => {
			res.nextError = error;
		});
		return res;
	};
	s.begin = async () => {
		const page = await s.call("page");
		const start = await s.call("start", { body: { state: page.data.state } });
		assert.equal(start.code, 303);
		const steam = new URL(start.location),
			returnTo = steam.searchParams.get("openid.return_to");
		assert.equal(steam.origin, "https://steamcommunity.com");
		assert.equal(steam.searchParams.get("openid.realm"), (local ? "http://adventure.test" : "https://" + host) + "/");
		assert.equal(steam.searchParams.get("openid.mode"), "checkid_setup");
		const callback = new URL(returnTo);
		const values = {
			"openid.ns": "http://specs.openid.net/auth/2.0",
			"openid.mode": "id_res",
			"openid.op_endpoint": "https://steamcommunity.com/openid/login",
			"openid.claimed_id": "https://steamcommunity.com/openid/id/" + PID,
			"openid.identity": "https://steamcommunity.com/openid/id/" + PID,
			"openid.return_to": returnTo,
			"openid.response_nonce": new Date(s.time).toISOString().replace(".000Z", "Z") + "fixture",
			"openid.assoc_handle": "fixture",
			"openid.sig": "fixture",
			"openid.signed": "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
		};
		for (const [name, value] of Object.entries(values)) callback.searchParams.set(name, value);
		s.state = callback.searchParams.get("state");
		s.callback = callback;
		return callback;
	};
	s.verify = async () => {
		await s.begin();
		const response = await s.call("callback", { url: s.callback.pathname + s.callback.search });
		assert.equal(response.code, 303);
		assert.equal(response.location, "/steam-signup");
		assert.equal((await s.call("page")).data.verified, true);
	};
	s.complete = (fields = {}, cookies = s.jar) =>
		s.call("complete", {
			body: { state: s.state, email: "new@example.invalid", password: "fixture-password", ...fields },
			cookies,
		});
	return s;
}

test("browser Steam signup keeps the exact SteamID, desktop slots, password, locale and normal session", async () => {
	const s = setup();
	const page = await s.call("page");
	assert.equal(page.headers["Cache-Control"], "no-store");
	assert.equal(page.headers["Referrer-Policy"], "strict-origin");
	assert.deepEqual(page.cookies[0].options, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/steam-signup",
		maxAge: 1200000,
	});
	await s.verify();
	const response = await s.complete({ email: "NEW@example.invalid", pid: "attacker", steamid: "attacker" });
	assert.equal(response.location, "/");
	assert.equal(response.cleared.name, COOKIE);
	const user = [...s.records.values()].find((record) => record._id.startsWith("US_"));
	assert.equal(user.pid, PID);
	assert.equal(user.platform, "steam");
	assert.equal(user.info.slots, 8);
	assert.equal(user.language, "ru");
	assert.equal(user.language_set, "detected");
	assert.equal(user.email[0], "new@example.invalid");
	assert.equal(user.password, s.context.hash_password("fixture-password", user.info.salt));
	assert.equal(user.info.auths.length, 1);
	assert.equal(s.jar.auth, user._id + "-" + user.info.auths[0]);
	assert.equal(response.cookies.find((cookie) => cookie.name === "auth").options.maxAge, 86400 * 365 * 5 * 1000);
	assert.deepEqual(s.sent, [user._id]);
	assert.equal(s.records.get("MK_steam-signup-" + s.state).owner, user._id);
	assert.equal(s.calls.length, 3);
});

test("Steam account ID, not a family lender ID, is stored", async () => {
	const s = setup();
	s.ownership = { ownsapp: true, permanent: false, ownersteamid: "76561198000000001" };
	await s.verify();
	await s.complete();
	assert.equal([...s.records.values()].find((record) => record._id.startsWith("US_")).pid, PID);
});

test("a stalled Steam request is aborted without leaving the signup request hanging", async (t) => {
	const s = setup();
	await s.begin();
	s.timeout = true;
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const response = s.call("callback", { url: s.callback.pathname + s.callback.search });
	// Let the route pass the asynchronous existing-user check and enter fetch.
	await Promise.resolve();
	assert.equal(s.calls.length, 1);
	t.mock.timers.tick(8000);
	assert.equal((await response).code, 503);
	assert.equal(s.aborted, true);
	assert.equal(s.records.size, 0);
});

test("configuration and page failures stay contained; repeated starts are bounded", async () => {
	const missing = setup();
	delete missing.context.keys.steam_publisher_web_apikey;
	assert.equal((await missing.call("page")).data.error, "pages.steam_signup.unavailable");
	assert.equal(missing.calls.length, 0);
	const broken = setup();
	broken.context.nunjucks.render = () => {
		throw new Error("fixture rendering detail");
	};
	assert.equal((await broken.call("page")).nextError.message, "Steam signup unavailable");
	const limited = setup();
	for (let i = 0; i < 21; i++) {
		const page = await limited.call("page");
		const response = await limited.call("start", { body: { state: page.data.state } });
		assert.equal(response.code, i < 20 ? 303 : 503);
	}
	assert.equal(limited.calls.length, 0);
});

test("missing, foreign, tampered or expired browser state cannot reach Steam or signup", async () => {
	for (const change of [
		"missing",
		"tampered",
		"foreign",
		"expired",
		"wrong-state",
		"origin",
		"null-origin",
		"missing-origin",
		"host",
	]) {
		const s = setup();
		await s.begin();
		const cookies = { ...s.jar },
			headers = {};
		if (change === "missing") delete cookies[COOKIE];
		if (change === "tampered") cookies[COOKIE] = "x" + cookies[COOKIE];
		if (change === "foreign") cookies[COOKIE] = (await setup().call("page")).cookies[0].value;
		if (change === "expired") s.time += 20 * 60 * 1000;
		if (change === "origin") headers.origin = "https://other.invalid";
		if (change === "null-origin") headers.origin = "null";
		if (change === "missing-origin") headers.origin = undefined;
		if (change === "host") headers.host = "other.invalid";
		const response = await s.call("start", {
			cookies,
			headers,
			body: { state: change === "wrong-state" ? "other" : s.state },
		});
		assert.equal(response.code, 400, change);
		assert.equal(s.calls.length, 0, change);
		assert.equal(s.records.size, 0, change);
	}
});

test("callback rejects altered return URLs, providers, identities, signed fields, nonces and duplicate values", async () => {
	const mutations = [
		(query) => query.set("state", "other"),
		(query) => query.set("openid.mode", "cancel"),
		(query) => query.set("openid.op_endpoint", "https://other.invalid/openid"),
		(query) => query.set("openid.claimed_id", "https://other.invalid/openid/id/" + PID),
		(query) => query.set("openid.identity", "https://steamcommunity.com/openid/id/76561198000000001"),
		(query) => query.set("openid.return_to", ORIGIN + "/"),
		(query) => query.set("openid.signed", "op_endpoint,identity,claimed_id,response_nonce,assoc_handle"),
		(query) => query.set("openid.response_nonce", "2020-09-15T12:00:00Zfixture"),
		(query) => query.set("openid.response_nonce", "2030-09-15T12:00:00Zfixture"),
		(query) => query.append("openid.identity", query.get("openid.identity")),
	];
	for (const mutate of mutations) {
		const s = setup();
		await s.begin();
		mutate(s.callback.searchParams);
		const response = await s.call("callback", { url: s.callback.pathname + s.callback.search });
		assert.equal(response.code, 400);
		assert.equal(s.calls.length, 0);
		assert.equal(s.records.size, 0);
	}
});

test("bad signatures, absent ownership and Steam failures grant nothing and do not leak API details", async () => {
	for (const [field, value] of [
		["verification", "is_valid:false\n"],
		["verification", "is_valid:true\nis_valid:false\n"],
		["ownership", { ownsapp: false }],
		["ownership", { ownsapp: true, usercanceled: true }],
		["ownership", { ownsapp: "true" }],
		["ownership", null],
		["failure", true],
		["httpError", true],
		["badJson", true],
	]) {
		const s = setup();
		await s.begin();
		s[field] = value;
		const response = await s.call("callback", { url: s.callback.pathname + s.callback.search });
		assert.ok(response.code >= 400);
		assert.match(response.data.error, /^pages\.steam_signup\.(failed|not_owned|unavailable)$/);
		assert.ok(!JSON.stringify(response.data).includes(s.context.keys.steam_publisher_web_apikey));
		assert.equal((await s.call("page")).data.verified, false);
		assert.equal(s.records.size, 0);
	}
});

test("registration grant cannot be spent twice, even under a concurrent double submit", async () => {
	for (const concurrent of [false, true]) {
		const s = setup();
		await s.verify();
		const cookies = { ...s.jar };
		const first = s.complete({}, cookies);
		if (!concurrent) await first;
		const results = await Promise.all([first, s.complete({ email: "second@example.invalid" }, cookies)]);
		assert.equal(results.filter((response) => response.location === "/").length, 1);
		assert.equal([...s.records.values()].filter((record) => record._id.startsWith("US_")).length, 1);
		assert.equal(s.stats.commits, 1);
	}
});

test("an existing email never logs in, changes a password or reassigns a Steam ID", async () => {
	const s = setup();
	const existing = {
		_id: "US_existing",
		email: ["new@example.invalid"],
		password: "untouched",
		pid: "original",
		info: { auths: [] },
	};
	s.records.set(existing._id, structuredClone(existing));
	await s.verify();
	const response = await s.complete();
	assert.equal(response.data.error, "error.already_signed_up");
	assert.deepEqual(s.records.get(existing._id), existing);
	assert.equal(s.jar.auth, undefined);
	assert.equal(s.stats.commits, 0);
});

test("failed signup rolls back the grant, and a revoked license is checked again before creation", async () => {
	const s = setup({
		beforeCommit: () => {
			throw new Error("fixture transaction failure");
		},
	});
	await s.verify();
	assert.equal((await s.complete()).data.error, "pages.steam_signup.failed");
	assert.equal(s.records.size, 0);
	assert.equal(s.jar.auth, undefined);
	const revoked = setup();
	await revoked.verify();
	revoked.ownership.ownsapp = false;
	assert.equal((await revoked.complete()).data.error, "pages.steam_signup.not_owned");
	assert.equal(revoked.records.size, 0);
});

test("bad form data creates nothing; logged-in players return home without touching Steam", async () => {
	const s = setup();
	await s.verify();
	for (const fields of [{ email: "invalid" }, { password: "" }, { password: {} }, { email: [] }]) {
		assert.equal((await s.complete(fields)).data.error, "error.invalid_field");
	}
	assert.equal(s.calls.length, 2);
	assert.equal(s.records.size, 0);
	s.jar.auth = "fixture";
	assert.equal((await s.call("page")).location, "/");
	assert.equal(s.calls.length, 2);
});

test("compatibility hostname and configured local origin keep their own callback and cookies", async () => {
	for (const config of [
		{ host: "cloudflare.adventure.land" },
		{ host: "www.adventure.land" },
		{ host: "adventure.test", local: true },
	]) {
		const s = setup(config);
		await s.verify();
		assert.equal((await s.complete()).location, "/");
	}
});

test("ordinary API input cannot impersonate the trusted grant; desktop signup and email login remain unchanged", async () => {
	const s = setup();
	const args = {
		req: { headers: {}, cookies: {} },
		res: { infs: [], cookie() {} },
		email: "regular@example.invalid",
		password: "fixture-password",
		only_signup: true,
		steam_signup: { steamid: PID, id: "fake" },
		pid: PID,
	};
	assert.equal((await s.context.signup_or_login_api(args)).reason, "cant_signup_on_web");
	assert.equal(s.records.size, 0);
	s.tauri = true;
	const result = await s.context.signup_or_login_api(args);
	assert.equal(result.success, true);
	const user = s.records.get(result.user);
	assert.equal(user.pid, "");
	assert.equal(user.platform, "");
	assert.equal(user.info.slots, 8);
	s.tauri = false;
	const login = await s.context.signup_or_login_api({ ...args, only_signup: false, only_login: true });
	assert.equal(login.success, true);
	assert.equal(login.user, result.user);
});

test("all signup phrases are translated and the actual forms render in every supported language", () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	env.addFilter("to_json", JSON.stringify);
	const ids = Object.keys(localization.catalog("en")).filter((id) => id.startsWith("pages.steam_signup."));
	assert.equal(ids.length, 7);
	for (const { code } of require("../../js/phrases").languages) {
		const catalog =
			code === "en"
				? require("../../languages/en/pages")
				: JSON.parse(fs.readFileSync(root + "/languages/" + code + "/pages.json", "utf8"));
		for (const id of ids) {
			assert.ok(catalog[id], code + ": " + id);
			assert.ok(!/[{}<>]/.test(catalog[id]), code + ": unexpected placeholder or markup");
			if (localization.catalog("en")[id].includes("Steam"))
				assert.ok(catalog[id].includes("Steam"), code + ": preserve Steam");
			if (code !== "en") assert.notEqual(catalog[id], localization.catalog("en")[id], code + ": untranslated");
		}
		env.addGlobal("phrase", (id, params) => localization.phrase(id, params, code));
		for (const verified of [false, true]) {
			const html = env.render("htmls/steam_signup.html", { domain: { language: code }, state: "fixture", verified });
			assert.ok(html.includes(verified ? 'action="/steam-signup/complete"' : 'action="/steam-signup/start"'));
			assert.equal(html.includes('autocomplete="new-password"'), verified);
			assert.ok(!html.includes("pages.steam_signup."), code);
			assert.ok(!html.includes(PID));
		}
	}
});
