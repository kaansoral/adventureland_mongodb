var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));

var mode = process.argv[process.argv.length - 1];
var folder = "adventureland";

console.log("Deploy started | mode: " + (mode || "default") + " | folder: " + folder);

f.execs("node ~/adventureland/scripts/precompute_images.js");

f.execs("rm -rf ~/deploy/" + folder + "");
f.execs("mkdir ~/deploy/" + folder + "");
f.execs("rsync -rv --whole-file --exclude=.electron --exclude=node_modules ~/adventureland/* ~/deploy/" + folder + "");

f.execs("rm -rf ~/deploy/" + folder + "/node/node_modules");
f.execs("rm -rf ~/deploy/" + folder + "/node_modules");
f.execs("rm -rf ~/deploy/" + folder + "/*.py");
f.execs("rm -rf ~/deploy/" + folder + "/*.pyc");
f.execs("rm -rf ~/deploy/" + folder + "/scripts");
f.execs("rm -rf ~/deploy/" + folder + "/lib");
f.execs("rm -rf ~/deploy/" + folder + "/python3");
f.execs("rm -rf ~/deploy/" + folder + "/stack");
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
