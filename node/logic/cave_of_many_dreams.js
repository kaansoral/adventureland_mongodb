// Shared server scope. Content owns choices and actors; generated_maps owns admission and travel.
async function cave_enter_effect(members, key) {
	var now = Date.now(),
		duration = 1800;
	for (var p of members) {
		p.zone_entering = key;
		p.moving = false;
		p.vx = p.vy = 0;
		p.going_x = p.x;
		p.going_y = p.y;
		p.u = true;
		p.cid++;
		p.socket.emit("player", player_to_client(p));
	}
	// One nearby broadcast: spectators see the party, only entrants shake their cameras.
	xy_emit(members[0], "ui", { type: "cave_enter", names: members.map((p) => p.name), duration, key });
	try {
		await new Promise((resolve) => setTimeout(resolve, duration));
	} finally {
		var elapsed = Date.now() - now;
		for (var projectile of Object.values(projectiles))
			if (members.includes(projectile.attacker) || members.includes(projectile.target))
				projectile.eta = new Date(+projectile.eta + elapsed);
		for (var p of members) {
			if (p.zone_entering !== key) continue;
			shift_entity_timers(p, elapsed);
			delete p.zone_entering;
		}
	}
}
function cave_random() {
	return crypto.randomInt(0x100000000) / 0x100000000;
}
function cave_pick(values) {
	return values[Math.floor(cave_random() * values.length)];
}
function cave_shuffle(values) {
	var out = values.slice();
	for (var i = out.length - 1; i > 0; i--) {
		var j = Math.floor(cave_random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
function cave_players(run) {
	return run.members
		.filter((m) => !m.left)
		.map((m) => {
			var player = get_player(m.name);
			return player?.real_id === m.character && player.owner === m.owner ? player : null;
		})
		.filter((p) => p && generated_entry(p)?.record === run && !p.dc && !p.socket.disconnected);
}
function cave_say(run, message) {
	var packet = message && typeof message === "object" ? message : { message };
	if (run.cave?.resolving) {
		run.cave.resolving.summary.push(packet.message);
		(run.cave.resolving.summary_messages ||= []).push(packet.phrase ? packet : null);
	}
	for (var p of cave_players(run)) p.socket.emit("game_log", Object.assign({ color: "#D4BB88" }, packet));
}
function cave_reply_label(room, option) {
	return (option.label || "Walk away")
		.replaceAll("{npc}", room.npc?.name || "the traveler")
		.replaceAll("{rival}", room.rival?.name || "the other fighter");
}
function cave_dialogue_ref(room, field) {
	var id = "event.dreams." + room.encounter?.id + "." + field;
	if (room.kind === "revival")
		id = {
			name: "server.cave.revival_title",
			text: "server.cave.revival_text",
			"options.here.label": "server.cave.revival_each",
			"options.landing.label": "server.cave.revival_landing",
		}[field];
	if (!id || !Object.hasOwn(localization.catalog("en"), id)) return;
	return {
		phrase: id,
		phrase_args: {
			npc: room.npc?.name || { phrase: "server.cave.traveler" },
			rival: room.rival?.name || { phrase: "server.cave.rival" },
		},
	};
}
function cave_receipt(run, receipt) {
	if (!run.cave.receipts) run.cave.receipts = [];
	receipt.id = run.cave.serial = (run.cave.serial || 0) + 1;
	run.cave.receipts.push(receipt);
	if (run.cave.receipts.length > 12) run.cave.receipts.shift();
	return receipt;
}
function cave_start(run) {
	run.cave = {
		gold: 0,
		amber: 0,
		gold_earned: 0,
		amber_earned: 0,
		claimed: new Set(),
		chests: new Set(),
		rooms: [],
		actors: new Set(),
		vote: null,
		serial: 0,
		last_publish: 0,
		flags: {},
		kills: {},
		issued: 0,
		receipts: [],
	};
	var pool = cave_shuffle(G.events.dreams.encounters.filter((e) => !["e20", "e31"].includes(e.id)));
	for (var i = 0; i < run.floors.length; i++) {
		var floor = run.manifest[i],
			start = floor.definition.spawns[0];
		var rooms = floor.definition.rooms
			.filter((r) => r.bounds[2] - r.bounds[0] >= 192 && r.bounds[3] - r.bounds[1] >= 192)
			.sort((a, b) => Math.hypot(a.x - start[0], a.y - start[1]) - Math.hypot(b.x - start[0], b.y - start[1]));
		var chosen = [
			rooms[2],
			rooms[Math.floor(rooms.length * 0.36)],
			rooms[Math.floor(rooms.length * 0.72)],
			rooms[5],
			rooms[Math.floor(rooms.length * 0.5)],
			rooms[rooms.length - 2],
		];
		// Every floor has a shop near its doorway, clear of the walking route.
		var shopHome = rooms[0];
		run.cave.rooms.push({
			id: i + ":shop",
			floor: i,
			map: floor.key,
			x: shopHome.x,
			y: shopHome.y,
			bounds: shopHome.bounds,
			required: false,
			kind: "encounter",
			encounter: G.events.dreams.encounters.find((e) => e.id === "e31"),
			started: false,
			done: false,
			actors: [],
			enemies: [],
			reward: false,
		});
		for (var ambient of rooms.filter(
			(r) => !chosen.includes(r) && r !== rooms[0] && r !== rooms[1] && r !== rooms[rooms.length - 1],
		)) {
			run.cave.rooms.push({
				id: i + ":patrol:" + ambient.id,
				kind: "patrol",
				floor: i,
				map: floor.key,
				x: ambient.x,
				y: ambient.y,
				bounds: ambient.bounds,
				required: false,
				started: false,
				done: false,
				actors: [],
				enemies: [],
			});
		}
		for (var extra of [rooms[1], rooms[rooms.length - 1]]) {
			run.cave.rooms.push({
				id: i + ":farm:" + extra.id,
				floor: i,
				map: floor.key,
				x: extra.x,
				y: extra.y,
				bounds: extra.bounds,
				required: false,
				kind: "farm",
				started: false,
				done: false,
				actors: [],
				enemies: [],
				waves: 0,
			});
		}
		for (var j = 0; j < chosen.length; j++) {
			var room = chosen[j];
			var encounter = j === 1 ? pool.shift() : j >= 3 ? pool.shift() : null;
			if (i === 1 && j === 3) encounter = G.events.dreams.encounters.find((e) => e.id === "e20");
			run.cave.rooms.push({
				id: i + ":" + j,
				floor: i,
				map: floor.key,
				x: room.x,
				y: room.y,
				bounds: room.bounds,
				required: j < 3,
				kind: j === 0 ? "fight" : j === 2 ? "boss" : "encounter",
				encounter,
				started: false,
				done: false,
				actors: [],
				enemies: [],
				reward: false,
			});
		}
	}
	for (var i = 0; i < run.floors.length; i++) {
		var homes = run.cave.rooms.filter((r) => r.floor === i && r.kind === "farm");
		var travelers = cave_shuffle(G.events.dreams.travelers.slice());
		for (var home of homes)
			run.cave.rooms.push({
				id: home.id + ":traveler",
				kind: "citizen",
				floor: i,
				map: home.map,
				x: home.x - 64,
				y: home.y,
				bounds: home.bounds,
				actors: [],
				enemies: [],
				look: travelers.pop(),
				started: false,
				done: false,
			});
	}
	for (var room of run.cave.rooms) {
		if (["farm", "patrol"].includes(room.kind)) {
			var camps = G.events.dreams.camps[room.floor];
			room.camp = cave_pick(camps);
			room.name = room.camp.name;
			room.name_message = { phrase: "event.dreams.camp." + room.floor + "." + camps.indexOf(room.camp) + ".name" };
		}
	}
	if (cave_random() < G.events.dreams.rare.darkmage) {
		var rare = run.cave.rooms.find((r) => r.floor === 2 && r.kind === "encounter" && !r.required);
		rare.kind = "darkmage";
		rare.encounter = null;
	}
}
function cave_spawn(run, room, type, side, offset = 0, look) {
	if (room.kind !== "revival" && ((!room.required && run.cave.issued >= 512) || run.cave.actors.size >= 64))
		return null;
	var origin = safe_xy_nearby(room.map, room.x, room.y + 48);
	if (!origin) return null;
	var shift = typeof offset === "number" ? { x: offset, y: 48 } : offset;
	var point = safe_xy_nearby(room.map, room.x + shift.x, room.y + shift.y) || origin;
	var actor = new_monster(room.map, { type, position: [point.x, point.y], radius: 0, gold: 0 }, { temp: true });
	if (!actor) return null;
	actor.x = origin.x;
	actor.y = origin.y;
	var placement = calculate_move(actor, point.x, point.y);
	if (closest_line(room.map, placement.x, placement.y) < 16) placement = origin;
	actor.x = placement.x;
	actor.y = placement.y;
	var scale = 1 + Math.pow(run.level / 14, 2),
		depth = 1 + room.floor * 0.32;
	actor.zone_actor = {
		run: run.key,
		room: room.id,
		side,
		predator: side === "predator",
		idle: side === "neutral",
		next: 0,
		home: { x: actor.x, y: actor.y },
		next_wander: Date.now() + 2000 + Math.floor(cave_random() * 3000),
	};
	actor.angle = Math.floor(cave_random() * 4) * 90;
	actor.zone_stats = {
		attack: Math.round((type === "cave_npc" || type === "cave_rogue" ? 18 : 12) * (1 + run.level / 5) * depth),
		speed: 40 + Math.min(30, run.level / 3),
		frequency: 1.1,
		armor: Math.round(run.level * 1.5),
		resistance: Math.round(run.level),
	};
	actor.name = G.monsters[type].name || type;
	actor.level = run.level;
	actor.hp = actor.max_hp = Math.round((["enemy", "predator"].includes(side) ? 130 : 700) * scale * depth);
	// Preserve the species' pace and defenses as the cave scales with the party.
	var species = G.monsters[type];
	if (!species.humanoid && !["cave_lockbreaker", "cave_sentinel", "cave_mothkeeper", "cave_darkmage"].includes(type)) {
		actor.zone_stats.speed = Math.max(24, Math.min(85, species.speed));
		actor.zone_stats.frequency = Math.max(0.6, Math.min(1.8, species.frequency));
		actor.zone_stats.armor += species.armor || 0;
		actor.zone_stats.resistance += species.resistance || 0;
	}
	cave_set_side(actor, side);
	actor.gold = 0;
	actor.mult = 1;
	actor.luckx = 1;
	actor.aggro = 0;
	actor.target = null;
	actor.last_level = future_s(86400);
	actor.zone_actor.initial_hp = actor.hp;
	if (look) {
		actor.name = look.name;
		actor.skin = look.skin;
		actor.cx = Object.assign({}, look.cx);
	}
	if (G.monsters[type].humanoid && !actor.cx?.head) {
		actor.cx = Object.assign(
			{
				head: cave_pick(["mmakeup01", "fmakeup02", "mmakeup04"]),
				hair: cave_pick(["hairdo105", "hairdo206", "hairdo219"]),
			},
			actor.cx,
		);
	}
	if (type === "cave_guard") actor.slots = { mainhand: { name: "blade", level: 0 } };
	if (type === "cave_broodmother") {
		actor.hp = actor.max_hp = Math.round(600 * scale * depth);
		actor.zone_stats.attack *= 1.6;
		actor.zone_stats.speed = 28;
		actor.zone_actor.brood = true;
	}
	if (type === "cave_darkmage") {
		Object.assign(actor.zone_stats, { attack: 100000, frequency: 0.25, armor: 0, resistance: 0 });
		actor.hp = actor.max_hp = 1000;
		actor.range = 320;
		actor.cx = { head: "numakeup23" };
		actor.slots = { mainhand: { name: "cave_blackstaff", level: 0 } };
		actor.zone_actor.next = Date.now() + 6000;
	}
	if (type === "cave_rogue") {
		actor.zone_actor.rare = cave_random() < G.events.dreams.rare.rogue_weapon;
		actor.zone_actor.strength = cave_pick([0.75, 1, 1.25]);
		actor.hp = actor.max_hp = Math.round(actor.max_hp * actor.zone_actor.strength);
		actor.zone_stats.attack *= actor.zone_actor.strength * (actor.zone_actor.rare ? 1.6 : 1);
		actor.zone_stats.frequency = actor.zone_actor.rare ? 2.2 : 1.5;
		actor.slots = {
			mainhand: { name: actor.zone_actor.rare ? "cave_backstabber" : "dagger", level: 0 },
			offhand: { name: "dagger", level: 0 },
		};
		actor.cx = Object.assign({ head: "mmakeup01", hair: "hairdo206" }, actor.cx);
	}
	if (type.startsWith("cave_") && ["cave_lockbreaker", "cave_sentinel", "cave_mothkeeper"].includes(type)) {
		actor.hp = actor.max_hp = Math.round(1200 * scale * depth);
		actor.zone_stats.attack *= 2.2;
		actor.zone_stats.frequency = 0.65;
		actor.zone_actor.boss = true;
		actor.zone_actor.phase = 0;
	}
	calculate_monster_stats(actor);
	actor.u = true;
	actor.cid = (actor.cid || 0) + 1;
	run.cave.actors.add(actor);
	room.actors.push(actor);
	if (side === "enemy") room.enemies.push(actor);
	run.cave.issued++;
	return actor;
}
function cave_pack(run, room, type, count, side = "enemy") {
	var pack = [];
	for (var i = 0; i < count; i++) {
		var angle = (i * Math.PI * 2) / Math.max(1, count) + (room.waves || 0);
		var radius = count === 1 ? 0 : 64 + (i % 2) * 32;
		var m = cave_spawn(run, room, type, side, {
			x: Math.round(Math.cos(angle) * radius),
			y: Math.round(Math.sin(angle) * radius) + 24,
		});

		if (m) pack.push(m);
	}
	return pack;
}
function cave_activate(run, room) {
	if (run.cave.actors.size > 52 || (!room.required && room.kind !== "citizen" && run.cave.issued >= 512)) return;
	room.started = true;
	if (room.kind === "citizen") {
		room.npc = cave_spawn(run, room, "cave_npc", "neutral", 0, room.look);
		if (!room.npc) {
			room.started = false;
			return;
		}
		room.npc.zone_actor.citizen = true;
		room.npc.zone_stats.speed = 46;
		calculate_monster_stats(room.npc);
		return;
	}
	if (room.kind === "patrol" || room.kind === "farm") {
		if (room.kind === "farm") room.waves++;
		var camp = room.camp || G.events.dreams.camps[room.floor][0];
		var pack = camp.packs[((room.waves || 1) - 1) % camp.packs.length];
		for (var group of pack) cave_pack(run, room, group[0], room.kind === "patrol" ? Math.min(3, group[1]) : group[1]);
		room.engaged = false;
		return;
	}
	if (room.kind === "fight" && run.cave.flags.truce) {
		delete run.cave.flags.truce;
		cave_say(run, localization.message("server.cave.pass_accepted"));
		cave_complete(run, room);
		return;
	}
	if (room.kind === "fight") {
		cave_pack(run, room, "cave_guard", 4);
		cave_pack(run, room, ["cave_wolf", "cave_scorpion", "cave_spider"][room.floor], 2);
		return;
	}
	if (room.kind === "boss") {
		cave_spawn(run, room, ["cave_lockbreaker", "cave_sentinel", "cave_mothkeeper"][room.floor], "enemy");
		cave_pack(run, room, room.floor === 2 ? "cave_bat" : "cave_guard", 2);
		return;
	}
	if (room.kind === "darkmage") {
		cave_spawn(run, room, "cave_darkmage", "enemy");
		cave_say(run, localization.message("server.cave.darkmage_warning"));
		return;
	}
	var e = room.encounter,
		look = cave_pick(G.events.dreams.cast[e.actor]);
	var offset = 0;
	if (e.kind === "merchant" && room.bounds) {
		var b = room.bounds,
			point;
		// Chamfered corners and nearby doors can rule out the first wall position.
		merchant_position: for (var dy of [96, 128, 160])
			for (var dx = 64; dx <= (b[2] - b[0]) / 2; dx += 32)
				for (var x of [b[0] + dx, b[2] - dx]) {
					var y = b[1] + dy;
					if (!is_xy_safe(room.map, x, y) || closest_line(room.map, x, y) < 32) continue;
					if (G.maps[room.map].spawns.some((p) => Math.hypot(x - p[0], y - p[1]) < 112)) continue;
					point = { x, y };
					break merchant_position;
				}
		if (!point) {
			room.started = false;
			return;
		}
		room.x = point.x;
		room.y = point.y;
		offset = { x: 0, y: 0 };
	}
	room.npc = cave_spawn(run, room, e.kind === "rogue" ? "cave_rogue" : "cave_npc", "neutral", offset, look);
	if (!room.npc) {
		room.started = false;
		return;
	}
	if (e.group === "bad") {
		room.guards = cave_pack(run, room, "cave_guard", 3, "neutral");
		for (var guard of room.guards) guard.zone_actor.staged = true;
	}
	if (["rescue", "rogue"].includes(e.kind)) {
		cave_set_side(room.npc, "victim");
		room.npc.zone_actor.idle = false;
		cave_pack(run, room, "cave_wolf", cave_pick([3, 4, 6]), "predator").forEach((m) => {
			m.zone_actor.prey = room.npc;
		});
		room.rescue = true;
		var cargo = { items: [], gold: 0, cash: 0 };
		chest_exchange(cargo, "cave_parcel");
		room.cargo = cargo.items;
	}
	if (["conflict", "twins"].includes(e.kind)) {
		var rivalLook = cave_pick(G.events.dreams.cast.duelist.filter((candidate) => candidate.name !== look.name));
		if (e.kind === "twins") rivalLook = { name: rivalLook.name, skin: look.skin, cx: Object.assign({}, look.cx) };
		room.rival = cave_spawn(run, room, "cave_npc", "neutral", 112, rivalLook);
		for (var m of [room.npc, room.rival]) {
			var strength = cave_pick([0.55, 1, 1.8]);
			m.hp = m.max_hp = Math.round(m.hp * strength);
			m.zone_stats.attack *= strength;
			m.slots = { mainhand: { name: strength > 1 ? "fireblade" : "blade", level: 0 } };
			calculate_monster_stats(m);
		}
	}
	if (e.kind === "merchant") {
		room.npc.zone_actor.stationary = true;
		var stock = cave_pick(G.events.dreams.merchant_stock);
		room.stock = { name: stock[0], price: stock[1], sold: false };
	}
}
function cave_chest_point(run, source, exclude) {
	var origin = { x: source.x, y: source.y };
	if (!generated_maps[source.map]) return origin; // An unloaded floor is placed when it returns.
	var nearby = Array.from(run.cave.chests, (id) => chests[id]).filter(
		(c) => c && c !== exclude && c.in === source.map && Math.hypot(c.x - origin.x, c.y - origin.y) < 320,
	);
	var doors = G.maps[source.map].doors || [];
	var point = safe_xy_nearby(source.map, origin.x, origin.y);
	function clear(p) {
		return (
			p &&
			is_xy_safe(source.map, p.x, p.y) &&
			can_move({ map: source.map, x: origin.x, y: origin.y, going_x: p.x, going_y: p.y }) &&
			!nearby.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 36) &&
			!doors.some((d) => Math.abs(p.x - d[0]) < d[2] / 2 + 24 && Math.abs(p.y - d[1]) < d[3] / 2 + 24)
		);
	}
	if (clear(point)) return point;
	// Bounded rings keep adjacent drops separate without rolling rewards again.
	var angle = cave_random() * Math.PI * 2;
	for (var radius = 40; radius <= 160; radius += 40)
		for (var i = 0; i < 12; i++) {
			var a = angle + (i * Math.PI) / 6;
			var candidate = safe_xy_nearby(source.map, origin.x + Math.cos(a) * radius, origin.y + Math.sin(a) * radius);
			if (clear(candidate)) return candidate;
		}
	return point || origin;
}
function cave_credit(run, gold, amber, source) {
	var state = run.cave,
		rules = G.events.dreams;
	gold = Math.max(0, Math.min(gold || 0, rules.gold_limit - state.gold_earned));
	amber = Math.max(0, Math.min(amber || 0, rules.amber_limit - state.amber_earned));
	if (!gold && !amber) return;
	var people = cave_players(run);
	source = source || state.resolving?.room || people[0];
	if (!source) return;
	var player = people.find((p) => p.map === source.map) || people[0];
	if (!player) return;
	var point = cave_chest_point(run, source);
	// Shared currency takes no inventory slots, including for automatic loot.
	var drop = { items: [], cash: 0, amber, cave: run.key, unplaced: !generated_maps[source.map] };
	var id = drop_one_thing(player, [], {
		reserved: drop,
		gold,
		chest: "cavechest",
		map: source.map,
		in: source.map,
		x: point.x,
		y: point.y,
	});
	state.chests.add(id);
	// Reserve the daily allowance once, when the chest is made. Opening it
	// moves those same amounts into the purse without rolling or multiplying.
	state.gold_earned += gold;
	state.amber_earned += amber;
	for (var currency of ["gold", "amber"])
		if (state[currency + "_earned"] >= rules[currency + "_limit"] && !state[currency + "_limit_notice"]) {
			state[currency + "_limit_notice"] = true;
			cave_say(run, localization.message("server.cave." + currency + "_limit", { amount: rules[currency + "_limit"] }));
		}
	for (var other of people) if (other !== player && other.map === drop.map) cave_send_chest(other.socket, id, drop);
	return id;
}
function cave_send_chest(socket, id, chest) {
	socket.emit("drop", { id, x: chest.x, y: chest.y, map: chest.map, chest: chest.chest, items: chest.items.length });
}
function cave_send_chests(run, socket, map) {
	for (var id of run.cave?.chests || []) {
		var chest = chests[id];
		if (chest?.map === map) {
			if (chest.unplaced) {
				Object.assign(chest, cave_chest_point(run, chest, chest));
				delete chest.unplaced;
			}
			cave_send_chest(socket, id, chest);
		}
	}
}
function cave_open_chest(player, chest, id) {
	var run = generated_runs[chest.cave],
		member = generated_member(run, player);
	if (
		!run ||
		run.closing ||
		!member ||
		member.left ||
		generated_entry(player)?.record !== run ||
		player.map !== chest.map ||
		player.in !== chest.in ||
		player.rip ||
		run.expires <= generated_clock(run)
	)
		return { failed: true, reason: "loot_failed" };
	if (run.paused_at) return { failed: true, reason: "cave_paused" };
	if (simple_distance(player, chest) > 400) return { failed: true, reason: "loot_failed" };
	if (chests[id] !== chest || !run.cave.chests.delete(id)) return { failed: true, reason: "loot_failed" };
	delete chests[id];
	var gold = chest.gold,
		amber = chest.amber || 0;
	run.cave.gold += gold;
	run.cave.amber += amber;
	cave_receipt(run, { where: "purse", gold, amber, map: chest.map, x: chest.x, y: chest.y });
	var result = { id, opener: player.name, gold: 0, goldm: 1, items: [], cave: { gold, amber, shared: true } };
	for (var p of cave_players(run)) p.socket.emit("chest_opened", result);
	cave_publish(run);
	return result;
}
function cave_item(run, token, name, quantity) {
	var chest = { items: [], gold: 0, cash: 0 };
	drop_item_logic(chest, [1, name, quantity], false);
	return cave_deliver(run, token, chest.items);
}
function cave_reward(run, room, table, items) {
	if (room.reward) return;
	room.reward = true;
	var token = room.id + ":reward";
	if (run.cave.claimed.has(token)) return;
	var chest = { items: items || [], gold: 0, cash: 0 };
	if (table) chest_exchange(chest, table);
	var amber = chest.items.reduce((sum, item) => sum + (item.name === "cave_amber" ? item.q || 1 : 0), 0);
	// Keep the normal reward table and item delivery. Cave currency waits
	// in a visible chest until the party collects it.
	cave_deliver(
		run,
		token,
		chest.items.filter((item) => item.name !== "cave_amber"),
	);
	cave_credit(run, chest.gold, amber, room);
}
function cave_deliver(run, token, items) {
	if (run.cave.claimed.has(token)) return;
	run.cave.claimed.add(token);
	// Select from the admission roster, never a mutable party or current room.
	var recipient = cave_pick(run.members),
		player = get_player(recipient.name);
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		item.p = "cavefound";
		var receipt = cave_receipt(run, {
			item: Object.assign({}, item),
			recipient: recipient.name,
			where: "mail_pending",
		});
		if (
			player &&
			!player.dc &&
			!player.socket.disconnected &&
			player.real_id === recipient.character &&
			player.owner === recipient.owner &&
			can_add_item(player, item)
		) {
			receipt.slot = add_item(player, item, { announce: false });
			receipt.where = "inventory";
			resend(player, "reopen+inv");
		} else {
			// Existing mail claims handle offline/full inventories. The award ID is stable.
			void cave_mail(recipient, item, run.key + ":" + token + ":" + i)
				.then(() => {
					receipt.where = "mail";
					if (!run.closing) cave_publish(run);
				})
				.catch((e) => log_trace("cave reward mail", e));
		}
		cave_say(
			run,
			localization.message(receipt.where === "inventory" ? "server.cave.reward_inventory" : "server.cave.reward_mail", {
				name: recipient.name,
				quantity: item.q || 1,
				item: G.items[item.name].name,
				slot: receipt.slot + 1,
			}),
		);
	}
	return recipient;
}
async function cave_mail(recipient, item, id, attempt = 0) {
	cave_mail.pending = (cave_mail.pending || 0) + 1;
	try {
		var result = await tx(
			async () => {
				if (await tx_get("ML_cave:" + A.id)) return;
				await tx_save({
					_id: "ML_cave:" + A.id,
					type: "mail",
					created: new Date(),
					read: false,
					item: true,
					taken: false,
					fro: "Dorr",
					to: A.recipient.name,
					owner: [A.recipient.owner],
					character: A.recipient.character,
					cave_award: true,
					info: {
						sender: A.recipient.owner,
						receiver: A.recipient.owner,
						subject: "From the cave",
						message: "I kept your cave reward safe. Collect it with the character named on this letter.",
						item: JSON.stringify(A.item),
					},
					blobs: ["info"],
				});
				R.created = true;
			},
			{ recipient, item, id },
		);
		if (result.failed) {
			if (attempt >= 4) throw Error(result.reason);
			await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
			return cave_mail(recipient, item, id, attempt + 1);
		}
		try {
			var count = await update_mail_count(recipient.owner);
			for (var player of Object.values(players))
				if (player.owner === recipient.owner && !player.dc && !player.socket.disconnected) {
					player.socket.emit("game_response", { response: "mail_received", count });
					if (result.created)
						player.socket.emit(
							"game_log",
							localization.message("cave.in_mail", { name: recipient.name }, { color: "#D4BB88" }),
						);
				}
		} catch (e) {
			log_trace("cave mail count", e);
		}
	} finally {
		cave_mail.pending--;
	}
}
function cave_pending() {
	return !!(cave_mail.pending || generated_refund_visit.pending);
}
function cave_settle_purse(run) {
	var state = run.cave;
	// Cave gold stays with the run. Only unspent Amber leaves the cave.
	if (state.amber) {
		var amber = state.amber;
		state.amber = 0;
		cave_item(run, "amber:" + ++state.serial, "cave_amber", amber);
	}
}
function cave_complete(run, room) {
	if (room.done) return;
	room.done = true;
	if (
		room.npc &&
		!room.npc.dead &&
		!room.npc.zone_actor.follow &&
		!room.stock &&
		room.kind !== "revival" &&
		!room.practice &&
		!room.npc.zone_actor.betrayed
	) {
		room.npc.zone_actor.depart_at = Date.now() + 3500;
		room.npc.zone_actor.idle = false;
	}
	for (var guard of room.guards || [])
		if (!guard.dead && guard.zone_actor.side === "neutral") {
			guard.zone_actor.depart_at = Date.now() + 1500;
			guard.zone_actor.idle = false;
		}
	if (room.kind === "boss") {
		cave_reward(run, room, "cave_boss");
		cave_credit(run, 4000, 0, room);
	} else if (room.kind === "fight") cave_credit(run, 2000, 1, room);
	var required = run.cave.rooms.filter((r) => r.floor === room.floor && r.required);
	if (required.every((r) => r.done) && !run.completed[room.floor]) {
		run.completed[room.floor] = true;
		cave_say(run, localization.message(room.floor === 2 ? "server.cave.last_seal" : "server.cave.stairs_open"));
		if (room.floor === 2) {
			cave_reward(run, { id: "finish", map: room.map, x: room.x, y: room.y }, "cave_finish");
			cave_credit(run, 10000, 5, room);
			cave_settle_purse(run);
		}
	}
	cave_publish(run);
}
function cave_begin_vote(run, room) {
	var state = run.cave;
	if ((state.vote && !state.vote.resolved) || room.voted || !room.encounter || room.npc?.dead) return;
	var e = room.encounter;
	var offers = e.options.filter((o) => o.offer);
	var usable = (o) =>
		(!o.needs || state.flags?.[o.needs]) && (o.cost || 0) <= (state.gold || 0) && (o.amber || 0) <= (state.amber || 0);
	var affordable = offers.filter(usable);
	var first = cave_pick(
		affordable.length ? affordable : offers.length ? offers : e.options.filter((o) => o.effect !== "leave"),
	);
	var others = e.options.filter((o) => o !== first && usable(o));
	var replies = [first, cave_pick(others.length ? others : e.options.filter((o) => o !== first))];
	if (e.options.length === 2) replies = e.options.slice();
	room.voted = true;
	var voters = run.members.filter((m) => !m.left).map((m) => m.character);
	state.vote = {
		id: run.key + ":" + ++state.serial,
		room,
		deadline: Date.now() + G.events.dreams.vote_ms,
		voters,
		votes: Object.create(null),
		options: replies,
		fallback: e.group === "bad" ? "time" : "leave",
		resolved: false,
	};
	room.vote = state.vote;
	for (var p of cave_players(run)) delete p.cave_room;
	var listener = cave_players(run).find((p) => p.map === room.map && !p.rip);
	if (listener && room.npc) cave_face(room.npc, room.rival || listener);
	if (room.rival) cave_face(room.rival, room.npc);
	cave_pause(run);
	cave_publish(run, true);
}
function cave_pause(run, now = Date.now()) {
	if (run.paused_at) return;
	run.paused_at = now;
	for (var key of run.floors) freeze_instance(instances[key], now);
}
function cave_resume(run, now = Date.now()) {
	if (!run.paused_at) return;
	var ms = now - run.paused_at;
	run.expires += ms;
	for (var room of run.cave.rooms) {
		for (var key of ["last_near", "harvest", "wait_until", "next_wave", "practice_end"]) if (room[key]) room[key] += ms;
		if (room.hunt) room.hunt.deadline += ms;
		for (var actor of [...room.actors, ...(room.saved || [])]) {
			for (var key of [
				"next",
				"last_path",
				"jump_at",
				"next_wander",
				"depart_at",
				"windup",
				"special_at",
				"chat_until",
				"distracted_until",
			])
				if (actor.zone_actor[key]) actor.zone_actor[key] += ms;
		}
	}
	for (var key of run.floors) {
		resume_frozen_instance(instances[key], now);
		if (instances[key]?.info?.zone) instances[key].info.zone.expires = run.expires;
	}
	delete run.paused_at;
	// Extend the existing admission locks along with the playing time, once per conversation.
	void db
		.collection("GeneratedZone")
		.updateMany(
			{ _id: { $in: run.members.map((m) => "member:" + m.character) }, run: run.key, active: true },
			{ $max: { expires: run.expires } },
		)
		.catch((e) => log_trace("cave admission clock", e));
}
function cave_resolve_vote(run, now) {
	var vote = run.cave.vote;
	if (!vote || vote.resolved) return;
	var counts = Object.create(null);
	for (var id of Object.values(vote.votes)) counts[id] = (counts[id] || 0) + 1;
	var ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	var majority = ordered[0] && ordered[0][1] > vote.voters.length / 2;
	if (!majority && now < vote.deadline) return;
	vote.resolved = true;
	var winner = ordered[0] && (majority || !ordered[1] || ordered[0][1] > ordered[1][1]) ? ordered[0][0] : null;
	var option = cave_revival_option(
		run,
		vote.room,
		vote.options.find((o) => o.id === winner) || { id: "fallback", effect: vote.fallback, seconds: 45 },
	);
	vote.result = option.id;
	vote.result_label = option.label ? cave_reply_label(vote.room, option) : "No reply was chosen.";
	vote.result_message = option.label
		? option.label_message || cave_dialogue_ref(vote.room, "options." + option.id + ".label")
		: { phrase: "server.cave.no_reply" };
	vote.summary = [];
	vote.summary_messages = [];
	cave_resume(run, now);
	run.cave.resolving = vote;
	try {
		cave_apply(run, vote.room, option);
	} finally {
		delete run.cave.resolving;
	}
	// A result is an event, not a best-effort refresh of an already open panel.
	cave_publish(run, "result");
}
function cave_revival_option(run, room, option) {
	if (option.effect !== "revive_here") return option;
	var count = cave_players(run).filter((p) => p.rip && p.map === room.map).length;
	return Object.assign({}, option, {
		amber: count,
		label: "Revive here — " + count + " Amber total",
		label_message: { phrase: "server.cave.revive_here", phrase_args: { amber: count } },
	});
}
function cave_option_unavailable(run, room, option) {
	if (option.needs && !run.cave.flags[option.needs]) return "server.cave.need_tool";
	if ((option.cost || 0) > run.cave.gold || (option.amber || 0) > run.cave.amber) return "server.cave.purse_short";
	if (
		(["guide", "escort", "hire", "cover"].includes(option.effect) || option.outcomes?.some((o) => o.join || o.ally)) &&
		!room.npc?.zone_actor.follow &&
		cave_helpers_full(run)
	)
		return "server.cave.helpers_limit";
}
function cave_apply(run, room, option) {
	option = cave_revival_option(run, room, option);
	var state = run.cave,
		effect = option.effect;
	var unavailable = cave_option_unavailable(run, room, option);
	if (unavailable) {
		cave_say(run, localization.message(unavailable));
		effect = room.kind === "revival" ? "revive_landing" : room.encounter.group === "bad" ? "time" : "leave";
	} else {
		state.gold -= option.cost || 0;
		state.amber -= option.amber || 0;
	}
	if (effect === "leave" && room.rescue) effect = "watch";
	if (effect === "leave" && room.rival) effect = "neither";
	room.decision = effect;
	if (option.result && effect === option.effect)
		cave_say(
			run,
			Object.assign(
				{ message: cave_reply_label(room, { label: option.result }) },
				cave_dialogue_ref(room, "options." + option.id + ".result"),
			),
		);
	if (effect === "venture") {
		if (option.needs) delete state.flags[option.needs];
		return cave_venture(run, room, option);
	}
	if (effect === "revive_here" || effect === "revive_landing") {
		for (var p of cave_players(run).filter((p) => p.rip && p.map === room.map)) {
			p.rip = false;
			p.hp = p.max_hp;
			p.mp = Math.round(p.max_mp / 2);
			delete p.s.block;
			delete p.s.poisoned;
			delete p.s.burned;
			delete p.s.eburn;
			if (effect === "revive_landing") generated_transport(p, p.in, 0);
			invincible_logic(p);
			resend(p, "u+cid");
			p.socket.emit("game_response", { response: "data", place: "respawn", success: true, cevent: "respawn" });
		}
		cave_say(
			run,
			localization.message(effect === "revive_here" ? "server.cave.revive_paid" : "server.cave.revive_free", {
				amber: option.amber,
			}),
		);
		cave_set_side(room.npc, "neutral");
		room.npc.zone_actor.idle = true;
		cave_complete(run, room);
		state.actors.delete(room.npc);
		remove_monster(room.npc);
		state.rooms = state.rooms.filter((r) => r !== room);
		return;
	}
	if (["save", "cover", "lure", "watch", "hire"].includes(effect) && room.rescue) {
		room.saving = effect !== "watch";
		if (effect === "lure")
			for (var actor of room.actors) if (actor.zone_actor.side === "predator") delete actor.zone_actor.prey;
		if (effect === "hire") room.hiring = true;
		if (effect === "cover") {
			room.covering = true;
			cave_set_side(room.npc, "ally");
			cave_follow_actor(run, room.npc);
		}
		if (effect === "lure" || effect === "cover")
			for (var a of room.actors) if (a.zone_actor.side === "predator") delete a.zone_actor.prey;
		cave_say(
			run,
			localization.message(effect === "watch" ? "server.cave.rescue_watch" : "server.cave.rescue_protect", {
				npc: room.npc.name,
			}),
		);
		return;
	}
	if (["left", "right", "neither", "both", "testimony"].includes(effect) && room.rival) {
		room.conflict = true;
		for (var actor of [room.npc, room.rival]) actor.zone_actor.idle = false;
		if (effect === "testimony") effect = room.npc.zone_stats.attack > room.rival.zone_stats.attack ? "left" : "right";
		cave_set_side(room.npc, effect === "left" ? "ally" : "duel_left");
		cave_set_side(room.rival, effect === "right" ? "ally" : "duel_right");
		if (effect === "both") {
			cave_set_side(room.npc, "enemy");
			cave_set_side(room.rival, "enemy");
		} else {
			room.npc.zone_actor.prey = room.rival;
			room.rival.zone_actor.prey = room.npc;
		}
		room.enemies = effect === "left" ? [room.rival] : effect === "right" ? [room.npc] : [room.npc, room.rival];
		cave_say(
			run,
			localization.message(
				effect === "both"
					? "server.cave.conflict_both"
					: effect === "neither"
						? "server.cave.conflict_neither"
						: "server.cave.conflict_side",
				{
					npc: room.npc.name,
					rival: room.rival.name,
					ally: effect === "left" ? room.npc.name : room.rival.name,
					enemy: effect === "left" ? room.rival.name : room.npc.name,
				},
			),
		);
		return;
	}
	if (effect === "peace" && room.rival) {
		cave_credit(run, 0, 1, room);
		cave_say(run, localization.message("server.cave.conflict_peace"));
		cave_complete(run, room);
		return;
	}
	if (effect === "both" && room.rescue) {
		cave_set_side(room.npc, "enemy");
		room.saving = false;
		return;
	}
	if (effect === "buy" || effect === "inspect") {
		cave_publish(run, true);
		cave_complete(run, room);
		return;
	}
	if (["dice", "dice6", "die", "favor", "free_die", "dice_room"].includes(effect)) {
		var face = 1 + Math.floor(cave_random() * 6),
			threshold = ["dice6", "die", "free_die"].includes(effect) ? 6 : 4;
		if (
			face < threshold &&
			!state.flags.reroll &&
			cave_players(run).some((p) => p.slots.orb?.name === "cave_loaded_die")
		) {
			state.flags.reroll = true;
			face = 1 + Math.floor(cave_random() * 6);
		}
		cave_say(run, localization.message("server.cave.die_face", { face }));
		if (effect === "dice_room") {
			cave_pack(run, room, face > 3 ? "cave_crab" : "cave_rat", 4);
			return;
		}
		if (face >= threshold) {
			if (effect === "die") cave_item(run, room.id + ":die", "cave_loaded_die");
			else if (effect === "free_die") cave_credit(run, 0, 1, room);
			else if (effect === "favor") cave_add_follower(run, room, "cave_npc");
			else cave_credit(run, option.win || 2000, 0, room);
		} else if (effect === "favor") {
			cave_pack(run, room, "cave_guard", 2);
			return;
		} else cave_say(run, localization.message("server.cave.die_loss"));
		cave_complete(run, room);
		return;
	}
	if (effect.startsWith("hunt")) {
		var kind = room.encounter.kind,
			type = kind === "hunt_bats" ? "cave_bat" : kind === "hunt_rats" ? "cave_rat" : "cave_crab";
		var count = type === "cave_rat" ? 10 : type === "cave_bat" ? 8 : 6;
		if (effect === "hunt_double") count *= 2;
		if (effect === "hunt_quick") count = Math.ceil(count / 2);
		if (effect === "hunt_helper") cave_add_follower(run, room, "cave_npc");
		var pack = cave_pack(run, room, type, count);
		if (!pack.length) {
			cave_say(run, localization.message("server.cave.hunt_empty"));
			cave_complete(run, room);
			return;
		}
		room.hunt = {
			small: effect === "hunt_quick" || effect === "hunt_late",
			double: effect === "hunt_double",
			ids: pack.map((m) => m.id),
			count: pack.length,
			kills: 0,
			deadline: Math.min(
				run.expires,
				Date.now() +
					((type === "cave_rat" ? 60 : type === "cave_bat" ? 75 : 90) + (effect === "hunt_late" ? 30 : 0)) * 1000,
			),
		};
		cave_say(run, localization.message("server.cave.hunt_start", { count: pack.length }));
		cave_publish(run);
		return;
	}
	if (
		["bad_fight", "bad_double", "fight", "wolves", "risk", "shadow", "boss", "ambush", "dice_room"].includes(effect)
	) {
		if (effect === "risk" && cave_random() < 0.5) {
			cave_reward(run, room, "cave_parcel");
			cave_credit(run, 4000, 1, room);
		} else {
			var wolves = effect === "wolves" || option.hazard === "wolves";
			if (option.hazard === "shadow") {
				var strongest = cave_players(run).sort((a, b) => b.attack - a.attack)[0];
				var shadow = cave_spawn(run, room, "cave_npc", "enemy", 64, {
					name: "Your Shadow",
					skin: strongest.skin,
					cx: strongest.cx,
				});
				shadow.slots = JSON.parse(JSON.stringify(strongest.slots));
				shadow.hp = shadow.max_hp = strongest.max_hp * 2;
				Object.assign(shadow.zone_stats, {
					attack: strongest.attack * 0.7,
					frequency: strongest.frequency,
					speed: strongest.speed,
				});
				calculate_monster_stats(shadow);
				return;
			}
			var pack;
			if (room.guards?.length && !wolves) {
				pack = room.guards.filter((g) => !g.dead);
				for (var guard of pack) {
					cave_set_side(guard, "enemy");
					guard.zone_actor.idle = false;
					room.enemies.push(guard);
				}
				if (effect === "bad_double") pack.push(...cave_pack(run, room, "cave_guard", 3));
			} else
				pack = cave_pack(run, room, wolves ? "cave_wolf" : "cave_guard", wolves ? 6 : effect === "bad_double" ? 6 : 3);
			if (effect === "bad_double") {
				cave_set_side(room.npc, "enemy");
				room.enemies.push(room.npc);
			}
			room.engaged = true;
			if (wolves)
				for (var m of pack) {
					m.level = 100;
					m.hp = m.max_hp = G.monsters.wolf.hp * 50;
					m.zone_stats = { attack: G.monsters.wolf.attack * 8, speed: 100, frequency: 2, armor: 1200, resistance: 600 };
					calculate_monster_stats(m);
				}
			if (room.encounter?.group === "bad") room.no_reward = true;
			return;
		}
	} else if (["careful", "paid_help", "use_tool"].includes(effect)) {
		if (effect === "use_tool" && !state.flags.tool) {
			cave_pack(run, room, "cave_guard", 2);
			return;
		}
		if (effect === "use_tool") state.flags.tool = false;
		if (effect === "careful") {
			room.wait_until = Date.now() + 20000;
			return;
		}
		cave_reward(run, room, "cave_parcel");
	} else if (["tool", "lamp", "decoy"].includes(effect)) {
		state.flags[effect === "decoy" && room.encounter.kind === "decoy" ? "message" : effect] = true;
		if (!option.result)
			cave_say(
				run,
				localization.message(
					"server.cave.supply_" + (effect === "decoy" && room.encounter.kind === "decoy" ? "message" : effect),
				),
			);
	} else if (["guide", "escort"].includes(effect)) {
		cave_set_side(room.npc, "ally");
		room.npc.zone_actor.idle = false;
		room.escort = cave_follow_actor(run, room.npc) && effect === "escort";
		if (room.escort) return;
	} else if (effect === "time") run.expires -= (option.seconds || 45) * 1000;
	else if (effect === "exchange") {
		cave_reward(run, room, "cave_parcel");
	} else if (effect === "moths") {
		if (state.flags.lamp) cave_item(run, room.id + ":moths", "cave_mothsteps");
		else {
			if (cave_credit(run, 0, 2, room)) cave_say(run, localization.message("server.cave.moths_chest"));
		}
	} else if (effect === "plant") {
		room.harvest = Date.now() + 60000;
	} else if (effect === "practice") {
		room.practice = true;
		cave_set_side(room.npc, "enemy");
		room.npc.zone_actor.idle = false;
		room.npc.hp = room.npc.max_hp = 500 * (1 + run.level / 10) * (option.guard || 1);
		room.enemies = [room.npc];
		room.practice_end = Date.now() + (option.seconds || 30) * 1000;
		room.practice_amber = option.reward_amber || 0;
		cave_say(
			run,
			localization.message("server.cave.practice_start", { npc: room.npc.name, seconds: option.seconds || 30 }),
		);
		return;
	} else if (["gift", "small_gift"].includes(effect)) cave_credit(run, 0, effect === "gift" ? 2 : 1, room);
	else if (effect === "reveal" || effect === "appraise") {
		var marked = run.cave.rooms.filter(
			(r) =>
				!r.done &&
				(effect === "appraise"
					? r.encounter?.kind === "rogue"
					: option.travelers
						? r.floor === room.floor && r.kind === "citizen"
						: r.floor === room.floor && !r.required && r.encounter && r !== room),
		);
		for (var r of marked) r.revealed = true;
		cave_say(
			run,
			marked.length
				? Object.assign(localization.message("server.cave.reveal_rooms", { count: marked.length }), {
						message:
							"I found " +
							marked.map((r) => r.encounter?.name || r.look?.name || r.npc?.name || r.name).join(" and ") +
							". Use Directions in CAVE INFO to get there.",
					})
				: localization.message("server.cave.reveal_none"),
		);
	}
	if (effect === "story") {
		var stories = {
			merchant: "server.cave.story_merchant",
			practice_dice: "server.cave.story_dice",
			appraise: "server.cave.story_dagger",
			send: "server.cave.story_send",
		};
		cave_say(
			run,
			localization.message(stories[room.encounter.kind] || "server.cave.story_stairs", { npc: room.npc.name }),
		);
	}
	if (effect === "leave") cave_say(run, localization.message("server.cave.decline"));
	if (effect === "time")
		cave_say(run, localization.message("server.cave.time_loss", { seconds: option.seconds || 45 }));
	cave_complete(run, room);
}
function cave_set_side(actor, side) {
	actor.zone_actor.side = side;
	actor.zone_actor.idle = side === "neutral";
	actor.xp = ["enemy", "predator", "duel_left", "duel_right"].includes(side)
		? Math.round(15 * Math.pow(actor.level, 1.3)) * G.events.dreams.xp_multiplier
		: 0;
	if (side !== "neutral") delete actor.zone_actor.depart_at;
	actor.u = true;
	actor.cid = (actor.cid || 0) + 1;
}
function cave_hostile(a, b) {
	var aa = a.zone_actor,
		bb = b.zone_actor;
	if (!aa && !bb) return true;
	if (a.in !== b.in || a.dead || b.dead || b.rip) return false;
	if (!aa) return !!(bb && !["neutral", "ally"].includes(bb.side));
	if (!bb) return ["enemy", "predator"].includes(aa.side) || aa.prey === b;
	if (aa.side === "neutral" || bb.side === "neutral") return false;
	if (aa.prey === b) return true;
	return (
		aa.side !== bb.side &&
		!(aa.side === "ally" && bb.side === "victim") &&
		!(aa.side === "victim" && bb.side === "ally")
	);
}
function cave_accept_attack(target, info) {
	return target.type !== "cave_darkmage" || info.reflected_from === target.id;
}
function cave_damage(attacker, target, info, amount) {
	if (!attacker.zone_actor && !target.zone_actor) return amount;
	if (target.type === "cave_darkmage") {
		if (info.reflected_from !== target.id) return 0;
		target.zone_actor.reflected = true;
		return target.hp;
	}
	if (amount < 0)
		return target.zone_actor?.side === "ally" || target.zone_actor?.side === "victim" || !target.zone_actor
			? amount
			: 0;
	if (!cave_hostile(attacker, target)) return 0;
	var run = generated_entry(target)?.record || generated_entry(attacker)?.record;
	var room = run?.cave.rooms.find((r) => r.id === attacker.zone_actor?.room || r.id === target.zone_actor?.room);
	if (room?.practice) return Math.min(amount, Math.max(0, target.hp - 1));
	if (target.zone_actor?.boss && target.zone_actor.phase === 0 && target.type === "cave_sentinel") return amount * 0.25;
	return amount;
}
function cave_death(attacker, target) {
	if (!target.zone_actor || target.dead) return false;
	if (target.type === "cave_darkmage" && !target.zone_actor.reflected) {
		target.hp = target.max_hp;
		return true;
	}
	var run = generated_runs[target.zone_actor.run],
		room = run?.cave.rooms.find((r) => r.id === target.zone_actor.room);
	if (!run || !room) return false;
	var state = run.cave;
	if (target.type === "cave_darkmage")
		cave_reward(run, { id: room.id + ":staff", map: room.map, x: room.x, y: room.y }, "cave_darkmage");
	if (
		target.type === "cave_rogue" &&
		target.zone_actor.rare &&
		attacker?.is_monster &&
		attacker.zone_actor?.side === "predator" &&
		!target.zone_actor.betrayed
	)
		cave_reward(run, { id: room.id + ":dagger", map: room.map, x: room.x, y: room.y }, "cave_rogue_weapon");
	if (target === room.npc && room.rescue && !room.reward) {
		cave_reward(run, room, null, room.cargo || []);
	}
	if (
		room.hunt &&
		room.hunt.ids.includes(target.id) &&
		Date.now() <= room.hunt.deadline &&
		(attacker?.is_player || attacker?.zone_actor?.side === "ally")
	)
		room.hunt.kills++;
	state.kills[target.type] = (state.kills[target.type] || 0) + 1;
	var xp_player = attacker?.is_player
		? attacker
		: attacker?.zone_actor?.side === "ally"
			? cave_players(run).find((p) => p.in === target.in && !p.rip && simple_distance(p, target) < 800)
			: null;
	if (xp_player && target.xp) {
		var recipients = cave_players(run).filter((p) => p.in === target.in && !p.rip && simple_distance(p, target) < 800);
		issue_monster_award(target, {
			player: xp_player,
			members: recipients.map((p) => p.name),
			share: 1 / run.members.length,
			drop: false,
		});
	}
	if (!room.no_reward && !room.hunt && D.drops.monsters[target.type]) {
		var recipient = attacker?.is_player ? attacker : cave_players(run)[0];
		if (recipient) {
			var drops = { items: [], gold: 0, cash: 0 };
			// Cave actors scale with characters, but their daily encounter table is one fixed roll.
			roll_monster_drops(
				Object.assign({}, recipient, { luckm: 1 }),
				Object.assign({}, target, { level: 1 }),
				drops,
				1,
				null,
				{ table_only: true },
			);
			for (var item of drops.items) if (item.name === "cave_amber") cave_credit(run, 0, item.q || 1, target);
			var materials = drops.items.filter((item) => item.name !== "cave_amber");
			if (materials.length) cave_deliver(run, "monster:" + target.id, materials);
		}
	}
	state.actors.delete(target);
	remove_monster(target);
	return true;
}
function cave_move(actor, target, now) {
	var ai = actor.zone_actor;
	if (now - (ai.last_path || 0) < 250 || is_disabled(actor)) return;
	var move = calculate_move(actor, target.x, target.y);
	if (Math.hypot(move.x - target.x, move.y - target.y) < 4) {
		ai.last_path = now;
		// A clear route supersedes any pending detour. Its late worker reply must not turn us back.
		ai.path_token = null;
		actor.working = false;
		if (actor.moving && Math.hypot(actor.going_x - move.x, actor.going_y - move.y) < 8) return;
		actor.going_x = move.x;
		actor.going_y = move.y;
		start_moving_element(actor);
		return;
	}
	// Keep walking while a detour is calculated; only one worker request may be outstanding.
	if (actor.working || now - (ai.last_path || 0) < 650) return;
	ai.last_path = now;
	actor.working = true;
	actor.zone_actor.path_token = actor.zone_actor.run + ":" + ++generated_runs[actor.zone_actor.run].cave.serial;
	workers[generated_maps[actor.map].floor.worker].postMessage({
		type: "fast_astar",
		in: actor.in,
		id: actor.id,
		map: actor.map,
		path_token: actor.zone_actor.path_token,
		sx: actor.x,
		sy: actor.y,
		tx: target.x,
		ty: target.y,
	});
}
function cave_face(actor, target) {
	if (!target || actor.moving) return;
	var angle = Math.round((Math.atan2(target.y - actor.y, target.x - actor.x) * 180) / Math.PI);
	if (Math.abs((actor.angle || 0) - angle) < 15) return;
	actor.angle = angle;
	actor.u = true;
	actor.cid = (actor.cid || 0) + 1;
}
function cave_seen(actor, people) {
	return people.some(
		(p) =>
			p.map === actor.map &&
			Math.abs(p.x - actor.x) < (p.vision?.[0] || 700) + 96 &&
			Math.abs(p.y - actor.y) < (p.vision?.[1] || 500) + 96,
	);
}
function cave_cue(run, actor, text, kind) {
	var cue = {
		id: ++run.cave.serial,
		actor: actor.id,
		text: typeof text === "object" ? text.message : text,
		text_message: typeof text === "object" ? text : undefined,
		kind,
		x: actor.x,
		y: actor.y,
		map: actor.map,
	};
	for (var p of cave_players(run))
		if (p.map === actor.map) p.socket.emit("cave", { type: "cue", state: cave_snapshot(run, p), cue });
}
function cave_actor_tick(run, actor, now, people) {
	var ai = actor.zone_actor;
	if (actor.dead || is_disabled(actor)) return;
	var room = run.cave.rooms.find((r) => r.id === ai.room);
	var nearby = people
		.filter((p) => !p.rip && p.map === actor.map)
		.sort((a, b) => simple_distance(actor, a) - simple_distance(actor, b));
	if (ai.depart_at) {
		if (now < ai.depart_at) return;
		var door = G.maps[actor.map].spawns[0];
		actor.zone_stats.speed = 90;
		if (actor.speed !== 90) calculate_monster_stats(actor);
		cave_move(actor, { x: door[0], y: door[1] }, now);
		if (simple_distance(actor, { x: door[0], y: door[1] }) < 70 && !cave_seen(actor, people)) {
			run.cave.actors.delete(actor);
			remove_monster(actor);
		}
		return;
	}
	if (ai.idle) {
		var listener = nearby[0];
		if (listener && simple_distance(actor, listener) < 160) {
			if (ai.citizen && now < (ai.chat_until || 0)) {
				actor.moving = false;
				actor.vx = actor.vy = 0;
			}
			cave_face(actor, room.rival && !room.voted ? (actor === room.rival ? room.npc : room.rival) : listener);
		}
		if (!actor.moving && now >= ai.next_wander && !ai.staged && !ai.stationary && now >= (ai.chat_until || 0)) {
			ai.next_wander = now + 4000 + Math.floor(cave_random() * 4000);
			var target;
			if (ai.citizen) {
				var stops = run.manifest[room.floor].definition.rooms.filter(
					(r) => simple_distance(actor, r) > 160 && simple_distance(actor, r) < 800,
				);
				target = stops.length ? cave_pick(stops) : ai.home;
			} else if (!listener || simple_distance(actor, listener) > 200) {
				target = {
					x: ai.home.x + Math.round(cave_random() * 80) - 40,
					y: ai.home.y + Math.round(cave_random() * 60) - 30,
				};
			}
			if (target) cave_move(actor, target, now);
		}
		return;
	}
	// Camps are already visible. They defend their patch until approached or attacked.
	if (!room.engaged && ["patrol", "farm", "fight", "boss", "darkmage"].includes(room.kind)) {
		if (ai.prey || actor.hp < actor.max_hp || nearby.some((p) => simple_distance(actor, p) < 210)) {
			room.engaged = true;
			if (run.cave.flags.decoy) {
				delete run.cave.flags.decoy;
				for (var member of room.enemies)
					if (!member.dead) {
						member.zone_actor.distracted_until = now + 8000;
						member.zone_actor.distracted_to = { x: room.x - 112, y: room.y - 64 };
					}
				cave_cue(run, actor, localization.message("server.cave.cue_decoy"), "neutral");
			}
			if (run.cave.flags.message) {
				var guard = room.enemies.find((a) => !a.dead && a.type === "cave_guard");
				if (guard) {
					delete run.cave.flags.message;
					cave_set_side(guard, "ally");
					delete guard.zone_actor.prey;
					room.enemies = room.enemies.filter((a) => a !== guard);
					if (cave_follow_actor(run, guard)) cave_cue(run, guard, localization.message("server.cave.cue_join"), "ally");
					else {
						cave_set_side(guard, "neutral");
						guard.zone_actor.depart_at = now + 1500;
					}
				}
			}
			if (ai.boss || ai.brood)
				cave_cue(run, actor, localization.message("server.cave.cue_turn", { npc: actor.name }), "danger");
		} else {
			if (nearby[0] && simple_distance(actor, nearby[0]) < 350) cave_face(actor, nearby[0]);
			if (now >= ai.next_wander) {
				ai.next_wander = now + 3000 + Math.floor(cave_random() * 5000);
				cave_move(
					actor,
					{ x: ai.home.x + Math.round(cave_random() * 64) - 32, y: ai.home.y + Math.round(cave_random() * 64) - 32 },
					now,
				);
			}
			return;
		}
	}
	if (ai.distracted_until > now) {
		cave_move(actor, ai.distracted_to, now);
		return;
	}
	// A rescue begins in sight of the party, so the victim cannot die off-screen.
	if (room.rescue && !room.voted && !nearby.some((p) => simple_distance(p, room) < 350)) return;
	if (ai.boss && ai.phase === 0 && actor.hp < actor.max_hp * 0.55) {
		ai.phase = 1;
		actor.zone_stats.frequency *= 1.35;
		calculate_monster_stats(actor);
		cave_cue(
			run,
			actor,
			localization.message(actor.type === "cave_sentinel" ? "server.cave.cue_sentinel" : "server.cave.cue_help"),
			"danger",
		);
		ai.windup = now + 2000;
	}
	if (ai.brood && !ai.hatched && actor.hp < actor.max_hp * 0.65) {
		ai.hatched = true;
		ai.windup = now + 2000;
		cave_cue(run, actor, localization.message("server.cave.cue_nest"), "danger");
	}
	if (ai.windup) {
		if (now < ai.windup) return;
		delete ai.windup;
		if (actor.type === "cave_sentinel") {
			var hit = nearby.filter((p) => simple_distance(actor, p) <= 120 && cave_hostile(actor, p));
			for (var p of hit) {
				var strike = commence_attack(actor, p, "attack");
				for (var event of strike?.events || []) xy_emit(actor, event[0], event[1]);
			}
			xy_emit(actor, "ui", { type: "stomp", name: actor.id, ids: hit.map((p) => p.id) });
		} else {
			var hatch = cave_pack(
				run,
				room,
				ai.brood ? "cave_spider" : actor.type === "cave_mothkeeper" ? "cave_bat" : "cave_guard",
				ai.brood ? 4 : 3,
			);
			for (var child of hatch) {
				var point = safe_xy_nearby(actor.map, actor.x + Math.round(cave_random() * 48) - 24, actor.y + 24);
				if (point) {
					child.x = point.x;
					child.y = point.y;
					child.abs = true;
				}
				child.zone_actor.next = now + 1200;
			}
		}
	}
	var candidates = nearby.filter((p) => p.hp > 0 && !is_invinc(p) && !is_invis(p) && cave_hostile(actor, p));
	for (var other of room.actors)
		if (other !== actor && !other.dead && cave_hostile(actor, other)) candidates.push(other);
	if (ai.prey && !ai.prey.dead && cave_hostile(actor, ai.prey)) candidates = [ai.prey];
	candidates = candidates.filter((p) => p.in === actor.in && simple_distance(actor, p) <= (ai.betrayed ? 200 : 650));
	candidates.sort(
		(a, b) =>
			(actor.type === "cave_darkmage" ? Number(b.type === "mage") - Number(a.type === "mage") : 0) ||
			simple_distance(actor, a) - simple_distance(actor, b),
	);
	var target = candidates[0];
	if (!target) {
		if (ai.follow && nearby[0] && simple_distance(actor, nearby[0]) > 65) cave_move(actor, nearby[0], now);
		else if (simple_distance(actor, ai.home) > 80) cave_move(actor, ai.home, now);
		return;
	}
	if (simple_distance(actor, target) <= actor.range * 0.8 && (actor.moving || actor.working)) {
		actor.moving = false;
		actor.working = false;
		actor.vx = actor.vy = 0;
		actor.going_x = actor.x;
		actor.going_y = actor.y;
		ai.path_token = null;
		actor.u = true;
		actor.cid = (actor.cid || 0) + 1;
	}
	cave_face(actor, target);
	if (ai.betrayed && ai.jump !== target.id && now >= (ai.jump_at || 0)) {
		var point = safe_xy_nearby(actor.map, target.x - 12, target.y + 12);
		if (point) transport_monster_to(actor, actor.in, actor.map, point.x, point.y);
		ai.jump = target.id;
		ai.jump_at = now + 750;
	}
	if (can_attack(actor, target) && now >= ai.next) {
		ai.next = now + 1000 / actor.frequency;
		var attack = commence_attack(actor, target, "attack");
		if (attack?.events?.length) for (var event of attack.events) xy_emit(actor, event[0], event[1]);
	} else if (simple_distance(actor, target) > actor.range * 0.8) cave_move(actor, target, now);
}
function cave_tick(run, now) {
	var state = run.cave,
		people = cave_players(run);
	if (!state) return;
	cave_resolve_vote(run, now);
	if (run.paused_at) {
		if (now - state.last_publish >= 1000) cave_publish(run);
		return;
	}
	if (!state.vote || state.vote.resolved) {
		var fallen = people.find((p) => p.rip);
		if (fallen) cave_offer_rescue(run, fallen);
	}
	if (run.paused_at) return;
	for (var room of state.rooms) {
		// Growing crops need only a deadline, even after this floor has unloaded.
		if (room.harvest && room.harvest <= now) {
			delete room.harvest;
			if (cave_credit(run, 0, 3, room)) cave_say(run, localization.message("server.cave.harvest"));
		}
		if (!generated_maps[room.map]) continue;
		var occupied = people.some((p) => p.map === room.map && simple_distance(p, room) < 1100);
		if (occupied) {
			room.last_near = now;
			if (room.saved) cave_resume_floor(run, room.map, room);
		} else if (
			!room.saved &&
			room.started &&
			now - (room.last_near || (room.last_near = now)) > 15000 &&
			!room.actors.some((a) => !a.dead && (a.zone_actor.follow || a.zone_actor.depart_at || cave_seen(a, people))) &&
			!(state.vote && !state.vote.resolved && state.vote.room === room)
		) {
			cave_suspend_floor(run, room.map, room);
		}
		if (room.saved) continue;
		var nearby = people.filter((p) => !p.rip && p.map === room.map && simple_distance(p, room) < 280);
		if (!room.started && occupied) cave_activate(run, room);
		if (!room.started) continue;
		if (
			room.encounter &&
			nearby.some((p) => room.npc && simple_distance(p, room.npc) <= 160) &&
			!room.voted &&
			!room.done
		)
			cave_begin_vote(run, room);
		if (run.paused_at) return;
		if (room.kind === "citizen" || room.done) continue;
		if (room.wait_until && now >= room.wait_until) {
			cave_reward(run, room, "cave_parcel");
			cave_complete(run, room);
			continue;
		}
		if (room.kind === "farm" && room.enemies.every((m) => m.dead)) {
			if (!room.next_wave) {
				cave_reward(run, { id: room.id + ":wave:" + room.waves, map: room.map, x: room.x, y: room.y }, "cave_farm");
				cave_credit(run, 1500, 1, room);
				room.next_wave = now + 10000;
				if (room.waves < 3)
					cave_say(run, localization.message("server.cave.wave_wait", { camp: room.name_message || room.name }));
			}
			if (room.waves >= 3) cave_complete(run, room);
			else if (occupied && now >= room.next_wave) {
				room.next_wave = 0;
				room.enemies = [];
				cave_activate(run, room);
				for (var newborn of room.enemies) {
					var nest = safe_xy_nearby(room.map, room.x, room.y - 80);
					if (nest) {
						newborn.x = nest.x;
						newborn.y = nest.y;
					}
					newborn.zone_actor.next = now + 1500;
				}
				cave_say(
					run,
					localization.message("server.cave.wave_next", { camp: room.name_message || room.name, wave: room.waves }),
				);
			}
			continue;
		}
		if (room.practice && room.npc && (room.npc.hp <= 1 || room.practice_end <= now)) {
			if (room.npc.hp <= 1) {
				cave_say(run, localization.message("server.cave.practice_win", { npc: room.npc.name }));
				if (room.practice_amber) cave_credit(run, 0, room.practice_amber, room);
				else cave_reward(run, room, "cave_parcel");
			} else cave_say(run, localization.message("server.cave.practice_timeout", { npc: room.npc.name }));
			cave_set_side(room.npc, "neutral");
			room.npc.zone_actor.idle = true;
			cave_complete(run, room);
			continue;
		}
		if (room.hunt && (room.hunt.kills >= room.hunt.count || now >= room.hunt.deadline)) {
			if (room.hunt.kills >= room.hunt.count) {
				if (!room.hunt.small) cave_reward(run, room, "cave_parcel");
				if (room.hunt.double)
					cave_reward(run, { id: room.id + ":extra", map: room.map, x: room.x, y: room.y }, "cave_parcel");
				cave_credit(run, room.hunt.small ? 0 : 5000, 2, room);
			} else {
				room.no_reward = true;
				cave_say(run, localization.message("server.cave.hunt_timeout"));
			}
			cave_complete(run, room);
			continue;
		}
		if (
			room.rescue &&
			room.npc &&
			room.voted &&
			room.decision &&
			room.actors.filter((m) => m.zone_actor.predator).every((m) => m.dead) &&
			(room.decision !== "both" || room.npc.dead)
		) {
			if (!room.npc.dead) {
				if (room.encounter.kind === "rogue" && !room.rogue_resolved) {
					room.rogue_resolved = true;
					if (cave_random() < 0.5) {
						cave_set_side(room.npc, "enemy");
						Object.assign(room.npc.zone_actor, { betrayed: true, next: 0 });
						room.npc.last.attack = really_old;
						room.npc.zone_stats.frequency = 8;
						room.npc.zone_stats.speed = 100;
						calculate_monster_stats(room.npc);
						room.enemies.push(room.npc);
						cave_say(run, localization.message("server.cave.rogue_betrayal"));
						room.rescue = false;
						continue;
					}
				}
				if (room.saving) {
					cave_reward(run, room, room.covering ? "cave_parcel" : "cave_rescue");
					cave_credit(run, 3000, 0, room);
				}
				cave_set_side(room.npc, "ally");
				if (room.hiring) cave_follow_actor(run, room.npc);
			}
			cave_complete(run, room);
			continue;
		}
		if (room.rescue && room.npc?.dead) {
			for (var m of room.actors)
				if (!m.dead) {
					cave_set_side(m, "enemy");
					delete m.zone_actor.prey;
				}
			if (room.actors.every((m) => m.dead)) cave_complete(run, room);
		}
		if (room.conflict && room.npc && room.rival && (room.npc.dead || room.rival.dead)) {
			var winner = room.npc.dead ? room.rival : room.npc;
			if (room.decision !== "both" || winner.dead) {
				if (!winner.dead) cave_set_side(winner, "neutral");
				cave_reward(run, room, winner.dead ? "cave_parcel" : "cave_rescue");
				cave_complete(run, room);
				continue;
			}
		}
		if (room.escort && room.npc?.dead) {
			cave_say(run, localization.message("server.cave.escort_lost", { npc: room.npc.name }));
			cave_complete(run, room);
			continue;
		}
		if (room.escort && room.npc && !room.npc.dead) {
			var door =
				G.maps[room.map].doors.find((d) => G.maps[d[4]]?.generated?.floor > room.floor) || G.maps[room.map].doors[0];
			if (door && simple_distance(room.npc, { x: door[0], y: door[1], map: room.map, in: room.map }) < 120) {
				cave_reward(run, room, "cave_rescue");
				cave_credit(run, 3000, 0, room);
				cave_complete(run, room);
			}
		}
		if (room.enemies.length && room.enemies.every((m) => m.dead) && !room.rescue && !room.hunt && !room.conflict) {
			if (!room.no_reward && room.kind === "encounter") cave_reward(run, room, "cave_parcel");
			cave_complete(run, room);
		}
	}
	for (var actor of state.actors) cave_actor_tick(run, actor, now, people);
	if (now - state.last_publish >= 1000) cave_publish(run);
}
function cave_snapshot(run, player) {
	var state = run.cave,
		v = state.vote,
		floor = generated_entry(player)?.floor.definition.generated.floor;
	if (v?.resolved && player.cave_room) v = state.rooms.find((r) => r.id === player.cave_room)?.vote || v;
	return {
		run: run.key,
		expires: run.expires,
		server_time: Date.now(),
		remaining_ms: Math.max(0, run.expires - generated_clock(run)),
		paused: !!run.paused_at,
		paused_at: run.paused_at || null,
		rewards: state.receipts,
		level: run.level,
		floor,
		gold: state.gold,
		amber: state.amber,
		limits: {
			gold: G.events.dreams.gold_limit,
			amber: G.events.dreams.amber_limit,
			gold_spawned: state.gold_earned,
			amber_spawned: state.amber_earned,
		},
		supplies: ["tool", "lamp", "decoy", "message", "truce"].filter((k) => state.flags[k]),
		roster: run.members.map((m) => ({ name: m.name, left: m.left, disconnected: !!m.disconnected })),
		doors: (run.manifest?.[floor]?.definition.doors || []).map((d, index) => ({
			id: index,
			x: run.manifest[floor].definition.spawns[index][0],
			y: run.manifest[floor].definition.spawns[index][1],
			map: player.map,
			to: d[4],
			down: G.maps[d[4]]?.generated?.floor > floor,
			locked: G.maps[d[4]]?.generated?.floor > floor && !run.completed[floor],
		})),
		objectives: state.rooms
			.filter(
				(r) =>
					((r.required || r.kind === "farm" || r.encounter?.kind === "merchant") && r.floor === floor) || r.revealed,
			)
			.map((r) => ({
				id: r.id,
				x: r.kind === "citizen" ? (r.npc?.x ?? r.x) : r.x,
				y: r.kind === "citizen" ? (r.npc?.y ?? r.y) : r.y,
				done: r.encounter?.kind === "merchant" ? !!r.stock?.sold : r.done,
				floor: r.floor,
				kind: r.kind,
				required: !!r.required,
				waves: r.kind === "farm" ? r.waves : undefined,
				name:
					r.encounter?.name ||
					r.look?.name ||
					r.name ||
					(r.kind === "boss"
						? G.monsters[["cave_lockbreaker", "cave_sentinel", "cave_mothkeeper"][r.floor]].name
						: "Guard camp"),
				name_message: r.encounter
					? cave_dialogue_ref(r, "name")
					: r.kind === "fight"
						? { phrase: "server.cave.guard_camp" }
						: r.name_message,
			})),
		choice: v
			? {
					id: v.id,
					title: v.room.encounter.name,
					title_message: cave_dialogue_ref(v.room, "name"),
					kind: v.room.encounter.kind,
					danger: v.room.encounter.group === "bad",
					scene: v.room.actors
						.filter((a) => !a.dead)
						.slice(0, 10)
						.map((a) => ({
							id: a.id,
							name: a.name,
							skin: a.skin || G.monsters[a.type].skin || a.type,
							cx: a.cx,
							side: a.zone_actor.side,
							hp: a.hp,
							max_hp: a.max_hp,
							slots: a.slots,
						})),
					text: cave_reply_label(v.room, { label: v.room.encounter.text }),
					text_message: cave_dialogue_ref(v.room, "text"),
					deadline: v.deadline,
					resolved: v.resolved,
					result: v.result,
					result_label: v.result_label,
					result_message: v.result_message,
					summary: v.summary || [],
					summary_messages: v.summary_messages || [],
					votes: Object.fromEntries(
						run.members.filter((m) => v.votes[m.character]).map((m) => [m.name, v.votes[m.character]]),
					),
					options: v.options
						.map((o) => cave_revival_option(run, v.room, o))
						.map((o) => {
							var unavailable = cave_option_unavailable(run, v.room, o);
							return {
								id: o.id,
								label: cave_reply_label(v.room, o),
								label_message: o.label_message || cave_dialogue_ref(v.room, "options." + o.id + ".label"),
								cost: o.cost || 0,
								amber: o.amber || 0,
								unavailable: unavailable ? localization.phrase(unavailable) : null,
								unavailable_message: unavailable ? { phrase: unavailable } : undefined,
							};
						}),
					fallback:
						v.fallback === "time"
							? "Wait and lose 45 seconds"
							: v.fallback === "revive_landing"
								? "Return to the doorway"
								: v.room.rescue || v.room.rival
									? "Leave them to fight"
									: "Walk away",
					fallback_message: {
						phrase:
							v.fallback === "time"
								? "server.cave.fallback_time"
								: v.fallback === "revive_landing"
									? "server.cave.fallback_landing"
									: v.room.rescue || v.room.rival
										? "server.cave.fallback_fight"
										: "cave.no_reply",
					},
					skin: v.room.npc?.skin,
					cx: v.room.npc?.cx,
					people: [v.room.npc, v.room.rival].filter(Boolean).map((a) => ({
						name: a.name,
						hp: a.hp,
						max_hp: a.max_hp,
						attack: a.attack,
						slots: a.slots,
						cargo: a === v.room.npc ? v.room.cargo : undefined,
					})),
					service: v.room.decision === "recipes" ? "recipes" : null,
					shop: v.room.stock
						? Object.assign(
								{ room: v.room.id, nearby: player.map === v.room.map && simple_distance(player, v.room.npc) <= 160 },
								v.room.stock,
							)
						: null,
				}
			: null,
		hunts: state.rooms
			.filter((r) => r.hunt && !r.done)
			.map((r) => ({ room: r.id, kills: r.hunt.kills, count: r.hunt.count, deadline: r.hunt.deadline })),
		practice: state.rooms
			.filter((r) => r.practice && !r.done)
			.map((r) => ({ room: r.id, name: r.npc.name, hp: r.npc.hp, deadline: r.practice_end })),
	};
}
function cave_publish(run, open = false, returning) {
	run.cave.last_publish = Date.now();
	for (var actor of run.cave.actors) {
		var state = [actor.zone_actor.side, actor.zone_actor.rare, actor.zone_actor.betrayed].join(":");
		if (state !== actor.zone_actor.client_state) {
			actor.zone_actor.client_state = state;
			actor.u = true;
			actor.cid = (actor.cid || 0) + 1;
		}
	}
	for (var player of cave_players(run)) {
		var state = cave_snapshot(run, player);
		player.cave = state;
		player.socket.emit("cave", {
			type: player === returning ? "returned" : open === "result" ? "result" : open ? "choice" : "state",
			state,
		});
	}
}
async function cave_interaction(player, data) {
	if (data.action === "enter") return open_generated_zone(player);
	if (data.action === "info") return { visit: await generated_visit_info(player) };
	var entry = generated_entry(player),
		run = entry?.record,
		member = generated_member(run, player);
	if (!run || !member || member.left || run.expires <= generated_clock(run)) throw Error("cave_closed");
	if (data.action === "exit") {
		cave_settle_purse(run);
		generated_exit(player, "exit");
		return { exited: true };
	}
	if (data.action === "state") return { state: cave_snapshot(run, player) };
	if (data.action === "talk") {
		if (run.paused_at) {
			var current = cave_snapshot(run, player);
			player.socket.emit("cave", { type: "choice", state: current });
			return { state: current };
		}
		if (player.rip) throw Error("defeated");
		var room = run.cave.rooms.find((r) => r.id === data.room);
		var speakers = (room?.actors || []).filter(
			(a) => !a.dead && a.map === player.map && ["neutral", "ally", "victim"].includes(a.zone_actor.side),
		);
		var speaker = data.actor
			? speakers.find((a) => a.id === data.actor)
			: speakers.sort((a, b) => simple_distance(player, a) - simple_distance(player, b))[0];
		if (!speaker || simple_distance(player, speaker) > 160) throw Error("distance");
		if (room.kind === "citizen") {
			room.npc.zone_actor.chat_until = Date.now() + 4000;
			room.npc.moving = false;
			room.npc.vx = room.npc.vy = 0;
			room.npc.working = false;
			room.npc.zone_actor.path_token = null;
			room.npc.u = true;
			room.npc.cid = (room.npc.cid || 0) + 1;
			cave_face(room.npc, player);
			var text = cave_pick(room.look.says);
			var chat = {
				name: room.npc.name,
				skin: room.npc.skin,
				cx: room.npc.cx,
				text,
				text_message: { phrase: "event.dreams.traveler." + room.look.name + ".says." + room.look.says.indexOf(text) },
			};
			player.socket.emit("cave", { type: "chat", state: cave_snapshot(run, player), chat });
			return { chat };
		}
		cave_begin_vote(run, room);
		player.cave_room = room.id;
		var state = cave_snapshot(run, player);
		player.socket.emit("cave", { type: "choice", state });
		return { state };
	}
	if (player.rip && data.action !== "vote") throw Error("defeated");
	if (data.action === "vote") {
		var vote = run.cave.vote;
		if (!vote || data.choice !== vote.id || !vote.voters.includes(player.real_id)) throw Error("stale_choice");
		if (vote.votes[player.real_id] === data.option)
			return { choice: vote.id, vote: data.option, resolved: vote.resolved };
		cave_resolve_vote(run, Date.now());
		if (vote.resolved || Date.now() >= vote.deadline) throw Error("vote_closed");
		if (!vote.options.some((o) => o.id === data.option)) throw Error("invalid_reply");
		if (vote.votes[player.real_id]) throw Error("already_voted");
		vote.votes[player.real_id] = data.option;
		cave_resolve_vote(run, Date.now());
		cave_publish(run);
		return { choice: vote.id, vote: data.option, resolved: vote.resolved, result: vote.result };
	}
	if (data.action === "buy") {
		var room = run.cave.rooms.find((r) => r.id === data.room);
		if (!room?.stock || room.stock.sold || !room.npc || room.npc.dead) throw Error("sold_out");
		if (player.map !== room.map || simple_distance(player, room.npc) > 160) throw Error("distance");
		if (run.cave.gold < room.stock.price) throw Error("gold_not_enough");
		room.stock.sold = true;
		run.cave.gold -= room.stock.price;
		var recipient = cave_item(run, room.id + ":purchase", room.stock.name);
		resend(player, "u+cid");
		cave_publish(run);
		return { recipient: recipient.name, item: room.stock.name, gold: room.stock.price, currency: "cave_gold" };
	}
	throw Error("invalid_interaction");
}

// Empty floors retain only actor state and room outcomes. Geometry and navigation are rebuilt from the seed.
function cave_suspend_floor(run, map, onlyRoom) {
	var fields = [
		"id",
		"type",
		"x",
		"y",
		"hp",
		"max_hp",
		"mp",
		"max_mp",
		"xp",
		"range",
		"level",
		"skin",
		"name",
		"cx",
		"slots",
		"s",
		"zone_stats",
		"angle",
	];
	for (var room of run.cave.rooms.filter((r) => r.map === map && (!onlyRoom || r === onlyRoom))) {
		if (room.saved) continue;
		room.saved = room.actors
			.filter((a) => !a.dead)
			.map((a) => {
				var state = {};
				for (var field of fields) if (a[field] !== undefined) state[field] = JSON.parse(JSON.stringify(a[field]));
				state.zone_actor = Object.assign({}, a.zone_actor, { prey: a.zone_actor.prey?.id || null });
				state.enemy = room.enemies.includes(a);
				state.npc = room.npc === a;
				state.rival = room.rival === a;
				state.guard = room.guards?.includes(a);
				run.cave.actors.delete(a);
				if (onlyRoom) remove_monster(a);
				return state;
			});
		room.actors = [];
		room.enemies = [];
		if (room.guards) room.guards = [];
		for (var role of ["npc", "rival"]) {
			var actor = room[role];
			room[role] = actor?.dead
				? {
						dead: true,
						name: actor.name,
						skin: actor.skin,
						cx: actor.cx,
						hp: 0,
						max_hp: actor.max_hp,
						attack: actor.attack,
						slots: actor.slots,
					}
				: null;
		}
	}
}
function cave_resume_floor(run, map, onlyRoom) {
	var restored = new Map();
	for (var room of run.cave.rooms.filter((r) => r.map === map && (!onlyRoom || r === onlyRoom))) {
		if (run.cave.actors.size + (room.saved?.length || 0) > 64) continue;
		for (var state of room.saved || []) {
			var actor = new_monster(
				map,
				{ type: state.type, position: [state.x, state.y], radius: 0, gold: 0 },
				{ temp: true },
			);
			delete instances[map].monsters[actor.id];
			Object.assign(actor, state);
			delete actor.enemy;
			delete actor.npc;
			delete actor.rival;
			delete actor.guard;
			actor.zone_actor = Object.assign({}, state.zone_actor, { path_token: null });
			actor.last_level = future_s(86400);
			instances[map].monsters[actor.id] = actor;
			restored.set(actor.id, actor);
			room.actors.push(actor);
			run.cave.actors.add(actor);
			if (state.enemy) room.enemies.push(actor);
			if (state.npc) room.npc = actor;
			if (state.rival) room.rival = actor;
			if (state.guard) (room.guards || (room.guards = [])).push(actor);
		}
		delete room.saved;
	}
	for (var actor of restored.values()) {
		actor.zone_actor.prey = restored.get(actor.zone_actor.prey) || players[actor.zone_actor.prey] || null;
		calculate_monster_stats(actor);
	}
}

function cave_fallen(player) {
	var run = generated_entry(player)?.record;
	if (!run?.cave || run.closing) return;
	if (!run.cave.vote || run.cave.vote.resolved) cave_offer_rescue(run, player);
}
function cave_offer_rescue(run, player) {
	if (run.cave.vote && !run.cave.vote.resolved) return;
	var old = run.cave.rooms.find((r) => r.kind === "revival" && !r.done && r.map === player.map);
	if (old) return;
	var landing = G.maps[player.map].spawns[0];
	var point = safe_xy_nearby(player.map, player.x + 32, player.y) ||
		safe_xy_nearby(player.map, player.x, player.y) || { x: landing[0], y: landing[1] };
	var room = {
		id: "rescue:" + ++run.cave.serial,
		kind: "revival",
		floor: generated_entry(player).floor.definition.generated.floor,
		map: player.map,
		x: point.x,
		y: point.y - 48,
		bounds: [player.x - 64, player.y - 64, player.x + 64, player.y + 64],
		started: true,
		required: false,
		done: false,
		actors: [],
		enemies: [],
		encounter: {
			name: "A Hand in the Dark",
			group: "positive",
			text: "I can revive you here for 1 Amber each from the shared purse. Or I can bring you back at this floor’s doorway for free. You have lost no gold or experience.",
			options: [
				{ id: "here", label: "Revive here — 1 Amber each", effect: "revive_here" },
				{ id: "landing", label: "Revive at the doorway — free", effect: "revive_landing" },
			],
		},
	};
	run.cave.rooms.push(room);
	room.npc = cave_spawn(run, room, "cave_npc", "neutral", 0, { name: "Nera", skin: "mf_blue", cx: {} });
	if (!room.npc) {
		run.cave.rooms.pop();
		return;
	}
	cave_begin_vote(run, room);
	run.cave.vote.fallback = "revive_landing";
	cave_publish(run, true);
}

function cave_follow_through(run, from, player) {
	var followers = [...run.cave.actors].filter((a) => a.map === from && a.zone_actor.follow && !a.dead).slice(0, 2);
	for (var actor of followers) {
		var old = run.cave.rooms.find((r) => r.id === actor.zone_actor.room);
		// A rescue or escort must finish on its own floor before its actor can leave it.
		if (!old || !old.done) continue;
		var point = safe_xy_nearby(player.map, player.x + 48, player.y + 48);
		if (!point) continue;
		var room = {
			id: "follower:" + actor.id,
			kind: "follower",
			map: player.map,
			floor: generated_entry(player).floor.definition.generated.floor,
			x: point.x,
			y: point.y,
			started: true,
			done: true,
			actors: [actor],
			enemies: [],
		};
		old.actors = old.actors.filter((a) => a !== actor);
		if (old.npc === actor) old.npc = null;
		run.cave.rooms = run.cave.rooms.filter((r) => r.id !== room.id);
		run.cave.rooms.push(room);
		actor.zone_actor.room = room.id;
		transport_monster_to(actor, player.in, player.map, point.x, point.y);
	}
}

function cave_helpers_full(run) {
	var count = [...run.cave.actors].filter((a) => a.zone_actor.follow && !a.dead).length;
	for (var room of run.cave.rooms) count += (room.saved || []).filter((a) => a.zone_actor.follow).length;
	return count >= 2;
}
function cave_follow_actor(run, actor) {
	if (actor?.zone_actor.follow) return true;
	if (cave_helpers_full(run)) {
		cave_say(run, localization.message("server.cave.helpers_full"));
		cave_credit(run, 0, 2, actor);
		return false;
	}
	if (actor) Object.assign(actor.zone_actor, { follow: true, idle: false });
	return true;
}
function cave_add_follower(run, room, type) {
	if (!cave_follow_actor(run, null)) return;
	var cast = G.events.dreams.cast[room.encounter?.actor] || G.events.dreams.cast.expedition_captain;
	var others = cast.filter((p) => p.name !== room.npc?.name);
	var look = type === "cave_npc" ? cave_pick(others.length ? others : cast) : null;
	var actor = cave_spawn(run, room, type, "ally", 80, look);
	if (actor) {
		actor.zone_actor.follow = true;
		actor.zone_actor.idle = false;
		actor.xp = 0;
	}
}
function cave_venture(run, room, option) {
	var total = option.outcomes.reduce((sum, o) => sum + o.weight, 0),
		roll = cave_random() * total;
	var outcome = option.outcomes[option.outcomes.length - 1];
	for (var candidate of option.outcomes) {
		roll -= candidate.weight;
		if (roll < 0) {
			outcome = candidate;
			break;
		}
	}
	cave_say(
		run,
		Object.assign(
			{ message: cave_reply_label(room, { label: outcome.text }) },
			cave_dialogue_ref(room, "options." + option.id + ".outcomes." + option.outcomes.indexOf(outcome) + ".text"),
		),
	);
	for (var flag of outcome.flags || []) run.cave.flags[flag] = true;
	cave_credit(run, outcome.gold, outcome.amber, room);
	if (outcome.reward) cave_reward(run, room, outcome.reward);
	if (outcome.join && cave_follow_actor(run, room.npc)) cave_set_side(room.npc, "ally");
	else if (outcome.ally) cave_add_follower(run, room, outcome.ally);
	if (outcome.shadow) {
		var strongest = cave_players(run)
			.filter((p) => !p.rip)
			.sort((a, b) => b.attack - a.attack)[0];
		if (strongest) {
			var shadow = cave_spawn(run, room, "cave_npc", "enemy", 80, {
				name: strongest.name + "’s Shadow",
				skin: strongest.skin,
				cx: strongest.cx,
			});
			if (shadow) {
				shadow.slots = JSON.parse(JSON.stringify(strongest.slots));
				shadow.hp = shadow.max_hp = strongest.max_hp * 2;
				Object.assign(shadow.zone_stats, {
					attack: strongest.attack * 0.7,
					frequency: strongest.frequency,
					speed: strongest.speed,
				});
				calculate_monster_stats(shadow);
				return;
			}
		}
	}
	if (outcome.fight) {
		cave_pack(run, room, outcome.fight[0], outcome.fight[1]);
		return;
	}
	cave_complete(run, room);
}

function cave_wake_near(run, player) {
	for (var room of run.cave.rooms)
		if (room.map === player.map && room.saved && simple_distance(player, room) < 900)
			cave_resume_floor(run, room.map, room);
}
