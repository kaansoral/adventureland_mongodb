"use strict";
const W = 272,
	H = 192,
	TILE = 16,
	CORRIDOR = 8,
	WALL_HEIGHT = 4;
function rng(seed) {
	let s = 2166136261;
	for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
	return function () {
		let t = (s += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function generate(seed, level = 0) {
	if (!Number.isInteger(level) || level < 0 || level > 2) throw Error("Unknown level");
	const random = rng(seed + ":floor:" + level);
	const int = (a, b) => a + Math.floor(random() * (b - a + 1));
	const grid = Array.from({ length: H }, () => Array(W).fill(0));
	const leaves = [];
	function divide(a, depth) {
		const vertical = a.w / a.h > 1.15 || (a.w / a.h > 0.85 && random() < 0.5);
		const size = vertical ? a.w : a.h;
		if (!depth || size < 42) {
			leaves.push(a);
			return;
		}
		const cut = int(Math.max(20, Math.floor(size * 0.43)), Math.min(size - 20, Math.ceil(size * 0.57)));
		if (vertical) {
			divide({ ...a, w: cut }, depth - 1);
			divide({ x: a.x + cut, y: a.y, w: a.w - cut, h: a.h }, depth - 1);
		} else {
			divide({ ...a, h: cut }, depth - 1);
			divide({ x: a.x, y: a.y + cut, w: a.w, h: a.h - cut }, depth - 1);
		}
	}
	divide({ x: 10, y: 10, w: W - 20, h: H - 20 }, 5);
	function carve(x, y) {
		if (x > 5 && y > 5 && x < W - 6 && y < H - 6) grid[y][x] = 1;
	}
	const rooms = leaves.map((a, id) => {
		const w = int(Math.min(18, a.w - 7), Math.min(32, a.w - 7));
		const h = int(Math.min(14, a.h - 8), Math.min(24, a.h - 8));
		const x = int(a.x + 3, a.x + a.w - w - 3),
			y = int(a.y + 4, a.y + a.h - h - 3);
		const notch = int(2, 4),
			shape = random() < 0.7 ? "chamfered cave" : "broad chamber";
		for (let dy = 0; dy < h; dy++)
			for (let dx = 0; dx < w; dx++) {
				if (shape === "chamfered cave" && Math.min(dx, w - 1 - dx) + Math.min(dy, h - 1 - dy) < notch) continue;
				carve(x + dx, y + dy);
			}
		return {
			id,
			x,
			y,
			w,
			h,
			cx: x + Math.floor(w / 2),
			cy: y + Math.floor(h / 2),
			fx: x + Math.floor(w / 2),
			fy: y + 3,
			shape,
			kind: "cavern",
			title: "Cavern " + (id + 1),
		};
	});
	const distance = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
	const edges = [],
		connected = new Set([0]);
	while (connected.size < rooms.length) {
		let best = null;
		for (const a of rooms)
			if (connected.has(a.id))
				for (const b of rooms)
					if (!connected.has(b.id)) {
						const cost = distance(a, b) + random() * 4;
						if (!best || cost < best.cost) best = { a: a.id, b: b.id, cost };
					}
		edges.push([best.a, best.b]);
		connected.add(best.b);
	}
	const extras = [];
	for (let a = 0; a < rooms.length; a++)
		for (let b = a + 1; b < rooms.length; b++)
			if (!edges.some((e) => e.includes(a) && e.includes(b)))
				extras.push({ a, b, cost: distance(rooms[a], rooms[b]) + random() * 20 });
	extras.sort((a, b) => a.cost - b.cost);
	for (const e of extras.slice(0, 5)) edges.push([e.a, e.b]);
	const corridors = [];
	for (const [a, b] of edges) {
		const from = rooms[a],
			to = rooms[b];
		const points =
			random() < 0.5
				? [
						[from.cx, from.cy],
						[to.cx, from.cy],
						[to.cx, to.cy],
					]
				: [
						[from.cx, from.cy],
						[from.cx, to.cy],
						[to.cx, to.cy],
					];
		for (let n = 1; n < points.length; n++) {
			let [x, y] = points[n - 1];
			const [ex, ey] = points[n];
			while (true) {
				for (let dy = -4; dy < 4; dy++) for (let dx = -4; dx < 4; dx++) carve(x + dx, y + dy);
				if (x === ex && y === ey) break;
				x += Math.sign(ex - x);
				y += Math.sign(ey - y);
			}
		}
		corridors.push({ from: a, to: b, points, width: CORRIDOR });
	}
	// A four-tile projected rock face needs solid space above it. Merge tiny
	// slivers into the passage instead of painting over walkable ground.
	for (let x = 1; x < W - 1; x++) {
		let y = 1;
		while (y < H - 1) {
			if (grid[y][x]) {
				y++;
				continue;
			}
			const start = y;
			while (y < H - 1 && !grid[y][x]) y++;
			if (start > 1 && grid[start - 1][x] && grid[y]?.[x] && y - start < WALL_HEIGHT + 1)
				for (let yy = start; yy < y; yy++) grid[yy][x] = 1;
		}
	}
	const first = [...rooms].sort((a, b) => a.cx + a.cy - b.cx - b.cy)[0];
	const dist = rooms.map(() => Infinity);
	dist[first.id] = 0;
	const pending = new Set(rooms.map((r) => r.id));
	while (pending.size) {
		let id = [...pending].sort((a, b) => dist[a] - dist[b])[0];
		pending.delete(id);
		for (const e of edges)
			if (e.includes(id)) {
				const other = e[0] === id ? e[1] : e[0];
				dist[other] = Math.min(dist[other], dist[id] + distance(rooms[id], rooms[other]));
			}
	}
	const order = [...rooms].filter((r) => r !== first).sort((a, b) => dist[a.id] - dist[b.id]);
	const final = order[order.length - 1];
	// Stairs need their own landing and a route around both sides. Reserve that
	// space before placing fixtures; a small random chamber cannot supply it.
	if (level < 2) {
		final.w = Math.max(final.w, 24);
		final.h = Math.max(final.h, 22);
		final.x = Math.max(6, Math.min(W - 6 - final.w, final.cx - Math.floor(final.w / 2)));
		final.y = Math.max(6, Math.min(H - 6 - final.h, final.cy - Math.floor(final.h / 2)));
		for (let dy = 0; dy < final.h; dy++)
			for (let dx = 0; dx < final.w; dx++)
				if (Math.min(dx, final.w - 1 - dx) + Math.min(dy, final.h - 1 - dy) >= 2) carve(final.x + dx, final.y + dy);
	}
	function assign(r, kind, title, actor = null) {
		Object.assign(r, { kind, title, actor });
	}
	if (level === 0) {
		assign(first, "ada", "Ada's camp", "ada");
		assign(order[0], "ledger", "Abandoned office");
	} else if (level === 1) {
		assign(first, "orrin", "Orrin's post", "orrin");
		assign(order[2], "rest", "Tess's shelter", "tess");
		assign(order[5], "nela", "Nela's shortcut", "nela");
	} else assign(first, "arrival", "The lower stair");
	assign(
		final,
		level === 2 ? "bran" : "descent",
		level === 2 ? "Bran's gate" : "Stairs to level " + (level + 2),
		level === 2 ? "bran" : null,
	);
	// Select an existing continuous wall and a clear landing below it.
	// Scanning nearby boundaries also handles a corridor through a room's north edge.
	function wallSocket(r) {
		const candidates = [];
		for (let y = 6; y < H - 8; y++)
			for (let x = 6; x < W - 6; x++) {
				let valid = true;
				for (let dy = -4; dy < 0 && valid; dy++)
					for (let dx = -3; dx < 3; dx++) if (grid[y + dy]?.[x + dx] !== 0) valid = false;
				for (let dx = -5; dx <= 5; dx++) if (grid[y]?.[x + dx] !== 1) valid = false;
				for (let dy = 1; dy < 8 && valid; dy++)
					for (let dx = -5; dx <= 5; dx++) if (grid[y + dy]?.[x + dx] !== 1) valid = false;
				if (valid) candidates.push({ x, y, cost: Math.abs(x - r.cx) + Math.abs(y - r.y) * 2 });
			}
		candidates.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
		if (!candidates.length) throw Error("No complete doorway wall near room " + r.id);
		return candidates[0];
	}
	const gate = level === 2 ? wallSocket(final) : null;
	if (gate) {
		final.fx = gate.x;
		final.fy = gate.y + 3;
	}
	const makeDoor = (r, kind, id) => {
		if (kind !== "down") {
			const p = wallSocket(r);
			return {
				id,
				kind,
				room: r.id,
				x: p.x,
				y: p.y,
				placement: "wall",
				landing: { x: p.x, y: p.y + 4 },
				landingWidth: 128,
			};
		}
		const candidates = [];
		for (let y = r.y + 2; y < r.y + r.h - 6; y++)
			for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
				const landing = { x: Math.max(r.x + 4, Math.min(r.x + r.w - 4, x)), y: y + 4 };
				let valid = true;
				// Include room for both braziers and a margin along the side walls.
				for (let dy = -4; dy <= 2; dy++)
					for (let dx = -5; dx <= 5; dx++) if (grid[y + dy]?.[x + dx] !== 1) valid = false;
				for (let dy = -3; dy <= 3 && valid; dy++)
					for (let dx = -3; dx <= 3; dx++) if (grid[landing.y + dy]?.[landing.x + dx] !== 1) valid = false;
				if (valid)
					candidates.push({
						id,
						kind,
						room: r.id,
						x,
						y,
						placement: "floor",
						landing,
						landingWidth: 128,
						cost: Math.abs(x - r.x - 2) + Math.abs(y - r.y - 5),
					});
			}
		candidates.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
		for (const d of candidates) {
			const wide = flood(
				{ grid, blockers: [{ x: d.x * 16 - 48, y: d.y * 16 - 64, w: 96, h: 64 }] },
				[first.cx, first.cy],
				6,
			);
			if (wide[d.landing.y * W + d.landing.x] && rooms.every((room) => wide[room.cy * W + room.cx])) {
				delete d.cost;
				return d;
			}
		}
		throw Error("No stair location preserves wide passage in room " + r.id);
	};
	const doors = [makeDoor(first, level === 0 ? "exit" : "up", "up-" + level)];
	if (level < 2) doors.push(makeDoor(final, "down", "down-" + level));
	for (const d of doors)
		for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx < 4; dx++) carve(d.landing.x + dx, d.landing.y + dy);
	for (const d of doors)
		if (d.placement === "floor")
			for (let dy = -4; dy < 0; dy++) for (let dx = -3; dx < 3; dx++) carve(d.x + dx, d.y + dy);
	const blockers = doors.map((d) => ({
		id: d.id,
		x: d.x * 16 - 48,
		y: d.y * 16 - 64,
		w: 96,
		h: 64,
	}));
	const reserved = (x, y) =>
		doors.some((d) => Math.abs(x - d.x) < 7 && Math.abs(y - d.y) < 7) ||
		rooms.some((r) => r.actor && Math.abs(x - r.fx) < 5 && Math.abs(y - r.fy) < 5);
	const decor = [];
	for (const r of rooms) {
		const typePool =
			level === 0
				? ["rock", "stalagmite", "crystal", "web", "torch"]
				: level === 1
					? ["rock", "crystal", "barrel", "torch"]
					: ["stalagmite", "rock", "web", "torch"];
		for (let n = 0; n < Math.max(6, Math.floor((r.w + r.h) / 4)); n++) {
			const side = int(0, 3);
			const x = side === 0 ? r.x + 1 : side === 1 ? r.x + r.w - 2 : int(r.x + 2, r.x + r.w - 3);
			const y = side === 2 ? r.y + 1 : side === 3 ? r.y + r.h - 2 : int(r.y + 2, r.y + r.h - 3);
			if (grid[y]?.[x] && !reserved(x, y) && !decor.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 3))
				decor.push({ x, y, type: typePool[int(0, typePool.length - 1)], collision: false });
		}
	}
	// Keep a reproducible spacious junction for close-up size and wall review.
	const depthRoom = rooms.find((r) => r.kind === "cavern" && r.w >= 20 && r.h >= 16) || order[1];
	const map = {
		seed: String(seed),
		version: 3,
		gate,
		level,
		style: level === 0 ? "cave" : "ruin",
		name: ["Upper caves", "Mossy halls", "The buried gate"][level],
		width: W,
		height: H,
		tileSize: TILE,
		corridorWidth: CORRIDOR,
		wallHeight: WALL_HEIGHT,
		grid,
		rooms,
		corridors,
		decor,
		doors,
		blockers,
		truth: rng(seed + ":case")() < 0.5 ? "stolen" : "safekeeping",
		start: first.id,
		final: final.id,
		depthRoom: depthRoom.id,
	};
	return map;
}

function generateDungeon(seed) {
	const floors = [0, 1, 2].map((level) => generate(seed, level));
	for (const f of floors)
		for (const d of f.doors) {
			if (d.kind === "exit") d.target = { map: "main", x: 816, y: 1200 };
			if (d.kind === "up") d.target = { floor: f.level - 1, door: "down-" + (f.level - 1) };
			if (d.kind === "down") d.target = { floor: f.level + 1, door: "up-" + (f.level + 1) };
		}
	return {
		seed: String(seed),
		version: 3,
		title: "Cave of Many Dreams",
		floors,
	};
}

function travel(dungeon, level, doorId) {
	const door = dungeon.floors[level]?.doors.find((d) => d.id === doorId);
	if (!door || !door.target) throw Error("Unknown stair");
	if (door.target.map) return { ...door.target };
	const floor = dungeon.floors[door.target.floor],
		arrival = floor?.doors.find((d) => d.id === door.target.door);
	if (!arrival || arrival.target.floor !== level || arrival.target.door !== doorId) throw Error("Broken stair pair");
	return { floor: floor.level, door: arrival.id, x: arrival.landing.x, y: arrival.landing.y, room: arrival.room };
}

function canStand(map, x, y, size = 6) {
	const low = -Math.floor(size / 2),
		high = low + size;
	for (let dy = low; dy < high; dy++) for (let dx = low; dx < high; dx++) if (!map.grid[y + dy]?.[x + dx]) return false;
	const box = { x: (x + low) * 16, y: (y + low) * 16, w: size * 16, h: size * 16 };
	if (
		(map.blockers || []).some(
			(b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
		)
	)
		return false;
	return true;
}

function flood(map, start, size = 1) {
	const seen = new Uint8Array(W * H),
		queue = [start[1] * W + start[0]];
	const fits = (x, y) => (size === 1 ? map.grid[y]?.[x] === 1 : canStand(map, x, y, size));
	for (let n = 0; n < queue.length; n++) {
		const id = queue[n],
			x = id % W,
			y = Math.floor(id / W);
		if (x < 0 || y < 0 || x >= W || y >= H || seen[id] || !fits(x, y)) continue;
		seen[id] = 1;
		if (x > 0) queue.push(id - 1);
		if (x < W - 1) queue.push(id + 1);
		if (y > 0) queue.push(id - W);
		if (y < H - 1) queue.push(id + W);
	}
	return seen;
}

function validate(map) {
	const first = map.rooms.find((r) => r.id === map.start),
		seen = flood(map, [first.cx, first.cy]);
	const wide = flood(map, [first.cx, first.cy], 6),
		failures = [];
	let count = 0;
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			if (map.grid[y][x]) {
				count++;
				if (!seen[y * W + x]) failures.push("Disconnected floor");
			}
			if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && map.grid[y][x]) failures.push("Open outer boundary");
		}
	for (const r of map.rooms) if (!wide[r.cy * W + r.cx]) failures.push("96-pixel actor cannot reach room " + r.id);
	for (const d of map.doors)
		if (!wide[d.landing.y * W + d.landing.x]) failures.push("Unreachable stair landing " + d.id);
	for (const d of map.doors)
		for (let dy = -4; dy < 0; dy++)
			for (let dx = -3; dx < 3; dx++)
				if (map.grid[d.y + dy]?.[d.x + dx] !== (d.placement === "wall" ? 0 : 1))
					failures.push("Invalid stair footprint " + d.id);
	if (map.width !== 272 || map.height !== 192) failures.push("Wrong map dimensions");
	if (map.corridors.some((c) => c.width < 8)) failures.push("Narrow corridor");
	return {
		pass: !failures.length,
		failures,
		rooms: map.rooms.length,
		walkableCells: count,
		corridorWidthPixels: 128,
		frontWallPixels: 64,
		actorClearancePixels: 96,
	};
}

function validateDungeon(dungeon) {
	const checks = dungeon.floors.map(validate),
		failures = checks.flatMap((c, n) => c.failures.map((s) => "Level " + (n + 1) + ": " + s));
	for (const f of dungeon.floors)
		for (const d of f.doors)
			try {
				travel(dungeon, f.level, d.id);
			} catch (e) {
				failures.push(e.message);
			}
	for (const kind of ["ada", "ledger", "orrin", "rest", "nela", "bran"])
		if (dungeon.floors.flatMap((f) => f.rooms).filter((r) => r.kind === kind).length !== 1)
			failures.push("Episode role must occur once: " + kind);
	return { pass: !failures.length, failures, floors: checks, stairPairs: 2 };
}

const images = {
	"cave-floor": {
		name: "cave-floor",
		x: 0,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-floor2": {
		name: "cave-floor2",
		x: 16,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-void": {
		name: "cave-void",
		x: 32,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-nw": {
		name: "cave-nw",
		x: 48,
		y: 0,
		width: 16,
		height: 16,
		opaque: false,
	},
	"cave-n": {
		name: "cave-n",
		x: 64,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-ne": {
		name: "cave-ne",
		x: 80,
		y: 0,
		width: 16,
		height: 16,
		opaque: false,
	},
	"cave-w": {
		name: "cave-w",
		x: 96,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-e": {
		name: "cave-e",
		x: 112,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-sw": {
		name: "cave-sw",
		x: 128,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-s": {
		name: "cave-s",
		x: 144,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-se": {
		name: "cave-se",
		x: 160,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-inner-nw": {
		name: "cave-inner-nw",
		x: 176,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-inner-ne": {
		name: "cave-inner-ne",
		x: 192,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-inner-sw": {
		name: "cave-inner-sw",
		x: 208,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-inner-se": {
		name: "cave-inner-se",
		x: 224,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-face-w": {
		name: "cave-face-w",
		x: 240,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-face": {
		name: "cave-face",
		x: 256,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-face-e": {
		name: "cave-face-e",
		x: 272,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"cave-foot-w": {
		name: "cave-foot-w",
		x: 288,
		y: 0,
		width: 16,
		height: 16,
		opaque: false,
	},
	"cave-foot": {
		name: "cave-foot",
		x: 304,
		y: 0,
		width: 16,
		height: 16,
		opaque: false,
	},
	"cave-foot-e": {
		name: "cave-foot-e",
		x: 320,
		y: 0,
		width: 16,
		height: 16,
		opaque: false,
	},
	"ruin-floor0": {
		name: "ruin-floor0",
		x: 336,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-floor1": {
		name: "ruin-floor1",
		x: 352,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-floor2": {
		name: "ruin-floor2",
		x: 368,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-floor3": {
		name: "ruin-floor3",
		x: 384,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-void": {
		name: "ruin-void",
		x: 400,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-nw": {
		name: "ruin-nw",
		x: 416,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-n": {
		name: "ruin-n",
		x: 432,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-ne": {
		name: "ruin-ne",
		x: 448,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-w": {
		name: "ruin-w",
		x: 464,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-e": {
		name: "ruin-e",
		x: 480,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-sw": {
		name: "ruin-sw",
		x: 496,
		y: 0,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-s": {
		name: "ruin-s",
		x: 0,
		y: 16,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-se": {
		name: "ruin-se",
		x: 16,
		y: 16,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-inner-nw": {
		name: "ruin-inner-nw",
		x: 32,
		y: 16,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-inner-ne": {
		name: "ruin-inner-ne",
		x: 48,
		y: 16,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-inner-sw": {
		name: "ruin-inner-sw",
		x: 64,
		y: 16,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-inner-se": {
		name: "ruin-inner-se",
		x: 80,
		y: 16,
		width: 16,
		height: 16,
		opaque: true,
	},
	"ruin-wall-left": {
		name: "ruin-wall-left",
		x: 96,
		y: 16,
		width: 16,
		height: 64,
		opaque: true,
	},
	"ruin-wall-course": {
		name: "ruin-wall-course",
		x: 112,
		y: 16,
		width: 32,
		height: 64,
		opaque: true,
	},
	"ruin-wall-right": {
		name: "ruin-wall-right",
		x: 144,
		y: 16,
		width: 16,
		height: 64,
		opaque: true,
	},
	"cave-return-door": {
		name: "cave-return-door",
		x: 160,
		y: 16,
		width: 48,
		height: 32,
		opaque: false,
	},
	"cave-stairwell": {
		name: "cave-stairwell",
		x: 208,
		y: 16,
		width: 32,
		height: 32,
		opaque: true,
	},
	"ruin-return-door": {
		name: "ruin-return-door",
		x: 240,
		y: 16,
		width: 48,
		height: 32,
		opaque: true,
	},
	"ruin-stairwell": {
		name: "ruin-stairwell",
		x: 288,
		y: 16,
		width: 32,
		height: 32,
		opaque: true,
	},
	rock: {
		name: "rock",
		x: 320,
		y: 16,
		width: 16,
		height: 14,
		opaque: false,
	},
	stalagmite: {
		name: "stalagmite",
		x: 336,
		y: 16,
		width: 16,
		height: 28,
		opaque: false,
	},
	torch: {
		name: "torch",
		x: 352,
		y: 16,
		width: 16,
		height: 40,
		opaque: false,
	},
	web: {
		name: "web",
		sheet: "dungeon",
		x: 880,
		y: 200,
		width: 32,
		height: 32,
		opaque: false,
		ground: true,
	},
	barrel: {
		name: "barrel",
		x: 400,
		y: 16,
		width: 16,
		height: 19,
		opaque: false,
	},
	crystal: {
		name: "crystal",
		x: 416,
		y: 16,
		width: 32,
		height: 25,
		opaque: false,
	},
	books: {
		name: "books",
		x: 448,
		y: 16,
		width: 16,
		height: 16,
		opaque: false,
	},
	"ruin-pillar": {
		name: "ruin-pillar",
		x: 464,
		y: 16,
		width: 16,
		height: 47,
		opaque: false,
	},
	"ruin-idol": {
		name: "ruin-idol",
		x: 480,
		y: 16,
		width: 32,
		height: 29,
		opaque: false,
	},
	"ruin-bowl": {
		name: "ruin-bowl",
		x: 0,
		y: 80,
		width: 16,
		height: 16,
		opaque: false,
	},
	"ruin-moss": {
		name: "ruin-moss",
		x: 16,
		y: 80,
		width: 48,
		height: 48,
		opaque: true,
	},
	"ruin-vines": {
		name: "ruin-vines",
		x: 64,
		y: 80,
		width: 16,
		height: 48,
		opaque: false,
	},
	"cave-pattern": {
		name: "cave-pattern",
		x: 80,
		y: 80,
		width: 32,
		height: 32,
		opaque: true,
	},
	"ruin-pattern": {
		name: "ruin-pattern",
		x: 112,
		y: 80,
		width: 64,
		height: 64,
		opaque: true,
	},
};
let cachedMap, cachedGround;
function actor(ctx, name, x, y) {
	const im = images[name];
	ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height));
}

function topology(map) {
	const solid = (x, y) => map.grid[y]?.[x] !== 1;
	const top = (x, y) => solid(x, y) && solid(x, y + 1) && solid(x, y + 2) && solid(x, y + 3) && solid(x, y + 4);
	const face = (x, y) => solid(x, y) && !top(x, y);
	return { solid, top, face };
}

function topTile(ctx, prefix, top, x, y) {
	const n = top(x, y - 1),
		e = top(x + 1, y),
		s = top(x, y + 1),
		w = top(x - 1, y);
	// A one-cell neck needs both borders. A single full corner would drop one.
	if ((!n && !s) || (!w && !e)) {
		for (const [dx, dy, sx, sy] of [
			[-1, -1, 0, 0],
			[1, -1, 8, 0],
			[-1, 1, 0, 8],
			[1, 1, 8, 8],
		]) {
			const horizontal = dx < 0 ? w : e,
				vertical = dy < 0 ? n : s,
				corner = (dy < 0 ? "n" : "s") + (dx < 0 ? "w" : "e");
			const name =
				!horizontal && !vertical
					? corner
					: !horizontal
						? dx < 0
							? "w"
							: "e"
						: !vertical
							? dy < 0
								? "n"
								: "s"
							: "void";
			ctx.drawImage(images[prefix + "-" + name], sx, sy, 8, 8, x * 16 + sx, y * 16 + sy, 8, 8);
		}
		return;
	}
	let tile = "void";
	if (!n && !w) tile = "nw";
	else if (!n && !e) tile = "ne";
	else if (!s && !w) tile = "sw";
	else if (!s && !e) tile = "se";
	else if (!n) tile = "n";
	else if (!s) tile = "s";
	else if (!w) tile = "w";
	else if (!e) tile = "e";
	ctx.drawImage(images[prefix + "-" + tile], x * 16, y * 16);
	if (n && e && s && w) {
		for (const [dx, dy, name, sx, sy] of [
			[-1, -1, "nw", 0, 0],
			[1, -1, "ne", 8, 0],
			[-1, 1, "sw", 0, 8],
			[1, 1, "se", 8, 8],
		])
			if (!top(x + dx, y + dy))
				ctx.drawImage(
					images[prefix + "-inner-" + name],
					prefix === "ruin" ? 8 - sx : sx,
					prefix === "ruin" ? 8 - sy : sy,
					8,
					8,
					x * 16 + sx,
					y * 16 + sy,
					8,
					8,
				);
	}
}
function ground(map) {
	if (cachedMap === map) return cachedGround;
	const c = canvas(map.width * 16, map.height * 16, map.style || "cave"),
		ctx = c.getContext("2d"),
		p = map.style || "cave",
		{ solid, top, face } = topology(map);
	const floors =
		p === "cave" ? ["cave-floor", "cave-floor2"] : ["ruin-floor0", "ruin-floor1", "ruin-floor2", "ruin-floor3"];
	ctx.fillStyle = "#362e3f";
	ctx.fillRect(0, 0, c.width, c.height);
	for (let y = 0; y < map.height; y++)
		for (let x = 0; x < map.width; x++) {
			ctx.drawImage(images[floors[(x * 7 + y * 3) % floors.length]], x * 16, y * 16);
			if (!solid(x, y)) continue;
			if (face(x, y)) {
				const left = !solid(x - 1, y),
					right = !solid(x + 1, y),
					bottom = !solid(x, y + 1);
				if (p === "cave")
					ctx.drawImage(
						images["cave-" + (bottom ? "foot" : "face") + (left ? "-w" : right ? "-e" : "")],
						x * 16,
						y * 16,
					);
				else {
					// Follow the corner down to the floor, then carry its pillar up
					// the whole face. Stepped joins otherwise keep only the foot.
					let foot = y;
					while (solid(x, foot + 1)) foot++;
					const row = !face(x, y - 1) ? 0 : bottom ? 48 : 16 + (y % 2) * 16;
					const im = images["ruin-wall-" + (!solid(x - 1, foot) ? "left" : !solid(x + 1, foot) ? "right" : "course")];
					ctx.drawImage(im, im.width === 32 ? (x % 2) * 16 : 0, row, 16, 16, x * 16, y * 16, 16, 16);
				}
			} else {
				// Under a concave top join is continuous rock, never another wall end.
				if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) {
					if (p === "cave") ctx.drawImage(images["cave-face"], x * 16, y * 16);
					else ctx.drawImage(images["ruin-wall-course"], (x % 2) * 16, 16, 16, 16, x * 16, y * 16, 16, 16);
				}
				topTile(ctx, p, top, x, y);
			}
		}
	for (const d of map.doors) {
		const im = images[p + (d.placement === "wall" ? "-return-door" : "-stairwell")];
		// Extend the native centre pieces; every source pixel remains one map pixel.
		const edge = d.placement === "wall" ? 16 : 8;
		for (let row = 0; row < 8; row++)
			for (let col = 0; col < 12; col++) {
				const dx = col * 8,
					dy = row * 8;
				const sx =
					dx < edge ? dx : dx >= 96 - edge ? im.width - (96 - dx) : edge + ((dx - edge) % (im.width - edge * 2));
				const sy = dy < 8 ? dy : dy >= 56 ? 24 : 8 + ((dy - 8) % 16);
				ctx.drawImage(im, sx, sy, 8, 8, d.x * 16 - 48 + dx, d.y * 16 - 64 + dy, 8, 8);
			}
		ctx.depth = true;
		actor(ctx, "torch", d.x * 16 - 64, d.y * 16 + 8);
		actor(ctx, "torch", d.x * 16 + 64, d.y * 16 + 8);
		ctx.depth = false;
	}
	const clearApproach = (b) =>
		!map.doors.some(
			(d) =>
				b.x < d.landing.x * 16 + 64 &&
				b.x + b.w > d.landing.x * 16 - 64 &&
				b.y < d.landing.y * 16 + 48 &&
				b.y + b.h > d.y * 16 - 48,
		);
	const floorUnder = (b) => {
		for (let y = Math.floor(b.y / 16); y < Math.ceil((b.y + b.h) / 16); y++)
			for (let x = Math.floor(b.x / 16); x < Math.ceil((b.x + b.w) / 16); x++) if (map.grid[y]?.[x] !== 1) return false;
		return true;
	};
	const props = [];
	for (const d of map.decor) {
		let name = d.type;
		if (p === "ruin")
			name = { stalagmite: "ruin-pillar", crystal: "ruin-idol", web: "ruin-idol", rock: "ruin-bowl" }[name] || name;
		props.push({ name, x: d.x * 16 + 8, y: d.y * 16 + 16 });
	}
	for (const r of map.rooms) {
		const x = r.fx * 16,
			y = r.fy * 16;
		if (p === "ruin") {
			const moss = { x: (r.x + 2) * 16, y: (r.y + 2) * 16, w: 48, h: 48 };
			if (r.id % 3 === 0 && clearApproach(moss) && floorUnder(moss)) ctx.drawImage(images["ruin-moss"], moss.x, moss.y);
			const vine = { x: (r.x + r.w - 5) * 16 - 8, y: r.y * 16 - 56, w: 16, h: 48 };
			if (r.id % 2 === 0 && clearApproach(vine)) actor(ctx, "ruin-vines", vine.x + 8, vine.y + 48);
		}
		// Small furnished corners and nesting clusters give even unoccupied rooms a purpose.
		const centreX = (r.x + r.w / 2) * 16,
			centreY = (r.y + r.h / 2) * 16;
		props.push({ name: "web", x: centreX, y: centreY - 80 });
		props.push({ name: p === "ruin" ? "ruin-idol" : "crystal", x: centreX - 48, y: centreY - 64 });
		props.push({ name: "rock", x: centreX + 40, y: centreY - 80 });
		if (r.id % 2 === 0) {
			props.push({ name: "barrel", x: x - 64, y: y + 32 }, { name: "barrel", x: x - 48, y: y + 40 });
			props.push({ name: "books", x: x - 30, y: y + 36 }, { name: "torch", x: x + 56, y: y + 32 });
		}
		if (r.actor || r.kind === "ledger") {
			props.push({ name: "torch", x: x - 72, y: y + 12 }, { name: "barrel", x: x + 56, y: y + 16 });
			if (r.kind === "ledger") props.push({ name: "books", x: x, y: y + 8 });
		}
	}
	// A prop never covers the reserved staircase or its approach.
	for (const o of props.sort((a, b) => a.y - b.y)) {
		const im = images[o.name],
			b = { x: o.x - im.width / 2, y: o.y - im.height, w: im.width, h: im.height };
		if (!clearApproach(b) || !floorUnder({ x: b.x - 8, y: b.y - 8, w: b.w + 16, h: b.h + 16 })) continue;
		ctx.depth = !im.ground;
		actor(ctx, o.name, o.x, o.y);
		ctx.depth = false;
	}
	cachedMap = map;
	cachedGround = c;
	return c;
}

function canvas(width, height, style) {
	const pattern = images[style + "-pattern"];
	const data = {
		tiles: [["dreamsv3", pattern.x, pattern.y, [pattern.width, pattern.height]]],
		placements: [[0, 0, 0, width - pattern.width, height - pattern.height]],
		groups: [],
		x_lines: [],
		y_lines: [],
	};
	const ids = new Map();
	function tileId(tile) {
		const key = JSON.stringify(tile);
		if (!ids.has(key)) {
			ids.set(key, data.tiles.length);
			data.tiles.push(tile);
		}
		return ids.get(key);
	}
	const context = {
		imageSmoothingEnabled: false,
		fillRect() {}, // ground() covers the complete bounded rectangle with native tiles.
		drawImage(image, ...args) {
			if (/^(cave|ruin)-floor/.test(image.name)) return; // The identical pattern is one native repeat rectangle.
			let sx = 0,
				sy = 0,
				w = image.width,
				h = image.height,
				x,
				y;
			if (args.length === 2) [x, y] = args;
			else if (args.length === 8) {
				[sx, sy, w, h, x, y] = args;
				if (args[6] !== w || args[7] !== h) throw Error("Resampled terrain");
			} else throw Error("Unsupported native placement");
			if (![sx, sy, w, h, x, y].every(Number.isInteger)) throw Error("Fractional terrain");
			if (image.name === "torch") {
				// The shipped brazier and its three flame frames share a floor anchor.
				const baseY = y + h - 32;
				data.groups.push([[tileId(["dungeon", 16, 304, [16, 32]]), x, baseY]]);
				if (!data.animations) data.animations = [];
				data.animations.push([tileId(["custom_a", 0, 0, [16, 16]]), x, baseY - 2, x, baseY - 2, 120, 0, 20]);
				return;
			}
			const tile = [image.sheet || "dreamsv3", image.x + sx, image.y + sy, [w, h]];
			const placement = [tileId(tile), x, y];
			if (this.depth) {
				data.groups.push([placement]);
				return;
			}
			let last = data.placements[data.placements.length - 1];
			// An opaque cell replaces a same-size, same-position underlay exactly.
			if (
				image.opaque &&
				last &&
				last.length === 3 &&
				last[1] === x &&
				last[2] === y &&
				data.tiles[last[0]][3][0] === w &&
				data.tiles[last[0]][3][1] === h
			)
				data.placements.pop();
			last = data.placements[data.placements.length - 1];
			if (
				last &&
				last[0] === placement[0] &&
				last[2] === y &&
				(last.length === 3 || last[4] === y) &&
				(last.length === 3 ? last[1] : last[3]) + w === x
			) {
				last[3] = x;
				last[4] = y;
			} else data.placements.push(placement);
		},
	};
	return { width, height, data, getContext: () => context };
}
function collisionLines(floor) {
	const vertical = [],
		horizontal = [];
	// Leave half a tile of clearance at the rock edge. Trace the inset floor
	// so side lines remain joined at every inner and outer corner.
	const step = TILE / 2,
		width = floor.width * 2,
		height = floor.height * 2;
	const inset = new Uint8Array(width * height);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const gx = Math.floor(x / 2),
				gy = Math.floor(y / 2);
			const nx = gx + (x % 2 ? 1 : -1),
				ny = gy + (y % 2 ? 1 : -1);
			inset[y * width + x] = !!(
				floor.grid[gy]?.[gx] &&
				floor.grid[gy]?.[nx] &&
				floor.grid[ny]?.[gx] &&
				floor.grid[ny]?.[nx]
			);
		}
	const walk = (x, y) => x >= 0 && y >= 0 && x < width && y < height && inset[y * width + x];
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			if (!walk(x, y)) continue;
			if (!walk(x - 1, y)) vertical.push([x * step, y * step, (y + 1) * step]);
			if (!walk(x + 1, y)) vertical.push([(x + 1) * step, y * step, (y + 1) * step]);
			if (!walk(x, y - 1)) horizontal.push([y * step, x * step, (x + 1) * step]);
			if (!walk(x, y + 1)) horizontal.push([(y + 1) * step, x * step, (x + 1) * step]);
		}
	for (const b of floor.blockers) {
		vertical.push([b.x, b.y, b.y + b.h], [b.x + b.w, b.y, b.y + b.h]);
		horizontal.push([b.y, b.x, b.x + b.w], [b.y + b.h, b.x, b.x + b.w]);
	}
	function merge(lines) {
		lines.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
		const merged = [];
		for (const line of lines) {
			const last = merged[merged.length - 1];
			if (last && last[0] === line[0] && line[1] <= last[2]) last[2] = Math.max(last[2], line[2]);
			else merged.push(line.slice());
		}
		return merged;
	}
	return { x_lines: merge(vertical), y_lines: merge(horizontal) };
}
function compileDungeon(seed, runKey, exitSpawn, processMap, floorIndex = 0) {
	if (
		!/^[a-f0-9]{24}$/.test(runKey) ||
		!Number.isInteger(exitSpawn) ||
		exitSpawn < 0 ||
		!Number.isInteger(floorIndex) ||
		floorIndex < 0 ||
		floorIndex > 2
	)
		throw Error("Invalid dream identity");
	const dungeon = generateDungeon(seed),
		checked = validateDungeon(dungeon);
	if (!checked.pass) throw Error(checked.failures.join("; "));
	const keys = dungeon.floors.map((_, i) => "zone_" + runKey + "_" + i);
	const manifest = dungeon.floors.map((floor, i) => ({
		key: keys[i],
		definition: {
			name: "Cave of Many Dreams",
			instance: true,
			irregular: true,
			pvp: false,
			spawns: floor.doors.map((d) => [d.landing.x * 16, d.landing.y * 16]),
			doors: floor.doors.map((d, n) => {
				const destination = d.target.map || keys[d.target.floor];
				const arrival = d.target.map
					? exitSpawn
					: dungeon.floors[d.target.floor].doors.findIndex((other) => other.id === d.target.door);
				if (arrival < 0) throw Error("Unpaired stair");
				// The click area includes the walkable threshold in front of the art.
				return [d.x * 16, d.y * 16 + 16, 96, 80, destination, arrival, n, "ordinary"];
			}),
			npcs: [],
			monsters: [],
			ref: {},
			items: {},
			merchants: [],
			on_death: ["main", exitSpawn],
			on_exit: ["main", exitSpawn],
			generated: { run: runKey, floor: i, version: 1, zone: "dreams" },
			rooms: floor.rooms.map((r) => ({
				id: r.id,
				kind: r.kind,
				x: (r.x + r.w / 2) * 16,
				y: (r.y + r.h / 2) * 16,
				bounds: [r.x * 16, r.y * 16, (r.x + r.w) * 16, (r.y + r.h) * 16],
			})),
		},
	}));
	const geometry = Object.assign(ground(dungeon.floors[floorIndex]).data, collisionLines(dungeon.floors[floorIndex]));
	processMap({ info: { data: geometry } });
	geometry.tiles = geometry.tiles.map((t) => [t[0], t[1], t[2], t[3][0], t[3][1]]);
	return [Object.assign({}, manifest[floorIndex], { geometry, manifest })];
}
module.exports = { compileDungeon, collisionLines, generateDungeon, validateDungeon };
