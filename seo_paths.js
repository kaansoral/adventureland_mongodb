const PUBLIC_PATHS = ["/", "/docs", "/linux"];

const DOCS_PATHS = [
	"/docs/code",
	"/docs/code/character/events",
	"/docs/code/character/reference",
	"/docs/code/data",
	"/docs/code/functions",
	"/docs/code/game/events",
	"/docs/code/links",
	"/docs/code/monster/reference",
	"/docs/code/server/status",
	"/docs/guide",
	"/docs/guide/all/cosmetics",
	"/docs/guide/all/events",
	"/docs/guide/all/items",
	"/docs/guide/all/monsters",
	"/docs/guide/all/recipes",
	"/docs/guide/all/skills_and_conditions",
	"/docs/guide/code/X-advancedtopics/X.sub-msgpack",
	"/docs/ref",
	"/docs/ref/boosters",
	"/docs/ref/keymapping",
	"/docs/ref/shells",
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
		"data-server-status": "/docs/code/server/status",
		"events-character": "/docs/code/character/events",
		"events-game": "/docs/code/game/events",
	};

	for (var i = 0; i < args.docs.functions.length; i++) paths.add("/docs/code/functions/" + url_part(args.docs.functions[i]));
	add_guide_paths(paths, args.docs.guide, "/docs/guide", article_names);

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
