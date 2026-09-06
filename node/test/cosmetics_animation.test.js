"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadFunction(context, file, name) {
	const source = read(file),
		start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	vm.runInContext(source.slice(start, source.indexOf("\nfunction ", start + 1)), context);
}

function runtime() {
	let now = 0;
	const context = vm.createContext({
		console,
		positions: {},
		in_arr: (value, array) => array.includes(value),
		round: Math.round,
	});
	for (const file of ["sprites", "cosmetics", "precomputed_images"])
		vm.runInContext(read("design/" + file + ".js"), context);
	context.G = {
		sprites: context.sprites,
		cosmetics: context.cosmetics,
		images: context.precomputed.images,
		dimensions: {},
		items: {},
	};
	// Exercise the actual loader grid and HTML grid against the PNG headers.
	const sets = ["aniv2", "hats4", "gcandle", "bathat", "halo", "burningeyes1", "makeup1", "mbody4"];
	context.G.sprites = Object.fromEntries(sets.map((id) => [id, context.sprites[id]]));
	Object.assign(context, {
		T: { initialized: true },
		SS: {},
		SSU: {},
		IID: null,
		FC: {},
		FM: {},
		XYWH: {},
		C: {},
		textures: {},
		no_graphics: false,
	});
	context.window = context;
	for (const definition of Object.values(context.G.sprites)) {
		const file = definition.file.split("?")[0];
		const png = fs.readFileSync(path.join(root, file));
		const size = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
		assert.equal(size.width, context.G.images[file].width, file + " cached width");
		assert.equal(size.height, context.G.images[file].height, file + " cached height");
		context.C[definition.file] = size;
	}
	const game = read("js/game.js");
	const start = game.indexOf("\t\tfor (name in G.sprites)", game.indexOf("function load_game("));
	vm.runInContext(game.slice(start, game.indexOf("\n\t\tG.positions.textures", start)), context);
	loadFunction(context, "js/html.js", "precompute_image_positions");
	context.precompute_image_positions();
	class Sprite {
		constructor(texture) {
			this.texture = texture;
			this.children = [];
			this.x = this.y = 0;
			this.anchor = { set() {} };
		}
		addChild(child) {
			this.children.push(child);
		}
	}
	context.PIXI = {
		Sprite,
		Rectangle: class {
			constructor(x, y, width, height) {
				Object.assign(this, { x, y, width, height });
			}
		},
		Texture: class {
			constructor(base, frame) {
				Object.assign(this, { base, frame, width: frame.width, height: frame.height });
			}
		},
	};
	Object.assign(context, {
		offset_walking: false,
		head_x: 0,
		head_y: 0,
		new_attacks: false,
		ZEPS: 0.001,
		CINF: 1e9,
		last_cx_d: [0, 0],
		Date: { now: () => now },
	});
	for (const name of ["generate_textures", "set_texture"]) loadFunction(context, "js/functions.js", name);
	loadFunction(context, "js/game.js", "cosmetics_logic");
	context.new_sprite = (skin, stype) => {
		if (!context.textures[skin]) context.generate_textures(skin, stype);
		const s = new Sprite();
		Object.assign(s, { skin, stype, frames: 4 });
		return s;
	};
	context.destroy_sprite = () => {};
	context.generate_textures("mbody4b", "body");
	const actor = (hat) =>
		Object.assign(new Sprite(context.textures.mbody4b[1][0]), {
			skin: "mbody4b",
			cx: { head: "makeup117", hat },
			i: 1,
			j: 0,
			updates: 0,
		});
	return {
		context,
		actor,
		at: (time) => {
			now = time;
		},
	};
}

test("imported hats keep native cells and six-frame grids agree in the client and HTML", () => {
	const { context: c } = runtime();
	assert.equal(c.T.aniv0, "hat");
	assert.equal(c.T.aniv1, "hat");
	assert.equal(c.T.aniv2, "a_hat");
	assert.equal(c.T.aniv3, "hat");
	assert.deepEqual(Array.from(c.XYWH.aniv2), [0, 0, 27, 38, 6]);
	assert.equal(c.IID.aniv2[4], 27);
	assert.equal(c.IID.aniv2[5], 38);
	assert.equal(c.IID.aniv2[6], 6);
	for (const [id, column] of [
		["aniv0", 11],
		["aniv1", 12],
		["aniv3", 13],
	])
		assert.equal(c.XYWH[id][0], column * 27);
	c.generate_textures("aniv2", "a_hat");
	for (let direction = 0; direction < 4; direction++) {
		assert.equal(c.textures.aniv2[direction].length, 6);
		for (let frame = 0; frame < 6; frame++) {
			const crop = c.textures.aniv2[direction][frame].frame;
			assert.deepEqual([crop.x, crop.y, crop.width, crop.height], [frame * 27, direction * 38, 27, 38]);
		}
	}
});

test("candle and bubble hats animate while idle, moving and stopped in every direction", () => {
	const { context: c, actor, at } = runtime();
	for (const [hat, frames, interval] of [
		["gcandle", 3, 180],
		["aniv2", 6, 160],
	]) {
		const s = actor(hat);
		for (let direction = 0; direction < 4; direction++) {
			s.j = direction;
			for (let tick = 0; tick <= frames * 2; tick++) {
				at(tick * interval);
				s.i = tick < 3 || tick > 6 ? 1 : [0, 1, 2, 1][tick % 4];
				c.cosmetics_logic(s);
				assert.equal(s.cxc[hat].texture, c.textures[hat][direction][tick % frames]);
				assert.equal(s.cxc[hat].y, -6 + (s.i === 1 ? 0 : 1), "head bob remains tied to the body, not the effect frame");
			}
		}
	}
});

test("unconfigured animated hats and makeup retain their existing frame selection", () => {
	const { context: c, actor, at } = runtime();
	for (const hat of ["bathat", "halo"]) {
		const s = actor(hat);
		for (let direction = 0; direction < 4; direction++)
			for (let frame = 0; frame < 3; frame++) {
				s.i = frame;
				s.j = direction;
				at(100000);
				c.cosmetics_logic(s);
				assert.equal(s.cxc[hat].texture, c.textures[hat][direction][frame]);
			}
	}
	c.generate_textures("breyes", "a_makeup");
	const s = { skin: "breyes", stype: "a_makeup", frames: 4 };
	c.set_texture(s, 2, 8);
	assert.equal(s.texture, c.textures.breyes[2][2]);
});

test("animated cosmetics remain harmless with fake PIXI and no graphics", () => {
	const { context: c, actor } = runtime();
	const s = actor("aniv2");
	vm.runInContext(read("js/pixi/fake/pixi.min.js"), c);
	c.no_graphics = true;
	assert.doesNotThrow(() => c.cosmetics_logic(s));
	assert.equal(s.children.length, 0);
});
