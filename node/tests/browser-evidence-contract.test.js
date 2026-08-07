"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("browser evidence executes and validator rejects malformed evidence", async () => {
	const root = path.resolve(__dirname, "../../..");
	const browser = fs.readFileSync(path.join(root, "scripts/browser-smoke.mjs"), "utf8");
	const expressionStartMarker = "const liveDeath = await cdp.evaluate(`";
	const expressionStart = browser.indexOf(expressionStartMarker);
	const findTemplateEnd = (source, start) => {
		let escaped = false;
		for (let index = start; index < source.length; index += 1) {
			const character = source[index];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (character === "\\") {
				escaped = true;
				continue;
			}
			if (character === "`") return index;
		}
		return -1;
	};
	const expressionEnd = findTemplateEnd(browser, expressionStart + expressionStartMarker.length);
	assert.notEqual(expressionStart, -1, "browser death expression was not found");
	assert.notEqual(expressionEnd, -1, "browser death expression terminator was not found");
	const expression = browser.slice(expressionStart + expressionStartMarker.length, expressionEnd);
	assert.doesNotThrow(() => new Function(expression));
	assert.equal((expression.match(/let currentTarget\s*=/g) || []).length, 1);
	assert.equal((expression.match(/const currentTarget\s*=/g) || []).length, 0);
	const createSocket = () => {
		const listeners = new Map();
		return {
			listeners,
			socket: {
				on(event, handler) {
					if (!listeners.has(event)) listeners.set(event, new Set());
					listeners.get(event).add(handler);
				},
				off(event, handler) {
					listeners.get(event)?.delete(handler);
				},
				emit(event, payload) {
					for (const handler of [...(listeners.get(event) || [])]) handler(payload);
				},
			},
		};
	};
	const { listeners, socket } = createSocket();
	const browserSicknessUntil = Date.now() + 4 * 60 * 1000;
	const character = {
		name: "hero",
		rip: false,
		map: "main",
		real_x: 0,
		real_y: 0,
		range: 100,
		mp: 100,
		max_hp: 100,
		hp: 100,
		max_mp: 100,
		death_sickness_until: browserSicknessUntil,
		skills: Object.fromEntries(
			["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"].map((name) => [
				name,
				{ level: 1, xp: 0 },
			]),
		),
	};
	const target = {
		id: "monster-1",
		type: "monster",
		mtype: "goo",
		map: "main",
		rip: false,
		hp: 100,
		x: 0,
		y: 0,
		target: null,
	};
	const originalUiLog = () => undefined;
	const windowContext = { entities: { [target.id]: target }, ui_log: originalUiLog };
	const execution = vm.runInNewContext(`(${expression})`, {
		character,
		G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
		window: windowContext,
		socket,
		smart_move: async () => undefined,
		use_ability: async (name, id) => {
			target.target = character.name;
			return { success: true, id: String(id), place: name };
		},
		TextEncoder,
		setTimeout,
		clearTimeout,
	});
	await new Promise((resolve) => setImmediate(resolve));
	windowContext.ui_log("Defeated by goo");
	socket.emit("hit", { id: character.name, hid: target.id, damage: 10, kill: true, source: "attack" });
	socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: target.mtype,
		death_sickness_until: character.death_sickness_until,
	});
	socket.emit("hit", { id: character.name, hid: "other-monster", damage: 8, kill: true, source: "attack" });
	socket.emit("hit", { id: character.name, hid: target.id, damage: 10, kill: true, source: "attack" });
	socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: target.mtype,
		death_sickness_until: character.death_sickness_until,
	});
	socket.emit("game_log", "Death sickness applied for 5 minutes");
	character.rip = true;
	socket.emit("player");
	const liveDeath = await execution;
	assert.equal(liveDeath.terminal_hit.victim_id, character.name);
	assert.equal(liveDeath.terminal_hit.attacker_id, target.id);
	assert.equal(liveDeath.terminal_hit.response.monster, target.mtype);
	assert.equal(liveDeath.terminal_hit.event_index, 3);
	assert.equal(liveDeath.terminal_hit.response_event_index, 4);
	assert.equal(liveDeath.victim_id, character.name);
	assert.equal(
		[...listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(windowContext.ui_log, originalUiLog);

	const ambiguous = createSocket();
	const ambiguousCharacter = structuredClone(character);
	const ambiguousTarget = structuredClone(target);
	const ambiguousUiLog = () => undefined;
	const ambiguousWindow = {
		entities: { [ambiguousTarget.id]: ambiguousTarget },
		ui_log: ambiguousUiLog,
	};
	const ambiguousExecution = vm.runInNewContext(`(${expression})`, {
		character: ambiguousCharacter,
		G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
		window: ambiguousWindow,
		socket: ambiguous.socket,
		smart_move: async () => undefined,
		use_ability: async (name, id) => {
			ambiguousTarget.target = ambiguousCharacter.name;
			return { success: true, id: String(id), place: name };
		},
		TextEncoder,
		setTimeout,
		clearTimeout,
	});
	await new Promise((resolve) => setImmediate(resolve));
	ambiguous.socket.emit("hit", {
		id: ambiguousCharacter.name,
		hid: ambiguousTarget.id,
		damage: 10,
		kill: true,
		source: "attack",
	});
	ambiguous.socket.emit("hit", { id: ambiguousCharacter.name, kill: true });
	ambiguous.socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: ambiguousTarget.mtype,
		death_sickness_until: ambiguousCharacter.death_sickness_until,
	});
	ambiguousCharacter.rip = true;
	ambiguous.socket.emit("player");
	const ambiguousDeath = await ambiguousExecution;
	assert.equal(ambiguousDeath.terminal_hit, null);
	assert.equal(
		[...ambiguous.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(ambiguousWindow.ui_log, ambiguousUiLog);

	const sameTypeOther = createSocket();
	const sameTypeOtherCharacter = structuredClone(character);
	sameTypeOtherCharacter.rip = false;
	const sameTypeOtherTarget = structuredClone(target);
	const sameTypeOtherUiLog = () => undefined;
	const sameTypeOtherWindow = {
		entities: { [sameTypeOtherTarget.id]: sameTypeOtherTarget },
		ui_log: sameTypeOtherUiLog,
	};
	const sameTypeOtherExecution = vm.runInNewContext(`(${expression})`, {
		character: sameTypeOtherCharacter,
		G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
		window: sameTypeOtherWindow,
		socket: sameTypeOther.socket,
		smart_move: async () => undefined,
		use_ability: async (name, id) => {
			sameTypeOtherTarget.target = sameTypeOtherCharacter.name;
			return { success: true, id: String(id), place: name };
		},
		TextEncoder,
		setTimeout,
		clearTimeout,
	});
	await new Promise((resolve) => setImmediate(resolve));
	sameTypeOther.socket.emit("hit", {
		id: sameTypeOtherCharacter.name,
		hid: "same-type-other-monster",
		damage: 10,
		kill: true,
		source: "attack",
	});
	sameTypeOther.socket.emit("game_response", {
		response: "defeated_by_a_monster",
		monster: sameTypeOtherTarget.mtype,
		death_sickness_until: sameTypeOtherCharacter.death_sickness_until,
	});
	sameTypeOtherCharacter.rip = true;
	sameTypeOther.socket.emit("player");
	const sameTypeOtherDeath = await sameTypeOtherExecution;
	assert.equal(sameTypeOtherDeath.terminal_hit, null);
	assert.equal(
		[...sameTypeOther.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(sameTypeOtherWindow.ui_log, sameTypeOtherUiLog);

	const executeExpression = ({
		failureCharacter,
		failureWindow,
		failureSocket,
		useAbility,
		scheduler = setTimeout,
		clearScheduler = clearTimeout,
	}) =>
		vm.runInNewContext(`(${expression})`, {
			character: failureCharacter,
			G: { abilities: { taunt: { mp: 1 } }, monsters: { goo: { passive: false } } },
			window: failureWindow,
			socket: failureSocket,
			smart_move: async () => undefined,
			use_ability: useAbility,
			TextEncoder,
			setTimeout: scheduler,
			clearTimeout: clearScheduler,
		});
	const createTrackedScheduler = () => {
		const scheduled = new Set();
		const cleared = new Set();
		return {
			scheduled,
			cleared,
			schedule(callback, delayMs) {
				const timer = setTimeout(callback, delayMs);
				scheduled.add(timer);
				return timer;
			},
			clear(timer) {
				cleared.add(timer);
				clearTimeout(timer);
			},
		};
	};
	const noTargetSocket = createSocket();
	const noTargetUiLog = () => undefined;
	const noTargetWindow = { entities: {}, ui_log: noTargetUiLog };
	const noTargetTimers = createTrackedScheduler();
	const noTargetExecution = executeExpression({
		failureCharacter: structuredClone(character),
		failureWindow: noTargetWindow,
		failureSocket: noTargetSocket.socket,
		useAbility: async () => ({ success: true }),
		scheduler: noTargetTimers.schedule,
		clearScheduler: noTargetTimers.clear,
	});
	await assert.rejects(noTargetExecution, /no live monster/);
	assert.equal(noTargetTimers.cleared.size, noTargetTimers.scheduled.size);
	assert.equal(
		[...noTargetSocket.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(noTargetWindow.ui_log, noTargetUiLog);

	const actionErrorSocket = createSocket();
	const actionErrorCharacter = structuredClone(character);
	const actionErrorTarget = structuredClone(target);
	const actionErrorUiLog = () => undefined;
	const actionErrorWindow = { entities: { [actionErrorTarget.id]: actionErrorTarget }, ui_log: actionErrorUiLog };
	const actionErrorTimers = createTrackedScheduler();
	const actionErrorExecution = executeExpression({
		failureCharacter: actionErrorCharacter,
		failureWindow: actionErrorWindow,
		failureSocket: actionErrorSocket.socket,
		useAbility: async () => ({ success: false }),
		scheduler: actionErrorTimers.schedule,
		clearScheduler: actionErrorTimers.clear,
	});
	await assert.rejects(actionErrorExecution, /taunt was rejected/);
	assert.equal(actionErrorTimers.cleared.size, actionErrorTimers.scheduled.size);
	assert.equal(
		[...actionErrorSocket.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(actionErrorWindow.ui_log, actionErrorUiLog);

	const timeoutSocket = createSocket();
	const timeoutCharacter = structuredClone(character);
	const timeoutTarget = structuredClone(target);
	const timeoutUiLog = () => undefined;
	const timeoutWindow = { entities: { [timeoutTarget.id]: timeoutTarget }, ui_log: timeoutUiLog };
	let timeoutCallback;
	let timeoutCleared = false;
	const timeoutExecution = executeExpression({
		failureCharacter: timeoutCharacter,
		failureWindow: timeoutWindow,
		failureSocket: timeoutSocket.socket,
		useAbility: async (name, id) => {
			timeoutTarget.target = timeoutCharacter.name;
			return { success: true, id: String(id), place: name };
		},
		scheduler: (callback, delayMs) => {
			if (delayMs === 10_000) {
				timeoutCallback = callback;
				return "synthetic-timeout";
			}
			return setTimeout(callback, delayMs);
		},
		clearScheduler: (timer) => {
			if (timer === "synthetic-timeout") timeoutCleared = true;
			else clearTimeout(timer);
		},
	});
	assert.equal(typeof timeoutCallback, "function");
	timeoutCallback();
	await assert.rejects(timeoutExecution, /did not publish death sickness/);
	assert.equal(timeoutCleared, true);
	assert.equal(
		[...timeoutSocket.listeners.values()].some((handlers) => handlers.size > 0),
		false,
	);
	assert.equal(timeoutWindow.ui_log, timeoutUiLog);

	const validatorPath = path.join(root, "scripts/validate-release-gate.mjs");
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adventureland-browser-contract-"));
	const logPath = path.join(temporaryDirectory, "browser.log");
	const resultPath = path.join(temporaryDirectory, "browser-result.json");
	const skills = Object.fromEntries(
		["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"].map((name) => [name, { level: 1, xp: 0 }]),
	);
	const browserMaxXp = Math.round(900_000_000 * ((1 / (99 - 1)) ** 2));
	const skillXpEvent = (skill, xp, priorXp = {}) => {
		const xpBySkill = Object.fromEntries(
			Object.keys(skills).map((name) => [name, priorXp[name] || 0]),
		);
		xpBySkill[skill] = xp;
		return {
			skill,
			accepted_xp: xp - (priorXp[skill] || 0),
			discarded_xp: 0,
			from_level: 1,
			to_level: 1,
			xp,
			max_xp: browserMaxXp,
			total_level: 7,
			skills: Object.fromEntries(
				Object.keys(skills).map((name) => [
					name,
					{ level: 1, xp: xpBySkill[name], max_xp: browserMaxXp },
				]),
			),
		};
	};
	const warriorEvent = skillXpEvent("warrior", 10);
	const rogueEvent = skillXpEvent("rogue", 10, { warrior: 10 });
	const result = {
		schemaVersion: 1,
		gate: "browser-smoke",
		ok: true,
		target: { database: "skill-smoke-test", disposable: true },
		evidence: logPath,
		character: "hero",
		cleanup: { deferred: true, verified: false },
		processes: { stopped: true },
		account: { ownerId: "owner-1", sentinelId: "sentinel-1" },
		browser: {
			ui: {
				domContract: true,
				equipment: { fail: true, pass: true },
				abilityGate: { passed: true },
				appearanceVariants: [1, 2, 3, 4].map((look) => ({
					name: `hero-look-${look}`,
					look,
					success: true,
				})),
				combat: {
					attempts: 1,
					xpBefore: 0,
					xpAfter: 10,
					skillXpBaseline: structuredClone(skills),
					skillXpObserved: true,
					skillXpEventCount: 2,
					skillXpEventsOverflowed: false,
					skillXpEvents: [warriorEvent, rogueEvent],
					warriorEventCount: 1,
					rogueEventCount: 1,
					warriorEventSnapshot: warriorEvent,
					rogueEventSnapshot: rogueEvent,
					postSwitch: {
						skill: "rogue",
						attempts: 1,
						xpBefore: 0,
						xpAfter: 10,
						xpObserved: true,
						eventObserved: true,
						eventSnapshot: rogueEvent,
						eventCount: 1,
					},
				},
				styleMatrix: {
					transitions: [
						["blade", "warrior"],
						["mace", "paladin"],
						["staff", "mage"],
						["wbook0", "priest"],
						["bow", "ranger"],
						["claw", "rogue"],
					].map(([weapon, skill]) => ({
						weapon,
						skill,
						activeSkill: skill,
						mainhand: weapon,
					})),
					heal: { success: true },
					support: { success: true, target: "monster-1" },
				},
				standLock: { stand: true, standOpenObserved: true },
				expiryEvidence: { sicknessCleared: true, standClosed: true },
				liveDeath: {
					rip: true,
					sickness: browserSicknessUntil,
					target: {
						id: "monster-1",
						type: "goo",
						aggro: true,
						action: { id: "monster-1", place: "attack" },
					},
					victim_id: "hero",
					terminal_hit: {
						attacker_id: "monster-1",
						victim_id: "hero",
						kill: true,
						damage: 10,
						event_index: 3,
						response_event_index: 4,
						response: {
							response: "defeated_by_a_monster",
							monster: "goo",
							death_sickness_until: browserSicknessUntil,
						},
					},
					responses: [
						{
							response: "defeated_by_a_monster",
							monster: "goo",
							death_sickness_until: browserSicknessUntil,
						},
					],
					serverLogs: ["Death sickness applied for 5 minutes"],
					uiLogs: ["Defeated by goo", "Death sickness applied for 5 minutes"],
					skills,
					skillsBefore: structuredClone(skills),
				},
			},
		},
	};
	const runValidator = (
		candidate,
		expectedExit = false,
		expectedGate = "browser-smoke",
		expectedDatabase = "skill-smoke-test",
	) => {
		fs.writeFileSync(resultPath, JSON.stringify(candidate));
		fs.writeFileSync(logPath, `${JSON.stringify(candidate)}\n`);
		const invoke = () =>
			execFileSync(process.execPath, [validatorPath, logPath, expectedGate, expectedDatabase, resultPath], {
				cwd: root,
				stdio: "pipe",
			});
		if (expectedExit) assert.throws(invoke);
		else assert.doesNotThrow(invoke);
	};
	try {
		runValidator(result);
		fs.writeFileSync(logPath, `${JSON.stringify(result)}\n{"password":"private"}\n`);
		assert.throws(() =>
			execFileSync(process.execPath, [validatorPath, logPath, "browser-smoke", "skill-smoke-test", resultPath], {
				cwd: root,
				stdio: "pipe",
			}),
		);
		runValidator(result);
		const discardedEventResult = structuredClone(result);
		const cappedXp = 900_000_000;
		discardedEventResult.browser.ui.combat.skillXpBaseline.merchant = {
			level: 99,
			xp: cappedXp,
		};
		const cappedEvents = discardedEventResult.browser.ui.combat.skillXpEvents.map((event) => {
			const next = structuredClone(event);
			next.skills.merchant = { level: 99, xp: cappedXp, max_xp: null };
			next.total_level += 98;
			return next;
		});
		const discardedEvent = {
			skill: "merchant",
			accepted_xp: 0,
			discarded_xp: 123,
			from_level: 99,
			to_level: 99,
			xp: cappedXp,
			max_xp: null,
			total_level: 105,
			skills: structuredClone(cappedEvents.at(-1).skills),
		};
		discardedEventResult.browser.ui.combat.skillXpEvents = [...cappedEvents, discardedEvent];
		discardedEventResult.browser.ui.combat.skillXpEventCount = 3;
		discardedEventResult.browser.ui.combat.warriorEventSnapshot = cappedEvents[0];
		discardedEventResult.browser.ui.combat.rogueEventSnapshot = cappedEvents[1];
		discardedEventResult.browser.ui.combat.postSwitch.eventSnapshot = cappedEvents[1];
		runValidator(discardedEventResult);
		const browserMutations = [
			(candidate) => delete candidate.browser.ui.combat.skillXpEvents[0].skills.merchant,
			(candidate) => { candidate.browser.ui.combat.skillXpEvents[1].skills.warrior.xp = 0; },
			(candidate) => { candidate.browser.ui.combat.skillXpEvents[0].accepted_xp = 0; },
			(candidate) => { candidate.browser.ui.combat.skillXpEvents[0].unexpected = true; },
			(candidate) => delete candidate.browser.ui.combat.warriorEventSnapshot.skills.merchant,
			(candidate) => { candidate.browser.ui.combat.warriorEventSnapshot.skills.warrior.max_xp = -1; },
			(candidate) => { candidate.browser.ui.combat.postSwitch.xpAfter = 0; },
			(candidate) => { candidate.browser.ui.combat.skillXpEventCount = 0; },
			(candidate) => {
				candidate.browser.ui.combat.skillXpEventsOverflowed = true;
			},
			(candidate) => { candidate.browser.ui.styleMatrix.transitions[0].mainhand = "mace"; },
			(candidate) => { candidate.browser.ui.appearanceVariants[0].look = 4; },
			(candidate) => { candidate.browser.ui.standLock.standOpenObserved = false; },
			(candidate) => { candidate.browser.ui.expiryEvidence.standClosed = false; },
		];
		for (const mutate of browserMutations) {
			const malformed = structuredClone(result);
			mutate(malformed);
			runValidator(malformed, true);
		}
		const symlinkLogPath = path.join(temporaryDirectory, "browser-log-symlink.log");
		fs.symlinkSync(logPath, symlinkLogPath);
		assert.throws(() =>
			execFileSync(process.execPath, [validatorPath, symlinkLogPath, "browser-smoke", "skill-smoke-test", resultPath], {
				cwd: root,
				stdio: "pipe",
			}),
		);
		const malformedHit = structuredClone(result);
		malformedHit.browser.ui.liveDeath.terminal_hit.attacker_id = "other-monster";
		runValidator(malformedHit, true);
		const malformedVictim = structuredClone(result);
		malformedVictim.browser.ui.liveDeath.terminal_hit.victim_id = "other-player";
		runValidator(malformedVictim, true);
		const negativeIndexes = structuredClone(result);
		negativeIndexes.browser.ui.liveDeath.terminal_hit.event_index = -1;
		negativeIndexes.browser.ui.liveDeath.terminal_hit.response_event_index = 0;
		runValidator(negativeIndexes, true);
		const staleSickness = structuredClone(result);
		staleSickness.browser.ui.liveDeath.sickness = 123;
		staleSickness.browser.ui.liveDeath.terminal_hit.response.death_sickness_until = 123;
		staleSickness.browser.ui.liveDeath.terminal_hit.response_event_index = 4;
		staleSickness.browser.ui.liveDeath.responses[0].death_sickness_until = 123;
		runValidator(staleSickness, true);
		const mismatchedOuterIdentity = structuredClone(result);
		mismatchedOuterIdentity.character = "other-player";
		runValidator(mismatchedOuterIdentity, true);
		const emptyOuterIdentity = structuredClone(result);
		emptyOuterIdentity.character = "";
		runValidator(emptyOuterIdentity, true);
		const malformedSkills = structuredClone(result);
		delete malformedSkills.browser.ui.liveDeath.skills.merchant;
		runValidator(malformedSkills, true);
		const malformedLevel = structuredClone(result);
		malformedLevel.browser.ui.liveDeath.skills.warrior.level = 100;
		runValidator(malformedLevel, true);
		const changedSnapshot = structuredClone(result);
		changedSnapshot.browser.ui.liveDeath.skillsBefore.warrior.xp = 1;
		runValidator(changedSnapshot, true);
		const oversizedResponses = structuredClone(result);
		oversizedResponses.browser.ui.liveDeath.responses = [
			...result.browser.ui.liveDeath.responses,
			...Array.from({ length: 16 }, () => ({ response: "noise" })),
		];
		runValidator(oversizedResponses, true);
		const unknownResponseField = structuredClone(result);
		unknownResponseField.browser.ui.liveDeath.responses[0].secret = "unexpected";
		runValidator(unknownResponseField, true);
		const unknownTerminalResponseField = structuredClone(result);
		unknownTerminalResponseField.browser.ui.liveDeath.terminal_hit.response.secret = "unexpected";
		runValidator(unknownTerminalResponseField, true);
		const oversizedLog = structuredClone(result);
		oversizedLog.browser.ui.liveDeath.serverLogs = ["Death sickness applied for 5 minutes", "x".repeat(257)];
		runValidator(oversizedLog, true);
		const multibyteOversizedLog = structuredClone(result);
		multibyteOversizedLog.browser.ui.liveDeath.serverLogs = ["Death sickness applied for 5 minutes", "é".repeat(200)];
		runValidator(multibyteOversizedLog, true);
		runValidator(result, true, "unsupported-gate");
		runValidator(result, true, "browser-smoke", "other-database");
		const configuredDatabase = structuredClone(result);
		configuredDatabase.target.database = "adventureland";
		runValidator(configuredDatabase, true, "browser-smoke", "adventureland");
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});
