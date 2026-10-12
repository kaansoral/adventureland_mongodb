const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { BSON } = require("mongodb");
const { read, load, transactions } = require("./helpers/server_vm");

const ownerId = "US_code_test";
const dataId = "IE_userdata-" + ownerId;
const limitsId = "IE_code_limits-" + ownerId;
const codeId = (slot) => "IE_USERCODE-" + ownerId + "-" + slot;
const code = (slot, source = "test") => ({ _id: codeId(slot), created: new Date(0), info: { code: source } });

function fixture(options = {}) {
	const clock = options.shared ? options.shared.clock : { now: Date.now() };
	class Clock extends Date {
		constructor(...args) {
			super(...(args.length ? args : [clock.now]));
		}
		static now() {
			return clock.now;
		}
	}
	const user = { _id: ownerId, name: "Mage", info: { characters: [{ id: "CH_owned", name: "Mage" }] } };
	const character = { _id: "CH_owned", owner: ownerId, info: { name: "Mage" } };
	const context = vm.createContext({
		Buffer,
		Date: Clock,
		URL,
		Dev: false,
		last_method: "",
		console: { log() {}, error() {} },
		get_user: async (req) => (req.authenticated === false ? null : user),
		get_mcp_api_user: async () => user,
		process_user_data: (id, data) => data || { _id: "IE_userdata-" + id, info: {} },
		MCP_API_RATE_BUCKETS: new Map(),
		MCP_API_RATE_BUCKET_LIMIT: 5000,
	});
	let store = transactions(context, [
		user,
		character,
		{ _id: dataId, info: { code_list: options.list || {}, preserved: true } },
		...(options.documents || []),
	]);
	if (options.shared) {
		store = options.shared.store;
		context.client = options.shared.context.client;
		context.db = options.shared.context.db;
	} else {
		const collection = context.db.collection;
		store.scans = [];
		context.db.collection = (name) => ({
			...collection(name),
			aggregate(pipeline, { session }) {
				assert.equal(name, "infoelement");
				assert.ok(session, "quota reads use the write transaction");
				const [match, limit, project] = JSON.parse(JSON.stringify(pipeline));
				assert.ok(limit.$limit <= 119, "legacy scans are bounded");
				assert.deepEqual(project.$project, {
					created: 1,
					bytes: {
						$cond: [
							{ $eq: [{ $type: "$info.code" }, "string"] },
							{ $strLenBytes: "$info.code" },
							{ $bsonSize: "$$ROOT" },
						],
					},
				});
				store.scans.push(match.$match);
				const snapshot = new Map(session.snapshot);
				for (const [id, value] of session.pending) value === null ? snapshot.delete(id) : snapshot.set(id, value);
				const query = match.$match._id;
				const rows = [...snapshot.values()].filter((row) =>
					typeof query === "string" ? row._id === query : new RegExp(query.$regex).test(row._id),
				);
				return {
					async toArray() {
						return rows.slice(0, limit.$limit).map((row) => ({
							_id: row._id,
							created: row.created,
							bytes:
								typeof row.info?.code === "string" ? Buffer.byteLength(row.info.code) : BSON.calculateObjectSize(row),
						}));
					},
				};
			},
		});
	}
	context.get = async (id) => structuredClone(store.records.get(id) || null);
	load(context, "adventure_functions.js", [
		"gf",
		"to_filename",
		"to_legacy_filename",
		"find_code_slot",
		"get_user_data",
	]);
	load(context, "api.js", [
		"code_storage_limits",
		"code_storage_records",
		"code_storage_usage",
		"save_code_api",
		"load_code_api",
		"delete_character_api",
	]);
	if (options.limits) {
		const original = context.code_storage_limits;
		context.code_storage_limits = () => ({ ...original(), ...options.limits });
	}
	load(context, "common/handlers.js", ["send_json", "handle_api_call"]);
	load(context, "mcp_api.js", [
		"mcp_api_hash_token",
		"mcp_api_rate_profile",
		"mcp_api_take_rate",
		"mcp_api_save_code",
		"mcp_api_delete_code",
		"mcp_api_find_code",
		"mcp_api_list_codes",
		"mcp_api_get_code",
		"validate_mcp_api_args",
		"send_mcp_api_json",
		"handle_mcp_api_call",
	]);
	for (const [file, name] of [
		["api.js", "REF"],
		["mcp_api.js", "MCP_API_REF"],
	]) {
		const definition = read(file).match(/\tsave_code: \{\n[\s\S]*?\n\t\},/);
		vm.runInContext(name + " = {" + definition[0] + "};", context);
	}
	async function request(body, { mcp = false, authenticated = true } = {}) {
		const req = {
			method: "POST",
			params: { method: "save_code" },
			query: {},
			authenticated,
			body: structuredClone(mcp ? { token: "fixture-only", ...body } : body),
		};
		const res = {
			status() {
				return this;
			},
			set() {
				return this;
			},
			send(result) {
				this.result = result;
				return this;
			},
			end() {
				return this;
			},
		};
		await (mcp ? context.handle_mcp_api_call : context.handle_api_call)(req, res);
		return res.result;
	}
	return {
		context,
		user,
		character,
		store,
		clock,
		request,
		save: (slot, source = "test", name = "test") => request({ slot, code: source, name }),
		remove: (slot) => request({ slot, name: "DELETE" }),
	};
}

test("arbitrary slots, numeric aliases, prototype keys and structured values cannot create CODE records", async () => {
	const h = fixture();
	const slots = Array.from({ length: 150 }, (_, i) => "slot" + i + "slot");
	slots.push(
		"__proto__",
		"constructor",
		"toString",
		"NaN",
		"-1",
		"0",
		"101",
		"1junk",
		"01",
		"1.0",
		"1e0",
		"1\n",
		"CH_other",
		1.5,
		{},
		[],
		true,
		null,
	);
	for (const slot of slots) assert.equal((await h.save(slot)).failed, true, String(slot));
	assert.equal(h.store.records.size, 3);
	assert.equal((await h.request({ slot: "1", code: "x" }, { authenticated: false })).reason, "not_logged_in");
});

test("canonical numbers, owned character slots and empty scripts retain the normal save contract", async () => {
	const h = fixture();
	for (const slot of [1, "100", "CH_owned"]) {
		const result = await h.save(slot, "", "helpers");
		assert.equal(result.success, true);
		assert.equal(result.infs.find((entry) => entry.type === "code_info").num, String(slot));
		assert.equal(h.store.records.get(codeId(slot)).info.code, "");
	}
	await h.save("1", "replacement", "renamed");
	assert.deepEqual(h.store.records.get(dataId).info.code_list[1], ["renamed", 2]);
	assert.equal(h.store.records.get(dataId).info.preserved, true);
	assert.equal(h.store.records.get(limitsId).info.usage.count, 3);
	assert.equal(h.store.records.get(limitsId).info.usage.bytes, Buffer.byteLength("replacement"));
	assert.equal(
		h.store.scans.filter((query) => typeof query._id === "object").length,
		1,
		"account usage is initialized once",
	);
});

test("UTF-8 byte limits and code/name types are enforced before writes", async () => {
	const h = fixture();
	const maximum = h.context.code_storage_limits().slot_bytes;
	assert.equal(maximum, 1024 * 1024);
	const source = "é".repeat(maximum / 2);
	assert.equal((await h.save("1", source)).success, true);
	assert.equal((await h.save("1", source + "é")).reason, "code_too_large");
	for (const bad of [null, {}, [], true, 1, undefined])
		assert.equal((await h.request({ slot: "1", code: bad })).failed, true);
	for (const name of [{}, [], "x".repeat(101), "!!!"])
		assert.equal((await h.request({ slot: "1", code: "x", name })).failed, true);
	assert.equal(h.store.records.get(codeId(1)).info.code, source);
	assert.equal(h.store.records.get(dataId).info.code_list[1][1], 1);
});

test("a sanitized DELETE name cannot turn a save into a deletion", async () => {
	const h = fixture();
	await h.save("1", "keep");
	for (const name of ["DELETE!", "DE<LETE>", "DELETE"]) {
		assert.equal((await h.request({ slot: "1", name, code: "replace" }, { mcp: true })).failed, true);
		assert.equal(h.store.records.get(codeId(1)).info.code, "keep");
	}
});

test("legacy invalid slots can be read by exact ID and deleted without changing another slot", async () => {
	const unusual = 'legacy"name',
		prototype = "__proto__";
	const list = JSON.parse(
		JSON.stringify({ 1: ["CH_owned", 1], CH_owned: ["Mage", 1], [unusual]: ["backup", 2], [prototype]: ["old", 1] }),
	);
	const h = fixture({
		list,
		documents: [code("1", "shared"), code("CH_owned", "character"), code(unusual), code(prototype)],
	});
	assert.equal(h.context.find_code_slot(list, "CH_owned"), "CH_owned");
	assert.equal(h.context.mcp_api_find_code(list, "CH_owned").slot, "CH_owned");
	const loaded = await h.context.load_code_api({ user: h.user, name: unusual, pure: true });
	assert.equal(loaded.code, "test");
	for (const slot of [unusual, prototype]) {
		assert.equal((await h.remove(slot)).success, true);
		assert.equal(h.store.records.has(codeId(slot)), false);
		assert.equal(Object.hasOwn(h.store.records.get(dataId).info.code_list, slot), false);
	}
	assert.equal(h.store.records.get(codeId(1)).info.code, "shared");
});

test("quotas include unlisted legacy records and permit storage reduction and deletion", async () => {
	const h = fixture({
		documents: [code("1", "old script"), code("orphan", "old script")],
		limits: { account_bytes: 5 },
	});
	assert.equal((await h.save("2", "x")).reason, "code_storage_full");
	assert.equal((await h.save("1", "x")).success, true, "existing scripts may shrink while over quota");
	assert.equal((await h.remove("orphan")).success, true);
	assert.equal((await h.save("2", "four")).success, true);
	assert.equal((await h.save("3", "x")).reason, "code_storage_full");
	assert.equal(h.store.records.get(limitsId).info.usage.bytes, 5);
	assert.equal((await h.save("1", "")).success, true);
	assert.equal((await h.save("3", "x")).success, true);
});

test("legacy long IDs can be removed, while unknown delete targets cannot grow responses or reset quota scans", async () => {
	const slot = "legacy".repeat(100);
	const h = fixture({ documents: [code(slot)] });
	assert.equal((await h.remove(slot)).success, true);
	const absent = await h.remove(slot + "missing");
	assert.equal(absent.reason, "not_found");
	assert.equal(absent.infs, undefined);
	assert.equal(h.store.records.get(limitsId).info.tokens, 8);
	const full = fixture({ documents: Array.from({ length: 120 }, (_, i) => code("legacy" + i)) });
	await full.save("1");
	await full.remove("1");
	assert.equal(full.store.records.get(limitsId).info.usage.complete, false);
	assert.equal(full.store.scans.filter((query) => typeof query._id === "object").length, 1);
});

test("legacy scans stop after the count ceiling and recover as scripts are removed", async () => {
	const documents = Array.from({ length: 120 }, (_, i) => code("legacy" + i));
	const h = fixture({ documents });
	assert.equal((await h.save("1")).reason, "code_storage_full");
	assert.equal(h.store.records.get(limitsId).info.usage.count, 119);
	for (let i = 0; i < 3; i++) assert.equal((await h.remove("legacy" + i)).success, true);
	assert.equal((await h.save("1")).success, true);
	assert.equal((await h.save("2")).reason, "code_storage_full");
	assert.equal(h.store.records.get(limitsId).info.usage.count, 118);
});

test("rate allowance is shared across API routes and independent HTTP workers", async () => {
	const first = fixture(),
		second = fixture({ shared: first });
	for (let i = 0; i < 10; i++) {
		const result = await (i % 2 ? first : second).request({ slot: "1", code: "x" }, { mcp: i % 3 === 0 });
		assert.equal(result.success, true);
	}
	const limited = await first.save("1");
	assert.equal(limited.reason, "code_rate_limited");
	assert.equal(limited.retry_after_ms, 2000);
	assert.equal((await second.remove("1")).reason, "code_rate_limited");
	first.clock.now += 2000;
	assert.equal((await second.remove("1")).success, true);
	assert.equal((await first.save("2")).reason, "code_rate_limited");
});

test("concurrent writes cannot overspend the last slot or lose a code-list update", async () => {
	const h = fixture({ documents: Array.from({ length: 117 }, (_, i) => code("legacy" + i)) });
	const other = fixture({ shared: h });
	const results = await Promise.all([h.save("1"), other.save("2")]);
	assert.equal(results.filter((result) => result.success).length, 1);
	assert.equal(results.find((result) => result.failed).reason, "code_storage_full");
	assert.equal([...h.store.records.keys()].filter((id) => id.startsWith("IE_USERCODE-")).length, 118);
	assert.equal(h.store.records.get(limitsId).info.usage.count, 118);
	const fresh = fixture();
	assert.ok((await Promise.all([fresh.save("1"), fresh.save("2")])).every((result) => result.success));
	assert.deepEqual(Object.keys(fresh.store.records.get(dataId).info.code_list), ["1", "2"]);
});

test("failed deletes roll back both the script and its listing", async () => {
	const h = fixture();
	await h.save("1");
	const collection = h.context.db.collection;
	h.context.db.collection = (name) => ({
		...collection(name),
		async deleteOne() {
			throw new Error("fixture deletion failure");
		},
	});
	assert.equal((await h.remove("1")).reason, "save_failed");
	assert.ok(h.store.records.has(codeId(1)));
	assert.ok(h.store.records.get(dataId).info.code_list[1]);
	assert.equal(h.store.records.get(limitsId).info.usage.count, 1);
});

test("character deletion removes its script and invalidates usage without resetting rate allowance", async () => {
	const h = fixture();
	await h.save("CH_owned");
	Object.assign(h.context, {
		Dev: true,
		get_domain: async () => ({}),
		get_character: async () => h.character,
		is_in_game: () => false,
		add_event() {},
		simplify_name: (name) => name.toLowerCase(),
		selection_info: async () => ({}),
	});
	const result = await h.context.delete_character_api({ user: h.user, name: "Mage", req: {}, res: { infs: [] } });
	assert.equal(result.success, true);
	assert.equal(h.store.records.has(codeId("CH_owned")), false);
	assert.equal(h.store.records.has("CH_owned"), false);
	assert.equal(h.store.records.get(limitsId).info.usage, null);
	assert.equal(h.store.records.get(limitsId).info.tokens, 9);
	assert.equal(
		(await h.save("CH_owned")).reason,
		"no_slot",
		"stale request owner cannot restore a removed character slot",
	);
	assert.equal((await h.save("1")).success, true);
	assert.equal(h.store.records.get(limitsId).info.usage.count, 1);
});

test("character deletion rechecks ownership inside the transaction", async () => {
	const h = fixture();
	await h.save("CH_owned");
	h.store.records.get("CH_owned").owner = "US_recipient";
	Object.assign(h.context, {
		Dev: true,
		get_domain: async () => ({}),
		get_character: async () => h.character,
		is_in_game: () => false,
		add_event() {},
		simplify_name: (name) => name.toLowerCase(),
	});
	const result = await h.context.delete_character_api({ user: h.user, name: "Mage", req: {}, res: { infs: [] } });
	assert.equal(result.reason, "not_owner");
	assert.ok(h.store.records.has(codeId("CH_owned")));
	assert.equal(h.store.records.get("CH_owned").owner, "US_recipient");
});

test("manual CODE saves show translated rejection feedback", async () => {
	const errors = [];
	const context = vm.createContext({
		$: (selector) => ({ val: () => (selector === ".csharp" ? "1" : "helpers") }),
		codemirror_render: { getValue: () => "keep this code" },
		api_call: async () => {
			throw { failed: true, reason: "code_too_large" };
		},
		window: { inside: "game" },
		add_log: (message) => errors.push(message),
	});
	load(context, "js/functions.js", ["api_call_l", "ui_error", "save_code_s"]);
	context.save_code_s();
	await new Promise(setImmediate);
	assert.deepEqual(errors, [context.phrase.error("code_too_large")]);
	assert.equal(context.codemirror_render.getValue(), "keep this code");
});

test("player map storage accepts only the ten exact owned keys", async () => {
	const saved = [];
	let handler;
	const context = vm.createContext({
		app: {
			post: (_path, fn) => {
				handler = fn;
			},
		},
		get_user: async () => ({ _id: "US_1" }),
		get_id: (entity) => entity._id,
		get_domain: async () => ({}),
		get: async () => null,
		process_map() {},
		save: async (map) => saved.push(map._id),
		to_pretty_num: String,
	});
	const source = read("main.js"),
		start = source.indexOf('app.post("/map/:name/:suffix?"'),
		end = source.indexOf("\n});", start) + 4;
	vm.runInContext(source.slice(start, end), context);
	for (const [name, expected] of [
		["US_1_1_extra", 400],
		["US_1_11", 400],
		["US_1_01", 400],
		["US_other_1", 403],
		["US_1_1", 200],
		["US_1_10", 200],
	]) {
		const res = {
			status(code) {
				this.code = code;
				return this;
			},
			send() {
				return this;
			},
		};
		await handler({ body: { data: {} }, params: { name } }, res);
		assert.equal(res.code, expected, name);
	}
	assert.deepEqual(saved, ["MP_US_1_1", "MP_US_1_10"]);
});
