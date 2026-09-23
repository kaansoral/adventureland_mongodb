"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const designContext = {};
vm.createContext(designContext);
vm.runInContext(fs.readFileSync(path.join(root, "design/game_design.js"), "utf8"), designContext, {
	filename: "design/game_design.js",
});
vm.runInContext(fs.readFileSync(path.join(root, "design/classes.js"), "utf8"), designContext, {
	filename: "design/classes.js",
});
const deployedCharacterTypes = Array.from(designContext.character_types).sort();
const deployedClasses = JSON.parse(JSON.stringify(designContext.classes));

function loadMcpApi() {
	const context = {
		AbortController,
		Buffer,
		Date,
		JSON,
		Map,
		Math,
		Number,
		Object,
		Set,
		String,
		URL,
		URLSearchParams,
		clearTimeout,
		console,
		crypto,
		fs,
		path,
		phrase: require("../../languages").phrase,
		setTimeout,
		Version: 6000,
		upgrades: {
			0: { 1: 0.99, 2: 0.8, 3: 0.6, 4: 0.4, 5: 0.2, 6: 0.1, 7: 0.05, 8: 0.02, 9: 0.01, 10: 0.005 },
		},
		compounds: { 0: { 1: 0.9, 2: 0.6, 3: 0.3, 4: 0.15, 5: 0.08 } },
		classes: JSON.parse(JSON.stringify(deployedClasses)),
		titles: {},
		items: {
			oldblade: { type: "weapon", wtype: "sword", attack: 10, stat: 1, upgrade: { attack: 2, stat: 1 }, igrade: 0 },
			newblade: { type: "weapon", wtype: "sword", attack: 30, stat: 1, upgrade: { attack: 3, stat: 1 }, igrade: 0 },
			helm: { type: "helmet", armor: 10, stat: 2, upgrade: { armor: 2, stat: 1 }, igrade: 0 },
			ring: { type: "ring", str: 1, compound: { str: 1 }, igrade: 0 },
			shield: { type: "shield", armor: 20 },
			potion: { type: "pot" },
			placeholder: { type: "placeholder" },
			strscroll: { type: "pscroll" },
			scroll0: { type: "uscroll" },
			cscroll0: { type: "cscroll" },
		},
		G: {},
		app: { get() {}, post() {} },
		options: { servers: { eu1: { api_path: "/api/" } }, base_url: "https://adventure.land" },
		get_id(value) {
			return value && (value._id || value.key);
		},
		async admin_bots_find() {
			return null;
		},
	};
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, "mcp_api.js"), "utf8"), context, { filename: "mcp_api.js" });
	return context;
}

function progressionCharacter() {
	return {
		_id: "CH_paladin",
		owner: "US_owner",
		type: "paladin",
		level: 80,
		online: true,
		last_sync: new Date(),
		info: {
			name: "P4L4D1N",
			map: "main",
			slots: {
				mainhand: { name: "oldblade", level: 1 },
				helmet: { name: "helm", level: 1, stat_type: "vit" },
				ring1: { name: "ring", level: 0 },
			},
			items: [
				{ name: "newblade", level: 1 },
				{ name: "ring", level: 0 },
				{ name: "ring", level: 0 },
				{ name: "strscroll", q: 50 },
				{ name: "scroll0", q: 2 },
			],
		},
	};
}

test("MCP publishes objective-based progression context and Samaritan starting points", () => {
	const context = loadMcpApi();
	const plan = context.mcp_tools().find((entry) => entry.name === "plan_character_progression");
	assert.equal(plan.annotations.readOnlyHint, true);
	assert.match(plan.description, /without ranking items or prescribing actions/);
	assert.deepEqual(Array.from(plan.inputSchema.properties.objective.enum), [
		"balanced_farming",
		"damage",
		"survival",
		"support",
		"gold",
		"luck",
		"xp",
	]);
	assert.ok(context.mcp_resources().some((entry) => entry.uri === "adventureland://account/bank"));
	assert.ok(
		context
			.mcp_resources()
			.some(
				(entry) => entry.uri === "adventureland://code/starters/samaritan" && /starter CODE/.test(entry.description),
			),
	);
	assert.ok(
		context
			.mcp_resource_templates()
			.some((entry) => entry.uriTemplate === "adventureland://progression/characters/{character}"),
	);
	assert.match(context.MCP_INSTRUCTIONS, /objectives, not a prescribed sequence/);
	assert.match(context.MCP_INSTRUCTIONS, /optional advanced CODE starting point/);
	assert.doesNotMatch(context.MCP_INSTRUCTIONS, /call plan_character_progression/);
});

test("saved bank output remains bounded and reports mounted snapshots as stale", async () => {
	const context = loadMcpApi();
	const result = await context.mcp_api_get_bank({
		user: {
			_id: "US_owner",
			server: "eu1",
			mounted_to: "CH_merchant",
			info: { items0: [{ name: "newblade", level: 3, l: "l", private_note: "hidden" }] },
		},
	});
	assert.equal(result.success, true);
	assert.equal(result.stale, true);
	assert.equal(result.freshness, "possibly_stale");
	assert.deepEqual(JSON.parse(JSON.stringify(result.packs.items0)), [{ name: "newblade", level: 3, locked: true }]);
	assert.match(result.warning, /saved account snapshot may be stale/);
});

test("legacy bank timestamps never certify freshness, even when recent", async () => {
	const context = loadMcpApi();
	for (const timestamp of ["2026-01-02T00:00:00.000Z", new Date().toISOString(), "not-a-date", undefined]) {
		const user = {
			_id: "US_owner",
			updated: new Date(),
			info: { last_sync: timestamp, gold: 3590000, items0: [{ name: "ring", level: 4 }] },
		};
		const before = JSON.stringify(user);
		const started = Date.now();
		const result = await context.mcp_api_get_bank({ user });
		assert.equal(result.success, true);
		assert.equal(result.source, "last_account_snapshot");
		assert.equal(result.stale, false);
		assert.equal(result.freshness, "unverified");
		assert.equal(result.observed_at, null);
		assert.ok(Date.parse(result.retrieved_at) >= started && Date.parse(result.retrieved_at) <= Date.now());
		assert.equal(result.gold, 3590000);
		assert.equal(result.packs.items0[0].name, "ring");
		assert.equal(result.warning, undefined);
		assert.match(result.note, /stale flags a mounted bank, not data age/);
		assert.equal(JSON.stringify(user), before);
	}
});

test("either bank ownership marker warns of possible unsaved game state", async () => {
	const context = loadMcpApi();
	for (const lock of [{ server: "eu1" }, { mounted_to: "CH_merchant" }]) {
		const result = await context.mcp_api_get_bank({ user: { ...lock, info: {} } });
		assert.equal(result.stale, true);
		assert.equal(result.freshness, "possibly_stale");
		assert.equal(result.observed_at, null);
		assert.equal(context.mcp_api_bank_equipment_candidates(result).length, 0);
	}
});

test("JSON, MCP tools, and bank resources publish the same account-scoped freshness contract", async () => {
	const context = loadMcpApi();
	const user = { _id: "US_owner", info: { last_sync: "2026-01-02T00:00:00.000Z", gold: 3590000, items0: [] } };
	context.get_mcp_api_user = async (token) => (token === "test-token" ? user : null);
	function response() {
		return {
			status() {
				return this;
			},
			set() {
				return this;
			},
			send(body) {
				this.body = body;
				return this;
			},
			end() {
				return this;
			},
		};
	}
	const json = response();
	await context.handle_mcp_api_call({ params: { method: "get_bank" }, body: { token: "test-token" } }, json);
	const tool = response();
	await context.handle_mcp_transport(
		{
			get: (name) => (name === "authorization" ? "Bearer test-token" : ""),
			body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_bank", arguments: {} } },
		},
		tool,
	);
	const resource = response();
	await context.handle_mcp_transport(
		{
			get: (name) => (name === "authorization" ? "Bearer test-token" : ""),
			body: { jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "adventureland://account/bank" } },
		},
		resource,
	);
	for (const result of [
		json.body,
		tool.body.result.structuredContent,
		JSON.parse(resource.body.result.contents[0].text),
	]) {
		assert.equal(result.success, true);
		assert.equal(result.gold, 3590000);
		assert.equal(result.observed_at, null);
		assert.equal(result.freshness, "unverified");
		assert.ok(Number.isFinite(Date.parse(result.retrieved_at)));
	}
	const rejected = response();
	await context.handle_mcp_api_call({ params: { method: "get_bank" }, body: { token: "wrong-token" } }, rejected);
	assert.equal(rejected.body.reason, "invalid_token");
	assert.equal(rejected.body.gold, undefined);
	assert.equal(rejected.body.packs, undefined);
	const description = json.body.note;
	assert.equal(context.mcp_tools().find((entry) => entry.name === "get_bank").description, description);
	assert.equal(
		context.mcp_resources().find((entry) => entry.uri === "adventureland://account/bank").description,
		description,
	);
});

test("bank freshness documentation is translated and shared with both guides", () => {
	const id = "docs.articles.adventure-api.every-owned-bank-pack-and-the-shared-bank";
	const languages = require("../../languages");
	const english = require("../../languages/en/docs")[id];
	for (const { code } of languages.languages) {
		const value =
			code === "en"
				? english
				: JSON.parse(fs.readFileSync(path.join(root, "languages", code, "docs.json"), "utf8"))[id];
		assert.equal(typeof value, "string", code);
		if (code !== "en") assert.notEqual(value, english, code);
		for (const field of ["stale", "observed_at", "retrieved_at"]) assert.ok(value.includes(field), code + ": " + field);
		assert.doesNotMatch(value, /[{}<>]/, code);
		assert.equal(languages.phrase(id, {}, code), value);
	}
	for (const name of ["adventure-api", "adventure-mcp"]) {
		assert.ok(fs.readFileSync(path.join(root, "docs/articles", name + ".html"), "utf8").includes(id));
		assert.ok(fs.readFileSync(path.join(root, "seo_paths.js"), "utf8").includes("/docs/guide/" + name));
	}
});

test("item approximation follows loaded base, upgrade, breakpoint, and stat-scroll properties", () => {
	const context = loadMcpApi();
	const properties = context.mcp_api_progression_item_properties(
		{ name: "oldblade", level: 8, stat_type: "str" },
		"paladin",
		"main",
	);
	assert.equal(properties.attack, 28);
	assert.equal(properties.str, 12);
	assert.equal(properties.stat, undefined);
});

test("progression supplies objectives and context without choosing item actions", async () => {
	const context = loadMcpApi();
	const character = progressionCharacter();
	const user = {
		_id: "US_owner",
		info: {
			items0: [
				{ name: "ring", level: 4 },
				{ name: "ring", level: 4 },
			],
		},
	};
	context.admin_bots_owned_character = async () => character;
	context.admin_bots_find = async () => ({
		game_connected: true,
		observation: {
			source: "game_server",
			observed_at: new Date().toISOString(),
			map: "main",
			equipment: character.info.slots,
			inventory: character.info.items.map((item, index) => Object.assign({ index }, item)),
		},
	});

	const result = await context.mcp_api_plan_character_progression({ user, character: "P4L4D1N", objective: "damage" });

	assert.equal(result.success, true);
	assert.equal(result.source, "mcp_progression_context");
	assert.equal(result.current.source, "mainframe_observation");
	assert.equal(result.objective, "damage");
	assert.deepEqual(
		Array.from(result.objectives, (entry) => entry.id),
		["understand_the_character", "build_durable_power", "develop_items", "support_future_growth", "learn_and_adapt"],
	);
	assert.equal(result.objectives[1].class_context.primary_stat, "str");
	assert.equal(result.objectives[1].class_context.secondary_stat, "int");
	assert.equal(result.starting_points.samaritan, "adventureland://code/starters/samaritan");
	assert.equal(result.policy.prescribes_actions, false);
	assert.equal(result.recommendations, undefined);
	assert.doesNotMatch(JSON.stringify(result), /bank:items[0-9]+:[0-9]+/);
});

test("progression accepts every loaded class from the website-process design globals", async () => {
	const context = loadMcpApi();
	const supported = deployedCharacterTypes;
	assert.deepEqual(Array.from(context.mcp_api_progression_supported_classes()), supported);
	for (const characterType of supported) {
		const character = progressionCharacter();
		character.type = characterType;
		character.info.slots = {};
		character.info.items = [];
		if (characterType === "paladin") {
			delete character.type;
			character.ctype = "Paladin";
		}
		context.admin_bots_owned_character = async () => character;
		const result = await context.mcp_api_plan_character_progression({
			user: { _id: "US_owner", info: {} },
			character: "P4L4D1N",
		});
		assert.equal(result.success, true, characterType);
		assert.equal(result.class, characterType, characterType);
	}
});

test("unsupported classes return the requested class and complete supported class list", async () => {
	const context = loadMcpApi();
	const character = progressionCharacter();
	character.type = "bard";
	context.admin_bots_owned_character = async () => character;

	const content = await context.mcp_read_resource("adventureland://progression/characters/P4L4D1N", {
		_id: "US_owner",
		info: {},
	});
	const result = JSON.parse(content.text);

	assert.equal(result.error.code, "unsupported_character_class");
	assert.equal(result.error.details.retryable, false);
	assert.equal(result.error.details.requested_class, "bard");
	assert.deepEqual(result.error.details.supported_classes, deployedCharacterTypes);
});

test("stale bank data is excluded without blocking the plan", async () => {
	const context = loadMcpApi();
	const character = progressionCharacter();
	const user = {
		_id: "US_owner",
		server: "eu1",
		mounted_to: "CH_merchant",
		info: { items0: [{ name: "newblade", level: 9 }] },
	};
	context.admin_bots_owned_character = async () => character;

	const result = await context.mcp_api_plan_character_progression({ user, character: "P4L4D1N" });

	assert.equal(result.success, true);
	assert.equal(result.bank.stale, true);
	assert.equal(result.bank.freshness, "possibly_stale");
	assert.equal(result.bank.observed_at, null);
	assert.ok(Number.isFinite(Date.parse(result.bank.retrieved_at)));
	assert.match(result.bank.note, /not data age/);
	assert.equal(result.bank.candidate_count, 0);
	assert.match(result.bank.warning, /saved account snapshot may be stale/);
});

test("progression falls back when the Mainframe read fails and the saved timestamp is invalid", async () => {
	const context = loadMcpApi();
	const character = progressionCharacter();
	character.last_sync = "not-a-date";
	context.admin_bots_owned_character = async () => character;
	context.admin_bots_find = async () => {
		throw new Error("controller read failed");
	};

	const content = await context.mcp_read_resource("adventureland://progression/characters/P4L4D1N", {
		_id: "US_owner",
		info: {},
	});
	const result = JSON.parse(content.text);

	assert.equal(result.success, true);
	assert.equal(result.current.source, "last_account_snapshot");
	assert.equal(result.observed_at, null);
	assert.deepEqual(
		Array.from(result.current.warnings, (warning) => warning.code),
		["mainframe_observation_unavailable", "saved_snapshot_timestamp_invalid"],
	);
	assert.match(result.current.warning, /latest owned account snapshot/);
});

test("progression resources return context and structured domain errors", async () => {
	const context = loadMcpApi();
	context.mcp_api_plan_character_progression = async () => ({ success: true, source: "mcp_progression_context" });
	let content = await context.mcp_read_resource("adventureland://progression/characters/P4L4D1N", { _id: "US_owner" });
	assert.equal(JSON.parse(content.text).success, true);

	context.mcp_api_plan_character_progression = async () => ({ failed: true, reason: "character_not_found" });
	content = await context.mcp_read_resource("adventureland://progression/characters/MISSING", { _id: "US_owner" });
	assert.equal(JSON.parse(content.text).error.code, "character_not_found");
});

test("MCP progression has no game-server loader or route", () => {
	const serverSource = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
	assert.equal(serverSource.includes("progression_api"), false);
	assert.equal(fs.existsSync(path.join(root, "node/progression_api.js")), false);
});
