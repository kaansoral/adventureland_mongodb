// Shared server scope. Map delivery and admission are independent of zone content.
var generated_runs = Object.create(null);
var generated_maps = Object.create(null);
var generated_openings = new Set();
var generated_layout_queue = require("./logic/generated_layouts").createLayoutQueue(() => ({
	maps: {},
	geometry: {},
	monsters: G.monsters,
	dimensions: G.dimensions,
}));
var generated_last_tick = 0;

function generated_clock(record, now = Date.now()) {
	return record.paused_at || now;
}

function generated_member(record, player) {
	return record && player && record.members.find((m) => m.character === player.real_id && m.owner === player.owner);
}
function generated_return_run(player) {
	return Object.values(generated_runs).find((record) => {
		var member = generated_member(record, player);
		return member?.disconnected && !member.left && !record.closing && record.expires > generated_clock(record);
	});
}
function generated_entry(player) {
	return player && generated_maps[player.map];
}
function generated_can_enter(player, instance) {
	var to = instance && generated_maps[instance.map],
		from = generated_entry(player);
	if (!to && !from) return true;
	if (player.zone_transfer && player.zone_transfer === (instance && instance.name)) return true;
	if (
		!to ||
		!from ||
		to.record !== from.record ||
		to.record.closing ||
		to.record.paused_at ||
		to.record.expires <= generated_clock(to.record)
	)
		return false;
	var member = generated_member(to.record, player);
	return !!(
		member &&
		!member.left &&
		player.socket.generated_protocol === 1 &&
		(to.floor.definition.generated.floor <= from.floor.definition.generated.floor ||
			to.record.completed[from.floor.definition.generated.floor])
	);
}
function generated_magiport_allowed(a, b) {
	return !generated_entry(a) && !generated_entry(b);
}
function restore_generated_maps() {
	for (var run of Object.values(generated_runs))
		for (var info of run.manifest) G.maps[info.key] = Object.assign({}, info.definition);
	for (var key in generated_maps) {
		var floor = generated_maps[key].floor;
		G.maps[key] = floor.definition;
		G.geometry[key] = floor.geometry;
		G.maps[key].data = floor.geometry;
	}
}
function prepare_generated_run(seed, key, exit_spawn) {
	return generated_layout_queue.build({ zone: "dreams", seed, key, exit_spawn }).catch((error) => {
		log_trace("dream layout " + seed, error.cause || error);
		throw error;
	});
}
function install_generated_floor(record, floor) {
	if (generated_maps[floor.key]) return;
	if (
		!record.floors.includes(floor.key) ||
		floor.definition.generated.run !== record.key ||
		floor.smap === -1 ||
		!Object.keys(floor.amap || {}).length
	)
		throw Error("invalid_floor");
	delete floor.manifest;
	generated_maps[floor.key] = { record, floor, last_occupied: Date.now() };
	G.maps[floor.key] = floor.definition;
	G.geometry[floor.key] = floor.geometry;
	G.maps[floor.key].data = floor.geometry;
	smap_data[floor.key] = floor.smap;
	amap_data[floor.key] = floor.amap;
	floor.worker = parseInt(record.key.slice(0, 6), 16) % workers.length;
	var collision = Object.fromEntries(
		Object.entries(floor.geometry).filter(([key]) => !["tiles", "placements", "groups"].includes(key)),
	);
	workers[floor.worker].postMessage({
		type: "map_data",
		map: floor.key,
		definition: Object.assign({}, floor.definition, { data: collision }),
		geometry: collision,
		smap_data: floor.smap,
		amap_data: floor.amap,
	});
	var instance = create_instance(floor.key, floor.key);
	instance.operators = 0;
	instance.info.zone = { run: record.key, floor: floor.definition.generated.floor, expires: record.expires };
	if (record.paused_at) freeze_instance(instance, Date.now());
}
function install_generated_run(record, floors) {
	if (floors.length !== 1 || generated_runs[record.key]) throw Error("invalid_zone");
	record.manifest = JSON.parse(JSON.stringify(floors[0].manifest));
	record.floors = record.manifest.map((f) => f.key);
	record.completed = [];
	record.building = Object.create(null);
	generated_runs[record.key] = record;
	for (var info of record.manifest) G.maps[info.key] = Object.assign({}, info.definition);
	try {
		install_generated_floor(record, floors[0]);
	} catch (error) {
		destroy_generated_run(record.key);
		throw error;
	}
}
function unload_generated_floor(record, key) {
	if (!generated_maps[key]) return;
	cave_suspend_floor(record, key);
	destroy_instance(key);
	delete G.geometry[key];
	delete smap_data[key];
	delete amap_data[key];
	delete generated_maps[key];
	var definition = record.manifest.find((f) => f.key === key).definition;
	G.maps[key] = Object.assign({}, definition);
	delete G.maps[key].data;
	for (var worker of workers) worker.postMessage({ type: "remove_map", map: key });
}
async function ensure_generated_floor(record, index) {
	var key = record.floors[index];
	if (!key) throw Error("cant_enter");
	if (generated_maps[key]) return;
	if (!record.building[key])
		record.building[key] = generated_layout_queue
			.build({ zone: record.zone, seed: record.seed, key: record.key, exit_spawn: record.exit_spawn, floor: index })
			.then((floors) => {
				if (record.closing || record.expires <= generated_clock(record) || !generated_runs[record.key])
					throw Error("cave_closed");
				install_generated_floor(record, floors[0]);
			})
			.finally(() => {
				delete record.building[key];
			});
	return record.building[key];
}
async function generated_use_door(player, data) {
	var from = generated_entry(player),
		record = from?.record,
		source = player.map;
	if (!record || !can_walk(player) || player.rip) throw Error("use_exit");
	var member = generated_member(record, player),
		index = record.floors.indexOf(data.to);
	if (!member || member.left || record.closing || record.expires <= generated_clock(record)) throw Error("cave_closed");
	if (record.paused_at) throw Error("cave_paused");
	var door = G.maps[source].doors.find((d) => d[4] === data.to && (d[5] || 0) === (data.s || 0));
	function reachable() {
		if (!door || player.map !== source || !check_player(player)) return false;
		return is_door_close(source, door, player.x, player.y) && can_use_door(source, door, player.x, player.y);
	}
	if (!reachable()) throw Error("transport_cant_reach");
	if (door[4] === "main") return cave_interaction(player, { action: "exit" });
	if (index < 0) throw Error("use_exit");
	if (index > from.floor.definition.generated.floor && !record.completed[from.floor.definition.generated.floor])
		throw Error("seal_closed");
	if (!generated_maps[data.to]) cave_say(record, "The stairway is opening. Stay near the landing.");
	await ensure_generated_floor(record, index);
	if (!reachable() || !can_walk(player) || !generated_can_enter(player, instances[data.to]))
		throw Error("transport_failed");
	generated_transport(player, data.to, door[5] || 0, 1);
	cave_follow_through(record, source, player);
	cave_wake_near(record, player);
	cave_publish(record);
	return { map: data.to };
}
function send_generated_maps(socket, map_name) {
	var entry = generated_maps[map_name];
	if (!entry) {
		socket.generated_run = null;
		socket.generated_floor = null;
		return;
	}
	if (socket.generated_floor === map_name) return;
	if (socket.generated_protocol !== 1) throw Error("client_update_required");
	var floors = [map_name].map(function (key) {
		var floor = generated_maps[key].floor;
		var definition = Object.assign({}, floor.definition);
		delete definition.data;
		var geometry = floor.geometry;
		if (socket.generated_headless)
			geometry = {
				x_lines: geometry.x_lines,
				y_lines: geometry.y_lines,
				min_x: geometry.min_x,
				min_y: geometry.min_y,
				max_x: geometry.max_x,
				max_y: geometry.max_y,
				tiles: [],
				placements: [],
				groups: [],
				animations: [],
			};
		return { key, definition, geometry, navigation: socket.generated_headless ? floor.amap : undefined };
	});
	var text = JSON.stringify({ run: entry.record.key, floors, manifest: entry.record.manifest });
	if (text.length > 16 * 1024 * 1024) throw Error("zone_delivery_limit");
	var size = 12000,
		count = Math.ceil(text.length / size);
	for (var index = 0; index < count; index++)
		socket.emit("map_chunk", {
			run: entry.record.key,
			index,
			count,
			text: text.slice(index * size, (index + 1) * size),
		});
	socket.generated_run = entry.record.key;
	socket.generated_floor = map_name;
	cave_send_chests(entry.record, socket, map_name);
}
function generated_transport(player, name, spawn, effect) {
	player.zone_transfer = name;
	try {
		return transport_player_to(player, name, spawn, effect);
	} finally {
		delete player.zone_transfer;
	}
}
function generated_exit(player, reason) {
	var entry = generated_entry(player);
	if (!entry) return false;
	var record = entry.record;
	release_frozen_player(player);
	generated_leave_member(record, generated_member(record, player), reason);
	player.socket.emit("cave", { type: "ended", reason, state: record.cave ? cave_snapshot(record, player) : null });
	delete player.cave;
	generated_restore_health(player);
	generated_transport(player, "main", record.exit_spawn, 1);
	return true;
}
function generated_leave_member(record, member, reason) {
	if (!member || member.left) return;
	member.left = true;
	member.left_reason = reason;
	// Keep interrupted membership until its durable refund completes. A crash can then recover it.
	if (record.restarting) return;
	void db
		.collection("GeneratedZone")
		.updateOne({ _id: "member:" + member.character, run: record.key }, { $set: { active: false } })
		.catch((e) => log_trace("zone exit", e));
}
function generated_restore_health(player) {
	player.rip = false;
	player.hp = player.max_hp;
	player.mp = Math.max(player.mp || 0, Math.round(player.max_mp / 2));
	delete player.rip_time;
	for (var key of ["block", "poisoned", "burned", "eburn"]) delete player.s[key];
	player.moving = false;
	player.vx = player.vy = 0;
}
function generated_disconnect(player) {
	var entry = generated_entry(player);
	if (!entry) return false;
	var record = entry.record,
		member = generated_member(record, player);
	// The normal disconnect routine removes spatial membership before saving.
	// Keep the cave state separate from the safe outside character saved at logout.
	release_frozen_player(player);
	if (member && !member.left && !record.closing) {
		member.disconnected = {
			map: player.map,
			x: player.x,
			y: player.y,
			at: Date.now(),
			hp: player.hp,
			mp: player.mp,
			rip: player.rip,
			rip_time: player.rip_time,
			s: clone(player.s),
			last: Object.assign({}, player.last),
		};
	}
	delete player.cave;
	delete player.state;
	generated_restore_health(player);
	player.map = player.in = "main";
	[player.x, player.y] = G.maps.main.spawns[record.exit_spawn];
	player.going_x = player.x;
	player.going_y = player.y;
	// A conversation cannot stop the clock while everyone is disconnected.
	if (!cave_players(record).length) cave_resume(record);
	return true;
}
async function generated_return(player, record) {
	var member = generated_member(record, player);
	if (!member?.disconnected || member.left || record.closing) throw Error("cave_closed");
	if (member.rejoining) throw Error("already_opening");
	generated_admission(player, [player]);
	member.rejoining = true;
	var saved = member.disconnected,
		outside,
		animated = false;
	try {
		await ensure_generated_floor(record, record.floors.indexOf(saved.map));
		generated_admission(player, [player]);
		animated = true;
		await cave_enter_effect([player], record.key);
		generated_admission(player, [player]);
		if (generated_return_run(player) !== record || member.disconnected !== saved) throw Error("cave_closed");
		var point = safe_xy_nearby(saved.map, saved.x, saved.y);
		if (!point) throw Error("transport_failed");
		outside = {
			hp: player.hp,
			mp: player.mp,
			rip: player.rip,
			rip_time: player.rip_time,
			s: player.s,
			last: Object.assign({}, player.last),
		};
		player.hp = Math.min(player.hp, saved.hp);
		player.mp = Math.min(player.mp, saved.mp);
		player.rip = !!saved.rip;
		if (saved.rip_time) player.rip_time = saved.rip_time;
		else delete player.rip_time;
		player.s = clone(saved.s);
		for (var key in player.s)
			if (typeof player.s[key].ms === "number") {
				player.s[key].ms -= Date.now() - saved.at;
				if (player.s[key].ms <= 0) delete player.s[key];
			}
		for (var key in saved.last)
			if (!player.last[key] || +saved.last[key] > +player.last[key]) player.last[key] = saved.last[key];
		generated_transport(player, saved.map, [point.x, point.y], 1);
		if (!check_player(player) || generated_entry(player)?.record !== record) throw Error("transport_failed");
		delete member.disconnected;
		if (record.paused_at) {
			var frozen = instances[player.in].frozen;
			if (frozen) {
				frozen.actors.add(player);
				(frozen.joined ||= new Map()).set(player, Date.now());
			}
		} else if (record.cave.vote && !record.cave.vote.resolved) cave_pause(record);
		cave_wake_near(record, player);
		cave_publish(record, false, player);
		return { run: record.key, expires: record.expires, level: record.level, resumed: true };
	} catch (error) {
		if (outside && player.map === "main") Object.assign(player, outside);
		if (animated && check_player(player) && player.map === "main")
			xy_emit(player, "ui", { type: "cave_enter", key: record.key, cancel: true });
		throw error;
	} finally {
		delete member.rejoining;
	}
}
function generated_recover_login(player) {
	if (!/^zone_[a-f0-9]{24}_[0-7]$/.test(player.map || "")) return;
	// A restart may already have discarded the floor manifest.
	var spawn = G.maps[player.map]?.on_exit?.[1] ?? G.maps.main.spawns.findIndex((p) => p[0] === 816 && p[1] === 1200);
	player.map = player.in = "main";
	[player.x, player.y] = G.maps.main.spawns[Math.max(0, spawn)];
	delete player.state;
	player.rip = false;
	player.hp = Math.max(1, player.hp || 0);
	return true;
}
function destroy_generated_run(key, reason = "closed") {
	var record = generated_runs[key];
	if (!record || record.closing) return;
	record.closing = true;
	record.restarting = reason === "restart";
	if (record.restarting)
		for (var owner of new Set(record.members.filter((m) => !m.left).map((m) => m.owner)))
			void generated_refund_visit(owner, record.key).catch((e) => log_trace("cave restart refund", e));
	if (record.cave) cave_settle_purse(record);
	for (var member of record.members) {
		var p = get_player(member.name);
		if (p && generated_entry(p)?.record === record) generated_exit(p, reason);
	}
	for (var map_name of record.floors || []) {
		if (instances[map_name]) destroy_instance(map_name);
		for (var id in chests) if (chests[id].in === map_name) delete chests[id];
		delete G.maps[map_name];
		delete G.geometry[map_name];
		delete smap_data[map_name];
		delete amap_data[map_name];
		delete generated_maps[map_name];
		for (var worker of workers) worker.postMessage({ type: "remove_map", map: map_name });
	}
	if (!record.restarting)
		void db
			.collection("GeneratedZone")
			.updateMany(
				{ _id: { $in: record.members.map((m) => "member:" + m.character) }, run: key, active: true },
				{ $set: { active: false } },
			)
			.catch((e) => log_trace("zone close", e));
	delete generated_runs[key];
}
function generated_maps_tick() {
	var now = Date.now();
	if (now - generated_last_tick < 100) return;
	generated_last_tick = now;
	for (var key in generated_runs) {
		var record = generated_runs[key];
		try {
			if (record.expires <= generated_clock(record, now)) {
				destroy_generated_run(key);
				continue;
			}
			if (record.members.every((m) => m.left)) {
				destroy_generated_run(key);
				continue;
			}
			cave_tick(record, now);
			for (var key of record.floors) {
				var entry = generated_maps[key];
				if (!entry) continue;
				if (record.members.some((m) => !m.left && get_player(m.name)?.map === key)) entry.last_occupied = now;
				else if (now - entry.last_occupied > 20000) unload_generated_floor(record, key);
			}
		} catch (error) {
			// A broken run must not skip other caves or the rest of the world's instance loop.
			if (!record.last_error || now - record.last_error >= 5000) {
				record.last_error = now;
				log_trace("generated run " + record.key, error);
			}
		}
	}
}
function generated_party(player) {
	return Object.values(players).filter((p) => p === player || (player.party && p.party === player.party));
}
function generated_admission(player, members) {
	if (G.events.dreams.disabled) throw Error("cave_closed");
	if (!check_player(player) || player.rip || player.map !== "main" || !can_walk(player)) throw Error("cant_enter");
	if (members.length < 1 || members.length > 3) throw Error("party_too_large");
	if (
		members.some(
			(p) =>
				p.rip ||
				p.dc ||
				p.socket.disconnected ||
				p.map !== "main" ||
				!can_walk(p) ||
				p.targets > 0 ||
				p.socket.generated_protocol !== 1 ||
				simple_distance(p, { map: "main", in: "main", x: 816, y: 1200 }) > 160,
		)
	)
		throw Error("bring_party_to_keeper");
	if (members.some((p) => generated_entry(p))) throw Error("already_inside");
}
async function open_generated_zone(player) {
	var returning = generated_return_run(player);
	if (returning) return generated_return(player, returning);
	var members = generated_party(player);
	generated_admission(player, members);
	var prior = await db.collection("GeneratedZone").findOne({ _id: "member:" + player.real_id });
	if (prior?.active && prior.expires > Date.now() && prior.server && prior.server !== server_id)
		throw Error("cave_other_server");
	var accounts = [
		...new Map(
			members
				.slice()
				.sort((a, b) => a.real_id.localeCompare(b.real_id))
				.map((p) => [p.owner, p]),
		).values(),
	];
	if (accounts.some((p) => generated_openings.has(p.owner))) throw Error("already_opening");
	if (Object.keys(generated_runs).length >= 72) throw Error("zone_busy");
	accounts.forEach((p) => generated_openings.add(p.owner));
	var key = crypto.randomBytes(12).toString("hex"),
		collection = db.collection("GeneratedZone");
	var claimed = [],
		reserved = [],
		animated = false,
		activated = false;
	try {
		for (var account of accounts.sort((a, b) => a.owner.localeCompare(b.owner))) {
			// Dev visits do not read or consume the account's daily reservation.
			// Character locks and all party admission checks still apply.
			if (Dev && !Prod) continue;
			await generated_refund_visit(account.owner);
			var daily = "daily:dreams:" + account.owner,
				window = generated_daily_window(account.p.home || region + server_name);
			try {
				await collection.updateOne(
					{ _id: daily, $or: [{ resets: { $lte: Date.now() } }, { state: "preparing", lease: { $lt: Date.now() } }] },
					{
						$set: {
							run: key,
							owner: account.owner,
							server: server_id,
							boot: Server.info.cave_boot,
							members: members.filter((p) => p.owner === account.owner).map((p) => "member:" + p.real_id),
							state: "preparing",
							home: window.home,
							resets: window.resets,
							lease: Date.now() + 180000,
						},
					},
					{ upsert: true },
				);
				reserved.push(daily);
			} catch (error) {
				if (error.code === 11000) throw Error("daily_opening_used");
				throw error;
			}
		}
		for (var p of members) {
			var id = "member:" + p.real_id;
			try {
				await collection.updateOne(
					{ _id: id, $or: [{ active: false }, { expires: { $lt: Date.now() } }] },
					{ $set: { run: key, server: server_id, active: true, expires: Date.now() + 30 * 60 * 1000 } },
					{ upsert: true },
				);
			} catch (error) {
				if (error.code === 11000) throw Error("character_already_entering");
				throw error;
			}
			claimed.push(id);
		}
		var exit_spawn = G.maps.main.spawns.findIndex((s) => s[0] === 816 && s[1] === 1200);
		var seed = crypto.randomBytes(16).toString("hex");
		var floors = await prepare_generated_run(seed, key, exit_spawn);
		generated_admission(player, members);
		animated = true;
		await cave_enter_effect(members, key);
		generated_admission(player, members);
		if (
			members.some((p) => get_player(p.name) !== p) ||
			generated_party(player).some((p) => !members.includes(p)) ||
			members.some((p) => p !== player && p.party !== player.party)
		)
			throw Error("party_changed");
		var record = {
			key,
			seed,
			zone: "dreams",
			owner: player.owner,
			exit_spawn,
			level: Math.max(...members.map((p) => p.level)),
			expires: Date.now() + 24 * 60 * 1000,
			members: members.map((p) => ({ name: p.name, character: p.real_id, owner: p.owner, left: false })),
		};
		var admission = await collection.updateMany(
			{ _id: { $in: reserved }, run: key, state: "preparing", lease: { $gt: Date.now() } },
			{ $set: { state: "active", expires: record.expires } },
		);
		if (admission.matchedCount !== reserved.length) throw Error("admission_expired");
		var locks = await collection.updateMany(
			{ _id: { $in: claimed }, run: key, active: true, expires: { $gt: Date.now() } },
			{ $set: { expires: record.expires } },
		);
		if (locks.matchedCount !== claimed.length) throw Error("admission_expired");
		generated_admission(player, members);
		install_generated_run(record, floors);
		cave_start(record);
		activated = true;
		for (var p of members) generated_transport(p, record.floors[0], 0, 1);
		cave_publish(record);
		return { run: key, expires: record.expires, level: record.level };
	} catch (error) {
		var waiting = members.find((p) => p.map === "main");
		if (animated && waiting) xy_emit(waiting, "ui", { type: "cave_enter", key, cancel: true });
		throw error;
	} finally {
		accounts.forEach((p) => generated_openings.delete(p.owner));
		if (!activated) {
			if (generated_runs[key]) destroy_generated_run(key);
			if (reserved.length) await collection.deleteMany({ _id: { $in: reserved }, run: key });
			if (claimed.length) await collection.updateMany({ _id: { $in: claimed }, run: key }, { $set: { active: false } });
		}
	}
}
async function enter_dreams(player, data) {
	try {
		if (data.name) throw Error("cant_reenter");
		var result = await open_generated_zone(player);
		player.socket.emit("game_response", Object.assign({ place: "enter", success: true }, result));
	} catch (error) {
		player.socket.emit("game_response", { place: "enter", failed: true, reason: error.message });
	}
}

function generated_daily_window(home, now = Date.now()) {
	var region_name = Object.keys(TIMEO).find((r) => home.startsWith(r));
	if (!region_name) throw Error("invalid_home_server");
	var offset = TIMEO[region_name] * 60 * 60 * 1000;
	var midnight = Math.floor((now + offset) / 86400000) * 86400000;
	return { home, resets: midnight + 86400000 - offset };
}

async function generated_refund_visit(owner, interrupted_run) {
	generated_refund_visit.pending = (generated_refund_visit.pending || 0) + 1;
	try {
		var collection = db.collection("GeneratedZone"),
			daily = await collection.findOne({ _id: "daily:dreams:" + owner });
		if (!daily || !daily.members?.length) return daily;
		if (daily.state !== "refunding") {
			if (daily.state !== "active" && daily.state !== "preparing") return daily;
			if (interrupted_run) {
				if (daily.run !== interrupted_run) return daily;
			} else {
				if (!daily.boot || !daily.server) return daily;
				var source = daily.server === server_id ? Server : await get(daily.server);
				if (!source?.info?.cave_boot || source.info.cave_boot === daily.boot) return daily;
				// Explicit exits and expired runs already clear membership; disconnects retain it.
				if (
					daily.state === "active" &&
					!(await collection.findOne({ _id: { $in: daily.members }, run: daily.run, active: true }))
				)
					return daily;
			}
			var marked = await collection.updateOne(
				{ _id: daily._id, run: daily.run, state: daily.state },
				{ $set: { state: "refunding" } },
			);
			if (!marked.matchedCount) return generated_refund_visit(owner, interrupted_run);
		}
		// This order is restart-safe: a retry finishes a marked refund even if membership is already cleared.
		await collection.updateMany({ _id: { $in: daily.members }, run: daily.run }, { $set: { active: false } });
		await collection.deleteMany({ _id: { $in: [daily._id] }, run: daily.run, state: "refunding" });
		return null;
	} finally {
		generated_refund_visit.pending--;
	}
}

async function generated_visit_info(player) {
	var window = generated_daily_window(player.p.home || region + server_name);
	var unlimited = Dev && !Prod,
		daily = unlimited ? null : await generated_refund_visit(player.owner);
	var used = daily && daily.resets > Date.now() && (daily.state === "active" || daily.lease > Date.now());
	var info = {
		available: !used,
		resets: used ? daily.resets : window.resets,
		home: window.home,
		server_time: Date.now(),
	};
	if (unlimited) info.unlimited = true;
	var record = generated_return_run(player);
	if (record)
		info.resume = {
			run: record.key,
			server: server_id.slice(3),
			remaining_ms: record.expires - generated_clock(record),
		};
	else {
		var member = await db.collection("GeneratedZone").findOne({ _id: "member:" + player.real_id });
		if (member?.active && member.expires > Date.now() && member.server && member.server !== server_id)
			info.resume = { run: member.run, server: member.server.slice(3) };
	}
	return info;
}

// Movement workers keep only their assigned generated floors, including after a worker restart.
function generated_worker_data(index) {
	var maps = {},
		geometry = {},
		smaps = {},
		amaps = {};
	for (var key in G.maps) {
		if (G.maps[key].generated && generated_maps[key]?.floor.worker !== index) continue;
		maps[key] = G.maps[key];
		if (G.geometry[key]) geometry[key] = G.geometry[key];
		if (smap_data[key] !== undefined) smaps[key] = smap_data[key];
		if (amap_data[key]) amaps[key] = amap_data[key];
	}
	return { G: Object.assign({}, G, { maps, geometry }), smap_data: smaps, amap_data: amaps };
}
