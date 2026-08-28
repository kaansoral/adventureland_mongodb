(function () {
	"use strict";

	var charactersNode = document.getElementById("mainframe-characters");
	if (!charactersNode) return;
	var statusNode = document.getElementById("mainframe-status");
	var errorNode = document.getElementById("mainframe-error");
	var busy = Object.create(null);

	function text(value) {
		return value === undefined || value === null || value === "" ? "—" : String(value);
	}

	function duration(seconds) {
		seconds = Math.max(0, Math.floor(Number(seconds) || 0));
		if (seconds < 60) return seconds + "s";
		var minutes = Math.floor(seconds / 60);
		if (minutes < 60) return minutes + "m " + (seconds % 60) + "s";
		return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
	}

	function bytes(value) {
		value = Number(value);
		return Number.isFinite(value) ? (value / 1024 / 1024).toFixed(1) + " MB" : "—";
	}

	function metric(label, value) {
		var node = document.createElement("div");
		node.className = "metric";
		var caption = document.createElement("span");
		caption.textContent = label;
		var strong = document.createElement("strong");
		strong.textContent = value;
		node.append(caption, strong);
		return node;
	}

	async function call(method, args) {
		var response = await fetch("/api/" + method, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(args || {}),
			cache: "no-store",
		});
		var result = await response.json();
		if (!response.ok || result.failed) throw result;
		return result;
	}

	function friendly(error) {
		var reason = (error && error.reason) || "request_failed";
		return {
			not_enough_shells: "You need 1 Shell to open a new Mainframe window.",
			character_in_game: "This character is already running outside Mainframe.",
			character_already_linked: "Disconnect this character before changing its CODE or server.",
			mainframe_unavailable: "Mainframe is unavailable right now.",
			server_not_found: "Choose a live server.",
			code_not_found: "Choose one of your saved CODE slots.",
			rate_limited: "Mainframe received too many requests. Wait a moment and try again.",
			not_logged_in: "Your session ended. Sign in again.",
		}[reason] || reason.replace(/_/g, " ");
	}

	function requestId(character, code, server) {
		var key = "mainframe-request:" + character + ":" + code + ":" + server;
		var value = sessionStorage.getItem(key);
		if (!value) {
			var random = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
			value = "web:" + String(random).replace(/[^A-Za-z0-9_.:@-]/g, "-");
			sessionStorage.setItem(key, value);
		}
		return { key: key, value: value };
	}

	function showError(error) {
		errorNode.textContent = friendly(error);
		errorNode.style.display = "block";
	}

	function renderCharacter(entry, state) {
		var runtime = entry.runtime || {};
		var assignment = entry.assignment || {};
		var access = entry.access || {};
		var observation = runtime.observation || {};
		var movement = observation.movement || {};
		var containment = runtime.containment || {};
		var phase = runtime.phase || (assignment.desired_state === "running" ? "queued" : "stopped");
		var card = document.createElement("article");
		card.className = "card " + phase + (movement.stuck ? " stuck" : "");
		var head = document.createElement("div");
		head.className = "card-head";
		var title = document.createElement("div");
		var name = document.createElement("h2");
		name.textContent = entry.character;
		var detail = document.createElement("div");
		detail.className = "muted";
		detail.textContent = "Level " + text(entry.level) + " " + text(entry.class).toUpperCase();
		title.append(name, detail);
		var phaseNode = document.createElement("div");
		phaseNode.className = "phase";
		phaseNode.textContent = phase;
		head.append(title, phaseNode);

		var metrics = document.createElement("div");
		metrics.className = "metrics";
		metrics.append(
			metric("Access", access.active ? duration(access.remaining_seconds) + " left" : "Not active"),
			metric("Server", text(assignment.server || runtime.server)),
			metric("Game", runtime.game_connected ? "Connected" : "Disconnected"),
			metric("Position", observation.map ? observation.map + " " + Math.round(observation.x || 0) + ", " + Math.round(observation.y || 0) : "—"),
			metric("Activity", text(observation.activity)),
			metric("VM memory", bytes(containment.memory_current_bytes)),
			metric("DPS", text(runtime.performance && runtime.performance.session && runtime.performance.session.dps)),
			metric("Gold / sec", text(runtime.performance && runtime.performance.session && runtime.performance.session.gps))
		);

		var controls = document.createElement("div");
		controls.className = "controls";
		var codeLabel = document.createElement("label");
		codeLabel.textContent = "CODE slot";
		var codeSelect = document.createElement("select");
		(state.codes || []).forEach(function (code) {
			var option = document.createElement("option");
			option.value = code.slot;
			option.textContent = code.slot + " — " + code.name;
			if (String(assignment.code_slot) === String(code.slot)) option.selected = true;
			codeSelect.append(option);
		});
		codeLabel.append(codeSelect);
		var serverLabel = document.createElement("label");
		serverLabel.textContent = "Server";
		var serverSelect = document.createElement("select");
		(state.servers || []).filter(function (server) { return server.online; }).forEach(function (server) {
			var option = document.createElement("option");
			option.value = server.server;
			option.textContent = server.server + " [" + server.players + "]";
			if (assignment.server === server.server) option.selected = true;
			serverSelect.append(option);
		});
		serverLabel.append(serverSelect);
		controls.append(codeLabel, serverLabel);

		var actions = document.createElement("div");
		actions.className = "actions";
		var run = document.createElement("button");
		run.textContent = access.active ? "Run on Mainframe" : "Run — 1 Shell";
		run.disabled = !!busy[entry.character] || !state.online || !codeSelect.value || assignment.desired_state === "running";
		run.onclick = async function () {
			if (!access.active && !window.confirm("Run " + entry.character + " on Mainframe for 1 Shell? The 60-minute window starts immediately.")) return;
			var request = requestId(entry.character, codeSelect.value, serverSelect.value);
			busy[entry.character] = true;
			try {
				await call("mainframe_link_character", { character: entry.character, request_id: request.value, code_slot: codeSelect.value, server: serverSelect.value });
				sessionStorage.removeItem(request.key);
				errorNode.style.display = "none";
			} catch (error) {
				showError(error);
			} finally {
				delete busy[entry.character];
				await refresh();
			}
		};
		var disconnect = document.createElement("button");
		disconnect.className = "disconnect";
		disconnect.textContent = "Disconnect";
		disconnect.disabled = !!busy[entry.character] || assignment.desired_state !== "running";
		disconnect.onclick = async function () {
			busy[entry.character] = true;
			try {
				await call("mainframe_disconnect_character", { character: entry.character });
				errorNode.style.display = "none";
			} catch (error) {
				showError(error);
			} finally {
				delete busy[entry.character];
				await refresh();
			}
		};
		var logsButton = document.createElement("button");
		logsButton.textContent = "CODE log";
		var logs = document.createElement("div");
		logs.className = "logs";
		logsButton.onclick = async function () {
			try {
				var result = await call("mainframe_get_logs", { character: entry.character, limit: 100 });
				logs.textContent = (result.logs || []).map(function (line) { return [line.at, line.level, (line.values || []).join(" ")].filter(Boolean).join("  "); }).join("\n") || "No CODE logs.";
				logs.style.display = "block";
			} catch (error) {
				showError(error);
			}
		};
		actions.append(run, disconnect, logsButton);
		card.append(head, metrics, controls, actions, logs);
		return card;
	}

	function render(state) {
		statusNode.className = "status " + (state.online ? "online" : "offline");
		document.getElementById("status-title").textContent = state.online ? "Mainframe online" : "Mainframe offline";
		document.getElementById("status-detail").textContent = state.updated_at ? "Updated " + new Date(state.updated_at).toLocaleTimeString() : "No controller report.";
		document.getElementById("shells").textContent = text(state.shells);
		document.getElementById("running").textContent = (state.characters || []).filter(function (entry) { return entry.assignment && entry.assignment.desired_state === "running"; }).length + " / " + (state.characters || []).length;
		document.getElementById("cost").textContent = state.contract.shells_per_period + " Shell / " + state.contract.period_minutes + " minutes";
		charactersNode.replaceChildren();
		if (!(state.characters || []).length) {
			var empty = document.createElement("div");
			empty.className = "empty";
			empty.textContent = "Create a character before using Mainframe.";
			charactersNode.append(empty);
			return;
		}
		state.characters.forEach(function (entry) { charactersNode.append(renderCharacter(entry, state)); });
	}

	async function refresh() {
		try {
			var state = await call("mainframe_get_dashboard", {});
			errorNode.style.display = "none";
			render(state);
		} catch (error) {
			showError(error);
		}
	}

	refresh();
	setInterval(refresh, 5000);
})();
