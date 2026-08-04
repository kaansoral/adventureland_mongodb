"use strict";

const { COMBAT_SKILL_IDS } = require("./skill_domain");
const { deriveActiveSkill } = require("./active_skill");

function accessError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function abilityLevel(character, skill) {
	return character && character.skills && character.skills[skill] ? character.skills[skill].level : 0;
}

function authorizeAbility({
	ability,
	abilityId,
	character = {},
	slots,
	items,
	activeSkill,
	standOpen = false,
	itemGate = null,
	now = Date.now(),
	lastUse = null,
	cooldown = 0,
}) {
	const definition = typeof ability === "object" ? ability : null;
	const name = abilityId || (definition && definition.name) || "unknown";
	if (!definition) throw accessError("unknown_ability", `Unknown ability ${name}`, { ability: name });
	const currentSkill = activeSkill === undefined ? deriveActiveSkill(slots, items) : activeSkill;
	if (standOpen && (definition.applicability === "active_combat" || (definition.applicability === "skill" && COMBAT_SKILL_IDS.includes(definition.skill)))) {
		throw accessError("stand_open", "Combat is unavailable while the trading stand is open", { action: name });
	}
	if (definition.applicability === "active_combat") {
		if (!currentSkill) throw accessError("no_active_skill", "A combat weapon is required", { ability: name });
	} else if (definition.applicability === "skill" && COMBAT_SKILL_IDS.includes(definition.skill) && currentSkill !== definition.skill) {
		throw accessError("wrong_active_skill", "The equipped weapon does not own this ability", {
			ability: name,
			required: definition.skill,
			actual: currentSkill,
		});
	}
	if (definition.applicability === "skill") {
		const actual = abilityLevel(character, definition.skill);
		if (actual < (definition.level || 1)) {
			throw accessError("skill_level_required", "The ability skill level is too low", {
				ability: name,
				skill: definition.skill,
				required: definition.level || 1,
				actual,
			});
		}
	}
	if (itemGate && !itemGate({ definition, character, slots, items })) {
		throw accessError("ability_item_required", "The ability item gate failed", { ability: name });
	}
	if (cooldown && lastUse && now - lastUse < cooldown) {
		throw accessError("ability_on_cooldown", "The ability is cooling down", { ability: name, ms: cooldown - (now - lastUse) });
	}
	return { ability: name, active_skill: currentSkill, skill: definition.skill || currentSkill, authorized: true };
}

module.exports = { authorizeAbility, accessError };
