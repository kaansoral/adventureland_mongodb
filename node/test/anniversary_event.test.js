"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const rules = require("../logic/anniversary_event");
const { socketHandler, load, localize } = require("./helpers/server_vm");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
const functions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");
const shared = fs.readFileSync(path.join(root, "js/old_common_functions.js"), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const design = localize(vm.createContext({ console: { log() {} } }));
for (const name of ["multipliers", "conditions", "items", "npcs", "drops", "recipes"])
	vm.runInContext(fs.readFileSync(path.join(root, "design", name + ".js"), "utf8"), design, { filename: name });

test("seasonal tick follows the manual switch and keeps Mira available on PvP", () => {
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
	localize(vm.createContext(context));
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
	assert.equal(instance.npcs, 2);
	assert(context.npcs.anniversary_baker);
	assert.equal(context.E.anniversary.active, true);
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
		is_pvp: false,
		can_move: () => {
			calls++;
			return clear;
		},
	};
	localize(vm.createContext(context));
	vm.runInContext(definition(functions, "is_in_pvp"), context);
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
function pvpReachability() {
	const maps = require("./helpers/design").maps;
	const context = vm.createContext({
		G: { maps, geometry: Object.fromEntries(Object.keys(maps).map((map) => [map, {}])) },
		is_pvp: true,
		can_move: () => true,
	});
	for (const name of ["is_in_pvp", "anniversary_reachable"]) vm.runInContext(definition(functions, name), context);
	return context;
}
function moveToMap(p, map) {
	const [x, y] = require("./helpers/design").maps[map].spawns[0];
	Object.assign(p, { map, in: map, x, y });
}
test("PvP rounds wait for a safe public target and keep the original deadline after leaving safety", () => {
	for (const map of ["hut", "woffice", "d_e"]) {
		const context = pvpReachability();
		const h = eventHarness({ reachable: context.anniversary_reachable });
		assert.equal(h.start().live, false);
		assert.equal(h.visitor.s.anniversary_visit, undefined);
		moveToMap(h.host, map);
		h.time(rules.INTERVAL + 60000);
		const selected = h.event.tick();
		assert.equal(selected.target, h.host.name, map);
		assert.equal(selected.available, true);
		assert.equal(selected.expires, rules.INTERVAL + 60000 + rules.WINDOW);
		assert(h.visitor.s.anniversary_visit, "a visitor can travel to the safe target");
		moveToMap(h.host, "main");
		moveToMap(h.visitor, "main");
		assert.equal(h.event.tick().available, false);
		assert.equal(h.event.claim(h.visitor, h.host, h.deliver), false);
		assert.equal(h.delivered.length, 0);
		assert(h.visitor.s.anniversary_visit, "unsafe kisses do not consume the visit");
		moveToMap(h.host, map);
		moveToMap(h.visitor, map);
		h.host.afk = true;
		h.time(selected.expires - 1);
		assert.equal(h.event.tick().expires, selected.expires);
		assert.equal(h.event.claim(h.visitor, h.host, h.deliver), true);
		assert.equal(h.event.claim(h.visitor, h.host, h.deliver), false);
		assert.equal(h.delivered.length, 2);
		h.time(selected.expires);
		assert.equal(h.event.isTarget(h.host), false);
	}
});
test("ordinary realms retain public targets; combat maps and all bank floors stay excluded", () => {
	const context = pvpReachability();
	context.is_pvp = false;
	const h = eventHarness({ reachable: context.anniversary_reachable });
	assert.equal(h.start().target, h.host.name);
	for (const map of ["bank", "bank_b", "bank_u", "arena"]) {
		moveToMap(h.host, map);
		assert.equal(h.event.isTarget(h.host), false, map);
	}
	const empty = eventHarness({ reachable: pvpReachability().anniversary_reachable });
	assert.equal(empty.start().live, false);
	empty.time(rules.INTERVAL + rules.WINDOW);
	moveToMap(empty.host, "hut");
	assert.equal(empty.event.tick().live, false, "an empty round does not start after its selection window");
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
		homeRealm: "TESTI",
		addCondition: (p, name, args = {}) => {
			p.s[name] = { ms: args.duration || design.conditions[name].duration };
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
	localize(vm.createContext(context));
	vm.runInContext(source.slice(start, source.indexOf("\n};", start) + 3), context);
	vm.runInContext(definition(functions, "anniversary_is_active"), context);
	assert.equal(context.anniversary_is_active(), true, "no launch-date configuration is needed");
	context.options = { anniversary: { starts_at: "2000-01-01", ends_at: "2000-01-15" } };
	assert.equal(context.anniversary_is_active(), true, "old dates cannot end the event");
	context.is_pvp = true;
	assert.equal(context.anniversary_is_active(), true, "PvP cannot disable the event or its monster drops");
	context.events.anniversary = false;
	context.options.anniversary = { starts_at: "2000-01-01", ends_at: "2999-01-01" };
	assert.equal(context.anniversary_is_active(), false, "dates cannot override a manual stop");
	const design = localize(vm.createContext({}));
	vm.runInContext(fs.readFileSync(path.join(root, "design/events.js"), "utf8"), design);
	assert.equal(design.events.anniversary.duration, undefined);
	assert.doesNotMatch(definition(functions, "anniversary_is_active"), /Date|options|inEventWindow/);
});
function dropHarness(roll = 0) {
	const emitted = [],
		p = player("Farmer", { luckm: 1, p: {} });
	const monster = { type: "goo", map: "main", x: 20, y: 30, max_hp: 1000, mult: 1, luckx: 1, level: 1 };
	const context = localize(
		vm.createContext({
			anniversary_rules: rules,
			anniversary_is_active: () => true,
			G: { items: design.items, monsters: { goo: { hp: 1000 } } },
			D: {
				drops: {
					maps: { global: plain(design.drops.maps.global), global_static: [] },
					monsters: {},
					monsters_home_server: {},
					gold: { base: 0, random: 0, x10: 0, x50: 0 },
					konami: [],
				},
				monster_gold: { goo: 0 },
			},
			B: { global_drops: true, drop_table_multiplier: 1 },
			mode: {},
			chests: {},
			Math: Object.assign(Object.create(Math), { random: () => roll }),
			round: Math.round,
			is_in_pvp: () => false,
			achievement_logic_monster_kill() {},
			randomStr: () => "chest",
			has_home_server_bonus: () => false,
			create_new_item: (name) => ({ name }),
			can_stack: () => false,
		}),
	);
	p.socket.emit = (...args) => emitted.push(args);
	vm.runInContext(fs.readFileSync(path.join(root, "node/logic/encouragement.js"), "utf8"), context);
	for (const name of ["drop_item_logic", "roll_monster_drops", "drop_something"])
		vm.runInContext(definition(source, name), context);
	return {
		context,
		p,
		monster,
		emitted,
		drop(share = 1) {
			context.drop_something(p, monster, share);
			return context.chests.chest?.items.map((item) => item.name) || [];
		},
	};
}
test("public global table supplies one normal chest with a Gift and only the credited account's flavor", () => {
	const table = plain(design.drops.maps.global);
	assert.deepEqual(
		table.find((row) => row[1] === "anniversarygift"),
		[1 / 1500, "anniversarygift"],
	);
	for (const slice of rules.SLICES)
		assert.deepEqual(
			table.find((row) => row[1] === slice),
			[1 / 50000, slice],
		);
	for (let i = 0; i < 18; i++) {
		const h = dropHarness();
		h.p.owner = "account-" + i;
		assert.deepEqual(plain(h.drop()).sort(), ["anniversarygift", rules.sliceForAccount(h.p.owner)].sort());
		assert.equal(h.emitted.length, 1, "no extra event chest");
		assert.deepEqual(plain(h.emitted[0][1].owners), [h.p.owner]);
		assert.equal(h.emitted[0][1].x, h.monster.x);
	}
});
test("PvP monster drops use the event switch independently of kiss selection", () => {
	const h = dropHarness();
	h.context.is_pvp = true;
	h.context.events = { anniversary: true };
	h.context.G.maps = require("./helpers/design").maps;
	for (const name of ["anniversary_is_active", "is_in_pvp"]) vm.runInContext(definition(functions, name), h.context);
	assert.deepEqual(plain(h.drop()).sort(), ["anniversarygift", rules.sliceForAccount(h.p.owner)].sort());
	h.context.events.anniversary = false;
	h.context.chests = {};
	assert.deepEqual(plain(h.drop()), []);
});
test("anniversary global drops use the real HP, Luck, share and monster multiplier formula", () => {
	for (const factors of [
		[1000, 1, 1, 1, 1],
		[2000, 3, 2, 4, 0.25],
		[200, 2, 1, 1, 0.5],
	]) {
		const [hp, luck, luckx, mult, share] = factors;
		for (const [rate, item] of [
			[1 / 1500, "anniversarygift"],
			[1 / 50000, rules.sliceForAccount("owner-Farmer")],
		]) {
			const probability = ((rate * hp) / 1000) * luck * luckx * mult * share;
			for (const [factor, expected] of [
				[0.999999, true],
				[1.000001, false],
			]) {
				const h = dropHarness(probability * factor);
				h.p.luckm = luck;
				Object.assign(h.monster, { max_hp: hp, luckx, mult, level: 50 });
				h.context.B.drop_table_multiplier = 100;
				assert.equal(h.drop(share).includes(item), expected, JSON.stringify({ factors, item, factor }));
			}
		}
	}
});
test("global guards stop event drops and never suppress ordinary drops", () => {
	for (const change of [
		(h) => (h.context.anniversary_is_active = () => false),
		(h) => (h.context.B.global_drops = false),
		(h) => (h.p.tskin = "konami"),
		(h) => (h.monster.pet = true),
		(h) => (h.monster.trap = true),
	]) {
		const h = dropHarness();
		change(h);
		assert.deepEqual(plain(h.drop()), []);
	}
	const h = dropHarness();
	h.context.anniversary_is_active = () => false;
	h.context.D.drops.maps.global.push([1, "gem0"]);
	assert.deepEqual(plain(h.drop()), ["gem0"]);
	assert.deepEqual(plain(dropHarness(0.5).drop()), []);
	assert.deepEqual(plain(dropHarness().drop(0)), []);
});

test("the reduced slice rate no longer guarantees a slice from a baseline Ent kill", () => {
	const hp = require("./helpers/design").monsters.ent.hp;
	const rate = design.drops.maps.global.find((row) => row[1] === rules.SLICES[0])[0];
	const chance = (hp / 1000) * rate;
	assert(chance < 1);
	for (const [factor, wins] of [
		[0.999999, true],
		[1.000001, false],
	]) {
		const h = dropHarness(chance * factor);
		h.monster.max_hp = hp;
		assert.equal(h.drop().includes(rules.sliceForAccount(h.p.owner)), wins);
	}
});

function kissRewardHarness(roll, builder = 0) {
	const h = eventHarness(),
		announcements = [],
		logs = [];
	let rolls = 0;
	for (const p of [h.host, h.visitor]) {
		Object.assign(p, { items: Array(42).fill(null), citems: [], esize: 42, luckm: 100 });
		p.socket.emit = (...args) => logs.push([p.id, ...args]);
	}
	const context = localize(
		vm.createContext({
			Math: Object.assign(Object.create(Math), {
				random: () => {
					rolls++;
					return roll;
				},
			}),
			is_array: Array.isArray,
			cache_item: (item) => plain(item),
			broadcast: (...args) => announcements.push(args),
			resend() {},
		}),
	);
	// Use the real startup/reload data shape, not the browser's public G object.
	const gameBuilders = [...source.matchAll(/^\t\tG = \{[\s\S]*?\n\t\t\};/gm)],
		dropBuilders = [...source.matchAll(/^\t\tD = \{[\s\S]*?\n\t\t\};/gm)];
	assert.equal(gameBuilders.length, 2);
	assert.equal(dropBuilders.length, 2);
	for (const code of [gameBuilders[builder][0], dropBuilders[builder][0]]) {
		for (const field of code.matchAll(/\w+:\s*(\w+)/g))
			if (!(field[1] in context)) context[field[1]] = design[field[1]] || {};
		vm.runInContext(code, context);
	}
	context.G.skills = { ikissyou: { name: "I Kiss You" } };
	context.D.drops = plain(context.D.drops);
	assert.equal(context.G.drops, undefined);
	vm.runInContext(definition(shared, "can_stack"), context);
	for (const name of ["create_new_item", "add_item"]) vm.runInContext(definition(source, name), context);
	for (const name of ["chest_exchange", "anniversary_deliver"]) vm.runInContext(definition(functions, name), context);
	h.start();
	return {
		...h,
		context,
		announcements,
		logs,
		rolls: () => rolls,
		claim: () => h.event.claim(h.visitor, h.host, context.anniversary_deliver),
	};
}

test("startup and live reload both deliver the kiss rewards through server drop tables", () => {
	for (const builder of [0, 1]) {
		const h = kissRewardHarness(0.5, builder);
		assert(h.claim());
		assert(h.visitor.items.some((item) => item?.name === "anniversarygift"));
		assert(h.host.items.some((item) => item?.name === "anniversarygift"));
		assert.equal(h.claim(), false);
	}
});

test("hardcore processing preserves kiss odds without disabling ordinary prize reweighting", () => {
	const h = kissRewardHarness(0.001000001);
	h.context.D.drops.ordinary_fixture = [
		[1, "cxjar"],
		[999, "empty"],
	];
	const start = functions.indexOf("\t\tfor (var n in D.drops) {"),
		end = functions.indexOf("\n\t\tfor (var mname in G.maps)", start);
	assert(start >= 0 && end > start);
	vm.runInContext(functions.slice(start, end), h.context);
	assert.deepEqual(plain(h.context.D.drops.anniversary_kiss), plain(design.drops.anniversary_kiss));
	assert.notDeepEqual(plain(h.context.D.drops.ordinary_fixture), [
		[1, "cxjar"],
		[999, "empty"],
	]);
	assert(h.claim());
	assert(!h.visitor.items.some((item) => item?.name === "cxjar"));
});

test("a rewarded kiss uses the normal prize roller for exactly 0.1% and announces jar wins", () => {
	assert.deepEqual(plain(design.drops.anniversary_kiss), [
		[1, "cxjar", 1, "ikissyou"],
		[999, "empty"],
	]);
	for (const roll of [0, 0.000999999, 0.001000001, 0.999999]) {
		const h = kissRewardHarness(roll);
		assert(h.claim());
		assert.equal(h.visitor.s.anniversary_kiss.ms, 20 * 60 * 1000);
		assert.equal(h.host.s.anniversary_kiss, undefined);
		const won = roll < 0.001;
		assert.equal(h.visitor.items.filter((item) => item?.data === "ikissyou").length, Number(won));
		assert(!h.host.items.some((item) => item?.data === "ikissyou"), "being kissed grants no extra rare roll");
		for (const p of [h.visitor, h.host]) {
			assert.equal(p.items.find((item) => item?.name === rules.sliceForAccount(p.owner)).q, 1);
			assert.equal(p.items.find((item) => item?.name === "anniversarygift").q, 1);
		}
		assert.equal(h.rolls(), 1, "Luck and reweighted runtime tables cannot add rolls");
		assert.equal(h.announcements.length, Number(won));
		if (won) {
			const [event, announcement] = h.announcements[0];
			assert.equal(event, "server_message");
			assert.equal(announcement.type, "server_received");
			assert.equal(announcement.name, h.visitor.name);
			assert.equal(announcement.item.data, "ikissyou");
			assert.match(announcement.message, /Visitor received an I Kiss You CX Jar/);
		}
		h.visitor.s.anniversary_kiss.ms = 60000;
		assert(!h.claim());
		assert.equal(h.visitor.s.anniversary_kiss.ms, 60000, "repeated kisses cannot refresh the buff");
		assert.equal(h.rolls(), 1, "repeating the kiss cannot reroll");
		assert(!h.logs.some(([, event]) => event === "drop"), "no extra chest is spawned");
	}
});

test("kiss rewards stack through add_item, preserve full-bag overflow and respect stealth", () => {
	const h = kissRewardHarness(0);
	h.visitor.items = Array.from({ length: 42 }, () => ({ name: "gem0", q: 9999 }));
	h.visitor.items[0] = { name: rules.sliceForAccount(h.visitor.owner), q: 7 };
	h.visitor.items[1] = { name: "anniversarygift", q: 9 };
	h.visitor.items[2] = { name: "cxjar", data: "makeawish", q: 2 };
	h.visitor.esize = 0;
	assert(h.claim());
	assert.equal(h.visitor.items[0].q, 8);
	assert.equal(h.visitor.items[1].q, 10);
	assert.equal(h.visitor.items[2].q, 2, "different emotes cannot stack");
	assert.equal(h.visitor.items[42].data, "ikissyou", "the jar is retained in normal overflow");
	assert.equal(h.visitor.esize, -1);
	const stacked = kissRewardHarness(0);
	stacked.visitor.stealth = true;
	stacked.visitor.items[0] = { name: "cxjar", data: "ikissyou", q: 2 };
	assert(stacked.claim());
	assert.equal(stacked.visitor.items[0].q, 3);
	assert.deepEqual(stacked.announcements, []);
});

test("ineligible, late and disconnected visits cannot roll a rare reward", () => {
	for (const alter of [
		(h) => {
			h.visitor.x = 81;
		},
		(h) => {
			h.visitor.s.hopsickness = { ms: 1000 };
		},
		(h) => {
			delete h.visitor.s.anniversary_visit;
		},
		(h) => {
			h.roster.splice(h.roster.indexOf(h.host), 1);
		},
		(h) => {
			h.time(rules.INTERVAL + rules.WINDOW);
		},
	]) {
		const h = kissRewardHarness(0);
		alter(h);
		assert(!h.claim());
		assert.equal(h.rolls(), 0);
		assert.deepEqual(h.announcements, []);
		assert.equal(h.visitor.s.anniversary_kiss, undefined);
	}
});

test("Drapes are additional normal monster drops, including when the anniversary is off", () => {
	const loaded = require("./helpers/design");
	assert.deepEqual(plain(design.drops.monsters.mummy).slice(0, 2), [
		[1 / 4000, "open", "weaponofthedead"],
		[1 / 500, "bandages"],
	]);
	assert.deepEqual(plain(design.drops.monsters.ghost)[0], [0.0002, "pmace"]);
	for (const [name, rate] of [
		["mummy", 1 / 20],
		["ghost", 1 / 20],
		["nerfedmummy", 1 / 100],
	]) {
		assert.deepEqual(
			plain(design.drops.monsters[name]).filter((row) => row[1] === "drapes"),
			[[rate, "drapes"]],
		);
		assert(!loaded.monsters[name].cooperative, "one intrinsic-table pass per credited kill");
		for (const [luck, level, mult] of [
			[1, 1, 1],
			[2, 3, 1],
			[1, 2, 2],
		]) {
			for (const [factor, expected] of [
				[0.99999, true],
				[1.00001, false],
			]) {
				const h = dropHarness(rate * luck * level * mult * factor);
				h.context.G.monsters = loaded.monsters;
				h.context.D.drops.monsters[name] = plain(design.drops.monsters[name]);
				h.context.anniversary_is_active = () => false;
				h.p.luckm = luck;
				Object.assign(h.monster, { type: name, max_hp: loaded.monsters[name].hp, level, mult });
				assert.equal(h.drop().includes("drapes"), expected, `${name}: ${luck}/${level}/${mult}`);
			}
		}
	}
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

test("featured appearance is a public snapshot; becoming AFK reserves the same character", () => {
	const h = eventHarness();
	h.host.skin = "marmor6a";
	h.host.cx = { head: "makeup117", hat: "aniv2", skin: ["armor", "head"] };
	const first = h.start();
	assert.equal(first.skin, h.host.skin);
	assert.deepEqual(first.cx, h.host.cx);
	assert.notEqual(first.cx, h.host.cx);
	assert.equal(first.owner, undefined);
	h.host.cx.hat = "aniv3";
	h.host.cx.skin[0] = "new_armor";
	const changed = h.event.tick();
	assert.equal(first.cx.hat, "aniv2");
	assert.equal(first.cx.skin[0], "armor");
	assert.equal(changed.cx.hat, "aniv3");
	assert.notEqual(
		JSON.stringify(first),
		JSON.stringify(changed),
		"appearance changes trigger the existing state broadcast",
	);
	h.visitor.skin = "mmage";
	h.host.afk = true;
	const replacement = h.event.tick();
	assert.equal(replacement.id, h.host.id);
	assert.equal(replacement.skin, h.host.skin);
	assert.equal(replacement.available, true);
	h.time(rules.INTERVAL + rules.WINDOW);
	const ended = h.event.tick();
	assert.equal(ended.skin, undefined);
	assert.equal(ended.cx, undefined);
});

test("every other eligible connected character gets one ticket at selection, including AFK and same-account characters", () => {
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

test("Hop Sickness, Realm Fatigue and away merchants cannot be featured or receive a Visit", () => {
	for (const patch of [
		{ s: { hopsickness: { ms: 1000 } } },
		{ s: { realmfatigue: { ms: 1000, until: rules.INTERVAL + 1000 } } },
		{ type: "merchant", level: 1, p: { home: "TESTII" } },
		{ type: "merchant", p: {} },
	]) {
		const h = eventHarness();
		Object.assign(h.host, structuredClone(patch));
		Object.assign(h.visitor, structuredClone(patch));
		assert.equal(h.start().live, false);
		assert(!h.host.s.anniversary_visit);
		h.roster.push(player("EligibleHost"));
		assert.equal(h.event.tick().target, "EligibleHost");
		assert(!h.host.s.anniversary_visit);
		assert(!h.visitor.s.anniversary_visit);
	}
});

test("home merchants can host and visit; their home key is separate from the display realm", () => {
	const h = eventHarness({ realm: "EU III", homeRealm: "EUIII" });
	for (const p of h.roster) Object.assign(p, { type: "merchant", p: { home: "EUIII" } });
	assert.equal(h.start().target, h.host.id);
	assert(h.event.canVisit(h.visitor));
	assert(h.event.claim(h.visitor, h.host, h.deliver));
	assert.equal(h.delivered.length, 2);
});

test("reward delivery rechecks both participants after penalties or a merchant home change", () => {
	for (const role of ["host", "visitor"])
		for (const patch of [
			{ s: { hopsickness: { ms: 1000 } } },
			{ s: { realmfatigue: { ms: 1000, until: rules.INTERVAL + 1000 } } },
			{ type: "merchant", p: { home: "TESTII" } },
		]) {
			const h = eventHarness();
			h.start();
			Object.assign(h[role], { ...patch, s: { ...h[role].s, ...patch.s } });
			assert(!h.event.claim(h.visitor, h.host, h.deliver));
			assert.equal(h.delivered.length, 0);
			h.event.tick();
			if (role === "visitor") assert(!h.visitor.s.anniversary_visit);
			else assert.equal(h.event.tick().available, false);
		}
});

test("same-realm reconnect keeps an unused invitation, but eligibility recovery gives no late ticket", () => {
	const h = eventHarness();
	h.start();
	h.visitor.dc = true;
	h.event.tick();
	assert(h.visitor.s.anniversary_visit);
	delete h.visitor.dc;
	assert(h.event.claim(h.visitor, h.host, h.deliver));
	const away = eventHarness();
	Object.assign(away.visitor, { type: "merchant", p: { home: "TESTII" } });
	away.start();
	away.visitor.p.home = "TESTI";
	away.event.tick();
	assert(!away.event.canVisit(away.visitor));
	assert(!away.event.claim(away.visitor, away.host, away.deliver));
});

test("the five-minute deadline begins at actual selection and every ticket holder can claim", () => {
	const h = eventHarness();
	h.host.blocked = h.visitor.blocked = true;
	assert.equal(h.start().live, false);
	const selectedAt = rules.INTERVAL + 120000;
	h.time(selectedAt);
	h.host.blocked = false;
	const visitors = Array.from({ length: 50 }, (_, i) => player("Guest" + i));
	h.roster.push(...visitors);
	assert.equal(h.event.tick().expires, selectedAt + rules.WINDOW);
	h.time(selectedAt + rules.WINDOW - 1);
	for (const p of visitors) {
		assert(h.event.claim(p, h.host, h.deliver));
		assert.equal(p.s.anniversary_visit, undefined);
		assert(!h.event.claim(p, h.host, h.deliver));
	}
	assert.equal(h.delivered.length, 100, "each of fifty visits rewards both players");
	h.time(selectedAt + rules.WINDOW);
	assert(!h.event.claim(h.visitor, h.host, h.deliver));
	assert.equal(h.event.tick().live, false);
	assert.equal(h.visitor.s.anniversary_visit, undefined);
});

test("disconnect and reconnect preserve the selected character, deadline and used tickets", () => {
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
	h.host.dc = true;
	h.roster.splice(h.roster.indexOf(h.host), 1);
	h.time(rules.INTERVAL + 60000);
	assert.equal(h.event.tick().target, "Host");
	assert.equal(h.event.tick().available, false);
	assert(!h.event.claim(waiting, h.host, h.deliver));
	assert.equal(h.event.tick().expires, expires);
	assert.equal(waiting.s.anniversary_visit.ms, rules.WINDOW - 60000);
	assert.equal(replacement.s.anniversary_visit, undefined);
	const returning = player("Host", { owner: h.host.owner, x: 15 });
	h.roster.push(returning);
	assert(h.event.isTarget(returning), "a fresh socket is recognized even before the next tick");
	assert.equal(h.event.tick().available, true);
	assert.equal(h.event.tick().x, 15);
	assert.equal(h.event.tick().expires, expires);
	assert(!h.event.claim(h.visitor, returning, h.deliver));
	waiting.s.anniversary_visit.realm = "TEST II";
	assert(!h.event.claim(waiting, returning, h.deliver));
	h.event.tick();
	assert.equal(waiting.s.anniversary_visit, undefined);
});
test("an absent or unreachable host is never replaced, and late return cannot extend a round", () => {
	for (const patch of [{ dc: true }, { rip: true }, { in: "private" }, { blocked: true }]) {
		const h = eventHarness();
		const first = h.start();
		Object.assign(h.host, patch);
		h.time(rules.INTERVAL + 100000);
		const waiting = h.event.tick();
		assert.equal(waiting.id, first.id);
		assert.equal(waiting.available, false);
		assert.equal(waiting.expires, first.expires);
		h.time(first.expires);
		assert.equal(h.event.tick().live, false);
		Object.assign(h.host, player("Host"));
		assert(!h.event.isTarget(h.host));
		assert(!h.event.claim(h.visitor, h.host, h.deliver));
	}
	const h = eventHarness();
	h.start();
	h.roster.splice(0, 1, player("Host", { owner: "different-account" }));
	assert.equal(h.event.tick().available, false, "same name alone is not sufficient");
});

test("normal condition insertion and removal synchronize the client and do not change combat stats", () => {
	const definitionContext = {};
	localize(vm.createContext(definitionContext));
	vm.runInContext(fs.readFileSync(path.join(root, "design/conditions.js"), "utf8"), definitionContext);
	const context = { G: { conditions: definitionContext.conditions }, max: Math.max, min: Math.min, server_log() {} };
	localize(vm.createContext(context));
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

test("the kiss buff uses native Frequency and Output, refreshes without stacking and expires after 20 minutes", () => {
	const G = require("./helpers/design"),
		emitted = [],
		sync = [];
	const context = localize(
		vm.createContext({
			G,
			Math,
			min: Math.min,
			max: Math.max,
			round: Math.round,
			floor: Math.floor,
			character_slots: G.character_slots,
			calculate_item_properties: G.calculate_item_properties,
			mssince: G.mssince,
			in_arr: G.in_arr,
			goldm: 1,
			luckm: 1,
			xpm: 1,
			mode: {},
			perfc: { cps: 0 },
			server_log() {},
			recalculate_vxy() {},
		}),
	);
	const mapStart = source.indexOf("var stat_to_attr =");
	vm.runInContext(source.slice(mapStart, source.indexOf("function calculate_player_stats", mapStart)), context);
	load(context, "node/server.js", ["calculate_player_stats", "calculate_common_stats"]);
	load(context, "node/server_functions.js", ["add_condition"]);
	context.resend = (p, flags) => {
		sync.push(flags);
		context.calculate_player_stats(p);
	};
	const h = eventHarness({
		addCondition: context.add_condition,
		resend: (p, flags) => {
			if (p === context.player) context.resend(p, flags);
		},
	});
	const p = (context.player = h.visitor);
	Object.assign(p, {
		type: "ranger",
		level: 80,
		xp: 0,
		items: [],
		citems: [],
		p: {},
		last: { attack: new Date() },
		slots: { mainhand: { name: "bow", level: 8 } },
		damage_type: "physical",
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
		socket: { emit: (...args) => emitted.push(args) },
	});
	context.calculate_player_stats(p);
	const before = { output: p.output, attack: p.attack, frequency: p.frequency };
	h.start();
	assert(h.event.claim(p, h.host, h.deliver));
	const def = G.conditions.anniversary_kiss;
	assert.equal(def.buff, true);
	assert.equal(def.ui, true);
	assert.equal(def.output, 6);
	assert.equal(def.frequency, 10);
	assert.equal(def.duration, 20 * 60 * 1000);
	assert.equal(p.s.anniversary_kiss.ms, def.duration);
	assert.equal(p.output, before.output + 6);
	assert(Math.abs(p.frequency - before.frequency - 0.1) < 1e-12);
	assert(Math.abs(p.attack - before.attack * (p.output / before.output)) <= 1);
	assert(p.hitchhikers.some(([, message]) => message.name === "anniversary_kiss" && message.duration === def.duration));
	p.s.anniversary_kiss.ms = 50000;
	context.add_condition(p, "anniversary_kiss");
	context.calculate_player_stats(p);
	assert.equal(p.s.anniversary_kiss.ms, def.duration);
	assert.equal(p.output, before.output + 6, "refresh never adds a second bonus");
	assert(Math.abs(p.frequency - before.frequency - 0.1) < 1e-12, "Frequency cannot stack either");
	context.add_condition(p, "darkblessing");
	context.calculate_player_stats(p);
	assert.equal(p.output, before.output + 6 + G.conditions.darkblessing.output, "Output bonuses add normally");
	delete p.s.darkblessing;
	let rendered = "";
	context.$ = () => ({
		length: 0,
		append: (html) => {
			rendered = html;
		},
		remove() {},
	});
	context.item_container = (args) => args.skin + args.onclick;
	load(context, "js/html.js", ["render_conditions"]);
	context.render_conditions(p);
	assert.match(rendered, /emote_ikissyoucondition_click\('anniversary_kiss'\)/);
	// Execute the existing condition-timer block, including its expiry response and resend.
	const anchor = source.indexOf('if (name == "guardians_oath" && !guardians_oath_source(player))');
	const start = source.lastIndexOf("for (var name in player.s)", anchor);
	const end = source.indexOf("for (var name in player.q)", anchor);
	assert(start > 0 && end > start);
	const tick = "(function(){" + source.slice(start, end) + "})()";
	context.ms = def.duration - 1;
	vm.runInContext(tick, context);
	assert.equal(p.s.anniversary_kiss.ms, 1);
	context.ms = 1;
	vm.runInContext(tick, context);
	assert.equal(p.s.anniversary_kiss, undefined);
	assert.equal(p.output, before.output);
	assert.equal(p.frequency, before.frequency);
	assert.equal(p.attack, before.attack);
	assert(emitted.some(([, message]) => message?.response === "ex_condition" && message.name === "anniversary_kiss"));
	assert.equal(sync.at(-1), "u+cid");
});
test("dead players, instances and inaccessible terrain never host", () => {
	for (const patch of [
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
test("newer lower-level hosts retain a fourfold selection preference", () => {
	const h = eventHarness({ random: () => 0.6 });
	h.roster.splice(1);
	h.host.age = 500;
	h.roster.push(player("Newcomer"));
	assert.equal(h.start().target, "Newcomer");
});

test("selection favors active and newer players without excluding AFK players", () => {
	const counts = { Host: 0, Newcomer: 0, Away: 0, AwayNewcomer: 0 };
	for (let i = 0; i < 25; i++) {
		const h = eventHarness({ random: () => (i + 0.5) / 25 });
		h.host.age = 500;
		h.roster.splice(1);
		h.roster.push(player("Newcomer"), player("Away", { age: 500, afk: true }), player("AwayNewcomer", { afk: "code" }));
		counts[h.start().target]++;
	}
	assert.deepEqual(counts, { Host: 4, Newcomer: 16, Away: 1, AwayNewcomer: 4 });
	for (const afk of [true, "bot", "code"]) {
		const h = eventHarness();
		h.host.afk = afk;
		h.visitor.afk = true;
		assert.equal(h.start().available, true);
		assert(h.event.claim(h.visitor, h.host, h.deliver));
	}
});

test("going AFK after selection preserves the five-minute window and prevents repeat rewards", () => {
	for (const afk of [true, "bot", "code"]) {
		const h = eventHarness();
		const later = player("Later"),
			expired = player("Expired");
		h.roster.push(later, expired);
		const first = h.start();
		h.time(rules.INTERVAL + 60000);
		h.host.afk = afk;
		assert.equal(h.event.tick().available, true);
		assert.equal(h.event.tick().expires, first.expires);
		assert(h.event.claim(h.visitor, h.host, h.deliver));
		assert(!h.event.claim(h.visitor, h.host, h.deliver));
		h.time(first.expires - 1);
		assert(h.event.claim(later, h.host, h.deliver));
		assert.equal(h.delivered.length, 4);
		h.time(first.expires);
		assert(!h.event.claim(expired, h.host, h.deliver));
		assert.equal(h.event.tick().live, false);
	}
});
test("every valid kiss gives both players their own flavor and Gift; repeats cannot duplicate", () => {
	let roll = 0;
	const h = eventHarness({ random: () => roll });
	const second = player("Second", { owner: h.visitor.owner });
	h.roster.push(second);
	h.start();
	assert(h.event.claim(h.visitor, h.host, h.deliver));
	assert.deepEqual(h.delivered, [
		["Visitor", [rules.sliceForAccount(h.visitor.owner), "anniversarygift"]],
		["Host", [rules.sliceForAccount(h.host.owner), "anniversarygift"]],
	]);
	assert(!h.event.claim({ ...h.visitor }, h.host, h.deliver));
	assert(h.event.claim(second, h.host, h.deliver));
	assert.equal(h.delivered[2][1][0], h.delivered[0][1][0]);
	assert.equal(h.delivered.length, 4, "host receives a slice and Gift for each valid visit");
	assert.deepEqual(h.delivered[3], h.delivered[1]);
	h.host.afk = true;
	h.visitor.afk = second.afk = true;
	const replacement = player("Replacement");
	h.roster.push(replacement);
	assert.equal(h.event.tick().target, "Host");
	assert(!h.event.claim(h.visitor, replacement, h.deliver));
	roll = 0.99;
	h.time(2 * rules.INTERVAL);
	h.event.tick();
	assert(h.event.claim(h.visitor, replacement, h.deliver));
});

test("slice flavor stays account-specific across characters, realms, rounds and both kiss roles", () => {
	for (const owner of ["account-one", "account-two", "account-three"]) {
		const flavor = rules.sliceForAccount(owner);
		for (const realm of ["EU I", "US IV"])
			for (const round of [1, 3])
				for (const role of ["host", "visitor"]) {
					const h = eventHarness({ realm });
					h[role].owner = owner;
					h[role].id += "-" + realm + "-" + round;
					h.time(round * rules.INTERVAL);
					h.event.tick();
					assert(h.event.claim(h.visitor, h.host, h.deliver));
					assert.deepEqual(h.delivered.find(([id]) => id === h[role].id)[1], [flavor, "anniversarygift"]);
				}
	}
});

test("slices have no unfiltered loot source and the cake requires all six flavors", () => {
	const sources = [];
	function visit(value, path = []) {
		if (Array.isArray(value) && typeof value[0] === "number" && rules.SLICES.includes(value[1]))
			sources.push([path.slice(0, -1).join("."), value[1]]);
		else if (value && typeof value === "object")
			for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
	}
	visit(design.drops);
	assert.deepEqual(sources.sort(), rules.SLICES.map((id) => ["maps.global", id]).sort());
	for (const id of rules.SLICES) {
		assert(design.items[id].exclusive, id);
		assert(!design.craft[id], id);
		assert(!Object.values(design.craft).some((r) => r.item === id), id);
	}
	assert.deepEqual(
		plain(design.craft.sixcake.items),
		rules.SLICES.map((id) => [1, id]),
	);
});

function compoundHarness(name, level = 0, roll = 0.1) {
	const G = require("./helpers/design");
	const def = { ...G.items[name], igrade: G.calculate_item_grade(G.items[name]) };
	const grade = G.calculate_item_grade(def, { level });
	const emitted = [],
		failures = [];
	const p = player("Combiner", {
		computer: true,
		q: {},
		p: { ograce: 0 },
		esize: 0,
		citems: [],
		items: [...Array.from({ length: 3 }, () => ({ name, level })), { name: "cscroll" + Math.min(3, grade), q: 1 }],
	});
	const context = localize(
		vm.createContext({
			G: { items: { ...G.items, [name]: def }, maps: { main: { compound: {} } } },
			D: { compounds: G.compounds },
			players: { test: p },
			socket: { id: "test", emit: (...args) => emitted.push(args) },
			calculate_item_grade: G.calculate_item_grade,
			cache_item: plain,
			Math: Object.assign(Object.create(Math), { random: () => roll }),
			min: Math.min,
			max: Math.max,
			gameplay: "normal",
			server_log() {},
			resend() {},
			fail_response: (...args) => failures.push(args),
			success_response: (...args) => emitted.push(args),
		}),
	);
	for (const name of ["consume", "consume_one"]) vm.runInContext(definition(source, name), context);
	const handler = socketHandler(context, "compound");
	return {
		p,
		context,
		emitted,
		failures,
		run: (extra) => handler({ items: [0, 1, 2], scroll_num: 3, clevel: level, ...extra }),
	};
}

test("every anniversary equipment item has exactly one native progression path", () => {
	const G = require("./helpers/design");
	for (const [, name] of G.drops.anniversary_equipment) {
		const def = G.items[name];
		assert.notEqual(Boolean(def.upgrade), Boolean(def.compound), name);
		assert.equal(def.grades[3], def.compound ? 7 : 10, name);
		assert(def.exclusive, "event gear cannot leak into Glitch boxes");
	}
	for (const name of ["guestbook", "keepsakependant"]) {
		assert.deepEqual(plain(G.items[name].grades), [0, 2, 6, 7]);
		assert(G.items[name].compound);
		for (const level of [0, 3, 5, 7]) {
			const prop = G.calculate_item_properties({ name, level });
			assert.equal(prop.xp, 2, "XP does not scale");
			assert.equal(prop.stresistance, name === "guestbook" ? 8 : 0, "status resistance does not scale");
			assert.equal(G.calculate_item_grade(G.items[name], { level }), level === 7 ? 4 : level >= 2 ? 2 : 1);
		}
	}
});

test("new and previously level-less books and pendants combine through the real handler", () => {
	for (const name of ["guestbook", "keepsakependant", "wbook1", "spookyamulet"]) {
		for (const legacy of [false, true]) {
			const h = compoundHarness(name);
			if (legacy) for (const item of h.p.items.slice(0, 3)) delete item.level;
			h.run();
			assert.deepEqual(h.failures, [], name);
			assert.deepEqual(h.emitted, [], name);
			assert.equal(h.p.p.c_item.name, name);
			assert.equal(h.p.p.c_item.level, 1);
			assert.equal(h.p.q.compound.num, 0);
			assert.equal(h.p.items[0].name, "placeholder");
			assert.deepEqual(h.p.items.slice(1), [null, null, null], "three copies and one scroll are committed");
		}
		const failure = compoundHarness(name, 0, 0.999999);
		failure.run();
		assert.equal(failure.p.p.c_item, null, "normal failure consumes the inputs");
		assert.equal(failure.p.p.c_itemx.name, name);
	}
});

test("native compounds quote without spending and reject capped, mismatched, locked or duplicate inputs", () => {
	for (const name of ["guestbook", "keepsakependant", "wbook1"]) {
		const quote = compoundHarness(name);
		const items = plain(quote.p.items);
		quote.run({ calculate: true });
		assert.equal(quote.emitted[0][0], "compound_chance");
		assert.equal(quote.emitted[0][1].chance, 0.9);
		assert.deepEqual(quote.p.items, items);
		for (const alter of [
			(h) => {
				h.p.items[1].level = 1;
			},
			(h) => {
				h.p.items[1].l = "l";
			},
			(h) => {
				h.p.items[1] = h.p.items[0];
			},
			(h) => {
				h.p.items[3].name = "cscroll0";
			},
		]) {
			const h = compoundHarness(name);
			alter(h);
			const before = plain(h.p.items);
			h.run();
			assert.deepEqual(plain(h.p.items), before);
			assert.equal(h.emitted.length, 1);
			assert.equal(h.p.q.compound, undefined);
		}
		const capped = compoundHarness(name, 7);
		const before = plain(capped.p.items);
		capped.run();
		assert.equal(capped.emitted[0][1].response, "max_level");
		assert.equal(capped.emitted[0][1].level, 7);
		assert.deepEqual(plain(capped.p.items), before);
	}
});

test("anniversary progression preserves incumbent strengths at practical and apex levels", () => {
	const G = require("./helpers/design");
	const props = (name, level) => G.calculate_item_properties({ name, level });
	for (const [fresh, incumbent] of [
		["homecominghelm", "hhelmet"],
		["homecomingcoat", "harmor"],
		["homecomingcape", "bcape"],
	]) {
		for (const level of [0, 8, 9, 10])
			for (const stat of ["armor", "resistance", "stat"])
				assert(props(fresh, level)[stat] < props(incumbent, level)[stat], `${fresh} +${level} ${stat}`);
	}
	for (const level of [0, 3, 5, 7]) {
		const book = props("guestbook", level),
			secrets = props("wbook1", level),
			cheer = props("wbookhs", level);
		if (level >= 3) assert(book.int < secrets.int);
		assert(book.vit < cheer.vit && book.resistance < cheer.resistance);
		const pendant = props("keepsakependant", level),
			mana = props("mpxamulet", level);
		assert(pendant.mp_reduction < mana.mp_reduction && pendant.mp_cost > mana.mp_cost);
		assert(pendant.xp < props("northstar", level).xp);
	}
	assert.equal(props("guestbook", 3).int, 29);
	assert.equal(props("guestbook", 3).resistance, 90);
	assert.equal(props("keepsakependant", 3).mp, 375);
	assert.equal(props("keepsakependant", 3).mp_reduction, 8);
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
function craftHarness(name = "sixcake") {
	const emitted = [],
		failures = [];
	let handler;
	const recipe = design.craft[name];
	const p = player("Crafter", {
		gold: recipe.cost,
		items: recipe.items.map(([q, name, level]) => ({ name, q, ...(level === undefined ? {} : { level }) })),
		citems: [],
		esize: 0,
		socket: { emit: (...args) => emitted.push(args) },
	});
	const context = {
		G: { craft: design.craft, items: design.items, titles: { shiny: {} } },
		D: {},
		socket: { id: "crafter", on: (name, callback) => (handler = callback) },
		players: { crafter: p },
		npcs: { anniversary_baker: player("Mira") },
		B: { sell_dist: 100 },
		anniversary_is_active: () => true,
		distance: (a, b) => (a.in !== b.in || a.map !== b.map ? 999999 : Math.hypot(a.x - b.x, a.y - b.y)),
		simple_distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		get_npc_coords: () => player("Cole"),
		random_one: (object) => Object.keys(object)[0],
		cache_item: (item) => plain(item),
		is_array: Array.isArray,
		a_score: {},
		Math: Object.assign(Object.create(Math), { random: () => 0.999999 }),
		broadcast: (...args) => emitted.push(args),
		item_to_phrase: (item) => item.name,
		resend() {},
		success_response: (...args) => emitted.push(args),
		fail_response: (...args) => failures.push(args),
	};
	localize(vm.createContext(context));
	for (const name of ["can_stack", "can_add_item"]) vm.runInContext(definition(shared, name), context);
	for (const name of ["create_new_item", "consume", "add_item"]) vm.runInContext(definition(source, name), context);
	const mapStart = functions.indexOf("D.craftmap = {};");
	vm.runInContext(functions.slice(mapStart, functions.indexOf("process_game_data();", mapStart)), context);
	const start = source.indexOf('socket.on("craft",');
	vm.runInContext(source.slice(start, source.indexOf('socket.on("exchange",', start)), context);
	return {
		p,
		context,
		emitted,
		failures,
		request: (data) => handler(data),
		craft: () => handler({ items: recipe.items.map((_, i) => [i, i]) }),
	};
}
test("the real craft handler makes every anniversary recipe using its normal recipe map", () => {
	for (const [name, recipe] of Object.entries(design.craft).filter(
		([, recipe]) => recipe.quest === "anniversary_baker",
	)) {
		const h = craftHarness(name);
		h.craft();
		assert.deepEqual(h.failures, [], name);
		assert.equal(h.p.gold, 0);
		assert.equal(h.p.items.filter(Boolean).length, 1);
		assert.equal(h.p.items[0].name, recipe.output?.name || name);
		assert.equal(h.emitted.at(-1)[0], "craft");
		assert.equal(h.emitted.at(-1)[1].name, recipe.output?.name || name);
	}
	const h = craftHarness("makeawishjar");
	h.craft();
	assert.equal(h.p.gold, 0);
	assert.deepEqual(plain(h.p.items), [{ name: "cxjar", q: 1, data: "makeawish", oo: "Crafter" }]);
	assert.equal(h.failures.length, 0);
});
test("native crafting stacks only matching CX Jars and retains leftover ingredients", () => {
	const h = craftHarness("makeawishjar");
	h.p.items = [
		{ name: "sixcake", q: 2 },
		{ name: "cxjar", q: 1, data: "ikissyou" },
		{ name: "cxjar", q: 2, data: "makeawish" },
	];
	h.craft();
	assert.deepEqual(h.failures, []);
	assert.equal(h.p.items[0].q, 1);
	assert.equal(h.p.items[1].q, 1);
	assert.equal(h.p.items[2].q, 3);
	assert.equal(h.p.esize, 0);
	assert.equal(h.p.citems[2].q, 3);
	const blocked = craftHarness("makeawishjar");
	blocked.p.items = [
		{ name: "sixcake", q: 2 },
		{ name: "cxjar", q: 1, data: "ikissyou" },
	];
	const before = plain({ gold: blocked.p.gold, items: blocked.p.items });
	blocked.craft();
	assert.equal(blocked.failures[0][0], "inventory_full");
	assert.deepEqual(plain({ gold: blocked.p.gold, items: blocked.p.items }), before);
});
test("craft failures cannot consume gold or ingredients", () => {
	for (const alter of [
		(h) => (h.context.anniversary_is_active = () => false),
		(h) => (h.p.x = 101),
		(h) => h.p.gold--,
		(h) => (h.p.items[0].l = "l"),
		(h) => (h.p.items[0].b = true),
		(h) => (h.p.items[0].giveaway = true),
		(h) => h.p.items.forEach((item) => item.q++),
		(h) => delete h.context.npcs.anniversary_baker,
		(h) => (h.p.in = "private"),
		(h) => (h.p.user = true),
		(h) => (h.p.rip = true),
	]) {
		const h = craftHarness();
		alter(h);
		const before = plain({ gold: h.p.gold, items: h.p.items });
		h.craft();
		assert.equal(h.failures.length, 1);
		assert.deepEqual(plain({ gold: h.p.gold, items: h.p.items }), before);
	}
	const h = craftHarness();
	h.p.computer = true;
	h.p.x = 1000;
	h.craft();
	assert.equal(h.p.gold, 0, "existing remote-computer crafting remains available");
});
test("ordinary crafting keeps nine-slot recipes, exact levels and inherited item properties", () => {
	const h = craftHarness("basketofeggs");
	h.craft();
	assert.deepEqual(h.failures, []);
	assert.equal(h.p.items[0].name, "basketofeggs");
	const ordinary = Object.entries(design.craft).find(
		([name, recipe]) => !recipe.quest && !recipe.output && name !== "basketofeggs",
	);
	const regular = craftHarness(ordinary[0]);
	regular.context.anniversary_is_active = () => false;
	regular.p.items[0].p = "shiny";
	regular.craft();
	assert.deepEqual(regular.failures, []);
	assert.equal(regular.p.items[0].p, "shiny");
	const leveled = craftHarness("candleward");
	leveled.p.items[1].level = 1;
	const before = plain(leveled.p.items);
	leveled.craft();
	assert.equal(leveled.failures[0][0], "craft_cant");
	assert.deepEqual(plain(leveled.p.items), before);
});
test("existing non-anniversary recipes still use the ordinary crafting path", () => {
	for (const [name, recipe] of Object.entries(design.craft).filter(
		([, recipe]) => recipe.quest !== "anniversary_baker",
	)) {
		const h = craftHarness(name);
		h.context.anniversary_is_active = () => false;
		h.craft();
		assert.deepEqual(h.failures, [], name);
		assert.equal(h.p.gold, 0, name);
		assert.equal(h.p.items[0].name, recipe.output?.name || name);
	}
});
test("Bataxe consumes one key, one +7 Wooden Basher and one essence exactly once", () => {
	const h = craftHarness("bataxe");
	assert.equal(design.craft.bataxe.cost, 120000);
	h.p.items[0].q = 3;
	h.p.items[2].q = 2;
	h.p.items[1].p = "shiny";
	h.craft();
	assert.deepEqual(h.failures, []);
	assert.equal(h.p.gold, 0);
	assert.equal(h.p.items.find((item) => item && item.name === "cryptkey").q, 2);
	assert.equal(h.p.items.find((item) => item && item.name === "essenceoflife").q, 1);
	const axe = h.p.items.find((item) => item && item.name === "bataxe");
	assert.equal(axe.level, 0);
	assert.equal(axe.p, "shiny");
	assert(!h.p.items.some((item) => item && item.name === "wbasher"));
	const after = plain({ gold: h.p.gold, items: h.p.items });
	h.craft();
	assert.equal(h.failures.length, 1);
	assert.deepEqual(plain({ gold: h.p.gold, items: h.p.items }), after);
});
test("Bataxe refuses other levels, missing ingredients, locked items and insufficient gold", () => {
	for (const alter of [
		(h) => (h.p.items[1].level = 6),
		(h) => (h.p.items[1].level = 8),
		(h) => (h.p.items[0] = null),
		(h) => (h.p.items[2] = null),
		(h) => (h.p.items[1].l = "l"),
		(h) => h.p.gold--,
	]) {
		const h = craftHarness("bataxe");
		alter(h);
		const before = plain({ gold: h.p.gold, items: h.p.items });
		h.craft();
		assert.equal(h.failures.length, 1);
		assert.deepEqual(plain({ gold: h.p.gold, items: h.p.items }), before);
	}
});
test("malformed or duplicate craft slots and insufficient quantities cannot spend inventory", () => {
	for (const data of [
		undefined,
		{},
		{ items: [] },
		{ items: Array(10).fill([0, 0]) },
		{ items: [[0, -1]] },
		{ items: [[0, 99]] },
		{ items: [null] },
		{
			items: [
				[0, 0],
				[1, 0],
			],
		},
	]) {
		const h = craftHarness();
		const before = plain({ gold: h.p.gold, items: h.p.items });
		h.request(data);
		assert.equal(h.failures[0][0], "invalid");
		assert.deepEqual(plain({ gold: h.p.gold, items: h.p.items }), before);
	}
	const h = craftHarness("reunionbow");
	h.p.items[0].q = 1;
	const before = plain({ gold: h.p.gold, items: h.p.items });
	h.craft();
	assert.equal(h.failures[0][0], "craft_cant_quantity");
	assert.deepEqual(plain({ gold: h.p.gold, items: h.p.items }), before);
	assert.doesNotMatch(source, /socket\.on\("anniversary_craft"/);
	assert.doesNotMatch(functions, /function anniversary_craft\(/);
});

test("cakes exchange at Xyn or by Computer, not at Mira", () => {
	function setup() {
		const p = player("Opener", {
			items: [{ name: "sixcake", q: 3 }],
			q: {},
			s: {},
			esize: 2,
			p: { stats: { exchanges: {} } },
		});
		const failed = [],
			consumed = [],
			replies = [];
		let handler;
		const ctx = {
			players: { opener: p },
			socket: {
				id: "opener",
				on: (name, fn) => {
					handler = fn;
				},
			},
			G: {
				items: { sixcake: { e: 1 }, anniversarygift: { e: 1 } },
				maps: { main: { exchange: player("Xyn", { x: 500 }) } },
			},
			D: { drops: { sixcake: [[1, "bow"]], anniversarygift: [[1, "gold", 5000]] } },
			B: { sell_dist: 100 },
			npcs: { anniversary_baker: player("Mira") },
			anniversary_is_active: () => true,
			distance: (a, b) => (a.map !== b.map || a.in !== b.in ? Infinity : Math.hypot(a.x - b.x, a.y - b.y)),
			fail_response: (reason) => failed.push(reason),
			success_response: (reply) => replies.push(reply),
			consume: (player, num, q) => consumed.push({ num, q }),
			add_item: () => 1,
			resend() {},
			gameplay: "normal",
		};
		const start = source.indexOf('socket.on("exchange",');
		vm.runInNewContext(source.slice(start, source.indexOf('socket.on("exchange_buy",', start)), ctx);
		return { p, ctx, failed, consumed, replies, open: () => handler({ item_num: 0, q: 3 }) };
	}
	for (const alter of [
		(h) => {
			h.p.x = 500;
		},
		(h) => {
			h.p.x = 500;
			h.ctx.anniversary_is_active = () => false;
		},
		(h) => {
			h.p.computer = true;
			h.p.x = 1000;
		},
	]) {
		const h = setup();
		alter(h);
		h.open();
		assert.deepEqual(h.failed, []);
		assert.deepEqual(h.consumed, [{ num: 0, q: 1 }], "opens one cake, not the stack");
		assert.equal(h.p.q.exchange.id, "sixcake");
		assert.equal(h.replies[0].in_progress, true);
	}
	for (const [reason, alter] of [
		["distance", () => {}],
		[
			"distance",
			(h) => {
				h.p.x = 101;
			},
		],
		[
			"distance",
			(h) => {
				h.p.map = "winterland";
			},
		],
		[
			"distance",
			(h) => {
				h.p.in = "private";
			},
		],
		[
			"distance",
			(h) => {
				h.ctx.anniversary_is_active = () => false;
			},
		],
		[
			"distance",
			(h) => {
				delete h.ctx.npcs.anniversary_baker;
			},
		],
		[
			"distance",
			(h) => {
				h.p.items[0].name = "anniversarygift";
			},
		],
		[
			"item_locked",
			(h) => {
				h.p.items[0].l = "l";
			},
		],
		[
			"exchange_existing",
			(h) => {
				h.p.q.exchange = {};
			},
		],
		[
			"inventory_full",
			(h) => {
				h.p.esize = 0;
			},
		],
		[
			"cant_in_bank",
			(h) => {
				h.p.user = true;
			},
		],
	]) {
		const h = setup();
		alter(h);
		h.open();
		assert.deepEqual(h.failed, [reason]);
		assert.deepEqual(h.consumed, []);
	}
});

function exchangeHarness(rolls) {
	const items = [],
		ctx = {
			D: {
				drops: {
					sixcake: [[1, "open", "equipment"]],
					sixcake_bonus: plain(design.drops.sixcake_bonus),
					equipment: [[1, "bow"]],
					gift: [[1, "cxjar", 1, "ikissyou"]],
				},
			},
			G: { items: design.items },
			Math: Object.assign(Object.create(Math), { random: () => rolls.shift() ?? 0.5 }),
			is_array: Array.isArray,
			create_new_item: (name, q) => ({ name, ...(q ? { q } : {}) }),
			add_item: (p, item) => items.push(item),
			item_to_phrase: (item) => item.name,
			colors: { server_success: "white" },
		};
	localize(vm.createContext(ctx));
	for (const name of ["exchange", "chest_exchange"]) vm.runInContext(definition(functions, name), ctx);
	return { ctx, items, p: player("Opener"), chest: { items: [], gold: 0, cash: 0 } };
}
test("both exchange paths preserve jars and add cake bonuses without replacing gear", () => {
	for (const chest of [false, true]) {
		let h = exchangeHarness([0.5, 0.5, 0.5, 0.5, 0]);
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
test("frequent Gifts keep old prizes but anniversary gear is only 0.099% of their pool", () => {
	const table = plain(design.drops.anniversarygift);
	const total = table.reduce((sum, row) => sum + row[0], 0);
	assert.equal(total, 1000000);
	assert.equal(table.find((row) => row[2] === "anniversary_equipment")[0] / total, 0.00099);
	assert.equal(table.find((row) => row[2] === "anniversary_legacy")[0] / total, 0.19);
	assert.equal(table.find((row) => row[3] === "ikissyou")[0] / total, 1 / 1000000);
	assert.equal(table.find((row) => row[3] === "makeawish")[0] / total, 99 / 1000000);
	for (const chest of [false, true]) {
		// Walk into the equipment row using the same native weighted exchange as Gifts.
		const previous = table.slice(0, 3).reduce((sum, row) => sum + row[0], 0);
		const h = exchangeHarness([(previous + 495) / total, 0]);
		h.ctx.D.drops = plain(design.drops);
		if (chest) h.ctx.chest_exchange(h.chest, "anniversarygift");
		else h.ctx.exchange(h.p, "anniversarygift");
		assert.deepEqual(plain(chest ? h.chest.items : h.items), [{ name: "candleward" }]);
	}
});
test("loaded cake rows award every equipment and cosmetic outcome, plus exactly three Gifts", () => {
	const total = design.drops.sixcake.reduce((sum, row) => sum + row[0], 0);
	assert.ok(Math.abs(total - 100) < 1e-12);
	assert.deepEqual(plain(design.drops.sixcake.filter((row) => row[1] === "cx").map((row) => row[2])), [
		"aniv0",
		"aniv1",
		"aniv2",
		"aniv3",
	]);
	assert.equal(
		design.drops.anniversary_equipment.reduce((sum, row) => sum + row[0], 0),
		100,
	);
	let weight = 0;
	for (const row of design.drops.sixcake) {
		const roll = (weight + row[0] / 2) / total;
		weight += row[0];
		if (row[1] === "cx") assert.ok(Math.abs(row[0] / total - 1 / 100) < 1e-12, "each hat has an actual 1% chance");
		else {
			const equipment = design.drops.anniversary_equipment.find((entry) => entry[1] === row[1]);
			assert.equal(
				row[0],
				equipment[0] * 0.96,
				"preserve relative gear odds without changing the Gift's equipment pool",
			);
		}
		for (const chest of [false, true]) {
			const h = exchangeHarness([roll]);
			h.ctx.D.drops = plain(design.drops);
			h.p.p = { acx: {} };
			if (chest) h.ctx.chest_exchange(h.chest, "sixcake");
			else h.ctx.exchange(h.p, "sixcake");
			const awarded = plain(chest ? h.chest.items : h.items);
			assert.deepEqual(
				awarded.filter((item) => item.name === "anniversarygift"),
				[{ name: "anniversarygift", q: 3 }],
			);
			if (row[1] === "cx") {
				if (chest) assert(awarded.some((item) => item.name === "cxjar" && item.data === row[2]));
				else assert.equal(h.p.p.acx[row[2]], 1);
			} else assert.equal(awarded[0].name, row[1]);
			assert(!awarded.some((item) => item.data === "ikissyou"));
		}
	}
});
test("the existing drop UI displays 1 / 100 for hats and 1 / 1,000 for a rewarded kiss jar", () => {
	const context = localize(
		vm.createContext({
			G: { drops: design.drops, items: design.items },
			round: Math.round,
			item_container: (args, item) => item?.name || "",
			cx_sprite: (id) => id,
		}),
	);
	for (const name of ["to_pretty_num", "to_pretty_float"]) vm.runInContext(definition(shared, name), context);
	const html = fs.readFileSync(path.join(root, "js/html.js"), "utf8");
	vm.runInContext(definition(html, "render_drop"), context);
	const rendered = context.render_drop([1, "open", "sixcake"], 1, "#858B8E");
	for (const id of ["aniv0", "aniv1", "aniv2", "aniv3"])
		assert.match(rendered, new RegExp(id + "<div[^>]*>1 / 100</div>"));
	const kiss = context.render_drop([1, "open", "anniversary_kiss"], 1, "#858B8E");
	assert.match(kiss, /cxjar[\s\S]*?1 \/ 1,000<\/div>/);
});
test("cake bonuses use independent absolute probabilities and never apply to a nested prize twice", () => {
	for (const rareRoll of [0.000009999, 0.000010001]) {
		for (const chest of [false, true]) {
			const h = exchangeHarness([0.5, 0.5, 0.5, 0.5, rareRoll]);
			if (chest) h.ctx.chest_exchange(h.chest, "sixcake");
			else h.ctx.exchange(h.p, "sixcake");
			const awarded = plain(chest ? h.chest.items : h.items);
			assert.equal(awarded.filter((item) => item.data === "ikissyou").length, rareRoll < 1 / 100000 ? 1 : 0);
			assert.equal(awarded.filter((item) => item.name === "anniversarygift").length, 1);
		}
	}
	const ctx = localize(vm.createContext({ D: { drops: plain(design.drops) }, is_array: Array.isArray }));
	const start = functions.indexOf("for (var n in D.drops)");
	vm.runInContext(functions.slice(start, functions.indexOf("for (var mname in G.maps)", start)), ctx);
	assert.deepEqual(
		plain(ctx.D.drops.sixcake_bonus),
		plain(design.drops.sixcake_bonus),
		"hardcore weight scaling cannot change bonus probabilities",
	);
});

function skillHarness(extra = {}) {
	const emitted = [],
		failed = [];
	let handler;
	const socket = { id: "visitor", emit: (...args) => emitted.push(args), on: (name, fn) => (handler = fn) };
	const h = eventHarness(extra);
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
		fail_response: (response, place, data) => {
			failed.push(response);
			emitted.push(["game_response", { ...data, response, place, failed: true }]);
		},
		consume_mp: (p, mp) => (p.mp -= mp),
		consume_skill: (p, name) => (p.last[name] = ctx.now),
	};
	ctx.G.maps = { main: {} };
	ctx.resend = () => {};
	localize(vm.createContext(ctx));
	const start = source.indexOf('socket.on("skill",');
	vm.runInContext(source.slice(start, source.indexOf('socket.on("click",', start)), ctx);
	return { ...h, ctx, emitted, failed, cast: (name = "ikissyou", id = "Host") => handler({ name, id }) };
}
test("real kiss handler rejects PvP combat locations and rewards a safe return only once", () => {
	const context = pvpReachability();
	context.is_pvp = false;
	const h = skillHarness({ reachable: context.anniversary_reachable });
	h.ctx.G.maps = context.G.maps;
	context.is_pvp = true;
	h.cast();
	assert.equal(h.emitted.at(-1)[1].reason, "target_unavailable");
	assert.equal(h.delivered.length, 0);
	assert(h.visitor.s.anniversary_visit);
	for (const p of [h.host, h.visitor]) moveToMap(p, "hut");
	h.cast();
	assert.equal(h.emitted.findLast(([event]) => event === "game_response")[1].rewarded, true);
	assert.equal(h.delivered.length, 2);
	h.ctx.now += 10001;
	h.cast();
	assert.equal(h.delivered.length, 2, "a repeated request cannot duplicate the rewards");
});
test("real socket handler grants only the current host's temporary kiss and honors cooldown", () => {
	const h = skillHarness();
	h.host.afk = true;
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

test("the real skill handler blocks ineligible rewards without disabling an owned cosmetic kiss", () => {
	for (const role of ["host", "visitor"])
		for (const patch of [
			{ s: { hopsickness: { ms: 1000 } } },
			{ s: { realmfatigue: { ms: 1000 } } },
			{ type: "merchant", p: { home: "TESTII" } },
		]) {
			const h = skillHarness();
			Object.assign(h[role], { ...patch, s: { ...h[role].s, ...patch.s }, p: { ...h[role].p, ...patch.p } });
			h.cast();
			assert.equal(h.failed.at(-1), "skill_cant_use");
			assert.equal(h.delivered.length, 0);
			h.failed.length = 0;
			h.visitor.p.acx.ikissyou = 1;
			h.cast();
			assert.equal(h.failed.length, 0);
			assert.equal(h.delivered.length, 0);
			assert(h.emitted.some(([name]) => name === "emote"));
		}
});

test("kiss results explain blocked rewards and preserve successful cosmetic casts", () => {
	for (const [patch, reason] of [
		[{ s: { realmfatigue: { ms: 60000 } } }, "realmfatigue"],
		[{ s: { hopsickness: { ms: 60000 } } }, "hopsickness"],
		[{ type: "merchant", p: { home: "TESTII" } }, "merchant_home"],
	]) {
		const h = skillHarness();
		Object.assign(h.visitor, { ...patch, s: { ...h.visitor.s, ...patch.s }, p: { ...h.visitor.p, ...patch.p } });
		h.cast();
		let result = h.emitted.findLast(([event]) => event === "game_response")[1];
		assert.equal(result.failed, true);
		assert.equal(result.reason, reason);
		assert.equal(result.rewarded, false);
		assert.equal(result.phrase, "interface.anniversary_status." + reason);
		assert.match(result.message, /No kiss rewards or buff/);
		h.visitor.p.acx.ikissyou = 1;
		h.cast();
		result = h.emitted.findLast(([event]) => event === "game_response")[1];
		assert.equal(result.success, true, "an owned emote remains a successful cosmetic cast");
		assert.equal(result.rewarded, false);
		assert.equal(result.reason, reason);
		assert.match(result.message, /No kiss rewards or buff/);
		assert.equal(h.delivered.length, 0);
		assert(h.emitted.some(([event]) => event === "emote"));
	}
	const h = skillHarness();
	h.cast();
	let result = h.emitted.findLast(([event]) => event === "game_response")[1];
	assert.equal(result.rewarded, true);
	assert.equal(result.reason, null);
	h.cast();
	result = h.emitted.findLast(([event]) => event === "game_response")[1];
	assert.equal(result.reason, "claimed");
	assert.equal(h.delivered.length, 2);
	const absent = skillHarness();
	absent.host.dc = true;
	absent.cast();
	assert.equal(absent.emitted.findLast(([event]) => event === "game_response")[1].reason, "target_unavailable");
	assert(absent.visitor.s.anniversary_visit, "an unavailable host does not consume the invitation");
	const cosmetic = skillHarness();
	cosmetic.visitor.p.acx.ikissyou = 1;
	cosmetic.ctx.players.other = player("Other");
	cosmetic.ctx.id_to_id.Other = "other";
	cosmetic.cast("ikissyou", "Other");
	result = cosmetic.emitted.findLast(([event]) => event === "game_response")[1];
	assert.equal(result.success, true);
	assert.equal(result.rewarded, false);
	assert.equal(result.reason, "wrong_target");
	assert.equal(result.message, undefined, "ordinary cosmetic kisses do not spam event warnings");
});

test("private Visit status explains withheld and lost tickets once without issuing late replacements", () => {
	const h = eventHarness(),
		messages = [];
	h.visitor.s.realmfatigue = { ms: 60000 };
	h.visitor.socket.emit = (...args) => messages.push(args);
	h.start();
	const ctx = localize(
		vm.createContext({
			players: { host: h.host, visitor: h.visitor },
			instances: {},
			G: { npcs: {}, maps: { main: { name: "Mainland" } } },
			E: {},
			anniversary_is_active: () => true,
			anniversary_state: () => h.event,
			resend() {},
			broadcast() {},
			broadcast_e() {},
			get_call_cost: () => 0,
		}),
	);
	load(ctx, "node/server_functions.js", ["anniversary_tick"]);
	load(ctx, "node/server.js", ["player_to_client"]);
	ctx.anniversary_tick();
	ctx.anniversary_tick();
	assert.equal(h.visitor.anniversary.reason, "realmfatigue");
	assert.equal(messages.filter(([event]) => event === "game_log").length, 1);
	assert.equal(ctx.player_to_client(h.visitor).anniversary.reason, "realmfatigue");
	assert.equal(ctx.player_to_client(h.visitor, true).anniversary, undefined, "never broadcast personal eligibility");
	delete h.visitor.s.realmfatigue;
	ctx.anniversary_tick();
	assert.equal(h.visitor.anniversary.reason, "no_visit");
	assert.equal(h.visitor.s.anniversary_visit, undefined);
	h.time(rules.INTERVAL * 2);
	ctx.anniversary_tick();
	assert.equal(h.visitor.anniversary.reason, "host", "the next round follows normal eligibility and selection");
	h.enabled(false);
	ctx.anniversary_tick();
	assert.equal(h.visitor.anniversary, null);
	assert.equal(ctx.player_to_client(h.visitor).anniversary, null, "clear cached client state when the event ends");
});

test("native event INFO and kiss logs display the server reason without graphics", () => {
	const h = skillHarness(),
		logs = [],
		results = [];
	h.visitor.s.realmfatigue = { ms: 60000 };
	h.visitor.anniversary = h.event.visitStatus(h.visitor);
	let receive;
	const ctx = localize(
		vm.createContext({
			S: { anniversary: h.event.tick() },
			character: h.visitor,
			G: { maps: { main: { name: "Mainland" } }, skills: {} },
			Date: { now: () => rules.INTERVAL },
			server_region: "TEST",
			server_identifier: "I",
			Dev: false,
			no_graphics: true,
			html_escape: String,
			add_log: (message) => logs.push(message),
			ui_log: (message) => logs.push(message),
			socket: {
				on: (event, handler) => {
					receive = handler;
				},
			},
			draw_trigger: (fn) => fn(),
			reject_deferred: (place, data) => results.push(data),
			resolve_deferred: (place, data) => results.push(data),
			d_text() {
				throw new Error("no graphics should be used for this feedback");
			},
		}),
	);
	load(ctx, "js/functions.js", [
		"anniversary_live_event",
		"anniversary_can_visit",
		"anniversary_visit_reason",
		"anniversary_kiss",
	]);
	load(ctx, "js/html.js", ["anniversary_event_status_html", "anniversary_ui_button"]);
	assert.equal(ctx.anniversary_can_visit(), false);
	assert.match(ctx.anniversary_event_status_html(), /No kiss rewards or buff: Realm Fatigue/);
	assert.match(ctx.anniversary_event_status_html(), / disabled/);
	ctx.S.anniversary.available = false;
	assert.match(ctx.anniversary_event_status_html(), /Realm Fatigue/);
	assert.doesNotMatch(ctx.anniversary_event_status_html(), /Your Visit stays valid/);
	ctx.S.anniversary.available = true;
	ctx.anniversary_kiss();
	assert.match(logs.pop(), /Realm Fatigue/);
	const client = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
	const start = client.indexOf('socket.on("game_response",');
	vm.runInContext(client.slice(start, client.indexOf("\n\tsocket.on(", start + 1)), ctx);
	for (const owned of [false, true]) {
		h.visitor.p.acx.ikissyou = owned;
		h.cast();
		const result = h.emitted.findLast(([event]) => event === "game_response")[1];
		receive(plain(result));
		assert.equal(results.at(-1).reason, "realmfatigue");
		assert.match(logs.pop(), /No kiss rewards or buff: Realm Fatigue/);
	}
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
