var stripe_state = "pay",
	pamount = 25,
	steam_state = "pay",
	steam_order_id = "",
	steam_poll_count = 0;

function steam_debug(stage, details, level) {
	if (typeof tauri_debug == "function") tauri_debug("purchase." + stage, details, level);
	else console.log("[Tauri Debug] purchase." + stage, details || {});
}

function p_log(message, color, support) {
	var target = $(".modal:last #plog");
	if (!target.length) target = $("#plog");
	target.html("<span style='color: white'>&gt;</span> <span style='color: " + color + "'>" + message + "</span>");
}

function active_payment_ui(selector) {
	var target = $(".modal:visible:last").find(selector);
	if (!target.length) target = $(".modal:last").find(selector);
	if (!target.length) target = $(selector).last();
	return target;
}

function set_pamount(amount) {
	pamount = parseInt(amount);
	if (typeof is_tauri != "undefined" && is_tauri) {
		steam_state = "pay";
		steam_order_id = "";
		steam_poll_count = 0;
		steam_debug("amount.selected", { usd: pamount });
		$(".pbutton").removeClass("pfail psuccess");
		$(".pbutton").html(phrase.html("services.payments.buy-steam", { amount: pamount }));
		update_shells_calc();
		return;
	}
	if (stripe_state == "success") {
		setTimeout(function () {
			if (inside != "payments") hide_modal();
			stripe_state = "pay";
			$(".pbutton").removeClass("psuccess");
			$(".pbutton").html(phrase.html("services.payments.pay-amount", { amount: pamount }));
		}, 20);
		return;
	}
	if (stripe_state == "failed") ((stripe_state = "pay"), $(".pbutton").removeClass("pfail"));
	if (stripe_state == "declined") ((stripe_state = "pay"), $(".pbutton").removeClass("pfail"));
	if (stripe_state == "pay") $(".pbutton").html(phrase.html("services.payments.pay-amount", { amount: pamount }));
	update_shells_calc();
}

function update_shells_calc() {
	var calc = active_payment_ui("#shells-calc");
	if (pamount < 25 && pamount != 1 && !extra_shells_pct) {
		calc.hide();
		return;
	}
	var base = pamount == 1 ? 75 : pamount * 80;
	var bonus_mult = 0;
	if (pamount >= 500) bonus_mult = 0.24;
	else if (pamount >= 100) bonus_mult = 0.16;
	else if (pamount >= 25) bonus_mult = 0.08;
	var extra = Math.floor(base * bonus_mult);
	var subtotal = base + extra;
	var html = "<span style='color: gray;'>" + phrase.html("services.payments.shells-base-extra", { base: to_pretty_num(base), extra: to_pretty_num(extra) });
	if (extra_shells_pct) {
		var event_bonus = Math.floor((subtotal * extra_shells_pct) / 100.0);
		html += phrase.html("services.payments.shells-event-bonus", { bonus: to_pretty_num(event_bonus) });
		subtotal += event_bonus;
	}
	html += " = <span style='color:white'>" + to_pretty_num(subtotal) + "</span></span>";
	calc.find("#shells-calc-line").html(html);
	calc.show();
}

function steam_payment_message(reason) {
	if (reason == "steam_purchase_cancelled") return phrase("services.payments.purchase-cancelled");
	if (reason == "steam_auth_failed") return phrase("services.payments.steam-authentication-failed-please-restart-adventure-land-through-steam");
	if (reason == "steam_account_required") return phrase("services.payments.log-in-through-steam-before-purchasing-shells");
	if (reason == "steam_client_update_required") return phrase("services.payments.please-update-the-steam-client-and-restart-adventure-land");
	if (reason == "steam_not_configured") return phrase("services.payments.steam-purchases-aren-t-available-yet");
	if (reason == "steam_checkout_unavailable") return phrase("services.payments.steam-didn-t-provide-a-checkout-page");
	if (reason == "steam_payment_pending" || reason == "steam_purchase_timeout") return phrase("services.payments.steam-is-still-processing-this-purchase");
	return phrase("services.payments.steam-couldn-t-complete-the-purchase");
}

function steam_payment_failed(error) {
	var reason = (error && (error.reason || error.message)) || "steam_purchase_failed";
	steam_debug("failed", { reason: reason, state: steam_state }, "error");
	if (reason == "steam_payment_pending" || reason == "steam_purchase_timeout") {
		steam_state = "pending";
		$(".pbutton").removeClass("pfail");
		$(".pbutton").html(phrase("services.payments.check-steam-payment"));
	} else {
		steam_state = reason == "steam_purchase_cancelled" ? "declined" : "failed";
		$(".pbutton").addClass("pfail");
		$(".pbutton").html(reason == "steam_purchase_cancelled" ? phrase("services.payments.cancelled") : phrase("services.payments.failed"));
	}
	p_log(steam_payment_message(reason), "#88E5BC");
}

function steam_payment_success(data) {
	steam_debug("completed", { shells_received: data.shells });
	steam_state = "success";
	$(".pbutton").removeClass("pfail").addClass("psuccess");
	$(".pbutton").html(phrase("services.payments.success"));
	if (window.character) character.cash = data.cash;
	reset_inventory(1);
	p_log(phrase.html("services.payments.shells-received", { shells: to_pretty_num(data.shells) }), "#88E5BC");
}

function steam_finish_payment(authorized) {
	steam_debug("finalize.start", { authorized: !!authorized });
	steam_state = "finalizing";
	$(".pbutton").html(phrase("services.payments.finalizing"));
	api_call("steam_payment_finish", { order_id: steam_order_id, authorized: !!authorized }).then(steam_payment_success).catch(steam_payment_failed);
}

function steam_poll_payment(order_id, started) {
	if (steam_order_id != order_id) return;
	steam_poll_count++;
	if (steam_poll_count == 1 || steam_poll_count % 10 == 0) {
		steam_debug("status.check", { attempt: steam_poll_count, elapsed_ms: Date.now() - started });
	}
	api_call("steam_payment_finish", { order_id: order_id, authorized: true })
		.then(steam_payment_success)
		.catch(function (error) {
			if (steam_order_id != order_id) return;
			var reason = (error && (error.reason || error.message)) || "steam_purchase_failed";
			if (reason == "steam_payment_pending" && Date.now() - started < 10 * 60 * 1000) {
				if (steam_poll_count == 1 || steam_poll_count % 10 == 0) {
					steam_debug("status.pending", { attempt: steam_poll_count, elapsed_ms: Date.now() - started });
				}
				steam_state = "authorize";
				$(".pbutton").html(phrase("services.payments.waiting-for-steam"));
				setTimeout(function () {
					steam_poll_payment(order_id, started);
				}, 1500);
				return;
			}
			if (reason == "steam_payment_pending") error = new Error("steam_purchase_timeout");
			steam_payment_failed(error);
		});
}

function steam_pay(event) {
	if (event) btc(event);
	steam_debug("button.clicked", {
		usd: pamount,
		state: steam_state,
		tauri: typeof is_tauri != "undefined" && !!is_tauri,
		logged_in: !!user_id,
	});
	if (typeof is_tauri == "undefined" || !is_tauri) {
		p_log(phrase("services.payments.steam-purchases-are-available-in-the-steam-client"), "#88E5BC");
		return;
	}
	if (!user_id) {
		p_log(phrase("services.payments.please-log-in-before-purchasing-shells"), "#88E5BC");
		return;
	}
	if (steam_state == "pending" && steam_order_id) {
		steam_state = "authorize";
		steam_poll_payment(steam_order_id, Date.now());
		return;
	}
	if (in_arr(steam_state, ["process", "authorize", "finalizing"])) {
		p_log(phrase("services.payments.currently-processing-your-steam-payment"), "gray");
		return;
	}
	if (in_arr(steam_state, ["failed", "declined", "success"])) {
		set_pamount(pamount);
		return;
	}

	steam_state = "process";
	steam_poll_count = 0;
	$("#plog").html("");
	$(".pbutton").html(phrase("services.payments.contacting-steam"));
	tauri_refresh_auth()
		.then(function (auth) {
			steam_debug("auth.result", {
				ticket_available: !!(auth && auth.ticket),
				purchases_supported: !!(auth && auth.purchases),
				steam_available: !!(auth && auth.steam_available),
				native_error: (auth && auth.error) || "",
			});
			if (!auth || !auth.purchases) throw new Error("steam_client_update_required");
			if (!auth || !auth.ticket) throw new Error("steam_auth_failed");
			steam_debug("order.start", { usd: pamount, sandbox: !!window.steam_payment_sandbox });
			return api_call("steam_payment_start", { usd: pamount, ticket: auth.ticket, sandbox: !!window.steam_payment_sandbox });
		})
		.then(function (data) {
			steam_debug("order.created", { sandbox: !!data.sandbox, checkout_available: !!data.steam_url });
			steam_order_id = data.order_id;
			steam_state = "authorize";
			$(".pbutton").html(phrase("services.payments.opening-steam"));
			p_log((data.sandbox ? phrase("services.payments.sandbox-prefix") : "") + phrase("services.payments.opening-the-steam-checkout"), "gray");
			return tauri_open_steam_checkout(data.steam_url).then(function (method) {
				if (method == "overlay") p_log((data.sandbox ? phrase("services.payments.sandbox-prefix") : "") + phrase("services.payments.complete-the-purchase-in-the-steam-overlay"), "gray");
				else p_log((data.sandbox ? phrase("services.payments.sandbox-prefix") : "") + phrase("services.payments.steam-overlay-unavailable-complete-the-purchase-in-your-browser"), "gray");
				steam_poll_payment(steam_order_id, Date.now());
			});
		})
		.catch(steam_payment_failed);
}

function stripe_pay() {
	$("#plog").html("");
	if (!window.Stripe) {
		alert(phrase("services.payments.stripe-hasn-t-loaded-please-refresh-the-page-and"));
		return;
	}
	if (stripe_state == "process") {
		add_log(phrase("services.payments.currently-processing-your-payment"));
		p_log(phrase("services.payments.currently-processing-your-payment"));
		return;
	}
	if (stripe_state == "charge") {
		add_log(phrase("services.payments.currently-charging-your-credit-card"));
		return;
	}
	if (in_arr(stripe_state, ["failed", "declined", "success"])) return set_pamount(pamount);
	$(".pbutton").html(phrase("services.payments.processing"));
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
		$(".pbutton").html(phrase("services.payments.charging"));
		api_call("stripe_payment", { usd: pamount, response: response });
	} else {
		$("#plog").html("");
		stripe_state = "failed";
		$(".pbutton").html(phrase("services.payments.failed"));
		if (response.error && response.error.message) (add_log(response.error.message, "gray"), p_log(response.error.message, "gray"));
	}
	// if(Dev) show_json(response);
}

function stripe_result(result, cash) {
	if (result == "success") {
		$("#plog").html("");
		stripe_state = "success";
		$(".pbutton").addClass("psuccess");
		$(".pbutton").html(phrase("services.payments.success"));
		character.cash = cash;
		reset_inventory(1);
	} else if (result == "declined") {
		$("#plog").html("");
		stripe_state = "declined";
		$(".pbutton").addClass("pfail");
		$(".pbutton").html(phrase("services.payments.declined"));
		p_log(phrase("services.payments.if-you-need-help-feel-free-to-email-hello"), "#88E5BC");
	} else {
		$("#plog").html("");
		stripe_state = "failed";
		$(".pbutton").addClass("pfail");
		$(".pbutton").html(phrase("services.payments.failed"));
		p_log(phrase("services.payments.if-you-need-help-feel-free-to-email-hello"), "#88E5BC");
	}
}

function shells_click() {
	show_payments();
}

function show_payments() {
	show_modal($("#paymentshtml").html(), { wrap: false, opacity: 0.4 });
	return;
	var html = "";
	html += "<div style='position: fixed; top: 0px; bottom: 0px; left: 0px; right: 0px; z-index: 9999; background: rgba(0,0,0,0.5); text-align: center' class='paymentsui'>";

	html += $("#paymentshtml").html();

	html +=
		"<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; top: 0px; right: 0px; color: #CFCFCF'>" +
		phrase.html("services.payments.back") +
		"</div>";

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

	html +=
		"<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; top: 0px; right: 0px; color: #CFCFCF'>" +
		phrase.html("services.payments.back") +
		"</div>";

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

	html += "<div class='gamebutton clickable' onclick='$(\".paymentsui\").remove()' style='position: fixed; z-index: 10000; top: 0px; right: 0px'>" + phrase.html("services.payments.back") + "</div>";

	html += "</div>";
	$("body").append(html);
}
