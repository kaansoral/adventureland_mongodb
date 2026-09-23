"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const gzip = promisify(require("node:zlib").gzip);

const RELOAD = "add_log(phrase('client.data.reloaded'),'#32A3B0');\napply_backup()\n";

function etag(body) {
	return '"' + crypto.createHash("sha256").update(body).digest("hex") + '"';
}

async function encode(body) {
	const compressed = await gzip(body, { level: 6 });
	return {
		identity: { body, etag: etag(body) },
		gzip: { body: compressed, etag: etag(compressed) },
		bytes: body.length + compressed.length,
	};
}

function send(req, res, entry, type, cache_control) {
	res.vary("Accept-Encoding");
	const encoding = req.acceptsEncodings("gzip", "identity");
	if (!encoding) return res.status(406).set("Cache-Control", "no-store").end();
	if (encoding === "gzip") res.set("Content-Encoding", "gzip");
	res.set("ETag", entry[encoding].etag);
	res.set("Cache-Control", cache_control);
	res.set("X-Content-Type-Options", "nosniff");
	if (entry.modified) res.set("Last-Modified", entry.modified);
	return res.type(type).send(entry[encoding].body);
}

function create_web_assets({ root, read_data, local = false, interval_ms = 30000, max_bytes = 64 * 1024 * 1024, on_error = () => console.error("Web asset cache refresh failed") }) {
	const files = new Map(),
		pending_files = new Map();
	let file_bytes = 0,
		data = null,
		pending_data = null,
		timer = null;
	// These are the same public roots and precedence as common/init.js.
	const roots = {
		js: [path.join(root, "js"), path.join(root, "common/js")],
		css: [path.join(root, "css"), path.join(root, "common/css")],
	};

	function refresh_data() {
		if (pending_data) return pending_data;
		pending_data = (async () => {
			const body = Buffer.from("var G=" + JSON.stringify(await read_data()) + ";\n");
			if (data && data.normal.identity.body.equals(body)) return data;
			const normal = await encode(body);
			const reload = await encode(Buffer.concat([body, Buffer.from(RELOAD)]));
			// Publish both variants together; requests can keep using the previous snapshot during a refresh.
			data = { normal, reload };
			return data;
		})().finally(() => {
			pending_data = null;
		});
		return pending_data;
	}

	function serve_data(req, res) {
		const reload = req.query.reload || (req.body && req.body.reload);
		const reply = () => send(req, res, data[reload ? "reload" : "normal"], "application/javascript", reload ? "no-store" : "public, no-cache");
		// No database reads, serialization, file checks or compression on a cache hit, including reloads.
		if (data) return reply();
		return refresh_data().then(reply, () => res.status(503).set("Cache-Control", "no-store").set("Retry-After", "1").end());
	}

	async function read_file(url) {
		const match = /^\/(js|css)\/(.+\.(?:js|css))$/.exec(url);
		if (!match || match[2].includes("\\") || match[2].includes("\0") || match[2].split("/").some((part) => part.startsWith("."))) return null;
		for (const directory of roots[match[1]]) {
			try {
				const public_root = await fs.realpath(directory);
				const filename = await fs.realpath(path.join(public_root, match[2]));
				if (!filename.startsWith(public_root + path.sep)) return null;
				const stat = await fs.stat(filename);
				if (!stat.isFile() || stat.size > 8 * 1024 * 1024) return null;
				const body = await fs.readFile(filename);
				if (body.length > 8 * 1024 * 1024) return null;
				const entry = await encode(body);
				entry.modified = stat.mtime.toUTCString();
				return entry;
			} catch (error) {
				if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
			}
		}
		return null;
	}

	function cached_file(url) {
		// Production source changes activate with the HTTP restart. Local mode uses the live files.
		if (files.has(url)) {
			const entry = files.get(url);
			files.delete(url);
			files.set(url, entry);
			return entry;
		}
		if (pending_files.has(url)) return pending_files.get(url);
		// Fall through to the existing static mounts under unusual load or for oversized files.
		if (pending_files.size >= 64) return null;
		const pending = read_file(url)
			.then((entry) => {
				if (!entry || entry.bytes > max_bytes) return null;
				while (file_bytes + entry.bytes > max_bytes && files.size) {
					const oldest = files.keys().next().value;
					file_bytes -= files.get(oldest).bytes;
					files.delete(oldest);
				}
				files.set(url, entry);
				file_bytes += entry.bytes;
				return entry;
			})
			.finally(() => pending_files.delete(url));
		pending_files.set(url, pending);
		return pending;
	}

	function serve_static(req, res, next) {
		// Local edits and range/precondition requests retain the existing express.static behavior.
		if (local || !["GET", "HEAD"].includes(req.method) || req.headers.range || req.headers["if-match"] || req.headers["if-unmodified-since"]) return next();
		let url;
		try {
			url = decodeURIComponent(req.path);
		} catch (_) {
			return next();
		}
		if (!/^\/(js|css)\/.+\.(js|css)$/.test(url)) return next();
		const reply = (entry) => (entry ? send(req, res, entry, url.endsWith(".css") ? "text/css" : "application/javascript", "public, max-age=2592000") : next());
		const entry = cached_file(url);
		if (!entry || typeof entry.then !== "function") return reply(entry);
		return entry.then(reply, () => next());
	}

	function start() {
		if (timer) return;
		const refresh = () => refresh_data().catch(on_error);
		timer = setInterval(refresh, interval_ms);
		timer.unref();
		return refresh();
	}

	function stop() {
		clearInterval(timer);
		timer = null;
	}

	return { serve_data, serve_static, refresh_data, start, stop };
}

module.exports = { create_web_assets };
