"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, read } = require("./helpers/server_vm");

test("a monster keeps its living target when splash kills a bystander", () => {
	const stopped = [];
	const c = vm.createContext({
		G,
		min: Math.min,
		max: Math.max,
		floor: Math.floor,
		gameplay: "normal",
		is_pvp: false,
		is_in_pvp: () => false,
		generated_entry: () => false,
		stop_pursuit: (monster) => stopped.push(monster.target),
		rip: (player) => {
			player.rip = true;
		},
	});
	load(c, "node/server.js", ["defeated_by_a_monster"]);
	const monster = { type: "mrpumpkin", target: "Tank", max_hp: 100000 };
	for (const name of ["Bystander", "Tank"]) {
		const player = { name, type: "merchant", xp: 0, max_xp: 1000, isize: 0, socket: { emit() {} } };
		c.defeated_by_a_monster(monster, player);
		assert.equal(player.rip, true);
		assert.equal(stopped.length, name === "Tank" ? 1 : 0);
	}
});

test("player attack cooldown follows the final frequency and restores after conditions expire", () => {
	const packets = [];
	const c = vm.createContext({
		...G,
		G,
		goldm: 1,
		luckm: 1,
		xpm: 1,
		mode: {},
		parties: {},
		perfc: { cps: 0 },
		recalculate_vxy() {},
		mssince: () => 100,
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats")), c);
	load(c, "node/server.js", ["apply_stats", "calculate_common_stats", "calculate_player_stats"]);
	const player = {
		type: "warrior",
		level: 50,
		xp: 0,
		gold: 0,
		hp: 1,
		mp: 1,
		items: [],
		citems: [],
		slots: {},
		s: {},
		p: {},
		map: "main",
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
		damage_type: "physical",
		last: { attack: new Date() },
		socket: { emit: (event, data) => packets.push({ event, data }) },
	};
	c.calculate_player_stats(player);
	const base = player.attack_ms;
	for (const state of [{ poisoned: {} }, { frozen: {} }, { poisoned: {}, frozen: {} }, {}]) {
		player.s = state;
		c.calculate_player_stats(player);
		assert.equal(player.attack_ms, Math.round(1000 / player.frequency));
		assert.equal(player.last_attack_ms, player.attack_ms);
		assert.equal(packets.at(-1).data.ms, player.attack_ms - 100);
	}
	assert.equal(player.attack_ms, base);
	player.tskin = "konami";
	c.calculate_player_stats(player);
	assert.equal(player.attack_ms, Math.round(1000 / player.frequency));
	assert.ok(player.attack_ms < base);
});
