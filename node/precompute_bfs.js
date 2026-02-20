var is_game = 0;
var is_server = 0;
var is_code = 0;
var keys = require("../secretsandconfig/keys");
var options = require("../secretsandconfig/options");
var Dev = options.Dev;
var fs = require("fs");
const path = require("node:path");
var precomputed = null;
var precomputed_bfs = null;
var G = {};
var D = {};
var S = {};
var gameplay = "normal";
var is_pvp = false;
var mode = {};
var server_id = "precompute";
var server_auth = keys.SERVER_MASTER;

// MongoDB connection
MongoClient = require("mongodb").MongoClient;
if (keys.mongodb_tls) {
	var mongodb_url =
		"mongodb://" +
		keys.mongodb_user +
		":" +
		keys.mongodb_password +
		"@" +
		keys.mongodb_ip +
		":" +
		keys.mongodb_port +
		"/" +
		keys.mongodb_name +
		"?authSource=" +
		(keys.mongodb_auth_source || keys.mongodb_name) +
		"&tls=true";
	client = new MongoClient(mongodb_url, { tlsCAFile: keys.mongodb_ca_file });
} else {
	client = new MongoClient(
		"mongodb://" +
			keys.mongodb_user +
			":" +
			keys.mongodb_password +
			"@" +
			keys.mongodb_ip +
			":" +
			keys.mongodb_port +
			"/?directConnection=true",
	);
}

// Stub functions needed by models.js
function post_get_init_user() {}
function post_get_init_character() {}

eval("" + fs.readFileSync(path.resolve(__dirname, "../common/js/common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../js/old_common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../models.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../common/mongodb_functions.js")));

async function run() {
	await client.connect();
	db = client.db(keys.mongodb_name);
	console.log("Connected to MongoDB: " + keys.mongodb_name);

	// Load server_functions and design files in same scope
	eval("" + fs.readFileSync(path.resolve(__dirname, "server_functions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/projectiles.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/animations.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/achievements.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/game_design.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/games.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/conditions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/sprites.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/dimensions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/monsters.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/maps.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/npcs.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/multipliers.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/items.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/classes.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/levels.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/upgrades.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/drops.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/skills.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/events.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/recipes.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/titles.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/tokens.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/cosmetics.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/emotions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/precomputed_images.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../version.js")));

	// Load geometry from MongoDB
	var geometry = {};
	var rpc = {};
	for (var id in maps) {
		if (maps[id].ignore) continue;
		var key = maps[id].key;
		rpc[id] = get("MP_" + key);
	}
	for (var id in maps) {
		if (maps[id].ignore) continue;
		var map = await rpc[id];
		if (map) geometry[id] = map.info.data;
	}

	// Build G
	G = {
		version: Version,
		achievements: achievements,
		animations: animations,
		monsters: monsters,
		sprites: sprites,
		maps: maps,
		geometry: geometry,
		npcs: npcs,
		tilesets: tilesets,
		imagesets: imagesets,
		items: items,
		sets: sets,
		craft: craft,
		titles: titles,
		tokens: tokens,
		dismantle: dismantle,
		conditions: conditions,
		cosmetics: cosmetics,
		emotions: emotions,
		projectiles: projectiles,
		classes: classes,
		dimensions: dimensions,
		levels: levels,
		positions: positions,
		skills: skills,
		games: games,
		events: events,
		images: precomputed.images,
		multipliers: multipliers,
	};

	D = {
		upgrades: upgrades,
		drops: drops,
		compounds: compounds,
		monster_gold: monster_gold,
		odds: typeof odds !== "undefined" && odds,
	};

	// Process game data (links G.maps[name].data = G.geometry[name])
	sprocess_game_data();

	// Run BFS for all maps
	var start = new Date();
	for (var mname in G.maps) {
		if (G.maps[mname].ignore) continue;
		var cstart = new Date();
		server_bfs(mname);
		console.log("Precomputed: " + mname + " in " + mssince(cstart) + "ms");
	}
	console.log("Done: " + mssince(start) + "ms");

	// Write BFS data to node/precomputed_map_data.js (design/precomputed_images.js has images)
	var result = {};
	result.version = G.version;
	result.amap_data = amap_data;
	result.smap_data = smap_data;
	fs.writeFileSync(
		path.resolve(__dirname, "precomputed_map_data.js"),
		"// " + new Date() + "\nvar precomputed_bfs=" + JSON.stringify(result) + ";",
	);
	console.log("Written to: " + path.resolve(__dirname, "precomputed_map_data.js"));

	await client.close();
	process.exit(0);
}

run().catch(function (e) {
	console.error("Error:", e);
	process.exit(1);
});
