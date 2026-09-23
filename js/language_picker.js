function language_cookie(language, source) {
	var settings = "; Path=/; Max-Age=157680000; SameSite=Lax" + (location.protocol == "https:" ? "; Secure" : "");
	document.cookie = "language=" + encodeURIComponent(language) + settings;
	document.cookie = "language_source=" + (source || "explicit") + settings;
}

function choose_language(language, button) {
	if (
		!phrase.languages.some(function (entry) {
			return entry.code == language;
		})
	)
		return;
	if (button && button.disabled) return;
	if (button) button.disabled = true;
	function reload() {
		language_cookie(language, language_account ? "account" : "explicit");
		if (window.desktop) desktop.language(language).then(function () { location.reload(); });
		else location.reload();
	}
	if (!language_account) return reload();
	api_call("settings", { setting: "language", value: language })
		.then(reload)
		.catch(function () {
			if (button) button.disabled = false;
			ui_error(phrase("language.save_failed"));
		});
}

function initialize_desktop_language() {
	var preferred = (language_account && language_initialized) || language_source === "account" || language_source === "cookie" ? phrase.language : null;
	desktop.language(preferred).then(function (language) {
		if (!language || preferred || language_account) return;
		language_cookie(language, "detected");
		// Only the signed-out page may switch automatically, once per session.
		// Never reload an active character because Steam picked another language.
		if (language === phrase.language) return;
		try {
			if (sessionStorage.getItem("desktop_language_applied")) return;
			sessionStorage.setItem("desktop_language_applied", "1");
			location.reload();
		} catch (error) {} // Storage restrictions must not cause a reload loop.
	});
}

function language_icon(language) {
	return "<span class='language-icon' aria-hidden='true' style='--language-icon:" + language.icon + "'></span>";
}

function show_languages() {
	var html = "<div class='language-picker'><div class='mb5'>" + phrase.html("language.choose") + "</div>";
	var languages = phrase.languages.slice().sort(function (a, b) {
		return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
	});
	languages.forEach(function (language) {
		html +=
			"<button type='button' class='gamebutton language-choice' lang='" +
			language.code +
			"' aria-pressed='" +
			(language.code == phrase.language) +
			"' aria-label='" +
			phrase.escape(phrase("language.select", { language: language.name })) +
			"' onclick='choose_language(\"" +
			language.code +
			"\",this)'>" +
			language_icon(language) +
			"<span>" +
			phrase.escape(language.name) +
			"</span></button>";
	});
	show_modal(html + "</div>", { wwidth: Math.min(960, window.innerWidth - 52) });
}
