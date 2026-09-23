const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const test = require("node:test");

const filename = path.resolve(__dirname, "../../scripts/seed_mongodb.js");
const source = new vm.Script(fs.readFileSync(filename, "utf8"), { filename });
const { MongoClient: Driver } = createRequire(filename)("mongodb");
const { maps } = require("../../design/maps.js");

// Use the real URI parser, but replace every connection and database method.
// Neither the project's credentials nor a real database are accessed by these tests.
function harness(settings = {}) {
	const calls = [];
	const logs = [];
	let inserted;
	class MongoClient extends Driver {
		constructor(uri, options) {
			super(uri, options);
			calls.push("construct");
			assert.equal(this.options.directConnection, true);
			assert.equal(this.options.retryWrites, false);
		}
		async connect() {
			calls.push("connect");
			return this;
		}
		db(name) {
			assert.equal(name, settings.database || "adventureland");
			return {
				listCollections(filter, options) {
					calls.push("listCollections");
					assert.equal(Object.keys(filter).length, 0);
					assert.equal(options.nameOnly, true);
					return {
						async toArray() {
							if (settings.readError) throw new Error("Cannot check collections");
							return settings.collections || [];
						},
					};
				},
				collection(collection) {
					assert.equal(collection, "map");
					return {
						async insertMany(documents, options) {
							calls.push("insertMany");
							assert.equal(options.ordered, true);
							inserted = documents;
							if (settings.writeError) throw new Error("Insertion interrupted");
							return { acknowledged: true, insertedCount: documents.length };
						},
					};
				},
			};
		}
		async close() {
			calls.push("close");
		}
	}
	const context = vm.createContext({
		module: { exports: {} },
		console: { log: (message) => logs.push(message) },
		process: { env: { NODE_ENV: settings.environment || "development" } },
		require(name) {
			if (name === "../design/maps.js") return { maps };
			if (name === "mongodb") return { MongoClient };
			assert.equal(name, "../secretsandconfig/keys.js");
			calls.push("config");
			return {
				mongodb_name: settings.database || "adventureland",
				mongodb_uri: settings.uri || "mongodb://127.0.0.1:27017",
				mongodb_config: settings.config || {},
			};
		},
	});
	source.runInContext(context);
	return { ...context.module.exports, calls, logs, documents: () => inserted };
}

test("help opens no connection and does not load credentials", async () => {
	for (const args of [[], ["--help"]]) {
		const h = harness();
		await h.main(args);
		assert.deepEqual(h.calls, []);
		assert.match(h.logs[0], /No MongoDB connection was opened/);
	}
});

test("requires an exact confirmation and rejects unexpected flags", async () => {
	for (const args of [
		["--confirm"],
		["--confirm", "wrong"],
		["--force"],
		["--dry-run", "--confirm", "adventureland"],
	]) {
		const h = harness();
		await assert.rejects(h.main(args));
		assert.ok(!h.calls.includes("construct"));
	}
});

test("rejects production mode and system databases before connecting", async () => {
	const production = harness({ environment: "production" });
	await assert.rejects(production.main(["--confirm", "adventureland"]), /disabled/);
	assert.deepEqual(production.calls, []);
	for (const database of ["admin", "config", "local", "ADMIN"]) {
		const h = harness({ database });
		await assert.rejects(h.main(["--confirm", database]), /local game database/);
		assert.ok(!h.calls.includes("construct"));
	}
});

test("rejects remote, SRV, proxy, socket, and multi-host connections before connecting", async () => {
	for (const settings of [
		{ uri: "mongodb://example.invalid:27017" },
		{ uri: "mongodb://localhost@example.invalid:27017" },
		{ uri: "mongodb+srv://example.invalid/adventureland" },
		{ uri: "mongodb://127.0.0.1:27017/?proxyHost=example.invalid" },
		{ config: { proxyHost: "example.invalid" } },
		{ uri: "mongodb://%2Ftmp%2Fmongodb.sock" },
		{ uri: "mongodb://127.0.0.1:27017,example.invalid:27017" },
		{ config: { autoEncryption: {} } },
	]) {
		const h = harness(settings);
		await assert.rejects(h.main(["--confirm", "adventureland"]));
		assert.ok(!h.calls.includes("connect"));
	}
});

test("dry runs check empty local databases without inserting", async () => {
	for (const uri of ["mongodb://127.0.0.1:27017", "mongodb://localhost:27017", "mongodb://[::1]:27017"]) {
		const h = harness({ uri });
		await h.main(["--dry-run"]);
		assert.deepEqual(h.calls, ["config", "construct", "connect", "listCollections", "close"]);
		assert.match(h.logs.at(-1), /No data was written/);
	}
});

test("any existing collection blocks seeding, including an empty map collection", async () => {
	for (const name of ["user", "character", "map", "unrelated", "system.profile"]) {
		const h = harness({ collections: [{ name }] });
		await assert.rejects(h.main(["--confirm", "adventureland"]), /already contains collections/);
		assert.ok(!h.calls.includes("insertMany"));
		assert.equal(h.calls.at(-1), "close");
	}
});

test("failure to inspect collections prevents all inserts", async () => {
	const h = harness({ readError: true });
	await assert.rejects(h.main(["--confirm", "adventureland"]), /Cannot check collections/);
	assert.ok(!h.calls.includes("insertMany"));
	assert.equal(h.calls.at(-1), "close");
});

test("a confirmed fresh database receives only the maps used by the loaded definitions", async () => {
	const h = harness();
	await h.main(["--confirm", "adventureland"]);
	assert.deepEqual(h.calls, ["config", "construct", "connect", "listCollections", "insertMany", "close"]);
	const expected = [
		...new Set(
			Object.values(maps)
				.filter((map) => !map.ignore)
				.map((map) => "MP_" + map.key),
		),
	].sort();
	assert.deepEqual(Array.from(h.documents(), (map) => map._id).sort(), expected);
	for (const [index, map] of h.documents().entries()) {
		assert.deepEqual(Object.keys(h.seedMaps[index]).sort(), ["_id", "info"]);
		assert.deepEqual(Object.keys(map).sort(), ["_id", "created", "info", "name", "player", "updated"]);
		assert.deepEqual(Object.keys(map.info), ["data"]);
		assert.equal(map.info, h.seedMaps[index].info);
		assert.equal(map.name, map._id.slice(3));
		assert.equal(map.player, false);
		assert.ok(Number.isFinite(map.created.getTime()));
	}
});

test("incomplete bundled geometry blocks seeding before connecting", async () => {
	const h = harness();
	h.seedMaps.pop();
	await assert.rejects(h.main(["--confirm", "adventureland"]), /incomplete/);
	assert.deepEqual(h.calls, []);
});

test("an interrupted insert is not retried or cleaned up automatically", async () => {
	const h = harness({ writeError: true });
	await assert.rejects(h.main(["--confirm", "adventureland"]), /interrupted/);
	assert.deepEqual(h.calls, ["config", "construct", "connect", "listCollections", "insertMany", "close"]);
});
