"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read, extract, socketHandler } = require("./helpers/server_vm");
const { server, client, player, observer, send } = require("./helpers/entity_updates");

test("the documented refresh example displays one full snapshot and removes its listener", () => {
	const { EventEmitter } = require("node:events");
	const socket = new EventEmitter(),
		shown = [],
		requests = [];
	socket.on("send_updates", () => requests.push("refresh"));
	const c = vm.createContext({ parent: { socket }, show_json: (value) => shown.push(value) });
	vm.runInContext(extract(read("js/runner_functions.js"), "get_socket"), c);
	const example = read("docs/functions/get_socket.html").match(
		/<div class='code'>(var socket = get_socket\(\);[\s\S]*?)<\/div>/,
	)[1];
	vm.runInContext(example, c);
	assert.deepEqual(requests, ["refresh"]);
	socket.emit("entities", { type: "xy", players: [], monsters: [] });
	assert.equal(shown.length, 0);
	const full = { type: "all", players: [{ id: "Self", x: 15, y: 25 }], monsters: [] };
	socket.emit("entities", full);
	socket.emit("entities", full);
	assert.deepEqual(shown, [full]);
	assert.equal(socket.listenerCount("entities"), 0);
});

test("send_updates ignores caller identity and refreshes only the authenticated view", () => {
	const own = { id: "authenticated" },
		calls = [];
	const c = vm.createContext({
		socket: { id: "connection" },
		players: { connection: own },
		observers: {},
		send_all_xy: (value) => calls.push(value),
	});
	socketHandler(c, "send_updates")({ id: "someone_else", x: 9000 });
	assert.deepEqual(calls, [own]);
	delete c.players.connection;
	socketHandler(c, "send_updates")({ id: "authenticated" });
	assert.equal(calls.length, 1);
});

test("movement packets retain unchanged coordinates needed by the native client", () => {
	const c = server(),
		view = client(),
		watcher = observer(),
		peer = player();
	send(c, watcher, peer);
	view.handle_entities(watcher.sent.pop()[1]);
	view.process_entities();
	Object.assign(peer, { moving: true, going_x: 100, move_num: 1 });
	send(c, watcher, peer);
	const data = watcher.sent.pop()[1];
	view.handle_entities(data);
	view.process_entities();
	assert.equal(data.players[0].going_y, 0);
	assert.ok(Number.isFinite(view.entities.Peer.vx) && Number.isFinite(view.entities.Peer.vy));
	assert.ok(view.entities.Peer.vx > 0);
});

test("multiple packets before a native render preserve HP and a new player's identity", () => {
	const c = server(),
		view = client(),
		watcher = observer(),
		peer = player();
	send(c, watcher, peer);
	peer.hp = 90;
	send(c, watcher, peer);
	peer.x = 5;
	send(c, watcher, peer);
	for (const [, data] of watcher.sent) view.handle_entities(data);
	view.process_entities();
	assert.equal(view.entities.Peer.hp, 90);
	assert.equal(view.entities.Peer.ctype, "mage");
	assert.equal(view.entities.Peer.real_x, 5);
});

test("a tick serializes an entity once for all recipients, then uses fresh data next tick", () => {
	const c = server(),
		peer = player(),
		a = observer("A"),
		b = observer("B");
	let serializations = 0;
	const payload = c.player_to_client(peer, 1);
	payload.toJSON = () => {
		serializations++;
		return { id: peer.id, hp: peer.hp };
	};
	const list = [{ entity: peer, data: payload }];
	c.send_xy_updates(a, list);
	c.send_xy_updates(b, list);
	assert.equal(serializations, 1);
	assert.deepEqual(a.sent, b.sent);
	peer.hp = 60;
	send(c, a, peer);
	assert.equal(a.sent.at(-1)[1].players[0].hp, 60);
	assert.equal(peer.frame_state, undefined, "no cross-tick baseline is retained");
});

test("a stationary NPC is reacquired after walking away and back", () => {
	const c = server(),
		watcher = observer(),
		npc = player({ id: "Shopkeeper", is_npc: true, type: "merchant", x: 10 });
	c.instances.main.players.Shopkeeper = npc;
	watcher.push = [0, 0];
	c.send_xy_updates(watcher, []);
	watcher.x = 1000;
	watcher.push = [0, 0];
	c.send_xy_updates(watcher, []);
	assert.deepEqual(watcher.sent.at(-1), ["disappear", { id: npc.id, outside: true }]);
	assert.equal(watcher.seen.Shopkeeper, undefined);
	watcher.x = 0;
	watcher.push = [1000, 0];
	c.send_xy_updates(watcher, []);
	assert.equal(watcher.sent.at(-1)[1].players[0].id, npc.id);
	assert.equal(watcher.sent.filter(([event]) => event === "entities").length, 2);
});

test("the final short movement step reconciles the view", () => {
	const c = server(),
		watcher = observer();
	Object.assign(watcher, { x: 50, moving: false, last_upush: [0, 0] });
	c.xy_upush_logic(watcher);
	assert.deepEqual([...watcher.push], [0, 0]);
	assert.deepEqual([...watcher.last_upush], [50, 0]);
});

test("a short out-and-back trip restores an entity discarded between server view sweeps", () => {
	const c = server(),
		view = client(),
		watcher = observer(),
		peer = player({ x: 690 });
	c.instances.main.players.Peer = peer;
	c.send_all_xy(watcher);
	view.handle_entities(watcher.sent.pop()[1]);
	view.process_entities();
	assert.ok(view.entities.Peer);
	watcher.x = view.character.x = -20;
	watcher.moving = true;
	c.xy_upush_logic(watcher);
	assert.equal(watcher.push, undefined, "this trip never crosses the server sweep threshold");
	view.draw_entities();
	assert.equal(view.entities.Peer, undefined);
	watcher.x = view.character.x = 0;
	watcher.moving = false;
	c.xy_upush_logic(watcher);
	c.send_xy_updates(watcher, []);
	view.handle_entities(watcher.sent.pop()[1]);
	view.process_entities();
	assert.ok(view.entities.Peer, "the native client reacquires the previously known player");
});

test("full snapshots use current state after movement without viewers", () => {
	const c = server(),
		watcher = observer(),
		peer = player();
	c.instances.main.players.Peer = peer;
	send(c, watcher, peer);
	peer.x = 1000;
	send(c, watcher, peer);
	watcher.x = 1000;
	const all = c.send_all_xy(watcher, { raw: true });
	assert.equal(all.players.find((p) => p.id === peer.id).x, 1000);
	assert.equal(all.gone, undefined);
});

test("backpressure counts Engine.IO's queue for websocket and polling", () => {
	const { Socket } = require("engine.io");
	const { EventEmitter } = require("node:events");
	const c = server();
	for (const transport of [{ writable: false, socket: { bufferedAmount: 100 } }, { writable: false }]) {
		const conn = new EventEmitter();
		Object.setPrototypeOf(conn, Socket.prototype);
		Object.assign(conn, { _readyState: "open", writeBuffer: [], packetsFn: [], transport });
		for (let i = 0; i < 300; i++) conn.sendPacket("message", "x".repeat(2048));
		assert.ok(c.socket_backlog({ conn }) >= 614400);
		assert.ok(c.socket_backlog({ conn }, c.B.xy_backlog_limit) > c.B.xy_backlog_limit);
	}
	assert.equal(c.socket_backlog({}), 0);
});

test("a dropped final update is recovered even when the entity never updates again", () => {
	const c = server(),
		watcher = observer(),
		peer = player();
	c.instances.main.players.Peer = peer;
	send(c, watcher, peer);
	watcher.socket.conn = { writeBuffer: [{ data: "x".repeat(c.B.xy_backlog_limit + 1) }] };
	peer.hp = 70;
	send(c, watcher, peer);
	assert.equal(watcher.sent.length, 1);
	assert.ok(watcher.seen.Peer, "the client still holds the entity");
	assert.equal(watcher.xy_resync, true);
	watcher.socket.conn.writeBuffer = [];
	c.send_xy_updates(watcher, []);
	assert.equal(watcher.sent.at(-1)[1].type, "all");
	assert.equal(watcher.sent.at(-1)[1].players[0].hp, 70);
	assert.equal(watcher.xy_resync, false);
});

test("a shed tick still sends ordinary disappear events", () => {
	const c = server(),
		watcher = observer(),
		peer = player();
	send(c, watcher, peer);
	watcher.socket.conn = { writeBuffer: [{ data: "x".repeat(c.B.xy_backlog_limit + 1) }] };
	peer.x = 1000;
	send(c, watcher, peer);
	assert.deepEqual(watcher.sent.at(-1), ["disappear", { id: peer.id, outside: true }]);
	assert.equal(watcher.seen.Peer, undefined);
});

test("native disappearance handles an exit and reentry before the next draw", () => {
	const view = client();
	view.entities.Peer = { id: "Peer", type: "character", real_x: 0, real_y: 0 };
	view.on_disappear({ id: "Peer", outside: true });
	assert.equal(view.entities.Peer, undefined);
	view.on_disappear({ id: "Peer", outside: true });
	assert.equal(view.calls.length, 1);
	view.handle_entities({ type: "xy", players: [{ ...player(), ctype: "mage" }], monsters: [] });
	view.process_entities();
	view.draw_entities();
	assert.ok(view.entities.Peer);
	assert.equal(view.entities.Peer.dead, undefined);
	assert.equal(view.calls.length, 1);
});

test("map changes clear old sprites before recreating matching IDs from the snapshot", () => {
	const view = client(),
		source = read("js/game.js");
	view.entities.Peer = { id: "Peer", in: "old", real_x: 0, real_y: 0 };
	view.data = { name: "main", in: "new_instance" };
	const start = source.indexOf("\t\tif (entities_map !== data.name");
	vm.runInContext(source.slice(start, source.indexOf("\n\t\tif (tutorial_map", start)), view);
	assert.equal(view.clean_house, true);
	view.handle_entities({ type: "all", players: [{ ...player(), ctype: "mage" }], monsters: [] }, { new_map: true });
	view.draw_entities();
	view.process_entities();
	assert.ok(view.entities.Peer && !view.entities.Peer.dead);
	assert.equal(view.calls.length, 1);
});

// #performance spree [02/10/26]: entity deltas - the real encoder (server.js entity_wire via send_xy_updates) against the real decoder (game.js decode_entities)
test("entity deltas rebuild the exact full packet, across skipped ticks, removed fields and re-entry", () => {
	const c = server(),
		decoder = client(),
		delta = observer("DeltaWatcher"),
		plain = observer("PlainWatcher");
	delta.socket.entity_delta = true;
	let seed = 7;
	const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
	const peers = [player({ id: "PeerA" }), player({ id: "PeerB", type: "priest" })];
	const monsters = [
		{
			id: "m1",
			type: "goo",
			is_monster: true,
			x: 10,
			y: 10,
			hp: 100,
			max_hp: 100,
			level: 1,
			in: "main",
			map: "main",
			s: {},
		},
		{
			id: "m2",
			type: "goo",
			is_monster: true,
			x: -20,
			y: 5,
			hp: 100,
			max_hp: 100,
			level: 1,
			in: "main",
			map: "main",
			s: {},
		},
	];
	let deltas = 0,
		fulls = 0,
		deltaBytes = 0,
		fullBytes = 0;
	for (let tick = 0; tick < 3000; tick++) {
		for (const e of peers.concat(monsters)) {
			if (random() < 0.5) e.x += Math.round(random() * 20 - 10);
			if (random() < 0.3) e.hp = Math.max(1, Math.min(100, e.hp + Math.round(random() * 30 - 15))); // a monster at full HP drops the field
			if (random() < 0.1) e.s = random() < 0.5 ? {} : { poisoned: { ms: Math.round(random() * 5000) } };
			if (random() < 0.1) e.target = random() < 0.5 ? undefined : "Someone"; // appears and disappears
			if (random() < 0.05) e.x = random() < 0.5 ? 5000 : 0; // leaves the view and comes back
		}
		const list = peers.map((e) => ({ id: e.id, entity: e, data: c.player_to_client(e, 1) }));
		for (const m of monsters)
			list.push({ id: m.id, entity: m, data: c.monster_to_client(m, random() < 0.1 ? ["hit"] : undefined) });
		if (random() > 0.1) c.send_xy_updates(delta, list); // sometimes a tick is skipped, like a backed-up socket
		c.send_xy_updates(plain, list);
		const expected = {};
		for (const entry of list) if (entry.json) expected[entry.id] = JSON.parse(entry.json); // out of everyone's view = never serialised
		for (const [event, data] of delta.sent.splice(0)) {
			for (const raw of [...(data.players || []), ...(data.monsters || [])]) {
				if (raw["~"]) (deltas++, (deltaBytes += JSON.stringify(raw).length));
				else (fulls++, (fullBytes += JSON.stringify(raw).length));
			}
			decoder.receive_entity_deltas({ data: [event, data] });
			if (event !== "entities") continue;
			for (const entity of [...data.players, ...data.monsters])
				assert.deepEqual(JSON.parse(JSON.stringify(entity)), expected[entity.id], `tick ${tick} ${entity.id}`); // the decoder runs in the client's realm
		}
		for (const [, data] of plain.sent.splice(0))
			for (const entity of data.players || [])
				assert.equal(entity["~"], undefined, "a client that did not ask gets full packets");
	}
	assert.ok(deltas > 1000 && fulls > 50, `both kinds were exercised: ${deltas} deltas, ${fulls} full`);
	assert.ok(deltaBytes / deltas < (fullBytes / fulls) * 0.6, "deltas are smaller than full packets");
});

test("a client fed deltas ends up with the same entities as one fed full packets", () => {
	const c = server(),
		fed = client(),
		reference = client(),
		delta = observer(),
		plain = observer();
	delta.socket.entity_delta = true;
	const peer = player({ s: { mluck: { ms: 1000, f: "Merch" } } });
	const steps = [
		() => (peer.hp = 80),
		() => Object.assign(peer, { moving: true, going_x: 120, move_num: 1 }),
		() => (peer.x = 30),
		() => Object.assign(peer, { moving: false, abs: true, x: 60 }),
		() => (peer.s = {}),
		() => (peer.target = "Goo"),
		() => delete peer.target,
	];
	send(c, delta, peer);
	send(c, plain, peer);
	for (const step of [null, ...steps]) {
		if (step) (step(), send(c, delta, peer), send(c, plain, peer));
		for (const [view, watcher] of [
			[fed, delta],
			[reference, plain],
		]) {
			for (const [event, data] of watcher.sent.splice(0)) {
				view.receive_entity_deltas({ data: [event, data] });
				view.handle_entities(data);
			}
			view.process_entities();
		}
		const pick = (e) =>
			JSON.stringify(e, [
				"id",
				"x",
				"y",
				"hp",
				"moving",
				"going_x",
				"going_y",
				"move_num",
				"abs",
				"target",
				"s",
				"ctype",
				"real_x",
				"real_y",
				"vx",
				"vy",
			]);
		assert.equal(pick(fed.entities.Peer), pick(reference.entities.Peer));
	}
});

test("a delta without its base asks for a complete view instead of applying it", () => {
	const view = client();
	const asked = [];
	view.socket = { emit: (event) => asked.push(event) };
	const data = { type: "xy", in: "main", map: "main", monsters: [], players: [{ id: "Ghost", "~": [], hp: 5 }] };
	view.receive_entity_deltas({ data: ["entities", data] });
	assert.equal(data.players.length, 0);
	assert.deepEqual(asked, ["send_updates"]);
});
