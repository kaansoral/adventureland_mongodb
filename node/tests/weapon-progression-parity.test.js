"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
	PARITY_FIXTURE_PATH,
	LEGACY_BASELINE_PATH,
	buildParityReport,
	loadParityFixture,
	loadLegacyBaseline,
	loadPropertyCalculators,
	validateParityFixture,
} = require("../tools/weapon-progression-parity");

test("parity fixture covers every current combat weapon or names an explicit exception", () => {
	const fixture = loadParityFixture(PARITY_FIXTURE_PATH);
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });

	assert.equal(validateParityFixture(fixture, report.data).missingWeapons.length, 0);
	assert.equal(validateParityFixture(fixture, report.data).unclassifiedWeapons.length, 0);
	assert.ok(report.rows.length > 0);
	assert.equal(report.rows.length, 80);
	assert.ok(report.handoffs.length > 0);
	for (const handoff of report.handoffs) {
		assert.ok(handoff.comparisons.length > 0, handoff.family);
		for (const comparison of handoff.comparisons) {
			assert.ok(Number.isFinite(comparison.ttk_delta));
			assert.ok(comparison.ttk_delta > -1);
		}
	}
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
	assert.equal(baseline.snapshot_sha256, "c3135f7c4e5b10f6143db357d5f0b688d5bcb407ebca7f3f8615644993582102");
	assert.deepEqual(baseline.legacy_levels, [1, 40, 41, 55, 56, 65, 66, 80, 81, 99]);
});

test("parity output is deterministic and reports per-row current-versus-legacy deltas", () => {
	const first = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });
	const second = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });

	assert.equal(JSON.stringify(first.rows), JSON.stringify(second.rows));
	assert.equal(first.source_revision, second.source_revision);
	assert.deepEqual(first.handoffs, second.handoffs);
	for (const row of first.rows) {
		for (const measurement of row.measurements) {
			for (const upgrade of measurement.upgrades) {
				assert.ok(Number.isFinite(upgrade.current.attack));
				assert.ok(Number.isFinite(upgrade.current.frequency));
				assert.ok(Number.isFinite(upgrade.current.ttk_ms));
				assert.ok(Number.isFinite(upgrade.legacy.ttk_ms));
				assert.ok(upgrade.current.hit_chance > 0 && upgrade.current.hit_chance <= 1);
				assert.ok(upgrade.legacy.hit_chance > 0 && upgrade.legacy.hit_chance <= 1);
				assert.ok(Number.isFinite(upgrade.ttk_delta));
			}
		}
	}
});

test("represented weapons retain their protected identity and finite +0 through +4 properties", () => {
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });
	const calculators = loadPropertyCalculators(report.data);
	for (const row of report.rows) {
		const definition = report.data.items[row.weapon_id];
		assert.equal(definition.type, "weapon", row.weapon_id);
		assert.equal(definition.wtype, row.weapon_type, row.weapon_id);
		assert.equal(definition.requirements.length, 1, row.weapon_id);
		for (const upgradeLevel of row.upgrade_levels) {
			const properties = calculators.current.calculate_item_properties({ name: row.weapon_id, level: upgradeLevel });
			for (const [property, value] of Object.entries(properties)) {
				if (typeof value === "number") assert.ok(Number.isFinite(value), `${row.weapon_id}+${upgradeLevel} ${property}`);
			}
			for (const attribute of ["str", "int", "dex"])
				assert.ok((properties[attribute] || 0) <= 20, `${row.weapon_id}+${upgradeLevel} keeps ${attribute} within budget`);
		}
	}
});

test("weapon normalization retains specialized hit and piercing mechanics", () => {
	const itemCatalog = fs.readFileSync(path.resolve(__dirname, "../../design/items.js"), "utf8");
	assert.doesNotMatch(itemCatalog, /delete\s+normalized_weapon\.(?:apiercing|rpiercing|miss)/);
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });
	const calculators = loadPropertyCalculators(report.data);
	for (const [weaponId, mechanics] of Object.entries({
		mushroomstaff: { rpiercing: 40 },
		hbow: { apiercing: 40 },
		daggerofthedead: { apiercing: 20 },
		spearofthedead: { apiercing: 12 },
	})) {
		const properties = calculators.current.calculate_item_properties({ name: weaponId, level: 0 });
		for (const [property, value] of Object.entries(mechanics)) assert.equal(properties[property], value, weaponId);
	}
});

test("normalized class curve keeps every +0 through +4 band and adjacent unlock handoff in range", () => {
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });
	assert.equal(report.curve.checks.length, 400);
	assert.equal(report.curve.checks.filter((check) => check.curve_pass).length, report.curve.checks.length);
	assert.equal(report.curve.handoffs.length, 36);
	for (const handoff of report.curve.handoffs) {
		assert.equal(handoff.comparisons.length, 3, handoff.family);
		for (const comparison of handoff.comparisons) {
			assert.ok(comparison.ttk_delta >= 0.05 && comparison.ttk_delta <= 0.1, `${handoff.family} ${comparison.archetype}`);
			assert.equal(comparison.progression_pass, true, `${handoff.family} ${comparison.archetype}`);
		}
	}
});
