const assert = require("node:assert/strict");
const vm = require("node:vm");
const test = require("node:test");
const { read, load, socketHandler, transactions } = require("./helpers/server_vm");

const flush = async () => {
	for (let i = 0; i < 8; i++) await new Promise(setImmediate);
};
const deferred = () => {
	let resolve, reject;
	const promise = new Promise((a, b) => {
		resolve = a;
		reject = b;
	});
	return { promise, resolve, reject };
};

function fixture(beforeCommit) {
	const events = [],
		timers = new Set();
	let serial = 0;
	const owner = {
		_id: "US_fixture",
		created: new Date(2018, 0, 1),
		server: "",
		mounted_to: "",
		info: { auths: ["fixture"], verified: 1, gold: 1000, items0: [{ name: "ring", level: 2 }] },
	};
	const entity = {
		_id: "CH_fixture",
		owner: owner._id,
		name: "fixture",
		type: "merchant",
		level: 1,
		created: new Date(2018, 0, 1),
		online: false,
		server: "",
		last_sync: new Date(0),
		info: {
			name: "Fixture",
			map: "main",
			in: "main",
			x: 0,
			y: 0,
			gold: 100,
			items: [{ name: "sword", level: 8 }],
			slots: {},
			p: { dt: {} },
		},
	};
	const c = vm.createContext({
		performance,
		console: { log() {}, error() {} },
		players: {},
		sockets: {},
		observers: {},
		dc_players: {},
		name_to_id: {},
		id_to_id: {},
		normalize_user_id: (v) => v,
		gameplay: "normal",
		server: { live: true },
		server_id: "SR_fixture",
		max_players: 100,
		randomStr: () => "fixture-session-" + ++serial,
		get: async () => null,
		get_characters: async () => [],
		get_user_data: async () => ({ info: {} }),
		send_tracktrix_mail: async () => undefined,
		get_ip_server: () => "127.0.0.1",
		get_ip_info: async () => null,
		gf: (e, k, fallback) => (e.info && e.info[k] !== undefined ? e.info[k] : fallback),
		G: { classes: { merchant: { damage_type: "physical" } }, maps: { main: { spawns: [[0, 0]] } }, skills: {} },
		B: { start_map: "main", vision: [500, 500] },
		dbase: {},
		really_old: new Date(0),
		keys: { BOT_MASTER: "fixture-disabled" },
		mode: {},
		Dev: false,
		future_ms: (ms) => new Date(Date.now() + ms),
		instances: { main: { allow: true, players: {}, observers: {}, info: {} } },
		server_log() {},
		log_trace() {},
		init_player() {},
		encouragement_login: async () => true,
		encouragement_identity: (p) => ({ key: p.owner }),
		encouragement_update() {},
		resume_instance() {},
		pmap_add() {},
		cache_player_items() {},
		invincible_logic() {},
		serverhop_logic() {},
		realmfatigue_logic() {},
		calculate_player_stats() {},
		is_player_allowed: () => true,
		server_information: { remember() {} },
		player_to_client: () => ({}),
		broadcast_e() {},
		E: {},
		S: {},
		D: { base_gold: 1 },
		send_all_xy: () => ({ players: [], monsters: [] }),
		add_event() {},
		total_players: 0,
		max: Math.max,
		ceil: Math.ceil,
		defeat_player() {},
		xy_emit() {},
		pmap_remove() {},
		restore_state() {},
		init_bank() {},
		init_bank_exit() {},
		transport_player_to() {},
		resend() {},
		update_pids() {},
	});
	const store = transactions(c, [owner, entity], beforeCommit);
	c.setTimeout = (callback, delay) => {
		if (delay === 60000) {
			const timer = { callback };
			timers.add(timer);
			return timer;
		}
		return setImmediate(callback);
	};
	c.clearTimeout = (timer) => {
		timers.delete(timer);
	};
	vm.runInContext(read("node/logic/character_sessions.js"), c);
	c.tavern = {};
	load(c, "node/logic/tavern_poker.js", [
		"tavern_poker_recover",
		"tavern_poker_seat_by_id",
		"tavern_poker_table",
		"tavern_poker_source_live",
	]);
	load(c, "adventure_functions.js", ["msince", "hsince"]);
	load(c, "node/server_functions.js", ["delete_observer", "init_player_exit"]);
	load(c, "node/server.js", ["sync_entity", "sync_loop", "mount_call", "unmount_call", "sync_call", "stop_call"]);
	c.player_to_server = (p) => ({ ...p });
	function connection() {
		const socket = {
			id: "socket-" + ++serial,
			connected: true,
			emit(event, data) {
				events.push({ socket: socket.id, event, data });
			},
		};
		c.socket = socket;
		c.sockets[socket.id] = socket;
		c.observers[socket.id] = { id: "observer-" + socket.id, in: "main" };
		const handlers = {};
		for (const event of ["auth", "disconnect", "loaded"]) {
			const callback = socketHandler(c, event);
			// Keep the fixture's active connection aligned with the captured socket.
			handlers[event] = (data) => {
				c.socket = socket;
				return callback(data);
			};
		}
		socket.disconnect = () => {
			if (!socket.connected) return;
			socket.connected = false;
			handlers.disconnect();
		};
		return { socket, ...handlers, data: { user: owner._id, character: entity._id, auth: "fixture" } };
	}
	const conn = connection();
	return {
		c,
		events,
		timers,
		...store,
		...conn,
		connection,
		character: () => store.records.get(entity._id),
		owner: () => store.records.get(owner._id),
	};
}

function publish(f) {
	const e = f.character();
	e.server = f.c.server_id;
	e.online = true;
	e.info.secret = "current-fixture-session";
	const p = {
		...structuredClone(e),
		...structuredClone(e.info),
		_id: e._id,
		real_id: e._id,
		owner: e.owner,
		socket: f.socket,
		last: {},
		p: { dt: {} },
		q: {},
		bets: {},
		s: {},
		last_sync: new Date(),
	};
	f.c.players[f.socket.id] = p;
	f.c.instances.main.players[(p.id = p.name)] = p;
	delete f.c.observers[f.socket.id];
	return p;
}

test("gift mail starts after login succeeds and a mail failure cannot cancel the character", async () => {
	const f = fixture(),
		pending = deferred();
	let called = false;
	f.c.send_tracktrix_mail = (owner, name) => {
		called = true;
		assert.equal(owner._id, f.owner()._id);
		assert.ok(name);
		assert.ok(f.events.some((event) => event.event === "start"));
		return pending.promise;
	};
	await f.auth(f.data);
	assert.ok(called);
	assert.equal(f.c.total_players, 1);
	pending.reject(new Error("fixture mail failure"));
	await flush();
	assert.ok(f.c.players[f.socket.id]);
	assert.equal(f.socket.connected, true);
	assert.ok(!f.events.some((event) => event.event === "game_error"));
});

for (const stage of [
	"get_characters",
	"get_user_data",
	"get_ip_info",
	"init_player",
	"cache_player_items",
	"calculate_player_stats",
	"player_to_client",
	"send_all_xy",
]) {
	test("login exception at " + stage + " releases exactly its claim and permits a clean retry", async () => {
		const f = fixture(),
			original = f.c[stage],
			before = structuredClone(f.character().info);
		f.c[stage] = () => {
			throw new Error("fixture failure");
		};
		await f.auth(f.data);
		await flush();
		assert.equal(!!f.character().server, false);
		assert.equal(!!f.character().online, false);
		assert.equal(Object.keys(f.c.dc_players).length, 0);
		assert.equal(Object.keys(f.c.players).length, 0);
		assert.equal(f.c.pending_logins.size, 0);
		assert.equal(
			f.events.some((e) => e.event === "start"),
			false,
		);
		assert.deepEqual(f.character().info.items, before.items);
		assert.equal(f.character().info.gold, before.gold);
		f.c[stage] = original;
		if (!f.socket.connected) {
			f.socket.connected = true;
			f.c.observers[f.socket.id] = { id: "observer", in: "main" };
		}
		await f.auth(f.data);
		assert.ok(f.events.some((e) => e.event === "start"));
		f.socket.disconnect();
		await flush();
		assert.equal(!!f.character().server, false);
	});
}

for (const stage of ["get_characters", "get_user_data", "get_ip_info", "encouragement_login"]) {
	for (const cancel of ["disconnect", "deadline", "shutdown"]) {
		test(cancel + " during " + stage + " prevents a late login and keeps inventory unchanged", async () => {
			const f = fixture(),
				gate = deferred(),
				entered = deferred(),
				before = structuredClone(f.character().info);
			f.c[stage] = async () => {
				entered.resolve();
				await gate.promise;
				return stage === "get_characters" ? [] : true;
			};
			const pending = f.auth(f.data);
			await entered.promise;
			assert.equal(f.character().online, true);
			if (cancel === "disconnect") f.socket.disconnect();
			if (cancel === "deadline") for (const timer of [...f.timers]) timer.callback();
			if (cancel === "shutdown") {
				f.c.server.live = false;
				f.c.retry_character_logins();
			}
			await flush();
			assert.equal(!!f.character().server, false, "detached loading can release without waiting for its read");
			gate.resolve();
			await pending;
			await flush();
			assert.equal(
				f.events.some((e) => e.event === "start"),
				false,
			);
			assert.equal(Object.keys(f.c.players).length, 0);
			assert.deepEqual(f.character().info.items, before.items);
			assert.equal(f.character().info.gold, before.gold);
			assert.equal(f.c.pending_logins.size, 0);
		});
	}
}

test("timeout while the claim is committing waits for settlement and then releases", async () => {
	const gate = deferred(),
		entered = deferred();
	let first = true;
	const f = fixture(async () => {
		if (first) {
			first = false;
			entered.resolve();
			await gate.promise;
		}
	});
	const pending = f.auth(f.data);
	await entered.promise;
	for (const timer of [...f.timers]) timer.callback();
	await flush();
	assert.equal(f.c.pending_logins.size, 1);
	gate.resolve();
	await pending;
	await flush();
	assert.equal(!!f.character().server, false);
	assert.equal(f.c.pending_logins.size, 0);
	assert.equal(
		f.events.some((e) => e.event === "start"),
		false,
	);
});

test("failed cleanup remains queued and prevents a second claim until retry succeeds", async () => {
	let fail = false;
	const f = fixture(() => {
		if (fail) throw new Error("fixture write unavailable");
	});
	f.c.get_characters = async () => {
		fail = true;
		throw new Error("fixture read unavailable");
	};
	await f.auth(f.data);
	await flush();
	assert.equal(f.character().online, true);
	assert.equal(f.c.pending_logins.size, 1);
	const sessions = f.stats.sessions;
	await f.auth(f.data);
	assert.equal(f.stats.sessions, sessions);
	fail = false;
	f.c.retry_character_logins();
	await flush();
	assert.equal(f.c.pending_logins.size, 0);
	assert.equal(!!f.character().server, false);
});

test("repeated auth and loaded packets cannot replace a pending attempt or its observer", async () => {
	const f = fixture(),
		gate = deferred(),
		entered = deferred();
	f.c.get_characters = async () => {
		entered.resolve();
		await gate.promise;
		return [];
	};
	const first = f.auth(f.data);
	await entered.promise;
	const attempt = f.socket.login_attempt,
		observer = f.c.observers[f.socket.id];
	f.loaded({});
	await f.auth(f.data);
	assert.equal(f.socket.login_attempt, attempt);
	assert.equal(f.c.observers[f.socket.id], observer);
	assert.equal(f.stats.commits, 1);
	gate.resolve();
	await first;
	assert.equal(f.events.filter((e) => e.event === "start").length, 1);
	f.loaded({});
	assert.equal(f.c.observers[f.socket.id], undefined);
	f.socket.disconnect();
	await flush();
});

test("a cancelled old continuation cannot publish over or release a replacement login", async () => {
	const f = fixture(),
		gate = deferred(),
		entered = deferred(),
		original = f.c.get_characters;
	f.c.get_characters = async () => {
		entered.resolve();
		await gate.promise;
		return [];
	};
	const first = f.auth(f.data);
	await entered.promise;
	f.socket.disconnect();
	await flush();
	f.c.get_characters = original;
	const next = f.connection();
	await next.auth(next.data);
	const stored = structuredClone(f.character());
	gate.resolve();
	await first;
	await flush();
	assert.deepEqual(f.character(), stored);
	assert.equal(f.c.players[next.socket.id].secret, stored.info.secret);
	next.socket.disconnect();
	await flush();
});

test("invalid credentials and characters never alter another session's claim", async () => {
	for (const change of [{ auth: "wrong" }, { character: "CH_missing" }, { user: "US_missing" }]) {
		const f = fixture(),
			before = structuredClone(f.records);
		await f.auth({ ...f.data, ...change });
		await flush();
		assert.deepEqual(f.records, before);
		assert.equal(f.c.pending_logins.size, 0);
	}
});

test("an old database claim cannot be taken over just because 120 minutes elapsed", async () => {
	const f = fixture();
	f.character().server = "SR_other";
	f.character().online = true;
	const before = structuredClone(f.records);
	await f.auth(f.data);
	await flush();
	assert.deepEqual(f.records, before);
	assert.ok(f.events.some((e) => e.data && e.data.reason === "ingame"));
});

test("account operations still treat stale claimed characters as in-game", () => {
	const c = vm.createContext({});
	load(c, "adventure_functions.js", ["is_in_game"]);
	assert.equal(c.is_in_game({ server: "SR_fixture", last_sync: new Date(0) }), true);
	assert.equal(c.is_in_game({ server: "SR_fixture" }), true);
	assert.equal(c.is_in_game({ server: "", last_sync: new Date() }), false);
});

for (const outcome of ["failed", "thrown"]) {
	test("a committed login with a " + outcome + " acknowledgement is safely released", async () => {
		const f = fixture(),
			tx = f.c.tx;
		let first = true;
		f.c.tx = async (...args) => {
			const result = await tx(...args);
			if (first) {
				first = false;
				if (outcome === "thrown") throw new Error("commit acknowledgement lost");
				return { failed: true, reason: "exception" };
			}
			return result;
		};
		await f.auth(f.data);
		await flush();
		assert.equal(!!f.character().server, false);
		assert.equal(f.c.pending_logins.size, 0);
		assert.equal(f.character().info.gold, 100);
		assert.equal(f.character().info.items[0].name, "sword");
		assert.equal(
			f.events.some((e) => e.event === "start"),
			false,
		);
	});
}

test("cleanup invalidates a late claim transaction even when the claim was not yet visible", async () => {
	const f = fixture(),
		old = f.c.client.startSession();
	await old.startTransaction();
	const pending = structuredClone(f.character());
	pending.online = true;
	pending.server = f.c.server_id;
	pending.info.secret = "late-session";
	old.pending.set(pending._id, pending);
	const attempt = { id: pending._id, secret: "late-session", claim_written: true, cancelled: true, socket: f.socket };
	f.c.pending_logins.set(attempt.id, attempt);
	await f.c.release_character_login(attempt);
	await assert.rejects(old.commitTransaction(), (e) => e.code === 112);
	assert.equal(!!f.character().server, false);
	assert.equal(f.c.pending_logins.size, 0);
});

test("old cleanup never releases a newer claim or writes old inventory", async () => {
	const f = fixture(),
		p = publish(f);
	p.gold = 1;
	p.items = [];
	f.character().info.gold = 999;
	f.character().info.items = [{ name: "ring", level: 7 }];
	const attempt = { id: p.real_id, secret: "old-session", claim_written: true, cancelled: true, socket: f.socket };
	await f.c.release_character_login(attempt);
	assert.equal(f.character().info.secret, p.secret);
	assert.equal(f.character().server, f.c.server_id);
	assert.equal(f.character().info.gold, 999);
	assert.equal(f.character().info.items[0].level, 7);
});

test("a second login on the same socket cannot claim a different character during loading", async () => {
	const f = fixture(),
		gate = deferred(),
		entered = deferred();
	f.c.get_characters = async () => {
		entered.resolve();
		await gate.promise;
		return [];
	};
	const pending = f.auth(f.data);
	await entered.promise;
	await f.auth({ ...f.data, character: "CH_other" });
	assert.equal(f.stats.sessions, 1);
	assert.equal(f.c.pending_logins.size, 1);
	gate.resolve();
	await pending;
	f.socket.disconnect();
	await flush();
});

test("capacity filled during loading releases the claim without publishing", async () => {
	const f = fixture();
	f.c.get_characters = async () => {
		f.c.max_players = 0;
		return [];
	};
	await f.auth(f.data);
	await flush();
	assert.equal(!!f.character().server, false);
	assert.equal(Object.keys(f.c.players).length, 0);
});

for (const event of ["start", "game_error"]) {
	test("an inline disconnect during " + event + " cleans up only once", async () => {
		const f = fixture(),
			emit = f.socket.emit;
		f.socket.emit = (name, data) => {
			emit(name, data);
			if (name === event) f.socket.disconnect();
		};
		if (event === "game_error")
			f.c.get_characters = () => {
				throw new Error("startup failed");
			};
		await f.auth(f.data);
		await flush();
		assert.equal(!!f.character().server, false);
		assert.equal(f.c.pending_logins.size, 0);
		assert.equal(Object.keys(f.c.players).length, 0);
		assert.equal(Object.keys(f.c.dc_players).length, 0);
		assert.equal(f.character().info.gold, 100);
	});
}

test("missing instance and failing activity bookkeeping cannot prevent final persistence", async () => {
	const f = fixture(),
		p = publish(f);
	p.gold = 73;
	p.items = [];
	delete f.c.instances.main;
	f.c.server_information.remember = () => {
		throw new Error("activity cache unavailable");
	};
	f.socket.disconnect();
	await flush();
	assert.equal(f.character().info.gold, 73);
	assert.deepEqual(f.character().info.items, []);
	assert.equal(!!f.character().server, false);
});

for (const operation of ["mount_call", "unmount_call", "sync_call", "stop_call"]) {
	for (const mismatch of ["secret", "server", "owner", "missing"]) {
		test(operation + " refuses a " + mismatch + " mismatch without touching gold, items, or bank", async () => {
			const f = fixture(),
				p = publish(f);
			if (operation !== "mount_call") {
				p.user = structuredClone(f.owner().info);
				f.owner().server = f.c.server_id;
				f.owner().mounted_to = p._id;
			}
			if (mismatch === "secret") f.character().info.secret = "replacement-session";
			if (mismatch === "owner") f.character().owner = "US_other";
			if (mismatch === "server") f.character().server = "SR_other";
			if (mismatch === "missing") f.records.delete(p._id);
			const before = structuredClone(f.records);
			// Keep the assertion local to this write, without triggering another logout.
			p.socket = { id: f.socket.id, emit() {}, disconnect() {} };
			await f.c[operation](p);
			assert.deepEqual(f.records, before);
			assert.equal(f.stats.writes, 0);
			assert.equal(!!p[operation], false);
		});
	}
}

test("disconnect waits for a slow sync and then saves later item and gold transfers", async () => {
	const gate = deferred(),
		entered = deferred();
	let first = true;
	const f = fixture(async () => {
		if (first) {
			first = false;
			entered.resolve();
			await gate.promise;
		}
	});
	const p = publish(f),
		save = f.c.sync_call(p);
	await entered.promise;
	p.gold -= 30;
	p.items = []; // A completed transfer after the earlier sync snapshot.
	p.last_sync = new Date(0);
	f.c.sync_loop();
	assert.equal(p.sync_call, true, "six-minute watchdog must not release an in-flight write");
	f.socket.disconnect();
	assert.equal(f.c.dc_players[p.real_id], p);
	await f.auth(f.data);
	gate.resolve();
	await save;
	f.c.sync_loop();
	await flush();
	assert.equal(f.character().info.gold, 70);
	assert.deepEqual(f.character().info.items, []);
	assert.equal(!!f.character().server, false);
	assert.equal(f.c.dc_players[p.real_id], undefined);
});

test("logout rejection releases its busy flag but retains the exact unsaved snapshot for retry", async () => {
	const f = fixture(),
		p = publish(f),
		tx = f.c.tx;
	p.gold = 43;
	p.items = [];
	f.c.tx = async () => {
		throw new Error("fixture session failure");
	};
	f.socket.disconnect();
	await flush();
	assert.equal(p.stop_call, undefined);
	assert.equal(f.c.dc_players[p.real_id], p);
	assert.equal(f.character().online, true);
	f.c.tx = tx;
	f.c.sync_loop();
	await flush();
	assert.equal(f.character().info.gold, 43);
	assert.deepEqual(f.character().info.items, []);
	assert.equal(!!f.character().server, false);
});

test("duplicate disconnects cannot refund bets twice", async () => {
	const f = fixture(),
		p = publish(f);
	p.bets = { pending: { gold: 17 } };
	f.socket.disconnect();
	f.disconnect();
	await flush();
	assert.equal(f.character().info.gold, 117);
	assert.equal(f.c.dc_players[p.real_id], undefined);
});

test("bank-lock loss never saves a withdrawn inventory without the matching bank debit", async () => {
	for (const operation of ["sync_call", "unmount_call", "stop_call"]) {
		const f = fixture(),
			p = publish(f);
		p.user = structuredClone(f.owner().info);
		p.user.gold -= 200;
		p.gold += 200;
		f.owner().server = "SR_other";
		f.owner().mounted_to = "CH_other";
		p.socket = { id: f.socket.id, emit() {}, disconnect() {} };
		const before = structuredClone(f.records);
		await f.c[operation](p);
		assert.deepEqual(f.records, before);
	}
});

test("lost unmount acknowledgement cannot write an old bank over its next occupant", async () => {
	const f = fixture(),
		p = publish(f);
	p.user = structuredClone(f.owner().info);
	f.owner().server = f.c.server_id;
	f.owner().mounted_to = p._id;
	p.user.gold -= 200;
	p.gold += 200;
	const tx = f.c.tx;
	f.c.tx = async (...args) => {
		await tx(...args);
		return { failed: true, reason: "exception" };
	};
	p.socket = { id: f.socket.id, emit() {}, disconnect() {} };
	await f.c.unmount_call(p);
	assert.ok(p.unmount_id);
	assert.equal(f.owner().info.gold, 800);
	// The next bank owner makes a separate withdrawal; the old character also sends an item.
	f.owner().server = f.c.server_id;
	f.owner().mounted_to = "CH_next";
	f.owner().info.gold = 700;
	p.gold -= 30;
	p.items = [];
	f.c.tx = tx;
	await f.c.stop_call(p);
	assert.equal(f.owner().mounted_to, "CH_next");
	assert.equal(f.owner().info.gold, 700);
	assert.equal(f.character().info.gold, 270);
	assert.deepEqual(f.character().info.items, []);
	assert.equal(!!f.character().server, false);
});

test("lost mount acknowledgement releases only its bank lock on logout", async () => {
	const f = fixture(),
		p = publish(f),
		tx = f.c.tx;
	f.c.tx = async (...args) => {
		await tx(...args);
		return { failed: true, reason: "exception" };
	};
	await f.c.mount_call(p);
	assert.equal(p.user, undefined);
	assert.equal(f.owner().mounted_to, p._id);
	f.c.tx = tx;
	await f.c.stop_call(p);
	assert.equal(f.owner().mounted_to, "");
	assert.equal(f.owner().info.gold, 1000);
	assert.equal(f.character().info.gold, 100);
});

test("missing process memory never releases an old character or bank claim", async () => {
	const f = fixture(),
		p = publish(f);
	f.character().last_sync = new Date(0);
	f.owner().server = f.c.server_id;
	f.owner().mounted_to = p.real_id;
	delete f.c.players[f.socket.id];
	delete f.c.instances.main.players[p.id];
	const before = structuredClone(f.records);
	assert.equal(typeof f.c.recover_character_session, "undefined");
	f.c.sync_loop();
	await flush();
	assert.deepEqual(f.records, before);
	const next = f.connection();
	await next.auth(next.data);
	await flush();
	assert.deepEqual(f.records, before);
	assert.equal(f.stats.writes, 0);
	assert.ok(f.events.some((e) => e.data && e.data.reason === "ingame"));
});

test("offline-server monitoring leaves character and bank ownership untouched", async () => {
	const f = fixture(),
		p = publish(f);
	f.owner().server = f.c.server_id;
	f.owner().mounted_to = p.real_id;
	const character = structuredClone(f.character()),
		owner = structuredClone(f.owner());
	f.records.set(f.c.server_id, {
		_id: f.c.server_id,
		online: true,
		updated: new Date(0),
		machine: "fixture",
		address: "fixture.invalid",
		info: { players: 1, observers: 1, total_players: 1, merchants: 1 },
	});
	const collection = f.c.db.collection;
	f.c.db.collection = (kind) => ({
		...collection(kind),
		find() {
			assert.equal(kind, "server", "monitoring must not scan character or bank claims");
			return { toArray: async () => [structuredClone(f.records.get(f.c.server_id))] };
		},
	});
	f.c.get_domain = () => ({});
	f.c.send_email = () => {};
	load(f.c, "adventure_functions.js", ["ssince"]);
	load(f.c, "crons.js", ["check_servers"]);
	await f.c.check_servers();
	assert.equal(f.records.get(f.c.server_id).online, false);
	assert.deepEqual(f.character(), character);
	assert.deepEqual(f.owner(), owner);
	assert.equal(f.stats.writes, 1);
});

test("cron registration retains server monitoring without an unstick route or job", async () => {
	const routes = new Map(),
		intervals = [];
	let monitored = 0;
	const c = vm.createContext({
		process: { env: { pm_id: "0" } },
		Prod: true,
		Staging: false,
		app: { all: (path, handler) => routes.set(path, handler) },
		setInterval: (callback) => intervals.push(callback),
		setTimeout() {},
		enforce_limitations() {},
		retry_stripe_purchases: async () => {},
		mainframe_renew_access: async () => {},
	});
	vm.runInContext(read("crons.js"), c);
	assert.equal(routes.has("/cr/unstuck"), false);
	assert.equal(typeof c.unstuck_characters, "undefined");
	assert.equal(routes.has("/cr/check_servers"), true);
	c.check_servers = async () => monitored++;
	c.verify_steam_installs = async () => {};
	for (const callback of intervals) await callback();
	assert.equal(monitored, 1);
});

test("login refunds an abandoned poker stack inside the session claim and consumes it once", async () => {
	const f = fixture();
	f.character().info.p.poker = { token: "abandoned", stack: 50, server: "SR_old", hand: "lost-hand" };
	await f.auth(f.data);
	assert.ok(f.events.some((e) => e.event === "start"));
	assert.equal(f.character().info.gold, 150);
	assert.equal(f.character().info.p.poker, undefined);
});

test("login cannot reclaim chips from a hand on another live server", async () => {
	const f = fixture();
	f.character().info.p.poker = { token: "active", stack: 50, server: "SR_old", hand: "active-hand" };
	f.records.set("SR_old", { _id: "SR_old", online: true, updated: new Date() });
	await f.auth(f.data);
	assert.ok(!f.events.some((e) => e.event === "start"));
	assert.equal(f.character().server, "");
	assert.equal(f.character().info.gold, 100);
	assert.equal(f.character().info.p.poker.stack, 50);
	assert.ok(
		f.events.some(
			(e) =>
				e.event === "game_error" &&
				e.data.reason === "poker_hand_active" &&
				e.data.phrase === "server.game_error.poker_hand_active",
		),
	);
});
