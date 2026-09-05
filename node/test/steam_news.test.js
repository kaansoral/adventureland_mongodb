"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { create_news_loader, render_contents } = require("../../steam_news");

function response(overrides = {}) {
	return {
		ok: true,
		json: async () => ({
			appnews: {
				newsitems: [
					{
						appid: 777150,
						feedname: "steam_community_announcements",
						title: "A new adventure",
						contents: '[p]Welcome! [b]New items[/b][/p][img src="{STEAM_CLAN_IMAGE}/34225379/image.png"][/img]',
						date: 1788140767,
						url: "https://store.steampowered.com/news/app/777150",
						...overrides,
					},
				],
			},
		}),
	};
}

test("Steam post formatting escapes HTML and rejects executable links and foreign images", () => {
	const html = render_contents(
		'[h2]News[/h2][p]<script>alert(1)</script>[b]Items[/b] [url="https://adventure.land/?a=1&b=2"]Guide[/url][/p][img src="{STEAM_CLAN_IMAGE}/34225379/image.png"][/img][img]https://example.com/tracker.png[/img][url=javascript:alert(1)]bad[/url][img src="https://clan.akamai.steamstatic.com/a.png\" onerror=\"alert(1)"][/img]',
	);
	assert.match(html, /<h2>News<\/h2>/);
	assert.match(html, /&lt;script&gt;/);
	assert.match(html, /<strong>Items<\/strong>/);
	assert.match(html, /href="https:\/\/adventure.land\/\?a=1&amp;b=2"/);
	assert.match(html, /https:\/\/clan.akamai.steamstatic.com\/images\/34225379\/image.png/);
	assert.doesNotMatch(html, /<script|href="javascript:|tracker.png| onerror=/);
	assert.equal(render_contents("[list][*]One[*]Two[/list]"), "<ul><li>One</li><li>Two</li></ul>");
});

test("simultaneous news readers share a fetch; cache refreshes and retains the last post during outages", async () => {
	let calls = 0,
		now = 1,
		offline = false;
	const load = create_news_loader(
		async () => {
			calls++;
			if (offline) throw new Error("offline");
			return response();
		},
		() => now,
	);
	const posts = await Promise.all([load(), load(), load()]);
	assert.equal(calls, 1);
	assert.deepEqual(posts[0], posts[1]);
	await load();
	assert.equal(calls, 1);
	now += 600001;
	offline = true;
	assert.deepEqual(await load(), posts[0]);
	assert.equal(calls, 2);
	await load();
	assert.equal(calls, 2);
	now += 60001;
	offline = false;
	await load();
	assert.equal(calls, 3);
});

test("a cold failed feed backs off and recovers, and unrelated or invalid posts are rejected", async () => {
	let now = 1,
		calls = 0;
	const load = create_news_loader(
		() => {
			if (++calls === 1) throw new Error("offline");
			return Promise.resolve(response());
		},
		() => now,
	);
	assert.equal(await load(), null);
	assert.equal(await load(), null);
	assert.equal(calls, 1);
	now += 60001;
	assert.equal((await load()).title, "A new adventure");
	for (const invalid of [
		{ appid: 1 },
		{ feedname: "press" },
		{ contents: "" },
		{ contents: "x".repeat(200001) },
		{ date: null },
	]) {
		assert.equal(await create_news_loader(async () => response(invalid))(), null);
	}
});

function client({ no_graphics = false, no_html = false, reduced = false, hidden = false } = {}) {
	const events = new Map(),
		windowEvents = new Map(),
		timers = new Map();
	let nextTimer = 0,
		confetti = null,
		removed = false,
		requests = 0;
	const button = { addEventListener() {} };
	const banner = {
		hidden: true,
		querySelector: (s) => (s === "button" ? button : confetti),
		appendChild: (node) => {
			confetti = node;
		},
		remove: () => {
			removed = true;
		},
	};
	const context = vm.createContext({
		console,
		no_graphics,
		no_html,
		inside: "selection",
		character: null,
		document: {
			hidden,
			getElementById: () => banner,
			addEventListener: (n, f) => events.set(n, f),
			removeEventListener: (n) => events.delete(n),
			createElement: () => ({
				style: {},
				children: [],
				setAttribute() {},
				appendChild(node) {
					this.children.push(node);
				},
				remove() {
					confetti = null;
				},
			}),
		},
		matchMedia: () => ({ matches: reduced }),
		addEventListener: (n, f) => windowEvents.set(n, f),
		removeEventListener: (n) => windowEvents.delete(n),
		setTimeout: (f) => {
			timers.set(++nextTimer, f);
			return nextTimer;
		},
		clearTimeout: (id) => timers.delete(id),
		$: {
			ajax() {
				requests++;
				throw new Error("Unexpected eager news fetch");
			},
		},
	});
	context.window = context;
	vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../js/pixi/fake/pixi.min.js"), "utf8"), context);
	vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../js/steam_news.js"), "utf8"), context);
	return {
		context,
		events,
		timers,
		windowEvents,
		banner,
		get confetti() {
			return confetti;
		},
		get removed() {
			return removed;
		},
		get requests() {
			return requests;
		},
	};
}

test("news confetti is bounded and game start removes animation, timer and listeners", () => {
	const s = client();
	s.context.SteamNews.init();
	s.context.SteamNews.init();
	assert.equal(s.confetti.children.length, 18);
	assert.equal(s.timers.size, 1);
	assert.equal(s.requests, 0);
	// Run the actual cleanup hook from the socket start handler.
	const source = fs.readFileSync(path.resolve(__dirname, "../../js/game.js"), "utf8");
	const hook = source.match(/socket.on\("start", function \(data\) \{\s*(if \(window.SteamNews\) SteamNews.stop\(\);)/);
	assert.ok(hook);
	vm.runInContext(hook[1], s.context);
	assert.equal(s.confetti, null);
	assert.equal(s.timers.size, 0);
	assert.equal(s.events.size, 0);
	assert.equal(s.windowEvents.size, 0);
	assert.equal(s.removed, true);
	s.context.SteamNews.init();
	s.context.SteamNews.show();
	assert.equal(s.requests, 0);
});

test("confetti stops on timeout or hidden tabs and never starts with reduced motion or no graphics", () => {
	for (const cause of ["timer", "visibility"]) {
		const s = client();
		s.context.SteamNews.init();
		if (cause === "timer") [...s.timers.values()][0]();
		else s.events.get("visibilitychange")();
		assert.equal(s.confetti, null);
		assert.equal(s.timers.size, 0);
		assert.equal(s.events.size, 0);
	}
	for (const options of [{ no_graphics: true }, { reduced: true }, { hidden: true }, { no_html: true }]) {
		const s = client(options);
		s.context.SteamNews.init();
		assert.equal(s.confetti, null);
		assert.equal(s.timers.size, 0);
		assert.equal(s.requests, 0);
		assert.equal(s.banner.hidden, Boolean(options.no_html));
	}
});
