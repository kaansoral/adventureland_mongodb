var merrit_stand_notice_reason = "",
	merrit_stand_notice_timer = null;

function show_merrit_stand_notice(data) {
	if (no_graphics) return;
	if (no_html || !character || !data) return;
	if (data.stand_opened !== undefined) {
		merrit_stand_notice_reason = "";
		clearTimeout(merrit_stand_notice_timer);
		$("#merrit-stand-notice").remove();
	}
	if (data.stand_opened === false || (!character.stand && data.stand_opened !== true)) return;
	var reasons = data.reasons || [],
		reason =
			reasons.find(function (reason) {
				return reason.code === "area";
			}) ||
			reasons.find(function (reason) {
				return ["npc", "stand_close", "stand_front", "unreachable"].indexOf(reason.code) !== -1;
			});
	if (!reason) {
		$("#merrit-stand-notice").remove();
		return;
	}
	var key = reason.code + ":" + (reason.name || "");
	if (key === merrit_stand_notice_reason) return;
	merrit_stand_notice_reason = key;
	var message = {
		area: "Set up on Mainland's square or southern aisle.",
		npc: "Leave more room around " + (reason.name || "the nearby NPC") + ".",
		stand_close: "Leave a little more space between shops.",
		stand_front: "Move out from in front of the neighboring stand.",
		unreachable: "Move your stand onto the open pavement.",
	}[reason.code];
	$("#merrit-stand-notice").remove();
	$("#bottommid").prepend(
		"<div id='merrit-stand-notice'><button type='button' class='gamebutton' onclick='btc(event); render_merrit_info(); $(\"#merrit-stand-notice\").remove()'>" +
			"<span class='merrit-notice-title'>Merrit won't stop here</span>" +
			"<span>" +
			html_escape(message) +
			"</span><span class='merrit-notice-link'>How Merrit works</span></button></div>",
	);
	// Leave space for CODE buttons or event controls already above the character bar.
	$("#merrit-stand-notice").css("margin-bottom", 8 + Math.max($(".codebbuttons").outerHeight() || 0, $(".badplaceforaui").outerHeight() || 0));
	$("#merrit-stand-notice").on("pointerdown mousedown touchstart mousemove", function (event) {
		event.stopPropagation();
	});
	clearTimeout(merrit_stand_notice_timer);
	merrit_stand_notice_timer = setTimeout(function () {
		$("#merrit-stand-notice").remove();
	}, 12000);
}
