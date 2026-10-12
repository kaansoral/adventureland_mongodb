"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load } = require("./helpers/server_vm");

function fixture() {
	const moves = [],
		timers = [],
		handlers = {};
	let editing = false;
	const c = vm.createContext({
		character: { real_x: 100, real_y: 200, ctype: "mage" },
		options: { move_with_arrows: true },
		keymap: { UP: "move_up", DOWN: "move_down", LEFT: "move_left", RIGHT: "move_right", B: "blink" },
		arrow_up: false,
		arrow_down: false,
		arrow_left: false,
		arrow_right: false,
		blink_pressed: false,
		socket: { emit() {} },
		no_html: false,
		inside: "game",
		map_editor: false,
		can_walk: () => true,
		move: (x, y) => moves.push([x, y]),
		setTimeout: (fn) => timers.push(fn),
		addEventListener: (event, fn) => {
			handlers[event] = fn;
		},
		$(selector) {
			return {
				length: typeof selector === "string" && selector.endsWith(":focus") && editing ? 1 : 0,
				blur(fn) {
					handlers.blur = fn;
				},
				focus(fn) {
					handlers.focus = fn;
				},
			};
		},
	});
	c.window = c;
	load(c, "js/functions.js", ["on_skill", "on_skill_up", "arrow_movement_logic"]);
	vm.runInContext(read("js/keyboard.js"), c);
	c.keyboard_logic();
	const key = (code, contenteditable = false) => ({ keyCode: code, target: { hasAttribute: () => contenteditable } });
	return {
		c,
		moves,
		timers,
		handlers,
		key,
		edit: () => {
			editing = true;
		},
	};
}

test("clicking a direction moves once without latching a held arrow", () => {
	for (const [key, expected] of [
		["UP", [100, 150]],
		["DOWN", [100, 250]],
		["LEFT", [50, 200]],
		["RIGHT", [150, 200]],
	]) {
		const { c, moves, timers } = fixture();
		c.on_skill(key);
		timers.forEach((fn) => fn());
		assert.deepEqual(moves, [expected]);
		for (let i = 0; i < 3; i++) c.arrow_movement_logic();
		assert.equal(moves.length, 1, "later movement ticks must not repeat a click");
	}
});

test("held keyboard directions keep working and release after focus enters an input", () => {
	const { c, moves, handlers, key, edit } = fixture();
	handlers.keydown(key(38));
	c.arrow_movement_logic();
	assert.deepEqual(moves, [[100, 150]]);
	edit();
	handlers.keyup(key(38));
	assert.equal(c.arrow_up, false);
	assert.equal(c.up_pressed, 0);
	c.arrow_movement_logic();
	assert.equal(moves.length, 1);
});

test("window blur releases held directions and allows the same key after refocus", () => {
	const { c, handlers, key } = fixture();
	handlers.keydown(key(37));
	handlers.keydown(key(66));
	assert.equal(c.arrow_left, true);
	assert.equal(c.blink_pressed, true);
	handlers.blur();
	assert.equal(c.arrow_left, false);
	assert.equal(c.blink_pressed, false);
	assert.equal(Object.keys(c.pressed).length, 0);
	handlers.keydown(key(37));
	assert.equal(c.arrow_left, true);
	handlers.keyup(key(37));
	assert.equal(c.arrow_left, false);
});
