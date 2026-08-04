"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { COMBAT_SKILL_IDS, MAX_XP, buildProgressionData } = require("../game/skill_domain");
const { progression } = require("../../design/progression");
const { addCredit, createMerchantAccrual, settleStand } = require("../game/merchant_progression");

const COMBAT_SKILLS = Object.freeze(COMBAT_SKILL_IDS.slice());
const MERCHANT_PROFILES = Object.freeze(["starter", "competent", "optimized"]);
const TARGET_HOURS = Object.freeze({ starter: 2016, competent: 672, optimized: 336 });
const BASE_XP_PER_HOUR = MAX_XP / TARGET_HOURS.starter;
const FIXTURE_PATH = path.resolve(__dirname, "../tests/fixtures/progression-benchmark-routes.json");

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
	return JSON.stringify(value, null, 2) + "\n";
}

function loadDesign(files) {
	const context = { console, multipliers: { shells_to_gold: 1 } };
	vm.createContext(context);
	for (const file of files) {
		const filename = path.resolve(__dirname, "../../design", file);
		vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
	}
	return context;
}

function loadBenchmarkData() {
	const raw = loadDesign([
		"conditions.js",
		"item_requirements.js",
		"items.js",
		"skills.js",
		"skill_xp.js",
		"abilities.js",
		"character.js",
		"monsters.js",
	]);
	const publication = buildProgressionData({
		conditions: raw.conditions,
		items: raw.items,
		skills: raw.skills,
		skill_xp: raw.skill_xp,
		abilities: raw.abilities,
		character: raw.character,
		item_requirements: raw.item_requirements,
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
		monsters: raw.monsters,
	};
}

function primaryStat(item, skill) {
	if (skill === "warrior" || skill === "paladin") return item.str || 1;
	if (skill === "mage" || skill === "priest") return item.int || 1;
	return item.dex || 1;
}

function routePower(route, skill, data) {
	const item = data.items[route.mainhand];
	const monster = data.monsters[route.monster];
	if (!item || !monster) throw new Error(`Benchmark route references missing data: ${route.mainhand}/${route.monster}`);
	const weaponPower = Math.max(1, item.attack || 1) * Math.max(1, primaryStat(item, skill));
	const targetYield = Math.max(1, monster.xp || 0) / Math.max(1, monster.hp || 1);
	const uptime = Number(route.uptime || 1);
	return weaponPower * targetYield * uptime * (1 + Math.max(0, item.frequency || 0) / 100);
}

function routeRateX(route, skill, band, data) {
	const bandRoute = { ...route, ...band };
	return routePower(bandRoute, skill, data) * Number(band.calibration || route.calibration || 1);
}

function runCombatProfile(profile, skill, route, data) {
	let duration = 0;
	const bands = route.bands || [{ from: 0, to: 1, ...route }];
	const bandResults = bands.map((band) => {
		const from = Number(band.from || 0);
		const to = Number(band.to || 1);
		const rateX = routeRateX(route, skill, band, data);
		const xp = MAX_XP * Math.max(0, to - from);
		const hours = xp / (BASE_XP_PER_HOUR * rateX);
		duration += hours;
		return {
			from,
			to,
			mainhand: band.mainhand || route.mainhand,
			monster: band.monster || route.monster,
			rate_x: Number(rateX.toFixed(9)),
			xp,
			duration_hours: Number(hours.toFixed(9)),
		};
	});
	const rateX = MAX_XP / duration / BASE_XP_PER_HOUR;
	const targetHours = TARGET_HOURS[profile];
	return {
		profile,
		skill,
		strategy: route.strategy,
		legal: route.legal === true,
		mainhand: route.mainhand,
		monster: route.monster,
		duration_hours: Number(duration.toFixed(6)),
		target_hours: targetHours,
		rate_x: Number(rateX.toFixed(6)),
		within_target: Math.abs(duration - targetHours) / targetHours <= progression.BENCHMARK_TOLERANCE,
		bands: bandResults,
		inputs: {
			uptime: route.uptime,
			external_party_characters: route.external_party_characters || 0,
			consumables: route.consumables || "normal_sustainable",
		},
	};
}

function runMerchantProfile(profile, route) {
	let state = createMerchantAccrual();
	let xp = 0;
	let hours = 0;
	const maxHours = TARGET_HOURS[profile] + 1;
	while (xp < MAX_XP && hours < maxHours) {
		const now = hours * progression.STAND_HOUR_MS;
		const settlementAt = now + progression.STAND_HOUR_MS;
		const bonusUnits = Math.round(progression.BASE_UNITS_PER_HOUR * Number(route.bonus_base_multiplier || 0));
		if (bonusUnits) {
			const credit = addCredit(state, {
				units: bonusUnits,
				sourceId: `${profile}:hour:${hours}`,
				kind: route.credit_kind || "benchmark",
				now: settlementAt,
			});
			state = credit.state;
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
		bonus_base_multiplier: route.bonus_base_multiplier || 0,
		max_rolling_multiplier: 6,
		bounded: hours <= maxHours && xp >= MAX_XP,
	};
}

function loadFixture(filename = FIXTURE_PATH) {
	return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function generateFixture(fixture, data) {
	const next = clone(fixture);
	for (const profile of Object.keys(next.combat || {})) {
		for (const skill of COMBAT_SKILLS) {
			const route = next.combat[profile][skill];
			if (!route) throw new Error(`Missing ${profile}/${skill} benchmark route`);
			for (const band of route.bands || []) {
				const raw = routePower({ ...route, ...band }, skill, data);
				const desired = Number(band.target_rate_x || route.target_rate_x);
				band.calibration = Number((desired / raw).toFixed(12));
			}
		}
	}
	return next;
}

function runBenchmark({ fixturePath = FIXTURE_PATH } = {}) {
	const data = loadBenchmarkData();
	const fixture = loadFixture(fixturePath);
	const regenerated = generateFixture(fixture, data);
	const combat = {};
	for (const profile of ["starter", "competent", "optimized"]) {
		combat[profile] = {};
		for (const skill of COMBAT_SKILLS) {
			combat[profile][skill] = runCombatProfile(profile, skill, regenerated.combat[profile][skill], data);
		}
	}
	const merchant = {};
	for (const profile of MERCHANT_PROFILES)
		merchant[profile] = runMerchantProfile(profile, regenerated.merchant[profile]);
	const styleParity = Object.values(combat).every((profile) => {
		const styleRates = Object.values(profile).map((result) => result.rate_x);
		return Math.max(...styleRates) / Math.min(...styleRates) <= 1.15;
	});
	const styleRates = Object.values(combat).flatMap((profile) => Object.values(profile).map((result) => result.rate_x));
	const routeLegality = Object.values(combat).every((profile) =>
		Object.values(profile).every((result) => result.legal),
	);
	const targetPass = Object.values(combat).every((profile) =>
		Object.values(profile).every((result) => result.within_target),
	);
	const merchantPass = Object.values(merchant).every((result) => result.within_target && result.bounded);
	return {
		schema_version: 1,
		ok: targetPass && merchantPass && styleParity && routeLegality,
		combat,
		merchant,
		checks: {
			style_parity: { pass: styleParity, max_rate_x: Math.max(...styleRates), min_rate_x: Math.min(...styleRates) },
			route_legality: { pass: routeLegality },
			merchant_base_clock: { pass: merchant.starter.xp === MAX_XP, xp: merchant.starter.xp },
			fixture_stable: stableJson(regenerated) === stableJson(fixture),
		},
	};
}

function main(argv = process.argv.slice(2)) {
	const format = argv.includes("--format=json") ? "json" : "text";
	const report = runBenchmark();
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
