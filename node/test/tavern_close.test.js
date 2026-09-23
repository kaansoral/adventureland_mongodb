const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const crypto = require("node:crypto");
const G = require("./helpers/design");
const { load, read, socketHandler } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

const games = vm.runInNewContext(read("design/games.js") + ";games", { module: { exports: {} } });
const BB = games.poker.blinds.III[1];
const HOUSE = 3000000000;

// A Tavern with the real bet and poker socket handlers, all four games loaded, and a clock the tests control.
function fixture(options = {}) {
	const packets = [],
		logs = [],
		traces = [],
		refunds = [];
	let now = 1000000;
	const players = {},
		instances = {
			tavern: { name: "tavern", players: {}, observers: {}, dice: { state: "bets", players: {}, bets: [] } },
		},
		tavern = instances.tavern;
	const c = vm.createContext({
		G: Object.assign({}, G, { games }),
		S: { gold: HOUSE, logs: { donate: [], dice: [] } },
		Dev: false,
		server: { live: true, shutdown: false },
		is_pvp: false,
		server_name: "III",
		server_id: "SR_test",
		crypto,
		Math,
		Date,
		JSON,
		console,
		Object,
		players,
		dc_players: {},
		instances,
		tavern,
		in_arr: (value, array) => array.includes(value),
		is_string: (value) => typeof value === "string",
		is_object: (value) => value !== null && typeof value === "object",
		max: Math.max,
		min: Math.min,
		ceil: Math.ceil,
		floor: Math.floor,
		floor_f2: (value) => Math.floor(value * 100) / 100,
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
		resend: (target, events) => logs.push("resend:" + target.name + ":" + events),
		server_log: (message) => logs.push("log:" + message),
		log_trace: (message, e) => traces.push(message + ": " + e.message),
		randomStr: () => "tok" + Math.random().toString(36).slice(2, 8),
		tx: options.tx || ((F, A) => (refunds.push(A[0]), Promise.resolve({ success: true }))),
	});
	vm.runInContext(read("node/logic/tavern.js"), c);
	vm.runInContext(read("node/logic/tavern_poker.js"), c);
	// Gameplay tests complete the persistence boundary immediately; the durability cases below use the real transaction.
	c.tavern_poker_checkpoint = (seats, id, awards, complete) => {
		const table = c.tavern_poker_table();
		for (const seat of seats) {
			seat.revision = (seat.revision || 0) + 1;
			seat.hand = awards ? null : id;
			if (awards && !table.closing) seat.balance = awards[seat.index];
			c.tavern_poker_mirror(seat);
		}
		complete({ success: true, invalid: [], voided: !!table.closing });
		if (table.closing) c.tavern_poker_shutdown();
	};

	c.tavern_poker_now = () => now;
	load(c, "node/server_functions.js", ["house_debt", "house_edge", "fail_response", "success_response"]);
	vm.runInContext(read("node/logic/tavern_wheel.js"), c);
	vm.runInContext(read("node/logic/tavern_slots.js"), c);
	function login(name, gold) {
		const socket = {
			id: "socket-" + name,
			emit(event, data) {
				packets.push({ to: name, event, data: plain(data) });
			},
		};
		const player = {
			id: name,
			real_id: "CH_" + name,
			owner: "US_" + name.toLowerCase(),
			name,
			map: "tavern",
			in: "tavern",
			x: -168,
			y: -60,
			vision: [700, 500],
			gold: gold === undefined ? 8000000000 : gold,
			s: {},
			q: {},
			p: { dt: {} },
			bets: {},
			socket,
		};
		players[socket.id] = player;
		tavern.players[name] = player;
		c.socket = socket;
		c.current_socket = socket;
		const handlers = { poker: socketHandler(c, "poker"), bet: socketHandler(c, "bet") };
		const request = (event, data) => {
			c.socket = socket;
			c.current_socket = socket;
			c.ls_method = event;
			handlers[event](data);
			const reply = packets.filter((p) => p.to === name && p.event === "game_response").pop();
			return reply && reply.data;
		};
		player.poker = (data) => request("poker", data);
		player.bet = (data) => request("bet", data);
		player.replies = (place) =>
			packets.filter((p) => p.to === name && p.event === "game_response" && p.data.place === place).map((p) => p.data);
		player.messages = () =>
			packets.filter((p) => p.to === name && p.event === "game_log").map((p) => p.data.message || p.data);
		player.disconnect = () => {
			player.dc = true;
			delete players[socket.id];
			delete tavern.players[name];
			c.dc_players[player.real_id] = player;
			c.tavern_poker_disconnect(player);
		};
		player.stop = () => {
			delete c.dc_players[player.real_id];
		};
		return player;
	}
	return {
		c,
		packets,
		logs,
		traces,
		refunds,
		login,
		table: () => c.tavern_poker_table(),
		tick: (ms) => {
			let left = ms || 1000;
			while (left > 0) {
				const step = Math.min(1000, left);
				now += step;
				left -= step;
				c.tavern_poker_tick();
			}
		},
		instance: (event) => packets.filter((p) => p.event === "instance:" + event).map((p) => p.data),
	};
}

// A character next to a stool, as the table requires before a buy-in.
function stand(player, seat) {
	const machine = G.maps.tavern.machines.find((m) => m.type == "poker"),
		stool = games.poker.stools[seat];
	player.x = machine.x + stool[0];
	player.y = machine.y + stool[1];
}

// Every game with something at stake: a dice bet, a turning wheel, turning reels and a poker hand with chips in the pot.
function wager_everywhere(f) {
	const a = f.login("Dicer"),
		b = f.login("Spinner"),
		s = f.login("Puller"),
		d = f.login("Dealer"),
		e = f.login("Caller");
	assert.equal(a.bet({ type: "dice", num: 50, dir: "up", gold: 10000000, request_id: "dice-a" }), undefined);
	assert.equal(a.gold, 8000000000 - 10000000);
	assert.equal(Object.keys(a.bets).length, 1);
	assert.equal(b.bet({ type: "wheel", side: "sun", gold: 5000000, request_id: "wheel-b" }), undefined);
	assert.equal(b.gold, 8000000000 - 5000000);
	assert.ok(b.q.wheel);
	s.bet({ type: "slots", request_id: "slots-s" });
	assert.equal(s.gold, 8000000000 - games.slots.gold);
	assert.ok(s.q.slots);
	stand(d, 1);
	stand(e, 0);
	assert.equal(d.poker({ event: "join", gold: 100 * BB, request_id: "join-d" }).success, true);
	assert.equal(e.poker({ event: "join", gold: 100 * BB, request_id: "join-e" }).success, true);
	f.tick(6000);
	const hand = f.table().hand;
	assert.ok(hand && !hand.over, "a hand is running");
	const first = f.table().seats[hand.acting];
	assert.equal(
		first.player.poker({ event: "act", action: "raise", amount: 5 * BB, request_id: "raise" }).success,
		true,
	);
	const second = f.table().seats[hand.acting];
	assert.equal(second.player.poker({ event: "act", action: "call", request_id: "call" }).success, true);
	assert.ok(hand.pot >= 10 * BB, "chips are in the pot");
	return { a, b, s, d, e };
}

test("a restart returns every unfinished wager, voids the hand and cashes every seat out before anything is saved", () => {
	const f = fixture(),
		{ a, b, s, d, e } = wager_everywhere(f),
		wheel_index = b.q.wheel.index,
		slots_symbols = s.q.slots.symbols;
	f.c.tavern_close();
	for (const player of [a, b, s, d, e]) assert.equal(player.gold, 8000000000, player.name + " has every coin back");
	assert.equal(f.c.S.gold, HOUSE, "the house neither kept a stake nor a rake");
	assert.deepEqual(plain(a.bets), {});
	assert.equal(b.q.wheel, undefined);
	assert.equal(s.q.slots, undefined);
	assert.deepEqual(plain(f.table().seats), [null, null, null, null, null]);
	assert.equal(f.table().hand.voided, true);
	assert.ok(!d.p.poker && !e.p.poker, "no escrow records remain");
	// Each CODE promise settles with the reason and the returned gold.
	assert.deepEqual(a.replies("dice").pop(), {
		response: "tavern_closing",
		place: "dice",
		request_id: "dice-a",
		failed: true,
		reason: "tavern_closing",
		refund: 10000000,
	});
	assert.deepEqual(b.replies("wheel").pop(), {
		response: "tavern_closing",
		place: "wheel",
		request_id: "wheel-b",
		failed: true,
		reason: "tavern_closing",
		refund: 5000000,
	});
	assert.deepEqual(s.replies("slots").pop(), {
		response: "tavern_closing",
		place: "slots",
		request_id: "slots-s",
		failed: true,
		reason: "tavern_closing",
		refund: games.slots.gold,
	});
	for (const player of [a, b, s])
		assert.ok(
			player.messages().some((m) => /returned/.test(m)),
			player.name + " read the refund",
		);
	for (const player of [d, e])
		assert.ok(
			player.messages().some((m) => m.indexOf("leave the poker table with " + 100 * BB) != -1),
			player.name + " was cashed out in full",
		);
	// The floor and the panels learn about it: the wheel stops on its decided slice, the reels show their symbols.
	const refunds = f.instance("tavern").filter((p) => p.event === "refund");
	assert.deepEqual(refunds.map((p) => p.type).sort(), ["dice", "slots", "wheel"]);
	assert.equal(refunds.find((p) => p.type === "wheel").index, wheel_index);
	assert.deepEqual(refunds.find((p) => p.type === "slots").symbols, plain(slots_symbols));
	assert.ok(f.instance("game_log").some((m) => /closes its games for the restart/.test(m.message)));
	assert.ok(f.instance("poker").length, "the voided table was published");
	assert.equal(f.c.tavern_closing(), true);
	// Closing again changes nothing.
	const count = f.packets.length;
	f.c.tavern_close();
	assert.equal(f.packets.length, count);
	assert.deepEqual(f.traces, []);
});

test("nothing starts while the Tavern is closing: bets, spins, joins and deals are refused, seats are cashed out", () => {
	const f = fixture(),
		a = f.login("Dicer"),
		b = f.login("Spinner"),
		s = f.login("Puller"),
		d = f.login("Dealer"),
		e = f.login("Caller");
	stand(d, 1);
	stand(e, 0);
	assert.equal(d.poker({ event: "join", gold: 100 * BB, request_id: "join-d" }).success, true);
	assert.equal(e.poker({ event: "join", gold: 100 * BB, request_id: "join-e" }).success, true);
	f.c.server.shutdown = true;
	assert.equal(f.c.tavern_closing(), true);
	f.tick(10000);
	assert.equal(f.table().hand, null, "no hand is dealt during the countdown");
	assert.equal(
		a.bet({ type: "dice", num: 50, dir: "up", gold: 10000000, request_id: "dice-a" }).response,
		"tavern_closing",
	);
	assert.equal(b.bet({ type: "wheel", side: "sun", gold: 5000000, request_id: "wheel-b" }).response, "tavern_closing");
	assert.equal(s.bet({ type: "slots", request_id: "slots-s" }).response, "tavern_closing");
	assert.equal(a.poker({ event: "join", gold: 100 * BB, request_id: "join-a" }).response, "tavern_closing");
	assert.equal(d.poker({ event: "join", gold: BB, request_id: "rebuy-d" }).response, "tavern_closing");
	for (const player of [a, b, s]) assert.equal(player.gold, 8000000000);
	assert.deepEqual(plain(a.bets), {});
	assert.equal(b.q.wheel, undefined);
	assert.equal(s.q.slots, undefined);
	// The wheel and slots refuse on their own too, without the socket handler.
	f.c.tavern_wheel_bet(b, { side: "sun", gold: 5000000 }, (reason) => logs_push(f, reason), null);
	f.c.tavern_slots_bet(s, {}, (reason) => logs_push(f, reason), null);
	assert.deepEqual(f.logs.filter((l) => l === "refused:tavern_closing").length, 2);
	f.c.tavern_close();
	assert.deepEqual(plain(f.table().seats), [null, null, null, null, null]);
	assert.equal(d.gold, 8000000000);
	assert.equal(e.gold, 8000000000);
	// A server that is no longer live is closing as well.
	const g = fixture();
	g.c.server.live = false;
	assert.equal(g.c.tavern_closing(), true);
	assert.equal(
		g.login("Late").bet({ type: "wheel", side: "moon", gold: 5000000, request_id: "late" }).response,
		"tavern_closing",
	);
});

function logs_push(f, reason) {
	f.logs.push("refused:" + reason);
}

test("one failing game or player cannot keep anyone else's gold on the table", () => {
	const f = fixture(),
		{ a, b, s, d, e } = wager_everywhere(f);
	f.c.tavern_poker_shutdown = () => {
		throw new Error("poker boom");
	};
	const refund_slots = f.c.tavern_refund_slots;
	f.c.tavern_refund_slots = (player) => {
		if (player.name === "Puller") throw new Error("slots boom");
		return refund_slots(player);
	};
	f.c.tavern_close();
	assert.equal(a.gold, 8000000000, "the dice bet came back although poker failed");
	assert.equal(b.gold, 8000000000, "the wheel stake came back although poker failed");
	assert.equal(s.gold, 8000000000 - games.slots.gold, "only the failing refund is missing");
	assert.deepEqual(f.traces, ["#X tavern close poker: poker boom", "#X tavern close slots: slots boom"]);
	assert.ok(
		f.instance("game_log").some((m) => /closes its games/.test(m.message)),
		"the notice still went out",
	);
	assert.ok(d.p.poker && e.p.poker, "the failed poker step left the seats and their escrow untouched");
});

test("the exit waits for refund transactions still in flight, but never for a stuck one", async () => {
	let settle;
	const f = fixture({ tx: () => new Promise((resolve) => (settle = resolve)) }),
		d = f.login("Dealer"),
		e = f.login("Caller");
	stand(d, 1);
	stand(e, 0);
	assert.equal(d.poker({ event: "join", gold: 100 * BB, request_id: "join-d" }).success, true);
	assert.equal(e.poker({ event: "join", gold: 100 * BB, request_id: "join-e" }).success, true);
	d.disconnect();
	d.stop();
	assert.equal(f.c.tavern_pending(), 0);
	f.c.tavern_close();
	assert.equal(f.c.tavern_pending(), 1, "the absent player's refund runs through a transaction");
	assert.equal(e.gold, 8000000000, "the attached player was paid in memory");
	settle({ success: true });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(f.c.tavern_pending(), 0);
	f.c.tavern_poker_refunds.push(Date.now() - 20000);
	assert.equal(f.c.tavern_pending(), 0, "a transaction older than fifteen seconds does not hold the exit");
});
