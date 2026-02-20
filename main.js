var fs = require("fs"),
	path = require("path");
var keys = require("./secretsandconfig/keys");
var options = require("./secretsandconfig/options");

eval("" + fs.readFileSync(path.resolve(__dirname, "common/init.js")));
reinit_from_options();

// Override MongoDB connection with TLS (common/init.js doesn't support TLS params)
if (keys.mongodb_tls) {
	var mongodb_url = "mongodb://" + keys.mongodb_user + ":" + keys.mongodb_password + "@" + keys.mongodb_ip + ":" + keys.mongodb_port + "/" + keys.mongodb_name + "?authSource=" + (keys.mongodb_auth_source || keys.mongodb_name) + "&tls=true";
	client = new MongoClient(mongodb_url, { tlsCAFile: keys.mongodb_ca_file });
	client.connect();
	db = client.db(keys.mongodb_name);
}

// TTL index: auto-delete events after 75 days
db.collection("event").createIndex({ created: 1 }, { expireAfterSeconds: 75 * 24 * 3600 });

eval("" + fs.readFileSync(path.resolve(__dirname, "version.js")));
if (Local) {
	const filePath = path.join(__dirname, "version.js");
	let lines = fs.readFileSync(filePath, "utf-8").split("\n");
	lines[0] = lines[0].replace(/Version\s*=\s*(\d+);/, (match, p1) => {
		const newVersion = parseInt(p1, 10) + 1;
		return `Version = ${newVersion};`;
	});
	fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

eval("" + fs.readFileSync(path.resolve(__dirname, "common/js/common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "common/mongodb_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "common/handlers.js")));

// Stub post-init functions so models.js can reference them (full definitions in adventure_functions.js)
function post_get_init_user(entity) {}
function post_get_init_character(entity) {}

eval("" + fs.readFileSync(path.resolve(__dirname, "models.js")));

// /design — order follows Python config.py import order (dependencies must load first)
eval("" + fs.readFileSync(path.resolve(__dirname, "design/projectiles.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/animations.js"))); // needs projectiles
eval("" + fs.readFileSync(path.resolve(__dirname, "design/achievements.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/game_design.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/games.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/conditions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/sprites.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/dimensions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/monsters.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/maps.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/npcs.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/multipliers.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/items.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/classes.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/levels.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/upgrades.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/drops.js"))); // needs items
eval("" + fs.readFileSync(path.resolve(__dirname, "design/skills.js"))); // needs conditions
eval("" + fs.readFileSync(path.resolve(__dirname, "design/events.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/recipes.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/titles.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/tokens.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/cosmetics.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/emotions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "design/precomputed_images.js")));

// docs
eval("" + fs.readFileSync(path.resolve(__dirname, "docs/directory.js")));

eval("" + fs.readFileSync(path.resolve(__dirname, "adventure_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "filters.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "api.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "crons.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "common/admin.js")));

// Stripe
try { var stripe = require("stripe")(Dev ? keys.stripe_test_api_key : keys.stripe_api_key); } catch (e) { console.error("Stripe not loaded", e.message); }

// ==================== ROUTES ====================

// Main page / Selection
app.get("/", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	await render_selection(req, res, user, domain);
});

// Communication page
app.get("/comm", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/comm.html", { domain: domain, user: user }));
});

// Character profile page
app.get("/character/:name", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	var character = await get_character(req.params.name);
	if (!character)
		return res.status(200).send(nunjucks.render("htmls/simple_message.html", { domain: domain, message: "Not Found" }));
	if (!user) {
		var ref = character.private ? req.params.name : character.owner;
		set_cookie(res, "referrer", ref, domain.domain);
		var ip = await get_ip_info(req);
		ip.referrer = ref;
		await put_ip_info(ip);
	}
	domain.title = character.info.name || character.name;
	res.status(200).send(nunjucks.render("htmls/character.html", { domain: domain, character: character }));
});

// All characters listing
app.get("/characters", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	var characters = await db.collection("character").find({}).sort({ level: -1 }).limit(500).toArray();
	domain.title = "Characters";
	res.status(200).send(nunjucks.render("htmls/player.html", { domain: domain, characters: characters }));
});

// Player profile page
app.get("/player/:name", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	var character = await get_character(req.params.name);
	if (!character)
		return res.status(200).send(nunjucks.render("htmls/simple_message.html", { domain: domain, message: "Not Found" }));
	var player = await get(character.owner);
	if (!player)
		return res.status(200).send(nunjucks.render("htmls/simple_message.html", { domain: domain, message: "Not Found" }));
	if (!user) {
		var ref = character.private ? req.params.name : get_id(player);
		set_cookie(res, "referrer", ref, domain.domain);
		var ip = await get_ip_info(req);
		ip.referrer = ref;
		await put_ip_info(ip);
	}
	domain.title = player.name;
	var characters = [];
	var entities;
	if (character.private) {
		entities = [character];
		domain.title = character.info.name || character.name;
	} else {
		entities = await db.collection("character").find({ owner: character.owner, private: { $ne: true } }).toArray();
	}
	if (!entities.length) {
		entities = [character];
		domain.title = character.info.name || character.name;
	}
	var player_chars = gf(player, "characters", []);
	for (var i = 0; i < player_chars.length; i++) {
		for (var j = 0; j < entities.length; j++) {
			if (simplify_name(entities[j].name) === simplify_name(player_chars[i].name)) {
				characters.push(entities[j]);
			}
		}
	}
	res.status(200).send(nunjucks.render("htmls/player.html", { domain: domain, characters: characters }));
});

// Merchants listing
app.get("/merchants", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	domain.title = "All Online Merchants!";
	var entities = await db.collection("character").find({ online: true, type: "merchant" }).toArray();
	res.status(200).send(nunjucks.render("htmls/player.html", { domain: domain, characters: entities, merchants: true }));
});

// Character + server selection (enter game)
app.get("/character/:name/in/:region/:sname", async (req, res, next) => {
	var user = await get_user(req);
	var domain = await get_domain(req, user),
		level = 80;
	var servers = await get_servers();
	var code = req.query.code;
	if (code) domain.explicit_slot = code;
	var user_chars = gf(user, "characters", []);
	for (var i = 0; i < user_chars.length; i++) {
		if (simplify_name(user_chars[i].name) === simplify_name(req.params.name)) {
			domain.character_name = user_chars[i].name;
			domain.url_character = user_chars[i].id;
			level = user_chars[i].level;
		}
	}
	for (var i = 0; i < servers.length; i++) {
		if (servers[i].region === req.params.region && servers[i].name === req.params.sname) {
			domain.url_address = servers[i].address;
			domain.url_path = servers[i].path;
		}
	}
	await render_selection(req, res, user, domain, level);
});

// Server selection
app.get("/server/:region/:sname", async (req, res, next) => {
	var user = await get_user(req);
	var domain = await get_domain(req, user);
	var servers = await get_servers();
	var S = null;
	for (var i = 0; i < servers.length; i++) {
		if (servers[i].region === req.params.region && servers[i].name === req.params.sname) S = servers[i];
	}
	await render_selection(req, res, user, domain, 80, S);
});

// Email verification
app.get("/ev/:uid/:v", async (req, res, next) => {
	var domain = await get_domain(req);
	var user = await get(req.params.uid);
	var message = "Email Verification Failed";
	if (user && !gf(user, "verified")) {
		if (gf(user, "everification") === req.params.v) {
			var R = await tx(async () => {
				R.element = await tx_get(A.user);
				R.element.info.verified = true;
				await tx_save(R.element);
			}, { user: user });
			if (!R.failed) message = "Your Email Is Now Verified";
		}
	} else if (user) {
		message = "Your Email Is Already Verified";
	}
	res.status(200).send(nunjucks.render("htmls/simple_message.html", { domain: domain, message: message }));
});

// Password reset page
app.get("/reset/:uid/:key", async (req, res, next) => {
	var domain = await get_domain(req);
	var user = await get(req.params.uid);
	if (user && gf(user, "password_key", "123") === req.params.key) {
		res.status(200).send(nunjucks.render("htmls/contents/password_reset.html", { domain: domain, user: user, id: req.params.uid, key: req.params.key }));
	} else {
		res.status(200).send(nunjucks.render("htmls/simple_message.html", { domain: domain, message: "Invalid Password Reset URL" }));
	}
});

// User code serving
app.all("/code.js", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	var name = req.query.name || req.body.name;
	if (user) {
		var data = await get_user_data(user);
		var code_list = gf(data, "code_list", {});
		for (var slot in code_list) {
			if ("" + slot === "" + name || ("" + code_list[slot][0]).toLowerCase() === ("" + to_filename(name)).toLowerCase()) {
				var code = await get("IE_USERCODE-" + get_id(user) + "-" + slot);
				if (code) return res.status(200).set("Content-Type", "application/javascript").send("" + code.info.code);
			}
		}
	}
	if (req.query.xrequire) res.status(200).set("Content-Type", "application/javascript").send("throw('xrequire: Code not found')");
	else res.status(200).set("Content-Type", "application/javascript").send("game_log('load_code: Code not found',colors.code_error)");
});

// Game data serving
app.all("/data.js", async (req, res, next) => {
	var domain = await get_domain(req),
		additional = "",
		geometry = {},
		rpc = {};
	for (var id in maps) {
		if (maps[id].ignore) continue;
		rpc[id] = get("MP_" + maps[id].key);
	}
	for (var id in maps) {
		if (maps[id].ignore) continue;
		var map = await rpc[id];
		if (map) geometry[id] = map.info.data;
	}
	var G = {
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
		docs: docs,
		drops: drops,
	};
	if (req.query.reload || (req.body && req.body.reload))
		additional = "add_log('Game data reloaded','#32A3B0');\napply_backup()\n";
	res.status(200).set("Content-Type", "application/javascript").set("Cache-Control", "public, max-age=2592000").send("var G=" + JSON.stringify(G) + ";\n" + additional);
});

// Shells / Payment page
app.get("/shells", async (req, res, next) => {
	var user = await get_user(req),
		domain = await get_domain(req, user);
	var servers = await get_servers();
	var server = select_server(req, user, servers);
	domain.stripe_enabled = true;
	res.status(200).send(nunjucks.render("htmls/payments.html", { domain: domain, user: user, server: server, extra_shells: extra_shells }));
});

// Resort Map Editor - GET
app.get("/map/:name/:suffix?", async (req, res, next) => {
	var name = req.params.name;
	if (!name) return res.status(404).send("");
	name = name.split("/")[0];
	var user = await get_user(req),
		domain = await get_domain(req, user);
	if (security_threat(req, domain)) return res.status(403).send("security_threat");
	if (!user || (!name.startsWith(get_id(user) + "_") && !gf(user, "map_editor"))) return res.status(403).send("");
	var number = name.split("_")[1];
	if (["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].indexOf(number) === -1) return res.status(400).send("");
	var map = await get("MP_" + name);
	var mtilesets = JSON.parse(JSON.stringify(tilesets));
	if (!mtilesets.this_map) mtilesets.this_map = { file: "/images/tiles/map/resort_default.png" };
	if (!mtilesets.this_map_a) mtilesets.this_map_a = { file: "/images/tiles/map/resort_default_a.png" };
	res.status(200).send(nunjucks.render("utility/htmls/map_editor.html", { domain: domain, name: name, map: map, tilesets: mtilesets, community: 1, resort: 1 }));
});

// Resort Map Editor - POST
app.post("/map/:name/:suffix?", async (req, res, next) => {
	var data = req.body.data;
	var name = req.params.name;
	if (!name) return res.status(404).send("");
	name = name.split("/")[0];
	var user = await get_user(req),
		domain = await get_domain(req, user);
	if (!user || !name.startsWith(get_id(user) + "_")) return res.status(403).send("");
	var number = name.split("_")[1];
	if (["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].indexOf(number) === -1) return res.status(400).send("");
	var map = await get("MP_" + name);
	if (!map) map = { _id: "MP_" + name, created: new Date(), info: {}, blobs: ["info"] };
	if (typeof data === "string") data = JSON.parse(data);
	map.info.data = data;
	process_map(map);
	map.player = true;
	map.updated = new Date();
	await save(map);
	res.status(200).send("" + to_pretty_num(JSON.stringify(map.info.data).length));
});

// Maps listing
app.get("/maps/:order?", async (req, res, next) => {
	var domain = await get_domain(req);
	var order = req.params.order || "";
	var url = Dev ? domain.base_url + "/editmap" : domain.base_url + "/communitymaps";
	var html = "<style> html{background-color:gray}</style>";
	var query = order === "key" ? {} : {};
	var sort = order === "key" ? { _id: 1 } : { updated: -1 };
	var maps_list = await db.collection("map").find(query).sort(sort).limit(5000).toArray();
	for (var i = 0; i < maps_list.length; i++) {
		var m = maps_list[i];
		html += "<div style='margin-bottom: 2px'><a href='" + url + "/" + get_id(m).replace("MP_", "") + "' target='_blank' style='color: white; font-weight: bold; text-decoration:none'>" + get_id(m).replace("MP_", "") + "</a></div>";
	}
	res.status(200).send(html);
});

// Static pages
app.get("/privacy", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/page.html", { domain: domain, user: user, content: "privacy" }));
});
app.get("/terms", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/page.html", { domain: domain, user: user, content: "terms" }));
});
app.get("/contact", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/page.html", { domain: domain, user: user, content: "contact" }));
});
app.get("/credits", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/page.html", { domain: domain, user: user, content: "credits" }));
});

// Docs
app.get("/docs/:path0?/:path1?/:path2?/:path3?", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	domain.title = "Docs";
	var p = [req.params.path0, req.params.path1, req.params.path2, req.params.path3];
	for (var i = 0; i < p.length; i++) { if (p[i]) domain.title += " /" + p[i]; }
	res.status(200).send(nunjucks.render("htmls/docs.html", { domain: domain, user: user, content: "docs", dpath: p, extras: true }));
});

// Runner, executor, logs pages
app.get("/runner", async (req, res, next) => {
	var domain = await get_domain(req);
	res.status(200).send(nunjucks.render("htmls/runner.html", { domain: domain }));
});
app.get("/executor", async (req, res, next) => {
	var domain = await get_domain(req);
	res.status(200).send(nunjucks.render("htmls/executor.html", { domain: domain }));
});
app.get("/logs", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/logs.html", { domain: domain, user: user }));
});
app.get("/linux", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/linux.html", { domain: domain, user: user }));
});
app.get("/macos", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/macos.html", { domain: domain, user: user }));
});
app.get("/allnotes", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/allnotes.html", { domain: domain, user: user }));
});
app.get("/roadmap", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/roadmap.html", { domain: domain, user: user }));
});
app.get("/drm-free", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/drmfree.html", { domain: domain, user: user }));
});
app.get("/it-is-what-it-is", async (req, res, next) => {
	var user = await get_user(req), domain = await get_domain(req, user);
	res.status(200).send(nunjucks.render("htmls/disclaimers.html", { domain: domain, user: user }));
});

// Dev rearm
app.get("/rearm", async (req, res, next) => {
	if (!Dev) return res.status(403).send("");
	// Free all servers and unlock all
	await db.collection("server").updateMany({}, { $set: { online: false } });
	await db.collection("character").updateMany({ online: true }, { $set: { online: false, server: "" } });
	res.status(200).send("done!");
});

// Referrer redirect
app.get("/r/:ref", async (req, res, next) => {
	var referrer = await get(req.params.ref);
	if (referrer) {
		var domain = await get_domain(req);
		set_cookie(res, "referrer", get_id(referrer), domain.domain);
		var ip = await get_ip_info(req);
		ip.referrer = get_id(referrer);
		await put_ip_info(ip);
	}
	res.redirect("/");
});

// ==================== API (backward compat for /api with method in body) ====================

app.all("/api", async (req, res, next) => {
	var method = req.body.method || req.query.method;
	if (method) {
		req.params.method = method;
		var args = req.body.arguments || req.query.arguments;
		if (args && typeof args === "string") {
			try { req.body = JSON.parse(args); } catch (e) {}
		}
		return handle_api_call(req, res, next);
	}
	res.status(400).send({ failed: true, reason: "no_method" });
});

// ==================== START ====================

const PORT = process.env.PORT || options.port;
app.listen(PORT, () => {
	console.log(`\x1b[32mAdventure Land\x1b[0m listening on port ${PORT}`);
});

process.on("uncaughtException", function (err) {
	console.error(err.stack);
	console.error("Caught exception: " + err);
});

module.exports = app;
