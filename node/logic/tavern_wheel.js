// Shared server scope. Fortune's Wheel: an even-money spin on one side of the Tavern wheel.
// The slice is decided when the wager locks; the payout settles once the wheel stops, like the slots queue.
function tavern_wheel_roll(count) {
	return crypto.randomInt(count);
}

function tavern_wheel_side_phrase(side) {
	return { phrase: "interface.wheel." + side };
}

function tavern_wheel_bet(player, data, bet_failure, request_id) {
	var wheel = G.games.wheel;
	var side = "" + (data.side || "");
	if (tavern_closing()) return bet_failure("tavern_closing");
	if (!in_arr(side, wheel.sides)) return bet_failure("wheel_side");
	if (player.q.wheel) return bet_failure("wheel_spinning");
	var gold = max(wheel.min, min(parseInt(data.gold) || 0, 100000000000));
	var edge = house_edge();
	var cut = ceil((gold * edge) / 100.0);
	var net = gold - cut;
	if (gold > player.gold) return bet_failure("gold_not_enough");
	if (net > (S.gold - house_debt()) * 0.4) return bet_failure("tavern_gold_not_enough");
	var index = tavern_wheel_roll(wheel.slices.length);
	var slice = wheel.slices[index];
	player.gold -= gold;
	S.gold += gold;
	player.q.wheel = {
		ms: wheel.spin,
		side: side,
		gold: gold,
		cut: cut,
		net: net,
		edge: edge,
		index: index,
		slice: slice[0],
		result: slice[1],
		won: slice[1] == side,
		request_id: request_id,
	};
	player.socket.emit(
		"game_log",
		localization.message(
			"server.game_log.wheel_bet",
			{ side: tavern_wheel_side_phrase(side), amount: String(to_pretty_num(gold)) },
			{ color: "white" },
		),
	);
	xy_emit(player, "ui", { type: "wheel", player: player.name, side: side, index: index, ms: wheel.spin });
	resend(player, "u+cid+reopen+nc");
}

function tavern_wheel_settle(player, ref, quiet) {
	var payout = ref.won ? ref.gold * 2 - ref.cut : 0;
	if (ref.won) {
		player.gold += payout;
		S.gold -= payout;
	}
	if (!S.logs.wheel) S.logs.wheel = [];
	lstack(
		S.logs.wheel,
		{ name: player.name, gold: ref.won ? ref.net : -ref.gold, side: ref.side, slice: ref.slice },
		200,
	);
	if (quiet) return;
	player.socket.emit(
		"game_log",
		localization.message(
			ref.won ? "server.game_log.wheel_won" : "server.game_log.wheel_lost",
			{ side: tavern_wheel_side_phrase(ref.result), amount: String(to_pretty_num(ref.won ? ref.net : ref.gold)) },
			{ color: ref.won ? "gold" : "gray" },
		),
	);
	tavern_result(player, {
		event: ref.won ? "won" : "lost",
		type: "wheel",
		name: player.name,
		side: ref.side,
		result: ref.result,
		slice: ref.slice,
		index: ref.index,
		gold: ref.gold,
		net: ref.won ? ref.net : -ref.gold,
		payout: payout,
	});
	if (ref.request_id)
		player.socket.emit("game_response", {
			response: "data",
			place: "wheel",
			request_id: ref.request_id,
			success: true,
			won: ref.won,
			side: ref.side,
			result: ref.result,
			slice: ref.slice,
			wager: ref.gold,
			payout: payout,
			net: ref.won ? ref.net : -ref.gold,
			edge: ref.edge,
		});
	resend(player, "reopen+nc");
}

// A disconnect settles the decided spin at once; the result was fixed when the wager locked.
function tavern_wheel_disconnect(player) {
	if (!player.q || !player.q.wheel) return;
	var ref = player.q.wheel;
	delete player.q.wheel;
	tavern_wheel_settle(player, ref, true);
}

// Reserve the decided payout or a shutdown refund. The stake is already in the house purse.
function tavern_wheel_debt() {
	var gold = 0;
	for (var id in players) {
		var q = players[id].q;
		if (q && q.wheel) gold += q.wheel.won ? q.wheel.gold * 2 - q.wheel.cut : q.wheel.gold;
	}
	return gold;
}
