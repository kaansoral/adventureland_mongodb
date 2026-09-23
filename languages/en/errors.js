// Human-readable API errors. The original reason codes remain unchanged in CODE.
module.exports = {
	// Account/API error unexpected; shown after a failed manual action, never used as a protocol value.
	"error.unexpected": "Something went wrong. Please try again.",
	// Account/API error invalid_call; shown after a failed manual action, never used as a protocol value.
	"error.invalid_call": "This request could not be understood.",
	// Account/API error invalid_field; shown after a failed manual action, never used as a protocol value.
	"error.invalid_field": "Check the details you entered.",
	// Account/API error missing_field; shown after a failed manual action, never used as a protocol value.
	"error.missing_field": "Fill in all required fields.",
	// Account/API error invalid_method; shown after a failed manual action, never used as a protocol value.
	"error.invalid_method": "This action is not available.",
	// Account/API error not_logged_in; shown after a failed manual action, never used as a protocol value.
	"error.not_logged_in": "Log in again to continue.",
	// Account/API error exception; shown after a failed manual action, never used as a protocol value.
	"error.exception": "Something went wrong. Please try again.",
	// Account/API error failed; shown after a failed manual action, never used as a protocol value.
	"error.failed": "The action could not be completed.",
	// Account/API error network_error; shown after a failed manual action, never used as a protocol value.
	"error.network_error": "Couldn't reach the server. Please try again.",
	// Account/API error timeout; shown after a failed manual action, never used as a protocol value.
	"error.timeout": "The request timed out. Please try again.",
	// Account/API error empty_response; shown after a failed manual action, never used as a protocol value.
	"error.empty_response": "The server did not return a response. Please try again.",
	// Account/API error cant_login_inside_bank; shown after a failed manual action, never used as a protocol value.
	"error.cant_login_inside_bank": "Leave the bank before logging in again.",
	// Account/API error cant_make_changes_while_in_bank; shown after a failed manual action, never used as a protocol value.
	"error.cant_make_changes_while_in_bank": "Leave the bank before changing your account.",
	// Account/API error inthebank; shown after a failed manual action, never used as a protocol value.
	"error.inthebank": "Leave the bank first.",
	// Account/API error cant_signup_on_web; shown after a failed manual action, never used as a protocol value.
	"error.cant_signup_on_web": "Create your account in your purchased copy of Adventure Land.",
	// Account/API error wrong_password; shown after a failed manual action, never used as a protocol value.
	"error.wrong_password": "The password is incorrect.",
	// Account/API error no_email; shown after a failed manual action, never used as a protocol value.
	"error.no_email": "Enter your email address.",
	// Account/API error email_not_found; shown after a failed manual action, never used as a protocol value.
	"error.email_not_found": "No account uses this email address.",
	// Account/API error already_signed_up; shown after a failed manual action, never used as a protocol value.
	"error.already_signed_up": "This email already has an account. Log in instead.",
	// Account/API error too_many_signups_from_ip_wait; shown after a failed manual action, never used as a protocol value.
	"error.too_many_signups_from_ip_wait": "Too many accounts were created from this connection. Please try again later.",
	// Account/API error email_exists; shown after a failed manual action, never used as a protocol value.
	"error.email_exists": "This email already has an account.",
	// Account/API error invalid_email; shown after a failed manual action, never used as a protocol value.
	"error.invalid_email": "Enter a valid email address.",
	// Account/API error email_might_be_registered; shown after a failed manual action, never used as a protocol value.
	"error.email_might_be_registered": "This email address may already be registered.",
	// Account/API error email_already_verified; shown after a failed manual action, never used as a protocol value.
	"error.email_already_verified": "This email address is already verified.",
	// Account/API error change_email_once_every_18_hours; shown after a failed manual action, never used as a protocol value.
	"error.change_email_once_every_18_hours": "You can change your email once every 18 hours.",
	// Account/API error passwords_dont_match; shown after a failed manual action, never used as a protocol value.
	"error.passwords_dont_match": "The new passwords do not match.",
	// Account/API error invalid_key; shown after a failed manual action, never used as a protocol value.
	"error.invalid_key": "This link is invalid or has expired.",
	// Account/API error already_sent_reminder_recently; shown after a failed manual action, never used as a protocol value.
	"error.already_sent_reminder_recently": "A password reminder was sent recently. Check your inbox and spam folder.",
	// Account/API error login_failed; shown after a failed manual action, never used as a protocol value.
	"error.login_failed": "Couldn't log in. Please try again.",
	// Account/API error character_type_not_allowed; shown after a failed manual action, never used as a protocol value.
	"error.character_type_not_allowed": "This character class is not available.",
	// Account/API error invalid_look; shown after a failed manual action, never used as a protocol value.
	"error.invalid_look": "Choose an available appearance.",
	// Account/API error please_enter_a_name; shown after a failed manual action, never used as a protocol value.
	"error.please_enter_a_name": "Enter a character name.",
	// Account/API error invalid_name; shown after a failed manual action, never used as a protocol value.
	"error.invalid_name": "Check the character name.",
	// Account/API error name_used; shown after a failed manual action, never used as a protocol value.
	"error.name_used": "This character name is already taken.",
	// Account/API error character_exists; shown after a failed manual action, never used as a protocol value.
	"error.character_exists": "This character name is already taken.",
	// Account/API error too_many_characters_from_ip; shown after a failed manual action, never used as a protocol value.
	"error.too_many_characters_from_ip": "Too many characters were created from this connection. Please try again later.",
	// Account/API error cant_create_more_than_18; shown after a failed manual action, never used as a protocol value.
	"error.cant_create_more_than_18": "An account can have up to 18 characters.",
	// Account/API error reached_character_limit; shown after a failed manual action, never used as a protocol value.
	"error.reached_character_limit": "Your account has no free character slots.",
	// Account/API error no_character; shown after a failed manual action, never used as a protocol value.
	"error.no_character": "Character not found.",
	// Account/API error character_not_found; shown after a failed manual action, never used as a protocol value.
	"error.character_not_found": "Character not found.",
	// Account/API error not_owner; shown after a failed manual action, never used as a protocol value.
	"error.not_owner": "This character does not belong to your account.",
	// Account/API error character_in_game; shown after a failed manual action, never used as a protocol value.
	"error.character_in_game": "Disconnect this character before continuing.",
	// Account/API error character_not_in_game; shown after a failed manual action, never used as a protocol value.
	"error.character_not_in_game": "Connect this character to the game first.",
	// Account/API error rename_once_every_32_hours; shown after a failed manual action, never used as a protocol value.
	"error.rename_once_every_32_hours": "You can rename a character once every 32 hours.",
	// Account/API error not_enough_shells; shown after a failed manual action, never used as a protocol value.
	"error.not_enough_shells": "You don't have enough SHELLS.",
	// Account/API error duplicate_click; shown after a failed manual action, never used as a protocol value.
	"error.duplicate_click": "This action has already been handled.",
	// Account/API error receiver_not_found_or_wrong_auth; shown after a failed manual action, never used as a protocol value.
	"error.receiver_not_found_or_wrong_auth": "The recipient or transfer code is incorrect.",
	// Account character deletion cooldown; {minutes} is the remaining whole number of minutes.
	"error.wait_minutes": "Wait {minutes} minutes before trying again.",
	// Account/API error cant_delete; shown after a failed manual action, never used as a protocol value.
	"error.cant_delete": "This cannot be deleted right now.",
	// Account/API error no_permission; shown after a failed manual action, never used as a protocol value.
	"error.no_permission": "You do not have permission to do this.",
	// Account/API error no_slot; shown after a failed manual action, never used as a protocol value.
	"error.no_slot": "Choose an available slot.",
	// Account/API error not_found; shown after a failed manual action, never used as a protocol value.
	"error.not_found": "Not found.",
	// Account/API error invalid_cursor; shown after a failed manual action, never used as a protocol value.
	"error.invalid_cursor": "Reload the list and try again.",
	// Account/API error server_not_found; shown after a failed manual action, never used as a protocol value.
	"error.server_not_found": "This server is offline.",
	// Account/API error wrong_server; shown after a failed manual action, never used as a protocol value.
	"error.wrong_server": "Choose a character on this server.",
	// Account/API error message_self; shown after a failed manual action, never used as a protocol value.
	"error.message_self": "Choose another character to message.",
	// Account/API error invalid_message; shown after a failed manual action, never used as a protocol value.
	"error.invalid_message": "Enter a message of up to 1,200 characters.",
	// Account/API error message_not_sent; shown after a failed manual action, never used as a protocol value.
	"error.message_not_sent": "The message could not be sent.",
	// Account/API error chat_unavailable; shown after a failed manual action, never used as a protocol value.
	"error.chat_unavailable": "Couldn't confirm the send. Check the chat before trying again.",
	// Account/API error delivery_failed; shown after a failed manual action, never used as a protocol value.
	"error.delivery_failed": "The message could not be delivered.",
	// Account/API error banned; shown after a failed manual action, never used as a protocol value.
	"error.banned": "This account cannot perform this action.",
	// Account/API error muted; shown after a failed manual action, never used as a protocol value.
	"error.muted": "This character is muted.",
	// Account/API error chat_slowdown; shown after a failed manual action, never used as a protocol value.
	"error.chat_slowdown": "Wait a moment before sending another message.",
	// Account/API error invalid_amount; shown after a failed manual action, never used as a protocol value.
	"error.invalid_amount": "Enter a valid amount.",
	// Account/API error invalid_order; shown after a failed manual action, never used as a protocol value.
	"error.invalid_order": "This purchase could not be found.",
	// Account/API error card_declined; shown after a failed manual action, never used as a protocol value.
	"error.card_declined": "The card was declined.",
	// Account/API error issue_with_token_or_usd; shown after a failed manual action, never used as a protocol value.
	"error.issue_with_token_or_usd": "The payment details could not be verified.",
	// Account/API error payment_failed; shown after a failed manual action, never used as a protocol value.
	"error.payment_failed": "The payment could not be completed.",
	// Account/API error purchase_creation_failed; shown after a failed manual action, never used as a protocol value.
	"error.purchase_creation_failed": "The purchase could not be started.",
	// Account/API error steam_account_mismatch; shown after a failed manual action, never used as a protocol value.
	"error.steam_account_mismatch": "Use the Steam account linked to this Adventure Land account.",
	// Account/API error steam_account_required; shown after a failed manual action, never used as a protocol value.
	"error.steam_account_required": "Sign in through Steam to continue.",
	// Account/API error steam_auth_failed; shown after a failed manual action, never used as a protocol value.
	"error.steam_auth_failed": "Steam sign-in failed. Please try again.",
	// Account/API error steam_checkout_unavailable; shown after a failed manual action, never used as a protocol value.
	"error.steam_checkout_unavailable": "Steam checkout is unavailable. Please try again later.",
	// Account/API error steam_payment_pending; shown after a failed manual action, never used as a protocol value.
	"error.steam_payment_pending": "Your Steam payment is still pending.",
	// Account/API error steam_purchase_cancelled; shown after a failed manual action, never used as a protocol value.
	"error.steam_purchase_cancelled": "The Steam purchase was cancelled.",
	// Account/API error steam_purchase_failed; shown after a failed manual action, never used as a protocol value.
	"error.steam_purchase_failed": "The Steam purchase could not be completed.",
	// Account/API error tauri_required; shown after a failed manual action, never used as a protocol value.
	"error.tauri_required": "Open this action in the Adventure Land desktop client.",
	// Account/API error transaction_failed; shown after a failed manual action, never used as a protocol value.
	"error.transaction_failed": "This change could not be saved. Please try again.",
	// Account/API error save_failed; shown after a failed manual action, never used as a protocol value.
	"error.save_failed": "Couldn't save. Please try again.",
	// Account/API error invalid_language; shown after a failed manual action, never used as a protocol value.
	"error.invalid_language": "Choose a language from the list.",
	// Account/API error cant_copy_over_map_in_use; shown after a failed manual action, never used as a protocol value.
	"error.cant_copy_over_map_in_use": "A map that is in use cannot be overwritten.",
	// Account/API error cant_delete_map_in_use; shown after a failed manual action, never used as a protocol value.
	"error.cant_delete_map_in_use": "A map that is in use cannot be deleted.",
};
