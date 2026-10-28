const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read, socketHandler, transactions } = require("./helpers/server_vm");

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

function fixture(mails, beforeCommit, owner = "US_reader") {
	const user = { _id: owner };
	const userdata = {
		_id: "IE_userdata-US_reader",
		info: { mail: 99, tutorial_step: 8, code_list: { 1: ["main", 3] } },
	};
	const context = vm.createContext({ console: { log() {}, error() {} } });
	const store = transactions(context, [userdata, ...mails], beforeCommit);
	const transactionalCollection = context.db.collection;
	const getField = (document, key) => key.split(".").reduce((value, part) => value?.[part], document);
	const matches = (document, query) =>
		Object.entries(query).every(([key, value]) => {
			if (key === "$or") return value.some((part) => matches(document, part));
			const actual = getField(document, key);
			if (value && typeof value.test === "function") return value.test(actual);
			if (value && value.$in) return value.$in.includes(actual);
			if (value && "$ne" in Object(value)) return actual !== value.$ne;
			if (value && "$exists" in Object(value)) return (actual !== undefined) === value.$exists;
			return Array.isArray(actual) ? actual.includes(value) : actual === value;
		});
	context.db.collection = (name) => ({
		...transactionalCollection(name),
		async findOne(query, options) {
			if (options?.session) return transactionalCollection(name).findOne(query, options);
			return structuredClone([...store.records.values()].find((document) => matches(document, query)) || null);
		},
		async countDocuments(query, { session, limit }) {
			return Math.min(
				limit,
				[...session.snapshot.values()].filter((document) => document._id.startsWith("ML_") && matches(document, query))
					.length,
			);
		},
		find(query) {
			let selected = [...store.records.values()].filter((document) => {
				if (!document._id.startsWith("ML_")) return false;
				return matches(document, query);
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
			if (name === "mail") {
				const saved = store.records.get(query._id);
				if (!saved?.owner.includes(query.owner)) return { matchedCount: 0, modifiedCount: 0 };
				assert.equal(update.$pull.owner, query.owner);
				saved.owner = saved.owner.filter((owner) => owner !== query.owner);
				store.versions.set(query._id, store.versions.get(query._id) + 1);
				return { matchedCount: 1, modifiedCount: 1 };
			}
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
	load(context, "adventure_functions.js", ["gf", "mail_receiver", "simplify_item", "update_mail_count"]);
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

test("legacy numeric recipients can read and collect old mail, but senders cannot", async () => {
	const letter = parcel("legacy", "12345", "67890");
	letter.owner = ["US_67890", "US_12345"];
	const h = fixture([letter], undefined, "US_12345");
	const inbox = await h.call("pull_mail");
	assert.equal(inbox.unread, 1);
	assert.equal(inbox.infs.find((info) => info.type === "mail").mail[0].can_take, true);
	assert.equal((await h.call("read_mail", { mail: letter._id })).unread, 0);
	const character = claimCharacters(h);
	const sender = character("Sender", "US_67890"),
		receiver = character("Receiver", "US_12345");
	assert.equal((await sender.claim(letter._id)).reason, "not_owner");
	assert.equal((await receiver.claim(letter._id)).success, true);
	assert.equal(receiver.player.items.length, 1);
	assert.equal((await receiver.claim(letter._id)).reason, "already_taken");
});

function sendCharacters(h) {
	const c = h.context;
	let serial = 0;
	Object.assign(c, {
		players: {},
		mode: {},
		server_id: "SR_test",
		structuredClone,
		G: { items: { sword: { name: "Sword" } } },
		randomStr: () => "send" + ++serial,
		cache_item: (item) => item,
		add_to_trade_history() {},
		xy_emit() {},
		resend() {},
		log_trace(_name, error) {
			throw error;
		},
	});
	vm.runInContext(read("node/logic/mail.js"), c);
	load(c, "node/logic/character_sessions.js", ["owns_character_session"]);
	load(c, "node/server.js", ["player_to_server", "sync_entity"]);
	h.records.set("CH_reader", { _id: "CH_reader", owner: "US_reader", name: "reader" });
	h.records.set("US_reader", { _id: "US_reader", info: {} });
	return function character(id, owner = "US_sender") {
		h.records.set(owner, { _id: owner, info: {} });
		let resolve;
		const socket = (c.socket = {
			id,
			emit(event, data) {
				if (data.response === "mail_sent" || data.response === "mail_failed") resolve?.(data);
			},
		});
		const player = (c.players[id] = {
			_id: "CH_" + id,
			real_id: "CH_" + id,
			name: id,
			owner,
			secret: id,
			socket,
			gold: 1000000,
			items: [{ name: "sword", level: 12 }, null],
			citems: [],
			cslots: [],
			p: { minutes: 0 },
			q: {},
			s: {},
			slots: {},
		});
		h.records.set(player.real_id, {
			_id: player.real_id,
			owner,
			server: "SR_test",
			info: { secret: id, p: {}, gold: player.gold, items: structuredClone(player.items) },
		});
		c.fail_response = (reason) => resolve({ failed: true, reason });
		c.success_response = () => {};
		const handler = socketHandler(c, "mail");
		return {
			player,
			send(data = {}) {
				return new Promise((done) => {
					resolve = done;
					handler({ to: "Reader", item: true, ...data });
				});
			},
		};
	};
}

test("mail keeps the 20th attachment and rejects the 21st without charging or removing an item", async () => {
	const h = fixture(Array.from({ length: 19 }, (_, i) => parcel("old" + i)));
	const character = sendCharacters(h),
		sender = character("Sender");
	assert.equal((await sender.send()).response, "mail_sent");
	assert.equal(sender.player.gold, 640000);
	assert.equal(sender.player.items[0], null);
	assert.equal(h.records.get("CH_Sender").info.items[0], null, "sender deduction commits with the delivered mail");
	sender.player.items[0] = { name: "sword", level: 13 };
	assert.equal((await sender.send()).reason, "mail_sender_limit");
	assert.equal(sender.player.gold, 640000);
	assert.equal(sender.player.items[0].level, 13);
	assert.equal([...h.records.values()].filter((m) => m.item).length, 20);
});

test("concurrent sender characters share the per-person cap", async () => {
	const h = fixture(Array.from({ length: 19 }, (_, i) => parcel("old" + i)));
	const character = sendCharacters(h),
		first = character("First"),
		second = character("Second");
	const results = await Promise.all([first.send(), second.send()]);
	assert.equal(results.filter((r) => r.response === "mail_sent").length, 1);
	assert.equal(results.filter((r) => r.reason === "mail_sender_limit").length, 1);
	assert.equal(first.player.gold + second.player.gold, 1640000);
	assert.equal([first, second].filter((c) => c.player.items[0]).length, 1);
});

test("automatic rewards do not use either player-mail allowance", async () => {
	const automatic = Array.from({ length: 220 }, (_, i) =>
		parcel("reward" + i, "US_reader", "US_sender", {
			mailbox_character: "CH_reader",
			...[{ type: "system" }, { cave_award: true }, { tracktrix_gift: true }, { mailbox_exempt: true }][i % 4],
		}),
	);
	const h = fixture([...automatic, ...Array.from({ length: 19 }, (_, i) => parcel("old" + i))]);
	const sender = sendCharacters(h)("Sender");
	assert.equal((await sender.send()).response, "mail_sent");
	sender.player.items[0] = { name: "sword", level: 13 };
	assert.equal((await sender.send()).reason, "mail_sender_limit");
	assert.equal(h.records.get("ML_reward0").taken, false);
	assert.equal(h.records.get("ML_reward1").info.item, automatic[1].info.item);
});

test("the total cap is per receiving character, includes pending claims, and allows letters without attachments", async () => {
	const letters = Array.from({ length: 200 }, (_, i) => parcel("old" + i, "US_reader", "US_person" + i));
	letters[0].taken = "mailclaim_pending";
	letters.push(parcel("elsewhere", "US_reader", "US_sender", { to: "Other", mailbox_character: "CH_other" }));
	const h = fixture(letters);
	const sender = sendCharacters(h)("Sender");
	assert.equal((await sender.send()).reason, "mailbox_full");
	assert.equal(sender.player.gold, 1000000);
	assert.equal(sender.player.items[0].name, "sword");
	assert.equal((await sender.send({ item: false })).response, "mail_sent");
	assert.equal(sender.player.gold, 952000);
	assert.equal(sender.player.items[0].name, "sword");
	h.records.get("ML_old0").taken = true;
	assert.equal((await sender.send()).response, "mail_sent");
});

test("failed delivery returns postage and the reserved slot, even after disconnect", async () => {
	let player;
	const h = fixture([], ({ session }) => {
		if ([...session.pending.keys()].some((id) => id.startsWith("ML_"))) {
			player.dc = true;
			delete h.context.players.Sender;
			throw Error("database unavailable");
		}
	});
	const sender = sendCharacters(h)("Sender");
	player = sender.player;
	await h.context.send_player_mail(player, { to: "Reader", item: true });
	assert.equal(player.gold, 1000000);
	assert.equal(player.items[0].level, 12);
	assert.equal(player.mail_sending, undefined);
});

test("mail snapshots the mounted bank and character together before either write yields", async () => {
	const h = fixture([]),
		sender = sendCharacters(h)("Sender"),
		player = sender.player;
	player.user = { gold: 1000, items0: [{ name: "firestaff", level: 9 }] };
	Object.assign(h.records.get(player.owner), { server: "SR_test", mounted_to: player._id });
	const collection = h.context.db.collection;
	let withdrew = false,
		snapshotBeforeWithdraw;
	const toServer = h.context.player_to_server;
	h.context.player_to_server = (...args) => {
		if (args[1] === "mail") snapshotBeforeWithdraw = !withdrew;
		return toServer(...args);
	};
	h.context.db.collection = (name) => {
		const original = collection(name);
		return {
			...original,
			async replaceOne(query, entity, options) {
				if (query._id === player.owner && !withdrew) {
					assert(options?.session, "bank write runs in the transaction");
					assert.equal(h.records.get(player.real_id).info.items[0].name, "sword", "character is not committed yet");
					withdrew = true;
					player.items[1] = player.user.items0[0];
					player.user.items0[0] = null;
					player.gold += 1000;
					player.user.gold = 0;
				}
				return original.replaceOne(query, entity, options);
			},
		};
	};
	assert.equal((await sender.send()).response, "mail_sent");
	assert.equal(snapshotBeforeWithdraw, true, "character snapshot precedes the bank write");
	const bank = h.records.get(player.owner).info,
		saved = h.records.get(player.real_id).info;
	assert.equal(bank.gold + saved.gold, 641000);
	assert.equal(bank.items0[0].name, "firestaff");
	assert.equal(saved.items[1], null);
	assert.equal(player.items[1].name, "firestaff", "later gameplay remains in RAM for its normal save");
});

function giveawayTimer(h, player) {
	const c = h.context;
	const events = [];
	Object.assign(c, {
		trade_slots: ["trade1"],
		get_player() {},
		random_one: (list) => list[0],
		xy_emit: (_player, _event, packet) => events.push(packet),
	});
	const send = c.send_player_mail;
	c.send_player_mail = (...args) => (c.delivery = send(...args));
	const source = read("node/server.js");
	const start = source.lastIndexOf("setInterval(function () {", source.indexOf("players[id].pdps *= 0.8"));
	const end = source.indexOf("}, 60000);", start) + "}, 60000);".length;
	let tick;
	c.setInterval = (callback) => {
		tick = callback;
	};
	vm.runInContext(source.slice(start, end), c);
	player.slots.trade1 = { name: "sword", level: 12, giveaway: 1, list: ["Reader", "Other"], registry: {} };
	return {
		events,
		tickNow: () => tick(),
		async tick() {
			tick();
			await c.delivery;
		},
	};
}

test("giveaway prizes wait at the sender cap and keep the same winner until space is available", async () => {
	const h = fixture(Array.from({ length: 20 }, (_, i) => parcel("old" + i)));
	const sender = sendCharacters(h)("Sender"),
		player = sender.player;
	const giveaway = giveawayTimer(h, player);
	const original = player.slots.trade1;
	await giveaway.tick();
	assert.equal(player.slots.trade1, original);
	assert.equal(original.giveaway, 5);
	assert.equal(original.mail_winner, "Reader");
	assert.equal(giveaway.events.length, 0, "no prize announcement before delivery");
	assert.equal(player.gold, 1000000, "giveaways do not charge postage");
	h.records.get("ML_old0").taken = true;
	h.context.random_one = () => {
		throw Error("winner must not be redrawn");
	};
	for (let i = 0; i < 5; i++) await giveaway.tick();
	assert.equal(player.slots.trade1, null);
	assert.equal(h.records.get(player.real_id).info.slots.trade1, null, "listing removal commits with the mail");
	const delivered = [...h.records.values()].find((m) => m._id.startsWith("ML_send"));
	assert.equal(delivered.mailbox_exempt, undefined);
	assert.equal(delivered.mailbox_character, "CH_reader");
	const item = JSON.parse(delivered.info.item);
	assert.equal(item.src, "gva");
	assert.equal(item.gf, "Sender");
	for (const key of ["giveaway", "registry", "list", "mail_winner", "mail_waiting_reason"])
		assert.equal(item[key], undefined);
	assert.equal(giveaway.events.length, 1);
	assert.equal(player.items[0].level, 12, "the inventory slot is unrelated to the prize");
});

test("giveaway prizes and ordinary mail serialize against the same total limit", async () => {
	const h = fixture(Array.from({ length: 199 }, (_, i) => parcel("old" + i, "US_reader", "US_person" + i)));
	const character = sendCharacters(h),
		host = character("Host"),
		sender = character("Sender", "US_other");
	const giveaway = giveawayTimer(h, host.player);
	await Promise.all([giveaway.tick(), sender.send()]);
	assert.equal([...h.records.values()].filter((m) => m.item).length, 200);
	assert.equal((host.player.slots.trade1 ? 1 : 0) + (sender.player.items[0] ? 1 : 0), 1);
	assert.equal(host.player.gold, 1000000);
});

test("failed giveaway delivery restores its listing and never announces a lost prize", async () => {
	const h = fixture([], ({ session }) => {
		if ([...session.pending.keys()].some((id) => id.startsWith("ML_"))) throw Error("database unavailable");
	});
	const sender = sendCharacters(h)("Sender");
	const giveaway = giveawayTimer(h, sender.player),
		original = sender.player.slots.trade1;
	await giveaway.tick();
	assert.equal(sender.player.slots.trade1, original);
	assert.equal(sender.player.mail_sending, undefined);
	assert.equal(original.mail_winner, "Reader");
	assert.equal(original.giveaway, 5);
	assert.equal(giveaway.events.length, 0);
	assert.equal([...h.records.values()].filter((m) => m.item).length, 0);
});

test("a deleted giveaway participant is removed before a new winner is selected", async () => {
	const h = fixture([]),
		sender = sendCharacters(h)("Sender"),
		player = sender.player;
	const giveaway = giveawayTimer(h, player);
	player.slots.trade1.list = ["Ghost", "Reader"];
	await giveaway.tick();
	assert.equal(player.slots.trade1.mail_winner, undefined);
	assert.deepEqual(Array.from(player.slots.trade1.list), ["Reader"]);
	assert.equal(player.slots.trade1.giveaway, 5);
	assert.equal(giveaway.events.length, 0);
	for (let i = 0; i < 5; i++) await giveaway.tick();
	assert.equal(player.slots.trade1, null);
	const delivered = [...h.records.values()].find((m) => m._id.startsWith("ML_send"));
	assert.equal(delivered.to, "Reader");
	assert.equal(giveaway.events.length, 1);
});

test("unknown recipients and missing attachments keep gold and inventory unchanged", async () => {
	const h = fixture([]),
		sender = sendCharacters(h)("Sender");
	assert.equal((await sender.send({ to: "Nobody" })).reason, "nocharacter");
	assert.equal(sender.player.gold, 1000000);
	assert.equal(sender.player.items[0].level, 12);
	sender.player.items[0] = null;
	assert.equal((await sender.send()).reason, "no_item");
	assert.equal(sender.player.gold, 1000000);
});

function parcel(id, receiver = "US_reader", sender = "US_sender", extra = {}) {
	const letter = Object.assign(mail(id, receiver, sender), { item: true, taken: false }, extra);
	letter.info.item = JSON.stringify({ name: "sword", level: 12 });
	return letter;
}

function claimCharacters(h) {
	const c = h.context;
	let serial = 0;
	Object.assign(c, {
		players: {},
		mode: {},
		G: { items: { sword: {} } },
		randomStr: () => "claim-" + ++serial,
		can_add_item: (player) => !player.full,
		add_item: (player, item) => player.items.push(item),
		cache_item: (item) => item,
		resend() {},
	});
	return function character(id, owner = "US_reader") {
		const pending = new Map();
		c.socket = {
			id,
			emit(event, data) {
				assert.equal(event, "game_response");
				pending.get(data.request_id)?.(data);
				pending.delete(data.request_id);
			},
		};
		const player = (c.players[id] = { owner, real_id: "CH_" + id, items: [] });
		const handler = socketHandler(c, "mail_take_item");
		return {
			player,
			claim(mailId) {
				const request_id = "request-" + ++serial;
				return new Promise((resolve) => {
					pending.set(request_id, resolve);
					handler({ id: mailId, request_id });
				});
			},
		};
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

test("untaken attachments stay in the recipient mailbox while the sender may hide its copy", async () => {
	for (const taken of [false, "mailclaim_pending"]) {
		const gift = parcel("one", "US_reader", "US_sender", { taken });
		const h = fixture([gift]);
		assert.equal((await h.call("delete_mail", { mid: gift._id })).result.reason, "mail_item_untaken");
		assert.equal((await h.call("delete_mail", { mid: gift._id, user: { _id: "US_sender" } })).result.success, true);
		assert.deepEqual(h.records.get(gift._id).owner, ["US_reader"]);
		assert.equal(h.records.get(gift._id).info.item, gift.info.item);
		h.records.get(gift._id).taken = true;
		assert.equal((await h.call("delete_mail", { mid: gift._id })).result.success, true);
		assert.deepEqual(h.records.get(gift._id).owner, []);
	}
});

test("delete accepts only visible mail IDs and cannot delete other records", async () => {
	const h = fixture([mail("one"), mail("private", "US_other", "US_stranger")]);
	const character = { _id: "CH_reader", owner: ["US_reader"], info: { items: ["valuable"] } };
	h.records.set(character._id, character);
	for (const mid of ["CH_reader", { $ne: null }, null, "ML_missing"])
		assert.equal((await h.call("delete_mail", { mid })).result.failed, true);
	assert.deepEqual(h.records.get(character._id), character);
	assert.equal((await h.call("delete_mail", { mid: "ML_private" })).result.failed, true);
	assert(h.records.has("ML_private"));
});

test("concurrent deletions hide both copies and self-mail removes every matching owner", async () => {
	const h = fixture([mail("one"), mail("self", "US_reader", "US_reader")]);
	const results = await Promise.all(
		["US_sender", "US_reader"].map((_id) => h.call("delete_mail", { mid: "ML_one", user: { _id } })),
	);
	assert(results.every((response) => response.result.success));
	assert.deepEqual(h.records.get("ML_one").owner, []);
	await h.call("delete_mail", { mid: "ML_self" });
	assert.deepEqual(h.records.get("ML_self").owner, []);
	await h.call("read_mail", { mail: "ML_self" });
	assert.equal(h.records.get("ML_self").read, false, "a hidden copy cannot be marked read");
});

test("only the receiving account can claim ordinary mail, giveaway prizes and system gifts", async () => {
	for (const extra of [
		{},
		{ fro: "Giveaway from Sender" },
		{ tracktrix_gift: true },
		{ cave_award: true, character: "CH_reader" },
	]) {
		const gift = parcel("gift", "US_reader", "US_sender", extra);
		const h = fixture([gift]);
		const character = claimCharacters(h),
			sender = character("sender", "US_sender"),
			reader = character("reader");
		assert.equal((await sender.claim(gift._id)).reason, "not_owner");
		assert.equal(h.records.get(gift._id).taken, false);
		if (gift.character) assert.equal((await character("alternate").claim(gift._id)).reason, "wrong_character");
		assert.equal((await reader.claim(gift._id)).success, true);
		assert.equal(sender.player.items.length, 0);
		assert.equal(reader.player.items[0].level, 12);
		assert.equal(h.records.get(gift._id).taken, true);
	}
});

test("self-mail and legacy receiver fields work, but a missing recipient cannot authorize a claim", async () => {
	const self = parcel("self", "US_reader", "US_reader"),
		legacy = parcel("legacy"),
		missing = parcel("missing");
	legacy.receiver = legacy.info.receiver;
	delete legacy.info.receiver;
	delete missing.info.receiver;
	const h = fixture([self, legacy, missing]),
		reader = claimCharacters(h)("reader");
	assert.equal((await reader.claim(self._id)).success, true);
	assert.equal((await reader.claim(legacy._id)).success, true);
	assert.equal((await reader.claim(missing._id)).reason, "not_owner");
	assert.equal(reader.player.items.length, 2);
	for (const id of [null, { $ne: null }, "CH_reader"]) assert.equal((await reader.claim(id)).reason, "invalid_mail");
});

test("concurrent claims deliver one item; sender and duplicate claims cannot collect it", async () => {
	const h = fixture([parcel("race")]),
		character = claimCharacters(h);
	const sender = character("sender", "US_sender"),
		first = character("first"),
		second = character("second");
	const results = await Promise.all([sender.claim("ML_race"), first.claim("ML_race"), second.claim("ML_race")]);
	assert.equal(results[0].reason, "not_owner");
	assert.equal(results.filter((result) => result.success).length, 1);
	assert.equal(first.player.items.length + second.player.items.length + sender.player.items.length, 1);
	assert.equal(h.records.get("ML_race").taken, true);
	assert.equal((await second.claim("ML_race")).reason, "already_taken");
});

test("a sender deleting mail during claim or settlement cannot steal or duplicate its attachment", async () => {
	for (const phase of ["claim", "settlement"]) {
		let deleted = false;
		const h = fixture([parcel("race")], async ({ session }) => {
			const pending = session.pending.get("ML_race");
			if (deleted || !pending || (phase === "claim" ? typeof pending.taken !== "string" : pending.taken !== true))
				return;
			deleted = true;
			await h.call("delete_mail", { mid: "ML_race", user: { _id: "US_sender" } });
		});
		const character = claimCharacters(h),
			reader = character("reader"),
			sender = character("sender", "US_sender");
		assert.equal((await reader.claim("ML_race")).success, true);
		assert(deleted);
		assert.deepEqual(h.records.get("ML_race").owner, ["US_reader"]);
		assert.equal(h.records.get("ML_race").taken, true);
		assert.equal((await sender.claim("ML_race")).reason, "not_owner");
		assert.equal((await reader.claim("ML_race")).reason, "already_taken");
		assert.equal(reader.player.items.length, 1);
	}
});

test("recipient deletion cannot hide an attachment during a claim", async () => {
	let deleted = false;
	const h = fixture([parcel("race")], async ({ session }) => {
		if (deleted || !session.pending.has("ML_race")) return;
		deleted = true;
		assert.equal((await h.call("delete_mail", { mid: "ML_race" })).result.reason, "mail_item_untaken");
	});
	const character = claimCharacters(h),
		reader = character("reader"),
		sender = character("sender", "US_sender");
	assert.equal((await reader.claim("ML_race")).success, true);
	assert.equal((await sender.claim("ML_race")).reason, "not_owner");
	assert.equal(reader.player.items.length + sender.player.items.length, 1);
	assert.equal(h.records.get("ML_race").taken, true);
});

test("the mailbox and its actual renderer offer TAKE only to the recipient", async () => {
	const h = fixture([parcel("gift")]),
		c = h.context;
	let html;
	Object.assign(c, {
		G: { items: { sword: {} } },
		window: {},
		html_escape: (value) => value,
		item_container: () => "<item>",
		show_modal: (value) => (html = value),
		api_call() {},
	});
	vm.runInContext("String.prototype.replace_all = function(a,b) { return this.split(a).join(b); };", c);
	load(c, "js/html.js", ["render_mail"]);
	for (const owner of ["US_sender", "US_reader"]) {
		const entry = (await h.call("pull_mail", { user: { _id: owner } })).infs[0].mail[0];
		assert.equal(entry.can_take, owner === "US_reader");
		c.window.mail = { [entry.id]: entry };
		c.render_mail(entry.id);
		assert.equal(html.includes("takeitem"), owner === "US_reader");
		assert.equal(html.includes("show_delete_mail"), owner === "US_sender");
	}
});

test("the badge keeps its existing 100-message cap", async () => {
	const h = fixture(Array.from({ length: 110 }, (_, i) => mail(String(i))));
	assert.equal((await h.call("pull_mail")).unread, 100);
});

test("claim retries recognize their own committed claim after lost acknowledgements", async () => {
	for (const losses of [1, 3]) {
		const h = fixture([parcel("retry")]);
		const start = h.context.client.startSession;
		let lost = 0;
		h.context.client.startSession = () => {
			const session = start();
			const commit = session.commitTransaction.bind(session);
			session.commitTransaction = async () => {
				await commit();
				session.abortTransaction = async () => {
					throw Error("already committed");
				};
				if (typeof h.records.get("ML_retry").taken === "string" && lost++ < losses) throw Error("lost commit response");
			};
			return session;
		};
		h.context.log_trace = () => {};
		const reader = claimCharacters(h)("reader");
		assert.equal((await reader.claim("ML_retry")).success, true);
		assert.equal(reader.player.items.length, 1);
		assert.equal(h.records.get("ML_retry").taken, true);
		assert.equal((await reader.claim("ML_retry")).reason, "already_taken");
		assert.equal(reader.player.items.length, 1);
	}
});

test("a giveaway timer cannot overwrite its reserved listing while the mail commit waits", async () => {
	let timer,
		player,
		checked = false;
	const h = fixture([], ({ session }) => {
		if (checked || ![...session.pending.keys()].some((id) => id.startsWith("ML_"))) return;
		checked = true;
		const reserved = player.slots.trade1;
		assert.equal(reserved.name, "placeholder");
		timer.tickNow();
		assert.equal(player.slots.trade1, reserved);
		assert.equal(reserved.giveaway, 1);
		assert.equal(timer.events.length, 0);
	});
	player = sendCharacters(h)("Sender").player;
	timer = giveawayTimer(h, player);
	await timer.tick();
	assert(checked);
	assert.equal(player.slots.trade1, null);
	assert.equal(player.mail_sending, undefined);
	assert.equal(timer.events.length, 1);
});

test("concurrent giveaway transactions preserve each donor, winner and titled prize", async () => {
	const h = fixture([]),
		make = sendCharacters(h);
	const first = make("First").player,
		second = make("Second", "US_second").player;
	const timer = giveawayTimer(h, first);
	const prize = {
		name: "sword",
		level: 12,
		q: 2,
		p: "glitched",
		ps: ["glitched"],
		giveaway: 1,
		list: ["Reader"],
		registry: {},
	};
	first.slots.trade1 = structuredClone(prize);
	second.slots.trade1 = { ...structuredClone(prize), level: 13 };
	await Promise.all([
		h.context.send_player_mail(first, { to: "Reader", item: true }, "trade1"),
		h.context.send_player_mail(second, { to: "Reader", item: true }, "trade1"),
	]);
	const delivered = [...h.records.values()].filter((m) => m._id.startsWith("ML_send"));
	assert.equal(delivered.length, 2);
	for (const [player, level] of [
		[first, 12],
		[second, 13],
	]) {
		const letter = delivered.find((m) => m.info.sender === player.owner),
			item = JSON.parse(letter.info.item);
		assert.equal(letter.fro, player.name);
		assert.equal(letter.info.receiver, "US_reader");
		assert.deepEqual(item, {
			name: "sword",
			level,
			q: 2,
			p: "glitched",
			ps: ["glitched"],
			gf: player.name,
			src: "gva",
		});
		assert.equal(player.slots.trade1, null);
	}
	await timer.tick();
	assert.equal([...h.records.values()].filter((m) => m._id.startsWith("ML_send")).length, 2);
});

test("changing a giveaway during recipient lookup cannot send the replacement prize", async () => {
	const h = fixture([]),
		player = sendCharacters(h)("Sender").player;
	const timer = giveawayTimer(h, player);
	const replacement = { name: "sword", level: 13, giveaway: 60, list: ["Other"], registry: {} };
	const collection = h.context.db.collection;
	h.context.db.collection = (name) => {
		const original = collection(name);
		return {
			...original,
			async findOne(query, options) {
				const result = await original.findOne(query, options);
				if (name === "character" && query.name === "reader") player.slots.trade1 = replacement;
				return result;
			},
		};
	};
	await timer.tick();
	assert.equal(player.slots.trade1, replacement);
	assert.equal(replacement.giveaway, 60);
	assert.equal(player.mail_sending, undefined);
	assert.equal(timer.events.length, 0);
	assert.equal([...h.records.values()].filter((m) => m._id.startsWith("ML_send")).length, 0);
});

test("a failed giveaway lookup leaves a moved original listing untouched", async () => {
	for (const missing of [false, true]) {
		const h = fixture([]),
			player = sendCharacters(h)("Sender").player;
		const timer = giveawayTimer(h, player),
			originalPrize = player.slots.trade1;
		const collection = h.context.db.collection;
		h.context.db.collection = (name) => {
			const original = collection(name);
			return {
				...original,
				async findOne(query, options) {
					const result = await original.findOne(query, options);
					if (name === "character" && query.name === "reader") {
						player.slots.trade1 = null;
						player.slots.trade2 = originalPrize;
						originalPrize.giveaway = 30;
						return missing ? null : result;
					}
					return result;
				},
			};
		};
		await timer.tick();
		assert.equal(originalPrize.giveaway, 30);
		assert.equal(originalPrize.mail_winner, "Reader");
		assert.deepEqual(originalPrize.list, ["Reader", "Other"]);
		assert.equal(player.slots.trade2, originalPrize);
		assert.equal(player.mail_sending, undefined);
		assert.equal(timer.events.length, 0);
	}
});
