const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const phrase = require("../../js/phrases");

test("language detection recognizes browser and desktop locale variants", () => {
	for (const [input, expected] of Object.entries({
		"zh-TW": "zh-Hant",
		"zh-HK": "zh-Hant",
		"zh-CN": "zh-Hans",
		"es-MX": "es-419",
		"es-ES": "es",
		pt_BR: "pt-BR",
		pt: "pt-PT",
		"nb-NO": "no",
		nn: "no",
		"tl-PH": "fil",
		"tr-TR": "tr",
	}))
		assert.equal(phrase.normalize(input), expected);
	assert.equal(phrase.detect(["unknown", "ja-JP", "en"]), "ja");
	assert.equal(phrase.detect("ru;q=0,fr;q=0.4,tr;q=0.8"), "tr");
	assert.equal(phrase.detect([]), "en");
});

test("named interpolation escapes HTML once and resolves nested phrases in the selected language", () => {
	const tr = phrase.create("tr", {
		message: "{condition}: {name}",
		condition: "Yavaşlık & <etki>",
		owner: "{_id}",
		counter: "{count} eşya",
		"counter.one": "{count} eşya",
		cycle: "{value}",
	});
	const params = { condition: { phrase: "condition" }, name: "<img onerror='x'>" };
	assert.equal(tr("message", params), "Yavaşlık & <etki>: <img onerror='x'>");
	assert.equal(tr.html("message", params), "Yavaşlık &amp; &lt;etki&gt;: &lt;img onerror=&#39;x&#39;&gt;");
	assert.equal(tr("owner", { _id: "US_fixture" }), "US_fixture");
	assert.equal(tr("counter", { count: 1 }), "1 eşya");
	assert.equal(tr("counter", { count: 2 }), "2 eşya");
	const recursive = { phrase: "cycle", phrase_args: {} };
	recursive.phrase_args.value = recursive;
	assert.equal(tr("cycle", { value: recursive }), "");
});

test("definition display copies nested data while keeping canonical names and CODE payloads", () => {
	phrase.load("tr", { "npc.merch.says.0": "Merhaba", log: "{name} geldi" });
	const canonical = { says: ["Hello", "Merrit"], name: "Merrit", action: "open_shop" };
	const display = phrase.definition("npc", "merch", "says", canonical.says);
	assert.deepEqual(display, ["Merhaba", "Merrit"]);
	assert.deepEqual(canonical.says, ["Hello", "Merrit"]);
	const packet = { message: "Kaan arrived", phrase: "log", phrase_args: { name: "Kaan" }, args: { size: 20 } };
	assert.equal(phrase.message(packet), "Kaan geldi");
	assert.equal(packet.message, "Kaan arrived");
	assert.deepEqual(packet.args, { size: 20 });
	assert.equal(phrase.message({ message: "player-authored" }), "player-authored");
	phrase.load("en", {});
});

test("browser global exists with and without Electron CommonJS integration", () => {
	const source = fs.readFileSync(path.resolve(__dirname, "../../js/phrases.js"), "utf8");
	for (const electron of [false, true]) {
		const context = vm.createContext(electron ? { window: {}, module: { exports: {} } } : { window: {} });
		vm.runInContext(source, context);
		assert.equal(typeof context.phrase, "function");
		context.phrase.load("tr", { test: "Türkçe" });
		assert.equal(context.phrase("test"), "Türkçe");
		if (electron) assert.equal(context.module.exports, context.phrase);
	}
});
