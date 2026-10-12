"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const G = require("./helpers/design");
const { read, load } = require("./helpers/server_vm");

function fixture() {
	const drawings = [];
	let receive;
	const c = vm.createContext({
		G,
		Dev: false,
		no_graphics: true,
		deferreds: {},
		RESOLVE_ALL: false,
		options: {},
		trade_slots: [],
		character: {},
		socket: {
			on(event, callback) {
				receive = callback;
			},
		},
		draw_trigger: (callback) => drawings.push(callback),
		equipment_sound() {},
		tut() {},
		ui_log() {},
		ui_error() {},
		call_code_function() {},
		console: {
			error: (error) => {
				throw Error(error);
			},
			log() {},
		},
	});
	load(c, "js/old_common_functions.js", ["deferred", "push_deferred", "resolve_deferred", "reject_deferred"]);
	const source = read("js/game.js"),
		start = source.indexOf('\tsocket.on("game_response",');
	vm.runInContext(source.slice(start, source.indexOf("\n\tsocket.on(", start + 1)), c);
	return { c, receive: (data) => receive(data), draw: () => drawings.splice(0).forEach((f) => f()) };
}

test("upgrade and compound terminal replies settle before drawing and settle only once", async () => {
	for (const [response, place, reason] of [
		["upgrade_success", "upgrade"],
		["upgrade_fail", "upgrade"],
		["upgrade_success_stat", "upgrade"],
		["upgrade_offering_success", "upgrade"],
		["compound_success", "compound"],
		["compound_fail", "compound"],
		["upgrade_invalid_offering", "upgrade", "offering"],
		["compound_no_scroll", "compound", "no_scroll"],
	]) {
		const h = fixture();
		let outcome;
		h.c.push_deferred(place).then(
			(data) => {
				outcome = data;
			},
			(error) => {
				outcome = error;
			},
		);
		h.receive({ response, num: 0, level: 1, stat_type: "str" });
		await Promise.resolve();
		assert(outcome, response + " waited for a redraw");
		if (reason) assert.equal(outcome.reason, reason);
		let next = false;
		h.c.push_deferred(place).then(
			() => {
				next = true;
			},
			() => {
				next = true;
			},
		);
		h.draw();
		await Promise.resolve();
		assert.equal(next, false, "drawing settled the next request");
	}
});

test("stale upgrade completion leaves pending CODE requests alone", async () => {
	const h = fixture();
	let settled = false;
	h.c.push_deferred("upgrade").then(() => {
		settled = true;
	});
	h.receive({ response: "upgrade_success", stale: true, level: 7 });
	await Promise.resolve();
	h.draw();
	await Promise.resolve();
	assert.equal(settled, false);
});

test("grace-only previews show the added amount, retain it on reopen, and reset for scrolls", () => {
	const fields = {};
	const c = vm.createContext({
		rendered_target: "upgrade",
		min: Math.min,
		$: (selector) => {
			const state = (fields[selector] ||= {});
			const element = {
				attr: (key, value) => {
					state[key] = value;
					return element;
				},
				css: () => element,
				html: (value) => {
					state.text = value;
					return element;
				},
				text: (value) => {
					state.text = value;
					return element;
				},
			};
			return element;
		},
	});
	load(c, "js/functions.js", ["set_uchance"]);
	c.set_uchance(1, false, 0.5);
	assert.equal(fields[".uchance"].text, "+0.5");
	assert.equal(fields[".upgradeaction"].text, "ADD GRACE");
	assert.match(fields[".uchance"].title, /Does not raise the item level/);
	c.set_uchance(c.last_uchance, false, c.last_ugrace);
	assert.equal(fields[".uchance"].text, "+0.5");
	c.set_uchance(0.75);
	assert.equal(fields[".uchance"].text, "%75.00");
	assert.equal(fields[".upgradeaction"].text, "UPGRADE");
	assert.equal(fields[".uchance"].title, "");
});
