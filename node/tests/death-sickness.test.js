"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
	applyDeathSickness,
	rehydrateDeathSickness,
	sicknessActive,
	applySicknessMultiplier,
	sicknessDelta,
} = require("../game/death_sickness");

test("death sickness refreshes without stacking and rehydrates/clears by timestamp", () => {
	const character = { info: {} };
	assert.equal(applyDeathSickness(character, 1000), 301000);
	assert.equal(applyDeathSickness(character, 2000), 302000);
	assert.equal(sicknessActive(character, 2001), true);
	assert.equal(rehydrateDeathSickness(character, 302000), null);
	assert.equal(character.info.death_sickness_until, null);
	assert.deepEqual(sicknessDelta(character, 302000), { death_sickness_until: null, ms: 0 });
});

test("sickness affects only the approved final stat set", () => {
	const stats = {
		attack: 100,
		heal: 80,
		max_hp: 1000,
		max_mp: 500,
		armor: 100,
		resistance: 100,
		frequency: 1,
		speed: 70,
		range: 120,
		xpm: 2,
		luckm: 3,
		goldm: 4,
	};
	const sick = applySicknessMultiplier(stats, true);
	for (const key of ["attack", "heal", "max_hp", "max_mp", "armor", "resistance", "frequency"])
		assert.equal(sick[key], stats[key] * 0.8);
	for (const key of ["speed", "range", "xpm", "luckm", "goldm"]) assert.equal(sick[key], stats[key]);
});
