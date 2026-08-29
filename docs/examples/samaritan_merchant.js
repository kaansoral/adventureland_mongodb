// Samaritan Merchant is an MCP starter for a conservative public shopkeeper.
// It never lists, sells, upgrades, compounds, retrieves, or banks an item unless
// an explicit rule below permits that exact item and bounds its value.
if (typeof SAMARITAN_MERCHANT_SETTINGS === "undefined") {
	var SAMARITAN_MERCHANT_SETTINGS = {
		enabled: true,
		trustedCharacters: [],
		party: { leader: "", acceptFrom: [] },
		support: { merchantLuck: true, buffNearbyPlayers: true },
		shop: {
			enabled: false,
			location: "main",
			listings: [],
			standPurchase: { enabled: false, name: "stand0", goldReserve: 100000, withdrawFromBank: false, maximumBankWithdrawal: 150000 },
			// Example: {name:"hpot0", level:0, keep:100, slot:1, price:45, quantity:50, maxItemValue:5000}
		},
		market: {
			enabled: false,
			minimumIntervalMs: 15 * 60 * 1000,
			goldReserve: 100000,
			maximumSpendPerSession: 50000,
			maximumPurchasesPerSession: 2,
			rules: [],
			// Example: {name:"coat", level:0, maximumUnitPrice:5000, maximumQuantity:1, maximumOwned:1, maxItemValue:10000}
		},
		bank: {
			enabled: false,
			pack: "items0",
			deposit: [],
			// Example: {name:"gem0", keep:2, maxLevel:0, maxItemValue:50000}
		},
		equipment: {
			enabled: true,
			minimumIntervalMs: 5000,
			rules: [],
			// Example: {name:"hpamulet", slot:"amulet", maxItemValue:50000}
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
		stat: {
			enabled: false,
			buyScrolls: false,
			goldReserve: 100000,
			maximumAttemptsPerSession: 2,
			rules: [],
			// Example: {name:"helmet", stat:"int", maxItemValue:20000}
		},
		npcSell: {
			enabled: false,
			rules: [],
			// Example: {name:"hpamulet", level:0, keep:1, maxItemValue:1000}
		},
	};
}

mode_resolve_all();

var SAMARITAN_MERCHANT_STATE = {
	busy: false,
	upgradeAttempts: 0,
	compoundAttempts: 0,
	statAttempts: 0,
	marketPurchases: 0,
	marketSpent: 0,
	lastMarketAt: 0,
	lastEquipmentAt: 0,
	lastPartyAt: 0,
	lastRespawnAt: 0,
	lastStandAt: 0,
	lastStandFundingAt: 0,
	lastStandPurchaseAt: 0,
	standRetryAt: 0,
	logs: {},
};

function samaritanMerchantLog(key, message, interval) {
	var now = Date.now();
	if (SAMARITAN_MERCHANT_STATE.logs[key] && now - SAMARITAN_MERCHANT_STATE.logs[key] < (interval || 30000)) return;
	SAMARITAN_MERCHANT_STATE.logs[key] = now;
	game_log("Samaritan Merchant: " + message);
}

function samaritanMerchantFailure(result) {
	return !!(result && (result.failed || result.success === false));
}

async function samaritanMerchantCall(label, operation) {
	try {
		var result = await operation();
		if (samaritanMerchantFailure(result) && !["cooldown", "full", "safety"].includes(result.reason)) samaritanMerchantLog(label, label + " failed: " + (result.reason || "unknown"), 60000);
		return result;
	} catch (error) {
		samaritanMerchantLog(label, label + " failed: " + (error.reason || error.message || error), 60000);
		return { failed: true, reason: error.reason || error.message || String(error) };
	}
}

function samaritanMerchantTrusted(name) {
	return [character.name]
		.concat(SAMARITAN_MERCHANT_SETTINGS.trustedCharacters || [])
		.concat((SAMARITAN_MERCHANT_SETTINGS.party && SAMARITAN_MERCHANT_SETTINGS.party.acceptFrom) || [])
		.concat((SAMARITAN_MERCHANT_SETTINGS.party && SAMARITAN_MERCHANT_SETTINGS.party.members) || [])
		.concat((SAMARITAN_MERCHANT_SETTINGS.party && SAMARITAN_MERCHANT_SETTINGS.party.leader) || [])
		.filter(Boolean)
		.includes(name);
}

function on_party_request(name) {
	if (samaritanMerchantTrusted(name))
		samaritanMerchantCall("party request", function () {
			return accept_party_request(name);
		});
}

function on_party_invite(name) {
	if (samaritanMerchantTrusted(name))
		samaritanMerchantCall("party invite", function () {
			return accept_party_invite(name);
		});
}

function on_cm(name, message) {
	if (!samaritanMerchantTrusted(name) || !message || message.type !== "samaritan" || message.action !== "status") return;
	samaritanMerchantCall("status response", function () {
		return send_cm(name, {
			type: "samaritan",
			action: "merchant_status",
			character: character.name,
			map: character.map,
			gold: character.gold,
			inventory: character.items.filter(Boolean).length,
		});
	});
}

function samaritanMerchantSafeItem(item, rule) {
	if (!item || item.name !== rule.name || item.l || item.p || item.stat_type) return false;
	if (!Number.isFinite(Number(rule.maxItemValue)) || Number(rule.maxItemValue) <= 0) return false;
	if (item_value(item) > Number(rule.maxItemValue)) return false;
	if (rule.level !== undefined && (Number(item.level) || 0) !== Number(rule.level)) return false;
	if (rule.maxLevel !== undefined && (Number(item.level) || 0) > Number(rule.maxLevel)) return false;
	return true;
}

function samaritanMerchantProgressItemSafe(item, rule, allowStat) {
	if (!item || item.name !== rule.name || item.l || item.p) return false;
	if (!allowStat && item.stat_type) return false;
	if (!Number.isFinite(Number(rule.maxItemValue)) || Number(rule.maxItemValue) <= 0) return false;
	if (item_value(item) > Number(rule.maxItemValue)) return false;
	if (rule.level !== undefined && (Number(item.level) || 0) !== Number(rule.level)) return false;
	return true;
}

function samaritanMerchantCanEquip(item, slot) {
	var definition = item && G.items[item.name];
	if (!definition || typeof slot !== "string" || !slot) return false;
	var type = character.ctype || character.type || "merchant";
	if (Array.isArray(definition.class) && !definition.class.includes(type)) return false;
	var classDefinition = G.classes && G.classes[type];
	if (definition.type === "ring") return slot === "ring1" || slot === "ring2";
	if (definition.type === "earring") return slot === "earring1" || slot === "earring2";
	if (["shield", "source", "quiver", "misc_offhand"].includes(definition.type)) return slot === "offhand" && !!(classDefinition && classDefinition.offhand && classDefinition.offhand[definition.type]);
	if (["weapon", "tool"].includes(definition.type)) {
		var weaponType = definition.wtype || definition.type;
		if (slot === "offhand") return !!(classDefinition && classDefinition.offhand && classDefinition.offhand[weaponType]);
		return slot === "mainhand" && !!(classDefinition && ((classDefinition.mainhand && classDefinition.mainhand[weaponType]) || (classDefinition.doublehand && classDefinition.doublehand[weaponType])));
	}
	return definition.type === slot;
}

function samaritanMerchantEquipmentScore(item) {
	if (!item || !G.items[item.name]) return -Infinity;
	var definition = G.items[item.name];
	var level = Math.max(0, Number(item.level) || 0);
	var score = 0;
	for (var stat of ["attack", "armor", "resistance", "hp", "mp", "speed", "range", "int", "vit", "stat"]) {
		var value = Number(definition[stat]) || 0;
		var growth = definition.upgrade && (Number(definition.upgrade[stat]) || 0);
		var weight = stat === "attack" ? 8 : ["int", "stat"].includes(stat) ? 6 : ["armor", "resistance"].includes(stat) ? 2 : 1;
		score += (value + growth * level) * weight;
	}
	if (item.stat_type === "int") score += 25;
	return score;
}

function samaritanMerchantFindEquipment() {
	var settings = SAMARITAN_MERCHANT_SETTINGS.equipment || {};
	if (!settings.enabled || Date.now() - SAMARITAN_MERCHANT_STATE.lastEquipmentAt < Math.max(1000, Number(settings.minimumIntervalMs) || 0)) return null;
	for (var rule of settings.rules || []) {
		if (!rule || typeof rule.name !== "string" || typeof rule.slot !== "string") continue;
		var candidates = [];
		for (var i = 0; i < character.items.length; i++) {
			var item = character.items[i];
			if (samaritanMerchantProgressItemSafe(item, rule, true) && samaritanMerchantCanEquip(item, rule.slot)) candidates.push({ index: i, item: item });
		}
		if (!candidates.length) continue;
		candidates.sort(function (a, b) {
			return samaritanMerchantEquipmentScore(b.item) - samaritanMerchantEquipmentScore(a.item);
		});
		var equipped = character.slots && character.slots[rule.slot];
		if (equipped && equipped.name === rule.name && samaritanMerchantEquipmentScore(equipped) >= samaritanMerchantEquipmentScore(candidates[0].item)) continue;
		return { index: candidates[0].index, slot: rule.slot, item: candidates[0].item, rule: rule };
	}
	return null;
}

function samaritanMerchantInventoryMatches(rule) {
	var result = [];
	for (var i = 0; i < character.items.length; i++) if (samaritanMerchantSafeItem(character.items[i], rule)) result.push(i);
	return result;
}

function samaritanMerchantCount(rule) {
	return samaritanMerchantInventoryMatches(rule).reduce(function (total, index) {
		return total + (character.items[index].q || 1);
	}, 0);
}

function samaritanMerchantValidListingRule(rule) {
	return !!(
		rule &&
		typeof rule.name === "string" &&
		rule.name &&
		Number.isSafeInteger(rule.level) &&
		rule.level >= 0 &&
		Number.isSafeInteger(rule.keep) &&
		rule.keep >= 0 &&
		Number.isSafeInteger(rule.slot) &&
		rule.slot >= 1 &&
		rule.slot <= 16 &&
		Number.isSafeInteger(rule.price) &&
		rule.price > 0 &&
		Number.isSafeInteger(rule.quantity) &&
		rule.quantity > 0 &&
		Number.isFinite(Number(rule.maxItemValue)) &&
		Number(rule.maxItemValue) > 0
	);
}

function samaritanMerchantFindListing() {
	if (!SAMARITAN_MERCHANT_SETTINGS.shop.enabled) return null;
	for (var rule of SAMARITAN_MERCHANT_SETTINGS.shop.listings || []) {
		if (!samaritanMerchantValidListingRule(rule)) continue;
		var tradeSlot = "trade" + rule.slot;
		if (character.slots && character.slots[tradeSlot]) continue;
		var keep = Math.max(0, Number(rule.keep) || 0);
		var available = samaritanMerchantCount(rule) - keep;
		if (available <= 0) continue;
		for (var index of samaritanMerchantInventoryMatches(rule)) {
			var count = character.items[index].q || 1;
			var quantityToList = Math.min(count, available, Math.max(1, Number(rule.quantity) || 1));
			if (quantityToList > 0) return { index: index, quantity: quantityToList, rule: rule };
		}
	}
	return null;
}

function samaritanMerchantFindNpcSale() {
	if (!SAMARITAN_MERCHANT_SETTINGS.npcSell.enabled) return null;
	for (var rule of SAMARITAN_MERCHANT_SETTINGS.npcSell.rules || []) {
		if (!rule || !Number.isSafeInteger(rule.level) || rule.level < 0 || !Number.isSafeInteger(rule.keep) || rule.keep < 0 || !Number.isSafeInteger(rule.quantity) || rule.quantity < 1) continue;
		var keep = Math.max(0, Number(rule.keep) || 0);
		var available = samaritanMerchantCount(rule) - keep;
		if (available <= 0) continue;
		for (var index of samaritanMerchantInventoryMatches(rule)) {
			var count = character.items[index].q || 1;
			var quantityToSell = Math.min(count, available, Math.max(1, Number(rule.quantity) || 1));
			if (quantityToSell > 0) return { index: index, quantity: quantityToSell, rule: rule };
		}
	}
	return null;
}

function samaritanMerchantFindBankDeposit() {
	if (!SAMARITAN_MERCHANT_SETTINGS.bank.enabled) return null;
	for (var rule of SAMARITAN_MERCHANT_SETTINGS.bank.deposit || []) {
		var keep = Math.max(0, Number(rule.keep) || 0);
		var total = samaritanMerchantCount(rule);
		for (var index of samaritanMerchantInventoryMatches(rule)) {
			var count = character.items[index].q || 1;
			if (total - count >= keep) return { index: index, rule: rule };
		}
	}
	return null;
}

function samaritanMerchantFindBankItem(rule) {
	if (!character.bank) return null;
	var matches = [];
	for (var pack in character.bank) {
		if (!Array.isArray(character.bank[pack])) continue;
		for (var i = 0; i < character.bank[pack].length; i++) {
			var item = character.bank[pack][i];
			if (samaritanMerchantSafeItem(item, rule)) matches.push({ pack: pack, index: i, item: item });
		}
	}
	var keepInBank = Math.max(0, Number(rule.keepInBank) || 0);
	return matches.length > keepInBank ? matches[0] : null;
}

function samaritanMerchantFindRetrieval() {
	if (!character.bank || !SAMARITAN_MERCHANT_SETTINGS.shop.enabled) return null;
	for (var rule of SAMARITAN_MERCHANT_SETTINGS.shop.listings || []) {
		if (!samaritanMerchantValidListingRule(rule)) continue;
		var tradeSlot = "trade" + rule.slot;
		if (character.slots && character.slots[tradeSlot]) continue;
		if (samaritanMerchantCount(rule) > Math.max(0, Number(rule.keep) || 0)) continue;
		var bankItem = samaritanMerchantFindBankItem(rule);
		if (bankItem) return { bank: bankItem, rule: rule };
	}
	return null;
}

function samaritanMerchantFindUpgrade() {
	if (!SAMARITAN_MERCHANT_SETTINGS.upgrade.enabled || SAMARITAN_MERCHANT_STATE.upgradeAttempts >= SAMARITAN_MERCHANT_SETTINGS.upgrade.maximumAttemptsPerSession) return null;
	for (var rule of SAMARITAN_MERCHANT_SETTINGS.upgrade.rules || []) {
		if (!Number.isSafeInteger(rule.maxLevel) || rule.maxLevel < 1) continue;
		for (var index of samaritanMerchantInventoryMatches(rule)) {
			if ((Number(character.items[index].level) || 0) < rule.maxLevel) return { index: index, item: character.items[index], rule: rule };
		}
		if (rule.includeEquipped !== false)
			for (var slot in character.slots || {}) {
				var equipped = character.slots[slot];
				if (samaritanMerchantSafeItem(equipped, rule) && (Number(equipped.level) || 0) < rule.maxLevel) return { slot: slot, item: equipped, rule: rule };
			}
	}
	return null;
}

function samaritanMerchantFindStat() {
	var settings = SAMARITAN_MERCHANT_SETTINGS.stat || {};
	if (!settings.enabled || SAMARITAN_MERCHANT_STATE.statAttempts >= settings.maximumAttemptsPerSession) return null;
	for (var rule of settings.rules || []) {
		if (!rule || !["str", "dex", "int", "vit"].includes(rule.stat)) continue;
		for (var i = 0; i < character.items.length; i++) {
			var item = character.items[i];
			if (samaritanMerchantProgressItemSafe(item, rule, false) && G.items[item.name] && G.items[item.name].stat) return { index: i, item: item, rule: rule };
		}
		if (rule.includeEquipped !== false)
			for (var slot in character.slots || {}) {
				var equipped = character.slots[slot];
				if (samaritanMerchantProgressItemSafe(equipped, rule, false) && G.items[equipped.name] && G.items[equipped.name].stat) return { slot: slot, item: equipped, rule: rule };
			}
	}
	return null;
}

function samaritanMerchantValidMarketRule(rule) {
	return !!(
		rule &&
		typeof rule.name === "string" &&
		rule.name &&
		Number.isSafeInteger(rule.level) &&
		rule.level >= 0 &&
		Number.isSafeInteger(rule.maximumUnitPrice) &&
		rule.maximumUnitPrice > 0 &&
		Number.isSafeInteger(rule.maximumQuantity) &&
		rule.maximumQuantity > 0 &&
		Number.isSafeInteger(rule.maximumOwned) &&
		rule.maximumOwned > 0 &&
		Number.isFinite(Number(rule.maxItemValue)) &&
		Number(rule.maxItemValue) > 0
	);
}

function samaritanMerchantFindMarketPurchase() {
	var settings = SAMARITAN_MERCHANT_SETTINGS.market || {};
	if (!settings.enabled || SAMARITAN_MERCHANT_STATE.marketPurchases >= settings.maximumPurchasesPerSession) return null;
	if (Date.now() - SAMARITAN_MERCHANT_STATE.lastMarketAt < Math.max(60000, Number(settings.minimumIntervalMs) || 0)) return null;
	var budget = Math.min(
		Math.max(0, Number(settings.maximumSpendPerSession) - SAMARITAN_MERCHANT_STATE.marketSpent),
		Math.max(0, Number(character.gold) - Math.max(0, Number(settings.goldReserve) || 0)),
	);
	if (budget <= 0) return null;
	for (var seller of Object.values(parent.entities || {})) {
		if (!seller || seller.type !== "character" || seller.npc || seller.rip || seller.visible === false || seller.id === character.id || seller.name === character.name) continue;
		for (var rule of settings.rules || []) {
			if (!samaritanMerchantValidMarketRule(rule) || quantity(rule.name) >= rule.maximumOwned) continue;
			for (var slot in seller.slots || {}) {
				if (!/^trade(?:[1-9]|1[0-6])$/.test(slot)) continue;
				var listing = seller.slots[slot];
				if (!listing || listing.b || listing.giveaway || listing.l || listing.p || listing.stat_type || listing.name !== rule.name || (Number(listing.level) || 0) !== rule.level) continue;
				var price = Number(listing.price);
				if (!Number.isSafeInteger(price) || price <= 0 || price > rule.maximumUnitPrice) continue;
				if (item_value({ name: listing.name, level: listing.level || 0 }) > Number(rule.maxItemValue)) continue;
				var quantityToBuy = Math.min(Number(listing.q) || 1, rule.maximumQuantity, rule.maximumOwned - quantity(rule.name), Math.floor(budget / price));
				if (quantityToBuy > 0) return { seller: seller, slot: slot, quantity: quantityToBuy, price: price, total: price * quantityToBuy, rule: rule };
			}
		}
	}
	return null;
}

function samaritanMerchantFindCompound() {
	if (!SAMARITAN_MERCHANT_SETTINGS.compound.enabled || SAMARITAN_MERCHANT_STATE.compoundAttempts >= SAMARITAN_MERCHANT_SETTINGS.compound.maximumAttemptsPerSession) return null;
	for (var rule of SAMARITAN_MERCHANT_SETTINGS.compound.rules || []) {
		if (!Number.isSafeInteger(rule.maxLevel) || rule.maxLevel < 1) continue;
		var groups = {};
		for (var index of samaritanMerchantInventoryMatches(rule)) {
			var level = Number(character.items[index].level) || 0;
			if (level >= rule.maxLevel) continue;
			groups[level] = groups[level] || [];
			groups[level].push(index);
		}
		var levels = Object.keys(groups)
			.map(Number)
			.sort(function (a, b) {
				return a - b;
			});
		for (var level of levels) if (groups[level].length >= 3 + Math.max(0, Number(rule.keep) || 0)) return { indexes: groups[level].slice(0, 3), rule: rule };
	}
	return null;
}

function samaritanMerchantScroll(prefix, item) {
	return prefix + Math.max(0, Math.min(2, item_grade(item)));
}

async function samaritanMerchantEnsureScroll(name, settings) {
	var index = locate_item(name);
	if (index >= 0) return index;
	if (!settings.buyScrolls || !G.items[name] || character.gold - Number(G.items[name].g || 0) < settings.goldReserve) return -1;
	if (character.map !== "main" || distance(character, { x: -465, y: -71 }) > 120) {
		await samaritanMerchantCall("scroll travel", function () {
			return smart_move("scrolls");
		});
		return -1;
	}
	await samaritanMerchantCall("buy scroll", function () {
		return buy_with_gold(name, 1);
	});
	return locate_item(name);
}

function samaritanMerchantSkillReady(name, target) {
	var skill = G.skills[name];
	if (!skill || !can_use(name)) return false;
	if (skill.level && Number(character.level) < skill.level) return false;
	if (skill.mp && Number(character.mp) < skill.mp) return false;
	if (target && skill.range && distance(character, target) > skill.range) return false;
	return true;
}

async function samaritanMerchantSupport() {
	if (!SAMARITAN_MERCHANT_SETTINGS.support.merchantLuck || !SAMARITAN_MERCHANT_SETTINGS.support.buffNearbyPlayers || !samaritanMerchantSkillReady("mluck")) return;
	var targets = [character].concat(
		Object.values(parent.entities || {}).filter(function (entity) {
			return entity && entity.type === "character" && entity.visible !== false && !entity.rip && !entity.npc;
		}),
	);
	var target = targets.filter(function (entity) {
		return (!entity.s || !entity.s.mluck || entity.s.mluck.ms < 30000) && distance(character, entity) <= 300;
	})[0];
	if (target)
		return samaritanMerchantCall("mluck", function () {
			return use_skill("mluck", target);
		});
}

function samaritanMerchantPartyTick() {
	var leader = SAMARITAN_MERCHANT_SETTINGS.party && SAMARITAN_MERCHANT_SETTINGS.party.leader;
	var current = get_party() || {};
	if (!leader || leader === character.name || character.party || Object.prototype.hasOwnProperty.call(current, character.name) || Date.now() - SAMARITAN_MERCHANT_STATE.lastPartyAt < 30000) return;
	SAMARITAN_MERCHANT_STATE.lastPartyAt = Date.now();
	samaritanMerchantCall("party request", function () {
		return send_party_request(leader);
	});
}

function samaritanMerchantAtShop() {
	var location = SAMARITAN_MERCHANT_SETTINGS.shop.location;
	if (!location) return true;
	if (typeof location === "string") return character.map === location;
	if (location.map && character.map !== location.map) return false;
	if (Number.isFinite(Number(location.x)) && Number.isFinite(Number(location.y))) return distance(character, location) <= Math.max(20, Number(location.radius) || 80);
	return true;
}

function samaritanMerchantStandIndex() {
	return character.items.findIndex(function (item) {
		return item && G.items[item.name] && G.items[item.name].stand;
	});
}

async function samaritanMerchantEnsureStand() {
	if (samaritanMerchantStandIndex() >= 0) return true;
	if (Date.now() - SAMARITAN_MERCHANT_STATE.lastStandPurchaseAt < 30000) return false;
	var settings = SAMARITAN_MERCHANT_SETTINGS.shop.standPurchase || {};
	var item = G.items[settings.name];
	if (!settings.enabled || !item || !item.stand || !Number.isFinite(Number(settings.goldReserve)) || Number(settings.goldReserve) < 0) return false;
	if (!Number.isFinite(Number(item.g)) || Number(item.g) <= 0) return false;
	if (Date.now() < SAMARITAN_MERCHANT_STATE.standRetryAt) return false;
	var needed = Math.max(0, Math.ceil(Number(item.g) + Number(settings.goldReserve) - Number(character.gold)));
	if (needed > 0) {
		if (!settings.withdrawFromBank || !Number.isSafeInteger(settings.maximumBankWithdrawal) || needed > settings.maximumBankWithdrawal) return false;
		if (!character.bank) {
			if (Date.now() - SAMARITAN_MERCHANT_STATE.lastStandFundingAt < 30000) return false;
			SAMARITAN_MERCHANT_STATE.lastStandFundingAt = Date.now();
			await samaritanMerchantCall("stand funding travel", function () {
				return smart_move("bank");
			});
			return false;
		}
		var withdrawal = await samaritanMerchantCall("stand funding", function () {
			return bank_withdraw(needed);
		});
		if (!samaritanMerchantFailure(withdrawal)) SAMARITAN_MERCHANT_STATE.lastStandFundingAt = Date.now();
		return false;
	}
	var travel = await samaritanMerchantCall("stand travel", function () {
		return smart_move(settings.name);
	});
	if (samaritanMerchantFailure(travel)) {
		SAMARITAN_MERCHANT_STATE.standRetryAt = Date.now() + 60000;
		return false;
	}
	SAMARITAN_MERCHANT_STATE.standRetryAt = 0;
	var purchase = await samaritanMerchantCall("buy stand", function () {
		return buy_with_gold(settings.name, 1);
	});
	if (!samaritanMerchantFailure(purchase)) SAMARITAN_MERCHANT_STATE.lastStandPurchaseAt = Date.now();
	return false;
}

async function samaritanMerchantWork() {
	if (!SAMARITAN_MERCHANT_SETTINGS.enabled || SAMARITAN_MERCHANT_STATE.busy) return;
	SAMARITAN_MERCHANT_STATE.busy = true;
	try {
		if (character.rip) {
			if (Date.now() - SAMARITAN_MERCHANT_STATE.lastRespawnAt > 5000) {
				SAMARITAN_MERCHANT_STATE.lastRespawnAt = Date.now();
				await samaritanMerchantCall("respawn", function () {
					return respawn();
				});
			}
			return;
		}
		if (character.max_hp && character.hp / character.max_hp < 0.7)
			await samaritanMerchantCall("potion", function () {
				return use_hp_or_mp();
			});
		samaritanMerchantPartyTick();
		var supportResult = await samaritanMerchantSupport();
		if (supportResult && !samaritanMerchantFailure(supportResult)) return;
		if (SAMARITAN_MERCHANT_SETTINGS.shop.enabled && samaritanMerchantStandIndex() < 0 && SAMARITAN_MERCHANT_SETTINGS.shop.standPurchase && SAMARITAN_MERCHANT_SETTINGS.shop.standPurchase.enabled) {
			await samaritanMerchantEnsureStand();
			return;
		}
		var upgradeWork = samaritanMerchantFindUpgrade();
		var compoundWork = samaritanMerchantFindCompound();
		var statWork = samaritanMerchantFindStat();
		var equipmentWork = samaritanMerchantFindEquipment();
		if (upgradeWork || compoundWork || statWork) {
			var equippedWork = upgradeWork && upgradeWork.slot ? upgradeWork : statWork && statWork.slot ? statWork : null;
			if (equippedWork) {
				await samaritanMerchantCall("unequip progression item", function () {
					return unequip(equippedWork.slot);
				});
				return;
			}
			if (character.map !== "main" || distance(character, { x: -204, y: -129 }) > 140) {
				await samaritanMerchantCall("upgrade travel", function () {
					return smart_move("upgrade");
				});
				return;
			}
			if (upgradeWork) {
				var itemIndex = character.items.findIndex(function (item) {
					return item === upgradeWork.item;
				});
				if (itemIndex < 0) return;
				var upgradeScroll = await samaritanMerchantEnsureScroll(samaritanMerchantScroll("scroll", character.items[itemIndex]), SAMARITAN_MERCHANT_SETTINGS.upgrade);
				if (upgradeScroll < 0) return;
				SAMARITAN_MERCHANT_STATE.upgradeAttempts++;
				await samaritanMerchantCall("upgrade", function () {
					return upgrade(itemIndex, upgradeScroll);
				});
				return;
			}
			if (statWork) {
				var statIndex = character.items.findIndex(function (item) {
					return item === statWork.item;
				});
				if (statIndex < 0) return;
				var statScroll = await samaritanMerchantEnsureScroll(statWork.rule.stat + "scroll", SAMARITAN_MERCHANT_SETTINGS.stat);
				if (statScroll < 0) return;
				SAMARITAN_MERCHANT_STATE.statAttempts++;
				await samaritanMerchantCall("apply stat", function () {
					return upgrade(statIndex, statScroll);
				});
				return;
			}
			compoundWork = samaritanMerchantFindCompound();
			if (!compoundWork) return;
			var compoundScroll = await samaritanMerchantEnsureScroll(samaritanMerchantScroll("cscroll", character.items[compoundWork.indexes[0]]), SAMARITAN_MERCHANT_SETTINGS.compound);
			if (compoundScroll < 0) return;
			SAMARITAN_MERCHANT_STATE.compoundAttempts++;
			await samaritanMerchantCall("compound", function () {
				return compound(compoundWork.indexes[0], compoundWork.indexes[1], compoundWork.indexes[2], compoundScroll);
			});
			return;
		}
		if (equipmentWork) {
			await samaritanMerchantCall("equip upgrade", function () {
				return equip(equipmentWork.index, equipmentWork.slot);
			});
			SAMARITAN_MERCHANT_STATE.lastEquipmentAt = Date.now();
			return;
		}
		var bankDeposit = samaritanMerchantFindBankDeposit();
		var needsRetrieval =
			SAMARITAN_MERCHANT_SETTINGS.shop.enabled &&
			(SAMARITAN_MERCHANT_SETTINGS.shop.listings || []).some(function (rule) {
				return samaritanMerchantCount(rule) <= Math.max(0, Number(rule.keep) || 0);
			});
		if ((bankDeposit || needsRetrieval) && !character.bank) {
			await samaritanMerchantCall("bank travel", function () {
				return smart_move("bank");
			});
			return;
		}
		if (character.bank) {
			var retrieval = samaritanMerchantFindRetrieval();
			if (retrieval) {
				await samaritanMerchantCall("bank retrieve", function () {
					return bank_retrieve(retrieval.bank.pack, retrieval.bank.index);
				});
				return;
			}
			bankDeposit = samaritanMerchantFindBankDeposit();
			if (bankDeposit) {
				await samaritanMerchantCall("bank store", function () {
					return bank_store(bankDeposit.index, SAMARITAN_MERCHANT_SETTINGS.bank.pack);
				});
				return;
			}
		}
		var listing = samaritanMerchantFindListing();
		if (listing) {
			if (!samaritanMerchantAtShop()) {
				await samaritanMerchantCall("shop travel", function () {
					return smart_move(SAMARITAN_MERCHANT_SETTINGS.shop.location);
				});
				return;
			}
			await samaritanMerchantCall("list item", function () {
				return trade(listing.index, listing.rule.slot, listing.rule.price, listing.quantity);
			});
			return;
		}
		if (SAMARITAN_MERCHANT_SETTINGS.shop.enabled && !(character.stand || character.standed)) {
			if (!samaritanMerchantAtShop()) {
				await samaritanMerchantCall("shop travel", function () {
					return smart_move(SAMARITAN_MERCHANT_SETTINGS.shop.location);
				});
				return;
			}
			if (Date.now() - SAMARITAN_MERCHANT_STATE.lastStandAt > 30000) {
				SAMARITAN_MERCHANT_STATE.lastStandAt = Date.now();
				await samaritanMerchantCall("open stand", function () {
					return open_stand();
				});
			}
			return;
		}
		var marketPurchase = samaritanMerchantFindMarketPurchase();
		if (marketPurchase) {
			SAMARITAN_MERCHANT_STATE.lastMarketAt = Date.now();
			var marketResult = await samaritanMerchantCall("market purchase", function () {
				return trade_buy(marketPurchase.seller, marketPurchase.slot, marketPurchase.quantity);
			});
			if (!samaritanMerchantFailure(marketResult)) {
				SAMARITAN_MERCHANT_STATE.marketPurchases++;
				SAMARITAN_MERCHANT_STATE.marketSpent += marketPurchase.total;
			}
			return;
		}
		var npcSale = samaritanMerchantFindNpcSale();
		if (npcSale)
			await samaritanMerchantCall("npc sell", function () {
				return sell(npcSale.index, npcSale.quantity);
			});
	} finally {
		SAMARITAN_MERCHANT_STATE.busy = false;
	}
}

if (SAMARITAN_MERCHANT_SETTINGS.enabled) setInterval(samaritanMerchantWork, 1000);
