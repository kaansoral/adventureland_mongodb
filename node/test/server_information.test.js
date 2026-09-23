const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const createServerInformation = require("../logic/server_information");
const { load, read } = require("./helpers/server_vm");

const hour = 3600000;
function character(id = "CH_a", type = "warrior") {
	return { real_id: id, owner: "US_owner", type, password: "never copy", items: ["never copy"] };
}

test("server updates retain brief visits, whitelist fields, expire history and survive restarts", () => {
	const now = Date.now();
	const information = createServerInformation("SR_EU1");
	information.remember(character("CH_gone"), now - 1000);
	information.remember(character("CH_old"), now - hour);
	information.remember(character("CH_disconnected"), now - 500);
	const snapshot = information.snapshot({ a: character(), dc: { ...character("CH_disconnected"), dc: true } }, now);
	assert.deepEqual(snapshot.CH_a, { owner: "US_owner", type: "warrior", last_online: now });
	assert.equal(snapshot.CH_gone.last_online, now - 1000, "a visit between heartbeat saves is retained");
	assert.equal(snapshot.CH_disconnected.last_online, now - 500, "disconnected characters do not appear active");
	assert.equal(snapshot.CH_old, undefined);
	const restarted = createServerInformation("SR_EU1");
	restarted.restore(snapshot, now);
	assert.deepEqual(restarted.snapshot({}, now), snapshot);
	assert.deepEqual(restarted.snapshot({}, now + hour), {});
});

test("high character churn cannot grow the Server document without a bound", () => {
	const now = Date.now();
	const information = createServerInformation("SR_EU1");
	for (let i = 0; i < 10002; i++) information.remember(character("CH_" + i), now - 10002 + i);
	const snapshot = information.snapshot({}, now);
	assert.equal(Object.keys(snapshot).length, 10000);
	assert.equal(snapshot.CH_0, undefined);
	assert.ok(snapshot.CH_10001);
});

test("the shared view indexes foreign history without confusing home, self, merchants or offline servers", () => {
	const now = Date.now();
	const information = createServerInformation("SR_EU1");
	information.receive(
		[
			{
				_id: "SR_EU1",
				info: { recent_characters: { CH_home: { owner: "US_owner", type: "warrior", last_online: now } } },
			},
			{
				_id: "SR_US1",
				online: false,
				info: {
					recent_characters: {
						CH_self: { owner: "US_owner", type: "warrior", last_online: now },
						CH_other: { owner: "US_owner", type: "mage", last_online: now - 1000 },
						CH_merchant: { owner: "US_owner", type: "merchant", last_online: now + 1 },
						CH_old: { owner: "US_expired", type: "mage", last_online: now - hour },
					},
				},
			},
		],
		now,
	);
	assert.equal(Object.keys(information.servers).length, 2);
	assert.equal(information.foreign_activity("US_owner", "CH_self"), now - 1000);
	assert.equal(information.foreign_activity("US_expired", "CH_current"), 0);
	assert.equal(information.foreign_activity("US_unknown", "CH_current"), 0);
});

test("regular Server updates publish history and share one throttled projected pull across all players", async () => {
	let now = Date.now(),
		queries = 0,
		saves = 0,
		checks = 0,
		fail = false;
	const savedVersions = [];
	const information = createServerInformation("SR_EU1");
	const remote = { _id: "SR_US1", version: "9000", online: true, info: { recent_characters: {} } };
	const context = vm.createContext({
		Date: { now: () => now },
		Version: 9001,
		server_information: information,
		options: {
			servers: {
				eu1: { region: "EU", name: "1" },
				us1: { region: "US", name: "1" },
				retired: { region: "EU", name: "IV", inactive: true },
			},
		},
		server: { live: true },
		Server: { _id: "SR_EU1", version: "2030", updated: new Date(now - 16000), info: {} },
		players: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, character("CH_" + i)])),
		observers: {},
		total_merchants: 0,
		total_players: 20,
		ssince: (date) => (now - +date) / 1000,
		save: async (entity) => {
			saves++;
			savedVersions.push(entity.version);
			entity.updated = new Date(now);
		},
		encouragement_tick() {},
		realmfatigue_logic: (...args) => {
			assert.equal(args.length, 1);
			checks++;
		},
		setTimeout() {},
		console,
		log_trace() {},
		db: {
			collection(name) {
				assert.equal(name, "server", "no periodic character/account collection queries");
				return {
					find(filter, options) {
						queries++;
						assert.deepEqual(Array.from(filter._id.$in), ["SR_EU1", "SR_US1"]);
						assert.equal(filter.online, undefined, "recently offline servers must still be pulled");
						assert.equal(options.projection.version, 1);
						assert.equal(options.projection["info.recent_characters"], 1);
						assert.equal(options.projection["info.data"], undefined);
						assert.equal(options.projection["info.secret"], undefined);
						return {
							maxTimeMS(ms) {
								assert.equal(ms, 5000);
								return {
									toArray: async () => {
										if (fail) throw new Error("unavailable");
										return [remote];
									},
								};
							},
						};
					},
				};
			},
		},
	});
	load(context, "node/server_functions.js", ["pull_server_information"]);
	load(context, "node/server.js", ["server_loop"]);
	await context.server_loop();
	assert.equal(queries, 1);
	assert.equal(saves, 1);
	assert.equal(checks, 20);
	assert.equal(Object.keys(context.Server.info.recent_characters).length, 20);
	assert.deepEqual(savedVersions, ["9001"], "existing records publish the running version, not their creation version");
	assert.equal(information.servers.SR_US1.version, "9000", "peers retain their own reported versions");

	context.Version = 9002;
	await context.server_loop();
	assert.equal(saves, 1, "version reporting does not add writes between heartbeats");

	now += 16000;
	await context.server_loop();
	assert.equal(queries, 1, "a second heartbeat does not add a second pull");
	assert.deepEqual(savedVersions, ["9001", "9002"], "each heartbeat reads the current runtime version");
	now += 16000;
	fail = true;
	await context.server_loop();
	assert.equal(queries, 2);
	assert.equal(checks, 60, "cached checks continue even if the shared pull fails");
	assert.equal(information.servers.SR_US1, remote, "last known snapshot survives a failed pull");
	await context.pull_server_information();
	assert.equal(queries, 2, "failed pulls are throttled too");
});

test("public server discovery excludes private activity history", async () => {
	let projection;
	const context = vm.createContext({
		options: { servers: {} },
		post_process_query_results() {},
		db: {
			collection: () => ({
				find: (_, options) => {
					projection = options.projection;
					return { limit: () => ({ toArray: async () => [] }) };
				},
			}),
		},
	});
	load(context, "adventure_functions.js", ["get_servers"]);
	await context.get_servers();
	assert.equal(projection["info.recent_characters"], 0);
	const server = read("node/server.js");
	assert.match(server, /server_information\.restore\(Server\.info\.recent_characters\)/);
	const disconnect = server.slice(server.indexOf('socket.on("disconnect",'));
	assert.match(disconnect, /server_information\.remember\(player\)/);
});
