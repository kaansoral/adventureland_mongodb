"use strict";

const { abilities } = require("../../design/abilities");

const STYLE_BOUND_ABILITY_IDS = new Set(
	Object.entries(abilities)
		.filter(([, definition]) => definition && definition.style_bound === true)
		.map(([abilityId]) => abilityId),
);

function effectSource(effect) {
	return effect && effect.source_character_id;
}

function tagStyleEffect(effect, { sourceCharacterId, sourceSkill, styleBound } = {}) {
	if (typeof styleBound !== "boolean") throw new TypeError("styleBound must be explicit");
	return {
		...effect,
		source_character_id: sourceCharacterId === undefined ? effect && effect.source_character_id : sourceCharacterId,
		source_skill: sourceSkill === undefined ? effect && effect.source_skill : sourceSkill,
		style_bound: Boolean(styleBound),
	};
}

function invalidateStyleEffects(effects, { sourceCharacterId, previousSkill } = {}) {
	const removed = [];
	const kept = [];
	for (const effect of effects || []) {
		const matchesCharacter = sourceCharacterId === undefined || effectSource(effect) === sourceCharacterId;
		const matchesSkill = previousSkill === undefined || effect.source_skill === previousSkill;
		if (effect.style_bound && matchesCharacter && matchesSkill) removed.push(effect);
		else kept.push(effect);
	}
	return { kept, removed };
}

function invalidateConditions(conditions, context) {
	const entries = Object.entries(conditions || {});
	const effects = entries.map(([name, value]) => ({ name, ...value }));
	const result = invalidateStyleEffects(effects, context);
	const next = {};
	for (const effect of result.kept) {
		const { name, ...value } = effect;
		next[name] = value;
	}
	return { conditions: next, removed: result.removed };
}

module.exports = { STYLE_BOUND_ABILITY_IDS, tagStyleEffect, invalidateStyleEffects, invalidateConditions };
