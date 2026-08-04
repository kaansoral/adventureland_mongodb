"use strict";

const { SKILL_IDS } = require("./skill_domain");
const { WEAPON_PROFILES, deriveActiveSkill, weaponProfile } = require("./active_skill");

const OFFHAND_TYPES = new Set(["shield", "source", "quiver", "misc_offhand"]);
const RING_SLOTS = ["ring1", "ring2"];
const EARRING_SLOTS = ["earring1", "earring2"];

function equipmentError(code, message, fields = {}) {
	const error = new Error(message);
	error.code = code;
	Object.assign(error, fields);
	return error;
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function itemDefinition(item, items) {
	if (!item || !items || !items[item.name])
		throw equipmentError("invalid_equipment_requirements", "Item definition is missing", { item: item && item.name });
	return items[item.name];
}

function requirementFailure(item, requirements, skills) {
	for (const requirement of requirements || []) {
		const actual = skills && skills[requirement.skill] ? skills[requirement.skill].level : 0;
		if (actual < requirement.level) {
			return equipmentError(
				"skill_level_required",
				`Skill ${requirement.skill} level ${requirement.level} is required`,
				{
					item,
					skill: requirement.skill,
					required: requirement.level,
					actual,
				},
			);
		}
	}
	return null;
}

function validateRequirements(item, requirements, skills) {
	if (!Array.isArray(requirements) || !requirements.length) {
		throw equipmentError("invalid_equipment_requirements", "The item has no authoritative requirements", { item });
	}
	const failure = requirementFailure(item, requirements, skills);
	if (failure) throw failure;
}

function findFreeInventory(inventory, reserved = new Set()) {
	for (let index = 0; index < inventory.length; index += 1) {
		if (!inventory[index] && !reserved.has(index)) return index;
	}
	return -1;
}

function addToInventory(inventory, item, preferredIndex = -1) {
	if (preferredIndex >= 0 && !inventory[preferredIndex]) {
		inventory[preferredIndex] = item;
		return preferredIndex;
	}
	const index = findFreeInventory(inventory);
	if (index < 0)
		throw equipmentError("inventory_full_for_offhand", "No inventory cell is available for the displaced item");
	inventory[index] = item;
	return index;
}

function isWeapon(item) {
	return item && item.type === "weapon";
}

function isCompatibleOffhand(main, offhand, items, profiles = WEAPON_PROFILES) {
	if (!offhand) return true;
	if (!main) return true;
	const mainDef = itemDefinition(main, items);
	const offDef = itemDefinition(offhand, items);
	const profile = weaponProfile(mainDef, profiles);
	if (!profile || profile.hands === 2) return false;
	if (isWeapon(offDef)) {
		const offProfile = weaponProfile(offDef, profiles);
		return Boolean(
			profile.offhand_weapon && offProfile && offProfile.skill === profile.skill && offProfile.offhand_weapon,
		);
	}
	return profile.allowed_offhands.includes(offDef.type);
}

function chooseSlot(itemDef, requestedSlot, slots, profiles = WEAPON_PROFILES) {
	const requested = requestedSlot === "weapon" ? "mainhand" : requestedSlot;
	if (itemDef.type === "tool") return "mainhand";
	if (isWeapon(itemDef)) {
		if (requested === "offhand") return "offhand";
		if (requested === "mainhand" || !requested) return "mainhand";
		return requested;
	}
	if (OFFHAND_TYPES.has(itemDef.type)) return requested === "offhand" || !requested ? "offhand" : requested;
	if (itemDef.type === "ring") return RING_SLOTS.includes(requested) ? requested : slots.ring1 ? "ring2" : "ring1";
	if (itemDef.type === "earring")
		return EARRING_SLOTS.includes(requested) ? requested : slots.earring1 ? "earring2" : "earring1";
	return requested || itemDef.type;
}

function validateLayout(slots, items, profiles = WEAPON_PROFILES) {
	const main = slots.mainhand;
	const offhand = slots.offhand;
	if (!offhand || !main) return;
	if (!isCompatibleOffhand(main, offhand, items, profiles)) {
		throw equipmentError("incompatible_offhand", "The final hand layout is incompatible", {
			mainhand: main.name,
			offhand: offhand.name,
		});
	}
}

function planEquipmentTransaction({
	player,
	item,
	itemIndex,
	sourceIndex = itemIndex,
	slot,
	items,
	itemRequirements,
	profiles = WEAPON_PROFILES,
	skills,
}) {
	const currentSlots = clone((player && player.slots) || {});
	const currentInventory = clone((player && (player.items || player.inventory)) || []);
	const source = sourceIndex === undefined || sourceIndex === null ? null : currentInventory[sourceIndex];
	if (
		sourceIndex !== undefined &&
		sourceIndex !== null &&
		(!source || !item || source.name !== item.name || (source.level || 0) !== (item.level || 0))
	) {
		throw equipmentError("inventory_item_changed", "The inventory source no longer contains the requested item", {
			index: sourceIndex,
		});
	}
	const definition = itemDefinition(item || source, items);
	validateRequirements(item.name, itemRequirements && itemRequirements[item.name], skills);
	const targetSlot = chooseSlot(definition, slot, currentSlots, profiles);
	const nextSlots = clone(currentSlots);
	const nextInventory = clone(currentInventory);
	if (sourceIndex !== undefined && sourceIndex !== null) nextInventory[sourceIndex] = null;

	const displaced = nextSlots[targetSlot];
	if (displaced) addToInventory(nextInventory, displaced, sourceIndex);
	nextSlots[targetSlot] = clone(item);

	if (
		targetSlot === "mainhand" &&
		nextSlots.offhand &&
		!isCompatibleOffhand(nextSlots.mainhand, nextSlots.offhand, items, profiles)
	) {
		const offhand = nextSlots.offhand;
		const offhandDestination = addToInventory(nextInventory, offhand, sourceIndex);
		if (offhandDestination < 0)
			throw equipmentError("inventory_full_for_offhand", "No inventory cell is available for the displaced offhand");
		nextSlots.offhand = null;
	}
	if (
		targetSlot === "offhand" &&
		nextSlots.mainhand &&
		!isCompatibleOffhand(nextSlots.mainhand, nextSlots.offhand, items, profiles)
	) {
		throw equipmentError("incompatible_offhand", "The final hand layout is incompatible", {
			mainhand: nextSlots.mainhand.name,
			offhand: nextSlots.offhand.name,
		});
	}
	validateLayout(nextSlots, items, profiles);
	return {
		slots: nextSlots,
		items: nextInventory,
		inventory: nextInventory,
		active_skill: deriveActiveSkill(nextSlots, items, profiles),
		slot: targetSlot,
	};
}

function canEquipItem(args) {
	try {
		return { ok: true, transaction: planEquipmentTransaction(args) };
	} catch (error) {
		return { ok: false, error };
	}
}

function validateSkillOrder(requirements) {
	let previous = -1;
	for (const requirement of requirements || []) {
		const index = SKILL_IDS.indexOf(requirement.skill);
		if (index < previous)
			throw equipmentError("invalid_equipment_requirements", "Requirements are not in registry order");
		previous = index;
	}
}

module.exports = {
	OFFHAND_TYPES,
	RING_SLOTS,
	EARRING_SLOTS,
	validateRequirements,
	validateSkillOrder,
	isCompatibleOffhand,
	planEquipmentTransaction,
	canEquipItem,
};
