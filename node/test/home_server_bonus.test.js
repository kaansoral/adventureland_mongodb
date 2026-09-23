const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const createServerInformation = require("../logic/server_information");
const { load } = require("./helpers/server_vm");
const G = require("./helpers/design");

const root = path.resolve(__dirname, "../..");
const serverFunctions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");

function loadHomeServerHelpers(clock = () => Date.now()) {
	const start = serverFunctions.indexOf("function recent_character_server");
	const end = serverFunctions.indexOf("function ghash", start);
	assert.notEqual(start, -1);
	assert.notEqual(end, -1);
	const context = vm.createContext({
		region: "EU",
		server_name: "1",
		G,
		server_information: createServerInformation("SR_EU1"),
		Date: class extends Date {
			constructor(value) {
				super(value === undefined ? clock() : value);
			}
			static now() {
				return clock();
			}
		},
		msince(value) {
			return (clock() - new Date(value).getTime()) / 60000;
		},
		get_id(value) {
			return value._id;
		},
		max: Math.max,
		in_arr: G.in_arr,
		server_log() {},
		db: {
			collection() {
				throw new Error("fatigue checks must not access the database");
			},
		},
	});
	vm.runInContext(serverFunctions.slice(start, end), context);
	vm.runInContext(fs.readFileSync(path.join(root, "node/logic/encouragement.js"), "utf8"), context);
	load(context, "node/server_functions.js", ["add_condition"]);
	return context;
}

function player(type = "warrior") {
	return { real_id: "CH_current", name: "Current", owner: "US_owner", cid: 1, type, p: { home: "EU1" }, s: {} };
}

function sibling({ id = "CH_other", type = "mage", server = "", minutesAgo = 1, lastServer = "" } = {}) {
	return {
		_id: id,
		type,
		server,
		last_online: new Date(Date.now() - minutesAgo * 60000),
		info: { p: { entries: lastServer ? [[lastServer, new Date()]] : [] } },
	};
}

test("recent non-merchant activity on another server applies Realm Fatigue", () => {
	const context = loadHomeServerHelpers();
	const current = player();
	context.realmfatigue_logic(current, [sibling({ id: "CH_current", server: "SR_EU1" }), sibling({ server: "SR_US1" })]);
	assert.equal(current.s.realmfatigue.ms, 30 * 60 * 1000);
	assert.equal(context.has_home_server_bonus(current), false);
});

test("the saved last server catches recent characters after logout", () => {
	const context = loadHomeServerHelpers();
	const current = player();
	context.realmfatigue_logic(current, [sibling({ lastServer: "US2" })]);
	assert.ok(current.s.realmfatigue);
});

test("merchants, same-server activity, and old activity do not cause Realm Fatigue", () => {
	const context = loadHomeServerHelpers();
	for (const other of [
		sibling({ type: "merchant", server: "SR_US1" }),
		sibling({ server: "SR_EU1" }),
		sibling({ server: "SR_US1", minutesAgo: 31 }),
	]) {
		const current = player();
		context.realmfatigue_logic(current, [other]);
		assert.equal(current.s.realmfatigue, undefined);
		assert.equal(context.has_home_server_bonus(current), true);
	}

	const merchant = player("merchant");
	context.realmfatigue_logic(merchant, [sibling({ server: "SR_US1" })]);
	assert.equal(merchant.s.realmfatigue, undefined);
});

test("home contribution and home drops share the same eligibility helper", () => {
	const server = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
	assert.match(server, /realmfatigue_logic\(player, characters\)/);
	assert.equal((server.match(/has_home_server_bonus\(/g) || []).length, 2);
});

function foreignSnapshot(context, lastOnline, changes = {}) {
	context.server_information.receive(
		[
			{
				_id: "SR_US1",
				online: false,
				info: {
					recent_characters: { CH_other: { owner: "US_owner", type: "mage", last_online: lastOnline, ...changes } },
				},
			},
		],
		lastOnline + 1000,
	);
}

test("prelogging characters onto the destination cannot erase the previous server's history", () => {
	let now = Date.now();
	const context = loadHomeServerHelpers(() => now);
	const current = player();
	foreignSnapshot(context, now - 1000);
	const washedHistory = [sibling({ server: "SR_EU1" })];
	context.realmfatigue_logic(current, washedHistory);
	const until = current.s.realmfatigue.until;
	assert.equal(until, now + G.conditions.realmfatigue.duration);
	now += 10000;
	context.realmfatigue_logic(current, washedHistory);
	assert.equal(current.s.realmfatigue.until, until, "relogin neither clears nor restarts the deadline");
	assert.equal(current.s.realmfatigue.ms, until - now);
});

test("cached foreign activity affects already-online characters without extending stale observations", () => {
	let now = Date.now();
	const context = loadHomeServerHelpers(() => now);
	load(context, "node/server.js", ["add_coop_points"]);
	const current = player();
	let monster = { id: "test", cooperative: true, points: {} };
	context.add_coop_points(monster, current, 100);
	assert.equal(monster.points.Current, 500);
	foreignSnapshot(context, now - 60000);
	context.realmfatigue_logic(current);
	const until = now - 60000 + G.conditions.realmfatigue.duration;
	assert.equal(current.s.realmfatigue.until, until);
	monster = { id: "test", cooperative: true, points: {} };
	context.add_coop_points(monster, current, 100);
	assert.equal(monster.points.Current, 100);
	now += 30000;
	context.realmfatigue_logic(current);
	assert.equal(current.s.realmfatigue.until, until);
	foreignSnapshot(context, now);
	context.realmfatigue_logic(current);
	assert.equal(current.s.realmfatigue.until, now + G.conditions.realmfatigue.duration);
	now = current.s.realmfatigue.until + 1;
	context.realmfatigue_logic(current);
	assert.equal(current.s.realmfatigue, undefined);
	assert.equal(context.has_home_server_bonus(current), true);
});

test("saved deadlines survive reconnects and legacy countdowns are preserved once", () => {
	let now = Date.now();
	const context = loadHomeServerHelpers(() => now);
	const current = player();
	current.s.realmfatigue = { ms: 60000 };
	context.realmfatigue_logic(current, []);
	assert.equal(current.s.realmfatigue.until, now + 60000);
	load(context, "node/server.js", ["player_to_server", "sync_entity"]);
	const entity = { info: {} };
	context.sync_entity(entity, context.player_to_server(current));
	const saved = JSON.parse(JSON.stringify({ ...current, s: entity.info.s }));
	now += 20000;
	context.realmfatigue_logic(saved, []);
	assert.equal(saved.s.realmfatigue.ms, 40000);
	now += 40001;
	context.realmfatigue_logic(saved, []);
	assert.equal(saved.s.realmfatigue, undefined);
});

test("cached merchant activity and other owners do not cause fatigue", () => {
	const now = Date.now();
	const context = loadHomeServerHelpers(() => now);
	for (const changes of [{ type: "merchant" }, { owner: "US_someone_else" }]) {
		foreignSnapshot(context, now, changes);
		const current = player();
		context.realmfatigue_logic(current);
		assert.equal(current.s.realmfatigue, undefined);
	}
	foreignSnapshot(context, now);
	const merchant = player("merchant");
	context.realmfatigue_logic(merchant);
	assert.equal(merchant.s.realmfatigue, undefined);
});
