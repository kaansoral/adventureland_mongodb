"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read, socketHandler } = require("./helpers/server_vm");

function fixture(active) {
	const replies = [];
	const c = vm.createContext({
		...G,
		G,
		Date,
		Math,
		Dev: false,
		Place: "server",
		gameplay: "normal",
		mode: {},
		B: { max_vision: 1000 },
		players: {},
		name_to_id: {},
		id_to_id: {},
		instances: { duel: { map: "duelland", name: "duel", info: { active }, players: {}, monsters: {} } },
		trade_slots: [],
		booster_items: ["xpbooster", "goldbooster", "luckbooster"],
		min: Math.min,
		max: Math.max,
		round: Math.round,
		floor: Math.floor,
		ceil: Math.ceil,
		to_number: Number,
		is_pvp: false,
		get_ip_server: (player) => player.name,
		future_ms: (ms) => new Date(Date.now() + ms),
		future_s: (s) => new Date(Date.now() + s * 1000),
		mssince: (d) => Date.now() - +d,
		fail_response: (reason) => replies.push({ failed: true, reason }),
		success_response: (...args) => replies.push({ success: true, args }),
		resend() {},
		add_pdps() {},
		xy_emit() {},
		add_call_cost() {},
		disappearing_text() {},
		server_log() {},
		player_to_client: (player) => ({ hp: player.hp, mp: player.mp }),
		localization: { message: (id) => id },
		randomStr: () => "listing",
		item_name: (item) => G.items[item.name].name,
		log_trace: (name, error) => {
			throw error;
		},
	});
	function make(name) {
		const player = {
			id: name,
			name,
			owner: name,
			party: "Party",
			type: "paladin",
			is_player: true,
			level: 100,
			hp: 1000,
			max_hp: 1000,
			mp: 2000,
			max_mp: 2000,
			map: "duelland",
			in: "duel",
			x: 0,
			y: 0,
			attack_ms: 1000,
			str: 100,
			p: { trades: true, acx: {} },
			s: {},
			c: {},
			q: {},
			a: {},
			last: {},
			slots: {},
			cslots: {},
			items: [{ name: "snakeoil" }],
			citems: [],
			esize: 0,
			socket: { id: "socket:" + name, emit: (event, data) => replies.push({ event, ...data }) },
		};
		c.players[player.socket.id] = player;
		c.id_to_id[name] = c.name_to_id[name] = player.socket.id;
		c.instances.duel.players[name] = player;
		return player;
	}
	const target = make("Target"),
		caster = make("Caster");
	const source = read("node/server_functions.js");
	for (const name of ["item_p_ignore", "item_trade_p_ignore"]) {
		vm.runInContext(source.match(new RegExp("var " + name + " = \\{[\\s\\S]*?\\};"))[0], c);
	}
	target.duel = { instance: "duel", id: "duel", active: false };
	target.s = { stunned: { ms: 120000 }, poisoned: { ms: 10000 } };
	load(c, "node/server_functions.js", [
		"cache_item",
		"get_player",
		"is_same",
		"is_invis",
		"is_in_pvp",
		"consume_mp",
		"consume_skill",
		"get_trade_slots",
		"trade_price",
	]);
	load(c, "node/server.js", ["consume", "consume_one", "can_equip_item", "create_new_sitem", "create_new_item"]);
	function run(event, player, data) {
		c.socket = player.socket;
		return socketHandler(c, event)(data);
	}
	return { c, target, caster, replies, run };
}

function snapshot(player) {
	return JSON.stringify(player, (key, value) => (key === "socket" ? undefined : value));
}

for (const active of [undefined, false, true]) {
	for (const consume of [false, true])
		test(`Stun blocks Snake Oil before use (duel=${active}, consume=${consume})`, () => {
			const { target, replies, run } = fixture(active);
			if (active === undefined) delete target.duel;
			target.c = { town: { ms: 5000 } };
			const before = snapshot(target);
			run("equip", target, { num: 0, consume });
			assert.deepEqual(replies, [{ failed: true, reason: "disabled" }]);
			assert.equal(snapshot(target), before, "no item, condition, activity, HP or cooldown change");
		});
	test(`Another player's Cleansing Light still removes stun (duel=${active})`, () => {
		const { target, caster, replies, run } = fixture(active);
		if (active === undefined) delete target.duel;
		run("skill", caster, { name: "cleansing_light", id: target.name });
		assert.equal(replies.at(-1).success, true);
		assert.equal(target.s.stunned, undefined);
		assert.equal(target.s.poisoned, undefined);
		assert.equal(caster.mp, 2000 - G.skills.cleansing_light.mp);
	});
}

for (const name of ["hpot0", "mpot0", "elixirluck", "licence", "figurine", "cxjar"]) {
	test(`Stun blocks ${name} through equip without consuming it`, () => {
		const { target, replies, run } = fixture(false);
		assert(G.items[name], name);
		target.items[0] = { name, q: 2, data: "test" };
		const before = snapshot(target);
		run("equip", target, { num: 0 });
		assert.deepEqual(replies, [{ failed: true, reason: "disabled" }]);
		assert.equal(snapshot(target), before);
	});
}

for (const [event, data, name] of [
	["use", { item: "hp" }],
	["use", { item: "mp" }],
	["throw", { num: 0, x: 0, y: 0 }, "confetti"],
	["activate", { num: 0 }, "frozenstone"],
	["activate", { slot: "amulet" }],
	["booster", { num: 0, action: "activate" }, "xpbooster"],
	["poke", { name: "Caster" }],
]) {
	for (const stunned of [true, false])
		test(`${event} ${JSON.stringify(data)} ${stunned ? "rejects during stun" : "still works afterward"}`, () => {
			const { target, replies, run } = fixture(false);
			if (name) target.items[0] = { name, q: 2 };
			target.slots.amulet = { name: "etherealamulet" };
			target.slots.gloves = { name: "poker", level: 0 };
			target.hp = 100;
			target.mp = 100;
			if (!stunned) target.s = {};
			const before = snapshot(target);
			run(event, target, data);
			if (stunned) {
				assert.deepEqual(replies, [{ failed: true, reason: "disabled" }]);
				assert.equal(snapshot(target), before);
			} else {
				assert.equal(
					replies.some((r) => r.failed),
					false,
				);
				assert.notEqual(snapshot(target), before);
			}
		});
}

test("Snake Oil still cleanses poison after stun expires", () => {
	const { target, replies, run } = fixture(false);
	delete target.s.stunned;
	run("equip", target, { num: 0, consume: true });
	assert.equal(replies.at(-1).success, true);
	assert.equal(target.s.poisoned, undefined);
	assert.equal(target.items[0], null);
	assert.equal(target.hp, 950);
	assert(target.last.potion > new Date());
});

test("Stun leaves equipment swaps and potion listings available", () => {
	const { c, target, replies, run } = fixture(false);
	target.items[0] = { name: "ringofluck", level: 0 };
	run("equip", target, { num: 0, slot: "ring1" });
	assert.equal(replies.at(-1).success, true);
	assert.equal(target.slots.ring1.name, "ringofluck");
	c.trade_slots = ["trade1"];
	target.stand = true;
	target.items[0] = { name: "snakeoil", q: 2 };
	run("equip", target, { num: 0, slot: "trade1", price: 100, q: 1 });
	assert.equal(replies.at(-1).success, true);
	assert.equal(target.slots.trade1.name, "snakeoil");
	assert.equal(target.slots.trade1.price, 100);
	assert(target.s.stunned);
});
