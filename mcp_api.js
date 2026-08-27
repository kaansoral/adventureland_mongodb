// mcp_api.js - API used by Adventure Land MCP clients and external tools

var MCP_API_TOKEN_PREFIX = "mcp_";
var MCP_API_TOKEN_PATTERN = /^mcp_[A-Za-z0-9_-]{43}$/;
var MCP_PROTOCOL_CURRENT = "2026-07-28";
var MCP_PROTOCOL_LEGACY = "2025-11-25";
var MCP_SERVER_INFO = { name: "adventure-land", version: "1.0.0", description: "Adventure Land game and Mainframe tools" };

function mcp_api_hash_token(token) {
	return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function mcp_api_token_record_id(token_hash) {
	return "MK_mcp_api_token-" + token_hash;
}

function mcp_api_user_record_id(user_id) {
	return "MK_mcp_api_user-" + user_id;
}

async function create_mcp_api_token(user) {
	var token = MCP_API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
	var token_hash = mcp_api_hash_token(token);
	var user_id = get_id(user);
	var R = await tx(
		async () => {
			var token_owner = await tx_get(A.user_record_id);
			R.rotated = !!(token_owner && token_owner.token_hash);
			if (R.rotated) {
				await db.collection("mark").deleteOne({ _id: mcp_api_token_record_id(token_owner.token_hash) }, { session: session });
			}
			await tx_save({
				_id: A.token_record_id,
				type: "mcp_api_token",
				owner: A.user_id,
				created: new Date(),
			});
			await tx_save({
				_id: A.user_record_id,
				type: "mcp_api_user",
				owner: A.user_id,
				token_hash: A.token_hash,
				created: new Date(),
			});
		},
		{
			user_id: user_id,
			token_hash: token_hash,
			token_record_id: mcp_api_token_record_id(token_hash),
			user_record_id: mcp_api_user_record_id(user_id),
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "token_generation_failed" };
	return { success: true, token: token, rotated: R.rotated };
}

async function get_mcp_api_user(token) {
	if (typeof token !== "string" || !MCP_API_TOKEN_PATTERN.test(token)) return null;
	var token_hash = mcp_api_hash_token(token);
	var token_record = await get(mcp_api_token_record_id(token_hash));
	if (!token_record || !token_record.owner) return null;
	var user_record = await get(mcp_api_user_record_id(token_record.owner));
	if (!user_record || user_record.token_hash !== token_hash) return null;
	var user = await get(token_record.owner);
	if (!user || user.banned) return null;
	return user;
}

function get_mcp_api_game_data() {
	return {
		achievements: achievements,
		animations: animations,
		classes: classes,
		conditions: conditions,
		cosmetics: cosmetics,
		craft: craft,
		dimensions: dimensions,
		dismantle: dismantle,
		docs: docs,
		drops: drops,
		events: events,
		games: games,
		images: precomputed.images,
		imagesets: imagesets,
		items: items,
		levels: levels,
		maps: maps,
		monsters: monsters,
		multipliers: multipliers,
		npcs: npcs,
		positions: positions,
		projectiles: projectiles,
		sets: sets,
		skills: skills,
		sprites: sprites,
		tilesets: tilesets,
		titles: titles,
		tokens: tokens,
	};
}

async function mcp_api_get_servers(args) {
	var server_list = await get_servers();
	var result = [];
	for (var i = 0; i < server_list.length; i++) {
		var server = server_list[i];
		result.push({
			key: server.key,
			name: server.name,
			region: server.region,
			address: server.address,
			path: server.path,
			msgpack_path: server.msgpack_path,
			players: gf(server, "players", 0),
			online: !!server.online,
			pvp: !!gf(server, "pvp", false),
			gameplay: server.gameplay,
			version: server.version,
			last_update: server.last_update || null,
		});
	}
	return { success: true, servers: result };
}

async function mcp_api_get_game_data(args) {
	var game_data = get_mcp_api_game_data();
	if (!args.section && args.name !== undefined) return { failed: true, reason: "missing_field", field: "section" };
	if (!args.section) {
		return { success: true, version: Version, sections: Object.keys(game_data) };
	}
	if (!Object.prototype.hasOwnProperty.call(game_data, args.section)) return { failed: true, reason: "invalid_section" };
	var section = game_data[args.section];
	if (args.name === undefined) return { success: true, version: Version, section: args.section, data: section };
	if (!section || !Object.prototype.hasOwnProperty.call(section, args.name)) return { failed: true, reason: "not_found" };
	return { success: true, version: Version, section: args.section, name: args.name, data: section[args.name] };
}

function mcp_api_find_code(code_list, identifier) {
	identifier = "" + identifier;
	for (var slot in code_list) {
		if (slot === identifier || ("" + code_list[slot][0]).toLowerCase() === identifier.toLowerCase()) {
			return { slot: slot, name: code_list[slot][0], version: code_list[slot][1] };
		}
	}
	return null;
}

async function mcp_api_list_codes(args) {
	var data = await get_user_data(args.user);
	var code_list = gf(data, "code_list", {});
	var codes = [];
	for (var slot in code_list) {
		codes.push({ slot: slot, name: code_list[slot][0], version: code_list[slot][1] });
	}
	return { success: true, codes: codes };
}

async function mcp_api_get_code(args) {
	var data = await get_user_data(args.user);
	var code = mcp_api_find_code(gf(data, "code_list", {}), args.slot);
	if (!code) return { failed: true, reason: "not_found" };
	var entity = await get("IE_USERCODE-" + get_id(args.user) + "-" + code.slot);
	if (!entity) return { failed: true, reason: "not_found" };
	code.code = "" + gf(entity, "code", "");
	return { success: true, code: code };
}

async function mcp_api_save_code(args) {
	if (args.name === "DELETE") return { failed: true, reason: "invalid_name" };
	var response = { infs: [] };
	var result = await save_code_api({
		user: args.user,
		res: response,
		code: args.code,
		slot: args.slot,
		name: args.name,
		electron: true,
	});
	if (result.failed) return result;
	var info = response.infs.find(function (entry) {
		return entry.type === "code_info";
	});
	return { success: true, code: { slot: "" + info.num, name: info.name, version: info.v } };
}

async function mcp_api_delete_code(args) {
	var response = { infs: [] };
	var result = await save_code_api({
		user: args.user,
		res: response,
		slot: args.slot,
		name: "DELETE",
		electron: true,
	});
	if (result.failed) return result;
	var info = response.infs.find(function (entry) {
		return entry.type === "code_info";
	});
	return { success: true, slot: "" + info.num };
}

function mcp_api_mainframe_contract() {
	return {
		version: 1,
		billing: "fixed_prepaid_window",
		shells_per_period: MAINFRAME_PERIOD_SHELLS,
		period_minutes: MAINFRAME_PERIOD_MS / 60000,
		disconnected_time_counts: true,
		traffic: "requested_actions_not_confirmation",
		observation: "authenticated_game_server_events",
		movement: "confirmed_position_and_map_changes_only",
		stuck: "stationary_for_15s_with_10_recent_move_requests",
	};
}

function mcp_api_mainframe_runtime(bot) {
	if (!bot) return null;
	var runtime = Object.assign({}, bot, { character: bot.bot_id });
	delete runtime.bot_id;
	return runtime;
}

async function mcp_api_list_mainframe_characters(args) {
	var snapshot = await admin_bots_snapshot();
	var characters = await get_characters(args.user);
	var runtimes_by_id = {};
	var runtimes_by_name = {};
	for (var i = 0; i < snapshot.bots.length; i++) {
		if (snapshot.bots[i].character_id) runtimes_by_id[snapshot.bots[i].character_id] = snapshot.bots[i];
		runtimes_by_name[snapshot.bots[i].bot_id] = snapshot.bots[i];
	}
	var result = [];
	for (var i = 0; i < characters.length; i++) {
		var character_name = (characters[i] && characters[i].info && characters[i].info.name) || characters[i].name;
		if (!character_name) continue;
		result.push({
			character: character_name,
			character_id: get_id(characters[i]),
			access: await mainframe_get_access(characters[i]),
			assignment: await mainframe_get_assignment(characters[i]),
			available: snapshot.online,
			runtime: mcp_api_mainframe_runtime(runtimes_by_id[get_id(characters[i])] || runtimes_by_name[character_name]),
		});
	}
	return {
		success: true,
		online: snapshot.online,
		updated_at: snapshot.updated_at,
		shells: gf(args.user, "cash", 0),
		contract: mcp_api_mainframe_contract(),
		characters: result,
	};
}

async function mcp_api_get_mainframe_character(args) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var bot = await admin_bots_find(get_id(character));
	return {
		success: true,
		contract: mcp_api_mainframe_contract(),
		shells: gf(args.user, "cash", 0),
		character: (character.info && character.info.name) || character.name,
		character_id: get_id(character),
		access: await mainframe_get_access(character),
		assignment: await mainframe_get_assignment(character),
		available: (await admin_bots_snapshot()).online,
		runtime: mcp_api_mainframe_runtime(bot),
	};
}

async function mcp_api_link_mainframe_character(args) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var snapshot = await admin_bots_snapshot();
	if (!snapshot.configured || !snapshot.online) return { failed: true, reason: "mainframe_unavailable" };
	var billing = await mainframe_begin_assignment(args.user, character, args.request_id, {
		code_slot: args.code_slot,
		server: args.server,
	});
	if (billing.failed) return billing;
	if (!billing.access.active) return { failed: true, reason: "access_expired", access: billing.access };
	return {
		success: true,
		queued: true,
		contract: mcp_api_mainframe_contract(),
		billing: billing,
		assignment: billing.assignment,
		runtime: mcp_api_mainframe_runtime(await admin_bots_find(get_id(character))),
	};
}

async function mcp_api_disconnect_mainframe_character(args) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var result = await mainframe_stop_assignment(args.user, character);
	if (result.failed) return result;
	return {
		success: true,
		queued: true,
		assignment: result.assignment,
		runtime: mcp_api_mainframe_runtime(await admin_bots_find(get_id(character))),
	};
}

async function mcp_api_get_mainframe_logs(args) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var bot = await admin_bots_find(get_id(character));
	if (!bot) return { failed: true, reason: "mainframe_unavailable" };
	var limit = Math.max(1, Math.min(Number(args.limit) || 100, 100));
	return { success: true, logs: (bot.logs || []).slice(-limit) };
}

var MCP_API_REF = {
	get_servers: { F: mcp_api_get_servers },
	get_game_data: {
		F: mcp_api_get_game_data,
		section: { type: "string", optional: true },
		name: { type: "string", optional: true },
	},
	list_codes: { F: mcp_api_list_codes },
	get_code: {
		F: mcp_api_get_code,
		slot: { type: "identifier" },
	},
	save_code: {
		F: mcp_api_save_code,
		slot: { type: "identifier" },
		name: { type: "string", optional: true },
		code: { type: "string" },
	},
	delete_code: {
		F: mcp_api_delete_code,
		slot: { type: "identifier" },
	},
	mainframe_list_characters: { F: mcp_api_list_mainframe_characters },
	mainframe_get_character: {
		F: mcp_api_get_mainframe_character,
		character: { type: "identifier" },
	},
	mainframe_link_character: {
		F: mcp_api_link_mainframe_character,
		character: { type: "identifier" },
		request_id: { type: "string" },
		code_slot: { type: "identifier" },
		server: { type: "string", optional: true },
	},
	mainframe_disconnect_character: {
		F: mcp_api_disconnect_mainframe_character,
		character: { type: "identifier" },
	},
	mainframe_get_logs: {
		F: mcp_api_get_mainframe_logs,
		character: { type: "identifier" },
		limit: { type: "number", optional: true },
	},
};

var MCP_TOOL_META = {
	get_servers: { description: "List the live Adventure Land game servers.", readOnlyHint: true },
	get_game_data: { description: "Read Adventure Land game definitions, optionally by section and name.", readOnlyHint: true },
	list_codes: { description: "List the account's CODE slots without returning their source.", readOnlyHint: true },
	get_code: { description: "Read one owned CODE slot.", readOnlyHint: true },
	save_code: { description: "Create or replace one owned CODE slot.", destructiveHint: true },
	delete_code: { description: "Delete one owned CODE slot.", destructiveHint: true },
	mainframe_list_characters: { description: "List owned characters and their Mainframe access and runtime state.", readOnlyHint: true },
	mainframe_get_character: { description: "Read one owned character's Mainframe access, assignment, runtime, and observations.", readOnlyHint: true },
	mainframe_link_character: {
		description: "Run an owned character on Mainframe using a CODE slot. Charges one Shell before a new sixty-minute access window begins.",
		destructiveHint: false,
		idempotentHint: true,
	},
	mainframe_disconnect_character: { description: "Disconnect one owned character from Mainframe without ending its paid access window.", destructiveHint: false },
	mainframe_get_logs: { description: "Read bounded Mainframe CODE logs for one owned character.", readOnlyHint: true },
};

function mcp_tool_schema(ref) {
	var properties = {};
	var required = [];
	for (var name in ref) {
		if (name === "F") continue;
		var field = ref[name];
		if (field.type === "number") properties[name] = { type: "integer" };
		else if (field.type === "enum") properties[name] = { type: "string", enum: field.values };
		else properties[name] = { type: "string" };
		if (!field.optional) required.push(name);
	}
	var schema = { type: "object", properties: properties, additionalProperties: false };
	if (required.length) schema.required = required;
	return schema;
}

function mcp_tools() {
	return Object.keys(MCP_API_REF)
		.sort()
		.map(function (name) {
			var meta = MCP_TOOL_META[name] || {};
			return {
				name: name,
				description: meta.description || name,
				inputSchema: mcp_tool_schema(MCP_API_REF[name]),
				annotations: {
					readOnlyHint: meta.readOnlyHint === true,
					destructiveHint: meta.destructiveHint === true,
					idempotentHint: meta.idempotentHint === true,
					openWorldHint: false,
				},
			};
		});
}

function send_mcp_api_json(res, result) {
	return res.status(200).set("Content-Type", "application/json").send(result).end();
}

function validate_mcp_api_args(ref, args) {
	for (var name in args) {
		if (name === "token") continue;
		if (!ref[name]) return { failed: true, reason: "invalid_field", field: name };
		if (ref[name].type === "string" && typeof args[name] !== "string") return { failed: true, reason: "invalid_field", field: name };
		if (ref[name].type === "number" && (!Number.isFinite(args[name]) || !Number.isSafeInteger(args[name]))) return { failed: true, reason: "invalid_field", field: name };
		if (ref[name].type === "enum" && !ref[name].values.includes(args[name])) return { failed: true, reason: "invalid_field", field: name };
		if (ref[name].type === "identifier" && !["string", "number"].includes(typeof args[name])) return { failed: true, reason: "invalid_field", field: name };
		if (ref[name].type === "identifier" && (!String(args[name]).length || String(args[name]).length > 100)) return { failed: true, reason: "invalid_field", field: name };
	}
	for (var name in ref) {
		if (name === "F") continue;
		if (!ref[name].optional && args[name] === undefined) return { failed: true, reason: "missing_field", field: name };
	}
	return null;
}

async function handle_mcp_api_call(req, res) {
	var ref = MCP_API_REF[req.params.method];
	if (!ref) return send_mcp_api_json(res, { failed: true, reason: "invalid_call", name: req.params.method });
	var args = req.body;
	if (!args || typeof args !== "object" || Array.isArray(args)) return send_mcp_api_json(res, { failed: true, reason: "invalid_arguments" });
	if (args.token === undefined) return send_mcp_api_json(res, { failed: true, reason: "missing_field", field: "token" });
	var user = await get_mcp_api_user(args.token);
	if (!user) return send_mcp_api_json(res, { failed: true, reason: "invalid_token" });
	var invalid = validate_mcp_api_args(ref, args);
	if (invalid) return send_mcp_api_json(res, invalid);
	var method_args = Object.assign({}, args, { req: req, res: res, user: user });
	delete method_args.token;
	try {
		return send_mcp_api_json(res, await ref.F(method_args));
	} catch (e) {
		console.error("mcp_api " + req.params.method + " error", e);
		return send_mcp_api_json(res, { failed: true, reason: "exception" });
	}
}

app.post("/mcp_api/:method", handle_mcp_api_call);

function mcp_jsonrpc(id, result) {
	return { jsonrpc: "2.0", id: id, result: result };
}

function mcp_jsonrpc_error(id, code, message, data) {
	var error = { code: code, message: message };
	if (data !== undefined) error.data = data;
	return { jsonrpc: "2.0", id: id === undefined ? null : id, error: error };
}

function mcp_request_origin_allowed(req) {
	var origin = req.get("origin");
	if (!origin) return true;
	try {
		var url = new URL(origin);
		return url.protocol === "https:" && (url.hostname === "adventure.land" || url.hostname.endsWith(".adventure.land"));
	} catch (e) {
		return false;
	}
}

function mcp_bearer_token(req) {
	var authorization = String(req.get("authorization") || "");
	return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function mcp_result_meta() {
	return { "io.modelcontextprotocol/serverInfo": MCP_SERVER_INFO };
}

async function handle_mcp_transport(req, res) {
	res.set("Cache-Control", "no-store");
	if (!mcp_request_origin_allowed(req))
		return res.status(403).send(mcp_jsonrpc_error(null, -32000, "Origin is not allowed"));
	var token = mcp_bearer_token(req);
	var user = await get_mcp_api_user(token);
	if (!user) return res.status(401).set("WWW-Authenticate", 'Bearer realm="Adventure Land MCP"').send(mcp_jsonrpc_error(null, -32001, "Invalid access token"));
	var message = req.body;
	if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string")
		return res.status(400).send(mcp_jsonrpc_error(message && message.id, -32600, "Invalid Request"));
	var version = String(req.get("mcp-protocol-version") || "");
	var modern = version === MCP_PROTOCOL_CURRENT;
	if (version && ![MCP_PROTOCOL_CURRENT, MCP_PROTOCOL_LEGACY, "2025-06-18", "2025-03-26"].includes(version))
		return res.status(400).send(mcp_jsonrpc_error(message.id, -32600, "Unsupported MCP protocol version"));
	if (modern) {
		if (req.get("mcp-method") !== message.method)
			return res.status(400).send(mcp_jsonrpc_error(message.id, -32600, "Mcp-Method header mismatch"));
		if (message.method === "tools/call" && req.get("mcp-name") !== ((message.params && message.params.name) || ""))
			return res.status(400).send(mcp_jsonrpc_error(message.id, -32600, "Mcp-Name header mismatch"));
	}
	if (message.method === "notifications/initialized") return res.status(202).end();
	if (message.id === undefined) return res.status(202).end();
	if (message.method === "server/discover") {
		return res.status(200).send(
			mcp_jsonrpc(message.id, {
				supportedVersions: [MCP_PROTOCOL_CURRENT, MCP_PROTOCOL_LEGACY],
				capabilities: { tools: { listChanged: false } },
				instructions: "Use Mainframe tools only for characters owned by this token's account. Linking a character can charge Shells.",
				ttlMs: 3600000,
				cacheScope: "global",
				_meta: mcp_result_meta(),
			}),
		);
	}
	if (message.method === "initialize") {
		var requested = message.params && message.params.protocolVersion;
		var negotiated = requested === MCP_PROTOCOL_LEGACY || requested === "2025-06-18" || requested === "2025-03-26" ? requested : MCP_PROTOCOL_LEGACY;
		return res.status(200).send(
			mcp_jsonrpc(message.id, {
				protocolVersion: negotiated,
				capabilities: { tools: { listChanged: false } },
				serverInfo: MCP_SERVER_INFO,
				instructions: "Use Mainframe tools only for characters owned by this token's account. Linking a character can charge Shells.",
			}),
		);
	}
	if (message.method === "tools/list") {
		if (message.params && message.params.cursor)
			return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid cursor"));
		return res.status(200).send(mcp_jsonrpc(message.id, { tools: mcp_tools(), _meta: mcp_result_meta() }));
	}
	if (message.method === "tools/call") {
		var name = message.params && message.params.name;
		var ref = MCP_API_REF[name];
		if (!ref) return res.status(200).send(mcp_jsonrpc_error(message.id, -32601, "Unknown tool"));
		var args = (message.params && message.params.arguments) || {};
		if (!args || typeof args !== "object" || Array.isArray(args))
			return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid tool arguments"));
		var invalid = validate_mcp_api_args(ref, args);
		if (invalid) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid tool arguments", invalid));
		try {
			var method_args = Object.assign({}, args, { req: req, res: res, user: user });
			var result = await ref.F(method_args);
			var tool_result = {
				content: [{ type: "text", text: JSON.stringify(result) }],
				structuredContent: result,
				isError: result && result.failed === true,
				_meta: mcp_result_meta(),
			};
			return res.status(200).send(mcp_jsonrpc(message.id, tool_result));
		} catch (e) {
			console.error("mcp tool " + name + " error", e);
			return res.status(200).send(
				mcp_jsonrpc(message.id, {
					content: [{ type: "text", text: JSON.stringify({ failed: true, reason: "exception" }) }],
					structuredContent: { failed: true, reason: "exception" },
					isError: true,
					_meta: mcp_result_meta(),
				}),
			);
		}
	}
	return res.status(200).send(mcp_jsonrpc_error(message.id, -32601, "Method not found"));
}

app.get("/mcp", function (req, res) {
	res.set("Cache-Control", "no-store").set("Allow", "POST").status(405).end();
});
app.post("/mcp", handle_mcp_transport);
