"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const design = require("./helpers/design");

const root = path.resolve(__dirname, "../..");
const reportedQuery =
	"ikissyou anniversary_visit paladin_aura aether_shield beacon_of_resolve cleansing_light guardians_oath shield_slam smash";

function loadSearch(data = { skills: design.skills, conditions: design.conditions }) {
	const context = vm.createContext({
		Buffer,
		URL,
		crypto,
		console,
		phrase: require("../../languages").phrase,
		Version: 1,
		app: { get() {}, post() {} },
	});

	vm.runInContext(fs.readFileSync(path.join(root, "mcp_api.js"), "utf8"), context);
	context.get_mcp_api_game_data = () => data;
	context.get_mcp_api_user = async () => ({ _id: "US_test" });
	return context;
}

async function searchCall(context, surface, args) {
	const response = {
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
	if (surface === "json") {
		await context.handle_mcp_api_call(
			{ params: { method: "search_game_data" }, body: { token: "test-token", ...args } },
			response,
		);
		return response.body;
	}
	await context.handle_mcp_transport(
		{
			get: (name) => (name === "authorization" ? "Bearer test-token" : ""),
			body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_game_data", arguments: args } },
		},
		response,
	);
	assert.equal(response.body.result.isError, response.body.result.structuredContent.failed === true);
	return response.body.result.structuredContent;
}

test("the reported multi-key query finds current skills and conditions through JSON and MCP", async () => {
	for (const surface of ["json", "mcp"]) {
		const context = loadSearch();
		const result = await searchCall(context, surface, { query: reportedQuery, match: "any" });
		assert.equal(result.success, true);
		assert.equal(result.match, "any");
		assert.equal(result.tokens.length, 9);
		for (const key of reportedQuery.split(" "))
			assert.ok(
				result.results.some((entry) => entry.name === key),
				key,
			);
		assert.ok(result.results.some((entry) => entry.section === "conditions" && entry.name === "anniversary_visit"));
		const restricted = await context.mcp_api_search_game_data({
			query: reportedQuery,
			match: "any",
			section: "skills",
		});
		assert.ok(restricted.results.every((entry) => entry.section === "skills"));
		assert.equal(
			restricted.results.some((entry) => entry.name === "anniversary_visit"),
			false,
		);
	}
});

test("existing all-term searches keep their matching and summary behavior", async () => {
	const context = loadSearch({
		items: {
			fireblade: { name: "Fire Blade", resistance: 12, attack: 30 },
			iceblade: { name: "Ice Blade", resistance: 20 },
			firegem: { name: "Fire Gem" },
		},
		craft: { heatedblade: { items: [[3, "fireshard"]], cost: 12000 } },
	});
	const all = await context.mcp_api_search_game_data({ query: "fire resistance" });
	assert.equal(all.match, "all");
	assert.deepEqual(
		Array.from(all.results, (entry) => entry.name),
		["fireblade"],
	);
	assert.equal(all.results[0].attack, undefined);
	assert.ok(all.results[0].matched_fields.some((field) => field.path === "resistance"));

	const any = await context.mcp_api_search_game_data({ query: "FIRE, resistance", match: "any", section: "items" });
	assert.deepEqual(Array.from(any.results, (entry) => entry.name).sort(), ["fireblade", "firegem", "iceblade"]);
	const limited = await context.mcp_api_search_game_data({ query: "fire resistance", match: "any", limit: 1 });
	assert.equal(limited.count, 1);
	const ingredient = await context.mcp_api_search_game_data({ query: "fireshard", section: "craft" });
	assert.equal(ingredient.results[0].name, "heatedblade");
});

test("search errors identify query limits and provide a usable example on both interfaces", async () => {
	for (const surface of ["json", "mcp"]) {
		const context = loadSearch();
		for (const [query, code] of [
			["x".repeat(501), "query_too_long"],
			["the and or !", "no_search_terms"],
			[Array.from({ length: 33 }, (_, i) => "key" + i).join(" "), "too_many_terms"],
		]) {
			const result = await searchCall(context, surface, { query });
			assert.equal(result.failed, true);
			assert.equal(result.reason, "invalid_query");
			assert.equal(result.field, "query");
			assert.equal(result.details.code, code);
			assert.equal(result.details.max_length, 500);
			assert.equal(result.details.received_length, query.length);
			assert.equal(result.details.max_terms, 32);
			assert.match(result.syntax, /spaces or commas/);
			assert.equal((await searchCall(context, surface, result.example)).success, true);
		}
	}
});

test("accepted searches include every term and publish their limits in the tool schema", async () => {
	const terms = Array.from({ length: 32 }, (_, i) => "term" + i);
	const context = loadSearch({
		items: {
			complete: { description: terms.join(" ") },
			partial: { description: terms.slice(0, 12).join(" ") },
		},
	});
	const result = await context.mcp_api_search_game_data({ query: terms.join(" ") });
	assert.equal(result.success, true);
	assert.equal(result.tokens.length, 32);
	assert.deepEqual(
		Array.from(result.results, (entry) => entry.name),
		["complete"],
	);
	assert.equal((await context.mcp_api_search_game_data({ query: "x".repeat(500) })).success, true);
	assert.equal(context.mcp_api_search_tokens(terms.join(" ")).length, 12);

	const tool = context.mcp_tools().find((tool) => tool.name === "search_game_data");
	assert.deepEqual(Array.from(tool.inputSchema.required), ["query"]);
	assert.equal(tool.inputSchema.properties.query.maxLength, 500);
	assert.equal(tool.inputSchema.properties.query.minLength, 1);
	assert.deepEqual(Array.from(tool.inputSchema.properties.match.enum), ["all", "any"]);
	const info = await context.mcp_api_get_api_info({});
	const json = info.methods.find((method) => method.name === "search_game_data");
	assert.equal(json.input_schema.properties.query.maxLength, 500);
});
