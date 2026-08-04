"use strict";

const fs = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { MongoClient } = require("mongodb");
const { maps: DESIGN_MAPS } = require("../../design/maps");
const {
	MUTABLE_COLLECTIONS,
	canonicalMapBytes,
	classifyCollections,
	mapSha256,
	readCollectionNames,
	readMapDocuments,
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

function parseResetArgs(argv) {
	const result = { execute: false, reseedMaps: false, json: false };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--execute") result.execute = true;
		else if (argument === "--reseed-maps") result.reseedMaps = true;
		else if (argument === "--json") result.json = true;
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
		mapHash: input.mapHash,
		mapCount: input.mapCount,
		mapExtras: input.mapExtras || [],
		guards: input.guards || {},
		backupDir: input.backupDir,
		reseedMaps: Boolean(input.reseedMaps),
		warning: RESET_WARNING,
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

function writerPortsFromEnv(value) {
	if (value === "") return [];
	if (typeof value !== "string") return [8090, 7192];
	const ports = value
		.split(",")
		.filter(Boolean)
		.map((port) => Number(port));
	if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) {
		throw worldError("RESET_PORTS", "Writer guard ports are invalid");
	}
	return ports;
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
	if (!hello.isWritablePrimary || !hello.setName)
		throw worldError("RESET_REPLICA_SET", "Reset requires a writable MongoDB replica set");
	return hello;
}

async function ensureBackupDirectory(directory) {
	const projectRoot = path.resolve(ROOT_DIR) + path.sep;
	const resolved = path.resolve(directory);
	if (!resolved.startsWith(projectRoot)) {
		throw worldError("RESET_BACKUP_PATH", "Backup directory must remain inside the project");
	}
	await fs.mkdir(directory, { recursive: true });
	await fs.access(directory);
	if ((await fs.readdir(directory)).length) {
		throw worldError("RESET_BACKUP_NOT_EMPTY", "Backup directory must be empty before reset");
	}
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
			await fs.access(existing, require("node:fs").constants.W_OK);
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
	const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3_000 });
	try {
		await client.connect();
		const db = client.db(args.database);
		await writableReplicaSet(db);
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
		const writer = await checkWriterGuards({
			pidDir: env.ADVENTURELAND_RESET_PID_DIR || undefined,
			ports: writerPortsFromEnv(env.ADVENTURELAND_RESET_WRITER_PORTS),
		});
		const backupLocation = await checkBackupLocation(args.backupDir);
		const mapHash = args.reseedMaps ? seedValidation.sha256 : mapValidation.sha256;
		const plan = buildResetPlan({
			collectionNames,
			counts,
			mapValidation,
			seedValidation,
			reseedMaps: args.reseedMaps,
		});
		const guards = {
			loopback: true,
			replicaSet: true,
			collections: classification.unknown.length === 0,
			maps: Boolean(mapValidation) || args.reseedMaps,
			writers: writer.clear,
			backup: true,
		};
		const preview = redactResetReport({
			timestamp: new Date().toISOString(),
			mode: args.execute ? "execute" : "dry-run",
			database: args.database,
			counts,
			mapHash,
			mapCount: args.reseedMaps ? seedValidation.mapCount : mapValidation.mapCount,
			mapExtras: args.reseedMaps ? [] : mapValidation.extras,
			guards,
			reseedMaps: args.reseedMaps,
		});
		if (!args.execute) {
			preview.confirmToken = confirmationToken(args.database, mapHash);
			preview.nextCommand = `ADVENTURELAND_RESET_MONGODB_URI=\"$ADVENTURELAND_RESET_MONGODB_URI\" node node/tools/reset-world.js --database ${args.database} --execute --confirm ${preview.confirmToken}${args.reseedMaps ? " --reseed-maps" : ""}${args.backupDir ? ` --backup-dir ${JSON.stringify(backupLocation)}` : ""}`;
			printReport(preview, stdout);
			return { mode: "dry-run", plan, preview };
		}
		if (!writer.clear)
			throw worldError("RESET_WRITER_RUNNING", "Backend, game server, MongoDB pid, or gameplay port is active");
		const expectedToken = confirmationToken(args.database, mapHash);
		if (args.confirm !== expectedToken)
			throw worldError("RESET_CONFIRM", "Confirmation token does not match the validated map hash");
		const runId = `${new Date()
			.toISOString()
			.replace(/[-:.TZ]/g, "")
			.slice(0, 14)}-${mapHash.slice(0, 12)}`;
		const backupDir = args.backupDir ? backupLocation : path.resolve(path.join(DEFAULT_BACKUP_ROOT, runId));
		await ensureBackupDirectory(backupDir);
		await fs.writeFile(path.join(backupDir, "maps-live.ejson"), canonicalMapBytes(liveDocuments), { mode: 0o600 });
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
			});
		} finally {
			await session.endSession();
		}
		const afterDocuments = await readMapDocuments(db);
		const afterValidation = validateMapDocuments(afterDocuments, { maps: DESIGN_MAPS, exact: args.reseedMaps });
		if (afterValidation.sha256 !== mapHash)
			throw worldError("RESET_POSTCHECK", "Map hash changed unexpectedly after reset");
		const afterCounts = await countCollections(db, [...MUTABLE_COLLECTIONS, "map"]);
		const report = redactResetReport({
			timestamp: new Date().toISOString(),
			mode: "executed",
			database: args.database,
			counts: afterCounts,
			deleted,
			mapHash: afterValidation.sha256,
			mapCount: afterValidation.mapCount,
			mapExtras: afterValidation.extras,
			guards,
			backupDir,
			reseedMaps: args.reseedMaps,
		});
		await fs.writeFile(path.join(backupDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
		printReport(report, stdout);
		return { mode: "executed", plan, report, backupDir };
	} finally {
		await client.close();
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
	parseResetArgs,
	portIsOpen,
	redactResetReport,
	runReset,
	validateResetUri,
	writerPortsFromEnv,
};
