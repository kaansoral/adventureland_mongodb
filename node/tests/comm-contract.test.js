"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function functionSource(code, name, nextName) {
	const start = code.indexOf(`function ${name}(`);
	const end = code.indexOf(`function ${nextName}(`, start);
	assert.notEqual(start, -1, `browser source is missing ${name}`);
	assert.notEqual(end, -1, `browser source is missing ${nextName}`);
	return code.slice(start, end).trim();
}

test("Comm waits for selection and safely replaces pending sockets", () => {
	const game = read("js/game.js");
	const comm = read("htmls/comm.html");

	assert.match(comm, /is_comm=true;/);
	assert.match(game, /if \(!demo\) \{\s*load_game\(\);\s*if \(!is_comm\) init_socket\(\);/);
	assert.match(game, /var previous_socket = window\.socket;\s*window\.socket = null;\s*previous_socket\.destroy\(\);/);
	assert.match(game, /socket_instance\.on\("connect_error"/);
	assert.doesNotMatch(game, /if \(!socket_welcomed\) return add_log\("Another server connection in progress\. Please wait\."\)/);

	const active = { destroyCalls: 0, destroy() { this.destroyCalls += 1; } };
	const stale = { destroyCalls: 0, destroy() { this.destroyCalls += 1; } };
	let disconnectCalls = 0;
	const context = {
		window: { socket: active },
		disconnect() {
			disconnectCalls += 1;
		},
	};
	vm.createContext(context);
	const releaseSocket = vm.runInContext(`(${functionSource(game, "release_socket", "init_socket")})`, context);

	assert.equal(releaseSocket(stale), false);
	assert.strictEqual(context.window.socket, active);
	assert.equal(stale.destroyCalls, 0);
	assert.equal(disconnectCalls, 0);

	assert.equal(releaseSocket(active), true);
	assert.equal(context.window.socket, null);
	assert.equal(active.destroyCalls, 1);
	assert.equal(disconnectCalls, 1);
});

test("Comm renders the current character payload fields", () => {
	const comm = read("js/comm.js");
	const renderCharacters = functionSource(comm, "render_characters", "render_servers");
	const rendered = { value: null };
	const context = {
		rc_cache: "-1",
		X: {
			characters: [
				{
					name: "cjstorrs",
					online: 1,
					total_level: 7,
					active_skill: "warrior",
					server: "SR_USI",
					skin: "hair",
					cx: {},
				},
			],
		},
		sprite: () => "<sprite>",
		server_to_ui: () => "I",
		touch_startify: () => {},
		$: () => ({
			html(value) {
				rendered.value = value;
			},
		}),
	};
	vm.createContext(context);
	vm.runInContext(
		`String.prototype.toTitleCase = function () { return this.charAt(0).toUpperCase() + this.slice(1); };\n${renderCharacters}\nrender_characters();`,
		context,
	);

	assert.match(rendered.value, /Lv\.7/);
	assert.match(rendered.value, /Warrior/);
	assert.doesNotMatch(rendered.value, /undefined/);
});

test("Comm receives the observer secret stored in character info", () => {
	const adventureFunctions = read("adventure_functions.js");
	const characterToDict = functionSource(adventureFunctions, "character_to_dict", "characters_to_client");
	const context = {
		get_id: () => "CH_test",
		character_active_skill: () => "warrior",
		mssince: () => 10,
		gf(object, key, fallback) {
			return object && object[key] !== undefined ? object[key] : fallback;
		},
	};
	vm.createContext(context);
	const toDict = vm.runInContext(`(${characterToDict})`, context);

	const serialized = toDict({
		info: {
			name: "cjstorrs",
			skills: {},
			secret: "observer-secret",
			skin: "hair",
			map: "main",
			x: 0,
			y: 0,
		},
		online: true,
		server: "SR_USI",
	});

	assert.equal(serialized.secret, "observer-secret");
});
