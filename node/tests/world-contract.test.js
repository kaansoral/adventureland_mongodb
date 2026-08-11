"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const maps = require("../../design/maps").maps;
const seedDirectory = path.resolve(__dirname, "../../seeds");

function fakeWorldDb({ collectionNames, documents, indexes }) {
	return {
		listCollections() {
			return { toArray: async () => collectionNames.map((name) => ({ name })) };
		},
		collection(name) {
			if (name === "map")
				return {
					find() {
						return { sort: () => ({ toArray: async () => documents }) };
					},
				};
			return { listIndexes: () => ({ toArray: async () => indexes[name] || [] }) };
		},
	};
}

async function withLocalHttp(handler, callback) {
	const server = http.createServer(handler);
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const { port } = server.address();
	try {
		return await callback(`http://127.0.0.1:${port}`);
	} finally {
		server.close();
		await once(server, "close");
	}
}

test("world classification derives the required static map set and reports unknown collections", () => {
	const { classifyCollections, requiredMapIds } = require("../game/world_schema");
	const ids = requiredMapIds(maps);
	assert.equal(ids.length, 49);
	assert.deepEqual(ids, [...ids].sort());
	const result = classifyCollections(["map", "character", "user", "system.indexes", "unexpected"]);
	assert.deepEqual(result.mutable, ["character", "user"]);
	assert.deepEqual(result.system, ["system.indexes"]);
	assert.deepEqual(result.unknown, ["unexpected"]);
});

test("map validation is canonical, complete, and distinguishes live extras from the recovery seed", () => {
	const { canonicalMapBytes, mapSha256, validateMapDocuments, requiredMapIds } = require("../game/world_schema");
	const ids = requiredMapIds(maps);
	const docs = ids.map((_id, index) => ({ _id, info: { data: { geometry: index } } }));
	const live = validateMapDocuments([...docs, { _id: "MP_extra", info: { data: { extra: true } } }], { maps });
	assert.equal(live.requiredCount, 49);
	assert.deepEqual(live.extras, ["MP_extra"]);
	assert.equal(
		mapSha256(live.documents),
		crypto.createHash("sha256").update(canonicalMapBytes(live.documents)).digest("hex"),
	);
	assert.throws(() => validateMapDocuments(docs.slice(1), { maps }), { code: "WORLD_MAP_MISSING" });
	assert.throws(() => validateMapDocuments([{ _id: ids[0], info: {} }, ...docs.slice(1)], { maps }), {
		code: "WORLD_MAP_GEOMETRY",
	});
	assert.throws(() => validateMapDocuments([...docs, { _id: "MP_extra", info: {} }], { maps }), {
		code: "WORLD_MAP_GEOMETRY",
	});
});

test("map seed export is deterministic, exact, and records design provenance", () => {
	const { buildSeed } = require("../tools/export-map-seed");
	const { designMapFingerprint, requiredMapIds } = require("../game/world_schema");
	const ids = requiredMapIds(maps);
	const documents = [...ids.map((_id, index) => ({ _id, info: { data: { x: index, y: index + 1 } } }))];
	documents.push({ _id: "MP_live_extra", info: { data: { x: 1 } } });
	const first = buildSeed(documents, { maps, designMapVersion: "test" });
	const second = buildSeed([...documents].reverse(), { maps, designMapVersion: "test" });
	assert.deepEqual(first.bytes, second.bytes);
	assert.equal(first.manifest.documentCount, 49);
	assert.equal(first.manifest.liveDocumentCount, 50);
	assert.deepEqual(first.manifest.liveExtraIds, ["MP_live_extra"]);
	assert.equal(first.manifest.sourceDesignMapHash, designMapFingerprint(maps));
	assert.equal(first.manifest.sha256, require("../game/world_schema").mapSha256(first.documents));
});

test("committed map seed readback is canonical and rejects manifest drift", async () => {
	const { readSeed } = require("../tools/export-map-seed");
	const seed = await readSeed(seedDirectory, { maps });
	assert.equal(seed.manifest.documentCount, 49);
	assert.equal(seed.manifest.liveDocumentCount, 112);
	assert.equal(seed.manifest.liveExtraCount, 63);
	assert.deepEqual(seed.manifest.ids, seed.documents.map((document) => document._id));
	assert.equal(seed.manifest.sha256, crypto.createHash("sha256").update(seed.bytes).digest("hex"));

	const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "adventureland-seed-contract-"));
	try {
		await fs.copyFile(path.join(seedDirectory, "maps.ejson"), path.join(temporaryDirectory, "maps.ejson"));
		const manifest = JSON.parse(await fs.readFile(path.join(seedDirectory, "maps.manifest.json"), "utf8"));
		manifest.sha256 = "0".repeat(64);
		await fs.writeFile(path.join(temporaryDirectory, "maps.manifest.json"), JSON.stringify(manifest));
		await assert.rejects(readSeed(temporaryDirectory, { maps }), { code: "WORLD_SEED_MANIFEST" });
	} finally {
		await fs.rm(temporaryDirectory, { recursive: true, force: true });
	}
});

test("world preflight verifies read-only map hashes, collections, and indexes", async () => {
	const { WORLD_INDEXES, verifyWorldState } = require("../game/world_schema");
	const { readSeed } = require("../tools/export-map-seed");
	const seed = await readSeed(seedDirectory, { maps });
	const indexes = { character: WORLD_INDEXES };
	const base = {
		collectionNames: ["map", "character", "user", "system.indexes"],
		documents: seed.documents,
		indexes,
	};
	const world = await verifyWorldState(fakeWorldDb(base), {
		maps,
		mapHash: seed.manifest.sha256,
		requiredMapHash: seed.manifest.sha256,
	});
	assert.deepEqual(world.classification.unknown, []);
	assert.equal(world.maps.requiredCount, 49);
	assert.equal(world.maps.sha256, seed.manifest.sha256);
	const legacyWorld = await verifyWorldState(
		fakeWorldDb({ ...base, collectionNames: [...base.collectionNames, "unexpected"] }),
		{ maps },
	);
	assert.deepEqual(legacyWorld.classification.unknown, ["unexpected"]);
	await assert.rejects(
		verifyWorldState(fakeWorldDb(base), { maps, mapHash: "0".repeat(64) }),
		{ code: "WORLD_MAP_HASH" },
	);
	await assert.rejects(
		verifyWorldState(fakeWorldDb({ ...base, indexes: { character: WORLD_INDEXES.slice(1) } }), { maps }),
		{ code: "WORLD_INDEX_MISSING" },
	);
});

test("publication preflight rejects remote, wrong-path, bad-status, and legacy protocol sources", async () => {
	const { main: verifyPublication, readUrl } = require("../tools/verify-publication");
	await assert.rejects(
		verifyPublication(["--url", "http://example.com/data.js"]),
		/Publication verification is loopback-only/,
	);
	await assert.rejects(
		verifyPublication(["--url", "http://127.0.0.1:1/not-data.js"]),
		/Publication URL must end in \/data\.js/,
	);
	await assert.rejects(
		verifyPublication(["--url", "https://127.0.0.1:1/data.js"]),
		/Publication verification is loopback-only/,
	);
	await withLocalHttp((_request, response) => {
		response.writeHead(503);
		response.end("temporarily unavailable");
	}, async (baseUrl) => {
		await assert.rejects(readUrl(`${baseUrl}/data.js`), /data\.js returned HTTP 503/);
	});
	await withLocalHttp((_request, response) => {
		response.end("var G = { protocol: 2, skills: {}, abilities: {} };");
	}, async (baseUrl) => {
		await assert.rejects(verifyPublication(["--url", `${baseUrl}/data.js`]), (error) => error.code === "WORLD_PUBLICATION");
	});
});

test("world indexes are created idempotently and verified by name and key", async () => {
	const { ensureWorldIndexes, verifyWorldIndexes, WORLD_INDEXES } = require("../game/world_schema");
	const indexes = new Map();
	const db = {
		collection(name) {
			return {
				async createIndex(key, options) {
					indexes.set(`${name}:${options.name}`, { name: options.name, key });
				},
				listIndexes() {
					return { toArray: async () => [...indexes.values()] };
				},
			};
		},
	};
	assert.deepEqual(await ensureWorldIndexes(db), WORLD_INDEXES);
	assert.deepEqual(await ensureWorldIndexes(db), WORLD_INDEXES);
	assert.deepEqual(await verifyWorldIndexes(db), WORLD_INDEXES);
	indexes.delete("character:world_total_level_name");
	await assert.rejects(verifyWorldIndexes(db), { code: "WORLD_INDEX_MISSING" });
});
