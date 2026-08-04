"use strict";

const { invalidateConditions } = require("./style_effects");

const PROTECTED_FIELDS = new Set(["socket", "character", "last", "t", "p"]);

function clone(value) {
	return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function copyProgressionEffect(source, target) {
	if (!Object.prototype.hasOwnProperty.call(source, "progression_style_effect")) return;
	Object.defineProperty(target, "progression_style_effect", {
		configurable: true,
		enumerable: false,
		value: source.progression_style_effect,
		writable: true,
	});
}

function sourceEffectInvalidations({ player, previousSkill, nextSkill, targets = [] }) {
	if (previousSkill === nextSkill) return [];
	const sourceCharacterId = player.id || player.name;
	const candidates = [player, ...targets];
	const seen = new Set();
	return candidates.reduce((changes, target) => {
		if (!target || seen.has(target) || !target.s) return changes;
		seen.add(target);
		const result = invalidateConditions(target.s, { sourceCharacterId, previousSkill });
		const progressionEffect = target.progression_style_effect;
		const clearsProgressionEffect =
			progressionEffect &&
			progressionEffect.source_character_id === sourceCharacterId &&
			progressionEffect.source_skill === previousSkill;
		if (result.removed.length || clearsProgressionEffect) {
			changes.push({
				target,
				conditions: result.conditions,
				clearsProgressionEffect: Boolean(clearsProgressionEffect),
				previousTarget: clearsProgressionEffect && target.target,
			});
		}
		return changes;
	}, []);
}

function applyEquipmentTransaction({
	player,
	transaction,
	previousSkill,
	targets = [],
	cacheItem,
	calculatePlayerStats,
	calculateMonsterStats,
	getPlayerByName,
	reduceTargets,
	resend,
}) {
	if (typeof cacheItem !== "function") throw new TypeError("cacheItem callback is required");
	if (typeof calculatePlayerStats !== "function") throw new TypeError("calculatePlayerStats callback is required");
	if (typeof calculateMonsterStats !== "function") throw new TypeError("calculateMonsterStats callback is required");
	if (typeof getPlayerByName !== "function") throw new TypeError("getPlayerByName callback is required");
	if (typeof reduceTargets !== "function") throw new TypeError("reduceTargets callback is required");
	if (typeof resend !== "function") throw new TypeError("resend callback is required");

	const invalidation = sourceEffectInvalidations({
		player,
		previousSkill,
		nextSkill: transaction.active_skill,
		targets,
	});
	const selfInvalidation = invalidation.find((entry) => entry.target === player);
	const candidate = {
		...player,
		slots: transaction.slots,
		items: transaction.items,
		s: clone(selfInvalidation ? selfInvalidation.conditions : player.s || {}),
		cslots: {},
		citems: [],
	};
	copyProgressionEffect(player, candidate);
	if (selfInvalidation && selfInvalidation.clearsProgressionEffect) candidate.progression_style_effect = null;
	for (const [slot, equipped] of Object.entries(candidate.slots)) candidate.cslots[slot] = cacheItem(equipped);
	candidate.citems = candidate.items.map((entry) => cacheItem(entry));
	calculatePlayerStats(candidate);
	const projections = [{ target: player, candidate, self: true, ...selfInvalidation }];

	for (const change of invalidation) {
		if (change.target === player) continue;
		const remoteCandidate = {
			...change.target,
			s: clone(change.conditions),
		};
		copyProgressionEffect(change.target, remoteCandidate);
		if (change.clearsProgressionEffect) {
			remoteCandidate.progression_style_effect = null;
			if (change.target.is_monster) remoteCandidate.target = null;
		}
		if (change.target.is_monster) calculateMonsterStats(remoteCandidate);
		else calculatePlayerStats(remoteCandidate);
		projections.push({ target: change.target, candidate: remoteCandidate, self: false, ...change });
	}

	// Candidate calculation must finish before any authoritative object is changed.
	for (const { target, candidate: projection } of projections) {
		for (const [key, value] of Object.entries(projection)) {
			if (
				Object.prototype.hasOwnProperty.call(target, key) &&
				!PROTECTED_FIELDS.has(key) &&
				!Object.is(value, target[key])
			) {
				target[key] = value;
			}
		}
		if (Object.prototype.hasOwnProperty.call(projection, "progression_style_effect")) {
			if (projection.progression_style_effect === null) delete target.progression_style_effect;
			else copyProgressionEffect(projection, target);
		}
	}

	for (const { target, self, clearsProgressionEffect, previousTarget } of projections) {
		if (self) continue;
		if (target.is_monster && clearsProgressionEffect) {
			if (previousTarget) {
				const previousPlayer = getPlayerByName(previousTarget);
				if (previousPlayer) reduceTargets(previousPlayer, target);
			}
			target.u = true;
			target.cid++;
		}
		if (target.socket && typeof target.socket.emit === "function") resend(target, "u+cid");
		else target.to_resend = "u+cid";
	}
	return transaction;
}

module.exports = { applyEquipmentTransaction, sourceEffectInvalidations };
