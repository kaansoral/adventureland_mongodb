"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read } = require("./helpers/server_vm");

function fixture() {
	const p = {
		id: "Tracker",
		name: "Tracker",
		real_id: "Tracker",
		type: "warrior",
		level: 1,
		xp: 0,
		map: "main",
		in: "main",
		hp: 100,
		mp: 100,
		gold: 0,
		slots: {},
		items: [{ name: "tracker" }],
		citems: [],
		s: {},
		p: { stats: { monsters: {}, monsters_diff: {} } },
		max_stats: { monsters: {} },
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
		bets: {},
		last: {},
		m: 0,
		cid: 0,
		hitchhikers: [],
		socket: { emit() {} },
	};
	const c = vm.createContext({
		...G,
		G,
		mode: {},
		B: {},
		P: {},
		gameplay: "normal",
		parties: {},
		goldm: 1,
		luckm: 1,
		xpm: 1,
		perfc: { cps: 0 },
		players: { Tracker: p },
		name_to_id: { Tracker: "Tracker" },
		stats: { kills: { bee: 0 } },
		recalculate_vxy() {},
		drop_something() {},
		monster_hunt_logic() {},
		calculate_monster_score: () => 1,
		encouragement_xp: (player, monster, xp) => xp,
		resend() {},
		disappearing_text() {},
		cache_item: (item) => ({ ...item }),
		T: {},
		events: {},
		prune_cx() {},
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats")), c);
	load(c, "node/server.js", [
		"apply_stats",
		"calculate_common_stats",
		"calculate_player_stats",
		"issue_monster_award",
		"issue_monster_awards",
	]);
	load(c, "node/server_functions.js", ["reset_player", "init_player"]);
	return { c, p, calculate: () => c.calculate_player_stats(p) };
}

const bonus = G.monsters.bee.achievements.find((row) => row[1] === "stat" && row[2] === "hp");

test("real stat calculation reuses the cache and applies it only while tracker eligibility is enabled", () => {
	const { p, calculate } = fixture();
	calculate();
	const baseHP = p.max_hp;
	p.p.stats.monsters.bee = bonus[0];
	p.monster_stats_dirty = true;
	calculate();
	const cached = p.monster_stats;
	assert.equal(p.max_hp, baseHP + bonus[3]);
	calculate();
	assert.equal(p.monster_stats, cached);
	p.items = [];
	p.tracker = false;
	calculate();
	assert.equal(p.max_hp, baseHP);
	p.items.push({ name: "tracker" });
	calculate();
	assert.equal(p.monster_stats, cached);
	assert.equal(p.max_hp, baseHP + bonus[3]);
});

for (const kind of ["solo", "party", "cooperative"]) {
	test(`${kind} kill credit invalidates the real cache and applies a newly earned bonus`, () => {
		const { c, p, calculate } = fixture();
		p.p.stats.monsters.bee = bonus[0] - 1;
		calculate();
		const before = p.monster_stats,
			baseHP = p.max_hp;
		const monster = { type: "bee", target: p.name, xp: 1, mult: 1, points: { Tracker: 100 } };
		if (kind === "party") {
			p.party = "Tracker";
			p.share = 1;
			c.parties.Tracker = [p.name];
		}
		if (kind === "cooperative") monster.cooperative = true;
		c.issue_monster_award(monster);
		calculate();
		assert.notEqual(p.monster_stats, before);
		assert.equal(p.p.stats.monsters.bee, bonus[0]);
		assert.equal(p.max_hp, baseHP + bonus[3]);
		assert.equal(p.monster_stats_dirty, false);
	});
}

test("account maximums and weighted kill counts contribute through the real calculator", () => {
	const { p, calculate } = fixture();
	p.p.stats.monsters.bee = bonus[0] - 2;
	p.p.stats.monsters_diff.bee = 2;
	const crab = G.monsters.crab.achievements.find((row) => row[1] === "stat" && row[2] === "hp");
	p.max_stats.monsters.crab = [crab[0], "Other"];
	calculate();
	assert.equal(p.monster_stats.hp, bonus[3] + crab[3]);
});

test("hardcore reset discards cached bonuses from the previous account statistics", () => {
	const { c, p, calculate } = fixture();
	p.max_stats.monsters.bee = [bonus[0], "Other"];
	calculate();
	assert.equal(p.monster_stats.hp, bonus[3]);
	c.reset_player(p);
	assert.equal(p.monster_stats_dirty, true);
	c.init_player(p);
	calculate();
	assert.equal(p.monster_stats.hp, undefined);
	assert.equal(p.monster_stats_dirty, false);
});
