const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const design = require("./helpers/design");
const { load, read } = require("./helpers/server_vm");

function fixture() {
	const docContext = vm.createContext({});
	vm.runInContext(read("docs/directory.js"), docContext);
	const state = { html: "", renders: 0, guides: [], sprites: [] };
	const c = vm.createContext({
		G: { ...design, docs: docContext.docs, maps: { audit: {}, cave: { generated: true } } },
		character: {
			name: "Newcomer",
			type: "character",
			level: 20,
			map: "audit",
			in: "audit",
			real_x: 0,
			real_y: 0,
			hp: 1000,
			max_hp: 1000,
			attack: 100,
			frequency: 1,
			armor: 0,
			resistance: 0,
			damage_type: "physical",
		},
		entities: {},
		map_npcs: [],
		party: {},
		quirks: {},
		S: {},
		interaction_context: null,
		interaction_contexts: [],
		no_graphics: false,
		no_html: false,
		proximity_guides: true,
		gameplay: "normal",
		anniversary_visible_skill: false,
		render_event_announcements() {},
		anniversary_live_event: () => null,
		anniversary_can_visit: () => false,
		cave_info_available: () => false,
		tutorial_npc() {},
		tut() {},
		pcs() {},
		event: {},
		open_guide: (...args) => state.guides.push(args),
		socket: {
			emit() {
				assert.fail("The hint must not summon Cavalry");
			},
		},
		sprite: (skin, args) => {
			state.sprites.push({ skin, args });
			return "<span>native-sprite</span>";
		},
		item_container: () => "<span>native-item</span>",
		$: (selector) => ({
			length: 0,
			html(html) {
				if (selector === "#serverinfo") {
					state.html = html;
					state.renders++;
				}
				return this;
			},
			hide() {},
			css() {},
		}),
		PIXI: new Proxy(
			{},
			{
				get() {
					assert.fail("The hint must not touch PIXI");
				},
			},
		),
	});
	load(c, "common/js/common_functions.js", ["html_escape"]);
	vm.runInContext(read("js/old_common_functions.js"), c);
	load(c, "js/game.js", [
		"showhide_quirks_logic",
		"get_cavalry_interaction_context",
		"get_npc_interaction_context",
		"consider_interaction_context",
		"interaction_context_range",
		"interaction_door_visual",
		"normalize_interaction_contexts",
		"interaction_context_signature",
	]);
	load(c, "js/html.js", ["render_server", "open_interaction_guide", "get_guide_url"]);
	const monster = (c.entities.bee = {
		...design.monsters.bee,
		id: "bee",
		type: "monster",
		mtype: "bee",
		level: 9,
		map: "audit",
		in: "audit",
		real_x: 100,
		real_y: 0,
		hp: 4000,
		attack: 300,
		frequency: 1,
	});
	return { c, state, monster, scan: () => c.showhide_quirks_logic() };
}

test("dangerous leveled monsters show one native CALL button that opens the existing guide", () => {
	const { c, state, monster, scan } = fixture();
	c.entities.second = { ...monster, id: "second", real_x: 150 };
	scan();
	assert.equal(c.interaction_contexts.length, 1);
	assert.match(state.html, />CALL<\/div>/);
	assert.equal(state.sprites[0].skin, design.npcs.cavalry_warrior.skin);
	assert.equal(state.sprites[0].args.j, 0);
	assert.equal(state.sprites[0].args.overflow, true);
	assert.equal(state.guides.length, 0, "No automatic popup");
	vm.runInContext(state.html.match(/onclick='([^']+)'/)[1], c);
	assert.deepEqual(state.guides, [["cavalry", "/docs/guide/advanced/cavalry"]]);
	monster.real_x += 25;
	scan();
	assert.equal(state.renders, 1, "Moving within range does not rebuild the button");
});

test("the level cutoff hides only the hint, and clears it as soon as the character reaches 60", () => {
	const { c, state, scan } = fixture();
	c.character.level = 59;
	scan();
	assert.match(state.html, />CALL<\/div>/);
	c.character.level = 60;
	scan();
	assert.equal(state.html, "");
	assert.equal(c.interaction_contexts.length, 0);
	assert.equal(state.renders, 2);
	for (const level of [60, 100]) {
		c.character.level = level;
		c.open_interaction_guide("cavalry");
		assert.equal(state.guides.at(-1)[0], "cavalry");
	}
});

test("a headless client with fake PIXI never builds the Cavalry hint", () => {
	const { c, state, scan } = fixture();
	c.no_graphics = true;
	vm.runInContext(read("js/pixi/fake/pixi.min.js"), c);
	assert.ok(c.PIXI.Sprite);
	Object.defineProperty(c, "PIXI", {
		get() {
			assert.fail("The headless hint touched PIXI");
		},
	});
	scan();
	assert.equal(state.sprites.length, 0);
	assert.equal(state.guides.length, 0);
});

test("safe, absent and excluded monsters do not offer a rescue hint", () => {
	for (const change of [
		(c, m) => {
			m.level = 2;
		},
		(c, m) => {
			m.hp = 0;
		},
		(c, m) => {
			m.dead = true;
		},
		(c, m) => {
			m.real_x = 321;
		},
		(c, m) => {
			m.in = "elsewhere";
		},
		(c, m) => {
			m.mtype = "franky";
		},
		(c, m) => {
			m.pet = true;
		},
		(c, m) => {
			m.target = "Stranger";
		},
		(c, m) => {
			c.character.attack = m.hp;
		},
		(c, m) => {
			m.hp = 500;
			m.attack = 1;
		},
		(c, m) => {
			c.character.map = m.map = "cave";
		},
		(c) => {
			c.character.rip = true;
		},
		(c) => {
			c.character.hp = 0;
		},
		(c) => {
			c.no_graphics = true;
		},
		(c) => {
			c.no_html = true;
		},
		(c) => {
			c.proximity_guides = false;
		},
		(c, m) => {
			delete m.frequency;
		},
	]) {
		const { c, state, monster, scan } = fixture();
		scan();
		change(c, monster);
		scan();
		assert.equal(state.html, "", String(change));
		assert.equal(state.guides.length, 0);
	}
});

test("the hint uses scaled stats, incoming damage type, current HP and party targets", () => {
	const { c, state, monster, scan } = fixture();
	monster.attack = 40;
	monster.hp = 1000;
	scan();
	assert.equal(state.html, "", "A safe ten-second fight does not trigger it");
	monster.frequency = 2;
	scan();
	assert.match(state.html, />CALL<\/div>/, "Scaled frequency makes a sustained fight dangerous");
	c.character.armor = 2000;
	scan();
	assert.equal(state.html, "", "Physical defense makes it safe");
	monster.damage_type = "magical";
	scan();
	assert.match(state.html, />CALL<\/div>/, "Armor does not absorb magic");
	c.character.resistance = 2000;
	scan();
	assert.equal(state.html, "");
	monster.damage_type = "pure";
	monster.target = "Friend";
	c.party.Friend = {};
	scan();
	assert.match(state.html, />CALL<\/div>/);
	monster.attack = 10;
	c.character.hp = 30;
	scan();
	assert.match(state.html, />CALL<\/div>/, "A wounded caller can need help with the same monster");
});

test("a living veteran within 150 pixels suppresses the hint, including at the outer rescue boundary", () => {
	const { c, state, monster, scan } = fixture();
	monster.real_x = 320;
	c.entities.veteran = {
		name: "Veteran",
		type: "character",
		level: 80,
		hp: 1000,
		map: "audit",
		in: "audit",
		real_x: 470,
		real_y: 0,
	};
	scan();
	assert.equal(state.html, "");
	c.entities.veteran.real_x = 471;
	scan();
	assert.match(state.html, />CALL<\/div>/);
	c.entities.veteran.real_x = 470;
	c.entities.veteran.rip = true;
	scan();
	assert.match(state.html, />CALL<\/div>/);
	c.entities.veteran.rip = false;
	c.entities.veteran.in = "elsewhere";
	scan();
	assert.match(state.html, />CALL<\/div>/);
});

test("ordinary NPC INFO buttons keep their renderer and remain after the threat is gone", () => {
	const { c, state, monster, scan } = fixture();
	c.map_npcs.push({ ...design.npcs.craftsman, npc: "craftsman", real_x: 0, real_y: 0 });
	scan();
	assert.match(state.html, />INFO<\/div>/);
	assert.match(state.html, />CALL<\/div>/);
	monster.dead = true;
	scan();
	assert.match(state.html, />INFO<\/div>/);
	assert.doesNotMatch(state.html, />CALL<\/div>/);
});
