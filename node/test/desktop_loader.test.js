const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const root = path.resolve(__dirname, "../..");
const resources = path.join(root, "tauri/resources");
const html = fs.readFileSync(path.join(resources, "loader.html"), "utf8");
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("\n");
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function loader({ system = "ru-RU", language = () => "ru", compatibility = () => undefined } = {}) {
	let now = 0,
		next = 0;
	const timers = new Map(),
		calls = [],
		errors = [],
		elements = {};
	function element(id) {
		return {
			id,
			style: {},
			hidden: false,
			disabled: false,
			textContent: "",
			listeners: {},
			addEventListener(event, fn) {
				this.listeners[event] = fn;
			},
		};
	}
	for (const [, id] of html.matchAll(/id=["']([^"']+)["']/g)) elements[id] = element(id);
	elements.compatibility.style.display = "none";
	const context = vm.createContext({
		console: {
			log() {},
			warn(...args) {
				errors.push(args);
			},
			error(...args) {
				errors.push(args);
			},
		},
		navigator: { languages: [system] },
		setTimeout(fn, ms) {
			const id = ++next;
			timers.set(id, { at: now + ms, fn });
			return id;
		},
		clearTimeout(id) {
			timers.delete(id);
		},
		setInterval() {
			return ++next;
		},
		__TAURI__: {
			core: {
				invoke(command) {
					calls.push(command);
					if (command === "get_desktop_language") return language();
					if (command === "enable_compatibility_mode") return compatibility();
					throw new Error("Unexpected command: " + command);
				},
			},
		},
		document: {
			documentElement: {},
			getElementById(id) {
				assert.ok(elements[id], id);
				return elements[id];
			},
			createElement() {
				return element();
			},
			head: {
				appendChild(script) {
					queueMicrotask(() => {
						vm.runInContext(fs.readFileSync(path.join(resources, script.src), "utf8"), context);
						if (script.onload) script.onload();
						if (script.listeners.load) script.listeners.load();
					});
				},
			},
		},
	});
	context.window = context;
	for (const name of ["localStorage", "sessionStorage"]) {
		Object.defineProperty(context, name, {
			get() {
				throw new Error("Loader must not use " + name);
			},
		});
	}
	for (const file of ["phrases.js", "desktop.js"])
		vm.runInContext(fs.readFileSync(path.join(resources, file), "utf8"), context);
	vm.runInContext(inline, context);
	await settle();
	return {
		context,
		elements,
		calls,
		errors,
		async advance(ms) {
			const until = now + ms;
			for (;;) {
				const due = [...timers].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
				if (!due) break;
				now = due[1].at;
				timers.delete(due[0]);
				due[1].fn();
				await settle();
			}
			now = until;
			await settle();
		},
		async click() {
			elements["compatibility-button"].listeners.click();
			await settle();
		},
	};
}

test("all offline loader phrases match their sources in every registered language", () => {
	const phrase = require("../../js/phrases");
	const english = require("../../languages/en/desktop");
	const ids = [
		"desktop.compatibility_help",
		"desktop.compatibility_yes",
		"desktop.compatibility_retry",
		"desktop.support",
	];
	assert.ok(phrase.languages.length > 0);
	for (const { code } of phrase.languages) {
		const source =
			code === "en" ? english : JSON.parse(fs.readFileSync(path.join(root, "languages", code, "desktop.json")));
		const sandbox = {
			phrase: {
				load(locale, dictionary) {
					assert.equal(locale, code);
					sandbox.dictionary = dictionary;
				},
			},
		};
		vm.runInNewContext(fs.readFileSync(path.join(resources, "languages", code + ".js"), "utf8"), sandbox);
		for (const id of ids) {
			assert.ok(source[id]?.trim(), code + " " + id);
			assert.equal(sandbox.dictionary[id], source[id]);
			if (code !== "en") assert.notEqual(source[id], english[id]);
			assert.doesNotMatch(source[id], /[{}<>]/);
		}
		assert.equal(source[ids[2]].split("hello@adventure.land").length, 2);
		assert.match(source[ids[2]], /VPN/);
		assert.equal(source[ids[2]].split("https://adventure.land").length, 2);
		const pages =
			code === "en"
				? require("../../languages/en/pages")
				: JSON.parse(fs.readFileSync(path.join(root, "languages", code, "pages.json")));
		assert.ok(source[ids[2]].includes(pages["pages.steam_signup.title"]), code + " signup label");
		assert.equal(source["desktop.support"].split("hello@adventure.land").length, 2);
	}
	assert.equal(
		fs.readFileSync(path.join(resources, "desktop.js"), "utf8"),
		fs.readFileSync(path.join(root, "js/desktop.js"), "utf8"),
	);
});

test("support does not wait for native language detection in any registered language", async () => {
	for (const { code } of require("../../js/phrases").languages) {
		const app = await loader({ system: code, language: () => new Promise(() => {}) });
		assert.equal(app.elements.support.textContent, app.context.phrase("desktop.support"), code);
		assert.match(app.elements.support.textContent, /hello@adventure.land/, code);
		assert.equal(app.elements.compatibility.style.display, "none");
		await app.advance(1600);
		assert.deepEqual(app.calls, ["get_desktop_language"]);
	}
});

test("ordinary startup never switches automatically, even after 60 seconds", async () => {
	const app = await loader();
	assert.equal(app.elements.compatibility.style.display, "none");
	await app.advance(29999);
	assert.equal(app.elements.compatibility.style.display, "none");
	await app.advance(1);
	assert.equal(app.elements.compatibility.style.display, "block");
	assert.equal(app.elements["compatibility-button"].textContent, "Да");
	assert.match(app.elements["compatibility-help"].textContent, /режим совместимости/);
	await app.advance(30000);
	assert.equal(app.elements["compatibility-button"].hidden, false);
	assert.deepEqual(app.calls, ["get_desktop_language"]);
});

test("Yes switches once; the same card gives translated help after 60 seconds total", async () => {
	const app = await loader();
	await app.advance(30000);
	await app.click();
	await app.click();
	assert.equal(app.calls.filter((command) => command === "enable_compatibility_mode").length, 1);
	assert.equal(app.elements["compatibility-button"].disabled, true);
	await app.advance(29999);
	assert.equal(app.elements["compatibility-button"].hidden, false);
	await app.advance(1);
	assert.equal(app.elements["compatibility-button"].hidden, true);
	assert.match(app.elements["compatibility-help"].textContent, /перезагрузить игру/);
	assert.match(app.elements["compatibility-help"].textContent, /hello@adventure.land/);
	assert.match(app.elements["compatibility-help"].textContent, /https:\/\/adventure\.land/);
	assert.match(app.elements["compatibility-help"].textContent, /Зарегистрироваться через Steam/);
});

test("opting in after 60 seconds also shows the follow-up; a fresh loader has no saved route", async () => {
	const app = await loader();
	await app.advance(70000);
	await app.click();
	assert.equal(app.elements["compatibility-button"].hidden, true);
	const fresh = await loader();
	assert.deepEqual(fresh.calls, ["get_desktop_language"]);
	assert.equal(fresh.context.compatibility_active, false);
});

test("failed and stalled commands show help without retries or an unhandled rejection", async () => {
	for (const compatibility of [() => Promise.reject(new Error("Unavailable")), () => new Promise(() => {})]) {
		const app = await loader({ compatibility });
		await app.advance(30000);
		await app.click();
		await app.advance(6000);
		assert.equal(app.elements["compatibility-button"].hidden, true);
		assert.match(app.elements["compatibility-help"].textContent, /hello@adventure.land/);
		await app.click();
		assert.equal(app.calls.filter((command) => command === "enable_compatibility_mode").length, 1);
		assert.ok(app.errors.length);
	}
});

test("cached language wins once; missing native language leaves the system-language notice usable", async () => {
	const cached = await loader({ system: "en-US", language: () => "ru" });
	await cached.advance(30000);
	assert.equal(cached.context.document.documentElement.lang, "ru");
	assert.equal(cached.elements["compatibility-button"].textContent, "Да");
	assert.equal(cached.elements.support.textContent, cached.context.phrase("desktop.support"));
	assert.match(cached.elements.support.textContent, /По любым вопросам/);
	const fallback = await loader({ language: () => new Promise(() => {}) });
	await fallback.advance(60000);
	assert.equal(fallback.elements["compatibility-button"].textContent, "Да");
	assert.deepEqual(fallback.calls, ["get_desktop_language"]);
});
