"use strict";

const { SKILL_IDS, COMBAT_SKILL_IDS, cumulativeXp } = require("./skill_domain");
const { loadCharacterState, computeTotalLevel, validateSkillState } = require("./character_state");
const { awardSkillXp } = require("./skill_progression");
const {
	createMerchantAccrual,
	settleStand,
	addCredit,
	qualifyLuck,
	recordSale,
	recordSaleReversal,
	recordDonationOrDice,
	prune: pruneMerchantAccrual,
	validateMerchantAccrual,
} = require("./merchant_progression");
const { applyDeathSickness, rehydrateDeathSickness, sicknessActive, sicknessDelta } = require("./death_sickness");

const SOURCE_IDS = new Set([
	"pve_damage",
	"pve_heal",
	"pve_support",
	"merchant_stand",
	"merchant_luck",
	"merchant_sale",
	"merchant_donation",
	"merchant_dice",
]);
const MAX_PROCESSED_SOURCES = 1000;

function runtimeError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function ensurePlayerContainers(player) {
	if (!player || typeof player !== "object") throw runtimeError("invalid_character_skill_state", "Player is required");
	if (!player.p || typeof player.p !== "object") player.p = {};
	if (!Array.isArray(player.p.skill_xp_sources)) player.p.skill_xp_sources = [];
	if (!player.t || typeof player.t !== "object") player.t = {};
	if (!player.t.skill_xp || typeof player.t.skill_xp !== "object") player.t.skill_xp = {};
	for (const skill of SKILL_IDS) player.t.skill_xp[skill] = Number(player.t.skill_xp[skill]) || 0;
	if (!player.merchant_accrual || typeof player.merchant_accrual !== "object")
		player.merchant_accrual = createMerchantAccrual();
	return player;
}

function initializePlayerProgression(player, now = Date.now()) {
	ensurePlayerContainers(player);
	const state = loadCharacterState({ info: { skills: player.skills }, total_level: player.total_level });
	player.skills = state.skills;
	player.total_level = state.total_level;
	validateMerchantAccrual(player.merchant_accrual, now);
	player.merchant_accrual = pruneMerchantAccrual(player.merchant_accrual, now);
	rehydrateDeathSickness({ info: player }, now);
	return player;
}

function sourceKind(source) {
	if (!source) return null;
	if (SOURCE_IDS.has(source)) return source;
	return null;
}

function emitSkillDelta(player, delta) {
	if (player.socket && typeof player.socket.emit === "function") {
		player.socket.emit("skill_xp", {
			...delta,
			skills: JSON.parse(JSON.stringify(player.skills)),
		});
		if (delta.to_level > delta.from_level) {
			player.socket.emit("skill_level_up", {
				skill: delta.skill,
				from_level: delta.from_level,
				to_level: delta.to_level,
				levels_gained: delta.levels_gained,
				total_level: delta.total_level,
			});
		}
	}
}

function awardPlayerSkillXp(player, skillId, requestedXp, { source, sourceId, emit = true } = {}) {
	ensurePlayerContainers(player);
	const kind = sourceKind(source);
	if (!kind) {
		throw runtimeError("invalid_skill_delta", "Skill XP source is not allowlisted", {
			path: "source",
			reason: "unclassified_source",
		});
	}
	const known = new Set(player.p.skill_xp_sources);
	const result = awardSkillXp(
		{ skills: player.skills, total_level: player.total_level },
		skillId,
		requestedXp,
		{ sourceId, seenSources: known },
	);
	player.skills = result.state.skills;
	player.total_level = result.state.total_level;
	if (sourceId && !player.p.skill_xp_sources.includes(sourceId)) {
		player.p.skill_xp_sources = [...known].slice(-MAX_PROCESSED_SOURCES);
	}
	if (!result.delta.duplicate) player.t.skill_xp[skillId] += result.delta.accepted_xp;
	player.t.total_skill_xp = SKILL_IDS.reduce((sum, skill) => sum + player.t.skill_xp[skill], 0);
	if (emit && !result.delta.duplicate) emitSkillDelta(player, result.delta);
	return result.delta;
}

function maxCombatLevel(player) {
	return Math.max(...COMBAT_SKILL_IDS.map((skill) => (player.skills && player.skills[skill] && player.skills[skill].level) || 1));
}

function skillLevel(player, skillId) {
	return (player.skills && player.skills[skillId] && player.skills[skillId].level) || 1;
}

function markStandSession(player, now = Date.now()) {
	ensurePlayerContainers(player);
	player.merchant_accrual.stand_last_settled_at = now;
	return player.merchant_accrual;
}

function settlePlayerStand(player, now = Date.now(), { emit = true } = {}) {
	ensurePlayerContainers(player);
	const accrual = player.merchant_accrual;
	if (!player.p || !player.p.stand || player.rip || !player.socket) {
		accrual.stand_last_settled_at = now;
		return { xp: 0, units: 0, state: accrual, skipped: true };
	}
	const previous = accrual.stand_last_settled_at;
	accrual.stand_last_settled_at = now;
	if (!Number.isSafeInteger(previous) || now <= previous) return { xp: 0, units: 0, state: accrual, skipped: true };
	const settled = settleStand(accrual, now - previous, now);
	player.merchant_accrual = settled.state;
	if (settled.xp) {
		const delta = awardPlayerSkillXp(player, "merchant", settled.xp, {
			source: "merchant_stand",
			sourceId: `stand:${player.id || player.name}:${previous}:${now}`,
			emit,
		});
		return { ...settled, delta };
	}
	return settled;
}

function recordMerchantLuck(player, targetId, now = Date.now()) {
	ensurePlayerContainers(player);
	const result = qualifyLuck(player.merchant_accrual, targetId, now);
	player.merchant_accrual = result.state;
	return result;
}

function recordMerchantSale(player, details) {
	ensurePlayerContainers(player);
	const result = recordSale(player.merchant_accrual, details);
	player.merchant_accrual = result.state;
	return result;
}

function recordMerchantSaleReversal(player, details) {
	ensurePlayerContainers(player);
	const result = recordSaleReversal(player.merchant_accrual, details);
	player.merchant_accrual = result.state;
	return result;
}

function recordMerchantAction(player, details) {
	ensurePlayerContainers(player);
	const result = addCredit(player.merchant_accrual, details);
	player.merchant_accrual = result.state;
	return result;
}

function recordMerchantDonationOrDice(player, details) {
	ensurePlayerContainers(player);
	const result = recordDonationOrDice(player.merchant_accrual, details);
	player.merchant_accrual = result.state;
	return result;
}

function refreshDeathSickness(player, now = Date.now()) {
	ensurePlayerContainers(player);
	return applyDeathSickness({ info: player }, now);
}

function rehydratePlayerDeathSickness(player, now = Date.now()) {
	ensurePlayerContainers(player);
	return rehydrateDeathSickness({ info: player }, now);
}

module.exports = {
	SOURCE_IDS,
	initializePlayerProgression,
	awardPlayerSkillXp,
	maxCombatLevel,
	skillLevel,
	markStandSession,
	settlePlayerStand,
	recordMerchantLuck,
	recordMerchantSale,
	recordMerchantSaleReversal,
	recordMerchantAction,
	recordMerchantDonationOrDice,
	refreshDeathSickness,
	rehydratePlayerDeathSickness,
	sicknessActive: (player, now) => sicknessActive({ info: player }, now),
	sicknessDelta: (player, now) => sicknessDelta({ info: player }, now),
	computeTotalLevel,
	validateSkillState,
	cumulativeXp,
};
