const vm = require("node:vm");
const { load, read } = require("./server_vm");
const { RawFrame } = require("../../json_parser");

function player(extra = {}) {
	return Object.assign(
		{
			id: "Peer",
			type: "mage",
			hp: 100,
			x: 0,
			y: 0,
			speed: 40,
			moving: false,
			going_x: 0,
			going_y: 0,
			move_num: 0,
			abs: false,
			s: {},
			cx: {},
			in: "main",
			map: "main",
		},
		extra,
	);
}

function observer(id = "Watcher", x = 0, y = 0, into = "main") {
	const sent = [];
	return {
		id,
		x,
		y,
		in: into,
		map: into,
		s: {},
		vision: [700, 500],
		sent,
		socket: {
			emit(event, data) {
				sent.push([event, JSON.parse(JSON.stringify(data))]);
			},
		},
	};
}

function server() {
	const c = vm.createContext({
		Buffer,
		RawFrame,
		mode: {},
		B: { xy_backlog_limit: 262144, u_vision: 65 },
		instances: { main: { players: {}, monsters: {}, observers: {} } },
		players: {},
		observers: {},
		perfc: { sxyu: 0, xy_skipped: 0 },
		G: { monsters: { goo: { hp: 100 } } },
		is_cavalry: () => false,
		abs: Math.abs,
	});
	load(c, "js/old_common_functions.js", ["get_x", "get_y", "within_xy_range"]);
	load(c, "node/server_functions.js", [
		"is_invis",
		"socket_backlog",
		"send_all_xy",
		"remove_entity_emit",
		"xy_upush_logic",
	]);
	load(c, "node/server.js", ["send_xy_updates", "player_to_client", "monster_to_client"]);
	return c;
}

function client() {
	const calls = [];
	const c = vm.createContext({
		current_in: "main",
		current_map: "main",
		entities_in: "main",
		entities_map: "main",
		character: { id: "Watcher", x: 0, y: 0, in: "main", vision: [700, 500] },
		entities: {},
		future_entities: { players: {}, monsters: {} },
		log_flags: {},
		clean_house: false,
		first_entities: true,
		erec: 0,
		last_light: 0,
		ctarget: null,
		xtarget: null,
		gtest: false,
		no_graphics: true,
		G: { monsters: {} },
		attire_slots: [],
		EPS: 1e-8,
		sqrt: Math.sqrt,
		sq: (n) => n * n,
		round: Math.round,
		set_direction() {},
		call_code_function: (name, entity, data) => calls.push([name, entity.id, data]),
		calls,
		mssince: (date) => Date.now() - date,
		socket: { emit() {} },
		add_character: (p) => Object.assign({}, p, { type: "character", real_x: p.x, real_y: p.y }),
		map: { real_x: 0, real_y: 0, addChild() {} },
		round_entities_xy: false,
		destroy_sprite() {},
		update_sprite() {},
	});
	c.window = c;
	const source = read("js/game.js");
	vm.runInContext(
		source.slice(source.indexOf("var asp_skip = {}"), source.indexOf("function adopt_soft_properties(")),
		c,
	);
	load(c, "js/old_common_functions.js", ["get_x", "get_y", "within_xy_range", "simple_distance", "calculate_vxy"]);
	load(c, "js/game.js", [
		"handle_entities",
		"sync_entity",
		"adopt_soft_properties",
		"process_entities",
		"on_disappear",
		"draw_entities",
	]);
	return c;
}

function send(c, watcher, entity) {
	return c.send_xy_updates(watcher, [
		{ entity, data: entity.is_monster ? c.monster_to_client(entity) : c.player_to_client(entity, 1) },
	]);
}

module.exports = { server, client, player, observer, send };
