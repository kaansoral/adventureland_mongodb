// Fortune's Wheel panel. A 64x76 pixel wheel is rasterized on a small canvas every frame and shown at 4x without
// smoothing, so it spins as crisply as the machine on the Tavern floor. The server decides the slice; the client only
// animates towards it. Spin and result state live outside the panel, so a re-render, ESC or a late settlement never
// leaves the wheel resting on a slice other than the actual result. Everything here returns early without graphics or HTML.
var tavern_wheel = { side: "sun", gold: 1000000, edge: null, max: null, rotation: 0, spin: null, result: null, blink: null, kick: 0, under: -1, frame: null, busy: null };
var tavern_wheel_scale = 4,
	tavern_wheel_width = 64,
	tavern_wheel_height = 76,
	tavern_wheel_radius = 27,
	tavern_wheel_cx = 32,
	tavern_wheel_cy = 34;

function wheel_definition() {
	return G.games && G.games.wheel;
}

function wheel_rgb(hex) {
	return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function wheel_side_colors(wheel, side) {
	return wheel.slices
		.filter(function (slice) {
			return slice[1] == side;
		})
		.map(function (slice) {
			return slice[2];
		});
}

function wheel_side_chips(wheel, side) {
	var html = "";
	wheel_side_colors(wheel, side)
		.slice(0, 3)
		.forEach(function (color) {
			html += "<span style='display: inline-block; width: 10px; height: 10px; background: " + color + "; margin-right: 3px; vertical-align: middle; border: 1px solid #6D3D4B'></span>";
		});
	return html + " ";
}

function render_wheel() {
	if (no_graphics || no_html) return;
	var wheel = wheel_definition();
	if (!wheel) return;
	reset_inventory(1);
	topleft_npc = "wheel";
	rendered_target = topleft_npc;
	var html =
		"<div class='wheelpanel' style='background-color: black; border: 5px solid gray; padding: 10px 20px 16px 20px; font-size: 28px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div style='color: #E6B16B; margin-bottom: 2px'>" + phrase.html("interface.wheel.title") + "</div>";
	html +=
		"<canvas class='wheelcanvas' width='" +
		tavern_wheel_width +
		"' height='" +
		tavern_wheel_height +
		"' style='width: " +
		tavern_wheel_width * tavern_wheel_scale +
		"px; height: " +
		tavern_wheel_height * tavern_wheel_scale +
		"px; image-rendering: pixelated; image-rendering: crisp-edges; display: block; margin: 0 auto 6px auto'></canvas>";
	html += "<div class='mb5'>";
	wheel.sides.forEach(function (side, i) {
		html +=
			"<div class='gamebutton clickable wheelside wheelside-" +
			side +
			"' onclick='wheel_pick(\"" +
			side +
			"\")' style='width: 104px" +
			(i ? "; margin-left: 8px" : "") +
			"'>" +
			wheel_side_chips(wheel, side) +
			phrase.html("interface.wheel." + side) +
			"</div>";
	});
	html += "</div>";
	html +=
		"<div class='mb5'><span class='gold clickable' onclick='$(\".wheelgold\").cfocus()'>" +
		phrase.html("interface.dice.gold") +
		"</span> <div class='inline-block wheelgold' contenteditable=true onblur='wheel_change()'>" +
		to_pretty_num(tavern_wheel.gold) +
		"</div></div>";
	html +=
		"<div class='mb5'><div class='gamebutton clickable wheelspin' onclick='wheel_spin()' style='width: 236px'>" +
		phrase.html("interface.wheel.spin") +
		" <span class='gray wheelhint'></span></div></div>";
	html += "<div class='gray wheelhouse' style='font-size: 20px; line-height: 22px'></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	wheel_change();
	wheel_house();
	if (tavern_wheel.spin) wheel_set_busy(true);
	else if (tavern_wheel.result && !tavern_wheel.result.shown) wheel_show_result();
	wheel_draw(tavern_wheel.rotation);
	wheel_animate();
	socket.emit("tavern", { event: "info", game: "wheel" });
}

// The resting rotation that parks a slice under the pointer, and the slice a rotation leaves there.
function wheel_rest_rotation(index) {
	var wheel = wheel_definition();
	return -((index + 0.5) * ((Math.PI * 2) / wheel.slices.length));
}

// A run of several turns that parks the decided slice under the pointer, ending shortly before the settlement.
function wheel_plan(current, index, ms) {
	var wheel = wheel_definition();
	if (!wheel) return null;
	var TAU = Math.PI * 2,
		step = TAU / wheel.slices.length,
		jitter = (Math.random() - 0.5) * step * 0.7,
		from = current % TAU,
		target = -((index + 0.5) * step + jitter),
		delta = (((target - from) % TAU) + TAU) % TAU,
		turns = 5 + floor(Math.random() * 3);
	return { start: performance.now(), duration: max(1200, ms - 350), from: from, to: from + turns * TAU + delta, index: index };
}

function wheel_slice_at(rotation) {
	var wheel = wheel_definition(),
		TAU = Math.PI * 2;
	return floor((((-rotation % TAU) + TAU) % TAU) / (TAU / wheel.slices.length)) % wheel.slices.length;
}

function wheel_pick(side) {
	tavern_wheel.side = side;
	wheel_change();
}

function wheel_cut(gold) {
	return ceil((gold * (tavern_wheel.edge || 0)) / 100.0);
}

function wheel_change() {
	if (topleft_npc != "wheel") return;
	var wheel = wheel_definition();
	var gold = parseInt(("" + $(".wheelgold").html()).replace_all(",", "").replace(/[^0-9]/g, ""));
	if (!gold) gold = tavern_wheel.gold || wheel.min;
	gold = max(wheel.min, gold);
	if (tavern_wheel.max && tavern_wheel.edge !== null) gold = min(gold, max(wheel.min, floor(tavern_wheel.max / (1 - tavern_wheel.edge / 100.0))));
	tavern_wheel.gold = gold;
	$(".wheelgold").html(to_pretty_num(gold));
	wheel.sides.forEach(function (side) {
		$(".wheelside-" + side).css("border-color", side == tavern_wheel.side ? "#A7C16D" : "gray");
	});
	if (!tavern_wheel.spin && !tavern_wheel.busy && !(tavern_wheel.result && !tavern_wheel.result.shown)) $(".wheelhint").html(phrase.html("interface.wheel.win_hint", { amount: to_pretty_num(gold) }));
}

function wheel_house() {
	if (topleft_npc != "wheel" || tavern_wheel.edge === null) return;
	var html = phrase.html("interface.wheel.house", { edge: "" + tavern_wheel.edge });
	if (tavern_wheel.max) html += "<br/>" + phrase.html("interface.tavern_info.max_net_win") + " <span class='gold'>" + to_pretty_num(tavern_wheel.max) + "</span>";
	$(".wheelhouse").html(html);
}

function wheel_info(data) {
	tavern_wheel.edge = data.edge;
	tavern_wheel.max = data.max;
	wheel_change();
	wheel_house();
}

function wheel_set_busy(busy) {
	tavern_wheel.busy = busy;
	$(".wheelspin").css({ opacity: busy ? 0.55 : 1, "pointer-events": busy ? "none" : "" });
	if (busy) $(".wheelhint").html(phrase.html("interface.wheel.spinning"));
	else wheel_change();
}

function wheel_spin() {
	if (tavern_wheel.spin || tavern_wheel.busy) return;
	wheel_change();
	socket.emit("bet", { type: "wheel", side: tavern_wheel.side, gold: tavern_wheel.gold });
	wheel_set_busy(true);
	// A refused wager never starts a spin; release the button after the server's reply had time to arrive.
	setTimeout(function () {
		if (!tavern_wheel.spin && !(tavern_wheel.result && !tavern_wheel.result.shown)) wheel_set_busy(false);
	}, 2500);
}

function wheel_sound(name) {
	try {
		if (!window.sound_sfx || no_html || !window.Howl) return;
		if (name == "tick") {
			if (!sounds.wheel_tick) sounds.wheel_tick = new Howl({ src: [url_factory("/sounds/fx/VideoGameSFX_blip_07.wav")], volume: 0.08 });
			return sounds.wheel_tick.play();
		}
		sfx(name);
	} catch (e) {}
}

// Everyone in view sees the machine turn; the spinner's own wheel runs towards the decided slice, whether or not
// the panel is open right now.
function wheel_start(data) {
	if (no_graphics) return;
	wheel_map_spin(data.index, data.ms || 4000);
	if (data.player != character.name) return;
	var plan = wheel_plan(tavern_wheel.rotation, data.index, data.ms || 4000);
	if (!plan) return;
	tavern_wheel.rotation = plan.from;
	tavern_wheel.blink = null;
	tavern_wheel.result = null;
	tavern_wheel.spin = plan;
	wheel_set_busy(true);
	wheel_sound("whoosh");
	wheel_animate();
}

// Settlement from the server. A wheel that is still turning finishes its run first; the resting slice is always the
// server's result, even when the panel was closed or re-rendered in between.
function wheel_finish(data) {
	if (no_graphics) return;
	tavern_wheel.result = data;
	var spin = tavern_wheel.spin;
	if (spin && performance.now() < spin.start + spin.duration && spin.index == data.index) return wheel_animate();
	wheel_show_result();
}

function wheel_show_result() {
	var data = tavern_wheel.result;
	if (!data || data.shown) return;
	data.shown = true;
	if (tavern_wheel.spin) {
		tavern_wheel.rotation = tavern_wheel.spin.to;
		tavern_wheel.spin = null;
	}
	if (data.index !== undefined && wheel_slice_at(tavern_wheel.rotation) !== data.index) tavern_wheel.rotation = wheel_rest_rotation(data.index);
	tavern_wheel.blink = { index: data.index, start: performance.now(), duration: 1800 };
	tavern_wheel.busy = false;
	$(".wheelspin").css({ opacity: 1, "pointer-events": "" });
	if (data.refund) $(".wheelhint").html(phrase.html("interface.tavern.refunded"));
	else $(".wheelhint").html(data.won ? "<span class='gold'>+" + to_pretty_num(data.gold) + "</span>" : "<span style='color: #E05A4A'>-" + to_pretty_num(data.gold) + "</span>");
	if (!data.refund) wheel_sound(data.won ? "coins" : "drop");
	if (data.won && data.gold >= 10000000) wheel_sound("level_up");
	setTimeout(function () {
		if (!tavern_wheel.spin && !tavern_wheel.busy) wheel_change();
	}, 3000);
	wheel_animate();
}

function wheel_tavern_event(data) {
	var player = get_entity(data.name);
	data.won = data.event == "won";
	data.refund = data.event == "refund";
	if (data.won) {
		if (player) {
			d_text("+" + to_pretty_num(data.gold), player, { color: "gold" });
			if (data.gold >= 100000000) confetti_shower(player, 2);
			else if (data.gold >= 10000000) confetti_shower(player, 1);
		}
	} else if (data.event == "lost") {
		if (player) {
			d_text("-" + to_pretty_num(data.gold), player, { color: "#E05A4A" });
			if (data.gold >= 10000000) assassin_smoke(player.real_x, player.real_y);
		}
	}
	wheel_map_settle(data.index);
	if (player && player.me) wheel_finish(data);
}

function wheel_animate() {
	if (tavern_wheel.frame || no_graphics) return;
	tavern_wheel.frame = requestAnimationFrame(wheel_frame);
}

function wheel_frame(now) {
	tavern_wheel.frame = null;
	// Without a panel the spin keeps its clock; the next render resumes it from the right place.
	if (!$(".wheelcanvas").length) return;
	var spin = tavern_wheel.spin,
		active = false;
	if (spin) {
		var t = min(1, (now - spin.start) / spin.duration),
			eased = 1 - Math.pow(1 - t, 3);
		tavern_wheel.rotation = spin.from + (spin.to - spin.from) * eased;
		if (t >= 1) {
			tavern_wheel.rotation = spin.to;
			tavern_wheel.spin = null;
			tavern_wheel.blink = { index: spin.index, start: now, duration: 1200 };
			if (tavern_wheel.result) wheel_show_result();
		} else active = true;
	}
	if (tavern_wheel.blink) {
		if (now - tavern_wheel.blink.start > tavern_wheel.blink.duration) tavern_wheel.blink = null;
		else active = true;
	}
	wheel_draw(tavern_wheel.rotation, now);
	if (active || now - tavern_wheel.kick < 90) wheel_animate();
}

function wheel_draw(rotation, now) {
	var canvas = $(".wheelcanvas")[0];
	if (!canvas || !canvas.getContext) return;
	if (now === undefined) now = performance.now();
	var under = wheel_raster(canvas.getContext("2d"), {
		W: tavern_wheel_width,
		H: tavern_wheel_height,
		cx: tavern_wheel_cx,
		cy: tavern_wheel_cy,
		R: tavern_wheel_radius,
		rotation: rotation,
		stand: true,
		dots: 3,
		lit: tavern_wheel.blink && floor((now - tavern_wheel.blink.start) / 150) % 2 == 0 ? tavern_wheel.blink.index : -1,
		kick: now - tavern_wheel.kick < 90,
	});
	if (under != tavern_wheel.under) {
		if (tavern_wheel.under >= 0 && tavern_wheel.spin) {
			tavern_wheel.kick = now;
			wheel_sound("tick");
		}
		tavern_wheel.under = under;
	}
}

// Draws the wheel, its pointer and optionally its stand into a 2D context; returns the slice under the pointer.
function wheel_raster(ctx, o) {
	var wheel = wheel_definition();
	if (!wheel) return -1;
	var W = o.W,
		H = o.H,
		R = o.R,
		cx = o.cx,
		cy = o.cy,
		n = wheel.slices.length,
		TAU = Math.PI * 2,
		step = TAU / n,
		rotation = o.rotation;
	if (!tavern_wheel.colors || tavern_wheel.colors.length != n) tavern_wheel.colors = wheel.slices.map((slice) => wheel_rgb(slice[2]));
	var image = ctx.createImageData(W, H),
		px = image.data,
		rim = [109, 61, 75],
		wood = [179, 117, 75],
		wood2 = [157, 95, 62],
		white = [255, 255, 255],
		black = [8, 8, 8];
	function put(x, y, c) {
		if (x < 0 || y < 0 || x >= W || y >= H) return;
		var i = (y * W + x) * 4;
		px[i] = c[0];
		px[i + 1] = c[1];
		px[i + 2] = c[2];
		px[i + 3] = 255;
	}
	if (o.stand) {
		// Stand: a centre post and two splayed legs, like the machine on the floor.
		for (var y = cy + R - 2; y < H; y++) {
			var spread = (y - (cy + R - 2)) * 0.62;
			for (var side = -1; side <= 1; side += 2) {
				var lx = round(cx + side * (5 + spread));
				put(lx, y, wood);
				put(lx + (side < 0 ? 1 : -1), y, wood2);
				put(lx + (side < 0 ? -1 : 1), y, rim);
			}
		}
		for (var y = cy + R - 1; y < cy + R + 5; y++) {
			put(cx - 1, y, rim);
			put(cx, y, wood2);
			put(cx + 1, y, rim);
		}
	}
	var under = floor((((-rotation % TAU) + TAU) % TAU) / step) % n,
		lit = o.lit === undefined ? -1 : o.lit;
	for (var y = cy - R - 2; y <= cy + R + 2; y++) {
		for (var x = cx - R - 2; x <= cx + R + 2; x++) {
			var dx = x + 0.5 - cx,
				dy = y + 0.5 - cy,
				r = Math.sqrt(dx * dx + dy * dy);
			if (r > R + 1.6) continue;
			if (r > R) {
				put(x, y, rim);
				continue;
			}
			if (r < (R > 20 ? 1.7 : 1.2)) {
				put(x, y, black);
				continue;
			}
			var a = (((Math.atan2(dx, -dy) - rotation) % TAU) + TAU) % TAU,
				index = floor(a / step) % n,
				local = a - index * step,
				color = index == lit ? white : tavern_wheel.colors[index];
			// White speckles per slice, fixed to the wheel so they turn with it.
			if (index != lit && o.dots) {
				var seed = ((index * 37) % 11) / 11;
				var dots = [
					[R * (0.36 + 0.18 * seed), step * (0.3 + 0.25 * seed)],
					[R * (0.62 + 0.1 * seed), step * (0.68 - 0.2 * seed)],
					[R * (0.84 - 0.06 * seed), step * (0.42 + 0.15 * seed)],
				];
				for (var d = 0; d < o.dots; d++) {
					if (Math.abs(r - dots[d][0]) < 0.6 && Math.abs(local - dots[d][1]) * dots[d][0] < 0.6) {
						color = white;
						break;
					}
				}
			}
			put(x, y, color);
		}
	}
	// Pointer cap and needle. The needle flicks against the spin for a few frames after each slice passes.
	var top = cy - R,
		flick = o.kick ? -1 : 0,
		cap = R > 20 ? 2 : 1;
	for (var x = cx - cap; x <= cx + cap; x++) for (var y = top - (R > 20 ? 5 : 4); y <= top - 3; y++) put(x, y, rim);
	put(cx, top - 4, wood2);
	for (var y = top - 3; y <= top + (R > 20 ? 5 : 3); y++) put(cx + (y > top + 1 ? flick : 0), y, black);
	ctx.putImageData(image, 0, 0);
	return under;
}

// The wheel on the Tavern floor is the same rasterizer at map scale, drawn on a canvas texture over the machine
// sprite, so every player in view watches it turn and rest on the actual result.
var tavern_wheel_map = { sprite: null, disc: null, canvas: null, texture: null, rotation: 0, spin: null, blink: null, dirty: true };

function wheel_map_attach(sprite) {
	if (no_graphics || typeof PIXI == "undefined" || typeof document == "undefined" || !wheel_definition()) return;
	var canvas = document.createElement("canvas");
	canvas.width = 30;
	canvas.height = 32;
	var texture = PIXI.Texture.fromCanvas ? PIXI.Texture.fromCanvas(canvas, PIXI.SCALE_MODES.NEAREST) : PIXI.Texture.from(canvas);
	var disc = new PIXI.Sprite(texture);
	disc.x = -15;
	disc.y = -39;
	sprite.addChild(disc);
	tavern_wheel_map = { sprite: sprite, disc: disc, canvas: canvas, texture: texture, rotation: tavern_wheel_map.rotation, spin: null, blink: null, dirty: true };
	wheel_map_update(sprite);
}

function wheel_map_spin(index, ms) {
	if (no_graphics || !tavern_wheel_map.disc || index === undefined) return;
	var plan = wheel_plan(tavern_wheel_map.rotation, index, ms);
	if (!plan) return;
	tavern_wheel_map.rotation = plan.from;
	tavern_wheel_map.spin = plan;
	tavern_wheel_map.blink = null;
	tavern_wheel_map.dirty = true;
}

function wheel_map_settle(index) {
	if (no_graphics || !tavern_wheel_map.disc || index === undefined) return;
	var now = performance.now(),
		spin = tavern_wheel_map.spin;
	if (spin && now < spin.start + spin.duration && spin.index == index) return;
	if (spin) tavern_wheel_map.rotation = spin.to;
	tavern_wheel_map.spin = null;
	if (wheel_slice_at(tavern_wheel_map.rotation) !== index) tavern_wheel_map.rotation = wheel_rest_rotation(index);
	tavern_wheel_map.blink = { index: index, start: now, duration: 1200 };
	tavern_wheel_map.dirty = true;
}

function wheel_map_update(sprite) {
	var m = tavern_wheel_map;
	if (no_graphics || !m.disc || m.sprite != sprite) return;
	var now = performance.now(),
		spin = m.spin;
	if (spin) {
		var t = min(1, (now - spin.start) / spin.duration);
		m.rotation = spin.from + (spin.to - spin.from) * (1 - Math.pow(1 - t, 3));
		if (t >= 1) {
			m.rotation = spin.to;
			m.spin = null;
			m.blink = { index: spin.index, start: now, duration: 1200 };
		}
		m.dirty = true;
	}
	if (m.blink) {
		if (now - m.blink.start > m.blink.duration) m.blink = null;
		m.dirty = true;
	}
	if (!m.dirty) return;
	m.dirty = false;
	wheel_raster(m.canvas.getContext("2d"), {
		W: 30,
		H: 32,
		cx: 15,
		cy: 17,
		R: 13,
		rotation: m.rotation,
		stand: false,
		dots: 1,
		lit: m.blink && floor((now - m.blink.start) / 150) % 2 == 0 ? m.blink.index : -1,
	});
	m.texture.update();
}
