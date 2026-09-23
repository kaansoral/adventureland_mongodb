const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../js/game.js"), "utf8");
function setup(contexts) {
	const c = vm.createContext({ interaction_contexts: contexts });
	vm.runInContext(
		source.slice(
			source.indexOf("function normalize_interaction_contexts()"),
			source.indexOf("function get_npc_interaction_context("),
		),
		c,
	);
	return c;
}
function guide(key, distance, priority = 3, npc_id = key) {
	return { key, distance, priority, npc_id };
}

test("nearby INFO guides keep their order and signature as NPC distances change", () => {
	const c = setup([guide("merrit", 10), guide("server_services", 20), guide("events", 30)]);
	c.normalize_interaction_contexts();
	const signature = c.interaction_context_signature();
	assert.deepEqual(
		Array.from(c.interaction_contexts, (g) => g.key),
		["events", "merrit", "server_services"],
	);
	c.interaction_contexts = [guide("server_services", 5), guide("merrit", 70), guide("events", 25)];
	c.normalize_interaction_contexts();
	assert.equal(c.interaction_context_signature(), signature, "movement alone must not reorder or redraw the buttons");
	c.interaction_contexts = [guide("merrit", 1), guide("events", 55)];
	c.normalize_interaction_contexts();
	assert.deepEqual(
		Array.from(c.interaction_contexts, (g) => g.key),
		["events", "merrit"],
		"remaining guides keep their relative order",
	);
});

test("guide deduplication still prefers source priority and then the nearest NPC", () => {
	const c = setup([
		guide("shops", 2, 2, "machine"),
		guide("shops", 30, 3, "far"),
		guide("shops", 10, 3, "near"),
		guide("bank", 1, 1, "door"),
	]);
	c.normalize_interaction_contexts();
	assert.deepEqual(
		Array.from(c.interaction_contexts, (g) => g.npc_id),
		["near", "door"],
	);
});
