var fs = require("fs"),
	path = require("path"),
	update_notes = require(path.resolve(__dirname, "update_notes.js"));

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

// Stamps every note and release that has `deployed: null`, however it is formatted, and records the deploy in version.js.
function lock_update_notes(root, now) {
	var date = deployment_date(now),
		notes_path = path.join(root, "update_notes.js"),
		version_path = path.join(root, "version.js"),
		notes_source = fs.readFileSync(notes_path, "utf8"),
		version_source = fs.readFileSync(version_path, "utf8"),
		before = update_notes.load_notes(notes_source),
		stamped = update_notes.stamp(notes_source, date),
		after = update_notes.load_notes(stamped.source),
		locked_version = version_source.replace(/LastDeploy\s*=\s*"[^"]*";/, "LastDeploy = " + JSON.stringify(date) + ";");

	if (locked_version == version_source && version_source.indexOf("LastDeploy") == -1) throw new Error("LastDeploy is missing from version.js");
	var pending = before.filter(function (note) {
		return note && note.deployed === null;
	}).length;
	if (
		after.length != before.length ||
		stamped.count != pending ||
		after.some(function (note) {
			return note && note.deployed === null;
		})
	)
		throw new Error("Could not stamp every pending update note (" + stamped.count + " of " + pending + ")");
	fs.writeFileSync(notes_path, stamped.source);
	fs.writeFileSync(version_path, locked_version);
	return { date: date, notes: stamped.count };
}

module.exports = lock_update_notes;
module.exports.deployment_date = deployment_date;
