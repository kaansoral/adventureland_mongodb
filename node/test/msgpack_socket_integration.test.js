"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");
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

test("legacy JSON and MessagePack clients share one HTTP server", async (context) => {
	const httpServer = http.createServer();
	const legacy = new Server(httpServer, { path: "/ws1/" });
	const compact = new Server(httpServer, {
		path: "/ws1-msgpack/",
		transports: ["websocket"],
		maxHttpBufferSize: 64 * 1024,
		parser: parserModule.createParser({ maxPacketBytes: 64 * 1024 }),
	});
	for (const server of [legacy, compact]) {
		server.on("connection", (socket) => {
			socket.on("echo", (value, acknowledge) => acknowledge(value));
		});
	}

	await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
	const address = `http://127.0.0.1:${httpServer.address().port}`;
	const legacyClient = connect(address, { path: "/ws1/", transports: ["websocket"] });
	const compactClient = connect(address, {
		path: "/ws1-msgpack/",
		transports: ["websocket"],
		parser: browserParser,
	});
	context.after(() => {
		legacyClient.close();
		compactClient.close();
		legacy.close();
		compact.close();
		httpServer.close();
	});

	await Promise.all([once(legacyClient, "connect"), once(compactClient, "connect")]);
	const legacyAck = new Promise((resolve) => legacyClient.emit("echo", { transport: "json" }, resolve));
	const compactAck = new Promise((resolve) => compactClient.emit("echo", { transport: "msgpack" }, resolve));
	assert.deepEqual(await legacyAck, { transport: "json" });
	assert.deepEqual(await compactAck, { transport: "msgpack" });

	const legacyNotice = once(legacyClient, "notice");
	const compactNotice = once(compactClient, "notice");
	for (const server of [legacy, compact]) server.emit("notice", "shared");
	assert.deepEqual(await legacyNotice, ["shared"]);
	assert.deepEqual(await compactNotice, ["shared"]);
});
