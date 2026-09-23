const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { read, load, socketHandler } = require("./helpers/server_vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
	const failures = [],
		successes = [],
		history = [];
	const make = (id) => ({
		id,
		name: id,
		owner: "US_" + id,
		type: "warrior",
		level: 1,
		map: "main",
		in: "main",
		x: 0,
		y: 0,
		items: Array(42).fill(null),
		citems: [],
		isize: 42,
		esize: 42,
		gold: 1000000,
		tax: 0.03,
		pdps: 1,
		slots: {},
		cslots: {},
		s: {},
		p: { trades: true, minutes: 0 },
		socket: { emit() {} },
	});
	const seller = make("Seller"),
		buyer = make("Buyer");
	const c = vm.createContext({
		...G,
		G,
		players: { Seller: seller, Buyer: buyer },
		socket: { id: "Seller", emit() {} },
		id_to_id: { Seller: "Seller", Buyer: "Buyer" },
		trade_slots: ["trade1", "trade2", "trade4"],
		B: { dist: 500 },
		S: { gold: 0 },
		a_score: {},
		min: Math.min,
		max: Math.max,
		round: Math.round,
		to_number: Number,
		randomStr: () => "listing",
		item_name: (item) => G.items[item.name].name,
		is_invis: () => false,
		resend() {},
		xy_emit() {},
		add_to_trade_history: (...args) => history.push(plain(args.slice(1))),
		success_response: (...args) => successes.push(args),
		fail_response: (reason) => failures.push(reason),
	});
	const source = read("node/server_functions.js");
	for (const name of ["item_p_ignore", "item_trade_p_ignore"]) {
		vm.runInContext(source.match(new RegExp("var " + name + " = \\{[\\s\\S]*?\\};"))[0], c);
	}
	load(c, "node/server_functions.js", ["cache_item", "get_trade_slots", "add_item_property"]);
	load(c, "node/server.js", ["create_new_item", "create_new_sitem", "consume", "add_item"]);
	load(c, "js/old_common_functions.js", ["can_stack", "can_add_item"]);
	function put(player, item, full = false) {
		player.items = Array.from({ length: 42 }, () => (full ? { name: "blade", level: 0 } : null));
		player.items[0] = plain(item);
		player.esize = full ? 0 : 41;
	}
	function run(event, id, data) {
		c.socket.id = id;
		return socketHandler(c, event)(plain(data));
	}
	function snapshot() {
		return plain({
			seller: [seller.items, seller.slots, seller.gold, seller.esize],
			buyer: [buyer.items, buyer.slots, buyer.gold, buyer.esize],
			tax: c.S.gold,
			history,
		});
	}
	return { c, seller, buyer, put, run, snapshot, failures, successes, history };
}

const glitched = { name: "cake", q: 3, p: "glitched", ps: ["glitched"] };
const variants = [
	glitched,
	{ name: "cake", q: 3 },
	{ name: "cxjar", q: 3, data: "hat001", p: "shiny", ps: ["shiny"] },
	{ name: "blade", level: 7, p: "glitched", ps: ["glitched"], stat_type: "str" },
];
const quantity = (items, name) => items.reduce((sum, item) => sum + (item?.name === name ? item.q || 1 : 0), 0);

test("listing, withdrawal and repeated purchases conserve ordinary and titled items", () => {
	for (const original of variants)
		for (const amount of new Set([1, original.q || 1])) {
			const h = fixture();
			h.put(h.seller, original);
			h.run("equip", "Seller", { num: 0, slot: "trade1", q: amount, price: 100 });
			const listed = h.seller.slots.trade1;
			assert.equal(listed.p, original.p);
			assert.deepEqual(plain(listed.ps || []), original.ps || []);
			assert.equal(listed.data, original.data);
			if (original.ps && amount < original.q) {
				assert.notEqual(listed.ps, h.seller.items[0].ps, "split title histories are independent arrays");
			}
			h.run("unequip", "Seller", { slot: "trade1" });
			assert.equal(quantity(h.seller.items, original.name), original.q || 1);
			assert.equal(h.seller.items[0].p, original.p);
			h.run("equip", "Seller", { num: 0, slot: "trade1", q: amount, price: 100 });
			const request = { id: "Seller", slot: "trade1", q: 1, rid: "listing" };
			for (let i = 0; i < amount; i++) h.run("trade_buy", "Buyer", request);
			assert.deepEqual(h.failures, []);
			assert.equal(quantity(h.buyer.items, original.name), amount);
			assert.equal(quantity(h.seller.items, original.name), (original.q || 1) - amount);
			assert.equal(h.buyer.items[0].p, original.p);
			assert.deepEqual(plain(h.buyer.items[0].ps || []), original.ps || []);
			assert.equal(h.buyer.items[0].data, original.data);
			if (original.level !== undefined) assert.equal(h.buyer.items[0].level, original.level);
			assert.equal(h.buyer.gold, 1000000 - amount * 100);
			assert.equal(h.seller.gold, 1000000 + amount * 97);
			assert.equal(h.c.S.gold, amount * 3);
			const before = h.snapshot();
			h.run("trade_buy", "Buyer", request);
			assert.deepEqual(h.failures, ["item_gone"]);
			assert.deepEqual(h.snapshot(), before, "a replay after exhaustion cannot transfer anything");
		}
});

test("buy orders transfer the actual source item's properties and exact quantity", () => {
	for (const original of variants)
		for (const amount of new Set([1, original.q || 1])) {
			const h = fixture();
			h.put(h.seller, original);
			h.buyer.slots.trade1 = {
				name: original.name,
				level: original.level,
				q: amount,
				b: true,
				price: 100,
				rid: "order",
			};
			const request = { id: "Buyer", slot: "trade1", q: amount, rid: "order" };
			h.run("trade_sell", "Seller", request);
			assert.deepEqual(h.failures, []);
			assert.equal(quantity(h.buyer.items, original.name), amount);
			assert.equal(quantity(h.seller.items, original.name), (original.q || 1) - amount);
			for (const key of ["p", "data", "level", "stat_type"]) assert.equal(h.buyer.items[0][key], original[key]);
			assert.deepEqual(plain(h.buyer.items[0].ps || []), original.ps || []);
			assert.equal(h.buyer.gold, 1000000 - amount * 100);
			assert.equal(h.seller.gold, 1000000 + amount * 97);
			assert.equal(h.c.S.gold, amount * 3);
			assert.equal(h.seller.gold + h.buyer.gold + h.c.S.gold, 2000000);
			const before = h.snapshot();
			h.run("trade_sell", "Seller", request);
			assert.deepEqual(h.failures, ["item_gone"]);
			assert.deepEqual(h.snapshot(), before);
		}
});

test("capacity checks distinguish properties, cosmetic payloads and stack limits before any mutation", () => {
	for (const event of ["trade_buy", "trade_sell"]) {
		for (const [source, existing, accepted] of [
			[glitched, { name: "cake", q: 1 }, false],
			[glitched, { ...glitched, q: 1 }, true],
			[glitched, { ...glitched, q: 9999 }, false],
			[{ name: "cake", q: 3 }, { name: "cake", q: 1 }, true],
			[{ name: "cxjar", q: 3, data: "hat001" }, { name: "cxjar", q: 1, data: "hat002" }, false],
			[{ name: "cxjar", q: 3, data: "hat001" }, { name: "cxjar", q: 1, data: "hat001" }, true],
		]) {
			const h = fixture();
			h.put(h.seller, source);
			h.put(h.buyer, existing, true);
			if (event === "trade_buy") h.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, price: 100 });
			else h.buyer.slots.trade1 = { name: source.name, q: 1, b: true, price: 100, rid: "listing" };
			const before = h.snapshot();
			h.run(event, event === "trade_buy" ? "Buyer" : "Seller", {
				id: event === "trade_buy" ? "Seller" : "Buyer",
				slot: "trade1",
				q: 1,
				rid: "listing",
			});
			assert.equal(h.buyer.items.length, 42);
			assert.equal(h.buyer.esize, 0);
			if (accepted) {
				assert.deepEqual(h.failures, []);
				assert.equal(h.buyer.items[0].q, existing.q + 1);
				assert.equal(h.buyer.gold, 999900);
			} else {
				assert.deepEqual(h.failures, [event === "trade_buy" ? "no_space" : "trade_bspace"]);
				assert.deepEqual(h.snapshot(), before, "rejection preserves items, gold, orders and history");
			}
		}
	}
});

test("stale, oversized, unfunded and unauthorized trades leave all balances untouched", () => {
	for (const event of ["trade_buy", "trade_sell"])
		for (const invalid of ["rid", "q", "gold", "distance", "bank", "blocked"]) {
			const h = fixture();
			h.put(h.seller, glitched);
			if (event === "trade_buy") h.run("equip", "Seller", { num: 0, slot: "trade1", q: 3, price: 100 });
			else h.buyer.slots.trade1 = { name: "cake", q: 3, b: true, price: 100, rid: "listing" };
			const request = { id: event === "trade_buy" ? "Seller" : "Buyer", slot: "trade1", q: 1, rid: "listing" };
			if (invalid === "rid") request.rid = "old";
			if (invalid === "q") request.q = 4;
			if (invalid === "gold") h.buyer.gold = 0;
			if (invalid === "distance") h.buyer.x = 1000;
			if (invalid === "bank") (event === "trade_buy" ? h.buyer : h.seller).user = {};
			if (invalid === "blocked") (event === "trade_buy" ? h.seller.slots.trade1 : h.seller.items[0]).b = true;
			const before = h.snapshot();
			h.run(event, event === "trade_buy" ? "Buyer" : "Seller", request);
			assert.equal(h.failures.length, 1, event + ": " + invalid);
			assert.deepEqual(h.snapshot(), before);
		}
});

test("stack copies retain title history without copying sale or giveaway state", () => {
	const h = fixture();
	const source = {
		...glitched,
		ps: ["shiny", "glitched"],
		price: 100,
		rid: "old",
		list: ["Buyer"],
		giveaway: 5,
		b: true,
	};
	const copied = h.c.create_new_sitem(source, 1);
	assert.deepEqual(plain(copied), { ...glitched, q: 1, ps: ["shiny", "glitched"] });
	copied.ps.push("lucky");
	assert.deepEqual(source.ps, ["shiny", "glitched"]);
});

test("a titled giveaway keeps its properties through listing and one mail delivery", async () => {
	const h = fixture(),
		mails = [];
	h.put(h.seller, glitched);
	h.run("equip", "Seller", { num: 0, slot: "trade1", q: 2, giveaway: true, minutes: 5 });
	assert.deepEqual(h.failures, []);
	assert.equal(h.seller.slots.trade1.p, "glitched");
	assert.equal(h.seller.items[0].q, 1);
	h.seller.slots.trade1.giveaway = 1;
	h.seller.slots.trade1.list = ["Buyer"];
	let tick;
	Object.assign(h.c, {
		mode: { prevent_external: false },
		setInterval: (callback) => (tick = callback),
		get_player: (name) => h.c.players[name],
		random_one: (list) => list[0],
		db: { collection: () => ({ findOne: async () => ({ owner: h.buyer.owner }) }) },
		get: async (id) => ({ _id: id }),
		get_id: (user) => user._id,
		insert: async (mail) => mails.push(plain(mail)),
		update_mail_count: async () => {},
		log_trace: (...args) => {
			throw Error(JSON.stringify(args));
		},
		console,
	});
	const source = read("node/server.js"),
		end = source.indexOf('log_trace("#X decay loop error", e);');
	const start = source.lastIndexOf("setInterval(function () {", end);
	vm.runInContext(source.slice(start, source.indexOf("}, 60000);", end) + "}, 60000);".length), h.c);
	tick();
	await new Promise(setImmediate);
	assert.equal(mails.length, 1);
	const item = JSON.parse(mails[0].info.item);
	assert.equal(item.p, "glitched");
	assert.deepEqual(item.ps, ["glitched"]);
	assert.equal(item.q, 2);
	assert.equal(h.seller.slots.trade1, null);
	tick();
	await new Promise(setImmediate);
	assert.equal(mails.length, 1);
});
