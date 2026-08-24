var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
var mode = process.argv[2] || "",
	suffix = "";
if (mode) suffix = "_" + mode;
var options = require(process.env.HOME + "/adventureland/secretsandconfig/options" + suffix + ".js");

// Never report a production update as complete after a failed package, SSH
// check, or upload.
f.execso = f.execso_required;

console.log("Update machines started | mode: " + (mode || "default"));

f.execso("node ~/adventureland/scripts/deploy.js" + ((mode && " " + mode) || ""));
console.log("\nDeploy package prepared");

var first = false;
for (var id in options.machines) {
	var machine = machines[id];
	console.log("\nUploading to " + id + " (" + machine.ip + ")...");
	if (!first) {
		var command =
			"ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes -p " + (machine.ssh_port || 22) + " -i " + machine.key + " " + machine.user + "@" + machine.ip + ' "' + "uptime" + '"';
		f.execso(command);
	}
	var command =
		"rsync -rc --exclude='/agentic/' --exclude='/proposals/' -e 'ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes -p " +
		(machine.ssh_port || 22) +
		" -i " +
		machine.key +
		"' ~/deploy/adventureland/ " +
		machine.user +
		"@" +
		machine.ip +
		":./" +
		machine.deploy_to_folder +
		"/";
	console.log("Running: " + command);
	f.execso(command);
	var dependency_command =
		"ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes -p " +
		(machine.ssh_port || 22) +
		" -i " +
		machine.key +
		" " +
		machine.user +
		"@" +
		machine.ip +
		' "cd ./' +
		machine.deploy_to_folder +
		" && npm install --omit=dev --no-audit --no-fund && npm --prefix node install --omit=dev --no-audit --no-fund && npm ls --omit=dev --depth=0 && npm --prefix node ls --omit=dev --depth=0" +
		'"';
	console.log("Installing and verifying production dependencies on " + id + "...");
	f.execso(dependency_command);
	console.log("Done: " + id);
}

console.log("\nAll machines updated");
