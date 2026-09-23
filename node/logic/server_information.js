"use strict";

// Private, approximate server snapshots. No database access or player-facing data.
module.exports = function (serverId) {
	const hour = 60 * 60 * 1000;
	let recent = {},
		byOwner = {},
		byGroup = {};
	const information = {
		servers: {},
		next_pull: 0,
		remember,
		restore,
		snapshot,
		receive,
		foreign_activity,
		foreign_group_activity,
	};

	function remember(player, now = Date.now()) {
		if (!player.real_id || !player.owner) return;
		recent[player.real_id] = { owner: player.owner, type: player.type, last_online: now };
		var pid = player.pid || (player.p && (player.p.steam_id || player.p.mas_auth_id));
		if (pid) recent[player.real_id].pid = pid;
	}
	function restore(saved = {}, now = Date.now()) {
		recent = {};
		for (const [id, entry] of Object.entries(saved)) {
			if (!entry || !Number.isFinite(entry.last_online) || entry.last_online <= now - hour) continue;
			remember({ real_id: id, owner: entry.owner, pid: entry.pid, type: entry.type }, entry.last_online);
		}
	}
	function snapshot(players, now = Date.now()) {
		for (const player of Object.values(players)) if (!player.dc) remember(player, now);
		for (const id in recent) if (recent[id].last_online <= now - hour) delete recent[id];
		// Keep the Server document bounded even under unusually high character churn.
		const ids = Object.keys(recent);
		if (ids.length > 10000) {
			ids.sort((a, b) => recent[b].last_online - recent[a].last_online);
			for (const id of ids.slice(10000)) delete recent[id];
		}
		return { ...recent };
	}
	function receive(servers, now = Date.now()) {
		information.servers = {};
		byOwner = {};
		byGroup = {};
		for (const server of servers) {
			information.servers[server._id] = server;
			if (server._id === serverId) continue;
			// Offline servers still provide evidence of recent visits. Never advance their timestamps.
			for (const [id, entry] of Object.entries(server.info?.recent_characters || {})) {
				if (!entry || !entry.owner || entry.type === "merchant" || !Number.isFinite(entry.last_online)) continue;
				if (entry.last_online <= now - hour) continue;
				const owner = (byOwner[entry.owner] ||= {});
				owner[id] = Math.max(owner[id] || 0, entry.last_online);
				var group = (byGroup[entry.pid ? "pid:" + entry.pid : "owner:" + entry.owner] ||= {});
				group[id] = Math.max(group[id] || 0, entry.last_online);
			}
		}
	}
	function foreign_activity(owner, characterId) {
		let latest = 0;
		for (const id in byOwner[owner] || {}) {
			if (id !== characterId) latest = Math.max(latest, byOwner[owner][id]);
		}
		return latest;
	}
	function foreign_group_activity(key, characterId) {
		let latest = 0;
		for (const id in byGroup[key] || {}) if (id !== characterId) latest = Math.max(latest, byGroup[key][id]);
		return latest;
	}
	return information;
};
