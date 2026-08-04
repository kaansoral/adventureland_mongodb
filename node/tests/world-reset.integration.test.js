"use strict";

const test = require("node:test");

test(
	"disposable Mongo reset integration is opt-in and isolated",
	{ skip: !process.env.ADVENTURELAND_RESET_MONGODB_URI },
	async () => {
		const { runReset } = require("../tools/reset-world");
		const result = await runReset({
			argv: ["--database", process.env.ADVENTURELAND_RESET_MONGODB_DATABASE || "adventureland-reset-test"],
			env: process.env,
			stdout: () => {},
		});
		if (result.mode !== "dry-run") throw new Error("integration preflight must start in dry-run mode");
	},
);
