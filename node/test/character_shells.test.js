const assert = require("node:assert/strict");
const vm = require("node:vm");
const test = require("node:test");
const { load, read, extract, socketHandler, transactions } = require("./helpers/server_vm");

function fixture({ cash = 100, pid = "", count = 5, slots = 5 } = {}) {
	let serial = 0;
	const owner = {
		_id: "US_fixture",
		name: "Existing",
		cash,
		pid,
		server: "",
		info: { slots, characters: Array.from({ length: count }, (_, i) => ({ name: i ? "Other" + i : "Existing" })) },
	};
	const character = {
		_id: "CH_existing",
		owner: owner._id,
		name: "existing",
		level: 80,
		created: new Date(0),
		info: { name: "Existing" },
	};
	const receiver = { _id: "US_receiver", cash: 0, info: { transfer_auth: "fixture", characters: [] } };
	const context = vm.createContext({
		console: { log() {}, error() {} },
		allowed_name_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
		character_types: ["rogue"],
		classes: { rogue: { looks: [["rogue", {}]] } },
		maps: { main: { spawns: [[0, 0]] } },
		get_domain: async () => ({}),
		get_character: async (_name, used) => (used ? null : structuredClone(store.records.get(character._id))),
		get_characterth: async () => 1,
		get_ip_info: async () => ({ info: {} }),
		put_ip_info: async () => {},
		get: async (id) => structuredClone(store.records.get(id)),
		random_string: () => "fixture" + ++serial,
		a_rand: () => 0,
		character_to_dict: (c) => ({ name: c.info.name }),
		selection_info: async () => ({ type: "content", html: "" }),
		add_event() {},
		increase_characterth() {},
		is_in_game: () => false,
		hsince: () => 100,
		really_old: new Date(0),
		to_pretty_num: String,
		delete_phrase_mark: async () => {},
		mainframe_assignment_record_id: () => "IE_fixture_assignment",
		mainframe_retire_assignment: async () => {},
		// Names are fixed valid fixtures; these tests exercise charging and transactions.
		is_safe_character_name: () => true,
	});
	load(context, "adventure_functions.js", ["gf", "simplify_name", "get_character_slots", "can_spend_shells"]);
	load(context, "api.js", [
		"sint",
		"can_create_character_check",
		"is_name_allowed",
		"is_name_xallowed",
		"create_character_api",
		"rename_character_api",
		"transfer_character_api",
	]);
	const store = transactions(context, [owner, character, receiver]);
	const saved = () => store.records.get(owner._id);
	return {
		context,
		...store,
		saved,
		async call(method, override = {}) {
			return context[method + "_api"]({
				user: structuredClone(saved()),
				req: {},
				res: { infs: [] },
				name: method === "create_character" ? "Created" + ++serial : "Existing",
				char: "rogue",
				look: 0,
				nname: "Renamed",
				id: receiver._id,
				auth: "fixture",
				...override,
			});
		},
	};
}

test("Steam-linked accounts keep their balance when creating their sixth, seventh and eighth characters", async () => {
	const f = fixture({ pid: "fixture-steam" });
	for (let count = 6; count <= 8; count++) {
		assert.equal((await f.call("create_character")).success, true);
		assert.equal(f.saved().cash, 100);
		assert.equal(f.saved().info.slots, 8);
		assert.equal(f.saved().info.characters.length, count);
	}
	assert.equal((await f.call("create_character")).reason, "reached_character_limit");
	f.saved().cash = 200;
	assert.equal((await f.call("create_character")).success, true);
	assert.equal(f.saved().cash, 0);
	assert.equal(f.saved().info.slots, 9);
});

test("ordinary accounts retain five included slots and can reuse a purchased empty slot without paying again", async () => {
	const f = fixture({ cash: 200, count: 4 });
	assert.equal((await f.call("create_character")).success, true);
	assert.equal(f.saved().cash, 200);
	assert.equal((await f.call("create_character")).success, true);
	assert.equal(f.saved().cash, 0);
	assert.equal(f.saved().info.slots, 6);
	f.saved().info.characters.pop();
	assert.equal((await f.call("create_character")).success, true);
	assert.equal(f.saved().cash, 0);
	assert.equal(f.saved().info.slots, 6);
});

test("creation rechecks stored funds, the hard limit and the bank lock before writing", async () => {
	for (const [changed, reason] of [
		[{ cash: 100 }, "reached_character_limit"],
		[
			{ info: { slots: 18, characters: Array.from({ length: 18 }, () => ({ name: "Existing" })) } },
			"cant_create_more_than_18",
		],
		[{ server: "SR_bank" }, "cant_make_changes_while_in_bank"],
	]) {
		const f = fixture({ cash: 1000 });
		const stale = structuredClone(f.saved());
		Object.assign(f.saved(), changed);
		const before = structuredClone(f.records);
		assert.equal((await f.call("create_character", { user: stale })).reason, reason);
		assert.deepEqual(f.records, before);
		assert.equal(f.stats.writes, 0);
	}
});

test("a slot filled after the free preflight cannot silently turn creation into a shell charge", async () => {
	const f = fixture({ count: 4, cash: 1000 });
	const stale = structuredClone(f.saved());
	f.saved().info.characters.push({ name: "Concurrent" });
	assert.equal((await f.call("create_character", { user: stale })).reason, "reached_character_limit");
	assert.equal(f.saved().cash, 1000);
	assert.equal(f.saved().info.characters.length, 5);
	assert.equal(f.stats.writes, 0);
});

test("simultaneous creations cannot spend the same shells or leave extra characters behind", async () => {
	const f = fixture({ cash: 200 });
	const results = await Promise.all([
		f.call("create_character"),
		f.call("create_character"),
		f.call("create_character"),
	]);
	assert.equal(results.filter((result) => result.success).length, 1);
	assert.equal(f.saved().cash, 0);
	assert.equal(f.saved().info.characters.length, 6);
	assert.equal([...f.records.keys()].filter((id) => id.startsWith("CH_fixture")).length, 1);
	assert.equal([...f.records.keys()].filter((id) => id.startsWith("MK_character-created")).length, 1);
});

test("negative and invalid balances cannot pay for character creation, renaming or transfer", async () => {
	for (const cash of [-500, -Number.MAX_SAFE_INTEGER, -Infinity, Infinity, NaN, "2000", Number.MAX_SAFE_INTEGER + 1]) {
		for (const method of ["create_character", "rename_character", "transfer_character"]) {
			const f = fixture({ cash });
			const before = structuredClone(f.records);
			assert.equal((await f.call(method)).failed, true, method + ": " + cash);
			assert.deepEqual(f.records, before);
			assert.equal(f.stats.writes, 0);
		}
	}
});

test("an existing negative balance does not block included characters or change account access", async () => {
	const f = fixture({ cash: -500, pid: "fixture-steam" });
	for (let i = 0; i < 3; i++) assert.equal((await f.call("create_character")).success, true);
	assert.equal(f.saved().cash, -500);
	assert.equal(f.saved().info.characters.length, 8);
	assert.equal(f.saved().banned, undefined);
	assert.equal(f.saved().server, "");
	assert.equal((await f.call("create_character")).failed, true);
});

test("rename and transfer reject a stale positive balance inside the transaction", async () => {
	for (const method of ["rename_character", "transfer_character"]) {
		const f = fixture({ cash: 1000 });
		const stale = structuredClone(f.saved());
		f.saved().cash = -500;
		const before = structuredClone(f.records);
		assert.equal((await f.call(method, { user: stale })).reason, "not_enough_shells");
		assert.deepEqual(f.records, before);
		assert.equal(f.stats.writes, 0);
	}
});

test("successful rename and transfer still charge the existing price exactly once", async () => {
	for (const [method, price] of [
		["rename_character", 640],
		["transfer_character", 500],
	]) {
		const f = fixture({ cash: price });
		assert.equal((await f.call(method)).success, true);
		assert.equal(f.saved().cash, 0);
		const character = f.records.get("CH_existing");
		assert.equal(
			method === "rename_character" ? character.name : character.owner,
			method === "rename_character" ? "renamed" : "US_receiver",
		);
	}
});

function gameFixture(cash, bank = false) {
	const G = require("./helpers/design");
	const owner = { _id: "US_fixture", cash, info: {} };
	const events = [],
		items = [];
	const player = {
		id: "fixture",
		name: "Fixture",
		owner: owner._id,
		cash: 1000000,
		gold: 100,
		hp: 100,
		xp: 100,
		p: {},
		s: {},
		items: [],
	};
	if (bank) {
		player.user = { gold: 100 };
		player.cuser = {};
	}
	const context = vm.createContext({
		G,
		players: { fixture: player },
		socket: { id: "fixture", emit: (event, data) => events.push({ event, data }) },
		gameplay: "normal",
		min: Math.min,
		max: Math.max,
		bank_packs: G.bank_packs,
		S: {},
		console: {
			log() {},
			error(error) {
				throw error;
			},
		},
		get: async () => structuredClone(store.records.get(owner._id)),
		can_add_item: () => true,
		create_new_item: (name, q) => ({ name, q }),
		add_item: (_p, item) => items.push(item),
		fail_response: (reason) => events.push({ event: "failure", reason }),
		success_response() {},
		resend() {},
		server_log() {},
		add_event() {},
		update_characters: async () => {},
		to_pretty_num: String,
		colors: { cash: "white" },
		disappearing_text() {},
		broadcast() {},
	});
	player.socket = context.socket;
	const store = transactions(context, [owner]);
	return { context, player, owner, events, items, ...store };
}

test("negative saved shells cannot buy items, bank packs or blessings despite a stale positive client balance", async () => {
	const G = require("./helpers/design");
	const item = Object.keys(G.items).find(
		(name) => G.items[name].cash > 0 && !G.items[name].ignore && !G.items[name].p2w,
	);
	const pack = Object.keys(G.bank_packs).find((name) => G.bank_packs[name][2] > 0);
	assert.ok(item && pack);
	for (const cash of [-500, -Number.MAX_SAFE_INTEGER]) {
		for (const [event, data, terminal] of [
			["buy_with_cash", { name: item, quantity: Number.MAX_SAFE_INTEGER }, "shell_purchase_failed"],
			["bless_server", {}, "bless_result"],
			["bank", { operation: "unlock", shells: 1, pack }, "bank_new_pack_failed"],
		]) {
			const f = gameFixture(cash, event === "bank");
			const before = structuredClone(f.records);
			socketHandler(f.context, event)({ ...data, request_id: "fixture-request" });
			for (let i = 0; i < 20; i++) await new Promise(setImmediate);
			const result = f.events.find((row) => row.event === "game_response" && row.data?.response === terminal)?.data;
			assert.equal(result?.reason, "not_enough", event);
			assert.equal(result?.failed, true, event);
			assert.deepEqual(f.records, before);
			assert.equal(f.stats.writes, 0);
			assert.equal(f.items.length, 0);
			assert.equal(f.context.S.blessed_minutes, undefined);
			assert.equal(f.player.hp, 100);
			assert.equal(f.player.xp, 100);
			assert.equal(f.player.gold, 100);
			if (event === "bank") assert.equal(f.player.user[pack], undefined);
		}
	}
});

test("earned shells increase a negative balance normally without changing sign through overflow", async () => {
	for (const cash of [-500, -Number.MAX_SAFE_INTEGER]) {
		const f = gameFixture(cash);
		f.player.cash = cash;
		load(f.context, "node/server.js", ["add_shells"]);
		f.context.add_shells(f.player, 5, "chest", false);
		for (let i = 0; i < 20; i++) await new Promise(setImmediate);
		assert.equal(f.records.get(f.owner._id).cash, cash + 5);
		assert.equal(f.player.cash, cash + 5);
		assert.equal(f.player.gold, 100);
	}
});

test("negative shells remain signed in the UI and wire format and do not amplify merchant shell rewards", () => {
	const { encode, decode } = require("@msgpack/msgpack");
	const G = require("./helpers/design");
	const rules = require("../logic/market_patron")(G.simple_distance);
	const config = G.npcs.citizen22.market;
	const c = vm.createContext({});
	vm.runInContext(extract(read("common/js/common_functions.js"), "to_pretty_num"), c);
	for (const cash of [-500, -Number.MAX_SAFE_INTEGER]) {
		assert.equal(decode(encode({ cash })).cash, cash);
		assert.equal(JSON.parse(JSON.stringify({ cash })).cash, cash);
		assert.equal(c.to_pretty_num(cash), cash.toLocaleString("en-US"));
		assert.equal(rules.shellChance(cash, config), rules.shellChance(0, config));
	}
});
