const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const localization = require("../../../languages");
const client_phrase = require("../../../js/phrases");
client_phrase.load("en", localization.catalog("en"));
const phrase = Object.assign(
	(id, parameters, language) => localization.phrase(id, parameters, language),
	client_phrase,
);
phrase.html = localization.phrase_html;

const root = path.resolve(__dirname, "../../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function extract(source, name) {
	const marker = "function " + name + "(";
	let start = source.indexOf(marker);
	assert.notEqual(start, -1, "missing function " + name);
	if (source.slice(start - 6, start) === "async ") start -= 6;
	const brace = source.indexOf("{", start);
	let depth = 0,
		quote = null,
		escaped = false,
		lineComment = false,
		blockComment = false;
	for (let i = brace; i < source.length; i++) {
		const char = source[i],
			next = source[i + 1];
		if (lineComment) {
			if (char === "\n") lineComment = false;
			continue;
		}
		if (blockComment) {
			if (char === "*" && next === "/") {
				blockComment = false;
				i++;
			}
			continue;
		}
		if (quote) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && next === "/") {
			lineComment = true;
			i++;
			continue;
		}
		if (char === "/" && next === "*") {
			blockComment = true;
			i++;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "{") depth++;
		if (char === "}" && --depth === 0) return source.slice(start, i + 1);
	}
	throw new Error("unterminated function " + name);
}

function localize(context) {
	if (!context.localization) context.localization = localization;
	if (!context.phrase) context.phrase = phrase;
	if (!context.phrase_html) context.phrase_html = localization.phrase_html;
	if (!context.is_array) context.is_array = Array.isArray;
	if (!vm.runInContext("String.prototype.toTitleCase", context)) {
		const source = read("common/js/common_functions.js"),
			start = source.indexOf("String.prototype.toTitleCase =");
		vm.runInContext(source.slice(start, source.indexOf("\n};", start) + 4), context);
	}
	if (!context.in_arr) vm.runInContext(extract(read("js/old_common_functions.js"), "in_arr"), context);
	for (const name of ["startswith_an", "item_message", "kill_message"])
		if (!context[name]) vm.runInContext(extract(read("node/server_functions.js"), name), context);
	return context;
}

const generatedFunctions = ["node/logic/generated_maps.js", "node/logic/cave_of_many_dreams.js"].flatMap((file) => {
	const source = read(file);
	return Array.from(source.matchAll(/^(?:async )?function (\w+)\(/gm), ([, name]) => [name, extract(source, name)]);
});

function generatedContext(context) {
	// Shared server handlers depend on these modules even for ordinary, non-cave characters.
	// Load the real functions, preserving each fixture's explicit environment and overrides.
	context.generated_maps ||= Object.create(null);
	context.generated_runs ||= Object.create(null);
	context.generated_openings ||= new Set();
	context.generated_last_tick ??= 0;
	for (const [name, source] of generatedFunctions) if (!context[name]) vm.runInContext(source, context);
}

function load(context, file, names) {
	localize(context);
	if (
		[
			"node/server.js",
			"node/server_functions.js",
			"node/logic/generated_maps.js",
			"node/logic/cave_of_many_dreams.js",
		].includes(file)
	)
		generatedContext(context);
	if (file === "node/server.js") {
		if (!context.is_cavalry) vm.runInContext(read("node/logic/cavalry.js"), context);
		if (!context.weapon_stat_attack)
			vm.runInContext(extract(read("node/server_functions.js"), "weapon_stat_attack"), context);
	}
	vm.runInContext(names.map((name) => extract(read(file), name)).join("\n"), context);
}

function socketHandler(context, event) {
	localize(context);
	generatedContext(context);
	const source = read("node/server.js");
	const start = source.indexOf('\t\tsocket.on("' + event + '",');
	assert.notEqual(start, -1);
	const end = source.indexOf("\n\t\tsocket.on(", start + 1);
	let handler;
	context.socket.on = (name, callback) => {
		assert.equal(name, event);
		handler = callback;
	};
	vm.runInContext("(function(socket) {\n" + source.slice(start, end) + "\n})(socket);", context);
	return handler;
}

// Run the actual shared transaction helper against an isolated optimistic store.
// No MongoDB connection, account fixtures, or credentials are used.
function transactions(context, documents, beforeCommit) {
	const records = new Map(documents.map((doc) => [doc._id, structuredClone(doc)]));
	const versions = new Map(documents.map((doc) => [doc._id, 0]));
	const stats = { sessions: 0, commits: 0, aborts: 0, writes: 0 };
	const conflict = () => Object.assign(new Error("write conflict"), { code: 112 });
	context.INITIAL_BACKOFF = 0;
	context.BACKOFF_MULTIPLIER = 2;
	context.setTimeout = (fn) => setImmediate(fn);
	context.client = {
		startSession() {
			stats.sessions++;
			return {
				async startTransaction() {
					this.snapshot = structuredClone(records);
					this.versions = new Map(versions);
					this.pending = new Map();
				},
				async commitTransaction() {
					if (beforeCommit) await beforeCommit({ records, versions, stats, session: this, conflict });
					for (const id of this.pending.keys()) if (versions.get(id) !== this.versions.get(id)) throw conflict();
					for (const [id, value] of this.pending) {
						records.set(id, structuredClone(value));
						versions.set(id, (versions.get(id) || 0) + 1);
						stats.writes++;
					}
					stats.commits++;
				},
				async abortTransaction() {
					stats.aborts++;
					this.pending.clear();
				},
				async endSession() {},
			};
		},
	};
	context.db = {
		collection() {
			return {
				async findOne(query, { session }) {
					return structuredClone(session.pending.get(query._id) || session.snapshot.get(query._id) || null);
				},
				async replaceOne(query, entity, { session }) {
					session.pending.set(query._id, structuredClone(entity));
				},
			};
		},
	};
	context.get_id = (entity) => entity._id;
	context.get_kind_from_id = (id) => id.split("_")[0];
	context.get_kind = (entity) => context.get_kind_from_id(entity._id);
	context.post_get = (entity) => entity;
	load(context, "common/mongodb_functions.js", ["tx"]);
	return { records, stats, versions };
}

module.exports = { root, read, extract, load, localize, socketHandler, transactions };
