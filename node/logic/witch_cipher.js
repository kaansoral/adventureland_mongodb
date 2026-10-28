// The Witch's Cipher: an event at the Witch in Spooky Forest. During Halloween it runs twice a day
// (06:00 and 18:00 on the realm clock); the rest of the year it is one of the daily events, both
// published by the event schedule. For the first 20 minutes, the monsters of four regions drop four
// ingredients through their usual loot, more often the more HP they have. Until the end, anyone can
// brew five-ingredient mixes in her cauldron. The Witch only tells how many ingredients of a mix sit
// in the right place, and the realm shares one clue board. A new mix that fits every clue pays a
// Witch's Parcel; the mix that cracks the recipe pays a bonus, once per account a day. Whenever
// someone cracks the recipe she forgets it at once: a new recipe starts on a clean board, so every
// mix stays a deduction instead of a copy of a known answer. Mixes are limited per account per UTC
// day, on the realm of the account's first mix. The account's claim lives in the WitchCipher
// collection so another realm cannot repeat the day.

var witch_cipher = null; // the live round, mirrored in S.witchcipher
// Today's account claims, loaded from the WitchCipher collection. Memory only: after a restart they
// are read again from Mongo, never from the server snapshot.
var witch_cipher_claims = {};

function witch_cipher_rules() {
	return G.events.witchcipher;
}

function witch_cipher_ingredients() {
	return witch_cipher_rules().ingredients.map(function (entry) {
		return entry[0];
	});
}

function witch_cipher_day(now) {
	return new Date(now).toISOString().slice(0, 10);
}

// The Witch's clue: how many ingredients sit in the right place.
function witch_cipher_score(secret, mix) {
	var right = 0;
	for (var i = 0; i < secret.length; i++) if (secret[i] === mix[i]) right++;
	return { right: right };
}

// Every recipe that still fits all of the board's clues.
function witch_cipher_candidates(history) {
	var names = witch_cipher_ingredients(),
		slots = witch_cipher_rules().slots,
		list = [];
	for (var n = 0; n < Math.pow(names.length, slots); n++) {
		var recipe = [];
		for (var i = 0, k = n; i < slots; i++, k = Math.floor(k / names.length)) recipe.push(names[k % names.length]);
		if (
			history.every(function (entry) {
				return witch_cipher_score(recipe, entry.mix).right === entry.right;
			})
		)
			list.push(recipe);
	}
	return list;
}

function witch_cipher_public() {
	if (!witch_cipher) return { live: false };
	var round = witch_cipher,
		rules = witch_cipher_rules(),
		now = Date.now();
	var data = {
		live: now < round.end,
		phase: now < round.gather_end ? "gathering" : "brewing",
		id: round.id,
		start: round.start,
		gather_end: round.gather_end,
		end: round.end,
		board: round.history.slice(-rules.board).map(function (entry) {
			return { mix: entry.mix.slice(), right: entry.right };
		}),
		possible: witch_cipher_candidates(round.history).length,
		mixes: round.history.length,
		cracks: round.cracks.length,
	};
	// The last cracked recipe, shown above the new board
	if (round.cracked) data.cracked = { by: round.cracked.by, recipe: round.cracked.recipe.slice() };
	return data;
}

function witch_cipher_publish() {
	E.witchcipher = witch_cipher_public();
	broadcast_e();
}

function witch_cipher_secret() {
	var names = witch_cipher_ingredients(),
		secret = [];
	for (var i = 0; i < witch_cipher_rules().slots; i++) secret.push(random_one(names));
	return secret;
}

// While gathering lasts, the four regions' monsters drop the ingredients through their usual loot.
// The chance grows with the monster's HP, like Halloween candy, and Luck counts as for any drop.
function witch_cipher_loot(on) {
	var rules = witch_cipher_rules(),
		names = witch_cipher_ingredients();
	rules.ingredients.forEach(function (entry) {
		entry[1].forEach(function (type) {
			var table = (D.drops.monsters[type] || []).filter(function (row) {
				return !names.includes(row[1]);
			});
			if (on) table.push([(rules.loot * G.monsters[type].hp) / 1000, entry[0]]);
			if (table.length) D.drops.monsters[type] = table;
			else delete D.drops.monsters[type];
		});
	});
}

function witch_cipher_start(occurrence) {
	var rules = witch_cipher_rules(),
		now = Date.now(),
		day = witch_cipher_day(now);
	witch_cipher = S.witchcipher = {
		id: occurrence.id,
		day: day,
		start: now,
		gather_end: now + rules.gathering * 1000,
		end: now + rules.duration * 1000,
		secret: witch_cipher_secret(),
		history: [],
		cracks: [],
		cracked: null,
	};
	// Today's claims stay for the day's other round; older ones go
	for (var owner in witch_cipher_claims) if (witch_cipher_claims[owner].day !== day) delete witch_cipher_claims[owner];
	witch_cipher_loot(true);
	events.witchcipher = true;
	broadcast("server_message", localization.message("server.witchcipher.started", {}, { color: "#AF6AE2" }));
	broadcast("game_event", { name: "witchcipher", map: "halloween", x: G.quests.witch.x, y: G.quests.witch.y });
	witch_cipher_publish();
	for (var id in players) witch_cipher_show(players[id]);
	witch_cipher_load_claims();
}

// Every character sees its account's mixes while a round runs (character.witchcipher in CODE).
function witch_cipher_show(player) {
	if (!player || player.npc || !witch_cipher) return;
	var claim = witch_cipher_claims[player.owner];
	player.witchcipher = witch_cipher_status(claim && claim.day === witch_cipher.day ? claim : null);
	resend(player, "u+cid+nc");
}

// The day's claims of everyone online, in one query: an account that brewed in the day's earlier
// round, here or on another realm, sees what it has left, also after a restart between the rounds.
function witch_cipher_load_claims() {
	var round = witch_cipher,
		ids = {};
	for (var id in players) if (!players[id].npc) ids["claim:" + players[id].owner + ":" + round.day] = true;
	if (!Object.keys(ids).length) return;
	db.collection("WitchCipher")
		.find({ _id: { $in: Object.keys(ids) } })
		.toArray()
		.then(function (claims) {
			if (witch_cipher !== round || Date.now() >= round.end) return;
			claims.forEach(function (claim) {
				if (claim.day !== round.day) return;
				witch_cipher_remember(claim);
				for (var id in players) if (players[id].owner === claim.owner) witch_cipher_show(players[id]);
			});
		})
		.catch((error) => log_trace("witchcipher claims", error));
}

// Restores a round after a restart; a round that ended while the server was down just finishes.
function witch_cipher_restore() {
	if (!S.witchcipher) return witch_cipher_loot(false);
	witch_cipher = S.witchcipher;
	delete witch_cipher.claims; // older snapshots carried claims; Mongo is the record
	// Older snapshots kept one cracked recipe as the live secret
	if (!witch_cipher.cracks) {
		witch_cipher.cracks = [];
		if (witch_cipher.cracked) {
			witch_cipher.cracked.recipe = witch_cipher.secret.slice();
			witch_cipher.cracks.push(witch_cipher.cracked);
			witch_cipher.secret = witch_cipher_secret();
			witch_cipher.history = [];
		}
	}
	// A round saved under older rules starts a recipe of today's length
	if (witch_cipher.secret.length !== witch_cipher_rules().slots) {
		witch_cipher.secret = witch_cipher_secret();
		witch_cipher.history = [];
	}
	witch_cipher_claims = {};
	if (Date.now() >= witch_cipher.end) return witch_cipher_finish();
	witch_cipher_loot(Date.now() < witch_cipher.gather_end);
	events.witchcipher = true;
	E.witchcipher = witch_cipher_public();
}

function witch_cipher_finish() {
	var round = witch_cipher;
	witch_cipher_loot(false);
	events.witchcipher = false;
	if (round && !round.cracks.length)
		broadcast(
			"server_message",
			localization.message(
				"server.witchcipher.over_uncracked",
				{ recipe: round.secret.map((name) => G.items[name].name).join(", ") },
				{ color: "#AF6AE2" },
			),
		);
	else broadcast("server_message", localization.message("server.witchcipher.over", {}, { color: "#AF6AE2" }));
	E.witchcipher = round ? Object.assign(witch_cipher_public(), { live: false }) : { live: false };
	witch_cipher = S.witchcipher = null;
	for (var id in players) if (players[id].witchcipher) ((players[id].witchcipher = null), resend(players[id], "u+cid"));
	broadcast_e();
}

function witch_cipher_tick() {
	if (!witch_cipher) return;
	var now = Date.now();
	if (now >= witch_cipher.end) return witch_cipher_finish();
	if (!witch_cipher.brewing_notice && now >= witch_cipher.gather_end) {
		witch_cipher.brewing_notice = true;
		witch_cipher_loot(false);
		broadcast("server_message", localization.message("server.witchcipher.gathering_over", {}, { color: "#AF6AE2" }));
		witch_cipher_publish();
	}
}

// What a character sees about its account's day (character.witchcipher in CODE).
function witch_cipher_status(claim) {
	var rules = witch_cipher_rules();
	if (!claim) return { mixes: 0, mixes_left: rules.mixes, parcels: 0 };
	var status = {
		day: claim.day,
		mixes: claim.mixes,
		mixes_left: Math.max(0, rules.mixes - claim.mixes),
		parcels: claim.parcels,
	};
	// The account's mixes today belong to another realm
	if (claim.server !== server_id) Object.assign(status, { mixes_left: 0, server: String(claim.server).slice(3) });
	return status;
}

async function witch_cipher_claim(player, create) {
	// A round belongs to the day it started on, also when it runs past UTC midnight
	var collection = db.collection("WitchCipher"),
		day = witch_cipher && Date.now() < witch_cipher.end ? witch_cipher.day : witch_cipher_day(Date.now()),
		id = "claim:" + player.owner + ":" + day;
	if (create) {
		try {
			await collection.insertOne({
				_id: id,
				owner: player.owner,
				day: day,
				name: player.name,
				server: server_id,
				mixes: 0,
				parcels: 0,
				cracks: 0,
				created: new Date(),
			});
		} catch (error) {
			if (error.code !== 11000) throw error;
		}
	}
	return await collection.findOne({ _id: id });
}

// Saves the claim's counts; $max keeps writes that land out of order from lowering them. A failed
// write is retried, because after a restart the claim is read back from Mongo.
function witch_cipher_save_claim(owner, claim, tries) {
	db.collection("WitchCipher")
		.updateOne(
			{ _id: "claim:" + owner + ":" + claim.day },
			{ $max: { mixes: claim.mixes, parcels: claim.parcels, cracks: claim.cracks || 0 } },
		)
		.catch(function (error) {
			log_trace("witchcipher save", error);
			if (tries < 20) setTimeout(() => witch_cipher_save_claim(owner, claim, tries + 1), 3000);
		});
}

// Keeps the larger counts: a Mongo read that started before a brew must not hand back spent mixes.
function witch_cipher_remember(claim) {
	var live = witch_cipher_claims[claim.owner];
	if (live && live.day === claim.day) {
		live.mixes = Math.max(live.mixes, claim.mixes);
		live.parcels = Math.max(live.parcels, claim.parcels);
		live.cracks = Math.max(live.cracks || 0, claim.cracks || 0);
		return live;
	}
	return (witch_cipher_claims[claim.owner] = {
		day: claim.day,
		server: claim.server,
		mixes: claim.mixes,
		parcels: claim.parcels,
		cracks: claim.cracks || 0,
	});
}

// On login during a round, the character finds its account's day, also after a restart.
function witch_cipher_reload(player) {
	if (!witch_cipher || Date.now() >= witch_cipher.end || player.npc) return;
	var claim = witch_cipher_claims[player.owner];
	if (claim && claim.day === witch_cipher.day) return void (player.witchcipher = witch_cipher_status(claim));
	player.witchcipher = witch_cipher_status(null);
	witch_cipher_claim(player, false)
		.then(function (claim) {
			if (!claim || !witch_cipher || claim.day !== witch_cipher.day) return;
			witch_cipher_remember(claim);
			if (!player.dc) witch_cipher_show(player);
		})
		.catch((error) => log_trace("witchcipher reload", error));
}

// The account's day: how many mixes are left, on which realm, and the Parcels earned.
async function witch_cipher_info(player) {
	var claim = await witch_cipher_claim(player, false),
		rules = witch_cipher_rules();
	var info = {
		mixes: rules.mixes,
		mixes_left: rules.mixes,
		parcels: 0,
		live: !!(witch_cipher && Date.now() < witch_cipher.end),
	};
	if (claim)
		Object.assign(info, {
			server: String(claim.server).slice(3),
			mixes_left: Math.max(0, rules.mixes - claim.mixes),
			parcels: claim.parcels,
		});
	return info;
}

function witch_cipher_near(player) {
	if (player.computer) return true;
	var witch = G.quests.witch;
	return !!witch && player.map === witch.map && distance(player, witch) <= B.sell_dist;
}

function witch_cipher_missing(player, names) {
	var needed = {};
	names.forEach(function (name) {
		needed[name] = (needed[name] || 0) + 1;
	});
	for (var name in needed) {
		var have = 0;
		player.items.forEach(function (item) {
			if (item && item.name === name && !item.l) have += item.q || 1;
		});
		if (have < needed[name]) return name;
	}
	return null;
}

// One mix in the cauldron: ingredient names in order. The account's first mix of the day opens its
// claim on this realm; from then on the check and the use of the ingredients happen in one step, so the
// inventory checked is the inventory consumed. The claim's counts are saved after the reward.
async function witch_cipher_brew(player, names) {
	var rules = witch_cipher_rules(),
		round = witch_cipher;
	if (!round || Date.now() >= round.end) return { failed: true, reason: "witchcipher_not_live" };
	if (!witch_cipher_near(player)) return { failed: true, reason: "distance" };
	if (player.user) return { failed: true, reason: "cant_in_bank" };
	var valid = witch_cipher_ingredients();
	if (!is_array(names) || names.length !== rules.slots || names.some((name) => !valid.includes(name)))
		return { failed: true, reason: "invalid" };
	var missing = witch_cipher_missing(player, names);
	if (missing) return { failed: true, reason: "witchcipher_ingredients", item: missing };
	var claim = witch_cipher_claims[player.owner];
	if (!claim || claim.day !== round.day) {
		var saved = await witch_cipher_claim(player, true);
		if (!saved) return { failed: true, reason: "invalid" };
		claim = witch_cipher_remember(saved);
		if (witch_cipher !== round || Date.now() >= round.end || claim.day !== round.day)
			return { failed: true, reason: "witchcipher_not_live" };
	}
	if (claim.server !== server_id)
		return Object.assign(
			{ failed: true, reason: "witchcipher_elsewhere" },
			localization.message("server.witchcipher.claimed_elsewhere", { server: String(claim.server).slice(3) }),
		);
	if (claim.mixes >= rules.mixes) return { failed: true, reason: "witchcipher_no_mixes" };
	// The inventory may have changed while the claim was read
	missing = witch_cipher_missing(player, names);
	if (missing) return { failed: true, reason: "witchcipher_ingredients", item: missing };
	var needed = {};
	names.forEach(function (name) {
		needed[name] = (needed[name] || 0) + 1;
	});
	for (var name in needed) {
		var left = needed[name];
		for (var i = 0; i < player.items.length && left; i++) {
			var item = player.items[i];
			if (!item || item.name !== name || item.l) continue;
			var take = Math.min(left, item.q || 1);
			consume(player, i, take);
			left -= take;
		}
	}

	var key = names.join(","),
		tried = round.history.some((entry) => entry.mix.join(",") === key),
		score = witch_cipher_score(round.secret, names),
		fits = !tried && witch_cipher_candidates(round.history).some((recipe) => recipe.join(",") === key),
		cracked_now = score.right === rules.slots,
		parcels = fits ? rules.payout.fits : 0;
	// The crack bonus comes once per account a day; later cracks pay like any fitting mix
	if (cracked_now && !claim.cracks) parcels += rules.payout.crack;
	if (cracked_now) {
		claim.cracks = (claim.cracks || 0) + 1;
		// She forgets it at once: the next recipe starts on a clean board
		round.cracked = { by: player.name, at: Date.now(), recipe: round.secret.slice() };
		round.cracks.push(round.cracked);
		round.secret = witch_cipher_secret();
		round.history = [];
		broadcast(
			"server_message",
			localization.message("server.witchcipher.cracked", { player: String(player.name) }, { color: "#F59A3C" }),
		);
	} else if (!tried) round.history.push({ mix: names.slice(), right: score.right, by: player.name });
	claim.mixes += 1;
	claim.parcels += parcels;
	if (parcels) {
		var reward = create_new_item("witchparcel", parcels);
		add_item(player, reward, { announce: false });
		player.socket.emit("game_log", item_message("server.item.received", reward, {}, { color: "#AF6AE2" }));
	}
	player.witchcipher = witch_cipher_status(claim);
	resend(player, "reopen+nc+inv+u+cid");
	// The account's other characters here see the same mixes left
	for (var id in players)
		if (players[id] !== player && players[id].owner === player.owner) witch_cipher_show(players[id]);
	witch_cipher_save_claim(player.owner, claim, 0);
	witch_cipher_publish();
	return {
		success: true,
		mix: names.slice(),
		right: score.right,
		fits: fits,
		cracked: cracked_now,
		parcels: parcels,
		mixes_left: player.witchcipher.mixes_left,
	};
}

async function witch_cipher_interaction(player, data) {
	if (data.action === "info") return await witch_cipher_info(player);
	if (data.action === "brew") return await witch_cipher_brew(player, data.items);
	return { failed: true, reason: "invalid" };
}
