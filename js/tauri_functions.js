/* global show_alert */

var tauri_data = { ready: false, ticket: "", error: "" };
var tauri_auth_promise = null;
var tauri_reload_pending = false;
var tauri_invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
var tauri_debug_started = Date.now();
var tauri_debug_sequence = 0;

function tauri_debug(stage, details, level) {
	details = details || {};
	details.sequence = ++tauri_debug_sequence;
	details.elapsed_ms = Date.now() - tauri_debug_started;
	var method = level == "error" ? "error" : level == "warn" ? "warn" : "log";
	console[method]("[Tauri Debug] " + stage, details);
}

function tauri_auth_snapshot() {
	return {
		ticket_available: !!tauri_data.ticket,
		native_error: tauri_data.error || "",
		steam_available: tauri_data.steam_available === true,
		purchases_supported: tauri_data.purchases === true,
		native_build: tauri_data.native_build || "unknown",
		native_platform: tauri_data.native_platform || "unknown",
	};
}

function tauri_store_auth(data) {
	data = data || {};
	tauri_data = {
		ready: true,
		ticket: data.ticket || "",
		error: data.error || "",
		purchases: data.purchases === true,
		steam_available: data.steam_available === true,
		native_build: data.build || "unknown",
		native_platform: data.platform || "unknown",
	};
	return tauri_data;
}

function tauri_prepare_auth() {
	if (!tauri_invoke) {
		tauri_debug("auth.prepare.unavailable", { reason: "tauri_api_unavailable" }, "error");
		return Promise.reject(new Error("Tauri API unavailable"));
	}
	if (tauri_data.ready) {
		tauri_debug("auth.prepare.cached", tauri_auth_snapshot());
		return Promise.resolve(tauri_data);
	}
	if (tauri_auth_promise) {
		tauri_debug("auth.prepare.join_pending");
		return tauri_auth_promise;
	}
	var initial_started = Date.now();
	tauri_debug("auth.prepare.start", { attempt: "initial" });
	var request = tauri_invoke("get_steam_auth")
		.then(tauri_store_auth)
		.then(function (auth) {
			tauri_debug("auth.prepare.result", Object.assign({ attempt: "initial", duration_ms: Date.now() - initial_started }, tauri_auth_snapshot()));
			if (auth.ticket) return auth;
			var retry_started = Date.now();
			tauri_debug("auth.prepare.retry", { attempt: "refresh", previous_error: auth.error || "" }, "warn");
			return tauri_invoke("refresh_steam_auth")
				.then(tauri_store_auth)
				.then(function (retry_auth) {
					tauri_debug("auth.prepare.result", Object.assign({ attempt: "refresh", duration_ms: Date.now() - retry_started }, tauri_auth_snapshot()));
					return retry_auth;
				})
				.catch(function (error) {
					tauri_debug("auth.prepare.retry_failed", { reason: "" + ((error && error.message) || error || "unknown") }, "error");
					return auth;
				});
		})
		.catch(function (error) {
			tauri_debug("auth.prepare.failed", { reason: "" + ((error && error.message) || error || "unknown") }, "error");
			throw error;
		})
		.finally(function () {
			if (tauri_auth_promise == request) tauri_auth_promise = null;
		});
	tauri_auth_promise = request;
	return request;
}

function tauri_refresh_auth() {
	if (!tauri_invoke) {
		tauri_debug("auth.refresh.unavailable", { reason: "tauri_api_unavailable" }, "error");
		return Promise.reject(new Error("Tauri API unavailable"));
	}
	var started = Date.now();
	var command = "refresh_steam_auth";
	tauri_debug("auth.refresh.start");
	return tauri_invoke("refresh_steam_auth")
		.catch(function (error) {
			var message = "" + ((error && error.message) || error || "");
			if (message.indexOf("refresh_steam_auth") !== -1) {
				command = "get_steam_auth";
				tauri_debug("auth.refresh.compatibility_fallback", { reason: message }, "warn");
				return tauri_invoke("get_steam_auth");
			}
			throw error;
		})
		.then(tauri_store_auth)
		.then(function (auth) {
			tauri_debug("auth.refresh.result", Object.assign({ command: command, duration_ms: Date.now() - started }, tauri_auth_snapshot()));
			return auth;
		})
		.catch(function (error) {
			tauri_debug("auth.refresh.failed", { command: command, duration_ms: Date.now() - started, reason: "" + ((error && error.message) || error || "unknown") }, "error");
			throw error;
		});
}

function tauri_auth_ready() {
	return tauri_data.ready;
}

function tauri_auth_payload() {
	tauri_debug("auth.socket.send", { ticket_available: !!tauri_data.ticket, native_error: tauri_data.error || "" });
	return {
		epl: "tauri_steam",
		ticket: tauri_data.ticket || "",
	};
}

function tauri_auth_error(response) {
	var reason = (response && (response.reason || response.message)) || tauri_data.error || "Steam authentication failed.";
	tauri_debug(
		"auth.socket.rejected",
		{
			reason: reason,
			server_stage: (response && response.stage) || "unknown",
			ticket_received_by_server: !!(response && response.ticket_received),
		},
		"error",
	);
	if (reason == "steam_auth_failed") reason = "Steam authentication failed. Please restart Adventure Land through Steam.";
	else if (reason == "steam_link_failed") reason = "Steam authentication worked, but the account could not be linked. Please try again.";
	show_alert(reason);
}

function tauri_auth_result(response) {
	if (!response) return;
	tauri_debug("auth.socket.accepted", {
		server_status: response.status || "unknown",
		ticket_received_by_server: !!response.ticket_received,
	});
}

function tauri_get_data() {
	return { platform: "steam" };
}

function tauri_wait_for_steam_purchase(order_id, timeout_ms) {
	if (!tauri_invoke) return Promise.reject(new Error("Tauri API unavailable"));
	var started = Date.now();
	timeout_ms = timeout_ms || 10 * 60 * 1000;
	return new Promise(function (resolve, reject) {
		function check() {
			tauri_invoke("get_steam_purchase_authorization", { orderId: "" + order_id })
				.then(function (result) {
					if (result && result.ready) {
						resolve({ authorized: !!result.authorized });
						return;
					}
					if (Date.now() - started >= timeout_ms) {
						reject(new Error("steam_purchase_timeout"));
						return;
					}
					setTimeout(check, 500);
				})
				.catch(reject);
		}
		check();
	});
}

function tauri_character_is_online(name) {
	var characters = (window.X && X.characters) || [];
	name = ("" + name).toLowerCase();
	for (var i = 0; i < characters.length; i++) {
		if (("" + characters[i].name).toLowerCase() == name) return !!characters[i].online;
	}
	return false;
}

function tauri_wait_for_character_disconnect(name, timeout_ms) {
	var started = Date.now();
	return new Promise(function (resolve, reject) {
		function check() {
			api_call("servers_and_characters")
				.then(function () {
					setTimeout(function () {
						if (!tauri_character_is_online(name)) resolve();
						else if (Date.now() - started >= timeout_ms) reject(new Error("character_disconnect_timeout"));
						else setTimeout(check, 500);
					}, 100);
				})
				.catch(function () {
					if (Date.now() - started >= timeout_ms) reject(new Error("character_disconnect_timeout"));
					else setTimeout(check, 500);
				});
		}
		check();
	});
}

function tauri_native_reload(selection) {
	return tauri_invoke("reload_game", { selection: !!selection }).catch(function (error) {
		tauri_reload_pending = false;
		console.error("[Tauri] Reload failed: " + error);
		show_alert("Reload failed: " + error);
	});
}

function tauri_graceful_reload() {
	if (tauri_reload_pending) return;
	tauri_reload_pending = true;
	if (!window.character || !character.name || !window.socket) return tauri_native_reload(false);

	var name = character.name;
	// Suppress only this intentional disconnect. The established automatic
	// reconnect path remains unchanged for network and server disconnects.
	auto_reload = "off";
	reload_state = false;
	character_to_load = false;
	try {
		socket.disconnect();
	} catch (error) {
		console.error("[Tauri] Character disconnect failed: " + error);
		return tauri_native_reload(true);
	}

	return tauri_wait_for_character_disconnect(name, 12000)
		.then(function () {
			return tauri_native_reload(false);
		})
		.catch(function (error) {
			console.error("[Tauri] Character disconnect confirmation failed: " + error);
			return tauri_native_reload(true);
		});
}

function tauri_dev_tools() {
	return tauri_invoke("open_devtools");
}

function tauri_fullscreen() {
	return tauri_invoke("toggle_fullscreen");
}

function tauri_create_subwindow() {
	return tauri_invoke("create_subwindow").catch(function (error) {
		show_alert("Couldn't open another game window: " + error);
	});
}

function tauri_open_external(url) {
	return tauri_invoke("open_external", { url: url });
}

function tauri_open_steam_checkout(url) {
	return tauri_invoke("open_steam_checkout", { url: url })
		.catch(function (error) {
			var message = "" + ((error && error.message) || error || "");
			if (message.indexOf("open_steam_checkout") === -1) throw error;
			return tauri_open_external(url).then(function () {
				return "browser";
			});
		})
		.then(function (method) {
			tauri_debug("purchase.checkout.opened", { method: method });
			return method;
		});
}

function tauri_setup_external_links() {
	document.addEventListener(
		"click",
		function (event) {
			var link = event.target.closest && event.target.closest("a[href]");
			if (!link) return;
			var href = link.href || "";
			if (/^mailto:/i.test(href)) {
				event.preventDefault();
				tauri_open_external(href);
				return;
			}
			if (!/^https:\/\//i.test(href)) return;
			try {
				var parsed = new URL(href);
				if (parsed.hostname === "adventure.land" || parsed.hostname.endsWith(".adventure.land")) return;
			} catch (e) {
				return;
			}
			event.preventDefault();
			tauri_open_external(href);
		},
		true,
	);
}

function tauri_init() {
	var build_id = "";
	try {
		build_id = new URLSearchParams(window.location.search).get("buildid") || "";
	} catch (e) {}
	tauri_debug("client.init", {
		build_id: build_id,
		invoke_available: !!tauri_invoke,
		user_agent: navigator.userAgent,
	});
	tauri_setup_external_links();
	tauri_prepare_auth().catch(function (error) {
		tauri_debug("client.init_failed", { reason: "" + ((error && error.message) || error || "unknown") }, "error");
	});
}
