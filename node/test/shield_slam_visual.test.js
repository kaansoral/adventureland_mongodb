"use strict";
const test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("node:fs"),
	path = require("node:path"),
	vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const G = require("./helpers/design");
const game = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const helpers = game.slice(
	game.indexOf("function item_upgrade_glow("),
	game.indexOf("function paladin_shield_hit_feedback("),
);

test("shield thrust and upgrade glow never touch graphics in headless mode", () => {
	const context = { no_graphics: true, console: { warn() {} } };
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, "js/pixi/fake/pixi.min.js"), "utf8"), context);
	vm.runInContext(helpers, context);
	context.animate_shield_slam({}, {}, { name: "shield", level: 12 });
	context.update_shield_slam_item({});
	context.item_upgrade_glow({ name: "shield", level: 12 });
});

function harness() {
	let now = 1000;
	const context = {
		no_graphics: false,
		G,
		Math,
		Date: { now: () => now },
		get_x: (s) => s.x,
		get_y: (s) => s.y,
		get_height: (s) => s.height,
		calculate_item_grade: G.calculate_item_grade,
		hx: (color) => color,
		PIXI: {
			filters: {
				GlowFilter: function (distance, strength, inner, color) {
					Object.assign(this, { distance, strength, inner, color });
				},
			},
		},
		new_sprite(name) {
			return { name, anchor: { set() {} } };
		},
		stop_animation(parent, name) {
			parent.children = parent.children.filter((c) => c !== parent.animations[name]);
			delete parent.animations[name];
		},
	};
	vm.createContext(context);
	vm.runInContext(helpers, context);
	const player = {
		x: 0,
		y: 0,
		height: 30,
		animations: {},
		children: [],
		addChild(s) {
			s.parent = this;
			this.children.push(s);
		},
	};
	return { context, player, advance: (ms) => (now += ms) };
}

test("native shield bottom leads in all directions; motion fades and cleans up in 150 ms", () => {
	for (const [x, y] of [
		[100, 0],
		[-100, 0],
		[0, 100],
		[0, -100],
		[80, 80],
	]) {
		const { context, player, advance } = harness();
		context.animate_shield_slam(player, { x, y, height: 30 }, { name: "dawnwardaegis", level: 8 });
		const sprite = player.animations.shield_slam_item;
		assert.equal(sprite.name, "dawnwardaegis");
		assert.ok(Math.abs(-Math.sin(sprite.rotation) - x / Math.hypot(x, y)) < 1e-9, "bottom-edge X points toward target");
		assert.ok(Math.abs(Math.cos(sprite.rotation) - y / Math.hypot(x, y)) < 1e-9, "bottom-edge Y points toward target");
		assert.equal(sprite.filters[0].color, G.items.dawnwardaegis.cx.accent);
		advance(75);
		context.update_shield_slam_item(sprite);
		assert.equal(sprite.x, Math.round((28 * x) / Math.hypot(x, y)));
		assert.equal(sprite.y, -15 + Math.round((28 * y) / Math.hypot(x, y)));
		advance(37.5);
		context.update_shield_slam_item(sprite);
		assert.equal(sprite.alpha, 0.5);
		advance(37.5);
		context.update_shield_slam_item(sprite);
		assert.equal(player.children.length, 0);
		assert.equal(player.animations.shield_slam_item, undefined);
	}
});

test("repeated slams replace the transient shield; death and invalid offhands are safe", () => {
	const { context, player } = harness(),
		target = { x: 60, y: 0, height: 30 };
	context.animate_shield_slam(player, target, { name: "shield", level: 0 });
	assert.equal(player.children[0].filters, undefined);
	context.animate_shield_slam(player, target, { name: "tigershield", level: 9 });
	assert.equal(player.children.length, 1);
	context.animate_shield_slam(player, target, { name: "wbook0", level: 12 });
	assert.equal(player.children.length, 1);
	player.rip = true;
	context.update_shield_slam_item(player.children[0]);
	assert.equal(player.children.length, 0);
});

test("all shields have deliberate accents; weapons retain their existing glow curve", () => {
	const { context } = harness();
	for (const [name, item] of Object.entries(G.items)) {
		if (item.type === "shield") assert.match(item.cx.accent, /^#[0-9A-F]{6}$/, name);
		if (!["shield", "weapon"].includes(item.type)) continue;
		const grade = G.calculate_item_grade(item);
		for (const level of [0, 7, 8, 9, 10, 12, 13]) {
			const glow = context.item_upgrade_glow({ name, level });
			if (level + grade < 10) assert.equal(glow, undefined, name);
			else {
				assert.equal(glow.distance, 8 + (Math.min(level, 13) + [1, 1.5, 2, 2, 2][grade] - 10) * 3, name);
				assert.equal(glow.strength, 4 + (Math.min(level, 13) + [1.5, 1.75, 2, 2, 2][grade] - 10) * 2, name);
			}
		}
	}
	assert.match(game, /var glow_filter = item_upgrade_glow\(item\);/);
});
