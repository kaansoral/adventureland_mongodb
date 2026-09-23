// Historical prose can use English fallback while the current game is translated.
// Keep these boundaries fixed: new release notes and all live documentation are required.
function deferred(id) {
	if (id.startsWith("pages.logs.") && id !== "pages.logs.development" && id !== "pages.logs.blog") return "development_archive";
	var date = id.match(/^update\.(?:\d{2}_\d{2}_(\d{2})|(\d{4}))\./);
	if (date && (date[1] ? 2000 + Number(date[1]) : Number(date[2])) < 2026) return "old_update_notes";
	return null;
}

module.exports = { deferred: deferred };
