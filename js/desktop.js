// Optional desktop conveniences. A missing/old native bridge must leave the game playable.
var desktop = (function () {
	var images_promise, image_urls = Object.create(null), attached = false;
	var language_request = 0;

	function timeout(action, milliseconds, label) {
		return new Promise(function (resolve, reject) {
			var done = false;
			var timer = setTimeout(function () { finish(new Error(label + " timed out")); }, milliseconds);
			function finish(error, value) {
				if (done) return;
				done = true;
				clearTimeout(timer);
				if (error) reject(error);
				else resolve(value);
			}
			Promise.resolve().then(action).then(function (value) { finish(null, value); }, finish);
		});
	}

	function request(command, args, milliseconds) {
		return timeout(function () {
			if (!window.__TAURI__ || !window.__TAURI__.core) throw new Error("Desktop bridge unavailable");
			return window.__TAURI__.core.invoke(command, args || {});
		}, milliseconds, command);
	}

	function language(preferred) {
		var sequence = ++language_request;
		var system = phrase.detect(navigator.languages || [navigator.language]);
		return request("get_desktop_language", { systemLanguage: system, preferred: preferred || null }, 1500)
			.then(function (value) {
				if (!phrase.languages.some(function (entry) { return entry.code === value; })) throw new Error("Invalid desktop language");
				console.log("[Tauri Language] " + value + (preferred ? " (player preference)" : " (cached Steam/system choice)"));
				return sequence === language_request ? value : null;
			}).catch(function (error) {
				console.warn("[Tauri Language] Using the player/system language; native preference unavailable:", error.message || error);
				return sequence === language_request ? (preferred || system) : null;
			});
	}

	function images() {
		if (images_promise) return images_promise;
		images_promise = request("get_bundled_images", {}, 1000).then(function (data) {
			var bytes = new Uint8Array(data);
			if (bytes.byteLength < 4) throw new Error("Empty image bundle");
			var length = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
			if (length > 1024 * 1024 || length + 4 > bytes.length) throw new Error("Invalid image manifest");
			var manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(4, length + 4)));
			if (manifest.version !== 1 || !manifest.images) throw new Error("Unsupported image bundle");
			var body = bytes.subarray(length + 4);
			Object.keys(manifest.images).forEach(function (url) {
				var part = manifest.images[url];
				if (!/^\/images\/.+\.png(?:\?v=[\w.-]+)?$/.test(url) || !Array.isArray(part) || part.length !== 2 ||
					!Number.isSafeInteger(part[0]) || !Number.isSafeInteger(part[1]) || part[0] < 0 || part[1] < 8 || part[0] + part[1] > body.length)
					throw new Error("Invalid bundled image entry");
			});
			console.log("[Tauri Images] Bundle ready:", Object.keys(manifest.images).length, "images;", body.length, "bytes.");
			return { manifest: manifest.images, body: body, deadline: Date.now() + 2000 };
		}).catch(function (error) {
			console.warn("[Tauri Images] Using normal image URLs:", error.message || error);
			return null;
		});
		return images_promise;
	}

	function image_key(value) {
		try {
			var url = new URL(value, location.href);
			return url.origin === location.origin ? url.pathname + url.search : "";
		} catch (error) { return ""; }
	}

	function load_images(loader) {
		if (window.no_graphics || attached || !loader || typeof loader.pre !== "function") return;
		attached = true;
		var ready = images(), local = 0, remote = 0;
		loader.pre(function (resource, next) {
			var continued = false;
			function proceed() {
				if (continued) return;
				continued = true;
				next();
			}
			var key = image_key(resource.url);
			if (!key.startsWith("/images/")) return proceed();
			ready.then(function (cache) {
				var part = cache && cache.manifest[key];
				if (!part || Date.now() >= cache.deadline) { remote++; return proceed(); }
				var image, blob_url, finished = false;
				var timer = setTimeout(function () { finish(false); }, Math.min(500, cache.deadline - Date.now()));
				function finish(success) {
					if (finished) return;
					finished = true;
					clearTimeout(timer);
					if (image) image.onload = image.onerror = null;
					if (success) {
						image_urls[key] = blob_url;
						resource.data = image;
						resource.type = PIXI.loaders.Resource.TYPE.IMAGE;
						resource.complete();
						local++;
					} else {
						if (blob_url) URL.revokeObjectURL(blob_url);
						remote++;
					}
					// Keep resource.url/name unchanged: PIXI texture keys and CODE stay identical.
					proceed();
				}
				try {
					blob_url = URL.createObjectURL(new Blob([cache.body.subarray(part[0], part[0] + part[1])], { type: "image/png" }));
					image = new Image();
					image.onload = function () { finish(true); };
					image.onerror = function () { finish(false); };
					image.src = blob_url;
				} catch (error) { finish(false); }
			}).catch(function (error) {
				console.warn("[Tauri Images] Continuing normal loading:", error.message || error);
				proceed();
			});
		});
		if (loader.onComplete) loader.onComplete.once(function () {
			console.log("[Tauri Images] Loaded locally:", local, "; normal URLs:", remote);
		});
	}

	return {
		timeout: timeout,
		request: request,
		language: language,
		loadImages: load_images,
		imageUrl: function (url) { return image_urls[image_key(url)] || url; },
	};
})();
