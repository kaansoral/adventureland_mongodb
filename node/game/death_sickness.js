"use strict";

const { progression } = require("../../design/progression");

const AFFECTED_STATS = Object.freeze(["attack", "heal", "max_hp", "max_mp", "armor", "resistance", "frequency"]);

function sicknessStateError(message) {
	const error = new Error(message);
	error.code = "invalid_death_sickness";
	return error;
}

function ensureInfo(character) {
	if (!character || !character.info) throw sicknessStateError("Character info is required");
	return character.info;
}

function applyDeathSickness(character, now = Date.now()) {
	const info = ensureInfo(character);
	info.death_sickness_until = now + progression.DEATH_SICKNESS_MS;
	return info.death_sickness_until;
}

function rehydrateDeathSickness(character, now = Date.now()) {
	const info = ensureInfo(character);
	if (info.death_sickness_until === undefined || info.death_sickness_until === null) return null;
	if (!Number.isSafeInteger(info.death_sickness_until))
		throw sicknessStateError("death_sickness_until must be an epoch millisecond integer");
	if (info.death_sickness_until <= now) {
		info.death_sickness_until = null;
		return null;
	}
	return info.death_sickness_until;
}

function sicknessActive(character, now = Date.now()) {
	return Boolean(character && character.info && Number(character.info.death_sickness_until || 0) > now);
}

function applySicknessMultiplier(stats, active = false) {
	const result = { ...stats };
	if (!active) return result;
	for (const field of AFFECTED_STATS)
		if (typeof result[field] === "number") result[field] *= progression.DEATH_SICKNESS_MULTIPLIER;
	return result;
}

function sicknessDelta(character, now = Date.now()) {
	const until = character && character.info ? character.info.death_sickness_until : null;
	return { death_sickness_until: until && until > now ? until : null, ms: until && until > now ? until - now : 0 };
}

module.exports = {
	AFFECTED_STATS,
	applyDeathSickness,
	rehydrateDeathSickness,
	sicknessActive,
	applySicknessMultiplier,
	sicknessDelta,
	sicknessStateError,
};
