var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
require(process.env.HOME + "/thegame/scripts/data.js");

servers.forEach(function (server) {
	var machine = machines[server.machine];
	var command =
		"ssh -p " +
		(machine.ssh_port || 22) +
		" -i " +
		machine.key +
		" " +
		machine.user +
		"@" +
		machine.ip +
		" \"screen -dm bash -c 'node adventureland/server.js " +
		server.region +
		" " +
		server.name +
		" " +
		server.port +
		" > adventureland/s" +
		server.port +
		".out 2> adventureland/s" +
		server.port +
		".err'\"";
	console.log(command);
	f.execso(command);
});
