"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const acorn = require("acorn");
const D = require("./helpers/design");
const { read, extract, load } = require("./helpers/server_vm");
require("../../js/progression/sources");
const Stats = require("../../js/progression/stats");
const Progression = require("../../js/progression/engine");
const Runtime = require("../../js/progression/runtime");
const helpers = Stats.helpers(D, { characterSlots: D.character_slots, doublehandTypes: D.doublehand_types });
const engine = Progression.create(D, helpers);
function snapshot(ctype = "paladin", extra = {}) {
	return Object.assign(
		{
			ctype,
			name: "GuideTest",
			id: "GuideTest",
			level: 15,
			gold: 100000,
			map: "main",
			realm: "EU I",
			items: [
				{ name: "hpot0", q: 100 },
				{ name: "mpot0", q: 100 },
			],
			slots: structuredClone(D.classes[ctype].base_slots),
			now: 1000000,
		},
		extra,
	);
}
function equipment(ctype, weapon = 5, armor = 3, accessories = false) {
	const slots = { mainhand: { name: Progression.weapons[ctype], level: weapon } };
	const stat = D.classes[ctype].main_stat;
	for (const [slot, name] of Object.entries(Progression.body)) slots[slot] = { name, level: armor, stat_type: stat };
	if (["paladin", "mage", "priest"].includes(ctype)) slots.offhand = { name: "wbook0", level: 2 };
	if (accessories !== false)
		for (const slot of ["amulet", "earring1", "earring2", "ring1", "ring2"])
			slots[slot] = { name: stat + slot.replace(/[12]$/, ""), level: accessories };
	return slots;
}
function adapter(ctype = "paladin", extra = {}) {
	const socket = new EventEmitter(),
		c = snapshot(ctype, extra),
		entities = {};
	let at = 1000000;
	const runtime = Runtime.create({
		G: D,
		characterSlots: D.character_slots,
		doublehandTypes: D.doublehand_types,
		character: () => c,
		realm: () => "EU I",
		entities: () => entities,
		socket: () => socket,
		status: () => ({}),
		nextSkill: () => 0,
		now: () => at,
	});
	runtime.attach();
	return { runtime, socket, c, entities, advance: (ms) => (at += ms) };
}
test("packaged stat functions remain identical to the native sources", () => {
	const packaged = read("js/progression/stats.js");
	function ast(source) {
		return JSON.parse(
			JSON.stringify(acorn.parse(source, { ecmaVersion: 2020 }), (key, value) => {
				if (["start", "end", "raw"].includes(key)) return undefined;
				// Formatting can remove quotes from an ordinary object key.
				if (value && value.type === "Property" && !value.computed && value.key.type === "Identifier")
					return { ...value, key: { type: "Literal", value: value.key.name } };
				return value;
			}),
		);
	}
	for (const [file, names] of [
		["node/server.js", ["apply_stats", "calculate_common_stats", "calculate_player_stats"]],
		["node/server_functions.js", ["weapon_stat_attack"]],
		[
			"js/old_common_functions.js",
			["calculate_item_properties", "calculate_item_grade", "adopt_extras", "damage_multiplier"],
		],
	]) {
		for (const name of names) assert.deepEqual(ast(extract(packaged, name)), ast(extract(read(file), name)), name);
	}
	const prelude = (text) => text.slice(text.indexOf("var stat_to_attr ="), text.indexOf("function apply_stats"));
	assert.deepEqual(ast(prelude(packaged)), ast(prelude(read("node/server.js"))));
	const native = read("node/server.js")
		.split('} else if (scroll_def.type == "pscroll")')[1]
		.match(/var needed = (\[[^;]+\]);/)[1];
	assert.deepEqual(Stats.statScrollQuantities, JSON.parse(native));
});
test("projection executes current native functions and item curves for every class", () => {
	const native = vm.createContext({
		...D,
		G: D,
		goldm: 1,
		luckm: 1,
		xpm: 1,
		mode: {},
		parties: {},
		perfc: { cps: 0 },
		recalculate_vxy() {},
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats")), native);
	load(native, "node/server.js", ["apply_stats", "calculate_common_stats", "calculate_player_stats"]);
	load(native, "node/server_functions.js", ["weapon_stat_attack"]);
	for (const ctype of Object.keys(Progression.weapons))
		for (const level of [1, 40, 55, 65, 80, 100, 140, 200]) {
			const s = snapshot(ctype, { level });
			assert.equal(engine.normalize(s).level, level);
			for (const [slot, name] of Object.entries(Progression.body))
				s.slots[slot] = { name, level: 7, stat_type: D.classes[ctype].main_stat };
			s.slots.mainhand.level = 8;
			const p = {
				type: ctype,
				level,
				xp: 0,
				gold: 0,
				hp: 0,
				mp: 0,
				items: [],
				citems: [],
				slots: structuredClone(s.slots),
				s: {},
				p: {},
				map: "main",
				targets_p: 0,
				targets_m: 0,
				targets_u: 0,
				damage_type: D.classes[ctype].damage_type,
			};
			native.calculate_player_stats(p);
			const actual = engine.calculate(ctype, level, s.slots, "main");
			for (const key of ["attack", "heal", "max_hp", "max_mp", "armor", "resistance", "frequency", "speed", "range"])
				assert.equal(actual[key], p[key], ctype + ":" + level + ":" + key);
		}
});
test("newcomers get Bees and legal equipment; Priest and Merchant goals differ", () => {
	for (const ctype of Object.keys(Progression.weapons)) {
		const result = engine.evaluate(snapshot(ctype));
		assert.equal(result.rows.length <= 3, true);
		assert.equal(result.goal.kind, ctype === "merchant" ? "shop" : "stat");
		if (ctype === "priest") assert.equal(result.goal.metric, "heal");
		if (ctype === "paladin") assert(result.rows.some((row) => row.action.route && row.action.route.monster === "bee"));
		for (const row of result.rows)
			if (row.target) assert(engine.legal(ctype, row.slot, row.target, snapshot(ctype).slots, 15));
	}
});
test("recipes expand actual outputs, levels, token sources and gathering tables", () => {
	for (const [name, expected] of [
		["quiver", "beewings"],
		["oathplate", "coat1"],
		["wblade", "stick"],
	]) {
		const plan = engine.acquire({ name, level: 0 }, engine.normalize(snapshot()), []);
		const craft = plan.tree.alternatives.find((a) => a.kind === "craft");
		assert(craft.inputs.some((i) => i.name === expected));
		assert(plan.visited <= Progression.policy.nodes);
	}
	assert(engine.index.sources("concordmace").some((s) => s.kind === "token" && s.quantity === 12));
	assert(engine.index.sources("cxjar").some((s) => s.kind === "craft" && s.recipe === "makeawishjar"));
	assert(engine.index.sources("coat1").some((s) => s.kind === "gather"));
	for (const [id, recipe] of Object.entries(D.craft)) {
		const output = recipe.output ? recipe.output.name : id;
		const source = engine.index.sources(output).find((s) => s.kind === "craft" && s.recipe === id);
		assert(source, id);
		assert.equal(
			JSON.stringify(source.inputs),
			JSON.stringify(recipe.items.map((i) => ({ name: i[1], quantity: i[0], level: i[2] || 0 }))),
		);
	}
	const snakes = engine.index.routes.filter((r) => r.monster === "snake");
	assert.equal(
		engine.index.dropRate(
			snakes.find((r) => r.map === "main"),
			"stramulet",
		),
		0,
	);
	assert(
		engine.index.dropRate(
			snakes.find((r) => r.map === "halloween"),
			"stramulet",
		) > 0,
	);
});
test("newcomer lessons finish at 1000 Attack and open rings while earrings need a party", () => {
	const slots = equipment("paladin", 7, 5);
	slots.amulet = { name: "stramulet", level: 2 };
	const midway = engine.evaluate(snapshot("paladin", { level: 50, slots }));
	assert.equal(midway.lessons.find((l) => !l.complete).id, "earrings");
	assert(midway.rows.some((r) => r.target && r.target.name === "strearring"));
	assert(midway.rows.some((r) => r.action.route && r.action.route.monster === "arcticbee"));
	assert(!midway.rows.some((r) => r.target && r.target.name === "stramulet" && r.target.level > 2));
	const complete = engine.evaluate(
		snapshot("paladin", { level: 77, slots: equipment("paladin", 8, 7, 2), conditions: { warcry: { ms: 60000 } } }),
	);
	assert.equal(complete.progress.value, 1011);
	assert(complete.complete);
	assert.equal(complete.lessons.length, 0);
});
test("owned Bee materials turn into practical Cole projects", () => {
	const ranger = engine.evaluate(
		snapshot("ranger", {
			level: 50,
			slots: equipment("ranger", 7, 5, 0),
			items: [...snapshot().items, { name: "beewings", q: 150 }, { name: "ascale", q: 1 }],
		}),
	);
	assert(
		ranger.rows.some(
			(r) => r.target && r.target.name === "quiver" && r.target.level === 2 && r.action.route.monster === "bee",
		),
	);
	const paladin = engine.evaluate(
		snapshot("paladin", {
			level: 35,
			slots: equipment("paladin"),
			items: [...snapshot().items, { name: "beewings", q: 60 }, { name: "spores", q: 30 }, { name: "crabclaw", q: 2 }],
		}),
	);
	assert(
		paladin.rows.some(
			(r) =>
				r.target && r.target.name === "vowkeepergloves" && r.action.kind === "craft" && r.action.npc === "mcollector",
		),
	);
});
test("locked equipment can be worn or finish a goal, but cannot be consumed", () => {
	const s = snapshot("paladin", { items: [...snapshot().items, { name: "mace", level: 7, l: "l" }] });
	const equip = engine.evaluate(s).rows.find((r) => r.kind === "equip");
	assert(equip);
	assert.equal(equip.action.name, "mace");
	assert.equal(equip.action.level, 7);
	assert(engine.evaluate({ ...s, goal: { kind: "item", name: "mace", level: 7 } }).complete);
	assert(!engine.inventory(engine.normalize(s)).bag.some((i) => i.name === "mace"));
});
test("quantity goals count owned items once and visible projects share one budget", () => {
	const s = snapshot("paladin", {
		items: [...snapshot().items, { name: "stramulet", level: 0 }],
		goal: { kind: "item", name: "stramulet", quantity: 2 },
	});
	const result = engine.evaluate(s);
	assert.equal(result.progress.value, 1);
	assert.equal(result.complete, false);
	assert.equal(result.plans[0].tree.owned, 1);
	assert.equal(result.plans[0].tree.remaining, 1);
	for (const gold of [7000, 10000, 30000, 100000]) {
		const advice = engine.evaluate(
			snapshot("paladin", {
				gold,
				items: [...snapshot().items, { name: "mace", level: 2 }, { name: "scroll0", q: 1 }],
			}),
		);
		assert(advice.rows.filter((r) => r.affordable).reduce((sum, r) => sum + r.cost, 0) <= advice.budget);
		const used = {},
			slots = new Set();
		for (const row of advice.rows) {
			if (row.slot) {
				assert(!slots.has(row.slot));
				slots.add(row.slot);
			}
			for (const use of row.resources) {
				used[use.num] = (used[use.num] || 0) + use.quantity;
				assert(used[use.num] <= 1);
			}
		}
	}
});
test("compounding uses three exact-level bag spares and preserves worn items", () => {
	const extra = {
		slots: { amulet: { name: "stramulet", level: 1 } },
		items: [
			{ name: "stramulet", level: 0 },
			{ name: "stramulet", level: 1 },
			{ name: "stramulet", level: 1, l: "l" },
			{ name: "stramulet", level: 1 },
		],
	};
	let s = engine.normalize(snapshot("paladin", extra)),
		plan = engine.acquire({ name: "stramulet", level: 2 }, s, []);
	assert(!plan.tree.alternatives.some((a) => a.kind === "compound"));
	extra.items.push({ name: "stramulet", level: 1 });
	plan = engine.acquire({ name: "stramulet", level: 2 }, engine.normalize(snapshot("paladin", extra)), []);
	const compound = plan.tree.alternatives.find((a) => a.kind === "compound");
	assert.equal(compound.resources.length, 3);
	assert.deepEqual(
		compound.resources.map((r) => r.num),
		[1, 3, 4],
	);
	assert.equal(compound.scroll, "cscroll0");
});
test("native crafting requires one sufficient stack; protected resources stay unavailable", () => {
	const s = engine.normalize(
		snapshot("paladin", {
			items: [
				{ name: "beewings", q: 100 },
				{ name: "beewings", q: 100 },
				{ name: "ascale", q: 1 },
			],
		}),
	);
	const plan = engine.acquire({ name: "quiver", level: 0 }, s, []);
	assert.equal(plan.tree.alternatives.find((a) => a.kind === "craft").ready, false);
	const ready = engine.acquire(
		{ name: "quiver", level: 0 },
		engine.normalize(
			snapshot("paladin", {
				items: [
					{ name: "beewings", q: 200 },
					{ name: "ascale", q: 1 },
				],
			}),
		),
		[],
	);
	assert.equal(ready.tree.next.kind, "craft");
	assert.equal(ready.tree.next.npc, "mcollector");
});
test("unsafe observations override optimistic farming estimates", () => {
	const s = engine.normalize(snapshot()),
		route = engine.index.routes.find((r) => r.monster === "bee" && r.map === "main");
	s.observations = {
		"main:bee": {
			at: s.now,
			realm: s.realm,
			loadout: s.loadout,
			kills: 20,
			credited: 20,
			netGold: 500,
			seconds: 100,
			deaths: 1,
		},
	};
	assert.equal(
		engine.assess(s, engine.calculate(s.ctype, s.level, s.durable, s.map), route, engine.reachable(s)).safe,
		false,
	);
});
test("events retain instance identity, expire without packets, and never imply solo readiness", () => {
	const socket = new EventEmitter();
	let at = 1000000;
	const c = snapshot("paladin");
	const runtime = Runtime.create({
		G: D,
		characterSlots: D.character_slots,
		doublehandTypes: D.doublehand_types,
		character: () => c,
		realm: () => "EU I",
		entities: () => ({}),
		socket: () => socket,
		status: () => ({}),
		now: () => at,
	});
	runtime.attach();
	socket.emit("server_info", { snowman: { live: true, hp: 1000 } });
	let first = runtime.read().opportunities.find((e) => e.event === "snowman");
	assert(first);
	assert(first.informational);
	at += 1000;
	socket.emit("server_info", { snowman: { live: true, hp: 900 } });
	assert.equal(runtime.read().opportunities.find((e) => e.event === "snowman").id, first.id);
	at += 90001;
	assert.equal(runtime.read().opportunities.length, 0);
	socket.emit("server_info", {});
	socket.emit("server_info", { snowman: { live: true, hp: 1000 } });
	assert.notEqual(runtime.read().opportunities[0].id, first.id);
	runtime.detach();
	assert.equal(socket.listenerCount("server_info"), 0);
});
test("announcements appear immediately without refreshing stale events or granting credit", () => {
	const a = adapter();
	a.socket.emit("server_info", { snowman: { live: true, hp: 1000 } });
	a.advance(90001);
	a.socket.emit("game_event", { name: "franky", map: "level2w" });
	const advice = a.runtime.read();
	assert(!advice.opportunities.some((o) => o.event === "snowman"));
	assert(advice.opportunities.some((o) => o.event === "franky" && o.informational));
	assert(advice.choices.some((g) => g.kind === "encounter" && g.monster === "franky"));
	a.socket.emit("disconnect");
	assert.equal(a.runtime.read().opportunities.length, 0);
	a.runtime.detach();
});
test("market evidence expires even when the visual entity keeps updating", () => {
	const a = adapter();
	a.entities.Seller = { stand: true, last_ms: 1000000 };
	a.socket.emit("entities", {
		players: [
			{
				id: "Seller",
				stand: true,
				slots: {
					trade1: { name: "strearring", level: 0, price: 70000, rid: "offer1" },
					trade2: { name: "strring", price: 1, rid: "buyorder", b: true },
				},
			},
		],
	});
	assert.equal(a.runtime.snapshot().listings.length, 1);
	a.advance(90001);
	a.entities.Seller.last_ms += 90001;
	a.socket.emit("entities", { players: [{ id: "Seller", x: 10 }] });
	assert.equal(a.runtime.snapshot().listings.length, 0);
	a.runtime.detach();
});
test("native credit includes healers and gathering completes only on a successful response", () => {
	const healer = adapter("priest");
	healer.socket.emit("kill_credit", { mtype: "snowman" });
	assert(healer.runtime.read({ goal: { kind: "encounter", monster: "snowman" } }).complete);
	assert.equal(Object.keys(healer.runtime.snapshot().observations).length, 0);
	healer.runtime.detach();
	const merchant = adapter("merchant", { level: 20, mp: 500, slots: { mainhand: { name: "rod", level: 0 } } });
	const options = { goal: { kind: "gather", skill: "fishing" } };
	assert(!merchant.runtime.read(options).complete);
	merchant.socket.emit("ui", { type: "fishing_none", name: "GuideTest", cevent: true });
	assert(!merchant.runtime.read(options).complete);
	merchant.socket.emit("game_response", { response: "data", cevent: "fishing_success", slot: "mainhand" });
	assert(merchant.runtime.read(options).complete);
	merchant.runtime.detach();
});
test("UI entry points return before DOM or PIXI in no-graphics CODE", () => {
	const context = vm.createContext({ no_graphics: true, storage_set() {} });
	Object.defineProperty(context, "PIXI", {
		get() {
			throw Error("PIXI touched");
		},
	});
	Object.defineProperty(context, "$", {
		get() {
			throw Error("DOM touched");
		},
	});
	vm.runInContext(read("js/progression/ui.js"), context);
	context.progression_art({ monster: "phoenix" });
	context.progression_details();
	context.progression_fold(true);
	context.progression_open({ kind: "craft" });
	context.progression_travel({ type: "npc", id: "basics" });
	context.set_progression_guide(false);
});

test("native travel confirms the selected source without changing named travel", () => {
	const calls = [];
	let confirm;
	const context = vm.createContext({
		G: D,
		window: {},
		show_confirm(text, yes, cancel, action) {
			confirm = { text, action };
		},
		hide_modals() {},
		call_code_function_f(...args) {
			calls.push(JSON.parse(JSON.stringify(args)));
		},
	});
	load(context, "js/html.js", ["smart_smart_move"]);
	const point = { map: "halloween", x: -569, y: -511.5 };
	context.smart_smart_move("monster", "snake", point);
	assert(confirm.text.includes(D.maps.halloween.name));
	assert.deepEqual(calls, []);
	// A later change to a recommendation must not change an open confirmation.
	point.map = "main";
	confirm.action();
	assert.deepEqual(calls.pop(), ["smart_move", { map: "halloween", x: -569, y: -511.5 }]);
	context.smart_smart_move("npc", "basics");
	confirm.action();
	assert.deepEqual(calls.pop(), ["smart_move", "basics"]);
	confirm = null;
	context.smart_smart_move("monster", "snake", { map: "missing", x: 1, y: 2 });
	context.smart_smart_move("npc", "missing", { map: "main", x: 1, y: 2 });
	context.smart_smart_move("map", "main", { map: "main", x: NaN, y: 2 });
	assert.equal(confirm, null);
	context.window.no_graphics = true;
	Object.defineProperty(context, "G", {
		get() {
			throw Error("game definitions touched in no-graphics travel");
		},
	});
	context.smart_smart_move("npc", "basics");
	context.smart_smart_move("monster", "snake", point);
	assert.deepEqual(calls, []);
});

test("missing exchange inputs lead back to their actual farming sources", () => {
	const result = engine.evaluate(
		snapshot("paladin", { level: 77, slots: equipment("paladin", 8, 7, 2), goal: { kind: "item", name: "coat1" } }),
	);
	let leather;
	function visit(node) {
		if (node.name === "leather" && node.next) leather = node;
		for (const a of node.alternatives) for (const child of a.inputs || []) visit(child);
	}
	visit(result.plans[0].tree);
	assert(leather);
	assert.equal(leather.quantity, 40);
	assert.equal(leather.next.kind, "farm");
	assert(engine.index.dropRate(leather.next.route, "leather") > 0);
	assert(result.rows.filter((row) => row.kind === "hunt").length <= 1);
});

test("published examples execute through the regular CODE parent adapter", () => {
	const a = adapter("ranger", { level: 50, slots: equipment("ranger", 7, 5, 0) }),
		sent = [];
	a.socket.emit = (name, data) => {
		sent.push({ name, data });
	};
	const context = vm.createContext({
		parent: { progression_read: (options) => a.runtime.read(options) },
		show_json() {},
	});
	vm.runInContext(extract(read("js/runner_functions.js"), "get_progression"), context);
	for (const file of ["docs/guide/progression-guide.html", "docs/functions/get_progression.html"]) {
		for (const code of read(file).matchAll(/<div class="code"(?: id="[^"]*")?>([\s\S]*?)<\/div>/g))
			vm.runInContext(code[1], context, { timeout: 1000 });
	}
	assert(context.advice.ready);
	assert.deepEqual(sent, []);
	a.runtime.detach();
});

test("a 91-Attack Ranger develops a spare bow before buying ten stat scrolls for Ice Skates", () => {
	for (const gold of [100000, 10000000]) {
		const s = snapshot("ranger", {
			level: 7,
			gold,
			slots: { ...D.classes.ranger.base_slots, shoes: { name: "iceskates", level: 0 } },
		});
		const result = engine.evaluate(s);
		assert.equal(result.stats.attack, 91);
		assert.equal(result.rows[0].target.name, "bow");
		assert.equal(result.rows[0].target.level, 3);
		assert.equal(result.rows[0].gain.amount, 28);
		assert.equal(result.rows[0].cost, 16000);
		assert(!result.rows.some((r) => r.kind === "stat" && r.target.name === "iceskates"));
		const farm = result.rows.find((r) => r.kind === "farm");
		assert.equal(farm.action.route.monster, "goo");
		assert.equal(farm.action.route.trial, false);
		assert.equal(farm.reason.id, "progression.reason.level");
	}
	const free = engine.evaluate(
		snapshot("ranger", {
			level: 7,
			slots: { ...D.classes.ranger.base_slots, shoes: { name: "iceskates", level: 0 } },
			items: [
				{ name: "hpot0", q: 100 },
				{ name: "mpot0", q: 100 },
				{ name: "dexscroll", q: 10 },
			],
		}),
	);
	assert(
		free.rows.some((r) => r.kind === "stat" && r.cost === 0 && r.gain.amount === 3),
		"already owned scrolls still provide a useful free improvement",
	);
});

test("trial fights depend on combat estimates, not missing play history", () => {
	const s = engine.normalize(snapshot("paladin", { level: 15 }));
	const stats = engine.calculate(s.ctype, s.level, s.durable, s.map);
	const routes = engine.index.routes.map((r) => engine.assess(s, stats, r, engine.reachable(s)));
	assert(routes.some((r) => r.safe && !r.proven && !r.trial && r.monster === "bee"));
	assert(routes.some((r) => r.safe && !r.proven && r.trial && r.monster !== "goo"));
});

test("seasonal notices survive socket reattachment and use the actual event item art", () => {
	const a = adapter();
	a.socket.emit("server_info", { anniversary: { active: true, round: "one", id: "featured-one" } });
	const first = a.runtime.read().opportunities.find((o) => o.event === "anniversary");
	assert.deepEqual(first.art, { item: "sixcake" });
	assert.deepEqual(
		Array.from(engine.index.locations.anniversary_baker[0].position),
		Array.from(D.maps.main.seasonal_npcs.find((npc) => npc.id === "anniversary_baker").position),
	);
	a.runtime.detach();
	a.advance(10000);
	a.runtime.attach();
	a.socket.emit("server_info", { anniversary: { active: true, round: "two", id: "featured-two" } });
	const second = a.runtime.read().opportunities.find((o) => o.event === "anniversary");
	assert.equal(second.notice, first.notice);
	assert.notEqual(second.id, first.id, "combat evidence still belongs to its exact event instance");
});

test("stat advice buys only missing scrolls and reserves the owned stack", () => {
	const slots = equipment("ranger", 9, 9, 3);
	slots.shoes = { name: "iceskates", level: 9 };
	const result = engine.evaluate(
		snapshot("ranger", {
			level: 77,
			slots,
			gold: 200000,
			goal: { kind: "stat", metric: "attack", target: 100000 },
			items: [
				{ name: "hpot0", q: 100 },
				{ name: "mpot0", q: 100 },
				{ name: "dexscroll", q: 99 },
			],
		}),
	);
	const row = result.rows.find((r) => r.kind === "stat");
	assert(row);
	assert.equal(row.action.quantity, 100);
	assert.equal(row.cost, D.items.dexscroll.g);
	assert.deepEqual(row.resources, [{ num: 2, quantity: 99 }]);
});

test("a ready spare-ring compound outranks distant work without consuming worn rings", () => {
	const slots = equipment("rogue", 5, 3, 0);
	slots.offhand = { name: "claw", level: 5 };
	slots.amulet.level = 2;
	const items = [
		{ name: "hpot0", q: 100 },
		{ name: "mpot0", q: 100 },
		{ name: "cscroll0", q: 1 },
		...Array.from({ length: 3 }, () => ({ name: "dexring", level: 0 })),
	];
	const result = engine.evaluate(snapshot("rogue", { level: 65, slots, items }));
	assert.equal(result.rows[0].kind, "compound");
	assert.equal(result.rows[0].action.level, 1);
	assert.equal(result.rows[0].cost, 0);
	assert.deepEqual(result.rows[0].resources.map((r) => r.num).sort(), [2, 3, 4, 5]);
});

test("stocked Merchants trade instead of farming or buying personal potions", () => {
	const slots = { trade1: { name: "beewings", q: 5, price: 500, rid: "own" } };
	const s = snapshot("merchant", {
		level: 85,
		shopOpen: true,
		slots,
		items: [
			{ name: "mpot1", q: 100 },
			{ name: "mpotx", q: 9722 },
		],
	});
	for (const goal of [
		null,
		{ kind: "gold", target: 1000000 },
		{ kind: "gather", skill: "mining" },
		{ kind: "item", name: "rod" },
	]) {
		const r = engine.evaluate({ ...s, goal });
		assert(!r.rows.some((row) => row.kind === "farm" || row.kind === "supplies"), JSON.stringify(r.rows));
		assert(!r.choices.some((g) => ["farm", "stat", "encounter"].includes(g.kind)));
	}
	const r = engine.evaluate(s);
	assert.equal(r.goal.kind, "trade");
	assert.equal(r.progress.target, null);
	assert.equal(r.complete, false);
	assert.equal(r.rows[0].action.npc, "secondhands");
	assert(r.rows.some((row) => row.id === "shop:keep"));
	const beginner = engine.evaluate(snapshot("merchant", { level: 1, gold: 0, items: [] }));
	assert(!beginner.choices.some((g) => g.kind === "gather"));
	assert(!beginner.rows.some((row) => row.kind === "farm" || row.kind === "supplies"));
});
test("potion advice counts every restorative tier and distinguishes locked stock from a purchase", () => {
	const s = snapshot("ranger", {
		items: [
			{ name: "hpotx", q: 20 },
			{ name: "mpotx", q: 35 },
		],
	});
	assert(!engine.evaluate(s).rows.some((r) => r.kind === "supplies"));
	const busy = adapter("ranger", { items: s.items, q: { upgrade: { num: 2 } } });
	assert(!busy.runtime.read().rows.some((r) => r.kind === "supplies"));
	busy.runtime.detach();
	const locked = engine.evaluate({
		...s,
		items: [
			{ name: "hpotx", q: 20, l: "l" },
			{ name: "mpotx", q: 35 },
		],
	}).rows[0];
	assert.equal(locked.action.unlock, true);
	assert.equal(locked.cost, 0);
	assert.equal(locked.action.npc, undefined);
	const low = engine.evaluate({
		...s,
		items: [
			{ name: "hpotx", q: 19 },
			{ name: "mpotx", q: 35 },
		],
	}).rows[0];
	assert.equal(low.kind, "supplies");
	assert.equal(low.action.quantity, 1);
	assert.equal(low.action.name, "hpot0");
	assert.equal(low.reason.args.mp, 35);
});
test("Merchant resale evidence uses native full-stack costs and current sales tax", () => {
	const native = vm.createContext({ G: D, round: Math.round });
	vm.runInContext(extract(read("js/old_common_functions.js"), "calculate_item_value"), native);
	const a = adapter("merchant", {
		level: 85,
		gold: 500000,
		tax: 0.01,
		stand: true,
		slots: { trade1: { name: "beewings", q: 5, price: 500 } },
	});
	// Runtime reads the native helper already present in browser and CODE globals.
	const old = globalThis.calculate_item_value;
	globalThis.calculate_item_value = native.calculate_item_value;
	try {
		a.socket.emit("entities", {
			players: [
				{
					id: "Buyer",
					stand: true,
					map: "main",
					slots: { trade1: { name: "staff", level: 0, b: true, q: 3, price: 30000, rid: "bid" } },
				},
			],
		});
		assert.equal(a.runtime.snapshot().listings.length, 0, "buy orders cannot become acquisition offers");
		a.socket.emit("game_response", {
			response: "data",
			place: "secondhands",
			items: [{ name: "staff", level: 0, q: 3, rid: "stock" }],
		});
		let quote = a.runtime.read({ goal: { kind: "trade", market: "secondhands" } }).rows.find((r) => r.action.quote)
			?.action.quote;
		assert(quote);
		assert.equal(
			quote.cost,
			native.calculate_item_value({ name: "staff", level: 0 }) * D.multipliers.secondhands_mult * 3,
		);
		assert.equal(quote.proceeds, Math.round(30000 * 3 * 0.99));
		assert.equal(quote.margin, quote.proceeds - quote.cost);
		a.socket.emit("entities", {
			players: [
				{
					id: "Buyer",
					stand: true,
					slots: { trade1: { name: "staff", level: 0, b: true, q: 2, price: 30000, rid: "small" } },
				},
			],
		});
		assert(!a.runtime.read().rows.some((r) => r.action.quote), "partial buy order cannot cover a recovered stack");
		a.socket.emit("entities", {
			players: [
				{
					id: "Buyer",
					stand: true,
					slots: { trade1: { name: "staff", level: 0, b: true, q: 3, price: 100000, rid: "bid2" } },
				},
			],
		});
		a.c.map = "woffice";
		a.socket.emit("new_map", {});
		a.socket.emit("lostandfound", [{ name: "staff", level: 0, q: 3, rid: "ron-stock" }]);
		quote = a.runtime.read().rows.find((r) => r.action.quote)?.action.quote;
		assert(quote);
		assert.equal(
			quote.cost,
			native.calculate_item_value({ name: "staff", level: 0 }) * D.multipliers.lostandfound_mult * 3,
		);
		assert.equal(quote.buyer.map, "main", "recent research survives travel to Ron");
		assert(!a.runtime.read({ spendLimit: 1 }).rows.some((r) => r.action.quote));
		a.advance(90001);
		assert(!a.runtime.read().rows.some((r) => r.action.quote), "expired demand cannot imply a resale");
		a.socket.emit("game_response", { response: "lostandfound_donate", reason: "donation_required" });
		assert(a.runtime.read().rows.some((r) => r.reason.id === "progression.reason.market_unlock"));
		a.socket.emit("disconnect");
		assert.equal(Object.keys(a.runtime.snapshot().markets).length, 0);
	} finally {
		a.runtime.detach();
		if (old) globalThis.calculate_item_value = old;
		else delete globalThis.calculate_item_value;
	}
});

function exampleCode(html) {
	return html.replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
}
function merchantExample(file, id) {
	return exampleCode(read(file).match(new RegExp('<div class="code" id="' + id + '">([\\s\\S]*?)<\\/div>'))[1]);
}
test("Merchant articles preserve executable CODE blocks and line comments", () => {
	for (const [file, count] of [
		["docs/guide/shops-and-selling.html", 2],
		["docs/guide/markets-and-trading.html", 3],
		["docs/tutorial/merchant-supplies.html", 1],
	]) {
		const blocks = Array.from(read(file).matchAll(/<div class="code"[^>]*>([\s\S]*?)<\/div>/g));
		assert.equal(blocks.length, count, file);
		for (const [index, block] of blocks.entries())
			assert.doesNotThrow(() => new vm.Script(exampleCode(block[1])), file + " block " + (index + 1));
	}
});
function nativeMerchant(t, items, away = false) {
	const a = adapter("merchant", {
			level: 85,
			tax: 0.01,
			stand: true,
			items: structuredClone(items),
			slots: { trade1: { name: "beewings", q: 5, price: 500 } },
			gold: 500000,
		}),
		actions = [],
		shown = [];
	a.c.real_x = 0;
	a.c.real_y = 0;
	const context = vm.createContext({
		Dev: false,
		console,
		setTimeout,
		clearTimeout,
		Date,
		Math,
		character: a.c,
		socket: a.socket,
		last_npc_right_click: new Date(0),
		code_settings: { log_smart_move: false },
		show_json: (o) => shown.push(o),
		$: () => ({ html() {}, data() {} }),
	});
	for (const file of ["common/js/common_functions.js", "js/old_common_functions.js"])
		vm.runInContext(read(file), context);
	context.G = D;
	context.parent = {
		G: D,
		S: {},
		entities: {},
		X: { characters: [{ name: "GuideTest" }, { name: "Fighter" }] },
		party: { Fighter: { map: "main", type: "ranger", x: 10, y: 10 } },
		progression_read: (options) => a.runtime.read(options),
		push_deferred: context.push_deferred,
		socket: a.socket,
	};
	vm.runInContext(extract(read("js/functions.js"), "buy_with_gold"), context);
	context.parent.buy_with_gold = context.buy_with_gold;
	for (const name of [
		"get_characters",
		"get_party",
		"get_player",
		"find_npc",
		"smart_move",
		"buy_with_gold",
		"send_item",
		"wait_for_event",
		"get_secondhands",
		"get_lost_and_found",
		"get_progression",
	])
		vm.runInContext(extract(read("js/runner_functions.js"), name), context);
	context.smart = { moving: false, on_done() {} };
	const original = a.socket.emit.bind(a.socket);
	a.socket.emit = (event, data) => {
		if (!["buy", "send", "secondhands", "lostandfound"].includes(event)) return original(event, data);
		actions.push({ event, data: structuredClone(data) });
		setImmediate(() => {
			if (event === "buy") {
				assert.equal(a.c.map, "main");
				assert(Math.hypot(a.c.real_x + 35, a.c.real_y + 162) < 10);
				const item = a.c.items.find((i) => i?.name === data.name && !i.l);
				if (item) item.q += data.quantity;
				else a.c.items.push({ name: data.name, q: data.quantity });
				a.c.gold -= D.items[data.name].g * data.quantity;
				context.resolve_deferreds("buy", { success: true });
			} else if (event === "send") {
				assert.equal(data.name, "Fighter");
				assert(!away);
				a.c.items[data.num].q -= data.q;
				if (!a.c.items[data.num].q) a.c.items[data.num] = null;
				context.resolve_deferreds("send", { success: true });
			} else
				original("game_response", {
					place: event,
					response: "data",
					request_id: data.request_id,
					items: [{ name: "staff", level: 0, rid: "stock" }],
				});
		});
		return true;
	};
	t.after(() => a.runtime.detach());
	function arrive() {
		a.c.map = context.smart.map;
		a.c.real_x = context.smart.x;
		a.c.real_y = context.smart.y;
		context.smart.moving = false;
		if (!away)
			context.parent.entities.Fighter = { name: "Fighter", type: "character", map: "main", real_x: 10, real_y: 10 };
		context.smart.on_done(true);
	}
	return { a, context, actions, shown, arrive };
}
test("published delivery runs through native CODE and uses carried potions before buying", async (t) => {
	for (const items of [
		[
			{ name: "hpotx", q: 50 },
			{ name: "mpotx", q: 50 },
		],
		[
			{ name: "hpot0", q: 10 },
			{ name: "mpotx", q: 50 },
		],
	]) {
		const f = nativeMerchant(t, items);
		const run = vm.runInContext(
			merchantExample("docs/tutorial/merchant-supplies.html", "merchant-delivery-code"),
			f.context,
		);
		f.arrive();
		if (items[0].q < 40) {
			await new Promise((resolve) => setImmediate(resolve));
			await new Promise((resolve) => setImmediate(resolve));
			f.arrive();
		}
		await run;
		assert.equal(f.shown.at(-1).delivered, true);
		const buys = f.actions.filter((a) => a.event === "buy");
		assert.equal(buys.length, items[0].q < 40 ? 1 : 0);
		if (buys.length) assert.deepEqual(buys[0].data, { name: "hpot0", quantity: 30 });
		assert.equal(
			f.a.c.items.reduce((n, i) => n + (i?.name.startsWith("hpot") ? i.q : 0), 0),
			items[0].q < 40 ? 20 : 30,
		);
	}
	const gone = nativeMerchant(
		t,
		[
			{ name: "hpotx", q: 50 },
			{ name: "mpotx", q: 50 },
		],
		true,
	);
	const run = vm.runInContext(
		merchantExample("docs/tutorial/merchant-supplies.html", "merchant-delivery-code"),
		gone.context,
	);
	gone.arrive();
	await run;
	assert.equal(gone.actions.length, 0, "no delivery to a missing recipient");
});
test("published resale runs through native travel and request-id market responses without spending", async (t) => {
	const f = nativeMerchant(t, []);
	vm.runInContext("get_progression()", f.context);
	f.a.socket.emit("entities", {
		players: [
			{
				id: "Buyer",
				stand: true,
				slots: { trade1: { name: "staff", level: 0, b: true, q: 1, price: 35000, rid: "bid" } },
			},
		],
	});
	const old = globalThis.calculate_item_value;
	globalThis.calculate_item_value = D.calculate_item_value;
	try {
		const run = vm.runInContext(
			merchantExample("docs/guide/markets-and-trading.html", "merchant-resale-code"),
			f.context,
		);
		f.arrive();
		await run;
		assert(f.shown[0].resale);
		assert.equal(f.shown[0].resale.proceeds, 34650);
		assert.deepEqual(
			f.actions.map((a) => a.event),
			["secondhands"],
		);
	} finally {
		if (old) globalThis.calculate_item_value = old;
		else delete globalThis.calculate_item_value;
	}
});

test("published personal restocking counts carried large potions", async (t) => {
	const f = nativeMerchant(t, [
		{ name: "hpotx", q: 1000 },
		{ name: "mpotx", q: 9722 },
	]);
	await vm.runInContext(merchantExample("docs/guide/shops-and-selling.html", "shop-restock-code"), f.context);
	assert.deepEqual(f.actions, []);
	assert.equal(f.shown[0].hp, 1000);
	assert.equal(f.shown[0].mp, 9722);
});
