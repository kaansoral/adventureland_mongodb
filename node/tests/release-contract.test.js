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
	assert.match(rollback, /const serviceClosed = new Promise/);
	assert.match(rollback, /await serviceClosed/);
	assert.match(rollback, /path\.join\(tmpdir\(\), "adventureland-rollback-child-"\)/);
	assert.match(rollback, /log,\n\s*root,\n\s*\{ redact: true \}/);
	assert.match(verify, /GATE_STAGING_DIR=/);
	assert.match(verify, /redact_release_logs/);
	assert.ok(
		verify.includes(
			'run_typed_gate "live progression matrix" "live-progression-matrix" "$SMOKE_DATABASE" "$EVIDENCE_DIR/live-progression-matrix.log" "$EVIDENCE_DIR/live-progression-matrix.stdout.log" "$EVIDENCE_DIR/live-progression-matrix-result.json"',
		),
	);
	assert.ok(
		verify.includes(
			'run_typed_gate "live game smoke" "live-game-smoke" "$SMOKE_DATABASE" "$EVIDENCE_DIR/live-game-smoke.log" "$EVIDENCE_DIR/live-service-smoke.stdout.log" "$EVIDENCE_DIR/live-service-smoke-result.json"',
		),
	);
	assert.ok(
		verify.includes(
			'run_typed_gate "browser smoke" "browser-smoke" "$SMOKE_DATABASE" "" "$EVIDENCE_DIR/browser-smoke.log" "$EVIDENCE_DIR/browser-smoke-result.json"',
		),
	);
	assert.ok(
		verify.includes(
			'run_typed_gate "rollback drill" "rollback-drill" "$ROLLBACK_DATABASE" "" "$EVIDENCE_DIR/rollback-drill.log" "$EVIDENCE_DIR/rollback-drill-result.json"',
		),
	);
	assert.ok(fs.existsSync(matrixPath));
	assert.match(fs.readFileSync(matrixPath, "utf8"), /gate: "live-progression-matrix"/);
	assert.match(service, /data\.js/);
	assert.match(service, /verify-publication\.js/);
	assert.match(smoke, /combat_action/);
	assert.match(smoke, /skill_level_up/);
});

test("rollback process capture drains close and redacts before retention", async () => {
	const root = path.resolve(__dirname, "../../..");
	const rollback = fs.readFileSync(path.join(root, "scripts/rollback-drill.mjs"), "utf8");
	const start = rollback.indexOf("function runProcess(");
	const end = rollback.indexOf("\n\nasync function gitTreeRef", start);
	assert.notEqual(start, -1);
	assert.notEqual(end, -1);
	const { redactReleaseLog, assertRedactedReleaseLog } = await import(
		`${require("node:url").pathToFileURL(path.join(root, "scripts/release-log-policy.mjs")).href}?process=${Date.now()}`
	);
	const EventEmitter = require("node:events");
	const child = new EventEmitter();
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	const phases = [];
	const runProcess = vm.runInNewContext(`(${rollback.slice(start, end).trim()})`, {
		spawn: () => child,
		writeFile: async (...args) => {
			phases.push("write");
			return fs.promises.writeFile(...args);
		},
		redactReleaseLog: (...args) => {
			phases.push("redact");
			return redactReleaseLog(...args);
		},
		assertRedactedReleaseLog: (...args) => {
			phases.push("assert");
			return assertRedactedReleaseLog(...args);
		},
	});
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-rollback-process-"));
	const logPath = path.join(temporaryDirectory, "process.log");
	try {
		const pending = runProcess("synthetic", [], {}, logPath, root, { redact: true });
		child.stdout.emit("data", '{"password":"private"}\n');
		child.stderr.emit("data", "token=private-token\n");
		child.emit("exit", 0, null);
		child.stdout.emit("data", "after-exit-output\n");
		child.emit("close", 0, null);
		const result = await pending;
		assert.match(result.output, /password.*\[redacted\]/);
		assert.match(result.output, /after-exit-output/);
		assert.doesNotMatch(result.output, /private-token/);
		assert.equal(fs.readFileSync(logPath, "utf8"), result.output);
		assert.deepEqual(phases, ["redact", "assert", "write"]);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
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
		execFileSync("bash", ["-e", "-u", "-o", "pipefail", "-c", `${scanner}\nassert_release_logs_redacted`], {
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
		fs.writeFileSync(path.join(temporaryDirectory, "browser.log"), "password=private-browser-value\n");
		assert.throws(invoke);
		fs.writeFileSync(path.join(temporaryDirectory, "browser.log"), "release-safe important code=ability\n");
		fs.writeFileSync(path.join(childDirectory, "unsafe.log"), "password=private-value\n");
		assert.throws(invoke);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("release gate staging promotes redacted producer artifacts and rewrites retained paths", () => {
	const root = path.resolve(__dirname, "../../..");
	const verify = fs.readFileSync(path.join(root, "scripts/verify-skill-refactor.sh"), "utf8");
	const helperStartMarker = "# release-gate-artifact-helpers: begin";
	const helperEndMarker = "# release-gate-artifact-helpers: end";
	const gateStartMarker = "# release-gate-runner: begin";
	const gateEndMarker = "# release-gate-runner: end";
	const helperStart = verify.indexOf(helperStartMarker);
	const helperEnd = verify.indexOf(helperEndMarker, helperStart);
	const gateStart = verify.indexOf(gateStartMarker);
	const gateEnd = verify.indexOf(gateEndMarker, gateStart);
	assert.ok(helperStart >= 0 && helperEnd > helperStart);
	assert.ok(gateStart >= 0 && gateEnd > gateStart);
	assert.match(verify, /umask 077/);
	assert.match(verify, /redact_release_logs_in "\$GATE_STAGING_DIR"/);
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-gate-staging-"));
	const fakeRoot = path.join(temporaryDirectory, "root");
	const evidenceDirectory = path.join(temporaryDirectory, "evidence");
	const stagingDirectory = path.join(evidenceDirectory, ".staging");
	fs.mkdirSync(path.join(fakeRoot, "scripts"), { recursive: true, mode: 0o700 });
	fs.copyFileSync(
		path.join(root, "scripts/release-log-policy.mjs"),
		path.join(fakeRoot, "scripts/release-log-policy.mjs"),
	);
	fs.writeFileSync(
		path.join(fakeRoot, "scripts/validate-release-gate.mjs"),
		[
			"import { readFileSync } from 'node:fs';",
			"const [log, gate, database, result] = process.argv.slice(2);",
			"if (gate !== 'fake-gate' || database !== 'disposable' || !log.endsWith('live-service-smoke.stdout.log')) process.exit(1);",
			"if (!JSON.parse(readFileSync(result, 'utf8')).evidence) process.exit(1);",
		].join("\n") + "\n",
		{ mode: 0o600 },
	);
	const result = {
		evidence: path.join(stagingDirectory, "live-game-smoke.log"),
		auxiliary: { log: path.join(stagingDirectory, "auxiliary.log") },
		stdout_log: path.join(stagingDirectory, "live-service-smoke.stdout.log"),
		password: "private-result-secret",
	};
	const command = [
		"set -euo pipefail",
		verify.slice(helperStart, helperEnd + helperEndMarker.length),
		verify.slice(gateStart, gateEnd + gateEndMarker.length),
		"fake_gate() {",
		"  printf 'password=private\\n' > \"$GATE_STAGING_DIR/live-game-smoke.log\"",
		"  printf 'release-safe auxiliary\\n' > \"$GATE_STAGING_DIR/auxiliary.log\"",
		'  printf \'%s\\n\' "$FAKE_RESULT" > "$GATE_STAGING_DIR/gate-result.json"',
		"  printf '%s\\n' \"$FAKE_RESULT\"",
		"}",
		'run_typed_gate fake fake-gate disposable "$EVIDENCE_DIR/live-game-smoke.log" "$EVIDENCE_DIR/live-service-smoke.stdout.log" "$EVIDENCE_DIR/gate-result.json" fake_gate',
		'test -s "$EVIDENCE_DIR/live-game-smoke.log"',
		'test -s "$EVIDENCE_DIR/live-service-smoke.stdout.log"',
		'test -s "$EVIDENCE_DIR/gate-result.json"',
		'test -s "$EVIDENCE_DIR/auxiliary.log"',
		'test -d "$GATE_STAGING_DIR"',
	].join("\n");
	const runFixture = (fixtureResult, fixtureEvidence = evidenceDirectory) =>
		execFileSync("bash", ["-e", "-u", "-o", "pipefail", "-c", command], {
			cwd: root,
			env: {
				...process.env,
				ROOT_DIR: fakeRoot,
				EVIDENCE_DIR: fixtureEvidence,
				GATE_STAGING_DIR: path.join(fixtureEvidence, ".staging"),
				FAKE_RESULT: JSON.stringify(fixtureResult),
			},
			stdio: "pipe",
		});
	try {
		runFixture(result);
		assert.doesNotMatch(fs.readFileSync(path.join(evidenceDirectory, "live-game-smoke.log"), "utf8"), /private/);
		assert.doesNotMatch(fs.readFileSync(path.join(evidenceDirectory, "gate-result.json"), "utf8"), /\.staging/);
		assert.doesNotMatch(
			fs.readFileSync(path.join(evidenceDirectory, "live-service-smoke.stdout.log"), "utf8"),
			/\.staging/,
		);
		assert.doesNotMatch(fs.readFileSync(path.join(evidenceDirectory, "auxiliary.log"), "utf8"), /private/);
		assert.doesNotMatch(
			fs.readFileSync(path.join(evidenceDirectory, "gate-result.json"), "utf8"),
			/private-result-secret/,
		);
		assert.equal(fs.statSync(path.join(evidenceDirectory, "live-game-smoke.log")).mode & 0o777, 0o600);
		assert.equal(fs.statSync(evidenceDirectory).mode & 0o777, 0o700);
		assert.equal(fs.statSync(stagingDirectory).mode & 0o777, 0o700);
		const outOfTreeResult = {
			...result,
			auxiliary: { log: path.join(temporaryDirectory, "out-of-tree.log") },
		};
		const failedEvidenceDirectory = path.join(temporaryDirectory, "failed-evidence");
		assert.throws(() => runFixture(outOfTreeResult, failedEvidenceDirectory));
		for (const file of ["live-game-smoke.log", "live-service-smoke.stdout.log", "gate-result.json", "auxiliary.log"])
			assert.equal(fs.existsSync(path.join(failedEvidenceDirectory, file)), false);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("rollback validator accepts complete evidence and rejects malformed recovery claims", () => {
	const root = path.resolve(__dirname, "../../..");
	const validatorPath = path.join(root, "scripts/validate-release-gate.mjs");
	const priorRoot = execFileSync("git", ["rev-parse", "826f972"], { cwd: root, encoding: "utf8" }).trim();
	const treeRef = (entry) =>
		execFileSync("git", ["ls-tree", priorRoot, entry], { cwd: root, encoding: "utf8" }).trim().split(/\s+/)[2];
	const priorManifest = {
		schemaVersion: 1,
		root: priorRoot,
		game: treeRef("adventureland_mongodb"),
		service: treeRef("cjs-al-service"),
	};
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-rollback-validator-"));
	const logPath = path.join(temporaryDirectory, "rollback.log");
	const resultPath = path.join(temporaryDirectory, "rollback-result.json");
	const manifestPath = path.join(temporaryDirectory, "prior-release.json");
	const noMigrationPath = path.join(temporaryDirectory, "no-migration.json");
	const database = "skill-rollback-validator";
	const mutableCollections = [
		"backup",
		"character",
		"event",
		"guild",
		"infoelement",
		"ip",
		"mail",
		"mark",
		"message",
		"pet",
		"server",
		"upload",
		"user",
	];
	const result = {
		schemaVersion: 1,
		gate: "rollback-drill",
		ok: true,
		target: { database, disposable: true },
		evidence: logPath,
		cleanup: {
			verified: true,
			databaseDropped: true,
			mutableCounts: Object.fromEntries(mutableCollections.map((name) => [name, 0])),
		},
		processes: { stopped: true },
		reset: { mapHash: "map-hash", finalMapHash: "map-hash", mapCount: 1, seedHash: "seed-hash" },
		versionPreservation: { unchanged: true },
		serviceCleanup: { verified: true, separateDatabase: false, sharedDatabase: database },
		priorReleaseManifest: manifestPath,
		recovery: {
			verified: true,
			noMigration: true,
			noMigrationEvidence: noMigrationPath,
			priorReleaseParent: priorRoot,
		},
		rollback: {
			verified: true,
			mapsPlayable: true,
			failureObserved: true,
			oldPairBoot: {
				gameRef: priorManifest.game,
				serviceRef: priorManifest.service,
				gameServer: { worldVerified: true, portsClosed: true, stopped: true },
				serviceBuild: { built: true },
				serviceRuntime: {
					started: true,
					ready: true,
					ownsPublicAction: true,
					stopped: true,
					action: { status: "succeeded" },
				},
			},
			failureEvidence: { observed: true, kind: "post-reset-boot", portsClosed: true },
			writerGuardEvidence: { observed: true, kind: "writer-guard" },
		},
	};
	try {
		fs.writeFileSync(manifestPath, `${JSON.stringify(priorManifest)}\n`);
		fs.writeFileSync(noMigrationPath, JSON.stringify({ database, migrationCollections: [], migrationCommands: [] }));
		const runValidator = (candidate, expectedExit) => {
			fs.writeFileSync(resultPath, JSON.stringify(candidate));
			fs.writeFileSync(logPath, `${JSON.stringify(candidate)}\n`);
			const invoke = () =>
				execFileSync(process.execPath, [validatorPath, logPath, "rollback-drill", database, resultPath], {
					cwd: root,
					stdio: "pipe",
				});
			if (expectedExit) assert.throws(invoke);
			else assert.doesNotThrow(invoke);
		};
		runValidator(result, false);
		const malformedFailure = structuredClone(result);
		malformedFailure.rollback.failureEvidence.kind = "unexpected-source";
		runValidator(malformedFailure, true);
		const malformedNoMigration = structuredClone(result);
		malformedNoMigration.recovery.noMigration = false;
		fs.writeFileSync(
			noMigrationPath,
			JSON.stringify({ database, migrationCollections: ["character"], migrationCommands: ["copy"] }),
		);
		runValidator(malformedNoMigration, true);
		fs.rmSync(noMigrationPath);
		runValidator(result, true);
		fs.writeFileSync(noMigrationPath, JSON.stringify({ database, migrationCollections: [], migrationCommands: [] }));
		const staleNoMigration = structuredClone(result);
		staleNoMigration.recovery.noMigrationEvidence = path.join(temporaryDirectory, "missing-no-migration.json");
		runValidator(staleNoMigration, true);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("browser death expression executes and validator rejects malformed evidence", async () => {
	const root = path.resolve(__dirname, "../../..");
	const browser = fs.readFileSync(path.join(root, "scripts/browser-smoke.mjs"), "utf8");
	const expressionStartMarker = "const liveDeath = await cdp.evaluate(`";
	const expressionStart = browser.indexOf(expressionStartMarker);
	const findTemplateEnd = (source, start) => {
		let escaped = false;
		for (let index = start; index < source.length; index += 1) {
			const character = source[index];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (character === "\\") {
				escaped = true;
				continue;
			}
			if (character === "`") return index;
		}
		return -1;
	};
	const expressionEnd = findTemplateEnd(browser, expressionStart + expressionStartMarker.length);
	assert.notEqual(expressionStart, -1, "browser death expression was not found");
	assert.notEqual(expressionEnd, -1, "browser death expression terminator was not found");
	const expression = browser.slice(expressionStart + expressionStartMarker.length, expressionEnd);
	assert.doesNotThrow(() => new Function(expression));
	assert.equal((expression.match(/let currentTarget\s*=/g) || []).length, 1);
	assert.equal((expression.match(/const currentTarget\s*=/g) || []).length, 0);
	const createSocket = () => {
		const listeners = new Map();
		return {
			listeners,
			socket: {
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
			},
		};
	};
	const { listeners, socket } = createSocket();
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
	const originalUiLog = () => undefined;
	const windowContext = { entities: { [target.id]: target }, ui_log: originalUiLog };
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
		TextEncoder,
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
	socket.emit("hit", { id: character.name, hid: "other-monster", damage: 8, kill: true, source: "attack" });
	socket.emit("hit", { id: character.name, hid: target.id, damage: 10, kill: true, source: "attack" });
	socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: target.mtype,
		death_sickness_until: character.death_sickness_until,
	});
	socket.emit("game_log", "Death sickness applied for 5 minutes");
	character.rip = true;
	socket.emit("player");
	const liveDeath = await execution;
	assert.equal(liveDeath.terminal_hit.victim_id, character.name);
	assert.equal(liveDeath.terminal_hit.attacker_id, target.id);
	assert.equal(liveDeath.terminal_hit.response.monster, target.mtype);
	assert.equal(liveDeath.terminal_hit.event_index, 3);
	assert.equal(liveDeath.terminal_hit.response_event_index, 4);
	assert.equal(liveDeath.victim_id, character.name);
	assert.equal(
		[...listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(windowContext.ui_log, originalUiLog);

	const ambiguous = createSocket();
	const ambiguousCharacter = structuredClone(character);
	const ambiguousTarget = structuredClone(target);
	const ambiguousUiLog = () => undefined;
	const ambiguousWindow = {
		entities: { [ambiguousTarget.id]: ambiguousTarget },
		ui_log: ambiguousUiLog,
	};
	const ambiguousExecution = vm.runInNewContext(`(${expression})`, {
		character: ambiguousCharacter,
		G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
		window: ambiguousWindow,
		socket: ambiguous.socket,
		smart_move: async () => undefined,
		use_ability: async (name, id) => {
			ambiguousTarget.target = ambiguousCharacter.name;
			return { success: true, id: String(id), place: name };
		},
		TextEncoder,
		setTimeout,
		clearTimeout,
	});
	await new Promise((resolve) => setImmediate(resolve));
	ambiguous.socket.emit("hit", {
		id: ambiguousCharacter.name,
		hid: ambiguousTarget.id,
		damage: 10,
		kill: true,
		source: "attack",
	});
	ambiguous.socket.emit("hit", { id: ambiguousCharacter.name, kill: true });
	ambiguous.socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: ambiguousTarget.mtype,
		death_sickness_until: ambiguousCharacter.death_sickness_until,
	});
	ambiguousCharacter.rip = true;
	ambiguous.socket.emit("player");
	const ambiguousDeath = await ambiguousExecution;
	assert.equal(ambiguousDeath.terminal_hit, null);
	assert.equal(
		[...ambiguous.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(ambiguousWindow.ui_log, ambiguousUiLog);

	const sameTypeOther = createSocket();
	const sameTypeOtherCharacter = structuredClone(character);
	sameTypeOtherCharacter.rip = false;
	const sameTypeOtherTarget = structuredClone(target);
	const sameTypeOtherUiLog = () => undefined;
	const sameTypeOtherWindow = {
		entities: { [sameTypeOtherTarget.id]: sameTypeOtherTarget },
		ui_log: sameTypeOtherUiLog,
	};
	const sameTypeOtherExecution = vm.runInNewContext(`(${expression})`, {
		character: sameTypeOtherCharacter,
		G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
		window: sameTypeOtherWindow,
		socket: sameTypeOther.socket,
		smart_move: async () => undefined,
		use_ability: async (name, id) => {
			sameTypeOtherTarget.target = sameTypeOtherCharacter.name;
			return { success: true, id: String(id), place: name };
		},
		TextEncoder,
		setTimeout,
		clearTimeout,
	});
	await new Promise((resolve) => setImmediate(resolve));
	sameTypeOther.socket.emit("hit", {
		id: sameTypeOtherCharacter.name,
		hid: "same-type-other-monster",
		damage: 10,
		kill: true,
		source: "attack",
	});
	sameTypeOther.socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: sameTypeOtherTarget.mtype,
		death_sickness_until: sameTypeOtherCharacter.death_sickness_until,
	});
	sameTypeOtherCharacter.rip = true;
	sameTypeOther.socket.emit("player");
	const sameTypeOtherDeath = await sameTypeOtherExecution;
	assert.equal(sameTypeOtherDeath.terminal_hit, null);
	assert.equal(
		[...sameTypeOther.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(sameTypeOtherWindow.ui_log, sameTypeOtherUiLog);

	const executeExpression = ({
		failureCharacter,
		failureWindow,
		failureSocket,
		useAbility,
		scheduler = setTimeout,
		clearScheduler = clearTimeout,
	}) =>
		vm.runInNewContext(`(${expression})`, {
			character: failureCharacter,
			G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
			window: failureWindow,
			socket: failureSocket,
			smart_move: async () => undefined,
			use_ability: useAbility,
			TextEncoder,
			setTimeout: scheduler,
			clearTimeout: clearScheduler,
		});
	const createTrackedScheduler = () => {
		const scheduled = new Set();
		const cleared = new Set();
		return {
			scheduled,
			cleared,
			schedule(callback, delayMs) {
				const timer = setTimeout(callback, delayMs);
				scheduled.add(timer);
				return timer;
			},
			clear(timer) {
				cleared.add(timer);
				clearTimeout(timer);
			},
		};
	};
	const noTargetSocket = createSocket();
	const noTargetUiLog = () => undefined;
	const noTargetWindow = { entities: {}, ui_log: noTargetUiLog };
	const noTargetTimers = createTrackedScheduler();
	const noTargetExecution = executeExpression({
		failureCharacter: structuredClone(character),
		failureWindow: noTargetWindow,
		failureSocket: noTargetSocket.socket,
		useAbility: async () => ({ success: true }),
		scheduler: noTargetTimers.schedule,
		clearScheduler: noTargetTimers.clear,
	});
	await assert.rejects(noTargetExecution, /no live monster/);
	assert.equal(noTargetTimers.cleared.size, noTargetTimers.scheduled.size);
	assert.equal(
		[...noTargetSocket.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(noTargetWindow.ui_log, noTargetUiLog);

	const actionErrorSocket = createSocket();
	const actionErrorCharacter = structuredClone(character);
	const actionErrorTarget = structuredClone(target);
	const actionErrorUiLog = () => undefined;
	const actionErrorWindow = { entities: { [actionErrorTarget.id]: actionErrorTarget }, ui_log: actionErrorUiLog };
	const actionErrorTimers = createTrackedScheduler();
	const actionErrorExecution = executeExpression({
		failureCharacter: actionErrorCharacter,
		failureWindow: actionErrorWindow,
		failureSocket: actionErrorSocket.socket,
		useAbility: async () => ({ success: false }),
		scheduler: actionErrorTimers.schedule,
		clearScheduler: actionErrorTimers.clear,
	});
	await assert.rejects(actionErrorExecution, /taunt was rejected/);
	assert.equal(actionErrorTimers.cleared.size, actionErrorTimers.scheduled.size);
	assert.equal(
		[...actionErrorSocket.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(actionErrorWindow.ui_log, actionErrorUiLog);

	const timeoutSocket = createSocket();
	const timeoutCharacter = structuredClone(character);
	const timeoutTarget = structuredClone(target);
	const timeoutUiLog = () => undefined;
	const timeoutWindow = { entities: { [timeoutTarget.id]: timeoutTarget }, ui_log: timeoutUiLog };
	let timeoutCallback;
	let timeoutCleared = false;
	const timeoutExecution = executeExpression({
		failureCharacter: timeoutCharacter,
		failureWindow: timeoutWindow,
		failureSocket: timeoutSocket.socket,
		useAbility: async (name, id) => {
			timeoutTarget.target = timeoutCharacter.name;
			return { success: true, id: String(id), place: name };
		},
		scheduler: (callback, delayMs) => {
			if (delayMs === 10_000) {
				timeoutCallback = callback;
				return "synthetic-timeout";
			}
			return setTimeout(callback, delayMs);
		},
		clearScheduler: (timer) => {
			if (timer === "synthetic-timeout") timeoutCleared = true;
			else clearTimeout(timer);
		},
	});
	assert.equal(typeof timeoutCallback, "function");
	timeoutCallback();
	await assert.rejects(timeoutExecution, /did not publish death sickness/);
	assert.equal(timeoutCleared, true);
	assert.equal(
		[...timeoutSocket.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(timeoutWindow.ui_log, timeoutUiLog);

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
		character: "hero",
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
						event_index: 3,
						response_event_index: 4,
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
	const runValidator = (
		candidate,
		expectedExit = false,
		expectedGate = "browser-smoke",
		expectedDatabase = "skill-reset-test",
	) => {
		fs.writeFileSync(resultPath, JSON.stringify(candidate));
		fs.writeFileSync(logPath, `${JSON.stringify(candidate)}\n`);
		const invoke = () =>
			execFileSync(process.execPath, [validatorPath, logPath, expectedGate, expectedDatabase, resultPath], {
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
		const negativeIndexes = structuredClone(result);
		negativeIndexes.browser.ui.liveDeath.terminal_hit.event_index = -1;
		negativeIndexes.browser.ui.liveDeath.terminal_hit.response_event_index = 0;
		runValidator(negativeIndexes, true);
		const mismatchedOuterIdentity = structuredClone(result);
		mismatchedOuterIdentity.character = "other-player";
		runValidator(mismatchedOuterIdentity, true);
		const emptyOuterIdentity = structuredClone(result);
		emptyOuterIdentity.character = "";
		runValidator(emptyOuterIdentity, true);
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
		oversizedResponses.browser.ui.liveDeath.responses = [
			...result.browser.ui.liveDeath.responses,
			...Array.from({ length: 16 }, () => ({ response: "noise" })),
		];
		runValidator(oversizedResponses, true);
		const unknownResponseField = structuredClone(result);
		unknownResponseField.browser.ui.liveDeath.responses[0].secret = "unexpected";
		runValidator(unknownResponseField, true);
		const unknownTerminalResponseField = structuredClone(result);
		unknownTerminalResponseField.browser.ui.liveDeath.terminal_hit.response.secret = "unexpected";
		runValidator(unknownTerminalResponseField, true);
		const oversizedLog = structuredClone(result);
		oversizedLog.browser.ui.liveDeath.serverLogs = ["Death sickness applied for 5 minutes", "x".repeat(257)];
		runValidator(oversizedLog, true);
		const multibyteOversizedLog = structuredClone(result);
		multibyteOversizedLog.browser.ui.liveDeath.serverLogs = ["Death sickness applied for 5 minutes", "é".repeat(200)];
		runValidator(multibyteOversizedLog, true);
		runValidator(result, true, "unsupported-gate");
		runValidator(result, true, "browser-smoke", "other-database");
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});
