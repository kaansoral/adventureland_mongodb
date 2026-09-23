const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load, read, socketHandler, transactions } = require("./helpers/server_vm");
const design = require("./helpers/design");

function runtime(info) {
	const context = vm.createContext({ console: { log() {}, error() {} } });
	vm.runInContext(read("docs/directory.js"), context);
	const previousKeys = [
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
	context.docs.tutorial = previousKeys.map((key) => context.docs.tutorial.find((lesson) => lesson.key === key));
	load(context, "adventure_functions.js", [
		"process_user_data",
		"migrate_tutorial_data",
		"tutorial_lesson_complete",
		"tutorial_onboarding_complete",
		"calculate_tutorial_step",
		"data_to_tutorial",
		"get_tutorial_track",
	]);
	load(context, "api.js", ["tutorial_api", "reset_tutorial_api"]);
	const id = "IE_userdata-US_tutorial";
	const store = transactions(context, info ? [{ _id: id, info: structuredClone(info) }] : []);
	const get = () => context.process_user_data("US_tutorial", structuredClone(store.records.get(id)));
	async function request(args) {
		const res = { infs: [] };
		const result = await context.tutorial_api({ user: { _id: "US_tutorial" }, res, ...args });
		return { result, info: res.infs.find((inf) => inf.type === "tutorial_data"), res };
	}
	async function proceed() {
		const data = get();
		return request({ step: data.info.tutorial_step + 1, lesson: data.info.tutorial_key });
	}
	return { context, store, id, get, request, proceed };
}

function previousProgress(context, step) {
	return {
		tutorial_version: 2,
		tutorial_step: step,
		completed_tasks: context.docs.tutorial
			.slice(0, step)
			.flatMap((lesson) => lesson.tasks.filter((task) => task !== lesson.continue_task)),
		code_list: { main: "keep-existing-data" },
	};
}

function insertReading(context, key, index) {
	context.docs.tutorial.splice(index, 0, { key, tasks: ["read_" + key], continue_task: "read_" + key });
}

test("reading stays pending until Continue, survives reload, and cannot be marked through the task endpoint", async () => {
	const r = runtime();
	const initial = r.context.data_to_tutorial(r.get());
	assert.equal(initial.task, "read_helloworld");
	assert.equal(initial.can_continue, true);
	assert.equal(initial.progress, 0);
	await r.request({ task: "read_helloworld" });
	assert.equal(r.store.records.size, 0);
	await r.request({ step: 2 });
	assert.equal(r.store.records.size, 0, "cannot skip ahead");
	await r.request({ step: 1, lesson: "another-lesson" });
	assert.equal(r.store.records.size, 0, "a stale page cannot complete a different lesson");
	const continued = await r.proceed();
	assert.equal(continued.info.next, true);
	assert.equal(continued.info.step, 1);
	assert.deepEqual(Array.from(r.get().info.completed_tasks), ["read_helloworld"]);
	assert.equal(r.get().info.tutorial_key, "learntofight");
	await r.request({ step: 1 });
	assert.deepEqual(Array.from(r.get().info.completed_tasks), ["read_helloworld"], "repeated Continue is harmless");
	await r.proceed();
	assert.equal(r.get().info.tutorial_key, "learntofight", "Continue cannot bypass combat tasks");
	await r.request({ task: "killagoo" });
	await r.request({ task: "firstloot" });
	assert.equal(r.get().info.tutorial_key, "learntofight", "finishing gameplay still leaves Continue available");
	assert.equal((await r.proceed()).info.step, 2);
});

test("version-2 progress visits inserted 0, 7 and 8, then resumes the old unfinished lesson", async () => {
	const base = runtime();
	const r = runtime(previousProgress(base.context, 12));
	insertReading(r.context, "lore", 0);
	insertReading(r.context, "gear-comparison", 7);
	insertReading(r.context, "accessory-comparison", 8);
	const visited = [];
	for (let i = 0; i < 3; i++) {
		visited.push(r.get().info.tutorial_step);
		assert.equal((await r.proceed()).info.next, true);
	}
	assert.deepEqual(visited, [0, 7, 8]);
	assert.equal(r.get().info.tutorial_key, "multiple-characters");
	assert.equal(r.get().info.tutorial_step, 15, "three insertions shift zero-based index 12 to 15");
	assert.equal(r.get().info.code_list.main, "keep-existing-data");
	const tasks = r.get().info.completed_tasks;
	for (const task of [
		"read_helloworld",
		"read_hellocode",
		"read_lore",
		"read_gear-comparison",
		"read_accessory-comparison",
	])
		assert.ok(tasks.includes(task));
	assert.ok(!tasks.includes("characters"));
	assert.ok(!tasks.includes("read_theend"));
});

test("migration preserves all previous positions, including new and finished accounts", () => {
	const base = runtime();
	for (let step = 0; step <= base.context.docs.tutorial.length; step++) {
		const r = runtime(previousProgress(base.context, step));
		const data = r.get();
		assert.equal(data.info.tutorial_step, step);
		assert.equal(data.info.tutorial_version, 4);
		const snapshot = JSON.stringify(data);
		r.context.process_user_data("US_tutorial", data);
		assert.equal(JSON.stringify(data), snapshot, "migration is idempotent");
	}
});

test("stable lesson keys handle later reordering, insertion and removal without numeric drift", async () => {
	const base = runtime();
	const r = runtime(previousProgress(base.context, 12));
	const migrated = r.get();
	r.store.records.set(r.id, structuredClone(migrated));
	const lessons = r.context.docs.tutorial;
	lessons.unshift(lessons.splice(5, 1)[0]);
	assert.equal(r.get().info.tutorial_key, "multiple-characters");
	insertReading(r.context, "lore", 0);
	assert.equal(r.get().info.tutorial_key, "lore");
	await r.proceed();
	assert.equal(r.get().info.tutorial_key, "multiple-characters");
	lessons.splice(
		lessons.findIndex((lesson) => lesson.key === "multiple-characters"),
		1,
	);
	assert.equal(r.get().info.tutorial_key, "events-status");
});

test("previously finished accounts see new reading, then finish again; reset clears reading credit", async () => {
	const base = runtime();
	const r = runtime(previousProgress(base.context, base.context.docs.tutorial.length));
	insertReading(r.context, "lore", 0);
	assert.equal(r.context.data_to_tutorial(r.get()).finished, undefined);
	assert.equal((await r.proceed()).info.finished, true);
	assert.equal(r.get().info.tutorial_key, null);
	insertReading(r.context, "later-reading", r.context.docs.tutorial.length);
	assert.equal(r.get().info.tutorial_key, "later-reading");
	assert.equal((await r.proceed()).info.finished, true);
	const res = { infs: [] };
	await r.context.reset_tutorial_api({ user: "US_tutorial", res });
	assert.equal(r.get().info.tutorial_key, "lore");
	assert.deepEqual(Array.from(r.get().info.completed_tasks), []);
	assert.equal(r.get().info.code_list.main, "keep-existing-data");
});

test("old pre-version accounts retain their migration credits, not credit for new reading", () => {
	const r = runtime({ tutorial_step: 7, completed_tasks: ["firstloot"] });
	const data = structuredClone(r.store.records.get(r.id));
	r.context.migrate_tutorial_data(data);
	assert.equal(data.info.tutorial_key, "theend");
	assert.equal(data.info.tutorial_version, 4);
	for (const task of ["firstloot", "equip", "characters", "events", "read_helloworld", "read_hellocode"])
		assert.ok(data.info.completed_tasks.includes(task));
	assert.ok(!data.info.completed_tasks.includes("read_theend"));
});

test("reading and gameplay requirements can coexist without Continue bypassing gameplay", async () => {
	const r = runtime();
	r.context.docs.tutorial[0].tasks.push("inventory");
	assert.equal(r.context.data_to_tutorial(r.get()).can_continue, false);
	await r.proceed();
	assert.equal(r.store.records.size, 0);
	await r.request({ task: "inventory" });
	assert.equal(r.context.data_to_tutorial(r.get()).can_continue, true);
	await r.proceed();
	assert.ok(r.get().info.completed_tasks.includes("read_helloworld"));
});

test("tutorial writes do not overwrite concurrent account changes", async () => {
	const r = runtime();
	await r.proceed();
	let injected = false;
	const snapshot = structuredClone(r.store.records.get(r.id));
	const store = transactions(r.context, [snapshot], ({ records, versions }) => {
		if (injected) return;
		injected = true;
		const data = records.get(r.id);
		data.info.code_list = { main: "concurrent-edit" };
		versions.set(r.id, versions.get(r.id) + 1);
	});
	const result = await r.request({ task: "killagoo" });
	assert.equal(result.result.success, true);
	assert.equal(store.records.get(r.id).info.code_list.main, "concurrent-edit");
	assert.ok(store.records.get(r.id).info.completed_tasks.includes("killagoo"));
	assert.equal(store.stats.aborts, 1, "retry the conflicting save against the latest account data");
});

test("inventory rendering and an already-open bag credit the task without clicking a button", async () => {
	for (const alreadyOpen of [false, true]) {
		const base = runtime(),
			info = previousProgress(base.context, 2);
		info.completed_tasks.push("equip", "usepotion");
		const r = runtime(info),
			c = r.context;
		tutorialUI(c, r.get());
		Object.assign(c, {
			character: { items: [], isize: 0, gold: 0, q: {} },
			inventory: alreadyOpen,
			is_comm: false,
			c_enabled: false,
			viewport_width: () => 1280,
			comm_items: {},
			comm_chat_escape: String,
			max: Math.max,
			to_pretty_num: String,
			tutorial_tasks_in_flight: {},
		});
		load(c, "js/html.js", ["render_inventory"]);
		load(c, "js/functions.js", ["tut"]);
		let pending,
			requests = 0;
		c.api_call = (name, args) => {
			assert.equal(name, "tutorial");
			assert.equal(args.task, "inventory");
			assert.equal(c.inventory, true, "credit happens after the bag opens");
			requests++;
			return (pending = r.request(args).then(() => {
				c.X.tutorial = c.data_to_tutorial(r.get());
			}));
		};
		if (alreadyOpen) c.update_tutorial_ui();
		else c.render_inventory();
		await pending;
		assert.equal(requests, 1);
		assert.ok(r.get().info.completed_tasks.includes("inventory"));
		assert.equal(c.X.tutorial.can_continue, true);
		let creditCalls = 0;
		c.tut = () => {
			creditCalls++;
		};
		c.render_inventory(); // Close, not another completion.
		assert.equal(c.inventory, false);
		c.is_comm = true;
		c.observing = c.character;
		c.render_inventory(); // Another character's bag is not the player's task.
		assert.equal(creditCalls, 0);
	}
	assert.doesNotMatch(read("htmls/index.html"), /tut\(['"]inventory['"]\)/);
});

function tutorialUI(context, data) {
	const elements = {};
	const calls = [];
	context.$ = (selector) => {
		const nodes = selector.split(",").map((name) => (elements[name] ||= {}));
		const chain = {
			show() {
				nodes.forEach((node) => (node.visible = true));
				return chain;
			},
			hide() {
				nodes.forEach((node) => (node.visible = false));
				return chain;
			},
			html(value) {
				nodes.forEach((node) => (node.html = value));
				return chain;
			},
			css() {
				return chain;
			},
			removeClass() {
				return chain;
			},
			codemirror() {
				return chain;
			},
		};
		return chain;
	};
	Object.assign(context, {
		G: { docs: context.docs },
		X: { tutorial: context.data_to_tutorial(data) },
		last_rendered_step: 0,
		last_rendered_track: "",
		modal_count: 0,
		tutorial_ui: true,
		no_graphics: true,
		hide_modals() {},
		hide_modal() {},
		position_modals() {},
		prepare_tutorial_code() {},
		btc() {},
		event: {},
		show_modal(html) {
			context.modal = html;
		},
		api_call(name, args) {
			calls.push({ name, args });
		},
	});
	context.window = context;
	load(context, "js/game.js", ["update_tutorial_ui", "update_tutorial_state", "tutorial_npc"]);
	load(context, "js/html.js", ["get_tutorial_view", "continue_tutorial", "render_tutorial_index", "render_tutorial"]);
	return { elements, calls };
}

test("merchants default to their own lessons while numbered and explicit adventurer links stay compatible", () => {
	const r = runtime(),
		ui = tutorialUI(r.context, r.get()),
		c = r.context;
	c.character = { ctype: "merchant" };
	c.X.merchant_tutorial = { step: 1, progress: 0, completed: [], pending: [], finished: false };
	load(c, "js/html.js", ["open_tutorial"]);
	c.open_tutorial();
	assert.equal(ui.calls.at(-1).args.name, "merchant-supplies");
	assert.equal(ui.calls.at(-1).args.track, "merchant");
	c.open_tutorial(1);
	assert.equal(ui.calls.at(-1).args.name, "learntofight");
	assert.equal(ui.calls.at(-1).args.track, "");
	c.open_tutorial(undefined, "");
	assert.equal(ui.calls.at(-1).args.name, "helloworld");
	c.render_tutorial_index();
	assert.match(c.modal, /data-track='merchant'/);
	c.render_tutorial_index("");
	assert.match(c.modal, /data-track=''/);
	c.update_tutorial_ui();
	assert.equal(ui.elements["#tutorialui"].html, c.phrase.html("game.tutorial.progress", { step: 2, total: 5 }));
	c.X.merchant_tutorial.finished = true;
	c.update_tutorial_ui();
	assert.equal(ui.elements[".tutorialui"].visible, false);
	delete c.character;
	c.open_tutorial();
	assert.equal(ui.calls.at(-1).args.track, "");
});

test("reading renders an enabled Continue with the stable lesson key; gameplay stays gated", () => {
	const r = runtime();
	const ui = tutorialUI(r.context, r.get());
	r.context.render_tutorial("Reading content", 0);
	assert.doesNotMatch(r.context.modal, /class='tutprogress'/, "reading-only lessons have no percentage counter");
	assert.equal(ui.elements[".tutcontinue"].visible, true);
	assert.equal(ui.elements[".tutincomplete"].visible, false);
	assert.equal(ui.elements[".tutprogress"].html, 0);
	const onclick = r.context.modal.match(/class='[^']*\btutcontinue'[^>]*onclick='([^']+)'/)[1];
	vm.runInContext(onclick, r.context);
	assert.equal(ui.calls[0].name, "tutorial");
	assert.equal(ui.calls[0].args.lesson, "helloworld");
	assert.equal(ui.calls[0].args.step, 1);
	const data = r.get();
	data.info.tutorial_step = 1;
	data.info.completed_tasks.push("read_helloworld");
	r.context.X.tutorial = r.context.data_to_tutorial(data);
	r.context.render_tutorial("Combat content", 1);
	assert.match(r.context.modal, /class='tutprogress'/, "gameplay tasks keep their progress counter");
	assert.equal(ui.elements[".tutcontinue"].visible, false);
	assert.equal(ui.elements[".tutincomplete"].visible, true);
});

test("completed later lessons remain marked completed while reading a newly inserted lesson", () => {
	const base = runtime();
	const r = runtime(previousProgress(base.context, 12));
	insertReading(r.context, "lore", 0);
	const ui = tutorialUI(r.context, r.get());
	const previousReading = r.context.docs.tutorial.findIndex((lesson) => lesson.key === "hellocode");
	r.context.render_tutorial("CODE content", previousReading);
	assert.equal(ui.elements[".tutreview"].html, r.context.phrase.html("game.tutorial.completed"));
	assert.equal(ui.elements[".tutprogress"].html, 100);
	assert.equal(ui.elements[".tutcontinue"].visible, false);
	r.context.render_tutorial_index();
	assert.match(
		r.context.modal,
		new RegExp("border-color:#73BD6D; text-align:left' onclick='open_tutorial\\(" + previousReading + ","),
	);
	delete r.context.X;
	assert.doesNotThrow(() => r.context.render_tutorial_index(), "the index also works without an account");
});

// Exercise real client entry points, tut(), the API, and saved account progress.
function actionRuntime() {
	const r = runtime(),
		c = r.context,
		calls = [];
	vm.runInContext(read("docs/directory.js"), c);
	Object.assign(c, {
		G: { ...design, docs: c.docs },
		X: { tutorial: c.data_to_tutorial(r.get()) },
		character: { map: "main", x: 0, y: 0, items: [], slots: {} },
		tutorial_tasks_in_flight: {},
		no_graphics: true,
		no_html: true,
		Dev: false,
		trade_slots: ["trade1"],
		options: {},
		socket: {},
		resolve_deferred() {},
		reject_deferred() {},
		call_code_function() {},
		draw_trigger() {},
	});
	c.window = c;
	Object.defineProperty(c, "PIXI", {
		get() {
			throw new Error("Tutorial progress must not touch PIXI");
		},
	});
	let pending = Promise.resolve();
	c.api_call = (name, args) => {
		calls.push({ name, args });
		if (name !== "tutorial") return Promise.resolve();
		pending = pending.then(async () => {
			const result = await r.request(args);
			assert.equal(result.result.success, true);
			c.X.tutorial = result.info;
			return result;
		});
		return pending;
	};
	load(c, "js/functions.js", ["tut"]);
	load(c, "js/old_common_functions.js", ["point_distance"]);
	load(c, "js/game.js", ["tutorial_npc", "update_tutorial_state"]);
	const source = read("js/game.js"),
		handlers = {};
	for (const event of ["game_response", "game_log"]) {
		const start = source.indexOf('\tsocket.on("' + event + '",');
		assert.notEqual(start, -1);
		c.socket.on = (name, handler) => {
			handlers[name] = handler;
		};
		vm.runInContext(source.slice(start, source.indexOf("\n\tsocket.on(", start + 1)), c);
	}
	return { ...r, calls, handlers, flush: () => pending, saved: () => Array.from(r.get().info.completed_tasks) };
}

test("earlier gameplay persists quietly, deduplicates, and never credits unread lessons", async () => {
	const r = actionRuntime(),
		c = r.context;
	c.tut("inventory");
	c.tut("inventory");
	c.tut("read_helloworld");
	const result = await r.flush();
	assert.deepEqual(r.saved(), ["inventory"]);
	assert.equal(result.info.success, undefined, "future credit must not flash completion of the current lesson");
	assert.equal(result.res.infs.filter((info) => info.type === "message").length, 0);
	assert.deepEqual(Array.from(c.X.tutorial.completed_tasks), ["inventory"]);
	assert.deepEqual(Array.from(c.X.tutorial.completed), [], "legacy completed still describes the current lesson");
	c.tut("inventory");
	assert.equal(r.calls.length, 1);
	assert.equal(r.get().info.tutorial_key, "lore");
	await r.request({ task: "read_helloworld" });
	assert.deepEqual(r.saved(), ["inventory"]);
});

test("simultaneous task saves retry conflicts without losing credit or replaying actions", async () => {
	const r = actionRuntime(),
		c = r.context;
	const tasks = [
		"inventory",
		"skills",
		"recipes",
		"events",
		"useskill",
		"usepotion",
		"killagoo",
		"equip",
		"visitnpc",
		"bank",
		"store",
		"deposit",
	];
	const requests = [];
	c.api_call = (_, args) => {
		const request = r.request(args).then((result) => {
			if (result.result.failed) throw result.result;
			c.X.tutorial = result.info;
			return result.result;
		});
		requests.push(request);
		return request;
	};
	for (const task of tasks) c.tut(task);
	for (let tick = 0; tick < 200 && Object.keys(c.tutorial_tasks_in_flight).length; tick++)
		await new Promise(setImmediate);
	await Promise.allSettled(requests);
	assert.deepEqual(Object.keys(c.tutorial_tasks_in_flight), []);
	for (const task of tasks) assert.ok(r.saved().includes(task), task);
	assert.equal(new Set(r.saved()).size, tasks.length);
	assert.equal(r.get().info.tutorial_key, "lore");
	assert.ok(r.store.stats.aborts > 0, "the test must exercise competing writes");
});

test("actual HP and MP regeneration preserve potion credit and also complete skill use", async () => {
	for (const used of ["hp", "mp"]) {
		const r = actionRuntime();
		const player = { hp: 10, max_hp: 100, mp: 0, max_mp: 200, last: {}, cid: 0 };
		const server = vm.createContext({
			G: design,
			players: { test: player },
			socket: { id: "test", emit() {} },
			future_ms: (n) => new Date(Date.now() + n),
			mssince: (t) => Date.now() - t,
			disappearing_text() {},
			player_to_client: (p) => p,
			success_response: (data) => r.handlers.game_response({ ...data, place: "use" }),
			fail_response: (reason) => {
				throw new Error(reason);
			},
		});
		socketHandler(server, "use")({ item: used });
		await r.flush();
		assert.equal(player[used], used === "hp" ? 60 : 100);
		assert.deepEqual(r.saved().sort(), ["usepotion", "useskill"]);
	}
});

test("solo, party, localized and legacy Goo kills all persist completion", async () => {
	const server = vm.createContext({ G: design });
	load(server, "node/server_functions.js", ["kill_message"]);
	const messages = [
		server.kill_message("OtherPartyMember", "goo", false),
		server.kill_message("Player", "goo", true),
		"OtherPartyMember killed a Goo",
	];
	for (const data of messages) {
		const r = actionRuntime();
		r.handlers.game_log(data);
		await r.flush();
		assert.ok(r.saved().includes("killagoo"));
	}
	const r = actionRuntime();
	const localized = server.kill_message("Friend", "goo", false);
	localized.message = "localized display text";
	r.handlers.game_log(localized);
	await r.flush();
	assert.ok(r.saved().includes("killagoo"));
});

test("actual batch equipment and partial batch results count just like single equipment", async () => {
	const r = actionRuntime();
	const player = { type: "mage", items: [{ name: "coat", level: 0 }], slots: {}, citems: [], cslots: {}, s: {} };
	const server = vm.createContext({
		G: design,
		players: { test: player },
		socket: { id: "test", emit() {} },
		min: Math.min,
		to_number: Number,
		cache_item: (item) => item,
		resend() {},
		success_response: (_, data) => r.handlers.game_response({ ...data, place: "equip_batch" }),
		fail_response: (reason) => {
			throw new Error(reason);
		},
	});
	load(server, "node/server.js", ["can_equip_item"]);
	socketHandler(server, "equip_batch")([{ num: 0 }]);
	await r.flush();
	assert.equal(player.slots.chest.name, "coat");
	assert.ok(r.saved().includes("equip"));
	const partial = actionRuntime();
	partial.handlers.game_response({
		place: "equip_batch",
		failed: true,
		slots: [{ slot: "chest" }],
		errors: [{ num: 1 }],
	});
	await partial.flush();
	assert.ok(partial.saved().includes("equip"), "one equipped item is enough");
});

test("existing UI, equipment, scrolls and bank contents recover missed tasks without graphics", async () => {
	const r = actionRuntime(),
		c = r.context;
	c.inventory = c.skillsui = true;
	c.X.characters = [{ name: "One" }, { name: "Two" }];
	c.character = {
		map: "bank",
		items: [{ name: "scroll0" }, { name: "cscroll0" }, { name: "ringsj", level: 1 }],
		slots: { chest: { name: "coat", level: 2, stat_type: "int" } },
		user: { gold: 1, items0: [{ name: "hpot0", q: 1 }] },
	};
	c.update_tutorial_state();
	await r.flush();
	for (const task of [
		"inventory",
		"skills",
		"characters",
		"equip",
		"upgrade",
		"compound",
		"buyscrolls",
		"buycscroll0",
		"addstats",
		"bank",
		"deposit",
		"store",
	])
		assert.ok(r.saved().includes(task), task);
	const requests = r.calls.length;
	c.update_tutorial_state();
	assert.equal(r.calls.length, requests, "state recovery does not keep sending completed tasks");
	delete c.character;
	assert.doesNotThrow(() => c.update_tutorial_state(), "standalone documentation has no character");
});

test("NPC visits use service range while the smaller INFO range stays unchanged", async () => {
	for (const [id, task] of [
		["fancypots", "visitshop"],
		["craftsman", "craftsman"],
		["exchange", "exchanger"],
	]) {
		const r = actionRuntime(),
			c = r.context;
		c.G.maps = { audit: {} };
		c.character.map = "audit";
		Object.assign(c, {
			entities: {},
			map_npcs: [{ npc: id, role: design.npcs[id].role }],
			quirks: {},
			interaction_context: null,
			interaction_contexts: [],
			distance: () => 100,
			is_number: (n) => typeof n === "number",
			render_server() {},
		});
		load(c, "js/game.js", [
			"showhide_quirks_logic",
			"get_npc_interaction_context",
			"get_cavalry_interaction_context",
			"consider_interaction_context",
			"interaction_context_range",
			"normalize_interaction_contexts",
			"interaction_context_signature",
		]);
		c.showhide_quirks_logic();
		await r.flush();
		assert.ok(r.saved().includes(task), id);
		assert.equal(c.interaction_contexts.length, 0, "no extra INFO clutter at 100 units");
		c.distance = () => 50;
		c.showhide_quirks_logic();
		assert.ok(c.interaction_contexts.length > 0);
	}
});

test("Leo's recipe list and individual recipe, plus event INFO, grant saved credit", async () => {
	for (const render of ["render_recipe", "render_recipes"]) {
		const r = actionRuntime(),
			c = r.context;
		Object.assign(c, {
			r_page: {},
			next_side_interaction: null,
			reset_inventory() {},
			item_container: () => "item",
			render_item: () => "recipe",
			show_modal() {},
			render_ui_panel() {},
			randomStr: () => "test",
			object_sort: (object) => Object.entries(object),
		});
		load(c, "js/html.js", [render]);
		if (render === "render_recipe") c.render_recipe(null, "", "computer");
		else c.render_recipes();
		await r.flush();
		assert.ok(r.saved().includes("recipes"));
	}
	for (const name of ["events-and-home", "event-franky"]) {
		const r = actionRuntime();
		load(r.context, "js/html.js", ["open_guide"]);
		r.context.open_guide(name);
		await r.flush();
		assert.ok(r.saved().includes("events"));
		assert.equal(r.calls.at(-1).name, "load_article");
	}
});

test("successful CODE services and chance previews also satisfy the matching lessons", async () => {
	for (const [data, tasks] of [
		[{ place: "buy" }, ["visitshop", "buyitem", "visitnpc"]],
		[{ place: "craft" }, ["craftsman", "recipes", "visitnpc"]],
		[{ place: "dismantle" }, ["craftsman", "recipes"]],
		[{ place: "exchange" }, ["exchanger", "visitnpc"]],
		[{ place: "heal" }, ["useskill"]],
		[{ response: "upgrade_chance" }, ["upgrade", "buyscrolls"]],
		[{ response: "compound_chance" }, ["compound", "buycscroll0"]],
	]) {
		const r = actionRuntime();
		r.handlers.game_response(data);
		await r.flush();
		for (const task of tasks) assert.ok(r.saved().includes(task), JSON.stringify(data) + " -> " + task);
	}
});

test("Continue skips compounding practice without materials or a new acquisition requirement", async () => {
	const r = runtime();
	const step = r.context.docs.tutorial.findIndex((lesson) => lesson.key === "compound");
	const data = r.get();
	data.info = {
		tutorial_version: 3,
		tutorial_step: step,
		tutorial_key: "compound",
		completed_tasks: r.context.docs.tutorial.slice(0, step).flatMap((lesson) => lesson.tasks),
	};
	r.store.records.set(r.id, structuredClone(data));
	assert.equal(r.context.data_to_tutorial(r.get()).can_continue, true);
	assert.equal((await r.proceed()).info.next, true);
	assert.equal(r.get().info.tutorial_key, "bank");
	for (const task of ["compound", "buycscroll0"]) assert.ok(r.get().info.completed_tasks.includes(task));
});

test("existing TRAVEL-button, SKILLS-closing and zero-deposit completions remain accepted", async () => {
	const r = actionRuntime(),
		c = r.context;
	const travelClick = read("htmls/index.html").match(/onclick="([^"\n]*tut\('travel'\)[^"\n]*)"/)[1];
	Object.assign(c, {
		event: {},
		btc() {},
		render_travel() {},
		skillsui: true,
		$: () => ({ hide() {}, remove() {} }),
		render_skillbar() {},
		ui_log() {},
		to_pretty_num: String,
	});
	vm.runInContext(travelClick, c);
	load(c, "js/html.js", ["render_skills"]);
	c.render_skills();
	assert.equal(c.skillsui, false);
	c.draw_trigger = (callback) => callback();
	const player = { map: "bank", gold: 10, user: { gold: 0 } };
	const server = vm.createContext({
		players: { test: player },
		socket: { id: "test", emit() {} },
		max: Math.max,
		min: Math.min,
		server_log() {},
		resend() {},
		success_response: (data) => r.handlers.game_response({ ...data, place: "bank" }),
	});
	socketHandler(server, "bank")({ operation: "deposit", amount: 0 });
	await r.flush();
	assert.equal(player.gold, 10);
	for (const task of ["travel", "skills", "deposit"]) assert.ok(r.saved().includes(task), task);
});

test("all current main and merchant lessons can persist and advance through the API", async () => {
	for (const track of [undefined, "merchant"]) {
		const r = actionRuntime(),
			c = r.context;
		const lessons = track ? c.docs.merchant_tutorial : c.docs.tutorial;
		for (let i = 0; i < lessons.length; i++) {
			const lesson = lessons[i];
			for (const task of lesson.tasks.filter((task) => task !== lesson.continue_task)) await r.request({ track, task });
			const result = await r.request({ track, step: i + 1, lesson: lesson.key });
			assert.equal(result.info.next, true, lesson.key);
			assert.equal(result.info.step, i + 1, lesson.key);
		}
		const saved = c.get_tutorial_track(r.get(), track).info;
		assert.equal(saved.tutorial_key, null);
		for (const lesson of lessons)
			for (const task of lesson.tasks) assert.ok(saved.completed_tasks.includes(task), task);
	}
});
