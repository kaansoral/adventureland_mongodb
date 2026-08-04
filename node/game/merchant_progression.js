"use strict";

const { progression } = require("../../design/progression");

const HOUR = progression.STAND_HOUR_MS;
const BASE = progression.BASE_UNITS_PER_HOUR;
const UNITS_PER_XP = progression.XP_UNITS_PER_XP;

function merchantError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function createMerchantAccrual() {
	return {
		base_ms_remainder: 0,
		unit_xp_remainder: 0,
		stand_last_settled_at: null,
		pending_credits: [],
		rolling_awards: [],
		luck_targets: [],
		sales: {},
		processed_sources: [],
		saturated_award_units: 0,
	};
}

function prune(state, now) {
	state.pending_credits = (state.pending_credits || []).filter((credit) => credit.expires_at > now);
	state.rolling_awards = (state.rolling_awards || []).filter((award) => award.at > now - HOUR);
	state.luck_targets = (state.luck_targets || []).filter((entry) => entry.at > now - HOUR);
	for (const [owner, ledger] of Object.entries(state.sales || {})) {
		ledger.events = (ledger.events || []).filter((event) => event.at > now - HOUR);
		if (!ledger.events.length && ledger.net_gold <= ledger.credited_high_water_gold) delete state.sales[owner];
	}
	state.processed_sources = (state.processed_sources || []).slice(-progression.MAX_COLLECTION_SIZE);
	if (state.saturated_award_expires_at && state.saturated_award_expires_at <= now - HOUR) {
		state.saturated_award_units = 0;
		state.saturated_award_expires_at = null;
	}
	return state;
}

function unitsToXp(state, units) {
	const total = state.unit_xp_remainder + units;
	const xp = Math.floor(total / UNITS_PER_XP);
	state.unit_xp_remainder = total % UNITS_PER_XP;
	return xp;
}

function addRollingAward(state, units, now, kind) {
	if (units <= 0) return;
	if (state.rolling_awards.length >= progression.MAX_COLLECTION_SIZE) {
		state.saturated_award_units += units;
		state.saturated_award_expires_at = Math.max(state.saturated_award_expires_at || 0, now + HOUR);
		return;
	}
	state.rolling_awards.push({ at: now, units, kind });
}

function rollingUnits(state, now) {
	return (
		state.rolling_awards.filter((award) => award.at > now - HOUR).reduce((sum, award) => sum + award.units, 0) +
		(state.saturated_award_units || 0)
	);
}

function settleStand(previous, elapsedMs, now = Date.now()) {
	if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0)
		throw merchantError("invalid_merchant_clock", "Stand elapsed time must be a non-negative safe integer");
	const state = prune(clone(previous || createMerchantAccrual()), now);
	const numerator = elapsedMs * BASE + state.base_ms_remainder;
	const base_units = Math.floor(numerator / HOUR);
	state.base_ms_remainder = numerator % HOUR;
	const priorRolling = rollingUnits(state, now);
	const bonusCapacity = Math.max(0, progression.MAX_TOTAL_UNITS_PER_HOUR - priorRolling - base_units);
	const requestedBonus = Math.min(
		state.pending_credits.reduce((sum, credit) => sum + credit.units, 0),
		base_units * 5,
		bonusCapacity,
	);
	let remaining = requestedBonus;
	for (const credit of state.pending_credits) {
		const redeemed = Math.min(credit.units, remaining);
		credit.units -= redeemed;
		remaining -= redeemed;
		if (!remaining) break;
	}
	state.pending_credits = state.pending_credits.filter((credit) => credit.units > 0);
	const units = base_units + requestedBonus;
	addRollingAward(state, units, now, "stand");
	return { state, xp: unitsToXp(state, units), units, base_units, bonus_units: requestedBonus };
}

function addCredit(
	previous,
	{ units, sourceId, kind = "action", targetId = null, now = Date.now(), expiresAt = now + HOUR },
) {
	if (!Number.isSafeInteger(units) || units <= 0)
		throw merchantError("invalid_merchant_credit", "Credit units must be a positive safe integer");
	const state = prune(clone(previous || createMerchantAccrual()), now);
	if (sourceId && state.processed_sources.includes(sourceId)) return { state, credited: 0, duplicate: true };
	if (sourceId) {
		if (state.processed_sources.length >= progression.MAX_COLLECTION_SIZE)
			return { state, credited: 0, saturated: true };
		state.processed_sources.push(sourceId);
	}
	const actionRoom = Math.max(
		0,
		progression.MAX_ACTION_UNITS_PER_HOUR -
			state.pending_credits.reduce((sum, credit) => sum + credit.units, 0) -
			state.rolling_awards.filter((award) => award.at > now - HOUR).reduce((sum, award) => sum + award.units, 0),
	);
	const credited = Math.min(units, actionRoom);
	if (credited)
		state.pending_credits.push({
			units: credited,
			source_id: sourceId,
			kind,
			target_id: targetId,
			expires_at: expiresAt,
		});
	return { state, credited, saturated: credited < units };
}

function recordSaleReversal(
	previous,
	{ merchantOwnerId, externalOwnerId, goldReversed, sourceId, now = Date.now() },
) {
	if (!merchantOwnerId || !externalOwnerId || merchantOwnerId === externalOwnerId || goldReversed <= 0)
		return { state: clone(previous || createMerchantAccrual()), credited: 0, eligible: false };
	const state = prune(clone(previous || createMerchantAccrual()), now);
	if (sourceId && state.processed_sources.includes(sourceId)) return { state, credited: 0, duplicate: true };
	if (sourceId) {
		if (state.processed_sources.length >= progression.MAX_COLLECTION_SIZE)
			return { state, credited: 0, saturated: true };
		state.processed_sources.push(sourceId);
	}
	const ledger = state.sales[externalOwnerId];
	if (!ledger) return { state, credited: 0, eligible: false };
	ledger.net_gold = Math.max(0, ledger.net_gold - goldReversed);
	if (ledger.events.length < progression.MAX_COLLECTION_SIZE)
		ledger.events.push({ at: now, gold: -goldReversed, source_id: sourceId, kind: "reversal" });
	return { state, credited: 0, eligible: false };
}

function qualifyLuck(previous, targetId, now = Date.now()) {
	const state = prune(clone(previous || createMerchantAccrual()), now);
	if (state.luck_targets.some((entry) => entry.target_id === targetId))
		return { state, qualifies: false, credited: 0, reason: "target_cap" };
	if (state.luck_targets.length >= progression.LUCK_MAX_TARGETS_PER_HOUR)
		return { state, qualifies: false, credited: 0, reason: "hour_cap" };
	state.luck_targets.push({ target_id: targetId, at: now });
	const result = addCredit(state, {
		units: progression.LUCK_UNITS,
		sourceId: `luck:${targetId}:${now}`,
		kind: "luck",
		targetId,
		now,
	});
	return { ...result, state: result.state, qualifies: true };
}

function recordSale(
	previous,
	{ merchantOwnerId, externalOwnerId, goldReceived, serverTax, sourceId, now = Date.now() },
) {
	if (!merchantOwnerId || !externalOwnerId || merchantOwnerId === externalOwnerId || goldReceived <= 0)
		return { state: clone(previous || createMerchantAccrual()), credited: 0, eligible: false };
	const state = prune(clone(previous || createMerchantAccrual()), now);
	if (sourceId && state.processed_sources.includes(sourceId)) return { state, credited: 0, duplicate: true };
	if (sourceId && state.processed_sources.length >= progression.MAX_COLLECTION_SIZE)
		return { state, credited: 0, saturated: true };
	const ledger = state.sales[externalOwnerId] || { net_gold: 0, credited_high_water_gold: 0, events: [] };
	const eligibleGold = Math.max(0, ledger.net_gold + goldReceived - ledger.credited_high_water_gold);
	ledger.net_gold += goldReceived;
	if (ledger.events.length >= progression.MAX_COLLECTION_SIZE) {
		ledger.credited_high_water_gold = Math.max(ledger.credited_high_water_gold, ledger.net_gold);
		state.sales[externalOwnerId] = ledger;
		if (sourceId) state.processed_sources.push(sourceId);
		return { state, credited: 0, saturated: true };
	}
	ledger.events.push({ at: now, gold: goldReceived, source_id: sourceId, kind: "sale" });
	const fraction = Math.min(1, eligibleGold / goldReceived);
	const rawXp = Math.round(serverTax * 3.2 * fraction);
	ledger.credited_high_water_gold = Math.max(ledger.credited_high_water_gold, ledger.net_gold);
	state.sales[externalOwnerId] = ledger;
	return addCredit(state, {
		units: Math.min(rawXp * UNITS_PER_XP, Math.floor(BASE / 10)),
		sourceId: sourceId || `sale:${externalOwnerId}:${now}`,
		kind: "sale",
		now,
	});
}

function validateMerchantAccrual(state, now = Date.now()) {
	if (!state || typeof state !== "object" || Array.isArray(state))
		throw merchantError("invalid_merchant_state", "Merchant accrual must be an object");
	for (const field of ["base_ms_remainder", "unit_xp_remainder", "saturated_award_units"]) {
		if (!Number.isSafeInteger(state[field] || 0) || (state[field] || 0) < 0)
			throw merchantError("invalid_merchant_state", `Invalid ${field}`);
	}
	if (state.base_ms_remainder >= HOUR || state.unit_xp_remainder >= UNITS_PER_XP)
		throw merchantError("invalid_merchant_state", "Merchant remainders are out of range");
	if (state.stand_last_settled_at !== null && state.stand_last_settled_at !== undefined &&
		(!Number.isSafeInteger(state.stand_last_settled_at) || state.stand_last_settled_at > now))
		throw merchantError("invalid_merchant_state", "Invalid stand settlement timestamp");
	for (const collection of ["pending_credits", "rolling_awards", "luck_targets", "processed_sources"])
		if (!Array.isArray(state[collection]) || state[collection].length > progression.MAX_COLLECTION_SIZE)
			throw merchantError("invalid_merchant_state", `${collection} exceeds its bound`);
	if (state.luck_targets.length > progression.MAX_LUCK_COLLECTION_SIZE)
		throw merchantError("invalid_merchant_state", "luck_targets exceeds its bound");
	return state;
}

function recordDonationOrDice(previous, { rawXp, sourceId, kind, now = Date.now() }) {
	return addCredit(previous, {
		units: Math.min(Math.max(0, Math.round(rawXp)) * UNITS_PER_XP, Math.floor(BASE / 4)),
		sourceId,
		kind,
		now,
	});
}

function merchantTax(level) {
	if (level > 80) return 0.01;
	if (level > 70) return 0.02;
	if (level > 60) return 0.025;
	if (level > 50) return 0.03;
	if (level > 20) return 0.04;
	return 0.05;
}

function merchantSlots(level, hasCstand = false) {
	if (level >= 80) return 30;
	if (level >= 70 || hasCstand) return 24;
	return 16;
}

module.exports = {
	createMerchantAccrual,
	settleStand,
	addCredit,
	qualifyLuck,
	recordSale,
	recordSaleReversal,
	recordDonationOrDice,
	merchantTax,
	merchantSlots,
	prune,
	unitsToXp,
	validateMerchantAccrual,
};
