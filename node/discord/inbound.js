/**
 * Discord → game chat Gateway listener (main process only).
 * Routes messages from per-server Discord channels to POST /discord_chat on that GS.
 *
 * Call start_discord_inbound(deps) from main.js after adventure_functions is eval'd.
 * deps: { options, keys, get_servers, server_discord_chat }
 */

function build_channel_to_server_map(discord) {
	const servers = (discord.channels && discord.channels.servers) || {};
	const map = {};
	const keys_list = Object.keys(servers);
	for (let i = 0; i < keys_list.length; i++) {
		const serverKey = keys_list[i];
		const channelId = servers[serverKey];
		if (!channelId) continue;
		if (map[channelId]) {
			console.error(
				"discord_inbound: duplicate channelId " + channelId + " for " + map[channelId] + " and " + serverKey,
			);
			return null;
		}
		map[channelId] = serverKey;
	}
	return map;
}

function safe_discord_owner(displayName) {
	// Avoid "Discord:name" — add_chat renders "owner: message", which looked like Discord:thmsn: …
	return "[Discord] " + String(displayName || "user").replace(/[<>&"']/g, "");
}

function get_discord_token(keys) {
	return (keys.discord && keys.discord.token) || keys.discord_token || "";
}

/**
 * @param {{ options: object, keys: object, get_servers: Function, server_discord_chat: Function }} deps
 */
async function start_discord_inbound(deps) {
	if (!deps || !deps.options || !deps.keys) {
		console.error("discord_inbound: missing deps (options/keys)");
		return;
	}
	const options = deps.options;
	const keys = deps.keys;
	const get_servers = deps.get_servers;
	const server_discord_chat = deps.server_discord_chat;

	const discord = options.discord || {};
	if (!discord.enabled || !discord.inbound || !discord.inbound.enabled) {
		return;
	}
	if (discord.chatMode && discord.chatMode !== "per_server") {
		console.log("discord_inbound: inbound only runs for chatMode per_server");
		return;
	}
	const token = get_discord_token(keys);
	if (!token) {
		console.log("discord_inbound: no discord token");
		return;
	}
	const channelMap = build_channel_to_server_map(discord);
	if (!channelMap || !Object.keys(channelMap).length) {
		console.log("discord_inbound: no channels.servers mapped");
		return;
	}

	let Discord;
	try {
		Discord = require("discord.js");
	} catch (e) {
		console.error("discord_inbound: install discord.js on the main process (npm i discord.js)");
		return;
	}

	const client = new Discord.Client({
		intents: [
			Discord.GatewayIntentBits.Guilds,
			Discord.GatewayIntentBits.GuildMessages,
			Discord.GatewayIntentBits.MessageContent,
		],
	});

	client.once("ready", function () {
		console.log("discord_inbound: logged in as " + client.user.tag);
	});

	client.on("messageCreate", async function (message) {
		try {
			if (!message || !message.channelId) return;
			if (message.author && message.author.bot) return;
			if (message.webhookId) return;
			if (client.user && message.author && message.author.id === client.user.id) return;

			const serverKey = channelMap[message.channelId];
			if (!serverKey) return;

			let content = (message.content || "").trim();
			if (!content) return;
			if (content.length > 1200) content = content.substr(0, 1200);

			const servers = await get_servers();
			let target = null;
			for (let i = 0; i < servers.length; i++) {
				if (servers[i].key === serverKey) {
					target = servers[i];
					break;
				}
			}
			if (!target) {
				console.log("discord_inbound: no online server for key " + serverKey);
				return;
			}

			const display =
				(message.member && message.member.displayName) ||
				(message.author && (message.author.globalName || message.author.username)) ||
				"user";

			await server_discord_chat(target, {
				owner: safe_discord_owner(display),
				message: content,
				color: "#5865F2",
			});
		} catch (err) {
			console.error("discord_inbound messageCreate error", err);
		}
	});

	client.on("error", function (err) {
		console.error("discord_inbound client error", err);
	});

	await client.login(token);
}

module.exports = {
	start_discord_inbound: start_discord_inbound,
	build_channel_to_server_map: build_channel_to_server_map,
};
