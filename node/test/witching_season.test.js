"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, extract, localize } = require("./helpers/server_vm");
const design = require("./helpers/design");

const plain = (value) => JSON.parse(JSON.stringify(value));
const NAMES = ["verdantspore", "frostscale", "embercoal", "gloomfeather"];

// The parts of the MongoDB collection API the event modules use, with a real duplicate-key error.
function memory_db() {
	const collections = {};
	const matches = (doc, filter) =>
		Object.entries(filter).every(([key, value]) => {
			if (value && typeof value === "object" && "$lt" in value) return doc[key] < value.$lt;
			if (value && typeof value === "object" && "$in" in value) return value.$in.includes(doc[key]);
			if (value && typeof value === "object" && "$regex" in value) return new RegExp(value.$regex).test(doc[key]);
			return doc[key] === value;
		});
	const apply = (doc, update) => {
		for (const [key, value] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + value;
		for (const [key, value] of Object.entries(update.$max || {})) doc[key] = Math.max(doc[key] ?? value, value);
		Object.assign(doc, update.$set || {});
		return doc;
	};
	const duplicate = () => Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
	return {
		collections,
		collection(name) {
			const docs = (collections[name] ||= new Map());
			return {
				async insertOne(doc) {
					if (docs.has(doc._id)) throw duplicate();
					docs.set(doc._id, plain(doc));
				},
				async findOne(filter) {
					const doc = [...docs.values()].find((d) => matches(d, filter));
					return doc ? plain(doc) : null;
				},
				find(filter) {
					return { toArray: async () => [...docs.values()].filter((d) => matches(d, filter)).map(plain) };
				},
				async updateOne(filter, update, options = {}) {
					const doc = [...docs.values()].find((d) => matches(d, filter));
					if (doc) return (apply(doc, update), { matchedCount: 1 });
					if (!options.upsert) return { matchedCount: 0 };
					if (docs.has(filter._id)) throw duplicate();
					docs.set(filter._id, apply({ _id: filter._id }, update));
					return { matchedCount: 0, upsertedCount: 1 };
				},
				async findOneAndUpdate(filter, update, options = {}) {
					let doc = [...docs.values()].find((d) => matches(d, filter));
					// Like Mongo: an upsert whose filter misses an existing _id is a duplicate key
					if (!doc && options.upsert && docs.has(filter._id)) throw duplicate();
					if (!doc && options.upsert) docs.set(filter._id, (doc = { _id: filter._id }));
					return doc ? plain(apply(doc, update)) : null;
				},
			};
		},
	};
}

function player(name, extra = {}) {
	return Object.assign(
		{
			name: name,
			id: name,
			real_id: "CH_" + name,
			owner: "US_owner",
			map: "halloween",
			in: "halloween",
			x: 858,
			y: -120,
			items: [],
			p: {},
			s: {},
			slots: {},
			socket: { emit() {} },
		},
		extra,
	);
}

function context(extra = {}) {
	const sent = [],
		resent = [],
		later = []; // setTimeout callbacks, run by the test with run_later()
	const c = vm.createContext({
		G: {
			events: design.events,
			items: design.items,
			monsters: design.monsters,
			conditions: design.conditions,
			quests: { witch: { map: "halloween", in: "halloween", x: 858, y: -160 } },
		},
		B: { sell_dist: 400 },
		D: { drops: { monsters: plain(design.drops.monsters), maps: {} } },
		instances: {},
		is_array: Array.isArray,
		E: {},
		S: {},
		events: { halloween: true },
		players: {},
		server_id: "SR_USII",
		db: memory_db(),
		sent,
		broadcast: (name, data) => sent.push([name, data]),
		broadcast_e() {},
		resent,
		resend: (p, flags) => resent.push([p.name, flags]),
		later,
		setTimeout: (f) => later.push(f),
		run_later: () => later.splice(0).forEach((f) => f()),
		log_trace(name, error) {
			throw error;
		},
		add_item: (p, item) => p.items.push(item),
		consume(p, num, q) {
			p.items[num].q -= q;
			if (p.items[num].q <= 0) p.items[num] = null;
		},
		create_new_item: (name, q) => (design.items[name].s ? { name, q: q || 1 } : { name }),
		distance: (a, b) => (a.map !== b.map ? 1e9 : Math.hypot(a.x - b.x, a.y - b.y)),
		random_one: (list) => list[0],
		add_condition: (p, name) => (p.s[name] = { ms: design.conditions[name].duration }),
		disappearing_text() {},
		...extra,
	});
	localize(c);
	vm.runInContext(extract(read("js/old_common_functions.js"), "point_distance"), c);
	vm.runInContext(read("node/logic/witch_cipher.js"), c);
	vm.runInContext(read("node/logic/halloween_events.js"), c);
	return c;
}

const FIVE = ["frostscale", "gloomfeather", "gloomfeather", "embercoal", "verdantspore"];
const stock = (q) => NAMES.map((name) => ({ name, q }));
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("a clue counts the ingredients in the right place and the board narrows the recipes", () => {
	const c = context();
	const right = (secret, mix) => c.witch_cipher_score(secret, mix).right;
	assert.equal(right(FIVE, ["verdantspore", "verdantspore", "frostscale", "frostscale", "verdantspore"]), 1);
	assert.equal(
		right(FIVE, ["frostscale", "gloomfeather", "embercoal", "gloomfeather", "verdantspore"]),
		3,
		"an ingredient in another place does not count",
	);
	assert.equal(right(FIVE, FIVE), 5);
	assert.equal(c.witch_cipher_candidates([]).length, 1024);
	const history = [];
	for (const mix of [
		["verdantspore", "verdantspore", "frostscale", "frostscale", "verdantspore"],
		["frostscale", "embercoal", "gloomfeather", "gloomfeather", "embercoal"],
	]) {
		history.push({ mix, right: right(FIVE, mix) });
		const left = c.witch_cipher_candidates(history);
		assert(
			left.some((recipe) => recipe.join() === FIVE.join()),
			"the secret always fits",
		);
		assert(left.length < 1024);
	}
});

test("while gathering lasts, the four regions drop the ingredients through their usual loot, by HP", () => {
	let roll = 0.01;
	const c = context({ Math: Object.assign(Object.create(Math), { random: () => roll }) });
	const usual = plain(c.D.drops.monsters.ghost);
	const row = (type) => (c.D.drops.monsters[type] || []).find((entry) => NAMES.includes(entry[1]));
	assert.equal(row("ghost"), undefined, "nothing before the round");
	c.witch_cipher_start({ id: "occurrence" });
	const rate = design.events.witchcipher.loot;
	for (const [name, types] of design.events.witchcipher.ingredients)
		for (const type of types) {
			assert.equal(row(type)[1], name, type);
			assert(Math.abs(row(type)[0] - (rate * design.monsters[type].hp) / 1000) < 1e-12, type);
		}
	assert.deepEqual(plain(c.D.drops.monsters.ghost.slice(0, usual.length)), usual, "the usual loot stays");
	assert.equal(row("bat"), undefined, "bats are not on the list");
	// The kill's own roll drops them into the chest: share, Luck, level and the table pass all apply
	vm.runInContext(extract(read("node/server.js"), "roll_monster_drops"), c);
	Object.assign(c, {
		mode: {},
		is_in_pvp: () => false,
		has_home_server_bonus: () => false,
		drop_item_logic: (drop, item) => drop.items.push(item[1]),
	});
	Object.assign(c.B, { drop_table_multiplier: 1, global_drops: false });
	const kill = (luckm) => {
		const drop = { items: [] };
		c.roll_monster_drops(
			{ luckm, tskin: "" },
			{ type: "ghost", map: "halloween", level: 1, mult: 1, max_hp: 12000, luckx: 1 },
			drop,
			1,
		);
		return drop.items;
	};
	roll = 0.04;
	assert(!kill(1).includes("gloomfeather"), "a Ghost's chance is 3.6%");
	assert(kill(2).includes("gloomfeather"), "and Luck raises it");
	c.witch_cipher.gather_end = Date.now() - 1;
	c.witch_cipher_tick();
	assert.equal(row("ghost"), undefined, "nothing drops while brewing");
	assert.deepEqual(plain(c.D.drops.monsters.ghost), usual);
	for (const [, types] of design.events.witchcipher.ingredients)
		for (const type of types)
			assert.deepEqual(plain(c.D.drops.monsters[type]), plain(design.drops.monsters[type]), type);
});

test("anyone brews without joining; an account's characters share its mixes on one realm", async () => {
	const c = context();
	const p = player("Witchling", { items: stock(10) }),
		alt = player("Alt", { real_id: "CH_Alt", items: stock(10) });
	Object.assign(c.players, { Witchling: p, Alt: alt });
	c.witch_cipher_start({ id: "occurrence" });
	assert.deepEqual(plain(alt.witchcipher), { mixes: 0, mixes_left: 5, parcels: 0 }, "every character sees the day");
	assert.equal((await c.witch_cipher_brew(p, FIVE)).mixes_left, 4);
	assert.equal(alt.witchcipher.mixes_left, 4, "the account's other character sees the mix");
	assert.equal((await c.witch_cipher_brew(alt, FIVE)).mixes_left, 3, "and brews from the same five");
	const merchant = player("Merchantly", { owner: "US_merchant", real_id: "CH_M", type: "merchant", items: stock(5) });
	assert.equal((await c.witch_cipher_brew(merchant, FIVE)).success, true, "merchants brew too");
	// The same account on another realm finds today's mixes taken here
	const elsewhere = context({ db: c.db, server_id: "SR_EUI" });
	elsewhere.witch_cipher_start({ id: "eu" });
	const there = player("Witchling", { items: stock(10) });
	const refused = await elsewhere.witch_cipher_brew(there, FIVE);
	assert.deepEqual([refused.reason, refused.phrase], ["witchcipher_elsewhere", "server.witchcipher.claimed_elsewhere"]);
	assert.equal(there.items[0].q, 10, "a refused mix keeps its ingredients");
	const info = await c.witch_cipher_info(alt);
	assert.deepEqual([info.server, info.mixes_left], ["USII", 3]);
});

test("a new mix that fits every clue pays a Parcel; the crack pays a bonus once a day and starts a new recipe", async () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	c.witch_cipher.secret = FIVE.slice();
	const p = player("Witchling", { items: stock(20) });
	const brew = async (mix) => plain(await c.witch_cipher_brew(p, mix));
	const first = await brew(["verdantspore", "verdantspore", "frostscale", "frostscale", "verdantspore"]);
	assert.deepEqual([first.right, first.fits, first.parcels], [1, true, 1]);
	const ruled_out = await brew(["embercoal", "embercoal", "embercoal", "embercoal", "embercoal"]);
	assert.deepEqual([ruled_out.fits, ruled_out.parcels], [false, 0], "the first clue already rules this out");
	const crack = await brew(FIVE);
	assert.deepEqual([crack.cracked, crack.parcels], [true, 5]);
	assert(c.sent.some(([name, data]) => name == "server_message" && data.phrase == "server.witchcipher.cracked"));
	// She forgets it at once: the cracked recipe shows above a clean board for a new one
	assert.deepEqual(plain(c.E.witchcipher.cracked), { by: "Witchling", recipe: FIVE });
	assert.deepEqual([c.E.witchcipher.board.length, c.E.witchcipher.possible, c.E.witchcipher.cracks], [0, 1024, 1]);
	c.witch_cipher.secret = ["embercoal", "embercoal", "frostscale", "verdantspore", "gloomfeather"];
	const again = await brew(FIVE);
	assert.deepEqual([again.cracked, again.fits, again.parcels], [false, true, 1], "the old answer is a first guess now");
	const second = await brew(["embercoal", "embercoal", "frostscale", "verdantspore", "gloomfeather"]);
	assert.deepEqual([second.cracked, second.parcels], [true, 1], "the bonus came with the day's first crack");
	assert.equal((await brew(FIVE)).reason, "witchcipher_no_mixes");
	const parcels = p.items.filter((item) => item && item.name == "witchparcel").reduce((sum, item) => sum + item.q, 0);
	assert.equal(parcels, 8);
	assert.equal(p.items.find((item) => item && item.name == "verdantspore").q, 20 - 3 - 0 - 1 - 1 - 1);
	await settle();
	const saved = await c.db.collection("WitchCipher").findOne({ owner: "US_owner" });
	assert.deepEqual([saved.mixes, saved.parcels, saved.cracks], [5, 8, 2]);
});

test("a mix already on the board teaches nothing and pays nothing", async () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	c.witch_cipher.secret = FIVE.slice();
	const p = player("Witchling", { items: stock(10) });
	const mix = ["verdantspore", "verdantspore", "frostscale", "frostscale", "verdantspore"];
	assert.equal((await c.witch_cipher_brew(p, mix)).parcels, 1);
	const twice = plain(await c.witch_cipher_brew(p, mix));
	assert.deepEqual([twice.fits, twice.parcels, c.witch_cipher.history.length], [false, 0, 1]);
});

test("a failed claim write is retried", async () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	const p = player("Witchling", { items: stock(10) });
	await c.witch_cipher_brew(p, FIVE);
	await settle();
	const collection = c.db.collection;
	let failures = 1;
	c.db.collection = (name) => {
		const real = collection.call(c.db, name);
		return Object.assign({}, real, {
			updateOne: (...args) => (failures-- > 0 ? Promise.reject(new Error("write failed")) : real.updateOne(...args)),
		});
	};
	c.log_trace = () => {};
	await c.witch_cipher_brew(p, FIVE);
	await settle();
	assert.equal((await collection.call(c.db, "WitchCipher").findOne({ owner: "US_owner" })).mixes, 1);
	c.run_later();
	await settle();
	assert.equal((await collection.call(c.db, "WitchCipher").findOne({ owner: "US_owner" })).mixes, 2);
});

test("after a restart a character finds its account's day in Mongo, not in the snapshot", async () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	const p = player("Witchling", { items: stock(10) });
	await c.witch_cipher_brew(p, FIVE);
	await settle();
	const restarted = context({ db: c.db, S: { witchcipher: plain(c.S.witchcipher) } });
	restarted.witch_cipher_restore();
	assert.equal(restarted.S.witchcipher.claims, undefined, "claims are not part of the saved round");
	const back = player("Alt", { real_id: "CH_Alt", items: stock(10) });
	restarted.event_player_status(back);
	assert.equal(back.witchcipher.mixes_left, 5, "shown at once");
	await new Promise((resolve) => setTimeout(resolve, 5));
	assert.equal(back.witchcipher.mixes_left, 4, "then read back");
	assert.equal((await restarted.witch_cipher_brew(back, FIVE)).mixes_left, 3);
});

test("brewing needs the ingredients and the Witch nearby", async () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	const p = player("Witchling", { items: [{ name: "verdantspore", q: 4 }] });
	const all = Array(5).fill("verdantspore");
	assert.equal((await c.witch_cipher_brew(p, all)).reason, "witchcipher_ingredients");
	assert.equal((await c.witch_cipher_brew(p, all.slice(0, 4))).reason, "invalid", "five ingredients");
	assert.equal((await c.witch_cipher_brew(p, ["candy1", ...all.slice(1)])).reason, "invalid");
	p.items = [{ name: "verdantspore", q: 5 }];
	p.map = "main";
	assert.equal((await c.witch_cipher_brew(p, all)).reason, "distance");
	p.map = "halloween";
	p.user = {};
	assert.equal((await c.witch_cipher_brew(p, all)).reason, "cant_in_bank");
	assert.equal(p.items[0].q, 5, "a refused mix keeps the ingredients");
	assert.equal(await c.db.collection("WitchCipher").findOne({ owner: "US_owner" }), null, "and opens no claim");
});

test("the day's other round shows each account what it has left, here or on another realm", async () => {
	const c = context();
	const p = player("Witchling", { items: stock(10) }),
		alt = player("Alt", { real_id: "CH_Alt" }),
		visitor = player("Visitor", { owner: "US_visitor", real_id: "CH_Visitor" });
	Object.assign(c.players, { Witchling: p, Alt: alt, Visitor: visitor });
	c.witch_cipher_start({ id: "morning" });
	await c.witch_cipher_brew(p, FIVE);
	await c.witch_cipher_brew(p, ["frostscale", "verdantspore", "embercoal", "gloomfeather", "gloomfeather"]);
	// The visitor brewed on another realm this morning
	await c.db.collection("WitchCipher").insertOne({
		_id: "claim:US_visitor:" + c.witch_cipher.day,
		owner: "US_visitor",
		day: c.witch_cipher.day,
		name: "Visitor",
		server: "SR_EUI",
		mixes: 1,
		parcels: 1,
		cracks: 0,
	});
	c.witch_cipher.end = Date.now() - 1;
	c.witch_cipher_tick();
	assert.equal(p.witchcipher, null, "nothing between the rounds");
	c.witch_cipher_start({ id: "evening" });
	assert.equal(p.witchcipher.mixes_left, 3);
	assert.equal(alt.witchcipher.mixes_left, 3);
	await settle();
	assert.deepEqual([visitor.witchcipher.mixes_left, visitor.witchcipher.server], [0, "EUI"], "its mixes are on EU I");
	assert.equal(
		(await c.witch_cipher_brew(p, ["gloomfeather", "embercoal", "frostscale", "verdantspore", "verdantspore"]))
			.mixes_left,
		2,
	);
	// A restart between the rounds: this server forgot the claim, Mongo still has it
	await settle();
	const restarted = context({ db: c.db });
	const back = player("Witchling");
	restarted.players.Witchling = back;
	restarted.witch_cipher_start({ id: "next" });
	await settle();
	assert.equal(back.witchcipher.mixes_left, 2);
});

test("a round that runs past UTC midnight keeps its day", async () => {
	const c = context();
	c.witch_cipher_start({ id: "late" });
	c.witch_cipher.day = "2026-10-17";
	await c.witch_cipher_brew(player("Witchling", { items: stock(5) }), FIVE);
	assert.equal((await c.db.collection("WitchCipher").findOne({ owner: "US_owner" }))._id, "claim:US_owner:2026-10-17");
});

test("a round survives a restart, keeps dropping ingredients while it gathers, and finishes once it is over", () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	const saved = plain(c.S.witchcipher);
	const restarted = context({ S: { witchcipher: saved } });
	restarted.witch_cipher_restore();
	assert.equal(restarted.events.witchcipher, true);
	assert.equal(restarted.E.witchcipher.id, "occurrence");
	assert(restarted.D.drops.monsters.ghost.some((row) => row[1] == "gloomfeather"));
	const brewing = context({ S: { witchcipher: Object.assign(plain(saved), { gather_end: Date.now() - 1 }) } });
	brewing.witch_cipher_restore();
	assert(!brewing.D.drops.monsters.ghost.some((row) => row[1] == "gloomfeather"), "not once gathering is over");
	const late = context({ S: { witchcipher: Object.assign(plain(saved), { end: Date.now() - 1 }) } });
	late.witch_cipher_restore();
	assert.equal(late.events.witchcipher, false);
	assert.equal(late.S.witchcipher, null);
	assert(late.sent.some(([, data]) => data.phrase == "server.witchcipher.over_uncracked"));
});

test("a round saved under older rules keeps its cracked recipe and starts a five-ingredient one", () => {
	const c = context();
	c.witch_cipher_start({ id: "occurrence" });
	const old = ["frostscale", "gloomfeather", "gloomfeather", "embercoal"];
	Object.assign(c.witch_cipher, {
		secret: old.slice(),
		cracked: { by: "Witchling", at: Date.now() },
		history: [{ mix: old.slice(), right: 4, moved: 0, by: "Witchling" }],
	});
	delete c.witch_cipher.cracks;
	c.S.witchcipher = c.witch_cipher;
	c.witch_cipher_restore();
	assert.deepEqual(plain(c.witch_cipher.cracks.map((crack) => crack.recipe)), [old]);
	assert.deepEqual(plain(c.E.witchcipher.cracked.recipe), old);
	assert.deepEqual([c.witch_cipher.secret.length, c.witch_cipher.history.length], [5, 0]);
	const four = context({
		S: {
			witchcipher: Object.assign(plain(c.S.witchcipher), {
				cracks: [],
				secret: old.slice(),
				history: [{ mix: old, right: 1 }],
			}),
		},
	});
	four.witch_cipher_restore();
	assert.deepEqual([four.witch_cipher.secret.length, four.witch_cipher.history.length], [5, 0]);
});

test("doors open once a day per character, 14 times per account, and stamps pay Parcels and the laugh", async () => {
	let roll = 0;
	const c = context({ Math: Object.assign(Object.create(Math), { random: () => roll }) });
	const doors = design.events.trickortreat.doors;
	const p = player("Witchling", { map: doors[0][0], x: doors[0][1], y: doors[0][2] + 20 });
	const treat = await c.trick_or_treat_knock(p, {});
	assert.deepEqual([treat.door, treat.stamps, treat.treat.name], [0, 1, "candy1"]);
	assert.equal((await c.trick_or_treat_knock(p, {})).reason, "trickortreat_knocked");
	p.x += 500;
	assert.equal((await c.trick_or_treat_knock(p, {})).reason, "trickortreat_door");
	// A trick: Spooked! gives speed.
	roll = 0.99;
	Object.assign(p, { map: doors[1][0], x: doors[1][1], y: doors[1][2] + 20 });
	const trick = await c.trick_or_treat_knock(p, {});
	assert.equal(trick.trick, "spooked");
	assert(p.s.spooked);
	// Other characters of the account knock until the account's daily 14.
	roll = 0;
	let knocks = 2;
	for (let n = 0; knocks < 16; n++) {
		const alt = player("Alt" + n, {
			real_id: "CH_Alt" + n,
			map: doors[n % 7][0],
			x: doors[n % 7][1],
			y: doors[n % 7][2] + 20,
		});
		const result = await c.trick_or_treat_knock(alt, { door: n % 7 });
		knocks++;
		if (knocks <= 14) {
			assert.equal(result.success, true, "knock " + knocks);
			if (result.stamps === 10) assert.equal(result.parcel, true);
		} else assert.equal(result.reason, "trickortreat_limit", "knock " + knocks);
	}
	const stamps = (await c.db.collection("TrickOrTreat").findOne({ _id: { $regex: "^stamps:US_owner:" } })).stamps;
	assert.equal(stamps, 14, "a refused knock is not a stamp");
	// Stamp 40 brings the jar.
	await c.db
		.collection("TrickOrTreat")
		.updateOne({ _id: "stamps:US_owner:" + new Date().getUTCFullYear() }, { $set: { stamps: 39 } });
	c.events.halloween = true;
	const fresh = player("Fresh", {
		owner: "US_fresh",
		real_id: "CH_Fresh",
		map: doors[2][0],
		x: doors[2][1],
		y: doors[2][2] + 20,
	});
	await c.db
		.collection("TrickOrTreat")
		.updateOne({ _id: "stamps:US_fresh:" + new Date().getUTCFullYear() }, { $set: { stamps: 39 } }, { upsert: true });
	const laugh = await c.trick_or_treat_knock(fresh, {});
	assert.equal(laugh.laugh, true);
	assert.deepEqual(plain(fresh.items.find((item) => item.name == "cxjar")), {
		name: "cxjar",
		q: 1,
		data: "sinisterlaugh",
	});
	c.events.halloween = false;
	assert.equal((await c.trick_or_treat_knock(fresh, { door: 3 })).reason, "trickortreat_season");
});

test("a door must be a door number, and a character that leaves mid-knock still gets its rewards", async () => {
	const c = context({ Math: Object.assign(Object.create(Math), { random: () => 0 }) });
	const door = design.events.trickortreat.doors[0];
	const p = player("Witchling", { map: door[0], x: door[1], y: door[2] + 20 });
	for (const value of [[0], "0", 0.5, -1, 99, { 0: 0 }])
		assert.equal((await c.trick_or_treat_knock(p, { door: value })).reason, "trickortreat_door", JSON.stringify(value));
	const knock = c.trick_or_treat_knock(p, { door: 0 });
	assert.equal(p.knocking, 1, "the logout save waits while the knock settles");
	p.dc = true; // logged out while the counts were saved
	const result = await knock;
	assert.equal(result.treat.name, "candy1");
	assert.equal(p.items[0].name, "candy1", "the reward is on the character before its last save");
	assert.equal(p.knocking, undefined);
	assert.deepEqual(plain(p.p.trickortreat.doors), [0]);
	const counts = c.db.collections.TrickOrTreat;
	assert.deepEqual(
		[...counts.values()].map((doc) => ("count" in doc ? doc.count : doc.stamps)),
		[1, 1],
	);
});

test("the logout save waits for a settling knock", async () => {
	const source = read("node/server.js");
	const c = vm.createContext({
		init_player_exit() {
			throw new Error("the save started");
		},
	});
	vm.runInContext(extract(source, "stop_call"), c);
	assert.equal(await c.stop_call({ knocking: 1 }), undefined, "retried on the next loop");
	await assert.rejects(c.stop_call({}), /the save started/);
});

test("Spooked! recalculates speed, and doors reopen for everyone at UTC midnight", async () => {
	const c = context({ Math: Object.assign(Object.create(Math), { random: () => 0.99 }) });
	const door = design.events.trickortreat.doors[0];
	const p = player("Witchling", { map: door[0], x: door[1], y: door[2] + 20 });
	assert.equal((await c.trick_or_treat_knock(p, {})).trick, "spooked");
	const flags = c.resent.find(([name]) => name == "Witchling")[1].split("+");
	assert(!flags.includes("nc"), "the speed needs a stat calculation");
	const yesterday = c.trick_or_treat_day(Date.now() - 86400000);
	p.p.trickortreat.day = yesterday;
	p.trickortreat = { doors: [0], doors_left: 6, stamps: 1 };
	c.players[p.id] = p;
	c.trick_or_treat_last_day = yesterday;
	c.resent.length = 0;
	c.trick_or_treat_tick();
	assert.deepEqual(plain(p.trickortreat), { doors: [], doors_left: 7, stamps: 1 });
	assert.deepEqual(plain(c.resent), [["Witchling", "u+cid+nc"]]);
	c.trick_or_treat_tick();
	assert.equal(c.resent.length, 1, "once a day");
});

test("a pumpkin on your head gets more treats", async () => {
	const c = context({ Math: Object.assign(Object.create(Math), { random: () => 0.8 }) });
	const door = design.events.trickortreat.doors[0];
	const plain_head = player("Plain", { map: door[0], x: door[1], y: door[2] + 20 });
	const pumpkin = player("Pumpkin", {
		owner: "US_pumpkin",
		real_id: "CH_Pumpkin",
		map: door[0],
		x: door[1],
		y: door[2] + 20,
		slots: { helmet: { name: "phelmet" } },
	});
	assert.equal((await c.trick_or_treat_knock(plain_head, {})).trick, "spooked", "80 is above the 70% treat chance");
	assert.ok((await c.trick_or_treat_knock(pumpkin, {})).treat, "but below 85% in a pumpkin helmet");
});

test("a trick can let a Ghost out of the door; it floats away after two minutes or when Halloween ends", async () => {
	const rolls = [0.9, 0.9]; // a trick, then the Ghost
	const halloween = { players: {}, monsters: {} };
	const spawned = [];
	const c = context({
		Math: Object.assign(Object.create(Math), { random: () => (rolls.length ? rolls.shift() : 0) }),
		instances: { halloween },
		new_monster(map, def) {
			const m = { id: "ghost" + spawned.length, type: def.type, map, x: def.boundary[0], y: def.boundary[1], s: {} };
			halloween.monsters[m.id] = m;
			spawned.push([map, def]);
			return m;
		},
		remove_monster: (m) => delete halloween.monsters[m.id],
	});
	const door = design.events.trickortreat.doors[0];
	const p = player("Witchling", { map: door[0], x: door[1], y: door[2] + 20 });
	const result = await c.trick_or_treat_knock(p, {});
	assert.equal(result.trick, "ghost");
	assert.equal(p.s.spooked, undefined);
	assert.deepEqual(
		spawned.map(([map, def]) => [map, def.type, def.special]),
		[["halloween", "ghost", true]],
	);
	const [, def] = spawned[0];
	assert(def.boundary[0] < door[1] && door[1] < def.boundary[2] && def.boundary[1] > door[2], "in front of the door");
	c.trick_or_treat_tick();
	assert.equal(Object.keys(halloween.monsters).length, 1, "it stays a while");
	c.trick_or_treat_ghosts[0][2] = Date.now() - 1;
	c.trick_or_treat_tick();
	assert.deepEqual(Object.keys(halloween.monsters), [], "then floats away");
	assert.deepEqual(plain(c.trick_or_treat_ghosts), []);
	// Halloween ends: a Ghost still out leaves at once
	rolls.push(0.9, 0.9);
	const alt = player("Alt", { real_id: "CH_Alt", map: door[0], x: door[1], y: door[2] + 20 });
	assert.equal((await c.trick_or_treat_knock(alt, {})).trick, "ghost");
	c.events.halloween = false;
	c.trick_or_treat_tick();
	assert.deepEqual(Object.keys(halloween.monsters), []);
});

test("treats include the Witch's ingredients and her Parcels", () => {
	const treats = design.events.trickortreat.treats;
	const names = treats.map((row) => row[1]);
	for (const name of [...NAMES, "witchparcel", "candy0", "candy1"]) assert(names.includes(name), name);
	assert.equal(
		treats.reduce((sum, row) => sum + row[0], 0),
		100,
	);
});

test("everything done to the waves counts toward the Gargoyle", () => {
	const { c, spawned, instance } = graveyard_context();
	c.graveyard_start({ id: "rising" });
	assert.equal(spawned.length, 12);
	assert(
		spawned.every((m) =>
			design.events.graveyard.graves.some((g) => Math.abs(g[0] - m.x) <= 3 && Math.abs(g[1] - m.y) <= 3),
		),
		"they rise from the graves",
	);
	c.graveyard.start -= 7 * 60 * 1000;
	c.graveyard_tick();
	assert.equal(spawned.length, 12 + 19 + 26);
	for (const m of [...spawned]) {
		m.points = { Witchling: 10, Ally: 5 };
		c.graveyard_fallen(m); // issue_monster_award, before the monster is removed
		delete instance.monsters[m.id];
	}
	c.graveyard_tick();
	const gargoyle = c.graveyard.gargoyle;
	assert.equal(gargoyle.type, "gargoyle");
	assert.deepEqual(plain(gargoyle.points), { Witchling: 570, Ally: 285 });
	assert.equal(c.E.graveyard.gargoyle, true);
	c.graveyard_fallen(gargoyle);
	delete instance.monsters[gargoyle.id];
	c.graveyard_tick();
	assert.equal(c.events.graveyard, false);
	assert(c.sent.some(([, data]) => data.phrase == "server.graveyard.defeated"));
});

function graveyard_context(extra = {}) {
	const spawned = [];
	const instance = { players: {}, monsters: {} };
	const c = context({
		instances: { spookytown: instance },
		instance_emit() {},
		ssince: () => 0,
		remove_monster: (m) => delete instance.monsters[m.id],
		new_monster(map, def) {
			const m = {
				id: String(spawned.length + 1),
				type: def.type,
				map,
				x: def.boundary[0],
				y: def.boundary[1],
				hp: 100,
				max_hp: 100,
				s: {},
				last: { attacked: new Date() },
				cid: 1,
			};
			instance.monsters[m.id] = m;
			spawned.push(m);
			return m;
		},
		...extra,
	});
	return { c, spawned, instance };
}

test("waves that fall after the Gargoyle wakes still count, and an ending round takes its monsters", () => {
	const { c, spawned, instance } = graveyard_context();
	c.graveyard_start({ id: "rising" });
	c.graveyard.start -= (design.events.graveyard.duration - 30) * 1000;
	c.graveyard_tick();
	const gargoyle = c.graveyard.gargoyle;
	assert(gargoyle, "the Gargoyle wakes near the end even with waves standing");
	const straggler = spawned[0];
	straggler.points = { Witchling: 7 };
	c.graveyard_fallen(straggler);
	delete instance.monsters[straggler.id];
	assert.equal(gargoyle.points.Witchling, 7, "counted at once, before the next tick");
	c.graveyard_fallen(straggler);
	assert.equal(gargoyle.points.Witchling, 7, "counted once");
	// A stuck Zombie is recreated as a new object with the same id; another is between its removal
	// and its return (half a second).
	const stuck = spawned[1];
	instance.monsters[stuck.id] = Object.assign({}, stuck);
	const returning = spawned[2];
	delete instance.monsters[returning.id];
	assert(Object.keys(instance.monsters).length > 1);
	c.graveyard_finish("over");
	assert.equal(c.events.graveyard, false);
	instance.monsters[returning.id] = Object.assign({}, returning);
	c.run_later();
	assert.deepEqual(Object.keys(instance.monsters), [], "nothing from the round stays behind");
});

test("a recreated Gargoyle is still the Gargoyle", () => {
	const { c, spawned, instance } = graveyard_context();
	c.graveyard_start({ id: "rising" });
	c.graveyard.start -= (design.events.graveyard.duration - 30) * 1000;
	c.graveyard_tick();
	const gargoyle = c.graveyard.gargoyle;
	const again = Object.assign({}, gargoyle, { hp: 50 });
	instance.monsters[gargoyle.id] = again;
	c.graveyard_tick();
	assert.equal(c.events.graveyard, true, "not defeated");
	assert.equal(c.E.graveyard.hp, 50);
	c.graveyard_fallen(again);
	c.graveyard_tick();
	assert(c.sent.some(([, data]) => data.phrase == "server.graveyard.defeated"));
	assert.equal(spawned.includes(again), false);
});

test("the end of Halloween ends its encounters", () => {
	const halloween = { players: {}, monsters: {} };
	const { c, instance } = graveyard_context({
		E: { horseman: { live: true }, mrpumpkin: { live: true } },
		events: { halloween: false, horseman: true },
		timers: { horseman: 1, mrpumpkin: 2, crabxx: 3 },
	});
	c.instances.halloween = halloween;
	c.remove_monster = (m) => {
		delete halloween.monsters[m.id];
		delete instance.monsters[m.id];
	};
	for (const [id, type] of Object.entries({ h: "horseman", j: "jackowalker", p: "mrpumpkin", g: "greenjr" }))
		halloween.monsters[id] = { id, type };
	c.graveyard_start({ id: "rising" });
	c.halloween_season_end();
	halloween.monsters.h2 = { id: "h2", type: "horseman" }; // recreated half a second after its removal
	c.run_later();
	assert.deepEqual(Object.keys(halloween.monsters), ["g"]);
	assert.deepEqual(Object.keys(instance.monsters), []);
	assert.equal(c.graveyard, null);
	assert.equal(c.events.horseman, false);
	assert.equal("horseman" in c.E, false);
	assert.equal("mrpumpkin" in c.E, false);
	assert.deepEqual(Object.keys(c.timers), ["crabxx"]);
});

test("Halloween ends at its end time on a running server", () => {
	const rules = vm.createContext({});
	vm.runInContext(read("design/event_flags.js") + "\n" + read("design/events.js"), rules);
	const now = Date.parse(rules.event_ends.halloween);
	assert.equal(rules.get_event_flags("normal", now - 1).halloween, rules.event_flags.halloween);
	assert.equal(rules.get_event_flags("normal", now).halloween, false, "anything started after the end loads it off");
	const data = plain({ maps: design.maps, monsters: design.monsters, drops: { maps: { global: [] } } });
	rules.apply_event_flags(data, { halloween: true });
	assert.equal(data.monsters.jr.respawn, 480);
	assert(data.drops.maps.global.some((row) => row[1] == "candy1"));
	const sent = [];
	const c = vm.createContext({
		events: { halloween: true },
		event_ends: rules.event_ends,
		G: { event_flags: data.event_flags, monsters: data.monsters },
		D: { drops: data.drops },
		season_controls: { restore: data.event_restore, end: rules.end_event_flag },
		broadcast: (name, packet) => sent.push([name, packet]),
		broadcast_e() {},
		server_log() {},
		ended: 0,
		halloween_season_end: () => c.ended++,
	});
	localize(c);
	vm.runInContext(extract(read("node/server_functions.js"), "season_end_logic"), c);
	c.season_end_logic(now - 1);
	assert.equal(c.events.halloween, true);
	c.season_end_logic(now);
	assert.equal(c.events.halloween, false);
	assert.equal(c.ended, 1, "the Horseman, the Graveyard and the seasonal bosses leave");
	assert.equal(c.G.event_flags.halloween, false);
	assert.equal(data.monsters.jr.respawn, design.monsters.jr.respawn);
	assert.equal(data.drops.maps.global.length, 0, "candy stops dropping");
	assert.deepEqual(
		sent.map(([name, packet]) => [name, packet.phrase]),
		[["server_message", "server.server_message.season_ended.halloween"]],
	);
	c.season_end_logic(now + 1000);
	assert.equal(sent.length, 1, "it ends once");
});
