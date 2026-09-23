const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const localization = require("../../languages");
const { load } = require("./helpers/server_vm");

test("Steam checkout translates descriptions using supported provider language codes without changing the order", async () => {
	for (const [language, expected] of [
		["tr", "tr"],
		["zh-Hans", "zh-CN"],
		["zh-Hant", "zh-TW"],
		["pt-PT", "pt"],
		["pt-BR", "pt-BR"],
		["es-419", "es-419"],
		["ar", "en"],
		["fil", "en"],
	]) {
		let sent;
		const context = vm.createContext({
			localization,
			STEAM_SHELL_USD_AMOUNTS: [1, 10, 25, 100, 500],
			STEAM_PURCHASE_COLLECTION: "steam_purchase",
			extra_shells: 0,
			get_domain: async () => ({ tauri: true, language }),
			verify_tauri_steam_ticket: async () => "76561198000000000",
			is_admin: () => false,
			get_ip: () => "127.0.0.1",
			insert_steam_purchase: async () => ({
				_id: "fixture-order",
				currency: "USD",
				item_id: 1,
				amount: 1000,
				shells: 800,
			}),
			steam_microtxn_request: async (method, endpoint, data) => {
				sent = { method, endpoint, data };
				return { success: false };
			},
			db: { collection: () => ({ updateOne: async () => ({ matchedCount: 1 }) }) },
		});
		load(context, "api.js", ["steam_checkout_language", "purchased_shells_for_usd", "steam_payment_start_api"]);
		const result = await context.steam_payment_start_api({
			user: { platform: "steam", pid: "76561198000000000" },
			usd: 10,
			ticket: "fixture-ticket",
			req: {},
		});
		assert.equal(result.reason, "steam_purchase_failed");
		assert.equal(sent.data.language, expected);
		assert.equal(sent.data["description[0]"], localization.phrase("server.payment.shells", { count: 800 }, expected));
		assert.equal(sent.data["amount[0]"], 1000);
		assert.equal(sent.data["qty[0]"], 1);
		assert.equal(sent.data["category[0]"], "Shells");
		assert.equal(sent.data.currency, "USD");
	}
});
