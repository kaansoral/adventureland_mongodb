const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, extract, socketHandler } = require("./helpers/server_vm");

function fixture(query = { broadcast: "1" }) {
	const events = [];
	let clock = 0;
	const c = vm.createContext({
		Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
		Map,
		Date: class extends Date {
			static now() {
				return clock;
			}
		},
		performance: { now: () => clock },
		floor: Math.floor,
		players: {},
		observers: {},
		tavern: {},
		is_pvp: false,
		gameplay: "normal",
		G: require("./helpers/design"),
		B: { vision: [700, 500] },
		instances: { main: { map: "main", observers: {}, info: {} } },
		generated_maps: {},
		merchant_map: "main",
		merchant_x: 0,
		merchant_y: 0,
		resume_instance() {},
		send_generated_maps() {},
		send_all_xy: () => ({}),
		is_invis: (p) => !!p.invisible,
		ssince: () => 1,
		simple_distance: (a, b) => (a.in === b.in ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity),
	});
	c.socket = {
		id: "viewer",
		connected: true,
		handshake: { query },
		first_map: "main",
		first_in: "main",
		first_x: 0,
		first_y: 120,
		emit: (event, data) => events.push({ event, data }),
	};
	vm.runInContext(read("node/logic/observer_broadcast.js"), c);
	for (const name of ["player_to_summary", "transport_observer_to"])
		vm.runInContext(extract(read("node/server.js"), name), c);
	const add = (name, extra = {}) =>
		(c.players[name] = {
			name,
			id: name,
			map: "main",
			in: "main",
			x: 100,
			y: 400,
			skin: "male",
			cx: {},
			last: { attack: 1 },
			...extra,
		});
	const load = (now = 0) => {
		clock = now;
		socketHandler(c, "loaded")({ success: 1, width: 1280, height: 720, scale: 2 });
		return c.observers.viewer;
	};
	const scene = () => events.filter((e) => e.event === "observer_broadcast").at(-1)?.data;
	const update = (now) => {
		clock = now;
		c.update_broadcast_observer(c.observers.viewer, now);
	};
	return { c, events, add, load, scene, update };
}

test("the real loaded handler opts in only public graphical anonymous observers", () => {
	for (const changes of [
		{ query: {} },
		{ query: { broadcast: "1", no_graphics: "1" } },
		{ private: true },
		{ pvp: true },
		{ gameplay: "hardcore" },
	]) {
		const f = fixture(changes.query);
		if (changes.private) f.c.socket.player = { name: "Owner" };
		if (changes.pvp) f.c.is_pvp = true;
		if (changes.gameplay) f.c.gameplay = changes.gameplay;
		const observer = f.load();
		assert.equal(observer.broadcast, undefined);
		assert.equal(f.scene(), undefined);
		assert.equal(observer.y, 120);
	}
	const f = fixture();
	f.add("A");
	assert.ok(f.load().broadcast);
	assert.equal(f.scene().group, "solo:A");
	assert.equal(f.events.at(-1).event, "new_map");
	assert.equal(f.events.at(-1).data.y, 400);
	const count = f.events.length;
	socketHandler(f.c, "o:home")({});
	socketHandler(f.c, "o:command")({ command: "1+1" });
	assert.equal(f.events.length, count, "broadcast viewers gain no private observer controls");
});

test("a whole party stays featured for 30 seconds, then a different group is selected", () => {
	const f = fixture();
	f.add("A", { party: "A", x: 100 });
	f.add("B", { party: "A", x: 200 });
	f.load();
	assert.deepEqual(Object.keys(f.scene().party), ["A", "B"]);
	assert.equal(f.scene().x, 150);
	f.add("C", { x: 500 });
	f.update(29999);
	assert.equal(f.scene().group, "party:A");
	f.update(30000);
	assert.equal(f.scene().group, "solo:C");
	assert.deepEqual(Object.keys(f.scene().party), ["C"]);
	f.update(60000);
	assert.equal(f.scene().group, "party:A");
});

test("party movement updates the subscription without repeated map loads or private information", () => {
	const f = fixture();
	const a = f.add("A", { secret: "private", owner: "private", party: "A", cx: { hair: "hair1" } });
	f.add("B", { party: "A", in: "private-instance" });
	f.add("C", { invisible: true });
	f.add("D", { stealth: true });
	const observer = f.load(),
		maps = () => f.events.filter((e) => e.event === "new_map").length;
	assert.deepEqual(Object.keys(f.scene().party), ["A"]);
	assert.equal(f.scene().online, 4);
	assert.equal(f.scene().party.A.secret, undefined);
	assert.equal(f.scene().party.A.owner, undefined);
	a.x += 50;
	f.update(1000);
	assert.equal(observer.x, 150);
	assert.equal(maps(), 1);
	assert.deepEqual(Array.from(observer.push), [100, 400]);
	f.update(30000);
	assert.equal(maps(), 1, "a lone remaining group should not reload the map each slot");
	delete f.c.players.A;
	f.update(1100);
	assert.equal(f.scene().group, null);
	assert.deepEqual(Object.keys(f.scene().party), []);
	assert.equal(f.scene().available, false);
	f.update(1200);
	assert.equal(maps(), 1, "empty realms must not transport to an empty town fallback");
});

test("town selection requires six visible live players inside the shot and leaves as soon as the crowd drops", () => {
	const f = fixture();
	f.c.Math.random = () => 0;
	f.add("Fighter", { x: 700 });
	for (let i = 0; i < 5; i++) f.add("Merchant" + i, { x: i * 20, y: 0, ctype: "merchant", p: { stand: true } });
	for (const [name, extra] of Object.entries({
		NPC: { npc: true },
		Gone: { dc: true },
		Hidden: { invisible: true },
		Stealth: { stealth: true },
		Dead: { rip: true },
		Private: { in: "private-instance" },
		Edge: { x: 289 },
		Far: { y: 145 },
	}))
		f.add(name, { x: 0, y: 0, ...extra });
	f.load();
	assert.equal(f.scene().town_players, 5);
	assert.equal(f.scene().kind, "group");
	f.add("Sixth", { x: -288, y: -144 });
	f.update(30000);
	assert.equal(f.scene().kind, "town");
	assert.equal(f.scene().town_players, 6);
	assert.equal(f.scene().x, 0);
	assert.equal(f.scene().y, 0);
	assert.deepEqual(Object.keys(f.scene().party), []);
	assert.equal(f.scene().focus.length, 0);
	f.update(59999);
	assert.equal(f.scene().kind, "town");
	f.c.players.Sixth.x = -289;
	f.update(60000 - 0.5);
	assert.equal(f.scene().town_players, 5);
	assert.equal(f.scene().kind, "group");
});

test("town occupies three of ten slots even with unfavorable randomness and server reconnects", () => {
	let towns = 0;
	for (let i = 0; i < 10; i++) {
		const f = fixture();
		f.c.Math.random = () => 0.999;
		f.add("Fighter", { x: 700 });
		for (let j = 0; j < 6; j++) f.add("Merchant" + j, { x: j * 20, y: 0 });
		// A new server subscription midway through each slot keeps the same mix.
		f.load(i * 30000 + 15000);
		assert.equal(f.scene().remaining_ms, 15000);
		if (f.scene().kind === "town") towns++;
	}
	assert.equal(towns, 3);
});

test("a continuous eligible broadcast spends ninety seconds in town per five minutes", () => {
	const f = fixture();
	f.add("Fighter", { x: 700 });
	for (let i = 0; i < 6; i++) f.add("Merchant" + i, { x: i * 20, y: 0 });
	f.load();
	let townMs = 0,
		groupMs = 0,
		longestGap = 0;
	for (let now = 0; now < 600000; now += 250) {
		f.update(now);
		if (f.scene().kind === "town") {
			townMs += 250;
			groupMs = 0;
		} else {
			groupMs += 250;
			longestGap = Math.max(longestGap, groupMs);
		}
	}
	assert.equal(townMs, 180000);
	assert.equal(longestGap, 90000);
});

test("town-only populations never bypass the crowd gate and far-away party members retain their native roster", () => {
	const f = fixture();
	for (let i = 0; i < 5; i++) f.add("Merchant" + i, { x: i * 20, y: 0 });
	f.load();
	assert.equal(f.scene().available, false);
	f.add("Sixth", { x: 0, y: 0 });
	f.update(250);
	assert.equal(f.scene().kind, "town");
	assert.equal(f.scene().available, true);
	f.c.players.Sixth.dc = true;
	f.update(500);
	assert.equal(f.scene().available, false);
	f.add("Fighter", { x: 700, party: "Team" });
	f.c.players.Merchant0.party = "Team";
	f.update(750);
	assert.equal(f.scene().kind, "group");
	assert.deepEqual(Object.keys(f.scene().party).sort(), ["Fighter", "Merchant0"]);
	assert.deepEqual(Array.from(f.scene().focus), ["Fighter"]);
});

test("gathering and live Tavern games prioritize the active group and its active character", () => {
	for (const action of ["fishing", "mining", "dice", "roulette", "wheel", "slots", "poker"]) {
		const f = fixture();
		f.c.Math.random = () => 0;
		f.add("Idle", { last: {} });
		const map = ["fishing", "mining"].includes(action) ? "main" : "tavern";
		f.c.instances[map] ||= { map, observers: {}, info: {} };
		f.add("PartyIdle", { last: {}, party: "Crew", map, in: map });
		const player = f.add("Active", {
			last: {},
			party: "Crew",
			map,
			in: map,
			real_id: "active-id",
			x: 500,
			c: {},
			q: {},
			bets: {},
		});
		if (["fishing", "mining"].includes(action)) player.c[action] = { ms: 20000, drop: "test-drop" };
		else if (["wheel", "slots"].includes(action)) player.q[action] = { ms: 4000, result: "private-result" };
		else if (action === "poker")
			f.c.tavern.poker = { table: { hand: { entries: [{ id: player.real_id, cards: ["private-card"] }] } } };
		else player.bets.test = { type: action, state: "bet", gold: 10000 };
		const before = JSON.stringify({ player, tavern: f.c.tavern });
		f.load();
		assert.equal(f.scene().group, "party:Crew", action);
		assert.deepEqual(Array.from(f.scene().focus), ["Active"], action + " anchors the shot");
		assert.equal(f.scene().x, 500);
		assert.equal(JSON.stringify({ player, tavern: f.c.tavern }), before, "observation is read-only");
		assert.doesNotMatch(JSON.stringify(f.scene()), /private-result|private-card|test-drop/);
	}
});

test("expired channels, settled bets and inactive poker seats do not get activity priority", () => {
	for (const extra of [
		{ c: { fishing: { ms: 0 }, mining: { ms: -1 } } },
		{ q: { slots: { ms: 0 }, wheel: { ms: -1 } } },
		{ bets: { test: { type: "dice", state: "settled" } } },
		{ hand: { over: true, entries: [{ id: "active-id" }] } },
		{ hand: { entries: [{ id: "active-id", folded: true }] } },
		{ hand: { entries: [{ id: "active-id", dc: true }] } },
		{ hand: { entries: [{ id: "somebody-else" }] } },
	]) {
		const f = fixture();
		f.c.Math.random = () => 0;
		f.c.instances.tavern = { map: "tavern", observers: {}, info: {} };
		f.add("Idle", { last: {} });
		f.add("Inactive", { last: {}, map: "tavern", in: "tavern", real_id: "active-id", ...extra });
		if (extra.hand) f.c.tavern.poker = { table: { hand: extra.hand } };
		f.load();
		assert.equal(f.scene().group, "solo:Idle");
	}
});
