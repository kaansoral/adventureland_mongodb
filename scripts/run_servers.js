var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
require(path.resolve(__dirname, "data.js"));
var options = require(path.resolve(__dirname, "../secretsandconfig/options_production.js"));

servers.forEach(function (server) {
	var definition = Object.values(options.servers).find((s) => s.region === server.region && s.name === server.name);
	if (server.inactive || !definition || definition.inactive) return;
	var machine = machines[server.machine];
	var command =
		"ssh -o IdentitiesOnly=yes -p " +
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
