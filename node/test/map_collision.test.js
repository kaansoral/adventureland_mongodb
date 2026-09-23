const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { extract, read, load } = require("./helpers/server_vm");
const design = require("./helpers/design");

for (const axis of ["x_lines", "y_lines"]) {
	test(`saved ${axis} block movement across negative and positive coordinates`, () => {
		const context = vm.createContext({
			Place: "server",
			perfc: { roam_ops: 0 },
			m_line_x: false,
			m_line_y: false,
			line_hit_x: null,
			line_hit_y: null,
		});
		vm.runInContext(read("common/js/common_functions.js"), context);
		vm.runInContext(read("js/old_common_functions.js"), context);
		vm.runInContext(extract(read("adventure_functions.js"), "process_map"), context);
		const coordinates = [-104, -240, -464, -96, 104, 240, 464, 8];
		const data = { tiles: [], placements: [], [axis]: coordinates.map((position) => [position, -50, 50]) };
		context.process_map({ info: { data } });
		context.G = { geometry: { test: data }, dimensions: {} };
		const vertical = axis === "x_lines";

		for (const position of coordinates) {
			for (const direction of [-1, 1]) {
				const from = position - direction * 20;
				const to = position + direction * 20;
				const entity = {
					map: "test",
					type: "character",
					x: vertical ? from : 0,
					y: vertical ? 0 : from,
					going_x: vertical ? to : 0,
					going_y: vertical ? 0 : to,
				};
				context.set_base(entity);
				assert.equal(context.can_move(entity), false, `wall at ${position}, direction ${direction}`);
				const move = context.calculate_move(entity, entity.going_x, entity.going_y);
				const stopped = vertical ? move.x : move.y;
				assert.ok(direction * (stopped - from) > 0, "movement advances toward the wall");
				assert.ok(direction * (stopped - position) < 0, "movement stops before the wall");
				if (vertical) entity.y = entity.going_y = 60;
				else entity.x = entity.going_x = 60;
				assert.equal(context.can_move(entity), true, "movement past the wall's end stays open");
			}
		}
	});
}

test("the entrance braziers block native movement at their bases while the central approach stays open", () => {
	const c = vm.createContext({ Place: "server", perfc: { roam_ops: 0 } });
	vm.runInContext(read("common/js/common_functions.js"), c);
	vm.runInContext(read("js/old_common_functions.js"), c);
	c.G = {
		maps: { main: { animatables: JSON.parse(JSON.stringify(design.maps.main.animatables)) } },
		geometry: { main: { x_lines: [], y_lines: [] } },
		dimensions: {},
		monsters: {},
		classes: {},
		sprites: {},
		items: {},
	};
	c.process_game_data();
	const geometry = JSON.stringify(c.G.geometry.main);
	c.process_game_data();
	assert.equal(JSON.stringify(c.G.geometry.main), geometry, "server/client processing does not duplicate lines");
	assert.equal(c.G.geometry.main.x_lines.length, 4);
	assert.equal(c.G.geometry.main.y_lines.length, 4);
	const gate = design.maps.main.animatables.dreams_gate;
	for (const box of gate.collision) {
		const x = gate.x + (box[0] + box[2]) / 2,
			y = gate.y + (box[1] + box[3]) / 2;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			const p = {
				map: "main",
				type: "character",
				x: x - dx * 30,
				y: y - dy * 30,
				going_x: x + dx * 30,
				going_y: y + dy * 30,
			};
			c.set_base(p);
			assert.equal(c.can_move(p), false, `brazier at ${x}, direction ${dx},${dy}`);
			const stopped = c.calculate_move(p, p.going_x, p.going_y);
			assert.ok((stopped.x - x) * dx + (stopped.y - y) * dy < 0, "the feet stop before the base");
		}
	}
	const p = { map: "main", type: "character", x: gate.x, y: 1240, going_x: gate.x, going_y: 1150 };
	c.set_base(p);
	assert.equal(c.can_move(p), true, "the route past Dorr into the doorway remains clear");

	Object.assign(c, {
		Dev: false,
		smap_data: {},
		amap_data: {},
		precomputed_bfs: { smap_data: { main: {} }, amap_data: { main: {} } },
		server_bfs2() {
			throw Error("rebuild");
		},
	});
	load(c, "node/server_functions.js", ["server_bfs"]);
	assert.throws(() => c.server_bfs("main"), /rebuild/, "old navigation cannot bypass the fixtures");
	c.precomputed_bfs.collision = { main: c.G.maps.main.collision_key };
	c.server_bfs("main");
	assert.equal(c.amap_data.main, c.precomputed_bfs.amap_data.main, "matching native navigation is reusable");
});
