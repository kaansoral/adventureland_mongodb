const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read, socketHandler } = require("./helpers/server_vm");

const stuck = "Unable to move. Trying again.";
const settle = () => new Promise(setImmediate);

function fixture() {
	let time = 0;
	const relayed = [],
		logs = [],
		broadcasts = [],
		responses = [],
		parties = [],
		whispers = [];
	const socket = { id: "socket", emit() {} };
	const player = { name: "Hero", id: "Hero", owner: "account", s: {}, party: "party", socket };
	const friend = { name: "Friend", owner: "friend", socket: { emit: (...args) => whispers.push(args) } };
	class Clock extends Date {
		constructor(...args) {
			super(...(args.length ? args : [time]));
		}
		static now() {
			return time;
		}
	}
	const context = vm.createContext({
		Date: Clock,
		players: { socket: player, friend },
		socket,
		gameplay: "normal",
		Dev: false,
		server_id: "SR_US3",
		discord_relay: { chat: (...args) => relayed.push(args) },
		strip_string: (value) => value.trim(),
		ssince: (date) => (time - date) / 1000,
		mssince: (date) => time - date,
		fail_response: (reason) => responses.push({ failed: true, reason }),
		success_response: () => responses.push({ success: true }),
		broadcast: (...args) => broadcasts.push(args),
		party_emit: (...args) => parties.push(args),
		get_player: (name) => (name === "Friend" ? friend : null),
		insert: async (message) => logs.push(message),
		random_string: () => String(logs.length),
		console,
	});
	load(context, "node/server_functions.js", ["discord_call"]);
	vm.runInContext(read("node/logic/chat.js"), context);
	const say = socketHandler(context, "say");
	return {
		context,
		player,
		relayed,
		logs,
		broadcasts,
		responses,
		parties,
		whispers,
		advance: (ms) => {
			time += ms;
		},
		async send(message = stuck, extra = {}) {
			say({ message, ...extra });
			await settle();
			time += 15000;
		},
	};
}

test("the reported repeating CODE message reaches Discord and each public history only once", async () => {
	const f = fixture();
	for (let i = 0; i < 40; i++) await f.send(stuck, { code: true });
	assert.deepEqual(f.relayed, [["Hero", stuck]]);
	assert.deepEqual(f.logs.map((entry) => entry.owner).sort(), ["account", "friend", "~SR_US3", "~global"].sort());
	assert.ok(f.logs.every((entry) => entry.info.message === stuck));
	assert.equal(f.broadcasts.length, 40);
	assert.equal(f.responses.filter((result) => result.success).length, 40);
	assert.equal(f.player.s.mute, undefined);
});

test("case, formatting, spacing and punctuation changes cannot multiply saved copies", async () => {
	const f = fixture();
	await f.send("Hello, world!");
	await f.send("**HELLO ,   WORLD**!!!");
	await f.send("\u200bＨｅｌｌｏ\u200b,\nworld?");
	await f.send("Different message");
	assert.deepEqual(
		f.relayed.map((entry) => entry[1]),
		["Hello, world!", "Different message"],
	);
	assert.equal(f.logs.length, 8);
});

test("alternating repeats trigger an account mute that survives character changes and reconnects", async () => {
	const f = fixture();
	for (const message of ["First", "Second", "First", "Second", "First", "Second"]) await f.send(message);
	f.context.players.socket = { ...f.player, name: "Alt", id: "Alt", last_say: undefined };
	await f.send("New text from another character");
	assert.equal(f.relayed.length, 2);
	assert.equal(f.logs.length, 8);
	// A different account can still send identical text.
	f.context.players.socket = { ...f.player, owner: "other", last_say: undefined };
	await f.send("First");
	assert.equal(f.relayed.length, 3);
});

test("a mute requires ten minutes of public silence and continued attempts extend it", async () => {
	const f = fixture();
	for (let i = 0; i < 5; i++) await f.send();
	f.advance(9 * 60000);
	await f.send("Still muted");
	f.advance(9 * 60000);
	await f.send("Extends the mute again");
	assert.equal(f.relayed.length, 1);
	f.advance(10 * 60000 - 15000);
	await f.send("Back after ten quiet minutes");
	assert.equal(f.relayed.length, 2);
});

test("infrequent repeats expire and ordinary conversations remain in both destinations", async () => {
	const f = fixture();
	await f.send("Hello");
	f.advance(5 * 60000 - 15000);
	await f.send("Hello");
	for (let i = 0; i < 20; i++) await f.send("Message " + i);
	assert.equal(f.relayed.length, 22);
	assert.equal(f.logs.length, 88);
});

test("flooding with different messages also mutes Discord and histories", async () => {
	const f = fixture();
	for (let i = 0; i < 14; i++) {
		await f.send("Message " + i);
		f.advance(500 - 15000);
	}
	assert.equal(f.relayed.length, 12);
	assert.equal(f.logs.length, 48);
	assert.equal(f.broadcasts.length, 14);
});

test("private and party messages remain available while public forwarding is muted", async () => {
	const f = fixture();
	for (let i = 0; i < 5; i++) await f.send();
	await f.send("Private", { name: "Friend" });
	await f.send("Party", { party: true });
	assert.equal(f.whispers.length, 1);
	assert.equal(f.parties.length, 1);
	assert.equal(f.logs.filter((entry) => entry.type === "private").length, 2);
	assert.equal(f.relayed.length, 1);
});

test("native cooldown and GM mute still reject messages before any delivery", async () => {
	const f = fixture();
	f.player.s.mute = { ms: 60000 };
	await f.send();
	delete f.player.s.mute;
	f.player.last_say = new f.context.Date();
	await f.send();
	assert.deepEqual(f.responses, [
		{ failed: true, reason: "muted" },
		{ failed: true, reason: "chat_slowdown" },
	]);
	assert.equal(f.logs.length, 0);
	assert.equal(f.relayed.length, 0);
	assert.equal(f.broadcasts.length, 0);
});
