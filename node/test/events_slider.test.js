// The slider above chat (js/event_schedule.js): what it shows, that it moves by whole pixels in animation
// frames, pauses under the mouse, stops for X,Y's coordinates and rests with reduced motion.
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { read, extract } = require("./helpers/server_vm");

const NOW = Date.parse("2026-10-18T12:00:00Z");

function setup({ reduced = false, schedule } = {}) {
	const frames = [];
	const media = {
		matches: reduced,
		listeners: [],
		addEventListener(type, f) {
			this.listeners.push(f);
		},
	};
	const track = {
		style: {},
		writes: 0,
		html: "",
		set innerHTML(value) {
			this.html = value;
			this.writes++;
		},
		get innerHTML() {
			return this.html;
		},
		firstChild: { offsetWidth: 300 },
		parentNode: { clientWidth: 160 },
	};
	const bar = {
		classes: new Set(),
		toggleClass(name, on) {
			on ? this.classes.add(name) : this.classes.delete(name);
			return this;
		},
	};
	const c = vm.createContext({
		Intl,
		no_html: false,
		character: { name: "Witchling" },
		document: { getElementById: (id) => (id == "events-ticker-track" ? track : null) },
		requestAnimationFrame: (f) => frames.push(f),
		matchMedia: () => media,
		$: (selector) => {
			assert.equal(selector, "#events-bar");
			return bar;
		},
	});
	vm.runInContext(read("js/phrases.js"), c);
	c.phrase.load("en", require("../../languages/en/interface.js"));
	vm.runInContext(extract(read("common/js/common_functions.js"), "html_escape"), c);
	vm.runInContext(read("design/events.js"), c);
	c.G = { events: c.events };
	c.S = {
		halloween: true,
		event_ends: { halloween: Date.parse("2026-11-03T00:00:00Z") },
		schedule: {
			server_time: NOW,
			events: schedule || [
				{ id: "a", event: "goobrawl", status: "live", at: NOW - 60000 },
				{ id: "b", event: "crabxx", status: "scheduled", at: NOW + 2 * 3600000 },
				{ id: "c", event: "crabxx", status: "scheduled", at: NOW + 26 * 3600000 },
				{ id: "d", event: "franky", status: "scheduled", at: NOW + 5 * 3600000 },
				{ id: "e", event: "icegolem", status: "scheduled", at: NOW + 7 * 3600000 },
				{ id: "f", event: "abtesting", status: "scheduled", at: NOW + 9 * 3600000 },
			],
			repeats: [{ event: "graveyard", status: "scheduled", at: NOW + 25 * 60000 }],
		},
	};
	vm.runInContext(read("js/event_schedule.js"), c);
	c.schedule_now = () => NOW;
	return { c, frames, media, track, bar };
}

// Runs queued animation frames at the given times (ms)
function run(frames, times) {
	for (const t of times) {
		const queued = frames.splice(0);
		queued.forEach((f) => f(t));
	}
}

test("the slider lists live events, the next three events and season ends, escaped and in order", () => {
	const { c, track } = setup();
	// Realm time on a UTC-5 realm, so the season's end is shown at 19:00 the day before UTC midnight
	c.events_time_mode = "realm";
	c.S.schedule.time_offset = -5;
	c.events_ticker_update();
	const text = track.html.replace(/<[^>]+>/g, "");
	const order = [
		"Goo Brawl is live",
		"Graveyard Rising · in 25m",
		"Giga Crab · in 2h 0m",
		"Franky · in 5h 0m",
		"Halloween ends November 2 at 19:00",
	].map((s) => text.indexOf(s));
	assert.ok(
		order.every((at, i) => at >= 0 && (i == 0 || at > order[i - 1])),
		text,
	);
	assert.ok(!text.includes("Ice Golem"), "only the next three upcoming events");
	assert.equal(text.split("Giga Crab").length, 3, "one Giga Crab item per copy, the later occurrence is skipped");
	assert.match(track.html, /<span style='color:#E8C878'>.*Graveyard Rising/, "within the hour in gold");
	assert.match(
		track.html,
		/<span style='color:#AAAAAA'><span style='color:#F18B64'>Giga Crab/,
		"later events in gray, the name in its own colour",
	);
	assert.equal(
		(track.html.match(/class='ticker-item'/g) || []).length,
		2 * 5,
		"each item isolated, two copies to fill the box",
	);
	const writes = track.writes;
	c.events_ticker_update();
	assert.equal(track.writes, writes, "unchanged items do not touch the DOM");
});

test("event names are escaped", () => {
	const { c, track } = setup({ schedule: [{ id: "x", event: "goobrawl", status: "live", at: NOW }] });
	c.G.events.goobrawl.name = "Goo <b>Brawl</b> & co";
	c.events_ticker_update();
	assert.ok(track.html.includes("Goo &lt;b&gt;Brawl&lt;/b&gt; &amp; co"));
	assert.ok(!track.html.includes("<b>Brawl"));
});

test("it moves 40 pixels a second in whole pixels, pauses under the mouse and wraps", () => {
	const { c, frames, track } = setup();
	c.events_ticker_update();
	assert.equal(frames.length, 1, "one animation frame loop");
	const second = (from) => Array.from({ length: 41 }, (_, i) => from + i * 25);
	run(frames, second(1000));
	assert.equal(track.style.transform, "translate3d(-40px,0,0)");
	run(frames, [2010, 2020, 2030]);
	assert.equal(track.style.transform, "translate3d(-41px,0,0)", "whole pixels only");
	c.events_ticker.hover = true;
	run(frames, second(2100));
	assert.equal(track.style.transform, "translate3d(-41px,0,0)", "paused under the mouse");
	c.events_ticker.hover = false;
	for (let s = 3200; s < 11200; s += 1001) run(frames, second(s));
	assert.ok(c.events_ticker.offset < 300, "wraps at the width of one copy");
	assert.match(track.style.transform, /^translate3d\(-\d+px,0,0\)$/);
	assert.equal(frames.length, 1, "still a single loop");
	const before = c.events_ticker.offset;
	run(frames, [60000]);
	assert.ok((c.events_ticker.offset - before + 300) % 300 <= 4, "a long pause (hidden tab) moves at most 4 pixels");
});

test("right-to-left text slides the other way", () => {
	const { c, frames, track } = setup();
	c.getComputedStyle = () => ({ direction: "rtl" });
	c.events_ticker_update();
	assert.equal(c.events_ticker.rtl, true);
	run(frames, [1000, 1050, 1100]);
	assert.equal(track.style.transform, "translate3d(4px,0,0)");
});

test("X,Y stops the slider and shows the coordinates; pressing it again restarts it", () => {
	const { c, frames, bar } = setup();
	c.events_ticker_update();
	c.events_toggle_coords();
	assert.ok(bar.classes.has("coords-on"));
	run(frames, [1000]);
	assert.equal(frames.length, 0, "no frames while the coordinates show");
	c.events_toggle_coords();
	assert.ok(!bar.classes.has("coords-on"));
	assert.equal(frames.length, 1, "restarted");
});

test("reduced motion rests the text at its start, also when switched on while it slides", () => {
	const still = setup({ reduced: true });
	still.c.events_ticker_update();
	run(still.frames, [1000]);
	assert.equal(still.frames.length, 0, "no loop with reduced motion");
	assert.equal(still.track.style.transform, "translate3d(0px,0,0)", "the text rests at its start");
	const { c, frames, media, track } = setup();
	c.events_ticker_update();
	run(frames, [1000, 1050, 1100]);
	assert.equal(track.style.transform, "translate3d(-4px,0,0)");
	media.matches = true;
	run(frames, [2100]);
	assert.equal(frames.length, 0, "the loop stops");
	assert.equal(track.style.transform, "translate3d(0px,0,0)");
	media.matches = false;
	media.listeners.forEach((f) => f());
	assert.equal(frames.length, 1, "it slides again when reduced motion is turned off");
});

test("an old schedule packet read again when a window opens does not move the clock back", () => {
	const { c } = setup();
	vm.runInContext("var __now = 1000; Date.now = function () { return __now; };", c);
	vm.runInContext("schedule_now = function () { return Date.now() + schedule_offset; };", c);
	c.S.schedule.server_time = 5000;
	c.schedule_sync();
	assert.equal(c.schedule_now(), 5000);
	vm.runInContext("__now = 301000;", c);
	c.schedule_sync(); // the Events window opening five minutes later, with no new packet
	assert.equal(c.schedule_now(), 305000);
	c.S.schedule.server_time = 306000; // a fresh packet syncs again
	c.schedule_sync();
	assert.equal(c.schedule_now(), 306000);
});

test("reminder cleanup forgets only this realm's old reminders, at most once a minute", () => {
	const { c } = setup();
	const store = new Map([
		["event_reminder:USII:gone", "1"],
		["event_reminder:USII:b", "1"],
		["event_reminder:EUI:gone", "1"],
		["unrelated", "1"],
	]);
	c.localStorage = {
		get length() {
			return store.size;
		},
		key: (i) => [...store.keys()][i],
		getItem: (k) => (store.has(k) ? store.get(k) : null),
		setItem: (k, v) => store.set(k, v),
		removeItem: (k) => store.delete(k),
	};
	c.S.schedule.realm = "USII";
	c.events_reminder_tick();
	assert.deepEqual([...store.keys()].sort(), ["event_reminder:EUI:gone", "event_reminder:USII:b", "unrelated"]);
	store.set("event_reminder:USII:gone", "1");
	c.events_reminder_tick();
	assert(store.has("event_reminder:USII:gone"), "not again within the minute");
});
