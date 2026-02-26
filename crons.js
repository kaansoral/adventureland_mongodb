if (process.env.pm_id === "0" || !process.env.pm_id) {
	setInterval(
		async function () {
			// hourly
			await verify_steam_installs();
		},
		60 * 60 * 1000,
	);
	setInterval(
		async function () {
			// hourly
			await unstuck_characters();
		},
		5 * 60 * 1000,
	);
	setInterval(
		async function () {
			// hourly
			await check_servers();
		},
		1 * 60 * 1000,
	);
}

// ==================== EMAIL SENDERS ====================

async function send_announcement_email(user, purpose, title, text) {
	try {
		var domain = get_domain();
		var html = shtml("htmls/contents/announcement_email.html", { purpose: purpose, domain: domain, user: user });
		send_email(domain, user.info.email, { html: html, title: title, text: text });
	} catch (e) {
		console.log("Email failed: " + user._id, e);
	}
}

// ==================== BATCH CRON PROCESSING ====================

async function trigger_all_cron(args) {
	var kind = args.kind;
	var a_rand_max = models[kind].a_rand;
	for (var i = 0; i < a_rand_max; i++) {
		try {
			await process_shard(kind, args.task, i, args);
		} catch (e) {
			console.log("Shard error", kind, args.task, i, e);
		}
	}
}

async function process_shard(kind, task, rand, args) {
	var query = { a_rand: rand };
	if (task === "backups") query.to_backup = true;

	var entities = await db.collection(kind).find(query).toArray();
	for (var i = 0; i < entities.length; i++) {
		var element = post_get(kind, entities[i]);
		try {
			await process_cron_entity(kind, task, element, args);
		} catch (e) {
			console.log("Entity error", kind, task, element._id, e);
		}
	}
}

async function process_cron_entity(kind, task, element, args) {
	if (task === "backups") {
		await backup_entity(element);
		var R = await tx(
			async () => {
				var entity = await tx_get(A.element);
				entity.to_backup = false;
				await tx_save(entity);
			},
			{ element: element },
		);
		if (R.failed) console.error("backup tx failed", element._id, R.reason);
	}
}

// ==================== CHECK SERVERS ====================

async function check_servers() {
	var offlines = [];
	var servers = await db.collection("server").find({ online: true }).toArray();
	for (var i = 0; i < servers.length; i++) {
		var server = post_get("server", servers[i]);
		if (ssince(server.last_update) > 90) {
			server.online = false;
			server.info.players = 0;
			await db.collection("server").updateOne({ _id: server._id }, { $set: { online: false, updated: new Date(), info: server.info } });
			console.log("Server offline: " + server._id);
			offlines.push(server._id);
		}
	}
	if (offlines.length) {
		var domain = get_domain();
		send_email(domain, "kaansoral@gmail.com", { html: offlines.join(", "), title: "OFFLINE SERVERS DETECTED" });
	}
}

// ==================== UNSTUCK CHARACTERS ====================

async function unstuck_characters() {
	console.log("unstuck_characters()");
	var servers = await get_servers();
	var domain = get_domain();
	for (var si = 0; si < servers.length; si++) {
		var server = servers[si];
		if (msince(server.created) <= 10) continue; // no widespread network issue
		var cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
		var stuck = await db
			.collection("character")
			.find({
				online: true,
				server: server._id,
				last_sync: { $lt: cutoff },
			})
			.toArray();
		for (var i = 0; i < stuck.length; i++) {
			var character = post_get("character", stuck[i]);
			var m = msince(character.last_sync);
			// await db.collection("character").updateOne({ _id: character._id }, { $set: { online: false, server: "", updated: new Date() } });
			send_email(domain, "kaansoral@gmail.com", {
				html: "Stuck for " + m + " minutes",
				title: "MANUALLY UNSTUCK " + character.name + " from " + server._id,
			});
		}
	}
}

// ==================== VERIFY STEAM INSTALLS ====================

async function verify_steam_installs() {
	console.log("verify_steam_installs");
	var owners = [];
	var checks = {};
	var cutoff = new Date(Date.now() - 4 * 3600 * 1000); // 4 hours ago
	var characters = await db
		.collection("character")
		.find({
			platform: "steam",
			last_online: { $gte: cutoff },
		})
		.sort({ last_online: -1 })
		.limit(1000)
		.toArray();

	for (var i = 0; i < characters.length; i++) {
		var c = post_get("character", characters[i]);
		if (owners.indexOf(c.owner) === -1) {
			owners.push(c.owner);
			try {
				var response = await fetch(
					"https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v2/?key=" + encodeURIComponent(keys.steam_publisher_web_apikey) + "&appid=777150&steamid=" + encodeURIComponent(c.pid),
				);
				var text = await response.text();
				if (text.indexOf('"ownsapp":true') !== -1) {
					console.log(c.owner + " yes!");
				} else if (text.indexOf('"ownsapp":false') !== -1) {
					console.error(c.owner + " no!");
				} else {
					console.error(c.owner + " Unhandled output " + text);
				}
			} catch (e) {
				console.error("Steam check error for " + c.owner, e);
			}
		}
	}
}

// ==================== BACKUP CRONS ====================

async function backup_characters_cron() {
	await trigger_all_cron({ kind: "character", task: "backups" });
}

async function backup_users_cron() {
	await trigger_all_cron({ kind: "user", task: "backups" });
}

// ==================== CRON ROUTES ====================

app.all("/cr/check_servers", async function (req, res, next) {
	var domain = get_domain(req);
	var user = await get_user(req, domain);
	if (!(user && user.admin) && req.query.keyword !== keys.SERVER_MASTER) {
		return res.send("no permission");
	}
	await check_servers();
	await enforce_limitations();
	res.send("");
});

app.all("/cr/unstuck", async function (req, res, next) {
	var domain = get_domain(req);
	var user = await get_user(req, domain);
	if (!(user && user.admin) && req.query.keyword !== keys.SERVER_MASTER) {
		return res.send("no permission");
	}
	await unstuck_characters();
	res.send("");
});

app.all("/cr/all/:mname", async function (req, res, next) {
	var domain = get_domain(req);
	var user = await get_user(req, domain);
	if (!(user && user.admin) && req.query.keyword !== keys.SERVER_MASTER) {
		return res.send("no permission");
	}
	var mname = req.params.mname;
	if (mname === "user") {
		// Generic user batch cron - currently a no-op, implement specific task as needed
		console.log("all_user_cron triggered");
	}
	if (mname === "character") {
		// Generic character batch cron - currently a no-op, implement specific task as needed
		console.log("all_character_cron triggered");
	}
	if (mname === "backups") {
		// Originally, backups were on-access, but they need to be all at the same time,
		// so a reversal restores the ~whole state of the game [19/11/18]
		await backup_users_cron();
		await backup_characters_cron();
	}
	if (mname === "process_backups") {
		await backup_characters_cron();
	}
	res.send("");
});

// ==================== RUNNER (qwazy pattern) ====================

async function all_cron_handler(req, res, next) {
	var kind = req.params.kind;
	var task = req.params.task || "default";
	if (!models[kind] || !models[kind].a_rand) {
		return res.status(200).set("Content-Type", "text/plain").send("Not Found!");
	}
	trigger_all_cron({ kind: kind, task: task });
	res.status(200).set("Content-Type", "text/plain").send("Done!").end();
}

app.all("/cr/runner/:kind/:task", all_cron_handler);
app.all("/cr/runner/:kind", all_cron_handler);
