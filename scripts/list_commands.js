var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
require(path.resolve(__dirname, "data.js"));
var options = require(path.resolve(__dirname, "../secretsandconfig/options_production.js"));

servers.forEach(function (server) {
	var definition = Object.values(options.servers).find((s) => s.region === server.region && s.name === server.name);
	if (server.inactive || !definition || definition.inactive) return;
	var machine = machines[server.machine];
	var command = "[" + server.machine + "] ssh -o IdentitiesOnly=yes -p " + (machine.ssh_port || 22) + " -i " + machine.key + " " + machine.user + "@" + machine.ip;
	console.log(command);
	command = "[" + server.machine + " logs] scp -o IdentitiesOnly=yes -P " + (machine.ssh_port || 22) + " -i " + machine.key + " " + machine.user + "@" + machine.ip + ":s" + server.port + ".out .";
	console.log(command);
	command =
		"[" +
		server.machine +
		" run] ssh -o IdentitiesOnly=yes -p " +
		(machine.ssh_port || 22) +
		" -i " +
		machine.key +
		" " +
		machine.user +
		"@" +
		machine.ip +
		' "nohup node adventureland/server.js ' +
		server.region +
		" " +
		server.name +
		" " +
		server.port +
		" > s" +
		server.port +
		".out 2> s" +
		server.port +
		'.err < /dev/null &"';
	console.log(command);
});
