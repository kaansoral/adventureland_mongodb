const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { phrase } = require("../../languages");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const messageExample = read("docs/articles/code-api.html").match(
	/<div class="code">(code_settings\.log_cm = false;[\s\S]*?)<\/div>/,
)[1];
const settingsExample = read("docs/articles/code-globals.html").match(
	/<div class="code">(code_settings\.log_cm = false;[\s\S]*?)<\/div>/,
)[1];

function fixture(noGraphics = false) {
	const logs = [],
		consoleLogs = [],
		texts = [],
		moves = [];
	const parent = {
		character: {
			name: "SettingsTest",
			map: "main",
			real_x: 0,
			real_y: 0,
			moving: false,
			speed: 80,
			s: {},
			c: {},
			items: [],
			slots: {},
		},
		G: { maps: { main: { spawns: [[0, 0]], doors: [], npcs: [] } }, monsters: {}, events: {}, skills: {} },
		S: {},
		no_graphics: noGraphics,
		phrase,
		code_buttons: {},
		drawings: [],
		add_log: (message) => logs.push(message),
		is_hidden: () => false,
		d_text(message) {
			assert.equal(parent.no_graphics, false, "headless CODE must not enter the text renderer");
			texts.push(message);
		},
		move(x, y) {
			moves.push([x, y]);
			parent.character.real_x = x;
			parent.character.real_y = y;
			return Promise.resolve({ success: true });
		},
	};
	const context = vm.createContext({
		parent,
		localStorage: {},
		Dev: false,
		console: { log: (message) => consoleLogs.push(message), warn: (message) => consoleLogs.push(message) },
		setTimeout() {},
		setInterval() {},
		clearTimeout() {},
		requestAnimationFrame() {},
	});
	context.window = context;
	for (const file of ["common/js/common_functions.js", "js/old_common_functions.js", "js/pixi/fake/pixi.min.js"])
		vm.runInContext(read(file), context, { filename: file });
	parent.PIXI = context.PIXI;
	vm.runInContext(read("js/runner_functions.js"), context, { filename: "runner_functions.js" });
	vm.runInContext(read("js/runner_compat.js"), context, { filename: "runner_compat.js" });
	vm.runInContext("can_move = function() { return true; }; can_walk = function() { return true; };", context);
	return { context, parent, logs, consoleLogs, texts, moves };
}

test("smart_move keeps its route pending until its town step finishes", async () => {
	const { context, moves } = fixture(true);
	let arrive;
	context.town = () =>
		new Promise((resolve) => {
			arrive = resolve;
		});
	const route = context.smart_move({ x: 10, y: 0 });
	let settled = false;
	route.then(() => {
		settled = true;
	});
	context.smart.found = true;
	context.smart.plot = [
		{ town: true, map: "main", x: 0, y: 0 },
		{ map: "main", x: 10, y: 0 },
	];
	context.smart_move_logic();
	context.smart_move_logic();
	assert.equal(moves.length, 0, "do not walk and cancel the channel before its first player update");
	assert.equal(settled, false);
	arrive({ success: true });
	await Promise.resolve();
	context.smart_move_logic();
	context.smart_move_logic();
	assert.equal((await route).success, true);
	assert.deepEqual(moves, [[10, 0]]);
});

test("an interrupted town step rejects its route and cannot end a replacement route", async () => {
	const { context } = fixture(true);
	let fail;
	context.town = () =>
		new Promise((resolve, reject) => {
			fail = reject;
		});
	const old = context.smart_move({ x: 10, y: 0 });
	context.smart.found = true;
	context.smart.plot = [{ town: true, map: "main", x: 0, y: 0 }];
	context.smart_move_logic();
	const replacement = context.smart_move({ x: 20, y: 0 });
	await assert.rejects(old, (error) => error.reason === "interrupted");
	fail({ failed: true, reason: "interrupted" });
	await Promise.resolve();
	assert.equal(context.smart.moving, true);
	for (let i = 0; i < 6 && context.smart.moving; i++) context.smart_move_logic();
	assert.equal((await replacement).success, true);
});

test("stopping a town route calls its callback only once", async () => {
	const { context, parent } = fixture(true);
	parent.socket = { emit() {} };
	const callbacks = [];
	let fail;
	context.town = () =>
		new Promise((resolve, reject) => {
			fail = reject;
		});
	const route = context.smart_move({ x: 10, y: 0 }, (done) => callbacks.push(done));
	context.smart.found = true;
	context.smart.plot = [{ town: true, map: "main", x: 0, y: 0 }];
	context.smart_move_logic();
	context.stop("smart");
	await assert.rejects(route);
	fail({ failed: true, reason: "interrupted" });
	await Promise.resolve();
	assert.deepEqual(callbacks, [false]);
	assert.equal(context.smart.town, null);
});

test("the documented CM example suppresses only the default log and keeps custom handlers", () => {
	const { context, logs } = fixture();
	const event = { name: "Sender", message: { ready: true } };
	const customLog = "Sender: {&quot;ready&quot;:true}";
	context.trigger_character_event("cm", event);
	assert.deepEqual(logs, [phrase("code.cm_received", { name: "Sender" })]);
	logs.length = 0;
	vm.runInContext(messageExample, context);
	context.trigger_character_event("cm", event);
	assert.deepEqual(logs, [customLog]);
	context.code_settings.log_cm = true;
	context.trigger_character_event("cm", event);
	assert.deepEqual(logs.slice(1), [phrase("code.cm_received", { name: "Sender" }), customLog]);
	vm.runInContext(
		'on_cm = function(name, data) { game_log("override:" + name + ":" + data.ready); }; code_settings.log_cm = false;',
		context,
	);
	context.trigger_character_event("cm", event);
	assert.deepEqual(logs.slice(-2), ["override:Sender:true", customLog]);
});

test("CODE settings are independent for each run and leave errors and custom logs visible", () => {
	const first = fixture();
	vm.runInContext(settingsExample, first.context);
	const second = fixture();
	assert.deepEqual(JSON.parse(JSON.stringify(second.context.code_settings)), {
		log_cm: true,
		log_smart_move: true,
		show_smart_move_text: true,
	});
	vm.runInContext(
		'game_log("custom"); character.on("cm", function() { throw new Error("handler failed"); });',
		first.context,
	);
	first.context.trigger_character_event("cm", { name: "Sender", message: {} });
	assert.equal(first.logs[0], "custom");
	assert.match(first.logs[1], /handler failed/);
});

test("path logs and floating text switch independently without changing movement or completion", async () => {
	let baseline;
	for (const log of [true, false]) {
		for (const text of [true, false]) {
			const { context, logs, consoleLogs, texts, moves } = fixture();
			context.code_settings.log_smart_move = log;
			context.code_settings.show_smart_move_text = text;
			const callbacks = [];
			const promise = context.smart_move({ x: 10, y: 0 }, (done) => callbacks.push([done, context.smart.moving]));
			for (let step = 0; step < 6 && context.smart.moving; step++) context.smart_move_logic();
			assert.equal(context.smart.moving, false);
			assert.deepEqual(JSON.parse(JSON.stringify(await promise)), { success: true });
			assert.deepEqual(callbacks, [[true, false]]);
			if (!baseline) baseline = moves;
			assert.deepEqual(moves, baseline);
			assert.deepEqual(logs, log ? [phrase("code.path_searching"), phrase("code.path_found")] : []);
			assert.equal(consoleLogs.length, log ? 1 : 0);
			assert.deepEqual(texts, text ? [phrase("code.path_yes")] : []);
		}
	}
});

test("quiet pathfinding still reports failures and rejects its Promise", async () => {
	const { context, logs } = fixture();
	vm.runInContext(settingsExample, context);
	vm.runInContext("can_move = function() { return false; };", context);
	const callbacks = [];
	const promise = context.smart_move({ x: 1000, y: 0 }, (done) => callbacks.push(done));
	context.smart_move_logic();
	await assert.rejects(promise, (error) => error.reason === "failed");
	assert.deepEqual(callbacks, [false]);
	assert.deepEqual(logs, [phrase("code.path_missing")]);
});

test("floating thoughts are optional and headless CODE never enters the text renderer", async () => {
	for (const noGraphics of [false, true]) {
		for (const show of [true, false]) {
			const { context, parent, texts, moves } = fixture(noGraphics);
			context.code_settings.show_smart_move_text = show;
			const promise = context.smart_move({ x: 10, y: 0 });
			for (let step = 0; step < 6 && context.smart.moving; step++) context.smart_move_logic();
			await promise;
			assert.equal(texts.length, !noGraphics && show ? 1 : 0);
			texts.length = 0;
			moves.length = 0;
			vm.runInContext(
				"smart.moving = smart.searching = true; smart.found = false; Math.random = function() { return 0.01; }; continue_pathfinding = function() {};",
				context,
			);
			context.smart_move_logic();
			assert.equal(moves.length, 1, "text settings must not change the existing movement while thinking");
			assert.equal(texts.length, !noGraphics && show ? 1 : 0);
			parent.no_graphics = true;
			texts.length = 0;
			context.smart_move_logic();
			assert.equal(texts.length, 0, "the live no_graphics flag wins even if game.graphics is stale");
		}
	}
});
