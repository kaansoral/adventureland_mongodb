"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { encode } = require("@msgpack/msgpack");
const parserModule = require("../msgpack_parser");

function roundTrip(packet, parser = parserModule) {
	const encoded = new parser.Encoder().encode(packet);
	let decoded;
	const decoder = new parser.Decoder();
	decoder.on("decoded", (value) => {
		decoded = value;
	});
	decoder.add(encoded[0]);
	return { encoded: encoded[0], decoded };
}

test("uses the compact positional frame", () => {
	const { encoded, decoded } = roundTrip({ type: 2, nsp: "/", data: ["hello", "you"] });
	assert.equal(Buffer.from(encoded).toString("hex"), "920292a568656c6c6fa3796f75");
	assert.equal(encoded.byteLength, 13);
	assert.deepEqual(decoded, { type: 2, nsp: "/", data: ["hello", "you"] });
});

test("round-trips every supported Socket.IO packet shape", () => {
	const packets = [
		{ type: 0, nsp: "/", data: { token: "test" } },
		{ type: 1, nsp: "/" },
		{ type: 2, nsp: "/", id: 7, data: ["event", { ok: true }] },
		{ type: 3, nsp: "/", id: 7, data: ["done"] },
		{ type: 4, nsp: "/", data: { message: "denied" } },
	];
	for (const packet of packets) assert.deepEqual(roundTrip(packet).decoded, packet);
});

test("preserves JSON serialization behavior", () => {
	const packet = {
		type: 2,
		nsp: "/",
		data: [
			"values",
			{
				date: new Date("2026-08-24T12:00:00.000Z"),
				missing: undefined,
				nan: NaN,
				infinity: Infinity,
				negativeZero: -0,
				array: [undefined, "ıstanbul"],
			},
		],
	};
	assert.deepEqual(roundTrip(packet).decoded.data[1], {
		date: "2026-08-24T12:00:00.000Z",
		nan: null,
		infinity: null,
		negativeZero: 0,
		array: [null, "ıstanbul"],
	});
});

test("rejects namespaces, reserved events, binary values, and unsafe ids", () => {
	const encoder = new parserModule.Encoder();
	assert.throws(() => encoder.encode({ type: 2, nsp: "/admin", data: ["hello"] }), /root namespace/);
	assert.throws(() => encoder.encode({ type: 2, nsp: "/", data: ["disconnect"] }), /EVENT payload/);
	assert.throws(() => encoder.encode({ type: 2, nsp: "/", data: ["data", Buffer.from("x")] }), /binary/);
	assert.throws(() => encoder.encode({ type: 3, nsp: "/", id: -1, data: [] }), /packet id/);
});

test("rejects malformed, oversized, binary, extension, and polluted frames", () => {
	const LimitedParser = parserModule.createParser({ maxPacketBytes: 16 });
	const decoder = new LimitedParser.Decoder();
	const defaultDecoder = new parserModule.Decoder();
	assert.throws(() => decoder.add("9200"), /binary transport/);
	assert.throws(() => decoder.add(new Uint8Array(17)), /packet size/);
	assert.throws(() => decoder.add(Uint8Array.from([0x92, 0x02])), /Insufficient data|Offset is outside/);
	assert.throws(() => decoder.add(encode([2, ["event", Uint8Array.from([1])]])), /Max length exceeded|JSON-compatible/);
	assert.throws(
		() => decoder.add(Uint8Array.from([0x92, 0x02, 0x92, 0xa5, 0x65, 0x76, 0x65, 0x6e, 0x74, 0xc7, 0x00, 0x01])),
		/JSON-compatible/,
	);
	assert.throws(
		() =>
			defaultDecoder.add(
				Uint8Array.from([
					0x92, 0x02, 0x92, 0xa5, 0x65, 0x76, 0x65, 0x6e, 0x74, 0x81, 0xa9, 0x5f, 0x5f, 0x70, 0x72, 0x6f, 0x74, 0x6f,
					0x5f, 0x5f, 0xc0,
				]),
			),
		/__proto__/,
	);
});

test("derives an unversioned sibling path", () => {
	assert.equal(parserModule.msgpackPath("/ws1/"), "/ws1-msgpack/");
	assert.equal(parserModule.msgpackPath("/socket"), "/socket-msgpack/");
	assert.equal(parserModule.msgpackPath("/"), "/msgpack/");
});
