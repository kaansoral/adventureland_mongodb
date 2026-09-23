var pixel_fonts = (function () {
	var requests = new Map(),
		ranges = new WeakMap();

	function family() {
		var lang = document.documentElement.lang.toLowerCase();
		if (/^ja(?:-|$)/.test(lang)) return "pixel-jp";
		if (/^zh-(?:hant|tw|hk|mo)(?:-|$)/.test(lang)) return "pixel-tc";
		return "pixel";
	}

	function ready(text, font) {
		if (window.no_graphics || !document.fonts) return true;
		font = font || family();
		// PIXI measures a Latin probe even when the displayed text uses another script.
		text = "A" + String(text == null ? "" : text);
		if (document.fonts.check("16px " + font, text)) return true;
		var points = Array.from(text, function (character) {
				return character.codePointAt(0);
			}),
			waiting = false;
		document.fonts.forEach(function (face) {
			if (face.family.replace(/["']/g, "").toLowerCase() != font || face.status == "loaded" || face.status == "error") return;
			if (!ranges.has(face))
				ranges.set(
					face,
					face.unicodeRange.split(",").map(function (range) {
						var ends = range.trim().slice(2).split("-");
						return [parseInt(ends[0].replace(/\?/g, "0"), 16), parseInt((ends[1] || ends[0]).replace(/\?/g, "F"), 16)];
					}),
				);
			if (
				ranges.get(face).some(function (range) {
					return points.some(function (point) {
						return point >= range[0] && point <= range[1];
					});
				})
			)
				waiting = true;
		});
		// A failed subset uses the browser fallback without blocking the game or retrying every frame.
		return !waiting;
	}

	function load(text, font) {
		font = font || family();
		text = "A" + String(text == null ? "" : text);
		if (ready(text, font)) return Promise.resolve();
		var key = font + "\n" + text;
		if (!requests.has(key))
			requests.set(
				key,
				document.fonts
					.load("16px " + font, text)
					.catch(function () {
						return document.fonts.ready;
					})
					.then(function () {
						requests.delete(key);
						if (window.no_graphics) return;
						if (window.PIXI && PIXI.TextMetrics && PIXI.TextMetrics.clearMetrics) PIXI.TextMetrics.clearMetrics();
						window.force_draw_on = new Date(Date.now() + 1000);
					}),
			);
		return requests.get(key);
	}

	function defer(text, callback) {
		if (ready(text)) return false;
		var current = window.map;
		load(text).then(function () {
			if (!window.no_graphics && window.map === current) callback();
		});
		return true;
	}

	function install() {
		if (window.no_graphics || !window.PIXI || !PIXI.Text || !PIXI.Text.prototype.updateText || PIXI.Text.prototype.pixel_fonts) return;
		var update = PIXI.Text.prototype.updateText;
		PIXI.Text.prototype.pixel_fonts = true;
		PIXI.Text.prototype.updateText = function (respectDirty) {
			if (window.no_graphics || this._destroyed) return;
			var style = this._style || this.style,
				font = String(style.fontFamily).replace(/["']/g, "").toLowerCase();
			if (font == "pixel" || this._pixel_family === font) {
				font = family();
				if (String(style.fontFamily).toLowerCase() != font) style.fontFamily = font;
				this._pixel_family = font;
			}
			var key = font + "\n" + this._text;
			if (/^pixel(?:-jp|-tc)?$/.test(font) && this._pixel_ready !== key && !ready(this._text, font)) {
				var text = this,
					pending = load(this._text, font);
				this.dirty = true;
				if (this._pixel_pending !== pending) {
					this._pixel_pending = pending;
					pending.then(function () {
						if (window.no_graphics || text._destroyed || !text.context || text._pixel_pending !== pending) return;
						text._pixel_pending = null;
						text.dirty = true;
						text.updateText(false);
					});
				}
				return;
			}
			this._pixel_ready = key;
			return update.call(this, respectDirty);
		};
	}

	install();
	return { family: family, ready: ready, load: load, defer: defer };
})();
