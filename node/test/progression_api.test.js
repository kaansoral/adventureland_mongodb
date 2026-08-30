"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadProgressionApi() {
	const routes = {};
	const items = {
		oldblade: { type: "weapon", wtype: "sword", attack: 10, stat: 1, upgrade: { attack: 2, stat: 1 }, igrade: 0 },
		newblade: { type: "weapon", wtype: "sword", attack: 30, stat: 1, upgrade: { attack: 3, stat: 1 }, igrade: 0 },
		helm: { type: "helmet", max_hp: 20, stat: 2, upgrade: { max_hp: 5, stat: 1 }, igrade: 0 },
		blockedblade: { type: "weapon", wtype: "sword", attack: 100, upgrade: { attack: 10 }, igrade: 0 },
	};
	const player = {
		id: "socket-1",
		real_id: "CH_hero",
		owner: "US_owner",
		cid: 8,
		name: "Hero",
		type: "warrior",
		level: 10,
		xp: 50,
		slots: { mainhand: { name: "oldblade", level: 0 }, helmet: { name: "helm", level: 0 } },
		items: [
			{ name: "newblade", level: 0 },
			{ name: "blockedblade", b: true },
		],
		user: { gold: 1234, items0: [{ name: "newblade", level: 1, l: "l", grace: 2 }, null] },
	};
	const context = {
		AbortController,
		Array,
		Date,
		JSON,
		Math,
		Number,
		Object,
		Set,
		String,
		console,
		crypto,
		require,
		G: {
			items,
			levels: { 10: 1000 },
			classes: {
				warrior: { main_stat: "str", mainhand: { sword: {} }, offhand: {}, doublehand: {} },
			},
		},
		D: { upgrades: [[1, 0.95, 0.8]] },
		character_slots: ["mainhand", "offhand", "helmet"],
		players: { "socket-1": player },
		keys: { ACCESS_MASTER: "master" },
		perfc: { cps: 7 },
		server_api: {
			post(route, handler) {
				routes[route] = handler;
			},
		},
		player_to_server(value) {
			return value;
		},
		calculate_player_stats(value) {
			value.attack = 20;
			value.heal = 0;
			value.frequency = 1;
			value.max_hp = 100;
			value.max_mp = 50;
			value.armor = 0;
			value.resistance = 0;
			value.speed = 40;
			value.str = 10;
			value.dex = 2;
			value.int = 2;
			value.vit = 5;
			value.goldm = 1;
			value.luckm = 1;
			value.xpm = 1;
			value.mp_cost = 1;
			for (const slot of Object.values(value.slots || {})) {
				if (!slot) continue;
				const def = items[slot.name];
				const level = slot.level || 0;
				value.attack += (def.attack || 0) + (def.upgrade && def.upgrade.attack ? def.upgrade.attack * level : 0);
				value.max_hp += (def.max_hp || 0) + (def.upgrade && def.upgrade.max_hp ? def.upgrade.max_hp * level : 0);
				if (slot.stat_type)
					value[slot.stat_type] += (def.stat || 0) + (def.upgrade && def.upgrade.stat ? def.upgrade.stat * level : 0);
			}
			value.attack += value.str;
		},
		can_equip_item(_value, def, slot) {
			if (def.type === "weapon" && slot === "mainhand") return "mainhand";
			return def.type === slot ? slot : "no";
		},
		calculate_item_grade() {
			return 0;
		},
		damage_multiplier(value) {
			return 1 / (1 + Math.max(0, value) / 100);
		},
		log_trace() {},
	};
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, "node/progression_api.js"), "utf8"), context, {
		filename: "node/progression_api.js",
	});
	return { context, player, routes };
}

function routeResponse() {
	return {
		statusCode: 0,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		send(body) {
			this.body = body;
			return this;
		},
	};
}

test("progression analysis ranks reversible equipment and reports risky steps without applying them", () => {
	const { context, player } = loadProgressionApi();
	const original = JSON.stringify({ slots: player.slots, items: player.items });
	const result = context.progression_analyze(player, {
		objective: "damage",
		candidates: [{ source: "bank:items0:0", item: { name: "newblade", level: 1, locked: true } }],
	});

	assert.equal(result.success, true);
	assert.equal(result.policy.read_only, true);
	assert.equal(result.recommendations.equip[0].item.name, "newblade");
	assert.equal(result.recommendations.equip[0].slot, "mainhand");
	assert.ok(result.recommendations.equip[0].improvement_percent > 0);
	assert.ok(result.recommendations.stat_scrolls.some((entry) => entry.slot === "helmet" && entry.stat === "str"));
	assert.ok(
		result.recommendations.upgrades.some(
			(entry) => entry.slot === "mainhand" && entry.risk === "destructive_on_failure",
		),
	);
	assert.equal(JSON.stringify({ slots: player.slots, items: player.items }), original);
});

test("outgoing miss lowers damage without being mistaken for defensive avoidance", () => {
	const { context } = loadProgressionApi();
	const metrics = context.progression_metrics({
		attack: 100,
		frequency: 1,
		miss: 50,
		max_hp: 100,
		max_mp: 100,
		mp_cost: 1,
		armor: 0,
		resistance: 0,
	});
	assert.equal(metrics.damage_per_second, 50);
	assert.equal(metrics.physical_effective_hp, 100);
});

test("progression route requires master authentication and live ownership", () => {
	const { routes } = loadProgressionApi();
	const denied = routeResponse();
	routes["/progression"]({ body: { spass: "wrong", data: "{}" } }, denied);
	assert.equal(denied.statusCode, 403);

	const missing = routeResponse();
	routes["/progression"](
		{
			body: {
				spass: "master",
				data: JSON.stringify({ operation: "analyze", owner: "US_other", character: "CH_hero" }),
			},
		},
		missing,
	);
	assert.equal(missing.statusCode, 404);
});

test("live bank output is bounded to public item fields", () => {
	const { context, player } = loadProgressionApi();
	player.user.items0[0].private_note = "do not expose";
	const result = context.progression_bank_snapshot(player);
	assert.equal(result.source, "live_game_server");
	assert.deepEqual(JSON.parse(JSON.stringify(result.packs.items0[0])), {
		name: "newblade",
		level: 1,
		grace: 2,
		locked: true,
	});
	assert.equal(result.packs.items0[1], null);
});
