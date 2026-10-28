// The Witch in Spooky Forest: a short greeting with her services, the cauldron of the Witch's Cipher
// and the realm's clue board. Rules: node/logic/witch_cipher.js.

var witch_mix = [],
	witch_day = null,
	witch_result = null,
	witch_timer = null;

function witch_request(action, fields) {
	var id = randomStr(30);
	return new Promise(function (resolve, reject) {
		var timer = setTimeout(function () {
			finish({ failed: true, reason: "timeout" });
		}, 10000);
		function response(data) {
			if (data && data.request_id === id && data.place === "interaction") finish(data);
		}
		function disconnected() {
			finish({ failed: true, reason: "disconnected" });
		}
		function finish(data) {
			clearTimeout(timer);
			socket.off("game_response", response);
			socket.off("disconnect", disconnected);
			if (data.failed) reject(data);
			else resolve(data);
		}
		socket.on("game_response", response);
		socket.on("disconnect", disconnected);
		socket.emit("interaction", Object.assign({}, fields || {}, { type: "witchcipher", action: action, request_id: id }));
	});
}

function witch_ingredients() {
	return G.events.witchcipher.ingredients.map(function (entry) {
		return entry[0];
	});
}

function witch_cipher_live() {
	return !!(typeof S != "undefined" && S.witchcipher && S.witchcipher.live && S.witchcipher.end > schedule_now());
}

// One slot per ingredient of the recipe, filled from the left
function witch_slots() {
	var slots = G.events.witchcipher.slots;
	while (witch_mix.length < slots) witch_mix.push(null);
	witch_mix.length = slots;
	return slots;
}

function witch_failure(data) {
	if (no_graphics || !data) return;
	if (data.phrase) return add_log(phrase.message(data), "gray");
	var known = ["witchcipher_not_live", "witchcipher_no_mixes", "witchcipher_ingredients", "witchcipher_elsewhere", "distance", "cant_in_bank"];
	if (known.includes(data.reason)) add_log(phrase.html("interface.witch.fail." + data.reason, { item: data.item ? G.items[data.item].name : "" }), "gray");
}

// The account's day (mixes left, the realm and the Parcels earned), for Events.
function witch_day_refresh() {
	if (!character || !socket) return Promise.resolve(null);
	return witch_request("info")
		.then(function (data) {
			witch_day = Object.assign({ checked: Date.now() }, data);
			if (typeof events_window_refresh == "function") events_window_refresh();
			return witch_day;
		})
		.catch(function () {
			return null;
		});
}

function witch_buttons(list) {
	return (
		"<div style='clear:both;float:right;margin-top:7px'>" +
		list
			.map(function (entry) {
				return "<div class='slimbutton' onclick='" + entry[1] + "'>" + entry[0] + "</div>";
			})
			.join(" ") +
		"</div>"
	);
}

// The greeting: BREW while her cauldron boils, then RECIPES, PARCELS and INFO.
function render_witch(service) {
	if (no_graphics || !character) return;
	if (service == "recipes") {
		render_recipes("witch");
		$("#recipe-item").html(render_interaction({ auto: true, skin: "brewingwitch", message: phrase.html("npc.witch.greeting") }, "return_html"));
		return;
	}
	if (service == "parcels") return render_exchange_shrine("witchparcel");
	if (service == "brew") return render_witch_cauldron();
	var live = witch_cipher_live(),
		message,
		buttons = [];
	if (live) message = phrase.html("interface.witch.greeting_live");
	else {
		var next = schedule_next("witchcipher");
		message = next
			? phrase.html("interface.witch.greeting_closed", { time: schedule_time_text(next.at, "realm") })
			: phrase.html("interface.witch.greeting_idle");
	}
	if (live) buttons.push([phrase.html("interface.witch.brew"), "render_witch(\"brew\")"]);
	buttons.push([phrase.html("interface.witch.recipes"), "render_witch(\"recipes\")"]);
	buttons.push([phrase.html("interface.witch.parcels"), "render_witch(\"parcels\")"]);
	buttons.push([phrase.html("interface.item.info"), "open_guide(\"event-witchcipher\",\"/docs/guide/event-witchcipher\")"]);
	render_interaction({ auto: true, skin: "brewingwitch", message: "<div style='font-size:24px'>" + message + "</div>" });
	$("#topleftcornerui > div").append(witch_buttons(buttons));
}

function witch_count(name) {
	var total = 0;
	(character.items || []).forEach(function (item) {
		if (item && item.name == name && !item.l) total += item.q || 1;
	});
	witch_mix.forEach(function (used) {
		if (used == name) total--;
	});
	return total;
}

function witch_clock(ms) {
	var seconds = Math.max(0, Math.ceil(ms / 1000));
	return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function witch_status_html() {
	var cipher = S.witchcipher,
		now = schedule_now(),
		parts = [];
	if (!witch_cipher_live()) return phrase.html("interface.witch.closed");
	if (character.witchcipher) parts.push(phrase.html("interface.witch.mixes_left", { count: character.witchcipher.mixes_left }));
	if (now < cipher.gather_end) parts.push(phrase.html("interface.witch.gathering", { time: witch_clock(cipher.gather_end - now) }));
	else parts.push(phrase.html("interface.witch.brewing", { time: witch_clock(cipher.end - now) }));
	return parts.join(" · ");
}

function witch_icon(name, args) {
	return item_container(Object.assign({ skin: G.items[name].skin, draggable: false }, args || {}), { name: name });
}

function witch_board_html() {
	var cipher = S.witchcipher || {},
		html = "<div style='background-color: black; border: 5px solid gray; padding: 12px 14px; font-size: 24px; text-align: left; min-width: 250px'>";
	html += "<div style='color:#AF6AE2'>" + phrase.html("interface.witch.board") + "</div>";
	// The last cracked recipe stays above the new one's board
	if (cipher.cracked) {
		html += "<div class='mt5' style='color:#F59A3C'>" + phrase.html("interface.witch.cracked_by", { name: cipher.cracked.by }) + "</div><div>";
		cipher.cracked.recipe.forEach(function (name) {
			html += witch_icon(name, { size: 20, space: 1, margin: 1 });
		});
		html += "</div>";
	}
	if (cipher.board && cipher.board.length) html += "<div style='color:#9B9B9B'>" + phrase.html("interface.witch.possible", { count: cipher.possible }) + "</div>";
	if (!cipher.board || !cipher.board.length) html += "<div style='color:#9B9B9B'>" + phrase.html("interface.witch.board_empty") + "</div>";
	(cipher.board || []).slice().reverse().forEach(function (entry) {
		html += "<div style='white-space:nowrap'>";
		entry.mix.forEach(function (name) {
			html += witch_icon(name, { size: 20, space: 1, margin: 1 });
		});
		html += " <span style='vertical-align: top; line-height: 26px; color:#85C76B'>" + phrase.html("interface.witch.right", { count: entry.right }) + "</span></div>";
	});
	return html + "</div>";
}

// Whether a full mix fits every clue on the board, scored the way the server scores it. Unknown when
// the board no longer shows every mix of the current recipe.
function witch_mix_fits(mix) {
	var cipher = S.witchcipher || {},
		board = cipher.board || [];
	if (cipher.mixes > board.length) return null;
	var key = mix.join(",");
	if (board.some(function (entry) { return entry.mix.join(",") == key; })) return "tried";
	return board.every(function (entry) {
		var right = 0;
		for (var i = 0; i < mix.length; i++) if (mix[i] == entry.mix[i]) right++;
		return right == entry.right;
	});
}

// The cauldron: one slot per ingredient of the recipe, in a row, because the order matters. Click an
// ingredient below or in the inventory to fill the next slot; click a filled slot to empty it.
function render_witch_cauldron() {
	if (no_graphics || !character) return;
	reset_inventory(1);
	topleft_npc = "witchcipher";
	rendered_target = topleft_npc;
	var html = "<div id='witch-cauldron' style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div>";
	for (var i = 0; i < witch_slots(); i++) {
		if (witch_mix[i]) html += witch_icon(witch_mix[i], { cid: "witchslot" + i, onclick: "witch_mix_remove(" + i + ")" });
		else html += item_container({ shade: "cipherdraught", cid: "witchslot" + i, s_op: 0.36, draggable: false });
	}
	html += "</div>";
	html += "<div id='witch-status' class='mb5' style='color:#AF6AE2; font-size: 20px'>" + witch_status_html() + "</div>";
	html += "<div class='mb5'>";
	witch_ingredients().forEach(function (name) {
		html += item_container({ skin: G.items[name].skin, draggable: false, onclick: "witch_mix_add(\"" + name + "\")" }, { name: name, q: witch_count(name) });
	});
	html += "</div>";
	if (witch_result)
		html +=
			"<div class='mb5' style='font-size: 20px'><span style='color:#85C76B'>" +
			phrase.html("interface.witch.right", { count: witch_result.right }) +
			"</span> <span style='color:#AF6AE2'>" +
			(witch_result.parcels ? phrase.html("interface.witch.parcels_paid", { count: witch_result.parcels }) : phrase.html("interface.witch.parcels_none")) +
			"</span></div>";
	else if (witch_mix.indexOf(null) == -1) {
		// Before brewing: does this mix fit the clues, so it pays a Parcel?
		var fits = witch_mix_fits(witch_mix);
		if (fits === true) html += "<div class='mb5' style='font-size: 20px; color:#85C76B'>" + phrase.html("interface.witch.fits") + "</div>";
		else if (fits === false) html += "<div class='mb5' style='font-size: 20px; color:#9B9B9B'>" + phrase.html("interface.witch.fits_not") + "</div>";
		else if (fits == "tried") html += "<div class='mb5' style='font-size: 20px; color:#9B9B9B'>" + phrase.html("interface.witch.fits_tried") + "</div>";
	}
	html +=
		"<div><div class='gamebutton clickable' onclick='witch_mix_reset()'>" +
		phrase.html("interface.craftsman.reset") +
		"</div> <div class='gamebutton clickable' onclick='witch_brew_click()'>" +
		phrase.html("interface.witch.brew") +
		"</div></div>";
	html += "</div>";
	html += "<div id='witch-board' style='display: inline-block; vertical-align: top; margin-left: 5px'>" + witch_board_html() + "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	if (!witch_timer)
		witch_timer = setInterval(function () {
			if (!$("#witch-cauldron").length) {
				clearInterval(witch_timer);
				witch_timer = null;
				return;
			}
			$("#witch-status").html(witch_status_html());
		}, 1000);
}

function witch_mix_add(name) {
	if (!witch_ingredients().includes(name) || witch_count(name) < 1) return;
	witch_slots();
	var slot = witch_mix.indexOf(null);
	if (slot == -1) return;
	witch_mix[slot] = name;
	witch_result = null;
	render_witch_cauldron();
}

function witch_mix_remove(slot) {
	witch_mix[slot] = null;
	witch_result = null;
	render_witch_cauldron();
}

function witch_mix_reset() {
	witch_mix = [];
	witch_result = null;
	render_witch_cauldron();
}

// One brew at a time: a second click while the first is on its way would spend another of the day's mixes
var witch_brewing = false;
function witch_brew_click() {
	if (witch_brewing) return;
	witch_slots();
	if (witch_mix.indexOf(null) != -1) return add_log(phrase.html("interface.witch.fill_slots", { count: witch_mix.length }), "gray");
	var mix = witch_mix.slice();
	witch_brewing = true;
	witch_request("brew", { items: mix })
		.then(function (data) {
			witch_result = data;
			witch_mix = [];
			if ($("#witch-cauldron").length) render_witch_cauldron();
		})
		.catch(witch_failure)
		.finally(function () {
			witch_brewing = false;
		});
}

// The board follows server.status.witchcipher while the cauldron is open.
function witch_cipher_refresh() {
	if (no_graphics || !$("#witch-board").length) return;
	$("#witch-board").html(witch_board_html());
	$("#witch-status").html(witch_status_html());
}

// Trick or Treat: knock on the door you stand next to (or a given door index).
function knock_request(door) {
	var id = randomStr(30);
	return new Promise(function (resolve, reject) {
		var timer = setTimeout(function () {
			finish({ failed: true, reason: "timeout" });
		}, 10000);
		function response(data) {
			if (data && data.request_id === id && data.place === "interaction") finish(data);
		}
		function finish(data) {
			clearTimeout(timer);
			socket.off("game_response", response);
			if (data.failed) reject(data);
			else resolve(data);
		}
		socket.on("game_response", response);
		socket.emit("interaction", { type: "knock", door: door, request_id: id });
	});
}

function knock_click(door) {
	knock_request(door).catch(function (data) {
		if (no_graphics || !data) return;
		var known = ["trickortreat_season", "trickortreat_door", "trickortreat_knocked", "trickortreat_limit", "cant_in_bank"];
		if (known.includes(data.reason)) add_log(phrase.html("interface.trickortreat.fail." + data.reason), "gray");
	});
}
