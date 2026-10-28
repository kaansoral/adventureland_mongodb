// Halloween events beside Mr. Pumpkin and Mr. Green. The Headless Horseman rides through the
// Franky/Ice Golem loop in server_functions.js; this file runs Graveyard Rising and Trick or Treat.
// Both stop with the season (design/event_flags.js); saved Parcels and recipes stay usable.

// The character's own status for today's events, sent with the character when it logs in.
function event_player_status(player) {
	witch_cipher_reload(player);
	if (events.halloween) player.trickortreat = trick_or_treat_status(player);
}

// Halloween's last moment: its encounters end with it, as a restart would remove them.
function halloween_season_end() {
	if (graveyard) graveyard_finish("over");
	var sweep = function () {
		for (var name in instances)
			for (var id in instances[name].monsters) {
				var monster = instances[name].monsters[id];
				if (["horseman", "jackowalker", "mrpumpkin", "mrgreen", "slenderman"].includes(monster.type))
					remove_monster(monster, { method: "disappear" });
			}
	};
	sweep();
	setTimeout(sweep, 1000); // a stuck monster is recreated half a second after its removal
	events.horseman = false;
	["horseman", "mrpumpkin", "mrgreen", "slenderman"].forEach(function (type) {
		delete E[type];
		delete timers[type];
	});
}

// ---------- Graveyard Rising ----------
// Every two hours, three waves of Zombies and Ghouls rise in Spooky Town's graveyard, then the
// Gargoyle wakes. Wave monsters are cooperative, and the points everyone earned on them carry
// over to the Gargoyle, so the whole fight counts toward its reward. Monsters are tracked by id:
// a stuck monster is recreated as a new object with the same id and points.

var graveyard = null;
var GRAVEYARD_ZOMBIE_SKINS = ["zombie", "zombie1", "zombie2", "zombie3", "zombie4", "zombie5", "zombie6", "zombie7"];

function graveyard_public() {
	if (!graveyard) return undefined;
	var rules = G.events.graveyard,
		gargoyle = graveyard.gargoyle;
	var data = {
		live: true,
		map: "spookytown",
		x: rules.gargoyle[0],
		y: rules.gargoyle[1],
		start: graveyard.start,
		wave: graveyard.wave,
		waves: rules.waves.length,
		left: graveyard.ids.length,
	};
	if (gargoyle)
		Object.assign(data, {
			gargoyle: true,
			hp: gargoyle.hp,
			max_hp: gargoyle.max_hp,
			target: gargoyle.target,
			end: graveyard.gargoyle_end,
		});
	return data;
}

function graveyard_tell(id, args) {
	if (!instances.spookytown) return;
	instance_emit("spookytown", "game_log", localization.message(id, args || {}, { color: "#9FA3A8" }));
}

function graveyard_start(occurrence) {
	if (!instances.spookytown) return;
	graveyard = { id: occurrence.id, start: Date.now(), wave: 0, ids: [], points: {}, gargoyle: null };
	events.graveyard = true;
	var rules = G.events.graveyard;
	broadcast("server_message", localization.message("server.graveyard.started", {}, { color: "#9FA3A8" }));
	broadcast("game_event", { name: "graveyard", map: "spookytown", x: rules.gargoyle[0], y: rules.gargoyle[1] });
	graveyard_tick();
}

function graveyard_spawn(type) {
	var grave = random_one(G.events.graveyard.graves);
	var monster = new_monster("spookytown", {
		type: type,
		boundary: [grave[0] - 3, grave[1] - 3, grave[0] + 3, grave[1] + 3],
		count: 1,
		special: true,
	});
	if (!monster) return;
	if (type == "zombie") monster.skin = random_one(GRAVEYARD_ZOMBIE_SKINS);
	monster.s.rising = { ms: 1500 }; // the client plays the rise from the ground
	monster.u = true;
	monster.cid++;
	graveyard.ids.push(monster.id);
}

// Called with every monster award, before the rewards: a fallen wave monster's points count toward
// the Gargoyle at once, even when the Gargoyle falls in the same second.
function graveyard_fallen(monster) {
	if (!graveyard || monster.map != "spookytown") return;
	if (graveyard.gargoyle && monster.id === graveyard.gargoyle.id) return void (graveyard.defeated = true);
	var index = graveyard.ids.indexOf(monster.id);
	if (index == -1) return;
	graveyard.ids.splice(index, 1);
	for (var name in monster.points || {}) {
		graveyard.points[name] = (graveyard.points[name] || 0) + monster.points[name];
		if (graveyard.gargoyle)
			graveyard.gargoyle.points[name] = (graveyard.gargoyle.points[name] || 0) + monster.points[name];
	}
	graveyard.changed = true;
}

function graveyard_finish(outcome) {
	var instance = instances.spookytown;
	// Waves still standing leave with the round, so unattended rounds cannot pile up. The second
	// sweep catches a stuck monster that was being recreated.
	if (graveyard && instance) {
		var ids = graveyard.ids.concat(graveyard.gargoyle ? [graveyard.gargoyle.id] : []);
		var sweep = function () {
			ids.forEach(function (id) {
				var monster = instance.monsters[id];
				if (monster && !monster.dead) remove_monster(monster, { method: "disappear" });
			});
		};
		sweep();
		setTimeout(sweep, 1000);
	}
	broadcast(
		"server_message",
		localization.message(
			outcome == "defeated" ? "server.graveyard.defeated" : "server.graveyard.over",
			{},
			{ color: "#9FA3A8" },
		),
	);
	graveyard = null;
	events.graveyard = false;
	delete E.graveyard;
	broadcast_e();
}

function graveyard_tick() {
	if (!graveyard) return;
	var rules = G.events.graveyard,
		now = Date.now(),
		change = false,
		instance = instances.spookytown;
	if (!instance) return graveyard_finish("over");
	if (graveyard.changed) {
		// wave monsters fell (graveyard_fallen)
		graveyard.changed = false;
		change = true;
	}
	while (graveyard.wave < rules.waves.length && now - graveyard.start >= rules.waves[graveyard.wave][0] * 1000) {
		var wave = rules.waves[graveyard.wave][1];
		for (var type in wave) for (var i = 0; i < wave[type]; i++) graveyard_spawn(type);
		graveyard.wave++;
		graveyard_tell("server.graveyard.wave", { wave: graveyard.wave, waves: rules.waves.length });
		change = true;
	}
	var gargoyle = graveyard.gargoyle;
	if (
		!gargoyle &&
		graveyard.wave >= rules.waves.length &&
		(!graveyard.ids.length || now - graveyard.start >= (rules.duration - 60) * 1000)
	) {
		gargoyle = graveyard.gargoyle = new_monster("spookytown", {
			type: "gargoyle",
			boundary: [rules.gargoyle[0], rules.gargoyle[1], rules.gargoyle[0], rules.gargoyle[1]],
			count: 1,
			special: true,
		});
		if (!gargoyle) return graveyard_finish("over");
		gargoyle.points = Object.assign({}, graveyard.points);
		graveyard.gargoyle_end = now + rules.duration * 1000;
		broadcast("server_message", localization.message("server.graveyard.gargoyle", {}, { color: "#9FA3A8" }));
		change = true;
	} else if (gargoyle) {
		if (graveyard.defeated) return graveyard_finish("defeated");
		if (instance.monsters[gargoyle.id]) gargoyle = graveyard.gargoyle = instance.monsters[gargoyle.id];
		// Like the nightly bosses: past its time, it leaves once nobody has hit it for 20 seconds.
		if (now > graveyard.gargoyle_end && ssince(gargoyle.last.attacked) > 20) return graveyard_finish("over");
		if (!E.graveyard || E.graveyard.hp !== gargoyle.hp || E.graveyard.target !== gargoyle.target) change = true;
	} else if (now - graveyard.start >= rules.duration * 1000 + 600000) return graveyard_finish("over");
	if (change) {
		E.graveyard = graveyard_public();
		broadcast_e();
	}
}

// ---------- Trick or Treat ----------
// Seven doors in Spooky Forest and Spooky Town. Each character knocks on each door once a UTC day;
// an account knocks at most 14 times a day. 70% treat (85% in a pumpkin helmet), 30% trick: Spooked!,
// or a Ghost floats out of the door. Every knock is a stamp: each 10th pays a Witch's Parcel, the 40th
// teaches the Sinister Laugh.

function trick_or_treat_day(now) {
	return new Date(now).toISOString().slice(0, 10);
}

function trick_or_treat_door(player, index) {
	var doors = G.events.trickortreat.doors;
	if (index !== undefined && index !== null && !(Number.isInteger(index) && index >= 0 && index < doors.length))
		return null;
	var list = index === undefined || index === null ? doors.map((_, i) => i) : [index];
	var best = null;
	list.forEach(function (i) {
		var door = doors[i];
		if (!door || door[0] !== player.map) return;
		var d = point_distance(player.x, player.y, door[1], door[2]);
		if (d <= 80 && (!best || d < best.d)) best = { index: i, d: d };
	});
	return best && best.index;
}

// Today's knocks and the season's stamps are account-wide (Mongo); this keeps the latest numbers seen here,
// so every character of the account online on this realm shows the same stamps and knocks left.
var trick_or_treat_accounts = {};

// What the character sees about today's knocks (character.trickortreat in CODE).
function trick_or_treat_status(player) {
	var rules = G.events.trickortreat,
		today = trick_or_treat_day(Date.now()),
		record = player.p.trickortreat,
		account = trick_or_treat_accounts[player.owner];
	var doors = record && record.day === today ? record.doors : [],
		knocks_left = account && account.day === today ? Math.max(0, rules.knocks - account.knocks) : rules.knocks;
	return {
		doors: doors.slice(),
		doors_left: Math.min(rules.doors.length - doors.length, knocks_left),
		stamps: Math.max((record && record.stamps) || 0, (account && account.stamps) || 0),
	};
}

// Ghosts let out by tricks: [id, map, leaves at]. A Ghost nobody defeats floats away again.
var trick_or_treat_ghosts = [];

function trick_or_treat_ghost(index) {
	var door = G.events.trickortreat.doors[index];
	if (!instances[door[0]]) return false;
	var ghost = new_monster(door[0], {
		type: "ghost",
		boundary: [door[1] - 8, door[2] + 8, door[1] + 8, door[2] + 24],
		count: 1,
		special: true,
	});
	if (!ghost) return false;
	trick_or_treat_ghosts.push([ghost.id, door[0], Date.now() + G.events.trickortreat.ghost_time * 1000]);
	return true;
}

// At UTC midnight every character's doors open again; refresh what CODE and the Events window read.
var trick_or_treat_last_day = null;
function trick_or_treat_tick() {
	var now = Date.now();
	trick_or_treat_ghosts = trick_or_treat_ghosts.filter(function (entry) {
		var instance = instances[entry[1]],
			ghost = instance && instance.monsters[entry[0]];
		if (!ghost || ghost.dead) return false;
		if (now < entry[2] && events.halloween) return true;
		remove_monster(ghost, { method: "disappear" });
		return false;
	});
	var today = trick_or_treat_day(now);
	if (today === trick_or_treat_last_day) return;
	trick_or_treat_last_day = today;
	if (!events.halloween) return;
	for (var id in players) {
		var player = players[id];
		if (!player.trickortreat || player.npc) continue;
		player.trickortreat = trick_or_treat_status(player);
		resend(player, "u+cid+nc");
	}
}

// A weighted pick from [weight, ...] rows
function trick_or_treat_pick(rows) {
	var roll = Math.random() * rows.reduce((sum, row) => sum + row[0], 0);
	for (var i = 0; i < rows.length; i++) {
		roll -= rows[i][0];
		if (roll < 0) return rows[i];
	}
	return rows[rows.length - 1];
}

async function trick_or_treat_knock(player, data) {
	var rules = G.events.trickortreat,
		now = Date.now(),
		today = trick_or_treat_day(now);
	if (!events.halloween) return { failed: true, reason: "trickortreat_season" };
	if (player.user) return { failed: true, reason: "cant_in_bank" };
	var door = trick_or_treat_door(player, data.door);
	if (door === null || door === undefined) return { failed: true, reason: "trickortreat_door" };
	var record = player.p.trickortreat;
	if (!record || record.day !== today)
		record = player.p.trickortreat = { day: today, doors: [], stamps: (record && record.stamps) || 0 };
	if (record.doors.includes(door)) return { failed: true, reason: "trickortreat_knocked", door: door };
	// Claim the door before waiting on the account's daily count, so a second request can't double up.
	// While a knock is settling, the logout save waits (stop_call), so its rewards are never lost.
	record.doors.push(door);
	player.knocking = (player.knocking || 0) + 1;
	try {
		return await trick_or_treat_settle(player, rules, record, door, now, today);
	} finally {
		if (!--player.knocking) delete player.knocking;
	}
}

async function trick_or_treat_settle(player, rules, record, door, now, today) {
	var collection = db.collection("TrickOrTreat"),
		daily = "knocks:" + player.owner + ":" + today;
	var knocked;
	try {
		knocked = await collection.findOneAndUpdate(
			{ _id: daily, count: { $lt: rules.knocks } },
			{ $inc: { count: 1 } },
			{ upsert: true, returnDocument: "after" },
		);
	} catch (error) {
		record.doors.splice(record.doors.indexOf(door), 1);
		if (error.code === 11000) {
			trick_or_treat_accounts[player.owner] = Object.assign({}, trick_or_treat_accounts[player.owner], {
				day: today,
				knocks: rules.knocks,
			});
			return { failed: true, reason: "trickortreat_limit" };
		}
		throw error;
	}
	var knocks = ((knocked && (knocked.value || knocked)) || {}).count || 1;
	var stamps_id = "stamps:" + player.owner + ":" + new Date(now).getUTCFullYear();
	var season = await collection.findOneAndUpdate(
		{ _id: stamps_id },
		{ $inc: { stamps: 1 } },
		{ upsert: true, returnDocument: "after" },
	);
	var stamps = ((season && (season.value || season)) || {}).stamps || 1;
	record.stamps = stamps;
	trick_or_treat_accounts[player.owner] = { day: today, knocks: knocks, stamps: stamps };
	// The account's other characters here see the same stamps and knocks left
	for (var id in players) {
		var other = players[id];
		if (other === player || other.owner !== player.owner || other.npc || !other.trickortreat) continue;
		other.trickortreat = trick_or_treat_status(other);
		resend(other, "u+cid+nc");
	}
	var helmet = player.slots.helmet && player.slots.helmet.name,
		treat_chance = rules.costumes.includes(helmet) ? rules.costume_treat : rules.treat,
		result = { success: true, door: door, stamps: stamps };
	if (Math.random() * 100 < treat_chance) {
		var row = trick_or_treat_pick(rules.treats);
		var treat = create_new_item(row[1], row[2]);
		add_item(player, treat, { announce: false });
		player.socket.emit("game_log", item_message("server.item.received", treat, {}, { color: "#F5A05B" }));
		disappearing_text(player.socket, player, localization.message("server.floating.treat", {}), {
			color: "#F5A05B",
			size: "large",
		});
		result.treat = { name: treat.name, q: treat.q || 1 };
	} else {
		if (trick_or_treat_pick(rules.tricks)[1] === "ghost" && trick_or_treat_ghost(door)) result.trick = "ghost";
		else {
			add_condition(player, "spooked");
			result.trick = "spooked";
		}
		disappearing_text(player.socket, player, localization.message("server.floating.boo", {}), {
			color: "#AD91DC",
			size: "large",
		});
	}
	if (stamps % rules.stamps.parcel === 0) {
		var parcel = create_new_item("witchparcel", 1);
		add_item(player, parcel, { announce: false });
		player.socket.emit("game_log", item_message("server.item.received", parcel, {}, { color: "#AF6AE2" }));
		result.parcel = true;
	}
	if (stamps === rules.stamps.laugh) {
		var jar = create_new_item("cxjar");
		jar.data = "sinisterlaugh";
		add_item(player, jar, { announce: false });
		player.socket.emit("game_log", localization.message("server.trickortreat.laugh", {}, { color: "#AF6AE2" }));
		result.laugh = true;
	}
	player.trickortreat = trick_or_treat_status(player);
	resend(player, "reopen+inv+u+cid"); // without nc, so Spooked! speed applies at once
	return result;
}
