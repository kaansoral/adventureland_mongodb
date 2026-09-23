// Monster abilities share the ordinary tick, conditions, attacks and rewards.
module.exports = function ({
	get_game,
	get_player,
	distance,
	is_disabled,
	is_invis,
	is_invinc,
	add_condition,
	calculate_monster_stats,
	commence_attack,
	now,
}) {
	const active = (monster) => monster.type === "rimedjinn" && !!monster.s.rimeshell;
	const config = () => get_game().monsters.rimedjinn.abilities.rimeshell;
	const valid = (monster, player) =>
		player &&
		player.is_player &&
		!player.rip &&
		!player.npc &&
		!is_invis(player) &&
		!is_invinc(player) &&
		player.map === monster.map &&
		player.in === monster.in;
	const publish = (monster) => {
		monster.u = true;
		monster.cid++;
	};
	function finish(monster, broken) {
		delete monster.s.rimeshell;
		delete monster.rime_shell.end;
		if (broken && !monster.dead && monster.hp > 0) {
			add_condition(monster, "rimeexposed", { duration: config().exposed_duration });
			calculate_monster_stats(monster);
		}
		monster.last.attack = now();
		publish(monster);
	}
	function damage(monster, attacker, amount) {
		if (!active(monster) || !attacker?.is_player || attacker.npc || amount <= 0) return;
		if (monster.dead || monster.hp <= 0) return finish(monster, false);
		// A delayed monster tick cannot extend the damage window.
		if (+now() >= monster.rime_shell.end) return;
		monster.s.rimeshell.remaining = Math.max(0, monster.s.rimeshell.remaining - amount);
		if (!monster.s.rimeshell.remaining) finish(monster, true);
		else publish(monster);
	}
	function interrupt(monster) {
		if (!active(monster) || !is_disabled(monster)) return;
		const before_expiry = +now() < monster.rime_shell.end;
		finish(monster, before_expiry && !!(monster.s.stunned || monster.s.deepfreezed));
	}
	function tick(monster, events) {
		if (monster.type !== "rimedjinn") return;
		const def = config();
		if (active(monster)) {
			if (monster.dead || monster.hp <= 0 || !valid(monster, get_player(monster.target))) return finish(monster, false);
			if (is_disabled(monster)) return interrupt(monster);
			const shell = monster.s.rimeshell,
				previous = Math.ceil(shell.ms / 100);
			shell.ms = Math.max(0, monster.rime_shell.end - +now());
			if (shell.ms > 0) {
				if (Math.ceil(shell.ms / 100) !== previous) publish(monster);
				return;
			}
			const participants = Object.entries(monster.points || {})
				.filter(([, points]) => points > 0)
				.map(([name, points]) => ({ player: get_player(name), points }))
				.filter(({ player }) => valid(monster, player) && distance(monster, player) < def.range);
			participants.sort(
				(a, b) =>
					Number(b.player.name === monster.target) - Number(a.player.name === monster.target) ||
					b.points - a.points ||
					String(a.player.id).localeCompare(String(b.player.id)),
			);
			const targets = [...new Map(participants.map(({ player }) => [player.id, player])).values()].slice(
				0,
				def.targets,
			);
			finish(monster, false);
			for (const player of targets) {
				const attack = commence_attack(monster, player, "rimeshatter");
				if (attack?.events?.length) events.push(...attack.events);
			}
			return;
		}
		if (
			monster.rime_shell?.used ||
			monster.dead ||
			monster.hp <= 0 ||
			monster.hp > monster.max_hp * def.threshold ||
			!valid(monster, get_player(monster.target)) ||
			is_disabled(monster)
		)
			return;
		// Keep this private state separate from temp, which disables respawning.
		// last_state carries it through relocation; a fresh spawn starts clean.
		monster.rime_shell = { used: true, end: +now() + def.duration };
		add_condition(monster, "rimeshell", { duration: def.duration });
		monster.s.rimeshell.remaining = Math.ceil(monster.max_hp * def.break_fraction);
		publish(monster);
	}
	return { active, damage, interrupt, tick };
};
