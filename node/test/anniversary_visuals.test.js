"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const game = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const helpers = game.slice(game.indexOf("var cosmetic_emote_durations ="), game.indexOf("function update_sprite("));
const design = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "design/projectiles.js"), "utf8"), design);
vm.runInContext(fs.readFileSync(path.join(root, "design/animations.js"), "utf8"), design);
const animations = design.animations;
const projectiles = design.projectiles;

function harness() {
	let now = 1000;
	class Clock extends Date {
		constructor(...args) {
			super(...(args.length ? args : [now]));
		}
		static now() {
			return now;
		}
	}
	const players = new Map();
	const context = {
		no_graphics: false,
		no_html: false,
		sound_sfx: true,
		sfx_volume: 100,
		window: {},
		console,
		Date: Clock,
		Math,
		isFinite,
		min: Math.min,
		max: Math.max,
		floor: Math.floor,
		ceil: Math.ceil,
		round: Math.round,
		in_arr: (value, values) => values.includes(value),
		get_player: (name) => players.get(name),
		get_height: (player) => player.height,
		mssince: (date) => now - date.getTime(),
		G: { animations },
		text_layer: "text",
		new_sprite(skin, stype) {
			return {
				skin,
				stype,
				frames: animations[skin].frames,
				anchor: {
					set(x, y) {
						this.x = x;
						this.y = y;
					},
				},
			};
		},
		set_texture(visual, frame) {
			visual.frame = frame;
		},
		destroy_sprite(visual) {
			visual.destroyed = true;
			if (visual.parent) visual.parent.children = visual.parent.children.filter((child) => child != visual);
			visual.parent = null;
		},
	};
	vm.createContext(context);
	vm.runInContext(helpers, context, { filename: "cosmetic-emote-helpers.js" });
	function player(name, x = 0) {
		const entity = {
			name,
			real_x: x,
			real_y: 50,
			height: 30,
			parent: {},
			cxc: {},
			children: [],
			addChild(child) {
				child.parent = this;
				this.children.push(child);
			},
		};
		players.set(name, entity);
		return entity;
	}
	return { context, player, players, advance: (ms) => (now += ms) };
}

test("anniversary emotes return before fake PIXI, sprites, audio or entity access in headless mode", () => {
	const context = { no_graphics: true, console: { warn() {} } };
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, "js/pixi/fake/pixi.min.js"), "utf8"), context);
	context.PIXI = new Proxy(context.PIXI, {
		get() {
			throw Error("PIXI touched in headless mode");
		},
	});
	context.new_sprite = () => {
		throw Error("sprite touched in headless mode");
	};
	context.cosmetic_emote_audio = () => {
		throw Error("audio touched in headless mode");
	};
	vm.runInContext(helpers, context);
	const player = new Proxy(
		{},
		{
			get() {
				throw Error("entity touched before guard");
			},
		},
	);
	for (const name of ["makeawish", "ikissyou"]) {
		context.play_cosmetic_emote(player, name, player, {});
		context.cosmetic_emote_sheet_start(player, name, player);
		context.play_cosmetic_emote_sound(name, 1);
	}
	context.cosmetic_emote_sheet_logic(player, 100);
	context.cosmetic_emote_logic(player);
	context.clear_cosmetic_emote(player);
});

test("the emote socket logs kisses like Poke for nearby players and the recipient, including headless clients", () => {
	for (const noGraphics of [false, true]) {
		for (const viewer of ["Visitor", "Guest", "Observer"]) {
			const { context, player, players } = harness();
			player("Visitor");
			player("Guest", 50);
			context.character = players.get(viewer) || player(viewer);
			context.no_graphics = noGraphics;
			if (noGraphics) {
				vm.runInContext(fs.readFileSync(path.join(root, "js/pixi/fake/pixi.min.js"), "utf8"), context);
				context.PIXI = new Proxy(context.PIXI, {
					get() {
						throw Error("PIXI touched in headless mode");
					},
				});
			}
			context.G.skills = { ikissyou: { emote: "ikissyou" }, makeawish: { emote: "makeawish" } };
			const chats = [],
				logs = [],
				draws = [];
			let receive;
			context.socket = {
				on: (name, callback) => {
					assert.equal(name, "emote");
					receive = callback;
				},
			};
			context.draw_trigger = (callback) => draws.push(callback);
			context.add_chat = (...args) => chats.push(args);
			context.add_log = (...args) => logs.push(args);
			context.citizen_echo_emote = () => {};
			const start = game.indexOf('socket.on("emote",');
			vm.runInContext(game.slice(start, game.indexOf('socket.on("citizen",', start)), context);
			const kiss = { name: "ikissyou", player: "Visitor", target: "Guest" };
			receive(kiss);
			assert.equal(chats.length, 0, "use the existing queued event path");
			draws.shift()();
			assert.deepEqual(chats, [["", "Visitor kissed Guest", "gray"]]);
			assert.deepEqual(logs, viewer === "Guest" ? [["Visitor kissed you", "gray"]] : []);
			for (const data of [
				{ ...kiss, name: "makeawish" },
				{ ...kiss, player: "Missing" },
				{ ...kiss, target: "Missing" },
			]) {
				receive(data);
				draws.shift()();
			}
			assert.equal(chats.length, 1, "other emotes and absent players do not produce kiss logs");
			assert.equal(logs.length, viewer === "Guest" ? 1 : 0);
		}
	}
});

test("Make a Wish preserves its native sheet and expires at 2800 ms", () => {
	const { context, player, advance } = harness();
	const caster = player("wisher");
	assert.equal(context.cosmetic_emote_sheet_start(caster, "makeawish"), true);
	const visual = caster.cosmetic_emote_visual;
	assert.equal(visual.skin, "makeawish_overlay");
	assert.equal(visual.frame, 0);
	assert.equal(visual.x, 0);
	assert.equal(visual.y, -40);
	assert.equal(visual.width, undefined, "do not stretch the native sprite");
	advance(900);
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.frame, 1);
	advance(900);
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.frame, 2);
	advance(999);
	context.cosmetic_emote_logic(caster);
	assert.equal(caster.children.length, 1);
	advance(1);
	context.cosmetic_emote_logic(caster);
	assert.equal(caster.children.length, 0);
	assert.equal(caster.cosmetic_emote, undefined);
	assert.equal(visual.destroyed, true);
});

test("a kiss follows the other player's head without taking over their emote", () => {
	const { context, player, advance } = harness();
	const caster = player("visitor"),
		target = player("guest", 100);
	const original = { name: "joy" },
		originalVisual = { name: "existing" };
	target.cosmetic_emote = original;
	target.cosmetic_emote_visual = originalVisual;
	assert.equal(context.cosmetic_emote_sheet_start(caster, "ikissyou", target), true);
	const visual = caster.cosmetic_emote_visual;
	assert.equal(visual.skin, "ikissyou_fx");
	assert.equal(visual.x, 5);
	assert.equal(visual.y, -22);
	advance(300);
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.frame, 2);
	assert.equal(visual.x, 51);
	assert.equal(visual.y, -25);
	advance(300);
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.frame, 5);
	assert.equal(visual.x, 96);
	assert.equal(visual.y, -22);
	target.real_x = 120;
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.x, 116);
	assert.equal(target.cosmetic_emote, original);
	assert.equal(target.cosmetic_emote_visual, originalVisual);
	advance(600);
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.destroyed, true);
	assert.equal(target.cosmetic_kiss_casters, undefined);
	assert.equal(target.cosmetic_emote, original);
});

test("crowds show at most four kisses per target and release capacity after cleanup", () => {
	const { context, player } = harness(),
		target = player("guest", 100);
	const casters = Array.from({ length: 6 }, (_, i) => player("visitor" + i, i));
	casters.forEach((caster) => context.cosmetic_emote_sheet_start(caster, "ikissyou", target));
	assert.equal(target.cosmetic_kiss_casters.length, 4);
	assert.equal(casters.filter((caster) => caster.cosmetic_emote_visual).length, 4);
	const previous = casters[0].cosmetic_emote_visual;
	assert.equal(context.cosmetic_emote_sheet_start(casters[0], "ikissyou", target), true);
	assert.equal(previous.destroyed, true);
	assert.equal(target.cosmetic_kiss_casters.length, 4);
	context.clear_cosmetic_emote(casters[1]);
	assert.equal(context.cosmetic_emote_sheet_start(casters[4], "ikissyou", target), true);
	assert.equal(target.cosmetic_kiss_casters.length, 4);
});

test("missing, dead or disconnected targets are harmless and do not leave kiss visuals", () => {
	const { context, player, players } = harness(),
		caster = player("visitor"),
		target = player("guest", 100);
	assert.equal(context.cosmetic_emote_sheet_start(caster, "ikissyou", caster), undefined);
	assert.equal(context.cosmetic_emote_sheet_start(caster, "ikissyou"), undefined);
	target.rip = true;
	assert.equal(context.cosmetic_emote_sheet_start(caster, "ikissyou", target), undefined);
	target.rip = false;
	context.cosmetic_emote_sheet_start(caster, "ikissyou", target);
	const visual = caster.cosmetic_emote_visual;
	players.delete("guest");
	context.cosmetic_emote_logic(caster);
	assert.equal(visual.destroyed, true);
	assert.equal(caster.cosmetic_emote, undefined);
	assert.equal(target.cosmetic_kiss_casters, undefined);
});

test("kiss playback sounds once per visible kiss and respects silent and crowd-suppressed emotes", () => {
	const { context, player } = harness(),
		target = player("guest", 100);
	const sounds = [];
	context.play_cosmetic_emote_sound = (...args) => sounds.push(args);
	const caster = player("visitor");
	context.play_cosmetic_emote(caster, "ikissyou", target);
	assert.deepEqual(sounds, [["ikissyou", 1]]);
	context.clear_cosmetic_emote(caster);
	context.play_cosmetic_emote(caster, "ikissyou", target, { silent: true });
	assert.equal(caster.cosmetic_emote.name, "ikissyou");
	assert.equal(sounds.length, 1);
	context.clear_cosmetic_emote(caster);
	context.play_cosmetic_emote(caster, "ikissyou");
	context.play_cosmetic_emote(caster, "ikissyou", caster);
	assert.equal(sounds.length, 1);
	for (let i = 0; i < 5; i++) context.play_cosmetic_emote(player("crowd" + i), "ikissyou", target);
	assert.equal(target.cosmetic_kiss_casters.length, 4);
	assert.equal(sounds.length, 5, "suppressed kisses must not pile up sounds");
	context.play_cosmetic_emote(caster, "makeawish");
	assert.deepEqual(sounds[5], ["makeawish", 1]);
});

for (const name of ["makeawish", "ikissyou"]) {
	test(`${name} sound respects SFX off, zero volume, headless mode and configured gain`, () => {
		const { context } = harness();
		let audioCalls = 0;
		const tones = [],
			noises = [],
			outputs = [],
			timers = [];
		context.cosmetic_emote_audio = () => {
			audioCalls++;
			return {
				currentTime: 0,
				destination: {},
				createGain() {
					const output = {
						gain: {},
						connect() {},
						disconnect() {
							this.disconnected = true;
						},
					};
					outputs.push(output);
					return output;
				},
			};
		};
		context.cosmetic_emote_tone = (...args) => tones.push(args);
		context.cosmetic_emote_noise = (...args) => noises.push(args);
		context.setTimeout = (callback, ms) => timers.push({ callback, ms });
		context.sfx_volume = 0;
		context.play_cosmetic_emote_sound(name, 1);
		context.sfx_volume = 100;
		context.sound_sfx = false;
		context.play_cosmetic_emote_sound(name, 1);
		context.sound_sfx = true;
		context.no_graphics = true;
		context.play_cosmetic_emote_sound(name, 1);
		context.no_graphics = false;
		context.no_html = true;
		context.play_cosmetic_emote_sound(name, 1);
		assert.equal(audioCalls, 0);
		assert.equal(tones.length, 0);
		assert.equal(noises.length, 0);
		context.no_html = false;
		context.sfx_volume = 20;
		context.play_cosmetic_emote_sound(name, 1);
		assert.equal(audioCalls, 1);
		assert.equal(outputs[0].gain.value, 0.11);
		if (name == "makeawish") {
			assert.equal(tones.length, 4);
			assert.equal(noises.length, 0);
			assert.equal(tones[3][2], 0.552);
			assert.equal(tones[3][3], 0.42);
			assert.equal(timers[0].ms, 3300);
		} else {
			assert.equal(tones.length, 2);
			assert.equal(noises.length, 2);
			assert.equal(tones[0][2], 0.372);
			assert.equal(noises[0][2], tones[0][2]);
			assert.equal(tones[1][2], 0.492, "lip smack follows the 480 ms arrival plus audio scheduling lead");
			assert.equal(noises[1][2], tones[1][2]);
			assert.ok(tones[1][4] > tones[1][5], "short downward pop, not a melody");
			for (const sound of [...tones, ...noises]) assert.ok(sound[3] <= 0.1);
			assert.equal(timers[0].ms, 1700);
		}
		timers[0].callback();
		assert.equal(outputs[0].disconnected, true);
	});
}

test("Reunion Bow and both emotes resolve complete native animation sheets", () => {
	assert.deepEqual(JSON.parse(JSON.stringify(projectiles.reunionarrow)), {
		animation: "reunionarrow",
		speed: 500,
		hit_animation: "reunionarrow_hit",
	});
	assert.equal(animations.reunionarrow.directional, true);
	assert.equal(animations.reunionarrow.speed, 500);
	for (const [name, width, height, frames] of [
		["reunionarrow", 60, 20, 3],
		["reunionarrow_hit", 112, 16, 7],
		["makeawish_overlay", 60, 20, 3],
		["ikissyou_fx", 160, 16, 10],
	]) {
		const definition = animations[name];
		assert.equal(definition.frames, frames);
		assert.match(definition.file, /\?v=1$/);
		const bytes = fs.readFileSync(path.join(root, definition.file.split("?")[0]));
		assert.equal(bytes.toString("ascii", 1, 4), "PNG");
		assert.equal(bytes.readUInt32BE(16), width);
		assert.equal(bytes.readUInt32BE(20), height);
		assert.equal(width / frames, height);
	}
});
