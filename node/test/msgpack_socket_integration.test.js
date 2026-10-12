"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const vm = require("node:vm");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");
const { RawFrame, createParser } = require("../json_parser");
const { extract, read } = require("./helpers/server_vm");
const parserModule = require("../msgpack_parser");
const browserParser = require("../../js/socket.io-msgpack-parser.min.js");

function once(socket, event) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 3000);
		socket.once(event, (...args) => {
			clearTimeout(timeout);
			resolve(args);
		});
	});
}

test("shared fan-out and full entity packets reach JSON, polling and MessagePack clients", async (context) => {
	const httpServer = http.createServer();
	const c = vm.createContext({});
	const source = read("node/server.js");
	vm.runInContext(
		source.slice(source.indexOf("function coalesce_socket_writes"), source.indexOf("var io = new SocketIOServer")),
		c,
	);
	const legacy = new Server(httpServer, { path: "/ws1/", parser: createParser() });
	const compact = new Server(httpServer, {
		path: "/ws1-msgpack/",
		transports: ["websocket"],
		maxHttpBufferSize: 64 * 1024,
		parser: parserModule.createParser({ maxPacketBytes: 64 * 1024 }),
	});
	c.game_ios = [legacy, compact];
	c.process = process;
	c.game_ios.forEach(c.coalesce_socket_writes); // every packet below goes through the once-per-tick flush
	const fanoutSource = read("node/server_functions.js");
	vm.runInContext(["collect_fanout", "emit_fanout"].map((name) => extract(fanoutSource, name)).join("\n"), c);
	const clients = [];
	context.after(() => {
		for (const client of clients) client.close();
		legacy.close();
		compact.close();
		httpServer.close();
	});
	for (const [index, server] of c.game_ios.entries()) {
		server.on("connection", (socket) => {
			socket.al_server_index = index;
			socket.on("echo", (value, acknowledge) => acknowledge(value));
		});
	}

	await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
	const address = `http://127.0.0.1:${httpServer.address().port}`;
	const legacyClient = connect(address, { path: "/ws1/", transports: ["websocket"], forceNew: true });
	const compactClient = connect(address, {
		path: "/ws1-msgpack/",
		transports: ["websocket"],
		parser: browserParser,
		forceNew: true,
	});
	const pollingClient = connect(address, { path: "/ws1/", transports: ["polling"], forceNew: true });
	const excludedClient = connect(address, { path: "/ws1/", transports: ["websocket"], forceNew: true });
	clients.push(legacyClient, compactClient, pollingClient, excludedClient);

	await Promise.all(clients.map((client) => once(client, "connect")));
	assert.doesNotMatch(legacyClient.io.engine.transport.ws.extensions, /permessage-deflate/);
	assert.doesNotMatch(compactClient.io.engine.transport.ws.extensions, /permessage-deflate/);
	const legacyAck = new Promise((resolve) => legacyClient.emit("echo", { transport: "json" }, resolve));
	const compactAck = new Promise((resolve) => compactClient.emit("echo", { transport: "msgpack" }, resolve));
	assert.deepEqual(await legacyAck, { transport: "json" });
	assert.deepEqual(await compactAck, { transport: "msgpack" });

	const legacyNotice = once(legacyClient, "notice");
	const compactNotice = once(compactClient, "notice");
	for (const server of [legacy, compact]) server.emit("notice", "shared");
	assert.deepEqual(await legacyNotice, ["shared"]);
	assert.deepEqual(await compactNotice, ["shared"]);

	let fanout,
		unexpected = 0;
	excludedClient.on("entities", () => unexpected++);
	for (const [server, client] of [
		[legacy, legacyClient],
		[compact, compactClient],
		[legacy, pollingClient],
	]) {
		fanout = c.collect_fanout(fanout, { socket: server.of("/").sockets.get(client.id) });
	}
	const value = {
		type: "xy",
		in: "main",
		map: "main",
		monsters: [],
		players: Array.from({ length: 150 }, (_, i) => ({
			id: `Peer${i}`,
			ctype: "mage",
			x: i,
			y: 0,
			hp: 100,
			moving: true,
			going_x: 300,
			going_y: 0,
			move_num: 1,
			s: {},
		})),
	};
	const deliveries = [legacyClient, compactClient, pollingClient].map((client) => once(client, "entities"));
	const barrier = once(excludedClient, "barrier");
	c.emit_fanout(fanout, "entities", new RawFrame(undefined, JSON.stringify(value)));
	legacy.emit("barrier");
	for (const delivery of await Promise.all(deliveries)) assert.deepEqual(delivery, [value]);
	await barrier;
	assert.equal(unexpected, 0, "grouped broadcasts must not widen the recipient set");
});

test("packets a socket gets in one tick leave in one write and keep their order", async (context) => {
	const httpServer = http.createServer();
	const c = vm.createContext({ process });
	const source = read("node/server.js");
	vm.runInContext(
		source.slice(source.indexOf("function coalesce_socket_writes"), source.indexOf("var io = new SocketIOServer")),
		c,
	);
	const server = new Server(httpServer, { path: "/ws1/", parser: createParser() });
	c.coalesce_socket_writes(server);
	let client;
	context.after(() => {
		if (client) client.close();
		server.close();
		httpServer.close();
	});
	const connected = new Promise((resolve) => server.on("connection", resolve));
	await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
	client = connect(`http://127.0.0.1:${httpServer.address().port}`, {
		path: "/ws1/",
		transports: ["websocket"],
		forceNew: true,
	});
	await once(client, "connect");
	const socket = await connected;
	const raw = socket.conn.transport.socket._socket;
	let writes = 0;
	const writeGeneric = raw._writeGeneric.bind(raw); // every write and writev goes through here once
	raw._writeGeneric = (...args) => (writes++, writeGeneric(...args));

	const received = [];
	const all = new Promise((resolve) => client.on("step", (n) => received.push(n) === 6 && resolve()));
	socket.emit("step", 0);
	socket.emit("step", 1);
	server.to(socket.id).emit("step", 2); // a room broadcast joins the same write (socket.to would skip the sender)
	socket.emit("step", 3);
	server.emit("step", 4);
	socket.emit("step", 5, new RawFrame({ big: "x".repeat(4096) }).json.length);
	await all;
	assert.deepEqual(received, [0, 1, 2, 3, 4, 5]);
	assert.equal(writes, 1, "six packets queued in one tick must go out in a single write");
});
