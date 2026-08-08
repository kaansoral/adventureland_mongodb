"use strict";

const DEX_CRIT_CALIBRATION_LOADOUT = Object.freeze({
	mainhand: Object.freeze({ name: "heartwood", level: 15, stat_type: "dex" }),
	helmet: Object.freeze({ name: "cyber", level: 15, stat_type: "dex" }),
	chest: Object.freeze({ name: "warpvest", level: 15, stat_type: "dex" }),
	pants: Object.freeze({ name: "fallen", level: 15, stat_type: "dex" }),
	shoes: Object.freeze({ name: "vboots", level: 15, stat_type: "dex" }),
	gloves: Object.freeze({ name: "goldenpowerglove", level: 15, stat_type: "dex" }),
	cape: Object.freeze({ name: "vcape", level: 15, stat_type: "dex" }),
	amulet: Object.freeze({ name: "t2dexamulet", level: 15, stat_type: "dex" }),
	belt: Object.freeze({ name: "dexbelt", level: 15, stat_type: "dex" }),
	orb: Object.freeze({ name: "orbofdex", level: 15, stat_type: "dex" }),
	ring1: Object.freeze({ name: "cring", level: 15, stat_type: "dex" }),
	ring2: Object.freeze({ name: "cring", level: 15, stat_type: "dex" }),
	earring1: Object.freeze({ name: "dexearringx", level: 15, stat_type: "dex" }),
	earring2: Object.freeze({ name: "dexearringx", level: 15, stat_type: "dex" }),
});

const DEX_CRIT_CALIBRATION = 819;

function calculateDexCritCalibration(items, getItemProperties) {
	if (!items || !getItemProperties) return DEX_CRIT_CALIBRATION;
	let dex = 0;
	for (const item of Object.values(DEX_CRIT_CALIBRATION_LOADOUT)) {
		if (!items[item.name]) return DEX_CRIT_CALIBRATION;
		const properties = getItemProperties(item, items[item.name]) || {};
		if (!Number.isFinite(properties.dex)) return DEX_CRIT_CALIBRATION;
		dex += properties.dex;
	}
	return dex > 0 ? dex : DEX_CRIT_CALIBRATION;
}

module.exports = { DEX_CRIT_CALIBRATION, DEX_CRIT_CALIBRATION_LOADOUT, calculateDexCritCalibration };
