"use strict";

// The published event lineup: seven days of named occurrences on the realm clock. The lineup and
// the rotation queues live in the server's saved data, so a restart neither reshuffles what players
// were shown nor starts an occurrence twice. Times are UTC milliseconds; the client shows them in
// the player's time or on the realm clock.

const HOUR = 3600000;
const DAY = 24 * HOUR;
const VERSION = 1;

// Late starts are allowed inside the slot's hour (a restart at 13:20 still runs the 13:00 event),
// never later; a short repeating event allows less. Finished and missed ones stay visible a while.
const LATE = HOUR;
const KEEP = 6 * HOUR;

// hours/minute are on the realm clock. pool: a rotation queue; event: a fixed event.
// season: only while that season runs (and before its end). repeat: frequent, shown as one line.
// A pool skips an event while that event's own seasonal slot is open.
const SLOTS = [
	{ hours: [13, 20], pool: "dailies" },
	{ hours: [23], pool: "nightlies" },
	// During Halloween: two rounds twelve hours apart, so other time zones can play; one daily limit covers both.
	// The rest of the year the Witch's Cipher is one of the dailies.
	{ hours: [6, 18], event: "witchcipher", season: "halloween" },
	{ hours: [0], event: "horseman", season: "halloween" },
	{
		hours: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
		minute: 30,
		event: "graveyard",
		season: "halloween",
		repeat: true,
		late: 10 * 60000,
	},
];

function create_schedule({ saved, offset, pools, realm, season_open, now = Date.now, days = 7, slots = SLOTS }) {
	let state = saved;
	function fresh() {
		const queues = {};
		for (const name in pools) queues[name] = pools[name].slice();
		return { version: VERSION, offset, queues, until: null, occurrences: [] };
	}
	if (!state || state.version !== VERSION || state.offset !== offset || !Array.isArray(state.occurrences))
		state = fresh();
	// The lineup is saved before an occurrence starts. One still marked as starting was cut off by a
	// restart before its own state was saved, so it counts as missed rather than running twice.
	for (const o of state.occurrences)
		if (o.starting) {
			delete o.starting;
			o.status = "missed";
			o.ended = o.started || o.at;
		}
	// Builds what lies ahead again; what already started stays. Its rotation picks go back to the front
	// of their queues, latest first, so the rotations continue as published.
	function rebuild_ahead(t) {
		if (state.until === null) return;
		const ahead = state.occurrences.filter((o) => o.status === "scheduled" && o.at > t).sort((a, b) => b.at - a.at);
		for (const o of ahead) {
			const pool = o.pool || Object.keys(state.queues).find((name) => state.queues[name].includes(o.event));
			const queue = state.queues[pool];
			if (!queue || !queue.includes(o.event)) continue;
			queue.splice(queue.lastIndexOf(o.event), 1);
			queue.unshift(o.event);
		}
		state.occurrences = state.occurrences.filter((o) => !ahead.includes(o));
		state.until = t;
	}
	// The seasons the lineup was built with. When one opens or closes, the days ahead follow it.
	const seasons = slots.map((slot) => slot.season).filter((season, i, all) => season && all.indexOf(season) === i);
	function open_seasons(t) {
		return seasons.filter((season) => season_open(season, t)).join(",");
	}
	// The slots changed since this lineup was saved: an added or removed slot applies at once.
	const shape = JSON.stringify(slots);
	if (state.slots !== shape) rebuild_ahead(now());
	state.slots = shape;
	// Keep the saved order for known events, add new pool members at the end and drop removed ones.
	for (const name in pools) {
		const kept = (state.queues[name] || []).filter((event) => pools[name].includes(event));
		state.queues[name] = kept.concat(pools[name].filter((event) => !kept.includes(event)));
	}

	function realm_day_start(at) {
		const shifted = at + offset * HOUR;
		return shifted - (((shifted % DAY) + DAY) % DAY) - offset * HOUR;
	}
	function slot_id(event, at) {
		const d = new Date(at + offset * HOUR);
		const pad = (n) => String(n).padStart(2, "0");
		return (
			realm +
			"-" +
			d.getUTCFullYear() +
			"-" +
			pad(d.getUTCMonth() + 1) +
			"-" +
			pad(d.getUTCDate()) +
			"-" +
			pad(d.getUTCHours()) +
			pad(d.getUTCMinutes()) +
			"-" +
			event
		);
	}
	// Every slot start in (from, to], in time order.
	function starts_between(from, to) {
		const list = [];
		for (let day = realm_day_start(from); day <= to; day += DAY)
			for (const slot of slots)
				for (const hour of slot.hours) {
					const at = day + hour * HOUR + (slot.minute || 0) * 60000;
					if (at > from && at <= to) list.push({ at, slot });
				}
		return list.sort((a, b) => a.at - b.at);
	}
	function hour_of(at) {
		return new Date(at + offset * HOUR).getUTCHours();
	}
	// The realm hour of an event's latest occurrence before at, if any
	function last_hour(event, at) {
		let latest = null;
		for (const o of state.occurrences) if (o.event === event && o.at < at && (!latest || o.at > latest.at)) latest = o;
		return latest ? hour_of(latest.at) : null;
	}
	function extend(t) {
		const horizon = t + days * DAY;
		// A new lineup starts with the slot in progress, so a restart inside a slot hour still runs it.
		const from = state.until === null ? t - LATE : state.until;
		for (const { at, slot } of starts_between(from, horizon)) {
			if (slot.season && !season_open(slot.season, at)) continue;
			let event = slot.event;
			if (slot.pool) {
				const queue = state.queues[slot.pool] || [];
				const own = slots.filter((s) => s.event && s.season && season_open(s.season, at)).map((s) => s.event);
				const eligible = (from) => queue.findIndex((name, i) => i >= from && !own.includes(name));
				let pick = eligible(0);
				if (pick < 0) continue;
				// An event that ran at this hour last time trades places with the next in line when that one
				// ran at another hour, so an even pool still moves every event between the slot hours.
				const next = eligible(pick + 1);
				if (next >= 0 && last_hour(queue[pick], at) === hour_of(at) && last_hour(queue[next], at) !== hour_of(at))
					pick = next;
				event = queue.splice(pick, 1)[0];
				queue.push(event);
			}
			const occurrence = { id: slot_id(event, at), event, at, status: "scheduled" };
			if (slot.pool) occurrence.pool = slot.pool;
			if (slot.season) occurrence.season = slot.season;
			if (slot.repeat) occurrence.repeat = true;
			if (slot.late) occurrence.late = slot.late;
			state.occurrences.push(occurrence);
		}
		state.until = Math.max(from, horizon);
	}
	function prune(t) {
		state.occurrences = state.occurrences.filter((o) => {
			// A season that closed takes its future occurrences with it.
			if (o.season && o.status === "scheduled" && !season_open(o.season, o.at)) return false;
			if (o.status === "scheduled" || o.status === "live") return true;
			return t - (o.ended || o.at) < KEEP;
		});
	}

	return {
		state: () => state,
		// Occurrences that should start now. The caller starts each one; it is marked live first.
		tick(t = now(), { can_start = true } = {}) {
			const open = open_seasons(t);
			if (state.seasons !== open) rebuild_ahead(t);
			state.seasons = open;
			extend(t);
			prune(t);
			const due = [];
			for (const o of state.occurrences) {
				if (o.status !== "scheduled" || o.at > t) continue;
				if (t - o.at >= (o.late || LATE)) {
					o.status = "missed";
					o.ended = o.at + (o.late || LATE);
				} else if (can_start) {
					o.status = "live";
					o.started = t;
					due.push(o);
				}
			}
			prune(t);
			return due;
		},
		// The live occurrence of an event has ended (finished, defeated or interrupted).
		finish(event, t = now(), outcome = "done") {
			for (const o of state.occurrences)
				if (o.event === event && o.status === "live") {
					o.status = outcome;
					o.ended = t;
				}
		},
		next(event, t = now()) {
			return state.occurrences.find((o) => o.event === event && o.at > t && o.status === "scheduled") || null;
		},
		// The public lineup for server.status.schedule: dated occurrences, plus one line per repeat.
		publish(t = now()) {
			const events = [],
				repeats = {};
			for (const o of state.occurrences) {
				const entry = { id: o.id, event: o.event, at: o.at, status: o.status };
				if (o.season) entry.season = o.season;
				if (o.started) entry.started = o.started;
				if (o.ended) entry.ended = o.ended;
				if (!o.repeat) events.push(entry);
				else if (
					o.status === "live" ||
					(o.status === "scheduled" && (!repeats[o.event] || repeats[o.event].status !== "live"))
				) {
					if (!repeats[o.event] || o.status === "live" || o.at < repeats[o.event].at) repeats[o.event] = entry;
				}
			}
			const every = {};
			for (const slot of slots) if (slot.repeat) every[slot.event] = DAY / slot.hours.length;
			return {
				realm,
				server_time: t,
				events: events.sort((a, b) => a.at - b.at),
				repeats: Object.values(repeats).map((entry) => Object.assign(entry, { every: every[entry.event] })),
			};
		},
	};
}

module.exports = { create_schedule, SLOTS, HOUR, DAY };
