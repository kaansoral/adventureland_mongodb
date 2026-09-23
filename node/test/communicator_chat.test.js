const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const vm = require("node:vm");
const { load, read, socketHandler } = require("./helpers/server_vm");

function fixture(options = {}) {
	const output = [],
		logs = [],
		relayed = [];
	const socket = new EventEmitter();
	socket.id = "sender";
	socket.fs = {};
	socket.calls = [];
	socket.total_calls = 0;
	socket.emit = (event, data) => {
		output.push({ event, data });
		return socket;
	};
	const alice = { _id: "CH_alice", owner: "US_owner", online: true, server: "SR_EU1", info: { name: "Alice" } };
	const bob = { _id: "CH_bob", owner: "US_other", online: true, server: "SR_EU1", info: { name: "Bob" } };
	const player = { id: "sender", real_id: "CH_alice", owner: "US_owner", name: "Alice", socket, s: {} };
	const target = {
		id: "peer",
		real_id: "CH_bob",
		owner: "US_other",
		name: "Bob",
		socket: { emit: (event, data) => output.push({ event, data, peer: true }) },
		s: {},
	};
	const server = { _id: "SR_EU1" };
	let cost = 0,
		last_comm_send = 0;
	const game = vm.createContext({
		socket,
		players: { sender: player, peer: target },
		get_player: (name) =>
			name === "Alice" && alice.online && game.server_id === alice.server
				? player
				: name === "Bob" && !options.remote
					? target
					: null,
		get_character: async (name) =>
			name.toLowerCase() === "alice" ? alice : { ...bob, server: options.offline ? "" : "SR_US1" },
		gf: (value, key, fallback) => value.info[key] || fallback,
		get_owner: async () => ({ _id: "US_other" }),
		get_id: (value) => value._id,
		get: async () => ({ _id: "SR_US1" }),
		db: {
			collection: () => ({
				async updateOne() {
					if (Date.now() - last_comm_send < 400) throw { code: 11000 };
					last_comm_send = Date.now();
				},
			}),
		},
		server_eval_direct: async (server, code, data) => {
			const destination = vm.createContext({ data, get_player: () => target });
			vm.runInContext(code, destination);
		},
		server_id: "SR_EU1",
		current_socket: { original: true },
		false_socket: {},
		ls_method: "original",
		mode: {},
		limits: { calls: 100 },
		CC: { say: 1 },
		add_call_cost: (value) => {
			cost += value;
		},
		get_call_cost: () => 0,
		round: Math.round,
		is_string: (value) => typeof value === "string",
		is_object: (value) => value && typeof value === "object",
		strip_string: (value) => value.trim(),
		mssince: (date) => Date.now() - date,
		ssince: (date) => (Date.now() - date) / 1000,
		broadcast: (event, data) => output.push({ event, data, broadcast: true }),
		discord_call: (...args) => relayed.push(args),
		insert: async (message) => logs.push(message),
		random_string: () => String(logs.length + 1),
		resend() {},
		console,
	});
	load(game, "node/server_functions.js", ["fail_response", "success_response"]);
	vm.runInContext(read("node/logic/chat.js"), game);
	const original_on = socket.on;
	const handler = socketHandler(game, "say");
	socket.on = original_on;
	const source = read("node/server.js"),
		start = source.indexOf("\t\tvar original_on = socket.on;");
	vm.runInContext(source.slice(start, source.indexOf("\n\t\t};", start) + 6), game);
	socket.on("say", handler);
	const context = vm.createContext({
		get_id: (value) => value._id,
		get_character: async (name) => (name.toLowerCase() === "alice" ? alice : name.toLowerCase() === "bob" ? bob : null),
		is_in_game: (character) => !!character.server,
		get_servers: async () => [server, { _id: "SR_US1" }],
		allowed_name_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
		server_eval: async (server, code, data) => {
			game.data = data;
			game.server_id = server._id;
			vm.runInContext(code, game);
			return game.output;
		},
	});
	load(context, "api.js", ["is_name_xallowed", "communicator_chat_status", "communicator_say", "send_message_api"]);
	const send = (extra = {}) =>
		context.send_message_api({
			user: { _id: "US_owner" },
			character: "Alice",
			server: "SR_EU1",
			message: "Hello",
			...extra,
		});
	return { context, game, player, alice, bob, socket, output, logs, relayed, send, cost: () => cost };
}

test("communicator shares native delivery, history and Discord without using the character or settling CODE", async () => {
	const f = fixture(),
		emit = f.socket.emit,
		current = f.game.current_socket;
	assert.equal((await f.send()).success, true);
	await new Promise(setImmediate);
	assert.equal(f.socket.total_calls, 0);
	assert.equal(f.player.last_say, undefined);
	assert.equal(f.output.filter((event) => event.event === "chat_log" && event.broadcast).length, 1);
	assert.deepEqual(f.relayed, [["Hello", "Alice"]]);
	assert.ok(f.logs.some((message) => message.owner === "~SR_EU1"));
	assert.ok(f.logs.some((message) => message.owner === "~global"));
	assert.equal(f.output.filter((event) => event.event === "game_response").length, 0);
	assert.equal(f.socket.emit, emit);
	assert.equal(f.game.current_socket, current);
	assert.equal(f.game.ls_method, "original");
});

test("mute and the native chat cooldown reject sends without broadcasting", async () => {
	const f = fixture();
	f.player.s.mute = { ms: 60000 };
	assert.equal((await f.send()).reason, "muted");
	delete f.player.s.mute;
	f.player.last_say = new Date();
	assert.equal((await f.send()).reason, "chat_slowdown");
	assert.equal(f.relayed.length, 0);
	assert.equal(f.logs.length, 0);
});

test("sender ownership is checked in both HTTP and the live server; recipients and destination are validated", async () => {
	const f = fixture();
	for (const args of [
		{ character: "Bob" },
		{ server: "SR_MISSING" },
		{ message: " " },
		{ message: "x".repeat(1201) },
		{ server: undefined, to: "Missing" },
		{ server: undefined, to: "Alice" },
	]) {
		assert.equal((await f.send(args)).failed, true);
	}
	f.player.owner = "US_transferred";
	assert.equal((await f.send()).reason, "not_owner");
	assert.equal(f.socket.total_calls, 0);
	assert.equal(f.logs.length, 0);
});

test("private replies keep the selected character and use native delivery and both owners' history", async () => {
	const f = fixture();
	assert.equal((await f.send({ server: undefined, to: "bob" })).success, true);
	await new Promise(setImmediate);
	assert.equal(f.output.filter((event) => event.event === "pm").length, 1);
	assert.deepEqual(
		f.logs.map((message) => [message.owner, message.fro, message.to[0], message.type]),
		[
			["US_other", "Alice", "Bob", "private"],
			["US_owner", "Alice", "Bob", "private"],
		],
	);
	assert.equal(f.relayed.length, 0);
});

test("offline characters can send to any server and uncertain bridge results are not reported as sent", async () => {
	const f = fixture();
	f.alice.online = false;
	f.alice.server = "";
	assert.equal((await f.send({ server: "SR_US1" })).success, true);
	assert.ok(f.logs.some((message) => message.owner === "~SR_US1" && message.fro === "Alice"));
	assert.equal(f.socket.total_calls, 0);
	assert.equal(f.alice.online, false);
	f.context.server_eval = async () => null;
	assert.equal((await f.send()).reason, "chat_unavailable");
});

test("native private delivery reaches other servers and stores messages for offline recipients", async () => {
	for (const offline of [false, true]) {
		const f = fixture({ remote: true, offline });
		assert.equal((await f.send({ server: undefined, to: "Bob" })).success, true);
		await new Promise(setImmediate);
		assert.equal(f.logs.length, 2);
		assert.equal(f.output.filter((event) => event.peer && event.event === "pm").length, offline ? 0 : 1);
		assert.equal(f.logs[0].fro, "Alice");
		assert.equal(f.logs[0].to[0], "Bob");
	}
});

test("native say still enforces cooldown, echoes PMs and settles its original CODE response", async () => {
	const f = fixture();
	f.socket.listeners("say")[0]({ name: "Bob", message: "Native PM" });
	await new Promise(setImmediate);
	assert.equal(f.output.filter((event) => event.event === "pm").length, 2);
	assert.ok(f.output.some((event) => event.event === "game_response" && event.data.success));
	assert.equal(f.logs.length, 2);
	f.socket.listeners("say")[0]({ message: "Too soon" });
	assert.ok(f.output.some((event) => event.event === "game_response" && event.data.response === "chat_slowdown"));
	assert.equal(f.relayed.length, 0);
});

test("Communicator cooldown is shared across destinations and saved or remote live mutes still apply", async () => {
	const f = fixture();
	assert.equal((await f.send()).success, true);
	assert.equal((await f.send({ server: "SR_US1" })).reason, "chat_slowdown");
	f.player.s.mute = { ms: 60000 };
	assert.equal((await f.send({ server: "SR_US1" })).reason, "muted");
	f.alice.online = false;
	f.alice.info.s = { mute: { ms: 60000 } };
	assert.equal((await f.send()).reason, "muted");
});

test("the legacy /comm URL redirects to Hub and preserves its query string", () => {
	const source = read("main.js"),
		start = source.indexOf('app.get("/comm",');
	let handler;
	vm.runInNewContext(source.slice(start, source.indexOf('\napp.get("/hub"', start)), {
		app: {
			get: (route, fn) => {
				handler = fn;
			},
		},
	});
	let redirected;
	handler(
		{ path: "/comm", originalUrl: "/comm?region=US&name=I" },
		{
			redirect: (status, url) => {
				redirected = { status, url };
			},
		},
	);
	assert.deepEqual(redirected, { status: 301, url: "/hub?region=US&name=I" });
	assert.ok(!source.includes('app.get("/communicator"'));
});

test("the existing authenticated eval bridge returns both immediate and asynchronous results", async () => {
	const source = read("node/server.js"),
		start = source.indexOf('server_api.post("/eval",');
	const access = Symbol("test access");
	let handler, body;
	vm.runInNewContext(source.slice(start, source.indexOf("\n});", start) + 4), {
		server_api: {
			post: (route, fn) => {
				handler = fn;
			},
		},
		keys: { ACCESS_MASTER: access },
	});
	for (const code of ["output=data.value;", "output=Promise.resolve(data.value);"]) {
		await handler(
			{ body: { spass: access, code, data: '{"value":{"success":true}}' } },
			{
				send: (value) => {
					body = value;
				},
			},
		);
		assert.deepEqual(JSON.parse(body), { success: true });
	}
});

function matches(document, query) {
	return Object.entries(query).every(([key, value]) => {
		if (key === "$and") return value.every((part) => matches(document, part));
		if (key === "$or") return value.some((part) => matches(document, part));
		const actual = document[key];
		if (Object.prototype.toString.call(value) === "[object RegExp]")
			return (Array.isArray(actual) ? actual : [actual]).some((item) => value.test(item));
		if (value && "$lt" in Object(value)) return actual < value.$lt;
		if (value && "$gt" in Object(value)) return actual > value.$gt;
		if (value instanceof Date) return +actual === +value;
		return actual === value;
	});
}

test("history isolates private accounts, matches both directions and pages tied timestamps without overlap", async () => {
	const date = new Date("2026-09-08T10:00:00Z");
	const messages = Array.from({ length: 83 }, (_, i) => ({
		_id: "MS_" + String(i).padStart(3, "0"),
		created: date,
		owner: "US_owner",
		type: "private",
		fro: i % 2 ? "Bob" : "Alice",
		to: [i % 2 ? "Alice" : "Bob"],
		info: { message: "Message " + i },
	}));
	messages.push({ ...messages[0], _id: "MS_secret", owner: "US_other", info: { message: "Private to someone else" } });
	messages.push({ ...messages[0], _id: "MS_public", owner: "~SR_EU1", type: "server" });
	let authenticated = true;
	const context = vm.createContext({
		Date,
		get_id: (value) => value._id,
		gf: (value, name, fallback) => value.info[name] || fallback,
		get_user: async () => (authenticated ? { _id: "US_owner" } : null),
		get_servers: async () => [{ _id: "SR_EU1" }],
		allowed_name_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
		db: {
			collection: () => ({
				find(query) {
					let found = messages.filter((message) => matches(message, query));
					return {
						sort(order) {
							found.sort((a, b) => order.created * (a.created - b.created || a._id.localeCompare(b._id)));
							return this;
						},
						limit(count) {
							found = found.slice(0, count);
							return this;
						},
						maxTimeMS() {
							return this;
						},
						async toArray() {
							return found;
						},
					};
				},
			}),
		},
	});
	load(context, "api.js", [
		"is_name_xallowed",
		"chat_cursor_query",
		"chat_message_to_client",
		"chat_page",
		"pull_chat_api",
	]);
	const first = await context.pull_chat_api({ character: "Alice", to: "bob" });
	assert.equal(first.messages.length, 80);
	assert.equal(first.more, true);
	assert.equal(first.messages[0].id, "MS_082");
	const older = await context.pull_chat_api({ character: "Alice", to: "bob", cursor: first.cursor });
	assert.equal(older.messages.length, 3);
	assert.equal(older.more, false);
	assert.equal(
		first.messages.concat(older.messages).some((message) => message.id === "MS_secret"),
		false,
	);
	assert.equal((await context.pull_chat_api({ server: "SR_EU1", cursor: "bad" })).reason, "invalid_cursor");
	const refresh = await context.pull_chat_api({ character: "Alice", to: "Bob", after: first.after });
	assert.equal(refresh.messages.length, 0);
	messages.push({ ...messages[0], _id: "MS_999", created: new Date(+date + 1000) });
	const newer = await context.pull_chat_api({ character: "Alice", to: "Bob", after: first.after });
	assert.equal(newer.messages.length, 1);
	assert.equal(newer.messages[0].id, "MS_999");
	const catchup = await context.pull_chat_api({ character: "Alice", to: "Bob", after: date.toISOString() + "|MS_000" });
	assert.equal(catchup.messages[0].id, "MS_001");
	assert.equal(catchup.more, true);
	const rest = await context.pull_chat_api({ character: "Alice", to: "Bob", after: catchup.after });
	assert.deepEqual(
		Array.from(rest.messages, (message) => message.id),
		["MS_081", "MS_082", "MS_999"],
	);
	authenticated = false;
	assert.equal((await context.pull_chat_api({ character: "Alice", to: "Bob" })).reason, "not_logged_in");
	assert.equal((await context.pull_chat_api({ server: "SR_EU1" })).messages[0].id, "MS_public");
	assert.equal((await context.pull_chat_api({ server: "~US_other" })).reason, "server_not_found");
});

test("conversation summaries retain incoming and outgoing reply identities and return only public character fields", async () => {
	const records = [
		{
			_id: "MS_one",
			fro: "Bob",
			to: ["Alice"],
			author: "US_other",
			info: { message: "Hello" },
			created: new Date(),
			type: "private",
		},
		{
			_id: "MS_two",
			fro: "Alt",
			to: ["Bob"],
			author: "US_owner",
			info: { message: "Hi" },
			created: new Date(),
			type: "private",
		},
	];
	let pipeline;
	const context = vm.createContext({
		get_id: (value) => value._id,
		gf: (value, name, fallback) => value.info[name] || fallback,
		chat_server_cache: null,
		get_servers: async () => [],
		db: {
			collection: () => ({
				find(query, options) {
					assert.deepEqual(Object.keys(options.projection).sort(), ["info.name", "online", "owner", "server"]);
					return {
						limit() {
							return this;
						},
						async toArray() {
							return ["Alice", "Alt"].map((name) => ({
								owner: "US_owner",
								online: true,
								server: "SR_EU1",
								info: { name },
							}));
						},
					};
				},
				aggregate(value) {
					pipeline = value;
					return { toArray: async () => records };
				},
			}),
		},
	});
	load(context, "api.js", [
		"chat_cursor_query",
		"chat_message_to_client",
		"chat_page",
		"chat_server_channels",
		"pull_chats_api",
	]);
	const result = await context.pull_chats_api({ user: { _id: "US_owner" } });
	assert.equal(pipeline[0].$match.owner, "US_owner");
	assert.equal(pipeline[0].$match.type, "private");
	assert.ok(pipeline.some((stage) => stage.$group && stage.$group._id.$cond));
	assert.deepEqual(JSON.parse(JSON.stringify(result.chats.map((chat) => [chat.character, chat.to]))), [
		["Alice", "Bob"],
		["Alt", "Bob"],
	]);
	assert.deepEqual(Object.keys(result.characters[0]).sort(), ["name", "online", "server"]);
});
