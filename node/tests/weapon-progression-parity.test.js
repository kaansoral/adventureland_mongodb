"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	PARITY_FIXTURE_PATH,
	LEGACY_BASELINE_PATH,
	buildParityReport,
	loadParityFixture,
	loadLegacyBaseline,
	validateParityFixture,
} = require("../tools/weapon-progression-parity");

test("parity fixture covers every current combat weapon or names an explicit exception", () => {
	const fixture = loadParityFixture(PARITY_FIXTURE_PATH);
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });

	assert.equal(validateParityFixture(fixture, report.data).missingWeapons.length, 0);
	assert.equal(validateParityFixture(fixture, report.data).unclassifiedWeapons.length, 0);
	assert.ok(report.rows.length > 0);
});

test("parity fixture has every upgrade band and canonical target archetype", () => {
	const fixture = loadParityFixture(PARITY_FIXTURE_PATH);
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });

	for (const row of report.rows) assert.deepEqual(row.upgrade_levels, [0, 1, 2, 3, 4]);
	for (const band of fixture.mob_bands) {
		assert.deepEqual(Object.keys(band.targets).sort(), ["magical", "physical", "physical_evasion"]);
	}
	assert.deepEqual(
		fixture.mob_bands.map((band) => band.from_level),
		[1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95],
	);
});

test("legacy baseline is pinned to the selected pre-skill/class revision", () => {
	const baseline = loadLegacyBaseline(LEGACY_BASELINE_PATH);

	assert.equal(baseline.source_revision, "99d1a8672438227948caf5a5f8c9d595466d8019");
	assert.deepEqual(baseline.legacy_levels, [1, 40, 41, 55, 56, 65, 66, 80, 81, 99]);
});

test("parity output is deterministic and reports per-row current-versus-legacy deltas", () => {
	const first = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });
	const second = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });

	assert.equal(JSON.stringify(first.rows), JSON.stringify(second.rows));
	assert.equal(first.source_revision, second.source_revision);
	for (const row of first.rows) {
		for (const measurement of row.measurements) {
			for (const upgrade of measurement.upgrades) {
				assert.ok(Number.isFinite(upgrade.current.attack));
				assert.ok(Number.isFinite(upgrade.current.frequency));
				assert.ok(Number.isFinite(upgrade.current.ttk_ms));
				assert.ok(Number.isFinite(upgrade.legacy.ttk_ms));
				assert.ok(Number.isFinite(upgrade.ttk_delta));
			}
		}
	}
});
