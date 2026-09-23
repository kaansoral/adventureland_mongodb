const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, socketHandler } = require("./helpers/server_vm");

test("Saffron Loop gains gold at every compound level without changing its other stats", () => {
	const gold = [4, 5, 6, 7, 8, 9, 11, 13];
	const vit = [8, 10, 12, 14, 16, 19, 22, 26];
	for (let level = 0; level < gold.length; level++) {
		const actual = G.calculate_item_properties({ name: "saffronloop", level });
		assert.equal(actual.gold, gold[level], "gold at +" + level);
		assert.equal(actual.vit, vit[level], "VIT at +" + level);
		if (level) assert.ok(actual.gold > gold[level - 1]);
	}
	assert.deepEqual(Array.from(G.items.saffronloop.class), ["merchant"]);
	assert.deepEqual(Array.from(G.items.saffronloop.grades), [1, 5, 6, 7]);
	assert.equal(G.items.saffronloop.g, 180000);
});

function equipment(type = "warrior", offhand = { name: "shield", level: 0 }) {
	const player = {
		type,
		items: [{ name: "bow", level: 0 }],
		slots: { mainhand: null, offhand },
		citems: {},
		cslots: {},
		c: {},
		s: {},
	};
	const logs = [],
		failures = [],
		successes = [];
	const context = vm.createContext({
		G,
		players: { test: player },
		socket: { id: "test", emit: (event, data) => logs.push({ event, data }) },
		in_arr: G.in_arr,
		min: Math.min,
		to_number: Number,
		get_trade_slots: () => [],
		cache_item: (item) => item,
		resend() {},
		fail_response: (reason) => failures.push(reason),
		success_response: (type, data) => successes.push(data),
	});
	load(context, "node/server.js", ["can_equip_item"]);
	return { player, context, logs, failures, successes };
}

for (const event of ["equip", "equip_batch"]) {
	const request = (slot) => (event === "equip" ? { num: 0, slot } : [{ num: 0, slot }]);
	test(event + " explains a blocked two-handed weapon and leaves equipment unchanged", () => {
		for (const slot of [undefined, "mainhand"]) {
			const h = equipment();
			const before = JSON.stringify([h.player.items, h.player.slots]);
			socketHandler(h.context, event)(request(slot));
			assert.equal(JSON.stringify([h.player.items, h.player.slots]), before);
			assert.deepEqual(h.logs, [
				{ event: "game_log", data: "Unequip your offhand item to use this two-handed weapon." },
			]);
			if (event === "equip") assert.deepEqual(h.failures, ["cant_equip"]);
			else assert.deepEqual(Array.from(h.successes[0].slots), ["cant_equip"]);
		}
	});

	test(event + " still permits an empty offhand and a ranger's bow with a quiver", () => {
		for (const [type, offhand] of [
			["warrior", null],
			["ranger", { name: "quiver", level: 0 }],
		]) {
			const h = equipment(type, offhand);
			socketHandler(h.context, event)(request("mainhand"));
			assert.equal(h.player.slots.mainhand.name, "bow");
			assert.equal(h.player.slots.offhand, offhand);
			assert.equal(h.player.items[0], null);
			assert.deepEqual(h.logs, []);
			assert.deepEqual(h.failures, []);
		}
	});

	test(event + " does not give an offhand warning for an unsupported weapon", () => {
		const h = equipment("priest");
		socketHandler(h.context, event)(request("mainhand"));
		assert.deepEqual(h.logs, []);
		assert.equal(h.player.slots.mainhand, null);
	});
}
