const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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

function decodeCodeHtml(source) {
	return source
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

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
	for (const lesson of docs.tutorial) {
		assert.ok(!keys.has(lesson.key), `duplicate tutorial key ${lesson.key}`);
		keys.add(lesson.key);
		const file = path.join(root, "docs/tutorial", lesson.key + ".html");
		assert.ok(fs.existsSync(file), `tutorial lesson ${lesson.key} has no article`);
		assert.doesNotMatch(
			fs.readFileSync(file, "utf8"),
			/work in progress|\bWIP\b/i,
			`${lesson.key} is still marked unfinished`,
		);
		for (const task of lesson.tasks) assert.ok(docs.tasks[task], `${lesson.key} references unknown task ${task}`);
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
	assert.equal(legacy.info.tutorial_version, 2);
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
