const PUBLIC_PATHS = ["/", "/docs", "/linux", "/mainframe", "/vscode", "/hub"];
// /steam-signup and its callbacks are private, noindex account routes, not sitemap entries.

const DOCS_PATHS = [
	"/docs/code",
	"/docs/code/character/events",
	"/docs/code/character/reference",
	"/docs/code/data",
	"/docs/code/functions",
	"/docs/code/functions/bank_store",
	"/docs/code/functions/bank_retrieve",
	"/docs/code/functions/auto_craft",
	"/docs/code/functions/buy",
	"/docs/code/functions/giveaway",
	"/docs/code/functions/equip",
	"/docs/code/functions/equip_cx",
	"/docs/code/functions/get_progression",
	"/docs/code/functions/is_on_cooldown",
	"/docs/code/functions/load_code",
	"/docs/code/functions/loot",
	"/docs/code/functions/on_cm",
	"/docs/code/functions/open_stand",
	"/docs/code/functions/require_code",
	"/docs/code/functions/send_cm",
	"/docs/code/functions/smart_move",
	"/docs/code/functions/use_skill",
	"/docs/code/game/events",
	"/docs/code/links",
	"/docs/code/monster/reference",
	"/docs/code/npc/reference",
	"/docs/code/server/status",
	"/docs/guide",
	"/docs/guide/banking",
	"/docs/guide/crafting",
	"/docs/guide/services/crafting",
	"/docs/guide/markets-and-trading",
	"/docs/guide/services/markets-and-trading",
	"/docs/guide/progression/encouragement",
	"/docs/guide/progression/progression-guide",
	"/docs/guide/all/cosmetics",
	"/docs/guide/all/events",
	"/docs/guide/events-and-home",
	"/docs/guide/all/items",
	"/docs/guide/all/monsters",
	"/docs/guide/all/recipes",
	"/docs/guide/all/skills_and_conditions",
	"/docs/guide/code/X-advancedtopics/X.sub-msgpack",
	"/docs/guide/code/7-using-skills",
	"/docs/guide/code/8-code-slots-and-files",
	"/docs/guide/code/code-api",
	"/docs/guide/code-globals",
	"/docs/guide/multi",
	"/docs/guide/adventure-api",
	"/docs/guide/advanced/adventure-api",
	"/docs/guide/adventure-mcp",
	"/docs/guide/mainframe",
	"/docs/guide/hub",
	"/docs/ref/hub",
	"/docs/tutorial",
	"/docs/tutorial/js-hello",
	"/docs/tutorial/tracktrix",
	"/docs/tutorial/mail",
	"/docs/guide/advanced/cavalry",
	"/docs/tutorial/hunting",
	"/docs/guide/monster-hunts",
	"/docs/guide/services/monster-hunts",
	"/docs/guide/lore",
	"/docs/guide/first-goals",
	"/docs/guide/merchant",
	"/docs/ref",
	"/docs/ref/boosters",
	"/docs/ref/cave-of-many-dreams",
	"/docs/ref/cave-story",
	"/docs/guide/cave-story",
	"/docs/guide/world/cave-story",
	"/docs/guide/cave-of-many-dreams",
	"/docs/guide/world/cave-of-many-dreams",
	"/docs/ref/event-anniversary",
	"/docs/guide/event-anniversary",
	"/docs/guide/world/event-anniversary",
	"/docs/guide/rime-djinn",
	"/docs/guide/world/rime-djinn",
	"/docs/ref/npc-merrit",
	"/docs/guide/npc-merrit",
	"/docs/guide/services/npc-merrit",
	"/docs/ref/keymapping",
	"/docs/ref/shells",
	"/docs/code/functions/bet_wheel",
	"/docs/code/functions/get_poker_table",
	"/docs/code/functions/poker_join",
	"/docs/code/functions/poker_leave",
	"/docs/code/functions/poker_act",
	"/docs/code/functions/poker_sit_out",
	"/docs/code/functions/poker_sit_in",
	"/docs/guide/tavern-games",
	"/docs/guide/world/tavern-games",
];

const DOCS_DATA_KEYS = [
	"achievements",
	"animations",
	"classes",
	"conditions",
	"cosmetics",
	"craft",
	"dimensions",
	"dismantle",
	"docs",
	"drops",
	"events",
	"games",
	"geometry",
	"images",
	"imagesets",
	"items",
	"levels",
	"maps",
	"monsters",
	"multipliers",
	"npcs",
	"positions",
	"projectiles",
	"sets",
	"skills",
	"sprites",
	"tilesets",
	"titles",
	"tokens",
	"version",
];

function url_part(value) {
	return encodeURIComponent(value);
}

function add_guide_paths(paths, entries, parent_path, article_names) {
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i],
			entry_path = parent_path + "/" + url_part(entry[0]);
		paths.add(entry_path);
		if (entry[4]) add_guide_paths(paths, entry[4], entry_path, article_names);
		else article_names.add(entry[0]);
	}
}

function get_seo_paths(args) {
	var paths = new Set(PUBLIC_PATHS.concat(DOCS_PATHS)),
		article_names = new Set();
	var article_routes = {
		"data-character": "/docs/code/character/reference",
		"data-monster": "/docs/code/monster/reference",
		"data-npc": "/docs/code/npc/reference",
		"data-server-status": "/docs/code/server/status",
		"events-character": "/docs/code/character/events",
		"events-game": "/docs/code/game/events",
	};

	for (var i = 0; i < args.docs.functions.length; i++) paths.add("/docs/code/functions/" + url_part(args.docs.functions[i]));
	add_guide_paths(paths, args.docs.guide, "/docs/guide", article_names);
	for (var i = 0; i < args.docs.tutorial.length; i++) paths.add("/docs/tutorial/" + url_part(args.docs.tutorial[i].key));
	for (var i = 0; i < (args.docs.merchant_tutorial || []).length; i++) paths.add("/docs/tutorial/" + url_part(args.docs.merchant_tutorial[i].key));

	for (var i = 0; i < DOCS_DATA_KEYS.length; i++) paths.add("/docs/code/data/" + url_part(DOCS_DATA_KEYS[i]));
	for (var i = 0; i < args.guide_articles.length; i++) {
		var article = args.guide_articles[i];
		if (!article_names.has(article)) paths.add("/docs/ref/" + url_part(article));
	}
	for (var i = 0; i < args.code_articles.length; i++) {
		var article = args.code_articles[i];
		if (!article_names.has(article)) paths.add(article_routes[article] || "/docs/guide/" + url_part(article));
	}
	for (var name in args.items) {
		if (!args.items[name].ignore) paths.add("/docs/guide/all/items/" + url_part(name));
	}
	for (var name in args.monsters) {
		var monster = args.monsters[name];
		if (!(((monster.stationary || monster.cute) && !monster.achievements) || monster.hide)) paths.add("/docs/guide/all/monsters/" + url_part(name));
	}

	return Array.from(paths).sort(function (a, b) {
		if (a === "/") return -1;
		if (b === "/") return 1;
		return a.localeCompare(b);
	});
}

module.exports = { get_seo_paths };
