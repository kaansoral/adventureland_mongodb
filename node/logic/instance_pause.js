// A forced conversation freezes simulation time, not sockets or the server clock.
// Empty-instance sleeping remains independent of this short, explicit pause.
function instance_is_frozen(entity) {
	return !!(entity && (entity.zone_entering || instances[entity.in]?.frozen));
}
function freeze_instance(instance, now) {
	if (!instance || instance.frozen) return;
	var actors = [...Object.values(instance.players), ...Object.values(instance.monsters)];
	instance.frozen = { at: now, actors: new Set(actors) };
	for (var actor of actors) {
		actor.moving = false;
		actor.vx = actor.vy = 0;
		actor.going_x = actor.x;
		actor.going_y = actor.y;
		actor.working = false;
		if (actor.zone_actor) actor.zone_actor.path_token = null;
		actor.u = true;
		actor.cid = (actor.cid || 0) + 1;
	}
	var updates = actors.map((actor) => ({
		id: actor.id,
		entity: actor,
		data: actor.is_monster ? monster_to_client(actor) : player_to_client(actor, 1),
	}));
	for (var player of Object.values(instance.players)) {
		if (!player.npc) player.socket.emit("player", player_to_client(player));
		send_xy_updates(player, updates);
	}
	for (var observer of Object.values(instance.observers)) send_xy_updates(observer, updates);
}
function shift_entity_timers(actor, ms) {
	function shiftDates(object) {
		for (var key in object) if (object[key] instanceof Date) object[key] = new Date(+object[key] + ms);
	}
	shiftDates(actor.last || {});
	for (var condition of Object.values(actor.s || {})) shiftDates(condition);
	for (var channel of Object.values(actor.c || {})) if (channel && typeof channel === "object") shiftDates(channel);
	if (actor.slots?.elixir?.expires instanceof Date)
		actor.slots.elixir.expires = new Date(+actor.slots.elixir.expires + ms);
	for (var key of ["last_aggro", "last_level", "last_regen", "last_heal"]) {
		if (actor[key] instanceof Date) actor[key] = new Date(+actor[key] + ms);
	}
	if (actor.is_player && !actor.npc && actor.socket) {
		for (var name in actor.last) {
			var cooldown = name === "attack" ? 1000 / actor.frequency : G.skills[name]?.cooldown;
			var left = +actor.last[name] + (cooldown || 0) - Date.now();
			if (cooldown && left > 0) actor.socket.emit("skill_timeout", { name, ms: left });
		}
	}
}
function release_frozen_player(player, now = Date.now()) {
	var frozen = instances[player.in]?.frozen;
	if (!frozen || !frozen.actors.delete(player)) return;
	shift_entity_timers(player, now - (frozen.joined?.get(player) ?? frozen.at));
	frozen.joined?.delete(player);
}
function resume_frozen_instance(instance, now) {
	var frozen = instance?.frozen;
	if (!frozen) return;
	var ms = now - frozen.at;
	for (var actor of frozen.actors)
		if (actor.in === instance.name) shift_entity_timers(actor, now - (frozen.joined?.get(actor) ?? frozen.at));
	for (var projectile of Object.values(projectiles)) {
		if (projectile.attacker.in === instance.name) projectile.eta = new Date(+projectile.eta + ms);
	}
	instance.last_update = new Date(now);
	delete instance.frozen;
}
function instance_block_action(player, method, data) {
	if (!instance_is_frozen(player)) return false;
	// Reading, chatting, CODE and leaving still work. Reopening INFO never pauses a run.
	if (
		[
			"disconnect",
			"error",
			"loaded",
			"ping_trig",
			"requested_ack",
			"ccreport",
			"mreport",
			"notice",
			"send_updates",
			"property",
			"code",
			"say",
			"cm",
			"party",
			"friend",
			"players",
			"target",
			"tracker",
			"render",
			"trade_history",
			"secondhands",
			"leave",
			"stop",
			"respawn",
		].includes(method)
	)
		return false;
	if (
		method === "interaction" &&
		data.type === "cave" &&
		["vote", "state", "info", "talk", "exit"].includes(data.action)
	)
		return false;
	if (method === "move") player.socket.emit("correction", { x: player.x, y: player.y });
	player.socket.emit("game_response", {
		response: "data",
		failed: true,
		reason: player.zone_entering ? "cave_entering" : "cave_paused",
		place: method === "skill" ? data.name : method,
		request_id: data.request_id,
	});
	return true;
}
