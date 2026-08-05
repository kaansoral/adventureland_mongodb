"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createCharacterState } = require("../game/character_state");
const {
	initializePlayerProgression,
	awardPlayerSkillXp,
	awardPlayerSkillXpSplit,
	flushPlayerProgressionEvents,
	clientSkillState,
	markStandSession,
	settlePlayerStand,
	recordMerchantSale,
	recordMerchantSaleReversal,
	refreshDeathSickness,
	rehydratePlayerDeathSickness,
} = require("../game/progression_runtime");
const { cumulativeXp } = require("../game/skill_domain");
const { progression } = require("../../design/progression");

function player() {
	const state = createCharacterState();
	return {
		id: "character",
		total_level: state.total_level,
		p: {},
		t: {},
		info: { skills: state.skills },
		socket: {
			events: [],
			emit(name, value) {
				this.events.push([name, value]);
			},
		},
	};
}

function serverFunction(source, startMarker, endMarker, context) {
	const start = source.indexOf(startMarker);
	const end = source.indexOf(endMarker, start);
	assert.notEqual(start, -1, `server source is missing ${startMarker}`);
	assert.notEqual(end, -1, `server source is missing ${endMarker}`);
	return vm.runInNewContext(`(${source.slice(start, end).trim()})`, context);
}

test("runtime requires persisted info.skills and repairs only the flattened alias", () => {
	const state = createCharacterState();
	const character = player();
	character.skills = createCharacterState().skills;
	character.skills.warrior = { level: 2, xp: 100000 };
	initializePlayerProgression(character, 0);
	assert.equal(character.skills, character.info.skills);
	assert.equal(character.skills.warrior.level, 1);

	const legacyOnly = { id: "legacy", total_level: state.total_level, skills: state.skills, info: {}, p: {}, t: {} };
	assert.throws(() => initializePlayerProgression(legacyOnly, 0), { code: "invalid_character_skill_state" });
});

test("runtime awards persist complete skill deltas and reject replay", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	const first = awardPlayerSkillXp(character, "warrior", 100, {
		source: "pve_damage",
		sourceId: "encounter:1:warrior",
	});
	assert.equal(first.accepted_xp, 100);
	assert.equal(character.skills.warrior.xp, 100);
	assert.equal(character.t.skill_xp.warrior, 100);
	assert.equal(character.socket.events.length, 0);
	assert.equal(character.progression_events.length, 1);
	assert.deepEqual(Object.keys(character.progression_events[0].skills), [
		"warrior",
		"paladin",
		"mage",
		"priest",
		"ranger",
		"rogue",
		"merchant",
	]);
	assert.equal(flushPlayerProgressionEvents(character), 1);
	assert.equal(character.socket.events[0][0], "skill_xp");
	const skillXp = character.socket.events[0][1];
	assert.deepEqual(
		Object.keys(skillXp).sort(),
		["accepted_xp", "discarded_xp", "from_level", "max_xp", "skill", "skills", "to_level", "total_level", "xp"].sort(),
	);
	assert.equal(skillXp.levels_gained, undefined);
	assert.deepEqual(skillXp.skills.warrior, { level: 1, xp: 100, max_xp: 93711 });
	assert.deepEqual(skillXp.skills.merchant, { level: 1, xp: 0, max_xp: 93711 });
	const duplicate = awardPlayerSkillXp(character, "warrior", 100, {
		source: "pve_damage",
		sourceId: "encounter:1:warrior",
	});
	assert.equal(duplicate.duplicate, true);
	assert.equal(character.skills.warrior.xp, 100);
});

test("runtime emits exact multi-level snapshots and suppresses replay events", () => {
	const character = player();
	character.info.skills.warrior = { level: 1, xp: cumulativeXp(2) - 1 };
	character.total_level = 7;
	initializePlayerProgression(character, 0);
	const requestedXp = cumulativeXp(4) - character.skills.warrior.xp + 1;
	const delta = awardPlayerSkillXp(character, "warrior", requestedXp, {
		source: "pve_damage",
		sourceId: "encounter:multi-level",
	});
	assert.deepEqual(delta, {
		skill: "warrior",
		accepted_xp: requestedXp,
		discarded_xp: 0,
		from_level: 1,
		to_level: 4,
		levels_gained: 3,
		xp: cumulativeXp(4) + 1,
		max_xp: cumulativeXp(5),
		total_level: 10,
	});
	assert.equal(flushPlayerProgressionEvents(character), 1);
	assert.deepEqual(character.socket.events, [
		[
			"skill_xp",
			{
				accepted_xp: requestedXp,
				discarded_xp: 0,
				from_level: 1,
				to_level: 4,
				xp: cumulativeXp(4) + 1,
				max_xp: cumulativeXp(5),
				total_level: 10,
				skill: "warrior",
				skills: {
					warrior: { level: 4, xp: cumulativeXp(4) + 1, max_xp: cumulativeXp(5) },
					paladin: { level: 1, xp: 0, max_xp: cumulativeXp(2) },
					mage: { level: 1, xp: 0, max_xp: cumulativeXp(2) },
					priest: { level: 1, xp: 0, max_xp: cumulativeXp(2) },
					ranger: { level: 1, xp: 0, max_xp: cumulativeXp(2) },
					rogue: { level: 1, xp: 0, max_xp: cumulativeXp(2) },
					merchant: { level: 1, xp: 0, max_xp: cumulativeXp(2) },
				},
			},
		],
		[
			"skill_level_up",
			{ skill: "warrior", from_level: 1, to_level: 4, levels_gained: 3, total_level: 10 },
		],
	]);
	const duplicate = awardPlayerSkillXp(character, "warrior", requestedXp, {
		source: "pve_damage",
		sourceId: "encounter:multi-level",
	});
	assert.equal(duplicate.duplicate, true);
	assert.equal(flushPlayerProgressionEvents(character), 0);
	assert.equal(character.socket.events.length, 2);
});

test("runtime keeps full player snapshots at the last emitted progression state", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	const before = clientSkillState(character);

	awardPlayerSkillXp(character, "warrior", 100, { source: "pve_damage" });

	assert.equal(character.skills.warrior.xp, 100);
	assert.equal(clientSkillState(character).warrior.xp, before.warrior.xp);
	assert.equal(character.progression_client_skills.warrior.xp, before.warrior.xp);

	flushPlayerProgressionEvents(character);
	assert.equal(clientSkillState(character).warrior.xp, 100);
});

test("queued multi-style progression preserves protocol snapshots and excludes runtime state", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	character.active_skill = "warrior";
	character.citems = [];
	character.cslots = {};
	character.q = {};
	const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
	const serializerContext = {
		G: { skill_xp: {} },
		MAX_LEVEL: 99,
		SKILL_IDS: Object.keys(character.skills),
		clientSkillState,
		cumulativeXp: (level) => level * 100,
		get_call_cost: () => 0,
	};
	const playerToClient = serverFunction(
		serverSource,
		"function player_to_client(player, stranger)",
		"\nfunction monster_to_client",
		serializerContext,
	);
	const playerToServer = serverFunction(
		serverSource,
		"function player_to_server(player, place)",
		"\nfunction player_to_client",
		{ in_arr: (value, values) => values.includes(value) },
	);
	const labels = ["start", "resend", "reconnect"];
	const before = Object.fromEntries(labels.map((label) => [label, playerToClient(character)]));
	assert.deepEqual(
		labels.map((label) => [label, before[label].skills.warrior.xp, before[label].skills.rogue.xp]),
		labels.map((label) => [label, 0, 0]),
	);

	awardPlayerSkillXpSplit(character, { warrior: 100, rogue: 200 }, { source: "pve_damage", sourceId: "queued:styles" });
	assert.equal(character.progression_events.length, 2);
	const pending = Object.fromEntries(labels.map((label) => [label, playerToClient(character)]));
	for (const label of labels) {
		assert.equal(pending[label].skills.warrior.xp, 0);
		assert.equal(pending[label].skills.rogue.xp, 0);
		assert.equal(pending[label].total_level, 7);
	}
	const serializedPlayer = playerToServer(character);
	assert.equal(Object.hasOwn(serializedPlayer, "progression_events"), false);
	assert.equal(Object.hasOwn(serializedPlayer, "progression_client_skills"), false);
	assert.equal(JSON.stringify(character).includes("progression_client_skills"), false);

	assert.equal(flushPlayerProgressionEvents(character), 2);
	const skillEvents = character.socket.events.filter(([name]) => name === "skill_xp");
	assert.equal(skillEvents.length, 2);
	assert.equal(skillEvents[0][1].skill, "warrior");
	assert.equal(skillEvents[0][1].skills.warrior.xp, 100);
	assert.equal(skillEvents[0][1].skills.rogue.xp, 0);
	assert.equal(skillEvents[1][1].skill, "rogue");
	assert.equal(skillEvents[1][1].skills.warrior.xp, 100);
	assert.equal(skillEvents[1][1].skills.rogue.xp, 200);
	const after = Object.fromEntries(labels.map((label) => [label, playerToClient(character)]));
	for (const label of labels) {
		assert.equal(after[label].skills.warrior.xp, 100);
		assert.equal(after[label].skills.rogue.xp, 200);
		assert.equal(after[label].total_level, 7);
	}
});

test("runtime rejects unclassified XP sources without mutating the character", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	const before = {
		skills: structuredClone(character.skills),
		total_level: character.total_level,
		t: structuredClone(character.t),
		p: structuredClone(character.p),
		events: character.progression_events,
	};
	assert.throws(
		() =>
			awardPlayerSkillXp(character, "warrior", 1, {
				source: "unclassified_source",
				sourceId: "unclassified:1",
			}),
		(error) =>
			error.code === "invalid_skill_delta" && error.path === "source" && error.reason === "unclassified_source",
	);
	assert.deepEqual(
		{
			skills: character.skills,
			total_level: character.total_level,
			t: character.t,
			p: character.p,
			events: character.progression_events,
		},
		before,
	);
});

test("runtime stand settlement feeds Merchant through the common award path", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 0);
	markStandSession(character, 0);
	const settled = settlePlayerStand(character, 3600000);
	assert.equal(settled.xp, Math.floor(3125000 / 7));
	assert.equal(character.skills.merchant.xp, settled.xp);
	assert.equal(character.skills.merchant.level, 3);
	assert.equal(character.total_level, 9);
	assert.equal(flushPlayerProgressionEvents(character), 1);
});

test("runtime merchant sale bridges require a stable character owner", () => {
	const character = player();
	character.real_id = "character-real-id";
	initializePlayerProgression(character, 0);
	assert.throws(
		() =>
			recordMerchantSale(character, {
				merchantOwnerId: character.name || "character",
				externalOwnerId: "buyer-owner",
				goldReceived: 1000,
				serverTax: 50,
				sourceId: "sale:wrong-owner",
				now: 0,
			}),
		{ code: "invalid_merchant_owner" },
	);
	const sale = recordMerchantSale(character, {
		merchantOwnerId: character.real_id,
		externalOwnerId: "buyer-owner",
		goldReceived: 1000,
		serverTax: 50,
		sourceId: "sale:stable-owner",
		now: 0,
	});
	assert.equal(sale.eligible, true);
	const reversal = recordMerchantSaleReversal(character, {
		merchantOwnerId: character.real_id,
		externalOwnerId: "buyer-owner",
		goldReversed: 1000,
		sourceId: "buyback:stable-owner",
		now: 1,
	});
	assert.equal(reversal.eligible, false);
});

test("runtime stand settlement advances the persisted clock between ticks", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 0);
	markStandSession(character, 0);
	const first = settlePlayerStand(character, 3600000);
	const second = settlePlayerStand(character, 7200000);
	assert.equal(first.xp, Math.floor(3125000 / 7));
	assert.equal(second.xp, Math.floor((3125000 * 2) / 7) - first.xp);
	assert.equal(character.skills.merchant.xp, Math.floor((3125000 * 2) / 7));
	assert.equal(character.p.stand_last_settled_at, 7200000);
	assert.equal(flushPlayerProgressionEvents(character), 2);
});

test("runtime reopens a persisted stand at the current server time", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 4000000);
	character.info.merchant_accrual.eligible_stand_ms = 123456;
	initializePlayerProgression(character, 5000000);
	assert.equal(character.p.stand_last_settled_at, 5000000);
	const settled = settlePlayerStand(character, 5000000 + 3600000);
	assert.equal(settled.xp, Math.floor(3125000 / 7));
});

test("runtime stand settlement remains exact across close, logout, death, and restart lifecycles", () => {
	const character = player();
	character.p.stand = "stand0";
	initializePlayerProgression(character, 0);
	markStandSession(character, 0);
	const partitions = [1, 999999, 1234567, 1365433];
	let now = 0;
	let xp = 0;
	for (let hour = 0; hour < 2016; hour += 1) {
		for (const elapsed of partitions) {
			now += elapsed;
			const settled = settlePlayerStand(character, now);
			xp += settled.xp;
		}
		if (hour === 511 || hour === 1023 || hour === 1535) {
			const persisted = structuredClone(character.info.merchant_accrual);
			character.p.stand = null;
			character.socket = null;
			const closed = settlePlayerStand(character, now + progression.STAND_HOUR_MS);
			assert.equal(closed.xp, 0);
			assert.deepEqual(character.info.merchant_accrual, persisted);
			character.socket = {
				events: [],
				emit(name, value) {
					this.events.push([name, value]);
				},
			};
			character.p.stand = "stand0";
			initializePlayerProgression(character, now);
			assert.deepEqual(character.info.merchant_accrual, persisted);
		}
		if (hour === 767) {
			character.rip = true;
			const dead = settlePlayerStand(character, now + progression.STAND_HOUR_MS);
			assert.equal(dead.xp, 0);
			character.rip = false;
			initializePlayerProgression(character, now);
		}
	}
	assert.equal(xp, 900000000);
	assert.equal(character.skills.merchant.xp, 900000000);
	assert.equal(character.total_level, 105);
	assert.equal(character.info.merchant_accrual.eligible_stand_ms, 2016 * progression.STAND_HOUR_MS);
});

test("runtime split awards commit all styles and reject backward stand time", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	const deltas = awardPlayerSkillXpSplit(
		character,
		{ warrior: 100, rogue: 200 },
		{ source: "pve_damage", sourceId: "encounter:split" },
	);
	assert.deepEqual(
		deltas.map((delta) => delta.skill),
		["warrior", "rogue"],
	);
	assert.equal(character.skills.warrior.xp, 100);
	assert.equal(character.skills.rogue.xp, 200);
	assert.equal(character.p.skill_xp_sources.length, 2);
	const duplicate = awardPlayerSkillXpSplit(
		character,
		{ warrior: 100, rogue: 200 },
		{ source: "pve_damage", sourceId: "encounter:split" },
	);
	assert.ok(duplicate.every((delta) => delta.duplicate));
	character.p.stand = "stand0";
	markStandSession(character, 100);
	const backward = settlePlayerStand(character, 50);
	assert.equal(backward.xp, 0);
	assert.equal(character.p.stand_last_settled_at, 100);
});

test("skill XP replay records are bounded and expire without losing in-window deduplication", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	awardPlayerSkillXp(character, "warrior", 1, {
		source: "pve_damage",
		sourceId: "expiring-source",
		now: 0,
	});
	assert.deepEqual(character.p.skill_xp_sources, [
		{ source_id: "expiring-source", expires_at: progression.SKILL_XP_SOURCE_RETENTION_MS },
	]);
	const duplicate = awardPlayerSkillXp(character, "warrior", 1, {
		source: "pve_damage",
		sourceId: "expiring-source",
		now: 0,
	});
	assert.equal(duplicate.duplicate, true);
	const afterExpiry = awardPlayerSkillXp(character, "warrior", 1, {
		source: "pve_damage",
		sourceId: "expiring-source",
		now: progression.SKILL_XP_SOURCE_RETENTION_MS + 1,
	});
	assert.notEqual(afterExpiry.duplicate, true);

	for (let index = 0; index < progression.MAX_SKILL_XP_SOURCES + 25; index += 1) {
		awardPlayerSkillXp(character, "warrior", 1, {
			source: "pve_damage",
			sourceId: `source-${index}`,
			now: progression.SKILL_XP_SOURCE_RETENTION_MS + 1,
		});
	}
	assert.equal(character.p.skill_xp_sources.length, progression.MAX_SKILL_XP_SOURCES);
});

test("runtime death sickness persists and clears by absolute timestamp", () => {
	const character = player();
	initializePlayerProgression(character, 0);
	assert.equal(refreshDeathSickness(character, 1000), 301000);
	assert.deepEqual(character.s.death_sickness, { ms: 300000 });
	assert.equal(rehydratePlayerDeathSickness(character, 300999), 301000);
	assert.deepEqual(character.s.death_sickness, { ms: 1 });
	assert.equal(rehydratePlayerDeathSickness(character, 301000), null);
	assert.equal(character.info.death_sickness_until, null);
	assert.equal(character.s.death_sickness, undefined);
});
