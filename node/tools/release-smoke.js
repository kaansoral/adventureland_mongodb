"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createCharacterState } = require("../game/character_state");
const { deriveActiveSkill, WEAPON_PROFILES } = require("../game/active_skill");
const { SKILL_IDS } = require("../game/skill_domain");
const { buildStarterLoadout } = require("../game/starter_loadout");
const {
	awardPlayerSkillXp,
	flushPlayerProgressionEvents,
	initializePlayerProgression,
} = require("../game/progression_runtime");
const { loadBenchmarkData } = require("./progression-benchmark");

const GAME_ROOT = path.resolve(__dirname, "../..");
const PROJECT_ROOT = path.resolve(GAME_ROOT, "..");

function emitLog(lines, kind, data) {
	const record = Object.freeze({ at: new Date().toISOString(), kind, ...data });
	lines.push(JSON.stringify(record));
	process.stdout.write(`${JSON.stringify(record)}\n`);
}

async function main() {
	const data = loadBenchmarkData();
	const created = createCharacterState();
	assert.deepEqual(Object.keys(created.skills), SKILL_IDS);
	assert.equal(created.total_level, SKILL_IDS.length);
	assert.ok(data.items.blade, "the canonical starter blade must be published");
	assert.equal(data.items.blade.type, "weapon");
	assert.ok(WEAPON_PROFILES[data.items.blade.wtype], "the starter blade must have a combat profile");
	const starter = buildStarterLoadout(data.character);

	const lines = [];
	const player = {
		id: "release-smoke-character",
		name: "ReleaseSmoke",
		...created,
		info: {
			name: "ReleaseSmoke",
			skills: created.skills,
			slots: starter.slots,
			items: starter.items,
		},
		p: {},
		t: {},
		socket: {
			events: [],
			emit(name, payload) {
				this.events.push([name, payload]);
				emitLog(lines, "server_event", {
					name,
					payload_type: payload === null ? "null" : Array.isArray(payload) ? "array" : typeof payload,
					payload_keys:
						payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).slice(0, 16) : [],
				});
			},
		},
	};

	initializePlayerProgression(player, 0);
	assert.deepEqual(player.info.slots, {});
	assert.deepEqual(player.info.items, starter.items);
	const activeSkill = deriveActiveSkill(player.info.slots, data.items, WEAPON_PROFILES);
	assert.equal(activeSkill, null);
	assert.equal(Object.prototype.hasOwnProperty.call(player.info, "active_skill"), false);
	emitLog(lines, "character_created", {
		name: player.name,
		total_level: player.total_level,
		skills: Object.fromEntries(SKILL_IDS.map((skill) => [skill, player.info.skills[skill].level])),
		active_skill: activeSkill,
	});

	player.info.slots.mainhand = { name: "blade" };
	const combatSkill = deriveActiveSkill(player.info.slots, data.items, WEAPON_PROFILES);
	assert.equal(combatSkill, "warrior");
	const target = { id: "release-smoke-goo", hp: 105 };
	for (let hit = 1; hit <= 3; hit += 1) {
		const damage = 35;
		target.hp -= damage;
		emitLog(lines, "combat_action", {
			ability: "attack",
			actor: player.name,
			target: target.id,
			damage,
			target_hp: target.hp,
		});
		awardPlayerSkillXp(player, "warrior", 40_000, {
			source: "pve_damage",
			sourceId: `release-smoke:hit:${hit}`,
		});
	}
	flushPlayerProgressionEvents(player);

	assert.equal(target.hp, 0);
	assert.equal(player.info.skills, player.skills);
	assert.equal(player.skills.warrior.xp, 120_000);
	assert.equal(player.skills.warrior.level, 2);
	assert.equal(player.total_level, 8);
	assert.equal(player.info.active_skill, undefined);
	assert.ok(player.socket.events.some(([name]) => name === "skill_xp"));
	assert.ok(player.socket.events.some(([name]) => name === "skill_level_up"));

	const logDirectory = process.env.ADVENTURELAND_RELEASE_LOG_DIR || path.join(PROJECT_ROOT, ".runtime");
	await fs.mkdir(logDirectory, { recursive: true });
	const logPath = path.join(logDirectory, "release-smoke.log");
	await fs.writeFile(logPath, `${lines.join("\n")}\n`, { mode: 0o600 });
	const report = {
		ok: true,
		character: player.name,
		active_skill: activeSkill,
		combat_skill: combatSkill,
		target: target.id,
		damage_events: 3,
		warrior_xp: player.skills.warrior.xp,
		warrior_level: player.skills.warrior.level,
		total_level: player.total_level,
		logged_events: lines.length,
		log_path: logPath,
	};
	process.stdout.write(`${JSON.stringify(report)}\n`);
	return report;
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.code || "RELEASE_SMOKE_ERROR"}: ${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = { main };
