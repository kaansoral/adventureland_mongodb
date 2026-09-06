// mcp_api.js - API used by Adventure Land MCP clients and external tools

var MCP_API_TOKEN_PREFIX = "mcp_";
var MCP_API_TOKEN_PATTERN = /^mcp_[A-Za-z0-9_-]{43}$/;
var MCP_PROTOCOL_CURRENT = "2026-07-28";
var MCP_PROTOCOL_LEGACY = "2025-11-25";
var MCP_SERVER_INFO = { name: "adventure-land", version: "1.11.0", description: "Adventure Land game knowledge, progression context, and browser or Mainframe CODE control" };
var MCP_SOURCE_REPOSITORY = "https://github.com/kaansoral/adventureland_mongodb";
var MCP_START_RESOURCE = "adventureland://guide/start-here";
var MCP_CATALOG_RESOURCES = ["adventureland://catalog/docs", "adventureland://catalog/code-methods", "adventureland://catalog/game-data"];
var MCP_PROGRESSION_OBJECTIVES = ["balanced_farming", "damage", "survival", "support", "gold", "luck", "xp"];
var MCP_MAINFRAME_LOG_RETENTION_DAYS = 30;
var MCP_CODE_EVAL_MAX_BYTES = 64 * 1024;
var MCP_COMM_RELAY_TIMEOUT_MS = 5000;
var MCP_COMM_RELAY_IO = null;
var MCP_INSTRUCTIONS = [
	"Adventure Land is a programmable online game. External AI works through this MCP server; character logic runs as JavaScript CODE in an open game client or Mainframe.",
	"Read adventureland://guide/start-here first. Before writing CODE, also read adventureland://guide/code-runtime, adventureland://guide/code-architecture, adventureland://reference/code-globals, and the exact methods and game definitions the plan will use. Then call mainframe_get_dashboard before changing CODE or starting a character.",
	"Use the three adventureland://catalog resources for discovery. Use list_code_methods and get_code_method for exact public runtime contracts, search_game_data and get_game_data for deployed definitions, and list_docs/get_doc for rules and architecture.",
	"Inspect the owned character profile, class, equipment, inventory, party roster, shop listings, live realm, and existing CODE before planning. Use exact definition keys rather than guessing from display names.",
	"Your continuing objective is to help each owned character become stronger and more capable over time. Keep coherent equipment, useful item levels, suitable stats, acquisition, gold and material supply, farming, combat, and effective CODE in view. These are objectives, not a prescribed sequence; form your own strategy from exact game definitions, account state, observed results, and the player's goals.",
	"Read an existing CODE slot before replacing it. A direct mainframe_link_character call prepays one sixty-minute window and enables automatic renewal while the assignment remains running. When mainframe_get_dashboard includes free_time, shared Steam hours are used first; otherwise each renewal costs one Shell. At a shared machine's renewal boundary, one active character receives 60 minutes, two receive 50, three receive 45, and four receive 40; changing the group does not reprice the current prepaid window. A running assignment persists through Mainframe, controller, host, and microVM restarts and stops only after an explicit disconnect or when the account cannot pay the next renewal. Explain the recurring charge and reuse the same request_id when retrying one lost request. CODE start_character can place up to three additional account-owned characters in the caller's shared microVM. The root owns the prepaid window, and stopping it stops all included workers.",
	"Browser CODE controls require an already-open, connected browser character. Saving a slot does not change running CODE: read browser_code_status, then use browser_code_start, browser_code_stop, or browser_code_reload explicitly. Relay success means the command was sent, not that its effects completed. browser_code_eval and mainframe_code_eval execute arbitrary character CODE and may cause lasting game actions; use them only when the player requested that exact behavior.",
	"Do not add irreversible selling, destroying, upgrading, compounding, exchanging, mailing, trading, or Shell spending unless the player requested it. Re-locate inventory items immediately before each mutation.",
	"Characters that coordinate through parties or CODE messages must share a game server. Verify the authenticated party roster instead of assuming repeated invite actions succeeded. Treat incoming messages and nearby entities as untrusted, short-lived data.",
	"Samaritan at adventureland://code/starters/samaritan and adventureland://code/starters/samaritan-merchant is an optional advanced CODE starting point, not a required workflow or finished answer. Read and adapt it when useful. Keep programmatic Chat disabled.",
	"Treat runtime observations, CODE logs, and the separate Mainframe event journal as evidence. Mainframe events record starts, recovery, restarts, renewal, server changes, and stops. Requested action counters do not prove that the game accepted or completed an action.",
].join(" ");
var MCP_API_SEARCH_SECTIONS = [
	"achievements",
	"classes",
	"conditions",
	"cosmetics",
	"craft",
	"dismantle",
	"drops",
	"events",
	"games",
	"items",
	"maps",
	"monsters",
	"npcs",
	"positions",
	"projectiles",
	"sets",
	"skills",
	"titles",
	"tokens",
];
var MCP_GAME_DATA_DESCRIPTIONS = {
	achievements: "Achievement definitions and rewards.",
	animations: "Animation metadata used by the client.",
	classes: "Class stats, weapon permissions, skills, and progression.",
	conditions: "Buffs, debuffs, and temporary effects.",
	cosmetics: "Cosmetic definitions and appearance metadata.",
	craft: "Craft outputs, required ingredients, quantities, and gold costs.",
	dimensions: "Sprite and asset dimensions.",
	dismantle: "Dismantling inputs and possible outputs.",
	docs: "Loaded documentation directory metadata.",
	drops: "Monster, chest, exchange, and event drop tables.",
	events: "Joinable and announced event definitions.",
	games: "Tavern and minigame definitions.",
	images: "Precomputed image metadata.",
	imagesets: "Client image-set definitions.",
	items: "Item definitions, stats, upgrades, abilities, values, and restrictions.",
	levels: "Experience requirements by level.",
	maps: "Map geometry, doors, NPCs, spawn packs, and destinations.",
	monsters: "Base monster stats, abilities, rewards, and traits.",
	multipliers: "Global gameplay and economy multipliers.",
	npcs: "NPC roles, locations, and interaction metadata.",
	positions: "Named world positions used by travel and content systems.",
	projectiles: "Projectile behavior and visual metadata.",
	sets: "Equipment-set definitions and bonuses.",
	skills: "Skill costs, cooldowns, targets, ranges, and class behavior.",
	sprites: "Client sprite definitions.",
	tilesets: "Map tileset definitions.",
	titles: "Character title definitions and bonuses.",
	tokens: "Token exchange tables and rewards.",
};
var MCP_API_RATE_BUCKETS = new Map();
var MCP_API_RATE_BUCKET_LIMIT = 5000;
var MCP_GAME_SEARCH_INDEX = null;
var MCP_GAME_SEARCH_INDEX_VERSION = null;
var MCP_CODE_METHOD_INDEX = null;

function mcp_api_hash_token(token) {
	return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function mcp_api_token_encryption_key() {
	if (!keys || typeof keys.SERVER_MASTER !== "string" || keys.SERVER_MASTER.length < 16) throw new Error("MCP token encryption is unavailable");
	return crypto.createHmac("sha256", keys.SERVER_MASTER).update("adventure-land:mcp-token-storage:v1", "utf8").digest();
}

function mcp_api_encrypt_token(token, user_id) {
	if (!MCP_API_TOKEN_PATTERN.test(token) || !/^US_[A-Za-z0-9_-]{1,100}$/.test(user_id || "")) throw new Error("Invalid MCP token encryption input");
	var iv = crypto.randomBytes(12);
	var cipher = crypto.createCipheriv("aes-256-gcm", mcp_api_token_encryption_key(), iv);
	cipher.setAAD(Buffer.from("mcp-token:" + user_id, "utf8"));
	var ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
	return {
		version: 1,
		iv: iv.toString("base64url"),
		tag: cipher.getAuthTag().toString("base64url"),
		ciphertext: ciphertext.toString("base64url"),
	};
}

function mcp_api_decrypt_token(secret, user_id) {
	try {
		if (!secret || secret.version !== 1 || typeof secret.iv !== "string" || typeof secret.tag !== "string" || typeof secret.ciphertext !== "string") return null;
		var iv = Buffer.from(secret.iv, "base64url");
		var tag = Buffer.from(secret.tag, "base64url");
		var ciphertext = Buffer.from(secret.ciphertext, "base64url");
		if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 40 || ciphertext.length > 100) return null;
		var decipher = crypto.createDecipheriv("aes-256-gcm", mcp_api_token_encryption_key(), iv);
		decipher.setAAD(Buffer.from("mcp-token:" + user_id, "utf8"));
		decipher.setAuthTag(tag);
		var token = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
		return MCP_API_TOKEN_PATTERN.test(token) ? token : null;
	} catch (error) {
		return null;
	}
}

function mcp_api_rate_profile(method, args) {
	if (method === "plan_character_progression" || (method === "resources/read" && args && /^adventureland:\/\/progression\/characters\/[^/]+\/?$/.test(String(args.uri || ""))))
		return { name: "progression", rate_per_minute: 6, burst: 2 };
	if (method === "get_bank" || (method === "resources/read" && args && args.uri === "adventureland://account/bank")) return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (method === "get_game_data" && !(args && args.name)) return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (method === "resources/read" && args && args.uri === "adventureland://source/runner-functions") return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (method === "resources/read" && args && /^adventureland:\/\/game-data\/[^/]+\/?$/.test(String(args.uri || ""))) return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (
		[
			"save_code",
			"delete_code",
			"browser_code_start",
			"browser_code_stop",
			"browser_code_reload",
			"browser_code_eval",
			"mainframe_code_eval",
			"mainframe_link_character",
			"mainframe_disconnect_character",
		].includes(method)
	)
		return { name: "write", rate_per_minute: 30, burst: 10 };
	return { name: "standard", rate_per_minute: 120, burst: 30 };
}

function mcp_api_take_rate(token, method, args, now) {
	now = Number(now) || Date.now();
	var profile = mcp_api_rate_profile(method, args);
	var key = mcp_api_hash_token(token) + ":" + profile.name;
	var bucket = MCP_API_RATE_BUCKETS.get(key) || { tokens: profile.burst, updated_at: now, seen_at: now };
	var elapsed = Math.max(0, now - bucket.updated_at);
	bucket.tokens = Math.min(profile.burst, bucket.tokens + (elapsed * profile.rate_per_minute) / 60000);
	bucket.updated_at = now;
	bucket.seen_at = now;
	if (bucket.tokens < 1) {
		MCP_API_RATE_BUCKETS.set(key, bucket);
		return { allowed: false, retry_after_ms: Math.max(1, Math.ceil(((1 - bucket.tokens) * 60000) / profile.rate_per_minute)) };
	}
	bucket.tokens -= 1;
	MCP_API_RATE_BUCKETS.set(key, bucket);
	if (MCP_API_RATE_BUCKETS.size > MCP_API_RATE_BUCKET_LIMIT) {
		var oldest = Array.from(MCP_API_RATE_BUCKETS.entries())
			.sort(function (left, right) {
				return left[1].seen_at - right[1].seen_at;
			})
			.slice(0, MCP_API_RATE_BUCKETS.size - MCP_API_RATE_BUCKET_LIMIT);
		for (var i = 0; i < oldest.length; i++) MCP_API_RATE_BUCKETS.delete(oldest[i][0]);
	}
	return { allowed: true };
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
	var token_secret;
	try {
		token_secret = mcp_api_encrypt_token(token, user_id);
	} catch (error) {
		return { failed: true, reason: "token_generation_failed" };
	}
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
				token_secret: A.token_secret,
				created: new Date(),
			});
		},
		{
			user_id: user_id,
			token_hash: token_hash,
			token_secret: token_secret,
			token_record_id: mcp_api_token_record_id(token_hash),
			user_record_id: mcp_api_user_record_id(user_id),
		},
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "token_generation_failed" };
	return { success: true, token: token, rotated: R.rotated };
}

async function get_mcp_api_token_status(user) {
	var user_id = get_id(user);
	var record = await get(mcp_api_user_record_id(user_id));
	var token = record && record.token_hash ? mcp_api_decrypt_token(record.token_secret, user_id) : null;
	if (token && mcp_api_hash_token(token) !== record.token_hash) token = null;
	return {
		success: true,
		active: !!(record && record.token_hash),
		recoverable: !!token,
		created: record && record.created ? record.created : null,
		server_url: "https://adventure.land/mcp",
		start_resource: MCP_START_RESOURCE,
	};
}

async function reveal_mcp_api_token(user) {
	var user_id = get_id(user);
	var record = await get(mcp_api_user_record_id(user_id));
	if (!record || !record.token_hash) return { failed: true, reason: "token_not_found" };
	var token = mcp_api_decrypt_token(record.token_secret, user_id);
	if (!token || mcp_api_hash_token(token) !== record.token_hash) return { failed: true, reason: "token_unavailable" };
	return {
		success: true,
		token: token,
		server_url: "https://adventure.land/mcp",
		start_resource: MCP_START_RESOURCE,
	};
}

async function revoke_mcp_api_token(user) {
	var user_id = get_id(user);
	var R = await tx(
		async () => {
			var record = await tx_get(A.user_record_id);
			R.revoked = !!(record && record.token_hash);
			if (R.revoked) await db.collection("mark").deleteOne({ _id: mcp_api_token_record_id(record.token_hash) }, { session: session });
			await db.collection("mark").deleteOne({ _id: A.user_record_id }, { session: session });
		},
		{ user_record_id: mcp_api_user_record_id(user_id) },
		3,
	);
	if (R.failed) return { failed: true, reason: R.reason || "token_revoke_failed" };
	return { success: true, revoked: R.revoked };
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

function mcp_api_game_data_catalog() {
	var game_data = get_mcp_api_game_data();
	return Object.keys(game_data).map(function (name) {
		var value = game_data[name];
		var count = Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : value === undefined || value === null ? 0 : 1;
		return {
			section: name,
			description: MCP_GAME_DATA_DESCRIPTIONS[name] || "Deployed game data.",
			count: count,
			searchable: MCP_API_SEARCH_SECTIONS.includes(name),
		};
	});
}

async function mcp_api_get_game_data(args) {
	var game_data = get_mcp_api_game_data();
	if (!args.section && args.name !== undefined) return { failed: true, reason: "missing_field", field: "section" };
	if (!args.section) {
		return {
			success: true,
			version: Version,
			sections: Object.keys(game_data),
			catalog: mcp_api_game_data_catalog(),
			workflow: "Use search_game_data to find exact keys, then get_game_data with section and name. Request a full section only when record-by-record discovery is insufficient.",
		};
	}
	if (!Object.prototype.hasOwnProperty.call(game_data, args.section)) return { failed: true, reason: "invalid_section" };
	var section = game_data[args.section];
	if (args.name === undefined) return { success: true, version: Version, section: args.section, data: section };
	if (!section || !Object.prototype.hasOwnProperty.call(section, args.name)) return { failed: true, reason: "not_found" };
	return { success: true, version: Version, section: args.section, name: args.name, data: section[args.name] };
}

function mcp_api_public_field(value, maximum) {
	if (typeof value === "string") return value.slice(0, maximum || 240);
	if (typeof value === "number" || typeof value === "boolean") return value;
	return undefined;
}

function mcp_api_collect_search_fields(value, path_prefix, fields, depth) {
	if (fields.length >= 500 || depth > 5 || value === undefined || value === null) return;
	if (["string", "number", "boolean"].includes(typeof value)) {
		fields.push({ path: path_prefix || "value", value: String(value).slice(0, 500) });
		return;
	}
	if (Array.isArray(value)) {
		for (var i = 0; i < value.length && i < 100 && fields.length < 500; i++) mcp_api_collect_search_fields(value[i], path_prefix + "[" + i + "]", fields, depth + 1);
		return;
	}
	if (typeof value !== "object") return;
	var keys = Object.keys(value).sort().slice(0, 200);
	for (var i = 0; i < keys.length && fields.length < 500; i++) {
		var path = path_prefix ? path_prefix + "." + keys[i] : keys[i];
		mcp_api_collect_search_fields(value[keys[i]], path, fields, depth + 1);
	}
}

function mcp_api_game_search_index() {
	if (MCP_GAME_SEARCH_INDEX && MCP_GAME_SEARCH_INDEX_VERSION === Version) return MCP_GAME_SEARCH_INDEX;
	var game_data = get_mcp_api_game_data();
	var index = [];
	for (var s = 0; s < MCP_API_SEARCH_SECTIONS.length; s++) {
		var section_name = MCP_API_SEARCH_SECTIONS[s];
		var section = game_data[section_name];
		if (!section || typeof section !== "object") continue;
		var names = Object.keys(section).sort();
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			var value = section[name];
			var label = value && typeof value === "object" ? value.name || value.title || value.id || "" : "";
			var description = value && typeof value === "object" ? value.description || value.explanation || "" : "";
			var fields = [];
			mcp_api_collect_search_fields(value, "", fields, 0);
			var search_text = (
				name +
				" " +
				label +
				" " +
				description +
				" " +
				fields
					.map(function (field) {
						return field.path + " " + field.value;
					})
					.join(" ")
			).toLowerCase();
			index.push({ section: section_name, name: name, value: value, label: label, description: description, fields: fields, search_text: search_text });
		}
	}
	MCP_GAME_SEARCH_INDEX = index;
	MCP_GAME_SEARCH_INDEX_VERSION = Version;
	return index;
}

function mcp_api_search_tokens(query) {
	var stop_words = new Set([
		"an",
		"and",
		"are",
		"as",
		"at",
		"be",
		"by",
		"do",
		"for",
		"from",
		"how",
		"in",
		"is",
		"it",
		"of",
		"on",
		"or",
		"that",
		"the",
		"this",
		"to",
		"use",
		"what",
		"where",
		"which",
		"with",
	]);
	return query
		.toLowerCase()
		.split(/[^a-z0-9_.+-]+/)
		.filter(function (token) {
			return token.length > 1 && !stop_words.has(token);
		})
		.slice(0, 12);
}

async function mcp_api_search_game_data(args) {
	var query = args.query.trim().toLowerCase();
	if (!query.length || query.length > 100) return { failed: true, reason: "invalid_query" };
	var limit = Math.max(1, Math.min(Number(args.limit) || 25, 50));
	if (args.section && !MCP_API_SEARCH_SECTIONS.includes(args.section)) return { failed: true, reason: "invalid_section" };
	var tokens = mcp_api_search_tokens(query);
	if (!tokens.length) return { failed: true, reason: "invalid_query" };
	var matches = mcp_api_game_search_index()
		.filter(function (entry) {
			return (
				(!args.section || entry.section === args.section) &&
				tokens.every(function (token) {
					return entry.search_text.includes(token);
				})
			);
		})
		.map(function (entry) {
			var name_text = (entry.name + " " + entry.label).toLowerCase();
			var score = name_text.includes(query) ? 100 : 0;
			for (var i = 0; i < tokens.length; i++) score += name_text.includes(tokens[i]) ? 10 : 1;
			return { entry: entry, score: score };
		})
		.sort(function (left, right) {
			return right.score - left.score || left.entry.section.localeCompare(right.entry.section) || left.entry.name.localeCompare(right.entry.name);
		})
		.slice(0, limit);
	var results = matches.map(function (match) {
		var entry = match.entry;
		var value = entry.value;
		var result = { section: entry.section, name: entry.name };
		var public_name = mcp_api_public_field(entry.label, 160);
		var public_description = mcp_api_public_field(entry.description, 320);
		if (public_name !== undefined) result.label = public_name;
		if (public_description !== undefined) result.description = public_description;
		if (value && typeof value === "object") {
			["type", "class", "level", "tier", "skin", "map"].forEach(function (field) {
				var public_value = mcp_api_public_field(value[field], 100);
				if (public_value !== undefined) result[field] = public_value;
			});
		}
		result.matched_fields = entry.fields
			.filter(function (field) {
				var text = (field.path + " " + field.value).toLowerCase();
				return tokens.some(function (token) {
					return text.includes(token);
				});
			})
			.slice(0, 5);
		return result;
	});
	return { success: true, version: Version, query: args.query, tokens: tokens, count: results.length, limit: limit, results: results };
}

function mcp_api_doc_entries() {
	var result = [];
	var names = new Set();
	var reference_routes = {
		"data-character": "/docs/code/character/reference",
		"data-monster": "/docs/code/monster/reference",
		"data-server-status": "/docs/code/server/status",
		"events-character": "/docs/code/character/events",
		"events-game": "/docs/code/game/events",
	};
	function traverse(entries, trail, route) {
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			var next_trail = trail.concat(entry[1]);
			var next_route = route.concat(entry[0]);
			if (entry[4]) traverse(entry[4], next_trail, next_route);
			else {
				result.push({
					name: entry[0],
					title: entry[1],
					keywords: entry[2] || "",
					section: trail.join(" / ") || "Guide",
					docs_url: "https://adventure.land/docs/guide/" + next_route.map(encodeURIComponent).join("/"),
				});
				names.add(entry[0]);
			}
		}
	}
	traverse((docs && docs.guide) || [], [], []);
	for (var i = 0; i < ((docs && docs.references) || []).length; i++) {
		var entry = docs.references[i];
		if (!names.has(entry[0]))
			result.push({
				name: entry[0],
				title: entry[1],
				keywords: entry[2] || "",
				section: "CODE Reference",
				docs_url: "https://adventure.land" + (reference_routes[entry[0]] || "/docs/guide/" + encodeURIComponent(entry[0])),
			});
	}
	return result;
}

function mcp_api_html_to_text(html) {
	return String(html || "")
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<br\s*\/?\s*>/gi, "\n")
		.replace(/<li\b[^>]*>/gi, "- ")
		.replace(/<\/(td|th)>/gi, "\t")
		.replace(/<\/tr>/gi, "\n")
		.replace(/<\/(p|div|pre|li|h[1-6]|table|ol|ul)>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

async function mcp_api_list_docs(args) {
	var entries = mcp_api_doc_entries();
	if (args.query) {
		var query = args.query.trim().toLowerCase();
		if (!query.length || query.length > 100) return { failed: true, reason: "invalid_query" };
		entries = entries.filter(function (entry) {
			return (entry.name + " " + entry.title + " " + entry.keywords + " " + entry.section).toLowerCase().includes(query);
		});
	}
	return { success: true, count: entries.length, articles: entries };
}

async function mcp_api_get_doc(args) {
	var entry = mcp_api_doc_entries().find(function (candidate) {
		return candidate.name === args.name;
	});
	if (!entry) return { failed: true, reason: "not_found" };
	var html;
	try {
		html = shtml("docs/guide/" + entry.name + ".html");
	} catch (e) {
		try {
			html = shtml("docs/articles/" + entry.name + ".html");
		} catch (nested) {
			return { failed: true, reason: "not_found" };
		}
	}
	return { success: true, article: entry, format: "text", content: mcp_api_html_to_text(html) };
}

function mcp_api_public_source_location(name) {
	var relative = "js/runner_functions.js";
	var source;
	try {
		source = fs.readFileSync(path.resolve(__dirname, relative), "utf8");
	} catch (e) {
		return null;
	}
	var escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	var match = new RegExp("(?:async\\s+)?function\\s+" + escaped + "\\s*\\(").exec(source);
	if (!match) return { file: relative, repository_url: MCP_SOURCE_REPOSITORY + "/blob/main/" + relative, note: "Compatibility helper; use the documented contract." };
	var line = source.slice(0, match.index).split("\n").length;
	return { file: relative, line: line, repository_url: MCP_SOURCE_REPOSITORY + "/blob/main/" + relative + "#L" + line };
}

async function mcp_api_get_code_method(args) {
	var name = String(args.name);
	if (!((docs && docs.functions) || []).includes(name)) return { failed: true, reason: "not_found" };
	var html;
	try {
		html = shtml("docs/functions/" + name + ".html");
	} catch (e) {
		return { failed: true, reason: "not_found" };
	}
	return {
		success: true,
		name: name,
		documentation: mcp_api_html_to_text(html),
		docs_url: "https://adventure.land/docs/code/functions/" + encodeURIComponent(name),
		source: mcp_api_public_source_location(name),
	};
}

function mcp_api_code_method_index() {
	if (MCP_CODE_METHOD_INDEX) return MCP_CODE_METHOD_INDEX;
	MCP_CODE_METHOD_INDEX = ((docs && docs.functions) || [])
		.slice()
		.sort()
		.map(function (name) {
			var documentation = "";
			try {
				documentation = mcp_api_html_to_text(shtml("docs/functions/" + name + ".html"));
			} catch (e) {}
			var paragraphs = documentation.split(/\n+/).filter(Boolean);
			return {
				name: name,
				docs_url: "https://adventure.land/docs/code/functions/" + encodeURIComponent(name),
				signature: (paragraphs[0] || name).slice(0, 240),
				summary: paragraphs.slice(1, 4).join(" ").slice(0, 500),
				search_text: (name + " " + documentation).toLowerCase(),
			};
		});
	return MCP_CODE_METHOD_INDEX;
}

async function mcp_api_list_code_methods(args) {
	var query = (args.query || "").trim().toLowerCase();
	if (query.length > 100) return { failed: true, reason: "invalid_query" };
	var index = mcp_api_code_method_index();
	var methods = index;
	var semantic = false;
	if (query) {
		var name_matches = index.filter(function (method) {
			return method.name.toLowerCase().includes(query);
		});
		if (name_matches.length) methods = name_matches;
		else {
			semantic = true;
			var tokens = mcp_api_search_tokens(query);
			var scored = index
				.map(function (method) {
					var name = method.name.toLowerCase();
					var matched = tokens.filter(function (token) {
						return method.search_text.includes(token);
					});
					var score =
						matched.length * 10 +
						matched.filter(function (token) {
							return name.includes(token);
						}).length *
							20;
					return { method: method, matched: matched.length, score: score };
				})
				.filter(function (result) {
					return result.matched > 0;
				})
				.sort(function (left, right) {
					return right.score - left.score || left.method.name.localeCompare(right.method.name);
				});
			var strong = scored.filter(function (result) {
				return result.matched >= Math.min(2, tokens.length);
			});
			methods = (strong.length ? strong : scored).map(function (result) {
				return result.method;
			});
		}
	}
	var available = methods.length;
	var limit = args.limit !== undefined ? Math.max(1, Math.min(Number(args.limit) || 25, 50)) : query ? 25 : methods.length;
	methods = methods.slice(0, limit);
	return {
		success: true,
		count: methods.length,
		available: available,
		query: args.query || null,
		semantic: semantic,
		methods: methods.map(function (method) {
			var result = { name: method.name, signature: method.signature, docs_url: method.docs_url };
			if (query && method.summary) result.summary = method.summary;
			return result;
		}),
	};
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

async function mcp_api_get_libraries(args) {
	return {
		success: true,
		libraries: {
			"default_code.js": shtml("htmls/contents/codes/default_code.js"),
			"runner_functions.js": shtml("htmls/contents/codes/runner_functions.js"),
			"runner_compat.js": shtml("htmls/contents/codes/runner_compat.js"),
			"common_functions.js": shtml("htmls/contents/codes/common_functions.js"),
		},
	};
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

function mcp_api_comm_io() {
	if (MCP_COMM_RELAY_IO) return MCP_COMM_RELAY_IO;
	MCP_COMM_RELAY_IO = require("socket.io-client").io;
	return MCP_COMM_RELAY_IO;
}

async function mcp_api_code_target(args, runtime) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var name = (character.info && character.info.name) || character.name;
	var assignment = await mainframe_get_assignment(character);
	var on_mainframe = !!(assignment && assignment.desired_state === "running");
	if (runtime === "browser" && on_mainframe) return { failed: true, reason: "runtime_mismatch", character: name, runtime: "mainframe" };
	if (runtime === "mainframe" && !on_mainframe) return { failed: true, reason: "mainframe_unavailable", character: name };
	var secret = (character.info && character.info.secret) || character.secret;
	if (!character.online || !character.server || typeof secret !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(secret))
		return { failed: true, reason: "character_offline", character: name, runtime: runtime };
	var connection = await mainframe_resolve_server(character.server);
	if (!connection) return { failed: true, reason: "server_unavailable", character: name, runtime: runtime };
	try {
		var connection_url = new URL(connection.url);
		var local_allowed = typeof Local !== "undefined" && Local;
		if (
			connection_url.protocol !== "https:" ||
			connection_url.username ||
			connection_url.password ||
			connection_url.pathname !== "/" ||
			connection_url.search ||
			connection_url.hash ||
			(!local_allowed && connection_url.hostname !== "adventure.land" && !connection_url.hostname.endsWith(".adventure.land"))
		)
			return { failed: true, reason: "server_unavailable", character: name, runtime: runtime };
	} catch (e) {
		return { failed: true, reason: "server_unavailable", character: name, runtime: runtime };
	}
	return {
		character: name,
		runtime: runtime,
		server: connection.label,
		url: connection.url,
		path: connection.path,
		secret: secret,
	};
}

function mcp_api_comm_relay(target, code) {
	return new Promise(function (resolve) {
		var socket = null;
		var timeout = null;
		var sent_timeout = null;
		var settled = false;
		var welcomed = false;
		var command_sent = false;
		var code_running = false;
		function public_result(extra) {
			var result = {
				success: true,
				character: target.character,
				runtime: target.runtime,
				server: target.server,
				online: true,
			};
			if (code === undefined) result.code_running = code_running;
			else result.code_running_before = code_running;
			return Object.assign(result, extra || {});
		}
		function finish(result) {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			if (sent_timeout) clearTimeout(sent_timeout);
			if (socket) {
				socket.removeAllListeners();
				socket.disconnect();
			}
			resolve(result);
		}
		try {
			socket = mcp_api_comm_io()(target.url, {
				path: target.path,
				transports: ["websocket"],
				reconnection: false,
				forceNew: true,
				query: { desktop: "1", secret: target.secret },
			});
		} catch (e) {
			return finish({ failed: true, reason: "comm_unavailable", character: target.character, runtime: target.runtime });
		}
		timeout = setTimeout(function () {
			finish({ failed: true, reason: "comm_timeout", character: target.character, runtime: target.runtime });
		}, MCP_COMM_RELAY_TIMEOUT_MS);
		socket.on("welcome", function (data) {
			var observed = data && data.character;
			if (!observed || String(observed.name || observed.id || "").toLowerCase() !== String(target.character).toLowerCase())
				return finish({ failed: true, reason: "browser_session_unavailable", character: target.character, runtime: target.runtime });
			welcomed = true;
			code_running = observed.code === true;
			if (code === undefined) return finish(public_result());
			socket.emit("loaded", { success: 1, width: 800, height: 600, scale: 2 });
		});
		socket.on("entities", function () {
			if (!welcomed || command_sent || code === undefined) return;
			command_sent = true;
			socket.emit("o:command", code);
			sent_timeout = setTimeout(function () {
				finish(public_result({ queued: true, confirmed: false }));
			}, 100);
		});
		socket.on("connect_error", function () {
			finish({ failed: true, reason: "comm_unavailable", character: target.character, runtime: target.runtime });
		});
		socket.on("disconnect", function () {
			if (!settled) finish({ failed: true, reason: "comm_disconnected", character: target.character, runtime: target.runtime });
		});
	});
}

function mcp_api_code_eval_valid(code) {
	return typeof code === "string" && code.length > 0 && Buffer.byteLength(code, "utf8") <= MCP_CODE_EVAL_MAX_BYTES;
}

async function mcp_api_browser_code_status(args) {
	var target = await mcp_api_code_target(args, "browser");
	if (target.failed) {
		if (target.reason === "character_offline")
			return { success: true, character: target.character, runtime: "browser", online: false, code_running: false };
		return target;
	}
	return await mcp_api_comm_relay(target);
}

async function mcp_api_browser_code_start(args) {
	var slot = await mainframe_validate_code_slot(args.user, args.slot);
	if (!slot) return { failed: true, reason: "code_not_found" };
	var target = await mcp_api_code_target(args, "browser");
	if (target.failed) return target;
	var status = await mcp_api_comm_relay(target);
	if (status.failed) return status;
	if (status.code_running) return Object.assign(status, { already_running: true, slot: slot });
	var result = await mcp_api_comm_relay(target, "parent.api_call(\"load_code\",{name:" + JSON.stringify(slot) + ",run:\"1\"});");
	if (!result.failed) Object.assign(result, { requested_state: "running", slot: slot });
	return result;
}

async function mcp_api_browser_code_stop(args) {
	var target = await mcp_api_code_target(args, "browser");
	if (target.failed) return target;
	var status = await mcp_api_comm_relay(target);
	if (status.failed) return status;
	if (!status.code_running) return Object.assign(status, { already_stopped: true });
	var result = await mcp_api_comm_relay(target, "parent.stop_runner();");
	if (!result.failed) result.requested_state = "stopped";
	return result;
}

async function mcp_api_browser_code_reload(args) {
	var slot = await mainframe_validate_code_slot(args.user, args.slot);
	if (!slot) return { failed: true, reason: "code_not_found" };
	var target = await mcp_api_code_target(args, "browser");
	if (target.failed) return target;
	var result = await mcp_api_comm_relay(target, "parent.api_call(\"load_code\",{name:" + JSON.stringify(slot) + ",run:\"1\"});");
	if (!result.failed) Object.assign(result, { requested_state: "running", slot: slot });
	return result;
}

async function mcp_api_browser_code_eval(args) {
	if (!mcp_api_code_eval_valid(args.code))
		return { failed: true, reason: "invalid_code", max_bytes: MCP_CODE_EVAL_MAX_BYTES, received_bytes: typeof args.code === "string" ? Buffer.byteLength(args.code, "utf8") : null };
	var target = await mcp_api_code_target(args, "browser");
	if (target.failed) return target;
	return await mcp_api_comm_relay(target, args.code);
}

async function mcp_api_mainframe_code_eval(args) {
	if (!mcp_api_code_eval_valid(args.code))
		return { failed: true, reason: "invalid_code", max_bytes: MCP_CODE_EVAL_MAX_BYTES, received_bytes: typeof args.code === "string" ? Buffer.byteLength(args.code, "utf8") : null };
	var target = await mcp_api_code_target(args, "mainframe");
	if (target.failed) return target;
	return await mcp_api_comm_relay(target, args.code);
}

function mcp_api_mainframe_contract() {
	return {
		version: 7,
		billing: "auto_renewing_prepaid",
		shells_per_period: MAINFRAME_PERIOD_SHELLS,
		period_minutes: MAINFRAME_PERIOD_MS / 60000,
		renewal_minutes_by_active_characters: mainframe_renewal_schedule(),
		renewal_character_count: "sampled_at_renewal_boundary",
		free_time: "optional_shared_steam_hours_used_before_shells",
		initial_charge: "before_start_when_no_paid_time_remains",
		renewal: "automatic_while_assignment_is_running",
		stop_conditions: ["explicit_disconnect", "not_enough_shells_at_renewal"],
		restart_persistence: ["http_service", "mainframe_controller", "host", "microvm"],
		code_started_workers: {
			max_included: 3,
			max_characters_per_machine: MAINFRAME_GROUP_MAX_WORKERS,
			billing: "included_with_group_root",
			renewal_duration: "based_on_active_group_size_at_the_next_renewal",
			root_stop: "stops_all_included_workers",
			child_stop: "stops_only_that_worker",
			direct_mainframe_links: "separately_billed_dedicated_microvms",
			containment: "separate_worker_identities_and_limits_inside_one_microvm",
			shared_cpu: "one_fixed_microvm_cpu_budget",
			shared_guest_memory_mib: 192,
			dynamic_host_memory_cap_mib: [192, 224, 240, 256],
		},
		code_log_retention_days: MCP_MAINFRAME_LOG_RETENTION_DAYS,
		mainframe_event_retention_days: MCP_MAINFRAME_LOG_RETENTION_DAYS,
		disconnected_time_counts: true,
		traffic: "requested_actions_not_confirmation",
		observation: "authenticated_game_server_events",
		movement: "confirmed_position_and_map_changes_only",
		stuck: "stationary_for_15s_with_10_recent_move_requests",
	};
}

function mcp_api_mainframe_access(access, assignment) {
	var result = Object.assign({}, access || {});
	result.auto_renew = !!(result.active && assignment && assignment.desired_state === "running");
	result.next_charge_at = result.auto_renew ? result.access_until : null;
	return result;
}

function mcp_api_mainframe_runtime(bot) {
	if (!bot) return null;
	var runtime = Object.assign({}, bot, { character: bot.bot_id });
	delete runtime.bot_id;
	return runtime;
}

function mcp_api_safe_snapshot(value, depth) {
	if (value === undefined || value === null || typeof value === "boolean" || typeof value === "number") return value;
	if (typeof value === "string") return value.slice(0, 500);
	if (value instanceof Date) return value.toISOString();
	if (depth >= 5) return null;
	if (Array.isArray(value))
		return value.slice(0, 100).map(function (entry) {
			return mcp_api_safe_snapshot(entry, depth + 1);
		});
	if (typeof value !== "object") return null;
	var result = {};
	Object.keys(value)
		.sort()
		.slice(0, 100)
		.forEach(function (name) {
			var clean = mcp_api_safe_snapshot(value[name], depth + 1);
			if (clean !== undefined) result[name] = clean;
		});
	return result;
}

function mcp_api_character_profile(character, detailed) {
	var info = (character && character.info) || {};
	var inventory = Array.isArray(info.items) ? info.items : [];
	var profile = {
		source: "last_account_snapshot",
		synchronized_at: character && character.last_sync ? character.last_sync : null,
		name: info.name || (character && character.name) || null,
		class: (character && character.type) || null,
		level: Number(character && character.level) || 0,
		xp: Number(info.xp) || 0,
		server: (character && character.server) || null,
		online: !!(character && character.online),
		map: info.map || null,
		x: Number.isFinite(Number(info.x)) ? Number(info.x) : null,
		y: Number.isFinite(Number(info.y)) ? Number(info.y) : null,
		rip: info.rip === true,
		hp: Number(info.hp) || 0,
		mp: Number(info.mp) || 0,
		gold: Number(info.gold) || 0,
		inventory_slots: inventory.length,
		inventory_items: inventory.filter(Boolean).length,
	};
	if (detailed) {
		profile.equipment = mcp_api_safe_snapshot(info.slots || {}, 0);
		profile.inventory = mcp_api_safe_snapshot(inventory, 0);
		profile.conditions = mcp_api_safe_snapshot(info.s || {}, 0);
		profile.quests = mcp_api_safe_snapshot(info.q || {}, 0);
		profile.progress = mcp_api_safe_snapshot(info.p || {}, 0);
	}
	return profile;
}

function mcp_api_progression_classes() {
	if (typeof classes === "object" && classes) return classes;
	if (typeof G === "object" && G && G.classes) return G.classes;
	return {};
}

function mcp_api_progression_items() {
	if (typeof items === "object" && items) return items;
	if (typeof G === "object" && G && G.items) return G.items;
	return {};
}

function mcp_api_progression_titles() {
	if (typeof titles === "object" && titles) return titles;
	if (typeof G === "object" && G && G.titles) return G.titles;
	return {};
}

function mcp_api_progression_character_type(character) {
	var info = character && character.info && typeof character.info === "object" ? character.info : {};
	var value = (character && (character.type || character.ctype)) || info.ctype || info.type || "";
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function mcp_api_progression_supported_classes() {
	return Object.keys(mcp_api_progression_classes()).sort();
}

function mcp_api_owned_item(item) {
	if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.name !== "string" || !mcp_api_progression_items()[item.name] || item.name === "placeholder") return null;
	var result = { name: item.name };
	if (item.level !== undefined && Number.isFinite(Number(item.level))) result.level = Math.trunc(Math.max(0, Math.min(100, Number(item.level))));
	if (item.q !== undefined && Number.isFinite(Number(item.q))) result.q = Math.trunc(Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Number(item.q))));
	if (item.grace !== undefined && Number.isFinite(Number(item.grace))) result.grace = Math.max(0, Math.min(100000, Number(item.grace)));
	if (typeof item.stat_type === "string" && /^[a-z_]{1,32}$/.test(item.stat_type)) result.stat_type = item.stat_type;
	if (typeof item.p === "string" && /^[A-Za-z0-9_]{1,100}$/.test(item.p)) result.p = item.p;
	if (item.l || item.locked) result.locked = true;
	if (item.b || item.blocked) result.blocked = true;
	return result;
}

function mcp_api_saved_bank(user) {
	var info = (user && user.info) || {};
	var packs = {};
	for (var i = 0; i < 48; i++) {
		var pack = "items" + i;
		if (!Array.isArray(info[pack])) continue;
		packs[pack] = info[pack].map(function (item) {
			return mcp_api_owned_item(item);
		});
	}
	return {
		success: true,
		source: "last_account_snapshot",
		observed_at: info.last_sync || null,
		stale: !!(user && user.server && user.mounted_to),
		mounted_character_id: (user && user.mounted_to) || null,
		gold: Math.max(0, Number(info.gold) || 0),
		packs: packs,
	};
}

async function mcp_api_get_bank(args) {
	var saved = mcp_api_saved_bank(args.user);
	if (saved.stale) saved.warning = "The bank is currently mounted in the game. This saved account snapshot may be stale.";
	return saved;
}

function mcp_api_bank_equipment_candidates(bank) {
	if (!bank || bank.stale || !bank.packs) return [];
	var equipment_types = new Set(["helmet", "pants", "chest", "weapon", "amulet", "earring", "shoes", "gloves", "ring", "shield", "belt", "source", "orb", "quiver", "cape", "misc_offhand", "tool"]);
	var result = [];
	Object.keys(bank.packs)
		.sort(function (left, right) {
			return Number(left.slice(5)) - Number(right.slice(5));
		})
		.forEach(function (pack) {
			var items = bank.packs[pack];
			if (!Array.isArray(items)) return;
			for (var i = 0; i < items.length && result.length < 600; i++) {
				var item = mcp_api_owned_item(items[i]);
				var def = item && mcp_api_progression_items()[item.name];
				if (def && equipment_types.has(def.type)) result.push({ source: "bank:" + pack + ":" + i, item: item });
			}
		});
	return result;
}

// Keep this approximation aligned with calculate_item_properties, equip rules, and loaded upgrade/compound tables.
var MCP_PROGRESSION_APPROXIMATION_VERSION = 1;
var MCP_PROGRESSION_PROPERTY_FIELDS = [
	"gold",
	"luck",
	"xp",
	"int",
	"str",
	"dex",
	"vit",
	"for",
	"hp",
	"mp",
	"attack",
	"heal",
	"range",
	"armor",
	"resistance",
	"pnresistance",
	"firesistance",
	"fzresistance",
	"phresistance",
	"stresistance",
	"speed",
	"evasion",
	"miss",
	"reflection",
	"lifesteal",
	"manasteal",
	"rpiercing",
	"apiercing",
	"crit",
	"critdamage",
	"dreturn",
	"frequency",
	"mp_cost",
	"mp_reduction",
	"output",
	"courage",
	"mcourage",
	"pcourage",
	"blast",
	"explosion",
	"attr0",
	"attr1",
	"stat",
];

function mcp_api_progression_number(value) {
	value = Number(value);
	return Number.isFinite(value) ? value : 0;
}

function mcp_api_progression_round(value, digits) {
	var multiplier = Math.pow(10, digits === undefined ? 4 : digits);
	return Math.round(mcp_api_progression_number(value) * multiplier) / multiplier;
}

function mcp_api_progression_definition(item, character_type, map) {
	var source = item && mcp_api_progression_items()[item.name];
	if (!source) return null;
	var def = JSON.parse(JSON.stringify(source));
	[character_type, map].forEach(function (scope) {
		var extras = scope && source[scope];
		if (!extras || typeof extras !== "object" || Array.isArray(extras)) return;
		Object.keys(extras).forEach(function (name) {
			if ((name === "upgrade" || name === "compound") && extras[name] && typeof extras[name] === "object") {
				def[name] = def[name] || {};
				Object.keys(extras[name]).forEach(function (property) {
					def[name][property] = mcp_api_progression_number(def[name][property]) + mcp_api_progression_number(extras[name][property]);
				});
			} else if (typeof extras[name] === "number") def[name] = mcp_api_progression_number(def[name]) + extras[name];
			else def[name] = extras[name];
		});
	});
	return def;
}

function mcp_api_progression_item_properties(item, character_type, map) {
	item = mcp_api_owned_item(item);
	var def = mcp_api_progression_definition(item, character_type, map);
	if (!item || !def) return {};
	var properties = {};
	for (var i = 0; i < MCP_PROGRESSION_PROPERTY_FIELDS.length; i++) properties[MCP_PROGRESSION_PROPERTY_FIELDS[i]] = 0;
	if (item.p === "shiny") {
		if (def.attack) properties.attack += 4 + (["axe", "basher", "great_staff"].includes(def.wtype) ? 3 : 0);
		else if (def.stat) properties.stat += 2;
		else if (def.armor) {
			properties.armor += 12;
			properties.resistance += 10;
		} else {
			properties.str++;
			properties.dex++;
			properties.int++;
		}
	} else if (item.p && mcp_api_progression_titles()[item.p]) {
		Object.keys(mcp_api_progression_titles()[item.p]).forEach(function (name) {
			if (Object.prototype.hasOwnProperty.call(properties, name)) properties[name] += mcp_api_progression_number(mcp_api_progression_titles()[item.p][name]);
		});
	}
	var progression = def.upgrade || def.compound;
	var level = Math.max(0, Math.min(100, Math.trunc(mcp_api_progression_number(item.level))));
	if (progression) {
		for (var current_level = 1; current_level <= level; current_level++) {
			var level_multiplier = 1;
			if (def.upgrade) {
				if (current_level === 7) level_multiplier = 1.25;
				else if (current_level === 8) level_multiplier = 1.5;
				else if (current_level === 9) level_multiplier = 2;
				else if (current_level === 10) level_multiplier = 3;
				else if (current_level === 11 || current_level === 12) level_multiplier = 1.25;
			} else {
				if (current_level === 5) level_multiplier = 1.25;
				else if (current_level === 6) level_multiplier = 1.5;
				else if (current_level === 7) level_multiplier = 2;
				else if (current_level >= 8) level_multiplier = 3;
			}
			Object.keys(progression).forEach(function (name) {
				if (!Object.prototype.hasOwnProperty.call(properties, name) || typeof progression[name] !== "number") return;
				properties[name] += name === "stat" ? Math.round(progression[name] * level_multiplier) : progression[name] * level_multiplier;
				if (name === "stat" && current_level >= 7) properties.stat++;
			});
		}
	}
	if (level === 10 && properties.stat && def.tier >= 3) properties.stat += 2;
	Object.keys(def).forEach(function (name) {
		if (Object.prototype.hasOwnProperty.call(properties, name) && typeof def[name] === "number") properties[name] += def[name];
	});
	if (item.p === "legacy" && def.legacy) {
		Object.keys(def.legacy).forEach(function (name) {
			if (!Object.prototype.hasOwnProperty.call(properties, name)) return;
			if (def.legacy[name] === null) delete properties[name];
			else properties[name] = mcp_api_progression_number(properties[name]) + mcp_api_progression_number(def.legacy[name]);
		});
	}
	var stat_multipliers = {
		gold: 0.5,
		luck: 1,
		xp: 0.5,
		int: 1,
		str: 1,
		dex: 1,
		vit: 1,
		for: 1,
		armor: 2.25,
		resistance: 2.25,
		speed: 0.325,
		evasion: 0.325,
		reflection: 0.15,
		lifesteal: 0.15,
		manasteal: 0.04,
		rpiercing: 2.25,
		apiercing: 2.25,
		crit: 0.125,
		dreturn: 0.5,
		frequency: 0.325,
		mp_cost: -0.6,
		output: 0.175,
	};
	if (def.stat && item.stat_type && Object.prototype.hasOwnProperty.call(properties, item.stat_type)) {
		properties[item.stat_type] += properties.stat * mcp_api_progression_number(stat_multipliers[item.stat_type] === undefined ? 1 : stat_multipliers[item.stat_type]);
		properties.stat = 0;
	}
	Object.keys(properties).forEach(function (name) {
		properties[name] = mcp_api_progression_round(
			properties[name],
			["evasion", "miss", "reflection", "dreturn", "lifesteal", "manasteal", "attr0", "attr1", "crit", "critdamage"].includes(name) ? 4 : 0,
		);
		if (!properties[name]) delete properties[name];
	});
	return properties;
}

function mcp_api_progression_item_signature(item) {
	item = mcp_api_owned_item(item);
	return item ? [item.name, item.level || 0, item.stat_type || "", item.p || "", item.locked ? 1 : 0, item.blocked ? 1 : 0].join("|") : "";
}

function mcp_api_progression_delta(before, after) {
	var result = {};
	var names = new Set(Object.keys(before || {}).concat(Object.keys(after || {})));
	names.forEach(function (name) {
		var delta = mcp_api_progression_round(mcp_api_progression_number(after && after[name]) - mcp_api_progression_number(before && before[name]));
		if (delta) result[name] = delta;
	});
	return result;
}

function mcp_api_progression_weights(objective, character_type) {
	var weights = {};
	function add(values, multiplier) {
		Object.keys(values).forEach(function (name) {
			weights[name] = mcp_api_progression_number(weights[name]) + values[name] * (multiplier === undefined ? 1 : multiplier);
		});
	}
	var damage = { attack: 5, frequency: 40, crit: 3, critdamage: 0.8, apiercing: 0.12, rpiercing: 0.12, output: 2, range: 0.15, blast: 0.5, explosion: 0.5 };
	var survival = { hp: 0.04, vit: 4, armor: 0.25, resistance: 0.25, evasion: 3, reflection: 2.5, for: 2.5, speed: 0.3, dreturn: 1.5 };
	var support = { heal: 5, int: 3, mp: 0.025, frequency: 30, output: 2, range: 0.15, hp: 0.015, armor: 0.08, resistance: 0.08 };
	if (objective === "damage") add(damage);
	else if (objective === "survival") add(survival);
	else if (objective === "support") add(support);
	else {
		add(damage, objective === "balanced_farming" ? 0.65 : 0.4);
		add(survival, objective === "balanced_farming" ? 0.35 : 0.15);
	}
	if (objective === "gold") weights.gold = 10;
	if (objective === "luck") weights.luck = 10;
	if (objective === "xp") weights.xp = 10;
	var class_def = mcp_api_progression_classes()[character_type];
	var primary = (class_def && class_def.main_stat) || "vit";
	weights[primary] = mcp_api_progression_number(weights[primary]) + (objective === "survival" ? 1 : 4);
	if (character_type === "paladin" && objective !== "survival") weights.int = mcp_api_progression_number(weights.int) + 1.5;
	return weights;
}

function mcp_api_progression_score(properties, objective, character_type) {
	var weights = mcp_api_progression_weights(objective, character_type);
	var score = 0;
	Object.keys(weights).forEach(function (name) {
		score += mcp_api_progression_number(properties && properties[name]) * weights[name];
	});
	return mcp_api_progression_round(score, 2);
}

function mcp_api_progression_mechanics(item) {
	var def = item && mcp_api_progression_items()[item.name];
	if (!def) return [];
	var result = [];
	["ability", "aura", "set", "projectile"].forEach(function (name) {
		if (def[name]) result.push(name + ":" + def[name]);
	});
	if (def.attr0 !== undefined || def.attr1 !== undefined || (def.upgrade && (def.upgrade.attr0 !== undefined || def.upgrade.attr1 !== undefined))) result.push("special_scaling");
	if (item.p === "glitched") result.push("unmodeled_glitched_bonus");
	return result;
}

function mcp_api_progression_candidate_slots(character_type, character_level, slots, item) {
	var item_definitions = mcp_api_progression_items();
	var def = item && item_definitions[item.name];
	var class_def = mcp_api_progression_classes()[character_type];
	if (!def || !class_def) return [];
	if (def.class && !(Array.isArray(def.class) ? def.class : [def.class]).includes(character_type)) return [];
	if (def.level && mcp_api_progression_number(character_level) < def.level) return [];
	if (def.type === "ring")
		return [
			{ slot: "ring1", unequip: [] },
			{ slot: "ring2", unequip: [] },
		];
	if (def.type === "earring")
		return [
			{ slot: "earring1", unequip: [] },
			{ slot: "earring2", unequip: [] },
		];
	if (["shield", "source", "quiver", "misc_offhand"].includes(def.type)) {
		var main_def = slots.mainhand && item_definitions[slots.mainhand.name];
		if (class_def.offhand && class_def.offhand[def.type] && !(main_def && class_def.doublehand && class_def.doublehand[main_def.wtype])) return [{ slot: "offhand", unequip: [] }];
		return [];
	}
	if (def.type === "weapon" || def.type === "tool") {
		var result = [];
		var wtype = def.wtype || def.type;
		if (class_def.doublehand && class_def.doublehand[wtype]) result.push({ slot: "mainhand", unequip: slots.offhand ? ["offhand"] : [] });
		else if (class_def.mainhand && class_def.mainhand[wtype]) result.push({ slot: "mainhand", unequip: [] });
		var main_def = slots.mainhand && item_definitions[slots.mainhand.name];
		if (class_def.offhand && class_def.offhand[wtype] && !(main_def && class_def.doublehand && class_def.doublehand[main_def.wtype])) result.push({ slot: "offhand", unequip: [] });
		return result;
	}
	if (["helmet", "pants", "chest", "amulet", "shoes", "gloves", "belt", "orb", "cape"].includes(def.type)) return [{ slot: def.type, unequip: [] }];
	return [];
}

function mcp_api_progression_slot_properties(item, slot, character_type, map) {
	var properties = mcp_api_progression_item_properties(item, character_type, map);
	var def = item && mcp_api_progression_items()[item.name];
	if (slot === "offhand" && def && def.type === "weapon" && properties.attack) properties.attack = mcp_api_progression_round(properties.attack * 0.7);
	return properties;
}

function mcp_api_progression_add_properties(target, properties, multiplier) {
	multiplier = multiplier === undefined ? 1 : multiplier;
	Object.keys(properties || {}).forEach(function (name) {
		target[name] = mcp_api_progression_round(mcp_api_progression_number(target[name]) + mcp_api_progression_number(properties[name]) * multiplier);
		if (!target[name]) delete target[name];
	});
	return target;
}

function mcp_api_progression_timestamp(value) {
	if (!value) return null;
	try {
		var date = new Date(value);
		return Number.isFinite(date.getTime()) ? date.toISOString() : null;
	} catch (error) {
		return null;
	}
}

function mcp_api_progression_state(character, bot, warnings) {
	warnings = warnings || [];
	var info = character && character.info && typeof character.info === "object" && !Array.isArray(character.info) ? character.info : {};
	var equipment = {};
	Object.keys(info.slots || {}).forEach(function (slot) {
		var item = mcp_api_owned_item(info.slots[slot]);
		if (item) equipment[slot] = item;
	});
	var inventory = [];
	(Array.isArray(info.items) ? info.items : []).forEach(function (raw, index) {
		var item = mcp_api_owned_item(raw);
		if (item) inventory.push({ source: "inventory:" + index, item: item });
	});
	var state = {
		source: "last_account_snapshot",
		observed_at: mcp_api_progression_timestamp(character && character.last_sync),
		online: !!(character && character.online),
		map: info.map || null,
		equipment: equipment,
		inventory: inventory,
		warnings: warnings,
	};
	if (character && character.last_sync && !state.observed_at) warnings.push({ code: "saved_snapshot_timestamp_invalid", retryable: false });
	var observation = bot && bot.game_connected && bot.observation && bot.observation.source === "game_server" ? bot.observation : null;
	if (!observation) return state;
	state.source = "mainframe_observation";
	state.observed_at = mcp_api_progression_timestamp(observation.observed_at) || state.observed_at;
	if (observation.observed_at && !mcp_api_progression_timestamp(observation.observed_at)) warnings.push({ code: "mainframe_observation_timestamp_invalid", retryable: false });
	state.online = true;
	state.map = observation.map || state.map;
	state.equipment = {};
	Object.keys(observation.equipment || {}).forEach(function (slot) {
		var item = mcp_api_owned_item(observation.equipment[slot]);
		if (item) state.equipment[slot] = item;
	});
	state.inventory = [];
	(Array.isArray(observation.inventory) ? observation.inventory : []).forEach(function (raw, index) {
		var item = mcp_api_owned_item(raw);
		if (item) state.inventory.push({ source: "inventory:" + (Number.isFinite(Number(raw.index)) ? Math.trunc(Number(raw.index)) : index), item: item });
	});
	return state;
}

function mcp_api_progression_owned_counts(state, bank) {
	var by_name = Object.create(null);
	var by_signature = Object.create(null);
	function add(item) {
		item = mcp_api_owned_item(item);
		if (!item) return;
		var quantity = item.q || 1;
		by_name[item.name] = Math.min(Number.MAX_SAFE_INTEGER, mcp_api_progression_number(by_name[item.name]) + quantity);
		var signature = mcp_api_progression_item_signature(item);
		by_signature[signature] = Math.min(Number.MAX_SAFE_INTEGER, mcp_api_progression_number(by_signature[signature]) + quantity);
	}
	Object.keys(state.equipment || {}).forEach(function (slot) {
		add(state.equipment[slot]);
	});
	(state.inventory || []).forEach(function (entry) {
		add(entry.item);
	});
	if (bank && !bank.stale && bank.packs) {
		Object.keys(bank.packs).forEach(function (pack) {
			(bank.packs[pack] || []).forEach(add);
		});
	}
	return { by_name: by_name, by_signature: by_signature };
}

function mcp_api_progression_grade(def, item) {
	var level = (item && item.level) || 0;
	var grades = def.grades || [9, 10, 11, 12];
	if (level >= grades[3]) return 4;
	if (level >= grades[2]) return 3;
	if (level >= grades[1]) return 2;
	if (level >= grades[0]) return 1;
	return 0;
}

function mcp_api_progression_probability(def, level, compound) {
	var tables = compound ? (typeof compounds === "object" ? compounds : null) : typeof upgrades === "object" ? upgrades : null;
	var table = tables && tables[def.igrade || 0];
	return table && table[level] !== undefined ? table[level] : null;
}

function mcp_api_progression_next_steps(state, objective, character_type, owned) {
	var class_def = mcp_api_progression_classes()[character_type];
	var target_stat = objective === "survival" ? "vit" : objective === "support" ? "int" : (class_def && class_def.main_stat) || "vit";
	var stat_scrolls = [];
	var upgrades_result = [];
	var compounds_result = [];
	Object.keys(state.equipment || {}).forEach(function (slot) {
		var item = state.equipment[slot];
		var def = item && mcp_api_progression_items()[item.name];
		if (!def || item.locked) return;
		var current_properties = mcp_api_progression_slot_properties(item, slot, character_type, state.map);
		if (def.stat && item.stat_type !== target_stat) {
			var stat_item = Object.assign({}, item, { stat_type: target_stat });
			var stat_properties = mcp_api_progression_slot_properties(stat_item, slot, character_type, state.map);
			var stat_delta = mcp_api_progression_delta(current_properties, stat_properties);
			var stat_score = mcp_api_progression_score(stat_delta, objective, character_type);
			if (stat_score > 0) {
				var grade = Math.max(0, Math.min(6, mcp_api_progression_grade(def, item)));
				var quantities = [1, 10, 100, 1000, 9999, 9999, 9999];
				var scroll = target_stat + "scroll";
				stat_scrolls.push({
					action: item.stat_type ? "replace_stat" : "apply_stat",
					slot: slot,
					item: item,
					stat: target_stat,
					scroll: scroll,
					quantity: quantities[grade],
					owned: owned.by_name[scroll] || 0,
					ready: (owned.by_name[scroll] || 0) >= quantities[grade],
					approximate_score_delta: stat_score,
					property_delta: stat_delta,
					risk: "rare_destructive_failure_and_consumes_stat_scrolls",
				});
			}
		}
		var next_level = (item.level || 0) + 1;
		if (def.upgrade) {
			var chance = mcp_api_progression_probability(def, next_level, false);
			if (chance !== null) {
				var upgraded = Object.assign({}, item, { level: next_level });
				var upgrade_delta = mcp_api_progression_delta(current_properties, mcp_api_progression_slot_properties(upgraded, slot, character_type, state.map));
				var upgrade_score = mcp_api_progression_score(upgrade_delta, objective, character_type);
				if (upgrade_score > 0) {
					var scroll = "scroll" + Math.max(0, Math.min(2, mcp_api_progression_grade(def, item)));
					upgrades_result.push({
						action: "upgrade",
						slot: slot,
						item: item,
						to_level: next_level,
						scroll: scroll,
						owned: owned.by_name[scroll] || 0,
						ready: (owned.by_name[scroll] || 0) >= 1,
						base_chance: chance,
						approximate_score_delta: upgrade_score,
						property_delta: upgrade_delta,
						risk: "destructive_on_failure",
					});
				}
			}
		} else if (def.compound) {
			var chance = mcp_api_progression_probability(def, next_level, true);
			if (chance !== null) {
				var compounded = Object.assign({}, item, { level: next_level });
				var compound_delta = mcp_api_progression_delta(current_properties, mcp_api_progression_slot_properties(compounded, slot, character_type, state.map));
				var compound_score = mcp_api_progression_score(compound_delta, objective, character_type);
				var signature = mcp_api_progression_item_signature(item);
				if (compound_score > 0)
					compounds_result.push({
						action: "compound",
						slot: slot,
						item: item,
						to_level: next_level,
						copies_required: 3,
						copies_owned: owned.by_signature[signature] || 0,
						ready: (owned.by_signature[signature] || 0) >= 3,
						base_chance: chance,
						approximate_score_delta: compound_score,
						property_delta: compound_delta,
						risk: "consumes_three_equal_level_items_and_can_fail",
					});
			}
		}
	});
	function sort(left, right) {
		return right.approximate_score_delta - left.approximate_score_delta;
	}
	return { stat_scrolls: stat_scrolls.sort(sort), upgrades: upgrades_result.sort(sort), compounds: compounds_result.sort(sort) };
}

function mcp_api_progression_objectives(character_type, focus) {
	var class_def = mcp_api_progression_classes()[character_type] || {};
	return [
		{
			id: "understand_the_character",
			objective: "Understand the character's class, role, current build, CODE, resources, and player goals well enough to make your own sound decisions.",
		},
		{
			id: "build_durable_power",
			objective: "Continually build durable character power through coherent equipment, useful item levels, and suitable stats rather than treating the current build as finished.",
			class_context: { primary_stat: class_def.main_stat || null, secondary_stat: class_def.side_stat || null, current_focus: focus },
		},
		{
			id: "develop_items",
			objective: "Keep valuable equipment progressing through acquisition, upgrading, compounding, stat scrolls, crafting, or replacement when the benefit fits the cost and risk.",
		},
		{
			id: "support_future_growth",
			objective: "Improve farming, combat, economy, and CODE so the character can earn the gold, scrolls, copies, and materials needed for future growth.",
		},
		{
			id: "learn_and_adapt",
			objective: "Use exact game definitions and observed outcomes to develop and revise strategy. Treat MCP information as evidence, not orders.",
		},
	];
}

async function mcp_api_plan_character_progression(args) {
	var stage = "character_lookup";
	try {
		var character = await admin_bots_owned_character(args.user, args.character);
		if (!character) return { failed: true, reason: "character_not_found" };
		var character_type = mcp_api_progression_character_type(character);
		var supported_classes = mcp_api_progression_supported_classes();
		if (!character_type || !mcp_api_progression_classes()[character_type])
			return {
				failed: true,
				reason: "unsupported_character_class",
				retryable: false,
				requested_class: character_type || null,
				supported_classes: supported_classes,
			};
		var snapshot_warnings = [];
		var bot = null;
		stage = "mainframe_observation";
		try {
			bot = await admin_bots_find(get_id(character));
			if (!bot && character.info && character.info.name) bot = await admin_bots_find(character.info.name);
		} catch (observation_error) {
			snapshot_warnings.push({ code: "mainframe_observation_unavailable", retryable: true });
		}
		stage = "character_snapshot";
		var state = mcp_api_progression_state(character, bot, snapshot_warnings);
		stage = "bank_read";
		var bank = await mcp_api_get_bank(args);
		var bank_candidates = mcp_api_bank_equipment_candidates(bank);
		var objective = MCP_PROGRESSION_OBJECTIVES.includes(args.objective) ? args.objective : "balanced_farming";
		stage = "context_build";
		var snapshot = {
			character: get_id(character),
			objective: objective,
			source: state.source,
			observed_at: state.observed_at,
			equipment: state.equipment,
			inventory: state.inventory,
			bank_observed_at: bank.observed_at,
		};
		var result = {
			success: true,
			source: "mcp_progression_context",
			observed_at: state.observed_at,
			snapshot_id: crypto.createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex").slice(0, 32),
			character: (character.info && character.info.name) || character.name,
			character_id: get_id(character),
			class: character_type,
			level: Number(character.level) || 0,
			objective: objective,
			current: {
				source: state.source,
				online: state.online,
				map: state.map,
				equipment: state.equipment,
				inventory_item_count: state.inventory.length,
				warnings: state.warnings,
			},
			objectives: mcp_api_progression_objectives(character_type, objective),
			game_model: {
				items: "Owned equipment is distinct from item definitions. Equipment can gain power through levels, stats, special properties, complete-build interactions, and replacement.",
				upgrading: "Upgradeable items consume scrolls and can fail. Higher levels can change both power and practical risk.",
				compounding: "Compoundable accessories require three matching same-level copies per attempt and can fail, so copy supply and consumed value matter.",
				stat_scrolls: "Compatible equipment can receive a chosen stat. The useful stat depends on class, purpose, and complete build.",
				progression: "Stronger CODE, farming, encounters, crafting, trade, and item development reinforce one another. There is no single universal best build.",
			},
			starting_points: {
				samaritan: "adventureland://code/starters/samaritan",
				samaritan_merchant: "adventureland://code/starters/samaritan-merchant",
				note: "Samaritan is an optional advanced CODE baseline. Read and adapt it when useful; it is not a required workflow or finished solution.",
			},
			evidence: {
				character: "adventureland://mainframe/characters/" + encodeURIComponent((character.info && character.info.name) || character.name || args.character),
				bank: "adventureland://account/bank",
				game_data: "adventureland://catalog/game-data",
				documentation: "adventureland://catalog/docs",
			},
			bank: {
				source: bank.source,
				observed_at: bank.observed_at,
				stale: !!bank.stale,
				candidate_count: bank_candidates.length,
			},
			policy: {
				read_only: true,
				prescribes_actions: false,
				irreversible_actions_require_player_request: true,
			},
			note: "This resource explains the progression objective and supplies context. It does not rank owned items, reserve inventory sources, choose actions, or replace the AI's judgment.",
		};
		if (bank.stale) {
			result.bank.warning = bank.warning;
		}
		if (
			state.warnings.some(function (warning) {
				return warning.code === "mainframe_observation_unavailable";
			})
		)
			result.current.warning = "The current Mainframe observation could not be read, so this context uses the latest owned account snapshot.";
		return result;
	} catch (error) {
		console.error("mcp progression " + stage + " error", error);
		return {
			failed: true,
			reason: "progression_failed",
			stage: stage,
			retryable: true,
			action: "Retry the progression request. If it fails again, report the stage.",
		};
	}
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
		var access = await mainframe_get_access(characters[i]);
		var assignment = await mainframe_get_assignment(characters[i]);
		result.push({
			character: character_name,
			character_id: get_id(characters[i]),
			level: Number(characters[i].level) || 0,
			class: characters[i].type || null,
			profile: mcp_api_character_profile(characters[i], false),
			access: mcp_api_mainframe_access(access, assignment),
			assignment: assignment,
			available: snapshot.online,
			runtime: mcp_api_mainframe_runtime(runtimes_by_id[get_id(characters[i])] || runtimes_by_name[character_name]),
		});
	}
	var response = {
		success: true,
		online: snapshot.online,
		updated_at: snapshot.updated_at,
		shells: gf(args.user, "cash", 0),
		contract: mcp_api_mainframe_contract(),
		characters: result,
	};
	var free_time = await mainframe_get_steam_time(args.user);
	if (free_time) response.free_time = free_time;
	return response;
}

async function mcp_api_get_mainframe_character(args) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var bot = await admin_bots_find(get_id(character));
	var access = await mainframe_get_access(character);
	var assignment = await mainframe_get_assignment(character);
	var response = {
		success: true,
		contract: mcp_api_mainframe_contract(),
		shells: gf(args.user, "cash", 0),
		character: (character.info && character.info.name) || character.name,
		character_id: get_id(character),
		profile: mcp_api_character_profile(character, true),
		access: mcp_api_mainframe_access(access, assignment),
		assignment: assignment,
		available: (await admin_bots_snapshot()).online,
		runtime: mcp_api_mainframe_runtime(bot),
	};
	var free_time = await mainframe_get_steam_time(args.user);
	if (free_time) response.free_time = free_time;
	return response;
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
	var limit = Math.max(1, Math.min(Number(args.limit) || 100, 100));
	var persisted = await admin_bots_persisted_logs(get_id(character), limit);
	var logs = persisted.slice();
	var seen = new Set(
		logs.map(function (entry) {
			return JSON.stringify([entry.assignment_id || null, entry.at, entry.level, entry.values]);
		}),
	);
	for (var entry of (bot && bot.logs) || []) {
		var value = Object.assign({ assignment_id: bot.assignment_id || null }, entry);
		var key = JSON.stringify([value.assignment_id, value.at, value.level, value.values]);
		if (!seen.has(key)) {
			seen.add(key);
			logs.push(value);
		}
	}
	return {
		success: true,
		active: !!(bot && bot.desired_state === "running" && bot.phase !== "stopped"),
		retention_days: MCP_MAINFRAME_LOG_RETENTION_DAYS,
		logs: logs.slice(-limit),
	};
}

async function mcp_api_get_mainframe_events(args) {
	var character = await admin_bots_owned_character(args.user, args.character);
	if (!character) return { failed: true, reason: "character_not_found" };
	var bot = await admin_bots_find(get_id(character));
	var limit = Math.max(1, Math.min(Number(args.limit) || 100, 100));
	return {
		success: true,
		active: !!(bot && bot.desired_state === "running" && bot.phase !== "stopped"),
		retention_days: MCP_MAINFRAME_LOG_RETENTION_DAYS,
		events: await mainframe_read_events(get_id(args.user), get_id(character), limit),
	};
}

async function mcp_api_get_mainframe_dashboard(args) {
	var state = await mcp_api_list_mainframe_characters(args);
	if (state.failed) return state;
	var code_result = await mcp_api_list_codes(args);
	var server_result = await mcp_api_get_servers(args);
	state.codes = code_result.codes || [];
	state.servers = (server_result.servers || []).map(function (server) {
		return {
			server: server.region + " " + server.name,
			region: server.region,
			name: server.name,
			players: server.players,
			online: server.online,
			pvp: server.pvp,
		};
	});
	return state;
}

async function mcp_api_get_api_info(args) {
	return {
		success: true,
		name: MCP_SERVER_INFO.name,
		version: MCP_SERVER_INFO.version,
		game_version: Version,
		interfaces: {
			json: { url: "https://adventure.land/mcp_api/{method}", method: "POST", authentication: "token in the JSON body" },
			mcp: {
				url: "https://adventure.land/mcp",
				transport: "Streamable HTTP",
				authentication: "HTTP Authorization: Bearer TOKEN",
				start_resource: MCP_START_RESOURCE,
				catalog_resources: MCP_CATALOG_RESOURCES,
				capabilities: ["tools", "resources", "resource_templates", "prompts"],
			},
			session: { url: "https://adventure.land/mainframe", authentication: "signed-in Adventure Land session" },
		},
		onboarding: {
			steps: [
				"Sign in to Adventure Land and open https://adventure.land/mainframe.",
				"Open Connect an AI and create an account token. Mainframe keeps it masked until Reveal token is pressed.",
				"Add a Streamable HTTP MCP server in the AI client with URL https://adventure.land/mcp and Authorization: Bearer TOKEN.",
				"Ask the AI to read adventureland://guide/start-here, adventureland://guide/code-runtime, adventureland://guide/code-architecture, and adventureland://reference/code-globals, then inspect mainframe_get_dashboard and the exact CODE methods and game definitions needed for the task.",
			],
			token_security: "One active token per account. It is encrypted at rest and returned only to the signed-in account. Rotation invalidates the previous token immediately.",
			source_repository: MCP_SOURCE_REPOSITORY,
		},
		rate_limits: {
			standard: { rate_per_minute: 120, burst: 30 },
			bulk_game_data: { rate_per_minute: 12, burst: 4 },
			bank_reads: { rate_per_minute: 12, burst: 4, shared_with: "bulk_game_data" },
			progression: { rate_per_minute: 6, burst: 2 },
			writes: { rate_per_minute: 30, burst: 10 },
		},
		docs: {
			overview: "https://adventure.land/docs/guide/mainframe",
			json_api: "https://adventure.land/docs/guide/advanced/adventure-api",
			mcp: "https://adventure.land/docs/guide/adventure-mcp",
		},
		methods: Object.keys(MCP_API_REF)
			.sort()
			.map(function (name) {
				return { name: name, description: (MCP_TOOL_META[name] && MCP_TOOL_META[name].description) || name, input_schema: mcp_tool_schema(MCP_API_REF[name]) };
			}),
	};
}

var MCP_API_REF = {
	get_api_info: { F: mcp_api_get_api_info },
	get_servers: { F: mcp_api_get_servers },
	get_game_data: {
		F: mcp_api_get_game_data,
		section: { type: "string", optional: true },
		name: { type: "string", optional: true },
	},
	search_game_data: {
		F: mcp_api_search_game_data,
		query: { type: "string" },
		section: { type: "enum", values: MCP_API_SEARCH_SECTIONS, optional: true },
		limit: { type: "number", optional: true },
	},
	list_docs: {
		F: mcp_api_list_docs,
		query: { type: "string", optional: true },
	},
	get_doc: {
		F: mcp_api_get_doc,
		name: { type: "identifier" },
	},
	list_code_methods: {
		F: mcp_api_list_code_methods,
		query: { type: "string", optional: true },
		limit: { type: "number", optional: true },
	},
	get_code_method: {
		F: mcp_api_get_code_method,
		name: { type: "identifier" },
	},
	list_codes: { F: mcp_api_list_codes },
	get_code: {
		F: mcp_api_get_code,
		slot: { type: "identifier" },
	},
	get_libraries: { F: mcp_api_get_libraries },
	get_bank: { F: mcp_api_get_bank },
	plan_character_progression: {
		F: mcp_api_plan_character_progression,
		character: { type: "identifier" },
		objective: { type: "enum", values: MCP_PROGRESSION_OBJECTIVES, optional: true },
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
	browser_code_status: {
		F: mcp_api_browser_code_status,
		character: { type: "identifier" },
	},
	browser_code_start: {
		F: mcp_api_browser_code_start,
		character: { type: "identifier" },
		slot: { type: "identifier" },
	},
	browser_code_stop: {
		F: mcp_api_browser_code_stop,
		character: { type: "identifier" },
	},
	browser_code_reload: {
		F: mcp_api_browser_code_reload,
		character: { type: "identifier" },
		slot: { type: "identifier" },
	},
	browser_code_eval: {
		F: mcp_api_browser_code_eval,
		character: { type: "identifier" },
		code: { type: "string" },
	},
	mainframe_code_eval: {
		F: mcp_api_mainframe_code_eval,
		character: { type: "identifier" },
		code: { type: "string" },
	},
	mainframe_list_characters: { F: mcp_api_list_mainframe_characters },
	mainframe_get_dashboard: { F: mcp_api_get_mainframe_dashboard },
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
	mainframe_get_events: {
		F: mcp_api_get_mainframe_events,
		character: { type: "identifier" },
		limit: { type: "number", optional: true },
	},
};

var MCP_TOOL_META = {
	get_api_info: { description: "Discover the shared JSON API and MCP methods, schemas, endpoints, and documentation links.", readOnlyHint: true },
	get_servers: { description: "List the live Adventure Land game servers.", readOnlyHint: true },
	get_game_data: {
		description: "Read deployed Adventure Land game definitions by section and optional exact record name. Use search_game_data first; full sections have a lower rate limit.",
		readOnlyHint: true,
	},
	search_game_data: {
		description:
			"Search exact keys, names, descriptions, stats, recipe ingredients, drop tables, map fields, and other nested deployed game data. Use get_game_data for each complete matching record.",
		readOnlyHint: true,
	},
	list_docs: { description: "List or search Adventure Land guide articles.", readOnlyHint: true },
	get_doc: { description: "Read one Adventure Land guide article as plain text using an exact name returned by list_docs.", readOnlyHint: true },
	list_code_methods: {
		description: "List the public CODE directory or search method documentation semantically when no method name matches. Follow with get_code_method before using a routine.",
		readOnlyHint: true,
	},
	get_code_method: { description: "Read one public character CODE method's exact contract, examples, failure behavior, and shipped source location.", readOnlyHint: true },
	list_codes: { description: "List the account's CODE slots without returning their source.", readOnlyHint: true },
	get_code: { description: "Read one owned CODE slot.", readOnlyHint: true },
	get_libraries: { description: "Read the standard local CODE helper files used by the old client sync folder.", readOnlyHint: true },
	get_bank: {
		description: "Read all account-owned bank packs and gold from the saved account snapshot. A mounted bank is marked stale and excluded from progression comparisons.",
		readOnlyHint: true,
	},
	plan_character_progression: {
		description:
			"Read the character's progression context, enduring objectives, game model, evidence sources, and optional Samaritan starting point. It supplies information without ranking items or prescribing actions.",
		readOnlyHint: true,
	},
	save_code: { description: "Create or replace one account-owned JavaScript CODE slot. Read an existing slot before replacement; saving does not start a character.", destructiveHint: true },
	delete_code: { description: "Delete one owned CODE slot.", destructiveHint: true },
	browser_code_status: {
		description: "Check whether an account-owned character is connected in an open browser and whether browser CODE is running. It refuses characters assigned to Mainframe.",
		readOnlyHint: true,
	},
	browser_code_start: {
		description:
			"Start a saved CODE slot on an account-owned character that is already connected in an open browser. If browser CODE is already running, it is left unchanged. A successful result means the request was queued, not that execution was confirmed.",
		destructiveHint: true,
		idempotentHint: true,
	},
	browser_code_stop: {
		description:
			"Stop CODE on an account-owned character that is already connected in an open browser. A successful result means the request was queued, not that the browser confirmed completion.",
		idempotentHint: true,
	},
	browser_code_reload: {
		description:
			"Load and run a saved CODE slot on an account-owned character that is already connected in an open browser, replacing its current browser CODE runner. A successful result means the request was queued, not that execution was confirmed.",
		destructiveHint: true,
	},
	browser_code_eval: {
		description:
			"Evaluate up to 64 KiB of arbitrary JavaScript in an account-owned character's browser CODE context through the authenticated /comm relay. The browser must already be open and connected. If CODE is stopped, the browser starts a temporary snippet runner. A successful result means the snippet was queued, not that it completed or succeeded.",
		destructiveHint: true,
	},
	mainframe_code_eval: {
		description:
			"Evaluate up to 64 KiB of arbitrary JavaScript in an account-owned character's running Mainframe CODE context through the authenticated /comm relay. The character must have a live Mainframe assignment. A successful result means the snippet was queued, not that it completed or succeeded.",
		destructiveHint: true,
	},
	mainframe_list_characters: { description: "List owned characters and their Mainframe access and runtime state.", readOnlyHint: true },
	mainframe_get_dashboard: {
		description:
			"Read this before Mainframe changes. Returns owned characters, Shell balance, any remaining shared Steam hours, prepaid access, assignments, authenticated runtime observations, CODE slots, live servers, and the renewal schedule. Direct links use separate machines and charges. CODE can include up to three additional characters with its caller, for four Workers in one shared microVM. One Shell or free Steam hour buys 60, 50, 45, or 40 minutes when 1, 2, 3, or 4 characters are active at renewal.",
		readOnlyHint: true,
	},
	mainframe_get_character: {
		description:
			"Read one owned character's saved class, level, position, equipment, inventory, conditions, quests, Mainframe access, assignment, runtime, authenticated party roster, current equipment summary, inventory summary, and shop listings. Saved profile fields can lag the running game; prefer current runtime observations for live state.",
		readOnlyHint: true,
	},
	mainframe_link_character: {
		description:
			"Run an owned character on a dedicated Mainframe microVM using a saved CODE slot. It prepays 60 minutes, using remaining shared Steam hours before charging one Shell, and renews automatically while running. Each direct link consumes time separately. CODE start_character can instead add up to three included workers to the caller's shared microVM. At renewal, one Shell or free Steam hour buys 60, 50, 45, or 40 minutes for 1, 2, 3, or 4 active characters; the count is sampled only at that boundary. The assignment survives service, controller, host, and microVM restarts and stops only on explicit disconnect or insufficient funds. Keep one request_id stable when retrying the same lost request.",
		destructiveHint: false,
		idempotentHint: true,
	},
	mainframe_disconnect_character: {
		description: "Explicitly stop one owned Mainframe character and disable future automatic renewals. Remaining paid time is not refunded and can be reused by starting again before it expires.",
		destructiveHint: false,
	},
	mainframe_get_logs: { description: "Read up to 100 recent Mainframe CODE logs for one owned character. Logs remain available for 30 days after its worker or microVM stops.", readOnlyHint: true },
	mainframe_get_events: {
		description:
			"Read up to 100 account-owned Mainframe lifecycle events for one character, including starts, recovery, unexpected Worker restarts, renewal, server changes, and stops. Events remain available for 30 days.",
		readOnlyHint: true,
	},
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

var MCP_RESOURCE_GUIDES = [
	{
		uri: MCP_START_RESOURCE,
		name: "start-here",
		title: "Start here: Adventure Land MCP for AI",
		description: "The required first read: game architecture, CODE workflow, Mainframe operation, source repository, and safety rules.",
		article: "adventure-mcp",
		priority: 1,
	},
	{
		uri: "adventureland://guide/code-runtime",
		name: "code-runtime",
		title: "Character CODE runtime",
		description: "Promises, events, persistence, compatibility, public actions, and runtime behavior.",
		article: "code-api",
		priority: 0.95,
	},
	{
		uri: "adventureland://guide/code-architecture",
		name: "code-architecture",
		title: "Game and CODE architecture",
		description: "How the game frame, CODE frame, socket, account API, events, and multiple characters fit together.",
		article: "X.sub-architecture",
		priority: 0.9,
	},
	{
		uri: "adventureland://guide/navigation",
		name: "navigation",
		title: "Movement and navigation",
		description: "Direct movement, smart_move destinations, interruption, arrival, and route failures.",
		article: "5-goingplaces",
		priority: 0.85,
	},
	{
		uri: "adventureland://guide/items-and-inventory",
		name: "items-and-inventory",
		title: "Items and inventory",
		description: "Definitions versus owned item instances, inventory indexes, equipment, and mutation safety.",
		article: "6-items101",
		priority: 0.85,
	},
	{
		uri: "adventureland://guide/skills",
		name: "skills",
		title: "Using class skills",
		description: "Skill keys, targets, cooldowns, range checks, multi-target calls, and timed actions.",
		article: "7-using-skills",
		priority: 0.85,
	},
	{
		uri: "adventureland://guide/code-messages",
		name: "code-messages",
		title: "Trusted character coordination",
		description: "CODE message delivery, same-server requirements, payloads, sender checks, and retry behavior.",
		article: "X.sub-cm",
		priority: 0.8,
	},
	{
		uri: "adventureland://guide/multiple-characters",
		name: "multiple-characters",
		title: "Running multiple characters",
		description: "Browser, COM, Mainframe, child-character, and coordination options without loading a character twice.",
		article: "multi",
		priority: 0.8,
	},
	{
		uri: "adventureland://guide/server-rules",
		name: "server-rules",
		title: "Servers, limits, and player rules",
		description: "Shared character state, simultaneous-character limits, request limits, accounts, and community rules.",
		article: "limits",
		priority: 0.75,
	},
	{
		uri: "adventureland://reference/code-globals",
		name: "code-globals",
		title: "CODE globals",
		description: "The live character, G, server, game, smart, safeties, parent, and nearby runtime collections.",
		article: "code-globals",
		priority: 0.9,
	},
	{
		uri: "adventureland://reference/character",
		name: "character-object",
		title: "Character object reference",
		description: "Live character fields, inventory, equipment, stats, movement, conditions, and state.",
		article: "data-character",
		priority: 0.85,
	},
	{
		uri: "adventureland://reference/monster",
		name: "monster-object",
		title: "Monster object reference",
		description: "Visible monster fields, targeting, movement, damage, and entity lifetime.",
		article: "data-monster",
		priority: 0.8,
	},
	{
		uri: "adventureland://reference/character-events",
		name: "character-events",
		title: "Character events",
		description: "Events delivered to the controlled character and their payloads.",
		article: "events-character",
		priority: 0.8,
	},
	{
		uri: "adventureland://reference/game-events",
		name: "game-events",
		title: "Game events",
		description: "World and server events visible to character CODE.",
		article: "events-game",
		priority: 0.8,
	},
	{
		uri: "adventureland://guide/mainframe",
		name: "mainframe",
		title: "Mainframe character hosting",
		description: "Billing, assignment lifecycle, containment, compatibility, and runtime evidence.",
		article: "mainframe",
		priority: 0.95,
	},
];

function mcp_resource_annotations(priority) {
	return { audience: ["assistant"], priority: priority };
}

function mcp_resources() {
	var resources = MCP_RESOURCE_GUIDES.map(function (entry) {
		return {
			uri: entry.uri,
			name: entry.name,
			title: entry.title,
			description: entry.description,
			mimeType: "text/plain",
			annotations: mcp_resource_annotations(entry.priority),
		};
	});
	resources.push(
		{
			uri: "adventureland://catalog/docs",
			name: "documentation-catalog",
			title: "Documentation catalog",
			description: "Searchable names, titles, sections, keywords, and public links for every Adventure Land guide article.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(0.95),
		},
		{
			uri: "adventureland://catalog/code-methods",
			name: "code-method-catalog",
			title: "Character CODE method catalog",
			description: "Every public character CODE method, signature, and exact documentation link.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(0.95),
		},
		{
			uri: "adventureland://catalog/game-data",
			name: "game-data-catalog",
			title: "Game-data catalog",
			description: "Every deployed game-data section, its purpose, record count, and whether semantic search covers it.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(0.95),
		},
		{
			uri: "adventureland://code/starters/samaritan",
			name: "samaritan-starter-code",
			title: "Samaritan adventurer CODE",
			description: "Advanced class-aware starter CODE for farming, combat, support, trusted parties, banking, and opt-in item improvement without programmatic Chat.",
			mimeType: "text/javascript",
			annotations: mcp_resource_annotations(0.95),
		},
		{
			uri: "adventureland://code/starters/samaritan-merchant",
			name: "samaritan-merchant-starter-code",
			title: "Samaritan Merchant CODE",
			description: "Conservative merchant starter CODE for helping players, explicit public listings, banking, and tightly bounded opt-in upgrade, compound, and sale policies.",
			mimeType: "text/javascript",
			annotations: mcp_resource_annotations(0.95),
		},
		{
			uri: "adventureland://source/runner-functions",
			name: "runner-functions-source",
			title: "Shipped character runner functions",
			description: "The actual public JavaScript implementation loaded into character CODE, from the open-source repository.",
			mimeType: "text/javascript",
			annotations: mcp_resource_annotations(0.85),
		},
		{
			uri: "adventureland://account/dashboard",
			name: "account-mainframe-dashboard",
			title: "Owned characters and Mainframe state",
			description: "Authenticated account state: characters, saved CODE slots, live servers, access windows, assignments, and observations.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(1),
		},
		{
			uri: "adventureland://account/code-slots",
			name: "account-code-slots",
			title: "Saved CODE slots",
			description: "Authenticated list of account-owned CODE slots without source text.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(0.9),
		},
		{
			uri: "adventureland://account/bank",
			name: "account-bank",
			title: "Owned bank items and gold",
			description: "Authenticated saved account bank. A mounted snapshot is marked stale and excluded from progression comparisons.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(0.95),
		},
		{
			uri: "adventureland://game/servers",
			name: "live-servers",
			title: "Live Adventure Land servers",
			description: "Current realms, populations, modes, PVP state, and availability.",
			mimeType: "application/json",
			annotations: mcp_resource_annotations(0.75),
		},
	);
	return resources;
}

function mcp_resource_templates() {
	return [
		{
			uriTemplate: "adventureland://docs/{name}",
			name: "guide-article",
			title: "Adventure Land guide article",
			description: "Read an exact article name returned by list_docs.",
			mimeType: "text/plain",
		},
		{
			uriTemplate: "adventureland://code/functions/{name}",
			name: "code-function",
			title: "Character CODE function reference",
			description: "Read an exact public function returned by list_code_methods, including its source location.",
			mimeType: "application/json",
		},
		{
			uriTemplate: "adventureland://game-data/{section}",
			name: "game-data-section",
			title: "Complete game-data section",
			description: "Read one complete section returned by the game-data catalog. Full sections use the lower bulk-read rate limit.",
			mimeType: "application/json",
		},
		{
			uriTemplate: "adventureland://game-data/{section}/{name}",
			name: "game-definition",
			title: "Exact game-data definition",
			description: "Read one exact record found with search_game_data.",
			mimeType: "application/json",
		},
		{
			uriTemplate: "adventureland://code/slots/{slot}",
			name: "owned-code-slot",
			title: "Owned CODE slot",
			description: "Read one account-owned CODE slot and its source.",
			mimeType: "application/json",
		},
		{
			uriTemplate: "adventureland://mainframe/characters/{character}",
			name: "owned-mainframe-character",
			title: "Owned Mainframe character",
			description: "Read one owned character's paid access, assignment, runtime, containment, and observed game state.",
			mimeType: "application/json",
		},
		{
			uriTemplate: "adventureland://progression/characters/{character}",
			name: "owned-character-progression",
			title: "Character progression context",
			description: "Read one owned character's progression objectives, current context, game model, evidence sources, and optional CODE starting point without prescribed actions.",
			mimeType: "application/json",
		},
	];
}

function mcp_resource_content(uri, mime_type, value) {
	return { uri: uri, mimeType: mime_type, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) };
}

function mcp_resource_failure_content(uri, failure) {
	var code = failure && typeof failure.reason === "string" ? failure.reason : "resource_unavailable";
	var messages = {
		character_not_found: "The requested owned character was not found.",
		character_not_live: "The requested character is not reachable on its game server.",
		unsupported_character_class: "The requested character class is not supported by the progression planner.",
		progression_unavailable: "The progression inputs were unavailable.",
		progression_failed: "The progression analysis could not be generated.",
	};
	var details = { uri: uri };
	Object.keys(failure || {}).forEach(function (name) {
		if (name !== "failed" && name !== "reason") details[name] = failure[name];
	});
	return mcp_resource_content(uri, "application/json", {
		failed: true,
		error: {
			code: code,
			message: messages[code] || "The requested resource is unavailable.",
			details: details,
		},
	});
}

function mcp_resource_path_parts(url) {
	return url.pathname
		.split("/")
		.filter(Boolean)
		.map(function (part) {
			return decodeURIComponent(part);
		});
}

async function mcp_read_resource(uri, user) {
	var guide = MCP_RESOURCE_GUIDES.find(function (entry) {
		return entry.uri === uri;
	});
	if (guide) {
		var article = await mcp_api_get_doc({ name: guide.article });
		if (article.failed) return null;
		return mcp_resource_content(uri, "text/plain", article.content);
	}
	if (uri === "adventureland://source/runner-functions") {
		var source = fs.readFileSync(path.resolve(__dirname, "js/runner_functions.js"), "utf8");
		return mcp_resource_content(uri, "text/javascript", source);
	}
	if (uri === "adventureland://code/starters/samaritan") {
		var source = fs.readFileSync(path.resolve(__dirname, "docs/examples/samaritan.js"), "utf8");
		return mcp_resource_content(uri, "text/javascript", source);
	}
	if (uri === "adventureland://code/starters/samaritan-merchant") {
		var source = fs.readFileSync(path.resolve(__dirname, "docs/examples/samaritan_merchant.js"), "utf8");
		return mcp_resource_content(uri, "text/javascript", source);
	}
	if (uri === "adventureland://account/dashboard") return mcp_resource_content(uri, "application/json", await mcp_api_get_mainframe_dashboard({ user: user }));
	if (uri === "adventureland://account/code-slots") return mcp_resource_content(uri, "application/json", await mcp_api_list_codes({ user: user }));
	if (uri === "adventureland://account/bank") return mcp_resource_content(uri, "application/json", await mcp_api_get_bank({ user: user }));
	if (uri === "adventureland://game/servers") return mcp_resource_content(uri, "application/json", await mcp_api_get_servers({ user: user }));
	if (uri === "adventureland://catalog/docs") return mcp_resource_content(uri, "application/json", await mcp_api_list_docs({}));
	if (uri === "adventureland://catalog/code-methods") return mcp_resource_content(uri, "application/json", await mcp_api_list_code_methods({}));
	if (uri === "adventureland://catalog/game-data") return mcp_resource_content(uri, "application/json", await mcp_api_get_game_data({}));

	var url;
	try {
		url = new URL(uri);
	} catch (e) {
		return null;
	}
	if (url.protocol !== "adventureland:" || url.username || url.password || url.port || url.search || url.hash) return null;
	var parts;
	try {
		parts = mcp_resource_path_parts(url);
	} catch (e) {
		return null;
	}
	var result;
	if (url.hostname === "docs" && parts.length === 1) result = await mcp_api_get_doc({ name: parts[0] });
	else if (url.hostname === "code" && parts[0] === "functions" && parts.length === 2) result = await mcp_api_get_code_method({ name: parts[1] });
	else if (url.hostname === "game-data" && parts.length === 1) result = await mcp_api_get_game_data({ section: parts[0] });
	else if (url.hostname === "game-data" && parts.length === 2) result = await mcp_api_get_game_data({ section: parts[0], name: parts[1] });
	else if (url.hostname === "code" && parts[0] === "slots" && parts.length === 2) result = await mcp_api_get_code({ user: user, slot: parts[1] });
	else if (url.hostname === "mainframe" && parts[0] === "characters" && parts.length === 2) result = await mcp_api_get_mainframe_character({ user: user, character: parts[1] });
	else if (url.hostname === "progression" && parts[0] === "characters" && parts.length === 2)
		result = await mcp_api_plan_character_progression({ user: user, character: parts[1], objective: "balanced_farming" });
	else return null;
	if (!result) return null;
	if (result.failed) return mcp_resource_failure_content(uri, result);
	return mcp_resource_content(uri, url.hostname === "docs" ? "text/plain" : "application/json", url.hostname === "docs" ? result.content : result);
}

var MCP_PROMPTS = [
	{
		name: "learn_adventure_land",
		title: "Learn Adventure Land",
		description: "Load the game, CODE, source, and Mainframe mental model before helping a player.",
		arguments: [],
	},
	{
		name: "research_gameplay",
		title: "Research Adventure Land gameplay",
		description: "Answer a game, build, progression, economy, or content question from exact deployed definitions and documentation.",
		arguments: [{ name: "question", description: "The gameplay question to investigate.", required: true }],
	},
	{
		name: "improve_character",
		title: "Improve a character",
		description: "Help an owned character become steadily stronger using game knowledge, account state, observed results, and independent judgment.",
		arguments: [
			{ name: "character", description: "Owned character name.", required: true },
			{ name: "objective", description: "Optional: balanced_farming, damage, survival, support, gold, luck, or xp.", required: false },
		],
	},
	{
		name: "configure_samaritan_code",
		title: "Configure Samaritan CODE",
		description: "Adapt a safe Samaritan adventurer or merchant baseline to one owned character and player goal.",
		arguments: [
			{ name: "character", description: "Owned character name.", required: true },
			{ name: "variant", description: "Use adventurer or merchant.", required: true },
			{ name: "goal", description: "Optional farming, support, party, or shop goal.", required: false },
			{ name: "code_slot", description: "Optional existing or intended CODE slot.", required: false },
		],
	},
	{
		name: "write_character_code",
		title: "Write character CODE",
		description: "Research and write a character CODE slot for a concrete player goal.",
		arguments: [
			{ name: "goal", description: "What the character should accomplish.", required: true },
			{ name: "character", description: "Optional owned character name.", required: false },
			{ name: "code_slot", description: "Optional existing or intended CODE slot.", required: false },
		],
	},
	{
		name: "review_character_code",
		title: "Review character CODE",
		description: "Inspect one saved slot for correctness, game compatibility, safety, and observable behavior.",
		arguments: [
			{ name: "code_slot", description: "Owned CODE slot number or name.", required: true },
			{ name: "goal", description: "Optional intended behavior to compare against.", required: false },
		],
	},
	{
		name: "coordinate_character_team",
		title: "Coordinate a character team",
		description: "Plan and operate several owned characters on one server without loading a character twice.",
		arguments: [
			{ name: "goal", description: "What the team should accomplish.", required: true },
			{ name: "characters", description: "Optional comma-separated owned character names.", required: false },
		],
	},
	{
		name: "operate_mainframe",
		title: "Operate a Mainframe character",
		description: "Safely deploy, observe, and improve CODE for one owned character.",
		arguments: [
			{ name: "character", description: "Owned character name.", required: true },
			{ name: "goal", description: "The behavior or outcome to operate toward.", required: true },
		],
	},
	{
		name: "debug_mainframe_character",
		title: "Debug a Mainframe character",
		description: "Investigate a stopped, stuck, dead, slow, or otherwise incorrect character using live evidence, CODE logs, and Mainframe events.",
		arguments: [
			{ name: "character", description: "Owned character name.", required: true },
			{ name: "symptom", description: "Optional observed problem.", required: false },
		],
	},
];

function mcp_prompt_list() {
	return MCP_PROMPTS.map(function (prompt) {
		return { name: prompt.name, title: prompt.title, description: prompt.description, arguments: prompt.arguments };
	});
}

async function mcp_prompt_add_resource(messages, uri, user, required) {
	try {
		var resource = await mcp_read_resource(uri, user);
		if (resource) messages.push({ role: "user", content: { type: "resource", resource: resource, annotations: mcp_resource_annotations(1) } });
		else if (required) return false;
	} catch (e) {
		if (required) return false;
	}
	return true;
}

async function mcp_get_prompt(name, prompt_arguments, user) {
	var prompt = MCP_PROMPTS.find(function (candidate) {
		return candidate.name === name;
	});
	if (!prompt) return { error: "Prompt not found" };
	prompt_arguments = prompt_arguments || {};
	if (typeof prompt_arguments !== "object" || Array.isArray(prompt_arguments)) return { error: "Invalid prompt arguments" };
	var allowed = new Set(
		prompt.arguments.map(function (argument) {
			return argument.name;
		}),
	);
	for (var key in prompt_arguments) if (!allowed.has(key) || typeof prompt_arguments[key] !== "string" || prompt_arguments[key].length > 1000) return { error: "Invalid prompt arguments" };
	for (var i = 0; i < prompt.arguments.length; i++)
		if (prompt.arguments[i].required && !prompt_arguments[prompt.arguments[i].name]) return { error: "Missing prompt argument: " + prompt.arguments[i].name };
	if (name === "configure_samaritan_code" && !["adventurer", "merchant"].includes(prompt_arguments.variant.toLowerCase())) return { error: "Invalid prompt argument: variant" };
	if (name === "improve_character" && prompt_arguments.objective && !MCP_PROGRESSION_OBJECTIVES.includes(prompt_arguments.objective)) return { error: "Invalid prompt argument: objective" };
	var start = await mcp_read_resource(MCP_START_RESOURCE, null);
	if (!start) return { error: "Start resource unavailable" };
	var task;
	if (name === "learn_adventure_land") {
		task =
			"Build a working mental model of Adventure Land. Read the three discovery catalogs, then inspect only the relevant guides, exact CODE contracts, deployed definitions, and source paths named in the embedded guide. Distinguish static definitions, saved account snapshots, and live server observations. Do not change account CODE or Mainframe state unless the user separately asks you to.";
	} else if (name === "research_gameplay") {
		task =
			"Question: " +
			prompt_arguments.question +
			"\nUse the documentation, CODE-method, and game-data catalogs to locate exact sources. Read complete records after searching. Separate deployed facts from inference, account state, and live realm state. Do not change account or Mainframe state.";
	} else if (name === "improve_character") {
		task =
			"Help owned character " +
			prompt_arguments.character +
			" become steadily stronger with emphasis on " +
			(prompt_arguments.objective || "balanced_farming") +
			". Learn the class, current build, CODE, account resources, item systems, available content, and player goals. Keep coherent gear, useful item levels, suitable stats, acquisition, economy, farming, combat, and CODE as continuing objectives. Develop your own strategy from exact definitions and observed results; do not treat the progression context as orders. Samaritan is an optional CODE starting point when useful, not a required workflow or finished answer. Explain consequential choices and do not take irreversible item or value-moving actions without the player's request.";
	} else if (name === "configure_samaritan_code") {
		task =
			"Configure the " +
			prompt_arguments.variant +
			" Samaritan baseline for owned character " +
			prompt_arguments.character +
			(prompt_arguments.goal ? " toward this goal: " + prompt_arguments.goal : "") +
			". CODE slot: " +
			(prompt_arguments.code_slot || "choose a free slot; never overwrite an unread slot") +
			". Inspect the character profile, current runtime, existing CODE, class, equipment, inventory, authenticated party roster, shop slots, and exact method contracts. Preserve the no-programmatic-Chat rule. Configure one explicit party leader and trusted roster when coordinating characters. Keep bank, public listings, market purchases, NPC sales, scroll purchases, upgrades, stat scrolls, and compounds disabled unless the player explicitly requested exact items and you can set conservative keep, level, value, quantity, interval, gold-reserve, and session limits. Explain every enabled mutation before saving or linking, then verify the resulting party roster, equipment, item levels, stat types, and trade slots from authenticated observations.";
	} else if (name === "write_character_code") {
		task =
			"Goal: " +
			prompt_arguments.goal +
			"\nCharacter: " +
			(prompt_arguments.character || "choose after reading the dashboard") +
			"\nCODE slot: " +
			(prompt_arguments.code_slot || "choose a free slot; never overwrite an unread slot") +
			"\nInspect the saved profile and current runtime separately, including party and shop state. Research exact methods and game definitions before writing. Read any existing target slot. Produce bounded, non-overlapping async loops; reacquire live entities; handle death, cooldowns, movement, inventory-index changes, and rejected Promises. Do not add irreversible item, gold, trade, mail, or Shell actions unless requested. Save only after explaining what will change, and verify outcomes rather than action counters.";
	} else if (name === "review_character_code") {
		task =
			"Review owned CODE slot " +
			prompt_arguments.code_slot +
			(prompt_arguments.goal ? " for this goal: " + prompt_arguments.goal : "") +
			". Read the slot, exact method references, globals, and relevant game definitions. Check overlapping async work, stale entity references, death recovery, cooldowns, movement, changing inventory indexes, irreversible actions, trusted CODE messages, log quality, and Mainframe headless compatibility. Report concrete changes before saving anything.";
	} else if (name === "coordinate_character_team") {
		task =
			"Team goal: " +
			prompt_arguments.goal +
			"\nCharacters: " +
			(prompt_arguments.characters || "choose owned characters after reading the dashboard") +
			"\nInspect every selected character and CODE slot. Keep the team on one live server, choose one explicit party leader, give every member the same trusted roster, and verify the authenticated party roster after invitations. Assign class roles and use validated CODE messages only when party state is insufficient. Never load a character that is already active elsewhere. Handle partial team availability and disconnections without unsafe retries or duplicate assignments.";
	} else if (name === "operate_mainframe") {
		task =
			"Operate owned character " +
			prompt_arguments.character +
			" toward this goal: " +
			prompt_arguments.goal +
			". Read the dashboard, CODE runtime, architecture, globals, saved character profile, current live state, existing slot, exact function references, and relevant game data first. Never overwrite an unread slot or load a character already active elsewhere. Explain that each direct Mainframe link prepays 60 minutes, uses any free_time reported by the dashboard before Shells, and renews automatically until explicitly disconnected or the account cannot pay. CODE start_character can add up to three included workers. At the next renewal, one Shell or free Steam hour buys 60, 50, 45, or 40 minutes for 1, 2, 3, or 4 active characters; group changes do not reprice current time. Warn that the first child can reconnect the root once, the root controls renewal, and stopping the root stops all included workers. Use one stable request_id for retries. The assignment is durable across service, controller, host, and microVM restarts; do not disconnect it as routine recovery. After linking, verify authenticated observations, disconnect reasons, retained CODE logs, and Mainframe events; do not treat requested-action counters as success.";
	} else {
		task =
			"Debug owned character " +
			prompt_arguments.character +
			(prompt_arguments.symptom ? ". Reported symptom: " + prompt_arguments.symptom : "") +
			". Compare the saved profile, assignment, authenticated live observations, party roster, equipment, inventory summary, shop slots, recent CODE logs, Mainframe events, and current slot. Use Mainframe events to distinguish assignment changes, renewal, recovery, and unexpected Worker restarts from CODE behavior. Identify whether the failure is in planning, event compatibility, CODE requests, game acceptance, movement, targeting, party formation, equipment progression, trade state, inventory state, death recovery, server choice, or containment. Do not rewrite or restart blindly. Make the smallest evidence-backed correction, then verify map, coordinates, activity, target, party, equipment, listings, death state, XP, gold, and both logs over time.";
	}
	var messages = [{ role: "user", content: { type: "resource", resource: start, annotations: mcp_resource_annotations(1) } }];
	if (
		["learn_adventure_land", "configure_samaritan_code", "write_character_code", "review_character_code", "coordinate_character_team", "operate_mainframe", "debug_mainframe_character"].includes(name)
	) {
		await mcp_prompt_add_resource(messages, "adventureland://guide/code-runtime", user, true);
		await mcp_prompt_add_resource(messages, "adventureland://guide/code-architecture", user, true);
		await mcp_prompt_add_resource(messages, "adventureland://reference/code-globals", user, true);
	}
	if (["coordinate_character_team", "operate_mainframe", "debug_mainframe_character"].includes(name)) await mcp_prompt_add_resource(messages, "adventureland://guide/mainframe", user, true);
	if (name === "coordinate_character_team") {
		await mcp_prompt_add_resource(messages, "adventureland://guide/multiple-characters", user, true);
		await mcp_prompt_add_resource(messages, "adventureland://guide/code-messages", user, true);
	}
	if (user && ["configure_samaritan_code", "write_character_code", "review_character_code", "coordinate_character_team", "operate_mainframe", "debug_mainframe_character"].includes(name))
		await mcp_prompt_add_resource(messages, "adventureland://account/dashboard", user, false);
	if (user && name === "improve_character") {
		await mcp_prompt_add_resource(messages, "adventureland://mainframe/characters/" + encodeURIComponent(prompt_arguments.character), user, false);
		await mcp_prompt_add_resource(messages, "adventureland://progression/characters/" + encodeURIComponent(prompt_arguments.character), user, false);
	}
	if (user && name === "review_character_code") await mcp_prompt_add_resource(messages, "adventureland://code/slots/" + encodeURIComponent(prompt_arguments.code_slot), user, false);
	if (user && ["configure_samaritan_code", "write_character_code", "operate_mainframe", "debug_mainframe_character"].includes(name) && prompt_arguments.character)
		await mcp_prompt_add_resource(messages, "adventureland://mainframe/characters/" + encodeURIComponent(prompt_arguments.character), user, false);
	if (name === "configure_samaritan_code") {
		var starterUri = prompt_arguments.variant.toLowerCase() === "merchant" ? "adventureland://code/starters/samaritan-merchant" : "adventureland://code/starters/samaritan";
		await mcp_prompt_add_resource(messages, starterUri, user, true);
		if (user && prompt_arguments.code_slot) await mcp_prompt_add_resource(messages, "adventureland://code/slots/" + encodeURIComponent(prompt_arguments.code_slot), user, false);
	}
	messages.push({ role: "user", content: { type: "text", text: task } });
	return {
		description: prompt.description,
		messages: messages,
	};
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
	var rate = mcp_api_take_rate(args.token, req.params.method, args);
	if (!rate.allowed)
		return res
			.status(429)
			.set("Content-Type", "application/json")
			.set("Retry-After", String(Math.max(1, Math.ceil(rate.retry_after_ms / 1000))))
			.send({ failed: true, reason: "rate_limited", retry_after_ms: rate.retry_after_ms })
			.end();
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

function mcp_api_session_handler(method, handler) {
	return async function (args) {
		var rate = mcp_api_take_rate("session:" + get_id(args.user), method, args);
		if (!rate.allowed) return { failed: true, reason: "rate_limited", retry_after_ms: rate.retry_after_ms };
		return await handler(args);
	};
}

if (typeof REF !== "undefined")
	Object.assign(REF, {
		mainframe_get_dashboard: { F: mcp_api_session_handler("mainframe_get_dashboard", mcp_api_get_mainframe_dashboard), P: true, U: true },
		mainframe_list_characters: { F: mcp_api_session_handler("mainframe_list_characters", mcp_api_list_mainframe_characters), P: true, U: true },
		mainframe_get_character: { F: mcp_api_session_handler("mainframe_get_character", mcp_api_get_mainframe_character), P: true, U: true, character: { type: "string", minimum: 1 } },
		mainframe_link_character: {
			F: mcp_api_session_handler("mainframe_link_character", mcp_api_link_mainframe_character),
			P: true,
			U: true,
			character: { type: "string", minimum: 1 },
			request_id: { type: "string", minimum: 8 },
			code_slot: { type: "string", minimum: 1 },
			server: { type: "string", optional: true },
		},
		mainframe_disconnect_character: {
			F: mcp_api_session_handler("mainframe_disconnect_character", mcp_api_disconnect_mainframe_character),
			P: true,
			U: true,
			character: { type: "string", minimum: 1 },
		},
		mainframe_get_logs: {
			F: mcp_api_session_handler("mainframe_get_logs", mcp_api_get_mainframe_logs),
			P: true,
			U: true,
			character: { type: "string", minimum: 1 },
			limit: { type: "number", optional: true },
		},
		mainframe_get_events: {
			F: mcp_api_session_handler("mainframe_get_events", mcp_api_get_mainframe_events),
			P: true,
			U: true,
			character: { type: "string", minimum: 1 },
			limit: { type: "number", optional: true },
		},
	});

app.get("/mcp_api", async function (req, res) {
	res.set("Cache-Control", "public, max-age=300");
	return res.status(200).send(await mcp_api_get_api_info({}));
});
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

function mcp_capabilities() {
	return { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } };
}

async function handle_mcp_transport(req, res) {
	res.set("Cache-Control", "no-store");
	if (!mcp_request_origin_allowed(req)) return res.status(403).send(mcp_jsonrpc_error(null, -32000, "Origin is not allowed"));
	var token = mcp_bearer_token(req);
	var user = await get_mcp_api_user(token);
	if (!user)
		return res
			.status(401)
			.set("WWW-Authenticate", 'Bearer realm="Adventure Land MCP"')
			.send(mcp_jsonrpc_error(null, -32001, "Invalid access token"));
	var message = req.body;
	if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string")
		return res.status(400).send(mcp_jsonrpc_error(message && message.id, -32600, "Invalid Request"));
	var rate_name = message.method === "tools/call" && message.params ? message.params.name : message.method;
	var rate_args = message.method === "tools/call" && message.params ? message.params.arguments : message.params || {};
	var rate = mcp_api_take_rate(token, rate_name, rate_args);
	if (!rate.allowed)
		return res
			.status(429)
			.set("Retry-After", String(Math.max(1, Math.ceil(rate.retry_after_ms / 1000))))
			.send(mcp_jsonrpc_error(message.id, -32002, "Rate limited", { retry_after_ms: rate.retry_after_ms }));
	var version = String(req.get("mcp-protocol-version") || "");
	var modern = version === MCP_PROTOCOL_CURRENT;
	if (version && ![MCP_PROTOCOL_CURRENT, MCP_PROTOCOL_LEGACY, "2025-06-18", "2025-03-26"].includes(version))
		return res.status(400).send(mcp_jsonrpc_error(message.id, -32600, "Unsupported MCP protocol version"));
	if (modern) {
		if (req.get("mcp-method") !== message.method) return res.status(400).send(mcp_jsonrpc_error(message.id, -32600, "Mcp-Method header mismatch"));
		if (message.method === "tools/call" && req.get("mcp-name") !== ((message.params && message.params.name) || ""))
			return res.status(400).send(mcp_jsonrpc_error(message.id, -32600, "Mcp-Name header mismatch"));
	}
	if (message.method === "notifications/initialized") return res.status(202).end();
	if (message.id === undefined) return res.status(202).end();
	if (message.method === "ping") return res.status(200).send(mcp_jsonrpc(message.id, {}));
	if (message.method === "server/discover") {
		return res.status(200).send(
			mcp_jsonrpc(message.id, {
				supportedVersions: [MCP_PROTOCOL_CURRENT, MCP_PROTOCOL_LEGACY],
				capabilities: mcp_capabilities(),
				instructions: MCP_INSTRUCTIONS,
				startResource: MCP_START_RESOURCE,
				ttlMs: 3600000,
				cacheScope: "global",
				_meta: mcp_result_meta(),
			}),
		);
	}
	if (message.method === "initialize") {
		var requested = message.params && message.params.protocolVersion;
		var negotiated = [MCP_PROTOCOL_CURRENT, MCP_PROTOCOL_LEGACY, "2025-06-18", "2025-03-26"].includes(requested) ? requested : MCP_PROTOCOL_LEGACY;
		return res.status(200).send(
			mcp_jsonrpc(message.id, {
				protocolVersion: negotiated,
				capabilities: mcp_capabilities(),
				serverInfo: MCP_SERVER_INFO,
				instructions: MCP_INSTRUCTIONS,
			}),
		);
	}
	if (message.method === "tools/list") {
		if (message.params && message.params.cursor) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid cursor"));
		return res.status(200).send(mcp_jsonrpc(message.id, { tools: mcp_tools(), _meta: mcp_result_meta() }));
	}
	if (message.method === "resources/list") {
		if (message.params && message.params.cursor) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid cursor"));
		return res.status(200).send(mcp_jsonrpc(message.id, { resources: mcp_resources(), _meta: mcp_result_meta() }));
	}
	if (message.method === "resources/templates/list") {
		if (message.params && message.params.cursor) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid cursor"));
		return res.status(200).send(mcp_jsonrpc(message.id, { resourceTemplates: mcp_resource_templates(), _meta: mcp_result_meta() }));
	}
	if (message.method === "resources/read") {
		var uri = message.params && message.params.uri;
		if (typeof uri !== "string" || uri.length > 500) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid resource URI"));
		try {
			var content = await mcp_read_resource(uri, user);
			if (!content) return res.status(200).send(mcp_jsonrpc_error(message.id, -32002, "Resource not found", { uri: uri }));
			return res.status(200).send(mcp_jsonrpc(message.id, { contents: [content], _meta: mcp_result_meta() }));
		} catch (e) {
			console.error("mcp resource read error", e);
			return res.status(200).send(
				mcp_jsonrpc_error(message.id, -32603, "Resource read failed", {
					code: "resource_read_failed",
					details: { uri: uri },
				}),
			);
		}
	}
	if (message.method === "prompts/list") {
		if (message.params && message.params.cursor) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid cursor"));
		return res.status(200).send(mcp_jsonrpc(message.id, { prompts: mcp_prompt_list(), _meta: mcp_result_meta() }));
	}
	if (message.method === "prompts/get") {
		var prompt_name = message.params && message.params.name;
		if (typeof prompt_name !== "string") return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid prompt name"));
		var prompt = await mcp_get_prompt(prompt_name, message.params.arguments, user);
		if (prompt.error) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, prompt.error));
		prompt._meta = mcp_result_meta();
		return res.status(200).send(mcp_jsonrpc(message.id, prompt));
	}
	if (message.method === "tools/call") {
		var name = message.params && message.params.name;
		var ref = MCP_API_REF[name];
		if (!ref) return res.status(200).send(mcp_jsonrpc_error(message.id, -32601, "Unknown tool"));
		var args = (message.params && message.params.arguments) || {};
		if (!args || typeof args !== "object" || Array.isArray(args)) return res.status(200).send(mcp_jsonrpc_error(message.id, -32602, "Invalid tool arguments"));
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
