"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const test = require("node:test");
const path = require("node:path");

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

test("benchmark loads the real curve and all six combat styles", () => {
	const data = loadBenchmarkData();

	assert.deepEqual(data.combatSkills, ["warrior", "paladin", "mage", "priest", "ranger", "rogue"]);
	assert.equal(data.skillXp[1], 0);
	assert.equal(data.skillXp[99], 900000000);
	assert.equal(data.progression.MAX_ACTION_UNITS_PER_HOUR, 15625000);
	assert.equal(data.items.blade.attack, 20);
	assert.equal(data.monsters.goo.xp, 100);
	assert.equal(COMBAT_SKILLS.length, 6);
});

test("full benchmark covers every combat style and Merchant profile", () => {
	const report = runBenchmark({ fixturePath: FIXTURE_PATH });

	assert.equal(report.ok, true, JSON.stringify(report.checks, null, 2));
	for (const profile of ["starter", "competent", "optimized"]) {
		assert.deepEqual(Object.keys(report.combat[profile]), COMBAT_SKILLS);
		assert.equal(report.merchant[profile].within_target, true);
	}
	assert.deepEqual(Object.keys(report.merchant), MERCHANT_PROFILES);
	assert.equal(report.checks.style_parity.pass, true);
	assert.equal(report.checks.merchant_base_clock.xp, 900000000);
});

test("fixture regeneration is byte-stable and does not rewrite the committed fixture", () => {
	const data = loadBenchmarkData();
	const fixture = loadFixture(FIXTURE_PATH);
	const regenerated = generateFixture(fixture, data);

	assert.equal(stableJson(regenerated), stableJson(fixture));
	assert.equal(fs.readFileSync(FIXTURE_PATH, "utf8"), stableJson(fixture));
});

test("all JSON CLI output is deterministic", () => {
	const tool = path.resolve(__dirname, "../tools/progression-benchmark.js");
	const options = { cwd: path.resolve(__dirname, ".."), encoding: "utf8" };
	const first = execFileSync(process.execPath, [tool, "--all", "--format=json"], options);
	const second = execFileSync(process.execPath, [tool, "--all", "--format=json"], options);

	assert.equal(first, second);
	const report = JSON.parse(first);
	assert.equal(report.ok, true);
	assert.equal(report.combat.optimized.rogue.duration_hours, 336);
});
