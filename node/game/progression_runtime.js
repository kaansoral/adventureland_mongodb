"use strict";

const { SKILL_IDS, COMBAT_SKILL_IDS, cumulativeXp } = require("./skill_domain");
const { progression } = require("../../design/progression");
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

const SOURCE_IDS = new Set(progression.XP_SOURCES);
function runtimeError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function ensurePlayerContainers(player) {
	if (!player || typeof player !== "object") throw runtimeError("invalid_character_skill_state", "Player is required");
	if (!player.info || typeof player.info !== "object") player.info = {};
	if (!player.info.skills) throw runtimeError("invalid_character_skill_state", "Persisted info.skills is required");
	// Runtime code may use the flattened alias, but the persisted document is authoritative.
	player.skills = player.info.skills;
	if (player.info.merchant_accrual === undefined && player.merchant_accrual !== undefined)
		player.info.merchant_accrual = player.merchant_accrual;
	if (player.info.death_sickness_until === undefined && player.death_sickness_until !== undefined)
		player.info.death_sickness_until = player.death_sickness_until;
	delete player.merchant_accrual;
	delete player.death_sickness_until;
	if (!player.p || typeof player.p !== "object") player.p = {};
	if (!Array.isArray(player.p.skill_xp_sources)) player.p.skill_xp_sources = [];
	if (!player.t || typeof player.t !== "object") player.t = {};
	if (!player.t.skill_xp || typeof player.t.skill_xp !== "object") player.t.skill_xp = {};
	for (const skill of SKILL_IDS) player.t.skill_xp[skill] = Number(player.t.skill_xp[skill]) || 0;
	const merchantId = player.real_id || player.id || player.name || "unknown";
	if (!player.info.merchant_accrual || typeof player.info.merchant_accrual !== "object") {
		player.info.merchant_accrual = createMerchantAccrual(merchantId);
	} else if (player.info.merchant_accrual.merchant_id !== merchantId) {
		throw runtimeError("invalid_merchant_state", "Merchant accrual belongs to a different character");
	}
	return player;
}

function initializePlayerProgression(player, now = Date.now()) {
	ensurePlayerContainers(player);
	const state = loadCharacterState({ info: { skills: player.info.skills }, total_level: player.total_level });
	player.skills = state.skills;
	player.info.skills = player.skills;
	player.total_level = state.total_level;
	validateMerchantAccrual(player.info.merchant_accrual, now);
	player.info.merchant_accrual = pruneMerchantAccrual(player.info.merchant_accrual, now);
	rehydrateDeathSickness(player, now);
	// A persisted open stand is a reopened session; never carry a wall-clock gap across login.
	if (player.p.stand) player.p.stand_last_settled_at = now;
	return player;
}

function sourceKind(source) {
	if (!source) return null;
	if (SOURCE_IDS.has(source)) return source;
	return null;
}

function queueSkillDelta(player, delta, skills = player.skills) {
	if (!delta || delta.duplicate) return;
	if (!Array.isArray(player.progression_events)) player.progression_events = [];
	player.progression_events.push({
		delta: { ...delta },
		skills: JSON.parse(JSON.stringify(skills)),
	});
}

function flushPlayerProgressionEvents(player) {
	if (!Array.isArray(player.progression_events) || !player.progression_events.length) return 0;
	if (!player.socket || typeof player.socket.emit !== "function") return 0;
	let flushed = 0;
	while (player.progression_events.length) {
		const event = player.progression_events[0];
		player.socket.emit("skill_xp", { ...event.delta, skills: event.skills });
		if (event.delta.to_level > event.delta.from_level) {
			player.socket.emit("skill_level_up", {
				skill: event.delta.skill,
				from_level: event.delta.from_level,
				to_level: event.delta.to_level,
				levels_gained: event.delta.levels_gained,
				total_level: event.delta.total_level,
			});
		}
		player.progression_events.shift();
		flushed += 1;
	}
	return flushed;
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
	const result = awardSkillXp({ skills: player.skills, total_level: player.total_level }, skillId, requestedXp, {
		sourceId,
		seenSources: known,
	});
	player.skills = result.state.skills;
	player.info.skills = player.skills;
	player.total_level = result.state.total_level;
	if (sourceId && !player.p.skill_xp_sources.includes(sourceId)) {
		player.p.skill_xp_sources = [...known];
	}
	if (!result.delta.duplicate) player.t.skill_xp[skillId] += result.delta.accepted_xp;
	player.t.total_skill_xp = SKILL_IDS.reduce((sum, skill) => sum + player.t.skill_xp[skill], 0);
	if (emit && !result.delta.duplicate) queueSkillDelta(player, result.delta);
	return result.delta;
}

function awardPlayerSkillXpSplit(player, split, { source, sourceId, emit = true } = {}) {
	ensurePlayerContainers(player);
	if (!sourceKind(source)) {
		throw runtimeError("invalid_skill_delta", "Skill XP source is not allowlisted", {
			path: "source",
			reason: "unclassified_source",
		});
	}
	const known = new Set(player.p.skill_xp_sources);
	let working = { skills: JSON.parse(JSON.stringify(player.skills)), total_level: player.total_level };
	const deltas = [];
	const eventSnapshots = [];
	for (const [skill, requestedXp] of Object.entries(split || {})) {
		if (!requestedXp) continue;
		const result = awardSkillXp(working, skill, requestedXp, {
			sourceId: sourceId ? `${sourceId}:${skill}` : undefined,
			seenSources: known,
		});
		working = result.state;
		deltas.push(result.delta);
		if (!result.delta.duplicate) eventSnapshots.push({ delta: result.delta, skills: working.skills });
	}
	player.skills = working.skills;
	player.info.skills = player.skills;
	player.total_level = working.total_level;
	if (sourceId) player.p.skill_xp_sources = [...known];
	for (const event of eventSnapshots) {
		const delta = event.delta;
		if (delta.duplicate) continue;
		player.t.skill_xp[delta.skill] += delta.accepted_xp;
		if (emit) queueSkillDelta(player, delta, event.skills);
	}
	player.t.total_skill_xp = SKILL_IDS.reduce((sum, skill) => sum + player.t.skill_xp[skill], 0);
	return deltas;
}

function maxCombatLevel(player) {
	return Math.max(
		...COMBAT_SKILL_IDS.map((skill) => (player.skills && player.skills[skill] && player.skills[skill].level) || 1),
	);
}

function skillLevel(player, skillId) {
	return (player.skills && player.skills[skillId] && player.skills[skillId].level) || 1;
}

function markStandSession(player, now = Date.now()) {
	ensurePlayerContainers(player);
	player.p.stand_last_settled_at = now;
	return player.info.merchant_accrual;
}

function settlePlayerStand(player, now = Date.now(), { emit = true } = {}) {
	ensurePlayerContainers(player);
	const accrual = player.info.merchant_accrual;
	if (!player.p || !player.p.stand || player.rip || !player.socket) {
		return { xp: 0, units: 0, state: accrual, skipped: true };
	}
	const previous = player.p.stand_last_settled_at;
	if (!Number.isSafeInteger(previous) || now <= previous) return { xp: 0, units: 0, state: accrual, skipped: true };
	const settled = settleStand(accrual, now - previous, now);
	if (settled.xp) {
		const before = {
			skills: player.skills,
			infoSkills: player.info.skills,
			total_level: player.total_level,
			t: player.t,
			p: player.p,
		};
		try {
			const delta = awardPlayerSkillXp(player, "merchant", settled.xp, {
				source: "merchant_stand",
				sourceId: `stand:${player.id || player.name}:${previous}:${now}`,
				emit: false,
			});
			player.info.merchant_accrual = settled.state;
			player.p.stand_last_settled_at = now;
			if (emit && !delta.duplicate) queueSkillDelta(player, delta);
			return { ...settled, delta };
		} catch (error) {
			player.skills = before.skills;
			player.info.skills = before.infoSkills;
			player.total_level = before.total_level;
			player.t = before.t;
			player.p = before.p;
			throw error;
		}
	}
	player.info.merchant_accrual = settled.state;
	player.p.stand_last_settled_at = now;
	return settled;
}

function recordMerchantLuck(player, targetId, now = Date.now()) {
	ensurePlayerContainers(player);
	const result = qualifyLuck(player.info.merchant_accrual, targetId, now);
	player.info.merchant_accrual = result.state;
	return result;
}

function recordMerchantSale(player, details) {
	ensurePlayerContainers(player);
	const result = recordSale(player.info.merchant_accrual, details);
	player.info.merchant_accrual = result.state;
	return result;
}

function recordMerchantSaleReversal(player, details) {
	ensurePlayerContainers(player);
	const result = recordSaleReversal(player.info.merchant_accrual, details);
	player.info.merchant_accrual = result.state;
	return result;
}

function recordMerchantAction(player, details) {
	ensurePlayerContainers(player);
	const result = addCredit(player.info.merchant_accrual, details);
	player.info.merchant_accrual = result.state;
	return result;
}

function recordMerchantDonationOrDice(player, details) {
	ensurePlayerContainers(player);
	const result = recordDonationOrDice(player.info.merchant_accrual, details);
	player.info.merchant_accrual = result.state;
	return result;
}

function refreshDeathSickness(player, now = Date.now()) {
	ensurePlayerContainers(player);
	const until = applyDeathSickness(player, now);
	if (!player.s || typeof player.s !== "object") player.s = {};
	player.s.death_sickness = { ms: until - now };
	return until;
}

function rehydratePlayerDeathSickness(player, now = Date.now()) {
	ensurePlayerContainers(player);
	const until = rehydrateDeathSickness(player, now);
	if (!player.s || typeof player.s !== "object") player.s = {};
	if (until === null) delete player.s.death_sickness;
	else player.s.death_sickness = { ms: until - now };
	return until;
}

module.exports = {
	SOURCE_IDS,
	initializePlayerProgression,
	awardPlayerSkillXp,
	awardPlayerSkillXpSplit,
	flushPlayerProgressionEvents,
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
	sicknessActive: (player, now) => sicknessActive(player, now),
	sicknessDelta: (player, now) => sicknessDelta(player, now),
	computeTotalLevel,
	validateSkillState,
	cumulativeXp,
};
