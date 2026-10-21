"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const design = require("./helpers/design");
const { load } = require("./helpers/server_vm");

function setup(unlocked, G) {
	const character = { unlocked: unlocked || {} };
	const game = G || {
		items: {
			bkey: { unlocks: "bank_b" },
			ukey: { unlocks: "bank_u" },
			sword: { type: "weapon" },
		},
		maps: {
			bank: { mount: true, doors: [[0, 0, 1, 1, "bank_b", 0, 1, "ulocked"]] },
			bank_b: { mount: true, doors: [] },
			bank_u: {
				mount: true,
				// Real data has an ulocked+complicated exit to level2; that must not gate level2.
				doors: [[0, 0, 1, 1, "level2", 0, 0, "ulocked", "complicated"]],
			},
			main: { doors: [[0, 0, 1, 1, "bank", 0, 0]] },
			level2: {
				doors: [[0, 0, 1, 1, "bank_u", 0, 0, "ulocked", "complicated"]],
			},
			future_locked: { mount: true, doors: [] },
			somewhere: {
				doors: [[0, 0, 1, 1, "future_locked", 0, 0, "ulocked"]],
			},
		},
	};
	const c = vm.createContext({ character, G: game });
	load(c, "js/runner_functions.js", ["map_requires_unlock", "is_unlocked"]);
	return c;
}

test("map_requires_unlock follows item.unlocks and ulocked mount doors", () => {
	const c = setup();
	assert.equal(c.map_requires_unlock("bank_b"), true);
	assert.equal(c.map_requires_unlock("bank_u"), true);
	assert.equal(c.map_requires_unlock("future_locked"), true);
	assert.equal(c.map_requires_unlock("level2"), false, "ulocked exit to a non-mount map is not an unlock gate");
	assert.equal(c.map_requires_unlock("main"), false);
	assert.equal(c.map_requires_unlock(""), false);
});

test("is_unlocked treats ungated maps as open and gated maps via character.unlocked", () => {
	const locked = setup({});
	assert.equal(locked.is_unlocked("main"), true);
	assert.equal(locked.is_unlocked("bank_b"), false);
	assert.equal(locked.is_unlocked("bank_u"), false);

	const open = setup({ bank_b: new Date(), bank_u: true });
	assert.equal(open.is_unlocked("bank_b"), true);
	assert.equal(open.is_unlocked("bank_u"), true);
	assert.equal(open.is_unlocked("future_locked"), false);
});

test("live design: only bank_b and bank_u are account-unlock maps today", () => {
	assert.equal(design.items.bkey.unlocks, "bank_b");
	assert.equal(design.items.ukey.unlocks, "bank_u");
	const unlockMaps = new Set();
	for (const id in design.items) {
		if (design.items[id] && design.items[id].unlocks) unlockMaps.add(design.items[id].unlocks);
	}
	assert.deepEqual([...unlockMaps].sort(), ["bank_b", "bank_u"]);

	const c = setup({}, { items: design.items, maps: design.maps });
	assert.equal(c.map_requires_unlock("bank_b"), true);
	assert.equal(c.map_requires_unlock("bank_u"), true);
	assert.equal(c.map_requires_unlock("bank"), false);
	assert.equal(c.map_requires_unlock("level2"), false, "bank_u exit door must not gate level2");
	assert.equal(c.map_requires_unlock("main"), false);
});
