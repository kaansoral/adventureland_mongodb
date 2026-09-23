// Tavern Hold'em client: the interactive table on the Tavern floor and the centered overlay. The server owns every
// card and every decision; this file shows the state packets it sends and turns clicks into requests. Seat and hand
// state live outside the overlay, so closing it, walking to a stool or a late packet never loses the table.
// Everything here returns early without graphics or HTML.
var tavern_poker = { state: null, cards: null, cards_n: 0, shown: 0, timer: null, join: -1, walking: null, textures: {}, base: null, base_ready: false };
var tavern_poker_sheet = "/images/cards/poker.png?v=1",
	tavern_poker_card_w = 32,
	tavern_poker_card_h = 44,
	tavern_poker_positions = { 0: "front-l", 1: "front-c", 2: "front-r", 3: "side-l", 4: "side-r" },
	tavern_poker_floor = [
		[-40, -26],
		[-8, -26],
		[24, -26],
		[-40, -41],
		[25, -41],
	],
	tavern_poker_burst = "/images/sprites/animations/poker_win.png?v=1";

function poker_definition() {
	return G.games && G.games.poker;
}

function poker_state() {
	return tavern_poker.state;
}

function poker_me() {
	var state = poker_state();
	if (!state || !character) return null;
	for (var i = 0; i < state.seats.length; i++) if (state.seats[i] && state.seats[i].name == character.name) return state.seats[i];
	return null;
}

// Where a card sits on the deck sheet: rank by column, suit by row, the back at the start of the fifth row.
function poker_card_xy(card) {
	var def = poker_definition();
	if (!card || !def) return [0, 4];
	var parts = card.split("_"),
		column = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].indexOf(parts[0]),
		row = def.suits.indexOf(parts[1]);
	if (column < 0 || row < 0) return [0, 4];
	return [column, row];
}

function poker_card_html(card, big) {
	var xy = poker_card_xy(card),
		scale = big ? 2 : 1;
	return (
		"<span class='pk-card" +
		(big ? " pk-big" : "") +
		(card ? "" : " pk-back") +
		"' style='--pk-card-x:" + -xy[0] * tavern_poker_card_w + "px;--pk-card-y:" + -xy[1] * tavern_poker_card_h + "px;background-position: " +
		-xy[0] * tavern_poker_card_w * scale +
		"px " +
		-xy[1] * tavern_poker_card_h * scale +
		"px'></span>"
	);
}

function poker_pretty(gold) {
	return to_pretty_num(gold);
}

function poker_hand_name(key) {
	return key ? phrase.html("interface.poker.hand." + key) : "";
}

function poker_open() {
	if (no_graphics || no_html || typeof $ != "function") return false;
	return $(".pk").length > 0;
}

// The overlay, centered by the modal helper. Re-rendered in place on every packet while it is open.
function render_poker() {
	if (no_graphics || no_html || !poker_definition()) return;
	if (current_map != "tavern") return;
	if (!poker_open()) {
		if (!poker_me() && !poker_near_table()) return ui_log(phrase.html("response.poker_stool_far"), "gray");
		show_modal(poker_css() + poker_html(), { wrap: false, opacity: 0.55 });
		if (!tavern_poker.timer) tavern_poker.timer = setInterval(poker_clock, 250);
	}
	socket.emit("poker", { event: "info" });
}

function poker_refresh() {
	if (no_graphics || no_html || !poker_open()) return;
	var amount = $(".pk-amount").val(),
		buyin = $(".pk-buyin-gold").val(),
		focused = document.activeElement && document.activeElement.className,
		decision = $(".pk").attr("data-decision");
	$(".pk").replaceWith(poker_html());
	if (amount && decision && $(".pk").attr("data-decision") == decision) $(".pk-amount").val(amount);
	if (buyin && $(".pk-buyin-gold").length) $(".pk-buyin-gold").val(buyin);
	if (focused && $("." + focused).length) $("." + focused).focus();
	poker_clock();
}

function poker_closed() {
	if (tavern_poker.timer) clearInterval(tavern_poker.timer);
	tavern_poker.timer = null;
	tavern_poker.join = -1;
}

function poker_css() {
	return (
		"<style>" +
		".pk{position:relative;width:900px;height:760px;background:#14110F;border:5px solid gray;color:white;font-size:22px;line-height:24px;text-align:left;user-select:none}" +
		".pk-table{position:absolute;left:180px;top:70px;width:540px;height:290px;border-radius:160px/90px;background:#2F6B3C;box-shadow:inset 0 0 0 6px #9D5F3E,inset 0 0 0 9px #6D3D4B}" +
		".pk-ring{position:absolute;left:60px;top:40px;right:60px;bottom:40px;border-radius:120px/60px;border:2px solid #3C8049}" +
		".pk-pot{position:absolute;left:0;right:0;top:96px;text-align:center;color:#FFD888;font-size:26px}.pk-street{color:#9BE29B;font-size:18px}" +
		".pk-board{position:absolute;left:50%;top:146px;transform:translateX(-50%);display:flex;gap:6px;height:88px}" +
		".pk-card{display:inline-block;width:32px;height:44px;background-image:url(" +
		(window.url_factory ? url_factory(tavern_poker_sheet) : tavern_poker_sheet) +
		");background-size:416px 220px;image-rendering:pixelated;image-rendering:crisp-edges;margin-right:2px;vertical-align:top}" +
		".pk-card.pk-big{width:64px;height:88px;background-size:832px 440px;margin:0}.pk-board .pk-slot{width:64px;height:88px;border:2px dashed #3C8049;box-sizing:border-box}" +
		".pk-seat{position:absolute;width:190px;min-height:124px;background:black;border:4px solid gray;padding:6px 8px;text-align:center;box-sizing:border-box}" +
		".pk-active{border-color:#FFE737}.pk-folded{opacity:.5}.pk-winner{border-color:#FFD888;box-shadow:0 0 0 3px #7A5A10;animation:pk-glow .7s ease-in-out 4}.pk-empty{border-style:dashed}.pk-me{border-color:#6DB7B8}.pk-me.pk-active{border-color:#FFE737}" +
		".pk-front-l{left:112px;top:364px}.pk-front-c{left:355px;top:364px}.pk-front-r{left:598px;top:364px}.pk-side-l{left:8px;top:150px}.pk-side-r{left:702px;top:150px}" +
		".pk-name{color:#E6B16B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pk-dealer{display:inline-block;background:#FFE737;color:black;padding:0 6px;font-size:18px;margin-left:4px}.pk-stack{color:#FFD888}" +
		".pk-hand{height:48px;margin:4px 0}.pk-hand.pk-mine{height:92px}" +
		".pk-bet{position:absolute;left:50%;top:-36px;transform:translateX(-50%);background:#24552F;border:3px solid #9D5F3E;padding:0 8px;color:#FFE737;white-space:nowrap;font-size:20px}" +
		".pk-side-l .pk-bet{left:auto;right:-124px;top:24px;transform:none}.pk-side-r .pk-bet{left:-124px;top:24px;transform:none}" +
		".pk-status{color:#9BE29B;font-size:18px;min-height:20px}.pk-status.gray{color:gray}.pk-timer{height:6px;background:#333;margin-top:4px}.pk-timer i{display:block;height:6px;background:#FFE737}.pk-timer.pk-bank i{background:#FF7500}" +
		".pk-actions{position:absolute;left:140px;right:140px;bottom:8px;text-align:center}.pk-actions .gamebutton{margin:0 4px;min-width:118px;display:inline-block;vertical-align:top}.pk-actions.gray{padding-top:36px}" +
		".pk-raise{display:inline-block;vertical-align:top;border:4px solid gray;background:black;padding:6px 10px;margin-top:8px}.pk-raise .gamebutton{min-width:64px;padding:6px;font-size:20px;margin:0 2px}" +
		".pk-raise input{width:150px;background:#111;border:3px solid gray;color:#FFD888;font-size:20px;padding:4px 6px;font-family:inherit;text-align:right;vertical-align:top;margin:0 4px}" +
		".pk-log{position:absolute;left:12px;top:10px;color:gray;font-size:18px;line-height:20px;text-align:left;width:230px;max-height:122px;overflow:hidden}.pk-info{position:absolute;right:12px;top:10px;color:gray;font-size:18px;text-align:right}" +
		".pk-tools{position:absolute;right:8px;bottom:14px;z-index:2;text-align:right}.pk-tools .gamebutton{font-size:18px;padding:6px 10px;display:block;margin-top:6px}" +
		".pk-join{margin-top:8px;font-size:18px;padding:6px}.pk-buyin input{width:130px;background:#111;border:3px solid gray;color:#FFD888;font-size:18px;padding:3px 6px;font-family:inherit;text-align:right;margin:6px 0}" +
		".pk-hint{color:gray;font-size:16px;line-height:18px}.pk-title{position:absolute;left:0;right:0;top:34px;text-align:center;color:#E6B16B;font-size:24px}" +
		".pk-walk{color:#9BE29B;margin-top:14px;cursor:pointer}.pk-rebuy{display:inline-block;margin-left:6px;padding:0 7px;border:2px solid #FFD888;color:#FFD888;font-size:18px;line-height:20px;cursor:pointer;vertical-align:top}.pk-head{display:flex;align-items:center;justify-content:center;gap:4px}.pk-face{width:40px;height:44px;overflow:hidden;flex:none;margin-top:-4px}.pk-who{min-width:0}" +
		".pk-row{white-space:nowrap}.pk-presets{margin-top:6px;white-space:normal}.pk-presets .gamebutton{min-width:0;padding:3px 6px;font-size:16px;margin:2px 1px;border-width:3px}.pk-presets .gamebutton.pk-on{border-color:#FFE737;color:#FFE737}" +
		"@keyframes pk-glow{0%,100%{box-shadow:0 0 0 3px #7A5A10}50%{box-shadow:0 0 0 6px #FFD888,0 0 26px #FFE737}}" +
		".pk-fly{position:absolute;z-index:3;transform:translate(-50%,-50%);color:#FFE737;font-size:24px;background:#24552F;border:3px solid #9D5F3E;padding:0 8px;white-space:nowrap;pointer-events:none}" +
		".pk-burst{position:absolute;z-index:4;width:72px;height:72px;margin:-44px 0 0 -36px;background-repeat:no-repeat;background-size:576px 72px;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none}" +
		"@media(max-width:959px){.pk{width:min(900px,calc(100vw - 40px));height:auto;box-sizing:border-box;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px;font-size:20px}.pk-title,.pk-info,.pk-table,.pk-seat,.pk-actions,.pk-tools,.pk-log{position:relative;inset:auto;width:auto;max-height:none}.pk-title{order:0;grid-column:1/-1;grid-row:1;line-height:28px}.pk-info{order:1;grid-column:1/-1;grid-row:2;text-align:center;font-size:16px}.pk-table{order:2;grid-column:1/-1;grid-row:3;height:160px;border-radius:70px}.pk-pot{top:28px;font-size:20px}.pk-board{top:76px;height:44px}.pk-board .pk-slot{width:32px;height:44px}.pk-board .pk-big{width:32px;height:44px;background-size:416px 220px;background-position:var(--pk-card-x) var(--pk-card-y)!important}.pk-seat{min-width:0;min-height:0;padding:6px 2px}.pk-bet,.pk-side-l .pk-bet,.pk-side-r .pk-bet{position:static;transform:none;padding:0;border-width:1px;font-size:16px;white-space:normal}.pk-head{flex-wrap:wrap}.pk-name{font-size:18px}.pk-stack{font-size:18px}.pk-me{order:3;grid-column:1/-1}.pk-seat:not(.pk-me){order:6}.pk-hand.pk-mine{height:92px}.pk-actions{order:4;grid-column:1/-1;grid-row:5}.pk-actions .gamebutton{min-width:0;margin:3px;padding:7px;font-size:20px}.pk-actions.gray{padding:8px 0}.pk-raise{display:block;padding:6px 2px;box-sizing:border-box}.pk-row{white-space:normal}.pk-raise input{width:116px;margin:4px 2px}.pk-raise .pk-go{margin-top:4px}.pk-tools{order:5;grid-column:1/-1;text-align:center;display:flex;flex-wrap:wrap;justify-content:center;gap:6px}.pk-tools .gamebutton{display:inline-block;margin:0}.pk-log{order:7;grid-column:1/-1;max-height:120px;font-size:16px}.pk-buyin input{width:110px}.pk-ring{inset:20px}.pk-presets .gamebutton{font-size:16px;padding:5px}}" +
		"</style>"
	);
}

function poker_log_html(entry) {
	var p = { name: entry.name, amount: poker_pretty(entry.g || 0), n: entry.n };
	if (entry.t == "act") {
		if (entry.a == "fold") return phrase.html("interface.poker.log.fold", p);
		if (entry.a == "check") return phrase.html("interface.poker.log.check", p);
		if (entry.a == "call") return phrase.html("interface.poker.log.call", p);
		if (entry.a == "raise") return phrase.html("interface.poker.log.raise", p);
		if (entry.a == "allin") return phrase.html("interface.poker.log.allin", p);
		return phrase.html("interface.poker.log.bet", p);
	}
	if (entry.t == "win") return entry.h ? phrase.html("interface.poker.log.win_with", Object.assign({ hand: phrase("interface.poker.hand." + entry.h) }, p)) : phrase.html("interface.poker.log.win", p);
	if (entry.t == "deal") return phrase.html("interface.poker.log.deal", p);
	if (entry.t == "join") return phrase.html("interface.poker.log.join", p);
	if (entry.t == "leave") return phrase.html("interface.poker.log.leave", p);
	if (entry.t == "out") return phrase.html("interface.poker.log.out", p);
	if (entry.t == "in") return phrase.html("interface.poker.log.in", p);
	if (entry.t == "dc") return phrase.html("interface.poker.log.dc", p);
	if (entry.t == "back") return phrase.html("interface.poker.log.back", p);
	if (entry.t == "void") return phrase.html("interface.poker.log.void");
	return "";
}

function poker_seat_html(seat, index) {
	var state = poker_state(),
		hand = state.hand,
		me = poker_me(),
		live = hand && !hand.over,
		mine = seat && me && seat.index == me.index,
		classes = "pk-seat pk-" + tavern_poker_positions[index];
	if (!seat) {
		var html = "<div class='" + classes + " pk-empty'><div class='pk-name gray'>" + phrase.html("interface.poker.empty_seat") + "</div>";
		if (!me) {
			// You sit on the stool you stand next to; the other empty seats walk you over.
			if (poker_reach() != index) html += "<div class='pk-hint pk-walk clickable' onclick='poker_walk(" + index + ")'>" + phrase.html("interface.poker.walk_to_sit") + "</div>";
			else if (tavern_poker.join == index) {
				var suggested = Math.max(state.buyin[0], Math.min(state.buyin[1], character.gold || 0));
				html +=
					"<div class='pk-buyin'><input type='text' class='pk-buyin-gold' value='" +
					poker_pretty(suggested) +
					"' onkeydown='if(event.keyCode==13) poker_buy(" +
					index +
					")'><div class='pk-hint'>" +
					phrase.html("interface.poker.buyin_hint", { min: poker_pretty(state.buyin[0]), max: poker_pretty(state.buyin[1]) }) +
					"</div><div class='gamebutton clickable pk-join' onclick='poker_buy(" +
					index +
					")'>" +
					phrase.html("interface.poker.buy_in") +
					"</div></div>";
			} else html += "<div class='gamebutton clickable pk-join' onclick='poker_pick(" + index + ")'>" + phrase.html("interface.poker.join") + "</div>";
		}
		return html + "</div>";
	}
	var dealt = !!(hand && !hand.over && seat.cards),
		rebuy = "";
	// A short stack can reload between hands, up to the maximum buy-in; a healthy stack is left alone.
	if (mine && !dealt && seat.stack < state.buyin[0]) {
		if (tavern_poker.join == index) {
			var room = state.buyin[1] - seat.stack,
				fill = Math.max(1, Math.min(room, character.gold || 0));
			rebuy =
				"<div class='pk-buyin'><input type='text' class='pk-buyin-gold' value='" +
				poker_pretty(fill) +
				"' onkeydown='if(event.keyCode==13) poker_buy(" +
				index +
				")'><div class='pk-hint'>" +
				phrase.html("interface.poker.buyin_hint", { min: poker_pretty(Math.min(room, state.blinds[1])), max: poker_pretty(room) }) +
				"</div><div class='gamebutton clickable pk-join' onclick='poker_buy(" +
				index +
				")'>" +
				phrase.html("interface.poker.buy_in") +
				"</div></div>";
		}
	}
	var chip =
		mine && !dealt && seat.stack < state.buyin[0] && tavern_poker.join != index
			? "<span class='pk-rebuy clickable' title='" + phrase("interface.poker.buy_in") + "' onclick='poker_pick(" + index + ")'>+</span>"
			: "";
	if (live && hand.acting == seat.index) classes += " pk-active";
	if (live && seat.folded) classes += " pk-folded";
	if (hand && hand.over && hand.results && hand.results.winners[seat.index]) classes += " pk-winner";
	if (mine) classes += " pk-me";
	var cards = "";
	if (mine && tavern_poker.cards && hand && tavern_poker.cards_n == hand.n && seat.cards) cards = poker_card_html(tavern_poker.cards[0], true) + poker_card_html(tavern_poker.cards[1], true);
	else if (seat.shown) cards = poker_card_html(seat.shown[0]) + poker_card_html(seat.shown[1]);
	else if (seat.cards && (!hand || !hand.over || !seat.folded)) cards = poker_card_html(null) + poker_card_html(null);
	var status = "",
		gray = false;
	if (hand && hand.over && hand.results && hand.results.winners[seat.index]) {
		var hand_name = hand.results.hands[seat.index];
		status =
			"<span class='gold'>" +
			(hand_name
				? phrase.html("interface.poker.wins_with", { amount: poker_pretty(hand.results.winners[seat.index]), hand: phrase("interface.poker.hand." + hand_name) })
				: phrase.html("interface.poker.wins", { amount: poker_pretty(hand.results.winners[seat.index]) })) +
			"</span>";
	} else if (live && seat.folded) ((status = phrase.html("interface.poker.folded")), (gray = true));
	else if (live && seat.allin) status = phrase.html("interface.poker.all_in_status");
	else if (seat.dc) ((status = phrase.html("interface.poker.disconnected")), (gray = true));
	else if (seat.leaving) ((status = phrase.html("interface.poker.leaving")), (gray = true));
	else if (seat.out) ((status = phrase.html("interface.poker.sitting_out")), (gray = true));
	else if (live && hand.acting == seat.index) status = mine ? "<span class='pk-turn'>" + phrase.html("interface.poker.your_turn") + "</span>" : phrase.html("interface.poker.thinking");
	var timer = live && hand.acting == seat.index ? "<div class='pk-timer" + (hand.banked ? " pk-bank" : "") + "'><i style='width: 100%'></i></div>" : "";
	// The character's own sprite as a portrait, through the same renderer as the party list.
	var entity = !no_graphics && typeof get_entity == "function" ? get_entity(seat.name) : null,
		face = entity && entity.skin && typeof sprite == "function" ? "<div class='pk-face'>" + sprite(entity.skin, { cx: entity.cx || {}, scale: 1 }) + "</div>" : "";
	return (
		"<div class='" +
		classes +
		"'><div class='pk-head'>" +
		face +
		"<div class='pk-who'><div class='pk-name'>" +
		phrase.escape(seat.name) +
		(state.button === seat.index ? "<span class='pk-dealer'>D</span>" : "") +
		"</div><div class='pk-stack'>" +
		poker_pretty(seat.stack) +
		chip +
		"</div></div></div><div class='pk-hand" +
		(mine && cards.indexOf("pk-big") != -1 ? " pk-mine" : "") +
		"'>" +
		cards +
		"</div>" +
		(seat.bet ? "<div class='pk-bet'>" + poker_pretty(seat.bet) + "</div>" : "") +
		timer +
		"<div class='pk-status" +
		(gray ? " gray" : "") +
		"'>" +
		status +
		"</div>" +
		rebuy +
		"</div>"
	);
}

function poker_actions_html() {
	var state = poker_state(),
		hand = state.hand,
		me = poker_me();
	if (!me) return "<div class='pk-actions gray'>" + phrase.html("interface.poker.take_a_seat", { min: poker_pretty(state.buyin[0]), max: poker_pretty(state.buyin[1]) }) + "</div>";
	if (!hand || hand.over || hand.settling || hand.acting != me.index) {
		var text;
		if (hand && !hand.over && hand.acting >= 0 && state.seats[hand.acting]) text = phrase.html("interface.poker.waiting_for", { name: state.seats[hand.acting].name });
		else if (me.out) text = phrase.html("interface.poker.sitting_out_hint");
		else text = "<span class='pk-next'>" + phrase.html("interface.poker.next_hand") + "</span>";
		return "<div class='pk-actions gray'>" + text + "</div>";
	}
	var to_call = hand.bet - me.bet,
		max = me.bet + me.stack,
		min_raise = Math.min(max, hand.bet + hand.min_raise),
		html = "<div class='pk-actions'>";
	html += "<div><div class='gamebutton clickable pk-fold' style='border-color: #E05A4A' onclick='poker_action(\"fold\")'>" + phrase.html("interface.poker.fold") + "</div>";
	if (to_call > 0)
		html +=
			"<div class='gamebutton clickable pk-call' style='border-color: #A7C16D' onclick='poker_action(\"call\")'>" +
			phrase.html("interface.poker.call", { amount: poker_pretty(Math.min(to_call, me.stack)) }) +
			"</div>";
	else html += "<div class='gamebutton clickable pk-call' style='border-color: #A7C16D' onclick='poker_action(\"check\")'>" + phrase.html("interface.poker.check") + "</div>";
	if (me.can_raise !== false || max <= hand.bet) html += "<div class='gamebutton clickable pk-allin' style='border-color: #FFE737' onclick='poker_action(\"allin\")'>" + phrase.html("interface.poker.all_in") + "</div>";
	html += "</div>";
	if (max <= hand.bet || me.can_raise === false) return html + "</div>";
	// The raise box: type an amount or pick a preset, then RAISE sends it.
	html += "<div class='pk-raise'><div class='pk-row'><span class='gray'>" + phrase.html(hand.bet ? "interface.poker.raise_to" : "interface.poker.bet") + "</span> ";
	html += "<input type='text' class='pk-amount' value='" + poker_pretty(min_raise) + "' onkeydown='if(event.keyCode==13) poker_raise()'>";
	html += "<div class='gamebutton clickable pk-go' onclick='poker_raise()'>" + phrase.html("interface.poker.raise") + "</div></div>";
	html += "<div class='pk-presets'>";
	poker_presets(state, hand, me).forEach(function (preset) {
		html += "<div class='gamebutton clickable pk-preset pk-preset-" + preset.key + "' data-amount='" + preset.amount + "' onclick='poker_preset(this)'>" + preset.label + "</div>";
	});
	return html + "</div></div></div>";
}

// Raise presets in rising order: the smallest legal raise, big-blind multiples and pot fractions, each clamped to
// the stack, without duplicates and without anything the minimum already covers.
function poker_presets(state, hand, me) {
	var bb = state.blinds[1],
		to_call = hand.bet - me.bet,
		max = me.bet + me.stack,
		min_raise = Math.min(max, hand.bet + hand.min_raise),
		base = hand.pot + to_call,
		seen = {},
		list = [];
	function pot(fraction) {
		return hand.bet + Math.floor((fraction * base) / bb) * bb;
	}
	[
		["min", phrase.html("interface.poker.min"), min_raise],
		["bb2", phrase.html("interface.poker.bb_x", { x: "2" }), 2 * bb],
		["bb3", phrase.html("interface.poker.bb_x", { x: "3" }), 3 * bb],
		["half", phrase.html("interface.poker.half_pot"), pot(0.5)],
		["threeq", phrase.html("interface.poker.three_quarter_pot"), pot(0.75)],
		["pot", phrase.html("interface.poker.pot"), pot(1)],
		["pot15", phrase.html("interface.poker.pot_x", { x: "1.5" }), pot(1.5)],
		["pot2", phrase.html("interface.poker.pot_x", { x: "2" }), pot(2)],
	].forEach(function (preset) {
		var amount = Math.max(min_raise, Math.min(max, preset[2]));
		if (preset[0] != "min" && amount <= min_raise) return;
		if (seen[amount]) return;
		seen[amount] = true;
		list.push({ key: preset[0], label: preset[1], amount: amount });
	});
	return list;
}

function poker_preset(element) {
	$(".pk-preset").removeClass("pk-on");
	$(element).addClass("pk-on");
	$(".pk-amount").val(poker_pretty(parseInt(element.getAttribute("data-amount")) || 0));
}

function poker_html() {
	var state = poker_state();
	if (!state)
		return (
			"<div class='pk'><div class='pk-title'>" +
			phrase.html("interface.poker.title") +
			"</div><div class='pk-actions gray'>" +
			phrase.html("interface.poker.loading") +
			"</div></div>"
		);
	var hand = state.hand,
		me = poker_me(),
		board = "";
	for (var i = 0; i < 5; i++) board += hand && hand.board[i] ? poker_card_html(hand.board[i], true) : "<span class='pk-slot'></span>";
	var html = "<div class='pk' data-decision='" + (hand && !hand.over ? hand.n + ":" + hand.street + ":" + hand.acting : "") + "'>";
	html +=
		"<div class='pk-log'>" +
		state.log
			.slice()
			.reverse()
			.map(function (entry) {
				return "<div>" + poker_log_html(entry) + "</div>";
			})
			.join("") +
		"</div>";
	html += "<div class='pk-title'>" + phrase.html("interface.poker.title") + "</div>";
	html +=
		"<div class='pk-info'>" +
		phrase.html("interface.poker.blinds", { small: poker_pretty(state.blinds[0]), big: poker_pretty(state.blinds[1]) }) +
		"<br>" +
		phrase.html("interface.poker.buyin", { min: poker_pretty(state.buyin[0]), max: poker_pretty(state.buyin[1]) }) +
		"<br>" +
		phrase.html("interface.poker.rake", { rake: "" + state.rake, cap: poker_pretty(state.rake_cap) }) +
		"</div>";
	if (me) {
		html += "<div class='pk-tools'>";
		if (!me.leaving)
			html +=
				"<div class='gamebutton clickable pk-leave' onclick='poker_stand()'>" + phrase.html(hand && !hand.over && !me.folded ? "interface.poker.leave_after_hand" : "interface.poker.leave") + "</div>";
		if (!me.leaving)
			html +=
				"<div class='gamebutton clickable pk-sit' onclick='poker_sit(" + (me.out ? "false" : "true") + ")'>" + phrase.html(me.out ? "interface.poker.sit_in" : "interface.poker.sit_out") + "</div>";
		html += "</div>";
	}
	html +=
		"<div class='pk-table'><div class='pk-ring'></div><div class='pk-pot'>" +
		(hand && !(hand.results && hand.results.voided)
			? phrase.html("interface.poker.pot_label", { amount: poker_pretty(hand.pot) }) + " <span class='pk-street'>" + phrase.html("interface.poker.street." + hand.street) + "</span>"
			: phrase.html("interface.poker.waiting_players")) +
		"</div><div class='pk-board'>" +
		board +
		"</div></div>";
	for (var i = 0; i < state.seats.length; i++) html += poker_seat_html(state.seats[i], i);
	html += poker_actions_html();
	return html + "</div>";
}

// Clock: the timer bar of whoever is acting and the countdown to the next deal, without re-rendering the overlay.
function poker_clock() {
	if (!poker_open()) return poker_closed();
	var state = poker_state();
	if (!state) return;
	var hand = state.hand,
		now = Date.now() - (tavern_poker.skew || 0);
	if (hand && !hand.over && hand.acting >= 0) {
		var total = hand.banked ? state.bank_ms : state.action_ms,
			left = Math.max(0, hand.deadline - now),
			me = poker_me();
		$(".pk-timer i").css("width", Math.max(0, Math.min(100, (left / total) * 100)) + "%");
		if (me && hand.acting == me.index) {
			var seconds = Math.ceil(left / 1000);
			$(".pk-turn").html(phrase.html("interface.poker.your_turn_seconds", { seconds: "" + seconds }));
			if (seconds <= 5 && seconds != tavern_poker.ticked) ((tavern_poker.ticked = seconds), wheel_sound("tick"));
		}
	}
	if (!poker_me()) {
		var reach = poker_reach();
		if (reach != tavern_poker.reach) ((tavern_poker.reach = reach), poker_refresh());
	}
	var next = $(".pk-next");
	if (next.length && state.next_at) next.html(phrase.html("interface.poker.next_hand_seconds", { seconds: "" + Math.max(0, Math.ceil((state.next_at - now) / 1000)) }));
}

// The free stool the character stands next to, within the definition's reach, or -1.
function poker_reach() {
	var state = poker_state(),
		def = poker_definition();
	if (!state || !def || !character) return -1;
	var best = -1,
		best_d = def.reach * def.reach + 1;
	for (var i = 0; i < def.stools.length; i++) {
		if (state.seats[i]) continue;
		var dx = character.real_x - (state.x + def.stools[i][0]),
			dy = character.real_y - (state.y + def.stools[i][1]),
			d = dx * dx + dy * dy;
		if (d < best_d) ((best = i), (best_d = d));
	}
	return best;
}

// Any stool within reach, taken or free: close enough to watch the table.
function poker_near_table() {
	var def = poker_definition(),
		anchor = tavern_poker_map.sprite && !tavern_poker_map.sprite._destroyed ? tavern_poker_map.sprite : poker_state();
	if (!def || !anchor || !character) return true;
	for (var i = 0; i < def.stools.length; i++) {
		var dx = character.real_x - (anchor.x + def.stools[i][0]),
			dy = character.real_y - (anchor.y + def.stools[i][1]);
		if (dx * dx + dy * dy <= def.reach * def.reach) return true;
	}
	return false;
}

// A won pot: floating gold and coin bursts over the winner on the floor, the pot sliding to the seat and bursting
// on the overlay, confetti for big pots and the chime for your own win.
function poker_win_fx(data) {
	var hand = data.hand,
		me = poker_me(),
		bb = data.blinds[1],
		mine = false;
	for (var index in hand.results.winners) {
		var seat = data.seats[index],
			gold = hand.results.winners[index];
		if (!seat || !gold) continue;
		var entity = get_entity(seat.name);
		if (entity) {
			d_text("+" + poker_pretty(gold), entity, { color: "gold" });
			poker_floor_burst(entity, gold >= bb * 30 ? 6 : 3);
			if (gold >= bb * 100) confetti_shower(entity, 2);
			else if (gold >= bb * 30) confetti_shower(entity, 1);
		}
		if (me && me.index == parseInt(index)) mine = true;
		if (poker_open()) poker_overlay_win(parseInt(index), gold);
	}
	if (mine) sfx("poker_win");
	else if (poker_open()) wheel_sound("coins");
}

function poker_floor_burst(entity, count) {
	if (no_graphics || typeof new_sprite != "function" || typeof map == "undefined" || !G.animations || !G.animations.poker_win) return;
	var a_map = current_map;
	for (var i = 0; i < count; i++)
		draw_timeout(function () {
			if (no_graphics) return;
			if (entity.real_x === undefined) entity = get_entity(entity);
			if (!entity || a_map != current_map) return;
			var burst = new_sprite("poker_win", "animation"),
				x = entity.real_x + (Math.random() * 40 - 20),
				y = entity.real_y - 6 - Math.random() * 24;
			if (use_layers) burst.parentGroup = player_layer;
			else burst.displayGroup = player_layer;
			burst.x = round(x);
			burst.y = round(y);
			burst.real_x = x;
			burst.real_y = y + 1;
			burst.anchor.set(0.5, 1);
			map.addChild(burst);
			(function step(frame) {
				if (no_graphics) return;
				if (frame >= 8 || a_map != current_map) return destroy_sprite(burst);
				burst.frame = frame;
				set_texture(burst, frame);
				draw_timeout(function () {
					step(frame + 1);
				}, 60);
			})(0);
		}, i * 110);
}

// The overlay animation is driven by frames rather than CSS transitions, so a re-render mid-way just re-attaches it.
function poker_overlay_win(index, gold) {
	if (no_graphics || no_html) return;
	var target = ".pk-seat.pk-" + tavern_poker_positions[index],
		start = performance.now(),
		fly = $("<div class='pk-fly'>" + poker_pretty(gold) + "</div>"),
		burst = null;
	function cleanup() {
		fly.remove();
		if (burst) burst.remove();
	}
	function frame(now) {
		var pk = $(".pk"),
			seat = pk.find(target);
		if (!pk.length || !seat.length) return cleanup();
		var t = (now - start) / 550,
			sx = seat[0].offsetLeft + seat[0].offsetWidth / 2,
			sy = seat[0].offsetTop + 30;
		if (t < 1) {
			var eased = t * t,
				felt = pk.find(".pk-table")[0],
				pot = pk.find(".pk-pot")[0],
				from_x = felt.offsetLeft + felt.offsetWidth / 2,
				from_y = felt.offsetTop + pot.offsetTop;
			if (!fly[0].parentNode) pk.append(fly);
			fly.css({ left: from_x + (sx - from_x) * eased, top: from_y + (sy - from_y) * eased });
			return requestAnimationFrame(frame);
		}
		fly.remove();
		var step = Math.floor((now - start - 550) / 80);
		if (step >= 8) return cleanup();
		if (!burst) burst = $("<div class='pk-burst'></div>").css({ left: sx, top: sy, backgroundImage: "url(" + (window.url_factory ? url_factory(tavern_poker_burst) : tavern_poker_burst) + ")" });
		if (!burst[0].parentNode) pk.append(burst);
		burst.css("background-position", -step * 72 + "px 0");
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

// Requests.
function poker_pick(index) {
	if (!poker_me() && poker_reach() != index) return poker_walk(index);
	tavern_poker.join = index;
	poker_refresh();
	setTimeout(function () {
		$(".pk-buyin-gold").focus().select();
	}, 50);
}

function poker_buy(index) {
	var gold = parseInt(("" + $(".pk-buyin-gold").val()).replace(/[^0-9]/g, "")) || 0;
	socket.emit("poker", { event: "join", seat: index, gold: gold });
}

function poker_action(action, amount) {
	socket.emit("poker", { event: "act", action: action, amount: amount });
}

function poker_raise() {
	var amount = parseInt(("" + $(".pk-amount").val()).replace(/[^0-9]/g, "")) || 0;
	poker_action("raise", amount);
}

function poker_stand() {
	socket.emit("poker", { event: "leave" });
}

function poker_sit(out) {
	socket.emit("poker", { event: out ? "sit_out" : "sit_in" });
}

// Replies to our own requests. A seat taken starts the walk to its stool.
function poker_response(data) {
	if (data.failed) {
		var id = "response." + data.response,
			params = { min: poker_pretty(data.min || 0), max: poker_pretty(data.max || 0) };
		if (phrase.has(id)) ui_log(phrase.html(id, params), "gray");
		return;
	}
	if (data.seat !== undefined && data.buyin && !no_graphics) {
		tavern_poker.join = -1;
		var state = poker_state(),
			def = poker_definition();
		if (state && def && character) {
			var stool = def.stools[data.seat],
				dx = character.real_x - (state.x + stool[0]),
				dy = character.real_y - (state.y + stool[1]);
			if (dx * dx + dy * dy > 24 * 24) poker_walk(data.seat);
			else poker_refresh();
		}
	}
}

// Packets for the whole room: the public state and our own hole cards.
function poker_event(data) {
	if (!data) return;
	if (data.event == "cards") {
		tavern_poker.cards = data.cards;
		tavern_poker.cards_n = data.n;
		if (typeof call_code_function == "function") call_code_function("trigger_event", "poker", data);
		if (!no_graphics) poker_refresh();
		return;
	}
	if (data.event != "state") return;
	var previous = tavern_poker.state;
	tavern_poker.state = data;
	tavern_poker.skew = Date.now() - data.now;
	data.next_at = data.now + data.next;
	if (typeof call_code_function == "function") call_code_function("trigger_event", "poker", data);
	if (no_graphics) return;
	var hand = data.hand,
		me = poker_me(),
		seated = !!me;
	if (seated != !!tavern_poker.seated && typeof reflect_music == "function") ((tavern_poker.seated = seated), reflect_music());
	if (hand && (!previous || !previous.hand || previous.hand.n != hand.n || previous.hand.street != hand.street) && !hand.over) wheel_sound("drop");
	if (hand && !hand.over && me && hand.acting == me.index && (!previous || !previous.hand || previous.hand.acting != me.index || previous.hand.n != hand.n)) wheel_sound("open");
	if (hand && hand.over && hand.results && tavern_poker.shown != hand.n) {
		tavern_poker.shown = hand.n;
		poker_win_fx(data);
	}
	poker_map_show();
	poker_refresh();
}

// Walk to the stool through the game's own movement, around the table top, then reopen the overlay on arrival.
function poker_blocked() {
	var state = poker_state(),
		block = poker_definition().block;
	// The engine walks the character's base (a few pixels wide) against the lines, so the route keeps ten pixels
	// clear of the obstacle; every stool spot still lies outside this rectangle.
	return { x1: state.x + block[0] - 10, y1: state.y + block[1] - 10, x2: state.x + block[2] + 10, y2: state.y + block[3] + 10 };
}

// Whether the segment from a to b passes through the rectangle (Liang-Barsky clipping).
function poker_crosses(ax, ay, bx, by, r) {
	var dx = bx - ax,
		dy = by - ay,
		t0 = 0,
		t1 = 1,
		p = [-dx, dx, -dy, dy],
		q = [ax - r.x1, r.x2 - ax, ay - r.y1, r.y2 - ay];
	for (var i = 0; i < 4; i++) {
		if (p[i] == 0) {
			if (q[i] < 0) return false;
			continue;
		}
		var t = q[i] / p[i];
		if (p[i] < 0) {
			if (t > t1) return false;
			if (t > t0) t0 = t;
		} else {
			if (t < t0) return false;
			if (t < t1) t1 = t;
		}
	}
	return t0 <= t1;
}

function poker_route(sx, sy, tx, ty) {
	var r = poker_blocked(),
		corners = [
			[r.x1 - 1, r.y1 - 1],
			[r.x2 + 1, r.y1 - 1],
			[r.x2 + 1, r.y2 + 1],
			[r.x1 - 1, r.y2 + 1],
		];
	function clear(a, b) {
		return !poker_crosses(a[0], a[1], b[0], b[1], r);
	}
	if (clear([sx, sy], [tx, ty])) return [[tx, ty]];
	for (var i = 0; i < 4; i++) if (clear([sx, sy], corners[i]) && clear(corners[i], [tx, ty])) return [corners[i], [tx, ty]];
	for (var i = 0; i < 4; i++)
		for (var k = 1; k < 4; k += 2) {
			var c1 = corners[i],
				c2 = corners[(i + k) % 4];
			if (clear([sx, sy], c1) && clear(c2, [tx, ty])) return [c1, c2, [tx, ty]];
		}
	return [[tx, ty]];
}

function poker_walk_to(x, y) {
	var move = calculate_move(character, x, y);
	character.from_x = character.real_x;
	character.from_y = character.real_y;
	character.going_x = move.x;
	character.going_y = move.y;
	character.moving = true;
	calculate_vxy(character);
	socket.emit("move", { x: character.real_x, y: character.real_y, going_x: character.going_x, going_y: character.going_y, m: character.m });
}

function poker_walk(index) {
	var state = poker_state(),
		def = poker_definition();
	if (!state || !def || !character || !can_walk(character)) return;
	var stool = def.stools[index],
		legs = poker_route(character.real_x, character.real_y, state.x + stool[0], state.y + stool[1]),
		started = Date.now();
	try {
		hide_modal();
	} catch (e) {}
	poker_walk_to(legs[0][0], legs[0][1]);
	legs.shift();
	if (tavern_poker.walking) clearInterval(tavern_poker.walking);
	tavern_poker.walking = setInterval(function () {
		var late = Date.now() - started > 12000;
		if (character.moving && !late) return;
		if (legs.length && !late && can_walk(character)) {
			var leg = legs.shift();
			poker_walk_to(leg[0], leg[1]);
			return;
		}
		clearInterval(tavern_poker.walking);
		tavern_poker.walking = null;
		if (current_map == "tavern") render_poker();
	}, 150);
}

// The table on the Tavern floor: tiny cards on the felt for everyone in view, the dealer button and a blink for the
// seat whose turn it is. Textures come from the deck sheet once it has loaded.
var tavern_poker_map = { sprite: null, board: null, seats: null, button: null };

function poker_texture(card) {
	if (no_graphics) return null;
	var key = card || "back";
	if (tavern_poker.textures[key]) return tavern_poker.textures[key];
	if (!tavern_poker.base) {
		tavern_poker.base = PIXI.BaseTexture.fromImage(window.url_factory ? url_factory(tavern_poker_sheet) : tavern_poker_sheet, undefined, PIXI.SCALE_MODES.NEAREST);
		tavern_poker.base.on("loaded", function () {
			tavern_poker.base_ready = true;
			poker_map_show();
		});
		if (tavern_poker.base.hasLoaded) tavern_poker.base_ready = true;
	}
	if (!tavern_poker.base_ready) return null;
	var xy = poker_card_xy(card),
		texture = new PIXI.Texture(tavern_poker.base, new PIXI.Rectangle(xy[0] * tavern_poker_card_w, xy[1] * tavern_poker_card_h, tavern_poker_card_w, tavern_poker_card_h));
	tavern_poker.textures[key] = texture;
	return texture;
}

function poker_map_attach(sprite) {
	if (no_graphics || typeof PIXI == "undefined" || !poker_definition()) return;
	var seats = [],
		board = [];
	for (var i = 0; i < 5; i++) {
		var pair = [];
		for (var k = 0; k < 2; k++) {
			var card = new PIXI.Sprite(PIXI.Texture.EMPTY);
			card.scale.set(0.25, 0.25);
			card.x = tavern_poker_floor[i][0] + k * 9;
			card.y = tavern_poker_floor[i][1];
			card.visible = false;
			sprite.addChild(card);
			pair.push(card);
		}
		seats.push(pair);
		var community = new PIXI.Sprite(PIXI.Texture.EMPTY);
		community.scale.set(0.25, 0.25);
		community.x = -22 + i * 9;
		community.y = -36;
		community.visible = false;
		sprite.addChild(community);
		board.push(community);
	}
	var button = new PIXI.Graphics();
	button.beginFill(0x6d3d4b);
	button.drawRect(0, 0, 5, 5);
	button.endFill();
	button.beginFill(0xffe737);
	button.drawRect(1, 1, 3, 3);
	button.endFill();
	button.visible = false;
	sprite.addChild(button);
	sprite
		.on("mouseover", function () {
			sprite.tint = 0xffe9b0;
		})
		.on("mouseout", function () {
			sprite.tint = 0xffffff;
		});
	tavern_poker_map = { sprite: sprite, board: board, seats: seats, button: button };
	poker_texture(null);
	poker_map_show();
	if (typeof socket != "undefined" && socket) socket.emit("poker", { event: "info" });
}

function poker_map_show() {
	var m = tavern_poker_map,
		state = poker_state();
	if (no_graphics || !m.sprite || m.sprite._destroyed) return;
	var hand = state && state.hand;
	for (var i = 0; i < 5; i++) {
		var seat = state && state.seats[i],
			pair = m.seats[i],
			show = !!(seat && hand && seat.cards && !(hand.over && seat.folded));
		for (var k = 0; k < 2; k++) {
			var texture = show ? poker_texture(seat.shown ? seat.shown[k] : null) : null;
			pair[k].visible = !!texture;
			if (texture) pair[k].texture = texture;
			pair[k].alpha = seat && seat.folded ? 0.45 : 1;
		}
		var community = m.board[i],
			card = hand && hand.board[i],
			ctexture = card ? poker_texture(card) : null;
		community.visible = !!ctexture;
		if (ctexture) community.texture = ctexture;
	}
	var button_seat = state && state.button >= 0 && state.seats[state.button];
	m.button.visible = !!button_seat;
	if (button_seat) {
		m.button.x = tavern_poker_floor[state.button][0] - 7;
		m.button.y = tavern_poker_floor[state.button][1] + 3;
	}
}

function poker_map_update(sprite) {
	var m = tavern_poker_map,
		state = poker_state();
	if (no_graphics || !m.sprite || m.sprite != sprite || !state) return;
	var hand = state.hand,
		blink = hand && !hand.over && hand.acting >= 0 ? Math.floor(performance.now() / 350) % 2 == 0 : false;
	for (var i = 0; i < 5; i++) {
		var pair = m.seats[i],
			active = hand && !hand.over && hand.acting == i;
		for (var k = 0; k < 2; k++) pair[k].tint = active && blink ? 0xffe737 : 0xffffff;
	}
}
