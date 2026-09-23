"use strict";

const path = require("node:path");
const { Worker } = require("node:worker_threads");

// Generation has its own bounded queue. Movement workers never compile maps.
function createLayoutQueue(getGameData, { concurrency = 2, limit = 12, timeout = 120000 } = {}) {
	const pending = [],
		running = new Map();
	let closed = false;
	function pump() {
		while (!closed && pending.length && running.size < concurrency) {
			const job = pending.shift();
			if (Date.now() >= job.expires) {
				job.reject(Error("generation_timeout"));
				continue;
			}
			let worker;
			try {
				worker = new Worker(path.resolve(__dirname, "../server_worker.js"), {
					workerData: { G: getGameData(), smap_data: {}, amap_data: {} },
					execArgv: [],
				});
			} catch (error) {
				job.reject(error);
				continue;
			}
			let done = false;
			const timer = setTimeout(() => finish(Error("generation_timeout")), Math.max(1, job.expires - Date.now()));
			function finish(error, floors) {
				if (done) return;
				done = true;
				clearTimeout(timer);
				worker.removeAllListeners();
				void worker
					.terminate()
					.catch(() => {})
					.finally(() => {
						running.delete(worker);
						pump();
					});
				if (error) job.reject(error);
				else job.resolve(floors);
			}
			running.set(worker, finish);
			worker.on("error", finish);
			worker.on("exit", () => finish(Error("generation_worker_exit")));
			worker.on("message", (data) => {
				if (data.type !== "generated_built" || data.key !== job.data.key) return;
				finish(
					data.failed ? Error("generation_failed", { cause: Error(data.error || "Unknown layout error") }) : null,
					data.floors,
				);
			});
			try {
				worker.postMessage(Object.assign({ type: "generated_build" }, job.data));
			} catch (error) {
				finish(error);
			}
		}
	}
	return {
		build(data) {
			if (closed || pending.length + running.size >= limit) return Promise.reject(Error("generation_busy"));
			return new Promise((resolve, reject) => {
				pending.push({ data, resolve, reject, expires: Date.now() + timeout });
				pump();
			});
		},
		close() {
			closed = true;
			for (const job of pending.splice(0)) job.reject(Error("generation_closed"));
			for (const finish of running.values()) finish(Error("generation_closed"));
		},
	};
}

module.exports = { createLayoutQueue };
