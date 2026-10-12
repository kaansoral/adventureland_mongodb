"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { DueQueue } = require("../logic/due_queue.js");

test("an empty queue reports Infinity", () => {
	assert.equal(new DueQueue().peek(), Infinity);
	assert.equal(new DueQueue().size, 0);
});

test("entries come out in due order, whatever order they went in", () => {
	const q = new DueQueue();
	const dues = [50, 10, 90, 10, 1, 70, 30, 30, 2, 100, 5];
	dues.forEach((d, i) => q.push(d, "v" + i));
	const out = [];
	while (q.size) {
		out.push(q.peek());
		q.shift();
	}
	assert.deepEqual(
		out,
		dues.slice().sort((a, b) => a - b),
	);
});

test("the payload travels with its due time", () => {
	const q = new DueQueue();
	q.push(30, "c");
	q.push(10, "a");
	q.push(20, "b");
	assert.equal(q.shift(), "a");
	assert.equal(q.shift(), "b");
	assert.equal(q.shift(), "c");
	assert.equal(q.size, 0);
});

test("equal due times all come out, none are lost", () => {
	const q = new DueQueue();
	for (let i = 0; i < 20; i++) q.push(5, i);
	const seen = new Set();
	while (q.size) seen.add(q.shift());
	assert.equal(seen.size, 20);
});

test("interleaved pushes and shifts keep the ordering invariant", () => {
	const q = new DueQueue();
	const reference = [];
	let seed = 12345;
	const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	for (let step = 0; step < 5000; step++) {
		if (rnd() < 0.6 || !reference.length) {
			const d = Math.floor(rnd() * 1000);
			q.push(d, d);
			reference.push(d);
			reference.sort((a, b) => a - b);
		} else {
			assert.equal(q.peek(), reference[0], "peek diverged at step " + step);
			assert.equal(q.shift(), reference.shift(), "shift diverged at step " + step);
		}
		assert.equal(q.size, reference.length);
	}
});

test("clear empties it", () => {
	const q = new DueQueue();
	q.push(1, "a");
	q.push(2, "b");
	q.clear();
	assert.equal(q.size, 0);
	assert.equal(q.peek(), Infinity);
	q.push(3, "c");
	assert.equal(q.shift(), "c");
});

test("it stays ordered across a large random load", () => {
	const q = new DueQueue();
	let seed = 999;
	const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	for (let i = 0; i < 50000; i++) q.push(Math.floor(rnd() * 1e6), i);
	let last = -Infinity;
	while (q.size) {
		const d = q.peek();
		assert.ok(d >= last, "order broke");
		last = d;
		q.shift();
	}
});

test("the real projectile loop preserves shifted deadlines before and after the old ETA", () => {
	const vm = require("node:vm");
	const { load } = require("./helpers/server_vm");
	for (const resumeAt of [1200, 2000]) {
		let now = 1000;
		class Clock extends Date {
			constructor(...args) {
				super(...(args.length ? args : [now]));
			}
			static now() {
				return now;
			}
		}
		const attacker = { in: "cave" },
			target = { in: "cave" };
		const shot = { attacker, target, eta: new Date(1500) };
		const queue = new DueQueue(),
			hits = [];
		queue.push(+shot.eta, "shot");
		const c = vm.createContext({
			Date: Clock,
			instances: { cave: { name: "cave", frozen: { at: 1000, actors: new Set() } } },
			projectiles: { shot },
			projectiles_due: queue,
			complete_attack: (...args) => hits.push(args),
			shift_entity_timers() {},
			log_trace: (_message, error) => {
				throw error;
			},
		});
		load(c, "node/logic/instance_pause.js", ["instance_is_frozen", "resume_frozen_instance"]);
		load(c, "node/server.js", ["projectiles_loop"]);
		now = resumeAt - 1;
		c.projectiles_loop();
		assert.equal(hits.length, 0);
		now = resumeAt;
		c.resume_frozen_instance(c.instances.cave, now);
		assert.equal(+shot.eta, resumeAt + 500);
		now = resumeAt + 499;
		c.projectiles_loop();
		assert.equal(hits.length, 0);
		now++;
		c.projectiles_loop();
		assert.equal(hits.length, 1);
		assert.equal(queue.size, 0);
		assert.equal(c.projectiles.shot, undefined);
	}
});

test("respawns count elapsed time from their own creation and retain hasten adjustments", () => {
	const vm = require("node:vm");
	const { load } = require("./helpers/server_vm");
	let now = 2000;
	class Clock extends Date {
		static now() {
			return now;
		}
	}
	const target = { oin: "main", map_def: { type: "goo" } },
		spawned = [];
	const entry = [target, 500, 1990];
	const c = vm.createContext({
		Date: Clock,
		monster_respawns: [entry],
		new_monster: (...args) => spawned.push(args),
		log_trace: (_message, error) => {
			throw error;
		},
	});
	load(c, "node/server.js", ["respawns_loop"]);
	c.respawns_loop();
	assert.equal(entry[1], 490, "time before this death cannot shorten its respawn");
	entry[1] -= 400;
	now = 2080;
	c.respawns_loop();
	assert.equal(spawned.length, 0);
	now = 2091;
	c.respawns_loop();
	assert.equal(spawned.length, 1);
	assert.equal(spawned[0][2].before_respawn, target);
	assert.equal(c.monster_respawns.length, 0);
});

test("a push reports its due time to the queue's hook", () => {
	const seen = [];
	const q = new DueQueue((due) => seen.push(due));
	q.push(30, "a");
	q.push(10, "b");
	assert.deepEqual(seen, [30, 10]);
	assert.equal(q.peek(), 10);
});

// The real tick and its arming, with a fake clock and fake timers.
function tickFixture() {
	const vm = require("node:vm");
	const { load } = require("./helpers/server_vm");
	const timers = [];
	const clock = { now: 1000 };
	class Clock extends Date {
		constructor(...args) {
			super(...(args.length ? args : [clock.now]));
		}
		static now() {
			return clock.now;
		}
	}
	const c = vm.createContext({
		Date: Clock,
		PROJECTILE_TICK_MS: 7,
		PROJECTILE_IDLE_MS: 50,
		projectile_timer: null,
		projectile_timer_at: 0,
		projectiles: {},
		monster_respawns: [],
		instances: {},
		complete_attack() {},
		instance_is_frozen: () => false,
		new_monster() {},
		log_trace: (_message, error) => {
			throw error;
		},
		setTimeout(fn, ms) {
			const timer = { fn, ms, cleared: false };
			timers.push(timer);
			return timer;
		},
		clearTimeout(timer) {
			timer.cleared = true;
		},
	});
	load(c, "node/server.js", ["projectiles_tick", "arm_projectiles_tick", "projectiles_loop", "respawns_loop"]);
	c.projectiles_due = new DueQueue(() => c.arm_projectiles_tick(c.PROJECTILE_TICK_MS));
	const live = () => timers.filter((timer) => !timer.cleared && !timer.fired);
	const fire = () => {
		const [timer] = live();
		timer.fired = true;
		timer.fn();
	};
	return { c, clock, live, fire };
}

test("the projectile tick idles at 50ms and a queued projectile brings it back to 7ms", () => {
	const { c, clock, live, fire } = tickFixture();
	c.arm_projectiles_tick(7);
	fire(); // nothing in flight
	assert.deepEqual(
		live().map((timer) => timer.ms),
		[50],
		"an empty queue backs off",
	);
	clock.now += 10;
	c.projectiles.p1 = { attacker: {}, target: {}, eta: new Date(clock.now + 300) };
	c.projectiles_due.push(clock.now + 300, "p1");
	assert.deepEqual(
		live().map((timer) => timer.ms),
		[7],
		"the idle timer is replaced, so the first attack after a quiet spell is not late",
	);
	c.projectiles_due.push(clock.now + 400, "p2");
	assert.equal(live().length, 1, "a timer already due soon enough is kept, not churned");
	fire();
	assert.deepEqual(
		live().map((timer) => timer.ms),
		[7],
		"stays at 7ms while anything is in flight",
	);
});

test("the projectile tick re-arms even when a loop throws", () => {
	const { c, live, fire } = tickFixture();
	c.arm_projectiles_tick(7);
	c.respawns_loop = () => {
		throw new Error("respawn failure");
	};
	assert.throws(fire, /respawn failure/);
	assert.equal(live().length, 1, "a dead timer would stop every projectile on the server");
});
