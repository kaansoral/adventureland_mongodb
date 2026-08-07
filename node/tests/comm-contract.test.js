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

test("Comm can select a character before a socket exists", () => {
	const game = read("js/game.js");
	const observeCharacter = functionSource(game, "observe_character", "log_in");
	const initArgs = [];
	let hideNavCalls = 0;
	const context = {
		window: {},
		X: {
			characters: [{ name: "cjstorrs", secret: "observer-secret", server: "SR_USI" }],
			servers: [{ key: "SR_USI", address: "localhost:7192", path: "/socket.io/" }],
		},
		observing: null,
		is_comm: true,
		init_socket(args) {
			initArgs.push(args);
		},
		hide_nav() {
			hideNavCalls += 1;
		},
	};
	vm.createContext(context);
	const observe = vm.runInContext(`(${observeCharacter})`, context);

	assert.equal(observe("cjstorrs"), true);
	assert.equal(initArgs.length, 1);
	assert.equal(initArgs[0].secret, "observer-secret");
	assert.equal(hideNavCalls, 1);
});
