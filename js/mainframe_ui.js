(function () {
	"use strict";

	var charactersNode = document.getElementById("mainframe-characters");
	if (!charactersNode) return;
	var statusNode = document.getElementById("mainframe-status");
	var errorNode = document.getElementById("mainframe-error");
	var tokenStatusNode = document.getElementById("token-status");
	var tokenStatusDetailNode = document.getElementById("token-status-detail");
	var createTokenNode = document.getElementById("create-token");
	var revealTokenNode = document.getElementById("reveal-token");
	var copyTokenNode = document.getElementById("copy-token");
	var revokeTokenNode = document.getElementById("revoke-token");
	var tokenSecretNode = document.getElementById("token-secret");
	var steamTimeNode = document.getElementById("steam-time");
	var steamTimeHoursNode = document.getElementById("steam-time-hours");
	var billingNoteNode = document.getElementById("billing-note");
	var busy = Object.create(null);
	var characterCards = Object.create(null);
	var tokenConnection = "";
	var tokenRevealed = false;
	var tokenRecoverable = false;
	var maskedToken = "••••••••••••••••••••••••••••••••";

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

	function renewalSchedule(contract) {
		var schedule =
			contract && Array.isArray(contract.renewal_minutes_by_active_characters)
				? contract.renewal_minutes_by_active_characters
				: [
						{ characters: 1, minutes: 60 },
						{ characters: 2, minutes: 50 },
						{ characters: 3, minutes: 45 },
						{ characters: 4, minutes: 40 },
					];
		return schedule.filter(function (entry) {
			return Number.isSafeInteger(entry.characters) && Number.isSafeInteger(entry.minutes);
		});
	}

	function renewalCostText(contract) {
		return (
			((contract && contract.shells_per_period) || 1) +
			" Shell · " +
			renewalSchedule(contract)
				.map(function (entry) {
					return entry.characters + "=" + entry.minutes + "m";
				})
				.join(" · ")
		);
	}

	function renewalExplanation(contract, freeTime) {
		var periods = renewalSchedule(contract)
			.map(function (entry) {
				return entry.characters + (entry.characters === 1 ? " character: " : " characters: ") + entry.minutes + "m";
			})
			.join(", ");
		return (
			(freeTime ? "One free Mainframe hour is used before Shells. Otherwise, " : "") +
			"each renewal costs 1 Shell. " +
			periods +
			". The count is checked at renewal. Disconnect to stop future renewals; paid time is not refunded."
		);
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

	function setMetric(node, value) {
		node.querySelector("strong").textContent = value;
	}

	function seenMainframeEvent(character) {
		try {
			return window.localStorage.getItem("mainframe-event-seen:" + character) || "";
		} catch (error) {
			return "";
		}
	}

	function markMainframeEventSeen(character, event) {
		if (!event || !event.id) return;
		try {
			window.localStorage.setItem("mainframe-event-seen:" + character, event.id);
		} catch (error) {}
	}

	function selectLogTab(nodes, selected) {
		nodes.codeLogs.classList.toggle("active", selected === "code");
		nodes.mainframeLogs.classList.toggle("active", selected === "mainframe");
		nodes.logs.dataset.tab = selected;
	}

	async function loadCharacterLogs(card, selected) {
		var nodes = card.mainframeNodes;
		var character = card.mainframeState.entry.character;
		var request = String((Number(nodes.logs.dataset.request) || 0) + 1);
		nodes.logs.dataset.request = request;
		selectLogTab(nodes, selected);
		try {
			if (selected === "code") {
				var codeResult = await call("mainframe_get_logs", { character: character, limit: 100 });
				if (nodes.logs.dataset.request !== request) return;
				nodes.logs.className = "logs code-logs";
				nodes.logs.textContent =
					(codeResult.logs || [])
						.slice()
						.sort(function (left, right) {
							return new Date(right.at).getTime() - new Date(left.at).getTime();
						})
						.map(function (line) {
							return [line.at, line.level, (line.values || []).join(" ")].filter(Boolean).join("  ");
						})
						.join("\n") || "No CODE logs.";
			} else {
				var eventResult = await call("mainframe_get_events", { character: character, limit: 100 });
				if (nodes.logs.dataset.request !== request) return;
				nodes.logs.className = "logs mainframe-logs";
				nodes.logs.textContent = "";
				var events = (eventResult.events || []).slice().sort(function (left, right) {
					return new Date(right.at).getTime() - new Date(left.at).getTime();
				});
				if (!events.length) nodes.logs.textContent = "No Mainframe logs.";
				else
					events.forEach(function (event) {
						var row = document.createElement("div");
						row.className = "mainframe-log-line event-" + (["warn", "error"].includes(event.level) ? event.level : "info");
						row.textContent = [event.at, String(event.level || "info").toUpperCase(), event.message, event.detail].filter(Boolean).join("  ");
						nodes.logs.append(row);
					});
				var assignment = card.mainframeState.entry.assignment || {};
				var latest = assignment.mainframe_error || (card.mainframeState.entry.runtime && card.mainframeState.entry.runtime.mainframe_event);
				markMainframeEventSeen(character, latest);
				nodes.mainframeLogs.classList.remove("alert");
			}
			nodes.logs.style.display = "block";
			errorNode.style.display = "none";
		} catch (error) {
			showError(error);
		}
	}

	function updateSelect(select, choices, preferred, forcePreferred) {
		var previous = select.value;
		var signature = JSON.stringify(choices);
		if (select.dataset.options !== signature) {
			select.options.length = 0;
			choices.forEach(function (choice) {
				var option = document.createElement("option");
				option.value = choice.value;
				option.textContent = choice.label;
				select.append(option);
			});
			select.dataset.options = signature;
		}
		var wanted = forcePreferred || !select.dataset.ready ? String(preferred || "") : previous;
		var available = Array.prototype.some.call(select.options, function (option) {
			return option.value === wanted;
		});
		if (available) select.value = wanted;
		select.dataset.ready = "true";
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
		return (
			{
				not_enough_shells: "You need 1 Shell to open a new Mainframe window.",
				character_in_game: "This character is already running outside Mainframe.",
				character_already_linked: "Disconnect this character before changing its CODE or server.",
				mainframe_unavailable: "Mainframe is unavailable right now.",
				token_generation_failed: "The token could not be created. Try again.",
				token_revoke_failed: "The token could not be revoked. Try again.",
				server_not_found: "Choose a live server.",
				code_not_found: "Choose one of your saved CODE slots.",
				rate_limited: "Mainframe received too many requests. Wait a moment and try again.",
				not_logged_in: "Your session ended. Sign in again.",
			}[reason] || reason.replace(/_/g, " ")
		);
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

	function savedCharacterCodeSlot(entry) {
		try {
			var cache = JSON.parse(window.localStorage.getItem("code_cache") || "{}");
			return cache["slot_" + entry.character_id] || "";
		} catch (error) {
			return "";
		}
	}

	function showError(error) {
		errorNode.textContent = friendly(error);
		errorNode.style.display = "block";
	}

	function tokenConnectionText(token) {
		return (
			"Adventure Land MCP\n" +
			"Transport: Streamable HTTP\n" +
			"Server URL: https://adventure.land/mcp\n" +
			"Authorization: Bearer " +
			token +
			"\n" +
			"First instruction: Read adventureland://guide/start-here and its CODE reading order, then inspect mainframe_get_dashboard and the exact methods and game definitions needed for the task."
		);
	}

	function renderTokenSecret() {
		if (!tokenConnection) {
			tokenSecretNode.textContent = "Authorization: Bearer " + maskedToken;
			return;
		}
		tokenSecretNode.textContent = tokenRevealed ? tokenConnection : tokenConnectionText(maskedToken);
	}

	function renderTokenStatus(state) {
		var active = !!(state && state.active);
		tokenStatusNode.textContent = active ? "Token active" : "No active token";
		if (active) {
			var created = state && state.created ? new Date(state.created) : null;
			var createdText = created && Number.isFinite(created.getTime()) ? " Created " + created.toLocaleString() + "." : "";
			tokenConnection = "";
			tokenRevealed = false;
			tokenRecoverable = state.recoverable === true;
			renderTokenSecret();
			tokenSecretNode.style.display = "block";
			revealTokenNode.textContent = "Reveal token";
			revealTokenNode.style.display = "inline-block";
			copyTokenNode.style.display = "none";
			tokenStatusDetailNode.textContent =
				(tokenRecoverable ? "Reveal it when you need to connect a client." : "This legacy token cannot be recovered from its stored hash. Replace it once to enable reveal.") + createdText;
		} else {
			tokenConnection = "";
			tokenRevealed = false;
			tokenRecoverable = false;
			tokenSecretNode.textContent = "";
			tokenSecretNode.style.display = "none";
			revealTokenNode.style.display = "none";
			copyTokenNode.style.display = "none";
			tokenStatusDetailNode.textContent = "Create a token to connect an AI client.";
		}
		createTokenNode.textContent = active ? "Replace token" : "Create token";
		createTokenNode.disabled = false;
		revokeTokenNode.disabled = !active;
	}

	async function refreshTokenStatus() {
		try {
			renderTokenStatus(await call("token_status"));
		} catch (error) {
			tokenStatusNode.textContent = "Token status unavailable";
			tokenStatusDetailNode.textContent = "Refresh the page or sign in again.";
			showError(error);
		}
	}

	createTokenNode.onclick = async function () {
		var rotating = tokenStatusNode.textContent === "Token active";
		if (rotating && !window.confirm("Replace your MCP token? The current token will stop working immediately.")) return;
		createTokenNode.disabled = true;
		try {
			var result = await call("generate_token");
			renderTokenStatus({ active: true, recoverable: true, created: new Date().toISOString() });
			tokenConnection = tokenConnectionText(result.token);
			tokenRevealed = true;
			renderTokenSecret();
			revealTokenNode.textContent = "Hide token";
			copyTokenNode.style.display = "inline-block";
			errorNode.style.display = "none";
		} catch (error) {
			showError(error);
		} finally {
			createTokenNode.disabled = false;
		}
	};

	revealTokenNode.onclick = async function () {
		if (tokenRevealed) {
			tokenRevealed = false;
			renderTokenSecret();
			revealTokenNode.textContent = "Reveal token";
			copyTokenNode.style.display = "none";
			return;
		}
		if (!tokenRecoverable) {
			showError({ reason: "This token predates secure reveal. Replace it once to create a revealable token." });
			return;
		}
		revealTokenNode.disabled = true;
		try {
			var result = await call("reveal_token");
			tokenConnection = tokenConnectionText(result.token);
			tokenRevealed = true;
			renderTokenSecret();
			revealTokenNode.textContent = "Hide token";
			copyTokenNode.style.display = "inline-block";
			errorNode.style.display = "none";
		} catch (error) {
			showError(error);
		} finally {
			revealTokenNode.disabled = false;
		}
	};

	copyTokenNode.onclick = async function () {
		if (!tokenConnection) return;
		try {
			await navigator.clipboard.writeText(tokenConnection);
			copyTokenNode.textContent = "Copied";
			setTimeout(function () {
				copyTokenNode.textContent = "Copy connection";
			}, 1500);
		} catch (error) {
			showError({ reason: "Copy failed. Select the connection text manually." });
		}
	};

	revokeTokenNode.onclick = async function () {
		if (!window.confirm("Revoke your MCP token? Connected AI clients and JSON API programs will lose access immediately.")) return;
		revokeTokenNode.disabled = true;
		try {
			await call("revoke_token");
			tokenConnection = "";
			tokenSecretNode.textContent = "";
			tokenSecretNode.style.display = "none";
			copyTokenNode.style.display = "none";
			revealTokenNode.style.display = "none";
			renderTokenStatus({ active: false });
			errorNode.style.display = "none";
		} catch (error) {
			showError(error);
		}
	};

	function createCharacterCard(entry) {
		var card = document.createElement("article");
		card.className = "card";
		var head = document.createElement("div");
		head.className = "card-head";
		var title = document.createElement("div");
		var name = document.createElement("h2");
		var detail = document.createElement("div");
		detail.className = "muted";
		title.append(name, detail);
		var phaseNode = document.createElement("div");
		phaseNode.className = "phase";
		head.append(title, phaseNode);

		var metrics = document.createElement("div");
		metrics.className = "metrics";
		var metricNodes = {
			access: metric("Access", "—"),
			server: metric("Server", "—"),
			game: metric("Game", "—"),
			position: metric("Position", "—"),
			activity: metric("Activity", "—"),
			memory: metric("VM memory", "—"),
			dps: metric("DPS", "—"),
			gps: metric("Gold / sec", "—"),
			callCost: metric("Call cost", "—"),
			disconnectReason: metric("Last disconnect", "—"),
		};
		Object.keys(metricNodes).forEach(function (key) {
			metrics.append(metricNodes[key]);
		});

		var controls = document.createElement("div");
		controls.className = "controls";
		var codeLabel = document.createElement("label");
		codeLabel.textContent = "CODE slot";
		var codeSelect = document.createElement("select");
		codeLabel.append(codeSelect);
		var serverLabel = document.createElement("label");
		serverLabel.textContent = "Server";
		var serverSelect = document.createElement("select");
		serverLabel.append(serverSelect);
		controls.append(codeLabel, serverLabel);

		var actions = document.createElement("div");
		actions.className = "actions";
		var run = document.createElement("button");
		run.onclick = async function () {
			var current = card.mainframeState;
			var access = current.entry.access || {};
			var character = current.entry.character;
			var freeTime = current.state.free_time;
			var usesFreeTime = !!(freeTime && Number(freeTime.remaining_hours) > 0);
			if (
				!access.active &&
				!window.confirm(
					usesFreeTime
						? "Run " +
								character +
								" on Mainframe using 1 free Steam hour for 60 minutes? It renews automatically. Included CODE workers change the next renewal to 50, 45, or 40 minutes for 2, 3, or 4 active characters."
						: "Run " +
								character +
								" on Mainframe for 1 Shell and 60 minutes? It renews automatically. Included CODE workers change the next renewal to 50, 45, or 40 minutes for 2, 3, or 4 active characters.",
				)
			)
				return;
			var request = requestId(character, codeSelect.value, serverSelect.value);
			busy[character] = true;
			try {
				await call("mainframe_link_character", { character: character, request_id: request.value, code_slot: codeSelect.value, server: serverSelect.value });
				sessionStorage.removeItem(request.key);
				errorNode.style.display = "none";
			} catch (error) {
				showError(error);
			} finally {
				delete busy[character];
				await refresh();
			}
		};
		var disconnect = document.createElement("button");
		disconnect.className = "disconnect";
		disconnect.textContent = "Disconnect";
		disconnect.onclick = async function () {
			var character = card.mainframeState.entry.character;
			busy[character] = true;
			try {
				await call("mainframe_disconnect_character", { character: character });
				errorNode.style.display = "none";
			} catch (error) {
				showError(error);
			} finally {
				delete busy[character];
				await refresh();
			}
		};
		var codeLogsButton = document.createElement("button");
		codeLogsButton.className = "log-tab";
		codeLogsButton.textContent = "CODE log";
		var mainframeLogsButton = document.createElement("button");
		mainframeLogsButton.className = "log-tab";
		mainframeLogsButton.textContent = "Mainframe log";
		var logs = document.createElement("div");
		logs.className = "logs";
		codeLogsButton.onclick = function () {
			loadCharacterLogs(card, "code");
		};
		mainframeLogsButton.onclick = function () {
			loadCharacterLogs(card, "mainframe");
		};
		actions.append(run, disconnect, codeLogsButton, mainframeLogsButton);
		card.append(head, metrics, controls, actions, logs);
		card.mainframeNodes = {
			name: name,
			detail: detail,
			phase: phaseNode,
			metrics: metricNodes,
			code: codeSelect,
			server: serverSelect,
			run: run,
			disconnect: disconnect,
			codeLogs: codeLogsButton,
			mainframeLogs: mainframeLogsButton,
			logs: logs,
		};
		return card;
	}

	function friendlyDisconnectReason(reason) {
		var messages = {
			limits: "Realm character limit",
			limitdc: "Connection limit",
			blocked: "Account blocked",
			not_enough_shells: "Out of Mainframe time",
			explicit_disconnect: "Disconnected by owner",
			game_disconnect: "Game connection closed",
			transport_closed: "Game connection closed",
		};
		reason = String(reason || "").trim();
		if (!reason) return "—";
		return messages[reason.toLowerCase()] || reason;
	}

	function updateCharacterCard(card, entry, state) {
		var nodes = card.mainframeNodes;
		var runtime = entry.runtime || {};
		var assignment = entry.assignment || {};
		var access = entry.access || {};
		var observation = runtime.observation || {};
		var movement = observation.movement || {};
		var containment = runtime.containment || {};
		var performance = (runtime.performance && runtime.performance.session) || {};
		var phase = runtime.phase || (assignment.desired_state === "running" ? "queued" : "stopped");
		var running = assignment.desired_state === "running";
		card.mainframeState = { entry: entry, state: state };
		card.className = "card " + phase + (movement.stuck ? " stuck" : "");
		nodes.name.textContent = entry.character;
		var execution = assignment.execution === "included_worker" ? "Included with " + text(assignment.included_with) : assignment.execution === "shared_microvm" ? "Shared machine" : "Dedicated machine";
		nodes.detail.textContent = "Level " + text(entry.level) + " " + text(entry.class).toUpperCase() + (assignment.desired_state ? " · " + execution : "");
		nodes.phase.textContent = phase === "stopped" && assignment.stop_reason === "not_enough_shells" ? "stopped — out of Shells" : phase;
		setMetric(
			nodes.metrics.access,
			access.active
				? (access.billing_source === "steam_time" ? "Steam · " : access.billing_source === "shell" ? "Shell · " : "") +
						(Number(access.active_characters) || 1) +
						" char · " +
						(Number(access.period_minutes) || 60) +
						"m · " +
						(running ? "renews in " : "time ") +
						duration(access.remaining_seconds)
				: "Not active",
		);
		setMetric(nodes.metrics.server, text(assignment.server || runtime.server));
		setMetric(nodes.metrics.game, runtime.game_connected ? "Connected" : "Disconnected");
		setMetric(nodes.metrics.position, observation.map ? observation.map + " " + Math.round(observation.x || 0) + ", " + Math.round(observation.y || 0) : "—");
		setMetric(nodes.metrics.activity, text(observation.activity));
		setMetric(nodes.metrics.memory, bytes(containment.memory_current_bytes));
		setMetric(nodes.metrics.dps, text(performance.dps));
		setMetric(nodes.metrics.gps, text(performance.gps));
		var callCost = Number(runtime.metrics && runtime.metrics.call_cost_percent);
		if (!Number.isFinite(callCost)) {
			var cpuRatio = Number(runtime.metrics && runtime.metrics.cpu_ratio);
			callCost = Number.isFinite(cpuRatio) ? Math.min(100, Math.max(0, (cpuRatio / 0.1) * 100)) : NaN;
		}
		setMetric(nodes.metrics.callCost, Number.isFinite(callCost) ? callCost.toFixed(1) + "% of worker CPU" : "—");
		setMetric(nodes.metrics.disconnectReason, friendlyDisconnectReason((assignment.last_failure && assignment.last_failure.reason) || assignment.stop_reason));
		updateSelect(
			nodes.code,
			(state.codes || []).map(function (code) {
				return { value: String(code.slot), label: code.slot + " — " + code.name };
			}),
			running ? assignment.code_slot : savedCharacterCodeSlot(entry) || assignment.code_slot,
			running,
		);
		updateSelect(
			nodes.server,
			(state.servers || [])
				.filter(function (server) {
					return server.online;
				})
				.map(function (server) {
					return { value: server.server, label: server.server + " [" + server.players + "]" };
				}),
			assignment.server,
			running,
		);
		nodes.code.disabled = running;
		nodes.server.disabled = running;
		nodes.run.textContent = access.active ? "Run on Mainframe" : state.free_time ? "Run — 1 free hour" : "Run — 1 Shell";
		nodes.run.disabled = !!busy[entry.character] || !state.online || !nodes.code.value || !nodes.server.value || running;
		nodes.disconnect.disabled = !!busy[entry.character] || !running;
		var latestMainframeEvent = assignment.mainframe_error || runtime.mainframe_event;
		var unseenRestart = latestMainframeEvent && latestMainframeEvent.level === "error" && latestMainframeEvent.id !== seenMainframeEvent(entry.character);
		nodes.mainframeLogs.classList.toggle("alert", !!unseenRestart);
		nodes.mainframeLogs.title = unseenRestart ? "Mainframe reported a Worker failure or restart" : "Mainframe lifecycle and recovery log";
	}

	function render(state) {
		statusNode.className = "status " + (state.online ? "online" : "offline");
		document.getElementById("status-title").textContent = state.online ? "Mainframe online" : "Mainframe offline";
		document.getElementById("status-detail").textContent = state.updated_at ? "Updated " + new Date(state.updated_at).toLocaleTimeString() : "No controller report.";
		document.getElementById("shells").textContent = text(state.shells);
		document.getElementById("running").textContent =
			(state.characters || []).filter(function (entry) {
				return entry.assignment && entry.assignment.desired_state === "running";
			}).length +
			" / " +
			(state.characters || []).length;
		document.getElementById("cost").textContent = renewalCostText(state.contract);
		if (steamTimeNode && state.free_time && Number(state.free_time.remaining_hours) > 0) {
			steamTimeHoursNode.textContent = state.free_time.remaining_hours + " free Mainframe hours remaining";
			steamTimeNode.hidden = false;
			billingNoteNode.textContent = renewalExplanation(state.contract, true);
		} else if (steamTimeNode) {
			steamTimeNode.hidden = true;
			steamTimeHoursNode.textContent = "";
			billingNoteNode.textContent = renewalExplanation(state.contract, false);
		}
		if (!(state.characters || []).length) {
			Object.keys(characterCards).forEach(function (character) {
				delete characterCards[character];
			});
			charactersNode.replaceChildren();
			var empty = document.createElement("div");
			empty.className = "empty";
			empty.textContent = "Create a character before using Mainframe.";
			charactersNode.append(empty);
			return;
		}
		Array.prototype.slice.call(charactersNode.querySelectorAll(":scope > .empty")).forEach(function (node) {
			node.remove();
		});
		var present = Object.create(null);
		var ordered = [];
		state.characters.forEach(function (entry) {
			present[entry.character] = true;
			var card = characterCards[entry.character];
			if (!card) card = characterCards[entry.character] = createCharacterCard(entry);
			updateCharacterCard(card, entry, state);
			ordered.push(card);
		});
		Object.keys(characterCards).forEach(function (character) {
			if (present[character]) return;
			characterCards[character].remove();
			delete characterCards[character];
		});
		ordered.forEach(function (card, index) {
			if (charactersNode.children[index] !== card) charactersNode.insertBefore(card, charactersNode.children[index] || null);
		});
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

	refreshTokenStatus();
	refresh();
	setInterval(refresh, 5000);
})();
