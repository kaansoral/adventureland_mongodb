var merrit_stand_notice_reason = "";
var merrit_stand_notice_dismissed = false;

function dismiss_merrit_stand_notice() {
	if (no_graphics || no_html) return;
	merrit_stand_notice_dismissed = true;
	$("#merrit-stand-notice").remove();
}

function show_merrit_stand_notice(data) {
	if (no_graphics) return;
	if (no_html || !character || !data) return;
	if (data.stand_opened !== undefined) {
		merrit_stand_notice_reason = "";
		merrit_stand_notice_dismissed = false;
		$("#merrit-stand-notice").remove();
	}
	if (!proximity_guides || character.map !== "main" || data.stand_opened === false || (!character.stand && data.stand_opened !== true)) {
		merrit_stand_notice_reason = "";
		$("#merrit-stand-notice").remove();
		return;
	}
	if (merrit_stand_notice_dismissed) return;
	var reasons = data.reasons || [],
		reason =
			reasons.find(function (reason) {
				return reason.code === "area";
			}) ||
			reasons.find(function (reason) {
				return ["npc", "stand_close", "stand_front", "unreachable"].indexOf(reason.code) !== -1;
			});
	if (!reason) {
		merrit_stand_notice_reason = "";
		$("#merrit-stand-notice").remove();
		return;
	}
	var key = reason.code + ":" + (reason.name || "");
	if (key === merrit_stand_notice_reason) return;
	merrit_stand_notice_reason = key;
	var message = {
		area: phrase("services.merrit_stand_notice.set-up-on-mainland-s-square-or-southern-aisle"),
		npc: phrase("services.merrit_stand_notice.room-around-npc", { npc: reason.name || phrase("services.merrit_stand_notice.nearby-npc") }),
		stand_close: phrase("services.merrit_stand_notice.leave-a-little-more-space-between-shops"),
		stand_front: phrase("services.merrit_stand_notice.move-out-from-in-front-of-the-neighboring-stand"),
		unreachable: phrase("services.merrit_stand_notice.move-your-stand-onto-the-open-pavement"),
	}[reason.code];
	$("#merrit-stand-notice").remove();
	$("#bottommid").prepend(
		"<div id='merrit-stand-notice'><button type='button' class='gamebutton' onclick='btc(event); dismiss_merrit_stand_notice(); render_merrit_info()'>" +
			("<span class='merrit-notice-title'>" + phrase.html("services.merrit_stand_notice.merrit-won-t-stop-here") + "</span>") +
			"<span>" +
			html_escape(message) +
			("</span><span class='merrit-notice-link'>" + phrase.html("services.merrit_stand_notice.how-merrit-works") + "</span></button>") +
			("<button type='button' class='gamebutton merrit-notice-close' aria-label='" +
				phrase.html("services.merrit_stand_notice.label-dismiss-merrit-notice") +
				"' onclick='btc(event); dismiss_merrit_stand_notice()'>X</button></div>"),
	);
	// Leave space for CODE buttons or event controls already above the character bar.
	$("#merrit-stand-notice").css("margin-bottom", 8 + Math.max($(".codebbuttons").outerHeight() || 0, $(".badplaceforaui").outerHeight() || 0));
	$("#merrit-stand-notice").on("pointerdown mousedown touchstart mousemove", function (event) {
		event.stopPropagation();
	});
}
