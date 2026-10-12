"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read } = require("./helpers/server_vm");
const { server, client, player, observer, send } = require("./helpers/entity_updates");

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
	assert.equal(watcher.seen.Peer, 1, "the client still holds the entity");
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
