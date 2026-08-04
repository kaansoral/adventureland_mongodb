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
	validateMerchantAccrual,
	recordSaleReversal,
	recordDonationOrDice,
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

test("sale high-water survives reversal and same-owner transfers are ineligible", () => {
	let state = createMerchantAccrual();
	const first = recordSale(state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReceived: 100000,
		serverTax: 5000,
		sourceId: "sale-1",
		now: 0,
	});
	state = first.state;
	assert.ok(first.credited > 0);
	const sameOwner = recordSale(state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "merchant",
		goldReceived: 100000,
		serverTax: 5000,
		sourceId: "same-owner",
		now: 1,
	});
	assert.equal(sameOwner.eligible, false);
	const reversed = recordSaleReversal(state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReversed: 100000,
		sourceId: "buyback-1",
		now: 3,
	});
	state = reversed.state;
	const replay = recordSale(state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReceived: 100000,
		serverTax: 5000,
		sourceId: "sale-2",
		now: 4,
	});
	assert.equal(replay.credited, 0);
	const newNet = recordSale(replay.state, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReceived: 100000,
		serverTax: 5000,
		sourceId: "sale-3",
		now: 5,
	});
	assert.ok(newNet.credited >= 0);
	assert.equal(newNet.state.sales.buyer.credited_high_water_gold, 200000);
});

test("Merchant action credits are bounded and validation rejects malformed persisted state", () => {
	let state = createMerchantAccrual();
	const donation = recordDonationOrDice(state, { rawXp: 900000000, sourceId: "donation-1", kind: "donation", now: 0 });
	assert.equal(donation.credited, Math.floor(progression.BASE_UNITS_PER_HOUR / 4));
	const dice = recordDonationOrDice(donation.state, { rawXp: 900000000, sourceId: "dice-1", kind: "dice", now: 1 });
	assert.equal(dice.credited, Math.floor(progression.BASE_UNITS_PER_HOUR / 4));
	assert.throws(
		() => validateMerchantAccrual({ ...createMerchantAccrual(), pending_credits: [{ units: 1, expires_at: 0 }] }, 0),
		(error) => error.code === "invalid_merchant_state",
	);
	assert.throws(
		() => validateMerchantAccrual({ ...createMerchantAccrual(), sales: { buyer: { net_gold: -1 } } }, 0),
		(error) => error.code === "invalid_merchant_state",
	);
});
