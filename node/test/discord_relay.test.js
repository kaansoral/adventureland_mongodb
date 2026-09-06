const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const createRelay = require("../logic/discord");
const { load, socketHandler, read } = require("./helpers/server_vm");

const CHAT = "123456789012345678";
const EVENTS = "404333059018719233";
const JOINS = "839163123499794481";
const settle = () => new Promise(setImmediate);
const response = (status = 200, headers = {}, body = {}) => ({
	status,
	ok: status >= 200 && status < 300,
	headers: new Headers(headers),
	json: async () => body,
	body: { cancel: async () => {} },
});

function harness(reply = () => response(), options = {}) {
	let time = 0;
	const timers = new Map(),
		calls = [],
		warnings = [];
	const relay = createRelay({
		token: "fixture-token",
		chatChannel: CHAT,
		realm: "EU I",
		now: () => time,
		schedule(fn, ms) {
			const handle = { unref() {} };
			timers.set(handle, { fn, at: time + ms });
			return handle;
		},
		cancel: (handle) => timers.delete(handle),
		log: (message) => warnings.push(message),
		fetch: async (url, request) => {
			const call = {
				at: time,
				channel: url.split("/").at(-2),
				payload: JSON.parse(request.body),
				signal: request.signal,
			};
			calls.push(call);
			return reply(call, calls.length);
		},
		...options,
	});
	async function advance(ms) {
		const end = time + ms;
		await settle();
		for (;;) {
			const entry = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
			if (!entry || entry[1].at > end) break;
			time = entry[1].at;
			timers.delete(entry[0]);
			entry[1].fn();
			await settle();
		}
		time = end;
		await settle();
	}
	return { relay, advance, calls, warnings, timers };
}

test("existing announcement channels are preserved and public chat is batched", async () => {
	const h = harness();
	h.relay.event("A boss appeared");
	h.relay.event("Hero joined Adventure Land");
	h.relay.chat("Hero", "Hello");
	h.relay.chat("Friend", "Welcome");
	await h.advance(9999);
	assert.deepEqual(
		h.calls.map((c) => c.channel),
		[EVENTS, JOINS],
	);
	await h.advance(1);
	assert.equal(h.calls[2].channel, CHAT);
	assert.equal(h.calls[2].payload.content, "[EU I] **Hero:** Hello\n[EU I] **Friend:** Welcome");
	assert.deepEqual(h.calls[2].payload.allowed_mentions, { parse: [] });
	assert.equal(h.calls[2].payload.flags, 4);
	assert.equal(h.timers.size, 0);
});

test("disabled or unconfigured relays do not perform requests", async () => {
	for (const options of [{ enabled: false }, { token: "" }]) {
		const h = harness(undefined, options);
		assert.equal(h.relay.event("event"), false);
		assert.equal(h.relay.chat("Hero", "Hello"), false);
		await h.advance(180000);
		assert.equal(h.calls.length, 0);
	}
	for (const chatChannel of [undefined, "", "wrong", 123, EVENTS, JOINS]) {
		const h = harness(undefined, { chatChannel });
		assert.equal(h.relay.chat("Hero", "Hello"), false);
		h.relay.event("event");
		await h.advance(10000);
		assert.equal(h.calls.length, 1);
		assert.equal(h.calls[0].channel, EVENTS);
	}
});

test("player formatting cannot add lines or mentions and all batches fit Discord", async () => {
	const h = harness();
	h.relay.chat("Fake**\nName", "@everyone <@123> [link](https://example.com)\n[US I] **Admin:** hi");
	for (let i = 0; i < 3; i++) h.relay.chat("Hero", "*".repeat(1200));
	await h.advance(50000);
	assert.equal(h.calls.length, 3);
	assert.ok(h.calls[0].payload.content.includes("Fake\\*\\* Name"));
	assert.equal(h.calls.flatMap((c) => c.payload.content.split("\n")).length, 4);
	for (const call of h.calls) {
		assert.ok(call.payload.content.length <= 2000);
		assert.deepEqual(call.payload.allowed_mentions, { parse: [] });
		assert.equal(call.payload.enforce_nonce, true);
		assert.equal(call.payload.nonce.length, 24);
	}
});

test("a hanging request is aborted and cannot retain an unbounded chat queue", async () => {
	const h = harness((call, count) =>
		count === 1
			? new Promise((resolve, reject) => {
					call.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
				})
			: response(),
	);
	h.relay.event("event");
	let accepted = 0;
	for (let i = 0; i < 10000; i++) if (h.relay.chat("Hero", "message " + i)) accepted++;
	assert.equal(accepted, 100);
	assert.equal(h.calls.length, 1);
	assert.equal(h.warnings.length, 1);
	await h.advance(4999);
	assert.equal(h.calls.length, 1);
	await h.advance(1);
	assert.equal(h.calls[0].signal.aborted, true);
	await h.advance(5000);
	assert.ok(h.calls.length >= 3, "other messages continue after the timeout");
	h.relay.stop();
	assert.equal(h.timers.size, 0);
});

test("429 JSON and headers defer every channel for a global limit", async () => {
	for (const [headers, body] of [
		[{}, { retry_after: 30, global: true }],
		[{ "retry-after": "30", "x-ratelimit-global": "true" }, null],
		[{ "retry-after": "30", "x-ratelimit-scope": "global" }, {}],
	]) {
		const h = harness((call, count) => (count === 1 ? response(429, headers, body) : response()));
		h.relay.event("event");
		h.relay.event("Hero joined Adventure Land");
		h.relay.chat("Hero", "Hello");
		await h.advance(30249);
		assert.equal(h.calls.length, 1);
		await h.advance(1);
		assert.equal(h.calls.length, 2);
		assert.deepEqual(h.calls[0].payload, h.calls[1].payload);
		await h.advance(2000);
		assert.equal(h.calls.length, 4);
	}
});

test("an exhausted channel waits for reset while announcements in another channel continue", async () => {
	const h = harness((call, count) =>
		count === 1 ? response(200, { "x-ratelimit-remaining": "0", "x-ratelimit-reset-after": "15" }) : response(),
	);
	h.relay.event("first");
	h.relay.event("second");
	h.relay.event("Hero joined Adventure Land");
	await h.advance(14999);
	assert.deepEqual(
		h.calls.map((c) => c.channel),
		[EVENTS, JOINS],
	);
	await h.advance(1);
	assert.equal(h.calls[2].payload.content, "second");
});

test("transient errors retry identical nonces at most three times", async () => {
	const h = harness(() => response(503));
	h.relay.event("event");
	await h.advance(180000);
	assert.equal(h.calls.length, 3);
	assert.equal(new Set(h.calls.map((c) => c.payload.nonce)).size, 1);
	assert.equal(h.timers.size, 0);
});

test("expired batches and queued messages are discarded without replay after an outage", async () => {
	const h = harness(() => response(429, {}, { global: true, retry_after: 200 }));
	h.relay.event("event");
	h.relay.event("queued event");
	h.relay.chat("Hero", "Hello");
	await h.advance(300000);
	assert.equal(h.calls.length, 1);
	assert.equal(h.timers.size, 0);
});

test("invalid credentials stop all sends; forbidden channels do not block other announcements", async () => {
	const invalid = harness(() => response(401));
	invalid.relay.event("event");
	invalid.relay.chat("Hero", "Hello");
	await invalid.advance(20000);
	assert.equal(invalid.calls.length, 1);
	assert.equal(invalid.relay.event("later"), false);
	for (const status of [403, 404]) {
		const h = harness((call) => (call.channel === CHAT ? response(status) : response()));
		h.relay.chat("Hero", "Hello");
		await h.advance(10000);
		assert.equal(h.relay.chat("Hero", "later"), false);
		h.relay.event("event");
		await h.advance(1000);
		assert.deepEqual(
			h.calls.map((c) => c.channel),
			[CHAT, EVENTS],
		);
	}
});

test("stop aborts an active request and clears pending timers and messages", async () => {
	const h = harness(
		(call) =>
			new Promise((resolve, reject) => {
				call.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
			}),
	);
	h.relay.event("event");
	h.relay.chat("Hero", "Hello");
	h.relay.stop();
	await h.advance(180000);
	assert.equal(h.calls[0].signal.aborted, true);
	assert.equal(h.calls.length, 1);
	assert.equal(h.timers.size, 0);
});

test("the real say handler relays only accepted public chat", async () => {
	const forwarded = [],
		delivered = [],
		failures = [];
	const player = { name: "Hero", id: "Hero", owner: "owner", s: {}, party: "party", socket: { emit() {} } };
	const target = { name: "Friend", owner: "friend", socket: { emit() {} } };
	const context = vm.createContext({
		players: { socket: player },
		socket: { id: "socket" },
		gameplay: "normal",
		server_id: "EUI",
		Math,
		Date,
		discord_relay: { chat: (...args) => forwarded.push(args) },
		strip_string: (value) => value,
		ssince: () => 20,
		mssince: () => 1000,
		fail_response: (reason) => failures.push(reason),
		success_response() {},
		broadcast: (...args) => delivered.push(args),
		party_emit() {},
		get_player: () => target,
		insert: async () => {},
		random_string: () => "fixture",
		console,
	});
	const say = socketHandler(context, "say");
	say({ message: "public" });
	say({ message: "party secret", party: true });
	say({ message: "private secret", name: "Friend" });
	context.get_player = () => null;
	context.get_owner = async () => null;
	say({ message: "cross-server private secret", name: "Away" });
	player.s.mute = true;
	say({ message: "muted" });
	delete player.s.mute;
	say({ message: {} });
	say({ message: "" });
	context.mssince = () => 0;
	say({ message: "too fast" });
	context.mssince = () => 1000;
	context.ssince = () => 0;
	say({ message: "code too fast", code: true });
	context.ssince = () => 20;
	for (const mode of ["test", "hardcore"]) {
		context.gameplay = mode;
		say({ message: mode });
	}
	await settle();
	assert.deepEqual(forwarded, [["Hero", "public"]]);
	assert.equal(delivered.length, 3);
	assert.deepEqual(failures, ["muted", "invalid", "invalid", "chat_slowdown", "chat_slowdown"]);
});

test("discord_call keeps its development and gameplay guards", () => {
	const sent = [],
		logged = [];
	const context = vm.createContext({
		Dev: false,
		gameplay: "normal",
		discord_relay: { event: (message) => sent.push(message) },
		server_log: (message) => logged.push(message),
	});
	load(context, "node/server_functions.js", ["discord_call"]);
	context.discord_call("normal");
	context.Dev = true;
	context.discord_call("local");
	context.Dev = false;
	for (const mode of ["test", "hardcore"]) {
		context.gameplay = mode;
		context.discord_call(mode);
	}
	assert.deepEqual(sent, ["normal"]);
	assert.deepEqual(logged, ["Discord: local"]);
	assert.match(read("node/server.js"), /enabled: !Dev/);
});
