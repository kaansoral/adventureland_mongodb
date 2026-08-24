var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js")),
	lock_update_notes = require(path.resolve(__dirname, "lock_update_notes.js"));

var mode = process.argv[2] || "";
var folder = "adventureland";

// A release must stop on the first failed packaging command.
f.execs = f.execs_required;

console.log("Deploy started | mode: " + (mode || "default") + " | folder: " + folder);

if (mode != "staging") {
	var locked = lock_update_notes(path.resolve(__dirname, ".."));
	console.log("Update notes locked | date: " + locked.date + " | notes: " + locked.notes);
}

f.execs("node ~/adventureland/scripts/precompute_images.js");

f.execs("rm -rf ~/deploy/" + folder + "");
f.execs("mkdir ~/deploy/" + folder + "");
// Package the committed tree, not unrelated local drafts or ignored files.
// Deployment-generated metadata is overlaid explicitly below.
f.execs("git -C ~/adventureland archive --format=tar HEAD | tar -xf - -C ~/deploy/" + folder);
f.execs("cp ~/adventureland/version.js ~/deploy/" + folder + "/version.js");
f.execs("cp ~/adventureland/update_notes.js ~/deploy/" + folder + "/update_notes.js");
f.execs("cp ~/adventureland/design/precomputed_images.js ~/deploy/" + folder + "/design/precomputed_images.js");

f.execs("rm -rf ~/deploy/" + folder + "/node/node_modules");
f.execs("rm -rf ~/deploy/" + folder + "/node_modules");
f.execs("rm -rf ~/deploy/" + folder + "/*.py");
f.execs("rm -rf ~/deploy/" + folder + "/*.pyc");
f.execs("rm -rf ~/deploy/" + folder + "/scripts");
f.execs("rm -rf ~/deploy/" + folder + "/agentic");
f.execs("rm -rf ~/deploy/" + folder + "/proposals");
f.execs("rm -rf ~/deploy/" + folder + "/lib");
f.execs("rm -rf ~/deploy/" + folder + "/python3");
f.execs("rm -rf ~/deploy/" + folder + "/stack");
f.execs("mkdir -p ~/deploy/" + folder + "/stack");
f.execs("rm -rf ~/deploy/" + folder + "/electron");
f.execs("find ~/deploy/" + folder + "/ -name '*.pxm' -delete");

f.execs("cp -R ~/adventureland/common/ ~/deploy/" + folder + "/common/");
f.execs("cp -R ~/adventureland/secretsandconfig/ ~/deploy/" + folder + "/secretsandconfig/");
if (mode == "staging") {
	f.execs("cp ~/deploy/" + folder + "/secretsandconfig/options_staging.js ~/deploy/" + folder + "/secretsandconfig/options.js");
	f.execs("cp ~/deploy/" + folder + "/secretsandconfig/keys_staging.js ~/deploy/" + folder + "/secretsandconfig/keys.js");
}
if (mode == "production") {
	f.execs("cp ~/deploy/" + folder + "/secretsandconfig/options_production.js ~/deploy/" + folder + "/secretsandconfig/options.js");
	f.execs("cp ~/deploy/" + folder + "/secretsandconfig/keys_production.js ~/deploy/" + folder + "/secretsandconfig/keys.js");
}

f.execs("rm ~/deploy/" + folder + "/secretsandconfig/options_staging.js");
f.execs("rm ~/deploy/" + folder + "/secretsandconfig/options_production.js");
f.execs("rm ~/deploy/" + folder + "/secretsandconfig/keys_staging.js");
f.execs("rm ~/deploy/" + folder + "/secretsandconfig/keys_production.js");

f.execs("cp ~/deploy/" + folder + "/common/js/common_functions.js ~/deploy/" + folder + "/js/common_functions.js");
f.execs("cp ~/deploy/" + folder + "/js/runner_functions.js ~/deploy/" + folder + "/htmls/contents/codes/runner_functions.js");
f.execs("cp ~/deploy/" + folder + "/js/runner_compat.js ~/deploy/" + folder + "/htmls/contents/codes/runner_compat.js");
f.execs("cp ~/deploy/" + folder + "/js/common_functions.js ~/deploy/" + folder + "/htmls/contents/codes/common_functions.js");

to_minify = {
	css: ["index.css", "common.css"],
	"utility/htmls": ["map_editor.js"],
};
f.minify_all("~/deploy/" + folder + "", to_minify);

f.execs("rm -rf ~/deploy/" + folder + "/.git");
f.execs("rm -rf ~/deploy/" + folder + "/common/.git");

console.log("Deploy finished");
