/**
 * Discord integration for Adventure Land (gameserver outbound + main inbound).
 *
 *   require("./discord")           — enqueue + outbound helpers
 *   require("./discord/inbound")   — Gateway listener (main only)
 */

const enqueue = require("./enqueue.js");
const outbound = require("./outbound.js");

module.exports = {
	discord_enqueue: enqueue.discord_enqueue,
	DiscordRateLimiter: enqueue.DiscordRateLimiter,
	DISCORD_CLASS_EMOJIS: outbound.DISCORD_CLASS_EMOJIS,
	discord_token: outbound.discord_token,
	discord_should_post: outbound.discord_should_post,
	discord_event_channel_id: outbound.discord_event_channel_id,
	discord_public_chat_channel_id: outbound.discord_public_chat_channel_id,
	discord_call: outbound.discord_call,
	discord_public_chat: outbound.discord_public_chat,
};
