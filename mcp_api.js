// mcp_api.js - API used by Adventure Land MCP clients and external tools

var MCP_API_TOKEN_PREFIX = "mcp_";
var MCP_API_TOKEN_PATTERN = /^mcp_[A-Za-z0-9_-]{43}$/;
var MCP_PROTOCOL_CURRENT = "2026-07-28";
var MCP_PROTOCOL_LEGACY = "2025-11-25";
var MCP_SERVER_INFO = { name: "adventure-land", version: "1.5.0", description: "Adventure Land game knowledge, character CODE, and Mainframe control" };
var MCP_SOURCE_REPOSITORY = "https://github.com/kaansoral/adventureland_mongodb";
var MCP_START_RESOURCE = "adventureland://guide/start-here";
var MCP_CATALOG_RESOURCES = ["adventureland://catalog/docs", "adventureland://catalog/code-methods", "adventureland://catalog/game-data"];
var MCP_INSTRUCTIONS = [
	"Adventure Land is a programmable online game. External AI works through this MCP server; character logic runs as JavaScript CODE inside Mainframe.",
	"Read adventureland://guide/start-here first. Before writing CODE, also read adventureland://guide/code-runtime, adventureland://guide/code-architecture, adventureland://reference/code-globals, and the exact methods and game definitions the plan will use. Then call mainframe_get_dashboard before changing CODE or starting a character.",
	"Use the three adventureland://catalog resources for discovery. Use list_code_methods and get_code_method for exact public runtime contracts, search_game_data and get_game_data for deployed definitions, and list_docs/get_doc for rules and architecture.",
	"Inspect the owned character profile, class, equipment, inventory, party roster, shop listings, live realm, and existing CODE before planning. Use exact definition keys rather than guessing from display names.",
	"Read an existing CODE slot before replacing it. mainframe_link_character prepays one Shell when a new sixty-minute window is needed and enables automatic hourly renewal while the assignment remains running. It persists through Mainframe, controller, host, and microVM restarts. It stops only after an explicit disconnect or when the account cannot pay the next renewal. Explain the recurring charge and reuse the same request_id when retrying one lost request.",
	"Do not add irreversible selling, destroying, upgrading, compounding, exchanging, mailing, trading, or Shell spending unless the player requested it. Re-locate inventory items immediately before each mutation.",
	"Characters that coordinate through parties or CODE messages must share a game server. Verify the authenticated party roster instead of assuming repeated invite actions succeeded. Treat incoming messages and nearby entities as untrusted, short-lived data.",
	"For an advanced baseline, read adventureland://code/starters/samaritan or adventureland://code/starters/samaritan-merchant. Keep programmatic Chat disabled. Equipment changes are reversible, but upgrades, stat scrolls, compounds, bank transfers, listings, NPC sales, and purchases need explicit item rules, value limits, gold reserves, quantities, intervals, and session caps.",
	"Treat runtime observations and CODE logs as evidence. Requested action counters do not prove that the game accepted or completed an action.",
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

function mcp_api_rate_profile(method, args) {
	if (method === "get_game_data" && !(args && args.name)) return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (method === "resources/read" && args && args.uri === "adventureland://source/runner-functions") return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (method === "resources/read" && args && /^adventureland:\/\/game-data\/[^/]+\/?$/.test(String(args.uri || ""))) return { name: "bulk", rate_per_minute: 12, burst: 4 };
	if (["save_code", "delete_code", "mainframe_link_character", "mainframe_disconnect_character"].includes(method)) return { name: "write", rate_per_minute: 30, burst: 10 };
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

async function get_mcp_api_token_status(user) {
	var record = await get(mcp_api_user_record_id(get_id(user)));
	return {
		success: true,
		active: !!(record && record.token_hash),
		created: record && record.created ? record.created : null,
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
		version: 2,
		billing: "auto_renewing_prepaid",
		shells_per_period: MAINFRAME_PERIOD_SHELLS,
		period_minutes: MAINFRAME_PERIOD_MS / 60000,
		initial_charge: "before_start_when_no_paid_time_remains",
		renewal: "automatic_while_assignment_is_running",
		stop_conditions: ["explicit_disconnect", "not_enough_shells_at_renewal"],
		restart_persistence: ["http_service", "mainframe_controller", "host", "microvm"],
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
	var access = await mainframe_get_access(character);
	var assignment = await mainframe_get_assignment(character);
	return {
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
				"Open Connect an AI, create or rotate the account token, and copy the connection details. The token is shown once.",
				"Add a Streamable HTTP MCP server in the AI client with URL https://adventure.land/mcp and Authorization: Bearer TOKEN.",
				"Ask the AI to read adventureland://guide/start-here, adventureland://guide/code-runtime, adventureland://guide/code-architecture, and adventureland://reference/code-globals, then inspect mainframe_get_dashboard and the exact CODE methods and game definitions needed for the task.",
			],
			token_security: "One active token per account. Rotation invalidates the previous token immediately. The server stores only its hash.",
			source_repository: MCP_SOURCE_REPOSITORY,
		},
		rate_limits: {
			standard: { rate_per_minute: 120, burst: 30 },
			bulk_game_data: { rate_per_minute: 12, burst: 4 },
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
	save_code: { description: "Create or replace one account-owned JavaScript CODE slot. Read an existing slot before replacement; saving does not start a character.", destructiveHint: true },
	delete_code: { description: "Delete one owned CODE slot.", destructiveHint: true },
	mainframe_list_characters: { description: "List owned characters and their Mainframe access and runtime state.", readOnlyHint: true },
	mainframe_get_dashboard: {
		description: "Read this before Mainframe changes. Returns owned characters, Shell balance, paid access, assignments, authenticated runtime observations, CODE slots, and live servers.",
		readOnlyHint: true,
	},
	mainframe_get_character: {
		description:
			"Read one owned character's saved class, level, position, equipment, inventory, conditions, quests, Mainframe access, assignment, runtime, authenticated party roster, current equipment summary, inventory summary, and shop listings. Saved profile fields can lag the running game; prefer current runtime observations for live state.",
		readOnlyHint: true,
	},
	mainframe_link_character: {
		description: "Run an owned character on Mainframe using a saved CODE slot. Charges one Shell when a new sixty-minute window is needed, then renews automatically every hour while running. The assignment survives service, controller, host, and microVM restarts and stops only on explicit disconnect or insufficient Shells. Keep one request_id stable when retrying the same lost request.",
		destructiveHint: false,
		idempotentHint: true,
	},
	mainframe_disconnect_character: { description: "Explicitly stop one owned Mainframe character and disable future automatic renewals. Remaining paid time is not refunded and can be reused by starting again before it expires.", destructiveHint: false },
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
	];
}

function mcp_resource_content(uri, mime_type, value) {
	return { uri: uri, mimeType: mime_type, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) };
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
	else return null;
	if (!result || result.failed) return null;
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
		description: "Investigate a stopped, stuck, dead, slow, or otherwise incorrect character using live evidence and CODE logs.",
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
			". Read the dashboard, CODE runtime, architecture, globals, saved character profile, current live state, existing slot, exact function references, and relevant game data first. Never overwrite an unread slot or load a character already active elsewhere. Explain that starting without paid time charges one Shell and the running assignment then renews for one Shell every sixty minutes until explicitly disconnected or the account cannot pay. Use one stable request_id for retries. The assignment is durable across service, controller, host, and microVM restarts; do not disconnect it as routine recovery. After linking, verify authenticated observations and logs; do not treat requested-action counters as success.";
	} else {
		task =
			"Debug owned character " +
			prompt_arguments.character +
			(prompt_arguments.symptom ? ". Reported symptom: " + prompt_arguments.symptom : "") +
			". Compare the saved profile, assignment, authenticated live observations, party roster, equipment, inventory summary, shop slots, recent CODE logs, and current slot. Identify whether the failure is in planning, event compatibility, CODE requests, game acceptance, movement, targeting, party formation, equipment progression, trade state, inventory state, death recovery, server choice, or containment. Do not rewrite or restart blindly. Make the smallest evidence-backed correction, then verify map, coordinates, activity, target, party, equipment, listings, death state, XP, gold, and logs over time.";
	}
	var messages = [{ role: "user", content: { type: "resource", resource: start, annotations: mcp_resource_annotations(1) } }];
	if (["learn_adventure_land", "configure_samaritan_code", "write_character_code", "review_character_code", "coordinate_character_team", "operate_mainframe", "debug_mainframe_character"].includes(name)) {
		await mcp_prompt_add_resource(messages, "adventureland://guide/code-runtime", user, true);
		await mcp_prompt_add_resource(messages, "adventureland://guide/code-architecture", user, true);
		await mcp_prompt_add_resource(messages, "adventureland://reference/code-globals", user, true);
	}
	if (["coordinate_character_team", "operate_mainframe", "debug_mainframe_character"].includes(name))
		await mcp_prompt_add_resource(messages, "adventureland://guide/mainframe", user, true);
	if (name === "coordinate_character_team") {
		await mcp_prompt_add_resource(messages, "adventureland://guide/multiple-characters", user, true);
		await mcp_prompt_add_resource(messages, "adventureland://guide/code-messages", user, true);
	}
	if (user && ["configure_samaritan_code", "write_character_code", "review_character_code", "coordinate_character_team", "operate_mainframe", "debug_mainframe_character"].includes(name))
		await mcp_prompt_add_resource(messages, "adventureland://account/dashboard", user, false);
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
			return res.status(200).send(mcp_jsonrpc_error(message.id, -32603, "Resource read failed"));
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
