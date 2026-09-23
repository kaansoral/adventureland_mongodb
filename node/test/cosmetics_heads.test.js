"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const G = require("./helpers/design");
const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const heads = ["cyclops0", "eyehead0", "mimichead0", "slimehead0", "lanternhead0", "lavaglasshead0", "stormhead0"];

function fixture() {
	const replies = [],
		handlers = {};
	const socket = {
		id: "HeadFixture",
		on: (name, fn) => (handlers[name] = fn),
		emit: (event, data) => replies.push({ event, data }),
	};
	const player = { name: "HeadFixture", type: "warrior", skin: "marmor6d", cx: {}, p: { acx: {}, xcx: [] }, socket };
	const T = {};
	for (const def of Object.values(G.sprites))
		if (!def.skip) for (const id of def.matrix.flat()) if (id) T[id] = def.type || "full";
	const math = Object.create(Math);
	const c = vm.createContext({
		G,
		D: G,
		T,
		cxtype_to_slot: G.cxtype_to_slot,
		Math: math,
		console: { log() {} },
		is_array: Array.isArray,
		clone: (value) => JSON.parse(JSON.stringify(value)),
		socket,
		players: { [socket.id]: player },
		resend() {},
		success_response: () => socket.emit("game_response", { place: "cx", success: true }),
		fail_response: (reason) => socket.emit("game_response", { place: "cx", failed: true, reason }),
	});
	const load = (file, name) => {
		const source = read(file),
			start = source.indexOf("function " + name + "(");
		assert(start >= 0, name);
		vm.runInContext(source.slice(start, source.indexOf("\nfunction ", start + 1)), c);
	};
	for (const name of ["all_cx", "map_cx", "prune_cx"]) load("js/old_common_functions.js", name);
	load("node/server_functions.js", "exchange");
	const server = read("node/server.js"),
		start = server.indexOf('\t\tsocket.on("cx",');
	vm.runInContext(server.slice(start, server.indexOf("\n\t\tsocket.on(", start + 1)), c);
	return { c, T, math, player, replies, equip: handlers.cx };
}

test("New Make-up has valid family rewards and seven individual new heads", () => {
	const { T } = fixture();
	assert.equal(G.items.cosmo1.e, 1);
	assert.equal(G.items.cosmo1.cash, 459);
	assert(G.npcs.antip2w.items.includes("cosmo1"));
	assert.equal(G.drops.cosmo1.length, 32);
	const members = [];
	for (const [weight, type, id] of G.drops.cosmo1) {
		assert.equal(weight, 1);
		const family = type === "cxbundle" ? G.cosmetics.bundle[id] : [id];
		assert(family && family.length);
		for (const head of family) {
			assert.equal(T[head], "head", head);
			assert(G.cosmetics.head[head], head + " needs a body mapping");
			for (const skin of G.cosmetics.head[head].slice(0, 3)) assert.equal(T[skin], "skin", skin);
			assert(!G.free_cx.includes(head), head + " is a free starter");
			assert(!["blackhead", "mmakeup13", "mushroomhead0"].includes(head));
			members.push(head);
		}
	}
	assert.equal(new Set(members).size, members.length);
	for (const id of heads) assert(G.drops.cosmo1.some((drop) => drop[1] === "cx" && drop[2] === id));
});

test("head rewards separate anatomy and combine the eight muted soft faces", () => {
	const bundle = JSON.parse(JSON.stringify(G.cosmetics.bundle));
	assert.deepEqual(bundle.headaliens, ["makeup101", "makeup103"]);
	assert.deepEqual(bundle.headorcs, ["makeup129", "fmakeup05"]);
	assert.deepEqual(bundle.headmice, ["makeup124", "makeup126", "mmakeup06", "fmakeup07"]);
	assert.deepEqual(bundle.headwolves, ["makeup137", "makeup139", "fmakeup11"]);
	assert.deepEqual(bundle.headyetis, ["makeup119", "fmakeup08"]);
	assert.deepEqual(bundle.headbones, ["makeup132", "makeup134", "fmakeup12"]);
	for (const [, type, id] of G.drops.cosmo1) {
		assert(
			![
				"headcolors",
				"headcolorsf",
				"headfangs",
				"headhorns",
				"headskulls",
				"headsoftgreen",
				"headsoftpale",
				"headsoftblue",
				"headsoftslate",
			].includes(id),
		);
		if (type === "cxbundle" && /^head(round|soft)/.test(id) && id !== "headsoftmuted")
			assert(bundle[id].length >= 2 && bundle[id].length <= 4);
	}
	assert.deepEqual(bundle.headroundgreen, ["makeup100", "makeup102", "makeup114", "makeup128"]);
	assert.deepEqual(bundle.headsoftbrightgreen, ["nfmakeup12", "nfmakeup13"]);
	assert.deepEqual(bundle.headsoftmuted, [
		"nfmakeup15",
		"nfmakeup16",
		"nfmakeup17",
		"nfmakeup18",
		"nfmakeup19",
		"nfmakeup20",
		"nfmakeup21",
		"nfmakeup22",
	]);
	assert(G.drops.cosmo1.some((d) => d[1] === "cx" && d[2] === "makeup130"));
	assert(G.drops.cosmo1.some((d) => d[1] === "cx" && d[2] === "nfmakeup11"));
});

test("retired head bundles still unlock and equip every previously owned member", () => {
	assert.deepEqual(Array.from(G.cosmetics.bundle.headsoftgreen), ["nfmakeup12", "nfmakeup13", "nfmakeup19"]);
	assert.deepEqual(Array.from(G.cosmetics.bundle.headsoftpale), ["nfmakeup15", "nfmakeup16", "nfmakeup20"]);
	assert.deepEqual(Array.from(G.cosmetics.bundle.headsoftblue), ["nfmakeup17", "nfmakeup18"]);
	assert.deepEqual(Array.from(G.cosmetics.bundle.headsoftslate), ["nfmakeup21", "nfmakeup22"]);
	for (const id of [
		"headcolors",
		"headcolorsf",
		"headfangs",
		"headhorns",
		"headskulls",
		"headsoftgreen",
		"headsoftpale",
		"headsoftblue",
		"headsoftslate",
	]) {
		const { c, player, equip, replies } = fixture();
		player.p.acx[id] = 1;
		for (const head of G.cosmetics.bundle[id]) {
			assert.equal(c.all_cx(player)[head], 1);
			equip({ slot: "head", name: head });
			assert.equal(player.cx.head, head);
			assert.equal(replies.at(-1).data.success, true);
		}
	}
});

test("real exchange rewards and cosmetic equip handler unlock every family member", () => {
	for (let index = 0; index < G.drops.cosmo1.length; index++) {
		const { c, math, player, replies, equip } = fixture();
		math.random = () => (index + 0.5) / G.drops.cosmo1.length;
		c.exchange(player, "cosmo1");
		const [, type, id] = G.drops.cosmo1[index];
		assert.equal(player.p.acx[id], 1);
		assert.equal(replies[0].data.bundle, type === "cxbundle");
		const members = type === "cxbundle" ? G.cosmetics.bundle[id] : [id];
		for (const head of members) {
			assert.equal(c.all_cx(player)[head], 1);
			assert.equal(c.map_cx(player)[head], id);
			equip({ slot: "head", name: head });
			assert.equal(player.cx.head, head);
			assert.equal(replies.at(-1).data.success, true);
		}
	}
});

test("locked heads are rejected and existing bundles keep their exchange behavior", () => {
	const { c, math, player, replies, equip } = fixture();
	equip({ slot: "head", name: "slimehead0" });
	assert.equal(replies.at(-1).data.reason, "cx_not_found");
	assert.equal(player.cx.head, undefined);
	const bundle = G.drops.cosmo0.find((drop) => drop[1] === "cxbundle");
	c.exchange(player, [bundle], { name: "cosmo0" });
	assert.equal(player.p.acx[bundle[2]], 1);
	for (const id of G.cosmetics.bundle[bundle[2]]) assert.equal(c.all_cx(player)[id], 1);
	player.p.acx.headroundbrown = 1;
	math.random = () => 0.02; // First owned set has weight 0.1; the next set has weight 1.
	c.exchange(player, "cosmo1");
	assert.equal(replies.at(-1).data.name, "headroundred");
	assert.equal(G.drops.cosmo1[0][0], 1, "duplicate weighting must not mutate shared drops");
});

test("New Accessory uses five slot tables and every reward equips through the real handlers", () => {
	assert.equal(G.items.cosmo4.e, 1);
	assert.equal(G.items.cosmo4.cash, 1399);
	assert(G.npcs.antip2w.items.includes("cosmo4"));
	const counts = [13, 18, 8, 16, 3],
		slots = ["face", "chin", "makeup", "back", "tail"];
	const all = [];
	assert.equal(G.drops.cosmo4.length, 5);
	G.drops.cosmo4.forEach(([weight, kind, table], branch) => {
		assert.equal(weight, 1);
		assert.equal(kind, "open");
		assert.equal(G.drops[table].length, counts[branch]);
		G.drops[table].forEach(([weight, kind, id], index) => {
			const { c, T, math, player, replies, equip } = fixture();
			assert.equal(weight, 1);
			assert.equal(kind, "cx");
			assert.equal(G.cxtype_to_slot[T[id]], slots[branch]);
			assert(!G.free_cx.includes(id));
			let roll = 0;
			math.random = () => (roll++ ? (index + 0.5) / counts[branch] : (branch + 0.5) / 5);
			c.exchange(player, "cosmo4");
			assert.equal(player.p.acx[id], 1);
			assert.equal(Object.keys(player.p.acx).length, 1);
			const slot = G.cxtype_to_slot[T[id]];
			equip({ slot, name: id });
			assert.equal(player.cx[slot], id);
			assert.equal(replies.at(-1).data.success, true);
			all.push(id);
		});
	});
	assert.equal(new Set(all).size, 58);
});

test("accessory duplicates are suppressed inside the chosen slot without changing its chance", () => {
	const { c, math, player, replies } = fixture();
	player.p.acx.bwglasses = 1;
	let roll = 0;
	math.random = () => (roll++ ? 0.02 : 0.1);
	c.exchange(player, "cosmo4");
	assert.equal(replies.at(-1).data.name, "face100");
	assert.equal(G.drops.cosmo4_face[0][0], 1);
	assert.equal(G.drops.cosmo4[0][0], 1);
});

test("six calibrated hair rewards unlock normally without taking over special-source hair", () => {
	assert.equal(G.drops.cosmo2.length, 128);
	for (let n = 0; n < 6; n++) {
		const id = "hairdo60" + n;
		assert(G.drops.cosmo2.some((d) => d[1] === "cx" && d[2] === id && d[0] === 1));
		assert.deepEqual(Array.from(G.cosmetics.hair[id]), [0, n < 4 ? 1 : 0]);
		const { c, math, player, equip } = fixture();
		const index = G.drops.cosmo2.findIndex((d) => d[2] === id);
		const before = G.drops.cosmo2.slice(0, index).reduce((sum, d) => sum + d[0], 0);
		const total = G.drops.cosmo2.reduce((sum, d) => sum + d[0], 0);
		math.random = () => (before + 0.5) / total;
		c.exchange(player, "cosmo2");
		assert.equal(player.p.acx[id], 1);
		equip({ slot: "hair", name: id });
		assert.equal(player.cx.hair, id);
	}
	for (const id of ["hairdo606", "hairdo607", "hairdo608", "hairdo609"])
		assert(!G.drops.cosmo2.some((d) => d[2] === id));
});

test("the rare halo uses the existing misc exchange and hat equip path", () => {
	assert.deepEqual(Array.from(G.drops.cosmo5.find((d) => d[2] === "halo")), [0.1, "cx", "halo"]);
	assert.equal(G.drops.cosmo5.find((d) => d[2] === "fart")[0], 0.2);
	assert.equal(G.drops.cosmo5.find((d) => d[2] === "xgravestone2")[0], 0.1);
	const { c, math, player, equip } = fixture();
	math.random = () => 0.05 / G.drops.cosmo5.reduce((sum, d) => sum + d[0], 0);
	c.exchange(player, "cosmo5");
	assert.equal(player.p.acx.halo, 1);
	equip({ slot: "hat", name: "halo" });
	assert.equal(player.cx.hat, "halo");
	for (const id of ["marmor10e", "marmor10f", "sbody1a"]) assert(!G.drops.cosmo0.some((d) => d[2] === id));
});

module.exports = { fixture };
