"use strict";

const TOTAL_LEVEL_SORT = Object.freeze({ total_level: -1, name: 1 });
const MERCHANT_SORT = Object.freeze({
	"info.skills.merchant.level": -1,
	"info.skills.merchant.xp": -1,
	name: 1,
});

function valueAt(document, path) {
	return path.split(".").reduce((value, key) => value?.[key], document);
}

function compareValues(left, right, direction) {
	const leftValue = left ?? 0;
	const rightValue = right ?? 0;
	if (leftValue === rightValue) return 0;
	return (leftValue > rightValue ? 1 : -1) * direction;
}

function rankingSort(mode = "total") {
	return mode === "merchant" ? { ...MERCHANT_SORT } : { ...TOTAL_LEVEL_SORT };
}

function rankCharacters(characters, mode = "total") {
	const sort = rankingSort(mode);
	return [...characters].sort((left, right) => {
		for (const [field, direction] of Object.entries(sort)) {
			const result = compareValues(valueAt(left, field), valueAt(right, field), direction);
			if (result) return result;
		}
		return 0;
	});
}

module.exports = { rankCharacters, rankingSort };
