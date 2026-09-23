const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");
const express = require("express");
const { create_web_assets } = require("../../web_assets");
const { extract, read, root } = require("./helpers/server_vm");

function cached_response(assets, query = {}, headers = {}) {
	const req = Object.assign(Object.create(express.request), { query, headers });
	const res = {
		headers: {},
		set(name, value) {
			this.headers[name] = value;
			return this;
		},
		vary(name) {
			return this.set("Vary", name);
		},
		type(value) {
			return this.set("Content-Type", value);
		},
		send(body) {
			this.body = body;
			return this;
		},
	};
	assert.equal(assets.serve_data(req, res), res, "a hit replies synchronously");
	return res;
}

async function fixture(t, options = {}) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "al-web-assets-"));
	for (const folder of ["js", "css", "common/js", "common/css"])
		await fs.mkdir(path.join(directory, folder), { recursive: true });
	const assets = create_web_assets({ root: directory, read_data: async () => ({ version: 1 }), ...options });
	const inner = express();
	inner.use(express.json());
	inner.use(express.urlencoded({ extended: true }));
	inner.all("/data.js", assets.serve_data);
	for (const folder of ["js", "common/js", "css", "common/css"])
		inner.use("/" + path.basename(folder), express.static(path.join(directory, folder), { maxAge: "30d" }));
	inner.use((req, res) => res.status(404).end());
	const app = express();
	app.use(assets.serve_static);
	app.use(inner);
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(async () => {
		assets.stop();
		await new Promise((resolve) => server.close(resolve));
		await fs.rm(directory, { recursive: true, force: true });
	});
	const request = (url, headers = {}, method = "GET", body) =>
		new Promise((resolve, reject) => {
			const req = http.request(
				{ host: "127.0.0.1", port: server.address().port, path: url, method, headers },
				(res) => {
					const chunks = [];
					res.on("data", (chunk) => chunks.push(chunk));
					res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
				},
			);
			req.on("error", reject);
			req.end(body);
		});
	return { assets, directory, request };
}

test("cached data and reloads do no reads or recompression while a background refresh is pending", async () => {
	let reads = 0,
		value = 1,
		unblock;
	const assets = create_web_assets({
		root,
		read_data: async () => {
			reads++;
			if (unblock) await unblock.promise;
			return { value };
		},
	});
	await assets.refresh_data();
	const original = cached_response(assets, {}, { "accept-encoding": "gzip" });
	for (let i = 0; i < 20; i++)
		assert.equal(cached_response(assets, { timestamp: i }, { "accept-encoding": "gzip" }).body, original.body);
	assert.equal(reads, 1);
	await assets.refresh_data();
	assert.equal(
		cached_response(assets, {}, { "accept-encoding": "gzip" }).body,
		original.body,
		"unchanged input keeps the same encoded buffer",
	);
	const reload = cached_response(assets, { reload: 1, timestamp: 1 });
	const effects = [],
		runtime = {
			add_log: (...args) => effects.push(args),
			phrase: (id) => id,
			apply_backup: () => effects.push("backup"),
		};
	vm.runInNewContext(reload.body.toString(), runtime);
	assert.equal(runtime.G.value, 1);
	assert.deepEqual(effects, [["client.data.reloaded", "#32A3B0"], "backup"]);
	assert.equal(reload.headers["Cache-Control"], "no-store");
	unblock = Promise.withResolvers();
	value = 2;
	const pending = assets.refresh_data();
	assert.equal(assets.refresh_data(), pending, "overlapping refreshes share one build");
	assert.equal(cached_response(assets, {}, { "accept-encoding": "gzip" }).body, original.body);
	assert.equal(cached_response(assets, { reload: 1 }).body, reload.body);
	unblock.resolve();
	await pending;
	const refreshed = cached_response(assets, {}, { "accept-encoding": "gzip" });
	assert.notEqual(refreshed.headers.ETag, original.headers.ETag);
	assert.match(zlib.gunzipSync(refreshed.body).toString(), /"value":2/);
	assert.equal(reads, 3);
});

test("startup warms data and the 30-second interval refreshes it without a request", async (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	let reads = 0,
		value = 1;
	const assets = create_web_assets({
		root,
		read_data: async () => {
			reads++;
			return { value };
		},
	});
	t.after(assets.stop);
	await assets.start();
	value = 2;
	t.mock.timers.tick(29999);
	assert.equal(reads, 1);
	t.mock.timers.tick(1);
	await assets.refresh_data();
	assert.equal(reads, 2);
	assert.match(cached_response(assets).body.toString(), /"value":2/);
	assets.stop();
	t.mock.timers.tick(30000);
	assert.equal(reads, 2);
});

test("failed refreshes retain the complete last snapshot and a cold failure can recover", async (t) => {
	let fail = true;
	const { assets, request } = await fixture(t, {
		read_data: async () => {
			if (fail) throw new Error("unavailable");
			return { version: 1 };
		},
	});
	const unavailable = await request("/data.js");
	assert.equal(unavailable.status, 503);
	assert.equal(unavailable.headers["cache-control"], "no-store");
	fail = false;
	const ready = await request("/data.js", { "accept-encoding": "gzip" });
	fail = true;
	await assert.rejects(assets.refresh_data(), /unavailable/);
	assert.deepEqual((await request("/data.js", { "accept-encoding": "gzip" })).body, ready.body);
});

test("data responses negotiate gzip, revalidate ETags, support HEAD and preserve POST reloads", async (t) => {
	const { request } = await fixture(t);
	const plain = await request("/data.js", { "accept-encoding": "gzip;q=0" });
	const compressed = await request("/data.js", { "accept-encoding": "br, gzip" });
	assert.equal(compressed.headers["content-encoding"], "gzip");
	assert.equal(compressed.headers.vary, "Accept-Encoding");
	assert.equal(compressed.headers["cache-control"], "public, no-cache");
	assert.equal(compressed.headers["content-length"], String(compressed.body.length));
	assert.notEqual(compressed.headers.etag, plain.headers.etag);
	assert.deepEqual(zlib.gunzipSync(compressed.body), plain.body);
	assert.equal((await request("/data.js", { "accept-encoding": "gzip;q=0, identity;q=0" })).status, 406);
	const unchanged = await request("/data.js", { "accept-encoding": "gzip", "if-none-match": compressed.headers.etag });
	assert.equal(unchanged.status, 304);
	assert.equal(unchanged.body.length, 0);
	const head = await request("/data.js", { "accept-encoding": "gzip" }, "HEAD");
	assert.equal(head.headers.etag, compressed.headers.etag);
	assert.equal(head.headers["content-length"], compressed.headers["content-length"]);
	assert.equal(head.body.length, 0);
	const reload = await request(
		"/data.js",
		{ "content-type": "application/json", "accept-encoding": "gzip" },
		"POST",
		JSON.stringify({ reload: 1 }),
	);
	assert.equal(reload.headers["cache-control"], "no-store");
	assert.match(zlib.gunzipSync(reload.body).toString(), /apply_backup\(\)/);
});

test("JS and CSS share concurrent builds, preserve root precedence, and ignore query strings", async (t) => {
	const { directory, request } = await fixture(t);
	const script = "var example = 1;\n".repeat(100);
	await fs.writeFile(path.join(directory, "js/example.js"), script);
	await fs.writeFile(path.join(directory, "common/js/example.js"), "wrong root");
	await fs.writeFile(path.join(directory, "common/js/shared.js"), script);
	await fs.writeFile(path.join(directory, "css/example.css"), "body{color:white}\n".repeat(100));
	const original_read = fs.readFile;
	let reads = 0;
	t.mock.method(fs, "readFile", async (...args) => {
		reads++;
		return original_read(...args);
	});
	const burst = await Promise.all(
		Array.from({ length: 20 }, (_, index) =>
			request("/js/example.js?v=" + index, { "accept-encoding": "gzip", cookie: "language=tr" }),
		),
	);
	assert.equal(reads, 1);
	for (const result of burst) {
		assert.equal(zlib.gunzipSync(result.body).toString(), script);
		assert.equal(result.headers.vary, "Accept-Encoding");
		assert.equal(result.headers["cache-control"], "public, max-age=2592000");
	}
	await fs.writeFile(path.join(directory, "js/example.js"), "var example = 2;");
	assert.equal(
		(await request("/js/example.js?timestamp=123")).body.toString(),
		script,
		"production cache lasts for this HTTP process",
	);
	assert.equal(reads, 1, "a hit does not touch the filesystem");
	assert.equal((await request("/js/shared.js")).body.toString(), script);
	const css = await request("/css/example.css", { "accept-encoding": "gzip" });
	assert.match(css.headers["content-type"], /^text\/css/);
	assert.equal(zlib.gunzipSync(css.body).toString(), "body{color:white}\n".repeat(100));
	const head = await request("/css/example.css", { "accept-encoding": "gzip" }, "HEAD");
	assert.equal((await request("/css/example.css", { "if-modified-since": css.headers["last-modified"] })).status, 304);
	assert.equal(head.body.length, 0);
	assert.equal(head.headers["content-length"], css.headers["content-length"]);
	assert.equal(
		(await request("/css/example.css", { "accept-encoding": "gzip", "if-none-match": css.headers.etag })).status,
		304,
	);
});

test("local changes, range requests, missing files and memory eviction retain static-file behavior", async (t) => {
	const local = await fixture(t, { local: true });
	await fs.writeFile(path.join(local.directory, "js/example.js"), "one");
	assert.equal((await local.request("/js/example.js")).body.toString(), "one");
	await fs.writeFile(path.join(local.directory, "js/example.js"), "two");
	assert.equal((await local.request("/js/example.js")).body.toString(), "two");
	const bounded = await fixture(t, { max_bytes: 1000 });
	await fs.writeFile(path.join(bounded.directory, "js/one.js"), "x".repeat(600));
	await fs.writeFile(path.join(bounded.directory, "js/two.js"), "y".repeat(600));
	await bounded.request("/js/one.js");
	await bounded.request("/js/two.js");
	await fs.writeFile(path.join(bounded.directory, "js/one.js"), "new");
	assert.equal((await bounded.request("/js/one.js")).body.toString(), "new");
	const range = await bounded.request("/js/two.js", { range: "bytes=0-2", "accept-encoding": "gzip" });
	assert.equal(range.status, 206);
	assert.equal(range.body.toString(), "yyy");
	assert.equal(range.headers["content-encoding"], undefined);
	assert.equal((await bounded.request("/js/missing.js")).status, 404);
	assert.equal((await bounded.request("/js/%2e%2e/main.js")).status, 404);
});

test("the real data assembler retains public definitions, aliases, ignored maps and missing geometry", async () => {
	const design = require("./helpers/design");
	const calls = [],
		map = { info: { data: { x_lines: [[1, 2, 3]], y_lines: [], data: {} } } };
	const context = vm.createContext({
		...design,
		Version: 123,
		get: async (id) => {
			calls.push(id);
			return id === "MP_main" ? map : null;
		},
	});
	for (const file of ["design/games.js", "design/precomputed_images.js", "docs/directory.js"])
		vm.runInContext(read(file), context);
	context.maps = {
		main: { key: "main" },
		alias: { key: "main" },
		hidden: { key: "hidden", ignore: true },
		missing: { key: "missing" },
	};
	vm.runInContext(extract(read("main.js"), "get_browser_data"), context);
	const data = await context.get_browser_data();
	assert.equal(data.items, design.items);
	assert.equal(data.skills, design.skills);
	assert.equal(data.geometry.main, map.info.data);
	assert.equal(data.geometry.alias, map.info.data);
	assert.deepEqual(Object.keys(data.geometry), ["main", "alias"]);
	assert.deepEqual(calls, ["MP_main", "MP_main", "MP_missing"]);
	assert.equal(data.version, 123);
	assert.equal(data.images, context.precomputed.images);
	assert.equal(data.docs, context.docs);
	assert.equal(data.get, undefined);
	assert.equal(data.require, undefined);
});

test("main registers cached data before localization and keeps the new URL outside the old browser cache", () => {
	const main = read("main.js");
	assert.ok(main.indexOf('app.all("/data.js", web_assets.serve_data)') < main.indexOf("localization.middleware"));
	assert.ok(main.indexOf("http_app.use(web_assets.serve_static)") < main.indexOf("http_app.use(app)"));
	for (const page of ["index", "base", "comm", "payments", "realm"])
		assert.match(read("htmls/" + page + ".html"), /data\.js\?v=[^\"]+&amp;cache=1/);
});
