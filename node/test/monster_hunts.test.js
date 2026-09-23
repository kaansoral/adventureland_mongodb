const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { read, load, socketHandler } = require("./helpers/server_vm");
const rules = require("../logic/monster_hunts");
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness(level = 1, options = {}) {
	const player = {
		name: "Hunter",
		owner: "US_hunter",
		type: "warrior",
		level,
		max_stats: { level },
		map: "main",
		in: "main",
		x: 126,
		y: -413,
		s: {},
		p: {},
		hitchhikers: [],
		...options.player,
	};
	const packets = [],
		rewards = [];
	const socket = { id: "hunter", emit: (event, data) => packets.push({ event, data: plain(data) }) };
	const context = vm.createContext({
		...G,
		G: {
			...G,
			maps: { ...G.maps, main: { ...G.maps.main, ref: { monsterhunter: { map: "main", x: 126, y: -413 } } } },
		},
		players: { hunter: player, ...options.players },
		instances: {},
		server: { s: options.markers || {} },
		B: { sell_dist: 400 },
		region: "EU",
		server_name: "1",
		gameplay: options.gameplay || "normal",
		mode: {},
		socket,
		current_socket: socket,
		ls_method: "monsterhunt",
		monster_hunt_rules: rules,
		encouragement_groups: new Map([["owner:US_hunter", { characters: options.characters || [] }]]),
		encouragement_identity: (p) => ({ key: "owner:" + p.owner }),
		simple_distance: () => options.distance || 0,
		resend: () => socket.emit("player", { s: plain(player.s), hitchhikers: player.hitchhikers.splice(0) }),
		add_item: (p, name, data) => rewards.push({ name, q: data.q }),
		future_s: () => new Date(),
		calculate_monster_stats() {},
		xy_emit() {},
	});
	load(context, "node/server_functions.js", ["success_response", "fail_response", "get_monsters"]);
	load(context, "node/server.js", ["level_monster", "monster_hunt_logic"]);
	function spawn(type, level = 1, extra = {}) {
		const [map] = Object.entries(G.maps).find(
			([, m]) => !m.irregular && (m.monsters || []).some((s) => s.type === type && s.count > 0),
		);
		const def = G.monsters[type];
		const monster = { type, level: 1, hp: def.hp, max_hp: def.hp, xp: def.xp, luckx: 0, cid: 0, ...extra };
		while (monster.level < level) context.level_monster(monster, { silent: true });
		context.instances[map] ||= { name: map, monsters: {} };
		context.instances[map].monsters[type] = monster;
		return monster;
	}
	const run = socketHandler(context, "monsterhunt");
	return { context, player, packets, rewards, socket, spawn, run };
}

test("login records the highest level among the already-loaded account characters", () => {
	const source = read("node/server.js");
	const start = source.indexOf("var stats = { monsters: {}, level:");
	assert(start > 0);
	const c = vm.createContext({
		max: Math.max,
		entity: { level: 1 },
		characters: [{ level: 1 }, { level: 88, type: "merchant", online: false }, { level: 40 }],
	});
	vm.runInContext(source.slice(start, source.indexOf('check_character_login(attempt, "user data")', start)), c);
	assert.equal(c.stats.level, 88);
});

test("every account below 30 gets ten Goo, even when Goo are busy or reserved", () => {
	for (const level of [1, 15, 29]) {
		const marker = { name: "Veteran", type: "monsterhunt", id: "goo", ms: 900000 };
		const h = harness(level, { markers: { monsterhunt_goo: marker } });
		h.spawn("goo", 1, { target: "Other" });
		h.spawn("wolf", 12);
		h.run({ level: 100 });
		assert.deepEqual(plain(h.player.s.monsterhunt), { sn: "EU 1", id: "goo", c: 10, ms: 1800000, dl: true });
		assert.equal(h.context.server.s.monsterhunt_goo, marker);
		for (let i = 0; i < 10; i++) h.context.monster_hunt_logic(h.player, { type: "goo", level: 1 });
		h.run();
		assert.deepEqual(h.rewards, [{ name: "monstertoken", q: 1 }]);
		assert.equal(h.context.server.s.monsterhunt_goo, marker);
	}
});

test("account levels use offline siblings, live siblings and refreshed snapshots, including merchants", () => {
	for (const options of [
		{ player: { max_stats: { level: 80 } } },
		{ players: { sibling: { owner: "US_hunter", level: 60, type: "merchant" } } },
		{ characters: [{ owner: "US_hunter", level: 70, online: false, type: "merchant" }] },
	]) {
		const h = harness(1, options);
		h.spawn("wolf", 1);
		h.run();
		assert.equal(h.player.s.monsterhunt.id, "wolf");
		assert.equal(h.player.s.monsterhunt.c, 14);
		assert.equal(h.context.server.s.monsterhunt_wolf.name, "Hunter");
	}
	const h = harness(1, {
		players: { unrelated: { owner: "US_other", level: 100 } },
		characters: [{ owner: "US_linked_other_account", level: 100 }],
	});
	h.spawn("wolf", 12);
	h.run();
	assert.equal(h.player.s.monsterhunt.id, "goo");
	assert.equal(h.player.s.monsterhunt.c, 10);
});

test("level-ups end the starter bracket and introductory targets expand before 60", () => {
	for (const [level, target] of [
		[29, "goo"],
		[30, "bee"],
		[40, "armadillo"],
		[50, "tortoise"],
		[59, "bat"],
		[60, "wolf"],
	]) {
		const h = harness(level, { player: { max_stats: { level: 1 } } });
		["goo", "bee", "armadillo", "tortoise", "bat", "wolf"].forEach((type, i) => h.spawn(type, i + 1));
		h.run();
		assert.equal(h.player.s.monsterhunt.id, target, "account level " + level);
		assert(Number.isInteger(h.player.s.monsterhunt.c));
	}
});

test("introductory kill caps rise to normal at 60 without increasing naturally short hunts", () => {
	for (const [level, count] of [
		[29, 10],
		[30, 10],
		[40, 173],
		[50, 336],
		[59, 483],
		[60, 500],
		[80, 500],
	]) {
		const h = harness(level);
		h.spawn("goo");
		h.run();
		assert.equal(h.player.s.monsterhunt.c, count, "account level " + level);
	}
	const h = harness(55);
	h.spawn("squigtoad");
	h.run();
	assert(h.player.s.monsterhunt.c < 10);
});

test("normal hunts still pick the highest idle level and skip occupied, hunted and irregular targets", () => {
	const h = harness(60, { markers: { monsterhunt_bat: { name: "Other", type: "monsterhunt", id: "bat" } } });
	h.spawn("goo");
	h.spawn("wolf", 5);
	h.spawn("croc", 10, { target: "Fighter" });
	h.spawn("bat", 12);
	h.context.instances.private = { name: "main", monsters: { boss: { type: "wolf", level: 100 } } };
	h.run();
	assert.equal(h.player.s.monsterhunt.id, "wolf");
	assert.equal(h.player.s.monsterhunt.c, 4);
});

test("an empty eligible pool has a finite Goo fallback and beginner hunts do not reserve targets", () => {
	for (const level of [1, 40, 60]) {
		const h = harness(level);
		h.run();
		assert.equal(h.player.s.monsterhunt.id, "goo");
		assert(Number.isInteger(h.player.s.monsterhunt.c));
		assert(h.player.s.monsterhunt.c > 0);
		assert.equal(!!h.context.server.s.monsterhunt_goo, level >= 60);
	}
});

test("distance, merchant exclusion, active-hunt refusal and Hardcore rewards remain in force", () => {
	for (const [options, response] of [
		[{ distance: 401 }, "distance"],
		[{ player: { type: "merchant" } }, "monsterhunt_merchant"],
	]) {
		const h = harness(1, options);
		h.run();
		assert.equal(h.player.s.monsterhunt, undefined);
		assert(h.packets.some((p) => p.data === response || p.data.response === response));
	}
	const h = harness(1, { gameplay: "hardcore" });
	h.run();
	assert.equal(h.player.s.monsterhunt.c, 1);
	h.run();
	assert.equal(h.packets.at(-1).data.response, "monsterhunt_already");
	h.context.monster_hunt_logic(h.player, { type: "goo", level: 1 });
	h.run();
	assert.deepEqual(h.rewards, [{ name: "monstertoken", q: 100 }]);
});

module.exports = { harness };
