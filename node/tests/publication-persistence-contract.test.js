"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { assertProtocol3Publication } = require("../game/release_readiness");

test("release readiness rejects a legacy publication shape", () => {
	assert.throws(() => assertProtocol3Publication({ protocol: 2, classes: {}, skills: {}, abilities: {} }), {
		code: "WORLD_PUBLICATION",
	});
});

test("progression events stay queued until a successful persistence boundary", () => {
	const root = path.resolve(__dirname, "../..");
	const server = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
	const resendStart = server.indexOf("function resend(player, events)");
	const resendEnd = server.indexOf("\nfunction transport_monster_to", resendStart);
	assert.notEqual(resendStart, -1);
	assert.notEqual(resendEnd, -1);
	assert.doesNotMatch(server.slice(resendStart, resendEnd), /flushPlayerProgressionEvents/);
	const syncStart = server.indexOf("async function sync_call(player)");
	const syncEnd = server.indexOf("\n\t// stop_call:", syncStart);
	assert.notEqual(syncStart, -1);
	assert.ok(syncEnd > syncStart);
	const syncBlock = server.slice(syncStart, syncEnd);
	const saveIndex = syncBlock.indexOf("await tx_save(entity)");
	const flushIndex = syncBlock.indexOf("flushPlayerProgressionEvents(player)");
	assert.notEqual(saveIndex, -1);
	assert.notEqual(flushIndex, -1);
	assert.ok(saveIndex < flushIndex);
});
