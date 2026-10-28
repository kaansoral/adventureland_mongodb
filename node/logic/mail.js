// Mail and the sender's inventory commit together, using the character-save lock.
function mail_send_busy(player) {
	return (
		player.mail_sending ||
		player.merrit_grant ||
		player.sync_call ||
		player.mount_call ||
		player.unmount_call ||
		player.stop_call ||
		player.mounting ||
		player.unmounting ||
		player.knocking ||
		player.poker_saving
	);
}

function finish_mail_send(player, sent, reason) {
	var pending = player.mail_sending;
	if (!pending) return;
	if (pending.slot_item && pending.giveaway_slot) {
		if (player.slots[pending.giveaway_slot] !== pending.slot_item) throw Error("giveaway reservation missing");
		if (!sent) pending.original_item.giveaway = 5;
		player.slots[pending.giveaway_slot] = sent ? null : pending.original_item;
		player.cslots[pending.giveaway_slot] = cache_item(player.slots[pending.giveaway_slot], true);
	} else if (pending.slot_item) {
		var slot = player.items.indexOf(pending.slot_item);
		if (slot < 0) throw Error("mail reservation missing");
		player.items[slot] = sent ? null : pending.item;
		player.citems[slot] = cache_item(player.items[slot]);
	}
	if (!sent && pending.cost) player.gold += pending.cost;
	if (!sent && pending.original_item && player.slots[pending.giveaway_slot] === pending.original_item) {
		pending.original_item.giveaway = 5;
		if (reason === "nocharacter") {
			delete pending.original_item.mail_winner;
			pending.original_item.list = pending.original_item.list.filter(function (name) {
				return name !== pending.to;
			});
		}
		player.cslots[pending.giveaway_slot] = cache_item(player.slots[pending.giveaway_slot], true);
	}
	delete player.mail_sending;
	if (sent && pending.giveaway_slot) {
		add_to_trade_history(player, "giveaway", pending.to, cache_item(pending.item, true));
		xy_emit(
			player,
			"game_log",
			localization.message(
				"server.game_log.won_s_giveaway_of",
				{
					winner: String(pending.to),
					player: String(player.name),
					item: String(G.items[pending.item.name].name),
				},
				{ color: "#42A0DC", confetti: pending.to },
			),
		);
	}
	if (players[player.socket.id] === player) {
		resend(player, pending.giveaway_slot ? "reopen+u+cid" : "reopen");
		var response = sent ? "mail_sent" : "mail_failed";
		if (
			pending.giveaway_slot &&
			!sent &&
			pending.original_item &&
			pending.original_item.mail_waiting_reason !== reason
		) {
			pending.original_item.mail_waiting_reason = reason;
			player.socket.emit(
				"game_log",
				localization.message(
					"error." + (["mailbox_full", "mail_sender_limit", "nocharacter"].includes(reason) ? reason : "coms_failure"),
					{},
					{ color: "gray" },
				),
			);
		}
		if (!pending.giveaway_slot)
			player.socket.emit("game_response", {
				response: response,
				cevent: response,
				to: pending.to,
				request_id: pending.request_id,
				...(sent ? { success: true } : { failed: true, reason: reason || "coms_failure" }),
			});
	}
	if (sent && pending.receiver)
		update_mail_count(pending.receiver).catch(function (error) {
			log_trace("send_mail count", error);
		});
}

async function recover_mail_send(player) {
	var pending = player.mail_sending;
	if (!pending || !pending.recover || pending.checking || Date.now() < (pending.retry_at || 0)) return;
	pending.checking = true;
	try {
		var result = await tx(
			async () => {
				R.sent = false;
				var entity = await tx_get(A.character);
				var mail = await tx_get(A.id);
				if (mail || (entity && entity.mail_operation === A.id)) {
					R.sent = true;
					return;
				}
				if (!entity) ex("nocharacter");
				// Fence any late commit before returning the reserved item and postage.
				entity.mail_operation = A.id + ":cancelled";
				await tx_save(entity);
			},
			{ character: player.real_id, id: pending.id },
			3,
		);
		if (result.failed) throw Error("mail_recovery");
		finish_mail_send(player, !!result.sent, pending.reason);
	} catch (error) {
		pending.checking = false;
		pending.retry_at = Date.now() + 3000;
	}
}

// giveaway_slot is supplied only by the server's giveaway timer, never by a socket request.
async function send_player_mail(player, data, giveaway_slot) {
	if (mail_send_busy(player)) return;
	var pending = (player.mail_sending = {
		id: "ML_" + randomStr(50),
		to: data.to,
		request_id: data.request_id,
		giveaway_slot: giveaway_slot,
		original_item: giveaway_slot && player.slots[giveaway_slot],
	});
	try {
		var name = data.to.toLowerCase().replace(/\s+/g, "");
		var recipient = await db.collection("character").findOne({ name: name });
		if (!recipient) return finish_mail_send(player, false, "nocharacter");
		if (players[player.socket.id] !== player || player.dc) return finish_mail_send(player, false, "not_in_game");
		var item = data.item && (giveaway_slot ? player.slots[giveaway_slot] : player.items[0]);
		if (giveaway_slot && item !== pending.original_item) return finish_mail_send(player, false, "no_item");
		if (data.item && (!item || item.name === "placeholder")) return finish_mail_send(player, false, "no_item");
		if (item?.l) return finish_mail_send(player, false, "item_locked");
		if (item && (item.b || item.v)) return finish_mail_send(player, false, "item_blocked");
		var cost = giveaway_slot ? 0 : item ? 360000 : 48000;
		if (player.gold < cost) return finish_mail_send(player, false, "gold_not_enough");
		if (giveaway_slot) {
			pending.original_item = item;
			pending.participants = item.list.slice();
			item = JSON.parse(JSON.stringify(item));
			for (var key of ["list", "giveaway", "registry", "mail_winner", "mail_waiting_reason"]) delete item[key];
			item.gf = player.name;
			item.src = "gva";
		}
		pending.item = item;
		pending.cost = cost;
		pending.receiver = recipient.owner;
		player.gold -= cost;
		if (giveaway_slot) {
			player.slots[giveaway_slot] = pending.slot_item = { name: "placeholder", giveaway: 1, list: [] };
			player.cslots[giveaway_slot] = cache_item(pending.slot_item, true);
		} else if (item) player.items[0] = player.citems[0] = pending.slot_item = { name: "placeholder" };
		resend(player, "reopen");
		var result = await tx(
			async () => {
				var existing = await tx_get(A.id);
				if (existing) return;
				var entity = await tx_get(A.player.real_id);
				if (entity && entity.mail_operation === A.id) return;
				if (!owns_character_session(entity, A.player)) ex("not_in_game");
				var destination = await tx_get(A.recipient._id);
				if (!destination || destination.owner !== A.recipient.owner || destination.name !== A.recipient.name)
					ex("nocharacter");
				var sender = await tx_get(A.player.owner),
					receiver = await tx_get(destination.owner);
				if (!sender || !receiver) ex("nouser");
				if (A.item) {
					var guard_id = "IE_mailbox-" + destination._id;
					var guard = (await tx_get(guard_id)) || { _id: guard_id, created: new Date() };
					guard.last_mail = A.id;
					await tx_save(guard);
					var aliases = [destination.owner];
					if (/^US_\d+$/.test(destination.owner)) aliases.push(destination.owner.slice(3));
					var query = {
						owner: destination.owner,
						item: true,
						taken: { $ne: true },
						type: { $ne: "system" },
						cave_award: { $ne: true },
						tracktrix_gift: { $ne: true },
						mailbox_exempt: { $ne: true },
						$or: [
							{ mailbox_character: destination._id },
							{
								mailbox_character: { $exists: false },
								"info.receiver": { $in: aliases },
								to: new RegExp("^\\s*" + destination.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i"),
							},
						],
					};
					if ((await db.collection("mail").countDocuments(query, { session: session, limit: 200 })) >= 200)
						ex("mailbox_full");
					var senders = [A.player.owner];
					if (/^US_\d+$/.test(A.player.owner)) senders.push(A.player.owner.slice(3));
					query["info.sender"] = { $in: senders };
					if ((await db.collection("mail").countDocuments(query, { session: session, limit: 20 })) >= 20)
						ex("mail_sender_limit");
				}
				// Capture both sides of a mounted bank together, before either write can yield.
				var user_snapshot = A.player.user && structuredClone(A.player.user);
				sync_entity(entity, player_to_server(A.player, "mail"));
				entity = structuredClone(entity);
				var snapshot = entity.info;
				if (A.giveaway_slot) {
					if (A.player.slots[A.giveaway_slot] !== A.player.mail_sending.slot_item) ex("mail_reservation_missing");
					snapshot.slots[A.giveaway_slot] = null;
				} else if (A.item) {
					var slot = A.player.items.indexOf(A.player.mail_sending.slot_item);
					if (slot < 0) ex("mail_reservation_missing");
					snapshot.items[slot] = null;
				}
				if (user_snapshot) {
					if (sender.server !== server_id || sender.mounted_to !== get_id(A.player)) ex("bank_owner_lost");
					sender.info.gold = user_snapshot.gold;
					if (user_snapshot.unlocked) sender.info.unlocked = user_snapshot.unlocked;
					for (var pack in user_snapshot) if (pack.startsWith("items")) sender.info[pack] = user_snapshot[pack];
					sender.to_backup = true;
					await tx_save(sender);
				}
				entity.last_sync = new Date();
				entity.to_backup = true;
				entity.mail_operation = A.id;
				await tx_save(entity);
				var language = localization.normalize(receiver.language) || "en";
				await tx_save({
					_id: A.id,
					created: new Date(),
					read: false,
					item: !!A.item,
					taken: false,
					fro: A.player.name,
					to: A.to,
					type: "mail",
					mailbox_character: destination._id,
					owner: Array.from(new Set([sender._id, receiver._id])),
					info: {
						message: A.giveaway_slot
							? phrase(
									"server.mail.giveaway_message",
									{
										player: A.player.name,
										participants: A.player.mail_sending.participants.join(", "),
									},
									language,
								)
							: A.message,
						subject: A.giveaway_slot ? phrase("server.mail.giveaway_subject", {}, language) : A.subject,
						sender: sender._id,
						receiver: receiver._id,
						...(A.item ? { item: JSON.stringify(A.item) } : {}),
					},
					blobs: ["info"],
				});
			},
			{
				player: player,
				recipient: recipient,
				id: pending.id,
				item: item,
				to: data.to,
				giveaway_slot: giveaway_slot,
				subject: String(data.subject || "").substring(0, 74),
				message: String(data.message || "").substring(0, 1000),
			},
			3,
		);
		if (result.failed) {
			pending.reason = result.reason;
			// An earlier attempt may have committed without its acknowledgement.
			// Fence every transactional rejection before refunding the reservation.
			pending.recover = true;
			await recover_mail_send(player);
		} else finish_mail_send(player, true);
	} catch (error) {
		log_trace("send_mail", error);
		if (!pending.slot_item && !pending.cost) finish_mail_send(player, false, "coms_failure");
		else {
			pending.reason = "coms_failure";
			pending.recover = true;
			await recover_mail_send(player);
		}
	}
}
