const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read } = require("./helpers/server_vm");
const design = require("./helpers/design");

function fixture() {
	const packets = [],
		writes = [];
	const G = { ...design, maps: { ...design.maps, zone_test: { generated: { floor: 0 } } }, geometry: {} };
	const make = (name) => ({
		name,
		id: name,
		real_id: name,
		owner: "owner",
		map: "zone_test",
		in: "zone_test",
		x: 200,
		y: 300,
		hp: 40,
		mp: 20,
		max_hp: 100,
		max_mp: 80,
		rip: false,
		last: { attack: new Date(Date.now() + 10000) },
		s: { poisoned: { ms: 100000 } },
		p: { home: "EUI" },
		socket: { generated_protocol: 1, emit: (event, data) => packets.push({ name, event, data }) },
	});
	const a = make("A"),
		b = make("B");
	const run = {
		key: "test",
		level: 50,
		expires: Date.now() + 24000,
		floors: ["zone_test"],
		completed: [],
		exit_spawn: G.maps.main.spawns.findIndex((p) => p[0] === 816 && p[1] === 1200),
		members: [a, b].map((p) => ({ name: p.name, character: p.real_id, owner: p.owner, left: false })),
		cave: {
			gold: 1500,
			amber: 19,
			serial: 0,
			flags: {},
			actors: new Set(),
			rooms: [],
			receipts: [],
			claimed: new Set(),
		},
	};
	const entry = { record: run, floor: { definition: { generated: { floor: 0 } } }, last_occupied: Date.now() };
	const c = vm.createContext({
		G,
		Date,
		Math,
		Set,
		Map,
		Object,
		clone: structuredClone,
		Dev: false,
		Prod: true,
		server_id: "SR_EUI",
		Server: { info: { cave_boot: "boot" } },
		region: "EU",
		server_name: "I",
		TIMEO: { EU: 1 },
		generated_runs: { test: run },
		generated_maps: { zone_test: entry },
		players: { A: a, B: b },
		chests: {},
		workers: [],
		smap_data: {},
		amap_data: {},
		projectiles: {},
		instances: { zone_test: { name: "zone_test", players: { A: a, B: b }, monsters: {}, observers: {} } },
		get_player: (name) => c.players[name],
		check_player: (p) => !p.dc && !p.socket.disconnected && c.players[p.name] === p,
		can_walk: () => true,
		simple_distance: () => 0,
		safe_xy_nearby: (map, x, y) => ({ x, y }),
		cave_enter_effect: async () => {},
		xy_emit() {},
		log_trace() {},
		transport_player_to(p, map, point) {
			p.map = p.in = map;
			[p.x, p.y] = Array.isArray(point) ? point : G.maps.main.spawns[point];
		},
		player_to_client: (p) => ({ id: p.id }),
		monster_to_client: (p) => ({ id: p.id }),
		send_xy_updates() {},
		destroy_instance() {},
		db: {
			collection: () => ({
				findOne: async (query) =>
					query._id.startsWith("daily:") ? { state: "active", resets: Date.now() + 86400000 } : null,
				updateOne: async (...args) => writes.push(args),
				updateMany: async (...args) => writes.push(args),
			}),
		},
	});
	load(c, "node/logic/generated_maps.js", ["generated_disconnect"]);
	vm.runInContext(read("node/logic/instance_pause.js"), c);
	return { c, a, b, run, packets, writes };
}
function disconnect(c, p) {
	p.dc = true;
	p.socket.disconnected = true;
	delete c.players[p.name];
	delete c.instances[p.in].players[p.name];
	assert.equal(c.generated_disconnect(p), true);
}
function login(c, p) {
	delete p.dc;
	p.socket.disconnected = false;
	p.last = {};
	c.players[p.name] = p;
}

test("disconnect keeps the purse and roster; the existing enter action restores only its original character", async () => {
	const { c, a, b, run, writes, packets } = fixture();
	const expires = run.expires,
		cooldown = +a.last.attack;
	disconnect(c, a);
	assert.equal(a.map, "main");
	assert.equal(a.hp, 100, "the saved outside character is alive");
	assert.equal(run.cave.amber, 19);
	assert.equal(run.members[0].left, false);
	assert.equal(writes.length, 0, "disconnect does not release the admission lock");
	const visit = await c.cave_interaction(a, { action: "info" });
	assert.equal(visit.visit.available, false);
	assert.equal(visit.visit.resume.server, "EUI");
	assert.equal(visit.visit.resume.run, run.key);
	assert.equal(c.generated_return_run({ ...a, real_id: "new" }), undefined);
	assert.equal(c.generated_return_run({ ...a, owner: "other" }), undefined);
	login(c, a);
	a.hp = 100;
	a.mp = 80;
	a.s = { invincible: { ms: 10000 } };
	const result = await c.cave_interaction(a, { action: "enter" });
	assert.equal(result.resumed, true);
	assert.equal(result.run, run.key);
	assert.equal(result.expires, expires);
	assert.equal(a.map, "zone_test");
	assert.deepEqual([a.x, a.y, a.hp, a.mp], [200, 300, 40, 20]);
	assert.equal(+a.last.attack, cooldown, "relogin does not reset a pending skill cooldown");
	assert.ok(a.s.poisoned.ms > 0);
	assert.equal(a.s.invincible, undefined, "outside buffs do not replace the cave combat state");
	assert.equal(run.members[0].disconnected, undefined);
	assert.equal(run.cave.amber, 19);
	assert.equal(c.cave_players(run).length, 2, "cave membership does not depend on a live party");
	assert.equal(writes.length, 0, "returning does not claim another visit");
	assert.equal(b.map, "zone_test");
	assert.equal(packets.findLast((p) => p.name === "A" && p.event === "cave").data.type, "returned");
	assert.equal(packets.findLast((p) => p.name === "B" && p.event === "cave").data.type, "state");
});

test("Dorr identifies an active cave on another server and does not start a second visit", async () => {
	const { c, a } = fixture();
	disconnect(c, a);
	login(c, a);
	delete c.generated_runs.test;
	c.generated_refund_visit = async () => ({ state: "active", resets: Date.now() + 10000 });
	c.db.collection = () => ({
		findOne: async () => ({ active: true, run: "other", server: "SR_USII", expires: Date.now() + 10000 }),
	});
	const { visit } = await c.cave_interaction(a, { action: "info" });
	assert.equal(visit.resume.server, "USII");
	assert.equal(visit.resume.run, "other");
	await assert.rejects(c.cave_interaction(a, { action: "enter" }), /cave_other_server/);
	assert.equal(a.map, "main");
});

test("fallen characters return fallen, and explicit exits permanently release membership", async () => {
	const { c, a, run, writes } = fixture();
	a.rip = true;
	a.hp = 0;
	a.rip_time = new Date();
	disconnect(c, a);
	assert.equal(a.rip, false);
	login(c, a);
	await c.cave_interaction(a, { action: "enter" });
	assert.equal(a.rip, true);
	assert.equal(a.hp, 0, "reconnecting is not a free revival");
	const awards = [];
	c.cave_item = (r, token, item, q) => awards.push({ item, q });
	await c.cave_interaction(a, { action: "exit" });
	assert.equal(a.rip, false);
	assert.equal(run.members[0].left, true);
	assert.deepEqual(awards, [{ item: "cave_amber", q: 19 }]);
	assert.equal(writes.length, 1);
	assert.equal(c.generated_return_run(a), undefined);
});

test("a completely disconnected cave keeps counting down and settles once at expiry", () => {
	const { c, a, b, run } = fixture();
	const expires = run.expires;
	disconnect(c, a);
	disconnect(c, b);
	c.generated_maps_tick();
	assert.equal(c.generated_runs.test, run);
	assert.equal(run.expires, expires);
	assert.equal(run.cave.amber, 19);
	const awards = [];
	c.cave_item = (r, token, item, q) => awards.push({ item, q });
	run.expires = Date.now() - 1;
	c.generated_last_tick = 0;
	c.generated_maps_tick();
	assert.equal(c.generated_runs.test, undefined);
	assert.deepEqual(awards, [{ item: "cave_amber", q: 19 }]);
	c.generated_last_tick = 0;
	c.generated_maps_tick();
	assert.equal(awards.length, 1);
});

test("a failed return does not leave a fallen character dead outside or discard the saved cave state", async () => {
	const { c, a, run } = fixture();
	a.hp = 0;
	a.rip = true;
	disconnect(c, a);
	login(c, a);
	a.s = { invincible: { ms: 10000 } };
	c.transport_player_to = () => {
		throw Error("transport_failed");
	};
	await assert.rejects(c.cave_interaction(a, { action: "enter" }), /transport_failed/);
	assert.equal(a.map, "main");
	assert.equal(a.hp, 100);
	assert.equal(a.rip, false);
	assert.equal(a.s.invincible.ms, 10000);
	assert.equal(run.members[0].disconnected.rip, true);
	assert.equal(run.members[0].rejoining, undefined);
});

test("return admission rejects duplicate requests and a run that expires during preparation", async () => {
	const { c, a, run } = fixture();
	disconnect(c, a);
	login(c, a);
	let finish;
	c.ensure_generated_floor = () =>
		new Promise((resolve) => {
			finish = resolve;
		});
	const request = c.cave_interaction(a, { action: "enter" });
	await assert.rejects(c.cave_interaction(a, { action: "enter" }), /already_opening/);
	run.expires = Date.now() - 1;
	finish();
	await assert.rejects(request, /cave_closed/);
	assert.equal(a.map, "main");
	assert.ok(run.members[0].disconnected);
	assert.equal(run.members[0].rejoining, undefined);
	assert.equal(run.cave.amber, 19);
});

test("disconnecting the last listener releases the conversation pause", () => {
	const { c, a, b, run } = fixture();
	c.cave_pause(run, Date.now() - 1000);
	disconnect(c, a);
	assert.ok(run.paused_at);
	disconnect(c, b);
	assert.equal(run.paused_at, undefined);
	assert.equal(c.instances.zone_test.frozen, undefined);
});

test("a returning player joins an existing vote freeze only for the time spent inside", async () => {
	const { c, a, run } = fixture();
	disconnect(c, a);
	login(c, a);
	c.cave_pause(run, Date.now() - 5000);
	await c.cave_interaction(a, { action: "enter" });
	const cooldown = +a.last.attack;
	const joined = c.instances.zone_test.frozen.joined.get(a);
	c.cave_resume(run, joined + 1000);
	assert.equal(+a.last.attack, cooldown + 1000);
});
