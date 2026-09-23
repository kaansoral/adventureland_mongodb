"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { localize } = require("./helpers/server_vm");
const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "js/html.js"), "utf8");
const source = html.slice(html.indexOf("function open_event_announcement("), html.indexOf("function render_server("));

function setup(extra = {}) {
	const banner = {
		values: {},
		writes: 0,
		visible: false,
		content: "",
		data(key, value) {
			if (arguments.length == 1) return this.values[key];
			this.values[key] = value;
			return this;
		},
		html(value) {
			this.content = value;
			this.writes++;
			return this;
		},
		show() {
			this.visible = true;
		},
		hide() {
			this.visible = false;
		},
	};
	const opened = [],
		visuals = [];
	const context = vm.createContext({
		no_html: false,
		no_graphics: false,
		character: null,
		socket: { connected: true },
		S: {},
		$: (selector) => {
			assert.equal(selector, "#event-announcements");
			return banner;
		},
		html_escape: (value) =>
			String(value)
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;")
				.replaceAll("'", "&#39;"),
		sprite: (...args) => {
			visuals.push(args);
			return '<span class="sprite"></span>';
		},
		item_container: (...args) => {
			visuals.push(args);
			return '<span class="item"></span>';
		},
		open_guide: (...args) => opened.push(args),
		render_anniversary_event: () => opened.push(["anniversary-window"]),
		pcs() {},
		event: {},
		...extra,
	});
	localize(context);
	vm.runInContext(fs.readFileSync(path.join(root, "design/events.js"), "utf8"), context);
	context.G = { events: context.events, items: {}, monsters: { rgoo: { size: 1.5 }, crabxx: { size: 1.5 } } };
	vm.runInContext(source, context);
	return { context, banner, opened, visuals };
}

test("announced events have colors and a pixel effect; every event has an existing modal", () => {
	const { context } = setup();
	assert.equal(context.G.events.dreams.announcement, false, "Dorr's guide stays proximity-based");
	const effects = new Set(["confetti", "sparks", "bubbles", "splash", "snow", "fireworks", "hearts", "embers"]);
	for (const event of Object.values(context.G.events)) {
		assert(fs.existsSync(path.join(root, "docs/guide", event.modal + ".html")), event.modal);
		if (event.announcement === false) continue;
		assert.match(event.announcement.color, /^#[\dA-F]{6}$/);
		assert.match(event.announcement.accent, /^#[\dA-F]{6}$/);
		assert(effects.has(event.announcement.effect));
		assert(event.announcement.text.length > 0);
	}
});

test("cards use only connected server state, including seasonal waiting rounds", () => {
	const { context, banner } = setup();
	context.anniversary = context.halloween = true;
	context.render_event_announcements();
	assert.equal(banner.visible, false, "page flags cannot enable an event");
	context.S = {
		anniversary: { active: true, live: false },
		goobrawl: { live: true },
		franky: { live: false },
		halloween: false,
		holidayseason: { active: false },
	};
	context.render_event_announcements();
	assert.equal(banner.visible, true);
	assert.equal((banner.content.match(/class='gamebutton event-announcement'/g) || []).length, 2);
	assert.match(banner.content, /10 Years of Adventure/);
	assert.match(banner.content, /Goo Brawl/);
	assert.doesNotMatch(banner.content, /Franky|Halloween|Holiday Season/);
	context.S = { icegolem: true };
	context.render_event_announcements();
	assert.match(banner.content, /Ice Golem/);
	assert.doesNotMatch(banner.content, /Goo Brawl|10 Years/);
	context.socket.connected = false;
	context.render_event_announcements();
	assert.equal(banner.visible, false);
	assert.equal(banner.content, "");
});

test("live updates do not restart animations unless the visible event list changes", () => {
	const { context, banner } = setup();
	context.S = { anniversary: { active: true, live: true, x: 1, y: 2 } };
	context.render_event_announcements();
	const writes = banner.writes;
	context.S.anniversary.x = 3;
	context.render_event_announcements();
	assert.equal(banner.writes, writes);
	context.G.events.anniversary.announcement.text = "New event details";
	context.render_event_announcements();
	assert.equal(banner.writes, writes + 1);
});

test("at most two cards are shown, with seasonal events before daily and nightly events", () => {
	const { context, banner } = setup();
	const cards = () => [...banner.content.matchAll(/open_event_announcement\("([^"]+)"\)/g)].map((match) => match[1]);
	context.S = { goobrawl: true, franky: true, icegolem: true, halloween: true };
	context.render_event_announcements();
	assert.deepEqual(cards(), ["halloween", "goobrawl"]);
	context.S.holidayseason = true;
	context.render_event_announcements();
	assert.deepEqual(cards(), ["holidayseason", "halloween"]);
	context.S.anniversary = { active: true, live: false };
	context.render_event_announcements();
	assert.deepEqual(cards(), ["anniversary", "holidayseason"]);
	const writes = banner.writes;
	context.S.franky = false;
	context.render_event_announcements();
	assert.equal(banner.writes, writes, "hidden events cannot restart the visible cards");
	context.S.anniversary.active = false;
	context.S.holidayseason = false;
	context.S.halloween = false;
	context.render_event_announcements();
	assert.deepEqual(cards(), ["goobrawl", "icegolem"], "vacated slots show the next active events");
});

test("cards are menu-only, including game loading and returning to the menu", () => {
	const { context, banner, visuals } = setup();
	context.S = { anniversary: { active: true } };
	context.inside = "selection";
	context.render_event_announcements();
	assert.equal(banner.visible, true);
	const rendered = visuals.length;
	context.inside = "game";
	context.render_event_announcements();
	assert.equal(banner.visible, false);
	assert.equal(banner.content, "");
	assert.equal(visuals.length, rendered, "no sprites or effects built while entering the game");
	context.character = { name: "Visitor" };
	context.render_event_announcements();
	assert.equal(banner.visible, false);
	context.inside = "selection";
	context.render_event_announcements();
	assert.equal(banner.visible, false, "an active character never sees menu banners");
	context.character = null;
	context.render_event_announcements();
	assert.equal(banner.visible, true);
});

test("each card opens its own guide, with the anniversary window only after character selection", () => {
	const { context, banner, opened } = setup();
	for (const key of Object.keys(context.G.events)) {
		context.S = { [key]: true };
		context.render_event_announcements();
		const handlers = [...banner.content.matchAll(/onclick='([^']+)'/g)];
		if (context.G.events[key].announcement === false) {
			assert.equal(handlers.length, 0);
			continue;
		}
		assert.equal(handlers.length, 1);
		vm.runInContext(handlers[0][1], context);
	}
	assert.deepEqual(
		opened,
		Object.values(context.G.events)
			.filter((event) => event.announcement)
			.map((event) => [event.modal, "/docs/ref/" + event.modal]),
	);
	context.character = { name: "Visitor" };
	context.open_event_announcement("anniversary");
	assert.deepEqual(opened.at(-1), ["anniversary-window"]);
	context.open_event_announcement("missing");
	assert.equal(opened.length, Object.values(context.G.events).filter((event) => event.announcement).length + 1);
});

test("no-HTML returns before DOM work; no-graphics retains text without sprites or effects", () => {
	const headless = setup({
		no_html: true,
		$() {
			throw new Error("No HTML means no DOM access");
		},
	});
	headless.context.S = { anniversary: true };
	headless.context.render_event_announcements();
	headless.context.open_event_announcement("anniversary");
	assert.equal(headless.opened.length, 0);
	const { context, banner, visuals } = setup({ no_graphics: true });
	vm.runInContext(fs.readFileSync(path.join(root, "js/pixi/fake/pixi.min.js"), "utf8"), context);
	context.S = { anniversary: true };
	context.render_event_announcements();
	assert.equal(visuals.length, 0);
	assert.equal(context.PIXI._no_graphics_warning_shown, undefined);
	assert.match(banner.content, /10 Years/);
	assert.doesNotMatch(banner.content, /event-announcement-effects/);
});

test("effects are bounded, stepped, and respect reduced motion", () => {
	const { context, banner } = setup();
	context.S = { halloween: true };
	context.render_event_announcements();
	assert.equal((banner.content.match(/<i style=/g) || []).length, 12);
	const css = fs.readFileSync(path.join(root, "css/index.css"), "utf8");
	assert.match(css, /event-pixel-fall 3\.6s steps\(16,end\) 4/);
	assert.match(css, /prefers-reduced-motion:reduce/);
	assert(!source.includes("PIXI"));
});

test("sprites use the INFO renderer's normal size and can overflow above their cards", () => {
	const { context, visuals } = setup();
	context.S = { franky: true };
	context.render_event_announcements();
	assert.equal(visuals[0][0], "franky");
	assert.equal(visuals[0][1].scale, undefined, "do not shrink sprites below the INFO renderer's scale");
	assert.equal(visuals[0][1].overflow, true);
	const css = fs.readFileSync(path.join(root, "css/index.css"), "utf8");
	assert.match(css, /#event-announcements\{[^}]*overflow:visible/);
	assert.match(css, /\.event-announcement\{[^}]*overflow:visible/);
	assert.match(css, /\.event-announcement-effects\{[^}]*overflow:hidden/, "particles stay inside their own card");
});

test("compact cards put the Steam-style left chevron before the sprite", () => {
	const { context, banner } = setup();
	context.S = { anniversary: true };
	context.render_event_announcements();
	assert.match(banner.content, /event-announcement-arrow' aria-hidden='true'>&lt;<\/span>/);
	assert(banner.content.indexOf("event-announcement-arrow") < banner.content.indexOf("event-announcement-sprite"));
	assert.equal((banner.content.match(/event-announcement-arrow/g) || []).length, 1);
	const css = fs.readFileSync(path.join(root, "css/index.css"), "utf8");
	assert.match(css, /min-height:76px/);
	assert.match(
		css,
		/#event-announcements \.event-announcement,\s*\.upcoming-cards \.event-announcement\{[^}]*display:flex/,
		"card layout must outrank the later generic gamebutton rule",
	);
	assert.match(
		css,
		/\.event-announcement-copy\{[^}]*min-width:0;[^}]*overflow-wrap:anywhere/,
		"long translated text must wrap within its flex column",
	);
	assert.match(css, /\.event-announcement-arrow\{[^}]*color:#69d6cf;font-size:40px;line-height:26px/);
});

test("upcoming cards have no actions and skip all graphics in headless mode", () => {
	const { context, visuals } = setup();
	const design = require("./helpers/design");
	context.G.items = design.items;
	let html = "";
	context.$ = (selector) => {
		assert.equal(selector, "#features .upcoming-cards");
		return {
			length: 1,
			html: (value) => {
				html = value;
			},
		};
	};
	context.render_upcoming_content();
	assert.equal((html.match(/<article /g) || []).length, 4);
	assert.match(html, /Daily Adventures/);
	assert.match(html, /The Black Wake/);
	assert.match(html, /Werdars&#39; Level Awards/);
	assert.match(html, /New Rare Drops/);
	assert.match(html, /Sucker Punch/);
	const skins = ["teaser_witch", "teaser_blackwake", "teaser_werdars", "teaser_rare"];
	assert.deepEqual(
		visuals.map(([item]) => item.skin),
		skins,
	);
	const sheet = design.imagesets.teasers;
	const png = fs.readFileSync(path.join(root, sheet.file.split("?")[0]));
	assert.equal(png.readUInt32BE(16), sheet.columns * sheet.size);
	assert.equal(png.readUInt32BE(20), sheet.rows * sheet.size);
	skins.forEach((skin, column) => {
		assert.deepEqual(Array.from(design.positions[skin]), ["teasers", column, 0]);
		assert.equal(design.items[skin], undefined, "teasers must not add playable items");
	});
	assert.doesNotMatch(html, /onclick=|onmousedown=|<button|<a\s|event-announcement-arrow/);
	context.no_graphics = true;
	context.PIXI = new Proxy(
		{},
		{
			get() {
				throw new Error("Headless cards touched PIXI");
			},
		},
	);
	context.sprite = context.item_container = () => {
		throw new Error("Headless cards requested a sprite");
	};
	context.render_upcoming_content();
	assert.match(html, /New Rare Drops/);
	assert.doesNotMatch(html, /event-announcement-effects|class="sprite"|class="item"/);
	context.no_html = true;
	context.$ = () => {
		throw new Error("No-HTML cards touched the DOM");
	};
	context.render_upcoming_content();
});
