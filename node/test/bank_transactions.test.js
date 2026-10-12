const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load, socketHandler, transactions } = require("./helpers/server_vm");

function setup({ locked = false, missingOwner = false, beforeCommit } = {}) {
	let operation = 0;
	const events = [],
		mounted = [];
	const owner = {
		_id: "US_owner",
		server: locked ? "SR_other" : "",
		mounted_to: locked ? "Occupant" : "",
		info: { gold: 1000, items0: [{ name: "rare", level: 9 }], rewards: [] },
	};
	const makePlayer = (name) => ({
		_id: name,
		real_id: "CH_" + name,
		name,
		owner: owner._id,
		secret: "fixture-session-" + name,
		gold: 100,
		items: [{ name: "sword", level: 8 }],
		s: {},
		slots: {},
		level: 50,
		xp: 300,
		hp: 100,
		mp: 100,
		x: 1,
		y: 2,
		map: "main",
		in: "main",
		p: {},
		mounting: new Date(),
		mount_to: "bank",
		socket: { id: name, emit: (event, data) => events.push({ name, event, data }), disconnect() {} },
	});
	const a = makePlayer("A"),
		b = makePlayer("B");
	const docs = [a, b].map((p) => ({
		_id: p.real_id,
		owner: p.owner,
		server: "SR_here",
		info: { secret: p.secret, gold: p.gold, items: structuredClone(p.items) },
	}));
	if (!missingOwner) docs.push(owner);
	const context = vm.createContext({
		console: { log() {}, error() {} },
		server_id: "SR_here",
		players: { A: a, B: b },
		server_log() {},
		init_bank: (p) => mounted.push(p.name),
		init_bank_exit() {},
		transport_player_to() {},
		resend() {},
		update_pids() {},
		player_to_server: (p) => p,
		randomStr: () => "fixture-bank-operation-" + ++operation,
	});
	const store = transactions(context, docs, beforeCommit);
	load(context, "node/logic/character_sessions.js", ["owns_character_session", "character_save_tx"]);
	load(context, "node/server.js", ["sync_entity", "mount_call", "unmount_call"]);
	return { context, a, b, events, mounted, ...store };
}

test("a rejected bank mount preserves its occupant without any currency, inventory, or lock writes", async () => {
	const s = setup({ locked: true });
	const before = structuredClone(s.records);
	await s.context.mount_call(s.a);
	assert.deepEqual(s.records, before);
	assert.equal(s.stats.writes, 0);
	assert.equal(s.stats.commits, 0);
	assert.equal(s.a.user, undefined);
	assert.equal(s.mounted.length, 0);
	assert.equal(s.events[0].data.reason, "already_in_bank");
	assert.equal(s.events[0].data.name, "Occupant");
	assert.equal(s.a.mount_call, undefined);
	assert.equal(s.a.mounting, undefined);
});

test("missing owners and departed characters fail closed", async () => {
	for (const missingOwner of [true, false]) {
		const s = setup({ missingOwner });
		if (!missingOwner) s.records.get(s.a.real_id).server = "SR_elsewhere";
		const before = structuredClone(s.records);
		await s.context.mount_call(s.a);
		assert.deepEqual(s.records, before);
		assert.equal(s.stats.writes, 0);
		assert.equal(s.a.user, undefined);
		assert.equal(s.events[0].data.reason, missingOwner ? "already_in_bank" : "character_gone");
		assert.ok(s.events[0].data.name == null);
	}
});

test("simultaneous bank mounts grant one character the bank and reject the competing character after retry", async () => {
	const s = setup();
	await Promise.all([s.context.mount_call(s.a), s.context.mount_call(s.b)]);
	const winners = [s.a, s.b].filter((p) => p.user);
	assert.equal(winners.length, 1);
	assert.equal(s.stats.commits, 1);
	assert.equal(s.stats.writes, 2);
	assert.ok(s.stats.aborts >= 1);
	assert.equal(s.records.get("US_owner").mounted_to, winners[0]._id);
	assert.equal(s.events.find((e) => e.data.reason === "already_in_bank").data.name, winners[0]._id);
	assert.equal(s.records.get("US_owner").info.gold, 1000);
	assert.equal(s.records.get("US_owner").info.items0.length, 1);
	for (const p of [s.a, s.b]) assert.equal(s.records.get(p.real_id).info.gold, 100);
});

test("mount retries publish a bank view only after commit, and exhaustion never publishes it", async () => {
	for (const failures of [1, 6]) {
		let attempts = 0;
		const s = setup({
			beforeCommit({ conflict }) {
				if (++attempts <= failures) throw conflict();
			},
		});
		await s.context.mount_call(s.a);
		assert.equal(s.stats.sessions, failures === 6 ? 6 : 2);
		assert.equal(s.stats.commits, failures === 6 ? 0 : 1);
		assert.equal(s.mounted.length, failures === 6 ? 0 : 1);
		assert.equal(Boolean(s.a.user), failures !== 6);
		assert.equal(s.records.get("US_owner").info.gold, 1000);
		assert.equal(s.records.get("CH_A").info.gold, 100);
		assert.equal(s.records.get("US_owner").info.items0.length, 1);
	}
});

test("a bank withdrawal followed by an unmount retry saves each gold and item transfer once", async () => {
	let failNext = false;
	const s = setup({
		beforeCommit({ conflict }) {
			if (failNext) {
				failNext = false;
				throw conflict();
			}
		},
	});
	await s.context.mount_call(s.a);
	s.a.user.gold -= 25;
	s.a.gold += 25;
	s.a.items.push(s.a.user.items0.pop());
	s.a.unmounting = new Date();
	failNext = true;
	await s.context.unmount_call(s.a);
	const owner = s.records.get("US_owner"),
		character = s.records.get("CH_A");
	assert.equal(owner.server, "");
	assert.equal(owner.mounted_to, "");
	assert.equal(owner.info.gold + character.info.gold, 1100);
	assert.equal(owner.info.gold, 975);
	assert.equal(character.info.gold, 125);
	assert.equal(owner.info.items0.length, 0);
	assert.equal(character.info.items.filter((i) => i.name === "rare").length, 1);
	assert.equal(s.stats.commits, 2);
	assert.equal(s.a.user, null);
});

test("bank mount keeps every existing in-flight operation guard", async () => {
	for (const flag of ["dc", "mount_call", "unmount_call", "sync_call", "stop_call"]) {
		const s = setup();
		s.a[flag] = true;
		await s.context.mount_call(s.a);
		assert.equal(s.stats.sessions, 0, flag);
		assert.equal(s.a.user, undefined, flag);
	}
});

function transportSetup(user, document) {
	const sent = [],
		failures = [];
	let resolveRead;
	const read = new Promise((resolve) => {
		resolveRead = () => resolve(document);
	});
	const socket = { id: "A", emit: (event, data) => sent.push({ event, data }) };
	const player = { socket, user, map: "bank", in: "bank", owner: "US_owner", s: {}, targets: 0 };
	const state = { mounts: 0, moves: 0, reads: 0 };
	const context = vm.createContext({
		console,
		socket,
		players: { A: player },
		gameplay: "normal",
		G: {
			maps: {
				bank: { ref: {}, spawns: [[0, 0]], doors: [[0, 0, 1, 1, "bank_b", 0, 0, "ulocked"]] },
				bank_b: { mount: true },
			},
		},
		instances: { bank_b: { allow: true, mount: true } },
		B: { door_dist: 100 },
		can_walk: () => true,
		distance: () => 0,
		fail_response: (reason) => failures.push(reason),
		success_response() {},
		add_call_cost() {},
		decay_s() {},
		sync_loop: () => state.mounts++,
		transport_player_to: () => state.moves++,
		resend() {},
		future_ms: () => new Date(),
		get_kind_from_id: () => "user",
		db: {
			collection: () => ({
				findOne() {
					state.reads++;
					return read;
				},
			}),
		},
	});
	return { player, context, state, sent, failures, resolveRead, handler: socketHandler(context, "transport") };
}

test("missing bank unlocks deny entry without mounting, saving, or granting gold/items", () => {
	for (const unlocked of [undefined, null, {}, { bank_b: false }]) {
		const user = { gold: 200, items0: [{ name: "rare" }], unlocked };
		const s = transportSetup(user);
		s.handler({ to: "bank_b" });
		assert.deepEqual(s.failures, ["transport_cant_locked"]);
		assert.deepEqual(s.state, { mounts: 0, moves: 0, reads: 0 });
		assert.equal(user.gold, 200);
		assert.equal(user.items0.length, 1);
	}
});

test("unmounted bank entry still requires the database unlock and serializes repeated checks", async () => {
	for (const unlocked of [false, true]) {
		const s = transportSetup(null, { info: { unlocked: { bank_b: unlocked } } });
		s.handler({ to: "bank_b" });
		s.handler({ to: "bank_b" });
		assert.deepEqual(s.failures, ["bank_opi"]);
		assert.equal(s.state.reads, 1);
		assert.equal(s.state.mounts, 0);
		s.resolveRead();
		await new Promise(setImmediate);
		assert.equal(s.state.mounts, unlocked ? 1 : 0);
		assert.equal(s.player.unlock_checking, false);
		if (!unlocked) assert.equal(s.sent[0].data.response, "transport_cant_locked");
	}
});

test("an already unlocked bank floor remains accessible without another mount", () => {
	const s = transportSetup({ unlocked: { bank_b: true } });
	s.handler({ to: "bank_b" });
	assert.deepEqual(s.failures, []);
	assert.deepEqual(s.state, { mounts: 0, moves: 1, reads: 0 });
});

test("disconnect during the existing unlock read cannot mount a bank", async () => {
	const s = transportSetup(null, { info: { unlocked: { bank_b: true } } });
	s.handler({ to: "bank_b" });
	delete s.context.players.A;
	s.resolveRead();
	await new Promise(setImmediate);
	assert.equal(s.state.mounts, 0);
	assert.equal(s.player.user, null);
});

function inventorySetup() {
	const G = require("./helpers/design"),
		events = [],
		replies = [];
	const socket = { id: "A", calls: [], emit: (event, data) => events.push({ event, data: structuredClone(data) }) };
	const player = {
		id: "A",
		name: "A",
		type: "merchant",
		socket,
		owner: "US_owner",
		map: "bank",
		in: "bank",
		level: 20,
		xp: 0,
		hp: 100,
		mp: 100,
		gold: 100,
		cash: 0,
		items: Array(42).fill(null),
		slots: {},
		cslots: {},
		s: {},
		p: {},
		user: { gold: 1000, items0: [] },
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
	};
	const context = vm.createContext({
		...G,
		G,
		console,
		socket,
		current_socket: socket,
		players: { A: player },
		mode: {},
		gameplay: "normal",
		goldm: 1,
		luckm: 1,
		xpm: 1,
		perfc: { cps: 0 },
		call_modifier: 1,
		add_call_cost() {},
		market_patron_observe() {},
		recalculate_vxy() {},
		server_log() {},
		fail_response: (reason) => replies.push({ failed: true, reason }),
		success_response: (data) => replies.push({ success: true, ...structuredClone(data) }),
	});
	const source = read("node/server.js"),
		functions = read("node/server_functions.js");
	vm.runInContext(
		source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function calculate_player_stats")),
		context,
	);
	vm.runInContext(
		functions.slice(functions.indexOf("var item_p_ignore ="), functions.indexOf("function cache_item(")),
		context,
	);
	load(context, "js/old_common_functions.js", ["can_stack", "can_add_item"]);
	load(context, "node/server_functions.js", ["cache_item", "init_bank", "get_call_cost", "anniversary_deliver"]);
	load(context, "node/server.js", [
		"calculate_player_stats",
		"calculate_common_stats",
		"player_to_client",
		"resend",
		"create_new_item",
		"add_item",
		"bank_add_item",
		"consume",
		"consume_one",
	]);
	function refresh() {
		player.citems = player.items.map((item) => context.cache_item(item));
		context.init_bank(player);
		context.calculate_player_stats(player);
	}
	refresh();
	return {
		context,
		player,
		events,
		replies,
		refresh,
		bank: socketHandler(context, "bank"),
		activate: socketHandler(context, "activate"),
	};
}

test("anniversary overflow can be banked without selecting or losing the last normal item", () => {
	const h = inventorySetup(),
		p = h.player;
	p.items = Array.from({ length: 42 }, () => ({ name: "coat", level: 0 }));
	p.items[41].level = 9;
	h.refresh();
	h.context.anniversary_deliver(p, ["slice_strawberry", "anniversarygift"]);
	assert.equal(p.items.length, 44);
	assert.equal(p.esize, -2);
	for (const [inv, name] of [
		[42, "slice_strawberry"],
		[43, "anniversarygift"],
	]) {
		h.bank({ operation: "swap", pack: "items0", inv, str: -1 });
		assert.equal(h.replies.at(-1).inv, inv);
		assert.equal(p.user.items0.at(-1).name, name);
		assert.equal(p.items[41].level, 9);
	}
	assert.equal(p.items.length, 42, "empty overflow rows disappear after banking");
	assert.equal(p.esize, 0);
	assert.equal(p.user.items0.length, 2);
	assert.equal(h.events.at(-1).data.items.length, 42);
});

test("manual bank swaps use the selected overflow item and preserve both items", () => {
	const h = inventorySetup(),
		p = h.player;
	p.items[41] = { name: "coat", level: 9 };
	p.items[42] = { name: "anniversarygift", q: 3 };
	p.user.items0[5] = { name: "hpot0", q: 10 };
	h.refresh();
	h.bank({ operation: "swap", pack: "items0", inv: "42", str: "5" });
	assert.equal(p.user.items0[5].name, "anniversarygift");
	assert.equal(p.user.items0[5].q, 3);
	assert.equal(p.items[42].name, "hpot0");
	assert.equal(p.items[41].level, 9);
	assert.equal(h.replies.at(-1).inv, 42);
	h.bank({ operation: "swap", pack: "items0", inv: 42, str: 5 });
	assert.equal(p.items[42].name, "anniversarygift");
	assert.equal(p.user.items0[5].name, "hpot0");
});

test("banking rejects invalid indices and empty overflow destinations without changing items", () => {
	for (const [inv, str] of [
		[-2, 0],
		[1000000, 0],
		[42, 0],
		[0, 42],
		[0, -2],
		[0.5, 0],
		["0oops", 0],
		[null, 0],
		[[], 0],
		[Infinity, 0],
		[-1, -1],
	]) {
		const h = inventorySetup(),
			p = h.player;
		p.items[0] = { name: "coat", level: 9, v: "kept", m: "kept" };
		p.items[43] = { name: "anniversarygift", q: 1 };
		p.user.items0[0] = { name: "hpot0", q: 10 };
		h.refresh();
		const before = JSON.stringify([p.items, p.user, p.citems, p.cuser]);
		h.bank({ operation: "swap", pack: "items0", inv, str });
		assert.equal(h.replies.at(-1).failed, true, JSON.stringify([inv, str]));
		assert.equal(JSON.stringify([p.items, p.user, p.citems, p.cuser]), before);
	}
});

test("bank retrieval cannot add capacity while overflow is present, but existing stacks still work", () => {
	const h = inventorySetup(),
		p = h.player;
	p.items = Array.from({ length: 43 }, () => ({ name: "coat", level: 0 }));
	p.items[0] = null;
	p.items[42] = { name: "hpot0", q: 3 };
	p.user.items0 = [
		{ name: "hpot0", q: 2 },
		{ name: "anniversarygift", q: 1 },
	];
	h.refresh();
	assert.equal(p.esize, 0);
	h.bank({ operation: "swap", pack: "items0", inv: 0, str: 1 });
	assert.equal(h.replies.at(-1).reason, "inventory_full");
	assert.equal(p.items[0], null);
	h.bank({ operation: "swap", pack: "items0", inv: -1, str: 0 });
	assert.equal(p.items[42].q, 5);
	assert.equal(p.items[0], null);
	assert.equal(p.user.items0[0], null);
	assert.equal(p.esize, 0);
});

test("failed bank deposits leave overflow rewards and their metadata intact", () => {
	const h = inventorySetup(),
		p = h.player;
	p.items[42] = { name: "anniversarygift", q: 1, v: "kept", m: "kept" };
	p.user.items0 = Array.from({ length: 42 }, () => ({ name: "coat", level: 0 }));
	h.refresh();
	const before = JSON.stringify([p.items, p.user, p.citems, p.cuser]);
	h.bank({ operation: "swap", pack: "items0", inv: 42, str: -1 });
	assert.equal(h.replies.at(-1).reason, "storage_full");
	assert.equal(JSON.stringify([p.items, p.user, p.citems, p.cuser]), before);
});

test("both floor keys publish the free bank pack immediately, preserving any existing contents", () => {
	for (const [key, floor, pack] of [
		["bkey", "bank_b", "items8"],
		["ukey", "bank_u", "items24"],
	]) {
		for (const existing of [false, true]) {
			const h = inventorySetup(),
				p = h.player;
			p.items[0] = { name: key, q: 2 };
			if (existing) p.user[pack] = [{ name: "coat", level: 9, l: "l" }];
			h.refresh();
			h.activate({ num: 0 });
			assert(p.user.unlocked[floor]);
			assert.equal(p.items[0].q, 1);
			const packet = h.events.findLast((event) => event.event === "player").data;
			assert.deepEqual(packet.user[pack], structuredClone(p.user[pack]));
			assert.equal(packet.user[pack].length, existing ? 1 : 0);
			p.map = floor;
			h.bank({ operation: "swap", pack, inv: 0, str: -1 });
			assert.equal(h.replies.at(-1).success, true, "free pack works without leaving the bank");
			assert.equal(p.user[pack].at(-1).name, key);
			if (existing) assert.equal(p.user[pack][0].level, 9);
		}
	}
});

test("automatic deposits retain normal stacking and strip PvP metadata only on a successful transfer", () => {
	const h = inventorySetup(),
		p = h.player;
	p.items[42] = { name: "anniversarygift", q: 2, v: "pvp", m: "luck" };
	p.user.items0 = Array.from({ length: 42 }, () => ({ name: "coat", level: 0 }));
	p.user.items0[7] = { name: "anniversarygift", q: 3 };
	h.refresh();
	h.bank({ operation: "swap", pack: "items0", inv: 42 });
	assert.equal(h.replies.at(-1).str, 7);
	assert.equal(p.user.items0[7].q, 5);
	assert.equal(p.user.items0[7].v, undefined);
	assert.equal(p.user.items0[7].m, undefined);
	assert.equal(p.user.items0.length, 42);
	assert.equal(p.items.length, 42);
});

test("overflow deposits still require an owned pack on the mounted floor and an unblocked item", () => {
	for (const change of [
		(p) => {
			p.user = null;
		},
		(p) => {
			p.mounting = new Date();
		},
		(p) => {
			p.unmounting = new Date();
		},
		(p) => {
			p.map = "bank_b";
		},
		(p) => {
			delete p.user.items0;
		},
		(p) => {
			p.items[42].b = true;
		},
		(p) => {
			p.items[42].name = "placeholder";
		},
	]) {
		const h = inventorySetup(),
			p = h.player;
		p.items[42] = { name: "anniversarygift", q: 1 };
		h.refresh();
		change(p);
		const before = JSON.stringify([p.items, p.user]);
		h.bank({ operation: "swap", pack: "items0", inv: 42, str: -1 });
		assert.equal(h.replies.at(-1).failed, true);
		assert.equal(JSON.stringify([p.items, p.user]), before);
	}
});

test("bank keys still require the mounted bank and cannot consume a second key for an unlocked floor", () => {
	for (const user of [null, { gold: 1000, items0: [], unlocked: { bank_b: true } }]) {
		const h = inventorySetup(),
			p = h.player;
		p.items[0] = { name: "bkey", q: 2 };
		h.refresh();
		p.user = user;
		h.activate({ num: 0 });
		assert.equal(p.items[0].q, 2);
		assert.equal(h.events.at(-1).data, user ? "already_unlocked" : "only_in_bank");
	}
});
