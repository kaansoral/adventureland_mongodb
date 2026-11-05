// Minimum account level for the introductory hunt targets. At 70, the normal
// live-monster selection applies without a target restriction.
const beginner_levels = {
	goo: 1,
	bee: 30,
	crab: 32,
	snake: 34,
	squig: 36,
	armadillo: 40,
	croc: 44,
	tortoise: 48,
	squigtoad: 52,
	bat: 56,
	spider: 64,
};

const blocklist_mtypes = [
	"target_a500",
	"target_a750",
	"target_ar900",
	"target_r500",
	"target_r750",
	"target_ar500red",
];

function account_level(player, players, characters = []) {
	let level = Math.max(player.level, player.max_stats?.level || 0);
	for (const current of Object.values(players)) {
		if (current.owner === player.owner) level = Math.max(level, current.level || 0, current.max_stats?.level || 0);
	}
	// Encouragement already refreshes this bounded snapshot every five minutes.
	// Match the account owner, not other accounts linked to the same platform ID.
	for (const character of characters) {
		if (character.owner === player.owner) level = Math.max(level, character.level || 0);
	}
	if (player.max_stats) player.max_stats.level = level;
	return level;
}

function assign(G, instances, hunted, level) {
	if (level < 30) return { name: "goo", count: 10 };
	let mmax = -1,
		name = "goo",
		the_hp = G.monsters.goo.hp / 1000,
		times = 0;
	for (const id in instances) {
		if (instances[id].name !== id || !G.maps[id] || G.maps[id].irregular) continue;
		for (const mid in instances[id].monsters) {
			const monster = instances[id].monsters[mid];
			if (blocklist_mtypes.includes(monster.type)) continue;
			if (level < 70 && !(beginner_levels[monster.type] <= level)) continue;
			if (monster.level > mmax && !hunted.includes(monster.type) && !monster.target) {
				name = monster.type;
				mmax = monster.level;
				the_hp = monster.max_hp / 1000;
			}
		}
	}
	for (const id in G.maps) {
		if (G.maps[id].irregular || !G.maps[id].monsters) continue;
		for (const spawn of G.maps[id].monsters) if (spawn.type === name) times += spawn.count;
	}
	const cap = level < 70 ? 10 + Math.floor(((level - 30) * 490) / 40) : 500;
	const count = Math.max(
		1,
		Math.min(cap, parseInt((20 * 60 * Math.max(1, times)) / the_hp / (G.monsters[name].respawn + 0.25))),
	);
	return { name, count };
}

module.exports = { account_level, assign };
