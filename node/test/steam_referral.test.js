const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, transactions } = require("./helpers/server_vm");

function fixture(platform = "steam", linked = true) {
	const invited = {
		_id: "US_invited",
		name: "#new",
		created: new Date("2026-10-05"),
		referrer: "US_inviter",
		platform,
		pid: platform === "steam" ? "76561198000000001" : "mas-1",
		info: {},
		...(linked ? { steam_referral: { steamid: "76561198000000001", state: "connected" } } : {}),
	};
	const inviter = { _id: "US_inviter", name: "#old", created: new Date("2020-01-01"), cash: 5, info: {} };
	const records = [invited, inviter];
	if (linked) records.push({ _id: "MK_steam-referral-76561198000000001", owner: invited._id, eligible: true });
	const context = vm.createContext({ console: { log() {}, error() {} }, Date, Promise, setImmediate });
	context.gf = (entity, field, fallback) => entity?.info?.[field] ?? fallback;
	context.localization = require("../../languages");
	context.phrase = context.localization.phrase;
	context.update_mail_count = async () => 1;
	context.add_event = () => {};
	context.update_characters = async () => {};
	const store = transactions(context, records);
	load(context, "adventure_functions.js", ["reward_referrer_logic"]);
	return { context, store, invited };
}

test("first Steam connection pays the inviter once and mails both accounts atomically", async () => {
	const { context, store, invited } = fixture();
	await Promise.all([context.reward_referrer_logic(invited), context.reward_referrer_logic(invited)]);
	assert.equal(store.records.get("US_inviter").cash, 205);
	assert.equal(store.records.get("US_inviter").info.referred, 1);
	assert.equal(store.records.get("US_invited").info.reward, true);
	assert.equal(store.records.get("US_invited").steam_referral.state, "rewarded");
	assert.equal(store.records.get("ML_US_invited-rewards-US_inviter").info.receiver, "US_inviter");
	assert.equal(store.records.get("ML_US_invited-welcome-friendtoken").info.receiver, "US_invited");
	assert.ok(store.records.has("IE_rrewardmark-76561198000000001"));
	await context.reward_referrer_logic(invited);
	assert.equal(store.records.get("US_inviter").cash, 205);
});

test("historical Steam links cannot acquire the new reward", async () => {
	const { context, store, invited } = fixture("steam", false);
	await context.reward_referrer_logic(invited);
	assert.equal(store.records.get("US_inviter").cash, 5);
	assert.equal(store.records.has("ML_US_invited-welcome-friendtoken"), false);
});

test("existing Mac App Store referral reward keeps its inviter-only token", async () => {
	const { context, store, invited } = fixture("mas", false);
	await context.reward_referrer_logic(invited);
	assert.equal(store.records.get("US_inviter").cash, 205);
	assert.ok(store.records.has("ML_US_invited-rewards-US_inviter"));
	assert.equal(store.records.has("ML_US_invited-welcome-friendtoken"), false);
});

test("first Steam association records eligibility once and excludes historical links and rewards", async () => {
	const { context, store } = fixture("steam", false);
	load(context, "adventure_functions.js", ["get_steam_login_id", "register_steam_referral_link"]);
	let other = null;
	context.db.collection = () => ({ findOne: async () => other });
	const get = async (id) => store.records.get(id);
	const save = async (value) => {
		store.records.set(value._id, structuredClone(value));
	};
	const fresh = { _id: "US_fresh", platform: "web", info: {} };
	await context.register_steam_referral_link(fresh, "76561198000000002", get, save, null, false);
	assert.equal(fresh.steam_referral.state, "pending");
	assert.equal(store.records.get("MK_steam-referral-76561198000000002").eligible, true);
	await context.register_steam_referral_link(fresh, "76561198000000002", get, save, null, false);
	assert.equal(store.records.get("MK_steam-referral-76561198000000002").owner, fresh._id);
	const old = { _id: "US_old", platform: "steam", pid: "76561198000000003", info: {} };
	await context.register_steam_referral_link(old, old.pid, get, save, null, false);
	assert.equal(store.records.get("MK_steam-referral-76561198000000003").eligible, false);
	assert.equal(old.steam_referral, undefined);
	store.records.set("IE_rrewardmark-76561198000000004", { _id: "IE_rrewardmark-76561198000000004" });
	const rewarded = { _id: "US_rewarded", platform: "web", info: {} };
	await context.register_steam_referral_link(rewarded, "76561198000000004", get, save, null, true);
	assert.equal(store.records.get("MK_steam-referral-76561198000000004").eligible, false);
	other = { _id: "US_someone_else" };
	const reused = { _id: "US_reused", platform: "web", info: {} };
	await context.register_steam_referral_link(reused, "76561198000000005", get, save, null, true);
	assert.equal(store.records.get("MK_steam-referral-76561198000000005").eligible, false);
});

test("several older Steam friends require a permanent choice and reject changed Steam identities", async () => {
	const { context, store } = fixture("steam", false);
	load(context, "adventure_functions.js", ["get_steam_login_id"]);
	load(context, "api.js", ["steam_referral_candidates_api", "steam_referral_connect_api"]);
	const invited = store.records.get("US_invited");
	delete invited.referrer;
	invited.steam_referral = { steamid: invited.pid, state: "pending" };
	store.records.set(invited._id, invited);
	store.records.set("MK_steam-referral-" + invited.pid, {
		_id: "MK_steam-referral-" + invited.pid,
		owner: invited._id,
		eligible: true,
	});
	const friends = [
		{ _id: "US_a", name: "#a", created: new Date("2020-01-01"), platform: "steam", pid: "76561198000000011", info: {} },
		{ _id: "US_b", name: "#b", created: new Date("2021-01-01"), platform: "steam", pid: "76561198000000012", info: {} },
	];
	for (const friend of friends) store.records.set(friend._id, friend);
	context.verify_tauri_steam_ticket = async () => invited.pid;
	context.get = async (id) => store.records.get(id);
	const originalCollection = context.db.collection;
	context.db.collection = (name) => ({
		...originalCollection(name),
		find: () => ({
			project() {
				return this;
			},
			sort() {
				return this;
			},
			limit() {
				return this;
			},
			maxTimeMS() {
				return this;
			},
			async toArray() {
				return name === "user" ? friends : [];
			},
		}),
	});
	const listed = await context.steam_referral_candidates_api({
		user: invited,
		ticket: "valid",
		friends: friends.map((friend) => friend.pid),
	});
	assert.equal(listed.state, "choose");
	assert.equal(listed.candidates.length, 2);
	assert.deepEqual(
		store.records.get(invited._id).steam_referral.choices.map((choice) => choice.id),
		friends.map((friend) => friend._id),
	);
	const changed = store.records.get("US_a");
	changed.pid = "76561198000000013";
	store.records.set(changed._id, changed);
	const refused = await context.steam_referral_connect_api({
		user: store.records.get(invited._id),
		ticket: "valid",
		inviter: changed._id,
	});
	assert.equal(refused.failed, true);
	const connected = await context.steam_referral_connect_api({
		user: store.records.get(invited._id),
		ticket: "valid",
		inviter: "US_b",
	});
	assert.equal(connected.success, true);
	assert.equal(store.records.get(invited._id).referrer, "US_b");
	assert.equal(store.records.get(invited._id).steam_referral.state, "connected");
});

test("a valid referral takes precedence over Steam friends", async () => {
	const { context, store } = fixture("steam", false);
	load(context, "api.js", ["steam_referral_candidates_api"]);
	const invited = store.records.get("US_invited");
	invited.steam_referral = { steamid: invited.pid, state: "pending" };
	context.verify_tauri_steam_ticket = async () => invited.pid;
	context.get = async (id) => store.records.get(id);
	const result = await context.steam_referral_candidates_api({
		user: invited,
		ticket: "valid",
		friends: ["76561198000000011"],
	});
	assert.equal(result.state, "connected");
	assert.equal(result.candidates, undefined);
});
