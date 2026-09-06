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
const PUBLIC_MAPS = new Set(["main", "winterland", "desertland", "halloween"]);

// Account ID alone determines the flavor. Never use a character ID, realm,
// current date, mutable account fields, or a client-supplied flavor here.
function sliceForAccount(accountId) {
	if (typeof accountId !== "string" || !accountId) return null;
	const hash = createHash("sha256").update(accountId).digest().readUInt32BE(0);
	return SLICES[hash % SLICES.length];
}

function monsterRewards(accountId, monster, share = 1, random = Math.random) {
	const slice = sliceForAccount(accountId);
	if (
		!slice ||
		!monster ||
		monster.pet ||
		monster.trap ||
		monster.summoned ||
		monster.npc ||
		monster["1hp"] ||
		monster.max_hp <= 1 ||
		monster.difficulty === 0 ||
		!(monster.xp > 0) ||
		!Number.isFinite(share) ||
		share <= 0
	)
		return [];
	const credit = Math.min(1, share),
		result = [];
	if (random() < credit / 5000) result.push(slice);
	if (random() < credit / 1500) result.push("anniversarygift");
	return result;
}

function createEvent({
	now = Date.now,
	random = Math.random,
	players,
	active,
	reachable,
	realm,
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
	function eligible(p) {
		return !!(
			online(p) &&
			!p.rip &&
			!p.dead &&
			p.hp > 0 &&
			!p.afk &&
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
	function select() {
		let candidates = players().filter(eligible);
		if (candidates.some((p) => p.id !== previous)) candidates = candidates.filter((p) => p.id !== previous);
		const weight = (p) => (Number.isFinite(p.age) && p.age <= 30 && p.level <= 40 ? 4 : 1);
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
							hosts: new Set(),
						}
					: null;
		}
		if (round && time >= round.expires) round = null;
		if (round && !eligible(round.target)) {
			if (round.target) previous = round.target.id;
			round.target = select();
			if (round.target) {
				previous = round.target.id;
				if (!round.started) {
					round.started = true;
					round.expires = time + WINDOW;
					// One ticket for every other character online at selection, not on later ticks.
					for (const p of players()) {
						if (!online(p) || p.id === round.target.id) continue;
						clearTicket(p);
						addCondition(p, "anniversary_visit", { duration: WINDOW });
						Object.assign(p.s.anniversary_visit, { round: round.id, realm, expires: round.expires });
						resend(p, "u+cid");
					}
				}
				clearTicket(round.target);
			}
		}
		for (const p of players()) {
			if (p.s && p.s.anniversary_visit && !canVisit(p)) clearTicket(p);
			else if (p.s && p.s.anniversary_visit)
				p.s.anniversary_visit.ms = Math.min(p.s.anniversary_visit.ms, round.expires - time);
		}
		const target = round && round.target;
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
						map: target.map,
						x: Math.round(target.x),
						y: Math.round(target.y),
					}
				: {}),
		};
	}
	function isTarget(target) {
		return !!(active() && round && now() < round.expires && round.target === target && eligible(target));
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
		const slice = sliceForAccount(visitor.owner);
		if (!slice || round.claims.has(visitor.id)) return false;
		// Synchronous delivery, reserved before any inventory side effects.
		round.claims.add(visitor.id);
		clearTicket(visitor);
		deliver(visitor, [slice, "anniversarygift"]);
		if (!round.hosts.has(target.id)) {
			round.hosts.add(target.id);
			deliver(target, ["anniversarygift"]);
		}
		return true;
	}
	return { tick, isTarget, canVisit, claim };
}

// Resolve a trusted recipe against inventory without accepting client slot or
// quantity claims. Plan the whole operation before consuming anything.
function planCraft(player, recipe) {
	if (
		!recipe ||
		!Number.isFinite(recipe.cost) ||
		recipe.cost < 0 ||
		!Array.isArray(recipe.items) ||
		recipe.items.length > 9
	)
		return { error: "craft_cant" };
	if (!(player.gold >= recipe.cost)) return { error: "gold_not_enough" };
	const take = new Map();
	for (const [quantity, name, level] of recipe.items) {
		if (!Number.isSafeInteger(quantity) || quantity <= 0) return { error: "craft_cant" };
		let left = quantity;
		for (let index = 0; index < player.items.length && left; index++) {
			const item = player.items[index];
			if (
				!item ||
				item.name !== name ||
				item.l ||
				item.b ||
				item.giveaway ||
				(level !== undefined && (item.level || 0) !== level)
			)
				continue;
			const available = (item.q || 1) - (take.get(index) || 0);
			const count = Math.min(left, Math.max(0, available));
			if (count) {
				take.set(index, (take.get(index) || 0) + count);
				left -= count;
			}
		}
		if (left) return { error: "craft_cant_quantity" };
	}
	return { cost: recipe.cost, take: [...take] };
}

module.exports = { SLICES, INTERVAL, WINDOW, sliceForAccount, monsterRewards, createEvent, planCraft };
