const vm = require("node:vm");
const G = require("./design");
const { load, read } = require("./server_vm");
const targetName = "boar";

// Ordinary attacks round up both the random roll and the defense-adjusted damage.
function averageHit(attack, defense) {
	const low = attack * 0.9,
		high = attack * 1.1;
	let average = 0;
	for (let roll = Math.ceil(low); roll <= Math.ceil(high); roll++) {
		const probability = Math.max(0, Math.min(high, roll) - Math.max(low, roll - 1)) / (high - low);
		average += probability * Math.ceil(roll * G.damage_multiplier(defense));
	}
	return average;
}

// Execute the live stat calculation, not a second copy of the combat formula.
function calculate(type, slots) {
	const context = vm.createContext({
		...G,
		G,
		goldm: 1,
		luckm: 1,
		xpm: 1,
		mode: {},
		parties: {},
		perfc: { cps: 0 },
		recalculate_vxy() {},
	});
	const source = read("node/server.js");
	vm.runInContext(source.slice(source.indexOf("var stat_to_attr ="), source.indexOf("function apply_stats")), context);
	load(context, "node/server.js", ["apply_stats", "calculate_common_stats", "calculate_player_stats"]);
	const player = {
		type,
		level: 50,
		xp: 0,
		gold: 0,
		hp: 1,
		mp: 1,
		items: [],
		citems: [],
		slots,
		s: {},
		p: {},
		map: "main",
		targets_p: 0,
		targets_m: 0,
		targets_u: 0,
		damage_type: G.classes[type].damage_type,
	};
	context.calculate_player_stats(player);
	const target = G.monsters[targetName];
	const defense =
		player.damage_type === "physical"
			? (target.armor || 0) - player.apiercing
			: (target.resistance || 0) - player.rpiercing;
	const hit = averageHit(player.attack, defense);
	return {
		attack: player.attack,
		hit: Math.round(hit * 100) / 100,
		dps: Math.round(((hit * 1000) / player.attack_ms) * 100) / 100,
		interval: player.attack_ms,
		attribute: player[G.classes[type].main_stat],
	};
}

function buildComparisons() {
	const result = { level: 50, target: targetName, classes: {} };
	for (const [type, weapon] of Object.entries({
		warrior: "blade",
		paladin: "mace",
		rogue: "claw",
		ranger: "bow",
		mage: "staff",
		priest: "staff",
	})) {
		const stat = G.classes[type].main_stat;
		const slots = { mainhand: { name: weapon, level: 0 } };
		for (const [slot, name] of Object.entries({
			helmet: "helmet",
			chest: "coat",
			pants: "pants",
			gloves: "gloves",
			shoes: "shoes",
			ring1: stat + "ring",
			ring2: stat + "ring",
			earring1: stat + "earring",
			earring2: stat + "earring",
			amulet: stat + "amulet",
		}))
			slots[slot] = { name, level: 0 };
		const rows = [];
		function row() {
			rows.push({ slots: structuredClone(slots), ...calculate(type, slots) });
		}
		row();
		for (const slot of ["mainhand", "helmet", "chest", "pants", "gloves", "shoes"]) slots[slot].level = 7;
		row();
		for (const slot of ["helmet", "chest", "pants", "gloves", "shoes"]) slots[slot].stat_type = stat;
		row();
		for (const slot of ["ring1", "ring2", "earring1", "earring2", "amulet"]) slots[slot].level = 2;
		row();
		result.classes[type] = { stat, rows };
	}
	return result;
}

module.exports = { calculate, buildComparisons, averageHit };
