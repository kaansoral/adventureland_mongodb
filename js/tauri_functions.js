/* global show_alert */

var tauri_data = { ready: false, ticket: "", error: "" };
var tauri_auth_promise = null;
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
