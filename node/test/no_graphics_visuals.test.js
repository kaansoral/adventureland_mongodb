"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repository = path.resolve(__dirname, "../..");
const fakePixiPath = path.join(repository, "js/pixi/fake/pixi.min.js");
const gamePath = path.join(repository, "js/game.js");

test("asset loading shares one resource across animation aliases and asset groups", () => {
	const source = fs.readFileSync(gamePath, "utf8");
	const start = source.indexOf("loader = PIXI.loader;");
	const queue = source.slice(start, source.indexOf("\n\tgprocess_game_data();", start));
	const added = [],
		resources = {};
	const context = {
		PIXI: {
			loader: {
				resources,
				on() {},
				add(file) {
					assert(!resources[file], "duplicate resource: " + file);
					resources[file] = { url: file };
					added.push(file);
				},
			},
		},
		on_load_progress() {},
		url_factory: (file) => (file.startsWith("cdn:") ? file : "cdn:" + file),
	};
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(repository, "design/animations.js"), "utf8"), context);
	const shared = context.animations.success.file;
	assert.equal(context.animations.merrit_bonus.file, shared);
	context.G = {
		animations: context.animations,
		tilesets: { shared: { file: shared } },
		sprites: { shared: { file: shared }, skipped: { file: "skip.png", skip: true } },
		imagesets: {
			shared: { file: shared, load: true },
			skipped: { file: "skip.png" },
			unique: { file: "unique.png", load: true },
		},
	};
	vm.runInContext(queue, context);
	assert.equal(added.filter((file) => file === "cdn:" + shared).length, 1);
	assert(added.includes("cdn:unique.png"));
	assert(!added.includes("cdn:skip.png"));
	assert.equal(context.G.animations.success.file, context.G.animations.merrit_bonus.file);
	const count = added.length;
	vm.runInContext(queue, context);
	assert.equal(added.length, count, "already registered resources are reused");
	vm.runInContext(fs.readFileSync(fakePixiPath, "utf8"), context);
	assert.doesNotThrow(() => vm.runInContext(queue, context), "fake loader has no resource registry");
});

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
	const required = [
		"cosmetic_emote_targeted_start",
		"play_cosmetic_emote",
		"paladin_support_animation",
		"paladin_shield_hit_feedback",
		"paladin_shield_reaction",
		"item_upgrade_glow",
		"animate_shield_slam",
		"update_shield_slam_item",
	];
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

test("shield hit reactions are harmless with fake PIXI and expire without removing other filters", () => {
	const source = fs.readFileSync(gamePath, "utf8");
	const context = { no_graphics: true, console: { warn() {} } };
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(fakePixiPath, "utf8"), context);
	vm.runInContext(
		source.slice(source.indexOf("function paladin_shield_hit_feedback("), source.indexOf("function update_filters(")),
		context,
	);
	context.paladin_shield_hit_feedback({ damage: 100, shield_reaction: "aether_shield" }, {});
	context.paladin_shield_reaction({}, "mshield");
	let now = 1000;
	Object.assign(context, { no_graphics: false, Date: { now: () => now }, Math });
	context.PIXI = {
		filters: {
			GlowFilter: function (distance, strength, inner, color) {
				Object.assign(this, { distance, outerStrength: strength, inner, color });
			},
		},
	};
	vm.runInContext(
		source.slice(source.indexOf("function update_filters("), source.indexOf("function stop_filter(")),
		context,
	);
	const stopStart = source.indexOf("function stop_filter(");
	vm.runInContext(source.slice(stopStart, source.indexOf("\nfunction ", stopStart + 1)), context);
	const existing = { name: "equipment" };
	const sprite = { filter_list: [existing], filters: [existing], s: {} };
	context.paladin_shield_reaction(sprite, "mshield");
	const filter = sprite.filter_shield_hit;
	assert.equal(filter.outerStrength, 0.35);
	assert.equal(filter.distance, 2);
	assert.equal(filter.color, 0x75a7df);
	context.paladin_shield_reaction(sprite, "mshield");
	assert.equal(sprite.filter_list.length, 2, "rapid hits reuse the existing reaction");
	now += 60;
	context.update_filters(sprite);
	assert.equal(filter.outerStrength, 0.175);
	now += 61;
	context.update_filters(sprite);
	assert.equal(sprite.filter_shield_hit, undefined);
	assert.deepEqual(sprite.filter_list, [existing]);
	context.paladin_shield_reaction(sprite, "aether_shield");
	assert.equal(sprite.filter_shield_hit.color, 0xab91db);
});
