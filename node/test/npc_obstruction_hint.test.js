"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../js/npc_obstruction_hint.js"), "utf8");

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

function setup() {
	const npc = Object.assign(sprite(300, 300), { npc: "upgrade", proximity: 20, onrclick() {} });
	const merchant = Object.assign(sprite(300, 305), { stand: "stand0", standed: sprite(300, 308, 40, 30) });
	const context = {
		no_graphics: false,
		no_html: false,
		proximity_guides: true,
		character: {},
		entities: { npc, merchant },
		map_doors: [],
		distance: (entity) => entity.proximity,
		keymap: { F: "interact" },
		G: { npcs: { upgrade: { name: "Upgrade" } } },
	};
	vm.createContext(context);
	vm.runInContext(source, context);
	return context;
}

test("only an overlapping stand drawn in front triggers the nearby NPC hint", () => {
	const c = setup();
	assert.equal(c.obstructed_focus_npc().npc, c.entities.npc);
	c.entities.merchant.real_y = 290;
	assert.equal(c.obstructed_focus_npc(), undefined, "stand behind NPC");
	c.entities.merchant.real_y = 305;
	c.entities.merchant.standed.worldTransform.tx = 400;
	assert.equal(c.obstructed_focus_npc(), undefined, "nearby but not overlapping");
	c.entities.merchant.standed.worldTransform.tx = 330;
	assert.equal(c.obstructed_focus_npc(), undefined, "minor edge overlap");
	c.entities.merchant.standed.worldTransform.tx = 300;
	c.entities.merchant.stand = false;
	assert.equal(c.obstructed_focus_npc(), undefined, "closed stand");
});

test("GUIDE, range and nearest-door selection match the interaction shortcut", () => {
	const c = setup();
	c.proximity_guides = false;
	assert.equal(c.obstructed_focus_npc(), undefined);
	c.proximity_guides = true;
	c.entities.npc.proximity = 102;
	assert.equal(c.obstructed_focus_npc(), undefined);
	c.entities.npc.proximity = 20;
	c.map_doors.push({ proximity: 10 });
	assert.equal(c.obstructed_focus_npc(), undefined, "F would open the nearer door");
	c.map_doors = [];
	c.character.rip = true;
	assert.equal(c.obstructed_focus_npc(), undefined);
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
	c.obstructed_focus_npc();
	c.update_npc_obstruction_hint();
});

test("hint follows canvas scale, sits well above the NPC, revalidates clicks and clears", () => {
	const c = setup();
	function element() {
		return {
			style: {},
			children: [],
			offsetHeight: 64,
			offsetWidth: 260,
			appendChild(child) {
				this.children.push(child);
				this.firstChild = this.children[0];
				this.lastChild = child;
			},
		};
	}
	c.document = { createElement: element, body: element() };
	c.renderer = {
		screen: { width: 800, height: 600 },
		view: {
			getBoundingClientRect: () => ({ left: 10, top: 20, right: 1610, bottom: 1220, width: 1600, height: 1200 }),
		},
	};
	let clicks = 0;
	c.entities.npc.onrclick = () => clicks++;
	c.keymap = { E: { name: "interact" } };
	c.update_npc_obstruction_hint();
	const hint = c.npc_obstruction_hint;
	assert.equal(hint.firstChild.textContent, "Upgrade\nPress E or click to interact");
	assert.equal(hint.style.left, "610px");
	assert.equal(hint.style.top, "420px");
	assert.equal(hint.lastChild.style.height, "56px");
	hint.firstChild.onclick({ stopPropagation() {} });
	assert.equal(clicks, 1);
	c.proximity_guides = false;
	hint.firstChild.onclick({ stopPropagation() {} });
	assert.equal(clicks, 1);
	c.update_npc_obstruction_hint();
	assert.equal(hint.hidden, true);
	c.proximity_guides = true;
	c.entities = {};
	c.update_npc_obstruction_hint();
	assert.equal(hint.hidden, true, "map change removes stale hint");
});
