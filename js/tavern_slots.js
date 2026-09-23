// Slots panel. Three reels of item sprites turn inside a 78x76 pixel machine drawn on a small canvas and shown at 4x
// without smoothing. The server draws the prize and the reel stops; the client only animates towards them. Spin and
// result state live outside the panel, so a re-render, ESC or a late settlement never leaves the reels on a wrong picture.
var tavern_slots = { edge: null, pos: [0, 0, 0], spin: null, result: null, busy: false, frame: null, flash: null, middle: [-1, -1, -1], stopped: [false, false, false], images: {} };
var tavern_slots_scale = 4,
	tavern_slots_width = 78,
	tavern_slots_height = 76,
	tavern_slots_windows = [6, 29, 52],
	tavern_slots_top = 12,
	tavern_slots_cell = 20;

function slots_definition() {
	return G.games && G.games.slots;
}

// The item pack that holds a symbol, loaded once for canvas drawing.
function slots_sprite(name) {
	var pos = G.positions[name];
	if (!pos) return null;
	var key = pos[0] || "pack_20",
		pack = G.imagesets[key],
		image = tavern_slots.images[key];
	if (!image) {
		image = new Image();
		image.onload = function () {
			slots_draw();
		};
		image.src = window.url_factory ? url_factory(pack.file) : pack.file;
		tavern_slots.images[key] = image;
	}
	if (!image.complete || !image.naturalWidth) return null;
	return { image: image, x: pos[1] * pack.size, y: pos[2] * pack.size, size: pack.size };
}

function slots_icons(name) {
	var html = "";
	for (var i = 0; i < 3; i++) html += item_container({ skin: name, size: 20, bcolor: "#6D3D4B", draggable: false });
	return html;
}

function render_slot_machine() {
	if (no_graphics || no_html) return;
	var slots = slots_definition();
	if (!slots) return;
	reset_inventory(1);
	topleft_npc = "slots";
	rendered_target = topleft_npc;
	var html =
		"<div class='slotspanel' style='background-color: black; border: 5px solid gray; padding: 10px 20px 14px 20px; font-size: 28px; display: inline-block; vertical-align: top; text-align: center'>";
	html += "<div style='color: #E6B16B; margin-bottom: 2px'>" + phrase.html("interface.slots.title") + "</div>";
	html +=
		"<canvas class='slotscanvas' width='" +
		tavern_slots_width +
		"' height='" +
		tavern_slots_height +
		"' style='width: " +
		tavern_slots_width * tavern_slots_scale +
		"px; height: " +
		tavern_slots_height * tavern_slots_scale +
		"px; image-rendering: pixelated; image-rendering: crisp-edges; display: block; margin: 0 auto 6px auto'></canvas>";
	html +=
		"<div class='mb5'><div class='gamebutton clickable slotsspin' onclick='slots_spin()' style='width: 236px'>" +
		phrase.html("interface.wheel.spin") +
		" <span class='gray slotshint'></span></div></div>";
	html += "<div class='slotspaytable' style='display: inline-block; text-align: left; font-size: 20px; line-height: 30px'>";
	html += "<div class='gray' style='text-align: center; font-size: 20px; margin-bottom: 2px'>" + phrase.html("interface.slots.paytable") + "</div>";
	slots.prizes.forEach(function (prize) {
		html +=
			"<div style='white-space: nowrap'>" +
			slots_icons(prize[0]) +
			" <span class='gold'>" +
			to_pretty_num(prize[1]) +
			"</span> <span class='gray' style='font-size: 16px'>" +
			phrase.html("interface.slots.odds", { value: to_pretty_num(round(slots.draws / prize[2])) }) +
			"</span></div>";
	});
	html += "</div>";
	html += "<div class='gray slotshouse' style='font-size: 20px; line-height: 22px; margin-top: 6px'></div>";
	html += "</div>";
	render_ui_panel("#topleftcornerui", html);
	if (!inventory) (render_inventory(), (inventory_opened_for = topleft_npc));
	slots_house();
	if (tavern_slots.spin) slots_set_busy(true);
	else if (tavern_slots.result && !tavern_slots.result.shown) slots_show_result();
	else slots_set_busy(false);
	slots_draw();
	slots_animate();
	socket.emit("tavern", { event: "info", game: "slots" });
}

function slots_house() {
	if (tavern_slots.edge === null) return;
	$(".slotshouse").html(phrase.html("interface.wheel.house", { edge: "" + tavern_slots.edge }));
}

function slots_info(data) {
	tavern_slots.edge = data.edge;
	slots_house();
}

function slots_set_busy(busy) {
	tavern_slots.busy = busy;
	$(".slotsspin").css({ opacity: busy ? 0.55 : 1, "pointer-events": busy ? "none" : "" });
	var slots = slots_definition();
	if (busy) $(".slotshint").html(phrase.html("interface.wheel.spinning"));
	else if (slots) $(".slotshint").html(phrase.html("interface.slots.cost", { amount: to_pretty_num(slots.gold) }));
}

function slots_spin() {
	if (tavern_slots.spin || tavern_slots.busy) return;
	socket.emit("bet", { type: "slots" });
	slots_set_busy(true);
	// A refused stake never starts the reels; release the button after the server's reply had time to arrive.
	setTimeout(function () {
		if (!tavern_slots.spin) slots_set_busy(false);
	}, 2500);
}

function slots_sound(name) {
	wheel_sound(name);
}

// Everyone in view sees the machine shake; the player's own reels run towards the decided stops.
function slots_start(data) {
	if (no_graphics) return;
	slots_map_spin(data.stops, data.ms || 3600);
	if (data.player != character.name || !data.stops) return;
	var slots = slots_definition();
	if (!slots) return;
	var now = performance.now(),
		cell = tavern_slots_cell,
		reels = [];
	for (var r = 0; r < slots.reels.length; r++) {
		var length = slots.reels[r].length * cell,
			from = ((tavern_slots.pos[r] % length) + length) % length,
			delta = (((data.stops[r] * cell - from) % length) + length) % length;
		reels.push({ from: from, to: from + (3 + r) * length + delta, start: now, stop: now + 1500 + r * 600 });
	}
	tavern_slots.spin = { reels: reels, stops: data.stops, end: now + 1500 + (reels.length - 1) * 600 + 200 };
	tavern_slots.result = null;
	tavern_slots.flash = null;
	tavern_slots.stopped = [false, false, false];
	slots_set_busy(true);
	slots_sound("open");
	slots_sound("whoosh");
	slots_animate();
}

// Settlement from the server. The reels finish their run first when they are still turning.
function slots_settle(data) {
	if (no_graphics) return;
	tavern_slots.result = data;
	if (tavern_slots.spin && performance.now() < tavern_slots.spin.end) return slots_animate();
	slots_show_result();
}

function slots_show_result() {
	var data = tavern_slots.result;
	if (!data || data.shown) return;
	data.shown = true;
	var slots = slots_definition();
	if (tavern_slots.spin) {
		tavern_slots.spin.reels.forEach(function (reel, r) {
			tavern_slots.pos[r] = reel.to;
		});
		tavern_slots.spin = null;
	}
	if (data.stops && slots) data.stops.forEach((stop, r) => (tavern_slots.pos[r] = stop * tavern_slots_cell));
	tavern_slots.busy = false;
	tavern_slots.flash = data.refund ? null : { start: performance.now(), duration: data.won ? 2400 : 900, won: !!data.won };
	$(".slotsspin").css({ opacity: 1, "pointer-events": "" });
	// Amounts show the prize as listed on the pay table; the house line explains the cut.
	if (data.refund) $(".slotshint").html(phrase.html("interface.tavern.refunded"));
	else $(".slotshint").html(data.won ? "<span class='gold'>+" + to_pretty_num(data.prize) + "</span>" : "<span style='color: #E05A4A'>-" + to_pretty_num(data.gold) + "</span>");
	if (!data.refund) slots_sound(data.won ? "coins" : "drop");
	if (data.won && data.prize >= 10000000) slots_sound("level_up");
	setTimeout(function () {
		if (!tavern_slots.spin && !tavern_slots.busy) slots_set_busy(false);
	}, 3000);
	slots_animate();
}

function slots_tavern_event(data) {
	var player = get_entity(data.name);
	data.won = data.event == "won";
	data.refund = data.event == "refund";
	if (player && !data.refund) {
		if (data.won) {
			d_text("+" + to_pretty_num(data.prize), player, { color: "gold" });
			if (data.prize >= 100000000) confetti_shower(player, 2);
			else if (data.prize >= 10000000) confetti_shower(player, 1);
		} else d_text("-" + to_pretty_num(data.gold), player, { color: "#E05A4A" });
	}
	slots_map_show(data.symbols);
	if (player && player.me) slots_settle(data);
}

function slots_animate() {
	if (tavern_slots.frame || no_graphics) return;
	tavern_slots.frame = requestAnimationFrame(slots_frame);
}

function slots_reel_position(reel, now, r) {
	if (now >= reel.stop) {
		if (!tavern_slots.stopped[r]) {
			tavern_slots.stopped[r] = true;
			slots_sound("drop");
		}
		var v = min(1, (now - reel.stop) / 180);
		return reel.to + round(3 * Math.sin(Math.PI * v));
	}
	var t = (now - reel.start) / (reel.stop - reel.start),
		eased = 1 - Math.pow(1 - t, 3);
	return reel.from + (reel.to - reel.from) * eased;
}

function slots_frame(now) {
	tavern_slots.frame = null;
	if (!$(".slotscanvas").length) return;
	var spin = tavern_slots.spin,
		active = false;
	if (spin) {
		spin.reels.forEach(function (reel, r) {
			tavern_slots.pos[r] = slots_reel_position(reel, now, r);
		});
		if (now >= spin.end) {
			spin.reels.forEach(function (reel, r) {
				tavern_slots.pos[r] = reel.to;
			});
			tavern_slots.spin = null;
			if (tavern_slots.result) slots_show_result();
		} else active = true;
	}
	if (tavern_slots.flash) {
		if (now - tavern_slots.flash.start > tavern_slots.flash.duration) tavern_slots.flash = null;
		else active = true;
	}
	slots_draw(now);
	if (active) slots_animate();
}

function slots_draw(now) {
	var canvas = $(".slotscanvas")[0];
	if (!canvas || !canvas.getContext) return;
	var slots = slots_definition();
	if (!slots) return;
	if (now === undefined) now = performance.now();
	var ctx = canvas.getContext("2d"),
		W = tavern_slots_width,
		H = tavern_slots_height,
		top = tavern_slots_top,
		cell = tavern_slots_cell,
		spin = tavern_slots.spin,
		flash = tavern_slots.flash;
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, W, H);
	function box(x, y, w, h, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x, y, w, h);
	}
	// Body: tan cabinet with a maroon outline, rounded corners and a darker right-hand shade, like the floor machine.
	box(1, 0, W - 2, H, "#6D3D4B");
	box(0, 1, W, H - 2, "#6D3D4B");
	box(2, 1, W - 4, H - 2, "#DEBC70");
	box(1, 2, W - 2, H - 4, "#DEBC70");
	box(W - 3, 2, 1, H - 4, "#C6995B");
	box(2, H - 3, W - 4, 1, "#C6995B");
	// Marquee lamps: chase while the reels turn, blaze on a win, glow softly at rest.
	box(4, 3, W - 8, 6, "#40374B");
	for (var i = 0; i < 10; i++) {
		var lit;
		if (spin) lit = (floor(now / 90) + i) % 3 == 0;
		else if (flash && flash.won) lit = floor(now / 120) % 2 == 0 || i % 2 == floor(now / 240) % 2;
		else lit = i % 2 == 0;
		box(6 + i * 7, 5, 2, 2, lit ? (i % 2 ? "#FF7500" : "#FFE737") : "#7D5644");
	}
	// Reel windows with a brighter middle row.
	for (var r = 0; r < slots.reels.length; r++) {
		var x = tavern_slots_windows[r];
		box(x - 1, top - 1, cell + 2, cell * 3 + 2, "#6D3D4B");
		box(x, top, cell, cell, "#CFCFC9");
		box(x, top + cell, cell, cell, "#EDEDE7");
		box(x, top + cell * 2, cell, cell, "#CFCFC9");
		var reel = slots.reels[r],
			length = reel.length * cell,
			offset = ((round(tavern_slots.pos[r]) % length) + length) % length,
			middle = floor(((offset + cell / 2) % length) / cell);
		if (middle != tavern_slots.middle[r]) {
			var was = tavern_slots.middle[r];
			tavern_slots.middle[r] = middle;
			if (spin && was >= 0 && !tavern_slots.stopped[r] && now - spin.reels[r].start > (spin.reels[r].stop - spin.reels[r].start) * 0.55) slots_sound("tick");
		}
		ctx.save();
		ctx.beginPath();
		ctx.rect(x, top, cell, cell * 3);
		ctx.clip();
		for (var k = middle - 2; k <= middle + 2; k++) {
			var index = ((k % reel.length) + reel.length) % reel.length,
				y = top + cell + (offset - k * cell);
			// Symbols travel downwards; index k sits on the payline when the strip offset equals k cells.
			if (y <= top - cell || y >= top + cell * 3) continue;
			var sprite = slots_sprite(reel[index]);
			if (sprite) ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.size, sprite.size, x, y, cell, cell);
			else box(x + 6, y + 6, 8, 8, "#9D5F3E");
		}
		ctx.restore();
	}
	// Payline pointers.
	[
		[1, 1],
		[W - 2, -1],
	].forEach(function (side) {
		var px = side[0],
			dir = side[1],
			cy = top + cell + cell / 2 - 1;
		box(px, cy - 1, 1, 3, "#BC2040");
		box(px + dir, cy - 1, 1, 3, "#BC2040");
		box(px + dir * 2, cy, 1, 1, "#BC2040");
	});
	// A winning line gets a bright frame that pulses; a miss dims briefly.
	if (flash) {
		var phase = floor((now - flash.start) / 150) % 2 == 0;
		for (var r = 0; r < slots.reels.length; r++) {
			var x = tavern_slots_windows[r];
			if (flash.won) {
				var color = phase ? "#FFFFFF" : "#FFE737";
				box(x - 1, top + cell - 1, cell + 2, 1, color);
				box(x - 1, top + cell * 2, cell + 2, 1, color);
				box(x - 1, top + cell - 1, 1, cell + 2, color);
				box(x + cell, top + cell - 1, 1, cell + 2, color);
			} else if (now - flash.start < 300) {
				ctx.fillStyle = "rgba(64,55,75,0.35)";
				ctx.fillRect(x, top, cell, cell * 3);
			}
		}
	}
	// Coin tray.
	box(20, H - 7, W - 40, 4, "#7D5644");
	box(22, H - 6, W - 44, 2, "#40374B");
}

// The cabinet on the Tavern floor shows the same reels in its three window cells: a tiny quarter-scale sprite of each
// symbol, flickering while the machine shakes and resting on the drawn symbols, for every player in view.
var tavern_slots_map = { sprite: null, cells: null, textures: {}, spin: null, symbols: null };

function slots_item_texture(name) {
	if (no_graphics) return null;
	var cached = tavern_slots_map.textures[name];
	if (cached) return cached;
	var pos = G.positions[name];
	if (!pos) return null;
	var pack = G.imagesets[pos[0] || "pack_20"],
		base = PIXI.utils.BaseTextureCache[pack.file];
	if (!base) return null;
	var texture = new PIXI.Texture(base, new PIXI.Rectangle(pos[1] * pack.size, pos[2] * pack.size, pack.size, pack.size));
	tavern_slots_map.textures[name] = texture;
	return texture;
}

function slots_map_attach(sprite) {
	if (no_graphics || typeof PIXI == "undefined" || !slots_definition()) return;
	var cells = [];
	for (var i = 0; i < 3; i++) {
		var cell = new PIXI.Container();
		cell.x = -10 + 7 * i;
		cell.y = -21;
		cell.visible = false;
		var back = new PIXI.Graphics();
		back.beginFill(0xd7d7d7);
		back.drawRect(0, 0, 6, 6);
		back.endFill();
		cell.addChild(back);
		var icon = new PIXI.Sprite(PIXI.Texture.EMPTY);
		icon.scale.set(0.25, 0.25);
		cell.addChild(icon);
		cell.icon = icon;
		sprite.addChild(cell);
		cells.push(cell);
	}
	tavern_slots_map = { sprite: sprite, cells: cells, textures: tavern_slots_map.textures, spin: null, symbols: tavern_slots_map.symbols };
	if (tavern_slots_map.symbols) slots_map_show(tavern_slots_map.symbols);
}

function slots_map_place(index, name) {
	var m = tavern_slots_map,
		texture = name && slots_item_texture(name);
	if (!m.cells || !texture) return;
	m.cells[index].icon.texture = texture;
	m.cells[index].visible = true;
}

function slots_map_spin(stops, ms) {
	if (no_graphics || !tavern_slots_map.cells || !stops) return;
	var now = performance.now();
	tavern_slots_map.sprite.spinning = future_ms(ms - 300);
	tavern_slots_map.spin = { stops: stops, stop: [now + 1500, now + 2100, now + 2700], next: 0 };
}

function slots_map_show(symbols) {
	if (no_graphics || !symbols) return;
	tavern_slots_map.symbols = symbols;
	tavern_slots_map.spin = null;
	for (var i = 0; i < symbols.length; i++) slots_map_place(i, symbols[i]);
}

function slots_map_update(sprite) {
	var m = tavern_slots_map;
	if (no_graphics || !m.cells || m.sprite != sprite) return;
	if (sprite.spinning) {
		if (!(sprite.updates % 2)) {
			sprite.cskin = "" + ((parseInt(sprite.cskin) + 1) % 3);
			sprite.texture = textures[sprite.mtype][sprite.cskin];
		}
		if (sprite.spinning < new Date()) {
			sprite.spinning = false;
			sprite.cskin = "0";
			sprite.texture = textures[sprite.mtype][0];
		}
	}
	var spin = m.spin,
		slots = slots_definition();
	if (!spin || !slots) return;
	var now = performance.now(),
		done = true;
	for (var r = 0; r < 3; r++) {
		var reel = slots.reels[r];
		if (now >= spin.stop[r]) slots_map_place(r, reel[spin.stops[r]]);
		else {
			done = false;
			if (now >= spin.next) slots_map_place(r, reel[floor(Math.random() * reel.length)]);
		}
	}
	if (now >= spin.next) spin.next = now + 70;
	if (done) slots_map_show(spin.stops.map((stop, r) => slots.reels[r][stop]));
}
