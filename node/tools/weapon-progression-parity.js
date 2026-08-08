"use strict";

const childProcess = require("node:child_process");
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
	if (!fixture || fixture.schema_version !== 1 || !Array.isArray(fixture.upgrade_levels) || !Array.isArray(fixture.mob_bands))
		throw new Error("Weapon parity fixture is invalid");
	if (stableJson(fixture.upgrade_levels) !== stableJson([0, 1, 2, 3, 4]))
		throw new Error("Weapon parity fixture must cover upgrade levels 0 through 4");
	return fixture;
}

function loadLegacyBaseline(filename = LEGACY_BASELINE_PATH) {
	const baseline = loadJson(filename);
	if (!baseline || baseline.schema_version !== 1 || baseline.source_revision !== LEGACY_REVISION || !Array.isArray(baseline.legacy_levels))
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

function loadPropertyCalculators() {
	const current = loadPropertyCalculator(
		(filename) => fs.readFileSync(path.resolve(__dirname, filename === "old_common_functions.js" ? "../../js" : "../../design", filename), "utf8"),
		["multipliers.js", "items.js"],
	);
	const legacy = loadPropertyCalculator(
		(filename) => childProcess.execFileSync("git", ["show", `${LEGACY_REVISION}:${filename === "old_common_functions.js" ? "js" : "design"}/${filename}`], { encoding: "utf8" }),
		["multipliers.js", "items.js", "classes.js", "monsters.js"],
	);
	return { current, legacy };
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
		rows.push({ weapon_id: weaponId, weapon_type: definition.wtype, skill: owner, requirement_level: requirements[0].level });
	}
	return rows.sort((left, right) =>
		left.skill.localeCompare(right.skill) ||
		left.weapon_type.localeCompare(right.weapon_type) ||
		left.requirement_level - right.requirement_level ||
		left.weapon_id.localeCompare(right.weapon_id),
	);
}

function validateParityFixture(fixture, data) {
	const owners = combatWeaponOwners(data);
	const exceptions = fixture.exceptions || {};
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

function levelWeight(level) {
	return level + Math.max(level - 40, 0) + Math.max(level - 55, 0) + Math.max(level - 65, 0) - Math.max(level - 80, 0);
}

function applyLegacyProperty(target, property) {
	for (const [key, value] of Object.entries(property || {})) {
		if (typeof value !== "number" || !Number.isFinite(value)) continue;
		if (key === "attack") target.a_attack += value;
		else if (key === "frequency") target.frequency += value / 100;
		else target[key] = (target[key] || 0) + value;
	}
}

function legacyStats({ legacy, skill, weaponId, level, upgradeLevel }) {
	const classDefinition = legacy.classes[skill];
	const definition = legacy.items[weaponId];
	if (!classDefinition || !definition) throw new Error(`Legacy data is missing ${skill}/${weaponId}`);
	const values = { ...classDefinition.stats, attack: classDefinition.attack || 0, frequency: classDefinition.frequency || 0, a_attack: 0 };
	for (const [stat, perLevel] of Object.entries(classDefinition.lstats || {})) values[stat] = Math.floor((classDefinition.stats[stat] || 0) + perLevel * levelWeight(level));
	const property = legacy.calculate_item_properties({ name: weaponId, level: upgradeLevel });
	applyLegacyProperty(values, property);
	applyLegacyProperty(values, classDefinition.doublehand[definition.wtype] || classDefinition.mainhand[definition.wtype] || {});
	const itemAttack = Math.max(5, property.attack || 0);
	const primary = classDefinition.main_stat;
	let attack = classDefinition.attack || 0;
	if (skill === "paladin") attack += itemAttack * (values.str / 20 + values.int / 40);
	else attack += itemAttack * ((values[primary] || 0) / 20);
	attack += values.a_attack;
	if (skill === "priest") attack *= 1.6;
	values.frequency += Math.min(level, 80) / 164 + Math.min(160, values.dex || 0) / 640 + Math.max((values.dex || 0) - 160, 0) / 925 + (values.int || 0) / 1575;
	return { attack: Math.round(attack), frequency: Math.max(0.01, values.frequency), damage_type: definition.damage_type || classDefinition.damage_type };
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
	const damage = Math.max(1, Math.ceil(stats.attack * damageMultiplier(defense - piercing * 2)));
	const hits = Math.ceil((monster.hp || 1) / damage);
	return { damage, hits, ttk_ms: hits * stats.attack_ms };
}

function assertStableMobBands(fixture, currentMonsters, legacyMonsters) {
	for (const band of fixture.mob_bands) {
		for (const [archetype, monsterId] of Object.entries(band.targets || {})) {
			const current = currentMonsters[monsterId];
			const legacy = legacyMonsters[monsterId];
			if (!current || !legacy) throw new Error(`Weapon parity ${archetype} target ${monsterId} is absent from the selected historical catalog`);
			for (const field of ["hp", "armor", "resistance", "evasion", "avoidance"]) {
				if ((current[field] || 0) !== (legacy[field] || 0))
					throw new Error(`Weapon parity target ${monsterId} changed ${field} between current and legacy catalogs`);
			}
		}
	}
}

function buildParityReport({ fixturePath = PARITY_FIXTURE_PATH, legacyBaselinePath = LEGACY_BASELINE_PATH } = {}) {
	const fixture = loadParityFixture(fixturePath);
	const baseline = loadLegacyBaseline(legacyBaselinePath);
	const data = loadBenchmarkData();
	const validation = validateParityFixture(fixture, data);
	if (validation.missingWeapons.length || validation.unclassifiedWeapons.length) throw new Error(`Weapon parity fixture has unclassified weapons: ${validation.missingWeapons.concat(validation.unclassifiedWeapons).join(", ")}`);
	const calculators = loadPropertyCalculators();
	assertStableMobBands(fixture, data.monsters, calculators.legacy.monsters);
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
				const legacy = legacyStats({ legacy: calculators.legacy, skill: weapon.skill, weaponId: weapon.weapon_id, level: weapon.requirement_level, upgradeLevel });
				const currentTtk = basicTtk({ stats: current, monster, damageMultiplier: data.damageMultiplier });
				const legacyFrequency = Math.max(0.01, legacy.frequency);
				const legacyTtk = basicTtk({ stats: { ...legacy, attack_ms: Math.round(1000 / legacyFrequency), apiercing: 0, rpiercing: 0 }, monster, damageMultiplier: data.damageMultiplier });
				return {
					upgrade_level: upgradeLevel,
					current: { attack: current.attack, frequency: current.frequency, ttk_ms: currentTtk.ttk_ms },
					legacy: { attack: legacy.attack, frequency: legacyFrequency, ttk_ms: legacyTtk.ttk_ms },
					ttk_delta: Number((currentTtk.ttk_ms / legacyTtk.ttk_ms - 1).toFixed(6)),
				};
			});
			return { archetype, monster: target.id, mob_band: target.band, upgrades };
		});
		rows.push({ ...weapon, upgrade_levels: fixture.upgrade_levels, measurements });
	}
	return { schema_version: 1, source_revision: baseline.source_revision, data, rows };
}

function main(argv = process.argv.slice(2)) {
	const report = buildParityReport();
	const output = { schema_version: report.schema_version, source_revision: report.source_revision, rows: report.rows };
	process.stdout.write(argv.includes("--format=json") ? JSON.stringify(output) + "\n" : stableJson(output));
}

if (require.main === module) main();

module.exports = {
	LEGACY_BASELINE_PATH,
	PARITY_FIXTURE_PATH,
	buildParityReport,
	loadLegacyBaseline,
	loadParityFixture,
	validateParityFixture,
};
