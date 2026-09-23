const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const nunjucks = require("nunjucks");
const localization = require("../../languages");
const { read, load, transactions, root, socketHandler } = require("./helpers/server_vm");
const { buildComparisons, averageHit } = require("./helpers/tutorial_comparison");
const comparisons = require("../../docs/tutorial/comparisons.json");

test("bank swaps credit storage only when an inventory item actually enters the bank", () => {
	const condition = read("js/game.js")
		.split("\n")
		.find((line) => line.includes("data.bank_action") && line.includes('tut("store")'));
	for (const quantity of [1, 10]) {
		for (const kind of ["empty slot", "occupied slot", "withdrawal", "empty swap", "blocked", "placeholder"]) {
			const item = { name: kind === "placeholder" ? "placeholder" : "hpot0", q: quantity };
			if (kind === "blocked") item.b = true;
			const inv = ["withdrawal", "empty swap"].includes(kind) ? null : item;
			const stored = ["occupied slot", "withdrawal"].includes(kind) ? { name: "mpot0", q: 2 } : null;
			const player = {
				map: "bank",
				isize: 1,
				items: [inv],
				citems: [],
				user: { gold: 0, items0: [stored] },
				cuser: { items0: [] },
			};
			let response,
				credited = false;
			const c = vm.createContext({
				players: { test: player },
				socket: { id: "test", emit() {} },
				bank_packs: { items0: ["bank"] },
				max: Math.max,
				min: Math.min,
				server_log() {},
				resend() {},
				cache_item: (item) => item,
				success_response: (data) => {
					response = { ...data, place: "bank" };
				},
				fail_response: (reason) => {
					response = { failed: true, place: "bank", reason };
				},
			});
			socketHandler(c, "bank")({ operation: "swap", inv: 0, str: 0, pack: "items0" });
			vm.runInNewContext(condition, {
				data: response,
				tut: () => {
					credited = true;
				},
			});
			const expected = ["empty slot", "occupied slot"].includes(kind);
			assert.equal(credited, expected, kind);
			if (expected) {
				assert.equal(player.user.items0[0], item);
				assert.equal(response.bank_action, "swap", "preserve the public response action");
			}
		}
	}
	for (const data of [
		{ place: "bank", bank_action: "store" },
		{ place: "bank", operation: "move" },
		{ place: "bank", bank_action: "swap" },
	]) {
		let credited = false;
		vm.runInNewContext(condition, {
			data,
			tut: () => {
				credited = true;
			},
		});
		assert.equal(credited, data.bank_action === "store");
	}
});

function context() {
	const c = vm.createContext({ console });
	vm.runInContext(read("docs/directory.js"), c);
	load(c, "adventure_functions.js", [
		"process_user_data",
		"migrate_tutorial_data",
		"get_tutorial_track",
		"calculate_tutorial_step",
		"tutorial_lesson_complete",
		"tutorial_onboarding_complete",
		"data_to_tutorial",
	]);
	load(c, "api.js", ["tutorial_api", "reset_tutorial_api"]);
	return c;
}

test("beginner directions match the sellers, stand price and tool recipes", () => {
	const G = require("./helpers/design");
	for (const [id, name, items] of [
		["standmerchant", "Divian", ["stand0"]],
		["basics", "Gabriel", ["coat", "staff", "blade"]],
		["scrolls", "Lucas", ["scroll0", "cscroll0", "strscroll", "intscroll", "dexscroll"]],
		["fancypots", "Ernis", ["hpot0", "mpot0"]],
	]) {
		assert.equal(G.npcs[id].name, name);
		assert.ok(G.maps.main.npcs.some((npc) => npc.id === id));
		for (const item of items) assert.ok(G.npcs[id].items.includes(item), name + ": " + item);
	}
	assert.equal(G.items.stand0.g, 40000);
	assert.equal(G.craft.rod.cost, 100);
	assert.equal(G.craft.pickaxe.cost, 100);
	assert.deepEqual(JSON.parse(JSON.stringify(G.craft.rod.items)), [
		[1, "staff"],
		[1, "spidersilk"],
	]);
	assert.deepEqual(JSON.parse(JSON.stringify(G.craft.pickaxe.items)), [
		[1, "staff"],
		[1, "spidersilk"],
		[1, "blade"],
	]);
	assert.ok(G.drops.monsters.spider.some((drop) => drop[1] === "spidersilk"));
	assert.equal(G.skills.fishing.level, 16);
	assert.equal(G.skills.fishing.mp, 120);
});

test("tutorial travel buttons confirm real destinations and stay absent without a character", () => {
	const G = require("./helpers/design"),
		targets = [];
	for (const file of fs.readdirSync(path.join(root, "docs/tutorial")).filter((file) => file.endsWith(".html"))) {
		const source = read("docs/tutorial/" + file);
		assert.doesNotMatch(source, /code_eval\('smart_move/);
		for (const match of source.matchAll(/class="tutorial-travel" data-type="([^"]+)" data-target="([^"]+)"/g))
			targets.push({ type: match[1], id: match[2], html: "" });
	}
	assert.ok(targets.length > 25);
	const calls = [];
	let confirm;
	const c = vm.createContext({
		G,
		window: {},
		event: {},
		btc() {},
		html_escape: (s) => s,
		phrase: { html: (id) => id },
		hide_modals() {},
		show_confirm: (_, yes, no, callback) => {
			confirm = callback;
		},
		call_code_function_f: (...args) => calls.push(args),
		$: (selector) =>
			typeof selector === "string"
				? { each: (callback) => targets.forEach((target) => callback.call(target)) }
				: {
						attr: (key) => (key === "data-type" ? selector.type : selector.id),
						empty: () => {
							selector.html = "";
						},
						html: (value) => {
							selector.html = value;
						},
					},
	});
	load(c, "js/html.js", ["render_tutorial_travel", "smart_smart_move"]);
	c.render_tutorial_travel();
	assert.ok(targets.every((target) => !target.html));
	c.window.character = { ctype: "merchant" };
	c.render_tutorial_travel();
	for (const target of targets) {
		assert.match(target.html, /gamebutton gamebutton-small/);
		assert.ok(
			target.html.includes(
				(target.type === "npc" ? G.npcs : target.type === "map" ? G.maps : G.monsters)[target.id].name,
			),
		);
		if (target.type === "npc")
			assert.ok(
				Object.values(G.maps).some((map) => !map.ignore && (map.npcs || []).some((npc) => npc.id === target.id)),
			);
		const before = calls.length;
		vm.runInContext(target.html.match(/onclick='([^']+)'/)[1], c);
		assert.equal(calls.length, before, "travel must wait for confirmation");
		confirm();
		assert.deepEqual(calls.at(-1), ["smart_move", target.id]);
	}
	delete c.window.character;
	c.render_tutorial_travel();
	assert.ok(
		targets.every((target) => !target.html),
		"rerender removes stale character actions",
	);
});

test("translated tutorial references use written documentation, not raw source", () => {
	for (const file of fs.readdirSync(path.join(root, "docs/tutorial")).filter((file) => file.endsWith(".html"))) {
		const source = read("docs/tutorial/" + file);
		assert.doesNotMatch(source, /class="[^"]*\brref\b/, file + " must use the existing function tag style");
	}
	for (const { code } of localization.languages) {
		const catalog =
			code === "en" ? require("../../languages/en/docs") : JSON.parse(read("languages/" + code + "/docs.json"));
		for (const [key, text] of Object.entries(catalog)) {
			if (key.startsWith("docs.tutorial.")) assert.ok(!text.includes("render_function_reference("), code + ": " + key);
		}
	}
});

test("all displayed build numbers match the real server stat calculation", () => {
	assert.deepEqual(buildComparisons(), comparisons);
	const G = require("./helpers/design");
	assert.equal(comparisons.target, "boar");
	for (const build of Object.values(comparisons.classes)) {
		for (const row of build.rows) assert.ok(G.monsters[comparisons.target].hp > row.hit * 10);
		for (let i = 1; i < build.rows.length; i++) assert.ok(build.rows[i].dps > build.rows[i - 1].dps);
		for (const slot of ["mainhand", "helmet", "chest", "pants", "gloves", "shoes"])
			assert.deepEqual(build.rows[2].slots[slot], build.rows[3].slots[slot]);
	}
});

test("average hit includes both rounding stages from the real combat handler", () => {
	const G = require("./helpers/design"),
		source = read("node/server.js");
	const start = source.indexOf("i_attack = attack = ceil(combo_m * attack");
	const body = source.slice(start, source.indexOf("if (target.incdmgamp)", start));
	for (const attack of [53, 200, 437])
		for (const defense of [-50, 0, 100]) {
			const low = attack * 0.9,
				high = attack * 1.1;
			let total = 0;
			for (let roll = Math.ceil(low); roll <= Math.ceil(high); roll++) {
				const left = Math.max(low, roll - 1),
					right = Math.min(high, roll);
				if (right <= left) continue;
				const c = vm.createContext({
					attack,
					i_attack: 0,
					combo_m: 1,
					dmg_mult: 1,
					ceil: Math.ceil,
					Math: { random: () => ((left + right) / 2 / attack - 0.9) / 0.2 },
					damage_multiplier: G.damage_multiplier,
					target: { armor: defense },
					attacker: {},
					info: { apiercing: 0 },
					defense: "armor",
					pierce: "apiercing",
				});
				vm.runInContext(body, c);
				total += (c.attack * (right - left)) / (high - low);
			}
			assert.ok(Math.abs(total - averageHit(attack, defense)) < 1e-9);
		}
});

test("mail precedes hunts and only opening the mailbox completes its task, even when empty", () => {
	const c = context(),
		lessons = c.docs.tutorial,
		index = lessons.findIndex((lesson) => lesson.key === "mail"),
		credits = [];
	assert.equal(lessons[index + 1].key, "hunting");
	assert.deepEqual(Array.from(lessons[index].tasks), ["mail"]);
	assert.equal(lessons[index].continue_task, undefined);
	const ui = {
		html() {
			return this;
		},
		parent() {
			return this;
		},
		find() {
			return this;
		},
		removeClass() {},
		addClass() {},
	};
	Object.assign(c, { friends_inside: "friends", $: () => ui, tut: (task) => credits.push(task), api_call() {} });
	load(c, "js/html.js", ["load_mail"]);
	c.load_mail({ mail: [] });
	assert.equal(credits.length, 0, "a response after leaving the mailbox does not count");
	c.load_mail();
	assert.equal(credits.length, 0, "a failed or pending mailbox request does not count");
	c.load_mail({ mail: [] });
	assert.deepEqual(credits, ["mail"]);
});

test("the new mail lesson preserves finished tutorials, but is required after a reset", async () => {
	const c = context(),
		lessons = c.docs.tutorial;
	const data = c.process_user_data("US_tutorial", {
		_id: "IE_userdata-US_tutorial",
		info: {
			tutorial_version: 3,
			tutorial_key: null,
			tutorial_step: lessons.length - 1,
			completed_tasks: lessons.filter((lesson) => lesson.key !== "mail").flatMap((lesson) => lesson.tasks),
		},
	});
	assert.equal(c.data_to_tutorial(data).finished, true);
	assert.ok(data.info.completed_tasks.includes("mail"));
	const store = transactions(c, [data]);
	await c.reset_tutorial_api({ user: "US_tutorial", res: { infs: [] } });
	const reset = c.process_user_data("US_tutorial", store.records.get(data._id));
	assert.ok(!reset.info.completed_tasks.includes("mail"));
	assert.equal(reset.info.tutorial_version, 4);
});

test("Tracktrix follows hunts and previously completed tutorials can continue without owning it", () => {
	const G = require("./helpers/design");
	assert.equal(G.tokens.monstertoken.tracker, 4);
	assert.deepEqual(JSON.parse(JSON.stringify(G.monsters.goo.achievements.slice(0, 2))), [
		[10, "stat", "hp", 5],
		[100, "stat", "hp", 10],
	]);
	const c = context(),
		lessons = c.docs.tutorial;
	const index = lessons.findIndex((lesson) => lesson.key === "tracktrix");
	assert.equal(lessons[index - 1].key, "hunting");
	const data = c.process_user_data("US_tutorial", {
		info: {
			tutorial_version: 3,
			tutorial_key: null,
			tutorial_step: lessons.length - 1,
			completed_tasks: lessons.filter((lesson) => lesson.key !== "tracktrix").flatMap((lesson) => lesson.tasks),
		},
	});
	const progress = c.data_to_tutorial(data);
	assert.equal(progress.step, index);
	assert.equal(progress.can_continue, true);
	assert.equal(progress.task, "read_tracktrix");
});

test("merchant lessons use their own progress and cannot complete or reset the adventurer tutorial", async () => {
	const c = context(),
		store = transactions(c, []),
		res = { infs: [] };
	let last;
	for (let step = 0; step < c.docs.merchant_tutorial.length; step++) {
		last = await c.tutorial_api({
			user: "US_tutorial",
			track: "merchant",
			step: step + 1,
			lesson: c.docs.merchant_tutorial[step].key,
			res,
		});
		assert.equal(last.success, true);
		assert.equal(res.infs.at(-2).step, step + 1);
		assert.equal(res.infs.at(-2).track, "merchant");
	}
	const saved = store.records.get("IE_userdata-US_tutorial");
	assert.equal(saved.info.tutorial_key, "lore");
	assert.deepEqual(saved.info.completed_tasks, []);
	assert.equal(c.data_to_tutorial(saved, "merchant").finished, true);
	await c.reset_tutorial_api({ user: "US_tutorial", track: "merchant", res });
	assert.equal(store.records.get(saved._id).info.merchant_tutorial.tutorial_key, "merchant-start");
	assert.equal((await c.tutorial_api({ user: "US_tutorial", track: "invalid", res })).failed, true);
});

test("old completed tutorials show the added lessons without granting credit for them", () => {
	const c = context();
	const oldKeys = [
		"helloworld",
		"learntofight",
		"interface",
		"skills-recovery",
		"shops",
		"upgrade",
		"compound",
		"bank",
		"move",
		"crafting-exchanges",
		"parties-friends",
		"hellocode",
		"multiple-characters",
		"events-status",
		"theend",
	];
	const done = oldKeys.flatMap((key) =>
		c.docs.tutorial.find((lesson) => lesson.key === key).tasks.filter((task) => !task.startsWith("read_")),
	);
	const data = c.process_user_data("US_tutorial", {
		info: { tutorial_version: 2, tutorial_step: 15, completed_tasks: done },
	});
	assert.equal(data.info.tutorial_key, "lore");
	for (const task of [
		"read_lore",
		"read_farming",
		"addstats",
		"read_gear_comparison",
		"read_accessory_comparison",
		"read_hunting",
	])
		assert.ok(!data.info.completed_tasks.includes(task));
});

test("MCP discovers the lore, first-goals and merchant guides through the normal directory", () => {
	const c = context();
	load(c, "mcp_api.js", ["mcp_api_doc_entries"]);
	const entries = c.mcp_api_doc_entries();
	for (const name of ["lore", "first-goals", "merchant"]) {
		const entry = entries.find((entry) => entry.name === name);
		assert.equal(entry.docs_url, "https://adventure.land/docs/guide/" + name);
	}
});

test("every new article renders with translated phrases and each locale has five comic images", () => {
	const c = context();
	const files = [
		"lore",
		"farming",
		"stat-scrolls",
		"gear-comparison",
		"accessory-comparison",
		"hunting",
		"tracktrix",
		"mail",
		...c.docs.merchant_tutorial.map((lesson) => lesson.key),
	]
		.map((key) => "docs/tutorial/" + key + ".html")
		.concat([
			"docs/guide/lore.html",
			"docs/guide/merchant.html",
			"docs/guide/first-goals.html",
			"docs/guide/tracktrix.html",
		]);
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root));
	env.addGlobal("tutorial_comparisons", () => comparisons);
	env.addGlobal("task_name", (key) => key);
	env.addFilter("to_json", JSON.stringify);
	for (const { code } of localization.languages) {
		const catalog =
			code === "en"
				? localization.catalog(code)
				: Object.assign(
						{},
						...["docs", "definitions", "interface", "language"].map((domain) =>
							JSON.parse(read("languages/" + code + "/" + domain + ".json")),
						),
					);
		for (const file of files) {
			const source = read(file);
			for (const match of source.matchAll(/phrase(?:_html)?\(["']([^"']+)/g))
				assert.ok(catalog[match[1]], code + ": " + match[1]);
			const html = env.render(file, {
				domain: { language: code },
				phrase: (key, args) => localization.phrase(key, args || {}, code),
				phrase_html: (key) => localization.phrase_html(key, {}, code),
			});
			assert.doesNotMatch(html, /{{|<details|<summary/);
			if (file.endsWith("/lore.html")) assert.ok(html.includes("/images/tutorial/lore/" + code + "/page-01.jpg"));
		}
		for (const label of [
			"target",
			"hit",
			"dps",
			"increase",
			"gear_plain",
			"gear_upgraded",
			"gear_statted",
			"accessory_plain",
			"accessory_improved",
		])
			assert.ok(catalog["interface.tutorial.comparison." + label], code + ": " + label);
		for (let page = 1; page <= 5; page++) {
			const image = fs.readFileSync(path.join(root, "images/tutorial/lore", code, "page-0" + page + ".jpg"));
			assert.equal(image.readUInt16BE(0), 0xffd8);
		}
	}
});

test("new visual entry points return before touching graphics in headless mode", () => {
	const c = vm.createContext({ window: { no_graphics: true } });
	load(c, "js/html.js", [
		"render_tutorial_items",
		"render_tutorial_travel",
		"turn_tutorial_lore",
		"render_tutorial_comparison",
	]);
	c.render_tutorial_items();
	c.render_tutorial_travel();
	c.turn_tutorial_lore(1);
	c.render_tutorial_comparison(comparisons, false);
});

test("farming shows each class's starter weapon, defaults to blade, and leaves other items alone", () => {
	const G = require("./helpers/design");
	for (const type of [...Object.keys(G.classes), "unknown", null]) {
		const shown = [];
		const c = vm.createContext({
			G,
			window: { character: type ? { ctype: type } : undefined },
			character: { ctype: type },
			item_container: (_, item) => {
				shown.push(item.name);
				return "item";
			},
			$: (selector) =>
				typeof selector === "string"
					? {
							each: (callback) => {
								if (selector === ".tutorial-item") {
									callback.call({ item: "blade", weapon: "true" });
									callback.call({ item: "hpot0" });
								}
							},
						}
					: { attr: (key) => (key === "data-item" ? selector.item : selector.weapon), css: () => ({ html() {} }) },
		});
		load(c, "js/html.js", ["render_tutorial_items", "render_tutorial_travel"]);
		c.render_tutorial_items();
		assert.deepEqual(shown, [G.classes[type]?.base_slots?.mainhand?.name || "blade", "hpot0"]);
	}
});

test("comparison clicks preserve the exact item level and stat; stat scrolls match the preview class", () => {
	const G = require("./helpers/design");
	for (const type of [...Object.keys(comparisons.classes), undefined, "unknown"])
		for (const accessories of [false, true]) {
			const icons = [],
				shown = [];
			const c = vm.createContext({
				G,
				window: {},
				phrase: { html: (s) => s, definition: (_, type) => type },
				$: () => ({ html() {} }),
				item_container: (options, actual) => {
					icons.push({ options, actual });
					return "icon";
				},
				render_item: (_, args) => {
					shown.push(args.actual);
					return "popup";
				},
				show_modal() {},
				stpr() {},
				event: {},
			});
			if (type) c.window.character = c.character = { ctype: type };
			load(c, "js/html.js", ["render_tutorial_comparison", "render_item_popup"]);
			c.render_tutorial_comparison(comparisons, accessories);
			for (const icon of icons) {
				assert.equal(icon.options.draggable, false);
				vm.runInContext(icon.options.onclick, c);
				const expected = { ...icon.actual };
				if (expected.level === undefined) expected.level = 0;
				assert.deepEqual(JSON.parse(JSON.stringify(shown.at(-1))), expected);
			}
			const build = comparisons.classes[type] || comparisons.classes.mage;
			assert.equal(icons.filter(({ actual }) => actual.name === build.stat + "scroll").length, accessories ? 0 : 1);
		}
});

test("comic Skip and Continue credit only the current lore lesson; guide and completed reviews just close", () => {
	for (const scenario of [
		{ active: true, step: 0, ready: true, credit: true },
		{ active: false, step: 0, ready: true },
		{ active: true, step: 1, ready: true },
		{ active: true, step: 0, ready: false },
	]) {
		const calls = [];
		const c = vm.createContext({
			last_rendered_track: "",
			last_rendered_step: 0,
			get_tutorial_view: () => ({
				lessons: [{ key: "lore" }],
				progress: { step: scenario.step, can_continue: scenario.ready },
			}),
			$: () => ({ closest: () => ({ attr: () => String(scenario.active) }) }),
			api_call: (name, args) => calls.push({ name, args }),
			hide_modal: () => calls.push("close"),
		});
		load(c, "js/html.js", ["finish_tutorial_lore", "continue_tutorial"]);
		c.finish_tutorial_lore();
		assert.equal(calls.length, scenario.credit ? 2 : 1);
		if (scenario.credit)
			assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { name: "tutorial", args: { step: 1, lesson: "lore" } });
		assert.equal(calls.at(-1), "close");
	}
});

test("travel credit does not depend on whether a player packet already changed the rendered map", () => {
	const source = read("js/game.js");
	const start = source.indexOf('socket.on("new_map", function (data) {');
	const end = source.indexOf("current_map = data.name;", start);
	const body = source.slice(source.indexOf("{", start) + 1, end);
	for (const rendered of ["bank", "main"]) {
		const calls = [];
		const c = vm.createContext({
			current_map: rendered,
			tutorial_map: "bank",
			character: {},
			data: { name: "main" },
			tut: (name) => calls.push(name),
		});
		vm.runInContext(body, c);
		vm.runInContext(body, c);
		assert.deepEqual(calls, ["travel"]);
	}
});

test("tutorial credit retries transient failures without replaying gameplay, and stops after leaving the lesson", async () => {
	const timers = [],
		calls = [];
	const c = vm.createContext({
		console,
		X: { tutorial: { task: "addstats", pending: ["addstats"] } },
		tutorial_tasks_in_flight: {},
		setTimeout: (fn) => timers.push(fn),
		api_call: (method, args) => {
			calls.push(args.task);
			return calls.length === 1
				? Promise.reject({ reason: "network_error", status: 502 })
				: Promise.resolve({ success: true });
		},
	});
	load(c, "js/functions.js", ["tut"]);
	c.tut("addstats");
	await new Promise(setImmediate);
	c.tut("addstats");
	assert.equal(calls.length, 1);
	timers.shift()();
	await new Promise(setImmediate);
	assert.deepEqual(calls, ["addstats", "addstats"]);
	assert.deepEqual(Object.keys(c.tutorial_tasks_in_flight), []);
	c.api_call = () => Promise.reject({ reason: "network_error" });
	c.tut("addstats");
	await new Promise(setImmediate);
	c.X.tutorial = { task: "read_gear_comparison", pending: ["read_gear_comparison"] };
	timers.shift()();
	assert.deepEqual(Object.keys(c.tutorial_tasks_in_flight), []);
	assert.equal(timers.length, 0);
});
