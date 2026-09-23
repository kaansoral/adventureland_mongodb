// api.js - Adventure Land API endpoints
// Ported from Python api.py to Node.js/MongoDB REF pattern

// ==================== HELPER FUNCTIONS ====================

function sint(x) {
	try {
		return parseInt(x) || 0;
	} catch (e) {
		return 0;
	}
}

function can_create_character_check(user, ip) {
	if (user.pid) user.info.slots = Math.max(gf(user, "slots", 8), 8);
	if (ip && gf(ip, "limit_create_character", 0) > 12) return { can: false, reason: "ip" };
	if (gf(user, "characters", []).length >= 18) return { can: false, reason: "abs" };
	if (gf(user, "characters", []).length >= gf(user, "slots", 5)) {
		if (user.cash >= 200) return { can: true, paid: true };
		return { can: false, reason: "limit" };
	}
	return { can: true };
}

function is_name_allowed(name) {
	if (name.length < 4) return false;
	if (name.length > 12) return false;
	for (var i = 0; i < name.length; i++) {
		if (allowed_name_characters.indexOf(name[i]) === -1) return false;
	}
	return true;
}

function is_name_xallowed(name) {
	if (name.length < 1) return false;
	if (name.length > 12) return false;
	for (var i = 0; i < name.length; i++) {
		if (allowed_name_characters.indexOf(name[i]) === -1) return false;
	}
	return true;
}

function get_stats(characters) {
	var stats = {};
	for (var i = 0; i < characters.length; i++) {
		var c = characters[i];
		stats[get_id(c)] = { level: c.level, type: c.type, xp: c.xp };
	}
	return stats;
}

async function load_geometry() {
	var geometry = {};
	for (var name in maps) {
		var key = maps[name].key;
		if (maps[name].ignore) continue;
		var map = await get("MP_" + key);
		if (map) geometry[name] = map.info.data;
	}
	return geometry;
}

function get_referrer(req, ip) {
	if (ip && ip.referrer) {
		try {
			return get(normalize_user_id(ip.referrer));
		} catch (e) {}
	}
	return null;
}

// ==================== AUTH / ACCOUNT ====================

function load_bank_api(args) {
	var bank = user_to_server(args.user),
		packs = {};
	for (var i = 0; i < 48; i++) {
		var pack = "items" + i;
		if (Array.isArray(bank[pack])) packs[pack] = bank[pack].slice(0, 42);
	}
	return { success: true, gold: bank.gold, packs: packs };
}

// steam_signup is trusted server context from the verified OpenID route, never API input.
async function signup_or_login_api(args, steam_signup) {
	var domain = await get_domain(args.req),
		email = args.email,
		password = args.password,
		existing = await get_user_by_email(email);

	if (existing && existing.server && msince(existing.last_online) < 15 && msince(gf(existing, "last_auth", really_old)) < 15) return { failed: true, reason: "cant_login_inside_bank" };

	if (steam_signup && (!args.only_signup || args.only_login || existing)) return { failed: true, reason: "already_signed_up" };
	if (!domain.electron && !domain.tauri && !args.only_login && !Dev && !steam_signup) return { failed: true, reason: "cant_signup_on_web" };

	if (existing && !args.only_signup) {
		if (existing.password == hash_password(password, gf(existing, "salt", "5"))) {
			var R = await tx(
				async () => {
					R.user = await tx_get(A.user);
					if (A.explicit_language || !localization.initialized(R.user)) {
						R.user.language = A.language;
						R.user.language_set = A.language_set;
					}
					R.auth = get_new_auth(R.user);
					await tx_save(R.user);
				},
				Object.assign({ user: existing, explicit_language: localization.explicit_cookie(args.req) }, localization.preference_fields(args.req, existing)),
			);
			if (R.failed) return { failed: true, reason: R.reason || "login_failed" };
			localization.bind_user(args.req, R.user);
			domain = await get_domain(args.req, R.user);
			set_cookie(args.res, options.cookie_key, get_id(R.user) + "-" + R.auth, domain.domain);
			if (args.mobile) {
				args.res.infs.push({ type: "refresh" });
				return { success: true, user: get_id(R.user), auth: R.auth, language: domain.language };
			}
			args.res.infs.push({ type: "message", message: phrase_html("server.api.logged_in") });
			args.res.infs.push(await selection_info(args.req, R.user, domain));
			return { success: true, user: get_id(R.user), auth: R.auth, language: domain.language };
		}
		args.res.infs.push({ type: "eval", code: "$('.passwordui').show()" });
		return { failed: true, reason: "wrong_password" };
	}

	if (!email) return { failed: true, reason: "no_email" };
	if (args.only_login) return { failed: true, reason: "email_not_found" };
	if (args.only_signup && existing) return { failed: true, reason: "already_signed_up" };

	var signupth = await get_signupth();
	var ip = await get_ip_info(args.req);
	var referrer = await get_referrer(args.req, ip);

	if (gf(ip, "limit_signups", 0) >= 3) return { failed: true, reason: "too_many_signups_from_ip_wait" };

	var R = await tx(
		async () => {
			if (await tx_get("MK_email-" + A.email)) ex("email_exists");
			if (A.steam_signup && await tx_get("MK_steam-signup-" + A.steam_signup.id)) ex("steam_signup_used");
			var salt = random_string(20);
			var hpassword = hash_password(A.password, salt);
			R.user = {
				_id: "US_" + random_string(29),
				created: new Date(),
				updated: new Date(),
				a_rand: a_rand("user"),
				name: "#" + A.signupth,
				email: [A.email],
				password: hpassword,
				credits: 0,
				banned: false,
				referrer: (A.referrer && get_id(A.referrer)) || "",
				timezone: 0,
				cash: 0,
				worth: 0,
				language: A.language,
				language_set: A.language_set,
				platform: A.steam_signup ? "steam" : "",
				pid: A.steam_signup ? A.steam_signup.steamid : "",
				guild: "",
				server: "",
				friends: [],
				last_online: new Date(),
				to_backup: false,
				popularity: 0.0,
				info: {
					gold: 1000,
					salt: salt,
					items0: [],
					items1: [],
					characters: [],
					everification: random_string(12),
					slots: A.slots,
					ip: A.ip,
					country: A.country,
					email: A.email,
					signupth: A.signupth,
				},
				blobs: ["info"],
			};
			R.auth = get_new_auth(R.user);
			await tx_save(R.user);
			await tx_save({ _id: "MK_email-" + A.email, type: "email", phrase: A.email, owner: get_id(R.user), created: new Date() });
			if (A.steam_signup) await tx_save({ _id: "MK_steam-signup-" + A.steam_signup.id, type: "steam_signup", owner: get_id(R.user), created: new Date() });
		},
		{
			email: email,
			password: password,
			signupth: signupth,
			referrer: referrer,
			slots: domain.electron || domain.tauri || steam_signup ? 8 : 5,
			steam_signup: steam_signup || null,
			ip: get_ip(args.req),
			country: get_country(args.req),
			language: domain.language,
			language_set: localization.preference_fields(args.req).language_set,
		},
	);

	if (R.failed) return { failed: true, reason: R.reason };

	localization.bind_user(args.req, R.user);
	domain = await get_domain(args.req, R.user);
	set_cookie(args.res, options.cookie_key, get_id(R.user) + "-" + R.auth, domain.domain);
	send_verification_email(domain, R.user);
	args.res.infs.push({ type: "success", message: phrase_html("server.api.signup_complete") });
	args.res.infs.push(await selection_info(args.req, R.user, domain));
	add_event(R.user, "signup", ["new", "noteworthy"], { req: args.req, info: { message: "Signup " + R.user.info.email } });
	increase_signupth();

	try {
		ip = await get_ip_info(args.req);
		ip.info.limit_signups = gf(ip, "limit_signups", 0) + 1;
		await put_ip_info(ip, R.user);
	} catch (e) {
		console.error("signup ip error", e);
	}

	return { success: true, user: get_id(R.user), auth: R.auth, language: domain.language };
}

async function settings_api(args) {
	if (args.setting === "language") {
		var result = await localization.set_preference(db.collection("user"), args.user, args.value);
		if (result.success) {
			localization.bind_user(args.req, args.user);
			localization.set_language(result.language);
		}
		return result;
	}
	var domain = await get_domain(args.req),
		user = args.user;
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };
	var R = await tx(
		async () => {
			R.user = await tx_get(A.user);
			if (A.setting === "email") {
				if (A.value) R.user.info.dont_send_emails = false;
				else R.user.info.dont_send_emails = true;
			}
			await tx_save(R.user);
		},
		{ user: user, setting: args.setting, value: args.value },
	);
	if (R.failed) return { failed: true, reason: R.reason };
	args.res.infs.push({ type: "success", message: phrase_html("server.api.setting_changed") });
	args.res.infs.push(await selection_info(args.req, R.user, domain));
	return { success: true };
}

async function change_email_api(args) {
	var domain = await get_domain(args.req),
		user = args.user,
		email = args.email;
	try {
		email = purify_email(email);
	} catch (e) {
		return { failed: true, reason: "invalid_email" };
	}

	var existing = await get_user_by_email(email);
	if (existing) {
		if (get_id(existing) !== get_id(user)) return { failed: true, reason: "email_might_be_registered" };
		if (gf(user, "verified", 0)) return { failed: true, reason: "email_already_verified" };
	}
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };
	if (gf(user, "last_email_change") && hsince(gf(user, "last_email_change")) < 18) return { failed: true, reason: "change_email_once_every_18_hours" };

	var R = await tx(
		async () => {
			await delete_phrase_mark("email", gf(A.user, "email", ""));
			if (await tx_get("MK_email-" + A.email)) ex("email_exists");
			R.user = await tx_get(A.user);
			if (R.user.info.email !== A.email) R.user.ses_bounce = false;
			R.user.email = [A.email];
			R.user.info.email = A.email;
			R.user.info.last_email_change = new Date();
			if (gf(R.user, "verified", 0)) delete R.user.info.verified;
			R.user.info.everification = random_string(12);
			await tx_save(R.user);
			await mark_phrase(R.user, "email", A.email);
		},
		{ user: user, email: email },
	);

	if (R.failed) return { failed: true, reason: R.reason || "operation_failed" };
	send_verification_email(domain, R.user);
	args.res.infs.push({ type: "success", message: phrase_html("server.api.email_changed_verification_email_re_sent_refresh_the_page") });
	args.res.infs.push(await selection_info(args.req, R.user, domain));
	return { success: true };
}

async function change_password_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };
	if (user.password !== args.epass && user.password !== hash_password(args.epass, gf(user, "salt", "5"))) return { failed: true, reason: "wrong_password" };
	if (!args.newpass1 || args.newpass1 !== args.newpass2) return { failed: true, reason: "passwords_dont_match" };

	var R = await tx(
		async () => {
			R.user = await tx_get(A.user);
			R.user.info.salt = random_string(20);
			R.user.password = hash_password(A.newpass1, R.user.info.salt);
			await tx_save(R.user);
		},
		{ user: user, newpass1: args.newpass1 },
	);

	if (R.failed) return { failed: true, reason: R.reason };
	args.res.infs.push({ type: "success", message: phrase_html("server.api.password_changed") });
	args.res.infs.push(await selection_info(args.req, R.user, domain));
	return { success: true };
}

async function reset_password_api(args) {
	if (!args.newpass1 || args.newpass1 !== args.newpass2) return { failed: true, reason: "passwords_dont_match" };
	var user = await get(args.id);
	if (!user || gf(user, "password_key") !== args.key) return { failed: true, reason: "invalid_key" };
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };

	var R = await tx(
		async () => {
			R.user = await tx_get(A.user);
			R.user.info.salt = random_string(20);
			R.user.password = hash_password(A.newpass1, R.user.info.salt);
			R.user.info.password_key = random_string(20);
			await tx_save(R.user);
		},
		{ user: user, newpass1: args.newpass1 },
	);

	if (R.failed) return { failed: true, reason: R.reason };
	args.res.infs.push({ type: "success", message: phrase_html("server.api.new_password_set") });
	return { success: true };
}

async function password_reminder_api(args) {
	var domain = await get_domain(args.req),
		email = args.email;
	try {
		email = purify_email(email);
	} catch (e) {
		return { failed: true, reason: "invalid_email" };
	}
	var existing = await get_user_by_email(email);
	if (!existing) return { failed: true, reason: "email_not_found" };
	if (existing.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };
	if (hsince(gf(existing, "last_password_reminder", really_old)) < 24) return { failed: true, reason: "already_sent_reminder_recently" };

	var R = await tx(
		async () => {
			R.user = await tx_get(A.user);
			R.user.info.last_password_reminder = new Date();
			R.user.info.password_key = random_string(20);
			await tx_save(R.user);
		},
		{ user: existing },
	);

	if (R.failed) return { failed: true, reason: R.reason };
	send_password_reminder_email(domain, R.user);
	args.res.infs.push({ type: "success", message: phrase_html("server.api.emailed_password_reset_instructions") });
	return { success: true };
}

async function logout_api(args) {
	await delete_auth_cookies(args.req, args.res);
	args.res.infs.push({ type: "message", message: phrase_html("server.api.logged_out") });
	return { success: true };
}

async function logout_everywhere_api(args) {
	var user = args.user;
	if (user.server) return { failed: true, reason: "inthebank" };

	var R = await tx(
		async () => {
			R.user = await tx_get(A.user);
			R.user.info.auths = [];
			await tx_save(R.user);
		},
		{ user: user },
	);

	if (R.failed) return { failed: true, reason: R.reason };
	await delete_auth_cookies(args.req, args.res);
	args.res.infs.push({ type: "message", message: phrase_html("server.api.logged_out_everywhere") });
	return { success: true };
}

async function generate_token_api(args) {
	var result = await create_mcp_api_token(args.user);
	if (result.failed) return result;

	if (args.res && args.res.set) args.res.set("Cache-Control", "no-store");
	// The regular API logs responses in development. Keep the token out of logs
	// while still returning it normally as JSON.
	Object.defineProperty(result, Symbol.for("nodejs.util.inspect.custom"), {
		enumerable: false,
		value: function () {
			return { success: true, token: "[redacted]", rotated: result.rotated };
		},
	});
	return result;
}

async function token_status_api(args) {
	var result = await get_mcp_api_token_status(args.user);
	if (args.res && args.res.set) args.res.set("Cache-Control", "no-store");
	return result;
}

async function reveal_token_api(args) {
	var result = await reveal_mcp_api_token(args.user);
	if (args.res && args.res.set) args.res.set("Cache-Control", "no-store");
	Object.defineProperty(result, Symbol.for("nodejs.util.inspect.custom"), {
		enumerable: false,
		value: function () {
			return result.failed ? { failed: true, reason: result.reason } : { success: true, token: "[redacted]" };
		},
	});
	return result;
}

async function revoke_token_api(args) {
	return await revoke_mcp_api_token(args.user);
}

// ==================== CHARACTER MANAGEMENT ====================

async function servers_and_characters_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var user_data = await get_user_data(user);
	var characters_data = await get_characters(user);
	var characters = characters_to_client(characters_data);
	var servers_data = await get_browser_servers(args.req);
	var servers = servers_to_client(domain, servers_data);
	var mail = gf(user_data, "mail", 0);

	args.res.infs.push({
		type: "servers_and_characters",
		servers: servers,
		characters: characters,
		tutorial: data_to_tutorial(user_data),
		merchant_tutorial: data_to_tutorial(user_data, "merchant"),
		code_list: gf(user_data, "code_list", {}),
		mail: mail,
		rewards: gf(user, "rewards", []),
	});
	return { success: true };
}

async function create_character_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var name = args.name,
		char_type = args.char,
		look = sint(args.look);
	if (!char_type || !character_types.includes(char_type)) return { failed: true, reason: "character_type_not_allowed" };
	if (classes[char_type] && classes[char_type].looks && classes[char_type].looks.length <= look) return { failed: true, reason: "invalid_look" };
	if (!name) return { failed: true, reason: "please_enter_a_name" };
	name = name.replace(/ /g, "").replace(/\t/g, "");
	if (!is_name_allowed(name)) return { failed: true, reason: "invalid_name" };
	if (await get_character(name, true)) return { failed: true, reason: "name_used" };
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };

	var ip = await get_ip_info(args.req);
	var check = can_create_character_check(user, ip);
	if (!check.can) {
		if (check.reason === "ip") return { failed: true, reason: "too_many_characters_from_ip" };
		if (check.reason === "abs") return { failed: true, reason: "cant_create_more_than_18" };
		return { failed: true, reason: "reached_character_limit" };
	}
	var characterth = await get_characterth();
	var base = classes[char_type];
	var spawn = maps["main"].spawns[maps["main"].on_death ? maps["main"].on_death[1] : 0];

	var R = await tx(
		async () => {
			var mark = await tx_get("MK_character-" + simplify_name(A.name));
			if (mark) ex("character_exists");
			var owner = await tx_get(A.user);

			R.character = {
				_id: "CH_" + random_string(29),
				created: new Date(),
				updated: new Date(),
				a_rand: a_rand("character"),
				realm: "main",
				name: simplify_name(A.name),
				type: A.char_type,
				level: 1,
				worth: 0,
				xp: 0,
				owner: get_id(A.user),
				referrer: owner.referrer || "",
				platform: "",
				pid: "",
				online: false,
				server: "",
				guild: "",
				friends: [],
				last_sync: new Date(),
				last_online: new Date(),
				to_backup: false,
				popularity: 0.0,
				private: false,
				info: {
					characterth: A.characterth,
					name: A.name,
					gold: 0,
					items: [
						{ name: "hpot0", q: 200, gift: 1 },
						{ name: "mpot0", q: 200, gift: 1 },
					],
					slots: JSON.parse(JSON.stringify(A.base.base_slots || {})),
					stats: {},
					skin: A.base.looks[A.look][0],
					cx: A.base.looks[A.look][1],
					map: "main",
					in: "main",
					x: A.spawn[0],
					y: A.spawn[1],
				},
				blobs: ["info"],
			};
			// Add starter gear
			R.character.info.slots.helmet = { name: "helmet", level: 0, gift: 1 };
			R.character.info.slots.shoes = { name: "shoes", level: 0, gift: 1 };

			if (!owner.info.characters) owner.info.characters = [];
			if (!owner.info.characters.length) owner.name = A.name;
			if (owner.info.characters.length >= gf(owner, "slots", 5)) {
				owner.info.slots = gf(owner, "slots", 5) + 1;
				owner.cash -= 200;
			}
			owner.info.characters.push(character_to_dict(R.character));
			if (!owner.name || owner.name.startsWith("#")) owner.name = A.name;
			await tx_save(R.character);
			await tx_save(owner);
			await tx_save({ _id: "MK_character-" + simplify_name(A.name), type: "character", phrase: simplify_name(A.name), owner: get_id(R.character), created: new Date() });
			R.owner = owner;
		},
		{ name: name, user: user, char_type: char_type, look: look, base: base, spawn: spawn, characterth: characterth },
	);

	if (R.failed) return { failed: true, reason: R.reason || "creation_failed" };

	try {
		ip = await get_ip_info(args.req);
		ip.info.limit_create_character = gf(ip, "limit_create_character", 0) + 1;
		await put_ip_info(ip, R.owner, R.character);
	} catch (e) {
		console.error("create_character ip error", e);
	}

	args.res.infs.push({ type: "success", message: phrase_html("server.api.is_alive", { name: String(name) }) });
	args.res.infs.push(await selection_info(args.req, R.owner, domain));
	add_event(R.owner, "new_character", ["characters", "noteworthy"], { req: args.req, info: { message: "New Character " + name + " from " + user.info.email }, backup: true });
	increase_characterth();
	return { success: true };
}

async function sort_characters_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var rest = await get_characters(user);
	var order = ("" + args.characters).split(",");
	var characters = [];
	for (var i = 0; i < order.length; i++) {
		for (var j = 0; j < rest.length; j++) {
			if (simplify_name(order[i]) === simplify_name(rest[j].info.name || rest[j].name)) {
				characters.push(rest[j]);
				rest.splice(j, 1);
				break;
			}
		}
	}
	characters = characters.concat(rest);

	var R = await tx(
		async () => {
			var owner = await tx_get(A.user);
			var first = false,
				firstp = false;
			owner.info.characters = [];
			for (var i = 0; i < A.characters.length; i++) {
				var c = A.characters[i];
				if (!first) {
					owner.name = c.info.name || c.name;
					first = true;
				}
				if (!firstp && !c.private) {
					owner.name = c.info.name || c.name;
					firstp = true;
				}
				owner.info.characters.push(character_to_dict(c));
			}
			owner.info.transfer_auth = random_string(10);
			await tx_save(owner);
			R.owner = owner;
		},
		{ user: user, characters: characters },
	);

	if (R.failed) return { failed: true, reason: R.reason || "something_went_wrong" };
	args.res.infs.push({ type: "message", message: phrase_html("server.api.done") });
	args.res.infs.push(await selection_info(args.req, R.owner, domain));
	return { success: true };
}

async function rename_character_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var name = args.name,
		nname = args.nname;
	var character = await get_character(name);
	if (!character) return { failed: true, reason: "no_character" };
	if (character.owner !== get_id(user)) return { failed: true, reason: "not_owner" };
	if (is_in_game(character)) return { failed: true, reason: "character_in_game" };
	if (hsince(gf(character, "last_rename", really_old)) < 32) return { failed: true, reason: "rename_once_every_32_hours" };
	if (!nname || !is_name_xallowed(nname)) return { failed: true, reason: "invalid_name" };
	if (await get_character(nname, true)) return { failed: true, reason: "name_used" };
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };

	var price = 640;
	if (nname.length === 1) price = 160000;
	else if (nname.length === 2) price = 48000;
	else if (nname.length === 3) price = 24000;
	else if (nname.length === 4) price = 2400;
	else {
		if (!gf(character, "last_rename", null) && (character.level < 60 || hsince(character.created) < 72)) price = 0;
		price = 640;
	}
	if (user.cash < price) return { failed: true, reason: "not_enough_shells" };

	var R = await tx(
		async () => {
			if (await tx_get("MK_character-" + simplify_name(A.nname))) ex("name_used");
			var owner = await tx_get(A.user);
			var c = await tx_get(A.character);
			if (c.name === simplify_name(A.nname)) ex("duplicate_click");
			for (var i = 0; i < (owner.info.characters || []).length; i++) {
				if (simplify_name(owner.info.characters[i].name) === simplify_name(A.name)) {
					owner.info.characters[i].name = A.nname;
				}
			}
			if (simplify_name(owner.name) === simplify_name(A.name)) owner.name = A.nname;
			owner.info.last_rename = new Date();
			owner.cash -= A.price;
			await tx_save(owner);
			c.info.names = gf(c, "names", []);
			c.info.names.push(c.name);
			await delete_phrase_mark("character", c.name);
			c.info.name = A.nname;
			c.name = simplify_name(A.nname);
			c.info.last_rename = new Date();
			await tx_save(c);
			await tx_save({ _id: "MK_character-" + simplify_name(A.nname), type: "character", phrase: simplify_name(A.nname), owner: get_id(c), created: new Date() });
			R.owner = owner;
		},
		{ user: user, character: character, name: name, nname: nname, price: price },
	);

	if (R.failed) return { failed: true, reason: R.reason };
	add_event(character, "rename_character", ["characters"], { req: args.req, info: { message: name + " renamed to " + nname }, backup: true });
	args.res.infs.push({ type: "message", message: phrase_html("server.api.spent_shells", { amount: String(to_pretty_num(price)) }) });
	args.res.infs.push({ type: "message", message: phrase_html("server.api.renamed_to", { name: String(name), nname: String(nname) }) });
	args.res.infs.push(await selection_info(args.req, R.owner, domain));
	return { success: true };
}

async function quote_name_api(args) {
	var user = args.user,
		name = args.name,
		nname = args.nname;
	if (!nname || !is_name_xallowed(nname)) return { failed: true, reason: "invalid_name" };
	if (await get_character(nname, true)) return { failed: true, reason: "name_used" };
	var character = await get_character(name);
	var price = 640;
	if (nname.length === 1) price = 160000;
	else if (nname.length === 2) price = 48000;
	else if (nname.length === 3) price = 24000;
	else if (nname.length === 4) price = 2400;
	else {
		if (character && !gf(character, "last_rename", null) && (character.level < 60 || hsince(character.created) < 72)) price = 0;
		price = 640;
	}
	args.res.infs.push({ type: "eval", code: "show_alert('Costs " + to_pretty_num(price) + " shells')" });
	return { success: true };
}

async function transfer_character_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var name = args.name,
		id = args.id,
		auth = args.auth;
	var character = await get_character(name);
	if (!character) return { failed: true, reason: "no_character" };
	if (character.owner !== get_id(user)) return { failed: true, reason: "not_owner" };
	if (is_in_game(character)) return { failed: true, reason: "character_in_game" };
	var receiver = await get(id);
	if (!receiver || gf(receiver, "transfer_auth") !== auth) return { failed: true, reason: "receiver_not_found_or_wrong_auth" };
	if (user.server || receiver.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };
	if (user.cash < 500) return { failed: true, reason: "not_enough_shells" };

	var R = await tx(
		async () => {
			var owner = await tx_get(A.user);
			var c = await tx_get(A.character);
			if (c.owner !== get_id(A.user)) ex("duplicate_click");
			var new_characters = [];
			for (var i = 0; i < (owner.info.characters || []).length; i++) {
				if (simplify_name(owner.info.characters[i].name) !== simplify_name(A.name)) new_characters.push(owner.info.characters[i]);
			}
			owner.info.characters = new_characters;
			if (simplify_name(owner.name) === simplify_name(A.name)) {
				owner.name = owner.info.characters.length ? owner.info.characters[0].name : "#" + gf(owner, "signupth", "0");
			}
			owner.info.last_delete = new Date();
			owner.cash -= 500;
			await mainframe_retire_assignment(await tx_get(mainframe_assignment_record_id(get_id(c))), new Date(), tx_get, tx_save, owner);
			await tx_save(owner);
			c.info.transfer = true;
			c.owner = get_id(A.receiver);
			c.pid = "";
			c.platform = "";
			try {
				if (c.info.p) {
					if (c.info.p.steam_id) delete c.info.p.steam_id;
					if (c.info.p.mas_auth_id) delete c.info.p.mas_auth_id;
				}
			} catch (e) {
				console.error("transfer pid cleanup error", e);
			}
			if (is_in_game(c)) ex("character_in_game");
			await tx_save(c);
			var nowner = await tx_get(A.receiver);
			if (!nowner.info.characters) nowner.info.characters = [];
			nowner.info.characters.push(character_to_dict(c));
			await tx_save(nowner);
			R.owner = owner;
		},
		{ user: user, character: character, name: name, receiver: receiver },
	);

	if (R.failed) return { failed: true, reason: R.reason || "something_went_wrong" };
	add_event(character, "transfer_character", ["characters"], { req: args.req, info: { message: user.name + " transferred " + name + " to " + id }, backup: true });
	args.res.infs.push({ type: "message", message: phrase_html("server.api.flew_away", { name: String(name) }) });
	args.res.infs.push(await selection_info(args.req, R.owner, domain));
	return { success: true };
}

async function delete_character_api(args) {
	var domain = await get_domain(args.req),
		user = args.user,
		name = args.name;
	var character = await get_character(name);
	if (!character) return { failed: true, reason: "no_character" };
	if (character.owner !== get_id(user)) return { failed: true, reason: "not_owner" };
	if (is_in_game(character)) return { failed: true, reason: "character_in_game" };
	if (user.server) return { failed: true, reason: "cant_make_changes_while_in_bank" };
	if (!Dev && msince(gf(user, "last_delete", really_old)) < 180) return { failed: true, reason: "wait_" + Math.ceil(180 - msince(gf(user, "last_delete", really_old))) + "_minutes" };

	add_event(character, "delete_character", ["characters"], { req: args.req, info: { message: user.name + " deleted " + name }, backup: true });

	var R = await tx(
		async () => {
			var mark = await tx_get("MK_character-" + simplify_name(A.name));
			if (mark) await db.collection(get_kind(mark)).deleteOne({ _id: mark._id }, { session });
			var owner = await tx_get(A.user);
			var data = await get_user_data(owner);
			var new_characters = [];
			for (var i = 0; i < (owner.info.characters || []).length; i++) {
				if (simplify_name(owner.info.characters[i].name) !== simplify_name(A.name)) new_characters.push(owner.info.characters[i]);
			}
			owner.info.characters = new_characters;
			if (simplify_name(owner.name) === simplify_name(A.name)) {
				owner.name = owner.info.characters.length ? owner.info.characters[0].name : "#" + gf(owner, "signupth", "0");
			}
			try {
				if (data.info.code_list && data.info.code_list[get_id(A.character)]) {
					delete data.info.code_list[get_id(A.character)];
					await tx_save(data);
				}
			} catch (e) {}
			await db.collection(get_kind(A.character)).deleteOne({ _id: get_id(A.character) }, { session });
			owner.info.last_delete = new Date();
			await tx_save(owner);
			R.owner = owner;
		},
		{ user: user, character: character, name: name },
	);

	if (R.failed) return { failed: true, reason: R.reason || "something_went_wrong" };
	args.res.infs.push({ type: "message", message: phrase_html("server.api.is_no_more", { name: String(name) }) });
	args.res.infs.push(await selection_info(args.req, R.owner, domain));
	return { success: true };
}

async function edit_character_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var name = args.name,
		operation = args.operation;
	var character = await get_character(name);
	if (!character) return { failed: true, reason: "no_character" };
	if (character.owner !== get_id(user)) return { failed: true, reason: "not_owner" };
	if (is_in_game(character)) return { failed: true, reason: "character_in_game" };

	var R = await tx(
		async () => {
			R.element = await tx_get(A.character);
			if (A.operation === "toggle_privacy") R.element.private = !R.element.private;
			await tx_save(R.element);
		},
		{ character: character, operation: operation },
	);

	if (R.failed) return { failed: true, reason: R.reason || "something_went_wrong" };
	var message = phrase_html("server.api.done");
	if (operation === "toggle_privacy") {
		if (R.element.private) {
			message = simplify_name(user.name) === R.element.name ? phrase_html("server.api.character_private_rename") : phrase_html("server.api.character_private");
		} else message = phrase_html("server.api.character_public");
	}
	args.res.infs.push({ type: "message", message: message });
	args.res.infs.push(await selection_info(args.req, user, domain));
	return { success: true };
}

async function disconnect_character_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var name = args.name;
	var character = await get_character(name);
	if (!character) return { failed: true, reason: "no_character" };
	if (character.owner !== get_id(user)) return { failed: true, reason: "not_owner" };
	if (!is_in_game(character)) return { failed: true, reason: "character_not_in_game" };
	await character_eval(character, "console.log('disconnect_character_api'); player.socket.disconnect()");
	args.res.infs.push({ type: "message", message: phrase_html("server.api.sent_the_disconnect_signal_to_the_server") });
	if (args.selection) args.res.infs.push(await selection_info(args.req, user, domain));
	return { success: true };
}

// ==================== SERVER MANAGEMENT ====================

async function get_servers_api(args) {
	var server_list = await get_browser_servers(args.req);
	var servers = [];
	for (var i = 0; i < server_list.length; i++) {
		var s = server_list[i];
		servers.push({
			address: s.address,
			path: s.path,
			msgpack_path: s.msgpack_path,
			region: s.region,
			name: s.name,
			pvp: s.info.pvp,
			gameplay: s.gameplay,
		});
	}
	return { success: true, servers: servers };
}

async function can_reload_api(args) {
	var user = args.user;
	var servers = await get_browser_servers(args.req);
	for (var i = 0; i < servers.length; i++) {
		var server = servers[i];
		if (server.region === args.region && server.name === args.name) {
			args.res.infs.push({ type: "reload", address: server.address, path: server.path });
			return { success: true, reload: true };
		}
	}
	return { success: true, reload: false };
}

// ==================== SOCIAL ====================

async function pull_friends_api(args) {
	var user = args.user;
	var online_chars = [];
	var online = await db
		.collection("character")
		.find({ friends: get_id(user), online: true })
		.toArray();
	for (var i = 0; i < online.length; i++) {
		var character = online[i];
		if (character.private) continue;
		var friend = {
			name: character.info.name || character.name,
			level: character.level,
			type: character.type,
			afk: gf(character, "afk", false),
			owner_name: gf(character, "owner_name"),
			owner: character.owner,
		};
		if (character.server) {
			friend.server = character.server;
			online_chars.push(friend);
		}
	}
	args.res.infs.push({ type: "friends", chars: online_chars });
	return { success: true };
}

async function pull_guild_api(args) {
	var user = args.user;
	if (!user.guild) return { success: true };
	var online_chars = [];
	var online = await db.collection("character").find({ guild: user.guild, online: true }).toArray();
	for (var i = 0; i < online.length; i++) {
		var character = online[i];
		if (character.private) continue;
		var friend = {
			name: character.info.name || character.name,
			level: character.level,
			type: character.type,
			afk: gf(character, "afk", false),
			owner_name: gf(character, "owner_name"),
			owner: character.owner,
		};
		if (character.server) {
			friend.server = character.server;
			online_chars.push(friend);
		}
	}
	args.res.infs.push({ type: "guild", chars: online_chars });
	return { success: true };
}

async function pull_merchants_api(args) {
	var user = args.user;
	var online_chars = [];
	var online = await db.collection("character").find({ type: "merchant", online: true }).toArray();
	for (var i = 0; i < online.length; i++) {
		var character = online[i];
		if (!gf(character, "p", 0) || !character.info.p.stand) continue;
		var friend = {
			name: character.info.name || character.name,
			level: character.level,
			afk: gf(character, "afk", false),
			skin: character.info.skin,
			cx: gf(character, "cx", {}),
			stand: character.info.p.stand,
			x: character.info.x,
			y: character.info.y,
			map: character.info.map,
			server: character.server,
		};
		friend.slots = {};
		for (var s = 1; s <= 48; s++) {
			if (character.info.slots && character.info.slots["trade" + s]) friend.slots["trade" + s] = simplify_item(character.info.slots["trade" + s]);
		}
		if (character.server) {
			online_chars.push(friend);
		}
	}
	args.res.infs.push({ type: "merchants", chars: online_chars });
	return { success: true };
}

// ==================== MAIL / MESSAGES ====================

function chat_message_to_client(message) {
	return {
		id: get_id(message),
		fro: message.fro || "",
		to: Array.isArray(message.to) ? message.to : message.to ? [message.to] : [],
		message: gf(message, "message", ""),
		type: message.type,
		server: message.server || "",
		date: message.created.toISOString(),
	};
}

function chat_cursor_query(cursor, after) {
	if (!cursor) return {};
	if (typeof cursor !== "string" || cursor.length > 100) return null;
	var parts = cursor.split("|"),
		date = new Date(parts[0]);
	if (parts.length !== 2 || !Number.isFinite(date.getTime()) || !/^MS_[A-Za-z0-9]+$/.test(parts[1])) return null;
	return { $or: [{ created: { [after ? "$gt" : "$lt"]: date } }, { created: date, _id: { [after ? "$gt" : "$lt"]: parts[1] } }] };
}

function chat_page(messages, page, after, started) {
	var more = messages.length > page;
	messages = messages.slice(0, page);
	var last = messages[messages.length - 1],
		latest = after ? last : messages[0];
	return {
		success: true,
		messages: messages.map(chat_message_to_client),
		more: more,
		cursor: more && last ? last.created.toISOString() + "|" + get_id(last) : null,
		after: latest ? latest.created.toISOString() + "|" + get_id(latest) : started.toISOString() + "|MS_0",
	};
}

async function pull_chat_api(args) {
	var started = new Date(),
		before = chat_cursor_query(args.cursor || args.after, !!args.after),
		query;
	if ((args.cursor && args.after) || !before) return { failed: true, reason: "invalid_cursor" };
	if (args.server) {
		var servers = await get_servers();
		if (
			!servers.some(function (server) {
				return get_id(server) === args.server;
			})
		)
			return { failed: true, reason: "server_not_found" };
		query = { owner: "~" + args.server, type: "server" };
	} else {
		var user = await get_user(args.req);
		if (!user) return { failed: true, reason: "not_logged_in" };
		if (!is_name_xallowed(args.character || "") || !is_name_xallowed(args.to || "")) return { failed: true, reason: "invalid_name" };
		var character = new RegExp("^" + args.character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
		var to = new RegExp("^" + args.to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
		query = {
			owner: get_id(user),
			type: "private",
			$or: [
				{ fro: character, to: to },
				{ fro: to, to: character },
			],
		};
	}
	var messages = await db
		.collection("message")
		.find({ $and: [query, before] })
		.sort({ created: args.after ? 1 : -1, _id: args.after ? 1 : -1 })
		.limit(81)
		.maxTimeMS(4000)
		.toArray();
	return chat_page(messages, 80, !!args.after, started);
}

var chat_server_cache;
async function chat_server_channels(servers) {
	var key = servers.map(get_id).join(",");
	if (chat_server_cache && chat_server_cache.key === key && chat_server_cache.until > Date.now()) return chat_server_cache.promise;
	var cache = { key: key, until: Date.now() + 5000 };
	chat_server_cache = cache;
	cache.promise = Promise.all(
		servers.map(async function (server) {
			var latest = await db
				.collection("message")
				.findOne(
					{ owner: "~" + get_id(server), type: "server" },
					{ sort: { created: -1, _id: -1 }, projection: { fro: 1, to: 1, created: 1, type: 1, server: 1, "info.message": 1 }, maxTimeMS: 4000 },
				);
			return { type: "server", server: get_id(server), latest: latest ? chat_message_to_client(latest) : null };
		}),
	).catch(function (error) {
		if (chat_server_cache === cache) chat_server_cache = null;
		throw error;
	});
	return cache.promise;
}

async function pull_chats_api(args) {
	var started = new Date(),
		before = chat_cursor_query(args.cursor),
		after = chat_cursor_query(args.after, true);
	if ((args.cursor && args.after) || !before || !after) return { failed: true, reason: "invalid_cursor" };
	var user = args.user,
		owner = get_id(user);
	var characters = await db
		.collection("character")
		.find({ owner: owner }, { projection: { owner: 1, "info.name": 1, online: 1, server: 1 } })
		.limit(100)
		.toArray();
	var order = ((user.info && user.info.characters) || []).map(function (character) {
		return character.id;
	});
	characters.sort(function (a, b) {
		return order.indexOf(get_id(a)) - order.indexOf(get_id(b));
	});
	var owned = {};
	characters.forEach(function (character) {
		owned[character.info.name.toLowerCase()] = character.info.name;
	});
	// Group both directions of each character pair. The owner match also covers
	// conversations with characters that were renamed or transferred later.
	var messages = await db
		.collection("message")
		.aggregate(
			[
				{ $match: { owner: owner, type: "private", ...after } },
				{ $sort: { created: -1, _id: -1 } },
				{ $project: { fro: 1, to: 1, created: 1, author: 1, type: 1, server: 1, "info.message": 1 } },
				{ $addFields: { first: { $toLower: "$fro" }, second: { $toLower: { $cond: [{ $isArray: "$to" }, { $arrayElemAt: ["$to", 0] }, "$to"] } } } },
				{ $group: { _id: { $cond: [{ $lt: ["$first", "$second"] }, ["$first", "$second"], ["$second", "$first"]] }, latest: { $first: "$$ROOT" } } },
				{ $replaceRoot: { newRoot: "$latest" } },
				{ $match: before },
				{ $sort: { created: args.after ? 1 : -1, _id: args.after ? 1 : -1 } },
				{ $limit: 41 },
			],
			{ maxTimeMS: 4000 },
		)
		.toArray();
	var page = chat_page(messages, 40, !!args.after, started);
	var chats = messages.slice(0, 40).map(function (message) {
		var latest = chat_message_to_client(message),
			fro = latest.fro,
			to = latest.to[0] || "";
		var mine = owned[fro.toLowerCase()] ? fro : owned[to.toLowerCase()] ? to : message.author === owner ? fro : to;
		if (owned[fro.toLowerCase()] && owned[to.toLowerCase()]) mine = fro.toLowerCase() < to.toLowerCase() ? fro : to;
		return { type: "private", character: owned[mine.toLowerCase()] || mine, to: mine === fro ? to : fro, latest: latest };
	});
	if (!args.cursor) {
		var servers = await get_servers();
		var channels = await chat_server_channels(servers);
		chats = chats.concat(channels);
	}
	return {
		success: true,
		chats: chats,
		more: page.more,
		cursor: page.cursor,
		after: page.after,
		characters: characters.map(function (character) {
			return { name: character.info.name, online: !!character.online, server: character.server || "" };
		}),
	};
}

// These functions run only through the existing authenticated server_eval bridge.
// Read moderation state without emitting through or changing a character's socket.
function communicator_chat_status(data) {
	var player = get_player(data.character);
	if (!player) return { success: true };
	if (player.owner !== data.owner || player.real_id !== data.id) return { failed: true, reason: "not_owner" };
	if (player.s.mute) return { failed: true, reason: "muted" };
	if (player.last_say && mssince(player.last_say) < 400) return { failed: true, reason: "chat_slowdown" };
	return { success: true };
}

async function communicator_say(data) {
	if (server_id !== data.server) return { failed: true, reason: "wrong_server" };
	var message = strip_string(data.message).substr(0, 1200);
	if (!message) return { failed: true, reason: "invalid_message" };
	var character = await get_character(data.character);
	if (!character || character.owner !== data.owner || get_id(character) !== data.id) return { failed: true, reason: "not_owner" };
	if (gf(character, "s", {}).mute) return { failed: true, reason: "muted" };
	var status = communicator_chat_status(data);
	if (status.failed) return status;
	// One atomic cooldown per account, shared across HTTP workers and servers.
	try {
		await db
			.collection("mark")
			.updateOne({ _id: "MK_comm-chat-" + data.owner, $or: [{ updated: { $lte: new Date(Date.now() - 400) } }, { updated: { $exists: false } }] }, { $set: { updated: new Date() } }, { upsert: true });
	} catch (error) {
		if (error.code === 11000) return { failed: true, reason: "chat_slowdown" };
		throw error;
	}
	return deliver_chat_message({ owner: data.owner, name: character.info.name, id: "comm:" + data.id }, message, data.to);
}

async function send_message_api(args) {
	if (args.user.banned) return { failed: true, reason: "banned" };
	if (typeof args.message !== "string" || !args.message.trim() || args.message.length > 1200) return { failed: true, reason: "invalid_message" };
	if (!is_name_xallowed(args.character || "")) return { failed: true, reason: "invalid_name" };
	var character = await get_character(args.character);
	if (!character || character.owner !== get_id(args.user)) return { failed: true, reason: "not_owner" };
	var to = null;
	if (args.to) {
		if (!is_name_xallowed(args.to) || args.server) return { failed: true, reason: "invalid_name" };
		to = await get_character(args.to);
		if (!to) return { failed: true, reason: "character_not_found" };
		if (get_id(to) === get_id(character)) return { failed: true, reason: "message_self" };
	} else if (!args.server) return { failed: true, reason: "server_not_found" };
	var servers = await get_servers();
	var server = servers.find(function (server) {
		return get_id(server) === (to ? to.server : args.server);
	});
	if (to && !server) server = servers[0];
	if (!server) return { failed: true, reason: "server_not_found" };
	var data = { owner: get_id(args.user), id: get_id(character), character: character.info.name, server: get_id(server), to: to ? to.info.name : "", message: args.message };
	// A live mute on another realm must still apply before its next database sync.
	var source =
		character.online &&
		servers.find(function (source) {
			return get_id(source) === character.server && get_id(source) !== get_id(server);
		});
	if (source) {
		var status = await server_eval(source, "output=(" + communicator_chat_status.toString() + ")(data);", data, 3000);
		if (!status || !status.success) return status && status.failed ? status : { failed: true, reason: "chat_unavailable" };
	}
	var result = await server_eval(server, "var communicator_chat_status=" + communicator_chat_status.toString() + "; output=(" + communicator_say.toString() + ")(data);", data, 5000);
	return result && (result.success || result.failed) ? result : { failed: true, reason: "chat_unavailable" };
}

async function read_mail_api(args) {
	var user = args.user;

	var R = await tx(
		async () => {
			var mail = await tx_get(A.mail_id);
			if (mail && !mail.read && gf(mail, "receiver") === get_id(A.user)) {
				mail.read = true;
				await tx_save(mail);
			}
		},
		{ mail_id: args.mail.startsWith("ML_") ? args.mail : "ML_" + args.mail, user: user },
	);
	if (R.failed) return { failed: true, reason: R.reason };
	args.res.infs.push({ type: "unread", count: await update_mail_count(user) });
	return { success: true };
}

async function pull_mail_api(args) {
	var user = args.user;
	var data = { type: "mail", mail: [], more: false, cursor: null, cursored: false };
	var page = 40;

	var query = { owner: get_id(user) };
	var cursor_skip = args.cursor ? Math.max(0, parseInt(args.cursor) || 0) : 0;
	if (cursor_skip) data.cursored = true;
	var mails = await db
		.collection("mail")
		.find(query)
		.sort({ created: -1, _id: -1 })
		.skip(cursor_skip)
		.limit(page + 1)
		.toArray();

	if (mails.length > page) {
		data.more = true;
		data.cursor = "" + (cursor_skip + page);
		mails = mails.slice(0, page);
	}

	for (var i = 0; i < mails.length; i++) {
		var mail = mails[i];
		var mail_data = {
			fro: "" + (mail.fro || ""),
			to: "" + (mail.to || ""),
			message: "" + (mail.info.message || ""),
			subject: "" + (mail.info.subject || ""),
			sent: "" + mail.created,
			id: get_id(mail),
		};
		if (mail.cave_award === true) {
			mail_data.subject_message = { phrase: "server.cave.mail_subject" };
			mail_data.body_message = { phrase: "server.cave.mail_body" };
		}
		if (mail.tracktrix_gift === true) {
			mail_data.subject_message = { phrase: "server.tracktrix.mail_subject" };
			mail_data.body_message = { phrase: "server.tracktrix.mail_body" };
		}
		if (mail.item) {
			mail_data.item = simplify_item(mail.info.item);
			mail_data.taken = mail.taken;
		}
		data.mail.push(mail_data);
	}
	args.res.infs.push(data);
	args.res.infs.push({ type: "unread", count: await update_mail_count(user) });
	return { success: true };
}

async function delete_mail_api(args) {
	var user = args.user;
	var mail = await get(args.mid);
	if (!user || !mail || !mail.owner || mail.owner.indexOf(get_id(user)) === -1) return { failed: true, reason: "cant_delete" };
	await remove(mail);
	for (var owner of new Set(mail.owner)) {
		var count = await update_mail_count(owner);
		if (owner === get_id(user)) args.res.infs.push({ type: "unread", count: count });
	}
	args.res.infs.push({ type: "message", message: phrase_html("server.api.mail_deleted") });
	return { success: true };
}

async function pull_messages_api(args) {
	var user = args.user;
	var type = args.type || "all";
	var data = { type: "messages", messages: [], more: false, cursor: null, cursored: false, mtype: type };
	var page = 200;

	var query = {};
	if (type === "private" || type === "party") {
		query = { owner: get_id(user), type: type };
	} else if (type === "all") {
		query = { owner: get_id(user) };
	} else {
		query = { owner: "~" + type };
	}

	var cursor_skip = args.cursor ? parseInt(args.cursor) || 0 : 0;
	if (cursor_skip) data.cursored = true;
	var messages = await db
		.collection("message")
		.find(query)
		.sort({ created: -1 })
		.skip(cursor_skip)
		.limit(page + 1)
		.toArray();

	if (messages.length > page) {
		data.more = true;
		data.cursor = "" + (cursor_skip + page);
		messages = messages.slice(0, page);
	}

	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i];
		var m_data = {
			fro: "" + (msg.fro || ""),
			to: "" + (msg.to || ""),
			message: "" + (msg.info.message || ""),
			type: "" + (msg.type || ""),
			id: get_id(msg),
			server: "" + (msg.server || ""),
			date: msg.created ? msg.created.toISOString().replace(/\.\d+Z$/, "Z") : "",
		};
		data.messages.push(m_data);
	}
	args.res.infs.push(data);
	return { success: true };
}

// ==================== CODE / TUTORIAL ====================

async function save_code_api(args) {
	var user = args.user;
	var code = args.code || "",
		slot = "" + (args.slot || ""),
		name = args.name;
	var data = await get_user_data(user);
	if (!gf(data, "code_list")) data.info.code_list = {};
	if (!slot) return { failed: true, reason: "no_slot" };

	var character = null;
	var found = false;
	var characters = gf(user, "characters", []);
	for (var i = 0; i < characters.length; i++) {
		if (characters[i].id === slot) {
			found = true;
			character = characters[i].name;
		}
	}
	if (data.info.code_list[slot] && name === "DELETE") found = true;
	if (!found) {
		var num = parseInt(slot);
		if (!isNaN(num)) slot = "" + Math.max(1, Math.min(100, num));
	}

	if (!name) name = data.info.code_list[slot] ? data.info.code_list[slot][0] : null;
	if (!name) name = "" + (character || slot);
	var old_name = data.info.code_list[slot] ? data.info.code_list[slot][0] : name;
	name = to_filename(name).substring(0, 100);

	var R = await tx(
		async () => {
			var idata = await get_user_data(A.user);
			if (!gf(idata, "code_list")) idata.info.code_list = {};
			if (A.name === "DELETE") {
				try {
					delete idata.info.code_list[A.slot];
					var code_entity = await tx_get("IE_USERCODE-" + get_id(A.user) + "-" + A.slot);
					if (code_entity) await db.collection(get_kind(code_entity)).deleteOne({ _id: code_entity._id }, { session });
				} catch (e) {}
			} else {
				await tx_save({ _id: "IE_USERCODE-" + get_id(A.user) + "-" + A.slot, created: new Date(), info: { code: A.code } });
				idata.info.code_list[A.slot] = [A.name, parseInt((idata.info.code_list[A.slot] || [null, 0])[1]) + 1];
			}
			await tx_save(idata);
			R.data = idata;
		},
		{ user: user, slot: slot, name: name, code: code },
	);

	if (R.failed) return { failed: true, reason: "save_failed" };
	data = R.data;

	if (name === "DELETE") {
		args.res.infs.push({ type: "code_info", num: slot, delete: true });
		if (!args.electron) args.res.infs.push({ type: "eval", code: "code_slot=0;code_change=false;" });
		if (args.log) args.res.infs.push({ type: "message", message: phrase_html("server.api.deleted_js", { old_name: String(old_name), slot: String(slot) }), color: "gray" });
		else args.res.infs.push({ type: "chat_message", message: phrase_html("server.api.deleted_js", { old_name: String(old_name), slot: String(slot) }), color: "gray" });
	} else {
		args.res.infs.push({ type: "code_info", num: slot, name: data.info.code_list[slot][0], v: data.info.code_list[slot][1] });
		if (!args.electron) args.res.infs.push({ type: "eval", code: "code_slot=" + JSON.stringify("" + slot) + ";code_change=false;" });
		if (args.log) args.res.infs.push({ type: "message", message: phrase_html("server.api.saved_js", { name: String(name), slot: String(slot) }), color: "#E13758" });
		else if (args.auto && character) args.res.infs.push({ type: "message", message: phrase_html("server.api.auto_saved", { character: String(character) }), color: "#96E8A7" });
		else if (args.auto) args.res.infs.push({ type: "message", message: phrase_html("server.api.auto_saved_js", { name: String(name), slot: String(slot) }), color: "#96E8A7" });
		else args.res.infs.push({ type: "chat_message", message: phrase_html("server.api.saved_js", { name: String(name), slot: String(slot) }), color: "#E13758" });
	}
	return { success: true };
}

async function load_code_api(args) {
	var user = args.user,
		name = to_filename("" + args.name);
	var data = await get_user_data(user);

	if (name === "0" || name === 0) {
		var default_code = shtml("htmls/contents/codes/default_code.js");
		if (args.pure) return { code: default_code };
		args.res.infs.push({ type: "code", code: default_code, run: args.run, slot: 0, save: args.save });
		if (args.log) args.res.infs.push({ type: "message", message: phrase_html("server.api.loaded_the_default_code"), color: "#32A3B0" });
		else if (!args.save) args.res.infs.push({ type: "chat_message", message: phrase_html("server.api.loaded_the_default_code"), color: "#32A3B0" });
		return { success: true };
	}

	var code_list = gf(data, "code_list", {});
	var slot = find_code_slot(code_list, name);
	if (slot !== null) {
		var code_entity = await get("IE_USERCODE-" + get_id(user) + "-" + slot);
		if (!code_entity) {
			console.log("WARNING: code_list has slot " + slot + " but USERCODE entity missing: IE_USERCODE-" + get_id(user) + "-" + slot);
		}
		if (code_entity) {
			if (args.pure) return { code: code_entity.info.code };
			args.res.infs.push({ type: "code", code: code_entity.info.code, run: args.run, slot: slot, save: args.save, name: code_list[slot][0], v: code_list[slot][1] });
			if (args.log) args.res.infs.push({ type: "message", message: phrase_html("server.api.loaded_js", { value: String(code_list[slot][0]), slot: String(slot) }), color: "#32A3B0" });
			else if (!args.save) args.res.infs.push({ type: "chat_message", message: phrase_html("server.api.loaded_js", { value: String(code_list[slot][0]), slot: String(slot) }), color: "#32A3B0" });
			return { success: true };
		}
	}
	if (args.pure) return { code: "say('Code not found'); set_status('Not Found')" };
	args.res.infs.push({ type: "chat_message", message: phrase_html("server.api.not_found"), color: "#AD3844" });
	return { failed: true, reason: "not_found" };
}

async function load_libraries_api(args) {
	args.res.infs.push({
		type: "libraries",
		default_code: shtml("htmls/contents/codes/default_code.js"),
		runner_functions: shtml("htmls/contents/codes/runner_functions.js"),
		runner_compat: shtml("htmls/contents/codes/runner_compat.js"),
		common_functions: shtml("htmls/contents/codes/common_functions.js"),
	});
	return { success: true };
}

async function list_codes_api(args) {
	var user = args.user;
	var data = await get_user_data(user);
	args.res.infs.push({ type: "code_list", purpose: args.purpose, list: gf(data, "code_list", {}) });
	return { success: true };
}

async function tutorial_api(args) {
	if (args.track && args.track !== "merchant") return { failed: true, reason: "invalid" };
	var user = args.user,
		task = args.task,
		step = args.step;

	var R = await tx(
		async () => {
			var user_id = A.user._id || A.user;
			var data = process_user_data(user_id, await tx_get("IE_userdata-" + user_id));
			var progress = get_tutorial_track(data, A.track);
			var lessons = A.track === "merchant" ? docs.merchant_tutorial : docs.tutorial;
			calculate_tutorial_step(progress, lessons);
			var current = progress.info.tutorial_step;
			if (A.task) {
				var lesson = lessons[current];
				R.silent = lesson && lesson.tasks.indexOf(A.task) === -1;
				// Remember gameplay even when a player has not opened its lesson yet.
				var valid_task = docs.tasks && docs.tasks[A.task] && lessons.some(function (entry) {
					return A.task !== entry.continue_task && entry.tasks.indexOf(A.task) !== -1;
				});
				if (valid_task && progress.info.completed_tasks.indexOf(A.task) === -1) {
					progress.info.completed_tasks.push(A.task);
					await tx_save(data);
					R.result = [phrase_html("server.tutorial.task_complete", { task: phrase("tutorial.task." + A.task) }), "#85C76B", data, 1];
				} else {
					if (valid_task) R.result = [phrase_html("server.tutorial.task_complete", { task: phrase("tutorial.task." + A.task) }), "gray", data, 0];
					else if (docs.tasks && docs.tasks[A.task]) R.result = [phrase_html("server.tutorial.other_lesson"), "gray", data, 0];
					else R.result = [phrase_html("server.tutorial.invalid_task", { task: A.task }), "gray", data, 0];
				}
			} else {
				var next = parseInt(A.step);
				var current_lesson = lessons[current];
				var complete = current_lesson && (!A.lesson || A.lesson === current_lesson.key) && tutorial_lesson_complete(progress, current_lesson, true);
				if (next !== current + 1 || next > lessons.length || !complete) {
					R.result = [phrase_html("server.tutorial.complete_current"), "gray", data, 0];
				} else {
					if (current_lesson.continue_task && progress.info.completed_tasks.indexOf(current_lesson.continue_task) === -1) progress.info.completed_tasks.push(current_lesson.continue_task);
					(current_lesson.optional_tasks || []).forEach(function (task) {
						if (progress.info.completed_tasks.indexOf(task) === -1) progress.info.completed_tasks.push(task);
					});
					while (next < lessons.length && tutorial_lesson_complete(progress, lessons[next])) next++;
					progress.info.tutorial_step = next;
					progress.info.tutorial_key = lessons[next] ? lessons[next].key : null;
					await tx_save(data);
					R.result = [phrase_html("server.tutorial.lesson_complete", { lesson: phrase("tutorial." + current_lesson.key + ".title") }), "#85C76B", data, 2];
				}
			}
		},
		{ user: user, task: task, step: step, lesson: args.lesson, track: args.track },
		5,
		25,
	);

	if (R.failed) return { failed: true, reason: "failed" };
	if (R.result) {
		var info = data_to_tutorial(R.result[2], args.track);
		if (args.track) info.track = args.track;
		info.type = "tutorial_data";
		if (R.result[3] === 1 && !R.silent) info.success = true;
		if (R.result[3] === 2) info.next = true;
		args.res.infs.push(info);
		if (!R.silent) args.res.infs.push({ type: "message", message: R.result[0], color: R.result[1] });
	}
	return { success: true };
}

async function reset_tutorial_api(args) {
	if (args.track && args.track !== "merchant") return { failed: true, reason: "invalid" };
	var user = args.user;

	var R = await tx(
		async () => {
			var user_id = A.user._id || A.user;
			var data = process_user_data(user_id, await tx_get("IE_userdata-" + user_id));
			var progress = get_tutorial_track(data, A.track);
			var lessons = A.track === "merchant" ? docs.merchant_tutorial : docs.tutorial;
			progress.info.completed_tasks = [];
			progress.info.tutorial_step = 0;
			progress.info.tutorial_key = lessons[0].key;
			await tx_save(data);
			R.data = data;
		},
		{ user: user, track: args.track },
	);

	if (R.failed) return { failed: true, reason: "failed" };
	var info = data_to_tutorial(R.data, args.track);
	if (args.track) info.track = args.track;
	info.type = "tutorial_data";
	args.res.infs.push(info);
	args.res.infs.push({ type: "message", message: phrase_html("server.api.tutorial_reset"), color: "#F7B32F" });
	return { success: true };
}

// ==================== BILLING ====================

var STEAM_SHELL_USD_AMOUNTS = [1, 10, 25, 100, 500];
var STEAM_PURCHASE_COLLECTION = "steam_purchase";

function steam_checkout_language(language) {
	// Steam uses regional Web API codes. Its UI falls back to English for Arabic; Filipino has no Web API locale.
	language = localization.normalize(language) || "en";
	return { "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "pt-PT": "pt", ar: "en", fil: "en" }[language] || language;
}

function purchased_shells_for_usd(usd, event_bonus) {
	var shells = usd === 1 ? 75 : usd * 80;
	if (usd >= 500) shells = Math.floor(shells * 1.24);
	else if (usd >= 100) shells = Math.floor(shells * 1.16);
	else if (usd >= 25) shells = Math.floor(shells * 1.08);
	if (event_bonus) shells = Math.floor((shells * (100 + event_bonus)) / 100.0);
	return shells;
}

function steam_web_checkout_url(steam_url, order_id, return_token, req) {
	try {
		var checkout_url = new URL(steam_url);
		if (checkout_url.protocol !== "https:") return "";
		if (["checkout.steampowered.com", "store.steampowered.com"].indexOf(checkout_url.hostname) === -1) return "";
		var return_url = new URL("https://adventure.land/steam-purchase");
		if (req && req.get && (req.get("host") || "").toLowerCase().split(":")[0] === "cloudflare.adventure.land") return_url.hostname = "cloudflare.adventure.land";
		return_url.searchParams.set("order_id", order_id);
		return_url.searchParams.set("token", return_token);
		checkout_url.searchParams.set("returnurl", return_url.toString());
		return checkout_url.toString();
	} catch (e) {
		return "";
	}
}

async function steam_microtxn_request(method, endpoint, data, sandbox) {
	if (!keys.steam_publisher_web_apikey) return { success: false, config_error: true };
	var controller = new AbortController();
	var timeout = setTimeout(function () {
		controller.abort();
	}, 10000);
	try {
		var request_data = Object.assign(
			{
				key: keys.steam_publisher_web_apikey,
				appid: TAURI_STEAM_APP_ID,
				format: "json",
			},
			data,
		);
		var interface_name = sandbox ? "ISteamMicroTxnSandbox" : "ISteamMicroTxn";
		var url = "https://partner.steam-api.com/" + interface_name + "/" + endpoint + "/";
		var options = { method: method, signal: controller.signal };
		if (method === "GET") url += "?" + new URLSearchParams(request_data);
		else {
			options.headers = { "Content-Type": "application/x-www-form-urlencoded" };
			options.body = new URLSearchParams(request_data);
		}
		var response = await fetch(url, options);
		var body = await response.json();
		var steam_response = body && body.response;
		var params = steam_response && steam_response.params;
		var result = steam_response && (steam_response.result || (params && params.result));
		return {
			success: response.ok && result === "OK",
			params: params || {},
			error_code: steam_response && steam_response.error && steam_response.error.errorcode,
		};
	} catch (e) {
		return { success: false, uncertain: true };
	} finally {
		clearTimeout(timeout);
	}
}

async function insert_steam_purchase(user, steam_id, usd, shells, event_bonus, sandbox) {
	for (var attempt = 0; attempt < 4; attempt++) {
		var order_id = crypto.randomBytes(8).readBigUInt64BE().toString();
		if (order_id === "0") continue;
		var purchase = {
			_id: order_id,
			return_token: crypto.randomBytes(24).toString("hex"),
			owner: get_id(user),
			steam_id: steam_id,
			usd: usd,
			amount: usd * 100,
			currency: "USD",
			item_id: 777150000 + usd,
			shells: shells,
			extra_shells: event_bonus,
			user_session: "web",
			sandbox: sandbox,
			state: "creating",
			created: new Date(),
			updated: new Date(),
		};
		try {
			await db.collection(STEAM_PURCHASE_COLLECTION).insertOne(purchase);
			return purchase;
		} catch (e) {
			if (!e || e.code !== 11000) throw e;
		}
	}
	return null;
}

async function grant_steam_shell_purchase(purchase, args) {
	var session = client.startSession();
	var result = { success: false };
	try {
		await session.withTransaction(async function () {
			var current_purchase = await db.collection(STEAM_PURCHASE_COLLECTION).findOne({ _id: purchase._id }, { session: session });
			if (!current_purchase || current_purchase.owner !== get_id(args.user)) throw new Error("invalid_purchase");
			var current_user = await db.collection("user").findOne({ _id: current_purchase.owner }, { session: session });
			if (!current_user) throw new Error("missing_user");
			if (current_purchase.state === "delivered") {
				result = { success: true, already_delivered: true, cash: current_user.cash, shells: current_purchase.shells };
				return;
			}

			current_user.cash = gf(current_user, "cash", 0) + current_purchase.shells;
			await db.collection("user").replaceOne({ _id: current_user._id }, current_user, { session: session });

			var referrer = null;
			var referrer_shells = 0;
			if (!current_purchase.sandbox && current_user.referrer && current_user.referrer !== current_user._id && current_purchase.shells >= 20) {
				referrer = await db.collection("user").findOne({ _id: current_user.referrer }, { session: session });
				if (referrer) {
					referrer_shells = Math.round(current_purchase.shells * 0.1);
					referrer.info = referrer.info || {};
					referrer.info.rcash = gf(referrer, "rcash", 0) + referrer_shells;
					referrer.info.referrer_events = gf(referrer, "referrer_events", 0) + 1;
					referrer.cash = gf(referrer, "cash", 0) + referrer_shells;
					await db.collection("user").replaceOne({ _id: referrer._id }, referrer, { session: session });
				}
			}

			await db.collection(STEAM_PURCHASE_COLLECTION).updateOne(
				{ _id: current_purchase._id },
				{
					$set: {
						state: "delivered",
						delivered: new Date(),
						updated: new Date(),
						referrer_shells: referrer_shells,
					},
				},
				{ session: session },
			);
			result = {
				success: true,
				delivered: true,
				cash: current_user.cash,
				shells: current_purchase.shells,
				user: current_user,
				referrer: referrer,
				referrer_shells: referrer_shells,
			};
		});
	} catch (e) {
		console.error("Steam Shells delivery transaction failed");
		return { failed: true, reason: "delivery_failed" };
	} finally {
		await session.endSession();
	}

	if (result.delivered) {
		var payment_type = purchase.sandbox ? "steam_sandbox" : "steam";
		var payment_tags = purchase.sandbox ? ["payments", "sandbox"] : ["payments", "cashflow"];
		add_event(result.user, payment_type, payment_tags, {
			req: args.req,
			info: {
				message: purchase.sandbox ? "STEAM SANDBOX! " + result.user.name + " tested a " + purchase.usd + " USD purchase!" : "STEAM! " + result.user.name + " spent " + purchase.usd + " USD!",
				usd: purchase.usd,
				order_id: purchase._id,
				trans_id: purchase.trans_id,
			},
		});
		add_event(result.user, purchase.sandbox ? "steam_sandbox_shells" : "shells", purchase.sandbox ? ["sandbox"] : ["cashflow"], {
			req: args.req,
			info: {
				message: "STEAM! " + result.user.name + " received " + result.shells + " SHELLS!",
				usd: purchase.usd,
				order_id: purchase._id,
			},
		});
		update_characters(result.user, null, null, result.shells).catch(console.error);
		if (result.referrer) {
			add_event(result.referrer, "referrer_cash", ["cashflow", "referrer"], {
				info: {
					message: "Referrer: " + result.referrer.name + " received " + result.referrer_shells + " shells from " + result.user.name + "[" + get_id(result.user) + "]",
					source: get_id(result.user),
					order_id: purchase._id,
				},
			});
			update_characters(result.referrer, null, null, result.referrer_shells).catch(console.error);
		}
		args.res.infs.push({ type: "success", message: phrase_html("server.api.you_received_shells", { amount: String(result.shells) }) });
	}
	return { success: true, cash: result.cash, shells: result.shells, already_delivered: result.already_delivered || false };
}

async function steam_payment_start_api(args) {
	var domain = await get_domain(args.req, args.user);
	var usd = Number(args.usd);
	if (!domain.tauri) return { failed: true, reason: "tauri_required" };
	if (STEAM_SHELL_USD_AMOUNTS.indexOf(usd) === -1) return { failed: true, reason: "invalid_amount" };

	var saved_steam_id = "" + (args.user.pid || "");
	if (args.user.platform !== "steam" || !/^[0-9]{16,20}$/.test(saved_steam_id)) return { failed: true, reason: "steam_account_required" };
	var ticket_steam_id = await verify_tauri_steam_ticket(args.ticket);
	if (!ticket_steam_id || ticket_steam_id !== saved_steam_id) return { failed: true, reason: "steam_auth_failed" };

	var event_bonus = Math.max(0, parseInt(extra_shells) || 0);
	var shells = purchased_shells_for_usd(usd, event_bonus);
	var sandbox = args.sandbox === true && is_admin(args.user);
	var purchase;
	try {
		purchase = await insert_steam_purchase(args.user, saved_steam_id, usd, shells, event_bonus, sandbox);
	} catch (e) {
		console.error("Steam purchase creation failed");
	}
	if (!purchase) return { failed: true, reason: "purchase_creation_failed" };

	var checkout_language = steam_checkout_language(domain.language);
	var initialized = await steam_microtxn_request(
		"POST",
		"InitTxn/v3",
		{
			steamid: saved_steam_id,
			usersession: "web",
			ipaddress: get_ip(args.req),
			orderid: purchase._id,
			itemcount: 1,
			language: checkout_language,
			currency: purchase.currency,
			"itemid[0]": purchase.item_id,
			"qty[0]": 1,
			"amount[0]": purchase.amount,
			"description[0]": localization.phrase("server.payment.shells", { count: purchase.shells }, checkout_language),
			"category[0]": "Shells",
		},
		sandbox,
	);
	if (!initialized.success) {
		await db
			.collection(STEAM_PURCHASE_COLLECTION)
			.updateOne({ _id: purchase._id }, { $set: { state: initialized.uncertain ? "init_unknown" : "init_failed", error_code: initialized.error_code || null, updated: new Date() } });
		return { failed: true, reason: initialized.config_error ? "steam_not_configured" : "steam_purchase_failed" };
	}

	purchase.trans_id = "" + (initialized.params.transid || "");
	var steam_url = steam_web_checkout_url(initialized.params.steamurl, purchase._id, purchase.return_token, args.req);
	if (!steam_url) {
		await db.collection(STEAM_PURCHASE_COLLECTION).updateOne({ _id: purchase._id }, { $set: { state: "checkout_unavailable", trans_id: purchase.trans_id, updated: new Date() } });
		return { failed: true, reason: "steam_checkout_unavailable" };
	}
	await db.collection(STEAM_PURCHASE_COLLECTION).updateOne({ _id: purchase._id }, { $set: { state: "initialized", trans_id: purchase.trans_id, updated: new Date() } });
	console.log("#A Tauri Steam purchase initialized: " + purchase._id);
	return { success: true, order_id: purchase._id, shells: purchase.shells, sandbox: purchase.sandbox, steam_url: steam_url };
}

async function steam_payment_finish_api(args) {
	var domain = await get_domain(args.req, args.user);
	var order_id = "" + (args.order_id || "");
	if (!domain.tauri) return { failed: true, reason: "tauri_required" };
	if (!/^[0-9]{1,20}$/.test(order_id)) return { failed: true, reason: "invalid_order" };

	var purchase = await db.collection(STEAM_PURCHASE_COLLECTION).findOne({ _id: order_id });
	if (!purchase || purchase.owner !== get_id(args.user)) return { failed: true, reason: "invalid_order" };
	if (purchase.steam_id !== "" + (args.user.pid || "")) return { failed: true, reason: "steam_account_mismatch" };
	if (purchase.state === "delivered") return grant_steam_shell_purchase(purchase, args);
	if (purchase.user_session === "web") {
		var web_query = await steam_microtxn_request("GET", "QueryTxn/v3", { orderid: order_id }, purchase.sandbox);
		var web_status = web_query.success && web_query.params && web_query.params.status;
		var web_steam_id = web_query.success && "" + (web_query.params.steamid || "");
		if (web_status === "Succeeded" && web_steam_id === purchase.steam_id) {
			purchase.trans_id = "" + (web_query.params.transid || purchase.trans_id || "");
			return grant_steam_shell_purchase(purchase, args);
		}
		if (web_status === "Init" || web_query.uncertain) return { failed: true, reason: "steam_payment_pending" };
		if (web_status !== "Approved" || web_steam_id !== purchase.steam_id) {
			await db
				.collection(STEAM_PURCHASE_COLLECTION)
				.updateOne({ _id: order_id, state: { $ne: "delivered" } }, { $set: { state: "failed", error_code: web_query.error_code || null, updated: new Date() } });
			return { failed: true, reason: "steam_purchase_failed" };
		}
	} else if (!args.authorized) {
		await db.collection(STEAM_PURCHASE_COLLECTION).updateOne({ _id: order_id, state: { $ne: "delivered" } }, { $set: { state: "declined", updated: new Date() } });
		return { failed: true, reason: "steam_purchase_cancelled" };
	}
	if (["declined", "init_failed", "checkout_unavailable", "failed"].indexOf(purchase.state) !== -1) return { failed: true, reason: "steam_purchase_failed" };

	await db.collection(STEAM_PURCHASE_COLLECTION).updateOne({ _id: order_id, state: { $ne: "delivered" } }, { $set: { state: "finalizing", authorized: new Date(), updated: new Date() } });
	var finalized = await steam_microtxn_request("POST", "FinalizeTxn/v2", { orderid: order_id }, purchase.sandbox);
	if (finalized.success) {
		purchase.trans_id = "" + (finalized.params.transid || purchase.trans_id || "");
		return grant_steam_shell_purchase(purchase, args);
	}

	var queried = await steam_microtxn_request("GET", "QueryTxn/v3", { orderid: order_id }, purchase.sandbox);
	var status = queried.success && queried.params && queried.params.status;
	var queried_steam_id = queried.success && "" + (queried.params.steamid || "");
	if (status === "Succeeded" && queried_steam_id === purchase.steam_id) {
		purchase.trans_id = "" + (queried.params.transid || purchase.trans_id || "");
		return grant_steam_shell_purchase(purchase, args);
	}
	if (status === "Init" || status === "Approved" || finalized.uncertain || queried.uncertain) {
		await db
			.collection(STEAM_PURCHASE_COLLECTION)
			.updateOne({ _id: order_id, state: { $ne: "delivered" } }, { $set: { state: status === "Init" ? "initialized" : "finalizing", updated: new Date() } });
		return { failed: true, reason: "steam_payment_pending" };
	}

	await db
		.collection(STEAM_PURCHASE_COLLECTION)
		.updateOne({ _id: order_id, state: { $ne: "delivered" } }, { $set: { state: "failed", error_code: finalized.error_code || queried.error_code || null, updated: new Date() } });
	return { failed: true, reason: "steam_purchase_failed" };
}

async function stripe_payment_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var response = args.response,
		usd = args.usd;
	var token = response && response.id;
	if (!token || !usd) {
		args.res.infs.push({ type: "func", func: "stripe_result", args: ["failed"] });
		return { failed: true, reason: "issue_with_token_or_usd" };
	}
	usd = Math.max(1, parseInt(usd));
	var shells = purchased_shells_for_usd(usd, extra_shells);

	try {
		var charge = await stripe.charges.create({
			amount: usd * 100,
			currency: "usd",
			description: shells + " SHELLS for " + usd + " USD",
			source: token,
		});
		add_event(user, "stripe", ["payments", "cashflow"], { req: args.req, info: { message: "STRIPE! " + user.name + " spent " + usd + " USD!", usd: usd, token: token, response: response } });

		var R = await tx(
			async () => {
				R.element = await tx_get(A.user);
				R.element.cash += A.shells;
				await tx_save(R.element);
			},
			{ user: user, shells: shells },
		);

		if (R.failed) {
			args.res.infs.push({ type: "func", func: "stripe_result", args: ["failed"] });
			return { failed: true, reason: "transaction_failed" };
		}

		add_event(R.element, "shells", ["cashflow"], { req: args.req, info: { message: "STRIPE! " + user.name + " received " + shells + " SHELLS!", usd: usd, token: token } });
		args.res.infs.push({ type: "func", func: "stripe_result", args: ["success", R.element.cash] });
		args.res.infs.push({ type: "success", message: phrase_html("server.api.you_received_shells", { amount: String(shells) }) });
		update_characters(R.element, null, null, shells).catch(console.error);

		// Referrer bonus: 10% of shells to the referrer
		try {
			if (R.element.referrer && shells >= 20) {
				var referrer = await get(R.element.referrer);
				if (referrer) {
					var referrer_shells = Math.round(shells * 0.1);
					add_event(referrer, "referrer_cash", ["cashflow", "referrer"], {
						info: {
							message: "Referrer: " + referrer.name + " received " + referrer_shells + " shells from " + user.name + "[" + get_id(user) + "]",
							source: get_id(user),
						},
					});
					var R2 = await tx(
						async () => {
							var entity = await tx_get(A.referrer);
							entity.info.rcash = gf(entity, "rcash", 0) + A.referrer_shells;
							entity.info.referrer_events = gf(entity, "referrer_events", 0) + 1;
							entity.cash += A.referrer_shells;
							await tx_save(entity);
						},
						{ referrer: referrer, referrer_shells: referrer_shells },
					);
					if (!R2.failed) {
						update_characters(referrer, null, null, referrer_shells).catch(console.error);
					}
				}
			}
		} catch (e) {
			console.error("referrer bonus error", e);
		}

		return { success: true };
	} catch (e) {
		if (e.type === "StripeCardError") {
			args.res.infs.push({ type: "func", func: "stripe_result", args: ["declined"] });
			return { failed: true, reason: "card_declined" };
		}
		console.error("stripe error", e);
		args.res.infs.push({ type: "func", func: "stripe_result", args: ["failed"] });
		return { failed: true, reason: "payment_failed" };
	}
}

// ==================== OTHER ====================

async function copy_map_api(args) {
	var user = args.user;
	if (!gf(user, "map_editor")) return { failed: true, reason: "no_permission" };
	for (var m in maps) {
		if (maps[m].key === args.to) return { failed: true, reason: "cant_copy_over_map_in_use" };
	}
	var from_map = await get("MP_" + args.from);
	if (from_map) {
		var to_map = await get("MP_" + args.to);
		if (to_map) await backup_entity(to_map);
		await save({ _id: "MP_" + args.to, name: args.to, created: new Date(), updated: new Date(), info: { data: from_map.info.data }, blobs: ["info"] });
		args.res.infs.push({ type: "success", message: phrase_html("server.api.done") });
	} else {
		args.res.infs.push({ type: "message", message: phrase_html("server.api.map_didn_t_exist") });
	}
	return { success: true };
}

async function delete_map_api(args) {
	var user = args.user;
	if (!gf(user, "map_editor")) return { failed: true, reason: "no_permission" };
	for (var m in maps) {
		if (maps[m].key === args.name) return { failed: true, reason: "cant_delete_map_in_use" };
	}
	var map = await get("MP_" + args.name);
	if (map) {
		await backup_entity(map);
		await remove(map);
		args.res.infs.push({ type: "success", message: phrase_html("server.api.deleted") });
	} else {
		args.res.infs.push({ type: "message", message: phrase_html("server.api.map_didn_t_exist") });
	}
	return { success: true };
}

async function load_article_api(args) {
	var name = to_filename("" + args.name);
	if (args.tutorial) {
		args.res.infs.push({ type: "article", html: shtml("docs/tutorial/" + name + ".html"), tutorial: args.tutorial, track: args.track, url: args.url });
	} else if (args.guide) {
		var col = [],
			prev = null,
			next = null,
			found = false;
		function traverse(entry) {
			if (Array.isArray(entry[0])) {
				for (var i = 0; i < entry.length; i++) traverse(entry[i]);
			} else {
				if (entry.length === 5 && entry[4]) traverse(entry[4]);
				else col.push(entry[0]);
			}
		}
		if (docs && docs.guide) traverse(docs.guide);
		for (var i = 0; i < col.length; i++) {
			if (col[i] === name) {
				found = true;
				if (i + 1 !== col.length) next = col[i + 1];
				break;
			}
			prev = col[i];
		}
		try {
			args.res.infs.push({ type: "article", html: shtml("docs/guide/" + name + ".html"), guide: args.guide, url: args.url, prev: found && prev, next: found && next });
		} catch (e) {
			try {
				args.res.infs.push({ type: "article", html: shtml("docs/articles/" + name + ".html"), url: args.url, prev: found && prev, next: found && next });
			} catch (e2) {
				args.res.infs.push({ type: "article", html: phrase_html("server.api.article_not_found", { name: name }), url: args.url });
			}
		}
	} else if (args.func) {
		args.res.infs.push({ type: "article", html: shtml("docs/functions/" + name + ".html"), func: name, url: args.url });
	} else {
		args.res.infs.push({ type: "article", html: shtml("docs/articles/" + name + ".html"), url: args.url });
	}
	return { success: true };
}

async function load_gcode_api(args) {
	var file = "" + args.file;
	if (file.includes("..")) return { failed: true };
	if (args.run) args.res.infs.push({ type: "code", code: shtml("docs" + file), run: true });
	else args.res.infs.push({ type: "gcode", code: shtml("docs" + file) });
	return { success: true };
}

async function load_map_api(args) {
	var map = await get("MP_" + args.key);
	if (!map || !gf(map, "resort")) {
		args.res.infs.push({ type: "message", message: phrase_html("server.api.deck_not_found"), color: "#AE384D" });
		return { failed: true };
	}
	args.res.infs.push({ type: "map", data: map.info.data });
	return { success: true };
}

function test_api(args) {
	return { success: true };
}

function hi_api(args) {
	return { success: true, response: "hello" };
}

// ==================== REF DEFINITIONS ====================

var REF = {
	signup_or_login: {
		F: signup_or_login_api,
		P: true,
		email: { type: "email" },
		password: { type: "string", minimum: 1 },
		only_login: { type: "boolean", optional: true },
		only_signup: { type: "boolean", optional: true },
		mobile: { type: "boolean", optional: true },
	},
	settings: {
		F: settings_api,
		P: true,
		U: true,
		setting: { type: "string" },
		value: { type: "any", optional: true },
	},
	change_email: {
		F: change_email_api,
		P: true,
		U: true,
		email: { type: "email" },
	},
	change_password: {
		F: change_password_api,
		P: true,
		U: true,
		epass: { type: "string", minimum: 1 },
		newpass1: { type: "string", minimum: 1 },
		newpass2: { type: "string", minimum: 1 },
	},
	reset_password: {
		F: reset_password_api,
		P: true,
		id: { type: "string" },
		key: { type: "string" },
		newpass1: { type: "string", minimum: 1 },
		newpass2: { type: "string", minimum: 1 },
	},
	password_reminder: {
		F: password_reminder_api,
		P: true,
		email: { type: "email" },
	},
	logout: { F: logout_api, P: true },
	logout_everywhere: { F: logout_everywhere_api, P: true, U: true },
	generate_token: { F: generate_token_api, P: true, U: true },
	token_status: { F: token_status_api, P: true, U: true },
	reveal_token: { F: reveal_token_api, P: true, U: true },
	revoke_token: { F: revoke_token_api, P: true, U: true },

	servers_and_characters: { F: servers_and_characters_api, P: true, U: true },
	load_bank: { F: load_bank_api, P: true, U: true },
	create_character: {
		F: create_character_api,
		P: true,
		U: true,
		name: { type: "string" },
		char: { type: "string" },
		look: { type: "any", optional: true },
	},
	sort_characters: {
		F: sort_characters_api,
		P: true,
		U: true,
		characters: { type: "string" },
	},
	rename_character: {
		F: rename_character_api,
		P: true,
		U: true,
		name: { type: "string" },
		nname: { type: "string" },
	},
	quote_name: {
		F: quote_name_api,
		P: true,
		U: true,
		name: { type: "string" },
		nname: { type: "string" },
	},
	transfer_character: {
		F: transfer_character_api,
		P: true,
		U: true,
		name: { type: "string" },
		id: { type: "string" },
		auth: { type: "string" },
	},
	delete_character: {
		F: delete_character_api,
		P: true,
		U: true,
		name: { type: "string" },
	},
	edit_character: {
		F: edit_character_api,
		P: true,
		U: true,
		name: { type: "string" },
		operation: { type: "string" },
	},
	disconnect_character: {
		F: disconnect_character_api,
		P: true,
		U: true,
		name: { type: "string" },
		selection: { type: "boolean", optional: true },
	},

	get_servers: { F: get_servers_api },
	can_reload: {
		F: can_reload_api,
		P: true,
		U: true,
		pvp: { type: "any", optional: true },
		region: { type: "string" },
		name: { type: "string" },
	},

	pull_friends: { F: pull_friends_api, P: true, U: true },
	pull_guild: { F: pull_guild_api, P: true, U: true },
	pull_merchants: { F: pull_merchants_api, P: true, U: true },

	read_mail: {
		F: read_mail_api,
		P: true,
		U: true,
		mail: { type: "string" },
	},
	pull_mail: {
		F: pull_mail_api,
		P: true,
		U: true,
		cursor: { type: "any", optional: true },
	},
	delete_mail: {
		F: delete_mail_api,
		P: true,
		U: true,
		mid: { type: "string" },
	},
	pull_messages: {
		F: pull_messages_api,
		P: true,
		U: true,
		type: { type: "string", optional: true },
		cursor: { type: "any", optional: true },
	},
	pull_chat: {
		F: pull_chat_api,
		P: true,
		server: { type: "string", optional: true },
		character: { type: "string", optional: true },
		to: { type: "string", optional: true },
		cursor: { type: "string", optional: true },
		after: { type: "string", optional: true },
	},
	pull_chats: {
		F: pull_chats_api,
		P: true,
		U: true,
		cursor: { type: "string", optional: true },
		after: { type: "string", optional: true },
	},
	send_message: {
		F: send_message_api,
		P: true,
		U: true,
		character: { type: "string" },
		message: { type: "string" },
		server: { type: "string", optional: true },
		to: { type: "string", optional: true },
	},
	save_code: {
		F: save_code_api,
		P: true,
		U: true,
		code: { type: "any", optional: true },
		slot: { type: "any" },
		name: { type: "string", optional: true },
		log: { type: "any", optional: true },
		auto: { type: "any", optional: true },
		electron: { type: "any", optional: true },
	},
	load_code: {
		F: load_code_api,
		P: true,
		U: true,
		name: { type: "any" },
		run: { type: "any", optional: true },
		log: { type: "any", optional: true },
		pure: { type: "any", optional: true },
		save: { type: "any", optional: true },
	},
	load_libraries: { F: load_libraries_api, P: true, U: true },
	list_codes: {
		F: list_codes_api,
		P: true,
		U: true,
		purpose: { type: "string", optional: true },
	},
	tutorial: {
		F: tutorial_api,
		P: true,
		U: true,
		task: { type: "string", optional: true },
		step: { type: "any", optional: true },
		lesson: { type: "string", optional: true },
		track: { type: "string", optional: true },
	},
	reset_tutorial: { F: reset_tutorial_api, P: true, U: true, track: { type: "string", optional: true } },

	stripe_payment: {
		F: stripe_payment_api,
		P: true,
		U: true,
		response: { type: "any", optional: true },
		usd: { type: "any" },
	},
	steam_payment_start: {
		F: steam_payment_start_api,
		P: true,
		U: true,
		ticket: { type: "string" },
		usd: { type: "number" },
		sandbox: { type: "boolean", optional: true },
	},
	steam_payment_finish: {
		F: steam_payment_finish_api,
		P: true,
		U: true,
		order_id: { type: "string" },
		authorized: { type: "boolean" },
	},
	copy_map: {
		F: copy_map_api,
		P: true,
		U: true,
		from: { type: "string" },
		to: { type: "string" },
	},
	delete_map: {
		F: delete_map_api,
		P: true,
		U: true,
		name: { type: "string" },
	},
	load_article: {
		F: load_article_api,
		P: true,
		name: { type: "string" },
		func: { type: "any", optional: true },
		tutorial: { type: "any", optional: true },
		track: { type: "string", optional: true },
		guide: { type: "any", optional: true },
		url: { type: "string", optional: true },
	},
	load_gcode: {
		F: load_gcode_api,
		P: true,
		U: true,
		file: { type: "string" },
		run: { type: "any", optional: true },
	},
	load_map: {
		F: load_map_api,
		P: true,
		U: true,
		key: { type: "string" },
	},
	test: {
		F: test_api,
		number: { type: "number", optional: true },
		must: { type: "string", optional: true },
	},
	hi: {
		F: hi_api,
		hello: { type: "boolean", optional: true },
	},
};
