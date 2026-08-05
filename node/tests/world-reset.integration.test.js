"use strict";

const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { MongoClient } = require("mongodb");

const { maps: DESIGN_MAPS } = require("../../design/maps");
const {
	MUTABLE_COLLECTIONS,
	ensureWorldIndexes,
	mapSha256,
	readMapDocuments,
	validateMapDocuments,
	verifyWorldIndexes,
} = require("../game/world_schema");
const { readSeed } = require("../tools/export-map-seed");

const enabled = process.env.ADVENTURELAND_RESET_INTEGRATION === "1";

test(
	"disposable Mongo reset preserves live maps, clears every mutable collection, and reseeds explicitly",
	{ skip: !enabled },
	async () => {
		const targetUri = process.env.ADVENTURELAND_RESET_MONGODB_URI;
		const targetDatabase = process.env.ADVENTURELAND_RESET_MONGODB_DATABASE;
		const sourceUri = process.env.ADVENTURELAND_RESET_SOURCE_URI || targetUri;
		const sourceDatabase = process.env.ADVENTURELAND_RESET_SOURCE_DATABASE || "adventureland";
		if (!targetUri || !targetDatabase) throw new Error("integration target URI and database are required");
		if (targetDatabase === sourceDatabase && sourceUri === targetUri) {
			throw new Error("integration target must be a disposable database distinct from the source");
		}

		const targetClient = new MongoClient(targetUri);
		const sourceClient = new MongoClient(sourceUri);
		const runtime = await mkdtemp(path.join(path.resolve(__dirname, "../../.."), ".runtime", "reset-integration-"));
		try {
			await Promise.all([targetClient.connect(), sourceClient.connect()]);
			const target = targetClient.db(targetDatabase);
			const source = sourceClient.db(sourceDatabase);
			await target.dropDatabase();
			const sourceMaps = await readMapDocuments(source);
			const liveValidation = validateMapDocuments(sourceMaps, { maps: DESIGN_MAPS });
			assert.equal(liveValidation.mapCount, 112);
			await target.collection("map").insertMany(sourceMaps, { ordered: true });
			for (const name of MUTABLE_COLLECTIONS) await target.collection(name).insertOne({ _id: `sentinel-${name}` });
			await ensureWorldIndexes(target);

			const leaseDir = path.join(runtime, "lease");
			const guard = async () => ({ activePidFiles: [], openPorts: [], clear: true });
			const run = (argv, extra = {}) =>
				require("../tools/reset-world").runReset({
					...extra,
					argv,
					env: { ADVENTURELAND_RESET_MONGODB_URI: targetUri },
					leaseDir,
					writerGuard: guard,
					stdout: () => {},
				});

			const dry = await run(["--database", targetDatabase]);
			assert.equal(dry.mode, "dry-run");
			assert.equal(dry.preview.preResetMapCount, 112);
			assert.equal(dry.preview.targetMapHash, liveValidation.sha256);
			await assert.rejects(
				run(
					[
						"--database",
						targetDatabase,
						"--execute",
						"--confirm",
						dry.preview.confirmToken,
						"--backup-dir",
						path.join(runtime, "blocked-backup"),
					],
					{ writerGuard: async () => ({ activePidFiles: [{ name: "backend", pid: 1 }], openPorts: [], clear: false }) },
				),
				{ code: "RESET_WRITER_RUNNING" },
			);
			assert.equal(await target.collection("character").countDocuments(), 1);
			const normalBackup = path.join(runtime, "normal-backup");
			const executed = await run([
				"--database",
				targetDatabase,
				"--execute",
				"--confirm",
				dry.preview.confirmToken,
				"--backup-dir",
				normalBackup,
			]);
			assert.equal(executed.report.mapHash, liveValidation.sha256);
			assert.equal(executed.report.preResetMapHash, liveValidation.sha256);
			assert.equal(executed.report.backup.verified, true);
			assert.deepEqual(await verifyWorldIndexes(target), await ensureWorldIndexes(target));
			for (const name of MUTABLE_COLLECTIONS) assert.equal(await target.collection(name).countDocuments(), 0, name);
			assert.equal(mapSha256(await readMapDocuments(target)), liveValidation.sha256);

			const second = await run([
				"--database",
				targetDatabase,
				"--execute",
				"--confirm",
				dry.preview.confirmToken,
				"--backup-dir",
				path.join(runtime, "normal-backup-2"),
			]);
			assert.ok(Object.values(second.report.deleted).every((count) => count === 0));
			assert.equal(second.report.mapHash, liveValidation.sha256);

			await target.collection("character").dropIndexes();
			await target.collection("character").insertOne({ _id: "sentinel-missing-index" });
			await assert.rejects(run(["--database", targetDatabase]), { code: "WORLD_INDEX_MISSING" });
			assert.equal(await target.collection("character").countDocuments({ _id: "sentinel-missing-index" }), 1);
			await ensureWorldIndexes(target);
			const restoredIndexDry = await run(["--database", targetDatabase]);
			const restoredIndexRun = await run([
				"--database",
				targetDatabase,
				"--execute",
				"--confirm",
				restoredIndexDry.preview.confirmToken,
				"--backup-dir",
				path.join(runtime, "missing-index-repaired-backup"),
			]);
			assert.ok(restoredIndexRun.report.indexes.some((index) => index.collection === "character"));
			assert.deepEqual(await verifyWorldIndexes(target), await ensureWorldIndexes(target));

			await target.collection("character").insertOne({ _id: "sentinel-rollback" });
			const rollbackDry = await run(["--database", targetDatabase]);
			await assert.rejects(
				run(
					[
						"--database",
						targetDatabase,
						"--execute",
						"--confirm",
						rollbackDry.preview.confirmToken,
						"--backup-dir",
						path.join(runtime, "rollback-backup"),
					],
					{
						transactionHook: async () => {
							const error = new Error("simulated reset transaction failure");
							error.code = "RESET_TEST_FAILURE";
							throw error;
						},
					},
				),
				{ code: "RESET_TEST_FAILURE" },
			);
			assert.equal(await target.collection("character").countDocuments({ _id: "sentinel-rollback" }), 1);
			assert.equal(mapSha256(await readMapDocuments(target)), liveValidation.sha256);

			await target.collection("character").insertOne({ _id: "sentinel-postcheck" });
			const postcheckDry = await run(["--database", targetDatabase]);
			await assert.rejects(
				run(
					[
						"--database",
						targetDatabase,
						"--execute",
						"--confirm",
						postcheckDry.preview.confirmToken,
						"--backup-dir",
						path.join(runtime, "postcheck-backup"),
					],
					{
						postcheckHook: async () => {
							const error = new Error("simulated reset postcheck failure");
							error.code = "RESET_TEST_POSTCHECK_FAILURE";
							throw error;
						},
					},
				),
				{ code: "RESET_TEST_POSTCHECK_FAILURE" },
			);
			assert.equal(await target.collection("character").countDocuments({ _id: "sentinel-postcheck" }), 1);
			assert.equal(await target.collection("character").countDocuments({ _id: "sentinel-rollback" }), 1);

			const seed = await readSeed(path.resolve(__dirname, "../../seeds"), { maps: DESIGN_MAPS });
			await target.collection("map").deleteOne({ _id: seed.documents[0]._id });
			await target.collection("map").insertOne({ _id: "MP_integration_extra", info: { data: { extra: true } } });
			const reseedDry = await run(["--database", targetDatabase, "--reseed-maps"]);
			assert.equal(reseedDry.preview.targetMapHash, seed.manifest.sha256);
			const reseeded = await run([
				"--database",
				targetDatabase,
				"--reseed-maps",
				"--execute",
				"--confirm",
				reseedDry.preview.confirmToken,
				"--backup-dir",
				path.join(runtime, "reseed-backup"),
			]);
			assert.equal(reseeded.report.mapCount, seed.manifest.documentCount);
			assert.equal(reseeded.report.mapHash, seed.manifest.sha256);
			assert.deepEqual(
				validateMapDocuments(await readMapDocuments(target), { maps: DESIGN_MAPS, exact: true }).extras,
				[],
			);
		} finally {
			await targetClient
				.db(targetDatabase)
				.dropDatabase()
				.catch(() => undefined);
			await Promise.all([targetClient.close(), sourceClient.close()]);
			await rm(runtime, { recursive: true, force: true });
		}
	},
);
