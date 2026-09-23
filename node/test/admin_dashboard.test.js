const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const nunjucks = require("../../node_modules/nunjucks");
const source = fs.readFileSync(path.resolve(__dirname, "../../admin_dashboard.js"), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function runtime(overrides = {}) {
	const routes = {};
	const context = vm.createContext({
		console,
		Date,
		URL,
		AbortController,
		setTimeout,
		clearTimeout,
		Prod: false,
		keys: {},
		app: {
			get: (path, handler) => (routes["GET " + path] = handler),
			post: (path, handler) => (routes["POST " + path] = handler),
		},
		get_user: async () => ({ admin: true }),
		is_admin: (user) => !!(user && user.admin),
		get_domain: async () => ({ v: 1 }),
		nunjucks,
		...overrides,
	});
	vm.runInContext(source, context);
	return { context, routes };
}

function response() {
	return {
		statusCode: 200,
		headers: {},
		status(value) {
			this.statusCode = value;
			return this;
		},
		set(name, value) {
			this.headers[name] = value;
			return this;
		},
		send(value) {
			this.body = value;
			return this;
		},
	};
}

const gameRow = {
	primary_appid: 777150,
	line_item_type: "Package",
	package_sale_type: "Steam",
	currency: "USD",
	country_code: "US",
	platform: "Windows",
	gross_units_sold: 1,
	net_units_sold: 1,
	gross_sales_usd: "8.9900",
	net_sales_usd: "8.9900",
};

test("40% discounts use Steam's final revenue without applying the discount twice", () => {
	const { context } = runtime();
	const result = context.admin_summarize_financial_documents([
		{
			discounts: [
				{ combined_discount_id: 12, combined_discount_name: "Programming Fest", total_discount_percentage: 40 },
			],
			rows: [
				{ ...gameRow, combined_discount_id: 12, base_price: "1499", sale_price: "899" },
				{ ...gameRow, gross_sales_usd: "14.9900", net_sales_usd: "14.9900" },
				{ ...gameRow, primary_appid: 123, combined_discount_id: 12 },
			],
		},
	]);
	assert.ok(Math.abs(result.game.net_usd - 23.98) < 0.00001);
	assert.equal(result.discounts["Programming Fest (40% off)"], 8.99);
	assert.equal(result.game.net_units, 2);
});

test("discount labels handle missing metadata and refunds without altering reported totals", () => {
	const { context } = runtime();
	const result = context.admin_summarize_financial_documents([
		{
			rows: [
				{ ...gameRow, base_price: "1499", sale_price: "899" },
				{
					...gameRow,
					combined_discount_id: 33,
					total_discount_percentage: 40,
					net_sales_usd: "-8.9900",
					net_units_sold: -1,
				},
				{ ...gameRow, line_item_type: "MicroTxn", appid: 777150, net_sales_usd: "5.0000" },
			],
		},
	]);
	assert.equal(result.discounts["Sale (40% off)"], 8.99);
	assert.equal(result.discounts["Discount 33 (40% off)"], -8.99);
	assert.equal(result.game.net_usd, 0);
	assert.equal(result.microtransactions.net_usd, 5);
});

test("financial refresh preserves complete discount metadata across report pages", async () => {
	const writes = [],
		calls = [];
	const { context } = runtime({ db: { collection: () => ({ replaceOne: async (...args) => writes.push(args) }) } });
	context.admin_steam_get = async (...args) => {
		calls.push(args[4]);
		return calls.length === 1
			? { results: [{ ...gameRow, combined_discount_id: 12 }], max_id: "123" }
			: {
					results: [],
					combined_discount_info: [
						{ combined_discount_id: 12, combined_discount_name: "Sale", total_discount_percentage: 40 },
						{ combined_discount_id: 99 },
					],
					max_id: "123",
				};
	};
	await context.admin_fetch_financial_date("test-key", "2026-09-10");
	assert.deepEqual(
		calls.map((call) => call.highwatermark_id),
		["0", "123"],
	);
	assert.equal(writes.length, 1);
	assert.equal(writes[0][1].discounts.length, 1);
	assert.equal(writes[0][1].discounts[0].total_discount_percentage, 40);
});

test("dashboard renders after refreshing stale Steam data", async () => {
	const { context, routes } = runtime();
	let refreshed = false;
	context.admin_refresh_steam_data = async (options) => {
		assert.equal(options.financial_batch, 3);
		await Promise.resolve();
		refreshed = true;
	};
	context.admin_get_dashboard = async () => {
		assert.equal(refreshed, true);
		return {};
	};
	context.nunjucks = { render: () => "fresh dashboard" };
	const res = response();
	await routes["GET /admin"]({ query: {} }, res);
	assert.equal(res.body, "fresh dashboard");
});

test("signups use bounded projections, stable pagination and current character records", async () => {
	const users = Array.from({ length: 51 }, (_, i) => ({
		_id: "US_" + String(100 - i),
		name: "User" + i,
		created: new Date("2026-09-10T12:00:00Z"),
		last_online: new Date("2026-09-10T12:00:00Z"),
		email: ["user" + i + "@example.test"],
		info: { email: "current@example.test", country: "TR", auths: ["never-render"], items0: [{ name: "sword" }] },
		password: "never-render",
	}));
	const chars = [
		{
			owner: "US_100",
			name: "wizard",
			info: { name: "Wizard", map: "cave", items: ["never-render"] },
			type: "mage",
			level: 12,
			last_online: new Date("2026-09-10T13:00:00Z"),
		},
	];
	const queries = [];
	const { context } = runtime({
		db: {
			collection: (name) => ({
				find: (query, options) => {
					const entry = { name, query, options };
					queries.push(entry);
					const cursor = {
						sort: (value) => {
							entry.sort = value;
							return cursor;
						},
						limit: (value) => {
							entry.limit = value;
							return cursor;
						},
						toArray: async () => (name === "user" ? users : chars),
					};
					return cursor;
				},
			}),
		},
	});
	const before = context.admin_users_cursor("1789128000000:US_abc");
	const result = await context.admin_get_users("all", before);
	assert.equal(queries.length, 2);
	assert.deepEqual(plain(queries[0].sort), { created: -1, _id: -1 });
	assert.equal(queries[0].limit, 51);
	assert.equal(queries[0].query.$or[1]._id.$lt, "US_abc");
	assert.equal(queries[1].query.owner.$in.length, 50);
	assert.equal(queries[1].limit, 2000);
	for (const entry of queries) {
		assert.equal(entry.options.maxTimeMS, 5000);
		assert.equal(entry.options.projection.info, undefined);
		assert.equal(entry.options.projection.password, undefined);
	}
	assert.equal(result.users.length, 50);
	assert.deepEqual(plain(result.users[0].characters), [{ name: "Wizard", type: "mage", level: "12", map: "cave" }]);
	assert.equal(result.users[0].last_seen, "2026-09-10 13:00 UTC");
	assert.equal(result.users[1].characters.length, 0);
	assert.ok(result.next.endsWith(encodeURIComponent("1789041600000:US_51")));
	assert.ok(!JSON.stringify(result).includes("never-render"));
});

test("empty signups skip the character query and expose no older page", async () => {
	let calls = 0;
	const cursor = {
		sort() {
			return this;
		},
		limit() {
			return this;
		},
		toArray: async () => [],
	};
	const { context } = runtime({
		db: {
			collection: (name) => {
				calls++;
				assert.equal(name, "user");
				return { find: () => cursor };
			},
		},
	});
	const result = await context.admin_get_users("1", null);
	assert.equal(calls, 1);
	assert.equal(result.next, "");
	assert.equal(result.users.length, 0);
});

test("admin routes reject unauthorized readers before data access", async () => {
	const { routes } = runtime({
		get_user: async () => null,
		get_domain: () => {
			throw new Error("must not run");
		},
	});
	for (const route of ["GET /admin", "GET /admin/users", "POST /admin/refresh"]) {
		const res = response();
		await routes[route]({ query: {} }, res);
		assert.equal(res.statusCode, 403);
		assert.equal(res.headers["Cache-Control"], "no-store");
	}
});

test("signup route rejects malformed cursors and fails closed on query errors", async () => {
	const { routes, context } = runtime();
	for (const before of ["$where", {}, ["1:US_a"], "NaN:US_a", "1:other", "9999999999999999:US_a"]) {
		const res = response();
		await routes["GET /admin/users"]({ query: { before } }, res);
		assert.equal(res.statusCode, 400);
	}
	context.admin_get_users = async () => {
		throw new Error("private database detail");
	};
	context.console = { error() {} };
	const res = response();
	await routes["GET /admin/users"]({ query: {} }, res);
	assert.equal(res.statusCode, 503);
	assert.ok(!res.body.includes("private database detail"));
});

test("signup page escapes account and character fields and keeps the two-line layout", () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.resolve(__dirname, "../..")), {
		autoescape: true,
	});
	const html = env.render("htmls/admin_users.html", {
		domain: { title: "Users" },
		signups: {
			range: "30",
			users: [
				{
					name: "<script>bad()</script>",
					email: '<img onerror="bad()">',
					characters: [{ name: "<Wizard>", type: "mage", level: "12", map: "cave" }],
				},
			],
		},
	});
	assert.ok(html.includes("&lt;script&gt;bad()&lt;/script&gt;"));
	assert.ok(!html.includes("<script>"));
	assert.match(html, /class="user-info"/);
	assert.match(html, /class="user-characters"/);
	assert.match(html, /&lt;Wizard&gt;/);
	assert.match(html, /noindex, nofollow/);
});
