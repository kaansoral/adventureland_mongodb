const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const nunjucks = require("nunjucks");
const localization = require("../../languages");
const { read, load } = require("./helpers/server_vm");
const G = require("./helpers/design");

function article() {
	return nunjucks.renderString(read("docs/guide/encouragement.html"), {
		phrase: (id, params) => localization.phrase(id, params, "en"),
		phrase_html: (id, params) => nunjucks.runtime.markSafe(localization.phrase_html(id, params, "en")),
	});
}

function ui() {
	const rendered = [];
	const c = vm.createContext({
		G,
		colors: G.colors,
		console,
		no_graphics: true,
		window: { no_html: true },
		inside: "game",
		trade_slots: [],
		booster_items: [],
		last_selector: "",
		calculate_item_grade: G.calculate_item_grade,
		clone: G.clone,
		is_string: G.is_string,
		is_array: Array.isArray,
		to_pretty_num: G.to_pretty_num,
		in_arr: (v, a) => a.includes(v),
		to_pretty_float: G.to_pretty_float,
		item_container: () => "",
		floor: Math.floor,
		max: Math.max,
		min: Math.min,
		$: () => ({ html: (html) => rendered.push(html) }),
		modal_count: 0,
		alert() {
			throw Error("blocking dialog");
		},
	});
	vm.runInContext(read("js/phrases.js"), c);
	c.phrase.load("en", localization.browser_catalog("en"));
	vm.runInContext(read("docs/directory.js"), c);
	c.G = Object.assign({}, G, { docs: c.docs });
	vm.runInContext(read("js/pixi/fake/pixi.min.js"), c);
	c.PIXI = new Proxy(c.PIXI, {
		get() {
			throw Error("no-graphics entry touched PIXI");
		},
	});
	load(c, "js/html.js", [
		"render_item",
		"render_condition",
		"render_encouragement_info",
		"open_guide",
		"get_guide_url",
		"bold_prop_line",
		"prop_line",
		"prop_remains",
	]);
	for (const name of ["render_ui_panel", "add_ui_close"])
		if (read("js/html.js").includes("function " + name + "(")) load(c, "js/html.js", [name]);
	c.character = c.ctarget = { s: {}, encouragement: { statuses: [] } };
	c.xtarget = null;
	return { c, rendered };
}

test("real condition renderer shows separate factors, a working INFO link and no false Lone Wolf timer", () => {
	const { c, rendered } = ui();
	c.character.s.encouragement_lonewolf = { gold_multiplier: 3, xp_multiplier: 3, luck_multiplier: 3 };
	c.render_condition("#condition", "encouragement_lonewolf");
	const html = rendered.at(-1);
	assert.match(html, /3×/);
	for (const [label, color] of [
		["Gold", G.colors.gold],
		["XP", G.colors.stat_xp],
		["Luck", G.colors.luck],
	])
		assert(html.includes(c.bold_prop_line(label, "3×", color)));
	assert.match(html, /max-width: 240px; position: relative;/);
	assert.match(html, /class='slimbutton ui-info'/);
	assert.match(html, /top: -5px; right: -5px; border-width: 5px;/);
	c.event = {};
	c.stpr = () => {};
	let request;
	c.api_call = (method, args) => {
		request = { method, ...args };
	};
	vm.runInContext(html.match(/onclick='([^']+)'>INFO/)[1], c);
	assert.deepEqual(request, {
		method: "load_article",
		name: "encouragement",
		guide: true,
		url: "/docs/guide/progression/encouragement",
	});
	assert.doesNotMatch(html, /0 hours|0 minutes|Expires|Remaining|\+3%/);
	c.character.s.encouragement_new = {
		gold_multiplier: 5,
		xp_multiplier: 1,
		luck_multiplier: 5,
		phase: 1,
		ms: 86400000,
	};
	c.render_condition("#condition", "encouragement_new");
	assert.match(rendered.at(-1), /1×/);
	assert.match(rendered.at(-1), /1 of 4/);
});

test("the guide explains inactive conditions without exposing linked account identities", () => {
	const { c } = ui();
	c.character.encouragement = { statuses: [{ id: "encouragement_new", active: false, reason: "character_limit" }] };
	const html = c.render_encouragement_info();
	assert.match(html, /25 or more characters/);
	assert.match(html, /Unavailable/);
	assert.doesNotMatch(html, /pid:|owner:|US_|CH_/);
});

test("condition definitions, shared atlas, guide directory, SEO and MCP all resolve", () => {
	for (const [i, name] of ["encouragement_new", "encouragement_lonewolf", "encouragement_returning"].entries()) {
		assert.equal(G.conditions[name].ui, true);
		assert.deepEqual(JSON.parse(JSON.stringify(G.positions[name])), ["rawitems", 14 + i, 3]);
		for (const stat of ["xp", "gold", "luck", "xpm", "goldm", "luckm"])
			assert.equal(G.conditions[name][stat], undefined);
	}
	assert.match(G.imagesets.rawitems.file, /raw_items\.png\?v=18$/);
	for (const file of ["docs/directory.js", "seo_paths.js", "mcp_api.js"]) assert.match(read(file), /encouragement/);
	const html = article();
	assert.doesNotMatch(html, /<(details|summary)\b/);
	assert.match(html, /once normally and once more/);
	assert.match(html, /25 characters or more/);
	assert.match(html, /oldest character is less than 40 days old/);
});

test("the exact documented CODE works with no graphics and reads condition removals", () => {
	const { c } = ui(),
		messages = [];
	c.game_log = (message) => messages.push(message);
	c.show_json = () => {};
	const example = read("docs/guide/encouragement.html").match(/id="encouragement-code">([\s\S]*?)<\/div>/)[1];
	c.character.s.encouragement_new = { gold_multiplier: 5, xp_multiplier: 5, luck_multiplier: 5 };
	c.character.s.encouragement_lonewolf = { gold_multiplier: 3, xp_multiplier: 3, luck_multiplier: 3 };
	vm.runInContext(example, c);
	assert.equal(messages.at(-1), "Encouragement: 15x Gold, 15x XP, 15x Luck");
	c.character.s = {};
	vm.runInContext(example, c);
	assert.equal(messages.at(-1), "Encouragement: 1x Gold, 1x XP, 1x Luck");
});

test("the guide hierarchy, URL resolver and SEO use the same progression route", () => {
	const { c } = ui();
	assert(!c.G.docs.guide.some((entry) => entry[0] === "encouragement"));
	assert(c.G.docs.guide.find((entry) => entry[0] === "progression")[4].some((entry) => entry[0] === "encouragement"));
	const url = c.get_guide_url("encouragement");
	assert.equal(url, "/docs/guide/progression/encouragement");
	const paths = require("../../seo_paths").get_seo_paths({
		docs: c.G.docs,
		guide_articles: ["encouragement"],
		code_articles: [],
		items: {},
		monsters: {},
	});
	assert(paths.includes(url));
	assert(!paths.includes("/docs/guide/encouragement"));
});
