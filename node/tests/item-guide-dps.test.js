"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { calculateStats } = require("../game/stats");
const { loadBenchmarkData } = require("../tools/progression-benchmark");
const { loadPropertyCalculators } = require("../tools/weapon-progression-parity");

function loadGuideMetrics(skills) {
	const source = fs.readFileSync(path.resolve(__dirname, "../../js/html.js"), "utf8");
	const start = source.indexOf("function guide_weapon_owner(");
	const end = source.indexOf("\nvar last_selector", start);
	assert.ok(start >= 0 && end > start, "item-guide metrics helpers exist");
	const context = { G: { skills }, Math };
	vm.createContext(context);
	vm.runInContext(source.slice(start, end), context, { filename: "html.js" });
	return context.guide_weapon_metrics;
}

test("item guide base DPS matches the one-weapon combat calculation through +4", () => {
	const data = loadBenchmarkData();
	const calculators = loadPropertyCalculators(data);
	const guideWeaponMetrics = loadGuideMetrics(data.skills);
	for (const [weaponId, definition] of Object.entries(data.items)) {
		if (definition.type !== "weapon" || !definition.wtype) continue;
		for (let level = 0; level <= 4; level += 1) {
			const properties = calculators.current.calculate_item_properties({ name: weaponId, level });
			const expected = calculateStats({
				slots: { mainhand: { name: weaponId, level } },
				items: data.items,
				getItemProperties: calculators.current.calculate_item_properties,
			});
			const guide = guideWeaponMetrics(definition, properties);
			if (!guide) continue;
			assert.equal(guide.hit_damage, expected.attack, `${weaponId}+${level} hit damage`);
			assert.ok(Math.abs(guide.attacks_per_second - expected.frequency) < 0.0000001, `${weaponId}+${level} attack speed`);
			assert.ok(Math.abs(guide.dps - expected.attack * expected.frequency) < 0.0000001, `${weaponId}+${level} DPS`);
		}
	}
});

test("item guide labels its player-facing hit damage, attack speed, and base DPS", () => {
	const source = fs.readFileSync(path.resolve(__dirname, "../../js/html.js"), "utf8");
	assert.match(source, /"Hit Damage"/);
	assert.match(source, /"Attacks \/ Sec"/);
	assert.match(source, /"Base DPS"/);
});
