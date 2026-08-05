"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildProgressionData, loadProgressionPublication } = require("../game/skill_domain");

const root = path.resolve(__dirname, "../..");

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadRawProgression() {
	const context = { console, multipliers: { shells_to_gold: 1 } };
	vm.createContext(context);
	for (const file of [
		"conditions.js",
		"item_requirements.js",
		"items.js",
		"skills.js",
		"skill_xp.js",
		"abilities.js",
		"character.js",
	])
		vm.runInContext(read(`design/${file}`), context, { filename: file });
	return context;
}

test("public progression publication is protocol 3 and contains no class or level catalogs", () => {
	const publication = loadProgressionPublication(
		{ version: 1, classes: { legacy: true }, levels: { legacy: true } },
		buildProgressionData(loadRawProgression()),
	);
	assert.equal(publication.protocol, 3);
	assert.equal("classes" in publication, false);
	assert.equal("levels" in publication, false);
	assert.deepEqual(Object.keys(publication.skills), [
		"warrior",
		"paladin",
		"mage",
		"priest",
		"ranger",
		"rogue",
		"merchant",
	]);
	assert.equal(publication.character.appearances.length, 28);
	assert.deepEqual(
		Object.values(publication.character.skills).map(({ level, xp }) => [level, xp]),
		Array(7).fill([1, 0]),
	);
});

test("server, API, and browser producers expose only the protocol-3 vocabulary", () => {
	const server = read("node/server.js");
	const serverFunctions = read("node/server_functions.js");
	const api = read("api.js");
	const browser = [
		"js/functions.js",
		"js/game.js",
		"js/html.js",
		"js/runner_functions.js",
		"js/runner_compat.js",
		"js/old_common_functions.js",
	]
		.map(read)
		.join("\n");

	assert.doesNotMatch(server, /socket\.on\("skill"/);
	assert.doesNotMatch(server, /socket\.fs\.skill/);
	assert.match(server, /socket\.on\("attack"[\s\S]*?socket\.fs\.ability/);
	assert.match(server, /socket\.on\("heal"[\s\S]*?socket\.fs\.ability/);
	assert.match(server, /socket\.on\("ability"/);
	assert.match(server, /data\.protocol = 3/);
	assert.match(server, /max_xp:/);
	assert.match(server, /data\.active_skill/);
	assert.match(server, /data\.total_level/);
	assert.match(server, /data\.death_sickness_until/);
	assert.doesNotMatch(server, /data\.ctype\s*=/);
	const timeoutStart = serverFunctions.indexOf('player.socket.emit("ability_timeout"');
	assert.notEqual(timeoutStart, -1);
	const timeoutBlock = serverFunctions.slice(timeoutStart, serverFunctions.indexOf("});", timeoutStart) + 3);
	assert.match(timeoutBlock, /name:\s*name/);
	assert.match(timeoutBlock, /ms:/);
	assert.doesNotMatch(timeoutBlock, /penalty:/);

	assert.doesNotMatch(api, /\n\s*char:\s*\{/);
	assert.match(api, /look:\s*\{ type: "any" \}/);
	assert.match(api, /args\.char !== undefined/);
	assert.match(api, /total_level:\s*character\.total_level/);
	assert.match(api, /buildStarterLoadout\(character\)/);
	assert.match(api, /node\/game\/starter_loadout/);
	assert.match(api, /fresh: fresh, starter: starter/);
	assert.match(api, /slots: A\.starter\.slots/);
	assert.match(api, /items: A\.starter\.items/);
	assert.doesNotMatch(api, /\{ name: "blade", level: 0, gift: 1 \}/);
	assert.doesNotMatch(api, /\{ name: "helmet", level: 0, gift: 1 \}/);
	assert.doesNotMatch(api, /\{ name: "shoes", level: 0, gift: 1 \}/);

	assert.doesNotMatch(browser, /G\.classes|G\.levels|use_skill|next_skill|skill_timeout|\.ctype/);
	assert.match(browser, /socket\.emit\("ability"/);
	assert.match(browser, /socket\.on\("ability_timeout"/);
	assert.match(browser, /socket\.on\("skill_xp"/);
	assert.match(browser, /socket\.on\("skill_level_up"/);
});
