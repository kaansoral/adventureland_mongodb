"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadSection(context, file, start, end) {
	const source = fs.readFileSync(path.join(root, file), "utf8");
	const from = source.indexOf(start);
	const to = source.indexOf(end, from + start.length);
	assert.ok(from >= 0 && to > from, file + " section exists");
	vm.runInContext(source.slice(from, to), context, { filename: file });
}

function fixture() {
	const item = {
		name: "staff",
		level: 3,
		q: 1,
		stat_type: "int",
		p: "shiny",
		ps: ["shiny"],
		l: "u",
		ld: "2026-09-20T00:00:00.000Z",
		m: "Merchant",
		v: "2026-09-19T00:00:00.000Z",
		r: true,
		skin: "staff",
		charges: 2,
		data: "public item data",
		expires: "2026-10-01T00:00:00.000Z",
		gift: true,
		acl: true,
		grace: 123,
		o: "private-fixture",
		oo: "private-fixture",
		src: "private-fixture",
		b: "private-fixture",
		price: 999,
		rid: "private-fixture",
		gf: "private-fixture",
		giveaway: 60,
		list: ["private-fixture"],
		future_private_field: "private-fixture",
	};
	const character = {
		_id: "CH_owned",
		owner: "US_owner",
		name: "Owned",
		type: "mage",
		level: 42,
		online: true,
		info: {
			name: "Owned",
			xp: 42,
			hp: 100,
			mp: 200,
			map: "main",
			x: 5,
			y: 10,
			gold: 500,
			items: [item, null, { name: "placeholder", p: { chance: 0.5, name: "staff", nums: [1] } }],
			slots: { mainhand: item, offhand: null },
			s: { mluck: { ms: 3000, f: "Merchant" } },
			q: { upgrade: { ms: 500, len: 4000, num: 2 } },
			secret: "private-fixture",
			auth: "private-fixture",
			p: {
				item_num: 17,
				u_roll: 0.125,
				u_item: item,
				mas_auth_id: "private-fixture",
				future_private_field: "private-fixture",
			},
		},
	};
	const user = { _id: "US_owner", info: { items0: [item, null], gold: 700, password: "private-fixture" } };
	const other = {
		...character,
		_id: "CH_other",
		owner: "US_other",
		name: "Other",
		info: { ...character.info, name: "Other" },
	};
	const context = vm.createContext({
		Buffer,
		URL,
		Date,
		crypto,
		console,
		setTimeout,
		clearTimeout,
		REF: {},
		app: { get() {}, post() {} },
		phrase: require("../../languages").phrase,
		get_id: (value) => value._id,
		gf: (value, field, fallback) => (value[field] === undefined ? fallback : value[field]),
		get_characters: async () => [character, other],
		mainframe_get_assignment: async () => null,
		mainframe_get_access: async () => ({ active: false }),
		mainframe_get_steam_time: async () => null,
		admin_bots_find: async () => null,
		admin_bots_snapshot: async () => ({ online: false, bots: [] }),
		MAINFRAME_PERIOD_SHELLS: 1,
		MAINFRAME_PERIOD_MS: 3600000,
		mainframe_renewal_schedule: () => [],
		MAINFRAME_GROUP_MAX_WORKERS: 4,
		items: { staff: { type: "weapon", wtype: "staff" }, placeholder: { type: "placeholder" } },
		classes: { mage: { main_stat: "int" } },
	});
	vm.runInContext(fs.readFileSync(path.join(root, "mcp_api.js"), "utf8"), context, { filename: "mcp_api.js" });
	loadSection(
		context,
		"admin_bots.js",
		"async function admin_bots_owned_character(",
		'app.post("/internal/bots/control"',
	);
	const authenticate = context.get_mcp_api_user;
	context.get_mcp_api_user = async (token) => (token === "test-token" ? user : null);
	return { context, character, item, user, authenticate };
}

function response() {
	return {
		status(code) {
			this.statusCode = code;
			return this;
		},
		set() {
			return this;
		},
		send(body) {
			this.body = plain(body);
			return this;
		},
		end() {
			return this;
		},
	};
}

async function jsonCall(context, method, args = {}, token = "test-token") {
	const res = response();
	await context.handle_mcp_api_call({ params: { method }, body: { ...args, token } }, res);
	return res.body;
}

async function rpcCall(context, method, params = {}, token = "test-token") {
	const res = response();
	await context.handle_mcp_transport(
		{
			get: (name) => (name === "authorization" ? "Bearer " + token : ""),
			body: { jsonrpc: "2.0", id: 1, method, params },
		},
		res,
	);
	return res.body;
}

test("saved profiles omit private progress and item metadata without changing the record", () => {
	const { context, character } = fixture();
	const before = plain(character);
	const profile = plain(context.mcp_api_character_profile(character, true));
	assert.equal(Object.hasOwn(profile, "progress"), false);
	assert.doesNotMatch(JSON.stringify(profile), /private-fixture|item_num|u_roll|grace|future_private_field/);
	assert.equal(profile.inventory.length, 3);
	assert.equal(profile.inventory_items, 2);
	assert.equal(profile.inventory[1], null);
	assert.deepEqual(profile.inventory[2], character.info.items[2]);
	assert.deepEqual(profile.conditions, character.info.s);
	assert.deepEqual(profile.quests, character.info.q);
	assert.deepEqual(character, before);
});

test("equipment and trade-slot visibility matches native cache_player_items", () => {
	const { context, character, item } = fixture();
	const native = vm.createContext({});
	loadSection(native, "js/old_common_functions.js", "var character_slots=", "var attire_slots=");
	loadSection(native, "js/old_common_functions.js", "var trade_slots=", "var bank_packs=");
	loadSection(native, "node/server_functions.js", "var item_p_ignore =", "function init_bank(");
	for (const [type, level, progress] of [
		["mage", 42, {}],
		["mage", 42, { trades: true }],
		["mage", 42, { stand: "stand0" }],
		["merchant", 65, { stand: "cstand" }],
		["merchant", 70, { stand: "stand0" }],
		["merchant", 80, { stand: "stand0" }],
	]) {
		character.type = type;
		character.level = level;
		character.info.p = progress;
		character.info.slots.internal = item;
		for (let i = 1; i <= 48; i++)
			character.info.slots["trade" + i] = { ...item, b: "buy", rid: "listing", gf: "Merchant", list: ["Player"] };
		const player = { ...character.info, type, level };
		native.cache_player_items(player);
		const exposed = context.mcp_api_character_profile(character, true).equipment;
		const expected = Object.keys(player.cslots)
			.filter((slot) => Object.hasOwn(character.info.slots, slot))
			.sort();
		assert.deepEqual(Object.keys(exposed).sort(), expected);
		assert.deepEqual(
			Object.keys(context.mcp_api_progression_state(character).equipment).sort(),
			expected.filter((slot) => character.info.slots[slot]),
		);
		for (const slot of Object.keys(exposed)) {
			for (const field of Object.keys(exposed[slot] || {}))
				assert.deepEqual(plain(exposed[slot][field]), plain(player.cslots[slot][field]));
		}
	}
});

test("MCP item projections stay within the actual game-client visibility boundary", () => {
	const { context, item, character } = fixture();
	const native = vm.createContext({});
	loadSection(native, "node/server_functions.js", "var item_p_ignore =", "function get_trade_slots(");
	loadSection(native, "node/server.js", "function player_to_client(", "function monster_to_client(");
	for (const trade of [false, true]) {
		const saved = { ...item, b: "buy", rid: "listing", gf: "Merchant", list: ["Player"] };
		const visible = plain(native.cache_item(saved, trade));
		const exposed = plain(context.mcp_api_public_item(saved, trade));
		for (const key of Object.keys(exposed)) {
			assert.ok(Object.hasOwn(visible, key), key + " is visible to a normal client");
			assert.deepEqual(exposed[key], visible[key]);
		}
		for (const key of Object.keys(trade ? native.item_trade_p_ignore : native.item_p_ignore)) {
			assert.equal(
				Object.hasOwn(context.mcp_api_public_item({ name: "staff", [key]: "private-fixture" }, trade), key),
				false,
				key,
			);
		}
		assert.equal(exposed.future_private_field, undefined);
		assert.equal(exposed.level, 3);
		assert.equal(exposed.l, "u");
		assert.equal(exposed.p, "shiny");
		assert.equal(exposed.data, "public item data");
		assert.equal(exposed.price, trade ? 999 : undefined);
		assert.equal(exposed.b, trade ? "buy" : undefined);
	}
	const client = plain(
		native.player_to_client({ ...character.info, type: character.type, citems: [], cslots: {} }, false),
	);
	assert.equal(client.p, undefined);
	assert.deepEqual(client.s, character.info.s);
	assert.deepEqual(client.q, character.info.q);
	assert.equal(context.mcp_api_public_item({ name: "staff", list: ["Player"] }, true).list, undefined);
});

test("JSON, MCP tools, resources, prompts, and signed-in API share the safe profile", async () => {
	const { context, user } = fixture();
	const direct = await jsonCall(context, "mainframe_get_character", { character: "Owned" });
	const tool = await rpcCall(context, "tools/call", {
		name: "mainframe_get_character",
		arguments: { character: "Owned" },
	});
	const resource = await rpcCall(context, "resources/read", { uri: "adventureland://mainframe/characters/Owned" });
	const session = await context.REF.mainframe_get_character.F({ user, character: "Owned" });
	context.mcp_api_get_doc = async () => ({ success: true, content: "Public guide." });
	const prompt = await rpcCall(context, "prompts/get", {
		name: "improve_character",
		arguments: { character: "Owned" },
	});
	const embedded = prompt.result.messages.find(
		(entry) => entry.content.resource?.uri === "adventureland://mainframe/characters/Owned",
	);
	for (const result of [
		direct,
		tool.result.structuredContent,
		JSON.parse(resource.result.contents[0].text),
		session,
		JSON.parse(embedded.content.resource.text),
	]) {
		assert.equal(result.success, true);
		assert.deepEqual(plain(result.profile), direct.profile);
		assert.doesNotMatch(JSON.stringify(result), /private-fixture|item_num|u_roll|grace|future_private_field/);
	}
	assert.doesNotMatch(JSON.stringify(prompt), /private-fixture|item_num|u_roll|grace|future_private_field/);
});

test("bank and progression projections do not reveal item grace or private block flags", async () => {
	const { context, user } = fixture();
	const bank = await jsonCall(context, "get_bank");
	const resource = await rpcCall(context, "resources/read", { uri: "adventureland://account/bank" });
	const progression = await context.mcp_api_plan_character_progression({ user, character: "Owned" });
	for (const result of [bank, JSON.parse(resource.result.contents[0].text), progression]) {
		assert.equal(result.success, true);
		assert.doesNotMatch(JSON.stringify(result), /private-fixture|"grace"|"blocked"|future_private_field/);
	}
	assert.deepEqual(bank.packs.items0, [
		{ name: "staff", level: 3, q: 1, stat_type: "int", p: "shiny", locked: true },
		null,
	]);
});

test("another account's character and invalid tokens cannot access any profile surface", async () => {
	const { context } = fixture();
	const direct = await jsonCall(context, "mainframe_get_character", { character: "Other" });
	const tool = await rpcCall(context, "tools/call", {
		name: "mainframe_get_character",
		arguments: { character: "Other" },
	});
	const resource = await rpcCall(context, "resources/read", { uri: "adventureland://mainframe/characters/Other" });
	assert.equal(direct.reason, "character_not_found");
	assert.equal(tool.result.structuredContent.reason, "character_not_found");
	assert.equal(JSON.parse(resource.result.contents[0].text).error.code, "character_not_found");
	assert.equal(
		(await jsonCall(context, "mainframe_get_character", { character: "Owned" }, "wrong-token")).reason,
		"invalid_token",
	);
	assert.equal(
		(
			await rpcCall(
				context,
				"tools/call",
				{ name: "mainframe_get_character", arguments: { character: "Owned" } },
				"wrong-token",
			)
		).error.code,
		-32001,
	);
	assert.doesNotMatch(JSON.stringify([direct, tool, resource]), /private-fixture|"profile"|"inventory"/);
});

test("method names and arguments cannot use inherited properties or internal handlers", async () => {
	const { context } = fixture();
	for (const key of ["__proto__", "constructor", "prototype", "toString", "F", "user", "req", "res"]) {
		const args = JSON.parse('{"character":"Owned",' + JSON.stringify(key) + ':{"owner":"US_other"}}');
		assert.equal((await jsonCall(context, "mainframe_get_character", args)).reason, "invalid_field", key);
		assert.equal(
			(await rpcCall(context, "tools/call", { name: "mainframe_get_character", arguments: args })).error.code,
			-32602,
			key,
		);
	}
	for (const name of ["__proto__", "constructor", "toString"]) {
		assert.equal((await jsonCall(context, name)).reason, "invalid_call");
		assert.equal((await rpcCall(context, "tools/call", { name, arguments: {} })).error.code, -32601);
	}
});

test("equivalent resource URLs and embedded prompts retain the expensive-read limits", () => {
	const { context } = fixture();
	for (const uri of [
		"adventureland://progression/characters/Owned",
		"adventureland://progression//characters//Owned/",
		"adventureland://progression/%63haracters/Owned",
	])
		assert.equal(context.mcp_api_rate_profile("resources/read", { uri }).name, "progression", uri);
	for (const uri of ["adventureland://game-data/items", "adventureland://game-data//items/"]) {
		assert.equal(context.mcp_api_rate_profile("resources/read", { uri }).name, "bulk", uri);
	}
	assert.equal(context.mcp_api_rate_profile("prompts/get", { name: "improve_character" }).name, "progression");
	const now = Date.now();
	assert.equal(context.mcp_api_take_rate("test-token", "plan_character_progression", {}, now).allowed, true);
	assert.equal(
		context.mcp_api_take_rate("test-token", "prompts/get", { name: "improve_character" }, now).allowed,
		true,
	);
	assert.equal(
		context.mcp_api_take_rate(
			"test-token",
			"resources/read",
			{ uri: "adventureland://progression//characters/Owned" },
			now,
		).allowed,
		false,
	);
});

test("token lookup fails closed for revoked, rotated, malformed, or banned credentials", async () => {
	const { context, user, authenticate } = fixture();
	const token = "mcp_" + "A".repeat(43);
	const hash = context.mcp_api_hash_token(token);
	const owner = { token_hash: hash };
	const records = new Map([
		[context.mcp_api_token_record_id(hash), { owner: user._id }],
		[context.mcp_api_user_record_id(user._id), owner],
		[user._id, user],
	]);
	let lookups = 0;
	context.get = async (key) => {
		lookups++;
		assert.equal(key.includes(token), false);
		return records.get(key);
	};
	for (const invalid of [null, {}, { $ne: null }, "", "wrong", "mcp_" + "A".repeat(10000)])
		assert.equal(await authenticate(invalid), null);
	assert.equal(lookups, 0);
	assert.equal(await authenticate(token), user);
	owner.token_hash = "rotated";
	assert.equal(await authenticate(token), null);
	owner.token_hash = hash;
	user.banned = true;
	assert.equal(await authenticate(token), null);
	delete user.banned;
	records.delete(context.mcp_api_token_record_id(hash));
	assert.equal(await authenticate(token), null);
});

test("CODE relays reject other accounts and untrusted destinations without opening a connection", async () => {
	const { context, character, user } = fixture();
	context.mcp_api_comm_io = () => {
		throw new Error("Must not connect");
	};
	character.server = "SR_USI";
	character.info.secret = "a".repeat(32);
	assert.equal(
		(await context.mcp_api_browser_code_eval({ user, character: "Other", code: "attack('target')" })).reason,
		"character_not_found",
	);
	assert.equal(
		(await context.mcp_api_mainframe_code_eval({ user, character: "Other", code: "attack('target')" })).reason,
		"character_not_found",
	);
	for (const url of [
		"https://evil.example",
		"https://adventure.land.evil.example",
		"https://127.0.0.1",
		"file:///tmp/private",
		"https://user:password@adventure.land",
		"http://us1.adventure.land",
		"https://us1.adventure.land/private",
	]) {
		context.mainframe_resolve_server = async () => ({ url });
		const result = await context.mcp_api_browser_code_eval({ user, character: "Owned", code: "attack('target')" });
		assert.equal(result.reason, "server_unavailable", url);
		assert.equal(JSON.stringify(result).includes(character.info.secret), false);
	}
});

test("documentation and game-data reads cannot name private files or inherited records", async () => {
	const { context } = fixture();
	context.docs = { guide: [], references: [], functions: [] };
	context.get_mcp_api_game_data = () => ({ items: { staff: { name: "Staff" } } });
	context.shtml = () => {
		throw new Error("Must not read files");
	};
	for (const name of ["../../secretsandconfig/keys", "__proto__", "constructor"]) {
		assert.equal((await context.mcp_api_get_doc({ name })).reason, "not_found");
		assert.equal((await context.mcp_api_get_code_method({ name })).reason, "not_found");
		assert.equal((await context.mcp_api_get_game_data({ section: "items", name })).reason, "not_found");
	}
	assert.equal((await context.mcp_api_get_game_data({ section: "__proto__" })).reason, "invalid_section");
});

test("every MCP game-data section is also published in normal browser data", async () => {
	const { context } = fixture();
	for (const field of [
		"achievements",
		"animations",
		"classes",
		"conditions",
		"cosmetics",
		"craft",
		"dimensions",
		"dismantle",
		"docs",
		"drops",
		"events",
		"games",
		"imagesets",
		"items",
		"levels",
		"maps",
		"monsters",
		"multipliers",
		"npcs",
		"positions",
		"projectiles",
		"sets",
		"skills",
		"sprites",
		"tilesets",
		"titles",
		"tokens",
		"upgrades",
		"compounds",
		"monster_gold",
	])
		context[field] = {};
	context.Version = 1;
	context.precomputed = { images: {} };
	loadSection(context, "main.js", "async function get_browser_data(", "// Shells / Payment page");
	const browser = await context.get_browser_data();
	for (const [section, data] of Object.entries(context.get_mcp_api_game_data())) {
		assert.ok(Object.hasOwn(browser, section), section);
		assert.equal(data, browser[section], section);
	}
});

test("runtime observations remove unknown private fields and reject mismatched assignments", async () => {
	const { context, character, user } = fixture();
	context.ADMIN_BOTS_GROUP_MAX_WORKERS = 4;
	loadSection(context, "admin_bots.js", "function admin_bots_number(", "function admin_bots_clean_report(");
	const raw = {
		bot_id: "Owned",
		character_id: character._id,
		assignment_id: "a".repeat(32),
		auth: "private-fixture",
		token: "private-fixture",
		secret: "private-fixture",
		internal: "private-fixture",
		observation: {
			source: "game_server",
			map: "main",
			p: character.info.p,
			secret: "private-fixture",
			inventory: [{ name: "staff", level: 3, auth: "private-fixture" }],
		},
		startup: { bootstrapped_ms: 1, auth: "private-fixture" },
	};
	context.admin_bots_find = async () => context.admin_bots_clean_bot(raw);
	context.mainframe_get_assignment = async () => ({ character_id: character._id, assignment_id: "a".repeat(32) });
	const result = await context.mcp_api_get_mainframe_character({ user, character: "Owned" });
	assert.equal(result.runtime.character, "Owned");
	assert.equal(result.runtime.observation.inventory[0].name, "staff");
	assert.doesNotMatch(JSON.stringify(result), /private-fixture|item_num|u_roll/);
	for (const mismatch of [{ character_id: "CH_other" }, { assignment_id: "b".repeat(32) }]) {
		context.admin_bots_find = async () => context.admin_bots_clean_bot({ ...raw, ...mismatch });
		assert.equal((await context.mcp_api_get_mainframe_character({ user, character: "Owned" })).runtime, null);
	}
});
