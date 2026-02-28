var crypto = require("crypto");

// ==================== TIME UTILITIES ====================

function dsince(t, ref) {
	if (!ref) ref = new Date();
	if (!t) return 999999;
	return (ref - t) / (24 * 3600 * 1000);
}

function hsince(t, ref) {
	if (!ref) ref = new Date();
	if (!t) return 999999;
	return (ref - t) / (3600 * 1000);
}

function msince(t, ref) {
	if (!ref) ref = new Date();
	if (!t) return 999999;
	return (ref - t) / (60 * 1000);
}

function ssince(t, ref) {
	if (!ref) ref = new Date();
	if (!t) return 999999;
	return (ref - t) / 1000;
}

function mssince(t, ref) {
	if (!ref) ref = new Date();
	if (!t) return 999999999;
	return ref - t;
}

function h_since(t) {
	return hsince(t);
}
function m_since(t) {
	return msince(t);
}
function s_since(t) {
	return ssince(t);
}
function ms_since(t) {
	return mssince(t);
}

var really_old = new Date(1970, 0, 1);
var distant_future = new Date(2048, 0, 1);

// ==================== STRING UTILITIES ====================

function simplify_name(name) {
	return ("" + name).toLowerCase();
}

function is_string(s) {
	return typeof s === "string";
}

function is_array(a) {
	return Array.isArray(a);
}

function to_pretty_num(num) {
	if (!num) return 0;
	var prefix = "";
	if (num < 0) {
		prefix = "-";
		num = -num;
	}
	num = Math.floor(num);
	var pretty = "";
	while (num) {
		var current = num % 1000;
		if (!current) current = "000";
		else if (current < 10 && current != num) current = "00" + current;
		else if (current < 100 && current != num) current = "0" + current;
		if (!pretty) pretty = "" + current;
		else pretty = current + "," + pretty;
		num = Math.floor(num / 1000);
	}
	return prefix + pretty;
}

function to_filename(name) {
	var f = "";
	var allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz_-.+ ";
	for (var i = 0; i < ("" + name).length; i++) {
		if (allowed.indexOf(("" + name)[i]) !== -1) f += ("" + name)[i];
	}
	return f;
}

// ==================== GAME DATA UTILITIES ====================

function gf(element, name, def) {
	if (!element) return def;
	if (element.info && typeof element.info === "object" && name in element.info) return element.info[name];
	if (name in element) return element[name];
	return def;
}

function item_value(item) {
	var gold = items[item.name].g;
	if (item.q) gold *= item.q;
	var level = item.level || 0;
	if (items[item.name].upgrade) {
		if (Dev) level = Math.min(level, 12);
		gold *= [1, 1, 1.1, 1.4, 1.6, 2, 4, 8, 16, 50, 500, 800, 1600, 20000][level] || 1;
	}
	if (items[item.name].compound) {
		if (Dev) level = Math.min(level, 5);
		gold *= [1, 3, 9, 27, 81, 243, 800, 3600, 15000, 50000][level] || 1;
	}
	return gold;
}

// ==================== IP UTILITIES ====================

function get_ip(req) {
	var ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
	return ip;
}

function get_country(req) {
	var header = req.headers["cf-ipcountry"] || req.headers["x-appengine-country"];
	if (header) return header;
	try {
		var geoip = require("geoip-lite");
		var geo = geoip.lookup(get_ip(req));
		if (geo && geo.country) return geo.country;
	} catch (e) {}
	return "XX";
}

async function get_ip_info(ip_a) {
	if (typeof ip_a !== "string") ip_a = get_ip(ip_a);
	var info = await get("IP_" + ip_a);
	if (!info) {
		info = {
			_id: "IP_" + ip_a,
			created: new Date(),
			users: [],
			characters: [],
			random_id: "",
			referrer: "",
			exception: false,
			last_exception: null,
			info: { users: [], characters: [], metrics: {}, last_decay: new Date() },
		};
	}
	decay_ip_info(info);
	return info;
}

function decay_ip_info(ip) {
	var hours = hsince(ip.info.last_decay);
	if (hours > 12) {
		var r = hours / 24.0;
		for (var k in ip.info) {
			if (k.startsWith("limit_")) {
				var divisor = 1;
				if (k === "limit_signups") divisor = 1.2;
				ip.info[k] = (ip.info[k] || 0) - r / divisor;
				if (ip.info[k] < 0) ip.info[k] = 0;
			}
		}
		ip.info.last_decay = new Date();
	}
}

async function put_ip_info(ip, user, character) {
	if (user && ip.info.users.indexOf(get_id(user)) === -1) ip.info.users.push(get_id(user));
	if (character && ip.info.characters.indexOf(get_id(character)) === -1) ip.info.characters.push(get_id(character));
	if (ip.info.users.length > 100) ip.info.users = ip.info.users.slice(1);
	if (ip.info.characters.length > 100) ip.info.characters = ip.info.characters.slice(1);
	ip.users = ip.info.users;
	ip.characters = ip.info.characters;
	await safe_save(ip);
}

// ==================== EMAIL ====================

function purify_email(email) {
	email = email.replace(/ /g, "").replace(/\t/g, "").replace(/\n/g, "").replace(/\r/g, "");
	email = email.toLowerCase();
	var parts = email.split("@");
	if (parts.length !== 2) throw "invalid_email";
	var name = parts[0],
		domain = parts[1];
	if (domain.split(".").length < 2) throw "invalid_email";
	if (domain.split(".")[1].length < 2) throw "invalid_email";
	if (domain === "gmail.com" || domain === "googlemail.com") {
		domain = "gmail.com";
		name = name.replace(/\./g, "");
		email = name + "@" + domain;
	}
	return email;
}

async function send_email(domain, email, args) {
	if (!args) args = {};
	var title = args.title || "Default Title";
	var html = args.html || "Default HTML";
	var text = args.text || "An email from the game";
	console.log("send_email " + email + " - " + title);
	try {
		var { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
		var client = new SESClient({
			region: "us-east-1",
			credentials: {
				accessKeyId: keys.amazon_ses_user,
				secretAccessKey: keys.amazon_ses_key,
			},
		});
		await client.send(
			new SendEmailCommand({
				Source: "hello@adventure.land",
				Destination: { ToAddresses: [email] },
				Message: {
					Subject: { Data: title },
					Body: {
						Html: { Data: html },
						Text: { Data: text },
					},
				},
			}),
		);
	} catch (e) {
		console.error("send_email error", e);
	}
}

function send_verification_email(domain, user) {
	var url = domain.base_url + "/ev/" + get_id(user) + "/" + user.info.everification;
	var html = nunjucks.render("htmls/email.html", { purpose: "verification", url: url, domain: domain, user: user });
	send_email(domain, user.info.email, { html: html, title: "Welcome to Adventure Land! Verification Link + Early Game Suggestions Inside", text: "To Verify Your Email: " + url });
}

function send_password_reminder_email(domain, user) {
	var url = domain.base_url + "/reset/" + get_id(user) + "/" + user.info.password_key;
	var html = nunjucks.render("htmls/email.html", { purpose: "password", domain: domain, url: url });
	send_email(domain, user.info.email, { html: html, title: "Password Reminder from Adventure Land", text: "To reset your password, please visit: " + url });
}

// ==================== PASSWORD ====================

function hash_password(password, salt) {
	password = password.replace(/ /g, "");
	return crypto.pbkdf2Sync(Buffer.from(password, "utf8"), Buffer.from(salt, "utf8"), 160, 24, "sha1").toString("hex");
}

function get_new_auth(user) {
	var auth = random_string(20);
	user.info.auths = user.info.auths || [];
	user.info.last_auth = new Date();
	if (user.info.auths.length >= 200) user.info.auths = [];
	user.info.auths.push(auth);
	return auth;
}

// ==================== USER / AUTH ====================

function normalize_user_id(id) {
	if (id && !id.startsWith("US_")) return "US_" + id;
	return id;
}

async function get_user(req) {
	var ck = options.cookie_key;
	if (!req.cookies || !req.cookies[ck]) return null;
	try {
		var parts = req.cookies[ck].replace(/"/g, "").split("-");
		var id = normalize_user_id(parts[0]),
			auth = parts[1];
		var user = await get(id);
		if (user && user.info.auths && user.info.auths.includes(auth)) return user;
	} catch (e) {
		console.error("get_user error", e);
	}
	return null;
}

async function get_user_by_email(email) {
	return await db.collection("user").findOne({ email: email });
}

async function get_user_with_override(req, api_override, auth_override) {
	var auth_str = auth_override || (req.cookies && req.cookies[options.cookie_key]);
	if (!auth_str) return null;
	try {
		var parts = auth_str.replace(/"/g, "").split("-");
		var id = normalize_user_id(parts[0]),
			auth = parts[1];
		var user = await get(id);
		if (user && (api_override || (user.info.auths && user.info.auths.includes(auth)))) return user;
	} catch (e) {
		console.error("get_user_with_override error", e);
	}
	return null;
}

function get_user_id(req) {
	var ck = options.cookie_key;
	var id = req.cookies && req.cookies[ck] && req.cookies[ck].replace(/"/g, "").split("-")[0];
	return normalize_user_id(id);
}

// ==================== DOMAIN / CONFIG ====================

ip_to_subdomain = {
	"35.187.255.184": "asia1",
	"35.246.244.105": "eu1",
	"35.228.96.241": "eu2",
	"35.234.72.136": "eupvp",
	"35.184.37.35": "us1",
	"34.67.188.57": "us2",
	"34.75.5.124": "us3",
	"34.67.187.11": "uspvp",
	"195.201.181.245": "eud1",
	"158.69.23.127": "usd1",
	"195.201.105.60": "euw1",
};
HTTPS_MODE = true;
game_name = "Adventure Land";
base_domain = new URL(options.base_url).hostname;
secure_cookies = options.secure;
SALES = 4 + 5 + 388 + 5101 + 125 / 20;
extra_shells = 0;
server_regions = { EU: "EU", US: "US", ASIA: "ASIA" };
region_coords = { EU: [50, 8], US: [37, -100], ASIA: [1.3, 103.8] };
allowed_name_characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";

async function get_domain(req, user) {
	var domain = await get_domain_common(req);
	domain.v = domain.Version = Version;
	domain.electron = false;
	domain.local = {
		pixi: "4.8.2-roundpixels",
		howler: "2.0.13",
		jquery: "3.2.0",
		cm: "5.65.1",
		io: "4.2.0",
		pixi_display: "v4",
		pixi_layers: "0.1.7.2",
		pixi_filters: "2.6.0c0",
		pixi_lights: "2.0.3",
		interact: "1.2.6",
	};
	domain.title = game_name;
	domain.name = game_name;
	domain.scale = 2;
	domain.perfect_pixels = true;
	domain.fast_mode = true;
	domain.cash = true;
	domain.sales = SALES;
	domain.imagesets = imagesets;
	domain.ip_to_subdomain = ip_to_subdomain;
	domain.discord_url = "https://discord.gg/44yUVeU";

	if (Dev) {
		var url = req ? req.protocol + "://" + req.get("host") : options.base_url;
		domain.base_url = url;
		domain.pref_url = url;
		domain.server_ip = "0.0.0.0";
		domain.stripe_pkey = keys.stripe_test_pkey;
		domain.stripe_enabled = false;
		domain.https_mode = false;
		domain.domain = req ? req.get("host").split(":")[0] : base_domain;
	} else {
		var url = req ? req.protocol + "://" + req.get("host") : options.base_url;
		domain.base_url = url;
		domain.pref_url = url;
		domain.stripe_pkey = keys.stripe_pkey;
		domain.stripe_enabled = false;
		domain.https_mode = HTTPS_MODE;
		domain.domain = base_domain;
	}

	domain.Dev = Dev;
	domain.Local = Local;
	domain.Staging = Staging;
	domain.Prod = Prod;
	domain.cookie_key = options.cookie_key;

	domain.https = false;
	domain.secure_base_url = domain.base_url.replace("http://", "https://");
	domain.io_version = "4.2.0";
	domain.cm_version = "5.65.1";
	domain.jquery_version = "3.2.0";
	domain.howler_version = "2.0.13";
	domain.pixi_version = "4.8.2-roundpixels";
	domain.pixi_fversion = "";
	domain.pixi_display_version = "v4";
	domain.pixi_layers_version = "0.1.7.2";
	domain.pixi_lights_version = "2.0.3";
	domain.pixi_filters_version = "2.6.0c0";
	domain.interact_version = "1.2.6";
	domain.gcs_bucket = "2dimages";
	domain.gender_types = gender_types;
	domain.character_types = character_types;
	domain.screenshot = false;
	domain.recording_mode = false;
	domain.music_on = false;
	domain.sfx_on = false;
	domain.engine_mode = "";
	domain.d_lines = true;
	domain.sd_lines = true;
	domain.newcomer_ui = false;
	domain.new_attacks = true;
	domain.no_html = false;
	domain.is_bot = false;
	domain.is_cli = false;
	domain.no_graphics = false;
	domain.border_mode = false;
	domain.purchase_mode = true;
	domain.tutorial = true;
	domain.boost = 0;
	if (user && is_admin(user)) {
		domain.access_master = keys.ACCESS_MASTER;
	}
	domain.servers = [];
	domain.characters = [];
	domain.update_notes = update_notes;

	if (req) {
		try {
			domain.scale = parseInt(req.query.scale || req.cookies.scale || 2) || 2;
		} catch (e) {
			domain.scale = 2;
		}
		try {
			domain.times = parseInt(req.query.times || 0) || 0;
		} catch (e) {
			domain.times = 0;
		}
		domain.load_character = req.query.load || "";
		if (req.headers["user-agent"] && req.headers["user-agent"].indexOf("Electron") !== -1) {
			domain.electron = true;
			if (req.query.buildid && req.query.buildid.indexOf("win32") !== -1) domain.platform = "steam";
			if (req.query.buildid && req.query.buildid.indexOf("darwin") !== -1) domain.platform = "mac";
			if (req.cookies.music !== "off") domain.music_on = true;
			if (req.cookies.sfx !== "off") domain.sfx_on = true;
		} else {
			domain.platform = "web";
		}
		domain.url = req.originalUrl;
		domain.section = req.query.section;
		if (req.query.no_cache) domain.v = 100000 + Math.floor(Math.random() * 100000000);
		if (req.query.no_html) domain.no_html = req.query.no_html === "bot" ? "bot" : true;
		if (req.query.is_bot) domain.is_bot = true;
		if (req.query.is_cli) domain.is_cli = true;
		if (req.query.no_graphics || domain.no_html) {
			domain.no_graphics = true;
			domain.pixi_version = "fake";
			domain.pixi_fversion = "?v=" + Version;
		}
		if (req.query.borders || req.query.border_mode) domain.border_mode = true;
		if (req.cookies.perfect_pixels_off) domain.perfect_pixels = false;
		if (req.cookies.d_lines_off) domain.d_lines = false;
		if (req.cookies.no_tutorial) domain.tutorial = false;
		if (req.cookies.no_fast_mode) domain.fast_mode = false;
		if (req.query.engine || req.cookies.engine_mode) domain.engine_mode = req.query.engine || req.cookies.engine_mode;
		if (req.cookies.sd_lines_off) domain.sd_lines = false;
		if (req.cookies.pro_mode) domain.newcomer_ui = false;
		if (req.cookies.no_weapons) domain.new_attacks = false;
		if (req.cookies.manual_reload) domain.auto_reload = "off";
		else domain.auto_reload = "auto";
		if (req.protocol === "https") {
			domain.https = true;
		}
	}
	return domain;
}

// ==================== SERVERS ====================

var cached_servers = null;
async function get_servers(no_cache) {
	var servers = await db.collection("server").find({ online: true }).limit(500).toArray();
	post_process_query_results(servers);
	servers.sort(function (a, b) {
		var ra = (a.region === "EU" ? "1" : a.region === "US" ? "2" : "3") + a.name;
		var rb = (b.region === "EU" ? "1" : b.region === "US" ? "2" : "3") + b.name;
		return ra < rb ? -1 : ra > rb ? 1 : 0;
	});
	var result = [];
	servers.forEach(function (s) {
		if (options.servers[s.key]) result.push(s);
	});
	return result;
}

function select_server(req, user, servers) {
	if (!servers || !servers.length) return null;
	if (Dev) return servers[0];
	try {
		var geoip = require("geoip-lite");
		var ip = get_ip(req);
		var geo = geoip.lookup(ip);
		var latlon = (geo && geo.ll) || [0, 0];

		var u_server = "";
		var chars = gf(user, "characters", []);
		if (user && chars.length) {
			for (var i = 0; i < chars.length; i++) {
				if (chars[i].home) {
					u_server = chars[i].home;
					break;
				}
			}
		}

		var min_dist = 99999999999,
			the_server = null,
			max_rank = -99999;
		for (var i = 0; i < servers.length; i++) {
			var server = servers[i];
			var coords = region_coords[server.region] || [0, 0];
			var dist = Math.pow(coords[0] - latlon[0], 2) + Math.pow(coords[1] - latlon[1], 2);
			var rank = 100 + gf(server, "players", 0) / 10000.0;
			if (gf(server, "players", 0) > 50) rank = 10 - gf(server, "players", 0) / 10000.0;
			if (gf(server, "pvp")) {
				rank = 1;
				dist += 19999999999;
			}
			if (server.gameplay === "test") {
				rank = -1000;
				dist += 29999999999;
			}
			if (server.region + server.name === u_server) {
				dist = -1;
				rank = 99999999;
			}
			if (dist < min_dist || (dist === min_dist && rank > max_rank)) {
				min_dist = dist;
				the_server = server;
				max_rank = rank;
			}
		}
		if (the_server) return the_server;
	} catch (e) {
		console.error("select_server error", e);
	}
	return servers[0];
}

function servers_to_client(domain, servers_data) {
	var servers = [];
	for (var i = 0; i < servers_data.length; i++) {
		var server = servers_data[i];
		servers.push({
			name: server.name,
			region: server.region,
			players: gf(server, "players", 0),
			key: get_id(server),
			address: server.address,
			path: server.path,
		});
	}
	return servers;
}

// ==================== CHARACTERS ====================

async function get_characters(user) {
	if (!user) return [];
	if (is_string(user)) user = await get(user);
	if (!user || !user._id) return [];
	// Fetch in user's sort order (from user.info.characters) like the Python version
	var char_list = (user.info && user.info.characters) || [];
	if (char_list.length) {
		var characters = [];
		var rpc = {};
		for (var i = 0; i < char_list.length; i++) {
			rpc[i] = get(char_list[i].id);
		}
		for (var i = 0; i < char_list.length; i++) {
			var c = await rpc[i];
			if (c) characters.push(c);
		}
		return characters;
	}
	// Fallback: query DB directly (new users with no characters list yet)
	return await db.collection("character").find({ owner: user._id }).limit(40).toArray();
}

async function get_character(name, phrase_check) {
	if (!name) return null;
	var simplified = simplify_name(name);
	if (phrase_check) {
		var mark = await get("MK_character-" + simplified);
		if (mark && mark.owner) {
			var character = await get(mark.owner);
			if (character) return character;
		}
	}
	return await db.collection("character").findOne({ name: simplified });
}

async function get_owner(name) {
	var char = await get_character(name);
	if (char) return await get(char.owner);
	return null;
}

function character_to_dict(character) {
	var data = {
		id: get_id(character),
		name: character.info.name,
		level: character.level,
		type: character.type,
		online: 0,
	};
	if (character.online) {
		data.online = mssince(character.last_online);
		data.server = character.server;
		data.secret = gf(character, "secret", "12");
	}
	if (gf(character, "rip")) data.rip = character.info.rip;
	data.skin = character.info.skin;
	data.cx = gf(character, "cx", {});
	data["in"] = gf(character, "in", character.info.map);
	data.map = character.info.map;
	data.x = character.info.x;
	data.y = character.info.y;
	if (gf(character, "p") && character.info.p.home) data.home = character.info.p.home;
	return data;
}

function characters_to_client(characters_data) {
	var characters = [];
	for (var i = 0; i < characters_data.length; i++) {
		characters.push(character_to_dict(characters_data[i]));
	}
	characters.sort(function (a, b) {
		return (b.online ? 1 : 0) - (a.online ? 1 : 0);
	});
	return characters;
}

function character_to_info(character, user, ip, guild) {
	var drm = false;
	var drm_fail = false;
	if (user && user.created > new Date(2019, 1, 1) && !gf(user, "legacy_override")) drm = true;
	if (gf(user, "drm_fail_pid", "not") === character.pid) drm_fail = true;
	var info = {
		id: get_id(character),
		name: character.info.name,
		friends: character.friends,
		level: character.level,
		gold: character.info.gold,
		type: character.type,
		xp: character.xp,
		items: character.info.items,
		stats: character.info.stats,
		slots: gf(character, "slots", {}),
		skin: character.info.skin,
		cx: gf(character, "cx", []),
		platform: character.platform,
		pid: character.pid || (user && user.pid),
		drm: drm,
		drm_fail: drm_fail,
		x: character.info.x,
		y: character.info.y,
		map: character.info.map,
		owner: character.owner,
		private: character.private,
		created: character.created ? character.created.getTime() : 0,
		hp: gf(character, "hp", 0),
		mp: gf(character, "mp", 0),
		afk: gf(character, "afk", 0),
		s: gf(character, "s", {}),
		c: gf(character, "c", {}),
		q: gf(character, "q", {}),
		rip: gf(character, "rip", 0),
		p: gf(character, "p", { dt: {} }) || { dt: {} },
	};
	if (guild) info.guild = guild_to_info(guild);
	if (ip && ip.exception) info.ipx = ip.info.limit;
	if (user) {
		info.cash = user.cash;
		info.verified = gf(user, "verified", 0);
	}
	return info;
}

function guild_to_info(guild) {
	return {
		id: get_id(guild),
		name: guild.name,
		short: guild.short,
	};
}

function update_character(character, data, owner) {
	character.info.x = data.x;
	character.info.y = data.y;
	character.info.s = data.s;
	character.info.q = data.q || {};
	character.info.map = data.map;
	character.info["in"] = data["in"];
	character.xp = parseInt(data.xp || 0);
	character.level = parseInt(data.level);
	character.info.hp = data.hp;
	character.info.mp = data.mp;
	character.info.gold = data.gold;
	character.info.items = data.items;
	character.info.slots = data.slots;
	character.info.rip = data.rip;
	if (data.p) character.info.p = data.p;
	character.info.skin = data.skin;
	character.info.cx = data.cx || {};
	character.info.afk = data.afk;
	character.private = data.private;
	character.info.owner_name = owner.name;
}

function update_pids(character, data, owner) {
	var fresh = false,
		platform = "web",
		pid = "";
	var steam_id = data.p && data.p.steam_id;
	var mas_auth_id = data.p && data.p.mas_auth_id;
	if (data.p && data.p.platform === "steam" && steam_id) {
		fresh = true;
		platform = "steam";
		pid = steam_id;
	}
	if (data.p && data.p.platform === "mas" && mas_auth_id) {
		fresh = true;
		platform = "mas";
		pid = mas_auth_id;
	}
	if (steam_id) {
		character.platform = "steam";
		character.pid = steam_id;
	} else if (mas_auth_id) {
		character.platform = "mas";
		character.pid = mas_auth_id;
	}
	// Platform sync to owner handled within transactions where needed
}

function update_user_data(user, data) {
	user.info.gold = data.gold;
	user.info.rewards = data.rewards || [];
	user.info.unlocked = data.unlocked || {};
	user.info.items0 = data.items0;
	user.info.items1 = data.items1;
	user.info.last_sync = new Date();
	for (var i = 2; i < 48; i++) {
		user.info["items" + i] = data["items" + i] || false;
	}
}

function user_to_server(user) {
	var info = {
		gold: gf(user, "gold", 1000),
		rewards: gf(user, "rewards", []),
		unlocked: gf(user, "unlocked", {}),
		items0: gf(user, "items0", []),
		items1: gf(user, "items1", []),
	};
	for (var i = 2; i < 48; i++) {
		info["items" + i] = gf(user, "items" + i, false);
	}
	return info;
}

function is_in_game(character) {
	return character.server && hsince(character.last_sync) <= 4;
}

function arr_arr_same(ar1, ar2) {
	if (!ar1 || !ar2) return false;
	if (ar1.length !== ar2.length) return false;
	var d = {};
	for (var i = 0; i < ar1.length; i++) d[ar1[i]] = 1;
	for (var i = 0; i < ar2.length; i++) {
		if (!d[ar2[i]]) return false;
	}
	return true;
}

// ==================== USER DATA (InfoElement) ====================

async function get_user_data(user_id) {
	if (user_id && user_id._id) user_id = user_id._id;
	var data = await get("IE_userdata-" + user_id);
	data = process_user_data(user_id, data);
	return data;
}

function process_user_data(user_id, data) {
	if (user_id && user_id._id) user_id = user_id._id;
	if (!data) {
		data = {
			_id: "IE_userdata-" + user_id,
			created: new Date(),
			info: { completed_tasks: [], tutorial_step: 0 },
		};
	}
	if (!data.info.completed_tasks) data.info.completed_tasks = [];
	if (data.info.tutorial_step === undefined) data.info.tutorial_step = 0;
	calculate_tutorial_step(data);
	return data;
}

function calculate_tutorial_step(user_data) {
	var marked = {};
	for (var i = 0; i < user_data.info.completed_tasks.length; i++) {
		marked[user_data.info.completed_tasks[i]] = true;
	}
	for (var i = 0; i < docs.tutorial.length; i++) {
		var done = true;
		for (var j = 0; j < docs.tutorial[i].tasks.length; j++) {
			if (!marked[docs.tutorial[i].tasks[j]]) done = false;
		}
		if (!done && user_data.info.tutorial_step > i) {
			user_data.info.tutorial_step = i;
			break;
		}
	}
}

function data_to_tutorial(user_data) {
	try {
		if (user_data) {
			if (user_data.info.tutorial_step >= docs.tutorial.length) return { step: user_data.info.tutorial_step, completed: [], finished: true, task: false, progress: 100 };
			var arr = [],
				task = false,
				percent = 100;
			var tasks = docs.tutorial[user_data.info.tutorial_step].tasks;
			for (var i = 0; i < tasks.length; i++) {
				if (user_data.info.completed_tasks.indexOf(tasks[i]) !== -1) arr.push(tasks[i]);
				else if (!task) task = tasks[i];
			}
			if (task) percent = Math.round((100 * arr.length) / tasks.length);
			return { step: user_data.info.tutorial_step, task: task, completed: arr, progress: percent };
		}
	} catch (e) {
		console.error("data_to_tutorial error", e);
	}
	return { step: 0, completed: [] };
}

// ==================== SIGNUPTH / CHARACTERTH ====================

async function get_signupth() {
	var main = await get("IE_main");
	if (!main) return 1;
	return gf(main, "signupth", 1);
}

async function increase_signupth() {
	var main = await get("IE_main");
	if (!main) {
		main = { _id: "IE_main", created: new Date(), info: { signupth: 2 } };
	} else {
		main.info.signupth = gf(main, "signupth", 1) + 1;
	}
	try {
		await safe_save(main);
	} catch (e) {
		console.error("increase_signupth error", e);
	}
}

async function get_characterth() {
	var main = await get("IE_main");
	if (!main) return 1;
	return gf(main, "characterth", 1);
}

async function increase_characterth() {
	var main = await get("IE_main");
	if (!main) {
		main = { _id: "IE_main", created: new Date(), info: { characterth: 2 } };
	} else {
		main.info.characterth = gf(main, "characterth", 1) + 1;
	}
	try {
		await safe_save(main);
	} catch (e) {
		console.error("increase_characterth error", e);
	}
}

// ==================== MARK PHRASES ====================

async function mark_phrase(owner, type, phrase) {
	var id = "MK_" + type + "-" + phrase;
	await save({
		_id: id,
		type: type,
		phrase: "" + phrase,
		owner: is_string(owner) ? owner : get_id(owner),
		created: new Date(),
	});
}

async function delete_phrase_mark(type, phrase) {
	try {
		await db.collection("mark").deleteOne({ _id: "MK_" + type + "-" + phrase });
	} catch (e) {
		console.error("delete_phrase_mark error", e);
	}
}

// ==================== REFERRER REWARDS ====================

async function reward_referrer_logic(user) {
	if (!user.referrer || !user.pid) return;
	if (user.platform !== "steam" && user.platform !== "mas") return;
	if (gf(user, "reward")) return;

	// Transaction: mark reward on user to prevent double reward
	var R = await tx(
		async () => {
			var entity = await tx_get(A.user);
			if (gf(entity, "reward")) ex("already_rewarded");
			entity.info.reward = true;
			await tx_save(entity);
		},
		{ user: user },
	);
	if (R.failed) return;

	// Get referrer user
	var referrer = await get(user.referrer);
	if (!referrer) {
		console.error("reward_referrer: referrer not found: " + user.referrer);
		return;
	}

	// Cheat prevention: check if this PID already triggered a reward
	var rrewardmark = await get("IE_rrewardmark-" + user.pid);
	if (rrewardmark) {
		console.error("REFERRER CHEAT DETECTED: " + get_id(user) + " pid: " + user.pid);
		return;
	}

	// Log "referred" event on the referrer
	add_event(referrer, "referred", ["referrer"], {
		rowner: get_id(referrer),
		info: { message: referrer.name + " referred " + user.name + " " + gf(user, "email", ""), id: get_id(user) },
	});

	// Transaction: add 200 shells to referrer, increment referral counters
	var R2 = await tx(
		async () => {
			var entity = await tx_get(A.referrer);
			entity.info.referred = gf(entity, "referred", 0) + 1;
			entity.info.referrer_events = gf(entity, "referrer_events", 0) + 1;
			entity.info.rcash = gf(entity, "rcash", 0) + 200;
			entity.cash += 200;
			await tx_save(entity);
		},
		{ referrer: referrer },
	);
	if (R2.failed) {
		console.error("reward_referrer: add_cash transaction failed");
		return;
	}

	// Create Friend Token mail for the referrer
	var referred_name = user.name || gf(user, "email", "someone");
	try {
		await insert({
			_id: "ML_" + get_id(user) + "-rewards-" + get_id(referrer),
			created: new Date(),
			read: false,
			item: true,
			taken: false,
			fro: "mainframe",
			to: referrer.name,
			type: "system",
			owner: [get_id(referrer)],
			info: {
				subject: "A Friend Token!",
				message: "For inviting " + referred_name + " to Adventure Land!",
				sender: "!",
				receiver: get_id(referrer),
				item: JSON.stringify({ name: "friendtoken", q: 1 }),
			},
			blobs: ["info"],
		});
		// Update referrer's unread mail count
		try {
			var ud = await get_user_data(referrer);
			var unread = await db
				.collection("mail")
				.find({ owner: get_id(referrer), read: false })
				.limit(100)
				.toArray();
			ud.info.mail = unread.length;
			await safe_save(ud);
		} catch (e) {
			console.error("reward_referrer mail ud error", e);
		}
	} catch (e) {
		console.error("reward_referrer mail error", e);
	}

	// Create rrewardmark to prevent re-reward for this PID
	try {
		await insert({
			_id: "IE_rrewardmark-" + user.pid,
			created: new Date(),
			type: "infoelement",
			info: {},
		});
	} catch (e) {
		console.error("reward_referrer rrewardmark error", e);
	}

	// Log "referrer_reward" event
	add_event(referrer, "referrer_reward", ["cashflow", "referrer"], {
		info: { message: "Referrer: " + referrer.name + " received 200 reward shells from " + referred_name + "[" + get_id(user) + "]", source: get_id(user) },
	});

	// Update referrer's characters with new shell count
	update_characters(referrer, null, null, 200).catch(console.error);
}

// ==================== EVENTS ====================

async function add_event(element, type, tags, args) {
	if (!args) args = {};
	if (tags.indexOf(type) === -1) tags.push(type);
	var event = {
		_id: "EV_" + random_string(29),
		created: new Date(),
		type: type,
		tag: tags,
		info: args.info || {},
	};
	if (args.rowner) event.rowner = args.rowner;
	if (args.req) {
		event.info.ip = get_ip(args.req);
		event.info.country = get_country(args.req);
	}
	if (element) {
		event.item_id = get_id(element);
		if (element.region) event.info.e_name = element.region + " " + element.name;
		else if (element.name) event.info.e_name = element.name;
	}
	if (args.backup && element) await backup_entity(element);
	try {
		await insert(event);
	} catch (e) {
		console.error("add_event error", e);
	}
	return event;
}

// ==================== SERVER COMMUNICATION ====================

function server_url(server, api_method) {
	var protocol = options.base_url.startsWith("https") ? "https" : "http";
	return protocol + "://" + server.address + options.servers[server.key].api_path + api_method;
}

async function server_eval(server, code, data) {
	if (!data) data = {};
	try {
		//console.log(server_url(server, "eval"));
		var response = await fetch(server_url(server, "eval"), {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				spass: keys.ACCESS_MASTER,
				code: code,
				data: JSON.stringify(data),
			}).toString(),
		});
		var response = await response.text();
		//console.log(response);
		return JSON.parse(response);
	} catch (e) {
		console.error("server_eval error", e);
		return null;
	}
}

async function server_eval_safe(server, code, data) {
	try {
		return await server_eval(server, code, data);
	} catch (e) {
		console.error("server_eval_safe error", e);
		return null;
	}
}

async function servers_eval(code, data) {
	var servers = await get_servers();
	for (var i = 0; i < servers.length; i++) {
		if (options.servers[servers[i].key]) await server_eval_safe(servers[i], code, data);
	}
}

async function character_eval(character, code, data) {
	if (!data) data = {};
	if (character.server) {
		var server = await get(character.server);
		if (server) await server_eval_safe(server, "var player=players[name_to_id['" + character.info.name + "']]; if(player) { " + code + "; }", data);
	}
}

async function update_characters(user, reason, name, shells) {
	var characters = await db
		.collection("character")
		.find({ online: true, owner: get_id(user) })
		.toArray();
	for (var i = 0; i < characters.length; i++) {
		var character = characters[i];
		if (character.server) {
			try {
				var server = await get(character.server);
				if (!server) continue;
				if (!reason) {
					await fetch(server_url(server, "cupdate"), {
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: new URLSearchParams({
							spass: keys.ACCESS_MASTER,
							cash: user.cash,
							id: character.info.name,
							ncash: shells || 0,
						}).toString(),
					});
				} else if (reason === "friends" || reason === "not_friends") {
					await db.collection("character").updateOne({ _id: character._id }, { $set: { friends: user.friends } });
					var event_name = reason === "friends" ? "new_friend" : "lost_friend";
					await fetch(server_url(server, event_name), {
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: new URLSearchParams({
							spass: keys.ACCESS_MASTER,
							name: name,
							friends: JSON.stringify(user.friends),
							id: character.info.name,
						}).toString(),
					});
				}
			} catch (e) {
				console.error("update_characters error", e);
			}
		}
	}
}

async function notify_friends(character, server_name) {
	var server_list = {};
	var servers = await get_servers();
	var online = await db.collection("character").find({ friends: character.owner, online: true }).toArray();
	for (var i = 0; i < online.length; i++) {
		var friend = online[i];
		if (!friend.server) continue;
		if (!server_list[friend.server]) server_list[friend.server] = [];
		server_list[friend.server].push(friend.info.name);
	}
	for (var i = 0; i < servers.length; i++) {
		var server = servers[i];
		if (server_list[get_id(server)]) {
			await server_eval_safe(server, "notify_friends_emit(data)", { list: server_list[get_id(server)], name: character.info.name, server: server_name });
		}
	}
}

// ==================== BLOCK ACCOUNT ====================

async function block_account(name, days, reason, toggle) {
	var character = await get_character(name);
	if (!character) return "no character";
	var owner = await get(character.owner);
	if (!owner) return "no owner";
	if (toggle && gf(owner, "blocked_until") && owner.info.blocked_until > new Date()) days = -1;
	if (days <= 0) {
		owner.info.blocked_until = really_old;
		owner.banned = false;
		await save(owner);
		return "un-blocked " + get_id(owner);
	} else {
		owner.info.blocked_until = new Date(Date.now() + days * 24 * 3600 * 1000);
		owner.info.blocked_reason = reason;
		owner.banned = true;
		await save(owner);
		var servers = await get_servers();
		for (var i = 0; i < servers.length; i++) {
			await server_eval_safe(
				servers[i],
				"for(var id in players) { if(players[id].owner=='" + get_id(owner) + "') { players[id].socket.emit('disconnect_reason','blocked'); players[id].socket.disconnect(); } }",
			);
		}
		return "blocked " + get_id(owner) + " for " + days + " days";
	}
}

// ==================== RENDER ====================

function shtml(path, vars) {
	return nunjucks.render(path, vars || {});
}

async function render_selection(req, res, user, domain, level, server) {
	var servers = await get_servers();
	if (!server) server = select_server(req, user, servers);
	var total = 0,
		characters = [],
		data = null;
	for (var i = 0; i < servers.length; i++) total += gf(servers[i], "players", 0);
	if (user) {
		characters = await get_characters(user);
		domain.characters = characters_to_client(characters);
		data = await get_user_data(user);
	}
	domain.servers = servers_to_client(domain, servers);
	if (domain.is_cli && (!user || !user.cli_time || user.cli_time < new Date()) && (level || 80) >= 70) {
		domain.is_cli = false;
		domain.harakiri = true;
	}
	res.status(200).send(
		nunjucks.render("htmls/index.html", {
			domain: domain,
			user: user,
			user_data: data,
			server: server,
			servers: servers,
			total: total,
			characters: characters,
		}),
	);
}

async function selection_info(req, user, domain) {
	var servers = await get_servers();
	var server = select_server(req, user, servers);
	var characters = await get_characters(user);
	return {
		type: "content",
		html: nunjucks.render("htmls/contents/selection.html", {
			user: user,
			domain: domain,
			server: server,
			servers: servers,
			characters: characters,
		}),
	};
}

// ==================== COOKIE ====================

function set_cookie(res, name, value, domain_host) {
	res.cookie(name, "" + value, {
		maxAge: 86400 * 365 * 5 * 1000,
		path: "/",
		domain: "." + domain_host,
		secure: secure_cookies,
	});
}

function delete_cookie(res, name, domain_host) {
	res.clearCookie(name, { path: "/", domain: "." + domain_host });
}

// ==================== POST GET INIT ====================

function post_get_init_user(user) {
	if (!user.info) user.info = {};
	if (!user.info.characters) user.info.characters = [];
	if (!user.info.auths) user.info.auths = [];
	if (!user.friends) user.friends = [];
}

function post_get_init_character(character) {
	if (!character.info) character.info = {};
	if (!character.friends) character.friends = [];
}

// ==================== ENFORCE LIMITATIONS ====================

async function enforce_limitations() {
	// Port from Python - multi-accounting detection
	// Runs from check_servers cron
	var servers = await get_servers();
	var players = [],
		ips = {},
		mips = {},
		owners = {},
		mowners = {},
		ipx = {};

	for (var si = 0; si < servers.length; si++) {
		var server = servers[si];
		if (server.gameplay !== "normal") continue;
		try {
			var splayers = await server_eval(
				server,
				"var list=[]; for(var id in players) { var player=players[id]; list.push({owner:player.owner,name:player.name,ip:get_ip(player),type:player.type,bot:player.bot||'',free:player.p.free||player.s.licenced||player.role=='gm',ipx:player.ipx||1,temp_auth:player.temp_auth||'',auth_id:player.auth_id||''}); }; output=list;",
			);
			if (!splayers) continue;
			for (var i = 0; i < splayers.length; i++) {
				splayers[i].pvp = gf(server, "pvp");
				players.push(splayers[i]);
			}
			server.players_list = splayers;
		} catch (e) {
			console.error("enforce_limitations server error", e);
		}
	}

	for (var i = 0; i < players.length; i++) {
		var player = players[i];
		if (player.free) continue;
		if (player.auth_id) {
			if (player.type !== "merchant") ips[player.ip] = (ips[player.ip] || 0) + 1;
			else mips[player.ip] = (mips[player.ip] || 0) + 1;
			player.ip = player.auth_id;
			player.ipx = 1;
		}
		if (player.temp_auth) {
			if (player.type !== "merchant") ips[player.ip] = (ips[player.ip] || 0) + 1;
			else mips[player.ip] = (mips[player.ip] || 0) + 1;
			player.ip = player.owner;
			player.ipx = 1;
		}
		ipx[player.ip] = Math.max(ipx[player.ip] || 0, player.ipx);
		if (player.type === "merchant") {
			mowners[player.owner] = (mowners[player.owner] || 0) + 1;
			mips[player.ip] = (mips[player.ip] || 0) + 1;
		} else {
			owners[player.owner] = (owners[player.owner] || 0) + 1;
			ips[player.ip] = (ips[player.ip] || 0) + 1;
		}
	}

	for (var si = 0; si < servers.length; si++) {
		var server = servers[si];
		if (server.gameplay !== "normal" || !server.players_list) continue;
		var to_disconnect = [];
		for (var i = 0; i < server.players_list.length; i++) {
			var player = server.players_list[i];
			if (player.free) continue;
			if (player.type === "merchant" && (mips[player.ip] > 1 || mowners[player.owner] > 1) && to_disconnect.indexOf(player.name) === -1) {
				to_disconnect.push(player.name);
				continue;
			}
			if (player.type !== "merchant" && (ips[player.ip] > 3 * (ipx[player.ip] || 1) || owners[player.owner] > 3) && to_disconnect.indexOf(player.name) === -1) {
				to_disconnect.push(player.name);
				continue;
			}
		}
		if (to_disconnect.length) {
			await server_eval(
				server,
				JSON.stringify(to_disconnect) + ".forEach(function(name){ var player=get_player(name); if(!player) return; player.socket.emit('disconnect_reason','limits'); player.socket.disconnect(); });",
			);
		}
		delete server.players_list;
	}
	setTimeout(enforce_limitations, 6000 + Math.random() * 10000);
}

// ==================== SIMPLIFY ITEM ====================

function simplify_item(item) {
	var x = item;
	if (typeof x === "string") {
		x = JSON.parse(x);
		["grace", "gf", "list", "o", "oo", "src"].forEach(function (p) {
			if (x[p] !== undefined) delete x[p];
		});
		return JSON.stringify(x);
	} else {
		["grace", "gf", "list", "o", "oo", "src"].forEach(function (p) {
			if (x[p] !== undefined) delete x[p];
		});
		return x;
	}
}

// ==================== PRETTY TIME ====================

function pretty_timeleft(t) {
	if (!t) return "unknown";
	var left = "";
	var diff = t - new Date();
	if (diff < 0) return "expired";
	var days = Math.floor(diff / (24 * 3600 * 1000));
	var minutes = Math.floor((diff % (24 * 3600 * 1000)) / (60 * 1000));
	if (days) left = days + " days";
	if (minutes > 60) left = left + " " + Math.floor(minutes / 60) + " hours";
	left = left + " " + (minutes % 60) + " minutes";
	return left.trim();
}

// ==================== SECURITY ====================

function security_threat(req, domain) {
	var referer = req.headers.referer || req.headers.origin || "";
	if (!referer) return false;
	try {
		var url = new URL(referer);
		if (!url.hostname.endsWith(domain.domain)) return true;
	} catch (e) {}
	return false;
}

// ==================== GET SERVER ====================

async function get_server(req) {
	var auth = req.query.server_auth || req.body.server_auth;
	if (auth) {
		var parts = auth.split("-");
		var id = parts[0],
			auth_key = parts[1];
		var server = await get("SR_" + id);
		if (server && gf(server, "auth") === auth_key) return server;
	}
	return null;
}

// ==================== MAP PROCESSING ====================

function process_map(map) {
	var data = map.info.data;
	var marked = {},
		last = 0,
		current = 0,
		new_tiles = [];
	var min_x = 900,
		min_y = 900,
		max_x = -900,
		max_y = -900;
	var x_lines = [],
		y_lines = [];
	if (data.x_lines) data.x_lines.sort();
	if (data.y_lines) data.y_lines.sort();
	if (data.default !== undefined) marked[data.default] = true;
	(data.animations || []).forEach(function (a) {
		marked[a[0]] = true;
	});
	(data.lights || []).forEach(function (a) {
		marked[a[0]] = true;
	});
	(data.nights || []).forEach(function (a) {
		marked[a[0]] = true;
	});
	(data.groups || []).forEach(function (group) {
		group.forEach(function (p) {
			if (p.length === 5 && p[3] === p[1] && p[4] === p[2]) p.splice(3, 2);
			marked[p[0]] = true;
		});
	});
	(data.x_lines || []).forEach(function (line) {
		if (line[1] !== line[2]) x_lines.push(line);
	});
	data.x_lines = x_lines;
	(data.y_lines || []).forEach(function (line) {
		if (line[1] !== line[2]) y_lines.push(line);
	});
	data.y_lines = y_lines;
	(data.placements || []).forEach(function (p) {
		marked[p[0]] = true;
		var tile = data.tiles[p[0]];
		if (p.length === 5 && p[3] === p[1] && p[4] === p[2]) p.splice(3, 2);
		var width, height;
		if (Array.isArray(tile[3])) {
			width = tile[3][0];
			height = tile[3][1];
		} else {
			width = height = tile[3];
		}
		if (p[1] < min_x) min_x = p[1];
		if (p[2] < min_y) min_y = p[2];
		if (p.length === 5) {
			if (p[3] + width > max_x) max_x = p[3] + width;
			if (p[4] + height > max_y) max_y = p[4] + height;
		} else {
			if (p[1] + width > max_x) max_x = p[1] + width;
			if (p[2] + height > max_y) max_y = p[2] + height;
		}
	});
	(data.tiles || []).forEach(function (tile, i) {
		if (!(i in marked)) {
			// unused
		} else {
			marked[i] = last;
			last++;
			new_tiles.push(tile);
		}
		current++;
	});
	data.tiles = new_tiles;
	if (data.default !== undefined) data.default = marked[data.default];
	(data.animations || []).forEach(function (a) {
		a[0] = marked[a[0]];
	});
	(data.lights || []).forEach(function (a) {
		a[0] = marked[a[0]];
	});
	(data.nights || []).forEach(function (a) {
		a[0] = marked[a[0]];
	});
	(data.groups || []).forEach(function (group) {
		group.forEach(function (p) {
			p[0] = marked[p[0]];
		});
	});
	(data.placements || []).forEach(function (p) {
		p[0] = marked[p[0]];
	});
	if (min_x > max_x) {
		min_x = -10;
		max_x = 10;
		min_y = -10;
		max_y = 10;
	}
	data.min_x = min_x;
	data.min_y = min_y;
	data.max_x = max_x;
	data.max_y = max_y;
}
