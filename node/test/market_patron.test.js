"use strict";
const test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("node:fs"),
	vm = require("node:vm"),
	path = require("node:path");
const shared = {};
vm.createContext(shared);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../../js/old_common_functions.js"), "utf8"), shared);
const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const rules = require("../logic/market_patron")(shared.simple_distance),
	config = require("../../design/npcs").npcs.citizen22.market;
const items = { scroll0: {}, marketparcel: { s: 9999 } };
const merchant = (x = 0, y = 0) => ({
	name: "Shop",
	map: "main",
	in: "main",
	x,
	y,
	gold: 100,
	items: [null],
	esize: 1,
	p: { stand: "stand0" },
	slots: { trade1: { name: "scroll0", price: 1, q: 1 } },
});
test("all spacing boundaries and mobility use world positions", () => {
	const p = merchant(),
		n = { name: "Ponty", in: "main", x: 40, y: 0 };
	assert.equal(rules.blockers(p, [], [n], config)[0].code, "npc");
	n.x = 40.001;
	assert.equal(rules.blockers(p, [], [n], config).length, 0);
	n.x = 0;
	n.movable = true;
	assert.equal(rules.blockers(p, [], [n], config).length, 0);
	n.movable = false;
	n.loop = true;
	assert.equal(rules.blockers(p, [], [n], config).length, 0);
	const o = merchant(10, 0);
	assert.equal(rules.blockers(p, [p, o], [], config)[0].code, "stand_close");
	o.x = 10.001;
	assert.equal(rules.blockers(p, [o], [], config).length, 0);
	o.x = 0;
	o.y = -15;
	assert.equal(rules.blockers(p, [o], [], config)[0].code, "stand_front");
	assert.equal(rules.blockers(o, [p], [], config).length, 0);
	o.y = -15.001;
	assert.equal(rules.blockers(p, [o], [], config).length, 0);
	o.y = -14;
	o.x = 10;
	assert.equal(rules.blockers(p, [o], [], config)[0].code, "stand_front");
	o.x = 10.001;
	assert.equal(rules.blockers(p, [o], [], config).length, 0);
	o.in = "other";
	o.x = 0;
	o.y = 0;
	assert.equal(rules.blockers(p, [o], [], config).length, 0);
});
test("settled hour cannot be banked by moving, emptying, or reopening", () => {
	const p = merchant();
	let q = rules.qualify(p, [p], [], config, items, null, 0);
	assert.equal(q.ready_at, 3600000);
	q.session.checked = 3599999;
	q = rules.qualify(p, [p], [], config, items, q.session, 3599999);
	assert.equal(q.reasons[0].code, "warming");
	q = rules.qualify(p, [p], [], config, items, q.session, 3600000);
	assert.equal(q.reasons.length, 0);
	p.x = 4.001;
	q = rules.qualify(p, [p], [], config, items, q.session, 3600001);
	assert.equal(q.ready_at, 7200001);
	p.p.stand = false;
	q = rules.qualify(p, [p], [], config, items, q.session, 3600002);
	assert.equal(q.session, null);
	p.p.stand = true;
	delete p.slots.trade1;
	q = rules.qualify(p, [p], [], config, items, null, 3600003);
	assert.equal(q.session, null);
	p.slots.trade1 = { name: "scroll0", price: 101, b: true, q: 1 };
	assert.equal(rules.hasListing(p, items), false);
	p.gold = 101;
	assert.equal(rules.hasListing(p, items), true);
	p.slots.trade1.giveaway = 1;
	assert.equal(rules.hasListing(p, items), false);
});
test("shell curve diminishes to the fixed floor", () => {
	assert.equal(rules.shellChance(0, config), 0.005);
	assert.equal(rules.shellChance(10, config), 0.00001);
	assert.equal(rules.shellChance(1000, config), 0.00001);
	for (let i = 0; i < 10; i++) assert.ok(rules.shellChance(i, config) > rules.shellChance(i + 1, config));
	assert.ok(Math.abs(rules.shellChance(5, config) - 0.0012575) < 1e-12);
});
test("shared pathfinder visits Mainland patrol stops and bounds every searched step", () => {
	const c = { server_log() {}, mssince: () => 0 };
	vm.createContext(c);
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../../js/old_common_functions.js"), "utf8"), c);
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../precomputed_map_data.js"), "utf8"), c);
	const source = fs.readFileSync(path.join(__dirname, "../server_functions.js"), "utf8");
	vm.runInContext(source.slice(source.indexOf("function amap_round("), source.indexOf("function server_bfs2(")), c);
	vm.runInContext(source.slice(source.indexOf("function can_amove("), source.indexOf("function fast_abfs(")), c);
	c.amap_data = c.precomputed_bfs.amap_data;
	for (const [tx, ty] of config.stops) {
		let sx = 0,
			sy = 0;
		for (let i = 0; i < 30 && c.point_distance(sx, sy, tx, ty) >= 28; i++) {
			const step = c.fast_astar({
				map: "main",
				sx,
				sy,
				tx,
				ty,
				within: (x, y) => c.point_distance(0, 0, x, y) <= config.radius,
			});
			assert.ok(step, `route to ${tx},${ty}`);
			assert.ok(c.path.every(([x, y]) => Math.hypot(x, y) <= config.radius));
			assert.ok(step[0] !== sx || step[1] !== sy, "route advances");
			[sx, sy] = step;
		}
		assert.ok(c.point_distance(sx, sy, tx, ty) < 28, "reaches handoff distance");
	}
	assert.equal(c.fast_astar({ map: "main", sx: 0, sy: 0, tx: 80, ty: 0, within: () => false }), undefined);
});
function harness(options = {}) {
	const now = Date.now(),
		p = Object.assign(merchant(), {
			_id: "CH_test",
			id: "Shop",
			owner: "US_test",
			secret: "fixture",
			socket: { id: "socket", emit() {} },
		});
	const npc = { id: "$Merrit", npc: true, movable: true, map: "main", in: "main", x: 0, y: 0, base: {} };
	const db = {
		CH_test: { _id: "CH_test", owner: p.owner, server: "testserver", info: { secret: p.secret, p: {}, items: [null] } },
		US_test: { _id: "US_test", cash: 0, info: {} },
	};
	const clone = (v) => JSON.parse(JSON.stringify(v));
	let seq = 0,
		additions = 0,
		readFailure = !!options.readFailure;
	const context = {
		console,
		Math: Object.assign(Object.create(Math), { random: () => 0 }),
		Date,
		WeakMap,
		Map,
		G: { npcs: { citizen22: { market: config } }, items },
		market_patron_rules: rules,
		simple_distance: shared.simple_distance,
		point_distance: shared.point_distance,
		players: { socket: p },
		instances: { main: { players: { socket: p, npc } } },
		server_id: "testserver",
		mode: {},
		gameplay: "normal",
		get_id: (p) => p._id,
		randomStr: () => String(++seq),
		can_move: () => true,
		can_stack: shared.can_stack,
		can_add_item: shared.can_add_item,
		cache_item: (item) => item,
		player_to_server: (p) => ({ items: p.items, p: p.p }),
		sync_entity: (e, d) => {
			e.info.items = d.items;
			e.info.p = d.p;
		},

		add_event() {},
		resend() {},
		citizen_npc_in_instance: () => npc,
		disappearing_text() {},
		get: async (id) => {
			if (readFailure) throw Error("read unavailable");
			return clone(db[id]);
		},
	};
	context.tx = async (fn, A) => {
		const staged = clone(db),
			R = {};
		const scope = {
			A,
			R,
			Date,
			tx_get: async (id) => staged[id],
			tx_save: async (e) => {
				staged[e._id] = e;
			},
			ex: (reason) => {
				throw reason;
			},
		};
		try {
			await vm.runInNewContext("(" + fn.toString() + ")()", scope);
			if (options.abort) return { failed: true, reason: "exception" };
			Object.assign(db, staged);
			return options.ambiguous ? { failed: true, reason: "exception" } : R;
		} catch (reason) {
			return { failed: true, reason };
		}
	};
	vm.createContext(context);
	Object.assign(shared, { G: context.G, is_array: Array.isArray });
	vm.runInContext(
		serverSource.slice(
			serverSource.indexOf("function add_item(player,"),
			serverSource.indexOf("function list_to_pseudo_items("),
		),
		context,
	);
	const insert = context.add_item;
	context.add_item = (target, item, args) => {
		if (target === p) additions++;
		return insert(target, item, args);
	};
	p.citems = [];
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../logic/market_patron_runtime.js"), "utf8"), context);
	const ready = () =>
		context.market_patron_sessions.set(p, {
			x: p.x,
			y: p.y,
			in: "main",
			since: Date.now() - 3600001,
			checked: Date.now(),
		});
	ready();
	return {
		context,
		p,
		npc,
		db,
		ready,
		additions: () => additions,
		allowReads: () => {
			readFailure = false;
		},
	};
}
test("parcel, shell and account receipt commit once; a second claim cannot pay", async () => {
	const h = harness();
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.additions(), 1);
	assert.equal(h.db.US_test.cash, 1);
	assert.equal(h.db.CH_test.info.items[0].name, "marketparcel");
	assert.equal(h.p.p.merrit_receipt.id, h.db.US_test.info.merrit.id);
	assert.equal(h.p.merrit_grant, undefined);
	h.ready();
	h.context.market_patron_account_next.clear();
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.additions(), 1);
	assert.equal(h.db.US_test.cash, 1);
});
test("rollback never adds an item or spends the cooldown", async () => {
	const h = harness({ abort: true });
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.additions(), 0);
	assert.equal(h.db.US_test.cash, 0);
	assert.equal(h.db.US_test.info.merrit, undefined);
	assert.equal(h.p.merrit_grant, undefined);
});
test("lost commit acknowledgement reconciles the committed receipt without reroll", async () => {
	const h = harness({ ambiguous: true });
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.additions(), 1);
	assert.equal(h.db.US_test.cash, 1);
});
test("unknown result blocks saves until reconciliation, even after disconnect", async () => {
	const h = harness({ ambiguous: true, readFailure: true });
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.additions(), 0);
	assert.equal(h.p.merrit_grant.recover, true);
	delete h.context.players.socket;
	h.allowReads();
	await h.context.market_patron_recover(h.p);
	assert.equal(h.additions(), 1);
	assert.equal(h.p.merrit_grant, undefined);
	assert.equal(h.db.US_test.cash, 1);
});
test("full inventory rejects the entire grant, but a matching stack can receive it", async () => {
	const h = harness();
	h.p.esize = 0;
	h.p.items = [{ name: "scroll0", q: 1 }];
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.additions(), 0);
	h.p.items = [{ name: "marketparcel", q: 3 }];
	h.ready();
	await h.context.market_patron_grant(h.npc, h.p);
	assert.equal(h.p.items[0].q, 4);
	assert.equal(h.db.CH_test.info.items[0].q, 4);
});

test("removing the last listing resets a timer before a quick relisting", () => {
	const h = harness();
	delete h.p.slots.trade1;
	h.context.market_patron_observe(h.p);
	h.p.slots.trade1 = { name: "scroll0", price: 1 };
	assert.equal(h.context.market_patron_sessions.has(h.p), false);
	assert.equal(h.context.market_patron_status(h.p, Date.now()).reasons[0].code, "warming");
});
test("gift feedback preserves CODE events headlessly and queues no coin visuals", () => {
	const callbacks = [],
		animations = [],
		sounds = [],
		events = [];
	const c = {
		no_graphics: true,
		character: { x: 1, y: 2 },
		console: { warn() {} },
		add_log() {},
		call_code_function: (...args) => events.push(args),
		draw_trigger: (f) => callbacks.push(f),
		start_animation: (...args) => animations.push(args),
		sfx: (...args) => sounds.push(args),
	};
	vm.createContext(c);
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../../js/pixi/fake/pixi.min.js"), "utf8"), c);
	const source = fs.readFileSync(path.join(__dirname, "../../js/game.js"), "utf8");
	vm.runInContext(source.slice(source.indexOf("var merrit_seen_gifts")), c);
	c.merrit_gift_feedback({ id: "headless", receipt: { shells: 1 } });
	assert.equal(events.length, 1);
	assert.equal(callbacks.length, 0);
	c.no_graphics = false;
	c.merrit_gift_feedback({ id: "draw", receipt: {} });
	c.merrit_gift_feedback({ id: "draw", receipt: {} });
	assert.equal(callbacks.length, 1, "one cue per receipt");
	callbacks.shift()();
	assert.equal(animations[0][1], "merrit_bonus");
	assert.equal(sounds[0][0], "coins");
	c.merrit_gift_feedback({ id: "queued", receipt: {} });
	c.no_graphics = true;
	callbacks.shift()();
	assert.equal(animations.length, 1, "queued graphics recheck headless mode");
	assert.equal(sounds.length, 1);
});

test("public INFO and server exchange share odds; parcels stay out of Glitch pools", () => {
	const c = { console: { log() {}, error() {} }, require };
	vm.createContext(c);
	for (const file of ["multipliers", "items", "npcs", "drops"])
		vm.runInContext(fs.readFileSync(path.join(__dirname, "../../design/" + file + ".js"), "utf8"), c);
	assert.equal(c.drops.marketparcel, c.npcs.citizen22.market.exchange);
	assert.equal(
		c.drops.marketparcel.reduce((sum, row) => sum + row[0], 0),
		9000000,
	);
	assert.deepEqual(Array.from(config.chase), ["marketwatch", "ledgerlight", "waybill", "surety", "nighttill"]);
	for (const id of ["marketparcel", ...config.chase]) {
		assert.equal(c.items[id].exclusive, true);
		for (const table of ["glitch", "lglitch"])
			assert.equal(
				c.drops[table].some((row) => row[1] === id),
				false,
			);
	}
	for (const id of config.chase) {
		const row = c.drops.marketparcel.find((row) => row[1] === id);
		assert.equal(row[0] / 9000000, 1 / 4500);
		assert.equal(row[2], 1);
		assert.equal(c.items[id].tier, 3);
		assert.deepEqual(Array.from(c.items[id].grades), [0, 0, 9, 10]);
	}
	c.G = { npcs: c.npcs, items: c.items };
	c.html_escape = (text) => text;
	c.item_container = (args, item) => item.name;
	const html = fs.readFileSync(path.join(__dirname, "../../js/html.js"), "utf8");
	vm.runInContext(html.slice(html.indexOf("function merrit_spacing_html(")), c);
	const info = fs.readFileSync(path.join(__dirname, "../../docs/guide/npc-merrit.html"), "utf8");
	for (const expected of ["40px", "10px", "15px", "32px", "600px", "0.5%", "0.001%", "1 in 900"])
		assert.ok(info.includes(expected), expected);
	const featured = c.merrit_rewards_html(true);
	assert.equal((featured.match(/class='merrit-reward'/g) || []).length, 5);
	for (const id of config.chase) assert.ok(featured.includes(id));
	assert.equal((c.merrit_rewards_html(false).match(/class='merrit-reward'/g) || []).length, 14);
});

test("Merrit has separate proximity INFO and portrait dialogue; late replies cannot reopen it", () => {
	const c = { no_html: false, character: { name: "Shop" }, clone: (v) => ({ ...v }), html_escape: (v) => v };
	vm.createContext(c);
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../../docs/directory.js"), "utf8"), c);
	c.G = { npcs: require("../../design/npcs").npcs, docs: c.docs };
	const game = fs.readFileSync(path.join(__dirname, "../../js/game.js"), "utf8");
	vm.runInContext(
		game.slice(game.indexOf("function get_npc_interaction_context("), game.indexOf("var last_loader")),
		c,
	);
	const context = c.get_npc_interaction_context({ npc: "citizen22", role: "market_patron" });
	assert.equal(context.key, "merrit");
	assert.equal(context.definition.article, "npc-merrit");
	assert.equal(context.definition.proximity, true);
	const html = fs.readFileSync(path.join(__dirname, "../../js/html.js"), "utf8");
	vm.runInContext(html.slice(html.indexOf("function merrit_spacing_html(")), c);
	let conversations = 0,
		guides = 0,
		dialogueVisible = true;
	c.merrit_item_preview = () => "parcel preview";
	c.render_interaction = (data) => {
		conversations++;
		c.rendered_interaction = data;
	};
	c.open_guide = (article) => {
		assert.equal(article, "npc-merrit");
		guides++;
	};
	c.get_guide_url = (article) => article;
	c.$ = () => ({ length: dialogueVisible ? 1 : 0, html() {} });
	c.render_merrit_interaction();
	assert.equal(conversations, 1);
	assert.equal(guides, 0);
	assert.equal(c.rendered_interaction.skin, c.G.npcs.citizen22.skin);
	assert.equal(c.rendered_interaction.button, "INFO");
	c.rendered_interaction.onclick();
	assert.equal(guides, 1);
	c.merrit_status_received({
		last: { name: "Shop", at: Date.now(), shells: 1, reason: "Your shop stayed stocked and left the neighbors room." },
	});
	c.rendered_interaction.onclick2();
	assert.ok(c.rendered_interaction.message.includes("1 SHELL"));
	assert.ok(c.rendered_interaction.message.includes("Your shop stayed stocked"));
	dialogueVisible = false;
	const previous = conversations;
	c.merrit_status_received({ reasons: [] });
	assert.equal(conversations, previous);
	c.no_html = true;
	c.$ = () => {
		throw Error("Headless status touched the DOM");
	};
	c.merrit_status_received({ reasons: [{ code: "closed" }] });
	c.render_merrit_info();
	c.render_merrit_interaction();
	assert.equal(conversations, previous);
	assert.equal(guides, 1);
});

test("handoff requires physical proximity, a clear path, and the same instance", () => {
	const h = harness();
	assert.equal(config.radius, 600);
	h.npc.x = h.p.x = 600;
	assert.equal(h.context.market_patron_can_visit(h.npc, h.p), true);
	h.npc.x = h.p.x = 600.001;
	assert.equal(h.context.market_patron_can_visit(h.npc, h.p), false);
	h.npc.x = 0;
	h.p.x = 32;
	assert.equal(h.context.market_patron_can_visit(h.npc, h.p), true);
	h.p.x = 32.001;
	assert.equal(h.context.market_patron_can_visit(h.npc, h.p), false);
	h.p.x = 0;
	h.p.in = "elsewhere";
	assert.equal(h.context.market_patron_can_visit(h.npc, h.p), false);
	h.p.in = "main";
	h.context.can_move = () => false;
	assert.equal(h.context.market_patron_can_visit(h.npc, h.p), false);
});
