var skills = {
	warrior: {
		id: "warrior",
		name: "Warrior",
		kind: "combat",
		max_level: 99,
		weapon_types: ["short_sword", "sword", "great_sword", "axe", "spear", "scythe"],
	},
	paladin: {
		id: "paladin",
		name: "Paladin",
		kind: "combat",
		max_level: 99,
		weapon_types: ["hammer", "mace", "pmace", "basher"],
	},
	mage: {
		id: "mage",
		name: "Mage",
		kind: "combat",
		max_level: 99,
		weapon_types: ["staff", "great_staff", "wand", "wblade"],
	},
	priest: {
		id: "priest",
		name: "Priest",
		kind: "combat",
		max_level: 99,
		weapon_types: ["book"],
	},
	ranger: {
		id: "ranger",
		name: "Ranger",
		kind: "combat",
		max_level: 99,
		weapon_types: ["bow", "crossbow", "dartgun"],
	},
	rogue: {
		id: "rogue",
		name: "Rogue",
		kind: "combat",
		max_level: 99,
		weapon_types: ["fist", "dagger", "rapier", "stars"],
	},
	merchant: {
		id: "merchant",
		name: "Merchant",
		kind: "noncombat",
		max_level: 99,
	},
};

if (typeof module !== "undefined") module.exports = { skills: skills };
