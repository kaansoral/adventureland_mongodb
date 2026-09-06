"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const rules = require("../logic/anniversary_event");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
const functions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("seasonal tick follows the manual switch, preserves other NPCs and excludes PvP", () => {
	const emitted = [],
		instance = { name: "main", map: "main", players: { Existing: { id: "Existing" } }, pmap: {}, npcs: 1 };
	const context = {
		G: {
			npcs: {
				anniversary_baker: {
					name: "Mira",
					skin: "jubchan",
					cx: { hat: "aniv2" },
					role: "anniversary_crafter",
				},
			},
			maps: { main: { name: "Town", seasonal_npcs: [{ id: "anniversary_baker", position: [64, -88] }] } },
		},
		anniversary_rules: rules,
		events: { anniversary: false },
		options: {},
		is_pvp: false,
		region: "TEST",
		server_name: "I",
		add_condition() {},
		resend() {},
		distance() {},
		players: {},
		instances: { main: instance },
		npcs: {},
		NPC_prefix: "NPC-",
		false_socket: {},
		really_old: 0,
		E: { other_event: true },
		instance_emit: (...args) => emitted.push(args),
		broadcast() {},
		broadcast_e() {},
	};
	vm.createContext(context);
	for (const name of [
		"create_npc",
		"anniversary_is_active",
		"anniversary_reachable",
		"anniversary_state",
		"anniversary_tick",
	])
		vm.runInContext(definition(functions, name), context);
	context.anniversary_controller = null;
	context.anniversary_tick();
	assert.equal(instance.npcs, 1);
	assert.equal(context.E.anniversary, undefined);
	context.events.anniversary = true;
	context.anniversary_tick();
	context.anniversary_tick();
	assert.equal(instance.npcs, 2);
	assert.equal(context.npcs.anniversary_baker.id, "$Mira");
	assert.equal(context.npcs.anniversary_baker.skin, "jubchan");
	assert.deepEqual(plain(context.npcs.anniversary_baker.cx), { hat: "aniv2" });
	const mira = context.npcs.anniversary_baker;
	mira.skin = "old_skin";
	mira.cx = { hat: "gcandle" };
	mira.u = false;
	context.G.npcs.anniversary_baker = { ...context.G.npcs.anniversary_baker };
	context.anniversary_tick();
	context.anniversary_tick();
	assert.equal(context.npcs.anniversary_baker, mira, "reload updates the existing NPC without respawning it");
	assert.equal(instance.npcs, 2);
	assert.equal(mira.skin, "jubchan");
	assert.deepEqual(plain(mira.cx), { hat: "aniv2" });
	assert.equal(mira.u, true);
	assert.equal(mira.cid, 1, "one update is published per definition reload");
	context.events.anniversary = false;
	context.anniversary_tick();
	assert.equal(instance.npcs, 1);
	assert.equal(context.E.anniversary, undefined);
	context.events.anniversary = true;
	context.anniversary_tick();
	assert.equal(instance.npcs, 2);
	context.is_pvp = true;
	context.anniversary_tick();
	assert.equal(instance.npcs, 1);
	assert.equal(context.npcs.anniversary_baker, undefined);
	assert(instance.players.Existing);
	assert(context.E.other_event);
	assert.equal(emitted.at(-1)[1], "disappear");
	assert.equal(emitted.at(-1)[2].id, "$Mira");
});

test("reachability requires real map geometry, a public spawn and a clear bounded walk", () => {
	let clear = true,
		calls = 0;
	const context = {
		G: { maps: { main: { spawns: [[0, 0]] } }, geometry: { main: {} } },
		can_move: () => {
			calls++;
			return clear;
		},
	};
	vm.createContext(context);
	vm.runInContext(definition(functions, "anniversary_reachable"), context);
	const p = player("Host");
	assert(context.anniversary_reachable(p));
	clear = false;
	assert(!context.anniversary_reachable(p));
	clear = true;
	p.x = 601;
	assert(!context.anniversary_reachable(p));
	assert.equal(calls, 2);
	p.x = 0;
	delete context.G.geometry.main;
	assert(!context.anniversary_reachable(p));
});
function definition(text, name) {
	const start = text.indexOf(`function ${name}(`);
	assert(start >= 0, name);
	return text.slice(start, text.indexOf("\nfunction ", start + 1));
}
function player(id, extra = {}) {
	return {
		id,
		name: id,
		owner: `owner-${id}`,
		socket: { emit() {} },
		hp: 100,
		mp: 100,
		map: "main",
		in: "main",
		x: 0,
		y: 0,
		level: 20,
		age: 2,
		s: {},
		hitchhikers: [],
		cid: 1,
		...extra,
	};
}
function eventHarness(extra = {}) {
	let time = rules.INTERVAL - 1,
		enabled = true;
	const host = player("Host"),
		visitor = player("Visitor"),
		delivered = [];
	const roster = [host, visitor];
	const event = rules.createEvent({
		now: () => time,
		random: () => 0,
		players: () => roster,
		active: () => enabled,
		reachable: (p) => !p.blocked,
		realm: "TEST I",
		addCondition: (p, name, args) => {
			p.s[name] = { ms: args.duration };
		},
		resend() {},
		distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		...extra,
	});
	return {
		event,
		host,
		visitor,
		roster,
		delivered,
		deliver: (p, items) => delivered.push([p.id, items]),
		time: (v) => (time = v),
		enabled: (v) => (enabled = v),
		start() {
			time = rules.INTERVAL;
			return event.tick();
		},
	};
}

test("account flavor is deterministic, bounded and independent of character or realm", () => {
	assert.equal(rules.sliceForAccount("account"), rules.sliceForAccount("account"));
	assert.equal(rules.sliceForAccount(""), null);
	assert.equal(rules.sliceForAccount({ id: "account" }), null);
	const counts = new Map(rules.SLICES.map((id) => [id, 0]));
	for (let i = 0; i < 6000; i++) {
		const id = rules.sliceForAccount(`account-${i}`);
		assert(counts.has(id));
		counts.set(id, counts.get(id) + 1);
	}
	for (const count of counts.values()) assert(count > 850 && count < 1150);
});
test("anniversary defaults on and has no automatic date cutoff or reactivation", () => {
	const start = source.indexOf("var events = {");
	assert(start >= 0);
	const context = { is_pvp: false };
	vm.createContext(context);
	vm.runInContext(source.slice(start, source.indexOf("\n};", start) + 3), context);
	vm.runInContext(definition(functions, "anniversary_is_active"), context);
	assert.equal(context.anniversary_is_active(), true, "no launch-date configuration is needed");
	context.options = { anniversary: { starts_at: "2000-01-01", ends_at: "2000-01-15" } };
	assert.equal(context.anniversary_is_active(), true, "old dates cannot end the event");
	context.events.anniversary = false;
	context.options.anniversary = { starts_at: "2000-01-01", ends_at: "2999-01-01" };
	assert.equal(context.anniversary_is_active(), false, "dates cannot override a manual stop");
	const design = vm.createContext({});
	vm.runInContext(fs.readFileSync(path.join(root, "design/events.js"), "utf8"), design);
	assert.equal(design.events.anniversary.duration, undefined);
	assert.doesNotMatch(definition(functions, "anniversary_is_active"), /Date|options|inEventWindow/);
});
test("kill rolls use contribution once and ignore loot multipliers", () => {
	const monster = { xp: 10, max_hp: 100, luck: 100000, mult: 100000 };
	assert.deepEqual(
		rules.monsterRewards("account", monster, 1, () => 0),
		[rules.sliceForAccount("account"), "anniversarygift"],
	);
	assert.deepEqual(
		rules.monsterRewards("account", monster, 0.5, () => 0.00011),
		["anniversarygift"],
	);
	assert.deepEqual(
		rules.monsterRewards("account", monster, 100, () => 0.001),
		[],
	);
	assert.deepEqual(
		rules.monsterRewards("account", monster, 1, () => 0.0002),
		["anniversarygift"],
	);
	for (const patch of [
		{ pet: true },
		{ trap: true },
		{ summoned: true },
		{ npc: true },
		{ "1hp": true },
		{ max_hp: 1 },
		{ difficulty: 0 },
		{ xp: 0 },
	])
		assert.deepEqual(
			rules.monsterRewards("account", { ...monster, ...patch }, 1, () => 0),
			[],
		);
	for (const share of [0, -1, NaN, Infinity])
		assert.deepEqual(
			rules.monsterRewards("account", monster, share, () => 0),
			[],
		);
});
test("no partial round replay; selection, expiry and shutdown are bounded", () => {
	const h = eventHarness();
	assert.equal(h.event.tick().live, false);
	assert.equal(h.start().target, "Host");
	h.time(rules.INTERVAL + rules.WINDOW);
	assert.equal(h.event.tick().live, false);
	assert.equal(h.event.isTarget(h.host), false);
	h.enabled(false);
	assert.equal(h.event.tick(), null);
	h.enabled(true);
	assert.equal(h.event.tick().live, false);
});

test("every other connected character gets one ticket at selection, including AFK and same-account characters", () => {
	const h = eventHarness();
	const afk = player("Away", { afk: true }),
		dead = player("Dead", { rip: true, hp: 0 }),
		instance = player("Instance", { in: "private-instance" }),
		sameAccount = player("Sibling", { owner: h.host.owner }),
		disconnected = player("Disconnected", { dc: true }),
		npc = player("NPC", { npc: true });
	h.roster.push(afk, dead, instance, sameAccount, disconnected, npc);
	h.start();
	for (const p of [h.visitor, afk, dead, instance, sameAccount]) {
		assert.equal(p.s.anniversary_visit.ms, rules.WINDOW);
		assert.equal(p.s.anniversary_visit.realm, "TEST I");
		assert.equal(p.s.anniversary_visit.expires, rules.INTERVAL + rules.WINDOW);
		assert(h.event.canVisit(p));
	}
	for (const p of [h.host, disconnected, npc]) assert.equal(p.s.anniversary_visit, undefined);
	const late = player("Late");
	h.roster.push(late);
	h.event.tick();
	assert.equal(late.s.anniversary_visit, undefined);
	assert(!h.event.claim(late, h.host, h.deliver));
	assert(h.event.claim(sameAccount, h.host, h.deliver));
	assert.equal(sameAccount.s.anniversary_visit, undefined);
});

test("the five-minute deadline begins at actual selection and every ticket holder can claim", () => {
	const h = eventHarness();
	h.host.afk = h.visitor.afk = true;
	assert.equal(h.start().live, false);
	const selectedAt = rules.INTERVAL + 120000;
	h.time(selectedAt);
	h.host.afk = false;
	const visitors = Array.from({ length: 50 }, (_, i) => player("Guest" + i));
	h.roster.push(...visitors);
	assert.equal(h.event.tick().expires, selectedAt + rules.WINDOW);
	h.time(selectedAt + rules.WINDOW - 1);
	for (const p of visitors) {
		assert(h.event.claim(p, h.host, h.deliver));
		assert.equal(p.s.anniversary_visit, undefined);
		assert(!h.event.claim(p, h.host, h.deliver));
	}
	assert.equal(h.delivered.length, 51, "fifty visitor rewards and one host reward");
	h.time(selectedAt + rules.WINDOW);
	assert(!h.event.claim(h.visitor, h.host, h.deliver));
	assert.equal(h.event.tick().live, false);
	assert.equal(h.visitor.s.anniversary_visit, undefined);
});

test("retargeting, reconnecting and changing realms cannot reissue or replay a ticket", () => {
	const h = eventHarness();
	const waiting = player("Waiting", { afk: true });
	h.roster.push(waiting);
	const expires = h.start().expires;
	const used = { ...h.visitor.s.anniversary_visit };
	assert(h.event.claim(h.visitor, h.host, h.deliver));
	h.visitor.s.anniversary_visit = used; // A stale reconnect snapshot must not revive a consumed invitation.
	assert(!h.event.claim(h.visitor, h.host, h.deliver));
	h.event.tick();
	assert.equal(h.visitor.s.anniversary_visit, undefined);
	const replacement = player("Replacement");
	h.roster.push(replacement);
	h.host.afk = h.visitor.afk = true;
	h.time(rules.INTERVAL + 60000);
	assert.equal(h.event.tick().target, "Replacement");
	assert.equal(h.event.tick().expires, expires);
	assert.equal(waiting.s.anniversary_visit.ms, rules.WINDOW - 60000);
	assert.equal(replacement.s.anniversary_visit, undefined);
	waiting.s.anniversary_visit.realm = "TEST II";
	assert(!h.event.claim(waiting, replacement, h.deliver));
	h.event.tick();
	assert.equal(waiting.s.anniversary_visit, undefined);
});

test("normal condition insertion and removal synchronize the client and do not change combat stats", () => {
	const definitionContext = {};
	vm.createContext(definitionContext);
	vm.runInContext(fs.readFileSync(path.join(root, "design/conditions.js"), "utf8"), definitionContext);
	const context = { G: { conditions: definitionContext.conditions }, max: Math.max, min: Math.min, server_log() {} };
	vm.createContext(context);
	vm.runInContext(definition(functions, "add_condition"), context);
	vm.runInContext(definition(functions, "decay_s"), context);
	const sync = [];
	const h = eventHarness({ addCondition: context.add_condition, resend: (p, flags) => sync.push([p.id, flags]) });
	h.visitor.s.anniversary_visit = { ms: 3600000 };
	h.visitor.s.poisonous = { ms: 5000 };
	h.start();
	const condition = definitionContext.conditions.anniversary_visit;
	assert.equal(condition.ui, true);
	assert.equal(condition.duration, rules.WINDOW);
	assert.equal(condition.skin, "emote_ikissyou");
	assert.equal(condition.buff, undefined);
	assert.equal(condition.debuff, undefined);
	assert.equal(h.visitor.s.anniversary_visit.ms, rules.WINDOW, "old duration cannot extend a new ticket");
	assert.equal(h.visitor.hitchhikers.at(-1)[1].name, "anniversary_visit");
	assert.equal(h.visitor.hitchhikers.at(-1)[1].duration, rules.WINDOW);
	h.visitor.s.anniversary_visit.ms = 45000;
	context.decay_s(h.visitor, 30000);
	assert.equal(h.visitor.s.anniversary_visit.ms, 45000, "blink cannot shorten the invitation");
	assert(h.event.claim(h.visitor, h.host, h.deliver));
	assert.equal(h.visitor.s.anniversary_visit, undefined);
	assert(sync.filter(([id]) => id === h.visitor.id).length >= 2);
	h.time(2 * rules.INTERVAL);
	h.event.tick();
	h.enabled(false);
	h.event.tick();
	assert(h.roster.every((p) => !p.s.anniversary_visit));
});
test("AFK strings, dead players, instances and inaccessible terrain never host", () => {
	for (const patch of [
		{ afk: true },
		{ afk: "bot" },
		{ afk: "code" },
		{ rip: true },
		{ dead: true },
		{ hp: 0 },
		{ npc: true },
		{ socket: null },
		{ disconnected: true },
		{ dc: true },
		{ socket: { disconnected: true } },
		{ socket: { connected: false } },
		{ stealth: true },
		{ s: { invis: {} } },
		{ in: "main-123" },
		{ map: "bank", in: "bank" },
		{ blocked: true },
	]) {
		const h = eventHarness();
		h.roster.splice(1);
		Object.assign(h.host, patch);
		assert.equal(h.start().live, false, JSON.stringify(patch));
	}
});
test("newer lower-level hosts receive four lottery tickets, not exclusive selection", () => {
	const h = eventHarness({ random: () => 0.6 });
	h.roster.splice(1);
	h.host.age = 500;
	h.roster.push(player("Newcomer"));
	assert.equal(h.start().target, "Newcomer");
});
test("first kiss guarantees own flavor and Gift; repeats, reconnects and retargeting cannot duplicate", () => {
	const h = eventHarness();
	const second = player("Second", { owner: h.visitor.owner });
	h.roster.push(second);
	h.start();
	assert(h.event.claim(h.visitor, h.host, h.deliver));
	assert.deepEqual(h.delivered, [
		["Visitor", [rules.sliceForAccount(h.visitor.owner), "anniversarygift"]],
		["Host", ["anniversarygift"]],
	]);
	assert(!h.event.claim({ ...h.visitor }, h.host, h.deliver));
	assert(h.event.claim(second, h.host, h.deliver));
	assert.equal(h.delivered[2][1][0], h.delivered[0][1][0]);
	assert.equal(h.delivered.length, 3, "host receives only one Gift");
	h.host.afk = true;
	h.visitor.afk = second.afk = true;
	const replacement = player("Replacement");
	h.roster.push(replacement);
	assert.equal(h.event.tick().target, "Replacement");
	assert(!h.event.claim(h.visitor, replacement, h.deliver));
	h.time(2 * rules.INTERVAL);
	h.event.tick();
	assert(h.event.claim(h.visitor, replacement, h.deliver));
});
test("wrong host, dead visitors and out-of-range kisses earn nothing", () => {
	for (const patch of [
		{ id: "Host" },
		{ x: 81 },
		{ map: "winterland" },
		{ in: "other" },
		{ hp: 0 },
		{ npc: true },
		{ rip: true },
	]) {
		const h = eventHarness();
		h.start();
		Object.assign(h.visitor, patch);
		assert(!h.event.claim(h.visitor, h.host, h.deliver));
		assert.equal(h.delivered.length, 0);
	}
	const h = eventHarness();
	h.start();
	assert(!h.event.claim(h.visitor, player("Other"), h.deliver));
});
test("craft plan combines partial stacks, excludes protected items, and never mutates inventory", () => {
	const p = {
		gold: 100,
		items: [
			{ name: "cake", q: 2 },
			{ name: "cake", q: 3 },
			{ name: "cake", q: 100, l: "l" },
			{ name: "cake", q: 100, b: true },
			{ name: "cake", q: 100, giveaway: true },
			{ name: "amulet", level: 1 },
			{ name: "amulet", level: 0 },
		],
	};
	const before = structuredClone(p),
		recipe = {
			cost: 100,
			items: [
				[4, "cake"],
				[1, "cake"],
				[1, "amulet", 0],
			],
		};
	assert.deepEqual(rules.planCraft(p, recipe), {
		cost: 100,
		take: [
			[0, 2],
			[1, 3],
			[6, 1],
		],
	});
	assert.deepEqual(p, before);
	assert.equal(rules.planCraft(p, { ...recipe, cost: 101 }).error, "gold_not_enough");
	assert.equal(rules.planCraft(p, { cost: 1, items: [[6, "cake"]] }).error, "craft_cant_quantity");
	assert.equal(rules.planCraft(p, { cost: 1, items: [[-1, "cake"]] }).error, "craft_cant");
});

function craftHarness() {
	const emitted = [],
		failures = [];
	const p = player("Crafter", {
		gold: 100,
		items: [{ name: "slice", q: 1 }],
		socket: { emit: (...args) => emitted.push(args) },
	});
	const context = {
		anniversary_rules: rules,
		G: {
			craft: {
				cake: { quest: "anniversary_baker", cost: 100, items: [[1, "slice"]] },
				jar: {
					quest: "anniversary_baker",
					cost: 100,
					items: [[1, "slice"]],
					output: { name: "cxjar", data: "makeawish" },
				},
			},
		},
		npcs: { anniversary_baker: player("Mira") },
		B: { sell_dist: 100 },
		anniversary_is_active: () => true,
		distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		create_new_item: (name) => ({ name }),
		can_add_item: () => false,
		consume: (p, index, count) => {
			if ((p.items[index].q || 1) === count) p.items[index] = null;
			else p.items[index].q -= count;
		},
		add_item: (p, item) => {
			const index = p.items.indexOf(null);
			assert(index >= 0);
			p.items[index] = item;
			return index;
		},
		resend() {},
		success_response: (...args) => emitted.push(args),
		fail_response: (...args) => failures.push(args),
	};
	vm.createContext(context);
	vm.runInContext(definition(functions, "anniversary_craft"), context);
	return { p, context, emitted, failures, craft: (name) => context.anniversary_craft(p, name) };
}
test("trusted crafting frees consumed slots and preserves CX Jar data", () => {
	const h = craftHarness();
	h.craft("jar");
	assert.equal(h.p.gold, 0);
	assert.deepEqual(plain(h.p.items), [{ name: "cxjar", data: "makeawish" }]);
	assert.equal(h.failures.length, 0);
	assert.equal(h.emitted.at(-1)[1], "craft");
});
test("craft failures cannot consume gold or ingredients", () => {
	for (const alter of [
		(h) => (h.context.anniversary_is_active = () => false),
		(h) => (h.p.x = 101),
		(h) => (h.p.gold = 99),
		(h) => (h.p.items[0].l = "l"),
		(h) => (h.p.items[0].q = 2),
		(h) => (h.p.rip = true),
	]) {
		const h = craftHarness();
		alter(h);
		const before = plain({ gold: h.p.gold, items: h.p.items });
		h.craft("cake");
		assert.equal(h.failures.length, 1);
		assert.deepEqual(plain({ gold: h.p.gold, items: h.p.items }), before);
	}
	const h = craftHarness();
	h.craft("__proto__");
	assert.equal(h.failures.length, 1);
	h.p.computer = true;
	h.p.x = 1000;
	h.craft("cake");
	assert.equal(h.p.gold, 0, "existing remote-computer crafting remains available");
});

function exchangeHarness(rolls) {
	const items = [],
		ctx = {
			D: {
				drops: { sixcake: [[1, "open", "equipment"]], equipment: [[1, "bow"]], gift: [[1, "cxjar", 1, "ikissyou"]] },
			},
			G: { items: { bow: {} } },
			Math: Object.assign(Object.create(Math), { random: () => rolls.shift() ?? 0.5 }),
			is_array: Array.isArray,
			create_new_item: (name, q) => ({ name, ...(q ? { q } : {}) }),
			add_item: (p, item) => items.push(item),
			item_to_phrase: (item) => item.name,
			colors: { server_success: "white" },
		};
	vm.createContext(ctx);
	for (const name of ["exchange", "chest_exchange"]) vm.runInContext(definition(functions, name), ctx);
	return { ctx, items, p: player("Opener"), chest: { items: [], gold: 0, cash: 0 } };
}
test("both exchange paths preserve jars and add cake bonuses without replacing gear", () => {
	for (const chest of [false, true]) {
		let h = exchangeHarness([0.5, 0.5, 0]);
		if (chest) h.ctx.chest_exchange(h.chest, "sixcake");
		else h.ctx.exchange(h.p, "sixcake");
		assert.deepEqual(plain(chest ? h.chest.items : h.items), [
			{ name: "bow" },
			{ name: "anniversarygift", q: 3 },
			{ name: "cxjar", q: 1, data: "ikissyou" },
		]);
		h = exchangeHarness([0.5]);
		if (chest) h.ctx.chest_exchange(h.chest, "gift");
		else h.ctx.exchange(h.p, "gift");
		assert.deepEqual(plain(chest ? h.chest.items : h.items), [{ name: "cxjar", q: 1, data: "ikissyou" }]);
	}
});

function skillHarness() {
	const emitted = [],
		failed = [];
	let handler;
	const socket = { id: "visitor", emit: (...args) => emitted.push(args), on: (name, fn) => (handler = fn) };
	const h = eventHarness();
	h.start();
	Object.assign(h.visitor, { socket, p: { acx: {} }, last: {}, a: {}, slots: {}, type: "mage", attack_ms: 1000 });
	const ctx = {
		G: {
			skills: {
				attack: {},
				ikissyou: { emote: "ikissyou", mp: 0, range: 80, cooldown: 10000, target: "player", no_self: true },
				highfive: { emote: "highfive", target: "player" },
				makeawish: { emote: "makeawish", mp: 50, cooldown: 240000 },
			},
		},
		socket,
		players: { visitor: h.visitor, host: h.host },
		id_to_id: { Host: "host" },
		instances: { main: { monsters: {} } },
		B: { max_vision: 1000 },
		mode: {},
		now: 10000,
		server_log() {},
		is_disabled: () => false,
		is_silenced: () => false,
		is_invis: () => false,
		is_array: Array.isArray,
		in_arr: (v, a) => a.includes(v),
		distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		mssince: (t) => ctx.now - t,
		future_ms: () => ctx.now,
		anniversary_state: () => h.event,
		anniversary_deliver: h.deliver,
		random_one: (a) => a[0],
		xy_emit: (p, ...args) => emitted.push(args),
		fail_response: (reason) => failed.push(reason),
		consume_mp: (p, mp) => (p.mp -= mp),
		consume_skill: (p, name) => (p.last[name] = ctx.now),
	};
	ctx.G.maps = { main: {} };
	ctx.resend = () => {};
	vm.createContext(ctx);
	const start = source.indexOf('socket.on("skill",');
	vm.runInContext(source.slice(start, source.indexOf('socket.on("click",', start)), ctx);
	return { ...h, ctx, emitted, failed, cast: (name = "ikissyou", id = "Host") => handler({ name, id }) };
}
test("real socket handler grants only the current host's temporary kiss and honors cooldown", () => {
	const h = skillHarness();
	h.cast();
	assert.deepEqual(h.failed, []);
	assert.equal(h.delivered.length, 2);
	assert.equal(h.visitor.mp, 100);
	h.cast();
	assert.equal(h.failed.at(-1), "skill_cant_use", "the temporary permission is consumed with the ticket");
	assert.equal(h.delivered.length, 2);
	h.visitor.p.acx.ikissyou = 1;
	h.cast();
	assert.equal(h.failed.at(-1), "cooldown", "permanent emotes retain the regular cooldown");
	h.ctx.now += 10000;
	h.cast();
	assert.equal(h.delivered.length, 2);
});
test("unlock, target, friendship and permanent cosmetic access remain separate", () => {
	for (const patch of [{ x: 81 }, { npc: true }, { rip: true }, { hp: 0 }, { map: "winterland" }, { in: "other" }]) {
		const h = skillHarness();
		h.visitor.p.acx.ikissyou = 1;
		Object.assign(h.host, patch);
		h.cast();
		assert.equal(h.failed.length, 1);
		assert.equal(h.delivered.length, 0);
		assert.equal(h.visitor.last.ikissyou, undefined);
	}
	let h = skillHarness();
	h.enabled(false);
	h.cast();
	assert.equal(h.failed.at(-1), "skill_cant_use");
	h = skillHarness();
	h.enabled(false);
	h.visitor.p.acx.ikissyou = 1;
	h.cast();
	assert.equal(h.failed.length, 0);
	assert.equal(h.delivered.length, 0);
	h = skillHarness();
	h.visitor.p.acx.highfive = 1;
	h.cast("highfive");
	assert.equal(h.failed.at(-1), "non_friendly_target");
	h = skillHarness();
	h.visitor.p.acx.makeawish = 1;
	h.cast("makeawish");
	assert.equal(h.visitor.mp, 50);
	h.ctx.now += 239999;
	h.cast("makeawish");
	assert.equal(h.failed.at(-1), "cooldown");
});
