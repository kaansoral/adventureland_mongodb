const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { phrase } = require("../../languages");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const own = (object, name) => Object.prototype.hasOwnProperty.call(object, name);

// The game's character is a PIXI 4 sprite, which inherits eventemitter3's methods as enumerable prototype properties.
function Emitter() {
	this._events = {};
}
Emitter.prototype.listeners = function listeners(event, exists) {
	return exists ? false : [];
};
Emitter.prototype.on = function on() {
	return this;
};
Emitter.prototype.once = function once() {
	return this;
};
Emitter.prototype.emit = function emit() {
	return false;
};
const sprite = (state) => Object.assign(new Emitter(), state);

// The CODE runner iframe: the real runner files against a parent window whose character may not exist yet.
function runner(character) {
	const logs = [];
	const parent = {
		character,
		G: { maps: { main: { spawns: [[0, 0]], doors: [], npcs: [] } }, monsters: {}, events: {}, skills: {} },
		S: {},
		phrase,
		code_buttons: {},
		drawings: [],
		add_log: (message) => logs.push(message),
		is_hidden: () => false,
	};
	const context = vm.createContext({
		parent,
		localStorage: {},
		Dev: false,
		console: { log() {}, warn() {} },
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
	vm.runInContext('character.on("new_map", function (data) { game_log("heard " + data.name); });', context);
	return { context, parent, logs };
}

const state = () => ({ name: "Listener", hp: 900, max_hp: 1000, real_x: 12, real_y: -40, items: [], s: {}, c: {} });

function assert_events_and_sprite(context, parent, logs) {
	context.proxy_all(); // what the runner's 50 ms interval does
	context.trigger_character_event("new_map", { name: "tavern" });
	assert.ok(logs.includes("heard tavern"), "character.on hears new_map: " + JSON.stringify(logs));
	assert.ok(Array.isArray(context.character.listeners));
	assert.ok(
		own(context.character, "listeners") && own(context.character, "on"),
		"the listener API stays in the runner",
	);
	for (const name of ["listeners", "on", "once"])
		assert.equal(own(parent.character, name), false, "the sprite keeps PIXI's " + name);
	assert.equal(parent.character.on, Emitter.prototype.on);
	assert.equal(context.character.hp, 900, "character state is still mirrored");
	assert.equal(context.character.x, 12);
}

test("character events keep working when CODE starts before the character exists", () => {
	const { context, parent, logs } = runner(null);
	parent.character = sprite(state());
	assert_events_and_sprite(context, parent, logs);
});

test("CODE started in game keeps its listeners off the character's sprite", () => {
	const { context, parent, logs } = runner(sprite(state()));
	assert_events_and_sprite(context, parent, logs);
});

test("the proxy still picks up new character properties and guards read-only ones", () => {
	const { context, parent, logs } = runner(sprite(state()));
	parent.character.gold = 5;
	context.proxy_all();
	assert.equal(context.character.gold, 5);
	vm.runInContext("character.gold = 7; character.hp = 1;", context);
	assert.equal(parent.character.gold, 7, "writable properties reach the character");
	assert.equal(parent.character.hp, 900, "read-only properties do not");
	assert.ok(logs.includes(phrase("code.readonly_character", { property: "hp" })));
	assert.equal(own(context.character, "emit"), false, "inherited PIXI methods are not character state");
});
