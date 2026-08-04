"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
	createMerchantAccrual,
	settleStand,
	qualifyLuck,
	recordSale,
	merchantTax,
	merchantSlots,
} = require("../game/merchant_progression");
const { progression } = require("../../design/progression");

test("stand accrual uses exact seventh-XP units across partitions and 2016 hours", () => {
	let state = createMerchantAccrual();
	let xp = 0;
	for (let hour = 0; hour < 2016; hour += 1) {
		const result = settleStand(state, 1800000, hour * 1800000 + 1800000);
		state = result.state;
		xp += result.xp;
		const second = settleStand(state, 1800000, hour * 1800000 + 3600000);
		state = second.state;
		xp += second.xp;
	}
	assert.equal(xp, 900000000);
	assert.equal(state.base_ms_remainder, 0);
});

test("Luck caps targets/hour, sales use positive-net source IDs, and Merchant gates are stable", () => {
	let state = createMerchantAccrual();
	const first = qualifyLuck(state, "target-1", 0);
	state = first.state;
	assert.equal(first.qualifies, true);
	const repeat = qualifyLuck(state, "target-1", 1);
	assert.equal(repeat.qualifies, false);
	for (let index = 2; index <= 10; index += 1) state = qualifyLuck(state, `target-${index}`, index).state;
	assert.equal(qualifyLuck(state, "target-11", 11).qualifies, false);
	const sale = recordSale(state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReceived: 1000000,
		serverTax: 50000,
		sourceId: "sale-1",
		now: 100,
	});
	assert.ok(sale.credited >= 0);
	const duplicate = recordSale(sale.state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReceived: 1000000,
		serverTax: 50000,
		sourceId: "sale-1",
		now: 101,
	});
	assert.equal(duplicate.duplicate, true);
	assert.equal(merchantTax(1), 0.05);
	assert.equal(merchantTax(99), 0.01);
	assert.equal(merchantSlots(69), 16);
	assert.equal(merchantSlots(70), 24);
	assert.equal(merchantSlots(80), 30);
	assert.equal(progression.XP_UNITS_PER_XP, 7);
});
