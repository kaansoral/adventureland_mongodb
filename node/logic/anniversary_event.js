"use strict";

const { createHash } = require("node:crypto");

const SLICES = Object.freeze([
	"slice_strawberry",
	"slice_citrus",
	"slice_honey",
	"slice_mint",
	"slice_blueberry",
	"slice_nightberry",
]);
const INTERVAL = 30 * 60 * 1000;
const WINDOW = 5 * 60 * 1000;
const PUBLIC_MAPS = new Set(["main", "winterland", "desertland", "halloween", "hut", "woffice", "d_e"]);

// Account ID alone determines the flavor. Never use a character ID, realm,
// current date, mutable account fields, or a client-supplied flavor here.
function sliceForAccount(accountId) {
	if (typeof accountId !== "string" || !accountId) return null;
	const hash = createHash("sha256").update(accountId).digest().readUInt32BE(0);
	return SLICES[hash % SLICES.length];
}

function createEvent({
	now = Date.now,
	random = Math.random,
	players,
	active,
	reachable,
	realm,
	homeRealm,
	addCondition,
	resend,
	distance,
}) {
	// Do not replay a partially completed round after a process restart.
	let slot = Math.floor(now() / INTERVAL),
		round = null,
		previous = null;
	function online(p) {
		return !!(
			p &&
			p.socket &&
			p.socket.connected !== false &&
			!p.socket.disconnected &&
			!p.dc &&
			!p.disconnected &&
			!p.npc &&
			!p.is_npc
		);
	}
	function rewardBlock(p) {
		if (!p) return "no_visit";
		if (p.s?.realmfatigue) return "realmfatigue";
		if (p.s?.hopsickness) return "hopsickness";
		if (p.type === "merchant" && (!p.p?.home || p.p.home !== homeRealm)) return "merchant_home";
		return null;
	}
	function eligible(p) {
		return !!(
			online(p) &&
			!rewardBlock(p) &&
			!p.rip &&
			!p.dead &&
			p.hp > 0 &&
			!p.stealth &&
			!(p.s && p.s.invis) &&
			p.in === p.map &&
			PUBLIC_MAPS.has(p.map) &&
			reachable(p)
		);
	}
	function clearTicket(p) {
		if (!p.s || !p.s.anniversary_visit) return;
		delete p.s.anniversary_visit;
		resend(p, "u+cid");
	}
	function canVisit(p) {
		const ticket = p && p.s && p.s.anniversary_visit;
		return !!(
			active() &&
			!rewardBlock(p) &&
			round &&
			round.started &&
			ticket &&
			ticket.ms > 0 &&
			ticket.realm === realm &&
			ticket.round === round.id &&
			now() < round.expires &&
			now() < ticket.expires &&
			!round.claims.has(p.id)
		);
	}
	// Private feedback only. Tickets and the claim checks remain the authority.
	function visitStatus(p) {
		if (!active()) return null;
		const live = round && round.started && now() < round.expires;
		let reason = "no_round";
		if (live) {
			const block = rewardBlock(p);
			if (round.claims.has(p.id)) reason = "claimed";
			else if (block) reason = block;
			else if (p.id === round.target.id) reason = "host";
			else reason = canVisit(p) ? "ready" : "no_visit";
		}
		return { realm, round: live ? round.id : null, target: live ? round.target.id : null, reason };
	}
	function select() {
		let candidates = players().filter(eligible);
		if (candidates.some((p) => p.id !== previous)) candidates = candidates.filter((p) => p.id !== previous);
		// Activity affects selection odds, never a chosen player's remaining time.
		const weight = (p) => (Number.isFinite(p.age) && p.age <= 30 && p.level <= 40 ? 4 : 1) * (p.afk ? 1 : 4);
		let roll = random() * candidates.reduce((sum, p) => sum + weight(p), 0);
		for (const p of candidates) {
			roll -= weight(p);
			if (roll < 0) return p;
		}
		return null;
	}
	function tick() {
		const time = now(),
			nextSlot = Math.floor(time / INTERVAL);
		if (!active()) {
			slot = nextSlot;
			round = null;
			players().forEach(clearTicket);
			return null;
		}
		if (nextSlot !== slot) {
			slot = nextSlot;
			round =
				time < slot * INTERVAL + WINDOW
					? {
							id: slot,
							expires: slot * INTERVAL + WINDOW,
							started: false,
							target: null,
							claims: new Set(),
						}
					: null;
		}
		if (round && time >= round.expires) round = null;
		if (round && !round.started) {
			round.target = select();
			if (round.target) {
				previous = round.target.id;
				round.started = true;
				round.expires = time + WINDOW;
				// One ticket for every other eligible character online at selection, not on later ticks.
				for (const p of players()) {
					if (!online(p) || rewardBlock(p) || p.id === round.target.id) continue;
					clearTicket(p);
					addCondition(p, "anniversary_visit", { duration: WINDOW });
					Object.assign(p.s.anniversary_visit, { round: round.id, realm, expires: round.expires });
					resend(p, "u+cid");
				}
				clearTicket(round.target);
			}
		}
		for (const p of players()) {
			if (p.s && p.s.anniversary_visit && !canVisit(p)) clearTicket(p);
			else if (p.s && p.s.anniversary_visit)
				p.s.anniversary_visit.ms = Math.min(p.s.anniversary_visit.ms, round.expires - time);
		}
		const target = currentTarget() || (round && round.target);
		return {
			active: true,
			live: !!target,
			next: (slot + 1) * INTERVAL,
			...(target
				? {
						round: round.id,
						expires: round.expires,
						target: target.name,
						id: target.id,
						available: isTarget(target),
						skin: target.skin,
						cx: JSON.parse(JSON.stringify(target.cx || {})),
						map: target.map,
						x: Math.round(target.x),
						y: Math.round(target.y),
					}
				: {}),
		};
	}
	function currentTarget() {
		if (!round || !round.target) return null;
		// A new socket creates a new player object. Keep this character's place,
		// invitation history and original deadline; never reroll on disconnect.
		const target = players().find((p) => p.id === round.target.id && p.owner === round.target.owner && online(p));
		if (target) round.target = target;
		return target || null;
	}
	function isTarget(target) {
		return !!(active() && round && now() < round.expires && currentTarget() === target && eligible(target));
	}
	function claim(visitor, target, deliver) {
		if (
			!isTarget(target) ||
			!canVisit(visitor) ||
			!online(visitor) ||
			visitor.rip ||
			visitor.dead ||
			!(visitor.hp > 0) ||
			visitor.in !== target.in ||
			visitor.map !== target.map ||
			visitor.id === target.id ||
			distance(visitor, target) > 80
		)
			return false;
		const slice = sliceForAccount(visitor.owner),
			hostSlice = sliceForAccount(target.owner);
		if (!slice || !hostSlice || round.claims.has(visitor.id)) return false;
		// Synchronous delivery, reserved before any inventory side effects.
		round.claims.add(visitor.id);
		addCondition(visitor, "anniversary_kiss");
		clearTicket(visitor);
		deliver(visitor, [slice, "anniversarygift"], "anniversary_kiss");
		deliver(target, [hostSlice, "anniversarygift"]);
		return true;
	}
	return { tick, isTarget, canVisit, visitStatus, claim };
}

module.exports = { SLICES, INTERVAL, WINDOW, sliceForAccount, createEvent };
