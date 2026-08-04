"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	COMBAT_SKILL_IDS,
	MAX_LEVEL,
	MAX_XP,
	SKILL_IDS,
	tierToRequiredLevel,
	validateAbilityCatalog,
	validateRequirements,
	validateSkillRegistry,
	validateXpTable,
} = require("../game/skill_domain");

const registry = {
	warrior: {
		id: "warrior",
		name: "Warrior",
		kind: "combat",
		max_level: 99,
		weapon_types: ["short_sword", "sword", "great_sword", "axe", "spear", "scythe"],
	},
	paladin: {
		id: "paladin",
		name: "Paladin",
		kind: "combat",
		max_level: 99,
		weapon_types: ["hammer", "mace", "pmace", "basher"],
	},
	mage: {
		id: "mage",
		name: "Mage",
		kind: "combat",
		max_level: 99,
		weapon_types: ["staff", "great_staff", "wand", "wblade"],
	},
	priest: { id: "priest", name: "Priest", kind: "combat", max_level: 99, weapon_types: ["book"] },
	ranger: {
		id: "ranger",
		name: "Ranger",
		kind: "combat",
		max_level: 99,
		weapon_types: ["bow", "crossbow", "dartgun"],
	},
	rogue: {
		id: "rogue",
		name: "Rogue",
		kind: "combat",
		max_level: 99,
		weapon_types: ["fist", "dagger", "rapier", "stars"],
	},
	merchant: { id: "merchant", name: "Merchant", kind: "noncombat", max_level: 99 },
};
const expectedXp = (level) => Math.round(900000000 * Math.pow((level - 1) / 98, 2));

test("canonical skill registry is seven ordered skills with six combat tracks", () => {
	assert.deepEqual(SKILL_IDS, ["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"]);
	assert.deepEqual(COMBAT_SKILL_IDS, SKILL_IDS.slice(0, 6));
	assert.equal(MAX_LEVEL, 99);
	assert.equal(MAX_XP, 900000000);
	assert.doesNotThrow(() => validateSkillRegistry(registry));
});

test("quadratic XP curve matches every cumulative threshold and milestones", () => {
	const table = Object.fromEntries(Array.from({ length: 99 }, (_, index) => [index + 1, expectedXp(index + 1)]));
	assert.doesNotThrow(() => validateXpTable(table));
	for (let level = 1; level <= 99; level += 1) assert.equal(table[level], expectedXp(level));
	assert.equal(table[1], 0);
	assert.equal(table[20], 33829654);
	assert.equal(table[40], 142534361);
	assert.equal(table[60], 326207830);
	assert.equal(table[80], 584850062);
	assert.equal(table[90], 742284465);
	assert.equal(table[99], 900000000);
});

test("tier boundaries are deterministic and ignore upgrade levels", () => {
	const expected = new Map([
		[1, 1],
		[1.01, 10],
		[1.25, 10],
		[1.26, 20],
		[1.5, 20],
		[1.51, 30],
		[1.75, 30],
		[1.76, 40],
		[2, 40],
		[2.01, 50],
		[2.25, 50],
		[2.26, 60],
		[2.5, 60],
		[2.75, 70],
		[2.76, 80],
		[3, 80],
		[3.01, 90],
		[3.5, 90],
		[3.51, 95],
	]);
	for (const [tier, level] of expected) assert.equal(tierToRequiredLevel(tier), level, `tier ${tier}`);
	assert.equal(tierToRequiredLevel(undefined), 1);
	assert.throws(() => tierToRequiredLevel(-1), { code: "invalid_item_tier" });
	assert.throws(() => tierToRequiredLevel(Number.NaN), { code: "invalid_item_tier" });
});

test("requirements and ability gates fail closed", () => {
	assert.throws(
		() => validateRequirements("broken", []),
		(error) => error.code === "invalid_equipment_requirements" && error.item === "broken",
	);
	assert.throws(() => validateRequirements("broken", [{ skill: "unknown", level: 1 }], registry), {
		code: "invalid_equipment_requirements",
	});
	assert.throws(() => validateRequirements("broken", [{ skill: "warrior", level: 0 }], registry), {
		code: "invalid_equipment_requirements",
	});
	for (const level of [-1, 1.5, Number.NaN, 100]) {
		assert.throws(
			() => validateRequirements("bad_level", [{ skill: "warrior", level }], registry),
			(error) =>
				error.code === "invalid_equipment_requirements" &&
				error.item === "bad_level" &&
				(Number.isNaN(level) ? Number.isNaN(error.requirement.level) : error.requirement.level === level),
		);
	}
	assert.throws(() => validateSkillRegistry({ ...registry, merchant: { ...registry.merchant, weapon_types: [] } }), {
		code: "invalid_skill_registry",
	});
	assert.throws(
		() => validateSkillRegistry({ ...registry, paladin: { ...registry.paladin, weapon_types: ["short_sword"] } }),
		(error) => error.code === "invalid_skill_registry" && error.weapon_type === "short_sword",
	);
	assert.throws(
		() =>
			validateRequirements(
				"broken",
				[
					{ skill: "paladin", level: 1 },
					{ skill: "warrior", level: 1 },
				],
				registry,
			),
		{ code: "invalid_equipment_requirements" },
	);
	assert.throws(
		() =>
			validateRequirements(
				"broken",
				[
					{ skill: "warrior", level: 1 },
					{ skill: "warrior", level: 2 },
				],
				registry,
			),
		{ code: "invalid_equipment_requirements" },
	);
	assert.throws(
		() =>
			validateXpTable({
				...Object.fromEntries(Array.from({ length: 99 }, (_, index) => [index + 1, expectedXp(index + 1)])),
				99: 1,
			}),
		(error) =>
			error.code === "invalid_skill_xp" && error.level === 99 && error.actual === 1 && error.expected === 900000000,
	);
	assert.throws(
		() => validateAbilityCatalog({ heal: { applicability: "skill", skill: "unknown", level: 1 } }, registry),
		{ code: "invalid_ability_catalog" },
	);
	assert.throws(
		() => validateAbilityCatalog({ heal: { applicability: "skill", skill: "warrior", level: 1.5 } }, registry),
		{ code: "invalid_ability_catalog" },
	);
	assert.throws(
		() => validateAbilityCatalog({ heal: { applicability: "skill", skill: "warrior", level: 100 } }, registry),
		{ code: "invalid_ability_catalog" },
	);
	for (const level of [-1, Number.NaN]) {
		assert.throws(
			() => validateAbilityCatalog({ bad_ability: { applicability: "skill", skill: "warrior", level } }, registry),
			(error) =>
				error.code === "invalid_ability_catalog" &&
				error.ability === "bad_ability" &&
				(Number.isNaN(level) ? Number.isNaN(error.level) : error.level === level),
		);
	}
	const inheritedRegistry = Object.create({ toString: { id: "toString" } });
	assert.throws(
		() => validateAbilityCatalog({ heal: { applicability: "skill", skill: "toString", level: 1 } }, inheritedRegistry),
		{ code: "invalid_ability_catalog" },
	);
	assert.throws(() => validateAbilityCatalog({ heal: { applicability: "system", class: ["warrior"] } }, registry), {
		code: "invalid_ability_catalog",
	});
});
