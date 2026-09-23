const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const nunjucks = require("nunjucks");
const localization = require("../../languages");
const { load, read, transactions } = require("./helpers/server_vm");

function request(language, cookie) {
	return { headers: { "accept-language": language }, cookies: cookie ? { language: cookie } : {} };
}

function account_collection(document) {
	const records = new Map([[document._id, structuredClone(document)]]);
	const writes = [];
	return {
		records,
		writes,
		async updateOne(query, update) {
			writes.push({ query: structuredClone(query), update: structuredClone(update) });
			const record = records.get(query._id);
			const matches =
				record &&
				Object.entries(query).every(([key, expected]) => {
					const actual = key.split(".").reduce((value, part) => value && value[part], record);
					if (expected && expected.$in)
						return expected.$in.some((value) => actual === value || (value === null && actual === undefined));
					if (expected && typeof expected === "object" && "$exists" in expected)
						return (actual !== undefined) === expected.$exists;
					return actual === expected;
				});
			if (!matches) return { matchedCount: 0 };
			Object.assign(record, structuredClone(update.$set));
			return { matchedCount: 1 };
		},
		async findOne(query) {
			return structuredClone(records.get(query._id) || null);
		},
	};
}

test("locale selection honors explicit cookies, saved accounts, weighted browser preferences, and English fallback", () => {
	const saved = { language: "ja", language_set: "explicit" };
	assert.equal(localization.select(request("tr", "pt-BR"), saved).language, "pt-BR");
	assert.equal(localization.select(request("tr"), saved).language, "ja");
	assert.equal(localization.select(request("xx, tr;q=0.2, ru-RU;q=0.9")).language, "ru");
	assert.equal(localization.select(request("ru;q=0,zh-TW;q=0.8")).language, "zh-Hant");
	assert.equal(localization.select(request("es-MX")).language, "es-419");
	assert.equal(localization.select(request("tr"), { language: "en" }).language, "tr");
	assert.equal(localization.select(request("tr"), { language: "en", language_set: "detected" }).language, "en");
	assert.equal(localization.select(request("tr"), { language: "de" }).language, "de");
	assert.equal(
		localization.select(
			{ cookies: { language: "en", language_source: "detected" } },
			{ language: "tr", language_set: "explicit" },
		).language,
		"tr",
	);
	assert.equal(
		localization.select(
			{ cookies: { language: "en", language_source: "account" } },
			{ language: "tr", language_set: "explicit" },
		).language,
		"tr",
	);
	assert.equal(localization.select(request("xx", "../../secretsandconfig/keys")).language, "en");
	assert.equal(localization.select().language, "en");
	assert.equal(localization.languages.length, 32);
	assert.equal(localization.supported("pt-BR"), true);
	for (const code of ["pt-br", "zh", "xx", "__proto__", "../en"]) assert.equal(localization.supported(code), false);
});

test("existing default accounts adopt a language once without touching bank data or replacing a later explicit choice", async () => {
	const user = {
		_id: "US_fixture",
		language: "en",
		server: "SR_EUI",
		cash: 200,
		info: { gold: 1000, items0: [{ name: "helmet", level: 7 }] },
	};
	const collection = account_collection(user);
	await localization.initialize_user(collection, request(), user);
	assert.equal(collection.writes.length, 0);
	assert.equal(localization.initialized(user), false);
	await localization.initialize_user(collection, request("tr"), user);
	assert.equal(user.language, "tr");
	assert.equal(user.language_set, "detected");
	assert.deepEqual(collection.records.get(user._id).info, user.info);
	assert.deepEqual(Object.keys(collection.writes[0].update.$set).sort(), ["language", "language_set"]);
	await localization.initialize_user(collection, request("ru"), user);
	assert.equal(collection.writes.length, 1);
	assert.equal(user.language, "tr");

	const stale = { ...user, language: "en", language_set: false };
	collection.records.set(user._id, { ...user, language: "ja", language_set: "explicit" });
	await localization.initialize_user(collection, request("ru"), stale);
	assert.equal(stale.language, "ja");
	assert.equal(collection.records.get(user._id).language, "ja");
});

test("settings API permits only valid language changes in the bank and writes only preference fields", async () => {
	const user = {
		_id: "US_fixture",
		language: "en",
		server: "SR_EUI",
		cash: 123,
		info: { gold: 1000, items0: [{ name: "helmet" }] },
	};
	const before = structuredClone(user);
	const collection = account_collection(user);
	const context = vm.createContext({
		localization,
		db: { collection: () => collection },
		get_domain: async () => ({}),
	});
	load(context, "api.js", ["settings_api"]);
	const result = await context.settings_api({ user, req: request("en"), setting: "language", value: "pt-BR" });
	assert.equal(result.success, true);
	assert.equal(result.language, "pt-BR");
	assert.deepEqual(collection.records.get(user._id), { ...before, language: "pt-BR", language_set: "explicit" });
	for (const value of ["../en", "pt-br", "made-up", { code: "tr" }]) {
		const invalid = await context.settings_api({ user, setting: "language", value });
		assert.equal(invalid.reason, "invalid_language");
	}
	assert.equal(collection.writes.length, 1);
	const email = await context.settings_api({ user, setting: "email", value: false });
	assert.equal(email.reason, "cant_make_changes_while_in_bank");
	assert.equal(collection.writes.length, 1);
});

function auth_context(existing) {
	const context = vm.createContext({
		console: { log() {}, error() {} },
		localization,
		Dev: true,
		options: { cookie_key: "auth" },
		really_old: new Date(0),
		get_user_by_email: async () => existing,
		get_domain: async (req, user) => ({
			...localization.domain_fields(req, user),
			domain: "adventure.test",
			tauri: true,
		}),
		gf: (object, field, fallback) =>
			object && object.info && object.info[field] !== undefined ? object.info[field] : fallback,
		msince: () => 999,
		hash_password: () => "fixture-value",
		get_new_auth: () => "fixture-auth",
		set_cookie() {},
		selection_info: async () => ({ type: "content", html: "" }),
		get_signupth: async () => 1,
		get_ip_info: async () => ({ info: {} }),
		get_referrer: async () => null,
		random_string: () => "fixture",
		a_rand: () => 0,
		get_ip: () => "fixture-address",
		get_country: () => "fixture-country",
		send_verification_email() {},
		add_event() {},
		increase_signupth() {},
		put_ip_info: async () => {},
		phrase: localization.phrase,
		phrase_html: localization.phrase_html,
	});
	const store = transactions(context, existing ? [existing] : []);
	load(context, "api.js", ["signup_or_login_api"]);
	return { context, ...store };
}

test("signup and login persist the detected locale while keeping initialized preferences", async () => {
	const signup = auth_context(null);
	const signed = await signup.context.signup_or_login_api({
		req: request("zh-TW"),
		res: { infs: [] },
		email: "fixture@example.invalid",
		password: "fixture-value",
	});
	assert.equal(signed.success, true);
	assert.equal(signed.language, "zh-Hant");
	assert.equal(signup.records.get(signed.user).language, "zh-Hant");
	assert.equal(signup.records.get(signed.user).language_set, "detected");
	for (const marker of [undefined, "explicit"]) {
		const login = auth_context({
			_id: "US_existing",
			language: "en",
			language_set: marker,
			password: "fixture-value",
			info: {},
		});
		const result = await login.context.signup_or_login_api({
			req: request("tr"),
			res: { infs: [] },
			email: "fixture@example.invalid",
			password: "fixture-value",
			only_login: true,
		});
		assert.equal(result.success, true);
		assert.equal(result.language, marker ? "en" : "tr");
		assert.equal(login.records.get(result.user).language, marker ? "en" : "tr");
	}
	for (const source of ["explicit", "detected", "account"]) {
		const login = auth_context({
			_id: "US_existing",
			language: "tr",
			language_set: "explicit",
			password: "fixture-value",
			info: {},
		});
		const req = request("en", "ja");
		req.cookies.language_source = source;
		const result = await login.context.signup_or_login_api({
			req,
			res: { infs: [] },
			email: "fixture@example.invalid",
			password: "fixture-value",
			only_login: true,
		});
		assert.equal(result.language, source === "explicit" ? "ja" : "tr");
		assert.equal(login.records.get(result.user).language, source === "explicit" ? "ja" : "tr");
	}
});

test("catalogs merge domains, keep English fallbacks, and cache each requested language", (t) => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-language-test-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	fs.mkdirSync(path.join(directory, "en"));
	fs.mkdirSync(path.join(directory, "tr"));
	fs.writeFileSync(
		path.join(directory, "en", "account.js"),
		'// Context for translators stays in source.\nmodule.exports={"fixture.hello":"Hello {name}"};\n',
	);
	fs.writeFileSync(path.join(directory, "en", "docs.js"), 'module.exports={"fixture.docs":"Documentation"};\n');
	fs.writeFileSync(path.join(directory, "tr", "account.json"), '{"fixture.hello":"Merhaba {name}"}\n');
	const catalog = localization.create_catalog_loader(directory);
	assert.deepEqual({ ...catalog("tr") }, { "fixture.hello": "Merhaba {name}", "fixture.docs": "Documentation" });
	const browser = localization.create_catalog_loader(directory, { account: true });
	assert.deepEqual({ ...browser("tr") }, { "fixture.hello": "Merhaba {name}" });
	assert.deepEqual({ ...browser("ja") }, { "fixture.hello": "Hello {name}" });
	fs.writeFileSync(path.join(directory, "tr", "account.json"), "invalid");
	assert.equal(catalog("tr")["fixture.hello"], "Merhaba {name}");
	assert.equal(catalog("ja")["fixture.hello"], "Hello {name}");
	assert.throws(() => catalog("../en"), /Unsupported language/);
});

function response() {
	return {
		headers: {},
		statusCode: 200,
		set(key, value) {
			this.headers[key] = value;
			return this;
		},
		vary(key) {
			this.headers.Vary = (this.headers.Vary || []).concat(key);
			return this;
		},
		status(value) {
			this.statusCode = value;
			return this;
		},
		type(value) {
			this.headers["Content-Type"] = value;
			return this;
		},
		send(value) {
			this.body = value;
			return this;
		},
	};
}

function in_request(req, action) {
	const res = response();
	return new Promise((resolve, reject) => {
		localization.middleware(async () => null)(req, res, (error) => {
			if (error) return reject(error);
			Promise.resolve()
				.then(() => action(res))
				.then(resolve, reject);
		});
	});
}

test("concurrent article renders retain their request language and safely interpolate template HTML", async () => {
	const env = new nunjucks.Environment(null, { autoescape: true });
	const context = vm.createContext({ env, nunjucks, localization, to_pretty_num: String });
	vm.runInContext(read("filters.js"), context);
	load(context, "adventure_functions.js", ["shtml"]);
	let release;
	const ready = new Promise((resolve) => {
		release = resolve;
	});
	await Promise.all([
		in_request(request("tr"), async (res) => {
			assert.equal(localization.current_language(), "tr");
			await ready;
			assert.equal(localization.current_language(), "tr");
			assert.equal(env.renderString('{{ phrase("language.choose") }}'), localization.catalog("tr")["language.choose"]);
			assert.equal(res.headers["Cache-Control"], "private, no-store");
			assert.deepEqual(res.headers.Vary, ["Accept-Language", "Cookie"]);
		}),
		in_request(request("ru"), async () => {
			assert.equal(localization.current_language(), "ru");
			release();
			await Promise.resolve();
			assert.equal(localization.current_language(), "ru");
			assert.equal(
				env.renderString('{{ phrase_html("language.select", {language: "<b>name</b>"}) }}', {
					domain: { language: "en" },
				}),
				"Use &lt;b&gt;name&lt;/b&gt;",
			);
		}),
	]);
	assert.equal(localization.current_language(), "en");
	assert.equal(localization.phrase("language.choose"), "Language");
	assert.equal(env.getGlobal("phrase")("language.choose"), "Language");
	const renderer = { render: (file, vars) => vars.domain.language };
	context.nunjucks = renderer;
	assert.equal(context.shtml("docs/fixture.html"), "en");
	assert.equal(context.shtml("docs/fixture.html", { domain: { language: "ja" } }), "ja");
});

test("verification and password emails retain translated actions, safe links and UTF-8 in every language", async () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.resolve(__dirname, "../..")), {
		autoescape: true,
	});
	vm.runInNewContext(read("filters.js"), { env, nunjucks, localization, to_pretty_num: String });
	const sent = [],
		errors = [];
	const context = vm.createContext({
		localization,
		nunjucks: env,
		get_id: (user) => user._id,
		keys: {},
		get_user_by_email: async () => null,
		console: { log() {}, error: (...args) => errors.push(args) },
		require(name) {
			assert.equal(name, "@aws-sdk/client-ses");
			return {
				SESClient: class {
					async send(command) {
						sent.push(command.input);
					}
				},
				SendEmailCommand: class {
					constructor(input) {
						this.input = input;
					}
				},
			};
		},
	});
	load(context, "adventure_functions.js", [
		"purify_email",
		"send_email",
		"send_verification_email",
		"send_password_reminder_email",
	]);
	const english = { ...require("../../languages/en/pages"), ...require("../../languages/en/server") };
	const ids = Object.keys(english).filter((id) => id.startsWith("pages.email.") || id.startsWith("server.email."));
	ids.push("pages.contents.announcement_email.hi-adventurer");
	for (const { code } of localization.languages) {
		const catalog =
			code === "en"
				? english
				: {
						...JSON.parse(read(`languages/${code}/pages.json`)),
						...JSON.parse(read(`languages/${code}/server.json`)),
					};
		for (const id of ids) {
			assert.equal(typeof catalog[id], "string", `${code}: missing ${id}`);
			if (code !== "en") assert.notEqual(catalog[id], english[id], `${code}: untranslated ${id}`);
			assert.deepEqual(
				catalog[id].match(/\{[a-z_]+\}/g),
				english[id].match(/\{[a-z_]+\}/g),
				`${code}: parameters in ${id}`,
			);
		}
		const domain = {
			language: "en",
			base_url: "https://adventure.test",
			discord_url: "https://discord.example.invalid/?a=1&b=2",
		};
		const token = 'fixture&"<>';
		const user = {
			_id: "US_email_fixture",
			language: code,
			info: { email: "email@example.invalid", everification: token, password_key: token },
		};
		for (const [send, route, prefix, action] of [
			["send_verification_email", "ev", "verification", "pages.email.to-verify-your-email"],
			["send_password_reminder_email", "reset", "reset", "pages.email.to-reset-your-password-please-visit"],
		]) {
			const count = sent.length;
			await context[send](domain, user);
			assert.equal(sent.length, count + 1);
			const message = sent.at(-1).Message;
			const url = `${domain.base_url}/${route}/${user._id}/${token}`;
			assert.equal(message.Subject.Charset, "UTF-8");
			assert.equal(message.Body.Html.Charset, "UTF-8");
			assert.equal(message.Body.Text.Charset, "UTF-8");
			assert.equal(message.Subject.Data, catalog[`server.email.${prefix}_subject`]);
			assert.equal(message.Body.Text.Data, localization.phrase(`server.email.${prefix}_text`, { url }, code));
			const html = message.Body.Html.Data;
			assert.ok(html.includes(`href="${nunjucks.lib.escape(url)}"`), `${code}: escaped action URL`);
			assert.ok(html.includes(`lang="${code}"`));
			assert.ok(html.includes(`dir="${code === "ar" ? "rtl" : "ltr"}" width="640"`));
			const text = html
				.replace(/<[^>]*>/g, "")
				.replace(/&nbsp;/g, " ")
				.replace(/\s+/g, " ");
			assert.ok(text.includes(nunjucks.lib.escape(catalog[action])), `${code}: action label`);
			if (route === "ev") {
				assert.ok(html.includes(`href="${nunjucks.lib.escape(domain.discord_url)}"`));
				for (const id of ids.filter((id) => /^pages\.email\.[124]-/.test(id))) {
					assert.ok(html.includes(nunjucks.lib.escape(catalog[id])), `${code}: welcome instructions`);
				}
			} else {
				assert.ok(
					html.includes(nunjucks.lib.escape(catalog["pages.email.if-you-haven-t-initiated-this-routine-please"])),
				);
				assert.ok(!html.includes(domain.discord_url));
			}
		}
		assert.equal(domain.language, "en");
	}
	assert.deepEqual(errors, []);
});

test("the shared sender suppresses bounced users before constructing an SES request", async () => {
	let bounced = true,
		sends = 0,
		lookups = [];
	const context = vm.createContext({
		keys: {},
		console: { log() {}, error() {} },
		get_user_by_email: async (email) => {
			lookups.push(email);
			return { ses_bounce: bounced };
		},
		require: () => ({
			SESClient: class {
				async send() {
					sends++;
				}
			},
			SendEmailCommand: class {},
		}),
	});
	load(context, "adventure_functions.js", ["purify_email", "send_email"]);
	for (const title of ["Announcement", "Verification", "Password reminder"]) {
		const result = await context.send_email({}, "Player.Name@googlemail.com", { title });
		assert.equal(result.reason, "ses_bounce");
	}
	assert.equal(sends, 0);
	assert.deepEqual(lookups, Array(3).fill("playername@gmail.com"));
	bounced = false;
	await context.send_email({}, "new@example.invalid", {});
	assert.equal(sends, 1);
});

test("changing the email clears the bounce flag while reusing the same address preserves it", async () => {
	for (const address of ["current@example.invalid", "new@example.invalid"]) {
		const user = {
			_id: "US_email_change",
			email: ["current@example.invalid"],
			ses_bounce: true,
			info: { email: "current@example.invalid" },
		};
		const sent = [];
		const context = vm.createContext({
			console: { log() {}, error() {} },
			get_domain: async () => ({}),
			get_user_by_email: async (email) => (email === user.info.email ? user : null),
			gf: (value, key, fallback) => value.info?.[key] ?? fallback,
			hsince: () => 999,
			delete_phrase_mark: async () => {},
			mark_phrase: async () => {},
			random_string: () => "fixture-value",
			send_verification_email: (domain, changed) => sent.push(changed.ses_bounce),
			selection_info: async () => ({}),
			INITIAL_BACKOFF: 0,
			BACKOFF_MULTIPLIER: 1,
		});
		const fixture = transactions(context, [user]);
		load(context, "adventure_functions.js", ["purify_email"]);
		load(context, "api.js", ["change_email_api"]);
		const result = await context.change_email_api({ user, email: address, req: {}, res: { infs: [] } });
		assert.equal(result.success, true);
		assert.equal(fixture.records.get(user._id).ses_bounce, address === user.info.email);
		assert.deepEqual(sent, [address === user.info.email]);
	}
});

test("phrase route returns executable dictionaries for exact supported codes only", () => {
	const res = response();
	localization.serve({ params: { language: "tr" }, acceptsEncodings: () => "identity" }, res);
	assert.equal(res.statusCode, 200);
	assert.match(res.headers["Cache-Control"], /^public,/);
	assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
	let loaded;
	vm.runInNewContext(res.body, {
		phrase: {
			load: (language, dictionary) => {
				loaded = { language, dictionary };
			},
		},
	});
	assert.equal(loaded.language, "tr");
	assert.equal(loaded.dictionary["language.choose"], localization.catalog("tr")["language.choose"]);
	assert.doesNotMatch(res.body, /English documentation catalog|Context for translators/);
	for (const language of ["../en", "zh", "__proto__"]) {
		const rejected = response();
		localization.serve({ params: { language } }, rejected);
		assert.equal(rejected.statusCode, 404);
	}
});

test("message packets retain English for existing CODE users and carry explicit localization metadata", () => {
	assert.deepEqual(
		localization.message("language.select", { language: "Türkçe" }, { color: "white", args: { size: 16 } }),
		{
			color: "white",
			args: { size: 16 },
			message: "Use Türkçe",
			phrase: "language.select",
			phrase_args: { language: "Türkçe" },
		},
	);
});
