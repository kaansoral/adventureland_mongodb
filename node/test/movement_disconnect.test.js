"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { socketHandler, load } = require("./helpers/server_vm");

test("disconnect saves the server position, not a nearby untraveled destination", () => {
	for (const destination of [
		[700, -100],
		[101, 200],
		[9000, 200],
	]) {
		const player = {
			id: "P",
			name: "P",
			real_id: "P",
			x: 100,
			y: 200,
			map: "main",
			in: "main",
			moving: true,
			going_x: destination[0],
			going_y: destination[1],
			bets: {},
			s: {},
		};
		let saved;
		const c = vm.createContext({
			socket: { id: "P" },
			players: { P: player },
			observers: {},
			sockets: {},
			dc_players: {},
			gameplay: "normal",
			instances: { main: { players: { P: player } } },
			server_information: { remember() {} },
			generated_entry: () => null,
			generated_disconnect: () => false,
			defeat_player() {},
			remove_entity_emit() {},
			server_log() {},
			pmap_remove() {},
			tavern_wheel_disconnect() {},
			tavern_slots_disconnect() {},
			tavern_poker_disconnect() {},
			log_trace(_label, error) {
				throw error;
			},
			distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
			sync_loop() {
				saved = { x: player.x, y: player.y, moving: player.moving };
			},
		});
		load(c, "node/server.js", ["restore_state"]);
		socketHandler(c, "disconnect")();
		assert.deepEqual(saved, { x: 100, y: 200, moving: false });
		assert.equal(c.dc_players.P, player);
		assert.equal(c.players.P, undefined);
	}
});
