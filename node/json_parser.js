"use strict";
// #performance spree [26/09/26]: socket.io packet encoder with one fast path
// the stock encoder JSON.stringify'd every entity update once per recipient and scanned it for binary (hasBinary) - ~1/3 of all server CPU at 150 players
// send_xy_updates now builds each frame body once and hands it over as a RawFrame, written out verbatim:
//     <type><nsp,>?<id>?<json>          e.g.  2["entities",{...}]
// everything else goes to the stock encoder (those can carry binary, not ours to own), and the decoder is the stock one
// RawFrame.toJSON() returns the original value, so any JSON encoder (stock, msgpack) still produces the same bytes without this file
// a startup probe compares our frame with socket.io's - if an upgrade changes the format the fast path switches itself off: slower, never wrong
const STOCK = require("socket.io-parser");

const EVENT = 2;

class RawFrame {
	// new RawFrame(value) - the body is derived from the value
	// new RawFrame(undefined, json) - body only, the value is parsed back on demand (fallback path only)
	constructor(value, json) {
		this.value = value;
		this.json = json === undefined ? JSON.stringify(value) : json;
	}
	toJSON() {
		if (this.value === undefined) this.value = JSON.parse(this.json);
		return this.value;
	}
}

// a packet we can write ourselves, with certainty
function isRawEvent(packet) {
	return (
		packet.type === EVENT &&
		packet.nsp === "/" &&
		packet.id === undefined &&
		packet.data !== undefined &&
		packet.data.length === 2 &&
		packet.data[1] instanceof RawFrame
	);
}

function frame(packet) {
	return "2[" + JSON.stringify(packet.data[0]) + "," + packet.data[1].json + "]";
}

// does socket.io still frame such a packet the way we do?
function probe(Parser) {
	try {
		if (Parser.protocol !== 5) return false;
		const samples = [
			["ev", { a: 1, b: [1, "x", null], c: { d: true }, e: "ünïcode", f: 'quote"and\\slash' }],
			["entities", { players: [], monsters: [], type: "xy", in: "main", map: "main" }],
			["x", {}],
		];
		const stock = new Parser.Encoder();
		for (const data of samples) {
			const packet = { type: EVENT, nsp: "/", data: [data[0], new RawFrame(data[1])] };
			const theirs = stock.encode({ type: EVENT, nsp: "/", data: data });
			if (!Array.isArray(theirs) || theirs.length !== 1 || typeof theirs[0] !== "string") return false;
			if (theirs[0] !== frame(packet)) return false;
		}
		return true;
	} catch (e) {
		return false;
	}
}

function createParser(Parser) {
	Parser = Parser || STOCK;
	const fast = probe(Parser);
	class Encoder {
		constructor() {
			this.stock = new Parser.Encoder();
		}
		encode(packet) {
			if (fast && isRawEvent(packet)) return [frame(packet)];
			return this.stock.encode(packet);
		}
	}
	return {
		protocol: Parser.protocol,
		PacketType: Parser.PacketType,
		Encoder: Encoder,
		Decoder: Parser.Decoder,
		fastPathEnabled: fast,
	};
}

module.exports = { RawFrame, createParser, probe };
