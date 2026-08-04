"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCharacterState } = require("../game/character_state");
const {
	initializePlayerProgression,
	awardPlayerSkillXp,
	awardPlayerSkillXpSplit,
	markStandSession,
	settlePlayerStand,
	refreshDeathSickness,
	rehydratePlayerDeathSickness,
} = require("../game/progression_runtime");

function player() {
	const state = createCharacterState();
	return {
		id: "character",
		...state,
		p: {},
		t: {},
		info: {},
		socket: {
			events: [],
			emit(name, value) {
				this.events.push([name, value]);
			},
		},
	};
}

test("runtime awards persist complete skill deltas and reject replay", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	const first = awardPlayerSkillXp(character, "warrior", 100, {
		source: "pve_damage",
		sourceId: "encounter:1:warrior",
	});
	assert.equal(first.accepted_xp, 100);
	assert.equal(character.skills.warrior.xp, 100);
	assert.equal(character.t.skill_xp.warrior, 100);
	assert.equal(character.socket.events[0][0], "skill_xp");
	const duplicate = awardPlayerSkillXp(character, "warrior", 100, {
		source: "pve_damage",
		sourceId: "encounter:1:warrior",
	});
	assert.equal(duplicate.duplicate, true);
	assert.equal(character.skills.warrior.xp, 100);
});

test("runtime stand settlement feeds Merchant through the common award path", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 0);
	markStandSession(character, 0);
	const settled = settlePlayerStand(character, 3600000);
	assert.equal(settled.xp, Math.floor(3125000 / 7));
	assert.equal(character.skills.merchant.xp, settled.xp);
	assert.equal(character.skills.merchant.level, 3);
	assert.equal(character.total_level, 9);
});

test("runtime split awards commit all styles and reject backward stand time", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	const deltas = awardPlayerSkillXpSplit(
		character,
		{ warrior: 100, rogue: 200 },
		{ source: "pve_damage", sourceId: "encounter:split" },
	);
	assert.deepEqual(
		deltas.map((delta) => delta.skill),
		["warrior", "rogue"],
	);
	assert.equal(character.skills.warrior.xp, 100);
	assert.equal(character.skills.rogue.xp, 200);
	assert.equal(character.p.skill_xp_sources.length, 2);
	const duplicate = awardPlayerSkillXpSplit(
		character,
		{ warrior: 100, rogue: 200 },
		{ source: "pve_damage", sourceId: "encounter:split" },
	);
	assert.ok(duplicate.every((delta) => delta.duplicate));
	character.p.stand = "stand0";
	markStandSession(character, 100);
	const backward = settlePlayerStand(character, 50);
	assert.equal(backward.xp, 0);
	assert.equal(character.info.merchant_accrual.stand_last_settled_at, 100);
});

test("runtime death sickness persists and clears by absolute timestamp", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	assert.equal(refreshDeathSickness(character, 1000), 301000);
	assert.deepEqual(character.s.death_sickness, { ms: 300000 });
	assert.equal(rehydratePlayerDeathSickness(character, 300999), 301000);
	assert.deepEqual(character.s.death_sickness, { ms: 1 });
	assert.equal(rehydratePlayerDeathSickness(character, 301000), null);
	assert.equal(character.info.death_sickness_until, null);
	assert.equal(character.s.death_sickness, undefined);
});
