const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load, socketHandler } = require("./helpers/server_vm");
const G = require("./helpers/design");
const createServerInformation = require("../logic/server_information");
const day = 86400000;
const plain = (value) => JSON.parse(JSON.stringify(value));

// Evaluate only the MongoDB expressions used by the atomic group-date update.
// Each $set stage reads the previous document, just as the database does.
function mongoExpression(value, document) {
	if (typeof value === "string" && value.startsWith("$")) return document[value.slice(1)];
	if (!value || typeof value !== "object") return value;
	const [operator, args] = Object.entries(value)[0];
	const a = args.map((arg) => mongoExpression(arg, document));
	switch (operator) {
		case "$min":
			return Math.min(...a);
		case "$max":
			return Math.max(...a);
		case "$ifNull":
			return a[0] ?? a[1];
		case "$subtract":
			return a[0] - a[1];
		case "$divide":
			return a[0] / a[1];
		case "$add":
			return a[0] + a[1];
		case "$gt":
			return a[0] > a[1];
		case "$cond":
			return a[0] ? a[1] : a[2];
		default:
			throw Error("Unexpected MongoDB expression: " + operator);
	}
}

function harness() {
	let now = Date.UTC(2026, 8, 8),
		roll = 0.5,
		sequence = 0,
		records = [],
		queries = [],
		historyQueries = [],
		writes = 0;
	const histories = new Map();
	const events = [],
		inventory = new Map();
	const c = vm.createContext({
		G,
		console,
		Set,
		Map,
		Number,
		JSON,
		Date: class extends Date {
			constructor(value) {
				super(value === undefined ? now : value);
			}
			static now() {
				return now;
			}
		},
		Math: Object.assign(Object.create(Math), { random: () => roll }),
		min: Math.min,
		max: Math.max,
		floor: Math.floor,
		ceil: Math.ceil,
		round: Math.round,
		mode: {},
		gameplay: "normal",
		region: "EU",
		server_name: "1",
		server_id: "SR_EU1",
		B: { global_drops: true, drop_table_multiplier: 1, dps_tank_mult: 0.25, dps_heal_mult: 1.8, heal_multiplier: 1 },
		D: {
			drops: {
				maps: {},
				monsters: {},
				monsters_home_server: {},
				konami: [],
				gold: { base: 1, random: 0, x10: 0, x50: 0 },
			},
			monster_gold: { goo: 999 },
		},
		players: {},
		name_to_id: {},
		id_to_id: {},
		parties: {},
		chests: {},
		instances: { main: { monsters: {}, players: {}, pmap: {} } },
		server_information: createServerInformation("SR_EU1"),
		anniversary_rules: require("../logic/anniversary_event"),
		anniversary_is_active: () => true,
		db: {
			collection(name) {
				if (name === "mark")
					return {
						find(query, options) {
							const request = { query, options };
							historyQueries.push(request);
							return {
								limit(n) {
									request.limit = n;
									return this;
								},
								maxTimeMS(n) {
									request.timeout = n;
									return this;
								},
								async toArray() {
									return structuredClone(
										query._id.$in
											.map((id) => histories.get(id))
											.filter(Boolean)
											.slice(0, request.limit),
									);
								},
							};
						},
						async findOneAndUpdate(query, update, options) {
							assert.equal(options.upsert, true);
							assert.equal(options.returnDocument, "after");
							assert.equal(options.includeResultMetadata, false);
							assert.equal(options.maxTimeMS, 3000);
							let saved = histories.get(query._id) || {};
							assert.equal(update.length, 2);
							for (const stage of update)
								saved = {
									...saved,
									...Object.fromEntries(
										Object.entries(stage.$set).map(([key, value]) => [key, mongoExpression(value, saved)]),
									),
								};
							histories.set(query._id, saved);
							writes++;
							return { ...saved };
						},
					};
				assert.equal(name, "character");
				return {
					find(query, options) {
						const request = { query, options };
						queries.push(request);
						return {
							limit(n) {
								request.limit = n;
								return this;
							},
							maxTimeMS(n) {
								request.timeout = n;
								return this;
							},
							async toArray() {
								return structuredClone(
									records.filter((r) => Object.entries(query).every(([k, v]) => r[k] === v)).slice(0, request.limit),
								);
							},
						};
					},
				};
			},
		},
		get: async () => ({ _id: "SR_US1", address: "test", key: "US1" }),
		server_eval: async () => true,
		randomStr: () => "chest" + ++sequence,
		is_in_pvp: () => false,
		is_invis: () => false,
		is_same: () => false,
		has_home_server_bonus: (p) => p.p && p.p.home === "EU1",
		is_array: Array.isArray,
		is_string: (v) => typeof v === "string",
		in_arr: (v, a) => a.includes(v),
		simple_distance: () => 0,
		point_distance: () => 0,
		distance: () => 0,
		msince: (date) => (now - +date) / 60000,
		mssince: (date) => now - +date,
		create_new_item: (name, q) => ({ name, ...(q ? { q } : {}) }),
		can_stack: (a, b) => a.name === b.name && !!G.items[a.name].s,
		can_add_items: (p) => !p.full,
		can_add_item: (p) => !p.full,
		add_item(p, item) {
			inventory.get(p.real_id).push(plain(item));
		},
		cache_item: plain,
		add_shells(p, amount) {
			p.cash += amount;
		},
		server_tax: (amount) => amount,
		resend() {},
		calculate_player_stats() {},
		disappearing_text() {},
		item_to_phrase: (i) => i.name,
		to_pretty_num: String,
		party_emit(party, event, data) {
			events.push({ party, event, data: plain(data) });
		},
		broadcast() {},
		xy_emit() {},
		ccms() {},
		achievement_logic_monster_kill() {},
		achievement_logic_monster_damage() {},
		achievement_logic_monster_hit() {},
		achievement_logic_monster_last_hit() {},
		killed_message: () => "killed a monster",
		calculate_monster_score: () => 1,
		monster_hunt_logic() {},
		stats: { kills: { goo: 0 } },
		W: { chest: {} },
		log_trace(name, e) {
			throw e;
		},
		fail_response: (reason) => events.push({ event: "failure", reason }),
		server_log() {},
		lostandfound_logic() {},
		redirect_guardians_oath_damage: (p, attack) => ({ attack }),
		damage_multiplier: G.damage_multiplier,
		remove_monster(m) {
			m.dead = true;
		},
		stop_pursuit() {},
		pwns: [],
		pend: 0,
		is_pvp: false,
		colors: { party_xp: "gray" },
		drop_something_pvp() {},
	});
	vm.runInContext(read("node/logic/encouragement.js"), c);
	load(c, "node/server.js", [
		"roll_monster_drops",
		"drop_item_logic",
		"drop_something",
		"drop_one_thing",
		"add_coop_points",
		"add_pdps",
		"complete_attack",
		"kill_monster",
		"issue_monster_award",
		"issue_monster_awards",
		"issue_player_award",
	]);
	function player(name = "Hero", patch = {}) {
		const p = {
			real_id: "CH_" + name,
			owner: "US_" + name,
			secret: "fixture-session",
			name,
			id: name,
			type: "warrior",
			is_player: true,
			created: now - day,
			level: 20,
			xp: 0,
			max_xp: 10000000,
			gold: 0,
			cash: 0,
			hp: 10000,
			max_hp: 10000,
			mp: 1000,
			max_mp: 1000,
			luckm: 1,
			goldm: 1,
			xpm: 1,
			share: 1,
			map: "main",
			in: "main",
			x: 0,
			y: 0,
			cid: 1,
			pdps: 0,
			hits: 0,
			kills: 0,
			p: { stats: { monsters: {}, monsters_diff: {} } },
			s: {},
			a: {},
			c: {},
			slots: {},
			items: [],
			last: {},
			t: { xp: 0, cgold: 0, dgold: 0, mdamage: 0 },
			...patch,
		};
		p.socket = {
			id: name,
			emit: (event, data) => events.push({ name, event, data: data === undefined ? null : plain(data) }),
		};
		c.players[name] = p;
		c.name_to_id[name] = name;
		c.id_to_id[name] = name;
		inventory.set(p.real_id, []);
		c.instances.main.players[name] = p;
		return p;
	}
	function record(p, patch = {}) {
		return {
			_id: p.real_id,
			owner: p.owner,
			pid: p.pid || "",
			type: p.type,
			created: new Date(p.created),
			last_online: new Date(now),
			last_sync: new Date(now),
			server: "",
			info: { p: {} },
			...patch,
		};
	}
	function eligible(p, age = day, returning = 0) {
		c.encouragement_groups.set(c.encouragement_identity(p).key, {
			until: now + 5 * 60000,
			next: now + 5 * 60000,
			oldest: now - age,
			return_until: returning,
			characters: [record(p)],
			blocked: false,
		});
		c.encouragement_update(p, true);
	}
	function monster(p, patch = {}) {
		const m = {
			id: "m" + ++sequence,
			is_monster: true,
			type: "goo",
			max_hp: 1000,
			hp: 1000,
			xp: 1000,
			level: 1,
			mult: 1,
			luckx: 1,
			in: "main",
			map: "main",
			x: 0,
			y: 0,
			target: p.name,
			points: {},
			s: {},
			a: {},
			last: {},
			hits: 0,
			outgoing: 0,
			...patch,
		};
		c.instances.main.monsters[m.id] = m;
		return m;
	}
	function hit(p, m, damage, patch = {}) {
		c.complete_attack(p, m, {
			atype: "attack",
			attack: damage,
			first_attack: damage,
			damage_type: "pure",
			procs: false,
			conditions: [],
			apiercing: 0,
			rpiercing: 0,
			def: { source: "attack" },
			action: {},
			...patch,
		});
	}
	function open(p, id) {
		c.socket = p.socket;
		socketHandler(c, "open_chest")({ id });
	}
	return {
		c,
		player,
		record,
		eligible,
		monster,
		hit,
		open,
		inventory,
		events,
		queries,
		historyQueries,
		histories,
		setRecords(list) {
			records = list;
		},
		time(value) {
			now = value;
		},
		now: () => now,
		writes: () => writes,
		roll(value) {
			roll = value;
		},
	};
}

test("identity uses PID across owners; oldest character decides eligibility, not the new account", async () => {
	const h = harness(),
		p = h.player("NewAccount", { pid: "steam-shared" });
	h.setRecords([h.record(p), h.record(p, { _id: "CH_old", owner: "US_old", created: new Date(h.now() - 100 * day) })]);
	await h.c.encouragement_load(p, new Date(h.now()));
	h.c.encouragement_update(p, true);
	assert.deepEqual(plain(h.queries[0].query), { pid: "steam-shared" });
	assert.equal(p.s.encouragement_new, undefined);
	assert.equal(p.s.encouragement_lonewolf.gold_multiplier, 3);
	assert.equal(h.queries[0].limit, 25);
	assert.equal(h.queries[0].timeout, 3000);
	assert(!("items" in h.queries[0].options.projection));
});

test("owner fallback, existing newcomers and exact 24/25/26 character cutoff", async () => {
	for (const count of [1, 24, 25, 26]) {
		const h = harness(),
			p = h.player();
		h.setRecords(
			Array.from({ length: count }, (_, i) =>
				h.record(p, { _id: i ? "CH_" + i : p.real_id, type: i ? "merchant" : p.type }),
			),
		);
		await h.c.encouragement_load(p, new Date(h.now()));
		h.c.encouragement_update(p, true);
		assert.deepEqual(plain(h.queries[0].query), { owner: p.owner });
		assert.equal(p.encouragement.blocked, count >= 25);
		assert.equal(!!p.s.encouragement_new, count < 25);
		assert.equal(!!p.s.encouragement_lonewolf, count < 25);
		assert.equal(p.encouragement.characterCount, Math.min(25, count));
	}
});

test("all four phases, exact expiry, level 80 and delevel latch", () => {
	for (const [age, rates] of [
		[0, [15, 15, 15]],
		[10 * day, [6, 12, 12]],
		[20 * day, [6, 6, 9]],
		[30 * day, [4.5, 4.5, 4.5]],
		[40 * day, [3, 3, 3]],
	]) {
		const h = harness(),
			p = h.player();
		h.eligible(p, age);
		assert.deepEqual(Object.values(plain(p.encouragement.totals)), rates);
	}
	const h = harness(),
		p = h.player();
	h.eligible(p);
	p.level = 80;
	h.c.encouragement_update(p, true);
	assert.equal(p.encouragement.totals.xp, 3);
	p.level = 79;
	h.c.encouragement_update(p, true);
	assert.equal(p.encouragement.totals.xp, 3);
});

test("Lone Wolf counts linked non-merchants locally and on other realms, not other people's party members", () => {
	const h = harness(),
		p = h.player("One", { pid: "shared" });
	h.eligible(p);
	const other = h.player("Two", { pid: "shared", type: "merchant" });
	h.c.encouragement_update(p, true);
	assert(p.s.encouragement_lonewolf);
	other.type = "mage";
	h.c.encouragement_update(p, true);
	assert(!p.s.encouragement_lonewolf);
	other.dc = true;
	h.c.encouragement_update(p, true);
	assert(p.s.encouragement_lonewolf);
	h.c.server_information.receive(
		[
			{
				_id: "SR_US1",
				info: {
					recent_characters: {
						[other.real_id]: { owner: other.owner, pid: other.pid, type: other.type, last_online: h.now() },
					},
				},
			},
		],
		h.now(),
	);
	h.c.encouragement_update(p, true);
	assert(!p.s.encouragement_lonewolf);
});

test("return windows use the latest linked activity, strict 60 days, half absence and 90-day cap", async () => {
	for (const [away, duration] of [
		[60, 0],
		[61, 30.5],
		[120, 60],
		[400, 90],
	]) {
		const h = harness(),
			p = h.player("Returning", { created: h.now() - 500 * day });
		h.setRecords([h.record(p, { last_online: new Date(h.now()) })]);
		await h.c.encouragement_load(p, new Date(h.now() - away * day));
		h.c.encouragement_update(p, true);
		assert.equal(p.p.encouragement.return_until, duration ? h.now() + duration * day : 0);
		if (duration) {
			p.level = 80;
			h.c.encouragement_update(p, true);
			assert.equal(p.s.encouragement_returning.xp_multiplier, 2);
		}
	}
	const h = harness(),
		p = h.player("Returning", { pid: "same", created: h.now() - 500 * day });
	h.setRecords([
		h.record(p),
		h.record(p, { _id: "CH_merchant", type: "merchant", last_online: new Date(h.now() - day) }),
	]);
	await h.c.encouragement_load(p, new Date(h.now() - 120 * day));
	h.c.encouragement_update(p, true);
	assert(!p.s.encouragement_returning);
});

test("reconnects preserve dates and an old saved start cannot become new by deleting siblings", async () => {
	const h = harness(),
		p = h.player("Returning", { created: h.now() - 400 * day });
	h.setRecords([h.record(p)]);
	await h.c.encouragement_load(p, new Date(h.now() - 120 * day));
	h.c.encouragement_update(p, true);
	const until = p.p.encouragement.return_until;
	h.time(h.now() + day);
	h.setRecords([h.record(p, { info: { p: { encouragement: plain(p.p.encouragement) } } })]);
	await h.c.encouragement_load(p, new Date(h.now() - day));
	h.c.encouragement_update(p, true);
	assert.equal(p.p.encouragement.return_until, until);
	assert(!p.s.encouragement_new);
});

test("cached eligibility does no combat queries; stale or failed state grants no bonuses", async () => {
	const h = harness(),
		p = h.player();
	h.setRecords([h.record(p)]);
	await Promise.all([h.c.encouragement_load(p), h.c.encouragement_load(p)]);
	const m = h.monster(p, { max_hp: 100000 });
	for (let i = 0; i < 10000; i++) h.c.encouragement_points(m, p, 1);
	assert.equal(h.queries.length, 1);
	assert.equal(h.writes(), 1);
	h.time(h.now() + 5 * 60000);
	h.c.encouragement_update(p, true);
	assert(p.encouragement.blocked);
	assert.equal(p.encouragement.totals.gold, 1);
});

test("real damage handler: 99% veteran damage plus an overkill last hit cannot lend a 15x bonus", () => {
	const h = harness(),
		old = h.player("Veteran"),
		p = h.player("New");
	h.eligible(p);
	const m = h.monster(p);
	h.hit(old, m, 990);
	h.hit(p, m, 1000000);
	assert.equal(m.contributions[p.real_id].points, 10);
	assert.equal(m.contributions[old.real_id].points, 990);
	assert.equal(m.contribution_total, 1000);
	assert(!m.cooperative);
	assert(!p.s.coop);
	assert.equal(p.xp, 1140);
	const id = Object.keys(h.c.chests)[0];
	h.open(p, id);
	assert.equal(p.gold, 1140);
});

test("99% damage survives the real disconnect and retarget handlers before a late 15x finisher", () => {
	for (const [chance, roll, copies] of [
		[1, 0.139, 2],
		[1, 0.141, 1],
		[0.1, 0.0139, 2],
		[0.1, 0.0141, 1],
	]) {
		const h = harness(),
			old = h.player("Veteran"),
			m = h.monster(old);
		old.vision = [700, 500];
		Object.assign(h.c, {
			sockets: { [old.id]: old.socket },
			observers: {},
			dc_players: {},
			S: { gold: 0 },
			Dev: false,
			future_s: (seconds) => new Date(h.now() + seconds * 1000),
			increase_targets() {},
			reduce_targets() {},
			calculate_monster_stats() {},
			// Queue the normal logout without starting persistence or external services.
			sync_loop() {},
		});
		load(h.c, "node/server_functions.js", ["remove_entity_emit"]);
		load(h.c, "js/old_common_functions.js", ["get_x", "get_y", "within_xy_range"]);
		load(h.c, "node/server.js", ["defeat_player", "restore_state", "stop_pursuit", "target_player"]);
		load(h.c, "node/server_functions.js", ["pmap_remove", "server_tax"]);
		load(h.c, "node/logic/tavern_wheel.js", ["tavern_wheel_disconnect"]);
		load(h.c, "node/logic/tavern_slots.js", ["tavern_slots_disconnect"]);
		load(h.c, "node/logic/tavern_poker.js", ["tavern_poker_definition", "tavern_poker_disconnect"]);
		h.c.D.drops.monsters.goo = [[chance, "ringsj"]];
		h.hit(old, m, 990);
		assert.equal(m.hp, 10);
		h.c.socket = old.socket;
		socketHandler(h.c, "disconnect")();
		assert.equal(old.dc, true);
		assert.equal(h.c.players[old.id], undefined);
		assert.equal(h.c.instances.main.players[old.id], undefined);
		assert.equal(h.c.dc_players[old.real_id], old);
		assert.equal(m.contribution_total, 990);
		assert.equal(m.contributions[old.real_id].points, 990);
		h.c.stop_pursuit(m, { force: true });
		assert.equal(m.target, null);
		const p = h.player("New");
		h.eligible(p);
		assert.deepEqual(plain(p.encouragement.totals), { gold: 15, xp: 15, luck: 15 });
		h.roll(0.05);
		h.hit(p, m, 1000000);
		assert.equal(m.target, p.name);
		assert.equal(m.contributions[p.real_id].points, 10);
		assert.equal(m.contribution_total, 1000);
		assert.equal(p.xp, 1140);
		const id = Object.keys(h.c.chests)[0],
			chest = h.c.chests[id];
		assert.equal(chest.encouragement.length, 1);
		assert.equal(chest.encouragement[0].id, p.real_id);
		assert.equal(chest.encouragement[0].gold, 0.14);
		assert.equal(chest.encouragement[0].luck, 0.14);
		h.roll(roll);
		h.open(p, id);
		h.open(p, id);
		// Native 10% tax: normal 900 gold plus 126 bonus, not 13,500 gold.
		assert.equal(p.gold, 1026);
		assert.equal(p.t.cgold, 1026);
		assert.equal(h.c.S.gold, 114);
		assert.equal(h.inventory.get(p.real_id).length, copies);
		assert.equal(h.events.find((event) => event.name === p.name && event.event === "chest_opened").data.gold, 1026);
		assert.equal(old.gold, 0);
		assert.equal(old.xp, 0);
		assert.equal(h.queries.length, 0);
		assert.equal(h.writes(), 0);
	}
});

test("disconnected contributors remain in the denominator, missing history fails conservatively", () => {
	const h = harness(),
		old = h.player("Old"),
		p = h.player();
	h.eligible(p);
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, old, 990);
	h.c.encouragement_points(m, p, 10);
	delete h.c.players.Old;
	assert.equal(h.c.encouragement_share(p, m).gold, 0.14);
	delete m.contributions[old.real_id];
	m.contribution_total = 10;
	assert.equal(h.c.encouragement_share(p, m).gold, 0.14);
});

test("one additional table pass permits two guaranteed drops, never fifteen or the co-op repeat count", () => {
	const h = harness(),
		p = h.player();
	h.eligible(p);
	h.c.D.drops.monsters.goo = [[1, "ringsj"]];
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, p, 1000);
	h.c.drop_something(p, m);
	const id = Object.keys(h.c.chests)[0];
	h.c.B.drop_table_multiplier = 100;
	h.open(p, id);
	h.open(p, id);
	assert.equal(h.inventory.get(p.real_id).filter((i) => i.name === "ringsj").length, 2);
	assert.equal(p.gold, 15000);
	assert.deepEqual(
		h.events.filter((e) => e.name === p.name && e.data?.color === "gold").map((e) => e.data.message),
		["15000 gold"],
	);
	assert.equal(h.events.find((e) => e.event === "chest_opened" && !e.data.gone).data.gold, 15000);
});

test("opener, party changes and forged conditions cannot steal a sealed personal roll", () => {
	const h = harness(),
		p = h.player(),
		opener = h.player("Opener");
	h.eligible(p);
	h.c.D.drops.monsters.goo = [[1, "ringsj"]];
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, p, 1000);
	h.c.drop_something(p, m);
	const id = Object.keys(h.c.chests)[0];
	opener.goldm = 10;
	opener.luckm = 100000;
	opener.s.encouragement_new = { gold_multiplier: 100000 };
	h.open(opener, id);
	assert.equal(opener.gold, 10000);
	assert.equal(p.gold, 140000);
	assert.equal(h.inventory.get(p.real_id).length, 1);
	assert.equal(h.inventory.get(opener.real_id).length, 1);
	for (const current of [p, opener]) {
		const opened = h.events.filter((e) => e.name === current.name && e.event === "chest_opened");
		assert.equal(opened.length, 1);
		assert.equal(opened[0].data.id, id);
		assert.equal(opened[0].data.opener, opener.name);
		assert.equal(opened[0].data.goldm, 10);
		assert.equal(opened[0].data.gold, current.gold);
		assert.deepEqual(
			opened[0].data.items.map((item) => item.looter),
			[current.name],
		);
	}
	assert.deepEqual(
		h.events.filter((e) => e.event === "game_log" && e.data.color === "gold").map((e) => [e.name, e.data.message]),
		[
			[p.name, "140000 gold"],
			[opener.name, "10000 gold"],
		],
	);
});

test("party gold uses the 100000 / 20% / 2% / 5x example and personal drops never enter its lottery", () => {
	const h = harness(),
		p = h.player(),
		other = h.player("Other");
	h.eligible(p);
	h.player("Sibling", { owner: p.owner });
	h.c.encouragement_update(p, true);
	p.party = other.party = "team";
	p.share = 0.2;
	other.share = 0.8;
	h.c.parties.team = [p.name, other.name];
	h.c.D.monster_gold.goo = 499999;
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, p, 20);
	h.c.encouragement_points(m, other, 980);
	h.c.drop_something(p, m);
	h.open(other, Object.keys(h.c.chests)[0]);
	assert.equal(p.gold, 140000);
	assert.equal(other.gold, 400000);
	for (const current of [p, other]) {
		assert.equal(current.t.cgold, current.gold);
		assert.deepEqual(
			h.events
				.filter((e) => e.name === current.name && e.event === "game_log" && e.data.color === "gold")
				.map((e) => e.data.message),
			[current.gold + " gold"],
		);
		assert.equal(h.events.find((e) => e.name === current.name && e.event === "chest_opened").data.gold, current.gold);
		assert.equal(
			h.events.find((e) => e.name === current.name && e.event === "disappearing_text").data.message,
			"+" + current.gold,
		);
	}
});

test("combined gold announcements preserve separate tax rounding and ordinary loot", () => {
	for (const bonus of [false, true]) {
		const h = harness(),
			p = h.player();
		if (bonus) h.eligible(p, 100 * day);
		h.c.S = { gold: 0 };
		load(h.c, "node/server_functions.js", ["server_tax"]);
		h.c.D.monster_gold.goo = 93;
		const m = h.monster(p, { hp: 0 });
		h.c.encouragement_points(m, p, 1000);
		h.c.drop_something(p, m);
		h.open(p, Object.keys(h.c.chests)[0]);
		const gold = bonus ? 255 : 85;
		assert.equal(p.gold, gold);
		assert.equal(p.t.cgold, gold);
		assert.equal(h.c.S.gold, bonus ? 27 : 9);
		assert.deepEqual(
			h.events.filter((e) => e.event === "game_log" && e.data.color === "gold").map((e) => e.data.message),
			[gold + " gold"],
		);
		assert.equal(h.events.find((e) => e.event === "disappearing_text").data.message, "+" + gold);
		assert.equal(h.events.find((e) => e.event === "chest_opened").data.gold, gold);
	}
});

test("consecutive chests combine the screenshot's 82 + 163 and 58 + 115 rewards", () => {
	const h = harness(),
		p = h.player(),
		other = h.player("Other");
	h.eligible(p, 100 * day);
	h.c.S = { gold: 0 };
	load(h.c, "node/server_functions.js", ["server_tax"]);
	for (const base of [90, 63]) {
		h.c.D.monster_gold.goo = base;
		const m = h.monster(p, { hp: 0 });
		h.c.encouragement_points(m, other, 5);
		h.c.encouragement_points(m, p, 995);
		h.c.drop_something(p, m);
		h.open(p, Object.keys(h.c.chests)[0]);
	}
	assert.deepEqual(
		h.events.filter((e) => e.event === "game_log" && e.data.color === "gold").map((e) => e.data.message),
		["245 gold", "173 gold"],
	);
	assert.deepEqual(
		h.events.filter((e) => e.event === "chest_opened").map((e) => e.data.gold),
		[245, 173],
	);
	assert.equal(p.gold, 418);
	assert.equal(p.t.cgold, 418);
});

test("zero work, late login and rate changes do not grant retroactive encouragement", () => {
	const h = harness(),
		p = h.player(),
		old = h.player("Old"),
		m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, old, 990);
	h.c.encouragement_points(m, p, 10);
	h.eligible(p);
	assert.equal(h.c.encouragement_share(p, m).luck, 0);
	const none = h.player("None");
	h.eligible(none);
	assert.equal(h.c.encouragement_share(none, m), null);
});

test("healing credits only a monster wound once; overhealing, PvP wounds and unrelated monsters give no credit", () => {
	const h = harness(),
		tank = h.player("Tank"),
		healer = h.player("Healer");
	h.eligible(healer);
	const m = h.monster(tank);
	tank.hp -= 100;
	h.c.encouragement_wound(tank, m, 100);
	h.c.encouragement_heal(healer, tank, 1000, 100);
	assert.equal(m.contributions[healer.real_id].points, 180);
	h.c.encouragement_heal(healer, tank, 1000, 100);
	assert.equal(m.contributions[healer.real_id].points, 180);
	assert(!tank.encouragement_wound);
	tank.hp = 10000;
	h.hit(healer, tank, 100);
	assert(!tank.encouragement_wound);
});

test("full inventory reserves one fixed result; another character and duplicate opens cannot claim it", () => {
	const h = harness(),
		p = h.player(),
		other = h.player("Other");
	h.eligible(p);
	h.c.D.drops.monsters.goo = [[1, "ringsj"]];
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, p, 1000);
	h.c.drop_something(p, m);
	p.full = true;
	h.open(other, Object.keys(h.c.chests)[0]);
	assert.equal(h.events.filter((e) => e.name === p.name && e.event === "chest_opened").length, 0);
	const id = Object.keys(h.c.chests)[0];
	assert(h.c.chests[id].character === p.real_id);
	h.open(other, id);
	assert(h.c.chests[id]);
	p.full = false;
	p.goldm = 1000000;
	p.party = "late";
	h.open(p, id);
	h.open(p, id);
	assert.equal(p.gold, 14000);
	assert.equal(h.inventory.get(p.real_id).length, 1);
	const opened = h.events.filter((e) => e.name === p.name && e.event === "chest_opened" && !e.data.gone);
	assert.equal(opened.length, 1);
	assert.equal(opened[0].data.id, id);
	assert.equal(opened[0].data.goldm, 1);
	assert.equal(opened[0].data.gold, 14000);
	assert.deepEqual(
		opened[0].data.items.map((item) => [item.name, item.looter]),
		[["ringsj", p.name]],
	);
	assert.deepEqual(
		h.events
			.filter((e) => e.name === p.name && e.event === "game_log" && e.data.color === "gold")
			.map((e) => e.data.message),
		["14000 gold"],
	);
});

for (const party of [false, true])
	for (const ordinaryDrop of [false, true])
		test(`non-coop Bee loot event includes ${ordinaryDrop ? "normal and bonus" : "bonus-only"} drops ${party ? "for the party" : "solo"}`, () => {
			const h = harness(),
				p = h.player("Reporter", { goldm: 1.815 }),
				other = h.player("Other");
			h.eligible(p);
			if (party) {
				p.party = other.party = "team";
				p.share = other.share = 0.5;
				h.c.parties.team = [p.name, other.name];
			}
			assert(!G.monsters.bee.cooperative);
			h.c.D.drops.monsters.bee = plain(G.drops.monsters.bee);
			h.c.D.monster_gold.bee = G.monster_gold.bee;
			const m = h.monster(p, { type: "bee", hp: 0, max_hp: G.monsters.bee.hp });
			h.c.encouragement_points(m, p, m.max_hp);
			h.roll(ordinaryDrop ? 0.005 : 0.5);
			h.c.drop_something(p, m);
			const id = Object.keys(h.c.chests)[0];
			assert.equal(h.c.chests[id].items.length, ordinaryDrop ? 1 : 0);
			h.roll(0.05);
			h.open(p, id);
			const received = h.inventory.get(p.real_id).slice();
			assert.equal(received.length, ordinaryDrop ? 2 : 1);
			for (const current of party ? [p, other] : [p]) {
				const opened = h.events.filter((e) => e.name === current.name && e.event === "chest_opened");
				assert.equal(opened.length, 1);
				assert.equal(opened[0].data.gold, current.gold);
				assert.deepEqual(
					opened[0].data.items,
					received.map((item) => ({ ...item, looter: p.name })),
				);
				assert(opened[0].data.items.every((item) => item.name === "beewings" && (item.q || 1) === 1));
			}
			h.open(p, id);
			assert.equal(h.inventory.get(p.real_id).length, received.length);
			assert.equal(h.events.filter((e) => e.name === p.name && e.event === "chest_opened" && !e.data.gone).length, 1);
			assert.equal(h.queries.length, 0, "loot reporting does not query the database");
		});

test("loot caches only the awarded quantity when both drops join an existing stack", () => {
	const h = harness(),
		p = h.player();
	h.eligible(p);
	const source = read("node/server_functions.js");
	vm.runInContext(source.slice(source.indexOf("var item_p_ignore ="), source.indexOf("function cache_item(")), h.c);
	load(h.c, "node/server_functions.js", ["cache_item"]);
	load(h.c, "node/server.js", ["add_item"]);
	h.c.a_score = {};
	h.c.can_stack = (a, b) => a && b && a.name === b.name;
	p.items = [{ name: "beewings", q: 100 }];
	p.citems = [];
	p.esize = 41;
	h.c.D.drops.monsters.bee = [[1, "beewings", 7]];
	const m = h.monster(p, { type: "bee", hp: 0 });
	h.c.encouragement_points(m, p, 1000);
	h.c.drop_something(p, m);
	h.open(p, Object.keys(h.c.chests)[0]);
	assert.equal(p.items.length, 1);
	assert.equal(p.items[0].q, 114);
	const opened = h.events.find((e) => e.name === p.name && e.event === "chest_opened").data;
	assert.equal(opened.items.length, 2);
	for (const item of opened.items) assert.deepEqual(item, { name: "beewings", q: 7, looter: p.name });
});

test("party loot keeps each bonus item's recipient and does not report reserved items early", () => {
	for (const full of [false, true]) {
		const h = harness(),
			p = h.player(),
			other = h.player("Other");
		h.eligible(p);
		h.eligible(other);
		p.party = other.party = "team";
		p.share = other.share = 0.5;
		h.c.parties.team = [p.name, other.name];
		h.c.D.drops.monsters.goo = [[1, "ringsj"]];
		const m = h.monster(p, { hp: 0 });
		h.c.encouragement_points(m, p, 500);
		h.c.encouragement_points(m, other, 500);
		h.c.drop_something(p, m);
		// The ordinary item fits, but the first recipient's next item may not.
		h.c.can_add_items = (current) => !full || current !== p || !h.inventory.get(p.real_id).length;
		h.roll(0);
		h.open(p, Object.keys(h.c.chests)[0]);
		for (const current of [p, other]) {
			const opened = h.events.filter((e) => e.name === current.name && e.event === "chest_opened");
			assert.equal(opened.length, 1);
			assert.deepEqual(
				opened[0].data.items.map((item) => item.looter),
				full ? [p.name, other.name] : [p.name, p.name, other.name],
			);
		}
		assert.equal(h.inventory.get(p.real_id).length, full ? 1 : 2);
		assert.equal(h.inventory.get(other.real_id).length, 1);
		assert.equal(Object.keys(h.c.chests).length, full ? 1 : 0);
	}
});

test("outside-party receipts preserve dry/stale flags and omit empty item lists", () => {
	for (const reward of ["gold", "none", "invalid"]) {
		const h = harness(),
			p = h.player(),
			opener = h.player("Opener", { goldm: 100 });
		h.eligible(p);
		const m = h.monster(p, { hp: 0 });
		h.c.encouragement_points(m, p, 1000);
		h.c.drop_something(p, m);
		const id = Object.keys(h.c.chests)[0];
		if (reward === "none") h.c.chests[id].encouragement_gold = 0;
		if (reward === "invalid") p.owner = "changed-owner";
		h.c.simple_distance = () => 401;
		h.time(h.now() + 9 * 60000);
		h.open(opener, id);
		const opened = h.events.filter((e) => e.name === p.name && e.event === "chest_opened");
		assert.equal(opened.length, reward === "gold" ? 1 : 0);
		if (reward === "gold")
			assert.deepEqual(opened[0].data, { id, goldm: 1, opener: opener.name, gold: 14000, dry: true, stale: true });
	}
});

test("PvP reduces both sides by the persistent XP maximum without awarding new encouragement", () => {
	const h = harness(),
		target = h.player("Target", { xp: 1000000, max_xp: 100000000, gold: 10000 }),
		attacker = h.player("Attacker", { xp: 1000000, gold: 10000 });
	target.p.max_xp_multiplier = 15;
	h.c.issue_player_award(attacker, target);
	const loss = Math.floor(Math.round(1000000 / 15) / 15);
	assert.equal(target.xp, 1000000 - loss);
	assert.equal(attacker.xp, 1000000 + Math.round(loss * 0.95));
	assert.equal(target.p.max_xp_multiplier, 15);
});

test("ordinary drop paths keep seasonal, home, dynamic, global and bundle semantics", () => {
	const h = harness(),
		p = h.player();
	p.p.home = "EU1";
	h.c.D.drops.maps.global_static = [[1, "ringsj"]];
	h.c.D.drops.maps.main = [[1, "hpbelt"]];
	h.c.D.drops.monsters_home_server.goo = [[1, "gem0"]];
	h.c.D.drops.monsters.goo = [[1, "hpot0", 7]];
	const m = h.monster(p, { drops: [[1, "mpot0", 4]] });
	h.c.drop_something(p, m);
	h.open(p, Object.keys(h.c.chests)[0]);
	assert.deepEqual(
		h.inventory.get(p.real_id).map((i) => i.name),
		["ringsj", "hpbelt", "hpot0", "mpot0", "gem0"],
	);
	assert.equal(h.inventory.get(p.real_id).find((i) => i.name === "hpot0").q, 7);
	assert.equal(p.gold, 1000);
});

test("merchant realm changes preserve verified sibling bonuses without extending the cache", async () => {
	for (const returning of [false, true]) {
		const a = harness(),
			b = harness();
		const created = a.now() - (returning ? 100 : 1) * day;
		const hero = a.player("Hero", { pid: "shared", created });
		const merchant = b.player("Shop", { pid: "shared", type: "merchant", created });
		b.c.server_id = "SR_US1";
		a.eligible(hero, a.now() - created, returning ? a.now() + 10 * day : 0);
		const group = a.c.encouragement_groups.get("pid:shared");
		const records = [
			a.record(hero, { server: "SR_EU1", info: { p: { encouragement: plain(hero.p.encouragement) } } }),
			b.record(merchant),
		];
		group.characters = structuredClone(records);
		b.setRecords(records.toReversed());
		const before = plain(hero.s),
			until = group.until,
			next = group.next;
		let notices = 0;
		b.c.server_eval = async (_server, _code, data) => {
			notices++;
			return a.c.encouragement_foreign_login(data);
		};
		for (let hop = 0; hop < 3; hop++) {
			a.time(a.now() + 1000);
			b.time(a.now());
			b.c.server_id = ["SR_US1", "SR_ASIA1", "SR_US2"][hop];
			records[1].server = b.c.server_id;
			b.setRecords(records.toReversed());
			assert.equal(await b.c.encouragement_login(merchant, new Date(b.now())), true);
			assert.deepEqual(plain(hero.s), before);
			assert.equal(hero.encouragement.blocked, false);
			assert.equal(group.until, until, "merchant logins cannot renew a cached eligibility check");
			assert.equal(group.next, next);
			assert.equal(a.c.encouragement_visits.has("pid:shared"), false);
		}
		assert.equal(notices, 3);
		assert.equal(a.queries.length, 0, "unchanged merchant moves do not force another realm's character query");
		assert.equal(merchant.s.encouragement_lonewolf, undefined);
		b.c.server_eval = async () => false;
		assert.equal(
			await b.c.encouragement_login(merchant, new Date(b.now())),
			false,
			"merchant logins still need acknowledgement",
		);
	}
});

test("merchant logins still invalidate changed membership, age, return windows and character limits", async () => {
	for (const change of [
		"new_merchant",
		"linked_owner",
		"older_character",
		"return_window",
		"character_limit",
		"combat_class",
		"combat_activity",
	]) {
		const a = harness(),
			b = harness();
		const hero = a.player("Hero", { pid: "shared" }),
			merchant = b.player("Shop", { pid: "shared", type: "merchant" });
		b.c.server_id = "SR_US1";
		a.eligible(hero);
		const group = a.c.encouragement_groups.get("pid:shared");
		const original = [a.record(hero, { server: "SR_EU1" }), b.record(merchant)];
		if (change === "combat_activity") original.push(a.record(hero, { _id: "CH_other", type: "mage" }));
		group.characters = structuredClone(change === "new_merchant" ? original.slice(0, 1) : original);
		const fresh = structuredClone(original);
		if (change === "linked_owner")
			fresh.push(a.record(hero, { _id: "CH_linked", owner: "US_linked", type: "merchant" }));
		if (change === "older_character") fresh[0].created = new Date(a.now() - 100 * day);
		if (change === "return_window")
			b.histories.set("MK_encouragement-pid:shared", {
				oldest: hero.created,
				last_online: b.now(),
				return_until: b.now() + 10 * day,
			});
		if (change === "character_limit")
			while (fresh.length < 25) fresh.push(a.record(hero, { _id: "CH_" + fresh.length, type: "merchant" }));
		if (change === "combat_class") fresh[1].type = "mage";
		if (change === "combat_activity") fresh[2].server = "SR_ASIA1";
		b.setRecords(fresh);
		a.setRecords(fresh);
		b.c.server_eval = async (_server, _code, data) => a.c.encouragement_foreign_login(data);
		assert.equal(await b.c.encouragement_login(merchant, new Date(b.now())), true, change);
		assert.equal(group.until, 0, change);
		assert.equal(group.next, 0, change);
		assert.equal(hero.encouragement.blocked, true, change);
		assert.equal(hero.s.encouragement_new, undefined, change);
		assert.equal(hero.s.encouragement_lonewolf, undefined, change);
		await a.c.encouragement_load(hero);
		a.c.encouragement_update(hero, true);
		if (change === "character_limit")
			assert.equal(hero.encouragement.blocked, true, "merchants still count toward the 25-character cutoff");
		if (change === "older_character")
			assert.equal(hero.s.encouragement_new, undefined, "an older linked history must revoke New Player");
	}
});

test("merchant notices cannot preserve expired, missing or invalidated eligibility", async () => {
	for (const state of ["expired", "pending", "legacy"]) {
		const a = harness(),
			b = harness();
		const hero = a.player("Hero", { pid: "shared" }),
			merchant = b.player("Shop", { pid: "shared", type: "merchant" });
		b.c.server_id = "SR_US1";
		a.eligible(hero);
		const group = a.c.encouragement_groups.get("pid:shared");
		const records = [a.record(hero, { server: "SR_EU1" }), b.record(merchant)];
		group.characters = structuredClone(records);
		b.setRecords(records);
		if (state === "expired") group.until = a.now();
		if (state === "pending") group.pending = Promise.resolve();
		b.c.server_eval = async (_server, _code, data) => {
			if (state === "legacy") delete data.eligibility;
			return a.c.encouragement_foreign_login(data);
		};
		assert.equal(await b.c.encouragement_login(merchant, new Date(b.now())), true);
		assert.equal(hero.encouragement.blocked, true, state);
		assert.equal(group.until, 0, state);
	}
});

test("foreign login revokes cached bonuses before admission; missing acknowledgements fail closed", async () => {
	const a = harness(),
		p = a.player("First", { pid: "same" });
	a.eligible(p);
	const b = harness(),
		second = b.player("Second", { pid: "same" });
	b.c.server_id = "SR_US1";
	b.setRecords([b.record(second), a.record(p, { server: "SR_EU1" })]);
	let acknowledgements = 0;
	b.c.server_eval = async (_server, code, data, timeout) => {
		assert(code.includes("encouragement_foreign_login"));
		assert.equal(timeout, 5000);
		acknowledgements++;
		return a.c.encouragement_foreign_login(data);
	};
	assert(await b.c.encouragement_login(second, new Date(b.now())));
	assert.equal(acknowledgements, 1);
	assert(!p.s.encouragement_lonewolf);
	assert(!second.s.encouragement_lonewolf);
	b.c.server_eval = async () => "";
	assert.equal(await b.c.encouragement_login(second, new Date(b.now())), false);
});

test("login keeps one shared return window; reconnects and siblings cannot extend or erase it", async () => {
	const h = harness(),
		p = h.player("Return", { created: h.now() - 500 * day });
	h.setRecords([h.record(p)]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 120 * day)));
	const until = p.p.encouragement.return_until;
	assert.equal(h.writes(), 1);
	h.time(h.now() + 60000);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 60000)));
	assert.equal(h.writes(), 2);
	assert.equal(p.p.encouragement.return_until, until);
	const other = h.player("Sibling", { owner: p.owner, created: h.now() - 400 * day });
	h.setRecords([h.record(p), h.record(other)]);
	assert(await h.c.encouragement_login(other, new Date(h.now() - day)));
	assert.equal(other.p.encouragement.return_until, until);
});

test("Steam linking preserves the earned owner bonus, including after saved character state is lost", async () => {
	const h = harness(),
		p = h.player("Return", { created: h.now() - 500 * day });
	h.setRecords([h.record(p)]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 400 * day)));
	const until = p.p.encouragement.return_until;
	assert.equal(until, h.now() + 90 * day);
	assert.equal(h.historyQueries.length, 0);

	h.time(h.now() + day);
	p.pid = "shared-steam";
	p.p.steam_id = p.pid;
	h.setRecords([h.record(p, { info: { p: { encouragement: plain(p.p.encouragement) } } })]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - day)));
	assert.equal(p.s.encouragement_returning.expires, until);
	assert.equal(h.histories.get("MK_encouragement-owner:" + p.owner).return_until, until);
	assert.equal(h.histories.get("MK_encouragement-pid:" + p.pid).return_until, until);
	assert.deepEqual(plain(h.historyQueries[0].query), { _id: { $in: ["MK_encouragement-owner:" + p.owner] } });
	assert.equal(h.historyQueries[0].limit, 25);
	assert.equal(h.historyQueries[0].timeout, 3000);
	assert.deepEqual(plain(h.historyQueries[0].options.projection), { oldest: 1, last_online: 1, return_until: 1 });

	// Reproduce an already-stranded bonus: only the old owner mark still has it.
	h.c.encouragement_groups.clear();
	h.histories.get("MK_encouragement-pid:" + p.pid).return_until = 0;
	delete p.p.encouragement;
	h.time(h.now() + 60000);
	h.setRecords([h.record(p)]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 60000)));
	assert.equal(p.s.encouragement_returning.expires, until);
	assert.equal(h.historyQueries.length, 2);

	h.time(h.now() + 5 * 60000);
	await h.c.encouragement_load(p);
	assert.equal(h.historyQueries.length, 2, "routine refreshes do not read owner marks");
	assert.equal(p.p.encouragement.return_until, until);
});

test("linked accounts inherit the latest existing expiry without stacking or shortening it", async () => {
	const h = harness(),
		p = h.player("Recovered", { pid: "shared", created: h.now() - 500 * day }),
		sibling = h.player("Secondary", { pid: "shared", created: h.now() - 400 * day });
	const until = h.now() + 70 * day;
	h.histories.set("MK_encouragement-owner:" + p.owner, {
		oldest: p.created,
		last_online: h.now() - 2 * day,
		return_until: h.now() + 30 * day,
	});
	h.histories.set("MK_encouragement-owner:" + sibling.owner, {
		oldest: sibling.created,
		last_online: h.now() - day,
		return_until: until,
	});
	h.setRecords([h.record(p), h.record(sibling), h.record(sibling, { _id: "CH_merchant", type: "merchant" })]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 400 * day)));
	assert.equal(p.s.encouragement_returning.expires, until);
	assert.equal(h.historyQueries[0].query._id.$in.length, 2, "one lookup per distinct linked owner");
	assert(await h.c.encouragement_login(sibling, new Date(h.now() - 60000)));
	assert.equal(sibling.s.encouragement_returning.expires, until);

	const longer = h.now() + 80 * day;
	h.histories.get("MK_encouragement-pid:shared").return_until = longer;
	h.c.encouragement_groups.clear();
	h.time(h.now() + 60000);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 60000)));
	assert.equal(p.s.encouragement_returning.expires, longer);
	h.time(longer);
	h.setRecords([h.record(p), h.record(sibling)]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 60000)));
	assert(!p.s.encouragement_returning, "expired owner marks cannot restart the bonus");
});

test("owner history prevents newcomer and returning bonuses from resetting after Steam linking", async () => {
	const h = harness(),
		p = h.player("Replacement", { pid: "shared" });
	h.histories.set("MK_encouragement-owner:" + p.owner, {
		oldest: h.now() - 500 * day,
		last_online: h.now() - day,
		return_until: 0,
	});
	h.setRecords([h.record(p)]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - 400 * day)));
	assert(!p.s.encouragement_new);
	assert(!p.s.encouragement_returning);
	assert.equal(p.p.encouragement.oldest, h.now() - 500 * day);
});

test("migration reads only linked owner marks, never unrelated owners or previous platform bonuses", async () => {
	const h = harness(),
		p = h.player("Linked", { pid: "current", created: h.now() - 500 * day });
	const saved = { oldest: p.created, last_online: h.now() - day, return_until: h.now() + 90 * day };
	h.histories.set("MK_encouragement-owner:US_unrelated", saved);
	h.histories.set("MK_encouragement-pid:previous", saved);
	p.p.encouragement = { group: "pid:previous", oldest: p.created, return_until: saved.return_until };
	h.setRecords([h.record(p, { info: { p: { encouragement: plain(p.p.encouragement) } } })]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - day)));
	assert(!p.s.encouragement_returning);
	assert.deepEqual(plain(h.historyQueries[0].query._id.$in), ["MK_encouragement-owner:" + p.owner]);
});

test("owner history cannot bypass the character limit or an empty platform roster", async () => {
	for (const count of [0, 24, 25, 26]) {
		const h = harness(),
			p = h.player("Linked", { pid: "shared", created: h.now() - 500 * day });
		h.histories.set("MK_encouragement-owner:" + p.owner, {
			oldest: p.created,
			last_online: h.now() - day,
			return_until: h.now() + 70 * day,
		});
		h.setRecords(Array.from({ length: count }, (_, i) => h.record(p, { _id: i ? "CH_" + i : p.real_id })));
		assert(await h.c.encouragement_login(p, new Date(h.now() - day)));
		assert.equal(!!p.s.encouragement_returning, count === 24);
		assert.equal(h.historyQueries.length, count === 24 ? 1 : 0);
		assert.equal(p.encouragement.blocked, count !== 24);
	}
});

test("a restored group mark reaches online characters and survives stale character saves", async () => {
	const h = harness(),
		p = h.player("Online", { pid: "shared", created: h.now() - 500 * day });
	h.setRecords([h.record(p)]);
	assert(await h.c.encouragement_login(p, new Date(h.now() - day)));
	assert(!p.s.encouragement_returning);
	const stale = plain(p.p.encouragement),
		until = h.now() + 70 * day;
	h.histories.get("MK_encouragement-pid:shared").return_until = until;
	h.time(h.now() + 5 * 60000);
	await h.c.encouragement_load(p);
	h.c.encouragement_update(p, true);
	assert.equal(p.s.encouragement_returning.expires, until);
	assert.equal(h.historyQueries.length, 1);

	h.time(h.now() + 5 * 60000);
	p.p.encouragement = stale;
	h.setRecords([h.record(p, { info: { p: { encouragement: stale } } })]);
	h.c.encouragement_groups.clear();
	assert(await h.c.encouragement_login(p, new Date(h.now() - 60000)));
	assert.equal(p.s.encouragement_returning.expires, until);
	assert.equal(h.histories.get("MK_encouragement-pid:shared").return_until, until);
});

test("an unavailable owner-history lookup cannot admit a character with unchecked bonuses", async () => {
	const h = harness(),
		p = h.player("Linked", { pid: "shared" }),
		collection = h.c.db.collection;
	h.setRecords([h.record(p)]);
	h.c.db.collection = (name) => {
		const result = collection(name);
		if (name === "mark")
			result.find = () => {
				throw Error("fixture history unavailable");
			};
		return result;
	};
	h.c.log_trace = () => {};
	assert.equal(await h.c.encouragement_login(p, new Date(h.now())), false);
	assert.equal(h.writes(), 0);
	assert(!p.s.encouragement_returning);
	assert.equal(h.c.encouragement_groups.get("pid:shared").next, h.now() + 60000);
});

test("invalidation during a query cannot resurrect an older eligible snapshot", async () => {
	const h = harness(),
		p = h.player();
	let finish;
	const collection = h.c.db.collection;
	h.c.db.collection = (name) =>
		name === "mark"
			? collection(name)
			: {
					find() {
						return {
							limit() {
								return this;
							},
							maxTimeMS() {
								return this;
							},
							toArray: () => new Promise((resolve) => (finish = resolve)),
						};
					},
				};
	const loading = h.c.encouragement_load(p);
	await Promise.resolve();
	h.c.encouragement_foreign_login({ group: h.c.encouragement_identity(p).key, id: "CH_other" });
	finish([h.record(p)]);
	await loading;
	h.c.encouragement_update(p, true);
	assert(p.encouragement.blocked);
});

test("database errors back off, do not retry per hit, and do not preserve stale bonuses", async () => {
	const h = harness(),
		p = h.player();
	h.eligible(p);
	let calls = 0;
	h.c.log_trace = () => {};
	h.c.db.collection = () => {
		calls++;
		throw Error("unavailable");
	};
	h.time(h.now() + 5 * 60000);
	await h.c.encouragement_load(p);
	for (let i = 0; i < 100; i++) h.c.encouragement_tick();
	assert.equal(calls, 1);
	assert(p.encouragement.blocked);
});

test("co-op softening, home weighting and table repetition never enter actual contribution", () => {
	const h = harness(),
		p = h.player(),
		other = h.player("Other");
	h.eligible(p);
	p.p.home = "EU1";
	const m = h.monster(p, { cooperative: true, hp: 0 });
	h.c.add_coop_points(m, p, 10);
	h.c.add_coop_points(m, other, 990);
	assert.equal(m.points[p.name], 50);
	assert.equal(m.contributions[p.real_id].points, 10);
	assert.equal(h.c.encouragement_share(p, m).gold, 0.14);
	h.c.D.drops.monsters.goo = [[1, "ringsj"]];
	h.c.issue_monster_awards(m);
	assert.equal(h.c.B.drop_table_multiplier, 1);
	const claims = Object.values(h.c.chests).flatMap((chest) => chest.encouragement || []);
	assert.equal(claims.filter((claim) => claim.id === p.real_id).length, 1);
});

test("10000 randomized low-contribution cases stay within the one-pass probability ceiling", () => {
	const h = harness(),
		p = h.player();
	h.eligible(p);
	let seed = 71;
	const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
	for (let i = 0; i < 10000; i++) {
		const contribution = random(),
			probability = random(),
			roll = random();
		h.c.D.drops.monsters.goo = [[probability, "ringsj"]];
		h.roll(roll);
		const result = { items: [], cash: 0 };
		h.c.roll_monster_drops(
			p,
			{ type: "goo", map: "main", max_hp: 1000, luckx: 1, level: 1, mult: 1 },
			result,
			contribution * 14,
			{ home: false },
		);
		assert.equal(result.items.length, roll < probability * contribution * 14 ? 1 : 0);
		assert(result.items.length <= 1);
	}
});

test("ordinary stats remain unchanged, level-up resets the record and boosted overflow stays protected", () => {
	const h = harness(),
		p = h.player();
	h.eligible(p);
	Object.assign(h.c, {
		character_slots: G.character_slots,
		calculate_item_properties: G.calculate_item_properties,
		goldm: 1,
		luckm: 1,
		xpm: 1,
		perfc: { cps: 0 },
		recalculate_vxy() {},
		achievement_logic_level() {},
		realm_broadcast() {},
	});
	const source = read("node/server.js"),
		start = source.indexOf("var stat_to_attr =");
	vm.runInContext(source.slice(start, source.indexOf("function calculate_player_stats", start)), h.c);
	load(h.c, "node/server.js", ["calculate_player_stats", "calculate_common_stats"]);
	Object.assign(p, { damage_type: "physical", citems: [], targets_p: 0, targets_m: 0, targets_u: 0 });
	h.c.calculate_player_stats(p);
	assert.equal(p.xpm, 1);
	assert.equal(p.goldm, 1);
	assert.equal(p.luckm, 1);
	p.p.max_xp_multiplier = 15;
	p.xp = G.levels[p.level];
	h.c.calculate_player_stats(p);
	assert.equal(p.p.max_xp_multiplier, 1);
	p.xp = G.levels[p.level] - 100;
	const below80 = h.monster(p, { hp: 0 });
	h.c.encouragement_points(below80, p, 1000);
	p.xp += h.c.encouragement_xp(p, below80, 100, 1);
	h.c.calculate_player_stats(p);
	assert.equal(p.xp, 1400);
	assert.equal(p.p.max_xp_multiplier, 15);
	p.level = 79;
	p.xp = G.levels[79] - 100;
	p.max_xp = G.levels[79];
	h.c.encouragement_update(p, true);
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, p, 1000);
	p.xp += h.c.encouragement_xp(p, m, 100, 1);
	h.c.calculate_player_stats(p);
	assert.equal(p.level, 80);
	assert.equal(p.xp, 200);
	assert.equal(p.p.max_xp_multiplier, 3);
	assert(p.p.encouragement_reached80);
	assert.equal(p.s.encouragement_new.xp_multiplier, 1);
	const nextKill = h.monster(p, { hp: 0 });
	h.c.encouragement_points(nextKill, p, 1000);
	assert.equal(h.c.encouragement_xp(p, nextKill, 100, 1), 300);
});

test("group history survives removing all characters and losing every in-memory cache", async () => {
	const h = harness(),
		old = h.player("Old", { pid: "same", created: h.now() - 500 * day });
	h.setRecords([h.record(old)]);
	assert(await h.c.encouragement_login(old, new Date(h.now())));
	delete h.c.players.Old;
	h.c.encouragement_groups.clear();
	const newcomer = h.player("Replacement", { pid: "same" });
	h.setRecords([h.record(newcomer)]);
	assert(await h.c.encouragement_login(newcomer, new Date(h.now())));
	assert(!newcomer.s.encouragement_new);
	assert(!newcomer.s.encouragement_returning);
	assert(newcomer.s.encouragement_lonewolf);
	assert.equal(h.histories.size, 1);
});

test("removing the recently active character cannot fake months away, including after a long session", async () => {
	const h = harness(),
		active = h.player("Active", { pid: "same", created: h.now() - 500 * day });
	h.setRecords([h.record(active)]);
	assert(await h.c.encouragement_login(active, new Date(h.now())));
	h.time(h.now() + 120 * day);
	h.setRecords([h.record(active)]);
	await h.c.encouragement_load(active);
	delete h.c.players.Active;
	h.c.encouragement_groups.clear();
	const alt = h.player("Dormant", { pid: "same", created: h.now() - 400 * day });
	h.setRecords([h.record(alt)]);
	assert(await h.c.encouragement_login(alt, new Date(h.now() - 120 * day)));
	assert(!alt.s.encouragement_returning);
	assert(!alt.s.encouragement_new);
});

test("durable history retains a genuine return window after its returning character is removed", async () => {
	const h = harness(),
		old = h.player("Return", { pid: "same", created: h.now() - 500 * day });
	h.setRecords([h.record(old)]);
	assert(await h.c.encouragement_login(old, new Date(h.now() - 120 * day)));
	const until = old.p.encouragement.return_until;
	h.c.encouragement_groups.clear();
	delete h.c.players.Return;
	h.time(h.now() + day);
	const replacement = h.player("Replacement", { pid: "same" });
	h.setRecords([h.record(replacement)]);
	assert(await h.c.encouragement_login(replacement, new Date(h.now())));
	assert.equal(replacement.p.encouragement.return_until, until);
	assert(replacement.s.encouragement_returning);
	assert(!replacement.s.encouragement_new);
});

test("routine sync and full saves preserve XP guards without replacing unrelated persistent data", () => {
	const h = harness(),
		p = h.player();
	load(h.c, "node/server.js", ["player_to_server", "sync_entity"]);
	p.q = {};
	p.p.max_xp_multiplier = 15;
	p.p.encouragement_reached80 = true;
	const entity = { info: { p: { existing_reward: true } } };
	const snapshot = h.c.player_to_server(p, "sync");
	assert(!snapshot.p);
	h.c.sync_entity(entity, snapshot);
	assert.deepEqual(plain(entity.info.p), {
		existing_reward: true,
		max_xp_multiplier: 15,
		encouragement_reached80: true,
	});
	p.p.max_xp_multiplier = 1;
	h.c.sync_entity(entity, h.c.player_to_server(p, "sync"));
	assert.equal(entity.info.p.max_xp_multiplier, 1);
	assert(entity.info.p.encouragement_reached80);
	p.p.existing_reward = true;
	h.c.sync_entity(entity, h.c.player_to_server(p));
	assert.equal(entity.info.p.max_xp_multiplier, 1);
	assert(entity.info.p.encouragement_reached80 && entity.info.p.existing_reward);
});

test("forged property packets cannot change PID, contribution, conditions or XP safeguards", () => {
	const h = harness(),
		p = h.player("Hero", { pid: "verified" });
	h.eligible(p);
	p.p.max_xp_multiplier = 15;
	const before = plain({ p: p.p, s: p.s, encouragement: p.encouragement });
	h.c.socket = p.socket;
	socketHandler(
		h.c,
		"property",
	)({
		pid: "new",
		owner: "other",
		p: { max_xp_multiplier: 1 },
		s: { encouragement_new: { luck_multiplier: 1000 } },
		contribution_total: 0,
		encouragement: { totals: { gold: 1000, xp: 1000, luck: 1000 } },
	});
	assert.equal(p.pid, "verified");
	assert.equal(p.owner, "US_Hero");
	assert.deepEqual(plain({ p: p.p, s: p.s, encouragement: p.encouragement }), before);
});

test("a failed history write or realm lookup cannot admit a character with unchecked bonuses", async () => {
	for (const failure of ["history", "realm"]) {
		const h = harness(),
			p = h.player();
		h.c.log_trace = () => {};
		h.setRecords([h.record(p), h.record(p, { _id: "CH_remote", server: "SR_US1" })]);
		if (failure === "history") {
			const collection = h.c.db.collection;
			h.c.db.collection = (name) =>
				name === "mark"
					? {
							findOneAndUpdate: async () => {
								throw Error("unavailable");
							},
						}
					: collection(name);
		} else
			h.c.get = async () => {
				throw Error("unavailable");
			};
		assert.equal(await h.c.encouragement_login(p, new Date(h.now())), false);
	}
});

test("a finalized personal receipt is consumed once, even if the completion helper is retried", () => {
	const h = harness(),
		p = h.player();
	h.eligible(p);
	h.c.D.drops.monsters.goo = [[1, "ringsj"]];
	const m = h.monster(p, { hp: 0 });
	h.c.encouragement_points(m, p, 1000);
	h.c.drop_something(p, m);
	const chest = Object.values(h.c.chests)[0];
	const result = { id: chest.id, goldm: 1, opener: p.name, items: [] };
	h.c.encouragement_loot(chest, result, [p.name]);
	h.c.encouragement_loot(chest, result, [p.name]);
	assert.equal(h.inventory.get(p.real_id).length, 1);
	assert.equal(result.items.length, 1);
	assert.equal(p.gold, 14000);
});

test("NPC and unknown damage stays in the denominator without granting player bonuses", () => {
	const h = harness(),
		p = h.player(),
		m = h.monster(p);
	h.eligible(p);
	h.c.encouragement_points(m, { real_id: "npc", is_player: true, is_npc: true }, 900);
	h.c.encouragement_points(m, null, 90);
	h.c.encouragement_points(m, p, 10);
	assert.equal(m.contribution_total, 1000);
	assert.equal(Object.keys(m.contributions).length, 1);
	assert.equal(h.c.encouragement_share(p, m).luck, 0.14);
});
