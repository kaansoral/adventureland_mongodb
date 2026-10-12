"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, socketHandler } = require("./helpers/server_vm");

function fixture(name) {
	const replies = [];
	const c = vm.createContext({
		G,
		Date,
		Math,
		Dev: false,
		Place: "server",
		gameplay: "normal",
		mode: {},
		B: { max_vision: 1000 },
		players: {},
		name_to_id: {},
		id_to_id: {},
		instances: { main: { map: "main", name: "main", players: {}, monsters: {} } },
		min: Math.min,
		max: Math.max,
		round: Math.round,
		floor: Math.floor,
		ceil: Math.ceil,
		is_disabled: G.is_disabled,
		is_silenced: G.is_silenced,
		distance: G.distance,
		is_pvp: false,
		future_ms: (ms) => new Date(Date.now() + ms),
		mssince: (d) => Date.now() - +d,
		fail_response: (reason, place, data) => replies.push({ failed: true, reason, place, ...data }),
		resend() {},
		add_pdps() {},
		xy_emit() {},
		add_call_cost() {},
		disappearing_text() {},
		log_trace: (name, error) => {
			throw error;
		},
	});
	function player(name) {
		const p = {
			id: name,
			name,
			owner: name,
			type: "mage",
			is_player: true,
			level: 80,
			hp: 1000,
			max_hp: 1000,
			mp: 500,
			max_mp: 1000,
			map: "main",
			in: "main",
			x: 0,
			y: 0,
			attack_ms: 1000,
			s: {},
			c: {},
			q: {},
			a: {},
			last: {},
			slots: {},
			socket: { id: "socket:" + name, emit: (event, data) => replies.push({ event, ...data }) },
		};
		c.players[p.socket.id] = p;
		c.name_to_id[name] = c.id_to_id[name] = p.socket.id;
		c.instances.main.players[name] = p;
		return p;
	}
	const caster = player("Caster"),
		target = player(name);
	target.mp = 1;
	c.socket = caster.socket;
	load(c, "node/server_functions.js", ["get_player", "is_invis", "is_in_pvp", "consume_mp", "consume_skill"]);
	const skill = socketHandler(c, "skill");
	return { c, caster, target, replies, skill };
}

for (const name of ["1234", "0123", "Player_1"]) {
	test(`player-only skills target ${name} without interpreting its name as a monster ID`, () => {
		const { c, caster, target, skill, replies } = fixture(name);
		c.instances.main.monsters[1234] = { id: 1234, is_monster: true, mp: 0 };
		skill({ name: "energize", id: name, mp: 40 });
		assert.equal(replies.at(-1).success, true);
		assert.equal(replies.at(-1).place, "energize");
		assert.equal(target.mp, 41);
		assert.equal(caster.mp, 460);
		assert.equal(c.instances.main.monsters[1234].mp, 0);
	});
}

test("a monster ID is still rejected by a player-only skill", () => {
	const { c, caster, target, skill, replies } = fixture("Player_1");
	c.instances.main.monsters[1234] = { id: 1234, is_monster: true, mp: 0 };
	skill({ name: "energize", id: 1234, mp: 40 });
	assert.equal(replies.at(-1).reason, "invalid_target");
	assert.equal(caster.mp, 500);
	assert.equal(target.mp, 1);
});
