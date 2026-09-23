const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const crypto = require("node:crypto");
const G = require("./helpers/design");
const { load, read, socketHandler, extract } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

// The design helper skips games.js; the wheel reads its slices from there.
const games = vm.runInNewContext(read("design/games.js") + ";games", { module: { exports: {} } });

function fixture(options = {}) {
	const packets = [],
		logs = [];
	const socket = {
		id: "socket-a",
		emit(event, data) {
			packets.push({ event, data: JSON.parse(JSON.stringify(data)) });
		},
	};
	const player = {
		id: "A",
		name: "A",
		map: "tavern",
		in: "tavern",
		x: -64,
		y: -200,
		vision: [700, 500],
		gold: options.gold === undefined ? 5000000 : options.gold,
		s: {},
		q: {},
		bets: {},
		socket,
	};
	const tavern = { name: "tavern", players: { A: player }, observers: {}, dice: { players: {} } };
	const c = vm.createContext({
		G: Object.assign({}, G, { games }),
		S: { gold: options.house === undefined ? 3000000000 : options.house, logs: { donate: [], dice: [] } },
		Dev: false,
		crypto,
		Math,
		Date,
		JSON,
		console,
		players: { "socket-a": player },
		instances: { tavern },
		tavern,
		socket,
		current_socket: socket,
		ls_method: "bet",
		in_arr: (value, array) => array.includes(value),
		is_string: (value) => typeof value === "string",
		is_object: (value) => value !== null && typeof value === "object",
		max: Math.max,
		min: Math.min,
		ceil: Math.ceil,
		floor: Math.floor,
		parseInt,
		parseFloat,
		String,
		to_pretty_num: (value) => String(value),
		lstack: (array, entry, limit) => {
			array.unshift(entry);
			while (array.length > limit) array.pop();
		},
		xy_emit: (entity, event, data) => packets.push({ event: "xy:" + event, data: JSON.parse(JSON.stringify(data)) }),
		instance_emit: (instance, event, data) =>
			packets.push({ event: "instance:" + event, data: JSON.parse(JSON.stringify(data)) }),
		resend: (target, events) => logs.push("resend:" + events),
		floor_f2: (value) => Math.floor(value * 100) / 100,
		randomStr: () => "rid",
		house_edge_override: null,
	});
	c.server = { live: true, shutdown: false };
	vm.runInContext(read("node/logic/tavern.js"), c);
	vm.runInContext(read("node/logic/tavern_wheel.js"), c);
	vm.runInContext(read("node/logic/tavern_slots.js"), c);
	load(c, "node/server_functions.js", ["house_debt", "house_edge", "fail_response", "success_response"]);
	const bet = socketHandler(c, "bet");
	return { c, player, socket, packets, logs, bet, tavern };
}

const wheel = games.wheel;

test("the wheel definition alternates two equal sides across fourteen slices", () => {
	assert.equal(wheel.slices.length, 14);
	assert.deepEqual(plain(wheel.sides), ["sun", "moon"]);
	for (const side of wheel.sides) assert.equal(wheel.slices.filter((slice) => slice[1] === side).length, 7, side);
	for (let i = 1; i < wheel.slices.length; i++)
		assert.notEqual(wheel.slices[i][1], wheel.slices[i - 1][1], "slice " + i + " repeats a side");
	assert.equal(new Set(wheel.slices.map((slice) => slice[0])).size, 14, "slice ids are unique");
	for (const slice of wheel.slices) assert.match(slice[2], /^#[0-9A-F]{6}$/);
	assert.equal(wheel.min, 10000);
	assert.ok(wheel.spin >= 3000 && wheel.spin <= 6000);
});

test("a wager locks the gold, decides the slice at once and starts the shared spin", () => {
	const { c, player, packets, logs, bet } = fixture();
	c.tavern_wheel_roll = () => 3; // orange, a sun slice
	bet({ type: "wheel", side: "sun", gold: 1000000, request_id: "r1" });
	assert.equal(player.gold, 4000000);
	assert.equal(c.S.gold, 3001000000);
	const ref = player.q.wheel;
	assert.equal(ref.ms, wheel.spin);
	assert.equal(ref.index, 3);
	assert.equal(ref.slice, "orange");
	assert.equal(ref.result, "sun");
	assert.equal(ref.won, true);
	assert.equal(ref.edge, 1, "3B house gold sits in the 1% tier");
	assert.equal(ref.cut, 10000);
	assert.equal(ref.net, 990000);
	assert.equal(ref.request_id, "r1");
	const spin = packets.find((packet) => packet.event === "xy:ui");
	assert.deepEqual(spin.data, { type: "wheel", player: "A", side: "sun", index: 3, ms: wheel.spin });
	const log = packets.find((packet) => packet.event === "game_log");
	assert.equal(log.data.phrase, "server.game_log.wheel_bet");
	assert.deepEqual(log.data.phrase_args, { side: { phrase: "interface.wheel.sun" }, amount: "1000000" });
	assert.equal(log.data.message, "Wheel: SUN for 1000000 gold");
	assert.deepEqual(logs, ["resend:u+cid+reopen+nc"]);
	assert.equal(c.house_debt(), 1990000, "pending winnings count as house debt");
	assert.equal(c.tavern_wheel_debt(), 1990000);
});

test("the server refuses bad sides, a second spin, empty pockets and wagers the house cannot cover", () => {
	const { c, player, packets, bet } = fixture();
	const failures = () => packets.filter((packet) => packet.event === "game_response").map((packet) => packet.data);
	bet({ type: "wheel", side: "stars", gold: 10000, request_id: "r" });
	assert.equal(failures().at(-1).response, "wheel_side");
	assert.equal(failures().at(-1).place, "wheel");
	assert.equal(player.gold, 5000000);
	bet({ type: "wheel", side: "MOON", gold: 10000 });
	assert.equal(failures().at(-1), "wheel_side", "sides are exact lowercase identifiers");
	bet({ type: "wheel", side: "moon", gold: 6000000, request_id: "r" });
	assert.equal(failures().at(-1).response, "gold_not_enough");
	assert.equal(Object.keys(player.q).length, 0);
	c.S.gold = 20000;
	bet({ type: "wheel", side: "moon", gold: 100000, request_id: "r" });
	assert.equal(failures().at(-1).response, "tavern_gold_not_enough");
	c.S.gold = 3000000000;
	c.tavern_wheel_roll = () => 0;
	bet({ type: "wheel", side: "moon", gold: 5, request_id: "r" });
	assert.equal(player.q.wheel.gold, wheel.min, "tiny wagers rise to the minimum");
	assert.equal(player.gold, 5000000 - wheel.min);
	bet({ type: "wheel", side: "moon", gold: 10000, request_id: "r" });
	assert.equal(failures().at(-1).response, "wheel_spinning");
	assert.equal(player.gold, 5000000 - wheel.min, "the refused spin costs nothing");
	player.s.xshotted = { ms: 1000 };
	delete player.q.wheel;
	bet({ type: "wheel", side: "moon", gold: 10000, request_id: "r" });
	assert.equal(failures().at(-1).response, "bet_xshot");
});

test("a winning spin pays even money minus the house cut and reports to CODE and the room", () => {
	const { c, player, packets, logs, bet } = fixture();
	c.tavern_wheel_roll = () => 1; // pink, sun
	bet({ type: "wheel", side: "sun", gold: 2000000, request_id: "r1" });
	const ref = player.q.wheel;
	delete player.q.wheel;
	c.tavern_wheel_settle(player, ref);
	assert.equal(player.gold, 5000000 - 2000000 + 4000000 - 20000);
	assert.equal(c.S.gold, 3000000000 + 2000000 - 3980000);
	assert.equal(c.house_debt(), 0);
	const result = packets.find((packet) => packet.event === "game_response" && packet.data.request_id === "r1");
	assert.deepEqual(result.data, {
		response: "data",
		place: "wheel",
		request_id: "r1",
		success: true,
		won: true,
		side: "sun",
		result: "sun",
		slice: "pink",
		wager: 2000000,
		payout: 3980000,
		net: 1980000,
		edge: 1,
	});
	const room = packets.find((packet) => packet.event === "instance:tavern");
	assert.equal(room.data.event, "won");
	assert.equal(room.data.type, "wheel");
	assert.equal(room.data.net, 1980000);
	assert.equal(room.data.index, 1);
	const log = packets.filter((packet) => packet.event === "game_log").at(-1).data;
	assert.equal(log.phrase, "server.game_log.wheel_won");
	assert.equal(log.color, "gold");
	assert.deepEqual(plain(c.S.logs.wheel), [{ name: "A", gold: 1980000, side: "sun", slice: "pink" }]);
	assert.equal(logs.at(-1), "resend:reopen+nc");
});

test("a losing spin keeps the wager in the house and still fulfills the CODE request", () => {
	const { c, player, packets, bet } = fixture();
	c.tavern_wheel_roll = () => 0; // indigo, moon
	bet({ type: "wheel", side: "sun", gold: 500000, request_id: "r2" });
	const ref = player.q.wheel;
	assert.equal(ref.won, false);
	delete player.q.wheel;
	c.tavern_wheel_settle(player, ref);
	assert.equal(player.gold, 4500000);
	assert.equal(c.S.gold, 3000500000);
	const result = packets.find((packet) => packet.event === "game_response" && packet.data.request_id === "r2").data;
	assert.equal(result.won, false);
	assert.equal(result.result, "moon");
	assert.equal(result.slice, "indigo");
	assert.equal(result.payout, 0);
	assert.equal(result.net, -500000);
	assert.equal(result.success, true, "a completed losing spin is a valid result");
	const room = packets.find((packet) => packet.event === "instance:tavern").data;
	assert.equal(room.event, "lost");
	assert.equal(room.gold, 500000);
	const log = packets.filter((packet) => packet.event === "game_log").at(-1).data;
	assert.equal(log.phrase, "server.game_log.wheel_lost");
	assert.deepEqual(log.phrase_args.side, { phrase: "interface.wheel.moon" });
	assert.deepEqual(plain(c.S.logs.wheel), [{ name: "A", gold: -500000, side: "sun", slice: "indigo" }]);
});

test("the house cut follows the shared edge tiers and rounds against the player", () => {
	for (const [house, edge] of [
		[100000000, 2],
		[1500000000, 1.5],
		[2500000000, 1],
		[6000000000, 0.5],
	]) {
		const { c, player, bet } = fixture({ house, gold: 1000000000 });
		c.tavern_wheel_roll = () => 1;
		bet({ type: "wheel", side: "sun", gold: 33333 });
		const ref = player.q.wheel;
		assert.equal(ref.edge, edge);
		assert.equal(ref.cut, Math.ceil((33333 * edge) / 100));
		assert.equal(ref.net, 33333 - ref.cut);
		delete player.q.wheel;
		c.tavern_wheel_settle(player, ref);
		assert.equal(player.gold, 1000000000 + ref.net);
	}
});

test("disconnecting settles a turning wheel quietly without losing a decided win", () => {
	const { c, player, packets, bet } = fixture();
	c.tavern_wheel_roll = () => 1;
	bet({ type: "wheel", side: "sun", gold: 100000, request_id: "r3" });
	const before = packets.length;
	c.tavern_wheel_disconnect(player);
	assert.equal(player.q.wheel, undefined);
	assert.equal(player.gold, 5000000 + 99000);
	assert.equal(packets.length, before, "no packets reach a closed socket");
	assert.equal(c.S.logs.wheel.length, 1);
	c.tavern_wheel_disconnect(player);
	assert.equal(player.gold, 5000000 + 99000, "nothing settles twice");
});

test("the roll uses every slice and neither side is favoured", () => {
	const { c } = fixture();
	const counts = new Array(wheel.slices.length).fill(0);
	for (let i = 0; i < 14000; i++) counts[c.tavern_wheel_roll(wheel.slices.length)]++;
	for (const count of counts) assert.ok(count > 700 && count < 1300, counts.join(","));
	const sun = counts.reduce((sum, count, index) => sum + (wheel.slices[index][1] === "sun" ? count : 0), 0);
	assert.ok(Math.abs(sun - 7000) < 400, "sun landed " + sun + " of 14000");
});

test("the client spin always parks the decided slice under the pointer", () => {
	const source = read("js/tavern_wheel.js");
	const calls = [];
	const c = vm.createContext({
		G: { games },
		Math,
		performance: { now: () => 1000 },
		no_graphics: false,
		character: { name: "A" },
		topleft_npc: "wheel",
		map_machines: {},
		floor: Math.floor,
		max: Math.max,
		min: Math.min,
		future_ms: (ms) => ms,
		wheel_set_busy: (busy) => calls.push("busy:" + busy),
		wheel_sound: (name) => calls.push("sound:" + name),
		wheel_animate: () => calls.push("animate"),
		wheel_map_spin: (index, ms) => calls.push("map:" + index),
	});
	vm.runInContext(source.slice(0, source.indexOf("function wheel_rgb(")), c);
	vm.runInContext(
		extract(source, "wheel_definition") + "\n" + extract(source, "wheel_plan") + "\n" + extract(source, "wheel_start"),
		c,
	);
	const TAU = Math.PI * 2,
		step = TAU / wheel.slices.length;
	for (let index = 0; index < wheel.slices.length; index++) {
		for (let trial = 0; trial < 20; trial++) {
			c.tavern_wheel.rotation = Math.random() * 40;
			c.wheel_start({ player: "A", index, ms: 4000 });
			const spin = c.tavern_wheel.spin;
			assert.ok(spin.to - spin.from >= 5 * TAU, "at least five turns");
			assert.ok(spin.to - spin.from < 9 * TAU, "no endless spinning");
			const under = Math.floor((((-spin.to % TAU) + TAU) % TAU) / step) % wheel.slices.length;
			assert.equal(under, index);
			assert.equal(spin.duration, 3650);
		}
	}
	assert.ok(calls.includes("sound:whoosh") && calls.includes("animate"));
	c.character.name = "B";
	c.tavern_wheel.spin = null;
	calls.length = 0;
	c.wheel_start({ player: "A", index: 2, ms: 4000 });
	assert.ok(calls.includes("map:2"), "bystanders still see the floor wheel turn");
	assert.equal(c.tavern_wheel.spin, null, "only the spinner's panel animates");
});

test("the wheel panel and its effects stay silent without graphics", () => {
	const source = read("js/tavern_wheel.js");
	const c = vm.createContext({
		G: { games },
		no_graphics: true,
		no_html: "bot",
		character: { name: "A" },
		topleft_npc: false,
		map_machines: {},
		$: new Proxy(() => {}, {
			apply() {
				throw new Error("DOM touched");
			},
		}),
		PIXI: new Proxy(
			{},
			{
				get() {
					throw new Error("PIXI touched");
				},
			},
		),
		document: new Proxy(
			{},
			{
				get() {
					throw new Error("document touched");
				},
			},
		),
		requestAnimationFrame: () => {
			throw new Error("animation frame requested");
		},
		get_entity: () => null,
	});
	vm.runInContext(source, c);
	c.render_wheel();
	c.wheel_start({ player: "A", index: 1, ms: 4000 });
	c.wheel_finish({ index: 1, won: true, net: 1 });
	c.wheel_tavern_event({ event: "won", name: "A", net: 1, gold: 1, index: 1 });
	c.wheel_animate();
	assert.equal(c.tavern_wheel.spin, null);
});

function wheelClient(now) {
	const source = read("js/tavern_wheel.js");
	const calls = [];
	const clock = { now };
	const dom = { css: () => dom, html: (value) => (value === undefined ? "" : dom), length: 1 };
	const c = vm.createContext({
		G: { games },
		Math,
		performance: { now: () => clock.now },
		no_graphics: false,
		character: { name: "A" },
		topleft_npc: "wheel",
		map_machines: {},
		floor: Math.floor,
		max: Math.max,
		min: Math.min,
		future_ms: (ms) => ms,
		$: () => dom,
		setTimeout: () => 0,
		to_pretty_num: String,
		phrase: { html: () => "" },
		requestAnimationFrame: () => (calls.push("frame"), 1),
		wheel_sound: (name) => calls.push("sound:" + name),
		wheel_change: () => calls.push("change"),
		wheel_draw: () => calls.push("draw"),
		wheel_map_spin: () => calls.push("map-spin"),
		wheel_map_settle: () => calls.push("map-settle"),
	});
	vm.runInContext(source.slice(0, source.indexOf("function wheel_rgb(")), c);
	for (const name of [
		"wheel_definition",
		"wheel_plan",
		"wheel_rest_rotation",
		"wheel_slice_at",
		"wheel_set_busy",
		"wheel_start",
		"wheel_finish",
		"wheel_show_result",
		"wheel_animate",
		"wheel_frame",
	])
		vm.runInContext(extract(source, name), c);
	return { c, calls, clock, dom };
}

const wheelStep = (Math.PI * 2) / wheel.slices.length;
const underPointer = (rotation) =>
	Math.floor((((-rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / wheelStep) % wheel.slices.length;

test("a settlement that arrives while the wheel still turns waits for the run to end on the result slice", () => {
	const { c, calls, clock } = wheelClient(1000);
	c.wheel_start({ player: "A", index: 4, ms: 4000 });
	const spin = c.tavern_wheel.spin;
	c.wheel_finish({ event: "won", won: true, index: 4, net: 5, gold: 5 });
	assert.equal(c.tavern_wheel.spin, spin, "the run keeps going");
	assert.equal(c.tavern_wheel.result.shown, undefined);
	assert.ok(c.tavern_wheel.busy);
	clock.now = 1000 + spin.duration + 1;
	c.wheel_frame(clock.now);
	assert.equal(c.tavern_wheel.spin, null);
	assert.equal(c.tavern_wheel.rotation, spin.to);
	assert.equal(underPointer(c.tavern_wheel.rotation), 4);
	assert.equal(c.tavern_wheel.result.shown, true);
	assert.equal(c.tavern_wheel.busy, false);
	assert.ok(calls.includes("sound:coins"));
});

test("a settlement without a running wheel parks the wheel on the result, even after a re-render or a closed panel", () => {
	const { c, dom } = wheelClient(1000);
	c.tavern_wheel.rotation = 12.3;
	c.wheel_finish({ event: "lost", won: false, index: 9, net: -5, gold: 5 });
	assert.equal(underPointer(c.tavern_wheel.rotation), 9);
	assert.equal(c.tavern_wheel.result.shown, true);
	// The panel closed mid-spin: frames stop but the clock and target stay.
	c.wheel_start({ player: "A", index: 2, ms: 4000 });
	const spin = c.tavern_wheel.spin;
	dom.length = 0;
	c.wheel_frame(2000);
	assert.equal(c.tavern_wheel.spin, spin, "closing the panel does not cancel the run");
	dom.length = 1;
	c.wheel_frame(1000 + spin.duration + 5);
	assert.equal(underPointer(c.tavern_wheel.rotation), 2);
	assert.equal(c.tavern_wheel.spin, null);
	assert.ok(c.tavern_wheel.busy, "still waiting for the server's settlement");
	c.wheel_finish({ event: "won", won: true, index: 2, net: 1, gold: 1 });
	assert.equal(c.tavern_wheel.busy, false);
	assert.equal(underPointer(c.tavern_wheel.rotation), 2);
});

test("concurrent maximum winning wagers reserve full payouts, and losing wagers reserve restart refunds", () => {
	const f = fixture({ gold: 1000000000000 });
	f.c.tavern_wheel_roll = () => 1;
	const refs = [];
	for (let i = 0; i < 3; i++) {
		const gold = Math.floor(((f.c.S.gold - f.c.house_debt()) * 0.4) / (1 - f.c.house_edge() / 100));
		f.bet({ type: "wheel", side: "sun", gold });
		assert.ok(f.player.q.wheel);
		refs.push(f.player.q.wheel);
		f.c.players["pending-" + i] = { q: f.player.q };
		f.player.q = {};
	}
	for (let i = 0; i < refs.length; i++) {
		delete f.c.players["pending-" + i];
		f.c.tavern_wheel_settle(f.player, refs[i], true);
	}
	assert.ok(f.c.S.gold >= 0, "every accepted payout is covered");
	f.c.tavern_wheel_roll = () => 0;
	f.bet({ type: "wheel", side: "sun", gold: 10000 });
	assert.equal(f.c.house_debt(), 10000, "an unfinished loss may still be refunded on shutdown");
});

test("manual wheel completion reaches a player outside the room exactly once", () => {
	const f = fixture();
	f.bet({ type: "wheel", side: "sun", gold: 10000 });
	const ref = f.player.q.wheel;
	delete f.player.q.wheel;
	f.player.in = f.player.map = "main";
	f.c.tavern.players = {};
	f.c.tavern_wheel_settle(f.player, ref);
	assert.equal(f.packets.filter((p) => p.event === "tavern" && p.data.type === "wheel").length, 1);
});
