"use strict";

// docs_link_click in js/html.js: in the game, a plain click on a docs link opens that page in the game;
// middle or modified clicks, and every click outside the game, keep the browser's own link behavior.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "js/html.js"), "utf8");

function slice(name) {
	const start = html.indexOf(`function ${name}(`);
	assert.ok(start >= 0, name);
	return html.slice(start, html.indexOf("\n}\n", start) + 3);
}

function setup(inside) {
	const calls = [];
	const context = vm.createContext({ calls });
	vm.runInContext(fs.readFileSync(path.join(root, "docs/directory.js"), "utf8"), context);
	vm.runInContext(
		`var G = { docs: docs }, window = { inside: ${JSON.stringify(inside)} };
		function load_documentation(name) { calls.push(["load_documentation", name]); }
		function open_guide(name, url) { calls.push(["open_guide", name, url]); }
		function open_article(name, url) { calls.push(["open_article", name, url]); }
		${slice("get_guide_url")}
		${slice("docs_link_click")}`,
		context,
	);
	return context;
}

function click(context, href, extra = {}) {
	const link = { getAttribute: () => href };
	const event = Object.assign(
		{
			button: 0,
			ctrlKey: false,
			metaKey: false,
			shiftKey: false,
			altKey: false,
			defaultPrevented: false,
			target: { closest: () => link },
		},
		extra,
	);
	event.preventDefault = () => (event.defaultPrevented = true);
	context.calls.length = 0;
	context.docs_link_click(event);
	return { calls: JSON.parse(JSON.stringify(context.calls)), prevented: event.defaultPrevented };
}

test("in the game, docs links open their page in the game", () => {
	const game = setup("game");
	assert.deepEqual(click(game, "/docs/code/functions/can_attack"), {
		calls: [["load_documentation", "can_attack"]],
		prevented: true,
	});
	assert.deepEqual(click(game, "/docs/guide/world/mimic"), {
		calls: [["open_guide", "mimic", "/docs/guide/world/mimic"]],
		prevented: true,
	});
	assert.deepEqual(click(game, "/docs/code/functions/get_progression"), {
		calls: [["load_documentation", "get_progression"]],
		prevented: true,
	});
	assert.deepEqual(click(game, "/docs/code/character/reference"), {
		calls: [["open_article", "data-character", "/docs/code/character/reference"]],
		prevented: true,
	});
	assert.deepEqual(click(game, "/docs/code/monster/reference"), {
		calls: [["open_article", "data-monster", "/docs/code/monster/reference"]],
		prevented: true,
	});
});

test("middle, modified and outside-the-game clicks keep the link, and unknown pages are left alone", () => {
	const game = setup("game");
	for (const extra of [{ button: 1 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }])
		assert.deepEqual(
			click(game, "/docs/code/functions/attack", extra),
			{ calls: [], prevented: false },
			JSON.stringify(extra),
		);
	assert.deepEqual(click(setup("docs"), "/docs/code/functions/attack"), { calls: [], prevented: false });
	for (const href of [
		"/docs/guide/all/monsters",
		"https://adventure.land/docs/code/functions/attack",
		"/docs/code/functions/attack?x=1",
	])
		assert.deepEqual(click(game, href), { calls: [], prevented: false }, href);
});

test("every docs link in the guides and function pages opens in the game", () => {
	const game = setup("game");
	const documented = new Set(game.docs.documented);
	let links = 0;
	for (const dir of ["docs/guide", "docs/functions"])
		for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".html"))) {
			const text = fs.readFileSync(path.join(root, dir, file), "utf8");
			for (const [, href] of text.matchAll(/<a href="(\/docs\/[^"]+)"/g)) {
				const result = click(game, href);
				assert.equal(result.prevented, true, `${file}: ${href}`);
				if (result.calls[0][0] === "load_documentation")
					assert.ok(documented.has(result.calls[0][1]), `${file}: ${href}`);
				links++;
			}
		}
	assert.ok(links >= 30, links + " links");
});
