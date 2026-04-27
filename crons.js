if (process.env.pm_id === "0" || !process.env.pm_id) {
	if (Prod)
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
	if (Prod || Staging) {
		setTimeout(occasional_backups, 60 * 60 * 1000);
		setTimeout(backup_everything_every_week, 60 * 60 * 1000);
	}
}

setTimeout(enforce_limitations, 6000);

async function occasional_backups() {
	try {
		console.log("occasional_backups() start");
		var start = new Date();
		await trigger_all_cron({ kind: "user", task: "to_backups" });
		await trigger_all_cron({ kind: "character", task: "to_backups" });
		console.log("occasional_backups() done in seconds: ", s_since(start));
	} catch (e) {
		console.log("occasional_backups: ", e);
	}
	setTimeout(occasional_backups, 60 * 60 * 1000);
}

async function backup_everything_every_week() {
	try {
		if (!(await get("IE_backups")) || d_since((await get("IE_backups")).info.last) >= 7) {
			console.log("backup_everything_every_week() start");
			var start = new Date();
			await save({ _id: "IE_backups", created: new Date(), info: { last: new Date() } });
			await trigger_all_cron({ kind: "user", task: "backup" });
			await trigger_all_cron({ kind: "character", task: "backup" });
			console.log("backup_everything_every_week() done in seconds: ", s_since(start));
		}
	} catch (e) {
		console.log("backup_everything_every_week: ", e);
	}
	setTimeout(backup_everything_every_week, 60 * 60 * 1000);
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
	if (task === "to_backups") query.to_backup = true;

	// console.log(query);

	var tasks = [];

	var entities = await db.collection(kind).find(query).toArray();
	for (var i = 0; i < entities.length; i++) {
		var element = post_get(entities[i]);
		// console.log(element._id);
		try {
			tasks.push(process_cron_entity(kind, task, element, args));
		} catch (e) {
			console.log("Entity error", kind, task, element._id, e);
		}
	}

	for (var i = 0; i < tasks.length; i++) await tasks[i];
}

async function process_cron_entity(kind, task, element, args) {
	if (task === "to_backups" || task == "backup") {
		await backup_entity(element);
		if (element.to_backup) {
			await db.collection(get_kind(element)).updateOne({ _id: element._id }, { $set: { to_backup: false } });
		}
	}
}

// ==================== CHECK SERVERS ====================

async function check_servers() {
	var offlines = [];
	var servers = await db.collection("server").find({ online: true }).toArray();
	for (var i = 0; i < servers.length; i++) {
		var server = post_get(servers[i]);
		if (ssince(server.updated) > 120 && server.machine != "local") {
			var R = await tx(
				async () => {
					var entity = await tx_get(A.server);
					if (!entity) return;
					entity.online = false;
					entity.info.players = 0;
					entity.info.observers = 0;
					entity.info.total_players = 0;
					entity.info.merchants = 0;
					await tx_save(entity);
				},
				{ server: server },
			);
			if (R.failed) {
				console.error("check_servers tx failed", server._id, R.reason);
			} else {
				console.log("Server offline: " + server._id);
				offlines.push(server.address + " " + server.machine + " " + server._id);
			}
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
		if (msince(server.updated) > 10) continue; // no - widespread network issue
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
			var character = post_get(stuck[i]);
			var m = msince(character.last_sync);
			await db.collection("character").updateOne({ _id: character._id }, { $set: { online: false, server: "", updated: new Date() } });
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
		var c = post_get(characters[i]);
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
	await trigger_all_cron({ kind: "character", task: "to_backups" });
}

async function backup_users_cron() {
	await trigger_all_cron({ kind: "user", task: "to_backups" });
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
	if (mname === "to_backups") {
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
	var domain = get_domain(req);
	var user = await get_user(req, domain);
	if (!(user && user.admin) && req.query.keyword !== keys.SERVER_MASTER) {
		return res.send("no permission");
	}
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
