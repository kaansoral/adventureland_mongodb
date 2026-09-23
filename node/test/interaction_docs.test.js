const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { read, extract } = require("./helpers/server_vm");

const root = path.resolve(__dirname, "../..");

function loadGlobal(relativePath, name) {
	const context = { console };
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, { filename: relativePath });
	return context[name];
}

function articlePath(name) {
	const candidates = [path.join(root, "docs/guide", name + ".html"), path.join(root, "docs/articles", name + ".html")];
	return candidates.find((candidate) => fs.existsSync(candidate));
}

const docs = loadGlobal("docs/directory.js", "docs");
const npcs = loadGlobal("design/npcs.js", "npcs");
const maps = loadGlobal("design/maps.js", "maps");

test("CODE search finds VS Code setup in both search interfaces", () => {
	const context = vm.createContext({
		G: { docs, items: {} },
		is_array: Array.isArray,
		in_arr: (value, array) => array.includes(value),
		phrase: { html: (id) => id },
		csearch_value: undefined,
		codesearch_value: undefined,
	});
	vm.runInContext(extract(read("js/html.js"), "csearch_logic"), context);
	for (const place of [undefined, "ui"]) {
		for (const value of [
			"vscode",
			"VS Code",
			"VSCODE",
			"Visual Studio Code",
			"plugin",
			"extension",
			"Cursor",
			"sync",
		]) {
			let output;
			context.$ = (selector) => ({
				val: () => value,
				hide() {},
				show() {},
				remove() {},
				html(html) {
					assert.equal(selector, place === "ui" ? "#codelog" : ".cdocssearch");
					output = html;
				},
			});
			context.csearch_logic(place);
			assert.ok(output.includes('open_guide("8-code-slots-and-files"'), value);
		}
	}
	const article = read("docs/articles/8-code-slots-and-files.html");
	const phrases = require("../../languages/en/docs");
	const link = "docs.articles.8-code-slots-and-files.type-codes-in-chat-or-open-adventure-land";
	assert.ok(article.includes(link));
	assert.match(phrases[link], /href='\/vscode'/);
});

test("CODE search preserves function, game-data and regular-expression searches", () => {
	let value, output;
	const context = vm.createContext({
		G: { docs, items: {} },
		is_array: Array.isArray,
		in_arr: (entry, array) => array.includes(entry),
		phrase: { html: (id) => id },
		codesearch_value: undefined,
		$: () => ({
			val: () => value,
			remove() {},
			html(html) {
				output = html;
			},
		}),
	});
	vm.runInContext(extract(read("js/html.js"), "csearch_logic"), context);
	for (const [query, expected] of [
		["SEND_GOLD", 'name:"send_gold"'],
		["[F]", 'name:"send_gold"'],
		["[G]", 'render_data_reference([],"items")'],
		["^send_(gold|item)$", 'name:"send_item"'],
		["[", "interface.csearch_logic.none_found"],
		["(", "interface.csearch_logic.none_found"],
		["", 'name:"send_gold"'],
	]) {
		value = query;
		context.csearch_logic("ui");
		assert.ok(output.includes(expected), query);
	}
});

test("MCP docs search shares the VS Code aliases", async () => {
	const context = vm.createContext({ docs });
	const source = read("mcp_api.js");
	vm.runInContext(extract(source, "mcp_api_doc_entries") + "\n" + extract(source, "mcp_api_list_docs"), context);
	for (const query of ["vscode", "VS Code", "Visual Studio Code", "plugin", "extension", "Cursor"]) {
		const result = await context.mcp_api_list_docs({ query });
		const article = result.articles.find((entry) => entry.name === "8-code-slots-and-files");
		assert.equal(article?.docs_url, "https://adventure.land/docs/guide/code/8-code-slots-and-files", query);
	}
});

function decodeCodeHtml(source) {
	return source
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

test("the schedule guide uses its own clock through the item renderer without a character", () => {
	const G = require("./helpers/design");
	const context = vm.createContext({
		G,
		window: { desktop: false },
		randomStr: () => "schedule_test",
		sprite: () => "",
		$: (selector) => ({
			html(html) {
				if (selector !== ".events-tracker") return;
				assert.ok(html.includes(G.imagesets.rawitems.file));
				assert.ok(html.includes("margin-left: -720px"));
				assert.ok(html.includes("margin-top: -160px"));
				assert.ok(html.includes("height: 40px; width: 40px"));
				context.rendered = true;
			},
		}),
	});
	assert.deepEqual(Array.from(G.positions.schedule_clock), ["rawitems", 18, 4]);
	assert.equal(G.items.tracker.skin, "tracker");
	assert.notDeepEqual(Array.from(G.positions.tracker), Array.from(G.positions.schedule_clock));
	vm.runInContext(extract(read("js/html.js"), "item_container"), context);
	const article = read("docs/guide/events-and-home.html");
	vm.runInContext(article.match(/<script>([\s\S]*?)<\/script>/)[1], context);
	assert.equal(context.rendered, true);
	const phrases = require("../../languages/en/docs");
	for (const id of ["schedule-open-the-clock-to-inspect-planned-events", "read-schedule-status"])
		assert.ok(phrases["docs.guide.events-and-home." + id].includes("events-tracker"));
});

test("every placed NPC role has an interaction classification", () => {
	for (const [npcId, npc] of Object.entries(npcs)) {
		if (!npc.role) continue;
		const key = docs.interaction_map.npc_ids[npcId] || docs.interaction_map.npc_roles[npc.role];
		assert.ok(key, `${npcId} (${npc.role}) is not classified`);
		assert.ok(docs.interactions[key], `${npcId} maps to unknown interaction ${key}`);
	}

	for (const npcId of Object.keys(docs.interaction_map.npc_ids)) {
		assert.ok(npcs[npcId], `interaction map references unknown NPC ${npcId}`);
	}
});

test("quirks, machines, zones, and door types are classified", () => {
	const found = { quirks: new Set(), machines: new Set(), zones: new Set(), doors: new Set() };
	for (const map of Object.values(maps)) {
		for (const quirk of map.quirks || []) found.quirks.add(quirk[4]);
		for (const machine of map.machines || []) found.machines.add(machine.type);
		for (const zone of map.zones || []) found.zones.add(zone.type);
		for (const door of map.doors || []) found.doors.add(door[7] || "ordinary");
	}

	for (const [kind, values] of Object.entries(found)) {
		for (const value of values) {
			const key = docs.interaction_map[kind][value];
			assert.ok(key, `${kind} value ${value} is not classified`);
			assert.ok(docs.interactions[key], `${kind} value ${value} maps to unknown interaction ${key}`);
		}
	}
});

test("active interactions have finished articles and documented CODE functions", () => {
	const runner = fs.readFileSync(path.join(root, "js/runner_functions.js"), "utf8");
	for (const [key, interaction] of Object.entries(docs.interactions)) {
		if (interaction.status) continue;
		assert.equal(typeof interaction.proximity, "boolean", `${key} does not declare proximity behavior`);
		const file = articlePath(interaction.article);
		assert.ok(file, `${key} is missing article ${interaction.article}`);
		const html = fs.readFileSync(file, "utf8");
		assert.doesNotMatch(html, /work in progress|\bWIP\b/i, `${interaction.article} is still marked unfinished`);

		for (const name of interaction.functions || []) {
			assert.ok(docs.functions.includes(name), `${key} function ${name} is absent from docs.functions`);
			assert.ok(
				fs.existsSync(path.join(root, "docs/functions", name + ".html")),
				`${key} function ${name} has no reference article`,
			);
			assert.match(
				runner,
				new RegExp(`function\\s+${name}\\s*\\(`),
				`${key} function ${name} is absent from runner_functions.js`,
			);
		}
	}
});

test("item-maintenance guide names every service NPC's placed map", () => {
	const html = fs.readFileSync(path.join(root, "docs/guide/item-maintenance.html"), "utf8");
	for (const npcId of ["locksmith", "scrollsmith"]) {
		const placements = Object.values(maps).filter((map) => (map.npcs || []).some((npc) => npc.id === npcId));
		assert.ok(placements.length, `${npcId} is not placed on a map`);
		for (const map of placements) assert.match(html, new RegExp(`${npcs[npcId].name} · ${map.name}`));
	}
});

test("guide CODE examples are valid async JavaScript", () => {
	const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
	for (const filename of fs.readdirSync(path.join(root, "docs/guide"))) {
		if (!filename.endsWith(".html")) continue;
		const html = fs.readFileSync(path.join(root, "docs/guide", filename), "utf8");
		for (const match of html.matchAll(/<div class=["']code["']>([\s\S]*?)<\/div>/g)) {
			assert.doesNotThrow(
				() => new AsyncFunction(decodeCodeHtml(match[1])),
				`${filename} contains an invalid CODE example`,
			);
		}
	}
});

test("every tutorial lesson has finished content and valid tasks", () => {
	const keys = new Set();
	for (const lesson of docs.tutorial.concat(docs.merchant_tutorial || [])) {
		assert.ok(!keys.has(lesson.key), `duplicate tutorial key ${lesson.key}`);
		keys.add(lesson.key);
		const file = path.join(root, "docs/tutorial", lesson.key + ".html");
		assert.ok(fs.existsSync(file), `tutorial lesson ${lesson.key} has no article`);
		assert.doesNotMatch(
			fs.readFileSync(file, "utf8"),
			/work in progress|\bWIP\b/i,
			`${lesson.key} is still marked unfinished`,
		);
		assert.ok(lesson.tasks.length, `${lesson.key} needs a gameplay task or a Continue task`);
		if (lesson.continue_task) assert.ok(lesson.tasks.includes(lesson.continue_task));
		for (const task of lesson.tasks)
			assert.ok(docs.tasks[task] || task === lesson.continue_task, `${lesson.key} references unknown task ${task}`);
	}
});

test("tutorial progress exposes every pending task and preserves the legacy next task", () => {
	const source = fs.readFileSync(path.join(root, "adventure_functions.js"), "utf8");
	const start = source.indexOf("function migrate_tutorial_data");
	const end = source.indexOf("// ==================== SIGNUPTH", start);
	const context = { console, docs: { tutorial: [{ tasks: ["a", "b", "c"] }, { tasks: [] }] } };
	vm.createContext(context);
	vm.runInContext(source.slice(start, end), context);

	const data = { info: { tutorial_step: 0, completed_tasks: ["b"] } };
	assert.deepEqual(Array.from(context.data_to_tutorial(data).pending), ["a", "c"]);
	assert.equal(context.data_to_tutorial(data).task, "a");
	assert.equal(context.data_to_tutorial(data).progress, 33);

	data.info.tutorial_step = 99;
	context.calculate_tutorial_step(data);
	assert.equal(data.info.tutorial_step, 0, "progress cannot skip an incomplete lesson");

	const legacy = { info: { tutorial_step: 7, completed_tasks: [] } };
	context.migrate_tutorial_data(legacy);
	assert.equal(legacy.info.tutorial_step, 14);
	assert.equal(legacy.info.tutorial_version, 3);
	assert.equal(legacy.info.tutorial_key, "theend");
	assert.ok(legacy.info.completed_tasks.includes("events"));
});

test("tutorial reward waits for a mounted character and uses the persisted tutorial", () => {
	const client = fs.readFileSync(path.join(root, "js/functions.js"), "utf8");
	const server = fs.readFileSync(path.join(root, "node/server.js"), "utf8");
	assert.match(client, /!character \|\| !X \|\| !X\.tutorial \|\| !X\.tutorial\.finished/);
	assert.match(server, /!docs\.rewards\[data\.name\]/);
	assert.doesNotMatch(server, /G\.docs\.rewards/);
	assert.match(server, /tx_get\("IE_userdata-" \+ A\.owner\)/);
});
