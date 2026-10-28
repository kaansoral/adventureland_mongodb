// Change seasonal switches here, then deploy and restart the game servers.
// Definitions, map geometry and navigation must be rebuilt with the same flags.
var event_flags = {
	anniversary: false,
	holidayseason: false,
	lunarnewyear: false,
	valentines: false,
	egghunt: false,
	halloween: true,
};

// A season with an end time (UTC) switches itself off then. Running game servers stop its
// drops, rounds and respawn changes at that moment; anything started later loads it off.
// The Events window shows the last day.
var event_ends = {
	halloween: "2026-11-03T00:00:00.000Z", // last day: November 2
};

// Preserve the game modes: Hardcore includes the Egg Hunt; Dungeon disables all seasons.
var event_flag_overrides = { hardcore: { egghunt: true }, dungeon: false };

function get_event_flags(gameplay, now) {
	var flags = Object.assign({}, event_flags, event_flag_overrides[gameplay]);
	if (now === undefined) now = Date.now();
	for (var name in flags) {
		if (typeof flags[name] !== "boolean") throw new Error("Event flag must be boolean: " + name);
		if (event_flag_overrides[gameplay] === false) flags[name] = false;
		if (flags[name] && event_ends[name] && now >= Date.parse(event_ends[name])) flags[name] = false;
	}
	return flags;
}
