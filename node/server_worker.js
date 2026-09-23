var Place = "server";
var options = require("../secretsandconfig/options");
var phrase = require("../languages").phrase;
var Dev = options.Dev;
var fs = require("fs");
var path = require("path");
eval("" + fs.readFileSync(path.resolve(__dirname, "../common/js/common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../js/old_common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "server_functions.js")));
var { workerData, parentPort } = require("worker_threads");
var G = workerData.G;
var smap_data = workerData.smap_data;
var amap_data = workerData.amap_data;
var perfc = { roam_ops: 0 };
var precomputed_bfs = null;
eval("" + fs.readFileSync(path.resolve(__dirname, "../adventure_functions.js")));
var generated_layouts = { dreams: require("./logic/dream_layout") };

parentPort.on("message", function (data) {
	try {
		//console.log(data);
		if (data.type === "generated_build") {
			var floors = [];
			try {
				floors =
					data.floors ||
					generated_layouts[data.zone].compileDungeon(
						data.seed,
						data.key,
						data.exit_spawn,
						process_map,
						data.floor || 0,
					);
				if (
					floors.length < 1 ||
					floors.length > 8 ||
					floors.some(
						(f, i) =>
							f.key !== "zone_" + data.key + "_" + f.definition.generated.floor || f.definition.generated.version !== 1,
					)
				)
					throw Error("Invalid saved dream maps");
				for (var floor of floors) {
					G.maps[floor.key] = floor.definition;
					G.geometry[floor.key] = floor.geometry;
					G.maps[floor.key].data = floor.geometry;
					server_bfs(floor.key);
					floor.smap = smap_data[floor.key];
					floor.amap = amap_data[floor.key];
					if (floor.smap === -1 || !Object.keys(floor.amap).length) throw Error("Invalid generated navigation");
				}
				parentPort.postMessage({ type: "generated_built", key: data.key, floors: floors });
			} catch (error) {
				parentPort.postMessage({ type: "generated_built", key: data.key, failed: true, error: error.message });
			} finally {
				for (var floor of floors) {
					delete G.maps[floor.key];
					delete G.geometry[floor.key];
					delete smap_data[floor.key];
					delete amap_data[floor.key];
				}
			}
			return;
		}
		if (data.type === "remove_map") {
			delete G.maps[data.map];
			delete G.geometry[data.map];
			delete smap_data[data.map];
			delete amap_data[data.map];
			return;
		}
		if (data.type == "map_data") {
			if (data.definition) G.maps[data.map] = data.definition;
			if (data.geometry) G.geometry[data.map] = data.geometry;
			smap_data[data.map] = data.smap_data;
			amap_data[data.map] = data.amap_data;
		}
		if (data.type == "fast_astar") {
			parentPort.postMessage({
				type: "monster_move",
				move: fast_astar(data),
				id: data.id,
				in: data.in,
				path_token: data.path_token,
			});
		}
		if (data.type == "exit") {
			process.exit();
		}
	} catch (e) {
		console.log(e);
		if (data.type == "fast_astar") {
			parentPort.postMessage({
				type: "monster_move",
				move: null,
				id: data.id,
				in: data.in,
				path_token: data.path_token,
			});
		}
	}
});

setInterval(function () {}, 10);
