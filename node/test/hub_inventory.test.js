const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, load } = require("./helpers/server_vm");

test("HUB bank reads require the signed-in account and return only saved bank contents", async () => {
	const item = { name: "coat", level: 7, stat_type: "int", l: "l" };
	const user = {
		_id: "US_owner",
		password: "private-account-field",
		info: {
			gold: 1234,
			items0: [item, null],
			items1: [],
			items47: [{ name: "hpot0", q: 10 }],
			items48: [item],
			rewards: ["private-reward-field"],
		},
	};
	let signed_in = user;
	const context = vm.createContext({
		console,
		Dev: false,
		get_user: async () => signed_in,
		gf: (entity, key, fallback) => (entity.info[key] === undefined ? fallback : entity.info[key]),
	});
	vm.runInContext(read("api.js"), context);
	load(context, "adventure_functions.js", ["user_to_server"]);
	load(context, "common/handlers.js", ["handle_api_call", "send_json"]);
	async function request(body = {}, method = "POST") {
		let result;
		const res = {
			status() {
				return this;
			},
			set() {
				return this;
			},
			send(value) {
				result = value;
				return this;
			},
			end() {},
		};
		await context.handle_api_call({ params: { method: "load_bank" }, method, body, query: {} }, res);
		return JSON.parse(JSON.stringify(result));
	}
	const before = JSON.stringify(user);
	assert.deepEqual(await request(), {
		success: true,
		gold: 1234,
		packs: { items0: [item, null], items1: [], items47: [{ name: "hpot0", q: 10 }] },
	});
	assert.equal(JSON.stringify(user), before);
	assert.equal((await request({ user: { _id: "US_other" } })).reason, "invalid_field");
	assert.equal((await request({}, "GET")).reason, "invalid_method");
	signed_in = null;
	assert.equal((await request()).reason, "not_logged_in");
});
