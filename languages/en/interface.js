module.exports = {
	// Compact uppercase label below the Cavalry sprite on the nearby INFO button. Opens the Cavalry guide; does not summon. Translate as calling for help.
	"interface.cavalry.call_short": "CALL",
	// Refusal for an account at level 80+ with ordinary level-3+ monsters nearby but none attacking the caller or party. level is the account’s highest recorded character level as a string, which can be higher than the calling character’s level. Explain that the account level sets the rule. CODE reason remains no_monsters. Keep Cavalry.
	"interface.cavalry.not_threatened": "Your account's highest level is {level}. Cavalry only fights monsters already attacking you or your party.",
	// Offensive assistance refuses monsters near any living connected level-80+ player, regardless of party.
	"interface.cavalry.guarded": "A level-80+ player is within 150 pixels of these monsters.",
	// Generated private adventures reject Cavalry calls; fixed team name.
	"interface.cavalry.location": "Cavalry cannot enter this place.",
	// Call refusal for a disconnected/dead character, an in-flight request or unavailable persistence. Keep Cavalry.
	"interface.cavalry.unavailable": "Cavalry cannot answer right now.",
	// Account cooldown refusal. minutes is the remaining time rounded up, formatted as a string; use a compact minute unit, not count pluralization. Keep Cavalry.
	"interface.cavalry.cooldown": "Cavalry can answer again in {minutes} min.",
	// No ordinary monsters meet the rescue rules. The monster level, not the player level, must be at least 3.
	"interface.cavalry.no_monsters": "No eligible level 3+ monsters nearby.",
	// Missing required inventory item. Tracktrix and Cavalry are fixed names.
	"interface.cavalry.tracker": "Carry a Tracktrix to call the Cavalry.",
	// Call accepted but no sentry is assigned yet.
	"interface.cavalry.queued": "Cavalry is busy. Your call is waiting.",
	// Successful call feedback; keep Cavalry unchanged.
	"interface.cavalry.coming": "Cavalry is on the way!",
	// Tracktrix action and guide references. Uppercase action label with an exclamation mark, including the team name CAVALRY; use the locale’s punctuation.
	"interface.cavalry.call": "CALL IN THE CAVALRY!",
	// Character selection destination and own-condition tooltip. server is the full realm name, e.g. Americas II. Short label.
	"interface.selection.destination": "Server: {server}",
	// Character hover, condition tooltip and log. server is the saved home, e.g. Americas II.
	"interface.selection.home": "Home: {server}",
	// Home details before the character's first entry. Home has not been assigned yet.
	"interface.selection.home_unset": "Home: not set",
	// Character-card hover when the selected server differs from the saved home. name is the unchanged character name.
	"interface.selection.away_home": "This is not {name}'s home server.",
	// HUB account button and bank viewer heading. Opens saved bank items and gold, without moving them.
	"interface.hub.bank": "BANK",
	// HUB button for the watched character's equipped item slots, not account character slots or CODE slots.
	"interface.hub.equipment": "EQUIPMENT",
	// HUB bank pack selector. number is the one-based pack number (1–48).
	"interface.hub.pack": "Pack {number}",
	// HUB bank viewer. The HTTP view reads saved account data, which may lag behind changes made in game.
	"interface.hub.saved_bank": "Saved bank contents. Recent changes may not appear yet.",
	// Compact selected-monster line. seconds is a formatted remaining duration; damage is the exact remaining damage needed to break its shell, not monster HP. Preserve both placeholders.
	"interface.monster.rime_shell_progress": "{seconds}s · {damage} damage left",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.realmfatigue": "No kiss rewards or buff: Realm Fatigue is active. Check its timer and join a later round once it clears.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.hopsickness": "No kiss rewards or buff: Hop Sickness is active. Check its timer and join a later round once it clears.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.merchant_home": "No kiss rewards or buff: merchants must be on their home server when the round starts.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.claimed": "You already received this round's kiss rewards and buff.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.no_visit": "No kiss rewards or buff this round. You must be eligible and online when the featured player is chosen.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.no_round": "No player is featured right now.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.host": "You're the featured player. Eligible visitors bring you a slice and an Anniversary Gift.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.target_unavailable": "The featured player is unavailable. Your Visit stays valid until this round ends.",
	// Anniversary reward feedback in the existing log/INFO or guide. Keep character.anniversary, rewarded and reason as CODE identifiers; preserve names and placeholders.
	"interface.anniversary_status.wrong_target": "This round's rewards are only for kissing the featured player.",
	// Selection screen upcoming-content cards. Short teasers only; no dates or detailed mechanics. Keep The Black Wake, Werdars and Sucker Punch as proper names.
	"interface.upcoming.adventures.title": "Daily Adventures",
	"interface.upcoming.adventures.text": "A witch's secrets and new trails to follow.",
	"interface.upcoming.black_wake.title": "The Black Wake",
	"interface.upcoming.black_wake.text": "Trouble is gathering offshore.",
	"interface.upcoming.werdars.title": "Werdars' Level Awards",
	"interface.upcoming.werdars.text": "New gear for the climb ahead.",
	"interface.upcoming.rare_drops.title": "New Rare Drops",
	"interface.upcoming.rare_drops.text": "More rare finds like Sucker Punch.",
	// Skip the opening comic and continue to the first gameplay lesson.
	"interface.tutorial.skip": "Skip",
	// Labels on the level-50 tutorial equipment comparisons.
	"interface.tutorial.comparison.gear_plain": "+0 vendor equipment",
	"interface.tutorial.comparison.gear_upgraded": "Same equipment at +7",
	"interface.tutorial.comparison.gear_statted": "+7 with stat scrolls",
	"interface.tutorial.comparison.accessory_plain": "Accessories at +0",
	"interface.tutorial.comparison.accessory_improved": "Same accessories at +2",
	"interface.tutorial.comparison.hit": "Damage per hit",
	"interface.tutorial.comparison.dps": "Damage per second",
	"interface.tutorial.comparison.increase": "Increase",
	"interface.tutorial.comparison.target": "Target",
	// New tutorial/guide text. Keep Adventure Land, CODE/API identifiers, item/NPC names (Goo, Coat, Merchant Stand, Market Parcels, Rod, Pickaxe, Computer, Daisy, Merrit, Lost & Found), FriendName, STR/INT/DEX/MP/HP/XP and numbers unchanged. Translate class display names using existing locale terminology. No markup or placeholders.
	"interface.tutorial.main_track": "Adventurer Tutorial",
	// New tutorial/guide text. Keep Adventure Land, CODE/API identifiers, item/NPC names (Goo, Coat, Merchant Stand, Market Parcels, Rod, Pickaxe, Computer, Daisy, Merrit, Lost & Found), FriendName, STR/INT/DEX/MP/HP/XP and numbers unchanged. Translate class display names using existing locale terminology. No markup or placeholders.
	"interface.tutorial.merchant_track": "Merchant Tutorial",
	// Regular Settings label, beside the four page zoom choices.
	"interface.settings.zoom": "Zoom",
	// Direct page magnification choice in Settings. percent is -25, 0, +25 or +50; 0 means normal size.
	"interface.settings.zoom_percent": "{percent}%",
	// js/html.js close_ui_panel; authored interface text.
	"interface.close_ui_panel.no_target": "NO TARGET",
	// js/html.js prop_remains; authored interface text.
	"interface.prop_remains.seconds": "Seconds",
	// js/html.js prop_remains; authored interface text.
	"interface.prop_remains.minutes": "Minutes",
	// js/html.js prop_remains; authored interface text.
	"interface.prop_remains.hours": "Hours",
	// js/html.js render_party_old; authored interface text.
	"interface.party_old.party": "PARTY",
	// js/html.js render_party; authored interface text.
	"interface.party.rip": "RIP",
	// js/html.js render_member; authored interface text.
	"interface.member.rip": "RIP",
	// js/html.js render_map; authored interface text.
	"interface.map.vs": "vs",
	// js/html.js wabbit_click; authored interface text. Parameters: value.
	"interface.wabbit_click.wabbit_spawns_in_minutes": "Wabbit spawns in {value} minutes",
	// js/html.js wabbit_click; authored interface text.
	"interface.wabbit_click.engage_wabbit": "Engage Wabbit?",
	// js/html.js wabbit_click; authored interface text.
	"interface.wabbit_click.go": "Go",
	// js/html.js emonster_click; authored interface text. Parameters: monster.
	"interface.emonster_click.hasn_t_spawned_yet": "{monster} hasn't spawned yet!",
	// js/html.js emonster_click; authored interface text. Parameters: monster, value.
	"interface.emonster_click.spawns_in_minutes": "{monster} spawns in {value} minutes",
	// js/html.js emonster_click; authored interface text. Parameters: monster.
	"interface.emonster_click.engage": "Engage {monster}?",
	// js/html.js emonster_click; authored interface text.
	"interface.emonster_click.go": "Go",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.10_years_of_adventure": "10 Years of Adventure",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.come_celebrate_with_everyone_on_your_server": "Come celebrate with everyone on your server.",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.inside_a_sixfold_cake": "Inside a Sixfold Cake",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.equipment_or_a_rare_anniversary_cosmetic_plus_three_anniversary_gifts": "Equipment or a rare anniversary cosmetic, plus three Anniversary Gifts.",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.click_an_item_for_stats": "Click an item for stats.",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.want_a_particular_gift_keep_the_cake_for_mira_s": "Want a particular gift? Keep the cake for Mira's recipes instead.",
	// js/html.js anniversary_event_html; authored interface text.
	"interface.anniversary_event_html.inside_an_anniversary_gift": "Inside an Anniversary Gift",
	// js/html.js anniversary_event_html; the clickable card shows anniversarygift. Preserve the full item name Anniversary Gift; Gift is a different item.
	"interface.anniversary_event_html.gold_returning_anniversary_items_or_a_lucky_surprise_click_the":
		"Gold, returning anniversary items, or a lucky surprise. Click the Anniversary Gift for drop rates.",
	// js/html.js anniversary_event_html; event monster drops. Preserve the item name Anniversary Gift; slices is an ordinary noun for the six cake flavors.
	"interface.anniversary_event_html.monsters_can_drop_slices_and_gifts_too": "Monsters can drop slices and Anniversary Gifts, too.",
	// js/html.js anniversary_event_status_html; expired-event message. Preserve the item name Anniversary Gift; cakes is an ordinary category noun.
	"interface.anniversary_event_status_html.the_anniversary_event_has_ended_you_can_still_open_your": "The anniversary event has ended. You can still open your cakes and Anniversary Gifts.",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.i_kiss_you": "I Kiss You",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.you_re_the_featured_player": "You're the featured player!",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.find": "Find",
	// js/html.js anniversary_event_status_html; authored interface text. Parameters: target.
	"interface.anniversary_event_status_html.waiting_for_to_return_to_a_reachable_spot_their_place":
		"Waiting for {target} to return to a reachable spot. Their place is reserved; the five-minute timer keeps running.",
	// js/html.js anniversary_event_status_html; authored interface text.
	// Shown only to the featured player. Your own flavor is the featured account's flavor; each visitor separately receives the visitor account's flavor.
	"interface.anniversary_event_status_html.stay_nearby_and_welcome_your_visitors_each_visitor_who_uses":
		"Stay nearby and welcome your visitors. Each visitor who uses their Visit brings you one slice of your own flavor and one Anniversary Gift.",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.get_close_then_send_a_kiss": "Get close, then send a kiss.",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.who_will_we_visit_next": "Who will we visit next?",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.every_30_minutes_someone_on_this_server_is_featured_everyone": "Every 30 minutes, someone on this server is featured. Eligible players already online have five minutes to send them a kiss.",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.use_your_anniversary_visit_1_cake_slice_1_anniversary_gift": "A rewarded kiss gives 1 Cake Slice + 1 Anniversary Gift, and +10 Frequency / +6 Output for 20 minutes.",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.find_the_featured_player_and_send_a_kiss_before_your": "Get close and use I Kiss You. Each round gives one rewarded kiss. No permanent unlock needed.",
	// js/html.js anniversary_event_status_html; authored interface text.
	"interface.anniversary_event_status_html.no_anniversary_visit_remaining_for_this_round_be_online_when": "No Anniversary Visit remaining for this round. Be online when the next player is selected.",
	// js/html.js anniversary_collection_html; authored interface text.
	"interface.anniversary_collection_html.put_the_cake_together": "Put the cake together",
	// js/html.js anniversary_collection_html; authored interface text. Parameters: owned.
	"interface.anniversary_collection_html.6_flavors_in_your_bag": "{owned} / 6 flavors in your bag",
	// js/html.js anniversary_collection_html; authored interface text.
	"interface.anniversary_collection_html.your_account_always_finds_the_same_flavor_trade_your_spare": "Your account always finds the same flavor. Trade your spare slices for the other five.",
	// js/html.js anniversary_collection_html; authored interface text.
	"interface.anniversary_collection_html.mira": "Mira",
	// js/html.js anniversary_collection_html; authored interface text.
	"interface.anniversary_collection_html.mainland": "/ Mainland",
	// js/html.js anniversary_collection_html; authored interface text.
	"interface.anniversary_collection_html.bring_all_six_slices": "Bring all six slices +",
	// js/html.js anniversary_collection_html; authored interface text. Parameters: cost.
	"interface.anniversary_collection_html.gold": "{cost} Gold",
	// js/html.js anniversary_collection_html; authored interface text.
	"interface.anniversary_collection_html.mira_is_at_64_88_choose_cake_to_combine_slices": "Mira is at (64, -88). Choose CAKE to combine slices, or CRAFT for her other recipes. You must be nearby.",
	// js/html.js open_interaction_guide; authored interface text.
	"interface.open_interaction_guide.no_guide_is_available_for_this_interaction_yet": "No guide is available for this interaction yet.",
	// js/html.js render_server; authored interface text.
	"interface.server.kiss": "KISS",
	// js/html.js render_server; authored interface text.
	"interface.server.info": "INFO",
	// js/html.js render_server; authored interface text. Parameters: value.
	"interface.server.m": "{value}M",
	// js/html.js render_server; authored interface text.
	"interface.server.join": "JOIN",
	// js/html.js render_server; authored interface text.
	"interface.server.10_years": "10 YEARS",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.class": "Class:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.level": "Level:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.xp": "XP:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.pvp": "(PVP)",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.max_xp_loss": "Max XP Loss:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.party": "Party:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.your_share": "(Your Share)",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.tax": "Tax:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.heal": "Heal:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.attack": "Attack:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.attack_speed": "Attack Speed:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.strength": "Strength:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.intelligence": "Intelligence:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.dexterity": "Dexterity:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.vitality": "Vitality:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.fortitude": "Fortitude:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.armor": "Armor:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.resistance": "Resistance:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.courage": "Courage:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.speed": "Speed:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.mp_cost": "MP Cost:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.lifesteal": "Lifesteal:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.manasteal": "Manasteal:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.damage_return": "Damage Return:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.reflection": "Reflection:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.evasion": "Evasion:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.miss": "Miss:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.crit": "Crit:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.critical_damage": "Critical Damage:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.armor_piercing": "Armor Piercing:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.resistance_piercing": "Resistance Piercing:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.gold": "Gold:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.experience": "Experience:",
	// js/html.js render_character_sheet; authored interface text.
	"interface.character_sheet.luck": "Luck:",
	// js/html.js render_npc; authored interface text.
	"interface.npc.level": "LEVEL",
	// js/html.js render_monster; authored interface text.
	"interface.monster.att": "ATT",
	// js/html.js render_monster; authored interface text.
	"interface.monster.avoidance": "AVOIDANCE",
	// js/html.js render_monster; authored interface text.
	"interface.monster.evasion": "EVASION",
	// js/html.js render_monster; authored interface text.
	"interface.monster.reflect": "REFLECT.",
	// js/html.js render_monster; authored interface text.
	"interface.monster.d_return": "D.RETURN",
	// js/html.js render_monster; authored interface text.
	"interface.monster.armor": "ARMOR",
	// js/html.js render_monster; authored interface text.
	"interface.monster.resist": "RESIST.",
	// js/html.js render_monster; authored interface text.
	"interface.monster.pierce": "PIERCE.",
	// js/html.js render_monster; authored interface text.
	"interface.monster.expl": "EXPL.",
	// js/html.js render_monster; authored interface text.
	"interface.monster.lifesteal": "LIFESTEAL",
	// js/html.js render_monster; authored interface text.
	"interface.monster.1hp_hits": "1HP HITS",
	// js/html.js render_monster; authored interface text.
	"interface.monster.cooperative": "COOPERATIVE",
	// js/html.js render_monster; authored interface text.
	"interface.monster.immune": "IMMUNE",
	// js/html.js render_monster; authored interface text.
	"interface.monster.peaceful": "PEACEFUL",
	// js/html.js render_monster; authored interface text.
	"interface.monster.supporter": "SUPPORTER",
	// js/html.js render_monster; authored interface text.
	"interface.monster.spawns": "SPAWNS",
	// js/html.js render_monster; authored interface text.
	"interface.monster.trg": "TRG",
	// js/html.js render_monster; authored interface text.
	"interface.monster.name": "NAME",
	// js/html.js render_monster; authored interface text.
	"interface.monster.pal": "PAL",
	// js/html.js render_monster; authored interface text.
	"interface.monster.self_healing": "SELF HEALING",
	// js/html.js render_monster; authored interface text.
	"interface.monster.diff": "DIFF.",
	// js/html.js render_monster; authored interface text.
	"interface.monster.poisonous": "POISONOUS",
	// js/html.js render_monster; authored interface text.
	"interface.monster.inspect": "INSPECT",
	// js/html.js render_character; authored interface text.
	"interface.character.level": "LEVEL",
	// js/html.js render_character; authored interface text.
	"interface.character.heal": "HEAL",
	// js/html.js render_character; authored interface text.
	"interface.character.att": "ATT",
	// js/html.js render_character; authored interface text.
	"interface.character.attspd": "ATTSPD",
	// js/html.js render_character; authored interface text.
	"interface.character.range": "RANGE",
	// js/html.js render_character; authored interface text.
	"interface.character.runspd": "RUNSPD",
	// js/html.js render_character; authored interface text.
	"interface.character.armor": "ARMOR",
	// js/html.js render_character; authored interface text.
	"interface.character.resist": "RESIST.",
	// js/html.js render_character; authored interface text.
	"interface.character.party": "PARTY",
	// js/html.js render_character; authored interface text.
	"interface.character.inspect": "INSPECT",
	// js/html.js render_character; authored interface text.
	"interface.character.kick": "KICK",
	// js/html.js render_character; authored interface text.
	"interface.character.request": "REQUEST",
	// js/html.js render_character; authored interface text.
	"interface.character.cosmetics": "COSMETICS",
	// js/html.js render_character; authored interface text.
	"interface.character.hide": "HIDE",
	// js/html.js render_character; authored interface text.
	"interface.character.trade": "TRADE",
	// js/html.js render_character; authored interface text.
	"interface.character.toggle": "TOGGLE",
	// js/html.js render_character; authored interface text.
	"interface.character.poke": "POKE!",
	// js/html.js render_slots; authored interface text.
	"interface.slots.cosmetics": "COSMETICS",
	// js/html.js render_transports_npc; authored interface text.
	"interface.transports_npc.gt_mainland": "&gt; Mainland",
	// js/html.js render_transports_npc; authored interface text.
	"interface.transports_npc.gt_winterland": "&gt; Winterland",
	// js/html.js render_transports_npc; authored interface text.
	"interface.transports_npc.gt_desertland": "&gt; Desertland",
	// js/html.js render_transports_npc; authored interface text.
	"interface.transports_npc.gt_duelland": "&gt; Duelland",
	// js/html.js render_transports_npc; authored interface text.
	"interface.transports_npc.vs": "vs",
	// js/html.js render_mainframe; authored interface text.
	"interface.mainframe.mainframe_gt_connected": "mainframe&gt; connected",
	// js/html.js render_mainframe; authored interface text.
	"interface.mainframe.mainframe_gt": "mainframe&gt;",
	// js/html.js render_mainframe; authored interface text.
	"interface.mainframe.logout": "logout",
	// js/html.js render_gold_npc; authored interface text.
	"interface.gold_npc.gold": "GOLD:",
	// js/html.js render_gold_npc; authored interface text.
	"interface.gold_npc.amount": "Amount:",
	// js/html.js render_gold_npc; authored interface text.
	"interface.gold_npc.max": "MAX",
	// js/html.js render_gold_npc; authored interface text.
	"interface.gold_npc.deposit": "DEPOSIT",
	// js/html.js render_gold_npc; authored interface text.
	"interface.gold_npc.withdraw": "WITHDRAW",
	// js/html.js render_inventory; authored interface text.
	"interface.inventory.12_new_chat_messages": "12 new chat messages!",
	// js/html.js render_inventory; authored interface text.
	"interface.inventory.close": "CLOSE",
	// js/html.js render_inventory; authored interface text.
	"interface.inventory.close_inventory": "Close inventory",
	// js/html.js render_inventory; authored interface text.
	"interface.inventory.shells": "SHELLS",
	// js/html.js render_inventory; authored interface text.
	"interface.inventory.gold": "GOLD",
	// js/html.js render_craftsman; authored interface text.
	"interface.craftsman.craft": "CRAFT",
	// js/html.js render_craftsman; authored interface text.
	"interface.craftsman.reset": "RESET",
	// js/html.js render_anniversary_baker; Mira describes Xyn's general exchange service. Cakes and gifts are ordinary category nouns here, not specific item titles. Preserve Xyn.
	"interface.anniversary_baker.cakes_are_for_crafting_here_or_exchanging_with_xyn_he":
		"Cakes are for crafting here, or exchanging with Xyn. He opens gifts too. It's all very confusing... and I'm the baker!",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.find_xyn": "FIND XYN",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.back": "BACK",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.welcome_i_combine_cake_slices_and_craft_anniversary_gifts_what": "Welcome! I combine cake slices and craft anniversary gifts. What would you like?",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.cake": "CAKE",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.exchange": "EXCHANGE",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.craft": "CRAFT",
	// js/html.js render_anniversary_baker; authored interface text.
	"interface.anniversary_baker.info": "INFO",
	// js/html.js render_dismantler; authored interface text.
	"interface.dismantler.dismantle": "DISMANTLE",
	// js/html.js render_locksmith; authored interface text.
	"interface.locksmith.lock": "LOCK",
	// js/html.js render_locksmith; authored interface text.
	"interface.locksmith.unlock": "UNLOCK",
	// js/html.js render_locksmith; authored interface text.
	"interface.locksmith.seal": "SEAL",
	// js/html.js render_scrollsmith; authored interface text.
	"interface.scrollsmith.de_stat": "DE-STAT",
	// js/html.js render_recipes_old; authored interface text.
	"interface.recipes_old.craft": "CRAFT",
	// js/html.js render_recipes_old; authored interface text.
	"interface.recipes_old.dismantle": "DISMANTLE",
	// js/html.js render_exchange_shrine; authored interface text.
	"interface.exchange_shrine.exchange": "EXCHANGE",
	// js/html.js render_exchange_shrine; authored interface text.
	"interface.exchange_shrine.give": "GIVE",
	// js/html.js render_exchange_shrine; authored interface text.
	"interface.exchange_shrine.provide": "PROVIDE",
	// js/html.js render_exchange_shrine; authored interface text.
	"interface.exchange_shrine.give_it": "GIVE IT",
	// js/html.js render_exchange_shrine; authored interface text.
	"interface.exchange_shrine.feed": "FEED",
	// js/html.js render_exchange_shrine; authored interface text.
	"interface.exchange_shrine.shazam": "SHAZAM",
	// js/html.js render_pet_shrine; authored interface text.
	"interface.pet_shrine.release": "RELEASE",
	// js/html.js render_none_shrine; authored interface text.
	"interface.none_shrine.poof": "POOF",
	// js/html.js render_shells_buyer; authored interface text.
	"interface.shells_buyer.shells": "Shells =",
	// js/html.js render_shells_buyer; authored interface text.
	"interface.shells_buyer.buy": "BUY",
	// js/html.js render_shells_buyer; authored interface text.
	"interface.shells_buyer.buy_with": "Buy With $",
	// js/html.js render_shells_buyer; authored interface text.
	"interface.shells_buyer.nope": "Nope",
	// js/html.js render_upgrade_shrine; authored interface text.
	"interface.upgrade_shrine.reset": "RESET",
	// js/html.js render_upgrade_shrine; authored interface text.
	"interface.upgrade_shrine.upgrade": "UPGRADE",
	// js/html.js render_compound_shrine; authored interface text.
	"interface.compound_shrine.reset": "RESET",
	// js/html.js render_compound_shrine; authored interface text.
	"interface.compound_shrine.combine": "COMBINE",
	// js/html.js on_dice_change; authored interface text. Parameters: value.
	"interface.on_dice_change.for_x": "FOR {value}X",
	// js/html.js render_dice; authored interface text.
	"interface.dice.number": "NUMBER:",
	// js/html.js render_dice; authored interface text.
	"interface.dice.gold": "GOLD:",
	// js/html.js render_dice; authored interface text.
	"interface.dice.up": "UP",
	// js/html.js render_dice; authored interface text.
	"interface.dice.down": "DOWN",
	// js/html.js render_dice; authored interface text.
	"interface.dice.bet": "BET",
	// js/html.js render_dice; authored interface text.
	"interface.dice.for_2x": "FOR 2X",
	// js/html.js render_tavern_info; authored interface text.
	"interface.tavern_info.house_edge": "House Edge",
	// js/html.js render_tavern_info; authored interface text.
	"interface.tavern_info.max_net_win": "Max. Net Win",
	// js/tavern_wheel.js render_wheel; panel heading of the Tavern's even-money wheel game. Fortune's Wheel is its name.
	"interface.wheel.title": "Fortune's Wheel",
	// js/tavern_wheel.js; compact button label for the warm-coloured side of the wheel. Also inserted into server wheel messages.
	"interface.wheel.sun": "SUN",
	// js/tavern_wheel.js; compact button label for the cool-coloured side of the wheel. Also inserted into server wheel messages.
	"interface.wheel.moon": "MOON",
	// js/tavern_wheel.js; compact button that starts the spin.
	"interface.wheel.spin": "SPIN",
	// js/tavern_wheel.js; compact button hint while the wheel is turning.
	"interface.wheel.spinning": "SPINNING...",
	// js/tavern_wheel.js; compact hint beside SPIN showing the net gold gained if the chosen side wins. amount is a formatted gold number.
	"interface.wheel.win_hint": "WIN +{amount}",
	// js/tavern_wheel.js; small note under the wheel. edge is a percentage number such as 2 or 0.5, without the % sign.
	"interface.wheel.house": "The house keeps {edge}% of winnings",
	// js/tavern_slots.js render_slots; panel heading of the Tavern slot machine.
	"interface.slots.title": "Slots",
	// js/tavern_slots.js; heading above the prize list: three matching symbols on the middle line pay the listed gold.
	"interface.slots.paytable": "Three of a kind pays",
	// js/tavern_slots.js; compact odds label beside a prize. value is a formatted number of spins, as in "1 in 5,000".
	"interface.slots.odds": "1 in {value}",
	// js/tavern_slots.js; compact hint beside SPIN showing the fixed stake. amount is a formatted gold number.
	"interface.slots.cost": "{amount} gold",
	// js/tavern_wheel.js and js/tavern_slots.js, panel hint after a restart returned the stake of a spin that had not settled. Short label.
	"interface.tavern.refunded": "Stake returned",
	// js/tavern_poker.js; overlay heading of the Tavern's Texas Hold'em poker table.
	"interface.poker.title": "Tavern Hold'em",
	// js/tavern_poker.js; shown for a moment while the table state arrives.
	"interface.poker.loading": "Fetching the table…",
	// js/tavern_poker.js; table info line. small and big are formatted gold amounts of the small and big blind.
	"interface.poker.blinds": "Blinds {small} / {big}",
	// js/tavern_poker.js; table info line. min and max are formatted gold amounts of the allowed buy-in.
	"interface.poker.buyin": "Buy-in {min} – {max}",
	// js/tavern_poker.js; table info line. rake is a percentage number without the % sign; cap is formatted gold.
	"interface.poker.rake": "Rake {rake}% of each pot, at most {cap}",
	// js/tavern_poker.js; label of an unoccupied seat.
	"interface.poker.empty_seat": "Empty seat",
	// js/tavern_poker.js; button on an empty seat that opens the buy-in entry. Compact uppercase label.
	// js/tavern_poker.js, empty seat hint when the character is not next to that stool; clicking it walks there.
	"interface.poker.walk_to_sit": "Walk up to sit",
	"interface.poker.join": "JOIN",
	// js/tavern_poker.js; button that confirms the typed buy-in amount. Compact uppercase label.
	"interface.poker.buy_in": "BUY IN",
	// js/tavern_poker.js; small hint under the buy-in entry. min and max are formatted gold amounts.
	"interface.poker.buyin_hint": "{min} to {max} gold",
	// js/tavern_poker.js; bottom line while spectating. min and max are formatted gold amounts.
	"interface.poker.take_a_seat": "Take a seat to play. Buy in for {min} to {max} gold.",
	// js/tavern_poker.js; button that cashes out between hands. Compact uppercase label.
	"interface.poker.leave": "LEAVE",
	// js/tavern_poker.js; button while the player is in a hand: cash out once it ends. Compact uppercase label.
	"interface.poker.leave_after_hand": "LEAVE AFTER HAND",
	// js/tavern_poker.js; seat status once Leave was pressed during a hand.
	"interface.poker.leaving": "Leaving after this hand",
	// js/tavern_poker.js; button to skip the next hands while keeping the seat. Compact uppercase label.
	"interface.poker.sit_out": "SIT OUT",
	// js/tavern_poker.js; button to be dealt again after sitting out. Compact uppercase label.
	"interface.poker.sit_in": "SIT IN",
	// js/tavern_poker.js; seat status of a player who is not dealt in.
	"interface.poker.sitting_out": "Sitting out",
	// js/tavern_poker.js; bottom line for the player's own seat while sitting out.
	"interface.poker.sitting_out_hint": "You are sitting out. Sit in to be dealt the next hand.",
	// js/tavern_poker.js; action button: give up the hand. Compact uppercase poker term.
	"interface.poker.fold": "FOLD",
	// js/tavern_poker.js; action button: pass without betting. Compact uppercase poker term.
	"interface.poker.check": "CHECK",
	// js/tavern_poker.js; action button: match the current bet. amount is formatted gold. Compact uppercase poker term.
	"interface.poker.call": "CALL {amount}",
	// js/tavern_poker.js; label before the amount entry when nobody has bet on this street yet. Compact uppercase poker term.
	"interface.poker.bet": "BET",
	// js/tavern_poker.js; label before the amount entry: the total the player will have bet on this street. Compact uppercase poker term.
	"interface.poker.raise_to": "RAISE TO",
	// js/tavern_poker.js; button that sends the typed bet or raise amount. Compact uppercase poker term.
	"interface.poker.raise": "RAISE",
	// js/tavern_poker.js; preset button: the smallest legal raise. Compact uppercase abbreviation.
	"interface.poker.min": "MIN",
	// js/tavern_poker.js; preset button: raise by half the pot. Compact uppercase label.
	"interface.poker.half_pot": "½ POT",
	// js/tavern_poker.js, raise preset: three quarters of the pot. Keep it as short as the others.
	"interface.poker.three_quarter_pot": "¾ POT",
	// js/tavern_poker.js, raise preset: a multiple of the pot. {x} = 1.5 or 2.
	"interface.poker.pot_x": "{x}× POT",
	// js/tavern_poker.js, raise preset: a raise to a number of big blinds. {x} = 2 or 3.
	"interface.poker.bb_x": "{x} BB",
	// js/tavern_poker.js; preset button: raise by the whole pot. Compact uppercase label.
	"interface.poker.pot": "POT",
	// js/tavern_poker.js; action button: bet the whole stack. Compact uppercase poker term.
	"interface.poker.all_in": "ALL IN",
	// js/tavern_poker.js; status under the player's own seat when it must act.
	"interface.poker.your_turn": "Your turn",
	// js/tavern_poker.js; same status with the seconds left on the clock. seconds is a plain number.
	"interface.poker.your_turn_seconds": "Your turn · {seconds}s",
	// js/tavern_poker.js; status under another seat while it is deciding.
	"interface.poker.thinking": "Thinking…",
	// js/tavern_poker.js; bottom line while another player decides. name is a character name.
	"interface.poker.waiting_for": "Waiting for {name}…",
	// js/tavern_poker.js; centre of the table before the first hand: fewer than two players are ready.
	"interface.poker.waiting_players": "Waiting for players",
	// js/tavern_poker.js; bottom line between hands.
	"interface.poker.next_hand": "Next hand starts shortly…",
	// js/tavern_poker.js; bottom line between hands with the countdown. seconds is a plain number.
	"interface.poker.next_hand_seconds": "Next hand in {seconds}s",
	// js/tavern_poker.js; centre of the table: the gold in the pots. amount is formatted gold.
	"interface.poker.pot_label": "Pot {amount}",
	// js/tavern_poker.js; betting round before the community cards. Poker term.
	"interface.poker.street.preflop": "Pre-flop",
	// js/tavern_poker.js; betting round with three community cards. Poker term.
	"interface.poker.street.flop": "Flop",
	// js/tavern_poker.js; betting round with the fourth community card. Poker term.
	"interface.poker.street.turn": "Turn",
	// js/tavern_poker.js; betting round with the fifth community card. Poker term.
	"interface.poker.street.river": "River",
	// js/tavern_poker.js; the hand is over and cards are compared. Poker term.
	"interface.poker.street.showdown": "Showdown",
	// js/tavern_poker.js; seat status after giving up the hand.
	"interface.poker.folded": "Folded",
	// js/tavern_poker.js; seat status when the whole stack is in the pot.
	"interface.poker.all_in_status": "All in",
	// js/tavern_poker.js; seat status while its player has lost connection.
	"interface.poker.disconnected": "Disconnected",
	// js/tavern_poker.js; seat status at the end of a hand won without a showdown. amount is formatted gold.
	"interface.poker.wins": "Wins {amount}",
	// js/tavern_poker.js; seat status at showdown. amount is formatted gold, hand is a translated hand name such as Two Pair.
	"interface.poker.wins_with": "Wins {amount} with {hand}",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.high_card": "High Card",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.pair": "Pair",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.two_pair": "Two Pair",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.three_of_a_kind": "Three of a Kind",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.straight": "Straight",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.flush": "Flush",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.full_house": "Full House",
	// js/tavern_poker.js; poker hand category.
	"interface.poker.hand.four_of_a_kind": "Four of a Kind",
	// js/tavern_poker.js; poker hand category, also used for a royal flush.
	"interface.poker.hand.straight_flush": "Straight Flush",
	// js/tavern_poker.js; table log line. n is the hand number.
	"interface.poker.log.deal": "Hand {n} dealt",
	// js/tavern_poker.js; table log line. name is a character name.
	"interface.poker.log.fold": "{name} folds",
	// js/tavern_poker.js; table log line. name is a character name.
	"interface.poker.log.check": "{name} checks",
	// js/tavern_poker.js; table log line. amount is formatted gold.
	"interface.poker.log.call": "{name} calls {amount}",
	// js/tavern_poker.js; table log line: the first bet of a street. amount is formatted gold.
	"interface.poker.log.bet": "{name} bets {amount}",
	// js/tavern_poker.js; table log line: amount is the new total bet of the street, formatted gold.
	"interface.poker.log.raise": "{name} raises to {amount}",
	// js/tavern_poker.js; table log line. amount is formatted gold.
	"interface.poker.log.allin": "{name} is all in for {amount}",
	// js/tavern_poker.js; table log line for a hand won without a showdown. amount is formatted gold.
	"interface.poker.log.win": "{name} wins {amount}",
	// js/tavern_poker.js; table log line at showdown. hand is a translated hand name.
	"interface.poker.log.win_with": "{name} wins {amount} with {hand}",
	// js/tavern_poker.js; table log line. amount is the buy-in, formatted gold.
	"interface.poker.log.join": "{name} sits down with {amount}",
	// js/tavern_poker.js; table log line. amount is the returned stack, formatted gold.
	"interface.poker.log.leave": "{name} leaves with {amount}",
	// js/tavern_poker.js; table log line.
	"interface.poker.log.out": "{name} sits out",
	// js/tavern_poker.js; table log line: the player is dealt again after sitting out.
	"interface.poker.log.in": "{name} is back in",
	// js/tavern_poker.js; table log line.
	"interface.poker.log.dc": "{name} lost connection",
	// js/tavern_poker.js; table log line: a disconnected player reconnected.
	"interface.poker.log.back": "{name} is back",
	// js/tavern_poker.js; table log line when a server restart cancels the running hand.
	"interface.poker.log.void": "The hand was voided and every bet returned",
	// js/html.js render_donate; authored interface text.
	"interface.donate.gold": "GOLD:",
	// js/html.js render_donate; authored interface text.
	"interface.donate.donate": "DONATE",
	// js/html.js render_drop; authored interface text.
	"interface.drop.zilch": "ZILCH",
	// js/html.js render_equip_info; authored interface text. Parameters: value.
	"interface.equip_info.mainhand": "[{value}] Mainhand",
	// js/html.js render_equip_info; authored interface text.
	"interface.equip_info.no_modifier": "No Modifier",
	// js/html.js render_equip_info; authored interface text. Parameters: value.
	"interface.equip_info.doublehand": "[{value}] Doublehand",
	// js/html.js render_equip_info; authored interface text. Parameters: value.
	"interface.equip_info.offhand": "[{value}] Offhand",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.buyable_from": "Buyable From:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.spend_at": "Spend At:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.acquirable_from": "Acquirable From:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.with": "with",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.exchange_from": "Exchange From",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.bring_to": "Bring To",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.drop_table": "Drop Table:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.upgrade_at": "Upgrade At",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.combine_3_at": "Combine 3 At",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.buy_scrolls_from": "Buy Scrolls From",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.used_for_crafting": "Used For Crafting:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.collectable_for": "Collectable For:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.craftable_at": "Craftable At",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.recipe": "Recipe",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.obtainable_from": "Obtainable From",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.materials": "Materials",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.concocted_at": "Concocted At",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.craftable_during_the_anniversary": "Craftable During the Anniversary",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.show": "Show",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.dismantle_at": "Dismantle At:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.drops_from": "Drops From:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.global_drop_at": "Global Drop At:",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.everywhere": "Everywhere",
	// js/html.js render_item_help; authored interface text.
	"interface.item_help.obtainable_from_2": "Obtainable From:",
	// js/html.js render_monster_info; authored interface text.
	"interface.monster_info.drops": "Drops:",
	// js/html.js render_monster_info; authored interface text.
	"interface.monster_info.home_server_drops": "Home Server Drops:",
	// js/html.js render_monster_info; authored interface text.
	"interface.monster_info.global": "Global:",
	// js/html.js render_exchange_info; authored interface text.
	"interface.exchange_info.also_receive": "Also receive:",
	// js/html.js render_tracker; authored interface text.
	"interface.tracker.monsters": "Monsters",
	// js/html.js render_tracker; authored interface text.
	"interface.tracker.exchanges_and_quests": "Exchanges and Quests",
	// js/html.js render_computer; authored interface text.
	"interface.computer.connected": "CONNECTED.",
	// js/html.js render_computer; authored interface text.
	"interface.computer.trade_history": "TRADE HISTORY",
	// js/html.js render_computer; authored interface text.
	"interface.computer.toggle_stand": "TOGGLE STAND",
	// js/html.js render_computer; authored interface text.
	"interface.computer.tracker": "TRACKER",
	// js/html.js render_computer; authored interface text.
	"interface.computer.upgrade": "UPGRADE",
	// js/html.js render_computer; authored interface text.
	"interface.computer.compound": "COMPOUND",
	// js/html.js render_computer; authored interface text.
	"interface.computer.exchange": "EXCHANGE",
	// js/html.js render_computer; authored interface text.
	"interface.computer.locksmith": "LOCKSMITH",
	// js/html.js render_computer; authored interface text.
	"interface.computer.crafting": "CRAFTING",
	// js/html.js render_computer; authored interface text.
	"interface.computer.potions": "POTIONS",
	// js/html.js render_computer; authored interface text.
	"interface.computer.scrolls": "SCROLLS",
	// js/html.js render_computer; authored interface text.
	"interface.computer.basics": "BASICS",
	// js/html.js render_computer; authored interface text.
	"interface.computer.premium": "PREMIUM",
	// js/html.js render_skill; authored interface text.
	"interface.skill.duration": "Duration",
	// js/html.js render_skill; authored interface text.
	"interface.skill.cooldown": "Cooldown",
	// js/html.js render_skill; interval before a skill with reuse_cooldown can be used again. For Assassin's Smoke, it begins after reappearance. Describe the wait, not repeated casting or effect duration.
	"interface.skill.r_use_cooldown": "Reuse Cooldown",
	// js/html.js render_skill; authored interface text.
	"interface.skill.range": "Range",
	// js/html.js render_skill; authored interface text.
	"interface.skill.level_requirement": "Level Requirement",
	// js/html.js render_skill; authored interface text.
	"interface.skill.weapon_requirement": "Weapon Requirement",
	// js/html.js render_skill; authored interface text.
	"interface.skill.offhand_requirement": "Offhand Requirement",
	// js/html.js render_skill; authored interface text.
	"interface.skill.max": "Max",
	// js/html.js render_skill; authored interface text.
	"interface.skill.passive": "Passive",
	// js/html.js render_skill; authored interface text.
	"interface.skill.damage_type": "Damage Type",
	// js/html.js render_skill; authored interface text.
	"interface.skill.condition": "Condition",
	// js/html.js render_skill; authored interface text.
	"interface.skill.output": "Output",
	// js/html.js render_skill; authored interface text.
	"interface.skill.hp_loss_to_mp": "HP loss to MP",
	// js/html.js render_skill; authored interface text. Parameters: value.
	"interface.skill.required": "Required {value}",
	// js/html.js render_skill; authored interface text.
	"interface.skill.show": "Show:",
	// js/html.js render_tutorial_index; authored interface text.
	"interface.tutorial_index.tutorial_lessons": "Tutorial Lessons",
	// js/html.js render_tutorial; authored interface text.
	"interface.tutorial.lessons": "LESSONS",
	// js/html.js render_tutorial; authored interface text.
	"interface.tutorial.completion": "Completion:",
	// js/html.js render_tutorial; authored interface text.
	"interface.tutorial.incomplete": "INCOMPLETE",
	// js/html.js render_learn_article; authored interface text.
	"interface.learn_article.lt_previous": "&lt; Previous",
	// js/html.js render_learn_article; authored interface text.
	"interface.learn_article.next_gt": "Next &gt;",
	// js/html.js render_learn_article; authored interface text.
	"interface.learn_article.close": "Close",
	// js/html.js render_encouragement_info; authored interface text.
	"interface.encouragement_info.your_encouragement": "Your Encouragement",
	// js/html.js render_encouragement_info; authored interface text. Parameters: gold_multiplier, xp_multiplier, luck_multiplier.
	"interface.encouragement_info.gold_xp_luck": "{gold_multiplier}× Gold · {xp_multiplier}× XP · {luck_multiplier}× Luck",
	// js/html.js render_function_reference; authored interface text.
	"interface.function_reference.reference_not_found": "Reference not found",
	// js/html.js render_cx_info; authored interface text.
	"interface.cx_info.id": "ID:",
	// js/html.js render_cx_info; authored interface text.
	"interface.cx_info.type": "Type:",
	// js/html.js render_cx_info; authored interface text.
	"interface.cx_info.slot": "Slot:",
	// js/html.js render_all_events; authored interface text.
	"interface.all_events.daily_events": "Daily Events",
	// js/html.js render_all_events; authored interface text.
	"interface.all_events.nightly_events": "Nightly Events",
	// js/html.js render_all_events; authored interface text.
	"interface.all_events.seasonal_events": "Seasonal Events",
	// js/html.js render_guide; authored interface text.
	"interface.guide.tutorial_lessons": "Tutorial Lessons",
	// js/html.js render_guide; authored interface text.
	"interface.guide.all_items": "All Items",
	// js/html.js render_guide; authored interface text.
	"interface.guide.all_monsters": "All Monsters",
	// js/html.js render_guide; authored interface text.
	"interface.guide.all_skills_amp_c": "All Skills &amp; C.",
	// js/html.js render_guide; authored interface text.
	"interface.guide.all_recipes": "All Recipes",
	// js/html.js render_guide; authored interface text.
	"interface.guide.code_docs": "Code Docs",
	// js/html.js render_guide; authored interface text.
	"interface.guide.guide_is_a_work_in_progress": "Guide is a Work in Progress!",
	// js/html.js render_code_articles; authored interface text.
	"interface.code_articles.more_articles_coming_soon": "More Articles Coming Soon!",
	// js/html.js render_objects_reference; authored interface text.
	"interface.objects_reference.work_in_progress": "Work in Progress",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.jsconsole_com": "JSConsole.com",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.a_very_practical_website_to_play_with_javascript_in_a": "A very practical website to play with Javascript in a Console.",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.code_academy_javascript": "Code Academy: Javascript",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.code_academy_s_javascript_course_if_you_want_to_learn":
		"Code Academy's Javascript course - If you want to learn Javascript properly first, Code Academy's refined course will hopefully be more helpful :]",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.adventure_land_s_github": "Adventure Land's Github",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.todo_create_a_gallery_of_player_s_github_repos": "#TODO: Create a gallery of player's Github repos",
	// js/html.js render_useful_links; authored interface text.
	"interface.useful_links.code_beginner_on_discord": "#code_beginner on Discord",
	// js/html.js csearch_logic; authored interface text.
	"interface.csearch_logic.reference": "[REFERENCE]",
	// js/html.js csearch_logic; authored interface text.
	"interface.csearch_logic.article": "[ARTICLE]",
	// js/html.js csearch_logic; authored interface text.
	"interface.csearch_logic.mdn": "[MDN]",
	// js/html.js csearch_logic; authored interface text.
	"interface.csearch_logic.gamedata": "[GAMEDATA]",
	// js/html.js csearch_logic; authored interface text. Parameters: name.
	"interface.csearch_logic.g": "G.{name}",
	// js/html.js csearch_logic; authored interface text.
	"interface.csearch_logic.function": "[FUNCTION]",
	// js/html.js csearch_logic; authored interface text.
	"interface.csearch_logic.none_found": "[NONE FOUND]",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.search": "[SEARCH]",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.available_functions": "Available Functions",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.game_data": "Game Data",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.character_reference": "Character Reference",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.monster_reference": "Monster Reference",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.server_status": "Server Status",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.game_events": "Game Events",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.character_events": "Character Events",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.useful_links": "Useful Links",
	// js/html.js render_code_docs; authored interface text.
	"interface.code_docs.note_code_documentation_is_a_work_in_progress_you_can": "Note: CODE Documentation is a work in progress. You can use Discord/#feedback for ideas/requests.",
	// js/html.js render_others; authored interface text.
	"interface.others.skillbar_and_keymapping": "Skillbar and Keymapping",
	// js/html.js render_others; authored interface text.
	"interface.others.using_boosters": "Using Boosters",
	// js/html.js render_others; authored interface text.
	"interface.others.about_shells": "About Shells",
	// js/html.js render_wishlist; authored interface text.
	"interface.wishlist.wishlist": "Wishlist",
	// js/html.js render_item; authored interface text.
	"interface.item.item": "ITEM",
	// js/html.js render_item; authored interface text.
	"interface.item.alcohol": "Alcohol",
	// js/html.js render_item; authored interface text.
	"interface.item.effect": "Effect",
	// js/html.js render_item; authored interface text.
	"interface.item.name": "Name",
	// js/html.js render_item; authored interface text.
	"interface.item.show": "Show",
	// js/html.js render_item; authored interface text.
	"interface.item.find": "Find",
	// js/html.js render_item; authored interface text.
	"interface.item.gold": "Gold",
	// js/html.js render_item; authored interface text.
	"interface.item.luck": "Luck",
	// js/html.js render_item; authored interface text.
	"interface.item.lifesteal": "Lifesteal",
	// js/html.js render_item; authored interface text.
	"interface.item.manasteal": "Manasteal",
	// js/html.js render_item; authored interface text.
	"interface.item.goldsteal": "Goldsteal",
	// js/html.js render_item; authored interface text.
	"interface.item.evasion": "Evasion",
	// js/html.js render_item; authored interface text.
	"interface.item.avoidance": "Avoidance",
	// js/html.js render_item; authored interface text.
	"interface.item.miss": "Miss",
	// js/html.js render_item; authored interface text.
	"interface.item.reflection": "Reflection",
	// js/html.js render_item; authored interface text.
	"interface.item.d_return": "D.Return",
	// js/html.js render_item; authored interface text.
	"interface.item.crit": "Crit",
	// js/html.js render_item; authored interface text.
	"interface.item.crit_damage": "Crit Damage",
	// js/html.js render_item; authored interface text.
	"interface.item.damage": "Damage",
	// js/html.js render_item; authored interface text.
	"interface.item.type": "Type",
	// js/html.js render_item; authored interface text.
	"interface.item.range": "Range",
	// js/html.js render_item; authored interface text.
	"interface.item.strength": "Strength",
	// js/html.js render_item; authored interface text.
	"interface.item.intelligence": "Intelligence",
	// js/html.js render_item; authored interface text.
	"interface.item.dexterity": "Dexterity",
	// js/html.js render_item; authored interface text.
	"interface.item.vitality": "Vitality",
	// js/html.js render_item; authored interface text.
	"interface.item.fortitude": "Fortitude",
	// js/html.js render_item; authored interface text.
	"interface.item.attack_mp_cost": "Attack MP Cost",
	// js/html.js render_item; authored interface text.
	"interface.item.skill_mp_reduction": "Skill MP Reduction",
	// js/html.js render_item; authored interface text.
	"interface.item.skill_mp_increase": "Skill MP Increase",
	// js/html.js render_item; authored interface text.
	"interface.item.stat": "Stat",
	// js/html.js render_item; authored interface text.
	"interface.item.armor": "Armor",
	// js/html.js render_item; authored interface text.
	"interface.item.a_piercing": "A.Piercing",
	// js/html.js render_item; authored interface text.
	"interface.item.r_piercing": "R.Piercing",
	// js/html.js render_item; authored interface text.
	"interface.item.resistance": "Resistance",
	// js/html.js render_item; authored interface text.
	"interface.item.poison_res": "Poison Res.",
	// js/html.js render_item; authored interface text.
	"interface.item.fire_res": "Fire Res.",
	// js/html.js render_item; authored interface text.
	"interface.item.freeze_res": "Freeze Res.",
	// js/html.js render_item; authored interface text.
	"interface.item.impact_res": "Impact Res.",
	// js/html.js render_item; authored interface text.
	"interface.item.status_res": "Status Res.",
	// js/html.js render_item; authored interface text.
	"interface.item.speed": "Speed",
	// js/html.js render_item; authored interface text.
	"interface.item.a_speed": "A.Speed",
	// js/html.js render_item; authored interface text.
	"interface.item.damage_output": "Damage Output",
	// js/html.js render_item; authored interface text.
	"interface.item.incoming_damage": "Incoming Damage",
	// js/html.js render_item; authored interface text.
	"interface.item.stun": "Stun",
	// js/html.js render_item; authored interface text.
	"interface.item.explosion": "Explosion",
	// js/html.js render_item; authored interface text.
	"interface.item.blast": "Blast",
	// js/html.js render_item; authored interface text.
	"interface.item.breaks": "Breaks",
	// js/html.js render_item; authored interface text.
	"interface.item.charisma": "Charisma",
	// js/html.js render_item; authored interface text.
	"interface.item.awesomeness": "Awesomeness",
	// js/html.js render_item; authored interface text.
	"interface.item.bling": "Bling",
	// js/html.js render_item; authored interface text.
	"interface.item.cuteness": "Cuteness",
	// js/html.js render_item; authored interface text.
	"interface.item.intensity": "Intensity",
	// js/html.js render_item; authored interface text.
	"interface.item.courage": "Courage",
	// js/html.js render_item; authored interface text.
	"interface.item.m_courage": "M.Courage",
	// js/html.js render_item; authored interface text.
	"interface.item.p_courage": "P.Courage",
	// js/html.js render_item; authored interface text.
	"interface.item.grade": "Grade",
	// js/html.js render_item; authored interface text.
	"interface.item.poisonous": "Poisonous",
	// js/html.js render_item; authored interface text.
	"interface.item.cooperative": "Cooperative",
	// js/html.js render_item; authored interface text.
	"interface.item.peaceful": "Peaceful",
	// js/html.js render_item; authored interface text.
	"interface.item.supporter": "Supporter",
	// js/html.js render_item; authored interface text.
	"interface.item.spawns": "Spawns",
	// js/html.js render_item; authored interface text.
	"interface.item.bonus": "Bonus",
	// js/html.js render_item; authored interface text. Parameters: map.
	"interface.item.only": "{map} [Only]",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.only_2": "{value} [Only]",
	// js/html.js render_item; authored interface text.
	"interface.item.kills": "Kills",
	// js/html.js render_item; authored interface text.
	"interface.item.score": "Score",
	// js/html.js render_item; authored interface text.
	"interface.item.max_score": "Max Score",
	// js/html.js render_item; authored interface text.
	"interface.item.base_gold": "Base Gold",
	// js/html.js render_item; authored interface text.
	"interface.item.class": "Class",
	// js/html.js render_item; authored interface text.
	"interface.item.achievements": "Achievements:",
	// js/html.js render_item; authored interface text.
	"interface.item.insight_locked": "Insight: [LOCKED]",
	// js/html.js render_item; authored interface text.
	"interface.item.100_kills_are_needed_to_discover_the_monster_specific_droprates": "100 kills are needed to discover the monster specific droprates.",
	// js/html.js render_item; authored interface text.
	"interface.item.ability": "Ability",
	// js/html.js render_item; authored interface text. Parameters: value, value2.
	"interface.item.stuns_the_opponent_for_seconds_with_chance": "Stuns the opponent for {value} seconds with {value2}% chance.",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.freezes_the_opponent_with_a_chance": "Freezes the opponent with a {value}% chance.",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.poisons_the_opponent_with_a_chance": "Poisons the opponent with a {value}% chance.",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.burns_the_opponent_with_a_chance_deals_damage_over_time": "Burns the opponent with a {value}% chance. Deals damage over time.",
	// js/html.js render_item; authored interface text.
	"interface.item.each_hit_slows_the_opponent_more_and_more": "Each hit slows the opponent more and more.",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.avoid_death_with_a_chance": "Avoid death with a {value}% chance.",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.trigger_a_sugar_rush_on_attack_with_chance_gain_240": "Trigger a Sugar Rush on attack with {value}% chance. Gain 240 Attack Speed for 10 seconds!",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.charm_an_enemy_with_chance_activate_the_ability_from_the": "Charm an enemy with {value}% chance. Activate the ability from the 'SKILLS' system.",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.instead_of_using_mp_skills_restore_2x_the_amount_with": "Instead of using MP, skills restore 2X the amount with {value}% chance.",
	// js/html.js render_item; authored interface text.
	"interface.item.chance": "Chance",
	// js/html.js render_item; authored interface text.
	"interface.item.activate_the_ability_from_the_skills_system": "Activate the ability from the 'SKILLS' system.",
	// js/html.js render_item; authored interface text.
	"interface.item.aura": "Aura",
	// js/html.js render_item; authored interface text.
	"interface.item.amount": "Amount",
	// js/html.js render_item; authored interface text.
	"interface.item.charge": "Charge",
	// js/html.js render_item; authored interface text.
	"interface.item.new_player_xp_ended_at_level_80": "New Player XP ended at level 80.",
	// js/html.js render_item; authored interface text. Parameters: value, value2, value3.
	"interface.item.next_gold_xp_luck": "Next: {value}× Gold, {value2}× XP, {value3}× Luck",
	// js/html.js render_item; authored interface text.
	"interface.item.info": "INFO",
	// js/html.js render_item; authored interface text.
	"interface.item.an_unknown_material_as_in_you_have_no_idea_what": "An unknown material, as in, you have no idea what to do with it!",
	// js/html.js render_item; authored interface text.
	"interface.item.multiplier": "Multiplier",
	// js/html.js render_item; authored interface text.
	"interface.item.set": "Set",
	// js/html.js render_item; authored interface text.
	"interface.item.sealed": "Sealed",
	// js/html.js render_item; authored interface text.
	"interface.item.unsealing": "Unsealing",
	// js/html.js render_item; authored interface text.
	"interface.item.locked": "Locked",
	// js/html.js render_item; authored interface text.
	"interface.item.account_bound": "Account Bound",
	// js/html.js render_item; authored interface text.
	"interface.item.information": "Information",
	// js/html.js render_item; authored interface text.
	"interface.item.exchangeable": "Exchangeable",
	// js/html.js render_item; authored interface text.
	"interface.item.upgradeable": "Upgradeable",
	// js/html.js render_item; authored interface text.
	"interface.item.compoundable": "Compoundable",
	// js/html.js render_item; authored interface text.
	"interface.item.collectable": "Collectable",
	// js/html.js render_item; authored interface text.
	"interface.item.usable": "Usable",
	// js/html.js render_item; authored interface text.
	"interface.item.inspect": "Inspect",
	// js/html.js render_item; authored interface text.
	"interface.item.minutes": "MINUTES:",
	// js/html.js render_item; authored interface text.
	"interface.item.giveaway": "GIVEAWAY!",
	// js/html.js render_item; authored interface text.
	"interface.item.put_up_for_sale": "PUT UP FOR SALE",
	// js/html.js render_item; authored interface text.
	"interface.item.empty_anomaly": "Empty / Anomaly",
	// js/html.js render_item; authored interface text. Parameters: data.
	"interface.item.invalid": "Invalid / {data}",
	// js/html.js render_item; authored interface text.
	"interface.item.buy": "BUY",
	// js/html.js render_item; authored interface text.
	"interface.item.participants": "PARTICIPANTS:",
	// js/html.js render_item; authored interface text.
	"interface.item.join": "JOIN!",
	// js/html.js render_item; authored interface text.
	"interface.item.sell": "SELL",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.gold_2": "{value} GOLD",
	// js/html.js render_item; authored interface text.
	"interface.item.lasts_30_days": "Lasts 30 days",
	// js/html.js render_item; authored interface text. Parameters: cash.
	"interface.item.shells": "{cash} SHELLS",
	// js/html.js render_item; authored interface text.
	"interface.item.you_can_find_shells_from_gems_monsters_in_future_from": "You can find SHELLS from gems, monsters. In future, from achievements.",
	// js/html.js render_item; authored interface text.
	"interface.item.you_can_find_shells_from_gems_monsters_in_future_from_2":
		"You can find SHELLS from gems, monsters. In future, from achievements. For the time being, to receive SHELLS and support our game:",
	// js/html.js render_item; authored interface text.
	"interface.item.buy_or_earn_shells": "BUY or EARN SHELLS",
	// js/html.js render_item; authored interface text.
	"interface.item.tokens": "TOKENS",
	// js/html.js render_item; authored interface text.
	"interface.item.token": "TOKEN",
	// js/html.js render_item; authored interface text. Parameters: value.
	"interface.item.exchange": "EXCHANGE {value}",
	// js/html.js render_item; authored interface text.
	"interface.item.1_token": "[1 TOKEN]",
	// js/html.js render_item; authored interface text.
	"interface.item.exchange_2": "EXCHANGE",
	// js/html.js render_item; authored interface text.
	"interface.item.close": "CLOSE",
	// js/html.js render_item; authored interface text. Parameters: remains.
	"interface.item.days": "{remains} days",
	// js/html.js render_item; authored interface text.
	"interface.item.how_to_use": "HOW TO USE",
	// js/html.js render_item; authored interface text.
	"interface.item.network": "NETWORK",
	// js/html.js render_item; authored interface text.
	"interface.item.trade_history": "TRADE HISTORY",
	// js/html.js render_item; authored interface text.
	"interface.item.unlock": "UNLOCK",
	// js/html.js render_item; authored interface text.
	"interface.item.open": "OPEN",
	// js/html.js render_item; authored interface text.
	"interface.item.drink": "DRINK",
	// js/html.js render_item; authored interface text.
	"interface.item.eat": "EAT",
	// js/html.js render_item; authored interface text.
	"interface.item.use": "USE",
	// js/html.js render_item; authored interface text.
	"interface.item.convert_to_shells": "CONVERT TO SHELLS",
	// js/html.js render_item; authored interface text.
	"interface.item.shift": "SHIFT",
	// js/html.js render_item; authored interface text.
	"interface.item.activate": "ACTIVATE",
	// js/html.js render_item; authored interface text.
	"interface.item.recipe": "Recipe",
	// js/html.js render_item; authored interface text.
	"interface.item.collect": "Collect",
	// js/html.js render_item; authored interface text.
	"interface.item.cost": "Cost",
	// js/html.js render_item; authored interface text.
	"interface.item.dismantles_to": "Dismantles-to",
	// js/html.js render_item; authored interface text.
	"interface.item.server": "Server",
	// js/html.js render_item; authored interface text.
	"interface.item.from": "From",
	// js/html.js render_item; authored interface text.
	"interface.item.count": "Count",
	// js/html.js render_wishlist_item; authored interface text.
	"interface.wishlist_item.wishlist": "Wishlist",
	// js/html.js render_wishlist_item; authored interface text.
	"interface.wishlist_item.level": "LEVEL:",
	// js/html.js render_wishlist_item; authored interface text.
	"interface.wishlist_item.wishlist_2": "WISHLIST",
	// js/html.js render_set; authored interface text. Parameters: rep.
	"interface.set.equipped": "[{rep} Equipped]",
	// js/html.js render_skills; authored interface text.
	"interface.skills.mapping": "MAPPING",
	// js/html.js render_skills; authored interface text.
	"interface.skills.skills": "SKILLS",
	// js/html.js render_skills; authored interface text.
	"interface.skills.emotes": "EMOTES",
	// js/html.js render_skills; authored interface text.
	"interface.skills.abilities": "ABILITIES",
	// js/html.js render_all_skills_and_conditions; authored interface text.
	"interface.all_skills_and_conditions.item_skills": "Item Skills",
	// js/html.js render_all_skills_and_conditions; authored interface text.
	"interface.all_skills_and_conditions.abilities_and_utilities": "Abilities and Utilities",
	// js/html.js render_all_skills_and_conditions; authored interface text.
	"interface.all_skills_and_conditions.buffs": "Buffs",
	// js/html.js render_all_skills_and_conditions; authored interface text.
	"interface.all_skills_and_conditions.debuffs": "Debuffs",
	// js/html.js render_all_skills_and_conditions; authored interface text.
	"interface.all_skills_and_conditions.conditions": "Conditions",
	// js/html.js render_all_skills_and_conditions; authored interface text.
	"interface.all_skills_and_conditions.technical": "Technical",
	// js/html.js render_travel; authored interface text. Parameters: map.
	"interface.travel.npcs_in": "NPCs in {map}",
	// js/html.js render_travel; authored interface text. Parameters: map.
	"interface.travel.monsters_in": "Monsters in {map}",
	// js/html.js render_travel; authored interface text.
	"interface.travel.places": "Places",
	// js/html.js render_travel; authored interface text.
	"interface.travel.close": "CLOSE",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.ah_i_love_the_sea_so_calming_as_a_kid":
		"Ah, I love the sea, so calming. As a kid, I loved spending time on the beach. Collecting seashells. If you happen to find some, I would love to add them to my collection.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.i_have_20": "I HAVE 20!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.yo_dawg_i_can_hook_you_up_with_some_shells": "Yo dawg, I can hook you up with some shells If you want. I get these directly from Wizard in bulk so they are legit.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.hmm_sure": "HMM, SURE...",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.ugh_maybe_go_farm_more_gold_it_s_not_like": "Ugh, maybe go farm more gold. It's not like they grow on trees. Just kill some puny monsters, you'll have plenty!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.please_doing_business_with_you_you_ll_have_your_shells": "Pleasure doing business with you! You'll have your shells in a couple of milliseconds!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.aww_are_you_stuck_here_i_can_take_you_places": "Aww, are you stuck here? I can take you places. If you want!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.teleport": "TELEPORT",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.awww_ty_ty_ty_xoxo": "Awww. Ty. Ty. Ty. Xoxo.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.how_kind_of_you_please_accept_this_small_gift_in": "How kind of you! Please accept this small gift in return.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.it_s_that_time_of_the_day_are_you_in": "It's that time of the day! Are you in?!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.sign_me_up": "SIGN ME UP!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.tavern_a_place_for_adventurers_to_relax_drink_unwind_play":
		"Tavern. A place for adventurers to relax, drink, unwind, play games, wager, challenge each other in friendly games. Currently under construction.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.greetings_looking_for_a_good_deal_on_weapons_and_armor":
		"Greetings! Looking for a good deal on weapons and armor? Then you came to the right place! No one sells better gear than me!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.adventurer_i_can_upgrade_your_weapons_or_armors_combine_3":
		"Adventurer! I can upgrade your weapons or armors. Combine 3 accessories to make a stronger one! Tho, beware, the process isn't perfect. Sometimes the items are ... lost.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.upgrade": "UPGRADE",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.combine": "COMBINE",
	// js/html.js render_interaction; locksmith greeting. "250 big ones" means 250,000 gold, the fee charged by node/server.js locksmith operations. Use a clear equivalent amount, not 250 gold. Unsealing takes two days.
	"interface.interaction.lock_prevents_anything_that_can_destroy_an_item_selling_upgrading":
		"Lock - Prevents anything that can destroy an item, selling, upgrading, you name it! Seal - Locks the item in a way that unlocking it takes two days. Unlock - Frees it. Got it? Good. Cost? 250 big ones.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.lock": "LOCK",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.seal": "SEAL",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.unlock": "UNLOCK",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.de_stat_an_item_give_you_back_the_scrolls_used":
		"De-stat an item. Give you back the scrolls used on the item, as though the item were level 0. Returns the item back to you along with scrolls. Got it? Good. Cost? Depends on the scroll. 10 times the value of the scrolls that will be returned to you.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.de_stat": "DE-STAT",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.i_can_craft_or_dismantle_items_for_you_price_differs": "I can craft or dismantle items for you. Price differs from item to item. Check out my recipes if you are interested!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.recipes": "RECIPES",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.recycling": "RECYCLING",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.craft": "CRAFT",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.dismantle": "DISMANTLE",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.well_hello_there_i_m_wizard_i_made_this_game":
		"Well, Hello there! I'm Wizard, I made this game. Hope you enjoy it. If you have any issues, suggestions, feel free to email me at hello@adventure.land!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.happy_holidays_please_excuse_my_companion_he_is_a_bit":
		"Happy holidays! Please excuse my companion, he is a bit grumpy. If you happen to find any candy canes, that might cheer him up!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.i_have_one": "I HAVE ONE!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.anyone_can_become_a_merchant_and_start_trading_you_only": "Anyone can become a merchant and start trading. You only need a merchant stand to display your items on!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.let_me_buy_one": "LET ME BUY ONE!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.ah_thanks_for_cheering_him_up_here_s_something_for": "Ah! Thanks for cheering him up. Here's something for you in return!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.ewww_ewww_ewww_these_wretched_things_ate_my_earrings_kill": "Ewww. Ewww. Ewww. These wretched things ate my earrings. Kill them, kill them all. Bring my earrings back!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.as_you_wish": "AS YOU WISH",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.you_did_well_here_s_something_left_from_one_of": "You did well. Here's something left from one of my old husbands...",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.you_know_it_gets_boring_in_here_sometimes_i_m": "You know, It gets boring in here sometimes ... I'm looking for some excitement. Uhm, Do you have a Mistletoe?",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.oh_my_i_do": "OH MY, I DO!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.haha_you_thought_i_was_going_to_give_you_a": "Haha! You thought I was going to give you a kiss?! You wish... Take this instead!",
	// js/html.js render_interaction; authored interface text. Parameters: item.
	"interface.interaction.hmm_we_should_decorate_these_trees_i_need_some_ornaments":
		"Hmm. We should decorate these trees. I need some Ornaments tho. If you happen to collect {item} of them, let me know!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.you_got_it": "YOU GOT IT!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.thank_you_here_s_something_in_return": "Thank you! Here's something in return.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.bwahahahahah_cough_ehem_thanks_you_got_a_good_deal_keep":
		"Bwahahahahah *cough* Ehem.. Thanks! You got a good deal. Keep bringing these fragments to me, don't give them to anyone else.",
	// js/html.js render_interaction; authored interface text. Parameters: item.
	"interface.interaction.back_in_the_day_we_had_miners_then_came_the":
		"Back in the day we had miners, then came the moles, they work for free yet retrieving the gems is a challenge. Bring me {item} gem fragments and I can give you something exciting in return, no questions asked.",
	// js/html.js render_interaction; authored interface text. Parameters: item.
	"interface.interaction.i_got": "I GOT {item}!",
	// js/html.js render_interaction; authored interface text. Parameters: item.
	"interface.interaction.hey_hey_hey_what_brings_you_to_this_cold_land":
		"Hey, hey, hey! What brings you to this cold land? I personally love it here, ideal for my work. If you can bring me {item} Leathers, I can give you one of my products in return.",
	// js/html.js render_interaction; authored interface text. Parameters: item.
	"interface.interaction.i_have": "I HAVE {item}!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.here_you_go_enjoy_keep_bringing_leathers_to_me_i": "Here you go! Enjoy! Keep bringing leathers to me, I have a lot to offer!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.leave": "LEAVE",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.hmm_hmm_hmm_can_t_let_you_pass_check_again": "Hmm. hmm. hmm. Can't let you pass. Check again later tho!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.there_s_some_work_going_on_inside_maybe_check_back": "There's some work going on inside. Maybe check back later!",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.hi_dear_the_lottery_tickets_for_this_week_haven_t": "Hi Dear! The lottery tickets for this week haven't arrived yet. Apologies :)",
	// js/html.js render_interaction; authored interface text. Parameters: value.
	"interface.interaction.hello_you_don_t_seem_to_have_an_account_open":
		"Hello! You don't seem to have an account open with me. Would you like to open one? It costs {value} Gold. We hold onto your items forever.",
	// js/html.js render_interaction; authored interface text. Parameters: value.
	"interface.interaction.pay_gold": "PAY {value} GOLD",
	// js/html.js render_interaction; authored interface text. Parameters: value, value2.
	"interface.interaction.hello_you_don_t_seem_to_have_an_account_open_2":
		"Hello! You don't seem to have an account open with me. Would you like to open one? It costs {value} Gold or {value2} Shells. We hold onto your items forever.",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.use_gold": "USE GOLD",
	// js/html.js render_interaction; authored interface text.
	"interface.interaction.use_shells": "USE SHELLS",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.name": "Name",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.level": "Level",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.class": "Class",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.age": "Age",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.status": "Status",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.actions": "Actions",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.active": "ACTIVE",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.friends": "FRIENDS!",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.friend": "+FRIEND",
	// js/html.js load_nearby; authored interface text.
	"interface.load_nearby.there_is_no_one_nearby": "There is no one nearby.",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.you_don_t_have_any_friends_but_it_s_ok":
		"You don't have any friends but it's ok. Hang in there! Be kind to other players, get to know them, then friend them from the 'Nearby' tab. Afterwards, you can see when they are online and where they are.",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.no_one_online": "No one online.",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.name": "Name",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.level": "Level",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.class": "Class",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.status": "Status",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.server": "Server",
	// js/html.js load_friends; authored interface text.
	"interface.load_friends.active": "Active",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.no_one_discoverable": "No one discoverable.",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.name": "Name",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.level": "Level",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.class": "Class",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.age": "Age",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.status": "Status",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.party": "Party",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.kills": "Kills",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.active": "ACTIVE",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.invite": "Invite",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.none": "None",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.you": "You",
	// js/html.js load_server_list; authored interface text.
	"interface.load_server_list.hidden": "Hidden",
	// js/html.js load_merchants; authored interface text.
	"interface.load_merchants.no_merchants_with_a_stand_online": "No merchants with a stand online.",
	// js/html.js load_servers_list; authored interface text.
	"interface.load_servers_list.name": "Name",
	// js/html.js load_servers_list; authored interface text.
	"interface.load_servers_list.action": "Action",
	// js/html.js load_servers_list; authored interface text.
	"interface.load_servers_list.all_merchants": "All Merchants",
	// js/html.js load_servers_list; authored interface text.
	"interface.load_servers_list.show": "Show",
	// js/html.js load_servers_list; authored interface text.
	"interface.load_servers_list.here": "Here",
	// js/html.js load_servers_list; authored interface text.
	"interface.load_servers_list.switch": "Switch",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.name": "Name",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.level": "Level",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.class": "Class",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.status": "Status",
	// js/html.js load_character_list; COM character-table heading and link that opens an offline owned character on the current server in a new tab. Means entering the game, not publishing software. Keep compact for a 120px column.
	"interface.load_character_list.deploy": "Deploy",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.online": "ONLINE",
	// js/html.js load_character_list; inactive text replacing the Deploy link when that character is already online. Keep compact for a 120px column.
	"interface.load_character_list.deployed": "Deployed",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.offline": "OFFLINE",
	// js/html.js load_character_list; authored interface text.
	"interface.load_character_list.hidden": "Hidden",
	// js/html.js load_mainframe_list; authored interface text.
	"interface.load_mainframe_list.connecting_to_mainframe": "Connecting to Mainframe ...",
	// js/html.js load_mainframe_list; authored interface text. Parameters: value.
	"interface.load_mainframe_list.mainframe": "Mainframe: {value}",
	// js/html.js load_mainframe_list; authored interface text. Parameters: value.
	"interface.load_mainframe_list.shells": "{value} Shells",
	// js/html.js load_mainframe_list; authored interface text. Parameters: value, value2.
	"interface.load_mainframe_list.lv": "Lv.{value} {value2}",
	// js/html.js load_mainframe_list; authored interface text.
	"interface.load_mainframe_list.you_don_t_have_any_characters_yet": "You don't have any characters yet.",
	// js/html.js load_mainframe_list; authored interface text.
	"interface.load_mainframe_list.open_mainframe": "OPEN MAINFRAME",
	// js/html.js render_mail; authored interface text.
	"interface.mail.delete": "Delete",
	// js/html.js render_mail; authored interface text.
	"interface.mail.from": "From:",
	// js/html.js render_mail; authored interface text.
	"interface.mail.to": "To:",
	// js/html.js render_mail; authored interface text.
	"interface.mail.subject": "Subject:",
	// js/html.js render_mail; authored interface text.
	"interface.mail.take": "TAKE",
	// js/html.js render_mail; authored interface text.
	"interface.mail.item": "Item:",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.send_mail": "Send Mail",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.cost": "Cost:",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.previous_emails_not_shown": "(Previous emails not shown)",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.end_of_mail": "End of mail.",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.no_mail_yet": "No mail yet.",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.item": "ITEM!",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.from": "From:",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.to": "To:",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.subject": "Subject:",
	// js/html.js load_mail; authored interface text.
	"interface.load_mail.load_more": "Load More",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.global": "Global",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.party": "Party",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.private": "Private",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.all_incoming": "All Incoming",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.previous_messages_not_shown": "(Previous messages not shown)",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.end_of_chat": "End of chat.",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.no_messages_yet": "No messages yet.",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.end_of_messages": "End of messages.",
	// js/html.js load_chat; authored interface text.
	"interface.load_chat.load_more": "Load More",
	// js/html.js load_pvp_list; authored interface text. Parameters: value, value2.
	"interface.load_pvp_list.pwned": "{value} pwned {value2}",
	// js/html.js load_pvp_list; authored interface text.
	"interface.load_pvp_list.noone_pwned_anyone": "Noone pwned Anyone",
	// js/html.js render_com; authored interface text.
	"interface.com.comrades": "Comrades",
	// js/html.js render_com; authored interface text.
	"interface.com.realm": "Realm",
	// js/html.js render_com; authored interface text.
	"interface.com.characters": "Characters [",
	// js/html.js render_com; authored interface text.
	"interface.com.chat": "Chat",
	// js/html.js render_com; authored interface text.
	"interface.com.mail": "Mail [",
	// js/html.js render_com; authored interface text.
	"interface.com.note_the_communicator_is_an_evolving_protoype": "NOTE: The Communicator is an evolving protoype",
	// js/html.js render_com_buttons; authored interface text.
	"interface.com_buttons.friends": "Friends",
	// js/html.js render_com_buttons; authored interface text.
	"interface.com_buttons.nearby": "Nearby",
	// js/html.js render_com_buttons; authored interface text.
	"interface.com_buttons.server": "Server",
	// js/html.js insert_cx_tuners; authored interface text.
	"interface.insert_cx_tuners.up": "UP",
	// js/html.js insert_cx_tuners; authored interface text.
	"interface.insert_cx_tuners.down": "DOWN",
	// js/html.js insert_cx_tuners; authored interface text.
	"interface.insert_cx_tuners.left": "LEFT",
	// js/html.js insert_cx_tuners; authored interface text.
	"interface.insert_cx_tuners.right": "RIGHT",
	// js/html.js render_cgallery; authored interface text.
	"interface.cgallery.no_alternatives": "No Alternatives",
	// js/html.js render_emotes; authored interface text.
	"interface.emotes.emotes": "EMOTES",
	// js/html.js load_class_info; authored interface text.
	"interface.load_class_info.class": "Class:",
	// js/html.js load_class_info; authored interface text.
	"interface.load_class_info.primary_attribute": "Primary Attribute:",
	// js/html.js load_class_info; authored interface text.
	"interface.load_class_info.secondary_attribute": "Secondary Attribute:",
	// js/html.js load_class_info; authored interface text.
	"interface.load_class_info.description": "Description:",
	// js/html.js to_pretty_fraction; compact fallback for a drop chance of at most one in a billion. Legacy English IMPL means practically impossible, not incredible. The chance can be nonzero; use a short native label for a negligible chance.
	"interface.drop_chance.negligible": "IMPL",
	// js/html.js merrit_status_html; authored interface text.
	"interface.merrit_status_html.waiting_for_merrit_s_visit_information": "Waiting for Merrit's visit information.",
	// js/html.js merrit_status_html; authored interface text.
	"interface.merrit_status_html.ready_for_a_parcel_keep_your_stand_open_merrit_must": "Ready for a parcel. Keep your stand open; Merrit must walk within 32px.",
	// js/html.js merrit_receipt_html; authored interface text.
	"interface.merrit_receipt_html.a_little_thank_you_for_keeping_a_shop_in_the": "A little thank-you for keeping a shop in the square and leaving room for the neighbors.",
	// js/html.js anniversary_event_html; authored display label or status.
	"interface.anniversary_event_html.make_a_wish": "Make a Wish",
	// js/html.js anniversary_event_html; authored display label or status.
	"interface.anniversary_event_html.i_kiss_you": "I Kiss You",
	// js/html.js anniversary_event_html; Make a Wish jar acquisition. Preserve Mira and the full item name Anniversary Gift.
	"interface.anniversary_event_html.an_emote_to_keep_craft_its_jar_with_mira_or_find_it_in_a_gift": "An emote to keep. Craft its jar with Mira, or find it in an Anniversary Gift.",
	// js/html.js anniversary_event_html; I Kiss You jar acquisition. Preserve the item name Anniversary Gift; cakes is an ordinary category noun.
	"interface.anniversary_event_html.rewarded_visits_can_drop_its_permanent_jar_cakes_and_gifts_can_hold_it_too":
		"Rewarded visits can drop its permanent jar. Cakes and Anniversary Gifts can hold it too.",
	// js/html.js anniversary_event_status_html; authored display label or status.
	"interface.anniversary_event_status_html.the_featured_player": "the featured player",
	// js/html.js anniversary_event_status_html; authored display label or status.
	"interface.anniversary_event_status_html.round_in_progress": "Round in progress",
	// js/html.js anniversary_event_status_html; authored display label or status.
	"interface.anniversary_event_status_html.waiting_for_a_player": "Waiting for a player",
	// js/html.js anniversary_collection_html; authored display label or status.
	"interface.anniversary_collection_html.missing": "Missing",
	// js/html.js render_event_announcements; authored display label or status.
	"interface.event_announcements.seasonal_event": "SEASONAL EVENT",
	// js/html.js render_event_announcements; authored display label or status.
	"interface.event_announcements.live_event": "LIVE EVENT",
	// js/html.js render_npc; authored display label or status.
	"interface.npc.npc": "NPC",
	// js/html.js render_monster; authored display label or status.
	"interface.monster.aura": "AURA",
	// js/html.js render_monster; authored display label or status.
	"interface.monster.ability": "ABILITY",
	// js/html.js render_monster; authored display label or status.
	"interface.monster.hard": "Hard",
	// js/html.js render_monster; authored display label or status.
	"interface.monster.challenging": "Challenging",
	// js/html.js render_monster; authored display label or status.
	"interface.monster.easy": "Easy",
	// js/html.js render_character; authored display label or status.
	"interface.character.name": "NAME",
	// js/html.js render_character; authored display label or status.
	"interface.character.active": "Active",
	// js/html.js render_gold_npc; authored display label or status.
	"interface.gold_npc.unavailable": "Unavailable",
	// js/html.js render_skill; authored display label or status.
	"interface.skill.character_range": "Character Range",
	// js/html.js render_skill; authored display label or status.
	"interface.skill.pure": "Pure",
	// js/html.js render_skill; authored display label or status.
	"interface.skill.magical": "Magical",
	// js/html.js render_skill; authored display label or status.
	"interface.skill.physical": "Physical",
	// js/html.js render_encouragement_info; authored display label or status.
	"interface.encouragement_info.active": "Active",
	// js/html.js render_encouragement_info; authored display label or status.
	"interface.encouragement_info.unavailable": "Unavailable",
	// js/html.js render_encouragement_info; authored display label or status.
	"interface.encouragement_info.this_bonus_is_not_active": "This bonus is not active.",
	// js/html.js render_item; authored display label or status.
	"interface.item.debuff": "Debuff",
	// js/html.js render_item; authored display label or status.
	"interface.item.dynamic": "Dynamic",
	// js/html.js render_item; authored display label or status.
	"interface.item.pure": "Pure",
	// js/html.js render_item; authored display label or status.
	"interface.item.magical": "Magical",
	// js/html.js render_item; authored display label or status.
	"interface.item.physical": "Physical",
	// js/html.js render_item; authored display label or status.
	"interface.item.run_speed": "Run Speed",
	// js/html.js render_item; authored display label or status.
	"interface.item.high": "High",
	// js/html.js render_item; authored display label or status.
	"interface.item.rare": "Rare",
	// js/html.js render_item; authored display label or status.
	"interface.item.legendary": "Legendary",
	// js/html.js render_item; authored display label or status.
	"interface.item.exalted": "Exalted",
	// js/html.js render_item; authored display label or status.
	"interface.item.bash": "Bash",
	// js/html.js render_item; authored display label or status.
	"interface.item.freeze": "Freeze",
	// js/html.js render_item; authored display label or status.
	"interface.item.poison": "Poison",
	// js/html.js render_item; authored display label or status.
	"interface.item.burn": "Burn",
	// js/html.js render_item; authored display label or status.
	"interface.item.weave": "Weave",
	// js/html.js render_item; authored display label or status.
	"interface.item.second_chance": "Second Chance",
	// js/html.js render_item; authored display label or status.
	"interface.item.sugar_rush": "Sugar Rush",
	// js/html.js render_item; authored display label or status.
	"interface.item.charm": "Charm",
	// js/html.js render_item; authored display label or status.
	"interface.item.restore_mp": "Restore MP",
	// js/html.js load_nearby; authored display label or status.
	"interface.load_nearby.none": "None",
	// js/html.js load_mainframe_list; authored display label or status.
	"interface.load_mainframe_list.mainframe_online": "MAINFRAME ONLINE",
	// js/html.js load_mainframe_list; authored display label or status.
	"interface.load_mainframe_list.mainframe_offline": "MAINFRAME OFFLINE",
	// js/html.js load_mainframe_list; authored display label or status.
	"interface.load_mainframe_list.not_linked": "Not linked",
	// js/html.js load_mainframe_list; authored display label or status.
	"interface.load_mainframe_list.no_active_window": "No active window",
	// js/html.js load_coming_soon; authored display label or status.
	"interface.load_coming_soon.coming_sooner": "Coming Sooner!",
	// js/html.js load_coming_soon; authored display label or status.
	"interface.load_coming_soon.coming_soon": "Coming Soon!",
	// js/html.js load_coming_soon; authored display label or status.
	"interface.load_coming_soon.planned_along_with_achievements_character_statistics_weekly_monthly_leaderboards": "Planned, along with achievements, character statistics, weekly, monthly leaderboards",
	// js/html.js render_merrit_interaction; authored display label or status.
	"interface.merrit_interaction.keep_a_stocked_shop_here_for_two_minutes_and_leave_the_neighbors_room_i_bring_parcels_once_an_hour":
		"Keep a stocked shop here for two minutes and leave the neighbors room. I bring parcels once an hour.",
	// js/html.js render_merrit_interaction; authored display label or status.
	"interface.merrit_interaction.back": "BACK",
	// js/html.js render_merrit_interaction; authored display label or status.
	"interface.merrit_interaction.last_gift": "LAST GIFT",
	// js/html.js merrit_shell_odds_html; authored display label or status.
	"interface.merrit_shell_odds_html.or_more": " or more",
	// Shared close button label; X remains the universal icon.
	"interface.close.button": "CLOSE",
	// Accessible name and tooltip for the shared close control.
	"interface.close.accessible": "Close",
	// Authored confirmation/dismiss button.
	"interface.close.titlecase": "Close",
	// Authored confirmation/dismiss button.
	"interface.close.cancel": "Cancel",
	// Authored confirmation/dismiss button.
	"interface.confirm.yes": "Yes",
	// Jailer full greeting; preserve its playful in-world tone.
	"interface.jailer.boy":
		"Tu-tu-tu. Have you been a bad boy? No worries. The lawmakers must see the potential in you, so instead of getting rid of you, they sent you here. You are free to leave whenever you want. But please don't repeat your mistake.",
	// Jailer full greeting; preserve its playful in-world tone.
	"interface.jailer.girl":
		"Tu-tu-tu. Have you been a bad girl? No worries. The lawmakers must see the potential in you, so instead of getting rid of you, they sent you here. You are free to leave whenever you want. But please don't repeat your mistake.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.another_shop": "another shop",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_npc": "Too close to {name}: stay more than 40px from stationary NPCs.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_stand_close": "Too close to {name}: leave more than 10px between open stands.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_stand_front": "Too close to {name}: leave more than 15px vertically or 10px sideways.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_warming": "Keep this shop in place for {count} more minutes.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_warming.one": "Keep this shop in place for {count} more minute.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_cooldown": "Your account's next parcel can arrive in {count} minutes, when Merrit visits.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_area": "Set up in Mainland's square or southern aisle.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_closed": "Keep your stand open and remain in place.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_listing": "List an item for sale or a buy order you can afford. Giveaways alone do not count.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_inventory": "Make room for a Market Parcel, or unlock a matching stack with space.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_unreachable": "Merrit cannot reach this spot. Move onto the open pavement.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_unavailable": "Visit information is unavailable. Please try again shortly.",
	// Merrit shop-placement feedback; preserve names and distances. name is a shop or NPC name; count is minutes.
	"interface.merrit.reason_waiting": "Waiting for Merrit.",
	// Merrit has not yet delivered a Market Parcel.
	"interface.merrit.no_receipt": "I haven't left you a parcel yet. Keep a shop here for a little while. I'll come by!",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.self.now": "I left you a Market Parcel just now.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.named.now": "I left {name} a Market Parcel just now.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.self.recent": "I left you a Market Parcel a little while ago.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.named.recent": "I left {name} a Market Parcel a little while ago.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.self.today": "I left you a Market Parcel earlier.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.named.today": "I left {name} a Market Parcel earlier.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.self.days": "I left you a Market Parcel the other day.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.named.days": "I left {name} a Market Parcel the other day.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.self.old": "I left you a Market Parcel a while back.",
	// Merrit recalls a delivery. name is an unchanged character name; preserve Market Parcel.
	"interface.merrit.receipt.named.old": "I left {name} a Market Parcel a while back.",
	// Merrit also delivered one SHELL.
	"interface.merrit.receipt_shell": "And a SHELL for luck!",
	// Merrit repeat greeting; name is an unchanged character name. Preserve the item name Market Parcel; translate SHELL consistently with the locale's premium-currency label.
	"interface.merrit.welcome.self.parcel": "Welcome back! I last brought you a Market Parcel. A stocked shop and room for the neighbors — that's worth a visit.",
	// Merrit repeat greeting; name is an unchanged character name. Preserve the item name Market Parcel; translate SHELL consistently with the locale's premium-currency label.
	"interface.merrit.welcome.self.shell": "Welcome back! I last brought you a Market Parcel and 1 SHELL. A stocked shop and room for the neighbors — that's worth a visit.",
	// Merrit repeat greeting; name is an unchanged character name. Preserve the item name Market Parcel; translate SHELL consistently with the locale's premium-currency label.
	"interface.merrit.welcome.named.parcel": "Welcome back! I last brought {name} a Market Parcel. A stocked shop and room for the neighbors — that's worth a visit.",
	// Merrit repeat greeting; name is an unchanged character name. Preserve the item name Market Parcel; translate SHELL consistently with the locale's premium-currency label.
	"interface.merrit.welcome.named.shell": "Welcome back! I last brought {name} a Market Parcel and 1 SHELL. A stocked shop and room for the neighbors — that's worth a visit.",
	// Monster tooltip spawning rule; preserve monster names. count is quantity, interval is milliseconds, percent is health percentage.
	"interface.monster.spawns_interval": "{count} {monster} every {interval}ms",
	// Monster tooltip spawning rule; preserve monster names. count is quantity, interval is milliseconds, percent is health percentage.
	"interface.monster.spawns_threshold": "{count} {monster} at {percent}% HP",
	// Monster tooltip spawning rule; preserve monster names. count is quantity, interval is milliseconds, percent is health percentage.
	"interface.monster.spawns_step": "{count} {monster} every {percent}% HP",
	// Monster tooltip spawning rule; preserve monster names. count is quantity, interval is milliseconds, percent is health percentage.
	"interface.monster.spawns_thresholds": "Spawns {monster} at HP thresholds",
	// Price entry label for one item.
	"interface.price.gold": "GOLD:",
	// Price entry label for each item in a stack.
	"interface.price.gold_each": "GOLD [EACH]:",
	// Encouragement stage label.
	"interface.item.stage": "Stage",
	// Encouragement stage progression value.
	"interface.item.stage_progress": "{stage} of 4",
	// Craft the displayed recipe.
	"interface.recipe.craft": "CRAFT",
	// Exchange the displayed recipe ingredients.
	"interface.recipe.exchange": "EXCHANGE",
	// Anniversary service button; preserve Mira name.
	"interface.anniversary.event_guide": "Event Guide",
	// Anniversary service button; preserve Mira name.
	"interface.anniversary.find_player": "Find Player",
	// Anniversary service button; preserve Mira name.
	"interface.anniversary.visit_mira": "Visit Mira",
	// Anniversary service button; preserve Mira name.
	"interface.anniversary.combine_cake": "Combine Cake",
	// Anniversary service button; preserve Mira name.
	"interface.anniversary.kiss": "I Kiss You",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.time.minutes_left": "{count} minutes left",
	// One minute remains in the anniversary round.
	"interface.time.minutes_left.one": "{count} minute left",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.anniversary.next_round": "Next round in {count} min",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.anniversary.in_bag": "{count} in bag",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.item.unrecognized": "Unrecognized Item",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.item.unrecognized_explanation": "Hmm. Curious.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.currency.shells_description": "Premium currency, can be used to buy cosmetics, extra bank storage, or for account operations like transferring a character.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.currency.gold_description": "Just gold",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.tutorial.first_steps":
		"Welcome to the first step of the tutorial. In this step, we are going to move! Now move your character near the green goos by clicking on the map and walking below the town!",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.tutorial.move_code": "Using the CODE feature. You can use the `move` function, or, the more costly `smart_move` function.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.encouragement.checking": "Checking account activity.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.encouragement.character_limit": "Your linked accounts have 25 or more characters.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.encouragement.expired": "Your first 40 days have ended.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.encouragement.merchant": "Lone Wolf is for your non-merchant character.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.encouragement.another_character": "Another non-merchant character is running.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.encouragement.away": "Return after more than 60 days away to receive Welcome Back.",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.recipes.crafting_and_collecting": "Crafting and Collecting",
	// Confirm deleting a mail message.
	"interface.mail.confirm_delete": "Delete the mail?",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.cosmetics.default_position": " default position",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.cosmetics.move_left": " [move left {pixels}px]",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.cosmetics.move_right": " [move right {pixels}px]",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.cosmetics.move_up": " [move up {pixels}px]",
	// Authored interface sentence or label; names and CODE identifiers remain unchanged.
	"interface.cosmetics.move_down": " [move down {pixels}px]",
	// Displayed purchase price. amount is already formatted.
	"interface.price.amount": "{amount} GOLD",
	// Displayed per-item purchase price. Preserve the existing span markup.
	"interface.price.amount_each": "{amount} GOLD <span style='color: white'>[EACH]</span>",
	// Continue to the next tutorial lesson.
	"interface.tutorial.continue": "CONTINUE",
	// Finish the final tutorial lesson.
	"interface.tutorial.complete": "COMPLETE",
	// Confirm automated travel; preserve NPC/map destination name and smart_move CODE identifier.
	"interface.travel.confirm": "Smart move to {destination}?",
	// Confirm automated travel to a monster; preserve its proper name.
	"interface.travel.confirm_monster": "Smart move to {monster}?",
	// Shared skill cooldown multiplier; skill is the translated skill name.
	"interface.skill.shared_cooldown": "{multiplier}\u00d7 {skill}",
	// Skill range multiplier applied to character range.
	"interface.skill.range_multiplier": "{multiplier}\u00d7 Character Range",
	// Authored event status or cosmetic section label.
	"interface.server.live": "LIVE",
	// Authored event status or cosmetic section label.
	"interface.server.beware": "BEWARE",
	// Authored event status or cosmetic section label.
	"interface.cosmetics.attire": "ATTIRE",
	// Authored event status or cosmetic section label.
	"interface.cosmetics.looks": "looks",
	// Skill tooltip duration and cooldown. count is seconds and may be fractional.
	"interface.time.seconds": "{count} seconds",
	// Skill tooltip duration and cooldown when exactly one second.
	"interface.time.seconds.one": "{count} second",
	// Skill tooltip progression checkpoint. value is a number or percentage; level is the required character level.
	"interface.skill.value_at_level": "{value} (Lv. {level})",
	// Item trade, buy, sell and wishlist quantity control. Keep this quantity abbreviation short.
	"interface.item.quantity_short": "Q:",
	// Informational placeholder shown when clicking the account-bound item's X; unbinding is not implemented.
	"interface.item.unbind_soon": "Unbind the item? [Soon]",
	// Condition tooltip showing how many uses or targets remain.
	"interface.item.count_left": "{count} left",
	// Playful computer sound displayed in the log when its network link is clicked.
	"interface.computer.beep": "Beep. Boop.",
	// Leave the current party through the legacy party widget. This is a party action, not an NPC goodbye.
	"interface.party_old.leave": "LEAVE",
	// Compact presence badge for an automated character. Keep the label short; its internal state remains bot.
	"interface.presence.bot": "BOT",
	// Compact presence badge meaning away from keyboard. A familiar native abbreviation or AFK is appropriate.
	"interface.presence.afk": "AFK",
	// Very short cursed-condition badge next to a character name. English uses the initial C.
	"interface.presence.cursed_short": "C",
	// Very short poisoned-condition badge next to a character name. English uses the initial P.
	"interface.presence.poisoned_short": "P",
	// Compact stunned-condition badge next to a character name.
	"interface.presence.stunned_short": "STUN",
	// Compact button for sending a private message. Choose a clear native abbreviation for Private Message.
	"interface.chat.private_message_short": "PM",
	// Third SKILLS key-mapping tab, containing utility controls such as Escape, Inventory, chat and arrows. English U means Utility. Use a very short native label; the internal page ID U and actual keyboard keys stay unchanged.
	"interface.skills.utility_tab": "U",
	// js/html.js render_cosmetics; very short gravestone appearance selector caption, displayed uppercase. RIP means Rest in Peace; retain it if familiar or choose a compact local equivalent. Quote the same caption in the Cosmetics guide.
	"interface.cosmetics.rip": "RIP",
	// js/html.js render_all_cosmetics (hair); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.hair": "Hairs",
	// js/html.js render_all_cosmetics (hat); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.hat": "Hats",
	// js/html.js render_all_cosmetics (chin); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.chin": "Chins",
	// js/html.js render_all_cosmetics (face); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.face": "Accents",
	// js/html.js render_all_cosmetics (head); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.skin": "Skins",
	// js/html.js render_all_cosmetics (armor) and render_all_items (chest); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.armor": "Armors",
	// js/html.js render_all_cosmetics (body); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.body": "Bodies",
	// js/html.js render_all_cosmetics (character); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.character": "Characters",
	// js/html.js render_all_cosmetics (gravestone); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.gravestone": "Gravestones",
	// js/html.js render_all_cosmetics () and render_all_items (); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.other": "Others",
	// js/html.js render_all_items (helmet); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.helmet": "Helmets",
	// js/html.js render_all_items (pants); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.pants": "Underarmors",
	// js/html.js render_all_items (gloves); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.gloves": "Gloves",
	// js/html.js render_all_items (shoes); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.shoes": "Shoes",
	// js/html.js render_all_items (cape); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.cape": "Capes",
	// js/html.js render_all_items (ring); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.ring": "Rings",
	// js/html.js render_all_items (earring); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.earring": "Earrings",
	// js/html.js render_all_items (amulet); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.amulet": "Amulets",
	// js/html.js render_all_items (belt); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.belt": "Belts",
	// js/html.js render_all_items (orb); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.orb": "Orbs",
	// js/html.js render_all_items (weapon); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.weapon": "Weapons",
	// js/html.js render_all_items (shield); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.shield": "Shields",
	// js/html.js render_all_items (offhand); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.offhand": "Offhands",
	// js/html.js render_all_items (elixir); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.elixir": "Elixirs",
	// js/html.js render_all_items (pot); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.pot": "Potions",
	// js/html.js render_all_items (scroll); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.scroll": "Scrolls",
	// js/html.js render_all_items (exchange); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.exchange": "Exchangeables",
	// js/html.js render_all_items (key); gallery category heading. Translate the category, not the individual item or appearance names.
	"interface.gallery.key": "Keys",
	// js/html.js render_item_info('empty'); title of the existing empty-slot tooltip. It means the slot contains no item. This is a placeholder, not a proper item name. Keep brief.
	"interface.item.empty": "Empty",
	// Same empty-slot tooltip, playful one-line description beneath Empty. All three English words mean nothing; use natural brief local phrasing instead of a forced literal list. Not an error, missing data, or deleted item.
	"interface.item.empty_description": "Nothing, nada, zilch.",
	// js/html.js render_server; compact label below an active boss/event icon, opening that event's guide. This is an event label, not a proper event name. Keep brief and emphatic.
	"interface.server.event": "EVENT!",
};
