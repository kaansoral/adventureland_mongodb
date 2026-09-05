const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, socketHandler, transactions } = require("./helpers/server_vm");

function setup({ locked = false, missingOwner = false, beforeCommit } = {}) {
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
		info: { gold: p.gold, items: structuredClone(p.items) },
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
	});
	const store = transactions(context, docs, beforeCommit);
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
