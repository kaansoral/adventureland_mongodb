"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const maps = require("../../design/maps").maps;

test("world classification derives the required static map set and rejects unknown collections", () => {
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
