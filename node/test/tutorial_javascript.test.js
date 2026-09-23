const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const nunjucks = require("nunjucks");
const localization = require("../../languages");
const practice = require("../../js/tutorial_code");
const { read, root, load, socketHandler, transactions } = require("./helpers/server_vm");

function runtime() {
	const c = vm.createContext({ console });
	vm.runInContext(read("docs/directory.js"), c);
	load(c, "adventure_functions.js", [
		"process_user_data",
		"migrate_tutorial_data",
		"tutorial_lesson_complete",
		"tutorial_onboarding_complete",
		"calculate_tutorial_step",
		"get_tutorial_track",
		"data_to_tutorial",
	]);
	load(c, "api.js", ["tutorial_api"]);
	return c;
}
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root));
const filters = read("filters.js");
vm.runInNewContext(filters.slice(0, filters.indexOf('env.addFilter("to_json"')), { env, nunjucks, localization });
function render(key) {
	return env.render("docs/tutorial/" + key + ".html", { domain: { language: "en" } });
}
function examples(html) {
	return Array.from(html.matchAll(/<div class="code [^"]+">([\s\S]*?)<\/div>/g), (match) =>
		match[1]
			.replaceAll("&lt;", "<")
			.replaceAll("&gt;", ">")
			.replaceAll("&quot;", '"')
			.replaceAll("&#39;", "'")
			.replaceAll("&amp;", "&"),
	);
}
const passes = (results) =>
	results.length > 0 &&
	results.every((r) => !r.errors.length && r.checks.length && r.checks.every((check) => check.pass));

test("all 14 rendered lessons have working solutions, useful failing starters and phrased readings", async () => {
	const c = runtime(),
		lessons = c.docs.tutorial.filter((lesson) => lesson.key.startsWith("js-"));
	assert.equal(lessons.length, 14);
	const english = localization.catalog("en");
	for (const lesson of lessons) {
		const html = render(lesson.key),
			snippets = examples(html),
			[starter, solution, reading] = snippets,
			id = lesson.key.slice(3);
		assert.ok(starter && solution && reading, lesson.key);
		assert.doesNotMatch(html, /{{|<details|<summary|load_documentation\('(?:character|events-character)'\)/);
		assert.equal((html.match(/class="code executeb"/g) || []).length, 1);
		for (const example of snippets.slice(2)) new vm.Script(example);
		const results = await practice.check(solution, id);
		assert.ok(results.length >= 1 && results.length <= 3, lesson.key + " keeps the checks bite-sized");
		assert.ok(passes(results), lesson.key + ": " + JSON.stringify(results));
		assert.equal(passes(await practice.check(starter, id)), false, lesson.key + " starter needs a real correction");
		for (const result of results) for (const check of result.checks) assert.ok(english[check.id], check.id);
		for (const match of read("docs/tutorial/" + lesson.key + ".html").matchAll(/phrase(?:_html)?\("([^"]+)"\)/g))
			assert.ok(english[match[1]], match[1]);
		assert.equal(lesson.continue_task, lesson.tasks[0]);
	}
	const reading = render("js-character");
	assert.match(reading, /An <em>object<\/em> groups related values/);
	assert.match(reading, /variable name, a dot, and the property name/);
});

test("practice runs fixed exercises once and keeps distinct inputs and cancellation checks", async () => {
	const solution = (id) => examples(render("js-" + id))[1];
	for (const id of ["hello", "values", "variables", "arrays", "loops"]) {
		const results = await practice.check(solution(id), id);
		assert.deepEqual(
			results.map((result) => result.name),
			["Mira"],
			id,
		);
	}
	for (const [id, names] of [
		["character", ["Mira", "Iris", "Orin"]],
		["decisions", ["Mira", "Bram", "Iris"]],
		["functions", ["Mira", "Bram", "Iris"]],
		["inventory", ["Mira", "Nox", "Iris"]],
		["timers", ["Mira", "Orin"]],
		["targets", ["Mira", "Nox", "Bram"]],
		["async", ["Bram", "Iris", "Orin"]],
		["events", ["Mira", "Bram", "Iris"]],
		["capstone", ["Bram", "Iris", "Orin"]],
	]) {
		const results = await practice.check(solution(id), id);
		assert.deepEqual(
			results.map((result) => result.name),
			names,
			id,
		);
		if (id === "timers") {
			assert.deepEqual(
				results.map((result) => result.logs.length),
				[3, 2],
			);
			assert.equal(results[1].note, "client.tutorial_code.scene.timers.1");
		}
	}
});

test("practice catches fixed values, wrong boundaries, ignored parameters and failed cleanup", async () => {
	const solution = (id) => examples(render("js-" + id))[1];
	for (const [id, from, to] of [
		["character", "character.max_hp - character.hp", "120"],
		["decisions", "character.hp <", "character.hp <="],
		["functions", "hero.hp < hero.max_hp", "character.hp < character.max_hp"],
		["inventory", "else total += item.q;", "else total += 1;"],
		["events", "character.remove(listener);", ""],
		["events", 'typeof data.damage !== "number"', "data.damage == null"],
		["events", 'typeof data.damage !== "number"', "!data.damage"],
		["capstone", "if (running) timer =", "timer ="],
	]) {
		assert.ok(solution(id).includes(from), id);
		assert.equal(passes(await practice.check(solution(id).replace(from, to), id)), false, id);
	}
	await assert.rejects(practice.check("x".repeat(20001), "hello"), /source_limit/);
	const raw = await practice.check('throw new Error("client.tutorial_code.retry");', "hello");
	assert.deepEqual(raw[0].errors[0], { raw: "Error: client.tutorial_code.retry" });
	assert.equal(passes(await practice.check('game_log("broken)', "hello")), false);
});

function oldComplete(c) {
	const lessons = c.docs.tutorial.slice(
		0,
		c.docs.tutorial.findIndex((l) => l.key === "js-hello"),
	);
	return {
		tutorial_version: 3,
		tutorial_step: lessons.length,
		tutorial_key: null,
		completed_tasks: lessons.flatMap((l) => l.tasks),
		code_list: { main: "keep me" },
	};
}

test("completed accounts continue into JavaScript, unfinished lessons stay put, and Continue stays skippable", async () => {
	for (const keyed of [true, false]) {
		const c = runtime(),
			info = oldComplete(c),
			oldStep = info.tutorial_step;
		if (!keyed) delete info.tutorial_key;
		const store = transactions(c, [{ _id: "IE_userdata-US_course", info }]);
		const get = () => c.process_user_data("US_course", structuredClone(store.records.get("IE_userdata-US_course")));
		assert.equal(get().info.tutorial_key, "js-hello");
		assert.equal(c.data_to_tutorial(get()).onboarding_finished, true);
		const res = { infs: [] };
		await c.tutorial_api({ user: { _id: "US_course" }, res, task: "read_js_hello" });
		assert.equal(get().info.tutorial_key, "js-hello", "a task packet cannot read a lesson");
		for (let i = oldStep; i < c.docs.tutorial.length; i++) {
			assert.equal(c.data_to_tutorial(get()).can_continue, true);
			await c.tutorial_api({ user: { _id: "US_course" }, res, step: i + 1, lesson: c.docs.tutorial[i].key });
		}
		assert.equal(c.data_to_tutorial(get()).finished, true);
		assert.equal(get().info.code_list.main, "keep me");
		info.completed_tasks.splice(info.completed_tasks.indexOf("killagoo"), 1);
		const unfinished = c.process_user_data("US_course", { info });
		assert.equal(unfinished.info.tutorial_key, "learntofight");
		assert.equal(c.data_to_tutorial(unfinished).onboarding_finished, false);
	}
});

test("the real reward handler keeps the onboarding milestone, verification and duplicate protection", async () => {
	const c = runtime(),
		info = oldComplete(c),
		packets = [],
		rewards = [];
	c.players = { course: { owner: "US_course", verified: true, auth_id: "verified-session" } };
	c.socket = { id: "course", emit: (...args) => packets.push(args) };
	c.exchange = (...args) => rewards.push(args);
	c.resend = () => {};
	const store = transactions(c, [
		{ _id: "US_course", info: {} },
		{ _id: "IE_userdata-US_course", info },
	]);
	const handler = socketHandler(c, "ureward");
	const settled = async () => {
		for (let i = 0; i < 100 && c.players.course.receiving_tutorial_reward; i++) await new Promise(setImmediate);
		assert.equal(c.players.course.receiving_tutorial_reward, undefined);
	};
	c.players.course.verified = false;
	handler({ name: "c0" });
	assert.equal(packets.at(-1)[1], "reward_notverified");
	assert.equal(rewards.length, 0);
	c.players.course.verified = true;
	const tasks = store.records.get("IE_userdata-US_course").info.completed_tasks;
	tasks.splice(tasks.indexOf("read_theend"), 1);
	handler({ name: "c0" });
	await settled();
	assert.equal(rewards.length, 0);
	tasks.push("read_theend");
	handler({ name: "c0" });
	handler({ name: "c0" });
	await settled();
	assert.equal(rewards.length, 1);
	assert.equal(store.records.get("IE_userdata-US_course").info.tutorial_key, "js-hello");
	handler({ name: "c0" });
	await settled();
	assert.equal(rewards.length, 1);
	assert.equal(packets.at(-1)[1], "reward_already");
});

test("course articles are discoverable through MCP and the docs sitemap", async () => {
	const c = runtime();
	c.shtml = (file) => env.render(file, { domain: { language: "en" } });
	load(c, "mcp_api.js", ["mcp_api_doc_entries", "mcp_api_list_docs", "mcp_api_get_doc", "mcp_api_html_to_text"]);
	const listed = await c.mcp_api_list_docs({ query: "JavaScript crash course" });
	assert.equal(listed.count, 14);
	for (const entry of listed.articles) {
		const article = await c.mcp_api_get_doc({ name: entry.name });
		assert.equal(article.success, true);
		assert.match(article.content, /game_log/);
	}
	const { get_seo_paths } = require("../../seo_paths");
	const paths = get_seo_paths({ docs: c.docs, guide_articles: [], code_articles: [], data: {}, definitions: {} });
	for (const entry of listed.articles) assert.ok(paths.includes("/docs/tutorial/" + entry.name));
});

test("practice attaches to the desktop browser even when Node module globals are present", () => {
	const c = vm.createContext({ module: { exports: {} }, document: {}, addEventListener() {} });
	vm.runInContext(read("js/tutorial_code.js"), c);
	assert.equal(typeof c.TutorialCode.mount, "function");
	assert.equal(typeof c.TutorialCode.run, "function");
});
