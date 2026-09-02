var MAINFRAME_PERIOD_MS = 60 * 60 * 1000;
var MAINFRAME_PERIOD_SHELLS = 1;
var MAINFRAME_STEAM_FREE_PERIODS = 250;
var MAINFRAME_STEAM_ID_PATTERN = /^[0-9]{16,20}$/;
var MAINFRAME_REQUEST_PATTERN = /^[A-Za-z0-9_.:@-]{16,100}$/;
var MAINFRAME_CODE_SLOT_PATTERN = /^[A-Za-z0-9_.+ -]{1,100}$/;
var MAINFRAME_GROUP_MAX_WORKERS = 4;
var MAINFRAME_RENEWAL_MINUTES = Object.freeze({ 1: 60, 2: 50, 3: 45, 4: 40 });
var MAINFRAME_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
var MAINFRAME_EVENT_MAX_ENTRIES = 200;
var MAINFRAME_CONTROLLER_COLLECTION = "admin_bots_control";
var MAINFRAME_CONTROLLERS = Object.freeze({
	w1: Object.freeze({ capacity: 300 }),
	usd2: Object.freeze({ capacity: 100 }),
});

function mainframe_period_minutes(active_characters) {
	if (!Number.isSafeInteger(active_characters) || active_characters < 1 || active_characters > MAINFRAME_GROUP_MAX_WORKERS) return MAINFRAME_RENEWAL_MINUTES[1];
	return MAINFRAME_RENEWAL_MINUTES[active_characters];
}

function mainframe_renewal_schedule() {
	return Object.keys(MAINFRAME_RENEWAL_MINUTES).map(function (characters) {
		return { characters: Number(characters), minutes: MAINFRAME_RENEWAL_MINUTES[characters] };
	});
}

function mainframe_controller_ids() {
	return Object.keys(MAINFRAME_CONTROLLERS);
}

function mainframe_controller_is_known(agent_id) {
	return Object.prototype.hasOwnProperty.call(MAINFRAME_CONTROLLERS, agent_id);
}

function mainframe_preferred_controller(server) {
	return server && /^US\s/i.test(server.label || "") ? "usd2" : "w1";
}

async function mainframe_select_controller(server, required_controller) {
	if (required_controller && !mainframe_controller_is_known(required_controller)) return null;
	var ids = mainframe_controller_ids();
	var documents = await db
		.collection(MAINFRAME_CONTROLLER_COLLECTION)
		.find({ _id: { $in: ids } })
		.limit(ids.length)
		.toArray();
	var by_id = {};
	for (var document of documents) by_id[document._id] = document;
	var preferred = required_controller || mainframe_preferred_controller(server);
	var order = [preferred].concat(
		ids.filter(function (agent_id) {
			return agent_id !== preferred;
		}),
	);
	for (var agent_id of order) {
		var document = by_id[agent_id];
		var updated = document && document.updated ? new Date(document.updated) : null;
		var online = updated && Number.isFinite(updated.getTime()) && Date.now() - updated.getTime() < 10000;
		var active = ((document && document.report && document.report.bots) || []).filter(function (bot) {
			return bot && (bot.desired_state === "running" || ["loading_code", "starting", "bootstrapped", "running", "stopping"].includes(bot.phase));
		}).length;
		if (online && active < MAINFRAME_CONTROLLERS[agent_id].capacity) return agent_id;
	}
	return null;
}

function mainframe_access_record_id(character_id) {
	return "MK_mainframe_access-" + character_id;
}

function mainframe_charge_record_id(user_id, request_id) {
	var key = crypto
		.createHash("sha256")
		.update(user_id + "\n" + request_id, "utf8")
		.digest("hex");
	return "MK_mainframe_charge-" + key;
}

function mainframe_steam_id(owner) {
	if (!owner || owner.platform !== "steam") return "";
	var steam_id = String(owner.pid || "");
	return MAINFRAME_STEAM_ID_PATTERN.test(steam_id) ? steam_id : "";
}

function mainframe_steam_time_record_id(steam_id) {
	var key = crypto
		.createHash("sha256")
		.update("mainframe-steam-time\n" + steam_id, "utf8")
		.digest("hex");
	return "MK_mainframe_steam_time-" + key;
}

function mainframe_steam_time_record(record, now) {
	if (!record)
		return {
			type: "mainframe_steam_time",
			granted_periods: MAINFRAME_STEAM_FREE_PERIODS,
			used_periods: 0,
			grant_version: 1,
			created: now,
		};
	if (
		record.type !== "mainframe_steam_time" ||
		!Number.isSafeInteger(record.granted_periods) ||
		record.granted_periods < 0 ||
		!Number.isSafeInteger(record.used_periods) ||
		record.used_periods < 0 ||
		record.used_periods > record.granted_periods
	)
		return null;
	return record;
}

function mainframe_steam_time_to_client(owner, record) {
	if (!mainframe_steam_id(owner)) return null;
	var time = mainframe_steam_time_record(record, new Date());
	if (!time) return null;
	var remaining = time.granted_periods - time.used_periods;
	if (remaining <= 0) return null;
	return {
		granted_hours: time.granted_periods,
		used_hours: time.used_periods,
		remaining_hours: remaining,
		period_minutes: MAINFRAME_PERIOD_MS / 60000,
		renewal_minutes_by_characters: mainframe_renewal_schedule(),
		shared_by: "steam_account",
	};
}

async function mainframe_get_steam_time(user) {
	if (!user || !get_id(user)) return null;
	var owner = (await get(get_id(user))) || user;
	var steam_id = mainframe_steam_id(owner);
	if (!steam_id) return null;
	return mainframe_steam_time_to_client(owner, await get(mainframe_steam_time_record_id(steam_id)));
}

function mainframe_assignment_record_id(character_id) {
	return "MK_mainframe_assignment-" + character_id;
}

function mainframe_event_record_id(character_id) {
	return "MK_mainframe_events-" + character_id;
}

function mainframe_clean_event(event) {
	if (!event || typeof event !== "object" || Array.isArray(event)) return null;
	var at = new Date(event.at);
	if (!/^[0-9a-f]{24,64}$/.test(event.id || "") || !Number.isFinite(at.getTime()) || !["info", "warn", "error"].includes(event.level) || !/^[a-z][a-z0-9_]{2,63}$/.test(event.code || "")) return null;
	return {
		id: event.id,
		assignment_id: /^[0-9a-f]{32}$/.test(event.assignment_id || "") ? event.assignment_id : null,
		at: at.toISOString(),
		level: event.level,
		code: event.code,
		message: String(event.message || "")
			.replace(/[\r\n\t]+/g, " ")
			.slice(0, 240),
		detail:
			event.detail === undefined || event.detail === null
				? null
				: String(event.detail)
						.replace(/[\r\n\t]+/g, " ")
						.slice(0, 160),
	};
}

function mainframe_bound_events(events, now) {
	var cutoff = now.getTime() - MAINFRAME_EVENT_RETENTION_MS;
	var seen = new Set();
	var result = [];
	for (var event of Array.isArray(events) ? events : []) {
		var clean = mainframe_clean_event(event);
		if (!clean || new Date(clean.at).getTime() < cutoff || seen.has(clean.id)) continue;
		seen.add(clean.id);
		result.push(clean);
	}
	result.sort(function (left, right) {
		return new Date(left.at).getTime() - new Date(right.at).getTime();
	});
	return result.slice(-MAINFRAME_EVENT_MAX_ENTRIES);
}

function mainframe_new_event(assignment_id, level, code, message, detail) {
	return mainframe_clean_event({
		id: crypto.randomBytes(16).toString("hex"),
		assignment_id: assignment_id || null,
		at: new Date().toISOString(),
		level: level,
		code: code,
		message: message,
		detail: detail,
	});
}

async function mainframe_record_event(owner_id, character_id, event) {
	if (!/^US_[A-Za-z0-9_-]{1,100}$/.test(owner_id || "") || !/^CH_[A-Za-z0-9_-]{1,100}$/.test(character_id || "")) return false;
	event = mainframe_clean_event(event);
	if (!event) return false;
	var now = new Date();
	var R = await tx(
		async () => {
			var record = await tx_get(A.record_id);
			if (record && (record.owner !== A.owner_id || record.character !== A.character_id)) return;
			record = record || {
				_id: A.record_id,
				type: "mainframe_events",
				owner: A.owner_id,
				character: A.character_id,
				created: A.now,
			};
			var events = mainframe_bound_events(record.events, A.now);
			if (
				events.some(function (existing) {
					return existing.id === A.event.id;
				})
			)
				return;
			events.push(A.event);
			record.events = mainframe_bound_events(events, A.now);
			record.updated = A.now;
			record.expires_at = new Date(A.now.getTime() + MAINFRAME_EVENT_RETENTION_MS);
			await tx_save(record);
			var assignment = await tx_get(A.assignment_id);
			if (assignment && assignment.owner === A.owner_id && assignment.character === A.character_id) {
				var latest_at = assignment.mainframe_event && new Date(assignment.mainframe_event.at).getTime();
				if (!Number.isFinite(latest_at) || latest_at <= new Date(A.event.at).getTime()) assignment.mainframe_event = A.event;
				if (A.event.level === "error") {
					var error_at = assignment.mainframe_error && new Date(assignment.mainframe_error.at).getTime();
					if (!Number.isFinite(error_at) || error_at <= new Date(A.event.at).getTime()) assignment.mainframe_error = A.event;
				}
				await tx_save(assignment);
			}
			R.recorded = true;
		},
		{
			record_id: mainframe_event_record_id(character_id),
			assignment_id: mainframe_assignment_record_id(character_id),
			owner_id: owner_id,
			character_id: character_id,
			event: event,
			now: now,
		},
		3,
	);
	return R.recorded === true;
}

async function mainframe_record_event_quietly(owner_id, character_id, event) {
	try {
		return await mainframe_record_event(owner_id, character_id, event);
	} catch (e) {
		return false;
	}
}

async function mainframe_read_events(owner_id, character_id, limit) {
	if (!/^US_[A-Za-z0-9_-]{1,100}$/.test(owner_id || "") || !/^CH_[A-Za-z0-9_-]{1,100}$/.test(character_id || "")) return [];
	var record = await get(mainframe_event_record_id(character_id));
	if (!record || record.owner !== owner_id || record.character !== character_id) return [];
	var events = mainframe_bound_events(record.events, new Date());
	return events.slice(-Math.max(1, Math.min(Number(limit) || 100, MAINFRAME_EVENT_MAX_ENTRIES)));
}

function mainframe_group_record_id(group_id) {
	return "MK_mainframe_group-" + group_id;
}

function mainframe_group_action_record_id(owner_id, request_id) {
	var key = crypto
		.createHash("sha256")
		.update(owner_id + "\n" + request_id, "utf8")
		.digest("hex");
	return "MK_mainframe_group_action-" + key;
}

function mainframe_character_is_active(character, now) {
	if (!character || !character.server || !character.last_sync) return false;
	var last_sync = new Date(character.last_sync);
	return Number.isFinite(last_sync.getTime()) && now.getTime() - last_sync.getTime() < 120 * 60 * 1000;
}

async function mainframe_resolve_server(requested) {
	requested = String(requested || "").trim();
	var servers = await get_servers();
	var server = servers.find(function (candidate) {
		var label = candidate.region + " " + candidate.name;
		return !requested || requested === get_id(candidate) || requested.toLowerCase() === label.toLowerCase();
	});
	if (!server || !server.address || !server.path) return null;
	if (!/^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(server.address) || !/^\/[A-Za-z0-9_./-]*$/.test(server.path)) return null;
	return {
		key: get_id(server),
		label: server.region + " " + server.name,
		url: "https://" + server.address,
		path: server.path,
	};
}

async function mainframe_validate_code_slot(user, code_slot) {
	code_slot = String(code_slot || "");
	if (!MAINFRAME_CODE_SLOT_PATTERN.test(code_slot)) return null;
	var user_data = await get_user_data(user);
	var code_list = gf(user_data, "code_list", {});
	if (Object.prototype.hasOwnProperty.call(code_list, code_slot)) return code_slot;
	for (var slot in code_list) {
		if (String((code_list[slot] || [])[0] || "").toLowerCase() === code_slot.toLowerCase()) return String(slot);
	}
	return null;
}

function mainframe_assignment_to_client(assignment) {
	if (!assignment) return null;
	var mainframe_event = mainframe_clean_event(assignment.mainframe_event);
	var mainframe_error = mainframe_clean_event(assignment.mainframe_error);
	var event_cutoff = Date.now() - MAINFRAME_EVENT_RETENTION_MS;
	if (mainframe_event && new Date(mainframe_event.at).getTime() < event_cutoff) mainframe_event = null;
	if (mainframe_error && new Date(mainframe_error.at).getTime() < event_cutoff) mainframe_error = null;
	return {
		assignment_id: assignment.session_id || null,
		character: assignment.character_name || null,
		character_id: assignment.character || null,
		code_slot: assignment.code_slot || null,
		server: assignment.server_label || null,
		desired_state: assignment.desired_state || "stopped",
		stop_reason: assignment.stop_reason || null,
		last_failure:
			assignment.failure && typeof assignment.failure === "object" ? { code: assignment.failure.code || null, reason: assignment.failure.reason || null, at: assignment.failure.at || null } : null,
		mainframe_event: mainframe_event,
		mainframe_error: mainframe_error,
		revision: Number(assignment.revision) || 0,
		execution: assignment.billing_mode === "included" ? "included_worker" : assignment.billing_mode === "group_root" ? "shared_microvm" : "dedicated_microvm",
		billing_mode: assignment.billing_mode || "dedicated",
		included_with: assignment.billing_mode === "included" ? assignment.group_root_name || null : null,
		worker_slot: Number(assignment.worker_slot) || 1,
	};
}

async function mainframe_begin_assignment(user, character, request_id, options) {
	options = options || {};
	if (!user || !character || character.owner !== get_id(user)) return { failed: true, reason: "character_not_found" };
	if (typeof request_id !== "string" || !MAINFRAME_REQUEST_PATTERN.test(request_id)) return { failed: true, reason: "invalid_request_id" };
	var code_slot = await mainframe_validate_code_slot(user, options.code_slot);
	if (!code_slot) return { failed: true, reason: "code_not_found" };
	var server = await mainframe_resolve_server(options.server);
	if (!server) return { failed: true, reason: "server_not_found" };
	var selected_controller = await mainframe_select_controller(server, options.controller);
	if (!selected_controller) return { failed: true, reason: "mainframe_unavailable" };
	var now = new Date();
	var user_id = get_id(user);
	var character_id = get_id(character);
	var access_id = mainframe_access_record_id(character_id);
	var charge_id = mainframe_charge_record_id(user_id, request_id);
	var assignment_id = mainframe_assignment_record_id(character_id);
	var R = await tx(
		async () => {
			var owner = await tx_get(A.user_id);
			var current_character = await tx_get(A.character_id);
			if (!owner || !current_character || current_character.owner !== A.user_id) ex("character_not_found");
			var existing = await tx_get(A.assignment_id);
			if (existing && (existing.owner !== A.user_id || existing.character !== A.character_id)) ex("assignment_conflict");
			var previous_charge = await tx_get(A.charge_id);
			if (previous_charge) {
				if (previous_charge.owner !== A.user_id || previous_charge.character !== A.character_id) ex("idempotency_conflict");
				R.owner = owner;
				R.access = await tx_get(A.access_id);
				R.charge = previous_charge;
				R.assignment =
					existing && existing.session_id === previous_charge.session_id && existing.desired_state === "running" && existing.access_until && new Date(existing.access_until) > A.now ? existing : null;
				R.charged = false;
				R.replayed = true;
				return;
			}
			var continuing_assignment = !!(existing && existing.desired_state === "running");
			if (continuing_assignment) {
				if (existing.server_key !== A.server.key || String(existing.code_slot) !== A.code_slot) ex("character_already_linked");
			} else if (mainframe_character_is_active(current_character, A.now)) ex("character_in_game");
			if (owner.server) ex("account_in_bank");
			var access = await tx_get(A.access_id);
			if (access && (access.owner !== A.user_id || access.character !== A.character_id)) access = null;
			var charged = !(access && access.access_until && new Date(access.access_until) > A.now);
			var billing_source = null;
			var steam_time = null;
			if (charged) {
				var steam_id = mainframe_steam_id(owner);
				if (steam_id) {
					var steam_time_id = mainframe_steam_time_record_id(steam_id);
					steam_time = mainframe_steam_time_record(await tx_get(steam_time_id), A.now);
					if (!steam_time) ex("mainframe_billing_unavailable");
					steam_time._id = steam_time_id;
					if (steam_time.used_periods < steam_time.granted_periods) {
						steam_time.used_periods++;
						steam_time.updated = A.now;
						billing_source = "steam_time";
					}
				}
				if (!billing_source) {
					if (gf(owner, "cash", 0) < MAINFRAME_PERIOD_SHELLS) ex("not_enough_shells");
					owner.cash -= MAINFRAME_PERIOD_SHELLS;
					billing_source = "shell";
				}
			}
			var period_end = charged ? new Date(A.now.getTime() + MAINFRAME_PERIOD_MS) : new Date(access.access_until);
			access = access || {
				_id: A.access_id,
				type: "mainframe_access",
				owner: A.user_id,
				character: A.character_id,
				created: A.now,
			};
			access.access_until = period_end;
			if (charged) {
				access.billing_source = billing_source;
				access.period_minutes = MAINFRAME_PERIOD_MS / 60000;
				access.active_characters = 1;
			}
			access.operator = null;
			access.updated = A.now;
			var session_id = existing && existing.desired_state === "running" ? existing.session_id : crypto.randomBytes(16).toString("hex");
			if (!existing || existing.desired_state !== "running") {
				var auth = get_new_auth(owner);
				existing = existing || {
					_id: A.assignment_id,
					type: "mainframe_assignment",
					owner: A.user_id,
					character: A.character_id,
					created: A.now,
					revision: 0,
				};
				existing.session_id = session_id;
				existing.revision = (Number(existing.revision) || 0) + 1;
				existing.auth = auth;
			}
			existing.character_name = current_character.info.name;
			existing.controller = existing.desired_state === "running" && mainframe_controller_is_known(existing.controller) ? existing.controller : A.controller;
			existing.server_key = A.server.key;
			existing.server_label = A.server.label;
			existing.connection_url = A.server.url;
			existing.connection_path = A.server.path;
			existing.code_slot = A.code_slot;
			if (!continuing_assignment) {
				existing.billing_mode = "dedicated";
				delete existing.group_id;
				delete existing.group_root;
				delete existing.group_root_name;
				delete existing.worker_slot;
			}
			existing.desired_state = "running";
			existing.stop_reason = null;
			existing.failure = null;
			existing.access_until = period_end;
			existing.start_after = null;
			existing.updated = A.now;
			var charge = {
				_id: A.charge_id,
				type: "mainframe_charge",
				owner: A.user_id,
				character: A.character_id,
				request_id: A.request_id,
				session_id: session_id,
				billing_source: charged ? billing_source : access.billing_source || null,
				steam_periods: charged && billing_source === "steam_time" ? 1 : 0,
				shells: charged && billing_source === "shell" ? MAINFRAME_PERIOD_SHELLS : 0,
				period_minutes: charged ? MAINFRAME_PERIOD_MS / 60000 : null,
				active_characters: charged ? 1 : null,
				period_start: charged ? A.now : null,
				period_end: period_end,
				created: A.now,
			};
			await tx_save(owner);
			if (charged && billing_source === "steam_time") await tx_save(steam_time);
			await tx_save(access);
			await tx_save(existing);
			await tx_save(charge);
			R.owner = owner;
			R.access = access;
			R.charge = charge;
			R.assignment = existing;
			R.charged = charged;
			R.billing_source = charged ? billing_source : access.billing_source || null;
			R.steam_time = steam_time;
			R.replayed = false;
		},
		{
			user_id: user_id,
			character_id: character_id,
			request_id: request_id,
			access_id: access_id,
			charge_id: charge_id,
			assignment_id: assignment_id,
			server: server,
			code_slot: code_slot,
			controller: selected_controller,
			now: now,
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "link_failed" };
	if (R.replayed && !R.assignment) return { failed: true, reason: "request_already_used", access: mainframe_access_to_client(R.access, now) };
	if (!R.replayed)
		await mainframe_record_event_quietly(
			user_id,
			character_id,
			mainframe_new_event(R.assignment && R.assignment.session_id, "info", "assignment_queued", "Mainframe queued this character.", server.label + " · CODE " + code_slot),
		);
	return {
		success: true,
		charged: R.charged,
		replayed: R.replayed,
		auto_renew: true,
		billing_source: R.billing_source || (R.charge && R.charge.billing_source) || null,
		steam_hours_charged: R.charged && R.billing_source === "steam_time" ? 1 : 0,
		shells_charged: R.charged && R.billing_source === "shell" ? MAINFRAME_PERIOD_SHELLS : 0,
		shells: gf(R.owner, "cash", 0),
		receipt: R.charge ? R.charge._id.slice("MK_mainframe_charge-".length) : null,
		access: mainframe_access_to_client(R.access, now),
		next_charge_at: R.access && R.access.access_until ? new Date(R.access.access_until).toISOString() : null,
		assignment: mainframe_assignment_to_client(R.assignment),
	};
}

async function mainframe_begin_included_assignment(user, parent_source, character, request_id, code_slot) {
	if (!user || !character || character.owner !== get_id(user)) return { failed: true, reason: "character_not_found" };
	if (typeof request_id !== "string" || !MAINFRAME_REQUEST_PATTERN.test(request_id)) return { failed: true, reason: "invalid_request_id" };
	code_slot = await mainframe_validate_code_slot(user, code_slot);
	if (!code_slot) return { failed: true, reason: "code_not_found" };
	var now = new Date();
	var user_id = get_id(user);
	var character_id = get_id(character);
	var child_session_id = crypto.randomBytes(16).toString("hex");
	var new_group_id = crypto.randomBytes(16).toString("hex");
	var action_id = mainframe_group_action_record_id(user_id, request_id);
	var R = await tx(
		async () => {
			var owner = await tx_get(A.user_id);
			var parent = await tx_get(A.parent_assignment_id);
			var current_character = await tx_get(A.character_id);
			if (!owner) ex("account_not_found");
			if (!current_character || current_character.owner !== A.user_id) ex("character_not_found");
			var previous_action = await tx_get(A.action_id);
			var existing = await tx_get(A.assignment_id);
			if (previous_action) {
				if (previous_action.owner !== A.user_id || previous_action.character !== A.character_id || previous_action.source_session_id !== A.parent_session_id) ex("idempotency_conflict");
				R.assignment = existing && existing.session_id === previous_action.session_id && existing.desired_state === "running" ? existing : null;
				R.access = R.assignment ? await tx_get(A.access_id) : null;
				R.replayed = true;
				return;
			}
			if (!parent || parent.owner !== A.user_id || parent.session_id !== A.parent_session_id || parent.desired_state !== "running" || new Date(parent.access_until) <= A.now) ex("assignment_expired");
			var group = null;
			if ((parent.billing_mode || "dedicated") === "dedicated") {
				if (parent.character !== A.parent_character_id) ex("shared_group_unavailable");
				if (parent.auth && owner.info && Array.isArray(owner.info.auths)) {
					owner.info.auths = owner.info.auths.filter(function (auth) {
						return auth !== parent.auth;
					});
				}
				parent.session_id = A.new_group_id;
				parent.revision = (Number(parent.revision) || 0) + 1;
				parent.auth = get_new_auth(owner);
				parent.billing_mode = "group_root";
				parent.group_id = A.new_group_id;
				parent.group_root = parent.character;
				parent.group_root_name = parent.character_name;
				parent.worker_slot = 1;
				parent.failure = null;
				parent.updated = A.now;
				group = {
					_id: mainframe_group_record_id(A.new_group_id),
					type: "mainframe_group",
					group_id: A.new_group_id,
					owner: A.user_id,
					root_character: parent.character,
					root_character_name: parent.character_name,
					controller: parent.controller,
					desired_state: "running",
					members: [{ character: parent.character, character_name: parent.character_name, worker_slot: 1 }],
					created: A.now,
					updated: A.now,
				};
			} else {
				if (!parent.group_id || !parent.group_root) ex("shared_group_unavailable");
				group = await tx_get(mainframe_group_record_id(parent.group_id));
				if (
					!group ||
					group.owner !== A.user_id ||
					group.root_character !== parent.group_root ||
					group.controller !== parent.controller ||
					group.desired_state !== "running" ||
					!Array.isArray(group.members)
				)
					ex("shared_group_unavailable");
			}
			if (existing && existing.desired_state === "running") {
				if (existing.group_id === group.group_id) {
					R.assignment = existing;
					R.access = await tx_get(A.access_id);
					R.replayed = true;
					return;
				}
				ex("character_already_linked");
			}
			if (mainframe_character_is_active(current_character, A.now)) ex("character_in_game");
			if (owner.server) ex("account_in_bank");
			if (group.members.length >= MAINFRAME_GROUP_MAX_WORKERS) ex("shared_group_full");
			var occupied = new Set(
				group.members.map(function (member) {
					return Number(member.worker_slot);
				}),
			);
			var worker_slot = 0;
			for (var slot = 2; slot <= MAINFRAME_GROUP_MAX_WORKERS; slot++) {
				if (!occupied.has(slot)) {
					worker_slot = slot;
					break;
				}
			}
			if (!worker_slot) ex("shared_group_full");
			if (existing && existing.auth && owner.info && Array.isArray(owner.info.auths)) {
				owner.info.auths = owner.info.auths.filter(function (auth) {
					return auth !== existing.auth;
				});
			}
			var auth = get_new_auth(owner);
			existing = existing || {
				_id: A.assignment_id,
				type: "mainframe_assignment",
				owner: A.user_id,
				character: A.character_id,
				created: A.now,
				revision: 0,
			};
			existing.session_id = A.child_session_id;
			existing.revision = (Number(existing.revision) || 0) + 1;
			existing.auth = auth;
			existing.character_name = current_character.info.name;
			existing.controller = parent.controller;
			existing.server_key = parent.server_key;
			existing.server_label = parent.server_label;
			existing.connection_url = parent.connection_url;
			existing.connection_path = parent.connection_path;
			existing.code_slot = A.code_slot;
			existing.billing_mode = "included";
			existing.group_id = group.group_id;
			existing.group_root = group.root_character;
			existing.group_root_name = group.root_character_name;
			existing.worker_slot = worker_slot;
			existing.desired_state = "running";
			existing.stop_reason = null;
			existing.failure = null;
			existing.access_until = new Date(parent.access_until);
			existing.start_after = null;
			existing.updated = A.now;
			var access = await tx_get(A.access_id);
			if (access && (access.owner !== A.user_id || access.character !== A.character_id)) ex("access_conflict");
			access = access || {
				_id: A.access_id,
				type: "mainframe_access",
				owner: A.user_id,
				character: A.character_id,
				created: A.now,
			};
			access.access_until = new Date(parent.access_until);
			access.billing_source = "included";
			access.inherited_from = group.root_character;
			access.period_minutes = Number(parent.period_minutes) || MAINFRAME_PERIOD_MS / 60000;
			access.active_characters = Number(parent.active_characters) || 1;
			access.operator = null;
			access.updated = A.now;
			group.members.push({ character: A.character_id, character_name: current_character.info.name, worker_slot: worker_slot });
			group.updated = A.now;
			var action = {
				_id: A.action_id,
				type: "mainframe_group_action",
				operation: "start_character",
				owner: A.user_id,
				character: A.character_id,
				request_id: A.request_id,
				group_id: group.group_id,
				source_session_id: A.parent_session_id,
				session_id: A.child_session_id,
				created: A.now,
			};
			await tx_save(owner);
			await tx_save(parent);
			await tx_save(access);
			await tx_save(existing);
			await tx_save(group);
			await tx_save(action);
			R.assignment = existing;
			R.access = access;
			R.group = group;
			R.replayed = false;
		},
		{
			user_id: user_id,
			parent_assignment_id: mainframe_assignment_record_id(parent_source.character),
			parent_session_id: parent_source.session_id,
			parent_character_id: parent_source.character,
			character_id: character_id,
			assignment_id: mainframe_assignment_record_id(character_id),
			access_id: mainframe_access_record_id(character_id),
			action_id: action_id,
			request_id: request_id,
			child_session_id: child_session_id,
			new_group_id: new_group_id,
			code_slot: code_slot,
			now: now,
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "shared_start_failed" };
	if (!R.assignment) return { failed: true, reason: "request_already_used" };
	if (!R.replayed)
		await mainframe_record_event_quietly(
			user_id,
			character_id,
			mainframe_new_event(
				R.assignment.session_id,
				"info",
				"included_worker_queued",
				"Mainframe queued this included Worker.",
				"Shared with " + String(R.assignment.group_root_name || "the root character"),
			),
		);
	return {
		success: true,
		charged: false,
		replayed: R.replayed === true,
		auto_renew: true,
		billing_source: "included",
		steam_hours_charged: 0,
		shells_charged: 0,
		next_charge_at: R.assignment.access_until ? new Date(R.assignment.access_until).toISOString() : null,
		access: mainframe_access_to_client(R.access, now),
		assignment: mainframe_assignment_to_client(R.assignment),
	};
}

async function mainframe_stop_assignment(user, character) {
	if (!user || !character || character.owner !== get_id(user)) return { failed: true, reason: "character_not_found" };
	var now = new Date();
	var R = await tx(
		async () => {
			var owner = await tx_get(A.user_id);
			var current_character = await tx_get(A.character_id);
			var assignment = await tx_get(A.assignment_id);
			if (!owner || !current_character || current_character.owner !== A.user_id) ex("character_not_found");
			if (!assignment || assignment.owner !== A.user_id || assignment.character !== A.character_id) ex("mainframe_unavailable");
			var assignments = [assignment];
			var group = null;
			if (assignment.billing_mode === "group_root") {
				group = await tx_get(mainframe_group_record_id(assignment.group_id));
				if (!group || group.owner !== A.user_id || group.root_character !== A.character_id || !Array.isArray(group.members)) ex("shared_group_unavailable");
				assignments = [];
				for (var member of group.members) {
					var member_assignment = await tx_get(mainframe_assignment_record_id(member.character));
					if (member_assignment && member_assignment.owner === A.user_id && member_assignment.group_id === group.group_id) assignments.push(member_assignment);
				}
				group.desired_state = "stopped";
				group.updated = A.now;
			} else if (assignment.billing_mode === "included") {
				group = await tx_get(mainframe_group_record_id(assignment.group_id));
				if (!group || group.owner !== A.user_id || !Array.isArray(group.members)) ex("shared_group_unavailable");
				group.members = group.members.filter(function (member) {
					return member.character !== A.character_id;
				});
				group.updated = A.now;
			}
			R.stopped = assignments
				.filter(function (current) {
					return current.desired_state === "running";
				})
				.map(function (current) {
					return { character: current.character, session_id: current.session_id };
				});
			for (var current of assignments) {
				if (current.auth && owner.info && Array.isArray(owner.info.auths)) {
					owner.info.auths = owner.info.auths.filter(function (auth) {
						return auth !== current.auth;
					});
				}
				current.desired_state = "stopped";
				current.auth = null;
				current.stop_reason = "explicit_disconnect";
				current.updated = A.now;
				await tx_save(current);
			}
			await tx_save(owner);
			if (group) await tx_save(group);
			R.assignment = assignment;
		},
		{
			user_id: get_id(user),
			character_id: get_id(character),
			assignment_id: mainframe_assignment_record_id(get_id(character)),
			now: now,
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "disconnect_failed" };
	for (var stopped of R.stopped || [])
		await mainframe_record_event_quietly(get_id(user), stopped.character, mainframe_new_event(stopped.session_id, "info", "explicit_disconnect", "Disconnected by the account owner."));
	return { success: true, assignment: mainframe_assignment_to_client(R.assignment) };
}

async function mainframe_renew_assignment(source, now) {
	now = now || new Date();
	if (!source || !/^US_[A-Za-z0-9_-]{1,100}$/.test(source.owner || "") || !/^CH_[A-Za-z0-9_-]{1,100}$/.test(source.character || "") || !/^[0-9a-f]{32}$/.test(source.session_id || ""))
		return { failed: true, reason: "invalid_assignment" };
	var previous_until = new Date(source.access_until);
	var renewal_key = "renewal:" + source.character + ":" + source.session_id + ":" + (Number.isFinite(previous_until.getTime()) ? previous_until.toISOString() : "missing");
	var R = await tx(
		async () => {
			var assignment = await tx_get(A.assignment_id);
			if (
				!assignment ||
				assignment.owner !== A.user_id ||
				assignment.character !== A.character_id ||
				assignment.session_id !== A.session_id ||
				!mainframe_controller_is_known(assignment.controller) ||
				assignment.desired_state !== "running"
			) {
				R.state = "inactive";
				return;
			}
			var current_until = new Date(assignment.access_until);
			if (Number.isFinite(current_until.getTime()) && current_until > A.now) {
				R.state = "active";
				R.assignment = assignment;
				return;
			}
			var owner = await tx_get(A.user_id);
			var character = await tx_get(A.character_id);
			if (!owner || !character || character.owner !== A.user_id) ex("character_not_found");
			var access = await tx_get(A.access_id);
			if (access && (access.owner !== A.user_id || access.character !== A.character_id)) ex("access_conflict");
			var group = null;
			var group_children = [];
			if (assignment.billing_mode === "group_root") {
				group = await tx_get(mainframe_group_record_id(assignment.group_id));
				if (!group || group.owner !== A.user_id || group.root_character !== A.character_id || !Array.isArray(group.members)) ex("shared_group_unavailable");
				var seen_characters = new Set();
				var seen_slots = new Set();
				var root_member = false;
				for (var member of group.members) {
					var member_slot = Number(member.worker_slot);
					if (
						!/^CH_[A-Za-z0-9_-]{1,100}$/.test(member.character || "") ||
						!Number.isSafeInteger(member_slot) ||
						member_slot < 1 ||
						member_slot > MAINFRAME_GROUP_MAX_WORKERS ||
						seen_characters.has(member.character) ||
						seen_slots.has(member_slot)
					)
						ex("shared_group_unavailable");
					seen_characters.add(member.character);
					seen_slots.add(member_slot);
					if (member.character === A.character_id && member_slot === 1) root_member = true;
					if (member.character === A.character_id) continue;
					var child = await tx_get(mainframe_assignment_record_id(member.character));
					if (!child || child.owner !== A.user_id || child.group_id !== group.group_id || child.billing_mode !== "included") continue;
					group_children.push(child);
				}
				if (!root_member) ex("shared_group_unavailable");
			}
			var active_children = group_children.filter(function (child) {
				return child.desired_state === "running";
			});
			var active_characters = 1 + active_children.length;
			if (active_characters > MAINFRAME_GROUP_MAX_WORKERS) ex("shared_group_full");
			var period_minutes = mainframe_period_minutes(active_characters);
			var sync_group = async function (access_until, stop_reason, current_period_minutes, current_active_characters) {
				if (!group) return;
				for (var child of group_children) {
					if (stop_reason) {
						if (child.auth && owner.info && Array.isArray(owner.info.auths)) {
							owner.info.auths = owner.info.auths.filter(function (auth) {
								return auth !== child.auth;
							});
						}
						child.desired_state = "stopped";
						child.auth = null;
						child.stop_reason = stop_reason;
					} else {
						child.access_until = new Date(access_until);
						child.stop_reason = null;
						var child_access = await tx_get(mainframe_access_record_id(child.character));
						if (child_access && child_access.owner === A.user_id && child_access.character === child.character) {
							child_access.access_until = new Date(access_until);
							child_access.billing_source = "included";
							child_access.inherited_from = A.character_id;
							child_access.period_minutes = current_period_minutes;
							child_access.active_characters = current_active_characters;
							child_access.updated = A.now;
							await tx_save(child_access);
						}
					}
					child.updated = A.now;
					await tx_save(child);
				}
				group.desired_state = stop_reason ? "stopped" : "running";
				group.updated = A.now;
				await tx_save(group);
			};
			var access_until = access && access.access_until ? new Date(access.access_until) : null;
			if (access_until && Number.isFinite(access_until.getTime()) && access_until > A.now) {
				assignment.access_until = access_until;
				assignment.updated = A.now;
				await sync_group(access_until, null, Number(access.period_minutes) || period_minutes, Number(access.active_characters) || active_characters);
				await tx_save(assignment);
				R.state = "active";
				R.assignment = assignment;
				return;
			}
			var existing_charge = await tx_get(A.charge_id);
			if (existing_charge) {
				var existing_until = new Date(existing_charge.period_end);
				if (!Number.isFinite(existing_until.getTime())) ex("renewal_conflict");
				var existing_period_minutes = Number(existing_charge.period_minutes) || MAINFRAME_PERIOD_MS / 60000;
				var existing_active_characters = Number(existing_charge.active_characters) || active_characters;
				access = access || {
					_id: A.access_id,
					type: "mainframe_access",
					owner: A.user_id,
					character: A.character_id,
					created: A.now,
				};
				access.access_until = existing_until;
				access.billing_source = existing_charge.billing_source || access.billing_source || null;
				access.period_minutes = existing_period_minutes;
				access.active_characters = existing_active_characters;
				access.operator = null;
				access.updated = A.now;
				assignment.access_until = existing_until;
				assignment.updated = A.now;
				await sync_group(existing_until, null, existing_period_minutes, existing_active_characters);
				await tx_save(access);
				await tx_save(assignment);
				R.state = "active";
				R.assignment = assignment;
				R.access = access;
				R.charge = existing_charge;
				R.period_minutes = existing_period_minutes;
				R.active_characters = existing_active_characters;
				return;
			}
			var billing_source = null;
			var steam_time = null;
			var steam_id = mainframe_steam_id(owner);
			if (steam_id) {
				var steam_time_id = mainframe_steam_time_record_id(steam_id);
				steam_time = mainframe_steam_time_record(await tx_get(steam_time_id), A.now);
				if (!steam_time) ex("mainframe_billing_unavailable");
				steam_time._id = steam_time_id;
				if (steam_time.used_periods < steam_time.granted_periods) {
					steam_time.used_periods++;
					steam_time.updated = A.now;
					billing_source = "steam_time";
				}
			}
			if (!billing_source && gf(owner, "cash", 0) >= MAINFRAME_PERIOD_SHELLS) {
				owner.cash -= MAINFRAME_PERIOD_SHELLS;
				billing_source = "shell";
			}
			if (!billing_source) {
				if (assignment.auth && owner.info && Array.isArray(owner.info.auths)) {
					owner.info.auths = owner.info.auths.filter(function (auth) {
						return auth !== assignment.auth;
					});
				}
				assignment.desired_state = "stopped";
				assignment.auth = null;
				assignment.stop_reason = "not_enough_shells";
				assignment.updated = A.now;
				await sync_group(null, "not_enough_shells", period_minutes, active_characters);
				await tx_save(owner);
				await tx_save(assignment);
				R.state = "stopped";
				R.reason = "not_enough_shells";
				R.assignment = assignment;
				R.owner = owner;
				return;
			}
			var period_end = new Date(A.now.getTime() + period_minutes * 60 * 1000);
			access = access || {
				_id: A.access_id,
				type: "mainframe_access",
				owner: A.user_id,
				character: A.character_id,
				created: A.now,
			};
			access.access_until = period_end;
			access.billing_source = billing_source;
			access.period_minutes = period_minutes;
			access.active_characters = active_characters;
			access.operator = null;
			access.updated = A.now;
			assignment.access_until = period_end;
			assignment.stop_reason = null;
			assignment.updated = A.now;
			await sync_group(period_end, null, period_minutes, active_characters);
			var charge = {
				_id: A.charge_id,
				type: "mainframe_charge",
				kind: "automatic_renewal",
				owner: A.user_id,
				character: A.character_id,
				request_id: A.renewal_key,
				session_id: A.session_id,
				billing_source: billing_source,
				steam_periods: billing_source === "steam_time" ? 1 : 0,
				shells: billing_source === "shell" ? MAINFRAME_PERIOD_SHELLS : 0,
				period_minutes: period_minutes,
				active_characters: active_characters,
				period_start: A.now,
				period_end: period_end,
				created: A.now,
			};
			await tx_save(owner);
			if (billing_source === "steam_time") await tx_save(steam_time);
			await tx_save(access);
			await tx_save(assignment);
			await tx_save(charge);
			R.state = "renewed";
			R.assignment = assignment;
			R.access = access;
			R.charge = charge;
			R.owner = owner;
			R.billing_source = billing_source;
			R.steam_time = steam_time;
			R.period_minutes = period_minutes;
			R.active_characters = active_characters;
			R.renewal_members = [{ character: assignment.character, session_id: assignment.session_id }].concat(
				active_children.map(function (child) {
					return { character: child.character, session_id: child.session_id };
				}),
			);
		},
		{
			user_id: source.owner,
			character_id: source.character,
			session_id: source.session_id,
			assignment_id: mainframe_assignment_record_id(source.character),
			access_id: mainframe_access_record_id(source.character),
			charge_id: mainframe_charge_record_id(source.owner, renewal_key),
			renewal_key: renewal_key,
			now: now,
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "renewal_failed" };
	if (R.state === "renewed") {
		var renewal_message = R.billing_source === "steam_time" ? "1 free Mainframe hour used for " + R.period_minutes + " minutes." : "1 Shell charged for " + R.period_minutes + " minutes.";
		var renewal_detail = R.active_characters + (R.active_characters === 1 ? " character active" : " characters active") + " · Next renewal " + new Date(R.access.access_until).toISOString();
		for (var renewal_member of R.renewal_members || [{ character: source.character, session_id: source.session_id }])
			await mainframe_record_event_quietly(source.owner, renewal_member.character, mainframe_new_event(renewal_member.session_id, "info", "access_renewed", renewal_message, renewal_detail));
	} else if (R.state === "stopped")
		await mainframe_record_event_quietly(
			source.owner,
			source.character,
			mainframe_new_event(source.session_id, "error", "renewal_failed", "Mainframe stopped this character because no time remained."),
		);
	return {
		success: true,
		state: R.state,
		reason: R.reason || null,
		charged: R.state === "renewed",
		billing_source: R.billing_source || (R.charge && R.charge.billing_source) || null,
		steam_hours_charged: R.state === "renewed" && R.billing_source === "steam_time" ? 1 : 0,
		shells_charged: R.state === "renewed" && R.billing_source === "shell" ? MAINFRAME_PERIOD_SHELLS : 0,
		shells: R.owner ? gf(R.owner, "cash", 0) : null,
		next_charge_at: R.access && R.access.access_until && R.state !== "stopped" ? new Date(R.access.access_until).toISOString() : null,
		access: R.access ? mainframe_access_to_client(R.access, now) : null,
		assignment: R.assignment ? mainframe_assignment_to_client(R.assignment) : null,
	};
}

async function mainframe_controller_assignments(agent_id) {
	if (!mainframe_controller_is_known(agent_id)) return [];
	var now = new Date();
	await mainframe_renew_access(now);
	var assignments = await db
		.collection("mark")
		.find({
			type: "mainframe_assignment",
			controller: agent_id,
			desired_state: "running",
			access_until: { $gt: now },
			$or: [{ start_after: null }, { start_after: { $exists: false } }, { start_after: { $lte: now } }],
		})
		.limit(MAINFRAME_CONTROLLERS[agent_id].capacity)
		.toArray();
	return assignments
		.map(function (assignment) {
			var connection_url;
			try {
				connection_url = new URL(assignment.connection_url);
			} catch (e) {
				return null;
			}
			var billing_mode = assignment.billing_mode || "dedicated";
			var group_id = assignment.group_id || assignment.session_id;
			var group_root = assignment.group_root || assignment.character;
			var worker_slot = Number(assignment.worker_slot) || 1;
			if (
				assignment._id !== mainframe_assignment_record_id(assignment.character) ||
				!/^US_[A-Za-z0-9_-]{1,100}$/.test(assignment.owner || "") ||
				!/^CH_[A-Za-z0-9_-]{1,100}$/.test(assignment.character || "") ||
				!/^[A-Za-z0-9_.:@-]{1,128}$/.test(assignment.character_name || "") ||
				!/^[0-9a-f]{32}$/.test(assignment.session_id || "") ||
				!/^[A-Za-z0-9_-]{1,256}$/.test(assignment.auth || "") ||
				!Number.isSafeInteger(assignment.revision) ||
				assignment.revision < 1 ||
				!MAINFRAME_CODE_SLOT_PATTERN.test(assignment.code_slot || "") ||
				!["dedicated", "group_root", "included"].includes(billing_mode) ||
				!/^[0-9a-f]{32}$/.test(group_id) ||
				!/^CH_[A-Za-z0-9_-]{1,100}$/.test(group_root) ||
				!Number.isSafeInteger(worker_slot) ||
				worker_slot < 1 ||
				worker_slot > MAINFRAME_GROUP_MAX_WORKERS ||
				(billing_mode === "dedicated" && (group_root !== assignment.character || worker_slot !== 1)) ||
				(billing_mode === "group_root" && (group_root !== assignment.character || worker_slot !== 1)) ||
				(billing_mode === "included" && group_root === assignment.character) ||
				typeof assignment.server_label !== "string" ||
				assignment.server_label.length < 3 ||
				assignment.server_label.length > 50 ||
				connection_url.protocol !== "https:" ||
				connection_url.username ||
				connection_url.password ||
				connection_url.pathname !== "/" ||
				connection_url.search ||
				connection_url.hash ||
				(connection_url.hostname !== "adventure.land" && !connection_url.hostname.endsWith(".adventure.land")) ||
				!/^\/[A-Za-z0-9_./-]*$/.test(assignment.connection_path || "")
			)
				return null;
			return {
				assignment_id: assignment.session_id,
				character_id: assignment.character,
				character_name: assignment.character_name,
				owner_id: assignment.owner,
				revision: Number(assignment.revision) || 0,
				server: assignment.server_label,
				connection: { url: assignment.connection_url, path: assignment.connection_path },
				code_slot: String(assignment.code_slot),
				credentials: { user: assignment.owner, character: assignment.character, auth: assignment.auth },
				billing_mode: billing_mode,
				group_id: group_id,
				group_root: group_root,
				worker_slot: worker_slot,
			};
		})
		.filter(Boolean);
}

async function mainframe_record_controller_failures(report, agent_id) {
	if (!mainframe_controller_is_known(agent_id)) return 0;
	var failures = (report && report.bots ? report.bots : []).filter(function (bot) {
		return bot.character_id && bot.assignment_id && bot.failure && bot.failure.assignment_id === bot.assignment_id;
	});
	var recorded = 0;
	for (var bot of failures) {
		var now = new Date();
		var R = await tx(
			async () => {
				var assignment = await tx_get(A.assignment_id);
				if (!assignment || assignment.session_id !== A.session_id || assignment.desired_state !== "running" || assignment.controller !== A.controller) return;
				assignment.failure = A.failure;
				assignment.updated = A.now;
				await tx_save(assignment);
				R.owner = assignment.owner;
				R.recorded = true;
			},
			{
				assignment_id: mainframe_assignment_record_id(bot.character_id),
				session_id: bot.assignment_id,
				failure: { code: bot.failure.code, reason: bot.failure.reason || null, at: bot.failure.at || now },
				controller: agent_id,
				now: now,
			},
			3,
		);
		if (R.recorded) {
			recorded++;
			await mainframe_record_event_quietly(R.owner, bot.character_id, {
				id: crypto
					.createHash("sha256")
					.update("mainframe-controller-failure\n" + bot.assignment_id + "\n" + String(bot.failure.at || "") + "\n" + bot.failure.code, "utf8")
					.digest("hex")
					.slice(0, 32),
				assignment_id: bot.assignment_id,
				at: bot.failure.at || now,
				level: "error",
				code: "worker_failure",
				message: "Mainframe detected a Worker failure and will retry it.",
				detail: bot.failure.reason || bot.failure.code,
			});
		}
	}
	return recorded;
}

async function mainframe_change_assignment_server(source, region, name) {
	var server = await mainframe_resolve_server(String(region || "") + " " + String(name || ""));
	if (!server) return { failed: true, reason: "server_not_found" };
	var now = new Date();
	var R = await tx(
		async () => {
			var assignment = await tx_get(A.assignment_id);
			if (!assignment || assignment.session_id !== A.session_id || assignment.desired_state !== "running" || new Date(assignment.access_until) <= A.now) ex("assignment_expired");
			var owner = await tx_get(assignment.owner);
			var character = await tx_get(assignment.character);
			if (!owner || !character || character.owner !== assignment.owner) ex("character_not_found");
			if (assignment.auth && owner.info && Array.isArray(owner.info.auths)) {
				owner.info.auths = owner.info.auths.filter(function (auth) {
					return auth !== assignment.auth;
				});
			}
			assignment.auth = get_new_auth(owner);
			assignment.session_id = crypto.randomBytes(16).toString("hex");
			assignment.revision = (Number(assignment.revision) || 0) + 1;
			assignment.server_key = A.server.key;
			assignment.server_label = A.server.label;
			assignment.connection_url = A.server.url;
			assignment.connection_path = A.server.path;
			assignment.start_after = new Date(A.now.getTime() + 15000);
			assignment.updated = A.now;
			await tx_save(owner);
			await tx_save(assignment);
			R.assignment = assignment;
		},
		{
			assignment_id: mainframe_assignment_record_id(source.character),
			session_id: source.session_id,
			server: server,
			now: now,
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "change_server_failed" };
	await mainframe_record_event_quietly(
		source.owner,
		source.character,
		mainframe_new_event(R.assignment.session_id, "warn", "server_change", "Mainframe is reconnecting this character on another server.", server.label),
	);
	return { success: true, assignment: mainframe_assignment_to_client(R.assignment), start_after: R.assignment.start_after.toISOString() };
}

async function mainframe_code_action(body) {
	var assignment = await get(mainframe_assignment_record_id(body.character_id));
	var now = new Date();
	if (
		!assignment ||
		assignment.controller !== body.agent_id ||
		assignment.session_id !== body.assignment_id ||
		assignment.desired_state !== "running" ||
		!assignment.access_until ||
		new Date(assignment.access_until) <= now
	)
		return { failed: true, reason: "assignment_expired" };
	var owner = await get(assignment.owner);
	if (!owner) return { failed: true, reason: "account_not_found" };
	var data = body.data || {};
	if (body.operation === "start_character") {
		var target = await admin_bots_owned_character(owner, data.character);
		if (!target) return { failed: true, reason: "character_not_found" };
		return await mainframe_begin_included_assignment(owner, assignment, target, "code:" + assignment.session_id + ":" + body.request_id, data.code_slot);
	}
	if (body.operation === "stop_character") {
		var target = await admin_bots_owned_character(owner, data.character);
		if (!target) return { failed: true, reason: "character_not_found" };
		return await mainframe_stop_assignment(owner, target);
	}
	if (body.operation === "command_character") {
		if (typeof data.code !== "string" || !data.code.length || Buffer.byteLength(data.code, "utf8") > 64 * 1024) return { failed: true, reason: "invalid_code" };
		var target = await admin_bots_owned_character(owner, data.character);
		if (!target) return { failed: true, reason: "character_not_found" };
		var target_assignment = await get(mainframe_assignment_record_id(get_id(target)));
		if (!target_assignment || target_assignment.owner !== get_id(owner) || target_assignment.desired_state !== "running" || new Date(target_assignment.access_until) <= now)
			return { failed: true, reason: "mainframe_unavailable" };
		return {
			success: true,
			command: {
				character_id: get_id(target),
				assignment_id: target_assignment.session_id,
				command_id: body.request_id,
				code: data.code,
			},
		};
	}
	if (body.operation === "change_server") return await mainframe_change_assignment_server(assignment, data.region, data.name);
	if (body.operation === "upload_code") {
		if (typeof data.code !== "string" || Buffer.byteLength(data.code, "utf8") > 1024 * 1024) return { failed: true, reason: "invalid_code" };
		return await mcp_api_save_code({ user: owner, slot: data.slot, name: data.name, code: data.code });
	}
	return { failed: true, reason: "invalid_operation" };
}

function mainframe_access_to_client(access, now) {
	now = now || new Date();
	var access_until = access && access.access_until ? new Date(access.access_until) : null;
	var active = !!(access_until && Number.isFinite(access_until.getTime()) && access_until > now);
	return {
		active: active,
		access_until: access_until && Number.isFinite(access_until.getTime()) ? access_until.toISOString() : null,
		remaining_seconds: active ? Math.max(0, Math.ceil((access_until.getTime() - now.getTime()) / 1000)) : 0,
		billing_source: active && access ? access.billing_source || null : null,
		shells_per_period: MAINFRAME_PERIOD_SHELLS,
		period_minutes: active && access && Number.isSafeInteger(access.period_minutes) ? access.period_minutes : MAINFRAME_PERIOD_MS / 60000,
		active_characters: active && access && Number.isSafeInteger(access.active_characters) ? access.active_characters : 1,
		renewal_minutes_by_characters: mainframe_renewal_schedule(),
	};
}

async function mainframe_get_access(character) {
	if (!character || !get_id(character)) return mainframe_access_to_client(null);
	return mainframe_access_to_client(await get(mainframe_access_record_id(get_id(character))));
}

async function mainframe_get_assignment(character) {
	if (!character || !get_id(character)) return null;
	return mainframe_assignment_to_client(await get(mainframe_assignment_record_id(get_id(character))));
}

async function mainframe_grant_operator_access(character, requested_by) {
	if (!character || !get_id(character)) return { failed: true, reason: "character_not_found" };
	var now = new Date();
	var character_id = get_id(character);
	var access_id = mainframe_access_record_id(character_id);
	var R = await tx(
		async () => {
			var current_character = await tx_get(A.character_id);
			if (!current_character) ex("character_not_found");
			var access = await tx_get(A.access_id);
			if (access && (access.owner !== current_character.owner || access.character !== A.character_id)) access = null;
			if (!access || !access.access_until || new Date(access.access_until) <= A.now) {
				access = access || {
					_id: A.access_id,
					type: "mainframe_access",
					owner: current_character.owner,
					character: A.character_id,
					created: A.now,
				};
				access.access_until = new Date(A.now.getTime() + MAINFRAME_PERIOD_MS);
				access.period_minutes = MAINFRAME_PERIOD_MS / 60000;
				access.active_characters = 1;
				access.updated = A.now;
				access.operator = String(A.requested_by || "").slice(0, 160);
				await tx_save(access);
			}
			R.access = access;
		},
		{ character_id: character_id, access_id: access_id, now: now, requested_by: requested_by },
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "grant_failed" };
	return { success: true, access: mainframe_access_to_client(R.access, now) };
}

async function mainframe_renew_access(now) {
	if (!admin_bots_configured()) return { success: true, checked: 0, renewed: 0, stopped: 0 };
	now = now || new Date();
	var expired_assignments = await db
		.collection("mark")
		.find({ type: "mainframe_assignment", desired_state: "running", billing_mode: { $ne: "included" }, access_until: { $lte: now } })
		.limit(400)
		.toArray();
	var renewed = 0;
	var stopped = 0;
	for (var assignment of expired_assignments) {
		var result = await mainframe_renew_assignment(assignment, now);
		if (result.failed) throw new Error("Mainframe automatic renewal failed");
		if (result.state === "renewed") renewed++;
		else if (result.state === "stopped") stopped++;
	}
	return { success: true, checked: expired_assignments.length, renewed: renewed, stopped: stopped };
}
