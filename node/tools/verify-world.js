"use strict";

const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { MongoClient } = require("mongodb");
const { maps: DESIGN_MAPS } = require("../../design/maps");
const { buildProgressionData, loadProgressionPublication } = require("../game/skill_domain");
const { verifyWorldState } = require("../game/world_schema");
const { readSeed } = require("./export-map-seed");

function loadProgression() {
	const context = { console, multipliers: { shells_to_gold: 1 } };
	vm.createContext(context);
	for (const file of [
		"conditions.js",
		"item_requirements.js",
		"items.js",
		"skills.js",
		"skill_xp.js",
		"abilities.js",
		"character.js",
	])
		vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../design", file), "utf8"), context, {
			filename: file,
		});
	return context;
}

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--database") result.database = argv[++index];
		else if (argv[index] === "--help") result.help = true;
		else throw new Error(`Unknown argument ${argv[index]}`);
	}
	return result;
}

async function main(argv = process.argv.slice(2), env = process.env) {
	const args = parseArgs(argv);
	if (args.help) {
		process.stdout.write(
			"ADVENTURELAND_RESET_MONGODB_URI=... node node/tools/verify-world.js --database adventureland\n",
		);
		return null;
	}
	const uri =
		env.ADVENTURELAND_RESET_MONGODB_URI || "mongodb://127.0.0.1:27017/adventureland?replicaSet=adventureland-local";
	const database = args.database || env.ADVENTURELAND_RESET_MONGODB_DATABASE || "adventureland";
	const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3_000 });
	try {
		await client.connect();
		const world = await verifyWorldState(client.db(database), { maps: DESIGN_MAPS });
		const seed = await readSeed(path.resolve(__dirname, "../../seeds"), { maps: DESIGN_MAPS });
		const raw = loadProgression();
		const progression = buildProgressionData(raw);
		const publication = loadProgressionPublication({}, progression);
		if (publication.protocol !== 3 || publication.classes || publication.levels)
			throw new Error("Protocol 3 publication failed verification");
		const report = {
			protocol: publication.protocol,
			mapCount: world.maps.mapCount,
			mapHash: world.maps.sha256,
			seedCount: seed.manifest.documentCount,
			seedHash: seed.manifest.sha256,
			indexes: "verified",
			unknownCollections: world.classification.unknown,
		};
		process.stdout.write(`${JSON.stringify(report)}\n`);
		return report;
	} finally {
		await client.close();
	}
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.code || "WORLD_VERIFY_ERROR"}: ${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = { main, parseArgs };
