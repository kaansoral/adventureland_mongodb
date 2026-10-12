"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { read, load, socketHandler } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
	const failures = [],
		successes = [],
		effects = [];
	G.maps.main.upgrade ||= { map: "main", in: "main", x: -204, y: -129 };
	const make = (name) => ({
		id: name,
		name,
		owner: name,
		map: "main",
		in: "main",
		x: 0,
		y: 0,
		str: 10,
		items: Array(42).fill(null),
		citems: [],
		isize: 42,
		esize: 42,
		s: {},
		q: {},
		p: { stats: { exchanges: {} } },
		computer: true,
		socket: { id: name, emit() {} },
		gold: 1000,
	});
	const player = make("Sender"),
		receiver = make("Receiver");
	const c = vm.createContext({
		...G,
		G,
		D: G,
		players: { Sender: player, Receiver: receiver },
		name_to_id: { Sender: "Sender", Receiver: "Receiver" },
		socket: player.socket,
		min: Math.min,
		max: Math.max,
		round: Math.round,
		gameplay: "normal",
		Dev: false,
		B: { dist: 500, sell_dist: 500 },
		a_score: {},
		instances: { main: { monsters: {} } },
		future_s: (s) => new Date(Date.now() + s * 1000),
		fail_response: (reason, data) => failures.push({ reason, data }),
		success_response: (...args) => successes.push(args),
		xy_emit: (...args) => effects.push(args),
		add_to_history() {},
		resend() {},
		server_log(message) {
			if (String(message).startsWith("upgrade_e")) throw Error(message);
		},
		randomStr: () => "test-instance",
		can_walk: () => true,
	});
	const source = read("node/server_functions.js");
	vm.runInContext(source.match(/var item_p_ignore = \{[\s\S]*?\};/)[0], c);
	load(c, "node/server_functions.js", ["cache_item", "is_same"]);
	load(c, "js/old_common_functions.js", ["can_stack", "can_add_item", "can_add_items", "distance", "simple_distance"]);
	load(c, "node/server.js", [
		"create_new_item",
		"create_new_sitem",
		"consume",
		"consume_one",
		"consume_one_by_id",
		"add_item",
	]);
	function put(who, item, size = 42) {
		who.items = Array.from({ length: size }, () => ({ name: "blade", level: 0 }));
		who.items[0] = plain(item);
		who.esize = 42 - size;
	}
	function run(event, data) {
		return socketHandler(c, event)(plain(data));
	}
	return { c, player, receiver, put, run, failures, successes, effects };
}

test("throw rejects distant or non-finite coordinates without consuming items or sending effects", () => {
	for (const target of [
		{ x: 31, y: 0 },
		{ x: "Infinity", y: 0 },
		{ x: "NaN", y: 0 },
	]) {
		const h = fixture();
		h.player.items[0] = { name: "confetti", q: 2 };
		h.run("throw", { num: 0, ...target });
		assert.equal(h.failures.length, 1);
		assert.equal(h.successes.length, 0);
		assert.equal(h.effects.length, 0);
		assert.equal(h.player.items[0].q, 2);
	}
	const h = fixture();
	h.player.items[0] = { name: "confetti", q: 2 };
	h.run("throw", { num: 0, x: "30", y: 0 });
	assert.equal(h.failures.length, 0);
	assert.equal(h.successes.length, 1);
	assert.equal(h.effects.length, 1);
	assert.equal(h.player.items[0].q, 1);
});

test("split reserves a real empty inventory slot before consuming a stack", () => {
	for (const size of [42, 43]) {
		const h = fixture();
		h.put(h.player, { name: "hpot0", q: 10 }, size);
		const before = plain(h.player.items);
		h.run("split", { num: 0, quantity: 3 });
		assert.deepEqual(
			h.failures.map((r) => r.reason),
			["cant_space"],
		);
		assert.deepEqual(plain(h.player.items), before);
		assert.equal(h.successes.length, 0);
	}
	const h = fixture();
	h.player.items[0] = { name: "hpot0", q: 10, p: "glitched", ps: ["glitched"] };
	h.run("split", { num: 0, quantity: 3 });
	assert.equal(h.player.items[0].q, 7);
	assert.equal(h.player.items[1].q, 3);
	assert.equal(h.player.items[1].p, "glitched");
	assert.equal(h.successes[0][0].to, 1);
});

test("an exchange may use its own emptied slot but cannot overflow an inventory", () => {
	const name = "seashell",
		required = G.items[name].e;
	assert(required > 1 && G.drops[name]);
	for (const quantity of [required, required + 1]) {
		const h = fixture();
		h.put(h.player, { name, q: quantity });
		h.run("exchange", { item_num: 0 });
		if (quantity === required) {
			assert.equal(h.failures.length, 0);
			assert.equal(h.player.items[0].name, "placeholder");
			assert.equal(h.player.q.exchange.q, required);
			assert.equal(h.player.items.length, 42);
		} else {
			assert.deepEqual(
				h.failures.map((r) => r.reason),
				["inventory_full"],
			);
			assert.equal(h.player.items[0].q, quantity);
		}
	}
});

test("malformed inventory slots never fall back to slot zero", () => {
	for (const slot of [-1, 0.5, "0junk", "", null, false, [], {}, "Infinity"])
		for (const event of ["destroy", "send", "imove"]) {
			const h = fixture();
			h.player.items[0] = { name: "hpot0", q: 2 };
			const before = plain(h.player.items);
			h.run(event, { num: slot, a: slot, b: 1, name: "Receiver", q: 1 });
			assert.deepEqual(plain(h.player.items), before, event + " " + JSON.stringify(slot));
			assert.equal(h.failures.length, 1);
		}
	for (const slot of [0, "0"]) {
		const h = fixture();
		h.player.items[0] = { name: "hpot0", q: 2 };
		h.run("destroy", { num: slot, q: 1 });
		assert.equal(h.player.items[0].q, 1);
		assert.equal(h.failures.length, 0);
	}
});

test("sending checks capacity with the exact item properties", () => {
	for (const same of [false, true]) {
		const h = fixture();
		const item = { name: "cxjar", q: 2, data: "hat001" };
		h.player.items[0] = plain(item);
		h.put(h.receiver, { name: "cxjar", q: 1, data: same ? "hat001" : "hat002" });
		h.run("send", { num: 0, q: 1, name: "Receiver" });
		assert.equal(h.player.items[0].q, same ? 1 : 2);
		assert.equal(h.receiver.items[0].q, same ? 2 : 1);
		assert.equal(h.receiver.items.length, 42);
		assert.equal(h.failures.length, same ? 0 : 1);
	}
});

test("batch capacity allocates each reward once and accounts for newly created stacks", () => {
	const h = fixture();
	h.put(h.player, { name: "hpot0", q: 1 });
	h.player.items[1] = { name: "hpot0", q: 1 };
	assert.equal(
		h.c.can_add_items(h.player, [
			{ name: "hpot0", q: 1 },
			{ name: "blade", level: 0 },
		]),
		false,
	);
	h.player.items[0] = null;
	h.player.items[1] = { name: "blade", level: 0 };
	h.player.esize = 1;
	const rewards = [
		{ name: "hpot0", q: 2 },
		{ name: "hpot0", q: 3 },
	];
	assert.equal(h.c.can_add_items(h.player, rewards), true);
	for (const item of rewards) h.c.add_item(h.player, item, { announce: false });
	assert.equal(h.player.items[0].q, 5);
	assert.equal(h.player.items.length, 42);
});

test("a chest stays available when matching potion stacks leave no room for its equipment", () => {
	const h = fixture();
	h.put(h.player, { name: "hpot0", q: 1 });
	h.player.items[1] = { name: "hpot0", q: 1 };
	const chest = {
		items: [
			{ name: "hpot0", q: 1 },
			{ name: "blade", level: 0 },
		],
		x: 0,
		y: 0,
		date: new Date(),
		gold: 0,
	};
	Object.assign(h.c, { chests: { reward: chest }, msince: () => 0, is_invis: () => false });
	const before = plain(h.player.items);
	h.run("open_chest", { id: "reward" });
	assert.deepEqual(
		h.failures.map((r) => r.reason),
		["loot_no_space"],
	);
	assert.equal(h.c.chests.reward, chest);
	assert.deepEqual(plain(h.player.items), before);
});

test("entry errors identify each required key without consuming anything", () => {
	for (const [place, map, spawn, key] of [
		["crypt", "cave", 2, "cryptkey"],
		["winter_instance", "winterland", 5, "frozenkey"],
		["spider_instance", "gateway", 3, "spiderkey"],
		["tomb", "mansion", 1, "tombkey"],
	]) {
		const h = fixture();
		Object.assign(h.player, { map, in: map, x: G.maps[map].spawns[spawn][0], y: G.maps[map].spawns[spawn][1] });
		h.run("enter", { place });
		assert.deepEqual(plain(h.failures), [{ reason: "transport_cant_item", data: { items: { [key]: 1 } } }]);
		assert(h.player.items.every((item) => !item));
	}
});

test("Primling preview identifies grace without consuming; applying it retains level", () => {
	const h = fixture();
	h.player.items[0] = { name: "coat", level: 0, grace: 2 };
	h.player.items[1] = { name: "offeringp", q: 2 };
	h.run("upgrade", { item_num: 0, offering_num: 1, scroll_num: null, clevel: 0, calculate: true });
	assert.equal(h.successes[0][0], "upgrade_chance");
	assert.equal(h.successes[0][1].grace_added, 0.5);
	assert.equal(h.player.items[0].grace, 2);
	assert.equal(h.player.items[1].q, 2);
	h.run("upgrade", { item_num: 0, offering_num: 1, scroll_num: null, clevel: 0 });
	assert.equal(h.player.p.u_item.grace, 2.5);
	assert.equal(h.player.p.u_item.level, 0);
	assert.equal(h.player.items[1].q, 1);
	assert.equal(h.player.items[0].p.grace_added, 0.5);
});
