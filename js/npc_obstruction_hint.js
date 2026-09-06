var npc_obstruction_hints = [],
	npc_obstruction_hints_enabled = storage_get("npc_obstruction_hints") != "off";

function set_npc_obstruction_hints(enabled, just_ui) {
	npc_obstruction_hints_enabled = !!enabled;
	if (!just_ui) storage_set("npc_obstruction_hints", enabled ? "on" : "off");
	$(".npc-hints-state")
		.text(enabled ? "ON" : "OFF")
		.css("color", enabled ? "green" : "#F54423");
	if (!enabled)
		npc_obstruction_hints.forEach(function (button) {
			button.style.display = "none";
		});
}

function npc_hint_bounds(sprite) {
	if (no_graphics) return;
	// Use the clickable body, excluding names, speech and other sprite children.
	var frame = sprite.texture && (sprite.texture.orig || sprite.texture.frame),
		rect = sprite.hitArea;
	if (!rect && frame && sprite.anchor) rect = { x: -frame.width * sprite.anchor.x, y: -frame.height * sprite.anchor.y, width: frame.width, height: frame.height };
	if (!rect || !rect.width || !rect.height) return;
	var transform = sprite.worldTransform,
		points = [
			[rect.x, rect.y],
			[rect.x + rect.width, rect.y],
			[rect.x, rect.y + rect.height],
			[rect.x + rect.width, rect.y + rect.height],
		],
		xs = [],
		ys = [];
	points.forEach(function (point) {
		xs.push(transform.a * point[0] + transform.c * point[1] + transform.tx);
		ys.push(transform.b * point[0] + transform.d * point[1] + transform.ty);
	});
	return { left: Math.min.apply(Math, xs), right: Math.max.apply(Math, xs), top: Math.min.apply(Math, ys), bottom: Math.max.apply(Math, ys) };
}

function obstructed_npcs() {
	if (no_graphics) return;
	if (!proximity_guides || !npc_obstruction_hints_enabled || !character || character.rip) return [];
	var all = Object.keys(entities).map(function (id) {
			return entities[id];
		}),
		players = all.filter(function (entity) {
			return entity !== character && entity.type == "character" && !entity.npc && entity.parent && entity.visible && entity.worldAlpha;
		}),
		result = [];
	all.forEach(function (npc) {
		if (!npc.npc || !npc.onrclick || !npc.parent || !npc.visible || !npc.worldAlpha || distance(npc, character) >= 300) return;
		var body = npc_hint_bounds(npc);
		if (!body) return;
		var blocked = players.some(function (player) {
			// Match the world's front-to-back sorting, including the stand offset.
			if ((player.real_y === undefined ? player.y : player.real_y) + (player.stand ? 3 : 0) - (player.y_disp || 0) < (npc.real_y === undefined ? npc.y : npc.real_y) - (npc.y_disp || 0)) return false;
			var covers = [player];
			if (player.stand && player.standed && player.standed.visible) covers.push(player.standed);
			return covers.some(function (sprite) {
				var cover = npc_hint_bounds(sprite);
				if (!cover) return false;
				var width = Math.min(body.right, cover.right) - Math.max(body.left, cover.left),
					height = Math.min(body.bottom, cover.bottom) - Math.max(body.top, cover.top);
				return width > 0 && height > 0 && width * height >= (body.right - body.left) * (body.bottom - body.top) * 0.2;
			});
		});
		if (blocked) result.push({ npc: npc, bounds: body });
	});
	return result;
}

function update_npc_obstruction_hint() {
	if (no_graphics) return;
	if (no_html) return;
	if (!renderer || !renderer.view) return;
	var canvas = renderer.view.getBoundingClientRect(),
		scale_x = canvas.width / renderer.screen.width,
		scale_y = canvas.height / renderer.screen.height,
		placed = [],
		targets = obstructed_npcs().sort(function (a, b) {
			return a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left;
		});
	targets.forEach(function (target) {
		var x = canvas.left + ((target.bounds.left + target.bounds.right) / 2) * scale_x,
			y = canvas.top + target.bounds.top * scale_y;
		if (x < canvas.left || x > canvas.right || y < canvas.top || y > canvas.bottom) return;
		var button = npc_obstruction_hints[placed.length];
		if (!button) {
			button = document.createElement("button");
			button.type = "button";
			button.className = "gamebutton npc-obstruction-hint";
			button.style.cssText =
				"position:fixed;z-index:97;pointer-events:auto;font:24px/24px pixel,monospace;color:white;background:black;border:4px solid gray;padding:6px 10px;white-space:pre-line;cursor:pointer;touch-action:none";
			// Keep pointer input (including move-with-mouse) out of the game canvas.
			["pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "touchstart", "touchend", "mousemove", "touchmove"].forEach(function (type) {
				button.addEventListener(type, function (event) {
					event.stopPropagation();
				});
			});
			button.onclick = function (event) {
				event.preventDefault();
				event.stopPropagation();
				var npc = this.npc;
				if (
					proximity_guides &&
					npc_obstruction_hints_enabled &&
					character &&
					!character.rip &&
					this.style.display != "none" &&
					Object.keys(entities).some(function (id) {
						return entities[id] === npc;
					}) &&
					distance(npc, character) < 300
				)
					npc.onrclick();
			};
			document.body.appendChild(button);
			npc_obstruction_hints.push(button);
		}
		button.npc = target.npc;
		var definition = G.npcs[target.npc.npc] || {},
			label = (definition.name || target.npc.name || "NPC") + "\nPress F or Click";
		if (button.textContent != label) button.textContent = label;
		button.style.display = "block";
		var w = button.offsetWidth,
			h = button.offsetHeight,
			left = Math.round(Math.max(canvas.left + 8, Math.min(canvas.right - w - 8, x - w / 2))),
			top = Math.round(Math.max(canvas.top + 8, y - h - 104)),
			overlap;
		// Place colliding notices below earlier ones, keeping a small gap.
		while (
			(overlap = placed.find(function (rect) {
				return left < rect.right + 8 && left + w + 8 > rect.left && top < rect.bottom + 8 && top + h + 8 > rect.top;
			}))
		)
			top = overlap.bottom + 8;
		button.style.left = left + "px";
		button.style.top = top + "px";
		placed.push({ left: left, right: left + w, top: top, bottom: top + h });
	});
	npc_obstruction_hints.slice(placed.length).forEach(function (button) {
		button.style.display = "none";
	});
}
