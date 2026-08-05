"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
	createMerchantAccrual,
	addCredit,
	settleStand,
	qualifyLuck,
	recordSale,
	merchantTax,
	merchantSlots,
	validateMerchantAccrual,
	recordSaleReversal,
	recordDonationOrDice,
	isOpenMerchantStand,
} = require("../game/merchant_progression");
const { progression } = require("../../design/progression");

test("merchant sale eligibility requires a live open stand", () => {
	assert.equal(isOpenMerchantStand({ p: { stand: true }, rip: false }), true);
	assert.equal(isOpenMerchantStand({ p: { stand: false }, rip: false }), false);
	assert.equal(isOpenMerchantStand({ p: { stand: true }, rip: true }), false);
});

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
	assert.equal(state.eligible_stand_ms, 2016 * 60 * 60 * 1000);
	assert.equal(state.stand_rate_remainder, 0);
	assert.equal(state.xp_unit_remainder, 0);
	assert.deepEqual(Object.keys(state).sort(), [
		"eligible_stand_ms",
		"merchant_id",
		"pending_credits",
		"processed_sources",
		"rolling_awards",
		"rolling_hour_luck_uses",
		"sales_by_owner",
		"stand_rate_remainder",
		"xp_unit_remainder",
	]);
});

test("stand accrual preserves exact units across irregular partitions and rehydration", () => {
	const partitions = [1, 999999, 1234567, 1365433];
	const run = (restartAfterCalls = null) => {
		let state = createMerchantAccrual();
		let now = 0;
		let xp = 0;
		let calls = 0;
		for (let hour = 0; hour < 2016; hour += 1) {
			for (const elapsed of partitions) {
				now += elapsed;
				const result = settleStand(state, elapsed, now);
				state = result.state;
				xp += result.xp;
				calls += 1;
				if (calls === restartAfterCalls) state = JSON.parse(JSON.stringify(state));
			}
		}
		return { state, xp };
	};
	const uninterrupted = run();
	const restarted = run(2017);
	assert.equal(uninterrupted.xp, 900000000);
	assert.deepEqual(restarted, uninterrupted);
	assert.equal(restarted.state.eligible_stand_ms, 2016 * progression.STAND_HOUR_MS);
	assert.equal(restarted.state.stand_rate_remainder, 0);
	assert.equal(restarted.state.xp_unit_remainder, 0);
});

test("stand settlement caps one delayed settlement at one hour", () => {
	const result = settleStand(createMerchantAccrual(), progression.STAND_HOUR_MS * 8, progression.STAND_HOUR_MS * 8);
	assert.equal(result.credited_elapsed_ms, progression.STAND_HOUR_MS);
	assert.equal(result.state.eligible_stand_ms, progression.STAND_HOUR_MS);
	assert.equal(result.base_units, progression.BASE_UNITS_PER_HOUR);
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
	assert.ok(newNet.credited > 0);
	assert.equal(newNet.state.sales_by_owner.buyer.credited_high_water_gold, 200000);
});

test("Merchant action credits are bounded and validation rejects malformed persisted state", () => {
	let state = createMerchantAccrual();
	const donation = recordDonationOrDice(state, { rawXp: 900000000, sourceId: "donation-1", kind: "donation", now: 0 });
	assert.equal(donation.credited, Math.floor(progression.BASE_UNITS_PER_HOUR / 4));
	const dice = recordDonationOrDice(donation.state, { rawXp: 900000000, sourceId: "dice-1", kind: "dice", now: 1 });
	assert.equal(dice.credited, Math.floor(progression.BASE_UNITS_PER_HOUR / 4));
	const repeatedDonation = recordDonationOrDice(dice.state, {
		rawXp: 900000000,
		sourceId: "donation-2",
		kind: "donation",
		now: 2,
	});
	assert.equal(repeatedDonation.credited, 0);
	assert.equal(repeatedDonation.capped, true);
	const nextHourDonation = recordDonationOrDice(repeatedDonation.state, {
		rawXp: 900000000,
		sourceId: "donation-3",
		kind: "donation",
		now: progression.STAND_HOUR_MS + 3,
	});
	assert.ok(nextHourDonation.credited > 0);
	const credit = addCredit(createMerchantAccrual(), {
		units: progression.MAX_ACTION_UNITS_PER_HOUR,
		sourceId: "expiring-credit",
		now: 0,
	});
	assert.equal(
		addCredit(credit.state, {
			units: progression.MAX_ACTION_UNITS_PER_HOUR,
			sourceId: "expiring-credit",
			now: 1,
		}).duplicate,
		true,
	);
	assert.ok(
		addCredit(credit.state, {
			units: progression.MAX_ACTION_UNITS_PER_HOUR,
			sourceId: "expiring-credit",
			now: progression.STAND_HOUR_MS + 1,
		}).credited > 0,
	);
	const standOnly = settleStand(createMerchantAccrual(), progression.STAND_HOUR_MS, progression.STAND_HOUR_MS);
	assert.equal(
		addCredit(standOnly.state, {
			units: progression.MAX_ACTION_UNITS_PER_HOUR,
			sourceId: "after-base",
			now: progression.STAND_HOUR_MS + 1,
		}).credited,
		progression.MAX_ACTION_UNITS_PER_HOUR,
	);
	assert.throws(
		() => validateMerchantAccrual({ ...createMerchantAccrual(), pending_credits: [{ units: 1, expires_at: 0 }] }, 0),
		(error) => error.code === "invalid_merchant_state",
	);
	assert.throws(
		() => validateMerchantAccrual({ ...createMerchantAccrual(), processed_sources: ["legacy-source"] }, 0),
		(error) => error.code === "invalid_merchant_state",
	);
	assert.throws(
		() => validateMerchantAccrual({ ...createMerchantAccrual(), sales_by_owner: { buyer: { net_gold: -1 } } }, 0),
		(error) => error.code === "invalid_merchant_state",
	);
	assert.throws(
		() => validateMerchantAccrual({ ...createMerchantAccrual(), stand_last_settled_at: 1 }, 0),
		(error) => error.code === "invalid_merchant_state",
	);
});

test("bounded Merchant collections saturate actions, preserve stand base, and recover after the window", () => {
	let processed = createMerchantAccrual();
	for (let index = 0; index < progression.MAX_COLLECTION_SIZE; index += 1) {
		const result = addCredit(processed, { units: 1, sourceId: `source-${index}`, now: 0 });
		assert.equal(result.credited, 1);
		processed = result.state;
	}
	const processedSaturated = addCredit(processed, { units: 1, sourceId: "source-overflow", now: 0 });
	assert.equal(processedSaturated.saturated, true);
	assert.equal(processedSaturated.credited, 0);
	assert.equal(processedSaturated.state.processed_sources.length, progression.MAX_COLLECTION_SIZE);
	const processedRecovered = addCredit(processedSaturated.state, {
		units: 1,
		sourceId: "source-after-window",
		now: progression.STAND_HOUR_MS + 1,
	});
	assert.equal(processedRecovered.credited, 1);
	assert.equal(processedRecovered.state.processed_sources.length, 1);

	let awards = createMerchantAccrual();
	for (let index = 0; index < progression.MAX_COLLECTION_SIZE; index += 1)
		awards = settleStand(awards, progression.STAND_HOUR_MS, index + 1).state;
	const awardsSaturated = settleStand(awards, progression.STAND_HOUR_MS, progression.MAX_COLLECTION_SIZE + 1);
	assert.equal(awardsSaturated.base_units, progression.BASE_UNITS_PER_HOUR);
	assert.equal(awardsSaturated.bonus_units, 0);
	assert.equal(awardsSaturated.state.rolling_awards.length, progression.MAX_COLLECTION_SIZE);
	assert.ok(awardsSaturated.state.saturated_award_units.units > 0);
	const awardsRecovered = settleStand(
		awardsSaturated.state,
		progression.STAND_HOUR_MS,
		awardsSaturated.state.saturated_award_units.expires_at,
	);
	assert.equal(awardsRecovered.base_units, progression.BASE_UNITS_PER_HOUR);
	assert.equal(awardsRecovered.state.saturated_award_units, undefined);

	const owners = createMerchantAccrual();
	for (let index = 0; index < progression.MAX_COLLECTION_SIZE; index += 1)
		owners.sales_by_owner[`owner-${index}`] = {
			net_gold: 100,
			credited_high_water_gold: 100,
			events: [{ source_id: `seed-${index}`, net_delta: 100, at: 0 }],
		};
	const ownerSaturated = recordSale(owners, {
		merchantOwnerId: "merchant",
		externalOwnerId: "owner-overflow",
		goldReceived: 100,
		serverTax: 5,
		sourceId: "owner-overflow-sale",
		now: 0,
	});
	assert.equal(ownerSaturated.saturated, true);
	assert.equal(Object.keys(ownerSaturated.state.sales_by_owner).length, progression.MAX_COLLECTION_SIZE);
	assert.equal(ownerSaturated.state.sales_by_owner["owner-overflow"], undefined);

	const events = createMerchantAccrual();
	events.sales_by_owner.buyer = {
		net_gold: progression.MAX_COLLECTION_SIZE,
		credited_high_water_gold: progression.MAX_COLLECTION_SIZE,
		events: Array.from({ length: progression.MAX_COLLECTION_SIZE }, (_, index) => ({
			source_id: `event-${index}`,
			net_delta: 1,
			at: 0,
		})),
	};
	const eventSaturated = recordSale(events, {
		merchantOwnerId: "merchant",
		externalOwnerId: "buyer",
		goldReceived: 1,
		serverTax: 5,
		sourceId: "event-overflow-sale",
		now: 0,
	});
	assert.equal(eventSaturated.saturated, true);
	assert.equal(eventSaturated.state.sales_by_owner.buyer.events.length, progression.MAX_COLLECTION_SIZE);
	assert.equal(eventSaturated.state.sales_by_owner.buyer.net_gold, progression.MAX_COLLECTION_SIZE + 1);
});
