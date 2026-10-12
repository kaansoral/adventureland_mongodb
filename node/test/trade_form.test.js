const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { load } = require("./helpers/server_vm");

function fixture(price, wishlist = false) {
	const values = wishlist ? { ".wprice": price, ".wnumq": "1", ".wlevel": "0" } : { ".sellprice": price };
	const calls = [],
		errors = [];
	const c = vm.createContext({
		character: {},
		$: (selector) => ({ length: selector in values ? 1 : 0, text: () => values[selector] }),
		trade: (...args) => calls.push(args),
		wishlist: (...args) => calls.push(args),
		d_text: (...args) => errors.push(args),
	});
	load(c, "js/functions.js", ["trade_offer_number", "trade_form"]);
	load(c, "js/html.js", ["wishlist_form"]);
	return {
		c,
		values,
		calls,
		errors,
		submit: () => (wishlist ? c.wishlist_form(1, "staff") : c.trade_form("trade1", 0)),
	};
}

test("stand forms accept grouped and localized whole prices without changing their value", () => {
	for (const price of ["100000", "100,000", "100.000", "100 000", "１０００００", "١٠٠٠٠٠", "۱۰۰۰۰۰"])
		for (const wishlist of [false, true]) {
			const h = fixture(price, wishlist);
			h.submit();
			assert.equal(h.errors.length, 0);
			assert.equal(h.calls.length, 1);
			assert.equal(h.calls[0][2], "100000");
			assert.equal(h.calls[0][3], "1");
		}
});

test("stand forms keep invalid prices open and send no listing", () => {
	for (const price of ["", " ", "0", "-1", "1.5", "100gold", "1e6", "1,00", "100000000000", "<img src=x>100000"])
		for (const wishlist of [false, true]) {
			const h = fixture(price, wishlist);
			h.submit();
			assert.equal(h.calls.length, 0, price);
			assert.equal(h.errors.length, 1, price);
		}
});

test("listing quantity and wishlist level must also be whole numbers", () => {
	for (const [wishlist, selector, value] of [
		[false, ".tradenum", "2cats"],
		[true, ".wnumq", "0"],
		[true, ".wlevel", "1.2"],
		[true, ".wlevel", "13"],
	]) {
		const h = fixture("100000", wishlist);
		h.values[selector] = value;
		h.submit();
		assert.equal(h.calls.length, 0);
		assert.equal(h.errors.length, 1);
	}
});
