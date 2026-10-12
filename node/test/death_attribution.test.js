"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read, socketHandler } = require("./helpers/server_vm");
const G = require("./helpers/design");
const { DueQueue } = require("../logic/due_queue");
const plain = (v) => JSON.parse(JSON.stringify(v));

function fixture({ map = "arena", pvp = false, hp = 100, splash = false, mode = {} } = {}) {
	let now = 100000,
		serial = 0;
	class Clock extends Date {
		constructor(value) {
			super(value === undefined ? now : value);
		}
		static now() {
			return now;
		}
	}
	const packets = [];
	const emit = (who, event, data) => packets.push({ who, event, data: plain(data) });
	const c = vm.createContext({
		G,
		Date: Clock,
		Math: Object.assign(Object.create(Math), { random: () => 0.4 }),
		console,
		Map,
		Set,
		Dev: true,
		Place: "server",
		mode,
		gameplay: "normal",
		is_pvp: pvp,
		B: { max_vision: 1000, dps_tank_mult: 0.25, dps_heal_mult: 1.8, heal_multiplier: 1 },
		min: Math.min,
		max: Math.max,
		floor: Math.floor,
		ceil: Math.ceil,
		round: Math.round,
		abs: Math.abs,
		future_ms: (n = 0) => new Clock(now + n),
		mssince: (d) => now - +d,
		ssince: (d) => (now - +d) / 1000,
		players: {},
		name_to_id: {},
		id_to_id: {},
		parties: {},
		chests: {},
		pwns: [],
		pend: 0,
		npcs: { pvp: { id: "pvp", name: "PvP Guard" } },
		colors: { party_xp: "gray" },
		instances: {},
		projectiles: {},
		projectiles_due: new DueQueue(),
		randomStr: () => "fixture" + ++serial,
		damage_multiplier: G.damage_multiplier,
		distance: G.distance,
		point_distance: G.point_distance,
		is_disabled: G.is_disabled,
		is_silenced: G.is_silenced,
		to_pretty_num: String,
		simple_distance: G.simple_distance,
		msince: (d) => (now - +d) / 60000,
		can_add_item: G.can_add_item,
		can_add_items: G.can_add_items,
		can_stack: G.can_stack,
		item_p_ignore: {},
		a_score: {},
		W: { chest: {} },
		server_tax: (gold) => gold,
		encouragement_loot: () => ({}),
		xy_emit: (entity, event, data) => emit(entity && entity.id, event, data),
		instance_emit: (instance, event, data) => emit(instance, event, data),
		fail_response: (reason) => {
			throw Error("skill failed: " + reason);
		},
		log_trace: (name, error) => {
			throw error;
		},
		// Unrelated analytics, transport replication, and bookkeeping surfaces.
		add_pdps() {},
		add_coop_points() {},
		encouragement_points() {},
		encouragement_wound() {},
		encouragement_heal() {},
		achievement_logic_monster_hit() {},
		achievement_logic_monster_damage() {},
		achievement_logic_monster_last_hit() {},
		ccms() {},
		direction_logic() {},
		step_out_of_invis() {},
		resend() {},
		stop_pursuit() {},
		calculate_player_stats() {},
		market_patron_reset() {},
		remove_entity_emit() {},
		pmap_remove() {},
		pmap_add() {},
		resume_instance() {},
		add_call_cost() {},
		send_all_xy: () => ({}),
		setTimeout() {},
		send_party_update() {},
		safe_xy_nearby: (name, x, y) => ({ x, y }), // Geometry is not under investigation.
		target_player(m, p) {
			m.target = p.name;
		},
		level_monster() {
			throw Error("fixture XP unexpectedly levels monster");
		},
	});
	vm.runInContext(read("node/logic/instance_pause.js"), c);
	load(c, "node/server.js", [
		"commence_attack",
		"complete_attack",
		"projectiles_loop",
		"redirect_guardians_oath_damage",
		"issue_player_award",
		"pwn_routine",
		"defeated_by_a_monster",
		"drop_something_pvp",
		"transport_player_to",
		"add_item",
	]);
	load(c, "node/server_functions.js", [
		"consume_mp",
		"consume_skill",
		"get_player",
		"is_in_pvp",
		"is_invis",
		"is_same",
		"rip",
		"decay_s",
		"cache_item",
	]);
	const instance = (c.instances[map] = { map, name: map, players: {}, monsters: {}, pmap: {}, mount: true });
	function player(name, x = 0) {
		const p = {
			id: name,
			name,
			real_id: "CH_" + name,
			owner: "US_" + name,
			map,
			in: map,
			x,
			y: 0,
			m: 0,
			is_player: true,
			type: "mage",
			level: 75,
			hp,
			max_hp: 4919,
			mp: 5085,
			max_mp: 5085,
			attack: 1314,
			mp_cost: 10,
			attack_ms: 1000,
			range: 220,
			xrange: 0,
			armor: 103,
			resistance: 254,
			xp: 100000,
			max_xp: 1000000,
			gold: 14272374,
			kills: 0,
			pdps: 0,
			s: {},
			a: {},
			c: {},
			q: {},
			p: {},
			last: {},
			bets: {},
			hits: 0,
			cid: 0,
			isize: 42,
			esize: 42,
			goldm: 1,
			stealth: true,
			items: Array(42).fill(null),
			citems: Array(42).fill(null),
			slots: { mainhand: { name: splash ? "sparkstaff" : "staff", level: 4 } },
			cslots: {},
			hitchhikers: [],
			socket: { id: "socket:" + name, emit: (event, data) => emit(name, event, data) },
		};
		if (splash) p.blast = G.calculate_item_properties(p.slots.mainhand).blast;
		c.players[p.socket.id] = p;
		c.name_to_id[name] = p.socket.id;
		c.id_to_id[name] = p.socket.id;
		instance.players[name] = p;
		return p;
	}
	const p = player("Mage");
	const m = Object.assign({}, G.monsters.cgoo, {
		id: 1,
		type: "cgoo",
		is_monster: true,
		map,
		in: map,
		x: 50,
		y: 0,
		m: 0,
		s: {},
		a: {},
		last: {},
		points: {},
		hits: 0,
		cid: 0,
		hp: 2400,
		max_hp: 2400,
		outgoing: 0,
		level: 1,
		target: p.name,
	});
	instance.monsters[m.id] = m;
	c.socket = p.socket;
	const skill = socketHandler(c, "skill");
	const openChest = socketHandler(c, "open_chest");
	// Exact player-condition loop from update_instance, with no behavioral rewrite.
	const source = read("node/server.js");
	const start = source.indexOf("\t\tfor (var name in player.s) {", source.indexOf("function update_instance("));
	const end = source.indexOf("\n\t\tfor (var name in player.q)", start);
	assert.ok(start > 0 && end > start);
	vm.runInContext("function tick_conditions(player, ms) {\n" + source.slice(start, end) + "\n}", c);
	function advance(ms) {
		now += ms;
		c.projectiles_loop();
	}
	function blink(x = 1000) {
		skill({ name: "blink", x, y: 0 });
		assert.ok(p.s.blink, "real skill handler schedules Blink");
	}
	function completeBlink() {
		now += 200;
		c.tick_conditions(p, 200);
	}
	function attack(attacker, target) {
		const result = c.commence_attack(attacker, target, "attack");
		assert.ok(!result.failed, JSON.stringify(result));
		return result;
	}
	const state = () => ({
		hp: p.hp,
		rip: !!p.rip,
		xp: p.xp,
		gold: p.gold,
		x: p.x,
		block: plain(p.s.block || null),
		pwns: plain(c.pwns),
		monsterDeaths: packets.filter((x) => x.data?.response === "defeated_by_a_monster").map((x) => x.data),
		chests: Object.values(c.chests).map((x) => ({ pvp: x.pvp, items: plain(x.pvp_items) })),
	});
	return { c, p, m, packets, player, advance, blink, completeBlink, attack, state, openChest };
}

for (const pvp of [false, true]) {
	test(`self-splash keeps monster death penalties on ${pvp ? "a PvP realm" : "the Arena"}`, () => {
		const h = fixture({ map: pvp ? "level2s" : "arena", pvp, splash: true, hp: 500 });
		h.m.x = 150;
		h.attack(h.p, h.m);
		h.blink(150);
		h.completeBlink();
		h.advance(1000);
		assert.ok(h.p.hp > 0 && h.p.hp < 500, "self-damage still lands");
		assert.equal(h.p.s.block, undefined, "self-damage must not add a PvP opponent");
		h.attack(h.m, h.p);
		h.advance(200);
		assert.equal(h.p.rip, true);
		assert.equal(h.p.xp, pvp ? 99000 : 90000);
		assert.deepEqual(plain(h.c.pwns), []);
		assert.equal(h.state().monsterDeaths.length, 1);
	});
}

test("legacy self-tags cannot turn a monster death into PvP", () => {
	const h = fixture();
	h.p.s.block = { ms: 3600, f: h.p.name };
	h.attack(h.m, h.p);
	h.advance(200);
	assert.equal(h.p.rip, true);
	assert.equal(h.p.xp, 90000);
	assert.deepEqual(plain(h.c.pwns), []);
});

for (const dpvpblock of [false, true]) {
	test(`fatal self-splash has no self-credit or own-loot chest (double block: ${dpvpblock})`, () => {
		const h = fixture({ splash: true, mode: { dpvpblock } });
		h.p.items[0] = { name: "gem1", q: 19, v: new Date(0).toISOString() };
		h.p.c.channel = { ms: 10000 };
		h.p.x = h.m.x;
		h.attack(h.p, h.m);
		h.advance(200);
		assert.equal(h.p.rip, true);
		assert.equal(h.p.hp, 0);
		assert.equal(h.p.items[0].q, 19);
		assert.equal(h.p.s.block, undefined);
		assert.deepEqual(plain(h.p.c), {});
		assert.deepEqual(plain(h.c.chests), {});
		assert.deepEqual(plain(h.c.pwns), []);
		assert.equal(h.p.gold, 14272374);
		assert.equal(h.p.xp, 100000, "existing normal self-death balance is unchanged");
		assert.equal(
			h.packets.some((p) => p.event === "drop" || p.data?.phrase === "server.game_log.pwned"),
			false,
		);
	});
}

test("kill processing rejects the same character even across distinct session objects", () => {
	const h = fixture();
	const previousSession = { ...h.p };
	h.c.pwn_routine(previousSession, h.p);
	assert.equal(h.p.rip, true);
	assert.deepEqual(plain(h.c.pwns), []);
	assert.deepEqual(plain(h.c.chests), {});
});

test("nonfatal self-splash does not refresh an opponent's combat block", () => {
	const h = fixture({ splash: true, hp: 500, mode: { dpvpblock: true } });
	h.p.s.block = { ms: 250, f: "Opponent" };
	h.p.x = h.m.x;
	h.attack(h.p, h.m);
	h.advance(200);
	assert.deepEqual(plain(h.p.s.block), { ms: 250, f: "Opponent" });
});

test("an opponent retains credit when self-splash or a monster finishes the kill", () => {
	for (const finishingHit of ["self", "monster"]) {
		const h = fixture({ map: "level2s", pvp: true, splash: true, hp: finishingHit === "self" ? 200 : 600 });
		const enemy = h.player("Opponent");
		enemy.attack = 10;
		delete enemy.blast;
		h.attack(enemy, h.p);
		h.advance(200);
		assert.equal(h.p.s.block.f, enemy.name);
		h.p.x = h.m.x;
		h.attack(h.p, h.m);
		h.advance(200);
		if (finishingHit === "monster") {
			assert.ok(!h.p.rip);
			h.attack(h.m, h.p);
			h.advance(200);
		}
		assert.equal(h.p.rip, true);
		assert.equal(h.p.xp, 99000);
		assert.equal(h.p.gold, 13272374);
		assert.equal(enemy.gold, 15172374);
		assert.equal(enemy.xp, 100950);
		assert.deepEqual(plain(h.c.pwns), [[enemy.name, h.p.name]]);
	}
});

test("a legacy self-tag cannot steal credit from another same-account character", () => {
	const h = fixture({ map: "level2s", pvp: true });
	const ally = h.player("Ally", 50);
	ally.owner = h.p.owner;
	h.p.s.block = { ms: 3600, f: h.p.name };
	h.attack(ally, h.p);
	h.advance(200);
	assert.equal(h.p.rip, true);
	assert.equal(h.p.xp, 100000);
	assert.deepEqual(plain(h.c.pwns), [[ally.name, h.p.name]]);
});

test("a nonfatal player hit replaces legacy self-tags with the other character", () => {
	const h = fixture({ map: "level2s", pvp: true, mode: { dpvpblock: true } });
	const ally = h.player("Ally", 50);
	ally.owner = h.p.owner;
	ally.attack = 10;
	h.p.s.block = { ms: 3600, f: h.p.name };
	ally.s.block = { ms: 3600, f: ally.name };
	h.attack(ally, h.p);
	h.advance(200);
	assert.ok(h.p.hp > 0);
	assert.equal(h.p.s.block.f, ally.name);
	assert.equal(ally.s.block.f, h.p.name);
	h.attack(h.m, h.p);
	h.advance(200);
	assert.equal(h.p.rip, true);
	assert.equal(h.p.xp, 100000);
	assert.deepEqual(plain(h.c.pwns), [[ally.name, h.p.name]]);
});

for (const enemy of [false, true]) {
	test(`fatal ${enemy ? "player" : "monster"} hits during Blink keep their penalties`, () => {
		const h = fixture({ map: enemy ? "level2s" : "arena", pvp: enemy });
		const attacker = enemy ? h.player("Opponent", 50) : h.m;
		h.blink();
		h.attack(attacker, h.p);
		h.advance(160);
		assert.equal(h.p.rip, true);
		assert.equal(h.p.xp, enemy ? 99000 : 90000);
		h.completeBlink();
		assert.equal(h.p.rip, true);
		assert.equal(h.p.xp, enemy ? 99000 : 90000);
		if (enemy) assert.equal(attacker.gold, 15172374);
	});
	test(`Blink can still evade a ${enemy ? "player" : "monster"} projectile before it lands`, () => {
		const h = fixture({ map: enemy ? "level2s" : "arena", pvp: enemy });
		const attacker = enemy ? h.player("Opponent", 200) : h.m;
		attacker.x = 200;
		h.attack(attacker, h.p);
		h.blink();
		h.completeBlink();
		h.advance(1000);
		assert.equal(!!h.p.rip, false);
		assert.equal(h.p.hp, 100);
		assert.equal(h.p.xp, 100000);
		assert.ok(h.packets.some((p) => p.event === "hit" && p.data.avoid));
	});
}

test("Arena player kills retain safe-PvP penalties and real item drops", () => {
	const h = fixture();
	h.p.items[0] = { name: "gem1", q: 19, v: new Date(0).toISOString() };
	const enemy = h.player("Opponent", 50);
	h.attack(enemy, h.p);
	h.advance(200);
	assert.equal(h.p.rip, true);
	assert.equal(h.p.xp, 100000);
	assert.equal(h.p.gold, 14272374);
	assert.equal(h.p.items[0], null);
	const [chest] = Object.values(h.c.chests);
	assert.equal(chest.pvp_items[0].q, 19);
	assert.deepEqual(plain(h.c.pwns), [[enemy.name, h.p.name]]);
	assert.deepEqual(h.packets.find((p) => p.event === "drop").data.owners, [enemy.owner]);
});
