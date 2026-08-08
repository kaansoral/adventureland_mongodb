"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { authorizeAbility } = require("../game/ability_access");
const { COMBAT_SKILL_IDS } = require("../game/skill_domain");
const { calculateStats } = require("../game/stats");
const {
	PARITY_FIXTURE_PATH,
	LEGACY_BASELINE_PATH,
	buildParityReport,
	loadParityFixture,
	loadPropertyCalculators,
} = require("../tools/weapon-progression-parity");

function weaponAtAbilityLevel(rows, skill, level) {
	const candidates = rows
		.filter((row) => row.skill === skill && row.requirement_level <= level)
		.sort((left, right) => right.requirement_level - left.requirement_level || left.weapon_id.localeCompare(right.weapon_id));
	assert.ok(candidates.length, `${skill} has a weapon at level ${level}`);
	return candidates[0];
}

function abilityEffect(ability, semantics, stats) {
	if (semantics.effect === "mana_ratio") return stats.max_mp * semantics.ratio;
	if (semantics.effect === "fixed_damage") return semantics.damage;
	if (semantics.effect === "attack_multiplier") return stats.attack * semantics.damage_multiplier;
	if (semantics.effect === "damage_taken_multiplier") return semantics.damage_multiplier;
	throw new Error(`Selected ability ${ability.name} has no documented deterministic effect`);
}

function abilityResourceCost(ability, stats) {
	return Number(ability.ratio) > 0 ? stats.max_mp : Number(ability.mp || 0);
}

function sustainedAbilityOutput(ability, semantics, stats) {
	const resourceCost = abilityResourceCost(ability, stats);
	const basicOutput = stats.attack * stats.frequency;
	if (resourceCost > stats.max_mp) return basicOutput;
	const resourceCycleMs = resourceCost ? (resourceCost / semantics.mp_regen_per_second) * 1000 : 0;
	const cycleMs = Math.max(semantics.cooldown, stats.attack_ms, resourceCycleMs);
	if (semantics.effect === "damage_taken_multiplier") return basicOutput * (1 + (semantics.damage_multiplier - 1) * Math.min(1, semantics.duration / cycleMs));
	return basicOutput + (abilityEffect(ability, semantics, stats) * 1000) / cycleMs;
}

function weaponStats(report, calculators, weaponId, upgradeLevel) {
	return calculateStats({
		slots: { mainhand: { name: weaponId, level: upgradeLevel } },
		items: report.data.items,
		getItemProperties: calculators.current.calculate_item_properties,
	});
}

function median(values) {
	return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

test("combat abilities are selected or explicitly excluded and selected abilities retain effects, cooldowns, resources, and handoffs", () => {
	const fixture = loadParityFixture(PARITY_FIXTURE_PATH);
	const validation = fixture.ability_validation;
	assert.ok(validation && Array.isArray(validation.selected) && validation.exceptions && validation.semantics);
	const report = buildParityReport({ fixturePath: PARITY_FIXTURE_PATH, legacyBaselinePath: LEGACY_BASELINE_PATH });
	const calculators = loadPropertyCalculators(report.data);
	const abilities = report.data.abilities;
	const combatAbilities = Object.entries(abilities)
		.filter(([, ability]) => COMBAT_SKILL_IDS.includes(ability.skill))
		.map(([id]) => id)
		.sort();
	const covered = new Set([...validation.selected, ...Object.keys(validation.exceptions)]);
	assert.deepEqual([...covered].sort(), combatAbilities);
	for (const [id, reason] of Object.entries(validation.exceptions)) assert.ok(reason.length > 0, id);

	for (const abilityId of validation.selected) {
		const ability = abilities[abilityId];
		const semantics = validation.semantics[abilityId];
		assert.ok(ability, abilityId);
		assert.ok(semantics, abilityId);
		assert.equal(ability.cooldown || 0, semantics.cooldown, abilityId);
		if (semantics.mp !== undefined) assert.equal(ability.mp || 0, semantics.mp, abilityId);
		if (semantics.ratio !== undefined) assert.equal(ability.ratio, semantics.ratio, abilityId);
		if (semantics.damage !== undefined) assert.equal(ability.damage, semantics.damage, abilityId);
		if (semantics.effect === "attack_multiplier") assert.equal(ability.damage_multiplier, semantics.damage_multiplier, abilityId);
		if (semantics.effect === "damage_taken_multiplier") {
			assert.equal(ability.condition, "cursed", abilityId);
			assert.equal(ability.duration, semantics.duration, abilityId);
		}
		const weapon = weaponAtAbilityLevel(report.rows, ability.skill, ability.level || 1);
		const character = { skills: { [ability.skill]: { level: ability.level || 1 } } };
		const slots = { mainhand: { name: weapon.weapon_id, level: 0 } };
		const result = authorizeAbility({ ability, abilityId, character, slots, items: report.data.items });
		assert.equal(result.authorized, true, abilityId);
		assert.equal(result.active_skill, ability.skill, abilityId);
		const stats = weaponStats(report, calculators, weapon.weapon_id, 0);
		const effect = abilityEffect(ability, semantics, stats);
		assert.ok(Number.isFinite(effect) && effect > 0, abilityId);
		const resourceCost = abilityResourceCost(ability, stats);
		assert.ok(Number.isFinite(resourceCost) && resourceCost >= 0, abilityId);
		assert.ok(Number.isFinite(semantics.mp_regen_per_second) && semantics.mp_regen_per_second > 0, abilityId);
		if (Number(ability.ratio) > 0) assert.equal(resourceCost, stats.max_mp, abilityId);
		if (ability.cooldown !== undefined) {
			assert.ok(Number.isFinite(ability.cooldown) && ability.cooldown >= 0, abilityId);
			if (ability.cooldown > 0) {
				assert.throws(
					() => authorizeAbility({ ability, abilityId, character, slots, items: report.data.items, now: 10_000, lastUse: 10_000 - ability.cooldown + 1, cooldown: ability.cooldown }),
					(error) => error.code === "ability_on_cooldown",
					abilityId,
				);
			}
		}
		if (ability.damage_type !== undefined) assert.ok(["physical", "magical", "pure"].includes(ability.damage_type), abilityId);
		assert.throws(
			() => authorizeAbility({ ability, abilityId, character, slots: { mainhand: { name: "blade", level: 0 } }, items: report.data.items }),
			(error) => error.code === "wrong_active_skill",
			abilityId,
		);
	}

	for (const abilityId of validation.selected) {
		const ability = abilities[abilityId];
		const semantics = validation.semantics[abilityId];
		for (const handoff of report.curve.handoffs.filter((entry) => entry.family.startsWith(`${ability.skill}:`))) {
			const [, weaponType] = handoff.family.split(":");
			const previousRows = report.rows.filter((row) => row.skill === ability.skill && row.weapon_type === weaponType && row.requirement_level === handoff.from_level);
			const nextRows = report.rows.filter((row) => row.skill === ability.skill && row.weapon_type === weaponType && row.requirement_level === handoff.to_level);
			const allowed = ability.wtype ? (Array.isArray(ability.wtype) ? ability.wtype : [ability.wtype]) : null;
			const previous = previousRows.filter((row) => !allowed || allowed.includes(row.weapon_type));
			const next = nextRows.filter((row) => !allowed || allowed.includes(row.weapon_type));
			if (!previous.length || !next.length) continue;
			const previousOutput = median(previous.map((row) => sustainedAbilityOutput(ability, semantics, weaponStats(report, calculators, row.weapon_id, 4))));
			const nextOutput = median(next.map((row) => sustainedAbilityOutput(ability, semantics, weaponStats(report, calculators, row.weapon_id, 0))));
			assert.ok(previousOutput <= nextOutput, `${abilityId} reverses ${handoff.family} ${handoff.from_level}->${handoff.to_level}`);
		}
	}
});
