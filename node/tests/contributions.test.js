"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ContributionLedger, splitShare } = require("../game/contributions");

test("contributions snapshot style, count effective damage/heal, and conserve split shares", () => {
	let now = 0;
	const ledger = new ContributionLedger({ now: () => now });
	ledger.openEncounter("goo");
	ledger.engage("goo", "char");
	ledger.snapshotAction({ actionId: "attack-1", encounterIds: ["goo"], characterId: "char", activeSkill: "warrior" });
	assert.equal(
		ledger.recordDamage({
			encounterId: "goo",
			actionId: "attack-1",
			characterId: "char",
			amount: 80,
			hpBefore: 100,
			hpAfter: 20,
		}),
		80,
	);
	assert.equal(
		ledger.recordDamage({
			encounterId: "goo",
			actionId: "attack-1",
			characterId: "char",
			amount: 80,
			hpBefore: 20,
			hpAfter: 0,
		}),
		0,
	);
	ledger.snapshotAction({ actionId: "attack-2", encounterIds: ["goo"], characterId: "char", activeSkill: "rogue" });
	assert.equal(
		ledger.recordDamage({
			encounterId: "goo",
			actionId: "attack-2",
			characterId: "char",
			amount: 20,
			hpBefore: 20,
			hpAfter: 0,
		}),
		20,
	);
	const split = ledger.partition(101, "goo", "char");
	assert.equal(
		Object.values(split).reduce((sum, value) => sum + value, 0),
		101,
	);
	assert.deepEqual(Object.keys(split).sort(), ["rogue", "warrior"]);
	assert.deepEqual(splitShare(5, { warrior: 1, rogue: 1, mage: 1 }), { warrior: 2, rogue: 1, mage: 2 });
});

test("support divides one action across encounters and ignores PvP/redundant state", () => {
	const ledger = new ContributionLedger();
	ledger.snapshotAction({ actionId: "support", encounterIds: ["a", "b"], characterId: "char", activeSkill: "warrior" });
	assert.deepEqual(ledger.engagedEncounterIds("char"), []);
	assert.equal(
		ledger.recordSupport({
			actionId: "support",
			characterId: "char",
			activeSkill: "warrior",
			encounterIds: ["a", "b"],
			changed: true,
		}),
		1,
	);
	assert.deepEqual(ledger.engagedEncounterIds("char").sort(), ["a", "b"]);
	assert.equal(ledger.weightsForCharacter("a", "char").warrior, 0.5);
	assert.equal(ledger.weightsForCharacter("b", "char").warrior, 0.5);
	assert.equal(
		ledger.recordSupport({
			actionId: "support",
			characterId: "char",
			activeSkill: "warrior",
			encounterIds: ["a", "b"],
			changed: false,
		}),
		0,
	);
	ledger.snapshotAction({
		actionId: "pvp",
		encounterIds: ["pvp"],
		characterId: "char",
		activeSkill: "warrior",
		kind: "pvp",
	});
	assert.equal(ledger.recordDamage({ encounterId: "pvp", actionId: "pvp", characterId: "char", amount: 100 }), 0);
});

test("action snapshots are immutable and support caps exclude damage weight", () => {
	const ledger = new ContributionLedger();
	ledger.snapshotAction({ actionId: "immutable", encounterIds: ["goo"], characterId: "char", activeSkill: "warrior" });
	assert.throws(
		() =>
			ledger.snapshotAction({
				actionId: "immutable",
				encounterIds: ["goo"],
				characterId: "char",
				activeSkill: "rogue",
			}),
		(error) => error.code === "invalid_contribution",
	);
	ledger.snapshotAction({ actionId: "damage", encounterIds: ["goo"], characterId: "char", activeSkill: "warrior" });
	assert.equal(ledger.recordDamage({ encounterId: "goo", actionId: "damage", characterId: "char", amount: 100 }), 100);
	ledger.snapshotAction({ actionId: "support", encounterIds: ["goo"], characterId: "char", activeSkill: "warrior" });
	assert.equal(
		ledger.recordSupport({
			actionId: "support",
			characterId: "char",
			activeSkill: "warrior",
			encounterIds: ["goo"],
			changed: true,
			weightPerUse: 10,
			maxWeightPerTargetPerEncounter: 10,
		}),
		10,
	);
});

test("an action snapshot makes later healing eligible for its encounter", () => {
	const ledger = new ContributionLedger();
	ledger.snapshotAction({ actionId: "heal-1", encounterIds: ["goo"], characterId: "priest", activeSkill: "priest" });
	assert.deepEqual(ledger.engagedEncounterIds("priest"), []);
	assert.equal(
		ledger.recordHealing({
			actionId: "heal-1",
			characterId: "priest",
			amount: 25,
			currentHp: 50,
			maxHp: 100,
		}),
		25,
	);
	assert.deepEqual(ledger.engagedEncounterIds("priest"), ["goo"]);
	assert.equal(ledger.weightsForCharacter("goo", "priest").priest, 25);
});

test("healing and support retain source attribution and lifecycle cleanup removes participants", () => {
	const ledger = new ContributionLedger();
	ledger.snapshotAction({ actionId: "heal", encounterIds: ["goo"], characterId: "priest", activeSkill: "priest" });
	ledger.recordHealing({ actionId: "heal", characterId: "priest", amount: 10, currentHp: 0, maxHp: 100 });
	ledger.snapshotAction({ actionId: "support", encounterIds: ["goo"], characterId: "paladin", activeSkill: "paladin" });
	ledger.recordSupport({
		actionId: "support",
		characterId: "paladin",
		activeSkill: "paladin",
		changed: true,
	});
	assert.deepEqual(ledger.characterIds("goo").sort(), ["paladin", "priest"]);
	assert.equal(ledger.sourceForCharacter("goo", "priest"), "pve_heal");
	assert.equal(ledger.sourceForCharacter("goo", "paladin"), "pve_support");
	assert.equal(ledger.totalWeight("goo"), 11);
	ledger.removeCharacter("priest");
	assert.deepEqual(ledger.characterIds("goo"), ["paladin"]);
	ledger.removeCharacter("paladin");
	assert.deepEqual(ledger.characterIds("goo"), []);
	assert.deepEqual(ledger.engagedEncounterIds("paladin"), []);
});

test("server award partitions only precomputed character shares and never funds support-only participants", () => {
	const ledger = new ContributionLedger();
	ledger.snapshotAction({ actionId: "damage", encounterIds: ["goo"], characterId: "warrior", activeSkill: "warrior" });
	ledger.recordDamage({ encounterId: "goo", actionId: "damage", characterId: "warrior", amount: 70 });
	ledger.snapshotAction({ actionId: "heal", encounterIds: ["goo"], characterId: "priest", activeSkill: "priest" });
	ledger.recordHealing({ encounterId: "goo", actionId: "heal", characterId: "priest", amount: 30 });
	ledger.snapshotAction({ actionId: "support", encounterIds: ["goo"], characterId: "paladin", activeSkill: "paladin" });
	ledger.recordSupport({ actionId: "support", characterId: "paladin", activeSkill: "paladin", encounterIds: ["goo"], changed: true });

	const partitions = ledger.partitionCharacterShares("goo", { warrior: 700, priest: 300 });
	assert.deepEqual(Object.keys(partitions).sort(), ["priest", "warrior"]);
	assert.equal(Object.values(partitions).flatMap(Object.values).reduce((sum, value) => sum + value, 0), 1000);
	assert.equal(Object.values(partitions.warrior).reduce((sum, value) => sum + value, 0), 700);
	assert.equal(Object.values(partitions.priest).reduce((sum, value) => sum + value, 0), 300);
	assert.equal(partitions.paladin, undefined);
});
