const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { read } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

const games = vm.runInNewContext(read("design/games.js") + ";games", { module: { exports: {} } });
const english = require("../../languages/en/definitions.js");
const dealer_def = G.npcs.pokerdealer;

// The dealer module in a Tavern with one watcher, a controllable table and every emitted act recorded.
function fixture(options = {}) {
	const emits = [];
	const npc = { id: "$Venn", ntype: "pokerdealer", in: "tavern", map: "tavern", x: -168, y: -103 };
	const watcher = { id: "Watcher", name: "Watcher", x: -150, y: -30, in: "tavern" };
	const tavern = {
		name: "tavern",
		players: options.empty ? {} : { Watcher: watcher },
		poker: { table: { seats: [null, null, null, null, null], hand: null } },
	};
	const c = vm.createContext({
		G: Object.assign({}, G, { games }),
		Math,
		Date,
		Object,
		JSON,
		server: { live: true, shutdown: false },
		tavern,
		instances: { tavern },
		npcs: { $Venn: npc },
		xy_emit: (entity, event, data) => emits.push({ entity: entity.id, event, data: plain(data) }),
	});
	vm.runInContext(read("node/logic/tavern.js"), c);
	vm.runInContext(read("node/logic/tavern_dealer.js"), c);
	return { c, npc, watcher, tavern, emits };
}

function ticks(f, count) {
	let now = Math.max(Date.now(), f.npc.dealer_next || 0);
	for (let i = 0; i < count; i++) {
		now += 13000;
		f.c.tavern_dealer_loop(f.npc, new Date(now));
	}
}

test("Venn is a distinct cosmetics NPC standing behind the poker table, with every line pool translated in English", () => {
	assert.equal(dealer_def.name, "Venn");
	assert.equal(dealer_def.citizen_behavior, "poker_dealer");
	assert.equal(dealer_def.role, "pokerdealer");
	const look = JSON.stringify([dealer_def.skin, dealer_def.cx]);
	for (const [id, other] of Object.entries(G.npcs))
		if (id != "pokerdealer" && other.name)
			assert.notEqual(JSON.stringify([other.skin, other.cx || {}]), look, "same look as " + id);
	const placed = G.maps.tavern.npcs.find((n) => n.id == "pokerdealer"),
		table = G.maps.tavern.machines.find((m) => m.type == "poker");
	assert.equal(placed.position[0], table.x, "centered on the table");
	assert.ok(placed.position[1] < table.y + games.poker.block[1], "stands behind the table's top edge");
	for (const pool of ["says", "idle", "invite", "deal", "allin", "win", "split"]) {
		assert.ok(dealer_def[pool].length, pool);
		dealer_def[pool].forEach((line, i) =>
			assert.equal(english["npc.pokerdealer." + pool + "." + i], line, pool + "." + i),
		);
	}
	for (const line of dealer_def.win) assert.equal(line.split("{name}").length, 2, "one {name} in " + line);
});

test("an empty table gets a show every few seconds, only while someone watches and never while closing", () => {
	const f = fixture();
	ticks(f, 200);
	const acts = f.emits.map((e) => e.data.act);
	assert.ok(f.emits.every((e) => e.event == "citizen" && e.data.type == "dealer" && e.data.id == "$Venn"));
	for (const act of ["mock", "shuffle", "flourish", "say", "emote"]) assert.ok(acts.includes(act), act + " happens");
	for (const e of f.emits) {
		if (e.data.act == "mock") assert.deepEqual(e.data.seats, [0, 1, 2, 3, 4]);
		if (e.data.act == "flourish") {
			const [rank, suit] = e.data.card.split("_");
			assert.ok(games.poker.ranks.includes(rank) && games.poker.suits.includes(suit), e.data.card);
		}
		if (e.data.act == "say") assert.match(e.data.line, /^idle\.[0-7]$/);
		if (e.data.act == "emote") assert.ok(G.skills[e.data.emote] && G.skills[e.data.emote].emote, e.data.emote);
	}
	// A second tick inside the cadence does nothing.
	const count = f.emits.length;
	f.c.tavern_dealer_loop(f.npc, new Date(f.npc.dealer_next - 1));
	assert.equal(f.emits.length, count);

	const alone = fixture({ empty: true });
	ticks(alone, 50);
	assert.equal(alone.emits.length, 0, "nobody to perform for");
	const far = fixture();
	far.watcher.x = 400;
	ticks(far, 50);
	assert.equal(far.emits.length, 0, "the watcher is across the room");
	const closing = fixture();
	closing.c.server.shutdown = true;
	ticks(closing, 50);
	assert.equal(closing.emits.length, 0, "a restart closes the show too");
});

test("one seated player hears invitations and mock deals to the four empty seats; a live hand stops the show", () => {
	const f = fixture();
	f.tavern.poker.table.seats[2] = { index: 2, name: "Solo" };
	ticks(f, 150);
	const acts = new Set(f.emits.map((e) => e.data.act));
	assert.deepEqual([...acts].sort(), ["mock", "say", "shuffle"]);
	for (const e of f.emits) {
		if (e.data.act == "say") assert.match(e.data.line, /^invite\.[0-2]$/);
		if (e.data.act == "mock") assert.deepEqual(e.data.seats, [0, 1, 3, 4]);
	}
	const busy = fixture();
	busy.tavern.poker.table.seats[0] = { index: 0 };
	busy.tavern.poker.table.seats[1] = { index: 1 };
	busy.tavern.poker.table.hand = { n: 3, over: false };
	ticks(busy, 60);
	assert.equal(busy.emits.length, 0, "the real hand is the show");
	busy.tavern.poker.table.hand.over = true;
	ticks(busy, 20);
	assert.ok(
		busy.emits.length > 0 && busy.emits.every((e) => e.data.act == "shuffle"),
		"between hands he only shuffles",
	);
});

test("hand announcements name the winner, call a split, and say all in once per hand", () => {
	const f = fixture();
	f.tavern.poker.table.hand = { n: 7, over: false };
	f.c.tavern_dealer_announce("deal");
	f.c.tavern_dealer_announce("allin");
	f.c.tavern_dealer_announce("allin");
	f.c.tavern_dealer_announce("win", { name: "Ada" });
	f.c.tavern_dealer_announce("split");
	const lines = f.emits.map((e) => e.data.line.split(".")[0]);
	assert.deepEqual(lines, ["deal", "allin", "win", "split"]);
	assert.equal(f.emits[2].data.name, "Ada");
	f.tavern.poker.table.hand = { n: 8, over: false };
	f.c.tavern_dealer_announce("allin");
	assert.equal(f.emits.length, 5, "a new hand may call all in again");
	assert.ok(f.npc.dealer_next > Date.now(), "an announcement holds the next idle act back");
	delete f.c.npcs.$Venn;
	f.c.tavern_dealer_announce("deal");
	assert.equal(f.emits.length, 5, "no dealer, no announcement");
});

test("the poker engine announces through the dealer when the module is loaded, and stays silent without it", () => {
	const source = read("node/logic/tavern_poker.js");
	assert.match(source, /typeof tavern_dealer_announce == "function"\) tavern_dealer_announce\("deal"\)/);
	assert.match(source, /tavern_dealer_announce\("allin"\)/);
	assert.match(source, /tavern_dealer_announce\("split"\)/);
	assert.match(source, /tavern_dealer_announce\("win", \{ name:/);
	assert.match(
		read("node/server.js"),
		/citizen_behavior == "poker_dealer"\) return tavern_dealer_loop\(npc, now_date\)/,
	);
});

test("the dealer's client acts stay silent without graphics and fly real card sprites with them", () => {
	const source = read("js/tavern_poker.js");
	const names = [
		"poker_dealer_line",
		"poker_dealer_act",
		"poker_dealer_shuffle",
		"poker_dealer_mock",
		"poker_dealer_flourish",
		"poker_fly",
		"poker_flights_update",
	];
	const extract = (name) => {
		const start = source.indexOf("function " + name + "(");
		let depth = 0;
		for (let i = source.indexOf("{", start); i < source.length; i++) {
			if (source[i] == "{") depth++;
			if (source[i] == "}" && --depth == 0) return source.slice(start, i + 1);
		}
	};
	const touched = [];
	const pixi = new Proxy({}, { get: (target, key) => (touched.push(String(key)), function () {}) });
	const context = vm.createContext({
		no_graphics: true,
		PIXI: pixi,
		current_map: "tavern",
		G: { npcs: G.npcs, skills: G.skills },
		get_npc: () => ({ id: "$Venn" }),
		d_text: () => touched.push("d_text"),
		play_cosmetic_emote: () => touched.push("emote"),
		draw_timeout: (f) => f(),
		phrase: { definition: (s, id, field, fallback) => fallback },
		performance: { now: () => 0 },
		tavern_poker_map: { sprite: null, flights: [], hold: {}, hold_board: {} },
		tavern_poker_hands: [-4, -46],
		tavern_poker_floor: [
			[-40, -26],
			[-8, -26],
			[24, -26],
			[-40, -41],
			[25, -41],
		],
		poker_texture: () => ({}),
	});
	vm.runInContext(names.map(extract).join("\n"), context);
	for (const act of ["say", "emote", "shuffle", "mock", "flourish"])
		context.poker_dealer_act({ act, line: "idle.0", emote: "wiggle", seats: [0, 1], card: "A_spades" });
	assert.deepEqual(touched, [], "nothing drawn without graphics");

	// With graphics: sprites are created on the table, fly, and are removed after their last segment.
	let now = 0;
	const added = [],
		removed = [];
	class Sprite {
		constructor(texture) {
			this.texture = texture;
			this.scale = { set() {} };
		}
		destroy() {
			this._destroyed = true;
		}
	}
	const table = {
		_destroyed: false,
		addChild: (s) => (added.push(s), (s.parent = table)),
		removeChild: (s) => removed.push(s),
	};
	Object.assign(context, { no_graphics: false, PIXI: { Sprite }, performance: { now: () => now } });
	context.tavern_poker_map = { sprite: table, flights: [], hold: {}, hold_board: {} };
	vm.runInContext("tavern_poker_map = this.tavern_poker_map;", context);
	context.poker_dealer_act({ act: "mock", seats: [0, 3] });
	assert.equal(added.length, 4, "two cards to each empty seat");
	context.poker_dealer_act({ act: "flourish", card: "K_hearts" });
	context.poker_dealer_act({ act: "shuffle" });
	for (now = 0; now < 8000; now += 50) context.poker_flights_update();
	assert.equal(removed.length, added.length, "every card went home");
	assert.equal(vm.runInContext("tavern_poker_map.flights.length", context), 0);
	context.poker_dealer_act({ act: "say", line: "win.0", name: "Ada" });
	assert.ok(touched.includes("d_text"));
});
