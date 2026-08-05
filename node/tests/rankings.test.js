"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { rankCharacters, rankingSort } = require("../game/rankings");

test("merchant ranking orders every character by Merchant level, XP, and name", () => {
	const characters = [
		{ name: "multi", total_level: 20, info: { skills: { merchant: { level: 3, xp: 100 } } } },
		{ name: "high-total", total_level: 99, info: { skills: { merchant: { level: 1, xp: 0 } } } },
		{ name: "merchant-xp", total_level: 7, info: { skills: { merchant: { level: 3, xp: 200 } } } },
		{ name: "merchant-tie", total_level: 7, info: { skills: { merchant: { level: 3, xp: 200 } } } },
	];

	assert.deepEqual(Object.keys(rankingSort("merchant")), [
		"info.skills.merchant.level",
		"info.skills.merchant.xp",
		"name",
	]);
	assert.deepEqual(
		rankCharacters(characters, "merchant").map(({ name }) => name),
		["merchant-tie", "merchant-xp", "multi", "high-total"],
	);
});

test("general character ranking remains total-level-first and the HTTP route exposes Merchant mode", () => {
	assert.deepEqual(rankingSort(), { total_level: -1, name: 1 });
	assert.deepEqual(
		rankCharacters([
			{ name: "low", total_level: 7 },
			{ name: "high", total_level: 8 },
			{ name: "same", total_level: 8 },
		]).map(({ name }) => name),
		["high", "same", "low"],
	);
	const main = fs.readFileSync(path.resolve(__dirname, "../../main.js"), "utf8");
	assert.match(main, /req\.query\.ranking === "merchant"/);
	assert.match(main, /rankingSort\(merchantRanking \? "merchant" : "total"\)/);
});
