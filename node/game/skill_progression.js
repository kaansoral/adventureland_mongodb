"use strict";

const { SKILL_IDS, MAX_LEVEL, MAX_XP, cumulativeXp } = require("./skill_domain");
const { computeTotalLevel, validateSkillState } = require("./character_state");

function progressionError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function threshold(level, xpTable) {
	return (xpTable && xpTable[level]) || cumulativeXp(level);
}

function levelForXp(xp, xpTable) {
	let level = 1;
	for (let candidate = 2; candidate <= MAX_LEVEL; candidate += 1) {
		if (threshold(candidate, xpTable) > xp) break;
		level = candidate;
	}
	return level;
}

function validateAward(requestedXp) {
	if (!Number.isSafeInteger(requestedXp) || requestedXp < 0) {
		throw progressionError("invalid_skill_delta", "Skill XP must be a non-negative safe integer", {
			path: "requested_xp",
			reason: "non_negative_safe_integer_required",
		});
	}
}

function awardSkillXp(state, skillId, requestedXp, options = {}) {
	validateAward(requestedXp);
	const registry = options.registry || SKILL_IDS;
	if (!state || !state.skills || !Object.prototype.hasOwnProperty.call(state.skills, skillId)) {
		throw progressionError("invalid_skill_delta", `Unknown skill ${skillId}`, {
			path: "skill",
			reason: "unknown_skill",
		});
	}
	validateSkillState(state.skills, { registry, xpTable: options.xpTable });
	if (options.sourceId && options.seenSources && options.seenSources.has(options.sourceId)) {
		const current = state.skills[skillId];
		return {
			state,
			delta: {
				skill: skillId,
				accepted_xp: 0,
				discarded_xp: requestedXp,
				from_level: current.level,
				to_level: current.level,
				levels_gained: 0,
				xp: current.xp,
				max_xp: current.level >= MAX_LEVEL ? null : threshold(current.level + 1, options.xpTable),
				total_level: state.total_level || computeTotalLevel(state.skills, registry),
				duplicate: true,
			},
		};
	}
	const current = state.skills[skillId];
	const available = Math.max(0, MAX_XP - current.xp);
	const accepted_xp = Math.min(requestedXp, available);
	const discarded_xp = requestedXp - accepted_xp;
	const nextSkills = JSON.parse(JSON.stringify(state.skills));
	const cumulative = current.xp + accepted_xp;
	const to_level = levelForXp(cumulative, options.xpTable);
	nextSkills[skillId] = { level: to_level, xp: cumulative };
	const total_level = computeTotalLevel(nextSkills, registry);
	if (options.sourceId && options.seenSources) options.seenSources.add(options.sourceId);
	return {
		state: { skills: nextSkills, total_level },
		delta: {
			skill: skillId,
			accepted_xp,
			discarded_xp,
			from_level: current.level,
			to_level,
			levels_gained: Math.max(0, to_level - current.level),
			xp: cumulative,
			max_xp: to_level >= MAX_LEVEL ? null : threshold(to_level + 1, options.xpTable),
			total_level,
		},
	};
}

function awardSkillXpInPlace(character, skillId, requestedXp, options = {}) {
	const currentState = { skills: character.info.skills, total_level: character.total_level };
	const result = awardSkillXp(currentState, skillId, requestedXp, options);
	character.info.skills = result.state.skills;
	character.total_level = result.state.total_level;
	return result.delta;
}

module.exports = { awardSkillXp, awardSkillXpInPlace, levelForXp, progressionError };
