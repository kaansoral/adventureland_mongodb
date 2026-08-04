"use strict";

const { COMBAT_SKILL_IDS } = require("./skill_domain");

const freeze = (value) => Object.freeze(value);

const WEAPON_PROFILES = freeze({
	short_sword: freeze({ skill: "warrior", hands: 1, offhand_weapon: true, allowed_offhands: freeze(["shield", "misc_offhand"]), range: 18, projectile: "momentum", damage_type: "physical", frequency: 0.5, mp_cost: 1 }),
	sword: freeze({ skill: "warrior", hands: 1, offhand_weapon: true, allowed_offhands: freeze(["shield", "misc_offhand"]), range: 18, projectile: "momentum", damage_type: "physical", frequency: 0.5, mp_cost: 1, speed: -5 }),
	great_sword: freeze({ skill: "warrior", hands: 2, offhand_weapon: false, allowed_offhands: freeze([]), range: 18, projectile: "momentum", damage_type: "physical", frequency: 0.5, mp_cost: 1, frequency_modifier: -8, mp_cost_modifier: 6, speed: -5 }),
	axe: freeze({ skill: "warrior", hands: 2, offhand_weapon: false, allowed_offhands: freeze([]), range: 18, projectile: "momentum", damage_type: "physical", frequency: 0.5, mp_cost: 1, frequency_modifier: -10, mp_cost_modifier: 6, speed: -7 }),
	spear: freeze({ skill: "warrior", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["shield", "misc_offhand"]), range: 18, projectile: "momentum", damage_type: "physical", frequency: 0.5, mp_cost: 1, speed: -2 }),
	scythe: freeze({ skill: "warrior", hands: 2, offhand_weapon: false, allowed_offhands: freeze([]), range: 18, projectile: "momentum", damage_type: "physical", frequency: 0.5, mp_cost: 1, frequency_modifier: -11, mp_cost_modifier: 8, speed: -6 }),
	hammer: freeze({ skill: "paladin", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["shield", "source", "misc_offhand"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2, speed: -2 }),
	mace: freeze({ skill: "paladin", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["shield", "source", "misc_offhand"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2 }),
	pmace: freeze({ skill: "paladin", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["shield", "source", "misc_offhand"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2, speed: -2 }),
	basher: freeze({ skill: "paladin", hands: 2, offhand_weapon: false, allowed_offhands: freeze([]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2, frequency_modifier: -12, mp_cost_modifier: 12, speed: -12 }),
	staff: freeze({ skill: "mage", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["source", "misc_offhand"]), range: 120, projectile: "magic", damage_type: "magical", frequency: 0.35, mp_cost: 5, speed: -4 }),
	great_staff: freeze({ skill: "mage", hands: 2, offhand_weapon: false, allowed_offhands: freeze([]), range: 120, projectile: "magic", damage_type: "magical", frequency: 0.35, mp_cost: 5, frequency_modifier: -10, mp_cost_modifier: 160, speed: -12 }),
	wand: freeze({ skill: "mage", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["source", "misc_offhand"]), range: 120, projectile: "magic", damage_type: "magical", frequency: 0.35, mp_cost: 5, frequency_modifier: 60, mp_cost_modifier: -18 }),
	wblade: freeze({ skill: "mage", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["source", "misc_offhand"]), range: 120, projectile: "magic", damage_type: "magical", frequency: 0.35, mp_cost: 5, speed: -5 }),
	book: freeze({ skill: "priest", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["shield", "source", "misc_offhand"]), range: 120, projectile: "pmagic", damage_type: "magical", frequency: 0.35, mp_cost: 5 }),
	bow: freeze({ skill: "ranger", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["quiver"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2, speed: -3 }),
	crossbow: freeze({ skill: "ranger", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["quiver"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2, apiercing: 120, frequency_modifier: -36 }),
	dartgun: freeze({ skill: "ranger", hands: 1, offhand_weapon: false, allowed_offhands: freeze(["quiver"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.4, mp_cost: 2 }),
	fist: freeze({ skill: "rogue", hands: 1, offhand_weapon: true, allowed_offhands: freeze(["misc_offhand"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.45, mp_cost: 1 }),
	dagger: freeze({ skill: "rogue", hands: 1, offhand_weapon: true, allowed_offhands: freeze(["misc_offhand"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.45, mp_cost: 1 }),
	stars: freeze({ skill: "rogue", hands: 1, offhand_weapon: true, allowed_offhands: freeze(["misc_offhand"]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.45, mp_cost: 1, frequency_modifier: 20 }),
	rapier: freeze({ skill: "rogue", hands: 2, offhand_weapon: false, allowed_offhands: freeze([]), range: 15, projectile: "momentum", damage_type: "physical", frequency: 0.45, mp_cost: 1, frequency_modifier: 70 }),
});

const NONCOMBAT_TOOLS = freeze(["rod", "pickaxe"]);

function activeSkillFromItem(item, weaponProfiles = WEAPON_PROFILES) {
	if (!item || item.type !== "weapon") return null;
	const profile = weaponProfiles[item.wtype];
	if (!profile || !COMBAT_SKILL_IDS.includes(profile.skill)) return null;
	return profile.skill;
}

function deriveActiveSkill(slots, items, weaponProfiles = WEAPON_PROFILES) {
	const mainhand = slots && slots.mainhand;
	if (!mainhand || !items || !items[mainhand.name]) return null;
	return activeSkillFromItem({ ...items[mainhand.name], ...mainhand }, weaponProfiles);
}

function weaponProfile(item, weaponProfiles = WEAPON_PROFILES) {
	if (!item) return null;
	return weaponProfiles[item.wtype] || null;
}

module.exports = { WEAPON_PROFILES, NONCOMBAT_TOOLS, activeSkillFromItem, deriveActiveSkill, weaponProfile };
