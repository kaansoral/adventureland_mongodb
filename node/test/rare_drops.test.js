"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const G = require("./helpers/design");
const { DueQueue } = require("../logic/due_queue.js");
const source = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
const functions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");

const ITEMS = {
	stonegaze: ["ring", "oneeye", 250000, "petrify"],
	mummyhex: ["earring", "mummy", 290000, "hex"],
	harpyecho: ["orb", "harpy", 220000, "shatter"],
	canopener: ["ring", "bscorpion", 70000, "sunder"],
	blightcap: ["earring", "pppompom", 420000, "poison"],
	gnomecap: ["amulet", "mechagnome", 42000, "restore_mp"],
	koboldbelt: ["belt", "kobold", 84000],
	frostfang: ["earring", "wolf", 560000],
	paleclaw: ["amulet", "paledino", 30, "frenzy"],
	mimicgrin: ["orb", "mimic", 19],
	scorpionseal: ["ring", "xscorpion", 280000],
	watchersearring: ["earring", "manyeye", 17],
	graveglass: ["orb", "ghost", 320000],
	heartwoodlocket: ["amulet", "dryad", 390000],
	groundingstrap: ["belt", "sparkbot", 420000],
};
const VARIANTS = { manyeye: "oneeye", mimic: "kobold", paledino: "odino" };

function definition(text, name) {
	const start = text.indexOf(`function ${name}(`);
	assert.ok(start >= 0, name);
	return text.slice(start, text.indexOf("\nfunction ", start + 1));
}

test("the fifteen rare accessories load as exclusive compound items with their own sheet cells", () => {
	const cells = new Set();
	for (const [id, [type, , , ability]] of Object.entries(ITEMS)) {
		const def = G.items[id];
		assert.ok(def, id);
		assert.equal(def.type, type, id);
		assert.deepEqual(Array.from(def.grades), [0, 0, 6, 7], id);
		assert.equal(def.exclusive, true, id);
		assert.ok(def.compound && def.g > 0 && def.a === true, id);
		assert.match(def.cx.accent, /^#[0-9A-F]{6}$/, id);
		assert.equal(def.ability, ability, id);
		const position = G.positions[def.skin];
		assert.equal(position[0], "rawitems", id);
		assert.equal(position[2], 5, id);
		cells.add(position.join());
		for (const pool of ["glitch", "lglitch"])
			assert.ok(!JSON.stringify(G.drops[pool]).includes(`"${id}"`), `${id} is in ${pool}`);
	}
	assert.equal(cells.size, 15);
	for (const icon of ["condition_stoned", "condition_exposed", "condition_sundered", "condition_frenzied"]) {
		assert.equal(G.positions[icon][0], "rawitems");
		assert.ok(!cells.has(G.positions[icon].join()), icon);
	}
});

test("each accessory drops from exactly its source table", () => {
	for (const [id, [, monster, denominator]] of Object.entries(ITEMS)) {
		const rows = Object.entries(G.drops.monsters).flatMap(([name, table]) =>
			table.filter((row) => row[1] === id).map((row) => [name, row]),
		);
		assert.equal(rows.length, 1, `${id} rows: ${JSON.stringify(rows)}`);
		assert.equal(rows[0][0], monster, id);
		assert.ok(Math.abs(rows[0][1][0] - 1 / denominator) < 1e-12, id);
	}
});

test("class limits, class bonuses, map bonuses and the pair set use the existing item math", () => {
	const seal = (cls) => G.calculate_item_properties({ name: "scorpionseal", level: 0 }, { class: cls });
	assert.deepEqual(Array.from(G.items.scorpionseal.class), ["warrior", "rogue", "paladin"]);
	assert.equal(seal("warrior").str, 10);
	assert.equal(seal("warrior").apiercing, 50);
	assert.equal(seal("rogue").dex, 10);
	assert.equal(seal("rogue").crit, 3);
	assert.equal(seal("paladin").armor, 60);
	assert.deepEqual(Array.from(G.items.heartwoodlocket.class), ["priest"]);
	const lens = (map) => G.calculate_item_properties({ name: "graveglass", level: 0 }, { map });
	for (const map of ["halloween", "spookytown", "cave", "crypt"]) assert.equal(lens(map).rpiercing, 75, map);
	assert.equal(lens("main").rpiercing, 15);
	assert.deepEqual(JSON.parse(JSON.stringify(G.sets.watchers[2])), { range: 15, stresistance: 15, evasion: 2 });
	assert.equal(G.items.watchersearring.set, "watchers");
	assert.equal(
		G.items.gnomecap.attr1,
		G.items.gnomecap.attr0,
		"the Capacitor marks its whole restore chance as capped",
	);
	assert.equal(G.items.mpxgloves.attr1, undefined, "Mana Gloves keep their uncapped chance");
});

test("every passive's condition exists with a visible 20x20 icon", () => {
	const expected = {
		stoned: { blocked: true, debuff: true },
		cursed: { incdmgamp: 20, debuff: true },
		exposed: { resistance: -240, debuff: true, duration: 5000 },
		sundered: { armor: -200, debuff: true, duration: 5000 },
		frenzied: { frequency: 40, buff: true, duration: 6000 },
	};
	for (const [name, fields] of Object.entries(expected)) {
		const condition = G.conditions[name];
		assert.equal(condition.ui, true, name);
		const position = G.positions[condition.skin];
		assert.ok(position, `${name} icon ${condition.skin}`);
		assert.equal(G.imagesets[position[0] || "pack_20"].size || 20, 20, name);
		for (const [key, value] of Object.entries(fields)) assert.equal(condition[key], value, `${name}.${key}`);
	}
	assert.equal(G.conditions.stonebreak.duration, 14000);
	assert.ok(!G.conditions.stonebreak.buff && !G.conditions.stonebreak.debuff && !G.conditions.stonebreak.ui);
	for (const name of ["exposed", "sundered"]) assert.equal(G.conditions[name].cleansable, true, name);
});

test("the new monsters are tougher than their farms and carry regular achievements", () => {
	const stats = new Set(Object.values(G.monsters).flatMap((m) => (m.achievements || []).map((a) => a[2])));
	for (const id of ["kobold", ...Object.keys(VARIANTS)]) {
		const m = G.monsters[id];
		assert.ok(m && m.hp > 0, id);
		assert.ok(m.achievements.length >= 6, id);
		for (const [count, kind, stat, value] of m.achievements) {
			assert.equal(kind, "stat", id);
			assert.ok(count > 0 && value > 0, id);
			assert.ok(stats.has(stat), `${id} uses an unknown achievement stat ${stat}`);
		}
		assert.ok(G.drops.monsters[id].length >= 3, id);
	}
	const growHp = Object.values(G.maps).flatMap((map) =>
		(map.monsters || []).filter((p) => p.grow && p.type !== "kobold").map((p) => G.monsters[p.type].hp),
	);
	assert.ok(G.monsters.kobold.hp > Math.max(...growHp), "the Kobold is the toughest grow-pack farm");
	for (const [variant, parent] of Object.entries(VARIANTS)) {
		assert.ok(G.monsters[variant].hp >= 3.5 * G.monsters[parent].hp, variant);
		assert.equal(G.monsters[variant].respawn, -1, variant);
		assert.ok(G.monster_gold[variant] > 0, variant);
	}
	assert.equal(G.monsters.manyeye.abilities.stone.cooldown, G.monsters.oneeye.abilities.stone.cooldown);
	assert.equal(G.sprites.creatures2.matrix[0][1], "manyeye");
	assert.deepEqual(
		JSON.parse(
			JSON.stringify(G.maps.ucliffs.monsters.filter((p) => p.type === "kobold").map((p) => [p.count, p.grow, p.roam])),
		),
		[
			[2, true, true],
			[2, true, true],
		],
	);
});

function harness(attackerA, targetOverrides = {}) {
	const events = [];
	const context = {
		G: JSON.parse(JSON.stringify(G, (key, value) => (key === "G" || key === "global" ? undefined : value))),
		Math: Object.assign(Object.create(Math), { random: () => 0 }),
		players: {},
		instances: { main: { monsters: {}, players: {} } },
		id_to_id: {},
		mode: {},
		B: { max_vision: 1000, heal_multiplier: 1 },
		projectiles: {},
		projectiles_due: new DueQueue(),
		now: 10000,
		is_silenced: () => false,
		is_invis: () => false,
		is_in_pvp: () => false,
		is_array: Array.isArray,
		in_arr: (value, array) => array.includes(value),
		min: Math.min,
		max: Math.max,
		abs: Math.abs,
		ceil: Math.ceil,
		floor: Math.floor,
		round: Math.round,
		parseInt,
		distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		point_distance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
		future_ms: (ms = 0) => context.now + ms,
		mssince: (time) => context.now - time,
		randomStr: () => String(Object.keys(context.projectiles).length + 1),
		damage_multiplier: G.damage_multiplier,
		server_log() {},
		direction_logic() {},
		step_out_of_invis() {},
		resend() {},
		projectiles_loop() {},
		add_pdps() {},
		ccms() {},
		achievement_logic_monster_damage() {},
		is_same: () => false,
		disappearing_text: (socket, entity, message) => events.push({ name: "text", data: { id: entity.id, message } }),
		localization: { message: (id) => id },
		monster_abilities: { interrupt() {} },
		xy_emit: (entity, name, data) => events.push({ name, data }),
		fail_response: (response, place) => events.push({ name: "failure", data: { response, place } }),
	};
	vm.createContext(context);
	context.is_disabled = (entity) => context.G.is_disabled_check(entity);
	vm.runInContext(fs.readFileSync(path.join(root, "node/logic/instance_pause.js"), "utf8"), context);
	vm.runInContext(fs.readFileSync(path.join(root, "node/logic/encouragement.js"), "utf8"), context);
	vm.runInContext(fs.readFileSync(path.join(root, "node/logic/cavalry.js"), "utf8"), context);
	require("./helpers/server_vm").load(context, "node/logic/cave_of_many_dreams.js", [
		"cave_hostile",
		"cave_accept_attack",
		"cave_damage",
		"cave_death",
	]);
	vm.runInContext(definition(source, "add_coop_points"), context);
	vm.runInContext(definition(source, "commence_attack"), context);
	vm.runInContext(
		source.slice(source.indexOf("function paladin_damage_mp("), source.indexOf("function target_player(")),
		context,
	);
	for (const name of ["consume_mp", "add_condition"]) vm.runInContext(definition(functions, name), context);
	context.G.is_disabled_check = (entity) => !!(entity.s && (entity.s.stunned || entity.s.stoned));
	const socket = { id: "test", emit: (name, data) => events.push({ name, data }) };
	const player = {
		id: "Hero",
		name: "Hero",
		type: "warrior",
		is_player: true,
		level: 80,
		hp: 10000,
		max_hp: 10000,
		mp: 10000,
		max_mp: 10000,
		mp_cost: 10,
		attack: 1000,
		armor: 100,
		attack_ms: 1000,
		slots: { mainhand: { name: "blade" } },
		s: {},
		a: attackerA,
		p: {},
		last: {},
		hitchhikers: [],
		socket,
		x: 0,
		y: 0,
		map: "main",
		in: "main",
		range: 80,
		xrange: 0,
		damage_type: "physical",
		cid: 1,
	};
	const target = Object.assign(
		{
			id: 1,
			type: "goo",
			is_monster: true,
			hp: 1000000,
			max_hp: 1000000,
			x: 30,
			y: 0,
			m: 1,
			map: "main",
			in: "main",
			s: {},
			a: {},
			last: {},
			points: {},
			hits: 0,
			cid: 1,
			target: "Hero",
		},
		targetOverrides,
	);
	context.players.test = player;
	context.instances.main.monsters[1] = target;
	const hit = (atype = "attack", on = target) => {
		const info = context.commence_attack(player, on, atype);
		if (info && info.failed) return info;
		const projectile = context.projectiles[Object.keys(context.projectiles).pop()];
		context.complete_attack(player, on, projectile);
		return projectile;
	};
	return { context, player, target, events, hit };
}

test("Stonegaze stones any opponent once, then the target crumbles before it can be stoned again", () => {
	const h = harness({ petrify: { attr0: 1.5 } });
	h.hit();
	assert.ok(h.target.s.stoned, "a forced roll stones the monster");
	assert.equal(h.target.s.stoned.ms, 4000);
	assert.equal(h.target.s.stonebreak.ms, 14000);
	assert.ok(h.events.some((e) => e.name === "text" && e.data.message === "server.floating.stone"));
	delete h.target.s.stoned;
	h.hit();
	assert.equal(h.target.s.stoned, undefined, "no stone while crumbling");
	delete h.target.s.stonebreak;
	h.hit();
	assert.ok(h.target.s.stoned, "stone returns after the window");
	const immune = harness({ petrify: { attr0: 100 } }, { immune: true });
	immune.hit();
	assert.equal(immune.target.s.stoned, undefined, "immune targets ignore it");
	const unlucky = harness({ petrify: { attr0: 1.5 } });
	unlucky.context.Math.random = () => 0.5;
	unlucky.hit();
	assert.equal(unlucky.target.s.stoned, undefined, "a failed roll does nothing");
});

test("Hex curses, Shatter exposes only on magical hits and Sunder only on physical ones", () => {
	const h = harness({ hex: { attr0: 3.5 }, sunder: { attr0: 4 }, shatter: { attr0: 5 } });
	h.hit();
	assert.ok(h.target.s.cursed);
	assert.ok(h.target.s.sundered, "physical hit sunders");
	assert.equal(h.target.s.exposed, undefined, "physical hit never exposes");
	const m = harness({ shatter: { attr0: 5 }, sunder: { attr0: 4 } });
	m.player.damage_type = "magical";
	m.player.type = "mage";
	m.player.slots.mainhand = { name: "staff" };
	m.hit();
	assert.ok(m.target.s.exposed, "magical hit exposes");
	assert.equal(m.target.s.sundered, undefined, "magical hit never sunders");
});

test("the on-hit passives never ride on heals", () => {
	const h = harness({
		petrify: { attr0: 100 },
		hex: { attr0: 100 },
		sunder: { attr0: 100 },
		shatter: { attr0: 100 },
		frenzy: { attr0: 100 },
	});
	h.player.type = "priest";
	h.player.damage_type = "magical";
	h.player.heal = 1000;
	const ally = {
		id: "Ally",
		name: "Ally",
		is_player: true,
		hp: 100,
		max_hp: 10000,
		x: 20,
		y: 0,
		map: "main",
		in: "main",
		s: {},
		a: {},
		last: {},
		slots: {},
		cid: 1,
	};
	h.context.players.ally = ally;
	const projectile = h.hit("heal", ally);
	assert.ok(!projectile.failed, JSON.stringify(projectile));
	assert.deepEqual(Array.from(projectile.conditions), []);
	assert.deepEqual(Object.keys(ally.s), []);
	assert.equal(h.player.s.frenzied, undefined);
});

test("Primal Frenzy starts on a landed hit and refreshes to six seconds", () => {
	const h = harness({ frenzy: { attr0: 1.75 } });
	h.hit();
	assert.equal(h.player.s.frenzied.ms, 6000);
	assert.ok(h.events.some((e) => e.name === "text" && e.data.message === "server.floating.frenzy"));
	h.player.s.frenzied.ms = 1000;
	h.hit();
	assert.equal(h.player.s.frenzied.ms, 6000);
	assert.equal(G.conditions.frenzied.frequency, 40);
});

test("the Capacitor's restore share lifts the chance to at most 20% and never weakens Mana Gloves", () => {
	const context = {
		G,
		Math: Object.assign(Object.create(Math), { random: () => 0 }),
		min: Math.min,
		max: Math.max,
		parseInt,
		xy_emit() {},
	};
	vm.createContext(context);
	vm.runInContext(definition(functions, "consume_mp"), context);
	const run = (a, roll, humanoid) => {
		const player = { a: { restore_mp: a }, mp: 1000, max_mp: 5000, mp_reduction: 0 };
		context.Math.random = () => roll;
		context.consume_mp(player, 100, humanoid ? { humanoid: true } : undefined);
		return player.mp;
	};
	// Capacitor +3 (4.5%) with Mana Gloves +0 (2%): 32.5% against humanoids, capped to 20%.
	const both = { attr0: 6.5, attr1: 4.5 };
	assert.equal(run(both, 0.199, true), 1200, "restores below 20%");
	assert.equal(run(both, 0.201, true), 900, "pays above 20%");
	assert.equal(run(both, 0.064, false), 1200, "monsters keep the plain 6.5%");
	// Mana Gloves +11 alone: 9.5% x5 = 47.5%, untouched.
	assert.equal(run({ attr0: 9.5, attr1: 0 }, 0.47, true), 1200);
	// Gloves +11 plus a Capacitor: the gloves' own 47.5% still stands.
	assert.equal(run({ attr0: 14, attr1: 4.5 }, 0.47, true), 1200);
	assert.equal(run({ attr0: 14, attr1: 4.5 }, 0.476, true), 900);
});

test("rare variants spawn inside their parent's packs, one at a time", () => {
	const spawned = [];
	const context = {
		G,
		D: { monster_gold: G.monster_gold },
		floor: Math.floor,
		Math: Object.assign(Object.create(Math), { random: () => 0 }),
		new_monster: (map, pack) => spawned.push([map, pack]),
		broadcast() {},
	};
	vm.createContext(context);
	vm.runInContext(definition(functions, "spawn_special_monster"), context);
	for (const [variant, parent] of Object.entries(VARIANTS)) {
		spawned.length = 0;
		context.spawn_special_monster(variant);
		assert.equal(spawned.length, 1, variant);
		const [map, pack] = spawned[0];
		assert.ok(
			G.maps[map].monsters.some((p) => p.type === parent && String(p.boundary) === String(pack.boundary)),
			variant,
		);
		assert.equal(pack.type, variant);
		assert.equal(pack.count, 1);
		assert.equal(pack.gold, G.monster_gold[variant]);
		assert.equal(pack.roam, variant !== "mimic");
	}
	const start = functions.indexOf("// One of each rare variant at a time");
	const block = functions.slice(start, functions.indexOf("\t\t});\n", start) + 6);
	const loop = {
		events: { manyeye: 30000, mimic: 24000, paledino: 60000 },
		stats: { kills: { oneeye: 15001, kobold: 0, odino: 0 } },
		edges: { next_manyeye: 15000, next_mimic: 12000, next_paledino: 30000 },
		monster_c: {},
		calls: [],
	};
	loop.spawn_special_monster = (type) => loop.calls.push(type);
	loop.parseInt = parseInt;
	loop.Math = Object.assign(Object.create(Math), { random: () => 0.5 });
	vm.createContext(loop);
	vm.runInContext(block, loop);
	assert.deepEqual(loop.calls, ["manyeye"]);
	assert.equal(loop.edges.next_manyeye, 30000);
	loop.stats.kills.oneeye = 30001;
	loop.monster_c.manyeye = 1;
	vm.runInContext(block, loop);
	assert.deepEqual(loop.calls, ["manyeye"], "no second Many Eye while one lives");
	assert.equal(loop.edges.next_manyeye, 45000, "the counter still advances");
});

test("each monster guide opens from INFO at its map's entrance", () => {
	const context = vm.createContext({});
	vm.runInContext(fs.readFileSync(path.join(root, "docs/directory.js"), "utf8"), context);
	const docs = context.docs;
	const seo = fs.readFileSync(path.join(root, "seo_paths.js"), "utf8");
	const mcp = fs.readFileSync(path.join(root, "mcp_api.js"), "utf8");
	const english = Object.assign(
		{},
		require("../../languages/en/definitions.js"),
		require("../../languages/en/docs.js"),
	);
	const world = docs.guide.find((entry) => entry[0] === "world")[4].map((entry) => entry[0]);
	const GUIDES = {
		mimic: ["mimic", "ucliffs", 1],
		manyeye: ["many-eye", "level2w", 0],
		paledino: ["pale-dino", "mforest", 0],
		goldenbat: ["golden-bat", "cave", 0],
		// Mainland is a town: the Cute Bee's INFO sits in the Goo field, where new players hunt
		cutebee: ["cute-bee", "main", "goo"],
		goldenbot: ["golden-bot", "uhills", 0],
	};
	for (const [monster, [slug, map, spawn]] of Object.entries(GUIDES)) {
		const interaction = docs.interactions[monster];
		assert.equal(interaction.article, slug, monster);
		assert.equal(interaction.skin, monster, "the INFO button shows the monster itself");
		assert.equal(interaction.proximity, true, monster);
		assert.equal(docs.interaction_map.quirks[monster + "_info"], monster);
		const quirks = G.maps[map].quirks.filter((quirk) => quirk[4] === monster + "_info");
		assert.equal(quirks.length, 1, monster + " has one INFO spot on " + map);
		const pack = typeof spawn === "string" && G.maps[map].monsters.find((p) => p.type === spawn).boundary;
		const [x, y] = pack ? [(pack[0] + pack[2]) / 2, (pack[1] + pack[3]) / 2] : G.maps[map].spawns[spawn];
		assert.deepEqual(
			[quirks[0][0], quirks[0][1], quirks[0][2], quirks[0][3]],
			[x, y, 0, 0],
			"at the entry spawn or the named pack's center, with no click area",
		);
		assert.ok(fs.existsSync(path.join(root, "docs/guide", slug + ".html")), slug);
		const html = fs.readFileSync(path.join(root, "docs/guide", slug + ".html"), "utf8");
		assert.match(html, new RegExp(`G\\.drops\\.monsters\\.${monster}\\.map`));
		for (const id of html.match(/phrase\("([^"]+)"\)/g).map((m) => m.slice(8, -2)))
			assert.ok(english[id] || id.startsWith("interface."), `${slug}: ${id}`);
		assert.ok(english[`interaction.${monster}.summary`], monster);
		assert.equal(english[`interaction.${monster}.summary`], interaction.summary);
		assert.ok(world.includes(slug), slug + " is listed under World & Community");
		assert.ok(seo.includes(`"/docs/guide/${slug}"`) && seo.includes(`"/docs/guide/world/${slug}"`), slug);
		assert.ok(mcp.includes(`uri: "adventureland://guide/${slug}"`), slug);
	}
	assert.ok(!fs.existsSync(path.join(root, "docs/guide/rare-drops.html")));
	// The Kobold is an ordinary monster: its info window is enough
	assert.equal(docs.interactions.kobold, undefined);
	assert.ok(!fs.existsSync(path.join(root, "docs/guide/kobold.html")));
	assert.ok(!world.includes("rare-drops"));
	// The chest sits 3.5 px right of its frame's center; this crops and centers it in the world and on INFO
	assert.deepEqual(Array.from(G.dimensions[G.monsters.mimic.skin]), [36, 30, 4]);
});

test("each monster guide shows the monster from four sides, its spawn rule and its habitat", () => {
	const events = {};
	const block = source.slice(source.indexOf("var events = {"), source.indexOf("};", source.indexOf("var events = {")));
	for (const m of block.matchAll(/(\w+): (\d+),/g)) events[m[1]] = +m[2];
	const english = require("../../languages/en/definitions.js");
	const client = fs.readFileSync(path.join(root, "js/html.js"), "utf8");
	assert.match(client, /\nfunction guide_monster_tile\(name, j\) \{/);
	assert.match(client, /\nfunction guide_monster_views\(name\) \{/);
	// the four labels exist in every language
	for (const dir of fs
		.readdirSync(path.join(root, "languages"))
		.filter((d) => fs.existsSync(path.join(root, "languages", d, "interface.json")))) {
		const catalog = JSON.parse(fs.readFileSync(path.join(root, "languages", dir, "interface.json"), "utf8"));
		for (const side of ["front", "left", "right", "back"])
			assert.ok(catalog[`interface.monster_views.${side}`], `${dir} ${side}`);
	}
	const PARENTS = {
		mimic: ["mimic", ["kobold"]],
		manyeye: ["many-eye", ["oneeye"]],
		paledino: ["pale-dino", ["odino"]],
		goldenbat: ["golden-bat", ["bat"]],
		cutebee: ["cute-bee", ["bee"]],
		goldenbot: ["golden-bot", ["sparkbot", "targetron"]],
	};
	for (const [monster, [slug, parents]] of Object.entries(PARENTS)) {
		const html = fs.readFileSync(path.join(root, "docs/guide", slug + ".html"), "utf8");
		assert.ok(html.includes(`.html(guide_monster_views("${monster}"));`), slug);
		assert.ok(
			html.includes(`<div class="guide-views ${slug}-views"></div>\n<div class="divider"></div>`),
			slug + " views then a divider",
		);
		assert.ok(html.includes(`<div class="guide-drops ${slug}-drops"></div>`), slug + " compact drops");
		const spawn = html.match(
			/\$\("\.[\w-]+-spawn"\)\.html\((\[[^\]]*\])\.map[^\n]*to_pretty_num\((\d+)\)[^\n]*guide_monster_tile\("(\w+)", 0\)\);/,
		);
		assert.ok(spawn, slug + " has a spawn rule");
		assert.deepEqual(JSON.parse(spawn[1]), parents, slug);
		assert.equal(spawn[3], monster, slug);
		// the number is the spawner's mean interval, and the translated caption states the same number
		assert.equal(+spawn[2], events[monster] / 2, slug);
		assert.ok(english[`monster.${monster}.explanation`].includes((+spawn[2]).toLocaleString("en-US")), slug);
		const img = html.match(/<img src="(\/images\/guide\/[\w-]+\.webp)\?v=[0-9a-f]+" width="(\d+)" height="(\d+)"/);
		assert.ok(img, slug + " has a habitat map");
		// a lossless WebP (VP8L): 14-bit width and height, minus one, right after the signature byte
		const webp = fs.readFileSync(path.join(root, img[1]));
		assert.equal(webp.toString("ascii", 12, 16), "VP8L", slug + " habitat is a lossless WebP");
		const bits = webp.readUInt32LE(21);
		assert.deepEqual([(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1], [+img[2], +img[3]], slug + " habitat size");
		assert.ok(html.includes('stroke="#73FFAC"'), slug + " outlines where it appears");
	}
});
