"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

test("browser code has a single ability action vocabulary", () => {
	const code = source();
	assert.doesNotMatch(code, /use_skill|next_skill|skill_timeout|socket\.emit\("skill"|socket\.on\("skill"/);
	assert.match(code, /function use_ability\(/);
	assert.match(code, /function ability_timeout\(/);
	assert.match(code, /socket\.emit\("ability"/);
	assert.match(code, /socket\.on\("ability_timeout"/);
});

test("browser character and appearance surfaces use skill progression", () => {
	const code = source();
	assert.doesNotMatch(code, /G\.classes|G\.levels|\.ctype/);
	assert.match(code, /character\.skills/);
	assert.match(code, /character\.total_level/);
	assert.match(code, /G\.character\.appearances/);
	assert.match(fs.readFileSync(path.join(root, "htmls/contents/selection.html"), "utf8"), /domain\.character\.appearances/);
	assert.doesNotMatch(fs.readFileSync(path.join(root, "htmls/contents/selection.html"), "utf8"), /char:/);
});
