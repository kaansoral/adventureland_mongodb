"use strict";

const { COMBAT_SKILL_IDS } = require("./skill_domain");

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
	constructor({ now = () => Date.now(), closeAfterMs = 300000 } = {}) {
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

	_add(encounterId, characterId, skill, weight, actionId) {
		if (!weight || weight <= 0) return 0;
		const encounter = this.openEncounter(encounterId);
		const key = `${characterId}:${skill}`;
		if (actionId && encounter.recordedActions.has(key + ":" + actionId)) return 0;
		if (actionId) encounter.recordedActions.add(key + ":" + actionId);
		const characterWeights = encounter.weights.get(characterId) || new Map();
		characterWeights.set(skill, (characterWeights.get(skill) || 0) + weight);
		encounter.weights.set(characterId, characterWeights);
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
		return ids.reduce((total, id) => total + this._add(id, characterId, action.activeSkill, perEncounter, actionId), 0);
	}

	recordSupport({
		actionId,
		characterId,
		activeSkill,
		encounterIds = [],
		changed = false,
		weightPerUse = 1,
		maxWeightPerTargetPerEncounter = 10,
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
			const added = this._add(encounterId, characterId, action.activeSkill, accepted, actionId);
			if (added) {
				encounter.supportWeights.set(key, current + added);
				recorded += added;
			}
		}
		return recorded;
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
