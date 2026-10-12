"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const STOCK = require("socket.io-parser");
const { RawFrame, createParser, probe } = require("../json_parser.js");
const msgpack = require("../msgpack_parser.js");

const parser = createParser();
const fast = new parser.Encoder();
const stock = new STOCK.Encoder();
const pkt = (arg, extra) => Object.assign({ type: 2, nsp: "/", data: ["entities", arg] }, extra);

function entitiesPayload() {
	return {
		players: [
			{
				id: "Kaan",
				x: 1.5,
				y: -2.25,
				moving: true,
				going_x: 9,
				going_y: 0,
				cid: 3,
				s: { mluck: { ms: 10, f: "Kaan" } },
				slots: { mainhand: { name: "firestaff", level: 8, v: new Date("2026-08-24T12:00:00.000Z") } },
			},
			{ id: 'Ünïcode"\\/\n', x: 0, y: 0, hp: 1, quote: 'he said "hi"', empty: undefined },
		],
		monsters: [{ id: "M1", type: "bee", x: -3, y: 4, hp: 10, level: 2, s: {} }],
		type: "xy",
		in: "main",
		map: "main",
	};
}
function raw(value) {
	return new RawFrame(value, JSON.stringify(value));
}

test("fast path output is byte-identical to the stock parser", () => {
	const value = entitiesPayload();
	assert.equal(fast.encode(pkt(raw(value)))[0], stock.encode(pkt(value))[0]);
});

test("a RawFrame still encodes correctly through the STOCK parser (parser removed / reverted)", () => {
	const value = entitiesPayload();
	assert.equal(stock.encode(pkt(raw(value)))[0], stock.encode(pkt(value))[0]);
});

test("a RawFrame still encodes correctly through the MessagePack parser", () => {
	const mp = new (msgpack.createParser({ maxPacketBytes: 262144 }).Encoder)();
	const value = entitiesPayload();
	assert.deepEqual(Buffer.from(mp.encode(pkt(raw(value)))[0]), Buffer.from(mp.encode(pkt(value))[0]));
});

test("non-RawFrame packets are delegated to the stock encoder unchanged", () => {
	const shapes = [
		{ type: 0, nsp: "/" },
		{ type: 0, nsp: "/", data: { sid: "abc", pid: "x" } },
		{ type: 1, nsp: "/" },
		{ type: 2, nsp: "/", data: ["ev", { ok: true }] },
		{ type: 2, nsp: "/", id: 7, data: ["ev", 1, 2] },
		{ type: 3, nsp: "/", id: 7, data: ["done"] },
		{ type: 4, nsp: "/", data: { message: "denied" } },
		{ type: 2, nsp: "/", data: ["ev", { d: new Date("2026-01-02T03:04:05.000Z"), u: undefined, n: NaN, z: -0 }] },
	];
	for (const shape of shapes) assert.deepEqual(fast.encode(shape), stock.encode(shape));
});

test("an acked RawFrame packet falls back to the stock path", () => {
	const value = entitiesPayload();
	assert.deepEqual(fast.encode(pkt(raw(value), { id: 4 })), stock.encode(pkt(value, { id: 4 })));
});

test("the fast frame decodes back to the original payload", () => {
	const value = entitiesPayload();
	const decoder = new parser.Decoder();
	let decoded = null;
	decoder.on("decoded", (p) => (decoded = p));
	decoder.add(fast.encode(pkt(raw(value)))[0]);
	assert.deepEqual(decoded.data, JSON.parse(JSON.stringify(["entities", value])));
});

test("the probe accepts the shipped parser and rejects a changed frame format", () => {
	assert.equal(probe(STOCK), true);
	const changedFormat = {
		protocol: 5,
		PacketType: STOCK.PacketType,
		Decoder: STOCK.Decoder,
		Encoder: class extends STOCK.Encoder {
			encode(p) {
				return ["X" + super.encode(p)[0]];
			}
		},
	};
	assert.equal(probe(changedFormat), false);
	const bumpedProtocol = { protocol: 6, PacketType: STOCK.PacketType, Decoder: STOCK.Decoder, Encoder: STOCK.Encoder };
	assert.equal(probe(bumpedProtocol), false);
});

test("a parser whose probe fails still produces the new library's output", () => {
	const changedFormat = {
		protocol: 6,
		PacketType: STOCK.PacketType,
		Decoder: STOCK.Decoder,
		Encoder: class extends STOCK.Encoder {
			encode(p) {
				return ["X" + super.encode(p)[0]];
			}
		},
	};
	const degraded = createParser(changedFormat);
	assert.equal(degraded.fastPathEnabled, false);
	const value = entitiesPayload();
	assert.deepEqual(new degraded.Encoder().encode(pkt(raw(value))), new changedFormat.Encoder().encode(pkt(value)));
});

test("RawFrame carries its value for anything that inspects the packet", () => {
	const value = { a: 1 };
	const frame = raw(value);
	assert.equal(frame.toJSON(), value);
	assert.equal(JSON.stringify(frame), JSON.stringify(value));
});

test("a json-only RawFrame reconstructs its value for the fallback paths", () => {
	const value = entitiesPayload();
	const json = JSON.stringify(value);
	const frame = new RawFrame(undefined, json);
	assert.equal(fast.encode(pkt(frame))[0], stock.encode(pkt(value))[0]);
	// the stock parser has to fall back through toJSON(), and must still match
	const frame2 = new RawFrame(undefined, json);
	assert.equal(stock.encode(pkt(frame2))[0], stock.encode(pkt(value))[0]);
	const mp = new (msgpack.createParser({ maxPacketBytes: 262144 }).Encoder)();
	const frame3 = new RawFrame(undefined, json);
	assert.deepEqual(Buffer.from(mp.encode(pkt(frame3))[0]), Buffer.from(mp.encode(pkt(value))[0]));
});
