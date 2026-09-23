"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { localize, load } = require("./helpers/server_vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../js/npc_obstruction_hint.js"), "utf8");

test("page initializes platform globals before the notice reads the real storage helper", () => {
	const read = (file) => fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8");
	const template = read("htmls/index.html");
	const functions = read("js/functions.js");
	const storage = functions.slice(
		functions.indexOf("function storage_get("),
		functions.indexOf("function storage_set("),
	);
	const platform = read("htmls/base_script.html").match(/var is_electron=[^;]+;/)[0];
	for (const electron of [false, true]) {
		const c = vm.createContext({
			window: { localStorage: { getItem: () => "off" } },
			electron_store: { get: () => "off" },
		});
		vm.runInContext(storage, c);
		for (const part of template.matchAll(/include "htmls\/base_script.html"|src="\/js\/npc_obstruction_hint.js/g)) {
			if (part[0].startsWith("include"))
				vm.runInContext(platform.replace(/\{%if domain.electron %\}1\{% endif %\}/, electron ? "1" : ""), c);
			else vm.runInContext(source, c);
		}
		assert.equal(c.npc_obstruction_hints_enabled, false, "saved preference loads on web and Electron");
	}
});

function sprite(x, y, width = 24, height = 36) {
	return {
		x,
		y,
		real_y: y,
		parent: {},
		visible: true,
		worldAlpha: 1,
		texture: { orig: { width, height } },
		anchor: { x: 0.5, y: 1 },
		worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: x, ty: y },
	};
}

function setup(saved) {
	const npc = Object.assign(sprite(300, 300), { npc: "upgrade", proximity: 250, onrclick() {} });
	const merchant = Object.assign(sprite(340, 305), {
		type: "character",
		stand: "stand0",
		standed: sprite(300, 308, 40, 30),
	});
	const context = {
		no_graphics: false,
		no_html: false,
		browser_zoom: 0,
		map_npcs: [],
		map_doors: [],
		proximity_guides: true,
		character: {},
		entities: { npc, merchant },
		distance: (entity) => entity.proximity,
		storage_get: () => saved,
		storage_set: (key, value) => {
			saved = value;
		},
		$: () => ({
			text() {
				return this;
			},
			css() {},
			html() {},
		}),
		G: { npcs: { upgrade: { name: "Upgrade", role: "newupgrade" }, compound: { name: "Compound", role: "compound" } } },
		document: {
			createElement: () => ({
				style: {},
				offsetWidth: 200,
				offsetHeight: 68,
				listeners: {},
				addEventListener(type, fn) {
					this.listeners[type] = fn;
				},
			}),
			body: { appendChild() {} },
		},
		renderer: {
			screen: { width: 800, height: 600 },
			view: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) },
		},
	};
	context.window = context;
	localize(vm.createContext(context));
	vm.runInContext(source, context);
	return context;
}

function button_bounds(button) {
	const left = parseFloat(button.style.left),
		top = parseFloat(button.style.top);
	return { left, top, right: left + button.offsetWidth, bottom: top + button.offsetHeight };
}

function overlaps(a, b) {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test("notice coordinates follow page zoom, canvas scaling and canvas offsets", () => {
	const c = setup();
	for (const zoom of [-25, 0, 25, 50]) {
		for (const scale of [1, 1.5]) {
			const factor = 1 + zoom / 100,
				left = 37 * factor,
				top = 19 * factor;
			const width = 800 * scale * factor,
				height = 600 * scale * factor;
			c.browser_zoom = zoom;
			c.renderer.view.getBoundingClientRect = () => ({
				left,
				top,
				width,
				height,
				right: left + width,
				bottom: top + height,
			});
			c.update_npc_obstruction_hint();
			assert.equal(c.npc_obstruction_hints.length, 1, "reuse the notice when zoom changes");
			const button = c.npc_obstruction_hints[0],
				bounds = button_bounds(button);
			assert.equal(button.style.display, "block");
			assert.ok(
				Math.abs((bounds.left + button.offsetWidth / 2) * factor - (left + 300 * scale * factor)) <= factor / 2,
				"center remains over the NPC",
			);
			assert.ok(
				Math.abs((bounds.bottom + 104) * factor - (top + 264 * scale * factor)) <= factor / 2,
				"vertical gap uses the same coordinate space as the button",
			);
		}
	}
});

test("notices avoid all NPC bodies and name tags, including citizens, moving and map NPCs", () => {
	for (const type of ["citizen", "moving", "map"]) {
		const c = setup(),
			other = Object.assign(sprite(300, 155), { npc: "quiet", moving: type === "moving" });
		c.G.npcs.quiet = { role: type === "citizen" ? "citizen" : "merchant" };
		other.name_tag = {
			visible: true,
			worldAlpha: 1,
			getBounds: (skipUpdate) => {
				assert.equal(skipUpdate, true);
				return { x: 160, y: 90, width: 280, height: 16 };
			},
		};
		if (type === "map") c.map_npcs.push(other);
		else c.entities.other = other;
		c.update_npc_obstruction_hint();
		const button = c.npc_obstruction_hints[0];
		assert.equal(button.style.display, "block", type);
		assert.ok(!overlaps(button_bounds(button), c.npc_hint_bounds(other, true)), type);
		assert.ok(!overlaps(button_bounds(button), c.npc_hint_bounds(c.entities.npc)), "keep the target visible too");
	}
});

test("notices avoid door hit areas at every supported zoom", () => {
	for (const zoom of [-25, 0, 25, 50]) {
		const c = setup(),
			factor = 1 + zoom / 100;
		const door = sprite(300, 160, 1, 1);
		door.hitArea = { x: -180, y: -100, width: 360, height: 100 };
		c.map_doors.push(door);
		c.browser_zoom = zoom;
		c.renderer.view.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			right: 800 * factor,
			bottom: 600 * factor,
			width: 800 * factor,
			height: 600 * factor,
		});
		c.update_npc_obstruction_hint();
		const button = c.npc_obstruction_hints[0];
		assert.equal(button.style.display, "block");
		assert.ok(!overlaps(button_bounds(button), c.npc_hint_bounds(door)), String(zoom));
	}
});

test("notices stay inside the canvas at its edges without covering their NPC", () => {
	for (const x of [15, 785])
		for (const y of [60, 595]) {
			const c = setup();
			Object.assign(c.entities.npc, sprite(x, y));
			delete c.entities.merchant;
			c.entities.other = Object.assign(sprite(x, y + 10), { type: "character" });
			c.update_npc_obstruction_hint();
			const button = c.npc_obstruction_hints[0],
				bounds = button_bounds(button);
			assert.equal(button.style.display, "block");
			assert.ok(bounds.left >= 8 && bounds.right <= 792 && bounds.top >= 8 && bounds.bottom <= 592);
			assert.ok(!overlaps(bounds, c.npc_hint_bounds(c.entities.npc)));
		}
});

test("a notice hides when no free position fits and returns when the obstruction clears", () => {
	const c = setup();
	c.update_npc_obstruction_hint();
	const button = c.npc_obstruction_hints[0],
		door = sprite(400, 600, 800, 600);
	c.map_doors.push(door);
	c.update_npc_obstruction_hint();
	assert.equal(button.style.display, "none", "no position can cover the door");
	door.visible = false;
	c.update_npc_obstruction_hint();
	assert.equal(button.style.display, "block");
	c.renderer.view.getBoundingClientRect = () => ({ left: 0, top: 0, right: 150, bottom: 60, width: 150, height: 60 });
	c.update_npc_obstruction_hint();
	assert.equal(button.style.display, "none", "never overflow a canvas smaller than the notice");
});

test("notices reach 300 units but still require a stand overlapping in front", () => {
	const c = setup();
	assert.equal(c.obstructed_npcs()[0].npc, c.entities.npc, "visible beyond the old 102-unit limit");
	c.entities.npc.proximity = 300;
	assert.equal(c.obstructed_npcs().length, 0);
	c.entities.npc.proximity = 250;
	c.entities.merchant.real_y = 290;
	assert.equal(c.obstructed_npcs().length, 0, "stand behind NPC");
	c.entities.merchant.real_y = 305;
	c.entities.merchant.standed.worldTransform.tx = 330;
	assert.equal(c.obstructed_npcs().length, 0, "minor edge overlap");
	c.entities.merchant.standed.worldTransform.tx = 300;
	c.entities.merchant.stand = false;
	assert.equal(c.obstructed_npcs().length, 0, "closed stand");
});

test("all stationary NPC roles can show notices, except citizens and roaming NPCs", () => {
	const c = setup(),
		definitions = require("./helpers/design").npcs;
	for (const [id, definition] of Object.entries(definitions)) {
		c.G.npcs[id] = definition;
		c.entities.npc.npc = id;
		const excluded = definition.role === "citizen" || definition.moving || definition.movable;
		assert.equal(c.obstructed_npcs().length, excluded ? 0 : 1, id);
	}
	c.entities.npc.npc = "upgrade";
	c.update_npc_obstruction_hint();
	c.G.npcs.quiet = { role: "citizen", name: "Stewart" };
	c.entities.npc.npc = "quiet";
	c.update_npc_obstruction_hint();
	assert.equal(c.npc_obstruction_hints[0].style.display, "none", "a previously visible notice is hidden");
});

test("runtime movement and citizen flags hide an existing notice", () => {
	for (const flag of ["moving", "citizen"]) {
		const c = setup();
		c.update_npc_obstruction_hint();
		c.entities.npc[flag] = true;
		c.update_npc_obstruction_hint();
		assert.equal(c.obstructed_npcs().length, 0, flag);
		assert.equal(c.npc_obstruction_hints[0].style.display, "none", flag);
	}
});

test("Favoré and Ponty notices use their existing click and F interactions", () => {
	for (const id of ["favors", "secondhands"]) {
		for (const input of ["click", "key"]) {
			const c = setup(),
				events = [],
				dialogs = [];
			c.G.npcs[id] = require("./helpers/design").npcs[id];
			c.sfx = c.d_text = () => {};
			c.socket = { emit: (event) => events.push(event) };
			c.render_interaction = (dialog) => dialogs.push(dialog);
			load(c, "js/game.js", ["npc_right_click"]);
			load(c, "js/functions.js", ["npc_focus"]);
			c.map_doors = [];
			Object.assign(c.entities.npc, { npc: id, role: c.G.npcs[id].role, onrclick: c.npc_right_click });
			c.update_npc_obstruction_hint();
			const button = c.npc_obstruction_hints[0];
			assert.equal(button.textContent, c.G.npcs[id].name + "\nPress F or Click");
			if (input === "click") button.onclick({ preventDefault() {}, stopPropagation() {} });
			else {
				c.entities.npc.proximity = 80;
				c.npc_focus();
			}
			if (id === "favors") {
				assert.equal(dialogs.length, 1);
				assert.equal(dialogs[0].skin, "favore");
				dialogs[0].onclick();
				assert.deepEqual(events, ["bless_server"]);
			} else assert.deepEqual(events, ["secondhands"]);
		}
	}
});

test("a player without a stand covering Ernis triggers the notice and moving away clears it", () => {
	const c = setup();
	delete c.entities.merchant;
	c.entities.merc = Object.assign(sprite(300, 312), { type: "character" });
	c.update_npc_obstruction_hint();
	assert.equal(c.obstructed_npcs()[0].npc, c.entities.npc);
	assert.equal(c.npc_obstruction_hints[0].style.display, "block");
	c.entities.merc.visible = false;
	assert.equal(c.obstructed_npcs().length, 0, "hidden players cannot obstruct");
	c.entities.merc.visible = true;
	c.entities.merc.real_y = 299;
	assert.equal(c.obstructed_npcs().length, 0, "players drawn behind do not obstruct");
	c.entities.merc.real_y = 312;
	c.entities.merc.worldTransform.tx = 400;
	c.update_npc_obstruction_hint();
	assert.equal(c.npc_obstruction_hints[0].style.display, "none");
	c.character = c.entities.merc;
	delete c.entities.merc;
	c.character.worldTransform.tx = 300;
	assert.equal(c.obstructed_npcs().length, 0, "the local player alone does not trigger a notice");
	c.character.stand = "stand0";
	c.character.standed = sprite(300, 315, 40, 30);
	c.entities.self = c.character;
	assert.equal(c.obstructed_npcs().length, 0, "the local stand is also ignored, even in entities");
	c.entities.other = Object.assign(sprite(300, 312), { type: "character" });
	assert.equal(
		c.obstructed_npcs()[0].npc,
		c.entities.npc,
		"another blocker still triggers the notice beside the local player",
	);
});

test("two blocked NPCs get separate non-overlapping buttons that open the correct NPC", () => {
	const c = setup(),
		calls = [];
	c.entities.second = Object.assign(sprite(306, 300), {
		npc: "compound",
		proximity: 240,
		onrclick() {
			calls.push(this.npc);
		},
	});
	c.entities.npc.onrclick = function () {
		calls.push(this.npc);
	};
	c.update_npc_obstruction_hint();
	const [first, second] = c.npc_obstruction_hints;
	assert.equal(first.textContent, "Upgrade\nPress F or Click");
	assert.equal(second.textContent, "Compound\nPress F or Click");
	assert.equal(parseInt(first.style.top), 264 - first.offsetHeight - 104);
	assert.ok(parseInt(second.style.top) >= parseInt(first.style.top) + first.offsetHeight + 8);
	assert.ok(parseInt(second.style.top) + second.offsetHeight < 264, "both notices above the NPC bodies");
	const event = { preventDefault() {}, stopPropagation() {} };
	first.onclick(event);
	second.onclick(event);
	assert.deepEqual(calls, ["upgrade", "compound"]);
	for (const type of ["pointerdown", "mousedown", "touchstart", "mousemove"]) {
		let stopped = false;
		first.listeners[type]({
			stopPropagation() {
				stopped = true;
			},
		});
		assert.ok(stopped, type + " cannot reach game movement handlers");
	}
	delete c.entities.npc;
	first.onclick(event);
	assert.equal(calls.length, 2, "stale button cannot interact after map change");
});

test("advanced preference persists, hides immediately, and remains subordinate to GUIDE", () => {
	const c = setup();
	c.update_npc_obstruction_hint();
	c.set_npc_obstruction_hints(false);
	assert.equal(c.storage_get(), "off");
	assert.equal(c.npc_obstruction_hints[0].style.display, "none");
	assert.equal(setup("off").obstructed_npcs().length, 0);
	c.set_npc_obstruction_hints(true);
	assert.equal(c.storage_get(), "on");
	c.proximity_guides = false;
	assert.equal(c.obstructed_npcs().length, 0);
	c.proximity_guides = true;
	c.character.rip = true;
	assert.equal(c.obstructed_npcs().length, 0);
});

test("headless calls return before touching fake PIXI or DOM", () => {
	const c = setup();
	vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../js/pixi/fake/pixi.min.js"), "utf8"), c);
	c.no_graphics = true;
	c.entities = new Proxy(
		{},
		{
			ownKeys() {
				throw new Error("read entities in headless mode");
			},
		},
	);
	c.npc_hint_bounds(null);
	c.obstructed_npcs();
	c.update_npc_obstruction_hint();
});
