const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const { MongoClient } = require("mongodb");
const { create_steam_signin } = require("../../steam_signin");
const { load, read } = require("./helpers/server_vm");

// Set only for a dedicated test database. The local runner obtains its URI from secretsandconfig.
test("Steam sign-in routes and Mongo transactions", { skip: !process.env.AL_STEAM_TEST_URI }, async (t) => {
	const client = new MongoClient(process.env.AL_STEAM_TEST_URI, {
		...JSON.parse(process.env.AL_STEAM_TEST_OPTIONS || "{}"),
		serverSelectionTimeoutMS: 5000,
	});
	await client.connect();
	const db = client.db("adventuredev"),
		collections = [];
	t.after(async () => {
		for (const collection of collections)
			await collection.drop().catch((error) => {
				if (error.code !== 26) throw error;
			});
		await client.close();
	});
	async function setup() {
		const prefix = "test_steam_signin_" + crypto.randomBytes(12).toString("hex");
		const flows = db.collection(prefix + "_flows"),
			users = db.collection(prefix + "_users");
		collections.push(flows, users);
		const s = {
			users,
			flows,
			time: Date.now(),
			jar: {},
			calls: 0,
			steamid: "76561198000000001",
			nonce: 0,
			routes: new Map(),
		};
		const context = vm.createContext({
			crypto,
			console,
			client,
			Buffer,
			db: { collection: (name) => (name === "user" ? users : flows) },
			options: { cookie_key: "auth" },
			Local: false,
			Dev: false,
			secure_cookies: true,
			get: (id) => users.findOne({ _id: id }),
			initialize_user_language: async (req, user) => user,
			get_domain: async () => ({ domain: "adventure.land", language: "en" }),
			get_id: (user) => user._id,
			selection_info: async (req, user, domain) => ({
				type: "content",
				section: domain.section,
				enabled: user.steam_login?.enabled !== false,
			}),
			steam_auth_app: Object.fromEntries(
				["get", "post"].map((method) => [
					method,
					(path, handler) => s.routes.set(method.toUpperCase() + " " + path, handler),
				]),
			),
			nunjucks: { render: (file, form) => form },
			require: (name) => {
				assert.equal(name, "./steam_signin");
				return {
					create_steam_signin: (options) =>
						create_steam_signin({
							...options,
							now: () => s.time,
							request: async (url, options) => {
								s.calls++;
								assert.equal(url, "https://steamcommunity.com/openid/login");
								assert.equal(options.redirect, "error");
								assert.equal(options.body.get("openid.mode"), "check_authentication");
								if (s.networkError) throw new Error("PRIVATE_FIXTURE_DETAIL");
								const valid =
									!s.badSignature &&
									options.body.get("openid.sig") === "fixture-signature" &&
									options.body.get("openid.claimed_id") === "https://steamcommunity.com/openid/id/" + s.steamid;
								return { ok: true, text: async () => "ns:http://specs.openid.net/auth/2.0\nis_valid:" + valid + "\n" };
							},
						}),
				};
			},
		});
		load(context, "adventure_functions.js", [
			"hash_password",
			"get_new_auth",
			"set_steam_login",
			"get_steam_login_id",
			"normalize_user_id",
			"get_user",
			"set_cookie",
		]);
		const main = read("main.js");
		s.rewire = () =>
			vm.runInContext(
				main.slice(
					main.indexOf('var steam_signin = require("./steam_signin")'),
					main.indexOf("// Main page / Selection"),
				),
				context,
			);
		s.rewire();
		s.context = context;
		load(context, "api.js", ["settings_api"]);
		load(context, "common/handlers.js", ["handle_api_call"]);
		context.REF = {
			settings: { F: context.settings_api, P: true, U: true, setting: { type: "string" }, value: { type: "any" } },
		};
		context.send_json = (res, value) => res.send({ ...value, infs: res.infs });
		s.routes.set("POST /api/settings", (req, res) => {
			req.params = { method: "settings" };
			return context.handle_api_call(req, res);
		});
		s.add = async (id = "US_first", steamid = s.steamid) => {
			const user = {
				_id: id,
				name: id,
				email: ["fixture@example.invalid"],
				password: context.hash_password("fixture-password", "fixture-salt"),
				language: "en",
				language_set: "explicit",
				banned: false,
				platform: steamid ? "steam" : "",
				pid: steamid || "",
				server: "",
				info: { salt: "fixture-salt", auths: ["passwordsession"], characters: [{ name: "Meadow" }] },
			};
			await users.insertOne(user);
			return user;
		};
		s.call = async (path, { method = "GET", body = {}, jar = s.jar, headers = {} } = {}) => {
			const req = {
				method,
				body,
				cookies: { ...jar },
				originalUrl: path,
				socket: { remoteAddress: "192.0.2.1" },
				headers: {
					host: "adventure.land",
					origin: "https://adventure.land",
					cookie: Object.entries(jar)
						.map(([key, value]) => key + "=" + value)
						.join("; "),
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
				set(headers) {
					Object.assign(this.headers, headers);
					return this;
				},
				status(code) {
					this.code = code;
					return this;
				},
				send(data) {
					this.data = data;
				},
				cookie(name, value, options) {
					jar[name] = value;
					this.cookies.push({ name, value, options });
				},
				clearCookie(name) {
					delete jar[name];
				},
				redirect(code, location) {
					this.code = code;
					this.location = location;
				},
			};
			const route = s.routes.get(method + " " + path.split("?")[0]);
			assert.ok(route, path);
			await route(req, res, (error) => {
				res.error = error.message;
			});
			return res;
		};
		s.begin = async () => {
			const base = "/steam-signin";
			const page = await s.call(base);
			assert.equal(page.code, 200);
			const start = await s.call(base + "/start", {
				method: "POST",
				body: { state: page.data.state },
			});
			assert.equal(start.code, 303);
			const target = new URL(new URL(start.location).searchParams.get("openid.return_to"));
			const values = {
				"openid.ns": "http://specs.openid.net/auth/2.0",
				"openid.mode": "id_res",
				"openid.op_endpoint": "https://steamcommunity.com/openid/login",
				"openid.claimed_id": "https://steamcommunity.com/openid/id/" + s.steamid,
				"openid.identity": "https://steamcommunity.com/openid/id/" + s.steamid,
				"openid.return_to": target.href,
				"openid.response_nonce": new Date(s.time).toISOString().replace(/\.\d{3}Z$/, "Z") + "fixture" + ++s.nonce,
				"openid.assoc_handle": "fixture",
				"openid.sig": "fixture-signature",
				"openid.signed": "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
			};
			for (const [key, value] of Object.entries(values)) target.searchParams.set(key, value);
			s.callback = target;
			return target;
		};
		s.verify = async () => {
			await s.begin();
			const response = await s.call(s.callback.pathname + s.callback.search);
			assert.equal(response.code, 303);
			const page = await s.call(response.location);
			assert.equal(page.code, 200);
			s.form = page.data;
			return page;
		};
		s.complete = (extra = {}) =>
			s.call("/steam-signin/complete", {
				method: "POST",
				body: { state: s.form.state, account: s.form.accounts[0]?.handle, ...extra },
			});
		s.toggle = (enabled, options = {}) =>
			s.call("/api/settings", { method: "POST", body: { setting: "steam_login", value: enabled }, ...options });
		return s;
	}
	await t.test(
		"existing Steam accounts are enabled by default; verified identity and explicit choice select the account",
		async () => {
			const s = await setup();
			await s.add("US_first");
			await s.add("US_second");
			await s.add("US_victim", "76561198000000002");
			const legacy = await s.add("US_legacy", null);
			await s.users.updateOne({ _id: legacy._id }, { $set: { platform: "steam", pid: s.steamid } });
			const page = await s.verify();
			assert.equal(s.jar.auth, undefined);
			assert.equal(page.data.accounts.length, 3);
			assert.equal(JSON.stringify(page.data).includes("fixture@example.invalid"), false);
			assert.equal(JSON.stringify(page.data).includes("US_victim"), false);
			const response = await s.complete({
				account: s.form.accounts.find((account) => account.name === "US_second").handle,
				pid: "76561198000000002",
				user: "US_victim",
				email: "victim@example.invalid",
			});
			assert.equal(response.location, "/");
			assert.ok(s.jar.auth.startsWith("US_second-"));
			assert.equal((await s.users.findOne({ _id: "US_first" })).info.auths.length, 1);
			assert.equal((await s.users.findOne({ _id: "US_second" })).info.steam_auths.length, 1);
		},
	);
	await t.test("zero and single-account results do not log in automatically; choices paginate", async () => {
		const s = await setup();
		await s.verify();
		assert.equal(s.form.accounts.length, 0);
		assert.equal(s.jar.auth, undefined);
		await s.add();
		await s.verify();
		assert.equal(s.form.accounts.length, 1);
		assert.equal(s.jar.auth, undefined);
		for (let i = 0; i < 21; i++) await s.add("US_extra_" + String(i).padStart(2, "0"));
		await s.verify();
		assert.equal(s.form.accounts.length, 20);
		assert.equal(s.form.next, true);
		const page = await s.call("/steam-signin/accounts", { method: "POST", body: { state: s.form.state, more: "yes" } });
		assert.equal(page.data.accounts.length, 2);
		assert.equal(page.data.next, false);
	});
	await t.test("raw IDs, query objects and other browser choices grant no access", async () => {
		const s = await setup();
		await s.add();
		await s.verify();
		for (const account of ["US_first", { $ne: null }, [s.form.accounts[0].handle], "f".repeat(64)]) {
			assert.equal((await s.complete({ account })).code, 400);
			assert.equal(s.jar.auth, undefined);
		}
		const old = s.form;
		await s.verify();
		assert.equal((await s.complete({ account: old.accounts[0].handle })).code, 400);
	});
	await t.test("duplicate/foreign cookies, wrong CSRF, host and Origin are rejected", async () => {
		const s = await setup();
		await s.add();
		await s.verify();
		const body = { state: s.form.state, account: s.form.accounts[0].handle };
		for (const origin of [undefined, "null", "https://attacker.invalid"])
			assert.equal((await s.call("/steam-signin/complete", { method: "POST", body, headers: { origin } })).code, 400);
		assert.equal((await s.complete({ state: "wrong" })).code, 400);
		assert.equal((await s.call("/steam-signin/complete", { method: "POST", body, jar: {} })).code, 400);
		assert.equal((await s.call("/steam-signin/accounts", { headers: { host: "attacker.invalid" } })).code, 400);
		const name = "__Host-al_steam_signin";
		assert.equal(
			(
				await s.call("/steam-signin/accounts", {
					headers: { cookie: name + "=" + s.jar[name] + "; " + name + "=other" },
				})
			).code,
			400,
		);
		assert.equal(s.jar.auth, undefined);
	});
	await t.test("OpenID mutations, signature failure and replay fail closed", async () => {
		const s = await setup();
		await s.add();
		const mutations = [
			(q) => q.set("openid.return_to", "https://attacker.invalid"),
			(q) => q.set("openid.op_endpoint", "https://attacker.invalid"),
			(q) => q.set("openid.identity", "other"),
			(q) => q.set("openid.signed", "return_to"),
			(q) => q.append("state", "duplicate"),
			(q) => q.set("openid.sig", "forged"),
			(q) => q.set("openid.claimed_id", "https://steamcommunity.com/openid/id/76561198000000002"),
		];
		for (const mutate of mutations) {
			await s.begin();
			mutate(s.callback.searchParams);
			assert.equal((await s.call(s.callback.pathname + s.callback.search)).code, 400);
		}
		await s.begin();
		const pending = { ...s.jar },
			callback = s.callback.pathname + s.callback.search;
		assert.equal((await s.call(callback)).code, 303);
		assert.equal((await s.call(callback, { jar: pending })).code, 400);
		assert.equal((await s.call("/steam-signin/accounts", { jar: pending })).code, 400);
		const nonce = s.callback.searchParams.get("openid.response_nonce");
		await s.begin();
		s.callback.searchParams.set("openid.response_nonce", nonce);
		assert.equal((await s.call(s.callback.pathname + s.callback.search)).code, 400);
	});
	await t.test("concurrent completion creates exactly one session across independent handlers", async () => {
		const s = await setup();
		await s.add();
		await s.verify();
		const first = s.complete();
		s.rewire();
		const responses = await Promise.all([first, s.complete()]);
		assert.equal(responses.filter((r) => r.code === 303).length, 1);
		assert.equal((await s.users.findOne({ _id: "US_first" })).info.steam_auths.length, 1);
	});
	await t.test("concurrent disable and login cannot leave a usable Steam session", async () => {
		const s = await setup();
		await s.add();
		await s.verify();
		const login = { ...s.jar },
			body = { state: s.form.state, account: s.form.accounts[0].handle };
		s.jar = { auth: "US_first-passwordsession" };
		await Promise.all([s.call("/steam-signin/complete", { method: "POST", body, jar: login }), s.toggle(false)]);
		const user = await s.users.findOne({ _id: "US_first" });
		assert.equal(user.steam_login.enabled, false);
		assert.equal(user.info.steam_auths.length, 0);
		if (login.auth) assert.equal(user.info.auths.includes(login.auth.split("-")[1]), false);
	});
	await t.test("link, revision, ban and bank changes after listing prevent login", async () => {
		for (const fields of [
			{ "steam_login.enabled": false },
			{ pid: "76561198000000002" },
			{ platform: "mas" },
			{ "steam_login.version": "changed" },
			{ "steam_login.steamid": "76561198000000002" },
			{ steam_auth_revision: "changed" },
			{ banned: true },
			{ server: "fixture", last_online: new Date(), "info.last_auth": new Date() },
		]) {
			const s = await setup();
			await s.add();
			await s.verify();
			await s.users.updateOne({ _id: "US_first" }, { $set: fields });
			assert.equal((await s.complete()).code, 400);
			assert.equal(s.jar.auth, undefined);
		}
	});
	await t.test("expiry, new game login and provider errors issue no credential or private detail", async () => {
		const s = await setup();
		await s.add();
		await s.verify();
		s.time += 300001;
		assert.equal((await s.complete()).code, 400);
		assert.equal(s.jar.auth, undefined);
		await s.verify();
		s.jar.auth = "US_first-passwordsession";
		assert.equal((await s.complete()).location, "/");
		assert.equal(s.jar.auth, "US_first-passwordsession");
		delete s.jar.auth;
		await s.begin();
		s.networkError = true;
		const response = await s.call(s.callback.pathname + s.callback.search);
		assert.equal(response.code, 503);
		assert.equal(JSON.stringify(response.data).includes("PRIVATE_FIXTURE_DETAIL"), false);
	});
	await t.test("the existing settings API toggles Steam login without a password or new page", async () => {
		const s = await setup();
		await s.add();
		await s.verify();
		await s.complete();
		const current = s.jar.auth;
		const response = await s.toggle(false);
		assert.equal(response.data.success, true);
		assert.equal(response.data.infs.at(-1).section, "email");
		assert.equal(response.data.infs.at(-1).enabled, false);
		assert.equal(s.jar.auth, current);
		const saved = await s.users.findOne({ _id: "US_first" });
		assert.ok(saved.info.auths.includes(current.split("-")[1]));
		assert.ok(saved.info.steam_auths.includes(current.split("-")[1]));
		const jar = s.jar;
		s.jar = {};
		await s.verify();
		assert.equal(s.form.accounts.length, 0);
		s.jar = jar;
		assert.equal((await s.toggle(true)).data.success, true);
		s.jar = {};
		await s.verify();
		assert.equal(s.form.accounts.length, 1);
	});
	await t.test(
		"the toggle rejects foreign requests, invalid values, revoked sessions and another account ID",
		async () => {
			const s = await setup();
			await s.add();
			await s.add("US_victim", "76561198000000002");
			s.jar.auth = "US_first-passwordsession";
			for (const origin of [undefined, "null", "https://attacker.invalid"])
				assert.equal((await s.toggle(false, { headers: { origin } })).data.failed, true);
			for (const value of ["false", 0, null, [], { $ne: true }])
				assert.equal((await s.toggle(value)).data.failed, true);
			assert.equal(
				(await s.toggle(false, { body: { setting: "steam_login", value: false, user: "US_victim" } })).data.failed,
				true,
			);
			assert.equal((await s.users.findOne({ _id: "US_victim" })).steam_login, undefined);
			await s.users.updateOne({ _id: "US_first" }, { $set: { "info.auths": [] } });
			assert.equal((await s.toggle(false)).data.failed, true);
			assert.equal((await s.users.findOne({ _id: "US_first" })).steam_login, undefined);
		},
	);
});

test("password recovery disables Steam login and revokes its sessions in the real reset handler", async () => {
	const { transactions } = require("./helpers/server_vm");
	const user = {
		_id: "US_recovery",
		password: "fixture",
		info: { salt: "fixture", password_key: "recovery-key", auths: ["regular", "steam"], steam_auths: ["steam"] },
		steam_login: { steamid: "76561198000000001", enabled: true, version: "before" },
	};
	const context = vm.createContext({
		console,
		crypto,
		Buffer,
		get: async () => structuredClone(user),
		gf: (u, f) => u.info[f],
		random_string: () => "changed",
	});
	const store = transactions(context, [user]);
	load(context, "adventure_functions.js", ["hash_password", "set_steam_login"]);
	load(context, "api.js", ["reset_password_api"]);
	const result = await context.reset_password_api({
		id: user._id,
		key: "recovery-key",
		newpass1: "new-fixture",
		newpass2: "new-fixture",
		res: { infs: [] },
	});
	assert.equal(result.success, true);
	const saved = store.records.get(user._id);
	assert.equal(saved.steam_login.enabled, false);
	assert.deepEqual(saved.info.auths, ["regular"]);
	assert.equal(saved.info.steam_auths.length, 0);
	assert.notEqual(saved.steam_login.version, "before");
});

test("all Steam sign-in phrases and real templates cover every locale and escape account text", () => {
	const fs = require("node:fs"),
		nunjucks = require("nunjucks"),
		localization = require("../../languages"),
		{ root } = require("./helpers/server_vm");
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	const english = require("../../languages/en/pages");
	const ids = Object.keys(english).filter((id) => id.startsWith("pages.steam_signin."));
	assert.equal(ids.length, 14);
	const placeholders = (value) => (value.match(/\{\w+\}/g) || []).sort();
	const selection = fs.readFileSync(root + "/htmls/contents/selection.html", "utf8");
	const account_menu = selection.slice(
		selection.indexOf('<div class="accountui'),
		selection.indexOf('<div class="emailcui'),
	);
	for (const { code } of require("../../js/phrases").languages) {
		const catalog =
			code === "en" ? english : JSON.parse(fs.readFileSync(root + "/languages/" + code + "/pages.json", "utf8"));
		for (const id of ids) {
			assert.ok(Object.hasOwn(catalog, id), code + ": " + id);
			assert.deepEqual(placeholders(catalog[id]), placeholders(english[id]), code + ": " + id);
			for (const fixed of ["Steam", "Adventure Land"])
				if (english[id].includes(fixed)) assert.ok(catalog[id].includes(fixed), code + ": " + fixed);
			assert.equal(/<[^>]+>/.test(catalog[id]), ["pages.steam_signin.on", "pages.steam_signin.off"].includes(id));
		}
		env.addGlobal("phrase", (id, args) => localization.phrase(id, args, code));
		env.addGlobal(
			"phrase_html",
			(id, args) => new nunjucks.runtime.SafeString(localization.phrase_html(id, args, code)),
		);
		for (const enabled of [undefined, true, false]) {
			const menu = env.renderString(account_menu, {
				domain: {},
				user: { info: {}, steam_login: enabled === undefined ? undefined : { enabled } },
			});
			assert.ok(menu.includes("setting:'steam_login',value:" + (enabled === false ? "true" : "false")), code);
			assert.ok(
				menu.includes(localization.phrase("pages.steam_signin." + (enabled === false ? "off" : "on"), {}, code)),
				code,
			);
			assert.equal(menu.includes("/steam-signin/link"), false);
			assert.equal(menu.includes('type="password"'), false);
		}
		for (const view of ["start", "accounts", "error"]) {
			const html = env.render("htmls/steam_signin.html", {
				domain: { language: code },
				view,
				state: "fixture",
				digits: "0001",
				accounts: [
					{ name: '<img src=x onerror="alert(1)">', handle: "fixture", email: "f***@e***", characters: "Meadow" },
				],
				enabled: true,
				error: "pages.steam_signup.failed",
			});
			assert.equal(html.includes("pages.steam_signin."), false, code + ": " + view);
			assert.equal(html.includes("<img src=x"), false);
			assert.equal(/\bchecked\b/.test(html), false);
			assert.equal(/<script\b/.test(html), false);
		}
	}
});
