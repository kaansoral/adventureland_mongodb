"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("live progression release validation covers contribution maps, curves, events, and Merchant edges", () => {
	const root = path.resolve(__dirname, "../../..");
	const validatorPath = path.join(root, "scripts/validate-release-gate.mjs");
	const fixturePath = path.join(__dirname, "fixtures/live-progression-matrix-result.json");
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-live-contract-"));
	const logPath = path.join(temporaryDirectory, "live.log");
	const resultPath = path.join(temporaryDirectory, "live-result.json");
	const result = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
	result.target = { database: "skill-smoke-test", disposable: true };
	result.evidence = logPath;
	const refreshSicknessTimestamps = (evidence, timestamp) => {
		if (!evidence || typeof evidence !== "object") return;
		for (const [key, value] of Object.entries(evidence)) {
			if (key === "sickness_until" || key === "death_sickness_until")
				evidence[key] = timestamp;
			else if (value && typeof value === "object")
				refreshSicknessTimestamps(value, timestamp);
		}
	};
	const deathSickness = result.scenarios.deathSickness;
	const firstSickness = Date.now() + 240_000;
	refreshSicknessTimestamps(deathSickness.first_death, firstSickness);
	refreshSicknessTimestamps(deathSickness.second_death, firstSickness + 1_000);
	for (const source of ["environmental", "safe_pvp", "global_pvp", "hardcore"])
		refreshSicknessTimestamps(deathSickness[source], firstSickness);
	const runValidator = (candidate, expectedExit = false) => {
		fs.writeFileSync(resultPath, JSON.stringify(candidate));
		fs.writeFileSync(logPath, `${JSON.stringify(candidate)}\n`);
		const invoke = () =>
			execFileSync(process.execPath, [validatorPath, logPath, "live-progression-matrix", "skill-smoke-test", resultPath], {
				cwd: root,
				stdio: "pipe",
			});
		if (expectedExit) assert.throws(invoke);
		else assert.doesNotThrow(invoke);
	};
	try {
		runValidator(result);
		const mutations = [
			(candidate) => { candidate.scenarios.freshCharacter.fixture.total_level = 6; },
			(candidate) => { candidate.scenarios.gatedGear.below.state_unchanged = false; },
			(candidate) => { candidate.scenarios.gatedGear.threshold_fixture.skills.merchant = 20; },
			(candidate) => { candidate.scenarios.gatedGear.at_threshold.reconnect_total_level = 84; },
			(candidate) => { candidate.scenarios.rankings.passed = false; },
			(candidate) => { candidate.scenarios.rankings.merchant_order.pop(); },
			(candidate) => { candidate.scenarios.rankings.merchant_order[0] = candidate.scenarios.rankings.merchant_order[1]; },
			(candidate) => { candidate.scenarios.rankings.merchants_open_stands.push("RankTieLowijbk"); },
			(candidate) => delete candidate.scenarios.contributions.persisted.skill_xp_delta.merchant,
			(candidate) => delete candidate.scenarios.contributions.live_action.skill_xp_events[0].skills.merchant,
			(candidate) => { candidate.scenarios.contributions.live_action.skill_xp_events[0].skills.warrior.maxXp += 1; },
			(candidate) => candidate.scenarios.contributions.live_action.skill_xp_events.forEach((event) => { event.accepted_xp = 0; }),
			(candidate) => { candidate.scenarios.merchant.live.open_status = "failed"; },
			(candidate) => { candidate.scenarios.merchant.canonical.cap_fixture.pending_credit_expiry_pruned = false; },
			(candidate) => { candidate.scenarios.merchant.persisted.luck_targets = []; },
		];
		for (const mutate of mutations) {
			const malformed = structuredClone(result);
			mutate(malformed);
			runValidator(malformed, true);
		}
		const missingHardcoreSkillEvidence = structuredClone(result);
		delete missingHardcoreSkillEvidence.scenarios.deathSickness.hardcore.skill_xp_before;
		runValidator(missingHardcoreSkillEvidence, true);
		const unavailableHardcoreItemEvidence = structuredClone(result);
		unavailableHardcoreItemEvidence.scenarios.deathSickness.hardcore.xptome_runtime_present = false;
		runValidator(unavailableHardcoreItemEvidence, true);
		const zeroHardcoreSkillBaseline = structuredClone(result);
		zeroHardcoreSkillBaseline.scenarios.deathSickness.hardcore.hardcore_reset_baseline.skill_xp_nonzero = false;
		runValidator(zeroHardcoreSkillBaseline, true);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});
