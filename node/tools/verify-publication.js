"use strict";

const http = require("node:http");
const vm = require("node:vm");
const { assertProtocol3Publication } = require("../game/release_readiness");

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--url") result.url = argv[++index];
		else if (argv[index] === "--help") result.help = true;
		else throw new Error(`Unknown argument ${argv[index]}`);
	}
	return result;
}

function readUrl(url) {
	return new Promise((resolve, reject) => {
		const request = http.get(url, (response) => {
			if (response.statusCode !== 200) {
				response.resume();
				reject(new Error(`data.js returned HTTP ${response.statusCode}`));
				return;
			}
			let body = "";
			response.setEncoding("utf8");
			response.on("data", (chunk) => {
				body += chunk;
			});
			response.on("end", () => resolve(body));
		});
		request.setTimeout(5_000, () => request.destroy(new Error("data.js preflight timed out")));
		request.on("error", reject);
	});
}

async function main(argv = process.argv.slice(2), env = process.env) {
	const args = parseArgs(argv);
	if (args.help) {
		process.stdout.write("node node/tools/verify-publication.js --url http://127.0.0.1:8090/data.js\n");
		return null;
	}
	const url = new URL(args.url || env.ADVENTURELAND_DATA_URL || "http://127.0.0.1:8090/data.js");
	if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
		throw new Error("Publication verification is loopback-only");
	}
	if (url.pathname !== "/data.js" || url.search || url.hash) throw new Error("Publication URL must end in /data.js");
	const source = await readUrl(url);
	const context = {};
	vm.runInNewContext(source, context, { timeout: 5_000 });
	const report = assertProtocol3Publication(context.G);
	process.stdout.write(`${JSON.stringify(report)}\n`);
	return report;
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.code || "WORLD_PUBLICATION"}: ${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = { main, parseArgs, readUrl };
