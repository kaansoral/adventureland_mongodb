"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCharacterState } = require("../game/character_state");
const { awardSkillXp } = require("../game/skill_progression");
const { cumulativeXp, MAX_XP } = require("../game/skill_domain");

test("skill XP awards cross multiple thresholds once and recompute total level", () => {
	const state = createCharacterState();
	const result = awardSkillXp(state, "warrior", cumulativeXp(20) + 1, { sourceId: "kill-1", seenSources: new Set() });
	assert.equal(result.delta.from_level, 1);
	assert.equal(result.delta.to_level, 20);
	assert.equal(result.delta.levels_gained, 19);
	assert.equal(result.state.skills.warrior.xp, cumulativeXp(20) + 1);
	assert.equal(result.state.total_level, 26);
});

test("skill XP validates requests, deduplicates sources, and discards at level 99", () => {
	const seen = new Set();
	const state = createCharacterState();
	assert.throws(
		() => awardSkillXp(state, "warrior", -1),
		(error) => error.code === "invalid_skill_delta",
	);
	assert.throws(
		() => awardSkillXp(state, "missing", 1),
		(error) => error.code === "invalid_skill_delta",
	);
	const first = awardSkillXp(state, "warrior", 100, { sourceId: "same", seenSources: seen });
	const duplicate = awardSkillXp(first.state, "warrior", 100, { sourceId: "same", seenSources: seen });
	assert.equal(duplicate.delta.duplicate, true);
	const capped = structuredClone(state);
	capped.skills.warrior = { level: 99, xp: MAX_XP };
	const result = awardSkillXp(capped, "warrior", 1000);
	assert.equal(result.delta.accepted_xp, 0);
	assert.equal(result.delta.discarded_xp, 1000);
	assert.equal(result.state.skills.warrior.xp, MAX_XP);
});
