// The Events window: the realm's published lineup (server.status.schedule), each season's last day,
// today's attractions and reminders. Opened from the realm clock, the event slider above chat and
// the card on character selection. Server rules: node/logic/event_schedule.js.

var schedule_offset = 0,
	events_time_mode = "local",
	events_period = "next",
	events_reminded = {},
	events_reminders_swept = 0;

// Server time, so countdowns don't depend on the player's clock. Synced once per packet: an older packet
// read again later (when a window opens) must not move the clock back.
var schedule_synced = null;
function schedule_sync() {
	if (typeof S == "undefined" || !S || !S.schedule || !S.schedule.server_time || S.schedule.server_time === schedule_synced) return;
	schedule_synced = S.schedule.server_time;
	schedule_offset = S.schedule.server_time - Date.now();
}

function schedule_now() {
	return Date.now() + schedule_offset;
}

function schedule_list() {
	return (typeof S != "undefined" && S && S.schedule && S.schedule.events) || [];
}

function schedule_next(event) {
	var now = schedule_now(),
		found = null;
	schedule_list()
		.concat((S && S.schedule && S.schedule.repeats) || [])
		.forEach(function (occurrence) {
			if (occurrence.event == event && occurrence.status == "scheduled" && occurrence.at > now && (!found || occurrence.at < found.at)) found = occurrence;
		});
	return found;
}

function schedule_realm_zone() {
	var offset = (S && S.schedule && S.schedule.time_offset) || 0;
	return "Etc/GMT" + (offset > 0 ? "-" + offset : offset < 0 ? "+" + -offset : "");
}

function schedule_format(ms, fields, mode) {
	var options = Object.assign({}, fields);
	if ((mode || events_time_mode) == "realm") options.timeZone = schedule_realm_zone();
	try {
		return new Intl.DateTimeFormat(phrase.language || "en", options).format(ms);
	} catch (e) {
		return new Intl.DateTimeFormat("en", options).format(ms);
	}
}

function schedule_time_text(ms, mode) {
	return schedule_format(ms, { hour: "2-digit", minute: "2-digit", hour12: false }, mode);
}

function schedule_day_text(ms) {
	return schedule_format(ms, { weekday: "short", day: "numeric", month: "short" });
}

function schedule_utc_offset(mode) {
	var minutes = mode == "realm" ? ((S && S.schedule && S.schedule.time_offset) || 0) * 60 : -new Date().getTimezoneOffset(),
		sign = minutes < 0 ? "-" : "+";
	minutes = Math.abs(minutes);
	return "UTC" + sign + Math.floor(minutes / 60) + (minutes % 60 ? ":" + String(minutes % 60).padStart(2, "0") : "");
}

// "in 18m", "in 3h 5m", "in 2d 4h"
function schedule_countdown(ms) {
	var minutes = Math.max(0, Math.ceil(ms / 60000));
	if (minutes < 60) return phrase("interface.events.in_minutes", { m: minutes });
	var hours = Math.floor(minutes / 60);
	if (hours < 48) return phrase("interface.events.in_hours", { h: hours, m: minutes % 60 });
	return phrase("interface.events.in_days", { d: Math.floor(hours / 24), h: hours % 24 });
}

function schedule_event_name(event) {
	var def = G.events[event];
	return def ? phrase.definition("event", event, "name", def.name) : event;
}

function schedule_icon(event) {
	var def = G.events[event] || {};
	if (G.items[def.sprite]) return item_container({ skin: G.items[def.sprite].skin, draggable: false });
	return sprite(def.sprite || event, { overflow: true });
}

function events_button(label, action) {
	return "<div class='gamebutton events-button' onclick='" + action + "'>" + label + "</div>";
}

function events_join_action(event) {
	return "pcs(event); join(\"" + event + "\").catch(witch_failure); hide_modal();";
}

// A live scheduled event the player can join right now.
function events_joinable(event) {
	return !!(S && S[event] && G.events[event] && G.events[event].join && (S[event].live !== false));
}

function events_guide_action(event) {
	return "pcs(event); open_guide(\"event-" + event + "\",\"/docs/guide/event-" + event + "\")";
}

function events_reminder_key(occurrence) {
	return "event_reminder:" + ((S && S.schedule && S.schedule.realm) || "") + ":" + occurrence.id;
}

function events_reminder_get(occurrence) {
	try {
		return localStorage.getItem(events_reminder_key(occurrence)) === "1";
	} catch (e) {
		return false;
	}
}

function events_reminder_toggle(id) {
	var occurrence = schedule_list().find((o) => o.id == id);
	if (!occurrence) return;
	try {
		if (events_reminder_get(occurrence)) localStorage.removeItem(events_reminder_key(occurrence));
		else localStorage.setItem(events_reminder_key(occurrence), "1");
	} catch (e) {}
	render_events_window();
}

function events_row(args) {
	return (
		"<div class='agenda-row'><div class='agenda-time'>" +
		(args.time || "") +
		"<small>" +
		(args.tag || "") +
		"</small></div><div class='agenda-icon'>" +
		(args.icon || "") +
		"</div><div><div class='agenda-name'>" +
		args.name +
		"</div><div class='agenda-meta'" +
		(args.meta_color ? " style='color:" + args.meta_color + "'" : "") +
		">" +
		(args.meta || "") +
		"</div></div><div class='agenda-actions'>" +
		(args.buttons || "") +
		"</div></div>"
	);
}

// The exact moment a season ends, in the Events window's chosen time (your time or realm time)
function schedule_end_text(ms, weekday) {
	return schedule_format(ms, Object.assign(weekday ? { weekday: "short" } : {}, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }));
}

// Each running season and when it ends. A season with an end time says so in its accent color.
function events_seasons_html() {
	var html = "",
		now = schedule_now(),
		ends = (S && S.event_ends) || {};
	["halloween", "holidayseason", "lunarnewyear", "valentines", "egghunt", "anniversary"].forEach(function (season) {
		var running = season == "anniversary" ? S.anniversary && S.anniversary.active : S[season];
		if (!running || !G.events[season]) return;
		var def = G.events[season],
			color = (def.announcement && def.announcement.color) || "#E6AE3F",
			meta = phrase.html("interface.events.season_running"),
			tag = "";
		if (ends[season]) {
			meta = phrase.html("interface.events.season_ends", { date: schedule_end_text(ends[season], true), left: schedule_countdown(ends[season] - now) });
			tag = phrase.html("interface.events.ends");
		}
		html += events_row({
			time: ends[season] ? schedule_format(ends[season], { day: "numeric", month: "short" }) : "",
			tag: tag,
			icon: schedule_icon(season),
			name: html_escape(schedule_event_name(season)),
			meta: meta,
			meta_color: color,
			buttons: events_button(phrase.html("interface.item.info"), "pcs(event); open_guide(\"event-" + season + "\",\"/docs/guide/event-" + season + "\")"),
		});
	});
	// Graveyard Rising: one line with its next start and cadence.
	((S && S.schedule && S.schedule.repeats) || []).forEach(function (repeat) {
		var live = S[repeat.event] && S[repeat.event].live;
		var meta = live
			? phrase.html("interface.events.graveyard_live", { wave: S[repeat.event].wave, waves: S[repeat.event].waves })
			: phrase.html("interface.events.every_hours", { hours: Math.round(repeat.every / 3600000), left: schedule_countdown(repeat.at - now) });
		html += events_row({
			time: schedule_time_text(repeat.at),
			tag: live ? phrase.html("interface.events.live") : "",
			icon: schedule_icon(repeat.event),
			name: html_escape(schedule_event_name(repeat.event)),
			meta: meta,
			meta_color: live ? "#85C76B" : "",
			buttons: (events_joinable(repeat.event) ? events_button(phrase.html("interface.events.join"), events_join_action(repeat.event)) : "") + events_button(phrase.html("interface.item.info"), events_guide_action(repeat.event)),
		});
	});
	// Seasonal bosses with a published respawn.
	["mrpumpkin", "mrgreen", "grinch", "snowman", "dragold", "wabbit"].forEach(function (type) {
		var state = S[type];
		if (!state) return;
		html += events_row({
			time: state.live ? "" : schedule_time_text(new Date(state.spawn).getTime()),
			tag: state.live ? phrase.html("interface.events.live") : phrase.html("interface.events.expected"),
			icon: sprite(type, { overflow: true }),
			name: html_escape(G.monsters[type].name),
			meta: state.live ? phrase.html("interface.events.boss_live") : phrase.html("interface.events.respawn", { left: schedule_countdown(new Date(state.spawn).getTime() - now) }),
			meta_color: state.live ? "#85C76B" : "",
			buttons: events_button(phrase.html("interface.item.info"), "pcs(event); emonster_click(\"" + type + "\")"),
		});
	});
	return html;
}

// Daily things you haven't done yet today: the Witch's Cipher, the Cave of Many Dreams and the doors.
function events_today_html() {
	var html = "",
		now = schedule_now();
	if (G.events.witchcipher) {
		var day = witch_day || {},
			live = witch_cipher_live(),
			next = schedule_next("witchcipher"),
			meta,
			tag = "",
			buttons = "";
		if (character && character.witchcipher) day = Object.assign({}, day, character.witchcipher);
		var left = day.mixes_left === undefined ? G.events.witchcipher.mixes : day.mixes_left;
		if (!left) meta = phrase.html("interface.events.cipher_done", { count: day.parcels || 0 });
		else meta = phrase.html("interface.events.cipher_ready", { count: left });
		if (live) tag = phrase.html("interface.events.live");
		html += events_row({
			time: live ? schedule_time_text(S.witchcipher.start) : next ? schedule_time_text(next.at) : "",
			tag: tag,
			icon: schedule_icon("witchcipher"),
			name: html_escape(schedule_event_name("witchcipher")),
			meta: meta,
			meta_color: !left ? "#9B9B9B" : "#AF6AE2",
			buttons: buttons + events_button(phrase.html("interface.item.info"), events_guide_action("witchcipher")),
		});
	}
	if (G.events.dreams && !G.events.dreams.disabled) {
		var visit = typeof cave_visit != "undefined" && cave_visit,
			ready = visit && (visit.available || visit.unlimited || visit.resets <= now);
		html += events_row({
			time: "",
			tag: "",
			icon: item_container({ skin: G.items.stonekey ? G.items.stonekey.skin : "cave_info", draggable: false }),
			name: html_escape(phrase.definition("event", "dreams", "name", G.events.dreams.name)),
			meta: !visit ? phrase.html("cave.checking_visit") : visit.resume ? phrase.html("interface.events.cave_resume") : ready ? phrase.html("interface.events.cave_ready") : phrase.html("interface.events.cave_done", { left: schedule_countdown(visit.resets - now) }),
			meta_color: ready ? "#85C76B" : "#9B9B9B",
			buttons: events_button(phrase.html("interface.item.info"), "pcs(event); open_cave_info()"),
		});
	}
	if (S && S.halloween && G.events.trickortreat) {
		var doors = (character && character.trickortreat) || { doors_left: G.events.trickortreat.doors.length, stamps: 0 };
		html += events_row({
			time: "",
			tag: "",
			icon: schedule_icon("trickortreat"),
			name: html_escape(schedule_event_name("trickortreat")),
			meta: phrase.html("interface.events.doors_left", { count: doors.doors_left, total: G.events.trickortreat.doors.length, stamps: doors.stamps }),
			meta_color: doors.doors_left ? "#F5A05B" : "#9B9B9B",
			buttons: events_button(phrase.html("interface.item.info"), events_guide_action("trickortreat")),
		});
	}
	return html;
}

function events_occurrence_html(occurrence) {
	var now = schedule_now(),
		def = G.events[occurrence.event] || {},
		state = S[occurrence.event],
		meta,
		meta_color = "",
		tag = "",
		buttons = "";
	if (occurrence.status == "live") {
		tag = phrase.html("interface.events.live");
		meta_color = "#85C76B";
		var end = (state && state.end && new Date(state.end).getTime()) || (occurrence.event == "witchcipher" && S.witchcipher && S.witchcipher.end);
		meta = end ? phrase.html("interface.events.live_until", { time: schedule_time_text(end) }) : phrase.html("interface.events.live_now");
		if (events_joinable(occurrence.event)) buttons += events_button(phrase.html("interface.events.join"), events_join_action(occurrence.event));
	} else if (occurrence.status == "done") ((meta = phrase.html("interface.events.finished")), (meta_color = "#9B9B9B"));
	else if (occurrence.status == "missed") ((meta = phrase.html("interface.events.missed")), (meta_color = "#9B9B9B"));
	else if (occurrence.at - now < 3600000) ((meta = schedule_countdown(occurrence.at - now)), (meta_color = "#E8C878"));
	else meta = phrase.html("interface.events.about." + occurrence.event);
	if (occurrence.status == "scheduled") {
		var reminded = events_reminder_get(occurrence);
		if (reminded) tag = phrase.html("interface.events.reminder");
		buttons += events_button(phrase.html(reminded ? "interface.events.remind_off" : "interface.events.remind"), "pcs(event); events_reminder_toggle(\"" + occurrence.id + "\")");
	}
	buttons += events_button(phrase.html("interface.item.info"), events_guide_action(occurrence.event));
	return events_row({
		time: schedule_time_text(occurrence.at),
		tag: tag,
		icon: schedule_icon(occurrence.event),
		name: html_escape(schedule_event_name(occurrence.event)),
		meta: meta,
		meta_color: meta_color,
		buttons: buttons,
	});
}

function events_window_html() {
	var now = schedule_now(),
		html = "<div class='agenda' id='events-window'>";
	html += "<div class='agenda-head'><div class='agenda-title'>" + phrase.html("interface.events.title") + "</div><span class='agenda-realm'>" + html_escape(server_name) + " · " + phrase.html("interface.events.your_realm") + "</span></div>";
	if (!S || !S.schedule || !S.schedule.events || !socket || !socket.connected) {
		html += "<div class='agenda-section'>" + phrase.html("interface.events.unavailable") + "</div>";
		html += "<div class='agenda-foot'>" + events_button(phrase.html("interface.events.guides"), "pcs(event); hide_modal(); render_all_events()") + "</div></div>";
		return html;
	}
	html +=
		"<div class='time-choice'>" +
		phrase.html("interface.events.times") +
		" <span class='clickable" + (events_time_mode == "local" ? " chosen" : "") + "' onclick='events_time_mode=\"local\"; render_events_window()'>" +
		phrase.html("interface.events.your_time", { offset: schedule_utc_offset("local") }) +
		"</span> <span class='clickable" + (events_time_mode == "realm" ? " chosen" : "") + "' onclick='events_time_mode=\"realm\"; render_events_window()'>" +
		phrase.html("interface.events.realm_time", { offset: schedule_utc_offset("realm") }) +
		"</span></div>";
	html +=
		"<div class='agenda-controls'><div class='gamebutton" + (events_period == "next" ? " chosen" : "") + "' onclick='events_period=\"next\"; render_events_window()'>" +
		phrase.html("interface.events.up_next") +
		"</div> <div class='gamebutton" + (events_period == "week" ? " chosen" : "") + "' onclick='events_period=\"week\"; render_events_window()'>" +
		phrase.html("interface.events.next_7_days") +
		"</div></div>";
	var seasons = events_seasons_html();
	if (seasons) html += "<div class='agenda-section'>" + phrase.html("interface.events.seasonal") + "</div>" + seasons;
	if (character) html += "<div class='agenda-section'>" + phrase.html("interface.events.today_attractions") + "</div>" + events_today_html();
	var list = schedule_list().filter(function (occurrence) {
		return occurrence.status == "live" || occurrence.at > now - 3 * 3600000;
	});
	if (events_period == "next") {
		var upcoming = list.filter((o) => o.status == "live" || (o.status == "scheduled" && o.at > now));
		list = upcoming.slice(0, 5);
	}
	var date = "",
		today = schedule_day_text(now);
	list.forEach(function (occurrence) {
		var day = schedule_day_text(occurrence.at);
		if (day != date) {
			date = day;
			html += "<div class='agenda-section'>" + (day == today ? phrase.html("interface.events.today", { date: day }) : html_escape(day)) + "</div>";
		}
		html += events_occurrence_html(occurrence);
	});
	html +=
		"<div class='agenda-foot'>" +
		phrase.html("interface.events.no_fixed_time") +
		" " +
		events_button(phrase.html("interface.events.guides"), "pcs(event); hide_modal(); render_all_events()") +
		" " +
		events_button(phrase.html("interface.events.data"), "pcs(event); show_json(S,{name:\"parent.S\"})") +
		"</div></div>";
	return html;
}

function render_events_window() {
	if (no_html) return;
	schedule_sync();
	if (character) {
		if (!witch_day || Date.now() - witch_day.checked > 60000) witch_day_refresh();
		if (typeof cave_load_visit == "function") cave_load_visit();
	}
	var html = events_window_html();
	if ($("#events-window").length) events_window_replace(html);
	else show_modal(html, { wrap: false, url: "/docs/guide/events-and-home" });
}

function events_window_refresh() {
	if (!no_html && $("#events-window").length) events_window_replace(events_window_html());
}

// The modal's close button sits inside the window, so a refresh that replaces the window puts it back
function events_window_replace(html) {
	$("#events-window").replaceWith(html);
	add_ui_close($("#events-window").closest(".imodal"), "modal", { frame: false });
}

// The next event for the character-selection card: live first, then the soonest start.
function events_next() {
	var now = schedule_now(),
		list = schedule_list().concat((S && S.schedule && S.schedule.repeats) || []),
		live = list.find((o) => o.status == "live"),
		next = null;
	if (live) return live;
	list.forEach(function (o) {
		if (o.status == "scheduled" && o.at > now && (!next || o.at < next.at)) next = o;
	});
	return next;
}

function events_next_text() {
	var next = events_next();
	if (!next) return "";
	if (next.status == "live") return phrase.html("interface.events.next_live", { name: html_escape(schedule_event_name(next.event)) });
	return phrase.html("interface.events.next_in", { name: html_escape(schedule_event_name(next.event)), left: schedule_countdown(next.at - schedule_now()) });
}

// Once a second: the slider above chat, then reminders.
function events_clock_tick() {
	if (no_html) return;
	if (!character) return render_event_announcements();
	events_ticker_update();
	events_reminder_tick();
}

// The slider between X,Y and EVENTS hh:mm above chat: live events, the next events and each season's last day
// slide by like a market ticker. One animation-frame callback moves the track by whole pixels and stops while
// X,Y shows the coordinates; the text and its width only change when an item does.
var events_ticker = { html: null, width: 0, offset: 0, last: 0, x: null, frame: null, hover: false },
	events_coords_on = false,
	// With reduced motion the text rests at its start; the setting can change while the game runs
	events_ticker_still = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)");
if (events_ticker_still && events_ticker_still.addEventListener) events_ticker_still.addEventListener("change", () => events_ticker_start());

// A phrase with the event name in the event's own colour and the rest in the item's colour.
function events_ticker_phrase(id, event, parameters, color) {
	var def = G.events[event] || {},
		text = html_escape(phrase(id, Object.assign({ name: "\u0001" }, parameters)));
	return "<span style='color:" + color + "'>" + text.replace("\u0001", "<span style='color:" + ((def.announcement && def.announcement.color) || "#FFFFFF") + "'>" + html_escape(schedule_event_name(event)) + "</span>") + "</span>";
}

// What the event asks of players, from its announcement.
function events_ticker_note(event) {
	var def = G.events[event] || {};
	if (!def.announcement || !def.announcement.text) return "";
	return " · <span style='color:#C8C8C8'>" + html_escape(phrase.definition("event", event, "announcement.text", def.announcement.text)) + "</span>";
}

function events_ticker_items() {
	var now = schedule_now(),
		list = schedule_list().concat((S && S.schedule && S.schedule.repeats) || []),
		ends = (S && S.event_ends) || {},
		items = [],
		seen = {},
		upcoming = 0;
	list.forEach(function (o) {
		if (o.status != "live" || seen[o.event]) return;
		seen[o.event] = true;
		items.push(events_ticker_phrase("interface.events.next_live", o.event, {}, "#E8C878") + events_ticker_note(o.event));
	});
	list
		.filter((o) => o.status == "scheduled" && o.at > now)
		.sort((a, b) => a.at - b.at)
		.forEach(function (o) {
			if (seen[o.event] || upcoming >= 3) return;
			seen[o.event] = true;
			upcoming++;
			items.push(events_ticker_phrase("interface.events.next_in", o.event, { left: schedule_countdown(o.at - now) }, o.at - now < 3600000 ? "#E8C878" : "#AAAAAA"));
		});
	for (var season in ends)
		if (S[season])
			items.push(
				events_ticker_phrase("interface.events.selection_season_ends", season, { date: schedule_end_text(ends[season]) }, "#F5A05B") +
					events_ticker_note(season),
			);
	return items;
}

function events_ticker_update() {
	var track = document.getElementById("events-ticker-track");
	if (!track) return;
	var dot = "<span class='ticker-dot'>•</span>",
		items = events_ticker_items(),
		html = items.length ? "<span><span class='ticker-item'>" + items.join("</span>" + dot + "<span class='ticker-item'>") + "</span>" + dot + "</span>" : "";
	// Measured again until the bar is on screen
	if (html === events_ticker.html && (events_ticker.width || !html)) return;
	events_ticker.html = html;
	track.innerHTML = html;
	// Enough copies to keep the box full while the first one slides out
	events_ticker.width = html ? track.firstChild.offsetWidth : 0;
	events_ticker.rtl = typeof getComputedStyle == "function" && getComputedStyle(track).direction == "rtl";
	if (events_ticker.width) track.innerHTML = html.repeat(Math.ceil(track.parentNode.clientWidth / events_ticker.width) + 1);
	events_ticker_start();
}

function events_ticker_start() {
	if (events_ticker.frame || !events_ticker.width || events_coords_on) return;
	events_ticker.last = 0;
	events_ticker.frame = requestAnimationFrame(events_ticker_frame);
}

// 40 pixels a second, to the right for right-to-left text; paused under the mouse so an item can be read and clicked
function events_ticker_frame(now) {
	var t = events_ticker,
		still = events_ticker_still && events_ticker_still.matches;
	t.frame = null;
	if (!t.width || events_coords_on) return;
	if (still) t.offset = 0;
	else if (t.last && !t.hover) t.offset = (t.offset + Math.min(now - t.last, 100) * 0.04) % t.width;
	t.last = now;
	if (t.x !== (t.rtl ? 1 : -1) * Math.floor(t.offset)) {
		t.x = (t.rtl ? 1 : -1) * Math.floor(t.offset);
		document.getElementById("events-ticker-track").style.transform = "translate3d(" + t.x + "px,0,0)";
	}
	if (!still) t.frame = requestAnimationFrame(events_ticker_frame);
}

// X,Y and the realm box swap the slider for the character's coordinates, centered.
function events_toggle_coords() {
	events_coords_on = !events_coords_on;
	$("#events-bar").toggleClass("coords-on", events_coords_on);
	events_ticker_start();
}

// Reminders are local to this browser and realm: one game log line ten minutes before the start.
function events_reminder_tick() {
	if (no_html || !character) return;
	var now = schedule_now();
	schedule_list().forEach(function (occurrence) {
		if (occurrence.status != "scheduled" || events_reminded[occurrence.id] || !events_reminder_get(occurrence)) return;
		var left = occurrence.at - now;
		if (left > 0 && left <= 600000) {
			events_reminded[occurrence.id] = true;
			add_log(
				"<span class='clickable' onclick='render_events_window()'>" +
					phrase.html("interface.events.reminder_log", { name: html_escape(schedule_event_name(occurrence.event)), left: schedule_countdown(left) }) +
					"</span>",
				"#E8C878",
			);
		}
	});
	// Once a minute, forget this realm's reminders for events that are no longer scheduled; other realms keep theirs
	if (now - events_reminders_swept < 60000) return;
	events_reminders_swept = now;
	var prefix = "event_reminder:" + ((S && S.schedule && S.schedule.realm) || "") + ":";
	try {
		for (var i = localStorage.length - 1; i >= 0; i--) {
			var key = localStorage.key(i);
			if (!key || key.indexOf(prefix) !== 0) continue;
			var id = key.slice(prefix.length);
			if (!schedule_list().some((o) => o.id == id && o.status == "scheduled")) localStorage.removeItem(key);
		}
	} catch (e) {}
}

// The character-selection card above the live-event cards.
function events_selection_card_html() {
	var next = events_next(),
		ends = (S && S.event_ends) || {},
		html = "";
	if (!next && !Object.keys(ends).length) return "";
	html += "<button type='button' class='events-next-card' onclick='render_events_window()'>";
	html += "<small>" + html_escape(server_name) + " · " + phrase.html("interface.events.next_event") + "</small>";
	if (next) html += "<strong>" + events_next_text() + "</strong>";
	for (var season in ends)
		if (S[season])
			html +=
				"<span class='events-season-end'>" +
				phrase.html("interface.events.selection_season_ends", {
					name: html_escape(schedule_event_name(season)),
					date: schedule_end_text(ends[season]),
				}) +
				"</span>";
	if (next && next.status != "live") html += "<span>" + phrase.html("interface.events.selection_time", { time: schedule_time_text(next.at) }) + "</span>";
	return html + "</button>";
}
