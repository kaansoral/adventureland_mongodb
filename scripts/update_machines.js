var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
var mode = process.argv[process.argv.length - 1],
	suffix = "";
if (mode) suffix = "_" + mode;
var options = require(process.env.HOME + "/adventureland/secretsandconfig/options" + suffix + ".js");

console.log("Update machines started | mode: " + (mode || "default"));

f.execso("node ~/adventureland/scripts/deploy.js" + ((mode && " " + mode) || ""));
console.log("\nDeploy package prepared");

var first = false;
for (var id in options.machines) {
	var machine = machines[id];
	console.log("\nUploading to " + id + " (" + machine.ip + ")...");
	if (!first) {
		var command = "ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i " + machine.key + " " + machine.user + "@" + machine.ip + ' "' + "uptime" + '"';
		f.execso(command);
	}
	var command =
		"rsync -ruv -e 'ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i " + machine.key + "' ~/deploy/adventureland/ " + machine.user + "@" + machine.ip + ":./" + machine.deploy_to_folder + "/";
	console.log("Running: " + command);
	f.execso(command);
	console.log("Done: " + id);
}

console.log("\nAll machines updated");
