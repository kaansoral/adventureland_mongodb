"use strict";

const { WEAPON_PROFILES, deriveActiveSkill, weaponProfile } = require("./active_skill");
const { applySicknessMultiplier } = require("./death_sickness");

const BASELINE = Object.freeze({
	max_hp: 100,
	max_mp: 100,
	speed: 50,
	frequency: 0.3,
	inventory_size: 42,
	attack: 0,
	heal: 0,
	armor: 0,
	resistance: 0,
	str: 0,
	dex: 0,
	int: 0,
	vit: 0,
	piercing: 0,
	crit: 0,
	luck: 0,
	gold: 0,
	xp: 0,
});

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
		sets: {},
		abilities: {},
		auras: {},
	};
}

function mergeProperty(stats, property, { noRange = false } = {}) {
	for (const [key, value] of Object.entries(property || {})) {
		if (typeof value !== "number" || !Number.isFinite(value)) continue;
		if (noRange && key === "range") continue;
		if (!ATTRIBUTES.has(key)) continue;
		if (key === "frequency") stats.frequency += value / 100;
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
		if (property) mergeProperty(stats, getProperties ? getProperties({ name: set, count }, property) : property);
	}
}

function applyConditionProperties(stats, conditions, conditionDefinitions) {
	for (const [name, condition] of Object.entries(conditions || {})) {
		mergeProperty(stats, condition);
		if (conditionDefinitions && conditionDefinitions[name]) mergeProperty(stats, conditionDefinitions[name]);
	}
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
	activeSkill = undefined,
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
	const resolvedActiveSkill = activeSkill === undefined ? deriveActiveSkill(slots, items, profiles) : activeSkill;
	const main = slots.mainhand && items[slots.mainhand.name];
	const profile = main && weaponProfile(main, profiles);
	if (main && resolvedActiveSkill) applyProfile(stats, profile, main);

	for (const [slot, instance] of Object.entries(slots || {})) {
		if (!instance || !items[instance.name]) continue;
		const definition = items[instance.name];
		const property = itemProperties(instance, definition, getItemProperties);
		mergeProperty(stats, property, { noRange: slot === "offhand" && definition.type === "weapon" });
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
			const primary = resolvedActiveSkill === "warrior" ? stats.str : stats.dex;
			stats.attack = itemAttack * (primary / 20);
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
	stats.max_hp += stats.str * 21 + stats.vit * 48;
	stats.max_mp += stats.int * 15;
	stats.speed += Math.min(stats.dex, 256) / 32 + Math.min(stats.str, 256) / 64;
	stats.armor += Math.min(stats.str, 160) + Math.max(stats.str - 160, 0) * 0.25;
	stats.resistance += Math.min(stats.int, 180) + Math.max(stats.int - 180, 0) * 0.25;
	stats.frequency += Math.min(stats.dex, 160) / 640 + Math.max(stats.dex - 160, 0) / 925 + stats.int / 1575;
	if (worldEffects) mergeProperty(stats, worldEffects);
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
	return clone(stats);
}

module.exports = { BASELINE, calculateStats, baseStats, mergeProperty };
