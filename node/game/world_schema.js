"use strict";

const crypto = require("node:crypto");
const { EJSON } = require("mongodb").BSON;

const { maps: DESIGN_MAPS } = require("../../design/maps");

const MUTABLE_COLLECTIONS = Object.freeze([
	"backup",
	"character",
	"event",
	"guild",
	"infoelement",
	"ip",
	"mail",
	"mark",
	"message",
	"pet",
	"server",
	"upload",
	"user",
]);
const KNOWN_COLLECTIONS = Object.freeze(["map", ...MUTABLE_COLLECTIONS]);
const SYSTEM_COLLECTION_PREFIX = "system.";
const WORLD_INDEXES = Object.freeze([
	{
		collection: "character",
		name: "world_total_level_name",
		key: { total_level: -1, name: 1 },
	},
	{
		collection: "character",
		name: "world_merchant_skill_name",
		key: { "info.skills.merchant.level": -1, "info.skills.merchant.xp": -1, name: 1 },
	},
]);

function worldError(code, message, details = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, details);
	return error;
}

function requiredMapIds(maps = DESIGN_MAPS) {
	const ids = new Set();
	for (const entry of Object.values(maps || {})) {
		if (!entry || entry.ignore) continue;
		if (typeof entry.key !== "string" || !entry.key) {
			throw worldError("WORLD_MAP_DEFINITION", "A playable design map has no storage key");
		}
		ids.add(`MP_${entry.key}`);
	}
	return [...ids].sort();
}

function classifyCollections(collectionNames) {
	const mutable = [];
	const system = [];
	const unknown = [];
	const known = new Set(KNOWN_COLLECTIONS);
	for (const name of collectionNames || []) {
		if (name.startsWith(SYSTEM_COLLECTION_PREFIX)) system.push(name);
		else if (MUTABLE_COLLECTIONS.includes(name)) mutable.push(name);
		else if (!known.has(name)) unknown.push(name);
	}
	return { mutable, system, unknown, known: [...(collectionNames || [])].filter((name) => known.has(name)) };
}

function stableValue(value) {
	if (Array.isArray(value)) return value.map(stableValue);
	if (!value || typeof value !== "object" || value instanceof Date || value._bsontype) return value;
	return Object.fromEntries(
		Object.keys(value)
			.sort()
			.map((key) => [key, stableValue(value[key])]),
	);
}

function canonicalDocument(document) {
	return EJSON.stringify(stableValue(document), { relaxed: false });
}

function sortedDocuments(documents) {
	return [...(documents || [])].sort((left, right) => String(left?._id).localeCompare(String(right?._id)));
}

function canonicalMapBytes(documents) {
	return Buffer.from(
		sortedDocuments(documents)
			.map((document) => `${canonicalDocument(document)}\n`)
			.join(""),
		"utf8",
	);
}

function mapSha256(documents) {
	return crypto.createHash("sha256").update(canonicalMapBytes(documents)).digest("hex");
}

function designMapFingerprint(maps = DESIGN_MAPS) {
	const definitions = Object.fromEntries(
		Object.entries(maps || {})
			.filter(([, entry]) => entry && !entry.ignore)
			.map(([name, entry]) => [`MP_${entry.key || name}`, stableValue(entry)])
			.sort(([left], [right]) => left.localeCompare(right)),
	);
	return crypto.createHash("sha256").update(JSON.stringify(definitions)).digest("hex");
}

function hasGeometry(document) {
	const data = document && document.info && document.info.data;
	return Boolean(data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 0);
}

function validateMapDocuments(documents, options = {}) {
	if (!Array.isArray(documents)) throw worldError("WORLD_MAP_SHAPE", "Map documents must be an array");
	const expectedIds = requiredMapIds(options.maps || DESIGN_MAPS);
	const expected = new Set(expectedIds);
	const seen = new Set();
	for (const document of documents) {
		if (!document || typeof document !== "object" || typeof document._id !== "string") {
			throw worldError("WORLD_MAP_SHAPE", "Every map document must have a string _id");
		}
		if (seen.has(document._id)) throw worldError("WORLD_MAP_DUPLICATE", `Map ${document._id} appears more than once`);
		seen.add(document._id);
		if (!hasGeometry(document)) {
			throw worldError(
				"WORLD_MAP_GEOMETRY",
				`${expected.has(document._id) ? "Required" : "Preserved"} map ${document._id} has no geometry`,
			);
		}
	}
	const missing = expectedIds.filter((id) => !seen.has(id));
	if (missing.length) throw worldError("WORLD_MAP_MISSING", "Required map documents are missing", { missing });
	const extras = sortedDocuments(documents)
		.filter((document) => !expected.has(document._id))
		.map((document) => document._id);
	if (options.exact && extras.length)
		throw worldError("WORLD_MAP_EXTRA", "Seed contains non-required map documents", { extras });
	const sorted = sortedDocuments(documents);
	const requiredDocuments = sorted.filter((document) => expected.has(document._id));
	return {
		documents: sorted,
		mapCount: sorted.length,
		requiredCount: expectedIds.length,
		requiredIds: expectedIds,
		extras,
		sha256: mapSha256(sorted),
		requiredSha256: mapSha256(requiredDocuments),
	};
}

function indexMatches(actual, expected) {
	return JSON.stringify(actual) === JSON.stringify(expected);
}

async function ensureWorldIndexes(db) {
	if (!db || typeof db.collection !== "function") throw worldError("WORLD_DB", "A Mongo database handle is required");
	for (const index of WORLD_INDEXES) {
		await db.collection(index.collection).createIndex(index.key, { name: index.name });
	}
	return WORLD_INDEXES;
}

async function verifyWorldIndexes(db, options = {}) {
	const missing = [];
	for (const expected of WORLD_INDEXES) {
		const indexes = await db.collection(expected.collection).listIndexes(options).toArray();
		if (!indexes.some((actual) => actual.name === expected.name && indexMatches(actual.key, expected.key)))
			missing.push(expected.name);
	}
	if (missing.length) throw worldError("WORLD_INDEX_MISSING", "Required world indexes are missing", { missing });
	return WORLD_INDEXES.map((index) => ({ collection: index.collection, name: index.name, key: { ...index.key } }));
}

async function readCollectionNames(db) {
	return (await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name).sort();
}

async function readMapDocuments(db, options = {}) {
	return db.collection("map").find({}, options).sort({ _id: 1 }).toArray();
}

async function verifyWorldState(db, options = {}) {
	const collectionNames = options.collectionNames || (await readCollectionNames(db));
	const classification = classifyCollections(collectionNames);
	const maps = validateMapDocuments(await readMapDocuments(db), { maps: options.maps || DESIGN_MAPS });
	if (options.mapHash && maps.sha256 !== options.mapHash)
		throw worldError("WORLD_MAP_HASH", "World map hash does not match the expected value");
	if (options.requiredMapHash && maps.requiredSha256 !== options.requiredMapHash)
		throw worldError("WORLD_MAP_SEED_DRIFT", "Required live maps do not match the committed recovery seed");
	await verifyWorldIndexes(db);
	return { collectionNames, classification, maps };
}

module.exports = {
	KNOWN_COLLECTIONS,
	MUTABLE_COLLECTIONS,
	WORLD_INDEXES,
	canonicalDocument,
	canonicalMapBytes,
	classifyCollections,
	designMapFingerprint,
	ensureWorldIndexes,
	mapSha256,
	requiredMapIds,
	readCollectionNames,
	readMapDocuments,
	validateMapDocuments,
	verifyWorldIndexes,
	verifyWorldState,
	worldError,
};
