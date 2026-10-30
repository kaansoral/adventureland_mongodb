"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { read, load } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

function gather_fixture() {
	const packets = [];
	const player = {
		id: "Fisher",
		name: "Fisher",
		owner: "Fisher",
		map: "main",
		in: "main",
		type: "merchant",
		level: 40,
		hp: 100,
		max_hp: 1000,
		mp: 200,
		max_mp: 1000,
		slots: { mainhand: { name: "rod", level: 0 } },
		cslots: { mainhand: { name: "rod", level: 0 } },
		c: {},
		items: Array(42).fill(null),
		citems: Array(42).fill(null),
		isize: 42,
		esize: 42,
		s: {},
		q: {},
		p: {},
		cid: 0,
		u: false,
		socket: {
			emit(event, data) {
				packets.push([event, plain(data)]);
			},
		},
	};
	const c = vm.createContext({
		...G,
		G,
		D: { ...G, drops: { ...G.drops } },
		players: { Fisher: player },
		player,
		min: Math.min,
		max: Math.max,
		round: Math.round,
		Math: Object.create(Math),
		colors: { server_success: "green" },
		a_score: {},
		broadcast() {},
		to_pretty_num: String,
		is_array: Array.isArray,
		add_shells() {},
		consume_skill() {},
		calculate_item_properties: () => ({}),
		resend() {},
	});
	c.Math.random = () => 0;
	load(c, "js/old_common_functions.js", ["can_stack", "can_add_item"]);
	load(c, "node/server_functions.js", ["cache_item", "exchange", "item_to_phrase", "startswith_an", "add_item_property"]);
	load(c, "node/server.js", ["create_new_item", "add_item"]);
	const ignore = read("node/server_functions.js").match(/var item_p_ignore = \{[\s\S]*?\};/)[0];
	vm.runInContext(ignore, c);
	const source = read("node/server.js");
	const fishingStart = source.indexOf('\t\t\t\tif (name == "fishing") {');
	assert(fishingStart > 0);
	const miningEnd = source.indexOf('\n\t\t\t\tif (name == "revival")', fishingStart);
	const completion = source.slice(fishingStart, miningEnd);
	return {
		c,
		player,
		packets,
		complete(skill, drop) {
			packets.length = 0;
			player.c[skill] = { ms: 0, drop, request_id: skill + "-req" };
			c.ref = player.c[skill];
			c.name = skill;
			delete player.c[skill];
			vm.runInContext(completion, c);
		},
	};
}

test("fishing and mining success include reward, num, and item when an item is awarded", () => {
	for (const [skill, drop, chance] of [
		["fishing", "f1", 0.05],
		["mining", "m1", 0.1],
	]) {
		const h = gather_fixture();
		h.c.Math.random = () => chance;
		h.c.D.drops[drop] = [[1, "hpot0", 1]];
		h.complete(skill, drop);
		const success = h.packets.find(([event, data]) => event === "game_response" && data.cevent === skill + "_success");
		assert(success, skill + " success packet");
		assert.equal(success[1].request_id, skill + "-req");
		assert.equal(success[1].reward, "hpot0");
		assert.equal(typeof success[1].num, "number");
		assert.equal(h.player.items[success[1].num].name, "hpot0");
		assert.deepEqual(success[1].item, plain(h.c.cache_item(h.player.items[success[1].num])));
	}
});

test("fishing and mining success omit reward when the bag is full or the table rolls empty", () => {
	for (const [skill, chance] of [
		["fishing", 0.05],
		["mining", 0.1],
	]) {
		const full = gather_fixture();
		full.c.Math.random = () => chance;
		full.player.esize = 0;
		full.player.items = Array(42).fill({ name: "blade", level: 0 });
		full.complete(skill, "f1");
		const fullSuccess = full.packets.find(
			([event, data]) => event === "game_response" && data.cevent === skill + "_success",
		);
		assert(fullSuccess, skill + " full-bag success");
		assert.equal(fullSuccess[1].reward, undefined);
		assert.equal(fullSuccess[1].num, undefined);
		assert.equal(fullSuccess[1].item, undefined);

		const empty = gather_fixture();
		empty.c.Math.random = () => chance;
		empty.c.D.drops.empty_table = [[1, "empty"]];
		empty.complete(skill, "empty_table");
		const emptySuccess = empty.packets.find(
			([event, data]) => event === "game_response" && data.cevent === skill + "_success",
		);
		assert(emptySuccess, skill + " empty-roll success");
		assert.equal(emptySuccess[1].reward, undefined);
		assert.equal(emptySuccess[1].num, undefined);
		assert.equal(emptySuccess[1].item, undefined);
	}
});

test("fishing and mining misses stay without reward", () => {
	for (const [skill, miss] of [
		["fishing", 0.5],
		["mining", 0.5],
	]) {
		const h = gather_fixture();
		h.c.Math.random = () => miss;
		h.complete(skill, "f1");
		assert.deepEqual(h.packets, [
			["ui", { name: "Fisher", type: skill + "_none", cevent: true, request_id: skill + "-req" }],
		]);
	}
});
