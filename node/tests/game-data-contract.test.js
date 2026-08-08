"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
	buildProgressionData,
	buildWeaponOwners,
	normalizeItems,
	loadProgressionPublication,
	validateCharacterDefinition,
	validateItemRequirements,
	validateProgressionData,
	validateRequirements,
} = require("../game/skill_domain");

const designRoot = path.resolve(__dirname, "../../design");

function loadDesign(files) {
	const context = { console, multipliers: { shells_to_gold: 1 } };
	vm.createContext(context);
	for (const file of files)
		vm.runInContext(fs.readFileSync(path.join(designRoot, file), "utf8"), context, { filename: file });
	return context;
}

function plain(value) {
	return JSON.parse(JSON.stringify(value));
}

function loadRaw() {
	return loadDesign([
		"conditions.js",
		"item_requirements.js",
		"items.js",
		"skills.js",
		"skill_xp.js",
		"abilities.js",
		"character.js",
	]);
}

function loadAll() {
	return buildProgressionData(loadRaw());
}

const equippableTypes = new Set([
	"helmet",
	"pants",
	"chest",
	"weapon",
	"amulet",
	"earring",
	"shoes",
	"gloves",
	"ring",
	"shield",
	"belt",
	"source",
	"orb",
	"quiver",
	"cape",
	"misc_offhand",
	"tool",
]);

test("real design catalogs load with the canonical registry and curve", () => {
	const data = loadAll();
	assert.doesNotThrow(() => validateProgressionData(data));
	assert.deepEqual(Object.keys(data.skills), ["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"]);
	assert.deepEqual(
		Object.values(data.skills).map((skill) => skill.name),
		["Warrior", "Paladin", "Mage", "Priest", "Ranger", "Rogue", "Merchant"],
	);
	assert.deepEqual(
		Object.values(data.skills).map((skill) => [skill.kind, skill.max_level]),
		[
			["combat", 99],
			["combat", 99],
			["combat", 99],
			["combat", 99],
			["combat", 99],
			["combat", 99],
			["noncombat", 99],
		],
	);
	assert.equal(Object.keys(data.abilities).length, 105);
	assert.equal(Object.keys(data.items).length, 529);
	assert.equal(Object.keys(data.item_requirements).length, 287);
	for (const skill of ["warrior", "paladin", "mage", "priest", "ranger", "rogue", "merchant"])
		assert.equal(data.items.tigerhelmet[skill], undefined, `normalized item retained ${skill} modifier`);
	assert.equal(data.character.appearances.length, 28);
	assert.deepEqual(plain(data.character.starter.weapons), ["blade", "mace", "staff", "wbook0", "bow", "claw"]);
	for (let level = 1; level <= 99; level += 1) {
		assert.equal(
			data.skill_xp[level],
			Math.round(900000000 * Math.pow((level - 1) / 98, 2)),
			`skill XP level ${level}`,
		);
	}
	assert.equal(data.skill_xp[1], 0);
	assert.equal(data.skill_xp[99], 900000000);
	assert.equal(data.skill_xp[20], 33829654);
	assert.equal(data.skill_xp[40], 142534361);
	assert.equal(data.skill_xp[60], 326207830);
	assert.equal(data.skill_xp[80], 584850062);
	assert.equal(data.skill_xp[90], 742284465);
});

test("the registry owns every combat weapon exactly once and keeps tools noncombat", () => {
	const data = loadAll();
	const expectedOwners = {
		short_sword: "warrior",
		sword: "warrior",
		great_sword: "warrior",
		axe: "warrior",
		spear: "warrior",
		scythe: "warrior",
		hammer: "paladin",
		mace: "paladin",
		pmace: "paladin",
		basher: "paladin",
		staff: "mage",
		great_staff: "mage",
		wand: "mage",
		wblade: "mage",
		book: "priest",
		bow: "ranger",
		crossbow: "ranger",
		dartgun: "ranger",
		fist: "rogue",
		dagger: "rogue",
		stars: "rogue",
		rapier: "rogue",
	};
	const seen = new Map();
	for (const [skill, definition] of Object.entries(data.skills)) {
		for (const weaponType of definition.weapon_types || []) {
			assert.equal(seen.has(weaponType), false, weaponType);
			seen.set(weaponType, skill);
		}
	}
	assert.deepEqual(Object.fromEntries(seen), expectedOwners);
	for (const id of ["rod", "pickaxe"])
		assert.deepEqual(plain(data.item_requirements[id]), [{ skill: "merchant", level: 16 }]);
	for (const id of ["pmace", "lmace", "pmaceofthedead"]) assert.equal(data.items[id].wtype, "pmace");
	assert.equal(data.items.pmace.name, "Paladin's Hammer");
	assert.equal(data.items.pmace.skin, "hammer");
	assert.equal(data.items.pmace.damage_type, "physical");
	assert.equal(data.items.pmace.speed, -2);
});

test("item normalization is independent, non-mutating, and precedence-safe", () => {
	const data = loadAll();
	const rawItems = {
		wbook0: { type: "source", name: "Book", compound: {} },
		wbook1: { type: "source", name: "Book 1", compound: {} },
		wbookhs: { type: "source", name: "Holiday Book", dex: 16, compound: { dex: 0 } },
		pmace: {
			type: "weapon",
			wtype: "pmace",
			name: "Paladin's Hammer",
			skin: "hammer",
			damage_type: "physical",
			speed: -2,
			class: ["priest"],
		},
		blade: { type: "weapon", wtype: "short_sword", class: ["warrior"] },
		fury: { type: "chest", tier: 3.5, upgrade: { str: 1 }, class: ["warrior"] },
		stealthcape: { type: "cape" },
		rod: { type: "tool", wtype: "rod" },
	};
	const requirements = {
		wbook0: [{ skill: "priest", level: 1 }],
		wbook1: [{ skill: "priest", level: 10 }],
		wbookhs: [{ skill: "priest", level: 40 }],
		pmace: [{ skill: "paladin", level: 40 }],
		blade: [{ skill: "warrior", level: 1 }],
		fury: [
			{ skill: "warrior", level: 20 },
			{ skill: "paladin", level: 20 },
			{ skill: "ranger", level: 20 },
			{ skill: "rogue", level: 20 },
		],
		stealthcape: [{ skill: "rogue", level: 1 }],
		rod: [{ skill: "merchant", level: 16 }],
	};
	const before = plain(rawItems);
	const normalized = normalizeItems(rawItems, requirements);
	assert.notStrictEqual(normalized, rawItems);
	assert.deepEqual(rawItems, before);
	assert.equal(normalized.wbook0.type, "weapon");
	assert.equal(normalized.wbook0.wtype, "book");
	assert.equal(normalized.wbookhs.int, 16);
	assert.equal(normalized.wbookhs.dex, undefined);
	assert.equal(normalized.wbookhs.compound.int, 0);
	assert.equal(normalized.wbookhs.compound.dex, undefined);
	assert.equal(normalized.blade.class, undefined);
	assert.deepEqual(plain(normalized.fury.requirements), requirements.fury);
	assert.doesNotThrow(() =>
		validateItemRequirements(normalized, requirements, data.skills, buildWeaponOwners(data.skills)),
	);
	assert.deepEqual(plain(normalized.stealthcape.requirements), requirements.stealthcape);
});

test("raw tier, owner, override, and hybrid sources independently produce final requirements", () => {
	const raw = loadRaw();
	const data = loadAll();
	const cases = {
		helmetsource: ["helmet", 1, [{ skill: "warrior", level: 1 }]],
		tierboundary10: ["spear", 1.25, [{ skill: "warrior", level: 10 }]],
		tierboundary20: ["xmashat", 1.5, [{ skill: "merchant", level: 20 }]],
		tierboundary30: ["weaver", 1.75, [{ skill: "ranger", level: 30 }]],
		tierboundary40: ["mageshood", 2, [{ skill: "mage", level: 40 }]],
		tierboundary50: ["mrnhat", 2.25, [{ skill: "ranger", level: 50 }]],
		tierboundary60: ["sweaterhs", 2.5, [{ skill: "merchant", level: 60 }]],
		tierboundary70: ["mcboots", 2.75, [{ skill: "merchant", level: 70 }]],
		tierboundary80: ["hhelmet", 3, [{ skill: "warrior", level: 80 }]],
		tierboundary90: ["handofmidas", 3.5, [{ skill: "merchant", level: 90 }]],
		tierboundary95: ["xhelmet", 4, [{ skill: "warrior", level: 95 }]],
		weaponowner: ["spear", 1.25, [{ skill: "warrior", level: 10 }]],
		offhandowner: ["shield", 2, [{ skill: "paladin", level: 40 }]],
		toolowner: ["rod", 1, [{ skill: "merchant", level: 16 }]],
		hybrid: [
			"fury",
			1.5,
			[
				{ skill: "warrior", level: 20 },
				{ skill: "paladin", level: 20 },
				{ skill: "ranger", level: 20 },
				{ skill: "rogue", level: 20 },
			],
		],
		curatedhybrid: [
			"starkillers",
			3,
			[
				{ skill: "mage", level: 80 },
				{ skill: "priest", level: 80 },
			],
		],
	};
	for (const [, [itemId, tier, expected]] of Object.entries(cases)) {
		assert.equal(raw.items[itemId].tier, tier, itemId);
		assert.deepEqual(plain(data.item_requirements[itemId]), expected, itemId);
		assert.deepEqual(plain(data.items[itemId].requirements), expected, itemId);
	}
	assert.equal(raw.items.mageshood.class[0], "mage");
	assert.equal(raw.items.fury.class.length, 4);
	assert.equal(raw.items.handofmidas.gold, 10);
});

test("progression validators reject every special-contract regression with diagnostics", () => {
	const data = loadAll();
	const ownerMap = buildWeaponOwners(data.skills);
	const badToolItems = plain(data.items);
	const badToolRequirements = plain(data.item_requirements);
	badToolItems.rod.requirements = [{ skill: "warrior", level: 1 }];
	badToolRequirements.rod = [{ skill: "warrior", level: 1 }];
	assert.throws(
		() => validateItemRequirements(badToolItems, badToolRequirements, data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "rod" && /Merchant level 16/.test(error.message),
	);
	const badWeaponItems = plain(data.items);
	const badWeaponRequirements = plain(data.item_requirements);
	badWeaponItems.blade.requirements.push({ skill: "paladin", level: 1 });
	badWeaponRequirements.blade.push({ skill: "paladin", level: 1 });
	assert.throws(
		() => validateItemRequirements(badWeaponItems, badWeaponRequirements, data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "blade" && /exactly/.test(error.message),
	);
	const badBookItems = plain(data.items);
	badBookItems.wbook0.type = "source";
	assert.throws(
		() => validateItemRequirements(badBookItems, plain(data.item_requirements), data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "wbook0" && /main-hand/.test(error.message),
	);
	const badPmaceItems = plain(data.items);
	badPmaceItems.pmace.name = "Priest's Mace";
	assert.throws(
		() => validateItemRequirements(badPmaceItems, plain(data.item_requirements), data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "pmace" && /pmace/.test(error.message),
	);
	const badPmaceTypeItems = plain(data.items);
	badPmaceTypeItems.pmace.type = "source";
	assert.throws(
		() => validateItemRequirements(badPmaceTypeItems, plain(data.item_requirements), data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "pmace",
	);
	const badCharacter = plain(data.character);
	badCharacter.baseline.max_hp = Infinity;
	assert.throws(
		() => validateCharacterDefinition(badCharacter, data.items),
		(error) => error.code === "invalid_game_data" && /baseline/.test(error.message),
	);
	const wrongBaseline = plain(data.character);
	wrongBaseline.baseline.max_hp = 101;
	assert.throws(
		() => validateCharacterDefinition(wrongBaseline, data.items),
		(error) => error.code === "invalid_game_data" && /baseline/.test(error.message),
	);
	const wrongAppearanceHash = plain(data.character);
	wrongAppearanceHash.appearances[0][0] = "different_skin";
	assert.throws(
		() => validateCharacterDefinition(wrongAppearanceHash, data.items),
		(error) => error.code === "invalid_game_data" && /appearances/.test(error.message),
	);
	const populatedSlots = plain(data.character);
	populatedSlots.starter.slots = { mainhand: { name: "blade" } };
	assert.throws(
		() => validateCharacterDefinition(populatedSlots, data.items),
		(error) => error.code === "invalid_game_data" && /starter/.test(error.message),
	);
	const missingStarter = plain(data.items);
	delete missingStarter.hpot0;
	assert.throws(
		() => validateCharacterDefinition(data.character, missingStarter),
		(error) => error.code === "invalid_game_data" && error.item === "hpot0",
	);
	assert.throws(
		() => normalizeItems({ wbook0: {} }, {}),
		(error) => error.code === "invalid_game_data" && error.item === "wbook1",
	);
	const duplicateStarter = plain(data.character);
	duplicateStarter.starter.weapons[0] = "mace";
	assert.throws(
		() => validateCharacterDefinition(duplicateStarter, data.items),
		(error) => error.code === "invalid_game_data" && /starter/.test(error.message),
	);
	const badConsumable = plain(data.character);
	badConsumable.starter.consumables[0].q = 201;
	assert.throws(
		() => validateCharacterDefinition(badConsumable, data.items),
		(error) => error.code === "invalid_game_data" && /starter/.test(error.message),
	);
	const badEquipment = plain(data.character);
	badEquipment.starter.equipment[0].name = "shoes";
	assert.throws(
		() => validateCharacterDefinition(badEquipment, data.items),
		(error) => error.code === "invalid_game_data" && /starter/.test(error.message),
	);
	const badAppearance = plain(data.character);
	badAppearance.appearances[0][1] = null;
	assert.throws(
		() => validateCharacterDefinition(badAppearance, data.items),
		(error) => error.code === "invalid_game_data" && /appearance/.test(error.message),
	);
	const badBookScaling = plain(data.items);
	badBookScaling.wbookhs.compound.int = 1;
	assert.throws(
		() => validateItemRequirements(badBookScaling, plain(data.item_requirements), data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "wbookhs",
	);
	assert.throws(
		() => validateRequirements("unknown_requirement", [{ skill: "missing", level: 1 }], data.skills),
		(error) =>
			error.code === "invalid_equipment_requirements" &&
			error.item === "unknown_requirement" &&
			error.skill === "missing",
	);
	const mismatchedRequirements = plain(data.items);
	mismatchedRequirements.helmet.requirements[0].level = 2;
	assert.throws(
		() => validateItemRequirements(mismatchedRequirements, plain(data.item_requirements), data.skills, ownerMap),
		(error) =>
			error.code === "invalid_game_data" && error.item === "helmet" && /normalized snapshot/.test(error.message),
	);
	const legacyClass = plain(data.items);
	legacyClass.helmet.class = ["warrior"];
	assert.throws(
		() => validateItemRequirements(legacyClass, plain(data.item_requirements), data.skills, ownerMap),
		(error) => error.code === "invalid_game_data" && error.item === "helmet" && /Legacy class/.test(error.message),
	);
	for (const [field, value] of [
		["int", 15],
		["dex", 16],
		["compound", { int: 5 }],
		["damage_type", "physical"],
		["projectile", "magic"],
	]) {
		const badBook = plain(data.items);
		if (field === "compound") badBook.wbookhs.compound = value;
		else badBook.wbookhs[field] = value;
		assert.throws(
			() => validateItemRequirements(badBook, plain(data.item_requirements), data.skills, ownerMap),
			(error) => error.code === "invalid_game_data" && error.item === "wbookhs",
		);
	}
});

test("every equippable item has the explicit all-of requirement snapshot", () => {
	const data = loadAll();
	const equippable = Object.entries(data.items).filter(([, item]) => equippableTypes.has(item.type));
	assert.equal(equippable.length, 287);
	const counts = {};
	for (const [id, item] of equippable) {
		assert.deepEqual(plain(item.requirements), plain(data.item_requirements[id]), id);
		validateRequirements(id, item.requirements, data.skills);
		const key = item.requirements.map((requirement) => requirement.skill).join("+");
		counts[key] = (counts[key] || 0) + 1;
	}
	assert.deepEqual(counts, {
		warrior: 60,
		paladin: 30,
		mage: 47,
		priest: 10,
		ranger: 38,
		rogue: 30,
		merchant: 36,
		"ranger+rogue": 6,
		"warrior+ranger": 4,
		"warrior+paladin+ranger+rogue": 1,
		"warrior+mage+ranger": 11,
		"warrior+rogue": 8,
		"mage+priest": 4,
		"mage+ranger": 2,
	});
	const snapshot = Object.fromEntries(
		Object.keys(data.item_requirements)
			.sort()
			.map((id) => [id, data.item_requirements[id]]),
	);
	assert.equal(
		crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
		"05fb878a42c85b20e0e87f10c658636e67d9e6f44a77c319f172c4f9a9efb665",
	);
	assert.deepEqual(
		Object.keys(data.item_requirements)
			.filter((id) => data.item_requirements[id].length > 1)
			.sort(),
		[
			"cdragon",
			"cring",
			"ctristone",
			"cyber",
			"ecape",
			"eears",
			"epyjamas",
			"eslippers",
			"fallen",
			"fierygloves",
			"fury",
			"goldenpowerglove",
			"mbelt",
			"mcape",
			"orbg",
			"oxhelmet",
			"powerglove",
			"ringsj",
			"sanguine",
			"sbelt",
			"skullamulet",
			"snring",
			"starkillers",
			"tigercape",
			"tigerhelmet",
			"tigerstone",
			"tristone",
			"vattire",
			"vboots",
			"vcape",
			"vgloves",
			"vorb",
			"vring",
			"warmscarf",
			"warpvest",
			"wingedboots",
		],
	);
	assert.equal(data.items.stealthcape.tier, undefined);
	assert.deepEqual(plain(data.item_requirements.stealthcape), [{ skill: "rogue", level: 1 }]);
	assert.deepEqual(plain(data.item_requirements.fury), [
		{ skill: "warrior", level: 20 },
		{ skill: "paladin", level: 20 },
		{ skill: "ranger", level: 20 },
		{ skill: "rogue", level: 20 },
	]);
	assert.ok(data.items.vsword.upgrade);
	assert.equal(data.items.vsword.tier, 3.25);
	assert.deepEqual(plain(data.item_requirements.vsword), [{ skill: "warrior", level: 90 }]);
	assert.ok(data.items.wbookhs.compound);
	assert.equal(data.items.wbookhs.compound.int, 0);
	assert.deepEqual(plain(data.item_requirements.wbookhs), [{ skill: "priest", level: 40 }]);
	const independentRequirementMatrix = {
		helmet: [{ skill: "warrior", level: 1 }],
		spear: [{ skill: "warrior", level: 10 }],
		xmashat: [{ skill: "merchant", level: 20 }],
		weaver: [{ skill: "ranger", level: 30 }],
		mageshood: [{ skill: "mage", level: 40 }],
		mrnhat: [{ skill: "ranger", level: 50 }],
		sweaterhs: [{ skill: "merchant", level: 60 }],
		mcboots: [{ skill: "merchant", level: 70 }],
		hhelmet: [{ skill: "warrior", level: 80 }],
		handofmidas: [{ skill: "merchant", level: 90 }],
		xhelmet: [{ skill: "warrior", level: 95 }],
		shield: [{ skill: "paladin", level: 40 }],
		quiver: [{ skill: "ranger", level: 1 }],
		rod: [{ skill: "merchant", level: 16 }],
		pickaxe: [{ skill: "merchant", level: 16 }],
		fury: [
			{ skill: "warrior", level: 20 },
			{ skill: "paladin", level: 20 },
			{ skill: "ranger", level: 20 },
			{ skill: "rogue", level: 20 },
		],
		starkillers: [
			{ skill: "mage", level: 80 },
			{ skill: "priest", level: 80 },
		],
	};
	for (const [itemId, expected] of Object.entries(independentRequirementMatrix)) {
		assert.deepEqual(plain(data.item_requirements[itemId]), expected, itemId);
	}
});

test("new ability catalog preserves every legacy definition and only changes ownership vocabulary", () => {
	const data = loadAll();
	const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/legacy-abilities.json"), "utf8"));
	assert.deepEqual(Object.keys(data.abilities).sort(), Object.keys(legacy).sort());
	for (const id of Object.keys(legacy)) {
		const oldDefinition = { ...legacy[id] };
		const newDefinition = { ...data.abilities[id] };
		if (id === "throw") oldDefinition.code = newDefinition.code;
		assert.equal(Object.prototype.hasOwnProperty.call(newDefinition, "class"), false, id);
		const oldClass = oldDefinition.class;
		if (Array.isArray(oldClass) && oldClass.length === 1) {
			assert.equal(newDefinition.applicability, "skill", id);
			assert.equal(newDefinition.skill, oldClass[0], id);
			assert.equal(newDefinition.level, oldDefinition.level || 1, id);
		} else if (
			["snowball", "scare", "power", "xpower", "warp", "temporalsurge", "zapperzap", "charm", "tangle"].includes(id)
		) {
			assert.equal(newDefinition.applicability, "item", id);
			assert.equal(newDefinition.skill, undefined, id);
		} else {
			assert.equal(newDefinition.skill, undefined, id);
		}
		delete oldDefinition.class;
		delete newDefinition.applicability;
		delete newDefinition.skill;
		delete oldDefinition.level;
		delete newDefinition.level;
		delete newDefinition.style_bound;
		delete newDefinition.contribution;
		assert.deepEqual(plain(newDefinition), plain(oldDefinition), id);
	}
	assert.equal(data.abilities.throw.code, "range=character.skills.merchant.level+200");
	assert.equal(
		Object.values(legacy).filter((definition) => definition.class && definition.class.length === 1).length,
		55,
	);
});

test("ability applicability follows the independent precedence snapshot", () => {
	const data = loadAll();
	const expected = {
		active_combat: ["attack"],
		item: ["snowball", "scare", "power", "xpower", "warp", "temporalsurge", "zapperzap", "charm", "tangle"],
		monster: [
			"portal",
			"self_healing",
			"healing",
			"anger",
			"zap",
			"fireball",
			"frostball",
			"warpstomp",
			"deepfreeze",
			"multi_burn",
			"mlight",
			"dampening_aura",
			"weakness_aura",
			"curse_aura",
			"multi_freeze",
			"mtangle",
			"stone",
		],
		system: [
			"regen_hp",
			"regen_mp",
			"use_mp",
			"use_hp",
			"use_town",
			"travel",
			"stop",
			"snippet",
			"emotion",
			"pure_eval",
			"esc",
			"move_up",
			"move_down",
			"move_left",
			"move_right",
			"toggle_code",
			"toggle_run_code",
			"toggle_inventory",
			"toggle_stats",
			"toggle_character",
			"open_snippet",
			"interact",
			"gm",
		],
	};
	for (const [applicability, ids] of Object.entries(expected)) {
		for (const id of ids) assert.equal(data.abilities[id].applicability, applicability, id);
	}
	assert.equal(Object.values(expected).flat().length + 55, 105);
});

test("character creation data is a stable neutral baseline with all six starters", () => {
	const data = loadAll();
	assert.equal(data.character.appearances.length, 28);
	assert.equal(
		crypto
			.createHash("sha256")
			.update(JSON.stringify(plain(data.character.appearances)))
			.digest("hex"),
		"3baf1e07aaaaa0a601981c3dd211721b396a3bc33ac967eb65839a9a46bb8880",
	);
	assert.deepEqual(plain(data.character.baseline), {
		max_hp: 100,
		max_mp: 100,
		speed: 50,
		frequency: 0.3,
		inventory_size: 42,
		attack: 0,
		heal: 0,
		armor: 0,
		resistance: 0,
		str: 0,
		dex: 0,
		int: 0,
		vit: 0,
	});
	assert.deepEqual(plain(data.character.starter.consumables), [
		{ name: "hpot0", q: 200, gift: 1 },
		{ name: "mpot0", q: 200, gift: 1 },
	]);
	assert.deepEqual(plain(data.character.starter.equipment), [
		{ name: "helmet", level: 0, gift: 1 },
		{ name: "shoes", level: 0, gift: 1 },
	]);
	assert.deepEqual(plain(data.character.starter.slots), {});
});

test("production loaders validate progression data before publishing it", () => {
	const main = fs.readFileSync(path.join(designRoot, "../main.js"), "utf8");
	const server = fs.readFileSync(path.join(designRoot, "../node/server.js"), "utf8");
	assert.match(main, /buildProgressionData\(\{/);
	assert.match(main, /character_view\(character\)/);
	assert.doesNotMatch(fs.readFileSync(path.join(designRoot, "../js/html.js"), "utf8"), /calculate_item_properties\([^\n]+class:/);
	assert.equal((server.match(/const progression_data = buildProgressionData\(\{/g) || []).length, 2);
	assert.ok(server.indexOf("buildProgressionData") < server.indexOf("G = loadProgressionPublication"));
	const executeBuilderStatement = (statement, raw) => {
		const context = {
			buildProgressionData,
			items: raw.items,
			item_requirements: raw.item_requirements,
			skills: raw.skills,
			skill_xp: raw.skill_xp,
			abilities: raw.abilities,
			character: raw.character,
		};
		vm.createContext(context);
		vm.runInContext(`${statement}; globalThis.progression_data = progression_data;`, context);
		return context.progression_data;
	};
	const raw = loadRaw();
	const rootBuilt = executeBuilderStatement(
		extractBuilderStatement(main, "var progression_data = buildProgressionData({"),
		raw,
	);
	const serverStatements = [...server.matchAll(/const progression_data = buildProgressionData\(\{/g)].map((match) =>
		extractBuilderStatement(server, "const progression_data = buildProgressionData({", match.index),
	);
	function extractBuilderStatement(source, declaration, fromIndex) {
		const start = source.indexOf(declaration, fromIndex || 0);
		assert.notEqual(start, -1, declaration);
		const end = source.indexOf(");", start) + 2;
		assert.ok(end > start, declaration);
		return source.slice(start, end);
	}
	const serverInitBuilt = executeBuilderStatement(serverStatements[0], raw);
	const serverReloadBuilt = executeBuilderStatement(serverStatements[1], raw);
	assert.deepEqual(plain(serverInitBuilt), plain(rootBuilt));
	assert.deepEqual(plain(serverReloadBuilt), plain(rootBuilt));
	const data = loadAll();
	assert.throws(
		() =>
			validateProgressionData({
				...data,
				item_requirements: { ...data.item_requirements, missing: [{ skill: "warrior", level: 1 }] },
			}),
		(error) => error.code === "invalid_game_data" && error.item === "missing",
	);
	assert.throws(
		() =>
			validateProgressionData({
				...data,
				abilities: { ...data.abilities, broken: { applicability: "skill", skill: "warrior", level: 100 } },
			}),
		(error) => error.code === "invalid_ability_catalog" && error.ability === "broken",
	);
	const missingRequirementMap = plain(data.item_requirements);
	delete missingRequirementMap.helmet;
	assert.throws(
		() => validateProgressionData({ ...data, items: plain(data.items), item_requirements: missingRequirementMap }),
		(error) => error.code === "invalid_game_data" && error.item === "helmet",
	);
	const brokenItems = plain(data.items);
	const brokenRequirements = plain(data.item_requirements);
	brokenItems.broken_weapon = { type: "weapon", wtype: "unknown", requirements: [{ skill: "warrior", level: 1 }] };
	brokenRequirements.broken_weapon = [{ skill: "warrior", level: 1 }];
	assert.throws(
		() =>
			validateProgressionData({
				...data,
				items: brokenItems,
				item_requirements: brokenRequirements,
			}),
		(error) => error.code === "invalid_game_data" && error.item === "broken_weapon" && error.weapon_type === "unknown",
	);
	const publicationContext = {
		loadProgressionPublication,
		progression_data: rootBuilt,
		Version: 1,
	};
	for (const name of [
		"achievements",
		"animations",
		"monsters",
		"sprites",
		"maps",
		"geometry",
		"npcs",
		"tilesets",
		"imagesets",
		"sets",
		"craft",
		"titles",
		"tokens",
		"dismantle",
		"conditions",
		"cosmetics",
		"emotions",
		"projectiles",
		"classes",
		"dimensions",
		"levels",
		"positions",
		"games",
		"events",
		"precomputed",
		"multipliers",
		"docs",
		"drops",
		"progression",
	])
		publicationContext[name] = {};
	vm.createContext(publicationContext);
	const extractPublicationStatement = (source, fromIndex = 0) => {
		const start = source.indexOf("loadProgressionPublication(", fromIndex);
		assert.notEqual(start, -1, "production publication call");
		const end = source.indexOf(");", start) + 2;
		assert.ok(end > start, "production publication statement");
		const assignmentStart = source.lastIndexOf("G =", start);
		return source.slice(assignmentStart === -1 ? start : assignmentStart, end);
	};
	const mainPublicationStatement = extractPublicationStatement(main);
	const serverPublicationStatements = [...server.matchAll(/loadProgressionPublication\(/g)].map((match) =>
		extractPublicationStatement(server, match.index),
	);
	assert.equal(serverPublicationStatements.length, 2);
	const executePublication = (statement, built) => {
		publicationContext.progression_data = built;
		vm.runInContext(`${statement}; globalThis.__publication = G;`, publicationContext);
		return publicationContext.__publication;
	};
	const executeTwice = (statement, built) => {
		const first = executePublication(statement, built);
		const second = executePublication(statement, built);
		assert.deepEqual(plain(second), plain(first));
		return second;
	};
	const rootPublication = executeTwice(mainPublicationStatement, rootBuilt);
	const backendInitPublication = executeTwice(serverPublicationStatements[0], serverInitBuilt);
	const backendReloadPublication = executeTwice(serverPublicationStatements[1], serverReloadBuilt);
	for (const built of [rootBuilt, serverInitBuilt, serverReloadBuilt]) {
		assert.equal(Object.isFrozen(built), true);
		assert.equal(Object.isFrozen(built.items), true);
		assert.equal(Object.isFrozen(built.skills), true);
	}
	const progressionProjection = (publication) =>
		plain({
			items: publication.items,
			skills: publication.skills,
			skill_xp: publication.skill_xp,
			abilities: publication.abilities,
			character: publication.character,
		});
	assert.deepEqual(progressionProjection(backendInitPublication), progressionProjection(rootPublication));
	assert.deepEqual(progressionProjection(backendReloadPublication), progressionProjection(rootPublication));
	assert.equal(Object.isFrozen(rootPublication.skills), true);
	assert.equal(Object.isFrozen(rootPublication.items), true);
	assert.equal(Object.isFrozen(rootPublication.abilities.attack), true);
	assert.throws(() => {
		rootPublication.abilities.attack.cooldown = 1;
	}, TypeError);
	const previousPublication = plain(backendReloadPublication);
	const previousPublishedSkills = backendReloadPublication.skills;
	const invalidSource = loadRaw();
	invalidSource.item_requirements.missing = [{ skill: "warrior", level: 1 }];
	assert.throws(
		() => buildProgressionData(invalidSource),
		(error) => error.code === "invalid_game_data" && error.item === "missing",
	);
	assert.throws(
		() => loadProgressionPublication(backendReloadPublication, invalidSource),
		(error) => error.code === "invalid_game_data",
	);
	const frozenMalformed = Object.freeze({ skills: Object.freeze({}) });
	assert.throws(
		() => loadProgressionPublication({}, frozenMalformed),
		(error) => error.code === "invalid_game_data",
	);
	assert.deepEqual(plain(backendReloadPublication), previousPublication);
	assert.strictEqual(backendReloadPublication.skills, previousPublishedSkills);
});

test("the closed progression consumer inventory has no legacy skill lookups", () => {
	const inventory = [
		"main.js",
		"api.js",
		"adventure_functions.js",
		"filters.js",
		"models.js",
		"node/server.js",
		"node/server_functions.js",
		"htmls/index.html",
		"htmls/comm.html",
		"htmls/contents/selection.html",
		"htmls/contents/selection_characters.html",
		"htmls/contents/character.html",
		"htmls/contents/keymap_guide.html",
		"js/functions.js",
		"js/game.js",
		"js/html.js",
		"js/runner_functions.js",
		"js/runner_compat.js",
		"js/old_common_functions.js",
		"utility/htmls/imagesets/selector.html",
		"docs/articles/6-items101.html",
		"docs/articles/7-using-skills.html",
		"docs/articles/data-character.html",
		"docs/EXAMPLES.html",
		"docs/directory.js",
	];
	const expectedProgressionRefs = { "htmls/index.html": 1, "js/html.js": 12, "js/game.js": 1 };
	const expectedAbilityRefs = {
		"node/server.js": 43,
		"node/server_functions.js": 20,
		"js/functions.js": 20,
		"js/html.js": 29,
		"js/runner_compat.js": 4,
		"js/runner_functions.js": 14,
		"utility/htmls/imagesets/selector.html": 2,
		"htmls/contents/keymap_guide.html": 3,
		"docs/articles/7-using-skills.html": 3,
		"js/game.js": 2,
	};
	const allowlistedLegacyReads = {};
	let abilityReferences = 0;
	for (const relativePath of inventory) {
		const source = fs.readFileSync(path.join(designRoot, "..", relativePath), "utf8");
		assert.equal(
			(source.match(/\bG\.skills\b/g) || []).length,
			expectedProgressionRefs[relativePath] || 0,
			relativePath,
		);
		assert.doesNotMatch(source, /\bG\s*\[\s*["']skills["']\s*\]/, relativePath);
		assert.doesNotMatch(source, /\bG\s*\[\s*["']abilities["']\s*\]/, relativePath);
		assert.doesNotMatch(source, /\b(?:const|let|var)\s+\w+\s*=\s*G\s*\[\s*[^\]]+\s*\]/, relativePath);
		assert.doesNotMatch(source, /G\.abilities\[[^\]]+\](?:\.class|\["class"\]|\['class'\])/, relativePath);
		const legacyReads = source.match(/\b(?:skill|gSkill)\s*(?:\.\s*class|\[\s*["']class["']\s*\])/g) || [];
		assert.equal(legacyReads.length, allowlistedLegacyReads[relativePath] || 0, relativePath);
		const abilityCount = (source.match(/\bG\.abilities\b/g) || []).length;
		assert.equal(abilityCount, expectedAbilityRefs[relativePath] || 0, relativePath);
		abilityReferences += abilityCount;
	}
	assert.ok(abilityReferences > 0);
	const adventureFunctions = fs.readFileSync(path.join(designRoot, "..", "adventure_functions.js"), "utf8");
	assert.doesNotMatch(adventureFunctions, /items\[item\.name\]/);
	assert.match(adventureFunctions, /progression_data\.items/);
	const serverFunctions = fs.readFileSync(path.join(designRoot, "..", "node/server_functions.js"), "utf8");
	assert.match(serverFunctions, /name == "attack" \? player\.attack_ms/);
});

test("frozen progression items keep derived runtime metadata out of the catalog", () => {
	const serverFunctions = fs.readFileSync(path.join(designRoot, "..", "node/server_functions.js"), "utf8");
	const server = fs.readFileSync(path.join(designRoot, "..", "node/server.js"), "utf8");
	assert.match(serverFunctions, /item_runtime\s*=\s*\{\}/);
	assert.match(serverFunctions, /item_runtime\[name\]/);
	assert.doesNotMatch(serverFunctions, /def\.igrade\s*=/);
	assert.doesNotMatch(serverFunctions, /def\.igrace\s*=/);
	assert.doesNotMatch(serverFunctions, /def\.a\s*=/);
	assert.doesNotMatch(serverFunctions, /G\.items\.lostearring\.igrade\s*=/);
	assert.match(server, /item_runtime\[item\.name\]/);
	assert.doesNotMatch(server, /G\.items\[[^\]]+\]\.(?:a|igrade|igrace)\s*=/);
});

test("Priest books and starter appearance data use the new ownership boundary", () => {
	const data = loadAll();
	for (const id of ["wbook0", "wbook1", "wbookhs"]) {
		assert.equal(data.items[id].type, "weapon");
		assert.equal(data.items[id].wtype, "book");
		assert.equal(data.item_requirements[id][0].skill, "priest");
	}
	assert.equal(data.items.wbookhs.int, 16);
	assert.equal(data.items.wbookhs.dex, undefined);
	assert.equal(data.items.wbookhs.compound.int, 0);
	assert.deepEqual(plain(data.character.starter.slots), {});
});

test("loading real design data twice is idempotent", () => {
	const first = loadAll();
	const second = loadAll();
	assert.deepEqual(plain(second.skills), plain(first.skills));
	assert.deepEqual(plain(second.abilities), plain(first.abilities));
	assert.deepEqual(plain(second.item_requirements), plain(first.item_requirements));
	assert.deepEqual(plain(second.items), plain(first.items));
	assert.deepEqual(plain(second.character), plain(first.character));
});
