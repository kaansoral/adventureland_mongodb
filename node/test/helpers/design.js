const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../../..");
const context = vm.createContext({ console, Math, require, module: { exports: {} } });
// Definitions share a scope at runtime. Load dependencies before their users.
for (const name of [
	"multipliers",
	"game_design",
	"classes",
	"levels",
	"upgrades",
	"conditions",
	"skills",
	"projectiles",
	"items",
	"monsters",
	"maps",
	"npcs",
	"drops",
	"recipes",
	"titles",
	"tokens",
	"dimensions",
	"sprites",
	"animations",
	"cosmetics",
	"achievements",
	"events",
]) {
	const filename = path.join(root, "design", name + ".js");
	context.module = { exports: {} };
	vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}
for (const relative of ["common/js/common_functions.js", "js/old_common_functions.js"]) {
	const filename = path.join(root, relative);
	vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}
context.G = context;
context.doublehand_types = [
	"rapier",
	"bow",
	"axe",
	"scythe",
	"basher",
	"great_sword",
	"great_staff",
	"crossbow",
	"rod",
	"pickaxe",
];
module.exports = context;
