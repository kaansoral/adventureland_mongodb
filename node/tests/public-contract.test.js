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
	const abilityStart = server.indexOf('socket.on("ability"');
	const abilityEnd = server.indexOf('\n\t\tsocket.on("click"', abilityStart);
	assert.notEqual(abilityStart, -1);
	assert.ok(abilityEnd > abilityStart);
	const abilityBlock = server.slice(abilityStart, abilityEnd);
	assert.match(abilityBlock, /outcome=received",\s*1,\s*\);/);
	assert.match(abilityBlock, /outcome=" \+ outcome,\s*1,\s*\);/);
	assert.doesNotMatch(server, /abilityTarget/);
	assert.match(serverFunctions, /function progression_log_id\(player\)/);
	assert.match(serverFunctions, /function progression_log_code\(error\)/);
	assert.doesNotMatch(server + serverFunctions, /merchant (?:disconnect |logout )?settlement failed: \+ player\.name/);
	assert.match(server, /merchant disconnect settlement failed: player_id=/);
	assert.match(server, /merchant logout settlement failed: player_id=/);
	const disconnectStart = server.indexOf('"merchant disconnect settlement failed:');
	const disconnectEnd = server.indexOf(");", disconnectStart);
	assert.notEqual(disconnectStart, -1);
	assert.ok(disconnectEnd > disconnectStart);
	const disconnectSettlement = server.slice(disconnectStart, disconnectEnd + 2);
	const logoutStart = server.indexOf('"merchant logout settlement failed:');
	const logoutEnd = server.indexOf(");", logoutStart);
	assert.notEqual(logoutStart, -1);
	assert.ok(logoutEnd > logoutStart);
	const logoutSettlement = server.slice(logoutStart, logoutEnd + 2);
	assert.match(disconnectSettlement, /progression_log_code\(error\),\s*1,/);
	assert.match(logoutSettlement, /progression_log_code\(error\),\s*1,/);
	const standSettlementStart = server.indexOf("setInterval(\n\tfunction () {\n\t\tfor (var id in players)");
	const standSettlementEnd = server.indexOf("\n\t},\n\t5 * 60 * 1000,\n);", standSettlementStart);
	assert.notEqual(standSettlementStart, -1);
	assert.ok(standSettlementEnd > standSettlementStart);
	const standSettlementCallbackStart = server.indexOf("function () {", standSettlementStart);
	assert.ok(standSettlementCallbackStart > standSettlementStart);
	assert.ok(standSettlementCallbackStart < standSettlementEnd);
	const standLogs = [];
	const standSettlementCallback = vm.runInNewContext(
		`(${server.slice(standSettlementCallbackStart, standSettlementEnd + 3).trim()})`,
		{
			players: { stander: { p: { stand: true }, rip: false } },
			settlePlayerStand: () => {
				const error = new Error("private stand detail");
				error.code = "merchant_settlement_failed";
				throw error;
			},
			progression_log_id: () => "stable-id",
			progression_log_code: (error) => error.code,
			server_log: (message, important) => standLogs.push({ message, important }),
		},
	);
	standSettlementCallback();
	assert.deepEqual(standLogs, [
		{ message: "merchant settlement failed: player_id=stable-id error=merchant_settlement_failed", important: 1 },
	]);
	assert.match(server, /data\.protocol = 3/);
	assert.match(server, /max_xp:/);
	assert.match(server, /data\.active_skill/);
	assert.match(server, /data\.total_level/);
	assert.match(server, /data\.death_sickness_until/);
	assert.match(server, /data\.ctype\s*=/);
	const partyStart = server.indexOf("function party_to_client(oname)");
	const partyEnd = server.indexOf("\nfunction send_party_update", partyStart);
	assert.notEqual(partyStart, -1);
	assert.ok(partyEnd > partyStart);
	assert.doesNotMatch(server.slice(partyStart, partyEnd), /party_xp|xp\s*:/);
	const timeoutStart = serverFunctions.indexOf('player.socket.emit("ability_timeout"');
	const timeoutEnd = serverFunctions.indexOf("});", timeoutStart);
	assert.notEqual(timeoutStart, -1);
	assert.ok(timeoutEnd > timeoutStart);
	const timeoutBlock = serverFunctions.slice(timeoutStart, timeoutEnd + 3);
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
	assert.doesNotMatch(browser, /party\[[^\]]+\]\.xp/);
	assert.match(browser, /socket\.emit\("ability"/);
	assert.doesNotMatch(browser, /socket\.emit\("(?:attack|heal)"/);
	assert.match(browser, /socket\.on\("ability_timeout"/);
	assert.match(browser, /socket\.on\("skill_xp"/);
	assert.match(browser, /socket\.on\("skill_level_up"/);
});

test("party share keeps its presentation color while XP remains private", () => {
	const oldCommon = read("js/old_common_functions.js");
	const gameDesign = read("design/game_design.js");
	const htmlSource = read("js/html.js");
	assert.match(oldCommon, /"party_share":"#AD73E0"/);
	assert.doesNotMatch(oldCommon, /\bparty_xp\b/);
	assert.doesNotMatch(gameDesign, /\bparty_xp\b/);
	assert.match(htmlSource, /colors\.party_share/);
	assert.doesNotMatch(htmlSource, /colors\.party_xp/);

	const renderStart = htmlSource.indexOf("function render_character_sheet()");
	const renderEnd = htmlSource.indexOf("\nfunction render_conditions", renderStart);
	assert.ok(renderStart >= 0 && renderEnd > renderStart);
	const rendered = { value: "" };
	const context = {
		character: {
			name: "Hero",
			total_level: 7,
			active_skill: "warrior",
			skills: { warrior: { level: 1, xp: 125, max_xp: 500 } },
			party: true,
			tax: undefined,
			attack: 10,
			frequency: 1,
			str: 10,
			int: 10,
			dex: 10,
			vit: 10,
			for: 10,
			armor: 10,
			resistance: 10,
			courage: 1,
			mcourage: 1,
			pcourage: 1,
			speed: 10,
			mp_cost: 1,
			goldm: 1,
			luckm: 1,
			xpm: 1,
		},
		party: { Hero: { share: 0.25 } },
		G: { skills: { warrior: { name: "Warrior" } } },
		colors: { party_share: "#AD73E0", gold: "gold", luck: "green" },
		round: Math.round,
		to_title: (value) => value,
		to_pretty_num: (value) => String(value),
		to_pretty_float: (value) => String(value),
		damage_multiplier: () => 0.5,
		$: () => ({ html: (value) => { rendered.value = value; } }),
	};
	vm.runInNewContext(`${htmlSource.slice(renderStart, renderEnd)}\nrender_character_sheet();`, context);
	assert.match(rendered.value, /color:#AD73E0/);
	assert.match(rendered.value, /> 25% <span style='color:gray'>\(Your Share\)/);
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
	assert.equal(logs.length, 7);
	assert.equal(logs.filter((message) => message.startsWith("send_email provider=ses status=attempt")).length, 4);
	assert.equal(logs.filter((message) => message.startsWith("send_email provider=ses status=failed")).length, 3);
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
	assert.notEqual(idStart, -1);
	assert.ok(idEnd > idStart);
	const progressionLogId = vm.runInNewContext(`(${serverFunctions.slice(idStart, idEnd).trim()})`);
	assert.equal(progressionLogId({ real_id: "stable-id" }), "stable-id");
	assert.equal(progressionLogId({ id: "display-name" }), "unknown");
	assert.equal(progressionLogId({ real_id: "display name" }), "unknown");

	const serverLogStart = serverFunctions.indexOf("function server_log(message, important)");
	const serverLogEnd = serverFunctions.indexOf("\nfunction progression_log_id", serverLogStart);
	assert.notEqual(serverLogStart, -1);
	assert.ok(serverLogEnd > serverLogStart);
	const serverLogs = [];
	const serverEvents = [];
	const serverLog = vm.runInNewContext(`(${serverFunctions.slice(serverLogStart, serverLogEnd).trim()})`, {
		process: { env: { ADVENTURELAND_RELEASE_SAFE_LOGS: "1" } },
		console: {
			log: (message) => serverLogs.push(String(message)),
			error: (message) => serverLogs.push(String(message)),
		},
		get: async () => ({ region: "synthetic", name: "server" }),
		add_event: async (...args) => serverEvents.push(args),
		server_id: "server-id",
	});
	for (const message of [
		"private important message",
		"merchant settlement failed: player_id=stable error=failed",
		"ability actor_id=stable ability=attack outcome=received",
		"Created an instance of safe-map",
		"Deleted an instance of safe-map",
		"Server Live: safe 1",
		"Game Version: safe",
		"Node Version: v1",
	])
		serverLog(message, 1);
	serverLog("SEVERE private player-name", 1);
	serverLog("private nonimportant message");
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(serverLogs, [
		"release-safe important code=important",
		"release-safe important code=merchant_settlement",
		"release-safe important code=ability",
		"release-safe important code=instance_created",
		"release-safe important code=instance_deleted",
		"release-safe important code=server_live",
		"release-safe important code=game_version",
		"release-safe important code=node_version",
		"release-safe severe code=severe",
	]);
	assert.deepEqual(JSON.parse(JSON.stringify(serverEvents)), [
		[
			{ region: "synthetic", name: "server" },
			"notice",
			["noteworthy"],
			{ info: { message: "synthetic server: release-safe severe code=severe", color: "red" } },
		],
	]);
	assert.doesNotMatch(serverLogs.join("\n"), /secret-map|private player-name/);

	const codeStart = serverFunctions.indexOf("function progression_log_code(error)");
	const codeEnd = serverFunctions.indexOf("\nfunction appengine_log", codeStart);
	assert.notEqual(codeStart, -1);
	assert.ok(codeEnd > codeStart);
	const progressionLogCode = vm.runInNewContext(`(${serverFunctions.slice(codeStart, codeEnd).trim()})`);
	for (const [error, expected] of [
		[{ code: "merchant_settlement_failed" }, "merchant_settlement_failed"],
		[{ code: "x" }, "x"],
		[{ code: "x".repeat(64) }, "x".repeat(64)],
		[{ code: "" }, "unknown"],
		[{}, "unknown"],
		[undefined, "unknown"],
		[{ code: "bad code\nprivate" }, "unknown"],
		[{ code: "x".repeat(65) }, "unknown"],
	]) {
		assert.equal(progressionLogCode(error), expected);
	}
	const ripStart = serverFunctions.indexOf("function rip(player)");
	const ripEnd = serverFunctions.indexOf("\nfunction notify_friends_emit", ripStart);
	assert.notEqual(ripStart, -1);
	assert.ok(ripEnd > ripStart);
	const ripLogs = [];
	let settlementAttempt = 0;
	const rip = vm.runInNewContext(`(${serverFunctions.slice(ripStart, ripEnd).trim()})`, {
		progression_ledger: { removeCharacter: () => undefined },
		settlePlayerStand: () => {
			const error = new Error("private settlement detail");
			error.code = settlementAttempt++ === 2 ? "bad code\nprivate settlement detail" : "merchant_settlement_failed";
			throw error;
		},
		server_log: (message, important) => ripLogs.push({ message, important }),
		progression_log_id: progressionLogId,
		progression_log_code: progressionLogCode,
		refreshDeathSickness: () => undefined,
		send_party_update: () => undefined,
		Date,
	});
	for (const realId of ["stable-id", "display name", "x".repeat(129)]) {
		const player = {
			is_player: true,
			is_npc: false,
			real_id: realId,
			id: "display-name",
			name: "private-player-name",
			p: { stand: true },
			party: null,
		};
		rip(player);
	}
	assert.deepEqual(ripLogs, [
		{ message: "merchant death settlement failed actor_id=stable-id code=merchant_settlement_failed", important: 1 },
		{ message: "merchant death settlement failed actor_id=unknown code=merchant_settlement_failed", important: 1 },
		{ message: "merchant death settlement failed actor_id=unknown code=unknown", important: 1 },
	]);
	assert.doesNotMatch(JSON.stringify(ripLogs), /private-player-name|private settlement detail/);
});
