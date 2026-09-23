"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function runtime() {
	const c = vm.createContext({
		console,
		positions: {},
		round: Math.round,
		in_arr: (v, a) => a.includes(v),
		is_string: (v) => typeof v === "string",
		clone: (v) => JSON.parse(JSON.stringify(v)),
		prune_cx() {},
	});
	function load(file, name) {
		const text = read(file),
			start = text.indexOf("function " + name + "(");
		assert(start >= 0, name);
		vm.runInContext(text.slice(start, text.indexOf("\nfunction ", start + 1)), c);
	}
	for (const file of ["sprites", "cosmetics", "precomputed_images", "npcs"])
		vm.runInContext(read("design/" + file + ".js"), c);
	c.G = {
		sprites: c.sprites,
		cosmetics: c.cosmetics,
		images: c.precomputed.images,
		dimensions: {},
		items: {},
		monsters: {},
		classes: {},
		maps: {},
		npcs: c.npcs,
	};
	Object.assign(c, {
		window: c,
		T: {},
		SS: {},
		SSU: {},
		IID: null,
		FC: {},
		FM: {},
		XYWH: {},
		C: {},
		textures: {},
		no_graphics: false,
		offset_walking: false,
		head_x: 0,
		head_y: 0,
		new_attacks: false,
		ZEPS: 0.001,
		CINF: 1e9,
		last_cx_d: [0, 0],
	});
	load("js/old_common_functions.js", "process_game_data");
	load("js/html.js", "precompute_image_positions");
	c.precompute_image_positions();
	for (const [id, d] of Object.entries(c.IID)) {
		c.XYWH[id] = [d[2], d[3], d[4], d[5], d[6]];
		c.FC[id] = d[7];
		c.C[d[7]] = {};
	}
	for (const definition of Object.values(c.G.sprites))
		definition.matrix.forEach((row, i) =>
			row.forEach((id, j) => {
				if (id && !definition.skip) c.FM[id] = [i, j];
			}),
		);
	class Sprite {
		constructor(texture) {
			this.texture = texture;
			this.x = this.y = 0;
			this.children = [];
			this.anchor = { set() {} };
		}
		addChild(child) {
			this.children.push(child);
		}
	}
	c.PIXI = {
		Sprite,
		Rectangle: class {
			constructor(x, y, width, height) {
				Object.assign(this, { x, y, width, height });
			}
		},
		Texture: class {
			constructor(base, frame) {
				Object.assign(this, { frame, width: frame.width, height: frame.height });
			}
		},
	};
	for (const name of ["generate_textures", "set_texture"]) load("js/functions.js", name);
	load("js/game.js", "cosmetics_logic");
	load("js/html.js", "sprite");
	load("js/html.js", "sprite_image");
	c.new_sprite = (skin, stype) => {
		if (!c.textures[skin]) c.generate_textures(skin, stype);
		return Object.assign(new Sprite(), { skin, stype, frames: 4 });
	};
	c.destroy_sprite = () => {};
	const actor = (skin, cx, i, j) => {
		if (!c.textures[skin]) c.generate_textures(skin, c.T[skin]);
		const s = Object.assign(new Sprite(c.textures[skin][i][j]), { skin, cx: { ...cx }, i, j, updates: 0 });
		c.cosmetics_logic(s);
		return s;
	};
	return { c, actor, load };
}

test("HTML sprite metadata preserves every default and explicit game sprite type", () => {
	const { c } = runtime();
	const before = { ...c.T };
	c.process_game_data();
	for (const [id, type] of Object.entries(c.T)) {
		assert.equal(before[id], type, id + " keeps its game type");
		assert.equal(c.IID[id][8], type, id + " metadata type");
	}
	assert.equal(c.T.potiongirl, "full");
	assert.equal(c.T.fancypots, "animation");
});

test("NPC portraits keep the right sheet crop before and after HTML previews initialize", () => {
	const { c, load } = runtime();
	load("js/html.js", "render_interaction");
	c.process_game_data();
	const portraits = Object.values(c.G.npcs)
		.map((npc) => npc.side_interaction)
		.filter((face) => face && face.auto);
	const before = portraits.map((face) => c.render_interaction(face, "return_html"));
	c.IID = null;
	c.precompute_image_positions();
	portraits.forEach((face, i) => assert.equal(c.render_interaction(face, "return_html"), before[i], face.skin));
	const potion = c.render_interaction(c.G.npcs.fancypots.side_interaction, "return_html");
	assert.match(potion, /margin-left: -416px; margin-top: -576px; width: 1248px; height: 1152px;/);
	assert.match(potion, /src='\/images\/tiles\/characters\/custom2\.png\?v=4'/);
	// The real animated shopkeeper must still use the animation portrait layout.
	assert.match(
		c.render_interaction({ auto: true, skin: "fancypots", message: "" }, "return_html"),
		/width: 2256px; height: 1600px;/,
	);
});

test("hooded upper costumes hide hair in both character rendering and HTML previews", () => {
	const { c, actor } = runtime();
	for (const [skin, upper, compatible] of [
		["mabw", "marmor12c", true],
		["mabw", "marmor12d", true],
		["mabw", "marmor12a", true],
		["sarmor1a", "marmor12c", false],
	])
		for (let j = 0; j < 4; j++) {
			const s = actor(skin, { head: "makeup117", hair: "hairdo100", upper }, 1, j);
			const hairVisible = !compatible || !(c.G.cosmetics.prop[upper] || []).includes("no_hair");
			assert.equal(!!s.cxc[upper], compatible, upper + " costume compatibility");
			assert.equal(!!s.cxc.hairdo100, hairVisible, upper + " game hair");
			const layers = [];
			c.sprite_image = (id) => {
				layers.push(id);
				return "";
			};
			c.sprite(s.skin, { cx: { ...s.cx }, j, scale: 1 });
			assert.equal(layers.includes(upper), compatible);
			assert.equal(layers.includes("hairdo100"), hairVisible, upper + " preview hair");
		}
});

test("character-sheet NPC portraits use the sprite renderer instead of animation coordinates", () => {
	const { c, load } = runtime();
	load("js/html.js", "render_interaction");
	const face = Object.values(c.G.npcs)
		.map((npc) => npc.side_interaction)
		.find((face) => face && c.T[face.skin] === "character");
	assert(face, "a shipped character-sheet portrait exists");
	assert.equal(face.skin, "xxschar2h");
	const html = c.render_interaction(face, "return_html");
	assert.match(html, /width: 1296px;/, "the 324px character sheet stays at integer 4x scale");
	assert.doesNotMatch(html, /width: 2256px;/, "not the unrelated animation layout");
	assert.match(html, /src='\/images\/all_characters\/xxschar2\.png'/);
});

test("cosmetic rendering stays harmless without graphics", () => {
	const { c } = runtime();
	c.no_graphics = true;
	Object.defineProperty(c, "PIXI", {
		get() {
			assert.fail("Headless PIXI access");
		},
	});
	c.cosmetics_logic({ skin: "mabw", cx: { head: "makeup117", hair: "hairdo100", upper: "marmor12c" } });
});

test("face layers stay on the eyes across body sizes, directions and walking frames", () => {
	const { c, actor } = runtime();
	assert.equal(c.cosmetics.default_face_position, 7);
	const slots = { face: "face", makeup: "makeup", a_makeup: "makeup", beard: "chin" };
	const ids = Object.keys(c.T).filter((id) => slots[c.T[id]]);
	// Separate offsets must not accidentally share the beard setting.
	c.cosmetics.default_makeup_position = 1;
	c.cosmetics.default_beard_position = 2;
	for (const skin of ["mabw", "mbody4b", "sarmor1a", "larmor1a"])
		for (const id of ids)
			for (let j = 0; j < 4; j++)
				for (let i = 0; i < 3; i++) {
					const s = actor(skin, { head: "makeup117", [slots[c.T[id]]]: id }, i, j);
					const offset = c.T[id] === "face" ? 7 : c.T[id] === "beard" ? 2 : 1;
					assert.equal(s.cxc[id].y, s.cxc.makeup117.y - offset, id);
					assert.equal(s.cxc[id].x, s.cxc.makeup117.x, id);
					if (i !== 1) continue;
					const html = [];
					c.sprite_image = (name, args) => {
						html.push({ id: name, ...args });
						return "";
					};
					c.sprite(skin, { cx: { ...s.cx }, j, scale: 1 });
					const layer = html.find((layer) => layer.id === id);
					assert(layer, id + " keeps its authored rear frame");
					assert.equal(-layer.p, s.cxc[id].y, id + " HTML height");
					assert.equal(layer.x || 0, s.cxc[id].x, id + " HTML horizontal placement");
				}
});

test("backpack previews use the approved game placement without changing walking sway", () => {
	const { c, actor, load } = runtime();
	for (const back of Object.keys(c.cosmetics.back))
		for (let j = 0; j < 4; j++)
			for (let i = 0; i < 3; i++) {
				const s = actor("mabw", { head: "makeup117", back }, i, j);
				assert.equal(s.cxc[back].x, i - 1 + (j === 1 ? 1 : j === 2 ? -1 : 0));
				assert.equal(s.cxc[back].y, i === 1 ? 0 : 1);
				if (i !== 1) continue;
				const html = [];
				c.sprite_image = (id, args) => {
					html.push({ id, ...args });
					return "";
				};
				c.sprite("mabw", { cx: { ...s.cx }, j, scale: 1 });
				assert.equal(html.find((layer) => layer.id === back).x, s.cxc[back].x);
			}
	load("js/html.js", "sprite_image");
	const plain = c.sprite_image("backpacks00", { cwidth: 94, scale: 2 });
	const shifted = c.sprite_image("backpacks00", { cwidth: 94, scale: 2, x: 1 });
	assert.equal(Number(shifted.match(/left: ([\d.-]+)px/)[1]) - Number(plain.match(/left: ([\d.-]+)px/)[1]), 2);
	assert.equal(
		shifted.match(/margin-left: ([\d.-]+)px/)[1],
		plain.match(/margin-left: ([\d.-]+)px/)[1],
		"Move the layer, not its source crop",
	);
});

function menu_runtime() {
	const fixture = runtime(),
		{ c, load } = fixture;
	const design = require("./helpers/design");
	for (const name of ["skills", "drops", "items", "positions", "imagesets"]) c.G[name] = design[name];
	const phrase = (id) => id;
	phrase.html = phrase;
	phrase.definition = (type, id, field, fallback) => fallback;
	phrase.language = "en";
	Object.assign(c, {
		phrase,
		cxtype_to_slot: design.cxtype_to_slot,
		min: Math.min,
		is_array: Array.isArray,
		to_pretty_num: String,
		to_pretty_float: String,
		randomStr: () => "fixture",
		object_sort: (object) => Object.entries(object).sort(),
		viewport_width: () => 960,
		show_modal: (html, args) => {
			c.modal = { html, args };
		},
		render_ui_panel: (selector, html) => {
			c.menu = html;
		},
		character: { owner: "fixture" },
		xtarget: null,
		ctarget: null,
	});
	for (const name of ["cx_sprite", "item_container", "render_drop", "render_exchange_info", "render_cosmetics"])
		load("js/html.js", name);
	return fixture;
}

test("actual head exchange responses display every awarded head instead of an empty confirmation", () => {
	const { c, load } = menu_runtime();
	c.D = c.G;
	c.Math = Object.create(Math);
	c.console = { log() {} };
	load("node/server_functions.js", "exchange");
	c.$ = () => ({
		length: 1,
		html: (html) => {
			c.confirmation = html;
		},
	});
	c.refresh_cosmetic_skills = (acx) => {
		c.acx = acx;
	};
	const source = read("js/game.js"),
		marker = '} else if (response == "cx_new") {';
	const start = source.indexOf(marker) + marker.length;
	const handler = source.slice(start, source.indexOf('} else if (response == "cx_not_found")', start));
	for (let index = 0; index < c.G.drops.cosmo1.length; index++) {
		const replies = [],
			player = { p: { acx: {} }, socket: { emit: (event, data) => replies.push({ event, data }) } };
		c.Math.random = () => (index + 0.5) / c.G.drops.cosmo1.length;
		c.exchange(player, "cosmo1");
		c.data = replies.find((reply) => reply.data.response === "cx_new").data;
		vm.runInContext(handler, c);
		const members = c.G.cosmetics.bundle[c.data.name] || [c.data.name];
		for (const head of members) {
			const preview = c.cx_sprite(head);
			assert.match(preview, /<img /, head + " has a native sprite");
			assert(c.confirmation.includes(preview), head + " appears in its reward confirmation");
		}
		assert.match(c.confirmation, /game.dismiss.ok/);
		assert.equal(c.acx[c.data.name], 1, "the confirmation preserves the granted unlock");
	}
});

test("exchange menus bound the full drop list and let wide bundles wrap", () => {
	const { c } = menu_runtime();
	for (const width of [320, 960]) {
		c.viewport_width = () => width;
		c.render_exchange_info("cosmo1");
		assert.equal(c.modal.args.wwidth, Math.min(460, width - 52));
		assert.equal(c.modal.args.hideinbackground, true);
		assert.match(c.modal.html, /max-height: calc\(100vh \* var\(--browser-zoom-inverse, 1\) - 100px\); overflow: auto/);
		assert.equal((c.modal.html.match(/1 \/ 32<\/div>/g) || []).length, c.G.drops.cosmo1.length);
	}
	const bundle = c.render_drop([1, "cxbundle", "headsoftmuted"], 1);
	assert.match(bundle, /white-space: nowrap; display: flex; flex-wrap: wrap; align-items: center/);
	for (const head of c.G.cosmetics.bundle.headsoftmuted) assert(bundle.includes(c.cx_sprite(head, { mright: 4 })));
	assert.doesNotMatch(c.render_drop([1, "cx", "eyehead0"], 1), /flex-wrap/);
});

test("cosmetics use square native emote tiles without changing skill actions or inventory tiles", () => {
	const { c } = menu_runtime();
	const player = { skin: "mabw", cx: { head: "makeup117" }, aheight: 36, me: true, acx: {} };
	c.render_cosmetics(player);
	assert.doesNotMatch(c.menu, /interface.emotes.emotes/);
	for (const skill of Object.values(c.G.skills)) if (skill.emote) player.acx[skill.emote] = 1;
	c.render_cosmetics(player);
	assert.match(c.menu, /flex-wrap: wrap; gap: 8px; max-width: 200px/);
	assert.match(c.menu, /margin: 0px; border: 2px solid gray; height: 40px; width: 40px; background: #504254/);
	for (const [name, skill] of Object.entries(c.G.skills))
		if (skill.emote) {
			assert(c.menu.includes("data-skname='" + name + "'"), name + " retains its skill identity");
			assert(c.menu.includes("class='loader" + name + "'"), name + " retains its cooldown indicator");
			assert(c.menu.includes("use_skill('" + name + "'"), name + " can be played");
		}
	assert.match(c.menu, /draggable='true'/);
	player.me = false;
	c.render_cosmetics(player);
	assert.doesNotMatch(c.menu, /use_skill\(|draggable='true'/);
	const inventory = c.item_container({ skin: c.G.skills.fart.skin, draggable: false });
	assert.match(inventory, /margin: 2px; border: 2px solid gray; height: 46px; width: 46px; background: black/);
	assert.match(inventory, /padding:3px;/);
});
