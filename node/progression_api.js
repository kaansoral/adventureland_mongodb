// progression_api.js - Read-only, authoritative character progression analysis

var progression_crypto = require("crypto");
var PROGRESSION_OBJECTIVES = ["balanced_farming", "damage", "survival", "support", "gold", "luck", "xp"];
var PROGRESSION_STAT_FIELDS = [
	"attack",
	"heal",
	"frequency",
	"attack_ms",
	"max_hp",
	"max_mp",
	"armor",
	"resistance",
	"speed",
	"range",
	"str",
	"dex",
	"int",
	"vit",
	"for",
	"crit",
	"critdamage",
	"evasion",
	"miss",
	"reflection",
	"lifesteal",
	"manasteal",
	"apiercing",
	"rpiercing",
	"output",
	"goldm",
	"luckm",
	"xpm",
	"mp_cost",
	"mp_reduction",
	"courage",
	"mcourage",
	"pcourage",
];

function progression_number(value, minimum, maximum) {
	value = Number(value);
	if (!Number.isFinite(value)) return null;
	return Math.max(minimum, Math.min(maximum, value));
}

function progression_item(item) {
	if (
		!item ||
		typeof item !== "object" ||
		Array.isArray(item) ||
		!/^[A-Za-z0-9_]{1,100}$/.test(item.name || "") ||
		!G.items[item.name] ||
		item.name === "placeholder"
	)
		return null;
	var result = { name: item.name };
	if (item.level !== undefined) result.level = Math.trunc(progression_number(item.level, 0, 100) || 0);
	if (item.q !== undefined) result.q = Math.trunc(progression_number(item.q, 1, Number.MAX_SAFE_INTEGER) || 1);
	if (item.grace !== undefined) result.grace = progression_number(item.grace, 0, 100000) || 0;
	if (typeof item.stat_type === "string" && /^[a-z_]{1,32}$/.test(item.stat_type)) result.stat_type = item.stat_type;
	if (typeof item.p === "string" && /^[A-Za-z0-9_]{1,100}$/.test(item.p)) result.p = item.p;
	if (item.l || item.locked) result.locked = true;
	if (item.b || item.blocked) result.blocked = true;
	return result;
}

function progression_item_for_stats(item) {
	var clean = progression_item(item);
	if (!clean) return null;
	var result = { name: clean.name };
	if (clean.level !== undefined) result.level = clean.level;
	if (clean.grace !== undefined) result.grace = clean.grace;
	if (clean.stat_type) result.stat_type = clean.stat_type;
	if (clean.p) result.p = clean.p;
	if (clean.locked) result.l = "l";
	if (clean.blocked) result.b = true;
	return result;
}

function progression_item_signature(item) {
	var clean = progression_item(item);
	return clean
		? [
				clean.name,
				clean.level || 0,
				clean.stat_type || "",
				clean.p || "",
				clean.locked ? 1 : 0,
				clean.blocked ? 1 : 0,
			].join("|")
		: "";
}

function progression_equipment(slots) {
	var result = {};
	for (var i = 0; i < character_slots.length; i++) {
		var slot = character_slots[i];
		var item = progression_item(slots && slots[slot]);
		if (item) result[slot] = item;
	}
	return result;
}

function progression_bank_snapshot(player) {
	if (!player.user) return { failed: true, reason: "bank_not_live" };
	var packs = {};
	for (var i = 0; i < 48; i++) {
		var pack = "items" + i;
		if (!Array.isArray(player.user[pack])) continue;
		packs[pack] = player.user[pack].map(function (item) {
			return progression_item(item);
		});
	}
	return {
		success: true,
		source: "live_game_server",
		observed_at: new Date().toISOString(),
		gold: progression_number(player.user.gold, 0, Number.MAX_SAFE_INTEGER) || 0,
		packs: packs,
	};
}

function progression_find_player(request) {
	if (
		!request ||
		!/^US_[A-Za-z0-9_-]{1,100}$/.test(request.owner || "") ||
		!/^CH_[A-Za-z0-9_-]{1,100}$/.test(request.character || "")
	)
		return null;
	for (var id in players) {
		var player = players[id];
		if (player && player.real_id === request.character && player.owner === request.owner) return player;
	}
	return null;
}

function progression_clone_player(player, slots) {
	var clone = JSON.parse(JSON.stringify(player_to_server(player)));
	clone.slots = JSON.parse(JSON.stringify(slots || player.slots || {}));
	clone.items = Array.isArray(clone.items) ? clone.items : [];
	clone.citems = JSON.parse(JSON.stringify(clone.items));
	clone.s = clone.s || {};
	clone.q = clone.q || {};
	clone.p = clone.p || {};
	clone.p.stats = clone.p.stats || { monsters: {}, monsters_diff: {} };
	clone.p.stats.monsters = clone.p.stats.monsters || {};
	clone.p.stats.monsters_diff = clone.p.stats.monsters_diff || {};
	clone.max_stats = clone.max_stats || { monsters: {} };
	clone.max_stats.monsters = clone.max_stats.monsters || {};
	clone.last = { attack: new Date() };
	clone.last_attack_ms = 0;
	clone.socket = { emit: function () {}, disconnect: function () {} };
	clone.warnings = 0;
	var maximum_xp = Number(G.levels[clone.level + ""]);
	if (Number.isFinite(maximum_xp)) clone.xp = Math.max(0, Math.min(Number(clone.xp) || 0, maximum_xp - 1));
	var previous_cps = perfc.cps;
	try {
		calculate_player_stats(clone);
	} finally {
		perfc.cps = previous_cps;
	}
	return clone;
}

function progression_stats(player) {
	var result = {};
	for (var i = 0; i < PROGRESSION_STAT_FIELDS.length; i++) {
		var name = PROGRESSION_STAT_FIELDS[i];
		var value = Number(player[name]);
		if (Number.isFinite(value)) result[name] = Math.round(value * 10000) / 10000;
	}
	return result;
}

function progression_metrics(stats) {
	var critical = 1 + Math.min(1, Math.max(0, stats.crit || 0) / 100) * (1 + Math.max(0, stats.critdamage || 0) / 100);
	var hit_chance = 1 - Math.min(1, Math.max(0, stats.miss || 0) / 100);
	var damage = Math.max(0, stats.attack || 0) * Math.max(0.01, stats.frequency || 0) * critical * hit_chance;
	var healing = Math.max(0, stats.heal || 0) * Math.max(0.01, stats.frequency || 0);
	var evasion = Math.min(0.75, Math.max(0, stats.evasion || 0) / 100);
	var reflection = Math.min(0.75, Math.max(0, stats.reflection || 0) / 100);
	var hp = Math.max(1, stats.max_hp || 1);
	var physical = hp / Math.max(0.01, damage_multiplier(stats.armor || 0)) / Math.max(0.1, 1 - evasion);
	var magical = hp / Math.max(0.01, damage_multiplier(stats.resistance || 0)) / Math.max(0.1, 1 - reflection);
	return {
		damage_per_second: Math.round(damage * 100) / 100,
		healing_per_second: Math.round(healing * 100) / 100,
		physical_effective_hp: Math.round(physical),
		magical_effective_hp: Math.round(magical),
		effective_hp: Math.round(Math.sqrt(physical * magical)),
		mobility: Math.max(1, stats.speed || 1),
		mana_capacity: Math.max(1, stats.max_mp || 1) / Math.max(1, stats.mp_cost || 1),
		gold_multiplier: Math.max(0.01, stats.goldm || 1),
		luck_multiplier: Math.max(0.01, stats.luckm || 1),
		xp_multiplier: Math.max(0.01, stats.xpm || 1),
	};
}

function progression_objective_value(metrics, objective) {
	var damage = Math.max(0.01, metrics.damage_per_second);
	var survival = Math.max(1, metrics.effective_hp);
	var mobility = Math.max(1, metrics.mobility);
	var mana = Math.max(0.01, metrics.mana_capacity);
	if (objective === "damage") return damage;
	if (objective === "survival") return survival;
	if (objective === "support")
		return Math.max(0.01, metrics.healing_per_second) * Math.pow(survival, 0.12) * Math.pow(mana, 0.08);
	if (objective === "gold") return damage * metrics.gold_multiplier * Math.pow(survival, 0.1);
	if (objective === "luck") return damage * metrics.luck_multiplier * Math.pow(survival, 0.1);
	if (objective === "xp") return damage * metrics.xp_multiplier * Math.pow(survival, 0.1);
	return damage * Math.pow(survival, 0.18) * Math.pow(mobility, 0.12) * Math.pow(mana, 0.05);
}

function progression_compare(base, candidate, objective) {
	var base_metrics = progression_metrics(base);
	var candidate_metrics = progression_metrics(candidate);
	var before = progression_objective_value(base_metrics, objective);
	var after = progression_objective_value(candidate_metrics, objective);
	var delta = {};
	for (var i = 0; i < PROGRESSION_STAT_FIELDS.length; i++) {
		var name = PROGRESSION_STAT_FIELDS[i];
		var difference = Math.round(((candidate[name] || 0) - (base[name] || 0)) * 10000) / 10000;
		if (difference) delta[name] = difference;
	}
	return {
		improvement_percent: Math.round((after / Math.max(0.0001, before) - 1) * 100 * 100) / 100,
		metrics: candidate_metrics,
		stat_delta: delta,
	};
}

function progression_item_mechanics(item) {
	var def = item && G.items[item.name];
	if (!def) return [];
	var result = [];
	["ability", "aura", "set", "projectile"].forEach(function (name) {
		if (def[name]) result.push(name + ":" + def[name]);
	});
	if (
		def.attr0 !== undefined ||
		(def.upgrade && def.upgrade.attr0 !== undefined) ||
		(def.compound && def.compound.attr0 !== undefined)
	)
		result.push("special_scaling");
	return result;
}

function progression_candidate_slots(player, item) {
	var def = G.items[item.name];
	var class_def = G.classes[player.type];
	if (!def || !class_def || (Array.isArray(def.class) && !def.class.includes(player.type))) return [];
	var placements = [];
	if (def.type === "ring") placements = [{ slot: "ring1" }, { slot: "ring2" }];
	else if (def.type === "earring") placements = [{ slot: "earring1" }, { slot: "earring2" }];
	if (["shield", "source", "quiver", "misc_offhand"].includes(def.type)) {
		var main_def = player.slots.mainhand && G.items[player.slots.mainhand.name];
		if ((class_def.offhand || {})[def.type] && !(main_def && (class_def.doublehand || {})[main_def.wtype]))
			placements = [{ slot: "offhand" }];
	}
	if (["weapon", "tool"].includes(def.type)) {
		var weapon_type = def.wtype || def.type;
		if ((class_def.mainhand || {})[weapon_type]) placements.push({ slot: "mainhand" });
		if ((class_def.doublehand || {})[weapon_type]) placements.push({ slot: "mainhand", unequip: ["offhand"] });
		var current_main = player.slots.mainhand && G.items[player.slots.mainhand.name];
		if ((class_def.offhand || {})[weapon_type] && !(current_main && (class_def.doublehand || {})[current_main.wtype]))
			placements.push({ slot: "offhand" });
	}
	if (!placements.length && character_slots.includes(def.type)) placements = [{ slot: def.type }];
	return placements.filter(function (placement) {
		var simulated = Object.assign({}, player, { slots: Object.assign({}, player.slots || {}) });
		for (var i = 0; i < (placement.unequip || []).length; i++) simulated.slots[placement.unequip[i]] = null;
		return can_equip_item(simulated, def, placement.slot) === placement.slot;
	});
}

function progression_stat_target(player, objective) {
	if (objective === "survival") return "vit";
	if (objective === "support") return "int";
	return (G.classes[player.type] && G.classes[player.type].main_stat) || "vit";
}

function progression_owned_counts(player, request) {
	var counts = {};
	function add(name, quantity) {
		if (typeof name !== "string" || !/^[A-Za-z0-9_]{1,100}$/.test(name) || !G.items[name] || name === "placeholder")
			return;
		quantity = Math.trunc(progression_number(quantity, 1, Number.MAX_SAFE_INTEGER) || 1);
		counts[name] = Math.min(Number.MAX_SAFE_INTEGER, (counts[name] || 0) + quantity);
	}
	for (var i = 0; i < player.items.length; i++) if (player.items[i]) add(player.items[i].name, player.items[i].q);
	if (Array.isArray(request.holdings)) {
		for (var i = 0; i < Math.min(request.holdings.length, 1000); i++) {
			var holding = request.holdings[i];
			if (holding && typeof holding === "object" && !Array.isArray(holding)) add(holding.name, holding.q);
		}
	}
	return counts;
}

function progression_analyze(player, request) {
	var objective = PROGRESSION_OBJECTIVES.includes(request.objective) ? request.objective : "balanced_farming";
	var base_player = progression_clone_player(player, player.slots);
	var base_stats = progression_stats(base_player);
	var base_metrics = progression_metrics(base_stats);
	var owned_counts = progression_owned_counts(player, request);
	var candidates = [];
	for (var i = 0; i < player.items.length; i++) {
		var inventory_item = progression_item_for_stats(player.items[i]);
		if (inventory_item) candidates.push({ source: "inventory:" + i, item: inventory_item });
	}
	if (Array.isArray(request.candidates)) {
		for (var i = 0; i < Math.min(request.candidates.length, 600); i++) {
			var candidate = request.candidates[i];
			var item = candidate && progression_item_for_stats(candidate.item);
			if (
				!item ||
				typeof candidate.source !== "string" ||
				!/^bank:items(?:[0-9]|[1-3][0-9]|4[0-7]):(?:[0-9]|[1-3][0-9]|4[01])$/.test(candidate.source)
			)
				continue;
			candidates.push({ source: candidate.source, item: item });
		}
	}
	var seen = {};
	var equip = [];
	for (var i = 0; i < candidates.length; i++) {
		var candidate = candidates[i];
		if (candidate.item.b) continue;
		var signature = progression_item_signature(candidate.item);
		if (!signature || seen[signature]) continue;
		seen[signature] = true;
		var placements = progression_candidate_slots(player, candidate.item);
		for (var j = 0; j < placements.length; j++) {
			var placement = placements[j];
			if (
				progression_item_signature(player.slots[placement.slot]) === signature &&
				!(placement.unequip && placement.unequip.length)
			)
				continue;
			var slots = JSON.parse(JSON.stringify(player.slots || {}));
			for (var k = 0; k < (placement.unequip || []).length; k++) slots[placement.unequip[k]] = null;
			slots[placement.slot] = candidate.item;
			var simulated = progression_stats(progression_clone_player(player, slots));
			var comparison = progression_compare(base_stats, simulated, objective);
			if (comparison.improvement_percent <= 0.2) continue;
			var current = progression_item(player.slots[placement.slot]);
			equip.push({
				action: "equip",
				source: candidate.source,
				slot: placement.slot,
				item: progression_item(candidate.item),
				replaces: current,
				unequip: placement.unequip || [],
				improvement_percent: comparison.improvement_percent,
				stat_delta: comparison.stat_delta,
				metrics: comparison.metrics,
				mechanics_review: Array.from(
					new Set(progression_item_mechanics(candidate.item).concat(progression_item_mechanics(current))),
				),
			});
		}
	}
	equip.sort(function (a, b) {
		return b.improvement_percent - a.improvement_percent;
	});
	var best_by_slot = {};
	for (var i = 0; i < equip.length; i++) if (!best_by_slot[equip[i].slot]) best_by_slot[equip[i].slot] = equip[i];

	var stat_scrolls = [];
	var target_stat = progression_stat_target(player, objective);
	var upgrades = [];
	for (var i = 0; i < character_slots.length; i++) {
		var slot = character_slots[i];
		var equipped = progression_item_for_stats(player.slots[slot]);
		var def = equipped && G.items[equipped.name];
		if (!equipped || !def) continue;
		if (def.stat && equipped.stat_type !== target_stat && !equipped.l) {
			var stat_item = Object.assign({}, equipped, { stat_type: target_stat });
			var stat_slots = JSON.parse(JSON.stringify(player.slots || {}));
			stat_slots[slot] = stat_item;
			var stat_comparison = progression_compare(
				base_stats,
				progression_stats(progression_clone_player(player, stat_slots)),
				objective,
			);
			var grade = Math.max(0, Math.min(6, calculate_item_grade(def, equipped)));
			var quantities = [1, 10, 100, 1000, 9999, 9999, 9999];
			if (stat_comparison.improvement_percent > 0.2)
				stat_scrolls.push({
					action: equipped.stat_type ? "replace_stat" : "apply_stat",
					slot: slot,
					item: progression_item(equipped),
					stat: target_stat,
					scroll: target_stat + "scroll",
					quantity: quantities[grade],
					materials: {
						scroll: target_stat + "scroll",
						required: quantities[grade],
						owned: owned_counts[target_stat + "scroll"] || 0,
						ready: (owned_counts[target_stat + "scroll"] || 0) >= quantities[grade],
					},
					improvement_percent: stat_comparison.improvement_percent,
					stat_delta: stat_comparison.stat_delta,
					base_chance: 0.99999,
					live_preview_required: true,
					risk: "rare_destructive_failure_and_consumes_stat_scrolls",
				});
		}
		if (def.upgrade && !equipped.l) {
			var new_level = (equipped.level || 0) + 1;
			var grade = calculate_item_grade(def, equipped);
			if (grade !== 4 && D.upgrades[def.igrade] && D.upgrades[def.igrade][new_level] !== undefined) {
				var upgraded_item = Object.assign({}, equipped, { level: new_level });
				var upgraded_slots = JSON.parse(JSON.stringify(player.slots || {}));
				upgraded_slots[slot] = upgraded_item;
				var upgrade_comparison = progression_compare(
					base_stats,
					progression_stats(progression_clone_player(player, upgraded_slots)),
					objective,
				);
				if (upgrade_comparison.improvement_percent > 0.2) {
					var scroll = "scroll" + Math.max(0, Math.min(2, grade));
					upgrades.push({
						action: "upgrade",
						slot: slot,
						item: progression_item(equipped),
						to_level: new_level,
						scroll: scroll,
						materials: {
							scroll: scroll,
							required: 1,
							owned: owned_counts[scroll] || 0,
							ready: (owned_counts[scroll] || 0) >= 1,
						},
						base_chance: D.upgrades[def.igrade][new_level],
						live_preview_required: true,
						improvement_percent: upgrade_comparison.improvement_percent,
						stat_delta: upgrade_comparison.stat_delta,
						risk: "destructive_on_failure",
					});
				}
			}
		}
	}
	stat_scrolls.sort(function (a, b) {
		return b.improvement_percent - a.improvement_percent;
	});
	upgrades.sort(function (a, b) {
		return b.improvement_percent - a.improvement_percent;
	});

	var snapshot = {
		character: player.real_id,
		cid: player.cid,
		objective: objective,
		equipment: progression_equipment(player.slots),
		inventory: candidates.map(function (candidate) {
			return { source: candidate.source, signature: progression_item_signature(candidate.item) };
		}),
		holdings: owned_counts,
	};
	return {
		success: true,
		source: "live_game_server",
		observed_at: new Date().toISOString(),
		snapshot_id: progression_crypto
			.createHash("sha256")
			.update(JSON.stringify(snapshot), "utf8")
			.digest("hex")
			.slice(0, 32),
		character: player.name,
		character_id: player.real_id,
		class: player.type,
		level: player.level,
		objective: objective,
		current: {
			equipment: progression_equipment(player.slots),
			stats: base_stats,
			metrics: base_metrics,
			context: {
				map: player.map || null,
				party: player.party || null,
				conditions: Object.keys(player.s || {})
					.sort()
					.slice(0, 50),
				targets: {
					players: Number(player.targets_p) || 0,
					monsters: Number(player.targets_m) || 0,
					mixed: Number(player.targets_u) || 0,
				},
			},
		},
		recommendations: {
			equip: Object.keys(best_by_slot)
				.map(function (slot) {
					return best_by_slot[slot];
				})
				.sort(function (a, b) {
					return b.improvement_percent - a.improvement_percent;
				}),
			stat_scrolls: stat_scrolls,
			upgrades: upgrades,
		},
		policy: {
			read_only: true,
			equipment_changes_are_reversible: true,
			stat_scrolls_require_approval: true,
			upgrades_require_authoritative_live_preview_and_approval: true,
			compounds_not_planned_yet: true,
		},
		limitations: [
			"Objective scoring uses authoritative final stats but does not fully value tactical abilities, proc timing, consumable scarcity, or a specific target's defenses.",
			"The comparison includes current conditions, party bonuses, fear, and map effects; re-run it when the live context changes.",
			"Equipment recommendations compare one owned item replacement at a time; they are not a combinatorial full-build search.",
			"Recommendations with mechanics_review need human or higher-level game analysis before execution.",
		],
	};
}

server_api.post("/progression", function (req, res) {
	if (req.body.spass !== keys.ACCESS_MASTER) return res.status(403).send({ failed: true, reason: "unauthorized" });
	var request;
	try {
		request = JSON.parse(req.body.data || "{}");
	} catch (e) {
		return res.status(400).send({ failed: true, reason: "invalid_request" });
	}
	if (
		!request ||
		typeof request !== "object" ||
		Array.isArray(request) ||
		!["bank", "analyze"].includes(request.operation)
	)
		return res.status(400).send({ failed: true, reason: "invalid_request" });
	var player = progression_find_player(request);
	if (!player) return res.status(404).send({ failed: true, reason: "character_not_live" });
	try {
		if (request.operation === "bank") return res.status(200).send(progression_bank_snapshot(player));
		return res.status(200).send(progression_analyze(player, request));
	} catch (e) {
		log_trace("progression_api", e);
		return res.status(500).send({ failed: true, reason: "progression_failed" });
	}
});
