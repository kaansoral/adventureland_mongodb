const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, socketHandler, transactions } = require("./helpers/server_vm");

const clone = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => {
	for (let i = 0; i < 8; i++) await new Promise(setImmediate);
};

function fixture(beforeCommit) {
	const owner = {
		_id: "US_tracktrix",
		mounted_to: "CH_first",
		info: { gold: 1234, items0: [{ name: "ring", level: 3 }], rewards: ["c0"] },
	};
	const c = vm.createContext({
		console: { log() {}, error() {} },
		gf: (entity, key, fallback) => entity.info?.[key] ?? fallback,
	});
	const store = transactions(c, [owner], beforeCommit);
	c.update_mail_count = async (id) => {
		assert.equal(id._id || id, owner._id);
		return Array.from(store.records.values()).filter((record) => record.type === "mail" && !record.read).length;
	};
	load(c, "adventure_functions.js", ["send_tracktrix_mail"]);
	return { c, owner, mailId: "ML_tracktrix:" + owner._id, ...store };
}

test("concurrent character logins send one account gift and preserve fresh bank data", async () => {
	let changed = false;
	const f = fixture(({ records, versions }) => {
		if (changed) return;
		changed = true;
		const owner = records.get("US_tracktrix");
		owner.info.gold = 4321;
		owner.info.items0.push({ name: "coat", level: 4 });
		versions.set(owner._id, versions.get(owner._id) + 1);
	});
	const counts = await Promise.all(["First", "Second", "Third"].map((name) => f.c.send_tracktrix_mail(f.owner, name)));
	assert.equal(counts.filter((count) => count === 1).length, 1);
	assert.equal(f.stats.writes, 2, "only the letter and account flag are committed");
	const mail = f.records.get(f.mailId),
		owner = f.records.get(f.owner._id);
	assert.equal(mail.fro, "Daisy");
	assert.deepEqual(mail.owner, [f.owner._id]);
	assert.equal(mail.character, undefined, "any character on the account can claim it");
	assert.deepEqual(JSON.parse(mail.info.item), { name: "tracker", gift: 1 });
	assert.equal(owner.info.tracktrix_mail_sent, true);
	assert.equal(owner.info.gold, 4321);
	assert.deepEqual(owner.info.items0, [...f.owner.info.items0, { name: "coat", level: 4 }]);
	assert.deepEqual(owner.info.rewards, ["c0"]);
	assert.equal(owner.mounted_to, f.owner.mounted_to);
});

test("a failed transaction leaves neither letter nor flag and a later login can retry", async () => {
	let fail = true;
	const f = fixture(() => {
		if (fail) throw new Error("fixture transaction failure");
	});
	await assert.rejects(f.c.send_tracktrix_mail(f.owner, "First"), /Tracktrix mail/);
	assert.equal(f.records.has(f.mailId), false);
	assert.deepEqual(f.records.get(f.owner._id), f.owner);
	fail = false;
	assert.equal(await f.c.send_tracktrix_mail(f.owner, "Second"), 1);
	assert.equal(f.records.get(f.owner._id).info.tracktrix_mail_sent, true);
});

test("deleting mail, replacing characters and resetting the tutorial cannot renew the gift", async () => {
	const f = fixture();
	await f.c.send_tracktrix_mail(f.owner, "First");
	f.records.delete(f.mailId);
	f.records.set("IE_userdata-" + f.owner._id, { info: { completed_tasks: [], tutorial_step: 0 } });
	assert.equal(await f.c.send_tracktrix_mail(f.owner, "Replacement"), undefined);
	assert.equal(f.records.has(f.mailId), false);
	assert.equal(f.stats.writes, 2);
});

test("an existing claimed letter is never replaced when repairing a missing account flag", async () => {
	const f = fixture();
	await f.c.send_tracktrix_mail(f.owner, "First");
	delete f.records.get(f.owner._id).info.tracktrix_mail_sent;
	const mail = f.records.get(f.mailId);
	mail.read = mail.taken = true;
	const before = clone(mail);
	assert.equal(await f.c.send_tracktrix_mail(f.owner, "Second"), undefined);
	assert.deepEqual(clone(f.records.get(f.mailId)), before);
	assert.equal(f.records.get(f.owner._id).info.tracktrix_mail_sent, true);
});

test("notification failure cannot resend a committed gift", async () => {
	const f = fixture();
	f.c.update_mail_count = async () => {
		throw new Error("fixture notification failure");
	};
	await assert.rejects(f.c.send_tracktrix_mail(f.owner, "First"), /notification failure/);
	assert.equal(await f.c.send_tracktrix_mail(f.owner, "Second"), undefined);
	assert.equal(f.stats.writes, 2);
});

test("the normal mail handler lets another owned character claim the gift exactly once", async () => {
	const f = fixture(),
		c = f.c,
		events = [];
	await c.send_tracktrix_mail(f.owner, "First");
	let serial = 0;
	Object.assign(c, {
		players: {},
		mode: {},
		G: { items: { tracker: {} } },
		get: async (id) => clone(f.records.get(id)),
		randomStr: () => "claim-" + ++serial,
		can_add_item: (player) => !player.full,
		add_item: (player, item) => player.items.push(item),
		cache_item: (item) => item,
		resend() {},
	});
	function character(id, owner) {
		c.socket = { id, emit: (event, data) => events.push({ id, ...data }) };
		c.players[id] = { owner, real_id: "CH_" + id, items: [] };
		return socketHandler(c, "mail_take_item");
	}
	const other = character("Other", "US_other"),
		second = character("Second", f.owner._id),
		third = character("Third", f.owner._id);
	other({ id: f.mailId });
	await flush();
	assert.equal(events.at(-1).reason, "not_owner");
	c.players.Second.full = true;
	second({ id: f.mailId });
	await flush();
	assert.equal(events.at(-1).reason, "inv_size");
	assert.equal(f.records.get(f.mailId).taken, false);
	c.players.Second.full = false;
	second({ id: f.mailId });
	third({ id: f.mailId });
	await flush();
	assert.equal(c.players.Second.items.length + c.players.Third.items.length, 1);
	assert.equal(f.records.get(f.mailId).taken, true);
	third({ id: f.mailId });
	await flush();
	assert.equal(events.at(-1).reason, "already_taken");
	assert.equal(c.players.Second.items.length + c.players.Third.items.length, 1);
});

test("mail responses localize the gift while retaining the canonical letter and normal attachment", async () => {
	const f = fixture(),
		c = f.c;
	await c.send_tracktrix_mail(f.owner, "First");
	const mail = f.records.get(f.mailId);
	const cursor = {
		sort() {
			return this;
		},
		skip() {
			return this;
		},
		limit() {
			return this;
		},
		async toArray() {
			return [mail];
		},
	};
	c.db = { collection: () => ({ find: () => cursor }) };
	c.simplify_item = (item) => item;
	load(c, "api.js", ["pull_mail_api"]);
	const res = { infs: [] };
	await c.pull_mail_api({ user: f.owner, res });
	const result = res.infs[0].mail[0];
	assert.equal(result.subject, "Your Tracktrix");
	assert.equal(result.subject_message.phrase, "server.tracktrix.mail_subject");
	assert.equal(result.body_message.phrase, "server.tracktrix.mail_body");
	assert.deepEqual(JSON.parse(result.item), { name: "tracker", gift: 1 });
	assert.equal(result.taken, false);
});
