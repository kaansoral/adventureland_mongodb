"use strict";

// Release posts (UPDATE_NOTES.md): the check the deploy runs, the deploy stamp, the generated change list and the release the UPDATE button shows.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const tool = require("../../scripts/update_notes.js");
const { root, read, extract } = require("./helpers/server_vm");

test("every release names real definitions and has its text in English and every language", () => {
	assert.deepEqual(tool.validate(tool.load_notes(), tool.load_definitions(null)), []);
});

test("the check rejects unknown references, keys and priorities", () => {
	const G = { items: { ring: {} } };
	const problems = tool.validate(
		[
			{
				phrase: "update.01_10_26.test",
				deployed: null,
				date: "[01/10/26]",
				priority: 3,
				color: "red",
				changes: [{ new: "item:missing" }, { new: "item:ring" }, { new: "item:ring" }],
			},
		],
		G,
	);
	for (const text of [
		"unknown key color",
		"priority must be",
		"item:missing, which is not in the definitions",
		"listed twice: item:ring",
	])
		assert.ok(
			problems.some((line) => line.includes(text)),
			text,
		);
});

test("phrases that no note uses are found, so sync can remove them after a rename", () => {
	const notes = [
		{
			phrase: "update.01_10_26.renamed",
			deployed: null,
			date: "[01/10/26]",
			title: "A",
			changes: [{ fixed: "login", note: "Login works." }],
		},
		{ phrase: "update.01_01_18.old", note: "Old note" },
	];
	const english = {
		"update.01_10_26.renamed.title": "A",
		"update.01_10_26.renamed.login": "Login works.",
		"update.01_01_18.old": "Old note",
		"update.01_10_26.release.title": "A",
		"update.01_10_26.release.login": "Login works.",
	};
	assert.deepEqual(tool.unused_phrases(notes, english), [
		"update.01_10_26.release.title",
		"update.01_10_26.release.login",
	]);
});

test("renaming a release keeps its translations", () => {
	// A copy of the tool beside a tiny catalog, so the real catalogs stay untouched.
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "update-notes-")));
	try {
		fs.mkdirSync(path.join(dir, "scripts"));
		fs.mkdirSync(path.join(dir, "js"));
		fs.mkdirSync(path.join(dir, "languages/en"), { recursive: true });
		fs.mkdirSync(path.join(dir, "languages/tr"));
		fs.copyFileSync(path.join(root, "scripts/update_notes.js"), path.join(dir, "scripts/update_notes.js"));
		fs.symlinkSync(path.join(root, "js/phrases.js"), path.join(dir, "js/phrases.js"));
		fs.symlinkSync(path.join(root, "languages/index.js"), path.join(dir, "languages/index.js"));
		fs.writeFileSync(
			path.join(dir, "languages/en/updates.js"),
			'// Release highlights.\nmodule.exports = {\n\t// Title.\n\t"update.01_10_26.release.title": "Fixes",\n\t// Fixed bug.\n\t"update.01_10_26.release.login": "Login works.",\n};\n',
		);
		fs.writeFileSync(
			path.join(dir, "languages/tr/updates.json"),
			'{\n\t"update.01_10_26.release.title": "Düzeltmeler",\n\t"update.01_10_26.release.login": "Giriş çalışıyor."\n}\n',
		);
		const copy = require(path.join(dir, "scripts/update_notes.js"));
		const written = copy.write_english([
			{
				phrase: "update.01_10_26.fixes",
				deployed: null,
				date: "[01/10/26]",
				title: "Fixes",
				changes: [{ fixed: "login", note: "Login works." }],
			},
		]);
		assert.deepEqual(written.removed, ["update.01_10_26.release.title", "update.01_10_26.release.login"]);
		assert.equal(written.kept.length, 2);
		delete require.cache[path.join(dir, "languages/en/updates.js")];
		assert.deepEqual(Object.keys(require(path.join(dir, "languages/en/updates.js"))).sort(), [
			"update.01_10_26.fixes.login",
			"update.01_10_26.fixes.title",
		]);
		// The translations move with the rename, in the file's own tab indentation.
		assert.equal(
			fs.readFileSync(path.join(dir, "languages/tr/updates.json"), "utf8"),
			'{\n\t"update.01_10_26.fixes.title": "Düzeltmeler",\n\t"update.01_10_26.fixes.login": "Giriş çalışıyor."\n}\n',
		);
		assert.ok(!fs.existsSync(path.join(dir, "languages/de")), "languages without a catalog stay untouched");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("the deploy stamp dates every pending entry, however it is written", () => {
	const source = [
		"module.exports = [",
		'\t{ phrase: "update.01_10_26.a", deployed: null, date: "[01/10/26]", title: "A", changes: [] },',
		'\t{\n\t\t"phrase": "update.01_10_26.b",\n\t\t"deployed" :null,\n\t\tdate: "[01/10/26]",\n\t\tnote: "deployed: null stays text",\n\t},',
		'\t{ phrase: "update.30_09_26.c", deployed: "[30/09/26]", date: "[30/09/26]", note: "Old", changes: [{ fixed: "x", note: "deployed: null" }] },',
		"];",
	].join("\n");
	const result = tool.stamp(source, "[02/10/26]");
	assert.equal(result.count, 2);
	const notes = tool.load_notes(result.source);
	assert.deepEqual(
		Array.from(notes, (note) => note.deployed),
		["[02/10/26]", "[02/10/26]", "[30/09/26]"],
	);
	assert.equal(notes[1].note, "deployed: null stays text");
	assert.equal(notes[2].changes[0].note, "deployed: null");
});

test("the change list folds what a new entry already tells and quiets wording", () => {
	const before = {
		items: { sword: { attack: 10, explanation: "Old" }, cap: { armor: 5 } },
		monsters: { goo: { hp: 100 } },
		npcs: { shop: { items: ["sword"] } },
		maps: { main: { monsters: [{ type: "goo", count: 5 }], npcs: [], quirks: [] } },
		drops: { monsters: { goo: [[0.1, "sword"]] } },
		craft: {},
		levels: { 1: 100 },
		images: { a: 1 },
	};
	const after = {
		items: {
			sword: { attack: 12, explanation: "New" },
			cap: { armor: 5, cx: { accent: "#FFFFFF" } },
			ring: { gold: 100 },
		},
		monsters: { goo: { hp: 100 }, kobold: { hp: 900 } },
		npcs: { shop: { items: ["sword", "ring"] } },
		maps: {
			main: {
				monsters: [
					{ type: "goo", count: 5 },
					{ type: "kobold", count: 2 },
				],
				npcs: [],
				quirks: [],
			},
		},
		drops: {
			monsters: {
				goo: [
					[0.1, "sword"],
					[0.01, "ring"],
				],
				kobold: [[0.5, "ring"]],
			},
		},
		craft: { ring: { items: [[1, "sword"]] } },
		levels: { 1: 90 },
		images: { a: 2 },
	};
	const result = tool.draft(before, after);
	const keys = result.entries.map((entry) => Object.keys(entry)[0] + " " + Object.values(entry)[0]);
	assert.deepEqual(keys.sort(), ["changed item:sword", "changed table:levels", "new item:ring", "new monster:kobold"]);
	assert.deepEqual(result.entries.find((entry) => entry.changed === "item:sword").fields, { attack: [10, 12] });
	for (const text of [
		"item:cap (looks or wording only)",
		"npc:shop shop -> item:ring",
		"craft:ring -> item:ring",
		"maps.main spawn -> monster:kobold",
		"-> monster:kobold",
	])
		assert.ok(
			result.folded.some((line) => line.includes(text)),
			text,
		);
	assert.deepEqual(result.skipped, ["images"]);

	// The check lists what the pending release misses and which generated values went out of date.
	const release = {
		changes: [
			{ new: "item:ring" },
			{ changed: "item:sword", fields: { attack: [10, 11] } },
			{ fixed: "login", note: "Login works." },
		],
		quiet: { "monster:kobold": "Shown next release." },
	};
	assert.deepEqual(tool.coverage(release, result), {
		missing: ["changed table:levels"],
		stale: ["changed item:sword"],
		authored: [],
	});
	tool.merge(release, result);
	assert.deepEqual(tool.coverage(release, result), { missing: [], stale: [], authored: [] });
	assert.equal(release.changes.find((entry) => entry.changed === "item:sword").fields.attack[1], 12);
	assert.ok(!release.changes.some((entry) => entry.new === "monster:kobold"), "quiet entries stay out");
});

// The UPDATE button and the landing card show one release: the highest priority since the one the viewer last opened.
function button(update_notes, stored, extra = {}) {
	const storage = { update_seen: stored };
	const context = vm.createContext({
		update_notes,
		no_html: false,
		storage_get: (key) => storage[key],
		storage_set: (key, value) => (storage[key] = value),
		$: () => ({ remove() {}, children: () => [], hide() {} }),
		...extra,
	});
	vm.runInContext("var release_seen = undefined;", context);
	for (const name of ["latest_release", "release_priority", "release_unseen", "mark_release_seen"])
		vm.runInContext(extract(read("js/functions.js"), name), context);
	return { context, storage, shown: () => context.release_unseen() };
}

test("the UPDATE button shows the most important release since the last one opened", () => {
	const notes = [
		{ phrase: "update.05_10_26.fixes", title: "Fixes", priority: 0 },
		{ phrase: "update.04_10_26.small", title: "Small" },
		{ phrase: "update.03_10_26.big", title: "Big", priority: 2 },
		{ phrase: "update.02_10_26.other", title: "Other", priority: 2 },
		{ phrase: "update.01_10_26.seen", title: "Seen", priority: 2 },
		{ phrase: "update.01_09_26.legacy", note: "An old note" },
	];
	// Two big releases since the last visit: the newer one.
	const visit = button(notes, "update.01_10_26.seen");
	assert.equal(visit.shown(), 2);
	// Opening another release keeps the button; opening the shown one marks everything up to the newest as seen.
	visit.context.mark_release_seen(notes[1]);
	assert.equal(visit.shown(), 2);
	visit.context.mark_release_seen(notes[2]);
	assert.equal(visit.storage.update_seen, "update.05_10_26.fixes");
	assert.equal(visit.shown(), -1);
	// Only minor releases since the last visit: no button.
	assert.equal(button(notes, "update.04_10_26.small").shown(), -1);
	// Ties go to the newest; the default priority is 1.
	assert.equal(
		button(
			notes.slice(1, 2).concat([
				{ phrase: "update.03_10_26.x", title: "X" },
				{ phrase: "update.02_10_26.y", title: "Y" },
			]),
			"update.02_10_26.y",
		).shown(),
		0,
	);
	// A first visit, or a release that no longer exists, only looks at the newest release.
	assert.equal(button(notes, undefined).shown(), -1);
	assert.equal(button(notes.slice(1), undefined).shown(), 0);
	assert.equal(button(notes.slice(1), "update.renamed").shown(), 0);
	// Notes without a title never raise it, and pages without HTML never draw it.
	assert.equal(button([notes[5]], undefined).shown(), -1);
	assert.equal(button(notes, "update.01_10_26.seen", { no_html: true }).shown(), -1);
});
