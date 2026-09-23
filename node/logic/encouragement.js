// Shared game-server scope. One bounded character query and indexed group mark
// per five minutes or login. Combat and loot use only memory.
var encouragement_groups = new Map();
var encouragement_visits = new Map();
var encouragement_names = ["encouragement_new", "encouragement_lonewolf", "encouragement_returning"];
var encouragement_day = 24 * 60 * 60 * 1000;
var encouragement_cache_ms = 5 * 60 * 1000;

function encouragement_identity(player) {
	var pid = player.pid || (player.p && (player.p.steam_id || player.p.mas_auth_id));
	return { key: pid ? "pid:" + pid : "owner:" + player.owner, query: pid ? { pid: pid } : { owner: player.owner } };
}

async function encouragement_load(player, previous_online) {
	var identity = encouragement_identity(player),
		now = Date.now();
	var group = encouragement_groups.get(identity.key);
	while (group && group.pending) {
		await group.pending;
		if (previous_online === undefined) return group;
	}
	if (group && group.until > now && previous_online === undefined) return group;
	if (!group) {
		group = { until: 0, next: 0, characters: [] };
		encouragement_groups.set(identity.key, group);
	}
	// A new login must see characters created or linked since the last check.
	group.until = 0;
	var revision = group.revision || 0;
	group.pending = Promise.resolve().then(async function () {
		try {
			var characters = await db
				.collection("character")
				.find(identity.query, {
					projection: {
						_id: 1,
						owner: 1,
						level: 1,
						pid: 1,
						type: 1,
						created: 1,
						last_online: 1,
						last_sync: 1,
						server: 1,
						"info.p.encouragement": 1,
					},
				})
				.limit(25)
				.maxTimeMS(3000)
				.toArray();
			var oldest = group.oldest === undefined ? now : group.oldest,
				latest = 0,
				returning = group.return_until || 0;
			for (var character of characters) {
				var created = +new Date(character.created),
					saved = character.info && character.info.p && character.info.p.encouragement;
				if (!Number.isFinite(created) || created <= 0 || created > now) oldest = 0;
				else oldest = Math.min(oldest, created);
				if (saved && saved.group === identity.key) {
					oldest = Math.min(oldest, saved.oldest || 0);
					returning = Math.max(returning, saved.return_until || 0);
				}
				var last =
					character._id === player.real_id && previous_online !== undefined ? previous_online : character.last_online;
				latest = Math.max(latest, +new Date(last) || now);
				if (character._id !== player.real_id && character.server && now - +new Date(character.last_sync) < 120 * 60000)
					latest = now;
			}
			// New platform links may not have reached the character's normal save yet.
			oldest = Math.min(oldest, player.created || 0);
			var saved = player.p.encouragement;
			if (saved && saved.group === identity.key) {
				oldest = Math.min(oldest, saved.oldest || 0);
				returning = Math.max(returning, saved.return_until || 0);
			}
			group.characters = characters;
			group.oldest = oldest;
			group.return_until = returning;
			group.latest = latest;
			await encouragement_history(player, group, previous_online !== undefined);
			group.until = revision === (group.revision || 0) ? Date.now() + encouragement_cache_ms : 0;
			group.next = group.until;
			group.blocked = characters.length >= 25 || !characters.length;
			return group;
		} catch (e) {
			group.next = Date.now() + 60000;
			log_trace("encouragement", e);
			return group;
		} finally {
			delete group.pending;
		}
	});
	return group.pending;
}

// Authentication calls this on other occupied realms before admitting a sibling.
// Retain the notice even when that realm is still loading the first character.
function encouragement_foreign_login(data) {
	if (data.type !== "merchant")
		encouragement_visits.set(data.group, { id: data.id, until: Date.now() + encouragement_cache_ms });
	var group = encouragement_groups.get(data.group);
	if (group) {
		group.until = 0;
		group.next = 0;
		group.revision = (group.revision || 0) + 1;
	}
	for (var player of Object.values(players)) {
		if (encouragement_identity(player).key === data.group) encouragement_update(player, true);
	}
	return true;
}

async function encouragement_login(player, previous_online) {
	try {
		var identity = encouragement_identity(player),
			group = await encouragement_load(player, previous_online);
		if (group.until <= Date.now()) return false;
		var realms = new Set();
		for (var character of group.characters) {
			if (
				character._id !== player.real_id &&
				character.server &&
				character.server !== server_id &&
				Date.now() - +new Date(character.last_sync) < 120 * 60000
			)
				realms.add(character.server);
		}
		for (var realm of realms) {
			var other = server_information.servers[realm] || (await get(realm));
			if (
				!other ||
				(await server_eval(
					other,
					"output = encouragement_foreign_login(data)",
					{
						group: identity.key,
						id: player.real_id,
						type: player.type,
					},
					5000,
				)) !== true
			)
				return false;
		}
		encouragement_update(player);
		player.p.max_xp_multiplier = Math.max(1, player.p.max_xp_multiplier || 1);
		return true;
	} catch (e) {
		log_trace("encouragement login", e);
		return false;
	}
}

async function encouragement_history(player, group, login) {
	// One atomic update preserves the oldest date, recent activity and return window
	// even after every character is removed. The existing _id index is sufficient.
	var now = Date.now(),
		away = { $subtract: [now, "$last_online"] };
	var saved = await db.collection("mark").findOneAndUpdate(
		{ _id: "MK_encouragement-" + encouragement_identity(player).key },
		[
			{
				$set: {
					oldest: { $min: [{ $ifNull: ["$oldest", group.oldest] }, group.oldest] },
					last_online: { $max: [{ $ifNull: ["$last_online", 0] }, group.latest] },
					return_until: { $max: [{ $ifNull: ["$return_until", 0] }, group.return_until] },
				},
			},
			{
				$set: {
					return_until: {
						$max: [
							"$return_until",
							login && group.characters.length
								? {
										$cond: [
											{ $gt: [away, 60 * encouragement_day] },
											{ $add: [now, { $min: [90 * encouragement_day, { $divide: [away, 2] }] }] },
											0,
										],
									}
								: 0,
						],
					},
					last_online: now,
				},
			},
		],
		{ upsert: true, returnDocument: "after", includeResultMetadata: false, maxTimeMS: 3000 },
	);
	if (!saved) throw new Error("Missing encouragement history");
	group.oldest = saved.oldest;
	group.return_until = saved.return_until;
	return true;
}

function encouragement_update(player, force) {
	if (!player.p || !player.s || player.is_npc) return;
	if (!force && player.encouragement && player.encouragement_next > Date.now()) return;
	var now = Date.now(),
		identity = encouragement_identity(player),
		group = encouragement_groups.get(identity.key);
	var ready = !!(group && group.until > now),
		blocked = !ready || group.blocked || !!player.temp_auth || !!player.s.authfail;
	var rates = { gold: 1, xp: 1, luck: 1 },
		active = {},
		status = [];
	var lonewolf = player.type !== "merchant",
		visit = encouragement_visits.get(identity.key);
	if (visit && visit.until > now && visit.id !== player.real_id) lonewolf = false;
	for (var other of Object.values(players)) {
		if (
			other !== player &&
			!other.dc &&
			other.type !== "merchant" &&
			encouragement_identity(other).key === identity.key
		)
			lonewolf = false;
	}
	if (ready) {
		for (var character of group.characters) {
			if (
				character._id !== player.real_id &&
				character.type !== "merchant" &&
				character.server &&
				character.server !== server_id &&
				now - +new Date(character.last_sync) < 120 * 60000
			)
				lonewolf = false;
		}
		if (server_information.foreign_group_activity(identity.key, player.real_id) > now - 2 * 60000) lonewolf = false;
		player.p.encouragement = { group: identity.key, oldest: group.oldest, return_until: group.return_until };
	}
	if (player.level >= 80) player.p.encouragement_reached80 = true;
	var age = ready && group.oldest ? now - group.oldest : 40 * encouragement_day;
	for (var name of encouragement_names) {
		var condition = null,
			reason = "away";
		if (blocked) reason = ready && group.blocked ? "character_limit" : "checking";
		else if (name === "encouragement_new") reason = "expired";
		else if (name === "encouragement_lonewolf") reason = player.type === "merchant" ? "merchant" : "another_character";
		if (!blocked && name === "encouragement_new" && age >= 0 && age < 40 * encouragement_day) {
			var phase = Math.floor(age / (10 * encouragement_day)),
				row = G.conditions[name].phases[phase];
			condition = {
				gold_multiplier: row[0],
				xp_multiplier: player.p.encouragement_reached80 ? 1 : row[1],
				luck_multiplier: row[2],
				phase: phase + 1,
				expires: group.oldest + 40 * encouragement_day,
				phase_ends: group.oldest + (phase + 1) * 10 * encouragement_day,
			};
		} else if (!blocked && name === "encouragement_lonewolf" && lonewolf) {
			condition = { gold_multiplier: 3, xp_multiplier: 3, luck_multiplier: 3 };
		} else if (!blocked && name === "encouragement_returning" && group.return_until > now) {
			var rate = player.level < 80 ? 3 : 2;
			condition = { gold_multiplier: rate, xp_multiplier: rate, luck_multiplier: rate, expires: group.return_until };
		}
		if (condition) {
			if (condition.expires) condition.ms = condition.expires - now;
			for (var stat in rates) rates[stat] *= condition[stat + "_multiplier"];
			active[name] = condition;
		}
		status.push({ id: name, active: !!condition, reason: condition ? "active" : reason });
	}
	var summary = {
		totals: rates,
		statuses: status,
		characterCount: ready ? group.characters.length : null,
		blocked: !!blocked,
		groupReady: ready,
	};
	var changed = JSON.stringify(player.encouragement) !== JSON.stringify(summary);
	for (var name of encouragement_names) {
		if (
			!!player.s[name] !== !!active[name] ||
			(active[name] && player.s[name] && player.s[name].phase !== active[name].phase)
		)
			changed = true;
		if (active[name]) player.s[name] = active[name];
		else delete player.s[name];
	}
	player.encouragement = summary;
	player.encouragement_next = now + 1000;
	for (var name in active)
		player.encouragement_next = Math.min(
			player.encouragement_next,
			active[name].phase_ends || Infinity,
			active[name].expires || Infinity,
		);
	if (changed) {
		player.u = true;
		player.cid++;
	}
}

function encouragement_tick() {
	var now = Date.now(),
		used = new Set();
	for (var player of Object.values(players)) {
		if (player.dc || player.is_npc) continue;
		var key = encouragement_identity(player).key,
			group = encouragement_groups.get(key);
		used.add(key);
		if (!group || (!group.pending && group.next <= now))
			encouragement_load(player).then(() => {
				for (var current of Object.values(players)) if (!current.dc) encouragement_update(current, true);
			});
		encouragement_update(player, true);
	}
	for (var [key, group] of encouragement_groups)
		if (!used.has(key) && !group.pending && group.next <= now) encouragement_groups.delete(key);
	for (var [key, visit] of encouragement_visits) if (visit.until <= now) encouragement_visits.delete(key);
}

function encouragement_points(monster, player, points) {
	if (!monster || !monster.is_monster || monster.pet || monster.trap || !Number.isFinite(points) || points <= 0) return;
	monster.contribution_total = (monster.contribution_total || 0) + points;
	if (!player || !player.real_id || !player.is_player || player.is_npc) return;
	var ledger = monster.contributions || (monster.contributions = {}),
		entry = ledger[player.real_id];
	// Disconnected contributors stay in the denominator. Keep long-lived encounters bounded.
	if (!entry && Object.keys(ledger).length >= 256) return;
	if (!entry) entry = ledger[player.real_id] = { owner: player.owner, points: 0, gold: 0, xp: 0, xp80: 0, luck: 0 };
	entry.points += points;
	encouragement_update(player);
	var rates = player.encouragement.totals;
	for (var stat of ["gold", "xp", "luck"]) entry[stat] += points * (rates[stat] - 1);
	var newcomer = player.s.encouragement_new;
	entry.xp80 = (entry.xp80 || 0) + points * (rates.xp / (newcomer ? newcomer.xp_multiplier : 1) - 1);
}

function encouragement_wound(player, monster, damage) {
	var wound = player.encouragement_wound;
	if (!wound || wound.id !== monster.id || wound.in !== monster.in)
		wound = { id: monster.id, in: monster.in, points: 0 };
	wound.points = Math.min(player.max_hp - Math.max(0, player.hp), wound.points + damage);
	player.encouragement_wound = wound;
}

function encouragement_heal(healer, player, amount, missing) {
	var wound = player.encouragement_wound;
	if (!wound) return;
	var monster = instances[wound.in] && instances[wound.in].monsters[wound.id];
	var restored = Math.min(amount, missing, wound.points);
	wound.points = Math.max(0, Math.min(wound.points, missing) - amount);
	if (!wound.points || !monster || monster.dead || monster.in !== player.in) delete player.encouragement_wound;
	if (monster && !monster.dead && monster.in === player.in && healer.in === player.in)
		encouragement_points(monster, healer, restored * B.dps_heal_mult);
}

function encouragement_share(player, monster) {
	var entry = monster.contributions && monster.contributions[player.real_id];
	if (!entry || entry.owner !== player.owner || player.dc || player.in !== monster.in) return null;
	encouragement_update(player);
	var total = Math.max(monster.contribution_total || 0, monster.max_hp - Math.max(0, monster.hp));
	if (!(total > 0)) return null;
	var result = {};
	for (var stat of ["gold", "xp", "luck"])
		result[stat] = Math.min(entry[stat], entry.points * (player.encouragement.totals[stat] - 1)) / total;
	var newcomer = player.s.encouragement_new;
	result.xp80 =
		Math.min(
			entry.xp80 || 0,
			entry.points * (player.encouragement.totals.xp / (newcomer ? newcomer.xp_multiplier : 1) - 1),
		) / total;
	return result;
}

function encouragement_xp(player, monster, amount, share) {
	var contribution = encouragement_share(player, monster),
		extra = 0;
	if (contribution && share > 0) extra = Math.floor((amount / share) * contribution.xp);
	var above80 = contribution && share > 0 ? Math.floor((amount / share) * contribution.xp80) : 0;
	if (
		player.s.encouragement_new &&
		player.s.encouragement_new.xp_multiplier > 1 &&
		amount + extra >= player.max_xp - player.xp
	) {
		var remaining = -player.xp;
		for (var level = player.level; level < 80; level++) remaining += G.levels[level];
		extra = above80 + Math.min(extra - above80, Math.max(0, remaining - amount - above80));
	}
	var multiplier = amount > 0 ? player.xpm * (1 + extra / amount) : 1;
	player.p.max_xp_multiplier = Math.max(player.p.max_xp_multiplier || 1, multiplier);
	player.encouragement_xp_carry = multiplier;
	player.encouragement_xp_carry80 = amount > 0 ? player.xpm * (1 + above80 / amount) : 1;
	return amount + extra;
}

// Seal the recipients and their work on the normal chest. No loot-time account queries.
function encouragement_chest(player, monster, chest, share) {
	if (!monster.contributions || !(share > 0)) return;
	var names = player.party ? parties[player.party] : [player.name];
	var claimed = monster.encouragement_claimed || (monster.encouragement_claimed = {});
	for (var name of names) {
		var current = players[name_to_id[name]];
		if (!current || claimed[current.real_id]) continue;
		var contribution = encouragement_share(current, monster);
		if (!contribution || (!contribution.gold && !contribution.luck)) continue;
		claimed[current.real_id] = true;
		(chest.encouragement || (chest.encouragement = [])).push({
			id: current.real_id,
			owner: current.owner,
			name: current.name,
			group: encouragement_identity(current).key,
			gold: contribution.gold / share,
			luck: contribution.luck,
			luckm: current.luckm,
			home: has_home_server_bonus(current),
			tskin: current.tskin,
			pvp: is_in_pvp(current, 1),
		});
	}
	if (chest.encouragement)
		chest.encouragement_monster = {
			type: monster.type,
			map: monster.map,
			max_hp: monster.max_hp,
			level: monster.level,
			mult: monster.mult,
			luckx: monster.luckx,
			drops: monster.drops,
			"1hp": monster["1hp"],
		};
}

function encouragement_loot(chest, goldm, looters) {
	var receipts = chest.encouragement || [],
		golds = {};
	delete chest.encouragement;
	for (var receipt of receipts) {
		var player = players[name_to_id[receipt.name]];
		if (
			!player ||
			player.dc ||
			player.real_id !== receipt.id ||
			player.owner !== receipt.owner ||
			encouragement_identity(player).key !== receipt.group
		)
			continue;
		var drop = { items: [], cash: 0 };
		if (receipt.luck > 0)
			roll_monster_drops(
				{ owner: receipt.owner, luckm: receipt.luckm, tskin: receipt.tskin },
				chest.encouragement_monster,
				drop,
				receipt.luck,
				{ home: receipt.home, pvp: receipt.pvp },
			);
		var gold = Math.floor(((chest.encouragement_gold || 0) * goldm + (chest.egold || 0)) * receipt.gold);
		// A reserved ordinary chest keeps a full inventory from losing or rerolling the result.
		if (!can_add_items(player, drop.items)) {
			drop_one_thing(player, [], { reserved: drop, gold: gold, character: receipt.id, group: receipt.group });
			continue;
		}
		for (var item of drop.items) {
			add_item(player, item, { found: 1, m: 1, v: B.v });
			player.socket.emit("game_log", item_message("server.item.found", item, {}, { color: "#4BAEAA" }));
		}
		if (drop.cash) add_shells(player, drop.cash, "chest", true, "override");
		gold = server_tax(gold);
		player.gold += gold;
		if (player.t) player.t.cgold += gold;
		if (looters && in_arr(player.name, looters)) golds[player.id] = gold;
		else if (gold)
			player.socket.emit(
				"game_log",
				localization.message("server.game_log.gold", { amount: String(to_pretty_num(gold)) }, { color: "gold" }),
			);
		if (gold || drop.items.length || drop.cash) resend(player, "reopen+nc+inv");
	}
	return golds;
}
