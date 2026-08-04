"use strict";

function starterError(message) {
	const error = new Error(message);
	error.code = "invalid_starter_loadout";
	return error;
}

function cloneItem(item, label) {
	if (!item || typeof item !== "object" || Array.isArray(item)) throw starterError(`${label} must be an item object`);
	return { ...item };
}

function buildStarterLoadout(characterDefinition) {
	const starter = characterDefinition && characterDefinition.starter;
	if (!starter || !Array.isArray(starter.weapons) || !Array.isArray(starter.consumables) || !Array.isArray(starter.equipment))
		throw starterError("Character starter definition is incomplete");
	const items = starter.weapons.map((name) => {
		if (typeof name !== "string" || !name) throw starterError("Starter weapon IDs must be non-empty strings");
		return { name, level: 0, gift: 1 };
	});
	items.push(...starter.consumables.map((item, index) => cloneItem(item, `Starter consumable ${index}`)));
	items.push(...starter.equipment.map((item, index) => cloneItem(item, `Starter equipment ${index}`)));
	const slots = {};
	for (const [slot, item] of Object.entries(starter.slots || {})) {
		slots[slot] = typeof item === "string" ? { name: item } : cloneItem(item, `Starter slot ${slot}`);
	}
	return { items, slots };
}

module.exports = { buildStarterLoadout, starterError };
