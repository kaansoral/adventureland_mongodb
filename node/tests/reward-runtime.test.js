"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const serverSource = fs.readFileSync(path.join(root, "node/server.js"), "utf8");

function loadIssuePlayerAward(context) {
	const start = serverSource.indexOf("function issue_player_award(");
	const end = serverSource.indexOf("\nfunction commence_attack", start);
	assert.notEqual(start, -1);
	assert.ok(end > start);
	return vm.runInNewContext(`(${serverSource.slice(start, end)})`, context);
}

function player(name, overrides = {}) {
	const emitted = [];
	return {
		name,
		map: "arena",
		gold: 1000,
		kills: 0,
		party: null,
		socket: { emit: (...args) => emitted.push(args) },
		resends: [],
		emitted,
		...overrides,
	};
}

function awardContext(players = {}, parties = {}, nameToId = {}) {
	return {
		G: { maps: { arena: { safe_pvp: false } } },
		gameplay: "test",
		mode: { log_pvp: false },
		max: Math.max,
		min: Math.min,
		round: Math.round,
		floor: Math.floor,
		maxCombatLevel: () => 1,
		is_pvp: () => true,
		is_same: () => false,
		is_in_pvp: () => false,
		refreshDeathSickness: () => {},
		sicknessDelta: () => ({ death_sickness_until: null }),
		drop_something_hardcore: () => {},
		drop_something_pvp: () => {},
		appengine_log: () => {},
		to_pretty_num: String,
		pwns: [],
		pend: 0,
		players,
		parties,
		name_to_id: nameToId,
		resend: (current, events) => current.resends.push({ events, gold: current.gold }),
	};
}

test("PvP gold awards publish the updated solo character balance", () => {
	const attacker = player("attacker");
	const target = player("target");
	const issuePlayerAward = loadIssuePlayerAward(awardContext());

	issuePlayerAward(attacker, target);

	assert.equal(attacker.gold, 1090);
	assert.deepEqual(attacker.resends, [{ events: "reopen", gold: 1090 }]);
});

test("PvP gold awards publish the updated balance for every party member", () => {
	const attacker = player("attacker", { party: "party" });
	const member = player("member", { party: "party" });
	const target = player("target");
	const issuePlayerAward = loadIssuePlayerAward(
		awardContext(
			{ attackerId: attacker, memberId: member },
			{ party: ["attacker", "member"] },
			{ attacker: "attackerId", member: "memberId" },
		),
	);

	issuePlayerAward(attacker, target);

	assert.equal(attacker.gold, 1045);
	assert.equal(member.gold, 1045);
	assert.deepEqual(attacker.resends, [{ events: "reopen", gold: 1045 }]);
	assert.deepEqual(member.resends, [{ events: "reopen", gold: 1045 }]);
});

test("slot gold rewards publish the updated character balance", () => {
	const start = serverSource.indexOf('if (name == "slots") {');
	const end = serverSource.indexOf("\n\t\t\t\t\t} else {", start);
	assert.notEqual(start, -1);
	assert.ok(end > start);
	const slotReward = serverSource.slice(start, end);

	assert.match(slotReward, /player\.gold \+= gold/);
	assert.match(slotReward, /player\.socket\.emit\("game_log", \{ message: "Received/);
	assert.match(slotReward, /\n\s+resend\(player, "reopen"\);/);
});
