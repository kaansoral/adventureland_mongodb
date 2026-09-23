const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const G = require("./helpers/design");
const { load, socketHandler } = require("./helpers/server_vm");

const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const end = source.indexOf('log_trace("#X decay loop error", e);');
const start = source.lastIndexOf("setInterval(function () {", end);
const giveawayLoop = source.slice(start, source.indexOf("}, 60000);", end) + "}, 60000);".length);
const plain = (value) => JSON.parse(JSON.stringify(value));

function player(name, slots = {}) {
	return { name, owner: "US_" + name, slots, cslots: {}, pdps: 1, p: { minutes: 0 }, esize: 10 };
}

function harness(preventExternal = false) {
	let tick;
	let mailId = 0;
	const mails = [],
		lookups = [],
		delivered = [],
		errors = [];
	const players = {
		first: player("First", {
			trade1: { name: "blade", level: 4, giveaway: 1, list: ["One", "Two"] },
			trade2: { name: "bow", level: 5, giveaway: 1, list: ["Two"] },
		}),
		second: player("Second", {
			trade1: { name: "staff", level: 6, giveaway: 1, list: ["Three"] },
		}),
		last: player("Unrelated"),
	};
	const recipients = Object.fromEntries(["One", "Two", "Three"].map((name) => [name, player(name)]));
	vm.runInNewContext(giveawayLoop, {
		players,
		trade_slots: ["trade1", "trade2"],
		mode: { prevent_external: preventExternal },
		setInterval: (callback) => (tick = callback),
		get_player: (name) => recipients[name],
		random_one: (list) => list[0],
		cache_item: plain,
		add_to_trade_history() {},
		xy_emit() {},
		resend() {},
		localization: { message() {}, normalize: () => "en" },
		phrase: (id, args) => JSON.stringify({ id, args }),
		G: { items: { blade: { name: "Blade" }, bow: { name: "Bow" }, staff: { name: "Staff" } } },
		db: {
			collection: () => ({
				findOne: ({ name }) =>
					new Promise((resolve) =>
						lookups.push(() => resolve({ owner: "US_" + name[0].toUpperCase() + name.slice(1) })),
					),
			}),
		},
		get: async (id) => ({ _id: id }),
		get_id: (user) => user._id,
		randomStr: () => String(++mailId),
		insert: async (mail) => mails.push(plain(mail)),
		update_mail_count: async () => {},
		add_item: (recipient, item) => delivered.push({ recipient: recipient.name, item: plain(item) }),
		log_trace: (...args) => errors.push(args),
		console: { log: (...args) => errors.push(args), error: (...args) => errors.push(args) },
	});
	return { tick: () => tick(), players, mails, lookups, delivered, errors };
}

test("overlapping giveaway mails retain each donor, winner and item after database waits", async () => {
	const h = harness();
	h.tick();
	assert.equal(h.lookups.length, 3);
	assert.equal(h.players.first.slots.trade1, null);
	assert.equal(h.players.first.slots.trade2, null);
	assert.equal(h.players.second.slots.trade1, null);
	// Complete lookups out of order, after the loop has visited another player.
	h.lookups.reverse().forEach((resolve) => resolve());
	await new Promise(setImmediate);
	assert.deepEqual(h.errors, []);
	assert.equal(h.mails.length, 3);
	for (const [name, level, donor, winner, participants] of [
		["blade", 4, "First", "One", "One, Two"],
		["bow", 5, "First", "Two", "Two"],
		["staff", 6, "Second", "Three", "Three"],
	]) {
		const mail = h.mails.find((mail) => JSON.parse(mail.info.item).name === name);
		assert.equal(mail.fro, donor);
		assert.equal(mail.to, winner);
		assert.deepEqual(mail.owner, ["US_" + donor, "US_" + winner]);
		assert.equal(mail.info.sender, "US_" + donor);
		assert.equal(mail.info.receiver, "US_" + winner);
		assert.deepEqual(JSON.parse(mail.info.message).args, { player: donor, participants });
		assert.deepEqual(JSON.parse(mail.info.item), { name, level, gf: donor, src: "gva" });
	}
	h.tick();
	await new Promise(setImmediate);
	assert.equal(h.mails.length, 3, "consumed giveaways cannot be delivered twice");
});

test("isolated servers still deliver giveaways directly without sending mail", () => {
	const h = harness(true);
	h.tick();
	assert.deepEqual(h.errors, []);
	assert.equal(h.mails.length, 0);
	assert.equal(h.lookups.length, 0);
	assert.deepEqual(
		h.delivered.map(({ recipient, item }) => [recipient, item.name, item.gf]),
		[
			["One", "blade", "First"],
			["Two", "bow", "First"],
			["Three", "staff", "Second"],
		],
	);
});

test("giveaway duration uses the same 5–600 minute bounds for cheap stacks and valuable gear", () => {
	for (const item of [
		{ name: "hpot0", q: 12 },
		{ name: "blade", level: 0 },
		{ name: "bataxe", level: 9 },
	]) {
		for (const [minutes, expected] of [
			[600, 600],
			[120, 120],
			[99999, 600],
			[1, 5],
			[undefined, 5],
			["bad", 5],
		]) {
			const p = player("Donor");
			Object.assign(p, { items: [plain(item)], citems: [], s: {}, esize: 0 });
			p.p.trades = true;
			const failures = [];
			const c = vm.createContext({
				...G,
				G,
				players: { donor: p },
				socket: { id: "donor", emit() {} },
				min: Math.min,
				max: Math.max,
				round: Math.round,
				to_number: Number,
				cache_item: plain,
				item_name: (item) => G.items[item.name].name,
				randomStr: () => "test",
				resend() {},
				success_response() {},
				fail_response: (reason) => failures.push(reason),
			});
			load(c, "node/server_functions.js", ["get_trade_slots"]);
			load(c, "node/server.js", ["create_new_item", "create_new_sitem", "consume"]);
			socketHandler(c, "equip")({ num: 0, slot: "trade1", q: item.q || 1, giveaway: true, minutes });
			assert.deepEqual(failures, []);
			assert.equal(p.slots.trade1.giveaway, expected);
			assert.equal(p.slots.trade1.name, item.name);
			assert.equal(p.slots.trade1.q || 1, item.q || 1);
			assert.equal(p.items[0], null);
		}
	}
});
