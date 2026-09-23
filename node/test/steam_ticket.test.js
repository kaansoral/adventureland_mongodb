const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");
const protobuf = require("protobufjs");
const SteamAppTicket = require("steam-appticket");
const { crc32 } = require("@doctormckay/stdlib/hashing");
const { load, read } = require("./helpers/server_vm");

const Ticket = protobuf.Root.fromJSON({
	nested: {
		EncryptedAppTicket: {
			fields: {
				ticketVersionNo: { type: "uint32", id: 1 },
				crcEncryptedticket: { type: "uint32", id: 2 },
				cbEncrypteduserdata: { type: "uint32", id: 3 },
				cbEncryptedAppownershipticket: { type: "uint32", id: 4 },
				encryptedTicket: { type: "bytes", id: 5 },
			},
		},
	},
}).lookupType("EncryptedAppTicket");

function setup() {
	const key = crypto.randomBytes(32);
	const oldKey = crypto.randomBytes(32);
	const context = vm.createContext({
		Buffer,
		crypto,
		EncryptedAppTicket: Ticket,
		SteamAppTicket,
		keys: { steam_key: key.toString("hex"), old_steam_key: oldKey.toString("hex") },
	});
	load(context, "node/server_functions.js", ["verify_steam_ticket", "symmetricDecrypt"]);
	const player = () => ({ p: {}, s: { authfail: { ms: 1000 } } });
	return { context, key, oldKey, player, verify: context.verify_steam_ticket };
}

// Synthetic tickets use fresh random keys, never a real account or service key.
function make_ticket(key, options = {}) {
	const ownership = Buffer.alloc(50);
	ownership.writeUInt32LE(ownership.length, 0);
	ownership.writeUInt32LE(1, 4);
	ownership.writeBigUInt64LE(76561198000000000n, 8);
	ownership.writeUInt32LE(options.app || 777150, 16);
	ownership.writeUInt32LE(options.issued || Math.floor(Date.now() / 1000), 32);
	ownership.writeUInt32LE(0xffffffff, 36);
	ownership.writeUInt16LE(1, 40);
	ownership.writeUInt32LE(1, 42);
	const extra = options.version === 2 ? Buffer.alloc(20) : Buffer.alloc(0);
	const salt = crypto.randomBytes(8);
	const hash = crypto
		.createHash("sha1")
		.update(Buffer.concat([ownership, extra, salt]))
		.digest();
	if (options.badHash) hash[0] ^= 1;
	const plaintext = Buffer.concat([ownership, extra, salt, hash, Buffer.alloc(4)]);
	const iv = crypto.randomBytes(16);
	const encryptIv = crypto.createCipheriv("aes-256-ecb", key, null);
	encryptIv.setAutoPadding(false);
	const encryptData = crypto.createCipheriv("aes-256-cbc", key, iv);
	const encrypted = Buffer.concat([
		encryptIv.update(iv),
		encryptIv.final(),
		encryptData.update(plaintext),
		encryptData.final(),
	]);
	return Buffer.from(
		Ticket.encode({
			ticketVersionNo: options.version || 1,
			crcEncryptedticket: (crc32(plaintext) ^ (options.badCrc ? 1 : 0)) >>> 0,
			cbEncrypteduserdata: 0,
			cbEncryptedAppownershipticket: ownership.length,
			encryptedTicket: encrypted,
		}).finish(),
	).toString("hex");
}

test("legacy Steam accepts valid encrypted tickets with the current key", () => {
	const f = setup();
	for (const version of [1, 2]) {
		const player = f.player();
		assert.equal(f.verify(player, make_ticket(f.key, { version })), true);
		assert.equal(player.auth_id, "76561198000000000");
		assert.equal(player.p.steam_id, player.auth_id);
		assert.equal(player.auth_type, "steam");
		assert.equal(player.s.authfail, undefined);
	}
});

test("legacy Steam rejects retired keys, corrupt tickets, wrong apps and expired tickets without mutation", () => {
	const f = setup();
	const now = Math.floor(Date.now() / 1000);
	for (const ticket of [
		make_ticket(f.oldKey),
		make_ticket(f.key, { badHash: true }),
		make_ticket(f.key, { badCrc: true }),
		make_ticket(f.key, { app: 480 }),
		make_ticket(f.key, { issued: now - 21 * 86400 - 1 }),
		make_ticket(f.key, { issued: now + 600 }),
		"00",
		"abc",
		"not-hex",
		null,
		{},
		"ab".repeat(4097),
	]) {
		const player = f.player();
		const before = structuredClone(player);
		assert.equal(f.verify(player, ticket), false);
		assert.deepEqual(player, before);
	}
});

test("legacy Steam tolerates small clock differences and fails closed without a current key", () => {
	const f = setup();
	assert.equal(f.verify(f.player(), make_ticket(f.key, { issued: Math.floor(Date.now() / 1000) + 60 })), true);
	delete f.context.keys.steam_key;
	assert.equal(f.verify(f.player(), make_ticket(f.oldKey)), false);
});

test("the login branch never persists a Steam link after a rejected ticket", async () => {
	const source = read("node/server.js");
	const start = source.indexOf('} else if (data.epl == "steam" && data.ticket) {');
	const end = source.indexOf('} else if (data.epl == "tauri_steam")', start);
	assert.ok(start > 0 && end > start);
	const branch = source.slice(source.indexOf("{", start) + 1, end);
	for (const accepted of [false, true]) {
		let writes = 0;
		const player = { p: { steam_id: "76561198000000000" }, s: {} };
		const context = vm.createContext({
			player,
			owner: {},
			entity: {},
			data: { auth: "fixture-auth", ticket: "fixture" },
			verify_steam_ticket: () => accepted,
			persist_tauri_steam_install: async () => {
				writes++;
				return true;
			},
		});
		await vm.runInContext("(async () => {" + branch + "})()", context);
		assert.equal(writes, accepted ? 1 : 0);
		assert.equal(player.platform, accepted ? "steam" : "web");
	}
});
