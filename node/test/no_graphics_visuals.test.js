"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repository = path.resolve(__dirname, "../..");
const fakePixiPath = path.join(repository, "js/pixi/fake/pixi.min.js");
const gamePath = path.join(repository, "js/game.js");

test("fake PIXI Graphics is non-blocking and warns only once", () => {
	let alerts = 0;
	let warnings = 0;
	const context = {
		alert() {
			alerts += 1;
		},
		console: {
			warn() {
				warnings += 1;
			},
		},
	};
	vm.createContext(context);
	const source = fs.readFileSync(fakePixiPath, "utf8");
	vm.runInContext(source, context, { filename: fakePixiPath });

	const first = new context.PIXI.Graphics();
	const second = new context.PIXI.Graphics();
	assert.equal(alerts, 0);
	assert.equal(warnings, 1);
	assert.equal(first.beginFill().drawRect().endFill(), first);
	assert.equal(second.lineStyle().moveTo().lineTo(), second);
});

test("socket-driven visual entry points guard no-graphics mode before drawing", () => {
	const source = fs.readFileSync(gamePath, "utf8");
	const required = ["cosmetic_emote_targeted_start", "play_cosmetic_emote"];
	const optional = ["citizen_draw_route_marks", "citizen_draw_repair", "citizen_draw_lamp"];
	const guarded = required.concat(optional.filter((name) => source.includes("function " + name + "(")));
	for (const name of guarded) {
		const declaration = "function " + name + "(";
		const start = source.indexOf(declaration);
		assert.notEqual(start, -1, name + " is missing");
		const body = source.indexOf("{", start + declaration.length);
		assert.match(
			source.slice(body + 1, body + 80),
			/^\s*if \(no_graphics\) return;/,
			name + " must guard before doing visual work",
		);
	}
});
