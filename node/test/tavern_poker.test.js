const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const G = require("./helpers/design");
const { load, read, socketHandler } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

const games = vm.runInNewContext(read("design/games.js") + ";games", { module: { exports: {} } });
const poker = games.poker;
const BB = poker.blinds.III[1];
const SB = poker.blinds.III[0];

// A Tavern with up to five characters, the real poker socket handler and a clock the tests control.
function fixture(options = {}) {
	const packets = [],
		logs = [],
		refunds = [];
	let now = 1000000;
	const players = {},
		instances = { tavern: { name: "tavern", players: {}, observers: {}, dice: { players: {} } } },
		tavern = instances.tavern;
	const c = vm.createContext({
		G: Object.assign({}, G, { games }),
		S: { gold: 3000000000, logs: { donate: [], dice: [] } },
		Dev: false,
		server: { live: true, shutdown: false },
		is_pvp: !!options.pvp,
		server_name: options.server || "III",
		server_id: "SR_test",
		crypto,
		Math,
		Date,
		performance: { now: () => now },
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
		parseInt,
		parseFloat,
		String,
		to_pretty_num: (value) => String(value),
		lstack: (array, entry, limit) => {
			array.unshift(entry);
			while (array.length > limit) array.pop();
		},
		instance_emit: (instance, event, data) => packets.push({ event: "instance:" + event, data: plain(data) }),
		broadcast: (event, data) => packets.push({ event: "broadcast:" + event, data: plain(data) }),
		resend: (target, events) => logs.push("resend:" + target.name + ":" + events),
		server_log: (message) => logs.push("log:" + message),
		log_trace: (message, e) => {
			throw e;
		},
		randomStr: () => "tok" + Math.random().toString(36).slice(2, 8),
		tx: (F, A) => {
			refunds.push(A[0]);
			return Promise.resolve({ success: true });
		},
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
	function join_socket(name) {
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
			gold: options.gold === undefined ? 8000000000 : options.gold,
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
		const handler = socketHandler(c, "poker");
		player.request = (data) => {
			c.socket = socket;
			c.current_socket = socket;
			players[socket.id] = player;
			handler(data);
			const reply = packets.filter((p) => p.to === name && p.event === "game_response").pop();
			return reply && reply.data;
		};
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
		player.login = () => {
			player.dc = false;
			players[socket.id] = player;
			tavern.players[name] = player;
			delete c.dc_players[player.real_id];
			c.tavern_poker_login(player);
		};
		return player;
	}
	return {
		c,
		packets,
		logs,
		refunds,
		join_socket,
		table: () => c.tavern_poker_table(),
		// The real loop ticks once a second; a long wait is stepped the same way.
		tick: (ms) => {
			let left = ms || 1000;
			while (left > 0) {
				const step = Math.min(1000, left);
				now += step;
				left -= step;
				c.tavern_poker_tick();
			}
		},
		advance: (ms) => {
			now += ms;
		},
		now: () => now,
		state: () => c.tavern_poker_state(),
		cards: (name) => packets.filter((p) => p.to === name && p.event === "poker" && p.data.event === "cards").pop(),
	};
}

// Gold at the table: every stack, plus the chips of a live hand that sit in its pots.
function seat_gold(f) {
	const hand = f.table().hand,
		live = hand && !hand.over;
	return f
		.table()
		.seats.filter(Boolean)
		.reduce((sum, seat) => sum + seat.stack + (live && hand.entries.includes(seat) ? seat.total : 0), 0);
}

function play_out(f, choose) {
	const hand = f.table().hand;
	let guard = 0;
	while (!hand.over && guard++ < 500) {
		const seat = acting(f);
		if (seat) act(seat.player, ...(choose ? choose(seat, hand) : [hand.bet - seat.bet > 0 ? "call" : "check"]));
		else f.tick(1000);
	}
	assert.equal(hand.over, true, "the hand ended");
}

// A character standing next to a stool, as the table requires before a buy-in.
function beside(f, player, index) {
	const stool = poker.stools[index],
		machine = G.maps.tavern.machines.find((m) => m.type == "poker");
	player.x = machine.x + stool[0];
	player.y = machine.y + stool[1];
}

// Each character walks up to the next free stool before buying in.
function sit(f, names, buyin) {
	return names.map((name) => {
		const player = f.join_socket(name);
		beside(
			f,
			player,
			f.table().seats.findIndex((seat) => !seat),
		);
		const reply = player.request({ event: "join", gold: buyin || 100 * BB, request_id: "join-" + name });
		assert.equal(reply.success, true, name + " could not sit: " + JSON.stringify(reply));
		return player;
	});
}

function act(player, action, amount) {
	const reply = player.request({ event: "act", action, amount, request_id: "act-" + player.name });
	assert.equal(reply.success, true, player.name + " " + action + " " + amount + ": " + JSON.stringify(reply));
	return reply;
}

function acting(f) {
	const hand = f.table().hand;
	return hand && hand.acting >= 0 ? f.table().seats[hand.acting] : null;
}

test("the poker definition fixes one five-seat table with tiered blinds, a 40 to 200 big blind buy-in and a capped rake", () => {
	assert.equal(poker.seats, 5);
	assert.deepEqual(plain(poker.blinds), {
		I: [100000, 200000],
		II: [1000000, 2000000],
		III: [5000000, 10000000],
		IV: [10000000, 20000000],
		PVP: [100000000, 200000000],
	});
	assert.deepEqual(plain(poker.buyin), [40, 200]);
	assert.equal(poker.rake, 2);
	assert.equal(poker.rake_cap, 10);
	assert.equal(poker.stools.length, 5);
	assert.equal(poker.ranks.length * poker.suits.length, 52);
	assert.equal(poker.hands.length, 9);
	assert.ok(poker.action_ms >= 15000 && poker.bank_ms >= 15000 && poker.grace_ms >= 240000);
	const machines = G.maps.tavern.machines.filter((machine) => machine.type === "poker");
	assert.equal(machines.length, 1, "exactly one table in the Tavern");
	assert.deepEqual(plain(machines[0].frames), [[0, 416, 96, 48]]);
	const sheet = fs.readFileSync(path.join(__dirname, "../../images/tiles/map/custom.png"));
	assert.equal(sheet.readUInt32BE(16), 480);
	assert.equal(sheet.readUInt32BE(20), 480);
	assert.equal(fs.existsSync(path.join(__dirname, "../../images/cards/poker.png")), true);
	assert.match(read("design/sprites.js"), /custom\.png\?v=16/);
});

test("blinds follow the server tier and every other or PVP server plays the IV tier", () => {
	assert.deepEqual(plain(fixture({ server: "I" }).c.tavern_poker_blinds()), [100000, 200000]);
	assert.deepEqual(plain(fixture({ server: "II" }).c.tavern_poker_blinds()), [1000000, 2000000]);
	assert.deepEqual(plain(fixture({ server: "III" }).c.tavern_poker_blinds()), [5000000, 10000000]);
	assert.deepEqual(plain(fixture({ server: "IV" }).c.tavern_poker_blinds()), [10000000, 20000000]);
	assert.deepEqual(plain(fixture({ server: "PVP" }).c.tavern_poker_blinds()), [100000000, 200000000]);
	assert.deepEqual(plain(fixture({ server: "III", pvp: true }).c.tavern_poker_blinds()), [100000000, 200000000]);
	assert.equal(fixture({ server: "HARDCORE" }).c.tavern_poker_tier(), "IV");
});

test("the evaluator ranks every hand category, kickers and the wheel straight, and finds the best five of seven", () => {
	const { c } = fixture();
	const score = (cards) => plain(c.tavern_poker_score5(cards));
	const ranked = [
		["A_hearts", "K_hearts", "Q_hearts", "J_hearts", "10_hearts"],
		["9_clubs", "9_spades", "9_hearts", "9_diamonds", "2_clubs"],
		["3_clubs", "3_spades", "3_hearts", "K_diamonds", "K_clubs"],
		["2_hearts", "7_hearts", "9_hearts", "J_hearts", "K_hearts"],
		["5_clubs", "4_spades", "3_hearts", "2_diamonds", "A_clubs"],
		["Q_clubs", "Q_spades", "Q_hearts", "4_diamonds", "7_clubs"],
		["J_clubs", "J_spades", "4_hearts", "4_diamonds", "A_clubs"],
		["10_clubs", "10_spades", "5_hearts", "7_diamonds", "A_clubs"],
		["A_clubs", "K_spades", "9_hearts", "7_diamonds", "3_clubs"],
	];
	for (let i = 0; i < ranked.length; i++) {
		assert.equal(score(ranked[i])[0], 8 - i, ranked[i].join(" "));
		if (i) assert.ok(c.tavern_poker_compare(score(ranked[i - 1]), score(ranked[i])) > 0);
	}
	assert.deepEqual(
		score(["5_clubs", "4_spades", "3_hearts", "2_diamonds", "A_clubs"]),
		[4, 5],
		"the wheel counts five high",
	);
	assert.ok(
		c.tavern_poker_compare(
			score(["6_clubs", "5_spades", "4_hearts", "3_diamonds", "2_clubs"]),
			score(["5_clubs", "4_spades", "3_hearts", "2_diamonds", "A_clubs"]),
		) > 0,
	);
	assert.ok(
		c.tavern_poker_compare(
			score(["A_clubs", "A_spades", "K_hearts", "7_diamonds", "3_clubs"]),
			score(["A_hearts", "A_diamonds", "Q_hearts", "7_clubs", "3_spades"]),
		) > 0,
		"kickers decide equal pairs",
	);
	assert.equal(
		c.tavern_poker_compare(
			score(["A_clubs", "A_spades", "K_hearts", "7_diamonds", "3_clubs"]),
			score(["A_hearts", "A_diamonds", "K_clubs", "7_clubs", "3_spades"]),
		),
		0,
		"identical hands tie",
	);
	const best = c.tavern_poker_best(["2_hearts", "3_hearts", "9_clubs", "4_hearts", "K_spades", "5_hearts", "A_hearts"]);
	assert.equal(best.hand, "straight_flush");
	assert.deepEqual(plain(best.score), [8, 5]);
	const six = c.tavern_poker_best(["2_hearts", "2_clubs", "9_clubs", "9_hearts", "K_spades", "K_hearts"]);
	assert.equal(six.hand, "two_pair");
	assert.deepEqual(plain(six.score), [2, 13, 9, 2]);
	const deck = c.tavern_poker_deck();
	assert.equal(new Set(deck).size, 52);
	assert.equal(deck.length, 52);
});

test("joining escrows the buy-in on the seat, refuses bad buy-ins, far players, second seats per account and a full table", () => {
	const f = fixture();
	const a = f.join_socket("A");
	assert.equal(a.request({ event: "join", gold: 39 * BB, request_id: "r1" }).response, "poker_buyin");
	assert.equal(a.request({ event: "join", gold: 201 * BB, request_id: "r2" }).response, "poker_buyin");
	a.x = 200;
	assert.equal(a.request({ event: "join", gold: 100 * BB }).response, "poker_far");
	a.x = -168;
	a.map = "main";
	assert.equal(a.request({ event: "join", gold: 100 * BB }).response, "not_in_tavern");
	a.map = "tavern";
	const poor = f.join_socket("Poor");
	poor.gold = 10 * BB;
	assert.equal(poor.request({ event: "join", gold: 40 * BB }).response, "gold_not_enough");
	const joined = a.request({ event: "join", gold: 100 * BB, seat: 1, request_id: "r3" });
	assert.equal(joined.success, true);
	assert.equal(joined.seat, 1);
	assert.equal(a.gold, 8000000000 - 100 * BB);
	assert.deepEqual(plain(a.p.poker.stack), 100 * BB);
	assert.equal(a.p.poker.server, "SR_test");
	assert.equal(f.table().seats[1].id, "CH_A");
	const alt = f.join_socket("Alt");
	alt.owner = a.owner;
	assert.equal(alt.request({ event: "join", gold: 100 * BB }).response, "poker_seated");
	assert.equal(f.join_socket("B").request({ event: "join", gold: 100 * BB, seat: 1 }).response, "poker_seat_taken");
	for (const name of ["C", "D", "E", "F"]) {
		const player = f.join_socket(name);
		beside(
			f,
			player,
			f.table().seats.findIndex((seat) => !seat),
		);
		assert.equal(player.request({ event: "join", gold: 100 * BB }).success, true);
	}
	assert.equal(f.join_socket("Late").request({ event: "join", gold: 100 * BB }).response, "poker_full");
	assert.equal(
		f.packets.filter((p) => p.event === "instance:poker").length >= 5,
		true,
		"the room sees every seat change",
	);
	const info = a.request({ event: "info", request_id: "i" });
	assert.equal(info.table.seats.filter(Boolean).length, 5);
	assert.deepEqual(plain(info.table.blinds), [SB, BB]);
	assert.deepEqual(plain(info.table.buyin), [40 * BB, 200 * BB]);
	assert.equal(seat_gold(f), 500 * BB);
});

test("a hand deals blinds and cards, runs four streets with legal actions only, and settles rake, stacks and logs", () => {
	const f = fixture();
	const [a, b, cc] = sit(f, ["A", "B", "C"]);
	assert.equal(f.table().hand, null);
	f.tick(4000);
	const hand = f.table().hand;
	assert.ok(hand && !hand.over, "the hand started once two players were ready");
	assert.equal(hand.street, "preflop");
	assert.equal(f.table().button, 0);
	assert.equal(f.table().seats[1].bet, SB);
	assert.equal(f.table().seats[2].bet, BB);
	assert.equal(hand.pot, SB + BB);
	assert.equal(hand.acting, 0, "the seat after the big blind acts first");
	assert.match(hand.commit, /^[0-9a-f]{64}$/);
	assert.equal(f.state().hand.key, undefined, "the key stays secret until the hand ends");
	for (const player of [a, b, cc]) {
		const cards = f.cards(player.name);
		assert.equal(cards.data.cards.length, 2);
		assert.equal(cards.data.n, hand.n);
	}
	assert.equal(b.request({ event: "act", action: "call" }).response, "poker_not_your_turn");
	assert.equal(a.request({ event: "act", action: "check" }).response, "poker_invalid_action");
	assert.equal(a.request({ event: "act", action: "raise", amount: BB + 1 }).response, "poker_min_raise");
	assert.equal(act(a, "raise", 3 * BB).action, "raise");
	assert.equal(hand.bet, 3 * BB);
	assert.equal(hand.min_raise, 2 * BB);
	assert.equal(hand.acting, 1);
	act(b, "call");
	assert.equal(f.table().seats[1].bet, 3 * BB);
	act(cc, "call");
	assert.equal(hand.acting, -1, "the round is complete");
	f.tick(1000);
	assert.equal(hand.street, "flop");
	assert.equal(hand.board.length, 3);
	assert.equal(hand.acting, 1, "after the flop the first live seat after the button acts");
	act(b, "check");
	act(cc, "check");
	act(a, "bet", 5 * BB);
	act(b, "fold");
	act(cc, "call");
	f.tick(1000);
	assert.equal(hand.street, "turn");
	act(cc, "check");
	act(a, "check");
	f.tick(1000);
	assert.equal(hand.street, "river");
	act(cc, "check");
	act(a, "check");
	f.tick(1000);
	assert.equal(hand.over, true);
	assert.equal(hand.street, "showdown");
	assert.equal(hand.board.length, 5);
	const pot = 3 * BB * 3 + 5 * BB * 2;
	const rake = Math.min(Math.floor((pot * poker.rake) / 100), poker.rake_cap * BB);
	assert.equal(hand.rake, rake);
	assert.equal(f.c.S.gold, 3000000000 + rake);
	assert.equal(seat_gold(f) + f.c.S.gold, 300 * BB + 3000000000, "gold is conserved");
	const winners = Object.keys(hand.results.winners);
	assert.ok(winners.length >= 1);
	assert.ok(hand.results.shown["0"] && hand.results.shown["2"], "showdown reveals the contenders");
	assert.equal(hand.results.shown["1"], undefined, "a folded hand stays hidden");
	const state = f.state();
	assert.equal(state.hand.key, hand.key);
	assert.equal(
		crypto.createHmac("sha256", hand.key).update(state.hand.order.join(",")).digest("hex"),
		hand.commit,
		"the published key and deck order verify the commitment",
	);
	assert.equal(new Set(state.hand.order).size, 52);
	assert.equal(f.c.S.logs.poker[0].t, "hand");
	assert.equal(f.c.S.logs.poker[0].commit, hand.commit);
	assert.equal(f.c.S.logs.poker[0].key, hand.key);
	assert.ok(f.c.S.logs.poker[0].actions.some((entry) => /^s0:raise:/.test(entry)));
	assert.ok(
		f.c.S.logs.poker[0].actions.some((entry) => /^s0:bet:/.test(entry)),
		"the flop bet is a bet, the pre-flop one a raise",
	);
	for (const seat of f.table().seats.filter(Boolean))
		assert.equal(seat.player.p.poker.stack, seat.stack, "the escrow mirror follows the stack");
	assert.ok(
		f.packets.some(
			(p) =>
				p.to === winners.map((i) => f.table().seats[i].name)[0] &&
				p.event === "game_log" &&
				p.data.phrase === "server.game_log.poker_won",
		),
	);
	f.tick(poker.showdown_ms + 1000);
	assert.equal(f.table().hand.n, 2, "the next hand deals after the pause");
	assert.equal(f.table().button, 1, "the button moved");
});

test("side pots pay each all-in only what it covered, an uncalled bet returns without rake and ties split with the odd gold after the button", () => {
	const f = fixture();
	const [a, b, cc] = sit(f, ["A", "B", "C"], 40 * BB);
	f.table().seats[1].stack = 10 * BB;
	f.table().seats[2].stack = 25 * BB;
	f.tick(4000);
	const hand = f.table().hand;
	// A opens for everything, the short stacks call all in.
	act(a, "allin");
	assert.equal(act(b, "call").action, "call");
	assert.equal(f.table().seats[1].allin, true);
	act(cc, "call");
	assert.equal(hand.acting, -1, "nobody can act, the board runs out");
	play_out(f);
	const pots = hand.results.pots;
	assert.equal(pots.length, 3);
	assert.deepEqual(
		plain(pots[0]).gold + plain(pots[0]).rake,
		30 * BB,
		"the main pot is three times the shortest stack",
	);
	assert.deepEqual(plain(pots[1]).gold + plain(pots[1]).rake, 30 * BB, "the middle pot is twice the difference");
	assert.deepEqual(plain(pots[2]), { gold: 15 * BB, returned: 0 }, "A's uncalled 15 big blinds come back without rake");
	assert.equal(hand.results.returned[0], 15 * BB, "the return is reported apart from winnings");
	assert.ok(
		!hand.results.winners[0] || hand.results.winners[0] <= 60 * BB,
		"winnings never include the returned chips",
	);
	assert.equal(pots[0].rake, Math.floor((30 * BB * 2) / 100));
	assert.equal(seat_gold(f) + f.c.S.gold, 3000000000 + 40 * BB + 10 * BB + 25 * BB, "gold is conserved");
	assert.ok(!pots[1].winners.includes(1), "the shortest stack cannot win the side pot");
	// Ties: force identical best hands through a shared board.
	const g = fixture();
	const [x, y] = sit(g, ["X", "Y"], 50 * BB);
	g.tick(4000);
	const h = g.table().hand;
	h.deck = ["2_clubs", "3_clubs", "4_clubs", "A_hearts", "K_hearts", "Q_hearts", "J_hearts", "10_hearts"].reverse();
	g.table().seats[0].cards = ["2_hearts", "3_hearts"];
	g.table().seats[1].cards = ["2_diamonds", "3_diamonds"];
	act(g.table().seats[h.acting].player, "call");
	act(g.table().seats[h.acting].player, "check");
	g.tick(1000);
	act(g.table().seats[h.acting].player, "bet", 3 * BB + 1);
	act(g.table().seats[h.acting].player, "call");
	g.tick(1000);
	act(g.table().seats[h.acting].player, "check");
	act(g.table().seats[h.acting].player, "check");
	g.tick(1000);
	act(g.table().seats[h.acting].player, "check");
	act(g.table().seats[h.acting].player, "check");
	g.tick(1000);
	assert.equal(h.over, true);
	assert.deepEqual(Object.keys(h.results.winners).sort(), ["0", "1"], "both play the board's royal flush");
	const pot = 2 * (BB + 3 * BB + 1) - Math.floor((2 * (BB + 3 * BB + 1) * 2) / 100);
	const first = g.c.tavern_poker_next_index(g.table().button, g.table().seats);
	assert.equal(
		h.results.winners[first] - h.results.winners[1 - first],
		pot % 2,
		"the odd gold goes to the first winner after the button",
	);
	assert.equal(seat_gold(g) + g.c.S.gold, 3000000000 + 100 * BB);
});

test("the clock gives a time bank once, then checks for free or folds, and a fold that leaves one player ends the hand", () => {
	const f = fixture();
	const [a, b] = sit(f, ["A", "B"]);
	f.tick(4000);
	const hand = f.table().hand;
	assert.equal(hand.acting, 0, "heads-up the button posts the small blind and acts first");
	const deadline = hand.deadline;
	assert.ok(
		deadline - f.now() <= poker.action_ms && deadline - f.now() > poker.action_ms - 2000,
		"the clock starts with the deal",
	);
	f.tick(deadline - f.now() - 1000);
	assert.equal(hand.acting, 0);
	assert.equal(hand.banked, false);
	f.tick(1000);
	assert.equal(hand.banked, true, "the bank started");
	assert.equal(hand.acting, 0);
	f.tick(poker.bank_ms + 1000);
	assert.equal(hand.over, true, "folding to the big blind ends the hand");
	assert.ok(f.packets.some((p) => p.to === "A" && p.data && p.data.phrase === "server.game_log.poker_auto_fold"));
	assert.equal(
		f.table().seats[1].stack,
		100 * BB + SB - Math.floor((2 * SB * 2) / 100),
		"the big blind wins the small blind minus rake and keeps its uncalled part",
	);
	f.tick(poker.showdown_ms + 1000);
	const second = f.table().hand;
	assert.equal(second.n, 2);
	act(f.table().seats[second.acting].player, "call");
	f.tick(poker.action_ms + poker.bank_ms + 2000);
	assert.equal(second.street, "flop", "a free decision is checked, not folded");
	assert.ok(f.packets.some((p) => p.data && p.data.phrase === "server.game_log.poker_auto_check"));
});

test("disconnecting keeps the seat: the clock still folds, blinds are posted for two hands, then the seat sits out and a reconnect resumes it", () => {
	const f = fixture();
	const [a, b, cc] = sit(f, ["A", "B", "C"]);
	f.tick(4000);
	const hand = f.table().hand;
	const actor = f.table().seats[hand.acting];
	actor.player.disconnect();
	assert.equal(actor.player, null);
	assert.ok(actor.dc);
	assert.equal(f.state().seats[actor.index].dc, true, "the room sees the seat as disconnected");
	f.tick(poker.action_ms + poker.bank_ms + 2000);
	assert.equal(actor.folded, true, "the server folded for the absent player");
	play_out(f);
	const before = actor.stack;
	let hands = 0;
	while (actor.out === false) {
		f.tick(poker.showdown_ms + 1000);
		const h = f.table().hand;
		assert.ok(h && !h.over, "a new hand was dealt");
		hands++;
		let guard = 0;
		while (!h.over && guard++ < 500) {
			const seat = acting(f);
			if (seat && seat !== actor) act(seat.player, h.bet - seat.bet > 0 ? "call" : "check");
			else f.tick(1000);
		}
		assert.ok(hands <= poker.blind_hands + 1, "a disconnected seat stops being dealt after its blind hands");
	}
	assert.equal(hands, poker.blind_hands);
	assert.ok(actor.stack >= before - poker.blind_hands * BB, "at most two blinds were lost");
	f.advance(60000);
	actor.balance = actor.stack = 77 * BB;
	const player = f.c.dc_players[actor.id];
	player.login();
	assert.equal(actor.player, player);
	assert.equal(actor.dc, null);
	assert.equal(player.p.poker.stack, 77 * BB, "the live seat is authoritative after a reconnect");
	assert.ok(f.packets.some((p) => p.to === player.name && p.data && p.data.phrase === "server.game_log.poker_back"));
	assert.ok(
		f.packets.filter((p) => p.to === player.name && p.event === "poker" && p.data.event === "state").length >= 1,
	);
	assert.equal(f.c.dc_players[actor.id], undefined);
});

test("a seat left disconnected past the grace period is cashed out through a single-payment refund transaction", () => {
	const f = fixture();
	const [a, b] = sit(f, ["A", "B"]);
	f.tick(4000);
	const hand = f.table().hand;
	const seat = f.table().seats[hand.acting];
	const other = f.table().seats[1 - hand.acting];
	seat.player.disconnect();
	seat.player = null;
	f.c.dc_players[seat.id].stop();
	f.tick(poker.action_ms + poker.bank_ms + 2000);
	assert.equal(hand.over, true);
	const stack = seat.stack;
	// The absent seat is still dealt its blind hands, then sits out; the grace period runs from the disconnect.
	let last = stack,
		guard = 0;
	while (f.table().seats[seat.index] && guard++ < 400) {
		last = seat.stack;
		f.tick(1000);
	}
	assert.equal(f.table().seats[seat.index], null, "the seat was vacated");
	assert.ok(f.now() - seat.dc >= poker.grace_ms, "not before the grace period");
	assert.ok(last <= stack && last >= stack - poker.blind_hands * BB, "at most the blind hands were lost meanwhile");
	assert.deepEqual(
		plain(f.refunds),
		[{ id: seat.id, token: seat.token, gold: last }],
		"the refund carries the final stack",
	);
	assert.equal(f.table().seats[other.index], other, "the remaining player keeps its seat");
	assert.ok(f.c.S.logs.poker.some((entry) => entry.t === "cash_out" && entry.reason === "grace"));
});

test("walking away, using Leave and sitting out cash out at the right moment, and a broke stack sits out until it rebuys", () => {
	const f = fixture();
	const [a, b, cc] = sit(f, ["A", "B", "C"]);
	f.tick(4000);
	const hand = f.table().hand;
	// Leave during a hand waits for the hand; leave between hands is immediate.
	const leaver = f.table().seats[hand.acting];
	assert.deepEqual(plain(leaver.player.request({ event: "leave", request_id: "l" })).leaving, true);
	assert.equal(leaver.leaving, true);
	act(leaver.player, "fold");
	assert.equal(f.table().seats[leaver.index], leaver, "still seated while the hand runs");
	play_out(f);
	assert.equal(f.table().seats[leaver.index], null, "cashed out at the end of the hand");
	assert.equal(
		leaver.player.gold,
		8000000000 - (leaver.total || 0),
		"the purse got the stack back minus the chips lost in the hand",
	);
	assert.equal(leaver.player.p.poker, undefined);
	assert.equal(a.gold + b.gold + cc.gold + seat_gold(f) + f.c.S.gold, 3 * 8000000000 + 3000000000, "gold is conserved");
	// Walking away from the stool after the join grace marks the seat leaving.
	const walker = f.table().seats.find(Boolean);
	f.advance(13000);
	walker.player.x = walker.player.x + 300;
	f.tick(1000);
	assert.equal(walker.leaving, true);
	assert.ok(f.packets.some((p) => p.to === walker.name && p.data && p.data.phrase === "server.game_log.poker_leaving"));
	f.tick(poker.showdown_ms + 1000);
	assert.equal(f.table().seats[walker.index], null, "no hand was running, so it cashed out at once");
	// Sitting out stops deals; sitting out past the grace period cashes out.
	const g = fixture();
	const [x, y, z] = sit(g, ["X", "Y", "Z"]);
	assert.equal(x.request({ event: "sit_out", request_id: "s" }).success, true);
	g.tick(4000);
	assert.equal(g.table().hand.entries.length, 2, "a sitting-out seat is not dealt");
	assert.equal(g.table().seats[0].out, true);
	assert.equal(x.request({ event: "sit_in" }).success, true);
	assert.equal(g.table().seats[0].out, false);
	assert.equal(x.request({ event: "sit_out" }).success, true);
	play_out(g, () => ["fold"]);
	g.tick(poker.grace_ms + 2000);
	assert.equal(g.table().seats[0], null, "an idle seat is returned to the purse");
	assert.equal(x.gold, 8000000000);
	// A broke stack sits out and may buy back in.
	const k = fixture();
	const [p, q] = sit(k, ["P", "Q"], 40 * BB);
	k.table().seats[0].stack = BB - 1;
	k.tick(4000);
	play_out(k);
	const broke = k.table().seats.find((seat) => seat && seat.stack < BB);
	if (broke) {
		assert.equal(broke.out, true);
		assert.equal(broke.broke, true);
		assert.equal(broke.player.request({ event: "sit_in" }).response, "poker_broke");
		assert.equal(broke.player.request({ event: "join", gold: 300 * BB }).response, "poker_buyin");
		assert.equal(broke.player.request({ event: "join", gold: 50 * BB }).success, true);
		assert.equal(broke.out, false);
		assert.equal(broke.stack >= 50 * BB, true);
	}
});

test("a shutdown voids the live hand without rake and cashes out every seat; stale escrow is refunded at login", async () => {
	const f = fixture();
	const [a, b, cc] = sit(f, ["A", "B", "C"]);
	f.tick(4000);
	const hand = f.table().hand;
	act(f.table().seats[hand.acting].player, "raise", 10 * BB);
	act(f.table().seats[hand.acting].player, "call");
	f.table().seats[hand.acting].player.disconnect();
	const house = f.c.S.gold;
	f.c.tavern_poker_shutdown();
	assert.equal(hand.over, true);
	assert.equal(hand.voided, true);
	assert.equal(f.c.S.gold, house, "no rake on a voided hand");
	assert.deepEqual(plain(f.table().seats), [null, null, null, null, null]);
	assert.equal(a.gold + b.gold + cc.gold, 3 * 8000000000, "every chip went back to its purse");
	assert.equal(a.p.poker, undefined);
	assert.equal(cc.p.poker, undefined, "the disconnected player being saved by this server was settled in memory");
	assert.deepEqual(plain(f.refunds), []);
	// A character arriving with an escrow record from a lost table is refunded once.
	const late = f.join_socket("Late");
	late.gold = 5;
	late.p.poker = { token: "old", stack: 44 * BB, server: "SR_other" };
	const entity = { _id: late.real_id, info: late };
	await f.c.tavern_poker_recover(entity, async () => null);
	late.login();
	assert.equal(late.gold, 5 + 44 * BB);
	assert.equal(late.p.poker, undefined);
	late.login();
	assert.equal(late.gold, 5 + 44 * BB, "a second login does not pay again");
});

test("a seat whose escrow was already returned by another login is forfeited on relogin, never paid twice", () => {
	const f = fixture();
	const [a, b] = sit(f, ["A", "B"]);
	const house = f.c.S.gold;
	// A drops, is saved and logs in on another server, where the escrow record is refunded from the saved data.
	a.disconnect();
	a.stop();
	const escrow = plain(a.p.poker);
	assert.equal(escrow.stack, 100 * BB);
	a.gold += escrow.stack;
	delete a.p.poker;
	// Back on this server within the grace period the seat still exists, but the record it was mirrored to is gone.
	a.login();
	assert.equal(f.table().seats[0], null, "the seat was cleared without payment");
	assert.equal(a.gold, 8000000000, "A holds exactly one refund");
	assert.equal(f.c.S.gold, house, "the house does not pocket the phantom stack either");
	assert.deepEqual(plain(f.refunds), [], "no transaction refund was attempted");
	assert.ok(f.c.S.logs.poker.some((entry) => entry.t === "forfeit" && entry.gold === 100 * BB));
	assert.equal(a.p.poker, undefined);
});

test("400 random hands conserve gold: stacks plus pots plus rake always equal the buy-ins", () => {
	const purse = 1000000000000;
	const f = fixture({ gold: purse });
	const names = ["A", "B", "C", "D", "E"];
	const players = sit(f, names, 100 * BB);
	const start = 500 * BB + f.c.S.gold;
	let hands = 0,
		guard = 0;
	const rnd = (n) => crypto.randomInt(n);
	while (hands < 400 && guard++ < 200000) {
		const table = f.table();
		for (const seat of table.seats)
			if (seat && seat.stack < BB && seat.out)
				seat.player.request({ event: "join", gold: Math.min(100 * BB, 200 * BB - seat.stack) });
		for (const seat of table.seats) if (seat) assert.equal(seat.player.p.poker.stack, seat.balance);
		const hand = table.hand;
		const seat = acting(f);
		if (seat) {
			const r = rnd(10),
				to_call = hand.bet - seat.bet;
			if (r < 3 && to_call > 0) act(seat.player, "fold");
			else if (r < 6) act(seat.player, to_call > 0 ? "call" : "check");
			else if (r < 9) {
				const reply = seat.player.request({
					event: "act",
					action: "raise",
					amount: hand.bet + hand.min_raise + rnd(5) * BB,
				});
				if (!reply.success) act(seat.player, to_call > 0 ? "call" : "check");
			} else {
				const reply = seat.player.request({ event: "act", action: "allin" });
				if (!reply.success) act(seat.player, to_call > 0 ? "call" : "check");
			}
		} else f.tick(1000);
		if (hand && hand.over && hand.n > hands) hands = hand.n;
		assert.equal(
			seat_gold(f) + f.c.S.gold + players.reduce((sum, p) => sum + p.gold - (purse - 100 * BB), 0),
			start,
			"gold conserved at every step",
		);
	}
	assert.ok(hands >= 400, "played " + hands + " hands");
	assert.ok(f.c.S.gold > 3000000000, "the house collected rake");
	for (const entry of f.c.S.logs.poker.filter((e) => e.t === "hand")) assert.ok(entry.rake <= poker.rake_cap * BB * 5);
});

test("the poker overlay, floor table and packets stay silent without graphics", () => {
	const source = read("js/tavern_poker.js");
	const emitted = [];
	const c = vm.createContext({
		G: { games },
		no_graphics: true,
		no_html: "bot",
		character: { name: "A", real_x: 0, real_y: 0, m: 0 },
		current_map: "tavern",
		map_machines: {},
		socket: { emit: (event, data) => emitted.push({ event, data }) },
		call_code_function: (name, event, data) => emitted.push({ event: "code:" + event, data }),
		Date,
		Math,
		Object,
		parseInt,
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
		window: {},
		performance: { now: () => 0 },
		get_entity: () => null,
		d_text: () => {
			throw new Error("floating text drawn");
		},
		confetti_shower: () => {
			throw new Error("confetti drawn");
		},
		wheel_sound: () => {
			throw new Error("sound played");
		},
		show_modal: () => {
			throw new Error("modal opened");
		},
		hide_modal: () => {
			throw new Error("modal closed");
		},
		setInterval: () => {
			throw new Error("timer started");
		},
		clearInterval: () => {},
		ui_log: () => {},
		phrase: { has: () => true, html: () => "" },
		to_pretty_num: (value) => String(value),
	});
	vm.runInContext(source, c);
	const state = {
		event: "state",
		now: Date.now(),
		next: 0,
		blinds: [SB, BB],
		seats: [{ index: 0, name: "A", stack: 1, cards: 2 }, null, null, null, null],
		button: 0,
		hand: {
			n: 1,
			street: "showdown",
			over: true,
			acting: -1,
			board: ["A_hearts"],
			results: { winners: { 0: 100 }, hands: {}, shown: {}, pots: [] },
		},
		log: [],
	};
	c.render_poker();
	c.poker_event(state);
	c.poker_event({ event: "cards", n: 1, cards: ["A_hearts", "K_hearts"] });
	c.poker_response({ failed: true, response: "poker_far", place: "poker" });
	c.poker_response({ success: true, seat: 0, buyin: 1, place: "poker" });
	assert.equal(c.poker_texture("A_hearts"), null);
	c.poker_floor_burst({}, 1);
	c.poker_map_attach({});
	c.poker_map_show();
	c.poker_map_update({});
	c.poker_clock();
	assert.equal(c.tavern_poker.state.hand.n, 1, "the state is kept for CODE");
	assert.deepEqual(plain(c.tavern_poker.cards), ["A_hearts", "K_hearts"]);
	assert.ok(
		emitted.some((entry) => entry.event === "code:poker"),
		"CODE hears the poker event",
	);
	assert.ok(!emitted.some((entry) => entry.event === "move"), "no walk without graphics");
	assert.deepEqual(plain(c.poker_card_xy("10_spades")), [9, 3]);
	assert.deepEqual(plain(c.poker_card_xy(null)), [0, 4]);
	// Pure HTML also follows the server's legal raise state, without creating graphics.
	Object.assign(state.hand, { over: false, acting: 0, bet: 40, min_raise: 20 });
	Object.assign(state.seats[0], { can_raise: false, bet: 30, stack: 70 });
	assert.doesNotMatch(c.poker_actions_html(), /pk-raise|pk-allin/);
	state.seats[0].stack = 10;
	assert.match(c.poker_actions_html(), /pk-allin/, "an all-in call remains available");
	state.hand.settling = true;
	assert.doesNotMatch(c.poker_actions_html(), /poker_action\(/, "no action while the award is saving");
});

// Execute the actual MongoDB transaction helper against the optimistic store, including write conflicts.
function durable_fixture(beforeCommit) {
	const f = fixture();
	const people = sit(f, ["A", "B"], 40 * BB);
	load(f.c, "node/server.js", ["player_to_server", "sync_entity"]);
	load(f.c, "node/logic/character_sessions.js", ["owns_character_session"]);
	load(f.c, "node/logic/tavern_poker.js", ["tavern_poker_checkpoint"]);
	const documents = people.map((player) => {
		player._id = player.real_id;
		player.secret = "session-" + player.name;
		player.type = "warrior";
		return {
			_id: player.real_id,
			owner: player.owner,
			server: f.c.server_id,
			info: { gold: 8000000000, secret: player.secret, p: {} },
		};
	});
	documents.push({ _id: f.c.server_id, online: true, updated: new Date() });
	const store = require("./helpers/server_vm").transactions(f.c, documents, beforeCommit);
	return Object.assign(f, { people, store });
}

async function checkpoint_done(f) {
	for (let i = 0; i < 100 && f.table().saving; i++) await new Promise(setImmediate);
	assert.equal(!!f.table().saving, false, "checkpoint completed");
}

test("periodic saves include escrow and its removal with the purse, without saving the large p object", async () => {
	const f = durable_fixture(),
		[a] = f.people;
	const entity = f.store.records.get(a.real_id);
	const save = plain(f.c.player_to_server(a, "sync"));
	assert.equal(save.p, undefined);
	f.c.sync_entity(entity, save);
	const reboot = fixture();
	await reboot.c.tavern_poker_recover(entity, async () => null);
	assert.equal(entity.info.gold, 8000000000);
	assert.equal(entity.info.p.poker, undefined);
	a.request({ event: "leave" });
	f.c.sync_entity(entity, plain(f.c.player_to_server(a, "sync")));
	await reboot.c.tavern_poker_recover(entity, async () => null);
	assert.equal(entity.info.gold, 8000000000, "cash-out cannot leave a second refund");
});

test("a crash with all chips in the pot returns every opening stack; live hands cannot be claimed on another server", async () => {
	const f = durable_fixture(),
		[a, b] = f.people;
	f.tick(4000);
	await checkpoint_done(f);
	act(a, "allin");
	act(b, "call");
	assert.equal(f.table().hand.pot, 80 * BB);
	const other = fixture();
	other.c.server_id = "SR_other";
	const read = async (id) => plain(f.store.records.get(id));
	for (const p of f.people) {
		const entity = plain(f.store.records.get(p.real_id));
		assert.equal(entity.info.p.poker.stack, 40 * BB);
		assert.equal(await other.c.tavern_poker_recover(entity, read), false);
		assert.equal(await other.c.tavern_poker_recover(entity, async () => null), true);
		assert.equal(entity.info.gold, 8000000000);
		await other.c.tavern_poker_recover(entity, async () => null);
		assert.equal(entity.info.gold, 8000000000, "refund is consumed exactly once");
	}
});

test("awards commit together, survive a lost acknowledgement, and stale autosaves cannot replace newer balances", async () => {
	const f = durable_fixture(),
		[a, b] = f.people;
	f.tick(4000);
	await checkpoint_done(f);
	const stale = plain(f.c.player_to_server(b, "sync"));
	const tx = f.c.tx;
	let lost = true;
	f.c.tx = async (...args) => {
		const result = await tx(...args);
		if (lost) {
			lost = false;
			return { failed: true, reason: "lost_reply" };
		}
		return result;
	};
	act(a, "fold");
	await checkpoint_done(f);
	assert.equal(f.table().hand.over, false, "a result waits for its receipt");
	const after = f.people.map((p) => plain(f.store.records.get(p.real_id)));
	assert.equal(
		after.reduce((sum, e) => sum + e.info.gold + e.info.p.poker.stack, 0) + f.table().hand.settlement.rake,
		16000000000,
	);
	assert.ok(after.every((e) => !e.info.p.poker.hand));
	f.c.sync_entity(after[1], stale);
	assert.equal(after[1].info.p.poker.stack, f.store.records.get(b.real_id).info.p.poker.stack);
	f.tick();
	await checkpoint_done(f);
	assert.equal(f.table().hand.over, true);
	assert.equal(f.c.S.gold, 3000000000 + f.table().hand.rake);
	assert.equal(seat_gold(f) + a.gold + b.gold + f.table().hand.rake, 16000000000);
});

test("a consumed remote escrow cannot post another blind, and recovery fences a delayed showdown", async () => {
	const f = durable_fixture(),
		[a] = f.people;
	const other = fixture();
	other.c.server_id = "SR_other";
	let entity = f.store.records.get(a.real_id);
	f.c.sync_entity(entity, plain(f.c.player_to_server(a)));
	a.disconnect();
	a.stop();
	entity.server = "";
	await other.c.tavern_poker_recover(entity, async () => null);
	entity.server = "SR_other";
	f.tick(4000);
	await checkpoint_done(f);
	assert.equal(f.table().hand, null);
	assert.equal(f.table().seats[0], null);
	assert.equal(entity.info.gold, 8000000000);

	const g = durable_fixture(),
		[x, y] = g.people;
	g.tick(4000);
	await checkpoint_done(g);
	x.disconnect();
	x.stop();
	entity = g.store.records.get(x.real_id);
	entity.server = "";
	await other.c.tavern_poker_recover(entity, async () => null);
	entity.server = "SR_other";
	g.tick(poker.action_ms + poker.bank_ms + 1000);
	await checkpoint_done(g);
	assert.equal(g.table().hand.voided, true, "resumed process cannot award refunded chips");
	assert.equal(g.table().seats[0], null);
	assert.equal(g.table().seats[1].stack + y.gold, 8000000000);
	assert.equal(g.c.S.gold, 3000000000);
});

test("a short all-in cannot reopen a raise, but cumulative short raises can", () => {
	const f = fixture();
	const [a, b, c] = sit(f, ["A", "B", "C"], 40 * BB);
	a.request({ event: "join", gold: 60 * BB });
	c.request({ event: "join", gold: 60 * BB });
	f.tick(4000);
	act(a, "raise", 30 * BB);
	act(b, "allin");
	act(c, "call");
	assert.equal(f.state().seats[0].can_raise, false);
	assert.equal(a.request({ event: "act", action: "allin" }).failed, true);
	act(a, "call");
	const g = fixture();
	const [y, z, d, x] = sit(g, ["Y", "Z", "D", "X"], 40 * BB);
	x.request({ event: "join", gold: 100 * BB });
	z.request({ event: "join", gold: 20 * BB });
	d.request({ event: "join", gold: 60 * BB });
	g.tick(4000);
	act(x, "raise", 30 * BB);
	act(y, "allin");
	act(z, "allin");
	act(d, "call");
	assert.equal(g.state().seats[3].can_raise, true);
	assert.equal(x.request({ event: "act", action: "raise", amount: 89 * BB }).success, true);
});

test("dealing waits for an in-flight bank or character save instead of saving half of it", async () => {
	const f = durable_fixture(),
		[a] = f.people;
	a.mount_call = true;
	f.tick(4000);
	await checkpoint_done(f);
	assert.equal(f.table().hand, null);
	assert.equal(f.store.records.get(a.real_id).info.gold, 8000000000);
	delete a.mount_call;
	f.tick(4000);
	await checkpoint_done(f);
	assert.ok(f.table().hand && !f.table().hand.over);
});

test("forfeiting clears only the consumed token from attached and disconnected mirrors", async () => {
	for (const disconnected of [false, true]) {
		const f = durable_fixture(),
			[a] = f.people;
		f.tick(4000);
		await checkpoint_done(f);
		const seat = f.table().seats[0];
		if (disconnected) a.disconnect();
		delete f.store.records.get(a.real_id).info.p.poker;
		f.c.tavern_poker_finish();
		await checkpoint_done(f);
		assert.equal(seat.settled, true);
		assert.equal(a.p.poker, undefined);
		const entity = f.store.records.get(a.real_id);
		f.c.sync_entity(entity, plain(f.c.player_to_server(a, "sync")));
		assert.equal(entity.info.p.poker, undefined, "an autosave cannot restore the consumed mirror");
	}
	const f = fixture(),
		[a] = sit(f, ["A"]),
		seat = f.table().seats[0];
	const disconnected = { p: { poker: { token: "new-seat", stack: 123 } } };
	f.c.dc_players[a.real_id] = disconnected;
	const arriving = { ...a, p: {} };
	f.c.tavern_poker_login(arriving);
	assert.equal(a.p.poker, undefined, "login clears the old attached mirror before detaching it");
	assert.equal(disconnected.p.poker.token, "new-seat", "a different escrow remains intact");
});

test("a hung checkpoint stops delaying shutdown after 30 seconds without unlocking the table", async () => {
	const f = durable_fixture(),
		[a] = f.people;
	let release;
	f.c.tx = () =>
		new Promise((resolve) => {
			release = resolve;
		});
	f.tick(4000);
	assert.equal(f.c.tavern_pending(), 1);
	assert.equal(a.request({ event: "sit_out" }).response, "poker_saving");
	assert.equal(a.request({ event: "info" }).success, true, "table information remains available");
	f.advance(30000);
	assert.equal(f.c.tavern_pending(), 0);
	assert.equal(f.c.tavern_pending(), 0);
	assert.equal(f.table().saving, true, "an unknown commit must not permit another transaction");
	assert.equal(f.logs.filter((line) => line.includes("checkpoint exceeded 30 seconds")).length, 1);
	release({ failed: true });
	await checkpoint_done(f);
	assert.equal(f.table().saving, false, "a delayed reply is still handled");
});

test("the award transaction voids incorrect or invalid totals and returns the persisted opening balances", async () => {
	for (const corrupt of [
		(s) => s.awards[0]++,
		(s) => (s.awards[0] = -1),
		(s) => (s.awards[0] = NaN),
		(s) => (s.rake = 0.5),
	]) {
		const f = durable_fixture(),
			[a] = f.people;
		f.tick(4000);
		await checkpoint_done(f);
		const calculate = f.c.tavern_poker_calculate;
		f.c.tavern_poker_calculate = () => {
			calculate();
			corrupt(f.table().hand.settlement);
		};
		act(a, "fold");
		await checkpoint_done(f);
		assert.equal(f.table().hand.voided, true);
		assert.equal(f.c.S.gold, 3000000000, "no rake on a failed invariant");
		for (const p of f.people) {
			const saved = f.store.records.get(p.real_id);
			assert.equal(saved.info.gold + saved.info.p.poker.stack, 8000000000);
			assert.equal(saved.info.p.poker.hand, null);
		}
		assert.equal(f.store.records.get("IE_POKER-SR_test").info.conservation_failed, true);
		assert.ok(f.logs.some((line) => line.includes("did not conserve gold")));
	}
});

test("recovery adds numeric legacy purses and uses locally observed heartbeat progress despite clock skew", async () => {
	const f = fixture();
	const entity = {
		_id: "CH_late",
		info: { gold: "100", p: { poker: { token: "legacy", stack: "50", server: "SR_old" } } },
	};
	await f.c.tavern_poker_recover(entity, async () => null);
	assert.equal(entity.info.gold, 150);
	for (const skew of [-3600000, 3600000]) {
		const source = { _id: "SR_skew" + skew, online: true, updated: new Date(Date.now() + skew) };
		assert.equal(f.c.tavern_poker_source_live(source), true);
		f.advance(59000);
		assert.equal(f.c.tavern_poker_source_live(source), true);
		source.updated = new Date(+source.updated + 15000);
		assert.equal(f.c.tavern_poker_source_live(source), true);
		f.advance(59000);
		assert.equal(f.c.tavern_poker_source_live(source), true, "progress resets the local observation interval");
		f.advance(1000);
		assert.equal(
			f.c.tavern_poker_source_live(source),
			false,
			"an unchanged heartbeat expires even if dated in the future",
		);
	}
});
