const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { ClientSession, MongoServerError } = require("mongodb");
const { load, read, transactions } = require("./helpers/server_vm");

function setup({ beforeCommit, createCharge, failInsert = false } = {}) {
	const events = [],
		updates = [],
		charges = new Map(),
		requests = [],
		searches = [];
	const owner = {
		_id: "US_buyer",
		name: "Buyer",
		cash: 10,
		referrer: "US_referrer",
		server: "SR_bank",
		mounted_to: "Buyer",
		info: { gold: 1000, items0: [{ name: "sword", level: 8 }] },
	};
	const referrer = { _id: "US_referrer", name: "Referrer", cash: 5, info: { rcash: 3, referrer_events: 2 } };
	const context = vm.createContext({
		console: { log() {}, error() {} },
		crypto,
		Dev: true,
		extra_shells: 0,
		STRIPE_PURCHASE_COLLECTION: "stripe_purchase",
		add_event: async (user, type, tags, args) => events.push({ user: user._id, type, args }),
		update_characters: async (user, reason, name, shells) => updates.push({ user: user._id, cash: user.cash, shells }),
	});
	const store = transactions(
		context,
		[owner, referrer, { _id: "CH_Buyer", server: "SR_bank", info: {} }],
		beforeCommit,
	);
	const startSession = context.client.startSession;
	context.client.startSession = () => {
		const session = startSession();
		const start = session.startTransaction,
			commit = session.commitTransaction,
			abort = session.abortTransaction;
		session.clientOptions = { serverSelectionTimeoutMS: 30000, socketTimeoutMS: 0 };
		session.transaction = { state: "NO_TRANSACTION" };
		session.startTransaction = function () {
			this.transaction.state = "TRANSACTION_IN_PROGRESS";
			return start.call(this);
		};
		session.commitTransaction = async function () {
			try {
				await commit.call(this);
				this.transaction.state = "TRANSACTION_COMMITTED";
			} catch (error) {
				if (error.code !== 112) throw error;
				const conflict = new MongoServerError({ message: "write conflict", code: 112 });
				conflict.addErrorLabel("TransientTransactionError");
				throw conflict;
			}
		};
		session.abortTransaction = async function () {
			await abort.call(this);
			this.transaction.state = "TRANSACTION_ABORTED";
		};
		// Exercise the installed driver's retry loop, including its actual error-label handling.
		session.withTransaction = ClientSession.prototype.withTransaction;
		return session;
	};
	const collection = context.db.collection();
	const matches = (doc, query) =>
		doc &&
		Object.entries(query).every(([key, value]) =>
			value && typeof value === "object" && "$lte" in value ? doc[key] <= value.$lte : doc[key] === value,
		);
	const save = (id, doc, session) => {
		if (session) session.pending.set(id, structuredClone(doc));
		else {
			store.records.set(id, structuredClone(doc));
			store.versions.set(id, (store.versions.get(id) || 0) + 1);
		}
	};
	const change = (doc, update) => {
		for (const [operator, fields] of Object.entries(update))
			for (const [key, value] of Object.entries(fields)) {
				const parts = key.split("."),
					last = parts.pop();
				let target = doc;
				for (const part of parts) target = target[part] || (target[part] = {});
				if (operator === "$set") target[last] = structuredClone(value);
				else if (operator === "$inc") target[last] = (target[last] || 0) + value;
				else if (operator === "$unset") delete target[last];
				else throw new Error("unsupported update " + operator);
			}
		return doc;
	};
	context.db.collection = () => ({
		async findOne(query, options = {}) {
			const doc = options.session
				? await collection.findOne(query, options)
				: structuredClone(store.records.get(query._id));
			return matches(doc, query) ? doc : null;
		},
		async insertOne(doc) {
			if (failInsert) throw new Error("database unavailable");
			if (store.records.has(doc._id)) throw Object.assign(new Error("duplicate"), { code: 11000 });
			save(doc._id, doc);
		},
		async updateOne(query, update, options = {}) {
			const doc = await this.findOne(query, options);
			if (!doc) return { matchedCount: 0 };
			save(doc._id, change(doc, update), options.session);
			return { matchedCount: 1 };
		},
		async findOneAndUpdate(query, update) {
			// The lease acquisition itself must be atomic, including when requests arrive together.
			const doc = structuredClone(store.records.get(query._id));
			if (!matches(doc, query)) return null;
			save(doc._id, change(doc, update));
			return structuredClone(doc);
		},
		replaceOne: collection.replaceOne,
		find(query) {
			let docs = [...store.records.values()].filter((doc) => matches(doc, query));
			return {
				sort() {
					docs.sort((a, b) => a.next_attempt - b.next_attempt);
					return this;
				},
				limit(n) {
					docs = docs.slice(0, n);
					return this;
				},
				async toArray() {
					return structuredClone(docs);
				},
			};
		},
	});
	context.stripe = {
		charges: {
			async create(params, options) {
				assert.ok(store.records.has(params.metadata.shell_purchase), "purchase must be durable before charging");
				requests.push({ params: structuredClone(params), options: structuredClone(options) });
				if (charges.has(options.idempotencyKey)) {
					assert.deepEqual(params, requests[0].params, "retries must preserve charge parameters");
					return structuredClone(charges.get(options.idempotencyKey));
				}
				const charge = {
					id: "ch_" + (charges.size + 1),
					amount: params.amount,
					amount_captured: params.amount,
					currency: params.currency,
					metadata: params.metadata,
					livemode: false,
					status: "succeeded",
					paid: true,
					captured: true,
					amount_refunded: 0,
				};
				if (createCharge) await createCharge({ charge, params, options, charges });
				charges.set(options.idempotencyKey, structuredClone(charge));
				return charge;
			},
			async retrieve(id) {
				return structuredClone([...charges.values()].find((charge) => charge.id === id));
			},
			async search(query) {
				searches.push(query);
				return {
					data: structuredClone(
						[...charges.values()].filter((charge) => query.query.includes(charge.metadata.shell_purchase)),
					),
				};
			},
		},
	};
	load(context, "api.js", [
		"purchased_shells_for_usd",
		"grant_stripe_shell_purchase",
		"process_stripe_purchase",
		"retry_stripe_purchases",
		"stripe_payment_api",
	]);
	const request = (overrides = {}) => ({
		user: owner,
		usd: 10,
		response: { id: "tok_fixture", card: { never: "persist this client response" } },
		res: { infs: [] },
		...overrides,
	});
	const purchase = () => [...store.records.values()].find((doc) => doc.state);
	const due = () => {
		purchase().next_attempt = new Date(0);
	};
	return { context, ...store, owner, request, purchase, due, events, updates, charges, requests, searches };
}

test("bank-mounted shell purchases and referral bonuses commit once without changing bank fields", async () => {
	const s = setup(),
		before = structuredClone(s.owner);
	const result = await s.context.stripe_payment_api(s.request());
	assert.equal(result.success, true);
	assert.equal(result.cash, 810);
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.deepEqual(s.records.get("US_buyer").info, before.info);
	assert.equal(s.records.get("US_buyer").server, before.server);
	assert.equal(s.records.get("US_buyer").mounted_to, before.mounted_to);
	assert.equal(s.records.get("US_referrer").cash, 85);
	assert.equal(s.records.get("US_referrer").info.rcash, 83);
	assert.equal(s.records.get("US_referrer").info.referrer_events, 3);
	assert.equal(s.purchase().state, "delivered");
	assert.equal(s.purchase().source, undefined);
	assert.equal(s.purchase().response, undefined);
	assert.equal(s.events.length, 3);
	assert.equal(s.updates[1].cash, 85);
	const again = await s.context.stripe_payment_api(s.request());
	assert.equal(again.already_delivered, true);
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.records.get("US_referrer").cash, 85);
	assert.equal(s.requests.length, 1);
	assert.equal(s.events.length, 3);
});

test("a bank write conflict retries the real MongoDB transaction without charging or crediting twice", async () => {
	let conflicted = false,
		attempts = 0;
	const s = setup({
		beforeCommit({ records, versions, session }) {
			attempts++;
			if (conflicted || !session.pending.has("US_buyer")) return;
			conflicted = true;
			records.get("US_buyer").info.gold = 975;
			versions.set("US_buyer", versions.get("US_buyer") + 1);
		},
	});
	assert.equal((await s.context.stripe_payment_api(s.request())).success, true);
	assert.equal(attempts, 2);
	assert.equal(s.stats.commits, 1);
	assert.equal(s.records.get("US_buyer").info.gold, 975);
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.records.get("US_referrer").cash, 85);
	assert.equal(s.requests.length, 1);
});

test("a bank exit after shell delivery preserves the paid balance using the actual bank handler", async () => {
	const s = setup();
	const player = {
		_id: "Buyer",
		real_id: "CH_Buyer",
		owner: "US_buyer",
		secret: "fixture-bank-session",
		name: "Buyer",
		user: { gold: 900, items0: [] },
		gold: 100,
		items: [{ name: "sword", level: 8 }],
		socket: { id: "Buyer" },
		level: 50,
		s: {},
		slots: {},
	};
	Object.assign(s.context, {
		server_id: "SR_bank",
		init_bank_exit() {},
		update_pids() {},
		server_log() {},
		player_to_server: (p) => p,
		players: {},
		randomStr: () => "fixture-bank-exit",
	});
	s.records.get("CH_Buyer").owner = player.owner;
	s.records.get("CH_Buyer").info.secret = player.secret;
	load(s.context, "node/logic/character_sessions.js", ["owns_character_session", "character_save_tx"]);
	load(s.context, "node/server.js", ["sync_entity", "unmount_call"]);
	await s.context.stripe_payment_api(s.request());
	await s.context.unmount_call(player);
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.records.get("US_buyer").info.gold, 900);
	assert.equal(s.records.get("US_buyer").server, "");
	assert.equal(s.records.get("CH_Buyer").info.gold, 100);
});

test("a failed delivery remains durable and the background job recovers both balances", async () => {
	let unavailable = true;
	const s = setup({
		beforeCommit() {
			if (unavailable) throw new Error("database unavailable");
		},
	});
	assert.equal((await s.context.stripe_payment_api(s.request())).pending, true);
	assert.equal(s.purchase().state, "pending");
	assert.equal(s.purchase().charge_id, "ch_1");
	assert.equal(s.records.get("US_buyer").cash, 10);
	assert.equal(s.records.get("US_referrer").cash, 5);
	assert.equal(s.events.length, 0);
	unavailable = false;
	s.due();
	await s.context.retry_stripe_purchases();
	assert.equal(s.purchase().state, "delivered");
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.records.get("US_referrer").cash, 85);
	assert.equal(s.requests.length, 1);
});

test("a lost Stripe response is recovered by metadata even after the idempotency window", async () => {
	const s = setup({
		createCharge({ charge, charges, options }) {
			charges.set(options.idempotencyKey, structuredClone(charge));
			throw new Error("connection lost after Stripe charged");
		},
	});
	assert.equal((await s.context.stripe_payment_api(s.request())).pending, true);
	assert.equal(s.purchase().charge_id, undefined);
	s.purchase().created = new Date(Date.now() - 48 * 60 * 60 * 1000);
	s.due();
	await s.context.retry_stripe_purchases();
	assert.equal(s.purchase().state, "delivered");
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.searches.length, 1);
	assert.equal(s.requests.length, 1);
});

test("an empty recovery search never causes an old ambiguous purchase to be charged again", async () => {
	const s = setup({
		createCharge() {
			throw new Error("unknown response");
		},
	});
	await s.context.stripe_payment_api(s.request());
	s.purchase().created = new Date(Date.now() - 24 * 60 * 60 * 1000);
	s.due();
	await s.context.retry_stripe_purchases();
	assert.equal(s.purchase().state, "pending");
	assert.equal(s.requests.length, 1);
	assert.equal(s.records.get("US_buyer").cash, 10);
});

test("retries freeze the original shell bonus and reuse the Stripe idempotency key", async () => {
	let fail = true;
	const s = setup({
		createCharge() {
			if (fail) {
				fail = false;
				throw new Error("connection lost before charge");
			}
		},
	});
	await s.context.stripe_payment_api(s.request());
	s.context.extra_shells = 100;
	s.due();
	assert.equal((await s.context.stripe_payment_api(s.request())).success, true);
	assert.equal(s.requests.length, 2);
	assert.deepEqual(s.requests[0], s.requests[1]);
	assert.equal(s.records.get("US_buyer").cash, 810);
});

test("concurrent requests and concurrent deliveries charge and grant only once", async () => {
	const s = setup();
	const results = await Promise.all([
		s.context.stripe_payment_api(s.request()),
		s.context.stripe_payment_api(s.request()),
	]);
	assert.ok(results.some((result) => result.success));
	assert.equal(s.charges.size, 1);
	assert.equal(s.requests.length, 1);
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.events.length, 3);
	// Independently race the atomic grant, as can happen after an expired worker lease.
	const pending = setup({
		beforeCommit() {
			throw new Error("temporary failure");
		},
	});
	await pending.context.stripe_payment_api(pending.request());
	// Reuse the receipt with a fresh store/driver, simulating a worker restart.
	const recovered = setup();
	const receipt = structuredClone(pending.purchase());
	recovered.records.set(receipt._id, receipt);
	const delivered = await Promise.all([
		recovered.context.grant_stripe_shell_purchase(receipt),
		recovered.context.grant_stripe_shell_purchase(receipt),
	]);
	assert.equal(delivered.filter((result) => result.already_delivered).length, 1);
	assert.equal(recovered.records.get("US_buyer").cash, 810);
	assert.equal(recovered.records.get("US_referrer").cash, 85);
});

test("ownership, original amount, and provider confirmation are required", async () => {
	const s = setup();
	await s.context.stripe_payment_api(s.request());
	assert.equal(
		(await s.context.stripe_payment_api(s.request({ user: { _id: "US_other" } }))).reason,
		"invalid_purchase",
	);
	assert.equal((await s.context.stripe_payment_api(s.request({ usd: 25 }))).reason, "invalid_purchase");
	assert.equal(s.requests.length, 1);
	for (const fields of [
		{ amount: 1 },
		{ livemode: true },
		{ metadata: {} },
		{ paid: false },
		{ captured: false },
		{ amount_captured: 1 },
		{ status: "pending" },
		{ amount_refunded: 1 },
	]) {
		const invalid = setup({
			createCharge({ charge }) {
				Object.assign(charge, fields);
			},
		});
		const result = await invalid.context.stripe_payment_api(invalid.request());
		assert.ok(!result.success, JSON.stringify(fields));
		assert.equal(invalid.records.get("US_buyer").cash, 10);
		assert.equal(invalid.records.get("US_referrer").cash, 5);
	}
});

test("declines and database failure before purchase creation never credit shells", async () => {
	const s = setup({
		createCharge() {
			throw Object.assign(new Error("declined"), { type: "StripeCardError" });
		},
	});
	assert.equal((await s.context.stripe_payment_api(s.request())).reason, "card_declined");
	s.due();
	await s.context.retry_stripe_purchases();
	assert.equal(s.purchase().state, "declined");
	assert.equal(s.purchase().source, undefined);
	assert.equal(s.requests.length, 1);
	assert.equal(s.records.get("US_buyer").cash, 10);
	const down = setup({ failInsert: true });
	assert.equal((await down.context.stripe_payment_api(down.request())).pending, true);
	assert.equal(down.requests.length, 0);
});

test("an uncertain commit result retries the commit without running delivery twice", async () => {
	const s = setup();
	const start = s.context.client.startSession;
	let commits = 0;
	s.context.client.startSession = () => {
		const session = start(),
			commit = session.commitTransaction;
		session.commitTransaction = async function () {
			commits++;
			if (commits > 1) return;
			await commit.call(this);
			const error = new MongoServerError({ message: "commit acknowledgement lost", code: 91 });
			error.addErrorLabel("UnknownTransactionCommitResult");
			throw error;
		};
		return session;
	};
	assert.equal((await s.context.stripe_payment_api(s.request())).success, true);
	assert.equal(commits, 2);
	assert.equal(s.stats.commits, 1);
	assert.equal(s.records.get("US_buyer").cash, 810);
	assert.equal(s.records.get("US_referrer").cash, 85);
	assert.equal(s.requests.length, 1);
});

test("provider validation failures finish without background retries", async () => {
	const s = setup({
		createCharge() {
			throw Object.assign(new Error("invalid amount"), { type: "StripeInvalidRequestError" });
		},
	});
	assert.equal((await s.context.stripe_payment_api(s.request())).reason, "payment_failed");
	assert.equal(s.purchase().state, "failed");
	assert.equal(s.purchase().source, undefined);
	await s.context.retry_stripe_purchases();
	assert.equal(s.requests.length, 1);
});

test("the payment UI retries the original purchase and keeps pending payments out of the failed state", async () => {
	const calls = [],
		timers = [],
		messages = [];
	const element = {
		html(text) {
			messages.push(text);
			return this;
		},
		addClass() {
			return this;
		},
	};
	const context = vm.createContext({
		window: {},
		stripe_state: "pay",
		stripe_request: null,
		pamount: 10,
		$: () => element,
		reset_inventory() {},
		p_log() {},
		setTimeout: (fn) => timers.push(fn),
		api_call: async (method, args) => {
			calls.push(structuredClone(args));
			return { pending: true };
		},
	});
	load(context, "js/payments.js", ["stripe_response", "stripe_submit", "stripe_result"]);
	context.stripe_response(200, { id: "tok_fixture", card: { sensitive: "omitted" } });
	await new Promise(setImmediate);
	assert.equal(context.stripe_state, "charge");
	assert.deepEqual(calls[0], { usd: 10, response: { id: "tok_fixture" } });
	context.pamount = 25;
	timers.shift()();
	await new Promise(setImmediate);
	assert.deepEqual(calls[0], calls[1]);
	context.stripe_result("success", 810);
	timers.shift()();
	await new Promise(setImmediate);
	assert.equal(calls.length, 2);
	assert.equal(context.stripe_state, "success");
	assert.ok(!messages.includes("Failed"));
});

test("Stripe recovery is scheduled on the existing cron worker and overlapping ticks are skipped", async () => {
	const intervals = [];
	let release,
		calls = 0;
	const context = vm.createContext({
		process: { env: { pm_id: "0" } },
		Prod: false,
		Staging: false,
		console,
		setTimeout() {},
		setInterval: (fn, ms) => intervals.push({ fn, ms }),
		enforce_limitations() {},
		retry_stripe_purchases: () => {
			calls++;
			return new Promise((resolve) => {
				release = resolve;
			});
		},
	});
	vm.runInContext(read("crons.js").split("setTimeout(enforce_limitations")[0], context);
	const interval = intervals.find(({ fn }) => fn.toString().includes("retry_stripe_purchases"));
	assert.equal(interval.ms, 60000);
	const running = interval.fn();
	await interval.fn();
	assert.equal(calls, 1);
	release();
	await running;
	const next = interval.fn();
	assert.equal(calls, 2);
	release();
	await next;
});
