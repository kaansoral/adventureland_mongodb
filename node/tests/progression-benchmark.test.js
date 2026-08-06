"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	FIXTURE_PATH,
	COMBAT_SKILLS,
	MERCHANT_PROFILES,
	abilityDamageAgainst,
	chooseCandidate,
	enumerateCanonicalCandidates,
	generateFixture,
	loadBenchmarkData,
	loadFixture,
	loadTargetOracle,
	runMerchantProfile,
	runBenchmark,
	stableJson,
} = require("../tools/progression-benchmark");

test("benchmark loads production progression, stat, and merchant data", () => {
	const data = loadBenchmarkData();

	assert.deepEqual(data.combatSkills, ["warrior", "paladin", "mage", "priest", "ranger", "rogue"]);
	assert.equal(data.skillXp[1], 0);
	assert.equal(data.skillXp[99], 900000000);
	assert.equal(data.progression.MAX_ACTION_UNITS_PER_HOUR, 15625000);
	assert.equal(data.items.blade.attack, 12);
	assert.equal(data.monsters.goo.xp, 1388);
	assert.equal(Object.keys(data.sets).length, 18);
	assert.ok(data.sets.tiger);
	assert.equal(typeof data.damageMultiplier, "function");
	assert.equal(COMBAT_SKILLS.length, 6);
});

test("ability damage uses the ability damage type instead of the weapon damage type", () => {
	const data = loadBenchmarkData();
	const ability = { name: "mentalburst", definition: data.abilities.mentalburst };
	const stats = { attack: 100, max_mp: 100, apiercing: 0, rpiercing: 0 };
	const physicalWeapon = { profile: { damage_type: "physical" } };
	const monster = { armor: 0, resistance: 500 };

	const expected = Math.ceil(Math.ceil(60) * data.damageMultiplier(500));
	assert.equal(abilityDamageAgainst(ability, stats, monster, physicalWeapon, data), expected);
	assert.notEqual(abilityDamageAgainst(ability, stats, monster, physicalWeapon, data), 60);

	const pureAbility = { name: "burst", definition: data.abilities.burst };
	assert.equal(abilityDamageAgainst(pureAbility, stats, monster, physicalWeapon, data), 55);
});

test("full benchmark covers every combat style and Merchant profile with stable reviewed outputs", () => {
	const report = runBenchmark({ fixturePath: FIXTURE_PATH });

	assert.equal(report.ok, true, JSON.stringify(report.checks, null, 2));
	assert.equal(report.strict_ok, true);
	for (const profile of ["starter", "competent", "optimized"]) {
		assert.deepEqual(Object.keys(report.combat[profile]), COMBAT_SKILLS);
		assert.deepEqual(Object.keys(report.merchant), MERCHANT_PROFILES);
	}
	assert.equal(report.checks.route_legality.pass, true);
	assert.equal(report.checks.expected_outputs.pass, true);
	assert.equal(report.checks.fixture_stable, true);
	assert.equal(report.checks.target_alignment.pass, true);
	assert.equal(report.checks.style_parity.pass, true);
});

test("fixture regeneration is byte-stable and preserves the committed reviewed expectations", () => {
	const data = loadBenchmarkData();
	const fixture = loadFixture(FIXTURE_PATH);
	const regenerated = generateFixture(fixture, data);

	assert.equal(stableJson(regenerated), stableJson(fixture));
	assert.equal(fs.readFileSync(FIXTURE_PATH, "utf8"), stableJson(fixture));
});

test("strict target mode stays green when the reviewed routes meet the plan targets", () => {
	const tool = path.resolve(__dirname, "../tools/progression-benchmark.js");
	const result = spawnSync(process.execPath, [tool, "--strict-targets", "--format=json"], {
		cwd: path.resolve(__dirname, ".."),
		encoding: "utf8",
	});

	assert.equal(result.status, 0);
	const report = JSON.parse(result.stdout);
	assert.equal(report.ok, true);
	assert.equal(report.strict_ok, true);
	assert.equal(report.checks.target_alignment.pass, true);
	assert.equal(report.checks.style_parity.pass, true);
});

test("strict targets come from the checked-in independent target oracle", () => {
	const oracle = loadTargetOracle();
	assert.deepEqual(oracle.targetHours, { starter: 2016, competent: 672, optimized: 336 });
	assert.equal(oracle.durationTolerance, 0.1);
	assert.equal(oracle.styleParityRatio, 1.15);
});

test("Merchant benchmark routes use common progression and report cap measurements", () => {
	const fixture = loadFixture(FIXTURE_PATH);
	const merchant = Object.fromEntries(MERCHANT_PROFILES.map((profile) => [profile, runMerchantProfile(profile, fixture.merchant[profile])]));

	for (const profile of MERCHANT_PROFILES) assert.deepEqual(merchant[profile].schedule, fixture.merchant[profile].schedule);
	assert.equal(merchant.starter.base_xp, 900000000);
	assert.equal(merchant.starter.bonus_xp, 0);
	for (const profile of ["competent", "optimized"]) {
		assert.ok(merchant[profile].bonus_xp > 0);
		assert.ok(merchant[profile].base_units > 0);
		assert.ok(merchant[profile].bonus_units > 0);
		assert.ok(merchant[profile].max_rolling_multiplier <= 6);
	}
});

test("benchmark expected outputs are independent of fixture regeneration", () => {
	const fixture = loadFixture(FIXTURE_PATH);
	const broken = structuredClone(fixture);
	broken.combat.starter.warrior.expected.duration_hours += 1;
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "progression-benchmark-"));
	const filename = path.join(directory, "routes.json");
	fs.writeFileSync(filename, stableJson(broken));

	const report = runBenchmark({ fixturePath: filename });
	assert.equal(report.checks.expected_outputs.pass, false);
	assert.equal(report.ok, false);
});

test("default CLI status fails when a stable reviewed fixture misses a target", () => {
	const fixture = loadFixture(FIXTURE_PATH);
	const altered = structuredClone(fixture);
	altered.combat.competent.warrior.bands[0].candidates[0].uptime = 1;
	const generated = generateFixture(altered, loadBenchmarkData());
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "progression-benchmark-"));
	const filename = path.join(directory, "routes.json");
	fs.writeFileSync(filename, stableJson(generated));
	const tool = path.resolve(__dirname, "../tools/progression-benchmark.js");
	const result = spawnSync(process.execPath, [tool, `--fixture=${filename}`, "--format=json"], {
		cwd: path.resolve(__dirname, ".."),
		encoding: "utf8",
	});

	assert.notEqual(result.status, 0);
	const report = JSON.parse(result.stdout);
	assert.equal(report.checks.fixture_stable, true);
	assert.equal(report.checks.expected_outputs.pass, true);
	assert.equal(report.checks.target_alignment.pass, false);
});

test("all JSON CLI output is deterministic", () => {
	const tool = path.resolve(__dirname, "../tools/progression-benchmark.js");
	const options = { cwd: path.resolve(__dirname, ".."), encoding: "utf8" };
	const first = execFileSync(process.execPath, [tool, "--format=json"], options);
	const second = execFileSync(process.execPath, [tool, "--format=json"], options);

	assert.equal(first, second);
	const report = JSON.parse(first);
	assert.equal(report.ok, true);
	assert.equal(report.strict_ok, true);
});

test("benchmark rejects calibration-only fixture fields", () => {
	const fixture = loadFixture(FIXTURE_PATH);
	const broken = structuredClone(fixture);
	broken.combat.starter.warrior.calibration = 1;

	assert.throws(() => generateFixture(broken, loadBenchmarkData()), /Calibration is not permitted/);
});

test("canonical candidates retain legal high-grade items and permanent normal targets", () => {
	const data = loadBenchmarkData();
	const fixture = loadFixture(FIXTURE_PATH);
	const plan = fixture.combat.competent.warrior;
	const template = plan.candidate_template;
	const routes = enumerateCanonicalCandidates({
		profile: "competent",
		skill: "warrior",
		plan,
		band: {
			template,
			monster_source: "all_normal",
			loadout_slots: ["mainhand", "helmet", "shoes"],
			party_counts: [0],
		},
		skillLevels: { warrior: 1, paladin: 1, mage: 1, priest: 1, ranger: 1, rogue: 1, merchant: 1 },
		data,
	});

	assert.ok(routes.length > 0);
	assert.ok(routes.some((route) => route.slots.helmet === "oxhelmet"));
	assert.ok(routes.every((route) => route.enumeration_source === "canonical"));
	assert.ok(routes.every((route) => route.monster !== "target"));
	assert.ok(routes.every((route) => route.simulation_mode === "projected"));
	const optimizedPlan = fixture.combat.optimized.warrior;
	const optimizedRoutes = enumerateCanonicalCandidates({
		profile: "optimized",
		skill: "warrior",
		plan: optimizedPlan,
		band: {
			template: optimizedPlan.bands[0].candidates[0],
			monster_source: "all_normal",
			loadout_slots: optimizedPlan.loadout_slots,
			party_counts: optimizedPlan.party_counts,
		},
		skillLevels: { warrior: 1, paladin: 1, mage: 1, priest: 1, ranger: 1, rogue: 1, merchant: 1 },
		data,
	});
	assert.deepEqual([...new Set(optimizedRoutes.map((route) => route.external_party_characters))], [0, 1]);
});

test("candidate selection enforces the competent ceiling and deterministic tie breaks", () => {
	const candidate = (id, rate, requirement_level_sum, external_party_characters = 0) => ({
		id,
		rate_per_hour: rate,
		xp_per_kill: 1,
		requirement_level_sum,
		external_party_characters,
		slots: { mainhand: id },
		monster: "goo",
	});

	const closest = chooseCandidate("closest_target", [
		candidate("over-cap", 3.11, 1),
		candidate("higher-requirement", 3, 20),
		candidate("lower-requirement", 3, 10),
	], 1);
	assert.equal(closest.id, "lower-requirement");

	const maximum = chooseCandidate("max_rate", [
		candidate("party", 6, 1, 1),
		candidate("solo-z", 6, 1, 0),
		candidate("solo-a", 6, 1, 0),
	], 1);
	assert.equal(maximum.id, "solo-a");
});
