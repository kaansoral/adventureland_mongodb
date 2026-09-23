// Reusable, finite map effects and entity movement. All positions stay on native pixels.
function projectile_origin(attacker, target, offset) {
	if (!offset) return { x: get_x(attacker), y: get_y(attacker) - 15 };
	var angle = Math.atan2(get_y(target) - get_y(attacker), get_x(target) - get_x(attacker));
	return { x: Math.round(get_x(attacker) - Math.sin(angle) * offset), y: Math.round(get_y(attacker) - 15 + Math.cos(angle) * offset) };
}

function play_map_effect(name, x, y, args) {
	if (no_graphics || !map || !G.animations[name]) return;
	args = args || {};
	var sprite = new_sprite(name, "animation");
	sprite.atype = "effect";
	sprite.id = randomStr(12);
	sprite.x = Math.round(x);
	sprite.y = Math.round(y);
	sprite.anchor.set(0.5, 1);
	sprite.scale.set(Math.max(1, Math.floor(args.scale || 1)));
	sprite.effect_started = Date.now();
	sprite.effect_interval = args.interval || 36;
	sprite.alpha = args.alpha === undefined ? 0.9 : args.alpha;
	sprite.parentGroup = sprite.displayGroup = player_layer;
	map_animations[sprite.id] = sprite;
	map.addChild(sprite);
	return sprite;
}

function update_map_effect(sprite) {
	if (no_graphics) return;
	var frame = Math.floor((Date.now() - sprite.effect_started) / sprite.effect_interval);
	if (frame >= sprite.frames) {
		delete map_animations[sprite.id];
		destroy_sprite(sprite, "children");
		return;
	}
	set_texture(sprite, frame);
}

function play_entity_strike(sprite) {
	if (no_graphics || !sprite || sprite.dead) return;
	var direction = sprite.a_direction;
	sprite.entity_strike = { started: Date.now(), dx: direction === 1 ? -10 : direction === 2 ? 10 : 0, dy: direction === 0 ? 7 : direction === 3 ? -7 : 0 };
}

function update_entity_motion(sprite) {
	if (no_graphics || !sprite || sprite.dead) return;
	var motion = sprite.motion,
		now = Date.now();
	if (motion && motion.id !== sprite.entity_motion_id) {
		sprite.entity_motion_id = motion.id;
		if (["arrival", "blink", "lunge"].includes(motion.kind)) {
			sprite.entity_motion = Object.assign({}, motion, { started: now - Math.max(0, motion.age || 0), trail_at: 0 });
			if ((motion.age || 0) < motion.duration + motion.delay && motion.kind !== "lunge") {
				play_map_effect("transport", get_x(sprite) + motion.dx, get_y(sprite) + motion.dy);
				if (motion.kind === "arrival") play_cosmetic_emote_sound("superjump", 1);
			}
		}
	}
	var state = sprite.entity_motion;
	if (state) {
		var progress = Math.max(0, Math.min(1, (now - state.started - state.delay) / state.duration));
		var remaining = 1 - progress;
		var lift = state.kind === "arrival" ? 32 : state.kind === "blink" ? 12 : 5;
		var dx = Math.round(state.dx * remaining * remaining);
		var dy = Math.round(state.dy * remaining - Math.sin(progress * Math.PI) * lift);
		sprite.x += dx;
		sprite.y += dy;
		if (progress > 0 && progress < 1 && now >= state.trail_at) {
			state.trail_at = now + 80;
			disappearing_clone(sprite, { x: Math.round(get_x(sprite) + dx), y: Math.round(get_y(sprite) + dy), alpha: 0.28 });
		}
		if (progress === 1) {
			if (state.kind !== "lunge") {
				play_map_effect(state.kind === "blink" ? "explode_p" : "block", get_x(sprite), get_y(sprite));
				sfx("monster_hit", get_x(sprite), get_y(sprite));
			}
			delete sprite.entity_motion;
		}
	}
	if (sprite.entity_strike && !sprite.entity_motion) {
		var strike = sprite.entity_strike,
			progress = (now - strike.started) / 140;
		if (progress >= 1) delete sprite.entity_strike;
		else {
			var amount = Math.sin(Math.max(0, progress) * Math.PI);
			sprite.x += Math.round(strike.dx * amount);
			sprite.y += Math.round(strike.dy * amount);
		}
	}
}
