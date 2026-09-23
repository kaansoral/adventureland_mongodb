(function (root, factory) {
	var phrases = factory();
	if (typeof module == "object" && module.exports) module.exports = phrases;
	else root.phrase = phrases;
	if (typeof window != "undefined") root.phrase = phrases;
})(typeof globalThis != "undefined" ? globalThis : this, function () {
	var languages = [
		["en", "English"],
		["tr", "Türkçe"],
		["ru", "Русский"],
		["es", "Español (España)"],
		["pt-BR", "Português (Brasil)"],
		["de", "Deutsch"],
		["ja", "日本語"],
		["fr", "Français"],
		["pl", "Polski"],
		["ko", "한국어"],
		["zh-Hans", "简体中文"],
		["zh-Hant", "繁體中文"],
		["th", "ไทย"],
		["es-419", "Español (Latinoamérica)"],
		["uk", "Українська"],
		["it", "Italiano"],
		["cs", "Čeština"],
		["hu", "Magyar"],
		["pt-PT", "Português (Portugal)"],
		["vi", "Tiếng Việt"],
		["sv", "Svenska"],
		["nl", "Nederlands"],
		["da", "Dansk"],
		["id", "Bahasa Indonesia"],
		["fi", "Suomi"],
		["no", "Norsk"],
		["ro", "Română"],
		["el", "Ελληνικά"],
		["bg", "Български"],
		["ms", "Bahasa Melayu"],
		["ar", "العربية"],
		["fil", "Filipino"],
	].map(function (entry, index) {
		return { code: entry[0], name: entry[1], icon: index };
	});

	function normalize(value) {
		if (typeof value != "string") return null;
		value = value.trim().replace(/_/g, "-").toLowerCase();
		var exact = languages.find(function (language) {
			return language.code.toLowerCase() == value;
		});
		if (exact) return exact.code;
		if (/^zh(?:-|$)/.test(value)) return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(value) ? "zh-Hant" : "zh-Hans";
		if (/^es(?:-|$)/.test(value)) return /^(es|es-es)$/.test(value) ? "es" : "es-419";
		if (/^pt(?:-|$)/.test(value)) return /^pt-br(?:-|$)/.test(value) ? "pt-BR" : "pt-PT";
		if (/^(nb|nn|no)(?:-|$)/.test(value)) return "no";
		if (/^(tl|fil)(?:-|$)/.test(value)) return "fil";
		var base = value.split("-")[0];
		return languages.some(function (language) {
			return language.code == base;
		})
			? base
			: null;
	}

	function detect(values) {
		if (typeof values == "string")
			values = values
				.split(",")
				.map(function (value, index) {
					var parts = value.trim().split(";"),
						quality = parts.length > 1 ? Number(parts[1].trim().replace(/^q=/, "")) : 1;
					return { value: parts[0], quality: quality, index: index };
				})
				.filter(function (entry) {
					return entry.quality > 0;
				})
				.sort(function (a, b) {
					return b.quality - a.quality || a.index - b.index;
				})
				.map(function (entry) {
					return entry.value;
				});
		for (var value of values || []) {
			var language = normalize(value);
			if (language) return language;
		}
		return "en";
	}

	function escape(value) {
		return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
		});
	}

	function create(language, dictionary) {
		language = normalize(language) || "en";
		dictionary = dictionary || {};
		var plurals = typeof Intl != "undefined" && Intl.PluralRules ? new Intl.PluralRules(language) : null;
		function translate(id, parameters, html, depth) {
			parameters = parameters || {};
			var key = id;
			if (typeof parameters.count == "number" && plurals) {
				var plural = id + "." + plurals.select(parameters.count);
				if (Object.prototype.hasOwnProperty.call(dictionary, plural)) key = plural;
			}
			var text = Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : id;
			return String(text).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (match, name) {
				if (!Object.prototype.hasOwnProperty.call(parameters, name)) return match;
				var value = parameters[name];
				// Explicit nested phrase references let one server message name a localized condition.
				if (value && typeof value == "object" && typeof value.phrase == "string") {
					value = (depth || 0) < 4 ? translate(value.phrase, value.phrase_args, false, (depth || 0) + 1) : "";
				}
				return html ? escape(value) : String(value == null ? "" : value);
			});
		}
		translate.html = function (id, parameters) {
			return translate(id, parameters, true);
		};
		translate.has = function (id) {
			return Object.prototype.hasOwnProperty.call(dictionary, id);
		};
		translate.language = language;
		return translate;
	}

	var current = create("en", {});
	function phrase(id, parameters) {
		return current(id, parameters);
	}
	phrase.load = function (language, dictionary) {
		current = create(language, dictionary);
		phrase.language = current.language;
	};
	phrase.html = function (id, parameters) {
		return current.html(id, parameters);
	};
	phrase.has = function (id) {
		return current.has(id);
	};
	phrase.definition = function (section, id, field, fallback, parameters) {
		var key = section + "." + id + "." + field;
		if (current.has(key)) return current(key, parameters);
		if (Array.isArray(fallback))
			return fallback.map(function (value, index) {
				return phrase.definition(section, id, field + "." + index, value, parameters);
			});
		if (fallback && typeof fallback == "object") {
			var result = {};
			Object.keys(fallback).forEach(function (name) {
				result[name] = phrase.definition(section, id, field + "." + name, fallback[name], parameters);
			});
			return result;
		}
		return fallback;
	};
	phrase.message = function (data, html) {
		if (!data || typeof data != "object") return data;
		if (!data.phrase) return data.message;
		return html ? current.html(data.phrase, data.phrase_args) : current(data.phrase, data.phrase_args);
	};
	phrase.error = function (reason) {
		var wait = /^wait_(\d{1,6})_minutes$/.exec(String(reason || ""));
		if (wait) return current.html("error.wait_minutes", { minutes: wait[1] });
		if (reason === "operation_failed") reason = "failed";
		if (reason === "something_went_wrong") reason = "unexpected";
		if (reason === "invalid") reason = "invalid_field";
		var id = "error." + reason;
		return current.has(id) ? current.html(id) : current.html("error.unexpected");
	};
	phrase.escape = escape;
	phrase.create = create;
	phrase.languages = languages;
	phrase.normalize = normalize;
	phrase.detect = detect;
	phrase.language = "en";
	return phrase;
});
