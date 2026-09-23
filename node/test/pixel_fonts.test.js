const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const { read } = require("./helpers/server_vm");

const stylesheet = read("css/common.css").match(/@import url\("fonts\/pixel\/(fontfaces\.[a-f0-9]+\.css)"\)/)[1];
const css = read("css/fonts/pixel/" + stylesheet);
const faces = css.match(/@font-face\{[^}]+\}/g);

test("pixel families keep base spacing metrics first in WebKit's reverse face lookup", () => {
	const families = new Map();
	for (const face of faces) {
		const family = face.match(/font-family:([^;]+);/)[1];
		families.set(family, face);
	}
	assert.deepEqual([...families.keys()].sort(), ["pixel", "pixel-jp", "pixel-tc"]);
	for (const [family, lastFace] of families) {
		assert.match(lastFace, /src:url\("base\.[a-f0-9]+\.woff2"\)/, family);
		assert.match(lastFace, /unicode-range:U\+0020-007E,/, family);
	}
});

test("font ordering preserves all glyph sources, Unicode ranges and locale selectors", () => {
	const previous = read("css/fonts/pixel/fontfaces.14c8ea8731e8.css");
	assert.deepEqual([...faces].sort(), previous.match(/@font-face\{[^}]+\}/g).sort());
	const selectors = (source) =>
		source
			.replace(/@font-face\{[^}]+\}/g, "")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.trim();
	assert.equal(selectors(css), selectors(previous));
});

test("web and offline loader use the same cache-busted font declarations", () => {
	assert.equal(stylesheet, "fontfaces." + createHash("sha256").update(css).digest("hex").slice(0, 12) + ".css");
	assert.equal(read("tauri/resources/pixel/" + stylesheet), css);
	assert.ok(read("tauri/resources/loader.html").includes('href="pixel/' + stylesheet + '"'));
});
