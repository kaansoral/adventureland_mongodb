"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const browserFiles = [
	"js/functions.js",
	"js/game.js",
	"js/html.js",
	"js/keyboard.js",
	"js/runner_functions.js",
	"js/runner_compat.js",
	"js/old_common_functions.js",
	"htmls/contents/selection.html",
	"htmls/contents/selection_characters.html",
	"htmls/contents/character.html",
];

function source() {
	return browserFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
}

function functionSource(code, name, nextName) {
	const start = code.indexOf(`function ${name}(`);
	const end = code.indexOf(`function ${nextName}(`, start);
	assert.notEqual(start, -1, `browser source is missing ${name}`);
	assert.notEqual(end, -1, `browser source is missing ${nextName}`);
	return code.slice(start, end).trim();
}

function combatHarness() {
	const code = source();
	const context = {
		G: { abilities: { attack: { target: true }, heal: { target: true } } },
		is_array: Array.isArray,
		character: { range: 100, team: null },
		ctarget: null,
		xtarget: null,
		keymap: { attack: "attack", heal: "heal" },
		deferred: [],
		distance: () => 0,
		direction_logic: () => {},
		draw_trigger: (callback) => callback(),
		d_text: () => {},
		rejecting_promise: (value) => value,
		add_log: () => {},
		push_deferred: null,
		socket: {
			events: [],
			emit(name, payload) {
				this.events.push([name, payload]);
			},
		},
	};
	context.push_deferred = (name) => {
		context.deferred.push(name);
		return name;
	};
	vm.createContext(context);
	context.use_ability = vm.runInContext(`(${functionSource(code, "use_ability", "on_ability")})`, context);
	return {
		context,
		onAbility: vm.runInContext(`(${functionSource(code, "on_ability", "on_ability_up")})`, context),
		playerAttack: vm.runInContext(`(${functionSource(code, "player_attack", "player_heal")})`, context),
		playerHeal: vm.runInContext(`(${functionSource(code, "player_heal", "monster_attack")})`, context),
		monsterAttack: vm.runInContext(`(${functionSource(code, "monster_attack", "player_right_click")})`, context),
	};
}

test("browser code has a single ability action vocabulary", () => {
	const code = source();
	assert.doesNotMatch(code, /use_skill|next_skill|skill_timeout|socket\.emit\("skill"|socket\.on\("skill"/);
	assert.match(code, /function use_ability\(/);
	assert.match(code, /function ability_timeout\(/);
	assert.match(code, /socket\.emit\("ability"/);
	assert.doesNotMatch(code, /socket\.emit\("(?:attack|heal)"/);
	assert.match(code, /socket\.on\("ability_timeout"/);
});

test("browser combat producers normalize targets through the ability wire", () => {
	const { context, onAbility, playerAttack, playerHeal, monsterAttack } = combatHarness();
	for (const [producer, name, target, selected] of [
		[() => onAbility("attack"), "attack", { id: "target-on-ability-attack" }, true],
		[() => onAbility("heal"), "heal", { id: "target-on-ability-heal" }, true],
		[
			() => playerAttack.call({ id: "target-player-attack" }, null, true),
			"attack",
			{ id: "target-player-attack" },
			false,
		],
		[() => playerHeal.call({ id: "target-player-heal" }, null, true), "heal", { id: "target-player-heal" }, false],
		[
			() => monsterAttack.call({ id: "target-monster-attack" }, null, true),
			"attack",
			{ id: "target-monster-attack" },
			false,
		],
	]) {
		context.socket.events = [];
		context.deferred.length = 0;
		context.xtarget = null;
		context.ctarget = null;
		if (selected) context.xtarget = target;
		producer();
		assert.deepEqual(JSON.parse(JSON.stringify(context.socket.events)), [["ability", { name, id: target.id }]]);
		assert.deepEqual([...context.deferred], [name]);
	}
});

test("browser character and appearance surfaces use skill progression", () => {
	const code = source();
	assert.doesNotMatch(code, /G\.classes|G\.levels|\.ctype/);
	assert.match(code, /character\.skills/);
	assert.match(code, /character\.total_level/);
	assert.match(code, /G\.character\.appearances/);
	assert.match(
		fs.readFileSync(path.join(root, "htmls/contents/selection.html"), "utf8"),
		/domain\.character\.appearances/,
	);
	assert.doesNotMatch(fs.readFileSync(path.join(root, "htmls/contents/selection.html"), "utf8"), /char:/);
	assert.doesNotMatch(code, /calculate_item_properties\([^\n]+class:/);
	assert.match(fs.readFileSync(path.join(root, "main.js"), "utf8"), /character_view\(character\)/);
});
