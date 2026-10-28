// The Witch's recipe items each have their own identity: a pair set, courage against crowds, attack
// speed, gold, mana cost, courage against spirits, haunted-map evasion and class bonuses. Checked through
// the server's real calculate_player_stats with the loaded definitions.
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read } = require("./helpers/server_vm");

G.geometry = {};
G.T = {};
G.can_buy = {};
G.process_game_data();

const WITCH_ITEMS = [
	"crookedkey",
	"patchbuckler",
	"blackcatbell",
	"nightmarketsash",
	"hexweavegloves",
	"candleboots",
	"witchlightmantle",
	"laughingbook",
];

function fixture() {
	const player = { name: "Witchling", items: [], citems: [], esize: 42, s: {}, socket: { emit() {} } };
	const c = vm.createContext({
		...G,
		G,
		D: { drops: G.drops },
		B: {},
		instances: {},
		players: { witchling: player },
		gameplay: "normal",
		goldm: 1,
		luckm: 1,
		xpm: 1,
		mode: {},
		parties: {},
		perfc: { cps: 0 },
		resend() {},
		xy_emit() {},
		remove_entity_emit() {},
		recalculate_vxy() {},
		market_patron_reset() {},
		generated_can_enter: () => true,
		send_generated_maps() {},
		is_invis: () => false,
		pmap_remove() {},
		pmap_add() {},
		resume_instance() {},
		add_call_cost() {},
		send_all_xy: () => ({}),
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats")), c);
	load(c, "node/server.js", ["apply_stats", "calculate_common_stats", "calculate_player_stats", "transport_player_to"]);
	c.instances = Object.fromEntries(["main", "halloween", "spookytown"].map((map) => [map, { map, players: {} }]));
	return { c, player };
}

// The stats a character ends up with, wearing only the given slots
function stats(type, slots, map = "main") {
	const { c, player: p } = fixture();
	Object.assign(p, {
		id: "Witchling",
		type,
		level: 80,
		xp: 0,
		damage_type: G.classes[type].damage_type,
		map,
		in: map,
		hp: 100,
		mp: 100,
		slots,
		p: { stats: { monsters: {}, monsters_diff: {} } },
		max_stats: { monsters: {} },
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
		bets: {},
		last: {},
		m: 0,
		cid: 0,
	});
	c.instances[map].players.Witchling = p;
	c.calculate_player_stats(p);
	return { c, p };
}

const pick = (p, names) => Object.fromEntries(names.map((name) => [name, p[name]]));

test("Luck stays only on the Cipher Draught", () => {
	for (const name of WITCH_ITEMS) {
		const def = G.items[name];
		assert.equal(def.luck, undefined, name);
		for (const block of ["upgrade", "compound", "halloween", "spookytown", "merchant", "priest", "mage"])
			assert.equal((def[block] || {}).luck, undefined, name + " " + block);
	}
	assert.equal(G.items.cipherdraught.luck, 25);
});

test("one Crooked Key pierces a little; two open the Skeleton Keys set", () => {
	const base = pick(stats("warrior", {}).p, ["apiercing", "rpiercing"]);
	const one = pick(stats("warrior", { earring1: { name: "crookedkey", level: 0 } }).p, ["apiercing", "rpiercing"]);
	const two = stats("warrior", {
		earring1: { name: "crookedkey", level: 0 },
		earring2: { name: "crookedkey", level: 0 },
	}).p;
	assert.deepEqual(one, { apiercing: base.apiercing + 20, rpiercing: base.rpiercing + 20 });
	assert.equal(two.sets.crookedkeys, 2);
	assert.deepEqual(pick(two, ["apiercing", "rpiercing"]), {
		apiercing: base.apiercing + 120,
		rpiercing: base.rpiercing + 120,
	});
	assert.equal(G.sets.crookedkeys.name, "Skeleton Keys");
});

test("the Patchwork Buckler adds courage of every kind, more as it is upgraded", () => {
	const courage = (slots) => pick(stats("paladin", slots).p, ["courage", "mcourage", "pcourage"]);
	const base = courage({});
	const plus = (slots, n) =>
		assert.deepEqual(courage(slots), {
			courage: base.courage + n,
			mcourage: base.mcourage + n,
			pcourage: base.pcourage + n,
		});
	plus({ offhand: { name: "patchbuckler", level: 0 } }, 2);
	plus({ offhand: { name: "patchbuckler", level: 7 } }, 4);
});

test("the Black Cat's Bell is an attack speed orb for every class", () => {
	for (const type of ["warrior", "mage", "priest", "merchant"]) {
		const base = stats(type, {}).p.frequency;
		assert.ok(Math.abs(stats(type, { orb: { name: "blackcatbell", level: 0 } }).p.frequency - base - 0.1) < 1e-9, type);
		assert.ok(
			Math.abs(stats(type, { orb: { name: "blackcatbell", level: 3 } }).p.frequency - base - 0.16) < 1e-9,
			type,
		);
	}
});

test("the Nightmarket Sash finds gold, twice as much for merchants", () => {
	const gold = (type) => stats(type, { belt: { name: "nightmarketsash", level: 0 } }).p.goldm - stats(type, {}).p.goldm;
	assert.ok(Math.abs(gold("ranger") - 0.1) < 1e-9);
	assert.ok(Math.abs(gold("merchant") - 0.2) < 1e-9);
});

test("Hexweave Gloves keep a flat mana cost reduction on top of Tier 4 glove defenses", () => {
	for (const level of [0, 5, 10]) {
		const worn = stats("mage", { gloves: { name: "hexweavegloves", level, stat_type: "int" } }).p;
		assert.equal(worn.mp_reduction - stats("mage", {}).p.mp_reduction, 20, "level " + level);
	}
	// The Tier 4 loop's glove defenses: 36/18 at +0, 7.5 more of each a level (INT adds its own resistance on top)
	const { c } = fixture();
	const defenses = (level) => {
		const prop = c.calculate_item_properties({ name: "hexweavegloves", level, stat_type: "int" });
		return [prop.armor, prop.resistance, prop.int];
	};
	assert.deepEqual(defenses(0), [36, 18, 4]);
	assert.deepEqual(defenses(7), [90, 72, 12]);
});

test("Mana Cost Reduction stops at 80%, however much gear stacks", () => {
	const gear = {
		gloves: { name: "hexweavegloves", level: 0, stat_type: "int" },
		belt: { name: "mpxbelt", level: 7 },
		amulet: { name: "mpxamulet", level: 7 },
	};
	assert.equal(stats("mage", gear).p.mp_reduction, 80, "20 + 54 + 30 is capped");
	assert.equal(stats("mage", { belt: gear.belt }).p.mp_reduction, 54, "below the cap nothing changes");
});

test("Candlewick Boots keep spirits at a distance with magic and pure courage, and a flat fire resistance", () => {
	const at = (level) => stats("rogue", { shoes: { name: "candleboots", level, stat_type: "dex" } }).p;
	const base = stats("rogue", {}).p;
	for (const level of [0, 7]) {
		const worn = at(level);
		assert.deepEqual(
			[worn.courage - base.courage, worn.mcourage - base.mcourage, worn.pcourage - base.pcourage],
			[0, 3, 2],
			"level " + level,
		);
		assert.equal(worn.firesistance - base.firesistance, 15);
		assert.equal(worn.stresistance, base.stresistance, "no status resistance");
	}
});

test("the Witchlight Mantle gives evasion in Spooky Forest and Spooky Town and nowhere else", () => {
	const slots = { cape: { name: "witchlightmantle", level: 0, stat_type: "dex" } };
	const { c, p } = stats("rogue", slots, "main");
	const plain = p.evasion;
	assert.equal(plain, stats("rogue", {}, "main").p.evasion);
	for (const map of ["halloween", "spookytown"]) {
		c.transport_player_to(p, map, 0);
		assert.equal(p.evasion, plain + 25, map);
		c.transport_player_to(p, "main", 0);
		assert.equal(p.evasion, plain, "back on " + map);
	}
	assert.deepEqual([...G.items.witchlightmantle.grades], [0, 0, 8, 10]);
});

test("the Laughing Grimoire gives Priests more INT and Mages crit", () => {
	const book = { offhand: { name: "laughingbook", level: 0 } };
	const gain = (type, stat) => stats(type, book).p[stat] - stats(type, {}).p[stat];
	assert.equal(gain("priest", "int"), 42);
	assert.equal(gain("mage", "int"), 22);
	assert.equal(gain("paladin", "int"), 22);
	assert.equal(gain("mage", "crit"), 4);
	assert.equal(gain("mage", "critdamage"), 25);
	assert.equal(gain("priest", "crit"), 0);
	assert.equal(gain("paladin", "critdamage"), 0);
});

test("the Horseman's Pumpkin reflects magic, more as it is upgraded", () => {
	const reflection = (level) =>
		stats("priest", { helmet: { name: "horsemanpumpkin", level, stat_type: "int" } }).p.reflection -
		stats("priest", {}).p.reflection;
	assert.ok(Math.abs(reflection(0) - 5) < 1e-9);
	assert.ok(reflection(7) > 8.4 && reflection(7) < 8.7, String(reflection(7)));
});

test("the Witch's recipes cost Parcels, a Gold Ingot and a Halloween material", () => {
	for (const name of WITCH_ITEMS) {
		const recipe = G.craft[name];
		const parcels = recipe.items.find((part) => part[1] == "witchparcel")[0];
		assert.ok(parcels >= 30 && parcels <= 50, name);
		assert.deepEqual([...recipe.items.filter((part) => part[1] == "goldingot").map((part) => part[0])], [1], name);
		assert.equal(recipe.items.length, 3, name);
		assert.equal(recipe.quest, "witch", name);
	}
});
