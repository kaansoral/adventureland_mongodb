// Shared game-server scope. A database claim belongs to one login, not merely a realm.
var pending_logins = new Map();
var character_login_timeout = 60000;

function owns_character_session(entity, player) {
	return !!(
		entity &&
		entity.server === server_id &&
		entity.owner === player.owner &&
		typeof player.secret === "string" &&
		player.secret.length &&
		entity.info &&
		entity.info.secret === player.secret
	);
}

function check_character_login(attempt, stage) {
	attempt.stage = stage;
	if (
		attempt.cancelled ||
		Date.now() >= attempt.deadline ||
		!server.live ||
		!attempt.socket.connected ||
		!observers[attempt.socket.id] ||
		pending_logins.get(attempt.id) !== attempt
	)
		throw new Error("Login cancelled at " + stage);
}

function finish_character_login(attempt) {
	attempt.finished = true;
	clearTimeout(attempt.timer);
	if (pending_logins.get(attempt.id) === attempt) pending_logins.delete(attempt.id);
	if (attempt.socket.login_attempt === attempt) delete attempt.socket.login_attempt;
}

async function release_character_login(attempt) {
	// A timeout does not cancel an in-flight commit. Wait for its outcome first.
	if (!attempt.cancelled || attempt.claiming || attempt.registered || attempt.releasing || attempt.finished) return;
	if (!attempt.claim_written) {
		finish_character_login(attempt);
		return;
	}
	attempt.releasing = true;
	try {
		var result = await tx(
			async () => {
				var entity = await tx_get(A.id);
				if (!entity) return;
				if (entity.server === server_id && entity.info && entity.info.secret === A.secret) {
					entity.online = false;
					entity.server = "";
				}
				// Even an uncertain claim needs a write barrier: a read that finds no
				// matching claim cannot rule out a late commit from the older snapshot.
				// This bounded nonce changes no inventory, bank, or newer session claim.
				entity.login_cleanup = A.secret;
				await tx_save(entity);
			},
			{ id: attempt.id, secret: attempt.secret },
		);
		if (result.success) finish_character_login(attempt);
		else server_log("#X Login claim release pending: " + attempt.id, 1);
	} catch (e) {
		server_log("#X Login claim release failed: " + attempt.id, 1);
	} finally {
		attempt.releasing = false;
	}
}

function cancel_character_login(attempt) {
	if (!attempt || attempt.cancelled) return;
	attempt.cancelled = true;
	clearTimeout(attempt.timer);
	if (attempt.registered) {
		// Published players must retain all inventory/bank changes through normal logout.
		if (players[attempt.socket.id] === attempt.player) attempt.socket.disconnect();
		finish_character_login(attempt);
	} else {
		void release_character_login(attempt);
	}
}

function retry_character_logins() {
	for (var attempt of pending_logins.values()) {
		if (!server.live || Date.now() >= attempt.deadline) cancel_character_login(attempt);
		if (attempt.cancelled) void release_character_login(attempt);
	}
}

async function character_save_tx(callback, args, tries) {
	try {
		return await tx(callback, args, tries);
	} catch (e) {
		// Keep the snapshot queued; a failed database call must not strand its busy flag.
		server_log("#X Character save transaction failed", 1);
		return { failed: true, reason: "exception" };
	}
}
