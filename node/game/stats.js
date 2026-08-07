"use strict";

const { WEAPON_PROFILES, resolveMainhand } = require("./active_skill");
const { EXPECTED_BASELINE } = require("./skill_domain");
const { applySicknessMultiplier } = require("./death_sickness");
const { DEX_CRIT_CALIBRATION, calculateDexCritCalibration } = require("./stat_calibration");

const BASELINE = Object.freeze({
	...EXPECTED_BASELINE,
	piercing: 0,
	crit: 0,
	luck: 0,
	gold: 0,
	xp: 0,
});

const DEX_CRIT_CAP = 80;
const GEAR_CRIT_CAP = 20;

const ATTRIBUTES = new Set([
	"hp",
	"mp",
	"speed",
	"armor",
	"resistance",
	"str",
	"dex",
	"int",
	"vit",
	"for",
	"frequency",
	"attack",
	"crit",
	"critdamage",
	"evasion",
	"miss",
	"avoidance",
	"lifesteal",
	"manasteal",
	"apiercing",
	"rpiercing",
	"range",
	"output",
	"courage",
	"mcourage",
	"pcourage",
	"luck",
	"gold",
	"xp",
	"mp_cost",
	"mp_reduction",
	"incdmgamp",
	"stun",
	"blast",
	"explosion",
	"cuteness",
	"bling",
	"dreturn",
	"reflection",
	"pnresistance",
	"firesistance",
	"fzresistance",
	"phresistance",
	"stresistance",
]);

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function baseStats() {
	return {
		...BASELINE,
		max_hp: BASELINE.max_hp,
		max_mp: BASELINE.max_mp,
		attack: 0,
		heal: 0,
		range: 0,
		damage_type: null,
		projectile: null,
		mp_cost: 0,
		attack_ms: 0,
		output: 100,
		courage: 0,
		mcourage: 0,
		pcourage: 0,
		for: 0,
		sets: {},
		abilities: {},
		auras: {},
	};
}

function mergeProperty(stats, property, { noRange = false, critSource = null } = {}) {
	for (const [key, value] of Object.entries(property || {})) {
		if (typeof value !== "number" || !Number.isFinite(value)) continue;
		if (noRange && key === "range") continue;
		if (!ATTRIBUTES.has(key)) continue;
		if (key === "frequency") stats.frequency += value / 100;
		else if (key === "crit" && critSource) stats[critSource] += value;
		else if (key === "hp") stats.max_hp += value;
		else if (key === "mp") stats.max_mp += value;
		else if (key === "attack") stats._item_attack += value;
		else if (key === "output") stats.output += value;
		else if (key === "luck") stats.xluck += value;
		else if (key === "gold") stats.xgold += value;
		else if (key === "xp") stats.xxp += value;
		else stats[key] = (stats[key] || 0) + value;
	}
}

function itemProperties(item, definition, getProperties) {
	if (getProperties) return getProperties(item, definition) || {};
	const props = {};
	for (const key of ATTRIBUTES) if (typeof definition[key] === "number") props[key] = definition[key];
	return props;
}

function applyProfile(stats, profile, item) {
	if (!profile) return;
	stats.range = item.range === undefined ? profile.range : item.range;
	stats.projectile = item.projectile === undefined ? profile.projectile : item.projectile;
	stats.damage_type = item.damage_type === undefined ? profile.damage_type : item.damage_type;
	stats.frequency = profile.frequency;
	stats.mp_cost = profile.mp_cost;
	if (profile.frequency_modifier) stats.frequency += profile.frequency_modifier / 100;
	if (profile.mp_cost_modifier) stats.mp_cost += profile.mp_cost_modifier;
	if (profile.speed) stats.speed += profile.speed;
	if (profile.apiercing) stats.apiercing += profile.apiercing;
}

function applySetProperties(stats, slots, items, sets, getProperties) {
	const counts = {};
	for (const item of Object.values(slots || {})) {
		if (!item || !items[item.name] || !items[item.name].set) continue;
		const set = items[item.name].set;
		counts[set] = (counts[set] || 0) + 1;
	}
	stats.sets = counts;
	for (const [set, count] of Object.entries(counts)) {
		const property = sets && sets[set] && sets[set][count];
		if (property)
			mergeProperty(stats, getProperties ? getProperties({ name: set, count }, property) : property, {
				critSource: "_gear_crit",
			});
	}
}

function applyConditionProperties(stats, conditions, conditionDefinitions) {
	for (const [name, condition] of Object.entries(conditions || {})) {
		mergeProperty(stats, condition, { critSource: "_effect_crit" });
		if (conditionDefinitions && conditionDefinitions[name])
			mergeProperty(stats, conditionDefinitions[name], { critSource: "_effect_crit" });
	}
}

function dexCrit(dex, calibrationDex) {
	const maximum = Math.max(1, calibrationDex);
	return Math.min(DEX_CRIT_CAP, DEX_CRIT_CAP * Math.pow(Math.max(0, dex) / maximum, 1.5));
}

function calculateStats({
	slots = {},
	items = {},
	sets = {},
	conditions = {},
	conditionDefinitions = {},
	profiles = WEAPON_PROFILES,
	getItemProperties = null,
	getSetProperties = null,
	previousHp = null,
	previousMp = null,
	deathSickness = false,
	worldEffects = null,
}) {
	const stats = baseStats();
	stats._item_attack = 0;
	stats.xluck = 0;
	stats.xgold = 0;
	stats.xxp = 0;
	stats._gear_crit = 0;
	stats._effect_crit = 0;
	const mainResolution = resolveMainhand(slots, items, profiles);
	const resolvedActiveSkill = mainResolution && mainResolution.skill;
	const main = mainResolution && mainResolution.item;
	const profile = mainResolution && mainResolution.profile;
	if (main && resolvedActiveSkill) applyProfile(stats, profile, main);

	for (const [slot, instance] of Object.entries(slots || {})) {
		if (!instance || !items[instance.name]) continue;
		const definition = items[instance.name];
		const property = itemProperties(instance, definition, getItemProperties);
		mergeProperty(stats, property, {
			noRange: slot === "offhand" && definition.type === "weapon",
			critSource: "_gear_crit",
		});
		if (definition.ability) {
			stats.abilities[definition.ability] = {
				...(stats.abilities[definition.ability] || {}),
				attr0:
					((stats.abilities[definition.ability] && stats.abilities[definition.ability].attr0) || 0) +
					(property.attr0 || 0),
				attr1:
					((stats.abilities[definition.ability] && stats.abilities[definition.ability].attr1) || 0) +
					(property.attr1 || 0),
			};
		}
		if (definition.aura) stats.auras[definition.aura] = { attr0: property.attr0 || 0, attr1: property.attr1 || 0 };
		if (slot === "offhand" && definition.type === "weapon") stats._item_attack -= (property.attack || 0) * 0.3;
	}
	applySetProperties(stats, slots, items, sets, getSetProperties);
	applyConditionProperties(stats, conditions, conditionDefinitions);

	if (main && resolvedActiveSkill) {
		if (
			slots.offhand &&
			items[slots.offhand.name] &&
			main.wtype === "stars" &&
			items[slots.offhand.name].wtype !== "stars"
		)
			stats._item_attack /= 3;
		const itemAttack = stats._item_attack;
		if (resolvedActiveSkill === "warrior" || resolvedActiveSkill === "ranger" || resolvedActiveSkill === "rogue") {
			stats.attack = itemAttack * (stats.str / 20);
		} else if (resolvedActiveSkill === "paladin") {
			stats.attack = itemAttack * (stats.str / 20 + stats.int / 40);
		} else if (resolvedActiveSkill === "mage") {
			stats.attack = itemAttack * (stats.int / 20);
		} else if (resolvedActiveSkill === "priest") {
			stats.attack = itemAttack * (stats.int / 20) * 1.6;
			stats.heal = stats.attack;
		}
		if (resolvedActiveSkill === "warrior") stats.courage += Math.round(stats.str / 30);
		if (resolvedActiveSkill === "priest") stats.mcourage += Math.round(stats.int / 30);
		if (resolvedActiveSkill === "paladin") stats.pcourage += Math.round(stats.str / 30 + stats.int / 30);
	}
	stats.max_hp += stats.vit * 48;
	stats.max_mp += stats.int * 15;
	if (profile && profile.damage_type === "physical") {
		stats.frequency += Math.min(stats.dex, 160) / 640 + Math.max(stats.dex - 160, 0) / 925;
	} else if (profile && profile.damage_type === "magical") {
		stats.frequency *= 1 + Math.min(0.2, Math.max(stats.int, 0) / 2000);
	}
	if (worldEffects) mergeProperty(stats, worldEffects, { critSource: "_effect_crit" });
	stats.crit = Math.max(
		0,
		Math.min(
			100,
			dexCrit(stats.dex, calculateDexCritCalibration(items, getItemProperties)) +
				Math.min(GEAR_CRIT_CAP, stats._gear_crit) +
				stats._effect_crit,
		),
	);
	Object.assign(stats, applySicknessMultiplier(stats, deathSickness));
	stats.attack = Math.max(0, Math.round(stats.attack));
	stats.heal = Math.max(0, Math.round(stats.heal));
	stats.max_hp = Math.max(1, Math.round(stats.max_hp));
	stats.max_mp = Math.max(1, Math.round(stats.max_mp));
	stats.armor = Math.round(stats.armor);
	stats.resistance = Math.round(stats.resistance);
	stats.frequency = Math.max(0.01, stats.frequency);
	stats.attack_ms = Math.round(1000 / stats.frequency);
	stats.mp_cost = Math.max(1, Math.round(stats.mp_cost));
	stats.xpm = Math.max(0.01, 1 + stats.xxp / 100);
	stats.xgold = Math.max(0, stats.xgold);
	stats.xluck = Math.max(0, stats.xluck);
	stats.goldm = 1 + stats.xgold / 100;
	stats.luckm = 1 + stats.xluck / 100;
	stats.hp = previousHp === null ? stats.max_hp : Math.max(0, Math.min(previousHp, stats.max_hp));
	stats.mp = previousMp === null ? stats.max_mp : Math.max(0, Math.min(previousMp, stats.max_mp));
	delete stats._item_attack;
	delete stats._gear_crit;
	delete stats._effect_crit;
	return clone(stats);
}

module.exports = {
	BASELINE,
	DEX_CRIT_CAP,
	GEAR_CRIT_CAP,
	calculateStats,
	baseStats,
	dexCrit,
	mergeProperty,
};
