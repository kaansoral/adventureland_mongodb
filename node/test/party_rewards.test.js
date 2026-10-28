const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, extract, socketHandler } = require("./helpers/server_vm");

function partyFixture(types = ["warrior", "mage", "merchant"]) {
	const events = [],
		items = [],
		lost = [];
	const c = vm.createContext({
		Math,
		Date,
		console,
		EPS: 1e-8,
		max: Math.max,
		min: Math.min,
		round: Math.round,
		players: {},
		name_to_id: {},
		parties: { A: [] },
		chests: {},
		S: { gold: 0 },
		G: require("./helpers/design"),
		B: {},
		W: { chest: {} },
		stats: { kills: { goo: 0 } },
		invitations: {},
		requests: {},
		limits: { party: 9, party_max: 10 },
		resend() {},
		calculate_player_stats() {},
		disappearing_text() {},
		monster_hunt_logic() {},
		witch_cipher_kill() {},
		graveyard_fallen() {},
		player_to_client: (p) => p,
		calculate_monster_score: () => 1,
		encouragement_xp: (p, m, xp) => xp,
		encouragement_loot: () => ({}),
		is_invis: () => false,
		simple_distance: (chest) => chest.distance || 0,
		can_add_item: (p) => !p.full,
		cache_item: (item) => ({ ...item }),
		add_item: (p, item) => items.push({ name: p.name, item }),
		lostandfound_logic: (item) => lost.push(item),
		party_emit() {},
		fail_response: (reason) => events.push({ failed: reason }),
		success_response: (value) => events.push({ success: value }),
		log_trace: (label, error) => {
			throw error;
		},
	});
	for (const [i, type] of types.entries()) {
		const name = String.fromCharCode(65 + i);
		const p = {
			id: name,
			name,
			owner: name,
			type,
			level: 50,
			pdps: 0,
			party: "A",
			cx: {},
			map: "main",
			in: "main",
			gold: 0,
			xp: 0,
			xpm: 1,
			goldm: 2,
			s: {},
			p: { stats: { monsters: {}, monsters_diff: {} } },
			socket: { emit: (event, data) => events.push({ name, event, data }) },
		};
		c.players[name] = p;
		c.name_to_id[name] = name;
		c.parties.A.push(name);
	}
	for (const name of ["party_to_client", "calculate_party", "issue_monster_award"])
		vm.runInContext(extract(read("node/server.js"), name), c);
	for (const name of ["mssince", "msince", "to_pretty_num"])
		vm.runInContext(extract(read("js/old_common_functions.js"), name), c);
	vm.runInContext(extract(read("node/server_functions.js"), "server_tax"), c);
	c.socket = { ...c.players.A.socket, id: "A" };
	return { c, events, items, lost };
}

test("party shares pool characters by account and exclude mixed-party merchants", () => {
	const { c } = partyFixture();
	c.players.A.pdps = 72000;
	let roster = c.party_to_client("A");
	assert.ok(Math.abs(roster.A.share - 0.75) < 1e-8);
	assert.ok(Math.abs(roster.B.share - 0.25) < 1e-8);
	assert.equal(roster.C.share, 0);
	c.players.B.owner = "A";
	roster = c.party_to_client("A");
	assert.ok(Math.abs(roster.A.share - 0.5) < 1e-8);
	assert.equal(roster.A.share, roster.B.share);
	assert.equal(roster.A.xp, 10);
	assert.equal(roster.A.gold, 5);
	const all = partyFixture(["merchant", "merchant"]).c;
	const merchantRoster = all.party_to_client("A");
	assert.equal(merchantRoster.A.share, merchantRoster.B.share);
	assert.ok(merchantRoster.A.share > 0.49);
});

test("ordinary party XP reaches another map, uses personal bonuses, and excludes merchants", () => {
	const { c } = partyFixture();
	c.players.A.share = 0.4;
	c.players.B.share = 0.6;
	c.players.C.share = 0;
	c.players.B.map = c.players.B.in = "winterland";
	c.players.B.xpm = 2;
	c.issue_monster_award({ type: "goo", xp: 1000, mult: 1 }, { player: c.players.A, drop: false });
	assert.equal(c.players.A.xp, 400);
	assert.equal(c.players.B.xp, 1200);
	assert.equal(c.players.C.xp, 0);
});

test("ordinary chest gold uses the opener multiplier, with a 400-pixel / 8-minute limit", () => {
	for (const [age, distance, a, b] of [
		[0, 400, 720, 1080],
		[9 * 60000, 0, 360, 540],
		[0, 401, 360, 540],
	]) {
		const { c } = partyFixture();
		c.players.A.share = 0.4;
		c.players.B.share = 0.6;
		c.players.C.share = 0;
		c.players.B.map = c.players.B.in = "winterland";
		c.players.B.goldm = 9;
		c.chests.test = { gold: 1000, items: [], date: new Date(Date.now() - age), distance };
		socketHandler(c, "open_chest")({ id: "test" });
		assert.equal(c.players.A.gold, a);
		assert.equal(c.players.B.gold, b);
		assert.equal(c.players.C.gold, 0);
	}
});

test("party item draws skip recipients without room and send unclaimed items to Lost & Found", () => {
	const { c, items, lost } = partyFixture(["warrior", "mage"]);
	c.players.A.share = 0.4;
	c.players.B.share = 0.6;
	c.players.A.full = true;
	c.players.B.map = c.players.B.in = "winterland";
	const open = socketHandler(c, "open_chest");
	c.chests.test = { gold: 0, items: [{ name: "hpot0", q: 1 }], date: new Date() };
	open({ id: "test" });
	assert.equal(items.length, 1);
	assert.equal(items[0].name, "B");
	c.players.B.full = true;
	c.chests.test = { gold: 0, items: [{ name: "hpot0", q: 1 }], date: new Date() };
	open({ id: "test" });
	assert.equal(items.length, 1);
	assert.equal(lost.length, 1);
});

test("party invite limits are nine non-merchants or ten total, not three", () => {
	const source = read("node/server.js");
	assert.match(source, /party: 9,/);
	assert.match(source, /party_max: 10,/);
	for (const [total, nonMerchants, full] of [
		[3, 3, false],
		[9, 8, false],
		[9, 9, true],
		[10, 8, true],
	]) {
		const { c, events } = partyFixture(Array(total).fill("warrior"));
		c.players.A.party_length = nonMerchants;
		c.players.Friend = { id: "Friend", name: "Friend", socket: { emit() {} } };
		c.name_to_id.Friend = "Friend";
		socketHandler(c, "party")({ event: "invite", name: "Friend" });
		assert.equal(
			events.some((e) => e.failed === "party_full"),
			full,
		);
		if (!full) assert.equal(c.invitations.A.Friend, 1);
	}
});
