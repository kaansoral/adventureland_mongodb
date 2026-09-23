// Shared server scope. Slots: three reels for one fixed stake. The prize draw is fair by design (the weighted
// prizes average the stake) and the house keeps only its edge from the net win. The prize and the reel stops are
// decided when the stake locks; the payout settles once the reels have stopped, like the wheel.
function tavern_slots_roll(count) {
	return crypto.randomInt(count);
}

function tavern_slots_draw(slots) {
	var roll = tavern_slots_roll(slots.draws),
		sum = 0;
	for (var i = 0; i < slots.prizes.length; i++) {
		sum += slots.prizes[i][2];
		if (roll < sum) return slots.prizes[i];
	}
	return null;
}

// Reel stops that show the drawn prize on the payline, or an honest miss when nothing was won.
function tavern_slots_stops(slots, symbol) {
	var stops = [];
	for (var r = 0; r < slots.reels.length; r++) {
		var reel = slots.reels[r],
			candidates = [];
		for (var i = 0; i < reel.length; i++) if (!symbol || reel[i] == symbol) candidates.push(i);
		stops.push(candidates[tavern_slots_roll(candidates.length)]);
	}
	if (!symbol && stops.every((stop, r) => slots.reels[r][stop] == slots.reels[0][stops[0]]))
		return tavern_slots_stops(slots, symbol);
	return stops;
}

function tavern_slots_bet(player, data, bet_failure, request_id) {
	var slots = G.games.slots,
		cost = slots.gold;
	if (tavern_closing()) return bet_failure("tavern_closing");
	if (player.q.slots) return bet_failure("slots_spinning");
	if (cost > player.gold) return bet_failure("gold_not_enough");
	var edge = house_edge(),
		largest = Math.max.apply(
			null,
			slots.prizes.map(function (prize) {
				return prize[1];
			}),
		),
		liability = largest - cost - ceil((Math.max(0, largest - cost) * edge) / 100);
	// Admission is decided before drawing, so low reserves cannot change the published prize odds.
	if (liability > S.gold - house_debt()) return bet_failure("tavern_gold_not_enough");
	var prize = tavern_slots_draw(slots),
		stops = tavern_slots_stops(slots, prize && prize[0]),
		gross = prize ? prize[1] : 0,
		cut = prize ? ceil((max(0, gross - cost) * edge) / 100.0) : 0;
	player.gold -= cost;
	S.gold += cost;
	player.q.slots = {
		ms: slots.spin,
		cost: cost,
		edge: edge,
		stops: stops,
		symbols: stops.map((stop, r) => slots.reels[r][stop]),
		prize: gross,
		cut: cut,
		payout: gross - cut,
		won: !!prize,
		request_id: request_id,
	};
	player.socket.emit("game_response", { response: "gold_use", gold: cost, game: "slots" });
	xy_emit(player, "ui", { type: "slots", player: player.name, stops: stops, ms: slots.spin });
	resend(player, "u+cid+reopen+nc");
}

function tavern_slots_settle(player, ref, quiet) {
	if (ref.won) {
		player.gold += ref.payout;
		S.gold -= ref.payout;
	}
	if (!S.logs.slots) S.logs.slots = [];
	lstack(S.logs.slots, { name: player.name, gold: ref.payout - ref.cost, symbols: ref.symbols }, 200);
	if (quiet) return;
	if (ref.won) {
		player.socket.emit(
			"game_log",
			localization.message(
				"server.game_log.received_gold",
				{ amount: String(to_pretty_num(ref.payout)) },
				{ color: "gold" },
			),
		);
		if (ref.prize >= 100000000)
			broadcast(
				"server_message",
				localization.message(
					"server.server_message.received_gold",
					{ player: String(player.name), amount: String(to_pretty_num(ref.payout)) },
					{ color: "gold" },
				),
			);
	}
	tavern_result(player, {
		event: ref.won ? "won" : "lost",
		type: "slots",
		name: player.name,
		stops: ref.stops,
		symbols: ref.symbols,
		prize: ref.prize,
		payout: ref.payout,
		gold: ref.cost,
		net: ref.payout - ref.cost,
	});
	if (ref.request_id)
		player.socket.emit("game_response", {
			response: ref.won ? "slots_success" : "slots_fail",
			place: "slots",
			request_id: ref.request_id,
			success: true,
			won: ref.won,
			cost: ref.cost,
			payout: ref.payout,
			net: ref.payout - ref.cost,
			symbols: ref.symbols,
			prize: ref.prize,
			edge: ref.edge,
			cut: ref.cut,
		});
	else player.socket.emit("game_response", ref.won ? "slots_success" : "slots_fail");
	resend(player, "reopen+nc");
}

// A disconnect settles the decided spin at once; the prize was fixed when the stake locked.
function tavern_slots_disconnect(player) {
	if (!player.q || !player.q.slots) return;
	var ref = player.q.slots;
	delete player.q.slots;
	tavern_slots_settle(player, ref, true);
}

// Reserve the decided payout or a shutdown refund. The stake is already in the house purse.
function tavern_slots_debt() {
	var gold = 0;
	for (var id in players) {
		var q = players[id].q;
		if (q && q.slots) gold += Math.max(q.slots.payout, q.slots.cost);
	}
	return gold;
}
