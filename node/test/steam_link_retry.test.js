const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, transactions } = require("./helpers/server_vm");

function setup(beforeCommit) {
	const owner = {
		_id: "US_owner",
		cash: 15,
		info: { auths: ["fixture-auth"], gold: 5000, items0: [{ name: "rare", level: 9 }] },
	};
	const entity = { _id: "CH_character", owner: owner._id, info: { p: {}, items: [{ name: "sword", level: 8 }] } };
	const errors = [];
	const context = vm.createContext({ console: { log() {}, error: (...args) => errors.push(args) } });
	const store = transactions(context, [owner, entity], beforeCommit);
	load(context, "node/server_functions.js", ["persist_tauri_steam_install"]);
	return { context, owner, entity, errors, ...store };
}

test("Steam linking retries a write conflict without changing bank, inventory, gold, or shells", async () => {
	let attempts = 0;
	const s = setup(({ conflict }) => {
		if (++attempts === 1) throw conflict();
	});
	const result = await s.context.persist_tauri_steam_install(s.owner, s.entity, "fixture-auth", "76561198000000000");
	assert.equal(result, true);
	assert.equal(s.stats.sessions, 2);
	assert.equal(s.stats.commits, 1);
	const saved = s.records.get(s.owner._id);
	assert.equal(saved.pid, "76561198000000000");
	assert.deepEqual(saved.info, s.owner.info);
	assert.equal(saved.cash, s.owner.cash);
	assert.deepEqual(s.records.get(s.entity._id).info.items, s.entity.info.items);
	assert.equal(s.records.get(s.entity._id).info.p.steam_id, saved.pid);
});

test("Steam linking stops after three failed attempts and publishes no partial link", async () => {
	const s = setup(({ conflict }) => {
		throw conflict();
	});
	const before = structuredClone(s.records);
	assert.equal(
		await s.context.persist_tauri_steam_install(s.owner, s.entity, "fixture-auth", "76561198000000000"),
		false,
	);
	assert.equal(s.stats.sessions, 3);
	assert.equal(s.stats.commits, 0);
	assert.deepEqual(s.records, before);
});

test("Steam retry rechecks revoked authentication and character ownership", async () => {
	for (const revoke of ["auth", "owner"]) {
		let attempts = 0;
		const s = setup(({ records, conflict }) => {
			if (++attempts !== 1) return;
			if (revoke === "auth") records.get("US_owner").info.auths = [];
			else records.get("CH_character").owner = "US_other";
			throw conflict();
		});
		assert.equal(
			await s.context.persist_tauri_steam_install(s.owner, s.entity, "fixture-auth", "76561198000000000"),
			false,
		);
		assert.equal(s.stats.sessions, 2);
		assert.equal(s.stats.writes, 0);
		assert.equal(s.records.get(s.owner._id).pid, undefined);
	}
});

test("Steam ticket diagnostics report safe categories without credentials, tickets, URLs, or bodies", async () => {
	const secret = "fixture-private-value",
		ticket = "ab".repeat(64),
		steamId = "76561198000000000";
	const cases = [
		{ ticket: null, reason: "invalid_ticket" },
		{ missing: true, reason: "missing_configuration" },
		{ response: { ok: false, status: 503 }, reason: "http_error (HTTP 503)" },
		{ response: { response: { error: { description: secret } } }, reason: "steam_rejected" },
		{ response: { response: { params: { result: "OK", publisherbanned: true } } }, reason: "publisher_banned" },
		{ response: { response: { params: { result: "OK", steamid: "invalid" } } }, reason: "invalid_steam_id" },
		{ throws: true, reason: "network_error" },
		{ badJson: true, reason: "invalid_response" },
		{ timeout: true, reason: "timeout" },
		{ response: { response: { params: { result: "OK", steamid: steamId } } }, reason: null },
	];
	for (const item of cases) {
		const errors = [];
		let expire,
			cleared = false;
		const context = vm.createContext({
			console: { error: (...args) => errors.push(args.join(" ")) },
			keys: item.missing ? {} : { steam_publisher_web_apikey: secret },
			TAURI_STEAM_APP_ID: "777150",
			TAURI_STEAM_IDENTITY: "fixture-identity",
			AbortController,
			URLSearchParams,
			setTimeout(fn) {
				expire = fn;
				return 1;
			},
			clearTimeout() {
				cleared = true;
			},
			async fetch(url, options) {
				if (item.timeout) {
					expire();
					assert.equal(options.signal.aborted, true);
					throw new Error(secret + ticket + url);
				}
				if (item.throws) throw new Error(secret + ticket + url);
				if (item.response && item.response.ok === false) return item.response;
				return {
					ok: true,
					async json() {
						if (item.badJson) throw new Error(secret + ticket);
						return item.response;
					},
				};
			},
		});
		load(context, "adventure_functions.js", ["verify_tauri_steam_ticket"]);
		assert.equal(
			await context.verify_tauri_steam_ticket("ticket" in item ? item.ticket : ticket),
			item.reason ? "" : steamId,
		);
		if (item.reason) assert.equal(errors[0], "#A Tauri Steam ticket rejected: " + item.reason);
		else assert.equal(errors.length, 0);
		for (const text of errors) {
			assert.ok(!text.includes(secret));
			assert.ok(!text.includes(ticket));
			assert.ok(!text.includes("https://"));
		}
		if (!item.missing && !("ticket" in item)) assert.equal(cleared, true);
	}
});
