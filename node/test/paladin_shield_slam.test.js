"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const G = require("./helpers/design");
const source = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
const functions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");

function definition(text, name) {
	const start = text.indexOf(`function ${name}(`);
	assert.ok(start >= 0, name);
	return text.slice(start, text.indexOf("\nfunction ", start + 1));
}

function harness() {
	const events = [];
	let handler;
	const socket = {
		id: "test",
		emit: (name, data) => events.push({ name, data }),
		on: (name, fn) => {
			handler = fn;
		},
	};
	const context = {
		G: JSON.parse(JSON.stringify(G, (key, value) => (key === "G" || key === "global" ? undefined : value))),
		Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
		socket,
		players: {},
		instances: { main: { monsters: {}, players: {} } },
		id_to_id: {},
		mode: {},
		B: { max_vision: 1000 },
		projectiles: {},
		now: 10000,
		is_disabled: () => false,
		is_silenced: () => false,
		is_invis: () => false,
		is_in_pvp: () => false,
		is_array: Array.isArray,
		in_arr: (value, array) => array.includes(value),
		min: Math.min,
		max: Math.max,
		abs: Math.abs,
		distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		future_ms: (ms = 0) => context.now + ms,
		mssince: (time) => context.now - time,
		randomStr: () => String(Object.keys(context.projectiles).length + 1),
		server_log() {},
		direction_logic() {},
		step_out_of_invis() {},
		resend() {},
		projectiles_loop() {},
		xy_emit: (entity, name, data) => events.push({ name, data }),
		fail_response: (response, place) => events.push({ name: "failure", data: { response, place } }),
	};
	vm.createContext(context);
	for (const name of ["skill_offhand_matches", "commence_attack"]) vm.runInContext(definition(source, name), context);
	for (const name of ["consume_mp", "consume_skill"]) vm.runInContext(definition(functions, name), context);
	const start = source.indexOf('socket.on("skill",');
	vm.runInContext(source.slice(start, source.indexOf('socket.on("click",', start)), context);
	const player = {
		id: "Paladin",
		name: "Paladin",
		type: "paladin",
		is_player: true,
		level: 60,
		hp: 10000,
		mp: 10000,
		max_mp: 10000,
		attack: 1000,
		armor: 500,
		attack_ms: 1000,
		slots: { offhand: { name: "shield" } },
		s: {},
		a: {},
		p: {},
		last: {},
		socket,
		x: 0,
		y: 0,
		map: "main",
		in: "main",
		range: 80,
		xrange: 0,
	};
	const target = {
		id: 1,
		type: "goo",
		is_monster: true,
		hp: 100000,
		x: 30,
		y: 0,
		m: 1,
		map: "main",
		in: "main",
		s: {},
	};
	context.players.test = player;
	context.instances.main.monsters[1] = target;
	return { context, player, target, events, cast: (data = {}) => handler({ name: "shield_slam", id: 1, ...data }) };
}

test("Shield Slam uses the normal socket, MP, cooldown and projectile path", () => {
	const h = harness();
	h.cast();
	assert.equal(h.player.mp, 8000);
	assert.equal(h.player.last.shield_slam, 10000);
	assert.equal(h.player.last.smash, undefined);
	const hit = h.context.projectiles[1];
	assert.equal(hit.attack, 9000);
	assert.equal(hit.damage_type, "physical");
	assert.equal(hit.def.projectile, "shield_slam");
	assert.equal(hit.action.eta, Math.floor(30000 / 420));
	assert.deepEqual(JSON.parse(JSON.stringify(hit.action.shield)), { name: "shield", level: 0 });
	h.player.slots.offhand = { name: "dawnwardaegis", level: 10 };
	assert.equal(hit.action.shield.name, "shield", "the cast snapshot survives equipment changes");
	h.cast();
	assert.equal(h.events.at(-1).data.response, "cooldown");
	assert.equal(h.player.mp, 8000);
	h.context.now += 600;
	h.cast();
	assert.equal(h.player.mp, 6000);
	assert.equal(Object.keys(h.context.projectiles).length, 2);
});

test("rejected Shield Slams spend neither MP nor cooldown", () => {
	for (const [reason, mutate, request] of [
		["no_level", (h) => (h.player.level = 59)],
		["no_mp", (h) => (h.player.mp = 1999)],
		["skill_cant_use", (h) => (h.player.type = "rogue")],
		["skill_cant_slot", (h) => (h.player.slots.offhand = null)],
		["skill_cant_slot", (h) => (h.player.slots.offhand = { name: "not_an_item" })],
		["too_far", (h) => (h.target.x = 100)],
		["skill_cant_safe", (h) => (h.context.G.maps.main.safe = true)],
		["no_target", () => {}, { id: null }],
	]) {
		const h = harness();
		mutate(h);
		const mp = h.player.mp;
		h.cast(request);
		assert.equal(h.events.at(-1).data.response, reason);
		assert.equal(h.player.mp, mp, reason);
		assert.equal(h.player.last.shield_slam, undefined, reason);
		assert.equal(Object.keys(h.context.projectiles).length, 0);
	}
});

test("all true shields qualify; every source and miscellaneous offhand is rejected", () => {
	for (const [name, item] of Object.entries(G.items)) {
		if (!["shield", "source", "misc_offhand"].includes(item.type)) continue;
		const h = harness();
		h.player.slots.offhand = { name };
		h.cast();
		assert.equal(Object.keys(h.context.projectiles).length, item.type === "shield" ? 1 : 0, name);
		if (item.type !== "shield") {
			assert.equal(h.player.mp, 10000, name);
			assert.equal(h.player.last.shield_slam, undefined, name);
			assert.equal(h.context.commence_attack(h.player, h.target, "shield_slam").reason, "skill_cant_slot");
		}
	}
});

test("Shield Slam cannot damage non-PvP players or same-party PvP allies", () => {
	for (const pvp of [false, true]) {
		const h = harness();
		const ally = {
			...h.target,
			id: "Ally",
			name: "Ally",
			type: "warrior",
			is_monster: false,
			is_player: true,
			party: "P",
		};
		h.player.party = "P";
		h.context.players.ally = ally;
		h.context.id_to_id.Ally = "ally";
		h.context.is_in_pvp = () => pvp;
		h.cast({ id: "Ally" });
		assert.equal(Object.keys(h.context.projectiles).length, 0);
		assert.equal(h.player.mp, 10000);
		assert.equal(h.player.last.shield_slam, undefined);
	}
});

test("Shield Slam caps Armor, retains MP reduction and disables offensive procs", () => {
	for (const armor of [-100, 0, 500, 1000, 5000]) {
		const h = harness();
		Object.assign(h.player, {
			armor,
			mp_reduction: 10,
			crit: 100,
			critdamage: 1000,
			explosion: 100,
			blast: 100,
			lifesteal: 100,
			manasteal: 100,
			stun: 100,
		});
		h.player.a = { freeze: { attr0: 100 }, poison: { attr0: 100 }, burn: { attr0: 100 }, weave: {} };
		h.target.immune = true;
		h.cast();
		const hit = h.context.projectiles[1];
		assert.equal(hit.attack, 3000 + Math.min(Math.max(armor, 0), 1000) * 12);
		assert.equal(h.player.mp, 8200);
		assert.equal(hit.procs, false);
		assert.equal(hit.conditions.length, 0);
		for (const field of ["crit", "critdamage", "explosion", "blast", "lifesteal", "manasteal"])
			assert.equal(hit[field], undefined, field);
	}
});

test("Shield Slam visual chain resolves to the shipped melee sheets", () => {
	const skill = G.skills.shield_slam;
	assert.equal(skill.offhand_type, "shield");
	assert.equal(skill.skin, "skill_shield_slam");
	const projectile = G.projectiles[skill.projectile];
	assert.equal(projectile.animation, "slash");
	assert.equal(projectile.hit_animation, "slash2");
	for (const id of [projectile.animation, projectile.hit_animation]) {
		const animation = G.animations[id];
		assert.ok(animation.frames > 1);
		assert.ok(fs.existsSync(path.join(root, animation.file.split("?")[0])));
	}
});

test("Cleansing Light casts normally even when the friendly has nothing to cleanse", () => {
	const h = harness();
	Object.assign(h.context, {
		current_socket: h.context.socket,
		is_string: (value) => typeof value === "string",
		is_object: (value) => value !== null && typeof value === "object",
		is_same: () => true,
		add_pdps() {},
	});
	vm.runInContext(definition(functions, "fail_response"), h.context);
	const ally = {
		...h.target,
		id: "OathFriend",
		name: "OathFriend",
		type: "warrior",
		is_monster: false,
		is_player: true,
	};
	h.context.players.ally = ally;
	h.context.id_to_id.OathFriend = "ally";
	h.cast({ name: "cleansing_light", id: "OathFriend" });
	const result = h.events.at(-1);
	assert.equal(result.name, "game_response");
	assert.equal(result.data.success, true);
	assert.equal(result.data.cleansed.length, 0);
	assert.equal(h.player.mp, 9680);
	assert.equal(h.player.last.cleansing_light, h.context.now);
	assert.equal(h.events.filter((event) => event.name === "ui").length, 1);

	const client = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
	const start = client.indexOf('socket.on("game_response",');
	let receive;
	const logs = [],
		rejected = [];
	const context = {
		Dev: false,
		G: h.context.G,
		character: {},
		in_arr: (value, array) => array.includes(value),
		socket: {
			on: (name, callback) => {
				receive = callback;
			},
		},
		draw_trigger: (callback) => callback(),
		ui_log: (message) => logs.push(message),
		reject_deferred: (name, data) => rejected.push({ name, data }),
		resolve_deferred() {},
		tut() {},
	};
	vm.createContext(context);
	vm.runInContext(client.slice(start, client.indexOf("\n\tsocket.on(", start + 10)), context);
	receive(result.data);
	assert.deepEqual(logs, []);
	assert.deepEqual(rejected, []);
	h.cast({ name: "cleansing_light", id: "OathFriend" });
	assert.equal(h.events.at(-1).data.response, "cooldown");
	assert.equal(h.player.mp, 9680);

	h.context.now += G.skills.cleansing_light.cooldown;
	ally.s = { poisoned: { ms: 5000 }, penalty_cd: { ms: 3000 } };
	h.cast({ name: "cleansing_light", id: "OathFriend" });
	assert.equal(ally.s.poisoned, undefined);
	assert.ok(ally.s.penalty_cd);
	assert.equal(h.player.mp, 9360);
	assert.equal(h.player.last.cleansing_light, h.context.now);
	const visual = h.events.find((event) => event.name === "ui");
	assert.equal(visual.data.type, "cleansing_light");
	assert.equal(visual.data.targets[0], "OathFriend");
	assert.equal(h.events.filter((event) => event.name === "ui").length, 2);
});

test("Shield Slam lands through complete_attack with Armor, Fortitude, avoidance and no proc recovery", () => {
	for (const [armor, fortitude, avoidance] of [
		[0, 0, 0],
		[500, 0, 0],
		[500, 100, 0],
		[500, 100, 100],
	]) {
		const h = harness();
		Object.assign(h.context, {
			ceil: Math.ceil,
			floor: Math.floor,
			round: Math.round,
			damage_multiplier: G.damage_multiplier,
			point_distance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
			add_pdps() {},
			ccms() {},
			achievement_logic_monster_damage() {},
			is_same: () => false,
		});
		Object.assign(h.target, {
			armor,
			for: fortitude,
			avoidance,
			max_hp: 100000,
			hits: 0,
			last: {},
			a: {},
			points: {},
			target: h.player.name,
		});
		Object.assign(h.player, { max_hp: 20000, crit: 100, critdamage: 1000, lifesteal: 100, manasteal: 100 });
		vm.runInContext(
			source.slice(source.indexOf("function paladin_damage_mp("), source.indexOf("function target_player(")),
			h.context,
		);
		h.cast();
		const hit = h.context.projectiles[1];
		h.context.complete_attack(h.player, h.target, hit);
		const damage = avoidance ? 0 : Math.ceil(9000 * G.damage_multiplier(armor) * G.damage_multiplier(fortitude * 5));
		assert.equal(h.target.hp, 100000 - damage);
		assert.equal(h.player.hp, 10000);
		assert.equal(h.player.mp, 8000);
		const event = h.events.find((entry) => entry.name === "hit");
		assert.equal(event.data.damage, damage);
		assert.equal(event.data.crit, undefined);
	}
});
