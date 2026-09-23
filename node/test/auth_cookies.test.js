const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const vm = require("node:vm");
const express = require("../../node_modules/express");
const nunjucks = require("../../node_modules/nunjucks");
const { load, read, transactions } = require("./helpers/server_vm");

function response(req) {
	const res = new http.ServerResponse(req);
	Object.setPrototypeOf(res, express.response);
	res.req = req;
	res.infs = [];
	return res;
}

function attributes(header) {
	return Object.fromEntries(
		header.split(";").map((part) => {
			const [name, ...value] = part.trim().split("=");
			return [name.toLowerCase(), value.join("=")];
		}),
	);
}

function setup(host, dev = false) {
	const req = {
		method: "POST",
		protocol: dev ? "http" : "https",
		headers: { host, cookie: "auth=oldhostcookie; auth=olddomaincookie" },
		cookies: { music: "on", zoom: "25", language: "en" },
		query: {},
		get(name) {
			return this.headers[name.toLowerCase()];
		},
	};
	const user = {
		_id: "US_fixture",
		password: "fixturehash",
		language: "en",
		language_set: "explicit",
		cash: 100,
		info: { auths: ["fixtureautha", "fixtureauthb"], gold: 5000, items0: [{ name: "sword", level: 7 }] },
	};
	const context = vm.createContext({
		console,
		Dev: dev,
		Local: dev,
		Staging: false,
		Prod: !dev,
		HTTPS_MODE: !dev,
		secure_cookies: !dev,
		options: { base_url: "https://adventure.land", cookie_key: dev ? "dev_auth" : "auth" },
		base_domain: "adventure.land",
		keys: {},
		Version: 1,
		LastDeploy: null,
		game_name: "Adventure Land",
		SALES: [],
		imagesets: {},
		ip_to_subdomain: {},
		gender_types: [],
		character_types: [],
		update_notes: [],
		set_default_seo() {},
		is_admin: () => false,
		gf: (value, name, fallback) => value?.info?.[name] ?? fallback,
		get_user_by_email: async () => user,
		hash_password: () => user.password,
		random_string: () => "fixtureauthnew",
		selection_info: async () => ({ type: "content", html: "" }),
	});
	load(context, "common/init.js", ["get_domain_common"]);
	load(context, "adventure_functions.js", [
		"get_domain",
		"get_new_auth",
		"set_cookie",
		"delete_cookie",
		"delete_auth_cookies",
	]);
	load(context, "api.js", ["signup_or_login_api", "logout_api", "logout_everywhere_api"]);
	const store = transactions(context, [user]);
	return { context, req, user, ...store };
}

const hosts = [
	["adventure.land", false, ".adventure.land"],
	["de.adventure.land:443", false, ".adventure.land"],
	["cloudflare.adventure.land", false, ".adventure.land"],
	["adventure.test:8000", true, ".adventure.test"],
];

test("login and both logout handlers use matching auth names, domains and root paths", async () => {
	for (const [host, dev, domain] of hosts) {
		for (const method of ["logout_api", "logout_everywhere_api"]) {
			const f = setup(host, dev);
			const login = response(f.req);
			const result = await f.context.signup_or_login_api({
				req: f.req,
				res: login,
				email: "fixture@example.invalid",
				password: "fixturepassword",
				only_login: true,
			});
			assert.equal(result.success, true);
			const name = f.context.options.cookie_key;
			const cookie = attributes([].concat(login.getHeader("Set-Cookie"))[0]);
			assert.equal(cookie[name], "US_fixture-fixtureauthnew");
			assert.equal(cookie.domain, domain);
			assert.equal(cookie.path, "/");
			assert.equal("secure" in cookie, !dev);
			assert.equal(Number(cookie["max-age"]), 86400 * 365 * 5);

			const before = structuredClone(f.records.get(f.user._id));
			const preferences = structuredClone(f.req.cookies);
			const logout = response(f.req);
			assert.equal((await f.context[method]({ req: f.req, res: logout, user: before })).success, true);
			const cleared = logout.getHeader("Set-Cookie").map(attributes);
			const current_host = host.split(":")[0];
			assert.deepEqual(
				cleared.map((value) => value.domain),
				current_host === domain.slice(1) ? [domain, undefined] : [domain, undefined, "." + current_host],
			);
			for (const value of cleared) {
				assert.equal(value[name], "");
				assert.equal(value.path, cookie.path);
				assert.ok(Date.parse(value.expires) < Date.now());
				assert.equal(value["max-age"], undefined);
				assert.deepEqual(
					Object.keys(value).sort(),
					[name, "domain", "expires", "path"].filter((key) => key !== "domain" || value.domain).sort(),
				);
			}
			assert.deepEqual(f.req.cookies, preferences);
			const expected = structuredClone(before);
			if (method === "logout_everywhere_api") expected.info.auths = [];
			assert.deepEqual(f.records.get(f.user._id), expected);
		}
	}
});

test("ordinary logout clears legacy cookies even without an authenticated account", async () => {
	const f = setup("cloudflare.adventure.land");
	const res = response(f.req);
	const before = structuredClone(f.records);
	assert.equal((await f.context.logout_api({ req: f.req, res })).success, true);
	assert.equal(res.getHeader("Set-Cookie").length, 3);
	assert.deepEqual(f.records, before);
	assert.equal(f.stats.sessions, 0);
});

test("logout everywhere preserves the bank rejection and leaves cookies intact after transaction failure", async () => {
	for (const bank of [true, false]) {
		const f = setup("cloudflare.adventure.land");
		const res = response(f.req);
		if (bank) f.user.server = "SR_EUI";
		f.context.tx = async () => {
			assert.equal(bank, false, "bank rejection happens before a transaction");
			return { failed: true, reason: "fixture_failure" };
		};
		const before = structuredClone(f.records);
		const result = await f.context.logout_everywhere_api({ req: f.req, res, user: f.user });
		assert.equal(result.reason, bank ? "inthebank" : "fixture_failure");
		assert.equal(res.getHeader("Set-Cookie"), undefined);
		assert.deepEqual(f.records, before);
	}
});

test("bot pages use the login cookie scope and do not write cookies for anonymous or ordinary pages", async () => {
	const env = new nunjucks.Environment(null, { autoescape: true });
	const filters = read("filters.js");
	const renderer = setup("adventure.land").context;
	renderer.env = env;
	renderer.nunjucks = nunjucks;
	renderer.data_to_tutorial = () => ({});
	vm.runInContext(filters.slice(0, filters.indexOf('env.addFilter("to_slots"')), renderer);
	const template = read("htmls/base_script.html");
	const library = read("js/libraries/combined.js");
	for (const [host, dev, domain] of hosts) {
		const f = setup(host, dev);
		f.req.query.no_html = "bot";
		const fields = await f.context.get_domain(f.req, f.user);
		const html = env.renderString(template, { domain: fields, user: f.user });
		const cookie_script = html.match(/Cookies\.set\([^\n]+/)[0];
		const client = vm.createContext({ document: { cookie: "" } });
		client.window = client;
		vm.runInContext(library.slice(0, library.indexOf("var convexhull")), client);
		vm.runInContext(cookie_script, client);
		const cookie = attributes(client.document.cookie);
		assert.equal(cookie[f.context.options.cookie_key], "US_fixture-fixtureautha");
		assert.equal(cookie.domain, domain);
		assert.equal(cookie.path, "/");
		assert.ok(Date.parse(cookie.expires) > Date.now());
		for (const vars of [
			{ domain: fields, user: null },
			{ domain: fields, user: { _id: "US_fixture", info: { auths: [] } } },
			{ domain: { ...fields, no_html: false }, user: f.user },
		])
			assert.doesNotMatch(env.renderString(template, vars), /Cookies\.set\(/);
	}
});
