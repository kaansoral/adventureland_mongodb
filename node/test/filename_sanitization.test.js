const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadAdventureFilenameHelpers() {
	const source = fs.readFileSync(path.join(root, "adventure_functions.js"), "utf8");
	const start = source.indexOf("function to_filename");
	const end = source.indexOf("// ==================== GAME DATA UTILITIES", start);
	const context = vm.createContext({});
	vm.runInContext(source.slice(start, end), context);
	return context;
}

function loadClientFilenameHelpers() {
	const source = fs.readFileSync(path.join(root, "js/old_common_functions.js"), "utf8");
	const start = source.indexOf("var valid_file_chars");
	const end = source.indexOf("function e_array", start);
	const context = vm.createContext({});
	vm.runInContext(source.slice(start, end), context);
	return context;
}

test("filename sanitizers preserve lowercase j", () => {
	for (const context of [loadAdventureFilenameHelpers(), loadClientFilenameHelpers()]) {
		assert.equal(context.to_filename("2-javascript"), "2-javascript");
		assert.equal(context.to_filename("../2-javascript<script>"), "..2-javascriptscript");
		assert.equal(context.to_legacy_filename("2-javascript"), "2-avascript");
	}
});

test("code-slot lookup prefers corrected names and falls back to legacy names", () => {
	const context = loadAdventureFilenameHelpers();
	assert.equal(context.find_code_slot({ 1: ["2-avascript", 1] }, "2-javascript"), "1");
	assert.equal(
		context.find_code_slot(
			{
				1: ["2-avascript", 1],
				2: ["2-javascript", 1],
			},
			"2-javascript",
		),
		"2",
	);
});

test("the JavaScript lesson loads through the article API", async () => {
	const helpers = loadAdventureFilenameHelpers();
	const source = fs.readFileSync(path.join(root, "api.js"), "utf8");
	const start = source.indexOf("async function load_article_api");
	const end = source.indexOf("async function load_gcode_api", start);
	const context = vm.createContext({
		docs: {},
		shtml(relativePath) {
			return fs.readFileSync(path.join(root, relativePath), "utf8");
		},
		to_filename: helpers.to_filename,
	});
	vm.runInContext(source.slice(start, end), context);

	const args = { name: "2-javascript", res: { infs: [] } };
	await context.load_article_api(args);
	assert.equal(args.res.infs.length, 1);
	assert.match(args.res.infs[0].html, /Using Javascript is as simple as/);
	assert.doesNotMatch(args.res.infs[0].html, /Article not found/);
});
