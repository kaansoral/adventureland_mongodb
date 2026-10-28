const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load } = require("./helpers/server_vm");

const bosses = ["crabxx", "snowman", "grinch", "dragold", "franky"];

function roll(type, { home = true, fatigue = false, repeats = 1, random = 0, share = 1 } = {}) {
	const c = vm.createContext({
		G,
		D: { drops: G.drops },
		B: { global_drops: false, drop_table_multiplier: repeats },
		mode: {},
		region: "EU",
		server_name: "I",
		Math: Object.assign(Object.create(Math), { random: () => random }),
		is_in_pvp: () => false,
		can_stack: G.can_stack,
		is_array: Array.isArray,
		floor: Math.floor,
		max: Math.max,
		min: Math.min,
		randomStr: () => "drop-test",
	});
	load(c, "node/server.js", ["roll_monster_drops", "drop_item_logic", "create_new_item"]);
	load(c, "node/server_functions.js", ["has_home_server_bonus"]);
	const drop = { items: [], cash: 0 };
	c.roll_monster_drops(
		{ owner: "US_test", luckm: 1, p: { home: home ? "EUI" : "USI" }, s: fatigue ? { realmfatigue: {} } : {} },
		{ ...G.monsters[type], type, map: "drop_test", max_hp: G.monsters[type].hp, level: 1, mult: 1, luckx: 1 },
		drop,
		share,
	);
	return drop.items.reduce((counts, item) => {
		counts[item.name] = (counts[item.name] || 0) + (item.q || 1);
		return counts;
	}, {});
}

test("cooperative boss tables contain valid rewards and finite quantities", () => {
	for (const type of bosses) {
		for (const table of [G.drops.monsters[type], G.drops.monsters_home_server[type]]) {
			for (const row of table) {
				assert.ok(Array.isArray(row), type + " has a malformed drop row");
				assert.ok(Number.isFinite(row[0]) && row[0] > 0, type);
				assert.ok(G.items[row[1]], type + ": " + row[1]);
				if (row[2] !== undefined) assert.ok(Number.isSafeInteger(row[2]) && row[2] > 0 && row[2] <= 10, type);
			}
		}
	}
});

test("home rewards roll once, separately from repeated ordinary boss drops", () => {
	for (const repeats of [1, 4, 20]) {
		const crab = roll("crabxx", { repeats });
		assert.equal(crab.reefglass, 3);
		assert.equal(crab.funtoken, repeats * 3 + 3);
		const dragon = roll("dragold", { repeats });
		assert.equal(dragon.lmace, repeats + 2);
		assert.equal(dragon.embercore, repeats + 2);
		const franky = roll("franky", { repeats });
		assert.equal(franky.mpxgloves, 1);
		assert.equal(franky.ukey, 1);
	}
});

test("away and realm-fatigued characters cannot receive home-only rewards", () => {
	for (const state of [{ home: false }, { fatigue: true }]) {
		assert.equal(roll("crabxx", state).reefglass, undefined);
		assert.equal(roll("franky", state).mpxgloves, undefined);
		assert.equal(roll("franky", state).ukey, undefined);
		assert.equal(roll("dragold", state).lmace, 1);
	}
});

test("Lunar Mace and holiday ring rolls use the actual shared contribution odds", () => {
	assert.equal(roll("dragold", { random: 0.1, share: 0.1 }).lmace, undefined);
	assert.equal(roll("dragold", { random: 0.06, share: 0.1 }).lmace, 1);
	assert.equal(roll("dragold", { random: 0.04, share: 0.1 }).lmace, 2);
	assert.equal(roll("dragold", { random: 0.01, share: 0.1 }).lmace, 3);
	assert.equal(roll("grinch", { random: 0.0005, share: 0.1 }).ringhs, undefined);
	assert.equal(roll("grinch", { random: 0.0003, share: 0.1 }).ringhs, 2);
});
