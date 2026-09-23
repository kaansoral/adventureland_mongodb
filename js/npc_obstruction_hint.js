var npc_obstruction_hints = [],
	npc_obstruction_hints_enabled = storage_get("npc_obstruction_hints") != "off";

function set_npc_obstruction_hints(enabled, just_ui) {
	npc_obstruction_hints_enabled = !!enabled;
	if (!just_ui) storage_set("npc_obstruction_hints", enabled ? "on" : "off");
	$(".npc-hints-state")
		.text(enabled ? phrase("services.npc_obstruction_hint.enabled") : phrase("services.npc_obstruction_hint.disabled"))
		.css("color", enabled ? "green" : "#F54423");
	if (!enabled)
		npc_obstruction_hints.forEach(function (button) {
			button.style.display = "none";
		});
}

function npc_hint_bounds(sprite, include_name) {
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
	var bounds = { left: Math.min.apply(Math, xs), right: Math.max.apply(Math, xs), top: Math.min.apply(Math, ys), bottom: Math.max.apply(Math, ys) };
	if (include_name && sprite.name_tag && sprite.name_tag.visible && sprite.name_tag.worldAlpha) {
		var name = sprite.name_tag.getBounds(true);
		if (name.width && name.height) {
			bounds.left = Math.min(bounds.left, name.x);
			bounds.right = Math.max(bounds.right, name.x + name.width);
			bounds.top = Math.min(bounds.top, name.y);
			bounds.bottom = Math.max(bounds.bottom, name.y + name.height);
		}
	}
	return bounds;
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
		var definition = G.npcs[npc.npc] || {};
		// Any stationary NPC can need a notice; citizens and roaming NPCs stay quiet.
		if (definition.role == "citizen" || definition.moving || definition.movable || npc.citizen || npc.moving) return;
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

function npc_hint_position(canvas, w, h, x, y, obstacles) {
	var min_x = Math.ceil(canvas.left + 8),
		max_x = Math.floor(canvas.right - w - 8),
		min_y = Math.ceil(canvas.top + 8),
		max_y = Math.floor(canvas.bottom - h - 8);
	if (min_x > max_x || min_y > max_y) return;
	var preferred_left = Math.max(min_x, Math.min(max_x, Math.round(x - w / 2))),
		preferred_top = Math.max(min_y, Math.min(max_y, Math.round(y - h - 104))),
		xs = [preferred_left],
		ys = [preferred_top],
		best,
		score = Infinity;
	function check(left, top) {
		var cost = (left - preferred_left) * (left - preferred_left) + (top - preferred_top) * (top - preferred_top);
		if (
			cost >= score ||
			obstacles.some(function (rect) {
				return left < rect.right + 8 && left + w + 8 > rect.left && top < rect.bottom + 8 && top + h + 8 > rect.top;
			})
		) return;
		best = { left: left, right: left + w, top: top, bottom: top + h };
		score = cost;
	}
	check(preferred_left, preferred_top);
	if (best) return best;
	// The nearest free position lies at the viewport or an obstacle's edge.
	xs.push(min_x, max_x);
	ys.push(min_y, max_y);
	obstacles.forEach(function (rect) {
		xs.push(Math.ceil(rect.right + 8), Math.floor(rect.left - w - 8));
		ys.push(Math.ceil(rect.bottom + 8), Math.floor(rect.top - h - 8));
	});
	xs.forEach(function (left) {
		if (left < min_x || left > max_x) return;
		ys.forEach(function (top) {
			if (top >= min_y && top <= max_y) check(left, top);
		});
	});
	return best;
}

function update_npc_obstruction_hint() {
	if (no_graphics) return;
	if (no_html) return;
	if (!renderer || !renderer.view) return;
	var screen = renderer.view.getBoundingClientRect(),
		zoom = 1 + (window.browser_zoom || 0) / 100,
		// Fixed button positions and offset sizes use layout pixels, before page zoom.
		canvas = { left: screen.left / zoom, right: screen.right / zoom, top: screen.top / zoom, bottom: screen.bottom / zoom },
		scale_x = screen.width / (renderer.screen.width * zoom),
		scale_y = screen.height / (renderer.screen.height * zoom),
		obstacles = [],
		placed = [],
		targets = obstructed_npcs().sort(function (a, b) {
			return a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left;
		});
	if (targets.length) {
		Object.keys(entities)
			.map(function (id) { return entities[id]; })
			.filter(function (sprite) { return sprite.npc; })
			.concat(window.map_npcs || [], window.map_doors || [])
			.forEach(function (sprite) {
				if (!sprite.parent || !sprite.visible || !sprite.worldAlpha) return;
				var bounds = npc_hint_bounds(sprite, true);
				if (!bounds) return;
				var rect = {
					left: canvas.left + bounds.left * scale_x,
					right: canvas.left + bounds.right * scale_x,
					top: canvas.top + bounds.top * scale_y,
					bottom: canvas.top + bounds.bottom * scale_y,
				};
				if (rect.right + 8 > canvas.left && rect.left - 8 < canvas.right && rect.bottom + 8 > canvas.top && rect.top - 8 < canvas.bottom) obstacles.push(rect);
			});
	}
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
				"position:fixed;z-index:97;pointer-events:auto;font:24px/24px var(--pixel-font, pixel),monospace;color:white;background:black;border:4px solid gray;padding:6px 10px;white-space:pre-line;cursor:pointer;touch-action:none";
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
			label = phrase("services.npc_obstruction_hint.open-npc", { npc: definition.name || target.npc.name || phrase("services.npc_obstruction_hint.npc") });
		if (button.textContent != label) button.textContent = label;
		button.style.display = "block";
		var w = button.offsetWidth,
			h = button.offsetHeight,
			position = npc_hint_position(canvas, w, h, x, y, obstacles.concat(placed));
		// Do not cover an interaction or leave the canvas when there is no free space.
		if (!position) {
			button.style.display = "none";
			return;
		}
		button.style.left = position.left + "px";
		button.style.top = position.top + "px";
		placed.push(position);
	});
	npc_obstruction_hints.slice(placed.length).forEach(function (button) {
		button.style.display = "none";
	});
}
