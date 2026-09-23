"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load, localize } = require("./helpers/server_vm");

const design = localize(vm.createContext({ console: { log() {} } }));
for (const name of ["multipliers", "conditions", "items", "npcs", "drops"])
	vm.runInContext(read("design/" + name + ".js"), design, { filename: name });

function render(name, data = {}) {
	const icons = [];
	const context = vm.createContext({
		ProgressionSources: require("../../js/progression/sources"),
		G: Object.assign(
			{
				items: design.items,
				npcs: design.npcs,
				drops: design.drops,
				maps: { main: { name: "Mainland" } },
				tokens: {},
				craft: {},
				dismantle: {},
			},
			data,
		),
		colors: { property: "white", inspect: "white" },
		clone: structuredClone,
		sprite: (name) => "<sprite>" + name + "</sprite>",
		bold_prop_line: (key, value) => key + value,
		to_pretty_fraction: (value) => "odds:" + value,
		item_container: (options, item) => {
			icons.push({ options, item: { ...item } });
			return "<item>" + item.name + "</item>";
		},
	});
	load(context, "js/html.js", ["render_item_help"]);
	const html = context.render_item_help(null, name, 0, true);
	return {
		html,
		sources: icons.filter((entry) => entry.options.onclick.includes("render_item_popup(")).map((entry) => entry.item),
	};
}

test("loaded anniversary equipment lists nested gifts and direct cake exchanges", () => {
	for (const [, name] of design.drops.anniversary_equipment) {
		const { sources } = render(name);
		assert(
			sources.some((item) => item.name === "anniversarygift"),
			name + " comes from Anniversary Gifts",
		);
		assert(
			sources.some((item) => item.name === "sixcake"),
			name + " comes from cake",
		);
		assert.equal(sources.filter((item) => item.name === "anniversarygift").length, 1);
	}
});

test("ordinary NPC, monster and exchange sources keep their existing renderer and odds", () => {
	const { html, sources } = render("hpot0");
	assert.match(html, /smart_smart_move\("npc","fancypots"\)/);
	const [odds, name] = design.drops.monsters.goo.find((row) => row[0] > 0 && design.items[row[1]]);
	const monster = render(name).html;
	assert.match(monster, /smart_smart_move\("monster","goo"\)/);
	assert(monster.includes("odds:" + odds));
	assert(sources.length > 0);
});

test("nested and bonus sources have no depth limit and terminate on shared or cyclic paths", () => {
	const items = { target: {}, gift: { e: 1 }, bonusgift: { e: 1 }, disabled: { e: 1 } };
	const drops = {
		monsters: { nested: [[1, "open", "a"]], direct: [[0.25, "target"]], disabled: [[0, "target"]] },
		maps: { main: [[1, "open", "b"]], hidden: [[1, "target"]] },
		gift: [
			[1, "open", "a"],
			[1, "open", "b"],
		],
		a: [[1, "open", "b"]],
		b: [[1, "open", "c"]],
		c: [[1, "open", "d"]],
		d: [[1, "open", "e"]],
		e: [
			[1, "target"],
			[1, "open", "a"],
		],
		bonusgift: [[1, "gold"]],
		bonusgift_bonus: [[0.01, "open", "a"]],
		disabled: [[0, "open", "a"]],
	};
	const { html, sources } = render("target", { items, drops });
	assert.deepEqual(sources, [
		{ name: "gift", level: 0 },
		{ name: "bonusgift", level: 0 },
	]);
	assert.match(html, /smart_smart_move\("monster","nested"\)/);
	assert.match(html, /smart_smart_move\("monster","direct"\)/);
	assert.match(html, /odds:0.25/);
	assert.match(html, /render_travel\("main"\)/);
	assert.doesNotMatch(html, /"disabled"|"hidden"/);
});

test("leveled exchanges use the same +0 and higher table keys as the server", () => {
	const { sources } = render("target", {
		items: { target: {}, leveled: { e: 1, upgrade: {} }, compound: { e: 1, compound: {} } },
		drops: {
			monsters: {},
			maps: {},
			leveled0: [[1, "target"]],
			leveled2: [[1, "open", "reward"]],
			compound0: [[1, "open", "reward"]],
			compound3: [[1, "gold"]],
			compound3_bonus: [[0.1, "target"]],
			reward: [[1, "target"]],
		},
	});
	assert.deepEqual(sources, [
		{ name: "leveled", level: 0 },
		{ name: "leveled", level: 2 },
		{ name: "compound", level: 0 },
		{ name: "compound", level: 3 },
	]);
});
