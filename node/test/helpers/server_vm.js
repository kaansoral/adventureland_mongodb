const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

function load(context, file, names) {
	vm.runInContext(names.map((name) => extract(read(file), name)).join("\n"), context);
}

function socketHandler(context, event) {
	const source = read("node/server.js");
	const start = source.indexOf('\t\tsocket.on("' + event + '",');
	assert.notEqual(start, -1);
	const end = source.indexOf("\n\t\tsocket.on(", start + 1);
	let handler;
	context.socket.on = (name, callback) => {
		assert.equal(name, event);
		handler = callback;
	};
	vm.runInContext(source.slice(start, end), context);
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
	return { records, stats };
}

module.exports = { root, read, extract, load, socketHandler, transactions };
