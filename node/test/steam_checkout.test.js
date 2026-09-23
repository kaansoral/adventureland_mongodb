const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load } = require("./helpers/server_vm");

const steam_url = "https://checkout.steampowered.com/checkout/approvetxn?transid=77";
const order_id = "12345678901234567890";
const return_token = "a1".repeat(24);
const request = (host) => ({ get: (name) => (name === "host" ? host : "cloudflare.adventure.land") });

test("checkout return URLs change only for the exact Cloudflare hostname", () => {
	const context = vm.createContext({ URL });
	load(context, "api.js", ["steam_web_checkout_url"]);
	const normal = context.steam_web_checkout_url(steam_url, order_id, return_token);
	const return_url = new URL("https://adventure.land/steam-purchase");
	return_url.searchParams.set("order_id", order_id);
	return_url.searchParams.set("token", return_token);
	const expected = new URL(steam_url);
	expected.searchParams.set("returnurl", return_url.toString());
	assert.equal(normal, expected.toString());
	for (const host of [
		undefined,
		"adventure.land",
		"de.adventure.land",
		"adventure.test:8000",
		"cloudflare.adventure.land.example.test",
		"example.test",
	]) {
		assert.equal(context.steam_web_checkout_url(steam_url, order_id, return_token, request(host)), normal);
	}
	assert.equal(context.steam_web_checkout_url(steam_url, order_id, return_token, {}), normal);
	for (const host of ["cloudflare.adventure.land", "CLOUDFLARE.ADVENTURE.LAND:443"]) {
		const checkout = new URL(context.steam_web_checkout_url(steam_url, order_id, return_token, request(host)));
		const returned = new URL(checkout.searchParams.get("returnurl"));
		assert.equal(returned.origin, "https://cloudflare.adventure.land");
		assert.equal(returned.pathname, "/steam-purchase");
		assert.equal(returned.searchParams.get("order_id"), order_id);
		assert.equal(returned.searchParams.get("token"), return_token);
		assert.equal(checkout.searchParams.get("transid"), "77");
	}
	for (const url of [
		"invalid",
		"http://checkout.steampowered.com/",
		"https://checkout.steampowered.com.example.test/",
		"https://example.test/",
	]) {
		for (const host of ["adventure.land", "cloudflare.adventure.land"]) {
			assert.equal(context.steam_web_checkout_url(url, order_id, return_token, request(host)), "");
		}
	}
});

test("the payment-start handler passes the request host without changing the Steam order", async () => {
	for (const host of ["adventure.land", "cloudflare.adventure.land", "adventure.land"]) {
		const writes = [];
		const context = vm.createContext({
			URL,
			console: { log() {} },
			STEAM_SHELL_USD_AMOUNTS: [1, 10, 25, 100, 500],
			STEAM_PURCHASE_COLLECTION: "steam_purchase",
			extra_shells: 0,
			get_domain: async () => ({ tauri: true, language: "en" }),
			verify_tauri_steam_ticket: async () => "76561198000000000",
			get_ip: () => "127.0.0.1",
			insert_steam_purchase: async (user, steam_id, usd, shells) => {
				assert.equal(usd, 10);
				assert.equal(shells, 800);
				return {
					_id: order_id,
					return_token,
					currency: "USD",
					item_id: 777150010,
					amount: 1000,
					shells,
					sandbox: false,
				};
			},
			steam_microtxn_request: async (method, endpoint, data, sandbox) => {
				assert.equal(method, "POST");
				assert.equal(endpoint, "InitTxn/v3");
				assert.equal(data.orderid, order_id);
				assert.equal(data["amount[0]"], 1000);
				assert.equal(data["qty[0]"], 1);
				assert.equal(data.currency, "USD");
				assert.equal(data.usersession, "web");
				assert.equal(sandbox, false);
				return { success: true, params: { steamurl: steam_url, transid: "77" } };
			},
			db: { collection: () => ({ updateOne: async (query, update) => writes.push({ query, update }) }) },
		});
		load(context, "api.js", [
			"steam_checkout_language",
			"purchased_shells_for_usd",
			"steam_web_checkout_url",
			"steam_payment_start_api",
		]);
		const result = await context.steam_payment_start_api({
			user: { platform: "steam", pid: "76561198000000000" },
			usd: 10,
			ticket: "fixture-ticket",
			req: request(host),
		});
		assert.equal(result.success, true);
		assert.equal(result.order_id, order_id);
		assert.equal(result.shells, 800);
		assert.equal(new URL(new URL(result.steam_url).searchParams.get("returnurl")).hostname, host);
		assert.equal(writes.length, 1);
		assert.equal(writes[0].query._id, order_id);
		assert.equal(writes[0].update.$set.state, "initialized");
		assert.equal(writes[0].update.$set.trans_id, "77");
	}
});
