/**
 * Gameserver → Discord outbound helpers (events + public chat).
 * Call with a GS ctx so this module does not depend on eval globals.
 *
 * ctx: { options, keys, gameplay, Dev, server_key, region, server_name, server_log }
 */

const enqueue = require("./enqueue.js");

const DISCORD_CLASS_EMOJIS = {
	warrior: "🛡️",
	mage: "🔮",
	priest: "✨",
	rogue: "🗡️",
	ranger: "🏹",
	paladin: "⚔️",
	merchant: "💰",
};

function discord_token(ctx) {
	const keys = ctx.keys;
	return (keys.discord && keys.discord.token) || keys.discord_token || "";
}

function discord_should_post(ctx) {
	if (ctx.gameplay == "hardcore" || ctx.gameplay == "test") {
		return false;
	}
	const discord_opts = ctx.options.discord || {};
	if (discord_opts.enabled === false) {
		return false;
	}
	// Explicit enabled:true allows local Dev testing; otherwise Dev only logs.
	if (ctx.Dev && discord_opts.enabled !== true) {
		return false;
	}
	return !!discord_token(ctx);
}

function discord_event_channel_id(message, ctx) {
	const channels = (ctx.options.discord && ctx.options.discord.channels) || {};
	const default_channel =
		channels.default === undefined || channels.default === null ? "404333059018719233" : channels.default;
	const join_channel = channels.join === undefined || channels.join === null ? "839163123499794481" : channels.join;
	if (message && message.search(" joined Adventure Land") != -1) {
		return join_channel;
	}
	return default_channel;
}

function discord_public_chat_channel_id(ctx) {
	const discord_opts = ctx.options.discord || {};
	const channels = discord_opts.channels || {};
	if (discord_opts.chatMode === "shared") {
		return channels.publicChat || "";
	}
	const servers = channels.servers || {};
	return servers[ctx.server_key] || "";
}

function discord_call(message, ctx) {
	if (!discord_should_post(ctx)) {
		if (ctx.Dev) {
			return ctx.server_log("Discord: " + message);
		}
		return;
	}
	const channel_id = discord_event_channel_id(message, ctx);
	if (!channel_id) {
		return;
	}
	enqueue.discord_enqueue(channel_id, discord_token(ctx), { content: message });
}

function discord_public_chat(player, message, ctx) {
	if (!discord_should_post(ctx)) {
		return;
	}
	const channel_id = discord_public_chat_channel_id(ctx);
	if (!channel_id) {
		return;
	}
	const discord_opts = ctx.options.discord || {};
	const classEmoji = DISCORD_CLASS_EMOJIS[player.ctype || player.type] || "";
	let prefix = "";
	// Per-server channels already imply the GS; only tag the server in shared mode.
	if (discord_opts.chatMode === "shared") {
		prefix = "[" + ctx.region + "-" + ctx.server_name + "] ";
	}
	const content =
		prefix +
		(classEmoji ? classEmoji + " " : "") +
		"**" +
		player.name +
		"** (" +
		player.level +
		"): " +
		message;
	enqueue.discord_enqueue(channel_id, discord_token(ctx), { content: content });
}

module.exports = {
	DISCORD_CLASS_EMOJIS: DISCORD_CLASS_EMOJIS,
	discord_token: discord_token,
	discord_should_post: discord_should_post,
	discord_event_channel_id: discord_event_channel_id,
	discord_public_chat_channel_id: discord_public_chat_channel_id,
	discord_call: discord_call,
	discord_public_chat: discord_public_chat,
};
