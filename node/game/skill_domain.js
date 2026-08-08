"use strict";

const crypto = require("node:crypto");
const { skills: DESIGN_SKILLS } = require("../../design/skills");
const { character: CHARACTER_DEFINITION } = require("../../design/character");
const { progression } = require("../../design/progression");

const SKILL_IDS = Object.freeze(Object.keys(DESIGN_SKILLS));
const SKILL_DEFINITIONS = DESIGN_SKILLS;
const COMBAT_SKILL_IDS = Object.freeze(
	SKILL_IDS.filter((id) => DESIGN_SKILLS[id] && DESIGN_SKILLS[id].kind === "combat"),
);
const MAX_LEVEL = progression.MAX_LEVEL;
const MAX_XP = progression.MAX_XP;
const STARTER_WEAPONS = Object.freeze([...(CHARACTER_DEFINITION.starter?.weapons || [])]);
const EXPECTED_BASELINE = Object.freeze({ ...(CHARACTER_DEFINITION.baseline || {}) });
const EQUIPPABLE_TYPES = new Set([
	"helmet",
	"pants",
	"chest",
	"weapon",
	"amulet",
	"earring",
	"shoes",
	"gloves",
	"ring",
	"shield",
	"belt",
	"source",
	"orb",
	"quiver",
	"cape",
	"misc_offhand",
	"tool",
]);
const NONCOMBAT_TOOL_TYPES = new Set(["rod", "pickaxe"]);
const VALIDATED_PUBLICATION = Symbol("validated progression publication");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function fail(code, message, details) {
	const error = new Error(message);
	error.code = code;
	if (details) Object.assign(error, details);
	return error;
}

function cumulativeXp(level) {
	if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
		throw fail("invalid_skill_level", `Skill level must be an integer from 1 to ${MAX_LEVEL}`, { level });
	}
	return Math.round(MAX_XP * Math.pow((level - 1) / (MAX_LEVEL - 1), 2));
}

function tierToRequiredLevel(tier) {
	const value = tier === undefined ? 1 : tier;
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw fail("invalid_item_tier", "Item tier must be a finite non-negative number", { tier });
	}
	if (value <= 1) return 1;
	if (value <= 1.25) return 10;
	if (value <= 1.5) return 20;
	if (value <= 1.75) return 30;
	if (value <= 2) return 40;
	if (value <= 2.25) return 50;
	if (value <= 2.5) return 60;
	if (value <= 2.75) return 70;
	if (value <= 3) return 80;
	if (value <= 3.5) return 90;
	return 95;
}

function buildWeaponOwners(registry) {
	const loadedCombatSkillIds = SKILL_IDS.filter((id) => registry[id] && registry[id].kind === "combat");
	if (loadedCombatSkillIds.length !== COMBAT_SKILL_IDS.length) {
		throw fail("invalid_skill_registry", "The loaded registry must contain exactly six combat skills", {
			combat_skills: loadedCombatSkillIds,
		});
	}
	const weaponOwners = new Map();
	for (const id of loadedCombatSkillIds) {
		for (const weaponType of registry[id].weapon_types || []) {
			if (NONCOMBAT_TOOL_TYPES.has(weaponType)) {
				throw fail("invalid_skill_registry", `Noncombat tool ${weaponType} cannot be a combat weapon`, {
					skill: id,
					weapon_type: weaponType,
				});
			}
			if (weaponOwners.has(weaponType)) {
				throw fail("invalid_skill_registry", `Weapon type ${weaponType} has multiple owners`, {
					weapon_type: weaponType,
					owners: [weaponOwners.get(weaponType), id],
				});
			}
			weaponOwners.set(weaponType, id);
		}
	}
	return weaponOwners;
}

function validateSkillRegistry(registry) {
	if (!registry || typeof registry !== "object")
		throw fail("invalid_skill_registry", "Skill registry must be an object");
	if (Object.keys(registry).join("\0") !== SKILL_IDS.join("\0")) {
		throw fail("invalid_skill_registry", "Skill registry order or IDs differ from the canonical registry", {
			actual: Object.keys(registry),
		});
	}
	for (const id of SKILL_IDS) {
		const definition = registry[id];
		const expected = SKILL_DEFINITIONS[id];
		const allowedKeys = new Set(["id", "name", "kind", "max_level"]);
		if (expected.weapon_types) allowedKeys.add("weapon_types");
		const unexpectedKeys = definition && Object.keys(definition).filter((key) => !allowedKeys.has(key));
		if (
			!definition ||
			unexpectedKeys.length ||
			definition.id !== id ||
			definition.name !== expected.name ||
			definition.kind !== expected.kind ||
			definition.max_level !== expected.max_level
		) {
			throw fail("invalid_skill_registry", `Invalid skill definition for ${id}`, {
				skill: id,
				unexpected_keys: unexpectedKeys,
			});
		}
		if (definition.kind === "combat" && (!Array.isArray(definition.weapon_types) || !definition.weapon_types.length)) {
			throw fail("invalid_skill_registry", `Combat skill ${id} has no weapon ownership`, { skill: id });
		}
		if (definition.kind === "noncombat" && definition.weapon_types) {
			throw fail("invalid_skill_registry", `Noncombat skill ${id} owns weapons`, { skill: id });
		}
	}
	const weaponOwners = buildWeaponOwners(registry);
	for (const id of SKILL_IDS) {
		if (JSON.stringify(registry[id].weapon_types || []) !== JSON.stringify(SKILL_DEFINITIONS[id].weapon_types || [])) {
			throw fail("invalid_skill_registry", `Weapon ownership differs from the canonical registry for ${id}`, {
				skill: id,
				weapon_types: registry[id].weapon_types,
			});
		}
	}
	return weaponOwners;
}

function validateXpTable(table) {
	if (!table || typeof table !== "object") throw fail("invalid_skill_xp", "Skill XP table must be an object");
	const keys = Object.keys(table);
	if (keys.length !== MAX_LEVEL || keys[0] !== "1" || keys[keys.length - 1] !== String(MAX_LEVEL)) {
		throw fail("invalid_skill_xp", "Skill XP table must contain levels 1 through 99");
	}
	let previous = -1;
	for (let level = 1; level <= MAX_LEVEL; level += 1) {
		const actual = table[level];
		const expected = cumulativeXp(level);
		if (!Number.isSafeInteger(actual) || actual !== expected || actual < previous) {
			throw fail("invalid_skill_xp", `Skill XP threshold mismatch at level ${level}`, { level, actual, expected });
		}
		previous = actual;
	}
	return table;
}

function validateRequirements(itemId, requirements, registry = null) {
	if (!Array.isArray(requirements) || requirements.length === 0) {
		throw fail("invalid_equipment_requirements", `Equippable item ${itemId} has no requirements`, { item: itemId });
	}
	const seen = new Set();
	let previousIndex = -1;
	for (const requirement of requirements) {
		if (
			!requirement ||
			typeof requirement.skill !== "string" ||
			!Number.isInteger(requirement.level) ||
			requirement.level < 1 ||
			requirement.level > MAX_LEVEL
		) {
			throw fail("invalid_equipment_requirements", `Malformed requirements for ${itemId}`, {
				item: itemId,
				requirement,
			});
		}
		const index = SKILL_IDS.indexOf(requirement.skill);
		if (index === -1 || (registry && !own(registry, requirement.skill))) {
			throw fail("invalid_equipment_requirements", `Unknown requirement skill ${requirement.skill} for ${itemId}`, {
				item: itemId,
				skill: requirement.skill,
			});
		}
		if (seen.has(requirement.skill) || index < previousIndex) {
			throw fail(
				"invalid_equipment_requirements",
				`Requirements for ${itemId} are duplicated or out of registry order`,
				{ item: itemId },
			);
		}
		seen.add(requirement.skill);
		previousIndex = index;
	}
	return requirements;
}

function validateAbilityCatalog(abilities, registry) {
	if (!abilities || typeof abilities !== "object")
		throw fail("invalid_ability_catalog", "Ability catalog must be an object");
	for (const [id, definition] of Object.entries(abilities)) {
		if (!definition || typeof definition !== "object")
			throw fail("invalid_ability_catalog", `Invalid ability ${id}`, { ability: id });
		if (own(definition, "class")) {
			throw fail("invalid_ability_catalog", `Legacy class ownership remains on ${id}`, { ability: id });
		}
		if (!["skill", "active_combat", "item", "system", "monster"].includes(definition.applicability)) {
			throw fail("invalid_ability_catalog", `Invalid applicability for ${id}`, { ability: id });
		}
		if (
			own(definition, "level") &&
			(!Number.isInteger(definition.level) || definition.level < 1 || definition.level > MAX_LEVEL)
		) {
			throw fail("invalid_ability_catalog", `Invalid level for ${id}`, { ability: id, level: definition.level });
		}
		if (own(definition, "skill") && definition.applicability !== "skill") {
			throw fail("invalid_ability_catalog", `Non-skill ability ${id} has a skill owner`, { ability: id });
		}
		if (definition.applicability === "skill") {
			if (
				!registry ||
				!own(registry, definition.skill) ||
				!Number.isInteger(definition.level) ||
				definition.level < 1 ||
				definition.level > MAX_LEVEL
			) {
				throw fail("invalid_ability_catalog", `Invalid skill gate for ${id}`, { ability: id });
			}
		}
		if (own(definition, "style_bound") && typeof definition.style_bound !== "boolean") {
			throw fail("invalid_ability_catalog", `Invalid style-bound metadata for ${id}`, { ability: id });
		}
		if (own(definition, "contribution")) {
			const contribution = definition.contribution;
			if (
				!contribution ||
				!Number.isSafeInteger(contribution.weight_per_use) ||
				contribution.weight_per_use <= 0 ||
				!Number.isSafeInteger(contribution.max_weight_per_target_per_encounter) ||
				contribution.max_weight_per_target_per_encounter < contribution.weight_per_use
			) {
				throw fail("invalid_ability_catalog", `Invalid contribution metadata for ${id}`, { ability: id });
			}
		}
	}
	return abilities;
}

function normalizeItems(items, itemRequirements) {
	if (!items || typeof items !== "object") throw fail("invalid_game_data", "Item catalog must be an object");
	if (!itemRequirements || typeof itemRequirements !== "object") {
		throw fail("invalid_game_data", "Item requirements must be an object");
	}
	const normalized = JSON.parse(JSON.stringify(items));
	for (const bookId of ["wbook0", "wbook1", "wbookhs"]) {
		if (!own(normalized, bookId)) throw fail("invalid_game_data", `Missing Priest book ${bookId}`, { item: bookId });
		normalized[bookId].type = "weapon";
		normalized[bookId].wtype = "book";
		normalized[bookId].damage_type = "magical";
		normalized[bookId].projectile = "pmagic";
		if (bookId === "wbookhs") {
			if (normalized[bookId].dex !== undefined) {
				normalized[bookId].int = normalized[bookId].dex;
				delete normalized[bookId].dex;
			}
			if (normalized[bookId].compound && normalized[bookId].compound.dex !== undefined) {
				normalized[bookId].compound.int = normalized[bookId].compound.dex;
				delete normalized[bookId].compound.dex;
			}
		}
	}
	for (const [itemId, requirements] of Object.entries(itemRequirements)) {
		if (!own(normalized, itemId))
			throw fail("invalid_game_data", `Requirements reference missing item ${itemId}`, { item: itemId });
		normalized[itemId].requirements = JSON.parse(JSON.stringify(requirements));
		delete normalized[itemId].class;
		for (const skillId of SKILL_IDS) delete normalized[itemId][skillId];
	}
	return normalized;
}

function validateItemRequirements(items, itemRequirements, registry, weaponOwners) {
	if (!items || typeof items !== "object") throw fail("invalid_game_data", "Item catalog must be an object");
	if (!itemRequirements || typeof itemRequirements !== "object") {
		throw fail("invalid_game_data", "Item requirements must be an object");
	}
	if (!(weaponOwners instanceof Map)) throw fail("invalid_skill_registry", "Weapon ownership index is missing");
	for (const [itemId, requirements] of Object.entries(itemRequirements)) {
		if (!own(items, itemId)) {
			throw fail("invalid_game_data", `Requirements reference missing item ${itemId}`, { item: itemId });
		}
		validateRequirements(itemId, requirements, registry);
		if (JSON.stringify(items[itemId].requirements) !== JSON.stringify(requirements)) {
			throw fail("invalid_game_data", `Item requirements differ from the normalized snapshot for ${itemId}`, {
				item: itemId,
			});
		}
		if (own(items[itemId], "class")) {
			throw fail("invalid_game_data", `Legacy class ownership remains on item ${itemId}`, { item: itemId });
		}
	}
	for (const bookId of ["wbook0", "wbook1", "wbookhs"]) {
		const book = items[bookId];
		if (
			!book ||
			book.type !== "weapon" ||
			book.wtype !== "book" ||
			book.damage_type !== "magical" ||
			book.projectile !== "pmagic" ||
			(bookId === "wbookhs" &&
				(book.int !== 16 ||
					book.dex !== undefined ||
					!book.compound ||
					book.compound.int !== 0 ||
					book.compound.dex !== undefined))
		) {
			throw fail("invalid_game_data", `Priest book ${bookId} is not a normalized main-hand weapon`, { item: bookId });
		}
	}
	if (
		!items.pmace ||
		items.pmace.type !== "weapon" ||
		items.pmace.wtype !== "pmace" ||
		items.pmace.name !== "Paladin's Hammer" ||
		items.pmace.skin !== "hammer" ||
		items.pmace.damage_type !== "physical" ||
		items.pmace.speed !== -2
	) {
		throw fail("invalid_game_data", "Paladin pmace presentation/profile is not normalized", { item: "pmace" });
	}
	for (const [itemId, item] of Object.entries(items)) {
		if (EQUIPPABLE_TYPES.has(item.type) && !own(itemRequirements, itemId)) {
			throw fail("invalid_game_data", `Equippable item ${itemId} is missing an explicit requirement`, { item: itemId });
		}
		if (NONCOMBAT_TOOL_TYPES.has(item.wtype)) {
			const requirements = itemRequirements[itemId];
			if (
				item.type !== "tool" ||
				requirements.length !== 1 ||
				requirements[0].skill !== "merchant" ||
				requirements[0].level !== 16
			) {
				throw fail("invalid_game_data", `Noncombat tool ${itemId} must require Merchant level 16`, { item: itemId });
			}
			continue;
		}
		if (item.type !== "weapon") continue;
		if (!weaponOwners.has(item.wtype)) {
			throw fail("invalid_game_data", `Weapon ${itemId} has an unowned weapon type ${item.wtype}`, {
				item: itemId,
				weapon_type: item.wtype,
			});
		}
		if (itemRequirements[itemId].length !== 1 || itemRequirements[itemId][0].skill !== weaponOwners.get(item.wtype)) {
			throw fail(
				"invalid_game_data",
				`Weapon ${itemId} does not have exactly its ${weaponOwners.get(item.wtype)} owner`,
				{
					item: itemId,
				},
			);
		}
	}
	return itemRequirements;
}

function validateCharacterDefinition(character, items) {
	if (!character || typeof character !== "object")
		throw fail("invalid_game_data", "Character definition must be an object");
	if (!Array.isArray(character.appearances) || character.appearances.length !== 28) {
		throw fail("invalid_game_data", "Character definition must contain the 28 canonical appearances", {
			appearances: character.appearances && character.appearances.length,
		});
	}
	for (const appearance of character.appearances) {
		if (
			!Array.isArray(appearance) ||
			appearance.length !== 2 ||
			typeof appearance[0] !== "string" ||
			!appearance[1] ||
			typeof appearance[1] !== "object" ||
			Array.isArray(appearance[1])
		) {
			throw fail("invalid_game_data", "Character appearance has an invalid shape", { appearance });
		}
	}
	if (
		crypto.createHash("sha256").update(JSON.stringify(character.appearances)).digest("hex") !==
		"3baf1e07aaaaa0a601981c3dd211721b396a3bc33ac967eb65839a9a46bb8880"
	) {
		throw fail("invalid_game_data", "Character appearances differ from the canonical snapshot");
	}
	const baselineFields = [
		"max_hp",
		"max_mp",
		"speed",
		"frequency",
		"inventory_size",
		"attack",
		"heal",
		"armor",
		"resistance",
		"str",
		"dex",
		"int",
		"vit",
	];
	if (!character.baseline || baselineFields.some((field) => !Number.isFinite(character.baseline[field]))) {
		throw fail("invalid_game_data", "Character baseline is incomplete");
	}
	if (JSON.stringify(character.baseline) !== JSON.stringify(EXPECTED_BASELINE)) {
		throw fail("invalid_game_data", "Character baseline differs from the neutral progression contract");
	}
	if (
		!character.skills ||
		Object.keys(character.skills).join("\0") !== SKILL_IDS.join("\0") ||
		Object.values(character.skills).some((skill) => !skill || skill.level !== 1 || skill.xp !== 0) ||
		character.total_level !== SKILL_IDS.length
	) {
		throw fail("invalid_game_data", "Character skill starter state differs from the neutral progression contract");
	}
	if (
		!character.starter ||
		!Array.isArray(character.starter.weapons) ||
		JSON.stringify(character.starter.weapons) !== JSON.stringify(STARTER_WEAPONS) ||
		!items ||
		STARTER_WEAPONS.some((itemId) => !own(items, itemId) || items[itemId].type !== "weapon") ||
		!Array.isArray(character.starter.consumables) ||
		JSON.stringify(character.starter.consumables) !==
			JSON.stringify([
				{ name: "hpot0", q: 200, gift: 1 },
				{ name: "mpot0", q: 200, gift: 1 },
			]) ||
		!Array.isArray(character.starter.equipment) ||
		JSON.stringify(character.starter.equipment) !==
			JSON.stringify([
				{ name: "helmet", level: 0, gift: 1 },
				{ name: "shoes", level: 0, gift: 1 },
			]) ||
		!character.starter.slots ||
		typeof character.starter.slots !== "object" ||
		Array.isArray(character.starter.slots) ||
		Object.keys(character.starter.slots).length !== 0
	) {
		throw fail("invalid_game_data", "Character starter definition is incomplete");
	}
	const starterItemTypes = { hpot0: "pot", mpot0: "pot", helmet: "helmet", shoes: "shoes" };
	for (const [itemId, type] of Object.entries(starterItemTypes)) {
		if (!items || !own(items, itemId) || items[itemId].type !== type) {
			throw fail("invalid_game_data", `Starter item ${itemId} is missing or has the wrong type`, {
				item: itemId,
				type,
			});
		}
	}
	return character;
}

function validateProgressionData(data) {
	if (!data || typeof data !== "object") throw fail("invalid_game_data", "Progression data must be an object");
	const weaponOwners = validateSkillRegistry(data.skills);
	validateXpTable(data.skill_xp);
	validateAbilityCatalog(data.abilities, data.skills);
	validateItemRequirements(data.items, data.item_requirements, data.skills, weaponOwners);
	validateCharacterDefinition(data.character, data.items);
	return data;
}

function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

function buildProgressionData(data) {
	if (!data || typeof data !== "object") throw fail("invalid_game_data", "Progression data must be an object");
	const normalized = {
		...data,
		items: normalizeItems(data.items, data.item_requirements),
		skills: JSON.parse(JSON.stringify(data.skills)),
		skill_xp: JSON.parse(JSON.stringify(data.skill_xp)),
		abilities: JSON.parse(JSON.stringify(data.abilities)),
		character: JSON.parse(JSON.stringify(data.character)),
		item_requirements: JSON.parse(JSON.stringify(data.item_requirements)),
	};
	validateProgressionData(normalized);
	Object.defineProperty(normalized, VALIDATED_PUBLICATION, { value: true });
	deepFreeze(normalized);
	return normalized;
}

function loadProgressionPublication(target, progressionData) {
	const next =
		progressionData && progressionData[VALIDATED_PUBLICATION] ? progressionData : buildProgressionData(progressionData);
	const publication = { ...target };
	delete publication.classes;
	delete publication.levels;
	return Object.assign(
		{ ...publication, protocol: 3 },
		{
			items: next.items,
			item_requirements: next.item_requirements,
			skills: next.skills,
			skill_xp: next.skill_xp,
			abilities: next.abilities,
			// The legacy runtime derives a small cosmetic cache during server initialization.
			// Keep that cache outside the frozen progression source while preserving the
			// canonical character definition underneath it.
			character: { ...next.character, xcx: [] },
		},
	);
}

module.exports = {
	SKILL_IDS,
	COMBAT_SKILL_IDS,
	STARTER_WEAPONS,
	EXPECTED_BASELINE,
	MAX_LEVEL,
	MAX_XP,
	cumulativeXp,
	tierToRequiredLevel,
	validateSkillRegistry,
	validateXpTable,
	validateRequirements,
	validateAbilityCatalog,
	validateItemRequirements,
	validateCharacterDefinition,
	validateProgressionData,
	normalizeItems,
	buildProgressionData,
	loadProgressionPublication,
	buildWeaponOwners,
};
