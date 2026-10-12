// Shared server scope. Venn, the Hold'em dealer, stands behind the Tavern's poker table. While the table waits he
// performs for whoever is nearby: a shuffle, a mock deal to the empty seats, a card flourish, a teasing line or a
// small dance. During a hand he announces the deal, an all in and the pot. Everything is visual; the server picks
// each act so every viewer sees the same one, and the client draws it (js/tavern_poker.js, poker_dealer_act).

var tavern_dealer_emotes = ["wiggle", "headwiggle", "joy", "jump"];

function tavern_dealer_npc() {
	for (var id in npcs) if (npcs[id].ntype == "pokerdealer" && npcs[id].in == "tavern" && !npcs[id].rip) return npcs[id];
	return null;
}

function tavern_dealer_pick(list) {
	return list[Math.floor(Math.random() * list.length)];
}

// Someone other than an NPC close enough to watch the show.
function tavern_dealer_audience(npc) {
	var instance = instances[npc.in];
	if (!instance) return false;
	for (var id in instance.players) {
		var player = instance.players[id];
		if (player.npc || player.is_npc || player.dc) continue;
		if (Math.abs(player.x - npc.x) < 360 && Math.abs(player.y - npc.y) < 260) return true;
	}
	return false;
}

function tavern_dealer_act(npc, data) {
	xy_emit(npc, "citizen", Object.assign({ type: "dealer", id: npc.id }, data));
}

// A line from one of the dealer's pools (says, idle, invite, deal, allin, win, split), by index so every language
// shows its own translation of the same line.
function tavern_dealer_say(npc, pool, extra) {
	var def = G.npcs[npc.ntype],
		lines = def && def[pool];
	if (!lines || !lines.length) return;
	tavern_dealer_act(
		npc,
		Object.assign({ act: "say", line: pool + "." + Math.floor(Math.random() * lines.length) }, extra || {}),
	);
}

function tavern_dealer_card() {
	var poker = G.games.poker;
	return tavern_dealer_pick(poker.ranks) + "_" + tavern_dealer_pick(poker.suits);
}

// Called from citizen_behavior_loop on every NPC tick; a new act every 7 to 12 seconds while someone watches.
function tavern_dealer_loop(npc, now_date) {
	var now = +now_date;
	if (!npc.dealer_next) npc.dealer_next = now + 5000;
	if (now < npc.dealer_next) return true;
	npc.dealer_next = now + 7000 + Math.floor(Math.random() * 5000);
	if (!tavern_dealer_audience(npc) || tavern_closing()) return true;
	var table = tavern.poker && tavern.poker.table,
		hand = table && table.hand,
		empty = [],
		seated = 0;
	for (var i = 0; i < G.games.poker.seats; i++) {
		if (table && table.seats[i]) seated++;
		else empty.push(i);
	}
	if (hand && !hand.over) return true; // the real hand is the show
	if (seated >= 2) {
		tavern_dealer_act(npc, { act: "shuffle" });
		return true;
	}
	var roll = Math.random();
	if (seated == 1) {
		if (roll < 0.45) tavern_dealer_say(npc, "invite");
		else if (roll < 0.75) tavern_dealer_act(npc, { act: "mock", seats: empty });
		else tavern_dealer_act(npc, { act: "shuffle" });
		return true;
	}
	if (roll < 0.25) tavern_dealer_act(npc, { act: "mock", seats: empty });
	else if (roll < 0.45) tavern_dealer_act(npc, { act: "shuffle" });
	else if (roll < 0.65) tavern_dealer_act(npc, { act: "flourish", card: tavern_dealer_card() });
	else if (roll < 0.9) {
		tavern_dealer_say(npc, "idle");
		if (Math.random() < 0.35)
			tavern_dealer_act(npc, { act: "emote", emote: tavern_dealer_pick(tavern_dealer_emotes), delay: 1400 });
	} else tavern_dealer_act(npc, { act: "emote", emote: tavern_dealer_pick(tavern_dealer_emotes) });
	return true;
}

// Hand announcements from the poker table: "deal", "allin" (once per hand), "win" with the winner's name, "split".
function tavern_dealer_announce(kind, extra) {
	var npc = tavern_dealer_npc();
	if (!npc) return;
	var hand = tavern.poker && tavern.poker.table && tavern.poker.table.hand;
	if (kind == "allin") {
		if (!hand || npc.dealer_allin == hand.n) return;
		npc.dealer_allin = hand.n;
	}
	tavern_dealer_say(npc, kind, extra);
	npc.dealer_next = Math.max(npc.dealer_next || 0, Date.now() + 6000);
}
