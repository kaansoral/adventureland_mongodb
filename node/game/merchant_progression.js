"use strict";

const { progression } = require("../../design/progression");

const HOUR = progression.STAND_HOUR_MS;
const BASE = progression.BASE_UNITS_PER_HOUR;
const UNITS_PER_XP = progression.XP_UNITS_PER_XP;
const CREDIT_KINDS = new Set(["mluck", "sale", "donation", "dice"]);
const ACTION_KINDS = new Set(["donation", "dice"]);
const REQUIRED_FIELDS = [
	"merchant_id",
	"eligible_stand_ms",
	"stand_rate_remainder",
	"xp_unit_remainder",
	"rolling_hour_luck_uses",
	"pending_credits",
	"rolling_awards",
	"sales_by_owner",
	"processed_sources",
];

function merchantError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function isOpenMerchantStand(player) {
	return Boolean(player && player.p && player.p.stand && !player.rip);
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function createMerchantAccrual(merchantId = "unknown") {
	if (typeof merchantId !== "string" || !merchantId)
		throw merchantError("invalid_merchant_state", "Merchant ID must be a non-empty string");
	return {
		merchant_id: merchantId,
		eligible_stand_ms: 0,
		stand_rate_remainder: 0,
		xp_unit_remainder: 0,
		rolling_hour_luck_uses: [],
		pending_credits: [],
		rolling_awards: [],
		sales_by_owner: {},
		processed_sources: [],
	};
}

function prune(state, now) {
	const lowerBound = now - HOUR;
	state.pending_credits = state.pending_credits.filter((credit) => credit.expires_at > now);
	state.rolling_awards = state.rolling_awards.filter((award) => award.at > lowerBound);
	state.rolling_hour_luck_uses = state.rolling_hour_luck_uses.filter((entry) => entry.at > lowerBound);
	for (const [owner, ledger] of Object.entries(state.sales_by_owner)) {
		ledger.events = ledger.events.filter((event) => event.at > lowerBound);
		if (!ledger.events.length) delete state.sales_by_owner[owner];
	}
	state.processed_sources = state.processed_sources.filter((entry) => entry.expires_at > now);
	if (state.saturated_award_units && state.saturated_award_units.expires_at <= now) delete state.saturated_award_units;
	return state;
}

function prepare(previous, now) {
	const state = clone(previous || createMerchantAccrual());
	validateMerchantAccrual(state, now, { allowExpired: true });
	return prune(state, now);
}

function unitsToXp(state, units) {
	const total = state.xp_unit_remainder + units;
	const xp = Math.floor(total / UNITS_PER_XP);
	state.xp_unit_remainder = total % UNITS_PER_XP;
	return xp;
}

function awardUnits(award) {
	return award.base_units + award.bonus_units;
}

function addRollingAward(state, base_units, bonus_units, now) {
	const units = base_units + bonus_units;
	if (units <= 0) return;
	if (state.rolling_awards.length >= progression.MAX_COLLECTION_SIZE) {
		const previous = state.saturated_award_units;
		state.saturated_award_units = {
			units: (previous ? previous.units : 0) + units,
			expires_at: Math.max(previous ? previous.expires_at : 0, now + HOUR),
		};
		return;
	}
	state.rolling_awards.push({ at: now, base_units, bonus_units });
}

function rollingUnits(state) {
	return (
		state.rolling_awards.reduce((sum, award) => sum + awardUnits(award), 0) +
		(state.saturated_award_units ? state.saturated_award_units.units : 0)
	);
}

function rollingBonusUnits(state) {
	if (state.saturated_award_units) return progression.MAX_ACTION_UNITS_PER_HOUR;
	return state.rolling_awards.reduce((sum, award) => sum + award.bonus_units, 0);
}

function reserveSource(state, sourceId, now) {
	const existing = state.processed_sources.find((entry) => entry.source_id === sourceId);
	if (existing) return { duplicate: true, reserved: false };
	if (state.processed_sources.length >= progression.MAX_COLLECTION_SIZE) return { saturated: true, reserved: false };
	state.processed_sources.push({ source_id: sourceId, expires_at: now + HOUR });
	return { reserved: true };
}

function enqueueCredit(state, { units, sourceId, kind, now, expiresAt = now + HOUR }) {
	if (!Number.isSafeInteger(units) || units <= 0)
		throw merchantError("invalid_merchant_credit", "Credit units must be a positive safe integer");
	if (typeof sourceId !== "string" || !sourceId)
		throw merchantError("invalid_merchant_credit", "Merchant credits require a source ID");
	if (!CREDIT_KINDS.has(kind)) throw merchantError("invalid_merchant_credit", "Unknown Merchant credit kind");
	if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + HOUR)
		throw merchantError("invalid_merchant_credit", "Merchant credit expiry must be within one hour");
	const actionRoom = Math.max(
		0,
		progression.MAX_ACTION_UNITS_PER_HOUR -
			state.pending_credits.reduce((sum, credit) => sum + credit.units, 0) -
			rollingBonusUnits(state),
	);
	const credited = Math.min(units, actionRoom);
	if (credited)
		state.pending_credits.push({
			source_id: sourceId,
			kind,
			units: credited,
			expires_at: expiresAt,
		});
	return { state, credited, saturated: credited < units };
}

function settleStand(previous, elapsedMs, now = Date.now()) {
	if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0)
		throw merchantError("invalid_merchant_clock", "Stand elapsed time must be a non-negative safe integer");
	const state = prepare(previous, now);
	const creditedElapsedMs = Math.min(elapsedMs, HOUR);
	if (!Number.isSafeInteger(state.eligible_stand_ms + creditedElapsedMs))
		throw merchantError("invalid_merchant_clock", "Eligible stand time exceeds safe integer range");
	state.eligible_stand_ms += creditedElapsedMs;
	const numerator = creditedElapsedMs * BASE + state.stand_rate_remainder;
	const base_units = Math.floor(numerator / HOUR);
	state.stand_rate_remainder = numerator % HOUR;
	const priorRolling = rollingUnits(state);
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
	addRollingAward(state, base_units, requestedBonus, now);
	return {
		state,
		xp: unitsToXp(state, units),
		units,
		base_units,
		bonus_units: requestedBonus,
		credited_elapsed_ms: creditedElapsedMs,
	};
}

function addCredit(previous, { units, sourceId, kind = "mluck", now = Date.now(), expiresAt = now + HOUR }) {
	if (!Number.isSafeInteger(units) || units <= 0)
		throw merchantError("invalid_merchant_credit", "Credit units must be a positive safe integer");
	if (typeof sourceId !== "string" || !sourceId)
		throw merchantError("invalid_merchant_credit", "Merchant credits require a source ID");
	const state = prepare(previous, now);
	const reservation = reserveSource(state, sourceId, now);
	if (reservation.duplicate) return { state, credited: 0, duplicate: true };
	if (reservation.saturated) return { state, credited: 0, saturated: true };
	return enqueueCredit(state, { units, sourceId, kind, now, expiresAt });
}

function recordSaleReversal(previous, { merchantOwnerId, externalOwnerId, goldReversed, sourceId, now = Date.now() }) {
	if (!merchantOwnerId || !externalOwnerId || merchantOwnerId === externalOwnerId || goldReversed <= 0)
		return { state: clone(previous || createMerchantAccrual()), credited: 0, eligible: false };
	if (typeof sourceId !== "string" || !sourceId)
		throw merchantError("invalid_merchant_credit", "Merchant reversals require a source ID");
	const state = prepare(previous, now);
	const reservation = reserveSource(state, sourceId, now);
	if (reservation.duplicate) return { state, credited: 0, duplicate: true };
	if (reservation.saturated) return { state, credited: 0, saturated: true };
	const ledger = state.sales_by_owner[externalOwnerId];
	if (!ledger) return { state, credited: 0, eligible: false };
	ledger.net_gold = Math.max(0, ledger.net_gold - goldReversed);
	if (ledger.events.length < progression.MAX_COLLECTION_SIZE)
		ledger.events.push({ at: now, net_delta: -goldReversed, source_id: sourceId });
	return { state, credited: 0, eligible: false };
}

function qualifyLuck(previous, targetId, now = Date.now()) {
	const state = prepare(previous, now);
	if (state.rolling_hour_luck_uses.some((entry) => entry.target_id === targetId))
		return { state, qualifies: false, credited: 0, reason: "target_cap" };
	if (state.rolling_hour_luck_uses.length >= progression.LUCK_MAX_TARGETS_PER_HOUR)
		return { state, qualifies: false, credited: 0, reason: "hour_cap" };
	state.rolling_hour_luck_uses.push({ target_id: targetId, at: now });
	const result = addCredit(state, {
		units: progression.LUCK_UNITS,
		sourceId: `mluck:${targetId}:${now}`,
		kind: "mluck",
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
	const state = prepare(previous, now);
	const effectiveSourceId = sourceId || `sale:${externalOwnerId}:${now}`;
	const reservation = reserveSource(state, effectiveSourceId, now);
	if (reservation.duplicate) return { state, credited: 0, duplicate: true };
	if (reservation.saturated) return { state, credited: 0, saturated: true };
	const ledger = state.sales_by_owner[externalOwnerId] || { net_gold: 0, credited_high_water_gold: 0, events: [] };
	if (
		!state.sales_by_owner[externalOwnerId] &&
		Object.keys(state.sales_by_owner).length >= progression.MAX_COLLECTION_SIZE
	)
		return { state, credited: 0, saturated: true };
	const eligibleGold = Math.min(
		goldReceived,
		Math.max(0, ledger.net_gold + goldReceived - ledger.credited_high_water_gold),
	);
	ledger.net_gold += goldReceived;
	if (ledger.events.length >= progression.MAX_COLLECTION_SIZE) {
		ledger.credited_high_water_gold = Math.max(ledger.credited_high_water_gold, ledger.net_gold);
		state.sales_by_owner[externalOwnerId] = ledger;
		return { state, credited: 0, saturated: true };
	}
	ledger.events.push({ at: now, net_delta: goldReceived, source_id: effectiveSourceId });
	const fraction = Math.min(1, eligibleGold / goldReceived);
	const rawXp = Math.round(serverTax * 3.2 * fraction);
	ledger.credited_high_water_gold = Math.max(ledger.credited_high_water_gold, ledger.net_gold);
	state.sales_by_owner[externalOwnerId] = ledger;
	const units = Math.min(rawXp * UNITS_PER_XP, Math.floor(BASE / 10));
	if (!units) return { state, credited: 0, eligible: eligibleGold > 0 };
	return {
		...enqueueCredit(state, { units, sourceId: effectiveSourceId, kind: "sale", now }),
		eligible: eligibleGold > 0,
	};
}

function validateMerchantAccrual(state, now = Date.now(), { allowExpired = false } = {}) {
	if (!state || typeof state !== "object" || Array.isArray(state))
		throw merchantError("invalid_merchant_state", "Merchant accrual must be an object");
	const allowedFields = new Set([...REQUIRED_FIELDS, "saturated_award_units"]);
	if (Object.keys(state).some((field) => !allowedFields.has(field)))
		throw merchantError("invalid_merchant_state", "Merchant accrual contains unknown fields");
	for (const field of REQUIRED_FIELDS) {
		if (!(field in state)) throw merchantError("invalid_merchant_state", `Missing ${field}`);
	}
	if (typeof state.merchant_id !== "string" || !state.merchant_id)
		throw merchantError("invalid_merchant_state", "Invalid merchant_id");
	for (const field of ["eligible_stand_ms", "stand_rate_remainder", "xp_unit_remainder"]) {
		if (!Number.isSafeInteger(state[field]) || state[field] < 0)
			throw merchantError("invalid_merchant_state", `Invalid ${field}`);
	}
	if (state.stand_rate_remainder >= HOUR || state.xp_unit_remainder >= UNITS_PER_XP)
		throw merchantError("invalid_merchant_state", "Merchant remainders are out of range");
	if (
		!Array.isArray(state.rolling_hour_luck_uses) ||
		state.rolling_hour_luck_uses.length > progression.MAX_LUCK_COLLECTION_SIZE
	)
		throw merchantError("invalid_merchant_state", "rolling_hour_luck_uses exceeds its bound");
	if (!Array.isArray(state.pending_credits) || state.pending_credits.length > progression.MAX_COLLECTION_SIZE)
		throw merchantError("invalid_merchant_state", "pending_credits exceeds its bound");
	if (!Array.isArray(state.rolling_awards) || state.rolling_awards.length > progression.MAX_COLLECTION_SIZE)
		throw merchantError("invalid_merchant_state", "rolling_awards exceeds its bound");
	if (!Array.isArray(state.processed_sources) || state.processed_sources.length > progression.MAX_COLLECTION_SIZE)
		throw merchantError("invalid_merchant_state", "processed_sources exceeds its bound");
	if (!state.sales_by_owner || typeof state.sales_by_owner !== "object" || Array.isArray(state.sales_by_owner))
		throw merchantError("invalid_merchant_state", "Invalid Merchant sales state");
	if (Object.keys(state.sales_by_owner).length > progression.MAX_COLLECTION_SIZE)
		throw merchantError("invalid_merchant_state", "sales_by_owner exceeds its bound");
	if (state.saturated_award_units !== undefined) {
		const marker = state.saturated_award_units;
		if (
			!marker ||
			!Number.isSafeInteger(marker.units) ||
			marker.units <= 0 ||
			!Number.isSafeInteger(marker.expires_at) ||
			(!allowExpired && marker.expires_at <= now) ||
			marker.expires_at > now + HOUR
		)
			throw merchantError("invalid_merchant_state", "Invalid saturated award marker");
	}
	for (const entry of state.rolling_hour_luck_uses) {
		if (!entry || Object.keys(entry).some((key) => !["target_id", "at"].includes(key)))
			throw merchantError("invalid_merchant_state", "Invalid Merchant Luck history");
		if (typeof entry.target_id !== "string" || !entry.target_id || !Number.isSafeInteger(entry.at) || entry.at > now)
			throw merchantError("invalid_merchant_state", "Invalid Merchant Luck history");
	}
	for (const credit of state.pending_credits) {
		if (
			!credit ||
			Object.keys(credit).some((key) => !["source_id", "kind", "units", "expires_at"].includes(key)) ||
			typeof credit.source_id !== "string" ||
			!credit.source_id ||
			!CREDIT_KINDS.has(credit.kind) ||
			!Number.isSafeInteger(credit.units) ||
			credit.units <= 0 ||
			!Number.isSafeInteger(credit.expires_at) ||
			(!allowExpired && credit.expires_at <= now) ||
			credit.expires_at > now + HOUR
		)
			throw merchantError("invalid_merchant_state", "Invalid pending Merchant credit");
	}
	for (const award of state.rolling_awards) {
		if (
			!award ||
			Object.keys(award).some((key) => !["base_units", "bonus_units", "at"].includes(key)) ||
			!Number.isSafeInteger(award.at) ||
			award.at > now ||
			!Number.isSafeInteger(award.base_units) ||
			award.base_units < 0 ||
			!Number.isSafeInteger(award.bonus_units) ||
			award.bonus_units < 0 ||
			awardUnits(award) <= 0
		)
			throw merchantError("invalid_merchant_state", "Invalid rolling Merchant award");
	}
	for (const source of state.processed_sources) {
		if (
			!source ||
			Object.keys(source).some((key) => !["source_id", "expires_at"].includes(key)) ||
			typeof source.source_id !== "string" ||
			!source.source_id ||
			!Number.isSafeInteger(source.expires_at) ||
			(!allowExpired && source.expires_at <= now) ||
			source.expires_at > now + HOUR
		)
			throw merchantError("invalid_merchant_state", "Invalid processed Merchant source");
	}
	for (const ledger of Object.values(state.sales_by_owner)) {
		if (
			!ledger ||
			Object.keys(ledger).some((key) => !["net_gold", "credited_high_water_gold", "events"].includes(key)) ||
			!Number.isSafeInteger(ledger.net_gold) ||
			ledger.net_gold < 0 ||
			!Number.isSafeInteger(ledger.credited_high_water_gold) ||
			ledger.credited_high_water_gold < 0 ||
			!Array.isArray(ledger.events) ||
			ledger.events.length > progression.MAX_COLLECTION_SIZE
		)
			throw merchantError("invalid_merchant_state", "Invalid Merchant sale ledger");
		for (const event of ledger.events) {
			if (
				!event ||
				Object.keys(event).some((key) => !["source_id", "net_delta", "at"].includes(key)) ||
				typeof event.source_id !== "string" ||
				!event.source_id ||
				!Number.isSafeInteger(event.net_delta) ||
				!Number.isSafeInteger(event.at) ||
				event.at > now
			)
				throw merchantError("invalid_merchant_state", "Invalid Merchant sale event");
		}
	}
	return state;
}

function recordDonationOrDice(previous, { rawXp, sourceId, kind, now = Date.now() }) {
	if (!ACTION_KINDS.has(kind))
		throw merchantError("invalid_merchant_credit", "Merchant action kind must be donation or dice");
	if (typeof sourceId !== "string" || !sourceId)
		throw merchantError("invalid_merchant_credit", "Merchant actions require a source ID");
	const state = prepare(previous, now);
	const actionKey = `action:${kind}:${sourceId}`;
	if (state.processed_sources.some((entry) => entry.source_id === actionKey))
		return { state, credited: 0, duplicate: true };
	if (state.processed_sources.some((entry) => entry.source_id.startsWith(`action:${kind}:`)))
		return { state, credited: 0, capped: true };
	const reservation = reserveSource(state, actionKey, now);
	if (reservation.saturated) return { state, credited: 0, saturated: true };
	const units = Math.min(Math.max(0, Math.round(rawXp)) * UNITS_PER_XP, Math.floor(BASE / 4));
	if (!units) return { state, credited: 0 };
	return enqueueCredit(state, { units, sourceId, kind, now });
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
	isOpenMerchantStand,
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
