const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load } = require("./helpers/server_vm");

// character.info.name is embedded into a JS expression string that later runs
// on a game server via server_eval_safe -> server_eval -> POST /eval. This
// exercises the boundary between that string and the surrounding template,
// independently of the upstream [A-Za-z0-9_] name allowlist (api.js).

function characterEvalContext(recorded) {
	return vm.createContext({
		console: { error() {} },
		get: async () => ({ key: "server1", address: "example.test" }),
		server_eval_safe: async (server, code, data) => {
			recorded.push({ server, code, data });
			return null;
		},
	});
}

function runGenerated(code, sandbox) {
	vm.runInContext(code, vm.createContext(sandbox));
	return sandbox;
}

test("character_eval keeps a normal name working end to end", async () => {
	const recorded = [];
	const context = characterEvalContext(recorded);
	load(context, "adventure_functions.js", ["character_eval"]);

	await context.character_eval({ server: "SR_1", info: { name: "Foo_1" } }, "found = true", {});

	assert.equal(recorded.length, 1);
	const sandbox = runGenerated(recorded[0].code, {
		players: { p1: {} },
		name_to_id: { Foo_1: "p1" },
		found: false,
	});
	assert.equal(sandbox.found, true, "a legitimate player lookup must still resolve and execute the caller's code");
});

test("character_eval treats an adversarial name as an opaque string value, not syntax", async () => {
	const recorded = [];
	const context = characterEvalContext(recorded);
	load(context, "adventure_functions.js", ["character_eval"]);

	// If the name were concatenated unescaped inside single quotes, this value
	// would close the string/subscript early and call spy() as injected code:
	//   name_to_id[''+ (spy(),'') +'']
	const adversarialName = "'+ (spy(),'') +'";
	await context.character_eval({ server: "SR_1", info: { name: adversarialName } }, "found = true", {});

	assert.equal(recorded.length, 1);
	let spied = false;
	const sandbox = runGenerated(recorded[0].code, {
		players: {},
		name_to_id: {},
		found: false,
		spy: () => {
			spied = true;
		},
	});
	assert.equal(spied, false, "the adversarial name must never be evaluated as code");
	assert.equal(sandbox.found, false, "no matching player exists, so the caller's code must not run");
});

test("the [A-Za-z0-9_] character allowlist independently rejects the same adversarial name", () => {
	const context = vm.createContext({
		allowed_name_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
	});
	load(context, "api.js", ["is_name_allowed"]);
	assert.equal(context.is_name_allowed("'+ (spy(),'') +'"), false);
	assert.equal(context.is_name_allowed("Foo_1"), true);
});
