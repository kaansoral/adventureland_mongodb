// Samaritan is an MCP starter for an adventuring character.
// Edit only this settings object. Destructive item work is disabled by default.
if (typeof SAMARITAN_SETTINGS === "undefined") {
	var SAMARITAN_SETTINGS = {
		enabled: true,
		trustedCharacters: [],
		party: {
			leader: "",
			members: [],
			acceptFrom: [],
			inviteMembers: true,
		},
		farm: {
			monster: "auto",
			candidates: ["goo", "bee", "crab", "squig", "snake", "croc", "armadillo", "scorpion", "spider", "boar", "tortoise", "porcupine", "poisio"],
			fallbackMonster: "goo",
			fallbackAfterDeathMs: 15 * 60 * 1000,
			reevaluateMs: 5 * 60 * 1000,
			maximumHitsToKill: 18,
			maximumMonsterAttackRatio: 0.16,
		},
		combat: {
			retreatHpRatio: 0.28,
			potionHpRatio: 0.72,
			potionMpRatio: 0.35,
			kite: true,
			attackTaggedMonsters: false,
		},
		support: {
			healNearbyPlayers: true,
			healBelowRatio: 0.62,
			buffNearbyPlayers: true,
		},
		supplies: {
			enabled: true,
			minimumIntervalMs: 60 * 1000,
			goldReserve: 10000,
			items: [
				{ name: "hpot0", minimum: 100, target: 200, maximumPurchase: 200 },
				{ name: "mpot0", minimum: 100, target: 200, maximumPurchase: 200 },
			],
		},
		bank: {
			enabled: true,
			pack: "items0",
			minimumIntervalMs: 15 * 60 * 1000,
			gold: { enabled: true, keep: 100000, depositAbove: 250000 },
			deposit: [],
			// Example: {name:"gem0", keep:2, maxLevel:0, maxItemValue:50000}
		},
		upgrade: {
			enabled: false,
			buyScrolls: false,
			goldReserve: 100000,
			maximumAttemptsPerSession: 3,
			rules: [],
			// Example: {name:"coat", maxLevel:3, maxItemValue:20000}
		},
		compound: {
			enabled: false,
			buyScrolls: false,
			goldReserve: 100000,
			maximumAttemptsPerSession: 2,
			rules: [],
			// Example: {name:"ringsj", maxLevel:2, keep:0, maxItemValue:20000}
		},
	};
}

mode_resolve_all();

var SAMARITAN_STATE = {
	farm: null,
	farmChosenAt: 0,
	combatBusy: false,
	maintenanceBusy: false,
	traveling: false,
	lastBankAt: 0,
	lastSupplyAt: 0,
	banking: false,
	bankRetryAt: 0,
	lastPartyAt: 0,
	lastRetreatAt: 0,
	lastRespawnAt: 0,
	lastLeaveAt: 0,
	deathHandled: false,
	upgradeAttempts: 0,
	compoundAttempts: 0,
	temporaryFarm: null,
	temporaryFarmUntil: 0,
	travelRetryAt: 0,
	lastMoveAt: 0,
	moveAttempts: 0,
	movingTarget: null,
	blockedTargets: {},
	logs: {},
};

function samaritanLog(key, message, interval) {
	var now = Date.now();
	if (SAMARITAN_STATE.logs[key] && now - SAMARITAN_STATE.logs[key] < (interval || 30000)) return;
	SAMARITAN_STATE.logs[key] = now;
	game_log("Samaritan: " + message);
}

function samaritanFailure(result) {
	return !!(result && (result.failed || result.success === false));
}

async function samaritanCall(label, operation) {
	try {
		var result = await operation();
		if (samaritanFailure(result) && !["cooldown", "full", "safety", "nothing_to_loot"].includes(result.reason))
			samaritanLog(label, label + " failed: " + (result.reason || "unknown"), 60000);
		return result;
	} catch (error) {
		samaritanLog(label, label + " failed: " + (error.reason || error.message || error), 60000);
		return { failed: true, reason: error.reason || error.message || String(error) };
	}
}

function samaritanCharacterType() {
	return character.ctype || character.type || "unknown";
}

function samaritanTrustedNames() {
	var names = [character.name]
		.concat(SAMARITAN_SETTINGS.trustedCharacters || [])
		.concat((SAMARITAN_SETTINGS.party && SAMARITAN_SETTINGS.party.members) || [])
		.concat((SAMARITAN_SETTINGS.party && SAMARITAN_SETTINGS.party.acceptFrom) || []);
	if (SAMARITAN_SETTINGS.party && SAMARITAN_SETTINGS.party.leader) names.push(SAMARITAN_SETTINGS.party.leader);
	return Array.from(new Set(names.filter(Boolean)));
}

function samaritanIsTrusted(name) {
	return samaritanTrustedNames().includes(name);
}

function on_party_request(name) {
	if (samaritanIsTrusted(name)) samaritanCall("party request", function () { return accept_party_request(name); });
}

function on_party_invite(name) {
	if (samaritanIsTrusted(name)) samaritanCall("party invite", function () { return accept_party_invite(name); });
}

function on_cm(name, message) {
	if (!samaritanIsTrusted(name) || !message || message.type !== "samaritan") return;
	if (message.action === "farm" && typeof message.monster === "string" && G.monsters[message.monster]) {
		SAMARITAN_STATE.temporaryFarm = message.monster;
		SAMARITAN_STATE.temporaryFarmUntil = Date.now() + Math.min(Math.max(Number(message.ms) || 300000, 30000), 1800000);
	}
	if (message.action === "status") {
		samaritanCall("status response", function () {
			return send_cm(name, {
				type: "samaritan",
				action: "status",
				character: character.name,
				farm: SAMARITAN_STATE.farm,
				map: character.map,
				x: character.x,
				y: character.y,
				hp: character.hp,
				max_hp: character.max_hp,
				rip: !!character.rip,
			});
		});
	}
}

function samaritanUseDeathFallback() {
	var fallback = SAMARITAN_SETTINGS.farm.fallbackMonster;
	if (fallback && samaritanMonsterAvailable(fallback)) {
		SAMARITAN_STATE.temporaryFarm = fallback;
		SAMARITAN_STATE.temporaryFarmUntil = Date.now() + Math.max(60000, Number(SAMARITAN_SETTINGS.farm.fallbackAfterDeathMs) || 0);
		SAMARITAN_STATE.blockedTargets = {};
		SAMARITAN_STATE.movingTarget = null;
		SAMARITAN_STATE.moveAttempts = 0;
		samaritanLog("death fallback", "switching to " + fallback + " after a death", 1000);
	}
}

function handle_death(data) {
	var deadName = data && (data.id || data.name);
	if (deadName && deadName !== character.id && deadName !== character.name) return;
	SAMARITAN_STATE.deathHandled = true;
	samaritanUseDeathFallback();
}

function samaritanPartyNames() {
	var result = samaritanTrustedNames();
	var current = get_party();
	if (current && typeof current === "object") result = result.concat(Object.keys(current));
	return Array.from(new Set(result.filter(Boolean)));
}

function samaritanPartyTick() {
	if (!SAMARITAN_SETTINGS.party || Date.now() - SAMARITAN_STATE.lastPartyAt < 30000) return;
	SAMARITAN_STATE.lastPartyAt = Date.now();
	var leader = SAMARITAN_SETTINGS.party.leader;
	if (leader && leader !== character.name && !character.party)
		return samaritanCall("party request", function () { return send_party_request(leader); });
	if (leader === character.name && SAMARITAN_SETTINGS.party.inviteMembers) {
		for (var name of SAMARITAN_SETTINGS.party.members || []) {
			if (name !== character.name && (!get_player(name) || get_player(name).party !== character.party)) {
				samaritanCall("party invite", function () { return send_party_invite(name); });
				break;
			}
		}
	}
}

function samaritanMonsterAvailable(type) {
	if (!G.monsters[type]) return false;
	for (var mapName in G.maps) {
		var map = G.maps[mapName];
		if (map.ignore || map.instance) continue;
		for (var pack of map.monsters || []) if (pack.type === type) return true;
	}
	return false;
}

function samaritanMonsterScore(type) {
	var monster = G.monsters[type];
	if (!monster || !samaritanMonsterAvailable(type)) return -Infinity;
	if (monster.cooperative || monster.stationary || monster.rage || monster.special || monster.boss) return -Infinity;
	var characterAttack = Math.max(1, Number(character.attack) || 1);
	var characterHp = Math.max(1, Number(character.max_hp) || 1);
	var hits = Math.max(1, Number(monster.hp) || 1) / characterAttack;
	var classRisk = { merchant: 0.6, priest: 0.85, mage: 1, ranger: 1.05, rogue: 0.95, warrior: 1.25, paladin: 1.2 }[samaritanCharacterType()] || 0.8;
	var maximumAttack = characterHp * SAMARITAN_SETTINGS.farm.maximumMonsterAttackRatio * classRisk;
	if ((Number(monster.attack) || 0) > maximumAttack) return -Infinity;
	if (hits > SAMARITAN_SETTINGS.farm.maximumHitsToKill * classRisk) return -Infinity;
	var reward = (Number(monster.xp) || 1) + (Number(monster.gold) || 0) / 4;
	var danger = 1 + hits + ((Number(monster.attack) || 0) * 8) / characterHp;
	return reward / danger;
}

function samaritanChooseFarm(force) {
	if (SAMARITAN_STATE.temporaryFarm && Date.now() < SAMARITAN_STATE.temporaryFarmUntil) return SAMARITAN_STATE.temporaryFarm;
	if (SAMARITAN_STATE.temporaryFarm) {
		SAMARITAN_STATE.temporaryFarm = null;
		SAMARITAN_STATE.temporaryFarmUntil = 0;
	}
	if (!force && SAMARITAN_STATE.farm && Date.now() - SAMARITAN_STATE.farmChosenAt < SAMARITAN_SETTINGS.farm.reevaluateMs) return SAMARITAN_STATE.farm;
	if (SAMARITAN_SETTINGS.farm.monster !== "auto" && samaritanMonsterAvailable(SAMARITAN_SETTINGS.farm.monster)) {
		SAMARITAN_STATE.farm = SAMARITAN_SETTINGS.farm.monster;
	} else {
		var scored = (SAMARITAN_SETTINGS.farm.candidates || [])
			.map(function (type) { return { type: type, score: samaritanMonsterScore(type) }; })
			.filter(function (entry) { return Number.isFinite(entry.score); })
			.sort(function (left, right) { return right.score - left.score; });
		SAMARITAN_STATE.farm = scored.length ? scored[0].type : samaritanMonsterAvailable("goo") ? "goo" : null;
	}
	SAMARITAN_STATE.farmChosenAt = Date.now();
	if (SAMARITAN_STATE.farm) samaritanLog("farm", "farming " + SAMARITAN_STATE.farm, 1000);
	return SAMARITAN_STATE.farm;
}

function samaritanVisiblePlayers() {
	return Object.values(parent.entities || {}).filter(function (entity) {
		return entity && entity.type === "character" && entity.visible !== false && !entity.rip && !entity.npc;
	});
}

function samaritanFriendlyTargets() {
	var partyNames = samaritanPartyNames();
	return [character].concat(samaritanVisiblePlayers()).filter(function (entity) {
		return entity === character || partyNames.includes(entity.name) || SAMARITAN_SETTINGS.support.healNearbyPlayers;
	});
}

function samaritanSkillReady(name, target) {
	var skill = G.skills[name];
	if (!skill || !can_use(name)) return false;
	if (skill.level && Number(character.level) < skill.level) return false;
	if (skill.mp && Number(character.mp) < skill.mp) return false;
	if (target && skill.range && distance(character, target) > skill.range) return false;
	return true;
}

async function samaritanSupport() {
	var type = samaritanCharacterType();
	if (type === "priest") {
		var healTarget = samaritanFriendlyTargets()
			.filter(function (entity) { return entity.max_hp && entity.hp / entity.max_hp < SAMARITAN_SETTINGS.support.healBelowRatio; })
			.sort(function (left, right) { return left.hp / left.max_hp - right.hp / right.max_hp; })[0];
		if (healTarget && can_heal(healTarget)) return samaritanCall("heal", function () { return heal(healTarget); });
		var injuredParty = samaritanFriendlyTargets().filter(function (entity) { return entity.max_hp && entity.hp / entity.max_hp < 0.82; });
		if (injuredParty.length >= 2 && samaritanSkillReady("partyheal")) return samaritanCall("partyheal", function () { return use_skill("partyheal"); });
	}
	if (type === "paladin" && character.max_hp && character.hp / character.max_hp < 0.68 && samaritanSkillReady("selfheal"))
		return samaritanCall("selfheal", function () { return use_skill("selfheal"); });
	if (type === "merchant" && SAMARITAN_SETTINGS.support.buffNearbyPlayers) {
		var luckTarget = [character].concat(samaritanVisiblePlayers()).filter(function (entity) {
			return (!entity.s || !entity.s.mluck || entity.s.mluck.ms < 30000) && distance(character, entity) <= 300;
		})[0];
		if (luckTarget && samaritanSkillReady("mluck", luckTarget)) return samaritanCall("mluck", function () { return use_skill("mluck", luckTarget); });
	}
	if (type === "mage") {
		var energyTarget = samaritanVisiblePlayers().filter(function (entity) {
			return samaritanIsTrusted(entity.name) && entity.max_mp && entity.mp / entity.max_mp < 0.35 && distance(character, entity) <= 300;
		})[0];
		if (energyTarget && samaritanSkillReady("energize", energyTarget)) {
			var amount = Math.min(200, Math.max(1, character.mp - Math.ceil(character.max_mp * 0.45)));
			if (amount > 0) return samaritanCall("energize", function () { return use_skill("energize", energyTarget, amount); });
		}
	}
	if (type === "rogue" && SAMARITAN_SETTINGS.support.buffNearbyPlayers) {
		var speedTarget = [character].concat(samaritanVisiblePlayers()).filter(function (entity) {
			return samaritanIsTrusted(entity.name) && (!entity.s || !entity.s.rspeed || entity.s.rspeed.ms < 30000) && distance(character, entity) <= 300;
		})[0];
		if (speedTarget && samaritanSkillReady("rspeed", speedTarget)) return samaritanCall("rspeed", function () { return use_skill("rspeed", speedTarget); });
	}
}

function samaritanEligibleMonster(entity, farm) {
	if (!entity || entity.type !== "monster" || entity.visible === false || entity.dead || entity.rip || entity.mtype !== farm || samaritanTargetBlocked(entity)) return false;
	if (SAMARITAN_SETTINGS.combat.attackTaggedMonsters) return true;
	return !entity.target || samaritanIsTrusted(entity.target);
}

function samaritanFindTarget(farm) {
	return Object.values(parent.entities || {})
		.filter(function (entity) { return samaritanEligibleMonster(entity, farm); })
		.sort(function (left, right) {
			var leftTrusted = left.target && samaritanIsTrusted(left.target) ? 0 : 1;
			var rightTrusted = right.target && samaritanIsTrusted(right.target) ? 0 : 1;
			return leftTrusted - rightTrusted || distance(character, left) - distance(character, right);
		})[0] || null;
}

function samaritanTargetBlocked(entity) {
	if (!entity || !entity.id) return false;
	var until = Number(SAMARITAN_STATE.blockedTargets[entity.id]) || 0;
	if (until <= Date.now()) {
		delete SAMARITAN_STATE.blockedTargets[entity.id];
		return false;
	}
	return true;
}

function samaritanFindImmediateThreat() {
	var protectedNames = samaritanPartyNames();
	var protectionRange = Math.max(320, (Number(character.range) || 0) * 2);
	return Object.values(parent.entities || {})
		.filter(function (entity) {
			return entity && entity.type === "monster" && entity.visible !== false && !entity.dead && !entity.rip && !samaritanTargetBlocked(entity) && protectedNames.includes(entity.target) && distance(character, entity) <= protectionRange;
		})
		.sort(function (left, right) {
			var leftPriority = left.target === character.name ? 0 : 1;
			var rightPriority = right.target === character.name ? 0 : 1;
			return leftPriority - rightPriority || distance(character, left) - distance(character, right);
		})[0] || null;
}

function samaritanThreatTooDangerous(entity) {
	var monster = entity && G.monsters[entity.mtype];
	if (!monster) return false;
	var maximumHits = SAMARITAN_SETTINGS.farm.maximumHitsToKill;
	var hitsToKill = (Number(monster.hp) || Number(entity.hp) || 1) / Math.max(1, Number(character.attack) || 1);
	return (Number(monster.attack) || 0) > Math.max(1, Number(character.max_hp) || 1) * 0.28 || hitsToKill > maximumHits * 1.5;
}

function samaritanWeaponType() {
	var weapon = character.slots && character.slots.mainhand;
	return weapon && G.items[weapon.name] && G.items[weapon.name].wtype;
}

async function samaritanCombatSkill(target, farm) {
	var type = samaritanCharacterType();
	if (type === "warrior") {
		if (target.target && target.target !== character.name && samaritanSkillReady("taunt", target) && character.hp / character.max_hp > 0.7)
			return samaritanCall("taunt", function () { return use_skill("taunt", target); });
		if (character.party && (!character.s || !character.s.warcry) && samaritanSkillReady("warcry"))
			return samaritanCall("warcry", function () { return use_skill("warcry"); });
	}
	if (type === "ranger") {
		var targets = Object.values(parent.entities || {}).filter(function (entity) {
			return samaritanEligibleMonster(entity, farm) && is_in_range(entity, "3shot");
		});
		if (targets.length >= 3 && character.hp / character.max_hp > 0.8 && samaritanSkillReady("3shot"))
			return samaritanCall("3shot", function () { return use_skill("3shot", targets.slice(0, 3)); });
		if (target.hp > character.attack * 1.4 && samaritanSkillReady("supershot", target))
			return samaritanCall("supershot", function () { return use_skill("supershot", target); });
	}
	if (type === "rogue") {
		var weaponType = samaritanWeaponType();
		if (weaponType === "dagger" && samaritanSkillReady("quickstab", target))
			return samaritanCall("quickstab", function () { return use_skill("quickstab", target); });
		if (weaponType === "fist" && samaritanSkillReady("quickpunch", target))
			return samaritanCall("quickpunch", function () { return use_skill("quickpunch", target); });
	}
	if (type === "mage" && character.max_mp && character.mp / character.max_mp > 0.82 && target.hp <= character.mp * 0.5 && samaritanSkillReady("burst", target))
		return samaritanCall("burst", function () { return use_skill("burst", target); });
	if (type === "priest" && character.party && (!character.s || !character.s.darkblessing) && samaritanSkillReady("darkblessing"))
		return samaritanCall("darkblessing", function () { return use_skill("darkblessing"); });
	if (type === "paladin" && target.hp > 2000 && samaritanSkillReady("purify", target))
		return samaritanCall("purify", function () { return use_skill("purify", target); });
}

function samaritanMoveForCombat(target) {
	var now = Date.now();
	if (SAMARITAN_STATE.movingTarget !== target.id) {
		SAMARITAN_STATE.movingTarget = target.id;
		SAMARITAN_STATE.moveAttempts = 0;
	}
	if (SAMARITAN_STATE.moveAttempts >= 6) {
		SAMARITAN_STATE.blockedTargets[target.id] = now + 15000;
		SAMARITAN_STATE.movingTarget = null;
		SAMARITAN_STATE.moveAttempts = 0;
		return change_target(null);
	}
	if (now - SAMARITAN_STATE.lastMoveAt < 1000) return null;
	SAMARITAN_STATE.lastMoveAt = now;
	SAMARITAN_STATE.moveAttempts++;
	var ranged = ["mage", "priest", "ranger"].includes(samaritanCharacterType()) || Number(character.range) > 100;
	var currentDistance = distance(character, target);
	var preferred = ranged && SAMARITAN_SETTINGS.combat.kite ? Math.max(80, Number(character.range) * 0.72) : Math.max(10, Number(character.range) * 0.65);
	if (ranged && currentDistance < preferred * 0.55) {
		var length = Math.max(1, currentDistance);
		var retreat = {
			x: character.x + ((character.x - target.x) / length) * Math.min(80, preferred),
			y: character.y + ((character.y - target.y) / length) * Math.min(80, preferred),
		};
		if (!can_move_to(retreat)) {
			SAMARITAN_STATE.blockedTargets[target.id] = now + 30000;
			SAMARITAN_STATE.movingTarget = null;
			SAMARITAN_STATE.moveAttempts = 0;
			return change_target(null);
		}
		return move(retreat);
	}
	if (currentDistance > preferred) {
		var ratio = Math.max(0, (currentDistance - preferred * 0.85) / currentDistance);
		var approach = { x: character.x + (target.x - character.x) * ratio, y: character.y + (target.y - character.y) * ratio };
		if (!can_move_to(approach)) {
			SAMARITAN_STATE.blockedTargets[target.id] = now + 30000;
			SAMARITAN_STATE.movingTarget = null;
			SAMARITAN_STATE.moveAttempts = 0;
			return change_target(null);
		}
		return move(approach);
	}
	return null;
}

function samaritanTravelToFarm(farm) {
	if (!farm || Date.now() < SAMARITAN_STATE.travelRetryAt || SAMARITAN_STATE.traveling || smart.moving || is_moving(character)) return;
	SAMARITAN_STATE.traveling = true;
	smart_move(farm)
		.then(function () { SAMARITAN_STATE.travelRetryAt = 0; })
		.catch(function (error) {
			var reason = error.reason || error.message || String(error);
			SAMARITAN_STATE.travelRetryAt = Date.now() + (reason === "map_route_not_found" ? 2 * 60 * 1000 : 20000);
			samaritanLog("travel", "travel failed: " + reason, 60000);
		})
		.finally(function () { SAMARITAN_STATE.traveling = false; });
}

function samaritanSafeItem(item, rule) {
	if (!item || item.name !== rule.name || item.l || item.p || item.stat_type) return false;
	if (!Number.isFinite(Number(rule.maxItemValue)) || Number(rule.maxItemValue) <= 0) return false;
	return item_value(item) <= Number(rule.maxItemValue);
}

function samaritanFindUpgrade() {
	if (!SAMARITAN_SETTINGS.upgrade.enabled || SAMARITAN_STATE.upgradeAttempts >= SAMARITAN_SETTINGS.upgrade.maximumAttemptsPerSession) return null;
	for (var rule of SAMARITAN_SETTINGS.upgrade.rules || []) {
		if (!Number.isSafeInteger(rule.maxLevel) || rule.maxLevel < 1) continue;
		for (var i = 0; i < character.items.length; i++) {
			var item = character.items[i];
			if (samaritanSafeItem(item, rule) && (Number(item.level) || 0) < rule.maxLevel) return { index: i, item: item, rule: rule };
		}
	}
	return null;
}

function samaritanFindCompound() {
	if (!SAMARITAN_SETTINGS.compound.enabled || SAMARITAN_STATE.compoundAttempts >= SAMARITAN_SETTINGS.compound.maximumAttemptsPerSession) return null;
	for (var rule of SAMARITAN_SETTINGS.compound.rules || []) {
		if (!Number.isSafeInteger(rule.maxLevel) || rule.maxLevel < 1) continue;
		var groups = {};
		for (var i = 0; i < character.items.length; i++) {
			var item = character.items[i];
			if (!samaritanSafeItem(item, rule) || (Number(item.level) || 0) >= rule.maxLevel) continue;
			var level = Number(item.level) || 0;
			groups[level] = groups[level] || [];
			groups[level].push(i);
		}
		var levels = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
		for (var level of levels) if (groups[level].length >= 3 + Math.max(0, Number(rule.keep) || 0)) return { indexes: groups[level].slice(0, 3), level: level, rule: rule };
	}
	return null;
}

function samaritanScrollName(prefix, item) {
	var grade = item_grade(item);
	return prefix + Math.max(0, Math.min(2, grade));
}

async function samaritanEnsureScroll(scrollName, settings) {
	var index = locate_item(scrollName);
	if (index >= 0) return index;
	if (!settings.buyScrolls || !G.items[scrollName] || character.gold - Number(G.items[scrollName].g || 0) < settings.goldReserve) return -1;
	if (character.map !== "main" || distance(character, { x: -465, y: -71 }) > 120) {
		await samaritanCall("scroll travel", function () { return smart_move("scrolls"); });
		return -1;
	}
	await samaritanCall("buy scroll", function () { return buy_with_gold(scrollName, 1); });
	return locate_item(scrollName);
}

function samaritanFindSupplyPurchase() {
	var settings = SAMARITAN_SETTINGS.supplies || {};
	if (!settings.enabled || Date.now() - SAMARITAN_STATE.lastSupplyAt < Math.max(10000, Number(settings.minimumIntervalMs) || 0)) return null;
	var reserve = Math.max(0, Number(settings.goldReserve) || 0);
	for (var rule of settings.items || []) {
		if (!rule || typeof rule.name !== "string" || !G.items[rule.name] || !Number.isSafeInteger(rule.minimum) || rule.minimum < 0 || !Number.isSafeInteger(rule.target) || rule.target < rule.minimum || !Number.isSafeInteger(rule.maximumPurchase) || rule.maximumPurchase < 1) continue;
		var current = quantity(rule.name);
		if (current >= rule.minimum) continue;
		var price = Number(G.items[rule.name].g) || 0;
		if (price <= 0) continue;
		var affordable = Math.max(0, Math.floor((Number(character.gold) - reserve) / price));
		var amount = Math.min(rule.target - current, rule.maximumPurchase, affordable);
		if (amount > 0) return { name: rule.name, quantity: amount };
	}
	return null;
}

function samaritanGoldDepositAmount() {
	var settings = SAMARITAN_SETTINGS.bank || {};
	var gold = settings.gold || {};
	if (!settings.enabled || !gold.enabled || Date.now() < SAMARITAN_STATE.bankRetryAt || (!SAMARITAN_STATE.banking && Date.now() - SAMARITAN_STATE.lastBankAt < settings.minimumIntervalMs)) return 0;
	var keep = Math.max(0, Math.floor(Number(gold.keep) || 0));
	var trigger = Math.max(keep, Math.floor(Number(gold.depositAbove) || 0));
	if (Number(character.gold) <= trigger) return 0;
	return Math.max(0, Math.floor(Number(character.gold) - keep));
}

function samaritanFindBankDeposit() {
	if (!SAMARITAN_SETTINGS.bank.enabled || Date.now() < SAMARITAN_STATE.bankRetryAt || (!SAMARITAN_STATE.banking && Date.now() - SAMARITAN_STATE.lastBankAt < SAMARITAN_SETTINGS.bank.minimumIntervalMs)) return null;
	for (var rule of SAMARITAN_SETTINGS.bank.deposit || []) {
		var total = quantity(rule.name);
		var keep = Math.max(0, Number(rule.keep) || 0);
		for (var i = 0; i < character.items.length; i++) {
			var item = character.items[i];
			var count = item && (item.q || 1);
			if (samaritanSafeItem(item, rule) && total - count >= keep && (rule.maxLevel === undefined || (Number(item.level) || 0) <= rule.maxLevel))
				return { index: i, rule: rule };
		}
	}
	return null;
}

async function samaritanMaintenance() {
	if (SAMARITAN_STATE.maintenanceBusy || SAMARITAN_STATE.combatBusy || character.rip) return;
	var supplyWork = samaritanFindSupplyPurchase();
	var upgradeWork = samaritanFindUpgrade();
	var compoundWork = samaritanFindCompound();
	var goldToDeposit = samaritanGoldDepositAmount();
	var bankWork = samaritanFindBankDeposit();
	if (SAMARITAN_STATE.banking && !goldToDeposit && !bankWork) {
		SAMARITAN_STATE.banking = false;
		SAMARITAN_STATE.lastBankAt = Date.now();
	}
	if (!supplyWork && !upgradeWork && !compoundWork && !goldToDeposit && !bankWork) return;
	SAMARITAN_STATE.maintenanceBusy = true;
	try {
		if (smart.moving) stop("smart");
		if (supplyWork) {
			var supplyTravel = await samaritanCall("supply travel", function () { return smart_move(supplyWork.name); });
			if (samaritanFailure(supplyTravel)) return;
			var supplyPurchase = await samaritanCall("buy supplies", function () { return buy_with_gold(supplyWork.name, supplyWork.quantity); });
			if (!samaritanFailure(supplyPurchase)) SAMARITAN_STATE.lastSupplyAt = Date.now();
			return;
		}
		if (upgradeWork || compoundWork) {
			if (character.map !== "main" || distance(character, { x: -204, y: -129 }) > 140) {
				await samaritanCall("upgrade travel", function () { return smart_move("upgrade"); });
				return;
			}
			if (upgradeWork) {
				var upgradeIndex = character.items.findIndex(function (item) { return item === upgradeWork.item; });
				if (upgradeIndex < 0) return;
				var upgradeScrollName = samaritanScrollName("scroll", character.items[upgradeIndex]);
				var upgradeScroll = await samaritanEnsureScroll(upgradeScrollName, SAMARITAN_SETTINGS.upgrade);
				if (upgradeScroll < 0) return;
				SAMARITAN_STATE.upgradeAttempts++;
				await samaritanCall("upgrade", function () { return upgrade(upgradeIndex, upgradeScroll); });
				return;
			}
			var currentIndexes = samaritanFindCompound();
			if (!currentIndexes) return;
			var compoundScrollName = samaritanScrollName("cscroll", character.items[currentIndexes.indexes[0]]);
			var compoundScroll = await samaritanEnsureScroll(compoundScrollName, SAMARITAN_SETTINGS.compound);
			if (compoundScroll < 0) return;
			SAMARITAN_STATE.compoundAttempts++;
			await samaritanCall("compound", function () { return compound(currentIndexes.indexes[0], currentIndexes.indexes[1], currentIndexes.indexes[2], compoundScroll); });
			return;
		}
		if (!character.bank) {
			SAMARITAN_STATE.banking = true;
			var bankTravel = await samaritanCall("bank travel", function () { return smart_move("bank"); });
			if (samaritanFailure(bankTravel)) {
				SAMARITAN_STATE.banking = false;
				SAMARITAN_STATE.bankRetryAt = Date.now() + (bankTravel.reason === "bank_busy" ? 60000 : 20000);
			}
			return;
		}
		SAMARITAN_STATE.banking = true;
		goldToDeposit = samaritanGoldDepositAmount();
		if (goldToDeposit > 0) {
			await samaritanCall("bank gold", function () { return bank_deposit(goldToDeposit); });
			return;
		}
		bankWork = samaritanFindBankDeposit();
		if (!bankWork) return;
		await samaritanCall("bank store", function () { return bank_store(bankWork.index, SAMARITAN_SETTINGS.bank.pack); });
	} finally {
		SAMARITAN_STATE.maintenanceBusy = false;
	}
}

async function samaritanCombatTick() {
	if (!SAMARITAN_SETTINGS.enabled || SAMARITAN_STATE.combatBusy || SAMARITAN_STATE.maintenanceBusy) return;
	SAMARITAN_STATE.combatBusy = true;
	try {
		if (character.rip) {
			if (!SAMARITAN_STATE.deathHandled) {
				SAMARITAN_STATE.deathHandled = true;
				samaritanUseDeathFallback();
			}
			if (smart.moving) stop("smart");
			if (Date.now() - SAMARITAN_STATE.lastRespawnAt > 5000) {
				SAMARITAN_STATE.lastRespawnAt = Date.now();
				await samaritanCall("respawn", function () { return respawn(); });
			}
			return;
		}
		SAMARITAN_STATE.deathHandled = false;
		if (character.map === "jail" || character.map === "cyberland") {
			if (smart.moving) stop("smart");
			if (Date.now() - SAMARITAN_STATE.lastLeaveAt > 10000) {
				SAMARITAN_STATE.lastLeaveAt = Date.now();
				await samaritanCall("leave", function () { return leave(); });
			}
			return;
		}
		if (is_transporting(character)) return;
		samaritanPartyTick();
		if (character.max_hp && character.hp / character.max_hp < SAMARITAN_SETTINGS.combat.potionHpRatio) await samaritanCall("potion", function () { return use_hp_or_mp(); });
		else if (character.max_mp && character.mp / character.max_mp < SAMARITAN_SETTINGS.combat.potionMpRatio) await samaritanCall("potion", function () { return use_hp_or_mp(); });
		var supportResult = await samaritanSupport();
		if (supportResult && !samaritanFailure(supportResult)) {
			await samaritanCall("loot", function () { return loot(); });
			return;
		}
		if (character.max_hp && character.hp / character.max_hp < SAMARITAN_SETTINGS.combat.retreatHpRatio) {
			if (Date.now() - SAMARITAN_STATE.lastRetreatAt > 12000) {
				SAMARITAN_STATE.lastRetreatAt = Date.now();
				await samaritanCall("retreat", function () { return town(); });
			}
			return;
		}
		var farm = samaritanChooseFarm(false);
		var immediateThreat = samaritanFindImmediateThreat();
		if (immediateThreat && samaritanThreatTooDangerous(immediateThreat)) {
			if (Date.now() - SAMARITAN_STATE.lastRetreatAt > 12000) {
				SAMARITAN_STATE.lastRetreatAt = Date.now();
				await samaritanCall("danger retreat", function () { return town(); });
			}
			return;
		}
		var target = immediateThreat || samaritanFindTarget(farm);
		if (!target) {
			if (get_target()) await samaritanCall("clear target", function () { return change_target(null); });
			samaritanTravelToFarm(farm);
			await samaritanCall("loot", function () { return loot(); });
			return;
		}
		if (smart.moving) stop("smart");
		if (get_target() !== target) await samaritanCall("target", function () { return change_target(target); });
		var skillResult = await samaritanCombatSkill(target, target.mtype || farm);
		if (skillResult && !samaritanFailure(skillResult)) {
			SAMARITAN_STATE.movingTarget = null;
			SAMARITAN_STATE.moveAttempts = 0;
			await samaritanCall("loot", function () { return loot(); });
			return;
		}
		if (can_attack(target)) {
			SAMARITAN_STATE.movingTarget = null;
			SAMARITAN_STATE.moveAttempts = 0;
			await samaritanCall("attack", function () { return attack(target); });
		}
		else await samaritanCall("combat move", function () { return samaritanMoveForCombat(target); });
		await samaritanCall("loot", function () { return loot(); });
	} finally {
		SAMARITAN_STATE.combatBusy = false;
	}
}

if (SAMARITAN_SETTINGS.enabled) {
	samaritanChooseFarm(true);
	setInterval(samaritanCombatTick, 200);
	setInterval(samaritanMaintenance, 5000);
}
