"use strict";

const { Decoder: MessagePackDecoder, Encoder: MessagePackEncoder, ExtData } = require("@msgpack/msgpack");

const protocol = 5;
const PacketType = Object.freeze({
	CONNECT: 0,
	DISCONNECT: 1,
	EVENT: 2,
	ACK: 3,
	CONNECT_ERROR: 4,
});
const RESERVED_EVENTS = new Set([
	"connect",
	"connect_error",
	"disconnect",
	"disconnecting",
	"newListener",
	"removeListener",
]);
const OMIT = Symbol("omit");
const DEFAULTS = Object.freeze({
	maxPacketBytes: 4 * 1024 * 1024,
	maxDepth: 64,
	maxCollectionLength: 10000,
	maxNodes: 100000,
});

function isBinary(value) {
	if (!value || typeof value !== "object") return false;
	if (typeof Buffer !== "undefined" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(value)) return true;
	if (typeof ArrayBuffer === "undefined") return false;
	return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function normalizeJson(value, options, stack, state, depth, inArray) {
	if (depth > options.maxDepth) throw new Error("packet data is too deeply nested");
	if (++state.nodes > options.maxNodes) throw new Error("packet data has too many values");

	if (value && typeof value === "object") {
		if (isBinary(value) || value instanceof ExtData) throw new Error("binary packet data is not supported");
		if (typeof value.toJSON === "function") value = value.toJSON();
	}
	if (isBinary(value) || value instanceof ExtData) throw new Error("binary packet data is not supported");

	if (value === null) return null;
	switch (typeof value) {
		case "string":
		case "boolean":
			return value;
		case "number":
			return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null;
		case "undefined":
		case "function":
		case "symbol":
			return inArray ? null : OMIT;
		case "bigint":
			throw new TypeError("BigInt packet data is not supported");
		case "object":
			break;
		default:
			throw new TypeError("unsupported packet data");
	}

	if (value instanceof Number || value instanceof String || value instanceof Boolean) {
		return normalizeJson(value.valueOf(), options, stack, state, depth, inArray);
	}
	if (stack.has(value)) throw new TypeError("circular packet data is not supported");
	stack.add(value);

	let normalized;
	if (Array.isArray(value)) {
		if (value.length > options.maxCollectionLength) throw new Error("packet array is too large");
		normalized = new Array(value.length);
		for (let i = 0; i < value.length; i++) {
			normalized[i] = normalizeJson(value[i], options, stack, state, depth + 1, true);
		}
	} else {
		const keys = Object.keys(value);
		if (keys.length > options.maxCollectionLength) throw new Error("packet object is too large");
		normalized = {};
		for (const key of keys) {
			if (key === "__proto__") throw new Error("the __proto__ key is not allowed");
			const item = normalizeJson(value[key], options, stack, state, depth + 1, false);
			if (item !== OMIT) normalized[key] = item;
		}
	}

	stack.delete(value);
	return normalized;
}

function toJsonValue(value, options) {
	const normalized = normalizeJson(value, options, new WeakSet(), { nodes: 0 }, 0, false);
	if (normalized === OMIT) throw new TypeError("packet data is not JSON-compatible");
	return normalized;
}

function validateJsonValue(root, options) {
	const pending = [{ value: root, depth: 0 }];
	let nodes = 0;
	while (pending.length) {
		const { value, depth } = pending.pop();
		if (depth > options.maxDepth) throw new Error("packet data is too deeply nested");
		if (++nodes > options.maxNodes) throw new Error("packet data has too many values");
		if (value === null || typeof value === "string" || typeof value === "boolean") continue;
		if (typeof value === "number") {
			if (!Number.isFinite(value)) throw new Error("packet data contains a non-finite number");
			continue;
		}
		if (!value || typeof value !== "object" || isBinary(value) || value instanceof ExtData) {
			throw new Error("packet data is not JSON-compatible");
		}
		if (Array.isArray(value)) {
			if (value.length > options.maxCollectionLength) throw new Error("packet array is too large");
			for (let i = value.length - 1; i >= 0; i--) pending.push({ value: value[i], depth: depth + 1 });
			continue;
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null)
			throw new Error("packet data contains an unsupported object");
		const keys = Object.keys(value);
		if (keys.length > options.maxCollectionLength) throw new Error("packet object is too large");
		for (const key of keys) {
			if (key === "__proto__") throw new Error("the __proto__ key is not allowed");
			pending.push({ value: value[key], depth: depth + 1 });
		}
	}
	return root;
}

function validId(id) {
	return Number.isSafeInteger(id) && id >= 0;
}

function validEventData(data) {
	return Array.isArray(data) && data.length > 0 && typeof data[0] === "string" && !RESERVED_EVENTS.has(data[0]);
}

function packetToTuple(packet, options) {
	if (!packet || typeof packet !== "object") throw new Error("invalid packet");
	if (packet.nsp !== undefined && packet.nsp !== "/") throw new Error("only the root namespace is supported");

	switch (packet.type) {
		case PacketType.CONNECT: {
			if (packet.id !== undefined) throw new Error("CONNECT packets cannot have an id");
			if (packet.data === undefined) return [PacketType.CONNECT];
			const data = toJsonValue(packet.data, options);
			if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("invalid CONNECT payload");
			return [PacketType.CONNECT, data];
		}
		case PacketType.DISCONNECT:
			if (packet.id !== undefined || packet.data !== undefined) throw new Error("invalid DISCONNECT packet");
			return [PacketType.DISCONNECT];
		case PacketType.EVENT: {
			const data = toJsonValue(packet.data, options);
			if (!validEventData(data)) throw new Error("invalid EVENT payload");
			if (packet.id === undefined) return [PacketType.EVENT, data];
			if (!validId(packet.id)) throw new Error("invalid packet id");
			return [PacketType.EVENT, packet.id, data];
		}
		case PacketType.ACK: {
			if (!validId(packet.id)) throw new Error("invalid packet id");
			const data = toJsonValue(packet.data, options);
			if (!Array.isArray(data)) throw new Error("invalid ACK payload");
			return [PacketType.ACK, packet.id, data];
		}
		case PacketType.CONNECT_ERROR: {
			if (packet.id !== undefined) throw new Error("CONNECT_ERROR packets cannot have an id");
			const data = toJsonValue(packet.data, options);
			if (typeof data !== "string" && (!data || Array.isArray(data) || typeof data !== "object")) {
				throw new Error("invalid CONNECT_ERROR payload");
			}
			return [PacketType.CONNECT_ERROR, data];
		}
		default:
			throw new Error("unsupported packet type");
	}
}

function tupleToPacket(tuple, options) {
	if (!Array.isArray(tuple) || tuple.length === 0) throw new Error("invalid packet frame");
	const type = tuple[0];
	if (!Number.isInteger(type)) throw new Error("invalid packet type");

	switch (type) {
		case PacketType.CONNECT:
			if (tuple.length === 1) return { type, nsp: "/" };
			if (tuple.length !== 2 || !tuple[1] || Array.isArray(tuple[1]) || typeof tuple[1] !== "object") {
				throw new Error("invalid CONNECT packet");
			}
			validateJsonValue(tuple[1], options);
			return { type, nsp: "/", data: tuple[1] };
		case PacketType.DISCONNECT:
			if (tuple.length !== 1) throw new Error("invalid DISCONNECT packet");
			return { type, nsp: "/" };
		case PacketType.EVENT:
			if (tuple.length === 2 && validEventData(tuple[1])) {
				validateJsonValue(tuple[1], options);
				return { type, nsp: "/", data: tuple[1] };
			}
			if (tuple.length === 3 && validId(tuple[1]) && validEventData(tuple[2])) {
				validateJsonValue(tuple[2], options);
				return { type, nsp: "/", id: tuple[1], data: tuple[2] };
			}
			throw new Error("invalid EVENT packet");
		case PacketType.ACK:
			if (tuple.length !== 3 || !validId(tuple[1]) || !Array.isArray(tuple[2])) throw new Error("invalid ACK packet");
			validateJsonValue(tuple[2], options);
			return { type, nsp: "/", id: tuple[1], data: tuple[2] };
		case PacketType.CONNECT_ERROR:
			if (
				tuple.length !== 2 ||
				(typeof tuple[1] !== "string" && (!tuple[1] || Array.isArray(tuple[1]) || typeof tuple[1] !== "object"))
			) {
				throw new Error("invalid CONNECT_ERROR packet");
			}
			validateJsonValue(tuple[1], options);
			return { type, nsp: "/", data: tuple[1] };
		default:
			throw new Error("unsupported packet type");
	}
}

class Emitter {
	constructor() {
		this.callbacks = Object.create(null);
	}

	on(event, listener) {
		(this.callbacks[event] || (this.callbacks[event] = [])).push(listener);
		return this;
	}

	off(event, listener) {
		if (event === undefined) {
			this.callbacks = Object.create(null);
			return this;
		}
		const listeners = this.callbacks[event];
		if (!listeners) return this;
		if (listener === undefined) {
			delete this.callbacks[event];
			return this;
		}
		const index = listeners.indexOf(listener);
		if (index !== -1) listeners.splice(index, 1);
		if (listeners.length === 0) delete this.callbacks[event];
		return this;
	}

	emit(event, ...args) {
		const listeners = this.callbacks[event];
		if (listeners) {
			for (const listener of listeners.slice()) listener.apply(this, args);
		}
		return this;
	}
}

Emitter.prototype.removeListener = Emitter.prototype.off;
Emitter.prototype.removeAllListeners = Emitter.prototype.off;

function binaryView(value) {
	if (typeof value === "string") throw new Error("MessagePack packets must use a binary transport frame");
	if (typeof Buffer !== "undefined" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return new Uint8Array(value);
	if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	throw new Error("invalid MessagePack transport frame");
}

function createParser(overrides) {
	const options = Object.freeze(Object.assign({}, DEFAULTS, overrides));
	for (const name of ["maxPacketBytes", "maxDepth", "maxCollectionLength", "maxNodes"]) {
		if (!Number.isSafeInteger(options[name]) || options[name] < 1) throw new TypeError(`invalid ${name}`);
	}

	class Encoder {
		constructor() {
			this.encoder = new MessagePackEncoder({ maxDepth: options.maxDepth + 4 });
		}

		encode(packet) {
			return [this.encoder.encode(packetToTuple(packet, options))];
		}
	}

	class Decoder extends Emitter {
		constructor() {
			super();
			this.decoder = new MessagePackDecoder({
				maxStrLength: options.maxPacketBytes,
				maxBinLength: 0,
				maxArrayLength: options.maxCollectionLength,
				maxMapLength: options.maxCollectionLength,
				maxExtLength: 0,
				mapKeyConverter(key) {
					if (typeof key !== "string" || key === "__proto__") throw new Error("invalid object key");
					return key;
				},
			});
		}

		add(frame) {
			const bytes = binaryView(frame);
			if (bytes.byteLength === 0 || bytes.byteLength > options.maxPacketBytes) throw new Error("invalid packet size");
			this.emit("decoded", tupleToPacket(this.decoder.decode(bytes), options));
		}

		destroy() {
			this.off();
		}
	}

	return Object.freeze({ protocol, PacketType, Encoder, Decoder });
}

const parser = createParser();
module.exports = Object.assign({}, parser, { createParser });
