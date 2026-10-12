"use strict";
// A monster that leaves an instance has to be announced through remove_entity_emit, which notifies
// every client that was told about it. Announcing by position instead - the old xy_emit call - is
// what left phantom entities on screen: a client's copy sits where the last update put it, not
// where the entity was when it went away.
//
// Three separate paths had this bug (death, and two monster relocations), and the third was only
// found by a soak. This walks the source so a fourth cannot be added quietly.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCES = ["server.js", "server_functions.js", "logic/cave_of_many_dreams.js", "logic/generated_maps.js"];

// A monster created and immediately re-keyed within the same statement block was never sent to any
// client, so there is nothing to announce. Keyed by file and by the line's own text.
const CREATED_THEN_REKEYED = [{ file: "logic/cave_of_many_dreams.js", after: "var actor = new_monster(" }];

function lines(file) {
	return fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
}

test("every monster removal is announced through remove_entity_emit", () => {
	const offenders = [];
	for (const file of SOURCES) {
		const src = lines(file);
		for (let i = 0; i < src.length; i++) {
			if (!/delete\s+instances\[[^\]]+\]\.monsters\[/.test(src[i])) continue;
			// wide enough to hold a multi-line remove_entity_emit call above the delete
			const context = src.slice(Math.max(0, i - 14), i + 1).join("\n");
			if (/remove_entity_emit\s*\(/.test(context)) continue;
			const exempt = CREATED_THEN_REKEYED.some((rule) => rule.file === file && context.includes(rule.after));
			if (exempt) continue;
			offenders.push(file + ":" + (i + 1) + "  " + src[i].trim());
		}
	}
	assert.deepEqual(offenders, [], "these remove a monster without telling the clients that had it");
});

test("no removal still announces by position", () => {
	const offenders = [];
	for (const file of SOURCES) {
		const src = lines(file);
		for (let i = 0; i < src.length; i++) {
			const line = src[i];
			if (/^\s*\/\//.test(line)) continue; // commented-out code is not live
			if (/xy_emit\s*\([^)]*["'](disappear|death)["']/.test(line)) {
				offenders.push(file + ":" + (i + 1) + "  " + line.trim());
			}
		}
	}
	assert.deepEqual(offenders, [], "removal must go through remove_entity_emit, not xy_emit");
});

test("remove_entity_emit drives its recipients from what clients were told", () => {
	const src = fs.readFileSync(path.join(ROOT, "server_functions.js"), "utf8");
	const start = src.indexOf("function remove_entity_emit(");
	assert.ok(start > 0, "remove_entity_emit is missing");
	const body = src.slice(start, src.indexOf("\n}", start));
	assert.match(body, /observer\.seen/, "it must consult what each client was told");
	assert.match(body, /for \(var key in table\)/, "it must walk the client tables");
	assert.match(body, /\[players, observers\]/, "it must cover every connected client, not one instance");
});

const { server: context, observer } = require("./helpers/entity_updates");

test("a player's disappearance still reaches their own CODE callback", () => {
	const c = context(),
		player = observer("Caster", 0, 0, "main");
	c.players.Caster = player;
	c.remove_entity_emit(player, "disappear", { id: player.id, invis: true, reason: "invis" });
	assert.deepEqual(player.sent, [["disappear", { id: player.id, invis: true, reason: "invis" }]]);
});

test("a wholesale refresh names the entities it stopped tracking", () => {
	const c = context();
	const near = { id: "near", type: "goo", max_hp: 100, in: "main", x: 10, y: 10 };
	const far = { id: "far", type: "goo", max_hp: 100, in: "main", x: 9000, y: 9000 };
	c.instances.main = { players: {}, monsters: { near, far }, observers: {} };
	const watcher = observer("watcher", 0, 0, "main");

	const first = c.send_all_xy(watcher, { raw: true });
	assert.equal(first.gone, undefined, "nothing was known yet, so nothing was forgotten");
	assert.deepEqual(Object.keys(watcher.seen), ["near"]);
	assert.equal(watcher.seen.near, 1);

	// the client walks away without changing map: it keeps its table, the server replaces its own
	watcher.x = 9000;
	watcher.y = 9000;
	const second = c.send_all_xy(watcher, { raw: true });
	assert.deepEqual(watcher.sent, [["disappear", { id: "near", outside: true }]]);
	assert.equal(second.gone, undefined);
	assert.deepEqual(Object.keys(watcher.seen), ["far"]);

	const third = c.send_all_xy(watcher, { raw: true });
	assert.equal(third.gone, undefined, "nothing changed, so nothing is announced");
});

test("a refresh with no instance still names everything it forgot", () => {
	const c = context();
	const watcher = observer("watcher", 0, 0, "gone_instance");
	watcher.seen = { a: {}, b: {} };
	const data = c.send_all_xy(watcher, { raw: true });
	assert.deepEqual(watcher.sent.map(([, event]) => event.id).sort(), ["a", "b"]);
	assert.equal(data.gone, undefined);
	assert.deepEqual(Object.keys(watcher.seen), []);
});

test("removal reaches a client that holds the entity even after it moved out of range", () => {
	const c = context();
	const monster = { id: "m1", in: "main", x: 9000, y: 9000, is_monster: true };
	c.instances.main = { players: {}, monsters: { m1: monster }, observers: {} };
	const holder = observer("holder", 0, 0, "main"); // was told, entity has since walked away
	holder.seen = { m1: monster };
	const bystander = observer("bystander", 8900, 8900, "main"); // never told, but can see it now
	bystander.seen = {};
	const elsewhere = observer("elsewhere", 0, 0, "cave"); // neither
	elsewhere.seen = {};
	c.players = { a: holder, b: bystander, d: elsewhere };

	c.remove_entity_emit(monster, "death", { id: "m1" });
	assert.deepEqual(holder.sent, [["death", { id: "m1" }]], "the client that has it must be told");
	assert.deepEqual(bystander.sent, [["death", { id: "m1" }]], "so must one whose vision covers it");
	assert.deepEqual(elsewhere.sent, [], "and nobody else");
	assert.equal(holder.seen.m1, undefined, "it is no longer held");
});

test("one client is told exactly once, whether it was told or can see it", () => {
	const c = context();
	const monster = { id: "m1", in: "main", x: 10, y: 10, is_monster: true };
	c.instances.main = { players: {}, monsters: { m1: monster }, observers: {} };
	const both = observer("both", 0, 0, "main");
	both.seen = { m1: monster }; // in range AND previously told
	c.players = { a: both };
	c.remove_entity_emit(monster, "disappear", { id: "m1" });
	assert.equal(both.sent.length, 1);
});

test("a quiet removal reaches only the clients that were told", () => {
	const c = context();
	const monster = { id: "m1", in: "main", x: 10, y: 10, is_monster: true };
	c.instances.main = { players: {}, monsters: { m1: monster }, observers: {} };
	const told = observer("told", 0, 0, "main");
	told.seen = { m1: monster };
	const looking = observer("looking", 20, 20, "main");
	looking.seen = {};
	c.players = { a: told, b: looking };
	c.remove_entity_emit(monster, "disappear", { id: "m1" }, { quiet: true });
	assert.equal(told.sent.length, 1, "a client holding it is always told");
	assert.equal(looking.sent.length, 0, "a quiet removal makes no vision-scoped broadcast");
});

test("spectators are covered, and NPCs are never sent removals", () => {
	const c = context();
	const monster = { id: "m1", in: "main", x: 9000, y: 9000, is_monster: true };
	const npc = observer("npc", 0, 0, "main");
	npc.is_npc = true;
	npc.seen = { m1: monster };
	c.instances.main = { players: { npc }, monsters: { m1: monster }, observers: {} };
	const spectator = observer("spectator", 0, 0, "main");
	spectator.seen = { m1: monster };
	c.observers = { s: spectator };
	c.remove_entity_emit(monster, "death", { id: "m1" });
	assert.equal(spectator.sent.length, 1, "a spectator holds entities too");
	assert.equal(npc.sent.length, 0, "an NPC has no client to tell");
	assert.equal(npc.seen.m1, undefined, "but its own bookkeeping is still cleared");
});
