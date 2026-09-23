// Public, read-only camera selection for the continuous broadcast. Ordinary
// observers and character-follow observers keep their existing behavior.
function broadcast_observer_enabled(socket) {
	var query = socket.handshake.query || {};
	return query.broadcast === "1" && query.no_graphics !== "1" && !socket.player && !is_pvp && gameplay === "normal";
}

function broadcast_observer_in_town(player) {
	// Inset the fixed 640x360 world-unit shot so counted characters are inside
	// the frame, including the native camera's small vertical offset.
	return (
		player.map === merchant_map &&
		player.in === merchant_map &&
		Math.abs(player.x - merchant_x) <= 288 &&
		Math.abs(player.y - merchant_y) <= 144
	);
}

function broadcast_observer_active(player) {
	if (player.rip) return false;
	if (player.last.attack && ssince(player.last.attack) < 3) return true;
	var channels = player.c || {},
		queues = player.q || {};
	if (
		[channels.fishing, channels.mining].some(function (action) {
			return action && action.ms > 0;
		})
	)
		return true;
	if (player.map !== "tavern") return false;
	if (
		[queues.slots, queues.wheel].some(function (action) {
			return action && action.ms > 0;
		})
	)
		return true;
	for (var id in player.bets) if (player.bets[id].state === "bet") return true;
	// Inspect only participation in the current hand; never send wagers or cards.
	var hand = tavern.poker && tavern.poker.table && tavern.poker.table.hand;
	return !!(
		hand &&
		!hand.over &&
		hand.entries.some(function (seat) {
			return seat.id === player.real_id && !seat.folded && !seat.dc;
		})
	);
}

function update_broadcast_observer(observer, now) {
	var state = observer.broadcast;
	if (!state || observer.player) return;
	var groups = new Map(),
		online = 0,
		town_players = 0;
	for (var id in players) {
		var player = players[id];
		if (player.npc || player.dc) continue;
		online++;
		if (
			player.map !== player.in ||
			!G.maps[player.map] ||
			G.maps[player.map].pvp ||
			!instances[player.in] ||
			is_invis(player) ||
			player.stealth
		)
			continue;
		if (!player.rip && broadcast_observer_in_town(player)) town_players++;
		var key = player.party ? "party:" + player.party : "solo:" + player.name;
		if (!groups.has(key)) groups.set(key, []);
		if (groups.get(key).length < 10) groups.get(key).push(player);
	}
	// Keep the complete public party roster, but feature town residents only
	// through the crowd-qualified square shot, never as an underfilled fallback.
	for (var entry of groups)
		if (
			!entry[1].some(function (player) {
				return !broadcast_observer_in_town(player);
			})
		)
			groups.delete(entry[0]);
	var town_group = "town:" + merchant_map,
		town_ready = town_players >= 6;
	var members = groups.get(state.group);
	var previous = state.group;
	var changed =
		state.next === undefined ||
		(state.group === town_group ? !town_ready : state.group ? !members : groups.size > 0 || town_ready) ||
		now >= state.next;
	if (changed) {
		var choices = Array.from(groups.keys()).filter(function (key) {
			return key !== state.group;
		});
		if (!choices.length && members) choices = [state.group];
		var active = choices.filter(function (key) {
			return groups.get(key).some(broadcast_observer_active);
		});
		if (active.length) choices = active;
		// Three evenly spaced town shots per ten half-minute slots. Use the
		// shared clock so reconnecting or rotating servers cannot reset the mix.
		var time = Date.now(),
			town_slot = [1, 4, 7].indexOf(floor(time / 30000) % 10) !== -1;
		state.group =
			town_ready && (!choices.length || town_slot)
				? town_group
				: choices.length
					? choices[floor(Math.random() * choices.length)]
					: null;
		state.next = now + 30000 - (time % 30000);
		members = groups.get(state.group);
		state.anchor = null;
	}
	var candidates =
		members &&
		members.filter(function (player) {
			return !broadcast_observer_in_town(player);
		});
	var anchor =
		candidates &&
		candidates.find(function (player) {
			return player.name === state.anchor;
		});
	if (!anchor && candidates)
		anchor =
			candidates.find(broadcast_observer_active) ||
			candidates.find(function (player) {
				return !player.rip;
			}) ||
			candidates[0];
	state.anchor = anchor && anchor.name;
	// Keep the nearby group inside the 640x360 world-unit broadcast viewport.
	var focus = anchor
		? members.filter(function (player) {
				return player.in === anchor.in && Math.abs(player.x - anchor.x) <= 230 && Math.abs(player.y - anchor.y) <= 125;
			})
		: [];
	var x = focus.length
		? (Math.min.apply(
				null,
				focus.map(function (p) {
					return p.x;
				}),
			) +
				Math.max.apply(
					null,
					focus.map(function (p) {
						return p.x;
					}),
				)) /
			2
		: merchant_x;
	var y = focus.length
		? (Math.min.apply(
				null,
				focus.map(function (p) {
					return p.y;
				}),
			) +
				Math.max.apply(
					null,
					focus.map(function (p) {
						return p.y;
					}),
				)) /
			2
		: merchant_y;
	var map = anchor ? anchor.map : merchant_map;
	var party = {};
	(members || []).forEach(function (player) {
		party[player.name] = player_to_summary(player);
	});
	var available = !!anchor || state.group === town_group;
	observer.socket.emit("observer_broadcast", {
		group: state.group,
		party: party,
		focus: focus.map(function (p) {
			return p.name;
		}),
		map: map,
		x: x,
		y: y,
		online: online,
		remaining_ms: Math.max(0, state.next - now),
		kind: !available ? "waiting" : anchor ? "group" : "town",
		available: available,
		town_players: town_players,
	});
	if (!available) return;
	if (
		state.group !== previous ||
		observer.in !== map ||
		simple_distance(observer, { in: map, map: map, x: x, y: y }) > 200
	) {
		transport_observer_to(observer, map, map, x, y);
	} else {
		// Moving the subscription also discovers entities entering the viewport.
		observer.push = [observer.x, observer.y];
		observer.x = x;
		observer.y = y;
	}
}

function broadcast_observer_loop() {
	try {
		var now = performance.now();
		for (var id in observers) if (observers[id].broadcast) update_broadcast_observer(observers[id], now);
	} catch (e) {
		log_trace("#X broadcast observer loop error", e);
	}
}
