"use strict";
// Update notes as release posts. UPDATE_NOTES.md explains the format and the workflow.
//
//   node scripts/update_notes.js sync                 add every changed definition to the pending release and write its English phrases
//   node scripts/update_notes.js check [--offline]    validate every release; without --offline also compare the pending release with production
//   node scripts/update_notes.js draft [--from <state>] [--to <state>]   print the ledger between two states
//   node scripts/update_notes.js translations [--out <dir>] [--domain updates] [--prefix <id prefix>]
//   node scripts/update_notes.js apply <dir or file> [--domain updates]
//
// A state is "prod" (production's /data.js, the default --from), "worktree" (the default --to), a git revision or a saved data.js file.
const fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	child_process = require("child_process");

const root = path.resolve(__dirname, "..");
const notes_file = path.join(root, "update_notes.js");
const languages_dir = path.join(root, "languages");
const production_data = "https://adventure.land/data.js";

// The files main.js evaluates before it serves /data.js, in the same order.
const design_files = ["projectiles", "animations", "achievements", "game_design", "games", "conditions", "sprites", "dimensions", "monsters", "maps", "npcs", "multipliers", "items", "classes", "levels", "upgrades", "drops", "skills", "events", "recipes", "titles", "tokens", "cosmetics"];

// data.js section -> ledger type, one entry per key.
const section_types = {
	items: "item",
	monsters: "monster",
	maps: "map",
	npcs: "npc",
	events: "event",
	skills: "skill",
	conditions: "condition",
	sets: "set",
	craft: "craft",
	dismantle: "dismantle",
	titles: "title",
	tokens: "token",
	classes: "class",
	achievements: "achievement",
	games: "game",
};
// Whole tables that change together: one "table:<section>" entry.
const table_sections = ["levels", "upgrades", "compounds", "multipliers"];
// Cosmetic catalogs inside G.cosmetics: one "cx:<id>" entry per cosmetic.
const cosmetic_catalogs = ["head", "hair", "hat", "gravestone", "back", "prop", "bundle"];
// Fields that only change looks or wording: a changed entry lists everything else.
const quiet_fields = [/^cx(\.|$)/, /^explanation$/, /^description$/, /^summary$/, /^says$/, /^interaction(\.|$)/, /(^|\.)([a-z]+_)?text$/];
// Render-only or derived data that never needs an entry.
const skipped_sections = ["version", "geometry", "images", "positions", "tilesets", "imagesets", "sprites", "dimensions", "animations", "projectiles", "monster_gold"];
// Player-facing docs sections other than INFO guides, CODE functions and the guide tree.
const doc_sections = ["tutorial", "merchant_tutorial", "tasks", "rewards"];

// Every reference type the check and the renderer know, with the definitions section it resolves in.
const ref_types = {
	item: (G, id) => G.items && G.items[id],
	monster: (G, id) => G.monsters && G.monsters[id],
	map: (G, id) => G.maps && G.maps[id],
	npc: (G, id) => G.npcs && G.npcs[id],
	event: (G, id) => G.events && G.events[id],
	skill: (G, id) => G.skills && G.skills[id],
	condition: (G, id) => G.conditions && G.conditions[id],
	set: (G, id) => G.sets && G.sets[id],
	craft: (G, id) => G.craft && G.craft[id],
	dismantle: (G, id) => G.dismantle && G.dismantle[id],
	title: (G, id) => G.titles && G.titles[id],
	token: (G, id) => G.tokens && G.tokens[id],
	class: (G, id) => G.classes && G.classes[id],
	achievement: (G, id) => G.achievements && G.achievements[id],
	game: (G, id) => G.games && G.games[id],
	table: (G, id) => table_sections.includes(id) && G[id],
	cx: (G, id) => G.cosmetics && cosmetic_catalogs.some((catalog) => G.cosmetics[catalog] && G.cosmetics[catalog][id] !== undefined),
	drop: (G, id) => {
		const [group, key] = id.split(".");
		return G.drops && (key ? G.drops[group] && G.drops[group][key] : G.drops[group]);
	},
	guide: (G, id) => G.docs && G.docs.interactions && G.docs.interactions[id],
	article: (G, id) => G.docs && guide_articles(G.docs.guide).includes(id),
	doc: (G, id) => G.docs && G.docs[id],
	code: (G, id) => G.docs && G.docs.functions && G.docs.functions.includes(id),
};

const release_keys = ["phrase", "deployed", "date", "priority", "title", "note", "cover", "highlights", "changes", "quiet", "steam"];
const highlight_keys = ["key", "phrase", "title", "note", "show", "image"];
const change_verbs = ["new", "changed", "removed", "fixed", "improved"];
const change_keys = change_verbs.concat(["phrase", "note", "fields", "among", "count", "rows"]);

/* States: the definitions a release is compared between */

function read_source(revision, file) {
	if (!revision) return fs.readFileSync(path.join(root, file), "utf8");
	return child_process.execFileSync("git", ["show", revision + ":" + file], { cwd: root, maxBuffer: 1 << 28 }).toString();
}

function load_definitions(revision) {
	const quiet = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
	const context = vm.createContext({ console: quiet, require, module: { exports: {} }, setTimeout, clearTimeout });
	context.window = context;
	// common/ is a separate repository, so a git revision still uses the local copy.
	vm.runInContext(read_source(null, "common/js/common_functions.js"), context, { filename: "common_functions.js" });
	for (const name of design_files) {
		let source;
		try {
			source = read_source(revision, "design/" + name + ".js");
		} catch (error) {
			if (revision) continue; // the file did not exist yet
			throw error;
		}
		vm.runInContext(source, context, { filename: name + ".js" });
	}
	vm.runInContext(read_source(revision, "docs/directory.js"), context, { filename: "directory.js" });
	const G = {};
	for (const name of Object.keys(section_types).concat(table_sections, ["drops", "cosmetics", "docs", "sets", "sprites", "dimensions", "positions", "imagesets", "animations", "projectiles", "monster_gold"]))
		if (context[name] !== undefined) G[name] = context[name];
	return plain(G);
}

function load_data_js(source) {
	const context = vm.createContext({});
	vm.runInContext(source.replace(/^\s*var\s+G\s*=/, "G="), context);
	if (!context.G || !context.G.items) throw new Error("Not a data.js file");
	return context.G;
}

async function load_state(state) {
	if (!state || state === "worktree") return { name: "worktree", G: load_definitions(null) };
	if (state === "prod") {
		const response = await fetch(production_data, { signal: AbortSignal.timeout(60000) });
		if (!response.ok) throw new Error("Production data.js answered " + response.status);
		const G = load_data_js(await response.text());
		return { name: "production v" + G.version, G };
	}
	if (fs.existsSync(state) && fs.statSync(state).isFile()) {
		const G = load_data_js(fs.readFileSync(state, "utf8"));
		return { name: path.basename(state) + (G.version ? " v" + G.version : ""), G };
	}
	return { name: "git " + state, G: load_definitions(state) };
}

/* Drafting: one ledger entry per player-facing thing that differs */

function plain(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function same(a, b) {
	return JSON.stringify(plain(a)) === JSON.stringify(plain(b));
}

function flatten(value, prefix, out) {
	out = out || {};
	if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) {
		for (const key of Object.keys(value)) flatten(value[key], prefix ? prefix + "." + key : key, out);
	} else out[prefix] = value;
	return out;
}

// { "path": [before, after] }; arrays compare whole, so drop rows and spawn lists stay readable.
function field_changes(before, after) {
	const a = flatten(plain(before) || {}),
		b = flatten(plain(after) || {}),
		out = {};
	for (const key of new Set(Object.keys(a).concat(Object.keys(b))))
		if (!same(a[key], b[key])) out[key] = [a[key] === undefined ? null : a[key], b[key] === undefined ? null : b[key]];
	return out;
}

function keyed_diff(before, after) {
	before = before || {};
	after = after || {};
	const result = { added: [], removed: [], changed: [] };
	for (const id of Object.keys(after)) {
		if (!Object.prototype.hasOwnProperty.call(before, id)) result.added.push(id);
		else if (!same(before[id], after[id])) result.changed.push(id);
	}
	for (const id of Object.keys(before)) if (!Object.prototype.hasOwnProperty.call(after, id)) result.removed.push(id);
	return result;
}

function guide_articles(tree, out) {
	out = out || [];
	(tree || []).forEach((entry) => {
		if (!Array.isArray(entry)) return;
		if (Array.isArray(entry[4])) guide_articles(entry[4], out);
		else if (typeof entry[0] === "string") out.push(entry[0]);
	});
	return out;
}

function draft(before, after) {
	const entries = [],
		folded = [],
		skipped = [],
		fresh = { item: new Set(), monster: new Set(), npc: new Set(), guide: new Set(), cx: new Set(), drop: new Set() };
	const add = (verb, ref, extra) => entries.push(Object.assign({ [verb]: ref }, extra || {}));

	const changed = (ref, fields) => {
		for (const key of Object.keys(fields)) if (quiet_fields.some((pattern) => pattern.test(key))) delete fields[key];
		if (Object.keys(fields).length) add("changed", ref, { fields });
		else folded.push(ref + " (looks or wording only)");
	};
	for (const section of ["items", "monsters", "npcs"]) for (const id of keyed_diff(before[section], after[section]).added) fresh[section_types[section]].add(id);
	for (const section of Object.keys(section_types)) {
		if (section === "maps") continue;
		const type = section_types[section],
			diff = keyed_diff(before[section], after[section]);
		for (const id of diff.added) {
			// A recipe for a new item shows in that item's row.
			if ((type === "craft" || type === "dismantle") && fresh.item.has((after[section][id].output && after[section][id].output.name) || id)) folded.push(type + ":" + id + " -> item:" + id);
			else add("new", type + ":" + id);
		}
		diff.removed.forEach((id) => add("removed", type + ":" + id));
		for (const id of diff.changed) {
			const fields = field_changes(before[section][id], after[section][id]);
			// A token or shop that only starts selling new items shows in those items' rows.
			if (type === "token" && Object.keys(fields).every((key) => fields[key][0] === null && fresh.item.has(key))) {
				folded.push("token:" + id + " -> " + Object.keys(fields).map((key) => "item:" + key).join(", "));
				continue;
			}
			if (type === "npc" && Object.keys(fields).length === 1 && fields.items) {
				const sold_before = fields.items[0] || [],
					sold = (fields.items[1] || []).filter((item) => !sold_before.includes(item));
				if (sold.length && sold.every((item) => fresh.item.has(item)) && sold_before.every((item) => (fields.items[1] || []).includes(item))) {
					folded.push("npc:" + id + " shop -> " + sold.map((item) => "item:" + item).join(", "));
					continue;
				}
			}
			changed(type + ":" + id, fields);
		}
	}
	for (const section of table_sections)
		if (before[section] !== undefined && !same(before[section], after[section])) add("changed", "table:" + section, { fields: field_changes(before[section], after[section]) });

	const cosmetics_before = before.cosmetics || {},
		cosmetics_after = after.cosmetics || {};
	for (const catalog of cosmetic_catalogs) {
		const diff = keyed_diff(cosmetics_before[catalog], cosmetics_after[catalog]);
		diff.added.forEach((id) => (fresh.cx.add(id), add("new", "cx:" + id)));
		diff.removed.forEach((id) => add("removed", "cx:" + id));
		diff.changed.forEach((id) => changed("cx:" + id, field_changes(cosmetics_before[catalog][id], cosmetics_after[catalog][id])));
	}
	for (const key of Object.keys(Object.assign({}, cosmetics_before, cosmetics_after)))
		if (!cosmetic_catalogs.includes(key) && !same(cosmetics_before[key], cosmetics_after[key])) folded.push("cosmetics." + key + " (placement data)");

	// Guides, articles and CODE functions come from the docs index that data.js also carries.
	const docs_before = before.docs || {},
		docs_after = after.docs || {};
	const guides = keyed_diff(docs_before.interactions, docs_after.interactions);
	guides.added.forEach((id) => (fresh.guide.add(id), add("new", "guide:" + id)));
	guides.removed.forEach((id) => add("removed", "guide:" + id));
	guides.changed.forEach((id) => changed("guide:" + id, field_changes(docs_before.interactions[id], docs_after.interactions[id])));
	const guide_article_names = new Set(Object.values(docs_after.interactions || {}).map((guide) => guide.article));
	const articles_before = new Set(guide_articles(docs_before.guide)),
		articles_after = new Set(guide_articles(docs_after.guide));
	for (const name of articles_after)
		if (!articles_before.has(name)) {
			if (guide_article_names.has(name)) folded.push("docs.guide article " + name + " -> its INFO guide");
			else add("new", "article:" + name);
		}
	for (const name of articles_before) if (!articles_after.has(name)) add("removed", "article:" + name);
	const functions_before = new Set(docs_before.functions || []),
		functions_after = new Set(docs_after.functions || []);
	for (const name of functions_after) if (!functions_before.has(name)) add("new", "code:" + name);
	for (const name of functions_before) if (!functions_after.has(name)) add("removed", "code:" + name);
	for (const section of doc_sections)
		if (docs_before[section] !== undefined && !same(docs_before[section], docs_after[section])) add("changed", "doc:" + section);
	if (!same(docs_before.interaction_map, docs_after.interaction_map)) folded.push("docs.interaction_map (INFO wiring)");

	// Map edits that only place new monsters, new NPCs or a new guide's INFO quirk fold into those entries.
	const maps = keyed_diff(before.maps, after.maps);
	maps.added.forEach((id) => add("new", "map:" + id));
	maps.removed.forEach((id) => add("removed", "map:" + id));
	for (const id of maps.changed) {
		const a = before.maps[id],
			b = after.maps[id];
		const rest = field_changes(Object.assign({}, a, { monsters: 0, quirks: 0, npcs: 0 }), Object.assign({}, b, { monsters: 0, quirks: 0, npcs: 0 }));
		const added = (list_a, list_b) => (list_b || []).filter((x) => !(list_a || []).some((y) => same(x, y)));
		const spawns = added(a.monsters, b.monsters),
			quirks = added(a.quirks, b.quirks),
			npcs = added(a.npcs, b.npcs);
		const lost = (a.monsters || []).length + (a.quirks || []).length + (a.npcs || []).length > (b.monsters || []).length + (b.quirks || []).length + (b.npcs || []).length - spawns.length - quirks.length - npcs.length;
		const unexplained =
			spawns.filter((pack) => !fresh.monster.has(pack.type)).length +
			quirks.filter((quirk) => !(typeof quirk[4] === "string" && fresh.guide.has(quirk[4].replace(/_info$/, "")))).length +
			npcs.filter((npc) => !fresh.npc.has(npc.id)).length;
		if (Object.keys(rest).length || unexplained || lost) add("changed", "map:" + id, { fields: field_changes(a, b) });
		else {
			spawns.forEach((pack) => folded.push("maps." + id + " spawn -> monster:" + pack.type));
			quirks.forEach((quirk) => folded.push("maps." + id + " quirk " + quirk[4] + " -> guide:" + quirk[4].replace(/_info$/, "")));
			npcs.forEach((npc) => folded.push("maps." + id + " placement -> npc:" + npc.id));
		}
	}

	// Drop rows for new items or new monsters fold into those entries; any other drop edit needs its own entry.
	const drops_before = before.drops || {},
		drops_after = after.drops || {};
	const row_item = (row) => (Array.isArray(row) ? row[1] : undefined);
	// A row is already told by another entry: a new item, a new cosmetic, or a new table it opens.
	const told = (row) => Array.isArray(row) && (fresh.item.has(row[1]) || ((row[1] === "cx" || row[1] === "cxbundle") && fresh.cx.has(row[2])) || (row[1] === "open" && fresh.drop.has(row[2])));
	for (const table of Object.keys(drops_after)) if (!(table in drops_before) && table !== "monsters" && table !== "maps") fresh.drop.add(table);
	const compare_rows = (label, rows_before, rows_after, owner) => {
		const old_rows = (rows_before || []).map((row) => JSON.stringify(row)),
			new_rows = (rows_after || []).map((row) => JSON.stringify(row));
		const gained = new_rows.filter((row) => !old_rows.includes(row)),
			lost = old_rows.filter((row) => !new_rows.includes(row));
		if (!gained.length && !lost.length) return;
		if (owner && !lost.length) return folded.push("drops." + label + " (" + gained.length + " rows) -> " + owner);
		const unexplained = gained.filter((row) => !told(JSON.parse(row)));
		gained.filter((row) => told(JSON.parse(row))).forEach((row) => folded.push("drops." + label + " " + row + " -> " + (fresh.item.has(row_item(JSON.parse(row))) ? "item:" + row_item(JSON.parse(row)) : "its entry")));
		if (unexplained.length || lost.length) add(rows_before ? "changed" : "new", "drop:" + label, { rows: [lost.map((row) => JSON.parse(row)), unexplained.map((row) => JSON.parse(row))] });
	};
	for (const group of ["monsters", "maps"])
		for (const id of new Set(Object.keys(drops_before[group] || {}).concat(Object.keys(drops_after[group] || {}))))
			compare_rows(group + "." + id, (drops_before[group] || {})[id], (drops_after[group] || {})[id], group === "monsters" && fresh.monster.has(id) && !(drops_before[group] || {})[id] ? "monster:" + id : null);
	for (const table of new Set(Object.keys(drops_before).concat(Object.keys(drops_after)))) {
		if (table === "monsters" || table === "maps") continue;
		const a = drops_before[table],
			b = drops_after[table];
		if (same(a, b)) continue;
		if (a === undefined && fresh.item.has(table)) folded.push("drops." + table + " -> item:" + table);
		else if (Array.isArray(a || b)) compare_rows(table, a, b, null);
		else add(a === undefined ? "new" : b === undefined ? "removed" : "changed", "drop:" + table, { fields: field_changes(a, b) });
	}

	for (const section of Object.keys(after))
		if (skipped_sections.includes(section) && before[section] !== undefined && !same(before[section], after[section])) skipped.push(section);
	// A cosmetic can sit in two catalogs (hair and prop): list it once.
	const seen = new Set();
	return {
		entries: entries.filter((entry) => {
			const key = verb_of(entry) + " " + (ref_of(entry) || "");
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		}),
		folded,
		skipped,
	};
}

/* Releases: phrases, validation and coverage */

function load_notes(source) {
	const module = { exports: null };
	vm.runInNewContext(source === undefined ? fs.readFileSync(notes_file, "utf8") : source, { module, exports: {} }, { filename: "update_notes.js" });
	return module.exports;
}

function is_release(note) {
	return !!(note && (note.title !== undefined || note.highlights || note.changes));
}

function verb_of(entry) {
	return change_verbs.find((verb) => entry[verb] !== undefined);
}

function ref_of(entry) {
	const verb = verb_of(entry);
	return verb === "new" || verb === "changed" || verb === "removed" ? entry[verb] : null;
}

function parse_ref(ref) {
	const at = typeof ref === "string" ? ref.indexOf(":") : -1;
	return at === -1 ? null : { type: ref.slice(0, at), id: ref.slice(at + 1) };
}

// Where each English text is shown, for the catalog comment translators read.
function phrase_context(note, entry) {
	const release = "the " + (note.deployed || note.date) + " update post" + (note.title ? ' "' + note.title + '"' : "");
	if (entry.holder === note) return entry.field === "title" ? "Title of " + release + "." : "Summary of " + release + ", shown under its title and in the game log.";
	if ((note.highlights || []).includes(entry.holder))
		return entry.field === "title" ? "Section heading in " + release + "." : "Section text in " + release + (entry.holder.show ? ", under sprites of: " + entry.holder.show.map((x) => (typeof x === "string" ? x : x.spawn)).join(", ") : "") + ".";
	const ref = ref_of(entry.holder);
	if (ref) return "Note under " + ref + " (" + verb_of(entry.holder) + ") in the change list of " + release + ".";
	return (entry.holder.fixed ? "Fixed bug" : "Improvement") + " listed in " + release + ".";
}

function read_catalog(domain, language) {
	const file = path.join(languages_dir, language, domain + (language === "en" ? ".js" : ".json"));
	if (!fs.existsSync(file)) return {};
	if (language === "en") {
		delete require.cache[require.resolve(file)];
		return require(file);
	}
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function locales() {
	return require(path.join(root, "js/phrases.js"))
		.languages.map((language) => language.code)
		.filter((code) => code !== "en");
}

function validate(notes, G) {
	const localization = require(path.join(root, "languages/index.js"));
	const scope = require(path.join(languages_dir, "scope.js"));
	const problems = [],
		ids = new Map(),
		english = read_catalog("updates", "en"),
		catalogs = Object.fromEntries(locales().map((code) => [code, read_catalog("updates", code)]));
	const problem = (note, text) => problems.push((note.phrase || note.date || "note") + ": " + text);
	const check_ref = (note, ref, where, allow_missing) => {
		const parsed = parse_ref(ref);
		if (!parsed || !ref_types[parsed.type]) return problem(note, where + " has an unknown reference " + JSON.stringify(ref));
		if (!allow_missing && G && !ref_types[parsed.type](G, parsed.id)) problem(note, where + " refers to " + ref + ", which is not in the definitions");
	};
	notes.forEach((note, index) => {
		if (!note || typeof note !== "object") return problems.push("entry " + index + " is not an object");
		// Old notes keep their historical dates, like [Late 2017].
		if (!is_release(note)) return;
		if (note.deployed !== null && !/^\[\d\d\/\d\d\/\d\d\]$/.test(note.deployed || "")) problem(note, "deployed must be null or [DD/MM/YY]");
		for (const key of Object.keys(note)) if (!release_keys.includes(key)) problem(note, "unknown key " + key);
		if (typeof note.phrase !== "string" || !/^update\.\d\d_\d\d_\d\d\.[a-z0-9_]+$/.test(note.phrase)) problem(note, "phrase must look like update.DD_MM_YY.name");
		if (!/^\[\d\d\/\d\d\/\d\d\]$/.test(note.date || "")) problem(note, "date must be [DD/MM/YY]");
		if (note.title !== undefined && (typeof note.title !== "string" || !note.title.trim())) problem(note, "title must be text");
		if (note.priority !== undefined && ![0, 1, 2].includes(note.priority)) problem(note, "priority must be 0 (minor), 1 or 2 (big)");
		if (note.cover !== undefined) check_ref(note, note.cover, "cover");
		const keys = new Set();
		(note.highlights || []).forEach((highlight, h) => {
			for (const key of Object.keys(highlight)) if (!highlight_keys.includes(key)) problem(note, "highlight " + h + " has an unknown key " + key);
			if (!highlight.phrase && !/^[a-z0-9_]+$/.test(highlight.key || "")) problem(note, "highlight " + h + " needs a key of lowercase letters, digits and _");
			(highlight.show || []).forEach((show) => {
				if (typeof show === "string") check_ref(note, show, "highlight " + (highlight.key || h));
				else if (show && show.spawn) {
					check_ref(note, show.spawn, "highlight " + (highlight.key || h));
					check_ref(note, show.among, "highlight " + (highlight.key || h));
					if (!(show.count > 0)) problem(note, "a spawn in highlight " + (highlight.key || h) + " needs a count");
				} else problem(note, "highlight " + (highlight.key || h) + " shows something unknown: " + JSON.stringify(show));
			});
			if (highlight.image && !(typeof highlight.image.src === "string" && highlight.image.width > 0 && highlight.image.height > 0)) problem(note, "highlight " + (highlight.key || h) + " image needs src, width and height");
		});
		(note.changes || []).forEach((entry, c) => {
			const verbs = change_verbs.filter((verb) => entry[verb] !== undefined);
			if (verbs.length !== 1) return problem(note, "change " + c + " needs exactly one of " + change_verbs.join(", "));
			for (const key of Object.keys(entry)) if (!change_keys.includes(key)) problem(note, "change " + c + " has an unknown key " + key);
			const ref = ref_of(entry);
			if (ref) check_ref(note, ref, "change " + c, verbs[0] === "removed" || note.deployed !== null);
			else if (!/^[a-z0-9_]+$/.test(entry[verbs[0]]) || !entry.note) problem(note, verbs[0] + " entries need a key of lowercase letters, digits and _ and a note");
			if (entry.among) check_ref(note, entry.among, "change " + c + " among", note.deployed !== null);
			const key = (ref || entry[verbs[0]]) + "";
			if (keys.has(key)) problem(note, "listed twice: " + key);
			keys.add(key);
		});
		// Every English text has one phrase, the same text in the English catalog, and a translation in every language.
		localization.note_phrases(note).forEach((entry) => {
			const text = entry.holder[entry.field];
			if (typeof text !== "string" || !text.trim()) return problem(note, entry.id + " is empty");
			if (ids.has(entry.id) && ids.get(entry.id) !== text) problem(note, entry.id + " is used for two different texts");
			ids.set(entry.id, text);
			if (english[entry.id] !== text) problem(note, entry.id + (english[entry.id] === undefined ? " is missing from languages/en/updates.js" : " differs from languages/en/updates.js") + " (run sync)");
			if (scope.deferred(entry.id)) return;
			const missing = Object.keys(catalogs).filter((code) => typeof catalogs[code][entry.id] !== "string");
			if (missing.length) problem(note, entry.id + " needs translations: " + missing.join(", "));
		});
	});
	unused_phrases(notes, english).forEach((id) => problems.push(id + " in languages/en/updates.js belongs to no note (run sync)"));
	return problems;
}

function pending_release(notes) {
	return notes.find((note) => note && note.deployed === null && is_release(note)) || null;
}

function coverage(release, drafted) {
	const listed = new Map(),
		result = { missing: [], stale: [], authored: [] };
	((release && release.changes) || []).forEach((entry) => {
		const ref = ref_of(entry);
		if (ref) listed.set(verb_of(entry) + " " + ref, entry);
	});
	const quiet = new Set(Object.keys((release && release.quiet) || {}));
	const drafted_keys = new Set();
	drafted.entries.forEach((entry) => {
		const key = verb_of(entry) + " " + ref_of(entry);
		drafted_keys.add(key);
		const found = listed.get(key);
		if (!found) {
			if (!quiet.has(ref_of(entry))) result.missing.push(key);
		} else if ((entry.fields && !same(entry.fields, found.fields)) || (entry.rows && !same(entry.rows, found.rows))) result.stale.push(key);
	});
	for (const key of listed.keys()) if (!drafted_keys.has(key)) result.authored.push(key);
	return result;
}

/* Writing update_notes.js */

// Top-level entries of the exported array and the value span of each entry's own `deployed` key, whatever the formatting.
function scan_notes(source) {
	const tokens = [];
	let i = 0;
	while (i < source.length) {
		const c = source[i];
		if (c === "/" && source[i + 1] === "/") {
			i = source.indexOf("\n", i);
			if (i === -1) i = source.length;
			continue;
		}
		if (c === "/" && source[i + 1] === "*") {
			const end = source.indexOf("*/", i + 2);
			i = end === -1 ? source.length : end + 2;
			continue;
		}
		if (c === '"' || c === "'" || c === "`") {
			const start = i++;
			while (i < source.length && source[i] !== c) i += source[i] === "\\" ? 2 : 1;
			tokens.push({ type: "string", start, end: ++i, value: source.slice(start + 1, i - 1) });
			continue;
		}
		if (/[A-Za-z_$]/.test(c)) {
			const start = i;
			while (i < source.length && /[\w$]/.test(source[i])) i++;
			tokens.push({ type: "word", start, end: i, value: source.slice(start, i) });
			continue;
		}
		if ("[]{}(),:=;.".includes(c)) tokens.push({ type: c, start: i, end: i + 1 });
		i++;
	}
	const open = tokens.findIndex((token, t) => token.type === "[" && tokens.slice(0, t).some((x) => x.value === "exports"));
	if (open === -1) throw new Error("update_notes.js must export an array");
	const entries = [];
	let depth = 0,
		current = null,
		previous_end = 0;
	for (let t = open + 1; t < tokens.length; t++) {
		const token = tokens[t];
		if (depth === 0) {
			if (token.type === "]" || token.type === ",") {
				if (current) entries.push(Object.assign(current, { end: previous_end }));
				current = null;
				if (token.type === "]") break;
				continue;
			}
			if (!current) current = { start: token.start, end: null, deployed: null };
		}
		if ("[{(".includes(token.type)) depth++;
		else if ("]})".includes(token.type)) depth--;
		else if (depth === 1 && token.type === ":" && (tokens[t - 1].type === "word" || tokens[t - 1].type === "string") && tokens[t - 1].value === "deployed") {
			const value = tokens[t + 1];
			if (value) current.deployed = { start: value.start, end: value.end, null: value.type === "word" && value.value === "null" };
		}
		previous_end = token.end;
	}
	return entries;
}

// Stamps every undeployed entry with the deploy date; the deploy lock uses this.
function stamp(source, date) {
	const spans = scan_notes(source)
		.map((entry) => entry.deployed)
		.filter((deployed) => deployed && deployed.null);
	let out = source;
	for (const span of spans.slice().reverse()) out = out.slice(0, span.start) + JSON.stringify(date) + out.slice(span.end);
	return { source: out, count: spans.length };
}

function literal(value, indent) {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return "[" + value.map((x) => literal(x, indent)).join(", ") + "]";
	const keys = Object.keys(value);
	if (!keys.length) return "{}";
	return "{ " + keys.map((key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)) + ": " + literal(value[key], indent)).join(", ") + " }";
}

function key_name(key) {
	return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

// The canonical text of a release; sync rewrites the pending release with it.
function format_release(release) {
	const order = release_keys.filter((key) => release[key] !== undefined).concat(Object.keys(release).filter((key) => !release_keys.includes(key)));
	let out = "\t{\n";
	for (const key of order) {
		const value = release[key];
		if (key === "highlights") {
			out += "\t\thighlights: [\n";
			for (const highlight of value) {
				out += "\t\t\t{\n";
				for (const name of Object.keys(highlight)) out += "\t\t\t\t" + key_name(name) + ": " + literal(highlight[name]) + ",\n";
				out += "\t\t\t},\n";
			}
			out += "\t\t],\n";
		} else if (key === "changes") {
			out += "\t\tchanges: [\n";
			for (const entry of value) out += "\t\t\t" + literal(entry) + ",\n";
			out += "\t\t],\n";
		} else out += "\t\t" + key_name(key) + ": " + literal(value) + ",\n";
	}
	return out + "\t}";
}

function today(now) {
	const parts = {};
	new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "2-digit" }).formatToParts(now || new Date()).forEach((part) => (parts[part.type] = part.value));
	return { date: "[" + parts.day + "/" + parts.month + "/" + parts.year + "]", id: parts.day + "_" + parts.month + "_" + parts.year };
}

// Adds missing entries and refreshes generated values; authored text and entries stay as they are.
function merge(release, drafted) {
	const changes = release.changes || (release.changes = []);
	const added = [],
		refreshed = [];
	for (const entry of drafted.entries) {
		const verb = verb_of(entry),
			ref = ref_of(entry);
		if (Object.prototype.hasOwnProperty.call(release.quiet || {}, ref)) continue;
		const found = changes.find((x) => verb_of(x) === verb && ref_of(x) === ref);
		if (!found) {
			changes.push(entry);
			added.push(verb + " " + ref);
		} else
			for (const key of ["fields", "rows"])
				if (entry[key] && !same(entry[key], found[key])) {
					found[key] = entry[key];
					refreshed.push(verb + " " + ref);
				}
	}
	return { added, refreshed };
}

function write_release(source, release, index) {
	const entries = scan_notes(source);
	if (index === -1) {
		const at = source.indexOf("[", source.indexOf("module.exports")) + 1;
		return source.slice(0, at) + "\n" + format_release(release) + "," + source.slice(at);
	}
	const span = entries[index];
	return source.slice(0, span.start - (source.slice(0, span.start).match(/\t*$/)[0].length)) + format_release(release) + source.slice(span.end);
}

/* Phrase catalogs */

function js_string(text) {
	return JSON.stringify(text);
}

// Writes English phrases for every release; a changed English text removes that phrase's now stale translations,
// and a phrase no note uses any more (a renamed release, a removed entry) leaves every catalog.
function write_english(notes) {
	const localization = require(path.join(root, "languages/index.js"));
	const file = path.join(languages_dir, "en/updates.js");
	let source = fs.readFileSync(file, "utf8");
	const english = read_catalog("updates", "en");
	const inserted = [],
		updated = [],
		value = "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')";
	let block = "";
	notes.filter(is_release).forEach((note) =>
		localization.note_phrases(note).forEach((entry) => {
			const text = entry.holder[entry.field];
			if (typeof text !== "string" || english[entry.id] === text) return;
			if (english[entry.id] === undefined) {
				block += "\t// " + phrase_context(note, entry) + " Keep names from the game and CODE identifiers unchanged.\n\t" + JSON.stringify(entry.id) + ": " + js_string(text) + ",\n";
				english[entry.id] = text;
				inserted.push(entry.id);
			} else {
				// The comment above the phrase describes the new text too. Entries sit inside the object or are appended as module.exports["id"] = "...".
				const id = JSON.stringify(entry.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
					comment = "\t// " + phrase_context(note, entry) + " Keep names from the game and CODE identifiers unchanged.\n",
					inside = new RegExp("^((?:\\t//[^\\n]*\\n)*)(\\t" + id + ":\\s*)" + value + "(,?)$", "m"),
					appended = new RegExp("^((?://[^\\n]*\\n)*)(module\\.exports\\[" + id + "\\]\\s*=\\s*)" + value + "(;?)$", "m");
				if (inside.test(source)) source = source.replace(inside, (match, old_comment, head, old, end) => comment + head + js_string(text) + end);
				else if (appended.test(source)) source = source.replace(appended, (match, old_comment, head, old, end) => comment.slice(1) + head + js_string(text) + end);
				else throw new Error("Cannot find " + entry.id + " on one line in languages/en/updates.js");
				english[entry.id] = text;
				updated.push(entry.id);
			}
		}),
	);
	if (block) source = source.replace(/module\.exports\s*=\s*\{\n/, (match) => match + block);
	const removed = unused_phrases(notes, english);
	for (const id of removed) {
		const quoted = JSON.stringify(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
			inside = new RegExp("^(?:\\t//[^\\n]*\\n)?\\t" + quoted + ":\\s*" + value + ",?\\n", "m"),
			appended = new RegExp("^(?://[^\\n]*\\n)?module\\.exports\\[" + quoted + "\\]\\s*=\\s*" + value + ";?\\n", "m");
		if (inside.test(source)) source = source.replace(inside, "");
		else if (appended.test(source)) source = source.replace(appended, "");
		else throw new Error("Cannot find " + id + " on one line in languages/en/updates.js");
	}
	if (inserted.length || updated.length || removed.length) fs.writeFileSync(file, source);
	// A rename keeps its translations: a new phrase with the same English as a removed one takes them over.
	const kept = [];
	for (const id of removed) for (const target of inserted) if (english[target] === english[id]) kept.push([id, target]);
	if (kept.length)
		for (const code of locales()) {
			const catalog = read_catalog("updates", code),
				values = {};
			for (const [id, target] of kept) if (typeof catalog[id] === "string" && typeof catalog[target] !== "string") values[target] = catalog[id];
			write_catalog_entries("updates", code, values);
		}
	for (const id of updated.concat(removed)) for (const code of locales()) write_catalog_entries("updates", code, { [id]: undefined });
	return { inserted, updated, removed, kept };
}

// English update phrases that no note uses.
function unused_phrases(notes, english) {
	const localization = require(path.join(root, "languages/index.js"));
	const used = new Set();
	notes.forEach((note) => localization.note_phrases(note).forEach((entry) => used.add(entry.id)));
	return Object.keys(english).filter((id) => id.startsWith("update.") && !used.has(id));
}

// Inserts, replaces or (with undefined) removes keys in languages/<code>/<domain>.json without reformatting the file.
function write_catalog_entries(domain, code, values) {
	const file = path.join(languages_dir, code, domain + ".json");
	let source = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}\n";
	let changed = false;
	// New lines use the file's own indentation.
	const indent = (source.match(/^([ \t]+)"/m) || [null, "\t"])[1];
	for (const id of Object.keys(values)) {
		const value = values[id],
			line = new RegExp('^([ \\t]*)"' + id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '":[ \\t]*"(?:[^"\\\\]|\\\\.)*"(,?)[ \\t]*\\n', "m");
		if (value === undefined) {
			if (!line.test(source)) continue;
			source = source.replace(line, "");
		} else if (line.test(source)) {
			source = source.replace(line, (match, lead, comma) => lead + JSON.stringify(id) + ": " + JSON.stringify(value) + comma + "\n");
		} else if (!Object.keys(JSON.parse(source)).length) {
			source = "{\n" + indent + JSON.stringify(id) + ": " + JSON.stringify(value) + "\n}\n";
		} else {
			source = source.replace(/"[ \t]*\n\}\s*$/, () => '",\n' + indent + JSON.stringify(id) + ": " + JSON.stringify(value) + "\n}\n");
		}
		changed = true;
	}
	if (!changed) return false;
	// A removal can leave a comma before the closing brace.
	source = source.replace(/,([ \t]*\n\}\s*)$/, "$1");
	const result = JSON.parse(source);
	for (const id of Object.keys(values)) if (values[id] === undefined ? id in result : result[id] !== values[id]) throw new Error("Could not write " + code + "/" + id);
	fs.writeFileSync(file, source);
	return true;
}

/* Commands */

function option(args, name, fallback) {
	const i = args.indexOf(name);
	return i === -1 ? fallback : args[i + 1];
}

function print_entries(entries) {
	for (const entry of entries) console.log("  " + literal(entry).slice(0, 220));
}

async function command_draft(args) {
	const from = await load_state(option(args, "--from", "prod")),
		to = await load_state(option(args, "--to", "worktree"));
	const result = draft(from.G, to.G);
	console.log(from.name + " -> " + to.name + ": " + result.entries.length + " entries, " + result.folded.length + " folded, skipped " + (result.skipped.join(", ") || "nothing"));
	if (args.includes("--json")) console.log(JSON.stringify(result, null, "\t"));
	else print_entries(result.entries);
}

async function command_sync(args) {
	const source = fs.readFileSync(notes_file, "utf8"),
		notes = load_notes(source);
	let index = notes.findIndex((note) => note && note.deployed === null && is_release(note));
	const from = await load_state(option(args, "--from", "prod")),
		to = await load_state("worktree");
	const drafted = draft(from.G, to.G);
	let release = index === -1 ? null : notes[index];
	if (!release) {
		if (!drafted.entries.length) {
			console.log("No changes since " + from.name + " and no pending release.");
			return command_phrases(notes);
		}
		const day = today();
		let name = "update." + day.id + ".release",
			n = 2;
		while (notes.some((note) => note && note.phrase === name)) name = "update." + day.id + ".release_" + n++;
		release = { phrase: name, deployed: null, date: day.date, changes: [] };
	}
	const merged = merge(release, drafted);
	const updated_source = write_release(source, release, index);
	load_notes(updated_source); // never write a file that does not evaluate
	fs.writeFileSync(notes_file, updated_source);
	console.log("Pending release " + release.phrase + " (" + from.name + " -> worktree): added " + merged.added.length + ", refreshed " + merged.refreshed.length + ".");
	merged.added.forEach((line) => console.log("  + " + line));
	merged.refreshed.forEach((line) => console.log("  ~ " + line));
	if (!release.title) console.log("  The release has no title yet: add a title (and highlights) so players get the UPDATE button.");
	else if (release.priority === undefined) console.log("  Priority: add priority: 0 if it only fixes and adjusts things, priority: 2 if it is a big update (UPDATE_NOTES.md).");
	command_phrases(load_notes(updated_source));
}

function command_phrases(notes) {
	const written = write_english(notes);
	if (written.inserted.length) console.log("English phrases added: " + written.inserted.join(", "));
	if (written.updated.length) console.log("English phrases changed; their translations were removed so they show up as missing: " + written.updated.join(", "));
	if (written.kept.length) console.log("Translations moved to renamed phrases: " + written.kept.map((pair) => pair.join(" -> ")).join(", "));
	if (written.removed.length) console.log("Phrases no note uses were removed: " + written.removed.join(", "));
}

async function command_check(args) {
	const notes = load_notes(),
		G = load_definitions(null);
	const problems = validate(notes, G);
	const release = pending_release(notes);
	if (!args.includes("--offline")) {
		const from = await load_state(option(args, "--from", "prod"));
		const result = coverage(release, draft(from.G, G));
		result.missing.forEach((key) => problems.push((release ? release.phrase : "pending release") + ": missing " + key + " (run sync)"));
		result.stale.forEach((key) => problems.push((release ? release.phrase : "pending release") + ": outdated values for " + key + " (run sync)"));
		console.log("Compared " + from.name + " with the worktree." + (result.authored.length ? " Written by hand, not visible in the data: " + result.authored.join(", ") + "." : ""));
	}
	// Problems go to stderr: the deploy runs this check with its output captured, and stderr still reaches the terminal.
	if (problems.length) {
		console.error(problems.length + " problem" + (problems.length === 1 ? "" : "s") + " in the update notes:");
		problems.forEach((line) => console.error("  " + line));
		process.exitCode = 1;
	} else console.log("Update notes are complete" + (release ? ": " + release.phrase + " is pending." : "."));
}

function command_translations(args) {
	const domain = option(args, "--domain", "updates"),
		prefix = option(args, "--prefix", domain === "updates" ? "update." : ""),
		out = option(args, "--out", null);
	const scope = require(path.join(languages_dir, "scope.js"));
	const english = read_catalog(domain, "en");
	const comments = {};
	const source = fs.readFileSync(path.join(languages_dir, "en", domain + ".js"), "utf8");
	source.replace(/((?:\t\/\/[^\n]*\n)+)\t("[^"]+"):/g, (match, comment, id) => (comments[JSON.parse(id)] = comment.replace(/\t\/\/ ?/g, "").trim()));
	let total = 0;
	for (const code of locales()) {
		const catalog = read_catalog(domain, code),
			sheet = {};
		for (const id of Object.keys(english)) if (id.startsWith(prefix) && typeof catalog[id] !== "string" && !(domain === "updates" && scope.deferred(id))) sheet[id] = { en: english[id], context: comments[id] || "" };
		const count = Object.keys(sheet).length;
		total += count;
		if (!count) continue;
		if (out) {
			fs.mkdirSync(out, { recursive: true });
			fs.writeFileSync(path.join(out, code + ".json"), JSON.stringify(sheet, null, "\t") + "\n");
		}
		console.log(code + ": " + count + " missing");
	}
	console.log(total ? (out ? "Worksheets written to " + out + ". Replace each object with its translated text, then run apply." : "Add --out <dir> to write worksheets.") : "Nothing to translate.");
}

function command_apply(args) {
	const domain = option(args, "--domain", "updates"),
		target = args.find((arg, i) => i > 0 && !arg.startsWith("--") && args[i - 1] !== "--domain");
	if (!target) throw new Error("apply needs a directory or a file");
	const files = fs.statSync(target).isDirectory() ? fs.readdirSync(target).filter((name) => name.endsWith(".json")).map((name) => path.join(target, name)) : [target];
	const known = new Set(locales());
	for (const file of files) {
		const code = path.basename(file, ".json");
		if (!known.has(code)) throw new Error(file + ": the file name must be a language code");
		const sheet = JSON.parse(fs.readFileSync(file, "utf8")),
			values = {};
		for (const id of Object.keys(sheet)) {
			const value = typeof sheet[id] === "string" ? sheet[id] : null;
			if (value === null) throw new Error(code + "/" + id + " is still untranslated");
			values[id] = value;
		}
		write_catalog_entries(domain, code, values);
		console.log(code + ": " + Object.keys(values).length + " written to " + domain + ".json");
	}
}

async function main(args) {
	const command = args[0];
	if (command === "draft") return command_draft(args);
	if (command === "sync") return command_sync(args);
	if (command === "check") return command_check(args);
	if (command === "translations") return command_translations(args);
	if (command === "apply") return command_apply(args);
	console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 11).join("\n").replace(/^\/\/ ?/gm, ""));
	process.exitCode = command ? 1 : 0;
}

if (require.main === module)
	main(process.argv.slice(2)).catch((error) => {
		console.error(error.message);
		process.exitCode = 2;
	});

module.exports = { write_english, unused_phrases, draft, load_definitions, load_data_js, load_state, load_notes, validate, coverage, merge, scan_notes, stamp, format_release, write_release, write_catalog_entries, is_release, today };
