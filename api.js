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

async function signup_or_login_api(args) {
	var domain = await get_domain(args.req),
		email = args.email,
		password = args.password,
		existing = await get_user_by_email(email);

	if (existing && existing.server && msince(existing.last_online) < 15 && msince(gf(existing, "last_auth", really_old)) < 15) return { failed: true, reason: "cant_login_inside_bank" };

	if (!domain.electron && !args.only_login && !Dev) return { failed: true, reason: "cant_signup_on_web" };

	if (existing && !args.only_signup) {
		if (existing.password == hash_password(password, gf(existing, "salt", "5"))) {
			var R = await tx(
				async () => {
					R.user = await tx_get(A.user);
					R.auth = get_new_auth(R.user);
					await tx_save(R.user);
				},
				{ user: existing },
			);
			if (R.failed) return { failed: true, reason: R.reason || "login_failed" };
			set_cookie(args.res, options.cookie_key, get_id(R.user) + "-" + R.auth, domain.domain);
			if (args.mobile) {
				args.res.infs.push({ type: "refresh" });
				return { success: true, user: get_id(R.user), auth: R.auth };
			}
			args.res.infs.push({ type: "message", message: "Logged In!" });
			args.res.infs.push(await selection_info(args.req, R.user, domain));
			return { success: true, user: get_id(R.user), auth: R.auth };
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
			var salt = random_string(20);
			var hpassword = hash_password(A.password, salt);
			R.user = {
				_id: "US_" + random_string(29),
				created: new Date(),
				updated: new Date(),
				a_rand: (Dev && 25) || 500,
				name: "#" + A.signupth,
				email: [A.email],
				password: hpassword,
				credits: 0,
				banned: false,
				referrer: (A.referrer && get_id(A.referrer)) || "",
				timezone: 0,
				cash: 0,
				worth: 0,
				language: "en",
				platform: "",
				pid: "",
				guild: "",
				server: "",
				friends: [],
				last_online: new Date(),
				cli_time: null,
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
		},
		{ email: email, password: password, signupth: signupth, referrer: referrer, slots: domain.electron ? 8 : 5, ip: get_ip(args.req), country: get_country(args.req) },
	);

	if (R.failed) return { failed: true, reason: R.reason };

	set_cookie(args.res, options.cookie_key, get_id(R.user) + "-" + R.auth, domain.domain);
	send_verification_email(domain, R.user);
	args.res.infs.push({ type: "success", message: "Signup Complete!" });
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

	return { success: true, user: get_id(R.user), auth: R.auth };
}

async function settings_api(args) {
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
	args.res.infs.push({ type: "success", message: "Setting changed!" });
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
	args.res.infs.push({ type: "success", message: "Email changed! Verification email re-sent. Refresh the page." });
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
	args.res.infs.push({ type: "success", message: "Password changed!" });
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
	args.res.infs.push({ type: "success", message: "New password set!" });
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
	args.res.infs.push({ type: "success", message: "Emailed password reset instructions" });
	return { success: true };
}

async function logout_api(args) {
	delete_cookie(args.res, options.cookie_key, args.req.get ? args.req.get("host").split(":")[0] : "");
	args.res.infs.push({ type: "message", message: "Logged Out" });
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
	delete_cookie(args.res, options.cookie_key, args.req.get ? args.req.get("host").split(":")[0] : "");
	args.res.infs.push({ type: "message", message: "Logged Out Everywhere" });
	return { success: true };
}

// ==================== CHARACTER MANAGEMENT ====================

async function servers_and_characters_api(args) {
	var domain = await get_domain(args.req),
		user = args.user;
	var user_data = await get_user_data(user);
	var characters_data = await get_characters(user);
	var characters = characters_to_client(characters_data);
	var servers_data = await get_servers();
	var servers = servers_to_client(domain, servers_data);
	var mail = gf(user_data, "mail", 0);

	args.res.infs.push({
		type: "servers_and_characters",
		servers: servers,
		characters: characters,
		tutorial: data_to_tutorial(user_data),
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
				a_rand: (Dev && 25) || 500,
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

	args.res.infs.push({ type: "success", message: name + " is alive!" });
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
	args.res.infs.push({ type: "message", message: "Done!" });
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
	args.res.infs.push({ type: "message", message: "Spent " + to_pretty_num(price) + " shells" });
	args.res.infs.push({ type: "message", message: name + " renamed to " + nname });
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
	args.res.infs.push({ type: "message", message: name + " flew away ..." });
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
	args.res.infs.push({ type: "message", message: name + " is no more ..." });
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
	var message = "Done!";
	if (operation === "toggle_privacy") {
		if (R.element.private) {
			message = "Character is now private";
			if (simplify_name(user.name) === R.element.name) message += " WARNING: SORT YOUR CHARACTERS ONCE TO AUTO-CHANGE YOUR ACCOUNT NAME";
		} else message = "Character isn't private anymore";
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
	await character_eval(character, "player.socket.disconnect()");
	args.res.infs.push({ type: "message", message: "Sent the disconnect signal to the server" });
	if (args.selection) args.res.infs.push(await selection_info(args.req, user, domain));
	return { success: true };
}

// ==================== SERVER MANAGEMENT ====================

async function get_servers_api(args) {
	var server_list = await get_servers();
	var servers = [];
	for (var i = 0; i < server_list.length; i++) {
		var s = server_list[i];
		servers.push({ ip: s.ip, port: s.port, region: s.region, name: s.name, pvp: gf(s, "pvp"), gameplay: s.gameplay });
	}
	return { success: true, servers: servers };
}

async function can_reload_api(args) {
	var user = args.user;
	var servers = await get_servers();
	for (var i = 0; i < servers.length; i++) {
		var server = servers[i];
		if (server.region === args.region && server.name === args.name && (args.pvp ? gf(server, "pvp") : !gf(server, "pvp"))) {
			args.res.infs.push({ type: "reload", ip: server.ip, port: server.port });
			return { success: true };
		}
	}
	return { success: true };
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

async function read_mail_api(args) {
	var user = args.user;
	var user_data = await get_user_data(user);

	var R = await tx(
		async () => {
			var mail = await tx_get("ML_" + A.mail_id);
			if (mail && !mail.read && gf(mail, "receiver") === get_id(A.user)) {
				mail.read = true;
				await tx_save(mail);
			}
		},
		{ mail_id: args.mail, user: user },
	);

	var unread = await db
		.collection("mail")
		.find({ owner: get_id(user), read: false })
		.limit(100)
		.toArray();
	var old = gf(user_data, "mail", -1);
	user_data.info.mail = Math.max(0, unread.length - 1);
	if (old !== user_data.info.mail) safe_save(user_data);
	args.res.infs.push({ type: "unread", count: user_data.info.mail });
	return { success: true };
}

async function pull_mail_api(args) {
	var user = args.user;
	var data = { type: "mail", mail: [], more: false, cursor: null, cursored: false };
	var page = 40;

	var query = { owner: get_id(user) };
	var cursor_skip = args.cursor ? parseInt(args.cursor) || 0 : 0;
	if (cursor_skip) data.cursored = true;
	var mails = await db
		.collection("mail")
		.find(query)
		.sort({ created: -1 })
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
		if (mail.item) {
			mail_data.item = simplify_item(mail.info.item);
			mail_data.taken = mail.taken;
		}
		data.mail.push(mail_data);
	}
	args.res.infs.push(data);
	return { success: true };
}

async function delete_mail_api(args) {
	var user = args.user;
	var mail = await get(args.mid);
	if (!user || !mail || !mail.owner || mail.owner.indexOf(get_id(user)) === -1) return { failed: true, reason: "cant_delete" };
	await remove(mail);
	args.res.infs.push({ type: "message", message: "Mail deleted." });
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
		if (args.log) args.res.infs.push({ type: "chat_log", message: "Deleted " + old_name + "." + slot + ".js", color: "gray" });
		else args.res.infs.push({ type: "chat_log", message: "Deleted " + old_name + "." + slot + ".js", color: "gray" });
	} else {
		args.res.infs.push({ type: "code_info", num: slot, name: data.info.code_list[slot][0], v: data.info.code_list[slot][1] });
		if (!args.electron) args.res.infs.push({ type: "eval", code: "code_slot=" + JSON.stringify("" + slot) + ";code_change=false;" });
		if (args.log) args.res.infs.push({ type: "chat_log", message: "Saved " + name + "." + slot + ".js", color: "#E13758" });
		else if (args.auto && character) args.res.infs.push({ type: "chat_log", message: "Auto-saved [" + character + "]", color: "#96E8A7" });
		else if (args.auto) args.res.infs.push({ type: "chat_log", message: "Auto-saved " + name + "." + slot + ".js", color: "#96E8A7" });
		else args.res.infs.push({ type: "chat_log", message: "Saved " + name + "." + slot + ".js", color: "#E13758" });
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
		if (args.log) args.res.infs.push({ type: "chat_log", message: "Loaded the default code", color: "#32A3B0" });
		return { success: true };
	}

	var code_list = gf(data, "code_list", {});
	for (var slot in code_list) {
		if ("" + slot === "" + name || ("" + code_list[slot][0]).toLowerCase() === ("" + name).toLowerCase()) {
			var code_entity = await get("IE_USERCODE-" + get_id(user) + "-" + slot);
			if (!code_entity) {
				console.log("WARNING: code_list has slot " + slot + " but USERCODE entity missing: IE_USERCODE-" + get_id(user) + "-" + slot);
			}
			if (code_entity) {
				if (args.pure) return { code: code_entity.info.code };
				args.res.infs.push({ type: "code", code: code_entity.info.code, run: args.run, slot: slot, save: args.save, name: code_list[slot][0], v: code_list[slot][1] });
				if (args.log) args.res.infs.push({ type: "chat_log", message: "Loaded " + code_list[slot][0] + "." + slot + ".js", color: "#32A3B0" });
				return { success: true };
			}
		}
	}
	if (args.pure) return { code: "say('Code not found'); set_status('Not Found')" };
	args.res.infs.push({ type: "chat_log", message: "Not Found", color: "#AD3844" });
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
	var user = args.user,
		task = args.task,
		step = args.step;

	var R = await tx(
		async () => {
			var data = await get_user_data(A.user);
			if (A.task) {
				if (docs.tasks && docs.tasks[A.task] && data.info.completed_tasks.indexOf(A.task) === -1) {
					data.info.completed_tasks.push(A.task);
					await tx_save(data);
					R.result = ["Task '" + docs.tasks[A.task] + "' Complete!", "#85C76B", data, 1];
				} else {
					if (docs.tasks && docs.tasks[A.task]) R.result = ["Task '" + docs.tasks[A.task] + "' Complete!", "gray", data, 1];
					else R.result = ["Invalid task '" + A.task + "'", "gray", data, 0];
				}
			} else {
				data.info.tutorial_step = parseInt(A.step);
				await tx_save(data);
				R.result = ["Lesson '" + docs.tutorial[parseInt(A.step) - 1].title + "' Complete!", "#85C76B", data, 2];
			}
		},
		{ user: user, task: task, step: step },
	);

	if (R.failed) return { failed: true, reason: "failed" };
	if (R.result) {
		var info = data_to_tutorial(R.result[2]);
		info.type = "tutorial_data";
		if (R.result[3] === 1) info.success = true;
		if (R.result[3] === 2) info.next = true;
		args.res.infs.push(info);
		args.res.infs.push({ type: "chat_log", message: R.result[0], color: R.result[1] });
	}
	return { success: true };
}

async function reset_tutorial_api(args) {
	var user = args.user;

	var R = await tx(
		async () => {
			var data = await get_user_data(A.user);
			data.info.completed_tasks = [];
			data.info.tutorial_step = 0;
			await tx_save(data);
			R.data = data;
		},
		{ user: user },
	);

	if (R.failed) return { failed: true, reason: "failed" };
	var info = data_to_tutorial(R.data);
	info.type = "tutorial_data";
	args.res.infs.push(info);
	args.res.infs.push({ type: "chat_log", message: "Tutorial Reset!", color: "#F7B32F" });
	return { success: true };
}

// ==================== BILLING ====================

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
	var shells = usd * 80;
	if (usd >= 500) shells = Math.floor(shells * 1.24);
	else if (usd >= 100) shells = Math.floor(shells * 1.16);
	else if (usd >= 25) shells = Math.floor(shells * 1.08);
	if (extra_shells) shells = Math.floor((shells * (100 + extra_shells)) / 100.0);

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
		args.res.infs.push({ type: "success", message: "You received " + shells + " SHELLS!" });
		update_characters(R.element).catch(console.error);
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

async function cli_time_api(args) {
	var user = args.user;
	var amount = 29;
	if (user.cli_time && dsince(user.cli_time) < -30) return { failed: true, reason: "cant_purchase_more_than_30_days" };
	if (user.server) return { failed: true, reason: "cant_purchase_in_bank" };

	var R = await tx(
		async () => {
			R.element = await tx_get(A.user);
			if (A.amount > 0 && R.element.cash < A.amount) ex("not_enough");
			R.element.cash -= A.amount;
			if (!R.element.cli_time || R.element.cli_time < new Date()) R.element.cli_time = new Date();
			R.element.cli_time = new Date(R.element.cli_time.getTime() + 7 * 24 * 3600 * 1000);
			await tx_save(R.element);
		},
		{ user: user, amount: amount },
	);

	if (R.failed) return { failed: true, reason: "purchase_failed" };
	args.res.infs.push({ type: "message", message: "Purchased 7 more days of CLI time for " + amount + " shells!" });
	return { success: true };
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
		args.res.infs.push({ type: "success", message: "Done!" });
	} else {
		args.res.infs.push({ type: "info", message: "Map didn't exist" });
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
		args.res.infs.push({ type: "success", message: "Deleted!" });
	} else {
		args.res.infs.push({ type: "info", message: "Map didn't exist" });
	}
	return { success: true };
}

async function load_article_api(args) {
	var name = to_filename("" + args.name);
	if (args.tutorial) {
		args.res.infs.push({ type: "article", html: shtml("docs/tutorial/" + name + ".html"), tutorial: args.tutorial, url: args.url });
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
			args.res.infs.push({ type: "article", html: shtml("docs/articles/" + name + ".html"), url: args.url, prev: found && prev, next: found && next });
		}
	} else if (args.func) {
		args.res.infs.push({ type: "article", html: shtml("docs/functions/" + name + ".html"), func: name, url: args.url });
	} else {
		args.res.infs.push({ type: "article", html: shtml("docs/articles/" + name + ".html"), url: args.url });
	}
	return { success: true };
}

async function load_gcode_api(args) {
	var file = args.file;
	if (args.run) args.res.infs.push({ type: "code", code: shtml("docs" + file), run: true });
	else args.res.infs.push({ type: "gcode", code: shtml("docs" + file) });
	return { success: true };
}

async function load_map_api(args) {
	var map = await get("MP_" + args.key);
	if (!map || !gf(map, "resort")) {
		args.res.infs.push({ type: "chat_log", message: "Deck not found", color: "#AE384D" });
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

	servers_and_characters: { F: servers_and_characters_api, P: true, U: true },
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
	},
	reset_tutorial: { F: reset_tutorial_api, P: true, U: true },

	stripe_payment: {
		F: stripe_payment_api,
		P: true,
		U: true,
		response: { type: "any", optional: true },
		usd: { type: "any" },
	},
	cli_time: { F: cli_time_api, P: true, U: true },

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
