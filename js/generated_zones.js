var generated_map_chunks = null;
var client_generated_maps = [];
function receive_generated_map_chunk(data) {
	if (
		!data ||
		!/^[a-f0-9]{24}$/.test(data.run) ||
		!Number.isInteger(data.index) ||
		!Number.isInteger(data.count) ||
		data.count < 1 ||
		data.count > 1400 ||
		typeof data.text !== "string" ||
		data.text.length > 12000
	)
		throw Error("Invalid map chunk");
	if (data.index === 0) generated_map_chunks = { run: data.run, count: data.count, parts: [], size: 0 };
	var pending = generated_map_chunks;
	if (!pending || data.run !== pending.run || data.count !== pending.count || data.index !== pending.parts.length) throw Error("Out-of-order map chunk");
	pending.parts.push(data.text);
	pending.size += data.text.length;
	if (pending.size > 16 * 1024 * 1024) {
		generated_map_chunks = null;
		throw Error("Oversized generated map");
	}
	if (pending.parts.length !== pending.count) return;
	generated_map_chunks = null;
	var bundle = JSON.parse(pending.parts.join(""));
	if (bundle.run !== data.run || !Array.isArray(bundle.floors) || bundle.floors.length < 1 || bundle.floors.length > 8) throw Error("Invalid generated bundle");
	for (var i = 0; i < bundle.floors.length; i++) {
		var floor = bundle.floors[i];
		if (
			floor.key !== "zone_" + bundle.run + "_" + floor.definition.generated.floor ||
			floor.definition.generated.run !== bundle.run ||
			!Array.isArray(floor.geometry.x_lines) ||
			!Array.isArray(floor.geometry.y_lines)
		)
			throw Error("Invalid generated floor");
	}
	for (var info of bundle.manifest || []) {
		if (info.key !== "zone_" + bundle.run + "_" + info.definition.generated.floor) throw Error("Invalid floor manifest");
		if (!G.maps[info.key]) {
			G.maps[info.key] = info.definition;
			client_generated_maps.push(info.key);
		}
	}
	for (var floor of bundle.floors) {
		if (G.geometry[floor.key]) continue; // Immutable identity; duplicate delivery is harmless.
		G.maps[floor.key] = floor.definition;
		G.geometry[floor.key] = floor.geometry;
		G.maps[floor.key].data = floor.geometry;
		if (!client_generated_maps.includes(floor.key)) client_generated_maps.push(floor.key);
	}
}
function prune_generated_maps() {
	var keep = G.maps[current_map] && G.maps[current_map].generated;
	client_generated_maps = client_generated_maps.filter(function (key) {
		if (key === current_map) return true;
		if (!no_graphics) {
			(tile_sprites[key] || []).forEach((row) =>
				row.forEach((sprite) => {
					if (sprite && !sprite._destroyed) sprite.destroy();
				}),
			);
			(tile_textures[key] || []).forEach((row) => row.forEach((texture) => texture.destroy(false)));
			delete tile_sprites[key];
			delete tile_textures[key];
			delete sprite_last[key];
		}
		delete G.geometry[key];
		if (keep && G.maps[key]?.generated.run === keep.run) {
			delete G.maps[key].data;
			return true;
		}
		for (var id in chests)
			if (chests[id].map === key) {
				if (!no_graphics) destroy_sprite(chests[id]);
				delete chests[id];
			}
		delete G.maps[key];
		return false;
	});
}

var cave_client_state = null;
var cave_last_state = null;
var cave_open_choice = null;
var cave_result_timer = null;
var cave_visit = null;
var cave_visit_request = null;
var cave_server_offset = 0;
var cave_ui_next = 0;
var cave_reward_run = null;
var cave_reward_seen = 0;
var cave_active_reward = null;
var cave_notice_until = 0;
var cave_hud_width = 0;
var cave_enter_pending = false;
var cave_info_visible = false;
function cave_now() {
	return Date.now() + cave_server_offset;
}
function cave_time(ms) {
	var seconds = Math.max(0, Math.ceil(ms / 1000));
	return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
function cave_remaining(state) {
	return state.paused ? state.remaining_ms : Math.max(0, state.expires - cave_now());
}
function receive_cave_state(data) {
	if (!data || (data.type !== "ended" && !data.state)) return;
	var previous = cave_client_state;
	if (data.state?.server_time) cave_server_offset = data.state.server_time - Date.now();
	if (data.type === "ended") cave_last_state = data.state || previous;
	cave_client_state = data.type === "ended" ? null : data.state;
	if (character) {
		character.cave = cave_client_state;
		if (cave_client_state?.paused) {
			character.moving = false;
			character.vx = character.vy = 0;
		}
	}
	call_code_function("trigger_character_event", "cave", cave_client_state);
	call_code_function("trigger_event", "cave", cave_client_state);
	if (no_graphics) return;
	if (!!previous !== !!cave_client_state || previous?.paused !== cave_client_state?.paused) reflect_music();
	cave_receive_rewards(data.state, data.type === "returned");
	update_cave_doors();
	if (data.type === "ended") {
		cave_open_choice = null;
		if ($(".modal:last").hasClass("cave-dialogue-modal")) hide_modal();
		if ($("#cave-vote,#cave-status").length) $("#topleftcornerui").empty();
		if (cave_visit) {
			cave_visit.available = !!cave_visit.unlimited;
			delete cave_visit.resume;
		}
		update_cave_hud(true);
		update_cave_info();
		return;
	}
	if (data.type === "chat" && data.chat) {
		var text = phrase.message(data.chat.text_message || data.chat.text);
		render_interaction({ auto: true, full: true, skin: data.chat.skin, cx: data.chat.cx, message: "<span style='color:#725398'>" + html_escape(data.chat.name) + "</span><br>" + html_escape(text) });
		var speaker = Object.values(entities).find((e) => e.name === data.chat.name && e.cave);
		if (speaker) d_text(text, speaker, { color: "#C3DBAC" });
	}
	if (data.type === "cue" && data.cue && data.cue.map === current_map) {
		var actor = get_entity(data.cue.actor),
			text = phrase.message(data.cue.text_message || data.cue.text);
		if (actor) {
			d_text(text, actor, { color: "#F2BB73" });
			start_emblem(actor, "rr1", { frames: 20 });
		}
		ui_log(text, "#F2BB73");
	}
	var choice = data.state.choice;
	if (
		choice &&
		(data.type === "choice" ||
			data.type === "result" ||
			(data.state.paused && !choice.resolved && cave_open_choice !== choice.id) ||
			($("#cave-vote").length &&
				(!previous?.choice ||
					previous.choice.id !== choice.id ||
					previous.choice.resolved !== choice.resolved ||
					JSON.stringify(previous.choice.votes) !== JSON.stringify(choice.votes) ||
					previous.choice.shop?.sold !== choice.shop?.sold ||
					previous.choice.shop?.nearby !== choice.shop?.nearby)))
	)
		render_cave_choice();
	update_cave_hud(true);
	update_cave_info();
}
function cave_request(action, fields) {
	var id = randomStr(30);
	return new Promise(function (resolve, reject) {
		var timer = setTimeout(
			function () {
				finish({ failed: true, reason: "timeout" });
			},
			action === "enter" ? 150000 : 10000,
		);
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
		socket.emit("interaction", Object.assign({}, fields || {}, { type: "cave", action, request_id: id }));
	});
}
function cave_manual(action, fields) {
	if (no_graphics) return;
	if (action === "enter") {
		if (cave_enter_pending) return;
		cave_enter_pending = true;
		render_interaction({ auto: true, full: true, skin: G.npcs.dreamkeeper.skin, cx: G.npcs.dreamkeeper.cx, message: "<div id='cave-entry-status'>" + phrase.html("cave.checking_entry") + "</div>" });
	}
	return cave_request(action, fields)
		.then(function (data) {
			if (action === "enter") {
				$("#topleftcornerui").empty();
				render_cave_status();
			}
			if (action === "vote" || action === "buy" || (action === "talk" && !data.chat)) render_cave_choice();
			return data;
		})
		.catch(function (error) {
			if (action === "enter") for (var scene of cave_entry_scenes.slice()) if (scene.me) finish_cave_entry(scene.key);
			var message = phrase("cave.error." + error.reason);
			if (message === "cave.error." + error.reason) message = phrase("cave.error.generic");
			if (action === "enter" && current_map === "main" && $("#cave-entry-status").length) render_cave_keeper(message);
			ui_log(message, "#C55E67");
		})
		.finally(function () {
			if (action === "enter") cave_enter_pending = false;
		});
}
function cave_load_visit() {
	if (no_graphics || !character || !socket) return;
	if (cave_visit_request || (cave_visit && Date.now() - cave_visit.checked < 30000)) return cave_visit_request;
	cave_visit_request = cave_request("info")
		.then(function (data) {
			cave_visit = data.visit;
			cave_visit.checked = Date.now();
			cave_server_offset = data.visit.server_time - Date.now();
			$("#cave-keeper-greeting").text(phrase(cave_visit.resume ? "cave.keeper_return" : cave_visit.unlimited ? "cave.keeper_dev" : "cave.keeper", { server: cave_visit.resume?.server }));
			$("#cave-keeper-enter").text(phrase(cave_visit.resume ? "cave.return" : "cave.enter"));
			update_cave_hud(true);
			update_cave_info();
		})
		.catch(function () {})
		.finally(function () {
			cave_visit_request = null;
		});
	return cave_visit_request;
}
function open_cave_info() {
	if (no_graphics) return;
	cave_load_visit();
	open_guide("cave-of-many-dreams", "/docs/ref/cave-of-many-dreams");
}
function cave_info_available() {
	if (!character || !G.events.dreams) return false;
	if (G.maps[current_map]?.generated?.zone === "dreams") return true;
	if (current_map !== "main") return false;
	var keeper = G.maps.main.npcs.find((npc) => npc.id === "dreamkeeper");
	return !!keeper && point_distance(character.real_x, character.real_y, keeper.position[0], keeper.position[1]) < 240;
}
function cave_visit_text() {
	if (!cave_visit) return phrase("cave.checking_visit");
	if (cave_visit.resume) return phrase("cave.return") + " · " + cave_visit.resume.server;
	if (cave_visit.unlimited) return phrase("cave.visit_unlimited");
	if (cave_visit.available || cave_visit.resets <= cave_now()) return phrase("cave.visit_ready");
	var minutes = Math.max(0, Math.ceil((cave_visit.resets - cave_now()) / 60000));
	return phrase("cave.visit_cooldown", { hours: Math.floor(minutes / 60), minutes: minutes % 60, home: cave_visit.home });
}
function cave_reward_html(reward) {
	var text,
		icon = "";
	if (reward.where === "purse") {
		var parts = [];
		if (reward.gold) parts.push(phrase("cave.gold", { gold: "+" + to_pretty_num(reward.gold) }));
		if (reward.amber) parts.push("+" + reward.amber + " " + G.items.cave_amber.name);
		return phrase.html("cave.purse_added", { reward: parts.join(" · ") });
	}
	if (reward.item) icon = item_container({ skin: G.items[reward.item.name].skin, def: G.items[reward.item.name], draggable: false }, reward.item, { r: 2 }) + " ";
	var who = reward.recipient === (character?.name || character?.id) ? phrase("cave.you") : reward.recipient;
	var what = reward.item ? (reward.item.q || 1) + " × " + G.items[reward.item.name].name : phrase("cave.gold", { gold: to_pretty_num(reward.gold) });
	text = phrase.html("cave.reward_to", { name: who, item: what });
	var where =
		reward.where === "inventory"
			? phrase("cave.inventory_slot", { slot: reward.slot + 1 })
			: reward.where === "gold"
				? phrase("cave.carried_gold")
				: reward.where === "mail"
					? phrase("cave.in_mail", { name: reward.recipient })
					: phrase("cave.mail_pending");
	return icon + text + "<div style='font-size:18px'>" + html_escape(where) + "</div>";
}
function update_cave_hud(force) {
	if (no_graphics) return;
	if (!force && Date.now() < cave_ui_next) return;
	cave_ui_next = Date.now() + 200;
	var state = cave_client_state;
	var nearby = cave_info_available();
	if (nearby !== cave_info_visible) {
		cave_info_visible = nearby;
		render_server();
	}
	if (!state || G.maps[current_map]?.generated?.zone !== "dreams") {
		if ($("#cave-hud").length) {
			$("#cave-hud").remove();
			reposition_ui();
		}
		if (Date.now() >= cave_notice_until) {
			$("#cave-reward-note").remove();
			return;
		}
		if (!$("#cave-reward-note").length) $("#topmid").append("<div id='cave-reward-note' class='cave-reward-note' role='status' style='display:none'></div>");
		cave_show_reward();
		return;
	}
	if (!$("#cave-hud").length) {
		$("#topmid").append(
			"<div id='cave-hud'><div class='cave-hud-row'><div class='gamebutton cave-clock' onclick='open_cave_info()'></div><div class='gamebutton cave-vote-clock' onclick='render_cave_choice()'></div><div class='gamebutton' onclick='open_cave_info()'>" +
				phrase.html("interface.item.info") +
				"</div><div class='gamebutton cave-exit' onclick='cave_manual(\"exit\")'>" +
				phrase.html("cave.exit") +
				"</div></div><div class='cave-purse' onclick='open_cave_info()'></div><div class='cave-progress'></div><div class='cave-hunt-note'></div></div>",
		);
		reposition_ui();
	}
	if (!$("#cave-reward-note").length) $("#topmid").append("<div id='cave-reward-note' class='cave-reward-note' role='status' style='display:none'></div>");
	$(".cave-clock").text(phrase(state.paused ? "cave.clock_paused" : "cave.clock_running", { time: cave_time(cave_remaining(state)) }));
	var purse =
		"<span>" +
		phrase.html("cave.party_gold", { gold: to_pretty_num(state.gold) }) +
		"</span>" +
		item_container({ skin: G.items.cave_amber.skin, draggable: false, size: 20, id: "cave-purse-amber" }, { name: "cave_amber" }) +
		"<span>" +
		phrase.html("cave.party_amber", { count: state.amber }) +
		"</span>";
	if ($(".cave-purse").data("contents") !== purse) $(".cave-purse").html(purse).data("contents", purse);
	var goals = cave_stair_goals(state);
	if ($(".cave-progress").data("contents") !== goals) $(".cave-progress").html(goals).data("contents", goals);
	$(".cave-progress").show();
	var choice = state.choice;
	$(".cave-vote-clock")
		.toggle(!!choice && !choice.resolved)
		.text(phrase("cave.vote_clock", { seconds: Math.max(0, Math.ceil(((choice?.deadline || 0) - cave_now()) / 1000)) }));
	$(".cave-vote-clock").toggleClass("cave-choice-hidden", !!state.paused && !!choice && !choice.resolved && !$("#cave-vote").is(":visible"));
	$(".cave-choice-clock").text(phrase("cave.seconds", { seconds: Math.max(0, Math.ceil(((choice?.deadline || 0) - cave_now()) / 1000)) }));
	cave_show_reward();
	var tasks = (state.hunts || []).map((h) => phrase.html("cave.hunt_clock", { kills: h.kills, count: h.count, time: cave_time(h.deadline - (state.paused ? state.paused_at : cave_now())) }));
	(state.practice || []).forEach((p) => tasks.push(phrase.html("cave.practice_clock", { name: p.name, hp: p.hp, time: cave_time(p.deadline - (state.paused ? state.paused_at : cave_now())) })));
	var hunts = tasks.map((t) => "<div class='gamebutton' style='font-size:20px'>" + t + "</div>").join(" ");
	if ($(".cave-hunt-note").data("contents") !== hunts) $(".cave-hunt-note").html(hunts).data("contents", hunts);
	$(".cave-hunt-note").toggle(!!tasks.length);
	var width = $("#topmid").outerWidth();
	if (width !== cave_hud_width) {
		cave_hud_width = width;
		reposition_ui();
	}
}
function update_cave_info() {
	if (no_graphics || !$("#cave-information").length) return;
	var state = cave_client_state,
		html = "";
	if (!state) html = "<p>" + html_escape(cave_visit_text()) + "</p>";
	else {
		html += "<p>" + phrase.html(state.paused ? "cave.clock_paused" : "cave.clock_running", { time: cave_time(cave_remaining(state)) }) + "</p>";
		html += "<p>" + phrase.html("cave.purse", { gold: to_pretty_num(state.gold), amber: state.amber }) + "<br>" + phrase.html("cave.purse_help") + "</p>";
		html += "<div class='slimbutton' onclick='cave_manual(\"exit\")'>" + phrase.html("cave.exit") + "</div><hr>";
		html += "<h3>" + phrase.html("cave.directions") + "</h3>";
		(state.doors || []).forEach((d, index) => {
			var label = phrase(d.down ? "cave.stairs_down" : d.to === "main" ? "cave.door_exit" : "cave.stairs_up");
			html +=
				"<div class='cave-direction-row'><span style='color:" +
				(d.locked ? "#AA7444" : "#487448") +
				"'>" +
				html_escape(label) +
				" · " +
				phrase.html(d.locked ? "cave.locked" : "cave.open") +
				"</span><div class='slimbutton' onclick='cave_walk_to(\"door\"," +
				index +
				")'>" +
				phrase.html("cave.walk_here") +
				"</div></div>";
		});
		html += "<p>" + phrase.html("cave.find_seals") + "</p>";
		state.objectives.forEach((o, index) => {
			html +=
				"<div class='cave-direction-row'><span>" +
				(o.done ? "✓ " : "") +
				html_escape(phrase.message(o.name_message || o.name)) +
				"<small>" +
				phrase.html("cave.floor_short", { floor: o.floor + 1 }) +
				(o.kind === "farm" ? " · " + phrase.html("cave.camp_packs", { count: o.waves || 0 }) : "") +
				"</small></span>" +
				(!o.done ? "<div class='slimbutton' onclick='cave_walk_to(\"room\"," + index + ")'>" + phrase.html("cave.walk_here") + "</div>" : "") +
				"</div>";
		});
		if (state.supplies.length) html += "<hr><p>" + phrase.html("cave.supplies_label") + " " + state.supplies.map((s) => phrase.html("cave.supply." + s)).join(", ") + "</p>";
	}
	var rewards = (state || cave_last_state)?.rewards || [];
	if (rewards.length)
		html +=
			"<hr><p>" +
			phrase.html("cave.recent_rewards") +
			"</p>" +
			rewards
				.slice()
				.reverse()
				.map((r) => "<div style='margin:10px 0'>" + cave_reward_html(r) + "</div>")
				.join("");
	$("#cave-information").html(html);
}
function render_cave_status() {
	if (!no_graphics) update_cave_hud(true);
}
function render_cave_keeper(message) {
	if (no_graphics) return;
	cave_load_visit();
	var keeper = G.npcs.dreamkeeper;
	render_interaction({
		auto: true,
		full: true,
		skin: keeper.skin,
		cx: keeper.cx || {},
		message:
			"<div " +
			(message ? "" : "id='cave-keeper-greeting' ") +
			"style='font-size:24px'>" +
			(message ? html_escape(message) : phrase.html(cave_visit?.resume ? "cave.keeper_return" : cave_visit?.unlimited ? "cave.keeper_dev" : "cave.keeper", { server: cave_visit?.resume?.server })) +
			"</div>",
	});
	$("#topleftcornerui > div").append(
		"<div style='clear:both;float:right;margin-top:7px'><div id='cave-keeper-enter' class='slimbutton' onclick='cave_manual(\"enter\")'>" +
			phrase.html(cave_visit?.resume ? "cave.return" : "cave.enter") +
			"</div> <div class='slimbutton' onclick='open_cave_info()'>" +
			phrase.html("interface.item.info") +
			"</div></div>",
	);
}
function render_cave_choice() {
	if (no_graphics || !cave_client_state?.choice) return;
	var choice = cave_client_state.choice,
		myVote = choice.votes[character.name || character.id];
	cave_open_choice = choice.id;
	var html =
		"<div id='cave-vote'><div class='cave-dialogue-title'>" +
		html_escape(phrase.message(choice.title_message || choice.title)) +
		"</div><div class='cave-speaker'>" +
		html_escape(choice.people[0]?.name || "") +
		"</div>" +
		(!choice.resolved ? "<p class='cave-dialogue-line'>" + html_escape(phrase.message(choice.text_message || choice.text)) + "</p>" : "") +
		"</div>";
	var scene = (choice.scene || []).filter((a) => a.id && a.name !== choice.people[0]?.name).slice(0, 7);
	if (scene.length)
		html +=
			"<div class='cave-scene'>" +
			scene
				.map(
					(a) =>
						"<div title='" +
						html_escape(a.name) +
						"'>" +
						sprite(a.skin, { cx: a.cx || {}, scale: 2, width: 52, height: 64 }) +
						"<small style='color:" +
						(["enemy", "predator"].includes(a.side) ? "#E58A80" : "#A9CDBA") +
						"'>" +
						html_escape(a.name) +
						"</small></div>",
				)
				.join("") +
			"</div>";
	if (!choice.resolved) {
		html +=
			"<div style='clear:both;font-size:20px;margin:8px 0'>" +
			phrase.html("cave.paused_choice") +
			"<br><span class='cave-choice-clock'>" +
			phrase.html("cave.seconds", { seconds: Math.max(0, Math.ceil((choice.deadline - cave_now()) / 1000)) }) +
			"</span></div>";
		if (choice.people.length > 1)
			html +=
				"<div style='font-size:20px'>" +
				choice.people
					.map((p) => html_escape(p.name) + ": " + to_pretty_num(p.hp) + " " + phrase.html("stat.hp.name") + " · " + to_pretty_num(Math.round(p.attack)) + " " + phrase.html("interface.monster.att"))
					.join("<br>") +
				"</div>";
		if (choice.people[0]?.cargo?.length)
			html +=
				"<div style='font-size:20px;margin:6px 0'>" +
				phrase.html("cave.carries", { name: choice.people[0].name }) +
				" " +
				choice.people[0].cargo.map((item) => item_container({ skin: G.items[item.name].skin, def: G.items[item.name], draggable: false }, item, { r: 2 })).join(" ") +
				"</div>";
		choice.options.forEach(function (option, index) {
			var voters = Object.keys(choice.votes).filter((n) => choice.votes[n] === option.id);
			var disabled = myVote || option.unavailable;
			html +=
				"<div class='slimbutton cave-reply' style='border-color:" +
				(index === 0 ? "#82BDA8" : "#AF90C8") +
				(disabled ? ";opacity:0.65" : "") +
				"'" +
				(disabled ? "" : ' onclick=\'cave_manual("vote",{choice:' + JSON.stringify(choice.id) + ",option:" + JSON.stringify(option.id) + "})'") +
				">" +
				html_escape(phrase.message(option.label_message || option.label)) +
				(voters.length ? "<div style='font-size:18px'>" + html_escape(voters.join(", ")) + "</div>" : "") +
				(option.unavailable ? "<div style='font-size:18px'>" + html_escape(phrase.message(option.unavailable_message || option.unavailable)) + "</div>" : "") +
				"</div>";
		});
		html +=
			"<div style='font-size:18px;margin-top:8px'>" +
			phrase.html(myVote ? "cave.vote_recorded" : "cave.one_vote") +
			"<br>" +
			phrase.html("cave.fallback", { fallback: phrase.message(choice.fallback_message || choice.fallback) }) +
			"</div>";
	} else {
		html +=
			"<div style='clear:both;font-size:22px;margin-top:8px'>" +
			phrase.html("cave.result", { reply: phrase.message(choice.result_message || choice.result_label) || phrase("cave.no_reply") }) +
			"</div>";
		html +=
			"<div style='font-size:24px;margin-top:8px'>" +
			(choice.summary?.length ? choice.summary.map((text, index) => html_escape(phrase.message(choice.summary_messages?.[index] || text))).join("<br>") : phrase.html("cave.keep_going")) +
			"</div>";
		if (choice.service === "recipes") html += "<div class='slimbutton' onclick='render_recipes()'>" + phrase.html("cave.recipes") + "</div>";
	}
	if (choice.shop) {
		html +=
			"<div style='clear:both;font-size:24px;margin-top:8px'>" +
			item_container({ skin: G.items[choice.shop.name].skin, def: G.items[choice.shop.name], draggable: false }, { name: choice.shop.name, level: 0 }, { r: 3 }) +
			" " +
			html_escape(G.items[choice.shop.name].name) +
			"</div>";
		html += "<div style='font-size:20px'>" + phrase.html("cave.shop_rule") + "</div>";
		if (choice.shop.sold) html += "<div style='font-size:24px'>" + phrase.html("cave.sold") + "</div>";
		else if (choice.resolved && choice.shop.nearby)
			html +=
				"<div class='slimbutton' onclick='cave_manual(\"buy\",{room:" + JSON.stringify(choice.shop.room) + "})'>" + phrase.html("cave.buy", { gold: to_pretty_num(choice.shop.price) }) + "</div>";
		else if (choice.resolved) html += "<div style='font-size:20px'>" + phrase.html("cave.shop_distance") + "</div>";
	}
	if (choice.resolved) html += "<div class='slimbutton cave-continue' onclick='hide_modal()'>" + phrase.html("cave.continue") + "</div>";
	var native = render_interaction({ auto: true, full: true, skin: choice.skin || G.npcs.dreamkeeper.skin, cx: choice.cx, message: html }, "return_html");
	var content = $(native).addClass("cave-dialogue").toggleClass("cave-result", !!choice.resolved);
	var existing = $(".cave-dialogue-modal .imodal");
	if (existing.length) {
		// Keep native stack order when a forced conversation takes focus over an open guide.
		var modal = existing.closest(".modal"),
			index = $(".modal").index(modal);
		if (index >= 0 && index < modal_count - 1) {
			modals.push(modals.splice(index, 1)[0]);
			modal.appendTo(document.body);
		}
		existing.empty().append(content);
		add_ui_close(existing, "modal", { frame: false, label: "X" });
		position_modals();
	} else show_modal(content.prop("outerHTML"), { wrap: false, opacity: 0.28, classes: "cave-dialogue-modal", close: { label: "X" } });
	$(".cave-vote-clock").removeClass("cave-choice-hidden");
	clearTimeout(cave_result_timer);
	if (choice.resolved && !choice.shop && !choice.service) {
		var id = choice.id;
		cave_result_timer = setTimeout(function () {
			if (cave_client_state?.choice?.id === id && $(".modal:last").hasClass("cave-dialogue-modal") && $(".cave-result #cave-vote").length) hide_modal();
		}, 4500);
	}
}

// Native atlas pieces keep the gate on the same pixel grid as Mainland.
var cave_gate_textures = {};
var cave_entry_scenes = [];
var cave_transport_scene = null;
function cave_transport_animation(event, data) {
	if (no_graphics || !character || event !== "transport" || !G.maps[current_map]?.generated || !G.maps[data.to]) return;
	if (character.animations.transport) return;
	start_animation(character, "transport");
	cave_transport_scene = { sprite: character, animation: character.animations.transport, map: current_map, socket: socket, at: Date.now() };
}
function cave_gate_piece(sheet, x, y, width, height) {
	if (no_graphics) return;
	var key = [sheet, x, y, width, height].join(":");
	if (!cave_gate_textures[key]) cave_gate_textures[key] = new PIXI.Texture(PIXI.utils.BaseTextureCache[G.tilesets[sheet].file], new PIXI.Rectangle(x, y, width, height));
	return new PIXI.Sprite(cave_gate_textures[key]);
}
function decorate_cave_gate(gate) {
	if (no_graphics) return;
	gate.texture = PIXI.Texture.EMPTY;
	gate.hitArea = new PIXI.Rectangle(-44, -48, 88, 60);
	var glow = new PIXI.Graphics();
	gate.addChild(glow);
	gate.cave_light = glow;
	function piece(sheet, sx, sy, w, h, x, y) {
		var sprite = cave_gate_piece(sheet, sx, sy, w, h);
		sprite.position.set(x, y);
		gate.addChild(sprite);
		return sprite;
	}
	function stone(sx, sy, w, h, x, y, left, right) {
		// Small rounded cuts from the native cave rim, only at exposed corners.
		var l = left ? 4 : 0,
			r = right ? 4 : 0;
		piece("dungeon", sx + l, sy, w - l - r, 4, x + l, y);
		piece("dungeon", sx, sy + 4, w, h - 4, x, y + 4);
		if (left) piece("dungeon", 226, 130, 4, 4, x, y);
		if (right) piece("dungeon", 266, 130, 4, 4, x + w - 4, y);
	}
	// Rock faces from Cave of Darkness, placed as a stepped arch. Straight sides
	// descend to the ground; the crown rises into the cliff, leaving a deep opening.
	for (var side of [-1, 1]) {
		for (var y = -24; y < 8; y += 8) {
			var sx = 224 + (y % 16 === 0 ? 0 : 8),
				x = side < 0 ? -32 : 24;
			if (y === -24) stone(sx, 176, 8, 8, x, y, side < 0, side > 0);
			else piece("dungeon", sx, 176, 8, 8, x, y);
		}
		for (var y = -32; y < 8; y += 8) piece("dungeon", 224, 184, 8, 8, side < 0 ? -24 : 16, y);
		stone(224, 176, 16, 16, side < 0 ? -24 : 8, -40, side < 0, side > 0);
		stone(224, 176, 16, 16, side < 0 ? -16 : 0, -48, side < 0, side > 0);
	}
	stone(224, 176, 16, 8, -8, -52, true, true);
	// Small plants and the shipped brazier with its original three flame frames.
	for (var x of [-30, 17]) piece("outside", 736, 560, 16, 32, x, -43);
	piece("outside", 736, 560, 16, 32, -8, -60);
	gate.cave_flames = [];
	for (var x of [-48, 32]) {
		piece("dungeon", 16, 304, 16, 32, x, -12);
		var flame = piece("custom_a", 0, 0, 16, 16, x, -12);
		gate.cave_flames.push(flame);
	}
	// Place the portal over the empty doorway, below the stone rim.
	gate.addChildAt(glow, gate.children.length - 5);
	gate.cave_frame = -1;
}
function cave_entry_animation(data) {
	if (no_graphics) return;
	if (data.cancel) {
		finish_cave_entry(data.key);
		return;
	}
	if (current_map !== "main" || !Array.isArray(data.names) || cave_entry_scenes.some((scene) => scene.key === data.key)) return;
	var scene = { key: data.key, socket, at: Date.now(), duration: Math.min(2400, Math.max(500, data.duration || 1800)), sprites: [], me: data.names.includes(character?.name) };
	for (var name of data.names.slice(0, 3)) {
		var sprite = get_player(name);
		if (!sprite) continue;
		var sparks = new PIXI.Graphics();
		sparks.zy = 1200;
		sprite.addChild(sparks);
		sprite.moving = false;
		sprite.vx = sprite.vy = 0;
		start_animation(sprite, "transport");
		scene.sprites.push({ sprite, sparks, x: sprite.pivot.x, y: sprite.pivot.y, animation: sprite.animations.transport });
	}
	cave_entry_scenes.push(scene);
	if (scene.me) {
		render_interaction({ auto: true, full: true, skin: G.npcs.dreamkeeper.skin, cx: G.npcs.dreamkeeper.cx, message: "<div id='cave-entry-status'>" + phrase.html("cave.opening") + "</div>" });
		if (character) character.cave_entering = true;
		if (!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
			h_shake();
			for (var delay of [0, 500, 1000])
				draw_timeout(function () {
					if (current_map === "main") v_shake();
				}, delay);
		}
	}
}
function finish_cave_entry(key) {
	if (no_graphics) return;
	cave_entry_scenes = cave_entry_scenes.filter(function (scene) {
		if (key !== undefined && scene.key !== key) return true;
		for (var actor of scene.sprites) {
			var sprite = actor.sprite;
			if (sprite._destroyed || !sprite.pivot) continue;
			if (!sprite.dead) sprite.pivot.set(actor.x, actor.y);
			if (!actor.sparks._destroyed) actor.sparks.destroy();
			if (sprite.animations?.transport === actor.animation && !sprite.tp) stop_animation(sprite, "transport");
		}
		if (scene.me && character) {
			delete character.cave_entering;
			if (current_map !== "main") {
				if ($("#cave-entry-status").length) $("#topleftcornerui").empty();
				if (!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) v_shake();
			}
		}
		return false;
	});
}
function draw_cave_entrance() {
	if (no_graphics) return;
	var now = Date.now();
	if (cave_transport_scene) {
		var travel = cave_transport_scene,
			sprite = travel.sprite;
		if (!transporting || current_map !== travel.map || character !== sprite || socket !== travel.socket || socket?.disconnected || sprite.rip || now - travel.at >= 150000) {
			if (!sprite._destroyed && sprite.animations?.transport === travel.animation && !sprite.tp && !sprite.c?.town) stop_animation(sprite, "transport");
			cave_transport_scene = null;
		}
	}
	for (var scene of cave_entry_scenes.slice()) {
		var age = now - scene.at,
			done = current_map !== "main" || socket !== scene.socket || socket?.disconnected || age > 150000 || scene.sprites.every((actor) => actor.sprite._destroyed || actor.sprite.dead);
		if (done) {
			finish_cave_entry(scene.key);
			continue;
		}
		for (var actor of scene.sprites) {
			var sprite = actor.sprite;
			if (sprite._destroyed || !sprite.pivot) continue;
			var step = Math.floor(age / 45),
				pull = Math.pow(Math.min(1, Math.max(0, (age / scene.duration - 0.35) / 0.65)), 2);
			sprite.pivot.set(actor.x + (age < scene.duration ? [-1, 1, 0, 2, -2, 0][step % 6] : 0) + Math.round((sprite.real_x - 816) * pull), actor.y + Math.round((sprite.real_y - 1148) * pull));
			if (actor.frame !== step) {
				actor.frame = step;
				var sparks = actor.sparks;
				sparks.clear();
				for (var i = 0; i < 18; i++) {
					var angle = ((i + step) * Math.PI) / 8,
						y = -((i * 7 + step * 3) % 46),
						x = Math.round(Math.cos(angle) * (13 + 4 * Math.sin(angle)));
					sparks.beginFill([0xa7d3d0, 0xd8ebcf, 0x729d9e][i % 3]);
					sparks.drawRect(x, y, 1, i % 4 === 0 ? 4 : 2);
					sparks.endFill();
				}
			}
		}
	}
	var gate = animatables.dreams_gate;
	if (current_map !== "main" || !gate?.cave_light || gate._destroyed) return;
	var frame = Math.floor(now / 120),
		active = cave_entry_scenes.length > 0;
	if (gate.cave_frame === frame && gate.cave_active === active) return;
	gate.cave_frame = frame;
	gate.cave_active = active;
	gate.cave_flames.forEach(function (flame, i) {
		var key = ["custom_a", ((frame + i) % 3) * 16, 0, 16, 16].join(":");
		if (!cave_gate_textures[key]) {
			var sample = cave_gate_piece("custom_a", ((frame + i) % 3) * 16, 0, 16, 16);
			sample.destroy();
		}
		flame.texture = cave_gate_textures[key];
	});
	var light = gate.cave_light;
	light.clear();
	light.beginFill(active ? 0x38657b : 0x222638);
	light.drawPolygon([-16, 0, -16, -24, -12, -24, -12, -32, -6, -32, -6, -36, 6, -36, 6, -32, 12, -32, 12, -24, 16, -24, 16, 0]);
	light.endFill();
	light.beginFill(active ? 0x599899 : 0x30354d);
	light.drawRect(-14, -22, 2, 22);
	light.drawRect(12, -22, 2, 22);
	light.endFill();
	for (var i = 0; i < 16; i++) {
		var x = ((i * 17 + frame * (active ? 2 : 1)) % 26) - 13,
			y = -30 + ((i * 11 + frame) % 28);
		if (y < -24 && Math.abs(x) > 6) continue;
		light.beginFill([0x729d9e, 0xa7d3d0, 0x686c9c, 0xd8ebcf][(i + frame) % 4]);
		light.drawRect(x, y, active ? 2 : 1, 1);
		if (active && i % 3 === 0) light.drawRect(x, y - 1, 1, 3);
		light.endFill();
	}
}

function cave_walk_to(kind, index) {
	if (no_graphics || !cave_client_state) return;
	var state = cave_client_state,
		point = kind === "door" ? state.doors?.[index] : state.objectives?.[index];
	if (!point) return;
	var targetMap = point.map || "zone_" + state.run + "_" + point.floor;
	hide_modal();
	smart_smart_move("map", targetMap, { map: targetMap, x: point.x, y: point.y });
}
function decorate_cave_door(door, definition) {
	if (no_graphics || !G.maps[current_map]?.generated) return;
	door.cave_definition = definition;
	var floor = G.maps[current_map].generated.floor,
		destination = G.maps[definition[4]];
	door.name = phrase(destination?.generated?.floor > floor ? "cave.stairs_down" : definition[4] === "main" ? "cave.door_exit" : "cave.stairs_up");
	if (cave_door_locked(definition)) door.name += " · " + phrase("cave.locked");
	door.color = cave_door_locked(definition) ? "#E6A15B" : "#D4BAEB";
	door.npc = true;
	add_name_tag(door);
	if (door.name_tag) door.name_tag.y = -78;
}

function cave_door_locked(definition) {
	return !!cave_client_state?.doors?.some((d) => d.to === definition[4] && d.locked);
}
function update_cave_doors() {
	if (no_graphics || !G.maps[current_map]?.generated) return;
	for (var door of map_doors) if (door.cave_definition) decorate_cave_door(door, door.cave_definition);
}
function cave_stair_goals(state) {
	if (!state) return "";
	var goals = (state.objectives || []).filter((o) => o.required && o.floor === state.floor);
	if (!goals.length) return "";
	var done = goals.filter((o) => o.done).length;
	var last = !(state.doors || []).some((d) => d.down);
	var title = last ? (done === goals.length ? "cave.completed" : "cave.finish_progress") : done === goals.length ? "cave.stairs_ready" : "cave.stair_progress";
	var html = "<div class='cave-goal-title'>" + phrase.html(title, { count: done, total: goals.length }) + "</div>";
	for (var goal of goals) {
		var label = phrase("cave.goal." + goal.kind, { name: phrase.message(goal.name_message || goal.name) });
		html +=
			"<div class='cave-goal " +
			(goal.done ? "cave-goal-done" : "") +
			"' onclick='cave_walk_to(\"room\"," +
			state.objectives.indexOf(goal) +
			")'>" +
			(goal.done ? "✓ " : "• ") +
			html_escape(label) +
			"</div>";
	}
	return html;
}
function render_cave_stairs() {
	if (no_graphics) return;
	render_interaction({
		auto: true,
		full: true,
		skin: G.npcs.dreamkeeper.skin,
		cx: G.npcs.dreamkeeper.cx,
		message: "<div class='cave-stairs-message'>" + phrase.html("cave.stairs_closed") + cave_stair_goals(cave_client_state) + "</div>",
	});
}
function cave_transport_failed(data) {
	if (data.reason === "seal_closed") {
		render_cave_stairs();
		return;
	}
	if (no_graphics) return;
	var key = "cave.error." + data.reason,
		text = phrase(key);
	ui_log(text === key ? phrase("response.transport_cant_reach") : text, "#DCA99B");
}
function cave_receive_rewards(state, returning) {
	if (no_graphics || !state) return;
	if (state.run !== cave_reward_run || returning) {
		cave_reward_run = state.run;
		cave_reward_seen = 0;
		cave_active_reward = null;
		cave_notice_until = 0;
	}
	for (var reward of state.rewards || []) {
		if (reward.id > cave_reward_seen) {
			cave_reward_seen = reward.id;
			if (returning) continue;
			cave_active_reward = reward;
			cave_notice_until = Date.now() + 3500;
			cave_reward_feedback(reward);
		} else if (cave_active_reward?.id === reward.id) cave_active_reward = reward;
	}
}
function cave_show_reward() {
	if (no_graphics) return;
	var visible = cave_active_reward && Date.now() < cave_notice_until;
	$(".cave-reward-note").toggle(!!visible);
	if (visible) {
		var html = cave_reward_html(cave_active_reward);
		if ($(".cave-reward-note").data("contents") !== html) $(".cave-reward-note").html(html).data("contents", html);
	}
}
function cave_reward_feedback(reward) {
	if (no_graphics || !character) return;
	var purse = $(".cave-purse")[0];
	if (purse && reward.where === "purse") {
		purse.classList.remove("cave-awarded");
		void purse.offsetWidth;
		purse.classList.add("cave-awarded");
	}
	var text,
		color = "#E7BF75",
		target = character;
	if (reward.where === "purse") {
		var parts = [];
		if (reward.gold) parts.push(phrase("cave.gold", { gold: "+" + to_pretty_num(reward.gold) }));
		if (reward.amber) parts.push("+" + reward.amber + " " + G.items.cave_amber.name);
		text = phrase("cave.purse_added", { reward: parts.join(" · ") });
	} else {
		var what = reward.item ? (reward.item.q || 1) + " × " + G.items[reward.item.name].name : phrase("cave.gold", { gold: to_pretty_num(reward.gold) });
		text = phrase("cave.reward_to", { name: reward.recipient === character.name ? phrase("cave.you") : reward.recipient, item: what });
		target = get_player(reward.recipient) || character;
	}
	d_text(text, target, { color, size: "large" });
}
function decorate_cave_chest(chest) {
	if (no_graphics) return;
	chest.cave_born = Date.now();
	chest.cave_sparks = new PIXI.Graphics();
	chest.addChild(chest.cave_sparks);
}
function draw_cave_chests() {
	if (no_graphics) return;
	var now = Date.now();
	for (var chest of Object.values(chests)) {
		if (!chest.cave_sparks || chest._destroyed || chest.map !== current_map) continue;
		var age = now - chest.cave_born;
		chest.pivot.y = chest.openning ? 0 : age < 500 ? Math.round(14 * (1 - age / 500)) : age < 700 ? -Math.round(3 * Math.sin(((age - 500) * Math.PI) / 200)) : 0;
		var frame = Math.floor(now / 160);
		if (frame === chest.cave_frame) continue;
		chest.cave_frame = frame;
		var sparks = chest.cave_sparks;
		sparks.clear();
		if (chest.openning) continue;
		for (var i = 0; i < 3; i++) {
			var phase = (frame + i * 4) % 16;
			if (phase > 5) continue;
			var x = [-9, 8, 1][i],
				y = [-12, -17, -24][i] - Math.floor(phase / 2);
			sparks.beginFill(phase < 3 ? 0xfff0b9 : 0xd99349);
			sparks.drawRect(x, y, 1, 1);
			if (phase === 2) {
				sparks.drawRect(x - 1, y, 3, 1);
				sparks.drawRect(x, y - 1, 1, 3);
			}
			sparks.endFill();
		}
	}
}
