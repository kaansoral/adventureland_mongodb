"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
	FIXTURE_PATH,
	COMBAT_SKILLS,
	MERCHANT_PROFILES,
	generateFixture,
	loadBenchmarkData,
	loadFixture,
	runBenchmark,
	stableJson,
} = require("../tools/progression-benchmark");

test("benchmark loads production progression, stat, and merchant data", () => {
	const data = loadBenchmarkData();

	assert.deepEqual(data.combatSkills, ["warrior", "paladin", "mage", "priest", "ranger", "rogue"]);
	assert.equal(data.skillXp[1], 0);
	assert.equal(data.skillXp[99], 900000000);
	assert.equal(data.progression.MAX_ACTION_UNITS_PER_HOUR, 15625000);
	assert.equal(data.items.blade.attack, 20);
	assert.equal(data.monsters.goo.xp, 100);
	assert.equal(typeof data.damageMultiplier, "function");
	assert.equal(COMBAT_SKILLS.length, 6);
});

test("full benchmark covers every combat style and Merchant profile with stable reviewed outputs", () => {
	const report = runBenchmark({ fixturePath: FIXTURE_PATH });

	assert.equal(report.ok, true, JSON.stringify(report.checks, null, 2));
	assert.equal(report.strict_ok, false);
	for (const profile of ["starter", "competent", "optimized"]) {
		assert.deepEqual(Object.keys(report.combat[profile]), COMBAT_SKILLS);
		assert.deepEqual(Object.keys(report.merchant), MERCHANT_PROFILES);
	}
	assert.equal(report.checks.route_legality.pass, true);
	assert.equal(report.checks.expected_outputs.pass, true);
	assert.equal(report.checks.fixture_stable, true);
	assert.equal(report.checks.target_alignment.pass, false);
});

test("fixture regeneration is byte-stable and preserves the committed reviewed expectations", () => {
	const data = loadBenchmarkData();
	const fixture = loadFixture(FIXTURE_PATH);
	const regenerated = generateFixture(fixture, data);

	assert.equal(stableJson(regenerated), stableJson(fixture));
	assert.equal(fs.readFileSync(FIXTURE_PATH, "utf8"), stableJson(fixture));
});

test("strict target mode exits nonzero when the real harness misses the plan targets", () => {
	const tool = path.resolve(__dirname, "../tools/progression-benchmark.js");
	const result = spawnSync(process.execPath, [tool, "--strict-targets", "--format=json"], {
		cwd: path.resolve(__dirname, ".."),
		encoding: "utf8",
	});

	assert.equal(result.status, 1);
	const report = JSON.parse(result.stdout);
	assert.equal(report.ok, false);
	assert.equal(report.strict_ok, false);
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
	assert.equal(report.strict_ok, false);
});

test("benchmark rejects calibration-only fixture fields", () => {
	const fixture = loadFixture(FIXTURE_PATH);
	const broken = structuredClone(fixture);
	broken.combat.starter.warrior.calibration = 1;

	assert.throws(() => generateFixture(broken, loadBenchmarkData()), /Calibration is not permitted/);
});
