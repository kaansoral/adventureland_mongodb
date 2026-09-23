const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");
const express = require("express");
const nunjucks = require("nunjucks");
const localization = require("../../languages");
const notes = require("../../update_notes");
const { root, read, extract } = require("./helpers/server_vm");

function response() {
	return {
		headers: {},
		statusCode: 200,
		set(name, value) {
			this.headers[name] = value;
			return this;
		},
		vary(name) {
			this.headers.Vary = (this.headers.Vary || []).concat(name);
			return this;
		},
		type(value) {
			return this.set("Content-Type", value);
		},
		status(value) {
			this.statusCode = value;
			return this;
		},
		send(body) {
			this.body = body;
			return this;
		},
	};
}

function serve(language, encoding) {
	const req = Object.create(express.request);
	req.params = { language };
	req.headers = encoding === undefined ? {} : { "accept-encoding": encoding };
	const res = response();
	localization.serve(req, res);
	return res;
}

function dictionary(language) {
	let result;
	vm.runInNewContext(serve(language).body, {
		phrase: {
			load: (code, entries) => {
				result = entries;
			},
		},
	});
	return result;
}

test("browser catalogs exclude server prose and preserve each language's client phrases", (t) => {
	for (const { code } of localization.languages) {
		const full = localization.catalog(code),
			browser = dictionary(code);
		for (const id of Object.keys(browser)) assert.equal(browser[id], full[id], code + ": " + id);
		for (const id of [
			"language.choose",
			"skill.attack.name",
			"page.code.active",
			"server.game_log.wore_off",
			"server.cave.revival_text",
			"server.cave.revive_here",
			"server.item.found",
		])
			assert.equal(browser[id], full[id], code + ": " + id);
		assert.deepEqual(
			Object.keys(browser)
				.filter((id) => id.startsWith("docs."))
				.sort(),
			["docs.guide.basics.move", "docs.reference.source_code"],
		);
		assert.ok(
			!Object.keys(browser).some((id) =>
				/^(pages\.|update\.|desktop\.|server\.(api|page|mail|email|tutorial|code|payment)\.)/.test(id),
			),
			code,
		);
	}
	const plain = serve("en").body,
		compressed = serve("en", "gzip").body;
	// The 50 cave encounters add 603 live dialogue phrases (about 50 KB plain).
	// Articles and archives still stay out; the reviewed catalog is 327 KB / 92 KB gzip.
	assert.ok(
		Buffer.byteLength(plain) < 350000,
		"Review browser delivery before raising the 350 KB English startup limit",
	);
	assert.ok(compressed.length < 100000, "Review browser delivery before raising the 100 KB gzip startup limit");
	t.diagnostic("English catalog: " + Buffer.byteLength(plain) + " bytes; gzip: " + compressed.length + " bytes");
});

test("phrase responses negotiate compression and keep safe, cacheable JavaScript", () => {
	const plain = serve("tr"),
		gzip = serve("tr", "br, gzip");
	assert.equal(gzip.statusCode, 200);
	assert.equal(gzip.headers["Content-Encoding"], "gzip");
	assert.deepEqual(gzip.headers.Vary, ["Accept-Encoding"]);
	assert.equal(gzip.headers["Cache-Control"], "public, max-age=2592000");
	assert.equal(zlib.gunzipSync(gzip.body).toString(), plain.body);
	assert.equal(serve("tr", "gzip;q=0").body, plain.body);
	assert.equal(serve("tr", "gzip;q=0, identity;q=0").statusCode, 406);
	assert.equal(serve("../en", "gzip").statusCode, 404);
	assert.doesNotMatch(plain.body, /[<>&\u2028\u2029]/);
	assert.equal(serve("tr", "gzip").body, gzip.body, "reuse the compressed response");
});

function files(directory) {
	return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
		if (entry.isSymbolicLink() || ["node_modules", "codemirror", "libraries", ".git", "target"].includes(entry.name))
			return [];
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) return files(file);
		return /\.(js|html)$/.test(file) && !file.endsWith(".min.js") ? [file] : [];
	});
}

test("client and socket phrase references remain available after segmentation", () => {
	const full = localization.catalog("en"),
		browser = dictionary("en");
	for (const file of ["js", "htmls", "docs", "utility"].flatMap(files)) {
		let source = read(file);
		// Nunjucks calls run on the server, including those inside script elements.
		if (file.endsWith(".html")) source = source.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g, "");
		source = source.replace(/\\(["'])/g, "$1");
		for (const match of source.matchAll(/["']([a-z][\w.-]+)["']/g)) {
			const id = match[1];
			if (Object.hasOwn(full, id)) assert.ok(Object.hasOwn(browser, id), file + ": missing browser phrase " + id);
		}
	}
	for (const file of ["node/server.js", "node/server_functions.js", ...files("node/logic")]) {
		for (const match of read(file).matchAll(/(?:localization\.message|item_message)\(\s*["']([^"']+)["']/g)) {
			const prefix = match[1];
			for (const id of Object.keys(full).filter(
				(id) => id === prefix || (prefix.endsWith(".") && id.startsWith(prefix)),
			))
				assert.ok(Object.hasOwn(browser, id), file + ": missing socket phrase " + id);
		}
	}
});

function in_language(language, action) {
	const req = { cookies: { language }, headers: {} };
	return new Promise((resolve, reject) => {
		localization.middleware(async () => null)(req, response(), (error) => {
			if (error) return reject(error);
			Promise.resolve().then(action).then(resolve, reject);
		});
	});
}

test("article requests translate on the server without shipping their prose in the catalog", async () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	const renderer = { render: env.render.bind(env), runtime: nunjucks.runtime };
	const context = vm.createContext({ env, nunjucks: renderer, localization, to_filename: (value) => value });
	const filters = read("filters.js");
	vm.runInContext(filters.slice(0, filters.indexOf('env.addFilter("to_json"')), context);
	vm.runInContext(extract(read("adventure_functions.js"), "shtml"), context);
	vm.runInContext(extract(read("api.js"), "load_article_api"), context);
	const id = "docs.functions.get_servers.returns-the-current-cached-server-directory";
	assert.equal(dictionary("tr")[id], undefined);
	await in_language("tr", async () => {
		const args = { name: "get_servers", func: true, res: { infs: [] } };
		await context.load_article_api(args);
		assert.equal(args.res.infs[0].type, "article");
		assert.ok(args.res.infs[0].html.includes(localization.phrase_html(id)));
		assert.ok(args.res.infs[0].html.includes("show_json(get_servers());"));
	});
});

test("cave story loads five native comic pages and descriptions in the selected language", async () => {
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	const context = vm.createContext({ env, nunjucks, localization });
	const filters = read("filters.js");
	vm.runInContext(filters.slice(0, filters.indexOf('env.addFilter("to_json"')), context);
	for (const { code } of localization.languages) {
		const html = env.render("docs/guide/cave-story.html", { domain: { language: code } });
		const images = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"/g)];
		assert.equal(images.length, 5, code);
		for (let i = 0; i < images.length; i++) {
			const prefix = code === "en" ? "" : code + "/";
			assert.equal(images[i][1], `/images/comics/cave/${prefix}${i + 1}.png?v=2`);
			const png = fs.readFileSync(path.join(root, images[i][1].split("?")[0]));
			assert.equal(png.readUInt32BE(16), 960, code);
			assert.equal(png.readUInt32BE(20), 540, code);
			assert.equal(
				images[i][2],
				nunjucks.lib.escape(localization.phrase(`docs.cave.comic.page${i + 1}.alt`, {}, code)),
			);
		}
	}
});

test("bank destination guidance is translated and reaches both docs and MCP", async () => {
	const id = "docs.functions.bank_store.explicit_destination";
	const english = require("../../languages/en/docs")[id];
	const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { autoescape: true });
	const renderer = { render: env.render.bind(env), runtime: nunjucks.runtime };
	const context = vm.createContext({
		env,
		nunjucks: renderer,
		localization,
		to_filename: (value) => value,
		docs: { functions: ["bank_store", "bank_retrieve"] },
		fs,
		path,
		__dirname: root,
		MCP_SOURCE_REPOSITORY: "https://github.com/kaansoral/adventureland",
	});
	const filters = read("filters.js");
	vm.runInContext(filters.slice(0, filters.indexOf('env.addFilter("to_json"')), context);
	vm.runInContext(extract(read("adventure_functions.js"), "shtml"), context);
	for (const name of ["mcp_api_html_to_text", "mcp_api_public_source_location", "mcp_api_get_code_method"])
		vm.runInContext(extract(read("mcp_api.js"), name), context);
	for (const { code } of localization.languages) {
		const filename = code === "en" ? "languages/en/docs.js" : `languages/${code}/docs.json`;
		const source = read(filename);
		assert.equal(source.split(JSON.stringify(id) + ":").length, 2, `${code}: exactly one phrase entry`);
		const translated = code === "en" ? english : JSON.parse(source)[id];
		assert.ok(typeof translated === "string" && translated.trim(), code);
		if (code !== "en") assert.notEqual(translated, english, `${code}: no English filler`);
		assert.doesNotMatch(translated, /[{}<>]/, `${code}: no added placeholders or markup`);
		await in_language(code, async () => {
			for (const file of [
				"docs/functions/bank_store.html",
				"docs/functions/bank_retrieve.html",
				"docs/guide/banking.html",
			])
				assert.ok(context.shtml(file).includes(localization.phrase_html(id)), `${code}: ${file}`);
			for (const name of ["bank_store", "bank_retrieve"]) {
				const result = await context.mcp_api_get_code_method({ name });
				assert.equal(result.success, true);
				assert.ok(result.documentation.includes(translated), `${code}: MCP ${name}`);
			}
		});
	}
});

test("initial and paginated update notes carry request-local text without changing canonical notes", async () => {
	const before = JSON.stringify(notes);
	let handler;
	const context = vm.createContext({
		localization,
		phrase: localization.phrase,
		update_notes: notes,
		app: {
			get: (url, callback) => {
				handler = callback;
			},
		},
		get_domain_common: async () => ({}),
		set_default_seo: () => {},
		Version: 1,
		LastDeploy: "[09/09/26]",
		game_name: "Adventure Land",
		SALES: [],
		imagesets: {},
		ip_to_subdomain: {},
		gender_types: [],
		character_types: [],
		Dev: false,
		Local: false,
		Staging: false,
		Prod: true,
		HTTPS_MODE: true,
		options: { base_url: "https://adventure.test" },
		keys: {},
		base_domain: "adventure.test",
	});
	vm.runInContext(extract(read("adventure_functions.js"), "get_domain"), context);
	const main = read("main.js"),
		start = main.indexOf('app.get("/update-notes",');
	vm.runInContext(main.slice(start, main.indexOf("\napp.get(", start + 1)), context);
	await Promise.all(
		["tr", "ja"].map((language) =>
			in_language(language, async () => {
				const req = { query: {}, cookies: { language }, headers: {}, protocol: "https", get: () => "adventure.test" };
				const domain = await context.get_domain(req, null);
				assert.equal(domain.update_notes.length, 20);
				assert.equal(domain.update_notes_more, true);
				for (let index = 0; index < 20; index++) {
					const entry = domain.update_notes[index];
					assert.equal(entry.note, notes[index].note);
					assert.equal(entry.phrase, notes[index].phrase);
					assert.equal(entry.text, localization.phrase(entry.phrase, {}, language));
				}
				for (const offset of [20, notes.length - 1, notes.length]) {
					const res = response();
					handler({ query: { offset } }, res);
					assert.equal(res.body.notes.length, Math.min(20, notes.length - offset));
					assert.equal(res.body.more, offset + res.body.notes.length < notes.length);
					for (const entry of res.body.notes) assert.equal(entry.text, localization.phrase(entry.phrase, {}, language));
				}
			}),
		),
	);
	assert.equal(JSON.stringify(notes), before);
	assert.deepEqual(localization.translate_notes([{ note: "Legacy note" }], "tr"), [
		{ note: "Legacy note", text: "Legacy note" },
	]);
});

test("note renderers use delivered translations while retaining colors and safe modal text", () => {
	const translated = localization.translate_notes(notes.slice(0, 20), "tr"),
		logs = [],
		scrolls = [];
	let html;
	const context = vm.createContext({
		update_notes: translated,
		update_notes_more: true,
		last_deploy: translated[0].deployed,
		no_html: false,
		add_log: (text, color) => logs.push({ text, color }),
		html_escape: require("../../js/phrases").escape,
		$: (selector) => ({
			html: (value) => {
				html = value;
			},
			scrollTop: (value) => scrolls.push({ selector, value }),
		}),
		position_modals: () => {},
	});
	vm.runInContext(read("js/phrases.js"), context);
	context.phrase.load("tr", localization.browser_catalog("tr"));
	for (const name of ["add_update_notes", "render_update_notes"])
		vm.runInContext(extract(read("js/functions.js"), name), context);
	context.add_update_notes();
	assert.ok(logs.some((entry) => entry.text === translated[0].text));
	assert.deepEqual(scrolls, [{ selector: "#gamelog", value: 0 }]);
	context.render_update_notes();
	assert.ok(html.includes(context.html_escape(translated[0].text)));
	assert.ok(html.includes("load_more_update_notes()"));
	context.update_notes = [{ note: "Holiday", text: "<b>Translated</b>", date: "<date>", deployed: null }];
	context.last_deploy = null;
	context.add_update_notes();
	assert.ok(logs.some((entry) => entry.text === "<b>Translated</b>" && entry.color === "#C82F17"));
	context.render_update_notes();
	assert.ok(html.includes("&lt;b&gt;Translated&lt;/b&gt;"));
	assert.ok(html.includes("&lt;date&gt;"));
});
