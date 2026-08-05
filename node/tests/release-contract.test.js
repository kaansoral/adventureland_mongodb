"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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

test("canonical release log policy round-trips structured secrets", async () => {
	const root = path.resolve(__dirname, "../../..");
	const policyPath = path.join(root, "scripts/release-log-policy.mjs");
	const { assertRedactedReleaseLog, redactReleaseLog } = await import(
		`${require("node:url").pathToFileURL(policyPath).href}?test=${Date.now()}`
	);
	const rawRecord = {
		password: "private-password",
		auth: "private-auth",
		token: "private-token",
		access_token: "private-access-token",
		refresh_token: "private-refresh-token",
		requestId: "private-request-id",
		email: "private@example.invalid",
		route: "signup_or_login",
		preserved: "safe-value",
	};
	const raw = JSON.stringify(rawRecord);
	assert.throws(() => assertRedactedReleaseLog("raw", raw));
	const redacted = redactReleaseLog(raw);
	assert.doesNotThrow(() => assertRedactedReleaseLog("redacted", redacted));
	assert.deepEqual(JSON.parse(redacted), {
		password: "[redacted]",
		auth: "[redacted]",
		token: "[redacted]",
		access_token: "[redacted]",
		refresh_token: "[redacted]",
		requestId: "[redacted]",
		email: "[email-redacted]",
		route: "release-request",
		preserved: "safe-value",
	});
	for (const secret of Object.values(rawRecord)) {
		if (secret !== "safe-value") assert.equal(redacted.includes(secret), false);
	}
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-release-policy-"));
	const rawLog = path.join(temporaryDirectory, "raw.log");
	const redactedLog = path.join(temporaryDirectory, "redacted.log");
	try {
		fs.writeFileSync(rawLog, raw);
		assert.throws(() => execFileSync(process.execPath, [policyPath, rawLog], { cwd: root, stdio: "pipe" }));
		fs.writeFileSync(redactedLog, redacted);
		execFileSync(process.execPath, [policyPath, redactedLog], { cwd: root, stdio: "pipe" });
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("retained release-log scan visits browser and child log paths", () => {
	const root = path.resolve(__dirname, "../../..");
	const verify = fs.readFileSync(path.join(root, "scripts/verify-skill-refactor.sh"), "utf8");
	const start = verify.indexOf("assert_release_logs_redacted() {");
	const end = verify.indexOf("\n}\n\n", start);
	assert.notEqual(start, -1);
	assert.notEqual(end, -1);
	const scanner = verify.slice(start, end + 3);
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-release-scan-"));
	const childDirectory = path.join(temporaryDirectory, "child");
	fs.mkdirSync(childDirectory);
	const invoke = () =>
		execFileSync("bash", ["-c", `${scanner}\nassert_release_logs_redacted`], {
			cwd: root,
			env: { ...process.env, ROOT_DIR: root, EVIDENCE_DIR: temporaryDirectory },
			stdio: "pipe",
		});
	try {
		fs.writeFileSync(path.join(temporaryDirectory, "browser.log"), "release-safe important code=ability\n");
		fs.writeFileSync(
			path.join(childDirectory, "live-game-smoke.log"),
			"release-safe important code=merchant_settlement\n",
		);
		assert.doesNotThrow(invoke);
		fs.writeFileSync(path.join(childDirectory, "unsafe.log"), "password=private-value\n");
		assert.throws(invoke);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("browser death expression executes and validator rejects malformed evidence", async () => {
	const root = path.resolve(__dirname, "../../..");
	const browser = fs.readFileSync(path.join(root, "scripts/browser-smoke.mjs"), "utf8");
	const expressionStartMarker = "const liveDeath = await cdp.evaluate(`";
	const expressionStart = browser.indexOf(expressionStartMarker);
	const expressionEnd = browser.indexOf("`);", expressionStart);
	assert.notEqual(expressionStart, -1, "browser death expression was not found");
	assert.notEqual(expressionEnd, -1, "browser death expression terminator was not found");
	const expression = browser.slice(expressionStart + expressionStartMarker.length, expressionEnd);
	assert.doesNotThrow(() => new Function(expression));
	assert.equal((expression.match(/let currentTarget\s*=/g) || []).length, 1);
	assert.equal((expression.match(/const currentTarget\s*=/g) || []).length, 0);
	const listeners = new Map();
	const socket = {
		on(event, handler) {
			if (!listeners.has(event)) listeners.set(event, new Set());
			listeners.get(event).add(handler);
		},
		off(event, handler) {
			listeners.get(event)?.delete(handler);
		},
		emit(event, payload) {
			for (const handler of [...(listeners.get(event) || [])]) handler(payload);
		},
	};
	const character = {
		name: "hero",
		rip: false,
		map: "main",
		real_x: 0,
		real_y: 0,
		range: 100,
		mp: 100,
		max_hp: 100,
		hp: 100,
		max_mp: 100,
		death_sickness_until: 123,
		skills: Object.fromEntries(
			["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"].map((name) => [
				name,
				{ level: 1, xp: 0 },
			]),
		),
	};
	const target = {
		id: "monster-1",
		type: "monster",
		mtype: "goo",
		map: "main",
		rip: false,
		hp: 100,
		x: 0,
		y: 0,
		target: null,
	};
	const windowContext = { entities: { [target.id]: target }, ui_log: () => undefined };
	const execution = vm.runInNewContext(`(${expression})`, {
		character,
		G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
		window: windowContext,
		socket,
		smart_move: async () => undefined,
		use_ability: async (name, id) => {
			target.target = character.name;
			return { success: true, id: String(id), place: name };
		},
		setTimeout,
		clearTimeout,
	});
	await new Promise((resolve) => setImmediate(resolve));
	windowContext.ui_log("Defeated by goo");
	socket.emit("hit", { id: character.name, hid: target.id, damage: 10, kill: true, source: "attack" });
	socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: target.mtype,
		death_sickness_until: character.death_sickness_until,
	});
	socket.emit("game_log", { message: "Death sickness applied for 5 minutes" });
	character.rip = true;
	socket.emit("player");
	const liveDeath = await execution;
	assert.equal(liveDeath.terminal_hit.victim_id, character.name);
	assert.equal(liveDeath.terminal_hit.attacker_id, target.id);
	assert.equal(liveDeath.terminal_hit.response.monster, target.mtype);
	assert.equal(liveDeath.victim_id, character.name);

	const validatorPath = path.join(root, "scripts/validate-release-gate.mjs");
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-browser-contract-"));
	const logPath = path.join(temporaryDirectory, "browser.log");
	const resultPath = path.join(temporaryDirectory, "browser-result.json");
	const skills = Object.fromEntries(
		["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"].map((name) => [name, { level: 1, xp: 0 }]),
	);
	const result = {
		schemaVersion: 1,
		gate: "browser-smoke",
		ok: true,
		target: { database: "skill-reset-test", disposable: true },
		evidence: logPath,
		cleanup: { deferred: true, verified: false },
		processes: { stopped: true },
		account: { ownerId: "owner-1", sentinelId: "sentinel-1" },
		browser: {
			ui: {
				domContract: true,
				equipment: { fail: true, pass: true },
				abilityGate: { passed: true },
				liveDeath: {
					rip: true,
					sickness: 123,
					target: {
						id: "monster-1",
						type: "goo",
						aggro: true,
						action: { id: "monster-1", place: "attack" },
					},
					victim_id: "hero",
					terminal_hit: {
						attacker_id: "monster-1",
						victim_id: "hero",
						kill: true,
						damage: 10,
						response: {
							response: "defeated_by_a_monster",
							monster: "goo",
							death_sickness_until: 123,
						},
					},
					responses: [
						{
							response: "defeated_by_a_monster",
							monster: "goo",
							death_sickness_until: 123,
						},
					],
					serverLogs: ["Death sickness applied for 5 minutes"],
					uiLogs: ["Defeated by goo", "Death sickness applied for 5 minutes"],
					skills,
					skillsBefore: structuredClone(skills),
				},
			},
		},
	};
	const runValidator = (candidate, expectedExit = false) => {
		fs.writeFileSync(resultPath, JSON.stringify(candidate));
		fs.writeFileSync(logPath, `${JSON.stringify(candidate)}\n`);
		const invoke = () =>
			execFileSync(process.execPath, [validatorPath, logPath, "browser-smoke", "skill-reset-test", resultPath], {
				cwd: root,
				stdio: "pipe",
			});
		if (expectedExit) assert.throws(invoke);
		else assert.doesNotThrow(invoke);
	};
	try {
		runValidator(result);
		const malformedHit = structuredClone(result);
		malformedHit.browser.ui.liveDeath.terminal_hit.attacker_id = "other-monster";
		runValidator(malformedHit, true);
		const malformedVictim = structuredClone(result);
		malformedVictim.browser.ui.liveDeath.terminal_hit.victim_id = "other-player";
		runValidator(malformedVictim, true);
		const malformedSkills = structuredClone(result);
		delete malformedSkills.browser.ui.liveDeath.skills.merchant;
		runValidator(malformedSkills, true);
		const malformedLevel = structuredClone(result);
		malformedLevel.browser.ui.liveDeath.skills.warrior.level = 100;
		runValidator(malformedLevel, true);
		const changedSnapshot = structuredClone(result);
		changedSnapshot.browser.ui.liveDeath.skillsBefore.warrior.xp = 1;
		runValidator(changedSnapshot, true);
		const oversizedResponses = structuredClone(result);
		oversizedResponses.browser.ui.liveDeath.responses = Array.from({ length: 17 }, () => ({ response: "noise" }));
		runValidator(oversizedResponses, true);
		const unknownResponseField = structuredClone(result);
		unknownResponseField.browser.ui.liveDeath.responses[0].secret = "unexpected";
		runValidator(unknownResponseField, true);
		const oversizedLog = structuredClone(result);
		oversizedLog.browser.ui.liveDeath.serverLogs = ["x".repeat(257)];
		runValidator(oversizedLog, true);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});
