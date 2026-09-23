module.exports = {
	// Browser/Tauri deep link could not connect; the following line explains its timed retry.
	"page.connection.not_connected": "If the character doesn't connect",
	// Browser/Tauri automatic connection retry; {seconds} is the existing retry delay.
	"page.connection.retry": "Reloading the page to retry in {seconds} seconds",
	// No server matched the incoming character link.
	"page.connection.server_missing": "Server not found",
	// The player is leaving soon after a PvP attack; existing game rules determine the penalty.
	"page.pvp.leave_warning": "You attacked another player within the last 3.6 seconds. Leaving now will defeat your character.",
	// beforeunload confirmation; the browser may substitute its own localized warning.
	"page.leave_confirm": "Are you sure?",
	// Account navigation is returning to the main menu.
	"page.signing_out": "Signing Out",
	// Existing tutorial-reset confirmation dialog.
	"page.tutorial.reset_confirm": "Reset the tutorial?",
	// Playful yes button in the existing tutorial-reset dialog.
	"page.tutorial.reset_yes": "Yes!",
	// Playful cancel button in the existing tutorial-reset dialog.
	"page.tutorial.reset_no": "Oh No!",
	// The CODE example iframe is starting its existing execution.
	"page.code.executing": "Executing ...",
	// A CODE example completed its initial execution.
	"page.code.executed": "Test Executed!",
	// The player's CODE iframe has started. CODE is an unchanged product term.
	"page.code.active": "Code Active",
	// Heading in the existing CODE exception log; the actual JavaScript error stays unchanged.
	"page.code.error": "CODE Error Caught",
	// Heading in the example-execution exception modal.
	"page.code.example_error": "Execute! Error Caught",
	// Source location in a CODE exception; {line} and {column} are numbers.
	"page.code.error_location": "Line: {line} · Column: {column}",
	// Source location when the browser does not provide a column.
	"page.code.error_line": "Line: {line}",
	// Steam checkout confirmation window; {shells} is the locale-formatted credited currency amount.
	"page.purchase.complete": "Purchase complete. {shells} Shells were added to your account.",
	// The completed Steam checkout window can be closed.
	"page.purchase.close": "You can close this window and return to Adventure Land.",
	// Failed Steam checkout status; keep Steam unchanged.
	"page.purchase.failed": "Steam couldn't complete this purchase.",
	// Failed Steam checkout followup.
	"page.purchase.retry": "Return to Adventure Land to try again.",
	// Pending Steam purchase settlement.
	"page.purchase.pending": "Steam is finishing the purchase and adding your Shells ...",
	// Invalid Steam checkout link, including an invalid or expired receipt.
	"page.purchase.invalid_link": "This purchase link is invalid.",
	// Followup after an invalid checkout link; avoids claiming whether the purchase succeeded.
	"page.purchase.check_balance": "Return to Adventure Land to check your Shells balance.",
};
