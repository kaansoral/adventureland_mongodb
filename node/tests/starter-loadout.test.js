"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { character } = require("../../design/character");
const { buildStarterLoadout } = require("../game/starter_loadout");

test("fresh starter loadout projects the canonical inventory and empty hand slots", () => {
	const loadout = buildStarterLoadout(character);
	assert.deepEqual(loadout, {
		items: [
			{ name: "blade", level: 0, gift: 1 },
			{ name: "mace", level: 0, gift: 1 },
			{ name: "staff", level: 0, gift: 1 },
			{ name: "wbook0", level: 0, gift: 1 },
			{ name: "bow", level: 0, gift: 1 },
			{ name: "claw", level: 0, gift: 1 },
			{ name: "hpot0", q: 200, gift: 1 },
			{ name: "mpot0", q: 200, gift: 1 },
			{ name: "helmet", level: 0, gift: 1 },
			{ name: "shoes", level: 0, gift: 1 },
		],
		slots: {},
	});
});

test("starter loadout is cloned and malformed definitions fail closed", () => {
	const loadout = buildStarterLoadout(character);
	loadout.items[6].q = 1;
	loadout.slots.mainhand = { name: "blade" };
	assert.equal(character.starter.consumables[0].q, 200);
	assert.deepEqual(character.starter.slots, {});
	assert.throws(() => buildStarterLoadout({ starter: { weapons: [""], consumables: [], equipment: [] } }), {
		code: "invalid_starter_loadout",
	});
});
