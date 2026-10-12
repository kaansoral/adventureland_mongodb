"use strict";
// #performance spree [26/09/26]: binary min-heap keyed by due time, for work that's scheduled rather than polled
// projectiles_loop walked every projectile in flight 143x/s to find the few that were due - now "anything due?" is O(1)
// small on purpose: push, peek, shift - no removal by key, a cancelled entry is skipped when it comes out (see projectiles_loop)
class DueQueue {
	constructor(onpush) {
		this.due = []; // numeric due times
		this.value = []; // parallel array of payloads
		this.onpush = onpush || null; // called after every push, so a sleeping timer can wake up
	}

	get size() {
		return this.due.length;
	}

	// earliest due time, Infinity when empty
	peek() {
		return this.due.length ? this.due[0] : Infinity;
	}

	push(due, value) {
		const dues = this.due;
		const values = this.value;
		let i = dues.length;
		dues.push(due);
		values.push(value);
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (dues[parent] <= due) break;
			dues[i] = dues[parent];
			values[i] = values[parent];
			i = parent;
		}
		dues[i] = due;
		values[i] = value;
		if (this.onpush) this.onpush(due);
	}

	// removes and returns the earliest payload - call peek() first, there's no emptiness check
	shift() {
		const dues = this.due;
		const values = this.value;
		const top = values[0];
		const lastDue = dues.pop();
		const lastValue = values.pop();
		const n = dues.length;
		if (n) {
			let i = 0;
			for (;;) {
				const left = 2 * i + 1;
				if (left >= n) break;
				const right = left + 1;
				const child = right < n && dues[right] < dues[left] ? right : left;
				if (dues[child] >= lastDue) break;
				dues[i] = dues[child];
				values[i] = values[child];
				i = child;
			}
			dues[i] = lastDue;
			values[i] = lastValue;
		}
		return top;
	}

	clear() {
		this.due.length = 0;
		this.value.length = 0;
	}
}

module.exports = { DueQueue };
