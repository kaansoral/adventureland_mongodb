"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function definition(source, name) {
	const start = source.indexOf(`function ${name}(`);
	assert.ok(start >= 0, name);
	const end = source.indexOf("\nfunction ", start + 1);
	return source.slice(start, end < 0 ? undefined : end);
}
function harness() {
	const context = vm.createContext({
		Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
		instances: { main: { map: "main", monsters: {} } },
		total_monsters: 0,
		monster_c: {},
		mode: {},
		server: { live: false },
		min: Math.min,
		ceil: Math.ceil,
		future_s: () => new Date(0),
		// Stat recalculation is unrelated to initialization's geometry.
		calculate_monster_stats() {},
	});
	vm.runInContext(read("design/monsters.js"), context);
	vm.runInContext(read("design/dimensions.js"), context);
	vm.runInContext("var G = { monsters, dimensions, skills: {} };", context);
	vm.runInContext(read("js/old_common_functions.js"), context);
	vm.runInContext(definition(read("node/server.js"), "new_monster"), context);
	for (const name of ["is_in_range", "can_attack"])
		vm.runInContext(definition(read("js/runner_functions.js"), name), context);
	context.character = { x: 0, y: 0, awidth: 26, aheight: 35, range: 30, s: {} };
	context.parent = { is_disabled: context.is_disabled, next_skill: { attack: new Date(0) } };
	return context;
}
// Independent oracle: the server's original initialization, before extraction.
function previousDimensions(g, type) {
	let [width, height] = g.dimensions[type] || [24, 24];
	if (g.monsters[type].size) {
		width = Math.round(width * g.monsters[type].size);
		height = Math.round(height * g.monsters[type].size);
	}
	return [width, height];
}
function spawn(c, type) {
	return c.new_monster("main", { type, stype: "pet", x: 70, y: 0 });
}
function client(type, x = 70, y = 0) {
	return { type: "monster", mtype: type, x, y, awidth: 60, aheight: 40, visible: true };
}

test("Tiny Crab: sprite bounds admit a 30-range attack, server combat bounds reject it at 51", () => {
	const c = harness();
	const crab = client("crab");
	const server = spawn(c, "crab");
	assert.deepEqual([server.width, server.height], [12, 12]);
	// Deterministic geometry fixture, not a claim of a synchronized live capture.
	assert.equal(c.distance(c.character, { ...crab, type: "sprite" }), 27);
	assert.equal(c.distance(c.character, crab), 51);
	assert.equal(c.distance(c.character, server), 51);
	assert.equal(c.is_in_range(crab), false);
	assert.equal(c.can_attack(crab), false);
	assert.equal(c.get_width(crab), 60);
	assert.equal(c.get_height(crab), 40);
});

test("horizontal, vertical, diagonal, touching and overlapping combat rectangles", () => {
	const c = harness();
	for (const [x, y, expected] of [
		[70, 0, 51],
		[-70, 0, 51],
		[0, 63, 51],
		[0, -86, 51],
		[49, 52, 50],
		[0, 0, 0],
		[19, 12, 0],
	]) {
		const monster = client("crab", x, y);
		assert.equal(c.distance(c.character, monster), expected);
		assert.equal(c.distance(monster, c.character), expected);
	}
	assert.equal(c.distance(client("crab", 0, 0), client("crab", 42, 52)), 50);
});

test("range boundaries, skill ranges, visibility, cooldown and disabled checks", () => {
	const c = harness();
	const crab = client("crab", 49);
	assert.equal(c.distance(c.character, crab), 30);
	assert.equal(c.is_in_range(crab), true);
	assert.equal(c.can_attack(crab), true);
	crab.x += 0.001;
	assert.equal(c.is_in_range(crab), false);
	assert.equal(c.can_attack(crab), false);
	crab.x = 49;
	crab.visible = false;
	assert.equal(c.is_in_range(crab), false);
	assert.equal(c.can_attack(crab), false);
	crab.visible = true;
	c.parent.next_skill.attack = new Date(8640000000000000);
	assert.equal(c.can_attack(crab), false);
	c.parent.next_skill.attack = new Date(0);
	c.character.s.stunned = {};
	assert.equal(c.can_attack(crab), false);
	c.character.s = {};
	c.G.skills = { fixed: { range: 30 }, multiplied: { range_multiplier: 2 }, bonus: { range_bonus: 21 } };
	assert.equal(c.is_in_range(crab, "fixed"), true);
	crab.x = 70;
	assert.equal(c.is_in_range(crab, "fixed"), false);
	assert.equal(c.is_in_range(crab, "multiplied"), true);
	assert.equal(c.is_in_range(crab, "bonus"), true);
});

test("all current monsters preserve actual server initialization and match client bounds", () => {
	const c = harness();
	for (const type of Object.keys(c.G.monsters)) {
		const expected = previousDimensions(c.G, type);
		const monster = spawn(c, type);
		assert.deepEqual([monster.width, monster.height], expected, type);
		assert.deepEqual(Array.from(c.get_monster_dimensions(type)), expected, type);
		const visual = { ...client(type), skin: c.G.monsters[type].skin, mscale: 3 };
		assert.equal(c.distance(c.character, visual), c.distance(c.character, monster), type);
		const base = { type, width: expected[0], height: expected[1] };
		c.set_base(base);
		assert.deepEqual(monster.base, base.base, type);
	}
});

test("explicit and missing dimensions, fractional rounding, enlarged sizes and skin aliases", () => {
	const c = harness();
	for (const [type, dimensions, size, expected] of [
		["explicit", [25, 31], undefined, [25, 31]],
		["fraction", [25, 31], 0.5, [13, 16]],
		["large", [25, 31], 3, [75, 93]],
		["fallback", undefined, undefined, [24, 24]],
		["smallFallback", undefined, 0.5, [12, 12]],
		["largeFallback", undefined, 3, [72, 72]],
		["zero", [25, 31], 0, [25, 31]],
	]) {
		c.G.monsters[type] = { hp: 100, size, skin: "crabx" };
		if (dimensions) c.G.dimensions[type] = dimensions;
		const monster = spawn(c, type);
		assert.deepEqual([monster.width, monster.height], expected);
		assert.equal(c.distance(c.character, client(type)), c.distance(c.character, monster));
	}
});

test("characters, NPCs, server entities, unknown monsters and coordinate fallbacks stay unchanged", () => {
	const c = harness();
	for (const entity of [
		{ type: "character", mtype: "crab", awidth: 60, aheight: 40 },
		{ type: "npc", mtype: "crab", width: 120, height: 80, mscale: 2 },
		{ type: "crab", is_monster: true, width: 60, height: 40 },
		{ type: "monster", mtype: "unknown", awidth: 60, aheight: 40 },
		{ type: "monster", mtype: "toString", awidth: 60, aheight: 40 },
		{ type: "monster", awidth: 60, aheight: 40 },
		{ proxy_character: true, awidth: 60, aheight: 40 },
	])
		assert.equal(c.distance(c.character, { ...entity, x: 70, y: 0 }), 27);
	assert.equal(c.distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
	assert.equal(c.distance({ x: 999, y: 999, real_x: 0, real_y: 0 }, { x: 3, y: 4 }), 5);
	assert.equal(c.distance(null, client("crab")), 99999999);
	assert.equal(c.distance({ ...c.character, map: "a" }, { ...client("crab"), map: "b" }), 99999999);
	assert.equal(c.distance({ ...c.character, in: "a" }, { ...client("crab"), in: "b" }), 99999999);
	assert.equal(
		c.distance({ ...c.character, map: "main", in: "main" }, { ...client("crab"), map: "main", in: "main" }),
		51,
	);
	assert.equal(c.distance({ ...c.character, map: "main", in: "main" }, client("crab")), 51);
});
