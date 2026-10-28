const assert = require("node:assert/strict");
const vm = require("node:vm");
const test = require("node:test");
const { load } = require("./helpers/server_vm");

function fixture(name = "Existing") {
	let writes = 0;
	const user = { _id: "US_fixture", cash: 1000, info: {} };
	const character = { owner: user._id, name: name.toLowerCase(), info: { name }, level: 1 };
	const c = vm.createContext({
		allowed_name_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
		character_types: ["merchant"],
		classes: { merchant: { looks: [["merchant", {}]] } },
		maps: { main: { spawns: [[0, 0]] } },
		really_old: new Date(0),
		get_domain: async () => ({}),
		get_character: async (name, used) => (used ? null : character),
		get_characterth: async () => 1,
		get_ip_info: async () => ({ info: {} }),
		get_id: (entity) => entity._id,
		gf: (entity, key, fallback) => entity.info[key] ?? fallback,
		is_in_game: () => false,
		hsince: () => 100,
		tx: async () => {
			writes++;
			return { failed: true, reason: "fixture_transaction" };
		},
	});
	load(c, "adventure_functions.js", ["is_safe_character_name", "get_character_slots", "can_spend_shells"]);
	load(c, "api.js", [
		"sint",
		"can_create_character_check",
		"is_name_allowed",
		"is_name_xallowed",
		"create_character_api",
		"rename_character_api",
		"quote_name_api",
	]);
	const args = { req: {}, res: { infs: [] }, user, name, char: "merchant", look: 0 };
	return { c, args, writes: () => writes };
}

test("creation, rename and name quotes reject prototype keys in every casing before writes", async () => {
	const f = fixture();
	const names = Object.getOwnPropertyNames(Object.prototype).concat("prototype");
	for (const original of names) {
		for (const name of [original, original.toUpperCase(), original.toLowerCase()]) {
			assert.equal(f.c.is_name_allowed(name), false, name);
			assert.equal(f.c.is_name_xallowed(name), false, name);
			for (const result of [
				await f.c.create_character_api({ ...f.args, name }),
				await f.c.rename_character_api({ ...f.args, nname: name }),
				await f.c.quote_name_api({ ...f.args, nname: name }),
			]) {
				assert.equal(result.failed, true, name);
				assert.equal(result.reason, "invalid_name", name);
			}
		}
	}
	for (const name of [" __proto__ ", "__pro\tto__", "con structor"]) {
		assert.equal((await f.c.create_character_api({ ...f.args, name })).reason, "invalid_name");
	}
	assert.equal(f.writes(), 0);
});

test("numeric-only creation, rename and name quotes fail before writes", async () => {
	const f = fixture();
	for (const name of ["0", "1234", "0001", "999999999999"]) {
		for (const result of [
			await f.c.create_character_api({ ...f.args, name }),
			await f.c.rename_character_api({ ...f.args, nname: name }),
			await f.c.quote_name_api({ ...f.args, nname: name }),
		])
			assert.equal(result.reason, "invalid_name", name);
	}
	assert.equal(f.writes(), 0);
	const existing = fixture("1234");
	assert.equal(existing.c.is_safe_character_name("1234"), true, "existing names remain usable at login");
	assert.equal(
		(await existing.c.rename_character_api({ ...existing.args, nname: "Hero1234" })).reason,
		"fixture_transaction",
	);
});

test("name validation preserves ordinary names and the existing length and alphabet rules", () => {
	const { c } = fixture();
	for (const name of ["Kaan", "Safe_Name", "Hero2026", "_hero_", "abcdefghijkl", "123Hero", "123_4"]) {
		assert.equal(c.is_name_allowed(name), true, name);
		assert.equal(c.is_name_xallowed(name), true, name);
	}
	for (const name of ["A", "AB", "ABC"]) {
		assert.equal(c.is_name_allowed(name), false, name);
		assert.equal(c.is_name_xallowed(name), true, name);
	}
	for (const name of ["", "abcdefghijklm", "a.bcd", "a-bcd", "a bcd", "a\nbcd", null, undefined, 42, [], {}]) {
		assert.equal(c.is_name_allowed(name), false);
		assert.equal(c.is_name_xallowed(name), false);
	}
});

test("ordinary creation and renaming an existing unsafe name reach the normal transaction", async () => {
	const normal = fixture("Safe_Name");
	assert.equal((await normal.c.create_character_api(normal.args)).reason, "fixture_transaction");
	assert.equal(normal.writes(), 1);
	const existing = fixture("__proto__");
	assert.equal(
		(await existing.c.rename_character_api({ ...existing.args, nname: "Safe_Name" })).reason,
		"fixture_transaction",
	);
	assert.equal(existing.writes(), 1);
});

test("non-string creation names fail validation without throwing or writing", async () => {
	const f = fixture();
	for (const name of [[], {}, 42]) {
		assert.equal((await f.c.create_character_api({ ...f.args, name })).reason, "invalid_name");
	}
	assert.equal(f.writes(), 0);
});
