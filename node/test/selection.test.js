const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const nunjucks = require("nunjucks");
const { root, read } = require("./helpers/server_vm");
const localization = require("../../languages");

test("the server list accepts scrollbar input while its surrounding menu stays click-through", () => {
	const source = read("htmls/contents/selection.html");
	const menu = source.slice(source.indexOf('<div class="menu disableclicks"'), source.indexOf('<div id="backbutton"'));
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	const servers = ["EU", "US", "ASIA"].flatMap((region) =>
		["I", "II", "III", "PVP"].map((name) => ({
			region,
			name,
			address: region + ".example.invalid",
			path: "/" + name,
			info: { players: 10, pvp: name === "PVP" },
		})),
	);
	const html = env.renderString(menu, { servers, domain: { languages: [], boost: 0 }, user: {}, phrase: (id) => id });
	assert.match(html, /^<div class="menu disableclicks"/);
	assert.match(html, /<div\s+class="enableclicks"\s+style="[^"]*overflow-y:\s*scroll;/);
	assert.equal((html.match(/class="clickable enableclicks selection-server"/g) || []).length, servers.length);
	assert.match(
		html,
		/data-address="ASIA.example.invalid" data-path="\/PVP" onclick="select_login_server\(\{address:this.dataset.address,path:this.dataset.path\},true\)"/,
	);
	assert.match(html, /Eastlands/);
	assert.match(read("css/common.css"), /\.disableclicks\s*\{\s*pointer-events:\s*none;/);
	assert.match(
		read("css/common.css"),
		/\.gamebutton,\.enableclicks,\.slimbutton,\.tinybutton\s*\{\s*pointer-events:\s*auto;/,
	);
});

test("empty slot labels use the same single-line fitting as character classes in every language", () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	vm.runInNewContext(read("filters.js"), { env, nunjucks, localization, to_pretty_num: String });
	for (const { code } of localization.languages) {
		const html = env.render("htmls/contents/selection_characters.html", {
			domain: { language: code },
			user: { info: { slots: 8, auths: [], characters: [] } },
			characters: [],
		});
		const labels = [
			...html.matchAll(/<span class="(?:gray )?selection-slot-label" title="([^"]*)" style="([^"]*)">([^<]*)<\/span>/g),
		];
		assert.equal(labels.length, 36, code);
		for (const [index, label] of labels.entries()) {
			const id = index % 2 ? "unused" : index < 16 ? "free-slot" : "available-slot";
			const expected = nunjucks.lib.escape(localization.phrase("pages.contents.selection_characters." + id, {}, code));
			assert.equal(label[1], expected, code);
			assert.equal(label[3], expected, code);
			assert.match(label[2], /display:block; overflow:hidden; white-space:nowrap/, code);
		}
	}
});

test("selection labels refit after fonts load, resizing and revealing another page", () => {
	const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
	const label = (title, clientWidth) => ({
		title,
		clientWidth,
		textContent: title,
		isConnected: true,
		get scrollWidth() {
			return [...segmenter.segment(this.textContent)].length * 8;
		},
	});
	const labels = [
		label("Бесплатное место", 96),
		label("Свободное место", 96),
		label("Пусто", 96),
		label("e\u0301".repeat(20), 0),
	];
	let fontsLoaded, resized;
	const context = vm.createContext({
		Intl,
		document: {
			fonts: {
				ready: {
					then(callback) {
						fontsLoaded = callback;
					},
				},
			},
		},
		$: (selector) => {
			assert.equal(selector, ".selection-class, .selection-slot-label");
			return { toArray: () => labels };
		},
		ResizeObserver: class {
			constructor(callback) {
				resized = callback;
			}
			observe() {}
			unobserve() {}
		},
	});
	context.window = context;
	const source = read("htmls/contents/selection_characters.html");
	vm.runInContext(source.slice(source.indexOf("(function () {"), source.indexOf("</script>")), context);
	for (const item of labels.slice(0, 3)) assert.ok(item.scrollWidth <= item.clientWidth);
	assert.equal(labels[2].textContent, "Пусто");
	labels[0].clientWidth = 240;
	fontsLoaded();
	assert.equal(labels[0].textContent, labels[0].title);
	labels[3].clientWidth = 64;
	resized();
	assert.equal(labels[3].textContent, "e\u0301".repeat(7) + ".");
	labels[0].clientWidth = 48;
	resized();
	assert.ok(labels[0].scrollWidth <= 48);
});
