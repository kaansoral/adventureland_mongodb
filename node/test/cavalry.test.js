const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read, socketHandler } = require("./helpers/server_vm");

function fixture(storage = { marks: new Map(), levels: new Map() }) {
	let now = 100000;
	class Clock extends Date {
		constructor(value) {
			super(value === undefined ? now : value);
		}
		static now() {
			return now;
		}
	}
	const packets = [],
		drops = [];
	const c = vm.createContext({
		G,
		Date: Clock,
		Math,
		Map,
		Set,
		console,
		Place: "server",
		Dev: true,
		is_pvp: false,
		players: {},
		name_to_id: {},
		npcs: {},
		instances: {},
		projectiles: {},
		mode: {},
		total_moves: 1,
		db: {
			collection(name) {
				if (name === "character")
					return {
						find(query) {
							return {
								sort() {
									return this;
								},
								limit() {
									return this;
								},
								maxTimeMS() {
									return this;
								},
								async next() {
									return { level: storage.levels.get(query.owner) || 0 };
								},
							};
						},
					};
				assert.equal(name, "mark");
				return {
					async findOne(query) {
						return structuredClone(storage.marks.get(query._id) || null);
					},
					async updateOne(query, update, options) {
						const saved = storage.marks.get(query._id);
						const matches =
							saved &&
							(query.next_call === undefined || saved.next_call <= query.next_call.$lte) &&
							(query.token === undefined || saved.token === query.token);
						if (!matches && !options.upsert) return { matchedCount: 0 };
						if (!matches && saved) throw Object.assign(Error("duplicate account"), { code: 11000 });
						const next = { ...saved, ...update.$set };
						for (const [key, value] of Object.entries(update.$max || {}))
							next[key] = Math.max(saved?.[key] || 0, value);
						storage.marks.set(query._id, next);
						return { matchedCount: matches ? 1 : 0 };
					},
				};
			},
		},
		gameplay: "normal",
		B: { heal_multiplier: 1, dps_heal_mult: 0.5, dps_tank_mult: 0.5 },
		stats: { kills: { goo: 0 } },
		false_socket: { emit() {} },
		item_p_ignore: {},
		item_trade_p_ignore: {},
		xy_emit: (entity, event, data) =>
			packets.push({ entity: entity.id, event, data: JSON.parse(JSON.stringify(data)) }),
		resend() {},
		server_log() {},
		resume_instance: (instance) => {
			instance.paused = false;
		},
		clear_paladin_aura_source() {},
		safe_xy_nearby: (map, x, y) => ({ x: Math.round(x), y: Math.round(y) }),
		cave_hostile: () => true,
		cave_accept_attack: () => true,
		cave_damage: (a, t, i, n) => n,
		cave_death: () => false,
		step_out_of_invis() {},
		ccms() {},
		calculate_monster_stats() {},
		increase_targets() {},
		disappearing_text() {},
		calculate_player_stats() {},
		achievement_logic_monster_damage() {},
		achievement_logic_monster_last_hit() {},
		encouragement_points() {},
		encouragement_heal() {},
		has_home_server_bonus: () => false,
		encouragement_xp: (p, m, n) => n,
		drop_something: (p, m) => drops.push({ player: p, monster: m }),
		remove_monster: (m) => {
			m.dead = true;
			delete c.instances[m.in].monsters[m.id];
		},
		log_trace: (label, error) => {
			throw error;
		},
		get_ip_server: (p) => p.owner,
	});
	vm.runInContext(read("common/js/common_functions.js"), c);
	vm.runInContext(read("js/old_common_functions.js"), c);
	c.G = G;
	c.G.geometry = { main: { x_lines: [], y_lines: [] } };
	c.clone = G.clone;
	load(c, "node/server_functions.js", ["set_direction"]);
	load(c, "node/server_functions.js", [
		"weapon_stat_attack",
		"transport_npc_to",
		"create_npc",
		"cache_item",
		"get_player",
		"is_same",
		"is_invinc",
		"is_invis",
		"is_in_pvp",
		"pmap_add",
		"pmap_remove",
		"add_condition",
		"ghash",
	]);
	load(c, "node/server.js", [
		"commence_attack",
		"complete_attack",
		"projectiles_loop",
		"skill_offhand_matches",
		"add_pdps",
		"add_coop_points",
		"target_player",
		"kill_monster",
		"issue_monster_award",
		"issue_monster_awards",
		"calculate_monster_score",
		"monster_hunt_logic",
		"redirect_guardians_oath_damage",
		"citizen_move_to",
		"start_moving_element",
		"player_to_client",
	]);
	vm.runInContext(read("node/logic/cavalry.js"), c);
	vm.runInContext(read("node/logic/instance_pause.js"), c);
	for (const name of ["main", "winterland", "desertland", "halloween", "woffice"])
		c.instances[name] = { name, map: name, players: {}, monsters: {}, pmap: {}, npcs: 0 };
	for (const entry of G.maps.woffice.npcs.filter((x) => G.npcs[x.id].cavalry)) {
		const npc = c.create_npc(G.npcs[entry.id], entry, c.instances.woffice);
		c.npcs[entry.id] = npc;
		c.instances.woffice.players[npc.id] = npc;
		c.instances.woffice.npcs++;
	}
	function player(id, map = "main", level = 60, x = 0) {
		const p = {
			id,
			name: id,
			real_id: id,
			owner: id,
			map,
			in: map,
			x,
			y: 0,
			level,
			type: "warrior",
			is_player: true,
			hp: 10000,
			max_hp: 10000,
			mp: 1000,
			max_mp: 1000,
			attack: 100,
			mp_cost: 1,
			xpm: 1,
			xp: 0,
			pdps: 0,
			cid: 0,
			hitchhikers: [],
			items: [{ name: "tracker" }],
			slots: {},
			a: {},
			s: {},
			c: {},
			q: {},
			p: { stats: { monsters: {}, monsters_diff: {} } },
			last: {},
			base: { h: 8, v: 7, vn: 2 },
			m: 0,
			socket: { id: "socket:" + id, emit: (event, data) => packets.push({ entity: id, event, data }) },
		};
		c.players[p.socket.id] = p;
		c.name_to_id[id] = p.socket.id;
		c.instances[map].players[id] = p;
		return p;
	}
	function monster(id, map = "main", x = 40, level = 3) {
		const m = Object.assign({}, G.monsters.goo, {
			id,
			type: "goo",
			map,
			in: map,
			x,
			y: 0,
			level,
			is_monster: true,
			hp: 1000000,
			max_hp: 1000000,
			xp: 1000,
			mult: 1,
			mp: 0,
			s: {},
			a: {},
			last: {},
			points: {},
			hits: 0,
			m: 0,
			cid: 0,
		});
		c.instances[map].monsters[id] = m;
		return m;
	}
	function call(p) {
		return c.cavalry_interaction(p, { type: "cavalry", request_id: p.id }, p.socket);
	}
	function advance(ms) {
		now += ms;
		for (const npc of Object.values(c.npcs))
			if (npc.moving) {
				const distance = Math.hypot(npc.going_x - npc.x, npc.going_y - npc.y);
				const fraction = Math.min(1, (npc.speed * ms) / 1000 / distance);
				npc.x += (npc.going_x - npc.x) * fraction;
				npc.y += (npc.going_y - npc.y) * fraction;
				if (fraction === 1) npc.moving = false;
			}
		c.cavalry_tick();
		for (const p of Object.values(c.projectiles)) p.eta = new Clock(now);
		c.projectiles_loop();
	}
	return { c, packets, drops, player, monster, call, advance, storage, now: () => now };
}

test("four sentries split 4, 2+2, 2+1+1, 1+1+1+1 and prioritize lower levels", async () => {
	const { c, player, monster, call } = fixture();
	const maps = ["main", "winterland", "desertland", "halloween"];
	const callers = maps.map((map, i) => {
		monster("m" + i, map);
		return player("p" + i, map, 60 + i);
	});
	const sizes = () =>
		callers
			.map((p) => Object.values(c.npcs).filter((n) => n.cavalry_call?.player === p).length)
			.filter(Boolean)
			.sort((a, b) => b - a);
	for (const [i, expected] of [
		[0, [4]],
		[1, [2, 2]],
		[2, [2, 1, 1]],
		[3, [1, 1, 1, 1]],
	]) {
		await call(callers[i]);
		assert.deepEqual(sizes(), expected);
	}
	const novice = player("novice", "main", 10, 1000);
	monster("novice_monster", "main", 1040);
	await call(novice);
	assert.equal(Object.values(c.npcs).filter((n) => n.cavalry_call?.player === novice).length, 1);
	assert.equal(Object.values(c.npcs).filter((n) => n.cavalry_call?.player === callers[3]).length, 0);
	assert.equal(
		Object.values(c.instances).reduce((total, i) => total + i.npcs, 0),
		4,
	);
});

test("nearby callers share sentries; clear fights, disconnects and travel recall them", async () => {
	const { c, player, monster, call, advance, storage } = fixture(),
		a = player("A"),
		b = player("B", "main", 30, 30),
		m = monster("m");
	await call(a);
	const arrivals = Object.values(c.npcs).map((npc) => npc.motion.id);
	await call(b);
	assert.deepEqual(
		Object.values(c.npcs).map((npc) => npc.motion.id),
		arrivals,
	);
	assert.equal(Object.values(c.npcs).filter((n) => n.cavalry_call).length, 4);
	m.level = 2;
	advance(250);
	assert.ok(Object.values(c.npcs).every((n) => n.in === "woffice" && !n.cavalry_call));
	m.level = 3;
	storage.marks.get("MK_cavalry-A").next_call = 0;
	await call(a);
	a.dc = true;
	advance(250);
	assert.ok(Object.values(c.npcs).every((n) => n.in === "woffice"));
	a.dc = false;
	storage.marks.get("MK_cavalry-A").next_call = 0;
	await call(a);
	a.in = "winterland";
	advance(250);
	assert.ok(Object.values(c.npcs).every((n) => n.in === "woffice"));
});

test("sentries return home if their battle instance is destroyed", async () => {
	const { c, player, monster, call, advance } = fixture(),
		p = player("A");
	monster("m");
	await call(p);
	delete c.instances.main;
	advance(250);
	assert.ok(Object.values(c.npcs).every((n) => n.in === "woffice" && !n.cavalry_call));
	assert.equal(c.instances.woffice.npcs, 4);
	for (const npc of Object.values(c.npcs)) assert.equal(c.instances.woffice.pmap[npc.last_hash][npc.id], npc);
});

test("the real interaction socket validates Tracktrix, life, monsters and cooldown", async () => {
	const { c, player, monster, advance } = fixture(),
		p = player("A");
	assert.notEqual(p.id, p.socket.id);
	assert.equal(c.players[p.id], undefined);
	c.socket = p.socket;
	const handler = socketHandler(c, "interaction");
	const responses = [];
	p.socket.emit = (event, data) => responses.push(data);
	await handler({ type: "cavalry", request_id: "one" });
	assert.equal(responses.at(-1).reason, "no_monsters");
	monster("m");
	p.items = [];
	await handler({ type: "cavalry" });
	assert.equal(responses.at(-1).reason, "tracker");
	p.items = [{ name: "tracker" }];
	await handler({ type: "cavalry", request_id: "ok" });
	assert.equal(responses.at(-1).assigned, 4);
	assert.equal(responses.at(-1).request_id, "ok");
	const next_call = responses.at(-1).next_call;
	await handler({ type: "cavalry" });
	assert.equal(responses.at(-1).next_call, next_call);
	advance(10001);
	await handler({ type: "cavalry" });
	assert.equal(responses.at(-1).success, true);
	advance(90000);
	await handler({ type: "cavalry" });
	assert.equal(responses.at(-1).reason, "cooldown");
	p.rip = true;
	await handler({ type: "cavalry" });
	assert.equal(responses.at(-1).reason, "unavailable");
});

test("stale character sessions cannot keep a Cavalry call active", async () => {
	const { c, player, monster, call, advance } = fixture(),
		p = player("A");
	monster("m");
	assert.equal((await call(p)).success, true);
	player("A");
	assert.equal((await call(p)).reason, "unavailable");
	advance(250);
	assert.ok(Object.values(c.npcs).every((npc) => !npc.cavalry_call));
});

test("loaded equipment produces large, varied real combat hits, three mage shots and no monster target", async () => {
	const { c, player, monster, call, advance, packets } = fixture(),
		p = player("A"),
		m = monster("m");
	await call(p);
	advance(1200);
	advance(1000);
	advance(1000);
	const mage = c.npcs.cavalry_mage;
	assert.equal(mage.slots.mainhand.level, 10);
	assert.ok(mage.int > 2000);
	assert.equal(m.target, undefined);
	assert.ok(c.npcs.cavalry_warrior.s.charging);
	assert.ok(Object.values(c.npcs).every((n) => Number.isInteger(n.max_hp) && Number.isInteger(n.max_mp)));
	const mageActions = packets.filter((x) => x.event === "action" && x.data.attacker === mage.id);
	assert.ok(mageActions.length >= 3);
	assert.equal(new Set(mageActions.slice(0, 3).map((x) => x.data.pid)).size, 3);
	assert.deepEqual(
		mageActions.slice(0, 3).map((x) => x.data.origin_offset || 0),
		[-16, 0, 16],
	);
	const hits = packets.filter((x) => x.event === "hit" && x.data.damage > 0).map((x) => x.data.damage);
	assert.ok(hits.length >= 4);
	assert.ok(hits.every((x) => Number.isFinite(x) && x > 10000));
	assert.ok(new Set(hits).size > 1);
	assert.ok(m.hp < 1000000);
});

test("priest heals wounded players and paladin applies the existing beacon", async () => {
	const { c, player, monster, call, advance } = fixture(),
		p = player("A"),
		wounded = player("Wounded");
	monster("m");
	wounded.hp = 100;
	await call(p);
	advance(1200);
	advance(400);
	assert.ok(wounded.hp > 100);
	assert.ok(wounded.s.beacon_of_resolve);
	assert.equal(p.hp, p.max_hp);
});

test("normal kill rewards stay with the existing player; cooperative credit belongs to players", async () => {
	const { c, player, monster, call, drops } = fixture(),
		p = player("A"),
		m = monster("m"),
		other = player("Other");
	await call(p);
	m.target = other.name;
	c.kill_monster(c.npcs.cavalry_warrior, m);
	assert.equal(drops[0].player, other);
	assert.equal(other.xp, 1000);
	assert.equal(p.xp, 0);
	const coop = monster("coop");
	coop.cooperative = true;
	coop.target = p.name;
	c.add_coop_points(coop, c.npcs.cavalry_mage, 20000);
	assert.equal(coop.points.A, 20000);
	assert.ok(!Object.keys(coop.points).some((key) => key.startsWith("Cavalry")));
	c.kill_monster(c.npcs.cavalry_mage, coop);
	assert.ok(p.xp > 990);
	assert.equal(drops[1].player, p);
});

test("on-hit loot and healing contribution stay with participating players", async () => {
	const { c, player, monster, call, advance, drops } = fixture(),
		p = player("A"),
		m = monster("m");
	m.drop_on_hit = true;
	p.hp = 100;
	await call(p);
	const healers = [];
	c.encouragement_heal = (healer) => healers.push(healer);
	advance(1200);
	advance(400);
	assert.ok(drops.length > 0);
	assert.ok(drops.every((drop) => drop.player === p));
	assert.ok(healers.length > 0);
	assert.ok(healers.every((healer) => healer === p));
});

test("reassigned shots cannot damage an old fight or a sentry", async () => {
	const { c, player, monster, call } = fixture(),
		p = player("A"),
		m = monster("m");
	await call(p);
	const mage = c.npcs.cavalry_mage,
		shot = c.commence_attack(mage, m, "attack"),
		info = c.projectiles[shot.pid];
	assert.ok(info);
	mage.cavalry_call = null;
	c.complete_attack(mage, m, info);
	assert.equal(m.hp, m.max_hp);
	c.complete_attack(m, mage, { attack: 1000000 });
	assert.equal(mage.hp, mage.max_hp);
	c.target_player(m, mage);
	assert.equal(m.target, undefined);
});

test("newcomers get 90 seconds and a fixed group, with no fresh-spawn farming or call extension", async () => {
	const { c, player, monster, call, advance, now } = fixture(),
		p = player("New", "main", 20);
	const initial = Array.from({ length: 30 }, (_, i) => monster("m" + i, "main", 20 + i));
	await call(p);
	const rescue = c.cavalry_calls.get(p.id),
		expires = rescue.expires;
	assert.equal(expires - now(), 90000);
	assert.equal(rescue.targets.length, 24);
	const fresh = monster("new_spawn");
	assert.ok(!c.cavalry_monsters(rescue).includes(fresh));
	advance(16000);
	await call(p);
	assert.equal(rescue.expires, expires);
	assert.ok(Object.values(c.npcs).every((npc) => npc.cavalry_call));
	// Reusing a monster ID does not replace the captured entity.
	monster(initial[0].id);
	assert.ok(!c.cavalry_monsters(rescue).includes(initial[0]));
	advance(74000);
	assert.ok(Object.values(c.npcs).every((npc) => !npc.cavalry_call));
	assert.equal(fresh.hp, fresh.max_hp);
});

test("a low-level caller sees the account level that restricts their rescue", async () => {
	const { c, player, monster, call, advance, now, storage } = fixture(),
		p = player("Alt", "main", 20);
	storage.levels.set(p.owner, 100);
	const threats = Array.from({ length: 5 }, (_, i) => monster("m" + i, "main", 100 + i));
	const refusal = await call(p);
	assert.equal(refusal.reason, "no_monsters");
	assert.equal(refusal.phrase, "interface.cavalry.not_threatened");
	assert.equal(refusal.phrase_args.level, "100");
	assert.equal(
		refusal.message,
		"Your account's highest level is 100. Cavalry only fights monsters already attacking you or your party.",
	);
	assert.equal(storage.marks.size, 0);
	for (const m of threats) m.target = p.name;
	const result = await call(p),
		rescue = c.cavalry_calls.get(p.id);
	assert.equal(rescue.newcomer, false);
	assert.equal(rescue.targets.length, 3);
	assert.equal(rescue.expires - now(), 15000);
	assert.equal(result.cooldown_ms, 110 * 60000);
	advance(15001);
	assert.ok(Object.values(c.npcs).every((npc) => !npc.cavalry_call));
});

test("a level-20 newcomer can clear level-9 Boo Boos from ordinary spawn growth", async () => {
	const { c, player, call, advance, now } = fixture(),
		map = "spookytown";
	c.instances[map] = { name: map, map, players: {}, monsters: {}, pmap: {}, npcs: 0 };
	const p = player("Wizard", map, 20);
	Object.assign(c, { total_monsters: 100, monster_c: {}, server: { live: true }, really_old: new c.Date(0) });
	load(c, "node/server.js", ["new_monster", "level_monster"]);
	const pack = structuredClone(G.maps[map].monsters.find((spawn) => spawn.type === "booboo" && spawn.grow));
	c.new_monster(map, pack);
	const grown = Object.values(c.instances[map].monsters).filter((monster) => monster.temp);
	assert.ok(grown.length > 0);
	for (const monster of grown) {
		while (monster.level < 9) c.level_monster(monster, { silent: true });
		monster.x = p.x + 40;
		monster.y = p.y;
	}
	const result = await call(p);
	assert.equal(result.success, true, JSON.stringify(result));
	const rescue = c.cavalry_calls.get(p.id);
	assert.equal(rescue.targets.length, grown.length);
	assert.equal(rescue.newcomer, true);
	assert.equal(rescue.expires - now(), 90000);
	assert.equal(result.cooldown_ms, 30 * 60000);
	advance(1200);
	assert.ok(grown.some((monster) => c.cavalry_assisted.has(monster)));
	assert.ok(grown.some((monster) => c.cavalry_cleared_spawn(monster)));
	const fresh = c.new_monster(map, pack, { temp: 1 });
	fresh.x = p.x + 40;
	fresh.y = p.y;
	while (fresh.level < 9) c.level_monster(fresh, { silent: true });
	assert.ok(!c.cavalry_monsters(rescue).includes(fresh));
});

test("all players within exactly 150px guard a spawn, including outsiders arriving during a projectile", async () => {
	const { c, player, monster, call, advance, storage } = fixture();
	const p = player("New", "main", 20),
		m = monster("m", "main", 100),
		veteran = player("Visitor", "main", 80, 250);
	assert.equal(veteran.party, undefined);
	assert.equal((await call(p)).reason, "guarded");
	assert.equal(storage.marks.size, 0);
	veteran.x = 250.01;
	assert.equal((await call(p)).success, true);
	advance(1200);
	const mage = c.npcs.cavalry_mage;
	const shot = c.commence_attack(mage, m, "attack"),
		info = c.projectiles[shot.pid];
	assert.ok(info);
	const hp = m.hp;
	veteran.x = 250;
	c.complete_attack(mage, m, info);
	assert.equal(m.hp, hp);
	assert.equal(c.commence_attack(mage, m, "attack").failed, true);
	veteran.in = "winterland";
	assert.equal(c.cavalry_guarded(m), false);
});

test("a veteran standing beside an idle leveled bee gets the nearby-player refusal", async () => {
	const { player, monster, call, storage } = fixture(),
		p = player("Wizard", "main", 100);
	const bee = monster("bee", "main", 100, 11);
	bee.type = "bee";
	assert.equal((await call(p)).reason, "guarded");
	assert.equal(storage.marks.size, 0);
	bee.x = 200;
	assert.equal((await call(p)).phrase, "interface.cavalry.not_threatened");
});

test("cooldowns use account and nearby levels and survive reconnects, realm changes and concurrent requests", async () => {
	const storage = { marks: new Map(), levels: new Map([["shared", 85]]) };
	const a = fixture(storage),
		b = fixture(storage);
	const first = a.player("First", "main", 20),
		second = b.player("Second", "main", 10);
	first.owner = second.owner = "shared";
	a.monster("a").target = first.name;
	b.monster("b").target = second.name;
	const results = await Promise.all([a.call(first), b.call(second)]);
	assert.equal(results.filter((result) => result.success).length, 1);
	assert.equal(results.filter((result) => result.reason === "cooldown").length, 1);
	assert.equal(results[0].next_call, results[1].next_call);
	assert.equal(results[0].cooldown_ms, 95 * 60000);
	const reconnect = fixture(storage),
		alt = reconnect.player("Again", "main", 1);
	alt.owner = "shared";
	assert.equal((await reconnect.call(alt)).reason, "cooldown");
	const f = fixture(),
		novice = f.player("New", "main", 10);
	f.player("Nearby", "main", 70, 100);
	f.monster("m");
	assert.equal((await f.call(novice)).cooldown_ms, 80 * 60000);
});

test("expired unanswered calls refund only their account reservation", async () => {
	const { c, player, monster, call, advance, storage } = fixture();
	for (const [i, map] of ["main", "winterland", "desertland", "halloween"].entries()) {
		const p = player("p" + i, map, 10);
		monster("m" + i, map);
		await call(p);
	}
	const waiting = player("Waiting", "main", 70, 1000);
	monster("waiting", "main", 1040);
	assert.equal((await call(waiting)).queued, true);
	const old = c.cavalry_calls.get(waiting.id);
	advance(90001);
	await new Promise(setImmediate);
	assert.equal(storage.marks.get("MK_cavalry-Waiting").next_call, 0);
	storage.marks.set(old.reservation, { token: "newer-rescue", next_call: 999999 });
	await c.cavalry_release(old);
	assert.equal(storage.marks.get(old.reservation).next_call, 999999);
});

test("calls fail closed on storage errors and recheck travel while the account lookup is pending", async () => {
	const { c, player, monster, call, storage } = fixture(),
		p = player("New");
	monster("m");
	const database = c.db;
	c.log_trace = () => {};
	c.db = {
		collection() {
			throw Error("unavailable database");
		},
	};
	assert.equal((await call(p)).reason, "unavailable");
	assert.equal(c.cavalry_calls.size, 0);
	c.db = database;
	const collection = database.collection;
	c.db.collection = (name) => {
		const result = collection(name);
		if (name === "character")
			result.find = () => ({
				sort() {
					return this;
				},
				limit() {
					return this;
				},
				maxTimeMS() {
					return this;
				},
				async next() {
					p.map = p.in = "winterland";
					return { level: 20 };
				},
			});
		return result;
	};
	assert.equal((await call(p)).reason, "location");
	assert.equal(storage.marks.size, 0);
	assert.ok(Object.values(c.npcs).every((npc) => npc.in === "woffice"));
});

test("bosses, rare monsters and scripted spawns cannot become rescue targets", async () => {
	const { c, player, monster, call, storage } = fixture(),
		p = player("New");
	for (const type of ["franky", "phoenix", "stompy", "jr"]) {
		assert.ok(G.monsters[type]);
		const m = monster(type);
		m.type = type;
	}
	monster("special").map_def = { special: true };
	monster("scripted").spawn = true;
	monster("temporary").temp = true;
	assert.equal((await call(p)).reason, "no_monsters");
	assert.equal(storage.marks.size, 0);
	assert.equal(c.cavalry_calls.size, 0);
});

test("the Mage walks while blink is cooling down and blinks only occasionally", async () => {
	const { c, player, monster, call, advance, now, packets } = fixture(),
		p = player("New");
	monster("m", "main", 280);
	await call(p);
	const mage = c.npcs.cavalry_mage,
		arrival = mage.position_id;
	advance(1200);
	assert.equal(mage.moving, true);
	assert.equal(mage.position_id, arrival);
	advance(500);
	assert.equal(mage.position_id, arrival);
	advance(12000);
	assert.equal(mage.position_id, arrival + 1);
	assert.equal(mage.motion.kind, "blink");
	assert.ok(mage.cavalry_next_blink - now() >= 8000);
	assert.ok(mage.cavalry_next_blink - now() <= 12000);
	advance(2000);
	assert.equal(mage.position_id, arrival + 1);
	const safe = c.safe_xy_nearby;
	c.safe_xy_nearby = () => null;
	mage.cavalry_next_blink = now();
	c.cavalry_fight(mage, now());
	assert.ok(mage.cavalry_next_blink > now());
	c.safe_xy_nearby = safe;
	const shots = () => packets.filter((packet) => packet.event === "action" && packet.data.attacker === mage.id).length;
	const before = shots();
	advance(451);
	assert.ok(shots() > before);
});

test("melee walks through the native movement path and relocations reach the client before their animation", async () => {
	const { c, player, monster, call, advance } = fixture(),
		p = player("New"),
		m = monster("m", "main", 200);
	await call(p);
	const warrior = c.npcs.cavalry_warrior,
		origin = { x: warrior.x, y: warrior.y },
		arrival = warrior.motion.id;
	advance(1000);
	assert.equal(warrior.x, origin.x);
	assert.equal(warrior.y, origin.y);
	assert.equal(warrior.moving, true);
	assert.ok(warrior.move_num > 0);
	assert.ok(!warrior.motion || warrior.motion.id === arrival);
	assert.equal(c.commence_attack(warrior, m, "attack").failed, true);
	const client = vm.createContext({
		G,
		console,
		Place: "game",
		no_graphics: true,
		current_map: "main",
		current_in: "main",
		attire_slots: [],
		log_flags: {},
		set_direction() {},
	});
	vm.runInContext(read("js/old_common_functions.js"), client);
	client.G = G;
	const source = read("js/game.js"),
		start = source.indexOf("var asp_skip = {}");
	vm.runInContext(source.slice(start, source.indexOf("function adopt_soft_properties", start)), client);
	load(client, "js/game.js", ["sync_entity", "adopt_soft_properties"]);
	const sprite = {
		type: "character",
		real_x: origin.x,
		real_y: origin.y,
		move_num: 0,
		engaged_move: 0,
		position_id: warrior.position_id,
	};
	client.sync_entity(sprite, c.player_to_client(warrior, true));
	assert.equal(sprite.moving, true);
	assert.equal(sprite.going_x, warrior.going_x);
	advance(500);
	assert.ok(warrior.x > origin.x);
	c.transport_npc_to(warrior, "main", { x: 210, y: 40 });
	c.cavalry_motion(warrior, "blink", -50, 0);
	client.sync_entity(sprite, c.player_to_client(warrior, true));
	assert.equal(sprite.real_x, 210);
	assert.equal(sprite.real_y, 40);
	assert.equal(sprite.moving, false);
	assert.equal(sprite.vx, 0);
	client.sync_entity(sprite, c.player_to_client(warrior, true));
	assert.equal(sprite.resync, false);
	const movement = warrior.position_id;
	advance(1000);
	assert.equal(warrior.position_id, movement);
	const originalCanMove = c.can_move;
	c.can_move = () => false;
	assert.equal(c.commence_attack(warrior, m, "attack").failed, true);
	c.can_move = originalCanMove;
});

test("newcomer-assisted kills keep normal rewards and respawn at level 1 through the real spawn handler", async () => {
	const { c, player, monster, call, advance, drops } = fixture(),
		p = player("New", "main", 20),
		m = monster("m", "main", 40, 8);
	await call(p);
	advance(1200);
	assert.equal(c.cavalry_assisted.get(m).newcomer, true);
	const originalLevel = m.level,
		originalXp = m.xp;
	c.kill_monster(p, m);
	assert.equal(drops[0].player, p);
	assert.equal(p.xp, originalXp);
	assert.equal(m.level, originalLevel);
	assert.equal(m.cavalry_cleared, true);
	Object.assign(c, { total_monsters: 100, monster_c: { goo: 0 }, server: { live: false }, really_old: new c.Date(0) });
	load(c, "node/server.js", ["new_monster", "level_monster"]);
	const spawn = { type: "goo", position: [40, 0], radius: 0, gold: 20 };
	const cleared = c.new_monster("main", spawn, { before_respawn: m });
	assert.equal(cleared.level, 1);
	const ordinary = c.new_monster("main", spawn, { before_respawn: { ...m, cavalry_cleared: false } });
	assert.equal(ordinary.level, 4);
	const guarded = monster("guarded", "main", 50, 8);
	c.cavalry_assisted.set(guarded, c.cavalry_assisted.get(m));
	player("Veteran", "main", 80, 100);
	c.kill_monster(p, guarded);
	assert.equal(guarded.cavalry_cleared, undefined);
});

test("new animation and attack entry points are harmless with fake PIXI", () => {
	const c = vm.createContext({
		no_graphics: true,
		PIXI: new Proxy(
			{},
			{
				get() {
					throw Error("PIXI touched");
				},
			},
		),
	});
	vm.runInContext(read("js/entity_animations.js"), c);
	load(c, "js/functions.js", ["attack_animation_logic"]);
	c.play_map_effect("transport", 0, 0);
	c.update_map_effect({});
	c.play_entity_strike({});
	c.update_entity_motion({});
	c.attack_animation_logic({});
});

test("Cavalry action packets reach headless CODE through the native socket handler", () => {
	const events = [],
		handlers = {};
	const c = vm.createContext({
		no_graphics: true,
		new_attacks: true,
		Dev: false,
		console,
		Place: "game",
		socket: { on: (event, fn) => (handlers[event] = fn) },
		call_code_function: (...args) => events.push(args),
	});
	vm.runInContext(read("js/pixi/fake/pixi.min.js"), c);
	const fake = c.PIXI;
	Object.defineProperty(c, "PIXI", {
		get() {
			throw Error("Socket visual touched fake PIXI");
		},
	});
	vm.runInContext(read("js/old_common_functions.js"), c);
	c.G = G;
	load(c, "js/functions.js", [
		"set_direction",
		"attack_animation_logic",
		"animate_weapon",
		"map_animation",
		"continuous_map_animation",
	]);
	vm.runInContext(read("js/entity_animations.js"), c);
	const source = read("js/game.js"),
		start = source.indexOf('\tsocket.on("action",');
	vm.runInContext(source.slice(start, source.indexOf("\n\tsocket.on(", start + 1)), c);
	const attacker = { id: "$Cavalry II", real_x: 0, real_y: 0, map: "main", in: "main", fx: {}, attack_motion: true };
	const target = { id: "monster", x: 40, y: 0, map: "main", in: "main" };
	c.get_entity = (id) => (id === attacker.id ? attacker : target);
	for (const origin_offset of [-16, 0, 16])
		handlers.action({ attacker: attacker.id, target: target.id, projectile: "magic", origin_offset, damage: 21001 });
	assert.equal(events.length, 3);
	assert.ok(events.every((event) => event[0] === "trigger_event" && event[1] === "action"));
	assert.ok(fake.Sprite);
	assert.equal(attacker.entity_strike, undefined);
});
