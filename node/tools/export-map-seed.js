"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { BSON, MongoClient } = require("mongodb");
const { EJSON } = BSON;

const {
	canonicalMapBytes,
	designMapFingerprint,
	mapSha256,
	requiredMapIds,
	readMapDocuments,
	validateMapDocuments,
} = require("../game/world_schema");

function canonicalJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function seedDocuments(documents, maps) {
	const required = new Set(requiredMapIds(maps));
	return documents.filter((document) => required.has(document._id));
}

function buildSeed(documents, options = {}) {
	const live = validateMapDocuments(documents, { maps: options.maps });
	const seed = seedDocuments(live.documents, options.maps);
	const validated = validateMapDocuments(seed, { maps: options.maps, exact: true });
	return {
		documents: validated.documents,
		bytes: canonicalMapBytes(validated.documents),
		manifest: {
			schemaVersion: 1,
			documentCount: validated.documents.length,
			ids: validated.documents.map((document) => document._id),
			sha256: mapSha256(validated.documents),
			sourceDesignMapHash: designMapFingerprint(options.maps),
			sourceDesignMapVersion: options.designMapVersion ?? null,
			liveDocumentCount: live.documents.length,
			liveExtraCount: live.extras.length,
			liveExtraIds: live.extras,
		},
	};
}

async function writeSeed(outputDir, documents, options = {}) {
	const seed = buildSeed(documents, options);
	await fs.mkdir(outputDir, { recursive: true });
	await fs.writeFile(path.join(outputDir, "maps.ejson"), seed.bytes, { mode: 0o644 });
	await fs.writeFile(path.join(outputDir, "maps.manifest.json"), canonicalJson(seed.manifest), { mode: 0o644 });
	return seed;
}

async function readSeed(seedDir, options = {}) {
	const bytes = await fs.readFile(path.join(seedDir, "maps.ejson"));
	const manifest = JSON.parse(await fs.readFile(path.join(seedDir, "maps.manifest.json"), "utf8"));
	const documents = bytes
		.toString("utf8")
		.split("\n")
		.filter(Boolean)
		.map((line) => EJSON.parse(line));
	const validated = validateMapDocuments(documents, { maps: options.maps, exact: true });
	if (!bytes.equals(canonicalMapBytes(validated.documents))) {
		const error = new Error("Map seed bytes are not canonical Extended JSON");
		error.code = "WORLD_SEED_CANONICAL";
		throw error;
	}
	if (
		manifest.schemaVersion !== 1 ||
		manifest.documentCount !== validated.documents.length ||
		manifest.sha256 !== validated.sha256 ||
		manifest.sourceDesignMapHash !== designMapFingerprint(options.maps)
	) {
		const error = new Error("Map seed manifest does not match canonical seed bytes or design-map provenance");
		error.code = "WORLD_SEED_MANIFEST";
		throw error;
	}
	if (options.designMapVersion !== undefined && manifest.sourceDesignMapVersion !== options.designMapVersion) {
		const error = new Error("Map seed manifest design-map version does not match the current source");
		error.code = "WORLD_SEED_VERSION";
		throw error;
	}
	if (JSON.stringify(manifest.ids) !== JSON.stringify(validated.documents.map((document) => document._id))) {
		const error = new Error("Map seed manifest IDs are not sorted or complete");
		error.code = "WORLD_SEED_IDS";
		throw error;
	}
	return { documents: validated.documents, bytes, manifest };
}

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--output-dir") result.outputDir = argv[++index];
		else if (argument === "--database") result.database = argv[++index];
		else if (argument === "--help") result.help = true;
		else throw new Error(`Unknown argument ${argument}`);
	}
	return result;
}

async function main(argv = process.argv.slice(2), env = process.env) {
	const args = parseArgs(argv);
	if (args.help) {
		process.stdout.write(
			"ADVENTURELAND_RESET_MONGODB_URI=... node node/tools/export-map-seed.js [--database name] [--output-dir seeds]\n",
		);
		return null;
	}
	const uri = env.ADVENTURELAND_RESET_MONGODB_URI;
	if (!uri) throw new Error("ADVENTURELAND_RESET_MONGODB_URI is required");
	const database = args.database || env.ADVENTURELAND_RESET_MONGODB_DATABASE || "adventureland";
	const client = new MongoClient(uri);
	try {
		await client.connect();
		const db = client.db(database);
		const documents = await readMapDocuments(db);
		const outputDir = path.resolve(args.outputDir || path.join(__dirname, "../../seeds"));
		const seed = await writeSeed(outputDir, documents, { designMapVersion: env.ADVENTURELAND_GAME_VERSION || null });
		process.stdout.write(
			`seed=${seed.manifest.documentCount} live=${seed.manifest.liveDocumentCount} extras=${seed.manifest.liveExtraCount} sha256=${seed.manifest.sha256}\n`,
		);
		return seed;
	} finally {
		await client.close();
	}
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.code || "WORLD_SEED_ERROR"}: ${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = { buildSeed, canonicalJson, main, parseArgs, readSeed, seedDocuments, writeSeed };
