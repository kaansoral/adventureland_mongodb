// Shared server scope. The Tavern's house rule for a restart: the moment the shutdown routine starts, no wager
// begins and every unfinished one goes back to its owner. The wheel and the slots return stakes whose result has
// not been shown, the dice table returns the open round's bets, and the poker table voids its hand and cashes every
// seat out. The gold lands in memory before the shutdown saves the characters, so nothing depends on the countdown.

function tavern_closing() {
	return !!((tavern && tavern.closed) || server.shutdown || !server.live);
}

// The room sees the result, and its owner still receives completion after walking through the door.
function tavern_result(player, data) {
	instance_emit(tavern, "tavern", data);
	if (player.socket && (!tavern.players || tavern.players[player.id] !== player)) player.socket.emit("tavern", data);
}

// The CODE promise behind a refunded wager settles with the reason and the returned gold; the panel logs it too.
function tavern_refund_response(player, place, request_id, gold) {
	if (!player.socket) return;
	if (request_id)
		player.socket.emit("game_response", {
			response: "tavern_closing",
			place: place,
			request_id: request_id,
			failed: true,
			reason: "tavern_closing",
			refund: gold,
		});
	player.socket.emit(
		"game_log",
		localization.message("server.game_log.tavern_refund", { amount: String(to_pretty_num(gold)) }, { color: "gold" }),
	);
}

function tavern_refund_wheel(player) {
	var ref = player.q && player.q.wheel;
	if (!ref) return 0;
	delete player.q.wheel;
	player.gold += ref.gold;
	S.gold -= ref.gold;
	tavern_refund_response(player, "wheel", ref.request_id, ref.gold);
	tavern_result(player, {
		event: "refund",
		type: "wheel",
		name: player.name,
		index: ref.index,
		gold: ref.gold,
	});
	return ref.gold;
}

function tavern_refund_slots(player) {
	var ref = player.q && player.q.slots;
	if (!ref) return 0;
	delete player.q.slots;
	player.gold += ref.cost;
	S.gold -= ref.cost;
	tavern_refund_response(player, "slots", ref.request_id, ref.cost);
	tavern_result(player, {
		event: "refund",
		type: "slots",
		name: player.name,
		symbols: ref.symbols,
		gold: ref.cost,
	});
	return ref.cost;
}

// Dice stakes only reach the house purse at the roll, so the bet simply goes back where it came from.
function tavern_refund_dice(player) {
	var total = 0;
	for (var id in player.bets || {}) {
		var bet = player.bets[id];
		player.gold += bet.gold;
		total += bet.gold;
		tavern_refund_response(player, "dice", bet.request_id, bet.gold);
	}
	player.bets = {};
	if (total) instance_emit(tavern, "tavern", { event: "refund", type: "dice", name: player.name, gold: total });
	return total;
}

// Runs once at the start of the shutdown routine. Each game and each player is handled on its own, so one failure
// cannot keep anyone else's gold on the table.
function tavern_close() {
	if (!instances.tavern || tavern.closed) return;
	tavern.closed = true;
	server_log("tavern: closed for the restart", 1);
	try {
		tavern_poker_shutdown();
	} catch (e) {
		log_trace("#X tavern close poker", e);
	}
	for (var id in players) {
		var player = players[id],
			gold = 0;
		try {
			gold += tavern_refund_wheel(player);
		} catch (e) {
			log_trace("#X tavern close wheel", e);
		}
		try {
			gold += tavern_refund_slots(player);
		} catch (e) {
			log_trace("#X tavern close slots", e);
		}
		try {
			gold += tavern_refund_dice(player);
		} catch (e) {
			log_trace("#X tavern close dice", e);
		}
		if (gold) resend(player, "reopen+nc");
	}
	try {
		instance_emit(tavern, "game_log", localization.message("server.game_log.tavern_closed", {}, { color: "#E6B16B" }));
	} catch (e) {
		log_trace("#X tavern close notice", e);
	}
}

// Refund transactions still running for seats whose owners are gone; the exit waits for them, briefly.
function tavern_pending() {
	return tavern_poker_pending();
}
