"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createCharacterState } = require("../game/character_state");
const { assertProtocol3Publication } = require("../game/release_readiness");

test("release publication and fresh character remain protocol 3 after world reset", () => {
	const fresh = createCharacterState();
	assert.equal(fresh.total_level, 7);
	assert.deepEqual(Object.keys(fresh.skills), ["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"]);
	assert.deepEqual(
		assertProtocol3Publication({
			protocol: 3,
			skills: fresh.skills,
			abilities: { attack: {} },
		}),
		{ protocol: 3, skillCount: 7, abilityCount: 1 },
	);
	assert.throws(() => assertProtocol3Publication({ protocol: 2, classes: {}, skills: {}, abilities: {} }), {
		code: "WORLD_PUBLICATION",
	});
});

test("release scripts are present and keep reset separate from service startup", () => {
	const root = path.resolve(__dirname, "../../..");
	const reset = fs.readFileSync(path.join(root, "scripts/reset-local-world.sh"), "utf8");
	const verify = fs.readFileSync(path.join(root, "scripts/verify-skill-refactor.sh"), "utf8");
	const service = fs.readFileSync(path.join(root, "scripts/service-server.sh"), "utf8");
	const browser = fs.readFileSync(path.join(root, "scripts/browser-smoke.mjs"), "utf8");
	const rollback = fs.readFileSync(path.join(root, "scripts/rollback-drill.mjs"), "utf8");
	const matrixPath = path.join(root, "cjs-al-service", "tools/live-progression-matrix.mjs");
	const smoke = fs.readFileSync(path.join(__dirname, "../tools/release-smoke.js"), "utf8");
	assert.match(reset, /--execute/);
	assert.match(reset, /RESET-SKILL-WORLD/);
	assert.doesNotMatch(reset, /systemctl .*stop|kill .*mongod/);
	assert.match(verify, /world-reset|verify-world/);
	assert.match(verify, /scripts\/browser-smoke\.mjs/);
	assert.match(verify, /scripts\/rollback-drill\.mjs/);
	assert.match(verify, /live-progression-matrix\.mjs/);
	assert.match(verify, /live-progression-matrix-result\.json/);
	assert.match(verify, /SMOKE_DATABASE=.*skill-reset-smoke/);
	assert.match(verify, /ROLLBACK_DATABASE=.*skill-rollback/);
	assert.match(verify, /assert_release_logs_redacted/);
	assert.match(verify, /scripts\/release-log-policy\.mjs/);
	assert.match(verify, /ADVENTURELAND_RELEASE_SAFE_LOGS=1/);
	assert.doesNotMatch(verify, /ADVENTURELAND_BROWSER_SMOKE_COMMAND|ADVENTURELAND_ROLLBACK_DRILL_COMMAND/);
	assert.doesNotMatch(verify, /bash -s/);
	assert.match(browser, /schemaVersion: 1/);
	assert.match(browser, /target: \{ database: databaseName, disposable: true \}/);
	assert.match(rollback, /schemaVersion: 1/);
	assert.match(rollback, /simulatedFailure/);
	assert.match(rollback, /MUTABLE_COLLECTIONS/);
	assert.match(rollback, /noMigration/);
	assert.match(rollback, /ADVENTURELAND_RELEASE_SAFE_LOGS: "1"/);
	assert.match(rollback, /assertRedactedReleaseLog/);
	assert.match(rollback, /redactReleaseLog/);
	assert.ok(fs.existsSync(matrixPath));
	assert.match(fs.readFileSync(matrixPath, "utf8"), /gate: "live-progression-matrix"/);
	assert.match(service, /data\.js/);
	assert.match(service, /verify-publication\.js/);
	assert.match(smoke, /combat_action/);
	assert.match(smoke, /skill_level_up/);
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
	const syncBlock = server.slice(syncStart, syncEnd);
	assert.ok(syncBlock.indexOf("await tx_save(entity)") < syncBlock.indexOf("flushPlayerProgressionEvents(player)"));
});
