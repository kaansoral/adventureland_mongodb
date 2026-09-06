"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const G = require("./helpers/design");
const serverSource = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
const clientSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const clientFunctions = fs.readFileSync(path.join(root, "js/functions.js"), "utf8");

function plain(value) {
	return JSON.parse(JSON.stringify(value));
}

function picked(object, keys) {
	return Object.fromEntries(keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]));
}

function guardianContext() {
	const start = serverSource.indexOf("function paladin_damage_mp");
	const end = serverSource.indexOf("function complete_attack", start);
	assert.ok(start >= 0 && end > start, "Guardian's Oath helpers are missing");
	const context = {
		G: { skills: plain(G.skills), monsters: plain(G.monsters), projectiles: plain(G.projectiles) },
		players: {},
		pvp: false,
		floor: Math.floor,
		min: Math.min,
		distance(a, b) {
			return Math.hypot(a.x - b.x, a.y - b.y);
		},
		get_player(name) {
			return Object.values(context.players).find((player) => player.name === name) || null;
		},
		is_same(a, b, mode) {
			if (a.name === b.name || (a.owner && a.owner === b.owner)) return true;
			if (mode === 3 && !context.pvp) return true;
			return Boolean((a.party && a.party === b.party) || (a.team && a.team === b.team));
		},
		resend() {},
		disappearing_text() {},
	};
	vm.createContext(context);
	vm.runInContext(serverSource.slice(start, end), context);
	return context;
}

function guardian(name = "Guardian", hp = 1000) {
	return { name, type: "paladin", level: 110, hp, mp: 0, max_mp: 2000, x: 0, y: 0, in: "main", party: "P", s: {} };
}

function protectedTarget(name = "Ally") {
	return {
		name,
		is_player: true,
		hp: 1000,
		x: 100,
		y: 0,
		in: "main",
		party: "P",
		s: { guardians_oath: { ms: 8000, f: "Guardian" } },
	};
}

function auraContext() {
	const start = serverSource.indexOf("var PALADIN_AURA_CONDITIONS");
	const end = serverSource.indexOf("var lrid", start);
	assert.ok(start >= 0 && end > start, "Paladin aura helpers are missing");
	const context = {
		G: {
			skills: { paladin_aura: plain(G.skills.paladin_aura) },
			conditions: Object.fromEntries(
				Object.keys(G.skills.paladin_aura.states).map((state) => {
					const condition = G.skills.paladin_aura.states[state].condition;
					return [condition, plain(G.conditions[condition])];
				}),
			),
		},
		instances: {},
		resends: [],
		pvp: false,
		distance(a, b) {
			return Math.hypot(a.x - b.x, a.y - b.y);
		},
		is_same(a, b, mode) {
			if (a.name === b.name) return true;
			if (mode === 3 && !context.pvp) return true;
			return Boolean(a.party && a.party === b.party);
		},
		resend(target, mode) {
			context.resends.push([target.name, mode]);
		},
	};
	vm.createContext(context);
	vm.runInContext(serverSource.slice(start, end), context);
	return context;
}

function auraPlayer(name, state, level = 90, x = 0, party = "P", type = "paladin") {
	return {
		name,
		type,
		level,
		for: level,
		x,
		y: 0,
		in: "main",
		party,
		p: state ? { paladin_aura: state } : {},
		s: {},
	};
}

test("Paladin items load through the intended normalization paths", () => {
	const expectations = {
		vowkeepergloves: {
			set: "oathkeeper",
			type: "gloves",
			tier: 1.5,
			class: ["paladin"],
			armor: 11,
			resistance: 6,
			stat: 1,
			mp: 30,
			for: 2,
			grades: [4, 8, 10, 12],
		},
		oathplate: {
			set: "oathkeeper",
			type: "chest",
			tier: 2,
			class: ["paladin"],
			armor: 24,
			resistance: 16,
			stat: 2,
			hp: 180,
			mp: 60,
			for: 2,
			grades: [0, 7, 10, 12],
		},
		concordmace: {
			set: "oathkeeper",
			type: "weapon",
			wtype: "mace",
			tier: 2.5,
			class: ["paladin"],
			attack: 29,
			range: 6.5,
			mp: 60,
			for: 2,
			grades: [0, 4, 10, 12],
		},
		resolutesallet: {
			set: "oathkeeper",
			type: "helmet",
			tier: 2.5,
			class: ["paladin"],
			armor: 20,
			resistance: 23,
			stat: 2,
			for: 4,
			grades: [0, 5, 10, 12],
		},
		dawnwardaegis: {
			set: "oathkeeper",
			type: "shield",
			tier: 3,
			class: ["paladin"],
			armor: 70,
			resistance: 26,
			mp: 90,
			for: 6,
			grades: [0, 0, 9, 10],
		},
	};
	for (const [name, expected] of Object.entries(expectations))
		assert.deepEqual(picked(plain(G.items[name]), Object.keys(expected)), expected, name);

	const practical = {
		vowkeepergloves: [7, { armor: 22, resistance: 17, str: 9, stat: 0, mp: 88, for: 3 }],
		oathplate: [7, { armor: 42, resistance: 34, str: 10, stat: 0, hp: 361, mp: 133, for: 4 }],
		concordmace: [6, { attack: 63, range: 13, mp: 120, for: 4 }],
		resolutesallet: [5, { armor: 40, resistance: 43, str: 7, stat: 0, for: 6 }],
		dawnwardaegis: [5, { armor: 125, resistance: 61, mp: 165, for: 9 }],
	};
	for (const [name, [level, expected]] of Object.entries(practical)) {
		const properties = G.calculate_item_properties({ name, level, stat_type: "str" }, { class: "paladin" });
		assert.deepEqual(picked(properties, Object.keys(expected)), expected, `${name}+${level}`);
	}

	assert.deepEqual(plain(G.sets.oathkeeper), {
		name: "Oathkeeper Set",
		items: ["vowkeepergloves", "oathplate", "concordmace", "resolutesallet", "dawnwardaegis"],
		explanation: "Worn by Paladins who stand between danger and their allies.",
		1: {},
		2: { hp: 200, mp: 100 },
		3: { hp: 300, mp: 150, armor: 15, resistance: 15 },
		4: { hp: 450, mp: 225, armor: 25, resistance: 25, for: 4 },
		5: { hp: 700, mp: 350, armor: 35, resistance: 35, for: 8, courage: 1, mcourage: 1, pcourage: 1 },
	});
});

test("all five acquisition paths are registered exactly once", () => {
	assert.deepEqual(plain(G.craft.vowkeepergloves), {
		items: [
			[60, "beewings"],
			[30, "spores"],
			[2, "crabclaw"],
		],
		cost: 0,
		quest: "mcollector",
	});
	assert.deepEqual(plain(G.craft.oathplate), {
		items: [
			[1, "coat1"],
			[4, "pleather"],
			[2, "ascale"],
			[20, "spores"],
		],
		cost: 180000,
	});
	assert.deepEqual(plain(G.craft.resolutesallet), {
		items: [
			[1, "helmet1", 0],
			[12, "dstones"],
			[4, "rfangs"],
		],
		cost: 240000,
	});
	assert.equal(G.tokens.monstertoken.concordmace, 12);
	assert.equal(G.tokens.pvptoken.resolutesallet, 12);
	assert.deepEqual(plain(G.drops.monsters.skeletor.filter((entry) => entry[1] === "dawnwardaegis")), [
		[0.02, "dawnwardaegis"],
	]);
});

test("Cleansing Light exposes an explicit combat-only allowlist", () => {
	const cleansable = Object.entries(G.conditions)
		.filter(([, definition]) => definition.cleansable)
		.map(([name]) => name)
		.sort();
	assert.deepEqual(cleansable, [
		"burned",
		"charmed",
		"cursed",
		"dampened",
		"deepfreezed",
		"eburn",
		"fingered",
		"frozen",
		"marked",
		"poisoned",
		"shocked",
		"sleeping",
		"slowness",
		"stoned",
		"stunned",
		"tangled",
		"weakness",
		"woven",
	]);
	for (const name of cleansable) {
		assert.equal(G.conditions[name].debuff, true, `${name} must remain a debuff`);
		assert.notEqual(G.conditions[name].persistent, true, `${name} must not be persistent`);
	}
	for (const name of [
		"stack",
		"penalty_cd",
		"withdrawal",
		"xshotted",
		"notverified",
		"authfail",
		"hopsickness",
		"block",
	])
		assert.notEqual(G.conditions[name].cleansable, true, `${name} must remain uncleansable`);
});

test("Snowball stays hidden from the skill list without its consumable", () => {
	assert.deepEqual(plain(G.skills.snowball.inventory), ["snowball"]);
	assert.match(
		fs.readFileSync(path.join(root, "js/html.js"), "utf8"),
		/if \(skill\.inventory\)[\s\S]*if \(!found\) return;/,
	);
});

test("shield toggles replace each other and share a cooldown", () => {
	const context = guardianContext();
	const player = guardian();
	context.toggle_paladin_shield(player, "mshield");
	assert.ok(player.s.mshield);
	context.toggle_paladin_shield(player, "aether_shield");
	assert.ok(player.s.aether_shield);
	assert.equal(player.s.mshield, undefined);
	context.toggle_paladin_shield(player, "mshield");
	assert.ok(player.s.mshield);
	assert.equal(player.s.aether_shield, undefined);
	context.toggle_paladin_shield(player, "mshield");
	assert.deepEqual(player.s, {});
	assert.equal(G.skills.aether_shield.level, 60);
	assert.equal(G.skills.aether_shield.share, "mshield");
	assert.equal(G.skills.mshield.cooldown, 500);
});

test("damage-to-MP scales at each unlock, caps at missing MP, and ignores invalid losses", () => {
	const context = guardianContext();
	for (const [level, expected] of [
		[59, 0],
		[60, 500],
		[69, 500],
		[70, 600],
		[80, 700],
		[90, 800],
		[100, 900],
		[110, 1000],
		[150, 1000],
	]) {
		const player = { ...guardian(), level };
		assert.equal(context.paladin_damage_mp(player, 1000, "aether_shield"), expected, `level ${level}`);
		assert.equal(player.mp, expected);
	}
	const full = { ...guardian(), mp: 1950 };
	assert.equal(context.paladin_damage_mp(full, 1000, "aether_shield"), 50);
	assert.equal(context.paladin_damage_mp(full, 1000, "aether_shield"), 0);
	for (const value of [-20, 0, NaN, Infinity])
		assert.equal(context.paladin_damage_mp(guardian(), value, "aether_shield"), 0);
	assert.equal(context.paladin_damage_mp({ ...guardian(), hp: 0 }, 1000, "aether_shield"), 0);
});

function damageContext() {
	const context = guardianContext();
	Object.assign(context, {
		B: { heal_multiplier: 1, dps_tank_mult: 0.25 },
		mode: { instant_monster_attacks: true },
		Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
		max: Math.max,
		ceil: Math.ceil,
		round: Math.round,
		damage_multiplier: G.damage_multiplier,
		point_distance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
		add_pdps() {},
		achievement_logic_monster_hit() {},
		ccms() {},
		defeated_by_a_monster(target) {
			target.rip = true;
		},
		hits: [],
		xy_emit(target, event, data) {
			if (event === "hit") context.hits.push(plain(data));
		},
	});
	vm.runInContext(
		serverSource.slice(
			serverSource.indexOf("function complete_attack("),
			serverSource.indexOf("function target_player("),
		),
		context,
	);
	return context;
}

function hit(context, target, damageType = "magical", attack = 1000, overrides = {}) {
	Object.assign(target, { is_player: true, max_hp: 10000, a: {}, last: {}, m: 1, map: "main", hits: 0 });
	const attacker = { type: "goo", is_monster: true, hp: 10000, outgoing: 0, map: "main", in: "main", s: {} };
	const info = {
		atype: "attack",
		attack,
		first_attack: attack,
		damage_type: damageType,
		procs: false,
		conditions: [],
		apiercing: 0,
		rpiercing: 0,
		def: { source: "attack" },
		action: { m: 1, x: target.x, y: target.y },
		...overrides,
	};
	context.complete_attack(attacker, target, info);
	return context.hits.at(-1);
}

test("real attack path restores only magical HP loss after defenses and Oath, once per recipient", () => {
	const context = damageContext();
	const source = guardian();
	const target = { ...guardian("Ally", 5000), resistance: 500, s: { aether_shield: { ms: 1000 } } };
	let event = hit(context, target);
	const mitigated = Math.ceil(1000 * G.damage_multiplier(500));
	assert.equal(target.hp, 5000 - mitigated);
	assert.equal(target.mp, mitigated);
	assert.equal(event.mp_restored, mitigated);
	for (const type of ["physical", "pure"]) {
		const other = { ...guardian("Other", 5000), s: { aether_shield: { ms: 1000 } } };
		hit(context, other, type);
		assert.equal(other.mp, 0, type);
	}
	context.players.guardian = source;
	const protectedPlayer = {
		...guardian("Ally", 5000),
		s: { aether_shield: { ms: 1000 }, guardians_oath: { ms: 8000, f: source.name } },
	};
	event = hit(context, protectedPlayer);
	assert.equal(protectedPlayer.hp, 4350);
	assert.equal(protectedPlayer.mp, 650);
	assert.equal(source.hp, 650);
	assert.equal(source.mp, 350);
	assert.equal(event.guardian_mp, 350);
	assert.equal(event.mp_restored + event.guardian_mp, 1000);
});

test("Mana Shield absorption, immunity, misses, and lethal damage cannot create Aether MP", () => {
	const context = damageContext();
	for (const conditions of [{ mshield: { ms: 1000 } }, { mshield: { ms: 1000 }, aether_shield: { ms: 1000 } }]) {
		const target = { ...guardian("Ally", 5000), mp: 1000, s: conditions };
		const event = hit(context, target);
		assert.equal(target.hp, 5000);
		assert.equal(target.mp, 666);
		assert.equal(event.mp_restored, undefined);
		assert.equal(event.shield_reaction, "mshield");
		assert.equal(event.damage, 0, "the hit reports actual HP damage after absorption");
	}
	const immune = { ...guardian("Ally", 5000), s: { invincible: {}, aether_shield: { ms: 1000 } } };
	hit(context, immune);
	assert.equal(immune.mp, 0);
	assert.equal(immune.hp, 5000);
	const missed = { ...guardian("Ally", 5000), avoidance: 100, s: { aether_shield: { ms: 1000 } } };
	hit(context, missed);
	assert.equal(missed.mp, 0);
	assert.equal(missed.hp, 5000);
	const killed = { ...guardian("Ally", 100), s: { aether_shield: { ms: 1000 } } };
	hit(context, killed);
	assert.equal(killed.mp, 0);
});

test("even a tiny absorbed hit consumes MP and produces no recovery", () => {
	const context = damageContext();
	const target = { ...guardian("Ally", 5000), mp: 1000, s: { mshield: { ms: 1000 } } };
	const event = hit(context, target, "magical", 1);
	assert.equal(target.hp, 5000);
	assert.equal(target.mp, 999);
	assert.equal(event.mp_damage, 1);
	assert.equal(event.mp_restored, undefined);
});

test("Guardian's Oath returns MP on physical and pure losses and only on the transfer actually paid", () => {
	for (const type of ["physical", "pure"]) {
		const context = damageContext();
		const source = guardian("Guardian", 101);
		context.players.guardian = source;
		const target = protectedTarget();
		const event = hit(context, target, type);
		assert.equal(source.hp, 1);
		assert.equal(source.mp, 100);
		assert.equal(event.guardian_mp, 100);
		assert.equal(target.hp, 100);
	}
});

test("Guardian's Oath transfers post-mitigation damage once and cannot chain", () => {
	const context = guardianContext();
	const firstGuardian = guardian();
	const secondGuardian = guardian("Second", 1000);
	const target = protectedTarget();
	firstGuardian.s.guardians_oath = { ms: 8000, f: "Second" };
	context.players = { firstGuardian, secondGuardian, target };

	const result = context.redirect_guardians_oath_damage(target, 1000);
	assert.equal(result.attack, 650);
	assert.equal(result.redirected, 350);
	assert.equal(firstGuardian.hp, 650);
	assert.equal(secondGuardian.hp, 1000, "redirected damage must not enter a second oath");
	assert.ok(firstGuardian.s.guardians_oath, "the guardian's own incoming oath is untouched");
	assert.ok(target.s.guardians_oath, "a full transfer keeps the oath active");
});

test("Guardian's Oath leaves the Paladin at one HP and breaks when transfer is capped", () => {
	const context = guardianContext();
	const source = guardian("Guardian", 100);
	const target = protectedTarget();
	context.players = { source, target };
	const result = context.redirect_guardians_oath_damage(target, 1000);
	assert.equal(result.attack, 901);
	assert.equal(result.redirected, 99);
	assert.equal(source.hp, 1);
	assert.equal(result.broken, true);
	assert.equal(target.s.guardians_oath, undefined);
});

test("Guardian's Oath reaches non-party friendlies outside PVP and stops across hostility, instance, range, death, and disconnect boundaries", () => {
	{
		const context = guardianContext();
		const source = guardian();
		const target = protectedTarget();
		source.party = "Other";
		context.players = { source, target };
		assert.equal(context.redirect_guardians_oath_damage(target, 1000).redirected, 350);
	}
	for (const mutate of [
		(source, context) => {
			context.pvp = true;
			source.party = "Other";
		},
		(source) => {
			source.in = "other";
		},
		(source) => {
			source.x = 461;
		},
		(source) => {
			source.rip = true;
		},
		(source, context) => {
			context.players = {};
		},
	]) {
		const context = guardianContext();
		const source = guardian();
		const target = protectedTarget();
		context.players = { source, target };
		mutate(source, context);
		const result = context.redirect_guardians_oath_damage(target, 1000);
		assert.equal(result.attack, 1000);
		assert.equal(result.redirected, 0);
		assert.equal(target.s.guardians_oath, undefined);
	}
});

test("skill definitions, fixed targeting, and non-stacking branches are present", () => {
	assert.deepEqual(
		picked(plain(G.skills.cleansing_light), [
			"class",
			"level",
			"mp",
			"cooldown",
			"range",
			"fixed_range",
			"target",
			"party",
			"no_self",
		]),
		{
			class: ["paladin"],
			level: 30,
			mp: 320,
			cooldown: 24000,
			range: 240,
			fixed_range: true,
			target: "player",
			no_self: true,
		},
	);
	assert.deepEqual(
		picked(plain(G.skills.guardians_oath), [
			"class",
			"level",
			"mp",
			"cooldown",
			"duration",
			"range",
			"fixed_range",
			"link_range",
			"ratio",
			"target",
			"party",
			"no_self",
		]),
		{
			class: ["paladin"],
			level: 50,
			mp: 320,
			cooldown: 24000,
			duration: 8000,
			range: 240,
			fixed_range: true,
			link_range: 360,
			ratio: 0.35,
			target: "player",
			no_self: true,
		},
	);
	assert.equal(G.skills.beacon_of_resolve.party, undefined);
	assert.match(G.skills.beacon_of_resolve.explanation, /friendly players/);
	assert.deepEqual(
		picked(plain(G.conditions.beacon_of_resolve), ["for", "courage", "mcourage", "pcourage", "duration", "ui", "buff"]),
		{
			for: 15,
			courage: 1,
			mcourage: 1,
			pcourage: 1,
			duration: 8000,
			ui: true,
			buff: true,
		},
	);
	assert.match(
		serverSource,
		/active_guardians_oath_target\(player\)\)\s*return fail_response\("skill_cant_use", data.name, \{ reason: "outgoing_oath" \}\)/,
	);
	assert.match(
		serverSource,
		/guardians_oath_source\(target\)\)\s*return fail_response\("skill_cant_use", data.name, \{ reason: "incoming_oath" \}\)/,
	);
	assert.match(serverSource, /gSkill\.fixed_range \? 0 : player\.xrange/);
	assert.match(
		serverSource,
		/fail_response\("too_far", data\.name, \{ dist: distance\(player, target\), id: target\.id \}\)/,
	);
	assert.equal((serverSource.match(/!is_same\(player, target, 3\)/g) || []).length >= 2, true);
	assert.match(serverSource, /!is_same\(player, beacon_target, 3\)/);
});

test("Paladin Aura defines four useful level-scaled states and visible conditions", () => {
	assert.deepEqual(
		picked(plain(G.skills.paladin_aura), [
			"class",
			"level",
			"mp",
			"cooldown",
			"range",
			"aura",
			"default_state",
			"rank_levels",
		]),
		{
			class: ["paladin"],
			level: 60,
			mp: 0,
			cooldown: 500,
			range: 320,
			aura: true,
			default_state: "bulwark",
			rank_levels: [60, 70, 80, 90, 100, 110],
		},
	);
	assert.deepEqual(plain(G.skills.paladin_aura.states), {
		bulwark: {
			name: "Aura of the Bulwark",
			condition: "paladin_aura_bulwark",
			values: { armor: [30, 40, 50, 60, 100, 110], hp: [500, 600, 700, 800, 1500, 1750] },
		},
		sanctuary: {
			name: "Aura of Sanctuary",
			condition: "paladin_aura_sanctuary",
			values: { resistance: [30, 40, 50, 60, 100, 110], mp: [150, 200, 250, 300, 600, 700] },
		},
		zeal: {
			name: "Aura of Zeal",
			condition: "paladin_aura_zeal",
			values: { output: [1, 1, 2, 2, 4, 5], frequency: [1, 2, 2, 3, 4, 4] },
		},
		warding: {
			name: "Aura of Warding",
			condition: "paladin_aura_warding",
			values: {
				firesistance: [6, 7, 8, 10, 15, 18],
				fzresistance: [6, 7, 8, 10, 15, 18],
				phresistance: [6, 7, 8, 10, 15, 18],
				pnresistance: [6, 7, 8, 10, 15, 18],
				stresistance: [6, 7, 8, 10, 15, 18],
				mp_reduction: [1, 2, 2, 3, 5, 6],
			},
		},
	});
	for (const state of Object.values(G.skills.paladin_aura.states)) {
		assert.deepEqual(picked(plain(G.conditions[state.condition]), ["duration", "ui", "buff", "aura"]), {
			duration: 60000,
			ui: true,
			buff: true,
			aura: true,
		});
	}
});

test("the strongest same-state Paladin supplies one aura value", () => {
	const context = auraContext();
	const low = auraPlayer("Low", "bulwark", 60, 0);
	const high = auraPlayer("High", "bulwark", 110, 20);
	const target = auraPlayer("Ally", null, 90, 40, "P", "warrior");
	context.instances.main = { players: { low, high, target } };
	context.refresh_paladin_auras();
	assert.deepEqual(plain(target.s.paladin_aura_bulwark), { ms: 60000, f: "High", rank: 6, armor: 110, hp: 1750 });
	assert.equal(Object.keys(target.s).filter((name) => name.startsWith("paladin_aura_")).length, 1);
	const resends = context.resends.length;
	context.refresh_paladin_auras();
	assert.equal(context.resends.length, resends, "an unchanged aura must not resend every second");
	target.s.paladin_aura_bulwark.ms = 9999;
	context.refresh_paladin_auras();
	assert.equal(target.s.paladin_aura_bulwark.ms, 60000, "an aura renews safely in its final ten seconds");
});

test("four Paladins on distinct states provide all four auras without animation", () => {
	const context = auraContext();
	const players = {
		bulwark: auraPlayer("Bulwark", "bulwark"),
		sanctuary: auraPlayer("Sanctuary", "sanctuary", 110, 20),
		zeal: auraPlayer("Zeal", "zeal", 110, 40),
		warding: auraPlayer("Warding", "warding", 110, 60),
		target: auraPlayer("Ally", null, 90, 80, "P", "warrior"),
	};
	context.instances.main = { players };
	context.refresh_paladin_auras();
	assert.deepEqual(Object.keys(players.target.s).sort(), [
		"paladin_aura_bulwark",
		"paladin_aura_sanctuary",
		"paladin_aura_warding",
		"paladin_aura_zeal",
	]);
	assert.deepEqual(picked(plain(players.target.s.paladin_aura_sanctuary), ["resistance", "mp"]), {
		resistance: 110,
		mp: 700,
	});
	assert.deepEqual(picked(plain(players.target.s.paladin_aura_zeal), ["output", "frequency"]), {
		output: 5,
		frequency: 4,
	});
	assert.deepEqual(
		picked(plain(players.target.s.paladin_aura_warding), [
			"firesistance",
			"fzresistance",
			"phresistance",
			"pnresistance",
			"stresistance",
			"mp_reduction",
		]),
		{
			firesistance: 18,
			fzresistance: 18,
			phresistance: 18,
			pnresistance: 18,
			stresistance: 18,
			mp_reduction: 6,
		},
	);
	const helper = serverSource.slice(
		serverSource.indexOf("var PALADIN_AURA_CONDITIONS"),
		serverSource.indexOf("var lrid", serverSource.indexOf("var PALADIN_AURA_CONDITIONS")),
	);
	assert.doesNotMatch(helper, /xy_emit|add_condition|animation|sound|ray/);
});

test("Paladin Aura selection cycles in declaration order and accepts direct CODE selection", () => {
	const context = auraContext();
	const source = auraPlayer("Source", null, 80, 0);
	context.instances.main = { players: { source } };
	assert.equal(context.select_paladin_aura_state(source, "zeal"), "zeal");
	assert.equal(source.p.paladin_aura, "zeal");
	assert.ok(source.s.paladin_aura_zeal);
	assert.equal(context.select_paladin_aura_state(source), "warding");
	assert.equal(source.s.paladin_aura_zeal, undefined);
	assert.ok(source.s.paladin_aura_warding);
	assert.equal(context.select_paladin_aura_state(source, "not_a_state"), "bulwark");
	assert.ok(source.s.paladin_aura_bulwark);
	assert.match(clientFunctions, /name == "paladin_aura"[\s\S]*request\(name, "skill", \{ name: name, id: target \}\)/);
});

test("every Paladin Aura value reaches an existing runtime stat", () => {
	const start = serverSource.indexOf("var stat_to_attr");
	const end = serverSource.indexOf("function calculate_player_stats", start);
	assert.ok(start >= 0 && end > start);
	const context = {};
	vm.createContext(context);
	vm.runInContext(serverSource.slice(start, end), context);
	const player = {
		armor: 400,
		max_hp: 5000,
		resistance: 400,
		max_mp: 3000,
		output: 100,
		frequency: 1,
		firesistance: 0,
		fzresistance: 0,
		phresistance: 0,
		pnresistance: 0,
		stresistance: 0,
		mp_reduction: 0,
	};
	context.apply_stats(player, { armor: 110, hp: 1750 });
	context.apply_stats(player, { resistance: 110, mp: 700 });
	context.apply_stats(player, { output: 5, frequency: 4 });
	context.apply_stats(player, {
		firesistance: 18,
		fzresistance: 18,
		phresistance: 18,
		pnresistance: 18,
		stresistance: 18,
		mp_reduction: 6,
	});
	assert.deepEqual(player, {
		armor: 510,
		max_hp: 6750,
		resistance: 510,
		max_mp: 3700,
		output: 105,
		frequency: 1.04,
		firesistance: 18,
		fzresistance: 18,
		phresistance: 18,
		pnresistance: 18,
		stresistance: 18,
		mp_reduction: 6,
	});
});

test("Paladin Aura reaches all friendlies and leaves immediately across hostility, range, instance, death, and level boundaries", () => {
	const context = auraContext();
	const source = auraPlayer("Source", null, 60, 0);
	const target = auraPlayer("Ally", null, 90, 20, "Other", "warrior");
	context.instances.main = { players: { source, target } };
	context.refresh_paladin_auras();
	assert.equal(source.p.paladin_aura, "bulwark");
	assert.equal(target.s.paladin_aura_bulwark.f, "Source");
	for (const mutate of [
		() => {
			context.pvp = true;
		},
		() => {
			target.x = 321;
		},
		() => {
			target.in = "other";
		},
		() => {
			source.rip = true;
		},
		() => {
			target.rip = true;
		},
		() => {
			source.level = 59;
		},
	]) {
		context.pvp = false;
		target.party = "Other";
		target.x = 20;
		target.in = "main";
		target.rip = false;
		source.rip = false;
		source.level = 60;
		context.refresh_paladin_auras();
		assert.ok(target.s.paladin_aura_bulwark);
		mutate();
		context.refresh_paladin_auras();
		assert.equal(target.s.paladin_aura_bulwark, undefined);
	}
	context.pvp = true;
	source.level = 60;
	source.rip = false;
	target.party = "P";
	target.in = "main";
	target.x = 20;
	target.rip = false;
	context.refresh_paladin_auras();
	assert.equal(target.s.paladin_aura_bulwark.f, "Source", "party members remain friendly in PVP");
});

test("Paladin sprites and animation definitions resolve to shipped assets", () => {
	for (const [name, column] of Object.entries({
		paladin_aura_bulwark: 10,
		paladin_aura_sanctuary: 11,
		paladin_aura_zeal: 12,
		paladin_aura_warding: 13,
		skill_aether_shield: 17,
		skill_shield_slam: 15,
		oathplate: 16,
	}))
		assert.deepEqual(plain(G.positions[name]), ["rawitems", column, 1], `${name} raw-items position`);
	assert.deepEqual(plain(G.imagesets.rawitems), {
		size: 20,
		rows: 40,
		columns: 20,
		file: G.imagesets.rawitems.file,
		load: true,
	});
	assert.match(G.imagesets.rawitems.file, /^\/images\/tiles\/items\/raw_items\.png\?v=\d+$/);
	assert.equal(G.skills.aether_shield.skin, "skill_aether_shield");
	assert.equal(G.conditions.aether_shield.skin, G.skills.aether_shield.skin);
	for (const name of ["cleansing_light", "guardians_oath", "beacon_of_resolve"]) {
		const production = path.join(root, `images/sprites/animations/${name}.png`);
		const png = fs.readFileSync(production);
		assert.equal(png.readUInt32BE(16), 100, name + " sheet width");
		assert.equal(png.readUInt32BE(20), 20, name + " sheet height");
		assert.deepEqual(picked(plain(G.animations[name]), ["frames", "alpha", "aspeed", "exact", "above", "y"]), {
			frames: 5,
			alpha: 1,
			aspeed: "slow",
			exact: true,
			above: true,
			y: 6,
		});
	}
});

test("cast animations use character height, stay above the head, and are headless-safe", () => {
	assert.match(clientFunctions, /if \(def\.above\) asprite\.y = -height - \(def\.y \|\| 0\);/);
	const helper = clientSource.slice(
		clientSource.indexOf("function paladin_support_animation"),
		clientSource.indexOf('socket.on("ui"', clientSource.indexOf("function paladin_support_animation")),
	);
	assert.match(helper, /^function paladin_support_animation\(name, targets\) \{\s*if \(no_graphics\) return;/);
	for (const name of ["cleansing_light", "guardians_oath", "beacon_of_resolve"])
		assert.match(clientSource, new RegExp(`paladin_support_animation\\("${name}", data\\.targets\\)`));
	const characterHeight = 36;
	const animationBottom = -characterHeight - G.animations.cleansing_light.y;
	const animationTop = animationBottom - 20;
	assert.equal(animationBottom, -42);
	assert.equal(animationTop, -62);
});
