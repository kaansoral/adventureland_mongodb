"use strict";

const { COMBAT_SKILL_IDS } = require("./skill_domain");
const { progression } = require("../../design/progression");

function contributionError(message, fields = {}) {
	const error = new Error(message);
	error.code = "invalid_contribution";
	Object.assign(error, fields);
	return error;
}

function stableSkillOrder(skill) {
	const index = COMBAT_SKILL_IDS.indexOf(skill);
	return index < 0 ? COMBAT_SKILL_IDS.length : index;
}

function splitShare(characterShare, weights) {
	if (!Number.isSafeInteger(characterShare) || characterShare < 0)
		throw contributionError("Character share must be a non-negative safe integer");
	const entries = Object.entries(weights || {}).filter(([, weight]) => Number.isFinite(weight) && weight > 0);
	if (!entries.length || characterShare === 0) return {};
	const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
	const result = {};
	const fractions = [];
	let assigned = 0;
	for (const [skill, weight] of entries) {
		const exact = (characterShare * weight) / total;
		const whole = Math.floor(exact);
		result[skill] = whole;
		assigned += whole;
		fractions.push({ skill, fraction: exact - whole });
	}
	const remainder = characterShare - assigned;
	fractions.sort((a, b) => b.fraction - a.fraction || stableSkillOrder(a.skill) - stableSkillOrder(b.skill));
	for (let index = 0; index < remainder; index += 1) result[fractions[index % fractions.length].skill] += 1;
	return result;
}

class ContributionLedger {
	constructor({ now = () => Date.now(), closeAfterMs = progression.STAND_SETTLEMENT_MS } = {}) {
		this.now = now;
		this.closeAfterMs = closeAfterMs;
		this.encounters = new Map();
		this.actions = new Map();
	}

	openEncounter(encounterId, metadata = {}) {
		if (!encounterId) throw contributionError("Encounter ID is required");
		if (!this.encounters.has(encounterId)) {
			this.encounters.set(encounterId, {
				encounterId,
				metadata,
				weights: new Map(),
				sources: new Map(),
				supportWeights: new Map(),
				engaged: new Set(),
				actions: new Set(),
				recordedActions: new Set(),
				lastActivity: this.now(),
			});
		}
		return this.encounters.get(encounterId);
	}

	engage(encounterId, characterId) {
		const encounter = this.openEncounter(encounterId);
		encounter.engaged.add(characterId);
		encounter.lastActivity = this.now();
	}

	engagedEncounterIds(characterId) {
		const ids = [];
		for (const [encounterId, encounter] of this.encounters) {
			if (encounter.engaged.has(characterId)) ids.push(encounterId);
		}
		return ids;
	}

	snapshotAction({ actionId, encounterIds = [], characterId, activeSkill, kind = "combat" }) {
		if (!actionId || !characterId) throw contributionError("Action and character IDs are required");
		if (kind === "pvp") return { actionId, characterId, activeSkill: null, encounterIds: [], ignored: true };
		const existing = this.actions.get(actionId);
		if (existing) {
			const same =
				existing.characterId === characterId &&
				existing.activeSkill === activeSkill &&
				existing.kind === kind &&
				JSON.stringify(existing.encounterIds) === JSON.stringify(encounterIds);
			if (!same) throw contributionError("Action ID cannot be reused with different progression data");
			return existing;
		}
		const snapshot = { actionId, characterId, activeSkill, encounterIds: [...encounterIds], kind };
		this.actions.set(actionId, snapshot);
		for (const encounterId of encounterIds) {
			this.openEncounter(encounterId).actions.add(actionId);
		}
		return snapshot;
	}

	_getAction(actionId, fallback) {
		const action = this.actions.get(actionId) || fallback;
		if (!action || action.kind === "pvp") return null;
		if (!action.activeSkill || !COMBAT_SKILL_IDS.includes(action.activeSkill)) return null;
		return action;
	}

	_add(encounterId, characterId, skill, weight, actionId, source = "pve_damage") {
		if (!weight || weight <= 0) return 0;
		const encounter = this.openEncounter(encounterId);
		const key = `${characterId}:${skill}`;
		if (actionId && encounter.recordedActions.has(key + ":" + actionId)) return 0;
		if (actionId) encounter.recordedActions.add(key + ":" + actionId);
		const characterWeights = encounter.weights.get(characterId) || new Map();
		characterWeights.set(skill, (characterWeights.get(skill) || 0) + weight);
		encounter.weights.set(characterId, characterWeights);
		const sources = encounter.sources.get(`${characterId}:${skill}`) || new Set();
		sources.add(source);
		encounter.sources.set(`${characterId}:${skill}`, sources);
		encounter.engaged.add(characterId);
		encounter.lastActivity = this.now();
		return weight;
	}

	recordDamage({ encounterId, actionId, characterId, skill, amount, hpBefore = null, hpAfter = null }) {
		const action = this._getAction(actionId, {
			actionId,
			characterId,
			activeSkill: skill,
			encounterIds: [encounterId],
			kind: "combat",
		});
		if (!action) return 0;
		const effective =
			hpBefore === null || hpAfter === null
				? Math.max(0, amount || 0)
				: Math.max(0, Math.min(amount || 0, hpBefore - hpAfter));
		return this._add(
			encounterId,
			characterId,
			action.activeSkill,
			Math.max(0, Math.min(effective, hpBefore === null ? effective : hpBefore)),
			actionId,
			"pve_damage",
		);
	}

	recordHealing({ encounterId, actionId, characterId, skill, amount, currentHp = null, maxHp = null }) {
		const action = this._getAction(actionId, {
			actionId,
			characterId,
			activeSkill: skill,
			encounterIds: [encounterId],
			kind: "combat",
		});
		if (!action) return 0;
		const effective =
			currentHp === null || maxHp === null
				? Math.max(0, amount || 0)
				: Math.max(0, Math.min(amount || 0, maxHp - currentHp));
		const ids = action.encounterIds.length ? action.encounterIds : encounterId ? [encounterId] : [];
		if (!ids.length) return 0;
		const perEncounter = effective / ids.length;
		return ids.reduce(
			(total, id) => total + this._add(id, characterId, action.activeSkill, perEncounter, actionId, "pve_heal"),
			0,
		);
	}

	recordSupport({
		actionId,
		characterId,
		activeSkill,
		encounterIds = [],
		changed = false,
		weightPerUse = progression.SUPPORT_WEIGHT_PER_USE,
		maxWeightPerTargetPerEncounter = progression.SUPPORT_MAX_WEIGHT_PER_TARGET_PER_ENCOUNTER,
	}) {
		if (!changed || !weightPerUse || weightPerUse <= 0) return 0;
		const action = this._getAction(actionId, { actionId, characterId, activeSkill, encounterIds, kind: "combat" });
		if (!action) return 0;
		const ids = action.encounterIds.length ? action.encounterIds : encounterIds;
		const perEncounter = weightPerUse / Math.max(1, ids.length);
		let recorded = 0;
		for (const encounterId of ids) {
			const encounter = this.openEncounter(encounterId);
			const key = `${characterId}:${action.activeSkill}`;
			const current = encounter.supportWeights.get(key) || 0;
			const accepted = Math.min(perEncounter, Math.max(0, maxWeightPerTargetPerEncounter - current));
			if (!accepted || encounter.recordedActions.has(key + ":" + actionId)) continue;
			const added = this._add(encounterId, characterId, action.activeSkill, accepted, actionId, "pve_support");
			if (added) {
				encounter.supportWeights.set(key, current + added);
				recorded += added;
			}
		}
		return recorded;
	}

	characterIds(encounterId) {
		const encounter = this.encounters.get(encounterId);
		return encounter ? [...encounter.weights.keys()] : [];
	}

	weightForCharacter(encounterId, characterId) {
		const encounter = this.encounters.get(encounterId);
		const weights = encounter?.weights.get(characterId);
		return weights ? [...weights.values()].reduce((sum, weight) => sum + weight, 0) : 0;
	}

	totalWeight(encounterId) {
		const encounter = this.encounters.get(encounterId);
		if (!encounter) return 0;
		let total = 0;
		for (const weights of encounter.weights.values()) {
			for (const weight of weights.values()) total += weight;
		}
		return total;
	}

	sourceForCharacter(encounterId, characterId) {
		const encounter = this.encounters.get(encounterId);
		if (!encounter) return "pve_support";
		const sources = new Set();
		for (const [key, values] of encounter.sources) {
			if (key.startsWith(`${characterId}:`)) for (const source of values) sources.add(source);
		}
		if (sources.has("pve_damage")) return "pve_damage";
		if (sources.has("pve_heal")) return "pve_heal";
		return "pve_support";
	}

	disengage(encounterId, characterId) {
		const encounter = this.encounters.get(encounterId);
		if (!encounter) return false;
		encounter.engaged.delete(characterId);
		return encounter.engaged.size > 0;
	}

	removeCharacter(characterId) {
		for (const [encounterId, encounter] of this.encounters) {
			encounter.engaged.delete(characterId);
			encounter.weights.delete(characterId);
			for (const key of encounter.sources.keys()) {
				if (key.startsWith(`${characterId}:`)) encounter.sources.delete(key);
			}
			for (const key of encounter.supportWeights.keys()) {
				if (key.startsWith(`${characterId}:`)) encounter.supportWeights.delete(key);
			}
			for (const actionId of encounter.actions) {
				const action = this.actions.get(actionId);
				if (action?.characterId === characterId) this.actions.delete(actionId);
			}
			if (!encounter.engaged.size && !encounter.weights.size) this.close(encounterId);
		}
	}

	weightsForCharacter(encounterId, characterId) {
		const encounter = this.encounters.get(encounterId);
		if (!encounter) return {};
		const result = {};
		const skills = encounter.weights.get(characterId);
		if (skills) for (const [skill, weight] of skills) result[skill] = weight;
		return result;
	}

	partition(characterShare, encounterId, characterId) {
		return splitShare(characterShare, this.weightsForCharacter(encounterId, characterId));
	}

	partitionCharacterShares(encounterId, characterShares) {
		const result = {};
		for (const [characterId, characterShare] of Object.entries(characterShares || {})) {
			if (!Number.isSafeInteger(characterShare) || characterShare < 0)
				throw contributionError("Character share must be a non-negative safe integer");
			const split = this.partition(characterShare, encounterId, characterId);
			if (Object.keys(split).length) result[characterId] = split;
		}
		return result;
	}

	close(encounterId) {
		const encounter = this.encounters.get(encounterId);
		if (!encounter) return {};
		const output = {};
		for (const [characterId, skills] of encounter.weights) {
			output[characterId] = {};
			for (const [skill, weight] of skills) output[characterId][skill] = weight;
		}
		for (const actionId of encounter.actions) {
			const action = this.actions.get(actionId);
			if (!action) continue;
			action.encounterIds = action.encounterIds.filter((id) => id !== encounterId && this.encounters.has(id));
			if (!action.encounterIds.length) this.actions.delete(actionId);
		}
		this.encounters.delete(encounterId);
		return output;
	}

	prune(now = this.now()) {
		for (const [id, encounter] of this.encounters) if (now - encounter.lastActivity > this.closeAfterMs) this.close(id);
	}
}

module.exports = { ContributionLedger, splitShare, contributionError };
