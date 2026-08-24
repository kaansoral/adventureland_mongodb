var stripe_state = "pay",
	pamount = 25,
	steam_state = "pay",
	steam_order_id = "";

function p_log(message, color, support) {
	if (inside != "payments") return;
	$("#plog").html("<span style='color: white'>&gt;</span> <span style='color: " + color + "'>" + message + "</span>");
}

function set_pamount(amount) {
	pamount = parseInt(amount);
	if (typeof is_tauri != "undefined" && is_tauri) {
		steam_state = "pay";
		steam_order_id = "";
		$(".pbutton").removeClass("pfail psuccess");
		$(".pbutton").html("Buy $" + pamount + " with Steam");
		update_shells_calc();
		return;
	}
	if (stripe_state == "success") {
		setTimeout(function () {
			if (inside != "payments") hide_modal();
			stripe_state = "pay";
			$(".pbutton").removeClass("psuccess");
			$(".pbutton").html("Pay $" + pamount);
		}, 20);
		return;
	}
	if (stripe_state == "failed") (stripe_state = "pay"), $(".pbutton").removeClass("pfail");
	if (stripe_state == "declined") (stripe_state = "pay"), $(".pbutton").removeClass("pfail");
	if (stripe_state == "pay") $(".pbutton").html("Pay $" + pamount);
	update_shells_calc();
}

function update_shells_calc() {
	if (pamount < 25 && !extra_shells_pct) {
		$("#shells-calc").hide();
		return;
	}
	var base = pamount * 80;
	var bonus_mult = 0;
	if (pamount >= 500) bonus_mult = 0.24;
	else if (pamount >= 100) bonus_mult = 0.16;
	else if (pamount >= 25) bonus_mult = 0.08;
	var extra = Math.floor(base * bonus_mult);
	var subtotal = base + extra;
	var html = "<span style='color: gray;'>" + to_pretty_num(base) + " + " + to_pretty_num(extra) + " (extra)";
	if (extra_shells_pct) {
		var event_bonus = Math.floor((subtotal * extra_shells_pct) / 100.0);
		html += " + " + to_pretty_num(event_bonus) + " (bonus)";
		subtotal += event_bonus;
	}
	html += " = <span style='color:white'>" + to_pretty_num(subtotal) + "</span></span>";
	$("#shells-calc-line").html(html);
	$("#shells-calc").show();
}

function steam_payment_message(reason) {
	if (reason == "steam_purchase_cancelled") return "Purchase cancelled.";
	if (reason == "steam_auth_failed") return "Steam authentication failed. Please restart Adventure Land through Steam.";
	if (reason == "steam_account_required") return "Log in through Steam before purchasing Shells.";
	if (reason == "steam_not_configured") return "Steam purchases aren't available yet.";
	if (reason == "steam_payment_pending" || reason == "steam_purchase_timeout") return "Steam is still processing this purchase.";
	return "Steam couldn't complete the purchase.";
}

function steam_payment_failed(error) {
	var reason = (error && (error.reason || error.message)) || "steam_purchase_failed";
	if (reason == "steam_payment_pending" || reason == "steam_purchase_timeout") {
		steam_state = "pending";
		$(".pbutton").removeClass("pfail");
		$(".pbutton").html("Check Steam Payment");
	} else {
		steam_state = reason == "steam_purchase_cancelled" ? "declined" : "failed";
		$(".pbutton").addClass("pfail");
		$(".pbutton").html(reason == "steam_purchase_cancelled" ? "Cancelled." : "Failed.");
	}
	p_log(steam_payment_message(reason), "#88E5BC");
}

function steam_payment_success(data) {
	steam_state = "success";
	$(".pbutton").removeClass("pfail").addClass("psuccess");
	$(".pbutton").html("Success!");
	if (window.character) character.cash = data.cash;
	reset_inventory(1);
	p_log("You received " + to_pretty_num(data.shells) + " Shells!", "#88E5BC");
}

function steam_finish_payment(authorized) {
	steam_state = "finalizing";
	$(".pbutton").html("Finalizing ...");
	api_call("steam_payment_finish", { order_id: steam_order_id, authorized: !!authorized }).then(steam_payment_success).catch(steam_payment_failed);
}

function steam_pay() {
	if (!is_tauri) return;
	if (steam_state == "pending" && steam_order_id) {
		steam_finish_payment(true);
		return;
	}
	if (in_arr(steam_state, ["process", "authorize", "finalizing"])) {
		p_log("Currently processing your Steam payment.", "gray");
		return;
	}
	if (in_arr(steam_state, ["failed", "declined", "success"])) {
		set_pamount(pamount);
		return;
	}

	steam_state = "process";
	$("#plog").html("");
	$(".pbutton").html("Contacting Steam ...");
	tauri_prepare_auth()
		.then(function (auth) {
			if (!auth || !auth.ticket) throw new Error("steam_auth_failed");
			return api_call("steam_payment_start", { usd: pamount, ticket: auth.ticket, sandbox: !!window.steam_payment_sandbox });
		})
		.then(function (data) {
			steam_order_id = data.order_id;
			steam_state = "authorize";
			$(".pbutton").html("Approve in Steam ...");
			p_log((data.sandbox ? "Sandbox: " : "") + "Approve or cancel the purchase in Steam.", "gray");
			return tauri_wait_for_steam_purchase(steam_order_id);
		})
		.then(function (authorization) {
			steam_finish_payment(authorization.authorized);
		})
		.catch(steam_payment_failed);
}

function stripe_pay() {
	$("#plog").html("");
	if (!window.Stripe) {
		alert("Stripe hasn't loaded. Please refresh the page and email hello@adventure.land if this is persistent. Thank you.");
		return;
	}
	if (stripe_state == "process") {
		add_log("Currently processing your payment.");
		p_log("Currently processing your payment.");
		return;
	}
	if (stripe_state == "charge") {
		add_log("Currently charging your credit card.");
		return;
	}
	if (in_arr(stripe_state, ["failed", "declined", "success"])) return set_pamount(pamount);
	$(".pbutton").html("Processing ...");
	stripe_state = "process";
	Stripe.card.createToken(
		{
			name: $(".modal .stripe-name").val(),
			number: $(".modal .stripe-number").val(),
			cvc: $(".modal .stripe-cvc").val(),
			exp_month: $(".modal .stripe-month").val(),
			exp_year: $(".modal .stripe-year").val(),
		},
		stripe_response,
	);
}

function stripe_response(status, response) {
	if (status == 200) {
		$("#plog").html("");
		stripe_state = "charge";
		$(".pbutton").html("Charging ...");
		api_call("stripe_payment", { usd: pamount, response: response });
	} else {
		$("#plog").html("");
		stripe_state = "failed";
		$(".pbutton").html("Failed.");
		if (response.error && response.error.message) add_log(response.error.message, "gray"), p_log(response.error.message, "gray");
	}
	// if(Dev) show_json(response);
}

function stripe_result(result, cash) {
	if (result == "success") {
		$("#plog").html("");
		stripe_state = "success";
		$(".pbutton").addClass("psuccess");
		$(".pbutton").html("Success!");
		character.cash = cash;
		reset_inventory(1);
	} else if (result == "declined") {
		$("#plog").html("");
		stripe_state = "declined";
		$(".pbutton").addClass("pfail");
		$(".pbutton").html("Declined.");
		p_log("If you need help, feel free to email hello@adventure.land", "#88E5BC");
	} else {
		$("#plog").html("");
		stripe_state = "failed";
		$(".pbutton").addClass("pfail");
		$(".pbutton").html("Failed.");
		p_log("If you need help, feel free to email hello@adventure.land", "#88E5BC");
	}
}

function shells_click() {
	if (stripe_enabled) show_payments();
	else show_sroffers();
}

function show_payments() {
	show_modal($("#paymentshtml").html(), { wrap: false, opacity: 0.4 });
	return;
	var html = "";
	html += "<div style='position: fixed; top: 0px; bottom: 0px; left: 0px; right: 0px; z-index: 9999; background: rgba(0,0,0,0.5); text-align: center' class='paymentsui'>";

	html += $("#paymentshtml").html();

	html += "<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; top: 0px; right: 0px; color: #CFCFCF'>Back &gt;</div>";

	html += "</div>";
	$("body").append(html);
}

function show_ppayments() {
	var html = "";
	html += "<div style='position: fixed; top: 0px; bottom: 0px; left: 0px; right: 0px; z-index: 9999; background: rgba(0,0,0,0.5)' class='paymentsui'>";

	html += "<div style='position: fixed; top: " + round(($(window).height() - 520) / 2) + "px; left: " + round(($(window).width() - 750) / 2) + "px;'>";
	html += '<iframe src="https://api.paymentwall.com/api/ps/?key=07119679ef07a110740ecfc89da924e6&uid=[USER_ID]&widget=p10_1" width="750" height="520" frameborder="0" ';
	html += 'style="border: 5px solid gray; background: black"></iframe>';
	html += "</div>";

	html += "<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; top: 0px; right: 0px; color: #CFCFCF'>Back &gt;</div>";

	html += "</div>";
	$("body").append(html);
}

function show_poffers() {
	var html = "";
	html += "<div style='position: fixed; top: 0px; bottom: 0px; left: 0px; right: 0px; z-index: 9999; background: rgba(0,0,0,0.5)' class='paymentsui'>";

	html += "<div style='position: fixed; top: 50px; left: " + round(($(window).width() - 800) / 2) + "px;'>";
	html += '<iframe src="https://api.paymentwall.com/api/?key=07119679ef07a110740ecfc89da924e6&uid=[USER_ID]&widget=w6_1" width="800" height="' + ($(window).height() - 100) + '" frameborder="0" ';
	html += 'style="border: 5px solid gray; background: black"></iframe>';
	html += "</div>";

	html += "<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; top: 0px; right: 0px'>Back &gt;</div>";

	html += "</div>";
	$("body").append(html);
}

function show_sroffers() {
	var html = "";
	html += "<div style='position: fixed; top: 0px; bottom: 0px; left: 0px; right: 0px; z-index: 9999; background: rgba(0,0,0,0.5); overflow-y: scroll' class='paymentsui'>";

	html += "<div style='margin-top: 40px; margin-left: " + round(($(window).width() - 728) / 2) + "px; z-index: 9000'>";
	html += '<iframe src="https://wall.superrewards.com/super/offers?h=shmimyttqnb.811777903063&uid=' + user_id + '" frameborder="0" width="728" height="2400" scrolling="no"';
	html += 'style="border: 5px solid gray; background: #FAFAFA"></iframe>';
	html += "</div>";

	html += "<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; bottom: 0px; right: 0px'>BACK &gt;</div>";

	html += "</div>";
	$("body").append(html);
}
