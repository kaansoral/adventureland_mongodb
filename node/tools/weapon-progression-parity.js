"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { calculateStats } = require("../game/stats");
const { loadBenchmarkData, stableJson } = require("./progression-benchmark");

const PARITY_FIXTURE_PATH = path.resolve(__dirname, "../tests/fixtures/weapon-progression-parity.json");
const LEGACY_BASELINE_PATH = path.resolve(__dirname, "../tests/fixtures/weapon-progression-legacy-baseline.json");
const LEGACY_REVISION = "99d1a8672438227948caf5a5f8c9d595466d8019";
const COMBAT_SKILLS = Object.freeze(["warrior", "paladin", "mage", "priest", "ranger", "rogue"]);

function loadJson(filename) {
	return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function loadParityFixture(filename = PARITY_FIXTURE_PATH) {
	const fixture = loadJson(filename);
	if (
		!fixture ||
		fixture.schema_version !== 1 ||
		typeof fixture.catalog_manifest_sha256 !== "string" ||
		typeof fixture.catalog_identity_sha256 !== "string" ||
		!Array.isArray(fixture.weapons) ||
		!Array.isArray(fixture.upgrade_levels) ||
		!Array.isArray(fixture.mob_bands)
	)
		throw new Error("Weapon parity fixture is invalid");
	if (stableJson(fixture.upgrade_levels) !== stableJson([0, 1, 2, 3, 4]))
		throw new Error("Weapon parity fixture must cover upgrade levels 0 through 4");
	return fixture;
}

function loadLegacyBaseline(filename = LEGACY_BASELINE_PATH) {
	const baseline = loadJson(filename);
	if (!baseline || baseline.schema_version !== 2 || baseline.source_revision !== LEGACY_REVISION || !Array.isArray(baseline.legacy_levels) || !Array.isArray(baseline.rows) || !baseline.target_durability)
		throw new Error("Weapon parity legacy baseline is invalid");
	return baseline;
}

function loadVm(files, readFile) {
	const sandbox = {
		console: { log() {}, error() {} },
		Math,
		min: Math.min,
		max: Math.max,
		ceil: Math.ceil,
		round: Math.round,
		multipliers: { shells_to_gold: 1 },
		G: {},
	};
	vm.createContext(sandbox);
	for (const filename of files) vm.runInContext(readFile(filename), sandbox, { filename });
	return sandbox;
}

function loadPropertyCalculator(readFile, designFiles) {
	const sandbox = loadVm(designFiles, readFile);
	sandbox.G = { items: sandbox.items };
	vm.runInContext(readFile("old_common_functions.js"), sandbox, { filename: "old_common_functions.js" });
	return sandbox;
}

function loadPropertyCalculators(data) {
	const current = loadPropertyCalculator(
		(filename) => fs.readFileSync(path.resolve(__dirname, filename === "old_common_functions.js" ? "../../js" : "../../design", filename), "utf8"),
		["multipliers.js", "items.js"],
	);
	current.G.items = data.items;
	return { current };
}

function combatWeaponOwners(data) {
	const owners = new Map();
	for (const skill of COMBAT_SKILLS) {
		for (const weaponType of data.skills[skill].weapon_types || []) owners.set(weaponType, skill);
	}
	return owners;
}

function currentWeaponRows(data, fixture) {
	const owners = combatWeaponOwners(data);
	const exceptions = fixture.exceptions || {};
	const rows = [];
	for (const [weaponId, definition] of Object.entries(data.items)) {
		if (definition.type !== "weapon" || !owners.has(definition.wtype)) continue;
		const requirements = data.itemRequirements[weaponId] || [];
		const owner = owners.get(definition.wtype);
		if (exceptions[weaponId]) continue;
		if (requirements.length !== 1 || requirements[0].skill !== owner || !Number.isSafeInteger(requirements[0].level)) continue;
		rows.push({ weapon_id: weaponId, weapon_type: definition.wtype, damage_type: definition.damage_type, skill: owner, requirement_level: requirements[0].level });
	}
	return rows.sort((left, right) =>
		left.skill.localeCompare(right.skill) ||
		left.weapon_type.localeCompare(right.weapon_type) ||
		left.requirement_level - right.requirement_level ||
		left.weapon_id.localeCompare(right.weapon_id),
	);
}

function catalogIdentityManifest(data) {
	const owners = combatWeaponOwners(data);
	return Object.entries(data.items)
		.filter(([weaponId, definition]) => definition.type === "weapon" && owners.has(definition.wtype))
		.map(([weapon_id, definition]) => ({
			weapon_id,
			type: definition.type,
			weapon_type: definition.wtype,
			damage_type: definition.damage_type || null,
			tier: definition.tier || null,
			grades: definition.grades || null,
			projectile: definition.projectile || null,
			skin: definition.skin || null,
			requirements: data.itemRequirements[weapon_id] || [],
		}))
		.sort((left, right) => left.weapon_id.localeCompare(right.weapon_id));
}

function validateParityFixture(fixture, data) {
	const owners = combatWeaponOwners(data);
	const exceptions = fixture.exceptions || {};
	const catalogManifest = Object.entries(data.items)
		.filter(([id, definition]) => definition.type === "weapon" && owners.has(definition.wtype))
		.map(([weapon_id, definition]) => ({
			weapon_id,
			weapon_type: definition.wtype,
			damage_type: definition.damage_type,
			skill: owners.get(definition.wtype),
			requirement_level: (data.itemRequirements[weapon_id] || [])[0]?.level,
		}))
		.sort((left, right) => left.weapon_id.localeCompare(right.weapon_id));
	const fixtureManifest = [...fixture.weapons].sort((left, right) => left.weapon_id.localeCompare(right.weapon_id));
	if (stableJson(fixtureManifest) !== stableJson(catalogManifest)) throw new Error("Weapon parity fixture weapon manifest drifted; review every represented weapon and exception");
	if (fixture.catalog_manifest_sha256 !== crypto.createHash("sha256").update(JSON.stringify(catalogManifest)).digest("hex"))
		throw new Error("Weapon parity catalog manifest drifted; review the explicit 80-weapon manifest");
	if (fixture.catalog_identity_sha256 !== crypto.createHash("sha256").update(JSON.stringify(catalogIdentityManifest(data))).digest("hex"))
		throw new Error("Weapon parity protected catalog identity drifted");
	const classified = new Set(currentWeaponRows(data, fixture).map((row) => row.weapon_id));
	const missingWeapons = [];
	const unclassifiedWeapons = [];
	for (const [weaponId, definition] of Object.entries(data.items)) {
		if (definition.type !== "weapon" || !owners.has(definition.wtype)) continue;
		if (classified.has(weaponId) || exceptions[weaponId]) continue;
		missingWeapons.push(weaponId);
	}
	for (const [weaponId, exception] of Object.entries(exceptions)) {
		if (!data.items[weaponId] || !exception || typeof exception.reason !== "string" || !exception.reason) unclassifiedWeapons.push(weaponId);
	}
	return { missingWeapons: missingWeapons.sort(), unclassifiedWeapons: unclassifiedWeapons.sort() };
}

function buildHandoffs(rows) {
	const grouped = new Map();
	for (const row of rows) {
		const key = `${row.skill}:${row.weapon_type}:${row.damage_type}`;
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key).push(row);
	}
	return [...grouped.entries()].flatMap(([family, familyRows]) => {
		const levels = [...new Set(familyRows.map((row) => row.requirement_level))].sort((a, b) => a - b);
		return levels.slice(0, -1).map((level, index) => ({ family, from_level: level, to_level: levels[index + 1] }));
	});
}

function median(values) {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.floor(sorted.length / 2)];
}

function power(upgrade, side) {
	return upgrade[side].attack * upgrade[side].frequency;
}

function buildNormalizedCurve(rows, rawHandoffs) {
	const grouped = new Map();
	for (const row of rows) {
		const family = `${row.skill}:${row.weapon_type}:${row.damage_type}`;
		const key = `${family}:${row.requirement_level}`;
		if (!grouped.has(key)) grouped.set(key, { family, level: row.requirement_level, rows: [] });
		grouped.get(key).rows.push(row);
	}
	const families = new Map();
	for (const group of grouped.values()) {
		if (!families.has(group.family)) families.set(group.family, []);
		families.get(group.family).push(group);
	}
	const groups = [];
	for (const familyGroups of families.values()) {
		familyGroups.sort((left, right) => left.level - right.level);
		let targetZero;
		for (const group of familyGroups) {
			const zero = median(group.rows.map((row) => power(row.measurements[0].upgrades[0], "legacy")));
			const four = median(group.rows.map((row) => power(row.measurements[0].upgrades[4], "legacy")));
			if (targetZero === undefined) targetZero = zero;
			const targetFour = targetZero * (four / zero);
			groups.push({ ...group, target_zero: targetZero, target_four: targetFour });
			targetZero = targetFour * 1.075;
		}
	}
	const checks = groups.flatMap((group) =>
		group.rows.flatMap((row) =>
			row.measurements[0].upgrades.map((upgrade) => {
				const target = group.target_zero + ((group.target_four - group.target_zero) * upgrade.upgrade_level) / 4;
				const power_delta = Number((power(upgrade, "current") / target - 1).toFixed(6));
				return {
					family: group.family,
					weapon_id: row.weapon_id,
					level: group.level,
					upgrade_level: upgrade.upgrade_level,
					power_delta,
					curve_pass: Math.abs(power_delta) <= 0.1,
				};
			}),
		),
	);
	const handoffs = [];
	for (const familyGroups of families.values()) {
		familyGroups.sort((left, right) => left.level - right.level);
		for (let index = 0; index < familyGroups.length - 1; index++) {
			const from = familyGroups[index];
			const to = familyGroups[index + 1];
			const previous = median(from.rows.map((row) => power(row.measurements[0].upgrades[4], "current")));
			const next = median(to.rows.map((row) => power(row.measurements[0].upgrades[0], "current")));
			const power_delta = Number((next / previous - 1).toFixed(6));
			const rawHandoff = rawHandoffs.find(
				(handoff) => handoff.family === from.family && handoff.from_level === from.level && handoff.to_level === to.level,
			);
			if (!rawHandoff) throw new Error(`Weapon parity normalized handoff is missing ${from.family} ${from.level}->${to.level}`);
			const comparisons = ["physical", "magical", "physical_evasion"].map((archetype) => {
				const values = rawHandoff.comparisons
					.filter((comparison) => comparison.archetype === archetype)
					.map((comparison) => comparison.expected_ttk_delta);
				if (!values.length) throw new Error(`Weapon parity normalized handoff is missing ${archetype} TTK data`);
				const ttk_delta = Number(median(values).toFixed(6));
				return { archetype, ttk_delta, progression_pass: ttk_delta >= 0.05 && ttk_delta <= 0.1 };
			});
			handoffs.push({
				family: from.family,
				from_level: from.level,
				to_level: to.level,
				from_weapon_ids: from.rows.map((row) => row.weapon_id),
				to_weapon_ids: to.rows.map((row) => row.weapon_id),
				power_delta,
				comparisons,
				progression_pass: comparisons.every((comparison) => comparison.progression_pass),
			});
		}
	}
	return { groups, checks, handoffs };
}

function targetForLevel(fixture, level, archetype) {
	const bands = fixture.mob_bands.filter((band) => band.from_level <= level).sort((left, right) => right.from_level - left.from_level);
	const band = bands[0];
	if (!band || !band.targets || !band.targets[archetype]) throw new Error(`Weapon parity fixture has no ${archetype} target for level ${level}`);
	return { id: band.targets[archetype], band: band.from_level };
}

function basicTtk({ stats, monster, damageMultiplier }) {
	const defense = stats.damage_type === "magical" ? monster.resistance || 0 : monster.armor || 0;
	const piercing = stats.damage_type === "magical" ? stats.rpiercing || 0 : stats.apiercing || 0;
	const damage = Math.max(1, Math.ceil(stats.attack * damageMultiplier(defense - piercing)));
	const evasion = stats.damage_type === "physical" ? monster.evasion || 0 : 0;
	const avoidance = monster.avoidance || 0;
	const miss = stats.miss || 0;
	const hitChance = Math.max(0.01, (1 - Math.min(100, evasion) / 100) * (1 - Math.min(100, avoidance) / 100) * (1 - Math.min(100, miss) / 100));
	const hits = Math.ceil((monster.hp || 1) / damage);
	return { damage, hits, hit_chance: hitChance, ttk_ms: Math.ceil((hits * stats.attack_ms) / hitChance) };
}

function expectedBasicTtk({ stats, monster, damageMultiplier }) {
	// The progression gate measures sustained expected TTK, so it preserves each target's
	// mitigation and hit chance without letting a one-hit rounding boundary dominate a tier.
	const basic = basicTtk({ stats, monster, damageMultiplier });
	const defense = stats.damage_type === "magical" ? monster.resistance || 0 : monster.armor || 0;
	const piercing = stats.damage_type === "magical" ? stats.rpiercing || 0 : stats.apiercing || 0;
	const damage = Math.max(1, stats.attack * damageMultiplier(defense - piercing));
	const hits = (monster.hp || 1) / damage;
	return { ...basic, hits, ttk_ms: Math.ceil((hits * stats.attack_ms) / basic.hit_chance) };
}

function currentWeaponTtk({ weaponId, upgradeLevel, monster, data, current, expected = false }) {
	const stats = calculateStats({
		slots: { mainhand: { name: weaponId, level: upgradeLevel } },
		items: data.items,
		getItemProperties: current.calculate_item_properties,
	});
	return (expected ? expectedBasicTtk : basicTtk)({ stats, monster, damageMultiplier: data.damageMultiplier });
}

function assertStableMobBands(fixture, currentMonsters, targetDurability) {
	for (const band of fixture.mob_bands) {
		for (const [archetype, monsterId] of Object.entries(band.targets || {})) {
			const current = currentMonsters[monsterId];
			const legacy = targetDurability[monsterId];
			if (!current || !legacy) throw new Error(`Weapon parity ${archetype} target ${monsterId} is absent from the selected historical catalog`);
			for (const field of ["hp", "armor", "resistance", "evasion", "avoidance"]) {
				if ((current[field] || 0) !== (legacy[field] || 0))
					throw new Error(`Weapon parity target ${monsterId} changed ${field} between current and legacy catalogs`);
			}
		}
	}
}

function legacyMeasurement(baseline, weapon, archetype, upgradeLevel) {
	const row = baseline.rows.find((candidate) => candidate.weapon_id === weapon.weapon_id);
	const measurement = row && row.measurements.find((candidate) => candidate.archetype === archetype);
	const upgrade = measurement && measurement.upgrades.find((candidate) => candidate.upgrade_level === upgradeLevel);
	if (!upgrade || !upgrade.legacy) throw new Error(`Weapon parity legacy baseline is missing ${weapon.weapon_id} ${archetype} +${upgradeLevel}`);
	return upgrade.legacy;
}

function baselineSnapshot(baseline) {
	return baseline.rows.map(({ weapon_id, weapon_type, skill, requirement_level, measurements }) => ({
		weapon_id,
		weapon_type,
		skill,
		requirement_level,
		measurements: measurements.map(({ archetype, monster, upgrades }) => ({ archetype, monster, upgrades })),
	}));
}

function buildParityReport({ fixturePath = PARITY_FIXTURE_PATH, legacyBaselinePath = LEGACY_BASELINE_PATH } = {}) {
	const fixture = loadParityFixture(fixturePath);
	const baseline = loadLegacyBaseline(legacyBaselinePath);
	const data = loadBenchmarkData();
	const validation = validateParityFixture(fixture, data);
	if (validation.missingWeapons.length || validation.unclassifiedWeapons.length) throw new Error(`Weapon parity fixture has unclassified weapons: ${validation.missingWeapons.concat(validation.unclassifiedWeapons).join(", ")}`);
	const calculators = loadPropertyCalculators(data);
	assertStableMobBands(fixture, data.monsters, baseline.target_durability);
	const legacy_snapshot_sha256 = crypto.createHash("sha256").update(stableJson(baselineSnapshot(baseline))).digest("hex");
	if (baseline.snapshot_sha256 !== legacy_snapshot_sha256) throw new Error("Weapon parity legacy snapshot is not an exact fixture replay");
	const rows = [];
	for (const weapon of currentWeaponRows(data, fixture)) {
		const archetypes = ["physical", "magical", "physical_evasion"];
		const measurements = archetypes.map((archetype) => {
			const target = targetForLevel(fixture, weapon.requirement_level, archetype);
			const monster = data.monsters[target.id];
			if (!monster) throw new Error(`Weapon parity target ${target.id} does not exist`);
			const upgrades = fixture.upgrade_levels.map((upgradeLevel) => {
				const instance = { name: weapon.weapon_id, level: upgradeLevel };
				const current = calculateStats({ slots: { mainhand: instance }, items: data.items, getItemProperties: calculators.current.calculate_item_properties });
				const legacy = legacyMeasurement(baseline, weapon, archetype, upgradeLevel);
				const currentTtk = basicTtk({ stats: current, monster, damageMultiplier: data.damageMultiplier });
				const ttk_delta = Number((currentTtk.ttk_ms / legacy.ttk_ms - 1).toFixed(6));
				return {
					upgrade_level: upgradeLevel,
					current: { attack: current.attack, frequency: current.frequency, hit_chance: currentTtk.hit_chance, ttk_ms: currentTtk.ttk_ms },
					legacy,
					ttk_delta,
					parity_pass: Math.abs(ttk_delta) <= 0.1,
				};
			});
			return { archetype, monster: target.id, mob_band: target.band, upgrades };
		});
		rows.push({ ...weapon, upgrade_levels: fixture.upgrade_levels, measurements });
	}
	const handoffs = buildHandoffs(rows).map((handoff) => {
		const familyRows = rows.filter((row) => `${row.skill}:${row.weapon_type}:${row.damage_type}` === handoff.family);
		const from = familyRows.filter((row) => row.requirement_level === handoff.from_level);
		const to = familyRows.filter((row) => row.requirement_level === handoff.to_level);
		const comparisons = [];
		for (const archetype of ["physical", "magical", "physical_evasion"]) {
			const target = targetForLevel(fixture, handoff.to_level, archetype);
			const monster = data.monsters[target.id];
			for (const fromWeapon of from) {
				const previous = currentWeaponTtk({ weaponId: fromWeapon.weapon_id, upgradeLevel: 4, monster, data, current: calculators.current });
				const expectedPrevious = currentWeaponTtk({ weaponId: fromWeapon.weapon_id, upgradeLevel: 4, monster, data, current: calculators.current, expected: true });
				for (const toWeapon of to) {
					const next = currentWeaponTtk({ weaponId: toWeapon.weapon_id, upgradeLevel: 0, monster, data, current: calculators.current });
					const expectedNext = currentWeaponTtk({ weaponId: toWeapon.weapon_id, upgradeLevel: 0, monster, data, current: calculators.current, expected: true });
					const ttk_delta = Number((previous.ttk_ms / next.ttk_ms - 1).toFixed(6));
					const expected_ttk_delta = Number((expectedPrevious.ttk_ms / expectedNext.ttk_ms - 1).toFixed(6));
					comparisons.push({
						archetype,
						monster: target.id,
						from_weapon_id: fromWeapon.weapon_id,
						to_weapon_id: toWeapon.weapon_id,
						ttk_delta,
						expected_ttk_delta,
						progression_pass: ttk_delta >= 0.05 && ttk_delta <= 0.1,
					});
				}
			}
		}
		return { ...handoff, from_weapon_ids: from.map((row) => row.weapon_id), to_weapon_ids: to.map((row) => row.weapon_id), comparisons };
	});
	return { schema_version: 1, source_revision: baseline.source_revision, legacy_snapshot_sha256, data, rows, handoffs, curve: buildNormalizedCurve(rows, handoffs) };
}

function main(argv = process.argv.slice(2)) {
	const report = buildParityReport();
	const checks = report.rows.flatMap((row) => row.measurements.flatMap((measurement) => measurement.upgrades));
	const handoffChecks = report.handoffs.flatMap((handoff) => handoff.comparisons);
	const curveChecks = report.curve.checks;
	const curveHandoffs = report.curve.handoffs;
	const output = {
		schema_version: report.schema_version,
		source_revision: report.source_revision,
		summary: {
			parity: { checks: checks.length, passing: checks.filter((check) => check.parity_pass).length },
			handoffs: { checks: handoffChecks.length, passing: handoffChecks.filter((check) => check.progression_pass).length },
			curve: { checks: curveChecks.length, passing: curveChecks.filter((check) => check.curve_pass).length },
			curve_handoffs: { checks: curveHandoffs.length, passing: curveHandoffs.filter((check) => check.progression_pass).length },
		},
		rows: report.rows,
		handoffs: report.handoffs,
		curve: report.curve,
	};
	if (argv.includes("--format=markdown")) {
		process.stdout.write(
			`# Weapon parity chart\n\nRows: ${report.rows.length}\n\n| Skill | Weapon | Level | Target | Upgrade | TTK delta | Pass |\n|---|---|---:|---|---:|---:|---|\n` +
				report.rows.flatMap((row) => row.measurements.flatMap((measurement) => measurement.upgrades.map((upgrade) => `| ${row.skill} | ${row.weapon_id} | ${row.requirement_level} | ${measurement.monster} | +${upgrade.upgrade_level} | ${(upgrade.ttk_delta * 100).toFixed(2)}% | ${upgrade.parity_pass ? "PASS" : "FAIL"} |`))).join("\n") +
				`\n\n## Adjacent unlock handoffs\n\n| Family | Prior +4 | Next +0 | Target | TTK delta | Pass |\n|---|---|---|---|---:|---|\n` +
				report.handoffs.flatMap((handoff) => handoff.comparisons.map((comparison) => `| ${handoff.family} | ${comparison.from_weapon_id} | ${comparison.to_weapon_id} | ${comparison.monster} | ${(comparison.ttk_delta * 100).toFixed(2)}% | ${comparison.progression_pass ? "PASS" : "FAIL"} |`)).join("\n") +
				`\n\n## Normalized class curve\n\n| Family | Weapon | Unlock | Upgrade | Power delta | Pass |\n|---|---|---:|---:|---:|---|\n` +
				report.curve.checks.map((check) => `| ${check.family} | ${check.weapon_id} | ${check.level} | +${check.upgrade_level} | ${(check.power_delta * 100).toFixed(2)}% | ${check.curve_pass ? "PASS" : "FAIL"} |`).join("\n") +
				`\n\n## Normalized unlock handoffs\n\n| Family | Prior unlock | Next unlock | Target archetype | Expected TTK delta | Power delta | Pass |\n|---|---:|---:|---|---:|---:|---|\n` +
				report.curve.handoffs.flatMap((handoff) => handoff.comparisons.map((comparison) => `| ${handoff.family} | ${handoff.from_level} | ${handoff.to_level} | ${comparison.archetype} | ${(comparison.ttk_delta * 100).toFixed(2)}% | ${(handoff.power_delta * 100).toFixed(2)}% | ${comparison.progression_pass ? "PASS" : "FAIL"} |`)).join("\n") +
				"\n",
		);
	} else process.stdout.write(argv.includes("--format=json") ? JSON.stringify(output) + "\n" : stableJson(output));
}

if (require.main === module) main();

module.exports = {
	LEGACY_BASELINE_PATH,
	PARITY_FIXTURE_PATH,
	buildParityReport,
	catalogIdentityManifest,
	loadLegacyBaseline,
	loadParityFixture,
	loadPropertyCalculators,
	validateParityFixture,
};
