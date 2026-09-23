const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, socketHandler } = require("./helpers/server_vm");
const G = require("./helpers/design");

function fixture() {
	let now = 0;
	const events = [];
	const player = { hp: 100, max_hp: 200, mp: 100, max_mp: 300, last: {}, cid: 0 };
	const context = vm.createContext({
		G,
		players: { test: player },
		socket: { id: "test", emit: (event, data) => events.push({ event, data }) },
		future_ms: (ms) => now + ms,
		mssince: (date) => now - date,
		player_to_client: (value) => ({ hp: value.hp, mp: value.mp }),
		disappearing_text: (socket, player, text) => events.push({ text }),
		success_response: (data) => events.push({ success: data }),
		fail_response: (reason, data) => events.push({ failed: reason, data }),
	});
	return { player, context, events, use: socketHandler(context, "use"), advance: (ms) => (now += ms) };
}

test("regeneration keeps its amounts, shared cooldown and server response", () => {
	const { player, events, use, advance } = fixture();
	use({ item: "hp" });
	assert.equal(player.hp, 150);
	assert.equal(player.mp, 100);
	assert.equal(player.last.potion, 4000);
	assert.equal(events.find((event) => event.text).text, "+50");
	assert.equal(events.find((event) => event.event === "eval").data.code, "pot_timeout(4000)");
	assert.equal(events.at(-1).success.used, "hp");
	advance(3999);
	use({ item: "mp" });
	assert.equal(player.mp, 100);
	assert.equal(events.at(-1).failed, "not_ready");
	assert.equal(events.at(-1).data.ms, 1);
	advance(1);
	use({ item: "mp" });
	assert.equal(player.mp, 200);
	assert.equal(player.last.potion, 8000);
	assert.equal(events.at(-1).success.used, "mp");
	assert(events.some((event) => event.text === "+100"));
});

test("regeneration reads the advertised output and caps at maximum HP or MP", () => {
	for (const resource of ["hp", "mp"]) {
		const { player, context, events, use, advance } = fixture();
		context.G = { skills: { ["regen_" + resource]: { ...G.skills["regen_" + resource], output: 17 } } };
		use({ item: resource });
		assert.equal(player[resource], 117);
		assert.equal(events.find((event) => event.text).text, "+17");
		advance(4000);
		player[resource] = player["max_" + resource] - 3;
		use({ item: resource });
		assert.equal(player[resource], player["max_" + resource]);
	}
});

test("both published regeneration examples expose the server amounts", () => {
	for (const file of ["docs/functions/use_skill.html", "docs/articles/7-using-skills.html"]) {
		const source = read(file).match(/<div class="code" id="regeneration-output">([\s\S]*?)<\/div>/)[1];
		let result;
		vm.runInNewContext(source, { G, show_json: (value) => (result = value) });
		assert.equal(result.hp, 50);
		assert.equal(result.mp, 100);
	}
});
