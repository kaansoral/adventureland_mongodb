const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load } = require("./helpers/server_vm");
const { drag_runtime } = require("./helpers/client_drag");

test("inventory, bank and equipment drops keep their existing socket requests, including slot zero", () => {
	for (const [source, target, event, packet] of [
		[{ inum: 0 }, { cnum: 1 }, "imove", { a: 1, b: 0 }],
		[{ inum: 0 }, { strnum: 0 }, "bank", { operation: "swap", inv: 0, str: 0, pack: "items0" }],
		[{ snum: 0 }, { cnum: 0 }, "bank", { operation: "swap", inv: 0, str: 0, pack: "items0" }],
		[{ snum: 0 }, { strnum: 1 }, "bank", { operation: "move", a: 0, b: 1, pack: "items0" }],
		[{ inum: 0 }, { slot: "mainhand" }, "equip", { num: 0, slot: "mainhand" }],
		[{ sname: "mainhand" }, { cnum: 0 }, "equip", { num: 0, slot: "mainhand", swap: true }],
	]) {
		const runtime = drag_runtime(source, target);
		runtime.drop();
		assert.deepEqual(runtime.packets, [[event, packet]]);
		assert.deepEqual(runtime.deferred, [event]);
	}
});

test("equipment dragged onto an occupied bag slot swaps; an empty slot still unequips", () => {
	const h = drag_runtime({ sname: "offhand" }, { cnum: 1 });
	h.drop();
	assert.deepEqual(h.packets, [["equip", { num: 1, slot: "offhand", swap: true }]]);
	h.context.character.items[1] = null;
	h.drop();
	assert.deepEqual(h.packets[1], ["unequip", { slot: "offhand", position: 1 }]);
});

test("trade drops still open the existing listing dialogue without moving the item", () => {
	const runtime = drag_runtime({ inum: 0 }, { slot: "trade1" });
	runtime.drop();
	assert.deepEqual(runtime.packets, []);
	assert.equal(runtime.dialogs.length, 1);
	assert.equal(runtime.dialogs[0][1].num, 0);
	assert.equal(runtime.dialogs[0][1].slot, "trade1");
});

test("missing drop targets cannot hang the page; removed sources and external drops do nothing", () => {
	const runtime = drag_runtime({ inum: 0 }, { cnum: 1 });
	runtime.drop("citem0", {});
	runtime.drop("citem0", null);
	runtime.drop("removed-source");
	runtime.drop("");
	assert.deepEqual(runtime.packets, []);
	runtime.drop();
	assert.equal(runtime.packets.length, 1, "later valid drops still work");
});

test("placeholder and same-slot drops remain no-ops", () => {
	const runtime = drag_runtime({ inum: 0 }, { cnum: 0 });
	runtime.drop();
	runtime.target.data.cnum = 1;
	runtime.context.character.items[0].name = "placeholder";
	runtime.drop();
	assert.deepEqual(runtime.packets, []);
});

test("Deploy preserves character and realm; only Tauri overrides the normal link", () => {
	for (const [is_tauri, is_electron] of [
		[true, false],
		[false, false],
		[false, true],
	]) {
		let html;
		const chain = {
			parent() {
				return this;
			},
			find() {
				return this;
			},
			removeClass() {
				return this;
			},
			addClass() {
				return this;
			},
			html(value) {
				html = value;
			},
		};
		const context = vm.createContext({
			is_tauri,
			is_electron,
			$: () => chain,
			tut() {},
			character: { name: "Current" },
			server_region: "US",
			server_identifier: "II",
			X: {
				characters: [
					{ name: "MacTest", level: 4, type: "mage", party: "", online: false },
					{ name: "AlreadyOnline", level: 7, type: "warrior", party: "", online: true },
				],
			},
		});
		load(context, "js/html.js", ["load_character_list"]);
		context.load_character_list();
		assert.match(html, /href='\/character\/MacTest\/in\/US\/II\/' target='_blank'/);
		assert.equal(html.includes("onclick='tauri_create_subwindow(this.href); return false;'"), is_tauri);
		assert.equal((html.match(/<a /g) || []).length, 1);
		assert.equal((html.match(/<\/a>/g) || []).length, 1);
		assert.ok(!html.includes("href='/character/AlreadyOnline"));
	}
});

test("Deploy calls the URL-aware native command; /window remains the original blank window", async () => {
	const calls = [],
		alerts = [];
	const context = vm.createContext({ console, Date });
	context.window = context;
	context.__TAURI__ = {
		core: {
			invoke(command, args) {
				calls.push([command, args]);
				return Promise.resolve();
			},
		},
	};
	context.show_alert = (text) => alerts.push(text);
	load(context, "js/tauri_functions.js", ["tauri_create_subwindow"]);
	context.tauri_invoke = context.__TAURI__.core.invoke;
	context.tauri_debug = () => {};
	const url = "https://adventure.land/character/MacTest/in/US/II/";
	await context.tauri_create_subwindow(url);
	assert.equal(calls[0][0], "create_character_window");
	assert.equal(calls[0][1].url, url);
	await context.tauri_create_subwindow();
	assert.deepEqual(calls[1], ["create_subwindow", undefined]);
	assert.deepEqual(alerts, []);
	// A running old binary must not silently ignore a new URL argument.
	context.tauri_invoke = () => Promise.reject("Command create_character_window not found");
	await context.tauri_create_subwindow(url);
	assert.match(alerts[0], /Please update the Steam client and restart Adventure Land/);
});

test("main and both secondary-window commands retain the native drag/drop fix and shared window cap", () => {
	const source = read("tauri/src-tauri/src/lib.rs");
	assert.equal((source.match(/\.disable_drag_drop_handler\(\)/g) || []).length, 2);
	assert.match(source, /async fn create_subwindow[\s\S]*?open_subwindow\(app, &state/);
	assert.match(
		source,
		/async fn create_character_window[\s\S]*?character_window_url\(&url, compatibility_mode\(&state\)\)\?;\s*open_subwindow\(app, &state, url\)/,
	);
	assert.match(source, /if open_subwindows >= 4/);
	assert.ok(
		JSON.parse(read("tauri/src-tauri/capabilities/default.json")).permissions.includes("allow-create-character-window"),
	);
});
