const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const crypto = require("node:crypto");
const G = require("./helpers/design");
const { load, read, socketHandler, extract } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

const games = vm.runInNewContext(read("design/games.js") + ";games", { module: { exports: {} } });
const slots = games.slots;

function fixture(options = {}) {
	const packets = [],
		logs = [];
	const socket = {
		id: "socket-a",
		emit(event, data) {
			packets.push({ event, data: plain(data) });
		},
	};
	const player = {
		id: "A",
		name: "A",
		map: "tavern",
		in: "tavern",
		x: -272,
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
		xy_emit: (entity, event, data) => packets.push({ event: "xy:" + event, data: plain(data) }),
		instance_emit: (instance, event, data) => packets.push({ event: "instance:" + event, data: plain(data) }),
		broadcast: (event, data) => packets.push({ event: "broadcast:" + event, data: plain(data) }),
		resend: (target, events) => logs.push("resend:" + events),
		floor_f2: (value) => Math.floor(value * 100) / 100,
		randomStr: () => "rid",
	});
	c.server = { live: true, shutdown: false };
	vm.runInContext(read("node/logic/tavern.js"), c);
	vm.runInContext(read("node/logic/tavern_wheel.js"), c);
	vm.runInContext(read("node/logic/tavern_slots.js"), c);
	load(c, "node/server_functions.js", ["house_debt", "house_edge", "fail_response", "success_response"]);
	const bet = socketHandler(c, "bet");
	return { c, player, socket, packets, logs, bet };
}

test("the slot machine is exactly fair before the house cut and every prize is a real item symbol", () => {
	assert.equal(slots.gold, 1000000);
	const expected = slots.prizes.reduce((sum, prize) => sum + prize[1] * prize[2], 0) / slots.draws;
	assert.equal(expected, slots.gold, "weighted prizes average the stake");
	assert.ok(
		slots.prizes.some((prize) => prize[1] >= 100000000),
		"a hundred million is winnable",
	);
	assert.ok(
		slots.prizes.some((prize) => prize[1] >= 1000000000),
		"a billion is winnable",
	);
	assert.ok(
		slots.prizes.every((prize) => prize[1] > slots.gold),
		"every prize beats the stake",
	);
	assert.ok(slots.prizes.reduce((sum, prize) => sum + prize[2], 0) < slots.draws);
	for (const prize of slots.prizes) {
		assert.ok(G.items[prize[0]] && G.positions[prize[0]], prize[0] + " has a sprite");
		for (const reel of slots.reels) assert.ok(reel.includes(prize[0]), prize[0] + " appears on every reel");
	}
	assert.equal(slots.reels.length, 3);
	for (const reel of slots.reels) assert.equal(reel.length, 20);
	assert.ok(slots.spin >= 3000 && slots.spin <= 6000);
});

test("the draw follows the prize weights and the reels show exactly what was drawn", () => {
	const { c } = fixture();
	let roll = 0;
	c.tavern_slots_roll = (count) => (count === slots.draws ? roll : 0);
	let sum = 0;
	for (const prize of slots.prizes) {
		roll = sum;
		assert.equal(c.tavern_slots_draw(slots)[0], prize[0]);
		roll = sum + prize[2] - 1;
		assert.equal(c.tavern_slots_draw(slots)[0], prize[0]);
		sum += prize[2];
	}
	roll = sum;
	assert.equal(c.tavern_slots_draw(slots), null);
	roll = slots.draws - 1;
	assert.equal(c.tavern_slots_draw(slots), null);
	const { c: real } = fixture();
	for (const prize of slots.prizes) {
		for (let i = 0; i < 50; i++) {
			const stops = real.tavern_slots_stops(slots, prize[0]);
			assert.deepEqual(plain(stops.map((stop, r) => slots.reels[r][stop])), [prize[0], prize[0], prize[0]]);
		}
	}
	for (let i = 0; i < 3000; i++) {
		const stops = real.tavern_slots_stops(slots, null);
		const symbols = stops.map((stop, r) => slots.reels[r][stop]);
		assert.ok(!(symbols[0] === symbols[1] && symbols[1] === symbols[2]), "a miss never shows three of a kind");
	}
	const counts = new Array(slots.draws).fill(0);
	for (let i = 0; i < 60000; i++) counts[real.tavern_slots_roll(slots.draws)]++;
	assert.ok(counts.filter((n) => n === 0).length < 5000, "the roll covers the whole draw range");
});

test("a stake locks the gold, decides the reels at once and starts the shared machine", () => {
	const { c, player, packets, logs, bet } = fixture();
	c.tavern_slots_roll = (count) => (count === slots.draws ? 6 + 10 : 0); // the second prize: three gold ingots
	bet({ type: "slots", request_id: "r1" });
	assert.equal(player.gold, 4000000);
	assert.equal(c.S.gold, 3001000000);
	const ref = player.q.slots;
	assert.equal(ref.ms, slots.spin);
	assert.deepEqual(plain(ref.symbols), ["goldingot", "goldingot", "goldingot"]);
	assert.equal(ref.prize, 100000000);
	assert.equal(ref.edge, 1);
	assert.equal(ref.cut, Math.ceil((100000000 - 1000000) * 0.01));
	assert.equal(ref.payout, 100000000 - 990000);
	assert.equal(ref.won, true);
	ref.stops.forEach((stop, r) => assert.equal(slots.reels[r][stop], "goldingot"));
	const start = packets.find((packet) => packet.event === "xy:ui");
	assert.deepEqual(start.data, { type: "slots", player: "A", stops: plain(ref.stops), ms: slots.spin });
	assert.deepEqual(packets.find((packet) => packet.event === "game_response").data, {
		response: "gold_use",
		gold: 1000000,
		game: "slots",
	});
	assert.deepEqual(logs, ["resend:u+cid+reopen+nc"]);
	assert.equal(c.house_debt(), ref.payout, "the full pending payout counts as house debt");
	bet({ type: "slots", request_id: "r2" });
	assert.equal(packets.filter((packet) => packet.event === "game_response").at(-1).data.response, "slots_spinning");
	assert.equal(player.gold, 4000000, "a refused spin costs nothing");
	player.gold = 999999;
	delete player.q.slots;
	bet({ type: "slots" });
	assert.equal(packets.at(-1).data, "gold_not_enough");
	assert.equal(player.q.slots, undefined);
});

test("a winning spin pays the prize minus the house cut, tells CODE and the room, and announces big prizes", () => {
	const { c, player, packets, logs, bet } = fixture();
	c.tavern_slots_roll = (count) => (count === slots.draws ? 0 : 0); // the jackpot: three glitches
	bet({ type: "slots", request_id: "r1" });
	const ref = player.q.slots;
	assert.equal(ref.prize, 1000000000);
	delete player.q.slots;
	c.tavern_slots_settle(player, ref);
	const cut = Math.ceil((1000000000 - 1000000) * 0.01);
	assert.equal(player.gold, 4000000 + 1000000000 - cut);
	assert.equal(c.S.gold, 3000000000 + 1000000 - (1000000000 - cut));
	assert.equal(c.house_debt(), 0);
	const result = packets.find((packet) => packet.event === "game_response" && packet.data.request_id === "r1").data;
	assert.deepEqual(result, {
		response: "slots_success",
		place: "slots",
		request_id: "r1",
		success: true,
		won: true,
		cost: 1000000,
		payout: 1000000000 - cut,
		net: 1000000000 - cut - 1000000,
		symbols: ["glitch", "glitch", "glitch"],
		prize: 1000000000,
		edge: 1,
		cut,
	});
	assert.ok(
		packets.some(
			(packet) =>
				packet.event === "broadcast:server_message" && packet.data.phrase === "server.server_message.received_gold",
		),
	);
	const gold = packets.find((packet) => packet.event === "game_log").data;
	assert.equal(gold.phrase, "server.game_log.received_gold");
	const room = packets.find((packet) => packet.event === "instance:tavern").data;
	assert.equal(room.event, "won");
	assert.equal(room.type, "slots");
	assert.deepEqual(room.symbols, ["glitch", "glitch", "glitch"]);
	assert.equal(room.net, 1000000000 - cut - 1000000);
	assert.deepEqual(plain(c.S.logs.slots), [
		{ name: "A", gold: 1000000000 - cut - 1000000, symbols: ["glitch", "glitch", "glitch"] },
	]);
	assert.equal(logs.at(-1), "resend:reopen+nc");
});

test("a losing spin keeps the stake, shows an honest miss and still fulfills the CODE request", () => {
	const { c, player, packets, bet } = fixture();
	c.tavern_slots_roll = (count) => (count === slots.draws ? slots.draws - 1 : 0);
	bet({ type: "slots", request_id: "r2" });
	const ref = player.q.slots;
	assert.equal(ref.won, false);
	assert.equal(ref.prize, 0);
	assert.ok(!(ref.symbols[0] === ref.symbols[1] && ref.symbols[1] === ref.symbols[2]));
	delete player.q.slots;
	c.tavern_slots_settle(player, ref);
	assert.equal(player.gold, 4000000);
	assert.equal(c.S.gold, 3001000000);
	const result = packets.find((packet) => packet.event === "game_response" && packet.data.request_id === "r2").data;
	assert.equal(result.response, "slots_fail");
	assert.equal(result.won, false);
	assert.equal(result.payout, 0);
	assert.equal(result.net, -1000000);
	assert.equal(result.success, true);
	assert.equal(result.symbols.length, 3);
	assert.ok(!packets.some((packet) => packet.event === "broadcast:server_message"));
	assert.equal(packets.find((packet) => packet.event === "instance:tavern").data.event, "lost");
	const { c: manual, player: p2, packets: packets2, bet: bet2 } = fixture();
	manual.tavern_slots_roll = (count) => (count === slots.draws ? slots.draws - 1 : 0);
	bet2({ type: "slots" });
	const ref2 = p2.q.slots;
	delete p2.q.slots;
	manual.tavern_slots_settle(p2, ref2);
	assert.equal(
		packets2.filter((packet) => packet.event === "game_response").at(-1).data,
		"slots_fail",
		"manual spins keep the old flavour response",
	);
});

test("the smallest prize returns more than the stake after every house edge tier", () => {
	for (const [house, edge] of [
		[1000000000, 2],
		[1500000000, 1.5],
		[2500000000, 1],
		[6000000000, 0.5],
	]) {
		const { c, player, bet } = fixture({ house });
		const before_ale = slots.prizes.slice(0, -1).reduce((sum, prize) => sum + prize[2], 0);
		c.tavern_slots_roll = (count) => (count === slots.draws ? before_ale : 0);
		bet({ type: "slots" });
		const ref = player.q.slots;
		assert.equal(ref.symbols[0], "ale");
		assert.equal(ref.edge, edge);
		assert.ok(ref.payout > slots.gold, "three ales still return more than the stake at " + edge + "%");
		assert.equal(ref.payout, 1200000 - Math.ceil((200000 * edge) / 100));
	}
});

test("disconnecting settles turning reels quietly without losing a decided prize", () => {
	const { c, player, packets, bet } = fixture();
	c.tavern_slots_roll = (count) => (count === slots.draws ? 6 + 60 + 1 : 0); // three emeralds
	bet({ type: "slots", request_id: "r3" });
	const before = packets.length;
	c.tavern_slots_disconnect(player);
	assert.equal(player.q.slots, undefined);
	assert.equal(player.gold, 4000000 + 20000000 - Math.ceil(19000000 * 0.01));
	assert.equal(packets.length, before, "no packets reach a closed socket");
	c.tavern_slots_disconnect(player);
	assert.equal(c.S.logs.slots.length, 1, "nothing settles twice");
});

test("the client parks every reel exactly on the decided stop", () => {
	const source = read("js/tavern_slots.js");
	const calls = [];
	const c = vm.createContext({
		G: { games, positions: G.positions, imagesets: G.imagesets },
		Math,
		performance: { now: () => 1000 },
		no_graphics: false,
		character: { name: "A" },
		map_machines: {},
		floor: Math.floor,
		round: Math.round,
		min: Math.min,
		max: Math.max,
		future_ms: (ms) => ms,
		slots_set_busy: (busy) => calls.push("busy:" + busy),
		slots_sound: (name) => calls.push("sound:" + name),
		slots_animate: () => calls.push("animate"),
		slots_map_spin: (stops, ms) => calls.push("map:" + ms),
	});
	vm.runInContext(source.slice(0, source.indexOf("function slots_definition(")), c);
	vm.runInContext(
		extract(source, "slots_definition") +
			"\n" +
			extract(source, "slots_start") +
			"\n" +
			extract(source, "slots_reel_position"),
		c,
	);
	for (let trial = 0; trial < 200; trial++) {
		const stops = slots.reels.map((reel) => Math.floor(Math.random() * reel.length));
		c.tavern_slots.pos = [Math.random() * 4000, Math.random() * 4000, Math.random() * 4000];
		c.tavern_slots.stopped = [false, false, false];
		c.slots_start({ player: "A", stops, ms: 3600 });
		c.tavern_slots.spin.reels.forEach((reel, r) => {
			const length = slots.reels[r].length * 20;
			assert.equal((((reel.to % length) + length) % length) / 20, stops[r]);
			assert.ok(reel.to - reel.from >= (3 + r) * length, "reel " + r + " turns at least " + (3 + r) + " times");
			assert.equal(c.slots_reel_position(reel, reel.stop + 500, r), reel.to, "the bounce settles on the stop");
			assert.ok(
				Math.abs(c.slots_reel_position(reel, reel.stop + 90, r) - reel.to) <= 3,
				"the bounce stays within three pixels",
			);
		});
		assert.equal(c.tavern_slots.spin.end, 1000 + 1500 + 2 * 600 + 200);
	}
	assert.ok(calls.includes("sound:whoosh") && calls.includes("animate") && calls.includes("map:3600"));
	c.character.name = "B";
	c.tavern_slots.spin = null;
	calls.length = 0;
	c.slots_start({ player: "A", stops: [0, 0, 0], ms: 3600 });
	assert.ok(calls.includes("map:3600"), "bystanders still see the cabinet reels run");
	assert.equal(c.tavern_slots.spin, null, "only the player's own reels run");
});

test("the slots panel and its effects stay silent without graphics", () => {
	const source = read("js/tavern_slots.js");
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
		Image: function () {
			throw new Error("image created");
		},
		requestAnimationFrame: () => {
			throw new Error("animation frame requested");
		},
		get_entity: () => null,
	});
	vm.runInContext(source, c);
	c.render_slot_machine();
	c.slots_start({ player: "A", stops: [1, 2, 3], ms: 3600 });
	c.slots_settle({ won: true, net: 1, index: 1, stops: [1, 2, 3] });
	c.slots_tavern_event({ event: "won", name: "A", net: 1, gold: 1, stops: [1, 2, 3] });
	c.slots_animate();
	assert.equal(c.tavern_slots.spin, null);
});

test("insufficient reserves reject a spin before drawing any prize", () => {
	const f = fixture({ house: 100000000 });
	let draws = 0;
	f.c.tavern_slots_roll = () => {
		draws++;
		return 0;
	};
	f.bet({ type: "slots", request_id: "uncovered" });
	assert.equal(draws, 0);
	assert.equal(f.player.q.slots, undefined);
	assert.ok(f.packets.some((p) => p.event === "game_response" && p.data.response === "tavern_gold_not_enough"));
});
