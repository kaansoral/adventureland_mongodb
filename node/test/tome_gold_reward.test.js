const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load } = require("./helpers/server_vm");

const tome = vm.runInNewContext("(" + read("design/items.js").match(/"xptome"\s*:\s*(\{[^}]+\})/)[1] + ")");

function setup({
	quantity = 1,
	party = false,
	sameOwner = false,
	gameplay = "normal",
	xp = 100000,
	type = "warrior",
	map = "arena",
	safe = false,
} = {}) {
	const messages = [];
	const player = (name) => ({
		_id: name,
		name,
		id: name,
		owner: "US_" + name,
		type: "warrior",
		map,
		in: map,
		gold: 10000,
		xp,
		max_xp: 1000000,
		level: 20,
		kills: 0,
		isize: 1,
		esize: 0,
		s: {},
		items: [null],
		citems: [],
		socket: { emit: (event, data) => messages.push({ name, event, data }) },
	});
	const attacker = player("Attacker"),
		target = player("Target"),
		ally = player("Ally");
	if (sameOwner) target.owner = attacker.owner;
	target.type = type;
	if (quantity) target.items[0] = { name: "xptome", q: quantity };
	if (party) {
		attacker.party = "party";
		ally.party = "party";
	}
	const context = vm.createContext({
		console,
		gameplay,
		Dev: true,
		G: { items: { xptome: tome }, maps: { [map]: { safe_pvp: safe } }, levels: {} },
		B: { hlevel_loss: 0 },
		mode: {},
		is_pvp: false,
		min: Math.min,
		max: Math.max,
		floor: Math.floor,
		round: Math.round,
		pwns: [],
		pend: 0,
		is_in_pvp: () => false,
		to_pretty_num: String,
		colors: { party_xp: "gray" },
		parties: { party: ["Attacker", "Ally", "Disconnected"] },
		players: { Attacker: attacker, Ally: ally },
		name_to_id: { Attacker: "Attacker", Ally: "Ally" },
		cache_item: (item) => item,
		drop_something_hardcore() {},
		add_shells() {
			assert.fail("tome rewards must never credit shells");
		},
	});
	load(context, "node/server.js", ["issue_player_award", "consume", "consume_one"]);
	load(context, "node/server_functions.js", ["is_same"]);
	return { context, attacker, target, ally, messages };
}

test("the tome bounty is 1.6m gold and no more than half its purchase price", () => {
	assert.equal(tome.gold_reward, 1600000);
	assert.ok(tome.gold_reward <= tome.g / 2);
	assert.equal(tome.reward, undefined);
	assert.match(tome.explanation, /1,600,000 gold/);
});

test("a PvP tome pays the victor once, consumes one copy, and preserves normal gold and XP losses", () => {
	for (const party of [false, true]) {
		const s = setup({ party, quantity: 2 });
		const baseline = setup({ party, quantity: 0 });
		baseline.context.issue_player_award(baseline.attacker, baseline.target);
		s.context.issue_player_award(s.attacker, s.target);
		assert.equal(s.attacker.gold - baseline.attacker.gold, 1600000);
		assert.equal(s.ally.gold, baseline.ally.gold);
		assert.equal(s.target.gold, baseline.target.gold);
		assert.equal(s.target.items[0].q, 1);
		assert.equal(s.target.xp, 100000 - Math.floor((100000 - baseline.target.xp) / 50));
		assert.equal(
			s.messages.filter((m) => typeof m.data === "string" && m.data.includes("gold from the tome")).length,
			1,
		);
	}
});

test("the last tome cannot pay a second bounty after being consumed", () => {
	const s = setup();
	s.context.issue_player_award(s.attacker, s.target);
	assert.equal(s.target.items[0], null);
	s.context.issue_player_award(s.attacker, s.target);
	assert.equal(s.messages.filter((m) => typeof m.data === "string" && m.data.includes("gold from the tome")).length, 1);
});

test("no tome bounty is created for same-account, merchant, zero-XP, safe-zone, duel, or non-normal deaths", () => {
	for (const config of [
		{ sameOwner: true },
		{ type: "merchant" },
		{ xp: 0 },
		{ safe: true },
		{ map: "duelland" },
		{ gameplay: "hardcore" },
		{ gameplay: "test" },
	]) {
		const s = setup(config);
		const baseline = setup({ ...config, quantity: 0 });
		s.context.issue_player_award(s.attacker, s.target);
		baseline.context.issue_player_award(baseline.attacker, baseline.target);
		assert.equal(s.attacker.gold, baseline.attacker.gold, JSON.stringify(config));
		assert.equal(
			s.messages.filter((m) => typeof m.data === "string" && m.data.includes("gold from the tome")).length,
			0,
		);
	}
});
