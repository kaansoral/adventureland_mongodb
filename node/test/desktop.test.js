const assert = require("node:assert/strict");
const fs = require("node:fs"),
	path = require("node:path"),
	vm = require("node:vm");
const test = require("node:test");
const { build_images } = require("../../scripts/build_desktop_images");
const phrase = require("../../js/phrases");
const root = fs.realpathSync(path.join(__dirname, "../.."));
const bundle = build_images(root);
const header_length = bundle.readUInt32LE(0);
const manifest = JSON.parse(bundle.subarray(4, 4 + header_length));
const body = bundle.subarray(4 + header_length);
const image_url = Object.keys(manifest.images).find((url) => url.includes("?v="));

function runtime(invoke, image_mode = "success") {
	const log = [],
		blobs = new Map(),
		revoked = [];
	class ImageURL extends URL {}
	ImageURL.createObjectURL = (blob) => {
		const url = "blob:https://adventure.land/" + blobs.size;
		blobs.set(url, blob);
		return url;
	};
	ImageURL.revokeObjectURL = (url) => revoked.push(url);
	class TestImage {
		set src(value) {
			this.source = value;
			if (image_mode === "hang") return;
			setTimeout(() => {
				const callback = image_mode === "error" ? this.onerror : this.onload;
				if (callback) callback();
			}, 0);
		}
	}
	const context = vm.createContext({
		console: { log: (...args) => log.push(args), warn: (...args) => log.push(args) },
		setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 30)),
		clearTimeout,
		URL: ImageURL,
		Image: TestImage,
		Blob,
		TextDecoder,
		Uint8Array,
		DataView,
		ArrayBuffer,
		location: {
			href: "https://adventure.land/",
			origin: "https://adventure.land",
			protocol: "https:",
			reload() {
				context.reloads++;
			},
		},
		navigator: { languages: ["tr-TR"] },
		phrase,
		reloads: 0,
		__TAURI__: { core: { invoke } },
		PIXI: { loaders: { Resource: { TYPE: { IMAGE: 3 } } } },
	});
	context.window = context;
	vm.runInContext(fs.readFileSync(path.join(root, "js/desktop.js"), "utf8"), context);
	return { context, desktop: context.desktop, log, blobs, revoked };
}

function loader_for(desktop) {
	let middleware;
	const loader = {
		pre: (fn) => {
			middleware = fn;
		},
		onComplete: { once() {} },
	};
	desktop.loadImages(loader);
	return (url) =>
		new Promise((resolve) => {
			let completions = 0,
				next_calls = 0;
			const resource = {
				url,
				name: url,
				complete() {
					completions++;
				},
			};
			middleware(resource, () => {
				next_calls++;
				resolve({ resource, completions, next_calls });
			});
		});
}

test("image bundle is deterministic, contains only referenced PNGs, and preserves exact version URLs", () => {
	assert.deepEqual(build_images(root), bundle);
	assert.equal(manifest.version, 1);
	assert.ok(Object.keys(manifest.images).length > 200);
	for (const [url, [offset, length]] of Object.entries(manifest.images)) {
		assert.match(url, /^\/images\/.+\.png(?:\?v=[\w.-]+)?$/);
		assert.deepEqual(body.subarray(offset, offset + length), fs.readFileSync(path.join(root, url.split("?")[0])));
	}
	assert.ok(!Object.keys(manifest.images).some((url) => /languages|phrases|secret|TOIMPORT/.test(url)));
});

test("PIXI gets local bytes under its original texture key; new versions and foreign origins use the network", async () => {
	let calls = 0;
	const { desktop, blobs } = runtime(() => {
		calls++;
		return Promise.resolve(bundle);
	});
	const load = loader_for(desktop);
	const local = await load(image_url);
	assert.equal(local.resource.url, image_url);
	assert.equal(local.resource.name, image_url);
	assert.equal(local.completions, 1);
	assert.equal(local.next_calls, 1);
	assert.equal(local.resource.type, 3);
	const blob_url = desktop.imageUrl(image_url);
	assert.ok(blob_url.startsWith("blob:"));
	const [offset, length] = manifest.images[image_url];
	assert.deepEqual(Buffer.from(await blobs.get(blob_url).arrayBuffer()), body.subarray(offset, offset + length));
	for (const url of [
		image_url + "-new",
		image_url.split("?")[0],
		"/images/new.png?v=1",
		"https://example.org" + image_url,
	]) {
		assert.equal((await load(url)).completions, 0);
		assert.equal(desktop.imageUrl(url), url);
	}
	assert.equal(calls, 1);
});

test("unsupported, corrupt, rejected and stalled cache reads all fall back without retrying", async () => {
	for (const invoke of [
		() => Promise.reject(new Error("Command not found")),
		() => new Promise(() => {}),
		() => {
			throw new Error("Bridge failed");
		},
		() => Buffer.from("broken"),
	]) {
		let calls = 0;
		const { desktop } = runtime(() => {
			calls++;
			return invoke();
		});
		const load = loader_for(desktop);
		for (let i = 0; i < 2; i++) {
			const result = await load(image_url);
			assert.equal(result.completions, 0);
			assert.equal(result.next_calls, 1);
		}
		assert.equal(calls, 1);
	}
});

test("failed or stalled PNG decode releases its blob and continues the original resource", async () => {
	for (const mode of ["error", "hang"]) {
		const { desktop, revoked } = runtime(() => bundle, mode);
		const result = await loader_for(desktop)(image_url);
		assert.equal(result.completions, 0);
		assert.equal(result.next_calls, 1);
		assert.equal(result.resource.url, image_url);
		assert.equal(revoked.length, 1);
		assert.equal(desktop.imageUrl(image_url), image_url);
	}
});

test("headless mode never touches PIXI or starts a cache read", () => {
	const { desktop, context } = runtime(() => assert.fail("Headless cache request"));
	context.no_graphics = true;
	Object.defineProperty(context, "PIXI", {
		get() {
			assert.fail("Headless PIXI access");
		},
	});
	desktop.loadImages(
		new Proxy(
			{},
			{
				get() {
					assert.fail("Headless loader access");
				},
			},
		),
	);
});

test("language uses system fallback input and ignores a late result after a player choice", async () => {
	let initial;
	const { desktop } = runtime((command, args) => {
		assert.equal(command, "get_desktop_language");
		assert.equal(args.systemLanguage, "tr");
		if (args.preferred) return args.preferred;
		return new Promise((resolve) => {
			initial = resolve;
		});
	});
	const pending = desktop.language();
	await Promise.resolve();
	assert.equal(await desktop.language("ja"), "ja");
	initial("de");
	assert.equal(await pending, null);
});

test("language failures do not block the page or create retries", async () => {
	for (const invoke of [() => new Promise(() => {}), () => "../../en", () => Promise.reject("Steam unavailable")]) {
		assert.equal(await runtime(invoke).desktop.language(), "tr");
	}
});

test("account and explicit choices sync to native; only a guest can auto-reload, once", async () => {
	for (const [account, initialized, source, expected] of [
		[true, true, "account", "en"],
		[false, true, "account", "en"],
		[false, true, "cookie", "en"],
		[false, false, "browser", null],
	]) {
		const { context } = runtime((command, args) => {
			assert.equal(args.preferred, expected);
			return args.preferred || "de";
		});
		context.language_account = account;
		context.language_initialized = initialized;
		context.language_source = source;
		const values = new Map();
		context.sessionStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
		context.document = { cookie: "" };
		vm.runInContext(fs.readFileSync(path.join(root, "js/language_picker.js"), "utf8"), context);
		context.initialize_desktop_language();
		await new Promise((resolve) => setTimeout(resolve, 5));
		assert.equal(context.reloads, expected ? 0 : 1);
		context.initialize_desktop_language();
		await new Promise((resolve) => setTimeout(resolve, 5));
		assert.equal(context.reloads, expected ? 0 : 1);
	}
});

test("all real desktop catalogs are shipped, separately from the image cache", () => {
	const locales = JSON.parse(fs.readFileSync(path.join(root, "tauri/resources/desktop-languages.json")));
	assert.deepEqual(
		locales.map((entry) => entry.code),
		phrase.languages.map((entry) => entry.code),
	);
	assert.equal(locales.find((entry) => entry.code === "fil").steam, null);
	for (const { code } of locales) {
		let entries;
		vm.runInNewContext(fs.readFileSync(path.join(root, "tauri/resources/languages", code + ".js"), "utf8"), {
			phrase: {
				load(language, values) {
					assert.equal(language, code);
					entries = values;
				},
			},
		});
		assert.ok(entries["desktop.loading"]);
		assert.equal(
			entries["desktop.close_confirmation"],
			locales.find((entry) => entry.code === code).close_confirmation,
		);
		assert.ok(Object.keys(entries).every((key) => key.startsWith("desktop.")));
	}
});

test("disconnect polling times out without overlapping requests or restarting after a late response", async () => {
	const { context } = runtime(() => {});
	let calls = 0,
		respond;
	context.api_call = () => {
		calls++;
		return new Promise((resolve) => {
			respond = resolve;
		});
	};
	context.X = { characters: [{ name: "Fixture", online: true }] };
	vm.runInContext(fs.readFileSync(path.join(root, "js/tauri_functions.js"), "utf8"), context);
	await assert.rejects(context.tauri_wait_for_character_disconnect("Fixture", 25), /character_disconnect_timeout/);
	assert.equal(calls, 1);
	respond();
	await new Promise((resolve) => setTimeout(resolve, 70));
	assert.equal(calls, 1);
});
