"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createCharacterState } = require("../game/character_state");
const { assertProtocol3Publication } = require("../game/release_readiness");

test("release publication and fresh character remain protocol 3 after world reset", () => {
	const fresh = createCharacterState();
	assert.equal(fresh.total_level, 7);
	assert.deepEqual(Object.keys(fresh.skills), ["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"]);
	assert.deepEqual(
		assertProtocol3Publication({
			protocol: 3,
			skills: fresh.skills,
			abilities: { attack: {} },
		}),
		{ protocol: 3, skillCount: 7, abilityCount: 1 },
	);
	assert.throws(() => assertProtocol3Publication({ protocol: 2, classes: {}, skills: {}, abilities: {} }), {
		code: "WORLD_PUBLICATION",
	});
});

test("release scripts are present and keep reset separate from service startup", () => {
	const root = path.resolve(__dirname, "../../..");
	const reset = fs.readFileSync(path.join(root, "scripts/reset-local-world.sh"), "utf8");
	const verify = fs.readFileSync(path.join(root, "scripts/verify-skill-refactor.sh"), "utf8");
	const service = fs.readFileSync(path.join(root, "scripts/service-server.sh"), "utf8");
	const smoke = fs.readFileSync(path.join(__dirname, "../tools/release-smoke.js"), "utf8");
	assert.match(reset, /--execute/);
	assert.match(reset, /RESET-SKILL-WORLD/);
	assert.doesNotMatch(reset, /systemctl .*stop|kill .*mongod/);
	assert.match(verify, /world-reset|verify-world/);
	assert.match(service, /data\.js/);
	assert.match(service, /verify-publication\.js/);
	assert.match(smoke, /combat_action/);
	assert.match(smoke, /skill_level_up/);
});
