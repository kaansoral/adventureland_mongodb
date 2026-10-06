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
		xp: 0,
		tax: 0.03,
		pdps: 1,
		slots: {},
		cslots: {},
		s: {},
		p: { trades: true, minutes: 0, dt: {} },
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
		Dev: false,
		get_ip_server: (player) => player.ip || player.name,
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
	load(c, "node/server_functions.js", [
		"cache_item",
		"seen_item_matches",
		"get_trade_slots",
		"add_item_property",
		"is_same",
		"trade_swap_xp",
		"trade_price",
	]);
	load(c, "node/server.js", ["create_new_item", "create_new_sitem", "consume", "add_item"]);
	load(c, "js/old_common_functions.js", [
		"can_stack",
		"can_add_item",
		"trade_want_normalize",
		"trade_want_matches",
		"trade_lot_name",
	]);
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
			seller: [seller.items, seller.slots, seller.gold, seller.esize, seller.xp, seller.p],
			buyer: [buyer.items, buyer.slots, buyer.gold, buyer.esize, buyer.xp, buyer.p],
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

test("sale and wishlist prices reject malformed or out-of-range values without moving items or gold", () => {
	for (const price of [
		undefined,
		null,
		false,
		[],
		[100],
		{},
		"",
		" ",
		"<img src=x>100000",
		"100000<img src=x>",
		"100gold",
		"1e6",
		"0x100",
		"1,000",
		"1.5",
		-1,
		0,
		1.5,
		100000000000,
	]) {
		for (const event of ["equip", "trade_wishlist"]) {
			const h = fixture();
			h.put(h.seller, { name: "wand", level: 7 });
			const before = h.snapshot();
			h.run(event, "Seller", { num: 0, slot: "trade1", name: "staff", price, q: 1 });
			assert.deepEqual(h.failures, ["invalid"], event + " " + JSON.stringify(price));
			assert.deepEqual(h.snapshot(), before);
		}
	}
});

test("sale and wishlist prices preserve whole gold amounts including the maximum", () => {
	for (const price of [1, 100000, 99999999999, "100000", " 100000 "]) {
		for (const event of ["equip", "trade_wishlist"]) {
			const h = fixture();
			h.put(h.seller, { name: "wand", level: 7 });
			h.run(event, "Seller", { num: 0, slot: "trade1", name: "staff", price, q: 1 });
			assert.deepEqual(h.failures, []);
			assert.equal(h.seller.slots.trade1.price, Number(price));
		}
	}
});

test("giveaways still list without a sale price", () => {
	const h = fixture();
	h.put(h.seller, { name: "cake", q: 3 });
	h.run("equip", "Seller", { num: 0, slot: "trade1", q: 2, giveaway: true, minutes: 5 });
	assert.deepEqual(h.failures, []);
	assert.equal(h.seller.slots.trade1.giveaway, 5);
	assert.equal(h.seller.slots.trade1.q, 2);
	assert.equal(h.seller.items[0].q, 1);
});

test("sale and giveaway requests cannot consume an item after the stand closes", () => {
	for (const request of [{ price: 100 }, { price: "<img src=x>100" }, { giveaway: true }]) {
		const h = fixture();
		h.seller.p.trades = false;
		h.put(h.seller, { name: "elixirstr0", q: 1 });
		const before = h.snapshot();
		h.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, ...request });
		assert.deepEqual(h.failures, ["invalid"]);
		assert.deepEqual(h.snapshot(), before);
	}
});

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

const staff = (level, extra) => ({ name: "staff", level, ...extra });
function offer(h, item, want, q = 1) {
	h.put(h.seller, item);
	h.run("equip", "Seller", { num: 0, slot: "trade1", q, want });
	return h.seller.slots.trade1;
}
function carry(player, items, full = false) {
	player.items = Array.from({ length: 42 }, (v, i) =>
		i < items.length ? plain(items[i]) : full ? { name: "blade", level: i } : null,
	);
	player.esize = player.items.filter((item) => !item).length;
}
// the buyer's client holds cache_item copies of its items and sends the chosen one
const seen = (h, num) => (h.buyer.items[num] ? plain(h.c.cache_item(h.buyer.items[num])) : null);
const swap = (h, num, change = {}) =>
	h.run("trade_swap", "Buyer", { id: "Seller", slot: "trade1", rid: "listing", num, item: seen(h, num), ...change });

test("a trade offer lists through equip and swaps the buyer's chosen item for the whole offer", () => {
	const h = fixture();
	const listing = offer(h, { name: "wand", level: 7, price: 50, rid: "old" }, { name: "staff", level: 8 });
	assert.deepEqual(plain(listing.want), { name: "staff", level: 8 });
	assert.equal(listing.price, undefined, "a withdrawn sale's price does not come back");
	carry(h.buyer, [staff(8, { p: "shiny", ps: ["shiny"] }), staff(8, { stat_type: "int" }), staff(3)]);
	swap(h, 1);
	assert.deepEqual(h.failures, []);
	assert.equal(h.seller.slots.trade1, null);
	assert.equal(h.buyer.items[1].name, "wand");
	assert.equal(h.buyer.items[1].want, undefined);
	assert.equal(h.buyer.items[0].p, "shiny", "the other +8 stays with the buyer");
	const received = h.seller.items.find(Boolean);
	assert.deepEqual([received.name, received.level, received.stat_type, received.p], ["staff", 8, "int", undefined]);
	assert.deepEqual(
		h.history.map((entry) => [entry[0], entry[1], entry[2].name, entry[3], entry[4].name]),
		[
			["swap", "Seller", "staff", 0, "wand"],
			["swap", "Buyer", "wand", 0, "staff"],
		],
	);
	assert.equal(h.buyer.gold + h.seller.gold + h.c.S.gold, 2000000, "no gold and no tax move");
	const before = h.snapshot();
	swap(h, 0);
	assert.deepEqual(h.failures, ["item_gone"]);
	assert.deepEqual(h.snapshot(), before, "one offer completes once");
});

test("trade offer requests keep name, minimum level, title and stack quantity; unset level or title accepts any", () => {
	for (const [want, expected, accepted, rejected] of [
		["staff", { name: "staff" }, staff(10, { p: "glitched" }), { name: "firestaff", level: 8 }],
		[{ name: "staff", level: "any", price: 1, b: true }, { name: "staff" }, staff(0), null],
		[{ name: "staff", level: 0 }, { name: "staff" }, staff(1), null],
		[{ name: "staff", level: 8 }, { name: "staff", level: 8 }, staff(10), staff(7)],
		[{ name: "staff", level: 8 }, { name: "staff", level: 8 }, staff(8, { p: "shiny" }), staff(0)],
		[{ name: "staff", level: 99 }, { name: "staff", level: 12 }, staff(12), staff(11)],
		[
			{ name: "intring", level: 2 },
			{ name: "intring", level: 2 },
			{ name: "intring", level: 3 },
			{ name: "intring", level: 1 },
		],
		[{ name: "staff", p: "shiny" }, { name: "staff", p: "shiny" }, staff(5, { p: "shiny" }), staff(5)],
		[
			{ name: "staff", p: "shiny" },
			{ name: "staff", p: "shiny" },
			staff(9, { p: "shiny" }),
			staff(9, { p: "glitched" }),
		],
		[
			{ name: "cake", q: 3, level: 2 },
			{ name: "cake", q: 3 },
			{ name: "cake", q: 4 },
			{ name: "cake", q: 2 },
		],
	]) {
		const h = fixture();
		assert.deepEqual(plain(offer(h, { name: "wand", level: 7 }, want).want), expected);
		assert.equal(h.c.trade_want_matches(expected, accepted), true, JSON.stringify([want, accepted]));
		if (rejected) assert.equal(h.c.trade_want_matches(expected, rejected), false, JSON.stringify([want, rejected]));
	}
	for (const want of [
		"nothing",
		{ name: "placeholder" },
		{ name: "staff", p: "unknown" },
		{ name: "constructor" },
		{ name: "__proto__" },
		{ name: "staff", p: "constructor" },
		{ name: "staff", p: 5 },
		{ level: 8 },
		null,
		5,
	]) {
		const h = fixture();
		h.put(h.seller, { name: "wand", level: 7 });
		const before = h.snapshot();
		h.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, want });
		assert.deepEqual(h.failures, ["trade_offer_invalid"], JSON.stringify(want));
		assert.deepEqual(h.snapshot(), before);
	}
});

test("stacks give exactly the requested quantity from one stack and receive the whole offered lot", () => {
	const h = fixture();
	offer(h, { name: "cake", q: 30 }, { name: "staff" }, 20);
	assert.equal(h.seller.items[0].q, 10);
	carry(h.buyer, [{ name: "cake", q: 1 }, staff(2)]);
	swap(h, 1);
	assert.deepEqual(h.failures, []);
	assert.equal(h.buyer.items[0].q, 21);

	const g = fixture();
	offer(g, { name: "wand", level: 7 }, { name: "cake", q: 3 });
	carry(g.buyer, [{ name: "cake", q: 5 }]);
	swap(g, 0);
	assert.deepEqual(g.failures, []);
	assert.equal(g.buyer.items[0].q, 2);
	assert.equal(g.seller.items.find(Boolean).q, 3);
});

test("trade offers refuse gold, stale or changed requests and full inventories without changing anything", () => {
	const cases = [
		["trade_buy", { id: "Seller", slot: "trade1", rid: "listing", q: 1 }, "sneaky", () => {}],
		["trade_sell", { id: "Seller", slot: "trade1", rid: "listing", q: 1 }, "sneaky", () => {}],
		["trade_sell", { id: "Seller", slot: "trade1", rid: "listing", q: 1 }, "sneaky", (h) => (h.c.B.rbugs = 1)],
		["trade_swap", { rid: "old" }, "item_gone", () => {}],
		["trade_swap", { rid: undefined }, "item_gone", () => {}],
		["trade_swap", {}, "item_gone", (h) => (h.seller.p.trades = false)],
		["trade_swap", { chosen: { level: 3 } }, "trade_swap_match", () => {}],
		["trade_swap", { chosen: { p: "shiny" } }, "trade_swap_match", () => {}],
		["trade_swap", { chosen: { stat_type: "int" } }, "trade_swap_match", () => {}],
		["trade_swap", { chosen: { expires: "2026-09-27T00:00:00.000Z" } }, "trade_swap_match", () => {}],
		["trade_swap", { item: undefined }, "trade_swap_match", () => {}],
		["trade_swap", { item: "8" }, "trade_swap_match", () => {}],
		["trade_swap", { item: [] }, "trade_swap_match", () => {}],
		["trade_swap", {}, "trade_swap_match", (h) => (h.buyer.items[0].stat_type = "int")],
		["trade_swap", {}, "trade_swap_match", (h) => (h.buyer.items[0].level = 7)],
		["trade_swap", {}, "trade_swap_match", (h) => (h.buyer.items[0] = staff(8, { p: "shiny", ps: ["shiny"] }))],
		["trade_swap", {}, "item_locked", (h) => (h.buyer.items[0].l = "l")],
		["trade_swap", {}, "item_locked", (h) => (h.buyer.items[0].acl = 1)],
		["trade_swap", {}, "item_locked", (h) => ((h.buyer.items[0].acl = 1), (h.buyer.owner = h.seller.owner))],
		["trade_swap", {}, "item_blocked", (h) => (h.buyer.items[0].v = new Date())],
		["trade_swap", {}, "distance", (h) => (h.buyer.x = 1000)],
		["trade_swap", {}, "trade_swap_space", (h) => carry(h.seller, [], true)],
		["trade_swap", {}, "sneaky", (h) => ((h.seller.slots.trade1.b = true), (h.seller.slots.trade1.price = 100))],
	];
	for (const [event, request, reason, prepare] of cases) {
		const h = fixture();
		offer(h, { name: "wand", level: 7 }, { name: "staff", level: 8 });
		carry(h.buyer, [staff(8), { name: "wand", level: 7 }]);
		// what the buyer chose, before the change the case makes
		const chosen = seen(h, 0);
		prepare(h);
		const before = h.snapshot();
		if (event == "trade_swap" && request.chosen) swap(h, 0, { item: { ...chosen, ...request.chosen } });
		else if (event == "trade_swap") swap(h, 0, { item: chosen, ...request });
		else h.run(event, "Buyer", request);
		assert.deepEqual(h.failures, [reason], event + " " + reason);
		assert.deepEqual(h.snapshot(), before, event + " " + reason);
	}
	const h = fixture();
	offer(h, { name: "wand", level: 7 }, { name: "cake", q: 3 });
	carry(h.buyer, [{ name: "cake", q: 5 }], true);
	const before = h.snapshot();
	swap(h, 0);
	assert.deepEqual(h.failures, ["no_space"], "part of a stack frees no slot for the offered item");
	assert.deepEqual(h.snapshot(), before);
});

test("a full stack pays for more of the same item when the payment leaves room in it", () => {
	const h = fixture();
	const most = G.items.cake.s === true ? 9999 : G.items.cake.s;
	offer(h, { name: "cake", q: 10 }, { name: "cake", q: 20 }, 10);
	carry(h.buyer, [{ name: "cake", q: most }], true);
	swap(h, 0);
	assert.deepEqual(h.failures, []);
	assert.equal(h.buyer.items[0].q, most - 20 + 10);
	assert.equal(quantity(h.seller.items, "cake"), 20);
});

test("an offer for a trade slot that isn't open fails without using the item", () => {
	const h = fixture();
	h.seller.p.trades = false;
	h.put(h.seller, { name: "elixirstr0", q: 1 });
	const before = h.snapshot();
	h.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, want: "staff" });
	h.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, want: "staff", consume: true });
	assert.deepEqual(h.failures, ["invalid", "invalid"]);
	assert.deepEqual(h.snapshot(), before);
});

test("merchants below level 70 gain the XP a sale at the smaller lot's value would give, per partner account", () => {
	const value = Math.min(G.calculate_item_value({ name: "wand", level: 7 }), G.calculate_item_value(staff(9)));
	const h = fixture();
	Object.assign(h.seller, { type: "merchant", level: 40, tax: 0.04 });
	Object.assign(h.buyer, { type: "merchant", level: 69, tax: 0.025 });
	offer(h, { name: "wand", level: 7 }, { name: "staff", level: 8 });
	carry(h.buyer, [staff(9)]);
	swap(h, 0);
	assert.deepEqual(h.failures, []);
	assert.equal(h.seller.xp, Math.round(value * 0.04 * 3.2));
	assert.equal(h.buyer.xp, Math.round(value * 0.025 * 3.2));
	assert.equal(h.seller.p.swapxp.US_Buyer, h.seller.xp);
	assert.equal(
		Object.prototype.toString.call(h.seller.p.dt.swapxp),
		"[object Date]",
		"the window start is revived like other p.dt dates",
	);
	assert.equal(h.seller.gold + h.buyer.gold, 2000000, "the XP costs no gold and makes none");

	for (const [who, change] of [
		["level 70 and up", (g) => Object.assign(g.seller, { level: 70 })],
		["other classes", (g) => Object.assign(g.seller, { type: "warrior" })],
		["same account", (g) => (g.buyer.owner = g.seller.owner)],
		["same address", (g) => (g.buyer.ip = g.seller.ip = "10.0.0.1")],
	]) {
		const g = fixture();
		Object.assign(g.seller, { type: "merchant", level: 40, tax: 0.04 });
		change(g);
		offer(g, { name: "wand", level: 7 }, "staff");
		carry(g.buyer, [staff(9)]);
		swap(g, 0);
		assert.deepEqual(g.failures, [], who);
		assert.equal(g.seller.xp, 0, who);
	}
});

test("trade offer XP from one partner account stops at one level's worth for five days", () => {
	const h = fixture();
	Object.assign(h.seller, { type: "merchant", level: 20, tax: 0.05 });
	const cap = G.levels[20];
	for (let round = 0; round < 3; round++) {
		offer(h, { name: "wand", level: 7 }, "staff");
		carry(h.buyer, [staff(9)]);
		swap(h, 0);
		assert.deepEqual(h.failures, []);
	}
	assert.equal(h.seller.xp, cap, "three valuable swaps with one partner give one level's worth");
	h.buyer.owner = "US_Another";
	offer(h, { name: "wand", level: 7 }, "staff");
	carry(h.buyer, [staff(9)]);
	swap(h, 0);
	assert.equal(h.seller.xp, 2 * cap, "another account can add its own share");
	h.seller.p.dt.swapxp = new Date(Date.now() - 121 * 3600 * 1000);
	h.buyer.owner = "US_Buyer";
	offer(h, { name: "wand", level: 7 }, "staff");
	carry(h.buyer, [staff(9)]);
	swap(h, 0);
	assert.equal(h.seller.xp, 3 * cap, "the window reopens after five days");
	assert.deepEqual(Object.keys(h.seller.p.swapxp), ["US_Buyer"]);

	const g = fixture();
	Object.assign(g.seller, { type: "merchant", level: 20, tax: 0.05 });
	g.seller.p.dt.swapxp = new Date();
	g.seller.p.swapxp = Object.fromEntries(Array.from({ length: 120 }, (v, i) => ["US_" + i, 1]));
	offer(g, { name: "wand", level: 7 }, "staff");
	carry(g.buyer, [staff(9)]);
	swap(g, 0);
	assert.deepEqual(g.failures, []);
	assert.equal(g.seller.xp, 0, "a 121st partner in one window adds nothing");
	assert.equal(Object.keys(g.seller.p.swapxp).length, 120);
});

test("items with little value, gifts and expiring boosters give little or no trade offer XP", () => {
	for (const [item, want, given] of [
		[{ name: "wand", level: 7 }, "staff", staff(0)],
		[{ name: "wand", level: 7, gift: 1 }, "staff", staff(9)],
		[{ name: "wand", level: 7 }, "cake", { name: "cake", q: 1 }],
	]) {
		const h = fixture();
		Object.assign(h.seller, { type: "merchant", level: 40, tax: 0.04 });
		offer(h, item, want);
		carry(h.buyer, [given]);
		swap(h, 0);
		assert.deepEqual(h.failures, []);
		const value = Math.min(G.calculate_item_value(item), G.calculate_item_value(given) * (given.q || 1));
		assert.equal(h.seller.xp, Math.round(value * 0.04 * 3.2), JSON.stringify(item));
	}
});

test("a trade offer refuses a jar whose cosmetic differs from the one the buyer chose", () => {
	const h = fixture();
	offer(h, { name: "wand", level: 7 }, { name: "cxjar" });
	carry(h.buyer, [{ name: "cxjar", q: 1, data: "hat001" }]);
	const before = h.snapshot();
	swap(h, 0, { item: { level: 0, data: "hat002" } });
	assert.deepEqual(h.failures, ["trade_swap_match"]);
	assert.deepEqual(h.snapshot(), before);
	swap(h, 0);
	assert.deepEqual(h.failures, ["trade_swap_match"]);
	assert.equal(h.seller.items.find((item) => item && item.name == "cxjar").data, "hat001");
});

test("a withdrawn sale relisted as a trade offer can't be bought, and a withdrawn offer relisted for gold can't be swapped", () => {
	const h = fixture();
	h.put(h.seller, { name: "wand", level: 7 });
	h.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, price: 5000 });
	h.run("unequip", "Seller", { slot: "trade1" });
	assert.equal(h.seller.items.find(Boolean).price, 5000, "a withdrawn listing keeps its hidden price");
	h.run("equip", "Seller", { num: h.seller.items.findIndex(Boolean), slot: "trade1", q: 1, want: "staff" });
	assert.equal(h.seller.slots.trade1.price, undefined);
	carry(h.buyer, [staff(3)]);
	const before = h.snapshot();
	h.run("trade_buy", "Buyer", { id: "Seller", slot: "trade1", rid: "listing", q: 1 });
	h.run("trade_sell", "Buyer", { id: "Seller", slot: "trade1", rid: "listing", q: 1 });
	assert.deepEqual(h.failures, ["sneaky", "sneaky"]);
	assert.deepEqual(h.snapshot(), before, "no gold moves for the old price");
	swap(h, 0);
	assert.deepEqual(h.failures, ["sneaky", "sneaky"]);
	assert.equal(h.buyer.items.find(Boolean).name, "wand");

	const g = fixture();
	g.put(g.seller, { name: "wand", level: 7 });
	g.run("equip", "Seller", { num: 0, slot: "trade1", q: 1, want: "staff" });
	g.run("unequip", "Seller", { slot: "trade1" });
	g.run("equip", "Seller", { num: g.seller.items.findIndex(Boolean), slot: "trade1", q: 1, price: 5000 });
	assert.equal(g.seller.slots.trade1.want, undefined, "the old request does not come back");
	carry(g.buyer, [staff(3)]);
	const kept = g.snapshot();
	swap(g, 0);
	assert.deepEqual(g.failures, ["sneaky"]);
	assert.deepEqual(g.snapshot(), kept);
	g.run("trade_buy", "Buyer", { id: "Seller", slot: "trade1", rid: "listing", q: 1 });
	assert.deepEqual(g.failures, ["sneaky"]);
	const bought = g.buyer.items.find((item) => item && item.name == "wand");
	assert.ok(bought && bought.want === undefined);
	assert.equal(g.buyer.gold, 1000000 - 5000);
});
