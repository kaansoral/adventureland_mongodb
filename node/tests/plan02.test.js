"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCharacterState, validateSkillState, projectPersistenceState } = require("../game/character_state");
const { WEAPON_PROFILES, deriveActiveSkill, weaponProfile } = require("../game/active_skill");
const { planEquipmentTransaction, planUnequipTransaction } = require("../game/equipment");
const { authorizeAbility } = require("../game/ability_access");
const { STYLE_BOUND_ABILITY_IDS, tagStyleEffect, invalidateStyleEffects } = require("../game/style_effects");
const { calculateStats } = require("../game/stats");

const skills = createCharacterState().skills;

function item(type, wtype, props = {}) {
	return { type, ...(wtype ? { wtype } : {}), ...props };
}

const items = {
	blade: item("weapon", "short_sword", { attack: 12, str: 36 }),
	mace: item("weapon", "mace", { attack: 12, str: 28, int: 30 }),
	staff: item("weapon", "staff", { attack: 15, int: 40 }),
	wbook0: item("weapon", "book", { attack: 11, int: 34 }),
	bow: item("weapon", "bow", { attack: 12, dex: 39 }),
	claw: item("weapon", "fist", { attack: 11, dex: 30 }),
	greatsword: item("weapon", "great_sword", { attack: 30 }),
	shield: item("shield", null, { armor: 10 }),
	rod: item("tool", "rod"),
	pickaxe: item("tool", "pickaxe"),
	helmet: item("helmet", null, { armor: 5 }),
};

const requirements = Object.fromEntries(
	Object.keys(items).map((id) => [
		id,
		[{ skill: id === "rod" || id === "pickaxe" ? "merchant" : "warrior", level: 1 }],
	]),
);
requirements.mace = [
	{ skill: "warrior", level: 1 },
	{ skill: "paladin", level: 2 },
];
requirements.greatsword = [{ skill: "warrior", level: 1 }];
requirements.shield = [{ skill: "paladin", level: 1 }];

test("character state is complete, ordered, derived, and rejects legacy shape", () => {
	const fresh = createCharacterState();
	assert.deepEqual(Object.keys(fresh.skills), ["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"]);
	assert.equal(fresh.total_level, 7);
	assert.deepEqual(projectPersistenceState(fresh), { info: { skills: fresh.skills }, total_level: 7 });
	assert.throws(
		() => validateSkillState({ warrior: { level: 1, xp: 0 } }),
		(error) => error.code === "invalid_character_skill_state",
	);
	assert.throws(
		() => validateSkillState({ ...fresh.skills, warrior: { level: 2, xp: 0 } }),
		(error) => error.code === "invalid_character_skill_state",
	);
	assert.throws(
		() => validateSkillState({ ...fresh.skills, rogue: { level: 1, xp: 0 }, old: { level: 1, xp: 0 } }),
		(error) => error.code === "invalid_character_skill_state",
	);
	const all99 = Object.fromEntries(Object.keys(fresh.skills).map((skill) => [skill, { level: 99, xp: 900000000 }]));
	assert.equal(Object.values(all99).reduce((sum, progress) => sum + progress.level, 0), 693);
	assert.doesNotThrow(() => validateSkillState(all99));
	const future = createCharacterState([...Object.keys(fresh.skills), "artisan"]);
	future.skills.artisan = { level: 4, xp: 1000000 };
	assert.equal(
		Object.values(future.skills).reduce((sum, progress) => sum + progress.level, 0),
		fresh.total_level + 4,
	);
});

test("active skill maps every combat profile and excludes tools and empty hands", () => {
	for (const [wtype, profile] of Object.entries(WEAPON_PROFILES)) {
		assert.equal(deriveActiveSkill({ mainhand: { name: wtype } }, { [wtype]: item("weapon", wtype) }), profile.skill);
	}
	assert.equal(deriveActiveSkill({ mainhand: { name: "rod" } }, items), null);
	assert.equal(deriveActiveSkill({ mainhand: { name: "pickaxe" } }, items), null);
	assert.equal(deriveActiveSkill({}, items), null);
	assert.equal(
		deriveActiveSkill({ mainhand: { name: "blade", wtype: "staff", type: "weapon" } }, items),
		"warrior",
	);
	assert.equal(deriveActiveSkill({ mainhand: { name: "blade", wtype: "unknown" } }, items), "warrior");
	assert.equal(weaponProfile(items.blade).skill, "warrior");
});

test("equipment validates all requirements and atomically displaces incompatible offhand", () => {
	const advanced = structuredClone(skills);
	advanced.paladin.level = 2;
	const transaction = planEquipmentTransaction({
		player: {
			slots: { mainhand: { name: "blade" }, offhand: { name: "shield" } },
			items: [{ name: "greatsword" }, null],
		},
		item: { name: "greatsword" },
		itemIndex: 0,
		slot: "mainhand",
		items,
		itemRequirements: requirements,
		skills: advanced,
	});
	assert.equal(transaction.slots.mainhand.name, "greatsword");
	assert.equal(transaction.slots.offhand, null);
	assert.deepEqual(
		transaction.items
			.filter(Boolean)
			.map((entry) => entry.name)
			.sort(),
		["blade", "shield"],
	);
	assert.equal(transaction.active_skill, "warrior");
	assert.throws(
		() =>
			planEquipmentTransaction({
				player: { slots: {}, items: [{ name: "mace" }] },
				item: { name: "mace" },
				itemIndex: 0,
				items,
				itemRequirements: requirements,
				skills,
			}),
		(error) => error.code === "skill_level_required" && error.skill === "paladin",
	);
	assert.throws(
		() =>
			planEquipmentTransaction({
				player: { slots: {}, items: [{ name: "blade" }] },
				item: { name: "mace" },
				itemIndex: 0,
				items,
				itemRequirements: requirements,
				skills: advanced,
			}),
		(error) => error.code === "inventory_item_changed",
	);
	assert.throws(
		() =>
			planEquipmentTransaction({
				player: { slots: {}, items: [{ name: "blade", stat_type: "str" }] },
				item: { name: "blade", stat_type: "dex" },
				itemIndex: 0,
				items,
				itemRequirements: requirements,
				skills: advanced,
			}),
		(error) => error.code === "inventory_item_changed",
	);
	const serverOnlyMutation = planEquipmentTransaction({
		player: { slots: {}, items: [{ name: "blade", grace: 1, rid: "server-id" }] },
		item: { name: "blade", grace: 9, rid: "different-server-id" },
		itemIndex: 0,
		items,
		itemRequirements: requirements,
		skills: advanced,
	});
	assert.equal(serverOnlyMutation.slots.mainhand.name, "blade");
	assert.throws(
		() =>
			planEquipmentTransaction({
				player: { slots: {}, items: [{ name: "shield", q: 2 }] },
				item: { name: "shield", q: 1 },
				itemIndex: 0,
				items,
				itemRequirements: requirements,
				skills: advanced,
			}),
		(error) => error.code === "inventory_item_changed",
	);
	const shieldOnly = planEquipmentTransaction({
		player: { slots: {}, items: [{ name: "shield" }] },
		item: { name: "shield" },
		itemIndex: 0,
		items,
		itemRequirements: requirements,
		skills: advanced,
	});
	assert.equal(shieldOnly.active_skill, null);
	assert.equal(shieldOnly.slots.offhand.name, "shield");
	assert.throws(
		() =>
			planEquipmentTransaction({
				player: { slots: {}, items: [{ name: "helmet" }] },
				item: { name: "helmet" },
				itemIndex: 0,
				slot: "offhand",
				items,
				itemRequirements: requirements,
				skills: advanced,
			}),
		(error) => error.code === "incompatible_offhand",
	);
	assert.throws(
		() =>
			planEquipmentTransaction({
				player: { slots: {}, items: [{ name: "claw" }] },
				item: { name: "claw" },
				itemIndex: 0,
				slot: "offhand",
				items,
				itemRequirements: requirements,
				skills: advanced,
			}),
		(error) => error.code === "incompatible_offhand" && error.mainhand === null,
	);
	const unequipped = planUnequipTransaction({
		player: { slots: { mainhand: { name: "blade" }, offhand: { name: "shield" } }, items: [null, null] },
		slot: "mainhand",
		items,
		profiles: WEAPON_PROFILES,
	});
	assert.equal(unequipped.active_skill, null);
	assert.equal(unequipped.slots.offhand.name, "shield");
	assert.deepEqual(unequipped.items.filter(Boolean).map((entry) => entry.name), ["blade"]);
});

test("ability access is active-style aware, preserves cooldown state, and permits Merchant utilities", () => {
	const character = { skills };
	assert.throws(
		() =>
			authorizeAbility({
				abilityId: "attack",
				ability: { applicability: "active_combat" },
				character,
				slots: {},
				items,
			}),
		(error) => error.code === "no_active_skill",
	);
	assert.throws(
		() =>
			authorizeAbility({
				abilityId: "smash",
				ability: { applicability: "skill", skill: "warrior", level: 1 },
				character,
				slots: { mainhand: { name: "mace" } },
				items,
				activeSkill: "paladin",
			}),
		(error) => error.code === "wrong_active_skill",
	);
	assert.equal(
		authorizeAbility({
			abilityId: "fish",
			ability: { applicability: "skill", skill: "merchant", level: 1 },
			character,
			activeSkill: "warrior",
		}).authorized,
		true,
	);
	assert.throws(
		() =>
			authorizeAbility({
				abilityId: "attack",
				ability: { applicability: "active_combat" },
				character,
				activeSkill: "warrior",
				standOpen: true,
			}),
		(error) => error.code === "stand_open",
	);
	assert.throws(
		() =>
			authorizeAbility({
				abilityId: "attack",
				ability: { applicability: "active_combat" },
				character,
				slots: { mainhand: { name: "blade" } },
				items,
				now: 100,
				lastUse: 90,
				cooldown: 20,
			}),
		(error) => error.code === "ability_on_cooldown",
	);
	assert.throws(
		() =>
			authorizeAbility({
				abilityId: "attack",
				ability: { applicability: "active_combat" },
				character,
				slots: {},
				items,
				activeSkill: "warrior",
			}),
		(error) => error.code === "no_active_skill",
	);
});

test("style-bound effects are tagged and invalidated idempotently", () => {
	const effect = tagStyleEffect({ name: "warcry" }, { sourceCharacterId: "CH1", sourceSkill: "warrior", styleBound: true });
	const result = invalidateStyleEffects(
		[effect, { name: "poison", style_bound: false, source_character_id: "CH1", source_skill: "warrior" }],
		{ sourceCharacterId: "CH1", previousSkill: "warrior" },
	);
	assert.deepEqual(
		result.removed.map((entry) => entry.name),
		["warcry"],
	);
	assert.deepEqual(
		result.kept.map((entry) => entry.name),
		["poison"],
	);
	assert.equal(
		invalidateStyleEffects(result.kept, { sourceCharacterId: "CH1", previousSkill: "warrior" }).removed.length,
		0,
	);
	assert.deepEqual(
		[...STYLE_BOUND_ABILITY_IDS].sort(),
		[
			"absorb",
			"charge",
			"darkblessing",
			"energize",
			"hardshell",
			"invis",
			"mshield",
			"pcoat",
			"phaseout",
			"reflection",
			"rspeed",
			"warcry",
		].sort(),
	);
});

test("gear-only stats match the six starter golden inputs and ignore skill level", () => {
	const expected = {
		blade: ["warrior", 22, 856, 100, 0],
		mace: ["paladin", 26, 688, 550, 0],
		staff: ["mage", 30, 100, 700, 0],
		wbook0: ["priest", 30, 100, 610, 30],
		bow: ["ranger", 23, 100, 100, 0],
		claw: ["rogue", 17, 100, 100, 0],
	};
	for (const [id, [skill, attack, hp, mp, heal]] of Object.entries(expected)) {
		const result = calculateStats({ slots: { mainhand: { name: id } }, items });
		assert.equal(result.attack, attack, id);
		assert.equal(result.max_hp, hp, id);
		assert.equal(result.max_mp, mp, id);
		assert.equal(result.heal, heal, id);
		assert.equal(result.damage_type, WEAPON_PROFILES[items[id].wtype].damage_type, id);
		assert.equal(skill, WEAPON_PROFILES[items[id].wtype].skill);
		assert.equal(result.frequency, calculateStats({ slots: { mainhand: { name: id } }, items, conditions: {} }).frequency);
		const higher = calculateStats({
			slots: { mainhand: { name: id } },
			items,
			conditions: {},
			previousHp: 1,
			previousMp: 1,
		});
		assert.equal(higher.attack, attack, `${id} skill-independent`);
		assert.deepEqual(
			calculateStats({
				slots: { mainhand: { name: id } },
				items,
				skills: { warrior: { level: 99 } },
				characterType: "legacy",
				appearance: "alternate",
				achievements: { attack: 999999 },
			}),
			calculateStats({ slots: { mainhand: { name: id } }, items }),
		);
	}
	const noWeapon = calculateStats({ slots: {}, items });
	assert.equal(noWeapon.attack, 0);
	assert.equal(noWeapon.heal, 0);
	assert.equal(noWeapon.range, 0);
	assert.equal(noWeapon.damage_type, null);
	const sick = calculateStats({ slots: { mainhand: { name: "blade" } }, items, deathSickness: true });
	assert.equal(sick.attack, 17);
	assert.equal(sick.max_hp, 685);
});
