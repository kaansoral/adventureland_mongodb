"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { COMBAT_SKILL_IDS, MAX_XP, buildProgressionData, cumulativeXp } = require("../game/skill_domain");
const { createCharacterState } = require("../game/character_state");
const { progression } = require("../../design/progression");
const { calculateStats } = require("../game/stats");
const { resolveMainhand } = require("../game/active_skill");
const { ContributionLedger } = require("../game/contributions");
const { awardPlayerSkillXp, awardPlayerSkillXpSplit, initializePlayerProgression } = require("../game/progression_runtime");
const { settleStand, qualifyLuck, recordSale } = require("../game/merchant_progression");

const COMBAT_SKILLS = Object.freeze(COMBAT_SKILL_IDS.slice());
const MERCHANT_PROFILES = Object.freeze(["starter", "competent", "optimized"]);
const FIXTURE_PATH = path.resolve(__dirname, "../tests/fixtures/progression-benchmark-routes.json");
const TARGET_ORACLE_PATH = path.resolve(__dirname, "../tests/fixtures/progression-benchmark-targets.json");
const COMBAT_SOURCE = "pve_damage";

function loadTargetOracle(filename = TARGET_ORACLE_PATH) {
	const oracle = JSON.parse(fs.readFileSync(filename, "utf8"));
	if (
		!oracle ||
		oracle.schema_version !== 1 ||
		!oracle.target_hours ||
		!Number.isFinite(oracle.duration_tolerance) ||
		!Number.isFinite(oracle.style_parity_ratio)
	) {
		throw new Error("Benchmark target oracle is invalid");
	}
	for (const profile of MERCHANT_PROFILES) {
		if (!Number.isSafeInteger(oracle.target_hours[profile]) || oracle.target_hours[profile] <= 0) {
			throw new Error(`Benchmark target oracle is missing ${profile}`);
		}
	}
	return Object.freeze({
		targetHours: Object.freeze({ ...oracle.target_hours }),
		durationTolerance: oracle.duration_tolerance,
		styleParityRatio: oracle.style_parity_ratio,
	});
}

const TARGET_ORACLE = loadTargetOracle();
const TARGET_HOURS = TARGET_ORACLE.targetHours;
const BENCHMARK_ITEM_TYPES = Object.freeze({
	mainhand: "weapon",
	helmets: "helmet",
	helmet: "helmet",
	chest: "chest",
	pants: "pants",
	shoes: "shoes",
	gloves: "gloves",
	cape: "cape",
	amulet: "amulet",
	ring1: "ring",
	ring2: "ring",
	earring1: "earring",
	earring2: "earring",
	belt: "belt",
	offhand: "offhand",
	orb: "orb",
});

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
	return JSON.stringify(value, null, 2) + "\n";
}

function loadVmFiles(files, baseDirectory, context = {}) {
	const sandbox = {
		console,
		Math,
		min: Math.min,
		max: Math.max,
		ceil: Math.ceil,
		round: Math.round,
		multipliers: { shells_to_gold: 1 },
		...context,
	};
	vm.createContext(sandbox);
	for (const file of files) {
		const filename = path.resolve(baseDirectory, file);
		vm.runInContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
	}
	return sandbox;
}

function loadBenchmarkData() {
	const design = loadVmFiles(
		[
			"conditions.js",
			"item_requirements.js",
			"items.js",
			"skills.js",
			"skill_xp.js",
			"abilities.js",
			"character.js",
			"monsters.js",
		],
		path.resolve(__dirname, "../../design"),
	);
	const helpers = loadVmFiles(["old_common_functions.js"], path.resolve(__dirname, "../../js"));
	const publication = buildProgressionData({
		conditions: design.conditions,
		items: design.items,
		skills: design.skills,
		skill_xp: design.skill_xp,
		abilities: design.abilities,
		character: design.character,
		item_requirements: design.item_requirements,
	});
	return {
		combatSkills: COMBAT_SKILLS,
		progression,
		items: publication.items,
		itemRequirements: publication.item_requirements,
		skills: publication.skills,
		skillXp: publication.skill_xp,
		abilities: publication.abilities,
		character: publication.character,
		conditions: design.conditions,
		monsters: design.monsters,
		sets: design.sets,
		damageMultiplier: helpers.damage_multiplier,
		stackMax: Number((publication.abilities.stack && publication.abilities.stack.max) || 0),
	};
}

function createBenchmarkPlayer() {
	const initial = createCharacterState();
	const player = {
		id: "benchmark-player",
		name: "benchmark-player",
		real_id: "benchmark-player",
		info: { skills: initial.skills },
		total_level: initial.total_level,
		p: {},
		t: {},
	};
	initializePlayerProgression(player, 0);
	return player;
}

function slotInstances(slots) {
	const result = {};
	for (const [slot, itemId] of Object.entries(slots || {})) {
		if (!itemId) continue;
		result[slot] = { name: itemId };
	}
	return result;
}

function createSeededRandom(seedText) {
	let seed = 2166136261;
	for (const char of String(seedText)) {
		seed ^= char.charCodeAt(0);
		seed = Math.imul(seed, 16777619);
	}
	return () => {
		seed += 0x6d2b79f5;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function isExcludedBenchmarkItem(item, itemId) {
	return Boolean(
		!item ||
		!itemId ||
		item.ignore === true ||
		itemId.startsWith("test") ||
		item.cash !== undefined ||
		item.p2w === true ||
		item.event === true ||
		item.quest ||
		item.special === true ||
		item.admin === true ||
		item.test === true,
	);
}

function requirementLevelSum(slots, data) {
	return Object.values(slots || {}).reduce(
		(sum, itemId) =>
			sum + (data.itemRequirements[itemId] || []).reduce((itemSum, requirement) => itemSum + requirement.level, 0),
		0,
	);
}

function candidateKey(candidate) {
	return [
		...Object.entries(candidate.slots || {})
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([slot, itemId]) => `${slot}:${itemId}`),
		`monster:${candidate.monster}`,
	].join("|");
}

function candidateIdentityKey(candidate) {
	return `${candidateKey(candidate)}|party:${Number(candidate.external_party_characters || 0)}`;
}

function normalBenchmarkMonsters(data) {
	const normal = Object.entries(data.monsters)
		.filter(([, monster]) => {
			return (
				Number.isFinite(monster.hp) &&
				monster.hp > 0 &&
				Number.isFinite(monster.xp) &&
				monster.xp > 0 &&
				Number(monster.respawn) >= 0 &&
				!monster.special &&
				!monster.operator &&
				!monster.rbuff &&
				!monster.event &&
				!monster.raid &&
				!monster.boss &&
				!monster.hide &&
				!monster.respawn_as &&
				!monster.immune &&
				Number(monster.attack) > 0
			);
		})
		.map(([id, monster]) => [id, monster]);
	return normal.map(([id]) => id).sort();
}

function benchmarkItemChoices(slot, skillLevels, data) {
	return Object.entries(data.items)
		.filter(([itemId, item]) => {
			if (isExcludedBenchmarkItem(item, itemId)) return false;
			const expectedType = BENCHMARK_ITEM_TYPES[slot];
			if (expectedType === "offhand")
				return ["shield", "source", "quiver", "misc_offhand"].includes(item.type);
			return item.type === expectedType;
		})
		.filter(([itemId]) => {
			const requirements = data.itemRequirements[itemId];
			return Array.isArray(requirements) && requirements.length && requirements.every((requirement) => {
				return Number(skillLevels[requirement.skill] || 0) >= requirement.level;
			});
		})
		.map(([itemId]) => itemId)
		.sort();
}

function canonicalRequirementLevels(skill, data) {
	const levels = new Set([1, progression.MAX_LEVEL]);
	for (const requirements of Object.values(data.itemRequirements || {})) {
		const own = requirements.find((requirement) => requirement.skill === skill);
		if (!own || own.level <= 1 || own.level >= progression.MAX_LEVEL) continue;
		if (requirements.every((requirement) => requirement.skill === skill || requirement.level <= 1)) levels.add(own.level);
	}
	for (const definition of Object.values(data.abilities || {})) {
		if (definition && definition.skill === skill && Number(definition.level || 1) > 1)
			levels.add(Math.min(progression.MAX_LEVEL, Number(definition.level)));
	}
	return [...levels].sort((left, right) => left - right);
}

function canonicalCombatBands(skill, plan, data) {
	const template = plan.candidate_template || (plan.bands && plan.bands[0] && plan.bands[0].candidates && plan.bands[0].candidates[0]);
	const levels = canonicalRequirementLevels(skill, data);
	const bands = [];
	for (let index = 0; index < levels.length - 1; index += 1) {
		const fromLevel = levels[index];
		const nextLevel = levels[index + 1];
		const toLevel = nextLevel - 1;
		if (fromLevel > toLevel) continue;
		bands.push({
			from_level: fromLevel,
			to_level: toLevel,
			target_level: nextLevel,
			template,
			monster_source: "all_normal",
			loadout_slots: plan.loadout_slots,
		});
	}
	return bands;
}

function enumerateCanonicalCandidates({ profile, skill, plan, band, skillLevels, data }) {
	const template =
		band.template ||
		plan.candidate_template ||
		(band.candidates && band.candidates[0]) ||
		(plan.bands && plan.bands[0] && plan.bands[0].candidates && plan.bands[0].candidates[0]);
	if (!template) throw new Error(`Benchmark plan ${profile}/${skill} is missing a canonical candidate template`);
	const loadoutSlots = band.loadout_slots || plan.loadout_slots;
	if (!Array.isArray(loadoutSlots) || !loadoutSlots.length)
		throw new Error(`Benchmark plan ${profile}/${skill} has no canonical loadout slots`);
	const pools = loadoutSlots.map((slot) => {
		if (!BENCHMARK_ITEM_TYPES[slot]) throw new Error(`Unknown benchmark loadout slot ${slot}`);
		const choices = benchmarkItemChoices(slot, skillLevels, data);
		if (!choices.length) throw new Error(`No legal ${slot} choices for ${profile}/${skill}`);
		return [slot, choices];
	});
	const monsters = Array.isArray(band.monsters)
		? band.monsters.slice().sort()
		: band.monster_source === "all_normal" || plan.monster_source === "all_normal" || profile !== "starter"
			? normalBenchmarkMonsters(data)
			: [template.monster];
	if (!monsters.length) throw new Error(`Benchmark plan ${profile}/${skill} has no canonical monsters`);
	const partyCounts = band.party_counts || plan.party_counts;
	if (!Array.isArray(partyCounts) || !partyCounts.length)
		throw new Error(`Benchmark plan ${profile}/${skill} has no explicit party/support variants`);
	const normalizedPartyCounts = [...new Set(partyCounts.map(Number))].sort((left, right) => left - right);
	if (normalizedPartyCounts.some((count) => !Number.isSafeInteger(count) || count < 0 || count > 9))
		throw new Error(`Benchmark plan ${profile}/${skill} has an invalid party/support cardinality`);
	const routes = [];
	const slots = {};
	const visit = (index) => {
		if (index < pools.length) {
			const [slot, choices] = pools[index];
			for (const itemId of choices) {
				slots[slot] = itemId;
				visit(index + 1);
			}
			delete slots[pools[index][0]];
			return;
		}
		const mainResolution = resolveMainhand(slotInstances(slots), data.items);
		if (!mainResolution || mainResolution.skill !== skill) return;
		for (const monster of monsters) {
			for (const externalPartyCharacters of normalizedPartyCounts) {
				const routeSlots = clone(slots);
				const route = {
					id: `canonical-${candidateIdentityKey({ slots: routeSlots, monster, external_party_characters: externalPartyCharacters })}`,
					reviewed: true,
					enumeration_source: "canonical",
					legal_basis: "canonical real-data enumeration of normal items and permanent non-boss monsters",
					slots: routeSlots,
					monster,
					uptime: Number(template.uptime),
					consumables: template.consumables || (profile === "starter" ? "none" : "normal_sustainable"),
					ability_policy: template.ability_policy || (profile === "starter" ? "basic_only" : "use_unlocked"),
					external_party_characters: externalPartyCharacters,
					party_damage_factor: Number(template.party_damage_factor || 0.25),
					requirement_level_sum: requirementLevelSum(routeSlots, data),
					simulation_mode: "projected",
				};
				routes.push(route);
			}
		}
	};
	visit(0);
	return routes.sort((left, right) => candidateKey(left).localeCompare(candidateKey(right)));
}

function validateCandidateShape(candidate, context) {
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
		throw new Error(`Invalid benchmark candidate for ${context}`);
	if ("calibration" in candidate)
		throw new Error(`Calibration is not permitted in real benchmark candidate ${context}/${candidate.id || "unknown"}`);
	if (candidate.reviewed !== true)
		throw new Error(`Benchmark candidate ${context}/${candidate.id || "unknown"} must be explicitly reviewed`);
	if (typeof candidate.legal_basis !== "string" || !candidate.legal_basis)
		throw new Error(`Benchmark candidate ${context}/${candidate.id || "unknown"} is missing legal_basis`);
	if (typeof candidate.id !== "string" || !candidate.id)
		throw new Error(`Benchmark candidate ${context} is missing id`);
	if (!candidate.slots || typeof candidate.slots !== "object" || Array.isArray(candidate.slots))
		throw new Error(`Benchmark candidate ${context}/${candidate.id} is missing slots`);
	if (typeof candidate.monster !== "string" || !candidate.monster)
		throw new Error(`Benchmark candidate ${context}/${candidate.id} is missing monster`);
	if (!Number.isFinite(Number(candidate.uptime)) || Number(candidate.uptime) <= 0 || Number(candidate.uptime) > 1)
		throw new Error(`Benchmark candidate ${context}/${candidate.id} has invalid uptime`);
	if (candidate.requirement_level_sum !== undefined &&
		(!Number.isSafeInteger(Number(candidate.requirement_level_sum)) || Number(candidate.requirement_level_sum) < 0))
		throw new Error(`Benchmark candidate ${context}/${candidate.id} has invalid requirement_level_sum`);
	if (!Number.isSafeInteger(Number(candidate.external_party_characters)) || Number(candidate.external_party_characters) < 0)
		throw new Error(`Benchmark candidate ${context}/${candidate.id} has invalid external_party_characters`);
	if (candidate.ability_policy !== undefined && !["basic_only", "use_unlocked"].includes(candidate.ability_policy))
		throw new Error(`Benchmark candidate ${context}/${candidate.id} has invalid ability_policy`);
}

function skillLevelsSnapshot(player) {
	const levels = {};
	for (const id of Object.keys(player.skills || {})) levels[id] = player.skills[id].level;
	return levels;
}

function validateItemRoute(skill, slots, skillLevels, data, context) {
	const instances = slotInstances(slots);
	const mainResolution = resolveMainhand(instances, data.items);
	if (!mainResolution || mainResolution.skill !== skill)
		throw new Error(`Benchmark route ${context} does not resolve active skill ${skill}`);
	for (const [slot, itemId] of Object.entries(slots || {})) {
		const item = data.items[itemId];
		if (!item) throw new Error(`Benchmark route ${context} references missing item ${itemId}`);
		if (isExcludedBenchmarkItem(item, itemId))
			throw new Error(`Benchmark route ${context} uses excluded item ${itemId}`);
		const requirements = data.itemRequirements[itemId];
		if (!Array.isArray(requirements) || !requirements.length)
			throw new Error(`Benchmark route ${context} has no normalized requirements for ${itemId}`);
		for (const requirement of requirements) {
			if (!Number.isSafeInteger(requirement.level))
				throw new Error(`Benchmark route ${context} has invalid requirement for ${itemId}`);
			const actual = Number((skillLevels && skillLevels[requirement.skill]) || 0);
			if (actual < requirement.level) {
				throw new Error(
					`Benchmark route ${context} is illegal: ${itemId} requires ${requirement.skill} ${requirement.level}`,
				);
			}
		}
		if (slot === "offhand" && item.type === "weapon" && !mainResolution.profile.offhand_weapon) {
			throw new Error(`Benchmark route ${context} has incompatible weapon offhand ${itemId}`);
		}
		if (slot === "offhand" && item.type === "weapon") {
			const offhandResolution = resolveMainhand({ mainhand: { name: itemId } }, data.items);
			if (!offhandResolution || offhandResolution.skill !== mainResolution.skill)
				throw new Error(`Benchmark route ${context} has an offhand weapon from another active skill ${itemId}`);
		}
		if (slot === "offhand" && item.type !== "weapon" && !mainResolution.profile.allowed_offhands.includes(item.type)) {
			throw new Error(`Benchmark route ${context} has incompatible offhand ${itemId}`);
		}
	}
	return mainResolution;
}

function validateMonsterRoute(monsterId, data, context) {
	const monster = data.monsters[monsterId];
	if (!monster) throw new Error(`Benchmark route ${context} references missing monster ${monsterId}`);
	if (!Number.isFinite(monster.hp) || monster.hp <= 0 || !Number.isFinite(monster.xp) || monster.xp <= 0)
		throw new Error(`Benchmark route ${context} references invalid monster ${monsterId}`);
	if (monster.special || monster.operator || monster.rbuff) {
		throw new Error(`Benchmark route ${context} uses excluded timed or special monster ${monsterId}`);
	}
	if (monster.event || monster.raid || monster.boss || monster.hide || monster.respawn_as || monster.immune || !(Number(monster.attack) > 0)) {
		throw new Error(`Benchmark route ${context} uses unavailable monster ${monsterId}`);
	}
	return monster;
}

function unlockedDamageAbilities(skill, skillLevel, mainhand, abilities) {
	return Object.entries(abilities || {})
		.filter(([, definition]) => {
			if (!definition || definition.applicability !== "skill" || definition.skill !== skill) return false;
			if (Number(definition.level || 1) > skillLevel || !definition.hostile || definition.heal) return false;
			if (definition.wtype) {
				const allowed = Array.isArray(definition.wtype) ? definition.wtype : [definition.wtype];
				if (!allowed.includes(mainhand.wtype)) return false;
			}
			if (definition.contribution) return false;
			return (
				Number(definition.damage_multiplier) > 0 ||
				Number(definition.ratio) > 0 ||
				(Number(definition.damage) > 0 && definition.damage_type)
			);
		})
		.map(([name, definition]) => ({
			name,
			cost: Math.max(0, Number(definition.mp || 0)),
			cooldown: Math.max(0, Number(definition.cooldown || 0)),
			definition,
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

function abilityDamage(ability, stats, currentMp) {
	const definition = ability.definition;
	if (Number(definition.ratio) > 0) return Math.max(0, Math.floor(currentMp * definition.ratio));
	if (Number(definition.damage) > 0) return Number(definition.damage);
	if (Number(definition.damage_multiplier) > 0) return stats.attack * Number(definition.damage_multiplier);
	return 0;
}

function consumableMpPerSecond(consumables, stats) {
	if (consumables === "normal_sustainable") return 300 / 2;
	if (consumables === "full_sustainable") return 400 / 2;
	return 0;
}

function abilityResourceCost(ability, stats) {
	return Number(ability.definition.ratio) > 0 ? stats.max_mp : ability.cost;
}

function abilityCycleMs(ability, stats, mpPerSecond) {
	const cooldown = Math.max(stats.attack_ms, ability.cooldown || stats.attack_ms);
	const resourceWait = mpPerSecond > 0 ? (abilityResourceCost(ability, stats) / mpPerSecond) * 1000 : Infinity;
	return Math.max(cooldown, resourceWait);
}

function damageProfile(damageType, mainResolution) {
	const resolvedType = damageType || mainResolution.profile.damage_type;
	if (resolvedType === "pure") return { damageType: "pure", defenseKey: null, pierceKey: null, missKey: null };
	if (resolvedType === "magical") return { damageType: "magical", defenseKey: "resistance", pierceKey: "rpiercing", missKey: "avoidance" };
	return { damageType: "physical", defenseKey: "armor", pierceKey: "apiercing", missKey: "evasion" };
}

function hitChance(monster, damageType) {
	if (damageType === "pure") return 1;
	const missKey = damageType === "magical" ? "avoidance" : "evasion";
	return Math.max(0, 1 - Number(monster[missKey] || 0) / 100);
}

function abilityDamageAgainst(ability, stats, monster, mainResolution, data) {
	const rawDamage = abilityDamage(ability, stats, stats.max_mp);
	if (rawDamage <= 0) return 0;
	const profile = damageProfile(ability.definition.damage_type, mainResolution);
	if (profile.damageType === "pure") return Math.ceil(rawDamage);
	const abilityPiercing = ability.name === "piercingshot" ? 500 : Number(stats[profile.pierceKey] || 0);
	return Math.max(
		0,
		Math.ceil(Math.ceil(rawDamage) * data.damageMultiplier((monster[profile.defenseKey] || 0) - abilityPiercing)),
	);
}

function combatModifierProfile(skill, skillLevel, stats, data) {
	const definitions = data.abilities || {};
	const modifiers = [];
	const add = (name, multiplier) => {
		const definition = definitions[name];
		if (!definition || definition.skill !== skill || Number(definition.level || 1) > skillLevel) return;
		const duration = Number(definition.duration || 0);
		const cooldown = Number(definition.cooldown || duration || 0);
		if (duration <= 0 || cooldown <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) return;
		modifiers.push({ name, multiplier, uptime: Math.min(1, duration / cooldown) });
	};
	add("curse", 1.2);
	add("huntersmark", 1.1);
	add("darkblessing", 1.25);
	return modifiers;
}

function simulateProjectedKill({ profile, skill, bandIndex, candidate, skillLevels, data }) {
	const context = `${profile}/${skill}/band-${bandIndex}/${candidate.id}`;
	validateCandidateShape(candidate, context);
	const mainResolution = validateItemRoute(skill, candidate.slots, skillLevels, data, context);
	const monster = validateMonsterRoute(candidate.monster, data, context);
	const slots = slotInstances(candidate.slots);
	const stats = calculateStats({
		slots,
		items: data.items,
		sets: data.sets,
		conditions: {},
		conditionDefinitions: data.conditions,
	});
	if (stats.attack <= 0) {
		return {
			context,
			slots: clone(candidate.slots),
			monster: candidate.monster,
			uptime: Number(candidate.uptime),
			consumables: candidate.consumables || "none",
			ability_policy: candidate.ability_policy || "basic_only",
			ability_uses: {},
			consumable_mp_per_second: 0,
			external_party_characters: Number(candidate.external_party_characters || 0),
			party_damage_factor: Number(candidate.party_damage_factor || 0),
			requirement_level_sum: Number(candidate.requirement_level_sum || requirementLevelSum(candidate.slots, data)),
			canonical_key: candidateKey(candidate),
			stats: {
				attack: stats.attack,
				attack_ms: stats.attack_ms,
				frequency: Number(stats.frequency.toFixed(9)),
				xpm: Number(stats.xpm.toFixed(9)),
				range: stats.range,
				damage_type: stats.damage_type,
			},
			hits_per_kill: null,
			elapsed_ms: 0,
			character_share_xp: 0,
			xp_split: {},
			xp_per_kill: 0,
			rate_per_hour: 0,
			simulation_mode: "projected",
		};
	}
	const basicProfile = damageProfile(mainResolution.profile.damage_type, mainResolution);
	const basicDamage = Math.max(
		1,
		Math.ceil(
			Math.ceil(stats.attack) * data.damageMultiplier((monster[basicProfile.defenseKey] || 0) - (stats[basicProfile.pierceKey] || 0)),
		),
	);
	const basicHitChance = hitChance(monster, basicProfile.damageType);
	const basicDps = (basicDamage * basicHitChance * 1000) / stats.attack_ms;
	const abilities =
		(candidate.ability_policy || "basic_only") === "use_unlocked"
			? unlockedDamageAbilities(skill, Number(skillLevels[skill] || 1), mainResolution.item, data.abilities)
			: [];
	const mpPerSecond = consumableMpPerSecond(candidate.consumables || "none", stats);
	const modifiers = combatModifierProfile(skill, Number(skillLevels[skill] || 1), stats, data);
	const modifierMultiplier = modifiers.reduce(
		(multiplier, modifier) => multiplier * (1 + (modifier.multiplier - 1) * modifier.uptime),
		1,
	);
	const abilityDps = {};
	let totalDps = basicDps * modifierMultiplier;
	const directOptions = abilities
		.map((ability) => {
			const damage = abilityDamageAgainst(ability, stats, monster, mainResolution, data);
			const abilityHitChance = hitChance(monster, damageProfile(ability.definition.damage_type, mainResolution).damageType);
			const cycleMs = abilityCycleMs(ability, stats, mpPerSecond);
			return {
				ability,
				damage,
				cycleMs,
				incrementalDps: Number.isFinite(cycleMs)
					? Math.max(0, damage * abilityHitChance - basicDamage * basicHitChance) * 1000 / cycleMs
					: 0,
			};
		})
		.filter((entry) => entry.damage > basicDamage && entry.incrementalDps > 0)
		.sort((left, right) => right.incrementalDps - left.incrementalDps || left.ability.name.localeCompare(right.ability.name));
	const selectedDirect = directOptions[0] || null;
	if (selectedDirect) {
		abilityDps[selectedDirect.ability.name] = selectedDirect.incrementalDps;
		totalDps += selectedDirect.incrementalDps;
	}
	const partyCount = Number(candidate.external_party_characters || 0);
	const partyDamageFactor = Math.max(0, Number(candidate.party_damage_factor || 0)) * partyCount;
	totalDps *= 1 + partyDamageFactor;
	if (totalDps <= 0) {
		return {
			context,
			slots: clone(candidate.slots),
			monster: candidate.monster,
			uptime: Number(candidate.uptime),
			consumables: candidate.consumables || "none",
			ability_policy: candidate.ability_policy || "basic_only",
			ability_uses: {},
			consumable_mp_per_second: Number(mpPerSecond.toFixed(6)),
			external_party_characters: partyCount,
			party_damage_factor: Number(candidate.party_damage_factor || 0),
			requirement_level_sum: Number(candidate.requirement_level_sum || requirementLevelSum(candidate.slots, data)),
			canonical_key: candidateKey(candidate),
			stats: {
				attack: stats.attack,
				attack_ms: stats.attack_ms,
				frequency: Number(stats.frequency.toFixed(9)),
				xpm: Number(stats.xpm.toFixed(9)),
				range: stats.range,
				damage_type: stats.damage_type,
			},
			hits_per_kill: null,
			elapsed_ms: 0,
			character_share_xp: 0,
			xp_split: {},
			xp_per_kill: 0,
			rate_per_hour: 0,
			simulation_mode: "projected",
		};
	}
	const activeMs = Math.ceil((monster.hp / totalDps) * 1000);
	const elapsedMs = Math.max(
		activeMs + Math.max(0, Math.round((monster.respawn || 0) * 1000)),
		selectedDirect ? selectedDirect.cycleMs : 0,
	);
	const characterShare = Math.round(monster.xp * stats.xpm);
	const encounterId = `${context}:encounter`;
	const ledger = new ContributionLedger({ now: () => 0 });
	ledger.openEncounter(encounterId, { monster: candidate.monster });
	ledger.snapshotAction({
		actionId: `${context}:action`,
		characterId: "benchmark-player",
		activeSkill: skill,
		encounterIds: [encounterId],
		kind: "combat",
	});
	ledger.recordDamage({
		encounterId,
		actionId: `${context}:action`,
		characterId: "benchmark-player",
		skill,
		amount: 1,
	});
	for (let index = 0; index < partyCount; index += 1) {
		const characterId = `benchmark-party-${index + 1}`;
		const actionId = `${context}:party-action:${index}`;
		ledger.snapshotAction({ actionId, characterId, activeSkill: "warrior", encounterIds: [encounterId], kind: "combat" });
		ledger.recordDamage({ encounterId, actionId, characterId, skill: "warrior", amount: partyDamageFactor / Math.max(1, partyCount) });
	}
	const split = ledger.partition(characterShare, encounterId, "benchmark-player");
	ledger.close(encounterId);
	const splitXp = Object.values(split).reduce((sum, value) => sum + value, 0);
	return {
		context,
		slots: clone(candidate.slots),
		monster: candidate.monster,
		uptime: Number(candidate.uptime),
		consumables: candidate.consumables || "none",
		ability_policy: candidate.ability_policy || "basic_only",
		ability_uses: Object.fromEntries(
			Object.entries(abilityDps).map(([name]) => {
				const ability = abilities.find((entry) => entry.name === name);
				return [name, Math.max(1, Math.ceil(activeMs / abilityCycleMs(ability, stats, mpPerSecond)))];
			}),
		),
		consumable_mp_per_second: Number(mpPerSecond.toFixed(6)),
		external_party_characters: partyCount,
		requirement_level_sum: Number(candidate.requirement_level_sum || requirementLevelSum(candidate.slots, data)),
		canonical_key: candidateKey(candidate),
		stats: {
			attack: stats.attack,
			attack_ms: stats.attack_ms,
			frequency: Number(stats.frequency.toFixed(9)),
			xpm: Number(stats.xpm.toFixed(9)),
			range: stats.range,
			damage_type: stats.damage_type,
		},
		hits_per_kill: Math.max(1, Math.ceil((monster.hp / Math.max(1, basicDamage)) / (1 + partyDamageFactor))),
		elapsed_ms: Math.round(elapsedMs / Number(candidate.uptime)),
		character_share_xp: characterShare,
		xp_split: split,
		xp_per_kill: splitXp,
		rate_per_hour: Number(((splitXp * 3600000) / Math.round(elapsedMs / Number(candidate.uptime))).toFixed(9)),
		simulation_mode: "projected",
	};
}

function simulateSoloKill({ profile, skill, bandIndex, candidate, skillLevels, data }) {
	const context = `${profile}/${skill}/band-${bandIndex}/${candidate.id}`;
	if (candidate.simulation_mode === "projected")
		return simulateProjectedKill({ profile, skill, bandIndex, candidate, skillLevels, data });
	validateCandidateShape(candidate, context);
	const mainResolution = validateItemRoute(skill, candidate.slots, skillLevels, data, context);
	const monster = validateMonsterRoute(candidate.monster, data, context);
	const slots = slotInstances(candidate.slots);
	const stats = calculateStats({
		slots,
		items: data.items,
		sets: data.sets,
		conditions: {},
		conditionDefinitions: data.conditions,
	});
	if (stats.attack <= 0) throw new Error(`Benchmark route ${context} produces zero attack`);
	const rng = createSeededRandom(`${profile}:${skill}:${bandIndex}:${candidate.id}`);
	const encounterId = `${context}:encounter`;
	const actionId = `${context}:action`;
	const maxHits = 200000;
	const partyDamageFactor = Math.max(0, Number(candidate.party_damage_factor || 0)) * Number(candidate.external_party_characters || 0);
	if (monster.hp > Math.max(1, stats.attack * 0.5) * (1 + partyDamageFactor) * maxHits) {
		return {
			context,
			slots: clone(candidate.slots),
			monster: candidate.monster,
			uptime: Number(candidate.uptime),
			consumables: candidate.consumables || "none",
			ability_policy: candidate.ability_policy || "basic_only",
			ability_uses: {},
			consumable_mp_per_second: 0,
			external_party_characters: Number(candidate.external_party_characters || 0),
			requirement_level_sum: Number(candidate.requirement_level_sum || requirementLevelSum(candidate.slots, data)),
			canonical_key: candidateKey(candidate),
			stats: {
				attack: stats.attack,
				attack_ms: stats.attack_ms,
				frequency: Number(stats.frequency.toFixed(9)),
				xpm: Number(stats.xpm.toFixed(9)),
				range: stats.range,
				damage_type: stats.damage_type,
			},
			hits_per_kill: null,
			elapsed_ms: 0,
			character_share_xp: 0,
			xp_split: {},
			xp_per_kill: 0,
			rate_per_hour: 0,
		};
	}
	const ledger = new ContributionLedger({ now: () => 0 });
	ledger.openEncounter(encounterId, { monster: candidate.monster });
	ledger.snapshotAction({
		actionId,
		characterId: "benchmark-player",
		activeSkill: skill,
		encounterIds: [encounterId],
		kind: "combat",
	});
	const basicProfile = damageProfile(mainResolution.profile.damage_type, mainResolution);
	let hp = monster.hp;
	let elapsedMs = 0;
	let hits = 0;
	let rogueStacks = 0;
	let mp = stats.max_mp;
	let externalDamage = 0;
	const abilityUses = {};
	const abilityReadyAt = new Map();
	const abilities =
		(candidate.ability_policy || "basic_only") === "use_unlocked"
			? unlockedDamageAbilities(skill, Number(skillLevels[skill] || 1), mainResolution.item, data.abilities)
			: [];
	const mpPerSecond = consumableMpPerSecond(candidate.consumables || "none", stats);
	while (hp > 0) {
		hits += 1;
		if (hits > maxHits) throw new Error(`Benchmark route ${context} exceeded hit safety limit`);
		mp = Math.min(stats.max_mp, mp + (mpPerSecond * stats.attack_ms) / 1000);
		let attack = stats.attack;
		let selectedAbility = null;
		if (abilities.length) {
			selectedAbility = abilities
				.filter((ability) => (abilityReadyAt.get(ability.name) || 0) <= elapsedMs)
				.filter((ability) => ability.cost <= mp || ability.definition.ratio > 0)
				.sort(
					(left, right) =>
						abilityDamage(right, stats, mp) - abilityDamage(left, stats, mp) ||
						left.cooldown - right.cooldown ||
						left.name.localeCompare(right.name),
				)
				[0] || null;
		}
		if (selectedAbility) {
			const cost = selectedAbility.definition.ratio > 0 ? mp : selectedAbility.cost;
			if (cost <= mp) {
				attack = abilityDamage(selectedAbility, stats, mp);
				mp -= cost;
				abilityReadyAt.set(selectedAbility.name, elapsedMs + selectedAbility.cooldown);
				abilityUses[selectedAbility.name] = (abilityUses[selectedAbility.name] || 0) + 1;
			} else selectedAbility = null;
		}
		if (skill === "rogue" && data.stackMax > 0) {
			rogueStacks = Math.min(data.stackMax, rogueStacks + 1);
			if (!selectedAbility) attack += rogueStacks;
		}
		if (stats.crit > 0 && rng() * 100 < stats.crit) {
			attack *= 2 + (stats.critdamage || 0) / 100;
		}
		const attackProfile = damageProfile(
			selectedAbility ? selectedAbility.definition.damage_type : basicProfile.damageType,
			mainResolution,
		);
		let damage =
			attackProfile.damageType === "pure"
				? Math.ceil(attack)
				: Math.ceil(
						Math.ceil(attack * (0.9 + rng() * 0.2)) *
							data.damageMultiplier((monster[attackProfile.defenseKey] || 0) - (stats[attackProfile.pierceKey] || 0)),
					);
		if (attackProfile.missKey && monster[attackProfile.missKey] && rng() * 100 < monster[attackProfile.missKey]) damage = 0;
		damage = Math.max(0, damage);
		const hpBefore = hp;
		hp = Math.max(0, hp - Math.ceil(damage * (1 + partyDamageFactor)));
		const combinedDamage = hpBefore - hp;
		const playerDamage = partyDamageFactor ? combinedDamage / (1 + partyDamageFactor) : combinedDamage;
		externalDamage += Math.max(0, combinedDamage - playerDamage);
		ledger.recordDamage({
			encounterId,
			actionId,
			characterId: "benchmark-player",
			skill,
			amount: playerDamage,
			hpBefore,
			hpAfter: hp,
		});
		if (selectedAbility) abilityUses[selectedAbility.name] = abilityUses[selectedAbility.name] || 1;
		elapsedMs += stats.attack_ms;
	}
	for (let index = 0; index < Number(candidate.external_party_characters || 0); index += 1) {
		const characterId = `benchmark-party-${index + 1}`;
		const actionId = `${context}:party-action:${index}`;
		ledger.snapshotAction({
			actionId,
			characterId,
			activeSkill: "warrior",
			encounterIds: [encounterId],
			kind: "combat",
		});
		ledger.recordDamage({
			encounterId,
			actionId,
			characterId,
			skill: "warrior",
			amount: externalDamage / Number(candidate.external_party_characters || 1),
		});
	}
	for (const ability of abilities) {
		const uses = Number(abilityUses[ability.name] || 0);
		if (!uses) continue;
		const cooldownWindow = Math.ceil(uses * abilityCycleMs(ability, stats, mpPerSecond));
		const respawnMs = Math.max(0, Math.round((monster.respawn || 0) * 1000));
		elapsedMs = Math.max(elapsedMs, cooldownWindow - respawnMs);
	}
	elapsedMs += Math.max(0, Math.round((monster.respawn || 0) * 1000));
	const characterShare = Math.round(monster.xp * stats.xpm);
	const split = ledger.partition(characterShare, encounterId, "benchmark-player");
	ledger.close(encounterId);
	const splitXp = Object.values(split).reduce((sum, value) => sum + value, 0);
	if (!splitXp) throw new Error(`Benchmark route ${context} did not award any XP`);
	return {
		context,
		slots: clone(candidate.slots),
		monster: candidate.monster,
		uptime: Number(candidate.uptime),
		consumables: candidate.consumables || "none",
		ability_policy: candidate.ability_policy || "basic_only",
		ability_uses: abilityUses,
		consumable_mp_per_second: Number(mpPerSecond.toFixed(6)),
		external_party_characters: Number(candidate.external_party_characters || 0),
		party_damage_factor: Number(candidate.party_damage_factor || 0),
		requirement_level_sum: Number(candidate.requirement_level_sum || requirementLevelSum(candidate.slots, data)),
		canonical_key: candidateKey(candidate),
		stats: {
			attack: stats.attack,
			attack_ms: stats.attack_ms,
			frequency: Number(stats.frequency.toFixed(9)),
			xpm: Number(stats.xpm.toFixed(9)),
			range: stats.range,
			damage_type: stats.damage_type,
		},
		hits_per_kill: hits,
		elapsed_ms: Math.round(elapsedMs / Number(candidate.uptime)),
		character_share_xp: characterShare,
		xp_split: split,
		xp_per_kill: splitXp,
		rate_per_hour: Number(((splitXp * 3600000) / Math.round(elapsedMs / Number(candidate.uptime))).toFixed(9)),
		simulation_mode: "exact",
	};
}

function chooseCandidate(mode, candidates, baselineRate) {
	const viable = candidates.filter((candidate) => candidate.xp_per_kill > 0 && candidate.rate_per_hour > 0);
	if (!viable.length) throw new Error("Benchmark band has no viable candidates");
	if (mode === "fixed") return viable[0];
	if (mode === "closest_target") {
		const target = baselineRate * 3;
		const legal = viable.filter((candidate) => candidate.rate_per_hour <= baselineRate * 3.1 + 1e-9);
		if (!legal.length) throw new Error(`No competent benchmark candidate is at or below the 3.1x rate ceiling (target ${target})`);
		return legal
			.slice()
			.sort(
				(a, b) =>
					Math.abs(a.rate_per_hour - target) - Math.abs(b.rate_per_hour - target) ||
					Number(a.requirement_level_sum || 0) - Number(b.requirement_level_sum || 0) ||
					candidateKey(a).localeCompare(candidateKey(b)),
			)[0];
	}
	if (mode === "max_rate") {
		return viable
			.slice()
			.sort(
				(a, b) =>
					b.rate_per_hour - a.rate_per_hour ||
					Number(a.external_party_characters || 0) - Number(b.external_party_characters || 0) ||
					candidateKey(a).localeCompare(candidateKey(b)),
			)[0];
	}
	throw new Error(`Unknown benchmark selection mode ${mode}`);
}

function scaleSplit(split, multiplier) {
	const scaled = {};
	for (const [skill, amount] of Object.entries(split || {})) scaled[skill] = amount * multiplier;
	return scaled;
}

function evaluateCombatPlan(profile, skill, plan, data, baselineRate) {
	const player = createBenchmarkPlayer();
	const bands = [];
	let durationMs = 0;
	const useCanonicalEnumeration = plan.enumeration === "canonical" || (profile !== "starter" && plan.enumeration !== "fixture");
	const configuredBands = useCanonicalEnumeration ? canonicalCombatBands(skill, plan, data) : plan.bands || [];
	for (const [bandIndex, band] of configuredBands.entries()) {
		if (!useCanonicalEnumeration && (!Array.isArray(band.candidates) || !band.candidates.length))
			throw new Error(`Benchmark plan ${profile}/${skill}/band-${bandIndex} has no candidates`);
		const currentLevel = Number((player.skills[skill] && player.skills[skill].level) || 1);
		const minimumLevel = Number(band.from_level || currentLevel || 1);
		if (currentLevel < minimumLevel) {
			throw new Error(
				`Benchmark plan ${profile}/${skill}/band-${bandIndex} starts at ${minimumLevel} before the skill reaches it`,
			);
		}
		const targetLevel = Number(band.target_level || band.to_level || progression.MAX_LEVEL);
		const targetXp = targetLevel >= progression.MAX_LEVEL ? MAX_XP : cumulativeXp(targetLevel);
		const skillLevels = skillLevelsSnapshot(player);
		const candidates =
			useCanonicalEnumeration
				? enumerateCanonicalCandidates({ profile, skill, plan, band, skillLevels, data })
				: band.candidates;
		const evaluatedCandidates = candidates.map((candidate) => ({
			...simulateSoloKill({ profile, skill, bandIndex, candidate, skillLevels, data }),
			benchmark_candidate: candidate,
		}));
		const projectedSelected = chooseCandidate(
			plan.selection_mode,
			evaluatedCandidates,
			baselineRate || evaluatedCandidates[0].rate_per_hour,
		);
		const selected = simulateSoloKill({
			profile,
			skill,
			bandIndex,
			candidate: { ...projectedSelected.benchmark_candidate, simulation_mode: "exact" },
			skillLevels,
			data,
		});
		const currentXp = player.skills[skill].xp;
		const xpRemaining = Math.max(0, targetXp - currentXp);
		const kills = xpRemaining === 0 ? 0 : Math.ceil(xpRemaining / selected.xp_per_kill);
		durationMs += kills * selected.elapsed_ms;
		if (kills > 0) {
			awardPlayerSkillXpSplit(player, scaleSplit(selected.xp_split, kills), {
				source: COMBAT_SOURCE,
				sourceId: `${profile}:${skill}:band-${bandIndex}:${selected.context}`,
				emit: false,
			});
		}
		bands.push({
			from_level: minimumLevel,
			to_level: Number(band.to_level || 99),
			selected_candidate_id: selected.context.split("/").pop(),
			monster: selected.monster,
			slots: selected.slots,
			uptime: selected.uptime,
			consumables: selected.consumables,
			simulation_mode: selected.simulation_mode,
			ability_policy: selected.ability_policy,
			ability_uses: selected.ability_uses,
			consumable_mp_per_second: selected.consumable_mp_per_second,
			external_party_characters: selected.external_party_characters,
			requirement_level_sum: selected.requirement_level_sum,
			canonical_key: selected.canonical_key,
			hits_per_kill: selected.hits_per_kill,
			kill_time_ms: selected.elapsed_ms,
			xp_per_kill: selected.xp_per_kill,
			character_share_xp: selected.character_share_xp,
			rate_per_hour: Number(selected.rate_per_hour.toFixed(9)),
			kills,
			duration_hours: Number(((kills * selected.elapsed_ms) / progression.STAND_HOUR_MS).toFixed(6)),
			stats: selected.stats,
		});
	}
	const durationHours = Number((durationMs / progression.STAND_HOUR_MS).toFixed(6));
	const targetHours = TARGET_HOURS[profile];
	const ratePerHour = durationMs > 0 ? (player.t.skill_xp[skill] * progression.STAND_HOUR_MS) / durationMs : 0;
	const rateX = baselineRate > 0 ? Number((ratePerHour / baselineRate).toFixed(6)) : 1;
	return {
		profile,
		skill,
		strategy: plan.strategy,
		duration_hours: durationHours,
		target_hours: targetHours,
		rate_x: profile === "starter" ? 1 : rateX,
		within_target: Math.abs(durationHours - targetHours) / targetHours <= TARGET_ORACLE.durationTolerance,
		bands,
		player_state: {
			level: player.skills[skill].level,
			xp: player.skills[skill].xp,
			total_level: player.total_level,
		},
	};
}

function addLuckCredits(state, profile, hour, now, count) {
	for (let index = 0; index < count; index += 1) {
		const result = qualifyLuck(state, `${profile}:target:${hour}:${index}`, now);
		state = result.state;
		if (!result.qualifies) throw new Error(`Benchmark Luck route was denied: ${profile}/${hour}/${index}`);
	}
	return state;
}

function addSaleCredits(state, profile, hour, now, count, serverTax, goldReceived) {
	for (let index = 0; index < count; index += 1) {
		const result = recordSale(state, {
			merchantOwnerId: `${profile}:merchant`,
			externalOwnerId: `${profile}:buyer:${hour}:${index}`,
			goldReceived,
			serverTax: Array.isArray(serverTax) ? serverTax[index] : serverTax,
			sourceId: `${profile}:sale:${hour}:${index}`,
			now,
		});
		state = result.state;
		if (!result.eligible || result.credited <= 0)
			throw new Error(`Benchmark sale route was denied: ${profile}/${hour}/${index}`);
	}
	return state;
}

function validateMerchantSchedule(route, profile) {
	const schedule = route && route.schedule;
	if (!schedule || typeof schedule !== "object" || Array.isArray(schedule))
		throw new Error(`Merchant benchmark route ${profile} is missing an explicit schedule`);
	const scheduleKeys = Object.keys(schedule).sort();
	if (stableJson(scheduleKeys) !== stableJson(["after_level_gate", "before_level_gate", "level_gate", "stand_elapsed_ms"]))
		throw new Error(`Merchant benchmark route ${profile} has incomplete or unused schedule fields`);
	if (schedule.level_gate !== null && (!Number.isSafeInteger(schedule.level_gate) || schedule.level_gate < 1 || schedule.level_gate > progression.MAX_LEVEL))
		throw new Error(`Merchant benchmark route ${profile} has an invalid level gate`);
	if (!Number.isSafeInteger(schedule.stand_elapsed_ms) || schedule.stand_elapsed_ms <= 0 || schedule.stand_elapsed_ms > progression.STAND_HOUR_MS)
		throw new Error(`Merchant benchmark route ${profile} has an invalid stand interval`);
	for (const phaseName of ["before_level_gate", "after_level_gate"]) {
		const phase = schedule[phaseName];
		if (!phase || typeof phase !== "object" || Array.isArray(phase))
			throw new Error(`Merchant benchmark route ${profile} is missing ${phaseName}`);
		const phaseKeys = Object.keys(phase).sort();
		if (stableJson(phaseKeys) !== stableJson(["luck_count", "sale_count", "sale_gold", "sale_server_tax"]))
			throw new Error(`Merchant benchmark route ${profile}/${phaseName} has incomplete or unused fields`);
		for (const field of ["luck_count", "sale_count"]) {
			if (!Number.isSafeInteger(phase[field]) || phase[field] < 0)
				throw new Error(`Merchant benchmark route ${profile}/${phaseName} has an invalid ${field}`);
		}
		if (phase.luck_count > progression.LUCK_MAX_TARGETS_PER_HOUR)
			throw new Error(`Merchant benchmark route ${profile}/${phaseName} exceeds the Luck hour cap`);
		if (!Number.isSafeInteger(phase.sale_gold) || (phase.sale_count > 0 && phase.sale_gold <= 0))
			throw new Error(`Merchant benchmark route ${profile}/${phaseName} has an invalid sale_gold`);
		const taxes = Array.isArray(phase.sale_server_tax) ? phase.sale_server_tax : [phase.sale_server_tax];
		if (phase.sale_count > 0 && taxes.length !== 1 && taxes.length !== phase.sale_count)
			throw new Error(`Merchant benchmark route ${profile}/${phaseName} has the wrong sale tax schedule length`);
		if (taxes.some((tax) => !Number.isSafeInteger(tax) || tax < 0))
			throw new Error(`Merchant benchmark route ${profile}/${phaseName} has an invalid sale tax`);
	}
	return schedule;
}

function runMerchantProfile(profile, route) {
	const schedule = validateMerchantSchedule(route, profile);
	const player = createBenchmarkPlayer();
	let state = player.info.merchant_accrual;
	let hours = 0;
	let level40ReachedAt = null;
	let baseUnits = 0;
	let bonusUnits = 0;
	let maxRollingUnits = 0;
	while (player.skills.merchant.xp < MAX_XP && hours < TARGET_HOURS[profile] + 1) {
		const now = hours * schedule.stand_elapsed_ms;
		const settlementAt = now + schedule.stand_elapsed_ms;
		const afterLevelGate = schedule.level_gate !== null && player.skills.merchant.xp >= cumulativeXp(schedule.level_gate);
		const phase = afterLevelGate ? schedule.after_level_gate : schedule.before_level_gate;
		if (afterLevelGate && level40ReachedAt === null) level40ReachedAt = hours;
		state = addLuckCredits(state, profile, hours, settlementAt, phase.luck_count);
		state = addSaleCredits(
			state,
			profile,
			hours,
			settlementAt,
			phase.sale_count,
			phase.sale_server_tax,
			phase.sale_gold,
		);
		const settled = settleStand(state, schedule.stand_elapsed_ms, settlementAt);
		state = settled.state;
		if (settled.base_units + settled.bonus_units > progression.MAX_TOTAL_UNITS_PER_HOUR)
			throw new Error(`Merchant benchmark route ${profile} exceeded the rolling total-unit cap`);
		if (settled.bonus_units > settled.base_units * 5)
			throw new Error(`Merchant benchmark route ${profile} exceeded the rolling bonus cap`);
		baseUnits += settled.base_units;
		bonusUnits += settled.bonus_units;
		const rollingUnits =
			state.rolling_awards.reduce((sum, award) => sum + award.base_units + award.bonus_units, 0) +
			(state.saturated_award_units ? state.saturated_award_units.units : 0);
		maxRollingUnits = Math.max(maxRollingUnits, rollingUnits);
		if (settled.xp) {
			const delta = awardPlayerSkillXp(player, "merchant", settled.xp, {
				source: "merchant_stand",
				sourceId: `benchmark-stand:${profile}:${hours}`,
				emit: false,
				now: settlementAt,
			});
			if (delta.duplicate) throw new Error(`Merchant benchmark route ${profile} produced a duplicate stand award`);
		}
		player.info.merchant_accrual = state;
		hours += 1;
	}
	const xp = player.skills.merchant.xp;
	return {
		profile,
		strategy: route.strategy,
		schedule: clone(schedule),
		duration_hours: hours,
		target_hours: TARGET_HOURS[profile],
		within_target: hours === TARGET_HOURS[profile],
		xp,
		base_xp: Math.floor(baseUnits / progression.XP_UNITS_PER_XP),
		bonus_xp: Math.floor(bonusUnits / progression.XP_UNITS_PER_XP),
		base_units: baseUnits,
		bonus_units: bonusUnits,
		max_rolling_multiplier: Number((maxRollingUnits / progression.BASE_UNITS_PER_HOUR).toFixed(6)),
		level_40_reached_at_hour: level40ReachedAt,
	};
}

function loadFixture(filename = FIXTURE_PATH) {
	return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function summarizeCombatExpected(result) {
	return {
		duration_hours: result.duration_hours,
		rate_x: result.rate_x,
		selected_candidate_ids: result.bands.map((band) => band.selected_candidate_id),
	};
}

function summarizeMerchantExpected(result) {
	return {
		duration_hours: result.duration_hours,
		xp: result.xp,
		level_40_reached_at_hour: result.level_40_reached_at_hour || null,
	};
}

function generateFixture(fixture, data = loadBenchmarkData()) {
	const next = clone(fixture);
	next.schema_version = 2;
	next.contract = {
		max_xp: MAX_XP,
		base_units_per_hour: progression.BASE_UNITS_PER_HOUR,
		xp_units_per_xp: progression.XP_UNITS_PER_XP,
		benchmark_tolerance: TARGET_ORACLE.durationTolerance,
	};
	const evaluatedStarter = {};
	for (const skill of COMBAT_SKILLS) {
		const plan = next.combat.starter[skill];
		if ("calibration" in plan) throw new Error(`Calibration is not permitted in benchmark plan starter/${skill}`);
		evaluatedStarter[skill] = evaluateCombatPlan("starter", skill, plan, data, null);
		next.combat.starter[skill].expected = summarizeCombatExpected(evaluatedStarter[skill]);
	}
	for (const profile of ["competent", "optimized"]) {
		for (const skill of COMBAT_SKILLS) {
			const plan = next.combat[profile][skill];
			if ("calibration" in plan) throw new Error(`Calibration is not permitted in benchmark plan ${profile}/${skill}`);
			const baselineRate = evaluatedStarter[skill].bands[0].rate_per_hour;
			const result = evaluateCombatPlan(profile, skill, plan, data, baselineRate);
			next.combat[profile][skill].expected = summarizeCombatExpected(result);
		}
	}
	for (const profile of MERCHANT_PROFILES) {
		if ("calibration" in next.merchant[profile])
			throw new Error(`Calibration is not permitted in Merchant benchmark plan ${profile}`);
		next.merchant[profile].expected = summarizeMerchantExpected(runMerchantProfile(profile, next.merchant[profile]));
	}
	return next;
}

function matchesExpected(actual, expected) {
	if (!expected) return false;
	return stableJson(actual) === stableJson(expected);
}

function runBenchmark({ fixturePath = FIXTURE_PATH, strictTargets = false } = {}) {
	const data = loadBenchmarkData();
	const fixture = loadFixture(fixturePath);
	const regenerated = generateFixture(fixture, data);
	const combat = { starter: {}, competent: {}, optimized: {} };
	for (const skill of COMBAT_SKILLS)
		combat.starter[skill] = evaluateCombatPlan("starter", skill, fixture.combat.starter[skill], data, null);
	for (const skill of COMBAT_SKILLS) {
		const baseline = combat.starter[skill].bands[0].rate_per_hour;
		combat.competent[skill] = evaluateCombatPlan(
			"competent",
			skill,
			fixture.combat.competent[skill],
			data,
			baseline,
		);
		combat.optimized[skill] = evaluateCombatPlan(
			"optimized",
			skill,
			fixture.combat.optimized[skill],
			data,
			baseline,
		);
	}
	const merchant = {};
	for (const profile of MERCHANT_PROFILES)
		merchant[profile] = runMerchantProfile(profile, fixture.merchant[profile]);
	const targetAlignment = Object.values(combat).every((profile) =>
		Object.values(profile).every((result) => result.within_target),
	);
	const merchantTargetAlignment = Object.values(merchant).every((result) => result.within_target);
	const styleParity = Object.values(combat).every((profile) => {
		const durations = Object.values(profile).map((result) => result.duration_hours);
		return Math.max(...durations) / Math.min(...durations) <= TARGET_ORACLE.styleParityRatio;
	});
	const routeLegality = Object.values(combat).every((profile) =>
		Object.values(profile).every((result) => result.bands.every((band) => Boolean(band.selected_candidate_id))),
	);
	const expectedCombatPass = Object.entries(combat).every(([profile, results]) =>
		Object.entries(results).every(([skill, result]) =>
			matchesExpected(summarizeCombatExpected(result), fixture.combat[profile][skill].expected),
		),
	);
	const expectedMerchantPass = Object.entries(merchant).every(([profile, result]) =>
		matchesExpected(summarizeMerchantExpected(result), fixture.merchant[profile].expected),
	);
	const fixtureStable = stableJson(regenerated) === stableJson(fixture);
	const ok =
		routeLegality &&
		expectedCombatPass &&
		expectedMerchantPass &&
		fixtureStable &&
		targetAlignment &&
		merchantTargetAlignment &&
		styleParity;
	const strict_ok = ok;
	const report = {
		schema_version: 2,
		ok,
		strict_ok,
		combat,
		merchant,
		checks: {
			route_legality: { pass: routeLegality },
			expected_outputs: { pass: expectedCombatPass && expectedMerchantPass },
			fixture_stable: fixtureStable,
			target_alignment: { pass: targetAlignment, merchant_pass: merchantTargetAlignment },
			style_parity: { pass: styleParity },
		},
		target_oracle: {
			schema_version: 1,
			target_hours: TARGET_HOURS,
			duration_tolerance: TARGET_ORACLE.durationTolerance,
			style_parity_ratio: TARGET_ORACLE.styleParityRatio,
		},
	};
	if (strictTargets && !report.strict_ok) report.ok = false;
	return report;
}

function main(argv = process.argv.slice(2)) {
	const format = argv.includes("--format=json") ? "json" : "text";
	const strictTargets = argv.includes("--strict-targets");
	const fixtureArgument = argv.find((argument) => argument.startsWith("--fixture="));
	const fixturePath = fixtureArgument ? fixtureArgument.slice("--fixture=".length) : FIXTURE_PATH;
	const report = runBenchmark({ fixturePath, strictTargets });
	if (format === "json") process.stdout.write(JSON.stringify(report) + "\n");
	else process.stdout.write(JSON.stringify(report, null, 2) + "\n");
	if (!report.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
	COMBAT_SKILLS,
	FIXTURE_PATH,
	MERCHANT_PROFILES,
	abilityDamageAgainst,
	chooseCandidate,
	enumerateCanonicalCandidates,
	evaluateCombatPlan,
	generateFixture,
	loadBenchmarkData,
	loadFixture,
	loadTargetOracle,
	runMerchantProfile,
	runBenchmark,
	simulateSoloKill,
	stableJson,
};
