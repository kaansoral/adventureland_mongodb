var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
var mode = process.argv[process.argv.length - 2],
	suffix = "";
if (mode) suffix = "_" + mode;
var options = require(process.env.HOME + "/adventureland/secretsandconfig/options" + suffix + ".js");
var target_machine = process.env.ADVENTURELAND_MACHINE || "";
if (target_machine && !options.machines[target_machine]) throw new Error("Unknown target machine: " + target_machine);

var the_command = process.argv.slice(3).join(" ");
if (/^pm2\s+(start|restart)\b/.test(the_command) && !/(^|\s)--time(\s|$)/.test(the_command)) the_command += " --time";
console.log("> " + the_command);

for (var key in options.machines) {
	if (target_machine && key !== target_machine) continue;
	var machine = options.machines[key];
	var machine_command = the_command;
	if (/^pm2\s+(start|restart)\s+\/\^al_\//.test(the_command)) {
		var names = Object.keys(options.servers).filter((id) => !options.servers[id].inactive && options.servers[id].machine === key);
		if (!names.length) continue;
		// Keep PM2's existing-process selection, but restrict it to active definitions on this host.
		machine_command = the_command.replace("/^al_/", "'/^(" + names.map((id) => "al_" + id).join("|") + ")$/'");
	}
	var command = "ssh -o IdentitiesOnly=yes -p " + (machine.ssh_port || 22) + " -i " + machine.key + " " + machine.user + "@" + machine.ip + ' "' + machine_command + '"';
	console.log(command);
	f.execso(command);
}
