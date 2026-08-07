"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("disposable smoke target guards use the scoped database prefix", () => {
	const root = path.resolve(__dirname, "../../..");
	const sources = [
		fs.readFileSync(path.join(root, "scripts/browser-smoke.mjs"), "utf8"),
		fs.readFileSync(path.join(root, "scripts/cleanup-browser-smoke.mjs"), "utf8"),
		fs.readFileSync(path.join(root, "cjs-al-service/tools/live-game-smoke.mjs"), "utf8"),
		fs.readFileSync(path.join(root, "cjs-al-service/tools/live-progression-matrix.mjs"), "utf8"),
	];
	const legacyPrefix = ["skill", "-", "reset"].join("");
	for (const source of sources) {
		assert.match(source, /skill-smoke-/);
		assert.equal(source.includes(legacyPrefix), false);
	}
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
