var u_item = null,
	u_scroll = null,
	u_offering = null,
	c_items = e_array(3),
	c_scroll = null,
	c_offering = null,
	c_last = 0,
	e_item = null,
	p_item = null,
	l_item = null,
	s_item = null,
	cr_items = e_array(9),
	cr_last = 0,
	ds_item = null;

var settings_shown = 0;
function add_ui_close(panel, action, options) {
	if (window.no_html) return;
	options = options || {};
	panel = $(panel);
	var existing = panel.find("button,a,[onclick],.clickable").filter(function () {
		return (
			this.hasAttribute("data-ui-dismiss") ||
			/close|cancel/i.test(this.getAttribute("aria-label") || "") ||
			(/^[<>\[\s]*(x|×|close|cancel|nope|no!?|back|go back|ok(?:ay)?|got it!?)[<>\]\s]*$/i.test($(this).text().trim()) &&
				/\b(hide_modals?|close_chat_window|close_merchant|toggle_code|render_inventory)\s*\(|\.remove\s*\(|topleft_npc\s*=\s*false/.test(this.getAttribute("onclick") || ""))
		);
	});
	if (!panel.length || panel.find(".ui-close,.inventory-close").length || existing.length) return;
	var children = panel.children().not("script,style,[hidden]"),
		frame = panel,
		bottom = panel.closest("#topleftcorner").length > 0;
	if (!options.frame && (children.length == 1 || bottom)) frame = children.first();
	var style = getComputedStyle(frame[0]);
	frame.addClass("ui-close-frame");
	frame[0].style.setProperty("--ui-close-background", style.backgroundColor == "rgba(0, 0, 0, 0)" ? "black" : style.backgroundColor);
	frame[0].style.setProperty("--ui-close-color", style.color);
	frame[0].style.setProperty("--ui-close-border", parseFloat(style.borderTopWidth) ? style.borderTopColor : "gray");
	if (panel.is("#skills-item")) frame.addClass("ui-close-top");
	var label = options.label || (bottom || action == "modal" || frame.outerWidth() >= 600 ? phrase("interface.close.button") : "X");
	var button = $(
		"<button type='button' class='gamebutton ui-close' title='" +
			phrase.html("interface.close.accessible") +
			"' aria-label='" +
			phrase.html("interface.close.accessible") +
			"' onpointerdown='stpr(event)' onclick='btc(event); close_ui_panel(this)'><span aria-hidden='true'></span></button>",
	);
	button.attr("data-ui-close", action).data("panel", panel[0]).find("span").text(label);
	if (options.corner) button.css({ top: -parseFloat(style.borderTopWidth), right: -parseFloat(style.borderRightWidth) });
	else if (bottom) {
		button.addClass("ui-close-bottom").css({ bottom: label == "X" ? -parseFloat(style.borderBottomWidth) : -32, right: -parseFloat(style.borderRightWidth) });
		if (label != "X") button.css("border-width", style.borderBottomWidth);
	} else if (!options.classes) {
		var edge = parseFloat(style.borderTopWidth),
			first = frame.children().first(),
			border = edge || parseFloat(first.css("border-top-width")) || 4;
		button.css({
			top: edge ? -32 : parseFloat(style.paddingTop) + (parseFloat(first.css("margin-top")) || 0) + border - 32,
			right: edge ? -parseFloat(style.borderRightWidth) : parseFloat(style.paddingRight),
			borderWidth: border,
		});
	}
	if (label != "X") button.addClass("ui-close-word");
	if (options.classes) button.addClass(options.classes);
	frame.prepend(button);
}

function render_ui_panel(selector, html, action, options) {
	var panel = $(selector).html(html);
	add_ui_close(panel, action || (selector == "#topleftcornerui" ? "target" : "details"), options);
	return panel;
}

function close_ui_panel(button) {
	var action = button.getAttribute("data-ui-close");
	if (action == "modal") return hide_modal();
	if (action == "skills") return render_skills();
	if (action == "target") {
		topleft_npc = false;
		ctarget = xtarget = rendered_target = dialogs_target = null;
		$("#topleftcornerui").html('<div class="gamebutton">' + phrase.html("interface.close_ui_panel.no_target") + "</div>");
		$("#topleftcornerdialog").empty();
		reset_inventory();
	} else {
		if (action == "stats") topright_npc = false;
		$($(button).data("panel")).empty();
	}
}

var browser_zoom = 0,
	browser_zoom_levels = [-25, 0, 25, 50];

function set_browser_zoom(value) {
	if (window.no_html || window.no_graphics) return;
	browser_zoom = Number(value);
	if (!browser_zoom_levels.includes(browser_zoom)) browser_zoom = 0;
	var zoom = 1 + browser_zoom / 100;
	document.documentElement.style.zoom = browser_zoom ? zoom : "";
	document.documentElement.style.setProperty("--browser-zoom", zoom);
	document.documentElement.style.setProperty("--browser-zoom-inverse", 1 / zoom);
	$("html").toggleClass("browser-zoomed", !!browser_zoom);
	$(".browserzoom").each(function () {
		$(this).attr("aria-pressed", Number($(this).attr("data-zoom")) === browser_zoom);
	});
	Cookies.set("browser_zoom", browser_zoom, { expires: 12 * 365 });
	$(".CodeMirror").each(function () {
		if (this.CodeMirror) this.CodeMirror.refresh();
	});
	if (window.renderer) on_resize();
}

function show_settings() {
	show_modal($(".basicsettings").html(), { wrap: false, styles: "width:600px", hideinbackground: true });
}

function set_close_buttons(enabled) {
	if (window.no_html) return;
	close_buttons_enabled = !!enabled;
	$("body").toggleClass("no-close-buttons", !close_buttons_enabled);
	$(".closebuttonson").toggle(close_buttons_enabled);
	$(".closebuttonsoff").toggle(!close_buttons_enabled);
	Cookies.set("no_close_buttons", close_buttons_enabled ? "" : "1", { expires: 12 * 365 });
	position_modals();
}

var docked = [],
	cwindows = [];

function close_chat_window(type, id) {
	var cid = type + (id || "");
	$("#chatw" + cid).remove();
	array_delete(docked, cid);
	array_delete(cwindows, cid);
	redock();
}

function toggle_chat_window(type, id) {
	var cid = type + (id || "");
	if (in_arr(cid, docked)) {
		array_delete(docked, cid);
		$(".chatb" + cid).html("#");
		$("#chatw" + cid).css("bottom", "auto");
		$("#chatw" + cid).css("top", 400);
		$("#chatw" + cid).css("left", 400);
		$("#chatw" + cid).css("z-index", 70 + cwindows.length - docked.length);
		$("#chatw" + cid).draggable({
			start: function (event, ui) {
				$(this).data("drag-start", { x: event.pageX, y: event.pageY, left: parseFloat($(this).css("left")), top: parseFloat($(this).css("top")) });
			},
			drag: function (event, ui) {
				var start = $(this).data("drag-start"), zoom = 1 + (window.browser_zoom || 0) / 100;
				ui.position.left = start.left + (event.pageX - start.x) / zoom;
				ui.position.top = start.top + (event.pageY - start.y) / zoom;
			},
		});
		$("#chatt" + cid).removeClass("newmessage");
	} else {
		$(".chatb" + cid).html("+");
		$("#chatw" + cid).draggable("destroy");
		$("#chatw" + cid).css("top", "auto");
		$("#chatw" + cid).css("left", 0);
		docked.push(cid);
	}
	redock();
}

function chat_title_click(type, id) {
	var cid = type + (id || "");
	if (in_arr(cid, docked)) toggle_chat_window(type, id);
}

function redock() {
	for (var i = 0; i < docked.length; i++) {
		var cid = docked[i];
		$("#chatw" + cid).css("bottom", 15 + i * 32);
		$("#chatw" + cid).css("z-index", 70 - i);
	}
}

function open_chat_window(type, id, open) {
	if (no_html) return;
	if (!id) id = "";
	var name = id,
		cid = type + id,
		zindex = 70 + cwindows.length - docked.length,
		onkeypress = 'last_say=\"' + cid + '\"; if(event.keyCode==13) private_say(\"' + id + '\",$(this).rfval())';
	if (type == "party") ((name = phrase.html("interface.load_chat.party")), (onkeypress = 'last_say=\"' + cid + '\"; if(event.keyCode==13) party_say($(this).rfval())'));
	var html = "<div style='position:fixed; bottom: 0px; left: 0px; background: black; border: 5px solid gray; z-index: " + zindex + "' id='chatw" + cid + "' onclick='last_say=\"" + cid + "\"'>";
	html +=
		"<div style='border-bottom: 5px solid gray; text-align: center; font-size: 24px; line-height: 24px; padding: 2px 6px 2px 6px;'><span style='float:left' class='clickable chatb" +
		cid +
		"'\t\t onclick='toggle_chat_window(\"" +
		type +
		'","' +
		id +
		"\")'>+</span> <span id='chatt" +
		cid +
		"' onclick='chat_title_click(\"" +
		type +
		'","' +
		id +
		"\")'>" +
		name +
		"</span> <span style='float: right' class='clickable' data-ui-dismiss onclick='close_chat_window(\"" +
		type +
		'","' +
		id +
		"\")'>" +
		"x" +
		"</span></div>";
	html += "<div id='chatd" + cid + "' class='chatlog'></div>";
	html += "<div style=''><input type='text' class='chatinput' id='chati" + cid + "' onkeypress='" + onkeypress + "' autocomplete='nope'/></div>";
	html += "</div>";
	$("body").append(html);
	docked.push(cid);
	cwindows.push(cid);
	if (open) toggle_chat_window(type, id);
	redock();
}

function hide_settings() {
	$("#content").html("");
	settings_shown = 0;
}

function prop_line(prop, value, args) {
	var color = "",
		bold = "";
	if (!args) args = {};
	if (args.bold) bold = "font-weight: bold;";
	if (is_string(args)) ((color = args), (args = {}));
	if (!color) color = args.color || "grey";
	return "<div><span style='color: " + color + "; " + bold + "'>" + prop + "</span>: " + value + "</div>";
}

function prop_remains(remains) {
	if (remains <= 1 / 60.0) return bold_prop_line(phrase.html("interface.prop_remains.seconds"), to_pretty_float(remains * 3600), "gray");
	else if (remains < 1) return bold_prop_line(phrase.html("interface.prop_remains.minutes"), to_pretty_float(remains * 60), "gray");
	else return bold_prop_line(phrase.html("interface.prop_remains.hours"), to_pretty_float(remains), "gray");
}

function bold_prop_line(prop, value, args) {
	if (!args) args = {};
	if (is_string(args)) args = { color: args };
	if (window.is_bold) args.bold = true;
	return prop_line(prop, value, args);
}

function render_party_old(list) {
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 6px; font-size: 24px; display: inline-block' class='enableclicks'>";
	if (list) {
		html += "<div class='slimbutton block'>" + phrase.html("interface.party_old.party") + "</div>";
		list.forEach(function (name) {
			html += "<div class='slimbutton block mt5' style='border-color:#703987' onclick='party_click(\"" + name + "\")'>" + name + "</div>";
		});
		html += "<div class='slimbutton block mt5'"; //style='border-color:#875045'
		html += 'onclick=\'socket.emit("party",{event:"leave"})\'>' + phrase.html("interface.party_old.leave") + "</div>";
	}
	html += "</div>";
	$("#partylist").html(html);
	if (!list.length) $("#partylist").hide();
	else $("#partylist").css("display", "inline-block");
}

function render_party() {
	var html = "";
	for (var name in party) {
		var member = party[name];
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); party_click(\"" + name + "\")'>";
		html += sprite(member.skin, { cx: member.cx || [], rip: member.rip, scale: 2, height: 50, overflow: true });
		if (member.rip) html += "<div style='color:gray; margin-top: 1px'>" + phrase.html("interface.party.rip") + "</div>";
		else html += "<div style='margin-top: 1px'>" + name.substr(0, 3).toUpperCase() + "</div>";
		html += "</div>";
	}
	$("#newparty").html(html);
	if (!party_list.length) $("#newparty").hide();
	else $("#newparty").show();
}

function duel_click(name) {
	var sm_target = null;
	I.A.forEach(function (member) {
		if (member.name == name) sm_target = member;
	});
	I.B.forEach(function (member) {
		if (member.name == name) sm_target = member;
	});
	if (sm_target) call_code_function_f("smart_move", sm_target);
}

function render_member(member, space) {
	var html = "";
	if (space) html += "<div style='margin-left: 4px; display: inline-block'></div>";
	html += "<div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 0px; line-height: 0px; text-align: center' onclick='pcs(event); duel_click(\"" + member.name + "\")'>";
	html += sprite(member.skin, { cx: member.cx || {}, rip: member.rip });
	if (member.rip || !member.active) {
		html += "<div style='color:gray; margin-top: 1px; font-size: 24px; line-height: 18px'>" + phrase.html("interface.member.rip") + "</div>";
		html += "<div style='width: 99%; background: gray; height: 4px; margin-top: 2px; display: inline-block'></div>";
	} else {
		html += "<div style='margin-top: 1px; font-size: 24px; line-height: 18px'>" + member.name.substr(0, 3).toUpperCase() + "</div>";
		var percent = (member.hp / member.max_hp) * 99;
		html += "<div style='width: " + percent + "%; background: " + colors.hp + "; height: 4px; margin-top: 2px; display: inline-block'></div>";
	}
	html += "</div>";
	return html;
}

function render_map() {
	// Note: new_map_logic() - includes the initial messages
	if (current_map == "abtesting" && S.abtesting && !window.abtesting) {
		$("#topmid").append(
			"<div id='abtesting'><div class='gamebutton' style='border-color: " +
				colors.A +
				"'>A <span class='scoreA'>" +
				S.abtesting.A +
				"</span></div> <div class='gamebutton abtime'>5:00</div> <div class='gamebutton' style='border-color: " +
				S.abtesting.B +
				"'>B <span class='scoreB'>0</span></div></div>",
		);
		reposition_ui();
		window.abtesting = true;
	} else if (current_map != "abtesting" && window.abtesting) {
		$("#abtesting").remove();
		window.abtesting = false;
	}

	if (events.duel && (!I || !I.id || I.id != events.duel)) {
		events.duel = false;
		$("#duelui").remove();
		$(".badplaceforaui").html("");
	}
	if (current_map == "duelland" && !events.duel) {
		events.duel = I.id;
		$("#topmid").append("<div id='duelui'><div class='gamebutton dueltime'>0:60</div></div>");
		reposition_ui();
	}
	if (events.duel) {
		if (I.seconds) $(".dueltime").html("0:" + ("00" + I.seconds).slice(-2));
		else $(".dueltime").remove();

		var html = "";
		m_first = true;
		I.A.forEach(function (member) {
			html += render_member(member, !m_first);
			m_first = false;
		});
		html += "<div></div><div class='gamebutton gamebutton-small' style='margin-top: 3px; margin-bottom: 3px'>" + phrase.html("interface.map.vs") + "</div><div></div>";
		m_first = true;
		I.B.forEach(function (member) {
			html += render_member(member, !m_first);
			m_first = false;
		});
		$(".badplaceforaui").html(html);
	}
}

function wabbit_click() {
	if (!S.wabbit.live) add_log(phrase.html("interface.wabbit_click.wabbit_spawns_in_minutes", { value: parseInt(round(-msince(new Date(S.wabbit.spawn)))) }));
	else
		add_log(
			phrase.html("interface.wabbit_click.engage_wabbit") +
				" " +
				"<span class='clickable' onclick='pcs(event); call_code_function_f(\"smart_move\",{x:S.wabbit.x,y:S.wabbit.y,map:S.wabbit.map});' style='color: #A78059'>" +
				phrase.html("interface.wabbit_click.go") +
				"</span>",
			"gray",
		);
}

function emonster_click(id) {
	if (!S[id] || (!S[id].live && !S[id].spawn)) add_log(phrase.html("interface.emonster_click.hasn_t_spawned_yet", { monster: G.monsters[id].name }));
	else if (!S[id].live) add_log(phrase.html("interface.emonster_click.spawns_in_minutes", { monster: G.monsters[id].name, value: parseInt(round(-msince(new Date(S[id].spawn)))) }));
	else
		add_log(
			phrase.html("interface.emonster_click.engage", { monster: G.monsters[id].name }) +
				" " +
				"<span class='clickable' onclick='pcs(event); call_code_function_f(\"smart_move\",S." +
				id +
				");' style='color: #A78059'>" +
				phrase.html("interface.emonster_click.go") +
				"</span>",
			"gray",
		);
}

function render_rewards() {
	show_json(S.rewards);
}

function anniversary_event_html() {
	var html =
		"<div style='width:860px;max-width:calc(100vw - 40px);max-height:calc(100vh - 40px);display:flex;flex-direction:column;box-sizing:border-box;background:black;border:5px solid gray;color:#E5E5E5;font-size:24px;line-height:26px'>";
	html += "<div style='padding:14px 16px;border-bottom:4px solid gray;display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:12px'>";
	html +=
		"<div><div style='color:#F0B742;font-size:32px;line-height:34px'>" +
		phrase.html("interface.anniversary_event_html.10_years_of_adventure") +
		"</div><div style='color:#AAA'>" +
		phrase.html("interface.anniversary_event_html.come_celebrate_with_everyone_on_your_server") +
		"</div></div>";
	html += anniversary_ui_button(phrase("interface.close.titlecase"), "hide_modal()") + "</div>";
	html += "<div id='anniversary-event-content' style='padding:16px;min-height:0;overflow-y:auto;box-sizing:border-box;overflow-wrap:break-word'>";
	html += "<div id='anniversary-event-status'>" + anniversary_event_status_html() + "</div>";
	html += "<div style='display:flex;flex-wrap:wrap;gap:24px;margin-top:16px'>";
	html += "<div id='anniversary-event-collection' style='flex:1 1 310px;min-width:0;border-top:2px solid #555;padding-top:14px'>" + anniversary_collection_html() + "</div>";
	html += "<div style='flex:1 1 310px;min-width:0;border-top:2px solid #555;padding-top:14px'>";
	html += "<div style='display:flex;align-items:center;gap:10px'><div style='flex:none'>";
	html += item_container({ skin: G.items.sixcake.skin, size: 40, draggable: false, onclick: "pcs(event);render_item_info('sixcake',0)" }, { name: "sixcake" });
	html +=
		"</div><div><div style='color:#F0B742'>" +
		phrase.html("interface.anniversary_event_html.inside_a_sixfold_cake") +
		"</div><div style='font-size:22px;line-height:24px'>" +
		phrase.html("interface.anniversary_event_html.equipment_or_a_rare_anniversary_cosmetic_plus_three_anniversary_gifts") +
		"</div></div></div>";
	html += "<div style='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:8px 0'>";
	(G.drops.anniversary_equipment || []).forEach(function (drop) {
		var name = drop[1],
			item = G.items[name];
		if (!item || !/^[a-z0-9_]+$/.test(name)) return;
		html += "<div title='" + html_escape(item.name) + "' style='text-align:center'>";
		html += item_container({ skin: item.skin, size: 40, draggable: false, onclick: "pcs(event);render_item_info('" + name + "',0)" }, { name: name });
		html += "</div>";
	});
	html += "</div><div style='color:#AAA;font-size:20px;line-height:22px'>" + phrase.html("interface.anniversary_event_html.click_an_item_for_stats") + "</div>";
	html += "<div style='color:#AAA;font-size:22px;line-height:24px;margin-top:4px'>" + phrase.html("interface.anniversary_event_html.want_a_particular_gift_keep_the_cake_for_mira_s") + "</div>";
	html += "<div style='display:flex;align-items:center;gap:10px;margin-top:14px'><div style='flex:none'>";
	html += item_container({ skin: G.items.anniversarygift.skin, size: 40, draggable: false, onclick: "pcs(event);render_item_info('anniversarygift',0)" }, { name: "anniversarygift" });
	html +=
		"</div><div><div style='color:#7CC7BB'>" +
		phrase.html("interface.anniversary_event_html.inside_an_anniversary_gift") +
		"</div><div style='font-size:22px;line-height:24px'>" +
		phrase.html("interface.anniversary_event_html.gold_returning_anniversary_items_or_a_lucky_surprise_click_the") +
		"</div></div></div>";
	html += "<div style='display:flex;flex-wrap:wrap;gap:12px;margin-top:12px'>";
	["makeawish", "ikissyou"].forEach(function (name) {
		html += "<div style='flex:1 1 280px;display:flex;align-items:center;gap:8px'><div style='flex:none'>";
		html += item_container({ skin: G.skills[name].skin, size: 40, draggable: false, onclick: "pcs(event);render_item_info('cxjar',0,'" + name + "')" });
		html +=
			"</div><div style='font-size:22px;line-height:24px;color:#AAA'><span style='color:#E990AB'>" +
			(name == "makeawish" ? phrase.html("interface.anniversary_event_html.make_a_wish") : phrase.html("interface.anniversary_event_html.i_kiss_you")) +
			"</span><br>";
		html +=
			(name == "makeawish"
				? phrase.html("interface.anniversary_event_html.an_emote_to_keep_craft_its_jar_with_mira_or_find_it_in_a_gift")
				: phrase.html("interface.anniversary_event_html.rewarded_visits_can_drop_its_permanent_jar_cakes_and_gifts_can_hold_it_too")) + "</div></div>";
	});
	html += "</div></div></div><div style='border-top:2px solid #555;margin-top:14px;padding-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap'>";
	html += "<span style='color:#AAA;font-size:22px'>" + phrase.html("interface.anniversary_event_html.monsters_can_drop_slices_and_gifts_too") + "</span>";
	html += anniversary_ui_button(phrase("interface.anniversary.event_guide"), 'open_guide("event-anniversary","/docs/ref/event-anniversary")');
	return html + "</div></div></div>";
}

function anniversary_event_status_html() {
	var state = (typeof S != "undefined" && S.anniversary) || {},
		live = anniversary_live_event(),
		reason = anniversary_visit_reason(),
		html = "";
	if (!state.active) return "<div style='color:#AAA'>" + phrase.html("interface.anniversary_event_status_html.the_anniversary_event_has_ended_you_can_still_open_your") + "</div>";
	html += "<div style='display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap'>";
	html += "<div style='min-width:0;flex:1 1 260px'><div style='color:#E990AB'>" + phrase.html("interface.anniversary_event_status_html.i_kiss_you") + "</div>";
	if (live) {
		var map = G.maps[state.map],
			host = character && (String(character.id) == String(state.id) || character.name == state.target),
			remaining = Math.max(1, Math.ceil((Number(state.expires) - Date.now()) / 60000));
		if (host) html += "<div style='color:#FFE2A0;font-size:28px;line-height:30px'>" + phrase.html("interface.anniversary_event_status_html.you_re_the_featured_player") + "</div>";
		else
			html +=
				"<div style='font-size:28px;line-height:30px'>" +
				phrase.html("interface.anniversary_event_status_html.find") +
				" " +
				"<span style='color:#FFE2A0'>" +
				html_escape(String(state.target || phrase.html("interface.anniversary_event_status_html.the_featured_player"))) +
				"</span></div>";
		html += "<div style='color:#AAA'>" + html_escape((map && map.name) || String(state.map || "")) + " (" + Math.round(state.x || 0) + ", " + Math.round(state.y || 0) + ")</div></div>";
		html +=
			"<div style='color:#F0B742'>" +
			(Number.isFinite(remaining) ? phrase.html("interface.time.minutes_left", { count: remaining }) : phrase.html("interface.anniversary_event_status_html.round_in_progress")) +
			"</div></div>";
		if (state.available === false) {
			if (reason != "target_unavailable") html += "<div style='margin-top:10px;color:#AAA'>" + phrase.html("client.anniversary_kiss.waiting_for_to_return_the_round_s_timer_is_still", { target: state.target }) + "</div>";
		} else if (host) html += "<div style='margin-top:10px'>" + phrase.html("interface.anniversary_event_status_html.stay_nearby_and_welcome_your_visitors_each_visitor_who_uses") + "</div>";
		else
			html +=
				"<div style='display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px'>" +
				anniversary_ui_button(phrase("interface.anniversary.find_player"), "find_anniversary_player()") +
				anniversary_ui_button(phrase("interface.anniversary.kiss"), "anniversary_kiss()", !anniversary_can_visit() && !(character.acx && character.acx.ikissyou)) +
				"<span style='color:#AAA'>" +
				phrase.html("interface.anniversary_event_status_html.get_close_then_send_a_kiss") +
				"</span></div>";
	} else {
		html += "<div style='font-size:28px;line-height:30px'>" + phrase.html("interface.anniversary_event_status_html.who_will_we_visit_next") + "</div></div>";
		html +=
			"<div style='color:#F0B742'>" +
			(Number.isFinite(state.next) && state.next > Date.now()
				? phrase.html("interface.anniversary.next_round", { count: Math.ceil((state.next - Date.now()) / 60000) })
				: phrase.html("interface.anniversary_event_status_html.waiting_for_a_player")) +
			"</div></div>";
		html += "<div style='margin-top:10px'>" + phrase.html("interface.anniversary_event_status_html.every_30_minutes_someone_on_this_server_is_featured_everyone") + "</div>";
	}
	if (!host)
		html +=
			"<div style='color:#9ACA87;margin-top:10px'>" +
			phrase.html("interface.anniversary_event_status_html.use_your_anniversary_visit_1_cake_slice_1_anniversary_gift") +
			"</div><div style='font-size:22px;line-height:24px;color:#AAA'>" +
			phrase.html("interface.anniversary_event_status_html.find_the_featured_player_and_send_a_kiss_before_your") +
			"</div>";
	if (live && reason && reason != "host")
		html += "<div style='color:#AAA;margin-top:8px'>" + phrase.html("interface.anniversary_status." + reason) + "</div>";
	return html;
}

function anniversary_collection_html() {
	var state = character && anniversary_recipe_state("sixcake"),
		rows = state ? state.rows : [],
		owned = rows.filter(function (row) {
			return row.count >= row.needed;
		}).length,
		npc = G.npcs.anniversary_baker,
		html =
			"<div style='display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap'><span style='color:#F0B742'>" +
			phrase.html("interface.anniversary_collection_html.put_the_cake_together") +
			"</span><span style='color:" +
			(owned == 6 ? "#9ACA87" : "#AAA") +
			"'>" +
			phrase.html("interface.anniversary_collection_html.6_flavors_in_your_bag", { owned: owned }) +
			"</span></div>";
	html +=
		"<div style='margin:6px 0 10px;font-size:22px;line-height:24px'>" + phrase.html("interface.anniversary_collection_html.your_account_always_finds_the_same_flavor_trade_your_spare") + "</div>";
	html += "<div style='display:flex;flex-wrap:wrap;justify-content:center;gap:8px'>";
	rows.forEach(function (row) {
		var item = G.items[row.name],
			enough = row.count >= row.needed;
		html += "<div style='width:96px;text-align:center;font-size:20px;line-height:22px'>";
		html += item_container({ skin: item.skin, size: 40, draggable: false, bcolor: enough ? "#597F5B" : "gray", onclick: "pcs(event);render_item_info('" + row.name + "',0)" }, { name: row.name });
		html +=
			"<div>" +
			html_escape(item.name.replace(/ Slice$/, "")) +
			"</div><div style='color:" +
			(enough ? "#9ACA87" : "#AAA") +
			"'>" +
			(enough ? phrase.html("interface.anniversary.in_bag", { count: to_pretty_num(row.count) }) : phrase.html("interface.anniversary_collection_html.missing")) +
			"</div></div>";
	});
	html += "</div><div style='display:flex;align-items:center;gap:10px;margin-top:14px'>";
	if (npc) html += "<div style='flex:none'>" + sprite(npc.skin, { cx: clone(npc.cx || {}), cosmetic_head_y: npc.cosmetic_head_y, width: 52, height: 72, scale: 2 }) + "</div>";
	html +=
		"<div style='flex:1;min-width:0'><span style='color:#FFE2A0'>" +
		phrase.html("interface.anniversary_collection_html.mira") +
		"</span> <span style='color:#AAA'>" +
		phrase.html("interface.anniversary_collection_html.mainland") +
		"</span><div style='font-size:22px;line-height:24px;margin:4px 0 8px'>" +
		phrase.html("interface.anniversary_collection_html.bring_all_six_slices") +
		" " +
		"<span style='color:#F0B742'>" +
		phrase.html("interface.anniversary_collection_html.gold", { cost: to_pretty_num(state ? state.recipe.cost : G.craft.sixcake.cost) }) +
		"</span>.</div>";
	html += anniversary_ui_button(phrase("interface.anniversary.visit_mira"), 'smart_smart_move("npc","anniversary_baker")', !(typeof S != "undefined" && S.anniversary && S.anniversary.active));
	html +=
		" " + anniversary_ui_button(phrase("interface.anniversary.combine_cake"), 'hide_modal();render_anniversary_baker("combine")', !(typeof S != "undefined" && S.anniversary && S.anniversary.active));
	html += "<div style='font-size:20px;line-height:22px;color:#AAA;margin-top:6px'>" + phrase.html("interface.anniversary_collection_html.mira_is_at_64_88_choose_cake_to_combine_slices") + "</div>";
	return html + "</div></div>";
}

function render_anniversary_event(refresh) {
	if (no_html) return;
	if (!$("#anniversary-event-panel").length) {
		if (refresh) return;
		show_modal("<div id='anniversary-event-panel'>" + anniversary_event_html() + "</div>", { wrap: false, styles: "padding:0" });
	}
	// Keep the window and its scroll position intact when server state changes.
	var status = anniversary_event_status_html(),
		collection = JSON.stringify([
			!!(S.anniversary && S.anniversary.active),
			character &&
				G.craft.sixcake.items.map(function (row) {
					return anniversary_ingredient_count(row[1], row[2]);
				}),
		]),
		$status = $("#anniversary-event-status"),
		$collection = $("#anniversary-event-collection");
	if ($status.data("content") !== status) $status.html(status).data("content", status);
	if ($collection.data("counts") !== collection) $collection.html(anniversary_collection_html()).data("counts", collection);
}

function anniversary_ui_button(label, action, disabled, selected) {
	return (
		"<button type='button'" +
		(action == "hide_modal()" ? " data-ui-dismiss" : "") +
		" class='gamebutton' style='font-family:inherit;font-size:22px;line-height:24px;padding:6px 8px;border-color:" +
		(selected ? "#F0B742" : "gray") +
		";" +
		(disabled ? "opacity:0.45;cursor:default;" : "") +
		"'" +
		(disabled ? " disabled" : " onclick='pcs(event);" + action + "'") +
		">" +
		html_escape(label) +
		"</button>"
	);
}

var anniversary_visible_skill = false;

function open_interaction_guide(key) {
	var definition = G.docs && G.docs.interactions && G.docs.interactions[key];
	if (!definition || !definition.article) return add_log(phrase.html("interface.open_interaction_guide.no_guide_is_available_for_this_interaction_yet"), "gray");
	open_guide(definition.article, get_guide_url(definition.article));
}

function get_guide_url(name) {
	var found = null;
	function find(entries, path) {
		for (var i = 0; i < entries.length && !found; i++) {
			var entry = entries[i],
				next = path + "/" + entry[0];
			if (entry[4]) find(entry[4], next);
			else if (entry[0] == name) found = next;
		}
	}
	find(G.docs.guide || [], "/docs/guide");
	return found || "/docs/ref/" + name;
}

function set_proximity_guides(enabled) {
	proximity_guides = !!enabled;
	if (proximity_guides) {
		$(".guidesoff").hide();
		$(".guideson").show();
		Cookies.set("no_proximity_guides", "", { expires: 12 * 365 });
	} else {
		$(".guideson").hide();
		$(".guidesoff").show();
		Cookies.set("no_proximity_guides", "1", { expires: 12 * 365 });
		$("#merrit-stand-notice").remove();
	}
	render_server();
}

function open_event_announcement(key) {
	var event = G.events[key];
	if (!event || !event.modal || no_html) return;
	if (key == "anniversary" && character) return render_anniversary_event();
	open_guide(event.modal, "/docs/ref/" + event.modal);
}

function event_announcement_html(args) {
	if (no_html) return "";
	var interactive = !!args.key,
		item = G.items[args.sprite],
		html =
			(interactive ? "<button type='button' class='gamebutton event-announcement'" : "<article class='event-announcement'") +
			" data-effect='" + html_escape(args.effect) +
			"' style='--event-color:" + args.color + ";--event-accent:" + args.accent + "'";
	if (interactive)
		html += " onclick='pcs(event);open_event_announcement(\"" + args.key + "\")' aria-haspopup='dialog'";
	html += ">";
	if (interactive) html += "<span class='event-announcement-arrow' aria-hidden='true'>&lt;</span>";
	if (!no_graphics) {
		html += "<span class='event-announcement-effects' aria-hidden='true'>";
		for (var i = 0; i < 12; i++) html += "<i style='left:" + (12 + i * 24) + "px;top:" + (8 + (i % 3) * 12) + "px;animation-delay:" + (i % 4) * -0.6 + "s'></i>";
		html += "</span>";
	}
	html += "<span class='event-announcement-sprite' aria-hidden='true'>";
	if (!no_graphics) html += args.skin || item ? item_container({ skin: args.skin || item.skin, size: 40, draggable: false }) : sprite(args.sprite, { width: 48, height: 48, overflow: true });
	html += "</span><span class='event-announcement-copy'>";
	if (args.label) html += "<small>" + html_escape(args.label) + "</small>";
	return html + "<span class='event-announcement-title'>" + html_escape(args.title) +
		"</span><span class='event-announcement-description'>" + html_escape(args.text) +
		"</span></span>" + (interactive ? "</button>" : "</article>");
}

function render_upcoming_content() {
	if (no_html) return;
	var cards = $("#features .upcoming-cards");
	if (!cards.length) return;
	var teasers = [
		{ id: "adventures", skin: "teaser_witch", color: "#B28AE8", accent: "#EA89B4", effect: "sparks" },
		{ id: "black_wake", skin: "teaser_blackwake", color: "#69D6CF", accent: "#589FE8", effect: "bubbles" },
		{ id: "werdars", skin: "teaser_werdars", color: "#EAB957", accent: "#EF866B", effect: "embers" },
		{ id: "rare_drops", skin: "teaser_rare", color: "#85C76B", accent: "#69D6CF", effect: "sparks" },
	];
	cards.html(teasers.map(function (teaser) {
		teaser.title = phrase("interface.upcoming." + teaser.id + ".title");
		teaser.text = phrase("interface.upcoming." + teaser.id + ".text");
		return event_announcement_html(teaser);
	}).join(""));
}

function render_event_announcements() {
	if (no_html) return;
	var banner = $("#event-announcements"),
		keys = (character || (typeof inside != "undefined" && inside == "game") ? [] : Object.keys(G.events || {}))
			.filter(function (key) {
				var state = S[key],
					event = G.events[key];
				return typeof socket != "undefined" && socket && socket.connected && state && state.active !== false && (event.type == "seasonal" || state.live !== false) && event.announcement && event.modal;
			})
			.sort(function (a, b) {
				return (G.events[b].type == "seasonal") - (G.events[a].type == "seasonal");
			})
			.slice(0, 2),
		signature = JSON.stringify(
			keys
				.map(function (key) {
					return [key, G.events[key]];
				})
				.concat([!!no_graphics]),
		);
	if (banner.data("events") === signature) return;
	banner.data("events", signature);
	var html = "";
	keys.forEach(function (key) {
		var event = G.events[key],
			theme = event.announcement;
		html += event_announcement_html({
			key: key,
			sprite: event.sprite,
			color: theme.color,
			accent: theme.accent,
			effect: theme.effect,
			label: event.type == "seasonal" ? phrase("interface.event_announcements.seasonal_event") : phrase("interface.event_announcements.live_event"),
			title: theme.title ? phrase.definition("event", key, "announcement.title", theme.title) : phrase.definition("event", key, "name", event.name),
			text: phrase.definition("event", key, "announcement.text", theme.text),
		});
	});
	banner.html(html);
	if (keys.length) banner.show();
	else banner.hide();
}

function render_server() {
	render_event_announcements();
	var html = "",
		content = false,
		featured = anniversary_live_event(),
		contexts = proximity_guides ? (interaction_contexts.length ? interaction_contexts : interaction_context ? [interaction_context] : []) : [];
	if (!no_html && featured && featured.skin) {
		html += " <div class='gamebutton' title='" + html_escape(featured.target) + "' style='padding:6px 8px;font-size:24px;line-height:18px' onclick='pcs(event);render_anniversary_event()'>";
		html += sprite(featured.skin, { cx: clone(featured.cx || {}), overflow: true });
		html += "<div style='color:#E10029;margin-top:1px'>" + phrase.html("interface.server.kiss") + "</div></div>";
		content = true;
	}
	for (var context_index = 0; context_index < contexts.length; context_index++) {
		var context = contexts[context_index],
			definition = context.definition,
			visual = context.visual || {},
			icon = definition.icon && G.items[definition.icon],
			visual_icon = visual.icon && G.items[visual.icon],
			npc = context.npc,
			context_title =
				((npc && npc.name && npc.name + ": ") || "") +
				(definition.summary ? phrase.definition("interaction", context.key, "summary", definition.summary) : phrase.definition("interaction", context.key, "title", definition.title));
		if (context.key === "dreams") continue;
		html +=
			" <div class='gamebutton' title='" +
			html_escape(context_title) +
			"' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_interaction_guide(\"" +
			context.key +
			"\")'>";
		if (visual.skin) html += sprite(visual.skin, { cx: clone(visual.cx || {}), overflow: true, j: 0 });
		else if (npc && npc.skin) html += sprite(npc.skin, { cx: clone(npc.cx || {}), overflow: true });
		else if (visual_icon) html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: visual_icon.skin, bcolor: "black" }) + "</div>";
		else if (icon) html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: icon.skin, bcolor: "black" }) + "</div>";
		else html += "<div style='font-size: 32px; line-height: 42px; color:#69BE86'>?</div>";
		html += "<div style='color:#69BE86; margin-top: 1px'>" + phrase.html(visual.label || "interface.server.info") + "</div></div>";
		content = true;
	}
	if (proximity_guides && quirks.crypt) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"dungeon-crypt\",\"/docs/ref/dungeon-crypt\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: G.items.cryptkey.skin, bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (proximity_guides && quirks.darkmage) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"dungeon-darkmage\",\"/docs/ref/dungeon-darkmage\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: G.items.frozenkey.skin, bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (proximity_guides && quirks.fishing) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_interaction_guide(\"gathering\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: G.items.rod.skin, bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (proximity_guides && quirks.mining) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_interaction_guide(\"gathering\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: G.items.pickaxe.skin, bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (gameplay == "hardcore") {
		$(".rewardsbutton").css("display", "inline-block");
		$(".minutesui").css("display", "inline-block");
		var hours = "0" + parseInt(S.minutes / 60);
		var minutes = S.minutes % 60;
		if (!minutes) minutes = "00";
		else if (minutes < 10) minutes = "0" + minutes;
		$(".minutesui").html(hours + ":" + minutes);
	}
	["crabxx", "goobrawl", "abtesting", "franky", "icegolem"].forEach(function (type) {
		if (S[type]) {
			var scolor = "#ECECEC",
				lcolor = "#ECECEC",
				lphrase = phrase.html("interface.server.event"),
				s = type;
			if (type == "goobrawl") ((lcolor = "#FF5D34"), (s = "rgoo"));
			if (type == "abtesting") ((lcolor = "#E10029"), (s = "thehelmet"));
			else if (G.monsters[type] && G.monsters[type].announce) lcolor = G.monsters[type].announce;
			html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-" + type + '","/docs/ref/event-' + type + "\")'>";
			html += sprite(s, { overflow: true });
			html += "<div style='color:" + lcolor + "; margin-top: 1px'>" + lphrase + "</div>";
			html += "</div>";
			content = true;
		}
	});
	["wabbit", "mrpumpkin", "mrgreen", "snowman", "dragold", "grinch", "pinkgoo", "slenderman", "tiger"].forEach(function (type) {
		if (S[type]) {
			var scolor = "#ECECEC",
				lcolor = "#ECECEC",
				lphrase = phrase("interface.server.live");
			if (type == "snowman") ((lcolor = colors.xmasgreen), (scolor = colors.xmas));
			if (type == "grinch") ((scolor = colors.xmasgreen), (lcolor = colors.xmas), (lphrase = phrase("interface.server.beware")));
			html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); emonster_click(\"" + type + "\")'>";
			html += sprite(type, { overflow: true });
			if (!S[type].live) html += "<div style='color:" + scolor + "; margin-top: 1px'>" + phrase.html("interface.server.m", { value: parseInt(round(-msince(new Date(S[type].spawn)))) }) + "</div>";
			else if (S[type].target) html += "<div style='color:" + lcolor + "; margin-top: 1px'>" + phrase.html("interface.server.join") + "</div>";
			else html += "<div style='color:" + lcolor + "; margin-top: 1px'>" + lphrase + "</div>";
			html += "</div>";
			content = true;
		}
	});
	if (S.halloween) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-halloween\",\"/docs/ref/halloween\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: "candy0", bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (S.holidayseason) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-holidayseason\",\"/docs/ref/holidayseason\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: "candycane", bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (S.lunarnewyear) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-lunarnewyear\",\"/docs/ref/lunarnewyear\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: "brownenvelope", bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (S.egghunt) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-egghunt\",\"/docs/ref/egghunt\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: "basketofeggs", bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (S.valentines) {
		html += " <div class='gamebutton' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-valentines\",\"/docs/ref/valentines\")'>";
		html += "<div style='margin-top: -1px; margin-left: -3px; margin-right: -3px'>" + item_container({ skin: "cupid", bcolor: "black" }) + "</div>";
		html += "<div style='color:#CFD1D1; margin-top: 1px'>" + phrase.html("interface.server.info") + "</div>";
		html += "</div>";
		content = true;
	}
	if (S.anniversary && S.anniversary.active) {
		html += " <div class='gamebutton' style='padding:6px 8px;font-size:24px;line-height:18px' onclick='pcs(event);render_anniversary_event()'>";
		html += "<div style='margin-top:-1px;margin-left:-3px;margin-right:-3px'>" + item_container({ skin: "anniversarygift", bcolor: "black", draggable: false }) + "</div>";
		html += "<div style='color:#F0B742;margin-top:1px'>" + phrase.html("interface.server.10_years") + "</div></div>";
		content = true;
	}
	if (cave_info_available()) {
		html += " <div class='gamebutton' id='cave-info-button' title='Cave of Many Dreams' style='padding:6px 8px;font-size:24px;line-height:18px' onclick='pcs(event);open_cave_info()'>";
		html += "<div style='margin-top:-1px;margin-left:-3px;margin-right:-3px'>" + item_container({ skin: "cave_info", bcolor: "black", draggable: false }) + "</div>";
		html += "<div style='color:#CFD1D1;margin-top:1px'>" + phrase.html("cave.info_button") + "</div></div>";
		content = true;
	}
	$("#serverinfo").html(html);
	if (!content) $("#serverinfo").hide();
	else $("#serverinfo").css("display", "flex");
	if (!no_html && $("#anniversary-event-panel").length) render_anniversary_event(true);
	var anniversary_available = anniversary_can_visit();
	if (!no_html && character && anniversary_visible_skill != anniversary_available) {
		anniversary_visible_skill = anniversary_available;
		render_skillbar();
		if (skillsui) (render_skills(), render_skills());
	}
}

function render_character_sheet() {
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: left' class='disableclicks'>";
	html +=
		"<div><span style='color:gray'>" +
		phrase.html("interface.character_sheet.class") +
		"</span> " +
		html_escape(phrase.definition("class", character.ctype, "name", to_title(character.ctype))) +
		"</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.level") + "</span> " + character.level + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.xp") + "</span> " + to_pretty_num(character.xp) + " / " + to_pretty_num(character.max_xp) + "</div>";
	var divider = 1,
		disclaimer = "";
	if (pvp && !(!is_pvp && G.maps[character.map].safe_pvp)) ((divider = 10), (disclaimer = "<span style='color:#605B85'>" + phrase.html("interface.character_sheet.pvp") + "</span>"));
	var lost_xp = floor(min(max((character.max_xp * 0.01) / divider, (character.xp * 0.02) / divider), character.xp));
	if (character.ctype != "merchant")
		html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.max_xp_loss") + "</span> " + to_pretty_num(lost_xp) + " " + disclaimer + "</div>";
	if (character.party && party && party[character.name])
		html +=
			"<div><span style='color:" +
			colors.party_xp +
			"'>" +
			phrase.html("interface.character_sheet.party") +
			"</span> " +
			round(party[character.name].share * 100) +
			"% <span style='color:gray'>" +
			phrase.html("interface.character_sheet.your_share") +
			"</span></div>";
	if (character.ctype == "merchant") html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.tax") + "</span> " + character.tax * 100 + "%</div>";
	if (character.ctype == "priest") {
		html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.heal") + "</span> " + character.heal + "</div>";
	}
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.attack") + "</span> " + character.attack + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.attack_speed") + "</span> " + round(character.frequency * 100) + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.strength") + "</span> " + character.str + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.intelligence") + "</span> " + character["int"] + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.dexterity") + "</span> " + character.dex + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.vitality") + "</span> " + character.vit + "</div>";
	html +=
		"<div><span style='color:gray'>" +
		phrase.html("interface.character_sheet.fortitude") +
		"</span> " +
		character["for"] +
		" <span style='color:gray'>(" +
		parseInt((1 - damage_multiplier(character["for"] * 5)) * 10000.0) / 100.0 +
		"%)</span></div>";
	html +=
		"<div><span style='color:gray'>" +
		phrase.html("interface.character_sheet.armor") +
		"</span> " +
		character.armor +
		" <span style='color:gray'>(" +
		parseInt((1 - damage_multiplier(character.armor)) * 10000.0) / 100.0 +
		"%)</span></div>";
	html +=
		"<div><span style='color:gray'>" +
		phrase.html("interface.character_sheet.resistance") +
		"</span> " +
		character.resistance +
		" <span style='color:gray'>(" +
		parseInt((1 - damage_multiplier(character.resistance)) * 10000.0) / 100.0 +
		"%)</span></div>";
	html +=
		"<div><span style='color:gray'>" +
		phrase.html("interface.character_sheet.courage") +
		"</span> " +
		character.courage +
		" <span style='color:gray'>|</span> " +
		character.mcourage +
		" <span style='color:gray'>|</span> " +
		character.pcourage +
		"</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.speed") + "</span> " + character.speed + "</div>";
	html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.mp_cost") + "</span> " + character.mp_cost + "</div>";
	if (character.lifesteal) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.lifesteal") + "</span> " + to_pretty_float(character.lifesteal) + "%</div>";
	if (character.manasteal) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.manasteal") + "</span> " + to_pretty_float(character.manasteal) + "%</div>";
	if (character.dreturn) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.damage_return") + "</span> " + to_pretty_float(character.dreturn) + "%</div>";
	if (character.reflection) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.reflection") + "</span> " + to_pretty_float(character.reflection) + "%</div>";
	if (character.evasion) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.evasion") + "</span> " + to_pretty_float(character.evasion) + "%</div>";
	if (character.miss) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.miss") + "</span> " + to_pretty_float(character.miss) + "%</div>";
	if (character.crit) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.crit") + "</span> " + to_pretty_float(character.crit) + "%</div>";
	if (character.critdamage) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.critical_damage") + "</span> " + to_pretty_float(200 + character.critdamage) + "%</div>";
	if (character.apiercing) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.armor_piercing") + "</span> " + character.apiercing + "</div>";
	if (character.rpiercing) html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.resistance_piercing") + "</span> " + character.rpiercing + "</div>";
	if (character.goldm != 1) {
		if (character.party && party && party[character.name] && party[character.name].gold)
			html +=
				"<div><span style='color:gray'>" +
				phrase.html("interface.character_sheet.gold") +
				"</span> " +
				round(character.goldm * 100 - party[character.name].gold) +
				"% <span style='color:" +
				colors.gold +
				"'>+" +
				party[character.name].gold +
				"%</span></div>";
		else html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.gold") + "</span> " + round(character.goldm * 100) + "%</div>";
	}
	if (character.xpm != 1) {
		if (character.party && party && party[character.name] && party[character.name].xp)
			html +=
				"<div><span style='color:gray'>" +
				phrase.html("interface.character_sheet.experience") +
				"</span> " +
				round(character.xpm * 100 - party[character.name].xp) +
				"% <span style='color:" +
				colors.stat_xp +
				"'>+" +
				party[character.name].xp +
				"%</span></div>";
		else html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.experience") + "</span> " + round(character.xpm * 100) + "%</div>";
	}
	if (character.luckm != 1) {
		if (character.party && party && party[character.name] && party[character.name].luck)
			html +=
				"<div><span style='color:gray'>" +
				phrase.html("interface.character_sheet.luck") +
				"</span> " +
				round(character.luckm * 100 - party[character.name].luck) +
				"% <span style='color:" +
				colors.luck +
				"'>+" +
				party[character.name].luck +
				"%</span></div>";
		else html += "<div><span style='color:gray'>" + phrase.html("interface.character_sheet.luck") + "</span> " + round(character.luckm * 100) + "%</div>";
	}
	html += "</div>";
	render_ui_panel("#rightcornerui", html, "stats", { label: "X", corner: true, classes: "ui-close-corner" });
	topright_npc = "character";
}

function render_conditions(player) {
	var html = "<div style='margin-top: 5px; margin-bottom: -5px; margin-left: -2px' class='rconditions'>",
		current = 0,
		rids = [];
	for (var condition in player.s) {
		if (G.skills[condition] && G.skills[condition].ui) {
			console.log("here");
			var def = G.skills[condition],
				rid = randomStr(30);
			html += item_container({ skin: def.skin, loader: "cplc" + rid });
			rids.push([rid, 24000, player.s[condition].ms]);
			current += 1;
			continue;
		}
		var prop = G.conditions[condition],
			actual = player.s[condition];
		if (!actual.skin && (!prop || (!prop.ui && (!actual.s || actual.s < 20)))) continue;
		if (player.type == "monster" && condition == "poisonous") continue;
		if (current > 0 && !(current % 2)) html += "<div></div>";
		current += 1;
		html += item_container({ skin: actual.skin || prop.skin, onclick: "condition_click('" + condition + "')" }, actual);
	}
	for (var event in player.q || {}) {
		if (event == "exchange") {
			var level = 0;
			var name = player.q.exchange.name;
			var q = undefined;
			// if(player.q.exchange.s) level=player.q.exchange.s;
			// if(player.q.exchange.q>1) q=player.q.exchange.q;
			current += 1;
			html += item_container({ skin: G.items[name].skin, bcolor: "#E9973A" }, { name: name, level: level, q: q });
		}
	}
	html += "</div>";
	if (current) {
		if ($(".rconditions").length) $(".rconditions").replaceWith(html);
		else $(".renderedinfo").append(html);
		if (rids.length) {
			for (var i = 0; i < rids.length; i++) {
				$(".loadercplc" + rids[i][0]).css("opacity", 0.5);
				add_tint(".loadercplc" + rids[i][0], { ms: rids[i][2], start: future_ms(rids[i][2] - rids[i][1]), type: "progress" });
			}
		}
	} else $(".rconditions").remove();
}

var mimickers = {};
function render_mimickers() {
	if (!window.Dev || 1) return;
	var new_mimickers = {};
	$(".tomimick").each(function () {
		var $this = $(this),
			key = $this.offset().top + "|" + $this.offset().left + "|" + $this.outerWidth() + "|" + $this.outerHeight();
		// if(!isElementInViewport(this)) return; // #TODO: auto hide with overlay check
		if (window.inside != "game" || window.modal_count || !$this.is(":visible")) return;
		if (mimickers[key]) return (new_mimickers[key] = mimickers[key]);
		mimickers[key] = new_mimickers[key] = $(
			"<div class='mimicker' style='top: " + $this.offset().top + "px; left: " + $this.offset().left + "px; width: " + $this.outerWidth() + "px; height: " + $this.outerHeight() + "px'></div>",
		)
			.appendTo("body")
			.click(function (event) {
				event.stopPropagation();
				event.preventDefault();
				var elements = document.elementsFromPoint(event.pageX, event.pageY);
				for (var i = 0; i < elements.length; i++) {
					if (!elements[i]["class"] != "mimicker" && (elements[i].onclick || elements[i].classList.contains("clickable"))) {
						elements[i].click();
						break;
					}
				}
			});
	});
	for (var key in mimickers) {
		if (!new_mimickers[key]) {
			mimickers[key].remove();
			delete mimickers[key];
		}
	}
}

function render_npc(npc) {
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top;' class='renderedinfo'>";
	html += bold_prop_line(phrase.html("interface.npc.npc"), npc.name, "gray");
	html += bold_prop_line(phrase.html("interface.npc.level"), npc.level, "orange");
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
}

function render_monster(monster) {
	var def = G.monsters[monster.mtype],
		styles = (def.explanation && "max-width: 200px") || "",
		name = def.name;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; " + styles + "' class='renderedinfo'>";
	if (monster.dead) ((name += " X"), (monster.hp = 0));
	if (monster.level > 1) name += " " + phrase("chat.character_level", { level: monster.level });
	var hp = monster.hp,
		max_hp = monster.max_hp,
		xp = monster.xp;
	if (max_hp >= 1000000) ((hp = to_pretty_num(hp)), (max_hp = to_pretty_num(max_hp)));
	if (xp >= 1000000) xp = to_pretty_num(xp);
	html += info_line({ line: name, color: "gray", onclick: "render_monster_info('" + monster.mtype + "')" });
	html += info_line({
		name: phrase.html("stat.hp.name"),
		color: colors.hp,
		value: hp + "/" + max_hp,
		cursed: monster.s.cursed,
		stunned: !monster.attack && monster.s.stunned,
		poisoned: !monster.attack && monster.s.poisoned,
	});
	html += info_line({ name: phrase.html("stat.xp.name"), color: "green", value: xp });
	if (monster.attack)
		html += info_line({ name: phrase.html("interface.monster.att"), color: "#316EE6", value: smart_num(monster.attack, 10000), stunned: monster.s.stunned, poisoned: monster.s.poisoned });
	if (def.avoidance) html += info_line({ name: phrase.html("interface.monster.avoidance"), color: "gray", value: def.avoidance + "%" });
	if (def.evasion) html += info_line({ name: phrase.html("interface.monster.evasion"), color: "gray", value: def.evasion + "%" });
	if (def.reflection) html += info_line({ name: phrase.html("interface.monster.reflect"), color: "gray", value: def.reflection + "%" });
	if (def.dreturn) html += info_line({ name: phrase.html("interface.monster.d_return"), color: "gray", value: def.dreturn + "%" });
	if (monster.armor) html += info_line({ name: phrase.html("interface.monster.armor"), color: "gray", value: monster.armor });
	if (monster.resistance) html += info_line({ name: phrase.html("interface.monster.resist"), color: "gray", value: monster.resistance });
	if (def.rpiercing) html += info_line({ name: phrase.html("interface.monster.pierce"), color: "gray", value: def.rpiercing });
	if (def.apiercing) html += info_line({ name: phrase.html("interface.monster.pierce"), color: "gray", value: def.apiercing });
	if (def.explosion) html += info_line({ name: phrase.html("interface.monster.expl"), color: "gray", value: def.explosion });
	if (monster.lifesteal) html += info_line({ name: phrase.html("interface.monster.lifesteal"), color: colors.lifesteal, value: monster.lifesteal + "%" });
	if (monster["1hp"]) html += info_line({ line: phrase.html("interface.monster.1hp_hits"), color: "#AEAEAE" });
	if (monster.cooperative) html += info_line({ line: phrase.html("interface.monster.cooperative"), color: "#AEAEAE" });
	if (monster.s.rimeshell) html += info_line({
		line: phrase.html("interface.monster.rime_shell_progress", { seconds: (Math.max(0, monster.s.rimeshell.ms) / 1000).toFixed(1), damage: to_pretty_num(monster.s.rimeshell.remaining) }),
		color: "#A8DCDC",
	});
	if (def.immune) html += info_line({ line: phrase.html("interface.monster.immune"), color: "#AEAEAE" });
	if (def.peaceful) html += info_line({ line: phrase.html("interface.monster.peaceful"), color: "#54B25F" });
	if (def.supporter) html += info_line({ line: phrase.html("interface.monster.supporter"), color: "#CA5931" });
	//if (def.spawns) html += info_line({ line: "SPAWNS", color: "#AEAEAE" });  this is  just adding an extra line to the mob UI
	if (def.abilities) {
		for (var id in def.abilities) {
			if (!G.skills[id]) continue;
			html += info_line({
				name: (def.abilities[id].aura && phrase.html("interface.monster.aura")) || phrase.html("interface.monster.ability"),
				color: "#FC5F39",
				value: phrase.definition("skill", id, "name", G.skills[id].name).toLocaleUpperCase(phrase.language),
				onclick: "dialogs_target=xtarget||ctarget; render_skill('#topleftcornerdialog','" + id + "')",
			});
		}
	}
	if (def.spawns) {
		// Collect info
		const spawnInfo = {};

		def.spawns.forEach(function (s) {
			const condition = s[0];
			const name = s[1];
			const count = s[2] || 1;

			if (!spawnInfo[name]) {
				spawnInfo[name] = { timers: [], thresholds: [] };
			}

			if (typeof condition === "number") {
				spawnInfo[name].timers.push({ interval: condition, count });
			} else if (typeof condition === "string" && condition.startsWith("hp:")) {
				const threshold = parseFloat(condition.split(":")[1]);
				spawnInfo[name].thresholds.push({ threshold, count });
			}
		});

		// Build lines
		Object.keys(spawnInfo).forEach((name) => {
			const info = spawnInfo[name];
			let lines = [];

			// Timers
			info.timers.forEach((t) => {
				lines.push(phrase.html("interface.monster.spawns_interval", { count: t.count, monster: G.monsters[name].name, interval: t.interval }));
			});

			// HP thresholds
			if (info.thresholds.length === 1) {
				const t = info.thresholds[0];
				lines.push(phrase.html("interface.monster.spawns_threshold", { count: t.count, monster: G.monsters[name].name, percent: t.threshold * 100 }));
			} else if (info.thresholds.length > 1) {
				// Sort thresholds high → low
				info.thresholds.sort((a, b) => b.threshold - a.threshold);

				const percents = info.thresholds.map((t) => t.threshold * 100);
				const counts = [...new Set(info.thresholds.map((t) => t.count))];

				if (counts.length === 1) {
					// Check if evenly spaced
					const diffs = percents.map((p, i) => (i > 0 ? percents[i - 1] - p : null)).slice(1);
					const allEqual = diffs.every((d) => d === diffs[0]);

					if (allEqual) {
						// Summarized
						lines.push(phrase.html("interface.monster.spawns_step", { count: counts[0], monster: G.monsters[name].name, percent: diffs[0] }));
					} else {
						// Generic
						lines.push(phrase.html("interface.monster.spawns_thresholds", { monster: G.monsters[name].name }));
					}
				} else {
					// Generic if counts differ
					lines.push(phrase.html("interface.monster.spawns_thresholds", { monster: G.monsters[name].name }));
				}
			}

			// Add to tooltip
			lines.forEach((line) => {
				html += info_line({
					name: phrase.html("interface.monster.spawns"),
					color: "#237B2A",
					value: line,
					onclick: "render_monster_info('" + name + "')",
				});
			});
		});
	}
	if (monster.target) html += info_line({ name: phrase.html("interface.monster.trg"), color: "orange", value: monster.target });
	if (monster.pet) {
		html += info_line({ name: phrase.html("interface.monster.name"), value: monster.name, color: "#5CBD97" });
		html += info_line({ name: phrase.html("interface.monster.pal"), value: monster.owner, color: "#CF539B" });
	}
	if (monster.heal) {
		html += info_line({ line: phrase.html("interface.monster.self_healing"), color: "#9E6367" });
	}
	if (character) {
		var diff = calculate_difficulty(monster);
		if (diff >= 2) html += info_line({ name: phrase.html("interface.monster.diff"), color: "gray", value: phrase.html("interface.monster.hard"), vcolor: "#ED4047" });
		else if (diff) html += info_line({ name: phrase.html("interface.monster.diff"), color: "gray", value: phrase.html("interface.monster.challenging"), vcolor: "#EF9232" });
		else html += info_line({ name: phrase.html("interface.monster.diff"), color: "gray", value: phrase.html("interface.monster.easy"), vcolor: "#8BF54D" });
	}
	if (def.poisonous) {
		html += info_line({ line: phrase.html("interface.monster.poisonous"), color: colors.poison });
	}
	if (def.explanation) {
		html += info_line({ line: phrase.definition("monster", monster.mtype, "explanation", def.explanation), color: "gray" });
	}
	html += button_line({
		name: "<span style='color:gray'>{}</span><span style='color:white'>:</span>" + " " + phrase.html("interface.monster.inspect"),
		onclick: "ui_inspect(xtarget||ctarget)",
		color: colors.inspect,
	});
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	render_conditions(monster);
}

var cache_bid = -1;
function render_character(player) {
	var html =
			"<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top;' class='renderedinfo' data-id='" + player.id + "'>",
		cccx = $(".cccx").length,
		ihtml = "",
		bhtml = "",
		xhtml = "",
		already = false;
	if ($(".renderedinfo").length && $(".renderedinfo").data("id") == player.id) already = true;
	html += info_line({
		name: (player.role && phrase.definition("role", player.role, "name", player.role.toTitleCase()).toLocaleUpperCase(phrase.language)) || phrase.html("interface.character.name"),
		color: (player.role && "#E14F8B") || "gray",
		value: player.name,
		onclick: "render_cosmetics(xtarget||ctarget,{toggle:true})",
	});
	html += "<div class='ihtml'>";
	if (player.npc && G.npcs[player.npc].cavalry)
		ihtml += info_line({line: phrase.definition("class", player.ctype, "name", player.ctype), color: "#C6AA62"});
	ihtml += info_line({ name: phrase.html("interface.character.level"), color: "orange", value: player.level, afk: player.afk });
	ihtml += info_line({ name: phrase.html("stat.hp.name"), color: colors.hp, value: player.hp + "/" + player.max_hp });
	ihtml += info_line({ name: phrase.html("stat.mp.name"), color: "#365DC5", value: player.mp + "/" + player.max_mp });
	if (player.heal) ihtml += info_line({ name: phrase.html("interface.character.heal"), color: "#CB83AC", value: round(player.heal) });
	ihtml += info_line({ name: phrase.html("interface.character.att"), color: "green", value: round(player.attack), cursed: player.s.cursed });
	ihtml += info_line({ name: phrase.html("interface.character.attspd"), color: "gray", value: round(player.frequency * 100), poisoned: player.s.poisoned });
	ihtml += info_line({ name: phrase.html("interface.character.range"), color: "gray", value: player.range });
	ihtml += info_line({ name: phrase.html("interface.character.runspd"), color: "gray", value: round(player.speed) });
	ihtml += info_line({ name: phrase.html("interface.character.armor"), color: "gray", value: player.armor || 0 });
	ihtml += info_line({ name: phrase.html("interface.character.resist"), color: "gray", value: player.resistance || 0 });

	if (player.code) ihtml += info_line({ name: "CODE", color: "gold", value: phrase.html("interface.character.active") });
	if (player.party) ihtml += info_line({ name: phrase.html("interface.character.party"), color: "#FF4C73", value: player.party });
	html += ihtml;
	html += "</div>";
	html += "<div class='xhtml'>";
	xhtml += button_line({
		name: "<span style='color:gray'>{}</span><span style='color:white'>:</span>" + " " + phrase.html("interface.character.inspect"),
		onclick: "ui_inspect(xtarget||ctarget)",
		color: colors.inspect,
	});
	html += xhtml;
	if (player.npc && G.npcs[player.npc].cavalry)
		html += button_line({name: phrase.html("interface.item.info"), onclick: "open_guide('cavalry', get_guide_url('cavalry'))", color: "#C6AA62"});
	html += "</div>";
	var bid = player.party + "|" + player.stand + "|" + (character.slots.trade1 !== undefined);
	html += "<div class='bhtml'>";
	if (!player.npc && !player.party && character && !player.me && !player.stand)
		bhtml += button_line({
			name: phrase.html("interface.character.party"),
			onclick: "socket.emit('party',{event:'invite',id:'" + player.id + "'}); push_deferred('party')",
			color: "#6F3F87",
			pm_onclick: "cpm_window('" + (player.controller || player.name) + "')",
		});
	if (character && !player.me && character.party && player.party == character.party && party_list.indexOf(character.name) < party_list.indexOf(player.name))
		bhtml += button_line({ name: phrase.html("interface.character.kick"), onclick: "socket.emit('party',{event:'kick',name:'" + player.name + "'}); push_deferred('party')", color: "#875045" });
	if (character && !player.me && !character.party && player.party)
		bhtml += button_line({
			name: phrase.html("interface.character.request"),
			onclick: "socket.emit('party',{event:'request',id:'" + player.id + "'}); push_deferred('party')",
			color: "#6F3F87",
			pm_onclick: "cpm_window('" + (player.controller || player.name) + "')",
		});

	if (player.me) bhtml += button_line({ name: phrase.html("interface.character.cosmetics"), onclick: "render_cosmetics(xtarget||ctarget,{toggle:true})", color: "#A99A5B" });

	if (player.me && !character.stand && character.slots.trade1 !== undefined)
		bhtml += button_line({ name: phrase.html("interface.character.hide"), onclick: "socket.emit('trade',{event:'hide'});", color: "#A99A5B" });
	if (player.me && !character.stand && character.slots.trade1 === undefined)
		bhtml += button_line({ name: phrase.html("interface.character.trade"), onclick: "socket.emit('trade',{event:'show'});", color: "#A99A5B" });
	if (player.stand)
		bhtml += button_line({
			name: phrase.html("interface.character.toggle"),
			onclick: "$('.cmerchant').toggle(); if(ctoggled==(xtarget||ctarget).name) ctoggled=null; else ctoggled=(xtarget||ctarget).name;",
			color: "#A99A5B",
			pm_onclick: !player.me && "cpm_window('" + (player.controller || player.name) + "')",
		});

	if (character && !player.me && character.slots.gloves && character.slots.gloves.name == "poker")
		bhtml += button_line({ name: phrase.html("interface.character.poke"), onclick: "socket.emit('poke',{name:'" + player.name + "'})", color: "#DF962B" });
	html += bhtml;
	html += "</div>";
	html += "</div>";
	if (already) {
		$(".ihtml").html(ihtml);
		if (bid != cache_bid) $(".bhtml").html(bhtml);
	} else render_ui_panel("#topleftcornerui", html);
	render_conditions(player);
	render_slots(player, { cx: true });
	// if(ctoggled==player.name) $('.cmerchant').toggle();
	if (cccx) render_cosmetics(player);
	cache_bid = bid;
}

function info_line(info) {
	var color = info.color || "white",
		addition = "",
		html = "";
	if (info.onclick) info.value = "<span class='clickable tomimick inline-block' onclick=\"" + info.onclick + '" ontouchstart="' + info.onclick + '">' + info.value + "</span>";
	if (info.afk && info.afk == "bot") addition = " <span class='gray'>[" + phrase.html("interface.presence.bot") + "]</span>";
	else if (info.afk && info.afk == "code") addition = " <span class='gray'>[CODE]</span>";
	else if (info.afk) addition = " <span class='gray'>[" + phrase.html("interface.presence.afk") + "]</span>";
	if (info.cursed) addition = " <span style='color: #7D4DAA'>[" + phrase.html("interface.presence.cursed_short") + "]</span>";
	if (info.poisoned) addition = " <span style='color: #45993F'>[" + phrase.html("interface.presence.poisoned_short") + "]</span>";
	if (info.stunned) addition = " <span style='color: #FF9601'>[" + phrase.html("interface.presence.stunned_short") + "]</span>";
	if (info.line) {
		if (info.onclick) info.line = "<span class='clickable tomimick inline-block' onclick=\"" + info.onclick + '" ontouchstart="' + info.onclick + '">' + info.line + "</span>";
		html += "<span class='cbold' style='color: " + color + "'>" + info.line + "</span>" + addition + "<br />";
	} else if (info.vcolor) html += "<span class='cbold' style='color: " + color + "'>" + info.name + "</span>: <span style='color: " + info.vcolor + "'>" + info.value + addition + "</span><br />";
	else html += "<span class='cbold' style='color: " + color + "'>" + info.name + "</span>: " + info.value + addition + "<br />";
	return html;
}

function button_line(button, no_newline) {
	var html = "",
		color = button.color || "white";
	html += "<span style='color: " + color + "' class='clickable tomimick cbold inline-block' onclick=\"" + button.onclick + '">' + button.name + "</span> ";
	if (button.pm_onclick)
		html +=
			" <span style='color: " +
			("#A255BA" || "#276bc5" || color) +
			"' class='clickable tomimick cbold inline-block' onclick=\"" +
			button.pm_onclick +
			'">' +
			phrase.html("interface.chat.private_message_short") +
			"</span> ";
	if (!no_newline) html += "<br />";
	return html;
}

var cache_slots = {},
	cache_sid = -1;
function render_slots(player, args) {
	if (!args) args = {};
	function render_slot(slot, shade, op) {
		var ecolor = undefined,
			chtml = "",
			cached = cache_slots && cache_slots[slot],
			cid = "slot" + slot; // empty border color
		if (!window.mode || mode.empty_borders_darker) ((ecolor = "#222424"), (ecolor = "#292929")); //,ecolor="black";
		if (!op) op = 0.4;
		if (player.slots[slot]) {
			var current = player.slots[slot];
			var id = "item" + randomStr(10),
				item = G.items[current.name];
			if (!item) item = G.items.placeholder_m;
			var skin = current.skin || item.skin;
			if (current.expires) skin = item.skin_a;
			if (
				(current.name == "tristone" || current.name == "darktristone") &&
				(player.skin.startsWith("mm_") || player.skin.startsWith("mf_") || player.skin.startsWith("tm_") || player.skin.startsWith("tf_"))
			)
				skin = item.skin_a;
			chtml += item_container(
				{
					skin: skin,
					onclick:
						(args.onclick && args.onclick(slot)) ||
						(args.merchant && "mslot_click('" + player.name + "','" + slot + "')") ||
						(args.gallery && window["slots" + player.name] && "pslot_click('" + player.name + "','" + slot + "')") ||
						(args.gallery && "render_item_info('" + current.name + "'," + current.level + ")") ||
						"slot_click('" + slot + "')",
					def: item,
					id: id,
					cid: cid,
					draggable: player.me,
					sname: player.me ? slot : undefined,
					shade: shade,
					s_op: op,
					slot: slot,
				},
				current,
			); // num:slot is new [06/08/16]
		} else if (in_arr(slot, trade_slots) && player.me)
			chtml += item_container({ size: 40, draggable: player.me, shade: shade, s_op: op, slot: slot, cid: cid, onclick: "wishlist_click('" + slot + "')", bcolor: ecolor });
		else chtml += item_container({ size: 40, draggable: player.me, shade: shade, s_op: op, slot: slot, cid: cid, bcolor: ecolor });
		html += chtml;
		if (already && !ui_items_same(cached, current)) $("#slot" + slot).replaceWith(chtml);
	}
	var my_slots = ((player.me && player.slots.trade1 !== undefined) || player.slots.trade1 || player.slots.trade2 || player.slots.trade3 || player.slots.trade4) && !player.stand;
	var draggable = player.me,
		already = false,
		sid = player.stand + "|" + my_slots;
	if (!args.pure && $(".slots").length && $(".slots").data("id") == player.id && sid == cache_sid) already = true;
	else cache_slots = {};
	var html =
		"<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; margin-left: 5px' class='slots' data-id='" +
		player.id +
		"'>";
	if (args.pure) html = "";
	if (player.stand) {
		var row = 4,
			col = 4,
			found = false;
		for (var t = 30; t >= 25; t--) if ("trade" + t in player.slots) ((row = 5), (col = 6), (found = true));
		for (var t = 24; t >= 17; t--) if (!found && "trade" + t in player.slots) ((row = 4), (col = 6), (found = true));
		html += "<div class='cmerchant'>";
		for (var i = 0; i < row; i++) {
			html += "<div>";
			for (var j = 0; j < col; j++) {
				render_slot("trade" + (i * col + j + 1), "shade_gold", 0.2); // 0.25 with the 16x16 original one
			}
			html += "</div>";
		}
		html += "</div>";
	}
	if (player.stand) html += "<div class='cmerchant hidden'>";
	html += "<div>";
	render_slot("earring1", "shade_earring");
	render_slot("helmet", "shade_helmet", 0.5);
	render_slot("earring2", "shade_earring");
	render_slot("amulet", "shade_amulet");
	html += "</div>";
	html += "<div>";
	render_slot("mainhand", "shade_mainhand", 0.36);
	render_slot("chest", "shade_chest");
	render_slot("offhand", "shade_offhand");
	render_slot("cape", "shade20_cape");
	html += "</div>";
	html += "<div>";
	render_slot("ring1", "shade_ring");
	render_slot("pants", "shade_pants", 0.5);
	render_slot("ring2", "shade_ring");
	render_slot("orb", "shade20_orb");
	html += "</div>";
	html += "<div>";
	render_slot("belt", "shade_belt");
	render_slot("shoes", "shade_shoes", 0.5);
	render_slot("gloves", "shade_gloves");
	render_slot("elixir", "shade20_elixir");
	html += "</div>";
	if (my_slots) {
		html += "<div>";
		render_slot("trade1", "shade_gold", 0.2);
		render_slot("trade2", "shade_gold", 0.2);
		render_slot("trade3", "shade_gold", 0.2);
		render_slot("trade4", "shade_gold", 0.2);
		html += "</div>";
	}
	if (player.stand) html += "</div>";
	// if(args.cx) html+="<div style='float: left; color: "+colors.inspect+"; font-size: 16px; line-height: 0px; margin-top: 7px; margin-bottom: -7px' class='clickable' onclick='show_json((xtarget||ctarget).slots)'>{}</div>"
	if (args.cx && 0)
		html +=
			"<div style='float: right; font-size: 16px; line-height: 0px; margin-top: 7px; margin-bottom: -7px' class='clickable' onclick='render_cosmetics(xtarget||ctarget,{toggle:true})'>" +
			phrase.html("interface.slots.cosmetics") +
			"</div>";
	if (!args.pure) html += "</div>";
	if (!args.pure && !already) {
		if ($(".slots").length) $(".slots").replaceWith(html);
		else $("#topleftcornerui").append(html);
	}
	cache_slots = Object.assign({}, player.slots);
	cache_sid = sid;
	return html; // for character.html [19/11/18]
	// console.log(JSON.stringify(collection));
}

function render_transports_npc() {
	reset_inventory(1);
	topleft_npc = "transports";
	rendered_target = topleft_npc;
	e_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top;'>";
	html += "<div class='clickable' onclick='transport_to(\"main\",9)'>" + phrase.html("interface.transports_npc.gt_mainland") + "</div>";
	html += "<div class='clickable' onclick='transport_to(\"winterland\",1)'>" + phrase.html("interface.transports_npc.gt_winterland") + "</div>"; // <span style='color: "+colors.xmas+"'>XMAS!!</span>
	// html+="<div class='clickable' onclick='transport_to(\"main2\")'>&gt; New Town <span style='color: "+colors.xmasgreen+"'>[Very Soon!]</span></div>";
	// html+="<div class='clickable' onclick='transport_to(\"underworld\")'>&gt; Underworld</div>"; // <span style='color: #D23F3A'>[Soon!]</span>
	html += "<div class='clickable' onclick='transport_to(\"desertland\",1)'>" + phrase.html("interface.transports_npc.gt_desertland") + "</div>"; //  <span style='color: #D2CB7E'>[Soon!]</span>
	// html+="<div class='clickable' onclick='transport_to(\"halloween\",1)'>&gt; Spooky Forest</div>"; //  <span style='color: #D26D1E'>[Halloween!]</span>
	if (S.duels) {
		for (var name in S.duels) {
			var duel = S.duels[name];
			html +=
				'<div class=\'clickable\' onclick=\'push_deferred("enter"); socket.emit("enter",{place:"duelland",name:"' +
				duel.instance +
				"\"})'>" +
				phrase.html("interface.transports_npc.gt_duelland") +
				" " +
				"<span style='color:gray'>" +
				duel.challenger +
				"</span>" +
				" " +
				phrase.html("interface.transports_npc.vs") +
				" " +
				"<span style='color:gray'>" +
				duel.vs +
				"</span></div>";
		}
	}
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
}

function send_mainframe_command() {
	var command = $(".maincommand").html();
	command = command.replace("&nbsp;", "");
	//show_json(command);
	socket.emit("eval", { command: command });
	$(".maincommand").html("");
	setTimeout(function () {
		$(".maincommand").cfocus();
	}, 0);
}

function render_mainframe() {
	reset_inventory(1);
	topleft_npc = "mainframe";
	rendered_target = topleft_npc;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top;'>";
	html += "<div>" + phrase.html("interface.mainframe.mainframe_gt_connected") + "</div>";
	html +=
		"<div><span class='commander clickable' onclick='$(\".maincommand\").cfocus()'>" +
		phrase.html("interface.mainframe.mainframe_gt") +
		"</span> <div class='inline-block maincommand editable' contenteditable=true data-default=' '> </div></div>";
	html += "<div class='clickable' onclick='socket.emit(\"leave\"); push_deferred(\"leave\")'>" + phrase.html("interface.mainframe.logout") + "</div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	$(".maincommand").keydown(function (e) {
		if (e.keyCode === 13) {
			send_mainframe_command();
			return false;
		}
	});
	setTimeout(function () {
		$(".maincommand").cfocus();
	}, 0);
}

function render_gold_npc() {
	tut("bank");
	reset_inventory(1);
	topleft_npc = "gold";
	rendered_target = topleft_npc;
	e_item = null;
	var html =
		"<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center' onclick='stpr(event); cfocus(\".npcgold\")'>";
	html +=
		"<div style='font-size: 36px; margin-bottom: 10px' class='clickable' onclick='$(\".npcgold\").html(to_pretty_num(max(character.bank.gold,character.gold)))'><span style='color:gold'>" +
		phrase.html("interface.gold_npc.gold") +
		"</span> " +
		((character.user && to_pretty_num(character.user.gold)) || phrase.html("interface.gold_npc.unavailable")) +
		"</div>";
	html +=
		"<div style='font-size: 36px; margin-bottom: 10px'><span class='gray clickable' onclick='$(\".npcgold\").cfocus()'>" +
		phrase.html("interface.gold_npc.amount") +
		"</span> <div contenteditable='true' class='npcgold inline-block' data-default='0'>0</div></div>";
	html += "<div>";
	if (options.bank_max) html += "<div class='gamebutton clickable mr5' onclick='$(\".npcgold\").html(max(character.bank.gold,character.gold))'>" + phrase.html("interface.gold_npc.max") + "</div>";
	html +=
		"<div class='gamebutton clickable mr5' onclick='deposit()'>" +
		phrase.html("interface.gold_npc.deposit") +
		"</div><div class='gamebutton clickable' onclick='withdraw()'>" +
		phrase.html("interface.gold_npc.withdraw") +
		"</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	cfocus(".npcgold");
}

var last_rendered_items = "items0";
function render_items_npc(pack, args) {
	args = args || {};
	var bank = args.bank || (character && character.user),
		columns = args.columns || 7;
	if (!bank) return;
	if (!args.bank) tut("bank");
	if (!pack) pack = last_rendered_items;
	if (pack && !bank[pack]) {
		if (args.bank) return "";
		render_interaction("unlock_" + pack, undefined, { pack: pack });
		topleft_npc = "items";
		rendered_target = topleft_npc;
		last_rendered_items = pack; // needs to be after render_interaction
		return;
	}
	if (!args.bank) {
		last_rendered_items = pack;
		reset_inventory(1);
		topleft_npc = "items";
		rendered_target = topleft_npc;
	}
	var collection = [],
		last = 0,
		items = bank[pack] || [];
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; display: inline-block' class='dcontain'>";
	if (args.bank) html = "<div class='dcontain'>";
	for (var i = 0; i < Math.ceil(max(args.bank ? 42 : character.isize, items.length) / columns); i++) {
		html += args.bank ? "<div style='white-space: nowrap'>" : "<div>";
		for (var j = 0; j < columns; j++) {
			var current = null;
			if (last < items.length) current = items[last++];
			else last++;
			if (current) {
				var id = "citem" + (last - 1),
					item = G.items[current.name] || G.items.placeholder_m,
					skin = current.skin || item.skin;
				if (current.expires) skin = item.skin_a;
				html += item_container(
					{
						skin: skin,
						def: item,
						id: "str" + id,
						draggable: !args.bank,
						strnum: args.bank ? undefined : last - 1,
						snum: args.bank ? undefined : last - 1,
						onclick: args.onclick && args.onclick(last - 1),
					},
					current,
				);
				collection.push({ id: id, item: item, name: current.name, actual: current, num: last - 1, npc: true });
			} else {
				html += item_container({ size: 40, draggable: !args.bank, strnum: args.bank ? undefined : last - 1 });
			}
		}
		html += "</div>";
	}
	html += "</div>";
	if (args.bank) return html;
	html += "<div id='storage-item' class='rendercontainer' style='display: inline-block; vertical-align: top; margin-left: 5px'></div>";
	render_ui_panel("#topleftcornerui", html);
	for (var i = 0; i < collection.length; i++) {
		var entity = collection[i];
		function item_click(entity) {
			return function () {
				render_item("#storage-item", entity);
			};
		}
		$("#str" + entity.id)
			.on("click", item_click(entity))
			.addClass("clickable");
	}
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function ui_items_same(cached, current) {
	if (cached == -1) return false;
	if ((!cached && !current) || (cached && current && cached.name == current.name && cached.q == current.q && cached.level == current.level && !cached.expires == !current.expires)) return true;
	return false;
}

var cache_i = [];

function update_inventory() {
	var last = 0,
		rids = [];
	for (var i = 0; i < Math.ceil(max(character.isize, character.items.length) / 7); i++) {
		for (var j = 0; j < 7; j++) {
			var current = null,
				id = "citem" + last,
				cc_id = "c" + id,
				html = "",
				cached = cache_i[last];
			if (last < character.items.length) current = character.items[last];
			if (ui_items_same(cached, current)) {
				last++;
				continue;
			}
			if (current) {
				var item = G.items[current.name] || { skin: "test", name: phrase.html("interface.item.unrecognized") },
					skin = current.skin || item.skin;
				if (current.expires) skin = item.skin_a;
				if (current.name == "placeholder") {
					var rid = randomStr(8);
					var name = (current.p && current.p.name) || "placeholder_m";
					html = item_container({
						shade: G.items[name].skin,
						onclick: "inventory_click(" + last + ",event)",
						onmousedown: "inventory_middle(" + last + ",event)",
						def: item,
						id: id,
						cid: cc_id,
						draggable: false,
						num: last,
						cnum: last,
						s_op: 0.5,
						bcolor: "gray ",
						loader: "qplc" + rid,
						level: (current.p && current.p.level) || undefined,
						iname: name,
					});
					rids[last] = rid;
				} else {
					html = item_container(
						{ skin: skin, onclick: "inventory_click(" + last + ",event)", onmousedown: "inventory_middle(" + last + ",event)", def: item, id: id, cid: cc_id, draggable: true, num: last, cnum: last },
						current,
					);
				}
			} else {
				html = item_container({ size: 40, draggable: true, cnum: last, cid: cc_id });
			}
			$("#ccitem" + last).replaceWith(html);
			last++;
		}
	}
	$(".cashnum").html(to_pretty_num(character.cash || 0));
	$(".goldnum").html(to_pretty_num(character.gold));
	cache_i = character.items.slice();
	["upgrade", "compound", "exchange"].forEach(function (e) {
		if (character.q[e] && rids[character.q[e].num]) {
			$(".loaderqplc" + rids[character.q[e].num]).css("opacity", 0.4);
			add_tint(".loaderqplc" + rids[character.q[e].num], { ms: character.q[e].ms, start: future_ms(character.q[e].ms - character.q[e].len), type: "progress" });
		}
	});
}

function render_inventory(reset) {
	var character = is_comm ? observing : window.character;
	var last = 0,
		right_style = "text-align: right",
		rids = [];
	if (!is_comm && inventory && !reset) {
		$("#bottomleftcorner").html("");
		/*$("#theinventory").remove();*/ inventory = false;
		return;
	} else if (reset && !inventory) reset = false;
	if (!character) return;
	if (!reset) unread_chat = 0;
	if (!reset) inventory_opened_for = null;
	var html = "",
		columns = 7;
	if (is_comm) {
		columns = Math.max(1, Math.min(7, Math.floor((viewport_width() - 44) / 54)));
		comm_items.inventory = character.items.slice();
	}
	// Overflow can add or remove rows; updating existing slots cannot resize the grid.
	if (!is_comm && reset && $(".theinventory [data-cnum]").length == Math.ceil(max(character.isize, character.items.length) / columns) * columns) return update_inventory();
	if (!reset && !is_comm)
		html +=
			"<div style='background-color: black; border: 5px solid gray; margin-bottom: -5px; padding: 2px 16px 2px 16px; font-size: 24px; vertical-align: bottom; display: none; color: #FCB136' class='newchatui clickable' onclick='stpr(event); render_inventory()'>" +
			phrase.html("interface.inventory.12_new_chat_messages") +
			"</div><div></div>";
	html += "<div style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; display: inline-block; vertical-align: bottom' class='dcontain theinventory'>";
	html +=
		"<button type='button' class='gamebutton ui-close ui-close-word inventory-close' title='" +
		phrase.html("interface.inventory.close_inventory") +
		"' aria-label='" +
		phrase.html("interface.inventory.close_inventory") +
		"' onpointerdown='stpr(event)' onclick='btc(event); " +
		(is_comm ? "hide_modal()" : "render_inventory()") +
		"'><span aria-hidden='true'>" +
		phrase.html("interface.inventory.close") +
		"</span></button>";
	if (is_comm) html += "<div style='padding: 4px'>" + comm_chat_escape(character.name) + "</div>";
	if (c_enabled) {
		if (is_comm) {
			html += "<div style='padding: 4px; display: inline-block;'>"; // '
			html +=
				"<span class='cbold' style='color: " +
				colors.cash +
				"'>" +
				phrase.html("interface.inventory.shells") +
				"</span>: <span class='cashnum'>" +
				to_pretty_num(character.cash || 0) +
				"</span></div>";
			right_style = " display: inline-block; float: right";
		} else if (is_tauri) {
			html += "<div style='padding: 4px; display: inline-block' class='clickable' onclick='pcs(event); shells_click()'>"; // '
			html +=
				"<span class='cbold' style='color: " +
				colors.cash +
				"'>" +
				phrase.html("interface.inventory.shells") +
				"</span>: <span class='cashnum'>" +
				to_pretty_num(character.cash || 0) +
				"</span></div>";
			right_style = " display: inline-block; float: right";
		} else if (is_electron) {
			html += "<div style='padding: 4px; display: inline-block' class='clickable' onclick='pcs(event); show_shells_info()'>"; // '
			html +=
				"<span class='cbold' style='color: " +
				colors.cash +
				"'>" +
				phrase.html("interface.inventory.shells") +
				"</span>: <span class='cashnum'>" +
				to_pretty_num(character.cash || 0) +
				"</span></div>";
			right_style = " display: inline-block; float: right";
		} else {
			html += "<div style='padding: 4px; display: inline-block' class='clickable'>"; // onclick='shells_click()'
			html +=
				"<a href='https://adventure.land/shells' class='cancela' target='_blank'><span class='cbold' style='color: " +
				colors.cash +
				"'>" +
				phrase.html("interface.inventory.shells") +
				"</span>: <span class='cashnum'>" +
				to_pretty_num(character.cash || 0) +
				"</span></a></div>";
			right_style = " display: inline-block; float: right";
		}
	}
	html +=
		"<div style='padding: 4px;" +
		right_style +
		"'><span class='cbold' style='color: gold'>" +
		phrase.html("interface.inventory.gold") +
		"</span>: <span class='goldnum'>" +
		to_pretty_num(character.gold) +
		"</span></div>";
	html += "<div style='border-bottom: 5px solid gray; margin-bottom: 2px; margin-left: -5px; margin-right: -5px'></div>";
	for (var i = 0; i < Math.ceil(max(character.isize, character.items.length) / columns); i++) {
		html += is_comm ? "<div style='white-space: nowrap'>" : "<div>";
		for (var j = 0; j < columns; j++) {
			var current = null,
				id = "citem" + last,
				cc_id = "c" + id;
			if (last < character.items.length) current = character.items[last];
			if (current) {
				var item = G.items[current.name] || { skin: "test", name: phrase.html("interface.item.unrecognized") },
					skin = current.skin || item.skin;
				if (current.expires) skin = item.skin_a;
				if (current.name == "placeholder") {
					var rid = randomStr(8);
					var name = (current.p && current.p.name) || "placeholder_m";
					html += item_container({
						shade: G.items[name].skin,
						onclick: is_comm ? undefined : "inventory_click(" + last + ",event)",
						onmousedown: is_comm ? undefined : "inventory_middle(" + last + ",event)",
						def: item,
						id: id,
						cid: cc_id,
						draggable: false,
						num: last,
						cnum: last,
						s_op: 0.5,
						bcolor: "gray ",
						loader: "qplc" + rid,
						level: (current.p && current.p.level) || undefined,
						iname: name,
					});
					rids[last] = rid;
				} else {
					html += item_container(
						{
							skin: skin,
							onclick: is_comm ? "comm_item_click('inventory'," + last + ")" : "inventory_click(" + last + ",event)",
							onmousedown: is_comm ? undefined : "inventory_middle(" + last + ",event)",
							def: item,
							id: id,
							cid: cc_id,
							draggable: !is_comm,
							num: is_comm ? undefined : last,
							cnum: last,
						},
						current,
					);
				}
			} else {
				html += item_container({ size: 40, draggable: !is_comm, cnum: last, cid: cc_id });
			}
			last++;
		}
		html += "</div>";
	}
	html += "</div>";
	cache_i = character.items.slice();
	if (is_comm) return show_modal(html, { wrap: false, hideinbackground: true });
	inventory = true;
	if (!reset) {
		html += "<div class='inventory-item' style='display: inline-block; vertical-align: top; margin-left: 5px'></div>";
		$("#bottomleftcorner").html(html);
	} else {
		$(".theinventory").replaceWith(html);
	}
	tut("inventory");
	["upgrade", "compound", "exchange"].forEach(function (e) {
		if (character.q[e] && rids[character.q[e].num]) {
			$(".loaderqplc" + rids[character.q[e].num]).css("opacity", 0.4);
			add_tint(".loaderqplc" + rids[character.q[e].num], { ms: character.q[e].ms, start: future_ms(character.q[e].ms - character.q[e].len), type: "progress" });
		}
	});
}

function render_craftsman() {
	tut("craftsman");
	tut("visitnpc");
	var shade = "stick",
		button = phrase.html("interface.craftsman.craft");
	reset_inventory(1);
	topleft_npc = "craftsman";
	rendered_target = topleft_npc;
	((cr_items = e_array(9)), (cr_last = 0));
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	/*html+="<div class='ering ering1 mb10'>";
			html+="<div class='ering ering2'>";
				html+="<div class='ering ering3'>";
					//html+="<div class='ering ering4'>";*/
	html += "<div>";
	html += item_container({ shade: shade, cid: "critem0", s_op: 0.36, draggable: false, droppable: true });
	html += item_container({ shade: shade, cid: "critem1", s_op: 0.36, draggable: false, droppable: true });
	html += item_container({ shade: shade, cid: "critem2", s_op: 0.36, draggable: false, droppable: true });
	html += "</div>";
	html += "<div>";
	html += item_container({ shade: shade, cid: "critem3", s_op: 0.36, draggable: false, droppable: true });
	html += item_container({ shade: shade, cid: "critem4", s_op: 0.36, draggable: false, droppable: true });
	html += item_container({ shade: shade, cid: "critem5", s_op: 0.36, draggable: false, droppable: true });
	html += "</div>";
	html += "<div class='mb5'>";
	html += item_container({ shade: shade, cid: "critem6", s_op: 0.36, draggable: false, droppable: true });
	html += item_container({ shade: shade, cid: "critem7", s_op: 0.36, draggable: false, droppable: true });
	html += item_container({ shade: shade, cid: "critem8", s_op: 0.36, draggable: false, droppable: true });
	html += "</div>";
	//html+="</div>";
	/*html+="</div>";
			html+="</div>";
		html+="</div>";*/
	html +=
		"<div><div class='gamebutton clickable' onclick='draw_trigger(function(){ render_craftsman(); reset_inventory(); });'>" +
		phrase.html("interface.craftsman.reset") +
		"</div> <div class='gamebutton clickable' onclick='craft()'>" +
		button +
		"</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function render_anniversary_baker(service) {
	if (no_html || !character || !G.npcs.anniversary_baker) return;
	if (service == "combine") {
		render_recipes("anniversary_baker", "sixcake");
		render_recipe(true, "anniversary_baker", "sixcake");
		return;
	}
	if (service == "gifts") return render_recipes("anniversary_baker");
	var npc = G.npcs.anniversary_baker;
	if (service == "exchange")
		return render_interaction({
			auto: true,
			skin: npc.skin,
			cx: clone(npc.cx || {}),
			cosmetic_head_y: npc.cosmetic_head_y,
			message: phrase.html("interface.anniversary_baker.cakes_are_for_crafting_here_or_exchanging_with_xyn_he"),
			button: phrase.html("interface.anniversary_baker.find_xyn"),
			onclick: function () {
				call_code_function_f("smart_move", "exchange");
			},
			button2: phrase.html("interface.anniversary_baker.back"),
			onclick2: function () {
				render_anniversary_baker();
			},
		});
	render_interaction({
		auto: true,
		skin: npc.skin,
		cx: clone(npc.cx || {}),
		cosmetic_head_y: npc.cosmetic_head_y,
		message:
			phrase.html("interface.anniversary_baker.welcome_i_combine_cake_slices_and_craft_anniversary_gifts_what") +
			"<span style='float:right;margin-top:5px'><div class='slimbutton' onclick='render_anniversary_baker(\"combine\")'>" +
			phrase.html("interface.anniversary_baker.cake") +
			"</div> <div class='slimbutton' onclick='render_anniversary_baker(\"exchange\")'>" +
			phrase.html("interface.anniversary_baker.exchange") +
			"</div> <div class='slimbutton' onclick='render_anniversary_baker(\"gifts\")'>" +
			phrase.html("interface.anniversary_baker.craft") +
			"</div> <div class='slimbutton' onclick='open_interaction_guide(\"anniversary\")'>" +
			phrase.html("interface.anniversary_baker.info") +
			"</div></span>",
	});
}

function render_dismantler() {
	var shade = "fclaw",
		button = phrase.html("interface.dismantler.dismantle");
	reset_inventory(1);
	topleft_npc = "dismantler";
	rendered_target = topleft_npc;
	ds_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	/*html+="<div class='ering ering1 mb10'>";
			html+="<div class='ering ering2'>";
				html+="<div class='ering ering3'>";
					//html+="<div class='ering ering4'>";*/
	html += "<div>";
	html += item_container({ shade: shade, cid: "dsitem", s_op: 0.36, draggable: false, droppable: true });
	html += "</div>";
	//html+="</div>";
	/*html+="</div>";
			html+="</div>";
		html+="</div>";*/
	html += "<div style='margin-top: 12px'><div class='gamebutton clickable' onclick='dismantle()'>" + button + "</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

var last_lmode = "lock";
function render_locksmith(mode) {
	if (!mode) mode = last_lmode;
	last_lmode = mode;
	var button = phrase.html("interface.locksmith.lock"),
		f = "lock_item",
		shade = "shade_seal";
	if (mode == "unlock") ((button = phrase.html("interface.locksmith.unlock")), (f = "unlock_item"), (shade = "shade_unlock"));
	if (mode == "seal") ((button = phrase.html("interface.locksmith.seal")), (f = "seal_item"), (shade = "shade_lock"));
	reset_inventory(1);
	topleft_npc = "locksmith";
	rendered_target = topleft_npc;
	l_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	/*html+="<div class='ering ering1 mb10'>";
			html+="<div class='ering ering2'>";
				html+="<div class='ering ering3'>";
					//html+="<div class='ering ering4'>";*/
	html += "<div>";
	html += item_container({ shade: shade, cid: "litem", s_op: 0.4, draggable: false, droppable: true });
	html += "</div>";
	//html+="</div>";
	/*html+="</div>";
			html+="</div>";
		html+="</div>";*/
	html += "<div style='margin-top: 12px'><div class='gamebutton clickable' onclick='" + f + "()'>" + button + "</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function render_scrollsmith() {
	var button = phrase.html("interface.scrollsmith.de_stat"),
		f = "destat_item",
		shade = "shade_chest";
	reset_inventory(1);
	topleft_npc = "scrollsmith";
	rendered_target = topleft_npc;
	s_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	/*html+="<div class='ering ering1 mb10'>";
			html+="<div class='ering ering2'>";
				html+="<div class='ering ering3'>";
					//html+="<div class='ering ering4'>";*/
	html += "<div>";
	html += item_container({ shade: shade, cid: "sitem", s_op: 0.4, draggable: false, droppable: true });
	html += "</div>";
	//html+="</div>";
	/*html+="</div>";
			html+="</div>";
		html+="</div>";*/
	html += "<div style='margin-top: 12px'><div class='gamebutton clickable' onclick='" + f + "()'>" + button + "</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function render_recipe(element, type, name) {
	tut("recipes");
	last_selector = "#recipe-item";
	var html;
	if (type != "dismantle") {
		var output = G.craft[name].output || { name: name };
		html = render_item("html", { item: G.items[output.name], actual: output, name: output.name, craft: true, recipe: name });
	} else {
		html = render_item("html", { item: G.items[name], name: name, dismantle: true });
	}
	if (element) render_ui_panel("#recipe-item", html);
	else show_modal(html, { wrap: false, hideinbackground: true });
}

var r_page = {};
function render_recipes(type, only) {
	tut("recipes");
	if (!type) type = "";
	reset_inventory(1);
	topleft_npc = "recipes";
	rendered_target = topleft_npc;
	var last = 0,
		items = [];
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; display: inline-block'>";
	if (type == "dismantle") {
		object_sort(G.dismantle, "gold_value").forEach(function (e) {
			items.push(e[0]);
		});
	} else {
		object_sort(G.craft, "gold_value").forEach(function (e) {
			if ((e[1].quest || "") != type || (only && e[0] != only)) return;
			items.push(e[0]);
		});
	}
	r_page[type] = r_page[type] || 0;
	if (only) r_page[type] = 0;
	if (r_page[type] >= 1) last += 19 + (r_page[type] - 1) * 18;
	for (var i = 0; i < 4; i++) {
		html += "<div>";
		for (var j = 0; j < 5; j++) {
			if (i == 3 && j == 0 && r_page[type] != 0)
				html += item_container({ skin: "left", onclick: "r_page['" + type + "']=" + (r_page[type] - 1) + "; render_recipes('" + type + "');" }, { q: r_page[type], left: true });
			else if (i == 3 && j == 4 && last < items.length - 1)
				html += item_container({ skin: "right", onclick: "r_page['" + type + "']=" + (r_page[type] + 1) + "; render_recipes('" + type + "');" }, { q: r_page[type] + 2 });
			else if (last < items.length && items[last++]) {
				var current = items[last - 1];
				var id = "item" + randomStr(10),
					output = (type != "dismantle" && G.craft[current].output) || { name: current },
					item = G.items[output.name];
				html += item_container({ skin: item.skin_a || item.skin, def: item, id: id, draggable: false, onclick: "render_recipe(this,'" + type + "','" + current + "')" }, output);
			} else {
				html += item_container({ size: 40, draggable: false, droppable: true });
			}
		}
		html += "</div>";
	}
	html += "</div>";
	html +=
		"<div id='recipe-item' class='rendercontainer' style='display: inline-block; vertical-align: top; margin-left: 5px'>" +
		((next_side_interaction && render_interaction(next_side_interaction, "return_html")) || " ") +
		"</div>";
	next_side_interaction = null;
	render_ui_panel("#topleftcornerui", html);
}

function render_recipes_old(quest) {
	if (quest == "anniversary_baker") return render_anniversary_baker("gifts");
	topleft_npc = "recipes";
	rendered_target = topleft_npc;
	i = 0;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div class='clickable' onclick='render_craftsman()'>" + phrase.html("interface.recipes_old.craft") + "</div>";
	object_sort(G.craft).forEach(function (io) {
		if (io[1].quest != quest) return;
		var name = io[0];
		html += item_container({ skin: G.items[name].skin, onclick: "render_recipe(null,'craft','" + name + "')" }, { name: name });
		i += 1;
		if (!(i % 6)) html += "<div></div>";
	});
	html += "<div class='clickable' onclick='render_dismantler()'>" + phrase.html("interface.recipes_old.dismantle") + "</div>";
	i = 0;
	object_sort(G.dismantle).forEach(function (io) {
		if (io[1].quest != quest) return;
		var name = io[0];
		html += item_container({ skin: G.items[name].skin, onclick: "render_recipe(null,'dismantle','" + name + "')" }, { name: name });
		i += 1;
		if (!(i % 6)) html += "<div></div>";
	});
	html += "</div><div id='recipe-item' style='display: inline-block; vertical-align: top; margin-left: 5px'></div>";
	render_ui_panel("#topleftcornerui", html);
}

function render_exchange_shrine(type) {
	tut("exchanger");
	tut("visitnpc");
	var shade = "shade_exchange",
		button = phrase.html("interface.exchange_shrine.exchange");
	var originals = [e_item];
	reset_inventory(1);
	topleft_npc = "exchange";
	rendered_target = topleft_npc;
	exchange_type = type;
	if (type == "leather") ((shade = "leather"), (button = phrase.html("interface.exchange_shrine.give")));
	if (type == "lostearring") ((shade = "lostearring"), (button = phrase.html("interface.exchange_shrine.provide")));
	if (type == "mistletoe") ((shade = "mistletoe"), (button = phrase.html("interface.exchange_shrine.give_it")));
	if (type == "candycane") ((shade = "candycane"), (button = phrase.html("interface.exchange_shrine.feed")));
	if (type == "ornament") ((shade = "ornament"), (button = phrase.html("interface.exchange_shrine.give")));
	if (type == "seashell") ((shade = "seashell"), (button = phrase.html("interface.exchange_shrine.give")));
	if (type == "gemfragment") ((shade = "gemfragment"), (button = phrase.html("interface.exchange_shrine.provide")));
	if (type == "cx") ((shade = "cosmo0"), (button = phrase.html("interface.exchange_shrine.shazam")));
	e_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div class='ering ering1 mb10'>";
	html += "<div class='ering ering2'>";
	html += "<div class='ering ering3'>";
	//html+="<div class='ering ering4'>";
	if (character.q.exchange) {
		var level = character.q.exchange.s || 0;
		var name = character.q.exchange.name;
		var q = undefined;
		if (character.q.exchange.q > 1) q = character.q.exchange.q;
		html += item_container({ cid: "eitem", draggable: false, droppable: false, skin: G.items[name].skin }, { name: name, level: level, q: q });
	} else html += item_container({ shade: shade, cid: "eitem", s_op: 0.5, draggable: false, droppable: true });
	//html+="</div>";
	html += "</div>";
	html += "</div>";
	html += "</div>";
	html += "<div><div class='gamebutton clickable' onclick='exchange()'>" + button + "</div></div>";
	html += "</div>";
	html += "<div id='exc-ui' class='rendercontainer' style='display: inline-block; vertical-align: top; margin-left: 5px'>" + "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	return (!character.q.exchange && originals) || [];
}

function render_pet_shrine() {
	var button = phrase.html("interface.pet_shrine.release");
	var originals = [e_item];
	reset_inventory(1);
	e_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div class='ering ering1 mb10'>";
	html += "<div class='ering ering2'>";
	html += "<div class='ering ering3'>";
	//html+="<div class='ering ering4'>";
	if (character.q.exchange) {
		var level = character.q.exchange.s || 0;
		var name = character.q.exchange.name;
		var q = undefined;
		if (character.q.exchange.q > 1) q = character.q.exchange.q;
		html += item_container({ cid: "eitem", draggable: false, droppable: false, skin: G.items[name].skin }, { name: name, level: level, q: q });
	} else {
		html += item_container({ shade: "pball", cid: "eitem", s_op: 0.5, draggable: false, droppable: true });
		html += item_container({ shade: "chry", cid: "eitem", s_op: 0.5, draggable: false, droppable: true });
	}
	//html+="</div>";
	html += "</div>";
	html += "</div>";
	html += "</div>";
	html += "<div><div class='gamebutton clickable' onclick='exchange()'>" + phrase.html("interface.pet_shrine.release") + "</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	return (!character.q.exchange && originals) || [];
}

function render_none_shrine(type) {
	var shade = "cape0",
		button = phrase.html("interface.none_shrine.poof");
	reset_inventory(1);
	topleft_npc = "none";
	rendered_target = topleft_npc;
	p_item = null;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div class='ering ering1 mb10'>";
	html += "<div class='ering ering2'>";
	html += "<div class='ering ering3'>";
	//html+="<div class='ering ering4'>";
	html += item_container({ shade: shade, cid: "pitem", s_op: 0.5, draggable: false, droppable: true });
	//html+="</div>";
	html += "</div>";
	html += "</div>";
	html += "</div>";
	html += "<div><div class='gamebutton clickable' onclick='poof()'>" + button + "</div></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function render_shells_buyer() {
	topleft_npc = "buyshells";
	rendered_target = topleft_npc;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top; text-align: left'>",
		prefix = "";
	html +=
		"<div><span style='color: #5DAC40'>10</span>" +
		" " +
		phrase.html("interface.shells_buyer.shells") +
		" " +
		"<span style='color: gold'>1,500,000</span> <span style='color: #71AF83' class='clickable' onclick='buy_shells(10)'>" +
		phrase.html("interface.shells_buyer.buy") +
		"</span></div>";
	html +=
		"<div><span style='color: #5DAC40'>100</span>" +
		" " +
		phrase.html("interface.shells_buyer.shells") +
		" " +
		"<span style='color: gold'>15,000,000</span> <span style='color: #71AF83' class='clickable' onclick='buy_shells(100)'>" +
		phrase.html("interface.shells_buyer.buy") +
		"</span></div>";
	html +=
		"<div><span style='color: #5DAC40'>500</span>" +
		" " +
		phrase.html("interface.shells_buyer.shells") +
		" " +
		"<span style='color: gold'>75,000,000</span> <span style='color: #71AF83' class='clickable' onclick='buy_shells(500)'>" +
		phrase.html("interface.shells_buyer.buy") +
		"</span></div>";
	html +=
		"<div><span style='color: #5DAC40'>1,000</span>" +
		" " +
		phrase.html("interface.shells_buyer.shells") +
		" " +
		"<span style='color: gold'>150,000,000</span> <span style='color: #71AF83' class='clickable' onclick='buy_shells(1000)'>" +
		phrase.html("interface.shells_buyer.buy") +
		"</span></div>";
	if (!is_electron && !is_tauri)
		prefix =
			"<a href='https://adventure.land/shells' class='cancela' target='_blank'><span class='clickable' onclick='rendered_target=null;' style='color: #359ECF'>" +
			phrase.html("interface.shells_buyer.buy_with") +
			"</span></a> | ";
	html += "<div>" + prefix + "<span class='clickable' onclick='topleft_npc=false;' style='color: #555556'>" + phrase.html("interface.shells_buyer.nope") + "</span></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function render_upgrade_shrine(explicit) {
	reset_inventory(1);
	var originals = [u_item, u_scroll, u_offering],
		already = topleft_npc == "upgrade";
	topleft_npc = "upgrade";
	rendered_target = topleft_npc;
	((u_item = null), (u_scroll = null), (u_offering = null));
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top'>",
		rid = randomStr(6),
		core = "";
	html += "<div class='mb5' align='center' id='core'>";
	if (character.q.upgrade && character.items[character.q.upgrade.num] && character.items[character.q.upgrade.num].name == "placeholder") {
		var def = character.items[character.q.upgrade.num].p;
		core += "<div>";
		core += item_container({ skin: G.items[def.name].skin, pui: def }, { name: def.name, level: def.level });
		core += "</div>";
		core += "<div>";
		if (def.offering) core += item_container({ skin: G.items[def.offering].skin, loader: !def.scroll && "theuitem" + rid }, { name: def.offering });
		else core += item_container({ shade: "shade_offering", s_op: 0.36 });
		if (def.scroll) core += item_container({ skin: G.items[def.scroll].skin, loader: "theuitem" + rid }, { name: def.scroll });
		else core += item_container({ draggable: false, droppable: true, shade: "shade_scroll", cid: "uscroll", s_op: 0.36 });
		core += "</div>";
	} else {
		core += "<div>";
		core += item_container({ draggable: false, droppable: true, shade: "shade_uweapon", cid: "uweapon", s_op: 0.36, pui: true });
		core += "</div>";
		core += "<div>";
		core += item_container({ draggable: false, droppable: true, shade: "shade_offering", cid: "uoffering", s_op: 0.36 }); // previously 0.24
		core += item_container({ draggable: false, droppable: true, shade: "shade_scroll", cid: "uscroll", s_op: 0.36 });
		core += "</div>";
	}
	html += core;
	html += "</div>";
	html += "<div class='gamebutton clickable' onclick='draw_trigger(function(){ render_upgrade_shrine(1); reset_inventory(); });'>" + phrase.html("interface.upgrade_shrine.reset") + "</div>";
	html += "<div class='gamebutton clickable ml5' onclick='upgrade(u_item,u_scroll,u_offering);'>" + phrase.html("interface.upgrade_shrine.upgrade") + "</div>";
	html += "</div>";
	if (already) $("#core").html(core);
	else render_ui_panel("#topleftcornerui", html);
	if (character.q.upgrade) {
		$(".loadertheuitem" + rid).css("opacity", 0.8);
		add_tint(".loadertheuitem" + rid, { ms: character.q.upgrade.ms, start: future_ms(character.q.upgrade.ms - character.q.upgrade.len), type: "progress", upgrade: true });
	}
	if (!inventory && explicit) (render_inventory(), (inventory_opened_for = topleft_npc));
	return (!character.q.upgrade && originals) || [];
}

function render_compound_shrine(explicit) {
	reset_inventory(1);
	var originals = [c_items[0], c_items[1], c_items[2], c_scroll, c_offering],
		already = topleft_npc == "compound";
	topleft_npc = "compound";
	rendered_target = topleft_npc;
	((c_items = e_array(3)), (c_scroll = null), (c_offering = null));
	c_last = 0;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top'>",
		rid = randomStr(6),
		core = "";
	html += "<div class='mb5' align='center'>";
	html += "<div align='left' style='display: inline-block' id='core'>"; // for pui:true [13/06/19]
	if (character.q.compound && character.items[character.q.compound.num] && character.items[character.q.compound.num].name == "placeholder") {
		var def = character.items[character.q.compound.num].p;
		core += "<div>";
		core += item_container({ skin: G.items[def.name].skin }, { name: def.name, level: def.level });
		core += item_container({ skin: G.items[def.name].skin }, { name: def.name, level: def.level });
		core += item_container({ skin: G.items[def.name].skin }, { name: def.name, level: def.level });
		core += "</div>";
		core += "<div>";
		if (def.offering) core += item_container({ skin: G.items[def.offering].skin }, { name: def.offering });
		else core += item_container({ shade: "shade_offering", s_op: 0.36 });
		core += item_container({ skin: G.items[def.scroll].skin, pui: def, loader: "theuitem" + rid }, { name: def.scroll });
		core += "</div>";
	} else {
		core += "<div>";
		core += item_container({ draggable: false, droppable: true, shade: "shade_cring", cid: "compound0", s_op: 0.36 });
		core += item_container({ draggable: false, droppable: true, shade: "shade_cring", cid: "compound1", s_op: 0.36 });
		core += item_container({ draggable: false, droppable: true, shade: "shade_cring", cid: "compound2", s_op: 0.36 });
		core += "</div>";
		core += "<div>";
		core += item_container({ draggable: false, droppable: true, shade: "shade_offering", cid: "coffering", s_op: 0.36 });
		core += item_container({ draggable: false, droppable: true, shade: "shade_cscroll", cid: "cscroll", s_op: 0.36, pui: true });
		core += "</div>";
	}
	html += core;
	html += "</div>";
	html += "</div>";
	html += "<div class='gamebutton clickable' onclick='draw_trigger(function(){ render_compound_shrine(1); reset_inventory(); });'>" + phrase.html("interface.compound_shrine.reset") + "</div>";
	html += "<div class='gamebutton clickable ml5' onclick=' compound(c_items[0],c_items[1],c_items[2],c_scroll,c_offering);'>" + phrase.html("interface.compound_shrine.combine") + "</div>";
	html += "</div>";
	if (already) $("#core").html(core);
	else render_ui_panel("#topleftcornerui", html);
	if (character.q.compound) {
		$(".loadertheuitem" + rid).css("opacity", 0.8);
		add_tint(".loadertheuitem" + rid, { ms: character.q.compound.ms, start: future_ms(character.q.compound.ms - character.q.compound.len), type: "progress", compound: true });
	}
	if (!inventory && explicit) (render_inventory(), (inventory_opened_for = topleft_npc));
	return (!character.q.compound && originals) || [];
}

var dice_bet = { active: false, dir: 1 };
function on_dice_change() {
	if (topleft_npc != "dice") return;
	var num = min(99.99, max(0, parseFloat($(".dicenum").html()))),
		mult;
	var gold = parseInt($(".dicegold").html().replace_all(",", ""));
	if (!gold) gold = 100000;
	gold = max(10000, gold);
	$(".dicegold").html(to_pretty_num(gold));
	dice_bet.gold = gold;
	var hnum = num.toFixed(2);
	if (hnum.length != 5) hnum = "0" + hnum;
	$(".dicenum").html(hnum);
	dice_bet.num = hnum;
	num = parseFloat(hnum);
	if (dice_bet.dir == 1) {
		mult = 100.0 / (100.0 - num);
		$(".diceup").css("border-color", "#A7C16D");
		$(".dicedown").css("border-color", "gray");
	} else {
		mult = 100.0 / num;
		$(".diceup").css("border-color", "gray");
		$(".dicedown").css("border-color", "#A7C16D");
	}
	mult = min(mult, 10000);
	$(".dicexx").html(phrase.html("interface.on_dice_change.for_x", { value: to_pretty_float(mult) }));
	if (dice_bet.active) $(".diceb").css("border-color", "gold");
	else $(".diceb").css("border-color", "gray");
}

function on_dice_bet() {
	var num = min(99.99, max(0, parseFloat($(".dicenum").html())));
	var gold = parseInt($(".dicegold").html().replace_all(",", ""));
	dice(dice_bet.dir, num, gold);
}

function render_dice() {
	var num = dice_bet.num || "50.00";
	var gold = dice_bet.gold || 100000;
	reset_inventory(1);
	topleft_npc = "dice";
	rendered_target = topleft_npc;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 32px; display: inline-block; vertical-align: top'>";
	html += "<div class='mb5' align='center'>";
	html +=
		"<div><span class='gray clickable' onclick='$(\".dicenum\").cfocus()'>" +
		phrase.html("interface.dice.number") +
		"</span> <div class='inline-block dicenum' contenteditable=true onblur='on_dice_change()'>" +
		num +
		"</div></div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html +=
		"<div><span class='gold clickable' onclick='$(\".dicegold\").cfocus()'>" +
		phrase.html("interface.dice.gold") +
		"</span> <div class='inline-block dicegold' contenteditable=true onblur='on_dice_change()'>" +
		to_pretty_num(gold) +
		"</div></div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html += "<div class='gamebutton clickable diceup' onclick='dice_bet.dir=1; on_dice_change()' style='width: 64px;'>" + phrase.html("interface.dice.up") + "</div>";
	html += "<div class='gamebutton clickable ml5 dicedown' onclick='dice_bet.dir=2; on_dice_change()' style='width: 64px'>" + phrase.html("interface.dice.down") + "</div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html +=
		"<div class='gamebutton clickable diceb' onclick='on_dice_bet()' style='width: 200px;'>" +
		phrase.html("interface.dice.bet") +
		" " +
		"<span class='gray dicexx'>" +
		phrase.html("interface.dice.for_2x") +
		"</span></div>";
	html += "</div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	on_dice_change();
}

function render_tavern_info(data) {
	topleft_npc = "info";
	rendered_target = topleft_npc;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 32px; display: inline-block; vertical-align: top'>";
	html += "<div class='mb5' align='center'>";
	html += "<div><span class='gray'>" + phrase.html("interface.tavern_info.house_edge") + "</span></div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html += "<div><span>" + data.edge.toFixed(2) + "%</span></div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html += "<div><span class='gray'>" + phrase.html("interface.tavern_info.max_net_win") + "</span></div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html += "<div><span class='gold'>" + to_pretty_num(data.max) + "</span></div>";
	html += "</div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
}

function on_donate_change() {
	if (topleft_npc != "donate") return;
	var gold = parseInt($(".dgold").html().replace_all(",", ""));
	if (!gold) gold = 100000;
	gold = max(1, gold);
	$(".dgold").html(to_pretty_num(gold));
	dice_bet.gold = gold;
}

function render_donate() {
	var gold = 10000000;
	reset_inventory(1);
	topleft_npc = "donate";
	rendered_target = topleft_npc;
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 32px; display: inline-block; vertical-align: top'>";
	html += "<div class='mb5' align='center'>";
	html +=
		"<div><span class='gold clickable' onclick='$(\".dgold\").cfocus()'>" +
		phrase.html("interface.donate.gold") +
		"</span> <div class='inline-block dgold' contenteditable=true onblur='on_donate_change()'>" +
		to_pretty_num(gold) +
		"</div></div>";
	html += "</div>";
	html += "<div class='mb5' align='center'>";
	html += "<div class='gamebutton clickable diceb' onclick='donate()' style='width: 160px; margin-top: 20px'>" + phrase.html("interface.donate.donate") + "</div>";
	html += "</div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	on_donate_change();
}

function render_merchant(npc, premium) {
	tut("visitshop");
	tut("visitnpc");
	reset_inventory(1);
	topleft_npc = "merchant";
	rendered_target = topleft_npc;
	merchant_id = npc.id;
	var last = 0,
		collection = [];
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; display: inline-block'>",
		f = "buy_with_gold";
	if (premium) f = "buy_with_shells";
	for (var i = 0; i < 4; i++) {
		html += "<div>";
		for (var j = 0; j < 5; j++) {
			if (last < npc.items.length && npc.items[last++] && (c_enabled || !G.items[npc.items[last - 1]].cash)) {
				var current = npc.items[last - 1];
				var id = "item" + randomStr(10),
					item = G.items[current];
				html += item_container({ skin: item.skin_a || item.skin, def: item, id: id, draggable: false, on_rclick: f + "('" + current + "')" });
				if (premium) collection.push({ id: id, item: item, name: current, value: item.g, cash: item.cash });
				else if (item.cash) collection.push({ id: id, item: item, name: current, value: item.g * G.inflation });
				else collection.push({ id: id, item: item, name: current, value: item.g });
			} else {
				html += item_container({ size: 40, draggable: false, droppable: true });
			}
		}
		html += "</div>";
	}
	html += "</div>";
	html +=
		"<div id='merchant-item' class='rendercontainer' style='display: inline-block; vertical-align: top; margin-left: 5px'>" +
		((next_side_interaction && render_interaction(next_side_interaction, "return_html")) || " ") +
		"</div>";
	next_side_interaction = null;
	render_ui_panel("#topleftcornerui", html);
	for (var i = 0; i < collection.length; i++) {
		var entity = collection[i];
		function item_click(entity) {
			return function () {
				render_item("#merchant-item", entity);
			};
		}
		$("#" + entity.id)
			.on("click", item_click(entity))
			.addClass("clickable");
	}
}

var t_page = {};
function render_token_exchange(token) {
	reset_inventory(1);
	topleft_npc = "token_exchange";
	rendered_target = topleft_npc;
	var last = 0,
		collection = [],
		items = [token];
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; display: inline-block'>";
	object_sort(G.tokens[token], "value").forEach(function (e) {
		items.push(e[0]);
	});
	t_page[token] = t_page[token] || 0;
	if (t_page[token] >= 1) last += 19 + (t_page[token] - 1) * 18;
	for (var i = 0; i < 4; i++) {
		html += "<div>";
		for (var j = 0; j < 5; j++) {
			if (i == 3 && j == 0 && t_page[token] != 0)
				html += item_container({ skin: "left", onclick: "t_page['" + token + "']=" + (t_page[token] - 1) + "; render_token_exchange('" + token + "');" }, { q: t_page[token], left: true });
			else if (i == 3 && j == 4 && last < items.length - 1)
				html += item_container({ skin: "right", onclick: "t_page['" + token + "']=" + (t_page[token] + 1) + "; render_token_exchange('" + token + "');" }, { q: t_page[token] + 2 });
			else if (last < items.length && items[last++]) {
				var current = items[last - 1],
					data = undefined;
				if (current.search("-") != -1) {
					data = current.split("-")[1];
					current = current.split("-")[0];
				}
				var id = "item" + randomStr(10),
					item = G.items[current];
				html += item_container({ skin: item.skin_a || item.skin, def: item, id: id, draggable: false });
				collection.push({ id: id, item: item, name: current, token: token, key: items[last - 1], actual: { name: current, level: 0, q: 1, data: data } });
			} else {
				html += item_container({ size: 40, draggable: false, droppable: true });
			}
		}
		html += "</div>";
	}
	html += "</div>";
	html +=
		"<div id='merchant-item' class='rendercontainer' style='display: inline-block; vertical-align: top; margin-left: 5px'>" +
		((next_side_interaction && render_interaction(next_side_interaction, "return_html")) || " ") +
		"</div>";
	next_side_interaction = null;
	render_ui_panel("#topleftcornerui", html);
	for (var i = 0; i < collection.length; i++) {
		var entity = collection[i];
		function item_click(entity) {
			return function () {
				render_item("#merchant-item", entity);
			};
		}
		$("#" + entity.id)
			.on("click", item_click(entity))
			.addClass("clickable");
	}
}

function monster_x(name) {
	show_snippet('smart_move("' + name + '")');
}

function render_drop(def, mult, color, format) {
	var html = "";
	if (def[1] == "open") {
		var total = 0;
		G.drops[def[2]].forEach(function (d) {
			total += d[0];
		});
		G.drops[def[2]].forEach(function (d) {
			html += render_drop(d, (mult * def[0]) / total, color, format);
		});
		return html;
	}
	html += "<div dir='ltr' style='position: relative; white-space: nowrap;" + (def[1] == "cxbundle" ? " display: flex; flex-wrap: wrap; align-items: center;" : "") + "'>";
	var skin = "",
		actual = undefined;
	if (G.items[def[1]]) {
		skin = G.items[def[1]].skin;
		actual = { name: def[1], q: def[2], data: def[3] };
	} else if (def[1] == "empty") {
		html +=
			"<div style='z-index: 1; background-color:#575983; border: 2px solid #9F9FB0; position: absolute; top: -2px; left: -2px; color:#C5C7E0; font-size: 16px; display: inline-block; padding: 1px 1px 1px 3px;'>" +
			phrase.html("interface.drop.zilch") +
			"</div>";
	} else if (def[1] == "shells") {
		html +=
			"<div style='z-index: 1; background-color:#575983; border: 2px solid #9F9FB0; position: absolute; top: -2px; left: -2px; color:#8DE33B; font-size: 16px; display: inline-block; padding: 1px 1px 1px 3px;'>" +
			to_shrinked_num(def[2]) +
			"</div>";
		skin = "shells";
	} else if (def[1] == "gold") {
		html +=
			"<div style='z-index: 1; background-color:#575983; border: 2px solid #9F9FB0; position: absolute; top: -2px; left: -2px; color:gold; font-size: 16px; display: inline-block; padding: 1px 1px 1px 3px;'>" +
			to_shrinked_num(def[2]) +
			"</div>";
		skin = "gold";
	}
	if (def[1] == "cx") html += cx_sprite(def[2], { mright: 4 });
	else if (def[1] == "cxbundle") {
		G.cosmetics.bundle[def[2]].forEach(function (cid) {
			html += cx_sprite(cid, { mright: 4 });
		});
	} else html += "<span class='clickable' onclick='pcs(event); render_item_info(\"" + def[1] + '",0,"' + ((actual && actual.data) || "") + "\")'>" + item_container({ skin: skin }, actual) + "</span>";
	if (format === "percent")
		html +=
			"<div style='vertical-align: middle; display: inline-block; font-size: 24px; line-height: 50px; height: 50px; margin-left: 5px; margin-right: 8px'>" +
			to_pretty_float(def[0] * mult * 100) +
			"%</div>";
	else if (def[0] * mult >= 1)
		html +=
			"<div style='vertical-align: middle; display: inline-block; font-size: 24px; line-height: 50px; height: 50px; margin-left: 5px; margin-right: 8px'>" +
			to_pretty_float(def[0] * mult) +
			" / 1</div>";
	else if (1 / (def[0] * mult) >= 1.1 && 1 / (def[0] * mult) < 10 && parseInt(1 / (def[0] * mult)) * 10 != parseInt(10 / (def[0] * mult)))
		html +=
			"<div style='vertical-align: middle; display: inline-block; font-size: 24px; line-height: 50px; height: 50px; margin-left: 5px; margin-right: 8px'>10 / " +
			to_pretty_num(round(10 / (def[0] * mult))) +
			"</div>";
	else
		html +=
			"<div style='vertical-align: middle; display: inline-block; font-size: 24px; line-height: 50px; height: 50px; margin-left: 5px; margin-right: 8px'>1 / " +
			((1 / (def[0] * mult) >= 2 && to_pretty_num(round(1 / (def[0] * mult)))) || to_pretty_float(1 / (def[0] * mult))) +
			"</div>";
	html += "</div>";
	return html;
}

function smart_smart_move(type, id, position) {
	if (window.no_graphics || window.no_html) return;
	// A specific source can share its monster or NPC with other maps.
	// Keep the usual confirmation, but travel to the source the player chose.
	if (position) {
		var definitions = type == "npc" ? G.npcs : type == "monster" ? G.monsters : type == "map" ? G.maps : {}, destination = definitions[id];
		if (!destination || !G.maps[position.map] || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
		var point = { map: position.map, x: position.x, y: position.y };
		show_confirm(phrase.html("interface.travel.confirm", { destination: destination.name + " · " + G.maps[point.map].name }), phrase.html("interface.confirm.yes"), phrase.html("interface.close.cancel"), function () {
			hide_modals();
			call_code_function_f("smart_move", point);
		});
		return;
	}
	if (type == "npc") {
		var npc = G.npcs[id];
		show_confirm(phrase.html("interface.travel.confirm", { destination: npc.name }), phrase.html("interface.confirm.yes"), phrase.html("interface.close.cancel"), function () {
			hide_modals();
			if (id == "anniversary_baker") {
				var entry = (G.maps.main.seasonal_npcs || []).find(function (entry) {
					return entry.id == id;
				});
				if (entry) return call_code_function_f("smart_move", { map: "main", x: entry.position[0], y: entry.position[1] });
			}
			call_code_function_f("smart_move", id);
		});
	} else if (type == "monster") {
		var m = G.monsters[id];
		show_confirm(phrase.html("interface.travel.confirm_monster", { monster: m.name }), phrase.html("interface.confirm.yes"), phrase.html("interface.close.cancel"), function () {
			hide_modals();
			call_code_function_f("smart_move", id);
		});
	} else if (type == "map") {
		var m = G.maps[id];
		show_confirm(phrase.html("interface.travel.confirm", { destination: m.name }), phrase.html("interface.confirm.yes"), phrase.html("interface.close.cancel"), function () {
			hide_modals();
			call_code_function_f("smart_move", id);
		});
	}
}

function render_equip_info(name) {
	var def = G.items[name],
		html = "";
	html += "<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 360px;' class='buyitem'>";
	html +=
		"<div style='padding: 4px; margin: 4px; text-align: center; color: #CDCAB7'>" +
		phrase.definition("weapon_type", def.wtype || def.type, "name", (weapon_types[def.wtype] || offhand_types[def.type] || def.wtype || def.type).toTitleCase()) +
		"</div>";
	["ranger", "rogue", "warrior", "mage", "priest", "paladin", "merchant"].forEach(function (ctype) {
		var color = "#DDDDDD";
		if (window.character && character.ctype == ctype) color = "#36813A";
		else if (window.character) color = "#666870";
		if (G.classes[ctype].mainhand[def.wtype || def.type]) {
			html += "<div style='border: 2px dotted gray; padding: 14px; margin: 4px'>";
			html += "<div style='color:" + color + "'>" + phrase.html("interface.equip_info.mainhand", { value: phrase.definition("class", ctype, "name", ctype.toTitleCase()) }) + "</div>";
			var s = render_item("html", { item: {}, prop: G.classes[ctype].mainhand[def.wtype || def.type], pure: true });
			if (!s) html += "<div style='color: #788783'>" + phrase.html("interface.equip_info.no_modifier") + "</div>";
			else html += s;
			html += "</div>";
		}
		if (G.classes[ctype].doublehand[def.wtype || def.type]) {
			html += "<div style='border: 2px dotted gray; padding: 14px; margin: 4px'>";
			html += "<div style='color:" + color + "'>" + phrase.html("interface.equip_info.doublehand", { value: phrase.definition("class", ctype, "name", ctype.toTitleCase()) }) + "</div>";
			var s = render_item("html", { item: {}, prop: G.classes[ctype].doublehand[def.wtype || def.type], pure: true });
			if (!s) html += "<div style='color: #788783'>" + phrase.html("interface.equip_info.no_modifier") + "</div>";
			else html += s;
			html += "<div style='margin-bottom: 5px'></div>";
			html += "</div>";
		}
		if (G.classes[ctype].offhand[def.wtype || def.type]) {
			html += "<div style='border: 2px dotted gray; padding: 14px; margin: 4px'>";
			html += "<div style='color:" + color + "'>" + phrase.html("interface.equip_info.offhand", { value: phrase.definition("class", ctype, "name", ctype.toTitleCase()) }) + "</div>";
			var s = render_item("html", { item: {}, prop: G.classes[ctype].offhand[def.wtype || def.type], pure: true });
			if (!s) html += "<div style='color: #788783'>" + phrase.html("interface.equip_info.no_modifier") + "</div>";
			else html += s;
			html += "<div style='margin-bottom: 5px'></div>";
			html += "</div>";
		}
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true });
}

function render_item_help(container, name, level, pure) {
	var html = "<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 240px;' class='buyitem'>";
	var source_index = ProgressionSources.get(G),
		sources = source_index.sources(name);
	var npcs = sources
		.filter(function (s) {
			return s.kind === "shop";
		})
		.map(function (s) {
			return s.npc;
		});
	var monsters = sources
		.filter(function (s) {
			return s.kind === "monster";
		})
		.map(function (s) {
			return [s.monster, s.chance];
		});
	var maps = sources
		.filter(function (s) {
			return s.kind === "map";
		})
		.map(function (s) {
			return s.map;
		});
	var items = sources
		.filter(function (s) {
			return s.kind === "exchange";
		})
		.map(function (s) {
			return [s.name, s.level];
		});
	var tokens = sources
		.filter(function (s) {
			return s.kind === "token";
		})
		.map(function (s) {
			return s.token;
		});
	var uses = source_index.uses(name);
	var collecting = uses.filter(function (id) {
		return G.craft[id].quest === "mcollector";
	});
	var crafting = uses.filter(function (id) {
		return G.craft[id].quest !== "mcollector";
	});
	if (npcs.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.buyable_from") + "</div>";
		npcs.forEach(function (nname) {
			var npc = G.npcs[nname];
			if (npc.ignore) return;
			html +=
				"<div style='display:inline-block; text-align: center; margin-right: 5px' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
				nname +
				"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
				sprite(npc.skin, { width: 50, height: 50 }) +
				"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
				npc.name +
				"</div></div>";
		});
	}
	if (G.items[name].type == "token") {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.spend_at") + "</div>";
		var npc = {},
			npc_id = null;
		for (var nname in G.npcs) if (G.npcs[nname].token == name) ((npc = G.npcs[nname]), (npc_id = nname));
		html += "<div>";
		html +=
			"<div style='display:inline-block; text-align: center; margin-right: 5px' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
			npc_id +
			"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
			sprite(npc.skin, { width: 50, height: 50 }) +
			"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
			npc.name +
			"</div></div>";
		html += "</div>";
	}
	if (tokens.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.acquirable_from") + "</div>";
		tokens.forEach(function (token) {
			var npc = {},
				npc_id = null;
			for (var nname in G.npcs) if (G.npcs[nname].token == token) ((npc = G.npcs[nname]), (npc_id = nname));
			html += "<div>";
			html +=
				"<div style='display:inline-block; text-align: center; margin-right: 5px' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
				npc_id +
				"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
				sprite(npc.skin, { width: 50, height: 50 }) +
				"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
				npc.name +
				"</div></div>";
			html += "<div style='display:inline-block; vertical-align: top; line-height: 50px'>" + phrase.html("interface.item_help.with") + "</div>";
			html += item_container({ skin: G.items[token].skin, onclick: "stpr(event); render_item_popup('" + token + "')" }, { name: token });
			html += "</div>";
		});
	}
	if (G.items[name].e) {
		var npc = G.npcs.exchange,
			display_phrase = phrase.html("interface.item_help.exchange_from"),
			id = "exchange";
		for (var nname in G.npcs)
			if (G.items[name].quest && G.npcs[nname].quest == G.items[name].quest) ((npc = G.npcs[nname]), (display_phrase = phrase.html("interface.item_help.bring_to")), (id = nname));
		html += "<div style='color:#DDDDDD'>" + display_phrase + ":</div>";
		html +=
			"<div style='display:inline-block; text-align: center' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
			id +
			"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
			sprite(npc.skin, { width: 50, height: 50 }) +
			"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
			npc.name +
			"</div></div>";
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.drop_table") + "</div>";
		html += item_container(
			{ skin: G.items[name].skin, onclick: "stpr(event); render_exchange_info('" + (name + (((G.items[name].upgrade || G.items[name].compound) && (level || "0")) || "")) + "')" },
			{ name: name, level: (G.items[name].upgrade || G.items[name].compound) && level },
		);
	}
	if (G.items[name].upgrade || G.items[name].compound) {
		var npc = G.npcs.newupgrade,
			display_phrase = phrase.html("interface.item_help.upgrade_at"),
			id = "newupgrade";
		if (G.items[name].compound) display_phrase = phrase.html("interface.item_help.combine_3_at");
		html += "<div style='color:#DDDDDD'>" + display_phrase + ":</div>";
		html +=
			"<div style='display:inline-block; text-align: center' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
			id +
			"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
			sprite(npc.skin, { width: 50, height: 50 }) +
			"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
			npc.name +
			"</div></div>";
		var display_phrase = phrase.html("interface.item_help.buy_scrolls_from"),
			npc = G.npcs.scrolls,
			id = "scrolls";
		html += "<div style='color:#DDDDDD'>" + display_phrase + ":</div>";
		html +=
			"<div style='display:inline-block; text-align: center' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
			id +
			"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
			sprite(npc.skin, { width: 50, height: 50 }) +
			"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
			npc.name +
			"</div></div>";
	}
	if (crafting.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.used_for_crafting") + "</div>";
		crafting.forEach(function (i) {
			var output = G.craft[i].output || { name: i };
			html += item_container({ skin: G.items[output.name].skin, onclick: "stpr(event); render_recipe(null,'','" + i + "')" }, output);
		});
	}
	if (collecting.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.collectable_for") + "</div>";
		collecting.forEach(function (i) {
			html += item_container({ skin: G.items[i].skin, onclick: "stpr(event); render_recipe(null,'mcollector','" + i + "')" }, { name: i });
		});
	}
	if (G.craft[name]) {
		var display_phrase = phrase.html("interface.item_help.craftable_at"),
			npc = G.npcs.craftsman,
			id = "craftsman",
			rphrase = phrase.html("interface.item_help.recipe");
		if (G.craft[name].quest == "mcollector")
			((display_phrase = phrase.html("interface.item_help.obtainable_from")), (npc = G.npcs.mcollector), (id = "mcollector"), (rphrase = phrase.html("interface.item_help.materials")));
		if (G.craft[name].quest == "witch")
			((display_phrase = phrase.html("interface.item_help.concocted_at")), (npc = G.npcs.witch), (id = "witch"), (rphrase = phrase.html("interface.item_help.materials")));
		if (G.craft[name].quest == "anniversary_baker")
			((display_phrase = phrase.html("interface.item_help.craftable_during_the_anniversary")), (npc = G.npcs.anniversary_baker), (id = "anniversary_baker"));
		html += "<div style='color:#DDDDDD'>" + display_phrase + ":</div>";
		html +=
			"<div style='display:inline-block; text-align: center' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
			id +
			"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
			sprite(npc.skin, { cx: clone(npc.cx || {}), cosmetic_head_y: npc.cosmetic_head_y, width: 50, height: 50 }) +
			"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
			npc.name +
			"</div></div>";
		html += "<span class='clickable' onclick='stpr(event); show_recipe(\"" + name + "\")'>" + bold_prop_line(phrase.html("interface.item_help.show"), rphrase, "#6F75DC") + "</span>";
	}
	if (G.dismantle[name]) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.dismantle_at") + "</div>";
		var npc = G.npcs.craftsman,
			id = "craftsman";
		html +=
			"<div style='display:inline-block; text-align: center' class='clickable' onclick='smart_smart_move(\"npc\",\"" +
			id +
			"\")'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
			sprite(npc.skin, { width: 50, height: 50 }) +
			"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
			npc.name +
			"</div></div>";
	}
	if (monsters.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.drops_from") + "</div>";
		monsters.forEach(function (mo) {
			var m = mo[0];
			html += "<div style='display:inline-block; text-align: center' class='clickable hspace5' onclick='smart_smart_move(\"monster\",\"" + m + "\")'>";
			html += "<div style='background-color:#575983; border: 2px solid #9F9FB0; display: inline-block; margin: 2px; /*" + m + "*/'>";
			html += sprite(m, { scale: 1.5 });
			html += "</div>";
			if (mo[1]) html += "<div>" + to_pretty_fraction(mo[1]) + "</div>";
			// html+="<div></div><div class='tinybutton' style='margin-top: -9px'>"+G.monsters[m].name+"</div>";
			html += "</div>";
		});
	}
	if (maps.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.global_drop_at") + "</div>";
		maps.forEach(function (map) {
			if (map == "global") html += "<div style='color:#DD3177' onclick='stpr(event); render_all_monsters()' class='clickable'>" + phrase.html("interface.item_help.everywhere") + "</div>";
			else html += "<div style='color:#47A642' onclick='render_travel(\"" + map + "\")' class='clickable'>" + G.maps[map].name + "</div>";
		});
	}
	if (items.length) {
		html += "<div style='color:#DDDDDD'>" + phrase.html("interface.item_help.obtainable_from_2") + "</div>";
		items.forEach(function (i) {
			html += item_container({ skin: G.items[i[0]].skin, onclick: "stpr(event); render_item_popup('" + i[0] + "'," + i[1] + ")" }, { name: i[0], level: i[1] });
		});
	}
	html +=
		"<span class='clickable' onclick='stpr(event); show_json(G.items[\"" +
		name +
		'"],{prefix:"G.items.",name:"' +
		name +
		"\"})'>" +
		bold_prop_line(phrase.html("interface.item_help.show"), "G.items.<span style='color:" + colors.property + ";'>" + name + "</span>", colors.inspect) +
		"</span>";
	html += "</div>";
	// $(container).parent().replaceWith(html);
	if (pure) return html;
	show_modal(html, { wrap: false, hideinbackground: true });
}

function render_item_popup(name, level, stat_type) {
	var html = "", actual = { name: name, level: level };
	if (stat_type) actual.stat_type = stat_type;
	html += render_item("html", { item: G.items[name], actual: actual, name: name, readonly: !window.character });
	show_modal(html, { wrap: false, hideinbackground: true });
}

function render_item_info(name, level, data) {
	var html = "<div style='font-size: 24px; max-width: 800px; text-align: center' onclick='hide_modal()'>";
	if (name == "empty") {
		html += render_item("html", { item: { name: phrase.html("interface.item.empty"), explanation: phrase.html("interface.item.empty_description") }, prop: {} });
	} else if (name == "shells") {
		html += render_item("html", {
			item: { name: phrase.html("interface.inventory.shells"), explanation: phrase.html("interface.currency.shells_description") },
			prop: {},
		});
	} else if (name == "gold") {
		html += render_item("html", { item: { name: phrase.html("interface.item.gold"), explanation: phrase.html("interface.currency.gold_description") }, prop: {} });
	} else if (level !== undefined) {
		html += render_item("html", { item: G.items[name], actual: { level: level, name: name, data: data }, guide: true });
	} else if (G.items[name].compound) {
		for (var i = 0; i <= 15; i++) {
			html += "<div style='display: inline-block; margin: 5px'>" + render_item("html", { item: G.items[name], actual: { level: i, name: name }, guide: true }) + "</div>";
			if (calculate_item_grade(G.items[name], { level: i }) == 4) break;
		}
	} else if (G.items[name].upgrade) {
		for (var i = 0; i <= 15; i++) {
			html += "<div style='display: inline-block; margin: 5px'>" + render_item("html", { item: G.items[name], actual: { level: i, name: name }, guide: true }) + "</div>";
			if (calculate_item_grade(G.items[name], { level: i }) == 4) break;
		}
	} else {
		html += render_item("html", { item: G.items[name], name: name, actual: { name: name }, guide: true });
	}
	if (G.items[name]) html += "<div></div><div style='display: inline-block; margin: 5px'>" + render_item_help(null, name, level, true) + "</div>";
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/items/" + name });
}

function render_monster_info(name) {
	var html = "<div style='font-size: 24px'>",
		parsed = {},
		count = 0,
		mcount = 0,
		diff = 0,
		mowner = "";
	html += "<div class='clickable' onclick='smart_smart_move(\"monster\",\"" + name + "\")'>" + sprite(name, { full: true, scale: 3 }) + "</div>";
	var RF = (Object.keys(tracker).length && tracker) || (G && G.drops) || { monsters: {}, maps: {} },
		MR = (Object.keys(tracker).length && tracker && tracker.drops) || RF.monsters;
	if (tracker && tracker.monsters) {
		count = tracker.monsters[name] || 0;
		diff = tracker.monsters_diff[name] || 0;
		if (tracker.max.monsters[name]) ((mcount = tracker.max.monsters[name][0]), (mowner = tracker.max.monsters[name][1]));
	}
	html += render_item("html", { pure: true, item: G.monsters[name], prop: G.monsters[name], monster: name, count: count, mcount: mcount, score: count + diff, mowner: mowner });
	if (name === "rimedjinn") html += "<div class='textbutton' onclick=\"open_guide('rime-djinn','/docs/guide/world/rime-djinn')\">" + phrase.html("interface.item.info") + "</div>";
	if (MR && MR[name] && MR[name].length) {
		html += "<div style='margin-top: 6px; margin-bottom: 3px; color:#2A9A3D'>" + phrase.html("interface.monster_info.drops") + "</div>";
		MR[name].forEach(function (drop) {
			html += render_drop(drop, 1, "#858B8E");
		});
	}
	// Add display section for home server drops
	var MRH = (Object.keys(tracker).length && tracker && tracker.drops_home) || RF.monsters_home_server;
	if (MRH && MRH[name] && MRH[name].length) {
		html += "<div style='margin-top:6px;margin-bottom:3px;color:#FF9933'>" + phrase.html("interface.monster_info.home_server_drops") + "</div>";
		MRH[name].forEach(function (drop) {
			html += render_drop(drop, 1, "#858B8E");
		});
	}
	object_sort(G.maps).forEach(function (io) {
		var map = io[1],
			mname = io[0];
		if (map.ignore || !((RF.maps && RF.maps[mname]) || []).length) return;
		(map.monsters || []).forEach(function (pack) {
			if (parsed[mname]) return;
			if (pack.type == name) {
				parsed[mname] = true;
				html += "<div style='margin-top: 6px; margin-bottom: 3px; color:#929943'>" + map.name + ":</div>";
				RF.maps[mname].forEach(function (drop) {
					html += render_drop(drop, G.monsters[name].hp / 1000.0, "#858B8E");
				});
			}
		});
	});
	if ((RF.maps && RF.maps.global_static && RF.maps.global_static.length) || (RF.maps && RF.maps.global && RF.maps.global.length)) {
		var mult = 1;
		if (G.monsters[name]["1hp"]) mult = 1000;
		html += "<div style='margin-top: 6px; margin-bottom: 3px; color:#2A9A3D'>" + phrase.html("interface.monster_info.global") + "</div>";
		RF.maps.global_static.forEach(function (drop) {
			html += render_drop(drop, 1 * mult, "#858B8E");
		});
		RF.maps.global.forEach(function (drop) {
			html += render_drop(drop, (G.monsters[name].hp * mult) / 1000.0, "#858B8E");
		});
	}
	html += "</div>";
	show_modal(html, { wwidth: 240, hideinbackground: true, url: "/docs/guide/all/monsters/" + name });
}

function render_exchange_info(name, count) {
	var html = "<div style='font-size: 24px; max-height: calc(100vh * var(--browser-zoom-inverse, 1) - 100px); overflow: auto'>";
	html += render_drop([1, "open", name], 1, "#858B8E");
	if (G.drops[name + "_bonus"]) {
		html += "<div style='margin-top:12px;color:#AAA'>" + phrase.html("interface.exchange_info.also_receive") + "</div>";
		G.drops[name + "_bonus"].forEach(function (drop) {
			html += render_drop(drop, 1, "#858B8E");
		});
	}
	html += "</div>";
	show_modal(html, { wwidth: min(460, viewport_width() - 52), hideinbackground: true });
}

function render_tracker() {
	var html = "";
	html += "<div style='font-size: 32px'>";
	html +=
		"<div style='background-color:#575983; border: 2px solid #9F9FB0; display: inline-block; margin: 2px; padding: 6px;' class='clickable' onclick='pcs(event); $(\".trackers\").hide(); $(\".trackerm\").show();'>" +
		phrase.html("interface.tracker.monsters") +
		"</div>";
	html +=
		"<div style='background-color:#575983; border: 2px solid #9F9FB0; display: inline-block; margin: 2px; padding: 6px;' class='clickable' onclick='pcs(event); $(\".trackers\").hide(); $(\".trackere\").show();'>" +
		phrase.html("interface.tracker.exchanges_and_quests") +
		"</div>";
	html += "</div>";
	html += "<div class='trackers trackerm'>";
	object_sort(G.monsters, "hpsort").forEach(function (e) {
		if ((e[1].cute && !e[1].achievements) || e[1].unlist) return;
		var count = (tracker.monsters[e[0]] || 0) + (tracker.monsters_diff[e[0]] || 0),
			color = "#50ADDD";
		if (tracker.max.monsters[e[0]] && tracker.max.monsters[e[0]][0] > count) {
			count = tracker.max.monsters[e[0]][0];
			color = "#DCC343";
		}
		html +=
			"<div style='background-color:#575983; border: 2px solid #9F9FB0; position: relative; display: inline-block; margin: 2px; /*" +
			e[0] +
			"*/' class='clickable' onclick='pcs(event); render_monster_info(\"" +
			e[0] +
			"\")'>";
		html += sprite(e[0], { scale: 1.5 });
		if (!count) {
			//html+="<div style='background-color:#575983; border: 2px solid #9F9FB0; position: absolute; top: -2px; left: -2px; color:#FD8C3A; display: inline-block; padding: 1px 1px 1px 3px;'>?</div>";
		} else {
			html +=
				"<div style='background-color:#575983; border: 2px solid #9F9FB0; position: absolute; top: -2px; left: -2px; color:" +
				color +
				"; display: inline-block; padding: 1px 1px 1px 3px;'>" +
				to_shrinked_num(count) +
				"</div>";
		}
		if (tracker.drops && tracker.drops[e[0]] && tracker.drops[e[0]].length)
			html +=
				"<div style='background-color:#FD79B0; border: 2px solid #9F9FB0; position: absolute; bottom: -2px; right: -2px; display: inline-block; padding: 1px 1px 1px 1px; height: 2px; width: 2px'></div>";
		html += "</div>";
	});
	html += "</div>";
	html += "<div class='trackers trackere hidden' style='margin-top: 3px'>";
	object_sort(G.items).forEach(function (e) {
		if (e[1].e && !e[1].ignore) {
			var list = [[e[0], e[0], undefined]];
			if (e[1].upgrade || e[1].compound) {
				list = [];
				for (var i = 0; i < 13; i++) if (G.drops[e[0] + i]) list.push([e[0], e[0] + i, i]);
			}
			list.forEach(function (d) {
				html += "<div style='margin-right: 3px; margin-bottom: 3px; display: inline-block; position: relative;'";
				if (G.drops[d[1]]) html += " class='clickable' onclick='pcs(event); render_exchange_info(\"" + d[1] + '",' + (tracker.exchanges[d[1]] || 0) + ")'>";
				else html += ">";
				html += item_container({ skin: G.items[d[0]].skin }, { name: d[0], level: d[2] });
				if (tracker.exchanges[d[1]])
					html +=
						"<div style='background-color:#575983; border: 2px solid #9F9FB0; position: absolute; top: -2px; left: -2px; color:#ED901C; font-size: 16px; display: inline-block; padding: 1px 1px 1px 3px;'>" +
						to_shrinked_num(tracker.exchanges[d[1]]) +
						"</div>";
				html += "</div>";
			});
		}
	});
	html += "</div>";
	show_modal(html, { wwidth: 578, hideinbackground: true });
}

function render_computer($element, type = "computer", slot = 0) {
	var html = "";
	html += '<div style="color: #32A3B0">' + phrase.html("interface.computer.connected") + "</div>";
	html +=
		"<div onclick='socket.emit(\"trade_history\",{})' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.trade_history") +
		"</div>";
	html +=
		"<div onclick='toggle_merchant(\"" +
		slot +
		"\")' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.toggle_stand") +
		"</div>";
	if (type == "supercomputer") {
		html +=
			"<div onclick=\"socket.emit('tracker')\" class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
			"&gt;" +
			"</span>" +
			" " +
			phrase.html("interface.computer.tracker") +
			"</div>";
	}

	html +=
		"<div onclick='render_upgrade_shrine()' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" + "&gt;" + "</span>" + " " + phrase.html("interface.computer.upgrade") + "</div>"; // style='color: #C3C3C3' style='color: #D6D6D6'
	html +=
		"<div onclick='render_compound_shrine()' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" + "&gt;" + "</span>" + " " + phrase.html("interface.computer.compound") + "</div>";
	html +=
		"<div onclick='render_exchange_shrine()' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" + "&gt;" + "</span>" + " " + phrase.html("interface.computer.exchange") + "</div>";
	html +=
		"<div onclick='render_interaction({auto:true,dialog:\"locksmith\",skin:\"asoldier\"});' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.locksmith") +
		"</div>";
	html +=
		"<div onclick='render_interaction(\"crafting\");' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.crafting") +
		"</div>";
	html +=
		"<div onclick='render_merchant(G.npcs.pots)' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.potions") +
		"</div>";
	html +=
		"<div onclick='render_merchant(G.npcs.scrolls)' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.scrolls") +
		"</div>";
	html +=
		"<div onclick='render_merchant(G.npcs.basics)' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.basics") +
		"</div>";

	html +=
		"<div onclick='render_merchant(G.npcs.premium,false)' class='clickable' style='color: #E4E4E4'><span style='color: #BA61A4'>" +
		"&gt;" +
		"</span>" +
		" " +
		phrase.html("interface.computer.premium") +
		"</div>";

	$element.html(html);
}

function render_skill(selector, skill_name, args) {
	if (!args) args = {};
	var actual = args.actual || {},
		html = "";
	var skill = G.skills[skill_name];
	if (skill)
		skill = Object.assign({}, skill, { name: phrase.definition("skill", skill_name, "name", skill.name), explanation: phrase.definition("skill", skill_name, "explanation", skill.explanation) });
	html += "<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 240px; " + (args.styles || "") + "'>";
	if (!skill) html += skill_name;
	else {
		html += "<div style='color: #4EB7DE; display: inline-block; border-bottom: 2px dashed gray; margin-bottom: 3px' class='cbold'>" + skill.name + "</div>";
		if (skill.explanation) {
			html += "<div style='color: #C3C3C3'>" + skill.explanation + "</div>";
			if (skill.mp) html += bold_prop_line(phrase.html("stat.mp.name"), skill.mp, colors.mp);
			if (skill.duration) html += bold_prop_line(phrase.html("interface.skill.duration"), phrase.html("interface.time.seconds", { count: skill.duration / 1000.0 }), "gray");
			if (skill.cooldown && skill.cooldown / 1000.0) html += bold_prop_line(phrase.html("interface.skill.cooldown"), phrase.html("interface.time.seconds", { count: skill.cooldown / 1000.0 }), "gray");
			if (skill.reuse_cooldown && skill.reuse_cooldown / 1000.0)
				html += bold_prop_line(phrase.html("interface.skill.r_use_cooldown"), phrase.html("interface.time.seconds", { count: skill.reuse_cooldown / 1000.0 }), "gray");
			if (skill.share)
				html += bold_prop_line(
					phrase.html("interface.skill.cooldown"),
					phrase.html("interface.skill.shared_cooldown", {
						multiplier: to_pretty_float(skill.cooldown_multiplier || 1),
						skill: phrase.definition("skill", skill.share, "name", G.skills[skill.share].name),
					}),
					"gray",
				);
			if (skill.range) html += bold_prop_line(phrase.html("interface.skill.range"), skill.range, "gray");
			if (skill.use_range) html += bold_prop_line(phrase.html("interface.skill.range"), phrase.html("interface.skill.character_range"), "gray");
			if (skill.range_multiplier && skill.range_bonus) html += bold_prop_line(phrase.html("interface.skill.range"), to_pretty_float(skill.range_multiplier || 1) + "X + " + skill.range_bonus, "gray");
			else if (skill.range_multiplier)
				html += bold_prop_line(phrase.html("interface.skill.range"), phrase.html("interface.skill.range_multiplier", { multiplier: to_pretty_float(skill.range_multiplier || 1) }), "gray");
			if (skill.level) html += bold_prop_line(phrase.html("interface.skill.level_requirement"), skill.level, "gray");
			if (skill.wtype)
				html += bold_prop_line(
					phrase.html("interface.skill.weapon_requirement"),
					(is_array(skill.wtype) ? skill.wtype : [skill.wtype])
						.map(function (type) {
							return '"' + phrase.escape(phrase.definition("weapon_type", type, "name", type)) + '"';
						})
						.join(", "),
					"gray",
				);
			if (skill.offhand_type)
				html += bold_prop_line(phrase.html("interface.skill.offhand_requirement"), phrase.definition("weapon_type", skill.offhand_type, "name", skill.offhand_type.toTitleCase()), "gray");
			if (skill.max) html += bold_prop_line(phrase.html("interface.skill.max"), skill.max, "gray");
			if (skill.type == "passive") html += "<div><span style='color: #696C68;'>" + phrase.html("interface.skill.passive") + "</span></div>";
			if (skill.damage_type) {
				if (skill.damage_type == "pure") html += bold_prop_line(phrase.html("interface.skill.damage_type"), phrase.html("interface.skill.pure"), "#AA9B55");
				else if (skill.damage_type == "magical") html += bold_prop_line(phrase.html("interface.skill.damage_type"), phrase.html("interface.skill.magical"), "#8998AA");
				else if (skill.damage_type == "physical") html += bold_prop_line(phrase.html("interface.skill.damage_type"), phrase.html("interface.skill.physical"), "#93AB98");
			}
			if (skill.condition && G.conditions[skill.condition]) {
				html += info_line({
					name: phrase.html("interface.skill.condition"),
					color: "#A59FFF",
					value: phrase.definition("condition", skill.condition, "name", G.conditions[skill.condition].name),
					onclick: "dialogs_target=xtarget||ctarget; show_json(G.conditions." + skill.condition + ",{name:'G.conditions." + skill.condition + "'})",
				});
			}
			(skill.levels || []).forEach(function (lv) {
				var level = lv[0],
					value = lv[1];
				html += bold_prop_line(phrase.html("interface.skill.output"), level > 0 ? phrase.html("interface.skill.value_at_level", { value: value, level: level }) : value, "gray");
			});
			(skill.mp_return_levels || []).forEach(function (lv) {
				html += bold_prop_line(phrase.html("interface.skill.hp_loss_to_mp"), phrase.html("interface.skill.value_at_level", { value: Math.round(lv[1] * 100) + "%", level: lv[0] }), colors.mp);
			});
			for (var requirement in skill.requirements || {}) {
				var amount = skill.requirements[requirement];
				html += bold_prop_line(phrase.html("interface.skill.required", { value: phrase.definition("stat", requirement, "name", requirement.toTitleCase()) }), amount, "gray");
			}
			if (skill.consume) {
				html += "<div style='margin: 4px 0px 0px -2px;'>" + item_container({ skin: G.items[skill.consume].skin, def: G.items[skill.consume] });
				+"</div>";
			}
			html +=
				"<div class='clickable' onclick='show_json(G.skills." +
				skill_name +
				',{prefix:"G.skills.",name:"' +
				skill_name +
				"\"})'><span style='color: #44A8D4;'>" +
				phrase.html("interface.skill.show") +
				"</span> <span style='color:gray'>G.skills.</span>" +
				skill_name +
				"</div>";
		}
	}
	html += "</div>";
	if (modal_count) show_modal(html, { wrap: false });
	else render_ui_panel(selector, html);
}

function render_computer_network(selector, type, num) {
	var html =
		"<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 240px;' class='buyitem'><div class='computernx'></div></div>";
	render_ui_panel(selector, html);
	render_computer($(".computernx"), type, num);
}

function render_secondhands(type) {
	reset_inventory(1);
	topleft_npc = "secondhands";
	if (type) topleft_npc = type;
	rendered_target = topleft_npc; // merchant_id=npc.id;
	var last = 0,
		collection = [],
		f = "sh_click";
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; display: inline-block'>";
	var items = secondhands;
	if (type) {
		items = lostandfound;
		if (l_page >= 1) last += 19 + (l_page - 1) * 18;
		f = "lf_click";
	} else {
		if (s_page >= 1) last += 19 + (s_page - 1) * 18;
	}
	for (var i = 0; i < 4; i++) {
		html += "<div>";
		for (var j = 0; j < 5; j++) {
			if (!type && i == 3 && j == 0 && s_page != 0) html += item_container({ skin: "left", onclick: "s_page=" + (s_page - 1) + "; render_secondhands();" }, { q: s_page, left: true });
			else if (!type && i == 3 && j == 4 && last < items.length - 1) html += item_container({ skin: "right", onclick: "s_page=" + (s_page + 1) + "; render_secondhands();" }, { q: s_page + 2 });
			else if (type && i == 3 && j == 0 && l_page != 0)
				html += item_container({ skin: "left", onclick: "l_page=" + (l_page - 1) + "; render_secondhands('lostandfound');" }, { q: l_page, left: true });
			else if (type && i == 3 && j == 4 && last < items.length - 1)
				html += item_container({ skin: "right", onclick: "l_page=" + (l_page + 1) + "; render_secondhands('lostandfound');" }, { q: l_page + 2 });
			else if (last < items.length && items[last++]) {
				var current = items[last - 1];
				var id = "secondhand" + (last - 1),
					item = G.items[current.name];
				html += item_container({ skin: item.skin, onclick: f + "(" + (last - 1) + ")", def: item, id: id, draggable: false, droppable: false }, current);
			} else {
				html += item_container({ size: 40, draggable: false, droppable: false });
			}
		}
		html += "</div>";
	}
	html += "</div>";
	html +=
		"<div id='merchant-item' class='rendercontainer' style='display: inline-block; vertical-align: top; margin-left: 5px'>" +
		((next_side_interaction && render_interaction(next_side_interaction, "return_html")) || " ") +
		"</div>";
	next_side_interaction = null;
	render_ui_panel("#topleftcornerui", html);
}

function old_render_gallery() {
	var html = "";
	G.codes.forEach(function (section) {
		html += "<div class='gamebutton'>" + (section.name || section.key) + "</div>";
	});
	html += "<div style='border: 4px gray solid;'>";
	G.codes[0].list.forEach(function (def) {
		html += '<div onclick=\'api_call("load_gcode",{file:"' + def[0] + "\"});'>" + def[1] + "</div>";
	});
	html += "</div>";
	show_modal(html);
}

function old_render_stepv1(args) {
	if (!args) args = {};
	args.title = "[1/24] " + phrase("docs.guide.basics.move");
	args.main = phrase.html("interface.tutorial.first_steps");
	args.code = phrase.html("interface.tutorial.move_code");
	var html = "";
	if (args.title)
		html += "<div style='border: 5px solid #65A7E6; background-color: #E6E6E6; color: #333333; margin: 3px; padding: 5px; font-size: 24px; display: inline-block'>" + args.title + "</div>";
	if (args.main) html += "<div style='border: 5px solid gray; background-color: #E6E6E6; color: #333333; margin: 3px; padding: 5px; font-size: 24px;'>" + args.main + "</div>";
	if (args.code) html += "<div style='border: 5px solid #E4738A; background-color: #E6E6E6; color: #333333; margin: 3px; padding: 5px; font-size: 24px;'>" + args.code + "</div>";
	show_modal(html);
}

function load_documentation(name) {
	if (in_arr(name, G.docs.documented)) api_call("load_article", { name: name, func: true });
	else if (name == "character") show_json(game_stringify(character, "\t"));
	else if (in_arr(name, G.docs.functions)) render_function_reference(name);
	else {
		$(".codesearch").val(name);
		csearch_logic("ui");
	}
}

function open_article(name, url) {
	api_call("load_article", { name: name, url: url });
}

function open_guide(name, url) {
	if (name === "events-and-home" || (typeof name === "string" && name.indexOf("event-") === 0)) tut("events");
	if (name === "crafting") tut("recipes");
	api_call("load_article", { name: name, guide: true, url: url });
}

function get_tutorial_view(track) {
	if (track === undefined) track = window.character && character.ctype === "merchant" ? "merchant" : "";
	return {
		track: track === "merchant" ? "merchant" : "",
		lessons: track === "merchant" ? G.docs.merchant_tutorial : G.docs.tutorial,
		progress: (window.X && (track === "merchant" ? X.merchant_tutorial : X.tutorial)) || { step: 0, completed: [], pending: [] },
	};
}

function render_tutorial_items() {
	if (window.no_graphics) return;
	render_tutorial_travel();
	$(".tutorial-item").each(function () {
		var name = $(this).attr("data-item");
		if ($(this).attr("data-class-weapon") === "true") {
			var type = window.character && G.classes[character.ctype], weapon = type && type.base_slots && type.base_slots.mainhand;
			if (weapon && G.items[weapon.name]) name = weapon.name;
		}
		var actual = { name: name }, quantity = parseInt($(this).attr("data-quantity"));
		if (quantity > 1) actual.q = quantity;
		if (G.items[name]) $(this).css({ display: "inline-block", direction: "ltr" }).html(item_container({ skin: G.items[name].skin, draggable: false, onclick: "stpr(event);render_item_popup('" + name + "',0)" }, actual));
	});
	$(".tutorial-npc").each(function () {
		var npc = G.npcs[$(this).attr("data-npc")];
		if (npc) $(this).css({ display: "inline-flex", direction: "ltr", lineHeight: 0 }).html(sprite(npc.skin, { scale: 3, width: 80, height: (G.dimensions[npc.skin] || G.dimensions.default_character)[1] * 3, overflow: true }));
	});
	$(".tutorial-monster").each(function () {
		var name = $(this).attr("data-monster");
		if (G.monsters[name]) $(this).css({ display: "inline-flex", direction: "ltr", lineHeight: 0 }).html(sprite(name, { scale: 3, width: 80, height: (G.dimensions[G.monsters[name].skin || name] || G.dimensions.default_character)[1] * 3, overflow: true }));
	});
}

function render_tutorial_travel() {
	if (window.no_graphics) return;
	$(".tutorial-travel").each(function () {
		var type = $(this).attr("data-type"), id = $(this).attr("data-target");
		var definitions = type === "npc" ? G.npcs : type === "monster" ? G.monsters : type === "map" ? G.maps : null;
		var destination = definitions && definitions[id];
		$(this).empty();
		if (!window.character || !destination || !/^[a-zA-Z0-9_]+$/.test(id)) return;
		$(this).html("<span class='gamebutton gamebutton-small mr5 mt5' onclick='btc(event); if(window.character) smart_smart_move(\"" + type + "\",\"" + id + "\")'>" + phrase.html("docs.guide.basics.move") + " · " + html_escape(destination.name || id) + "</span>");
	});
}

function turn_tutorial_lore(direction) {
	if (window.no_graphics) return;
	var container = $(".tutorial-lore"), page = Math.max(1, Math.min(5, Number(container.attr("data-page")) + direction));
	if (!container.length) return;
	var available = viewport_width() - 60, divisor = 1;
	while (960 / divisor > available && divisor < 16) divisor *= 2;
	container.closest(".guide-article").css("width", 960 / divisor + 10);
	container.attr("data-page", page);
	container.find("img").attr("src", "/images/tutorial/lore/" + container.attr("data-language") + "/page-0" + page + ".jpg?v=native-20260909").attr("alt", container.find("img").attr("data-alt-" + page)).css({ width: 960 / divisor, height: 540 / divisor });
	container.find(".tutorial-lore-prev").css("visibility", page === 1 ? "hidden" : "visible");
	container.find(".tutorial-lore-skip").css("visibility", page === 5 ? "hidden" : "visible");
	container.find(".tutorial-lore-next").toggle(page < 5);
	container.find(".tutorial-lore-finish").toggle(page === 5);
	position_modals();
}

function render_tutorial_lore(article, url, tutorial) {
	show_modal("<div class='guide-article' data-lore-tutorial='" + !!tutorial + "' style='background:#E5E5E5;color:#010805;border:5px solid gray;padding:0;font-size:26px;text-align:start'>" + article + "</div>", { wrap:false, url:url, close:{ label:"X", classes:"ui-close-tutorial", corner:true } });
	turn_tutorial_lore(0);
}

function finish_tutorial_lore() {
	var view = get_tutorial_view(last_rendered_track);
	if ($(".tutorial-lore").closest(".guide-article").attr("data-lore-tutorial") === "true" && view.lessons[last_rendered_step] && view.lessons[last_rendered_step].key === "lore" && view.progress.step === last_rendered_step && view.progress.can_continue) continue_tutorial();
	else hide_modal();
}

function render_tutorial_comparison(data, accessories) {
	if (window.no_graphics) return;
	var type = window.character && character.ctype;
	if (!data.classes[type]) type = "mage";
	var build = data.classes[type], indices = accessories ? [2, 3] : [0, 1, 2], labels = accessories ? ["accessory_plain", "accessory_improved"] : ["gear_plain", "gear_upgraded", "gear_statted"];
	var html = "<div class='title mt15'>" + phrase.definition("class", type, "name", type) + " · " + data.level + "</div>";
	html += "<p>" + phrase.html("interface.tutorial.comparison.target") + ": " + G.monsters[data.target].name + "</p><div class='guide-card-grid'>";
	indices.forEach(function (index, i) {
		var row = build.rows[index];
		html += "<div class='guide-card'><b>" + phrase.html("interface.tutorial.comparison." + labels[i]) + "</b><div style='direction:ltr;text-align:left'>";
		Object.keys(row.slots).forEach(function (slot) {
			var item = row.slots[slot];
			html += item_container({ skin: G.items[item.name].skin, draggable: false, onclick: "stpr(event);render_item_popup('" + item.name + "'," + (item.level || 0) + ",'" + (item.stat_type || "") + "')" }, item);
		});
		html += "</div>";
		if (!accessories && index === 2) {
			var scroll = build.stat + "scroll";
			if (G.items[scroll]) html += "<div class='mt5' style='direction:ltr;text-align:left'>" + item_container({ skin: G.items[scroll].skin, draggable: false, onclick: "stpr(event);render_item_popup('" + scroll + "',0)" }, { name: scroll }) + "</div>";
		}
		html += "<p>" + phrase.html("interface.tutorial.comparison.hit") + ": <span class='dlabel'>" + row.hit + "</span><br>" + phrase.html("interface.tutorial.comparison.dps") + ": <span class='dlabel'>" + row.dps + "</span>";
		if (i) html += "<br>" + phrase.html("interface.tutorial.comparison.increase") + ": <span style='color:#387649'>+" + ((row.dps / build.rows[indices[i - 1]].dps - 1) * 100).toFixed(1) + "%</span>";
		html += "</p></div>";
	});
	$(".tutorial-comparison").html(html + "</div>");
}

function open_tutorial(step, track) {
	// A numbered lesson without a track remains an adventurer lesson for existing links.
	var view = get_tutorial_view(track === undefined && step !== undefined && step !== null ? "" : track);
	track = view.track;
	if (step === undefined || step === null) step = Math.min(view.progress.step, view.lessons.length - 1);
	step = Math.max(0, Math.min(parseInt(step) || 0, view.lessons.length - 1));
	api_call("load_article", { name: view.lessons[step].key, tutorial: "" + step, track: track, url: "/docs/tutorial/" + view.lessons[step].key });
}

function render_tutorial_index(track) {
	if (window.TutorialCode) TutorialCode.cancel();
	if ($(".tutorial-index").length) {
		while (modal_count && !$(".modal:last .tutorial-index").length) hide_modal(true);
		hide_modal();
	}
	var view = get_tutorial_view(track), progress = view.progress;
	track = view.track;
	var current_step = progress.step || 0,
		html = "<div class='tutorial-index' data-track='" + (track === "merchant" ? "merchant" : "") + "' style='width: 520px; text-align: left'>";
	html += "<div class='gamebutton block mb5' style='text-align:center'>" + phrase.html("interface.tutorial_index.tutorial_lessons") + "</div>";
	html += "<div class='gamebutton block mb5' onclick='render_tutorial_index(\"\")'>" + phrase.html("interface.tutorial.main_track") + "</div>";
	html += "<div class='gamebutton block mb5' onclick='render_tutorial_index(\"merchant\")'>" + phrase.html("interface.tutorial.merchant_track") + "</div>";
	view.lessons.forEach(function (lesson, step) {
		var completed = progress.completed_lessons ? progress.completed_lessons.indexOf(lesson.key) !== -1 : step < current_step;
		var color = step == current_step ? "#D67D23" : completed ? "#73BD6D" : "gray";
		html +=
			"<div class='gamebutton block mb5' style='border-color:" +
			color +
			"; text-align:left' onclick='open_tutorial(" +
			step +
			",\"" + (track || "") + "\")'><span style='color:" +
			color +
			"'>[" +
			(step + 1) +
			"]</span> " +
			phrase.definition("tutorial", lesson.key, "title", lesson.title) +
			"</div>";
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/tutorial" });
}

var last_rendered_step = 0, last_rendered_track = "";
function continue_tutorial() {
	var view = get_tutorial_view(last_rendered_track);
	if (last_rendered_step !== view.progress.step || !view.lessons[last_rendered_step]) return;
	api_call("tutorial", { step: last_rendered_step + 1, lesson: view.lessons[last_rendered_step].key, track: last_rendered_track || undefined });
	hide_modal();
}

function render_tutorial(article, step, url, track) {
	// Keep the lesson list underneath; closing a lesson returns to the same track.
	while (modal_count && !$(".modal:last .tutorial-index").length) hide_modal(true);
	if ($(".tutorial-index").length && $(".tutorial-index").attr("data-track") !== (track === "merchant" ? "merchant" : "")) render_tutorial_index(track);
	last_rendered_step = step;
	last_rendered_track = track === "merchant" ? "merchant" : "";
	var view = get_tutorial_view(last_rendered_track),
		tutorial = view.lessons[step],
		cphrase = phrase.html("interface.tutorial.continue");
	if (step == view.lessons.length - 1) cphrase = phrase.html("interface.tutorial.complete");
	if (tutorial.key === "lore") return render_tutorial_lore(article, url, true);

	var html =
		"<div class='guide-article tutorial-article' style='background: #E5E5E5; color: #010805; border: 5px solid gray; padding: 24px; font-size: 32px; text-align: start'><div style='margin-top:-15px'></div>";
	html +=
		"<div style='margin-bottom: 8px; display:flow-root'><span style='color:#2B9EC9'>" +
		phrase.definition("tutorial", tutorial.key, "title", tutorial.title) +
		"</span> <div style='float:right; color:#906CB4'><span class='clickable' style='color:#2B9EC9' onclick='render_tutorial_index(\"" +
		last_rendered_track +
		"\")'>" +
		phrase.html("interface.tutorial.lessons") +
		"</span> [" +
		(step + 1) +
		"/" +
		view.lessons.length +
		"]</div></div>";
	html += "<div style='margin-left:-24px; margin-right: -24px; border-bottom: 5px solid gray'></div>";
	html += article;
	html += "<div style='margin-left:-24px; margin-right: -24px; border-bottom: 5px solid gray'></div>";
	if (window.inside === "docs") {
		html += "<div class='tutorial-docs-navigation' style='display:flex;justify-content:space-between;gap:12px;margin-top:16px'>";
		if (step > 0) html += "<div class='gamebutton' onclick='open_tutorial(" + (step - 1) + ',"' + last_rendered_track + "\")'>" + phrase.html("interface.learn_article.lt_previous") + "</div>";
		if (step + 1 < view.lessons.length)
			html +=
				"<div class='gamebutton' style='margin-left:auto' onclick='open_tutorial(" + (step + 1) + ',"' + last_rendered_track + "\")'>" + phrase.html("interface.learn_article.next_gt") + "</div>";
		html += "</div>";
	} else {
		html += "<div class='tutorial-footer' style='margin-top: 8px; margin-bottom: -16px; display:flow-root'>";
		if (
			tutorial.tasks.some(function (task) {
				return task !== tutorial.continue_task;
			})
		)
			html += "<span style='color: #D67D23'>" + phrase.html("interface.tutorial.completion") + " <span class='tutprogress'>0</span>%</span> ";
		html +=
			"<div style='float: right; color: #906CB4; display:none' class='tutreview'></div><div style='float: right; color: gray' class='tutincomplete'>" +
			phrase.html("interface.tutorial.incomplete") +
			"</div><div style='float: right; color: #73BD6D' class='gamebutton gamebutton-small tutcontinue' onclick='btc(event); continue_tutorial()'>" +
			cphrase +
			"</div></div>";
	}
	html += "</div>";

	show_modal(html, {
		wrap: false,
		url: url,
		close: { label: "X", classes: "ui-close-tutorial", corner: true },
		ondestroy: tutorial.key.indexOf("js-") === 0 ? "if(window.TutorialCode) TutorialCode.cancel()" : undefined,
	});
	if (typeof update_tutorial_ui === "function") update_tutorial_ui();
	else $(".tutorial-footer").hide();
	$(".code").codemirror({ trim: true });
	prepare_tutorial_code();
	position_modals();
}

function render_learn_article(article, args) {
	if (article.includes('class="tutorial-lore"')) return render_tutorial_lore(article, args.url, false);
	if (article.includes('id="encouragement-personal"')) article = article.replace('<div id="encouragement-personal"></div>', render_encouragement_info());
	var html = "<div class='guide-article' style='background: #E5E5E5; color: #010805; border: 5px solid gray; padding: 24px; font-size: 32px; text-align: justify'><div style='margin-top:-15px'></div>";
	html += article;
	html += "<div style='margin-bottom:-15px'></div>";
	if (args.prev)
		html +=
			"<div class='gamebutton' style='position: absolute; top: -30px; left: -30px' onclick='hide_modal(); open_guide(\"" +
			args.prev +
			'","/docs/guide/' +
			args.prev +
			"\")'>" +
			phrase.html("interface.learn_article.lt_previous") +
			"</div>";
	if (args.next)
		html +=
			"<div class='gamebutton' style='position: absolute; bottom: -30px; right: -20px' onclick='hide_modal(); open_guide(\"" +
			args.next +
			'","/docs/guide/' +
			args.next +
			"\")'>" +
			phrase.html("interface.learn_article.next_gt") +
			"</div>";
	html += "</div>";
	show_modal(html, { wrap: false, url: args && args.url, close: { label: phrase.html("interface.learn_article.close"), classes: "ui-close-docs" } });
	$(".code").codemirror({ trim: true });
	if ($(".cave-guide").length) {
		$(".cave-guide").closest(".guide-article").css({width:"640px",maxWidth:"calc(100vw * var(--browser-zoom-inverse, 1) - 120px)"});
		$(".cave-guide .CodeMirror").each(function(){ if(this.CodeMirror) this.CodeMirror.setOption("lineWrapping",true); });
	}
	position_modals();
}

function render_encouragement_info() {
	if (typeof character === "undefined" || !character || !character.encouragement) return "";
	var state = character.encouragement,
		html = "<div class='divider'></div><div class='title'>" + phrase.html("interface.encouragement_info.your_encouragement") + "</div>";
	var reasons = {
		checking: phrase.html("interface.encouragement.checking"),
		character_limit: phrase.html("interface.encouragement.character_limit"),
		expired: phrase.html("interface.encouragement.expired"),
		merchant: phrase.html("interface.encouragement.merchant"),
		another_character: phrase.html("interface.encouragement.another_character"),
		away: phrase.html("interface.encouragement.away"),
	};
	for (var status of state.statuses) {
		var condition = character.s[status.id],
			def = G.conditions[status.id];
		if (!def) continue;
		html +=
			"<p><b>" +
			phrase.definition("condition", status.id, "name", def.name) +
			": " +
			(condition ? phrase.html("interface.encouragement_info.active") : phrase.html("interface.encouragement_info.unavailable")) +
			"</b><br>";
		if (condition)
			html += phrase.html("interface.encouragement_info.gold_xp_luck", {
				gold_multiplier: condition.gold_multiplier,
				xp_multiplier: condition.xp_multiplier,
				luck_multiplier: condition.luck_multiplier,
			});
		else html += reasons[status.reason] || phrase.html("interface.encouragement_info.this_bonus_is_not_active");
		html += "</p>";
	}
	return html;
}

var render_function_html = "";
function render_function_reference(n, f, c) {
	// hide_modal();
	if (n == "character") return show_json(game_stringify(character, "\t"));
	if (!c) {
		code_eval('parent.render_function_reference("' + n + "\",window['" + n + "'],1);");
		return;
	}
	if (!f && !window[n]) {
		render_function_html = "";
		return add_log(phrase.html("interface.function_reference.reference_not_found"), "gray");
	} else if (!f) f = window[n];
	var html = "",
		rid = randomStr(10);
	if (render_function_html) {
		render_learn_article(render_function_html + "<textarea class='codemirror" + rid + "'></textarea>", { url: "/docs/code/functions/" + n });
		$(".codemirror" + rid).codemirror({ value: "// " + phrase("docs.reference.source_code") + ": " + n + "\n" + f.toString(), hints: true });
		render_function_html = "";
	} else {
		html += "<textarea class='codemirror" + rid + "'></textarea>";
		show_modal(html, { wwidth: min(viewport_width() - 60, 1200), url: "/docs/code/functions/" + n });
		$(".codemirror" + rid).codemirror({ value: "// " + phrase("docs.reference.source_code") + ": " + n + "\n" + f.toString(), hints: true });
		position_modals();
	}
}

function render_functions_directory() {
	// hide_modal();
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 24px; min-width: 272px'>";
	G.docs.functions.forEach(function (n) {
		if (in_arr(n, G.docs.documented))
			html += "<div style='display: block; margin-bottom: 4px; font-size: 32px' class='clickable' onclick='api_call(\"load_article\",{name:\"" + n + "\",func:true});'>" + n + "</div>";
		else html += "<div style='display: block; margin-bottom: 4px; font-size: 32px' class='clickable' onclick='render_function_reference(\"" + n + "\")'>" + n + "</div>";
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/code/functions" });
}

function render_all_recipes() {
	tut("recipes");
	var html = "<div style='border: 5px solid gray; background-color: black; padding: 10px; width: 734px; font-size: 32px'>";
	// html+="<div style='padding: 10px; color: #CC863B; text-align: center'>Work in Progress</div>";
	var xprev = false;
	object_sort(G.craft, "gold_value").forEach(function (r) {
		if (xprev) html += "<div style='border-top: 4px solid gray; margin-left: -12px; margin-right: -12px'></div>";
		var prev = false,
			name = r[0],
			recipe = r[1],
			output = recipe.output || { name: name };
		html += "<div style='line-height: 50px; vertical-align: middle; padding: 12px'>";
		html += item_container({ skin: G.items[output.name].skin, onclick: "render_item_info('" + output.name + "')" }, output);
		html += " <span style='color: #00DE51'>" + "&lt;=" + "</span> ";
		recipe.items.forEach(function (i) {
			if (prev) html += " <span style='color: gray'>+</span> ";
			html += item_container({ skin: G.items[i[1]].skin, onclick: "render_item_info('" + i[1] + "')" }, { name: i[1], q: i[0], level: i[2] });
			prev = true;
		});
		if (recipe.cost) html += " <span style='color: gray'>+</span> <span style='color: gold'>" + to_pretty_num(recipe.cost) + "</span>";
		html += "</div>";
		xprev = true;
	});
	object_sort(G.dismantle, "gold_value").forEach(function (r) {
		if (xprev) html += "<div style='border-top: 4px solid gray; margin-left: -12px; margin-right: -12px'></div>";
		var prev = false,
			name = r[0],
			recipe = r[1];
		html += "<div style='line-height: 50px; vertical-align: middle; padding: 12px'>";
		html += item_container({ skin: G.items[name].skin, onclick: "render_item_info('" + name + "')" }, { name: name });
		html += " <span style='color: #E73900'>" + "=&gt;" + "</span> ";
		recipe.items.forEach(function (i) {
			if (prev) html += " <span style='color: gray'>+</span> ";
			html += item_container({ skin: G.items[i[1]].skin, onclick: "render_item_info('" + i[1] + "')" }, { name: i[1], q: i[0], level: i[2] });
			prev = true;
		});
		if (recipe.cost) html += " <span style='color: gray'>-</span> <span style='color: gold'>" + to_pretty_num(recipe.cost) + "</span>";
		html += "</div>";
		xprev = true;
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/recipes" });
}

function show_recipe(name) {
	var html = "<div style='font-size: 24px'>";
	var prev = false,
		recipe = G.craft[name];
	var output = recipe.output || { name: name };
	html += "<div style='line-height: 50px; vertical-align: middle; padding: 12px'>";
	html += item_container({ skin: G.items[output.name].skin, onclick: "render_item_info('" + output.name + "')" }, output);
	html += " <span style='color: #00DE51'>" + "&lt;=" + "</span> ";
	recipe.items.forEach(function (i) {
		if (prev) html += " <span style='color: gray'>+</span> ";
		html += item_container({ skin: G.items[i[1]].skin, onclick: "render_item_info('" + i[1] + "')" }, { name: i[1], q: i[0], level: i[2] });
		prev = true;
	});
	if (recipe.cost) html += " <span style='color: gray'>+</span> <span style='color: gold'>" + to_pretty_num(recipe.cost) + "</span>";
	html += "</div>";
	html += "</div>";
	show_modal(html, { hideinbackground: true });
}

function render_cx_info(name) {
	if (G.skills[name] && G.skills[name].emote) return render_skill("", name);
	var html = "<div style='border: 5px solid gray; background-color: black; padding: 10px;'>";
	html += "<div style='float:left; margin-right: 10px'>" + cx_sprite(name, { mleft: 4 }) + "</div>";
	html +=
		" <span class='gray'>" +
		phrase.html("interface.cx_info.id") +
		"</span> " +
		name +
		"<br /><span class='gray'>" +
		phrase.html("interface.cx_info.type") +
		"</span> " +
		T[name] +
		" <br /><span class='gray'>" +
		phrase.html("interface.cx_info.slot") +
		"</span> " +
		cxtype_to_slot[T[name]];
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/cosmetics" });
}

function render_all_cosmetics() {
	precompute_image_positions();
	var types = [
		["hair", phrase.html("interface.gallery.hair"), []],
		["hat", phrase.html("interface.gallery.hat"), []],
		["chin", phrase.html("interface.gallery.chin"), []],
		["face", phrase.html("interface.gallery.face"), []],
		["head", phrase.html("interface.gallery.skin"), []],
		["armor", phrase.html("interface.gallery.armor"), []],
		["body", phrase.html("interface.gallery.body"), []],
		["character", phrase.html("interface.gallery.character"), []],
		["back", phrase.definition("slot", "back", "name", "Back"), []],
		["gravestone", phrase.html("interface.gallery.gravestone"), []],
		["", phrase.html("interface.gallery.other"), []],
	];
	var visited = {},
		html = "<div style='border: 5px solid gray; background-color: black; padding: 10px; width: 456px'>";
	object_sort(T).forEach(function (ti) {
		var val = ti[1],
			cid = ti[0];
		for (var i = 0; i < types.length; i++) {
			if (
				!types[i][0] ||
				val == types[i][0] ||
				(types[i][0] == "chin" && ["beard", "mask"].includes(val)) ||
				(types[i][0] == "hat" && ["hat", "a_hat"].includes(val)) ||
				(types[i][0] == "face" && ["face", "makeup", "a_makeup"].includes(val)) ||
				(types[i][0] == "back" && ["s_wings", "tail"].includes(val))
			) {
				types[i][2].push(cid);
				break;
			}
		}
	});
	types.forEach(function (type) {
		html += "<div class='gamebutton gamebutton-small' style='margin-bottom: 5px'>" + type[1] + "</div>";
		html += "<div style='margin-bottom: 10px'>";
		type[2].forEach(function (cid) {
			html += "<span class='clickable' onclick='render_cx_info(\"" + cid + "\")'>" + cx_sprite(cid, { mright: 4, labels: true }) + "</span>";
		});
		html += "</div>";
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/cosmetics" });
}

function render_all_items() {
	var types = [
		["helmet", phrase.html("interface.gallery.helmet"), []],
		["chest", phrase.html("interface.gallery.armor"), []],
		["pants", phrase.html("interface.gallery.pants"), []],
		["gloves", phrase.html("interface.gallery.gloves"), []],
		["shoes", phrase.html("interface.gallery.shoes"), []],
		["cape", phrase.html("interface.gallery.cape"), []],
		["ring", phrase.html("interface.gallery.ring"), []],
		["earring", phrase.html("interface.gallery.earring"), []],
		["amulet", phrase.html("interface.gallery.amulet"), []],
		["belt", phrase.html("interface.gallery.belt"), []],
		["orb", phrase.html("interface.gallery.orb"), []],
		["weapon", phrase.html("interface.gallery.weapon"), []],
		["shield", phrase.html("interface.gallery.shield"), []],
		["offhand", phrase.html("interface.gallery.offhand"), []],
		["elixir", phrase.html("interface.gallery.elixir"), []],
		["pot", phrase.html("interface.gallery.pot"), []],
		["scroll", phrase.html("interface.gallery.scroll"), []],
		["material", phrase.html("interface.recipes.crafting_and_collecting"), []],
		["exchange", phrase.html("interface.gallery.exchange"), []],
		["key", phrase.html("interface.gallery.key"), []],
		["", phrase.html("interface.gallery.other"), []],
	];
	var visited = {},
		html = "<div style='border: 5px solid gray; background-color: black; padding: 10px; width: 434px'>";
	object_sort(G.items, "gold_value").forEach(function (item) {
		if (item[1].ignore) return;
		for (var i = 0; i < types.length; i++) {
			if (
				!types[i][0] ||
				item[1].type == types[i][0] ||
				(types[i][0] == "offhand" && in_arr(item[1].type, ["source", "quiver", "misc_offhand"])) ||
				(types[i][0] == "scroll" && in_arr(item[1].type, ["cscroll", "uscroll", "pscroll", "offering"])) ||
				(types[i][0] == "exchange" && G.items[item[0]].e) ||
				(types[i][0] == "key" && item[1].type.indexOf("key") != -1)
			) {
				types[i][2].push(item);
				break;
			}
		}
	});
	types.forEach(function (type) {
		html += "<div class='gamebutton gamebutton-small' style='margin-bottom: 5px'>" + type[1] + "</div>";
		html += "<div style='margin-bottom: 10px'>";
		type[2].forEach(function (item) {
			html += item_container({ skin: G.items[item[0]].skin, onclick: "render_item_info('" + item[0] + "')" }, { name: item[0] });
		});
		html += "</div>";
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/items" });
}

function render_all_monsters() {
	var html = "";
	html += "<div style='width: 480px'>";
	object_sort(G.monsters, "hpsort").forEach(function (e) {
		if (((e[1].stationary || e[1].cute) && !e[1].achievements) || e[1].hide) return;
		html +=
			"<div style='background-color:#575983; border: 2px solid #9F9FB0; position: relative; display: inline-block; margin: 2px; /*" +
			e[0] +
			"*/' class='clickable' onclick='pcs(event); render_monster_info(\"" +
			e[0] +
			"\")'>";
		html += sprite(e[0], { scale: 1.5 });
		if (G.drops && G.drops.monsters && G.drops.monsters[e[0]] && G.drops.monsters[e[0]].length)
			html +=
				"<div style='background-color:#FD79B0; border: 2px solid #9F9FB0; position: absolute; bottom: -2px; right: -2px; display: inline-block; padding: 1px 1px 1px 1px; height: 2px; width: 2px'></div>";
		html += "</div>";
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/monsters", close: { classes: "ui-close-row" } });
}

function render_all_events() {
	tut("events");
	function event_html(e, key) {
		var ehtml = "";
		ehtml += " <div class='gamebutton mb5' style='padding: 6px 8px 6px 8px; font-size: 24px; line-height: 18px' onclick='pcs(event); open_guide(\"event-" + key + '","/docs/ref/event-' + key + "\")'>";
		ehtml += sprite(e.sprite, { overflow: true });
		ehtml += "<div style='color:" + e.color + "; margin-top: 1px'>" + phrase.definition("event", key, "name", e.name) + "</div>";
		ehtml += "</div>";
		return ehtml;
	}
	var html = "";
	html += "<div style='width: 480px; text-align: center'>";
	html += "<div class='block gamebutton gamebutton-small mb5'>" + phrase.html("interface.all_events.daily_events") + "</div>";
	object_sort(G.events).forEach(function (e) {
		if (e[1].type == "daily") html += event_html(e[1], e[0]);
	});
	html += "<div class='block gamebutton gamebutton-small mb5'>" + phrase.html("interface.all_events.nightly_events") + "</div>";
	object_sort(G.events).forEach(function (e) {
		if (e[1].type == "nightly") html += event_html(e[1], e[0]);
	});
	// html+="<div class='block gamebutton gamebutton-small mb5'>Random Events</div>";
	// 	object_sort(G.events).forEach(function(e){
	// 		if(e[1].type=="random")
	// 			html+=event_html(e[1],e[0]);
	// 	});
	html += "<div class='block gamebutton gamebutton-small mb5'>" + phrase.html("interface.all_events.seasonal_events") + "</div>";
	object_sort(G.events).forEach(function (e) {
		if (e[1].type == "seasonal") html += event_html(e[1], e[0]);
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/events" });
}

function render_guide(path, title, color) {
	var more = false,
		ref = false,
		suffix = "";
	docs = G.docs.guide;
	if (!path || is_string(path)) {
		((path = []), (more = true), (ref = true));
	} else {
		path.forEach(function (step) {
			for (var i = 0; i < docs.length; i++)
				if (docs[i][0] == step) {
					docs = docs[i][4];
					break;
				}
			suffix += "/" + step;
		});
	}
	// hide_modal();
	var html = "<div style='/*background-color: black; border: 5px solid gray; padding: 4px; */ width: 360px; text-align: center'>";
	var index = 0;
	if (ref) {
		html +=
			"<div class='gamebutton block' style='margin-bottom: 4px; background-color: #E5E5E5; color: #010805' onclick='render_tutorial_index()'><span style='color:#906CB4'>" +
			"[T]" +
			"</span>" +
			" " +
			phrase.html("interface.guide.tutorial_lessons") +
			"</div>";
		html += "<div class='guide-reference-row'>";
		html +=
			"<div class='gamebutton' style='background-color: #E5E5E5; color: #010805' onclick='render_all_items()'><span class='guide-reference-label'><span style='color: #328355'>" +
			"[I]" +
			"</span> <span class='guide-reference-text'>" +
			phrase.html("interface.guide.all_items") +
			"</span></span></div>";
		html +=
			"<div class='gamebutton' style='background-color: #E5E5E5; color: #010805' onclick='render_all_monsters()'><span class='guide-reference-label'><span style='color: #7F2D2A'>" +
			"[M]" +
			"</span> <span class='guide-reference-text'>" +
			phrase.html("interface.guide.all_monsters") +
			"</span></span></div>";
		html += "</div>";
		html += "<div class='guide-reference-row'>";
		html +=
			"<div class='gamebutton' style='background-color: #E5E5E5; color: #010805' onclick='render_all_skills_and_conditions()'><span class='guide-reference-label'><span style='color: #2A98AD'>" +
			"[S]" +
			"</span> <span class='guide-reference-text'>" +
			phrase.html("interface.guide.all_skills_amp_c") +
			"</span></span></div>";
		html +=
			"<div class='gamebutton' style='background-color: #E5E5E5; color: #010805' onclick='render_all_recipes()'><span class='guide-reference-label'><span style='color: #ED8131'>" +
			"[C]" +
			"</span> <span class='guide-reference-text'>" +
			phrase.html("interface.guide.all_recipes") +
			"</span></span></div>";
		html += "</div>";
	}
	if (title) {
		title = phrase.definition("directory", "guide", path[path.length - 1] + ".title", title);
		html +=
			"<div class='gamebutton' style='display: block; margin-bottom: 4px; background-color: #E5E5E5; color: #010805;'><span style='color: " + color + "'>[" + title[0] + "]</span> " + title + "</div>";
	}
	docs.forEach(function (n) {
		var display_title = phrase.definition("directory", "guide", n[0] + ".title", n[1]);
		if (n[4]) {
			path.push(n[0]);
			html +=
				"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='render_guide(" +
				JSON.stringify(path).replace_all("'", '"') +
				',"' +
				n[1] +
				'","' +
				n[3] +
				"\")'><span style='color: " +
				n[3] +
				"'>[" +
				display_title[0] +
				"]</span> " +
				display_title +
				" <span style='color: #96979E'>[" +
				n[4].length +
				"]</span></div>";
			path.pop();
		} else
			html +=
				"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='open_guide(\"" +
				n[0] +
				'","/docs/guide' +
				suffix +
				"/" +
				n[0] +
				"\")'><span style='color: " +
				n[3] +
				"'>[" +
				display_title[0] +
				"]</span> " +
				display_title +
				"</div>";
		index++;
	});
	if (ref && inside != "docs") {
		// html+="<div class='gamebutton' style='background-color: #E5E5E5; color: #010805; float: left; width: 145px' onclick='hide_modal(); render_code_articles()'><span style='color: #4FB7E5'>[C]</span> Code Guide</div>";
		html +=
			"<div class='gamebutton' style='display: block; margin-bottom: 4px; background-color: #E5E5E5; color: #010805;' onclick='hide_modal(); render_code_docs()'><span style='color: #D8C14F'>" +
			"[X]" +
			"</span>" +
			" " +
			phrase.html("interface.guide.code_docs") +
			"</div>";
	}
	if (more) html += "<div class='gamebutton' style='display: block; margin-bottom: 4px; color: #85C76B'>" + phrase.html("interface.guide.guide_is_a_work_in_progress") + "</div>";
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide" + suffix });
	var buttons = $(".modal:last .guide-reference-row > .gamebutton").toArray();
	if (!buttons.length) return;
	var segmenter = typeof Intl != "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
	var labels = buttons.map(function (button) {
		var label = button.firstElementChild,
			text = label.lastElementChild,
			value = text.textContent;
		button.title = label.textContent;
		button.setAttribute("aria-label", button.title);
		var letters = segmenter
			? Array.from(segmenter.segment(value), function (part) {
					return part.segment;
				})
			: Array.from(value);
		return { button: button, label: label, text: text, value: value, letters: letters };
	});
	function fit_buttons() {
		var visible = false;
		labels.forEach(function (entry) {
			var button = entry.button,
				label = entry.label,
				padding = 12;
			if (!button.isConnected || !button.clientWidth) return;
			visible = true;
			entry.text.textContent = entry.value;
			button.style.padding = "12px";
			while (padding > 2 && (label.scrollHeight > 48 || label.scrollWidth > label.clientWidth)) {
				padding -= 2;
				button.style.paddingLeft = button.style.paddingRight = padding + "px";
			}
			var letters = entry.letters.slice();
			while (letters.length && (label.scrollHeight > 48 || label.scrollWidth > label.clientWidth)) {
				letters.pop();
				entry.text.textContent = letters.join("").trimEnd() + ".";
			}
			button.style.paddingTop = button.style.paddingBottom = label.scrollHeight > 24 ? "0px" : "12px";
		});
		if (visible) position_modals();
	}
	fit_buttons();
	if (document.fonts) document.fonts.ready.then(fit_buttons);
	if (window.ResizeObserver) {
		var observer = new ResizeObserver(function () {
			buttons.forEach(function (button) {
				if (!button.isConnected) observer.unobserve(button);
			});
			fit_buttons();
		});
		buttons.forEach(function (button) {
			observer.observe(button);
		});
	}
}

function render_code_articles(path, title, color) {
	var more = false,
		suffix = "";
	docs = G.docs.articles;
	if (!path) ((path = []), (more = true));
	else {
		path.forEach(function (step) {
			for (var i = 0; i < docs.length; i++)
				if (docs[i][0] == step) {
					docs = docs[i][3];
					break;
				}
			suffix += "/" + step;
		});
	}
	// hide_modal();
	var html = "<div style='/*background-color: black; border: 5px solid gray; padding: 4px; */min-width: 320px; text-align: center'>";
	var index = 0;
	if (title) {
		title = phrase.definition("directory", "articles", path[path.length - 1] + ".title", title);
		html +=
			"<div class='gamebutton' style='display: block; margin-bottom: 4px; background-color: #E5E5E5; color: #010805;'><span style='color: " + color + "'>[" + title[0] + "]</span> " + title + "</div>";
	}
	docs.forEach(function (n) {
		var display_title = phrase.definition("directory", "articles", n[0] + ".title", n[1]);
		if (n[3]) {
			path.push(n[0]);
			html +=
				"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='render_code_articles(" +
				JSON.stringify(path).replace_all("'", '"') +
				',"' +
				n[1] +
				'","' +
				n[2] +
				"\")'><span style='color: " +
				n[2] +
				"'>[" +
				display_title[0] +
				"]</span> " +
				display_title +
				" <span style='color: #96979E'>[" +
				n[3].length +
				"]</span></div>";
			path.pop();
		} else
			html +=
				"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='open_article(\"" +
				n[0] +
				'","/docs/code/learn' +
				suffix +
				"/" +
				n[0] +
				"\")'><span style='color: " +
				n[2] +
				"'>[" +
				display_title[0] +
				"]</span> " +
				display_title +
				"</div>";
		index++;
	});
	if (more) html += "<div class='gamebutton' style='display: block; margin-bottom: 4px; color: #85C76B'>" + phrase.html("interface.code_articles.more_articles_coming_soon") + "</div>";
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/code/learn" + suffix });
}

function render_objects_reference(docs) {
	// hide_modal();
	var html = "<div style='/*background-color: black; border: 5px solid gray; padding: 4px; */min-width: 320px'>";
	var index = 0;
	G.docs.objects.forEach(function (n) {
		html +=
			"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='open_article(\"" + n[0] + "\")'>" + phrase.definition("directory", "objects", n[0] + ".title", n[1]) + "</div>";
		index++;
	});
	html += "<div class='gamebutton' style='display: block; margin-bottom: 4px; color: #85C76B'>" + phrase.html("interface.objects_reference.work_in_progress") + "</div>";
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true });
}

function render_useful_links() {
	// hide_modal();
	var html = "<div style='/*background-color: black; border: 5px solid gray; padding: 4px; */width: 400px'>";
	html +=
		"<a class='gamebutton eexternal' style='display: block; margin-bottom: 4px; border-color: #4B95B2' target='_blank' href='https://jsconsole.com'>" +
		phrase.html("interface.useful_links.jsconsole_com") +
		"</a>";
	html += '<div class="mt4 blockbutton" style="text-align: left; margin-bottom: 4px">' + phrase.html("interface.useful_links.a_very_practical_website_to_play_with_javascript_in_a") + "</div>";
	html +=
		"<a class='gamebutton eexternal' style='display: block; margin-bottom: 4px; border-color: #4B95B2' target='_blank' href='https://www.codecademy.com/learn/learn-javascript'>" +
		phrase.html("interface.useful_links.code_academy_javascript") +
		"</a>";
	html += '<div class="mt4 blockbutton" style="text-align: left; margin-bottom: 4px">' + phrase.html("interface.useful_links.code_academy_s_javascript_course_if_you_want_to_learn") + "</div>";
	html +=
		"<a class='gamebutton eexternal' style='display: block; margin-bottom: 4px; border-color: #4B95B2' target='_blank' href='https://github.com/kaansoral/adventureland_mongodb'>" +
		phrase.html("interface.useful_links.adventure_land_s_github") +
		"</a>";
	html += '<div class="mt4 blockbutton" style="text-align: left; margin-bottom: 4px">' + phrase.html("interface.useful_links.todo_create_a_gallery_of_player_s_github_repos") + "</div>";
	html +=
		"<a class='gamebutton eexternal' style='display: block; margin-bottom: 4px; border-color: #4B95B2' target='_blank' href='https://discord.gg/X3QyCJd'>" +
		phrase.html("interface.useful_links.code_beginner_on_discord") +
		"</a>";

	html += "</div>";
	show_modal(html, { wrap: false, url: "/docs/code/links" });
}

function render_data_reference(path, id) {
	// if(!id) hide_modal();
	if (!id) path = [];
	else path.push(id);
	var data = G,
		str = "G",
		suffix = "";
	path.forEach(function (p) {
		data = data[p];
		str = str + "." + p;
		if (!suffix) suffix += "/" + p;
	});
	if (is_object(data) && path.length < 2 && !in_arr(id, ["levels"])) {
		// var html="<div style='/*background-color: black; border: 5px solid gray; padding: 6px;*/ min-width: 320px'>";
		var html = "<div style='background-color: black; border: 5px solid gray; padding: 24px; min-width: 272px'>";
		object_sort(data).forEach(function (nd) {
			var n = nd[0];
			// html+="<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='render_data_reference("+JSON.stringify(path)+",\""+n+"\")'>"+str+"."+n+"</div>";
			html +=
				"<div style='display: block; margin-bottom: 4px; font-size: 32px' class='clickable' onclick='render_data_reference(" + JSON.stringify(path) + ',"' + n + "\")'>" + str + "." + n + "</div>";
		});
		html += "</div>";
		show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/code/data" + suffix });
	} else {
		show_json(game_stringify_simple(data, "\t"));
	}
}

var csearch_value = undefined,
	codesearch_value = undefined;
function csearch_logic(place) {
	var value = "",
		one = false;
	if (place == "ui") {
		value = $(".codesearch").val();
		if (value == codesearch_value) return;
		codesearch_value = value;
	} else {
		value = $(".csearchi").val();
		if (value == csearch_value) return;
		csearch_value = value;
	}
	if (value.length || place == "ui") {
		var html = "";
		var query;
		try {
			query = new RegExp(value, "i");
		} catch (e) {
			// Keep searching while a regular expression is still being typed.
			query = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
		}
		if (place == "ui") {
		} else {
			$(".cdocsbuttons").hide();
			$(".cdocssearch").show();
		}
		G.docs.references.forEach(function (ref) {
			if (ref[2].search(query) !== -1 || (place == "ui" && !value)) {
				one = true;
				if (!place)
					html +=
						"<div class='gamebutton' style='display: block; margin-bottom: 4px; text-align: left' onclick='open_guide(\"" +
						ref[0] +
						'","/docs/guide/' +
						ref[0] +
						"\")'><span style='color:#69BE86'>" +
						phrase.html("interface.csearch_logic.reference") +
						"</span> " +
						ref[1] +
						"</div>";
				else html += "<div class='clickable' onclick='open_guide(\"" + ref[0] + '","/docs/guide/' + ref[0] + "\")'><span style='color:#69BE86'>" + "[R]" + "</span> " + ref[1] + "</div>";
			}
		});
		var articles = [];
		function parse_articles(article) {
			if (is_array(article[0])) {
				article.forEach(function (a) {
					parse_articles(a);
				});
			} else {
				if (!article[4]) articles.push(article);
				else parse_articles(article[4]);
			}
		}
		parse_articles(G.docs.guide);
		// console.log(articles);
		articles.forEach(function (article) {
			if (!article[2]) return;
			if (article[2].search(query) !== -1 || (place == "ui" && !value)) {
				one = true;
				if (!place)
					html +=
						"<div class='gamebutton' style='display: block; margin-bottom: 4px; text-align: left' onclick='open_guide(\"" +
						article[0] +
						'","/docs/guide/' +
						article[0] +
						"\")'><span style='color:#E78E4E'>" +
						phrase.html("interface.csearch_logic.article") +
						"</span> " +
						article[1] +
						"</div>";
				else html += "<div class='clickable' onclick='open_guide(\"" + article[0] + '","/docs/guide/' + article[0] + "\")'><span style='color:#E78E4E'>" + "[A]" + "</span> " + article[1] + "</div>";
			}
		});
		G.docs.javascript.forEach(function (ref) {
			if (ref[1].search(query) !== -1 || (place == "ui" && !value)) {
				one = true;
				if (!place)
					html +=
						"<div><a class='gamebutton eexternal' style='display: block; margin-bottom: 4px; text-align: left' href='" +
						ref[2] +
						"' target='_blank'><span style='color:#A6B7C9'>" +
						phrase.html("interface.csearch_logic.mdn") +
						"</span> " +
						ref[0] +
						"</a></div>";
				else html += "<div><a class='cancela eexternal' href='" + ref[2] + "' target='_blank'><span style='color:#A6B7C9'>" + "[J]" + "</span> " + ref[0] + "</a></div>";
			}
		});
		for (var name in G) {
			if (name.search(query) !== -1 || value == "[G]" || (place == "ui" && !value)) {
				one = true;
				if (!place)
					html +=
						"<div class='gamebutton' style='display: block; margin-bottom: 4px; text-align: left' onclick='render_data_reference([],\"" +
						name +
						"\")'><span style='color:#8468BB'>" +
						phrase.html("interface.csearch_logic.gamedata") +
						"</span>" +
						" " +
						phrase.html("interface.csearch_logic.g", { name: name }) +
						"</div>";
				else
					html +=
						"<div class='clickable' onclick='render_data_reference([],\"" +
						name +
						"\")'><span style='color:#8468BB'>" +
						"[G]" +
						"</span>" +
						" " +
						phrase.html("interface.csearch_logic.g", { name: name }) +
						"</div>";
			}
		}
		G.docs.functions.forEach(function (n) {
			if (n.search(query) == -1 && value != "[F]" && !(place == "ui" && !value)) return;
			if (in_arr(n, G.docs.documented)) {
				if (!place)
					html +=
						"<div class='gamebutton' style='display: block; margin-bottom: 4px; text-align: left' onclick='api_call(\"load_article\",{name:\"" +
						n +
						"\",func:true});'><span style='color:#d6d135'>" +
						phrase.html("interface.csearch_logic.function") +
						"</span> " +
						n +
						"</div>";
				else html += "<div class='clickable' onclick='api_call(\"load_article\",{name:\"" + n + "\",func:true});'><span style='color:#d6d135'>" + "[F]" + "</span> " + n + "</div>";
			} else {
				if (!place)
					html +=
						"<div class='gamebutton' style='display: block; margin-bottom: 4px; text-align: left' onclick='render_function_reference(\"" +
						n +
						"\")'><span style='color:#d6d135'>" +
						phrase.html("interface.csearch_logic.function") +
						"</span> " +
						n +
						"</div>";
				else html += "<div class='clickable' onclick='render_function_reference(\"" + n + "\")'><span style='color:#d6d135'>" + "[F]" + "</span> " + n + "</div>";
			}
			one = true;
		});
		if (!one && !place) html += "<div class='gamebutton' style='display: block; margin-bottom: 4px'><span style='color:#575455'>" + phrase.html("interface.csearch_logic.none_found") + "</span></div>";
		else if (!one) html += "<div style='color:#575455'>" + phrase.html("interface.csearch_logic.none_found") + "</div>";
		if (place == "ui") {
			last_hint = undefined;
			$("#codehint").remove();
			$("#codelog").html(html);
		} else $(".cdocssearch").html(html);
	} else {
		$(".cdocsbuttons").show();
		$(".cdocssearch").hide();
		position_modals();
	}
}

function render_code_docs() {
	csearch_value = undefined;
	var html = "<div style='width:400px'>";
	//html+="<div class='gamebutton' style='display: block; border-color: #EDF259; margin-bottom: 4px' onclick='render_code_articles()'>Learn [Basic to Advanced]</div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #A79674;*/ margin-bottom: 4px'><span style='color:#37DBC1'>" +
		phrase.html("interface.code_docs.search") +
		"</span> <input type='text' class='csearchi' style='font-family:var(--pixel-font, pixel); font-size:24px; margin-bottom: -8px; width: 150px; margin-left: 5px'></div>";
	html += "<div class='cdocssearch hidden'>";
	html += "</div>";
	html += "<div class='cdocsbuttons'>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #A79674;*/ margin-bottom: 4px' onclick='pcs(); $(\".csearchi\").val(\"[F]\"); csearch_logic();/*render_functions_directory()*/'><span style='color:#B7BE45'>" +
		"[F]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.available_functions") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #0AAFF1;*/ margin-bottom: 4px' onclick='pcs(); $(\".csearchi\").val(\"[G]\"); csearch_logic();/*render_data_reference()*/'><span style='color:#8468BB'>" +
		"[G]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.game_data") +
		"</div>";
	// html+="<div class='gamebutton' style='display: block; /*border-color: #EF688C;*/ margin-bottom: 4px' onclick='pcs(); render_objects_reference()'>Objects Reference <span style='color:#64B454'>[WIP]</span></div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #EF688C;*/ margin-bottom: 4px' onclick='pcs(); open_article(\"data-character\",\"/docs/code/character/reference\")'><span style='color:#64B454'>" +
		"[C]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.character_reference") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #EF688C;*/ margin-bottom: 4px' onclick='pcs(); open_article(\"data-monster\",\"/docs/code/monster/reference\")'><span style='color:#58A1B0'>" +
		"[M]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.monster_reference") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #EF688C;*/ margin-bottom: 4px' onclick='pcs(); open_article(\"data-server-status\",\"/docs/code/server/status\")'><span style='color:#69BE86'>" +
		"[S]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.server_status") +
		"</div>";
	//html+="<div class='gamebutton' style='display: block; /*border-color: #F0924A;*/ margin-bottom: 4px' onclick='pcs(); add_log(\"Coming soon!\")'>Javascript Events <span style='color:gray'>[Soon]</span></div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #F0924A;*/ margin-bottom: 4px' onclick='pcs(); open_article(\"events-game\",\"/docs/code/game/events\")'><span style='color:#8468BB'>" +
		"[E]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.game_events") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #F0924A;*/ margin-bottom: 4px' onclick='pcs(); open_article(\"events-character\",\"/docs/code/character/events\")'><span style='color:#E36B1A'>" +
		"[C]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.character_events") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; /*border-color: #A5A5A5;*/ margin-bottom: 4px' onclick='pcs(); render_useful_links()'><span style='color:#B9495B'>" +
		"[U]" +
		"</span>" +
		" " +
		phrase.html("interface.code_docs.useful_links") +
		"</div>";
	html += '<div class="mt4 blockbutton" style="text-align: left">' + phrase.html("interface.code_docs.note_code_documentation_is_a_work_in_progress_you_can") + "</div>";
	html += "</div>";
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/code" });
	$(".csearchi").bind("propertychange change click keyup input paste", function (event) {
		csearch_logic();
	});
}

function render_others() {
	var html = "<div style='width:400px'>";
	//html+="<div class='gamebutton' style='display: block; border-color: #EDF259; margin-bottom: 4px' onclick='render_code_articles()'>Learn [Basic to Advanced]</div>";
	html += "<div>";
	html +=
		"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='pcs(); show_modal($(\"#keymapguide\").html(),{url:\"/docs/ref/keymapping\"})'><span style='color:#F96527'>" +
		"[S]" +
		"</span>" +
		" " +
		phrase.html("interface.others.skillbar_and_keymapping") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='pcs(); show_modal($(\"#boosterguide\").html(),{url:\"/docs/ref/boosters\"})'><span style='color:#52B3FC'>" +
		"[B]" +
		"</span>" +
		" " +
		phrase.html("interface.others.using_boosters") +
		"</div>";
	html +=
		"<div class='gamebutton' style='display: block; margin-bottom: 4px' onclick='pcs(); show_modal($(\"#shellsinfo\").html(),{url:\"/docs/ref/shells\"})'><span style='color:#47BA4E'>[$]</span>" +
		" " +
		phrase.html("interface.others.about_shells") +
		"</div>";
	html += "</div>";
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/ref" });
}

function render_wishlist(num, page) {
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 12px 20px 20px 20px; font-size: 24px; display: inline-block'>";
	html +=
		"<div style='color: #f1c054; border-bottom: 2px dashed #C7CACA; margin-bottom: 3px; margin-left: 3px; margin-right: 3px' class='cbold'>" + phrase.html("interface.wishlist.wishlist") + "</div>";
	var items = [],
		last = 0;
	for (var name in G.items) if (!G.items[name].ignore) items.push([name, G.items[name], G.items[name].g || 0]);
	items.sort(function (a, b) {
		return b[2] - a[2];
	});
	if (page >= 1) last += 19 + (page - 1) * 18;
	for (var i = 0; i < 4; i++) {
		html += "<div>";
		for (var j = 0; j < 5; j++) {
			if (i == 3 && j == 0 && page != 0) html += item_container({ skin: "left", onclick: "render_wishlist(" + num + "," + (page - 1) + ");" }, { q: page, left: true });
			else if (i == 3 && j == 4 && last < items.length - 1) html += item_container({ skin: "right", onclick: "render_wishlist(" + num + "," + (page + 1) + ");" }, { q: page + 2, left: true });
			else if (last < items.length && items[last++]) {
				var id = "wishlist" + (last - 1),
					item = items[last - 1][1],
					name = items[last - 1][0];
				html += item_container({ skin: item.skin, onclick: "wishlist_item_click('" + name + "'," + num + ")", def: item, id: id, draggable: false, droppable: false }, null);
			} else {
				html += item_container({ size: 40, draggable: false, droppable: false });
			}
		}
		html += "</div>";
	}
	html += "</div>";
	render_ui_panel("#topleftcornerdialog", html);
	dialogs_target = character;
}

var last_selector = "";
function render_item(selector, args) {
	if (args && args.actual) args.name = args.actual.name;
	var item = args.item || { skin: "test", name: phrase.html("interface.item.unrecognized"), explanation: phrase.html("interface.item.unrecognized_explanation") },
		name = args.name,
		color = "gray",
		value = args.value,
		cash = args.cash,
		item_name = item.name,
		trade_item = false;
	var actual = args && args.actual;
	if (selector && selector != "html") last_selector = selector;
	else if (selector != "html") selector = last_selector;
	var prop = args.prop || calculate_item_properties(actual || {}, { def: item, class: window.character && character.ctype, map: window.character && character.map }),
		grade = calculate_item_grade(item, actual || {});
	var html = "";
	if (!args.pure)
		html +=
			"<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 240px; " +
			(item.encouragement ? "position: relative; " : "") +
			(args.styles || "") +
			"' class='buyitem'>";
	if (!item) html += phrase.html("interface.item.item");
	else {
		if (item.type == "tarot" && item.minor) html += "<img style='display: inline-block; margin: -8px 2px -6px -8px;' src='/images/cards/tarot/minor_arcana/tarot__" + item.minor + ".png' />";
		else if (item.type == "tarot") html += "<img style='display: inline-block; margin: -8px 2px -6px -8px;' src='/images/cards/tarot/major_arcana/tarot__" + item.major + ".png' />";
		color = "#E4E4E4"; // previously gray [16/08/16]
		if (item.grade == "mid") color = "blue"; // lol - must be old [13/04/20]
		if (actual && actual.p && G.titles[actual.p]) item_name = G.titles[actual.p].title + " " + item_name;
		else if (actual && actual.p) item_name = actual.p.toTitleCase() + " " + item_name;
		if (prop.level) {
			if (item.upgrade && prop.level == 12) item_name += " +Z";
			else if (item.upgrade && prop.level == 11) item_name += " +Y";
			else if (item.upgrade && prop.level == 10) item_name += " +X";
			else if (item.compound && prop.level == 7) item_name += " +R";
			else if (item.compound && prop.level == 6) item_name += " +S";
			else if (item.compound && prop.level == 5) item_name += " +V";
			else item_name += " +" + prop.level;
		}
		if (args.thumbnail) {
			html += "<div style='margin-left:-2px'>" + item_container({ skin: item.skin, def: item }) + "</div>";
		}
		if (item.card) {
			html += "<div style='display:inline-block; vertical-align: top'>";
			html += "<div style='color: " + color + "; display: inline-block; border-bottom: 2px dashed gray; margin-bottom: 3px' class='cbold'>" + item_name + "</div><div></div>";
			html += "<div style='color: " + color + "; display: inline-block; border-bottom: 2px dashed gray; margin-bottom: 3px; color: #AB7951' class='cbold'>" + item.card + "</div>";
			html += "</div>";
		} else if (!args.pure) {
			html += "<div style='color: " + color + "; display: inline-block; border-bottom: 2px dashed gray; margin-bottom: 3px' class='cbold'>" + item_name + "</div>";
		}
		if (prop.miss && item.type == "elixir") html += bold_prop_line(phrase.html("interface.item.alcohol"), prop.miss + "%", "#7CAAF6");
		(item.gives || []).forEach(function (prop) {
			if (prop[0] == "hp" && prop[1] < 0) html += bold_prop_line(phrase.html("stat.hp.name"), to_pretty_num(prop[1]), colors.hp);
			else if (prop[0] == "hp") html += bold_prop_line(phrase.html("stat.hp.name"), "+" + to_pretty_num(prop[1]), colors.hp);
			if (prop[0] == "mp") html += bold_prop_line(phrase.html("stat.mp.name"), "+" + to_pretty_num(prop[1]), colors.mp);
		});
		if (item.debuff) html += bold_prop_line(phrase.html("interface.item.effect"), phrase.html("interface.item.debuff"), "#343792");
		if (args.monster) {
			html += bold_prop_line(phrase.html("interface.item.name"), item.name);
			html +=
				"<span class='clickable' onclick='show_json(G.monsters." +
				args.monster +
				',{prefix:"G.monsters.",name:"' +
				args.monster +
				"\"})'>" +
				bold_prop_line(phrase.html("interface.item.show"), "G.monsters.<span style='color:" + colors.property + ";'>" + args.monster + "</span>", colors.inspect) +
				"</span>";
			html +=
				"<span class='clickable' onclick='monster_x(\"" +
				args.monster +
				"\")'>" +
				bold_prop_line(phrase.html("interface.item.find"), "<span style='color:" + colors.string + ";'>\"" + args.monster + '"</span>', "#7AD963") +
				"</span>";
		}
		if (prop.gold) html += bold_prop_line(phrase.html("interface.item.gold"), ((prop.gold > 0 && "+") || "") + prop.gold + "%", "gold");
		if (prop.luck) html += bold_prop_line(phrase.html("interface.item.luck"), ((prop.luck > 0 && "+") || "") + prop.luck + "%", "#5DE376");
		if (prop.xp) html += bold_prop_line(phrase.html("stat.xp.name"), ((!args.monster && prop.xp > 0 && "+") || "") + prop.xp + ((!args.monster && "%") || ""), "#1E73DE");
		if (prop.lifesteal) html += bold_prop_line(phrase.html("interface.item.lifesteal"), to_pretty_float(prop.lifesteal) + "%", colors.lifesteal);
		if (prop.manasteal) html += bold_prop_line(phrase.html("interface.item.manasteal"), to_pretty_float(prop.manasteal) + "%", colors.manasteal);
		if (item.goldsteal) html += bold_prop_line(phrase.html("interface.item.goldsteal"), phrase.html("interface.item.dynamic"), "gold");
		if (prop.evasion) html += bold_prop_line(phrase.html("interface.item.evasion"), to_pretty_float(prop.evasion) + "%", "#7AC0F5");
		if (prop.avoidance) html += bold_prop_line(phrase.html("interface.item.avoidance"), to_pretty_float(prop.avoidance) + "%", "#7AC0F5");
		if (prop.miss && item.type != "elixir") html += bold_prop_line(phrase.html("interface.item.miss"), prop.miss + "%", "#F36C6E");
		if (prop.reflection) html += bold_prop_line(phrase.html("interface.item.reflection"), to_pretty_float(prop.reflection) + "%", "#B484E5");
		if (prop.dreturn) html += bold_prop_line(phrase.html("interface.item.d_return"), to_pretty_float(prop.dreturn) + "%", "#E94959");
		if (prop.crit) html += bold_prop_line(phrase.html("interface.item.crit"), to_pretty_float(prop.crit) + "%", "#E52967");
		if (prop.critdamage) html += bold_prop_line(phrase.html("interface.item.crit_damage"), "+" + to_pretty_float(prop.critdamage) + "%", "#A8214E");
		if (prop.attack) html += bold_prop_line(phrase.html("interface.item.damage"), prop.attack, colors.attack);
		if (item.damage_type) {
			if (item.damage_type == "pure") html += bold_prop_line(phrase.html("interface.item.type"), phrase.html("interface.item.pure"), "#AA9B55");
			else if (item.damage_type == "magical") html += bold_prop_line(phrase.html("interface.item.type"), phrase.html("interface.item.magical"), "#8998AA");
			else if (item.damage_type == "physical") html += bold_prop_line(phrase.html("interface.item.type"), phrase.html("interface.item.physical"), "#93AB98");
		}
		if (prop.range) html += bold_prop_line(phrase.html("interface.item.range"), ((!args.monster && "+") || "") + prop.range, colors.range);
		if (prop.hp) html += bold_prop_line(phrase.html("stat.hp.name"), prop.hp, colors.hp);
		if (prop.str) html += bold_prop_line(phrase.html("interface.item.strength"), prop.str, colors.str);
		if (prop["int"]) html += bold_prop_line(phrase.html("interface.item.intelligence"), prop["int"], colors["int"]);
		if (prop.dex) html += bold_prop_line(phrase.html("interface.item.dexterity"), prop.dex, colors.dex);
		if (prop.vit) html += bold_prop_line(phrase.html("interface.item.vitality"), prop.vit, colors.hp);
		if (prop["for"]) html += bold_prop_line(phrase.html("interface.item.fortitude"), prop["for"], colors["for"]);
		if (prop.mp) html += bold_prop_line(phrase.html("stat.mp.name"), prop.mp, colors.mp);
		if (prop.mp_cost > 0) html += bold_prop_line(phrase.html("interface.item.attack_mp_cost"), "+" + prop.mp_cost, colors.mp);
		else if (prop.mp_cost) html += bold_prop_line(phrase.html("interface.item.attack_mp_cost"), prop.mp_cost, colors.mp);
		if (prop.mp_reduction > 0) html += bold_prop_line(phrase.html("interface.item.skill_mp_reduction"), "%" + prop.mp_reduction, colors.mp);
		else if (prop.mp_reduction) html += bold_prop_line(phrase.html("interface.item.skill_mp_increase"), "%" + -prop.mp_reduction, colors.mp);
		if (prop.stat) html += bold_prop_line(phrase.html("interface.item.stat"), prop.stat);
		if (prop.armor) html += bold_prop_line(phrase.html("interface.item.armor"), prop.armor, colors.armor);
		if (prop.apiercing) html += bold_prop_line(phrase.html("interface.item.a_piercing"), prop.apiercing, colors.armor);
		if (prop.rpiercing) html += bold_prop_line(phrase.html("interface.item.r_piercing"), prop.rpiercing, colors.resistance);
		if (prop.resistance) html += bold_prop_line(phrase.html("interface.item.resistance"), prop.resistance, colors.resistance);
		if (prop.pnresistance) html += bold_prop_line(phrase.html("interface.item.poison_res"), prop.pnresistance, "#68B84B");
		if (prop.firesistance) html += bold_prop_line(phrase.html("interface.item.fire_res"), prop.firesistance, "#B42B22");
		if (prop.fzresistance) html += bold_prop_line(phrase.html("interface.item.freeze_res"), prop.fzresistance, "#69B1B6");
		if (prop.phresistance) html += bold_prop_line(phrase.html("interface.item.impact_res"), prop.phresistance, "#69B1B6");
		if (prop.stresistance) html += bold_prop_line(phrase.html("interface.item.status_res"), prop.stresistance, "#9FA7B6");
		if (item.wspeed) html += bold_prop_line(phrase.html("interface.item.speed"), phrase.definition("speed", item.wspeed, "name", item.wspeed.toTitleCase()), "gray");
		if (prop.speed)
			html += bold_prop_line(
				(item.wtype && phrase.html("interface.item.run_speed")) || phrase.html("interface.item.speed"),
				((!args.monster && prop.speed > 0 && "+") || "") + prop.speed,
				colors.speed,
			);
		if (prop.frequency || args.monster) html += bold_prop_line(phrase.html("interface.item.a_speed"), (prop.frequency || 1) * ((args.monster && 100) || 1), "#3BE681");
		if (prop.output) html += bold_prop_line(phrase.html("interface.item.damage_output"), ((prop.output > 0 && "+") || "") + prop.output + "%", "#D93319");
		if (prop.incdmgamp) html += bold_prop_line(phrase.html("interface.item.incoming_damage"), prop.incdmgamp + "%", "#D93319");
		if (prop.stun) html += bold_prop_line(phrase.html("interface.item.stun"), prop.stun + "%", "#784224");
		if (prop.explosion) html += bold_prop_line(phrase.html("interface.item.explosion"), prop.explosion + "%", "#782D33");
		if (prop.blast) html += bold_prop_line(phrase.html("interface.item.blast"), prop.blast + "%", "#685079");
		if (prop.breaks && prop.breaks > 0) html += bold_prop_line(phrase.html("interface.item.breaks"), to_pretty_float(prop.breaks) + "%", "#782D33");
		if (prop.charisma) html += bold_prop_line(phrase.html("interface.item.charisma"), prop.charisma, "#4DB174");
		if (prop.awesomeness) html += bold_prop_line(phrase.html("interface.item.awesomeness"), prop.awesomeness, "#FFDE2F");
		if (prop.bling) html += bold_prop_line(phrase.html("interface.item.bling"), prop.bling, "#A4E6FF");
		if (prop.cuteness) html += bold_prop_line(phrase.html("interface.item.cuteness"), prop.cuteness, "#FD82F0");
		if (prop.intensity) html += bold_prop_line(phrase.html("interface.item.intensity"), prop.intensity, "#786D6A");
		if (prop.courage) html += bold_prop_line(phrase.html("interface.item.courage"), prop.courage, "#9E1813");
		if (prop.mcourage) html += bold_prop_line(phrase.html("interface.item.m_courage"), prop.mcourage, "#4628A0");
		if (prop.pcourage) html += bold_prop_line(phrase.html("interface.item.p_courage"), prop.pcourage, "#D19D32");
		if (grade == 1 && item.type != "booster") html += bold_prop_line(phrase.html("interface.item.grade"), phrase.html("interface.item.high"), "#696354");
		if (grade == 2 && item.type != "booster") html += bold_prop_line(phrase.html("interface.item.grade"), phrase.html("interface.item.rare"), "#6668AC");
		if (grade == 3 && item.type != "booster") html += bold_prop_line(phrase.html("interface.item.grade"), phrase.html("interface.item.legendary"), "#39A868");
		if (grade == 4 && item.type != "booster") html += bold_prop_line(phrase.html("interface.item.grade"), phrase.html("interface.item.exalted"), "#2875F9"); // gold: "#E5A818" purple: #8B3EE6" dark-pink: #e84664
		if (prop.poisonous) html += "<div style='color: " + colors.poison + "'>" + phrase.html("interface.item.poisonous") + "</div>";
		if (prop.cooperative) html += "<div style='color: #aeaeae'>" + phrase.html("interface.item.cooperative") + "</div>";
		if (prop.peaceful) html += "<div style='color: #54B25F'>" + phrase.html("interface.item.peaceful") + "</div>";
		if (prop.supporter) html += "<div style='color: #CA5931'>" + phrase.html("interface.item.supporter") + "</div>";
		if (prop.abilities) {
			for (var id in prop.abilities) {
				if (!G.skills[id]) continue;
				html += info_line({
					name: (prop.abilities[id].aura && phrase.html("interface.item.aura")) || phrase.html("interface.item.ability"),
					color: "#FC5F39",
					value: phrase.definition("skill", id, "name", G.skills[id].name),
					onclick: "dialogs_target=xtarget||ctarget; render_skill('#topleftcornerdialog','" + id + "')",
				});
			}
		}
		if (prop.spawns) {
			prop.spawns.forEach(function (s) {
				html += info_line({ name: phrase.html("interface.item.spawns"), color: "#237B2A", value: G.monsters[s[1]].name, onclick: "render_monster_info('" + s[1] + "')" });
			});
		}
		for (var mname in G.maps)
			if (item[mname]) {
				html +=
					"<div><span style='color: #7738E8;'>" +
					phrase.html("interface.item.bonus") +
					"</span>: <span class='clickable' onclick='stpr(event); show_json(" +
					JSON.stringify(item[mname]) +
					")'>" +
					phrase.html("interface.item.only", { map: G.maps[mname].name }) +
					"</span></div>";
			}
		for (var cname in G.classes)
			if (item[cname]) {
				html +=
					"<div><span style='color: #7738E8;'>" +
					phrase.html("interface.item.bonus") +
					"</span>: <span class='clickable' onclick='stpr(event); show_json(" +
					JSON.stringify(item[cname]) +
					")'>" +
					phrase.html("interface.item.only_2", { value: phrase.definition("class", cname, "name", cname.toTitleCase()) }) +
					"</span></div>";
			}
		if (args.count) html += bold_prop_line(phrase.html("interface.item.kills"), to_pretty_num(args.count), "#7D0C15");
		if (args.score) html += bold_prop_line(phrase.html("interface.item.score"), to_pretty_num(args.score), "#C38737");
		if (args.mcount) html += bold_prop_line(phrase.html("interface.item.max_score"), to_pretty_num(args.mcount) + " <span class='gray'>[" + args.mowner + "]</span>", "#DCC343");
		if (args.monster && G.base_gold) {
			for (mname in G.base_gold[args.monster]) {
				if (!G.maps[mname] || G.maps[mname].ignore) continue;
				html += bold_prop_line(phrase.html("interface.item.base_gold"), G.base_gold[args.monster][mname] + " <span class='gray'>(" + G.maps[mname].name + ")</span>", "gold");
			}
		}
		if (prop["class"])
			html += bold_prop_line(
				phrase.html("interface.item.class"),
				(function (a) {
					var s = "";
					a.forEach(function (x) {
						if (s.length) s += ", ";
						s += phrase.definition("class", x, "name", x.toTitleCase());
					});
					return s;
				})(prop["class"]),
				"gray",
			);
		if (actual && item.type == "elixir" && args.slot == "elixir") {
			var remains = -msince(new Date(actual.expires)) / 60.0;
			// html+="<div style='color: #C3C3C3'>"+remains+" hours</div>";
			html += prop_remains(remains);
		} else if (item.type == "elixir") {
			html += prop_remains(item.duration);
		}
		if (item.achievements) {
			//args.monster
			html += "<div class='ilsu' style='margin-top: 5px'>" + phrase.html("interface.item.achievements") + "</div>";
			item.achievements.forEach(function (a) {
				var acolor = "white";
				if (max(args.score, args.mcount) >= a[0]) acolor = "#2EA436";
				var an = phrase.definition("stat", a[2], "name", a[2]).toLocaleUpperCase(phrase.language);
				html += "<div><span style='color:" + acolor + "'>[" + to_pretty_num(a[0]) + "]</span> <span style='color:" + (colors[a[2]] || "gray") + "'>" + phrase.escape(an) + "</span> " + a[3] + "</div>";
			});
			if (args.count < 100 && 0) {
				html += "<div style='margin-top: 5px; color:#848987'>" + phrase.html("interface.item.insight_locked") + "</div>";
				html += "<div><span style='color:#DAE2DF'>" + phrase.html("interface.item.100_kills_are_needed_to_discover_the_monster_specific_droprates") + "</span></div>";
			}
		}
		if (item.ability) {
			if (item.ability == "bash") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.bash"), colors.ability);
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.stuns_the_opponent_for_seconds_with_chance", { value: prop.attr1, value2: prop.attr0 }) + "</div>";
			} else if (item.ability == "freeze") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.freeze"), "#2EBCE2");
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.freezes_the_opponent_with_a_chance", { value: prop.attr0 }) + "</div>";
			} else if (item.ability == "poison") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.poison"), colors.poison);
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.poisons_the_opponent_with_a_chance", { value: prop.attr0 }) + "</div>";
			} else if (item.ability == "burn") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.burn"), "#E03D31");
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.burns_the_opponent_with_a_chance_deals_damage_over_time", { value: prop.attr0 }) + "</div>";
			} else if (item.ability == "weave") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.weave"), "#AAA9D2");
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.each_hit_slows_the_opponent_more_and_more") + "</div>";
			} else if (item.ability == "secondchance") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.second_chance"), colors.ability);
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.avoid_death_with_a_chance", { value: prop.attr0 }) + "</div>";
			} else if (item.ability == "sugarrush") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.sugar_rush"), "#D64770");
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.trigger_a_sugar_rush_on_attack_with_chance_gain_240", { value: prop.attr0 }) + "</div>";
			} else if (item.ability == "charm") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.charm"), "#D64770");
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.charm_an_enemy_with_chance_activate_the_ability_from_the", { value: prop.attr0 }) + "</div>";
			} else if (item.ability == "restore_mp") {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.html("interface.item.restore_mp"), "#5D9ED9");
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.instead_of_using_mp_skills_restore_2x_the_amount_with", { value: prop.attr0 }) + "</div>";
			} else if (G.skills[item.ability]) {
				html += bold_prop_line(phrase.html("interface.item.ability"), phrase.definition("skill", item.ability, "name", G.skills[item.ability].name), "#E1924D");
				if (prop.attr0) html += bold_prop_line(phrase.html("interface.item.chance"), "%" + prop.attr0);
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.activate_the_ability_from_the_skills_system") + "</div>";
			}
		}
		if (item.aura) {
			if (G.conditions[item.aura]) {
				html += bold_prop_line(phrase.html("interface.item.aura"), phrase.definition("condition", item.aura, "name", G.conditions[item.aura].name), "#E1924D");
				if (prop.attr0) html += bold_prop_line(phrase.html("interface.item.amount"), "%" + prop.attr0);
			}
		}
		if (actual && item.charge && !actual.b) {
			html += bold_prop_line(phrase.html("interface.item.charge"), to_pretty_float(((actual.charges || 0) / item.charge) * 100) + "%", "#7433A7");
		}
		if (item.encouragement) {
			if (prop.gold_multiplier) html += bold_prop_line(phrase.html("interface.item.gold"), prop.gold_multiplier + "×", colors.gold);
			if (prop.xp_multiplier) html += bold_prop_line(phrase.html("stat.xp.name"), prop.xp_multiplier + "×", colors.stat_xp);
			if (prop.luck_multiplier) html += bold_prop_line(phrase.html("interface.item.luck"), prop.luck_multiplier + "×", colors.luck);
			if (prop.phase) {
				html += prop_line(phrase.html("interface.item.stage"), phrase.html("interface.item.stage_progress", { stage: prop.phase }));
				if (prop.xp_multiplier === 1) html += "<div>" + phrase.html("interface.item.new_player_xp_ended_at_level_80") + "</div>";
				var next = item.phases && item.phases[prop.phase];
				if (next) html += "<div>" + phrase.html("interface.item.next_gold_xp_luck", { value: next[0], value2: prop.xp_multiplier === 1 ? 1 : next[1], value3: next[2] }) + "</div>";
			}
			html +=
				"<div class='slimbutton" +
				(args.pure ? "" : " ui-info") +
				"' style='" +
				(args.pure ? "" : "top: -5px; right: -5px; border-width: 5px; ") +
				'\' onclick=\'stpr(event); open_guide("encouragement",get_guide_url("encouragement"))\'>' +
				phrase.html("interface.item.info") +
				"</div>";
		}
		if (item.explanation) {
			html += "<div style='color: #C3C3C3'>" + phrase.definition("item", name, "explanation", item.explanation) + "</div>";
		} else if (item.type == "material") {
			html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.an_unknown_material_as_in_you_have_no_idea_what") + "</div>";
		}
		if (item.multiplier && item.multiplier != 1) html += bold_prop_line(phrase.html("interface.item.multiplier"), item.multiplier, "gray");
		if (prop.set) {
			html +=
				"<div><span style='color: #f1c054;'>" +
				phrase.html("interface.item.set") +
				"</span>: <span class='clickable' onclick='stpr(event); render_set(\"" +
				prop.set +
				"\")'>" +
				G.sets[prop.set].name +
				"</span></div>";
		}
		if (args.minutes !== undefined) {
			html += prop_remains(args.minutes / 60.0);
		}

		if (actual && actual.l) {
			if (actual.l == "s") html += "<div class='ilsu'>" + phrase.html("interface.item.sealed") + "</div>";
			else if (actual.l == "u") html += "<div class='iluu'>" + phrase.html("interface.item.unsealing") + "</div>";
			else html += "<div style='color: #404141'>" + phrase.html("interface.item.locked") + "</div>";
		}

		if (actual && actual.acl) {
			html +=
				"<div style='color: #ADA68E'>" +
				phrase.html("interface.item.account_bound") +
				" " +
				"<span class='clickable' style='color: #C49F8D' onclick='show_alert(phrase.html(\"interface.item.unbind_soon\"))'>" +
				"[X]" +
				"</span></div>";
		}

		if (!(args && args.prop)) {
			var display_phrase = phrase.html("interface.item.information");
			if (item.e) display_phrase = phrase.html("interface.item.exchangeable");
			else if (item.upgrade && (!actual || actual.level < 10)) display_phrase = phrase.html("interface.item.upgradeable");
			else if (item.compound) display_phrase = phrase.html("interface.item.compoundable");
			else {
				var done = false;
				for (var iname in G.craft) {
					if (G.craft[iname].quest != "mcollector") continue;
					G.craft[iname].items.forEach(function (i) {
						if (i[1] == iname) ((done = true), (display_phrase = phrase.html("interface.item.collectable")));
					});
				}
				if (!done) {
					for (var iname in G.craft) {
						if (G.craft[iname].quest == "mcollector") continue;
						G.craft[iname].items.forEach(function (i) {
							if (i[1] == iname) ((done = true), (display_phrase = phrase.html("interface.item.usable")));
						});
					}
				}
			}
			if (item.type == "weapon" || offhand_types[item.type]) {
				var t = "",
					color = "#CC3837";
				if (0 && parseInt(item.tier) < item.tier)
					t +=
						"T" +
						parseInt(item.tier) +
						"+ " +
						phrase.definition("weapon_type", item.wtype || item.type, "name", weapon_types[item.wtype] || offhand_types[item.wtype] || (item.wtype || item.type).toTitleCase());
				else
					t +=
						"T" +
						to_pretty_float(item.tier) +
						" " +
						phrase.definition("weapon_type", item.wtype || item.type, "name", weapon_types[item.wtype] || offhand_types[item.wtype] || (item.wtype || item.type).toTitleCase());

				if (
					!window.character ||
					G.classes[character.ctype].mainhand[item.wtype || item.type] ||
					G.classes[character.ctype].doublehand[item.wtype || item.type] ||
					G.classes[character.ctype].offhand[item.wtype || item.type]
				)
					color = "#56A244";

				html +=
					"<div style='color: gray;' class='clickable' onclick='stpr(event); render_equip_info(\"" +
					args.name +
					"\")'>" +
					phrase.html("interface.item.type") +
					"<span style='color:white'>:</span><span style='color: " +
					color +
					";'> " +
					t +
					"</span></div>";
			}
			html +=
				"<div style='color: gray;' class='clickable' onclick='stpr(event); render_item_help(this,\"" +
				args.name +
				'",' +
				((actual && actual.level) || 0) +
				")'>" +
				"[i]" +
				"<span style='color: white'>: " +
				display_phrase +
				"</span></div>";
		}
		if (args.inventory_ui !== undefined) {
			html += button_line({
				name: "<span style='color:gray'>{}</span><span style='color:white'>:</span>" + " " + phrase.html("interface.item.inspect"),
				onclick: "show_json(character.items[" + args.inventory_ui + "],{inventory_ui:" + args.inventory_ui + "})",
				color: colors.inspect,
			});
		}

		if (args.trade && actual && character.slots.helmet && character.slots.helmet.name.startsWith("ghat")) {
			var svalue = 2 * calculate_item_value(actual);
			html += "<div style='margin-top: 5px'>";
			if ((actual.q || 1) > 1) {
				html +=
					"<div><span class='gray clickable' onclick='$(\".tradenum\").cfocus()'>" +
					phrase.html("interface.item.quantity_short") +
					"</span> <div class='inline-block tradenum' contenteditable=true>" +
					actual.q +
					"</div></div>";
			}
			html +=
				"<div><span class='clickable' style='color:#35AD4B' onclick='$(\".sellmins\").focus()'>" +
				phrase.html("interface.item.minutes") +
				"</span> <div class='inline-block sellmins editable' contenteditable=true>20</div></div>";
			html +=
				"<div><span class='clickable' style='color:#EF5EA8' onclick='giveaway(\"" +
				args.slot +
				'","' +
				args.num +
				'",$(".tradenum").shtml(),$(".sellmins").shtml())\'>' +
				phrase.html("interface.item.giveaway") +
				"</span></div>"; // style='color:#A99A5B'
			html += "</div>";
		} else if (args.trade && actual) {
			var svalue = 2 * calculate_item_value(actual);
			html += "<div style='margin-top: 5px'>";
			if ((actual.q || 1) > 1) {
				html +=
					"<div><span class='gray clickable' onclick='$(\".tradenum\").cfocus()'>" +
					phrase.html("interface.item.quantity_short") +
					"</span> <div class='inline-block tradenum' contenteditable=true>" +
					actual.q +
					"</div></div>";
			}
			html +=
				"<div><span class='gold clickable' onclick='$(\".sellprice\").focus()'>" +
				phrase.html((actual.q || 1) > 1 ? "interface.price.gold_each" : "interface.price.gold") +
				"</span> <div class='inline-block sellprice editable' contenteditable=true>" +
				to_pretty_num(svalue) +
				"</div></div>";
			html +=
				"<div><span class='clickable' onclick='trade(\"" +
				args.slot +
				'","' +
				args.num +
				'",$(".sellprice").shtml(),$(".tradenum").shtml())\'>' +
				phrase.html("interface.item.put_up_for_sale") +
				"</span></div>"; // style='color:#A99A5B'
			html += "</div>";
		}
		if (actual && actual.name == "cxjar") {
			precompute_image_positions();
			if (!actual.data) {
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.empty_anomaly") + "</div>";
			} else if (!T[actual.data] && !(G.skills[actual.data] && G.skills[actual.data].emote)) {
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.invalid", { data: actual.data }) + "</div>";
			} else {
				html += "<div class='clickable' onclick='render_cx_info(\"" + actual.data + "\")'>" + cx_sprite(actual.data) + "</div>";
			}
		}
		if (in_arr(args.slot, trade_slots) && actual && actual.price && args.from_player && !actual.b && !actual.giveaway) {
			trade_item = true;
			if ((actual.q || 1) > 1) {
				html +=
					"<div><span class='gray clickable' onclick='$(\".tradenum\").cfocus()'>" +
					phrase.html("interface.item.quantity_short") +
					"</span> <div class='inline-block tradenum' contenteditable=true>1</div></div>";
			}
			html += "<div style='color: gold'>" + phrase.html((actual.q || 1) > 1 ? "interface.price.amount_each" : "interface.price.amount", { amount: to_pretty_num(actual.price) }) + "</div>";
			html +=
				"<div><span class='clickable itu' onclick='trade_buy(\"" +
				args.slot +
				'","' +
				args.from_player +
				'","' +
				(actual.rid || "") +
				'",$(".tradenum").html())\'>' +
				phrase.html("interface.item.buy") +
				"</span></div>";
		}
		if (in_arr(args.slot, trade_slots) && actual && args.from_player && actual.giveaway) {
			trade_item = true;
			if (actual.list.length) {
				html += "<div><span style='color:#42A0DC'>" + phrase.html("interface.item.participants") + "</span> " + actual.list.join(", ") + "</div>";
			}
			html += "<div><span class='clickable' style='color:#35AD4B' onclick='$(\".sellmins\").focus()'>" + phrase.html("interface.item.minutes") + "</span> " + actual.giveaway + "</div>";
			html +=
				"<div><span class='clickable itu' onclick='join_giveaway(\"" +
				args.slot +
				'","' +
				args.from_player +
				'","' +
				(actual.rid || "") +
				"\")'>" +
				phrase.html("interface.item.join") +
				"</span></div>";
		}
		if (in_arr(args.slot, trade_slots) && actual && actual.price && args.from_player && actual.b) {
			var q = false;
			if ((actual.q || 1) > 1 && item.s) q = true;
			trade_item = true;
			if (q) {
				html +=
					"<div><span class='gray clickable' onclick='$(\".tradenum\").cfocus()'>" +
					phrase.html("interface.item.quantity_short") +
					"</span> <div class='inline-block tradenum' contenteditable=true>1</div></div>";
			}
			html += "<div style='color: gold'>" + phrase.html(q ? "interface.price.amount_each" : "interface.price.amount", { amount: to_pretty_num(actual.price) }) + "</div>";
			html +=
				"<div><span class='clickable ibu' onclick='trade_sell(\"" +
				args.slot +
				'","' +
				args.from_player +
				'","' +
				(actual.rid || "") +
				'",$(".tradenum").html())\'>' +
				phrase.html("interface.item.sell") +
				"</span></div>";
		}
		if (args.secondhand) {
			var mult = 2;
			if (item.cash) mult = 3;
			trade_item = true;
			html += "<div style='color: gold'>" + phrase.html("interface.item.gold_2", { value: to_pretty_num(calculate_item_value(actual) * mult * (actual.q || 1)) }) + "</div>";
			html += "<div><span class='clickable' onclick='secondhand_buy(\"" + (actual.rid || "") + "\")'>" + phrase.html("interface.item.buy") + "</span></div>";
		}
		if (args.lostandfound) {
			trade_item = true;
			html += "<div style='color: gold'>" + phrase.html("interface.item.gold_2", { value: to_pretty_num(calculate_item_value(actual) * 4 * (actual.q || 1)) }) + "</div>";
			html += "<div><span class='clickable' onclick='lostandfound_buy(\"" + (actual.rid || "") + "\")'>" + phrase.html("interface.item.buy") + "</span></div>";
		}
		if (value) {
			var f = "buy_with_gold";
			if (item.days) html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.lasts_30_days") + "</div>";

			if (cash) ((html += "<div style='color: " + colors.cash + "'>" + phrase.html("interface.item.shells", { cash: to_pretty_num(item.cash) }) + "</div>"), (f = "buy_with_shells"));
			else html += "<div style='color: gold'>" + phrase.html("interface.item.gold_2", { value: to_pretty_num(value) }) + "</div>";
			if (cash && character && item.cash >= character.cash) {
				if (is_electron || is_tauri) {
					html += "<div style='border-top: solid 2px gray; margin-bottom: 2px; margin-top: 3px; margin-left: -1px; margin-right: -1px'></div>";
					html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.you_can_find_shells_from_gems_monsters_in_future_from") + "</div>";
				} else {
					html += "<div style='border-top: solid 2px gray; margin-bottom: 2px; margin-top: 3px; margin-left: -1px; margin-right: -1px'></div>";
					html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.you_can_find_shells_from_gems_monsters_in_future_from_2") + "</div>";
					html +=
						"<a href='https://adventure.land/shells' class='cancela' target='_blank'><span class='clickable' style='color: #EB8D3F'>" +
						phrase.html("interface.item.buy_or_earn_shells") +
						"</span></a> "; // onclick='shells_click(); $(this).parent().remove()'
					// #EB8D3F  nice orange - #33BBD6 meh blue - #54C8C1 ok teal
				}
			} else {
				if (item.s) {
					var q = 1;
					if (item.gives) q = 100;
					html += "<div style='margin-top: 5px'><!--<input type='number' value='1' class='buynum itemnumi'/> -->";
					html +=
						"<span class='gray clickable' onclick='$(\".buynum\").cfocus()'>" +
						phrase.html("interface.item.quantity_short") +
						"</span> <div class='inline-block buynum' contenteditable=true>" +
						q +
						"</div> <span class='gray'>|</span> ";
					html += "<span class='clickable' onclick='" + f + '("' + name + '",parseInt($(".buynum").html()))\'>' + phrase.html("interface.item.buy") + "</span> ";
					html += "</div>";
				} else html += "<div><span class='clickable' onclick='" + f + '("' + name + "\")'>" + phrase.html("interface.item.buy") + "</span></div>";
			}
		} else if (args.guide && actual) {
			html += "<div style='color: gold'>" + phrase.html("interface.item.gold_2", { value: to_pretty_num(calculate_item_value(actual, 1)) }) + "</div>";
		}

		if (args.token && args.key && args.key != args.token) {
			var color = "#B6A786",
				display_phrase = phrase.html("interface.item.tokens");
			var text = "#D3D5E0";
			if (args.token == "funtoken") color = "#AA6AB3";
			else if (args.token == "pvptoken") text = "#CCAE08";
			else if (args.token == "monstertoken") text = "#6C531B";
			else if (args.token == "friendtoken") text = "#AA6AB3";
			if (G.tokens[args.token][args.key] == 1) display_phrase = phrase.html("interface.item.token");
			if (G.tokens[args.token][args.key] < 1)
				html +=
					"<div><span class='clickable' style='color: " +
					color +
					"' onclick='exchange_buy(\"" +
					args.token +
					'","' +
					args.key +
					"\")'>" +
					phrase.html("interface.item.exchange", { value: 1 / G.tokens[args.token][args.key] }) +
					" " +
					"<span style='color:" +
					text +
					"'>" +
					phrase.html("interface.item.1_token") +
					"</span></span></div>";
			else
				html +=
					"<div><span class='clickable' style='color: " +
					color +
					"' onclick='exchange_buy(\"" +
					args.token +
					'","' +
					args.key +
					"\")'>" +
					phrase.html("interface.item.exchange_2") +
					" " +
					"<span style='color:" +
					text +
					"'>[" +
					G.tokens[args.token][args.key] +
					" " +
					display_phrase +
					"]</span></span></div>";
		}

		if (args.sell && actual) {
			var value = calculate_item_value(actual);
			html += "<div style='color: gold'>" + phrase.html("interface.item.gold_2", { value: to_pretty_num(value) }) + "</div>";
			if (item.s && actual.q) {
				var q = actual.q;
				html += "<div style='margin-top: 5px'>";
				html +=
					"<span class='gray clickable' onclick='$(\".sellnum\").cfocus()'>" +
					phrase.html("interface.item.quantity_short") +
					"</span> <div class='inline-block sellnum' contenteditable=true>" +
					q +
					"</div> <span class='gray'>|</span> ";
				html +=
					"<span class='clickable' onclick='var inum=\"" +
					args.num +
					'"; if(character.items[inum].name=="' +
					actual.name +
					'") sell(inum,parseInt($(".sellnum").html()))\'>' +
					phrase.html("interface.item.sell") +
					"</span> ";
				html += "</div>";
			} else
				html +=
					"<div><span class='clickable' onclick='var inum=\"" +
					args.num +
					'"; if(character.items[inum].name=="' +
					actual.name +
					"\") sell(inum)'>" +
					phrase.html("interface.item.sell") +
					"</span></div>";
		}
		if (args.cancel) {
			html += "<div class='clickable' data-ui-dismiss onclick='$(this).parent().remove()'>" + phrase.html("interface.item.close") + "</div>";
		}
		if (in_arr(name, booster_items)) {
			if (actual && actual.expires) {
				var remains = round(-msince(new Date(actual.expires)) / (6 * 24)) / 10.0;
				html += "<div style='color: #C3C3C3'>" + phrase.html("interface.item.days", { remains: remains }) + "</div>";
			}
			if (!args.sell) html += "<div class='clickable' onclick=\"btc(event); show_modal($('#boosterguide').html())\" style=\"color: #D86E89\">" + phrase.html("interface.item.how_to_use") + "</div>";
		}
		if (!value && !args.sell && actual && !trade_item && !args.trade && !args.npc && !args.readonly) {
			if (item.action) {
				var id = (args && args.slot) || (args && args.num);
				html +=
					'<div><span data-id="' +
					id +
					'" class="clickable" style="color: ' +
					(item.acolor || color) +
					'" onclick="' +
					item.onclick +
					'"">' +
					phrase.definition("item", name, "action", item.action) +
					"</span></div>";
			}
			if (name == "tracker" && !args.from_player) {
				html += "<div class='clickable' onclick='socket.emit(\"interaction\",{type:\"cavalry\"}); $(this).parent().remove()' style=\"color: #C6AA62\">" + phrase.html("interface.cavalry.call") + "</div>";
			}
			if (item.type == "computer") {
				html += "<div class='clickable' onclick='add_log(phrase(\"interface.computer.beep\"))' style=\"color: #32A3B0\">" + phrase.html("interface.item.network") + "</div>";
			}
			if (item.type == "stand") {
				html += "<div class='clickable' onclick='socket.emit(\"trade_history\",{}); $(this).parent().remove()' style=\"color: #44484F\">" + phrase.html("interface.item.trade_history") + "</div>";
			}
			if (0 && item.type == "computer" && (actual.charges === undefined || actual.charges) && gameplay == "normal") {
				html += '<div class=\'clickable\' onclick=\'socket.emit("unlock",{name:"code",num:"' + args.num + '"});\' style="color: #BA61A4">' + phrase.html("interface.item.unlock") + "</div>";
			}
			if (item.type == "computer") {
				html += "<div class='clickable' onclick='render_computer($(this).parent())' style=\"color: #32A3B0\">" + phrase.html("interface.item.network") + "</div>";
			}
			if (item.type == "stand" && !character.stand) {
				html += "<div class='clickable' onclick='open_merchant(\"" + args.num + '"); $(this).parent().remove()\' style="color: #8E5E2C">' + phrase.html("interface.item.open") + "</div>";
			}
			if (item.type == "stand" && character.stand) {
				html += "<div class='clickable' data-ui-dismiss onclick='close_merchant(); $(this).parent().remove()' style=\"color: #8E5E2C\">" + phrase.html("interface.item.close") + "</div>";
			}
			if (item.type == "elixir" && !args.from_player) {
				var display_phrase = phrase.html("interface.item.drink");
				if (item.eat) display_phrase = phrase.html("interface.item.eat");
				html +=
					"<div class='clickable' onclick='socket.emit(\"equip\",{num:\"" + args.num + '"}); push_deferred("equip"); $(this).parent().remove()\' style="color: #D86E89">' + display_phrase + "</div>";
			}
			if ((item.type == "licence" || item.type == "spawner") && !args.from_player) {
				html +=
					"<div class='clickable' onclick='socket.emit(\"equip\",{num:\"" +
					args.num +
					'"}); push_deferred("equip"); $(this).parent().remove()\' style="color: #574F58">' +
					phrase.html("interface.item.use") +
					"</div>";
			}
			if (in_arr(actual.name, ["stoneofxp", "stoneofgold", "stoneofluck"])) {
				html +=
					"<div class='clickable' onclick='socket.emit(\"convert\",{num:\"" + args.num + '"});\' style="color: ' + colors.cash + '">' + phrase.html("interface.item.convert_to_shells") + "</div>";
			}
			if (in_arr(actual.name, booster_items)) {
				if (actual.expires)
					html +=
						"<div class='clickable' onclick='shift(\"" +
						args.num +
						'","' +
						booster_items[(booster_items.indexOf(actual.name) + 1) % 3] +
						'"); $(this).parent().remove()\' style="color: #438EE2">' +
						phrase.html("interface.item.shift") +
						"</div>";
				else
					html += "<div class='clickable' onclick='activate(\"" + args.num + '","activate"); $(this).parent().remove()\' style="color: #438EE2">' + phrase.html("interface.item.activate") + "</div>";
			}
		}
		if (args.craft) {
			var i = 0,
				recipe_name = args.recipe || name,
				recipe = G.craft[recipe_name],
				display_phrase = phrase.html("interface.item.recipe"),
				action = phrase.html("interface.recipe.craft"),
				ecolor = "#419FBE";
			if (recipe.quest && recipe.quest != "anniversary_baker") ((display_phrase = phrase.html("interface.item.collect")), (action = phrase.html("interface.recipe.exchange")), (ecolor = "#4DC353"));
			html += "<div style='margin-top: 5px'></div>";
			html += "<div style='color: " + color + "; display: inline-block; border-bottom: 2px dashed gray; margin-bottom: 3px' class='cbold'>" + display_phrase + "</div>";
			html += "<div></div>";
			recipe.items.forEach(function (item) {
				var q = undefined;
				if (item[0] != 1) q = item[0];
				html += item_container({ skin: G.items[item[1]].skin, onclick: "render_item_by_name('" + item[1] + "')" }, { name: item[1], q: q, level: item[2] });
				i += 1;
				if (!(i % 4)) html += "<div></div>";
			});
			if (recipe.cost) html += bold_prop_line(phrase.html("interface.item.cost"), to_pretty_num(recipe.cost), "gold");
			html += "<div class='clickable' onclick='auto_craft(\"" + recipe_name + '")\' style="color: ' + ecolor + '">' + action + "</div>";
		}
		if (args.dismantle) {
			var i = 0;
			html += "<div style='margin-top: 5px'></div>";
			html += "<div style='color: " + color + "; display: inline-block; border-bottom: 2px dashed gray; margin-bottom: 3px' class='cbold'>" + phrase.html("interface.item.dismantles_to") + "</div>";
			html += "<div></div>";
			G.dismantle[name].items.forEach(function (item) {
				var q = undefined;
				if (item[0] != 1) q = item[0];
				html += item_container({ skin: G.items[item[1]].skin, onclick: "render_item_by_name('" + item[1] + "')" }, { name: item[1], q: q });
				i += 1;
				if (!(i % 4)) html += "<div></div>";
			});
			if (G.dismantle[name].cost) html += bold_prop_line(phrase.html("interface.item.cost"), to_pretty_num(G.dismantle[name].cost), "gold");
		}
		if (args.condition && args.condition.sn) html += bold_prop_line(phrase.html("interface.item.server"), args.condition.sn, "#BED4DE");
		if (args.condition && args.condition.f) html += bold_prop_line(phrase.html("interface.item.from"), args.condition.f, "#BED4DE");
		if (args.condition && args.condition.c) html += bold_prop_line(phrase.html("interface.item.count"), phrase.html("interface.item.count_left", { count: args.condition.c }), "#891C13");
		if (args.condition && args.condition.sn && args.condition.id) {
			html +=
				"<div style='background-color:#575983; border: 2px solid #9F9FB0; position: relative; display: inline-block; margin: 2px;' class='clickable' onclick='pcs(event); monster_x(\"" +
				args.condition.id +
				"\")'>" +
				sprite(args.condition.id) +
				"</div>";
		}
	}
	// html+=JSON.stringify(actual);
	if (!args.pure) html += "</div>";
	if (selector == "html") return html;
	else if (modal_count) show_modal(html, { wrap: false });
	else render_ui_panel(selector, html);
}

function render_item_by_name(name) {
	render_item_popup(name);
	// render_item(null,{skin:G.items[name].skin,item:G.items[name],name:name});
}

function wishlist_form(num, name) {
	wishlist(num, name, $(".wprice").shtml(), $(".wnumq").shtml(), $(".wlevel").shtml());
}

function render_wishlist_item(name, num) {
	var def = G.items[name],
		html = "";
	html += "<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 240px; min-width:200px;' class='buyitem'>";
	html += "<div style='margin-left:-2px; display:inline-block; vertical-align:middle'>" + item_container({ skin: def.skin, def: def }) + "</div>";
	html += "<div style='display:inline-block; vertical-align:top; margin-left: 4px'>";
	html +=
		"<div style='color: #f1c054; border-bottom: 2px dashed #C7CACA; margin-bottom: 3px; margin-left: 3px; margin-right: 3px; display: inline-block' class='cbold'>" +
		phrase.html("interface.wishlist_item.wishlist") +
		"</div>";
	html += "<div></div>";
	html += "<div style='color: #E4E4E4; border-bottom: 2px dashed gray; margin-bottom: 3px; display: inline-block' class='cbold'>" + def.name + "</div>";
	html += "</div>";

	html +=
		"<div><span class='gray clickable' onclick='$(\".wnumq\").cfocus()'>" + phrase.html("interface.item.quantity_short") + "</span> <div class='inline-block wnumq' contenteditable=true>1</div></div>";
	html +=
		"<div><span class='gold clickable' onclick='$(\".wprice\").cfocus()'>" +
		phrase.html(def.s ? "interface.price.gold_each" : "interface.price.gold") +
		"</span> <div class='inline-block wprice editable' contenteditable=true>" +
		(calculate_item_value({ name: name }) + 1) +
		"</div></div>";
	if (def.compound || def.upgrade)
		html +=
			"<div><span style='color:#9E7BCA' class='clickable' onclick='$(\".wlevel\").cfocus()'>" +
			phrase.html("interface.wishlist_item.level") +
			"</span> <div class='inline-block wlevel editable' contenteditable=true data-default='0'>0</div></div>";
	html += "<div><span class='clickable' onclick='wishlist_form(" + num + ',"' + name + "\")'>" + phrase.html("interface.wishlist_item.wishlist_2") + "</span></div>";

	html += "</div>";
	render_ui_panel("#topleftcornerdialog", html);
	dialogs_target = character;
}

function render_set(name) {
	var set = G.sets[name],
		selector = last_selector;
	var html = "<div style='background-color: black; border: 5px solid gray; font-size: 24px; display: inline-block; padding: 20px; line-height: 24px; max-width: 280px;' class='buyitem'>";
	html += "<div style='color: #f1c054; border-bottom: 2px dashed #C7CACA; margin-bottom: 3px' class='cbold'>" + set.name + "</div>";
	html += "<div style='margin-left:-2px; margin-right:-2px;'>";
	set.items.forEach(function (i) {
		html += item_container({ skin: G.items[i].skin });
	});
	html += "</div>";
	[1, 2, 3, 4, 5, 6, 7, 8].forEach(function (num) {
		var rep = num;
		if (num != set.items.length) rep = num + "+";
		if (set[num] && Object.keys(set[num]).length)
			html += "<div><span style='color:#8A8D8F'>" + phrase.html("interface.set.equipped", { rep: rep }) + "</span> " + render_item("html", { pure: true, item: set[num], prop: set[num] }) + "</div>";
	});
	if (set.explanation) {
		html += "<div style='color: #C3C3C3'>" + phrase.definition("set", name, "explanation", set.explanation) + "</div>";
	}
	html += "</div>";
	if (modal_count) show_modal(html, { wrap: false, hideinbackground: true });
	else render_ui_panel(selector, html);
}

function render_condition(selector, name) {
	var def = G.conditions[name],
		minutes = 0,
		condition = undefined,
		target = xtarget || ctarget;
	if (target && target.s[name] && target.s[name].ms) minutes = target.s[name].ms / 6000.0 / 10.0;
	if (target && target.s[name]) {
		def = (!def && {}) || clone(def);
		condition = target.s[name];
		for (var p in target.s[name]) {
			def[p] = target.s[name][p];
		}
	}
	if (def && def.encouragement && !(condition && condition.ms)) minutes = undefined;
	if (def) def = Object.assign({}, def, { name: phrase.definition("condition", name, "name", def.name), explanation: phrase.definition("condition", name, "explanation", def.explanation) });
	if (def && target === character && (name == "hopsickness" || name == "realmfatigue")) {
		def.explanation += "<br /><br />" + phrase.html("interface.selection.destination", { server: home_server_name(server_region + server_identifier) });
		def.explanation += "<br />" + home_server_label(character.home, true);
		def.explanation += "<br /><span class='clickable' style='color:#85c76b' onclick=\"open_guide('events-and-home',get_guide_url('events-and-home'))\">" + phrase.html("interface.server.info") + "</span>";
	}
	render_item(selector, { skin: (condition && condition.skin) || (def && def.skin), item: def, prop: def, minutes: minutes, condition: condition });
}

function render_item_selector(selector, args) {
	if (args && !args.purpose) purpose = "buying";
	var items = [],
		row = 0,
		html = "<div style='border: 5px solid gray; height: 400px; overflow: scroll; background: black'>";
	for (var id in G.items) if (!G.items[id].ignore) items.push(G.items[id]);
	items.sort(function (a, b) {
		return b.g - a.g;
	});
	for (var i = 0; i < items.length; i++) {
		var current = items[i];
		html += item_container({ skin: current.skin, def: current, onclick: "gallery_click('" + current.id + "')" });
		row++;
		if (!(row % 5)) html += "<br />";
	}
	html += "</div>";
	$(selector).html(html);
}

function allow_drop(event) {
	if (event.preventDefault) event.preventDefault();
	if (event.stopPropagation) event.stopPropagation();
}

function on_drag_start(event) {
	last_drag_start = new Date();
	event.dataTransfer.setData("text", event.target.id);
}

function on_rclick(current) {
	var $current = $(current),
		inum = $current.data("inum"),
		snum = $current.data("snum"),
		sname = $current.data("sname"),
		on = $current.data("onrclick");
	if (on) smart_eval(on);
	else if (sname !== undefined) {
		socket.emit("unequip", { slot: sname });
		push_deferred("unequip");
	} else if (snum !== undefined) {
		socket.emit("bank", { operation: "swap", inv: -1, str: snum, pack: last_rendered_items, reopen: false });
		push_deferred("bank");
	} else if (inum !== undefined) {
		if (topleft_npc == "items") {
			socket.emit("bank", { operation: "swap", inv: inum, str: -1, pack: last_rendered_items, reopen: false });
			push_deferred("bank");
		} else if (topleft_npc == "merchant") {
			var actual = character.items[parseInt(inum)];
			if (!actual) return;
			render_item("#merchant-item", { item: G.items[actual.name], name: actual.name, actual: actual, sell: 1, num: parseInt(inum) });
		} else if (topleft_npc == "exchange") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def || character.q.exchange) return;
			if (def.quest && exchange_type != def.quest) return;
			if (def.e) {
				if (e_item !== null) return;
				e_item = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				$("#citem" + inum)
					.parent()
					.html("");
				$("#eitem").html(html);
			}
		} else if (topleft_npc == "none") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def) return;
			if (p_item !== null) return;
			p_item = inum;
			cache_i[inum] = -1;
			var html = $("#citem" + inum).all_html();
			$("#citem" + inum)
				.parent()
				.html("");
			$("#pitem").html(html);
		} else if (topleft_npc == "locksmith") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def) return;
			if (l_item !== null) return;
			l_item = inum;
			cache_i[inum] = -1;
			var html = $("#citem" + inum).all_html();
			$("#citem" + inum)
				.parent()
				.html("");
			$("#litem").html(html);
		} else if (topleft_npc == "scrollsmith") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def) return;
			if (s_item !== null) return;
			s_item = inum;
			cache_i[inum] = -1;
			var html = $("#citem" + inum).all_html();
			$("#citem" + inum)
				.parent()
				.html("");
			$("#sitem").html(html);
		} else if (topleft_npc == "upgrade") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def || character.q.upgrade) return;
			if (def.upgrade) {
				if (u_item !== null) return;
				u_item = inum;
				cache_i[inum] = -1;
				// alert($("#citem"+inum).all_html());
				var html = $("#citem" + inum).all_html();
				$("#citem" + inum)
					.parent()
					.html("");
				// $("#uweapon").html(html);
				$("#uweapon").replaceWith(item_container({ draggable: false, droppable: false, cid: "uweapon", pui: true, skin: G.items[character.items[u_item].name].skin }, character.items[u_item]));
				if (u_scroll !== null || u_offering !== null) upgrade(u_item, u_scroll, u_offering, null, true);
			}
			if (def.type == "uscroll" || def.type == "pscroll") {
				if (u_scroll !== null) return;
				u_scroll = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				if ((character.items[inum].q || 1) < 2)
					$("#citem" + inum)
						.parent()
						.html("");
				$("#uscroll").html(html);
				if (u_item !== null) upgrade(u_item, u_scroll, u_offering, null, true);
			}
			if (def.type == "offering" || def.offering !== undefined) {
				if (u_offering !== null) return;
				u_offering = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				if ((character.items[inum].q || 1) < 2)
					$("#citem" + inum)
						.parent()
						.html("");
				$("#uoffering").html(html);
				if (u_item !== null) upgrade(u_item, u_scroll, u_offering, null, true);
			}
		} else if (topleft_npc == "compound") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def || character.q.compound) return;
			if (def.compound && c_last < 3) {
				c_items[c_last] = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				$("#citem" + inum)
					.parent()
					.html("");
				$("#compound" + c_last).html(html);
				c_last++;
				if (c_last == 3 && c_scroll !== null) compound(c_items[0], c_items[1], c_items[2], c_scroll, c_offering, null, true);
			}
			if (def.type == "cscroll") {
				if (c_scroll !== null) return;
				c_scroll = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				if ((character.items[inum].q || 1) < 2)
					$("#citem" + inum)
						.parent()
						.html("");
				// $("#cscroll").html(html);
				$("#cscroll").replaceWith(item_container({ draggable: false, droppable: false, cid: "cscroll", pui: true, skin: G.items[character.items[c_scroll].name].skin }, character.items[c_scroll]));
				if (c_last == 3 && c_scroll !== null) compound(c_items[0], c_items[1], c_items[2], c_scroll, c_offering, null, true);
			}
			if (def.type == "offering") {
				if (c_offering !== null) return;
				c_offering = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				if ((character.items[inum].q || 1) < 2)
					$("#citem" + inum)
						.parent()
						.html("");
				$("#coffering").html(html);
				if (c_last == 3 && c_scroll !== null) compound(c_items[0], c_items[1], c_items[2], c_scroll, c_offering, null, true);
			}
		} else if (topleft_npc == "craftsman") {
			var current = character.items[inum],
				def = null;
			if (current) def = G.items[current.name];
			if (!def) return;
			if (cr_last < 9) {
				cr_items[cr_last] = inum;
				cache_i[inum] = -1;
				var html = $("#citem" + inum).all_html();
				$("#citem" + inum)
					.parent()
					.html("");
				$("#critem" + cr_last).html(html);
				cr_last++;
			}
		} else if (topleft_npc == "dismantler") {
			if (ds_item !== null) return;
			ds_item = inum;
			cache_i[inum] = -1;
			var html = $("#citem" + inum).all_html();
			if ((character.items[inum].q || 1) < 2)
				$("#citem" + inum)
					.parent()
					.html("");
			$("#dsitem").html(html);
		} else {
			inum = parseInt(inum, 10);
			if (0 && character && character.items[inum] && G.items[character.items[inum].name].type == "elixir") return;
			socket.emit("equip", { num: inum });
			push_deferred("equip");
		}
	}
}

// original_on_drop=on_drop; on_drop=function(event){ event.stopPropagation(); original_on_drop(event); }

function on_drop(event) {
	if (event.preventDefault) event.preventDefault();
	if (event.stopPropagation) event.stopPropagation();
	var data = event.dataTransfer.getData("text"),
		swap = false,
		move = false;
	var element = $(document.getElementById(data)),
		target = $(event.target).closest("[ondrop]");
	// The item or drop container may have disappeared during a UI update.
	if (!element.length || !target.length) return;
	var cnum = target.data("cnum"),
		slot = target.data("slot"),
		strnum = target.data("strnum"),
		trigrc = target.data("trigrc"),
		skid = target.data("skid"); // containers
	var inum = element.data("inum"),
		sname = element.data("sname"),
		snum = element.data("snum"),
		skname = element.data("skname"); // items + skills

	// The last overflow row includes padding, not additional inventory slots.
	if (cnum !== undefined && cnum >= Math.max(character.isize, character.items.length)) return;

	// console.log(cnum+" "+inum+" "+slot+" "+sname+" skid: "+skid+" skname: "+skname);

	if (inum != undefined && character.items[parseInt(inum)] && character.items[parseInt(inum)].name == "placeholder") return false;
	if (cnum != undefined && character.items[parseInt(cnum)] && character.items[parseInt(cnum)].name == "placeholder") return false;

	if (inum !== undefined && skid !== undefined) {
		inum = parseInt(inum);
		if ((inum || inum === 0) && character.items[inum]) {
			keymap[skid] = { type: "item", name: character.items[inum].name };
			set_setting(real_id, "keymap", keymap);
			render_skills();
			render_skills();
		}
	} else if (skname !== undefined && skid !== undefined) {
		if (skname == "eval") keymap[skid] = { name: "eval", code: "add_log('Empty eval','gray')" };
		else if (skname == "snippet") keymap[skid] = { name: "snippet", code: "game_log('Empty snippet','gray')" };
		else if (skname == "throw") {
			var num = 0,
				change = true;
			while (change) {
				change = false;
				for (var id in keymap) if (keymap[id] && keymap[id].name && keymap[id].name == "throw" && keymap[id].num == num) (num++, (change = true));
			}
			keymap[skid] = { name: "throw", num: num };
		} else keymap[skid] = skname;
		set_setting(real_id, "keymap", keymap);
		render_skills();
		render_skills();
	} else if (trigrc != undefined && inum != undefined) {
		on_rclick(element.get(0));
	} else if (snum != undefined && strnum != undefined) {
		// render_items_npc swap - storage to storage
		socket.emit("bank", { operation: "move", a: snum, b: strnum, pack: last_rendered_items });
		swap = true;
		push_deferred("bank");
	} else if (strnum != undefined && inum != undefined) {
		// inventory to storage
		socket.emit("bank", { operation: "swap", inv: inum, str: strnum, pack: last_rendered_items });
		move = true;
		push_deferred("bank");
	} else if (cnum != undefined && snum != undefined) {
		// storage to inventory
		socket.emit("bank", { operation: "swap", inv: cnum, str: snum, pack: last_rendered_items });
		move = true;
		push_deferred("bank");
	} else if (cnum !== undefined && cnum == inum) {
		if (is_mobile && mssince(last_drag_start) < 300) inventory_click(parseInt(inum));
	} else if (cnum != undefined && inum != undefined) {
		socket.emit("imove", { a: cnum, b: inum });
		push_deferred("imove");
		swap = true;
		cache_i[cnum] = cache_i[inum] = -1;
	} else if (sname !== undefined && sname == slot) {
		// drop in the same slot
		if (is_mobile && mssince(last_drag_start) < 300) slot_click(slot);
	} else if (cnum != undefined && sname != undefined) {
		socket.emit("unequip", { slot: sname, position: cnum });
		push_deferred("unequip");
		// swap=true; #GTODO: Implement position
	} else if (slot != undefined && inum != undefined) {
		if (in_arr(slot, trade_slots)) {
			if (character.slots[slot]) return;
			try {
				var actual = character.items[parseInt(inum)];
				render_item("#topleftcornerdialog", { trade: 1, item: G.items[actual.name], actual: actual, num: parseInt(inum), slot: slot });
				$(".editable").focus();
				dialogs_target = xtarget || ctarget;
			} catch (e) {
				console.log("TRADE-ERROR: " + e);
			}
		} else {
			(socket.emit("equip", { num: inum, slot: slot }), (move = true), (cache_slots[slot] = -1));
			push_deferred("equip");
		}
	}

	if (swap) {
		var e_html = element.all_html(),
			t_html = target.html();
		target.html("");
		element.parent().html(t_html);
		target.html(e_html);
	}

	if (move) {
		target.html(element.all_html());
		if (cnum !== undefined) cache_i[cnum] = -1;
	}
}

function item_container(item, actual) {
	var html = "",
		styles = "",
		space = item.space === undefined ? 3 : item.space,
		background = item.bg || "black",
		item_prop = "",
		container_prop = "",
		rclick = "",
		cnum = "",
		bcolor = item.bcolor || "gray",
		xbcolor = "#C5C5C5",
		classes = "",
		size = item.size || 40,
		def = null,
		pompous = false,
		xstyles = "";
	if (actual && actual.name) def = G.items[actual.name] || G.items.placeholder_m;
	if (actual && def) {
		if ((def.upgrade && actual.level > 8) || (def.compound && actual.level > 4)) bcolor = xbcolor;
		if (bcolor == "gray" && (def.special || calculate_item_grade(actual) == 2 || calculate_item_value(actual) > 5000000)) {
			bcolor = xbcolor;
			pompous = true;
		}
	}
	if (def && actual && def.type == "booster" && actual.level) bcolor = xbcolor;

	if (item.draggable || !("draggable" in item)) {
		item_prop += " draggable='true' ondragstart='on_drag_start(event)'";
		container_prop += "ondrop='on_drop(event)' ondragover='allow_drop(event)'";
	}
	if (item.droppable) {
		item.trigrc = true;
		container_prop += "ondrop='on_drop(event)' ondragover='allow_drop(event)'";
	}
	if (item.onclick) {
		if (item.draggable) {
			container_prop += ' onclick="' + item.onclick + '" class="clickable" ';
			if (item.onmousedown) container_prop += ' onmousedown="' + item.onmousedown + '"'; // to handle middle clicks
		} else container_prop += ' onmousedown="' + item.onclick + '" ontouchstart="' + item.onclick + '" class="clickable" ';
	}

	// cls="rotate12";
	if (item.cnum != undefined) cnum = "data-cnum='" + item.cnum + "' ";
	if (item.trigrc != undefined) cnum = "data-trigrc='1'"; // on_drop, just trigger on_rclick
	if (item.strnum != undefined) cnum = "data-strnum='" + item.strnum + "' "; // render_items_npc - slot
	if (item.slot != undefined) cnum = "data-slot='" + item.slot + "' ";
	if (item.skid != undefined) cnum = "data-skid='" + item.skid + "' ";
	if (item.cid) container_prop += " id='" + item.cid + "' ";

	if (!item.skin && item.loader) xstyles = "overflow: hidden;";

	html +=
		"<div " +
		cnum +
		"style='position: relative; display:inline-block; margin: " + (item.margin === undefined ? 2 : item.margin) + "px; border: 2px solid " +
		bcolor +
		"; height: " +
		(size + 2 * space) +
		"px; width: " +
		(size + 2 * space) +
		"px; background: " + background + "; vertical-align: top; " +
		xstyles +
		"' " +
		container_prop +
		">";

	if (item.pui) {
		var chance = "%??.??",
			ccolor = "#299C4C",
			roll = "#00.00";
		if (item.pui.chance) {
			var res = set_uchance(item.pui.chance, true);
			ccolor = res[0];
			chance = res[1];
			roll = set_uroll(item.pui, true);
		}
		//html+="<div style='position: absolute; top: -2px; left: 52px; font-size: 16px; border: 2px solid gray; width: 38px; padding: 2px; color: "+ccolor+"' class='uchance'>"+chance+"</div>";
		//html+="<div style='position: absolute; top: 23px; left: 52px; font-size: 16px; border: 2px solid gray; width: 38px; padding: 2px; color: gray' class='uroll'>"+roll+"</div>";
		html +=
			"<div style='position: absolute; top: -2px; left: 52px; font-size: 24px; width: 50px; border: 2px solid gray; line-height: 16px; text-align: right; padding: 2px; color: " +
			ccolor +
			"' class='uchance'>" +
			chance +
			"</div>";
		html +=
			"<div style='position: absolute; top: 24px; left: 52px; font-size: 24px; width: 50px; border: 2px solid gray; line-height: 16px; text-align: right; padding: 2px; color: gray' class='uroll'>" +
			roll +
			"</div>";
	}

	if (item.skid && !item.skin) html += "<div class='truui' style='border-color: gray; color: white'>" + item.skid + "</div>"; // Skill ID

	if (item.shade) {
		if (!G.positions[item.shade]) item.shade = "placeholder";
		var spack = G.imagesets[G.positions[item.shade][0] || "pack_20"],
			sscale = size / spack.size;
		var sx = G.positions[item.shade][1],
			sy = G.positions[item.shade][2];
		html += "<div style='position: absolute; top: -2px; left: -2px; padding:" + (space + 2) + "px;'>";
		html += "<div style='overflow: hidden; height: " + size + "px; width: " + size + "px;'>";
		// Previous default s_op was 0.2 [12/07/18]
		html +=
			"<img style='width: " +
			spack.columns * spack.size * sscale +
			"px; height: " +
			spack.rows * spack.size * sscale +
			"px; margin-top: -" +
			sy * size +
			"px; margin-left: -" +
			sx * size +
			"px; opacity: " +
			(item.s_op || 0.36) +
			";' src='" +
			(window.desktop ? desktop.imageUrl(spack.file) : spack.file) +
			"' draggable='false' />";
		html += "</div>";
		html += "</div>";
	}

	if (item.skin) {
		if (!G.positions[item.skin]) item.skin = "placeholder";
		var pack = G.imagesets[G.positions[item.skin][0] || "pack_20"],
			x = G.positions[item.skin][1],
			y = G.positions[item.skin][2];
		var scale = size / pack.size;
		if (actual && actual.level && actual.level > 7) classes += " glow" + min(item.level, 10);
		if (item.num != undefined) rclick = "class='rclick" + classes + "' data-inum='" + item.num + "'";
		if (item.snum != undefined) rclick = "class='rclick" + classes + "' data-snum='" + item.snum + "'"; // render_items_npc - item
		if (item.sname != undefined) rclick = "class='rclick" + classes + "' data-sname='" + item.sname + "'";
		if (item.skname != undefined) rclick = "class='rclick" + classes + "' data-skname='" + item.skname + "'";
		if (item.on_rclick) rclick = "class='rclick" + classes + "' data-onrclick=\"" + item.on_rclick + '"';
		html += "<div " + rclick + " style='background: " + background + "; position: absolute; bottom: -2px; left: -2px; border: 2px solid " + bcolor + ";";
		html += "padding:" + space + "px; overflow: hidden' " + ("id='" + (item.id || "rid" + randomStr(12)) + "'") + " " + item_prop + ">"; // overflow:hidden for .skidloader
		// the "rid" / random id seems to be needed, on_drop gets elements by id - couldn't work around it without a deep re-analysis [22/06/18]
		html += "<div style='overflow: hidden; height: " + size + "px; width: " + size + "px;'>";
		html +=
			"<img style='width: " +
			pack.columns * pack.size * scale +
			"px; height: " +
			pack.rows * pack.size * scale +
			"px; margin-top: -" +
			y * size +
			"px; margin-left: -" +
			x * size +
			"px;' src='" +
			(window.desktop ? desktop.imageUrl(pack.file) : pack.file) +
			"' draggable='false' />";
		html += "</div>";
		if (actual && actual.name == "monsterbox") {
			var xx = G.positions["egg2"][1],
				yy = G.positions["egg2"][2];
			html += "<div style='overflow: hidden; height: " + size / 2 + "px; width: " + size / 2 + "px; z-index: 1; position: absolute; top: 3px; left: 13px'>";
			html +=
				"<img style='width: " +
				(pack.columns * pack.size * scale) / 2 +
				"px; height: " +
				(pack.rows * pack.size * scale) / 2 +
				"px; margin-top: -" +
				(yy * size) / 2 +
				"px; margin-left: -" +
				(xx * size) / 2 +
				"px;' src='" +
				(window.desktop ? desktop.imageUrl(pack.file) : pack.file) +
				"' draggable='false' />";
			html += "</div>";
		}
		if (actual) {
			var prefix = "u";
			if (def && def.compound) prefix = "c";
			if (actual.c) {
				html += "<div class='iuui' style='color: white'>" + actual.c + "</div>";
			} else if (actual.q && actual.left) {
				html += "<div class='iuui' style='color: white'>" + actual.q + "</div>";
			} else if (actual.q && actual.q != 1) {
				if (actual.b) html += "<div class='iqui gray'>" + actual.q + "</div>";
				else if (def && def.debuff) html += "<div class='iqui iqdbf'>" + actual.q + "</div>";
				else if (def && def.gives && def.gives[0] && def.gives[0][0] == "hp") html += "<div class='iqui iqhp'>" + actual.q + "</div>";
				else if (def && def.gives && def.gives[0] && def.gives[0][0] == "mp") html += "<div class='iqui iqmp'>" + actual.q + "</div>";
				else html += "<div class='iqui'>" + actual.q + "</div>";
			}
			if (actual.level) {
				var level = actual.level,
					clevel = level;
				if (def.type == "booster")
					clevel = level =
						(actual.level == 1 && "A") || (actual.level == 2 && "B") || (actual.level == 3 && "C") || (actual.level == 4 && "D") || (actual.level == 5 && "E") || (actual.level > 5 && "W");
				if (pompous && def.compound && clevel == 3) clevel = 4;
				if (pompous && def.upgrade && clevel == 7) clevel = 8;
				html +=
					"<div class='iuui " +
					prefix +
					"level" +
					(min(clevel, (def.compound && 5) || 12) || clevel) +
					"' style='border-color: " +
					bcolor +
					"'>" +
					((level == 10 && "X") ||
						(level == 11 && "Y") ||
						(level == 12 && "Z") ||
						(level == 5 && prefix == "c" && "V") ||
						(level == 6 && prefix == "c" && "S") ||
						(level == 7 && prefix == "c" && "R") ||
						level) +
					"</div>";
			}
			if (actual.s) html += "<div class='iqui'>" + actual.s + "</div>";
		}
		if ((item.slot && in_arr(item.slot, trade_slots)) || item.trade_for_ui) {
			if (actual && actual.giveaway) html += "<div class='truui igu' style='border-color: " + bcolor + ";'>@</div>";
			else if (actual && actual.b) html += "<div class='truui ibu' style='border-color: " + bcolor + ";'>?</div>";
			else html += "<div class='truui itu' style='border-color: " + bcolor + ";'>$</div>"; //€
		} else if (actual && actual.l && !item.slot) {
			if (actual.l == "s") html += "<div class='truui ilsu' style='border-color: " + bcolor + ";'>S</div>";
			else if (actual.l == "u") html += "<div class='truui iluu' style='border-color: " + bcolor + ";'>U</div>";
			else html += "<div class='truui ixu' style='border-color: " + bcolor + ";'>X</div>";
		}
		if (actual && actual.v) html += "<div class='trruui ivu' style='border-color: " + bcolor + "; line-height: 7px'><br />^</div>";
		else if (actual && actual.m) html += "<div class='trruui imu' style='border-color: " + bcolor + ";'>M</div>";
		if (item.loader) {
			html += "<div class='loader" + item.loader + "' style='position: absolute; bottom: 0px; right: 0px; width: 3px; height: 0px; background-color: yellow'></div>";
		}
		if (item.skid) {
			// Skill ID
			html += "<div class='skidloader" + item.skid + "' style='position: absolute; bottom: 0px; right: 0px; width: 4px; height: 0px; background-color: yellow'></div>";
			html += "<div class='truui' style='border-color: gray; color: white'>" + item.skid + "</div>";
			if (actual && actual.name == "throw") {
				html += "<div class='iqui'>[" + (actual.num || 0) + "]</div>";
			}
		}
		html += "</div>";
	}

	if (!item.skin && item.loader) {
		html += "<div class='loader" + item.loader + "' style='position: absolute; bottom: 0px; left: 0px; width: 52px; height: 0px; background-color: yellow;'></div>";
	}

	if (!item.skin && item.level) {
		var level = item.level,
			clevel = level,
			def = G.items[item.iname],
			prefix = "u";
		if (def && def.compound) prefix = "c";
		if (def.type == "booster") clevel = level = (level == 1 && "A") || (level == 2 && "B") || (level == 3 && "C") || (level == 4 && "D") || (level == 5 && "E") || (level > 5 && "W");
		if (pompous && def.compound && clevel == 3) clevel = 4;
		if (pompous && def.upgrade && clevel == 7) clevel = 8;
		html +=
			"<div class='iuui " +
			prefix +
			"level" +
			(min(clevel, (def.compound && 5) || 12) || clevel) +
			"' style='border-color: " +
			bcolor +
			"'>" +
			((level == 10 && "X") || (level == 11 && "Y") || (level == 12 && "Z") || (level == 5 && prefix == "c" && "V") || level) +
			"</div>";
	}

	html += "</div>";
	return html;
}

function unlocked_skill_mapping(current) {
	var skill = current && G.skills[current.name || current];
	if (skill && skill.emote && !(character.acx && character.acx[skill.emote]) && !(skill.emote == "ikissyou" && anniversary_can_visit())) return null;
	return current;
}

function render_skillbar(empty) {
	if (empty) {
		$("#skillbar").html("").hide();
		return;
	}
	// $("#topmid").html("");
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 2px; display: inline-block' class='enableclicks'>",
		i = 0;
	skillbar.forEach(function (id) {
		var current = unlocked_skill_mapping(keymap[id]),
			skin = current;
		if (current) {
			if (current && current.skin) skin = current.skin;
			else if (current.type == "item" && G.items[current.name]) skin = G.items[current.name].skin;
			else if (G.skills[current.name || current]) skin = G.skills[current.name || current].skin;
			html += item_container({ skid: id, skin: skin || "", draggable: false, droppable: true, onclick: "on_skill('" + id + "')" }, current);
		} else html += item_container({ skid: id, draggable: false, droppable: true });
		if (!(skillbar.length >= 8 && !(skillbar.length % 2) && !(i % 2))) html += "<div></div>";
		i++;
	});
	html += "</div>";
	$("#skillbar").html(html).css("display", "inline-block");
	restart_skill_tints();
	// $("#topmid").show().html(html);
}

function skill_click(slot) {
	if (skillsui && keymap[slot]) render_skill("#skills-item", keymap[slot].name || keymap[slot], keymap[slot]);
	if (G.skills[slot]) render_skill("#skills-item", slot);
}

var skills_page = "I";
function render_skills() {
	tut("skills");
	if (skillsui) {
		$(".skillsui").hide();
		$("#theskills").remove();
		skillsui = false;
		render_skillbar();
		return;
	}
	var last = 0,
		right_style = "text-align: right";
	var html = "<div id='skills-item' class='rendercontainer' style='flex-shrink: 0; max-height: calc(100vh * var(--browser-zoom-inverse, 1)); overflow-y: auto; margin-right: 5px'></div>";
	html +=
		"<div id='skills-frame' style='background-color: black; border: 5px solid gray; padding: 2px; font-size: 24px; flex-shrink: 0'><div id='skills-panel' style='width: max-content; max-height: calc(100vh * var(--browser-zoom-inverse, 1) - 50px); overflow-y: auto'>";
	html +=
		"<div class='textbutton' style='margin-left: 5px'><span  onclick='btc(event); show_snippet()'>" +
		phrase.html("interface.skills.mapping") +
		"</span> <span style='color: " +
		((skills_page == "I" && "#76BDE5") || "#7C7C7C") +
		";' class='clickable' onclick='btc(event); skills_page=\"I\"; render_skills(); render_skills();'>1</span> <span style='color: " +
		((skills_page == "II" && "#E38241") || "#7C7C7C") +
		";' class='clickable' onclick='btc(event); skills_page=\"II\"; render_skills(); render_skills();'>2</span> <span style='color: " +
		((skills_page == "U" && "#8FCE72") || "#7C7C7C") +
		";' class='clickable' onclick='btc(event); skills_page=\"U\"; render_skills(); render_skills();'>" +
		phrase.html("interface.skills.utility_tab") +
		"</span><!-- <span style='float:right; color: #7C7C7C; margin-right: 5px' class='clickable' onclick='btc(event); show_json(keymap)'><span style='color:#DECE31'>&gt;</span> DATA <span style='color:#DECE31'>&lt;</span></span>--></div>";
	var km1 = ["1", "2", "3", "4", "5", "6", "7"],
		km2 = ["Q", "W", "E", "R", "X", "T", "B"];
	if (skills_page == "II") ((km1 = ["8", "9", "0", "G", "H", "J", "K"]), (km2 = ["SHIFT", "Z", "V", "M", "P", "D", "BACK"]));
	if (skills_page == "U") ((km1 = ["ESC", "A", "C", "F", "I", "TAB", "ENTER"]), (km2 = ["UP", "LEFT", "DOWN", "RIGHT", ",", "S", "U"]));
	html += "<div>";
	km1.forEach(function (N) {
		var current = unlocked_skill_mapping(keymap[N]),
			skin = current;
		if (current && current.skin) skin = current.skin;
		else if (current && current.type == "item" && G.items[current.name]) skin = G.items[current.name].skin;
		else if (current && G.skills[current.name || current]) skin = G.skills[current.name || current].skin;
		html += item_container({ skid: N, skin: skin || "", onclick: "on_skill('" + N + "')" }, current);
	});
	html += "</div>";
	html += "<div>";
	km2.forEach(function (N) {
		var current = unlocked_skill_mapping(keymap[N]),
			skin = current;
		if (current && current.skin) skin = current.skin;
		else if (current && current.type == "item" && G.items[current.name]) skin = G.items[current.name].skin;
		else if (current && G.skills[current.name || current]) skin = G.skills[current.name || current].skin;
		html += item_container({ skid: N, skin: skin || "", onclick: "on_skill('" + N + "')" }, current);
	});
	html += "</div>";
	html +=
		"<div class='textbutton' style='margin-left: 5px'><span class='clickable' onclick='btc(event); show_json(G.skills)'>" +
		phrase.html("interface.skills.skills") +
		"</span><!-- <span style='float:right; color: #7C7C7C; margin-right: 5px' class='clickable' onclick='btc(event); show_modal($(\"#keymapguide\").html())'><span style='color:#60B8C7'>&gt;</span> CONFIG <span style='color:#60B8C7'>&lt;</span></span>--></div>";
	var s = [],
		slast = 0,
		e = [],
		elast = 0,
		a = [],
		alast = 0;
	object_sort(G.skills).forEach(function (io) {
		var name = io[0],
			skill = io[1];
		if (skill.slot) {
			var found = false;
			skill.slot.forEach(function (p) {
				if (character.slots[p[0]] && character.slots[p[0]].name == p[1]) found = true;
			});
			if (!found) return;
		}
		if (skill.inventory) {
			var found = false;
			skill.inventory.forEach(function (p) {
				for (var i = 0; i < 42; i++) {
					if (character && character.items[i] && character.items[i].name == p) found = true;
				}
			});
			if (!found) return;
		}
		if (skill.emote) {
			if ((character.acx && character.acx[skill.emote]) || (skill.emote == "ikissyou" && anniversary_can_visit())) e.push({ name: name });
			return;
		}
		if (skill.type == "skill" && (!skill["class"] || in_arr(character.ctype, skill["class"]) || character.role == "gm")) s.push({ name: name });
		if (skill.type == "passive" && (!skill["class"] || in_arr(character.ctype, skill["class"]) || character.role == "gm")) s.push({ name: name });
		if (skill.type == "ability" && (!skill["class"] || in_arr(character.ctype, skill["class"]) || character.role == "gm")) a.push({ name: name });
		if (skill.type == "utility" && skill.ui !== false && (!skill["class"] || in_arr(character.ctype, skill["class"]))) a.push({ name: name });
	});
	if (character.role == "gm") a.push({ name: "gm" });
	// html+="<div style='border-bottom: 5px solid gray; margin-bottom: 2px; margin-left: -5px; margin-right: -5px'></div>";
	for (var i = 0; i < 10; i++) {
		html += "<div>";
		for (var j = 0; j < 7; j++) {
			if (slast < s.length) html += item_container({ skin: G.skills[s[slast].name].skin, onclick: "skill_click('" + s[slast].name + "')", skname: s[slast].name }, s[slast]);
			else html += item_container({});
			slast++;
		}
		html += "</div>";
		if (slast >= s.length) break; // i &&
	}
	if (e.length) {
		html += "<div class='textbutton' style='margin-left: 5px'>" + phrase.html("interface.skills.emotes") + "</div>";
		for (var i = 0; i < 10; i++) {
			html += "<div>";
			for (var j = 0; j < 7; j++) {
				if (elast < e.length) html += item_container({ skin: G.skills[e[elast].name].skin, onclick: "skill_click('" + e[elast].name + "')", skname: e[elast].name, loader: e[elast].name }, e[elast]);
				else html += item_container({});
				elast++;
			}
			html += "</div>";
			if (elast >= e.length) break;
		}
	}
	html += "<div class='textbutton' style='margin-left: 5px' onclick='btc(event); show_json(G.skills)'>" + phrase.html("interface.skills.abilities") + "</div>";
	// html+="<div style='border-bottom: 5px solid gray; margin-bottom: 2px; margin-left: -5px; margin-right: -5px'></div>";
	for (var i = 0; i < 10; i++) {
		html += "<div>";
		for (var j = 0; j < 7; j++) {
			if (alast < a.length) html += item_container({ skin: G.skills[a[alast].name].skin, onclick: "skill_click('" + a[alast].name + "')", skname: a[alast].name }, a[alast]);
			else html += item_container({});
			alast++;
		}
		html += "</div>";
		if (alast >= a.length) break;
	}
	html += "</div></div>";
	skillsui = true;
	render_skillbar(1);
	$("body").append("<div id='theskills' style='position: fixed; z-index: 310; bottom: 0px; right: 0px; display: flex; align-items: flex-end' class='disableclicks bpclicks'></div>");
	$(".skillsui").show();
	$("#theskills").html(html);
	add_ui_close($("#skills-frame"), "skills", { frame: true, label: phrase("interface.close.button"), classes: "ui-close-skills" });
	restart_skill_tints();
}

function show_condition(name) {
	var def = Object.assign({}, G.conditions[name], {
		name: phrase.definition("condition", name, "name", G.conditions[name].name),
		explanation: phrase.definition("condition", name, "explanation", G.conditions[name].explanation),
	});
	show_modal(render_item("html", { skin: def.skin, item: def, prop: def }), { wrap: false });
}

function render_all_skills_and_conditions() {
	var last = 0,
		right_style = "text-align: right";
	var html = "";
	html += "<div style='background-color: black; border: 5px solid gray; padding: 14px; font-size: 24px; display: inline-block; max-width: 640px'>";
	// html+="<div style='padding: 10px; color: #CC863B; text-align: center'>Work in Progress</div>";
	["ranger", "rogue", "warrior", "mage", "priest", "paladin", "merchant"].forEach(function (ctype) {
		html += "<div>" + phrase.definition("class", ctype, "name", ctype.toTitleCase()) + "</div>";
		object_sort(G.skills).forEach(function (s) {
			var name = s[0],
				skill = s[1];
			if (skill["class"] && skill["class"].includes(ctype)) {
				html += item_container({ skin: skill.skin, onclick: "render_skill('','" + s[0] + "')" });
			}
		});
	});
	html += "<div>" + phrase.html("interface.all_skills_and_conditions.item_skills") + "</div>";
	object_sort(G.skills).forEach(function (s) {
		var name = s[0],
			skill = s[1];
		if (skill.slot) {
			html += item_container({ skin: skill.skin, onclick: "render_skill('','" + s[0] + "')" });
		}
	});
	html += "<div>" + phrase.html("interface.all_skills_and_conditions.abilities_and_utilities") + "</div>";
	object_sort(G.skills).forEach(function (s) {
		var name = s[0],
			skill = s[1];
		if (skill.type == "ability" || skill.type == "utility") {
			html += item_container({ skin: skill.skin, onclick: "render_skill('','" + s[0] + "')" });
		}
	});
	function render_cnd(name, condition) {
		condition = Object.assign({}, condition, { name: phrase.definition("condition", name, "name", condition.name) });
		html +=
			"<div style='display: inline-block; width: 280px'>" +
			item_container({ skin: condition.skin, onclick: "show_condition('" + name + "')" }) +
			"<div style='display: inline-block'>" +
			condition.name +
			"<br /><span style='color: gray'>\"" +
			name +
			'"</span></div></div>';
	}
	html += "<div>" + phrase.html("interface.all_skills_and_conditions.buffs") + "</div>";
	object_sort(G.conditions).forEach(function (c) {
		var name = c[0],
			condition = c[1];
		if (condition.buff) render_cnd(name, condition);
	});
	html += "<div>" + phrase.html("interface.all_skills_and_conditions.debuffs") + "</div>";
	object_sort(G.conditions).forEach(function (c) {
		var name = c[0],
			condition = c[1];
		if (condition.debuff) render_cnd(name, condition);
	});
	html += "<div>" + phrase.html("interface.all_skills_and_conditions.conditions") + "</div>";
	object_sort(G.conditions).forEach(function (c) {
		var name = c[0],
			condition = c[1];
		if (!condition.debuff && !condition.buff && !condition.technical) render_cnd(name, condition);
	});
	html += "<div>" + phrase.html("interface.all_skills_and_conditions.technical") + "</div>";
	object_sort(G.conditions).forEach(function (c) {
		var name = c[0],
			condition = c[1];
		if (condition.technical) render_cnd(name, condition);
	});
	html += "</div>";
	show_modal(html, { wrap: false, hideinbackground: true, url: "/docs/guide/all/skills_and_conditions" });
}

function render_teleporter() {
	var html = "<div style='max-width: 420px; text-align: center' class='cxmodalteleporter'>";
	for (var id in G.maps) {
		if (!G.maps[id].ignore && !G.maps[id].instance) {
			html += "<div class='gamebutton' style='margin-left: 5px; margin-bottom: 5px' onclick='socket.emit(\"transport\",{to:\"" + id + '"}); push_deferred("transport")\'>' + G.maps[id].name + "</div>";
		}
	}
	html += "</div>";
	if (!$(".cxmodalteleporter").length) show_modal(html, { wrap: false, close: { classes: "ui-close-row" } });
}

function render_travel(the_map) {
	var html = "<div style='max-width: 420px; text-align: center' class='cxmodalteleporter' onclick='hide_modal()'>";
	var one = false,
		places = false;
	if (!the_map) ((the_map = character["map"]), (places = true));
	(G.maps[the_map].npcs || []).forEach(function (def) {
		var npc = G.npcs[def.id];
		if (!in_arr(npc.role, ["citizen", "guard", "pvp_announcer"])) {
			if (!one) {
				one = true;
				html += "<div class='gamebutton' onclick='stpr(event);' style='cursor:inherit !important'>" + phrase.html("interface.travel.npcs_in", { map: G.maps[the_map].name }) + "</div><div></div>";
			}
			var position = def.position || def.positions[0];
			html +=
				"<div style='display:inline-block; margin: 5px; text-align: center' class='clickable' onclick='hide_modal(); code_move(" +
				position[0] +
				"," +
				(position[1] + 20) +
				");'><div style='border: 2px solid gray; background-color: #464973; height: 54px; width: 54px; display: inline-block'>" +
				sprite(npc.skin, { width: 50, height: 50, cx: npc.cx }) +
				"</div><div></div><div class='tinybutton' style='margin-top: -6px'>" +
				npc.name +
				"</div></div>";
		}
	});
	var parsed = {},
		packs = {};
	object_sort(G.maps, "random").forEach(function (e) {
		var name = e[0],
			map = e[1];
		if (map.ignore) return;
		cshuffle(map.monsters || []).forEach(function (pack) {
			if ((name != the_map && !pack.boundaries) || parsed[pack.type]) return;
			if (pack.boundaries) {
				cshuffle(pack.boundaries).forEach(function (b) {
					if (b[0] != the_map || parsed[pack.type]) return;
					parsed[pack.type] = true;
					packs[pack.type] = { type: pack.type, x: b[1], y: b[2], hp: G.monsters[pack.type].hp };
				});
			} else {
				parsed[pack.type] = true;
				packs[pack.type] = { type: pack.type, x: pack.boundary[0], y: pack.boundary[1], hp: G.monsters[pack.type].hp };
			}
		});
	});
	if (Object.keys(packs).length) {
		html +=
			"<div></div><div class='gamebutton' onclick='stpr(event);' style='cursor:inherit !important'>" + phrase.html("interface.travel.monsters_in", { map: G.maps[the_map].name }) + "</div><div></div>";
		html += "<div style='margin: 8px'>";
		object_sort(packs, "hpsort").forEach(function (e) {
			if ((G.monsters[e[0]].cute || G.monsters[e[0]].stationary) && !G.monsters[e[0]].achievements) return;
			html += "<div style='display:inline-block'>";
			html +=
				"<div style='background-color:#575983; border: 2px solid #9F9FB0; display: inline-block; margin: 2px; /*" +
				e[0] +
				"*/' class='clickable' onclick='pcs(event); code_move(" +
				e[1].x +
				"," +
				e[1].y +
				")'>";
			html += sprite(e[0], { scale: 1.5 });
			html += "</div>";
			html += "<div></div><div class='tinybutton' style='margin-top: -6px'>" + G.monsters[e[0]].name + "</div>";
			html += "</div>";
		});
		html += "</div>";
	}
	if (places) {
		html += "<div></div><div class='gamebutton' onclick='stpr(event);' style='cursor:inherit !important'>" + phrase.html("interface.travel.places") + "</div><div></div>";
		object_sort(G.maps).forEach(function (io) {
			var id = io[0];
			if (
				!G.maps[id].ignore &&
				!G.maps[id].unlist &&
				!G.maps[id].instance &&
				!G.maps[id].irregular &&
				(G.maps[id].world || "") == (window.world || "") &&
				(!G.maps[id].event || (G.maps[id].event || "") == (window.current_event || ""))
			) {
				html += "<div class='gamebutton' style='margin: 4px' onclick='hide_modal(); code_travel(\"" + id + "\");'>" + G.maps[id].name + "</div>";
			}
		});
	}
	html += "</div>";
	if (!$(".cxmodalteleporter").length) show_modal(html, { wrap: false, close: { label: phrase.html("interface.travel.close"), corner: true } });
}

function render_gtravel() {
	// gm monster travel
	var html = "<div style='max-width: 420px; text-align: center' class='cxmodalteleporter'>",
		f = "render_spawns";
	object_sort(G.maps).forEach(function (io) {
		var id = io[0];
		if (!G.maps[id].ignore && !G.maps[id].instance) {
			html += "<div class='gamebutton' style='margin-left: 5px; margin-bottom: 5px' onclick='hide_modal(); " + f + '("' + id + "\");'>" + G.maps[id].name + "</div>";
		}
	});
	html += "</div>";
	if (!$(".cxmodalteleporter").length) show_modal(html, { wrap: false, close: { classes: "ui-close-row" } });
}

function render_gmonsters(t) {
	var html = "<div style='max-width: 420px; text-align: center'>";
	object_sort(G.monsters).forEach(function (io) {
		var id = io[0];
		html +=
			"<div class='gamebutton' style='margin-left: 5px; margin-bottom: 5px' onclick='hide_modal(); socket.emit(\"gm\",{action:\"mjump\",monster:\"" + id + "\"});'>" + G.monsters[id].name + "</div>";
	});
	html += "</div>";
	show_modal(html, { wrap: false, close: { classes: "ui-close-row" } });
}

function render_spawns(id) {
	var html = "<div style='max-width: 420px; text-align: center'>",
		i = 0;
	G.maps[id].spawns.forEach(function (io) {
		html += "<div class='gamebutton' style='margin-left: 5px; margin-bottom: 5px' onclick='direct_travel(\"" + id + '","' + i + "\"); hide_modal()'>" + id + "[" + i + "]</div>";
		i++;
	});
	html += "</div>";
	show_modal(html, { wrap: false, close: { classes: "ui-close-row" } });
}

function render_interaction(type, sub_type, args) {
	if (!args) args = {};
	var cosmetic_preview = type.auto && (T[type.skin] == "character" || type.cx);
	var cosmetic_type = cosmetic_preview && type;
	if (sub_type != "return_html") {
		topleft_npc = "interaction";
		rendered_target = topleft_npc;
		rendered_interaction = type;
	}
	var left = 0,
		top = 0,
		file = "/images/tiles/characters/npc1.png",
		img_type = "normal",
		pass = false;
	var html = "<div style='background-color: #E5E5E5; color: #010805; border: 5px solid gray; padding: 6px 12px 6px 12px; font-size: 30px; display: inline-block; max-width: 420px'>";

	//face
	if (type.auto) {
		// likely, this will be the future method [25/07/17]
		if (!cosmetic_preview) {
			file = FC[type.skin];
			left = FM[type.skin][1];
			top = FM[type.skin][0];
			img_type = T[type.skin];
		}
		if (type.dialog) type = type.dialog;
	} else if (in_arr(type, ["wizard", "hardcoretp"])) {
		left = 2;
		top = 0;
		file = "/images/tiles/characters/chara8.png";
	} else if (in_arr(type, ["santa", "candycane_success"])) {
		left = 0;
		top = 0;
		file = "/images/tiles/characters/animationc.png";
		img_type = "animation";
	} else if (in_arr(type, ["leathers", "leather_success"])) {
		left = 1;
		top = 0;
		file = "/images/tiles/characters/npc5.png";
	} else if (in_arr(type, ["lostearring", "lostearring_success"])) {
		left = 3;
		top = 0;
		file = "/images/tiles/characters/chara8.png";
	} else if (in_arr(type, ["mistletoe", "mistletoe_success"])) {
		left = 0;
		top = 0;
		file = "/images/tiles/characters/chara8.png";
	} else if (in_arr(type, ["crafting"])) {
		left = 0;
		top = 0;
		file = "/images/tiles/characters/npc5.png";
	} else if (in_arr(type, ["ornaments", "ornament_success"])) {
		left = 1;
		top = 0;
		file = "/images/tiles/characters/chara8.png";
	} else if (in_arr(type, ["jailer", "guard", "blocker", "test"])) {
		left = 3;
		top = 0;
		file = "/images/tiles/characters/chara5.png";
	} else if (in_arr(type, ["seashells", "seashell_success"])) {
		left = 0;
		top = 1;
		file = "/images/tiles/characters/npc1.png";
	} else if (in_arr(type, ["lottery"])) {
		left = 3;
		top = 0;
		file = "/images/tiles/characters/npc6.png";
	} else if (in_arr(type, ["newupgrade"])) {
		left = 3;
		top = 1;
		file = "/images/tiles/characters/chara8.png";
	} else if (type == "tavern") {
		left = 0;
		top = 1;
		file = "/images/tiles/characters/custom1.png";
	} else if (type == "standmerchant") {
		left = 3;
		top = 0;
		file = "/images/tiles/characters/npc5.png";
	} else if (type == "subscribe") {
		left = 3;
		top = 1;
		file = "/images/tiles/characters/chara7.png";
	} else if (in_arr(type, ["gemfragments", "gemfragment_success"])) {
		left = 2;
		top = 1;
		file = "/images/tiles/characters/npc1.png";
	} else if (in_arr(type, ["buyshells", "noshells", "yesshells"])) {
		left = 0;
		top = 1;
		file = "/images/tiles/characters/dwarf2.png";
	} else if (in_arr(type, ["unlock_items2", "unlock_items3", "unlock_items4", "unlock_items5", "unlock_items6", "unlock_items7"])) {
		left = 3;
		top = 1;
		file = "/images/tiles/characters/npc4.png";
		if (type == "unlock_items2") ((top = 1), (left = 0));
		if (type == "unlock_items3") ((top = 1), (left = 0));
		if (type == "unlock_items4") ((top = 1), (left = 2));
		if (type == "unlock_items5") ((top = 1), (left = 2));
		if (type == "unlock_items6") ((top = 0), (left = 1));
		if (type == "unlock_items7") ((top = 0), (left = 1));
	} else if (type.startsWith("unlock_")) pass = true;
	else return;

	if (pass);
	else if (cosmetic_preview)
		html +=
			"<div style='float: left; margin-top: -20px; width: 104px; height: " + (cosmetic_type.full ? 144 : 98) + "px; overflow: hidden'>" +
			sprite(cosmetic_type.skin, { cx: clone(cosmetic_type.cx || {}), cosmetic_head_y: cosmetic_type.cosmetic_head_y, width: 104, height: 144, scale: 4 }) +
			"</div>";
	else if (img_type == "normal" || img_type == "full")
		html +=
			"<div style='float: left; margin-top: -20px; width: 104px; height: 92px; overflow: hidden'><img style='margin-left: -" +
			104 * (left * 3 + 1) +
			"px; margin-top: -" +
			144 * (top * 4) +
			"px; width: 1248px; height: 1152px;' src='" +
			file +
			"'/></div>";
	else
		html +=
			"<div style='float: left; margin-top: -20px; width: 104px; height: 98px; overflow: hidden'><img style='margin-left: -" +
			(188 * left + 40) +
			"px; margin-top: -" +
			(200 * top + 50) +
			"px; width: 2256px; height: 1600px;' src='" +
			file +
			"'/></div>";

	if (type.auto) {
		html += type.message;
		if (type.button || type.button2) {
			html += "<div style='clear:both;text-align:right;margin-top:5px'>";
			if (type.button2) {
				interaction_onclick2 = type.onclick2;
				html += "<div class='slimbutton' style='margin-right:5px' onclick='interaction_onclick2()'>" + type.button2 + "</div>";
			}
			if (type.button) {
				interaction_onclick = type.onclick;
				html += "<div class='slimbutton' onclick='interaction_onclick()'>" + type.button + "</div>";
			}
			html += "</div>";
		}
	} else if (type == "seashells") {
		html += phrase.html("interface.interaction.ah_i_love_the_sea_so_calming_as_a_kid");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"seashell\")'>" + phrase.html("interface.interaction.i_have_20") + "</div></span>";
	} else if (type == "buyshells") {
		html += phrase.html("interface.interaction.yo_dawg_i_can_hook_you_up_with_some_shells");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_shells_buyer()'>" + phrase.html("interface.interaction.hmm_sure") + "</div></span>";
	} else if (type == "noshells") {
		html += phrase.html("interface.interaction.ugh_maybe_go_farm_more_gold_it_s_not_like");
	} else if (type == "yesshells") {
		html += phrase.html("interface.interaction.please_doing_business_with_you_you_ll_have_your_shells");
	} else if (type == "hardcoretp") {
		html += phrase.html("interface.interaction.aww_are_you_stuck_here_i_can_take_you_places");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_teleporter()'>" + phrase.html("interface.interaction.teleport") + "</div></span>";
	} else if (type == "seashell_success") {
		if (Math.random() < 0.001) html += phrase.html("interface.interaction.awww_ty_ty_ty_xoxo");
		else html += phrase.html("interface.interaction.how_kind_of_you_please_accept_this_small_gift_in");
		d_text("+1", get_npc("fisherman"), { color: "#DFE9D9" });
	} else if (type == "subscribe") {
		html += phrase.html("interface.interaction.it_s_that_time_of_the_day_are_you_in");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='socket.emit(\"signup\")'>" + phrase.html("interface.interaction.sign_me_up") + "</div></span>";
	} else if (type == "tavern") {
		html += phrase.html("interface.interaction.tavern_a_place_for_adventurers_to_relax_drink_unwind_play");
	} else if (type == "test") {
		html += phrase.html("interface.interaction.greetings_looking_for_a_good_deal_on_weapons_and_armor");
	} else if (type == "newupgrade") {
		html += phrase.html("interface.interaction.adventurer_i_can_upgrade_your_weapons_or_armors_combine_3");
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_upgrade_shrine(1)'>" +
			phrase.html("interface.interaction.upgrade") +
			"</div> <div class='slimbutton' onclick='render_compound_shrine(1)'>" +
			phrase.html("interface.interaction.combine") +
			"</div></span>";
	} else if (type == "locksmith") {
		html += phrase.html("interface.interaction.lock_prevents_anything_that_can_destroy_an_item_selling_upgrading");
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_locksmith(\"lock\")'>" +
			phrase.html("interface.interaction.lock") +
			"</div> <div class='slimbutton' onclick='render_locksmith(\"seal\")'>" +
			phrase.html("interface.interaction.seal") +
			"</div> <div class='slimbutton' onclick='render_locksmith(\"unlock\")'>" +
			phrase.html("interface.interaction.unlock") +
			"</div></span>";
	} else if (type == "scrollsmith") {
		html += phrase.html("interface.interaction.de_stat_an_item_give_you_back_the_scrolls_used");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_scrollsmith()'>" + phrase.html("interface.interaction.de_stat") + "</div></span>";
	} else if (type == "crafting") {
		html += phrase.html("interface.interaction.i_can_craft_or_dismantle_items_for_you_price_differs");
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_recipes()'>" +
			phrase.html("interface.interaction.recipes") +
			"</div> <div class='slimbutton' onclick='render_recipes(\"dismantle\")'>" +
			phrase.html("interface.interaction.recycling") +
			"</div> <div class='slimbutton' onclick='render_craftsman()'>" +
			phrase.html("interface.interaction.craft") +
			"</div> <div class='slimbutton' onclick='render_dismantler()'>" +
			phrase.html("interface.interaction.dismantle") +
			"</div></span>";
	} else if (type == "wizard") {
		html += phrase.html("interface.interaction.well_hello_there_i_m_wizard_i_made_this_game");
	} else if (type == "santa") {
		html += phrase.html("interface.interaction.happy_holidays_please_excuse_my_companion_he_is_a_bit");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"candycane\")'>" + phrase.html("interface.interaction.i_have_one") + "</div></span>";
	} else if (type == "standmerchant") {
		html += phrase.html("interface.interaction.anyone_can_become_a_merchant_and_start_trading_you_only");
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_merchant(get_npc(\"standmerchant\"))'>" +
			phrase.html("interface.interaction.let_me_buy_one") +
			"</div></span>";
	} else if (type == "candycane_success") {
		html += phrase.html("interface.interaction.ah_thanks_for_cheering_him_up_here_s_something_for");
	} else if (type == "lostearring") {
		html += phrase.html("interface.interaction.ewww_ewww_ewww_these_wretched_things_ate_my_earrings_kill");
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"lostearring\")'>" + phrase.html("interface.interaction.as_you_wish") + "</div></span>";
	} else if (type == "lostearring_success") {
		html += phrase.html("interface.interaction.you_did_well_here_s_something_left_from_one_of");
	} else if (type == "mistletoe") {
		html += phrase.html("interface.interaction.you_know_it_gets_boring_in_here_sometimes_i_m");
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"mistletoe\")'>" + phrase.html("interface.interaction.oh_my_i_do") + "</div></span>";
	} else if (type == "mistletoe_success") {
		html += phrase.html("interface.interaction.haha_you_thought_i_was_going_to_give_you_a");
	} else if (type == "ornaments") {
		html += phrase.html("interface.interaction.hmm_we_should_decorate_these_trees_i_need_some_ornaments", { item: G.items.ornament.e });
		html += "<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"ornament\")'>" + phrase.html("interface.interaction.you_got_it") + "</div></span>";
	} else if (type == "ornament_success") {
		html += phrase.html("interface.interaction.thank_you_here_s_something_in_return"); //Great idea!
	} else if (type == "gemfragment_success") {
		html += phrase.html("interface.interaction.bwahahahahah_cough_ehem_thanks_you_got_a_good_deal_keep");
		d_text("+1", get_npc("gemmerchant"), { color: "#E78295" });
	} else if (type == "gemfragments") {
		html += phrase.html("interface.interaction.back_in_the_day_we_had_miners_then_came_the", { item: G.items.gemfragment.e });
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"gemfragment\")'>" +
			phrase.html("interface.interaction.i_got", { item: G.items.gemfragment.e }) +
			"</div></span>";
	} else if (type == "leathers") {
		html += phrase.html("interface.interaction.hey_hey_hey_what_brings_you_to_this_cold_land", { item: G.items.leather.e });
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='render_exchange_shrine(\"leather\")'>" +
			phrase.html("interface.interaction.i_have", { item: G.items.leather.e }) +
			"</div></span>";
	} else if (type == "leather_success") {
		html += phrase.html("interface.interaction.here_you_go_enjoy_keep_bringing_leathers_to_me_i");
		d_text("+1", get_npc("leathermerchant"), { color: "#DFE9D9" });
	} else if (type == "jailer") {
		html += phrase.html(Math.random() < 0.5 ? "interface.jailer.boy" : "interface.jailer.girl");
		html +=
			"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='pcs(); socket.emit(\"leave\"); push_deferred(\"leave\")'>" +
			phrase.html("interface.interaction.leave") +
			"</div></span>";
	} else if (type == "blocker" || type == "guard") {
		var roll = Math.random();
		if (roll < 0.5) html += phrase.html("interface.interaction.hmm_hmm_hmm_can_t_let_you_pass_check_again");
		else html += phrase.html("interface.interaction.there_s_some_work_going_on_inside_maybe_check_back");
	} else if (type == "lottery") {
		html += phrase.html("interface.interaction.hi_dear_the_lottery_tickets_for_this_week_haven_t");
	} else if (type.startsWith("unlock_")) {
		var pack = args.pack,
			gold = bank_packs[pack][1],
			shells = bank_packs[pack][2];
		if (is_electron || is_tauri) {
			html += phrase.html("interface.interaction.hello_you_don_t_seem_to_have_an_account_open", { value: to_pretty_num(gold) });
			html +=
				"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='socket.emit(\"bank\",{operation:\"unlock\",gold:1,pack:\"" +
				pack +
				"\"}); push_deferred(\"bank\");' style='margin-right: 5px;'>" +
				phrase.html("interface.interaction.pay_gold", { value: to_pretty_num(gold) }) +
				"</div></span>";
		} else {
			html += phrase.html("interface.interaction.hello_you_don_t_seem_to_have_an_account_open_2", { value: to_pretty_num(gold), value2: to_pretty_num(shells) });
			html +=
				"<span style='float: right; margin-top: 5px'><div class='slimbutton' onclick='socket.emit(\"bank\",{operation:\"unlock\",gold:1,pack:\"" +
				pack +
				"\"}); push_deferred(\"bank\");' style='margin-right: 5px;'>" +
				phrase.html("interface.interaction.use_gold") +
				'</div><div class=\'slimbutton\' onclick=\'socket.emit("bank",{operation:"unlock",shells:1,pack:"' +
				pack +
				'"}); push_deferred("bank");\'>' +
				phrase.html("interface.interaction.use_shells") +
				"</div></span>";
		}
	} else return;

	html += "</div>";
	if (sub_type == "return_html") return html;
	render_ui_panel("#topleftcornerui", html, "target", { label: "X" });
}

function load_nearby(fallback) {
	friends_inside = "nearby";
	var html = "",
		someone = false;
	html += render_com_buttons();
	for (var id in entities) {
		var player = entities[id];
		if (!is_player(player)) continue;
		someone = true;
	}
	if (someone) {
		html += "<table style='margin: 5px; text-align: center'>";
		html +=
			"<tr style='color: gray; text-decoration: underline'><th style='width: 100px'>" +
			phrase.html("interface.load_nearby.name") +
			"</th><th style='width: 60px'>" +
			phrase.html("interface.load_nearby.level") +
			"</th><th style='width: 100px'>" +
			phrase.html("interface.load_nearby.class") +
			"</th><th style='width: 60px'>" +
			phrase.html("interface.load_nearby.age") +
			"</th><th style='width: 100px'>" +
			phrase.html("interface.load_nearby.status") +
			"</th><th style='width: 120px'>" +
			phrase.html("interface.load_nearby.actions") +
			"</th></tr>";
		var l = Object.values(entities);
		l.sort(function (a, b) {
			if (!a.afk && b.afk) return -1;
			if (a.afk && !b.afk) return 1;
			if (a.age < b.age) return -1;
			if (a.age > b.age) return 1;
			if (a.name < b.name) return -1;
			return 1;
		});
		l.forEach(function (player) {
			var afk = phrase.html("interface.presence.afk"),
				actions = "";
			if (!is_player(player)) return;
			if (!player.afk) afk = "<span style='color: #34bf15'>" + phrase.html("interface.load_nearby.active") + "</span>";
			else if (player.afk == "code") afk = "<span style='color: gray'>CODE</span>";
			else if (player.afk == "bot") afk = "<span style='color: gray'>" + phrase.html("interface.presence.bot") + "</span>";
			//if(!player.party) actions+=" <span style='color: #2799DD'>PM</span>";
			if (player.owner && in_arr(player.owner, friends)) actions += " <span style='color: #EC82C4'>" + phrase.html("interface.load_nearby.friends") + "</span>";
			else
				actions +=
					" <span style='color: #2799DD' class='clickable' onclick='socket.emit(\"friend\",{event:\"request\",name:\"" +
					player.name +
					'"}); push_deferred("friend")\'>' +
					phrase.html("interface.load_nearby.friend") +
					"</span>";
			if (!actions) actions = phrase.html("interface.load_nearby.none");
			html +=
				"<tr><td class='clickable' onclick='target_player(\"" +
				player.name +
				"\")'>" +
				player.name +
				"</td><td>" +
				player.level +
				"</td><td>" +
				phrase.definition("class", player.ctype, "name", player.ctype.toTitleCase()).toLocaleUpperCase(phrase.language) +
				"</td><td>" +
				player.age +
				"</td><td>" +
				afk +
				"</td><td>" +
				actions +
				"</td></tr>";
		});
		html += "</table>";
	} else {
		if (fallback) return load_server_list();
		html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_nearby.there_is_no_one_nearby") + "</div>";
	}
	$(".friendslist").html(html);
	$(".friendslist").parent().find(".active2").removeClass("active2");
	$(".fnearby").addClass("active2");
	$(".fnearbyx").addClass("active3");
}

function load_friends(info) {
	if (info) {
		if (friends_inside != "friends") return;
		var html = "";
		html += render_com_buttons();
		if (!info.chars.length && !friends.length) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_friends.you_don_t_have_any_friends_but_it_s_ok") + "</div>";
		else if (!info.chars.length) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_friends.no_one_online") + "</div>";
		else {
			html += "<table style='margin: 5px; text-align: center'>";
			html +=
				"<tr style='color: gray; text-decoration: underline'><th style='width: 100px'>" +
				phrase.html("interface.load_friends.name") +
				"</th><th style='width: 60px'>" +
				phrase.html("interface.load_friends.level") +
				"</th><th style='width: 100px'>" +
				phrase.html("interface.load_friends.class") +
				"</th><th style='width: 100px'>" +
				phrase.html("interface.load_friends.status") +
				"</th><th style='width: 120px'>" +
				phrase.html("interface.load_friends.server") +
				"</th></tr>";
			info.chars.sort(function (a, b) {
				if (!a.afk && b.afk) return -1;
				if (a.afk && !b.afk) return 1;
				if (a.age < b.age) return -1;
				if (a.age > b.age) return 1;
				if (a.name < b.name) return -1;
				return 1;
			});
			info.chars.forEach(function (player) {
				var afk = phrase.html("interface.presence.afk");
				if (!player.afk) afk = "<span style='color: #34bf15'>" + phrase.html("interface.load_friends.active") + "</span>";
				html +=
					"<tr><td>" +
					player.name +
					"</td><td>" +
					player.level +
					"</td><td>" +
					phrase.definition("class", player.type, "name", player.type.toTitleCase()).toLocaleUpperCase(phrase.language) +
					"</td><td>" +
					afk +
					"</td><td>" +
					server_to_ui(player.server) +
					"</td></tr>";
			});
			html += "</table>";
		}
		$(".friendslist").html(html);
	} else {
		friends_inside = "friends";
		api_call("pull_friends");
		//$(".friendslist").html("<div style='margin-top: 8px'>Loading ...</div>");
		$(".friendslist").html(html);
	}
	$(".friendslist").parent().find(".active2").removeClass("active2");
	$(".ffriends").addClass("active2");
	$(".ffriendsx").addClass("active3");
}

function load_server_list(info) {
	if (info) {
		if (friends_inside != "server") return;
		var html = "";
		html += render_com_buttons();
		if (!info.length) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_server_list.no_one_discoverable") + "</div>";
		else {
			html += "<table style='margin: 5px; text-align: center'>";
			html +=
				"<tr style='color: gray; text-decoration: underline'><th style='width: 100px'>" +
				phrase.html("interface.load_server_list.name") +
				"</th><th style='width: 60px'>" +
				phrase.html("interface.load_server_list.level") +
				"</th><th style='width: 100px'>" +
				phrase.html("interface.load_server_list.class") +
				"</th><th style='width: 60px'>" +
				phrase.html("interface.load_server_list.age") +
				"</th><th style='width: 100px'>" +
				phrase.html("interface.load_server_list.status") +
				"</th><th style='width: 120px'>" +
				phrase.html("interface.load_server_list.party") +
				"</th>";
			if (is_pvp) html += "<th style='width: 120px'>" + phrase.html("interface.load_server_list.kills") + "</th>";
			html += "</tr>";
			info.sort(function (a, b) {
				if (!a.afk && b.afk) return -1;
				if (a.afk && !b.afk) return 1;
				if (a.age < b.age) return -1;
				if (a.age > b.age) return 1;
				if (a.name < b.name) return -1;
				return 1;
			});
			info.forEach(function (player) {
				var afk = phrase.html("interface.presence.afk"),
					party = player.party,
					name = player.name;
				if (!player.afk) afk = "<span style='color: #34bf15'>" + phrase.html("interface.load_server_list.active") + "</span>";
				else if (player.afk == "code") afk = "<span style='color: gray'>CODE</span>";
				else if (player.afk == "bot") afk = "<span style='color: gray'>" + phrase.html("interface.presence.bot") + "</span>";
				if (!player.party && player.name != character.name && player.name != "Hidden")
					party =
						"<span style='color: #34BCAF' class='clickable' onclick='parent.socket.emit(\"party\",{event:\"invite\",name:\"" +
						player.name +
						'"}); push_deferred("party")\'>' +
						phrase.html("interface.load_server_list.invite") +
						"</span>";
				else if (player.name == "Hidden") party = "<span style='color: #999999'>" + phrase.html("interface.load_server_list.none") + "</span>";
				else if (!player.party) party = "<span style='color: #999999'>" + phrase.html("interface.load_server_list.you") + "</span>";
				else
					party =
						"<span style='color: #9F68C0' class='clickable' onclick='parent.socket.emit(\"party\",{event:\"request\",name:\"" +
						player.name +
						'"}); push_deferred("party")\'>' +
						player.party +
						"</span>";
				if (player.name != character.name && player.name != "Hidden")
					party += " <span style='color: #A255BA' class='clickable' onclick='hide_modal(); cpm_window(\"" + player.name + "\");'>" + phrase.html("interface.chat.private_message_short") + "</span>";
				if (name == "Hidden") name = "<span style='color:gray'>" + phrase.html("interface.load_server_list.hidden") + "</span>";
				html +=
					"<tr><td>" +
					name +
					"</td><td>" +
					player.level +
					"</td><td>" +
					phrase.definition("class", player.type, "name", player.type.toTitleCase()).toLocaleUpperCase(phrase.language) +
					"</td><td>" +
					player.age +
					"</td><td>" +
					afk +
					"</td><td>" +
					party +
					"</td>";
				if (is_pvp) html += "<td>" + to_pretty_num(player.kills) + "</td>";
				html += "</tr>";
			});
			html += "</table>";
		}
		$(".friendslist").html(html);
	} else {
		friends_inside = "server";
		socket.emit("players");
		//$(".friendslist").html("<div style='margin-top: 8px'>Loading ...</div>");
		$(".friendslist").html(html);
	}
	$(".friendslist").parent().find(".active2").removeClass("active2");
	$(".fserver").addClass("active2");
	$(".fserverx").addClass("active3");
}

function load_merchants(info) {
	if (info) {
		if (friends_inside != "servers") return;
		var html = "";
		if (!info.chars.length) html = "<div style='margin-top: 8px'>" + phrase.html("interface.load_merchants.no_merchants_with_a_stand_online") + "</div>";
		else {
			html += "<div style='text-align: left; margin: 20px'>";
			info.chars.sort(function (a, b) {
				if (!a.afk && b.afk) return -1;
				if (a.afk && !b.afk) return 1;
				if (a.age < b.age) return -1;
				if (a.age > b.age) return 1;
				if (a.name < b.name) return -1;
				return 1;
			});
			info.chars.forEach(function (player) {
				merchants[player.name] = player;
				html += "<div style='margin-bottom: 20px'>";
				html += "<div style='display: inline-block; margin-right: 20px'>";
				html += render_slots(player, { pure: true, gallery: true, merchant: true });
				html += "</div>";
				html += "<div style='display: inline-block; vertical-align: top; margin-top: 20px'>";
				html += sprite(player.skin, { cx: player.cx, scale: 2, height: 64, width: 42 });
				html += "<div>" + player.name + "</div>";
				html += "<div>" + G.maps[player.map].name + ": <span style='color: gray'>" + parseInt(player.x) + "," + parseInt(player.y) + "</span></div>";
				html += "<div style='color: #8AB272'>" + server_to_ui(player.server) + "</div>";
				html += "</div>";
				html += "</div>";
			});
			html += "</div>";
		}
		$(".friendslist").html(html);
	} else {
		friends_inside = "servers";
		api_call("pull_merchants");
		$(".friendslist").html("");
		$(".friendslist").parent().find(".active2").removeClass("active2");
		$(".fservers").addClass("active2");
	}
}

function load_servers_list(info) {
	friends_inside = "servers";
	var html = "<div style='text-align:center'><div style='width:240px; display:inline-block'>";
	html += "<table style='margin: 5px; text-align: left' class='sslist'>";
	html +=
		"<tr style='color: gray; text-decoration: underline'><th style='width: 120px'>" +
		phrase.html("interface.load_servers_list.name") +
		"</th><th style='width: 40px'>#</th><th style='width: 60px'>" +
		phrase.html("interface.load_servers_list.action") +
		"</th>";
	html += "</tr>";
	html +=
		"<tr><td style='color: #B7587D'><span class='clickable' onclick='load_merchants()'>" +
		phrase.html("interface.load_servers_list.all_merchants") +
		"</span></td><td><span style='color:#929C99'>N</span></td><td style='color: #2699AF'><span class='clickable' onclick='load_merchants()'>" +
		phrase.html("interface.load_servers_list.show") +
		"</span></td></tr>";
	X.servers.forEach(function (server) {
		var action = "<span style='color:gray'>" + phrase.html("interface.load_servers_list.here") + "</span>";
		if (!(server_region == server.region && server.name == server_identifier))
			action =
				"<a href='/character/" +
				character.name +
				"/in/" +
				server.region +
				"/" +
				server.name +
				"/' class='cancela' style='color: #4C9BC8'>" +
				phrase.html("interface.load_servers_list.switch") +
				"</span>";
		html +=
			"<tr><td>" + server_regions[server.region] + " " + server.name + "</td><td><span style='color:" + colors.server_success + "'>" + server.players + "</span></td><td>" + action + "</td></tr>";
	});
	html += "</table></div></div>";
	$(".friendslist").html(html);
	$(".friendslist").parent().find(".active2").removeClass("active2");
	$(".fservers").addClass("active2");
}

function load_character_list() {
	tut("characters");
	friends_inside = "characters";
	var html = "";
	html += "<table style='margin: 5px; text-align: center' class='cclist'>";
	html +=
		"<tr style='color: gray; text-decoration: underline'><th style='width: 140px'>" +
		phrase.html("interface.load_character_list.name") +
		"</th><th style='width: 70px'>" +
		phrase.html("interface.load_character_list.level") +
		"</th><th style='width: 120px'>" +
		phrase.html("interface.load_character_list.class") +
		"</th><th style='width: 120px'>" +
		phrase.html("interface.load_character_list.status") +
		"</th><th style='width: 120px'>" +
		phrase.html("interface.load_character_list.deploy") +
		"</th>";
	html += "</tr>";
	X.characters.forEach(function (player) {
		var afk = phrase.html("interface.presence.afk"),
			party = player.party,
			name = player.name,
			online = false;
		if (player.online)
			((afk = "<span style='color: #34bf15'>" + phrase.html("interface.load_character_list.online") + "</span>"),
				(link = "<span class='gray'>" + phrase.html("interface.load_character_list.deployed") + "</span>"));
		else
			((afk = "<span style='color: gray'>" + phrase.html("interface.load_character_list.offline") + "</span>"),
				(link =
					"<a href='/character/" +
					player.name +
					"/in/" +
					server_region +
					"/" +
					server_identifier +
					"/' target='_blank'" +
					(is_tauri ? " onclick='tauri_create_subwindow(this.href); return false;'" : "") +
					" class='cancela' style='color: #4C9BC8'>" +
					phrase.html("interface.load_character_list.deploy") +
					"</a>"));
		if (player.name != character.name && player.name != "Hidden")
			party += " <span style='color: #A255BA' class='clickable' onclick='hide_modal(); cpm_window(\"" + player.name + "\");'>" + phrase.html("interface.chat.private_message_short") + "</span>";
		if (name == "Hidden") name = "<span style='color:gray'>" + phrase.html("interface.load_character_list.hidden") + "</span>";
		html +=
			"<tr><td>" +
			name +
			"</td><td>" +
			player.level +
			"</td><td>" +
			phrase.definition("class", player.type, "name", player.type.toTitleCase()).toLocaleUpperCase(phrase.language) +
			"</td><td>" +
			afk +
			"</td>";
		html += "<td>" + link + "</td>";
		html += "</tr>";
	});
	html += "</table>";
	$(".friendslist").html(html);
	$(".friendslist").parent().find(".active2").removeClass("active2");
	$(".fcharacters").addClass("active2");
}

function load_mainframe_list(info) {
	friends_inside = "mainframe";
	if (!info) {
		$(".friendslist").html("<div style='margin-top: 8px'>" + phrase.html("interface.load_mainframe_list.connecting_to_mainframe") + "</div>");
		$(".friendslist").parent().find(".active2").removeClass("active2");
		$(".fmainframe").addClass("active2");
		api_call("mainframe_get_dashboard")
			.then(function (result) {
				if (friends_inside == "mainframe") load_mainframe_list(result);
			})
			.catch(function (error) {
				if (friends_inside != "mainframe") return;
				$(".friendslist").html(
					"<div style='margin-top: 8px; color: #E45D69'>" + phrase.html("interface.load_mainframe_list.mainframe", { value: phrase.error((error && error.reason) || "unavailable") }) + "</div>",
				);
			});
		return;
	}
	var html = "<div style='text-align:left; margin: 10px'>";
	html +=
		"<div style='margin-bottom: 12px'><span style='color:#5ED6A8'>" +
		(info.online ? phrase.html("interface.load_mainframe_list.mainframe_online") : phrase.html("interface.load_mainframe_list.mainframe_offline")) +
		"</span>" +
		" " +
		"&nbsp;" +
		" " +
		"<span style='color:gray'>" +
		phrase.html("interface.load_mainframe_list.shells", { value: to_pretty_num(info.shells || 0) }) +
		"</span></div>";
	(info.characters || []).forEach(function (entry) {
		var assignment = entry.assignment || {};
		var runtime = entry.runtime || {};
		var access = entry.access || {};
		var status = runtime.phase || assignment.desired_state || "stopped";
		var remaining = Math.max(0, Math.ceil(Number(access.remaining_seconds) || 0));
		html += "<div style='padding: 8px; margin-bottom: 6px; border: 2px solid #4C4C4C'>";
		html +=
			"<span style='color:#F3A05D'>" +
			html_escape(entry.character) +
			"</span> <span style='color:gray'>" +
			phrase.html("interface.load_mainframe_list.lv", {
				value: to_pretty_num(entry.level || 0),
				value2: phrase.definition("class", entry.class, "name", entry.class || "").toLocaleUpperCase(phrase.language),
			}) +
			"</span>";
		html +=
			"<span style='float:right; color:" + (status == "running" ? "#67C85C" : "gray") + "'>" + html_escape(phrase.definition("mainframe_status", status, "name", status.toUpperCase())) + "</span>";
		html +=
			"<div style='font-size:18px; color:gray; margin-top:4px'>" +
			html_escape(assignment.server || runtime.server || phrase.html("interface.load_mainframe_list.not_linked")) +
			" / " +
			(access.active ? phrase.html("interface.time.minutes_left", { count: Math.ceil(remaining / 60) }) : phrase.html("interface.load_mainframe_list.no_active_window")) +
			"</div>";
		html += "</div>";
	});
	if (!(info.characters || []).length) html += "<div>" + phrase.html("interface.load_mainframe_list.you_don_t_have_any_characters_yet") + "</div>";
	html +=
		"<div style='text-align:center; margin-top: 12px'><a class='gamebutton cancela' href='/mainframe' target='_blank'>" + phrase.html("interface.load_mainframe_list.open_mainframe") + "</a></div>";
	html += "</div>";
	$(".friendslist").html(html);
	$(".friendslist").parent().find(".active2").removeClass("active2");
	$(".fmainframe").addClass("active2");
}

function show_delete_mail(id) {
	show_confirm(phrase.html("interface.mail.confirm_delete"), phrase.html("interface.confirm.yes"), phrase.html("interface.close.cancel"), function () {
		api_call("delete_mail", { mid: id });
		hide_modal();
		setTimeout(function () {
			hide_modal();
		}, 20);
		setTimeout(function () {
			load_mail();
		}, 1600);
	});
}

function render_mail(id) {
	var mail = window.mail[id];
	var html = "<div style='font-size: 24px'>";
	html += "<div class='clickable' style='color: #DB090A; float: right' onclick='show_delete_mail(\"" + id + "\");'>" + phrase.html("interface.mail.delete") + "</div>";
	html += "<div class='mailsubject'><span style='color: gray'>" + phrase.html("interface.mail.from") + "</span> " + mail.fro + "</div>";
	html += "<div class='mailsubject'><span style='color: gray'>" + phrase.html("interface.mail.to") + "</span> " + mail.to + "</div>";
	html += "<div class='mailsubject'><span style='color: gray'>" + phrase.html("interface.mail.subject") + "</span> " + html_escape(phrase.message(mail.subject_message || mail.subject)) + "</div>";
	html += "<div class='mailsubject'>" + html_escape(phrase.message(mail.body_message || mail.message)).replace_all("\r\n", "<br />").replace_all("\n", "<br />").replace_all("\t", "&nbsp;&nbsp;") + "</div>";
	if (mail.item) {
		var item = JSON.parse(mail.item);
		var take = "";
		if (!mail.taken)
			take =
				" <span class='clickable takeitem' style='color: #6DAD47' onclick='parent.socket.emit(\"mail_take_item\",{id:\"" + id + "\"})'>" + " " + phrase.html("interface.mail.take") + " " + "</span>";
		html +=
			"<div class='mailsubject'><span style='color: gray'>" +
			phrase.html("interface.mail.item") +
			"</span> " +
			(item.gold ? phrase.html("cave.gold", {gold: item.gold}) : item_container({ skin: G.items[item.name].skin, def: G.items[item.name], draggable: false }, item)) +
			take +
			"</div>";
	}
	html += "</div>";
	show_modal(html);
	api_call("read_mail", { mail: id });
}

function load_mail(info) {
	var html = "";
	html +=
		"<div class='gamebutton gamebutton-small' onclick='pcs(); show_mail_modal()'>" +
		phrase.html("interface.load_mail.send_mail") +
		" " +
		"<span style='color: gray'>" +
		phrase.html("interface.load_mail.cost") +
		"</span> <span style='color: gold'>48,000</span></div>";
	if (info) {
		if (friends_inside != "mail") return;
		if (info.cursored) html += "<div style='margin-top: 8px; margin-bottom: 8px'>" + phrase.html("interface.load_mail.previous_emails_not_shown") + "</div>";
		if (!info.mail.length && info.cursored) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_mail.end_of_mail") + "</div>";
		else if (!info.mail.length) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_mail.no_mail_yet") + "</div>";
		else {
			html += "<div style='text-align: left; margin: 20px'>";
			window.mail = {};
			info.mail.forEach(function (mail) {
				var item_html = "";
				window.mail[mail.id] = mail;
				if (mail.item && !mail.taken) {
					var item = JSON.parse(mail.item);
					item_html += " <span style='color: #6DAD47'>" + phrase.html("interface.load_mail.item") + "</span> ";
				}
				html +=
					"<div class='mailsubject clickable' onclick='pcs(); render_mail(\"" +
					mail.id +
					"\")'><span style='color: gray'>" +
					phrase.html("interface.load_mail.from") +
					"</span> " +
					mail.fro +
					" <span style='color: gray'>" +
					phrase.html("interface.load_mail.to") +
					"</span> " +
					mail.to +
					" <span style='color: gray'>" +
					phrase.html("interface.load_mail.subject") +
					"</span> " +
					html_escape(phrase.message(mail.subject_message || mail.subject)) +
					item_html +
					"</div>";
			});
			html += "</div>";
			if (!(info.cursor && info.more)) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_mail.end_of_mail") + "</div>";
			else html += "<div style='margin-top: 8px' class='clickable' onclick='api_call(\"pull_mail\",{cursor:\"" + info.cursor + "\"});'>" + phrase.html("interface.load_mail.load_more") + "</div>";
		}
		$(".friendslist").html(html);
		tut("mail");
	} else {
		friends_inside = "mail";
		api_call("pull_mail");
		$(".friendslist").html(html);
		$(".friendslist").parent().find(".active2").removeClass("active2");
		$(".fmail").addClass("active2");
	}
}

function load_chat(info, type) {
	var html = "";
	if (!type) type = "all";
	html +=
		"<div class='gamebutton gamebutton-small " +
		((type == "global" && "gamebutton-active") || "") +
		"' style='color: #CDD584' onclick='pcs(); load_chat(null,\"global\")'>" +
		phrase.html("interface.load_chat.global") +
		"</div> ";
	html +=
		"<div class='gamebutton gamebutton-small " +
		((type == "party" && "gamebutton-active") || "") +
		"' style='color: #3B8ED2' onclick='pcs(); load_chat(null,\"party\")'>" +
		phrase.html("interface.load_chat.party") +
		"</div> ";
	html +=
		"<div class='gamebutton gamebutton-small " +
		((type == "private" && "gamebutton-active") || "") +
		"' style='color: #D0598B' onclick='pcs(); load_chat(null,\"private\")'>" +
		phrase.html("interface.load_chat.private") +
		"</div> ";
	html +=
		"<div class='gamebutton gamebutton-small " +
		((type == "all" && "gamebutton-active") || "") +
		"' style='color: #717171' onclick='pcs(); load_chat(null)'>" +
		phrase.html("interface.load_chat.all_incoming") +
		"</div> ";
	X.servers.forEach(function (server) {
		html +=
			"<div class='gamebutton gamebutton-small " +
			((type == server.key && "gamebutton-active") || "") +
			"' style='color: #CFD5EB' onclick='pcs(); load_chat(null,\"" +
			server.key +
			"\")'>" +
			server.region +
			" " +
			server.name +
			"</div> ";
	});
	// html+="<div class='gamebutton gamebutton-small' style='color: #88D69A' onclick='pcs(); show_alert(\"Soon\")'>Pull</div> ";
	if (info) {
		if (friends_inside != "chat") return;
		if (info.cursored) html += "<div style='margin-top: 8px; margin-bottom: 8px'>" + phrase.html("interface.load_chat.previous_messages_not_shown") + "</div>";
		if (!info.messages.length && info.cursored) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_chat.end_of_chat") + "</div>";
		else if (!info.messages.length) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_chat.no_messages_yet") + "</div>";
		else {
			html += "<div style='text-align: left; margin: 20px'>";
			window.messages = {};
			info.messages.forEach(function (message) {
				var item_html = "",
					server = "";
				window.messages[message.id] = message;
				var color = "gray";
				if (message.type == "private") ((color = "#CD7879"), (server = " <span style='color: #505259'>[" + message.to[0] + "]</span>"));
				if (message.type == "party") color = "#5B8DB0";
				if (message.type == "ambient" || type == "global") server = " <span style='color: #505259'>[" + server_to_ui(message.server) + "]</span>";
				html += "<div title='" + message.date + "'>" + html_escape(message.fro) + ":" + " <span style='color: " + color + "'>" + html_escape(message.message) + server + "</span></div>";
			});
			html += "</div>";
			if (!(info.cursor && info.more)) html += "<div style='margin-top: 8px'>" + phrase.html("interface.load_chat.end_of_messages") + "</div>";
			else html += "<div style='margin-top: 8px' class='clickable' onclick='api_call(\"pull_messages\",{cursor:\"" + info.cursor + "\"});'>" + phrase.html("interface.load_chat.load_more") + "</div>";
		}
		$(".friendslist").html(html);
	} else {
		friends_inside = "chat";
		api_call("pull_messages", { type: type });
		$(".friendslist").html(html);
		$(".friendslist").parent().find(".active2").removeClass("active2");
		$(".fchat").addClass("active2");
	}
}

function load_pvp_list(list) {
	console.log(list);
	var html = "<div style='font-size: 24px; text-align: center; padding: 6px; line-height: 24px;'>",
		pwn = false;
	list.forEach(function (a_t) {
		html += "<div>" + phrase.html("interface.load_pvp_list.pwned", { value: a_t[0], value2: a_t[1] }) + "</div>";
		pwn = true;
	});
	if (!pwn) html += "<div>" + phrase.html("interface.load_pvp_list.noone_pwned_anyone") + "</div>";
	html += "</div>";
	show_modal(html, { wwidth: 400 });
}

function load_coming_soon(num) {
	var message = phrase.html("interface.load_coming_soon.coming_sooner");
	$(".friendslist").parent().find(".active2").removeClass("active2");
	if (num == 1) $(".fserver").addClass("active2");
	else if (num == 2) ($(".fguild").addClass("active2"), (message = phrase.html("interface.load_coming_soon.coming_soon")));
	else if (num == 3) ($(".fleaders").addClass("active2"), (message = phrase.html("interface.load_coming_soon.planned_along_with_achievements_character_statistics_weekly_monthly_leaderboards")));
	else if (num == 4) ($(".fmail").addClass("active2"), (message = phrase.html("interface.load_coming_soon.coming_soon")));
	$(".friendslist").html("<div style='margin-top: 8px'>" + message + "</div>");
}

var friends_inside = "nearby";
function render_com() {
	tut("com");
	var html = "";
	var c_count = 0;
	api_call("servers_and_characters");
	X.characters.forEach(function (c) {
		if (c.online) c_count += 1;
	});
	html += "<div style='text-align: center'>";
	//html+="<div class='gamebutton ffriends' onclick='load_friends()'>Friends</div>";
	//html+=" <div class='gamebutton fnearby' onclick='load_nearby()'>Nearby</div>";
	//html+=" <div class='gamebutton fserver' onclick='load_server_list();'>Server</div>";
	html += " <div class='gamebutton ffriends fserver fnearby' onclick='load_server_list();'>" + phrase.html("interface.com.comrades") + "</div>";
	html += " <div class='gamebutton fservers' onclick='load_servers_list();'>" + phrase.html("interface.com.realm") + "</div>";
	html += " <div class='gamebutton fcharacters' onclick='load_character_list();'>" + phrase.html("interface.com.characters") + "<span class='ccount'>" + c_count + "</span>/4]</div>";
	html += " <div class='gamebutton fmainframe' onclick='load_mainframe_list();'>" + "Mainframe" + "</div>";
	html += " <div class='gamebutton fchat' onclick='load_chat();'>" + phrase.html("interface.com.chat") + "</div>";
	html += " <div class='gamebutton fmail' onclick='load_mail();'>" + phrase.html("interface.com.mail") + "<span class='mcount'>" + ((window.X && X.unread) || 0) + "</span>]</div>";
	// html+=" <div class='gamebutton fguild' onclick='load_coming_soon(2)'>Guild</div> <div class='gamebutton fmail' onclick='load_coming_soon(4)'>Mail</div> <div class='gamebutton fleaders' onclick='load_coming_soon(3)'>Leaderboards</div>";
	html += "<div class='friendslist mt5' style='height: 400px; border: 5px solid gray; font-size: 24px; overflow: scroll; padding: 6px'></div>";
	html += "<div style='font-size: 16px; margin-top: 5px; color: gray; text-align: center'>" + phrase.html("interface.com.note_the_communicator_is_an_evolving_protoype") + "</div>";
	// html+="<div class='gamebutton mt5' style='display: block'>Refresh</div>";
	html += "</div>";
	show_modal(html, { wwidth: min(680, viewport_width() - 52), close: { label: "X", classes: "ui-close-com" } });
	load_nearby(1);
}

function render_com_buttons() {
	var html = "<div style='text-align: center'>";
	html += "<div class='gamebutton gamebutton-small ffriendsx' onclick='load_friends()'>" + phrase.html("interface.com_buttons.friends") + "</div>";
	html += " <div class='gamebutton gamebutton-small fnearbyx' onclick='load_nearby()'>" + phrase.html("interface.com_buttons.nearby") + "</div>";
	html += " <div class='gamebutton gamebutton-small fserverx' onclick='load_server_list();'>" + phrase.html("interface.com_buttons.server") + "</div>";
	html += "</div>";
	return html;
}

var IID = null;

function precompute_image_positions() {
	// G.images is new [25/09/18]
	if (IID) return;
	if (!window.SS) ((window.SS = {}), (window.SSU = {}));
	if (!Object.keys(T).length) process_game_data();
	IID = {}; // IID is reset after game loads, so actual dimensions are live
	for (var name in G.sprites) {
		var s_def = G.sprites[name];
		if (s_def.skip) continue;
		var row_num = 4,
			col_num = 3,
			s_type = "full";
		if (in_arr(s_def.type, ["animation"])) ((row_num = 1), (s_type = s_def.type));
		if (in_arr(s_def.type, ["tail"])) ((col_num = 4), (s_type = s_def.type));
		if (in_arr(s_def.type, ["v_animation", "head", "hair", "hat", "s_wings", "face", "makeup", "beard"])) ((col_num = 1), (s_type = s_def.type));
		if (in_arr(s_def.type, ["a_makeup", "a_hat"])) ((col_num = s_def.frames || 3), (s_type = s_def.type));
		if (s_def.type == "head" && s_def.frames) col_num = s_def.frames;
		if (in_arr(s_def.type, ["wings", "body", "armor", "skin", "character"])) s_type = s_def.type;
		if (in_arr(s_def.type, ["emblem", "gravestone"])) ((row_num = 1), (col_num = 1), (s_type = s_def.type));
		var matrix = s_def.matrix;
		var width = (G.images[s_def.file.split("?")[0]] && G.images[s_def.file.split("?")[0]].width) || s_def.width || (window.C && C[s_def.file] && C[s_def.file].width) || 312;
		var height = (G.images[s_def.file.split("?")[0]] && G.images[s_def.file.split("?")[0]].height) || s_def.height || (window.C && C[s_def.file] && C[s_def.file].height) || 288;
		// if(s_def.columns!=4 || s_def.rows!=2) continue;
		for (var i = 0; i < matrix.length; i++)
			for (var j = 0; j < matrix[i].length; j++) {
				var name = matrix[i][j];
				if (!name) continue;
				// 0 total-width,  1 total-height, 2 X-start, 3 Y-start, 4 width, 5 height, 6 col_num, 7 file, 8 type
				IID[name] = [width, height, (j * width) / s_def.columns, (i * height) / s_def.rows, width / (s_def.columns * col_num), height / (s_def.rows * row_num), col_num, s_def.file, s_type];
				T[name] = s_def.type || "full";
				SSU[name] = SS[name] = s_def.size || "normal";
				if (G.cosmetics.prop[name] && G.cosmetics.prop[name].includes("slender")) SSU[name] += "slender";
				if (G.dimensions[name]) {
					//IID[name][4]=G.dimensions[name][0]; - not for here, maybe to replace the default 39 50
					//IID[name][5]=G.dimensions[name][1];
					IID[name][2] = IID[name][2] + (G.dimensions[name][2] || 0); // instead of 6 width-disp
				}
			}
	}
	if (0)
		for (var name in IID) {
			for (var j = 0; j < IID[name].length - 1; j++) IID[name][j] *= 1.5;
		}
}

function sprite_image(name, args) {
	try {
		precompute_image_positions();
		if (!args) args = {};
		args.p = args.p || 0;
		args.rheight = args.rheight || 0; // height reduction for cx.upper
		if (!IID[name]) name = "naked";
		var scale = args.scale || 1,
			css = "";
		// previously, the default width/height was 39px/50px [26/09/18]
		var width = IID[name][4],
			w_disp = 0,
			l_disp = 0,
			j = args.j || 0;
		var height = IID[name][5];
		if (G.dimensions[name]) ((width = G.dimensions[name][0]), (height = G.dimensions[name][1]));
		if (args.cwidth) l_disp = (args.cwidth - width * scale) / 2;
		l_disp += (args.x || 0) * scale;
		// l_disp=parseInt(l_disp); // currently, on Chrome, -0.25, 0.5 px corrections etc. look bad [02/10/18]
		if (IID[name][6] == 1) w_disp = width;
		if (args.opacity && args.opacity != 1) css += "opacity: " + args.opacity + ";";
		return (
			"<div style='display: inline-block; width: " +
			width * scale +
			"px; height: " +
			(height - args.rheight) * scale +
			"px; overflow: hidden; position: absolute; left: " +
			l_disp +
			"px; bottom: " +
			(args.p + args.rheight) * scale +
			"px; " +
			css +
			"'>\
			<img style='\
			margin-left: " +
			(-IID[name][2] - IID[name][4] + w_disp - (IID[name][4] - width + (args.x_disp || 0)) / 2) * scale +
			"px; \
			margin-top: " +
			(-IID[name][3] - IID[name][5] - IID[name][5] * j + height) * scale +
			"px; \
			width: " +
			IID[name][0] * scale +
			"px; \
			height: " +
			IID[name][1] * scale +
			"px;' \
		src='" +
			(window.desktop ? desktop.imageUrl(IID[name][7]) : IID[name][7]) +
			"'/></div>"
		);
		// Math.ceil((IID[name][4]-width)/2)
	} catch (e) {
		console.log(e);
	}
	return "";
}

function sprite(name, args) {
	try {
		if (!args) args = {};
		if (is_string(args)) args = { cx: args };
		if (is_string(args.cx)) args.cx = args.cx.split(",");
		if (!args.cx) args.cx = {};
		if (!args.scale) args.scale = 1.5;
		if (G.monsters[name] && G.monsters[name].size) args.scale -= 1 - G.monsters[name].size;
		precompute_image_positions();
		if (!IID[name] && G.items[name]) return item_container({ skin: name, bcolor: "black" });
		if (G.monsters[name] && G.monsters[name].skin) name = G.monsters[name].skin;
		prune_cx(args.cx, name);
		if (!args.width) args.width = 40;
		if (!args.height) args.height = 50;
		if (!args.rx_disp) args.rx_disp = 0;
		if (args.full) {
			if (G.dimensions[name]) ((args.width = (G.dimensions[name][0] + 4) * args.scale), (args.height = (G.dimensions[name][1] + 5) * args.scale));
			else ((args.width = IID[name][4] * args.scale), (args.height = IID[name][5] * args.scale));
		}
		if (G.dimensions[name] && G.dimensions[name][3]) args.rx_disp = -G.dimensions[name][3] * args.scale;
		var html =
			"<div style='height: " +
			args.height +
			"px; width: " +
			args.width +
			"px; position: relative; text-align: center; overflow:" +
			((args.overflow && "visible") || "hidden") +
			"; display: inline-block'>";
		var cosmetic_head_y = (args.cosmetic_head_y || 0) + ((G.cosmetics.head_y && G.cosmetics.head_y[name]) || 0);
		var head_y = G.cosmetics.default_head_place - cosmetic_head_y;
		var hair_y = G.cosmetics.default_hair_place - cosmetic_head_y;
		var hat_y = G.cosmetics.default_hat_place - cosmetic_head_y;
		var skin = null,
			rip = false,
			cxs = [name],
			cx_prop = {};
		for (var n in args.cx) {
			var cid = args.cx[n];
			if (n == "upper" && (in_arr(T[name], ["full", "character"]) || T[cid] != "armor" || SSU[cid] != SSU[name])) continue;
			cxs.push(cid);
		}
		cxs.forEach(function (cid) {
			if (G.cosmetics.prop[cid])
				G.cosmetics.prop[cid].forEach(function (p) {
					cx_prop[p] = true;
				});
		});
		var body_type = "full";
		if (T[name] == "armor") body_type = "armor";
		else if (T[name] == "body") body_type = "body";
		else if (T[name] == "character") body_type = "character";
		if (args.rip) {
			// originally opacity=0.4
			html += sprite_image(args.cx.gravestone || "gravestone", { cwidth: args.width, scale: args.scale }) + "</div>";
			return html;
		}
		var opacity = 1,
			j = args.j || 0;
		if (body_type != "full" && !args.cx.head) args.cx.head = "makeup117";
		if (body_type != "character" && !args.cx.head) args.cx.head = "makeup117";
		// console.log(!(IID[name][4]%2)+" "+args.x_disp);
		var head_dy = { large: 2, tall: 1, normal: 0, small: -1, xsmall: -3, xxsmall: -4 }[SS[name]];
		head_y += head_dy;
		var head_dh = (G.cosmetics.head[args.cx.head] && G.cosmetics.head[args.cx.head][3]) || 0;
		var hair_dy = (G.cosmetics.hair[args.cx.hair] && G.cosmetics.hair[args.cx.hair][0]) || 0;
		hair_dy += head_dh + head_dy;
		hair_y += hair_dy;
		var hair_dh = (G.cosmetics.hair[args.cx.hair] && G.cosmetics.hair[args.cx.hair][1]) || 0;
		hat_y += hair_dh + head_dy;
		var hat_dy = G.cosmetics.hat[args.cx.hat] || 0;
		hat_dy += head_dh;
		hat_y += hat_dy;
		var hidden_head = j == 3 || (G.cosmetics.prop[name] && G.cosmetics.prop[name].includes("covers"));
		var cx = {};
		for (var place in args.cx) {
			var cid = args.cx[place];
			if (!cid || !cid.length || !IID[cid]) continue;
			if (place == "head") {
				if (body_type != "full" && body_type != "character") cx.head = cid;
			} else if (place == "hair") {
				if (body_type != "full" && body_type != "character" && !cx_prop.no_hair) cx.hair = cid;
			} else if (place == "upper") {
				if (body_type != "full" && T[cid] == "armor" && SSU[cid] == SSU[name]) cx.upper = cid;
			} else cx[place] = cid;
		}
		if (cx.head && !skin && body_type == "armor") {
			skin = {
				small: (G.cosmetics.head[cx.head] && G.cosmetics.head[cx.head][0]) || "sskin1a",
				normal: (G.cosmetics.head[cx.head] && G.cosmetics.head[cx.head][1]) || "mskin1a",
				tall: (G.cosmetics.head[cx.head] && G.cosmetics.head[cx.head][1]) || "mskin1a",
				large: (G.cosmetics.head[cx.head] && G.cosmetics.head[cx.head][2]) || "lskin1a",
			}[SS[name]];
		}
		var x_disp = IID[name][4] % 2 ? 0 : -0.5;
		var back_x = x_disp;
		if (cx.back && T[cx.back] == "s_wings") {
			var back_dx = G.cosmetics.back && G.cosmetics.back[cx.back];
			if (back_dx === undefined) back_dx = 3;
			back_x += j == 1 ? back_dx : j == 2 ? -back_dx : 0;
		} else if (cx.back && T[cx.back] == "wings") back_x += [-2.5, 5, -9, -5][j];
		if (cx.head && hidden_head) html += sprite_image(cx.head, { x: x_disp, p: head_y, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.back && j != 3) html += sprite_image(cx.back, { x: back_x, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (skin) html += sprite_image(skin, { cwidth: args.width, scale: args.scale, opacity: opacity, j: j, x_disp: args.x_disp });
		if (!(IID[name][4] % 2))
			html += sprite_image(name, { cwidth: args.width, scale: args.scale, opacity: opacity, j: j, x_disp: args.rx_disp + -0.5 }); // old 26px width frame
		else html += sprite_image(name, { cwidth: args.width, scale: args.scale, opacity: opacity, j: j, x_disp: args.rx_disp });
		if (cx.upper) html += sprite_image(cx.upper, { cwidth: args.width, scale: args.scale, opacity: opacity, j: j, rheight: 8 });
		if (cx.head && !hidden_head) html += sprite_image(cx.head, { x: x_disp, p: head_y, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.hair) html += sprite_image(cx.hair, { x: x_disp, p: hair_y, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.face) html += sprite_image(cx.face, { x: x_disp, p: head_y + G.cosmetics.default_face_position, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.chin) html += sprite_image(cx.chin, { x: x_disp, p: head_y + G.cosmetics.default_beard_position, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.tail) html += sprite_image(cx.tail, { p: 0, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.hat && !cx_prop.no_hat) html += sprite_image(cx.hat, { x: x_disp, p: hat_y, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.makeup) html += sprite_image(cx.makeup, { x: x_disp, p: head_y + G.cosmetics.default_makeup_position, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (cx.back && j == 3) html += sprite_image(cx.back, { x: back_x, cwidth: args.width, scale: args.scale, opacity: opacity, j: j });
		if (rip) html += sprite_image(rip, { cwidth: args.width, scale: args.scale, j: j });
		html += "</div>";
		return html;
	} catch (e) {
		console.log(e);
	}
	return "";
}

function cx_sprite(name, args) {
	if (!args) args = {};
	if (G.cosmetics.bundle[name]) return G.cosmetics.bundle[name].map(function (id) { return cx_sprite(id, args); }).join("");
	if (G.skills[name] && G.skills[name].emote) return item_container({ skin: G.skills[name].skin, size: 40, draggable: false });
	function render_cosmetic(slot, rargs) {
		if (!rargs) rargs = {};
		if (!rargs.color && (cx[slot] || slot == "skin")) rargs.color = "#17B8E3";
		else if (!rargs.color) rargs.color = "#5DBA50";
		rargs.bg = "#D5D5D5";
		rargs.bg = "#504254";
		var width = rargs.width || 49,
			height = 48,
			labels = "";
		if (rargs.rip) height = 48;
		rargs.scale = rargs.scale || 2;
		rargs.j = rargs.j || 0;
		if (args.labels) {
			var drop = false,
				mdrop = false,
				ccx = false,
				icx = false;
			for (var dname in G.drops) {
				if (!(G.items[dname] && G.items[dname].e)) continue;
				G.drops[dname].forEach(function (t) {
					if (t[1] == "cx" && t[2] == name) drop = true;
				});
			}
			for (var mname in G.monsters) {
				if (!(G.drops && G.drops.monsters && G.drops.monsters[mname])) continue;
				G.drops.monsters[mname].forEach(function (t) {
					if (t[1] == "cxjar" && t[3] == name) mdrop = true;
				});
			}
			for (var cname in G.classes) {
				if ((G.classes[cname].xcx || []).includes(name)) ccx = true;
			}
			for (var iname in G.items) {
				if ((G.items[iname].xcx || []).includes(name)) icx = true;
			}
			if (drop) labels += "<span style='color:#3696CE'>E</span>";
			if (mdrop) labels += "<span style='color:#896CF7'>M</span>";
			if (ccx) labels += "<span style='color:#61C14A'>C</span>";
			if (icx) labels += "<span style='color:#BDB094'>I</span>";
			if (!labels) labels += "<span style='color:gray'>X</span>";
		}
		html +=
			"<div style='display: inline-block; margin-left: " +
			(args.mleft || 0) +
			"px; margin-right: " +
			(args.mright || 0) +
			"px; vertical-align: middle; margin-bottom: 4px; font-size: 0; line-height: normal'>";
		html +=
			"<div style='background-color: " +
			(rargs.bg || "#504254") +
			"; border: 2px solid gray; font-size: 0px; vertical-align: top; overflow: hidden; width: " +
			width +
			"px; height: " +
			(height + (rargs.aheight || 0) + 16) +
			"px; text-align: center; position: relative'>";
		if (args.labels)
			html +=
				"<div style='font-size: 16px; text-align: center; background: black; display: inline-block; border: 2px solid gray; position: absolute; top: -2px; left: -2px; z-index:1; padding: 0px 0px 0px 2px'>" +
				labels +
				"</div>";
		html +=
			"<div style='margin-top: " +
			((rargs.top || 0) - 2 - 20 * rargs.scale) +
			"px; margin-left: 0px; display: inline-block;'>" +
			sprite(rargs.skin, { cx: rargs.cx, scale: rargs.scale, height: rargs.height * rargs.scale + 20 * rargs.scale, j: rargs.j, width: width, rip: rargs.rip }) +
			"</div>";
		html +=
			"<div style='font-size: 16px; line-height: 14px; text-align: center; color: #C3C3C3; background: black; display: inline-block; border: 2px solid gray; position: absolute; bottom: -2px; left: -2px; right: -2px'>" +
			(rargs.text || phrase.definition("slot", slot, "name", slot)).toLocaleUpperCase(phrase.language) +
			"</div>";
		html += "</div>";
		html += "</div>";
	}
	var html = "";
	precompute_image_positions();
	if (["hair", "face", "head", "makeup", "a_makeup"].includes(T[name])) {
		var cx = { head: (T[name] == "head" && name) || "bwhead" };
		cx[cxtype_to_slot[T[name]]] = name;
		render_cosmetic(T[name], { skin: (T[name] == "head" && "nothing") || "mabw", top: 50 + ((T[name] == "head" && -6) || 0), scale: 3, cx: cx, height: 16, aheight: 4 });
		return html;
	} else if (["hat", "a_hat"].includes(T[name])) {
		var cx = { head: "bwhead" };
		cx[cxtype_to_slot[T[name]]] = name;
		render_cosmetic(T[name], { skin: "mabw", top: 50, scale: 3, cx: cx, height: 16, aheight: 4 });
		return html;
	} else if (["beard", "mask"].includes(T[name])) {
		var cx = { head: "bwhead" };
		cx[cxtype_to_slot[T[name]]] = name;
		render_cosmetic(T[name], { skin: "mabw", top: 30, scale: 3, cx: cx, height: 16 });
		return html;
	} else if (["armor", "body", "character"].includes(T[name])) {
		var cx = { head: "bwhead" };
		cx[cxtype_to_slot[T[name]]] = name;
		render_cosmetic((T[name] == "character" && "char") || T[name], { skin: name, top: -7, scale: 2, cx: cx, height: 36, aheight: 16 });
		return html;
	} else if (["gravestone"].includes(T[name])) {
		var cx = { head: "bwhead" };
		cx[cxtype_to_slot[T[name]]] = name;
		render_cosmetic("stone", { skin: "mabw", top: -7, scale: 2, cx: cx, height: 36, aheight: 16, rip: true });
		return html;
	} else if (["s_wings", "tail"].includes(T[name])) {
		var cx = { head: "bwhead" };
		cx[cxtype_to_slot[T[name]]] = name;
		render_cosmetic(T[name], { skin: "mabw", j: 3, top: -7, width: 59, scale: 2, cx: cx, height: 36, aheight: 16 });
		return html;
	} else {
		return sprite(name, { cx: { head: "bwhead" } });
	}
}

function cx_move(x, y) {
	last_cx_d[0] += x;
	last_cx_d[1] += y;
	var skin = character.skin,
		cx = character.cx;
	if (!textures.naked) generate_textures("naked", "full");
	character.skin = "naked";
	character.cx = {};
	cosmetics_logic(character);
	character.skin = skin;
	character.cx = cx;
	cosmetics_logic(character);
	for (var n in character.cxc) {
		if (character.cxc[n].skin == last_cx_name) {
			character.cxc[n].x += last_cx_d[0];
			character.cxc[n].y += last_cx_d[1];
			character.cxc[n].moved = true;
		}
	}
	var log = last_cx_name + ":";
	if (!last_cx_d[0] && !last_cx_d[1]) log += phrase.html("interface.cosmetics.default_position");
	if (last_cx_d[0] < 0) log += phrase.html("interface.cosmetics.move_left", { pixels: -last_cx_d[0] });
	if (last_cx_d[0] > 0) log += phrase.html("interface.cosmetics.move_right", { pixels: last_cx_d[0] });
	if (last_cx_d[1] < 0) log += phrase.html("interface.cosmetics.move_up", { pixels: -last_cx_d[1] });
	if (last_cx_d[1] > 0) log += phrase.html("interface.cosmetics.move_down", { pixels: last_cx_d[1] });
	add_log(log, "#BD6BB6");
}

function insert_cx_tuners() {
	var html = "<div style='left: " + viewport_width() / 2 + "px; top: " + viewport_height() / 2 + "px; width: 0px; height: 0px; position: fixed; z-index: 100; overflow: visible'>";
	html +=
		"<div style='position: absolute; top: -130px; left: -35px; text-align: center; width: 50px;' class='gamebutton gamebutton-small' onclick='cx_move(0,-1)'>" +
		phrase.html("interface.insert_cx_tuners.up") +
		"</div>";
	html +=
		"<div style='position: absolute; top: 20px; left: -35px; text-align: center; width: 50px;' class='gamebutton gamebutton-small'  onclick='cx_move(0,1)'>" +
		phrase.html("interface.insert_cx_tuners.down") +
		"</div>";
	html +=
		"<div style='position: absolute; top: -20px; left: -110px; text-align: center; width: 50px;' class='gamebutton gamebutton-small' onclick='cx_move(-1,0)'>" +
		phrase.html("interface.insert_cx_tuners.left") +
		"</div>";
	html +=
		"<div style='position: absolute; top: -20px; left: 40px; text-align: center; width: 50px;' class='gamebutton gamebutton-small' onclick='cx_move(1,0)'>" +
		phrase.html("interface.insert_cx_tuners.right") +
		"</div>";
	html += "</div>";
	$("body").append(html);
}

var last_cx_slot = "",
	last_cx_name = "",
	last_cx_d = [0, 0];
function render_cgallery(skin, cx, slot) {
	cx = clone(cx);
	var html = "",
		types = [],
		a = [],
		b = [],
		n = null,
		s,
		old = null,
		j = 0,
		cx_count = all_cx(character, 1),
		cx_map = map_cx(character),
		me = false;
	if ((xtarget || target).me) me = true;
	var bg = "#504254";
	function render_cosmetic(reset) {
		var width = 47,
			height = 64,
			html = "";
		var aheight = 32;
		if (cx.hat || (reset && slot == "hat")) ((height += 12), (aheight += 6));
		if (slot == "gravestone") height = 48;
		var scale = 2,
			found = false,
			onclick =
				'onclick=\'if(!(xtarget||target).me) socket.emit("send",{name:(xtarget||target).name,cx:"' +
				s[0] +
				'"}),push_deferred("send"); else socket.emit("cx",{slot:"' +
				slot +
				'",name:"' +
				s[0] +
				'"}),last_cx_slot="' +
				slot +
				'",last_cx_name="' +
				s[0] +
				"\",last_cx_d=[0,0],push_deferred(\"cx\"); hide_modal();' class='clickable'";
		if ((!me && cx_map[s[0]] && cx_count[cx_map[s[0]]] > 0) || (me && cx_count[s[0]] !== undefined) || (me && character.role === "cx") || reset) found = true;
		else onclick = "";
		html += "<div style='display: inline-block; margin: 4px;'>";
		if (mode.cosmetics) html += "<div style='font-size: 16px; text-align: center'>" + s[0] + "</div>";
		html +=
			"<div style='background-color: " +
			((reset && "#CA8171") || (!found && "#615F6A") || "#639F6C") +
			"; border: 2px solid gray; font-size: 0px; vertical-align: top; overflow: hidden; width: " +
			width +
			"px; height: " +
			height +
			"px; text-align: center' " +
			onclick +
			">";
		html +=
			"<div style='margin-top: " +
			(0 - 2 - 20 * scale) +
			"px; margin-left: 0px; display: inline-block;'>" +
			sprite(skin, { cx: cx, scale: scale, height: aheight * scale + 20 * scale, j: j, width: width, rip: slot == "gravestone" }) +
			"</div>";
		html += "</div>";
		html += "</div>";
		if (reset) n = html;
		else if (found) a.push(html);
		else b.push(html);
	}
	for (var cxt in cxtype_to_slot) {
		if (cxtype_to_slot[cxt] == slot) types.push(cxt);
	}

	if (slot == "upper") types = ["body", "armor"];
	if (slot == "back") types.push("tail"); // synced with server.js/'cx'
	if (slot == "face") (types.push("makeup"), types.push("a_makeup"));

	if (slot == "tail" || slot == "back") j = 3;
	object_sort(T).forEach(function (x) {
		s = x;
		if (in_arr(s[1], types)) {
			if (slot == "gravestone" && s[0] == "gravestone") return; // the reset tile already renders the default gravestone
			if (T[skin] == "full" && slot == "head") return;
			if (slot == "upper" && (T[skin] == "full" || SSU[s[0]] != SSU[skin] || skin == s[0] || T[s[0]] != "armor")) return;
			if (cxtype_to_slot[s[1]] == "skin") skin = s[0];
			else if (slot == "upper") cx.upper = s[0];
			else {
				types.forEach(function (t) {
					delete cx[cxtype_to_slot[t]];
				});
				cx[cxtype_to_slot[s[1]]] = s[0];
			}
			render_cosmetic();
		}
	});
	if ((a.length || b.length) && slot != "skin") {
		s = [""];
		types.forEach(function (t) {
			delete cx[cxtype_to_slot[t]];
		});
		render_cosmetic(1);
	}
	if (a.length || b.length) {
		a.forEach(function (h) {
			html += h;
		});
		if (n) html += n;
		b.forEach(function (h) {
			html += h;
		});
		show_modal(html, { wrap: false, styles: "max-width:400px" });
	} else
		show_modal(
			"<div style='background-color: " +
				bg +
				"; border: 2px solid gray; vertical-align: top; overflow: hidden; text-align: center; padding: 12px; font-size: 32px'>" +
				phrase.html("interface.cgallery.no_alternatives") +
				"</div>",
			{
				wrap: false,
				styles: "max-width:400px",
			},
		);
}

var last_cx = {},
	last_skin = "";
function render_cosmetics(player, args) {
	if (!args) args = {};
	last_cx = player.cx;
	last_skin = player.skin;
	if (args.toggle && $(".cccx").html()) return $("#topleftcornerdialog").html("");
	function render_cosmetic(slot, rargs) {
		if (!rargs) rargs = {};
		if (!rargs.color && (player.cx[slot] || slot == "skin")) rargs.color = "#17B8E3";
		else if (!rargs.color) rargs.color = "#5DBA50";
		rargs.bg = "#D5D5D5";
		rargs.bg = "#504254";
		var width = 39,
			height = 48;
		if (rargs.size == "big") {
			rargs.scale = 3;
			((width = 91), (height = 118));
			rargs.top = 12;
		}
		if (rargs.rip) height = 48;
		rargs.scale = rargs.scale || 2;
		rargs.j = rargs.j || 0;
		html += "<div style='display: inline-block; margin-left: " + (rargs.mleft || 0) + "px;'>";
		html += "<div style='font-size: 16px; text-align: center'>" + (rargs.text || phrase.definition("slot", slot, "name", slot)).toLocaleUpperCase(phrase.language) + "</div>";
		html +=
			"<div style='background-color: " +
			(rargs.bg || "#504254") +
			"; border: 2px solid gray; font-size: 0px; vertical-align: top; overflow: hidden; width: " +
			width +
			"px; height: " +
			height +
			"px; text-align: center'";
		if (player.me || player.owner == character.owner) html += " onclick='render_cgallery(last_skin,last_cx,\"" + slot + "\")' class='clickable'>";
		else html += ">";
		html += "<div style='background: " + rargs.color + "; height: 2px; z-index: 10; position: relative'></div>";
		html +=
			"<div style='margin-top: " +
			((rargs.top || 0) - 2 - 20 * rargs.scale) +
			"px; margin-left: 0px; display: inline-block;'>" +
			sprite(player.skin, { cx: rargs.cx, scale: rargs.scale, height: player.aheight * rargs.scale + 20 * rargs.scale, j: rargs.j, width: width, rip: rargs.rip }) +
			"</div>";
		html += "</div>";
		html += "</div>";
	}
	function render_emotes() {
		var emotes = [];
		object_sort(G.skills).forEach(function (io) {
			if (io[1].emote && player.acx && player.acx[io[1].emote]) emotes.push(io[0]);
		});
		if (!emotes.length) return;
		html += "<div style='display: inline-block; margin-left: 8px; vertical-align: top'>";
		html += "<div style='font-size: 16px; text-align: center'>" + phrase.html("interface.emotes.emotes") + "</div>";
		html += "<div style='display: flex; flex-wrap: wrap; gap: 8px; max-width: 200px; font-size: 0px'>";
		emotes.forEach(function (name) {
			var item = { skin: G.skills[name].skin, size: 40, space: 0, margin: 0, bg: "#504254", draggable: !!player.me, skname: name, loader: name };
			if (player.me && G.skills[name].target) item.onclick = "use_skill('" + name + "',xtarget||ctarget||(!G.skills['" + name + "'].no_self&&character))";
			else if (player.me) item.onclick = "use_skill('" + name + "')";
			html += item_container(item);
		});
		html += "</div></div>";
	}
	var html = "<div style='background-color: black; border: 5px solid gray; padding: 20px; font-size: 24px; display: inline-block; vertical-align: top;' class='cccx'>";
	var color = "";
	html += "<div style='display: inline-block; vertical-align: top'>";
	html += "<div style='margin-top: -5px'>";
	if (IID[player.skin][8] == "full") color = "#BB2242";
	render_cosmetic("head", { text: phrase.definition("slot", "skin", "name", "skin"), top: -9, scale: 3, color: color, cx: { head: player.cx.head } });
	render_cosmetic("hair", { top: 6, scale: 3, mleft: 8, color: color, cx: { head: player.cx.head, hair: player.cx.hair || "bwhair" } });
	color = "";
	render_cosmetic("hat", { top: 12, scale: 3, mleft: 8, color: color, cx: { head: player.cx.head, hair: player.cx.hair, hat: player.cx.hat || "bwhat" } });
	html += "</div>";
	html += "<div>";
	render_cosmetic("face", { top: -9, scale: 3, cx: { head: player.cx.head, hair: player.cx.hair, face: player.cx.face || "bwglasses" } });
	var cx = clone(player.cx);
	delete cx.upper;
	delete cx.back;
	render_cosmetic("skin", { text: phrase("interface.cosmetics.attire"), top: -12, scale: 2, mleft: 8, cx: cx });
	if (IID[player.skin][8] == "full") color = "#BB2242";
	var cx = clone(player.cx);
	delete cx.back;
	render_cosmetic("upper", { top: -5, scale: 2, mleft: 8, color: color, cx: cx });
	color = "";
	html += "</div>";
	html += "<div>";
	render_cosmetic("chin", { top: -20, scale: 3, cx: { head: player.cx.head, hair: player.cx.hair, chin: player.cx.chin || "beard112" } });
	render_cosmetic("special", { top: 10, cx: player.cx, scale: 1, mleft: 8, bg: "#E3B245" });
	var cx = clone(player.cx);
	delete cx.tail;
	render_cosmetic("back", { top: -2, j: 3, scale: 1.5, mleft: 8, cx: cx });
	//var cx=clone(player.cx); delete cx.back;
	//render_cosmetic("tail",{top:-20,j:3,scale:2,mleft:8,cx:cx});
	html += "</div>";
	html += "</div>";
	html += "<div style='display: inline-block; vertical-align: top'>";
	html += "<div style='margin-top: -5px'>";
	render_cosmetic("skin", { text: phrase("interface.cosmetics.looks"), cx: player.cx, size: "big", mleft: 8 });
	html += "</div>";
	html += "<div>";
	render_cosmetic("gravestone", { text: phrase("interface.cosmetics.rip"), top: -16, scale: 1.75, mleft: 8, cx: cx, rip: true, bg: "#8cb0bb" });
	render_emotes();
	html += "</div>";
	html += "</div>";
	html += "</div>";
	dialogs_target = xtarget || ctarget;
	render_ui_panel("#topleftcornerdialog", html);
}

function load_class_info(name, look) {
	var html = "";
	name = name || window.chartype || "warrior";
	if (!G.classes[name]) return;
	look = nunv(look, nunv(window.thelooks, 0));
	if (!G.classes[name].looks[look]) look = 0;

	//html+="<div style='float: left; margin-right: 10px; margin-top: -10px; width: 52px; height: 72px; overflow: hidden'><img style='margin-top: -"+(72*4)+"px; margin-left: -"+(52*4)+"px; width: 624px; height: 576px;' src='/images/tiles/characters/chara7.png'/></div>";
	html +=
		"<div style='float: left; margin-right: 10px; margin-top: -10px; margin-bottom: -3px'>" +
		sprite(G.classes[name].looks[look][0], { cx: G.classes[name].looks[look][1], scale: 2, height: 72, width: 52 }) +
		"</div>";
	html +=
		"<div><span style='color: white'>" +
		phrase.html("interface.load_class_info.class") +
		"</span> <span style='color: " +
		colors.male +
		"'>" +
		phrase.definition("class", name, "name", name.toTitleCase()) +
		"</span></div>";
	html +=
		"<div><span style='color: white'>" +
		phrase.html("interface.load_class_info.primary_attribute") +
		"</span> <span style='color: " +
		colors[G.classes[name].main_stat] +
		"'>" +
		phrase.definition("stat", G.classes[name].main_stat, "name", G.classes[name].main_stat.toTitleCase()) +
		"</span></div>";
	if (G.classes[name].side_stat)
		html +=
			"<div><span style='color: white'>" +
			phrase.html("interface.load_class_info.secondary_attribute") +
			"</span> <span style='color: " +
			colors[G.classes[name].side_stat] +
			"'>" +
			phrase.definition("stat", G.classes[name].side_stat, "name", G.classes[name].side_stat.toTitleCase()) +
			"</span></div>";
	html +=
		"<div><span style='color: white'>" +
		phrase.html("interface.load_class_info.description") +
		"</span> <span style='color: gray'>" +
		phrase.definition("class", name, "description", G.classes[name].description) +
		"</span></div>";

	$("#features").removeClass("upcoming-features").css({ height: 208, maxWidth: 320, fontSize: 24, overflowY: "auto" }).html(html);
	// $(".salesui").css("bottom",208+36);
}

function to_pretty_fraction(num) {
	var html = phrase.html("interface.drop_chance.negligible");
	[
		[1000000000, "1B", "#B30000"],
		[100000000, "100M", "#825CD5"],
		[10000000, "10M", "#825CD5"],
		[1000000, "1M", "#825CD5"],
		[100000, "100K", "#5090D3"],
		[10000, "10K", "#5090D3"],
		[1000, "1K", "#5090D3"],
		[100, "100", "#909090"],
		[10, "10", "#909090"],
		[1, "1", "#64C287"],
	].forEach(function (l) {
		if (num * l[0] > 1) html = to_pretty_float(num * l[0]) + "<span style='color:" + l[2] + "'>/" + l[1] + "</span>";
	});
	return html;
}

function merrit_reason_text(reason) {
	var name = reason.name || phrase("interface.merrit.another_shop"),
		remaining = Math.max(1, Math.ceil((reason.remaining_ms || 0) / 60000));
	if (reason.code === "npc") return phrase.html("interface.merrit.reason_npc", { name: name });
	if (reason.code === "stand_close") return phrase.html("interface.merrit.reason_stand_close", { name: name });
	if (reason.code === "stand_front") return phrase.html("interface.merrit.reason_stand_front", { name: name });
	if (reason.code === "warming") return phrase.html("interface.merrit.reason_warming", { count: remaining });
	if (reason.code === "cooldown") return phrase.html("interface.merrit.reason_cooldown", { count: remaining });
	var reasons = {
		area: "interface.merrit.reason_area",
		closed: "interface.merrit.reason_closed",
		listing: "interface.merrit.reason_listing",
		inventory: "interface.merrit.reason_inventory",
		unreachable: "interface.merrit.reason_unreachable",
		unavailable: "interface.merrit.reason_unavailable",
	};
	return phrase.html(reasons[reason.code] || "interface.merrit.reason_waiting");
}
function merrit_status_html(status) {
	if (!status) return "<div>" + phrase.html("interface.merrit_status_html.waiting_for_merrit_s_visit_information") + "</div>";
	return (status.reasons || []).length
		? status.reasons
				.map(function (r) {
					return "<div>" + merrit_reason_text(r) + "</div>";
				})
				.join("")
		: "<div style='color:#89C79F'>" + phrase.html("interface.merrit_status_html.ready_for_a_parcel_keep_your_stand_open_merrit_must") + "</div>";
}
function merrit_receipt_html(receipt) {
	if (!receipt) return phrase.html("interface.merrit.no_receipt");
	var elapsed = Date.now() - new Date(receipt.at).getTime(),
		when = elapsed < 120000 ? "now" : elapsed < 3600000 ? "recent" : elapsed < 86400000 ? "today" : elapsed < 604800000 ? "days" : "old",
		recipient = character && receipt.name === character.name ? "self" : "named";
	return (
		phrase.html("interface.merrit.receipt." + recipient + "." + when, { name: receipt.name }) +
		(receipt.shells ? " " + phrase.html("interface.merrit.receipt_shell") : "") +
		"<br><br>" +
		phrase.html("interface.merrit_receipt_html.a_little_thank_you_for_keeping_a_shop_in_the")
	);
}

function render_merrit_interaction(view) {
	if (no_html) return;
	var npc = G.npcs.citizen22,
		status = character && character.merrit,
		receipt = status && (status.last || status.account_last),
		message;
	view = view || "greeting";
	if (view === "receipt") {
		message = merrit_receipt_html(receipt);
	} else {
		message = phrase.html("interface.merrit_interaction.keep_a_stocked_shop_here_for_two_minutes_and_leave_the_neighbors_room_i_bring_parcels_once_an_hour");
		if (receipt) message = phrase.html("interface.merrit.welcome." + (receipt.name === character.name ? "self" : "named") + (receipt.shells ? ".shell" : ".parcel"), { name: receipt.name });
	}
	render_interaction({
		auto: true,
		skin: npc.skin,
		cx: clone(npc.cx),
		cosmetic_head_y: npc.cosmetic_head_y,
		merrit: view,
		message: "<span id='merrit-dialogue'>" + message + "</span>",
		button: view === "receipt" ? phrase.html("interface.merrit_interaction.back") : phrase.html("interface.merrit_interaction.last_gift"),
		onclick: function () {
			render_merrit_interaction(view === "receipt" ? "greeting" : "receipt");
			request_merrit_status();
		},
	});
}

function request_merrit_status() {
	if (typeof socket !== "undefined" && socket && character) socket.emit("interaction", { type: "merrit_info" });
}

function merrit_status_received(data) {
	if (!character) return;
	character.merrit = Object.assign({}, character.merrit || {}, data);
	if (no_html) return;
	$(".merrit-status").html(merrit_status_html(character.merrit));
	// A delayed status reply must never reopen a conversation or cover INFO.
	if ($("#merrit-dialogue").length && rendered_interaction && rendered_interaction.merrit) render_merrit_interaction(rendered_interaction.merrit);
}

function request_merrit_info() {
	render_merrit_info();
}

function render_merrit_info() {
	if (no_html) return;
	open_guide("npc-merrit", get_guide_url("npc-merrit"));
}

function merrit_item_preview(name, quantity) {
	return (
		"<span style='display:inline-block;image-rendering:pixelated'>" +
		item_container(
			{
				skin: G.items[name].skin,
				draggable: false,
				onclick: "pcs(event);render_item_info('" + name + "')",
			},
			{ name: name, q: quantity || 1 },
		) +
		"</span>"
	);
}

function merrit_shell_odds_html() {
	var c = G.npcs.citizen22.market,
		html = "";
	for (var s = 0; s <= 10; s++) {
		var chance = c.shell_floor + (c.shell_zero - c.shell_floor) * Math.pow((10 - s) / 10, 2);
		html += "<tr><td>" + s + (s === 10 ? phrase.html("interface.merrit_shell_odds_html.or_more") : "") + "</td><td>" + (chance * 100).toFixed(5).replace(/0+$/, "").replace(/\.$/, "") + "%</td></tr>";
	}
	return html;
}
