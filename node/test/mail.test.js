const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read, transactions } = require("./helpers/server_vm");

function mail(id, receiver = "US_reader", sender = "US_sender") {
	return {
		_id: "ML_" + id,
		created: new Date("2026-09-01T00:00:00Z"),
		owner: [sender, receiver],
		read: false,
		fro: "Sender",
		to: "Reader",
		info: { sender, receiver, subject: "A parcel", message: "Enjoy!" },
	};
}

function fixture(mails, beforeCommit) {
	const user = { _id: "US_reader" };
	const userdata = {
		_id: "IE_userdata-US_reader",
		info: { mail: 99, tutorial_step: 8, code_list: { 1: ["main", 3] } },
	};
	const context = vm.createContext({ console: { log() {}, error() {} } });
	const store = transactions(context, [userdata, ...mails], beforeCommit);
	const transactionalCollection = context.db.collection;
	const getField = (document, key) => key.split(".").reduce((value, part) => value?.[part], document);
	context.db.collection = (name) => ({
		...transactionalCollection(name),
		find(query) {
			let selected = [...store.records.values()].filter((document) => {
				if (!document._id.startsWith("ML_")) return false;
				return Object.entries(query).every(([key, value]) => {
					const actual = getField(document, key);
					return Array.isArray(actual) ? actual.includes(value) : actual === value;
				});
			});
			let skip = 0,
				limit = Infinity,
				projection;
			return {
				project(value) {
					projection = value;
					return this;
				},
				limit(value) {
					limit = value;
					return this;
				},
				skip(value) {
					skip = value;
					return this;
				},
				sort(fields) {
					selected.sort((a, b) => {
						for (const [key, direction] of Object.entries(fields)) {
							if (a[key] < b[key]) return -direction;
							if (a[key] > b[key]) return direction;
						}
						return 0;
					});
					return this;
				},
				async toArray() {
					return structuredClone(
						selected.slice(skip, skip + limit).map((document) => (projection ? { _id: document._id } : document)),
					);
				},
			};
		},
		async updateOne(query, update, options) {
			assert.equal(name, "infoelement");
			assert.deepEqual(Object.keys(update.$set), ["info.mail"]);
			let saved = store.records.get(query._id);
			if (!saved && options?.upsert) {
				saved = { _id: query._id, ...update.$setOnInsert, info: {} };
				store.records.set(query._id, saved);
			}
			saved.info.mail = update.$set["info.mail"];
		},
	});
	context.get = async (id) => structuredClone(store.records.get(id));
	context.remove = async (document) => store.records.delete(document._id);
	load(context, "adventure_functions.js", ["gf", "simplify_item", "update_mail_count"]);
	load(context, "api.js", ["read_mail_api", "pull_mail_api", "delete_mail_api"]);
	return {
		...store,
		context,
		async call(method, args = {}) {
			const res = { infs: [] };
			const result = await context[method + "_api"]({ user, res, ...args });
			return { result, infs: res.infs, unread: res.infs.find((info) => info.type === "unread")?.count };
		},
	};
}

test("mail IDs returned by the mailbox can be marked read; legacy bare IDs still work", async () => {
	for (const bare of [false, true]) {
		const h = fixture([mail("one"), mail("two")]);
		const inbox = await h.call("pull_mail");
		const id = inbox.infs.find((info) => info.type === "mail").mail[0].id;
		const read = await h.call("read_mail", { mail: bare ? id.slice(3) : id });
		assert.equal(read.result.success, true);
		assert.equal(read.unread, 1);
		assert.equal(h.records.get(id).read, true);
		assert.equal((await h.call("read_mail", { mail: id })).unread, 1);
		assert.deepEqual(h.records.get("IE_userdata-US_reader").info.code_list, { 1: ["main", 3] });
		assert.equal(h.records.get("IE_userdata-US_reader").info.tutorial_step, 8);
	}
});

test("unread counts include incoming mail only and mailbox opening repairs a stale badge", async () => {
	const h = fixture([
		mail("incoming"),
		mail("self", "US_reader", "US_reader"),
		...Array.from({ length: 11 }, (_, i) => mail("sent" + i, "US_other", "US_reader")),
		mail("private", "US_other", "US_stranger"),
	]);
	assert.equal((await h.call("pull_mail")).unread, 2);
	assert.equal((await h.call("read_mail", { mail: "ML_sent0" })).unread, 2);
	assert.equal(h.records.get("ML_sent0").read, false);
	assert.equal((await h.call("read_mail", { mail: "ML_private" })).unread, 2);
	assert.equal(h.records.get("ML_private").read, false);
	assert.equal((await h.call("read_mail", { mail: "ML_missing" })).unread, 2);
	await h.call("read_mail", { mail: "ML_incoming" });
	assert.equal((await h.call("read_mail", { mail: "ML_self" })).unread, 0);
});

test("cave mail updates the saved unread count and every connected character on the receiving account", async () => {
	const h = fixture([mail("old")]);
	const events = [];
	h.context.players = Object.fromEntries(
		["first", "second", "other", "offline"].map((name) => [
			name,
			{
				owner: name === "other" ? "US_other" : "US_reader",
				dc: name === "offline",
				socket: { emit: (event, data) => events.push({ name, event, ...data }) },
			},
		]),
	);
	h.context.log_trace = (_label, error) => {
		throw error;
	};
	load(h.context, "node/logic/cave_of_many_dreams.js", ["cave_mail"]);
	const recipient = { owner: "US_reader", name: "Reader", character: "CH_reader" };
	const pending = h.context.cave_mail(recipient, { name: "cave_amber", q: 1 }, "reward");
	assert.equal(h.context.cave_pending(), true, "graceful shutdown must wait for the reward write");
	await pending;
	assert.equal(h.context.cave_pending(), false);
	assert.equal(h.records.get("IE_userdata-US_reader").info.mail, 2);
	assert.deepEqual(
		events.filter((event) => event.event === "game_response"),
		["first", "second"].map((name) => ({ name, event: "game_response", response: "mail_received", count: 2 })),
	);
	const notices = events.filter((event) => event.event === "game_log");
	assert.equal(notices.length, 2, "both online characters receive the mail collection instructions");
	for (const notice of notices) {
		assert.equal(notice.phrase, "cave.in_mail");
		assert.equal(notice.phrase_args.name, "Reader");
		assert.match(notice.message, /Mailed.*COM → MAIL as Reader/);
	}
	await h.context.cave_mail(recipient, { name: "cave_amber", q: 1 }, "reward");
	assert.equal(
		events.filter((event) => event.event === "game_log").length,
		2,
		"a retried delivery does not repeat the notice",
	);
	assert.equal(h.records.get("IE_userdata-US_reader").info.mail, 2, "retries must not add letters or unread counts");
	assert.equal([...h.records.keys()].filter((key) => key.startsWith("ML_cave:")).length, 1);
	const saved = h.records.get("IE_userdata-US_reader");
	assert.equal(saved.info.tutorial_step, 8);
	assert.deepEqual(saved.info.code_list, { 1: ["main", 3] });
});

test("only trusted cave reward mail carries translated subject and body metadata", async () => {
	const ordinary = mail("ordinary");
	ordinary.fro = "Dorr";
	ordinary.info.subject = "From the cave";
	ordinary.info.message = "You left this with me.";
	const cave = structuredClone(ordinary);
	cave._id = "ML_cave:reward";
	cave.cave_award = true;
	const h = fixture([ordinary, cave]);
	const inbox = (await h.call("pull_mail")).infs.find((info) => info.type === "mail").mail;
	const normal = inbox.find((entry) => entry.id === ordinary._id);
	const reward = inbox.find((entry) => entry.id === cave._id);
	assert.equal(normal.subject_message, undefined);
	assert.equal(normal.body_message, undefined);
	assert.equal(normal.message, ordinary.info.message);
	assert.equal(reward.subject, ordinary.info.subject);
	assert.equal(reward.message, ordinary.info.message);
	assert.equal(reward.subject_message.phrase, "server.cave.mail_subject");
	assert.equal(reward.body_message.phrase, "server.cave.mail_body");
	const localization = require("../../languages");
	assert.equal(localization.phrase(reward.subject_message.phrase, {}, "de"), "Aus der Höhle");
	assert.equal(
		localization.phrase(reward.body_message.phrase, {}, "de"),
		"Ich habe deine Höhlenbelohnung sicher verwahrt. Hole sie mit dem Charakter ab, der auf diesem Brief steht.",
	);
});

test("a mail notification updates COM without opening Mail or touching graphics", () => {
	const html = new Map();
	let response;
	const context = vm.createContext({
		console,
		Dev: false,
		no_graphics: true,
		inside: "game",
		character: {},
		G: { skills: {} },
		trade_slots: [],
		X: { characters: [] },
		socket: {
			on: (_event, handler) => {
				response = handler;
			},
		},
		draw_trigger: (fn) => fn(),
		call_code_function() {},
		$: (selector) => ({ length: 0, html: (value) => html.set(selector, value) }),
		PIXI: new Proxy(
			{},
			{
				get() {
					throw Error("Mail must not touch graphics");
				},
			},
		),
	});
	load(context, "js/functions.js", ["handle_information", "update_servers_and_characters"]);
	const source = read("js/game.js");
	const start = source.indexOf('\tsocket.on("game_response",');
	vm.runInContext(source.slice(start, source.indexOf("\n\tsocket.on(", start + 1)), context);
	response({ response: "mail_received", count: 3 });
	assert.equal(context.X.unread, 3);
	assert.equal(html.get(".comcount"), " [3]");
	assert.equal(html.get(".mcount"), 3);
});

test("a failed read transaction does not publish success or an invented unread count", async () => {
	const h = fixture([mail("one")], ({ conflict }) => {
		throw conflict();
	});
	const response = await h.call("read_mail", { mail: "ML_one" });
	assert.equal(response.result.failed, true);
	assert.equal(response.infs.length, 0);
	assert.equal(h.records.get("ML_one").read, false);
});

test("sent and received history retain attachments and stable pagination without exposing other accounts", async () => {
	const gift = mail("gift", "US_other", "US_reader");
	Object.assign(gift, { item: true, taken: false });
	gift.info.item = JSON.stringify({ name: "cxjar", data: "ikissyou", q: 2, src: "private-provenance" });
	const h = fixture([
		gift,
		...Array.from({ length: 85 }, (_, i) => mail("page" + i)),
		mail("private", "US_other", "US_stranger"),
	]);
	const ids = [];
	let cursor;
	do {
		const response = await h.call("pull_mail", { cursor });
		const page = response.infs.find((info) => info.type === "mail");
		ids.push(...page.mail.map((mail) => mail.id));
		const item = page.mail.find((mail) => mail.id === "ML_gift");
		if (item) {
			assert.equal(item.taken, false);
			assert.deepEqual(JSON.parse(item.item), { name: "cxjar", data: "ikissyou", q: 2 });
		}
		cursor = page.more ? page.cursor : null;
	} while (cursor);
	assert.equal(ids.length, 86);
	assert.equal(new Set(ids).size, 86);
	assert(ids.includes("ML_gift"));
	assert(!ids.includes("ML_private"));
});

test("deletion repairs both cached counts, keeps authorization and leaves attachments untouched when denied", async () => {
	const h = fixture([mail("one"), mail("private", "US_other", "US_stranger")]);
	assert.equal((await h.call("delete_mail", { mid: "ML_private" })).result.failed, true);
	assert(h.records.has("ML_private"));
	assert.equal((await h.call("delete_mail", { mid: "ML_one" })).unread, 0);
	assert.equal(h.records.get("IE_userdata-US_sender").info.mail, 0);
	assert(!h.records.has("ML_one"));
});

test("the badge keeps its existing 100-message cap", async () => {
	const h = fixture(Array.from({ length: 110 }, (_, i) => mail(String(i))));
	assert.equal((await h.call("pull_mail")).unread, 100);
});
