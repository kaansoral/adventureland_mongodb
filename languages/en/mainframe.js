// Authored persisted Mainframe lifecycle messages; raw English event fields remain unchanged.
module.exports = {
	// Mainframe dashboard event history assignment_queued. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.assignment_queued": "Mainframe queued this character.",
	// Mainframe dashboard event history included_worker_queued. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.included_worker_queued": "Mainframe queued this included Worker.",
	// Mainframe dashboard event history shared_with. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.shared_with": "Shared with {character}",
	// Mainframe dashboard event history shared_with_root. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.shared_with_root": "Shared with the root character",
	// Mainframe dashboard event history explicit_disconnect. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.explicit_disconnect": "Disconnected by the account owner.",
	// Mainframe dashboard event history renewed_free. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.renewed_free": "1 free Mainframe hour used for {minutes} minutes.",
	// Mainframe dashboard event history renewed_shell. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.renewed_shell": "1 Shell charged for {minutes} minutes.",
	// Mainframe dashboard event history renewal_one. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.renewal_one": "{count} character active · Next renewal {date}",
	// Mainframe dashboard event history renewal_many. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.renewal_many": "{count} characters active · Next renewal {date}",
	// Mainframe dashboard event history renewal_failed. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.renewal_failed": "Mainframe stopped this character because no time remained.",
	// Mainframe dashboard event history worker_failure. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.worker_failure": "Mainframe detected a Worker failure and will retry it.",
	// Mainframe dashboard event history server_change. Keep Mainframe, CODE, character names, and numeric/date arguments unchanged.
	"mainframe.event.server_change": "Mainframe is reconnecting this character on another server.",
	// Mainframe lifecycle event severity label; internal level identifier stays unchanged.
	"mainframe.level.info": "INFO",
	// Mainframe lifecycle event severity label; internal level identifier stays unchanged.
	"mainframe.level.warn": "WARN",
	// Mainframe lifecycle event severity label; internal level identifier stays unchanged.
	"mainframe.level.error": "ERROR",
};
