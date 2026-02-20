var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
var mode = process.argv[process.argv.length - 2],
	suffix = "";
if (mode) suffix = "_" + mode;
var options = require(process.env.HOME + "/adventureland/secretsandconfig/options" + suffix + ".js");

const the_command = process.argv.slice(3).join(" ");
console.log("> " + the_command);

for (var key in options.machines) {
	var machine = options.machines[key];
	var command = "ssh -i " + machine.key + " " + machine.user + "@" + machine.ip + ' ". ~/.nvm/nvm.sh && ' + the_command + '"';
	console.log(command);
	f.execso(command);
}
