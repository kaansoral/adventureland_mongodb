var fs = require("fs"),
	path = require("path");

function deployment_date(now) {
	var parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Istanbul",
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	}).formatToParts(now || new Date());
	var values = {};
	parts.forEach(function (part) {
		values[part.type] = part.value;
	});
	return "[" + values.day + "/" + values.month + "/" + values.year + "]";
}

function lock_update_notes(root, now) {
	var date = deployment_date(now),
		notes_path = path.join(root, "update_notes.js"),
		version_path = path.join(root, "version.js"),
		notes_source = fs.readFileSync(notes_path, "utf8"),
		version_source = fs.readFileSync(version_path, "utf8"),
		pending_pattern = /^(\s*)deployed:\s*null,/gm,
		pending = notes_source.match(pending_pattern) || [],
		locked_notes = notes_source.replace(pending_pattern, "$1deployed: " + JSON.stringify(date) + ","),
		locked_version = version_source.replace(/LastDeploy\s*=\s*"[^"]*";/, "LastDeploy = " + JSON.stringify(date) + ";");

	if (locked_version == version_source && version_source.indexOf("LastDeploy") == -1) throw new Error("LastDeploy is missing from version.js");
	fs.writeFileSync(notes_path, locked_notes);
	fs.writeFileSync(version_path, locked_version);
	return { date: date, notes: pending.length };
}

module.exports = lock_update_notes;
module.exports.deployment_date = deployment_date;
