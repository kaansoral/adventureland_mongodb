const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { load, read, socketHandler, localize } = require("./helpers/server_vm");
const G = require("./helpers/design");
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
	const p = {
		real_id: "a",
		owner: "owner",
		name: "A",
		map: "zone_a",
		in: "zone_a",
		socket: { id: "a", generated_protocol: 1, emit() {} },
		s: {},
	};
	const run = {
		key: "run",
		members: [
			{ character: "a", owner: "owner", name: "A" },
			{ character: "b", owner: "owner", name: "B" },
			{ character: "c", owner: "other", name: "C" },
		],
		floors: ["zone_a", "zone_b"],
		completed: [],
		expires: Date.now() + 24000,
	};
	const c = vm.createContext({
		G,
		Date,
		Math,
		Set,
		Map,
		console,
		Dev: false,
		Prod: false,
		crypto: require("node:crypto"),
		generated_runs: { run },
		generated_maps: {
			zone_a: { record: run, floor: { definition: { generated: { floor: 0 } } } },
			zone_b: { record: run, floor: { definition: { generated: { floor: 1 } } } },
		},
		players: { a: p },
		get_player: (name) => (name === p.name ? p : null),
		check_player: () => true,
		db: {},
		instances: {},
		projectiles: {},
		freeze_instance() {},
		resume_frozen_instance() {},
		cave_publish() {},
		cave_apply() {},
		cave_say() {},
		TIMEO: { EU: 1, US: -5, ASIA: 7 },
	});
	load(c, "node/logic/generated_maps.js", [
		"generated_clock",
		"generated_entry",
		"generated_member",
		"generated_can_enter",
		"generated_magiport_allowed",
		"generated_daily_window",
	]);
	load(c, "node/logic/cave_of_many_dreams.js", [
		"cave_random",
		"cave_pick",
		"cave_shuffle",
		"cave_receipt",
		"cave_reply_label",
		"cave_dialogue_ref",
		"cave_set_side",
		"cave_revival_option",
		"cave_pause",
		"cave_resume",
		"cave_credit",
		"cave_resolve_vote",
		"cave_interaction",
		"cave_hostile",
		"cave_accept_attack",
		"cave_damage",
	]);
	return { c, p, run };
}
test("generated travel checks a real destination and fixed membership", () => {
	const { c, p, run } = fixture();
	assert.equal(c.generated_can_enter(p, undefined), false);
	assert.equal(c.generated_can_enter(p, { name: "zone_b", map: "zone_b" }), false);
	run.completed[0] = true;
	assert.equal(c.generated_can_enter(p, { name: "zone_b", map: "zone_b" }), true);
	run.members[0].left = true;
	assert.equal(c.generated_can_enter(p, { name: "zone_b", map: "zone_b" }), false);
	assert.equal(c.generated_can_enter(p, { name: "main", map: "main" }), false);
	assert.equal(c.generated_magiport_allowed(p, { map: "main" }), false);
});
test("home-server midnight uses the same offsets as the game clock", () => {
	const { c } = fixture();
	for (const [home, before, reset] of [
		["USII", "2026-09-14T04:59:59Z", "2026-09-14T05:00:00Z"],
		["EUI", "2026-09-13T22:59:59Z", "2026-09-13T23:00:00Z"],
		["ASIAI", "2026-09-13T16:59:59Z", "2026-09-13T17:00:00Z"],
	]) {
		assert.equal(c.generated_daily_window(home, Date.parse(before)).resets, Date.parse(reset));
		assert.equal(c.generated_daily_window(home, Date.parse(reset)).resets, Date.parse(reset) + 86400000);
	}
});
test("real interaction handler replies to its originating socket after async work", async () => {
	const { c, p } = fixture();
	let resolve;
	const events = [];
	c.socket = { id: "a", emit: (event, data) => events.push({ event, data }) };
	c.players.a = p;
	c.cave_interaction = () => new Promise((r) => (resolve = r));
	const handler = socketHandler(c, "interaction");
	handler({ type: "cave", action: "enter", request_id: "original" });
	c.current_socket = {
		emit() {
			throw Error("wrong socket");
		},
	};
	resolve({ run: "new" });
	await new Promise(setImmediate);
	assert.equal(events[0].data.request_id, "original");
	assert.equal(events[0].data.success, true);
});
test("three characters get independent votes; timeout ties use the published fallback", async () => {
	const { c, p, run } = fixture();
	const effects = [];
	c.cave_apply = (r, room, option) => effects.push(option.effect);
	run.cave = {
		vote: {
			id: "vote",
			room: {},
			deadline: Date.now() + G.events.dreams.vote_ms,
			voters: ["a", "b", "c"],
			votes: {},
			options: [
				{ id: "yes", effect: "gift" },
				{ id: "no", effect: "leave" },
			],
			fallback: "leave",
		},
	};
	assert.equal((await c.cave_interaction(p, { action: "vote", choice: "vote", option: "yes" })).resolved, undefined);
	p.real_id = "b";
	await c.cave_interaction(p, { action: "vote", choice: "vote", option: "no" });
	c.cave_resolve_vote(run, Date.now() + G.events.dreams.vote_ms + 1);
	assert.deepEqual(effects, ["leave"]);
	await assert.rejects(c.cave_interaction(p, { action: "vote", choice: "bad", option: "yes" }), /stale_choice/);
});
test("neutral disputes do not attack bystanders; only their own reflected spell kills Dark Mages", () => {
	const { c } = fixture(),
		a = { id: "dark", type: "cave_darkmage", in: "zone_a", hp: 1000, zone_actor: { side: "enemy", run: "run" } },
		p = { in: "zone_a" };
	assert.equal(c.cave_accept_attack(a, {}), false);
	assert.equal(c.cave_damage(p, a, { reflected_from: "dark" }, 1), 1000);
	assert.equal(c.cave_hostile({ in: "zone_a", zone_actor: { side: "duel_left" } }, p), false);
	assert.equal(c.cave_hostile({ in: "zone_a", zone_actor: { side: "enemy" } }, p), true);
});
test("cave chases follow a moving player, respect walls and ignore a superseded detour", () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters[0]);
	const messages = [],
		callbacks = {};
	Object.assign(c, {
		__dirname: path.resolve(__dirname, ".."),
		path,
		SHARE_ENV: {},
		Worker: class {
			on(event, callback) {
				callbacks[event] = callback;
			}
		},
		amap_data: {},
		smap_data: {},
		total_moves: 0,
		Place: "server",
		perfc: { roam_ops: 0 },
		workers: [{ postMessage: (data) => messages.push(data) }],
		instance_is_frozen: () => false,
		is_invinc: () => false,
		is_invis: () => false,
		can_attack: () => false,
	});
	const definitions = { ...c.G, geometry: { zone_a: { x_lines: [], y_lines: [] } } };
	for (const file of ["common/js/common_functions.js", "js/old_common_functions.js"]) vm.runInContext(read(file), c);
	c.G = definitions;
	load(c, "node/server.js", ["start_moving_element"]);
	load(c, "node/server_functions.js", ["new_worker"]);
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_move", "cave_actor_tick", "cave_face"]);
	c.generated_maps.zone_a.floor.worker = 0;
	const actor = c.cave_spawn(run, room, "cave_rat", "enemy", 0);
	Object.assign(actor, { x: 800, y: 1000, speed: 60, range: 40 });
	actor.zone_actor.idle = false;
	room.actors = [actor];
	room.enemies = [actor];
	room.engaged = true;
	c.instances.zone_a = { monsters: { [actor.id]: actor } };
	c.new_worker(0);
	c.cave_actor_tick(run, actor, 10000, [p]);
	assert.equal(actor.going_x, 1000);
	assert.equal(actor.moving, true);
	p.x = 900;
	p.y = 1100;
	c.cave_actor_tick(run, actor, 10300, [p]);
	assert.equal(actor.going_x, 900, "changes course before reaching the old destination");
	assert.equal(actor.going_y, 1100);
	assert.ok(actor.vx > 0 && actor.vy > 0);
	p.x = 1250;
	p.y = 1000;
	c.G.geometry.zone_a.x_lines = [[1100, 800, 1200]];
	c.cave_actor_tick(run, actor, 11000, [p]);
	assert.equal(messages.length, 1, "a wall requests a detour, never a straight chase through it");
	c.cave_actor_tick(run, actor, 11700, [p]);
	assert.equal(messages.length, 1, "does not pile up worker requests");
	p.x = 950;
	p.y = 1050;
	c.cave_actor_tick(run, actor, 12000, [p]);
	assert.equal(actor.going_x, 950, "a clear route replaces the pending detour");
	callbacks.message({
		type: "monster_move",
		in: actor.in,
		id: actor.id,
		path_token: messages[0].path_token,
		move: [800, 780],
	});
	assert.equal(actor.going_x, 950, "late detour cannot restore the obsolete destination");
	p.x = 815;
	p.y = 1000;
	c.cave_actor_tick(run, actor, 12300, [p]);
	assert.equal(actor.moving, false, "stops beside the target instead of running past it");
	assert.equal(actor.vx, 0);
});
test("cave definitions contain 50 encounters and bounded reward budgets", () => {
	const { c, p, run } = chestFixture(),
		events = G.events.dreams;
	assert.equal(events.encounters.length, 50);
	for (const [group, count] of [
		["mixed", 25],
		["bad", 5],
		["positive", 20],
	])
		assert.equal(events.encounters.filter((e) => e.group === group).length, count);
	for (const e of events.encounters)
		assert.ok(e.options.length >= 5 && new Set(e.options.map((o) => o.id)).size === e.options.length, e.id);
	for (let i = 0; i < 1000; i++) c.cave_credit(run, 60000, 36);
	assert.equal(run.cave.gold, 0, "unopened chests do not fund the purse");
	assert.equal(run.cave.amber, 0);
	assert.equal(run.cave.gold_earned, events.gold_limit);
	assert.equal(run.cave.amber_earned, events.amber_limit);
	const open = socketHandler(c, "open_chest");
	for (const id of run.cave.chests) open({ id });
	assert.equal(run.cave.gold, events.gold_limit);
	assert.equal(run.cave.amber, events.amber_limit);
	assert.equal(p.gold, 100, "purse collection does not also credit carried gold");
});
test("socket-driven cave visuals are safe with a throwing fake PIXI runtime", () => {
	const c = vm.createContext({
		no_graphics: true,
		character: {},
		G: { maps: {}, geometry: {} },
		current_map: "main",
		PIXI: new Proxy(
			{},
			{
				get() {
					throw Error("PIXI touched");
				},
			},
		),
		call_code_function() {},
	});
	vm.runInContext(read("js/generated_zones.js"), c);
	c.receive_cave_state({ type: "choice", state: { choice: { id: "v" } } });
	c.render_cave_keeper();
	c.render_cave_status();
	c.render_cave_choice();
	c.receive_cave_state({
		type: "chat",
		state: {},
		chat: { text: "Hello", text_message: { phrase: "event.dreams.traveler.Pip.says.0" } },
	});
	c.receive_cave_state({
		type: "cue",
		state: {},
		cue: { text: "Move away", text_message: { phrase: "server.cave.cue_sentinel" } },
	});
	c.decorate_cave_door({});
	c.cave_manual("enter");
	c.cave_entry_animation({ names: ["A"], duration: 1800 });
	c.cave_entry_animation({ key: "test", cancel: true });
	c.finish_cave_entry();
	c.cave_transport_animation("transport", { to: "zone_b" });
	c.draw_cave_entrance();
	c.decorate_cave_gate({});
	c.cave_gate_piece("outside", 0, 0, 16, 16);
	c.update_cave_hud(true);
	c.update_cave_info();
	c.render_cave_stairs();
	c.cave_transport_failed({ reason: "seal_closed" });
	c.update_cave_doors();
	c.decorate_cave_chest({});
	c.draw_cave_chests();
	c.cave_reward_feedback({});
	c.cave_receive_rewards({ run: "test", rewards: [] });
	c.cave_show_reward();
	c.chests = {};
	load(c, "js/game.js", ["add_chest"]);
	c.add_chest({ id: "test", chest: "cavechest", map: "main", x: 10, y: 20 });
	assert.equal(c.chests.test.chest, "cavechest");
	load(c, "js/game.js", ["add_animatable"]);
	assert.equal(c.add_animatable("dreams_gate", {}), undefined);
	c.chests.test = { id: "test" };
	Object.assign(c, {
		tut() {},
		resolve_deferred() {},
		draw_trigger: (fn) => fn(),
		socket: {
			on(event, handler) {
				c.opened = handler;
			},
		},
	});
	const source = read("js/game.js"),
		begin = source.indexOf('socket.on("chest_opened"'),
		end = source.indexOf('socket.on("cm"', begin);
	vm.runInContext(source.slice(begin, end), c);
	c.opened({ id: "test", opener: "someone" });
	assert.equal(c.chests.test, undefined);

	c.prune_generated_maps();
	assert.ok(c.character.cave);
	c.receive_cave_state({ type: "ended" });
	assert.equal(c.character.cave, null);
});

test("cave entry waits for the map handoff and releases input without another draw frame", () => {
	let now = 1000;
	const handlers = {};
	class Graphics {
		clear() {}
		beginFill() {}
		drawRect() {}
		endFill() {}
		destroy() {
			this._destroyed = true;
		}
	}
	const pivot = {
		x: 0,
		y: 0,
		set(x, y) {
			this.x = x;
			this.y = y;
		},
	};
	const character = { name: "A", real_x: 830, real_y: 1230, pivot, animations: {}, addChild() {} };
	const c = vm.createContext({
		Date: class extends Date {
			static now() {
				return now;
			}
		},
		no_graphics: false,
		character,
		current_map: "main",
		current_in: "main",
		tutorial_map: null,
		really_old: new Date(0),
		G: { maps: { main: {}, zone_test: { data: {} } }, geometry: { zone_test: {} }, npcs: { dreamkeeper: {} } },
		PIXI: { Graphics },
		animatables: {},
		socket: {
			on(event, fn) {
				handlers[event] = fn;
			},
		},
		get_player: () => character,
		start_animation(sprite, name) {
			sprite.animations[name] = {};
		},
		stop_animation(sprite, name) {
			delete sprite.animations[name];
		},
		render_interaction() {},
		h_shake() {},
		v_shake() {},
		draw_timeout() {},
		$: () => ({ length: 0, empty() {}, html() {} }),
		reflect_music() {},
		resolve_deferreds() {},
		unstuck_logic() {},
		create_map() {},
		position_map() {},
		new_map_logic() {},
		handle_entities() {},
		call_code_function() {},
	});
	localize(c);
	vm.runInContext(read("js/generated_zones.js"), c);
	c.prune_generated_maps = () => {};
	const source = read("js/game.js"),
		start = source.indexOf('socket.on("new_map"');
	vm.runInContext(source.slice(start, source.indexOf('socket.on("start"', start)), c);
	c.cave_entry_animation({ key: "entry", names: ["A"], duration: 1800 });
	now += 1800;
	c.draw_cave_entrance();
	assert.deepEqual([pivot.x, pivot.y], [14, 82]);
	now += 2500;
	c.draw_cave_entrance();
	assert.deepEqual([pivot.x, pivot.y], [14, 82], "does not snap back while admission finishes");
	handlers.new_map({ name: "zone_test", in: "zone_test", x: 400, y: 304, m: 2, effect: 1, entities: {} });
	assert.equal(character.cave_entering, undefined, "map arrival releases input even before the next draw");
	assert.deepEqual([pivot.x, pivot.y], [0, 0]);
	assert.equal(c.cave_entry_scenes.length, 0);
	assert.equal(character.tp, 1, "keeps the native arrival effect");
	c.current_map = "main";
	delete character.tp;
	c.cave_entry_animation({ key: "retry", names: ["A"], duration: 1800 });
	c.cave_entry_animation({ key: "retry", cancel: true });
	assert.equal(character.cave_entering, undefined, "a rejected admission releases input immediately");
	assert.equal(c.cave_entry_scenes.length, 0);
});

test("cave loot appears on receipt without queuing or replaying repeated snapshots", () => {
	let now = 10000;
	const feedback = [],
		rewards = [],
		note = {
			toggle(visible) {
				this.visible = visible;
				return this;
			},
			html(value) {
				this.contents = value;
				return this;
			},
			data(key, value) {
				if (value === undefined) return this[key];
				this[key] = value;
				return this;
			},
		};
	const c = vm.createContext({
		no_graphics: false,
		character: {},
		Date: { now: () => now },
		call_code_function() {},
		reflect_music() {},
		$: (selector) => (selector === ".cave-reward-note" ? note : { length: 0 }),
	});
	vm.runInContext(read("js/generated_zones.js"), c);
	c.update_cave_doors = c.update_cave_info = () => {};
	c.update_cave_hud = () => c.cave_show_reward();
	c.cave_reward_feedback = (reward) => feedback.push({ id: reward.id, at: now });
	c.cave_reward_html = (reward) => `${reward.id}:${reward.where}`;
	const receive = () => c.receive_cave_state({ type: "state", state: { run: "test", rewards } });
	for (let id = 1; id <= 5; id++) {
		now += 100;
		rewards.push({ id, where: "purse", amber: 1 });
		receive();
		assert.equal(feedback.length, id, "every chest triggers feedback immediately");
		assert.deepEqual(feedback.at(-1), { id, at: now });
		assert.equal(note.contents, `${id}:purse`, "the newest chest replaces the banner immediately");
		assert.equal(note.visible, true);
		assert.equal(c.cave_notice_until, now + 3500);
	}
	const until = c.cave_notice_until;
	now += 100;
	receive();
	assert.equal(feedback.length, 5, "repeated snapshots do not replay rewards");
	assert.equal(c.cave_notice_until, until, "repeated snapshots do not extend the banner");
	now = until + 1;
	c.cave_show_reward();
	assert.equal(note.visible, false, "the last banner expires without showing an older reward");
	assert.equal(feedback.length, 5);
	now += 3500;
	receive();
	assert.equal(note.visible, false, "old receipts stay hidden after expiry");
	assert.equal(feedback.length, 5);

	rewards.push({ id: 6, where: "mail_pending" });
	receive();
	const mailUntil = c.cave_notice_until;
	now += 100;
	rewards[5] = { id: 6, where: "mail" };
	receive();
	assert.equal(note.contents, "6:mail", "delivery updates still refresh the visible reward");
	assert.equal(feedback.length, 6, "delivery updates do not replay loot feedback");
	assert.equal(c.cave_notice_until, mailUntil);
	c.receive_cave_state({ type: "returned", state: { run: "test", rewards } });
	assert.equal(feedback.length, 6, "returning does not replay old loot receipts");
	assert.equal(note.visible, false);
	rewards.push({ id: 7, where: "purse", amber: 1 });
	receive();
	assert.equal(feedback.length, 7, "new loot still appears immediately after returning");
	assert.equal(note.contents, "7:purse");
});

test("a first paused cave snapshot opens its choice without reopening a dismissed conversation", () => {
	const shown = [];
	const c = vm.createContext({
		no_graphics: false,
		character: {},
		call_code_function() {},
		reflect_music() {},
		$: () => ({ length: 0 }),
	});
	vm.runInContext(read("js/generated_zones.js"), c);
	for (const name of ["cave_receive_rewards", "update_cave_doors", "update_cave_hud", "update_cave_info"])
		c[name] = () => {};
	c.render_cave_choice = () => {
		c.cave_open_choice = c.cave_client_state.choice.id;
		shown.push(c.cave_open_choice);
	};
	const state = { paused: true, choice: { id: "one", votes: {} } };
	c.receive_cave_state({ type: "state", state });
	c.receive_cave_state({ type: "state", state });
	assert.deepEqual(shown, ["one"], "a repeated snapshot respects the player's dismissal");
	c.receive_cave_state({ type: "state", state: { paused: true, choice: { id: "two", votes: {} } } });
	assert.deepEqual(
		shown,
		["one", "two"],
		"a new pending vote is visible even without its separate choice notification",
	);
});

test("Cave Info follows proximity and map changes without waiting for another event", () => {
	const html = {},
		calls = [];
	const c = vm.createContext({
		G: {
			events: { dreams: {} },
			maps: {
				main: { npcs: [{ id: "dreamkeeper", position: [816, 1200] }] },
				zone_cave: { generated: { zone: "dreams" } },
				winterland: {},
			},
			items: {},
		},
		no_graphics: false,
		no_html: false,
		gameplay: "normal",
		S: {},
		quirks: {},
		proximity_guides: true,
		interaction_contexts: [],
		interaction_context: null,
		character: { real_x: 816, real_y: 1200 },
		current_map: "winterland",
		anniversary_visible_skill: false,
		anniversary_live_event: () => null,
		anniversary_can_visit: () => false,
		render_event_announcements() {},
		reposition_ui() {},
		item_container: () => "<span></span>",
		$: (selector) => ({
			length: 0,
			html(value) {
				html[selector] = value;
				return this;
			},
			hide() {
				return this;
			},
			css() {
				return this;
			},
			append() {
				return this;
			},
			toggle() {
				return this;
			},
			text() {
				return this;
			},
			remove() {
				return this;
			},
		}),
	});
	localize(c);
	load(c, "js/old_common_functions.js", ["point_distance"]);
	vm.runInContext(read("js/generated_zones.js"), c);
	load(c, "js/html.js", ["render_server"]);
	c.cave_load_visit = () => {};
	c.cave_show_reward = () => {};
	const render = c.render_server;
	c.render_server = () => {
		calls.push(c.current_map);
		render();
	};
	c.render_server();
	assert.doesNotMatch(html["#serverinfo"], /cave-info-button/);
	c.current_map = "main";
	c.update_cave_hud(true);
	assert.match(html["#serverinfo"], /cave-info-button/);
	c.character.real_x += 241;
	c.update_cave_hud(true);
	assert.doesNotMatch(html["#serverinfo"], /cave-info-button/);
	c.current_map = "zone_cave";
	c.update_cave_hud(true);
	assert.match(html["#serverinfo"], /cave-info-button/);
	c.current_map = "winterland";
	c.cave_client_state = { run: "stale" };
	c.update_cave_hud(true);
	assert.doesNotMatch(html["#serverinfo"], /cave-info-button/);
	assert.equal(calls.length, 5);
	c.no_graphics = true;
	c.current_map = "main";
	c.character.real_x = 816;
	c.update_cave_hud(true);
	assert.equal(calls.length, 5, "headless characters do not render buttons");
});

test("a cave gold letter can be claimed once by its assigned character", async () => {
	const { transactions } = require("./helpers/server_vm");
	const { c, p } = fixture();
	const events = [];
	p.gold = 10;
	c.mode = {};
	c.resend = () => {};
	c.can_add_item = () => true;
	c.cache_item = (i) => i;
	c.add_item = () => {
		throw Error("Gold must not use inventory space");
	};
	c.randomStr = () => require("node:crypto").randomBytes(8).toString("hex");
	c.socket = { id: "a", emit: (event, data) => events.push(data) };
	p.socket = c.socket;
	const mail = {
		_id: "ML_cave:test",
		owner: [p.owner],
		character: p.real_id,
		cave_award: true,
		item: true,
		taken: false,
		info: { item: JSON.stringify({ gold: 1234 }) },
	};
	const store = transactions(c, [mail]);
	c.get = async (id) => clone(store.records.get(id));
	const handler = socketHandler(c, "mail_take_item");
	handler({ id: mail._id, request_id: "one" });
	await new Promise(setImmediate);
	await new Promise(setImmediate);
	assert.equal(p.gold, 1244);
	assert.equal(events.at(-1).success, true);
	handler({ id: mail._id, request_id: "two" });
	await new Promise(setImmediate);
	await new Promise(setImmediate);
	assert.equal(p.gold, 1244);
	assert.equal(events.at(-1).failed, true);
});

function restartFixture() {
	const { c, p, run } = fixture();
	const records = new Map();
	for (const owner of ["owner", "other"])
		records.set("daily:dreams:" + owner, {
			_id: "daily:dreams:" + owner,
			owner,
			run: run.key,
			server: "SR_USII",
			boot: "before",
			state: "active",
			resets: Date.now() + 86400000,
			members: run.members.filter((m) => m.owner === owner).map((m) => "member:" + m.character),
		});
	for (const m of run.members)
		records.set("member:" + m.character, { _id: "member:" + m.character, run: run.key, active: true });
	const matches = (doc, query) =>
		Object.entries(query).every(([key, value]) => (value?.$in ? value.$in.includes(doc[key]) : doc[key] === value));
	const collection = {
		async findOne(query) {
			const doc = [...records.values()].find((doc) => matches(doc, query));
			return doc ? clone(doc) : null;
		},
		async updateOne(query, update) {
			const doc = [...records.values()].find((doc) => matches(doc, query));
			if (doc) Object.assign(doc, update.$set);
			return { matchedCount: doc ? 1 : 0 };
		},
		async updateMany(query, update) {
			assert.ok(query._id.$in.length <= 3, "membership writes stay bounded");
			for (const doc of records.values()) if (matches(doc, query)) Object.assign(doc, update.$set);
		},
		async deleteMany(query) {
			for (const [id, doc] of records) if (matches(doc, query)) records.delete(id);
		},
	};
	Object.assign(c, {
		db: { collection: () => collection },
		server_id: "SR_USII",
		Server: { info: { cave_boot: "before" } },
		region: "US",
		server_name: "II",
		log_trace() {},
		get: async () => c.Server,
	});
	p.p = { home: "USII" };
	return { c, p, run, records, collection };
}

test("a new server session restores interrupted visits, including when queried from another server", async () => {
	const { c, p, records } = restartFixture();
	assert.equal((await c.generated_visit_info(p)).available, false, "the running visit remains consumed");
	c.Server.info.cave_boot = "after";
	c.server_id = "SR_EUI";
	assert.equal((await c.generated_visit_info(p)).available, true);
	assert.equal(records.has("daily:dreams:owner"), false);
	assert.equal(records.get("member:a").active, false);
	assert.equal(records.get("member:b").active, false);
	assert.equal(records.get("member:c").active, true, "another account is reconciled independently");
	assert.equal((await c.generated_visit_info(p)).available, true, "recovery is idempotent");
});

test("explicit departure consumes the visit even if the server restarts later", async () => {
	const { c, p, run, records } = restartFixture();
	for (const member of run.members.filter((m) => m.owner === p.owner)) c.generated_leave_member(run, member, "exit");
	await new Promise(setImmediate);
	c.Server.info.cave_boot = "after";
	assert.equal((await c.generated_visit_info(p)).available, false);
	assert.equal(records.get("daily:dreams:owner").state, "active");
});

test("graceful restart refunds only accounts still inside and waits for the write", async () => {
	const { c, run, records, collection } = restartFixture();
	run.floors = [];
	c.generated_leave_member(run, run.members[2], "exit");
	await new Promise(setImmediate);
	c.get_player = () => null;
	const remove = collection.deleteMany;
	let finish;
	collection.deleteMany = async (query) => {
		await new Promise((resolve) => {
			finish = resolve;
		});
		return remove(query);
	};
	c.destroy_generated_run(run.key, "restart");
	assert.equal(c.cave_pending(), true);
	await new Promise(setImmediate);
	assert.equal(records.get("daily:dreams:owner").state, "refunding");
	finish();
	await new Promise(setImmediate);
	assert.equal(c.cave_pending(), false);
	assert.equal(records.has("daily:dreams:owner"), false);
	assert.equal(records.get("daily:dreams:other").state, "active");
});

test("an interrupted refund or entry reservation recovers without erasing a newer visit", async () => {
	const { c, p, records, collection } = restartFixture();
	c.Server.info.cave_boot = "after";
	const remove = collection.deleteMany;
	collection.deleteMany = async () => {
		throw Error("write interrupted");
	};
	await assert.rejects(c.generated_visit_info(p), /write interrupted/);
	assert.equal(records.get("member:a").active, false);
	assert.equal(records.get("daily:dreams:owner").state, "refunding");
	collection.deleteMany = remove;
	assert.equal((await c.generated_visit_info(p)).available, true);
	const other = { ...p, owner: "other" };
	records.get("daily:dreams:other").state = "preparing";
	records.get("member:c").active = false;
	assert.equal((await c.generated_visit_info(other)).available, true);
	records.set("daily:dreams:owner", {
		_id: "daily:dreams:owner",
		run: "new",
		state: "active",
		boot: "after",
		server: "SR_USII",
		members: ["member:a"],
	});
	await c.generated_refund_visit(p.owner, "run");
	assert.equal(records.get("daily:dreams:owner").run, "new");
});

test("daily admission stays limited in production; Dev permits repeat visits but keeps character locks", async () => {
	const { c, p } = fixture();
	const members = [p, { ...p, name: "B", real_id: "b" }, { ...p, name: "C", real_id: "c", owner: "other" }];
	for (const player of members)
		Object.assign(player, {
			map: "main",
			in: "main",
			p: { home: "USII" },
			level: 25,
			socket: { generated_protocol: 1 },
		});
	const claims = new Map();
	const collection = {
		async findOne(query) {
			return claims.get(query._id);
		},
		async updateOne(query, update) {
			if (claims.has(query._id)) throw Object.assign(Error("duplicate"), { code: 11000 });
			claims.set(query._id, update.$set);
		},
		async updateMany(query, update) {
			let matchedCount = 0;
			for (const id of query._id.$in)
				if (claims.get(id)?.run === query.run) {
					Object.assign(claims.get(id), update.$set);
					matchedCount++;
				}
			return { matchedCount };
		},
		async deleteMany(query) {
			for (const id of query._id.$in) if (claims.get(id)?.run === query.run) claims.delete(id);
		},
	};
	Object.assign(c, {
		generated_runs: {},
		generated_openings: new Set(),
		crypto: require("node:crypto"),
		db: { collection: () => collection },
		region: "US",
		server_name: "II",
		server_id: "SR_USII",
		Server: { info: { cave_boot: "boot" } },
		generated_party: () => members,
		can_walk: () => true,
		simple_distance: () => 0,
		get_player: (name) => members.find((p) => p.name === name),
		prepare_generated_run: async () => [],
		cave_enter_effect: async () => {},
		install_generated_run: (run) => {
			run.floors = ["floor"];
		},
		cave_start() {},
		generated_transport() {},
	});
	load(c, "node/logic/generated_maps.js", ["generated_admission", "open_generated_zone", "generated_visit_info"]);
	c.G = { ...G, events: { ...G.events, dreams: { ...G.events.dreams, disabled: true } } };
	await assert.rejects(c.open_generated_zone(p), /cave_closed/);
	assert.equal(claims.size, 0, "disabled admission cannot consume a daily visit");
	c.G.events.dreams.disabled = false;
	await c.open_generated_zone(p);
	assert.deepEqual([...claims.keys()].filter((id) => id.startsWith("daily:")).sort(), [
		"daily:dreams:other",
		"daily:dreams:owner",
	]);
	assert.equal(claims.size, 5);
	claims.delete("daily:dreams:other");
	await assert.rejects(c.open_generated_zone(p), /daily_opening_used/);
	assert.equal(claims.has("daily:dreams:other"), false, "failed admission returns its new reservation");
	assert.equal(claims.get("daily:dreams:owner").state, "active", "another account's used visit stays used");
	assert.equal((await c.generated_visit_info(p)).available, false);
	const used = clone(claims.get("daily:dreams:owner"));
	c.Dev = true;
	assert.equal((await c.generated_visit_info(p)).unlimited, true);
	await assert.rejects(c.open_generated_zone(p), /character_already_entering/);
	const runs = new Set();
	for (let i = 0; i < 2; i++) {
		// Exit releases character claims; it never removes the daily account record.
		for (const member of members) claims.delete("member:" + member.real_id);
		runs.add((await c.open_generated_zone(p)).run);
		assert.equal((await c.generated_visit_info(p)).available, true);
		assert.deepEqual(clone(claims.get("daily:dreams:owner")), used);
		assert.equal(claims.has("daily:dreams:other"), false);
	}
	assert.equal(runs.size, 2, "repeat entry creates a new run, never reopens the old one");
	c.Prod = true;
	assert.equal((await c.generated_visit_info(p)).available, false);
	await assert.rejects(c.open_generated_zone(p), /daily_opening_used/);
	c.Prod = false;
	for (const member of members) claims.delete("member:" + member.real_id);
	const cancelled = [];
	c.xy_emit = (player, event, data) => cancelled.push({ event, data });
	c.install_generated_run = () => {
		throw Error("install_failed");
	};
	await assert.rejects(c.open_generated_zone(p), /install_failed/);
	assert.equal(cancelled.length, 1);
	assert.equal(cancelled[0].event, "ui");
	assert.equal(
		cancelled[0].data.cancel,
		true,
		"failure after the entrance animation tells clients to restore the party",
	);
});

test("Nera can use the doorway when a fallen character is beside a wall", () => {
	const { c, p, run } = fixture();
	c.G = { ...G, maps: { zone_a: { spawns: [[100, 200]] } } };
	run.cave = { rooms: [], serial: 0, vote: null };
	c.safe_xy_nearby = () => false;
	c.cave_spawn = (r, room) => {
		assert.equal(room.x, 100);
		assert.equal(room.y + 48, 200);
		return {};
	};
	c.cave_begin_vote = (r) => {
		r.cave.vote = {};
	};
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_offer_rescue"]);
	c.cave_offer_rescue(run, p);
	assert.equal(run.cave.vote.fallback, "revive_landing");
	assert.equal(run.cave.rooms.length, 1);
});

test("passing a rescue or a dispute lets the NPC fight continue", () => {
	const { c, run } = fixture();
	run.cave = { gold: 0, amber: 0, flags: {} };
	c.cave_complete = () => {
		throw Error("The fight must continue");
	};
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_apply"]);
	const rescue = { rescue: true, npc: { name: "Rin" }, actors: [], encounter: { group: "mixed" } };
	c.cave_apply(run, rescue, { effect: "leave" });
	assert.equal(rescue.decision, "watch");
	assert.equal(rescue.saving, false);
	const dispute = {
		npc: { name: "Rin", zone_actor: {} },
		rival: { name: "Kell", zone_actor: {} },
		encounter: { group: "mixed" },
	};
	c.cave_apply(run, dispute, { effect: "leave" });
	assert.equal(dispute.conflict, true);
	assert.equal(dispute.npc.zone_actor.prey, dispute.rival);
	assert.equal(dispute.rival.zone_actor.prey, dispute.npc);
});

test("generated doors reach the walkable threshold and the return door performs Exit", async () => {
	const { c, p, run } = fixture();
	const layout = require("../logic/dream_layout");
	load(c, "adventure_functions.js", ["process_map"]);
	const [floor] = layout.compileDungeon("door-regression", "0123456789abcdef01234567", 0, c.process_map);
	for (const info of floor.manifest) assert.ok(!info.definition.safe);
	const door = floor.definition.doors[0];
	assert.equal(door[1], floor.definition.spawns[0][1] - 48);
	assert.equal(door[2], 96);
	assert.equal(door[3], 80);
	const animation = floor.geometry.animations[0];
	assert.ok(animation);
	assert.deepEqual(floor.geometry.tiles[animation[0]], ["custom_a", 0, 0, 16, 16]);
	const base = floor.geometry.groups.flat().find((g) => g[1] === animation[1] && g[2] === animation[2] + 2);
	assert.deepEqual(floor.geometry.tiles[base[0]], ["dungeon", 16, 304, 16, 32]);
	c.G = Object.assign({}, G, { maps: { zone_a: floor.definition } });
	p.x = door[0];
	p.y = door[1] + 4;
	c.can_walk = () => true;
	c.is_door_close = () => true;
	c.can_use_door = () => true;
	let exits = 0;
	c.cave_settle_purse = () => {};
	c.generated_exit = () => {
		exits++;
	};
	load(c, "node/logic/generated_maps.js", ["generated_use_door"]);
	await c.generated_use_door(p, { to: "main", s: 0 });
	assert.equal(exits, 1);
	c.can_use_door = () => false;
	await assert.rejects(c.generated_use_door(p, { to: "main", s: 0 }), /transport_cant_reach/);
	assert.equal(exits, 1);
	// The menu Exit remains available without a nearby doorway, including after death.
	p.rip = true;
	await c.cave_interaction(p, { action: "exit" });
	assert.equal(exits, 2);
});

test("hiring the speaking NPC keeps that actor, name and appearance", () => {
	const { c, run } = fixture(),
		npc = { name: "Rin", skin: "cmale", cx: { hat: "hat1" }, zone_actor: { side: "neutral" } };
	const encounter = G.events.dreams.encounters.find((e) => e.id === "e05"),
		room = { id: "guard", npc, encounter, actors: [npc] };
	run.cave = { gold: 5000, amber: 0, flags: {}, rooms: [room], actors: new Set([npc]) };
	c.cave_complete = () => {
		room.done = true;
	};
	c.cave_credit = () => {};
	c.cave_spawn = () => {
		throw Error("The speaker must join without creating a replacement NPC");
	};
	load(c, "node/logic/cave_of_many_dreams.js", [
		"cave_apply",
		"cave_venture",
		"cave_follow_actor",
		"cave_add_follower",
	]);
	c.cave_apply(run, room, encounter.options[0]);
	assert.equal(room.npc, npc);
	assert.equal(npc.name, "Rin");
	assert.equal(npc.skin, "cmale");
	assert.equal(npc.zone_actor.side, "ally");
	assert.equal(npc.zone_actor.follow, true);
	assert.equal(npc.zone_actor.idle, false);
	assert.equal(run.cave.actors.size, 1);
	assert.equal(run.cave.gold, 3000);
	assert.equal(room.done, true);
});

test("sleeping rooms wait for actor capacity and restore the same wounded guard", () => {
	const { c, run } = fixture();
	const saved = {
		id: "guard",
		type: "cave_guard",
		map: "zone_a",
		hp: 17,
		max_hp: 100,
		x: 20,
		y: 30,
		angle: 180,
		guard: true,
		enemy: true,
		zone_actor: { run: "run", room: "room", side: "enemy", prey: null },
	};
	const room = { id: "room", map: "zone_a", actors: [], enemies: [], guards: [], saved: [saved] };
	run.cave = { rooms: [room], actors: new Set(Array.from({ length: 64 }, () => ({}))) };
	c.instances.zone_a = { monsters: {} };
	c.new_monster = () => {
		const actor = { id: "temporary" };
		c.instances.zone_a.monsters.temporary = actor;
		return actor;
	};
	c.false_socket = {};
	c.future_s = () => new Date();
	c.calculate_monster_stats = () => {};
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_resume_floor"]);
	c.cave_resume_floor(run, "zone_a");
	assert.equal(room.saved.length, 1);
	assert.equal(run.cave.actors.size, 64);
	run.cave.actors.delete(run.cave.actors.values().next().value);
	c.cave_resume_floor(run, "zone_a");
	assert.equal(room.saved, undefined);
	assert.equal(room.guards[0].id, "guard");
	assert.equal(room.guards[0].hp, 17);
	assert.equal(room.guards[0].angle, 180);
	assert.equal(run.cave.actors.size, 64);
});

function chestFixture() {
	const { c, p, run } = fixture();
	Object.assign(p, { id: "A", x: 100, y: 200, gold: 100, goldm: 2 });
	run.cave = { gold: 0, amber: 0, gold_earned: 0, amber_earned: 0, chests: new Set(), rooms: [] };
	const events = [],
		failures = [];
	p.socket.emit = (event, data) => events.push({ event, data });
	Object.assign(c, {
		socket: p.socket,
		chests: {},
		randomStr: () => require("node:crypto").randomBytes(12).toString("hex"),
		safe_xy_nearby: (map, x, y) => ({ x, y }),
		is_xy_safe: () => true,
		can_move: () => true,
		simple_distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		fail_response: (reason) => failures.push(reason),
		is_string: (v) => typeof v === "string",
		is_in_pvp: () => false,
		is_invis: () => false,
		msince: () => 0,
		W: { chest: {} },
		can_add_items: () => true,
		round: Math.round,
		server_tax: (n) => n,
		encouragement_loot: () => ({}),
		resend() {},
		to_pretty_num: String,
		log_trace(...args) {
			throw Error(args.join(" "));
		},
	});
	c.G = { ...G, maps: { ...G.maps, zone_a: {} } };
	load(c, "node/server.js", ["drop_one_thing"]);
	load(c, "node/logic/cave_of_many_dreams.js", [
		"cave_players",
		"cave_chest_point",
		"cave_send_chest",
		"cave_send_chests",
		"cave_open_chest",
	]);
	return { c, p, run, events, failures };
}

test("native loot handler protects cave chests and collects each reward once", () => {
	const { c, p, run, events, failures } = chestFixture();
	c.cave_credit(run, 4000, 2);
	const id = [...run.cave.chests][0],
		chest = c.chests[id],
		open = socketHandler(c, "open_chest");
	assert.equal(chest.chest, "cavechest");
	assert.equal(events[0].event, "drop");
	assert.equal(chest.in, p.in);
	for (const change of [
		() => {
			p.real_id = "outsider";
		},
		() => {
			p.owner = "outsider";
		},
		() => {
			p.map = "main";
		},
		() => {
			p.in = "wrong-instance";
		},
		() => {
			p.rip = true;
		},
		() => {
			p.x = chest.x + 401;
		},
		() => {
			run.paused_at = Date.now();
		},
	]) {
		const before = { real_id: p.real_id, owner: p.owner, map: p.map, in: p.in, rip: p.rip, x: p.x };
		change();
		open({ id });
		Object.assign(p, before);
		delete run.paused_at;
		assert.equal(c.chests[id], chest);
	}
	assert.equal(failures.length, 7);
	open({ id });
	assert.equal(c.chests[id], undefined);
	assert.equal(run.cave.gold, 4000);
	assert.equal(run.cave.amber, 2);
	assert.equal(run.cave.receipts.length, 1);
	assert.deepEqual(clone(events.find((e) => e.event === "chest_opened").data.cave), {
		gold: 4000,
		amber: 2,
		shared: true,
	});
	assert.equal(c.cave_open_chest(p, chest, id).failed, true);
	assert.equal(run.cave.gold, 4000);
	// Ordinary gold drops still follow the existing gold multiplier and inventory path.
	const normal = c.drop_one_thing(p, [], { gold: 10 });
	open({ id: normal });
	assert.equal(p.gold, 120);
	assert.equal(run.cave.gold, 4000);
});

test("cave disconnect and recovery save an alive character outside while retaining the return state", async () => {
	const { c, p, run } = fixture(),
		writes = [];
	run.exit_spawn = G.maps.main.spawns.findIndex((x) => x[0] === 816 && x[1] === 1200);
	assert.ok(run.exit_spawn >= 0);
	Object.assign(c, {
		clone: structuredClone,
		release_frozen_player() {},
		cave_settle_purse() {},
		db: { collection: () => ({ updateOne: async (...args) => writes.push(args) }) },
	});
	load(c, "node/logic/generated_maps.js", [
		"generated_leave_member",
		"generated_restore_health",
		"generated_disconnect",
		"generated_recover_login",
	]);
	Object.assign(p, {
		hp: 0,
		max_hp: 123,
		mp: 0,
		max_mp: 80,
		rip: true,
		rip_time: new Date(),
		moving: true,
		vx: 10,
		vy: 20,
		s: { burned: { ms: 1000 } },
		state: { map: "zone_a" },
	});
	assert.equal(c.generated_disconnect(p), true);
	assert.equal(p.map, "main");
	assert.equal(p.rip, false);
	assert.equal(p.hp, 123);
	assert.equal(p.moving, false);
	assert.deepEqual([p.x, p.y], [816, 1200]);
	assert.equal(p.state, undefined);
	assert.equal(p.s.burned, undefined);
	assert.ok(!run.members[0].left);
	assert.equal(run.members[0].disconnected.rip, true);
	assert.equal(writes.length, 0);
	assert.equal(c.generated_disconnect(p), false);
	Object.assign(p, { map: "zone_0123456789abcdef01234567_0", rip: true, hp: 0 });
	assert.equal(c.generated_recover_login(p), true);
	c.generated_restore_health(p);
	assert.equal(p.rip, false);
	assert.equal(p.hp, 123);
	assert.deepEqual([p.x, p.y], [816, 1200]);
});

test("forced conversations allow one minute while the dungeon clock stops", () => {
	const { c, run } = fixture();
	run.cave = { serial: 0, flags: {} };
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_players", "cave_begin_vote"]);
	const now = Date.now(),
		room = { id: "room", map: "zone_a", encounter: G.events.dreams.encounters[0] };
	c.cave_begin_vote(run, room);
	assert.equal(G.events.dreams.vote_ms, 60000);
	assert.ok(run.cave.vote.deadline >= now + 60000 && run.cave.vote.deadline < Date.now() + 60001);
	assert.ok(run.paused_at);
	assert.equal(c.generated_clock(run, Date.now() + 30000), run.paused_at);
});

test("cave walls leave an eight-pixel margin and each stair has a clear approach", () => {
	const layout = require("../logic/dream_layout");
	const grid = Array.from({ length: 8 }, (_, y) =>
		Array.from({ length: 8 }, (_, x) => (x >= 1 && x < 7 && y >= 1 && y < 7 ? 1 : 0)),
	);
	const edges = layout.collisionLines({ width: 8, height: 8, grid, blockers: [] });
	assert.deepEqual(edges.x_lines, [
		[24, 24, 104],
		[104, 24, 104],
	]);
	assert.deepEqual(edges.y_lines, [
		[24, 24, 104],
		[104, 24, 104],
	]);
	load(G, "adventure_functions.js", ["process_map"]);
	G.Place = "server";
	G.perfc = { roam_ops: 0 };
	G.geometry = G.geometry || {};
	for (const seed of ["door-regression", "side-clearance", "corner-web"])
		for (let index = 0; index < 3; index++) {
			const [floor] = layout.compileDungeon(seed, "0123456789abcdef01234567", 0, G.process_map, index);
			G.maps[floor.key] = floor.definition;
			G.maps[floor.key].data = floor.geometry;
			G.geometry[floor.key] = floor.geometry;
			for (const door of floor.definition.doors) {
				const [x, y] = floor.definition.spawns[door[6]];
				assert.ok(G.is_door_close(floor.key, door, x, y), seed + " close");
				assert.ok(G.can_use_door(floor.key, door, x, y), seed + " reachable");
				for (const dx of [-24, 0, 24])
					assert.ok(
						G.can_move({ map: floor.key, x, y, going_x: x + dx, going_y: y + 48, base: { h: 12, v: 8, vn: 4 } }),
						seed + " landing clearance",
					);
			}
			const web = floor.geometry.tiles.findIndex((t) => t[0] === "dungeon" && t[1] === 880 && t[2] === 200);
			assert.ok(web >= 0);
			assert.ok(floor.geometry.placements.some((p) => p[0] === web));
			assert.ok(
				!floor.geometry.groups.some((group) => group.some((p) => p[0] === web)),
				"webs belong below characters",
			);
		}
});

test("encounter-table Amber uses the cave chest and cannot be rerolled", () => {
	const { c, p, run } = chestFixture();
	run.cave.claimed = new Set();
	c.D = { drops: G.drops };
	c.create_new_item = (name, q) => ({ name, q: q || 1 });
	c.Math = Object.create(Math);
	c.Math.random = () => 0;
	c.can_add_item = () => {
		throw Error("Amber must wait in the chest");
	};
	load(c, "node/server_functions.js", ["chest_exchange"]);
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_reward", "cave_deliver"]);
	const room = { id: "npc", map: p.map, x: p.x, y: p.y };
	c.cave_reward(run, room, "cave_parcel");
	assert.equal(run.cave.chests.size, 1);
	assert.equal(run.cave.amber, 0);
	const id = [...run.cave.chests][0];
	assert.equal(c.chests[id].amber, 1);
	assert.equal(c.chests[id].items.length, 0, "shared currency requires no inventory slots");
	c.cave_reward(run, { ...room, reward: false }, "cave_parcel");
	assert.equal(run.cave.chests.size, 1);
	socketHandler(c, "open_chest")({ id });
	assert.equal(run.cave.amber, 1);
});

test("an empty floor keeps its earned chest without loading geometry", () => {
	const { c, p, run } = chestFixture();
	const floor = c.generated_maps.zone_b;
	delete c.generated_maps.zone_b;
	const id = c.cave_credit(run, 1000, 3, { map: "zone_b", x: 300, y: 400 });
	assert.equal(c.generated_maps.zone_b, undefined);
	assert.equal(c.chests[id].map, "zone_b");
	assert.equal(c.chests[id].in, "zone_b");
	assert.equal(c.chests[id].gold, 1000);
	assert.equal(c.cave_open_chest(p, c.chests[id], id).failed, true);
	c.generated_maps.zone_b = floor;
	p.map = p.in = "zone_b";
	p.x = 300;
	p.y = 400;
	c.cave_open_chest(p, c.chests[id], id);
	assert.equal(run.cave.gold, 1000);
	assert.equal(run.cave.amber, 3);
});

function encounterFixture(encounter) {
	const { c, p, run } = fixture();
	let serial = 0;
	Object.assign(p, {
		id: "A",
		is_player: true,
		x: 1000,
		y: 1000,
		hp: 500,
		max_hp: 500,
		mp: 100,
		max_mp: 100,
		attack: 100,
		frequency: 1,
		speed: 50,
		skin: "naked",
		slots: {},
		s: {},
	});
	const room = {
		id: "scene",
		kind: "encounter",
		required: true,
		floor: 0,
		map: p.map,
		x: 1000,
		y: 952,
		actors: [],
		enemies: [],
		encounter: clone(encounter),
		voted: true,
	};
	const maps = {
		...G.maps,
		zone_a: {
			spawns: [
				[1000, 1000],
				[1200, 1200],
			],
			doors: [[1200, 1200, 96, 64, "zone_b", 0, 1]],
			generated: { zone: "dreams", floor: 0 },
		},
		zone_b: { generated: { floor: 1 } },
	};
	Object.assign(run, {
		level: 50,
		manifest: [{ definition: { ...maps.zone_a, rooms: [] } }],
		cave: {
			rooms: [room],
			actors: new Set(),
			issued: 0,
			serial: 0,
			kills: {},
			flags: { tool: true, lamp: true, decoy: true, message: true },
			gold: 50000,
			amber: 30,
			claimed: new Set(),
			chests: new Set(),
			last_publish: Date.now(),
		},
	});
	Object.assign(c, {
		G: { ...G, maps },
		D: { drops: { monsters: {} } },
		false_socket: {},
		really_old: new Date(0),
		future_s: () => new Date(),
		is_xy_safe: () => true,
		safe_xy_nearby: (map, x, y) => ({ x, y }),
		simple_distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
		calculate_move: (a, x, y) => ({ x, y }),
		closest_line: () => 100,
		new_monster: (map, info) => ({
			id: "actor" + ++serial,
			type: info.type,
			map,
			in: map,
			is_monster: true,
			x: info.position[0],
			y: info.position[1],
			s: {},
			last: {},
			range: 40,
		}),
		calculate_monster_stats: (a) => Object.assign(a, a.zone_stats),
		remove_monster: (a) => {
			a.dead = true;
		},
		chest_exchange: (chest) => {
			chest.items = [];
		},
		cave_say: (r, message) => {
			(r.messages ||= []).push(typeof message === "string" ? message : message.message);
		},
		cave_credit: () => true,
		cave_reward: () => {},
		cave_item: () => {},
		cave_settle_purse: () => {},
		resend: () => {},
		invincible_logic: () => {},
		issue_monster_award: () => {},
		generated_transport: (a, map, spawn) => {
			[a.x, a.y] = Array.isArray(spawn) ? spawn : maps[map].spawns[spawn];
		},
		db: { collection: () => ({ updateMany: () => Promise.resolve({}) }) },
		cave_actor_tick: () => {},
		cave_offer_rescue: () => {},
		cave_publish: () => {},
		cave_face: () => {},
		log_trace: () => {},
	});
	load(c, "node/logic/cave_of_many_dreams.js", [
		"cave_players",
		"cave_spawn",
		"cave_pack",
		"cave_activate",
		"cave_begin_vote",
		"cave_apply",
		"cave_venture",
		"cave_follow_actor",
		"cave_add_follower",
		"cave_complete",
		"cave_tick",
		"cave_death",
		"cave_snapshot",
	]);
	c.cave_random = () => 0;
	c.cave_activate(run, room);
	return { c, p, run, room };
}

test("cave status attacks damage fresh and restored monsters through the real combat handler", () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters[0]);
	Object.assign(c, {
		Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
		min: Math.min,
		max: Math.max,
		ceil: Math.ceil,
		floor: Math.floor,
		round: Math.round,
		abs: Math.abs,
		B: { dps_tank_mult: 1, heal_multiplier: 1 },
		mode: {},
		is_invinc: () => false,
		is_invis: () => false,
		is_same: () => false,
		is_in_pvp: () => false,
		instance_is_frozen: () => false,
		damage_multiplier: G.damage_multiplier,
		distance: G.distance,
		point_distance: (a, b, x, y) => Math.hypot(a - x, b - y),
		mssince: (date) => Date.now() - date,
		ssince: (date) => (Date.now() - date) / 1000,
		xy_emit() {},
		disappearing_text() {},
		server_log() {},
		add_pdps() {},
		add_coop_points() {},
		encouragement_points() {},
		encouragement_wound() {},
		set_ghash() {},
		achievement_logic_monster_damage() {},
		achievement_logic_burn_last_hit() {},
		ccms() {},
		monster_abilities: { damage() {} },
	});
	Object.assign(p, { type: "mage", a: {}, p: {}, last: {}, crit: 0, critdamage: 0, m: 0, targets: 0 });
	c.instances.zone_a = { monsters: {}, players: {} };
	load(c, "node/server_functions.js", ["add_condition"]);
	load(c, "node/server.js", ["complete_attack", "redirect_guardians_oath_damage"]);
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_suspend_floor", "cave_resume_floor"]);
	const fresh = c.cave_spawn(run, room, "cave_wolf", "enemy");
	room.actors = [fresh];
	room.enemies = [fresh];
	c.cave_suspend_floor(run, "zone_a", room);
	c.cave_resume_floor(run, "zone_a", room);
	const restored = room.actors[0];
	for (const target of [c.cave_spawn(run, room, "cave_wolf", "enemy"), restored]) {
		assert.equal(target.socket, undefined, "a monster must not be treated as a connected player");
		Object.assign(target, { hp: 100000, max_hp: 100000, a: {}, points: {}, hits: 0, m: 0, outgoing: 0 });
		for (const condition of ["frozen", "burned", "poisoned", "woven"]) {
			const before = target.hp;
			const action = {
				hid: p.id,
				source: "attack",
				projectile: "magic",
				x: target.x,
				y: target.y,
				m: 0,
				pid: condition,
			};
			c.complete_attack(p, target, {
				attack: 1000,
				damage_type: "magical",
				atype: "attack",
				heal: false,
				positive: false,
				procs: true,
				conditions: [condition],
				apiercing: 0,
				rpiercing: 0,
				attacker: p,
				target,
				action,
				def: action,
			});
			assert.ok(target.hp < before, condition + " must not cancel its hit");
			assert.ok(target.s[condition]?.ms > 0, condition + " is applied");
		}
		// Purify uses the same handler for ordinary conditions and the Djinn's protected shell.
		target.s = { rimeshell: { ms: 3000, remaining: 32000 }, warcry: { ms: 1000 } };
		const before = target.hp;
		const action = {
			hid: p.id,
			source: "purify",
			purify: true,
			projectile: "purify",
			x: target.x,
			y: target.y,
			m: 0,
			pid: "purify",
		};
		c.complete_attack(p, target, {
			attack: 1000,
			first_attack: 1000,
			non_existent: 0,
			damage_type: "pure",
			atype: "purify",
			heal: false,
			positive: false,
			procs: false,
			conditions: [],
			apiercing: 0,
			rpiercing: 0,
			attacker: p,
			target,
			action,
			def: action,
		});
		assert.equal(target.s.warcry, undefined, "ordinary buffs are still removed");
		assert.equal(target.s.rimeshell.remaining, 32000, "Purify cannot remove Rime Shell");
		assert.equal(before - target.hp, 1400, "only the removed buff adds Purify damage");
	}
});

test("an unfinished rescue keeps its follower until its battle ends, then travels safely", () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.id === "e20"));
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_follow_through"]);
	c.transport_monster_to = (actor, instance, map, x, y) => Object.assign(actor, { in: instance, map, x, y });
	const actor = room.npc;
	c.cave_apply(
		run,
		room,
		room.encounter.options.find((option) => option.effect === "cover"),
	);
	Object.assign(p, { map: "zone_b", in: "zone_b" });
	c.cave_follow_through(run, "zone_a", p);
	assert.equal(room.npc, actor);
	assert.equal(actor.map, "zone_a");
	c.cave_tick(run, Date.now());
	assert.ok(!room.done, "leaving does not skip the rescue fight");
	for (const monster of room.actors) if (monster.zone_actor.predator) monster.dead = true;
	c.cave_random = () => 0.9; // The rescued rogue accepts the party's help.
	c.cave_tick(run, Date.now());
	assert.equal(room.done, true);
	c.cave_follow_through(run, "zone_a", p);
	assert.equal(actor.map, "zone_b");
	assert.equal(room.npc, null);
	c.cave_tick(run, Date.now());
});

test("a failing cave cannot interrupt another cave or the world tick", () => {
	const { c, p, run } = fixture();
	let ticks = 0,
		logs = 0;
	run.members = [run.members[0]];
	const other = { ...run, key: "other", floors: [] };
	Object.assign(c, {
		generated_runs: { run, other },
		generated_last_tick: 0,
		cave_tick: (record) => {
			if (record === run) throw Error("broken encounter");
			ticks++;
		},
		log_trace: () => logs++,
	});
	load(c, "node/logic/generated_maps.js", ["generated_maps_tick"]);
	c.generated_maps_tick();
	assert.equal(ticks, 1);
	assert.equal(logs, 1);
	c.generated_last_tick = 0;
	c.generated_maps_tick();
	assert.equal(ticks, 2);
	assert.equal(logs, 1, "a persistent failure does not flood the log");
});

test("full helper slots prevent a paid promise and traveler directions name real people", () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.id === "e05"));
	const helper = c.cave_spawn(run, room, "cave_npc", "ally");
	const helper2 = c.cave_spawn(run, room, "cave_npc", "ally");
	helper.zone_actor.follow = helper2.zone_actor.follow = true;
	const option = room.encounter.options.find((o) => o.cost === 2000);
	const before = run.cave.gold;
	assert.equal(c.cave_option_unavailable(run, room, option), "server.cave.helpers_limit");
	c.cave_apply(run, room, option);
	assert.equal(run.cave.gold, before);
	assert.ok(!room.npc.zone_actor.follow);
	const traveler = {
		id: "traveler",
		kind: "citizen",
		floor: room.floor,
		map: room.map,
		x: 500,
		y: 500,
		look: { name: "Pip" },
		npc: { x: 520, y: 540 },
	};
	run.cave.rooms.push(traveler);
	c.cave_apply(run, room, { effect: "reveal", travelers: true });
	assert.equal(traveler.revealed, true);
	const objective = c.cave_snapshot(run, p).objectives.find((o) => o.id === traveler.id);
	assert.equal(objective.name, "Pip");
	assert.equal(objective.x, 520);
	assert.equal(objective.y, 540);
});

test("every cave encounter option and venture outcome can finish through its real handlers", () => {
	let checked = 0;
	for (const encounter of G.events.dreams.encounters)
		for (const original of encounter.options) {
			for (const outcome of original.outcomes || [null])
				for (const roll of [0, 0.999]) {
					const { c, p, run, room } = encounterFixture(encounter);
					const option = clone(original);
					if (outcome) option.outcomes = [clone(outcome)];
					c.cave_random = () => roll;
					c.cave_apply(run, room, option);
					const label = encounter.id + "/" + option.id + (outcome ? "/" + JSON.stringify(outcome) : "");
					for (const enemy of room.enemies)
						assert.equal(c.cave_hostile(p, enemy), true, label + " enemy must be attackable");
					if (option.effect === "bad_double") {
						assert.equal(c.cave_hostile(p, room.npc), true, label + " captain fights");
						assert.equal(room.enemies.filter((a) => a.type === "cave_guard").length, 6, label + " six guards");
						assert.ok(room.npc.u && room.npc.cid > 1, label + " disposition reaches client");
					}
					for (const actor of [...room.actors])
						if (
							c.cave_hostile(p, actor) &&
							!room.practice &&
							!(room.rescue && actor === room.npc && option.effect !== "both")
						)
							c.cave_death(p, actor);
					if (room.practice) room.npc.hp = 1;
					if (room.escort) {
						room.npc.x = 1200;
						room.npc.y = 1200;
					}
					c.cave_tick(run, Date.now() + 21000);
					for (const actor of [...room.actors])
						if (!actor.dead && c.cave_hostile(p, actor) && !room.practice) c.cave_death(p, actor);
					c.cave_tick(run, Date.now() + 22000);
					assert.equal(room.done, true, label + " completes");
					assert.ok(!(run.messages || []).some((m) => /undefined|NaN/.test(m)), label + " readable result");
					checked++;
				}
		}
	assert.ok(checked >= 300);
	console.log("Checked " + checked + " encounter options/outcomes across all 50 encounters");
});

test("cave enemies, predators and hostile speakers award ten times XP through the normal party award", () => {
	const { c, p, run, room } = encounterFixture(
		G.events.dreams.encounters.find((e) => e.options.some((o) => o.effect === "bad_double")),
	);
	const awards = [];
	c.issue_monster_award = (target, info) => awards.push({ xp: target.xp, ...info });
	const xp = Math.round(15 * Math.pow(run.level, 1.3)) * 10;
	assert.equal(room.npc.xp, 0, "a peaceful speaker grants no XP");
	c.cave_apply(
		run,
		room,
		room.encounter.options.find((o) => o.effect === "bad_double"),
	);
	for (const actor of room.enemies) {
		assert.equal(actor.xp, xp, "the hostile speaker and all guards share the bonus");
		c.cave_death(p, actor);
		c.cave_death(p, actor);
	}
	assert.equal(awards.length, 7, "each defeated opponent awards once");
	for (const award of awards) {
		assert.equal(award.xp, xp);
		assert.equal(award.player, p);
		assert.equal(award.share, 1 / run.members.length);
		assert.deepEqual(Array.from(award.members), [p.name]);
		assert.equal(award.drop, false);
	}
	const predator = c.cave_spawn(run, room, "cave_rat", "predator", 40);
	assert.equal(predator.xp, xp);
	c.cave_set_side(predator, "duel_right");
	assert.equal(predator.xp, xp, "opponents in a dispute also grant the bonus");
	c.cave_set_side(predator, "ally");
	assert.equal(predator.xp, 0, "a recruited helper grants no XP");
});

test("merchant purchases spend cave gold once, keep carried gold, and stop when the purse is short", async () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.kind === "merchant"));
	p.gold = 999999;
	const price = room.stock.price;
	run.cave.gold = price - 1;
	await assert.rejects(c.cave_interaction(p, { action: "buy", room: room.id }), (e) => e.message === "gold_not_enough");
	assert.equal(room.stock.sold, false);
	let delivered = 0;
	c.cave_item = () => {
		delivered++;
		return run.members[1];
	};
	run.cave.gold = price + 20;
	const purchase = await c.cave_interaction(p, { action: "buy", room: room.id });
	assert.equal(run.cave.gold, 20);
	assert.equal(p.gold, 999999);
	assert.equal(purchase.recipient, "B");
	assert.equal(purchase.currency, "cave_gold");
	await assert.rejects(c.cave_interaction(p, { action: "buy", room: room.id }), (e) => e.message === "sold_out");
	assert.equal(delivered, 1);
	assert.equal(run.cave.gold, 20);
	assert.equal(room.npc.zone_actor.stationary, true);
});

test("leaving settles Amber but cannot pay or mail cave gold", () => {
	const { c, p, run } = encounterFixture(G.events.dreams.encounters[0]);
	const awards = [];
	p.gold = 100;
	c.cave_item = (_run, token, item, q) => awards.push({ token, item, q });
	c.cave_mail = () => {
		throw Error("Cave gold must never become mail");
	};
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_settle_purse"]);
	c.cave_settle_purse(run);
	c.cave_settle_purse(run);
	assert.equal(p.gold, 100);
	assert.equal(run.cave.gold, 50000, "remaining members can still spend the shared gold");
	assert.equal(run.cave.amber, 0);
	assert.equal(awards.length, 1);
	assert.equal(awards[0].item, "cave_amber");
	assert.equal(awards[0].q, 30);
});

test("cave reward percentages come from the live table; ordinary drop displays keep their format", () => {
	const c = vm.createContext({
		G,
		item_container: () => "<span>item</span>",
		to_pretty_float: G.to_pretty_float,
		to_pretty_num: G.to_pretty_num,
		round: Math.round,
	});
	load(c, "js/html.js", ["render_drop"]);
	for (const table of ["cave_parcel", "cave_rescue", "cave_farm", "cave_boss", "cave_finish"]) {
		const html = c.render_drop([1, "open", table], 1, "gray", "percent");
		const percentages = Array.from(html.matchAll(/>([\d.]+)%<\/div>/g), (m) => Number(m[1]));
		const total = G.drops[table].reduce((sum, row) => sum + row[0], 0);
		assert.equal(percentages.length, G.drops[table].length);
		G.drops[table].forEach((row, index) => {
			// The UI prints two decimals. Compare the chance without truncating a
			// floating-point intermediate such as 56.99999999999999 a second time.
			assert.ok(Math.abs(percentages[index] - (row[0] * 100) / total) < 0.011);
		});
	}
	assert.match(c.render_drop([0.1, "cave_amber", 1], 1, "gray"), /1 \/ 10/);
});

test("disputes never give the same name to both fighters, even on repeated random draws", () => {
	for (const encounter of G.events.dreams.encounters.filter((e) => ["conflict", "twins"].includes(e.kind))) {
		const { room } = encounterFixture(encounter);
		assert.notEqual(room.npc.name, room.rival.name);
	}
});

test("a nearby rival can be addressed even when the main speaker is far away", async () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.kind === "conflict"));
	room.npc.x = 2000;
	room.rival.x = p.x + 20;
	room.rival.y = p.y;
	assert.ok((await c.cave_interaction(p, { action: "talk", room: room.id, actor: room.rival.id })).state);
	assert.ok((await c.cave_interaction(p, { action: "talk", room: room.id })).state);
	await assert.rejects(c.cave_interaction(p, { action: "talk", room: room.id, actor: room.npc.id }), /distance/);
	await assert.rejects(c.cave_interaction(p, { action: "talk", room: room.id, actor: "another-room" }), /distance/);
});

test("rescue completion waits for surviving wolves and an attacked survivor", () => {
	for (const effect of ["watch", "both"]) {
		const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.kind === "rescue"));
		c.cave_apply(run, room, { effect });
		if (effect === "watch") c.cave_death(p, room.npc);
		else for (const actor of room.actors.filter((a) => a !== room.npc)) c.cave_death(p, actor);
		c.cave_tick(run, Date.now() + 100);
		c.cave_tick(run, Date.now() + 200);
		assert.ok(!room.done, effect + " must still have an opponent");
		for (const actor of room.actors.filter((a) => !a.dead)) c.cave_death(p, actor);
		c.cave_tick(run, Date.now() + 300);
		assert.ok(room.done);
	}
});

test("a lost escort closes without an arrival reward", () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.kind === "escort"));
	let rewarded = false;
	c.cave_reward = () => {
		rewarded = true;
	};
	c.cave_apply(run, room, { effect: "escort" });
	c.cave_death(null, room.npc);
	c.cave_tick(run, Date.now() + 100);
	assert.ok(room.done);
	assert.equal(rewarded, false);
});

test("revive here charges only fallen players who remain; the doorway is free", () => {
	for (const mode of ["here", "landing", "insufficient", "departed"]) {
		const { c, p, run, room } = encounterFixture(G.events.dreams.encounters[0]);
		const second = { ...p, id: "B", name: "B", real_id: "b", rip: true, s: {} };
		c.get_player = (name) => (name === "A" ? p : name === "B" ? second : null);
		p.rip = true;
		room.kind = "revival";
		run.cave.amber = mode === "insufficient" ? 0 : 5;
		if (mode === "departed") run.members[1].left = true;
		const before = run.cave.amber;
		const paid = { id: "here", effect: "revive_here" };
		const cost = c.cave_revival_option(run, room, paid).amber;
		assert.equal(cost, mode === "departed" ? 1 : 2);
		c.cave_apply(run, room, mode === "landing" ? { id: "landing", effect: "revive_landing" } : paid);
		assert.equal(p.rip, false);
		assert.equal(run.cave.amber, mode === "here" ? before - 2 : mode === "departed" ? before - 1 : before);
		assert.equal(second.rip, mode === "departed");
	}
});

test("cave revival translates choices and results while keeping canonical CODE fields", () => {
	const { c, p, run } = encounterFixture(G.events.dreams.encounters[0]);
	const logs = [];
	run.cave.amber = 0;
	p.rip = true;
	p.socket.emit = (event, packet) => {
		if (event === "game_log") logs.push(packet);
	};
	c.safe_xy_nearby = (map, x, y) => ({ x, y });
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_say", "cave_offer_rescue"]);
	c.cave_offer_rescue(run, p);
	const state = c.cave_snapshot(run, p);
	const german = require("../../js/phrases").create("de", c.localization.catalog("de"));
	const display = (ref) => german(ref.phrase, ref.phrase_args);
	assert.equal(state.choice.title, "A Hand in the Dark");
	assert.equal(display(state.choice.title_message), "Eine Hand im Dunkeln");
	assert.equal(state.choice.options[0].label, "Revive here — 1 Amber total");
	assert.equal(display(state.choice.options[0].label_message), "Hier wiederbeleben — insgesamt 1 Amber");
	assert.equal(state.choice.options[0].amber, 1);
	assert.equal(state.choice.options[0].unavailable, "Not enough in the shared purse.");
	assert.equal(display(state.choice.options[0].unavailable_message), "Im gemeinsamen Beutel ist nicht genug.");
	assert.equal(display(state.choice.fallback_message), "Zum Eingang zurückkehren");
	c.cave_resolve_vote(run, state.choice.deadline + 1);
	const resolved = c.cave_snapshot(run, p).choice;
	assert.equal(p.rip, false);
	assert.equal(resolved.result_label, "No reply was chosen.");
	assert.equal(display(resolved.result_message), "Es wurde keine Antwort gewählt.");
	assert.ok(resolved.summary.includes("You're back at the doorway. No Amber spent."));
	assert.ok(
		resolved.summary_messages.some(
			(entry) => display(entry) === "Ihr seid wieder am Eingang. Es wurde kein Amber ausgegeben.",
		),
	);
	assert.equal(logs[0].message, "You're back at the doorway. No Amber spent.");
	assert.equal(display(logs[0]), "Ihr seid wieder am Eingang. Es wurde kein Amber ausgegeben.");
});

test("cave encounter results translate the selected outcome and keep CODE text unchanged", () => {
	for (const optionId of ["e02_0", "e02_2"]) {
		const { c, p, run, room } = encounterFixture(G.events.dreams.encounters.find((e) => e.id === "e02"));
		const option = room.encounter.options.find((o) => o.id === optionId);
		room.encounter.options = [option, room.encounter.options.find((o) => o.effect === "leave")];
		room.voted = false;
		load(c, "node/logic/cave_of_many_dreams.js", ["cave_say"]);
		c.cave_begin_vote(run, room);
		const before = c.cave_snapshot(run, p).choice;
		const german = require("../../js/phrases").create("de", c.localization.catalog("de"));
		assert.equal(german(before.title_message.phrase), "Das herrenlose Paket");
		assert.equal(before.title, "The Unclaimed Parcel");
		run.cave.vote.votes.a = run.cave.vote.votes.b = optionId;
		c.cave_resolve_vote(run, Date.now());
		const after = c.cave_snapshot(run, p).choice;
		const canonical = option.result || option.outcomes[0].text;
		const result = after.summary_messages[after.summary.indexOf(canonical)];
		assert.ok(result);
		assert.equal(result.message, canonical);
		assert.equal(
			german(result.phrase, result.phrase_args),
			option.result
				? "Wir untersuchen sie 20 Sekunden lang und nehmen dann die Vorräte mit."
				: "Ihr öffnet die Kiste und nehmt den Inhalt mit.",
		);
	}
});

test("cave traveler chat and combat cues preserve CODE text with translated display metadata", async () => {
	const { c, p, run, room } = encounterFixture(G.events.dreams.encounters[0]);
	const events = [];
	p.socket.emit = (event, data) => events.push({ event, data });
	room.kind = "citizen";
	room.look = G.events.dreams.travelers.find((entry) => entry.name === "Pip");
	room.actors = [];
	run.cave.actors.clear();
	c.cave_activate(run, room);
	const result = await c.cave_interaction(p, { action: "talk", room: room.id, actor: room.npc.id });
	p.rip = true;
	await assert.rejects(c.cave_interaction(p, { action: "talk", room: room.id, actor: room.npc.id }), /defeated/);
	p.rip = false;
	assert.equal(result.chat.text, room.look.says[0]);
	assert.equal(result.chat.text_message.phrase, "event.dreams.traveler.Pip.says.0");
	assert.ok(!run.paused_at, "ordinary traveler chat does not pause the cave");
	const german = require("../../js/phrases").create("de", c.localization.catalog("de"));
	assert.equal(german(result.chat.text_message.phrase), "Verzeihung! Schwere Tasche.");
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_cue"]);
	c.cave_cue(run, room.npc, c.localization.message("server.cave.cue_sentinel"), "danger");
	const cue = events.find((entry) => entry.data.type === "cue").data.cue;
	assert.equal(cue.text, "The sentinel is winding up. Move away!");
	assert.equal(german(cue.text_message.phrase), "Der Wächter holt aus. Geht weg!");
	const camp = G.events.dreams.camps[0][1];
	const notice = c.localization.message("server.cave.wave_wait", { camp: { phrase: "event.dreams.camp.0.1.name" } });
	assert.equal(notice.message, camp.name + ": Something is moving in the nest. Another pack in 10 seconds.");
	assert.match(german(notice.phrase, notice.phrase_args), /^Fledermausquartier:/);
});

test("cave chests spread around an occupied drop point and stay on safe ground", () => {
	const { c, p, run } = chestFixture();
	c.is_xy_safe = (map, x, y) => x >= 40 && x <= 260 && y >= 100 && y <= 300;
	for (let i = 0; i < 8; i++) c.cave_credit(run, 100, 0, p);
	const drops = Object.values(c.chests);
	assert.equal(drops.length, 8);
	for (let i = 0; i < drops.length; i++) {
		assert.ok(c.is_xy_safe(p.map, drops[i].x, drops[i].y));
		for (let j = 0; j < i; j++) assert.ok(Math.hypot(drops[i].x - drops[j].x, drops[i].y - drops[j].y) >= 36);
	}
});

test("a small terminal room reserves space for the stairs instead of rejecting entry", () => {
	const layout = require("../logic/dream_layout");
	assert.equal(layout.validateDungeon(layout.generateDungeon("entry-audit-8")).pass, true);
});

test("cave music uses the existing player, switches with votes, and respects mute and headless mode", () => {
	const calls = [];
	function Howl(config) {
		this.config = config;
		this.v = config.volume;
		this.state = () => "unloaded";
		this.load = () => {};
		this.volume = (value) => (value === undefined ? this.v : (this.v = value));
		this.play = () => calls.push(["play", config.src[0]]);
		this.stop = () => calls.push(["stop", config.src[0]]);
	}
	const c = vm.createContext({
		no_graphics: false,
		Howl,
		window: null,
		sounds: {},
		sound_music: true,
		sound_sfx: true,
		music_level: 1,
		music_volume: 40,
		xmas_tunes: false,
		current_music: null,
		current_map: "zone_a",
		G: { maps: { zone_a: { generated: { zone: "dreams" } } } },
		cave_client_state: { paused: false },
		url_factory: (s) => s,
		in_arr: (s, a) => a.includes(s),
		add_log: () => {
			throw Error("Unexpected audio warning");
		},
	});
	c.window = c;
	vm.runInContext(read("js/functions.js").match(/var audio_sound_names = [\s\S]*?\n};/)[0], c);
	load(c, "js/functions.js", ["apply_audio_volume", "init_music", "reflect_music"]);
	c.init_music();
	c.reflect_music();
	const explore = c.current_music;
	assert.ok(explore.config.src[0].includes("cave_dreams_exploration"));
	assert.equal(explore.config.loop, true);
	assert.equal(explore.config.preload, false);
	assert.ok(Math.abs(explore.v - 0.08) < 0.001);
	c.cave_client_state.paused = true;
	c.reflect_music();
	assert.ok(c.current_music.config.src[0].includes("cave_dreams_choices"));
	const count = calls.length;
	c.reflect_music();
	assert.equal(calls.length, count, "state refresh does not restart music");
	c.cave_client_state.paused = false;
	c.reflect_music();
	assert.equal(c.current_music, explore);
	c.current_map = "main";
	c.reflect_music();
	assert.equal(c.current_music, c.sounds.rpg08);
	c.sound_music = false;
	c.reflect_music();
	assert.equal(c.current_music, null);
	c.no_graphics = true;
	c.Howl = () => {
		throw Error("Headless audio");
	};
	c.init_music();
	c.reflect_music();
});
