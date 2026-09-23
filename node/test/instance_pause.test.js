const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read } = require("./helpers/server_vm");
const G = require("./helpers/design");

function fixture() {
	const now = Date.now(),
		packets = [];
	const make = (id, map, monster = false) => ({
		id,
		name: id,
		in: map,
		map,
		x: 20,
		y: 30,
		hp: 500,
		mp: 200,
		is_player: !monster,
		is_monster: monster,
		moving: true,
		vx: 10,
		vy: 0,
		going_x: 200,
		going_y: 30,
		last: { attack: new Date(now - 100), move: new Date(now - 20) },
		frequency: 1,
		s: { poisoned: { ms: 3000, last: new Date(now - 100) } },
		c: {},
		zone_actor: monster ? { next: now + 1000, path_token: "pending" } : undefined,
		socket: { emit: (event, data) => packets.push({ id, event, data }) },
	});
	const a = make("A", "one"),
		b = make("B", "two"),
		rat = make("rat", "one", true);
	const one = {
		name: "one",
		map: "one",
		players: { A: a },
		monsters: { rat },
		observers: {},
		last_update: new Date(now - 40),
	};
	const two = {
		name: "two",
		map: "two",
		players: { B: b },
		monsters: {},
		observers: {},
		last_update: new Date(now - 40),
	};
	const shot = { attacker: rat, target: a, eta: new Date(now - 1) };
	const run = {
		key: "run",
		members: [{ character: "A" }, { character: "B" }],
		floors: ["one", "two"],
		expires: now + 1000,
		cave: { rooms: [{ actors: [rat], hunt: { deadline: now + 5000 }, practice_end: now + 3000 }] },
	};
	const c = vm.createContext({
		G,
		Date,
		Math,
		Set,
		Map,
		instances: { one, two },
		projectiles: { shot },
		generated_maps: {},
		player_to_client: (p) => ({ id: p.id, moving: p.moving }),
		monster_to_client: (p) => ({ id: p.id, moving: p.moving }),
		send_xy_updates() {},
		db: { collection: () => ({ updateMany: async () => ({}) }) },
		log_trace(e) {
			throw e;
		},
		complete_attack() {
			throw Error("A projectile landed during a pause");
		},
	});
	vm.runInContext(read("node/logic/instance_pause.js"), c);
	load(c, "node/server.js", ["update_instance", "projectiles_loop", "commence_attack", "start_moving_element"]);
	load(c, "node/logic/generated_maps.js", ["generated_clock"]);
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_pause", "cave_resume"]);
	return { c, now, run, a, b, rat, shot, one, two, packets };
}
test("forced choices freeze every floor, retain projectile time and preserve combat timers", () => {
	const { c, now, run, a, b, rat, shot, one, two } = fixture();
	c.cave_pause(run, now);
	assert.ok(one.frozen && two.frozen);
	assert.equal(a.moving, false);
	assert.equal(b.moving, false);
	assert.equal(rat.moving, false);
	assert.equal(rat.zone_actor.path_token, null, "late path replies cannot restart walking");
	c.update_instance(one);
	c.update_instance(two);
	c.projectiles_loop();
	assert.equal(c.commence_attack(a, rat, "attack").reason, "cave_paused");
	c.start_moving_element(a);
	assert.equal(a.moving, false);
	assert.equal(c.generated_clock(run, now + 20000), now, "a vote can finish even at the end of cave time");
	assert.equal(a.s.poisoned.ms, 3000);
	assert.equal(a.hp, 500);
	assert.equal(a.mp, 200);
	c.cave_resume(run, now + 20000);
	assert.equal(run.expires, now + 21000);
	assert.equal(run.cave.rooms[0].hunt.deadline, now + 25000);
	assert.equal(run.cave.rooms[0].practice_end, now + 23000);
	assert.equal(+a.last.attack, now + 19900);
	assert.equal(+b.last.attack, now + 19900);
	assert.equal(+a.s.poisoned.last, now + 19900);
	assert.equal(+shot.eta, now + 19999);
	assert.equal(+one.last_update, now + 20000);
	assert.equal(one.frozen, undefined);
	assert.equal(two.frozen, undefined);
});
test("paused sockets can vote, chat and exit but cannot move, attack or consume items", () => {
	const { c, run, now, a, b, packets } = fixture();
	c.cave_pause(run, now);
	for (const [method, data] of [
		["move", {}],
		["attack", {}],
		["skill", { name: "blink" }],
		["use", { item: 0 }],
		["equip", { num: 0 }],
	]) {
		assert.equal(c.instance_block_action(a, method, data), true);
		assert.equal(packets.at(-1).data.reason, "cave_paused");
	}
	for (const [method, data] of [
		["say", {}],
		["cm", {}],
		["interaction", { type: "cave", action: "vote" }],
		["interaction", { type: "cave", action: "exit" }],
	])
		assert.equal(c.instance_block_action(a, method, data), false);
	c.release_frozen_player(a, now + 5000);
	assert.equal(+a.last.attack, now + 4900);
	c.cave_resume(run, now + 20000);
	assert.equal(+a.last.attack, now + 4900, "leaving does not extend that player's cooldown twice");
	assert.equal(+b.last.attack, now + 19900);
	assert.equal(c.instance_block_action({ in: "main" }, "skill", {}), false);
});
test("the trainer always offers a real practice fight and reopening does not pause again", () => {
	const { c, run, now } = fixture();
	c.cave_publish = () => {};
	const player = { cave_room: "old_conversation" };
	c.cave_players = () => [player];
	c.crypto = require("node:crypto");
	load(c, "node/logic/cave_of_many_dreams.js", ["cave_random", "cave_pick", "cave_begin_vote", "cave_face"]);
	run.members = [{ character: "a" }, { character: "b" }, { character: "c" }];
	for (let i = 0; i < 50; i++) {
		run.cave.vote = null;
		run.cave.serial = 0;
		delete run.paused_at;
		const room = { encounter: G.events.dreams.encounters.find((e) => e.id === "e40"), npc: {}, actors: [] };
		c.cave_begin_vote(run, room);
		assert.equal(player.cave_room, undefined, "the new conversation replaces an older manually opened one");
		assert.equal(run.cave.vote.options[0].effect, "practice");
		assert.equal(run.cave.vote.options.length, 2);
		assert.ok(run.cave.vote.deadline >= now + 20000);
		run.cave.vote.resolved = true;
		delete run.paused_at;
		c.cave_begin_vote(run, room);
		assert.equal(run.paused_at, undefined);
	}
});

test("entry cameras shake only for entrants; spectators see sprite motion without world-position changes", () => {
	function scene(entering, reduced = false) {
		let now = 1000,
			camera = 0;
		class Clock extends Date {
			static now() {
				return now;
			}
		}
		const sprite = {
			name: "A",
			real_x: 816,
			real_y: 1200,
			pivot: {
				x: 0,
				y: 0,
				set(x, y) {
					this.x = x;
					this.y = y;
				},
			},
			animations: {},
			addChild() {},
		};
		class Graphics {
			clear() {}
			beginFill() {}
			drawRect() {}
			endFill() {}
			destroy() {}
		}
		const c = vm.createContext({
			Date: Clock,
			Math,
			G,
			phrase: { html: (s) => s },
			render_interaction() {},
			PIXI: { Graphics },
			no_graphics: false,
			socket: {},
			matchMedia: () => ({ matches: reduced }),
			$: () => ({ length: 0 }),
			current_map: "main",
			character: { name: entering ? "A" : "C" },
			animatables: {},
			get_player: () => sprite,
			h_shake() {
				camera++;
			},
			v_shake() {
				camera++;
			},
			draw_timeout(f) {
				f();
			},
			start_animation(s) {
				s.animations.transport = {};
			},
			stop_animation(s) {
				delete s.animations.transport;
			},
		});
		vm.runInContext(read("js/generated_zones.js"), c);
		c.cave_entry_animation({ names: ["A"], key: "key", duration: 1800 });
		now += 1100;
		c.draw_cave_entrance();
		assert.equal(sprite.real_x, 816);
		assert.equal(sprite.real_y, 1200);
		assert.ok(sprite.pivot.y > 0);
		assert.equal(camera > 0, entering && !reduced);
		now += 900;
		c.draw_cave_entrance();
		assert.ok(sprite.pivot.y > 0, "the pull stays in place until the map handoff");
		c.current_map = "zone_arrival";
		c.finish_cave_entry("key");
		assert.equal(sprite.pivot.y, 0);
		assert.equal(sprite.pivot.x, 0);
		assert.equal(c.cave_entry_scenes.length, 0);
	}
	scene(false);
	scene(true);
	scene(true, true);
});
