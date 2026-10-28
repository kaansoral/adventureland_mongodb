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
		G: { games: { wheel: { sides: ["sun", "moon"] } } },
		in_arr: (value, array) => array.includes(value),
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
		"bet_wheel",
		"poker_request",
		"get_poker_table",
		"poker_join",
		"poker_leave",
		"poker_act",
		"poker_sit_out",
		"poker_sit_in",
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
		["bet_wheel", ["sun", 10000], "bet", "game_response", "wheel"],
		["poker_join", [800000000, 1], "poker", "game_response", "poker"],
		["poker_leave", [], "poker", "game_response", "poker"],
		["poker_act", ["raise", 60000000], "poker", "game_response", "poker"],
		["poker_sit_out", [], "poker", "game_response", "poker"],
		["poker_sit_in", [], "poker", "game_response", "poker"],
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
	const slotsLogic = fs.readFileSync(path.join(root, "node/logic/tavern_slots.js"), "utf8");
	assert.match(slotsLogic, /else player\.socket\.emit\("game_response", ref\.won \? "slots_success" : "slots_fail"\)/);
	assert.match(server, /return tavern_slots_bet\(player, data, bet_failure, request_id\)/);
	assert.match(server, /tavern_poker_request\(player, data\)/);
	const pokerLogic = fs.readFileSync(path.join(root, "node/logic/tavern_poker.js"), "utf8");
	assert.match(pokerLogic, /place: "poker", success: true/);
	assert.match(pokerLogic, /place: "poker", failed: true/);
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
		"bet_wheel",
		"get_poker_table",
		"poker_join",
		"poker_leave",
		"poker_act",
		"poker_sit_out",
		"poker_sit_in",
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

test("exchange waits for its own completion even when its old slot and queue are reused", async () => {
	const { load } = require("./helpers/server_vm");
	const h = runnerContext(),
		c = h.context;
	c.character.items = [{ name: "candy0", q: 1 }];
	c.character.q = {};
	c.setTimeout = () => {
		throw Error("exchange must not poll or time out a completed request");
	};
	load(c, "js/runner_functions.js", ["exchange"]);
	const result = vm.runInContext(
		"(async function(){try {return await exchange(0);} finally {globalThis.finally_ran=true;}})()",
		c,
	);
	const request = h.socket.sent.find((r) => r.event === "exchange");
	h.socket.emit("game_response", { place: "exchange", request_id: request.data.request_id, in_progress: true, num: 0 });
	h.socket.emit("game_response", { place: "exchange", request_id: "other", success: true });
	await Promise.resolve();
	assert.equal(c.finally_ran, undefined);
	// A later action can occupy the same slot before a polling timer observes completion.
	c.character.q.exchange = { num: 0, request_id: "later" };
	c.character.items[0] = { name: "placeholder" };
	h.socket.emit("game_response", {
		place: "exchange",
		request_id: request.data.request_id,
		success: true,
		reward: "glitch",
		num: 5,
	});
	assert.deepEqual(JSON.parse(JSON.stringify(await result)), { success: true, reward: "glitch", num: 5 });
	assert.equal(c.finally_ran, true);
	assert.equal(h.socket.listenerCount("game_response"), 0);
	assert.equal(h.socket.listenerCount("disconnect"), 0);
});

test("exchange finally runs immediately on refusal or disconnect, before or after acceptance", async () => {
	const { load } = require("./helpers/server_vm");
	for (const resolveAll of [false, true])
		for (const accepted of [false, true])
			for (const disconnected of [false, true]) {
				const h = runnerContext(),
					c = h.context;
				c.RESOLVE_ALL = resolveAll;
				c.character.items = [{ name: "candy0", q: 1 }];
				c.character.q = {};
				load(c, "js/runner_functions.js", ["exchange"]);
				const result = vm.runInContext(
					"(async function(){try {return await exchange(0);} finally {globalThis.finally_ran=true;}})()",
					c,
				);
				const request = h.socket.sent.find((r) => r.event === "exchange");
				if (accepted)
					h.socket.emit("game_response", {
						place: "exchange",
						request_id: request.data.request_id,
						in_progress: true,
						num: 0,
					});
				const reason = disconnected ? "disconnected" : "distance";
				if (disconnected) h.socket.emit("disconnect");
				else
					h.socket.emit("game_response", {
						place: "exchange",
						request_id: request.data.request_id,
						failed: true,
						response: reason,
					});
				if (resolveAll) assert.equal((await result).reason, reason);
				else await assert.rejects(result, (e) => e.reason === reason);
				assert.equal(c.finally_ran, true);
				assert.equal(h.socket.listenerCount("game_response"), 0);
				assert.equal(h.socket.listenerCount("disconnect"), 0);
			}
});

test("invalid smart_move replacement stops the old route without throwing or reusing its path", async () => {
	const { load } = require("./helpers/server_vm");
	for (const destination of [null, undefined, false, "unknown_place", { x: Infinity, y: 0 }, { x: 0, y: NaN }]) {
		const h = runnerContext(),
			c = h.context;
		let interrupted = 0;
		c.smart = { moving: true, found: true, plot: [{ map: "main", x: 900, y: 900 }], on_done: () => interrupted++ };
		c.G = { events: {}, maps: {}, monsters: {} };
		c.parent.phrase = (x) => x;
		c.game_log = () => {};
		c.find_npc = () => null;
		load(c, "js/runner_functions.js", ["smart_move"]);
		let callback;
		await assert.rejects(
			c.smart_move(destination, (value) => {
				callback = value;
			}),
			(e) => e.reason === "invalid",
		);
		assert.equal(callback, false);
		assert.equal(interrupted, 1);
		assert.equal(c.smart.moving, false);
	}
});

function movementContext() {
	const { load } = require("./helpers/server_vm");
	const c = runnerContext().context;
	Object.assign(c, {
		Dev: false,
		deferreds: {},
		smart: { moving: false },
		code_settings: { log_smart_move: false },
		game_log() {},
		can_walk: () => true,
		is_transporting: () => false,
		can_move_to: () => false,
	});
	c.parent.phrase = (id) => id;
	Object.assign(c.character, { real_x: 0, real_y: 0 });
	load(c, "js/old_common_functions.js", [
		"deferred",
		"push_deferred",
		"resolve_deferred",
		"reject_deferred",
		"resolve_deferreds",
		"reject_deferreds",
	]);
	load(c, "js/runner_functions.js", ["smart_move", "smart_move_logic"]);
	return c;
}

test("a lost smart_move path replans without interrupting its Promise or callback", async () => {
	const c = movementContext();
	const callbacks = [];
	let outcome;
	const journey = c.smart_move({ x: 100, y: 100 }, (value) => callbacks.push(value));
	journey.then(
		(value) => {
			outcome = value;
		},
		(error) => {
			outcome = error;
		},
	);
	c.smart.found = true;
	c.smart.plot = [{ map: "main", x: 50, y: 50 }];
	c.smart_move_logic();
	await Promise.resolve();
	assert.equal(outcome, undefined, "replanning settled the original journey");
	assert.deepEqual(callbacks, []);
	let searches = 0;
	c.start_pathfinding = () => {
		searches++;
		c.smart.found = true;
		c.smart.plot = [{ map: "main", x: 100, y: 100 }];
	};
	c.can_move_to = () => true;
	c.move = (x, y) => Object.assign(c.character, { real_x: x, real_y: y });
	c.smart_move_logic();
	c.smart_move_logic();
	c.smart_move_logic();
	assert.equal(searches, 1);
	assert.equal((await journey).success, true);
	assert.deepEqual(callbacks, [true]);
	assert.equal(c.deferreds.smart_move, undefined);
});

test("the coordinate MOVE button sends numeric coordinates to smart_move", async () => {
	const { load } = require("./helpers/server_vm");
	const c = movementContext();
	load(c, "js/functions.js", ["code_move"]);
	let journey;
	c.code_eval = (source) => {
		journey = vm.runInContext(source, c);
		journey.catch(() => {});
	};
	c.code_move("-12.5", "84");
	assert.equal(c.smart.moving, true);
	assert.equal(c.smart.x, -12.5);
	assert.equal(c.smart.y, 84);
	c.smart.moving = false;
	c.smart.on_done(true);
	assert.equal((await journey).success, true);
});

test("equip_batch rejects empty entries without throwing or sending an equipment request", async () => {
	const { load } = require("./helpers/server_vm");
	for (const data of [[null], [undefined], Array(1)]) {
		const h = runnerContext(),
			c = h.context;
		c.parent.phrase = (id) => id;
		c.game_log = () => {};
		load(c, "js/runner_functions.js", ["equip_batch"]);
		await assert.rejects(c.equip_batch(data), (error) => error.reason === "invalid");
		assert.equal(h.socket.sent.length, 0);
	}
	const h = runnerContext();
	load(h.context, "js/runner_functions.js", ["equip_batch"]);
	await h.context.equip_batch([
		{ num: 0, slot: "chest" },
		{ num: 1, slot: "orb" },
	]);
	assert.equal(h.socket.sent.length, 1);
	assert.equal(h.socket.sent[0].event, "equip_batch");
});

test("find_npc reads roaming NPC routes and preserves stationary and seasonal lookups", () => {
	const { load } = require("./helpers/server_vm");
	const h = runnerContext(),
		c = h.context;
	c.parent.G = require("./helpers/design");
	c.parent.S = {};
	load(c, "js/runner_functions.js", ["find_npc"]);
	for (const [id, map, x, y] of [
		["pvp", "main", 232, 388],
		["citizen20", "mtunnel", 0, 8],
	]) {
		const found = c.find_npc(id);
		assert.deepEqual(JSON.parse(JSON.stringify(found)), { map, in: map, x, y });
	}
	assert(c.find_npc("newupgrade"));
	assert.equal(c.find_npc("nonexistent_npc"), null);
});
