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
	assert.doesNotMatch(server, /socket\.on\("(?:attack|heal)"/);
	assert.doesNotMatch(server, /server_log\("skill name=/);
	assert.match(server, /server_log\("ability actor_id=/);
	assert.doesNotMatch(server, /abilityTarget/);
	assert.match(serverFunctions, /function progression_log_id\(player\)/);
	assert.match(serverFunctions, /function progression_log_code\(error\)/);
	assert.doesNotMatch(server + serverFunctions, /merchant (?:disconnect |logout )?settlement failed: \+ player\.name/);
	assert.match(server, /merchant disconnect settlement failed: player_id=/);
	assert.match(server, /merchant logout settlement failed: player_id=/);
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
	assert.doesNotMatch(browser, /socket\.emit\("(?:attack|heal)"/);
	assert.match(browser, /socket\.on\("ability_timeout"/);
	assert.match(browser, /socket\.on\("skill_xp"/);
	assert.match(browser, /socket\.on\("skill_level_up"/);
});

test("release-safe email and progression logs contain only bounded diagnostics", async () => {
	const adventureFunctions = read("adventure_functions.js");
	const emailStart = adventureFunctions.indexOf("async function send_email(");
	const emailEnd = adventureFunctions.indexOf("\nfunction send_verification_email", emailStart);
	assert.notEqual(emailStart, -1);
	assert.notEqual(emailEnd, -1);
	const logs = [];
	let sendError = null;
	class StubSesClient {
		async send(command) {
			this.command = command;
			if (sendError) throw sendError;
		}
	}
	class StubSendEmailCommand {
		constructor(input) {
			this.input = input;
		}
	}
	const context = {
		keys: { amazon_ses_user: "access", amazon_ses_key: "secret" },
		console: {
			log: (message) => logs.push(String(message)),
			error: (message) => logs.push(String(message)),
		},
		require: (name) => {
			assert.equal(name, "@aws-sdk/client-ses");
			return { SESClient: StubSesClient, SendEmailCommand: StubSendEmailCommand };
		},
	};
	const sendEmail = vm.runInNewContext(`(${adventureFunctions.slice(emailStart, emailEnd).trim()})`, context);
	await sendEmail({}, "recipient@example.invalid", {
		title: "private subject",
		html: "private html",
		text: "private text",
	});
	sendError = { name: "QuotaExceeded" };
	await sendEmail({}, "recipient@example.invalid", { title: "private subject" });
	sendError = { Code: "ProviderCode" };
	await sendEmail({}, "recipient@example.invalid", { text: "secret body" });
	sendError = { name: "bad code\nprivate error" };
	await sendEmail({}, "recipient@example.invalid", { html: "secret html" });
	assert.ok(
		logs.every((message) =>
			/^(send_email provider=ses status=attempt|send_email provider=ses status=failed code=[A-Za-z0-9_.:-]{1,64})$/.test(
				message,
			),
		),
	);
	assert.doesNotMatch(
		logs.join("\n"),
		/recipient@example\.invalid|private subject|private html|private text|secret body|private error/,
	);

	const serverFunctions = read("node/server_functions.js");
	const idStart = serverFunctions.indexOf("function progression_log_id(player)");
	const idEnd = serverFunctions.indexOf("\nfunction progression_log_code", idStart);
	const progressionLogId = vm.runInNewContext(`(${serverFunctions.slice(idStart, idEnd).trim()})`);
	assert.equal(progressionLogId({ real_id: "stable-id" }), "stable-id");
	assert.equal(progressionLogId({ id: "display-name" }), "unknown");
	assert.equal(progressionLogId({ real_id: "display name" }), "unknown");
});
