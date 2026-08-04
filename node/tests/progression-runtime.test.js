"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCharacterState } = require("../game/character_state");
const {
	initializePlayerProgression,
	awardPlayerSkillXp,
	awardPlayerSkillXpSplit,
	flushPlayerProgressionEvents,
	markStandSession,
	settlePlayerStand,
	refreshDeathSickness,
	rehydratePlayerDeathSickness,
} = require("../game/progression_runtime");

function player() {
	const state = createCharacterState();
	return {
		id: "character",
		total_level: state.total_level,
		p: {},
		t: {},
		info: { skills: state.skills },
		socket: {
			events: [],
			emit(name, value) {
				this.events.push([name, value]);
			},
		},
	};
}

test("runtime requires persisted info.skills and repairs only the flattened alias", () => {
	const state = createCharacterState();
	const character = player();
	character.skills = createCharacterState().skills;
	character.skills.warrior = { level: 2, xp: 100000 };
	initializePlayerProgression(character, 0);
	assert.equal(character.skills, character.info.skills);
	assert.equal(character.skills.warrior.level, 1);

	const legacyOnly = { id: "legacy", total_level: state.total_level, skills: state.skills, info: {}, p: {}, t: {} };
	assert.throws(() => initializePlayerProgression(legacyOnly, 0), { code: "invalid_character_skill_state" });
});

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
	assert.equal(character.socket.events.length, 0);
	assert.equal(character.progression_events.length, 1);
	assert.deepEqual(Object.keys(character.progression_events[0].skills), [
		"warrior",
		"paladin",
		"mage",
		"priest",
		"ranger",
		"rogue",
		"merchant",
	]);
	assert.equal(flushPlayerProgressionEvents(character), 1);
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
	assert.equal(flushPlayerProgressionEvents(character), 1);
});

test("runtime stand settlement advances the persisted clock between ticks", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 0);
	markStandSession(character, 0);
	const first = settlePlayerStand(character, 3600000);
	const second = settlePlayerStand(character, 7200000);
	assert.equal(first.xp, Math.floor(3125000 / 7));
	assert.equal(second.xp, Math.floor((3125000 * 2) / 7) - first.xp);
	assert.equal(character.skills.merchant.xp, Math.floor((3125000 * 2) / 7));
	assert.equal(character.p.stand_last_settled_at, 7200000);
	assert.equal(flushPlayerProgressionEvents(character), 2);
});

test("runtime reopens a persisted stand at the current server time", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 4000000);
	character.info.merchant_accrual.eligible_stand_ms = 123456;
	initializePlayerProgression(character, 5000000);
	assert.equal(character.p.stand_last_settled_at, 5000000);
	const settled = settlePlayerStand(character, 5000000 + 3600000);
	assert.equal(settled.xp, Math.floor(3125000 / 7));
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
	assert.equal(character.p.stand_last_settled_at, 100);
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
