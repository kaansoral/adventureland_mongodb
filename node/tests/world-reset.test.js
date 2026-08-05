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

test("reset preflight is loopback-only, fail-closed, and never accepts credentials in argv", () => {
	const { confirmationToken, parseResetArgs, validateResetUri } = require("../tools/reset-world");
	assert.equal(
		validateResetUri("mongodb://127.0.0.1:27017/adventureland?replicaSet=adventureland-local", "adventureland").host,
		"127.0.0.1",
	);
	assert.equal(
		validateResetUri("mongodb://[::1]:27017/adventureland?replicaSet=adventureland-local", "adventureland").host,
		"::1",
	);
	assert.throws(() => validateResetUri("mongodb://db.example/adventureland", "adventureland"), {
		code: "RESET_REMOTE_URI",
	});
	assert.throws(() => validateResetUri("mongodb://127.0.0.1/other", "adventureland"), {
		code: "RESET_DATABASE_MISMATCH",
	});
	assert.throws(() => parseResetArgs(["--uri", "mongodb://127.0.0.1:27017/adventureland"]), {
		code: "RESET_SECRET_ARG",
	});
	assert.equal(
		confirmationToken("adventureland", "abcdef1234567890").startsWith("RESET-SKILL-WORLD:adventureland:abcdef123456"),
		true,
	);
});

test("reset planning deletes only classified mutable collections and preserves or reseeds maps", () => {
	const { buildResetPlan } = require("../tools/reset-world");
	const base = {
		database: "adventureland",
		collectionNames: ["backup", "character", "map", "server", "system.views"],
		counts: { backup: 2, character: 3, map: 112, server: 1 },
		mapValidation: { mapCount: 112, requiredCount: 49, extras: ["MP_extra"], sha256: "live-map-hash" },
		seedValidation: { mapCount: 49, requiredCount: 49, extras: [], sha256: "seed-map-hash" },
	};
	assert.deepEqual(buildResetPlan(base).deletes, ["backup", "character", "server"]);
	assert.equal(buildResetPlan(base).preserveMaps, true);
	assert.equal(buildResetPlan({ ...base, reseedMaps: true }).reseedMaps, true);
	assert.throws(() => buildResetPlan({ ...base, collectionNames: [...base.collectionNames, "new_collection"] }), {
		code: "RESET_UNKNOWN_COLLECTION",
	});
});

test("reset reports are bounded to counts, hashes, and guards", () => {
	const { redactResetReport } = require("../tools/reset-world");
	const report = redactResetReport({
		uri: "mongodb://user:secret@127.0.0.1/adventureland",
		counts: { user: 2 },
		mapHash: "abc",
		userDocument: { email: "private@example.invalid", password: "secret" },
	});
	assert.doesNotMatch(JSON.stringify(report), /secret|private@example/);
	assert.deepEqual(report.counts, { user: 2 });
	assert.equal(report.mapHash, "abc");
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

test("reset leases and map snapshots are exclusive and readback verified", async () => {
	const { mkdtemp, readFile, rm } = require("node:fs/promises");
	const path = require("node:path");
	const { acquireResetLease, writeMapSnapshot } = require("../tools/reset-world");
	const root = await mkdtemp(path.join(require("node:os").tmpdir(), "world-reset-lease-"));
	const leasePath = path.join(root, "lease");
	const backup = path.join(root, "backup");
	await require("node:fs/promises").mkdir(backup);
	const release = await acquireResetLease(leasePath);
	try {
		await assert.rejects(acquireResetLease(leasePath), { code: "RESET_LEASE" });
		const snapshot = await writeMapSnapshot(backup, [{ _id: "MP_test", info: { data: { geometry: true } } }]);
		assert.equal(snapshot.sha256.length, 64);
		assert.deepEqual(await readFile(snapshot.path), snapshot.bytes);
	} finally {
		await release();
		await rm(root, { recursive: true, force: true });
	}
});

test("reset writer guards cover MongoDB, configured writers, ports, and the shared lease", async () => {
	const { mkdtemp, rm, writeFile, mkdir } = require("node:fs/promises");
	const path = require("node:path");
	const { checkWriterGuards } = require("../tools/reset-world");
	const root = await mkdtemp(path.join(require("node:os").tmpdir(), "world-reset-writers-"));
	const pidFile = path.join(root, "configured-writer.pid");
	const lease = path.join(root, "writer-lease");
	try {
		await writeFile(pidFile, `${process.pid}\n`);
		const guarded = await checkWriterGuards({ pidFiles: [pidFile], ports: [1], writerLeaseDir: lease });
		assert.equal(guarded.clear, false);
		assert.deepEqual(guarded.activePidFiles, [{ path: pidFile, pid: process.pid }]);
		await mkdir(lease);
		await writeFile(path.join(lease, "owner.json"), JSON.stringify({ pid: process.pid }));
		const leased = await checkWriterGuards({ pidFiles: [path.join(root, "missing.pid")], ports: [1], writerLeaseDir: lease });
		assert.equal(leased.clear, false);
		assert.equal(leased.writerLease.active, true);
		const owned = await checkWriterGuards({
			pidFiles: [path.join(root, "missing.pid")],
			ports: [1],
			writerLeaseDir: lease,
			allowOwnedLease: true,
		});
		assert.equal(owned.clear, true);
		assert.equal(owned.ownedLeaseIsSafe, true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("reset backups stay project-local and cannot overwrite existing files", async () => {
	const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
	const path = require("node:path");
	const { ensureBackupDirectory } = require("../tools/reset-world");
	const projectRoot = path.resolve(__dirname, "../../..");
	const backupRoot = path.join(projectRoot, ".runtime", "reset-backups");
	await mkdir(backupRoot, { recursive: true });
	const projectLocal = await mkdtemp(path.join(backupRoot, "unit-"));
	try {
		await assert.rejects(ensureBackupDirectory(path.join(projectRoot, "..", `reset-outside-${Date.now()}`)), {
			code: "RESET_BACKUP_PATH",
		});
		await writeFile(path.join(projectLocal, "existing"), "do not overwrite\n");
		await assert.rejects(ensureBackupDirectory(projectLocal), { code: "RESET_BACKUP_NOT_EMPTY" });
	} finally {
		await rm(projectLocal, { recursive: true, force: true });
	}
});
