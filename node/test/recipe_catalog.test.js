const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load } = require("./helpers/server_vm");

function menu() {
	const shown = [];
	const context = vm.createContext({
		G,
		object_sort: G.object_sort,
		randomStr: G.randomStr,
		to_pretty_num: G.to_pretty_num,
		r_page: {},
		next_side_interaction: null,
		reset_inventory() {},
		tut() {},
		item_container(options, item) {
			if (item && item.name) {
				assert.ok(G.items[item.name], "missing item " + item.name);
				shown.push({ ...item });
			}
			return "<div></div>";
		},
		$: () => ({ html: (html) => (context.html = html) }),
		show_modal: (html) => (context.html = html),
		render_item: (selector, args) => {
			context.recipe_item = args;
			return args.name;
		},
		render_skill: (selector, name) => (context.skill = name),
	});
	load(context, "js/html.js", ["render_recipes", "render_recipe", "render_all_recipes", "render_cx_info"]);
	return { context, shown };
}

test("gold sorting resolves recipe outputs and still sorts item and dismantle catalogs", () => {
	assert.equal(G.items.makeawishjar, undefined);
	assert.equal(G.craft.makeawishjar.output.name, "cxjar");
	const before = JSON.stringify(G.craft);
	for (const catalog of [G.craft, G.items, G.dismantle, { hpot0: null, mpot0: 2 }]) {
		const sorted = G.object_sort(catalog, "gold_value");
		assert.deepEqual(new Set(Array.from(sorted, ([name]) => name)), new Set(Object.keys(catalog)));
		const values = Array.from(sorted, ([name, entry]) => G.items[entry?.output?.name || name].g);
		assert.deepEqual(
			values,
			values.slice().sort((a, b) => a - b),
		);
	}
	assert.equal(JSON.stringify(G.craft), before, "sorting must preserve recipe IDs and output metadata");
});

test("Cole's menu opens with every collector recipe and no anniversary recipes", () => {
	const { context, shown } = menu();
	context.render_recipes(G.npcs.mcollector.quest);
	const expected = Object.keys(G.craft).filter((name) => G.craft[name].quest === "mcollector");
	assert.ok(expected.length > 0);
	assert.deepEqual(new Set(shown.map((item) => item.name)), new Set(expected));
	assert.match(context.html, /recipe-item/);
});

test("the full recipe guide renders the Make a Wish jar with its cosmetic data", () => {
	const { context, shown } = menu();
	context.render_all_recipes();
	assert.ok(shown.some((item) => item.name === "cxjar" && item.data === "makeawish"));
	assert.ok(context.html);
});

test("Mira's cake choice opens only the cake recipe in the standard browser", () => {
	const { context, shown } = menu();
	context.r_page.anniversary_baker = 2;
	context.render_recipes("anniversary_baker", "sixcake");
	context.render_recipe(true, "anniversary_baker", "sixcake");
	assert.deepEqual(shown, [{ name: "sixcake" }]);
	assert.equal(context.r_page.anniversary_baker, 0);
	assert.equal(context.recipe_item.recipe, "sixcake");
	assert.equal(context.recipe_item.craft, true);
});

test("Mira's craft browser preserves the jar output and its distinct recipe ID", () => {
	const { context, shown } = menu();
	context.render_recipes("anniversary_baker");
	assert.equal(shown.length, Object.values(G.craft).filter((recipe) => recipe.quest === "anniversary_baker").length);
	assert.ok(shown.some((item) => item.name === "cxjar" && item.data === "makeawish"));
	context.render_recipe(true, "anniversary_baker", "makeawishjar");
	assert.equal(context.recipe_item.name, "cxjar");
	assert.equal(context.recipe_item.actual.data, "makeawish");
	assert.equal(context.recipe_item.recipe, "makeawishjar");
	context.render_cx_info("makeawish");
	assert.equal(context.skill, "makeawish", "the jar contents open the existing skill details");
});
