"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { calculateStats } = require("../game/stats");
const { loadBenchmarkData } = require("../tools/progression-benchmark");
const { loadPropertyCalculators } = require("../tools/weapon-progression-parity");

function loadGuideHelpers(skills) {
	const source = fs.readFileSync(path.resolve(__dirname, "../../js/html.js"), "utf8");
	const start = source.indexOf("function guide_weapon_owner(");
	const end = source.indexOf("\nvar last_selector", start);
	assert.ok(start >= 0 && end > start, "item-guide metrics helpers exist");
	const context = { G: { skills }, Math };
	vm.createContext(context);
	vm.runInContext(source.slice(start, end), context, { filename: "html.js" });
	return context;
}

function loadGuideMetrics(skills) {
	return loadGuideHelpers(skills).guide_weapon_metrics;
}

function renderGuideItems(items, skills) {
	const source = fs.readFileSync(path.resolve(__dirname, "../../js/html.js"), "utf8");
	const helpersStart = source.indexOf("function guide_weapon_owner(");
	const helpersEnd = source.indexOf("\nvar last_selector", helpersStart);
	const renderStart = source.indexOf("function render_all_items()");
	const renderEnd = source.indexOf("\nfunction render_all_monsters()", renderStart);
	assert.ok(helpersStart >= 0 && helpersEnd > helpersStart, "item-guide helpers exist");
	assert.ok(renderStart >= 0 && renderEnd > renderStart, "all-items renderer exists");
	let modal;
	const context = {
		G: { items, skills },
		Math,
		calculate_item_properties: (item) => items[item.name],
		in_arr: (value, values) => values.includes(value),
		item_container: (options) => `<item skin="${options.skin}" onclick="${options.onclick}">`,
		object_sort: (object) => Object.keys(object).sort().map((id) => [id, object[id]]),
		show_modal: (html, options) => {
			modal = { html, options };
		},
	};
	vm.createContext(context);
	vm.runInContext(source.slice(helpersStart, helpersEnd), context, { filename: "html.js" });
	vm.runInContext(source.slice(renderStart, renderEnd), context, { filename: "html.js" });
	context.render_all_items();
	return modal;
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

test("item guide groups visible weapons by combat profile and base DPS", () => {
	const data = loadBenchmarkData();
	const calculators = loadPropertyCalculators(data);
	const guide = loadGuideHelpers(data.skills);
	const groups = JSON.parse(
		JSON.stringify(
			guide.guide_weapon_groups(data.items, data.skills, (id) =>
				calculators.current.calculate_item_properties({ name: id, level: 0 }),
			),
		),
	);
	assert.deepEqual(
		groups.map((group) => [group.id, group.name]),
		[
			["warrior", "Warrior Weapons"],
			["paladin", "Paladin Weapons"],
			["mage", "Mage Weapons"],
			["priest", "Priest Weapons"],
			["ranger", "Ranger Weapons"],
			["rogue", "Rogue Weapons"],
		],
	);
	const visibleWeapons = Object.entries(data.items)
		.filter(([, item]) => item.type === "weapon" && !item.ignore)
		.map(([id]) => id)
		.sort();
	const displayed = [];
	for (const group of groups) {
		for (const weapon of group.weapons) {
			displayed.push(weapon.id);
			assert.equal(guide.guide_weapon_owner(data.items[weapon.id]), group.id, weapon.id);
		}
		const expectedOrder = visibleWeapons
			.filter((id) => data.skills[group.id].weapon_types.includes(data.items[id].wtype))
			.map((id) => ({
				id,
				dps: guide.guide_weapon_metrics(
					data.items[id],
					calculators.current.calculate_item_properties({ name: id, level: 0 }),
				).dps,
			}))
			.sort((left, right) => left.dps - right.dps || left.id.localeCompare(right.id))
			.map((weapon) => weapon.id);
		assert.deepEqual(
			group.weapons.map((weapon) => weapon.id),
			expectedOrder,
			`${group.id} is ordered by independently calculated level-0 Base DPS and item ID`,
		);
	}
	assert.deepEqual(displayed.sort(), visibleWeapons);
});

test("item guide preserves non-weapon categories, ignored entries, and item detail actions", () => {
	const skills = {
		warrior: { kind: "combat", name: "Warrior", weapon_types: ["short_sword"] },
		paladin: { kind: "combat", name: "Paladin", weapon_types: [] },
		mage: { kind: "combat", name: "Mage", weapon_types: [] },
		priest: { kind: "combat", name: "Priest", weapon_types: [] },
		ranger: { kind: "combat", name: "Ranger", weapon_types: [] },
		rogue: { kind: "combat", name: "Rogue", weapon_types: [] },
	};
	const modal = renderGuideItems(
		{
			blade: { type: "weapon", wtype: "short_sword", skin: "blade", attack: 10, str: 20 },
			helm: { type: "helmet", skin: "helm" },
			hidden_blade: { type: "weapon", wtype: "short_sword", skin: "hidden_blade", ignore: true, attack: 20, str: 20 },
			hidden_helm: { type: "helmet", skin: "hidden_helm", ignore: true },
		},
		skills,
	);
	assert.match(modal.html, /Warrior Weapons/);
	assert.match(modal.html, /Rogue Weapons/);
	assert.match(modal.html, /Helmets/);
	assert.match(modal.html, /render_item_info\('blade'\)/);
	assert.match(modal.html, /render_item_info\('helm'\)/);
	assert.doesNotMatch(modal.html, /hidden_blade|hidden_helm/);
	assert.equal(modal.options.url, "/docs/guide/all/items");
});
