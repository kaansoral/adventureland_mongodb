const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const express = require("express");
const { extract, read } = require("./helpers/server_vm");

const plain = (value) => JSON.parse(JSON.stringify(value));
const page_routes = ["/", "/hub", "/character/:name/in/:region/:sname", "/server/:region/:sname", "/shells"];

function request(host, region = "EU", name = "II") {
	return Object.assign(Object.create(express.request), {
		headers: { host, "x-forwarded-host": "cloudflare.adventure.land" },
		params: { name: "Hero", region, sname: name },
		query: {},
	});
}

function response() {
	return {
		infs: [],
		status() {
			return this;
		},
		set() {
			return this;
		},
		send(body) {
			this.body = body;
		},
	};
}

function runtime() {
	const records = [
		["EU", "I", "de.adventure.land", 1],
		["EU", "II", "de.adventure.land", 2],
		["EU", "PVP", "de.adventure.land", 3],
		["EU", "III", "de.adventure.land", 5],
		["EU", "IV", "de.adventure.land", 6],
		["US", "I", "na2.adventure.land", 1],
		["ASIA", "I", "sg.adventure.land", 1],
		["ASIA", "II", "sg.adventure.land", 2],
		["EU", "V", "external.example.test", 1],
	].map(([region, name, address, path]) =>
		Object.freeze({
			_id: "SR_" + region + name,
			key: region + name,
			region,
			name,
			address,
			path: "/ws" + path + "/",
			msgpack_path: "/ws" + path + "-msgpack/",
			info: Object.freeze({ pvp: name === "PVP" }),
		}),
	);
	const user = { characters: [{ id: "CH_Hero", name: "Hero", level: 40 }] };
	const routes = {};
	const context = vm.createContext({
		Dev: true,
		SEO_ORIGIN: "https://adventure.land",
		options: {
			servers: Object.fromEntries(
				records.map((server) => [
					server.key,
					{
						region: server.region,
						name: server.name,
						inactive: server.key === "EUIV" || server.key === "ASIAII",
						redirect: [server.region, "I"],
					},
				]),
			),
		},
		db: {
			collection(name) {
				assert.equal(name, "server");
				return {
					find() {
						return this;
					},
					limit() {
						return this;
					},
					toArray: async () => records.slice(),
				};
			},
		},
		post_process_query_results() {},
		get_id: (value) => value._id,
		gf: (value, key, fallback) => value?.[key] ?? fallback,
		get_user: async () => user,
		get_domain: async (req) => ({ base_url: "https://" + req.get("host") }),
		get_user_data: async () => ({}),
		get_characters: async () => [],
		characters_to_client: (characters) => characters,
		data_to_tutorial: () => ({}),
		simplify_name: (name) => name.toLowerCase(),
		extra_shells: {},
		nunjucks: { render: (template, data) => data },
		app: { get: (path, handler) => (routes[path] = handler) },
	});
	for (const [file, names] of [
		[
			"adventure_functions.js",
			[
				"get_servers",
				"redirect_inactive_server",
				"get_browser_servers",
				"select_server",
				"servers_to_client",
				"render_selection",
				"selection_info",
			],
		],
		["api.js", ["servers_and_characters_api", "get_servers_api", "can_reload_api"]],
		["mainframe.js", ["mainframe_resolve_server"]],
	]) {
		vm.runInContext(names.map((name) => extract(read(file), name)).join("\n"), context, { filename: file });
	}
	const source = read("main.js");
	for (const route of page_routes) {
		const start = source.indexOf('app.get("' + route + '",');
		assert.notEqual(start, -1);
		vm.runInContext(source.slice(start, source.indexOf("\n});", start) + 4), context);
	}
	return { context, routes, records, user };
}

test("Cloudflare routing preserves canonical records and isolates interleaved ordinary requests", async () => {
	const { context, records } = runtime();
	const canonical = plain(await context.get_servers());
	const expected = canonical
		.filter((server) => server.address === "de.adventure.land")
		.map((server) => ({ ...server, address: "cloudflare.adventure.land" }));
	const hosts = [
		"adventure.land",
		"cloudflare.adventure.land",
		"de.adventure.land",
		"CLOUDFLARE.ADVENTURE.LAND:443",
		"cloudflare.adventure.land.example.test",
		"adventure.test",
		"adventure.land",
	];
	const results = await Promise.all(hosts.map((host) => context.get_browser_servers(request(host))));
	for (let i = 0; i < hosts.length; i++) {
		assert.deepEqual(plain(results[i]), i === 1 || i === 3 ? expected : canonical, hosts[i]);
	}
	assert.deepEqual(plain(await context.get_servers()), canonical);
	assert.equal(records[0].address, "de.adventure.land");
});

test("page selection, direct links and API refreshes use the requesting hostname's server list", async () => {
	const { context, routes, user } = runtime();
	for (const host of ["adventure.land", "cloudflare.adventure.land", "adventure.land"]) {
		const req = request(host);
		const expected = await context.get_browser_servers(req);
		const client_servers = plain(context.servers_to_client({}, expected));
		for (const route of page_routes) {
			const res = response();
			await routes[route](req, res);
			assert.ok(expected.some((server) => server.key === res.body.server.key));
			assert.equal(res.body.server.address, expected[0].address);
			if (route === "/shells") continue;
			assert.deepEqual(plain(res.body.servers), plain(expected), route);
			assert.deepEqual(plain(res.body.domain.servers), client_servers, route);
			if (route === "/character/:name/in/:region/:sname") {
				assert.equal(res.body.domain.url_address, expected[0].address);
				assert.equal(res.body.domain.url_path, "/ws2/");
				assert.equal(res.body.domain.url_character, "CH_Hero");
			}
			if (route === "/server/:region/:sname") assert.equal(res.body.server.path, "/ws2/");
		}
		const selection = await context.selection_info(req, user, {});
		assert.deepEqual(plain(selection.html.servers), plain(expected));
		const res = response();
		await context.servers_and_characters_api({ req, res, user });
		assert.deepEqual(plain(res.infs[0].servers), client_servers);
		const listing = await context.get_servers_api({ req });
		assert.deepEqual(
			plain(listing.servers).map(({ region, name, address, path, msgpack_path }) => [
				region,
				name,
				address,
				path,
				msgpack_path,
			]),
			plain(expected).map(({ region, name, address, path, msgpack_path }) => [
				region,
				name,
				address,
				path,
				msgpack_path,
			]),
		);
	}
});

test("reconnects preserve EU socket paths and exclude external servers only on Cloudflare", async () => {
	const { context, user } = runtime();
	for (const host of ["adventure.land", "cloudflare.adventure.land", "adventure.land"]) {
		for (const [region, address] of [
			["EU", "de.adventure.land"],
			["US", "na2.adventure.land"],
			["ASIA", "sg.adventure.land"],
		]) {
			const res = response();
			const result = await context.can_reload_api({ req: request(host), res, user, region, name: "I" });
			const cloudflare = host === "cloudflare.adventure.land";
			const allowed = !cloudflare || region === "EU";
			assert.equal(result.reload, allowed);
			assert.deepEqual(
				plain(res.infs),
				allowed ? [{ type: "reload", address: cloudflare ? host : address, path: "/ws1/" }] : [],
			);
		}
	}
});

test("Cloudflare character links redirect unavailable servers to root, including trailing-slash URLs", async () => {
	const { routes } = runtime();
	const router = express.Router();
	router.get("/character/:name/in/:region/:sname", routes["/character/:name/in/:region/:sname"]);
	for (const host of [
		"cloudflare.adventure.land",
		"CLOUDFLARE.ADVENTURE.LAND:443",
		"adventure.land",
		"de.adventure.land",
	]) {
		for (const [region, name] of [
			["US", "I"],
			["ASIA", "I"],
			["EU", "V"],
			["EU", "II"],
		]) {
			for (const ending of ["", "/"]) {
				const req = Object.assign(request(host), {
					method: "GET",
					url: "/character/Hero/in/" + region + "/" + name + ending,
				});
				const result = await new Promise((resolve, reject) => {
					const res = Object.assign(response(), {
						send: (body) => resolve({ body }),
						redirect: (url) => resolve({ redirect: url }),
					});
					router.handle(req, res, (error) => reject(error || new Error("Character route did not match")));
				});
				if (host.toLowerCase().startsWith("cloudflare.") && !(region === "EU" && name === "II")) {
					assert.equal(result.redirect, "/");
				} else {
					assert.equal(result.redirect, undefined);
					assert.equal(result.body.domain.url_path, name === "II" ? "/ws2/" : "/ws1/");
				}
			}
		}
	}
});

test("retired servers are absent from discovery, refreshes and reconnect requests despite stale online records", async () => {
	const { context, user } = runtime();
	for (const [region, name] of [
		["EU", "IV"],
		["ASIA", "II"],
	]) {
		assert.equal(await context.mainframe_resolve_server(region + " " + name), null);
		assert.equal(await context.mainframe_resolve_server("SR_" + region + name), null);
		for (const host of ["adventure.land", "cloudflare.adventure.land", "adventure.test"]) {
			const req = request(host, region, name);
			const servers = await context.get_browser_servers(req);
			assert.ok(!servers.some((s) => s.region === region && s.name === name));
			const listing = await context.get_servers_api({ req });
			assert.ok(!listing.servers.some((s) => s.region === region && s.name === name));
			const res = response();
			assert.equal((await context.can_reload_api({ req, res, user, region, name })).reload, false);
			assert.deepEqual(res.infs, []);
		}
	}
	assert.equal((await context.mainframe_resolve_server("EU I")).key, "SR_EUI");
});

test("retired character and server links bypass selection, preserving names and query strings", async () => {
	const { context, routes } = runtime();
	context.get_user = context.get_servers = async () => assert.fail("redirect must not access the database");
	const router = express.Router();
	for (const path of ["/character/:name/in/:region/:sname", "/server/:region/:sname"]) router.get(path, routes[path]);
	for (const [region, name] of [
		["EU", "IV"],
		["ASIA", "II"],
	]) {
		for (const host of ["adventure.test", "adventure.land", "cloudflare.adventure.land"]) {
			for (const prefix of ["/character/Wizard/in/", "/character/Hero%20Name/in/", "/server/"]) {
				for (const ending of ["", "/", "/?code=2&no_html=1", "?code=a%26b&no_graphics=1"]) {
					const req = Object.assign(request(host), { method: "GET", url: prefix + region + "/" + name + ending });
					const url = await new Promise((resolve, reject) => {
						router.handle(req, { redirect: resolve }, (error) => reject(error || new Error("Route did not match")));
					});
					const query = ending.includes("?") ? ending.slice(ending.indexOf("?")) : "";
					assert.equal(url, prefix + region + "/I/" + query);
				}
			}
		}
	}
});

test("missing, invalid and inactive redirect destinations cannot cause redirect loops", () => {
	const { context } = runtime();
	const definition = context.options.servers.EUIV;
	for (const redirect of [undefined, "EU/I", ["EU", "missing"], ["EU", "IV"], ["ASIA", "II"]]) {
		definition.redirect = redirect;
		let destination;
		assert.equal(
			context.redirect_inactive_server(request("adventure.land", "EU", "IV"), {
				redirect: (url) => (destination = url),
			}),
			true,
		);
		assert.equal(destination, "/");
	}
});
