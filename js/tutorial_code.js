(function (root) {
	"use strict";
	// Controlled practice fixtures for the tutorial. Execute runs these in a worker.
	const characters = [
		{ name: "Mira", hp: 180, max_hp: 300 },
		{ name: "Nox", hp: 90, max_hp: 300 },
		{ name: "Bram", hp: 150, max_hp: 300 },
		{ name: "Iris", hp: 225, max_hp: 900 },
		{ name: "Orin", hp: 300, max_hp: 300 },
	];
	class PracticeError extends Error {}
	function errorResult(error) {
		return error instanceof PracticeError ? { id: error.message } : { raw: String(error) };
	}
	function scenarios(id, characters) {
		return characters.map((sample, index) => {
			const hero = { ...sample, map: "main", x: 0, y: 0, range: 50, mp: 100, max_mp: 100, rip: false, items: [] };
			const goo = { id: "goo1", type: "monster", mtype: "goo", map: "main", x: 20, y: 0, visible: true, hp: 100 };
			const scene = { id, index, hero, monsters: [], duration: 4000, changes: [], events: [], tripResults: [], actionDelay: 200, travelDelay: 600 };
			if (id === "inventory") {
				hero.items = [
					[{ name: "hpot0", q: 2 }, null, { name: "mpot0", q: 9 }, { name: "hpot0", q: 3 }, { name: "hpot0" }],
					[null, null],
					[{ name: "hpot0", q: 7 }],
					[{ name: "mpot0", q: 8 }, null, { name: "blade" }],
					[null, { name: "hpot0", q: 20 }, null, { name: "hpot0", q: 1 }],
				][index];
				scene.expected = ["HP potions: " + [6, 0, 7, 0, 21][index]];
				scene.note = [
					"client.tutorial_code.scene.inventory.0",
					"client.tutorial_code.scene.inventory.1",
					"client.tutorial_code.scene.inventory.2",
					"client.tutorial_code.scene.inventory.3",
					"client.tutorial_code.scene.inventory.4",
				][index];
			} else if (id === "targets") {
				scene.monsters = index === 1 ? [] : [{ ...goo, x: index === 2 ? 200 : 20, mtype: index === 4 ? "bee" : "goo" }];
				hero.rip = index === 3;
				scene.expected = [["In range"], ["No goo"], ["Too far"], ["Dead"], ["No goo"]][index];
				scene.note = [
					"client.tutorial_code.scene.targets.0",
					"client.tutorial_code.scene.targets.1",
					"client.tutorial_code.scene.targets.2",
					"client.tutorial_code.scene.targets.3",
					"client.tutorial_code.scene.targets.4",
				][index];
			} else if (id === "timers") {
				const hp = [hero.hp, Math.max(1, hero.hp - 40), Math.max(1, hero.hp - 70)];
				scene.changes = [
					{ at: 500, hero: { hp: hp[1] } },
					{ at: 1500, hero: { hp: hp[2] } },
				];
				scene.expected = hp.slice(0, index === 4 ? 2 : 3).map((value) => "HP: " + value);
				if (index === 4) scene.cancelAt = 1500;
				scene.note = index === 4 ? "client.tutorial_code.scene.timers.1" : "client.tutorial_code.scene.timers.0";
			} else if (id === "async") {
				hero.x = 80;
				scene.tripResults = index === 1 || index === 4 ? ["blocked", null] : [null];
				if (index === 2) scene.cancelAt = 300;
				if (index === 3) scene.repeatAt = 100;
				if (index === 4) scene.repeatAt = 1500;
				scene.expected = [["Arrived"], ["Travel failed: blocked"], ["Travel failed: interrupted"], ["Arrived"], ["Travel failed: blocked", "Arrived"]][index];
				scene.note = [
					"client.tutorial_code.scene.async.0",
					"client.tutorial_code.scene.async.1",
					"client.tutorial_code.scene.async.2",
					"client.tutorial_code.scene.async.3",
					"client.tutorial_code.scene.async.4",
				][index];
			} else if (id === "events") {
				const payloads = [[{ damage: 12 }, { damage: 9 }], [], [{ heal: 7 }, {}, { damage: "9" }], [{ damage: 0 }], [{ damage: 5 }, { damage: "9" }]][index];
				scene.events = payloads.map((data, i) => ({ at: 500 + i * 500, data }));
				scene.events.push({ at: 3500, data: { damage: 88 } });
				scene.expected = [["Damage: 12", "Damage: 9"], [], [], ["Damage: 0"], ["Damage: 5"]][index];
				scene.note = [
					"client.tutorial_code.scene.events.0",
					"client.tutorial_code.scene.events.1",
					"client.tutorial_code.scene.events.2",
					"client.tutorial_code.scene.events.3",
					"client.tutorial_code.scene.events.4",
				][index];
			} else if (id === "capstone") {
				hero.hp = hero.max_hp;
				hero.items = [
					{ name: "hpot0", q: 10 },
					{ name: "mpot0", q: 10 },
				];
				scene.duration = 12000;
				scene.monsters = index === 1 ? [] : [{ ...goo, x: index === 0 || index === 3 || index === 4 ? 200 : 20 }];
				scene.travelDelay = index === 4 ? 15000 : 1600;
				if (index === 0) scene.cooldownUntil = 3500;
				if (index === 2) {
					hero.hp = 20;
					hero.mp = 10;
					hero.items = [];
					scene.changes = [
						{ at: 1700, hero: { hp: 220, mp: 100 } },
						{ at: 2500, hero: { rip: true } },
					];
				}
				if (index === 3) {
					scene.tripResults = ["blocked"];
					scene.attackFailure = "not_found";
					scene.changes = [
						{ at: 1900, monsters: [] },
						{ at: 3100, monsters: [{ ...goo, id: "goo2" }] },
					];
				}
				scene.note = [
					"client.tutorial_code.scene.capstone.0",
					"client.tutorial_code.scene.capstone.1",
					"client.tutorial_code.scene.capstone.2",
					"client.tutorial_code.scene.capstone.3",
					"client.tutorial_code.scene.capstone.4",
				][index];
			}
			return scene;
		});
	}

	function createClock() {
		let now = 0,
			sequence = 0;
		const jobs = new Map();
		const clock = {
			get now() {
				return now;
			},
			setTimeout(fn, delay = 0, external = false) {
				if (typeof fn !== "function") throw new PracticeError("client.tutorial_code.error.callback");
				if (jobs.size >= 200) throw new PracticeError("client.tutorial_code.error.pending_limit");
				const id = ++sequence;
				jobs.set(id, { id, fn, at: now + Math.max(0, Number(delay) || 0), external });
				return id;
			},
			clearTimeout(id) {
				jobs.delete(id);
			},
			get pending() {
				return [...jobs.values()].filter((job) => !job.external).length;
			},
			async flush() {
				for (let i = 0; i < 20; i++) await Promise.resolve();
			},
			async advance(until) {
				let turns = 0;
				await clock.flush();
				while (true) {
					const next = [...jobs.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
					if (!next || next.at > until) break;
					if (++turns > 200) throw new PracticeError("client.tutorial_code.error.callback_limit");
					now = next.at;
					jobs.delete(next.id);
					next.fn();
					await clock.flush();
				}
				now = until;
				await clock.flush();
			},
		};
		return clock;
	}

	async function runScenario(source, scene) {
		const clock = createClock();
		const data = JSON.parse(JSON.stringify(scene.hero));
		let monsters = JSON.parse(JSON.stringify(scene.monsters));
		const logs = [],
			logTimes = [],
			calls = [],
			completions = [],
			errors = [],
			scheduled = [];
		const listeners = new Map(),
			pending = new Map();
		let listenerId = 0,
			actionId = 0,
			trips = 0,
			attacks = 0,
			maxPending = 0;
		function record(text) {
			if (logs.length >= 40) throw new PracticeError("client.tutorial_code.error.log_limit");
			logs.push(String(text).slice(0, 1000));
			logTimes.push(clock.now);
		}
		function call(name, args) {
			if (calls.length >= 200) throw new PracticeError("client.tutorial_code.error.call_limit");
			calls.push({ name, args, at: clock.now, dead: data.rip, low: data.hp < data.max_hp / 2 || data.mp < data.max_mp / 5 });
		}
		function action(name, args, delay, failure, done) {
			call(name, args);
			const id = ++actionId;
			const promise = new Promise((resolve, reject) => {
				const timer = clock.setTimeout(
					() => {
						pending.delete(id);
						completions.push({ name, at: clock.now, failure });
						if (failure) reject({ reason: failure });
						else {
							if (done) done();
							resolve({ success: true });
						}
					},
					delay,
					true,
				);
				pending.set(id, { name, timer, reject });
				maxPending = Math.max(maxPending, pending.size);
			});
			// Native movement Promises can be ignored without an unhandled rejection;
			// the returned Promise still rejects when awaited.
			promise.catch(() => {});
			return promise;
		}
		const character = {};
		for (const key of Object.keys(data)) Object.defineProperty(character, key, { enumerable: true, get: () => data[key] });
		character.on = (event, fn) => {
			const id = "listener" + ++listenerId;
			listeners.set(id, { event, fn });
			return id;
		};
		character.once = (event, fn) => {
			const id = "listener" + ++listenerId;
			listeners.set(id, { event, fn, once: true });
			return id;
		};
		character.remove = (id) => listeners.delete(id);
		Object.freeze(character);
		const api = {
			character,
			game_log: record,
			setTimeout: (fn, delay) => {
				scheduled.push(clock.now);
				return clock.setTimeout(() => {
					const result = fn();
					if (result && typeof result.catch === "function") result.catch((error) => errors.push(errorResult(error)));
				}, delay);
			},
			clearTimeout: clock.clearTimeout,
			get_nearest_monster(options = {}) {
				call("find", options);
				return monsters.find((monster) => monster.visible && !monster.dead && (!options.type || monster.mtype === options.type)) || null;
			},
			is_in_range(target) {
				return !!target && target.visible && Math.abs(target.x - data.x) <= data.range;
			},
			can_attack(target) {
				return !data.rip && api.is_in_range(target) && clock.now >= (scene.cooldownUntil || 0);
			},
			smart_move(destination) {
				return action("move", destination, scene.travelDelay, scene.tripResults[trips++], () => {
					data.map = destination.map;
					data.x = destination.x;
					data.y = destination.y;
				});
			},
			stop(what) {
				call("stop", what);
				for (const [id, operation] of pending)
					if (operation.name === "move") {
						clock.clearTimeout(operation.timer);
						pending.delete(id);
						completions.push({ name: "move", at: clock.now, failure: "interrupted" });
						operation.reject({ reason: "interrupted" });
					}
				return Promise.resolve({ success: true });
			},
			use_hp_or_mp() {
				return action("recover", null, scene.actionDelay, null);
			},
			attack(target) {
				const failure = attacks++ === 0 ? scene.attackFailure : null;
				if (!target || !monsters.includes(target) || !api.can_attack(target)) errors.push({ id: "client.tutorial_code.error.attack" });
				return action("attack", target && target.id, scene.actionDelay, failure);
			},
			loot() {
				return action("loot", null, scene.actionDelay, null);
			},
		};
		for (const change of scene.changes)
			clock.setTimeout(
				() => {
					Object.assign(data, change.hero);
					if (change.monsters) monsters = JSON.parse(JSON.stringify(change.monsters));
				},
				change.at,
				true,
			);
		for (const event of scene.events)
			clock.setTimeout(
				() => {
					for (const [id, listener] of [...listeners])
						if (listener.event === "hit") {
							if (listener.once) listeners.delete(id);
							listener.fn(event.data);
						}
				},
				event.at,
				true,
			);
		const execute = new Function(
			...Object.keys(api),
			'"use strict";\n' + source + '\n;return { stopReports: typeof stopReports === "function" ? stopReports : null, takeTrip: typeof takeTrip === "function" ? takeTrip : null };',
		);
		const controls = execute(...Object.values(api));
		if (scene.cancelAt !== undefined)
			clock.setTimeout(
				() => {
					if (scene.id === "timers") {
						if (!controls.stopReports) errors.push({ id: "client.tutorial_code.error.stop_reports" });
						else controls.stopReports();
					} else api.stop("move");
				},
				scene.cancelAt,
				true,
			);
		if (scene.repeatAt !== undefined)
			clock.setTimeout(
				() => {
					if (!controls.takeTrip) errors.push({ id: "client.tutorial_code.error.take_trip" });
					else controls.takeTrip().catch((error) => errors.push(errorResult(error)));
				},
				scene.repeatAt,
				true,
			);
		await clock.advance(scene.duration);
		return { logs, logTimes, calls, completions, errors, scheduled, maxPending, pendingActions: pending.size, pendingTimers: clock.pending, listeners: listeners.size };
	}

	function gradeScenario(scene, result) {
		const checks = [{ pass: result.errors.length === 0, id: "client.tutorial_code.check.callbacks" }];
		const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
		const named = (name) => result.calls.filter((call) => call.name === name);
		if (scene.expected)
			checks.push({
				pass: same(result.logs, scene.expected),
				id: scene.expected.length ? "client.tutorial_code.check.expected" : "client.tutorial_code.check.silent",
				parameters: { output: scene.expected.join("\n") },
			});
		checks.push({ pass: result.pendingTimers === 0 && result.pendingActions === 0 && result.listeners === 0, id: "client.tutorial_code.check.cleanup" });
		if (scene.id === "targets") checks.push({ pass: !result.calls.some((call) => call.dead), id: "client.tutorial_code.check.dead" });
		if (scene.id === "timers") checks.push({ pass: same(result.logTimes, scene.index === 4 ? [0, 1000] : [0, 1000, 2000]), id: "client.tutorial_code.check.report_times" });
		if (scene.id === "async") {
			checks.push({ pass: named("move").length === (scene.index === 4 ? 2 : 1) && result.maxPending === 1, id: "client.tutorial_code.check.trip_count" });
			checks.push({ pass: same(result.logTimes, scene.index === 4 ? [600, 2100] : [scene.index === 2 ? 300 : 600]), id: "client.tutorial_code.check.trip_times" });
		}
		if (scene.id === "capstone") {
			checks.push({ pass: result.maxPending === 1, id: "client.tutorial_code.check.await" });
			checks.push({
				pass: !result.calls.some((call) => call.name !== "stop" && (call.dead || (call.low && call.name !== "recover"))),
				id: "client.tutorial_code.check.resources",
			});
			checks.push({ pass: result.logs.filter((line) => line === "Stopped").length === 1 && named("stop").length === 1, id: "client.tutorial_code.check.stop" });
			const stopped = named("stop")[0];
			checks.push({ pass: !!stopped && !result.calls.some((call) => call.at > stopped.at && call.name !== "stop"), id: "client.tutorial_code.check.after_stop" });
			checks.push({ pass: !!stopped && !result.scheduled.some((at) => at >= stopped.at), id: "client.tutorial_code.check.schedule_after_stop" });
			const allowed = ["Stopped", "Action failed: blocked", "Action failed: not_found", "Action failed: interrupted"];
			checks.push({ pass: result.logs.every((line) => allowed.includes(line)), id: "client.tutorial_code.check.missing_target" });
			const recovery = named("recover");
			checks.push({
				pass: recovery.length > 0 && recovery.every((call, i) => i === 0 || call.at >= recovery[i - 1].at + scene.actionDelay + 1000),
				id: "client.tutorial_code.check.pace",
			});
			if (scene.index === 0 || scene.index === 3)
				checks.push({ pass: named("move").length >= 1 && named("attack").length >= 1 && named("loot").length >= 1, id: "client.tutorial_code.check.actions" });
			else checks.push({ pass: named("attack").length === 0, id: "client.tutorial_code.check.ready" });
			if (scene.index === 3) checks.push({ pass: result.logs.includes("Action failed: blocked") && result.logs.includes("Action failed: not_found"), id: "client.tutorial_code.check.failures" });
		}
		return checks;
	}

	function runPractice(source, sample, probes) {
		const logs = [];
		const record = function (message) {
			if (logs.length >= 40) throw new PracticeError("client.tutorial_code.error.log_limit");
			logs.push(String(message).slice(0, 1000));
		};
		const execute = new Function("character", "game_log", '"use strict";\n' + source + '\n;return typeof statusFor === "function" ? statusFor : null;');
		const hero = Object.freeze({ name: sample.name, hp: sample.hp, max_hp: sample.max_hp });
		const statusFor = execute(hero, record);
		const returns = [];
		if (probes && statusFor) {
			for (const probe of probes) {
				returns.push(String(statusFor(Object.freeze({ name: probe.name, hp: probe.hp, max_hp: probe.max_hp }))));
			}
		}
		return { logs, hasFunction: !!statusFor, returns };
	}
	function grade(id, sample, result, probes) {
		const status = (hero) => (hero.hp < hero.max_hp / 2 ? "Heal" : "Ready");
		const expected = {
			hello: ["Hello, CODE!"],
			values: ["120"],
			variables: ["3", "5"],
			character: [sample.name + ": " + (sample.max_hp - sample.hp) + " HP missing"],
			decisions: [status(sample)],
			arrays: ["Mira", "3"],
			loops: ["Mira", "Nox", "Bram"],
			functions: [sample.name + ": " + status(sample)],
		}[id];
		const checks = [
			{
				pass: result.logs.length === expected.length && expected.every((line, index) => result.logs[index] === line),
				id: "client.tutorial_code.check.expected",
				parameters: { output: expected.join("\n") },
			},
		];
		if (id === "functions") {
			checks.push({ pass: result.hasFunction, id: "client.tutorial_code.check.function" });
			(probes || []).forEach((hero, index) =>
				checks.push({
					pass: result.returns[index] === status(hero),
					id: "client.tutorial_code.check.return",
					parameters: { name: hero.name, value: status(hero) },
				}),
			);
		}
		return checks;
	}

	const foundations = ["hello", "values", "variables", "character", "decisions", "arrays", "loops", "functions"];
	// Keep only cases that teach a different input, boundary, or action outcome.
	const lessonCases = {
		hello: [0],
		values: [0],
		variables: [0],
		character: [0, 3, 4],
		decisions: [0, 2, 3],
		arrays: [0],
		loops: [0],
		functions: [0, 2, 3],
		inventory: [0, 1, 3],
		targets: [0, 1, 2],
		timers: [0, 4],
		async: [2, 3, 4],
		events: [0, 2, 3],
		capstone: [2, 3, 4],
	};
	function lessonScenes(id) {
		if (!Object.prototype.hasOwnProperty.call(lessonCases, id)) throw new PracticeError("client.tutorial_code.error.lesson");
		const scenes = scenarios(id, characters);
		return lessonCases[id].map((index) => scenes[index]);
	}
	async function check(source, id) {
		if (typeof source !== "string" || source.length > 20000) throw new PracticeError("client.tutorial_code.error.source_limit");
		const results = [];
		const scenes = lessonScenes(id);
		const probes = scenes.map((scene) => scene.hero);
		for (const scene of scenes) {
			try {
				const result = foundations.includes(id) ? runPractice(source, scene.hero, probes) : await runScenario(source, scene);
				results.push({
					name: scene.hero.name,
					hp: scene.hero.hp,
					max_hp: scene.hero.max_hp,
					note: scene.note,
					logs: result.logs,
					errors: result.errors || [],
					checks: foundations.includes(id) ? grade(id, scene.hero, result, probes) : gradeScenario(scene, result),
				});
			} catch (error) {
				results.push({
					name: scene.hero.name,
					hp: scene.hero.hp,
					max_hp: scene.hero.max_hp,
					note: scene.note,
					logs: [],
					errors: [errorResult(error)],
					checks: [],
				});
			}
		}
		return results;
	}
	const tutorial = { characters, scenarios, lessonScenes, createClock, runScenario, gradeScenario, runPractice, grade, check };
	if (typeof document === "undefined" && typeof module !== "undefined" && module.exports) {
		module.exports = tutorial;
		return;
	}
	if (typeof document === "undefined") {
		root.onmessage = async function (event) {
			try {
				root.postMessage({ results: await check(event.data.source, event.data.id) });
			} catch (error) {
				root.postMessage({ error: errorResult(error) });
			}
		};
		return;
	}
	let active = null,
		worker = null,
		deadline = null;
	const text = (id, parameters) => phrase("client.tutorial_code." + id, parameters);
	const errorText = (error) => (error.id ? phrase(error.id) : error.raw);
	function status(output, id, parameters, state) {
		output.dataset.state = state || id;
		output.textContent = text(id, parameters);
	}
	function renderResults(output, results, id) {
		const passed = (result) => !result.errors.length && result.checks.every((check) => check.pass);
		const count = results.filter(passed).length;
		const multiple = results.length > 1;
		const showHeading = !["hello", "variables", "arrays", "loops"].includes(id);
		const showHP = ["values", "character", "decisions", "functions", "timers", "capstone"].includes(id);
		output.replaceChildren();
		output.dataset.state = count === results.length ? "passed" : "failed";
		function append(parent, tag, className, value) {
			const element = document.createElement(tag);
			element.className = className;
			if (value !== undefined) element.textContent = value;
			parent.appendChild(element);
			return element;
		}
		append(output, "div", "tutorial-code-summary", multiple ? text("passed", { count, total: results.length }) : text(count ? "pass" : "retry"));
		for (const result of results) {
			const row = append(output, "div", "tutorial-code-check");
			row.dataset.passed = String(passed(result));
			if (showHeading) {
				const heading = append(row, "div", "tutorial-code-check-heading");
				append(heading, "span", "", id === "events" ? phrase(result.note) : showHP ? text("hp", result) : result.name);
				if (multiple) append(heading, "span", "tutorial-code-status", text(passed(result) ? "pass" : "retry"));
			}
			if (result.note && id !== "events") append(row, "div", "tutorial-code-note", phrase(result.note));
			append(row, "pre", "tutorial-code-output", result.logs.length ? text("logs", { output: result.logs.join("\n") }) : text("no_logs"));
			for (const check of result.checks) if (!check.pass) append(row, "div", "tutorial-code-feedback", phrase(check.id, check.parameters));
			for (const error of result.errors) append(row, "div", "tutorial-code-feedback", text("error", { error: errorText(error) }));
		}
	}
	function cancel() {
		if (worker) worker.terminate();
		worker = null;
		clearTimeout(deadline);
		deadline = null;
		if (active && active.output.dataset.state === "running") status(active.output, "ready");
	}
	function renderInputs(element, editor, id) {
		const fields = {
			character: ["name", "hp", "max_hp"],
			decisions: ["name", "hp", "max_hp"],
			functions: ["name", "hp", "max_hp"],
			inventory: ["name", "items"],
			targets: ["name", "rip", "map", "x", "y", "range"],
			timers: ["name", "hp", "max_hp"],
			async: ["name", "map", "x", "y"],
			events: [],
			capstone: ["name", "hp", "max_hp", "mp", "max_mp", "rip", "map", "x", "y", "range"],
		};
		if (!fields[id]) return;
		element.querySelectorAll(".tutorial-code-inputs, .tutorial-code-input-intro").forEach((node) => node.remove());
		const intro = document.createElement("p");
		intro.className = "tutorial-code-input-intro";
		const kind = id === "targets" || id === "capstone" ? "targets" : ["timers", "async", "events"].includes(id) ? id : "character";
		intro.innerHTML = phrase.html("client.tutorial_code.inputs." + kind);
		const samples = document.createElement("div");
		samples.className = "tutorial-code-inputs";
		element.insertBefore(intro, editor.getWrapperElement());
		element.insertBefore(samples, editor.getWrapperElement());
		const pick = (object, keys) => Object.fromEntries(keys.map((key) => [key, object[key]]));
		const assignment = (name, value) => name + " = " + JSON.stringify(value, null, 4) + ";";
		const target = (monsters) => {
			const monster = monsters.find((monster) => monster.mtype === "goo");
			return monster ? pick(monster, ["mtype", "map", "x", "y"]) : null;
		};
		const at = (time) => "// " + text("inputs.at", { time });
		for (const scene of lessonScenes(id)) {
			const lines = [];
			if (fields[id].length) lines.push(assignment("character", pick(scene.hero, fields[id])));
			if (kind === "targets") lines.push(assignment("target", target(scene.monsters)));
			if (scene.note) lines.push("// " + phrase(scene.note));
			if (id === "async" || id === "capstone") {
				lines.push("// " + text("inputs.travel", { time: scene.travelDelay }));
				if (scene.tripResults[0]) lines.push("// " + text("inputs.failure", { reason: scene.tripResults[0] }));
			}
			if (scene.cooldownUntil) lines.push("// " + text("inputs.cooldown", { time: scene.cooldownUntil }));
			for (const change of scene.changes) {
				lines.push(at(change.at));
				for (const key of Object.keys(change.hero || {})) lines.push(assignment("character." + key, change.hero[key]));
				if (change.monsters) lines.push(assignment("target", target(change.monsters)));
			}
			for (const event of scene.events) lines.push(at(event.at), assignment("data", event.data));
			if (scene.cancelAt !== undefined) lines.push(at(scene.cancelAt), id === "timers" ? "stopReports();" : 'stop("move");');
			if (scene.repeatAt !== undefined) lines.push(at(scene.repeatAt), "takeTrip();");
			const code = document.createElement("div");
			code.className = "code readonly";
			code.textContent = lines.join("\n");
			samples.appendChild(code);
		}
		$(samples).find(".code").codemirror();
	}
	function mount() {
		const element = $(".modal:last .tutorial-code")[0];
		if (!element || (active && active.element === element)) return !!element;
		cancel();
		const editor = element.querySelector(":scope > .CodeMirror").CodeMirror;
		const output = element.querySelector(".tutorial-code-result");
		renderInputs(element, editor, element.dataset.lesson);
		const key = "tutorial_code_v1_" + (root.user_id || "guest") + "_" + element.dataset.lesson;
		active = { element, editor, output };
		try {
			const saved = localStorage.getItem(key);
			if (saved !== null && saved.length <= 20000) editor.setValue(saved);
		} catch (error) {}
		editor.getInputField().setAttribute("aria-label", text("editor"));
		editor.setOption("extraKeys", { "Ctrl-Enter": run, "Cmd-Enter": run });
		editor.on("change", function () {
			cancel();
			status(output, "changed");
			try {
				if (editor.getValue().length <= 20000) localStorage.setItem(key, editor.getValue());
			} catch (error) {}
		});
		status(output, "ready");
		return true;
	}
	function run() {
		if (!mount()) return;
		cancel();
		const current = active,
			output = current.output;
		status(output, "running");
		try {
			worker = new Worker("/js/tutorial_code.js?v=" + (root.VERSION || root.Version || 1));
			const pending = worker;
			worker.onmessage = function (event) {
				if (worker !== pending || !current.element.isConnected) return;
				cancel();
				if (event.data.error) {
					status(output, "error", { error: errorText(event.data.error) });
					return;
				}
				renderResults(output, event.data.results, current.element.dataset.lesson);
				position_modals();
			};
			worker.onerror = function () {
				if (worker !== pending) return;
				cancel();
				status(output, "unavailable", {}, "error");
			};
			deadline = setTimeout(function () {
				cancel();
				status(output, "timeout", {}, "error");
			}, 1500);
			worker.postMessage({ id: current.element.dataset.lesson, source: current.editor.getValue() });
		} catch (error) {
			cancel();
			status(output, "unavailable", {}, "error");
		}
	}
	root.addEventListener("pagehide", cancel);
	root.TutorialCode = { mount, run, cancel };
})(typeof globalThis !== "undefined" ? globalThis : this);
