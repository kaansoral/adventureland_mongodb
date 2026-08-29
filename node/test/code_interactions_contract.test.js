const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const runnerSource = fs.readFileSync(path.join(root, "js/runner_functions.js"), "utf8");

function extractFunction(source, name) {
	const marker = "function " + name + "(";
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, "missing function " + name);
	const brace = source.indexOf("{", start + marker.length);
	let depth = 0;
	let quote = null;
	let escaped = false;
	let lineComment = false;
	let blockComment = false;
	for (let i = brace; i < source.length; i++) {
		const char = source[i];
		const next = source[i + 1];
		if (lineComment) {
			if (char === "\n") lineComment = false;
			continue;
		}
		if (blockComment) {
			if (char === "*" && next === "/") {
				blockComment = false;
				i++;
			}
			continue;
		}
		if (quote) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && next === "/") {
			lineComment = true;
			i++;
			continue;
		}
		if (char === "/" && next === "*") {
			blockComment = true;
			i++;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "{") depth++;
		if (char === "}") {
			depth--;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	throw new Error("unterminated function " + name);
}

class FakeSocket extends EventEmitter {
	constructor() {
		super();
		this.sent = [];
	}
	emit(event, data) {
		this.sent.push({ event, data });
		return super.emit(event, data);
	}
}

function runnerContext() {
	const socket = new FakeSocket();
	let request = 0;
	const context = vm.createContext({
		Object,
		Promise,
		RESOLVE_ALL: false,
		character: { map: "main", s: {} },
		clearTimeout,
		is_function: (value) => typeof value === "function",
		is_number: (value) => typeof value === "number" && Number.isFinite(value),
		is_object: (value) => value !== null && typeof value === "object",
		is_string: (value) => typeof value === "string",
		max: Math.max,
		parent: { socket, push_deferred: () => Promise.resolve({ success: true }) },
		quantity: () => 0,
		randomStr: () => "request-" + ++request,
		rejecting_promise: (data) => Promise.reject(Object.assign({ failed: true }, data)),
		setTimeout,
		wait_for: (condition) =>
			Promise.resolve().then(() => {
				context.character.map = "resort";
				context.character.s.holidayspirit = { ms: 1 };
				assert.equal(condition(), true);
				return true;
			}),
	});
	const names = [
		"wait_for_event",
		"interact",
		"mainframe_command",
		"get_pvp_history",
		"send_duel_challenge",
		"accept_duel_challenge",
		"enter_duel",
		"get_secondhands",
		"buy_secondhand",
		"get_lost_and_found",
		"buy_lost_and_found",
		"donate_gold",
		"get_tavern_info",
		"bet_dice",
		"play_slots",
		"destat_item",
	];
	vm.runInContext(names.map((name) => extractFunction(runnerSource, name)).join("\n"), context);
	return { context, socket };
}

test("runner methods emit only their established socket events and correlate terminal responses", async () => {
	const cases = [
		["get_secondhands", [], "secondhands", "game_response", "secondhands"],
		["buy_secondhand", ["sale-rid"], "sbuy", "game_response", "secondhands"],
		["get_lost_and_found", [], "lostandfound", "game_response", "lostandfound"],
		["mainframe_command", ["hello"], "eval", "game_response", "mainframe"],
		["buy_lost_and_found", ["found-rid"], "sbuy", "game_response", "lostandfound"],
		["donate_gold", [1000000], "donate", "game_response", "donate"],
		["send_duel_challenge", ["B"], "duel", "game_response", "duel"],
		["accept_duel_challenge", ["A"], "duel", "game_response", "duel"],
		["enter_duel", ["duel-id"], "duel", "game_response", "duel"],
		["bet_dice", ["down", 55, 10000], "bet", "game_response", "dice"],
		["play_slots", [], "bet", "game_response", "slots"],
		["destat_item", [0], "destat", "game_response", "destat"],
	];

	for (const [name, args, outboundEvent, responseEvent, place] of cases) {
		const { context, socket } = runnerContext();
		const promise = context[name](...args);
		const outbound = socket.sent.find((entry) => entry.event === outboundEvent);
		assert.ok(outbound, name + " did not emit " + outboundEvent);
		assert.match(outbound.data.request_id, /^request-/);
		socket.emit(responseEvent, { response: "data", place, request_id: "unrelated", success: true });
		await Promise.resolve();
		socket.emit(responseEvent, { response: "data", place, request_id: outbound.data.request_id, success: true });
		const result = await promise;
		assert.equal(result.request_id, outbound.data.request_id);
	}
});

test("read-only channel methods use the legacy correlation fields", async () => {
	const pvp = runnerContext();
	const historyPromise = pvp.context.get_pvp_history();
	const listRequest = pvp.socket.sent.find((entry) => entry.event === "list_pvp");
	pvp.socket.emit("pvp_list", { code: "unrelated", list: [1] });
	pvp.socket.emit("pvp_list", { code: listRequest.data.code, list: ["entry"] });
	const history = await historyPromise;
	assert.equal(history.success, true);
	assert.equal(history.list.length, 1);
	assert.equal(history.list[0], "entry");

	const tavern = runnerContext();
	const infoPromise = tavern.context.get_tavern_info();
	const infoRequest = tavern.socket.sent.find((entry) => entry.event === "tavern");
	tavern.socket.emit("game_response", {
		response: "data",
		place: "tavern",
		request_id: infoRequest.data.request_id,
		edge: 1,
		max: 2,
		success: true,
	});
	const info = await infoPromise;
	assert.equal(info.edge, 1);
	assert.equal(info.max, 2);
});

test("special interact calls remain whitelisted and the lever waits for arrival", async () => {
	const tree = runnerContext();
	const treePromise = tree.context.interact("newyear_tree");
	const treeRequest = tree.socket.sent.find((entry) => entry.event === "interaction");
	assert.equal(treeRequest.data.type, "newyear_tree");
	tree.socket.emit("game_response", {
		response: "data",
		place: "interaction",
		request_id: treeRequest.data.request_id,
		success: true,
	});
	assert.equal((await treePromise).success, true);

	const lever = runnerContext();
	lever.context.character.map = "resort_e";
	const leverPromise = lever.context.interact("the_lever");
	const leverRequest = lever.socket.sent.find((entry) => entry.event === "interaction");
	lever.socket.emit("game_response", {
		response: "data",
		place: "interaction",
		request_id: leverRequest.data.request_id,
		success: true,
	});
	assert.equal((await leverPromise).map, "resort");
	await assert.rejects(() => lever.context.interact("arbitrary_socket_event"), /invalid|object/i);
});

test("server retains legacy payloads while adding opt-in request completion", () => {
	const server = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
	const serverFunctions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");
	assert.match(server, /socket\.emit\("secondhands", csold\)/);
	assert.match(server, /socket\.emit\("lostandfound", cfound\)/);
	assert.match(server, /event: "chellenge"/);
	assert.match(server, /data == "the_lever" \|\| data\.type == "the_lever"/);
	assert.match(server, /else player\.socket\.emit\("game_response", "slots_success"\)/);
	assert.match(server, /else player\.socket\.emit\("game_response", "slots_fail"\)/);
	assert.match(server, /socket\.emit\("pvp_list", \{ code: data && data\.code, list: plist \}\)/);
	assert.match(server, /if \(data\.request_id\) success_response\("data", "mainframe", mainframe_result\)/);
	assert.match(serverFunctions, /place: "dice"/);
	assert.match(serverFunctions, /request_id: bet\.request_id/);
});

test("all added public methods have directory entries and function pages", () => {
	const directory = fs.readFileSync(path.join(root, "docs/directory.js"), "utf8");
	const methods = [
		"destat_item",
		"mainframe_command",
		"get_secondhands",
		"buy_secondhand",
		"get_lost_and_found",
		"buy_lost_and_found",
		"donate_gold",
		"get_pvp_history",
		"send_duel_challenge",
		"accept_duel_challenge",
		"enter_duel",
		"get_tavern_info",
		"bet_dice",
		"play_slots",
	];
	for (const method of methods) {
		assert.match(directory, new RegExp('"' + method + '"'));
		assert.equal(
			fs.existsSync(path.join(root, "docs/functions", method + ".html")),
			true,
			method + " documentation missing",
		);
	}
});
