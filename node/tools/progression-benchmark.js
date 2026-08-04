"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { COMBAT_SKILL_IDS, MAX_XP, buildProgressionData, cumulativeXp } = require("../game/skill_domain");
const { progression } = require("../../design/progression");
const { createMerchantAccrual, settleStand, qualifyLuck, recordSale } = require("../game/merchant_progression");

const COMBAT_SKILLS = Object.freeze(COMBAT_SKILL_IDS.slice());
const MERCHANT_PROFILES = Object.freeze(["starter", "competent", "optimized"]);
const TARGET_HOURS = Object.freeze({ starter: 2016, competent: 672, optimized: 336 });
const BASE_XP_PER_HOUR = MAX_XP / TARGET_HOURS.starter;
const MERCHANT_LEVEL_40_XP = cumulativeXp(40);
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
	let level40ReachedAt = null;
	const maxHours = TARGET_HOURS[profile] + 1;
	while (xp < MAX_XP && hours < maxHours) {
		const now = hours * progression.STAND_HOUR_MS;
		const settlementAt = now + progression.STAND_HOUR_MS;
		const afterLevel40 = xp >= MERCHANT_LEVEL_40_XP;
		if (afterLevel40 && level40ReachedAt === null) level40ReachedAt = hours;
		if (profile === "competent") {
			if (!afterLevel40) state = addSaleCredits(state, profile, hours, settlementAt, 10, 14000);
			else {
				state = addLuckCredits(state, profile, hours, settlementAt, 5);
				state = addSaleCredits(state, profile, hours, settlementAt, 5, [10867, 10867, 10867, 10867, 129]);
			}
		} else if (profile === "optimized") {
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
		bounded: hours <= maxHours && xp >= MAX_XP,
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
				if (
					!Number.isFinite(Number(band.calibration || route.calibration)) ||
					Number(band.calibration || route.calibration) <= 0
				)
					throw new Error(`Missing reviewed calibration for ${profile}/${skill}`);
				if (routePower({ ...route, ...band }, skill, data) <= 0)
					throw new Error(`Benchmark route has no measurable power for ${profile}/${skill}`);
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
	const fixtureExpected = fixture.expected || {};
	const expectedCombatPass = Object.entries(fixtureExpected.combat_duration_hours || {}).every(([profile, expected]) =>
		Object.values(combat[profile] || {}).every((result) => result.duration_hours === expected),
	);
	const expectedMerchantPass = Object.entries(fixtureExpected.merchant_duration_hours || {}).every(
		([profile, expected]) => merchant[profile] && merchant[profile].duration_hours === expected,
	);
	const fixtureStable = stableJson(regenerated) === stableJson(fixture);
	return {
		schema_version: 1,
		ok:
			targetPass &&
			merchantPass &&
			styleParity &&
			routeLegality &&
			expectedCombatPass &&
			expectedMerchantPass &&
			fixtureStable,
		combat,
		merchant,
		checks: {
			style_parity: { pass: styleParity, max_rate_x: Math.max(...styleRates), min_rate_x: Math.min(...styleRates) },
			route_legality: { pass: routeLegality },
			merchant_base_clock: { pass: merchant.starter.xp === MAX_XP, xp: merchant.starter.xp },
			expected_outputs: { pass: expectedCombatPass && expectedMerchantPass },
			fixture_stable: fixtureStable,
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
