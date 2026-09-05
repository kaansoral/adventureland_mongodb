"use strict";

module.exports = function (distance) {
	function inArea(p, config) {
		return (
			p.map === "main" &&
			p.in === "main" &&
			config.areas.some(([x0, y0, x1, y1]) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)
		);
	}
	function hasListing(p, items) {
		return Object.entries(p.slots || {}).some(
			([slot, item]) =>
				/^trade\d+$/.test(slot) &&
				item &&
				items[item.name] &&
				item.name !== "placeholder" &&
				!item.l &&
				!item.acl &&
				!item.v &&
				item.giveaway === undefined &&
				Number.isFinite(item.price) &&
				item.price > 0 &&
				(item.q === undefined || item.q > 0) &&
				(item.b ? p.gold >= item.price : true),
		);
	}
	function blockers(p, characters, npcs, config) {
		const reasons = [];
		for (const n of npcs)
			if (n.in === p.in && !n.movable && !n.loop && distance(p, n) <= config.npc_clearance)
				reasons.push({ code: "npc", name: n.name, distance: distance(p, n) });
		for (const other of characters) {
			if (other === p || other.npc || other.in !== p.in || !other.p?.stand) continue;
			const dx = p.x - other.x,
				dy = p.y - other.y,
				d = distance(p, other);
			if (d <= config.stand_clearance) reasons.push({ code: "stand_close", name: other.name, distance: d });
			else if (Math.abs(dx) <= config.front_width && dy >= 0 && dy <= config.front_clearance)
				reasons.push({ code: "stand_front", name: other.name, distance: d });
		}
		return reasons;
	}
	function shellChance(balance, config) {
		const s = Math.min(10, Math.max(0, Math.floor(Number(balance) || 0)));
		return config.shell_floor + (config.shell_zero - config.shell_floor) * ((10 - s) / 10) ** 2;
	}
	function qualify(p, characters, npcs, config, items, session, now) {
		let reasons = blockers(p, characters, npcs, config);
		if (!inArea(p, config)) reasons.push({ code: "area" });
		if (p.rip || p.dc || p.user || p.moving || !p.p?.stand) reasons.push({ code: "closed" });
		if (!hasListing(p, items)) reasons.push({ code: "listing" });
		if (reasons.length) return { session: null, reasons, ready_at: null };
		if (
			!session ||
			session.in !== p.in ||
			distance(p, session) > config.anchor_tolerance ||
			now - session.checked > config.max_observation_gap
		)
			session = { x: p.x, y: p.y, in: p.in, since: now, checked: now };
		session.checked = now;
		const ready_at = session.since + config.settle_ms;
		if (now < ready_at) reasons.push({ code: "warming", remaining_ms: ready_at - now });
		return { session, reasons, ready_at };
	}
	return { inArea, hasListing, blockers, shellChance, qualify };
};
