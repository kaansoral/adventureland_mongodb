const { randomBytes } = require("node:crypto");

const EVENTS_CHANNEL = "404333059018719233";
const JOINS_CHANNEL = "839163123499794481";
const MAX_QUEUE = 100;
const MAX_AGE = 120000;
const CHAT_INTERVAL = 10000;

function chatText(value, limit) {
	let result = "";
	for (const character of String(value)
		.replace(/\s+/g, " ")
		.replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")) {
		const escaped = /[\\`*_~|<>\[\]()]/.test(character) ? "\\" + character : character;
		if (result.length + escaped.length > limit) break;
		result += escaped;
	}
	return result.trim();
}

// One REST sender per game process. Chat is batched to reduce contention between
// realms; Discord's response headers remain authoritative across those processes.
module.exports = function createDiscordRelay({
	token,
	chatChannel,
	realm,
	enabled = true,
	fetch = globalThis.fetch,
	now = Date.now,
	schedule = setTimeout,
	cancel = clearTimeout,
	log = console.error,
}) {
	const channel = (id, chat = false) => ({ id, chat, queue: [], pending: null, until: 0, disabled: false });
	const events = channel(EVENTS_CHANNEL);
	const joins = channel(JOINS_CHANNEL);
	const chat = channel(chatChannel, true);
	chat.disabled =
		typeof chatChannel !== "string" ||
		!/^\d{17,20}$/.test(chatChannel) ||
		[EVENTS_CHANNEL, JOINS_CHANNEL].includes(chatChannel);
	const channels = [events, joins, chat];
	let stopped = !enabled || !token,
		sending = false,
		timer = null,
		controller = null,
		globalUntil = 0,
		nextRequest = 0,
		lastWarning = -Infinity;

	function warn(reason) {
		if (now() - lastWarning < 60000) return;
		lastWarning = now();
		// Never log tokens, response bodies, or player messages.
		log("Discord relay: " + reason);
	}
	function seconds(value) {
		const number = Number(value);
		return Number.isFinite(number) && number > 0 ? number * 1000 : 0;
	}
	function enqueue(state, content) {
		if (stopped || state.disabled || typeof content !== "string" || !content.trim()) return false;
		if (state.queue.length >= MAX_QUEUE) {
			warn("queue full; message dropped");
			return false;
		}
		state.queue.push({ content: content.slice(0, 2000).replace(/[\uD800-\uDBFF]$/, ""), created: now() });
		pump();
		return true;
	}
	function stop() {
		stopped = true;
		if (timer !== null) cancel(timer);
		timer = null;
		if (controller) controller.abort();
		for (const state of channels) {
			state.queue.length = 0;
			state.pending = null;
		}
	}
	function pump() {
		if (stopped || sending) return;
		if (timer !== null) cancel(timer);
		timer = null;
		const time = now();
		let selected = null,
			due = Infinity,
			expires = Infinity;
		for (const state of channels) {
			if (state.disabled) continue;
			while (state.queue.length && time - state.queue[0].created >= MAX_AGE) {
				state.queue.shift();
				warn("expired message dropped");
			}
			if (state.pending && time - state.pending.created >= MAX_AGE) {
				state.pending = null;
				warn("expired batch dropped");
			}
			const first = state.pending || state.queue[0];
			if (!first) continue;
			expires = Math.min(expires, first.created + MAX_AGE);
			const ready = Math.max(
				globalUntil,
				nextRequest,
				state.until,
				first.created + (state.chat && !state.pending ? CHAT_INTERVAL : 0),
			);
			if (ready < due) {
				selected = state;
				due = ready;
			}
		}
		if (!selected) return;
		if (due > time) {
			timer = schedule(pump, Math.min(due, expires) - time);
			timer.unref?.();
			return;
		}
		if (!selected.pending) {
			const first = selected.queue.shift();
			let content = first.content;
			while (selected.chat && selected.queue.length && content.length + selected.queue[0].content.length + 1 <= 2000)
				content += "\n" + selected.queue.shift().content;
			selected.pending = {
				created: first.created,
				attempts: 0,
				payload: {
					content,
					allowed_mentions: { parse: [] },
					nonce: randomBytes(12).toString("hex"),
					enforce_nonce: true,
					...(selected.chat ? { flags: 4 } : {}),
				},
			};
		}
		sending = true;
		void deliver(selected);
	}
	async function deliver(state) {
		const pending = state.pending;
		pending.attempts++;
		controller = new AbortController();
		const timeout = schedule(() => controller?.abort(), 5000);
		let retry = false;
		try {
			const response = await fetch("https://discord.com/api/v10/channels/" + state.id + "/messages", {
				method: "POST",
				headers: { Authorization: "Bot " + token, "Content-Type": "application/json" },
				body: JSON.stringify(pending.payload),
				signal: controller.signal,
			});
			const reset = seconds(response.headers.get("x-ratelimit-reset-after"));
			if (response.headers.get("x-ratelimit-remaining") === "0") state.until = Math.max(state.until, now() + reset);
			if (response.status === 429) {
				const body = (await response.json().catch(() => null)) || {};
				const delay =
					Math.max(seconds(response.headers.get("retry-after")), seconds(body.retry_after), reset, 1000) + 250;
				if (
					body.global ||
					response.headers.get("x-ratelimit-global") === "true" ||
					response.headers.get("x-ratelimit-scope") === "global"
				)
					globalUntil = now() + delay;
				else state.until = Math.max(state.until, now() + delay);
				retry = true;
			} else {
				await response.body?.cancel();
				if (response.status === 401) {
					warn("HTTP 401; disabled until restart");
					stop();
				} else if (response.status === 403 || response.status === 404) {
					warn("HTTP " + response.status + "; channel disabled until restart");
					state.disabled = true;
					state.queue.length = 0;
				} else if (!response.ok) {
					warn("HTTP " + response.status);
					retry = response.status >= 500;
				}
			}
		} catch (error) {
			if (!stopped) warn("request failed or timed out");
			retry = true;
		} finally {
			cancel(timeout);
			controller = null;
			sending = false;
			nextRequest = now() + 1000;
			if (retry && pending.attempts < 3 && now() - pending.created < MAX_AGE && !stopped) {
				state.until = Math.max(state.until, now() + pending.attempts * 2000);
			} else {
				if (retry && !stopped) warn("retry limit reached; batch dropped");
				state.pending = null;
				if (state.chat) state.until = Math.max(state.until, now() + CHAT_INTERVAL);
			}
			pump();
		}
	}
	return {
		event(message) {
			return enqueue(
				typeof message === "string" && message.includes(" joined Adventure Land") ? joins : events,
				message,
			);
		},
		chat(name, message) {
			if (stopped || chat.disabled || typeof name !== "string" || typeof message !== "string" || !message.trim())
				return false;
			return enqueue(chat, "[" + chatText(realm, 32) + "] **" + chatText(name, 80) + ":** " + chatText(message, 1800));
		},
		stop,
	};
};
