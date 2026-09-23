"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read } = require("./helpers/server_vm");
const createAbilities = require("../logic/monster_abilities");

function harness() {
	let time = 10000;
	const players = Object.fromEntries(
		["A", "B", "C", "D"].map((name) => [
			name,
			{ id: name, name, is_player: true, map: "winter_cove", in: "winter_cove", x: 0, y: 0, s: {} },
		]),
	);
	const context = vm.createContext({
		G,
		Math,
		E: { schedule: {} },
		instances: {},
		round: Math.round,
		calculate_common_stats() {},
		recalculate_vxy() {},
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats(")), context);
	load(context, "node/server.js", ["apply_stats", "calculate_monster_stats"]);
	const shots = [];
	const abilities = createAbilities({
		get_game: () => G,
		get_player: (id) => players[id],
		distance: G.distance,
		is_disabled: G.is_disabled,
		is_invis: (p) => !!p.s.invis,
		is_invinc: (p) => !!p.s.invincible,
		add_condition: (m, name, options) => {
			m.s[name] = { ms: options.duration };
		},
		calculate_monster_stats: context.calculate_monster_stats,
		commence_attack: (m, p, skill) => {
			shots.push(p.name);
			return { events: [{ attacker: m.id, target: p.id, skill }] };
		},
		now: () => new Date(time),
	});
	const m = {
		id: "rime",
		cid: 1,
		type: "rimedjinn",
		hp: 320000,
		max_hp: 640000,
		target: "A",
		points: { A: 1, B: 30, C: 20 },
		map: "winter_cove",
		in: "winter_cove",
		x: 0,
		y: 0,
		s: {},
		last: {},
		map_def: {},
		level: 1,
	};
	return {
		m,
		players,
		shots,
		abilities,
		tick: () => abilities.tick(m, []),
		advance: (ms) => {
			time += ms;
		},
	};
}

test("Rime Shell interrupts ordinary attacks and breaks on net damage within three seconds", () => {
	const h = harness();
	h.tick();
	assert.equal(h.m.s.rimeshell.remaining, 32000);
	assert.equal(h.abilities.active(h.m), true);
	assert.equal(h.m.temp, undefined, "cast state must not disable respawns");
	assert.ok(h.m.u && h.m.cid > 1, "shell progress uses ordinary monster replication flags");
	h.abilities.damage(h.m, h.players.A, 31999);
	assert.equal(h.m.s.rimeshell.remaining, 1);
	h.abilities.damage(h.m, { is_player: true, npc: true }, 100);
	assert.equal(h.m.s.rimeshell.remaining, 1);
	h.abilities.damage(h.m, h.players.B, 1);
	assert.equal(h.m.s.rimeshell, undefined);
	assert.equal(h.m.s.rimeexposed.ms, 5000);
	assert.equal(h.m.resistance, 0, "the real stat path applies the resistance penalty");
	h.tick();
	assert.equal(h.m.s.rimeshell, undefined, "one cast per life");
});

test("expiry selects at most three eligible contributors and excludes a passerby", () => {
	const h = harness();
	h.tick();
	h.advance(3000);
	h.abilities.damage(h.m, h.players.A, 32000);
	assert.ok(h.m.s.rimeshell, "late damage cannot extend the break window");
	h.tick();
	assert.deepEqual(h.shots, ["A", "B", "C"]);
	assert.equal(h.m.s.rimeexposed, undefined);
	for (const mutate of [
		(h) => (h.players.B.s.invis = {}),
		(h) => (h.players.B.rip = true),
		(h) => (h.players.B.in = "other"),
		(h) => (h.players.B.x = 260),
	]) {
		const h = harness();
		h.tick();
		mutate(h);
		h.advance(3000);
		h.tick();
		assert.deepEqual(h.shots, ["A", "C"]);
	}
});

test("stun and deep freeze break the shell; ordinary freeze does not", () => {
	for (const condition of ["stunned", "deepfreezed", "frozen", "sleeping"]) {
		const h = harness();
		h.tick();
		h.m.s[condition] = { ms: 1000 };
		h.abilities.interrupt(h.m);
		if (condition === "frozen") assert.ok(h.m.s.rimeshell);
		else {
			assert.equal(h.m.s.rimeshell, undefined);
			assert.equal(!!h.m.s.rimeexposed, condition !== "sleeping");
		}
	}
});

test("target loss and death cancel without punishment or a free exposure", () => {
	for (const mutate of [(h) => (h.m.target = null), (h) => (h.m.hp = 0), (h) => (h.players.A.rip = true)]) {
		const h = harness();
		h.tick();
		mutate(h);
		h.tick();
		assert.equal(h.m.s.rimeshell, undefined);
		assert.equal(h.m.s.rimeexposed, undefined);
		assert.deepEqual(h.shots, []);
	}
});

test("Rime Shatter launches fixed 20,000 damage through the real attack handler", () => {
	const context = vm.createContext({
		G,
		Math,
		mode: {},
		projectiles: {},
		distance: G.distance,
		instance_is_frozen: () => false,
		cavalry_attack_valid: () => true,
		is_cavalry: () => false,
		is_invis: () => false,
		is_invinc: () => false,
		future_ms: (ms) => new Date(10000 + ms),
		randomStr: () => "shot",
		direction_logic() {},
		xy_emit() {},
	});
	load(context, "node/server.js", ["commence_attack"]);
	const monster = {
		...G.monsters.rimedjinn,
		id: "rime",
		type: "rimedjinn",
		is_monster: true,
		map: "winter_cove",
		in: "winter_cove",
		x: 0,
		y: 0,
		s: { poisonous: {} },
		a: {},
		last: {},
		crit: 100,
		lifesteal: 100,
	};
	const player = { id: "A", is_player: true, map: "winter_cove", in: "winter_cove", x: 100, y: 0 };
	for (const attack of [960, 9600]) {
		monster.attack = attack;
		const action = context.commence_attack(monster, player, "rimeshatter");
		assert.equal(action.damage, 20000);
		assert.equal(action.projectile, "rimeshatter");
		assert.equal(context.projectiles.shot.damage_type, "magical");
		assert.equal(context.projectiles.shot.procs, false);
		assert.equal(context.projectiles.shot.conditions.length, 0);
	}
	monster.attack = 960;
	assert.equal(context.commence_attack(monster, player, "attack").damage, 960);
	player.x = 260;
	assert.equal(context.commence_attack(monster, player, "rimeshatter").failed, true);
});

test("Cove Mantle's fixed map bonuses do not leak through cached item properties", () => {
	for (const level of [0, 6, 10]) {
		const item = { name: "covemantle", level, stat_type: "int" };
		const outside = G.calculate_item_properties(item, { map: "winter_cove", class: "mage" });
		const inside = G.calculate_item_properties(item, { map: "cave", class: "mage" });
		assert.equal(inside.attack - outside.attack, 240);
		assert.equal(inside.lifesteal - outside.lifesteal, 24);
		for (const map of ["main", "winter_cove"]) {
			const properties = G.calculate_item_properties(item, { map, class: "mage" });
			assert.equal(properties.attack, outside.attack);
			assert.equal(properties.lifesteal, outside.lifesteal);
		}
	}
});

test("Rime Shatter uses the native directional projectile renderer at twice the size", () => {
	const scales = [];
	const context = vm.createContext({
		G,
		no_graphics: false,
		player_layer: {},
		map_animations: {},
		map: { addChild() {} },
		new_sprite: () => ({ width: 20, height: 20, anchor: { set() {} }, scale: { set: (...args) => scales.push(args) } }),
	});
	load(context, "js/functions.js", ["map_animation"]);
	context.map_animation(G.projectiles.rimeshatter.animation, { id: "shatter" });
	assert.deepEqual(scales, [[2, 2]]);
	assert.equal(context.map_animations.shatter.directional, true);
	assert.equal(context.map_animations.shatter.speed, G.projectiles.rimeshatter.speed);
});

test("Rime visuals are harmless in the real no-graphics entry points", () => {
	const context = vm.createContext({ no_graphics: true });
	const blocked = () => {
		throw new Error("Graphics touched in no-graphics mode");
	};
	Object.defineProperty(context, "PIXI", { get: blocked });
	context.new_sprite = blocked;
	load(context, "js/functions.js", ["start_animation", "map_animation"]);
	load(context, "js/game.js", ["effects_logic"]);
	context.start_animation(null, "rimeshell_cast");
	context.map_animation("rimehelix_travel", {});
	context.map_animation("rimeshatter_travel", {});
	context.start_animation(null, "rimehelix_impact");
	context.effects_logic({ s: { rimeshell: { ms: 3000, remaining: 32000 } } });
	context.effects_logic({ s: { rimeexposed: { ms: 5000 } } });
});
