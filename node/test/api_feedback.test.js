const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const nunjucks = require("nunjucks");
const path = require("node:path");
const fs = require("node:fs");
const { read, extract, load } = require("./helpers/server_vm");
const localization = require("../../languages");

const selection = "htmls/contents/selection.html";
const reset = "htmls/contents/password_reset.html";
const settings = "htmls/contents/settings.html";
const hub = "htmls/comm.html";

function handlers(file, method) {
	return [...read(file).matchAll(/onclick="([^"]*)"/g)]
		.map((match) => match[1])
		.filter((handler) => handler.includes("'" + method + "'"));
}

function runtime(inside = "selection") {
	const requests = [],
		errors = [],
		information = [],
		confirmations = [];
	const values = { ".dcharactername": "TestRanger", ".dcharactername2": "TestRanger" };
	const button = { disabled: false };
	const login = { message: "", email: "fixture@example.invalid", password: "fixture", positions: 0 };
	const loginError = {
		empty() {
			login.message = "";
		},
		html(value) {
			login.message = value;
		},
	};
	const form = {
		find(selector) {
			if (selector === ".comm-login-error") return loginError;
			assert.ok([".theemail", ".thepassword"].includes(selector));
			return { val: () => login[selector === ".theemail" ? "email" : "password"] };
		},
	};
	let message = "",
		reloads = 0;
	function $(target) {
		return {
			closest(selector) {
				assert.equal(target, button);
				assert.equal(selector, ".imodal");
				return form;
			},
			val: () => values[target] || "fixture",
			addClass: () => {
				target.disabled = true;
			},
			removeClass: () => {
				target.disabled = false;
			},
			html(value) {
				assert.equal(target, "#message");
				message = value;
			},
		};
	}
	$.ajax = (args) => {
		const request = { args };
		requests.push(request);
		return {
			done(callback) {
				request.done = callback;
				return this;
			},
			fail(callback) {
				request.fail = callback;
				return this;
			},
		};
	};
	const context = vm.createContext({
		$,
		inside,
		button,
		Promise,
		chartype: "ranger",
		thelooks: 0,
		bc: (element) => element.disabled,
		btc() {},
		event: {},
		add_log: (text, color) => errors.push({ text, color }),
		handle_information: (rows) => information.push(...rows),
		position_modals: () => login.positions++,
		show_confirm: (text, yes, no, confirm) => confirmations.push(confirm),
		location: {
			reload() {
				reloads++;
			},
		},
	});
	context.window = context;
	load(context, "js/old_common_functions.js", ["deferred"]);
	load(context, "js/functions.js", ["api_call", "api_call_l", "ui_error"]);
	return {
		context,
		requests,
		errors,
		information,
		confirmations,
		button,
		values,
		login,
		get message() {
			return message;
		},
		get reloads() {
			return reloads;
		},
		click(handler) {
			vm.runInContext("(function(){" + handler + "}).call(button)", context);
		},
	};
}

const settle = () => new Promise(setImmediate);

test("Hub login shows translated failures inside the form and allows retry", async () => {
	const template = read(hub);
	const handler = [...template.matchAll(/onclick="([^"]*)"/g)].find((match) =>
		match[1].includes("comm_login(this)"),
	)[1];
	const loginTemplate = template.slice(template.indexOf('<div id="login"'), template.indexOf('<div id="bottom"'));
	assert.match(loginTemplate, /class="comm-login-error mt5" role="alert"/);
	for (const reason of [
		"wrong_password",
		"email_not_found",
		"invalid_field",
		"network_error",
		"timeout",
		"empty_response",
	]) {
		const ui = runtime("com");
		load(ui.context, "js/comm.js", ["comm_login"]);
		vm.runInContext(read("js/phrases.js"), ui.context);
		ui.context.phrase.load("de", localization.catalog("de"));
		ui.click(handler);
		assert.equal(ui.requests[0].args.url, "/api/signup_or_login");
		assert.deepEqual(JSON.parse(ui.requests[0].args.data), {
			email: ui.login.email,
			password: ui.login.password,
			only_login: true,
			mobile: true,
		});
		assert.equal(ui.button.disabled, true);
		if (reason === "empty_response") ui.requests[0].done(null);
		else if (reason === "network_error" || reason === "timeout")
			ui.requests[0].fail({ status: 0 }, reason, "unavailable");
		else ui.requests[0].done({ failed: true, reason });
		await settle();
		assert.equal(ui.login.message, localization.phrase_html("error." + reason, {}, "de"));
		assert.deepEqual(ui.errors, [], "Hub does not send errors to its absent game log");
		assert.equal(ui.login.positions, 1);
		assert.equal(ui.button.disabled, false);
		ui.login.password = "corrected fixture";
		ui.click(handler);
		assert.equal(ui.login.message, "", "retry clears the previous error");
		assert.equal(JSON.parse(ui.requests[1].args.data).password, ui.login.password);
		ui.requests[1].done({ success: true, infs: [{ type: "refresh" }] });
		await settle();
		assert.deepEqual(ui.information, [{ type: "refresh" }], "successful Hub login keeps the normal page refresh");
		assert.equal(ui.login.message, "");
		assert.equal(ui.button.disabled, false);
	}
});

test("account forms show one translated failure and re-enable their buttons", async () => {
	const actions = [
		[selection, "settings", "cant_make_changes_while_in_bank"],
		[selection, "logout_everywhere", "not_logged_in"],
		[selection, "change_email", "change_email_once_every_18_hours"],
		[selection, "change_password", "passwords_dont_match"],
		[selection, "sort_characters", "invalid_field"],
		[selection, "quote_name", "name_used"],
		[selection, "rename_character", "rename_once_every_32_hours"],
		[selection, "transfer_character", "receiver_not_found_or_wrong_auth"],
		[selection, "copy_map", "cant_copy_over_map_in_use"],
		[selection, "delete_map", "cant_delete_map_in_use"],
		[selection, "edit_character", "character_in_game"],
		[selection, "delete_character", "wait_180_minutes"],
		[selection, "logout", "not_logged_in"],
	];
	for (const [file, method, reason] of actions) {
		const clicks = handlers(file, method);
		assert.ok(clicks.length, method + " handler exists");
		for (const handler of clicks) {
			const ui = runtime();
			ui.click(handler);
			assert.equal(ui.requests.length, 1, method);
			assert.equal(ui.requests[0].args.url, "/api/" + method);
			assert.equal(ui.button.disabled, true);
			ui.click(handler);
			assert.equal(ui.requests.length, 1, "pending action cannot be clicked twice");
			ui.requests[0].done({ failed: true, reason });
			await settle();
			assert.deepEqual(ui.errors, [{ text: ui.context.phrase.error(reason), color: "red" }], method);
			assert.equal(ui.button.disabled, false);
			assert.equal(ui.reloads, 0);
			assert.deepEqual(ui.information, []);
		}
	}
});

test("deletion reports name mismatches without sending a request", () => {
	const ui = runtime();
	ui.values[".dcharactername2"] = "DifferentRanger";
	ui.click(handlers(selection, "delete_character")[0]);
	assert.equal(ui.requests.length, 0);
	assert.deepEqual(ui.errors, [{ text: ui.context.phrase.error("invalid_name"), color: "red" }]);
	assert.equal(ui.button.disabled, false);
});

test("network errors, timeouts and empty responses are visible and allow retry", async () => {
	for (const reason of ["network_error", "timeout", "empty_response"]) {
		const ui = runtime();
		const handler = handlers(selection, "delete_character")[0];
		ui.click(handler);
		if (reason === "empty_response") ui.requests[0].done(null);
		else ui.requests[0].fail({ status: 0 }, reason === "timeout" ? "timeout" : "error", "unavailable");
		await settle();
		assert.deepEqual(ui.errors, [{ text: ui.context.phrase.error(reason), color: "red" }]);
		assert.equal(ui.button.disabled, false);
		ui.click(handler);
		assert.equal(ui.requests.length, 2);
		ui.requests[1].done({ success: true });
		await settle();
		assert.equal(ui.errors.length, 1);
	}
});

test("successful deletion preserves response information; logout reloads only on success", async () => {
	for (const method of ["delete_character", "logout", "logout_everywhere"]) {
		const ui = runtime();
		ui.click(handlers(selection, method)[0]);
		ui.requests[0].done({ success: true, infs: [{ type: "content", html: "updated selection" }] });
		await settle();
		assert.deepEqual(ui.errors, []);
		assert.deepEqual(ui.information, [{ type: "content", html: "updated selection" }]);
		assert.equal(ui.reloads, method === "delete_character" ? 0 : 1);
		assert.equal(ui.button.disabled, false);
	}
});

test("account forms submit the field names required by the actual API registry", async () => {
	const source = read("api.js");
	const registry = source.slice(source.indexOf("var REF ="));
	const context = vm.createContext({});
	for (const match of registry.matchAll(/F:\s*(\w+)/g)) context[match[1]] = () => {};
	vm.runInContext(registry, context);
	for (const file of [selection, reset]) {
		for (const match of read(file).matchAll(/onclick="([^"]*\bapi_call_l\('[^']+'[^\"]*)"/g)) {
			const ui = runtime();
			ui.click(match[1]);
			assert.equal(ui.requests.length, 1);
			const request = ui.requests[0].args;
			const method = request.url.split("/").pop();
			const definition = context.REF[method];
			const data = JSON.parse(request.data);
			for (const field of Object.keys(data)) assert.ok(definition[field], method + ": unknown " + field);
			for (const [field, rule] of Object.entries(definition)) {
				if (["F", "P", "U"].includes(field) || rule.optional) continue;
				assert.ok(Object.hasOwn(data, field), method + ": missing " + field);
			}
			ui.requests[0].done({ success: true });
			await settle();
		}
	}
});

test("tutorial reset waits for confirmation and shows rejection feedback", async () => {
	const ui = runtime();
	ui.click(handlers(settings, "reset_tutorial")[0]);
	assert.equal(ui.requests.length, 0);
	assert.equal(ui.confirmations.length, 1);
	ui.confirmations[0]();
	assert.equal(ui.requests[0].args.url, "/api/reset_tutorial");
	ui.requests[0].done({ failed: true, reason: "not_logged_in" });
	await settle();
	assert.deepEqual(ui.errors, [{ text: ui.context.phrase.error("not_logged_in"), color: "red" }]);
});

test("map tools preserve permission checks and display missing-map feedback", async () => {
	for (const method of ["copy_map", "delete_map"]) {
		const messages = [];
		let reads = 0;
		const context = vm.createContext({
			maps: {},
			inside: "selection",
			gf: (object, field) => object.info[field],
			get: async () => {
				reads++;
				return null;
			},
			ui_log: (message) => messages.push(message),
			call_code_function() {},
		});
		load(context, "api.js", [method + "_api"]);
		load(context, "js/functions.js", ["handle_information"]);
		const args = {
			user: { info: { map_editor: false } },
			res: { infs: [] },
			from: "missing",
			to: "destination",
			name: "missing",
		};
		assert.equal((await context[method + "_api"](args)).reason, "no_permission");
		assert.equal(reads, 0);
		args.user.info.map_editor = true;
		context.maps.active = { key: method === "copy_map" ? args.to : args.name };
		assert.equal(
			(await context[method + "_api"](args)).reason,
			method === "copy_map" ? "cant_copy_over_map_in_use" : "cant_delete_map_in_use",
		);
		assert.equal(reads, 0);
		delete context.maps.active;
		assert.equal((await context[method + "_api"](args)).success, true);
		context.handle_information(args.res.infs);
		assert.deepEqual(messages, [context.phrase_html("server.api.map_didn_t_exist")]);
		assert.equal(reads, 1);
	}
});

test("password reset shows errors in its existing message area, not the absent game log", async () => {
	for (const reason of ["passwords_dont_match", "invalid_key", "network_error"]) {
		const ui = runtime("message");
		ui.click(handlers(reset, "reset_password")[0]);
		if (reason === "network_error") ui.requests[0].fail({ status: 0 }, "error", "unavailable");
		else ui.requests[0].done({ failed: true, reason });
		await settle();
		assert.equal(ui.message, ui.context.phrase.error(reason));
		assert.deepEqual(ui.errors, []);
		assert.equal(ui.button.disabled, false);
	}
});

test("password reset loads the shared language bootstrap before its API handlers", () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.resolve(__dirname, "../..")));
	env.addFilter("to_json", JSON.stringify);
	env.addGlobal("phrase", (id) => localization.phrase(id, {}, "tr"));
	env.addGlobal("phrase_html", (id) => localization.phrase_html(id, {}, "tr"));
	const html = env.render(reset, {
		domain: { language: "tr", language_set: "explicit", v: 1 },
		id: "fixture",
		key: "fixture",
	});
	assert.ok(html.indexOf("/phrases/tr.js?v=1") >= 0);
	assert.ok(html.indexOf("/phrases/tr.js?v=1") < html.indexOf("/js/functions.js?v=1"));
	assert.match(html, /id="message"/);
});

test("raw API calls still reject without automatic UI feedback", async () => {
	const ui = runtime();
	const result = ui.context.api_call("delete_character", { name: "TestRanger" });
	const rejected = assert.rejects(result, (error) => error.reason === "wait_180_minutes");
	ui.requests[0].done({ failed: true, reason: "wait_180_minutes" });
	await rejected;
	assert.deepEqual(ui.errors, []);
});

test("all touched forms and API responses have native translations and matching placeholders", () => {
	const aliases = {
		operation_failed: "failed",
		something_went_wrong: "unexpected",
		invalid: "invalid_field",
		wait_: "wait_minutes",
	};
	const ids = new Set([
		"error.invalid_name",
		"error.network_error",
		"error.timeout",
		"error.empty_response",
		"error.invalid_field",
		"error.missing_field",
		"error.not_logged_in",
		"error.exception",
	]);
	const sources = [selection, settings, reset].map(read);
	for (const method of [
		"settings",
		"logout",
		"logout_everywhere",
		"change_email",
		"change_password",
		"sort_characters",
		"quote_name",
		"rename_character",
		"transfer_character",
		"copy_map",
		"delete_map",
		"edit_character",
		"delete_character",
		"reset_password",
		"reset_tutorial",
	]) {
		const source = extract(read("api.js"), method + "_api");
		sources.push(source);
		for (const match of source.matchAll(/(?:reason:\s*(?:[\w.]+\s*\|\|\s*)?|ex\()"([^"]+)"/g))
			ids.add("error." + (aliases[match[1]] || match[1]));
	}
	for (const source of sources) {
		for (const match of source.matchAll(/phrase(?:_html|\.html)?\(["']([^"']+)["']/g)) ids.add(match[1]);
	}
	const english = {},
		domains = {};
	for (const file of fs.readdirSync(path.resolve(__dirname, "../../languages/en"))) {
		if (!file.endsWith(".js")) continue;
		for (const [id, value] of Object.entries(require("../../languages/en/" + file))) {
			english[id] = value;
			domains[id] = file.replace(/\.js$/, "");
		}
	}
	const parameters = (value) =>
		[...new Set([...value.matchAll(/\{([a-zA-Z_]\w*)\}/g)].map((match) => match[1]))].sort();
	for (const id of ids) assert.ok(english[id], "English " + id);
	for (const language of localization.languages) {
		if (language.code === "en") continue;
		const catalogs = {};
		for (const id of ids) {
			const domain = domains[id];
			catalogs[domain] ||= JSON.parse(read("languages/" + language.code + "/" + domain + ".json"));
			assert.ok(catalogs[domain][id], language.code + " " + id);
			assert.deepEqual(parameters(catalogs[domain][id]), parameters(english[id]), language.code + " " + id);
		}
		const context = vm.createContext({});
		vm.runInContext(read("js/phrases.js"), context);
		context.phrase.load(language.code, catalogs.errors);
		for (const [reason, target] of Object.entries(aliases)) {
			if (reason === "wait_") continue;
			assert.equal(context.phrase.error(reason), context.phrase.html("error." + target), language.code + " " + reason);
		}
	}
});
