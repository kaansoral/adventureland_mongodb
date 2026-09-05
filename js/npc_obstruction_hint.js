var npc_obstruction_hint = null;

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

function obstructed_focus_npc() {
	if (no_graphics) return;
	if (!proximity_guides || !character || character.rip) return;
	// Match npc_focus(), including doors, so the advertised key opens this NPC.
	var selected = null,
		nearest = 102;
	Object.keys(entities).forEach(function (id) {
		var entity = entities[id];
		if (!entity.npc) return;
		var d = distance(entity, character);
		if (d < nearest) {
			nearest = d;
			selected = entity;
		}
	});
	map_doors.forEach(function (door) {
		var d = distance(door, character);
		if (d < nearest) {
			nearest = d;
			selected = door;
		}
	});
	if (!selected || !selected.npc || !selected.onrclick || !selected.parent || !selected.visible || !selected.worldAlpha) return;
	var body = npc_hint_bounds(selected);
	if (!body) return;
	var blockers = Object.keys(entities).map(function (id) {
		return entities[id];
	});
	if (blockers.indexOf(character) == -1) blockers.push(character);
	for (var i = 0; i < blockers.length; i++) {
		var merchant = blockers[i],
			stand = merchant.standed;
		if (merchant === selected || !merchant.stand || !stand || !merchant.parent || !merchant.visible || !merchant.worldAlpha || !stand.visible) continue;
		// The world renderer sorts stands three units in front of their owner.
		var front = (merchant.real_y === undefined ? merchant.y : merchant.real_y) + 3 - (merchant.y_disp || 0),
			back = (selected.real_y === undefined ? selected.y : selected.real_y) - (selected.y_disp || 0);
		if (front < back) continue;
		var cover = npc_hint_bounds(stand);
		if (!cover) continue;
		var width = Math.min(body.right, cover.right) - Math.max(body.left, cover.left),
			height = Math.min(body.bottom, cover.bottom) - Math.max(body.top, cover.top);
		// Ignore edge contact; require a meaningful part of the NPC's click area.
		if (width > 0 && height > 0 && width * height >= (body.right - body.left) * (body.bottom - body.top) * 0.2) return { npc: selected, bounds: body };
	}
}

function update_npc_obstruction_hint() {
	if (no_graphics) return;
	if (no_html) return;
	var target = obstructed_focus_npc();
	if (!target || !renderer || !renderer.view) {
		if (npc_obstruction_hint) npc_obstruction_hint.hidden = true;
		return;
	}
	var canvas = renderer.view.getBoundingClientRect(),
		scale_x = canvas.width / renderer.screen.width,
		scale_y = canvas.height / renderer.screen.height,
		x = canvas.left + ((target.bounds.left + target.bounds.right) / 2) * scale_x,
		y = canvas.top + target.bounds.top * scale_y;
	if (x < canvas.left || x > canvas.right || y < canvas.top || y > canvas.bottom) {
		if (npc_obstruction_hint) npc_obstruction_hint.hidden = true;
		return;
	}
	if (!npc_obstruction_hint) {
		npc_obstruction_hint = document.createElement("div");
		npc_obstruction_hint.id = "npc-obstruction-hint";
		npc_obstruction_hint.style.cssText = "position:fixed;z-index:97;pointer-events:none;text-align:center;transform:translateX(-50%);font-family:pixel,monospace";
		var button = document.createElement("button");
		button.type = "button";
		button.className = "gamebutton";
		button.style.cssText = "display:block;pointer-events:auto;font:24px/24px pixel,monospace;color:#F5D78E;background:#080808;border:2px solid #B69C60;padding:6px 10px;white-space:pre-line";
		button.onmousedown = button.ontouchstart = function (event) {
			event.stopPropagation();
		};
		button.onclick = function (event) {
			event.stopPropagation();
			var current = obstructed_focus_npc();
			if (current && current.npc === npc_obstruction_hint.npc) current.npc.onrclick();
		};
		npc_obstruction_hint.appendChild(button);
		var stem = document.createElement("div");
		stem.style.cssText = "width:2px;margin:0 auto;background:#B69C60";
		npc_obstruction_hint.appendChild(stem);
		document.body.appendChild(npc_obstruction_hint);
	}
	var key = Object.keys(keymap).find(function (key) {
			return keymap[key] == "interact" || (keymap[key] && keymap[key].name == "interact");
		}),
		definition = G.npcs[target.npc.npc] || {};
	npc_obstruction_hint.npc = target.npc;
	var label = (definition.name || target.npc.name || "NPC") + "\n" + (key ? "Press " + key + " or click to interact" : "Click to interact");
	if (npc_obstruction_hint.firstChild.textContent != label) npc_obstruction_hint.firstChild.textContent = label;
	npc_obstruction_hint.hidden = false;
	var height = npc_obstruction_hint.firstChild.offsetHeight,
		top = Math.max(canvas.top + 8, y - height - 64);
	npc_obstruction_hint.style.left = Math.round(Math.max(canvas.left + npc_obstruction_hint.offsetWidth / 2, Math.min(canvas.right - npc_obstruction_hint.offsetWidth / 2, x))) + "px";
	npc_obstruction_hint.style.top = Math.round(top) + "px";
	npc_obstruction_hint.lastChild.style.height = Math.max(0, Math.round(y - top - height - 8)) + "px";
}
