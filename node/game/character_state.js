"use strict";

const { SKILL_IDS, MAX_LEVEL, MAX_XP, cumulativeXp } = require("./skill_domain");

function stateError(path, reason, details = {}) {
	const error = new Error(`Invalid character skill state at ${path}: ${reason}`);
	error.code = "invalid_character_skill_state";
	error.path = path;
	error.reason = reason;
	Object.assign(error, details);
	return error;
}

function registryIds(registry) {
	if (Array.isArray(registry)) return registry.slice();
	if (registry && typeof registry === "object") return Object.keys(registry);
	return SKILL_IDS.slice();
}

function nextThreshold(level, xpTable) {
	if (level >= MAX_LEVEL) return null;
	return (xpTable && xpTable[level + 1]) || cumulativeXp(level + 1);
}

function createSkillState(registry = SKILL_IDS) {
	const skills = {};
	for (const id of registryIds(registry)) skills[id] = { level: 1, xp: 0 };
	return skills;
}

function computeTotalLevel(skills, registry = null) {
	const ids = registryIds(registry || skills);
	return ids.reduce((total, id) => total + skills[id].level, 0);
}

function validateSkillState(skills, options = {}) {
	const ids = registryIds(options.registry || SKILL_IDS);
	if (!skills || typeof skills !== "object" || Array.isArray(skills)) throw stateError("skills", "must be an object");
	const actualIds = Object.keys(skills);
	if (actualIds.length !== ids.length || actualIds.some((id, index) => id !== ids[index])) {
		throw stateError("skills", "must contain exactly the registered skills in registry order", {
			expected: ids,
			actual: actualIds,
		});
	}
	const xpTable = options.xpTable || null;
	for (const id of ids) {
		const record = skills[id];
		if (!record || typeof record !== "object" || Array.isArray(record))
			throw stateError(`skills.${id}`, "must be an object");
		const keys = Object.keys(record);
		if (keys.some((key) => !["level", "xp"].includes(key))) throw stateError(`skills.${id}`, "contains unknown fields");
		if (!Number.isInteger(record.level) || record.level < 1 || record.level > MAX_LEVEL) {
			throw stateError(`skills.${id}.level`, "must be an integer from 1 through 99");
		}
		if (!Number.isSafeInteger(record.xp) || record.xp < 0 || record.xp > MAX_XP) {
			throw stateError(`skills.${id}.xp`, "must be a safe integer from 0 through 900000000");
		}
		const minimum = (xpTable && xpTable[record.level]) || cumulativeXp(record.level);
		const next = nextThreshold(record.level, xpTable);
		if (record.xp < minimum || (next !== null && record.xp >= next)) {
			throw stateError(`skills.${id}.xp`, "does not belong to its declared level", { level: record.level });
		}
	}
	return skills;
}

function createCharacterState(registry = SKILL_IDS) {
	const skills = createSkillState(registry);
	return { skills, total_level: computeTotalLevel(skills, registry) };
}

function projectPersistenceState(state, registry = null) {
	validateSkillState(state.skills, { registry: registry || Object.keys(state.skills) });
	return {
		info: {
			skills: JSON.parse(JSON.stringify(state.skills)),
		},
		total_level: computeTotalLevel(state.skills, registry || Object.keys(state.skills)),
	};
}

function loadCharacterState(character, options = {}) {
	if (!character || !character.info) throw stateError("info.skills", "is missing");
	const registry = options.registry || SKILL_IDS;
	const skills = character.info.skills;
	validateSkillState(skills, { registry, xpTable: options.xpTable });
	const total_level = computeTotalLevel(skills, registry);
	if (character.total_level !== undefined && character.total_level !== total_level) {
		throw stateError("total_level", "does not equal the sum of registered skill levels", {
			actual: character.total_level,
			expected: total_level,
		});
	}
	return { skills: JSON.parse(JSON.stringify(skills)), total_level };
}

function withSkillState(state, skills, registry = null) {
	validateSkillState(skills, { registry: registry || Object.keys(state.skills) });
	return {
		...state,
		skills: JSON.parse(JSON.stringify(skills)),
		total_level: computeTotalLevel(skills, registry || Object.keys(skills)),
	};
}

module.exports = {
	createSkillState,
	createCharacterState,
	computeTotalLevel,
	validateSkillState,
	projectPersistenceState,
	loadCharacterState,
	withSkillState,
	stateError,
};
