const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read, socketHandler } = require("./helpers/server_vm");

const plain = (value) => JSON.parse(JSON.stringify(value));
const equipment = [
	"cave_tunnelaxe",
	"cave_reedscythe",
	"cave_deepaxe",
	"cave_ambercoat",
	"cave_locktooth",
	"cave_counterweight",
	"cave_mothsteps",
	"cave_loaded_die",
];
// Use the native shop setup, including actual NPC positions and item availability.
G.geometry = {};
G.T = {};
G.can_buy = {};
G.process_game_data();

function inventoryFixture(recipeName) {
	const recipe = recipeName && G.craft[recipeName];
	const items = recipe
		? recipe.items.map(([q, name, level]) => ({ name, ...(G.items[name].s ? { q } : { level: level || 0 }) }))
		: Array(8).fill(null);
	const messages = [],
		failures = [];
	const player = {
		...G.maps.main.ref.craftsman,
		name: "Crafter",
		gold: recipe ? recipe.cost : 100000,
		items,
		citems: plain(items),
		esize: items.filter((item) => !item).length,
		s: {},
		socket: { emit() {} },
	};
	const context = vm.createContext({
		...G,
		G,
		D: { drops: G.drops },
		B: { sell_dist: 100 },
		instances: { main: {} },
		players: { crafter: player },
		socket: { id: "crafter" },
		gameplay: "normal",
		a_score: {},
		Math: Object.assign(Object.create(Math), { random: () => 0.999999 }),
		cache_item: plain,
		resend() {},
		xy_emit() {},
		success_response: (...args) => messages.push(args),
		fail_response: (...args) => failures.push(args),
	});
	load(context, "node/server.js", ["create_new_item", "consume", "add_item"]);
	load(context, "node/server_functions.js", ["get_npc_coords", "chest_exchange"]);
	const functions = read("node/server_functions.js"),
		start = functions.indexOf("D.craftmap = {};");
	vm.runInContext(functions.slice(start, functions.indexOf("process_game_data();", start)), context);
	return { context, player, messages, failures, recipe };
}

test("cave equipment recipes and an ordinary pickaxe craft through the real handler", () => {
	for (const name of [...equipment, "pickaxe"]) {
		const { context, player, messages, failures, recipe } = inventoryFixture(name);
		socketHandler(context, "craft")({ items: recipe.items.map((_, index) => [index, index]) });
		assert.deepEqual(failures, [], name);
		assert.equal(player.gold, 0, name);
		assert.deepEqual(plain(player.items.filter(Boolean)), [
			{ name, ...(G.items[name].upgrade ? { level: 0 } : {}), oo: "Crafter" },
		]);
		assert.equal(messages.at(-1)[0], "craft");
		assert.equal(messages.at(-1)[1].name, name);
	}
});

test("Cave-found materials stack normally and do not pass their title through crafting", () => {
	const { context, player, messages, failures, recipe } = inventoryFixture("cave_tunnelaxe");
	for (const item of player.items) item.p = "cavefound";
	socketHandler(context, "craft")({ items: recipe.items.map((_, index) => [index, index]) });
	assert.deepEqual(failures, []);
	assert.equal(messages.at(-1)[1].name, "cave_tunnelaxe");
	assert.equal(player.items.find(Boolean).p, undefined);
	for (const [oldTitle, newTitle] of [
		["cavefound", undefined],
		[undefined, "cavefound"],
	]) {
		player.items = [{ name: "cave_amber", q: 3, p: oldTitle }];
		player.citems = plain(player.items);
		player.esize = 0;
		const item = { name: "cave_amber", q: 2, p: newTitle };
		assert.ok(context.can_add_item(player, item));
		assert.equal(context.add_item(player, item, { announce: false }), 0);
		assert.equal(player.items.length, 1);
		assert.equal(player.items[0].q, 5);
	}
	assert.equal(
		G.can_stack({ name: "cave_amber", q: 1, p: "shiny" }, { name: "cave_amber", q: 1, p: "cavefound" }),
		false,
	);
});

test("cave crafts reject upgraded inputs, missing materials and short gold without consuming anything", () => {
	for (const name of equipment) {
		for (const invalid of ["level", "quantity", "gold", "distance"]) {
			if (invalid === "level" && !G.craft[name].items.some(([, ingredient]) => G.items[ingredient].upgrade)) continue;
			const { context, player, failures, recipe } = inventoryFixture(name);
			if (invalid === "level") player.items.find((item) => G.items[item.name].upgrade).level++;
			if (invalid === "quantity") {
				const slot = player.items.findIndex((item) => item.q);
				if (player.items[slot].q > 1) player.items[slot].q--;
				else player.items[slot] = null;
			}
			if (invalid === "gold") player.gold--;
			if (invalid === "distance") player.x += 200;
			const before = plain({ items: player.items, gold: player.gold });
			socketHandler(context, "craft")({ items: recipe.items.map((_, index) => [index, index]) });
			assert.equal(failures.length, 1, name + " " + invalid);
			assert.deepEqual(plain({ items: player.items, gold: player.gold }), before);
		}
	}
});

test("Gabriel sells Wooden Axe, Reed Scythe and ordinary Blade through the normal shop handler", () => {
	for (const name of ["waxe", "cave_reedscythe", "blade"]) {
		const { context, player, messages, failures } = inventoryFixture();
		Object.assign(player, G.maps.main.ref.basics);
		player.gold = G.items[name].g;
		const buy = socketHandler(context, "buy");
		buy({ name, quantity: 1 });
		assert.deepEqual(failures, []);
		assert.equal(player.gold, 0);
		assert.equal(player.items[0].name, name);
		assert.equal(messages.at(-1)[1].cost, name === "cave_reedscythe" ? 16000 : G.items[name].g);
		buy({ name, quantity: 1 });
		assert.equal(failures.at(-1)[0], "buy_cost");
		assert.equal(player.items.filter(Boolean).length, 1);
	}
});

test("Wooden Axe uses the standard T1 curve and preserves stronger axes", () => {
	assert.equal(G.items.waxe.tier, 1);
	assert.equal(G.items.waxe.attack, 30);
	assert.equal(G.items.waxe.range, 5);
	assert.deepEqual(plain(G.items.waxe.upgrade), { range: 1, attack: 7 });
	assert.deepEqual(plain(G.items.waxe.grades), [7, 9, 10, 12]);
	assert.equal(G.items.waxe.g, 4900);
	assert(G.skills.cleave.wtype.includes(G.items.waxe.wtype));
	assert(G.classes.warrior.doublehand.axe);
	for (let level = 0; level <= 12; level++) {
		const axe = G.calculate_item_properties({ name: "waxe", level });
		for (const name of ["bataxe", "cave_tunnelaxe"]) {
			assert(axe.attack < G.calculate_item_properties({ name, level }).attack);
		}
	}
	for (const table of ["glitch", "lglitch"]) assert(!G.drops[table].some((row) => row[1] === "waxe"));
});

test("the ordinary chest roller awards the new common weapons from their shared drop tables", () => {
	const { context } = inventoryFixture();
	for (const table of ["cave_parcel", "cave_rescue", "cave_farm", "cave_boss", "cave_finish"]) {
		const rows = G.drops[table],
			total = rows.reduce((sum, row) => sum + row[0], 0);
		let cumulative = 0;
		assert.equal(total, 100);
		for (const row of rows) {
			if (["cave_tunnelaxe", "cave_reedscythe"].includes(row[1])) {
				const rolls = [(cumulative + row[0] / 2) / total];
				context.Math.random = () => (rolls.length ? rolls.shift() : 0.999999);
				const chest = { items: [], gold: 0, cash: 0 };
				context.chest_exchange(chest, table);
				assert.deepEqual(plain(chest.items), [{ name: row[1], level: 0 }]);
			}
			cumulative += row[0];
		}
	}
});

test("each rare completion bonus has its own 0.1% roll and both can drop together", () => {
	const { context } = inventoryFixture();
	for (const [axe, coat, expected] of [
		[0.001, 0.001, []],
		[0.000999, 0.001, ["cave_deepaxe"]],
		[0.001, 0.000999, ["cave_ambercoat"]],
		[0.000999, 0.000999, ["cave_deepaxe", "cave_ambercoat"]],
	]) {
		const rolls = [0.1, axe, ...(axe < 0.001 ? [0.5] : []), coat, ...(coat < 0.001 ? [0.5] : [])];
		context.Math.random = () => {
			assert.ok(rolls.length);
			return rolls.shift();
		};
		const chest = { items: [], gold: 0, cash: 0, luck: 10000 };
		context.chest_exchange(chest, "cave_finish");
		assert.deepEqual(plain(chest.items.map((item) => item.name)), ["cave_amber", ...expected]);
		assert.equal(rolls.length, 0);
	}
});

test("the guide's existing drop renderer shows independent bonuses as 0.1%", () => {
	const { context } = inventoryFixture();
	const icons = [];
	context.item_container = (item, actual) => {
		icons.push(actual.name);
		return "";
	};
	load(context, "js/html.js", ["render_drop"]);
	for (const drop of G.drops.cave_finish_bonus) {
		assert.match(context.render_drop(drop, 1, "#858B8E", "percent"), />0\.1%<\/div>/);
	}
	assert.deepEqual(icons, ["cave_deepaxe", "cave_ambercoat"]);
});

test("Mothstep bonuses apply on entering Cave of Darkness and disappear on leaving", () => {
	const { context: c, player: p } = inventoryFixture();
	Object.assign(c, {
		goldm: 1,
		luckm: 1,
		xpm: 1,
		mode: {},
		parties: {},
		perfc: { cps: 0 },
		recalculate_vxy() {},
		market_patron_reset() {},
		generated_can_enter: () => true,
		send_generated_maps() {},
		is_invis: () => false,
		pmap_remove() {},
		pmap_add() {},
		resume_instance() {},
		add_call_cost() {},
		send_all_xy: () => ({}),
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats")), c);
	load(c, "node/server.js", ["apply_stats", "calculate_common_stats", "calculate_player_stats", "transport_player_to"]);
	Object.assign(p, {
		id: "Crafter",
		type: "warrior",
		level: 40,
		xp: 0,
		damage_type: "physical",
		map: "main",
		in: "main",
		hp: 100,
		mp: 100,
		slots: { mainhand: { name: "blade", level: 6 }, shoes: { name: "cave_mothsteps", level: 6, stat_type: "str" } },
		p: { stats: { monsters: {}, monsters_diff: {} } },
		max_stats: { monsters: {} },
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
		bets: {},
		last: {},
		m: 0,
		cid: 0,
	});
	c.instances = { main: { map: "main", players: { Crafter: p } }, cave: { map: "cave", players: {} } };
	c.calculate_player_stats(p);
	const baseline = { speed: p.speed, evasion: p.evasion, armor: p.armor, resistance: p.resistance };
	c.transport_player_to(p, "cave", 0);
	assert.equal(p.speed, baseline.speed + 20);
	assert.equal(p.evasion, baseline.evasion + 35);
	assert.equal(p.armor, baseline.armor);
	assert.equal(p.resistance, baseline.resistance);
	c.transport_player_to(p, "main", 0);
	assert.deepEqual({ speed: p.speed, evasion: p.evasion, armor: p.armor, resistance: p.resistance }, baseline);
	// A generated Cave of Many Dreams floor does not receive the unrelated cave-map bonus.
	p.map = "zone_test_0";
	c.calculate_player_stats(p);
	assert.equal(p.evasion, baseline.evasion);
	assert.equal(p.speed, baseline.speed);
	p.map = "cave";
	p.slots.orb = { name: "orboftemporal", level: 6 };
	c.calculate_player_stats(p);
	assert.equal(p.evasion, 50, "stacked gear still obeys the ordinary evasion cap");
});
