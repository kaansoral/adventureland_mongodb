const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const localization = require("../../languages");
const G = require("./helpers/design");
const { load, read } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("message parameters may explicitly name another phrase without changing the raw English payload", () => {
	const runtime = require("../../js/phrases");
	const packet = localization.message(
		"server.game_log.wore_off",
		{ def: { phrase: "condition.stunned.name" } },
		{ color: "gray" },
	);
	assert.equal(packet.message, G.conditions.stunned.name + " wore off ...");
	assert.equal(packet.color, "gray");
	assert.deepEqual(packet.phrase_args, { def: { phrase: "condition.stunned.name" } });
	const translated = runtime.create("tr", {
		"server.game_log.wore_off": "Etki geçti: {def}",
		"condition.stunned.name": "Şaşkın <Aria>",
	});
	assert.equal(translated(packet.phrase, packet.phrase_args), "Etki geçti: Şaşkın <Aria>");
	assert.equal(translated.html(packet.phrase, packet.phrase_args), "Etki geçti: Şaşkın &lt;Aria&gt;");
	assert.equal(packet.message, G.conditions.stunned.name + " wore off ...");
});

test("complete item and kill messages preserve the native English text across loaded definitions", () => {
	const context = vm.createContext({ G, in_arr: (value, array) => array.includes(value) });
	load(context, "node/server_functions.js", [
		"startswith_an",
		"item_to_phrase",
		"item_message",
		"killed_message",
		"kill_message",
	]);
	const items = Object.keys(G.items).filter((key) => G.items[key].name);
	for (const key of items) {
		for (const item of [{ name: key }, { name: key, level: 8 }, { name: key, q: 4, level: 9 }]) {
			const packet = context.item_message("server.item.found", item, {}, { color: "green", item: { name: key } });
			assert.equal(packet.message, "Found " + context.item_to_phrase(item), key);
			assert.deepEqual(plain(packet.item), { name: key });
			assert.equal(packet.color, "green");
			assert.equal(localization.phrase(packet.phrase, packet.phrase_args, "en"), packet.message);
		}
	}
	for (const key of Object.keys(G.monsters)) {
		assert.equal(context.kill_message("Aria", key, true).message, "You " + context.killed_message(key), key);
		assert.equal(context.kill_message("Aria", key, false).message, "Aria " + context.killed_message(key), key);
	}
});

test("floating messages keep their drawing fields and route while carrying localization metadata", () => {
	for (const route of ["socket", "xy", "nv", "party"]) {
		const emitted = [];
		const socket = { emit: (...values) => emitted.push(["socket", ...values]) };
		const entity = { id: "Aria", x: 10, y: 100 };
		const context = vm.createContext({
			xy_emit: (...values) => emitted.push(["xy", ...values]),
			party_emit: (...values) => emitted.push(["party", ...values]),
		});
		load(context, "node/server_functions.js", ["disappearing_text"]);
		const options = { color: "stun", size: "huge", from: "Mage", s: "hit" };
		if (route === "xy" || route === "nv") options.xy = 1;
		if (route === "nv") options.nv = 1;
		if (route === "party") {
			options.party = "Party";
			options.map = "main";
		}
		context.disappearing_text(socket, entity, localization.message("server.floating.stun"), options);
		assert.equal(emitted.length, 1);
		const eventIndex = emitted[0].indexOf("disappearing_text"),
			data = plain(emitted[0][eventIndex + 1]);
		assert.equal(data.message, "STUN!");
		assert.equal(data.phrase, "server.floating.stun");
		assert.deepEqual(data.phrase_args, {});
		assert.deepEqual(data.args, { c: "stun", s: "hit", sz: "huge", from: "Mage" });
		assert.equal(data.x, 10);
		assert.equal(data.y, 70);
		assert.equal(!!data.nv, route === "nv");
		context.disappearing_text(socket, entity, "+50", options);
		const numeric = emitted[1][emitted[1].indexOf("disappearing_text") + 1];
		assert.equal(numeric.message, "+50");
		assert.equal(numeric.phrase, undefined);
	}
});

test("the anniversary reward handler still adds inventory before logging and resending", () => {
	const events = [],
		rewards = [];
	const name = require("../logic/anniversary_event").SLICES[0];
	assert.ok(G.items[name]);
	const player = { name: "Aria", socket: { emit: (event, data) => events.push({ event, data: plain(data) }) } };
	const context = vm.createContext({
		G,
		create_new_item: (name) => ({ name }),
		add_item: (player, item, options) => {
			rewards.push(item);
			events.push({ event: "item", options: plain(options) });
		},
		resend: (player, mode) => events.push({ event: "resend", mode }),
	});
	load(context, "node/server_functions.js", ["anniversary_deliver"]);
	context.anniversary_deliver(player, [name], false);
	assert.deepEqual(rewards, [{ name }]);
	assert.deepEqual(
		events.map((event) => event.event),
		["item", "game_log", "resend"],
	);
	assert.equal(events[1].data.message, "Received: " + G.items[name].name);
	assert.equal(events[1].data.color, "#E6AE3F");
	assert.equal(events[2].mode, "reopen+nc+inv");
});

test("auth game_error values and player chat still retain their original protocol shapes", () => {
	const source = read("node/server.js");
	assert.match(source, /socket\.emit\("game_error", "Failed: " \+ R\.reason\)/);
	assert.match(source, /socket\.emit\("game_error", "Could not confirm your other characters\. Please try again\."\)/);
	assert.match(source, /socket\.emit\("pm", \{ owner: player\.name, message: message, id: player\.id \}\)/);
	assert.match(
		source,
		/party_emit\(player\.party, "partym", \{ owner: player\.name, message: message, id: player\.id, p: true \}\)/,
	);
});
