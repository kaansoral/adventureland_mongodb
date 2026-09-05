// Runs in the game server's shared scope, alongside the existing citizen handlers.
var market_patron_sessions = new WeakMap();
var market_patron_account_next = new Map();
function market_patron_config() {
	return G.npcs.citizen22.market;
}
function market_patron_reset(player) {
	if (player) market_patron_sessions.delete(player);
}
// Inventory and gold changes already pass through resend. Observe only shops
// with a running timer; the citizen tick checks their surroundings once a second.
function market_patron_observe(player) {
	if (
		market_patron_sessions.has(player) &&
		(player.rip || player.dc || player.moving || !player.p.stand || !market_patron_rules.hasListing(player, G.items))
	)
		market_patron_reset(player);
}
function market_patron_status(player, now, members) {
	var instance = instances[player.in],
		members = members || Object.values((instance && instance.players) || {}),
		config = market_patron_config();
	var result = market_patron_rules.qualify(
		player,
		members.filter((p) => !p.npc),
		members.filter((p) => p.npc),
		config,
		G.items,
		market_patron_sessions.get(player),
		now,
	);
	if (result.session) market_patron_sessions.set(player, result.session);
	else market_patron_sessions.delete(player);
	var next = market_patron_account_next.get(player.owner) || 0;
	if (next > now) result.reasons.push({ code: "cooldown", remaining_ms: next - now });
	if (!can_add_item(player, { name: "marketparcel", q: 1 })) result.reasons.push({ code: "inventory" });
	result.next_at = Math.max(next, result.ready_at || 0);
	result.last = (player.p && player.p.merrit_receipt) || null;
	return result;
}
function market_patron_public_status(player, now, extra) {
	var result = market_patron_status(player, now);
	return Object.assign(
		{ reasons: result.reasons, next_at: result.next_at, last: result.last, server_now: now },
		extra || {},
	);
}
async function market_patron_info(player) {
	if (!player || (player.merrit_info_at && Date.now() - player.merrit_info_at < 3000)) return;
	player.merrit_info_at = Date.now();
	try {
		var owner = await get(player.owner),
			latest = owner && owner.info && owner.info.merrit;
		if (latest) market_patron_account_next.set(player.owner, latest.at + market_patron_config().hour_ms);
		if (players[player.socket.id] === player)
			player.socket.emit(
				"merrit_status",
				market_patron_public_status(player, Date.now(), { account_last: latest || null, open: true }),
			);
	} catch (e) {
		if (players[player.socket.id] === player)
			player.socket.emit("merrit_status", { open: true, reasons: [{ code: "unavailable" }] });
	}
}
function market_patron_can_visit(npc, player) {
	return (
		!npc.rip &&
		npc.in === player.in &&
		point_distance(0, 0, npc.x, npc.y) <= market_patron_config().radius &&
		simple_distance(npc, player) <= market_patron_config().handoff &&
		can_move({ map: npc.map, in: npc.in, x: npc.x, y: npc.y, going_x: player.x, going_y: player.y, base: npc.base })
	);
}
// The account, character inventory, and receipt commit together. A grant blocks
// normal character saves until its outcome is known, including disconnect saves.
async function market_patron_grant(npc, player) {
	if (
		player.merrit_grant ||
		player.sync_call ||
		player.mount_call ||
		player.unmount_call ||
		player.stop_call ||
		player.mounting ||
		player.unmounting ||
		mode.prevent_external ||
		gameplay === "hardcore" ||
		gameplay === "test"
	)
		return;
	var config = market_patron_config(),
		id = randomStr(32),
		roll = Math.random();
	player.merrit_grant = { id: id };
	var prepare = function () {
		if (
			players[player.socket.id] !== player ||
			!market_patron_can_visit(npc, player) ||
			market_patron_status(player, Date.now()).reasons.length
		)
			return null;
		var data = JSON.parse(JSON.stringify(player_to_server(player, "merrit")));
		// Use the normal insertion rules on the detached save snapshot, with no
		// announcements or live inventory changes until the transaction commits.
		add_item(
			{ items: data.items, citems: [], esize: player.esize, name: player.name },
			{ name: "marketparcel", q: 1 },
			{ announce: false },
		);
		return data;
	};
	var result = await tx(
		async () => {
			var owner = await tx_get(A.owner),
				entity = await tx_get(A.character);
			if (
				!owner ||
				!entity ||
				entity.owner !== A.owner ||
				entity.server !== A.server ||
				entity.info.secret !== A.secret
			)
				ex("not_in_game");
			var last = owner.info.merrit,
				now = Date.now();
			if (last && now - last.at < A.hour) {
				R.next = last.at + A.hour;
				ex("cooldown");
			}
			var data = A.prepare();
			if (!data) ex("ineligible");
			var shells = A.roll < A.chance(owner.cash) ? 1 : 0;
			R.receipt = {
				id: A.id,
				at: now,
				character: A.character,
				name: A.name,
				item: "marketparcel",
				quantity: 1,
				shells: shells,
				reason: "An open, stocked shop kept its place and left the neighboring shops clear for an hour.",
			};
			data.p.merrit_receipt = R.receipt;
			A.sync(entity, data);
			entity.merrit_receipt = R.receipt;
			entity.last_sync = new Date();
			owner.info.merrit = R.receipt;
			owner.cash = (owner.cash || 0) + shells;
			owner.info.merrit_history = [R.receipt].concat(owner.info.merrit_history || []).slice(0, 10);
			await tx_save(entity);
			await tx_save(owner);
			R.cash = owner.cash;
		},
		{
			owner: player.owner,
			character: get_id(player),
			server: server_id,
			secret: player.secret,
			name: player.name,
			id: id,
			roll: roll,
			hour: config.hour_ms,
			prepare: prepare,
			sync: sync_entity,
			chance: (balance) => market_patron_rules.shellChance(balance, config),
		},
	);
	if (result.failed) {
		// A lost commit acknowledgement is resolved by the durable receipt, never by
		// rolling again or releasing the character for an older save.
		try {
			var persisted = await get(get_id(player)),
				owner = await get(player.owner);
			if (persisted && persisted.merrit_receipt && persisted.merrit_receipt.id === id)
				result = { receipt: persisted.merrit_receipt, cash: owner.cash };
			else {
				if (owner && owner.info.merrit)
					market_patron_account_next.set(player.owner, owner.info.merrit.at + config.hour_ms);
				delete player.merrit_grant;
				return;
			}
		} catch (e) {
			player.merrit_grant.recover = true;
			return;
		}
	}
	market_patron_finish(player, result.receipt, result.cash);
}
function market_patron_finish(player, receipt, cash) {
	if (player.p.merrit_receipt && player.p.merrit_receipt.id === receipt.id) {
		delete player.merrit_grant;
		return;
	}
	add_item(player, { name: "marketparcel", q: 1 }, { announce: false });
	player.p.merrit_receipt = receipt;
	market_patron_reset(player);
	market_patron_account_next.set(player.owner, receipt.at + market_patron_config().hour_ms);
	if (receipt.shells) {
		player.cash = cash;
		add_event(player, "ishells", ["cashflow"], { info: { amount: 1, reason: "merrit", receipt: receipt.id } });
	}
	delete player.merrit_grant;
	if (players[player.socket.id] === player) {
		resend(player, "reopen+nc+inv");
		player.socket.emit("merrit_gift", { id: receipt.id, receipt: receipt });
		player.socket.emit("merrit_status", market_patron_public_status(player, Date.now()));
		var npc = citizen_npc_in_instance(player.in, "citizen22");
		if (npc)
			disappearing_text(
				player.socket,
				npc,
				receipt.shells ? "A parcel, and 1 SHELL. Good to see your shop!" : "A parcel for keeping a shop on the square.",
				{ color: "#DDB979" },
			);
	}
}
async function market_patron_recover(player) {
	var pending = player.merrit_grant;
	if (!pending || !pending.recover || pending.checking || Date.now() < (pending.retry_at || 0)) return;
	pending.checking = true;
	try {
		var entity = await get(get_id(player)),
			owner = await get(player.owner);
		if (entity && entity.merrit_receipt && entity.merrit_receipt.id === pending.id)
			market_patron_finish(player, entity.merrit_receipt, owner.cash);
		else delete player.merrit_grant;
	} catch (e) {
		pending.checking = false;
		pending.retry_at = Date.now() + 3000;
	}
}
function market_patron_loop(npc, nowDate) {
	var now = +nowDate,
		config = market_patron_config();
	if (npc.map !== "main" || npc.in !== "main" || point_distance(0, 0, npc.x, npc.y) > config.radius) {
		market_patron_stop(npc);
		transport_player_to(npc, "main", [0, 0], 1);
		return true;
	}
	if (npc.merrit_tick && now - npc.merrit_tick < 1000) return true;
	npc.merrit_tick = now;
	var instance = instances[npc.in];
	if (!instance || instance.paused) return true;
	var candidates = [],
		members = Object.values(instance.players);
	for (var p of members) {
		if (p.npc) continue;
		var status = market_patron_status(p, now, members);
		if (p.p.stand && (!p.merrit_status_at || now - p.merrit_status_at >= 15000)) {
			p.merrit_status_at = now;
			p.socket.emit("merrit_status", {
				reasons: status.reasons,
				next_at: status.next_at,
				last: status.last,
				server_now: now,
			});
		}
		if (!status.reasons.length && !p.merrit_grant && (!p.merrit_retry_at || now >= p.merrit_retry_at))
			candidates.push({ player: p, ready: status.ready_at });
	}
	for (var [owner, next] of market_patron_account_next) if (next < now) market_patron_account_next.delete(owner);
	candidates.sort((a, b) => a.ready - b.ready || simple_distance(npc, a.player) - simple_distance(npc, b.player));
	var target = candidates.length && candidates[0].player;
	if (target && market_patron_can_visit(npc, target)) {
		market_patron_stop(npc);
		target.merrit_retry_at = now + 10000;
		market_patron_grant(npc, target).catch((e) => {
			if (target.merrit_grant) target.merrit_grant.recover = true;
			log_trace("Merrit grant", e);
		});
		return true;
	}
	if (npc.moving) return true;
	var point = target && [target.x, target.y];
	if (!point) {
		point = config.stops[npc.merrit_stop || 0];
		if (point_distance(npc.x, npc.y, point[0], point[1]) < 28) {
			npc.merrit_stop = ((npc.merrit_stop || 0) + 1) % config.stops.length;
			point = config.stops[npc.merrit_stop];
		}
	}
	var next = fast_astar({
		map: npc.map,
		sx: npc.x,
		sy: npc.y,
		tx: point[0],
		ty: point[1],
		within: (x, y) => point_distance(0, 0, x, y) <= config.radius,
	});
	if (!next || !citizen_move_to(npc, next[0], next[1])) {
		if (target) {
			target.merrit_retry_at = now + 30000;
			target.socket.emit(
				"merrit_status",
				market_patron_public_status(target, now, { reasons: [{ code: "unreachable" }] }),
			);
		}
	}
	return true;
}

function market_patron_stop(npc) {
	npc.moving = false;
	npc.going_x = npc.x;
	npc.going_y = npc.y;
	npc.vx = npc.vy = 0;
	npc.u = true;
	npc.cid++;
}
