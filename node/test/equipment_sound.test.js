const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, extract, socketHandler } = require("./helpers/server_vm");
const G = require("./helpers/design");

function fixture() {
	let now = 1000;
	const played = [],
		responses = [];
	const functions = read("js/functions.js");
	const client = vm.createContext({
		G,
		character: { slots: {}, s: {} },
		character_slots: G.character_slots,
		trade_slots: G.trade_slots,
		no_graphics: false,
		no_html: false,
		sound_sfx: true,
		sfx_volume: 100,
		sounds: {},
		Dev: true,
		Date: { now: () => now },
		last_equipment_sound: {},
		in_arr: (value, list) => list.includes(value),
		url_factory: (url) => url,
		console: {
			log() {},
			warn() {},
			error(error) {
				throw error;
			},
		},
		resolve_deferred() {},
		reject_deferred() {},
		tut() {},
		call_code_function() {},
		draw_trigger() {},
		adopt_soft_properties: Object.assign,
		rip_logic() {},
		update_tutorial_state() {},
		add_alert(error) {
			throw error;
		},
	});
	client.window = client;
	vm.runInContext(read("js/pixi/fake/pixi.min.js"), client);
	Object.defineProperty(client, "PIXI", {
		get() {
			throw Error("Equipment sound touched PIXI");
		},
	});
	client.Howl = function (options) {
		this.options = options;
		let volume = options.volume;
		this.volume = (value) => (value === undefined ? volume : (volume = value));
		this.play = () => played.push({ url: options.src[0], volume });
		this.stop = () => {};
	};
	vm.runInContext(
		functions.slice(
			functions.indexOf("var audio_sound_names ="),
			functions.indexOf("\nfunction normalize_audio_volume"),
		),
		client,
	);
	for (const name of ["equipment_sound", "sfx", "apply_audio_volume", "init_fx"])
		vm.runInContext(extract(functions, name), client);
	client.init_fx();
	const receivers = {};
	client.socket = {
		on: (name, callback) => {
			receivers[name] = callback;
		},
	};
	const game = read("js/game.js");
	for (const event of ["game_response", "player"]) {
		const start = game.indexOf('\tsocket.on("' + event + '",');
		vm.runInContext(game.slice(start, game.indexOf("\n\tsocket.on(", start + 1)), client);
	}
	const socket = {
		id: "test",
		emit(event, data) {
			data = JSON.parse(JSON.stringify(data));
			if (event === "game_response") {
				responses.push(data);
			}
			if (receivers[event]) receivers[event](data);
		},
	};
	const player = {
		type: "warrior",
		items: [
			{ name: "sword", level: 0 },
			{ name: "coat", level: 0 },
		],
		slots: {},
		cslots: {},
		citems: {},
		s: {},
		esize: 40,
	};
	const server = vm.createContext({
		G,
		players: { test: player },
		socket,
		current_socket: socket,
		trade_slots: G.trade_slots,
		min: Math.min,
		to_number: Number,
		in_arr: (value, list) => list.includes(value),
		is_object: (value) => value && typeof value === "object",
		is_string: (value) => typeof value === "string",
		get_trade_slots: () => G.trade_slots,
		cache_item: (item) => item && { ...item },
		can_equip_item: (player, def, slot) => (slot === "weapon" ? "mainhand" : slot),
		resend: (player) => socket.emit("player", { slots: player.slots }),
		add_item: (player, item) => player.items.push(item),
	});
	for (const name of ["success_response", "fail_response"])
		vm.runInContext(extract(read("node/server_functions.js"), name), server);
	const handlers = Object.fromEntries(
		["equip", "equip_batch", "unequip"].map((name) => [name, socketHandler(server, name)]),
	);
	return {
		client,
		played,
		responses,
		player,
		receive: receivers.game_response,
		receivePlayer: receivers.player,
		advance: (ms = 300) => (now += ms),
		send(name, data) {
			server.ls_method = name;
			handlers[name](data);
		},
	};
}

test("successful equipment handlers play one local cue and preserve their responses", () => {
	const f = fixture();
	f.send("equip", { num: 0 });
	assert.equal(f.player.slots.mainhand.name, "sword");
	assert.equal(f.responses.at(-1).slot, "mainhand");
	f.advance();
	f.send("unequip", { slot: "mainhand" });
	assert.equal(f.player.slots.mainhand, null);
	assert.deepEqual(f.responses.at(-1), { success: true, response: "data", place: "unequip" });
	f.advance();
	f.send("equip_batch", [{ num: 2 }, { num: 1 }]);
	assert.deepEqual(
		f.played.map((sound) => sound.url),
		["/sounds/fx/equip.ogg?v=2", "/sounds/fx/unequip.ogg?v=2", "/sounds/fx/equip.ogg?v=2"],
	);
	f.advance();
	f.send("unequip", { slot: "mainhand" });
	f.advance();
	f.send("unequip", { slot: "mainhand" });
	assert.equal(f.responses.at(-1).failed, true);
	assert.equal(f.played.length, 4, "failed unequip is silent");
	f.player.slots.trade1 = { name: "sword" };
	f.send("unequip", { slot: "trade1" });
	assert.equal(f.played.length, 4, "removing a shop listing is silent");
});

test("unequip uses confirmed slot changes without depending on response metadata", () => {
	const f = fixture();
	f.send("equip", { num: 0 });
	f.advance(100);
	f.player.esize = 0;
	f.send("unequip", { slot: "mainhand" });
	assert.equal(f.played.length, 1, "full inventory failure is silent");
	f.player.esize = 40;
	f.send("unequip", { slot: "mainhand" });
	assert.equal(f.played.length, 2, "quick equip then unequip plays both cues");
	assert.equal(f.played[1].url, "/sounds/fx/unequip.ogg?v=2");
	f.advance();
	f.receive({ response: "data", success: true, place: "unequip", slot: "mainhand" });
	f.receivePlayer({ slots: { mainhand: null } });
	assert.equal(f.played.length, 2, "metadata and repeated state do not duplicate the cue");
	f.client.character.slots = { mainhand: { name: "sword" }, elixir: { name: "elixirluck" }, trade1: { name: "coat" } };
	f.receivePlayer({ slots: { elixir: null, trade1: null } });
	assert.equal(f.played.length, 2, "omitted gear slots, elixirs and shop listings are silent");
});

test("consumables, failures and empty batches are silent; partially successful batches play once", () => {
	const f = fixture();
	for (const data of [
		{ place: "equip", failed: true, slot: "mainhand" },
		{ place: "equip", success: false, slot: "mainhand" },
		{ place: "equip", slot: "trade1" },
		{ place: "equip", slot: "elixir" },
		{ place: "equip", used: "hpot0" },
		{ place: "equip_batch", slots: ["cant_equip"] },
		{ place: "equip_batch", slots: [] },
	])
		f.receive({ response: "data", success: true, ...data });
	assert.equal(f.played.length, 0);
	f.send("equip_batch", [{ num: 0 }, { num: 40 }]);
	assert.equal(f.player.slots.mainhand.name, "sword");
	assert.equal(f.responses.at(-1).slots[1], "invalid");
	assert.equal(f.played.length, 1);
});

test("equipment sounds respect rapid swaps, mute, volume and headless clients", () => {
	const f = fixture();
	const equip = { response: "data", success: true, place: "equip", slot: "mainhand" };
	f.client.sfx_volume = 20;
	f.client.apply_audio_volume("sfx");
	f.receive({ ...equip });
	assert.equal(f.played[0].volume, 0.1);
	f.advance(100);
	f.receive({ ...equip });
	assert.equal(f.played.length, 1);
	f.advance(150);
	f.receive({ ...equip });
	assert.equal(f.played.length, 2);
	for (const [key, disabled] of [
		["sound_sfx", false],
		["no_html", true],
		["no_graphics", true],
		["character", null],
	]) {
		const previous = f.client[key];
		f.client[key] = disabled;
		f.advance();
		f.receive({ ...equip });
		if (f.client.character) f.client.character.slots = { mainhand: { name: "sword" } };
		f.receivePlayer({ slots: { mainhand: null } });
		assert.equal(f.played.length, 2, key);
		f.client[key] = previous;
	}
	for (const name of ["equip", "unequip"]) {
		const options = f.client.sounds[name].options;
		assert.equal(options.format[0], "opus");
		assert.equal(options.format[1], "wav");
		assert.equal(options.src[1], "/sounds/fx/" + name + ".wav?v=2");
	}
});
