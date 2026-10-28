"use strict";
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const vm = require("node:vm");
const { load, socketHandler } = require("./helpers/server_vm");

function fixture() {
	const socket = new EventEmitter(),
		timers = new Set();
	const character = { c: {}, map: "main" };
	let acknowledge;
	const c = vm.createContext({
		character,
		RESOLVE_ALL: false,
		Promise,
		parent: {
			socket,
			push_deferred: () =>
				new Promise((resolve) => {
					acknowledge = resolve;
				}),
		},
		rejecting_promise: (result) => Promise.reject(result),
		sleep: () => new Promise(() => {}),
		setTimeout(fn) {
			timers.add(fn);
			return fn;
		},
		clearTimeout(fn) {
			timers.delete(fn);
		},
	});
	load(c, "js/runner_functions.js", ["town"]);
	const serverSocket = { id: "test", emit: (event, data) => socket.emit(event, data) };
	const player = { c: {}, map: "main", targets: 0 };
	const server = vm.createContext({
		socket: serverSocket,
		players: { test: player },
		min: Math.min,
		can_walk: () => true,
		resend() {},
		success_response(data) {
			const ack = Object.assign({ place: "town" }, data);
			socket.emit("game_response", ack);
			if (acknowledge) acknowledge(ack);
		},
		fail_response(reason) {
			socket.emit("game_response", { place: "town", failed: true, reason });
		},
	});
	const handler = socketHandler(server, "town");
	socket.on("town", handler);
	return { c, socket, timers, character, player };
}
const flush = async () => {
	for (let i = 0; i < 5; i++) await Promise.resolve();
};
function cleared(h) {
	assert.equal(h.timers.size, 0);
	for (const event of ["new_map", "player", "game_response", "disconnect"])
		assert.equal(h.socket.listenerCount(event), 0, event);
}

test("town waits for server arrival even when the acknowledgement precedes the channel update", async () => {
	const h = fixture();
	let settled = false;
	const promise = h.c.town().then((result) => {
		settled = true;
		return result;
	});
	await flush();
	assert.equal(h.player.c.town.ms, 3000, "the real server handler started the channel");
	assert.equal(settled, false, "an empty client channel is not proof of arrival");
	h.character.c.town = { ms: 3000 };
	h.socket.emit("player", { c: { town: { ms: 3000 } } });
	delete h.character.c.town; // Client-side countdown may expire before the server packet.
	await flush();
	assert.equal(settled, false);
	h.socket.emit("new_map", { name: "main", in: "main", x: 0, y: 0, effect: 1 });
	assert.equal((await promise).success, true);
	cleared(h);
});

test("town rejects server cancellation and unrelated map changes", async () => {
	for (const [event, data] of [
		["player", { c: {} }],
		["player", { rip: true }],
		["new_map", { name: "main", effect: "blink" }],
	]) {
		const h = fixture();
		const pending = h.c.town();
		h.socket.emit(event, data);
		await assert.rejects(pending, (error) => error.failed && error.reason === "interrupted");
		cleared(h);
	}
});

test("town failure, disconnect and timeout settle once and remove listeners", async () => {
	for (const reason of ["cant_escape", "disconnected", "timeout"]) {
		const h = fixture();
		const pending = h.c.town();
		if (reason === "cant_escape") h.socket.emit("game_response", { place: "town", failed: true, reason });
		if (reason === "disconnected") h.socket.emit("disconnect");
		if (reason === "timeout") for (const timer of [...h.timers]) timer();
		await assert.rejects(pending, (error) => error.failed && error.reason === reason);
		cleared(h);
	}
});

test("town preserves RESOLVE_ALL for interrupted teleports", async () => {
	const h = fixture();
	h.c.RESOLVE_ALL = true;
	const pending = h.c.town();
	h.socket.emit("new_map", { name: "bank", effect: 0 });
	const result = await pending;
	assert.equal(result.failed, true);
	assert.equal(result.reason, "interrupted");
	cleared(h);
});
