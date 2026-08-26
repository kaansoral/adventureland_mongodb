// mcp_api.js - API used by Adventure Land MCP clients and external tools

var MCP_API_TOKEN_PREFIX = "mcp_";
var MCP_API_TOKEN_PATTERN = /^mcp_[A-Za-z0-9_-]{43}$/;

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

async function mcp_api_list_bots(args) {
	var snapshot = await admin_bots_snapshot();
	var characters = await get_characters(args.user);
	var owned = {};
	for (var i = 0; i < characters.length; i++) owned[characters[i].name] = true;
	snapshot.bots = snapshot.bots.filter(function (bot) {
		return owned[bot.bot_id];
	});
	return snapshot;
}

async function mcp_api_get_bot(args) {
	if (!(await admin_bots_owned_character(args.user, args.character))) return { failed: true, reason: "character_not_found" };
	var bot = await admin_bots_find(args.character);
	return bot ? { success: true, bot: bot } : { failed: true, reason: "character_not_found" };
}

async function mcp_api_set_bot(args) {
	if (!(await admin_bots_owned_character(args.user, args.character))) return { failed: true, reason: "character_not_found" };
	return await admin_bots_queue_state(args.character, args.desired_state, get_id(args.user));
}

async function mcp_api_get_bot_logs(args) {
	if (!(await admin_bots_owned_character(args.user, args.character))) return { failed: true, reason: "character_not_found" };
	var bot = await admin_bots_find(args.character);
	if (!bot) return { failed: true, reason: "character_not_found" };
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
	list_bots: { F: mcp_api_list_bots },
	get_bot: {
		F: mcp_api_get_bot,
		character: { type: "identifier" },
	},
	set_bot: {
		F: mcp_api_set_bot,
		character: { type: "identifier" },
		desired_state: { type: "enum", values: ["running", "stopped"] },
	},
	get_bot_logs: {
		F: mcp_api_get_bot_logs,
		character: { type: "identifier" },
		limit: { type: "number", optional: true },
	},
};

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
