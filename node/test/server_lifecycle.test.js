const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { read, load, socketHandler } = require("./helpers/server_vm");

test("destroying an instance moves spectators before deletion and disconnect cleanup remains idempotent", () => {
	const sent = [];
	const instances = {
		temporary: { map: "duelland", name: "temporary", players: {}, monsters: {}, observers: {} },
		main: { map: "main", name: "main", players: {}, monsters: {}, observers: {}, info: {} },
	};
	const observers = {};
	for (const id of ["A", "B"]) {
		const observer = {
			id,
			in: "temporary",
			map: "duelland",
			socket: { id, emit: (event, data) => sent.push({ id, event, data }) },
		};
		observers[id] = instances.temporary.observers[id] = observer;
	}
	const context = vm.createContext({
		instances,
		observers,
		observer_map: "main",
		observer_x: 0,
		observer_y: 0,
		mode: {},
		server_log() {},
		resume_instance() {},
	});
	load(context, "node/server_functions.js", ["destroy_instance", "delete_observer", "send_all_xy"]);
	load(context, "node/server.js", ["transport_observer_to"]);
	context.destroy_instance("temporary");
	assert.equal(instances.temporary, undefined);
	assert.deepEqual(Object.keys(instances.main.observers), ["A", "B"]);
	assert.equal(sent.filter((e) => e.event === "new_map").length, 2);
	assert.ok(sent.every((e) => e.data.in === "main" && e.data.entities.in === "main"));
	context.destroy_instance("temporary");
	for (const id of ["A", "B"]) {
		context.delete_observer({ id });
		context.delete_observer({ id });
	}
	assert.equal(Object.keys(observers).length, 0);
	assert.equal(Object.keys(instances.main.observers).length, 0);
});

test("stale spectator update, transport, and disconnect requests tolerate a missing instance", () => {
	const sent = [];
	const observer = { id: "A", in: "deleted", map: "duelland", socket: { id: "A", emit: (...args) => sent.push(args) } };
	const context = vm.createContext({
		instances: { main: { map: "main", players: {}, monsters: {}, observers: {}, info: {} } },
		observers: { A: observer },
		mode: {},
		resume_instance() {},
	});
	load(context, "node/server_functions.js", ["delete_observer", "send_all_xy"]);
	load(context, "node/server.js", ["transport_observer_to"]);
	assert.equal(context.send_all_xy(observer), undefined);
	assert.equal(context.send_all_xy(observer, { raw: true }).players.length, 0);
	context.transport_observer_to(observer, "also_deleted", "duelland", 0, 0);
	assert.equal(observer.in, "deleted");
	context.transport_observer_to(observer, "main", "main", 0, 0);
	assert.equal(observer.in, "main");
	delete context.instances.main;
	context.delete_observer(observer.socket);
	assert.equal(context.observers.A, undefined);
});

function pathContext() {
	const context = vm.createContext({
		console: { log() {} },
		G: { maps: {} },
		amap_data: {},
		smap_data: {},
		amap_step: 24,
		abs: Math.abs,
		floor: Math.floor,
		round: Math.round,
		server_log() {},
		Dev: false,
		options: {},
		precomputed_bfs: null,
	});
	load(context, "node/server_functions.js", ["fast_astar", "can_amove", "amap_round"]);
	load(context, "adventure_functions.js", ["mssince"]);
	const common = read("js/old_common_functions.js");
	vm.runInContext(common.slice(common.indexOf("var TYPE_MIN"), common.indexOf("function Heap(")), context);
	load(context, "js/old_common_functions.js", ["Heap", "vHeap", "point_distance"]);
	return context;
}

test("pathfinding safely returns no path when a grid is unavailable and still traverses a valid grid", () => {
	const context = pathContext();
	const request = { map: "late", sx: 0, sy: 0, tx: 48, ty: 0 };
	assert.equal(context.fast_astar(request), null);
	context.amap_data.late = { "0|0": 8, "24|0": 8, "48|0": 8 };
	const result = context.fast_astar(request);
	assert.ok(Array.isArray(result));
	assert.ok(result[0] > 0 && result[0] <= 48);
	assert.equal(result[1], 0);
});

test("opening a map after worker startup publishes its grid before it can receive movement requests", () => {
	const messages = [];
	const context = vm.createContext({
		console,
		G: { maps: { late: { no_bounds: true, monsters: [], npcs: [], spawns: [] } } },
		smap_data: {},
		amap_data: {},
		precomputed_bfs: { smap_data: { main: {} }, amap_data: { main: {} } },
		workers: [
			{ postMessage: (data) => messages.push(structuredClone(data)) },
			{ postMessage: (data) => messages.push(structuredClone(data)) },
		],
		instances: {},
		gameplay: "normal",
		future_ms: () => new Date(),
		future_s: () => new Date(),
		server_log() {},
	});
	load(context, "node/server_functions.js", ["server_bfs", "create_instance"]);
	context.create_instance("late-1", "late");
	assert.equal(context.smap_data.late, -1);
	assert.deepEqual(messages, [
		{ type: "map_data", map: "late", smap_data: -1, amap_data: {} },
		{ type: "map_data", map: "late", smap_data: -1, amap_data: {} },
	]);
	context.create_instance("late-2", "late");
	assert.equal(messages.length, 2);
});

test("worker accepts late grids and completes unavailable or failed requests with a null movement result", () => {
	const context = pathContext();
	const port = new EventEmitter(),
		results = [];
	port.postMessage = (data) => results.push(structuredClone(data));
	context.require = () => ({ workerData: { G: {}, smap_data: {}, amap_data: {} }, parentPort: port });
	context.setInterval = () => {};
	const source = read("node/server_worker.js");
	vm.runInContext(source.slice(source.indexOf("var { workerData, parentPort }")), context);
	const request = { type: "fast_astar", map: "late", sx: 0, sy: 0, tx: 48, ty: 0, id: "monster", in: "late-1" };
	port.emit("message", request);
	assert.deepEqual(results[0], { type: "monster_move", move: null, id: "monster", in: "late-1" });
	port.emit("message", { type: "map_data", map: "late", smap_data: {}, amap_data: { "0|0": 8, "24|0": 8, "48|0": 8 } });
	port.emit("message", request);
	assert.ok(results[1].move[0] > 0);
	context.fast_astar = () => {
		throw new Error("fixture path error");
	};
	port.emit("message", request);
	assert.equal(results[2].move, null);
});

test("late worker replies ignore removed instances and release waiting monsters on no-path results", () => {
	class Worker extends EventEmitter {
		constructor() {
			super();
		}
	}
	const monster = { working: true };
	const context = vm.createContext({
		console,
		Worker,
		path,
		__dirname: "/fixture",
		SHARE_ENV: {},
		G: {},
		smap_data: {},
		amap_data: {},
		instances: { active: { monsters: { monster } } },
		workers: [],
	});
	load(context, "node/server_functions.js", ["new_worker"]);
	const worker = context.new_worker(0);
	worker.emit("message", { type: "monster_move", in: "deleted", id: "monster", move: [1, 2] });
	worker.emit("message", { type: "monster_move", in: "active", id: "deleted", move: [1, 2] });
	worker.emit("message", { type: "monster_move", in: "active", id: "monster", move: null });
	assert.equal(monster.working, false);
	assert.equal(monster.going_x, undefined);
});

test("booster events after disconnect are harmless and valid activation still works", () => {
	const context = vm.createContext({
		socket: { id: "A" },
		players: {},
		fail_response() {},
		server_log() {},
		booster_items: ["xpbooster"],
		cache_item: (v) => v,
		resend() {},
		success_response() {},
	});
	const handler = socketHandler(context, "booster");
	handler({ num: 0, action: "activate" });
	context.players.A = { items: [{ name: "xpbooster" }], citems: [] };
	handler({ num: 0, action: "activate" });
	assert.ok(context.players.A.items[0].expires instanceof vm.runInContext("Date", context));
	assert.equal(context.players.A.citems[0], context.players.A.items[0]);
});

test("chat rejects non-string input and missing duels return a normal expired response", () => {
	const failures = [];
	const context = vm.createContext({
		socket: { id: "A", emit() {} },
		players: { A: { s: {} } },
		fail_response: (...args) => failures.push(args),
	});
	const say = socketHandler(context, "say");
	for (const message of [null, 1, {}, []]) say({ message });
	assert.ok(failures.every((args) => args[0] === "invalid"));
	context.E = {};
	context.instances = {};
	context.is_in_pvp = () => false;
	const duel = socketHandler(context, "duel");
	duel({ event: "enter", id: "expired", request_id: "request" });
	assert.equal(failures.at(-1)[2].reason, "duel_expired");
	context.E.duels = { expired: { a: ["A"], b: [] } };
	duel({ event: "enter", id: "expired", request_id: "request" });
	assert.equal(failures.at(-1)[2].reason, "duel_expired");
});
