// Four persistent NPCs, shared by all callers on this game server.
var cavalry_calls = new Map();
var cavalry_call_number = 0;
var cavalry_members = ["cavalry_warrior", "cavalry_priest", "cavalry_mage", "cavalry_paladin"];
var cavalry_next_dispatch = 0;
var cavalry_pending = new Set();
var cavalry_assisted = new WeakMap();

function is_cavalry(entity) {
	return !!(entity && entity.is_npc && entity.def && entity.def.cavalry);
}

function cavalry_config() {
	return G.items.tracker.cavalry;
}

function cavalry_player_active(player) {
	return !!(
		player &&
		!player.npc &&
		!player.dc &&
		!player.rip &&
		player.hp > 0 &&
		player.socket &&
		players[player.socket.id] === player
	);
}

function cavalry_monsters(call) {
	var instance = instances[call.in];
	if (!instance) return [];
	return (call.targets || Object.values(instance.monsters)).filter(
		(monster) => instance.monsters[monster.id] === monster && cavalry_monster_eligible(call, monster),
	);
}

function cavalry_monster_nearby(call, monster) {
	var def = G.monsters[monster.type];
	return (
		def &&
		!def.special &&
		!def.cooperative &&
		!def.announce &&
		!monster.cooperative &&
		def.respawn >= 0 &&
		def.respawn < 300 &&
		monster.is_monster &&
		monster.in === call.in &&
		!monster.dead &&
		monster.hp > 0 &&
		!monster.pet &&
		!monster.trap &&
		!monster.zone_actor &&
		!monster.special &&
		!monster.map_def?.special &&
		!monster.spawn &&
		// Ordinary spawn growth creates temporary monsters as well.
		(!monster.temp || monster.map_def?.grow) &&
		!monster.peaceful &&
		!def.good &&
		monster.level >= cavalry_config().min_level &&
		distance(call, monster) <= cavalry_config().range
	);
}

function cavalry_monster_eligible(call, monster) {
	if (!cavalry_monster_nearby(call, monster)) return false;
	var victim = get_player(monster.target);
	return !!(
		(call.newcomer && !monster.target) ||
		(cavalry_player_active(victim) &&
			victim.in === call.in &&
			(victim === call.player || (call.player.party && victim.party === call.player.party)))
	);
}

function cavalry_call_active(call) {
	return (
		Date.now() < call.expires &&
		cavalry_player_active(call.player) &&
		call.player.in === call.in &&
		distance(call, call.player) <= cavalry_config().range &&
		cavalry_monsters(call).length > 0
	);
}

function cavalry_cooldown(level) {
	return cavalry_config().cooldown_base + Math.max(1, Math.floor(level)) * cavalry_config().cooldown_per_level;
}

function cavalry_nearby_level(point) {
	var level = 0;
	for (var player of Object.values(instances[point.in]?.players || {})) {
		if (
			cavalry_player_active(player) &&
			player.in === point.in &&
			simple_distance(point, player) <= cavalry_config().veteran_range
		)
			level = Math.max(level, player.level);
	}
	return level;
}

function cavalry_guarded(monster) {
	return cavalry_nearby_level(monster) >= cavalry_config().newcomer_level;
}

function cavalry_cleared_spawn(monster) {
	var call = cavalry_assisted.get(monster);
	return !!(
		call &&
		call.newcomer &&
		Date.now() < call.expires &&
		cavalry_player_active(call.player) &&
		call.player.in === call.in &&
		distance(call, call.player) <= cavalry_config().range &&
		!cavalry_guarded(monster)
	);
}

async function cavalry_release(call) {
	if (call.served || !call.reservation) return;
	try {
		// An unanswered call releases only its own reservation, never a later rescue.
		await db
			.collection("mark")
			.updateOne({ _id: call.reservation, token: call.token }, { $set: { next_call: 0 } }, { maxTimeMS: 3000 });
	} catch (error) {
		log_trace("cavalry reservation", error);
	}
}

async function cavalry_reserve(player) {
	var call = { player, in: player.in, map: player.map, x: player.x, y: player.y, order: ++cavalry_call_number };
	var marks = db.collection("mark"),
		id = "MK_cavalry-" + player.owner;
	var saved = await marks.findOne({ _id: id }, { maxTimeMS: 3000 });
	if (saved && saved.next_call > Date.now()) throw Object.assign(Error("cooldown"), { next_call: saved.next_call });
	// Rescues and cooldowns use the account's highest level, including other characters.
	var highest = await db
		.collection("character")
		.find({ owner: player.owner }, { projection: { level: 1 } })
		.sort({ level: -1 })
		.limit(1)
		.maxTimeMS(3000)
		.next();
	var account_level = Math.max(player.level, highest?.level || 0, saved?.level || 0);
	for (var sibling of Object.values(players))
		if (sibling.owner === player.owner) account_level = Math.max(account_level, sibling.level);
	if (!cavalry_player_active(player) || player.in !== call.in || G.maps[player.map].generated) throw Error("location");
	call.newcomer = account_level < cavalry_config().newcomer_level;
	var candidates = cavalry_monsters(call);
	if (!candidates.length) {
		var nearby = Object.values(instances[call.in]?.monsters || {}).filter((monster) =>
			cavalry_monster_nearby(call, monster),
		);
		if (nearby.length && nearby.every(cavalry_guarded)) throw Error("guarded");
		throw Object.assign(Error("no_monsters"), {
			phrase: !call.newcomer && nearby.length ? "interface.cavalry.not_threatened" : "interface.cavalry.no_monsters",
			phrase_args: !call.newcomer && nearby.length ? { level: String(account_level) } : {},
		});
	}
	call.targets = candidates
		.filter((monster) => !cavalry_guarded(monster))
		.sort((a, b) => distance(call, a) - distance(call, b))
		.slice(0, call.newcomer ? cavalry_config().newcomer_targets : cavalry_config().max_targets);
	if (!call.targets.length) throw Error("guarded");
	var level = Math.max(account_level, cavalry_nearby_level(call));
	for (var target of candidates)
		level = Math.max(level, cavalry_nearby_level(target), get_player(target.target)?.level || 0);
	call.next_call = Date.now() + cavalry_cooldown(level);
	call.expires = Date.now() + (call.newcomer ? cavalry_config().newcomer_duration : cavalry_config().duration);
	call.token = randomStr(24);
	try {
		// One indexed account mark arbitrates simultaneous calls across all game servers.
		await marks.updateOne(
			{ _id: id, next_call: { $lte: Date.now() } },
			{ $set: { next_call: call.next_call, token: call.token }, $max: { level: account_level } },
			{ upsert: true, maxTimeMS: 3000 },
		);
	} catch (error) {
		if (error.code !== 11000) throw error;
		saved = await marks.findOne({ _id: id }, { maxTimeMS: 3000 });
		throw Object.assign(Error("cooldown"), { next_call: saved?.next_call || call.next_call });
	}
	call.reservation = id;
	return call;
}

async function cavalry_interaction(player, data, socket) {
	var response = { response: "data", place: "interaction", interaction: "cavalry", request_id: data.request_id };
	var reason;
	if (!cavalry_player_active(player) || !player.owner) reason = "unavailable";
	else if (!player.items.some((item) => item && item.name === "tracker")) reason = "tracker";
	else if (!instances[player.in] || G.maps[player.map].generated) reason = "location";
	else if (cavalry_pending.has(player.owner)) reason = "unavailable";
	else {
		var call = cavalry_calls.get(player.id);
		if (!call || !cavalry_call_active(call)) {
			cavalry_pending.add(player.owner);
			try {
				call = await cavalry_reserve(player);
				if (!cavalry_player_active(player) || !player.items.some((item) => item && item.name === "tracker"))
					reason = "unavailable";
				else if (!cavalry_call_active(call)) reason = "no_monsters";
				else if (!cavalry_monsters(call).some((monster) => !cavalry_guarded(monster))) reason = "guarded";
				if (reason) await cavalry_release(call);
				else {
					cavalry_calls.set(player.id, call);
					cavalry_dispatch(Date.now());
				}
			} catch (error) {
				reason = ["cooldown", "no_monsters", "guarded", "location"].includes(error.message)
					? error.message
					: "unavailable";
				if (error.next_call) response.next_call = error.next_call;
				if (reason === "no_monsters" && error.phrase) {
					response.phrase = error.phrase;
					response.phrase_args = error.phrase_args;
				}
				if (reason === "unavailable") log_trace("cavalry call", error);
			} finally {
				cavalry_pending.delete(player.owner);
			}
		}
		if (!reason) {
			response.assigned = cavalry_members.filter(
				(id) => npcs[id] && cavalry_same_fight(npcs[id].cavalry_call, call),
			).length;
			response.next_call = call.next_call;
		}
	}
	if (reason) Object.assign(response, { failed: true, reason: reason });
	else Object.assign(response, { success: true, queued: !response.assigned });
	if (response.next_call) response.cooldown_ms = Math.max(0, response.next_call - Date.now());
	response.phrase = response.phrase || "interface.cavalry." + (reason || (response.queued ? "queued" : "coming"));
	response.phrase_args =
		response.phrase_args || (reason === "cooldown" ? { minutes: String(Math.ceil(response.cooldown_ms / 60000)) } : {});
	response.message = phrase(response.phrase, response.phrase_args, "en");
	socket.emit("game_response", response);
	return response;
}

function cavalry_same_fight(a, b) {
	return !!(a && b && a.in === b.in && distance(a, b) <= cavalry_config().range / 2);
}

function cavalry_prepare(npc) {
	if (npc.cavalry_ready) return;
	var def = npc.def,
		cls = G.classes[npc.type],
		weapon_attack = 0;
	npc.slots = clone(def.slots);
	npc.cslots = {};
	npc.hitchhikers = [];
	var stats = [
		"str",
		"int",
		"dex",
		"vit",
		"for",
		"armor",
		"resistance",
		"crit",
		"critdamage",
		"apiercing",
		"rpiercing",
	];
	for (var stat of stats) npc[stat] = def.cavalry[stat] || cls.stats[stat] || cls[stat] || 0;
	for (var slot in npc.slots) {
		var item = npc.slots[slot],
			properties = calculate_item_properties(item, { class: npc.type });
		npc.cslots[slot] = cache_item(item);
		for (var stat of stats) npc[stat] += properties[stat] || 0;
		if (slot === "mainhand" || slot === "offhand") weapon_attack += properties.attack;
	}
	npc.attack = Math.round(
		((cls.attack + weapon_stat_attack(npc.type, npc, weapon_attack)) * (npc.type === "priest" ? 1.6 : 1) * cls.output) /
			100,
	);
	npc.output = cls.output;
	npc.damage_type = cls.damage_type;
	npc.range = cls.range + calculate_item_properties(npc.slots.mainhand).range;
	npc.frequency = def.frequency;
	npc.attack_ms = Math.round(1000 / npc.frequency);
	npc.speed = def.speed;
	npc.max_hp = npc.hp = Math.round(cls.hp + npc.str * 21 + npc.vit * (48 + npc.level / 3));
	npc.max_mp = npc.mp = Math.round(cls.mp + npc.int * 15 + npc.level * 5);
	npc.mp_cost = cls.mp_cost;
	npc.heal = npc.type === "priest" ? Math.round(npc.attack / 5) : Math.round(npc.attack / 8);
	if (npc.type === "paladin") npc.p.paladin_aura = "bulwark";
	npc.cavalry_ready = true;
	if (npc.type === "warrior") npc.s.charging = { ms: 86400000 };
}

function cavalry_home(npc) {
	return G.maps.woffice.npcs.find((entry) => entry.id === npc.npc).position;
}

function cavalry_motion(npc, kind, dx, dy, delay) {
	var duration = kind === "blink" ? 320 : kind === "lunge" ? 220 : 620;
	npc.motion = {
		id: ++npc.m,
		kind: kind,
		dx: Math.round(dx),
		dy: Math.round(dy),
		delay: delay || 0,
		duration: duration,
		started: Date.now(),
	};
	npc.cavalry_ready_at = npc.motion.started + duration + (delay || 0);
	npc.u = npc.abs = true;
	npc.cid++;
}

function cavalry_position(npc, call, index) {
	var offsets = [
		[-38, 16],
		[38, 16],
		[-38, -26],
		[38, -26],
	];
	var offset = offsets[index % offsets.length];
	var spot = safe_xy_nearby(call.map, call.player.x + offset[0], call.player.y + offset[1]);
	if (!spot || distance(call, spot) > cavalry_config().range) return null;
	return spot;
}

function cavalry_assign(npc, call, index) {
	if (npc.cavalry_call === call) return;
	if (cavalry_same_fight(npc.cavalry_call, call)) {
		npc.cavalry_call = call;
		call.served = true;
		return;
	}
	var point = call ? cavalry_position(npc, call, index) : { x: cavalry_home(npc)[0], y: cavalry_home(npc)[1] };
	if (!point) return;
	clear_paladin_aura_source(npc);
	var destination = call ? call.in : "woffice";
	if (!transport_npc_to(npc, destination, point, true)) return;
	npc.cavalry_call = call || null;
	if (call) call.served = true;
	if (call) delete npc.direction;
	else npc.direction = cavalry_home(npc)[2] || 0;
	npc.target = null;
	npc.cavalry_next_blink = Date.now() + 8000 + Math.random() * 4000;
	cavalry_motion(npc, "arrival", (index % 2 ? 1 : -1) * 72, -64, index * 70);
}

function cavalry_dispatch(now) {
	cavalry_next_dispatch = now + 200;
	for (var [id, call] of cavalry_calls)
		if (!cavalry_call_active(call)) {
			cavalry_calls.delete(id);
			for (var monster of call.targets) if (cavalry_assisted.get(monster) === call) cavalry_assisted.delete(monster);
			void cavalry_release(call);
		}
	var calls = Array.from(cavalry_calls.values()).sort((a, b) => a.player.level - b.player.level || a.order - b.order);
	var fights = [];
	for (var call of calls) {
		if (!fights.some((fight) => cavalry_same_fight(fight.call, call))) fights.push({ call: call, members: [] });
	}
	fights = fights.slice(0, 4);
	var members = cavalry_members.map((id) => npcs[id]).filter(Boolean);
	for (var npc of members) cavalry_prepare(npc);
	if (!fights.length) {
		for (var npc of members) if (npc.cavalry_call) cavalry_assign(npc, null, members.indexOf(npc));
		return;
	}
	for (var i = 0; i < fights.length; i++)
		fights[i].size = Math.floor(members.length / fights.length) + (i < members.length % fights.length ? 1 : 0);
	var spare = [];
	// Retain the earliest pair together; then split each pair only when needed.
	for (var npc of members) {
		var fight = fights.find((fight) => cavalry_same_fight(fight.call, npc.cavalry_call));
		if (fight && fight.members.length < fight.size) fight.members.push(npc);
		else spare.push(npc);
	}
	for (var fight of fights) {
		while (fight.members.length < fight.size) fight.members.push(spare.shift());
		for (var npc of fight.members) cavalry_assign(npc, fight.call, fight.members.indexOf(npc));
	}
}

function cavalry_reward_player(npc, monster) {
	if (!is_cavalry(npc)) return npc;
	var target = monster && get_player(monster.target);
	if (cavalry_player_active(target) && target.in === npc.in) return target;
	var caller = npc.cavalry_call && npc.cavalry_call.player;
	return cavalry_player_active(caller) && caller.in === npc.in ? caller : null;
}

function cavalry_attack_valid(npc, target, info) {
	if (!is_cavalry(npc)) return true;
	var call = npc.cavalry_call;
	return !!(
		call &&
		target &&
		Date.now() < call.expires &&
		cavalry_calls.get(call.player.id) === call &&
		cavalry_player_active(call.player) &&
		call.player.in === call.in &&
		distance(call, call.player) <= cavalry_config().range &&
		npc.in === target.in &&
		npc.in === call.in &&
		distance(call, target) <= cavalry_config().range &&
		(target.is_monster
			? call.targets.includes(target) &&
				instances[call.in]?.monsters[target.id] === target &&
				cavalry_monster_eligible(call, target) &&
				!cavalry_guarded(target)
			: cavalry_player_active(target)) &&
		// Ranged shots already in flight can finish. Melee must still be within reach at impact.
		((info && target.is_monster && (npc.type === "mage" || npc.type === "priest")) ||
			distance(npc, target) <= (target.is_monster ? npc.range : 140)) &&
		can_move({ map: npc.map, x: npc.x, y: npc.y, going_x: target.x, going_y: target.y, base: npc.base })
	);
}

function cavalry_support(npc, now) {
	if (npc.type !== "priest" && npc.type !== "paladin") return;
	if (now < (npc.cavalry_next_support || 0)) return;
	npc.cavalry_next_support = now + (npc.type === "priest" ? 650 : 1800);
	var caller = npc.cavalry_call.player;
	var allies = Object.values(instances[npc.in].players).filter(
		(player) =>
			cavalry_player_active(player) &&
			distance(npc, player) <= 240 &&
			(!is_in_pvp(player) || is_same(caller, player, 3)),
	);
	allies.sort((a, b) => a.hp / a.max_hp - b.hp / b.max_hp);
	var hurt = allies.find((player) => player.hp < player.max_hp * (npc.type === "priest" ? 0.65 : 0.45));
	if (hurt) commence_attack(npc, hurt, "heal");
	if (npc.type === "paladin") {
		var blessed = [];
		for (var ally of allies) {
			if (!ally.s.beacon_of_resolve) {
				add_condition(ally, "beacon_of_resolve", { ms: 4000, f: npc.name });
				resend(ally, "u+cid");
				blessed.push(ally.name);
			}
		}
		if (blessed.length) xy_emit(npc, "ui", { type: "beacon_of_resolve", name: npc.id, targets: blessed });
	}
}

function cavalry_fight(npc, now) {
	var call = npc.cavalry_call;
	if (!call || now < npc.cavalry_ready_at) return;
	var targets = cavalry_monsters(call)
		.filter((monster) => !cavalry_guarded(monster))
		.sort((a, b) => distance(npc, a) - distance(npc, b));
	var target = targets[0];
	if (!target) return;
	cavalry_support(npc, now);
	var blink = npc.type === "mage" && now >= npc.cavalry_next_blink;
	if (distance(npc, target) > npc.range * 0.85 || !cavalry_attack_valid(npc, target) || blink) {
		if (now < (npc.cavalry_next_move || 0)) return;
		npc.cavalry_next_move = now + 450;
		// A blocked blink is skipped rather than retried every tick instead of attacking.
		if (blink) npc.cavalry_next_blink = now + 8000 + Math.random() * 4000;
		var angle = Math.atan2(npc.y - target.y, npc.x - target.x) + (blink ? Math.PI / 3 : 0);
		var reach = npc.range * 0.65;
		var spot = safe_xy_nearby(npc.map, target.x + Math.cos(angle) * reach, target.y + Math.sin(angle) * reach);
		if (!spot || distance(call, spot) > cavalry_config().range) return;
		if (blink) {
			var dx = npc.x - spot.x,
				dy = npc.y - spot.y;
			if (transport_npc_to(npc, npc.in, spot)) {
				cavalry_motion(npc, "blink", dx, dy);
			}
		} else if (!citizen_move_to(npc, spot.x, spot.y)) {
			var step = fast_astar({ map: npc.map, sx: npc.x, sy: npc.y, tx: spot.x, ty: spot.y });
			if (step) citizen_move_to(npc, step[0], step[1]);
		}
		return;
	}
	if (now - +npc.last.attack < npc.attack_ms) return;
	npc.last.attack = new Date(now);
	var shots = npc.type === "mage" ? 3 : 1;
	for (var i = 0; i < shots; i++) {
		var victim = targets[i % targets.length];
		if (distance(npc, victim) <= npc.range && cavalry_attack_valid(npc, victim)) {
			npc.volley_offset = shots === 3 ? (i - 1) * 16 : 0;
			commence_attack(npc, victim, "attack");
		}
	}
	delete npc.volley_offset;
}

function cavalry_tick() {
	var now = Date.now();
	if (now >= cavalry_next_dispatch) cavalry_dispatch(now);
	for (var id of cavalry_members) {
		var npc = npcs[id];
		if (!npc) continue;
		cavalry_prepare(npc);
		npc.hitchhikers.length = 0;
		npc.mp = npc.max_mp;
		if (npc.type === "warrior") npc.s.charging = { ms: 86400000 };
		if (npc.motion && now > npc.motion.started + npc.motion.delay + npc.motion.duration + 200) delete npc.motion;
		cavalry_fight(npc, now);
	}
}
