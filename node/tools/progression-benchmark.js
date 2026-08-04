"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
	COMBAT_SKILL_IDS,
	MAX_XP,
	buildProgressionData,
	cumulativeXp,
} = require("../game/skill_domain");
const { createCharacterState } = require("../game/character_state");
const { progression } = require("../../design/progression");
const { calculateStats } = require("../game/stats");
const { resolveMainhand } = require("../game/active_skill");
const { ContributionLedger } = require("../game/contributions");
const { awardPlayerSkillXpSplit, initializePlayerProgression } = require("../game/progression_runtime");
const { createMerchantAccrual, settleStand, qualifyLuck, recordSale } = require("../game/merchant_progression");

const COMBAT_SKILLS = Object.freeze(COMBAT_SKILL_IDS.slice());
const MERCHANT_PROFILES = Object.freeze(["starter", "competent", "optimized"]);
const TARGET_HOURS = Object.freeze({ starter: 2016, competent: 672, optimized: 336 });
const FIXTURE_PATH = path.resolve(__dirname, "../tests/fixtures/progression-benchmark-routes.json");
const COMBAT_SOURCE = "pve_damage";

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
}

function validateItemRoute(skill, slots, minimumLevel, data, context) {
	const instances = slotInstances(slots);
	const mainResolution = resolveMainhand(instances, data.items);
	if (!mainResolution || mainResolution.skill !== skill)
		throw new Error(`Benchmark route ${context} does not resolve active skill ${skill}`);
	for (const [slot, itemId] of Object.entries(slots || {})) {
		const item = data.items[itemId];
		if (!item) throw new Error(`Benchmark route ${context} references missing item ${itemId}`);
		if (itemId.startsWith("test") || item.a === true || item.cash === true)
			throw new Error(`Benchmark route ${context} uses excluded item ${itemId}`);
		const requirements = data.itemRequirements[itemId];
		if (!Array.isArray(requirements) || !requirements.length)
			throw new Error(`Benchmark route ${context} has no normalized requirements for ${itemId}`);
		for (const requirement of requirements) {
			if (!Number.isSafeInteger(requirement.level))
				throw new Error(`Benchmark route ${context} has invalid requirement for ${itemId}`);
			const actual = requirement.skill === skill ? minimumLevel : 0;
			if (actual < requirement.level) {
				throw new Error(
					`Benchmark route ${context} is illegal: ${itemId} requires ${requirement.skill} ${requirement.level}`,
				);
			}
		}
		if (slot === "offhand" && item.type === "weapon" && !mainResolution.profile.offhand_weapon) {
			throw new Error(`Benchmark route ${context} has incompatible weapon offhand ${itemId}`);
		}
		if (
			slot === "offhand" &&
			item.type !== "weapon" &&
			!mainResolution.profile.allowed_offhands.includes(item.type)
		) {
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
	return monster;
}

function simulateSoloKill({ profile, skill, bandIndex, candidate, minimumLevel, data }) {
	const context = `${profile}/${skill}/band-${bandIndex}/${candidate.id}`;
	validateCandidateShape(candidate, context);
	const mainResolution = validateItemRoute(skill, candidate.slots, minimumLevel, data, context);
	const monster = validateMonsterRoute(candidate.monster, data, context);
	const slots = slotInstances(candidate.slots);
	const stats = calculateStats({
		slots,
		items: data.items,
		conditions: {},
		conditionDefinitions: data.conditions,
	});
	if (stats.attack <= 0) throw new Error(`Benchmark route ${context} produces zero attack`);
	const rng = createSeededRandom(`${profile}:${skill}:${bandIndex}:${candidate.id}`);
	const encounterId = `${context}:encounter`;
	const actionId = `${context}:action`;
	const ledger = new ContributionLedger({ now: () => 0 });
	ledger.openEncounter(encounterId, { monster: candidate.monster });
	ledger.snapshotAction({
		actionId,
		characterId: "benchmark-player",
		activeSkill: skill,
		encounterIds: [encounterId],
		kind: "combat",
	});
	const defenseKey = mainResolution.profile.damage_type === "magical" ? "resistance" : "armor";
	const pierceKey = mainResolution.profile.damage_type === "magical" ? "rpiercing" : "apiercing";
	let hp = monster.hp;
	let elapsedMs = 0;
	let hits = 0;
	let rogueStacks = 0;
	const maxHits = 200000;
	while (hp > 0) {
		hits += 1;
		if (hits > maxHits) throw new Error(`Benchmark route ${context} exceeded hit safety limit`);
		let attack = stats.attack;
		if (skill === "rogue" && data.stackMax > 0) {
			rogueStacks = Math.min(data.stackMax, rogueStacks + 1);
			attack += rogueStacks;
		}
		if (stats.crit > 0 && rng() * 100 < stats.crit) {
			attack *= 2 + (stats.critdamage || 0) / 100;
		}
		let damage = Math.ceil(Math.ceil(attack * (0.9 + rng() * 0.2)) * data.damageMultiplier((monster[defenseKey] || 0) - (stats[pierceKey] || 0)));
		if (mainResolution.profile.damage_type === "physical" && monster.evasion && rng() * 100 < monster.evasion) damage = 0;
		else if (monster.avoidance && rng() * 100 < monster.avoidance) damage = 0;
		damage = Math.max(0, damage);
		const hpBefore = hp;
		hp = Math.max(0, hp - damage);
		ledger.recordDamage({
			encounterId,
			actionId,
			characterId: "benchmark-player",
			skill,
			amount: damage,
			hpBefore,
			hpAfter: hp,
		});
		elapsedMs += stats.attack_ms;
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
		external_party_characters: Number(candidate.external_party_characters || 0),
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
	};
}

function chooseCandidate(mode, candidates, baselineRate) {
	if (!candidates.length) throw new Error("Benchmark band has no candidates");
	if (mode === "fixed") return candidates[0];
	if (mode === "closest_target") {
		const target = baselineRate * 3;
		return candidates
			.slice()
			.sort(
				(a, b) =>
					Math.abs(a.rate_per_hour - target) - Math.abs(b.rate_per_hour - target) ||
					a.rate_per_hour - b.rate_per_hour ||
					a.id.localeCompare(b.id),
			)[0];
	}
	if (mode === "max_rate") {
		return candidates
			.slice()
			.sort((a, b) => b.rate_per_hour - a.rate_per_hour || a.id.localeCompare(b.id))[0];
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
	for (const [bandIndex, band] of (plan.bands || []).entries()) {
		if (!Array.isArray(band.candidates) || !band.candidates.length)
			throw new Error(`Benchmark plan ${profile}/${skill}/band-${bandIndex} has no candidates`);
		const minimumLevel = Number(band.from_level || player.skills[skill].level || 1);
		const targetXp = band.to_level >= 99 ? MAX_XP : cumulativeXp(Number(band.to_level || 99));
		const evaluatedCandidates = band.candidates.map((candidate) =>
			simulateSoloKill({ profile, skill, bandIndex, candidate, minimumLevel, data }),
		);
		const selected = chooseCandidate(plan.selection_mode, evaluatedCandidates, baselineRate || evaluatedCandidates[0].rate_per_hour);
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
			external_party_characters: selected.external_party_characters,
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
	const ratePerHour = durationMs > 0 ? (player.t.skill_xp[skill] * 3600000) / durationMs : 0;
	const rateX = baselineRate > 0 ? Number((ratePerHour / baselineRate).toFixed(6)) : 1;
	return {
		profile,
		skill,
		strategy: plan.strategy,
		duration_hours: durationHours,
		target_hours: targetHours,
		rate_x: profile === "starter" ? 1 : rateX,
		within_target: Math.abs(durationHours - targetHours) / targetHours <= progression.BENCHMARK_TOLERANCE,
		bands,
		player_state: {
			level: player.skills[skill].level,
			xp: player.skills[skill].xp,
			total_level: player.total_level,
		},
	};
}

function merchantStarterResult(route) {
	let state = createMerchantAccrual("benchmark-merchant");
	let xp = 0;
	let hours = 0;
	while (xp < MAX_XP && hours < TARGET_HOURS.starter + 1) {
		const now = hours * progression.STAND_HOUR_MS;
		const settled = settleStand(state, progression.STAND_HOUR_MS, now + progression.STAND_HOUR_MS);
		state = settled.state;
		xp += settled.xp;
		hours += 1;
	}
	return {
		profile: "starter",
		strategy: route.strategy,
		duration_hours: hours,
		target_hours: TARGET_HOURS.starter,
		within_target: hours === TARGET_HOURS.starter,
		xp,
		base_xp: MAX_XP,
		max_rolling_multiplier: 6,
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

function addSaleCredits(state, profile, hour, now, count, serverTax) {
	for (let index = 0; index < count; index += 1) {
		const result = recordSale(state, {
			merchantOwnerId: `${profile}:merchant`,
			externalOwnerId: `${profile}:buyer:${hour}:${index}`,
			goldReceived: 100000,
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

function runMerchantProfile(profile, route) {
	if (profile === "starter") return merchantStarterResult(route);
	let state = createMerchantAccrual("benchmark-merchant");
	let xp = 0;
	let hours = 0;
	let level40ReachedAt = null;
	while (xp < MAX_XP && hours < TARGET_HOURS[profile] + 1) {
		const now = hours * progression.STAND_HOUR_MS;
		const settlementAt = now + progression.STAND_HOUR_MS;
		const afterLevel40 = xp >= cumulativeXp(40);
		if (afterLevel40 && level40ReachedAt === null) level40ReachedAt = hours;
		if (profile === "competent") {
			if (!afterLevel40) state = addSaleCredits(state, profile, hours, settlementAt, 10, 14000);
			else {
				state = addLuckCredits(state, profile, hours, settlementAt, 5);
				state = addSaleCredits(state, profile, hours, settlementAt, 5, [10867, 10867, 10867, 10867, 129]);
			}
		} else {
			if (!afterLevel40) state = addSaleCredits(state, profile, hours, settlementAt, 50, 14000);
			else {
				state = addLuckCredits(state, profile, hours, settlementAt, 10);
				state = addSaleCredits(state, profile, hours, settlementAt, 10, 14000);
			}
		}
		const settled = settleStand(state, progression.STAND_HOUR_MS, settlementAt);
		state = settled.state;
		xp += settled.xp;
		hours += 1;
	}
	return {
		profile,
		strategy: route.strategy,
		duration_hours: hours,
		target_hours: TARGET_HOURS[profile],
		within_target: hours === TARGET_HOURS[profile],
		xp,
		base_xp: MAX_XP,
		max_rolling_multiplier: 6,
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
		benchmark_tolerance: progression.BENCHMARK_TOLERANCE,
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
	for (const skill of COMBAT_SKILLS) combat.starter[skill] = evaluateCombatPlan("starter", skill, regenerated.combat.starter[skill], data, null);
	for (const skill of COMBAT_SKILLS) {
		const baseline = combat.starter[skill].bands[0].rate_per_hour;
		combat.competent[skill] = evaluateCombatPlan("competent", skill, regenerated.combat.competent[skill], data, baseline);
		combat.optimized[skill] = evaluateCombatPlan("optimized", skill, regenerated.combat.optimized[skill], data, baseline);
	}
	const merchant = {};
	for (const profile of MERCHANT_PROFILES) merchant[profile] = runMerchantProfile(profile, regenerated.merchant[profile]);
	const targetAlignment = Object.values(combat).every((profile) =>
		Object.values(profile).every((result) => result.within_target),
	);
	const merchantTargetAlignment = Object.values(merchant).every((result) => result.within_target);
	const styleParity = Object.values(combat).every((profile) => {
		const durations = Object.values(profile).map((result) => result.duration_hours);
		return Math.max(...durations) / Math.min(...durations) <= 1.15;
	});
	const routeLegality = Object.values(combat).every((profile) =>
		Object.values(profile).every((result) => result.bands.every((band) => Boolean(band.selected_candidate_id))),
	);
	const expectedCombatPass = Object.entries(combat).every(([profile, results]) =>
		Object.entries(results).every(([skill, result]) =>
			matchesExpected(summarizeCombatExpected(result), regenerated.combat[profile][skill].expected),
		),
	);
	const expectedMerchantPass = Object.entries(merchant).every(([profile, result]) =>
		matchesExpected(summarizeMerchantExpected(result), regenerated.merchant[profile].expected),
	);
	const fixtureStable = stableJson(regenerated) === stableJson(fixture);
	const ok = routeLegality && expectedCombatPass && expectedMerchantPass && fixtureStable;
	const strict_ok = ok && targetAlignment && merchantTargetAlignment && styleParity;
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
	};
	if (strictTargets && !report.strict_ok) report.ok = false;
	return report;
}

function main(argv = process.argv.slice(2)) {
	const format = argv.includes("--format=json") ? "json" : "text";
	const strictTargets = argv.includes("--strict-targets");
	const report = runBenchmark({ strictTargets });
	if (format === "json") process.stdout.write(JSON.stringify(report) + "\n");
	else process.stdout.write(JSON.stringify(report, null, 2) + "\n");
	if (!report.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
	COMBAT_SKILLS,
	FIXTURE_PATH,
	MERCHANT_PROFILES,
	generateFixture,
	loadBenchmarkData,
	loadFixture,
	runBenchmark,
	stableJson,
};
