/* global show_alert */

var tauri_data = { ready: false, ticket: "", error: "" };
var tauri_auth_promise = null;
var tauri_reload_pending = false;
var tauri_invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;

function tauri_prepare_auth() {
	if (!tauri_invoke) return Promise.reject(new Error("Tauri API unavailable"));
	if (tauri_data.ready) return Promise.resolve(tauri_data);
	if (tauri_auth_promise) return tauri_auth_promise;
	var request = tauri_invoke("get_steam_auth")
		.then(function (data) {
			data = data || {};
			tauri_data = {
				ready: true,
				ticket: data.ticket || "",
				error: data.error || "",
			};
			if (tauri_data.ticket) console.log("[Tauri Steam] Steam ticket ready.");
			else console.log("[Tauri Steam] No ticket; trying the saved account link.");
			return tauri_data;
		})
		.finally(function () {
			if (tauri_auth_promise == request) tauri_auth_promise = null;
		});
	tauri_auth_promise = request;
	return request;
}

function tauri_auth_ready() {
	return tauri_data.ready;
}

function tauri_auth_payload() {
	return {
		epl: "tauri_steam",
		ticket: tauri_data.ticket || "",
	};
}

function tauri_auth_error(response) {
	var reason = (response && (response.reason || response.message)) || tauri_data.error || "Steam authentication failed.";
	console.error("[Tauri Steam] Authentication failed: " + reason);
	show_alert(reason);
}

function tauri_auth_result(response) {
	if (!response) return;
	if (response.status == "steam_ticket_verified") {
		console.log("[Tauri Steam] Steam ticket verified; account linked to PID " + response.pid + ".");
	} else if (response.status == "persisted_steam_id") {
		console.log("[Tauri Steam] Using saved Steam PID " + response.pid + ".");
	}
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
	tauri_setup_external_links();
	tauri_prepare_auth().catch(function (error) {
		console.error("[Tauri Steam] Steam initialization failed: " + error);
	});
}
