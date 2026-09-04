/**
 * Discord rate-limited sender for Adventure Land gameserver.
 */

function DiscordRateLimiter() {
	this.channelQueues = new Map();
	this.processing = new Set();
	this.lastRequest = 0;
	this.retryAfter = 0;
	this.channelLimits = new Map();
}

DiscordRateLimiter.prototype.enqueue = function (message, callback) {
	const channelId = message.channelId;
	if (!this.channelQueues.has(channelId)) {
		this.channelQueues.set(channelId, []);
	}
	this.channelQueues.get(channelId).push({ message: message, callback: callback });
	this.processQueue(channelId);
};

DiscordRateLimiter.prototype.processQueue = async function (channelId) {
	if (this.processing.has(channelId)) {
		return;
	}
	this.processing.add(channelId);

	try {
		while (this.channelQueues.has(channelId) && this.channelQueues.get(channelId).length > 0) {
			let now = Date.now();
			if (this.retryAfter > now) {
				await sleep(this.retryAfter - now);
				now = Date.now();
			}
			const channelReset = this.channelLimits.get(channelId) || 0;
			if (channelReset > now) {
				await sleep(channelReset - now);
				now = Date.now();
			}
			const sinceLast = now - this.lastRequest;
			if (sinceLast < 20) {
				await sleep(20 - sinceLast);
				now = Date.now();
			}

			const item = this.channelQueues.get(channelId).shift();
			if (!item) {
				break;
			}

			try {
				const response = await fetch(item.message.url, {
					method: "POST",
					headers: item.message.headers,
					body: JSON.stringify(item.message.payload),
				});
				this.lastRequest = Date.now();

				if (response.status === 429) {
					const retryAfterHeader = response.headers.get("retry-after");
					const retryMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : 1000;
					const isGlobal = response.headers.get("x-ratelimit-global");
					if (isGlobal) {
						this.retryAfter = Date.now() + retryMs;
					} else {
						this.channelLimits.set(channelId, Date.now() + retryMs);
					}
					this.channelQueues.get(channelId).unshift(item);
					continue;
				}

				if (!response.ok) {
					if (item.callback) {
						item.callback(new Error("Discord API error: " + response.status));
					}
					continue;
				}

				const resetAfter = response.headers.get("x-ratelimit-reset-after");
				const remaining = response.headers.get("x-ratelimit-remaining");
				if (remaining === "0" && resetAfter) {
					this.channelLimits.set(channelId, Date.now() + parseFloat(resetAfter) * 1000);
				}
				if (item.callback) {
					item.callback(null, response);
				}
			} catch (err) {
				if (item.callback) {
					item.callback(err);
				}
			}
		}
	} finally {
		this.processing.delete(channelId);
		if (this.channelQueues.has(channelId) && this.channelQueues.get(channelId).length > 0) {
			const self = this;
			setImmediate(function () {
				self.processQueue(channelId);
			});
		}
	}
};

function sleep(ms) {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});
}

const rateLimiter = new DiscordRateLimiter();

/**
 * Queue a Discord bot message with per-channel rate limiting.
 * @param {string} channelId
 * @param {string} token
 * @param {object} payload
 * @param {function} [callback]
 */
function discord_enqueue(channelId, token, payload, callback) {
	if (!channelId || !token) {
		return;
	}
	if (!payload.allowed_mentions) {
		payload.allowed_mentions = { parse: [] };
	}
	rateLimiter.enqueue(
		{
			channelId: channelId,
			url: "https://discord.com/api/v10/channels/" + channelId + "/messages",
			headers: {
				Authorization: "Bot " + token,
				"Content-Type": "application/json",
			},
			payload: payload,
		},
		callback ||
			function (err) {
				if (err) {
					console.log("discord_call error", err);
				}
			},
	);
}

module.exports = {
	discord_enqueue: discord_enqueue,
	DiscordRateLimiter: DiscordRateLimiter,
};
