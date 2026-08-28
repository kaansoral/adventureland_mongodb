var ADMIN_BOTS_COLLECTION = "admin_bots_control";
var ADMIN_BOTS_MAX_REPORT_BYTES = 512 * 1024;
var ADMIN_MAINFRAME_CODE_MAX_BYTES = 1150 * 1024;
var ADMIN_BOTS_COMMAND_TTL_MS = 60 * 1000;
var ADMIN_BOTS_AGENT_ID = "usd2";
var ADMIN_BOTS_CONTROL_SECRET = null;
try {
	ADMIN_BOTS_CONTROL_SECRET = require("./secretsandconfig/bots_usd2_controller.json");
} catch (e) {}

function admin_bots_configured() {
	return !!(ADMIN_BOTS_CONTROL_SECRET && ADMIN_BOTS_CONTROL_SECRET.control_token);
}

function admin_bots_agent_id() {
	return admin_bots_configured() ? ADMIN_BOTS_AGENT_ID : "";
}

function admin_bots_safe_equal(left, right) {
	if (typeof left !== "string" || typeof right !== "string") return false;
	var left_buffer = Buffer.from(left, "utf8");
	var right_buffer = Buffer.from(right, "utf8");
	return left_buffer.length === right_buffer.length && crypto.timingSafeEqual(left_buffer, right_buffer);
}

function admin_bots_agent_authorized(req) {
	if (!admin_bots_configured()) return false;
	var authorization = String(req.get("authorization") || "");
	return admin_bots_safe_equal(authorization, "Bearer " + ADMIN_BOTS_CONTROL_SECRET.control_token);
}

function admin_bots_number(value, minimum, maximum) {
	value = Number(value);
	if (!Number.isFinite(value)) return null;
	return Math.max(minimum, Math.min(maximum, value));
}

function admin_bots_text(value, maximum) {
	return String(value === undefined || value === null ? "" : value).slice(0, maximum);
}

function admin_bots_boolean(value) {
	return typeof value === "boolean" ? value : null;
}

function admin_bots_log_value(value) {
	if (typeof value === "string") return value.slice(0, 4096);
	if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
	try {
		return JSON.stringify(JSON.parse(JSON.stringify(value))).slice(0, 4096);
	} catch (e) {
		return admin_bots_text(value, 4096);
	}
}

function admin_bots_clean_logs(logs) {
	if (!Array.isArray(logs)) return [];
	return logs.slice(-100).map(function (entry) {
		return {
			at: admin_bots_text(entry && entry.at, 40),
			level: admin_bots_text(entry && entry.level, 20),
			values: Array.isArray(entry && entry.values) ? entry.values.slice(0, 20).map(admin_bots_log_value) : [],
		};
	});
}

function admin_bots_clean_rate_summary(summary) {
	if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
	var result = {};
	[
		"window_ms",
		"active_seconds",
		"damage",
		"dps",
		"healing",
		"hps",
		"kills",
		"deaths",
		"gold_gained",
		"gold_spent",
		"gold_net",
		"gps",
		"xp_gained",
		"xp_lost",
		"xp_net",
		"xps",
	].forEach(function (name) {
		result[name] = admin_bots_number(summary[name], -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
	});
	if (Object.prototype.hasOwnProperty.call(summary, "started_at")) result.started_at = admin_bots_text(summary.started_at, 40) || null;
	if (Object.prototype.hasOwnProperty.call(summary, "ended_at")) result.ended_at = admin_bots_text(summary.ended_at, 40) || null;
	if (Object.prototype.hasOwnProperty.call(summary, "auth_debuff")) result.auth_debuff = admin_bots_boolean(summary.auth_debuff);
	return result;
}

function admin_bots_clean_performance(performance) {
	if (!performance || typeof performance !== "object" || Array.isArray(performance)) return null;
	return {
		session: admin_bots_clean_rate_summary(performance.session),
		rolling_24h: admin_bots_clean_rate_summary(performance.rolling_24h),
	};
}

function admin_bots_clean_containment(containment) {
	if (!containment || typeof containment !== "object" || Array.isArray(containment)) return null;
	var limits = containment.limits && typeof containment.limits === "object" ? containment.limits : {};
	return {
		sampled_at: admin_bots_text(containment.sampled_at, 40) || null,
		identity_slot: admin_bots_number(containment.identity_slot, 0, 99),
		kvm_pit_cgrouped: containment.kvm_pit_cgrouped === true,
		uptime_seconds: admin_bots_number(containment.uptime_seconds, 0, Number.MAX_SAFE_INTEGER),
		memory_current_bytes: admin_bots_number(containment.memory_current_bytes, 0, Number.MAX_SAFE_INTEGER),
		memory_peak_bytes: admin_bots_number(containment.memory_peak_bytes, 0, Number.MAX_SAFE_INTEGER),
		memory_events_oom: admin_bots_number(containment.memory_events_oom, 0, Number.MAX_SAFE_INTEGER),
		memory_events_oom_kill: admin_bots_number(containment.memory_events_oom_kill, 0, Number.MAX_SAFE_INTEGER),
		cpu_usage_usec: admin_bots_number(containment.cpu_usage_usec, 0, Number.MAX_SAFE_INTEGER),
		cpu_throttled_usec: admin_bots_number(containment.cpu_throttled_usec, 0, Number.MAX_SAFE_INTEGER),
		cpu_nr_throttled: admin_bots_number(containment.cpu_nr_throttled, 0, Number.MAX_SAFE_INTEGER),
		pids_current: admin_bots_number(containment.pids_current, 0, 64),
		io_read_bytes: admin_bots_number(containment.io_read_bytes, 0, Number.MAX_SAFE_INTEGER),
		io_write_bytes: admin_bots_number(containment.io_write_bytes, 0, Number.MAX_SAFE_INTEGER),
		io_read_operations: admin_bots_number(containment.io_read_operations, 0, Number.MAX_SAFE_INTEGER),
		io_write_operations: admin_bots_number(containment.io_write_operations, 0, Number.MAX_SAFE_INTEGER),
		status_failures: admin_bots_number(containment.status_failures, 0, 3),
		memory_pressure_samples: admin_bots_number(containment.memory_pressure_samples, 0, 3),
		limits: {
			memory_max_bytes: admin_bots_number(limits.memory_max_bytes, 0, Number.MAX_SAFE_INTEGER),
			cpu_quota_ratio: admin_bots_number(limits.cpu_quota_ratio, 0, 1),
			io_read_bytes_per_second: admin_bots_number(limits.io_read_bytes_per_second, 0, Number.MAX_SAFE_INTEGER),
			io_write_bytes_per_second: admin_bots_number(limits.io_write_bytes_per_second, 0, Number.MAX_SAFE_INTEGER),
			io_read_operations_per_second: admin_bots_number(limits.io_read_operations_per_second, 0, Number.MAX_SAFE_INTEGER),
			io_write_operations_per_second: admin_bots_number(limits.io_write_operations_per_second, 0, Number.MAX_SAFE_INTEGER),
		},
	};
}

function admin_bots_clean_observation(observation) {
	if (!observation || typeof observation !== "object" || Array.isArray(observation) || observation.source !== "game_server") return null;
	var movement = observation.movement && typeof observation.movement === "object" ? observation.movement : {};
	return {
		source: "game_server",
		observed_at: admin_bots_text(observation.observed_at, 40) || null,
		age_ms: admin_bots_number(observation.age_ms, 0, Number.MAX_SAFE_INTEGER),
		activity: ["unknown", "dead", "stuck", "moving", "stationary"].includes(observation.activity) ? observation.activity : "unknown",
		map: admin_bots_text(observation.map, 100),
		x: admin_bots_number(observation.x, -10000000, 10000000),
		y: admin_bots_number(observation.y, -10000000, 10000000),
		hp: admin_bots_number(observation.hp, 0, Number.MAX_SAFE_INTEGER),
		max_hp: admin_bots_number(observation.max_hp, 0, Number.MAX_SAFE_INTEGER),
		mp: admin_bots_number(observation.mp, 0, Number.MAX_SAFE_INTEGER),
		max_mp: admin_bots_number(observation.max_mp, 0, Number.MAX_SAFE_INTEGER),
		rip: observation.rip === true,
		level: admin_bots_number(observation.level, 0, 1000),
		xp: admin_bots_number(observation.xp, 0, Number.MAX_SAFE_INTEGER),
		gold: admin_bots_number(observation.gold, 0, Number.MAX_SAFE_INTEGER),
		target: observation.target === null || observation.target === undefined ? null : admin_bots_text(observation.target, 128),
		moving: observation.moving === true,
		going_x: admin_bots_number(observation.going_x, -10000000, 10000000),
		going_y: admin_bots_number(observation.going_y, -10000000, 10000000),
		movement: {
			stuck: movement.stuck === true,
			stationary_ms: admin_bots_number(movement.stationary_ms, 0, Number.MAX_SAFE_INTEGER),
			position_changed_at: admin_bots_text(movement.position_changed_at, 40) || null,
			distance_observed: admin_bots_number(movement.distance_observed, 0, Number.MAX_SAFE_INTEGER),
			map_changes_observed: admin_bots_number(movement.map_changes_observed, 0, Number.MAX_SAFE_INTEGER),
			map_changed_at: admin_bots_text(movement.map_changed_at, 40) || null,
			move_requests_since_position_change: admin_bots_number(movement.move_requests_since_position_change, 0, Number.MAX_SAFE_INTEGER),
			transition_requests_since_map_change: admin_bots_number(movement.transition_requests_since_map_change, 0, Number.MAX_SAFE_INTEGER),
		},
	};
}

function admin_bots_clean_bot(bot) {
	if (!bot || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(bot.bot_id || "")) return null;
	var metrics = bot.metrics && typeof bot.metrics === "object" ? bot.metrics : {};
	var startup = bot.startup && typeof bot.startup === "object" ? bot.startup : {};
	var traffic = bot.traffic && typeof bot.traffic === "object" ? bot.traffic : {};
	var pathfinding = bot.pathfinding && typeof bot.pathfinding === "object" ? bot.pathfinding : {};
	var failure = bot.failure && typeof bot.failure === "object" && !Array.isArray(bot.failure) ? bot.failure : null;
	var actions = traffic.actions_by_event && typeof traffic.actions_by_event === "object" ? traffic.actions_by_event : {};
	var clean_actions = {};
	Object.keys(actions)
		.slice(0, 30)
		.forEach(function (name) {
			if (/^[A-Za-z0-9_.:-]{1,64}$/.test(name)) clean_actions[name] = admin_bots_number(actions[name], 0, Number.MAX_SAFE_INTEGER);
		});
	return {
		bot_id: bot.bot_id,
		character_id: /^CH_[A-Za-z0-9_-]{1,100}$/.test(bot.character_id || "") ? bot.character_id : null,
		assignment_id: /^[0-9a-f]{32}$/.test(bot.assignment_id || "") ? bot.assignment_id : null,
		assignment_revision: admin_bots_number(bot.assignment_revision, 0, Number.MAX_SAFE_INTEGER),
		desired_state: ["running", "stopped"].includes(bot.desired_state) ? bot.desired_state : "stopped",
		code_slot: admin_bots_text(bot.code_slot, 100),
		server: admin_bots_text(bot.server, 50),
		generation: admin_bots_number(bot.generation, 0, 2147483647),
		phase: admin_bots_text(bot.phase, 40),
		last_heartbeat_ms: admin_bots_number(bot.last_heartbeat_ms, 0, Number.MAX_SAFE_INTEGER),
		game_connected: bot.game_connected === true,
		map: admin_bots_text(bot.map, 100),
		observation: admin_bots_clean_observation(bot.observation),
		uptime_ms: admin_bots_number(bot.uptime_ms, 0, Number.MAX_SAFE_INTEGER),
		metrics: {
			heap_used: admin_bots_number(metrics.heap_used, 0, Number.MAX_SAFE_INTEGER),
			rss: admin_bots_number(metrics.rss, 0, Number.MAX_SAFE_INTEGER),
			memory_limit: admin_bots_number(metrics.memory_limit, 0, Number.MAX_SAFE_INTEGER),
			cpu_ratio: admin_bots_number(metrics.cpu_ratio, 0, 100),
			event_loop_lag_ms: admin_bots_number(metrics.event_loop_lag_ms, 0, 60000),
			monotonic_ms: admin_bots_number(metrics.monotonic_ms, 0, Number.MAX_SAFE_INTEGER),
			guest_memory_used: admin_bots_number(metrics.guest_memory_used, 0, Number.MAX_SAFE_INTEGER),
			guest_cpu_ratio: admin_bots_number(metrics.guest_cpu_ratio, 0, 100),
			guest_processes: admin_bots_number(metrics.guest_processes, 0, 1000),
			seccomp_mode: admin_bots_number(metrics.seccomp_mode, 0, 2),
			no_new_privileges: admin_bots_number(metrics.no_new_privileges, 0, 1),
			permission_model: admin_bots_boolean(metrics.permission_model),
		},
		startup: {
			bootstrapped_ms: admin_bots_number(startup.bootstrapped_ms, 0, Number.MAX_SAFE_INTEGER),
			running_ms: admin_bots_number(startup.running_ms, 0, Number.MAX_SAFE_INTEGER),
		},
		traffic: {
			game_events_total: admin_bots_number(traffic.game_events_total, 0, Number.MAX_SAFE_INTEGER),
			actions_total: admin_bots_number(traffic.actions_total, 0, Number.MAX_SAFE_INTEGER),
			actions_by_event: clean_actions,
		},
		pathfinding: {
			requests_total: admin_bots_number(pathfinding.requests_total, 0, Number.MAX_SAFE_INTEGER),
			average_compute_ms: admin_bots_number(pathfinding.average_compute_ms, 0, 60000),
			max_compute_ms: admin_bots_number(pathfinding.max_compute_ms, 0, 60000),
		},
		failure:
			failure && /^[A-Z][A-Z0-9_]{2,63}$/.test(failure.code || "")
				? {
						assignment_id: /^[0-9a-f]{32}$/.test(failure.assignment_id || "") ? failure.assignment_id : null,
						code: failure.code,
						at: admin_bots_text(failure.at, 40) || null,
					}
				: null,
		performance: admin_bots_clean_performance(bot.performance),
		containment: admin_bots_clean_containment(bot.containment),
		logs: admin_bots_clean_logs(bot.logs),
	};
}

function admin_bots_clean_report(report) {
	var bots = Array.isArray(report && report.bots) ? report.bots.slice(0, 100) : [];
	return {
		version: 1,
		controller_version: admin_bots_text(report && report.controller_version, 40),
		bots: bots.map(admin_bots_clean_bot).filter(Boolean),
		reported_at: new Date(),
	};
}

async function admin_bots_document() {
	if (!admin_bots_configured()) return null;
	return await db.collection(ADMIN_BOTS_COLLECTION).findOne({ _id: admin_bots_agent_id() });
}

async function admin_bots_snapshot() {
	var document = await admin_bots_document();
	var report = (document && document.report) || { bots: [] };
	var updated = document && document.updated ? new Date(document.updated) : null;
	var age_ms = updated && Number.isFinite(updated.getTime()) ? Date.now() - updated.getTime() : null;
	var pending = {};
	for (var command of (document && document.commands) || []) pending[command.bot_id] = command.desired_state;
	return {
		success: true,
		configured: admin_bots_configured(),
		online: age_ms !== null && age_ms < 10000,
		controller_version: admin_bots_text(report.controller_version, 40) || null,
		updated_at: updated ? updated.toISOString() : null,
		age_ms: age_ms,
		bots: (report.bots || []).map(function (bot) {
			return Object.assign({}, bot, { pending_state: pending[bot.bot_id] || null });
		}),
	};
}

async function admin_mainframe_snapshot() {
	var snapshot = await admin_bots_snapshot();
	var character_mark_ids = snapshot.bots
		.filter(function (bot) {
			return !bot.character_id;
		})
		.map(function (bot) {
			return "MK_character-" + simplify_name(bot.bot_id);
		});
	var character_marks = character_mark_ids.length
		? await db
				.collection("mark")
				.find({ _id: { $in: character_mark_ids } })
				.limit(100)
				.toArray()
		: [];
	var access_ids = snapshot.bots
		.map(function (bot) {
			return bot.character_id && mainframe_access_record_id(bot.character_id);
		})
		.filter(Boolean);
	for (var i = 0; i < character_marks.length; i++) access_ids.push(mainframe_access_record_id(character_marks[i].owner));
	access_ids = Array.from(new Set(access_ids));
	var access_records = access_ids.length
		? await db
				.collection("mark")
				.find({ _id: { $in: access_ids } })
				.limit(100)
				.toArray()
		: [];
	var access_by_id = {};
	for (var i = 0; i < access_records.length; i++) access_by_id[access_records[i]._id] = access_records[i];
	var character_id_by_name = {};
	for (var i = 0; i < character_marks.length; i++) {
		var character_name = character_marks[i].phrase || character_marks[i]._id.slice("MK_character-".length);
		character_id_by_name[character_name] = character_marks[i].owner;
	}
	snapshot.bots = snapshot.bots.map(function (bot) {
		var character_id = bot.character_id || character_id_by_name[simplify_name(bot.bot_id)];
		var access = character_id && access_by_id[mainframe_access_record_id(character_id)];
		return Object.assign({}, bot, { mainframe_access: mainframe_access_to_client(access) });
	});
	return snapshot;
}

async function admin_bots_find(bot_id) {
	var snapshot = await admin_bots_snapshot();
	return snapshot.bots.find(function (bot) {
		return bot.bot_id === bot_id || bot.character_id === bot_id;
	});
}

async function admin_bots_queue_state(bot_id, desired_state, requested_by) {
	bot_id = String(bot_id || "");
	if (!/^[A-Za-z0-9_.:@-]{1,128}$/.test(bot_id)) return { failed: true, reason: "invalid_character" };
	if (!["running", "stopped"].includes(desired_state)) return { failed: true, reason: "invalid_state" };
	var bot = await admin_bots_find(bot_id);
	if (!bot) return { failed: true, reason: "character_not_found" };
	var now = new Date();
	var command = {
		id: crypto.randomBytes(16).toString("hex"),
		bot_id: bot_id,
		desired_state: desired_state,
		requested_by: admin_bots_text(requested_by, 160),
		created_at: now,
		expires_at: new Date(now.getTime() + ADMIN_BOTS_COMMAND_TTL_MS),
	};
	var result = await db.collection(ADMIN_BOTS_COLLECTION).updateOne({ _id: admin_bots_agent_id(), "commands.99": { $exists: false } }, { $push: { commands: command } });
	if (!result.matchedCount) return { failed: true, reason: "bots_busy" };
	return { success: true, queued: true, command_id: command.id, bot: Object.assign({}, bot, { pending_state: desired_state }) };
}

async function admin_bots_owned_character(user, name) {
	var characters = await get_characters(user);
	return characters.find(function (character) {
		return (character && character.info && character.info.name) === name || character.name === name;
	});
}

app.post("/internal/bots/control", async function (req, res) {
	res.set("Cache-Control", "no-store");
	if (!admin_bots_agent_authorized(req)) return res.status(401).send({ failed: true, reason: "unauthorized" });
	var body = req.body;
	if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).send({ failed: true, reason: "invalid_body" });
	if (Buffer.byteLength(JSON.stringify(body), "utf8") > ADMIN_BOTS_MAX_REPORT_BYTES) return res.status(413).send({ failed: true, reason: "report_too_large" });
	if (body.version !== 1 || body.agent_id !== admin_bots_agent_id()) return res.status(400).send({ failed: true, reason: "invalid_agent" });
	var completed = Array.isArray(body.completed) ? body.completed.slice(0, 20) : [];
	if (
		!completed.every(function (id) {
			return /^[0-9a-f]{32}$/.test(id);
		})
	)
		return res.status(400).send({ failed: true, reason: "invalid_completed" });
	var now = new Date();
	var report = admin_bots_clean_report(body.report || {});
	var pull = { expires_at: { $lt: now } };
	if (completed.length) pull = { $or: [{ id: { $in: completed } }, { expires_at: { $lt: now } }] };
	await db.collection(ADMIN_BOTS_COLLECTION).updateOne({ _id: admin_bots_agent_id() }, { $setOnInsert: { created: now, commands: [] } }, { upsert: true });
	await db.collection(ADMIN_BOTS_COLLECTION).updateOne(
		{ _id: admin_bots_agent_id() },
		{
			$set: { report: report, updated: now },
			$pull: { commands: pull },
		},
	);
	await mainframe_record_controller_failures(report);
	var document = await admin_bots_document();
	var commands = ((document && document.commands) || []).slice(0, 10).map(function (command) {
		return { id: command.id, bot_id: command.bot_id, desired_state: command.desired_state };
	});
	var assignments = await mainframe_controller_assignments(body.agent_id);
	return res.status(200).send({ success: true, commands: commands, assignments: assignments });
});

app.post("/internal/mainframe/code", async function (req, res) {
	res.set("Cache-Control", "no-store");
	if (!admin_bots_agent_authorized(req)) return res.status(401).send({ failed: true, reason: "unauthorized" });
	var body = req.body;
	if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).send({ failed: true, reason: "invalid_body" });
	if (Buffer.byteLength(JSON.stringify(body), "utf8") > ADMIN_MAINFRAME_CODE_MAX_BYTES)
		return res.status(413).send({ failed: true, reason: "request_too_large" });
	if (
		Object.keys(body).sort().join(",") !== "agent_id,assignment_id,character_id,data,operation,request_id,version" ||
		body.version !== 1 ||
		body.agent_id !== admin_bots_agent_id() ||
		!/^[0-9a-f]{32}$/.test(body.assignment_id || "") ||
		!/^CH_[A-Za-z0-9_-]{1,100}$/.test(body.character_id || "") ||
		!/^[A-Za-z0-9_-]{1,80}$/.test(body.request_id || "") ||
		!["change_server", "command_character", "start_character", "stop_character", "upload_code"].includes(body.operation) ||
		!body.data ||
		typeof body.data !== "object" ||
		Array.isArray(body.data)
	)
		return res.status(400).send({ failed: true, reason: "invalid_request" });
	var fields = {
		change_server: ["name", "region"],
		command_character: ["character", "code"],
		start_character: ["character", "code_slot"],
		stop_character: ["character"],
		upload_code: ["code", "name", "slot"],
	}[body.operation];
	if (
		Object.keys(body.data).sort().join(",") !== fields.slice().sort().join(",") ||
		!fields.every(function (name) {
			return typeof body.data[name] === "string";
		})
	)
		return res.status(400).send({ failed: true, reason: "invalid_data" });
	return res.status(200).send({ success: true, result: await mainframe_code_action(body) });
});

app.get("/admin/mainframe", async function (req, res) {
	var user = await get_user(req);
	if (!is_admin(user)) return res.status(403).set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").send("No Auth");
	var domain = await get_domain(req, user);
	domain.title = "Adventure Land Mainframe";
	return res
		.status(200)
		.set("Cache-Control", "no-store")
		.set("X-Robots-Tag", "noindex, nofollow")
		.send(nunjucks.render("htmls/admin_bots.html", { domain: domain, user: user }));
});

app.get("/admin/mainframe/state", async function (req, res) {
	var user = await get_user(req);
	if (!is_admin(user)) return res.status(403).set("Cache-Control", "no-store").send({ failed: true, reason: "unauthorized" });
	return res
		.status(200)
		.set("Cache-Control", "no-store")
		.send(await admin_mainframe_snapshot());
});

app.post("/admin/mainframe/state", async function (req, res) {
	var user = await get_user(req);
	if (!is_admin(user)) return res.status(403).set("Cache-Control", "no-store").send({ failed: true, reason: "unauthorized" });
	var body = req.body;
	if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).send({ failed: true, reason: "invalid_body" });
	if (
		!Object.keys(body).every(function (name) {
			return ["character", "desired_state"].includes(name);
		})
	)
		return res.status(400).send({ failed: true, reason: "invalid_field" });
	if (body.desired_state === "running") {
		var bot = await admin_bots_find(body.character);
		if (!bot) return res.status(400).set("Cache-Control", "no-store").send({ failed: true, reason: "character_not_found" });
		var character = await get_character(body.character, true);
		var grant = await mainframe_grant_operator_access(character, get_id(user));
		if (grant.failed) return res.status(400).set("Cache-Control", "no-store").send(grant);
	}
	var result = await admin_bots_queue_state(body.character, body.desired_state, get_id(user));
	return res
		.status(result.failed ? 400 : 200)
		.set("Cache-Control", "no-store")
		.send(result);
});
