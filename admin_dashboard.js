var ADMIN_STEAM_APP_ID = 777150;
var ADMIN_STEAM_STATE_COLLECTION = "admin_steam_state";
var ADMIN_STEAM_MICROTXN_COLLECTION = "admin_steam_microtxn";
var ADMIN_STEAM_FINANCIAL_COLLECTION = "admin_steam_financial_daily";
var ADMIN_STEAM_PENDING_STATES = ["creating", "initialized", "finalizing", "init_unknown"];
var ADMIN_STEAM_FAILED_STATES = ["declined", "init_failed", "checkout_unavailable", "failed"];
var admin_steam_refresh_promise = null;

function admin_number(value) {
	value = Number(value);
	return Number.isFinite(value) ? value : 0;
}

function admin_money(value) {
	return "$" + admin_number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function admin_integer(value) {
	return Math.round(admin_number(value)).toLocaleString("en-US");
}

function admin_date(value) {
	if (!value) return "Never";
	var date = new Date(value);
	if (!Number.isFinite(date.getTime())) return "Unknown";
	return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function admin_financial_date(value) {
	if (typeof value === "string" && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value)) return value.replace(/\//g, "-");
	var date = new Date(value);
	return date.toISOString().slice(0, 10);
}

function admin_steam_time(value) {
	var date = new Date(value);
	if (!Number.isFinite(date.getTime())) return "";
	return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function admin_range_cutoff(days) {
	if (days === "all") return null;
	return new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
}

function admin_range_from_request(req) {
	var value = "" + (req.query.days || "30");
	return ["1", "7", "30", "all"].indexOf(value) === -1 ? "30" : value;
}

function admin_range_label(days) {
	if (days === "1") return "Last 24 Hours";
	if (days === "7") return "Last 7 Days";
	if (days === "30") return "Last 30 Days";
	return "All Recorded Time";
}

async function admin_steam_get(interface_name, method_name, version, key, values) {
	var controller = new AbortController();
	var timeout = setTimeout(function () {
		controller.abort();
	}, 20000);
	try {
		var url = new URL("https://partner.steam-api.com/" + interface_name + "/" + method_name + "/" + version + "/");
		url.searchParams.set("key", key);
		url.searchParams.set("format", "json");
		Object.keys(values || {}).forEach(function (name) {
			url.searchParams.set(name, values[name]);
		});
		var response = await fetch(url, { signal: controller.signal });
		if (!response.ok) throw new Error("steam_http_" + response.status);
		var body = await response.json();
		var result = (body && body.response) || {};
		if (result.result && result.result !== "OK" && result.result !== 1) throw new Error("steam_response_failure");
		return result;
	} catch (e) {
		if (e && /^steam_/.test(e.message || "")) throw e;
		throw new Error("steam_unavailable");
	} finally {
		clearTimeout(timeout);
	}
}

async function admin_set_sync_state(id, values) {
	values.updated = new Date();
	await db.collection(ADMIN_STEAM_STATE_COLLECTION).updateOne({ _id: id }, { $set: values, $setOnInsert: { created: new Date() } }, { upsert: true });
}

async function admin_refresh_builds() {
	var key = keys.steam_publisher_web_apikey;
	if (!key) return;
	var responses = await Promise.all([
		admin_steam_get("ISteamApps", "GetAppBuilds", "v1", key, { appid: ADMIN_STEAM_APP_ID, count: 20 }),
		admin_steam_get("ISteamApps", "GetAppBetas", "v1", key, { appid: ADMIN_STEAM_APP_ID }),
		admin_steam_get("ISteamApps", "GetAppDepotVersions", "v1", key, { appid: ADMIN_STEAM_APP_ID }),
	]);
	var branch_by_build = {};
	var branches = Object.keys(responses[1].betas || {}).map(function (name) {
		var beta = responses[1].betas[name] || {};
		var build_id = "" + (beta.BuildID || "Unknown");
		if (!branch_by_build[build_id]) branch_by_build[build_id] = [];
		branch_by_build[build_id].push(name);
		return {
			name: name,
			build_id: build_id,
			description: beta.Description || "No description",
		};
	});
	var builds = Object.keys(responses[0].builds || {})
		.map(function (build_key) {
			var build = responses[0].builds[build_key] || {};
			var build_id = "" + (build.BuildID || build_key);
			return {
				id: build_id,
				description: build.Description || "No description",
				created: new Date(admin_number(build.CreationTime) * 1000),
				branches: branch_by_build[build_id] || [],
				depots: Object.keys(build.depots || {}),
			};
		})
		.sort(function (a, b) {
			return new Date(b.created).getTime() - new Date(a.created).getTime();
		});
	await admin_set_sync_state("builds", {
		builds: builds,
		branches: branches,
		depots: Object.keys(responses[2].depots || {}),
		last_error: null,
	});
}

function admin_sanitize_microtxn(order) {
	var order_id = "" + (order.orderid || "0");
	var trans_id = "" + (order.transid || "0");
	var id = order_id !== "0" ? order_id : "trans_" + trans_id;
	return {
		_id: id,
		status: "" + (order.status || "Unknown"),
		currency: "" + (order.currency || ""),
		country: "" + (order.country || ""),
		time: order.time ? new Date(order.time) : null,
		time_created: order.timecreated ? new Date(order.timecreated) : null,
		items: (order.items || []).map(function (item) {
			return {
				item_id: "" + (item.itemid || ""),
				quantity: admin_number(item.qty),
				amount: admin_number(item.amount),
				vat: admin_number(item.vat),
				status: "" + (item.itemstatus || ""),
			};
		}),
		updated: new Date(),
	};
}

async function admin_refresh_microtransactions() {
	var key = keys.steam_publisher_web_apikey;
	if (!key) return;
	var state = await db.collection(ADMIN_STEAM_STATE_COLLECTION).findOne({ _id: "microtransactions" });
	var cursor = state && state.cursor;
	if (!cursor) {
		var first = await db
			.collection(STEAM_PURCHASE_COLLECTION)
			.find({ sandbox: { $ne: true } })
			.sort({ created: 1 })
			.limit(1)
			.toArray();
		var start = first.length ? new Date(first[0].created).getTime() - 60 * 60 * 1000 : Date.now() - 7 * 24 * 60 * 60 * 1000;
		cursor = admin_steam_time(start);
	}
	cursor = admin_steam_time(cursor);
	if (!cursor) cursor = admin_steam_time(Date.now() - 7 * 24 * 60 * 60 * 1000);

	var total = 0;
	for (var page = 0; page < 10; page++) {
		var response = await admin_steam_get("ISteamMicroTxn", "GetReport", "v5", key, {
			appid: ADMIN_STEAM_APP_ID,
			type: "SETTLEMENT",
			time: cursor,
			maxresults: 10000,
		});
		var params = response.params || {};
		var orders = Array.isArray(params.orders) ? params.orders : [];
		if (!orders.length) break;
		var operations = orders.map(function (order) {
			var clean = admin_sanitize_microtxn(order);
			return { replaceOne: { filter: { _id: clean._id }, replacement: clean, upsert: true } };
		});
		await db.collection(ADMIN_STEAM_MICROTXN_COLLECTION).bulkWrite(operations, { ordered: false });
		total += orders.length;
		var next_cursor = cursor;
		orders.forEach(function (order) {
			var order_time = admin_steam_time(order.time);
			if (order_time && new Date(order_time).getTime() > new Date(next_cursor).getTime()) next_cursor = order_time;
		});
		if (next_cursor === cursor) {
			cursor = next_cursor;
			break;
		}
		cursor = next_cursor;
	}
	await admin_set_sync_state("microtransactions", { cursor: cursor, records_seen: total, last_error: null });
}

function admin_financial_row_is_adventure_land(row) {
	if (row.line_item_type === "MicroTxn") return "" + row.appid === "" + ADMIN_STEAM_APP_ID;
	return "" + (row.primary_appid || row.appid || "") === "" + ADMIN_STEAM_APP_ID;
}

async function admin_fetch_financial_date(key, date) {
	var rows = [];
	var discounts = [];
	var highwatermark = "0";
	for (var page = 0; page < 50; page++) {
		var response = await admin_steam_get("IPartnerFinancialsService", "GetDetailedSales", "v001", key, {
			date: date,
			highwatermark_id: highwatermark,
		});
		rows = rows.concat((response.results || []).filter(admin_financial_row_is_adventure_land));
		discounts = discounts.concat(response.combined_discount_info || []);
		var next_highwatermark = "" + (response.max_id || highwatermark);
		if (next_highwatermark === highwatermark) break;
		highwatermark = next_highwatermark;
	}
	var used_discount_ids = {};
	rows.forEach(function (row) {
		if (row.combined_discount_id) used_discount_ids["" + row.combined_discount_id] = true;
	});
	discounts = discounts.filter(function (discount) {
		return used_discount_ids["" + discount.combined_discount_id];
	});
	await db.collection(ADMIN_STEAM_FINANCIAL_COLLECTION).replaceOne(
		{ _id: date },
		{
			_id: date,
			date: date,
			rows: rows,
			discounts: discounts,
			updated: new Date(),
		},
		{ upsert: true },
	);
}

async function admin_refresh_financials(batch_size) {
	var key = keys.steam_financial_web_apikey;
	if (!key) return;
	var state = (await db.collection(ADMIN_STEAM_STATE_COLLECTION).findOne({ _id: "financials" })) || {};
	var pending_dates = Array.isArray(state.pending_dates) ? state.pending_dates.slice() : [];
	var pending_highwatermark = state.pending_highwatermark || state.highwatermark || "0";

	if (!pending_dates.length) {
		var changed = await admin_steam_get("IPartnerFinancialsService", "GetChangedDatesForPartner", "v001", key, {
			highwatermark: state.highwatermark || "0",
		});
		pending_dates = Array.from(
			new Set(
				(changed.dates || []).map(function (date) {
					return admin_financial_date(date);
				}),
			),
		)
			.sort()
			.reverse();
		pending_highwatermark = "" + (changed.result_highwatermark || state.highwatermark || "0");
		await admin_set_sync_state("financials", {
			pending_dates: pending_dates,
			pending_highwatermark: pending_highwatermark,
			last_error: null,
		});
	}

	var limit = Math.max(1, Math.min(Number(batch_size) || 31, 100));
	for (var i = 0; i < limit && pending_dates.length; i++) {
		await admin_fetch_financial_date(key, pending_dates[0]);
		pending_dates.shift();
		var values = {
			pending_dates: pending_dates,
			pending_highwatermark: pending_highwatermark,
			last_error: null,
		};
		if (!pending_dates.length) {
			values.highwatermark = pending_highwatermark;
			values.last_complete = new Date();
		}
		await admin_set_sync_state("financials", values);
	}
}

async function admin_sync_is_stale(id, milliseconds) {
	var state = await db.collection(ADMIN_STEAM_STATE_COLLECTION).findOne({ _id: id });
	return !state || !state.updated || Date.now() - new Date(state.updated).getTime() >= milliseconds;
}

async function admin_run_sync(id, operation) {
	try {
		await operation();
	} catch (e) {
		console.error("Admin Steam sync failed: " + id);
		var message = "Steam API unavailable";
		if (e && /^steam_http_\d+$/.test(e.message || "")) message = "Steam API HTTP " + e.message.slice(11);
		else if (e && e.message === "steam_response_failure") message = "Steam API rejected the request";
		await admin_set_sync_state(id, { last_error: message });
	}
}

async function admin_refresh_steam_data(args) {
	args = args || {};
	if (admin_steam_refresh_promise) return admin_steam_refresh_promise;
	admin_steam_refresh_promise = (async function () {
		var tasks = [];
		if (keys.steam_publisher_web_apikey && (args.force || (await admin_sync_is_stale("builds", 5 * 60 * 1000)))) {
			tasks.push(admin_run_sync("builds", admin_refresh_builds));
		}
		if (keys.steam_publisher_web_apikey && (args.force || (await admin_sync_is_stale("microtransactions", 5 * 60 * 1000)))) {
			tasks.push(admin_run_sync("microtransactions", admin_refresh_microtransactions));
		}
		if (keys.steam_financial_web_apikey && (args.force || (await admin_sync_is_stale("financials", 60 * 60 * 1000)))) {
			tasks.push(
				admin_run_sync("financials", function () {
					return admin_refresh_financials(args.financial_batch || 31);
				}),
			);
		}
		await Promise.all(tasks);
	})();
	try {
		await admin_steam_refresh_promise;
	} finally {
		admin_steam_refresh_promise = null;
	}
}

async function admin_get_steam_shells(cutoff) {
	var match = { sandbox: { $ne: true } };
	if (cutoff) match.created = { $gte: cutoff };
	var rows = await db
		.collection(STEAM_PURCHASE_COLLECTION)
		.aggregate([
			{ $match: match },
			{
				$group: {
					_id: null,
					orders: { $sum: 1 },
					delivered: { $sum: { $cond: [{ $eq: ["$state", "delivered"] }, 1, 0] } },
					pending: { $sum: { $cond: [{ $in: ["$state", ADMIN_STEAM_PENDING_STATES] }, 1, 0] } },
					failed: { $sum: { $cond: [{ $in: ["$state", ADMIN_STEAM_FAILED_STATES] }, 1, 0] } },
					usd: { $sum: { $cond: [{ $eq: ["$state", "delivered"] }, { $ifNull: ["$usd", 0] }, 0] } },
					shells: { $sum: { $cond: [{ $eq: ["$state", "delivered"] }, { $ifNull: ["$shells", 0] }, 0] } },
					referrer_shells: { $sum: { $cond: [{ $eq: ["$state", "delivered"] }, { $ifNull: ["$referrer_shells", 0] }, 0] } },
				},
			},
		])
		.toArray();
	return rows[0] || { orders: 0, delivered: 0, pending: 0, failed: 0, usd: 0, shells: 0, referrer_shells: 0 };
}

async function admin_get_stripe_shells(cutoff) {
	var match = { type: "stripe" };
	if (cutoff) match.created = { $gte: cutoff };
	var rows = await db
		.collection("event")
		.aggregate([{ $match: match }, { $group: { _id: null, orders: { $sum: 1 }, usd: { $sum: { $ifNull: ["$info.usd", 0] } } } }])
		.toArray();
	return rows[0] || { orders: 0, usd: 0 };
}

function admin_empty_financial_metric() {
	return { gross_units: 0, returned_units: 0, net_units: 0, gross_usd: 0, returns_usd: 0, tax_usd: 0, net_usd: 0 };
}

function admin_add_financial_row(metric, row) {
	metric.gross_units += admin_number(row.gross_units_sold);
	metric.returned_units += admin_number(row.gross_units_returned);
	metric.net_units += admin_number(row.net_units_sold);
	metric.gross_usd += admin_number(row.gross_sales_usd);
	metric.returns_usd += admin_number(row.gross_returns_usd);
	metric.tax_usd += admin_number(row.net_tax_usd);
	metric.net_usd += admin_number(row.net_sales_usd);
}

function admin_summarize_financial_documents(documents) {
	var summary = { game: admin_empty_financial_metric(), microtransactions: admin_empty_financial_metric(), countries: {}, platforms: {}, discounts: {} };
	(documents || []).forEach(function (document) {
		var discount_names = {};
		(document.discounts || []).forEach(function (discount) {
			discount_names["" + discount.combined_discount_id] = discount.combined_discount_name || "Discount " + discount.combined_discount_id;
		});
		(document.rows || []).forEach(function (row) {
			if (!admin_financial_row_is_adventure_land(row)) return;
			if (row.line_item_type === "MicroTxn") {
				admin_add_financial_row(summary.microtransactions, row);
				return;
			}
			if (row.line_item_type !== "Package" || row.package_sale_type !== "Steam") return;
			admin_add_financial_row(summary.game, row);
			var country = row.country_code || "Unknown";
			var platform = row.platform || "Unknown";
			summary.countries[country] = admin_number(summary.countries[country]) + admin_number(row.net_sales_usd);
			summary.platforms[platform] = admin_number(summary.platforms[platform]) + admin_number(row.net_units_sold);
			if (row.combined_discount_id) {
				var discount_id = "" + row.combined_discount_id;
				var discount_name = discount_names[discount_id] || "Discount " + discount_id;
				summary.discounts[discount_name] = admin_number(summary.discounts[discount_name]) + admin_number(row.net_sales_usd);
			}
		});
	});
	return summary;
}

function admin_top_values(values, formatter) {
	return Object.keys(values || {})
		.map(function (name) {
			return { name: name, raw: admin_number(values[name]) };
		})
		.sort(function (a, b) {
			return b.raw - a.raw;
		})
		.slice(0, 8)
		.map(function (entry) {
			return { name: entry.name, value: formatter(entry.raw) };
		});
}

function admin_array(value, child_name) {
	if (Array.isArray(value)) return value;
	if (!value || typeof value !== "object") return [];
	if (Array.isArray(value[child_name])) return value[child_name];
	return Object.keys(value)
		.map(function (key) {
			return value[key];
		})
		.filter(function (entry) {
			return entry && typeof entry === "object";
		});
}

function admin_prepare_builds(state) {
	var builds = admin_array(state && state.builds, "builds");
	return builds
		.sort(function (a, b) {
			var a_time = new Date(a.created || a.updated || admin_number(a.CreationTime || a.timeupdated) * 1000).getTime();
			var b_time = new Date(b.created || b.updated || admin_number(b.CreationTime || b.timeupdated) * 1000).getTime();
			return b_time - a_time;
		})
		.slice(0, 12)
		.map(function (build) {
			var branch_names = [];
			if (Array.isArray(build.branches)) branch_names = build.branches;
			else if (build.branches && typeof build.branches === "object") branch_names = Object.keys(build.branches);
			return {
				id: "" + (build.id || build.BuildID || build.buildid || "Unknown"),
				description: build.description || build.Description || "No description",
				updated: admin_date(build.created || build.updated || admin_number(build.CreationTime || build.timeupdated) * 1000),
				branches: branch_names.join(", ") || "—",
				depots: (build.depots || []).join ? build.depots.join(", ") || "—" : Object.keys(build.depots || {}).join(", ") || "—",
			};
		});
}

function admin_prepare_branches(state) {
	return admin_array(state && (state.branches || (state.betas && state.betas.betas)), "betas").map(function (branch) {
		return {
			name: branch.name || "Unknown",
			build_id: "" + (branch.build_id || branch.BuildID || "Unknown"),
			description: branch.description || branch.Description || "No description",
		};
	});
}

function admin_mask_identifier(value) {
	value = "" + (value || "");
	if (value.length <= 6) return value || "—";
	return "…" + value.slice(-6);
}

async function admin_get_recent_steam_purchases() {
	var purchases = await db
		.collection(STEAM_PURCHASE_COLLECTION)
		.find({ sandbox: { $ne: true } })
		.sort({ created: -1 })
		.limit(30)
		.toArray();
	var owner_ids = Array.from(
		new Set(
			purchases.map(function (purchase) {
				return purchase.owner;
			}),
		),
	);
	var users = owner_ids.length
		? await db
				.collection("user")
				.find({ _id: { $in: owner_ids } })
				.project({ _id: 1, name: 1 })
				.toArray()
		: [];
	var user_names = {};
	users.forEach(function (user) {
		user_names[user._id] = user.name;
	});
	var order_ids = purchases.map(function (purchase) {
		return purchase._id;
	});
	var reports = order_ids.length
		? await db
				.collection(ADMIN_STEAM_MICROTXN_COLLECTION)
				.find({ _id: { $in: order_ids } })
				.toArray()
		: [];
	var report_status = {};
	reports.forEach(function (report) {
		report_status[report._id] = report.status;
	});
	return purchases.map(function (purchase) {
		return {
			created: admin_date(purchase.created),
			owner: user_names[purchase.owner] || purchase.owner,
			order_id: admin_mask_identifier(purchase._id),
			usd: admin_money(purchase.usd),
			shells: admin_integer(purchase.shells),
			bonus: purchase.extra_shells ? "+" + admin_integer(purchase.extra_shells) + "%" : "—",
			state: purchase.state || "unknown",
			steam_state: report_status[purchase._id] || "Not reconciled",
		};
	});
}

async function admin_get_dashboard(days) {
	var cutoff = admin_range_cutoff(days);
	var financial_query = {};
	if (cutoff) financial_query._id = { $gte: admin_financial_date(cutoff) };
	var results = await Promise.all([
		admin_get_steam_shells(cutoff),
		admin_get_stripe_shells(cutoff),
		db.collection(ADMIN_STEAM_FINANCIAL_COLLECTION).find(financial_query).toArray(),
		db
			.collection(ADMIN_STEAM_STATE_COLLECTION)
			.find({ _id: { $in: ["builds", "microtransactions", "financials"] } })
			.toArray(),
		admin_get_recent_steam_purchases(),
	]);
	var steam_shells = results[0];
	var stripe_shells = results[1];
	var financial = admin_summarize_financial_documents(results[2]);
	var states = {};
	results[3].forEach(function (state) {
		states[state._id] = state;
	});
	var financial_state = states.financials || {};
	var publisher_configured = !!keys.steam_publisher_web_apikey;
	var financial_configured = !!keys.steam_financial_web_apikey;
	return {
		range: days,
		range_label: admin_range_label(days),
		publisher_configured: publisher_configured,
		financial_configured: financial_configured,
		publisher_status: publisher_configured ? "Configured" : "Missing steam_publisher_web_apikey",
		financial_status: financial_configured ? "Configured" : "Missing steam_financial_web_apikey",
		build_sync: admin_date(states.builds && states.builds.updated),
		microtxn_sync: admin_date(states.microtransactions && states.microtransactions.updated),
		financial_sync: admin_date(financial_state.updated),
		financial_backfill: (financial_state.pending_dates || []).length,
		build_error: (states.builds && states.builds.last_error) || "",
		microtxn_error: (states.microtransactions && states.microtransactions.last_error) || "",
		financial_error: financial_state.last_error || "",
		steam_shells: {
			usd: admin_money(steam_shells.usd),
			orders: admin_integer(steam_shells.delivered),
			shells: admin_integer(steam_shells.shells),
			referrer_shells: admin_integer(steam_shells.referrer_shells),
			pending: admin_integer(steam_shells.pending),
			failed: admin_integer(steam_shells.failed),
		},
		stripe_shells: {
			usd: admin_money(stripe_shells.usd),
			orders: admin_integer(stripe_shells.orders),
		},
		all_shells_usd: admin_money(admin_number(steam_shells.usd) + admin_number(stripe_shells.usd)),
		game_sales: {
			gross_usd: admin_money(financial.game.gross_usd),
			net_usd: admin_money(financial.game.net_usd),
			gross_units: admin_integer(financial.game.gross_units),
			returned_units: admin_integer(Math.abs(financial.game.returned_units)),
			net_units: admin_integer(financial.game.net_units),
		},
		steam_reported_shells: {
			gross_usd: admin_money(financial.microtransactions.gross_usd),
			net_usd: admin_money(financial.microtransactions.net_usd),
			units: admin_integer(financial.microtransactions.net_units),
		},
		countries: admin_top_values(financial.countries, admin_money),
		platforms: admin_top_values(financial.platforms, admin_integer),
		discounts: admin_top_values(financial.discounts, admin_money),
		builds: admin_prepare_builds(states.builds),
		branches: admin_prepare_branches(states.builds),
		purchases: results[4],
	};
}

app.get("/admin", async function (req, res) {
	var user = await get_user(req);
	if (!is_admin(user)) return res.status(403).set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").send("No Auth");
	var domain = await get_domain(req, user);
	var days = admin_range_from_request(req);
	domain.title = "Adventure Land Admin";
	res.set("Cache-Control", "no-store");
	res.set("X-Robots-Tag", "noindex, nofollow");
	admin_refresh_steam_data({ force: false }).catch(function () {});
	var dashboard = await admin_get_dashboard(days);
	return res.status(200).send(nunjucks.render("htmls/admin.html", { domain: domain, user: user, dashboard: dashboard }));
});

app.post("/admin/refresh", async function (req, res) {
	var user = await get_user(req);
	if (!is_admin(user)) return res.status(403).set("Cache-Control", "no-store").send("No Auth");
	await admin_refresh_steam_data({ force: true, financial_batch: 31 });
	return res.redirect(303, "/admin?days=" + admin_range_from_request(req));
});

if (Prod && (process.env.pm_id === "0" || !process.env.pm_id) && (keys.steam_publisher_web_apikey || keys.steam_financial_web_apikey)) {
	var admin_sync_timeout = setTimeout(function () {
		admin_refresh_steam_data({ force: false }).catch(function () {});
	}, 15000);
	var admin_sync_interval = setInterval(
		function () {
			admin_refresh_steam_data({ force: false }).catch(function () {});
		},
		15 * 60 * 1000,
	);
	if (admin_sync_timeout.unref) admin_sync_timeout.unref();
	if (admin_sync_interval.unref) admin_sync_interval.unref();
}
