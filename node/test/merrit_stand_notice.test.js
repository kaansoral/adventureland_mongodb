"use strict";
const test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("node:fs"),
	path = require("node:path"),
	vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("confirmed stand changes emit Merrit's actual placement reasons; rejected opens do not", () => {
	const shared = {};
	vm.createContext(shared);
	vm.runInContext(read("js/old_common_functions.js"), shared);
	const packets = [],
		order = [];
	const player = {
		owner: "test",
		name: "Shop",
		map: "main",
		in: "main",
		x: 1000,
		y: 0,
		p: {},
		items: [{ name: "stand0" }],
		slots: {},
	};
	const c = {
		G: {
			npcs: { citizen22: { market: require("../../design/npcs").npcs.citizen22.market } },
			items: { stand0: { stand: "stand0" } },
		},
		market_patron_rules: require("../logic/market_patron")(shared.simple_distance),
		instances: { main: { players: { shop: player } } },
		can_add_item: () => true,
		players: { shop: player },
		server_log() {},
		reslot_player() {},
		resend() {
			order.push("player");
		},
		success_response() {},
		fail_response() {},
		socket: {
			id: "shop",
			on(name, fn) {
				this.handler = fn;
			},
			emit(name, data) {
				order.push(name);
				packets.push(data);
			},
		},
	};
	player.socket = c.socket;
	vm.createContext(c);
	vm.runInContext(read("node/logic/market_patron_runtime.js"), c);
	const source = read("node/server.js"),
		start = source.indexOf('socket.on("merchant",');
	vm.runInContext(source.slice(start, source.indexOf('socket.on("imove",', start)), c);
	c.socket.handler({ num: 0 });
	assert.equal(packets[0].stand_opened, true);
	assert.ok(packets[0].reasons.some((r) => r.code === "area"));
	assert.deepEqual(order, ["player", "merrit_status"]);
	c.socket.handler({ close: true });
	assert.equal(packets[1].stand_opened, false);
	c.socket.handler({ num: 9 });
	assert.equal(packets.length, 2, "invalid stand emits no notice");
	player.x = 0;
	c.socket.handler({ num: 0 });
	assert.ok(!packets[2].reasons.some((r) => r.code === "area"));
});

function client() {
	const rendered = [],
		callbacks = [],
		removed = [];
	const c = {
		no_graphics: false,
		no_html: false,
		character: { stand: "stand0" },
		html_escape: (s) => s.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
		clearTimeout() {},
		setTimeout(fn, ms) {
			callbacks.push({ fn, ms });
		},
		$: (selector) => ({
			remove() {
				removed.push(selector);
			},
			prepend(html) {
				rendered.push(html);
			},
			css() {},
			on() {},
			outerHeight: () => 0,
		}),
	};
	vm.createContext(c);
	vm.runInContext(read("js/merrit_stand_notice.js"), c);
	return { c, rendered, callbacks, removed };
}

test("placement notice stays visible and does not repeat each status tick", () => {
	const { c, rendered, callbacks } = client();
	const reasons = [{ code: "npc", name: "Shopkeeper" }, { code: "area" }, { code: "listing" }];
	c.show_merrit_stand_notice({ stand_opened: true, reasons });
	assert.equal(rendered.length, 1);
	assert.match(rendered[0], /Merrit won't stop here/);
	assert.match(rendered[0], /Mainland's square/, "moving to Merrit's area takes priority over local spacing");
	assert.match(rendered[0], /render_merrit_info/);
	assert.match(rendered[0], /How Merrit works/);
	assert.equal(callbacks.length, 0, "placement warning must not expire while the stand is still blocked");
	c.show_merrit_stand_notice({ reasons });
	assert.equal(rendered.length, 1);
	c.show_merrit_stand_notice({ stand_opened: false, reasons });
	c.show_merrit_stand_notice({ stand_opened: true, reasons });
	assert.equal(rendered.length, 2, "opening again can warn again");
	c.show_merrit_stand_notice({ reasons: [{ code: "unreachable" }] });
	assert.match(rendered[2], /open pavement/);
	c.show_merrit_stand_notice({ reasons: [] });
	c.show_merrit_stand_notice({ reasons: [{ code: "unreachable" }] });
	assert.equal(rendered.length, 4, "warn again if a resolved obstruction returns");
});

test("normal waits, missing stock, headless clients and closed stands do not show a placement warning", () => {
	const { c, rendered } = client();
	for (const code of ["warming", "cooldown", "listing", "inventory", "unavailable"])
		c.show_merrit_stand_notice({ reasons: [{ code }] });
	c.no_graphics = true;
	vm.runInContext(read("js/pixi/fake/pixi.min.js"), c);
	c.show_merrit_stand_notice({ stand_opened: true, reasons: [{ code: "area" }] });
	c.no_graphics = false;
	c.character.stand = false;
	c.show_merrit_stand_notice({ reasons: [{ code: "area" }] });
	assert.equal(rendered.length, 0);
});
