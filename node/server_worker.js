var Place = "server";
var options = require("../secretsandconfig/options");
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

parentPort.on("message", function (data) {
	try {
		//console.log(data);
		if (data.type == "map_data") {
			smap_data[data.map] = data.smap_data;
			amap_data[data.map] = data.amap_data;
		}
		if (data.type == "fast_astar") {
			parentPort.postMessage({ type: "monster_move", move: fast_astar(data), id: data.id, in: data.in });
		}
		if (data.type == "exit") {
			process.exit();
		}
	} catch (e) {
		console.log(e);
		if (data.type == "fast_astar") {
			parentPort.postMessage({ type: "monster_move", move: null, id: data.id, in: data.in });
		}
	}
});

setInterval(function () {}, 10);
