const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const serverFunctions = fs.readFileSync(path.join(root, "node/server_functions.js"), "utf8");

function loadHomeServerHelpers() {
	const start = serverFunctions.indexOf("function recent_character_server");
	const end = serverFunctions.indexOf("function ghash", start);
	assert.notEqual(start, -1);
	assert.notEqual(end, -1);
	const context = vm.createContext({
		region: "EU",
		server_name: "1",
		G: { conditions: { realmfatigue: { duration: 30 * 60 * 1000 } } },
		msince(value) {
			return (Date.now() - new Date(value).getTime()) / 60000;
		},
		get_id(value) {
			return value._id;
		},
		add_condition(target, name) {
			target.s[name] = { ms: 30 * 60 * 1000 };
		},
	});
	vm.runInContext(serverFunctions.slice(start, end), context);
	return context;
}

function player(type = "warrior") {
	return { real_id: "CH_current", type, p: { home: "EU1" }, s: {} };
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
