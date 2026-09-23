// Authored CODE runtime diagnostics. Player-supplied log text remains untouched.
module.exports = {
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.manual_coordinates": "You can't set coordinates manually, use the move(x,y) function!",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.attack_no_target": "Nothing to attack()",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.heal_no_target": "No one to heal()",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.equip_batch_array": "Can't equip_batch non-array",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.equip_batch_limit": "Can't equip_batch more than 15 items",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.equip_invalid": "Can't equip {slot}",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.monster_type": "get_nearest_monster: you used monster.type, which is always 'monster', use monster.mtype instead",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.monster_filter": "get_nearest_monster: you used 'mtype', you should use 'type'",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.send_gold_receiver": "No receiver sent to send_gold",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.send_item_receiver": "No receiver sent to send_item",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.send_cx_receiver": "No receiver sent to send_cx",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.listener_error": "Listener Exception ({event}) {error}",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.stale_message": "Removed a stale code message from: {name}",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.cm_error": "CM Error, From: {name}",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.set_error": "set() call failed for: {name} reason: {error}",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.load_error": "load_code: Failed to load",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_missing": "Path not found!",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.location_unknown": "Unrecognized location",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_found": "Path found!",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_found_approximate": "Path found~",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_searching": "Searching for a path...",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_lost": "Lost the path...",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_yes": "Yes!",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.readonly_character": "You attempted to change the character.{property} value manually. You have to use the provided functions to control your character!",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_hmm": "Hmm",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_left": "Definitely left",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_right": "No right!",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_uncertain": "Is it?",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_confidence": "I can do this!",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_thinking": "I think ...",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_what_if": "What If",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_should_be": "Should be",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_sure": "I'm Sure",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_nope": "Nope",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_wait": "Wait a min!",
	// Browser CODE runner pathfinding feedback, including floating character text. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.path_thought_surprise": "Oh my",
	// Browser CODE runner visible diagnostic or default message callback. Preserve function/property names, CODE syntax, and interpolated player content.
	"code.cm_received": "Received a code message from: {name}",
	// Default label for add_top_button/add_bottom_button when CODE omits its own value. Never translate the player's supplied label or button ID.
	"code.button.default": "BUTTON",
};
