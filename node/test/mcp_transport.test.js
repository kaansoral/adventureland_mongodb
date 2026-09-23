"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modernVersion = "2026-07-28";
const legacyVersions = ["2025-11-25", "2025-06-18", "2025-03-26", ""];
const source = fs.readFileSync(path.resolve(__dirname, "../../mcp_api.js"), "utf8");

function transport() {
	const context = vm.createContext({
		Buffer,
		URL,
		crypto,
		console: { error() {} },
		app: { get() {}, post() {} },
		phrase: require("../../languages").phrase,
		gf: (entity, field, fallback) => (entity[field] === undefined ? fallback : entity[field]),
		get_user_data: async () => ({ code_list: { 1: ["Farm", 2] } }),
		docs: { guide: [["adventure-mcp", "Adventure Land MCP", "mcp", "#fff"]], references: [], functions: [] },
		shtml: () => "<p>Adventure Land MCP guide.</p>",
	});
	vm.runInContext(source, context, { filename: "mcp_api.js" });
	context.get_mcp_api_user = async (token) => (token === "test-token" ? { _id: "US_test" } : null);
	context.mcp_get_prompt = async () => ({
		messages: [{ role: "user", content: { type: "text", text: "Read CODE." } }],
	});
	async function request(method, params = {}, version = modernVersion, options = {}) {
		const headers = { authorization: "Bearer test-token" };
		if (version) headers["mcp-protocol-version"] = version;
		if (version === modernVersion) {
			headers["mcp-method"] = method;
			if (method === "tools/call") headers["mcp-name"] = params.name;
			params = {
				...params,
				_meta: {
					"io.modelcontextprotocol/protocolVersion": version,
					"io.modelcontextprotocol/clientInfo": { name: "transport-test", version: "1.0.0" },
					"io.modelcontextprotocol/clientCapabilities": {},
				},
			};
		}
		Object.assign(headers, options.headers);
		const response = {
			headers: {},
			status(code) {
				this.statusCode = code;
				return this;
			},
			set(name, value) {
				this.headers[name] = value;
				return this;
			},
			send(body) {
				this.body = JSON.parse(JSON.stringify(body));
				return this;
			},
			end() {
				return this;
			},
		};
		await context.handle_mcp_transport(
			{
				get: (name) => headers[name.toLowerCase()] || "",
				body: { jsonrpc: "2.0", id: options.notification ? undefined : 1, method, params },
			},
			response,
		);
		return response;
	}
	return { context, request };
}

const catalogs = {
	"tools/list": "tools",
	"resources/list": "resources",
	"resources/templates/list": "resourceTemplates",
	"prompts/list": "prompts",
};

// Required fields in schema/2026-07-28/schema.ts: Result and CacheableResult.
function complete(response, cacheable = false) {
	assert.equal(response.statusCode, 200);
	assert.equal(response.body.error, undefined);
	assert.equal(response.body.result.resultType, "complete");
	assert.equal(response.body.resultType, undefined);
	if (cacheable) {
		assert.ok(Number.isSafeInteger(response.body.result.ttlMs) && response.body.result.ttlMs >= 0);
		assert.equal(response.body.result.cacheScope, "private");
	}
	return response.body.result;
}

test("modern discovery and tool fetching return complete results with valid cache hints", async () => {
	const { request } = transport();
	const discovery = complete(await request("server/discover"), true);
	assert.ok(discovery.supportedVersions.includes(modernVersion));
	assert.ok(discovery.capabilities.tools);
	const listed = complete(await request("tools/list"), true);
	assert.ok(listed.tools.some((tool) => tool.name === "get_bank"));
	assert.ok(listed.tools.some((tool) => tool.name === "mainframe_get_dashboard"));
	assert.equal(listed.ttlMs, 0);
	assert.ok(listed._meta["io.modelcontextprotocol/serverInfo"]);
	// Discovery probes can arrive before the client has selected a revision.
	complete(await request("server/discover", {}, ""), true);
});

test("modern resource and prompt catalogs and reads include all required envelope fields", async () => {
	const { request } = transport();
	for (const [method, field] of Object.entries(catalogs)) {
		const result = complete(await request(method), true);
		assert.ok(Array.isArray(result[field]), method);
	}
	const read = complete(await request("resources/read", { uri: "adventureland://guide/start-here" }), true);
	assert.match(read.contents[0].text, /Adventure Land MCP guide/);
	const prompt = complete(await request("prompts/get", { name: "learn_adventure_land" }));
	assert.equal(prompt.messages[0].content.text, "Read CODE.");
	complete(await request("ping"));
});

test("modern tool success and tool failures are complete without changing their content", async () => {
	const { context, request } = transport();
	const success = complete(await request("tools/call", { name: "list_codes", arguments: {} }));
	assert.equal(success.isError, false);
	assert.equal(success.structuredContent.codes[0].name, "Farm");
	assert.equal(success.structuredContent.resultType, undefined);
	assert.deepEqual(JSON.parse(success.content[0].text), success.structuredContent);
	const failure = complete(await request("tools/call", { name: "get_code_method", arguments: { name: "missing" } }));
	assert.equal(failure.isError, true);
	assert.equal(failure.structuredContent.reason, "not_found");
	context.get_user_data = async () => {
		throw new Error("test failure");
	};
	const exception = complete(await request("tools/call", { name: "list_codes", arguments: {} }));
	assert.equal(exception.isError, true);
	assert.deepEqual(exception.structuredContent, { failed: true, reason: "exception" });
});

test("older clients keep their existing result shapes and version negotiation", async () => {
	for (const version of legacyVersions) {
		const { request } = transport();
		const initialization = await request("initialize", { protocolVersion: version || "unsupported" }, version);
		assert.equal(initialization.body.result.protocolVersion, version || "2025-11-25");
		assert.equal(initialization.body.result.resultType, undefined);
		for (const [method, field] of Object.entries(catalogs)) {
			const { body, statusCode } = await request(method, {}, version);
			assert.equal(statusCode, 200);
			assert.ok(Array.isArray(body.result[field]));
			assert.equal(body.result.resultType, undefined);
			assert.equal(body.result.ttlMs, undefined);
			assert.equal(body.result.cacheScope, undefined);
		}
		const call = await request("tools/call", { name: "list_codes", arguments: {} }, version);
		assert.equal(call.body.result.resultType, undefined);
		assert.equal(call.body.result.structuredContent.codes[0].name, "Farm");
		assert.deepEqual((await request("ping", {}, version)).body.result, {});
	}
	const { request } = transport();
	const modern = complete(await request("initialize", { protocolVersion: modernVersion }, ""));
	assert.equal(modern.protocolVersion, modernVersion);
});

test("protocol errors, auth failures, and notifications do not become completed results", async () => {
	const { request } = transport();
	for (const [method, params, options, status] of [
		["tools/list", {}, { headers: { authorization: "Bearer wrong-token" } }, 401],
		["tools/list", {}, { headers: { origin: "https://untrusted.example" } }, 403],
		["tools/list", {}, { headers: { "mcp-method": "resources/list" } }, 400],
		["tools/list", { cursor: "invalid" }, {}, 200],
		["tools/call", { name: "missing" }, {}, 200],
	]) {
		const response = await request(method, params, modernVersion, options);
		assert.equal(response.statusCode, status);
		assert.equal(typeof response.body.error.code, "number");
		assert.equal(response.body.result, undefined);
		assert.equal(response.body.error.resultType, undefined);
	}
	const notification = await request("notifications/initialized", {}, modernVersion, { notification: true });
	assert.equal(notification.statusCode, 202);
	assert.equal(notification.body, undefined);
});
