"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

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
		setTimeout,
		Version: "test",
		G: {
			items: {
				blade: { type: "weapon" },
				helmet: { type: "helmet" },
				potion: { type: "pot" },
				placeholder: { type: "placeholder" },
				secretitem: { type: "weapon" },
				strscroll: { type: "pscroll" },
			},
		},
		app: { get() {}, post() {} },
		options: { servers: { eu1: { api_path: "/api/" } }, base_url: "https://adventure.land" },
		keys: { ACCESS_MASTER: "master", SERVER_MASTER: "0123456789abcdef" },
		get_id(value) {
			return value && (value._id || value.key);
		},
	};
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, "mcp_api.js"), "utf8"), context, { filename: "mcp_api.js" });
	return context;
}

test("MCP publishes native bank and progression surfaces as read-only", () => {
	const context = loadMcpApi();
	const tools = context.mcp_tools();
	const plan = tools.find((entry) => entry.name === "plan_character_progression");
	assert.equal(plan.annotations.readOnlyHint, true);
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
			.mcp_resource_templates()
			.some((entry) => entry.uriTemplate === "adventureland://progression/characters/{character}"),
	);
	assert.ok(context.mcp_prompt_list().some((entry) => entry.name === "improve_character"));
});

test("saved bank view preserves slots and exposes only progression-safe item fields", () => {
	const context = loadMcpApi();
	const result = context.mcp_api_saved_bank({
		_id: "US_owner",
		info: {
			gold: 250,
			items0: [{ name: "blade", level: 3, stat_type: "str", grace: 1.5, l: "l", private_note: "hidden" }, null],
		},
	});

	assert.equal(result.stale, false);
	assert.deepEqual(JSON.parse(JSON.stringify(result.packs.items0)), [
		{ name: "blade", level: 3, grace: 1.5, stat_type: "str", locked: true },
		null,
	]);
});

test("native progression passes only owned equipment candidates to the live game server", async () => {
	const context = loadMcpApi();
	const user = { _id: "US_owner", info: {} };
	const character = { _id: "CH_hero", owner: "US_owner", server: "eu1", info: { name: "Hero" } };
	context.admin_bots_owned_character = async () => character;
	context.get = async (id) => (id === "eu1" ? { _id: "eu1", key: "eu1", address: "eu.example" } : null);
	context.mcp_api_get_bank = async () => ({
		success: true,
		source: "last_account_snapshot",
		observed_at: "now",
		stale: false,
		packs: {
			items0: [{ name: "blade", level: 2 }, { name: "potion", q: 100 }, { name: "strscroll", q: 20 }, null],
			items1: [{ name: "helmet", level: 1, blocked: true }],
		},
	});
	let request;
	context.mcp_api_progression_request = async (_server, data) => {
		request = data;
		return { success: true, limitations: [], recommendations: {} };
	};

	const result = await context.mcp_api_plan_character_progression({ user, character: "Hero", objective: "damage" });
	assert.equal(result.success, true);
	assert.equal(request.owner, "US_owner");
	assert.equal(request.character, "CH_hero");
	assert.equal(request.objective, "damage");
	assert.deepEqual(JSON.parse(JSON.stringify(request.candidates)), [
		{ source: "bank:items0:0", item: { name: "blade", level: 2 } },
		{ source: "bank:items1:0", item: { name: "helmet", level: 1, blocked: true } },
	]);
	assert.deepEqual(JSON.parse(JSON.stringify(request.holdings)), [{ name: "strscroll", q: 20 }]);
	assert.equal(result.bank.candidate_count, 2);
});

test("mounted stale bank snapshots are never used for recommendations", async () => {
	const context = loadMcpApi();
	const user = { _id: "US_owner", info: {} };
	context.admin_bots_owned_character = async () => ({
		_id: "CH_hero",
		owner: "US_owner",
		server: "eu1",
		info: { name: "Hero" },
	});
	context.get = async () => ({ _id: "eu1", key: "eu1", address: "eu.example" });
	context.mcp_api_get_bank = async () => ({
		success: true,
		source: "last_account_snapshot",
		stale: true,
		warning: "stale",
		packs: { items0: [{ name: "blade", level: 9 }] },
	});
	let request;
	context.mcp_api_progression_request = async (_server, data) => {
		request = data;
		return { success: true, limitations: [], recommendations: {} };
	};

	const result = await context.mcp_api_plan_character_progression({ user, character: "Hero" });
	assert.equal(request.candidates.length, 0);
	assert.equal(result.bank.stale, true);
	assert.match(result.limitations[0], /Bank equipment was excluded/);
});
