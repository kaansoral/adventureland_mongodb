"use strict";

const fs = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { constants: FS_CONSTANTS } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { MongoClient } = require("mongodb");
const { maps: DESIGN_MAPS } = require("../../design/maps");
const {
	MUTABLE_COLLECTIONS,
	canonicalMapBytes,
	classifyCollections,
	mapSha256,
	readCollectionNames,
	readMapDocuments,
	ensureWorldIndexes,
	validateMapDocuments,
	verifyWorldIndexes,
	worldError,
} = require("../game/world_schema");
const { readSeed } = require("./export-map-seed");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const GAME_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_BACKUP_ROOT = path.join(ROOT_DIR, ".runtime", "reset-backups");
const RESET_COMMAND_VERSION = "reset-world@protocol3";
const RESET_WARNING = "Mutable documents are intentionally not backed up and are irrecoverable.";
const DEFAULT_LEASE_DIR = path.join(ROOT_DIR, ".runtime", "reset-world.lock");

function parseResetArgs(argv) {
	const result = { execute: false, reseedMaps: false };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--execute") result.execute = true;
		else if (argument === "--reseed-maps") result.reseedMaps = true;
		else if (argument === "--database") result.database = argv[++index];
		else if (argument === "--confirm") result.confirm = argv[++index];
		else if (argument === "--backup-dir") result.backupDir = argv[++index];
		else if (argument === "--uri" || argument === "--mongodb-uri" || argument === "--mongodb_uri") {
			throw worldError(
				"RESET_SECRET_ARG",
				"MongoDB credentials must be supplied through ADVENTURELAND_RESET_MONGODB_URI",
			);
		} else if (argument === "--help") result.help = true;
		else throw worldError("RESET_ARGUMENT", `Unknown reset argument ${argument}`);
	}
	if (result.database && !/^[A-Za-z0-9_-]{1,63}$/.test(result.database)) {
		throw worldError("RESET_DATABASE", "Database name is invalid");
	}
	if (result.help) return result;
	if (!result.database) throw worldError("RESET_DATABASE", "--database is required");
	if (result.execute && !result.confirm) throw worldError("RESET_CONFIRM", "--confirm is required with --execute");
	return result;
}

function validateResetUri(uri, database) {
	if (typeof uri !== "string" || !uri)
		throw worldError("RESET_URI_REQUIRED", "ADVENTURELAND_RESET_MONGODB_URI is required");
	if (!uri.startsWith("mongodb://"))
		throw worldError("RESET_REMOTE_URI", "Reset supports only loopback mongodb:// URIs");
	let parsed;
	try {
		parsed = new URL(uri);
	} catch {
		throw worldError("RESET_URI", "MongoDB URI is invalid");
	}
	const authority = uri.slice("mongodb://".length).split(/[/?#]/, 1)[0];
	const hostPart = authority.slice(authority.lastIndexOf("@") + 1);
	const hosts = hostPart.split(",").map((entry) => {
		const value = entry.trim();
		if (value.startsWith("[")) return value.slice(1, value.indexOf("]")).toLowerCase();
		const separator = value.lastIndexOf(":");
		return (
			separator > -1 && /^\d+$/.test(value.slice(separator + 1)) ? value.slice(0, separator) : value
		).toLowerCase();
	});
	if (!hosts.length || hosts.some((host) => !["127.0.0.1", "localhost", "::1"].includes(host))) {
		throw worldError("RESET_REMOTE_URI", "Reset target must resolve only to loopback hosts");
	}
	const selectedDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
	if (selectedDatabase !== database)
		throw worldError("RESET_DATABASE_MISMATCH", "URI database does not match --database");
	if (["admin", "local", "config"].includes(database))
		throw worldError("RESET_SYSTEM_DATABASE", "System databases cannot be reset");
	return { host: hosts[0], hosts, database };
}

function confirmationToken(database, mapHash) {
	return `RESET-SKILL-WORLD:${database}:${String(mapHash).slice(0, 12)}`;
}

function buildResetPlan(input) {
	const classification = classifyCollections(input.collectionNames || []);
	if (classification.unknown.length) {
		throw worldError("RESET_UNKNOWN_COLLECTION", "Unknown application collections block reset", {
			unknown: classification.unknown,
		});
	}
	const deletes = MUTABLE_COLLECTIONS.filter((name) => classification.mutable.includes(name));
	const mapHash = input.reseedMaps ? input.seedValidation?.sha256 : input.mapValidation?.sha256;
	if (!mapHash) throw worldError("RESET_MAP", "A validated map set is required before reset");
	return {
		collectionNames: input.collectionNames || [],
		counts: input.counts || {},
		deletes,
		mapHash,
		preserveMaps: !input.reseedMaps,
		reseedMaps: Boolean(input.reseedMaps),
		mapCount: input.reseedMaps ? input.seedValidation?.mapCount : input.mapValidation?.mapCount,
	};
}

function redactResetReport(input) {
	return {
		commandVersion: input.commandVersion || RESET_COMMAND_VERSION,
		timestamp: input.timestamp,
		mode: input.mode,
		database: input.database,
		counts: input.counts || {},
		deleted: input.deleted || {},
		preResetMapHash: input.preResetMapHash,
		preResetMapCount: input.preResetMapCount,
		targetMapHash: input.targetMapHash || input.mapHash,
		targetMapCount: input.targetMapCount || input.mapCount,
		mapHash: input.mapHash,
		mapCount: input.mapCount,
		mapExtras: input.mapExtras || [],
		guards: input.guards || {},
		classification: input.classification,
		plan: input.plan,
		seed: input.seed,
		topology: input.topology,
		backupDir: input.backupDir,
		backup: input.backup,
		indexes: input.indexes,
		reseedMaps: Boolean(input.reseedMaps),
		warning: RESET_WARNING,
		nextBoot: "scripts/service-server.sh",
	};
}

function topologyReport(hello) {
	return {
		setName: hello.setName,
		me: hello.me,
		primary: hello.primary,
		hosts: [...new Set([...(hello.hosts || []), ...(hello.passives || []), ...(hello.arbiters || [])])].sort(),
	};
}

function processIsRunning(pid) {
	if (!/^\d+$/.test(String(pid))) return false;
	try {
		process.kill(Number(pid), 0);
		return true;
	} catch {
		return false;
	}
}

async function portIsOpen(port, host = "127.0.0.1") {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host, port });
		const finish = (value) => {
			socket.destroy();
			resolve(value);
		};
		socket.once("connect", () => finish(true));
		socket.once("error", () => finish(false));
		socket.setTimeout(250, () => finish(false));
	});
}

async function checkWriterGuards(options = {}) {
	const pidDir = options.pidDir || path.join(ROOT_DIR, ".runtime", "pids");
	const ports = options.ports || [8090, 7192];
	const activePidFiles = [];
	for (const name of ["backend", "game-server"]) {
		const file = path.join(pidDir, `${name}.pid`);
		try {
			const pid = (await fs.readFile(file, "utf8")).trim();
			if (processIsRunning(pid)) activePidFiles.push({ name, pid: Number(pid) });
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	const openPorts = [];
	for (const port of ports) if (await portIsOpen(port)) openPorts.push(port);
	return { activePidFiles, openPorts, clear: activePidFiles.length === 0 && openPorts.length === 0 };
}

async function countCollections(db, names) {
	const counts = {};
	for (const name of names) counts[name] = await db.collection(name).countDocuments();
	return counts;
}

async function writableReplicaSet(db) {
	let hello;
	try {
		hello = await db.command({ hello: 1 });
	} catch (error) {
		throw worldError("RESET_MONGO", "MongoDB hello failed", { cause: error });
	}
	if (!hello.isWritablePrimary || hello.setName !== "adventureland-local")
		throw worldError("RESET_REPLICA_SET", "Reset requires a writable MongoDB replica set");
	const advertised = [
		hello.me,
		hello.primary,
		...(hello.hosts || []),
		...(hello.passives || []),
		...(hello.arbiters || []),
	]
		.filter(Boolean)
		.map((entry) => {
			const value = String(entry).trim();
			if (value.startsWith("[")) return value.slice(1, value.indexOf("]")).toLowerCase();
			const separator = value.lastIndexOf(":");
			return separator > -1 && /^\d+$/.test(value.slice(separator + 1))
				? value.slice(0, separator).toLowerCase()
				: value.toLowerCase();
		});
	if (advertised.some((host) => !["127.0.0.1", "localhost", "::1"].includes(host))) {
		throw worldError("RESET_REMOTE_TOPOLOGY", "MongoDB replica-set members must resolve only to loopback hosts");
	}
	return hello;
}

async function ensureBackupDirectory(directory) {
	const projectRoot = path.resolve(ROOT_DIR) + path.sep;
	const resolved = path.resolve(directory);
	if (!resolved.startsWith(projectRoot)) {
		throw worldError("RESET_BACKUP_PATH", "Backup directory must remain inside the project");
	}
	await fs.mkdir(path.dirname(resolved), { recursive: true });
	try {
		await fs.mkdir(resolved, { recursive: false, mode: 0o700 });
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
		if ((await fs.readdir(resolved)).length)
			throw worldError("RESET_BACKUP_NOT_EMPTY", "Backup directory must be empty before reset");
	}
	await fs.access(resolved, FS_CONSTANTS.W_OK);
	return resolved;
}

async function checkBackupLocation(directory) {
	const projectRoot = path.resolve(ROOT_DIR) + path.sep;
	const resolved = path.resolve(directory || DEFAULT_BACKUP_ROOT);
	if (!resolved.startsWith(projectRoot)) {
		throw worldError("RESET_BACKUP_PATH", "Backup directory must remain inside the project");
	}
	let existing = resolved;
	while (true) {
		try {
			const stats = await fs.stat(existing);
			if (!stats.isDirectory()) throw worldError("RESET_BACKUP_PATH", "Backup path is not a directory");
			await fs.access(existing, FS_CONSTANTS.W_OK);
			if (directory && existing === resolved && (await fs.readdir(existing)).length)
				throw worldError("RESET_BACKUP_NOT_EMPTY", "Backup directory must be empty before reset");
			return resolved;
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
			const parent = path.dirname(existing);
			if (parent === existing) throw worldError("RESET_BACKUP_PATH", "No writable project backup parent exists");
			existing = parent;
		}
	}
}

async function acquireResetLease(directory = DEFAULT_LEASE_DIR) {
	const resolved = path.resolve(directory);
	await fs.mkdir(path.dirname(resolved), { recursive: true });
	try {
		await fs.mkdir(resolved, { recursive: false, mode: 0o700 });
	} catch (error) {
		if (error.code === "EEXIST") throw worldError("RESET_LEASE", "Another reset is already in progress");
		throw error;
	}
	const ownerPath = path.join(resolved, "owner.json");
	try {
		await fs.writeFile(ownerPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, {
			mode: 0o600,
			flag: "wx",
		});
	} catch (error) {
		await fs.rmdir(resolved).catch(() => undefined);
		throw error;
	}
	let released = false;
	return async () => {
		if (released) return;
		released = true;
		await fs.unlink(ownerPath).catch(() => undefined);
		await fs.rmdir(resolved).catch(() => undefined);
	};
}

async function writeMapSnapshot(backupDir, documents) {
	const target = path.join(backupDir, "maps-live.ejson");
	const temporary = `${target}.${randomUUID()}.tmp`;
	const bytes = canonicalMapBytes(documents);
	let handle;
	try {
		handle = await fs.open(temporary, "wx", 0o600);
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = undefined;
		await fs.rename(temporary, target);
		const readback = await fs.readFile(target);
		if (!readback.equals(bytes)) throw worldError("RESET_BACKUP_VERIFY", "Map snapshot readback hash does not match");
		return { path: target, bytes, sha256: mapSha256(documents), mapCount: documents.length };
	} catch (error) {
		if (handle) await handle.close().catch(() => undefined);
		await fs.unlink(temporary).catch(() => undefined);
		throw error;
	}
}

function printReport(report, stdout) {
	stdout(JSON.stringify(report));
	stdout("\n");
}

async function runReset(options = {}) {
	const argv = options.argv || process.argv.slice(2);
	const env = options.env || process.env;
	const stdout = options.stdout || ((value) => process.stdout.write(value));
	const args = parseResetArgs(argv);
	if (args.help) {
		stdout(
			"ADVENTURELAND_RESET_MONGODB_URI=... node node/tools/reset-world.js --database adventureland [--execute --confirm RESET-SKILL-WORLD:...] [--reseed-maps]\n",
		);
		return { mode: "help" };
	}
	const uri = env.ADVENTURELAND_RESET_MONGODB_URI;
	validateResetUri(uri, args.database);
	const releaseLease = await acquireResetLease(options.leaseDir || DEFAULT_LEASE_DIR);
	const runId =
		options.runId ||
		`${new Date()
			.toISOString()
			.replace(/[-:.TZ]/g, "")
			.slice(0, 14)}-${randomUUID()}`;
	const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3_000 });
	try {
		await client.connect();
		const db = client.db(args.database);
		const topology = topologyReport(await writableReplicaSet(db));
		const collectionNames = await readCollectionNames(db);
		const classification = classifyCollections(collectionNames);
		if (classification.unknown.length)
			throw worldError("RESET_UNKNOWN_COLLECTION", "Unknown application collections block reset", {
				unknown: classification.unknown,
			});
		const counts = await countCollections(db, [...MUTABLE_COLLECTIONS, "map"]);
		const liveDocuments = await readMapDocuments(db);
		let mapValidation;
		try {
			mapValidation = validateMapDocuments(liveDocuments, { maps: DESIGN_MAPS });
		} catch (error) {
			if (!args.reseedMaps) throw error;
		}
		const seed = await readSeed(path.join(GAME_ROOT, "seeds"), { maps: DESIGN_MAPS });
		const seedValidation = validateMapDocuments(seed.documents, { maps: DESIGN_MAPS, exact: true });
		if (!args.reseedMaps && mapValidation.requiredSha256 !== seedValidation.sha256) {
			throw worldError("RESET_MAP_SEED_DRIFT", "Required live maps do not match the committed recovery seed");
		}
		const writer = await (options.writerGuard || checkWriterGuards)();
		const requestedBackupDir = args.backupDir || path.join(DEFAULT_BACKUP_ROOT, runId);
		const backupLocation = await checkBackupLocation(requestedBackupDir);
		const mapHash = args.reseedMaps ? seedValidation.sha256 : mapValidation.sha256;
		const preResetMapHash = mapSha256(liveDocuments);
		const plan = buildResetPlan({
			collectionNames,
			counts,
			mapValidation,
			seedValidation,
			reseedMaps: args.reseedMaps,
		});
		const classificationReport = {
			mutable: classification.mutable,
			system: classification.system,
			unknown: classification.unknown,
		};
		const planReport = {
			deleteCollections: plan.deletes,
			preserveMaps: plan.preserveMaps,
			reseedMaps: plan.reseedMaps,
		};
		const seedReport = {
			schemaVersion: seed.manifest.schemaVersion,
			documentCount: seed.manifest.documentCount,
			sha256: seed.manifest.sha256,
			sourceDesignMapHash: seed.manifest.sourceDesignMapHash,
			sourceDesignMapVersion: seed.manifest.sourceDesignMapVersion,
		};
		const guards = {
			loopback: true,
			replicaSet: true,
			collections: classification.unknown.length === 0,
			maps: Boolean(mapValidation) || args.reseedMaps,
			writers: writer.clear,
			backup: true,
			lease: true,
			writer,
		};
		const preview = redactResetReport({
			timestamp: new Date().toISOString(),
			mode: args.execute ? "execute" : "dry-run",
			database: args.database,
			counts,
			preResetMapHash,
			preResetMapCount: liveDocuments.length,
			targetMapHash: mapHash,
			targetMapCount: args.reseedMaps ? seedValidation.mapCount : mapValidation.mapCount,
			mapHash,
			mapCount: args.reseedMaps ? seedValidation.mapCount : mapValidation.mapCount,
			mapExtras: args.reseedMaps ? [] : mapValidation.extras,
			guards,
			backupDir: backupLocation,
			classification: classificationReport,
			plan: planReport,
			seed: seedReport,
			topology,
			reseedMaps: args.reseedMaps,
		});
		if (!args.execute) {
			preview.confirmToken = confirmationToken(args.database, mapHash);
			preview.nextCommand = `ADVENTURELAND_RESET_MONGODB_URI=\"$ADVENTURELAND_RESET_MONGODB_URI\" node node/tools/reset-world.js --database ${args.database} --execute --confirm ${preview.confirmToken}${args.reseedMaps ? " --reseed-maps" : ""} --backup-dir ${JSON.stringify(backupLocation)}`;
			printReport(preview, stdout);
			return { mode: "dry-run", plan, preview };
		}
		if (!writer.clear)
			throw worldError("RESET_WRITER_RUNNING", "Backend, game server, MongoDB pid, or gameplay port is active");
		const expectedToken = confirmationToken(args.database, mapHash);
		if (args.confirm !== expectedToken)
			throw worldError("RESET_CONFIRM", "Confirmation token does not match the validated map hash");
		// Repair/verify required indexes before opening the destructive transaction so a
		// missing index cannot turn a committed data reset into a post-check failure.
		await ensureWorldIndexes(db);
		const backupDir = await ensureBackupDirectory(backupLocation);
		const snapshot = await writeMapSnapshot(backupDir, liveDocuments);
		await fs.writeFile(path.join(backupDir, "preflight.json"), `${JSON.stringify(preview, null, 2)}\n`, {
			mode: 0o600,
		});
		const deleted = {};
		const session = client.startSession();
		try {
			await session.withTransaction(async () => {
				for (const name of plan.deletes)
					deleted[name] = (await db.collection(name).deleteMany({}, { session })).deletedCount;
				if (args.reseedMaps) {
					await db.collection("map").deleteMany({}, { session });
					if (seed.documents.length) await db.collection("map").insertMany(seed.documents, { session, ordered: true });
				}
				if (typeof options.transactionHook === "function") await options.transactionHook({ db, session, plan, deleted });
			});
		} finally {
			await session.endSession();
		}
		const afterDocuments = await readMapDocuments(db);
		const afterValidation = validateMapDocuments(afterDocuments, { maps: DESIGN_MAPS, exact: args.reseedMaps });
		if (afterValidation.sha256 !== mapHash)
			throw worldError("RESET_POSTCHECK", "Map hash changed unexpectedly after reset");
		const afterCounts = await countCollections(db, [...MUTABLE_COLLECTIONS, "map"]);
		const residual = Object.fromEntries(
			MUTABLE_COLLECTIONS.filter((name) => afterCounts[name] !== 0).map((name) => [name, afterCounts[name]]),
		);
		if (Object.keys(residual).length)
			throw worldError("RESET_POSTCHECK", "Mutable documents remain after the committed reset", { residual });
		const indexes = await verifyWorldIndexes(db);
		const report = redactResetReport({
			timestamp: new Date().toISOString(),
			mode: "executed",
			database: args.database,
			counts: afterCounts,
			deleted,
			preResetMapHash,
			preResetMapCount: liveDocuments.length,
			targetMapHash: mapHash,
			targetMapCount: afterValidation.mapCount,
			mapHash: afterValidation.sha256,
			mapCount: afterValidation.mapCount,
			mapExtras: afterValidation.extras,
			guards,
			backupDir,
			classification: classificationReport,
			plan: planReport,
			seed: seedReport,
			topology,
			backup: {
				path: snapshot.path,
				sha256: snapshot.sha256,
				mapCount: snapshot.mapCount,
				verified: true,
			},
			indexes,
			reseedMaps: args.reseedMaps,
		});
		await fs.writeFile(path.join(backupDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
		printReport(report, stdout);
		return { mode: "executed", plan, report, backupDir };
	} finally {
		await client.close();
		await releaseLease();
	}
}

if (require.main === module) {
	runReset().catch((error) => {
		process.stderr.write(`${error.code || "RESET_ERROR"}: ${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = {
	buildResetPlan,
	checkWriterGuards,
	confirmationToken,
	ensureBackupDirectory,
	acquireResetLease,
	parseResetArgs,
	portIsOpen,
	redactResetReport,
	runReset,
	validateResetUri,
	writeMapSnapshot,
};
