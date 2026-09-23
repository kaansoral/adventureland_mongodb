const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const nunjucks = require("nunjucks");
const { root, read, extract } = require("./helpers/server_vm");
const localization = require("../../languages");

function payment_scripts() {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	vm.runInNewContext(read("filters.js"), { env, nunjucks, localization, to_pretty_num: String });
	const html = env.render("htmls/payments.html", {
		domain: { cash: true, stripe_enabled: true, stripe_pkey: "publishable-key-fixture", v: "test", language: "en" },
	});
	return Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g), ([, attributes, source]) => ({
		url: attributes.match(/src="([^"]+)"/)?.[1],
		source,
	}));
}

test("the shells page loads the font dependency used by the background game", () => {
	const scripts = payment_scripts();
	const fonts = scripts.findIndex((script) => script.url?.startsWith("/js/pixel_fonts.js?"));
	const startup = scripts.findIndex((script) => script.source.includes('document.addEventListener("DOMContentLoaded"'));
	assert.ok(fonts >= 0 && fonts < startup);
	let loaded = false;
	const context = vm.createContext({
		document: { documentElement: { lang: "en" } },
		no_graphics: false,
		loader: { load: () => (loaded = true) },
	});
	context.window = context;
	vm.runInContext(read(scripts[fonts].url.split("?")[0].slice(1)), context);
	vm.runInContext(extract(read("js/game.js"), "load_game"), context);
	context.load_game();
	assert.equal(loaded, true);
});

test("Stripe starts even when another shells page startup step fails", () => {
	const scripts = payment_scripts();
	const loader = scripts.find((script) => script.source.includes("https://js.stripe.com/v2/"));
	const startup = scripts.find((script) => script.source.includes('document.addEventListener("DOMContentLoaded"'));
	for (const failure of [null, "keyboard_logic", "init_sounds", "the_game", "on_resize"]) {
		const timers = [],
			inserted = [],
			listeners = {};
		let publishable_key;
		const context = vm.createContext({
			document: {
				addEventListener: (event, callback) => (listeners[event] = callback),
				createElement: () => ({}),
				getElementsByTagName: () => [{ parentNode: { insertBefore: (script) => inserted.push(script) } }],
			},
			addEventListener() {},
			setTimeout: (callback) => timers.push(callback),
			bowser: { chrome: true },
			Stripe: { setPublishableKey: (key) => (publishable_key = key) },
		});
		context.window = context;
		for (const name of ["keyboard_logic", "init_sounds", "the_game", "drag_logic", "on_resize"])
			context[name] = () => {
				if (name === failure) throw new Error("startup failure");
			};
		vm.runInContext(loader.source, context);
		vm.runInContext(startup.source, context);
		if (failure) assert.throws(listeners.DOMContentLoaded, /startup failure/);
		else listeners.DOMContentLoaded();
		for (const callback of timers) callback();
		assert.equal(inserted.length, 1, failure || "normal startup");
		assert.equal(inserted[0].src, "https://js.stripe.com/v2/");
		inserted[0].onload();
		assert.equal(publishable_key, "publishable-key-fixture");
	}
});
