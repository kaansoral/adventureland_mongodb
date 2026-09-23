// Shared delivery for native chat and Communicator. A Communicator sender is
// only an owned name/account identity; it has no player or socket to control.
async function deliver_chat_message(sender, message, name) {
	async function log_message(owner, type, to) {
		await insert({
			_id: "MS_" + random_string(29),
			created: new Date(),
			owner: owner,
			author: sender.owner,
			fro: sender.name,
			to: to,
			type: type,
			info: { message: message },
			server: server_id,
			blobs: ["info"],
		});
	}
	if (name) {
		var target = get_player(name);
		if (sender.socket)
			sender.socket.emit(
				"pm",
				Object.assign(
					{ owner: sender.name, to: name, message: message, id: sender.id },
					target ? {} : { xserver: true },
				),
			);
		if (target) target.socket.emit("pm", { owner: sender.name, message: message, id: sender.id });
		var owner = target ? target.owner : get_id((await get_owner(name)) || {});
		if (!owner) {
			if (sender.socket)
				sender.socket.emit(
					"pm",
					localization.message(
						"server.pm.delivery_failed",
						{},
						{ owner: sender.name, to: name, id: sender.id, xserver: true },
					),
				);
			return { failed: true, reason: "character_not_found" };
		}
		if (!target) {
			var character = await get_character(name);
			if (character && character.server) {
				var server = await get(character.server);
				if (server)
					await server_eval_direct(
						server,
						"var p=get_player(data.name); if(p) p.socket.emit('pm',{owner:data.owner,message:data.message,id:data.owner,xserver:true});",
						{ owner: sender.name, name: name, message: message },
						3000,
					);
			}
		}
		await log_message(owner, "private", [target ? target.name : name]);
		if (owner !== sender.owner) await log_message(sender.owner, "private", [target ? target.name : name]);
	} else {
		broadcast("chat_log", { owner: sender.name, message: message, id: sender.id, p: true });
		discord_call(message, sender.name);
		var owners = {};
		for (var id in players) {
			var player = players[id];
			owners[player.owner] = owners[player.owner] || [];
			owners[player.owner].push(player.name);
		}
		// Preserve the native background, sequential account-history writes.
		(async function () {
			for (var owner of Object.keys(owners)) await log_message(owner, "ambient", owners[owner]);
		})().catch(function (error) {
			console.error("log_chat ambient error", error);
		});
		await log_message("~" + server_id, "server");
		await log_message("~global", "server");
	}
	return { success: true };
}
