// English page catalog. Usage notes protect code, names and dynamic parameters.
module.exports = {
	// Browser signup page and entry button. Creates a NEW Adventure Land account, not a Steam login to an existing account. Keep Steam unchanged.
	"pages.steam_signup.title": "Sign Up with Steam",
	// Browser signup introduction. Steam verifies ownership before the player chooses Adventure Land credentials. Keep Adventure Land and Steam unchanged.
	"pages.steam_signup.intro": "Own Adventure Land on Steam? Verify your purchase to create an account and play in your browser.",
	// Below the browser signup introduction. The game client means the installed desktop application, not the player or browser.
	"pages.steam_signup.client_help": "This feature helps players who have trouble running the game client.",
	// Shown after Steam verification, above the new account email/password form. These are Adventure Land credentials, not Steam credentials.
	"pages.steam_signup.verified": "Steam ownership verified. Choose an email and password for your Adventure Land account.",
	// Invalid, canceled, replayed or expired Steam signup verification. The normal game login session has not expired.
	"pages.steam_signup.failed": "Steam verification failed or expired. Please try again.",
	// Steam says the authenticated Steam account has no active Adventure Land license.
	"pages.steam_signup.not_owned": "This Steam account does not own Adventure Land.",
	// Temporary Steam verification/network failure. No existing account or game login changes.
	"pages.steam_signup.unavailable": "Steam verification is unavailable right now. Please try again later.",
	// htmls/comm.html: Title of the external Hub page. Keep Hub unchanged; {name} is the game name.
	"pages.hub.title": "Hub - {name}",
	// htmls/contents/selection_features.html: Compact tab above the upcoming-content cards, sized like the close control. Use uppercase where supported.
	"pages.contents.selection_features.upcoming": "UPCOMING",
	// htmls/allnotes.html:5; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.allnotes.adventure-land-update-notes": "Adventure Land - Update Notes",
	// htmls/allnotes.html:82; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"last_deploy":"domain.last_deploy|escape"}.
	"pages.allnotes.last-update": "Last Update {last_deploy}",
	// htmls/allnotes.html:81; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.allnotes.update-notes": "Update Notes",
	// htmls/character.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.character.adventure-land": '<a class="gamebutton" href="https://adventure.land">Adventure Land &gt;</a>',
	// htmls/comm.html:151; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.chat": "CHAT",
	// htmls/comm.html:105; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.chats": "CHATS",
	// htmls/comm.html:132; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.command": "COMMAND",
	// htmls/comm.html:14; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"name":"domain.name"}.
	"pages.comm.communicator": "Communicator - {name}",
	// htmls/comm.html:122; Page label prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.from": "From",
	// htmls/comm.html:107; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.hide": "HIDE",
	// htmls/comm.html:130; Communicator spectator button sends o:home to center the view on the observed character's current position. It does not move the character or change their home realm.
	"pages.comm.home-in": "HOME IN",
	// htmls/comm.html:131; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.inventory": "INVENTORY",
	// htmls/comm.html:121; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-character-name": "Character name",
	// htmls/comm.html:102; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-chat": "Chat",
	// htmls/comm.html:110; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-conversations-newest-first": "Conversations, newest first",
	// htmls/comm.html:138; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-email": "Email",
	// htmls/comm.html:107; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-hide-chat": "Hide chat",
	// htmls/comm.html:123; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-message": "Message",
	// htmls/comm.html:139; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-password": "Password",
	// htmls/comm.html:121; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-recipient-character": "Recipient character",
	// htmls/comm.html:122; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.label-sending-character": "Sending character",
	// htmls/comm.html:146; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.login": "LOGIN",
	// htmls/comm.html:152; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.mainframe": "MAINFRAME",
	// htmls/comm.html:112; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.more-chats": "MORE CHATS",
	// htmls/comm.html:106; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.new-pm": "NEW PM",
	// htmls/comm.html:117; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.older-messages": "OLDER MESSAGES",
	// htmls/comm.html:123; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.send": "SEND",
	// htmls/comm.html:121; Page label prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.to": "To",
	// htmls/comm.html:153; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.toggle": "TOGGLE",
	// htmls/comm.html:134; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.comm.x-disconnected": "X Disconnected.",
	// htmls/contents/announcement_email.html:44; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.additionally-adventure-land-is-on-steam-greenlight-would":
		'Additionally, Adventure Land is on Steam Greenlight! Would really appreciate your help: <a style="color: #33BF6D" href="http://steamcommunity.com/sharedfiles/filedetails/?id=821265543"><span style="color: #33BF6D">http://steamcommunity.com/sharedfiles/filedetails/?id=821265543</span></a>',
	// htmls/contents/announcement_email.html:113; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Named parameters (preserve each token exactly): {"_id":"user._id"}.
	"pages.contents.announcement_email.additionally-many-players-requested-access-to-game-s":
		'Additionally, many players requested access to game\'s map editor, I decided to add a place called the "Resort" to the game, where players create their own maps for other players to visit, while the Resort is still in development, the public map editor is live! Here\'s your link: <a style="color: #E86E2C" href="http://adventure.land/map/{_id}_1"><span style="color: #E86E2C">http://adventure.land/map/{_id}_1</span></a>',
	// htmls/contents/announcement_email.html:15; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.anyway-while-we-work-on-the-game-spend":
		"Anyway, while we work on the game, spend these couple of weeks in the Halloween zone, in November, I'm guessing the new content should be ready. I know you all want more adventure, I will do my best to give you more excitement.",
	// htmls/contents/announcement_email.html:145; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.as-another-suggestion-farm-ice-roamer-s-big":
		"As another suggestion, Farm Ice Roamer's, Big Pom Pom's, or Arctic Bee's for \"Essence of Frost\"'s. It's our first crafting material, pretty soon you will be able to craft new weapons with it. As another thing to look forward to, pretty soon, we are going to launch underground tunnels that will house new monsters/bosses with new drops, these tunnels will connect all of Adventure Land together!",
	// htmls/contents/announcement_email.html:28; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.be-really-careful-in-spooky-town-unlike-our": "Be really careful in Spooky Town, unlike our earlier maps and content, Spooky Town can be very hostile!",
	// htmls/contents/announcement_email.html:13; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.check-it-out-it-has-some-new-halloween":
		"Check it out, it has some new halloween themed monsters, unique drops that will become really valuable after the zone closes down, and you can get a lot of candy drops from monsters that you can EXCHANGE for a random reward!",
	// htmls/contents/announcement_email.html:173; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.come-take-a-walk-in-mainland-if-you": "Come take a walk in Mainland if you are feeling nostalgic and join the fight if your CODE is still around!",
	// htmls/contents/announcement_email.html:130; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.defeating-the-wabbit-grants-you-100-luck-for": "Defeating the Wabbit grants you +100% Luck for 24 hours. There's a new Easter themed set too!",
	// htmls/contents/announcement_email.html:176; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.happy-halloween-yours-sincerely-wizard-http-adventure-land":
		'Happy Halloween!<br />\n\t\t\t\t\t\tYours sincerely,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #E86E2C" href="http://adventure.land"><span style="color: #E86E2C">http://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:66; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.happy-new-year-wizard-http-adventure-land":
		'Happy New Year,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #33BF6D" href="http://adventure.land"><span style="color: #33BF6D">http://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:89; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.happy-new-year-wizard-https-adventure-land":
		'Happy New Year,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #33BF6D" href="https://adventure.land"><span style="color: #33BF6D">https://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:169; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.hi-adventurer": "Hi Adventurer!",
	// htmls/contents/announcement_email.html:82; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.if-you-haven-t-visited-the-game-in":
		"If you haven't visited the game in a long time, a lot has changed, but the game is still the same! You can learn more about the event, Grinch, the Festive achievement, new items from the event information section in the top right corner.",
	// htmls/contents/announcement_email.html:171; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.it-s-been-a-long-time-a-lot":
		"It's been a long time, a lot has changed and so much has stayed the same. Biggest change that likely most old players haven't seen is the open sourcing of the game and community contributions. This Halloween the pumpkin bosses have new drops for characters that are in their home servers.",
	// htmls/contents/announcement_email.html:84; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.make-sure-to-visit-our-holiday-tree-outside": "Make sure to visit our Holiday Tree outside the Bank to receive your buff!",
	// htmls/contents/announcement_email.html:61; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.make-sure-to-visit-our-xmas-tree-outside": "Make sure to visit our Xmas Tree outside the Bank to receive your Xmas buff!",
	// htmls/contents/announcement_email.html:32; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.note-you-can-now-play-with-2-characters":
		"Note: You can now play with 2 characters in normal servers and one character in a PVP server freely, going to renovate/ease the dynamics even further soon",
	// htmls/contents/announcement_email.html:11; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.onto-the-subject-of-this-email-the-halloween": "Onto the subject of this email, the HALLOWEEN ZONE!!!",
	// htmls/contents/announcement_email.html:9; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.oragon-in-game-and-jayson-in-real-life":
		"Oragon in game, and Jayson in real life, joined the team to build new maps and improve the content of the game, he has been progressing really well, the new TOWN has been ready for weeks, but we are waiting a bit to re-launch the game with new content, anyway, enough talking.",
	// htmls/contents/announcement_email.html:143; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.our-anniversary-event-is-live-it-s-a":
		"Our Anniversary Event is live! It's a good time to continue playing Adventure Land. Our Anniversary Gifts are global drops. You can start opening (exchanging) the gifts nearing the end of the event.",
	// htmls/contents/announcement_email.html:128; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.our-easter-event-is-live-chase-the-wabbit":
		"Our Easter Event is live! Chase the Wabbit, hunt eggs, craft them into a basket, get lucky with the golden egg, exchange them for rewards. It's an exciting time on Adventure Land!",
	// htmls/contents/announcement_email.html:30; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.our-halloween-inspired-event-starts-today-and-it": "Our Halloween inspired event starts today and It will last 3 weeks!",
	// htmls/contents/announcement_email.html:80; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.our-holiday-season-event-is-live-holiday-season": "Our Holiday Season event is live! Holiday Season drops are global and you can exchange them in Winterland",
	// htmls/contents/announcement_email.html:57; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.our-xmas-event-is-live-xmas-drops-are": "Our Xmas event is live! Xmas drops are global and you can exchange them in Winterland",
	// htmls/contents/announcement_email.html:53; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-2-join-us-on-discord-if-you": "Ps 2. Join us on Discord if you haven't already :]",
	// htmls/contents/announcement_email.html:122; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-2-just-reply-to-this-email-if": "Ps 2. Just reply to this email if you have any questions",
	// htmls/contents/announcement_email.html:72; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-2-we-re-releasing-on-steam-before": "Ps 2. We're releasing on Steam before Xmas!",
	// htmls/contents/announcement_email.html:52; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-increased-the-ornament-drops": "Ps. Increased the ornament drops",
	// htmls/contents/announcement_email.html:121; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-there-is-a-new-npc-near-the": "Ps. There is a new NPC near the Goo's :]",
	// htmls/contents/announcement_email.html:138; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-there-s-a-new-interface-counts-down":
		"Ps. There's a new interface, counts down minutes to the Wabbit spawn, announces Franky/Snowman engagements. Takes you to engagements with smart_move too!",
	// htmls/contents/announcement_email.html:23; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-to-use-the-preview-ultimate-class-abilities": "Ps. To use the preview ultimate class abilities, press R :]",
	// htmls/contents/announcement_email.html:71; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.ps-you-can-freely-use-3-characters-simultaneously": "Ps. You can freely use 3 characters simultaneously now",
	// htmls/contents/announcement_email.html:98; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.red-envelope-s-are-global-drops-they-drop": "Red Envelope's are global drops, they drop a new kind of item, the Dragon Armor.",
	// htmls/contents/announcement_email.html:100; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.the-love-goo-is-back-too-for-the": "The Love Goo is back too for the Valentine's Day.",
	// htmls/contents/announcement_email.html:42; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.the-new-zone-winterland-and-the-xmas-event":
		"The new zone Winterland and the Xmas event is live! Xmas drops are global and you can exchange them in Winterland! This update brings quests, the first orb, actual capes and the first elixir, Eggnog! It's another exciting time for the game.",
	// htmls/contents/announcement_email.html:158; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.there-are-a-lot-of-small-recent-changes":
		"There are a lot of small, recent changes, for example a new party system with individual party shares. Phoenix, Mr. Pumpkin, Mr. Green are now cooperative bosses too. So everyone can contribute to taking them down, and get a decent drop!",
	// htmls/contents/announcement_email.html:59; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.there-are-various-new-xmas-themed-items-ornament": "There are various new Xmas themed items, Ornament Staff, Candy Cane Sword, Angel Wings to name a few.",
	// htmls/contents/announcement_email.html:153; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.turn-emails-on-off": '<a style="color: gray" href="http://adventure.land?section=email"><span style="color: gray">Turn Emails ON/OFF</span></a>',
	// htmls/contents/announcement_email.html:94; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.turn-emails-on-off-you-have-to-login":
		'<a style="color: gray" href="https://adventure.land?section=email"><span style="color: gray">Turn Emails ON/OFF (You have to login to make changes for the time being)</span></a>',
	// htmls/contents/announcement_email.html:160; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.we-re-also-getting-close-to-a-steam": "We're also getting close to a Steam release.",
	// htmls/contents/announcement_email.html:86; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.we-would-love-to-see-you-among-us": "We would love to see you among us,",
	// htmls/contents/announcement_email.html:156; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.what-s-new-we-have-a-new-boss": "What's new? We have a new boss called Franky in Mansion - a cooperative boss, no one has defeated him yet!",
	// htmls/contents/announcement_email.html:26; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.what-s-new-we-have-a-new-map":
		"What's new? We have a new map called Spooky Town, The crafting system has been brewing for some time, make sure to farm some Hawk's ;) Many of the promised and non-launched features will launch before Xmas.",
	// htmls/contents/announcement_email.html:103; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.wish-you-wealth-and-prosperity-wizard-http-adventure":
		'Wish you wealth and prosperity,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #832212" href="http://adventure.land"><span style="color: #33BF6D">http://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:7; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.announcement_email.wizard-here-i-develop-the-game-since-the":
		"Wizard here, I develop the game, since the game launched, with your feedback, I've added Partying, Trade, Merchanting, PVP, The Bank, Item Abilities, Class Abilities, New Classes: Priest, Rogue, Ranger, and a lot more that I can't remember right now, so basically, the core dynamics of the game improved significantly.",
	// htmls/contents/announcement_email.html:35; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.yours-sincerely-wizard-http-adventure-land":
		'Yours sincerely,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #E86E2C" href="http://adventure.land"><span style="color: #E86E2C">http://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:116; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.yours-sincerely-wizard-http-adventure-land-2":
		'Yours sincerely,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #78CFEF" href="http://adventure.land"><span style="color: #78CFEF">http://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:133; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.yours-sincerely-wizard-http-adventure-land-3":
		'Yours sincerely,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #78CFEF" href="https://adventure.land"><span style="color: #78CFEF">http://adventure.land</span></a>',
	// htmls/contents/announcement_email.html:148; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.announcement_email.yours-sincerely-wizard-http-adventure-land-4":
		'Yours sincerely,<br />\n\t\t\t\t\t\tWizard,<br />\n\t\t\t\t\t\t<a style="color: #ED2E2B" href="http://adventure.land"><span style="color: #ED2E2B">http://adventure.land</span></a>',
	// htmls/contents/booster_howto.html:30; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.above-calls-be-used-to-shift-a-booster": '<span style="color: #F4F4F4">&gt;</span> Above calls be used to shift a booster in 0th inventory slot.',
	// htmls/contents/booster_howto.html:5; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.booster_howto.activation-and-usage": "Activation and Usage",
	// htmls/contents/booster_howto.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.after-pressing-the-activate-button-the-booster-item":
		'<span style="color: #F4F4F4">&gt;</span> After pressing the "ACTIVATE" button. The booster item lasts 30 days. The booster item works from a character\'s inventory, it is not equipped or consumed. The effect can be observed from the "STATS" interface. The item can be transfered between characters or sold through merchanting.',
	// htmls/contents/booster_howto.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.booster_howto.boosters": "Boosters",
	// htmls/contents/booster_howto.html:10; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.don-t-loot-chests-keep-the-booster-in": '<span style="color: #F4F4F4">&gt;</span> Don\'t loot chests, keep the Booster in XP mode.',
	// htmls/contents/booster_howto.html:31; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.implementing-the-optimal-strategy-is-left-as-an": '<span style="color: #F4F4F4">&gt;</span> Implementing the optimal strategy is left as an exercise to the reader.',
	// htmls/contents/booster_howto.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.booster_howto.optimal-strategy": "Optimal Strategy",
	// htmls/contents/booster_howto.html:29; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.shift-0-goldbooster": "<span class='label'>shift(0,'goldbooster')</span>",
	// htmls/contents/booster_howto.html:28; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.shift-0-luckbooster": "<span class='label'>shift(0,'luckbooster')</span>",
	// htmls/contents/booster_howto.html:27; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.shift-0-xpbooster": "<span class='label'>shift(0,'xpbooster')</span>",
	// htmls/contents/booster_howto.html:13; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.this-way-you-can-benefit-from-all-3": '<span style="color: #F4F4F4">&gt;</span> This way, you can benefit from all 3 bonuses with 1 stone.',
	// htmls/contents/booster_howto.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.when-there-are-enough-chests-around-shift-the":
		'<span style="color: #F4F4F4">&gt;</span> When there are enough chests around, shift the Booster to Gold mode and loot.',
	// htmls/contents/booster_howto.html:11; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.while-battling-a-boss-shift-the-booster-to": '<span style="color: #F4F4F4">&gt;</span> While battling a boss, shift the Booster to Luck mode.',
	// htmls/contents/booster_howto.html:23; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.you-can-combine-boosters-as-you-combine-accessories":
		'<span style="color: #F4F4F4">&gt;</span> You can combine boosters as you combine accessories. The combination succeeds 100%, however, if you use a "Primordial Essence" for the combination, It triggers a proc-chance routine.',
	// htmls/contents/booster_howto.html:26; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.you-can-use-the-activate-and-shift-functions": '<span style="color: #F4F4F4">&gt;</span> You can use the activate and shift functions in CODE.',
	// htmls/contents/booster_howto.html:24; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.booster_howto.you-start-with-a-12-chance-as-you":
		'<span style="color: #F4F4F4">&gt;</span> You start with a 12% chance, as you succeed, your booster becomes a higher level booster, and the routine internally repeats with half the chance. So you can even receive an +5 booster, instead of an +1!',
	// htmls/contents/character.html:8; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Named parameters (preserve each token exactly): {"type":"character.type|title"}.
	"pages.contents.character.class": "<span style='color:gray'>Class:</span> {type}",
	// htmls/contents/character.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Named parameters (preserve each token exactly): {"level":"character.level"}.
	"pages.contents.character.level": "<span style='color:gray'>Level:</span> {level}",
	// htmls/contents/character.html:7; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Named parameters (preserve each token exactly): {"name":"character.info.name"}.
	"pages.contents.character.name": "<span style='color:gray'>Name:</span> {name}",
	// htmls/contents/character.html:11; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.character.online": "<span style='color:green'>Online</span>",
	// htmls/contents/credits.html:6; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.and-thank-you-for-reading-and-hopefully-for": "And thank you for reading, and hopefully for playing Adventure Land :)",
	// htmls/contents/credits.html:9; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.another-thanks-to-google-cloud-for-providing-us":
		"Another thanks to Google Cloud for providing us startup credits, it really eased my financial burdens during this development stage.",
	// htmls/contents/credits.html:1; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.first-of-all-i-want-to-thank-all":
		"First of all, I want to thank all the players who played the game, provided feedback, endured, shared the joyous moments, kept pushing the game in the right direction.",
	// htmls/contents/credits.html:8; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.i-want-to-also-thank-steam-for-being":
		"I want to also thank Steam for being such an awesome platform, 1+ years now, it has been driving new players in, no advertisements or marketing.",
	// htmls/contents/credits.html:5; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.i-want-to-thank-all-the-developers-artists": "I want to thank all the developers, artists, composers, whose libraries, assets and work I used in Adventure Land.",
	// htmls/contents/credits.html:4; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.i-want-to-thank-ellian-our-freelance-pixel":
		"I want to thank Ellian, our freelance pixel artist, for being the most professional freelancer I've ever worked with. No one is more reliable than you. Adventure Land started with an off-the-shelf 16x16 icon pack, with Ellian, we created a custom 20x20 iconset, with the community we dreamed, Ellian made. Workload-wise, Adventure Land is a small-fish, but through 2 years, he was always there at a moment's notice. To extend our iconset 5-6 items at a time :) If I could do it all over again, maybe for Adventure Land 2, I'd love to create all the tilesets and sprites from scratch with Ellian.",
	// htmls/contents/credits.html:3; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.i-want-to-thank-mark-jayson-lacandula-aka":
		"I want to thank Mark Jayson Lacandula, aka Json, I started working on the game in June 2016, launched very early around August 2016, he was one of the very first players who tried the game after seeing my tiny Adsense Ad. I didn't take him too seriously when he wanted to try my in-house map editor, but shared it with him anyway. After a very short time, he shared the first map he made, at that moment I knew I discovered a rare natural talent. He made all our maps, learned pixel art, extended our tilesets and sprites and kept exploring, he was and is always there, through the good times and the bad times. Game development is no easy task, contrary to popular belief, it's not rewarding, you rarely reap the benefits, up to this point, we didn't reap, but he never quit - so thank you Json. I hope after Adventure Land, you keep on working in the game industry. (Reader: If you are a talent hunter, do reach out to him)",
	// htmls/contents/credits.html:2; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.credits.i-want-to-thank-r-mmorpg-for-being":
		"I want to thank /r/mmorpg for being an open platform for mmorpg enthusiasts, I posted on /r/mmorpg at the end of 2016, and I've been improving and shaping the game with the small early adopter userbase ever since.",
	// htmls/contents/guide.html:131; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.a-piercing-pierce-through-armor": '<span style="color: #f4f4f4">A.Piercing:</span> Pierce through armor.',
	// htmls/contents/guide.html:134; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.abilities": "Abilities",
	// htmls/contents/guide.html:136; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.abilities-are-currently-in-development-you-can-use":
		'<span style="color: #f4f4f4">&gt;</span> Abilities are currently in development. You can use existing abilities via their hotkeys or through CODE.',
	// htmls/contents/guide.html:178; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.about-the-game": "About the Game",
	// htmls/contents/guide.html:163; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.abuse-of-the-limits-is-strictly-forbidden": '<span style="color: #f4f4f4">&gt;</span> Abuse of the "Limits" is strictly forbidden.',
	// htmls/contents/guide.html:33; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.activate-nearest-npc-door": "Activate Nearest NPC/Door",
	// htmls/contents/guide.html:123; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.armor-100-armor-reduces-incoming-physical-damage-by": '<span style="color: #f4f4f4">Armor:</span> 100 Armor reduces incoming physical damage by 10%.',
	// htmls/contents/guide.html:13; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.attack": "Attack",
	// htmls/contents/guide.html:111; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.attributes": "Attributes",
	// htmls/contents/guide.html:54; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.bank": "Bank",
	// htmls/contents/guide.html:176; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.be-careful-in-pvp-it-s-not-for": '<span style="color: #f4f4f4">&gt;</span> Be careful in PVP, It\'s not for everyone.',
	// htmls/contents/guide.html:156; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.chat-commands": "Chat Commands",
	// htmls/contents/guide.html:174; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.chat-isn-t-global-so-stay-close-during": '<span style="color: #f4f4f4">&gt;</span> Chat isn\'t global, so stay close during a conversation.',
	// htmls/contents/guide.html:45; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.close": "Close",
	// htmls/contents/guide.html:78; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.communities-links": "Communities | Links",
	// htmls/contents/guide.html:70; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.compounds": "Compounds",
	// htmls/contents/guide.html:125; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.damage-proportionally-increases-the-attack": '<span style="color: #f4f4f4">Damage:</span> Proportionally increases the attack.',
	// htmls/contents/guide.html:133; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.damage-return-returns-melee-damage": '<span style="color: #f4f4f4">Damage Return:</span> Returns melee damage.',
	// htmls/contents/guide.html:121; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.dexterity-increases-the-attack-speed-run-speed": '<span style="color: #f4f4f4">Dexterity:</span> Increases the attack speed, run speed.',
	// htmls/contents/guide.html:81; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.discord-discord-is-our-most-active-community-ideal":
		'<span style="color: #f4f4f4">&gt;</span> <a href="https://discord.gg/44yUVeU" class="eexternal" target="_blank" style="color: #469ecf; text-decoration: none">Discord:</a> Discord is our most\n\t\t\tactive community, ideal for questions of all kinds and to provide feedback, suggest new ideas. The coding channels are also quite useful.',
	// htmls/contents/guide.html:46; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.dismiss": "Dismiss",
	// htmls/contents/guide.html:162; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.each-person-is-allowed-to-have-a-single": '<span style="color: #f4f4f4">&gt;</span> Each person is allowed to have a single account.',
	// htmls/contents/guide.html:16; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.enter": "Enter",
	// htmls/contents/guide.html:15; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.equip": "Equip",
	// htmls/contents/guide.html:129; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.evasion-evade-physical-attacks": '<span style="color: #f4f4f4">Evasion:</span> Evade physical attacks.',
	// htmls/contents/guide.html:66; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.find-the-npc-that-offers-upgrades-and-compounds":
		'<span style="color: #f4f4f4">&gt;</span> Find the NPC that offers upgrades and compounds in New Town, nearby, there is an NPC that sells scrolls. Weapons, Armors start at +0 and go all the way\n\t\t\tup to +10. +10 is almost impossible. Upgrade items by using upgrade scrolls, there are 3 grades of items, Normal, High and Rare, at first, you will only need the "Upgrade Scroll" that costs\n\t\t\t1,000 gold.',
	// htmls/contents/guide.html:73; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.for-accessories-reaching-a-higher-level-is-more":
		'<span style="color: #f4f4f4">&gt;</span> For accessories, reaching a higher level is more challenging, for an +1 accessory, you need 3x +0 accessories of the same kind, and so on.',
	// htmls/contents/guide.html:85; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.github-our-official-github-houses-the-runner-functions":
		'<span style="color: #f4f4f4">&gt;</span>\n\t\t\t<a href="https://github.com/kaansoral/adventureland_mongodb/blob/main/js/runner_functions.js" class="eexternal" target="_blank" style="color: #469ecf; text-decoration: none">Github:</a> Our\n\t\t\tOfficial Github houses the "runner_functions.js" - which includes all the base CODE functions',
	// htmls/contents/guide.html:19; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.heal": "Heal",
	// htmls/contents/guide.html:168; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.if-anyone-is-breaking-the-rules-just-email":
		'<span style="color: #f4f4f4">&gt;</span> If anyone is breaking the rules, just email a screenshot of the violation to hello@adventure.land',
	// htmls/contents/guide.html:114; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.increases-hp-armor": "Increases HP, Armor.",
	// htmls/contents/guide.html:118; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.increases-mp-resistance": "Increases MP, Resistance.",
	// htmls/contents/guide.html:118; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.intelligence": "Intelligence:",
	// htmls/contents/guide.html:14; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.interact": "Interact",
	// htmls/contents/guide.html:27; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.inventory": "Inventory",
	// htmls/contents/guide.html:165; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.it-s-forbidden-to-automate-the-game-with": '<span style="color: #f4f4f4">&gt;</span> It\'s forbidden to automate the game with anything other than the CODE.',
	// htmls/contents/guide.html:166; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.it-s-forbidden-to-buy-or-sell-items": '<span style="color: #f4f4f4">&gt;</span> It\'s forbidden to buy or sell items, accounts with real money.',
	// htmls/contents/guide.html:164; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.it-s-forbidden-to-use-code-for-violating": '<span style="color: #f4f4f4">&gt;</span> It\'s forbidden to use CODE for violating the game.',
	// htmls/contents/guide.html:48; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.items-inventory": "Items | Inventory",
	// htmls/contents/guide.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.key-mappings": "Key Mappings",
	// htmls/contents/guide.html:41; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard": "Keyboard \\",
	// htmls/contents/guide.html:18; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-1": "Keyboard 1",
	// htmls/contents/guide.html:22; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-2": "Keyboard 2",
	// htmls/contents/guide.html:29; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-c": "Keyboard C",
	// htmls/contents/guide.html:44; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-esc": "Keyboard ESC",
	// htmls/contents/guide.html:32; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-f": "Keyboard F",
	// htmls/contents/guide.html:26; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-i": "Keyboard I",
	// htmls/contents/guide.html:38; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-n": "Keyboard N",
	// htmls/contents/guide.html:35; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.keyboard-r": "Keyboard R",
	// htmls/contents/guide.html:60; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.left-click-to-target-monsters-and-players-press":
		'<span style="color: #f4f4f4">&gt;</span> Left click to target monsters and players. Press the character name between HP and MP bars to target yourself. You can see the properties/items of the\n\t\t\ttargeted entity. You can only target one entity at a time.',
	// htmls/contents/guide.html:144; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.limits": "Limits",
	// htmls/contents/guide.html:158; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.list": '<span style="color: #f4f4f4">&gt;</span> /list',
	// htmls/contents/guide.html:137; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.mage-s-mana-burst-converts-approximately-half-of": '<span style="color: #f4f4f4">Mage\'s Mana Burst:</span> Converts approximately half of the mana to damage.',
	// htmls/contents/guide.html:23; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.mana": "Mana",
	// htmls/contents/guide.html:8; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.mouse-left-click": "Mouse Left Click",
	// htmls/contents/guide.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.mouse-right-click": "Mouse Right Click",
	// htmls/contents/guide.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.move": "Move",
	// htmls/contents/guide.html:100; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.nexusnull-s-unofficial-but-awesome-documentation":
		'<span style="color: #f4f4f4">&gt;</span>\n\t\t\t<a href="https://nexusnull.github.io/adventureland/global.html" class="eexternal" target="_blank" style="color: #469ecf; text-decoration: none"\n\t\t\t\t>NexusNull\'s Unofficial But Awesome Documentation</a\n\t\t\t>',
	// htmls/contents/guide.html:161; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.no-swearing-bullying-or-offensive-nicknames": '<span style="color: #f4f4f4">&gt;</span> No swearing, bullying, or offensive nicknames.',
	// htmls/contents/guide.html:169; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.notes-tips": "Notes / Tips",
	// htmls/contents/guide.html:177; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.please-please-be-kind-to-each-other": '<span style="color: #f4f4f4">&gt;</span> Please, please be kind to each other.',
	// htmls/contents/guide.html:143; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.priest-s-curse-slows-down-the-enemy-amplifies": '<span style="color: #f4f4f4">Priest\'s Curse:</span> Slows down the enemy, amplifies damage taken, reduces attack',
	// htmls/contents/guide.html:132; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.r-piercing-pierce-through-resistance": '<span style="color: #f4f4f4">R.Piercing:</span> Pierce through resistance.',
	// htmls/contents/guide.html:126; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.range-increases-the-attack-range": '<span style="color: #f4f4f4">Range:</span> Increases the attack range.',
	// htmls/contents/guide.html:142; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.ranger-s-supershot-has-an-extreme-range-deals": '<span style="color: #f4f4f4">Ranger\'s Supershot:</span> Has an extreme range, deals 1.5X damage',
	// htmls/contents/guide.html:90; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.reddit-you-can-use-reddit-to-share-things":
		'<span style="color: #f4f4f4">&gt;</span> <a href="https://www.reddit.com/r/adventureland" class="eexternal" target="_blank" style="color: #469ecf; text-decoration: none">Reddit:</a> You can use\n\t\t\tReddit to share things, Discord is more practical for asking quick questions',
	// htmls/contents/guide.html:130; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.reflection-reflect-magical-attacks-back": '<span style="color: #f4f4f4">Reflection:</span> Reflect magical attacks back.',
	// htmls/contents/guide.html:124; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.resistance-100-resistance-reduces-incoming-magical-damage-by": '<span style="color: #f4f4f4">Resistance:</span> 100 Resistance reduces incoming magical damage by 10%.',
	// htmls/contents/guide.html:51; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.right-click-to-equip-and-un-equip-items":
		'<span style="color: #f4f4f4">&gt;</span> Right click to equip and un-equip items. You can drag items within your inventory. When a merchant npc is active, right click the item to see the item\n\t\t\tvalue / sell.',
	// htmls/contents/guide.html:140; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.rogue-s-invis-goes-invisible-and-deals-1": '<span style="color: #f4f4f4">Rogue\'s Invis:</span> Goes invisible and deals 1.25X sneak damage',
	// htmls/contents/guide.html:141; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.rogue-s-poisonous-touch-poison-reduces-healing-and": '<span style="color: #f4f4f4">Rogue\'s Poisonous Touch:</span> Poison reduces healing and attack speed',
	// htmls/contents/guide.html:159; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.rules": "Rules",
	// htmls/contents/guide.html:150; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.servers": "Servers",
	// htmls/contents/guide.html:39; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.show-names-toggle": "Show Names [Toggle]",
	// htmls/contents/guide.html:127; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.speed-increases-the-run-speed": '<span style="color: #f4f4f4">Speed:</span> Increases the run speed.',
	// htmls/contents/guide.html:128; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.stat-becomes-a-main-attribute-with-a-scroll": '<span style="color: #f4f4f4">Stat:</span> Becomes a main attribute with a scroll.',
	// htmls/contents/guide.html:114; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.strength": "Strength:",
	// htmls/contents/guide.html:10; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.target": "Target",
	// htmls/contents/guide.html:30; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.target-your-character": "Target Your Character",
	// htmls/contents/guide.html:57; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.targeting-top-left-corner": "Targeting | Top Left Corner",
	// htmls/contents/guide.html:56; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.the-bank-is-for-storing-items-and-gold": '<span style="color: #f4f4f4">&gt;</span> The Bank is for storing items and gold. The Bank is shared across all your characters!',
	// htmls/contents/guide.html:181; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.the-game-is-in-active-development-there-are":
		'<span style="color: #f4f4f4">&gt;</span> The game is in active development, there are improvements almost every single day. Over time there will be new maps, new dynamics, new challenges, new\n\t\t\titems, new players. Hopefully it will all be very exciting. Feel free to email me at: hello@adventure.land',
	// htmls/contents/guide.html:175; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.there-are-rewards-for-good-suggestions-or-unknown": '<span style="color: #f4f4f4">&gt;</span> There are rewards for good suggestions or unknown bugs.',
	// htmls/contents/guide.html:42; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.toggle-code": "Toggle CODE",
	// htmls/contents/guide.html:94; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.unofficial-starter-guide":
		'<span style="color: #f4f4f4">&gt;</span>\n\t\t\t<a href="https://docs.google.com/document/d/18xG9NaO1mm7cSx7wMIQEtrkGzFHo6WrEE_TZcbeAFnA/edit" class="eexternal" target="_blank" style="color: #469ecf; text-decoration: none"\n\t\t\t\t>Unofficial Starter Guide</a\n\t\t\t>',
	// htmls/contents/guide.html:63; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.upgrades": "Upgrades",
	// htmls/contents/guide.html:20; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.use-hp-potion": "Use HP Potion",
	// htmls/contents/guide.html:36; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.use-main-skill": "Use Main Skill",
	// htmls/contents/guide.html:24; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.guide.use-mp-potion": "Use MP Potion",
	// htmls/contents/guide.html:167; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.violation-of-the-above-rules-might-lead-to":
		'<span style="color: #f4f4f4">&gt;</span> Violation of the above rules might lead to deletion, minimum punishment is jail, usually it\'s a very temporary ban.',
	// htmls/contents/guide.html:122; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.vitality-increases-hp-proportional-to-level": '<span style="color: #f4f4f4">Vitality:</span> Increases HP proportional to level.',
	// htmls/contents/guide.html:138; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.warrior-s-charge-increases-speed-for-approximately-3": '<span style="color: #f4f4f4">Warrior\'s Charge:</span> Increases speed for approximately 3 seconds.',
	// htmls/contents/guide.html:139; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.warrior-s-taunt-taunts-the-enemy-with-a": '<span style="color: #f4f4f4">Warrior\'s Taunt:</span> Taunts the enemy with a higher range [Q]',
	// htmls/contents/guide.html:153; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.you-can-connect-to-any-server-you-want":
		'<span style="color: #f4f4f4">&gt;</span> You can connect to any server you want. Your character is uniform across all servers. If you suddenly get disconnected, It\'s likely because the server is\n\t\t\tupdating. You can usually re-connect in 2-3 minutes.',
	// htmls/contents/guide.html:147; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.you-can-play-the-game-with-3-characters":
		'<span style="color: #f4f4f4">&gt;</span> You can play the game with 3 characters and one merchant simultaneously. These limits are IP based too. So if you are in the same house with multiple\n\t\t\tplayers, you\'ll need to share the allocation. Working on a system to bypass IP limitations for Steam and Mac clients.',
	// htmls/contents/guide.html:76; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.you-can-use-primordial-shard-s-increase-the":
		'<span style="color: #f4f4f4">&gt;</span> You can use "Primordial Shard"s increase the chances of success of both upgrades and compounds, the essence of the shard is absorbed inside the item.',
	// htmls/contents/guide.html:108; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.guide.you-don-t-have-to-be-a-coder":
		"<span style=\"color: #f4f4f4\">&gt;</span> You don't have to be a coder to use the CODE, you don't have to use the CODE to play Adventure Land, but CODE is the highlight of our game, so use it,\n\t\t\ttry to learn a bit of coding too, it can be very fun and it's very useful",
	// htmls/contents/hardcore_guide.html:22; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.beach-office-transport-to-anywhere": '<span style="color: #F4F4F4">&gt;</span> Beach Office: Transport to anywhere',
	// htmls/contents/hardcore_guide.html:13; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.buy-sell-upgrade-exchange-anywhere": '<span style="color: #F4F4F4">&gt;</span> Buy, Sell, Upgrade, Exchange Anywhere!',
	// htmls/contents/hardcore_guide.html:7; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.chaotic-unbalanced-untested": '<span style="color: #F4F4F4">&gt;</span> Chaotic, Unbalanced, Untested',
	// htmls/contents/hardcore_guide.html:11; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.extreme-gold-luck-xp": '<span style="color: #F4F4F4">&gt;</span> Extreme Gold, Luck, XP',
	// htmls/contents/hardcore_guide.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.hardcore-mode": '<span style="color: #C01626">HARDCORE</span> Mode',
	// htmls/contents/hardcore_guide.html:26; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.hardcore-mode-is-experimental-there-is-no-long":
		'<span style="color: #F4F4F4">&gt;</span> Hardcore Mode is experimental, there is no long term progress saving yet, no leaderboards, so if you want to save your progress, show off your achievements, do take screenshots!',
	// htmls/contents/hardcore_guide.html:5; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.no-premium-shop": '<span style="color: #F4F4F4">&gt;</span> No Premium Shop',
	// htmls/contents/hardcore_guide.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.only-1-character-per-ip-player": '<span style="color: #F4F4F4">&gt;</span> Only 1 Character Per IP/Player',
	// htmls/contents/hardcore_guide.html:28; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.please-send-an-email-to-hello-adventure-land":
		'<span style="color: #F4F4F4">&gt;</span> Please send an email to <span style="color: #F4F4F4">hello@adventure.land</span> about your experience in this new mode. I would like to hear about how you view Adventure Land, and whether this new Hardcore mode improves the game for you. When completed, the Hardcore mode will likely be a weekend-only thing. It will start on Friday, end on Sunday. I think there might be a lot of players who find loopholes etc. I\'ve certainly improved some routines to prevent some scenarios. For example, depending on the feedback, I might add an NPC that tells where a certain player is for 10,000,000 gold etc., or, add 1-2 hours of peace time every 3-4 hours.',
	// htmls/contents/hardcore_guide.html:20; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.priest-heal-s-nerfed-to-60": '<span style="color: #F4F4F4">&gt;</span> Priest Heal\'s: Nerfed to 60%',
	// htmls/contents/hardcore_guide.html:27; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.hardcore_guide.provide-feedback": "Provide Feedback",
	// htmls/contents/hardcore_guide.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pure-skills-collaboration": '<span style="color: #F4F4F4">&gt;</span> Pure Skills + Collaboration',
	// htmls/contents/hardcore_guide.html:14; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pve-death-lose-1-level": '<span style="color: #F4F4F4">&gt;</span> PVE Death: Lose 1 level',
	// htmls/contents/hardcore_guide.html:16; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pvp-death-drop-a-slot-item-with-10": '<span style="color: #F4F4F4">&gt;</span> PVP Death: Drop a slot item with ~10% chance',
	// htmls/contents/hardcore_guide.html:17; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pvp-death-drop-an-inventory-item-with-20": '<span style="color: #F4F4F4">&gt;</span> PVP Death: Drop an inventory item with ~20% chance',
	// htmls/contents/hardcore_guide.html:15; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pvp-death-lose-3-levels-to-the-opponent": '<span style="color: #F4F4F4">&gt;</span> PVP Death: Lose 3 levels to the opponent',
	// htmls/contents/hardcore_guide.html:19; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pvp-death-lose-80-of-your-gold": '<span style="color: #F4F4F4">&gt;</span> PVP Death: Lose 80% of your gold',
	// htmls/contents/hardcore_guide.html:18; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.pvp-death-lose-an-inventory-item-with-5": '<span style="color: #F4F4F4">&gt;</span> PVP Death: Lose an inventory item with ~5% chance',
	// htmls/contents/hardcore_guide.html:10; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.server-reset-progress-lost": '<span style="color: #F4F4F4">&gt;</span> Server Reset = Progress Lost',
	// htmls/contents/hardcore_guide.html:8; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.start-from-level-1": '<span style="color: #F4F4F4">&gt;</span> Start From Level 1',
	// htmls/contents/hardcore_guide.html:25; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.hardcore_guide.take-screenshots": "Take Screenshots",
	// htmls/contents/hardcore_guide.html:24; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.tavern-glitched": '<span style="color: #F4F4F4">&gt;</span> Tavern: Glitched',
	// htmls/contents/hardcore_guide.html:21; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.trade-receive-480k-gold-every-64-seconds-in": '<span style="color: #F4F4F4">&gt;</span> Trade: Receive 480K Gold Every 64 Seconds in the Beach Office',
	// htmls/contents/hardcore_guide.html:2; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.hardcore_guide.updated-july-12th": "Updated July 12th",
	// htmls/contents/hardcore_guide.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.warped-drop-rates": '<span style="color: #F4F4F4">&gt;</span> Warped Drop Rates',
	// htmls/contents/hardcore_guide.html:23; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.hardcore_guide.you-have-to-be-within-10-levels-to": '<span style="color: #F4F4F4">&gt;</span> You have to be within 10 levels to engage in PVP',
	// htmls/contents/keymap_guide.html:45; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.advanced-usages": "Advanced Usages",
	// htmls/contents/keymap_guide.html:47; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. The // prefix marks this visible explanatory label as a code comment; translate its prose while keeping ESC and the prefix. The executable example below remains unchanged.
	"pages.contents.keymap_guide.example-code-that-overrides-esc": "<span class='label'>//Example code that overrides ESC</span>",
	// htmls/contents/keymap_guide.html:38; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.items-can-be-mapped-manually-to-keys-or":
		'<span style="color: #F4F4F4">&gt;</span> Items can be mapped manually to keys, or by dragging and dropping an item to a key slot. Pressing that key, activates, uses or equips the item.',
	// htmls/contents/keymap_guide.html:19; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.keymap-and-configuration": "Keymap and Configuration",
	// htmls/contents/keymap_guide.html:20; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.keymap-is-for-mapping-keypresses-to-skills-abilities":
		'<span style="color: #F4F4F4">&gt;</span> Keymap is for mapping keypresses to skills, abilities and actions. Similar to the skillbar, you can change your keymap from Code, and the changes are persisted locally.',
	// htmls/contents/keymap_guide.html:21; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.map-key-1-use-hp": '<span class=\'label\'>map_key("1","use_hp");</span>',
	// htmls/contents/keymap_guide.html:22; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.map-key-2-snippet-say-woohoo": '<span class=\'label\'>map_key("2","snippet","say(\'Woohoo\')");</span>',
	// htmls/contents/keymap_guide.html:43; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.map-key-dot": '<span class=\'label\'>map_key("DOT",{"name":"pure_eval","code":"ping()",keycode:190});</span>',
	// htmls/contents/keymap_guide.html:35; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.map-key-q-snippet-smart-move-winterland-click": '<span class=\'label\'>map_key("Q","snippet","smart_move(\'winterland\')");</span> &lt;- CLICK TO TEST!',
	// htmls/contents/keymap_guide.html:39; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.map-key-space": '<span class=\'label\'>map_key("SPACE",{"name":"stand0","type":"item"});</span>',
	// htmls/contents/keymap_guide.html:23; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.map-key-x-supershot": '<span class=\'label\'>map_key("X","supershot");</span>',
	// htmls/contents/keymap_guide.html:41; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.map-new-keys": "Map New Keys",
	// htmls/contents/keymap_guide.html:29; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.mappable-keys": "Mappable Keys",
	// htmls/contents/keymap_guide.html:37; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.mapping-items": "Mapping Items",
	// htmls/contents/keymap_guide.html:25; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.reset-mappings-defaults-things": "<span class='label clickable'  onclick=\"show_snippet('reset_mappings()')\">reset_mappings();</span> &lt;- DEFAULTS THINGS",
	// htmls/contents/keymap_guide.html:16; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.set-skillbar-1-2-3-4-5-x": '<span class=\'label\'>set_skillbar("1","2","3","4","5","X","Y");</span>',
	// htmls/contents/keymap_guide.html:17; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.set-skillbar-1-2-3-4-5-x-2": '<span class=\'label\'>set_skillbar(["1","2","3","4","5","X","Y"]);</span>',
	// htmls/contents/keymap_guide.html:26; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.show-json-g-skills-click-to-run": "<span class='label'>show_json(G.skills);</span> &lt;- CLICK TO RUN!",
	// htmls/contents/keymap_guide.html:5; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.skillbar-and-configuration": "Skillbar and Configuration",
	// htmls/contents/keymap_guide.html:3; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.skillbar-and-keymap": "Skillbar and Keymap",
	// htmls/contents/keymap_guide.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.skillbar-is-the-small-vertical-bar-you-see":
		'<span style="color: #F4F4F4">&gt;</span> Skillbar is the small vertical bar you see on the right side of the screen, above the game logs. You can configure your skillbar through Code. Changes you make are saved and persisted for your Character, on your system locally.',
	// htmls/contents/keymap_guide.html:33; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.keymap_guide.snippets": "Snippets",
	// htmls/contents/keymap_guide.html:34; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.snippets-are-small-code-pieces-that-are-either":
		'<span style="color: #F4F4F4">&gt;</span> Snippets are small code pieces that are either evaluated inside your own Code, or on a blank runner if your Code isn\'t running.',
	// htmls/contents/keymap_guide.html:24; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.unmap-key-x": "<span class='label'>unmap_key(\"X\");</span>",
	// htmls/contents/keymap_guide.html:42; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.you-can-map-to-unmapped-keys-by-including":
		'<span style="color: #F4F4F4">&gt;</span> You can map to unmapped keys by including the `keycode` argument in your mappings. You can learn keycodes from: <a href="http://keycode.info" class=\'eexternal\' target="_blank" style="color: #469ECF; text-decoration: none">keycode.info</a>',
	// htmls/contents/keymap_guide.html:46; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.keymap_guide.you-can-override-game-s-default-keymappings-add":
		'<span style="color: #F4F4F4">&gt;</span> You can override game\'s default keymappings, add new functionalities to keypresses using the "pure_eval" skill, unlike "snippet", "pure_eval" runs Javascript code inside the game window, so be careful using "pure_eval". You can change any rendered icon to one of your choosing. Ps. There\'s a list of icons in: G.skills.snippet.skins',
	// htmls/contents/login.html:66; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.about-adventure-land": "About Adventure Land",
	// htmls/contents/login.html:18; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.adventure-land-aims-to-generate-revenue-from-digital":
		"Adventure Land aims to generate revenue from digital copy sales, while regular MMORPG's ban automators, we embrace them, and go further to let anyone have 4 characters online, 24/7, freely. We have a lot of costs, so if you can afford it, please consider purchasing the game.",
	// htmls/contents/login.html:68; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.adventure-land-is-an-experimental-indie-mmorpg-anyone":
		"Adventure Land is an experimental Indie <span class='mw'>MMORPG</span>. Anyone can <span class='mw'>CODE</span> up to <span class='mw'>4!</span> characters, let Javascript do the grinding, while you do something productive!",
	// htmls/contents/login.html:83; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.adventure-land-is-open-source-explore-the-code":
		'Adventure Land is <a class="eexternal" href="https://github.com/kaansoral/adventureland_mongodb" target="_blank" rel="noopener"><span class=\'mw\'>OPEN SOURCE</span></a>. Explore the code, learn from it, or help make the world better!',
	// htmls/contents/login.html:39; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.back": "< Back",
	// htmls/contents/login.html:46; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.email": "> Email",
	// htmls/contents/login.html:51; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.forgot-my-password": "> Forgot My Password",
	// htmls/contents/login.html:71; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.gameplay-has-many-aspects-to-it-it-s":
		"Gameplay has many aspects to it. It's <span class='mw'>NON-P2W</span>. You can <span class='mw'>UPGRADE</span> weapons, <span class='mw'>COMBINE</span> accessories, <span class='mw'>EXCHANGE</span> rewards, <span class='mw'>CRAFT</span> items, farm <span class='mw'>GOLD</span>.",
	// htmls/contents/login.html:20; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.have-fun-and-thank-you-for-joining": "Have fun - and thank you for joining!",
	// htmls/contents/login.html:19; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.however-if-you-are-going-to-use-the":
		"However, if you are going to use the game with the intention of learning how to Code, improve yourself, you can freely signup, and play to your hearts desire, without any restrictions! :]",
	// htmls/contents/login.html:42; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.label-email": "Email",
	// htmls/contents/login.html:43; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.label-password": "Password",
	// htmls/contents/login.html:37; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.login": "> Login",
	// htmls/contents/login.html:13; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.login-to-the-game": "> Login to the Game",
	// htmls/contents/login.html:14; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.note-signup-requires-a-purchased-copy": "Note: <span class='gray'>Signup requires a purchased copy</span>",
	// htmls/contents/login.html:55; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"total":"total"}.
	"pages.contents.login.online": "{total} Online!",
	// htmls/contents/login.html:48; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.password": "> Password",
	// htmls/contents/login.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.purchase-on-mac-app-store-live":
		"<a class='cancela' href=\"https://itunes.apple.com/app/adventure-land-code-mmorpg/id1442098247?mt=12\" target=\"_blank\">&gt; Purchase on Mac App Store <span style='color: #85C76B'>[Live!]</span></a>",
	// htmls/contents/login.html:5; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.purchase-on-steam-live":
		"<a class='cancela' href=\"https://store.steampowered.com/app/777150/Adventure_Land__The_Code_MMORPG/\" target=\"_blank\">&gt; Purchase on Steam <span style='color: #85C76B'>[Live!]</span></a>",
	// htmls/contents/login.html:29; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.signup": "> Signup",
	// htmls/contents/login.html:8; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.signup-development-use": "&gt; Signup <span style='color: #2FA6C8'>[Development Use]</span>",
	// htmls/contents/login.html:50; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.signup-or-login": "> Signup or Login",
	// htmls/contents/login.html:44; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.login.start-playing": "Start Playing!",
	// htmls/contents/login.html:77; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.the-economy-is-completely-peer-to-peer-you":
		"The ECONOMY is completely <span class='mw'>PEER-TO-PEER</span>. You can keep your <span class='mw'>MERCHANT</span> open 24/7 to <span class='mw'>SELL</span> or <span class='mw'>BUY</span> stuff.",
	// htmls/contents/login.html:80; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.there-are-a-lot-of-planned-features-like":
		"There are a lot of planned features like <span class='mw'>GUILDS</span> and <span class='mw'>DAILY EVENTS</span>, they are entirely shaped by our community and their feedback!",
	// htmls/contents/login.html:74; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.login.there-are-pvp-maps-with-increased-luck-gold": "There are <span class='mw'>PVP</span> maps with increased LUCK, GOLD, XP.",
	// htmls/contents/opensource.html:11; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.adventure-land-has-a-hardcore-mode-the-drops":
		"<span style=\"color: #F4F4F4\">&gt;</span> Adventure Land has a Hardcore mode, the drops/XP rewards are astronomical, the PVP is brutal. Hardcore servers run only for a day. The resulting gameplay is more engaging, less afk and extremely competitive. I sometimes wonder whether the actual gameplay should be like this too. But, as it is, Adventure Land is at a point of no return too. After a certain point in an MMORPG's life, it's impossible to make such drastic changes.",
	// htmls/contents/opensource.html:14; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.adventure-land-has-been-developed-completely-from-scratch":
		'<span style="color: #F4F4F4">&gt;</span>Adventure Land has been developed completely from scratch, even the map editor is a custom in-house one. The backend uses App Engine with Python, it\'s completely auto scalable. The code is simple and robust. Characters are saved, synced and loaded from the backend. All account operations are on the backend.',
	// htmls/contents/opensource.html:20; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.adventure-land-has-unique-in-house-assets-purchased":
		"<span style=\"color: #F4F4F4\">&gt;</span>Adventure Land has unique/in-house assets, purchased assets and derivatives. When the game is open sourced, it will also be possible to download and copy all the game data, for example the maps. Developers will also have the opportunity to release the game as a sub-entity of Adventure Land. For example, Adventure Land: The Reckoning. This way, if a developer doesn't have the resources to track/purchase all the assets individually, it will be possible to release the game commercially as it will technically be owned by Adventure Land. However it's best to just start from scratch and create everything in-house if possible. It's something I dreamed of but couldn't achieve.",
	// htmls/contents/opensource.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.as-a-roguelike-enthusiast-i-always-dream-of":
		"<span style=\"color: #F4F4F4\">&gt;</span>As a roguelike enthusiast. I always dream of adding roguelike elements to the game. Maybe a dungeon, or a repeatable quest with randomised steps and outcomes. Considering all the effort thats needed to make it meaningful and balanced, these ideas never develop. But starting from scratch, and investing 2-3 months, it's very possible to actually develop a unique and online roguelike game. For example a roguelike that's played with a party of 4.",
	// htmls/contents/opensource.html:19; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.assets-data-and-licensing": "Assets, Data and Licensing",
	// htmls/contents/opensource.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.by-almost-eliminating-the-entry-barrier-to-mmorpg":
		"<span style=\"color: #F4F4F4\">&gt;</span> By almost eliminating the entry barrier to MMORPG development, I hope to give birth to the PUBG of MMORPG's. Where indie developers start by modifying Adventure Land's Code to implement their ideas, unique dynamics and mechanics. Create a working formula. Get investment, make money, crowdfund, develop their idea from scratch and come up with an MMORPG that works.",
	// htmls/contents/opensource.html:21; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.commercial-light-licensing": "Commercial, Light Licensing",
	// htmls/contents/opensource.html:15; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.for-game-servers-node-javascript-and-socket-io":
		"<span style=\"color: #F4F4F4\">&gt;</span>For game servers, Node, Javascript and Socket.io is used. Everything is custom and as simple as possible. Being Javascript, the coding style might not be everyone's cup of tea, yet, anyone with a slight knowledge of Javascript can easily understand what's what and quickly find stuff. For example, the code to buy things is on the `socket.on('buy',function(){})` handler.",
	// htmls/contents/opensource.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.going-open-source": "Going Open Source",
	// htmls/contents/opensource.html:8; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.if-you-read-r-mmorpg-on-reddit-the":
		"<span style=\"color: #F4F4F4\">&gt;</span> If you read /r/MMORPG on Reddit, the discussions have a clear pattern. There are groups of players with different needs and expectations. Due to the hefty time/energy/money requirements of developing an MMORPG, developers usually can't meet their needs. There's no opportunity to just try new things. Most MMORPG's hit once and miss. Smart ones seem to crowdfund.",
	// htmls/contents/opensource.html:17; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.on-the-client-side-of-things-adventure-land":
		'<span style="color: #F4F4F4">&gt;</span>On the Client side of things, Adventure Land uses PIXI to draw things, no game engine is used and everything is as low level as possible. Animating characters, rendered weapons and attack animations is a dream for Adventure Land 2. However if a group of developers invested 3-4 months onto the current codebase, it would truly enhance the gameplay and make the resulting product much more monetizable.',
	// htmls/contents/opensource.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.several-reasons-the-main-reason-is-to-become":
		'<span style="color: #F4F4F4">&gt;</span> Several reasons. The main reason is to become a boilerplate for prospective game developers to easily test and execute their ideas. To let players see what\'s behind the hood and learn from the experience.',
	// htmls/contents/opensource.html:10; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.some-examples": "Some Examples",
	// htmls/contents/opensource.html:7; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.the-dream": "The Dream",
	// htmls/contents/opensource.html:18; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.the-game-clients-use-electron-and-each-has":
		'<span style="color: #F4F4F4">&gt;</span>The game clients use Electron and each has unique integrations. I have plans to develop a Hardcore/Short-lived mobile version too. All of these and the documentations around the game clients will be open sourced too.',
	// htmls/contents/opensource.html:13; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.the-technology": "The Technology",
	// htmls/contents/opensource.html:16; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.using-node-and-javascript-has-enormous-advantages-since":
		"<span style=\"color: #F4F4F4\">&gt;</span>Using Node and Javascript has enormous advantages, since there is no parallelism, coding is easy and there are no loopholes produced from parallel execution scenarios. However, it also caps the size of a single server. With a game like Adventure Land, it can become a feature rather than a bug. As servers can just grow in number such as Europas I, II, III and so on. It would be possible to extend Adventure Land to use multiple servers for a single game world, however, there's no reason to do so, it's best to keep things as simple as possible.",
	// htmls/contents/opensource.html:22; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.opensource.while-the-details-aren-t-set-yet-the":
		"<span style=\"color: #F4F4F4\">&gt;</span> While the details aren't set yet, the game will be open sourced with a custom commercial license. It will be free to use for non-commercial usages. For example to create a local instance/server at home. For commercial derivatives, there will be an expectancy to receive 12.5% from gross income. However, if the game succeeds and gets written from scratch (like pubg growing out of arma) the commercial license won't apply to the new entity. I believe 12.5% is a fair % that developers would be willing to pay. I also plan to promote each derivative from the main game. (It's a dream at this point, hoping it becomes a reality)",
	// htmls/contents/opensource.html:5; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.opensource.why": "Why?",
	// htmls/contents/password_reset.html:31; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.password_reset.new-password": "> New Password",
	// htmls/contents/password_reset.html:33; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.password_reset.repeat-new-password": "> Repeat New Password",
	// htmls/contents/password_reset.html:37; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.password_reset.set": '<span style="color:green">&gt;</span> Set',
	// htmls/contents/payments.html:46; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.payments.10-for-800-shells": '$10 <span style="color: gray">for</span><br />800 <span style="/*color: #6ECF28*/">SHELLS</span>',
	// htmls/contents/payments.html:67; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.payments.100-16-9-280-shells": '$100 <span style="color: gray">[<span style="color: #f3c300">+16%</span>]</span><br />9,280 <span style="/*color: #6ECF28*/">SHELLS</span>',
	// htmls/contents/payments.html:56; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.payments.25-8-2-160-shells": '$25 <span style="color: gray">[<span style="color: #2e6db4">+8%</span>]</span><br />2,160 <span style="/*color: #6ECF28*/">SHELLS</span>',
	// htmls/contents/payments.html:78; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.payments.500-24-49-600-shells": '$500 <span style="color: gray">[<span style="color: #df0024">+24%</span>]</span><br />49,600 <span style="/*color: #6ECF28*/">SHELLS</span>',
	// htmls/contents/payments.html:89; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.payments.about-shells": "About<br />SHELLS",
	// htmls/contents/payments.html:138; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.adventure-land-uses": "Adventure Land uses",
	// htmls/contents/payments.html:177; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.payments.adventure-land-uses-paymentwall-for-alternative-payments-and":
		'Adventure Land uses <a href="https://www.paymentwall.com/en/about-us" target="_blank" style="color: #cfcfcf; text-decoration: none">Paymentwall</a> for alternative payments and offers. There\n\t\t\t\tare various localised payment methods, and offers to receive free SHELLS.',
	// htmls/contents/payments.html:167; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.alternative-payments": "Alternative Payments",
	// htmls/contents/payments.html:108; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.buy-25-with-steam": "Buy $25 with Steam",
	// htmls/contents/payments.html:128; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.cvc": "CVC:",
	// htmls/contents/payments.html:155; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.event-bonus": "Event Bonus:",
	// htmls/contents/payments.html:125; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.expiry": "Expiry:",
	// htmls/contents/payments.html:155; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.extra-shells-with-every-purchase": "Extra Shells with Every Purchase!",
	// htmls/contents/payments.html:119; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.label-name-surname": "Name Surname",
	// htmls/contents/payments.html:130; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.label-optional": "Optional",
	// htmls/contents/payments.html:121; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.number": "Number:",
	// htmls/contents/payments.html:174; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.offers": "Offers",
	// htmls/contents/payments.html:119; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.owner": "Owner:",
	// htmls/contents/payments.html:134; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.pay-25": "Pay $25",
	// htmls/contents/payments.html:132; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.please-login-first": "Please Login First!",
	// htmls/contents/payments.html:130; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.postcode": "Postcode:",
	// htmls/contents/payments.html:160; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.shells-are-adventure-land-s-rare-purchasable-currency":
		"SHELLS are Adventure Land's rare, purchasable currency. Unlike many other games, you can find SHELLS in-game too. They drop from gems and monsters. They are rare.",
	// htmls/contents/payments.html:111; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.steam-handles-the-payment-adventure-land-never-sees": "Steam handles the payment. Adventure Land never sees your payment details.",
	// htmls/contents/payments.html:138; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.stripe": "Stripe",
	// htmls/contents/payments.html:107; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.the-purchase-opens-in-a-steam-checkout-window": "The purchase opens in a Steam checkout window.",
	// htmls/contents/payments.html:162; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.this-creates-equal-opportunities-for-all-players-you":
		"This creates equal opportunities for all players. You can only purchase non-essentials with SHELLS, like cosmetics and extra bank storage, to ensure the game is not pay-to-win.",
	// htmls/contents/payments.html:138; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.to-handle-payments-the-leader-in-payments-processing":
		"to handle payments, the leader in payments\n\t\t\t\tprocessing. Your credit card information never touches Adventure Land's servers.",
	// htmls/contents/payments.html:164; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.payments.you-can-support-adventure-land-s-development-by":
		"You can support Adventure Land's development by buying SHELLS and hopefully enjoy the game more, faster, to your hearts desire!",
	// htmls/contents/privacy.html:15; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.adventure-land-doesn-t-have-a-reliable-way":
		"Adventure Land doesn't have a reliable way to send emails, so it's a players responsibility to keep themselves up-to-date on this privacy policy, but the main theme will never change, Adventure Land is a game with no intention of misusing a players data",
	// htmls/contents/privacy.html:13; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.adventure-land-stores-your-encrypted-password-characters-character":
		"Adventure Land stores your encrypted password, characters, character names, data you provide, your IP (used extensively for the character limits logic), character actions and there are various logs and backups of these data, there's currently no system to delete these logs and backups, but as cloud storage is extremely expensive, I personally want to start deleting them in the future, but couldn't find the time yet",
	// htmls/contents/privacy.html:9; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.adventure-land-uses-cloudflare-for-security-and-filtering":
		"Adventure Land uses Cloudflare for security and filtering, almost all HTTP/S data goes through Cloudflare, so they potentially access every data you provide",
	// htmls/contents/privacy.html:3; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.adventure-land-uses-cookies-for-authentication-and-settings": "Adventure Land uses Cookies for authentication and settings, cookies are stored between HTTP and HTTPS",
	// htmls/contents/privacy.html:7; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.adventure-land-uses-google-analytics-for-statistics": "Adventure Land uses Google Analytics for statistics",
	// htmls/contents/privacy.html:11; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.adventure-land-uses-your-location-data-to-determine": "Adventure Land uses your location data to determine which game server is broadly closer to you",
	// htmls/contents/privacy.html:5; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.due-to-popular-demand-and-technical-challenges-game":
		"Due to popular demand, and technical challenges, game can be played over both HTTP and HTTPS, over HTTP, if you are on a compromised network, your data will be exposed. If you are playing the game from Steam or Mac App Store, the game uses HTTPS by default",
	// htmls/contents/privacy.html:19; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.for-any-questions-hello-adventure-land": "For any questions: hello@adventure.land",
	// htmls/contents/privacy.html:17; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.i-m-an-indie-developer-doing-my-best":
		"I'm an indie developer doing my best to protect my players and meet their needs, but we live in a chaotic world, If you are a regular player reading this, please be careful, while I do everything to protect you and your data (especially more after everything I've experienced since I launched the game, which made me grow more as a developer and a human, at least I hope), nothing is safe on the Internet, always approach things with this fact in mind",
	// htmls/contents/privacy.html:21; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.last-edit-04-12-18": "Last Edit [04/12/18]",
	// htmls/contents/privacy.html:1; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.privacy.this-privacy-policy-explains-how-your-data-is": "This privacy policy explains how your data is used and stored by Adventure Land",
	// htmls/contents/section_buttons.html:17; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.section_buttons.command": "Command",
	// htmls/contents/section_buttons.html:4; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.section_buttons.discord": "Discord!",
	// htmls/contents/section_buttons.html:3; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.section_buttons.docs": "Docs",
	// htmls/contents/section_buttons.html:25; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.section_buttons.reload": "Reload",
	// htmls/contents/section_buttons.html:18; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.section_buttons.settings": "Settings",
	// htmls/contents/section_buttons.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.section_buttons.terms": "Terms+",
	// htmls/contents/selection.html:280; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.1st-character": "> 1st Character:",
	// htmls/contents/selection.html:286; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.2nd-character": "> 2nd Character:",
	// htmls/contents/selection.html:292; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.3rd-character": "> 3rd Character:",
	// htmls/contents/selection.html:342; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.back": "< Back",
	// htmls/contents/selection.html:124; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.change": '<span style="color: green">&gt;</span> Change',
	// htmls/contents/selection.html:101; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.change-email": "Change Email",
	// htmls/contents/selection.html:111; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.change-email-2": '<span style="color: green">&gt;</span> Change Email',
	// htmls/contents/selection.html:99; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.change-password": '<span style="color: #578adf">&gt;</span> Change Password',
	// htmls/contents/selection.html:149; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.character-name": "> Character Name",
	// htmls/contents/selection.html:252; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.character-ops": "> Character Ops",
	// htmls/contents/selection.html:182; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.copy": '<span style="color: green">&gt;</span> Copy',
	// htmls/contents/selection.html:174; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.copy-a-map": '<span style="color: #47bc75">&amp;</span> Copy a Map',
	// htmls/contents/selection.html:87; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.cost-200-shells": "[Cost: 200 SHELLS]",
	// htmls/contents/selection.html:158; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.cost-500-shells": "[Cost: 500 SHELLS]",
	// htmls/contents/selection.html:84; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.create": "Create",
	// htmls/contents/selection.html:187; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.delete": '<span style="color: red">&gt;</span> Delete',
	// htmls/contents/selection.html:331; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.dungeon": "DUNGEON",
	// htmls/contents/selection.html:254; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.edit-maps": "> Edit Maps",
	// htmls/contents/selection.html:249; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.email-and-account": "> Email and Account",
	// htmls/contents/selection.html:97; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.emails-off": '<span style="color: #50bfe1">@</span> Emails: OFF',
	// htmls/contents/selection.html:95; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.emails-on": '<span style="color: #50bfe1">@</span> Emails: ON',
	// htmls/contents/selection.html:117; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.existing-password": "> Existing Password",
	// htmls/contents/selection.html:178; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.from": "> From",
	// htmls/contents/selection.html:334; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.gold": "+GOLD",
	// htmls/contents/selection.html:211; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.if-you-ve-invited-a-friend-through-word":
		"<span style=\"color: #4a8cf5\">%</span> If you've invited a friend through word of mouth, you can get the bonus manually by sending an email to hello@adventure.land with your friend's account\n\t\t\t\t\temail and character name within 2 weeks!",
	// htmls/contents/selection.html:278; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.in-game": "In Game",
	// htmls/contents/selection.html:14; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.label-character-name": "Character Name",
	// htmls/contents/selection.html:128; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.list": "> List",
	// htmls/contents/selection.html:275; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.logout": "> Logout",
	// htmls/contents/selection.html:104; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.logout-everywhere": '<span style="color: #de813a">&gt;</span> Logout Everywhere',
	// htmls/contents/selection.html:333; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.luck": "+LUCK",
	// htmls/contents/selection.html:26; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.mage": "Mage",
	// htmls/contents/selection.html:185; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.map-name": "> Map Name",
	// htmls/contents/selection.html:33; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.merchant": "Merchant",
	// htmls/contents/selection.html:298; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.merchant-2": "> Merchant:",
	// htmls/contents/selection.html:236; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.name": "> Name",
	// htmls/contents/selection.html:109; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.new-email": "> New Email",
	// htmls/contents/selection.html:267; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.new-game-window": "> New Game Window",
	// htmls/contents/selection.html:138; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.new-name": "> New Name",
	// htmls/contents/selection.html:119; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.new-password": "> New Password",
	// htmls/contents/selection.html:240; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.note-if-you-introduced-an-infinite-loop-in":
		"Note: If you introduced an infinite loop in your Code, it will freeze your character the moment it runs. This routine just stops a characters code. For more deeper issues, email\n\t\t\t\thello@adventure.land",
	// htmls/contents/selection.html:300; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.offline": "Offline",
	// htmls/contents/selection.html:271; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.open-inspector": "> Open Inspector",
	// htmls/contents/selection.html:63; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.opt-a": '<span style="color: gray">Opt.</span> A',
	// htmls/contents/selection.html:66; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.opt-b": '<span style="color: gray">Opt.</span> B',
	// htmls/contents/selection.html:72; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.opt-c": '<span style="color: gray">Opt.</span> C',
	// htmls/contents/selection.html:75; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.opt-d": '<span style="color: gray">Opt.</span> D',
	// htmls/contents/selection.html:159; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"_id":"user._id"}.
	"pages.contents.selection.owner-id": "Owner ID: {_id}",
	// htmls/contents/selection.html:24; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.paladin": "Paladin",
	// htmls/contents/selection.html:27; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.priest": "Priest",
	// htmls/contents/selection.html:113; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ps-2-you-can-only-do-this-operation": "Ps 2. You can only do this operation once every 18 hours",
	// htmls/contents/selection.html:114; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ps-3-please-check-the-spam-folder-and": "Ps 3. Please check the spam folder and mark them as not spam :]",
	// htmls/contents/selection.html:112; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ps-changing-the-email-re-sends-the-verification": "Ps. Changing the email re-sends the verification email",
	// htmls/contents/selection.html:133; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ps-the-name-of-your-first-character-becomes": "Ps. The name of your first character becomes your player name",
	// htmls/contents/selection.html:205; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ps-trackers-are-both-ip-and-cookie-based": "Ps. Trackers are both IP and Cookie based. Works when a players visits your link on Web, and Sign Up on Steam or Mac.",
	// htmls/contents/selection.html:106; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ps-you-can-always-email-hello-adventure-land": "Ps. You can always email hello@adventure.land for account issues",
	// htmls/contents/selection.html:141; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.quote": '<span style="color: green">$</span> Quote',
	// htmls/contents/selection.html:31; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.ranger": "Ranger",
	// htmls/contents/selection.html:101; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.re-verify-email": "Re-Verify Email",
	// htmls/contents/selection.html:209; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"rcash":"user.info.rcash or 0"}.
	"pages.contents.selection.received-shells": "Received {rcash} SHELLS!",
	// htmls/contents/selection.html:151; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.receiver-owner-id": "> Receiver Owner ID",
	// htmls/contents/selection.html:153; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.receiver-transfer-auth": "> Receiver Transfer Auth",
	// htmls/contents/selection.html:167; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.rename-a-character": '<span style="color: #8c8c95">%</span> Rename a Character',
	// htmls/contents/selection.html:144; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.rename-character": '<span style="color: gray">%</span> Rename Character',
	// htmls/contents/selection.html:226; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.repeat": "> Repeat",
	// htmls/contents/selection.html:121; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.repeat-new-password": "> Repeat New Password",
	// htmls/contents/selection.html:30; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.rogue": "Rogue",
	// htmls/contents/selection.html:256; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Named parameters (preserve each token exactly): {"sales_bonus":"user.info.sales_bonus or 0"}.
	"pages.contents.selection.sales-bonus": '&gt; Sales Bonus: <span style="color: #37983b">${sales_bonus}</span>',
	// htmls/contents/selection.html:327; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.servers": "Servers",
	// htmls/contents/selection.html:259; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.share-and-recruit": "> Share and Recruit",
	// htmls/contents/selection.html:131; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.sort-characters": '<span style="color: green">&gt;</span> Sort Characters',
	// htmls/contents/selection.html:165; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.sort-characters-2": "Sort Characters",
	// htmls/contents/selection.html:160; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.sort-once-to-receive": "[Sort Once to Receive]",
	// htmls/contents/selection.html:163; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.stop-code": '<span style="color: #47bc75">&amp;</span> Stop Code',
	// htmls/contents/selection.html:238; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.stop-code-2": '<span style="color: red">&amp;</span> Stop Code',
	// htmls/contents/selection.html:273; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.stop-code-3": "> Stop Code",
	// htmls/contents/selection.html:180; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.to": "> To",
	// htmls/contents/selection.html:220; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.toggle": '<span style="color: #63abe4">*</span> Toggle',
	// htmls/contents/selection.html:170; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.toggle-privacy": '<span style="color: #63abe4">*</span> Toggle Privacy',
	// htmls/contents/selection.html:156; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.transfer": '<span style="color: green">&gt;</span> Transfer',
	// htmls/contents/selection.html:168; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.transfer-a-character": '<span style="color: green">$</span> Transfer a Character',
	// htmls/contents/selection.html:160; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.transfer-auth": "Transfer Auth:",
	// htmls/contents/selection.html:249; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.vrfy": "[VRFY]",
	// htmls/contents/selection.html:146; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.warning-use-the-quote-function-to-learn-about": 'Warning: <span style="color: gray">Use the Quote function to learn about the cost</span>',
	// htmls/contents/selection.html:21; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.warrior": "Warrior",
	// htmls/contents/selection.html:193; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.when-new-players-sign-up-after-visiting-one":
		'<span style="color: orange">#</span> When new players sign up after visiting one of your links, they are internally registered as your recruits.',
	// htmls/contents/selection.html:232; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.x-delete": '<span style="color: red">X</span> Delete',
	// htmls/contents/selection.html:169; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.x-delete-a-character": '<span style="color: red">X</span> Delete a Character',
	// htmls/contents/selection.html:175; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection.x-delete-a-map": '<span style="color: red">X</span> Delete a Map',
	// htmls/contents/selection.html:337; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.x-disconnected": "X Disconnected.",
	// htmls/contents/selection.html:331; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.xhardcore": "xHARDCORE",
	// htmls/contents/selection.html:333; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.xp": "+XP",
	// htmls/contents/selection.html:194; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.you-ll-receive-10-from-all-the-shells": "You'll receive 10% from all the SHELLS they find or purchase, and 200 SHELLS when they create their first character!",
	// htmls/contents/selection.html:88; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection.you-ve-reached-the-free-limit-of-8": "You've reached the free limit of 8 characters",
	// htmls/contents/selection.html:208; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"referred":"user.info.referred or 0"}.
	"pages.contents.selection.you-ve-recruited-so-far": "You've recruited {referred} so far.",
	// htmls/contents/selection_characters.html:20; Empty character-slot card, beside a portrait. Use a compact availability label that fits on one short line.
	"pages.contents.selection_characters.available-slot": "Available Slot",
	// htmls/contents/selection_characters.html:20; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection_characters.free-slot": "Free Slot",
	// htmls/contents/selection_characters.html:15; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"level":"characters[c].level"}.
	"pages.contents.selection_characters.lv": "Lv.{level}",
	// htmls/contents/selection_characters.html:31; Opens character creation. This button is only 62px wide; use a short native label such as New or Create that fits on one line.
	"pages.contents.selection_characters.new": "New",
	// htmls/contents/selection_characters.html:28; Compact fixed-width pagination button. Use a short native abbreviation for Page so the label stays on one line; keep 1.
	"pages.contents.selection_characters.page-1": "Page 1",
	// htmls/contents/selection_characters.html:29; Compact pagination button. Match the short Page 1 label; keep 2.
	"pages.contents.selection_characters.page-2": "Page 2",
	// htmls/contents/selection_characters.html:30; Compact pagination button. Match the short Page 1 label; keep 3.
	"pages.contents.selection_characters.page-3": "Page 3",
	// htmls/contents/selection_characters.html:22; Second line of an empty character-slot card beside a portrait. Keep it very short; a native word meaning Empty is suitable.
	"pages.contents.selection_characters.unused": "Unused",
	// htmls/contents/selection_features.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection_features.as-the-game-is-open-sourced-now-new": "As the game is open sourced now, new content and items from community can enrich our game.",
	// htmls/contents/selection_features.html:81; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.selection_features.email-for-anything-hello-adventure-land":
		'Email, for anything: <a target="_blank" class="cancela eexternal" href="mailto:hello@adventure.land" style="color: #33BF6D">hello@adventure.land</a>',
	// htmls/contents/selection_features.html:10; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection_features.open-source-new-horizons": "Open Source + New Horizons",
	// htmls/contents/selection_features.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.selection_features.things-to-look-forward-to": "Things to look forward to",
	// htmls/contents/settings.html:57; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.advanced-settings": "Advanced Settings",
	// htmls/contents/settings.html:136; setting for notices when other players or merchant stands visually cover clickable NPCs. This is visibility, not blocked actions or permissions. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only; ON matches services.npc_obstruction_hint.enabled.
	"pages.contents.settings.blocked-npc-notices-on": 'Notices for covered NPCs: <span class="npc-hints-state" style="color: green">ON</span>',
	// htmls/contents/settings.html:119; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.close-buttons-off": 'Close Buttons: <span style="color: #F54423">OFF</span>',
	// htmls/contents/settings.html:121; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.close-buttons-on": 'Close Buttons: <span style="color: green">ON</span>',
	// htmls/contents/settings.html:152; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.connections-http": "Connections: <span style='color: #F54423'>HTTP</span>",
	// htmls/contents/settings.html:150; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.connections-https": "Connections: <span style='color: green'>HTTPS</span>",
	// htmls/contents/settings.html:129; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.guides-off": "Guides: <span style='color: #F54423'>OFF</span>",
	// htmls/contents/settings.html:131; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.guides-on": "Guides: <span style='color: green'>ON</span>",
	// htmls/contents/settings.html:110; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.if-for-some-reason-webgl-causes-issues-on": "If for some reason WebGL causes issues on your system, you can force the old HTML5 Canvas to be used.",
	// htmls/contents/settings.html:32; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.music-off": "Music: <span style='color: gray'>OFF</span>",
	// htmls/contents/settings.html:34; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.music-on-work-in-progress": "Music: <span style='color: gray'>ON</span> [Work in Progress]",
	// htmls/contents/settings.html:71; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.note-feel-free-to-email-hello-adventure-land":
		'Note: Feel free to email <span style="color: #36B2F8">hello@adventure.land</span> for anything, the game is in development, I love to receive emails and feedback',
	// htmls/contents/settings.html:66; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.open-game-inspector": "Open Game Inspector",
	// htmls/contents/settings.html:99; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.perfect-pixels-off": "Perfect Pixels: <span style='color: #F67D4C'>OFF</span>",
	// htmls/contents/settings.html:97; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.perfect-pixels-on": "Perfect Pixels: <span style='color: green'>ON</span>",
	// htmls/contents/settings.html:56; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.performance-settings": "Performance Settings",
	// htmls/contents/settings.html:90; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.pre-cached-maps-off": "Pre-Cached Maps: <span style='color: #F67D4C'>OFF</span>",
	// htmls/contents/settings.html:92; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.pre-cached-maps-on": "Pre-Cached Maps: <span style='color: green'>ON</span>",
	// htmls/contents/settings.html:94; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.processes-and-caches-the-entire-map-into-memory":
		"Processes and caches the entire map into memory. Afterwards movement and animations are as smooth as possible. Turn off if your machine has low GPU memory or low processing power.",
	// htmls/contents/settings.html:140; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.reset-tutorial": "Reset Tutorial <span style='color: #F7B32F'>[!]</span>",
	// htmls/contents/settings.html:40; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.sfx-off": "SFX: <span style='color: gray'>OFF</span>",
	// htmls/contents/settings.html:42; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.sfx-on-work-in-progress": "SFX: <span style='color: gray'>ON</span> [Work in Progress]",
	// htmls/contents/settings.html:133; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.shows-nearby-info-buttons-for-npcs-shrines-gathering": "Shows nearby INFO buttons for NPCs, shrines, gathering spots, and special places. Event buttons are always shown.",
	// htmls/contents/settings.html:67; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.sign-out-to-main-menu": "Sign Out to Main Menu",
	// htmls/contents/settings.html:7; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.toggle-fullscreen": "Toggle Fullscreen",
	// htmls/contents/settings.html:101; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.turn-off-to-smooth-pixels-more-of-a": "Turn off to smooth pixels. More of a preference rather than a performance setting.",
	// htmls/contents/settings.html:124; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.tutorial-off": "Tutorial: <span style='color: #F54423'>OFF</span>",
	// htmls/contents/settings.html:126; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.tutorial-on": "Tutorial: <span style='color: green'>ON</span>",
	// htmls/contents/settings.html:85; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.weapon-attack-animations-off": "Weapon / Attack Animations: <span style='color: #F54423'>OFF</span>",
	// htmls/contents/settings.html:87; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.weapon-attack-animations-on": "Weapon / Attack Animations: <span style='color: green'>ON</span>",
	// htmls/contents/settings.html:104; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.webgl-auto": "WebGL: <span style='color: green'>AUTO</span>",
	// htmls/contents/settings.html:108; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.webgl-forced": "WebGL: <span style='color: #F7B32F'>FORCED</span>",
	// htmls/contents/settings.html:106; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.webgl-off": "WebGL: <span style='color: #F54423'>OFF</span>",
	// htmls/contents/settings.html:146; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.windows-7-8-network-patch-off": "Windows 7/8 Network Patch: <span style='color: green'>OFF</span>",
	// htmls/contents/settings.html:144; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.settings.windows-7-8-network-patch-on": "Windows 7/8 Network Patch: <span style='color: orange'>ON</span>",
	// htmls/contents/settings.html:156; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.settings.you-need-to-refresh-the-game-for-changes": "You need to refresh the game for changes to be effective.",
	// htmls/contents/shells_info.html:11; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.shells_info.adventure-land-aims-to-cover-operating-costs-and":
		'<span style="color: #F4F4F4">&gt;</span> Adventure Land aims to cover operating costs and generate long-term revenue by selling <a href="https://adventure.land/shells" target="_blank">SHELLS</a> as a premium currency. It will be for cosmetic items, possibly extra bank storage and some rare account operations, like character transfers. <span style=\'color:#D0D0D0\'>Keeping the game non-p2w is a top priority</span>, so SHELLS won\'t affect in-game performance.',
	// htmls/contents/shells_info.html:13; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.shells_info.adventure-land-performs-really-well-on-steam-so":
		'<span style="color: #F4F4F4">&gt;</span> Adventure Land performs really well on Steam so far, as an indie-developer, one of my biggest concerns was being cash positive. If it continues like this, and I hope it does, it might even be possible to introduce cosmetics through in-game achievements and gold only.',
	// htmls/contents/shells_info.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.shells_info.after-steam-early-access": "After Steam Early Access",
	// htmls/contents/shells_info.html:6; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.shells_info.buy-shells-with-steam": "Buy Shells with Steam",
	// htmls/contents/shells_info.html:10; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.shells_info.original-plan": "Original Plan",
	// htmls/contents/shells_info.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.shells_info.shells": "SHELLS",
	// htmls/contents/shells_info.html:8; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.shells_info.where-to-find": "Where to Find",
	// htmls/contents/shells_info.html:9; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.contents.shells_info.you-can-get-shells-by-farming-green-goo":
		'<span style="color: #F4F4F4">&gt;</span> You can get shells by farming green Goo\'s, from exchangeable items as rare rewards and through various other hidden and non-hidden ways in-game.',
	// htmls/contents/terms.html:11; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.breaking-the-rules-usually-result-in-temporary-bans":
		"Breaking the rules usually result in temporary bans, don't be afraid to try new things, as long as you mean well, there won't be any consequences",
	// htmls/contents/terms.html:13; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.have-fun": "Have fun",
	// htmls/contents/terms.html:9; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.offensive-or-insensitive-nicknames-are-forbidden": "Offensive or insensitive nicknames are forbidden",
	// htmls/contents/terms.html:7; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.selling-items-gold-etc-with-real-money-is":
		"Selling items, gold etc. with real money is forbidden, don't waste your money, but maybe buy 1-2 cosmetic items to support the game :)",
	// htmls/contents/terms.html:3; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.the-secondary-rule-is-to-not-abuse-the":
		"The secondary rule is to not abuse the game, you can do pretty much everything with Code, and the game, we are even exploring allowing non-UI botting, but, please don't DDOS the game, or intentionally abuse bugs you find. We have lucrative bug bounties",
	// htmls/contents/terms.html:1; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.there-s-one-non-breakable-main-rule-you":
		"There's one non-breakable main rule, you can't upset, bully, or sadden other players - Adventure Land thrives on being a positive game with a positive community. When you treat other players with love and respect, they'll treat you that way too!",
	// htmls/contents/terms.html:5; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.contents.terms.third-rule-is-to-respect-the-character-limits":
		"Third rule is to respect the character limits, maintaining the game is beyond imagination costly, almost non-feasable, If everyone respects the limits, we won't be needing to add irritating captchas etc. to keep playing. While you might easily use a VPN or server to play with additional characters, please don't (It has been done in the past, at 2+ accounts, it usually gets noticed fast, you'll only force me to divert my time and energy into battling multiple accounts, please don't)",
	// htmls/disclaimers.html:85; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.12-11-16-revised-14-11-16": '[12/11/16] <span style="float:right">Revised [14/11/16]</span>',
	// htmls/disclaimers.html:87; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.however-sadly-i-recently-learned-why-most-people":
		"However, sadly, I recently learned why most people don't take such an open approach and why I might be mistaken. The reason is, it's hard to satisfy everyone, and repeated negative feedback is highly demotivating, even if it comes from 5%, while 95% are happy.",
	// htmls/disclaimers.html:96; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.i-genuinely-try-my-best-to-make-the":
		"I genuinely try my best to make the game better every single day, 24/7, I wake up with game and sleep with the game, yet, It's an on-going process, It's not perfect, I'm not perfect. If you are not ok. with these, this game might not be for you.",
	// htmls/disclaimers.html:88; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.i-ve-also-upset-some-players-after-i":
		"I've also upset some players after I reduced the character limit from 3 to 2+1+1, I mean, come on, which game lets you login with 4 characters at once? Just party and collaborate with others.",
	// htmls/disclaimers.html:5; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.it-is-what-it-is": "It Is What It Is",
	// htmls/disclaimers.html:90; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.the-game-is-code-to-win-probably-the":
		"<span class=\"feature\">The Game is Code to Win.</span> Probably the first of it's kind too. And I'm proud of it. Instead of losing hours playing the game, let machines do the hard work for you. Enjoy the good, fun parts of the game, let CODE do the grinding. While CODE is ENGAGE'd, go do something productive instead, read a book, do your work, study. 2M+ gold from one character a day not enough for you? Login with a second character, party them. Want to do more? Learn how to CODE, use and learn from CODE's of other players.",
	// htmls/disclaimers.html:94; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.the-game-is-ever-changing-you-have-to":
		'<span class="feature">The Game is Ever Changing.</span> You have to adapt to changes, your Code needs to adapt to changes, and most importantly, the game will evolve and adapt to changes.',
	// htmls/disclaimers.html:95; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.the-game-is-not-for-everyone-honestly-i":
		"<span class=\"feature\">The Game is Not for Everyone.</span> Honestly, I built the game to provide a unique, simple and concentrated MMORPG Experience. It's something new. It's not for everyone. In my humble opinion. The game provides 30-60 days of fun. This is my objective. Don't see the game as a grand/perfect project. Yes it's grand for me, I will continue to support and improve the game for a long long time, but for a regular player, it should stop being fun after a while. If you are at that point, Thank you so much for being a part of our journey, and I hope the game contributed a lot to you, both socially and intellectually.",
	// htmls/disclaimers.html:91; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.the-game-is-pay-to-win-the-game":
		"<span class=\"feature\">The Game is Pay to Win.</span> The game is currently pay to win, I'm considering removing micro-transactions altogether, yet I don't know how I could afford the servers in the long run, having a micro-transaction system seems to be the only way. It's either a subscription-based system like WoW, or a free-to-play game (as in, there are no recurring fee's or subscriptions) + micro-transactions. While the game is still in development, my choice is micro-transactions. Those who can afford to support the game, should have bonuses. This is my stance. I did my best to shape the game so everything is possible without paying a dime, you can buy all premium items from trade with gold, the game even provides shells (our premium currency) from monsters and chests. What else can I do? Nothing. I need to pay my bills, I need to amortise my costs, and I want to make a profit.",
	// htmls/disclaimers.html:93; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.the-game-is-unfair-those-who-code-better":
		'<span class="feature">The Game is Unfair.</span> Those who CODE better will always beat you, Those who Trade better will always beat you, Those who supported the game might be level 67 while you are level 65. Those who bought a stone might have 3 characters while you have 2. The game is unfair that way. Minor Suggestion: Form a party, Form a guild, There is always a way ...',
	// htmls/disclaimers.html:89; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.tl-dr-i-ve-come-to-terms-with":
		"<span class=\"feature\">TL;DR:</span> I've come to terms with the fact that I can't satisfy everyone, I also can't deal with backlash, I am personally weak that way, I care, It gets to me, so I decided to make some pre-confessions, to not lose any more time with issues like these and just share a link to this page whenever I receive any non-constructive negative feedback.",
	// htmls/disclaimers.html:88; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.today-i-lost-an-entire-day-dealing-with": "Today, I lost an entire day dealing with petty drama. It should have been a joyful day, with the launch of our new Merchant class.",
	// htmls/disclaimers.html:86; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.when-it-comes-to-development-i-have-a":
		"When it comes to development, I have a hands-on approach. I love building a community around the game, I love interacting with players, I love receiving feedback and I shape the game according to demands of the playerbase. Which is how it should always be.",
	// htmls/disclaimers.html:97; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.disclaimers.wizard": "Wizard",
	// htmls/disclaimers.html:92; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.disclaimers.you-can-t-get-everything-you-want-while":
		'<span class="feature">You Can\'t Get Everything You Want.</span> While the game is more free than any other game out there, especially with Code and capabilities around Code, there are limits too. We have rules too. There is always a line. Not all requests are feasible. There are trade-offs that needs to be made. Servers have their limitations. People have their limitations. I have my limitations.',
	// htmls/docs.html:12; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.docs.back": "< Back",
	// htmls/docs.html:23; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.docs.code-docs": "<span style='color: #78C13F'>&gt;</span> CODE Docs  <span style='color: #78C13F'>&lt;</span>",
	// htmls/docs.html:20; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.docs.game-guide": "<span style='color: #9083BC'>&gt;</span> Game Guide <span style='color: #9083BC'>&lt;</span>",
	// htmls/docs.html:24; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.docs.other-systems": "<span style='color: #F0D748'>&gt;</span> Other Systems  <span style='color: #F0D748'>&lt;</span>",
	// htmls/drmfree.html:97; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.a-sacrifice-making-a-game-drm-free-is":
		"<span class=\"feature\">A Sacrifice</span> Making a game DRM-Free is a sacrifice, those who abuse such a system, both hurt the game makers and worse yet hurt those who play the game. If you are a game maker reading this. I suggest you DRM your game, or at least give the illusion that you DRM'ed your game and things can be DRM'ed (they can't).",
	// htmls/drmfree.html:115; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.adventure-land-will-hopefully-stay-drm-free-i":
		"<span class=\"feature\">Adventure Land</span> will hopefully stay DRM-Free, I'll try to keep it as it is, but it doesn't mean it lets any account do whatever it wants. The \"Limits Enforcer\" system will get more strict in the future. Also it's likely that the game has responses in place that give delayed or periodic responses. So if you are a fresh tester, you'll likely not discover them until you attempt to run a scheme 24/7.",
	// htmls/drmfree.html:88; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.and-yes-it-makes-the-game-open-to":
		'<span class="feature">And yes, it makes the game open to abuse, it\'s a sacrifice.</span> This issue comes up a lot, so I decided to write an article about it, explaining the reasoning, potential loopholes, potential issues - and give insight.',
	// htmls/drmfree.html:112; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.bonus-intentions-and-analysis-i-do-intend-to":
		"<span class=\"feature\">(Bonus) Intentions and Analysis</span> I do intend to make things more strict in the future. I don't judge the 70% who have a different world view. I'm here to serve as a developer. And honestly, making things more strict => more money => a better quality game. So in a way it's nice that the majority actually wants more restrictions. It won't be DRM-level, but abuse protection will definitely get more strict. I'm also glad I wasn't naive enough to launch the game with a \"Free Educational Sign-Up\". I now suspect that it would just halve the sales and enrage the general playerbase. It's also important to note that Adventure Land has the most positive playerbase any player has ever seen. Everyone helps each other, there's minimal flaming and so on. So if you are a game developer reading this, the logical thing to do is to just DRM your game, restrict your game and move on with your life, it seems to me that no one cares about the sacrifices, they just hurt you and your game/community.",
	// htmls/drmfree.html:109; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.bonus-the-free-mis-perception-whenever-a-regular":
		'<span class="feature">(Bonus) The Free Mis-Perception</span> Whenever a regular players discovers that the game can be abused and can be played without purchasing (or purchase + refund), they instantly assume the game is free (Like 70% of players does this) and either start approaching the game in a negative manner, or expect the game to provide something more to those who verifiably purchased the game. Thankfully I discovered this phenomenon early on. Otherwise, originally, the game intended to let anyone sign up freely, but only for educational use, so kids who don\'t have money to purchase the game, could play the game anyway, and maybe learn coding. But early trials showed that this was also perceived as the game being free, and caused serious backlash and negative feedback (potential negative reviews and so on) - so disabled this feature before Steam release.',
	// htmls/drmfree.html:5; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.drmfree.drm-free": "DRM-Free",
	// htmls/drmfree.html:100; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.some-technical-reasons-steam-s-drm-system-is":
		"<span class=\"feature\">Some Technical Reasons</span> Steam's DRM system is strong, so if the game was on Steam-only, it could've been DRM'ed, I'm not saying I'd DRM the game, but it could be done. As a result you would occasionally get wiped out if there was a problem with Steam auth, but it would be possible. However, the game is already on Mac App Store, and even from my own analysis, the Apple's auth system is undocumentedly weak and abusable, there are easy to discover loopholes that enable you to multiply invoices, infinitely repeat authorizations and so on (manually patched for our game). I also consider putting the game on GOG one day, and I'd do it without DRM, or sell the game from other sources. I don't want to deal with each of their DRM/auth systems individually, so DRM-free it is. <span class=\"feature\">Also:</span> Those who play Adventure Land are all very technically capable, so better to have no DRM, rather than to have a DRM and get it busted and having to reply to all the messages related to that, why it happens, why it can't be prevented and so on, so this scenario is simpler",
	// htmls/drmfree.html:85; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.the-game-is-drm-free-02-05-19": '<span class="feature">The Game is DRM-Free.</span> [02/05/19]',
	// htmls/drmfree.html:94; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.what-drm-free-isn-t-it-s-not":
		"<span class=\"feature\">What DRM-Free isn't?</span> It's not free. So even though you can play the game without purchasing, or worse yet, you purchase the game, refund it, still keep playing it. Doesn't mean that it's a free game. It's about your own morals.",
	// htmls/drmfree.html:103; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.what-drm-is-good-for-and-how-we":
		'<span class="feature">What DRM is good-for, and how we use it!</span> Not DRM, but a "Purchase Authorization" is actually a very valuable service, so far, only Steam provides it in a non-easily-spoofable and dynamic manner, so things like "IP Limits Bypassing" is possible thanks to Steam. If you purchased the game from Steam, you can play the game with 10 friends on the same network. For a single player game, "Purchase Authorization"=DRM - but for an online game, "Purchase Authorization"="Abuse Protection".',
	// htmls/drmfree.html:91; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.what-is-drm-free-drm-means-digital-rights":
		"<span class=\"feature\">What is DRM-Free?</span> DRM means Digital Rights Management - DRM-Free means the game intentionally doesn't try to enforce that you actually purchased the game so that you can play the game. Why? Let's say you buy an old EA game from Steam, you open the game, the game not only requires Steam DRM, but it also forces you to create an EA account, verify the CD-Key, each time you play the game, enter the EA account's cryptic password you forgot and so on. Imagine all the bad karma they receive. Anyone who opens the game, would instantly hate everyone involved with it. Now imagine a GOG.com game, no DRM, you can purchase it once, keep it on your computer, and in 30 years, when potentially the seller of the game, or maker of the game is no more, you can still play it. How beautiful. Good karma.",
	// htmls/drmfree.html:106; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.drmfree.why-let-multiple-account-signups-this-comes-up":
		'<span class="feature">Why let Multiple Account Signups?</span> This comes up a lot, a player registers to the game with his/her email. Logs out, registers again. Then sends an email or discord message saying: "I found a very critical issue" - which I assume to be an endgame loophole, but 99% of the time ends up being this issue. <span class="feature">The main reason it\'s allowed:</span> You can sign-up with the wrong email. Logout, correct your email, continue with the new account, with the intention of moving your old characters to your new account if you created any. You could change your email, forgot the old email details, re-signup with your new email to contact hello@adventure.land later on to recover your old account. Or maybe, 2 players are playing with different accounts, but from the same computer / one purchased copy. It\'s a valid scenario. TL;DR: The scenarios are endless. <span class="feature">TL;DR-WHY:</span> To let players freely make account changes or corrections',
	// htmls/drmfree.html:118; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.drmfree.wizard": "Wizard",
	// htmls/email.html:14; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.email.1-check-out-the-guide-you-can-type": "1) Check out the GUIDE, you can type /guide in chat",
	// htmls/email.html:15; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.email.2-check-out-the-code-you-don-t": "2) Check out the CODE, you don't need to be a programmer to use CODE!",
	// htmls/email.html:16; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Named parameters (preserve each token exactly): {"discord_url":"domain.discord_url"}.
	"pages.email.3-join-us-on-discord-the-game-is":
		'3) Join us on <a href="{discord_url}" style="color: #18C0F4; text-decoration:none">Discord</a>, the game is in active development, there is an active and helpful community on Discord, for gameplay, trade and coding help!',
	// htmls/email.html:17; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.email.4-you-are-able-to-play-with-multiple":
		"4) You are able to play with multiple characters simultaneously, you can have 3 regular characters and a merchant, freely, for as long as you want!",
	// htmls/email.html:7; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.email.if-you-haven-t-initiated-this-routine-please": "If you haven't initiated this routine, please ignore this email.",
	// htmls/email.html:11; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.email.some-suggestions": "Some Suggestions!",
	// Password-reset email heading and button. A short action label; the button opens the recipient's reset link.
	"pages.email.to-reset-your-password-please-visit": "Reset your password",
	// Welcome/verification email heading and button. A short action label; the button confirms the recipient's email address.
	"pages.email.to-verify-your-email": "Verify your email",
	// htmls/executor.html:32; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.executor.initiating": "Initiating",
	// htmls/index.html:197; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.access": "ACCESS",
	// htmls/index.html:254; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.att-100": "ATT 100",
	// htmls/index.html:204; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.char": "CHAR",
	// htmls/index.html:184; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.character": "Character",
	// htmls/index.html:173; Page button prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.close": "CLOSE",
	// htmls/index.html:214; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.conf": "CONF",
	// htmls/index.html:226; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.data": "DATA",
	// htmls/index.html:186; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.default-code": "Default Code",
	// htmls/index.html:188; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.disengage": "Disengage",
	// htmls/index.html:161; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.docs": "DOCS",
	// htmls/index.html:187; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.engage": "Engage!",
	// htmls/index.html:121; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.europas-i": "Europas I",
	// htmls/index.html:246; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.graphics-paused": "GRAPHICS PAUSED",
	// htmls/index.html:208; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.guide": "GUIDE",
	// htmls/index.html:225; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.info": "INFO",
	// htmls/index.html:205; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.inv": "INV",
	// htmls/index.html:266; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.inv-12-42": "INV 12/42",
	// htmls/index.html:227; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.keymap": "KEYMAP",
	// htmls/index.html:173; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.label-close-code": "Close CODE",
	// htmls/index.html:146; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.label-live-server-events": "Live server events",
	// htmls/index.html:159; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.label-search": "Search",
	// htmls/index.html:182; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.load": "Load",
	// htmls/index.html:143; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.lv54-87": "LV54 87%",
	// htmls/index.html:259; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.index.name": '<span class="charactername ontint">NAME</span>',
	// htmls/index.html:148; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.index.news-from-steam-latest-update":
		'<button type="button" class="gamebutton steam-news-button" aria-haspopup="dialog"><span class="steam-news-arrow" aria-hidden="true">&lt;</span><span><small>NEWS FROM STEAM</small>Latest Update</span></button>',
	// htmls/index.html:101; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.privacy-policy": "Privacy Policy",
	// htmls/index.html:240; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.respawn": "RESPAWN",
	// htmls/index.html:213; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.rewards": "REWARDS",
	// htmls/index.html:242; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.safe-respawn": "SAFE RESPAWN",
	// htmls/index.html:180; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.save-as": "Save As",
	// htmls/index.html:207; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.skills": "SKILLS",
	// htmls/index.html:206; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.stats": "STATS",
	// htmls/index.html:100; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.terms-of-service": "Terms of Service",
	// htmls/index.html:102; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.thanks-and-attributions": "Thanks and Attributions",
	// htmls/index.html:121; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.town": "Town",
	// htmls/index.html:212; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.town-2": "TOWN",
	// htmls/index.html:211; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.travel": "TRAVEL",
	// htmls/index.html:136; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.tutorial-12-87": "TUTORIAL 12 / 87",
	// htmls/index.html:195; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.index.xx-xx": "XX:XX",
	// htmls/linux.html:281; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.01-02-24-15629-1229-162230-657405-fatal":
		"[01/02/24]: [15629:1229/162230.657405:FATAL:gpu_data_manager_impl_private.cc(1034)] The display compositor is frequently crashing. Goodbye. (see it via launching from CLI)",
	// htmls/linux.html:272; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.07-03-19-version-zlib-1-2-9": "[07/03/19]: version `ZLIB_1.2.9' not found (required by /nix/store/parrh56r6sr4ccp9ypl4sh7h5b19rijg-libpng-apng-1.6.36/lib/libpng16.so.16)",
	// htmls/linux.html:116; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.1-run-adventure-land-from-the-command-line": "#1: Run Adventure Land from the Command Line",
	// htmls/linux.html:218; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.advanced-bundle-a-fixed-webview2-runtime": "Advanced: Bundle a Fixed WebView2 Runtime",
	// htmls/linux.html:242; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.adventure-land-linux-native-crash-adventure-land-tauri":
		"Adventure Land Linux native crash; Adventure Land Tauri Linux; Steam Linux instant crash; Could not find the WebView2 Runtime; Tauri WebView2 Proton; Wine WebView2 Runtime; protontricks\n\t\t\t\t\twebview2; Microsoft Edge WebView2 Evergreen Runtime; WEBVIEW2_BROWSER_EXECUTABLE_FOLDER.",
	// htmls/linux.html:5; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.adventure-land-on-linux-native-steam-proton-and": "Adventure Land on Linux: Native Steam, Proton and WebView2 Help",
	// htmls/linux.html:113; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.adventure-land-s-current-steam-client-uses-tauri": "Adventure Land's current Steam client uses Tauri. Steam includes a native Linux build, so Proton isn't normally needed.",
	// htmls/linux.html:187; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.after-that-visit-adventure-land-log-in-with":
		"After that, visit <a href=\"https://adventure.land\">adventure.land</a>, log in with the same email and password, and play that character from your browser indefinitely. Steam doesn't need to be open,\n\t\t\t\t\tand the browser won't ask for another Steam verification.",
	// htmls/linux.html:177; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.authorize-once-then-play-in-your-browser": "Authorize Once, Then Play in Your Browser",
	// htmls/linux.html:255; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.black-or-blank-screen": "Black or Blank Screen",
	// htmls/linux.html:212; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.change-the-filename-if-your-browser-saved-it":
		"Change the filename if your browser saved it under another name. Installing WebView2 may remove the missing-runtime message, but WebView2 under Wine/Proton is not officially supported and\n\t\t\t\t\tcan still hang or crash.",
	// htmls/linux.html:144; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.common-steam-locations-include-local-share-steam-steamapps":
		"Common Steam locations include <b>~/.local/share/Steam/steamapps/common/Adventure Land/</b>, <b>~/.steam/steam/steamapps/common/Adventure Land/</b>, and\n\t\t\t\t\t<b>~/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Adventure Land/</b> for Flatpak Steam. A custom Steam Library can be anywhere, so Installed Files &gt; Browse is the\n\t\t\t\t\treliable path.",
	// htmls/linux.html:264; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.disable-steam-overlay-modification": "Disable Steam Overlay Modification",
	// htmls/linux.html:266; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.find-main-js-it-s-the-electron-code":
		'Find main.js - It\'s the Electron code/logic of Adventure Land - comment out the line with "app.commandLine.appendSwitch("in-process-gpu");" - this is needed to render the Steam overlay, but\n\t\t\t\t\tit can also cause issues. Currently it\'s disabled by default.',
	// htmls/linux.html:257; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.first-thing-to-try-is-to-find-the":
		"First thing to try is to find the Steam games directory and simply run Adventure Land from the command line. For some reason it usually works. You can also try the --disable-gpu flag. If the\n\t\t\t\t\tgame works when you disable the GPU, the issues are most likely related to GPU/driver issues. When you run the game from command line once, make sure to go back and test it from Steam again.\n\t\t\t\t\tSome players reported the game starting to work from Steam, only after they ran it from command line once. Mysterious.",
	// htmls/linux.html:170; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.if-ldd-prints-another-missing-library-install-that":
		"If <b>ldd</b> prints another missing library, install that library from your distro's package manager too. Do not install Microsoft WebView2 for the native Linux build; native Tauri uses\n\t\t\t\t\tWebKitGTK 4.1.",
	// htmls/linux.html:125; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.if-the-game-opens-sign-up-or-log": "If the game opens, sign up or log in and start a character. If it fails, send <b>~/adventure-land-native.log</b> to hello@adventure.land.",
	// htmls/linux.html:165; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.if-the-output-says-libwebkit2gtk-4-1-so":
		"If the output says <b>libwebkit2gtk-4.1.so.0: cannot open shared object file</b>, install Tauri's Linux webview runtime on Debian, Ubuntu or Kubuntu:",
	// htmls/linux.html:286; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.if-you-find-and-solve-an-issue-or": "If you find and solve an issue, or just stumble onto an issue you can't solve, please email hello@adventure.land with details",
	// htmls/linux.html:199; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.if-you-want-to-experiment-with-proton-anyway":
		'If you want to experiment with Proton anyway, install current <a href="https://github.com/Matoking/protontricks" target="_blank">Protontricks</a> and current\n\t\t\t\t\t<a href="https://github.com/Winetricks/winetricks" target="_blank">Winetricks</a>. The WebView2 verb was added to Winetricks in 2026, so older distro packages may not include it.',
	// htmls/linux.html:117; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.keep-steam-open-in-your-steam-library-right":
		"Keep Steam open. In your Steam Library, right-click <b>Adventure Land</b>, then select <b>Properties &gt; Installed Files &gt; Browse</b>. This opens the exact game folder, even if you use a custom Steam Library.",
	// htmls/linux.html:6; Page content attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.label-run-and-troubleshoot-adventure-land-s-native-linux":
		"Run and troubleshoot Adventure Land's native Linux Steam client, authorize your account for browser play, or experiment with Proton and WebView2.",
	// htmls/linux.html:179; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.linux-distributions-combine-different-desktop-environments-graphics-drivers":
		"Linux distributions combine different desktop environments, graphics drivers and WebKit versions. Some combinations are difficult for us to reproduce and support reliably. If the client works from a\n\t\t\t\t\tterminal but not from Steam, you can still use it once to authorize your account.",
	// htmls/linux.html:111; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.linux-native-steam-proton-and-webview2-help": '<span class="feature">Linux:</span> Native Steam, Proton and WebView2 Help',
	// htmls/linux.html:119; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.make-sure-the-terminal-lists-adventure-land-then": "Make sure the terminal lists <b>Adventure Land</b>, then run it:",
	// htmls/linux.html:220; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.microsoft-also-offers-an-x64-fixed-version-download":
		"Microsoft also offers an x64 <b>Fixed Version</b> download on the same WebView2 page. Extract the downloaded CAB with <b>cabextract</b> into a permanent folder. Find the extracted folder\n\t\t\t\t\tthat directly contains <b>msedgewebview2.exe</b>, then convert that folder to a Wine path:",
	// htmls/linux.html:151; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.native-client-closes-instantly": "Native Client Closes Instantly",
	// htmls/linux.html:247; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.old-electron-notes-kept-here-for-players-using": '<span class="devtitle">Old Electron Notes:</span> Kept here for players using the old client and for history.',
	// htmls/linux.html:118; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.open-a-terminal-in-that-folder-in-kde":
		"Open a terminal in that folder. In KDE's Dolphin, press <b>F4</b>. In other file managers, right-click inside the folder and select <b>Open in Terminal</b>.",
	// htmls/linux.html:131; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.open-adventure-land-s-steam-properties-select-compatibility":
		'Open Adventure Land\'s Steam Properties, select Compatibility, and turn off "Force the use of a specific Steam Play compatibility tool". Then select Installed Files and Verify integrity of\n\t\t\t\t\tgame files. Steam should install the native Linux depot.',
	// htmls/linux.html:153; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.open-steam-s-properties-installed-files-browse-on":
		"Open Steam's Properties &gt; Installed Files &gt; Browse. On Kubuntu, Dolphin opens the exact game folder. Press <b>F4</b> in that Dolphin window to open a terminal panel already inside it.\n\t\t\t\t\tOn another desktop, use your file manager's \"Open in Terminal\" action.",
	// htmls/linux.html:183; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.open-the-native-client-from-a-terminal-sign":
		"Open the native client from a terminal, sign up or log in, then start one character and wait until the game says <b>Connected</b>. This saves the Steam authorization on that Adventure Land account and\n\t\t\t\t\tcharacter.",
	// htmls/linux.html:173; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.please-send-the-complete-terminal-output-and-adventure":
		"Please send the complete terminal output and <b>~/adventure-land-native.log</b> to hello@adventure.land. Even an empty log is useful when paired with the other results.",
	// htmls/linux.html:193; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.proton-could-not-find-the-webview2-runtime": 'Proton: "Could not find the WebView2 Runtime"',
	// htmls/linux.html:230; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.replace-the-example-with-the-exact-path-returned":
		"Replace the example with the exact path returned by <b>winepath</b>. If <b>msedgewebview2.exe</b> is inside another extracted subfolder, point to that subfolder. Merely downloading the Fixed\n\t\t\t\t\tVersion files isn't enough; WebView2 must be directed to the folder containing the executable.",
	// htmls/linux.html:283; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.richard-found-a-fix-for-this-issue-the": "Richard found a fix for this issue, the fix is to use the <b>`--no-sandbox`</b> flag.",
	// htmls/linux.html:156; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.run-these-commands-one-at-a-time": "Run these commands one at a time:",
	// htmls/linux.html:139; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.the-current-linux-package-prefers-your-system-libraries":
		"The current Linux package prefers your system libraries when they are complete and automatically falls back to its bundled Linux runtime when they aren't. To test the bundled path directly,\n\t\t\t\t\tset this under Steam's General > Launch Options:",
	// htmls/linux.html:250; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.the-old-adventure-land-client-used-electron-when":
		'The old Adventure Land client used Electron. When you stumble onto an old-client issue, you can google the issue by combining error phrases with "electron". Sadly each distro and setup has\n\t\t\t\tit\'s own various issues, but they are usually easy to solve.',
	// htmls/linux.html:205; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.then-launch-adventure-land-again-with-proton-if":
		"Then launch Adventure Land again with Proton. If the command reports that <b>webview2</b> is unknown, your Winetricks copy is still too old.",
	// htmls/linux.html:234; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.this-is-experimental-microsoft-currently-tracks-proton-wine":
		"This is experimental. Microsoft currently tracks Proton/Wine compatibility as unsupported work, and a newer Fixed Version must be downloaded manually for security updates. For a dependable\n\t\t\t\t\tsetup, use Adventure Land's native Linux client.",
	// htmls/linux.html:195; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.this-means-proton-launched-the-windows-tauri-client":
		"This means Proton launched the Windows Tauri client. Windows normally supplies Microsoft Edge WebView2, but a new Proton/Wine prefix doesn't. The native Linux client above is the recommended\n\t\t\t\t\tfix.",
	// htmls/linux.html:123; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.to-save-the-output-for-troubleshooting-close-the": "To save the output for troubleshooting, close the game and run this instead:",
	// htmls/linux.html:135; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.under-installed-files-click-browse-the-game-folder":
		"Under Installed Files, click Browse. The game folder should contain <b>Adventure Land</b> and <b>libsteam_api.so</b>. If it contains <b>Adventure Land.exe</b>, Steam is still using the\n\t\t\t\t\tWindows build through Proton.",
	// htmls/linux.html:129; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.use-the-native-linux-client": "Use the Native Linux Client",
	// htmls/linux.html:227; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.use-the-returned-windows-style-path-in-adventure": "Use the returned Windows-style path in Adventure Land's Steam Launch Options:",
	// htmls/linux.html:240; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.useful-error-and-search-terms": "Useful Error and Search Terms",
	// htmls/linux.html:274; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.linux.user-foldm-on-discord-stumbled-onto-this-issue":
		'User "foldM_" on Discord stumbled onto this issue on NixOS - his solution was to set Steam to launch the game with: LD_LIBRARY_PATH=/lib:$LD_LIBRARY_PATH %command% (from Steam\'s Game\n\t\t\t\t\tProperties > Launch Options)',
	// htmls/linux.html:207; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.linux.you-can-also-download-microsoft-s-x64-evergreen":
		'You can also download Microsoft\'s x64 <b>Evergreen Standalone Installer</b> from the official\n\t\t\t\t\t<a href="https://developer.microsoft.com/en-us/microsoft-edge/webview2" target="_blank">WebView2 Runtime page</a>, then run that installer inside Adventure Land\'s Proton prefix:',
	// htmls/logs.html:612; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.01-12-16-writing-these-lines-more-than":
		"[01/12/16]: Writing these lines, more than a month later, let me state that [18/10/16] was a monumental day for Adventure Land. The day didn't start well, but in the end, It ended up being a day I will always remember.",
	// htmls/logs.html:202; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.02-02-17-last-2-weeks-i-ve":
		"[02/02/17]: Last 2 weeks, I've been working on the friends system, code system, new skills, valentine's day event, and several other things, going to update the /logs soon++ | Additionally, planning to add another page to the game, as it's being requested a lot, something like a /todo or a /roadmap - Current roadmap includes, Friends System, Guilds System, Skills System, Tavern, Daily Events, Skin/Looks System, Steam Release, Achievements/Statistics/Leaderboards, Code Tutorials and more - The community should have a way to track all these",
	// htmls/logs.html:122; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.04-02-19-up-to-january": "[04/02/19]: Up to January",
	// htmls/logs.html:116; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.05-02-19-just-before-the-steam-release": "[05/02/19]: Just before the Steam Release",
	// htmls/logs.html:108; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.05-02-19-steam-release-and-a-new": "[05/02/19]: Steam Release and a New Era",
	// htmls/logs.html:144; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.07-09-18-a-new-era": "[07/09/18]: A New Era",
	// htmls/logs.html:130; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.07-09-18-cloud-vs-dedicated": "[07/09/18]: Cloud vs. Dedicated",
	// htmls/logs.html:440; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.11-12-16-it-s-been-a-hectic":
		"[11/12/16]: It's been a hectic week, especially this last 2 days were great, we've achieved a lot with Jayson, going to update the logs soon, I've been integrating, polishing Winterland, Xmas stuff for the last 12 hours, It's finally complete, I'm very proud, at the same time, I'm very anxious at times like these, a lot changed with the game, I hope I don't wake up to offline servers tomorrow :)",
	// htmls/logs.html:204; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.15-01-17-i-ve-been-working-on": "[15/01/17]: I've been working on the new town non-stop for the last few days, going to update the /logs soon",
	// htmls/logs.html:165; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.22-04-17-development-logs-becomes-the-development": '[22/04/17]: "Development Logs" becomes the "Development Blog"',
	// htmls/logs.html:102; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.28-02-19-summer-mode-on": "[28/02/19]: Summer Mode On",
	// htmls/logs.html:691; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.30-10-16-whew": "[30/10/16] WHEW ...",
	// htmls/logs.html:1046; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.a-comparison-between-old-and-new-http-adventure":
		'A Comparison between old and new:\n\t\t\t\t<a target="_blank" href="http://adventure.land/img/early.png" class="cancela"><span class="devlink">http://adventure.land/img/early.png</span></a>\n\t\t\t\t<a target="_blank" href="http://adventure.land/img/new_crowded.png" class="cancela"><span class="devlink">http://adventure.land/img/new_crowded.png</span></a>',
	// htmls/logs.html:169; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.a-lot-has-happened-in-these-last-4":
		'A lot has happened in these last 4 months, the game has improved significantly, old players are amazed when they re-visit, the most important and determining decision was to postpone the Steam release, instead of releasing as Early Access, I decided to "complete" and "perfect" the game first, in hindsight, this might not have been a good decision, time will tell.',
	// htmls/logs.html:836; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.a-lot-of-minor-things-some-post-deployment": "A lot of minor things, some post-deployment stuff, where issues pop-up.",
	// htmls/logs.html:740; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.a-new-month-reminds-me-of-the-passage":
		"A new month reminds me of the passage of time, I don't like it, It would have been great to just enter a time dilation field, build a product, get out of the time dilation field, show the world the product. Get in the time dilation field again, cry a bit, revise the product, and cram the entire process in a day. And maybe a solution to the ageing issue while we're at it.",
	// htmls/logs.html:242; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-2-new-internal-analysis-routines-one-of":
		"Added 2 new internal analysis routines, one of them analyses the game in general, the other one is for individual accounts, helpful for moderation and monitoring.",
	// htmls/logs.html:505; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-12-second-respawn-cooldown-improved-the": 'Added a 12-second respawn cooldown. Improved the "use_town" skill, it reflects the cooldowns now.',
	// htmls/logs.html:336; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-booster-guide-and-accompanying-code-functions":
		'Added a "Booster Guide" and accompanying Code functions. Through code, it\'s possible to utilise one booster to benefit from everything, it should be fun implementing this strategy.',
	// htmls/logs.html:485; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-charge-behaviour-to-monsters-it-s":
		"Added a charge behaviour to monsters, it's dynamic, low speed monsters speed up 2X when targeting someone, the multiplier is much lower for high speed monsters. I might further dial it down. I don't want to prevent kiting, but slow monsters aren't very fun either, so there's a balance in between.",
	// htmls/logs.html:472; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-line-check-feature-to-our-map":
		'Added a "Line Check" feature to our map editor, I always enjoy adding small technical features like these. The bad news is, apart from the gap "Mr. Clean" found, there aren\'t any more gaps. Finding one more gap would have been enjoyable. As it is, I suspect, there might be a special case where our current `calculate_move` moves people outside the lines.',
	// htmls/logs.html:381; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-new-feature-to-npc-s-they":
		"Added a new feature to NPC's, they can now change direction when you interact with them, in the future, they will have their own routines, they will at least walk, and hopefully a lot more. Currently only \"Ace\" has a pre-set movement. I think it would be nice to have several NPC's that are just there to add color, they could give small tips.",
	// htmls/logs.html:869; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-new-is-in-front-logic-so":
		'Added a new "is_in_front" logic, so monsters only show aggression towards what are in front of them, the same check could be added to other things too, but things are fun the way they are.',
	// htmls/logs.html:784; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-new-item-dracul-s-cape-this":
		'Added a new item, "Dracul\'s Cape", this is a major change for the game, decided to add random/rare drops like this for most bosses, monsters. The cape has +HP that benefits Mage\'s/Priest\'s significantly. The "Lifesteal" attribute is new too. Very small for the Cape, as attributes are cumulative.',
	// htmls/logs.html:589; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-prompt-when-a-player-tries-to":
		"Added a prompt when a player tries to close the tab during a PVP combat, escaping results in defeat, so this prompt and the accompanying message will raise awareness.",
	// htmls/logs.html:395; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-rage-property-similar-to-aggro-when": 'Added a ".rage" property, similar to ".aggro", when ".aggro" happens, ".rage" is the probability of the monster targeting the player.',
	// htmls/logs.html:971; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-re-focus-routine-to-the-game": "Added a re-focus routine to the game, when the browser window is re-focused, the monster/player focus was lost, now it's recovered.",
	// htmls/logs.html:506; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-re-log-cooldown-some-players-were":
		"Added a re-log cooldown, some players were using the agility of the system to their advantage. Improving this re-log blockage, at first it was based on logout, currently, it's based on login, this way, when someone wants to join a friend in another server after a while, s/he won't have to wait.",
	// htmls/logs.html:522; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-rid-property-to-trade-items-it":
		"Added a .rid property to trade items, it changes each time the trade slot is modified, this prevents continually swapping items to trick Code'd merchants into buying something that didn't mean to buy. Congratulations to Vehn for achieving this, he did it for the fun of it, and returned the gold. I kind of wanted this to happen, it's a fun method, and it coincidentally happened today, independent from my .rid improvement.",
	// htmls/logs.html:1072; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-show-hide-interface-and-4-showcase": 'Added a "SHOW/HIDE" interface, and 4 showcase/sell slots to the Character interface.',
	// htmls/logs.html:933; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-spear-to-the-game-can-only": 'Added a "Spear" to the game, can only be equipped to the mainhand of warriors, compared to a "Blade", has a much higher range.',
	// htmls/logs.html:364; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-a-well-crafted-cape-a-rare-but": 'Added a "Well-Crafted Cape" - a rare but achievable exchange from the leather quest.',
	// htmls/logs.html:185; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-all-the-planned-items-completed-re-visited":
		"Added all the planned items, completed/re-visited all the new quests, monsters, drops. There's still a lot to be added/integrated to the game. Didn't add the new armor sets yet.",
	// htmls/logs.html:889; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-an-under-mode-to-the-map-editor": 'Added an "Under Mode" to the map_editor, really eases the map_editor usage and extends it\'s capabilities.',
	// htmls/logs.html:484; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-armor-resistance-evasion-reflection-to-monsters-feels":
		"Added Armor, Resistance, Evasion, Reflection to monsters. Feels great. As an example, a monster with high Evasion could only be farmable with Mage's/Priest's, while, a monster with high Reflection wouldn't easily be farmable by a magical class. It's always good to have some variety.",
	// htmls/logs.html:286; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-calibrated-the-spiked-shield-item-upgraded-to":
		'Added/Calibrated the "Spiked Shield" item. Upgraded to OSX Sierra, seems stable, using WebGL heavily, UI glitches started happening more frequently, Sierra seems stable.',
	// htmls/logs.html:456; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-combined-damage-warnings-on-combined-damage-callback": 'Added combined damage warnings + "on_combined_damage" callback for Code.',
	// htmls/logs.html:724; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-crab-s-to-the-beach-but-they":
		'Added "Crab"s to the beach, but they are really huge, so, instead, shrinked them to half their size as "Tiny Crab"s, the actual "Crab"s are now "Huge Crab"s, because they are huge, and not cute.',
	// htmls/logs.html:749; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-defeat-on-escape-basically-on-pvp-one":
		'Added "Defeat on Escape", basically, on PVP, one emerging method was closing the browser just before escape. Now the player is auto-defeated when this happens, within the PVP-block duration.',
	// htmls/logs.html:866; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-flexible-persistent-properties-to-characters-not-used":
		"Added flexible+persistent properties to characters. Not used yet, but will be needed when there are daily events, multiple looks, options etc.",
	// htmls/logs.html:366; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-guard-npcs-as-a-placeholders-they-will": "Added guard NPCs as a placeholders, they will guard un-launched zones/caves/places.",
	// htmls/logs.html:634; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-ms-dracul-improved-the-halloween-zone": "Added Ms. Dracul, Improved the Halloween Zone.",
	// htmls/logs.html:688; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-multiple-orb-s-to-test-the-dynamics": "Added multiple Orb's to test the dynamics. Implemented the orb dynamics, so only unique Orb's can be equipped.",
	// htmls/logs.html:708; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-new-features-to-our-in-house-map":
		"Added new features to our in-house map_editor. It has various zoom controls now. And some performance improvements thanks to pixel-perfect TilingSprite's.",
	// htmls/logs.html:735; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-new-routines-for-checking-the-disable-flags": 'Added new routines for checking the "disable" flags, like stun, .rip etc. Improved the CODE too.',
	// htmls/logs.html:508; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-our-lottery-lady-after-working-on-the":
		"Added our Lottery Lady, after working on the game for this long, I started wanting NPC Dialogues too, and adding the dialogue for the Lottery Lady was refreshing.",
	// htmls/logs.html:716; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-passive-character-abilities-currently-only-stun-is":
		'Added passive character abilities, currently only "Stun" is adopted from the weapon. Implemented the actual "Stun" ability today, the logic, the effects, everything. I guess I can add "Crit" as another passive ability soon, maybe from a specific ring.',
	// htmls/logs.html:988; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-shadows-to-the-maps-still-experimental-first": "Added shadows to the maps, still experimental, first usage is in the cave.",
	// htmls/logs.html:846; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-shells-drops-to-monsters-gems-completed-and": 'Added "SHELLS" drops to monsters, gems. Completed and deployed the premium currency of Adventure Land. A monumental day.',
	// htmls/logs.html:909; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-signs-to-the-game-the-first-one": 'Added "signs" to the game! - The first one is for the "Offshore Bank" :]',
	// htmls/logs.html:422; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-some-new-cache-s-to-the-game":
		"Added some new cache's to the game to improve performance. Improved/Re-Visited some server routines, refactoring/improving existing code is always enjoyable, serene.",
	// htmls/logs.html:663; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-supershot-ranger-attack-animations-set-the-line": "Added Supershot, Ranger attack animations, set the line colors, integrated and calibrated all of Ranger's stuff.",
	// htmls/logs.html:670; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-supershot-to-ranger-s-as-today-s": "Added Supershot to Ranger's as today's feature, brainstormed possible recruitment rewards, level based rewards are pretty challenging.",
	// htmls/logs.html:815; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-a-q-r-keypresses-a-is":
		'Added the "A"/"Q"/"R" keypresses. "A" is Attack, "Q" is Taunt for warriors, "R" is mana burst for mages. "Q"/"R" are misc for now. The game doesn\'t have official abilities yet.',
	// htmls/logs.html:685; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-ability-to-create-5-characters": "Added the ability to create 5+ characters.",
	// htmls/logs.html:762; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-afk-notice-and-logic-there-are":
		"Added the \"[AFK]\" notice and logic. There are a lot of players who use CODE, when new players visit the game, if they don't see that those players are afk, the first impression isn't well.",
	// htmls/logs.html:785; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-basher-item-and-the-weapon-speed":
		'Added the "Basher" item, and the "Weapon Speed"/"Slow" routines. "Basher" adds armor, it\'s the first two-handed weapon, would be ideal for Tank\'s.',
	// htmls/logs.html:417; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-candy-cane-and-blue-pom-pom": 'Added the "Candy Cane" and blue "Pom Pom"s.',
	// htmls/logs.html:403; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-cape-an-exciting-item-yet-really": 'Added the "Cape" - an exciting item, yet, really hard to acquire, the leather quest isn\'t an easy one.',
	// htmls/logs.html:578; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-crit-property-logic": 'Added the "Crit" property/logic.',
	// htmls/logs.html:424; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-eggnog": 'Added the "Eggnog".',
	// htmls/logs.html:618; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-fancy-pots-npc-to-the-spooky": 'Added the "Fancy Pots" NPC to the Spooky Forest. Added the "Pom Pom"s. Calibrated the drops one last time.',
	// htmls/logs.html:1091; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-fiery-blade-and-fiery-staff-items": 'Added the "Fiery Blade" and "Fiery Staff" items, they are very rare, so they don\'t affect the game balance, yet make the game more fun',
	// htmls/logs.html:377; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-initial-integration-of-music-fx-levels": "Added the initial integration of music/fx levels, currently internal, reduced the music_level;",
	// htmls/logs.html:394; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-leather-merchant-polishing-the-quest-system": 'Added the leather merchant, polishing the quest system. Improved "Stompy". Jayson improved my Rudolph a lot.',
	// htmls/logs.html:391; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-orb-of-second-chances-our-first": 'Added the "Orb of Second Chances" - our first Orb, has the ability to prevent death with a %.',
	// htmls/logs.html:1054; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-perfect-pixels-switch-and-logic-as":
		'Added the "Perfect Pixels" switch and logic, as my Dell P2415Q monitor can\'t handle perfect pixels at 4K, no matter what I try, I was playing the game anti-aliased during development, the same routine made it\'s way to production, now, on default, players will see a perfectly pixellized game. The "OFF" option provides a potentially more blurry/soothing game play. The behaviour might change from system to system, and it might be ineffective for non-retina screens. There will be another option for Retina screens soon, as non-Chrome browsers need a different solution for perfect pixels.',
	// htmls/logs.html:923; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-pvp-announcements-logic-starting-to-wrap": "Added the pvp announcements, logic, starting to wrap things up, re-calibrated drops, valuations.",
	// htmls/logs.html:676; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-quiver-item-improved-character-deletion-tested": 'Added the "Quiver" item, improved character deletion, tested shadows for disappearing texts.',
	// htmls/logs.html:687; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-ranger-class-the-bow-the-attack": "Added the Ranger class, the Bow, the attack animation, started playing and balancing a Ranger.",
	// htmls/logs.html:198; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	// Reflection/Evasion scrolls refers to the named Reflection Scroll and Evasion Scroll items, not generic reflection/evasion stats. Preserve the item names in this historical entry.
	"pages.logs.added-the-reflection-evasion-scrolls-they-have-custom":
		'Added the Reflection/Evasion scrolls, they have custom/balanced multipliers. Added the "Band of Fury" head-slot item, very rare and very powerful. Originally, it was meant to be a Tier0 item.',
	// htmls/logs.html:473; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-skin-property-to-monsters-basically-two":
		'Added the "skin" property to monsters, basically, two monster definitions will be able to share the same looks, the first example is normal rats and jail rats.',
	// htmls/logs.html:626; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-str-int-dex-amulets-improved-mr": 'Added the Str/Int/Dex amulets. Improved Mr. Pumpkin. Polishing the zone, monsters, drops. Added the "Ghost".',
	// htmls/logs.html:194; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	// The historical seashells quest uses the Seashell item, not Shells currency. Keep Seashell identifiable and retain the historical claims.
	"pages.logs.added-the-tavern-premium-items-npc-s-set":
		"Added the Tavern/Premium-Items NPC's. Set the phoenix spawn points, improved the stats and drops of the Phoenix. Improved the seashells quest, enriching the new town.",
	// htmls/logs.html:627; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-tier3-4-armor-drops-to-the": "Added the Tier3/4 Armor Drops to the Armor Box.",
	// htmls/logs.html:384; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-transport-lady-to-winterland-the-captain":
		'Added the "Transport Lady" to Winterland, the "Captain" is ready too, yet, for the time being, transport is more practical than sea travel.',
	// htmls/logs.html:580; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-use-town-skill": 'Added the "use_town" skill.',
	// htmls/logs.html:507; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-vitality-scroll-for-the-time-being": 'Added the "Vitality Scroll" - for the time being, it only drops from the strong Scorpion\'s.',
	// htmls/logs.html:686; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-welcoming-code-comment-to-encourage-new": "Added the welcoming CODE comment to encourage new players to learn coding, to make it all more welcoming.",
	// htmls/logs.html:376; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-the-would-you-like-to-turn-on": 'Added the "Would you like to turn on the Xmas Tunes?" prompt, after hunting the perfect tune, I want it to be enjoyed :)',
	// htmls/logs.html:764; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.added-trade-history-integrated-it-to-the-merchant":
		'Added "Trade History", integrated it to the "Merchant Stand" item, previously it was a mystery who bought items, now the Trade History logs the last 40 trades.',
	// htmls/logs.html:763; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.adjusted-a-wooden-box-to-be-the-first":
		'Adjusted a wooden box to be the first "Merchant Stand", it looks great, fits well into the game, when a player opens the "Merchant Stand", it\'s like the player is a Trade NPC. :]',
	// htmls/logs.html:146; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.after-1-5-years-of-bad-performance-around":
		"After 1.5 years of bad performance, around June, a new approach started forming as an idea, and on June 21st, I started a new system of work.",
	// htmls/logs.html:553; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.after-3-years-away-from-the-hobby-received":
		"After 3 years away from the hobby, received a new fountain pen today, a Pilot Custom Heritage 912 with Falcon Nib, engaging with the pen boosted my morale.",
	// htmls/logs.html:986; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.after-eliminating-everything-started-introducing-things-one-by":
		"After eliminating everything, started introducing things one by one, Text's turned out to be the leak source, the disappearing texts in game, manually patched the issue and reported it to the pixijs project.",
	// htmls/logs.html:175; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.after-the-midnight-updated-the-notes-looking-forward":
		'After the midnight, updated the "notes", "looking forward to" sections, made last minute checks, corrections, everything was ready for the New Town, + Deployed!',
	// htmls/logs.html:177; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.after-the-update-some-players-were-experiencing-transport":
		'After the update some players were experiencing transport/movement issues, fixed that issue, Added an "is_code" flag, separated the Code logic in one of the common functions.',
	// htmls/logs.html:438; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.after-working-non-stop-for-almost-6-years":
		"After working non-stop for almost 6 years, I think I need a break, maybe a vacation - and definitely some changes in my routines. I used to have a very relaxed approach to work, it's probably best to go back to my roots.",
	// htmls/logs.html:804; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.aided-jayson-on-the-issues-he-was-having":
		"Aided Jayson on the issues he was having, the new maps are finally progressing well. Not having to worry about the map design aspect of the game is a relief.",
	// htmls/logs.html:1070; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.all-hp-bars-of-team-members-are-visible":
		"All hp bars of team members are visible, so when Priests arrive they will have an easy time targeting people to heal, when a monster attacks a team member, again it's indicated by it's visible hp bar, all xp gains of party members are shown as purple disappearing texts, all in all, in my opinion, it's beautifully chaotic, I love it",
	// htmls/logs.html:798; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.also-briefly-started-the-achievements-system-and-debating":
		'Also briefly started the <span class="feature">"Achievements"</span> system, and debating <span class="feature">"Quests"</span> with Jayson, I honestly can\'t think of many meaningful quests. In almost all online games, quests are sugar-coated grinding, so I was against quests originally. Not anymore tho. I feel like small/local quests could add some color to the game.',
	// htmls/logs.html:809; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.americas-europas-ii-s-weren-t-too-useful":
		'Americas/Europas II\'s weren\'t too useful. The 6-people PVP Arena limit is mostly too much early on. So decided to make the II\'s all-pvp servers for now. With higher "Luck"/"Gold"/"XP" gain stats.',
	// htmls/logs.html:1131; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.an-early-launch-for-adventure-land-mainly-to":
		"An early launch for adventure.land, mainly to test the network, configured the communications between systems, set up hello@adventure.land, solved some minor server challenges",
	// htmls/logs.html:1063; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.an-eventless-day-of-community-engagement-bug-fixes": "An eventless day of community engagement, bug fixes, design and re-balancing",
	// htmls/logs.html:641; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.an-extreme-amount-of-thinking-on-clans-guilds": "An extreme amount of thinking on Clans/Guilds.",
	// htmls/logs.html:701; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.and-today-s-highlight-rogue-added-the-rogue":
		"And, today's highlight, Rogue!! - Added the Rogue class, which uses the already available Invis ability, and an accompanying \"Claw\" item, It's a fist weapon, no daggers yet. :]",
	// htmls/logs.html:771; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.another-day-another-map-editor-improvement-with-similar":
		"Another day, another map_editor improvement, with similar specs, I can open 10X+ map_editor's on Windows/OSX, but Jayson always complains of the performance, anyway, normally, since map_editor was going to be an internal tool for myself, performance wasn't a concern, but it sadly became a concern, this last improvement adds texture caching, pushing the performance close to maximum levels with this draw-all architecture. It's also interesting that a GT750M on OSX can handle 10-15 things at once at 60fps, yet a GTX960 on Windows can't do one.",
	// htmls/logs.html:1011; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.another-day-of-huge-improvements-animated-death-priest": "Another day of huge improvements! Animated Death + Priest Class on the same day!",
	// htmls/logs.html:843; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.another-productive-day": "Another Productive Day!",
	// htmls/logs.html:657; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.another-slow-day-updated-my-ipad-to-ios10": "Another slow day, updated my iPad to iOS10, to test stuff on iOS10.",
	// htmls/logs.html:167; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.anyway-you-ve-probably-wondered-what-this-has":
		"Anyway, you've probably wondered what this has to do with Adventure Land, when I first started developing Adventure Land, there was just development, there wasn't a significant playerbase, there was no playerbase to satisfy, to retain, to grow, after our first Reddit announcement, things changed quite a bit, actually, pretty much everything changed. So, TL;DR: It's no longer possible to aggregate my physical notes into daily notes, list of changes for the game. I loved doing it, it was good while it lasted",
	// htmls/logs.html:126; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.apart-from-these-december-was-a-really-bad":
		"Apart from these, December was a really bad month, I got subjected to an extreme amount of injustice from Facebook, had really old apps that lived on their platform, they decided to completely remove one of them for no reason, became really ill from sadness, couldn't sleep most of the time.",
	// htmls/logs.html:803; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.applied-a-simple-fix-so-the-game-can":
		'Applied a simple fix so the game can handle "disappear"+"reappear" on the same frame. Otherwise due to the design it wasn\'t an easy problem to fix. Updated PIXI, made some small improvements, patched the `.destroy` routine so it doesn\'t cause crashes.',
	// htmls/logs.html:145; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.around-december-2016-i-kind-of-broke-myself":
		"Around December 2016, I kind of broke myself, I had a very strict work approach, It was forcing me to work every day, every hour, the stress was unbearable, I decided to just set myself free and see how it goes. It didn't go well. It eliminated the stress, but the stress became anxiety due to neglecting work.",
	// htmls/logs.html:166; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.as-a-habit-i-take-a-lot-of":
		"As a habit, I take a lot of notes, mostly in the form of entries, kind of like a diary, it's part a habit, part an obsession. It's a work thing. You know, sometimes, you feel like you've experienced a time slip, it feels like months have passed, and you've achieved nothing? Probably every student will know the feeling, when the semester starts, everyone is generally very relaxed, but, when the midterms or the first exams arrive, even though likely 2 months have passed, it feels like no time has passed at all, it's a time slip. Anyway, I've started this note-taking habit to prevent these time slips from happening, and kind of force myself to work. About 7 years ago, I was developing Facebook apps, at one point, Facebook started a crusade against apps and app developers, they disabled, removed apps from their platform without reason. It was devastating. Every time it happened, it caused a form of depression that caused something similar to these time slips, It was hard coping with loss, after these happened, I would discover that weeks, or months have passed since I've done anything to achieve my goals. Anyway, long story short, I write down pretty much everything work related I do, on Moleskine notebooks, this way, the work keeps on going no matter what, it works, but it has it's issues too, after years of doing this, I wonder whether it's more natural to just let time slip.",
	// htmls/logs.html:137; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.as-players-prefer-the-us-servers-i-chose":
		"As players prefer the US servers, I chose OVH's child company SoYouStart and got a i7-4790K game server for just 35 euro/mo. Comes with 250Mbps of unmetered/unlimited/free bandwidth. So basically no more data charges.",
	// htmls/logs.html:569; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.as-the-hp-caps-increases-priests-became-more": "As the hp caps increases, priests became more powerful, so a heal nerf might be needed, or a weapon/orb with a heal blocking ability.",
	// htmls/logs.html:135; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.at-this-point-in-time-we-have-only":
		"At this point in time, we have only 40 active characters (Very healthy number for prolonged development in my opinion, fyi) - anyway - the $240 server charge isn't that bothersome, as servers are unutilised, but the $40 data charge was bothersome, it means each character costs $1, since one player can have 4 characters, it meant that each player cost $4/monthly in just data. Beyond infeasible. I first thought something was amiss. As the game uses miniscule amounts of data. Like 5-10kb/s. But when you make the calculations. Even those small amounts end up being 10-20GB per month. As characters are online 24/7. So a new old-era has started, Dedicated Servers.",
	// htmls/logs.html:1135; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.back-story-coming-soon-01-12-16": "Back Story: Coming Soon [01/12/16]",
	// htmls/logs.html:972; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.balanced-monsters-and-drops": "Balanced monsters and drops",
	// htmls/logs.html:448; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.basher-s-speed-reduction-now-shows-up-on":
		'Basher\'s speed reduction now shows up on stats, the speed reduction also decreases with upgrade. The "Slow" weapon speed is now a multiplier, currently 0.8 for Basher, but soon, all weapons will receive a Speed stat. Going to balance the dynamics once all weapons are designed. "Very Slow", "Slow", "Normal", "Fast", "Very Fast" are the options. Might simplify things and go with "Slow", "Normal", "Fast".',
	// htmls/logs.html:147; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.basically-i-work-only-weekdays-wake-up-at":
		"Basically I work only weekdays, wake up at 7am, have a breakfast, brew a coffee until 8am, work from 8am to 12pm, have a lunch, watch some TLC or sth, then work from 1pm to 5pm and leisure time afterwards. It's basically working wonders. No stress. No anxiety. But some energy issues due to waking up so early. In order to wake up early, one must prepare well before sleep, that part I didn't quite yet master.",
	// htmls/logs.html:840; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.basically-when-you-get-hit-your-name-becomes":
		"Basically, when you get hit, your name becomes red and the indicator fades away, you can't TOWN or Escape when you are hit, so the PVP is now more fun :]",
	// htmls/logs.html:985; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.became-really-obsessed-with-the-memory-leak-and":
		"Became really obsessed with the memory leak and performance issues. Re-Visited every single routine available. Made a lot of improvements, found 2 major things to fix. They weren't the cause of the major leak.",
	// htmls/logs.html:1083; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.big-changes-today-re-designed-and-implemented-the": "Big changes today, re-designed and implemented the entire game interface",
	// htmls/logs.html:944; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.big-update-jayson-is-now-a-part-of":
		"<span class='big'>BIG UPDATE:</span> Jayson is now a part of the team, or this one man operation now becomes a team, in the short span of 2-3 days, he designed remarkable map entities. It's great to have someone to work with. \"Map Design\" was a heavy burden for me, It's a form of art that one needs to dedicate him/herself to. Not simple, as I plan to mature the game in 6 months, and we are already 3 months in. (1 month start, 1 month development, ~1 month since the launch)",
	// htmls/logs.html:5; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.blog": "Blog*",
	// htmls/logs.html:266; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.boosted-the-mistletoe-candy-cane-drops-significantly": "Boosted the Mistletoe, Candy Cane drops significantly.",
	// htmls/logs.html:517; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.both-systems-aren-t-perfect-yet-the-first":
		"Both systems aren't perfect yet, the first one doesn't have to be, but the stack prevention system is very aggressive, I'm planning to add both Code + Game Log warnings soon.",
	// htmls/logs.html:675; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.brainstormed-various-alternatives-for-stats-attributes-decided-not": "Brainstormed various alternatives for stats/attributes, decided not to add Vitality for now.",
	// htmls/logs.html:977; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.by-design-adventure-land-isn-t-pay-to":
		"By design, Adventure Land isn't pay to win, the current progress of the game is proof, as everyone who got to know the game is both enjoying the game and learning a lot from the experience.",
	// htmls/logs.html:780; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.calibrated-boss-cooldowns-and-drops-implemented-the-random":
		'Calibrated Boss cooldowns and drops. Implemented the "Random Look" routine internally, this routine will give player random looks. It will be integrated to the "Looks" NPC.',
	// htmls/logs.html:370; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.calibrated-finalised-all-the-xmas-items-and-drops": "Calibrated/Finalised all the Xmas items and drops, getting excited.",
	// htmls/logs.html:860; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.calibrated-improved-the-new-monster-aggression-routines-disappearing":
		"Calibrated/Improved the new monster aggression routines, disappearing lines and the new server/client data routines.",
	// htmls/logs.html:365; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.calibrated-the-new-monsters-added-properties-most-monsters":
		"Calibrated the new monsters, added properties, most monsters will have it's own challenges as game progresses, based on properties, aggressiveness, spawn rates, drops and competition.",
	// htmls/logs.html:726; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.calibrated-tiny-crab-s-it-s-actually-challenging":
		"Calibrated \"Tiny Crab\"s. It's actually challenging, they are irregular, compared to other monsters, the Sprite's are shrinked in half, I decided to take the easy route and fit them in manually for now, works great.",
	// htmls/logs.html:213; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.catching-up-with-the-logs-finalised-the-improved":
		"Catching up with the /logs + Finalised the improved transport system - It's not possible to move or re-transport during a transport now, applied at the client level.",
	// htmls/logs.html:208; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.caught-up-with-my-logs-today-and-had":
		"Caught up with my logs today and had the opportunity to review last month. I love December, overall I took a lot of time to relax and slack before and after new year's eve. It wasn't unproductive either, yet, I could've crammed a couple of days here and there to work all day and get a lot of stuff done. December 10th/11th was the last time that happened. I feel ashamed that the new town is still not integrated, even though all the content was ready for weeks. I experience something similar to a writer's block whenever there is new content to add to the game.",
	// htmls/logs.html:341; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.caught-up-with-these-logs-again-normally-i": "Caught up with these /logs again, normally I was updating them daily now, but the events on [02/12/16] caused another delay.",
	// htmls/logs.html:587; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.character-names-now-appear-on-the-browser-tab": "Character names now appear on the browser tab titles.",
	// htmls/logs.html:455; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.checked-out-aws-re-invent-adventure-land-uses": "Checked out AWS re:invent, Adventure Land uses C4 EC2 instances, the new C5 instances are very exciting, can't wait to make the switch.",
	// htmls/logs.html:683; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.checked-the-halloween-map-perfect-opened-a-dialog": "Checked the halloween map, perfect, opened a dialog with Ellian.",
	// htmls/logs.html:1036; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.closed-the-gap-between-browser-font-differences-slightly":
		"Closed the gap between browser font differences slightly. I think, in the end, there won't be any \"bold\" fonts. So Chrome texts will thin-down a bit, yet things will look the same across all browsers. I'm really used to how things look now. So I didn't make any changes at this point.",
	// htmls/logs.html:545; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.collaborated-with-jayson-he-has-been-extremely-productive":
		"Collaborated with Jayson, he has been extremely productive in November, in October we lost our synergy for a while, turns out he's also going through tough times like me.",
	// htmls/logs.html:514; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.combo-s-aren-t-exactly-what-they-sound":
		"Combo's aren't exactly what they sound like, it's basically an extension to the internal attack system, with one attack, it's now possible to hit multiple targets, so it's kind of a server improvement.",
	// htmls/logs.html:950; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.community-member-jayson-a-k-a-oragon-premier":
		"Community member Jayson, a.k.a Oragon/Premier shared his first map, It was incredibly promising, and motivating. Gave me a lot of hope for the future of the game.",
	// htmls/logs.html:385; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.completed-all-the-details-for-the-winterland-and": "Completed all the details for the Winterland and Winter Inn.",
	// htmls/logs.html:706; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.completed-and-balanced-the-armor-tiers-today-also":
		"Completed and ~balanced the armor tiers today. Also adjusted the res./armor/speed/hp gains of classes. Increased the hp gain by level.",
	// htmls/logs.html:898; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.completed-the-bank-a-proud-moment": "Completed the bank, a proud moment.",
	// htmls/logs.html:379; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.completed-the-cape-orb-equip-logic": "Completed the Cape/Orb equip logic.",
	// htmls/logs.html:378; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.completed-the-new-upgrade-or-compound-npc-i":
		'Completed the new "Upgrade or Compound" NPC, I think simple is better, instead of statues that are hard to discover, this new NPC/design is very easy to discover, and explains things in a very basic form.',
	// htmls/logs.html:1094; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.connected-the-1st-island-to-the-3rd-island": "Connected the 1st Island to the 3rd Island, re-balanced monsters, Cave is still the best spot",
	// htmls/logs.html:161; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.considered-handling-all-incoming-pm-s-as-mail": "Considered handling all incoming PM's as Mail's too, yet, it seems like an overkill.",
	// htmls/logs.html:478; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.considering-alternative-movement-systems-algorithms-our-system-is":
		"Considering alternative movement systems, algorithms, our system is custom, very robust, it serves us well, the downside is that violating the system is possible, and it upsets everyone when someone does that, so for the next generation, not going to settle with anything less then perfect.",
	// htmls/logs.html:463; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.continually-designing-our-new-items": "Continually designing our new items.",
	// htmls/logs.html:604; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.continuing-the-reddit-day-took-a-break-around":
		"Continuing the Reddit Day, took a break around 2am, I was really exhausted. Around 4am, when I continued greeting new players, RedSky mentioned he couldn't click anywhere, and while we were talking JourneyOver also stated he was never able to click anything, and he thought the game was Code-only. This was extremely worrisome, as in the past, I saw players who never moved and left after a while, It was a serious cause of concern for me. Since our early players mostly weren't native english speakers, none of them mentioned the issue either, they just left. Anyway, after exchanging 10's of emails with RedSky, we pin-pointed the issue, it was PIXI, something was introduced after 4.0.2 that broke all interactions for players with browsers that support \"pointer events\". I couldn't thank RedSky enough for reporting this issue, and helping me relentlessly during the process. \"themoonrat\" from the PIXI project also deserves a mention, it's the second time he introduced something into PIXI that turned out to be catastrophic like this. In hindsight, this issue hurt Adventure Land when it mattered the most, our initial boost...",
	// htmls/logs.html:189; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.continuing-with-the-integrations": "Continuing with the integrations.",
	// htmls/logs.html:615; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.converted-our-wav-sound-files-to-ogg-s": "Converted our .wav sound files to .ogg's. While the Sound/FX system is experimental, no need to make people download huge .wav files.",
	// htmls/logs.html:200; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.crated-the-new-upgrade-compound-animation-it-iterates":
		"Crated the new upgrade/compound animation, it iterates over the existing assassin_smoke method. Finalised the exchange/upgrade/compound integrations for the new town.",
	// htmls/logs.html:929; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-a-new-internal-system-that-i-call":
		'Created a new internal system that I call "ACCESS", I build systems like these for all my projects (basically Geobird and Adventure Land), existing systems are Renderer, Executor, Viewer(s), this one is new, it gives practical remote access to the game server, a running process. I couldn\'t find a cooler name for it yet.',
	// htmls/logs.html:1021; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-a-small-island-with-3-overpowered-fairies": "Created a small island with 3 overpowered fairies and the soon-to-be appearance NPC.",
	// htmls/logs.html:1008; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-a-standalone-executable-with-electron-patched-things":
		"Created a standalone executable with Electron, patched things a bit to make it work, it was much simpler than I imagined it would be. It's much more fun playing the game in a separate window, browsers are super annoying, as they don't draw when the window/tab is out of focus. These standalone executables are perfect for CODE, and for casual playing, as playing in the browser can be distracting, if you are working and taking small breaks to venture in Adventure Land.",
	// htmls/logs.html:1112; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-a-very-basic-game-guide": "Created a very basic game guide",
	// htmls/logs.html:390; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-integrated-rudolph-added-the-drop-integrating-the":
		'Created/Integrated "Rudolph", added the drop. Integrating the "Winter Inn". We\'ve created a strong synergy with Jayson. I really don\'t want to delay the December 10th goal of launching the Xmas event. I\'ve already far-missed my timeline for the Steam Greenlight launch.',
	// htmls/logs.html:295; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-integrated-the-mining-tunnel-drops-mole-s":
		"Created/Integrated the mining tunnel + drops. Mole's aren't easy to farm, yet, in the long run, farming them will be very rewarding.",
	// htmls/logs.html:943; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-irradiated-goo-s-the-game-will-become": "Created \"Irradiated Goo\"s - The game will become 50 Shades of Goo's when I'm done.",
	// htmls/logs.html:1001; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-new-images-for-future-gems-one-more": "Created new images for future gems, one more common, one only drops at the soon-to-be launched PVP map.",
	// htmls/logs.html:924; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-skeletor-the-boss-of-the-pvp-region":
		'Created "Skeletor", the boss of the pvp region, he\'s super tough, but very kiteable by mages, however, since the region is PVP, a warrior can suprise and "pwn" the mage, so I feel it balances things.',
	// htmls/logs.html:875; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-first-custom-map-animations-a-small":
		"Created the first custom map animations, a small fire, iterated it, added a blue version too. Then tested some lava/fire pools. I love pixel animations, the game will be filled with them in the future.",
	// htmls/logs.html:539; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.created-the-first-example-code-https-github-com":
		'Created the first example code: <a target="_blank" href="https://github.com/kaansoral/adventureland_mongodb/blob/master/examples/" class="cancela"><span class="devlink">https://github.com/kaansoral/adventureland_mongodb/blob/master/examples/simple_but_improved.js</span></a> It\'s simple, yet it covers most of the early player questions, has conservative potion usage, target and path checks.',
	// htmls/logs.html:930; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-first-live-npc-so-basically-a":
		'Created the first "Live NPC" - so basically a NPC that is technically a player, the pvp blocker NPC will be live, he will move from the cave entrance to the revival zone when there are enough players for the pvp zone to unlock.',
	// htmls/logs.html:658; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-first-skillbar-prototype-items-can-be": "Created the first skillbar prototype, items can be dropped onto the skillbar.",
	// htmls/logs.html:959; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-first-test-dungeon-dungeon0-it-was": "Created the first test dungeon, \"dungeon0\", it was a joyful moment, no bugs, It just worked (It's a small rectangle with some Goo's)",
	// htmls/logs.html:276; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.created-the-graphics-for-our-new-items-with":
		'Created the graphics for our <a target="_blank" href="http://adventure.land/img/20x20b2.png" class="cancela"><span class="devlink">new items</span></a> with Ellian.',
	// htmls/logs.html:934; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-images-of-armor-box-and-weapon": 'Created the images of "Armor Box" and "Weapon Box" (Also "Jewellery Box", to-be-launched)',
	// htmls/logs.html:931; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-priest-s-mace-along-with-the": 'Created the "Priest\'s Mace", along with the image. Created a new pants image.',
	// htmls/logs.html:320; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.created-the-screenshots-i-was-planning-for-the":
		'Created the screenshots I was planning for the <a target="_blank" class="cancela" href="http://steamcommunity.com/sharedfiles/filedetails/?id=821265543"><span class="devlink">Steam Greenlight</span></a> page, wrote the descriptions, launched the page, it\'s a relief. Changed the game\'s Twitter username to @CodeMMORPG from @PixelMMORPG.',
	// htmls/logs.html:967; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-stone-of-wisdom-along-with-activate": 'Created the "Stone of Wisdom", along with "activate"/"morph" capabilities',
	// htmls/logs.html:942; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-tiny-ruby-for-the-pvp-zone": 'Created the "Tiny Ruby" for the pvp zone.',
	// htmls/logs.html:642; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-the-transport-npc-added-the-orange-snakes": "Created the Transport NPC, added the orange snakes to the Halloween map.",
	// htmls/logs.html:392; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.created-tier-1-5-for-the-xmas-items":
		"Created Tier 1.5 for the Xmas items, based on the Halloween experience, releasing a unique T2 armor with a high-drop rate wasn't a good idea, comparatively, Xmas items are much easier to achieve, much easier to upgrade thanks to their initially normal grade, and T1.5 doesn't wreck the game balance.",
	// htmls/logs.html:111; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.current-plan-is-to-address-the-initial-experience":
		"Current plan is to address the initial experience first. While the feedback has been positive until now, I believe initial players are struggling, they need more guidance. Especially with CODE. I really hate games with tutorials. But it's being requested too, not sure what to do about it yet. Adventure Land is a do whatever you want type of game. Not everyone likes it. Some want a tutorial and strict things to do. Some want purpose. First stage will likely be improving the CODE documentation and guiding new players through the process. After it's done, might introduce the game tutorial through code too, providing small snippets to walk the player through simple tasks.",
	// htmls/logs.html:597; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.dealt-with-a-user-drama-thanks-to-a":
		'Dealt with a user drama, thanks to a few players, my morale is usually pretty low lately, I keep dealing with same issues over and over again. To not deal with these issues again, wrote this: <a target="_blank" href="http://adventure.land/it-is-what-it-is" class="cancela"><span class="devlink">It Is What It Is</span></a>',
	// htmls/logs.html:1018; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.death-http-adventure-land-img-death-png":
		'Death: <a target="_blank" href="http://adventure.land/img/death.png" class="cancela"><span class="devlink">http://adventure.land/img/death.png</span></a>',
	// htmls/logs.html:838; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.decided-to-add-a-major-or-rather-significant": "Decided to add a major, or rather, significant, preferably player-facing feature every day, as I feel like the progress is slowing down.",
	// htmls/logs.html:496; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.decided-to-add-a-small-sales-tax-mainly":
		"Decided to add a small Sales Tax, mainly for fun, I think it will be educating for our young players too. With higher character level, the tax decreases.",
	// htmls/logs.html:662; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.decided-to-make-quiver-upgradeable-instead-of-compound":
		"Decided to make Quiver upgradeable, instead of compound like the Mage offhands, the distinction was unclear, I decided to determine the upgrade/compound difference based on size, small items should be combined. Combining 3 books make sense to me, yet combining 3 Quiver's doesn't.",
	// htmls/logs.html:224; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.deliagwath-brought-to-my-attention-that-the-grades":
		'Deliagwath brought to my attention that the grades of the "Orb of Second Chances" is [0,0] for the client and [0,1] for the servers. Ideally, I should update the server and the clients together, during an intermediary update I sent to the game clients, I forgot about the updated grades. As a result, a lot of people spent more gold compared to others that realised the server still references the [0,1] "grades" property. I can\'t describe how bad it felt. Corrected the issue, but, what\'s done is done, started adding a live-reload ability to the servers.',
	// htmls/logs.html:1109; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.deployed-tested-verified-americas-i-ii-and-europas": "Deployed/Tested/Verified Americas I,II and Europas I,II!! - The ping is down to 70ms for me. Next location: Eastlands",
	// htmls/logs.html:902; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.deployed-the-bank-http-adventure-land-img-bank":
		'Deployed the bank!: <a target="_blank" href="http://adventure.land/img/bank.png" class="cancela"><span class="devlink">http://adventure.land/img/bank.png</span></a>',
	// htmls/logs.html:918; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.deployed-the-improvements-fixed-the-initial-issues-re": "Deployed the improvements, fixed the initial issues, re-balanced the pvp zone, increased gem drops",
	// htmls/logs.html:595; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.deployed-the-improvements-of-the-last-10-days": "Deployed the improvements of the last 10 days, including the Merchant class, skillbar, chat dialogs.",
	// htmls/logs.html:220; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.designed-an-improvement-to-overcome-this-scenario": "Designed an improvement to overcome this scenario.",
	// htmls/logs.html:582; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.designed-implemented-the-first-version-of-the-new": "Designed + Implemented the first version of the new upgrade system. It ended up being too unbalanced, needs some balancing :]",
	// htmls/logs.html:911; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.designed-the-bank-map-the-counters-interior-design": "Designed the bank map, the counters, interior design, I just love the bank.",
	// htmls/logs.html:291; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.designed-the-system-that-will-govern-the-weapon": "Designed the system that will govern the weapon tiering. Calibrated the T2 Bow which is heavily requested by the community.",
	// htmls/logs.html:993; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.designing-a-new-map-and-new-server-events": "Designing a new map and new server events",
	// htmls/logs.html:550; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.designing-our-high-and-rare-grade-items-the":
		"Designing our high and rare grade items. The challenge is mainly the acquisition and economy. Rare grade items should truly be rare and High Grade items should be hard to find. There are a magnitude of options. The easiest ones are having them as more seldom drops, or having them as rng/chest drops. Another idea that started shaping is small/local quests. Instead of monsters dropping stuff, they could drop quest items which can be exchanged for random rewards in some quantities.",
	// htmls/logs.html:5; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.development": "Development",
	// htmls/logs.html:821; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.disabled-stripe-for-now-i-need-to-refactor":
		"Disabled Stripe for now, I need to refactor servers to use secure connections, it's not trivial, I'm also unsure whether the overhead is significant. The practical Stripe UX I implemented just used an overlay on top fo the game, so it was HTTP, against Stripe's rules. For now Super Rewards seems more than enough.",
	// htmls/logs.html:994; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.disabled-the-chaotic-cross-party-xp-messages-where":
		"Disabled the chaotic cross-party +XP messages, where the +XP would show up on every member of the party, it was initially cool tho, I will later add it as an option.",
	// htmls/logs.html:870; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.disappearing-lines-there-was-no-way-to-know":
		"<span class='big'>Disappearing Lines!</span> There was no way to know who attacked who before. I initially didn't like these too much, now I can't imagine the game without them. I like scripting a party with CODE, now it's much more enjoyable, watching the interactions through lines :]",
	// htmls/logs.html:450; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.discovered-and-fixed-a-rare-server-issue-newly":
		"Discovered and fixed a rare server issue, newly introduced, improved the server system, now PVP and TEST servers have unique names (not I,II,II etc.).",
	// htmls/logs.html:178; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.discovered-another-pixi-bug-curse-started-causing-issues":
		'Discovered another PIXI bug, "Curse" started causing issues, two filters can no longer be combined, there are other reported issues too, WebGL crashes are continuing.',
	// htmls/logs.html:1074; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.discovered-game-s-first-not-cheater-with-his":
		'Discovered game\'s first "not cheater" with his own words, "Sammy", I was super proud, It was such a happy moment. To build a game, and have a cheater this fast, almost brought me to tears.',
	// htmls/logs.html:628; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.discovered-that-app-engine-s-mail-deprecation-affects":
		"Discovered that App Engine's mail deprecation affects the game too, can't send all those emails tomorrow, I'm deeply saddened and worried.",
	// htmls/logs.html:613; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.discovering-the-email-issue-the-day-before-my":
		"Discovering the email issue the day before, my morale was down, I started integrating Amazon's SES, and email integrations are usually very challenging, it involves DNS changes, integration, testing, custom systems to send emails in a robust manner. Luckily, the integration+testing parts were a breeze. I also had existing routines that sent a small amount of emails from Amazon SES, that helped too.",
	// htmls/logs.html:551; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.draivin-has-been-helping-me-a-lot-behind":
		"draivin has been helping me a lot behind the scenes, he first came to me with his performance analysis around our October rush, it was a very pleasant surprise to receive an external performance analysis and suggestions for improvements, with his encouragement, I accelerated our new map/draw system, which has now been launched and matured, otherwise, I was going to postpone that system for some time. After that, instead of my calculate_move, we moved onto his optimised version of calculate_move, and today, he contributed another component to the game, one that will check for line violations. I truly appreciate his help. I never expected to get outside help at these levels. Thanks to his help, I can concentrate on the design aspect of the game more.",
	// htmls/logs.html:233; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.due-to-weather-conditions-jayson-wasn-t-around":
		"Due to weather conditions Jayson wasn't around for the last 2 weeks. He's also been in a motorcycle accident recently. He says he's ok but I'm not sure. I sincerely hope he gets well soon.",
	// htmls/logs.html:919; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.during-the-last-few-days-the-bank-design": 'During the last few days, the "Bank" design in my mind became clearer, started implementing the internal systems',
	// htmls/logs.html:246; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.earlier-i-made-some-performance-improvements-to-the":
		"Earlier, I made some performance improvements to the game, an oversight was causing the inventory size not to be re-calculated after upgrades and compounds, fixed that issue and applied the same performance improvements to other places.",
	// htmls/logs.html:1003; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.exchange-http-adventure-land-img-exchange-png":
		'EXCHANGE: <a target="_blank" href="http://adventure.land/img/exchange.png" class="cancela"><span class="devlink">http://adventure.land/img/exchange.png</span></a>',
	// htmls/logs.html:329; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.executed-the-small-giveaway-i-was-planning-both":
		"Executed the small giveaway I was planning, both players and I are probably getting very fluent at creating small functional scripts. In the past, I used to add features/code to projects I work on, for even the smallest task, nowadays everything has a small script - Interestingly, the game is very similar too, for different gaming occasions, one can whip up a modified Code.",
	// htmls/logs.html:837; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.experienced-a-bank-dejavu-i-wasn-t-sure":
		"Experienced a bank dejavu, I wasn't sure, but it seemed like the bank rolled back. Extremely concerning. Trade routines have to be flawless. I investigated but couldn't reproduce.",
	// htmls/logs.html:926; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.experimented-with-bitmap-text-s-fonts-converted-to":
		'Experimented with "Bitmap Text"s - fonts converted to images, going to convert names to bitmap texts at one point in the future, probably.',
	// htmls/logs.html:677; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.experimented-with-class-previews-at-character-creation-the": "Experimented with class previews at character creation, the idea developed quickly, completed all classes.",
	// htmls/logs.html:1058; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.experimented-with-some-alternative-character-graphics-ones-that": "Experimented with some alternative character graphics, ones that iterate over existing ones",
	// htmls/logs.html:884; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.explored-the-casino-tavern-options-a-bit-i":
		"Explored the casino/tavern options a bit. I want the game to have a communal place for chance games, nothing serious. just a place in a 2D pixel world where people could hang out casually. Such a place should have basic but fun games. Some single player, some multiplayer.",
	// htmls/logs.html:445; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finalised-the-christmas-events-and-items-the-most":
		'Finalised the Christmas Events and Items, the most exciting item is an Orb, Orb of Good Spirits, in addition to stats, it also has an ability called "Second Chances" - with a % chance, revives the player when HP hits 0.',
	// htmls/logs.html:932; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finalised-the-tier-2-armors-they-will-drop":
		'Finalised the "Tier 2" armors, they will drop mainly from the "Armor Box", named them with "Sturdy" and "Rugged" prefixes, "Leather" would have been more appropriate. Going to rename and re-style them in the future.',
	// htmls/logs.html:363; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finalising-the-new-drops-added-the-stat-ring":
		"Finalising the new drops, added the stat ring drops, previously, all stat based drops were diverse, a stramulet and intamulet had the same drop rate, this is no longer the case.",
	// htmls/logs.html:1057; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finally-added-range-checks-to-attacks-i-intentionally":
		"Finally added range checks to attacks, I intentionally left it unchecked originally, even now it needs another iteration before PVP becomes serious, currently it's heavy lag-friendly",
	// htmls/logs.html:824; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finally-caught-the-bank-issue-it-was-more":
		"Finally caught the bank issue, it was more extreme than I thought, on one side, I'm glad that it was an obvious issue, on another side, It's a shame that I let such a major issue pass. It happened because I was improving the synchronization routine, jumped onto something else, then left a simple yet deadly routine in place. Basically, every 5 minutes, the bank was automatically unmounted. So if a player got into the bank, wait 5 minutes, took everything, those items/gold would still be there.",
	// htmls/logs.html:619; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finally-deployed-the-game-made-early-tests-and":
		"Finally deployed the game, made early tests, and triggered the email sender routine. Checked the logs, and got devastated when I found out about the 14 emails/second limit Amazon SES has, most of the emails were wasted, and since I didn't track email routine completion, there was no easy way to retry. If I retried, some players would receive the email twice. Devastated, I went to sleep.",
	// htmls/logs.html:103; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.finally-mostly-healed-took-some-time-off-last":
		"Finally mostly healed, took some time off last week. Last 2 weeks was harsh, but I believe I have a clear vision of what to do now. Going to completely revamp the initial player experience, add a unique, code assisted tutorial that accompanies the player when they first start playing. I'm still very much anti-(must complete tutorial) and anti-(starting zone), so this tutorial will be unintrusive and optional. Each step will both teach the player of the things they can do in-game, and show them how it's done in Code. Use smart_move to move them from place to place, on their command.",
	// htmls/logs.html:132; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.first-app-engine-normally-i-was-a-big":
		"First, App Engine: Normally I was a big fan of App Engine, in the early days, they were extremely dynamic, at their peak, even Guido van Rossum was part of the team and the entire team interacted with developers. Nowadays, it's just a shadow of those glorious days. Total neglect and incompetence. It's clear that the team, if there's a team, has no grip on the product. Is it still the best cloud product out there? Most probably. And if you push enough, you get things recognized. If you push really hard? maybe you could get problems solved.",
	// htmls/logs.html:989; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.first-event-designed-goo-brawl-everyone-is-teleported":
		'First event designed: "Goo Brawl"! :] Everyone is teleported to a small island with Super Goo\'s that have super drops. 5 minutes.',
	// htmls/logs.html:999; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.first-game-refactoring-refactored-item-formats-and-routines": "First game refactoring, refactored item formats and routines, there were no casualties, it was a smooth operation.",
	// htmls/logs.html:1060; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.first-version-of-music": "First version of Music!",
	// htmls/logs.html:939; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fixed-a-bug-that-eluded-me-for-some":
		"Fixed a bug that eluded me for some time, along with the bugfix, made some performance improvements to the mapping, the bug occurred when a tile had uneven width/height.",
	// htmls/logs.html:407; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fixed-a-memory-leak-that-affected-hp-bar":
		"Fixed a memory leak that affected HP Bar's and Name Tag's. The leak only became noticeable after making Name Tag's toggle on/off and dynamic.",
	// htmls/logs.html:617; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fixed-our-new-ranger-warrior-characters-they-had": "Fixed our new Ranger/Warrior characters, they had 1-2 pixel issues that were only noticeable when they walked.",
	// htmls/logs.html:581; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fixed-our-new-smooth-movement-routine": "Fixed our new/smooth movement routine.",
	// htmls/logs.html:1022; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fixed-the-character-movement-boundary-checks-previously-it": "Fixed the character movement boundary checks. Previously it was possible to walk outside boundaries in rare circumstances.",
	// htmls/logs.html:359; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fixed-the-count-for-the-leather-quest-fixed":
		"Fixed the count for the leather quest. Fixed an issue affecting the .cursed,.stunned properties for monsters, they weren't being removed, and monsters stayed cursed or stunned.",
	// htmls/logs.html:878; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.found-a-bank-issue-added-retry-fail-logic":
		"Found a bank issue. Added retry+fail logic to the bank routines, and other routines while at it. Improved the character start/sync/stop routines. Fixed some newly introduced bugs.",
	// htmls/logs.html:826; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.found-and-started-investigating-a-serious-electron-issue":
		"Found and started investigating a serious Electron issue, It seems it could be related to the CODE issue I was experiencing myself. I use OSX, most players are on Windows, so the issues are not always shared.",
	// htmls/logs.html:748; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.found-reported-an-electron-bug-researched-browser-notifications":
		"Found/Reported an Electron bug, Researched browser notifications. Chrome notifications are more complex than I thought. The background listener part. Going to pull the trigger and start integrating at one point tho.",
	// htmls/logs.html:466; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.found-some-nice-solutions-to-some-of-the":
		"Found some nice solutions to some of the PVP challenges, asked for feedback on Discord. The main challenge is always healing, Priest's heals are over-powered, considering future levels of armor and res, the heals will only become more powerful. So today's idea is to start adding abilities, skills to block heals. The obvious one is Priest's own Curse, another one is, a \"Hex Arrow\" for Ranger's. It will be a rare item that needs to be farmed. Some weapons, items might also receive similar abilities of their own.",
	// htmls/logs.html:168; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.from-now-on-without-any-format-i-will":
		"From now on, without any format, I will use this page as an occasional blog, to write about things, thoughts, feelings - and of course, about the game",
	// htmls/logs.html:957; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.fun-day-for-me-refactoring": "Fun day for me: Refactoring",
	// htmls/logs.html:579; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.further-balanced-the-pvp-the-respawn-mp-is": "Further balanced the PVP, the respawn MP is now 50%.",
	// htmls/logs.html:369; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.further-enriched-the-leather-quest-there-are-other": "Further enriched the leather quest, there are other very rare armors too. Might increase the droprate of the armors.",
	// htmls/logs.html:747; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.generated-many-improvement-ideas-most-are-related-to":
		'Generated many improvement ideas, most are related to Premium Items, and how they need to look, I Just stopped liking my placeholder/improvised images. Going to turn these items into variations of the "Tome of Protection" image/design that I love. The tome with different scriblings on them.',
	// htmls/logs.html:219; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.gleich-s-code-was-pretty-innocent-too-the":
		"Gleich's code was pretty innocent too, the coded behaviour was to escape when someone is spotted, but, for a human, the observed behaviour was a cheater/stalker (as the character is outside the map boundaries, in the bank) exiting the game when he spots someone, which was very creepy.",
	// htmls/logs.html:262; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.going-forward-code-teaching-aspect-of-the-game":
		"<span style=\"color: #2C941A\">Going Forward:</span> Code/Teaching aspect of the game inspired me to go back to university and complete my master's degree and continue on from there. I wish to start a family too, during my emotional turmoil in 2016, I concluded that business endeavours shouldn't be primary objectives, but rather, secondary bonuses. For the game, tavern, daily events, code improvements, communicator, skills, items - there are a lot of exciting stuff to work on. My mistake these couple of months was to set clear objectives and deadlines, they killed my productivity, stressed me, going forward, I intend to continue on with a more scattered approach. As an aspiring game developer, I couldn't wish for a better community, I'm extremely thankful. Thanks to you all, it's a joy working on the game with all the feedback, suggestions and the company. Looking forward to our Steam release.",
	// htmls/logs.html:190; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.got-the-idea-to-add-a-new-attack":
		"Got the idea to add a new attack animation, non-moving entities now nudge forwards when they attack. Monsters that don't have an idle animation really needed this.",
	// htmls/logs.html:596; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.had-to-make-a-lot-of-restarts-for":
		"Had to make a lot of restarts, for small improvements, things seemed stable afterwards, went to sleep. - Woke up to only 2 servers alive, Checked Discord, apparently there was a very simple and obvious issue that a player discovered. Normally server exceptions were handled, this issue broke that routine. Revised/Improved exception handling and re-deployed. Now exceptions cost 10 calls.",
	// htmls/logs.html:325; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.highlight-of-the-day-is-our-second-reddit":
		'Highlight of the day is our second <a target="_blank" class="cancela" href="https://www.reddit.com/r/MMORPG/comments/5j0lgc/adventure_land_the_code_mmorpg_winterland_xmas/"><span class="devlink">Reddit</span></a> announcement, once again, it was a joy to start welcoming new players',
	// htmls/logs.html:1132; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.honestly-it-was-super-fun": "Honestly, it was super fun",
	// htmls/logs.html:570; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.hot-patched-some-game-issues-improved-my-workflow":
		"Hot-patched some game issues, improved my workflow to allow more hot-patches like these, manually patched OSX/Firefox to use Canvas instead of WebGL.",
	// htmls/logs.html:797; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-don-t-know-whether-it-s-the":
		"I don't know whether it's the case, or just what I feel, but user acquisition is a real struggle in the age we are in. Things weren't like this, let's say, 5 years ago. My solution is to give players something for helping the game grow. While I have a very humble ad running, the real growth is from player-to-player sharing. People enjoying the game and inviting their friends. So my strategy from this point forwards is to give SHELLS to players for inviting their friends, hence the \"Referral\" system. I might find a cooler name for it.",
	// htmls/logs.html:251; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.i-had-180m-on-my-local-test-character":
		'I had 180M on my local test character, lost it, added another 400M, lost it, so Roulette itself is a fun gold sink, verified. Not all games will be like this tho, the next game will likely be player-vs-player and similar to <a target="_blank" href="https://en.wikipedia.org/wiki/Pig_(dice_game)" class="cancela"><span class="devlink">this game</span></a>.',
	// htmls/logs.html:123; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-had-a-good-thing-going-until-october":
		"I had a good thing going until October, but when the cold winter arrived, it became a challenge to wake up at 7am and prepare to start working at 8am. I couldn't maintain that work schedule for long. If I lived alone and had the opportunity to concentrate in a healthy and serene work environment, it would have been possible, but sadly, it ended.",
	// htmls/logs.html:825; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-had-improvements-in-mind-that-would-push":
		"I had improvements in-mind that would push the bank routines from 99.5% to 99.99% (hopeful, made-up numbers) - so I ended up making those. Now it seems almost impossible to cause a discrepancy. Even in extreme circumstances.",
	// htmls/logs.html:162; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-have-a-lot-more-to-write-about": "I have a lot more to write about in the coming days, possibly a hefty blogpost.",
	// htmls/logs.html:437; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-have-a-relaxed-and-simple-approach-to":
		"I have a relaxed and simple approach to security, my assumption was, if people are challenged too much while recovering their passwords, they might quit instead, this is why I initially chose to keep passwords in plain text, it seems the practice is heavily frowned upon, live and learn, we lost a valued member today, as I predicted earlier, the lifetime of the game is 60 days for most people, which is more than enough, I just wish, after bonding, getting to know each other, people would quit in a more joyful manner. Game moderation, development, is more challenging than I thought.",
	// htmls/logs.html:131; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-ll-start-this-small-informal-blog-post": "I'll start this small informal blog post about issues and ramblings about Cloud.",
	// htmls/logs.html:521; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-love-refactoring-today-was-a-fun-day":
		"I love refactoring, today was a fun day. Added a new layer on top of all items, this was something I wanted to do for a long time, It ended up being a lot simpler and fun than I thought it would be. Also had the opportunity to improve the performance and bandwidth along with these improvements.",
	// htmls/logs.html:557; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-m-already-behind-my-schedule-for-our":
		"I'm already behind my schedule for our Steam release, like 2 weeks late, so with an impulse decision, decided to just go ahead and shoot a gameplay video for Steam Greenlight, thanks to our awesome community, we recorded one in 15 minutes. Turns out my OSX recording solution had a lot of issues, FPS was very low, but it still felt great, we had a lot of fun, and gained a lot of experience for the next try.",
	// htmls/logs.html:734; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-m-really-worried-that-people-will-feel":
		"I'm really worried that people will feel cheated by \"Random Looks\", you might prefer a male look, but you can also get a female look, I considered letting people choose/buy a specific look. Still not sure. I personally like chaos, taking my chances, so It's probably best to stick with the current dynamics.",
	// htmls/logs.html:546; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-m-spending-a-lot-of-time-outside":
		"I'm spending a lot of time outside lately, normally I concentrate on work, but becoming 26 hit me hard, when you are young, you can take a lot of risks easily, but I feel like I can't use work as an excuse any more, there's also the constant feeling of stress, and I feel like I've under-achieved. On the bright side, there are a lot to be grateful for, I've started receiving emotional support from friends and family, so things are progressing well.",
	// htmls/logs.html:1013; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-personally-don-t-like-how-town-works":
		'I personally don\'t like how "TOWN" works right now, without any animation you just re-appear in the main spawn point, so cold. For this reason I decided to make death colourful and fun (actually the opposite). When you die, you turn into a tombstone, the game becomes black and white, but you can still talk with others until you press "RESPAWN".',
	// htmls/logs.html:848; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-play-the-game-as-any-other-player":
		"I play the game as any other player, so while the premium items existed, I didn't/couldn't get any, this was kind of the reason why I launched SHELLS this early, to get some premium items myself as I couldn't wait any more. I set the game to give me 200 SHELLS every hour. To experience the dynamics first hand.",
	// htmls/logs.html:568; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-previously-decided-against-it-yet-as-pvp":
		"I previously decided against it, yet, as PVP became further tested, it seems increasing the character HP's will be a good idea, it also allows stronger weapons.",
	// htmls/logs.html:951; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-realised-i-should-do-what-i-do":
		'I realised I should do what I do/enjoy the best and collaborate with others who are better at things I struggle at. In this regard, the "Community Map Editor" proved to be extremely useful.',
	// htmls/logs.html:731; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-really-like-armor-piercing-added-it-to":
		'I really like "Armor Piercing", added it to the "Spear", makes a lot of sense too, since a "Spear" could pierce an armor. Practically, 50 armor piercing, increases damage by ~5%, which is a lot.',
	// htmls/logs.html:170; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-sincerely-hope-it-ends-up-being-a":
		"I sincerely hope it ends up being a good decision, on the bright side, games are timeless, so additional time spent working on a game could tip the scales significantly in the long run, received a lot of feedback, experienced a feedback overload, some were really good, some were misleading, demotivating, but in the end, spotted a lot of core issues, it was a great learning experience, I can tell you this much",
	// htmls/logs.html:136; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-started-web-development-with-dedicated-servers-those":
		"I started web development with Dedicated Servers, those were the days. I had 3-4 ServerLoft dedicated servers at my peak. It was a pain manually scaling things. That's why I moved to App Engine later on. More expensive, but could be 1:1 and more practical if you use it well. After reseach, 2 candidates popped up, Hetzner and OVH groups. They provide the best performance-bucks ratio possible.",
	// htmls/logs.html:741; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-think-i-m-just-adding-a-new":
		"I think I'm just adding a new feature every day to procrastinate, so I asked the regulars what they thought about \"Item Ability\"'s, so basically I asked Aiek and Oragon, they were around at the time, they both liked the idea. I like it too now. It ~complicates the game, but let's hope in a good way.",
	// htmls/logs.html:218; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-ve-asked-gleich-about-the-situation-didn":
		"I've asked Gleich about the situation, didn't want to take action, and as it turns out, it was a bug/shortcoming, causing the misunderstanding. With the investigation of Deliagwath; Gleich, theZhoul and Deliagwath managed to replicate the bug. During a transport, there's a brief time where the client is in the old position, after the server moves the character to the new position, when the client moves during that short time period, it was possible to move outside the map unintentionally.",
	// htmls/logs.html:697; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-ve-been-trapped-in-the-next-feature":
		"I've been trapped in the \"Next Feature Fallacy\" loop once again, I know that the game needs more adventure, events, the launch of the new maps that Jayson prepared, but it's easier to make/build/add other things. (Also new players, friends system etc. to keep the momentum going)",
	// htmls/logs.html:402; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-ve-improved-the-internal-drops-and-exchange":
		'I\'ve improved the internal "Drops and Exchange" system of the game, now it\'s more like a "Forest" in computer science terms, makes it really practical to design and set drops.',
	// htmls/logs.html:700; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-ve-talked-to-a-lot-of-players":
		"I've talked to a lot of players by now, received feedback, they asked questions, but, interestingly, no one asked about the \"3 Unknown Slots\", well they are Orb's, tested some alternative Orb's today, felt the balance, thought about the dynamics, not sure I'm going to keep to the original idea of adding Orb's as items. Postponing this decision.",
	// htmls/logs.html:693; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-was-hoping-but-wasn-t-expecting-such":
		"I was hoping, but wasn't expecting such a rush, going to pay my logs debt soon, I have the habit of taking regular notes, so at one point, I'm going to re-visit and summarise the story here",
	// htmls/logs.html:605; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.i-went-to-sleep-but-woke-up-early":
		"I went to sleep, but woke up early, anxiously, during sleep, I was constantly worried about the servers, and when I woke up, indeed, the servers were down.",
	// htmls/logs.html:707; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.ideally-a-warrior-shouldn-t-one-hit-a":
		"Ideally, a warrior shouldn't one-hit a mage and the current dynamics are balanced, maybe not super-well-balanced, but at least it's fun-balanced.",
	// htmls/logs.html:1035; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.ideally-font-worries-should-be-delayed-but-i":
		'Ideally "font" worries should be delayed, but I indulged myself. Found an extremely simple method to perfect the font-rendering in-game. Basically you draw texts 2x or 4x and shrink them. I might post it on Stack Overflow at one point. It\'s a simple solution to haunting blurry Canvas text issues.',
	// htmls/logs.html:110; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.if-it-goes-like-this-and-i-hope":
		"If it goes like this, and I hope it does, it seems Adventure Land will be cash positive. I've been burning through my savings for the last 4 years, going through $1-2K every month. I really look forward to being profitable once again. Thanks to such a positive outcome, I feel like I'm healing faster too, I do believe the immune system functions better with high motivation.",
	// htmls/logs.html:1117; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-a-password-reminder-email-feature-the-button": "Implemented a password reminder email feature, the button shows up when you fail to enter your password",
	// htmls/logs.html:845; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-a-simple-mapping-routine-as-the-map":
		"Implemented a simple Mapping routine, as the Map in Mapreduce, I love to reinvent the wheel whenever possible, especially for data processing. The mapping routine for Adventure Land is both super simple and robust.",
	// htmls/logs.html:559; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-a-smooth-walk-routine-some-code-s":
		'Implemented a "Smooth Walk" routine, some Code\'s walk in 1px/2px, it ends up being very displeasing, for such short movements, the walking animation can\'t even start, so rigged something up to try and merge those short walks. The ultimate solution is probably to disregard such short walks. And I think we need a "Code Etiquette" guide.',
	// htmls/logs.html:765; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-a-speed-recalculation-logic-at-both-server":
		"Implemented a speed recalculation logic at both server and client, this is a revelating improvement, as dynamic speed adjustments are super practical now. It was needed for Charge, Curse abilities too.",
	// htmls/logs.html:832; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-abilities-invis-is-the-first-one-and":
		'Implemented "Abilities", "Invis" is the first one, and probably would be the most challenging one, but it turned out pretty simple. When the "Assassin" class is added. The "Invis" will be their edge.',
	// htmls/logs.html:867; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-aggressiveness-this-is-a-simple-yet-major":
		'Implemented "Aggressiveness". This is a simple yet major update. The underlying system is also remarkably efficient, otherwise it would have been costly to make each monster find someone to attack whenever it\'s able to do so. The same system/method/data-structure might also increase the game performance significantly at a future rewrite -but- the main movement/map logic is much more complex for this method to be easily accessible. I got the idea from Geobird, it\'s "geo-hashing", both simple and efficient/effective when calibrated.',
	// htmls/logs.html:625; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-an-email-system-to-email-all-players": "Implemented an email system to email all players. Created a Halloween Event announcement email.",
	// htmls/logs.html:1108; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-auto-server-selection-based-on-rough-distance": "Implemented auto server selection based on rough distance",
	// htmls/logs.html:814; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-calibrated-the-mana-burst-ability-for-mage":
		"Implemented, Calibrated the \"Mana Burst\" ability for Mage's. Added a custom animation and a custom disappearing line. When used, it converts half the mana to damage. It's intended to be used during PVP. I find the ability pretty balanced. It's only super-useful for 1V1 encounters where a Mana Burst is enough to kill the opponent. After the burst, a pot usage is needed to attack again. The ability doesn't affect the attack cooldown.",
	// htmls/logs.html:1052; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-conf-for-game-settings-along-with-default": 'Implemented "CONF" for game settings, along with default-off Music/SFX switches',
	// htmls/logs.html:1103; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-f-activate-nearest-npc-it-s-possible": "Implemented \"F\"/Activate Nearest NPC - It's possible to block NPC's, this should solve that challenge",
	// htmls/logs.html:958; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-instances-to-replace-maps-this-new-system":
		'Implemented "instances" to replace "maps", this new system isolates maps, increases performance, also allows things like "dungeons", spontaneous server events, solo zones, party zones, and so on. :]',
	// htmls/logs.html:976; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-new-payment-routines-and-interfaces-improved-the":
		"Implemented new payment routines and interfaces, Improved the existing ones, going to roll them out with the next major update.",
	// htmls/logs.html:733; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-skin-looks-selection-it-works-yet-i":
		'Implemented "skin"/"Looks" selection, it works, yet I need to add a client routine to update the looks for both the player and others nearby.',
	// htmls/logs.html:256; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-started-the-internal-architecture-for-the-tavern": "Implemented/Started the internal architecture for the Tavern, started building the Roulette.",
	// htmls/logs.html:760; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-charge-effect-that-leaves-disappearing-clone": "Implemented the \"Charge\" effect that leaves disappearing clone's in it's wake.",
	// htmls/logs.html:755; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-curse-ability-for-priest-s-it":
		'Implemented the "Curse" ability for Priest\'s. It\'s a first on many fronts. The attack routine was improved with amplifications, de-amplifications. Integrated it with animations, added a custom line color, added a custom filter to change the cursed entity color. Added a "[C]" indicator to the focus interface. The curse both slows, reduces attack and increases damage taken. Especially useful for PVP.',
	// htmls/logs.html:423; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-damage-return-property-armadillo-is-going":
		'Implemented the "Damage Return" property, Armadillo is going to receive it, and in the future, there will be items that add "Damage Return" to players. It\'s physical and melee only, however, it might affect close-range ranged attacks at one point too.',
	// htmls/logs.html:1027; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-definite-fix-to-the-consecutive-item":
		"Implemented the definite fix to the consecutive item upgrade issues. On slow systems, it was still possible to re-upgrade items before the game was re-drawn. Not anymore :)",
	// htmls/logs.html:444; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-elixir-logic-the-usage-expiry-integrations": "Implemented the Elixir logic, the usage, expiry, integrations.",
	// htmls/logs.html:910; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-gold-npc-and-withdraw-deposit": 'Implemented the Gold NPC, and "withdraw"/"deposit".',
	// htmls/logs.html:1040; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-initial-fix-for-the-consequent-upgrade":
		"Implemented the initial fix for the consequent upgrade issue that came up a lot. Diverted a portion of my efforts back to Geobird. My performance will drop until I re-balance.",
	// htmls/logs.html:915; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-internal-bank-connections-persistence-server-logic":
		"Implemented the internal bank connections, persistence, server logic. All trade systems have to be flawless, even the smallest oversight could devastate the game economy.",
	// htmls/logs.html:1107; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-multi-server-ui-logic-server-switching": "Implemented the multi-server UI/logic, server switching",
	// htmls/logs.html:851; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-noob-mode-one-of-the-main":
		'Implemented the "Noob Mode", one of the main issues of the game is that people don\'t interact with interfaces too much, to see what does what, back in the day, game interfaces was cryptic as hell, nowadays, smallest challenge and you lose a player. So this mode puts INV/CHAR/STATS/GUIDE buttons to the top. While the "Pro Mode" replaces them with CODE/PING.',
	// htmls/logs.html:250; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-roulette-it-can-be-played-through":
		"Implemented the Roulette, it can be played through Code, the UI will arrive later on, I'm thinking a monster running on a mill with numbers, when the monster stops, a number is selected.",
	// htmls/logs.html:281; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-second-chance-ability-it-s-a":
		"Implemented the \"Second Chance\" ability, it's a fun one, the Orb's increase code complexity too, which is a direction I aim for, even if one gets a better Orb in the future, it makes sense to equip the Xmas Orb's just before death. Modified the \"Orb of Second Chances\" to be rare at +0, the modification will be live after new year's eve when the event is over.",
	// htmls/logs.html:1053; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-sfx-logic-improved-the-music-logic": "Implemented the SFX logic, Improved the Music logic",
	// htmls/logs.html:962; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-stone-of-wisdom-luck-riches-dynamics":
		'Implemented the "Stone of Wisdom/Luck/Riches" dynamics, calibrated, created images for the stone\'s (used Primordial Shard as a starting point)',
	// htmls/logs.html:358; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implemented-the-system-for-additional-bank-slots-they":
		"Implemented the system for additional bank slots. They can be unlocked with Gold or Shells. Jayson created the first version of the new bank with 8 Clerks.",
	// htmls/logs.html:160; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.implementing-the-mail-routines-there-will-be-multiple":
		'Implementing the "Mail" routines. There will be multiple types of mails, most needed one (from my side) is game-to-player mails, for example, the game needs a "Recruitment Actions" interface, they will be in-game mails instead, when you recruit someone, when someone you recruit achieves something, you will receive an in-game Mail, possibly for a lot of other things too.',
	// htmls/logs.html:736; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.imported-jayson-s-town-as-main2-it-will": 'Imported Jayson\'s town as "main2", It will exist along with the current town for now.',
	// htmls/logs.html:844; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-and-completed-the-stripe-payment-system-integration":
		"Improved and completed the Stripe payment system integration+UI/UX/logic. I love how Stripe makes credit card payments simple.",
	// htmls/logs.html:940; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-and-highly-simplified-player-right-clicks-implemented":
		'Improved and highly simplified player right clicks, Implemented "PVP Death Loss" dynamics, currently both xp and gold are transfered.',
	// htmls/logs.html:1007; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-code-added-new-functions-heal-buy-upgrade": "Improved CODE, added new functions: heal, buy, upgrade, get_player(name)",
	// htmls/logs.html:1128; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.improved-code-runner-features-populated-https-github-com":
		'Improved Code/runner features, populated <a target="_blank" href="https://github.com/kaansoral/adventureland_mongodb" class="cancela"><span class="devlink">https://github.com/kaansoral/adventureland_mongodb</span></a>',
	// htmls/logs.html:831; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-finalised-the-pvp-indicator-ui-started-designing":
		'Improved/Finalised the PVP Indicator UI. Started designing the "Friends" UI/UX. It\'s not simple yet. It should be simple and fun.',
	// htmls/logs.html:574; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.improved-https-adventure-land-shells-there-is-a":
		'Improved <a target="_blank" href="https://adventure.land/shells" class="cancela"><span class="devlink">https://adventure.land/shells</span></a>. There is a new map in the background. Going to integrate this soon.',
	// htmls/logs.html:1121; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-monster-player-movements-now-there-is-an": "Improved monster/player movements, now there is an abrupt stop logic and dynamic speed calibrations",
	// htmls/logs.html:1075; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-npc-s-to-be-left-clickable-they":
		"Improved NPC's to be left-clickable, they activate, in future they should have a different left-click behaviour, probably a name and a story.",
	// htmls/logs.html:483; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-our-internal-map-editor-added-the-ability": "Improved our internal map editor, added the ability to visualise monster packs on the map, it eases map design significantly.",
	// htmls/logs.html:779; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-patched-many-of-the-server-routines-these": "Improved/Patched many of the server routines. These improvements are to make the game glitch-free, and in-future, abuse-free.",
	// htmls/logs.html:531; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-pvp-dynamics-further-invincible-deals-45-damage": "Improved PVP dynamics further, .invincible deals 45% damage, both Supershot and Mana Burst received an initial cooldown.",
	// htmls/logs.html:588; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-pvp-dynamics-significantly-xp-and-gold-loss":
		"Improved PVP dynamics significantly, xp and gold loss now factors the attacker's xp and gold. Both attacker and target are now blocked from escaping for 3.6 seconds. These improvements make combats more honourable. Considering adding a delay to server hopping too.",
	// htmls/logs.html:833; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-simplified-extended-the-character-effects-filters-like": "Improved, Simplified, Extended the character effects/filters. Like the existing item-glows, invis fade-away, etc.",
	// htmls/logs.html:900; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-auth-and-transport-routines-of-the":
		'Improved the "auth" and "transport" routines of the server. Patched the game so re-calling some routines are safe. So it won\'t be possible to cause glitches whether intentionally or unintentionally.',
	// htmls/logs.html:571; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-design-of-our-new-items-have": "Improved the design of our new items. Have an items.txt that I'm continually improving.",
	// htmls/logs.html:310; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-design-of-the-new-town-discovered":
		"Improved the design of the New Town. Discovered a visibility issue, in the original town, when someone moves from a certain point to the merchant area, some merchants are invisible, patched the issue.",
	// htmls/logs.html:1073; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-drag-equip-dynamics-a-lot-further":
		"Improved the drag/equip dynamics a lot further, now things can be dragged to the Character slots, and vice versa. Previously drag was only inside the inventory.",
	// htmls/logs.html:464; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-exchange-system-to-support-quests-too":
		'Improved the "Exchange" system to support Quests too. Added the "Seashell" item, drops on the beach, the Fisherman NPC collects them, you can turn over 20 to receive a random rewards. These NPC Quests will be the only source of some items. Some Elixirs, Some Rare Accessories, Some Scrolls.',
	// htmls/logs.html:300; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-friends-server-guildies-interface-it-s":
		"Improved the Friends/Server/Guildies interface, it's one step closer to production. Mostly worked on new tiles and the integration of the new town and monsters.",
	// htmls/logs.html:635; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-gameplay-on-mobile-devices-fixed-some":
		"Improved the gameplay on mobile devices, fixed some minor issues, the web version isn't supposed to be played on mobile devices, yet, it doesn't hurt to polish things a bit. Imporoved draw routines to support sub-60fps framerates. Previously, timings always assumed FPS around 60. Currently, they are based on milliseconds.",
	// htmls/logs.html:267; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-global-limits-enforcer-once-again-it": "Improved the global limits enforcer once again, it's a lot more complicated and refined now.",
	// htmls/logs.html:1087; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-guide-a-bit-too-added-the": 'Improved the guide a bit too, added the "Attributes" section, + populated it further',
	// htmls/logs.html:345; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-guide-added-a-limits-section": "Improved the Guide, added a Limits section.",
	// htmls/logs.html:415; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-hp-bar-s-and-name-tag": "Improved the HP Bar's and Name Tag's.",
	// htmls/logs.html:280; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-integration-of-the-new-town-finalised": "Improved the integration of the new town, finalised the items that will initially arrive with the new town.",
	// htmls/logs.html:636; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-inventory-interactions-previously-click-events-were":
		"Improved the Inventory interactions, previously, click events were dynamically added, moving to static events, to increase performance and simplify things.",
	// htmls/logs.html:409; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-ip-limitations-layer-improved-the-server":
		'Improved the IP Limitations layer. Improved the server, added the "Convert to Shells" routine for items that are being discontinued.',
	// htmls/logs.html:436; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-ip-security-layer-of-the-game": "Improved the IP security layer of the game.",
	// htmls/logs.html:861; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-login-selection-interface-added-last-update": 'Improved the login/selection interface, Added "Last Update Notes".',
	// htmls/logs.html:954; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-main-map-cave-area-tested-alternative":
		'Improved the "main" map / cave area. Tested alternative map designs. Started implementing the new PVP region that unlocks only if there are enough players around.',
	// htmls/logs.html:1115; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-main-town-brought-down-the-front": "Improved the main town, brought down the front walls, added a second bridge, Improved the map editor in the progress",
	// htmls/logs.html:901; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-map-editor-to-ease-working-with":
		'Improved the map_editor to ease working with "entities", which are 3D. Probably not the right term, but basically they are things that you can also get under, like statues, trees, houses, gates. I used them sparingly, as I didn\'t optimise the tiling routine to dynamically add/remove them, Jayson enjoys using them wherever possible, results in a more lively map.',
	// htmls/logs.html:335; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-new-bank-added-the-clerk-s": "Improved the new bank, added the Clerk's, Finalised the unlock routines.",
	// htmls/logs.html:428; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-npc-animations-they-flow-better-now": "Improved the NPC animations, they flow better now.",
	// htmls/logs.html:537; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-party-system-now-any-member-of":
		'Improved the party system, now any member of a party can invite others, also, a higher member can kick a lower one. Additionally, it\'s possible to "REQUEST" to become a party member. Basically, considering people usually afk and check back in from time to time, this will enable parties to evolve more easily.',
	// htmls/logs.html:614; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-recruits-system-as-i-hoped-the":
		'Improved the recruits system, as I hoped the Halloween Event would create a rush, added/integrated new internal systems and added "Your Recruits" to the menu.',
	// htmls/logs.html:1029; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-server-failure-routine-players-are-no":
		"Improved the server failure routine, players are no longer immediately unlocked, they unlock automatically in 12 minutes. Another iteration is needed, luckily the server is solid now, no more unexpected exceptions.",
	// htmls/logs.html:1059; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-server-offline-detection-routine-it-marked":
		"Improved the server offline detection routine, It marked live servers offline by mistake, Probably a glitch based on minutely differences between instances and db #TODO: Iterate once more",
	// htmls/logs.html:1106; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-server-registry-system-server-numbering-naming": "Improved the server registry system, server numbering, naming",
	// htmls/logs.html:1102; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-server-upgrade-routines-the-chat-game": "Improved the server upgrade routines, the chat, game logs are left in place, there's also a disconnect reason provided",
	// htmls/logs.html:647; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-skillbar-prototype-tested-pvp-the-movement":
		"Improved the skillbar prototype, tested PVP, the movement routine improvements worked. Started designing the Halloween zone, updated these logs.",
	// htmls/logs.html:852; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-stripe-integration-integrated-super-rewards-so":
		"Improved the Stripe integration, Integrated Super Rewards, so far Super Rewards seem great, very easy to integrate, simple, clean, it looks like there are many free offers too.",
	// htmls/logs.html:523; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-trade-slots-the-data-for-the": "Improved the trade slots, the data for the slots isn't sent when the slots aren't visible any more.",
	// htmls/logs.html:287; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-trade-system-to-allow-listings-for":
		"Improved the trade system to allow listings for 1+/Stacked items. All trade/exchange routines have to be perfect, even the smallest oversight could be fatal for the economy.",
	// htmls/logs.html:1092; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improved-the-ui-a-bit-stats-now-toggle": "Improved the UI a bit, STATS now toggle the Character Sheet, Calibrated the z-index of UI elements, matters a lot for low-width screens",
	// htmls/logs.html:1122; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improving-the-disappearing-texts-font-rendering-is-still": "Improving the disappearing texts, font-rendering is still ...",
	// htmls/logs.html:382; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improving-the-game-client-server-interactions-ideally-server":
		"Improving the game client / server interactions, ideally, server should never send text to the client, all text and responses should be on the client, this will make it easier to translate the game at one point.",
	// htmls/logs.html:435; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improving-the-game-designs-the-winterland-the-desertland": "Improving the game designs, the winterland, the desertland, and everything else.",
	// htmls/logs.html:949; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.improving-the-pvp-region-dynamics-and-the-surrounding": "Improving the PVP region, dynamics and the surrounding routines",
	// htmls/logs.html:125; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.in-turkey-males-have-to-serve-in-the":
		"In Turkey, males have to serve in the military, I had enrolled for a paid short term beforehand, and the lottery hit me at 7th of January, which complicated things further. I had the opportunity to release on Steam around the 20th of December, but as I needed to be away for ~20 days, delayed the release until I returned. In hindsight, one needs to complete the Steam Store listing page weeks before the actual release. You learn these things once you go through with the process.",
	// htmls/logs.html:652; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.inspired-by-his-work-i-created-the-ancient":
		"Inspired by his work, I created the Ancient Computer myself, it was super fun, If I had enough time, or, if we had enough time, like 1-2 years, Self-sufficiency in terms of pixel art would have been possible.",
	// htmls/logs.html:260; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.inspired-started-the-tavern-improved-the-game-performance": "Inspired. Started the Tavern. Improved the game performance when the window is minimised.",
	// htmls/logs.html:386; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-improved-all-the-new-quests-and-monsters":
		"Integrated/Improved all the new quests and monsters, yet, there's still a lot that needs to be done, a lot of polishing and enriching and testing.",
	// htmls/logs.html:343; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-improved-the-new-boosters-simplified-the-internals":
		'Integrated/Improved the new boosters, simplified the internals, going to document a "How to Use" section along with Code methods soon.',
	// htmls/logs.html:229; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-our-new-cave-the-design-is-impressive":
		"Integrated our new cave. The design is impressive. Dracul currently occupies the prime area, yet, he will probably become a random and frequently spawning boss, and that awesome area could be used in a different way, maybe a global event triggered through an item.",
	// htmls/logs.html:449; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-the-christmas-event-sounds": "Integrated the Christmas Event sounds.",
	// htmls/logs.html:272; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-the-new-looks-for-the-armors-sent": "Integrated the new looks for the armors, sent an early UI update.",
	// htmls/logs.html:232; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-the-npc-s-to-the-new-town":
		"Integrated the NPC's to the new town, combined the basic armor and weapons merchants, added direct access to Upgrade and Compound through the wells near the combined upgrade and compound NPC.",
	// htmls/logs.html:616; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrated-the-pumpkin-helmet-jayson-designed-this-was":
		'Integrated the "Pumpkin Helmet" Jayson designed, this was another moment I will always remember, he really made me proud, he was aspiring to become a pixel artist, yet, I wasn\'t expecting results this fast. The "Pumpkin Helmet" ticked all the boxes, simple, good use of colors, looks great. Integrated it into the game, added "Reflection" as a unique stat.',
	// htmls/logs.html:307; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrating-new-monsters-improved-the-way-game-calls":
		'Integrating new monsters. Improved the way game calls functions inside the Code, added error handling, otherwise, for the "on_draw" function, Code exceptions had fatal results.',
	// htmls/logs.html:538; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.integrating-the-new-maps-mainly-to-slowly-prepare": "Integrating the new maps, mainly to slowly prepare for the re-launch, start polishing things",
	// htmls/logs.html:319; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.interacted-with-our-new-players-until-4am-it":
		"Interacted with our new players until 4AM, It's always a joy to see new players enjoy the game, the initial feedback is also very important, at this point, I'm confident the game is going in the right direction.",
	// htmls/logs.html:1015; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.introduced-new-animations-and-skins": "Introduced new animations and skins",
	// htmls/logs.html:598; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.it-includes-various-pre-confessions-that-will-let": "It includes various pre-confessions that will let me develop the game in peace, It feels great getting these out of my chest.",
	// htmls/logs.html:819; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.it-s-a-ranged-attack-for-warriors-inflicts": "It's a ranged attack for warriors, inflicts only one damage, but prevents the opponent from escaping and taunts monsters.",
	// htmls/logs.html:1133; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.it-s-apparent-that-us-eu-asia-servers": "It's apparent that US/EU/Asia servers are needed even in this early stage, Implemented ping, it was 150ms",
	// htmls/logs.html:692; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.it-s-been-the-most-exciting-joyful-interesting":
		'It\'s been the most exciting, joyful, interesting, stressful, productive 12 days I\'ve had in ... probably years ... It all started with: <a target="_blank" href="https://www.reddit.com/r/MMORPG/comments/5855bd/adventure_land_an_mmorpg_in_which_you_can_code/" class="cancela"><span class="devlink">https://www.reddit.com/r/MMORPG/comments/5855bd/adventure_land_an_mmorpg_in_which_you_can_code/</span></a>',
	// htmls/logs.html:621; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.it-was-an-impulse-decision-normally-i-prepare":
		"It was an impulse decision, normally, I prepare and obsess over announcements like these. I wasn't expecting such a positive feedback. From the first moment I posted, people started appearing on Europas I, greeted everyone individually, It was so very exciting. I really wasn't expecting such a positive turnover, people seemed to be loving the game, embracing the Code, asking questions, making suggestions. It was truly an \"It's Happening\" moment for me. Time flied.",
	// htmls/logs.html:372; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.it-was-delighting-to-see-so-many-players":
		"It was delighting to see so many players rushing and exploring the game as soon as the update went live. Moments like these make me proud. I cherished every moment.",
	// htmls/logs.html:524; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.jayson-decided-to-stop-playing-on-pvp-servers":
		"Jayson decided to stop playing on PVP Servers and become more active as a GM. It's a good decision and it was good to hear. Tho, I will miss seeing him on the PVP servers. And I wish the bullying from the community didn't contribute to his decision. We probably need a \"PVP Etiquette\" too. PVP is tooo controversial.",
	// htmls/logs.html:497; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.jayson-designed-a-beautiful-shells-island-it-s": 'Jayson designed a beautiful "Shells Island" - it\'s the background for /shells.',
	// htmls/logs.html:661; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.jayson-designed-a-quiver-i-was-very-proud": "Jayson designed a Quiver, I was very proud, it was beautiful, we started using Aseprite earlier, I think Aseprite inspired him.",
	// htmls/logs.html:651; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.jayson-prepared-new-ranger-and-warrior-looks-again": "Jayson prepared new Ranger and Warrior looks, again, very impressive.",
	// htmls/logs.html:209; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.jayson-prepared-the-first-prototype-for-a-slot":
		"Jayson prepared the first prototype for a slot machine. It's a nice one. He seems to be recovering from the motorcycle accident. While he initially told me it wasn't serious, as I understand it was a serious accident. I keep on wishing we could have an active stream of communication, but at this point, I've settled with bursts of collaboration too. I think another burst of collaboration/creation is imminent, as we are both hungry to add some new stuff to the game.",
	// htmls/logs.html:862; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.jayson-was-having-issues-with-the-map-editor": "Jayson was having issues with the map_editor, tested various alternatives, none seemed to work, so we invested in a new laptop.",
	// htmls/logs.html:353; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.last-few-days-i-ve-been-on-a":
		"Last few days, I've been on a personal quest, it materialised on [06/12/16], and it's been a source of motivation and much-needed distraction for the past month, it's finally nearing completion.",
	// htmls/logs.html:410; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.lately-i-ve-been-very-stressed-so-instead":
		"Lately I've been very stressed, so instead of working ~10 hours a day on the game, I've reduced this amount to 3-4 hours, and in the remaining time, I've been working towards a life achievement/goal, when you are young, concentrating purely on work is manageable, yet, as time passes, the desire for something more grows.",
	// htmls/logs.html:245; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.learned-a-lot-on-chance-games-design-today": "Learned a lot on chance games design today. Most of the real life challenges doesn't exist in our game, still, there are a lot to apply.",
	// htmls/logs.html:491; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.life-wise-getting-things-back-on-track-slowly":
		"Life-wise, getting things back on track, slowly boosting my morale, game-wise, it's becoming easier too, stress levels are reducing, the community is maturing. Spent half of this day tidying my surroundings. My greatest hobby is mechanical keyboards, I had a project laying around for almost a year, the parts are there, yet it takes 3 full days to build a keyboard, and I won't have 3 spare days for some time, so wrapped all the parts, keycaps and stored them in the attic. Cleaned the room and got a haircut afterwards. Feels like a new beginning.",
	// htmls/logs.html:252; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.life-yesterday-a-pigeon-entered-the-house-from":
		'<span style="color: #E47F8B">Life:</span> Yesterday a pigeon entered the house from the air duct, struggled a lot there, she looked cheerful when we rescued her, ate, drank, tried to let her go today, she wasn\'t able to fly, and tonight, she passed away, buried her, it was devastating.',
	// htmls/logs.html:261; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.looking-back-on-a-personal-level-2016-didn":
		'<span style="color: #E43E4A">Looking Back:</span> On a personal level, 2016 didn\'t start well, I was working on a project for 4+ years, I was continually failing to gain traction or recognition, I was stuck inside a fruitless loop, It was time to start doing something else, not to abandon the project, but to do something more productive. It was around May when I started creating Adventure Land, and in June I fully committed to the project. It was an incredible journey for me, along the way, I paid my emotional debt, normalised my life ambitions and goals, broke my obsessions, and thanks to the game, became a better person with insights into unexpected fields and various unexpected experiences. I was expecting game development to be mostly about development, but it was more about, economy, psychology, sociology, business, and even politics. Trying to build an enjoyable game, I started appreciating life a lot more too. In many ways life is a lot like a game, but much greater than any of us can even dream of building.',
	// htmls/logs.html:786; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.made-a-lot-of-internal-improvements-testing-fixes": "Made a lot of internal improvements, testing, fixes for the new additions, overall this was a productive day.",
	// htmls/logs.html:446; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.made-my-decision-on-the-game-limits-this":
		'Made my decision on the game "Limits" - this topic is very heated, I decided to limit free characters to 1 PVE + 1 PVP + 1 Merchant, and even with the new xp/gold/luck booster item that costs $8, the limit is 3, so for $16/mo, a player can play with 3 characters. In the past, when the limits were added, then reduced, there was always a backlash, yet, after 1-2 days, the game always improved, became more social, economy metrics improved. So I\'m confident this change will be positive too. It will go into effect along with the Christmas Event and new maps.',
	// htmls/logs.html:907; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.made-other-small-improvements-to-tiling-and-generated":
		"Made other small improvements to tiling, and generated some major improvement ideas, It's super challenging to cram everything to 16ms, to keep the game flawlessly 60ms, even a 20ms frame is noticeable. The next improvement will involve pre-calculations.",
	// htmls/logs.html:874; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.made-some-other-drag-drop-item-related-improvements": "Made some other drag/drop, item related improvements.",
	// htmls/logs.html:925; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.made-some-small-fixes-and-improvements-mainly-to":
		"Made some small fixes and improvements, mainly to the items system. Overflowing the inventory was possible, it was even a feature in the early days.",
	// htmls/logs.html:510; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.maps-had-signs-replaced-that-system-with-quirks": 'Maps had "Signs", replaced that system with "Quirks", Quirks can be anything, signs, unimportant but fun map interactions etc.',
	// htmls/logs.html:112; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.meanwhile-launched-the-chinese-new-year-event-also":
		'Meanwhile launched the <a target="_blank" href="https://steamcommunity.com/games/777150/announcements/detail/1756870026694683047" class="cancela"><span class="devlink">Chinese New Year</span></a> event. Also going to post updates every week during Early Access.',
	// htmls/logs.html:1098; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.met-with-new-players-the-initial-feedback-is": "Met with new players, the initial feedback is very positive, so motivating, I couldn't even sleep, woke up early on to check the game",
	// htmls/logs.html:873; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.met-zenn-in-game-we-literally-debugged-an":
		'Met "Zenn" in-game, we literally debugged an issue together for 3 hours. The inventory was never shown for him. Which is bizarre, as I keep the UI as simple as it goes. For whatever reason, the `position:fixed` inventory never showed up for him. I researched, deployed alternatives 10\'s of times, he tested and tested, it never showed up - And this is on Chrome, his solution was to use IE. - I ended up re-creating a unique inventory each time, instead of using an existing "div", that solved the issue. - The cause is still a mystery tho, in hindsight, I neglected to ask whether he had any 3rd party plugins.',
	// htmls/logs.html:117; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.military-service-wasn-t-kind-started-around-10":
		"Military service wasn't kind, started around -10 degrees, even saw 30+'s momentarily at one point, started with snow and ice, moved onto cold rains, everyday had a different kind of challenge. The only good thing about it was the dogs, there were many happy dogs that tagged along wherever you went. Never experienced such a dog culture before. In the end, managed to get away with pharyngitis, sinusitis, eye and ear infections, luckily got vaccinated for meningitis, or it would have been endgame.",
	// htmls/logs.html:856; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.minor-bugfixes-improvements-created-the-amulet-of-mystery":
		'Minor bugfixes, improvements. Created the "Amulet of Mystery". It will be a rare drop from the "House of Mystery". It has various stats + evasion/reflection. Properties that don\'t exist yet :]',
	// htmls/logs.html:344; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.monster-xp-s-now-factor-in-the-xpm":
		"Monster XP's now factor in the .xpm XP Modifier of players. Useful for PVP. Going to add another notice to PVP soon, advertising the increased luck and gold too.",
	// htmls/logs.html:207; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.month-in-review": '<span class="feature">Month in Review</span>',
	// htmls/logs.html:1099; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.most-confusing-part-of-the-game-is-right":
		"Most confusing part of the game is right clicking it seems, for this reason added colors to the game guide, also started showing the game guide automatically to every level 1 player",
	// htmls/logs.html:742; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.mostly-added-the-ability-to-the-item-sheet":
		'Mostly added the ability to the "Item" sheet, and added the "Stunned" animation today, and the upgrade dynamics, when the item is upgraded, both the chance and duration increases. The "Basher" item makes more sense now.',
	// htmls/logs.html:895; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.mostly-catching-up-with-things-small-fixes-i":
		"Mostly catching up with things, small fixes, I really need to do some things daily, like updating these logs, and preparing game updates/screenshots.",
	// htmls/logs.html:795; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.mostly-fixed-newly-introduced-issues-today-improved-simplified":
		"Mostly fixed newly introduced issues today. Improved/Simplified the shutdown routine of the server, It's much cleaner/simpler now. Reviewed the bank routines, found/patched another possible loophole. I want to be confident that the bank transactions are solid now.",
	// htmls/logs.html:1012; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.moved-away-from-bold-texts-now-all-texts":
		"Moved away from bold texts, now all texts are uniform. Also increased text_quality for everyone on default. This results in crisper yet thinner texts. I was so used to the illegible bold disappearing texts, so it wasn't easy to let go ;]",
	// htmls/logs.html:640; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.moved-the-party-invites-to-the-left-tested": "Moved the party invites to the left, tested Jayson's ranger+warrior, some pixels need to be fixed, going to fix them soon.",
	// htmls/logs.html:1116; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.moving-towards-a-multi-server-ui-patched-the": "Moving towards a multi-server UI + Patched the live server shutdown routine to be clean, there were some unforeseen issues",
	// htmls/logs.html:1028; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.much-thicker-upgrade-animations-the-thin-ones-were": "Much thicker upgrade animations, the thin ones were barely visible.",
	// htmls/logs.html:479; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.negotiated-with-sun-pixels-leo-he-s-going":
		"Negotiated with Sun Pixels/Leo, he's going to be our pixel artist for the map details, characters, monsters. If everything goes according to plan. However, if my limited experience taught me anything, things usually don't go according to plans. As a backup, Jayson is working on some new stuff. Previously, Revangale was going to be the pixel artist, but we had issues with the first sample, and later on he left due to personal reasons, he did a great job on the \"Ship\" tho, we had potential, that's why I started being cautious, in terms of delays and expectations, I've also learned not to be specific, and let artists use their creativity. On the bright side, I can rely on Ellian for our items, he also said he can help with other stuff if need be.",
	// htmls/logs.html:109; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.never-expected-such-a-successful-release-steam-is":
		"Never expected such a successful release. Steam is truly a one of a kind platform. For example the game sold 5-6 copies on Mac App Store, and as far as I guess, they were all direct sales and not discovery sales. But with Steam, the game started selling 30-40 copies a day. Without any promotional effort, and for an indie game, I find these numbers to be extraordinary. If you are reading this, consider making a unique, alluring, single player game for Steam (like a unique rogue-like), it would be the optimal scenario. Multiplayer games are always challenging.",
	// htmls/logs.html:773; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.new-ability-charge-for-warriors": "New Ability: Charge for Warriors",
	// htmls/logs.html:772; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.new-item-earring-of-dexterity-improved-the-pumpkin":
		"New Item: Earring of Dexterity + Improved the Pumpkin Helmet item, mainly the 16x16 image. Getting better at pixel-art, at least I hope. My biggest mistake it using too many colors and not having a palette. Going to stick to few colors on my next try.",
	// htmls/logs.html:998; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.new-npc-feature-gems-exchange-the-first-gem": 'New NPC + Feature: Gems + Exchange. The first gem, "Raw Emerald" drops from any monster. It\'s super rare tho.',
	// htmls/logs.html:1026; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.new-server-side-boundary-checks-for-monsters-no":
		"New server side boundary checks for monsters! No more walking on water :] This is kind of the reason why I designed the initial town as an island cluster, better pass water instead of walking through a wall. With this update, it will be possible to extend the cave and create more extensive maps. For some reason I have the desire to build a farm map, monsters inside their own fences and a simple NPC that herds them.",
	// htmls/logs.html:259; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.new-year-s-eve": '<span class="feature">New Year\'s Eve!</span>',
	// htmls/logs.html:689; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.newidea-a-potion-that-replenishes-both-hp-and": "#NEWIDEA: A potion that replenishes both HP and MP, I should remember this one.",
	// htmls/logs.html:1095; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.next-feature-everyone-wants-to-party": "Next Feature: Everyone wants to party",
	// htmls/logs.html:1017; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.next-step-passive-abilities-that-extend-to-party":
		"Next Step: Passive abilities that extend to party members. These will show up in STATS. For example the Priest might add damage reduction to the party.",
	// htmls/logs.html:516; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.no-more-stacking-this-is-a-very-major":
		"<span class=\"warning\">No More Stacking:</span> This is a very major change, an extremely common practice for both PVE and PVP was to put all party characters in one spot, for a bystander, it's very displeasing, you can't see who's who, for PVP, it was extremely advantageous, you can't easily execute a strategy against 6 characters in one spot, without Code, you can't even target them, so with this new system, each attack to stacked players increases the count by 1, similar to terrified/petrified state, but, for the group, the total damage is calculated from the cumulative count, so basically, on PVP, even a single Rogue can eliminate a stacked party with a Supershot+Shot.",
	// htmls/logs.html:827; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.no-today-s-feature-today-but-the-bank":
		'No "Today\'s Feature" today, but the bank issue was pretty major, and the fix/improvements were hefty. #TODO: Review all trade routines once more',
	// htmls/logs.html:935; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.note-starter-items-intentionally-don-t-look-super":
		"NOTE: Starter items intentionally don't look super cool, I'm unsure whether I should make them look cool, probably not, I plan to make rare items look cool.",
	// htmls/logs.html:535; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.observed-the-first-referral-transaction-it-s-a":
		"Observed the first referral transaction, it's a nice milestone, a player referring another player, new player making a purchase, and the referrer receiving credit for it.",
	// htmls/logs.html:645; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.obsessed-over-a-resizing-issue-for-hours-even":
		"Obsessed over a resizing issue for hours, even wrote a custom routine to manually resize images in a pixel perfect way, no matter what I did, the result was the same, turns out, the image I was trying to resize had 3x3 pixels for each actual pixel, and I was dividing by 2, instead of 3, wasted 2 hours like this, but on the bright side, got to acquire skills to manually manipulate/create images with code.",
	// htmls/logs.html:84; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.old-planned-features-new-all-update-notes":
		'<a target="_blank" href="/roadmap" class="cancela"><span style="color: #948F99">~OLD</span> <span style="color: #E39F59; text-decoration: underline">Planned Features</span></a> <a target="_blank" href="/allnotes" class="cancela"><span style="color: #63ABE4">NEW!</span> <span style="color: #E39F59; text-decoration: underline">All Update Notes</span></a>',
	// htmls/logs.html:552; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.on-the-side-my-existential-crisis-has-been":
		"On the side, my existential crisis has been growing, my priorities have been shifting, without the game, I could've been crushed already, but the game showed me new beginnings are always possible. However, building the game isn't an all peachy experience either.",
	// htmls/logs.html:418; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.outside-the-game-a-very-positive-development-happened":
		"Outside the game, a very positive development happened, I've been looking for something and finally found the perfect candidate.",
	// htmls/logs.html:1064; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.patched-an-issue-that-occasionally-took-a-server": "Patched an issue that occasionally took a server offline",
	// htmls/logs.html:225; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.patched-the-pvp-combo-routines-it-seems-some": "Patched the pvp/combo routines. It seems some rogue's are making teams kill their teammates. Ingenious but patched at the next update.",
	// htmls/logs.html:499; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.perfected-the-combo-aggro-check-routine-the-logic":
		"Perfected the combo/aggro check routine, the logic is different for PVP/PVE, in PVE, you can't just get close to a stranger and get them killed, but in PVP, you might do that, not that it makes sense to do it.",
	// htmls/logs.html:899; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.perfected-the-drag-drop-and-right-click-routines":
		"Perfected the drag/drop and right_click routines, another proud moment. Now drag/drop and right_click works everywhere, internally things are much simpler too. These routines are so robust now that I feel like I can utilise them when the time comes to build iOS, Android versions of the game.",
	// htmls/logs.html:1002; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.perfected-the-standalone-version-of-the-game": "Perfected the standalone version of the game.",
	// htmls/logs.html:380; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.perfected-the-winter-inn": 'Perfected the "Winter Inn".',
	// htmls/logs.html:457; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.picked-a-tune-for-the-christmas-event-i": 'Picked a tune for the Christmas Event, I love it, going to add a "Do you want to turn the Music on?" prompt soon.',
	// htmls/logs.html:732; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.picked-up-the-random-looks-logic-fixed-it": 'Picked up the "Random Looks" logic, fixed it, improved it, verified it.',
	// htmls/logs.html:853; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.pixel-art-ist-research-got-some-inspiration": "Pixel Art/ist research. Got some inspiration.",
	// htmls/logs.html:725; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.pixi-has-a-new-tilingsprite-improvement-by-ivan":
		"PIXI has a new TilingSprite improvement, by Ivan, tested it, it seems Adventure Land is going to get a HUGE performance boost once it hits the production build. Great news. Currently all tiles are individual Sprite's. As TilingSprite quality was much inferior.",
	// htmls/logs.html:1120; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.planning-a-remake-of-the-map": "Planning a remake of the map",
	// htmls/logs.html:1124; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.players-monsters-now-change-direction-on-attack-if":
		"Players, monsters now change direction on attack if they are not moving - Next step: An attack animation or indicator, especially for pvp",
	// htmls/logs.html:590; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.pre-ordered-the-new-pokemon-3ds-games-and": "Pre-Ordered the new Pokemon 3DS games and re-indulged my fountain pen addiction with a new pen, my morale is fully back up now :]",
	// htmls/logs.html:477; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.preparing-the-elementals-they-will-likely-be-random": "Preparing the elementals, they will likely be random spawning bosses, rather than set-spawn/set-interval bosses.",
	// htmls/logs.html:712; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.preparing-the-rogue-class-decided-to-push-the":
		'Preparing the rogue class. Decided to push the game design further. There will be 4 main tiers of armors, this applies to the resistance and armor dynamics. For example the "Dracul\'s Cape" is a Tier2 Chest armor. Unique armors like these will most probably be Tier3 at most, since they have additional properties.',
	// htmls/logs.html:324; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.preparing-the-steam-greenlight-page-improved-the-code": "Preparing the Steam Greenlight page, Improved the Code functions a bit.",
	// htmls/logs.html:179; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.preparing-to-convert-all-existing-16x16-items-to": "Preparing to convert all existing 16x16 items to new 20x20 ones with Ellian.",
	// htmls/logs.html:334; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.previously-the-login-character-selection-page-only-showed":
		"Previously the login/character-selection page only showed the merchant area, with this new system, random players are shown. It's nice to shuffle through the server a bit this way.",
	// htmls/logs.html:529; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.processed-the-video-asked-for-feedback-the-video":
		"Processed the video, asked for feedback, the video ended up being a bit too simple, so started planning a secondary video that showcases the Code aspect of the game more. Thanks to Delia's suggestion.",
	// htmls/logs.html:975; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.pursued-the-implementation-and-integration-of-the-new": "Pursued the implementation and integration of the new event/backup systems.",
	// htmls/logs.html:717; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.pushed-both-stun-and-curse-as-far-as": 'Pushed both "Stun" and "Curse" as far as I can take them, both for players and monsters.',
	// htmls/logs.html:920; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.pvp-zone-http-adventure-land-img-instances-png":
		'PVP(Zone): <a target="_blank" href="http://adventure.land/img/instances.png" class="cancela"><span class="devlink">http://adventure.land/img/instances.png</span></a>',
	// htmls/logs.html:1000; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.rare-items-and-high-level-items-are-high":
		'Rare items and high-level items are "High Grade" now, added new "High Grade" upgrade scrolls and a new "Dexterity" scroll. The dexterity scroll is pretty fun, there are no dexterity classes yet, however, if someone is farming bee\'s, switching the armor stats to dexterity makes a lot of sense, in terms of speed. :]',
	// htmls/logs.html:698; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.re-calibrated-the-xp-level-dynamics-after-level":
		"Re-Calibrated the XP/Level dynamics. After Level 70, Things are ever slightly harder now. A Level 70 Character becomes pretty agile, A Level 80 Character is pretty over-powered. So I think this hardness is deserved. We can always re-balance the dynamics and refactor existing users, so I shouldn't worry too much.",
	// htmls/logs.html:1037; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.re-implemented-character-names-as-it-was-requested":
		'Re-Implemented character names as it was requested, it\'s not launched yet, but they look great! I think I will add it to button "N", it will be hold-to-show.',
	// htmls/logs.html:429; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.re-implemented-the-password-routines-passwords-are-hashed":
		"Re-Implemented the password routines, passwords are hashed with random salts now. Implemented a supplementary, new password reset routine. Deployed, Tested the changes and refactored all existing passwords.",
	// htmls/logs.html:1101; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.re-improved-the-movement-system-teleports-it-seems": "Re-Improved the movement system + teleports, It seems perfect now, character directions are also synced",
	// htmls/logs.html:727; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.re-visited-the-walking-line-routines-inner-corners":
		"Re-Visited the walking/line routines. Inner corners were challenging, they amplify the shortcomings of the design. I re-wrote the boundary logic a couple of times, in the end, made a patch, seemed to work, I'm settling for now.",
	// htmls/logs.html:820; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.re-written-unified-all-the-attack-routines-both":
		"Re-written/unified all the attack routines, both PVE and PVP, I love refactoring, this simplifies things a lot, especially for abilities.",
	// htmls/logs.html:1069; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.really-proud-of-how-the-party-design-evolved":
		"Really proud of how the party design evolved, they are simple to form, simple to manage, when the leader leaves the next one in line become the leader, the XP isn't reduced significantly, so people have a strong incentive to team up.",
	// htmls/logs.html:210; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.received-an-awesome-suggestion-list-from-trexnamedtom-on":
		"Received an awesome suggestion list from \"Trexnamedtom\" on Discord for Achievements. It's the best suggestion list I've received so far. Usually while reading suggestion lists, I absorb 10%-20% of the ideas, and the rest clash with my vision and direction for the game (or they require more effort than what's possible on indie levels), some suggestion lists are completely uncoupled from the game, that's why Trexnamedtom's suggestions really suprised me, we share the same vision, I love all of the achievement ideas and intend to work on them. Previously, \"Aelwrath\" also sent an incredible suggestion document, just re-visited it again, I should integrate some of his ideas, most of them are very high level, but on the lowest level, there are some intriguing item ideas and the MOBA/Code event idea is unique.",
	// htmls/logs.html:774; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.received-inspected-a-bug-report-from-a-player":
		"Received/Inspected a bug report from a player, Teoman, he found a way to consistently go outside the boundaries, it seems inner corners are easy to break-free from.",
	// htmls/logs.html:572; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.received-some-inspiring-feedback-on-reddit-decided-to":
		"Received some inspiring feedback on Reddit, decided to go forward with the NPC Dialogues and created our first one. Unlike our all-black interfaces, NPC dialogues have light backgrounds, I love them.",
	// htmls/logs.html:467; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.received-the-new-pokemon-games-moon-for-myself":
		"Received the new Pokemon games, Moon for myself, Sun for my brother. We've been following Pokemon again since the XY times, each game provides 30 hours of fun. I guess, a lot of people like 2D/Pixel games because of the original Pokemon games too. Learned about \"Star Trek: Discovery\". There's a lot to look forward to.",
	// htmls/logs.html:573; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.receiving-feedback-about-our-booster-items-the-new":
		"Receiving feedback about our booster items, the new design is almost finalised, it will likely be a $8 stone with higher Gold/Luck bonuses but less XP bonuses.",
	// htmls/logs.html:1127; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.receiving-feedbacks-started-writing-a-small-guide-preparing":
		"Receiving feedbacks, started writing a small guide, preparing to make server connections secure, added a percentage based loader",
	// htmls/logs.html:447; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.reduced-the-monster-charge-speeds-for-squig-increasing": "Reduced the monster charge speeds, for Squig, increasing the speed from 10 to 20 was displeasing, reduced multipliers.",
	// htmls/logs.html:1123; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.refactored-simplified-most-of-the-server-client-events": "Refactored/Simplified most of the server/client events, routines",
	// htmls/logs.html:868; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.refactored-the-monster-player-information-routines-initially-things":
		"Refactored the monster+player information routines, initially, things were excluded, this made it easy to develop the game, now, things are included, so each property that are sent to clients are manually added to the list.",
	// htmls/logs.html:653; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.reference-dolch-computer-https-www-google-com-search":
		'Reference, Dolch Computer: <a target="_blank" href="https://www.google.com/search?q=dolch+computer" class="cancela"><span class="devlink">https://www.google.com/search?q=dolch+computer</span></a>',
	// htmls/logs.html:367; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.replaced-dark-knight-s-with-croc-s-i":
		'Replaced "Dark Knight"s with "Croc"s, I added "Dark Knight"s in July when I first launched the game, they were the first monsters too, however, having them in the Town never made sense, they will serve in the Underworld in the future.',
	// htmls/logs.html:1100; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.replaced-the-coordinates-interface-with-coordinates-map-name":
		"Replaced the coordinates interface with coordinates, map name, server name. Next Step: New XP/Character/Attack/Use interfaces",
	// htmls/logs.html:282; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.reproduced-the-movement-issue-we-ve-been-hunting":
		"Reproduced the movement issue we've been hunting with Mark, it does happen consistently, I didn't have a chance to inspect it deeply yet, glad I added the \"Location Correction\" routine, otherwise it's an issue that would go unnoticed.",
	// htmls/logs.html:245; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.researched-possible-games-for-the-tavern-today-read": "Researched possible games for the Tavern today, read Wikipedia pages for various games, inspected some patents.",
	// htmls/logs.html:607; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.researched-why-the-server-went-down-the-most":
		"Researched why the server went down, the most logical explanation is extreme load, since the game has \"Observers\", even if people don't login, each visitor adds a load to the server, it seems, along with ~100 players and 100's of observers, Europas I just gave up.",
	// htmls/logs.html:684; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.researching-the-ranger-on-a-philosophical-level-decided":
		"Researching the Ranger on a philosophical level, decided to let Rogue equip a single Warrior weapon double-handed, and similarly, allow a Ranger to equip a single Rogue weapon double-handed.",
	// htmls/logs.html:118; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.returned-home-25th-of-january-and-started-the": "Returned home 25th of January, and started the last preparations for the Steam release on 28th of January.",
	// htmls/logs.html:368; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.said-goodbye-to-mercury-he-was-a-really":
		"Said goodbye to Mercury, he was a really positive player, helped form the Wikia, left the game to concentrate on his studies. I wish all goodbyes could be civil like his.",
	// htmls/logs.html:134; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.second-aws-i-had-15k-s-of-aws":
		"Second, AWS: I had 15k$'s of AWS Activate credits, and used 8k$ of that credits up until August. Many thanks to Amazon for their help, thanks to them, I got to develop Adventure Land for 2 years without worrying about server costs. When the September bill arrived tho, it's clear that a change was necessary. ~$80 each for 3x 2-core servers. $240. And an extreme amount of data charges. Up until this point, I honestly didn't even bother calculating feasability. But on Monday, after the bill, calculated it alright. What's more bothersome was the data charges.",
	// htmls/logs.html:315; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.send-our-xmas-email-today-increased-the-drops":
		'Send our Xmas email today. Increased the drops for the Ornament quest. Promoted the Steam Greenlight page in-game. Updated <a target="_blank" class="cancela" href="https://www.reddit.com/r/AdventureLand/"><span class="devlink">Reddit</span></a>/Twitter/FB.',
	// htmls/logs.html:489; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.server-updates-are-always-stressful-a-lot-changes":
		"Server updates are always stressful, a lot changes between updates, there are lots of new features, improvements, and almost always, there are things that needs to be fixed fast. Suprisingly, this update wasn't that eventful. There are 2 bugs introduced, one is an innocent one. I didn't deem them worthy of a hotfix.",
	// htmls/logs.html:352; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.servers-are-performing-very-well-improved-the-bank":
		"Servers are performing very well. Improved the bank design with Jayson. Interacted with the community, debugged a movement issue, it turned out to be a false alarm, yet, ended up adding a \"Location Correction\" feature. It should be triggered if a high amount of delay causes a character's client-position differ from the server-position by >100px's. The movement system was designed to make the game fluent even when there are high delays, but this system requires compromises, as an example, line/border violations are allowed, if a player is experiencing a minor amount of delay, they should be able to play the game without issues, but this system causes a lot of headaches for me, so I might end up replacing our movement system with a new one at one point. Can't be soon tho.",
	// htmls/logs.html:371; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.set-the-update-notes-deployed-the-improvements-updated": "Set the update notes, deployed the improvements, updated the servers.",
	// htmls/logs.html:1043; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.sfx-is-finally-not-totally-horrendous-managed-to":
		"SFX is finally not totally horrendous, managed to rig-up and integrate some slightly pleasing effects. It's interesting that the game was totally silent all this time, yet no one even mentioned it, I wonder whether a non-perfect Sound/Music adds to a game, or takes from a game (probably the latter). Anyway, until things are more satisfying, SFX/Music needs to be toggled ON each time.",
	// htmls/logs.html:1093; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.shown-the-code-to-the-new-players-now": 'Shown the "CODE" to the new players, now everyone is CODE\'ing, Improved the game logic so the CODE keeps half-working in the background',
	// htmls/logs.html:881; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.sick-day-took-care-of-some-external-things":
		"Sick day, took care of some external things I needed to take care of in the meantime. Overall ~3 days affected, yesterday, today, ~tomorrow.",
	// htmls/logs.html:892; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.side-note-2-since-in-the-past-i":
		"Side Note 2: Since in the past I've lost so much time with minor issues/obsessions like these, I try to improve as much as I can and move on fast, but still, each issue can still consume 1-2 days",
	// htmls/logs.html:787; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.side-note-after-reading-my-own-logs-and":
		"Side Note: After reading my own logs, and writing this /logs summary on [03/10/16], I wonder whether I should let go off my productivity obsession, yes it produces short-term results, but I can't help but wonder whether it's worth all the stress, in the long-run.",
	// htmls/logs.html:891; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.side-note-i-could-ve-never-imagined-3": "Side Note: I could've never imagined 3 months of game development could extend my horizon this much",
	// htmls/logs.html:805; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.side-note-i-m-an-osx-user-myself":
		"Side Note: I'm an OSX User myself, It's sad that Windows/Hardware field is still ridiculed with various repeating issues, it forces everyone to become a superuser, maybe it's a good thing, but It's definitely not easy.",
	// htmls/logs.html:301; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.side-note-the-world-is-becoming-darker-and":
		"<span style=\"color: #E47F8B\">Side Note:</span> The world is becoming darker and darker, there are terrorist attacks almost every week in Europe/Middle-East, the country I live in is also suffering heavily, trying not to lose hope, the solution in my opinion is to be positive, nurturing, affect other's live's in positive ways, be forgiving, patient.",
	// htmls/logs.html:591; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.since-i-ve-touched-the-combat-routines-decided":
		"Since I've touched the combat routines, decided to implement evasion + reflection too, evasion is simple, yet reflection seemed complicated, in the end, both of them ended up being simple and fun. They work on PVE too, since all current bosses are magical, the Pumpkin Helmet's from our Halloween event are going to shine :]",
	// htmls/logs.html:791; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.slow-day-mostly-minor-improvements-improved-login-selection":
		'Slow day, mostly minor improvements, Improved login/selection, Added "Character Operations" and Implemented character deletion.',
	// htmls/logs.html:393; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.slowed-players-in-winterland": "Slowed players in Winterland.",
	// htmls/logs.html:679; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.slowly-catching-up-with-the-earlier-logs-14": "Slowly catching up with the earlier logs [14/11/16]",
	// htmls/logs.html:140; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.so-basically-that-s-a-huge-problem-solved":
		"So basically that's a huge problem solved, 35 euros for 500 characters, it's like $0.3/mo (worst case) for player (4ch for 1p). Considering the game will be for $12.99 on Steam. We're feasible now. By the way, each game server will try to gather $20-$50 each month with shells sales, so don't quote my calculations here and blame me for overselling things :)",
	// htmls/logs.html:138; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.so-i-m-a-computer-engineer-and-all":
		"So I'm a Computer Engineer and all, but, as a shame, I don't hold information in my brain, so I ended up googleing core/thread dynamics and how the 4-core, 8-thread processor can be best utilised. The main question was, for a pure-cpu workload, whether the 8 threads provided any value. To inform the reader, the 2 threads per core enables 2 processes to use a single core in an efficient way, so for a pure computing workload, the threads aren't ground breakingly useful. I concluded that I'll run 5 servers on a single machine. 4 PVE and 1 PVP. I assume each PVE server will utilise a single core to it's fullest and the PVP server will hang in there.",
	// htmls/logs.html:802; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.so-pvp-is-super-fun-yet-it-s":
		"So PVP is super-fun. Yet it's a bit extreme, you currently lose 4% of your XP on death. If you are LV.60+ - that's a lot of XP. This \"Tome of Protection\" costs 20 SHELLS, significantly reduces the XP loss, and to make things fun and fair, on PVP, the opponent gets 10 SHELLS if a Tome is consumed.",
	// htmls/logs.html:217; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.some-time-ago-i-ve-received-a-report":
		"Some time ago I've received a report, that showed \"Gleich\" cheating in game. After that, I personally noticed the same behaviour myself. It was upsetting, as, while a bit controversial, Gleich probably played the game most as non-afk. It doesn't make sense for him to cheat.",
	// htmls/logs.html:133; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spadar-one-of-our-hardcore-players-has-been":
		"Spadar, one of our hardcore players has been complaining about 500 errors that didn't manifest themselves in logs. After quite a bit of investment, I managed to track these errors, got the issues recognized, but while it's a beyond major issue and a major breach of trust, the respond from Google was along the lines of \"meh, it happenz, let it be, it's smallz\". I sincerely hope they clean their house and we see those old glorious days once again.",
	// htmls/logs.html:1044; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spending-too-much-time-in-game-it-really":
		"Spending too much time in-game, it really reduces my performance, tho, receiving lots and lots of awesome feedback and suggestions, caught up with logs today, also starting to take a more active approach for sharing on Reddit/Twitter/FB. I hate FB beyond imagination. Yet it's probably a necessary evil for a game, there is engagement even at this scale. I might revise the social media strategy in a future time. I would personally like to have only a subreddit.",
	// htmls/logs.html:459; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spent-a-lot-of-time-outside-bought-some":
		"Spent a lot of time outside, bought some new years lottery tickets, I always loved December, if everything goes according to plan, we are going to have a new years lottery in-game too :)",
	// htmls/logs.html:608; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spent-most-of-this-day-interacting-with-players": "Spent most of this day interacting with players, replying to emails and messages.",
	// htmls/logs.html:664; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spent-some-time-outside-checked-out-a-house": "Spent some time outside, checked out a house, want to have my own home, maybe start a family one day.",
	// htmls/logs.html:530; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spent-some-time-outside-i-realised-i-ve":
		"Spent some time outside, I realised I've been putting myself under a lot of stress lately, I have certain rules for myself, one of them is \"Don't screw yourself\", I realised, with high expectations, self-imposed deadlines, I've been doing just that. Going to try and enjoy the journey, stop worrying about things.",
	// htmls/logs.html:564; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spent-some-time-servicing-other-projects-as-a":
		"Spent some time servicing other projects, as a life rule I learned, it's important to not commit 100% into one thing, even 90% is a lot, 80%/20% is healthier, I'm currently at ~95% with the game. The reason for the rule is, doing other things alleviates the stress, makes you more creative, opens up horizons - and - more specifically, if a project is making you money, you have to care for it regularly. I've never abandoned a project, yet neglect is equally bad. So I tried to work on all my projects daily, weekly, or at least, monthly.",
	// htmls/logs.html:490; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.spent-some-time-with-allegaea-he-seemed-disruptive":
		"Spent some time with Allegaea, he seemed disruptive at first, as I received a violation report earlier about him, a map/line violation, yet, he turned out to be very kind and helpful. We inspected the server's IP response together, thanks to him, I discovered an interesting issue regarding dynamic IP's. I had dynamic IP's handled, yet, one edge case still remains.",
	// htmls/logs.html:995; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.stackable-items-can-now-be-traded-individually": "Stackable items can now be traded, individually.",
	// htmls/logs.html:525; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-adding-yet-another-layer-to-prevent-abuse":
		"Started adding yet another layer to prevent abuse, it's not completed or integrated yet, however, I think we are going to need this layer a lot in the future. I really wish I didn't need to spend this much effort into protective layers like these, but when you think about the state of the world, they are really needed, online, there is no such thing as \"responsibility\", people aren't responsible for their actions, there is no system to attribute minor abusive actions to individuals. For a developer, it's a nightmare.",
	// htmls/logs.html:1068; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-by-designing-implementing-the-party-logic-had":
		"Started by designing, implementing the party logic, had no intention of completing the entire system in one day, but things came to fruition fast.",
	// htmls/logs.html:810; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-catching-up-on-the-development-diary-the":
		'Started catching up on the "Development Diary", the last update was on [05/09/16], I REALLY need to do some things daily, It\'s really hard to generate proper updates, especially social media, hate social media now. Intending to create a GIF with some abilities, disappearing lines soon, and to announce the PVP servers.',
	// htmls/logs.html:408; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-creating-the-first-quests-the-xmas-quests": "Started creating the first quests, the xmas quests.",
	// htmls/logs.html:699; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-designing-the-new-items-pixel-art-became":
		"Started designing the new items, pixel art became a bottleneck. Emailed @ThisIsEllian - I admire his work on pixel items. It would be nice to have him onboard.",
	// htmls/logs.html:236; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-designing-the-new-movement-and-vision-system":
		"Started designing the new movement and vision system. The vision aspect improves performance, the movement one is complex and strict.",
	// htmls/logs.html:761; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-experimenting-with-trade-carts-drew-one-from":
		"Started experimenting with trade carts, drew one from scratch, didn't really fit in well with the game, It looked like an arcade cabinet tho, so that was a plus. In the future, when there is time. There will be around 12 unique trade carts, or merchant stands as I finalised the naming.",
	// htmls/logs.html:886; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-feeling-dizzy-it-happens-every-3-4":
		"Started feeling dizzy, It happens ~every 3-4 months, when I don't eat healthy for extended periods of time, I've been addicted to Wasa bars lately, you would expect it to be ~healthy, but apparently not.",
	// htmls/logs.html:348; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-finalising-the-new-booster-items-they-are": 'Started finalising the new "Booster" items, they are the improved version of "Stone"s.',
	// htmls/logs.html:992; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-hunting-memory-leaks-and-performance-issues": "Started hunting memory leaks and performance issues.",
	// htmls/logs.html:963; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-implementing-a-community-map-editor": 'Started implementing a "Community Map Editor"',
	// htmls/logs.html:982; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-implementing-internal-event-and-backup-routines-for": "Started implementing internal event and backup routines, for analysis and disaster recovery",
	// htmls/logs.html:1023; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-implementing-testing-an-actual-death-routine": "Started implementing/testing an actual death routine.",
	// htmls/logs.html:544; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-implementing-the-friends-system-implemented-the-interface":
		"Started implementing the friends system, implemented the interface, received feedback from the community, added .afk info to the system, started designing the Guilds system, interaction-wise, It's going to be very similar to Friends.",
	// htmls/logs.html:912; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-implementing-the-item-storage-routines-completed-the":
		'Started implementing the item storage routines, completed the "swap" operation, which happens between the inventory and storage.',
	// htmls/logs.html:908; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-inspecting-a-code-issue-it-seems-to":
		"Started inspecting a CODE issue, it seems to only affect me, might be a Chrome bug, various elements of the iFrame doesn't load most of the time.",
	// htmls/logs.html:890; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-inspecting-improving-the-right-click-logic-currently":
		"Started inspecting/improving the right click logic, currently it's pretty complicated, the game is 2D, when a character shadows a monster, in some cases the click should propagate through, but in certain cases it shouldn't. Tested things for hours, it seems I need to modify/extend the existing PIXI Interaction routines at one point. They mimic DOM Events 1:1 and it's not a good thing.",
	// htmls/logs.html:416; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-refactoring-the-character-status-flags-like-cursed": "Started refactoring the character status flags, like .cursed etc.. Improved/fortified the server.",
	// htmls/logs.html:357; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-relaxing-going-to-take-it-easy-for": "Started relaxing, going to take it easy for a few days.",
	// htmls/logs.html:124; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-working-more-in-a-free-manner-which":
		"Started working more in a free manner, which has it's own advantages, you get to make better high level decisions. Immediately decided to concentrate on the Steam release and nothing else. Started pushing small things to completion, polished whatever I can. Fast forward to November, still wasn't ready. As Steam has a lot of requirements, decided to release on Mac App Store first. For me, the hardest part of releases are always taking screenshots, recording videos and preparing optimal descriptions. Marketing doesn't come easy. Released on the Mac App Store around 12th of December. One good thing about the Mac App Store release: I was originally planning a very complex introductory video, it had a lot of tiers, promoted various aspects of the game, basically I was being crushed under that responsibility, however, after discovering that Mac App Store only allows videos to be 30 seconds long, I decided to only showcase the core part of the game, the coding and multi-character aspect, and ended up with a very simple yet concentrated and explanatory video, which I ended up using for Steam too.",
	// htmls/logs.html:905; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.started-working-with-jayson-it-seems-i-neglected":
		"Started working with Jayson, it seems I neglected to give him a proper tutorial on how to use the in-house map_editor, features, limitations, how to design with these in mind etc.",
	// htmls/logs.html:796; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.struggling-with-game-and-map-design-the-newcomer":
		"Struggling with game and map design, the \"Newcomer Experience\" is extremely important, the new maps are beautiful, yet I'm not sure about the main town design. I'm also unsure whether the town should be stand-alone and players should teleport to different zones - or whether the main town should be super-large that houses multiple regions in one map. Probably something in between. A large but not huge main town.",
	// htmls/logs.html:865; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.super-productive-day-i-needed-one": "Super Productive Day! I needed one.",
	// htmls/logs.html:515; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.terrified-petrified-there-is-a-new-property-on":
		"<span class=\"warning\">Terrified/Petrified:</span> There is a new property on character's, .targets, when you target multiple entities, your character now starts getting terrified, it slows down, and each attack from monsters deal an increasing amount of damage, this is to prevent the practice of tagging multiple monsters, stealing loots and getting away with it. It's much harder to do now, manually, maybe possible, but with Code, definitely not easy.",
	// htmls/logs.html:1076; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-adventure-land-on-safari-firefox-made-lots": "Tested Adventure Land on Safari/Firefox, made lots of fixes/improvements.",
	// htmls/logs.html:847; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-both-payment-routines-myself-made-fixes-improvements": "Tested both payment routines myself, made fixes, improvements, calibrations.",
	// htmls/logs.html:906; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-his-worldmap-while-impressive-it-had-too":
		'Tested his "worldmap", while impressive, it had too many overlapped tiles, an unnecessary performance hog, but, on the bright side, the map inspired me to improve the map tiling routine, it turns out PIXI children are an array, so batching the deletion improved the performance significantly, luckily this was possible without any modifications, since all map entities were naturally adjacent.',
	// htmls/logs.html:970; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-improved-the-new-routines-implemented-new-internal": "Tested/Improved the new routines, Implemented new internal interfaces",
	// htmls/logs.html:199; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-jayson-s-tavern-entities-including-the-roulette":
		'Tested Jayson\'s tavern entities, including the roulette table, slot machine and spin-game, impressive. Converted/Unified the "transport" responses.',
	// htmls/logs.html:501; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-our-latest-changes-made-some-last-minute": "Tested our latest changes, made some last minute fixes, and updated the servers!",
	// htmls/logs.html:966; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tested-some-new-routines-to-improve-the-map": "Tested some new routines to improve the map performance",
	// htmls/logs.html:148; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.thanks-to-this-new-system-last-2-months": "Thanks to this new system, last 2 months have been beyond awesome.",
	// htmls/logs.html:978; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-addition-of-shells-won-t-change-this":
		'The addition of "SHELLS" won\'t change this, on the contrary, If there is inward cash flow, I will better be able to promote the game when the time comes, and strengthen the community.',
	// htmls/logs.html:558; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-company-i-formed-is-both-adding-to":
		"The company I formed is both adding to my stress, and hard to maintain at the same time, it's also extremely costly and slow. I really wish being an individual and making business was possible. Yet it's impossible.",
	// htmls/logs.html:1067; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-day-of-huge-improvements-maybe-a-turning": "The day of HUGE improvements. Maybe a turning point in the game. My most productive day in a long time. A ~24 Hour sprint.",
	// htmls/logs.html:981; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-day-started-experimental-improved-sfx-a-bit":
		"The day started experimental, improved SFX a bit, created a Slack community for contributors, created a community map editor, the game needs another community tho, might create a forum.",
	// htmls/logs.html:271; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-game-is-greenlit-on-steam-so-fast": "The game is Greenlit on Steam, so fast, and such a relief :)",
	// htmls/logs.html:1016; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-heal-att-button-on-the-middle-ui":
		"The HEAL/ATT button on the middle UI is now functional. It's needed for priests to self-heal. But it might also help players who use touch devices and can't right click easily.",
	// htmls/logs.html:583; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-items-retain-a-hefty-history-now-exposing": "The items retain a hefty history now, exposing this history would spoil the fun, so some hefty game system improvements are needed.",
	// htmls/logs.html:184; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-live-reload-feature-both-refreshes-the-server":
		"The \"Live Reload\" feature both refreshes the server data and at the same time triggers a data reload at every connected game client. So when a new item/drop is added, existing players don't need to reconnect and the servers don't need to be updated anymore! (+ Some other internal perks, like modifying the drop rates practically)",
	// htmls/logs.html:1085; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-new-interface-has-hp-mp-character-inventory":
		"The new interface has HP/MP/Character/Inventory/Attack interfaces in the middle section. The Attack and Inventory have a recharging animation that lights up when it's active.",
	// htmls/logs.html:775; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-new-maps-are-progressing-well": "The new maps are progressing well.",
	// htmls/logs.html:458; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-new-pokemon-game-seems-like-a-flop":
		"The new Pokemon game seems like a flop, I'm guessing they cater to the newer Pokemon GO generation now, the 3D and directed gameplay wasn't enjoyable for me, I would rather have 2D and free gameplay, no matter how repetitive it is.",
	// htmls/logs.html:1084; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-original-interface-had-the-att-xp-hp":
		"The original interface had the ATT, XP, HP, MP all as buttons with texts, with cooldown animations underneath the buttons, I personally liked them, they weren't perfect, but they were awesome placeholders",
	// htmls/logs.html:1006; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-party-player-buttons-are-now-functional-it": "The Party-Player buttons are now functional. It's Heal for Priests and Focus for others.",
	// htmls/logs.html:433; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-phoenix-is-going-to-spawn-in-random": "The Phoenix is going to spawn in random spots when the system is completed.",
	// htmls/logs.html:139; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-server-has-an-initial-pre-computing-stage":
		"The server has an initial pre-computing stage, on my local i7-7700HQ, it's computed in ~13000ms, on the top AWS servers, it was around 20000ms, on the i7-4790K, it was an impressive 6900ms, double the performance of my i7-7700HQ, shame and hurray. Back in earlier tests, the AWS servers crumbled with ~70 players in one server (I improved the server logic afterwards, to slowdown ticks dynamically, fyi) - with the dedicated server, loaded 80 characters myself, it's the limit for my own internet bandwidth to handle, and the CPU utilisation was just around 30%. So I suspect the new servers could even handle 200 non-abusive players, but realistically, set the new limit at 96 players, as most players thrash the servers hard :)",
	// htmls/logs.html:471; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-sneaky-goblin-has-high-evasion-reflection-1":
		"The Sneaky Goblin has high Evasion, Reflection, 1 HP, no ATT, a mean attitude, and a hefty drop. After being hit ~100 times, he just laughs and teleports to a different place. It will be a small server-wide event. It's really hard to land a successful hit, and after it escapes, it's not that easy to find where it went :)",
	// htmls/logs.html:342; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-taunt-now-takes-the-aggro-from-monsters": 'The "Taunt" now takes the aggro from monsters that are targeting allies, thanks to Mark\'s reminder :]',
	// htmls/logs.html:1086; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.the-xp-interface-is-now-a-bar-like":
		"The XP interface is now a bar, like HP,MP, it's above the game log. The Server/Map information section is moved to the left, above the chat section, with a toggle on/off coordinate interface",
	// htmls/logs.html:241; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.there-are-3-ways-to-violate-the-rules":
		"There are 3 ways to violate the rules, 1 of them is through abusive behaviour, the second one is using 1+ accounts to overcome the 1+1 allowance for siblings, the other one is to violate the map lines. I've been receiving a lot of reports for people using 2 accounts to party in the same server, with this feature added, blocked the secondary accounts. In the future, the servers will issue temporary blockages too, for various scenarios.",
	// htmls/logs.html:509; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.there-are-players-who-commit-minor-offences-like":
		"There are players who commit minor offences, like walking past the lines, so decided to add a cute jail to our game, anyone can just walk out the jail, it's more of a friendly warning, for actual offences, the best course of action is to block accounts for a duration, or, just disable them. Again, considering we live in a world where online actions have no consequences, countries with dynamic IP's, it's a saddening challenge with no real solution.",
	// htmls/logs.html:465; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.there-will-be-3-4-quests-like-these":
		'There will be 3-4 Quests like these. One of them will be inside the "Mystery House" - It\'s not a mystery house any more, there will be rats inside that ate all the jewels of an NPC, she\'s looking for her jewels back. Each zone will likely have rare "Key" drops too, to unlock the "Dungeon" of that Region/Map. All in all, design-wise, I\'m really satisfied with the direction.',
	// htmls/logs.html:156; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.this-is-more-of-an-internal-change-enables":
		'This is more of an internal change, enables a certain usage, and makes it almost impossible to achieve something very specific. Basically, there is the "User", and "Character"s, this change adds a new model/entity called "Player" in-between. As it is, this doesn\'t add much to the game, but I believe, in the future, it will simplify certain things a lot, make things flexible, allow 1+ realms.',
	// htmls/logs.html:299; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.this-was-a-productive-day-for-jayson-wish":
		'This was a productive day for Jayson, wish his productive days are more frequent, the wing idea is an impressive one, can\'t wait to add a "wing logic" that adds wings to any character.',
	// htmls/logs.html:746; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.this-was-more-of-an-ideas-day-added":
		'This was more of an ideas day, Added a "SHELLS" UI/Info to premium items. It seems, just having the "SHELLS" button on inventory was a mistake, most people just don\'t discover it.',
	// htmls/logs.html:176; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.this-was-the-first-update-that-refactored-all":
		"This was the first update that refactored all the characters beforehand, those who were in the old town needed to be reset to positions in the new town.",
	// htmls/logs.html:498; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.tier2-armors-now-become-rare-at-7": 'Tier2 armors now become "Rare" at +7.',
	// htmls/logs.html:404; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.to-fix-a-small-issue-i-ve-deployed":
		"To fix a small issue, I've deployed an update to the game, forgetting the new limits enforcer, the enforcer discontinued almost everyone, but on the bright side, I got to improve/fix the new system. Developing a live game really isn't easy, the game almost always gets judged by it's current state, however, if the game wasn't live, I couldn't develop this efficiently, so it's definitely worth it.",
	// htmls/logs.html:941; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.to-procrastinate-completed-the-names-feature-now-whenever":
		'To procrastinate, completed the "Names" feature, now, whenever "N" is pressed, names show up. A needed feature but it wasn\'t crucial. Perfecting the text rendering is super challenging.',
	// htmls/logs.html:104; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-i-started-working-8-hours-a-week":
		"Today I started working 8 hours a week again, the weather is better, my energy is up, I believe I can keep it up for the months to come. With this new tutorial, ongoing code documentation and changes, pressing need to introduce new game content, I certainly need the strict work schedule.",
	// htmls/logs.html:349; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-is-a-big-day-for-me-personally": "Today is a big day for me personally, I completed my personal quest, the future seems brighter now. Going to celebrate this in-game soon.",
	// htmls/logs.html:859; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-is-my-birthday-getting-old-birthdays-are":
		"Today is my birthday, getting old, birthdays are stressful now, to me, they indicate another passing year without an achievement. My goal in life has become seeking success through products I built. Not healthy, maybe not logical, but it is what it is. My time with Adventure Land was rejuvenating tho, without Adventure Land, things could've been harder.",
	// htmls/logs.html:470; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-addition-the-sneaky-goblin": '<span class="feature">Today\'s Addition:</span> The Sneaky Goblin',
	// htmls/logs.html:650; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-ancient-computer": '<span class="feature">Today\'s Feature:</span> Ancient Computer',
	// htmls/logs.html:624; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-announcement-emails": '<span class="feature">Today\'s Feature: Announcement Emails</span>',
	// htmls/logs.html:188; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-attack-animation-nudge": '<span class="feature">Today\'s Feature:</span> Attack Animation: Nudge',
	// htmls/logs.html:356; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-bank-slots": '<span class="feature">Today\'s Feature:</span> Bank Slots',
	// htmls/logs.html:790; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-character-operations": '<span class="feature">Today\'s Feature:</span> Character Operations',
	// htmls/logs.html:770; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-charge": '<span class="feature">Today\'s Feature:</span> Charge',
	// htmls/logs.html:673; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-class-previews-at-creation": '<span class="feature">Today\'s Feature:</span> Class Previews at Creation',
	// htmls/logs.html:513; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-combo-s-or-penalties": "<span class=\"feature\">Today's Feature:</span> COMBO's!! (or, Penalties)",
	// htmls/logs.html:577; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-crit-complicated-upgrades": '<span class="feature">Today\'s Feature:</span> CRIT + Complicated Upgrades',
	// htmls/logs.html:752; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-curse": '<span class="feature">Today\'s Feature:</span> Curse',
	// htmls/logs.html:421; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-damage-return": '<span class="feature">Today\'s Feature:</span> Damage Return',
	// htmls/logs.html:745; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-defeat-on-escape": '<span class="feature">Today\'s Feature:</span> Defeat on Escape',
	// htmls/logs.html:333; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-dynamic-observation": '<span class="feature">Today\'s Feature:</span> Dynamic Observation',
	// htmls/logs.html:304; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-dynamic-spawn-bosses": '<span class="feature">Today\'s Feature:</span> Dynamic Spawn Bosses',
	// htmls/logs.html:739; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-first-item-ability-stun": '<span class="feature">Today\'s Feature:</span> First Item Ability: Stun!',
	// htmls/logs.html:152; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-hardcore-mode": '<span class="feature">Today\'s Feature:</span> Hardcore Mode',
	// htmls/logs.html:830; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-invis": '<span class="feature">Today\'s Feature:</span> Invis!',
	// htmls/logs.html:720; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-s-feature-is-actually-more-of-a": 'Today\'s feature is actually more of a word, "Recruit", rather then "Refer/Referral". "Recruit" is a cool, game-worthy word, I hated "Refer".',
	// htmls/logs.html:306; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-s-feature-is-the-ability-for-bosses":
		"Today's feature is the ability for bosses to spawn in random locations. This enables me to increase boss drops, it also encourages players to write smarter Code's.",
	// htmls/logs.html:159; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-mail": '<span class="feature">Today\'s Feature:</span> Mail',
	// htmls/logs.html:813; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-mana-burst": '<span class="feature">Today\'s Feature:</span> Mana Burst!',
	// htmls/logs.html:758; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-merchanting-with-merchant-stand-s": '<span class="feature">Today\'s Feature:</span> Merchanting! with "Merchant Stand"s + "[AFK]"',
	// htmls/logs.html:562; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-minimap": '<span class="feature">Today\'s Feature:</span> Minimap',
	// htmls/logs.html:482; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-monsters-with-properties-charging-monsters": '<span class="feature">Today\'s Feature:</span> Monsters with Properties + Charging Monsters',
	// htmls/logs.html:730; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-new-attribute-armor-piercing-and": '<span class="feature">Today\'s Feature:</span> New Attribute: Armor Piercing (and Resistance Piercing)',
	// htmls/logs.html:155; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-player": '<span class="feature">Today\'s Feature:</span> Player',
	// htmls/logs.html:839; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-pvp-hit-indicator-escape-prevention": '<span class="feature">Today\'s Feature:</span> PVP Hit Indicator + Escape Prevention',
	// htmls/logs.html:808; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-pvp-servers": '<span class="feature">Today\'s Feature:</span> PVP Servers!',
	// htmls/logs.html:778; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-random-looks-routine": '<span class="feature">Today\'s Feature:</span> Random Looks Routine',
	// htmls/logs.html:682; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-ranger": '<span class="feature">Today\'s Feature:</span> Ranger',
	// htmls/logs.html:794; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-referrals": '<span class="feature">Today\'s Feature:</span> Referrals!',
	// htmls/logs.html:696; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-rogue": '<span class="feature">Today\'s Feature:</span> Rogue!!',
	// htmls/logs.html:783; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-s-dracul-s-cape-lifesteal": "<span class=\"feature\">Today's Feature(s):</span> Dracul's Cape + Lifesteal + Basher",
	// htmls/logs.html:494; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-sales-tax": '<span class="feature">Today\'s Feature:</span> Sales Tax!',
	// htmls/logs.html:656; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-skillbar-prototype": '<span class="feature">Today\'s Feature:</span> Skillbar Prototype',
	// htmls/logs.html:285; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-stacked-listings-for-merchant-s": "<span class=\"feature\">Today's Feature:</span> Stacked Listings for Merchant's!",
	// htmls/logs.html:667; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-supershot": '<span class="feature">Today\'s Feature:</span> Supershot',
	// htmls/logs.html:413; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-targeting-aggressive-monsters": '<span class="feature">Today\'s Feature:</span> Targeting Aggressive Monsters',
	// htmls/logs.html:818; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-taunt": '<span class="feature">Today\'s Feature:</span> Taunt',
	// htmls/logs.html:249; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-tavern-roulette": '<span class="feature">Today\'s Feature:</span> Tavern: Roulette',
	// htmls/logs.html:240; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-temporary-account-blockage-analysis-routines": '<span class="feature">Today\'s Feature:</span> Temporary Account Blockage + Analysis Routines',
	// htmls/logs.html:279; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-the-second-chance-ability": '<span class="feature">Today\'s Feature:</span> The Second Chance Ability',
	// htmls/logs.html:711; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-tier-1-2-3-4": '<span class="feature">Today\'s Feature:</span> Tier 1/2/3/4 Armors',
	// htmls/logs.html:723; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-tiny-crab-s-and-in": "<span class=\"feature\">Today's Feature:</span> Tiny Crab's (and in future, Spiderling's)",
	// htmls/logs.html:801; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-tome-of-protection": '<span class="feature">Today\'s Feature:</span> Tome of Protection!',
	// htmls/logs.html:639; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-transport-npc-red-lady": '<span class="feature">Today\'s Feature:</span> Transport NPC: Red Lady',
	// htmls/logs.html:567; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-vitality-attribute-first-npc-dialog": '<span class="feature">Today\'s Feature:</span> Vitality Attribute + First NPC Dialog',
	// htmls/logs.html:715; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-feature-your-recruits": '<span class="feature">Today\'s Feature:</span> "Your Recruits"',
	// htmls/logs.html:182; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-features-live-reload-new-town-well": "<span class=\"feature\">Today's Features:</span> Live Reload! + New Town! + Well-Crafted Bow, Sucker Punch, Mole's Teeth Earring!",
	// htmls/logs.html:528; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-addressed-the-pvp-issues": '<span class="feature">Today\'s Highlight:</span> Addressed the PVP Issues',
	// htmls/logs.html:340; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-boosters": '<span class="feature">Today\'s Highlight:</span> Boosters',
	// htmls/logs.html:328; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-code-video": '<span class="feature">Today\'s Highlight:</span> Code Video',
	// htmls/logs.html:226; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-s-highlight-comes-from-thezhoul-on-discord":
		'Today\'s highlight comes from "theZhoul" on Discord, he discovered that consecutive "move"s are to blame for the "move" discrepancies that we discovered thanks to the location correction routine. He did this externally. Internally, running the "mode.debug_moves" routine, it\'s indeed the case. Reason: There is an internal move timer, it resets every time a move command arrives, the fix is to reset the timer only when the player isn\'t already moving. I love patches/bugfixes like these. Simple yet great.',
	// htmls/logs.html:603; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-europas-i-down": '<span class="feature">Today\'s Highlight: Europas I Down</span>',
	// htmls/logs.html:556; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-first-version-of-the-steam": '<span class="feature">Today\'s Highlight:</span> First Version of the Steam Greenlight Video + Smooth Walk',
	// htmls/logs.html:462; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-fisherman-npc": '<span class="feature">Today\'s Highlight:</span> Fisherman(?) NPC',
	// htmls/logs.html:543; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-s-highlight-friends-system-materialising": "Today's Highlight: Friends System Materialising",
	// htmls/logs.html:270; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-greenlit": '<span class="feature">Today\'s Highlight:</span> Greenlit!',
	// htmls/logs.html:216; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-how-machines-can-be-misunderstood": '<span class="feature">Today\'s Highlight:</span> How Machines Can be Misunderstood',
	// htmls/logs.html:427; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-improved-password-routines": '<span class="feature">Today\'s Highlight:</span> Improved Password Routines',
	// htmls/logs.html:549; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-s-highlight-item-designs": "Today's Highlight: Item Designs",
	// htmls/logs.html:298; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-json-s-wings": "<span class=\"feature\">Today's Highlight:</span> Json's Wings",
	// htmls/logs.html:174; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-launch-of-the-new-town": '<span class="feature">Today\'s Highlight:</span> Launch of the New Town!',
	// htmls/logs.html:275; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-new-items-with-ellian": '<span class="feature">Today\'s Highlight:</span> New Items with Ellian',
	// htmls/logs.html:488; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-post-server-update-stuff": '<span class="feature">Today\'s Highlight:</span> Post Server Update Stuff',
	// htmls/logs.html:323; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-second-reddit-announcement": '<span class="feature">Today\'s Highlight:</span> Second Reddit Announcement',
	// htmls/logs.html:318; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-steam-greenlight-page": '<span class="feature">Today\'s Highlight:</span> Steam Greenlight Page!',
	// htmls/logs.html:255; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-tavern-first-step": '<span class="feature">Today\'s Highlight:</span> Tavern: First Step',
	// htmls/logs.html:294; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-the-mining-tunnel": '<span class="feature">Today\'s Highlight:</span> The Mining Tunnel',
	// htmls/logs.html:611; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-the-reddit-day": '<span class="feature">Today\'s Highlight: The Reddit Day!!!</span>',
	// htmls/logs.html:290; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-weapon-tiering-system": '<span class="feature">Today\'s Highlight:</span> Weapon Tiering System',
	// htmls/logs.html:314; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-xmas-email-interaction": '<span class="feature">Today\'s Highlight:</span> Xmas Email + Interaction',
	// htmls/logs.html:362; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-xmas-launch": '<span class="feature">Today\'s Highlight:</span> Xmas Launch',
	// htmls/logs.html:375; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-xmas-push": '<span class="feature">Today\'s Highlight:</span> Xmas Push',
	// htmls/logs.html:400; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlight-xmas-rush": '<span class="feature">Today\'s Highlight:</span> Xmas Rush',
	// htmls/logs.html:534; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-agile-parties-added-the-pm": '<span class="feature">Today\'s Highlights:</span> Agile Parties + Added the "PM" Button + Greenlight Gameplay Video',
	// htmls/logs.html:197; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-band-of-fury-evasion-reflection": '<span class="feature">Today\'s Highlights:</span> Band of Fury + Evasion/Reflection Scrolls',
	// htmls/logs.html:443; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-elixirs-christmas-items-and-improved": '<span class="feature">Today\'s Highlights:</span> Elixirs, Christmas Items and Improved Item Speeds',
	// htmls/logs.html:223; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-injustice-i-ve-caused-bugfix": "<span class=\"feature\">Today's Highlights:</span> Injustice I've Caused + Bugfix Relief",
	// htmls/logs.html:504; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-more-pvp-improvements-vitality-scroll": '<span class="feature">Today\'s Highlights:</span> More PVP Improvements + Vitality Scroll + Lottery Lady! + Jail!! + Quirks',
	// htmls/logs.html:633; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-ms-dracul-mobile-improvements-low":
		'<span class="feature">Today\'s Highlights:</span> Ms. Dracul + Mobile Improvements + Low-FPS Improvements + Improved Interactions',
	// htmls/logs.html:193; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-new-town-s-integrations-vitality": "<span class=\"feature\">Today's Highlights:</span> New Town's Integrations + Vitality Earring",
	// htmls/logs.html:265; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-new-year-s-eve-boost": "<span class=\"feature\">Today's Highlights:</span> New Year's Eve Boost + Next Iteration of Limits Enforcer",
	// htmls/logs.html:453; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-paid-the-logs-debt-combined": '<span class="feature">Today\'s Highlights:</span> Paid the Logs Debt + Combined Damage Warnings',
	// htmls/logs.html:432; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-random-respawns-and-other-stuff": '<span class="feature">Today\'s Highlights:</span> Random Respawns and other stuff ...',
	// htmls/logs.html:520; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-highlights-server-refactoring-new-layer-s": '<span class="feature">Today\'s Highlights:</span> Server Refactoring + New Layer(s) + Trade Protection',
	// htmls/logs.html:586; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-improvement-pvp-balancing-evasion-reflection": '<span class="feature">Today\'s Improvement:</span> PVP Balancing + Evasion/Reflection',
	// htmls/logs.html:330; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.code_language_preparation":
		'Today\'s main task was the preparation of the "Code Showcase" for the Steam Greenlight page, marketing material for any kind challenges me, but preparing the video ended up being fun, I wish I did this a month earlier.',
	// htmls/logs.html:704; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-theme-endgame-re-balancing": '<span class="feature">Today\'s Theme:</span> Endgame Re-Balancing',
	// htmls/logs.html:594; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.today-s-topic-it-is-what-it-is": '<span class="feature">Today\'s Topic:</span> It Is What It Is',
	// htmls/logs.html:753; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-was-a-busy-day-for-me-not": "Today was a busy day for me, not in a good way, I need to enrol in a university every semester, for reasons specific to my country :[",
	// htmls/logs.html:183; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-was-a-long-and-productive-day-started":
		'Today was a long and productive day, started by integrating the new elixirs, adding quirks to the new town. Decided to add the "Live Reload" feature before launch, as it allows on-the-fly changes to the server data, like adding new items, modifying existing items. I was doing these kind of things manually, but after the "Orb of Second Chances" incident, it was clear something better was needed.',
	// htmls/logs.html:454; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-was-a-slow-and-relaxing-day-caught":
		"Today was a slow and relaxing day, caught up with the /logs. In the background, I'm constantly weighing alternatives and options about the game's direction. If past has proved anything, bad decisions are costly.",
	// htmls/logs.html:668; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-was-a-slow-day-improved-rogue-s": "Today was a slow day, Improved Rogue's SNEAK! attack, added the damage modifier.",
	// htmls/logs.html:397; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.today-was-an-extremely-productive-and-satisfying-day":
		"Today was an extremely productive and satisfying day, one personal lesson is, it's a good idea to live a relaxed life, as long as you can squeeze in 10x productive days like these every once in a while.",
	// htmls/logs.html:474; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.took-care-of-some-things-i-was-delaying":
		"Took care of some things I was delaying, Announcing our Merchant Class, a Debit Card application for the company. Paypal really hurt everyone in Turkey, more than it needs to, there is nothing preventing them from simply charging credit cards, apart from their online wallet, you realise everyone uses Paypal when you lose the ability to use Paypal. Most of my issues these past 2 months originated from Paypal challenges too, almost all Pixel Artists, Freelancers, use Paypal to get paid. Even though I have a relative abroad to make payments on my behalf. It's still very challenging. Not everyone is understanding either. Now, only finalising the \"Community Code\" video and preparing the Steam Greenlight page remains. Taking screenshots, preparing videos, any kind of pr/marketing, these are the tasks that I always hate and delay. They really don't come easy to me.",
	// htmls/logs.html:383; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.turns-out-i-was-mis-spelling-mistletoe-all": 'Turns out I was mis-spelling "Mistletoe" all this time, I thought it was "Misletoe", lol.',
	// htmls/logs.html:396; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.unified-all-npc-interactions-i-love-refactoring": "Unified all NPC interactions, I love refactoring.",
	// htmls/logs.html:414; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.up-to-now-some-monsters-only-attacked-players": "Up to now, some monsters only attacked players and moved on, with this improvement, they might target the player too.",
	// htmls/logs.html:237; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.updated-most-of-our-existing-items-to-the": "Updated most of our existing items to the new looks.",
	// htmls/logs.html:646; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.updated-our-map-tilesets-and-refactored-our-maps": "Updated our map tilesets and refactored our maps.",
	// htmls/logs.html:669; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.updated-the-game-collaborated-with-jayson-improved-the": "Updated the game, collaborated with Jayson, improved the conversation with Ellian, announced the Rogue class.",
	// htmls/logs.html:337; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.updated-the-game-fixed-the-issues": "Updated the game, fixed the issues.",
	// htmls/logs.html:718; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.updated-these-logs-i-hadn-t-synchronised-them": "Updated these logs, I hadn't synchronised them since 26/09, so this was basically a debt-day.",
	// htmls/logs.html:500; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.updating-this-logs-it-s-really-challenging-there":
		"Updating this /logs - It's really challenging, there are a lot of changes every day, and when I neglect to update the logs even for a week, it becomes an extreme chore :)",
	// htmls/logs.html:1032; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.very-stressful-day-only-researched-peerjs-would-be": "Very stressful day, only researched PeerJS, would be a nice addition to CODE.",
	// htmls/logs.html:719; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.viewed-jayson-s-second-version-of-the-town":
		"Viewed Jayson's second version of the town map, he surprises me with every new thing he shows, I really wasn't expecting an iteration of the town map, I just got used to the first version (which is actually, maybe the 5th iteration, but at least it was the first version of that iteration up until now). Now the beach has large trees. The upgrade/compound house is bigger. I'm still not sure whether I preferred the original version tho.",
	// htmls/logs.html:540; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.we-finally-synchronised-and-recorded-a-short-simple":
		"We finally synchronised and recorded a short, simple Gameplay video for the Steam Greenlight page, Thanks to Json, Muhnch, Grim, draivin, Deliagwath, Aelwrath and everyone who participated in the earlier versions.",
	// htmls/logs.html:754; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.we-improved-the-mystery-house-design-with-jayson":
		'We improved the "Mystery House" design with Jayson, he was already working on the rooms, but it seems we needed to synchronise. I got the chance to improve my design.',
	// htmls/logs.html:401; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.we-ve-started-working-with-jayson-heavily-sadly":
		"We've started working with Jayson heavily, sadly, Sun Pixels didn't deliver on his promises, so it's up to us to achieve the Xmas goals. Luckily, the items Ellian prepared for Xmas are perfect.",
	// htmls/logs.html:759; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.well-this-was-a-productive-day": "Well this was a productive day.",
	// htmls/logs.html:606; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.when-the-server-went-down-players-defaulted-to":
		"When the server went down, players defaulted to Europas II, which was a PVP server at the time, and they got wiped out, a lot of players thought the game was pvp-only during that time. After this experience, I improved the server selection logic, to prioritise PVE servers over PVP.",
	// htmls/logs.html:536; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.while-designing-the-new-items-decided-to-give":
		"While designing the new items, decided to give Basher a push, boosted the damage significantly. Improved my internal items interface, added filtering, it's easier to compare and improve items now.",
	// htmls/logs.html:987; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.while-i-was-at-it-tested-several-new":
		"While I was at it, tested several new methods that will improve the game performance, but decided to delay these endeavours, gameplay should come first, the game is already 60fps in most systems.",
	// htmls/logs.html:1071; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.while-spending-time-with-the-early-players-trade":
		'While spending time with the early players, Trade was requested again, players really need to transfer items to their friends and alt-characters, so decided to push the day further and add a basic trade too. It\'s not "Trade", but rather, a way to practically showcase and sell items',
	// htmls/logs.html:1014; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.with-death-in-the-picture-game-became-much":
		'With death in the picture, game became much harder, the logical next step was introducing the Priest class. I already knew how I wanted to implement/integrate the Priest and just decided to make it happen today. I personally love the new priest class. It\'s just right click to heal and similarly right-click to attack, however the attack only does 40% of the heal. Improved the interfaces to include "HEAL".',
	// htmls/logs.html:563; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.with-our-new-map-architecture-adding-a-minimap":
		"With our new map architecture, adding a minimap ended up being trivial, yet, since our maps are cozy, there is no point in adding one, so I temporarily axed the minimap.",
	// htmls/logs.html:705; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.without-piercing-properties-950-armor-95-reduction-in":
		"Without piercing properties, 950 armor = 95% Reduction in Physical Damage, 950 Resistance = 95% Reduction in Magic Damage. So, the challenge is, all armors should be useful, relevant, yet it should be challenging to get close to high armor/resistance levels. Ideally, ~50% should be achievable by a dedicated player who plays the game for weeks.",
	// htmls/logs.html:620; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.logs.woke-up-around-8pm-our-regulars-were-enjoying":
		'Woke up around 8PM, our regulars were enjoying the Halloween Zone, spent some time with them, I wasn\'t sure whether I should retry the email routine, started browsing Reddit, got the idea to announce the game on r/mmorpg, It was something I was planning to do, but not this early on, however, I really wanted our new Halloween Zone to be enjoyed and remembered, so I just prepared an introduction, from the bottom of my heart and posted it: <a href="https://www.reddit.com/r/MMORPG/comments/5855bd/adventure_land_an_mmorpg_in_which_you_can_code/" class="devlink"><span class="devlink">https://www.reddit.com/r/MMORPG/comments/5855bd/adventure_land_an_mmorpg_in_which_you_can_code/</span></a>',
	// htmls/logs.html:305; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.woke-up-early-to-a-semi-nightmare-it":
		"Woke up early to a semi-nightmare. It occurred to me that I might've set a high gold drop for Rudolph. Checked the statistics, it wasn't the case, but it was still higher than intended rates, Mark also noticed it and started farming it, ended up patching the drop rate.",
	// htmls/logs.html:495; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.worked-on-our-community-code-video-adjusted-the": "Worked on our Community Code video. Adjusted the upgrade/compound rates slightly.",
	// htmls/logs.html:434; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.worked-with-jayson-a-bit-i-encouraged-him":
		"Worked with Jayson a bit, I encouraged him a lot to improve his pixel art skills in the past, contribute to the map tiles, he designed some tiles today, they ended up great.",
	// htmls/logs.html:311; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.working-on-an-improved-movement-and-visibility-system":
		"Working on an improved movement and visibility system. Current system is a bit complex, it's the 4th or 5th iteration, I really want to make some time and move to a 6th iteration.",
	// htmls/logs.html:674; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.working-on-the-orb-design-3x-orb-s":
		"Working on the orb design, 3X Orb's just doesn't seem nice, it's too lazy, had the idea to convert one Orb to an Elixir slot, it will be a long-duration booster potion.",
	// htmls/logs.html:945; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.wow-just-realised-it-has-been-a-month":
		"WOW, just realised it has been a month since the launch, we've come a long way since then, I see the game as a community now, met a lot of people, made a lot of friends, my entire vision changed, and not just about the game too, about life in general, about development. Let's just say I'm more hopeful now, about many things :)",
	// htmls/logs.html:885; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.logs.wrapping-up-the-bugfixes-research-testing": "Wrapping up the bugfixes, research, testing.",
	// htmls/macos.html:82; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.adventure-land-uses-electron-when-you-stumble-onto":
		'Adventure Land uses Electron. When you stumble onto an issue, you can google the issue by combining error phrases with "electron".',
	// htmls/macos.html:103; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.app-store-can-t-install-unable-to-download": 'App Store: Can\'t Install - "Unable to Download App"',
	// htmls/macos.html:97; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.app-store-run-from-the-command-line": "App Store: Run from the Command Line",
	// htmls/macos.html:98; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.copy-paste-this-to-terminal-applications-adventure-land": "Copy paste this to Terminal: /Applications/Adventure\\ Land.app/Contents/MacOS/Adventure\\ Land",
	// htmls/macos.html:91; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.macos.copy-paste-this-to-terminal-by-inserting-your":
		"Copy paste this to Terminal by inserting your own system user: /Users/YOUR_USER/Library/Application\\ Support/Steam/steamapps/common/adventureland/Adventure\\ Land.app/Contents/MacOS/Adventure\\ Land<br />\n\t\t\t\t\tYou'll likely stumble onto the issue that you can report/search",
	// htmls/macos.html:112; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.if-you-find-and-solve-an-issue-or": "If you find and solve an issue, or just stumble onto an issue you can't solve, please email hello@adventure.land with details",
	// htmls/macos.html:85; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.just-re-open-or-re-install": "Just Re-Open or Re-Install",
	// htmls/macos.html:5; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.macos-how-to-make-it-work": "MacOS: How to Make it Work",
	// htmls/macos.html:104; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.please-email-hello-adventure-land": "Please email hello@adventure.land",
	// htmls/macos.html:109; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.restart-steam": "Restart Steam",
	// htmls/macos.html:108; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.src-common-pipes-cpp-883-fatal-stalled-cross": "src/common/pipes.cpp (883) : fatal stalled cross-thread pipe.",
	// htmls/macos.html:90; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.steam-run-from-the-command-line": "Steam: Run from the Command Line",
	// htmls/macos.html:86; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.macos.very-rarely-steam-glitches-and-the-game-can":
		"Very rarely Steam glitches and the game can't connect to Steamworks, so restarting Steam is a must. Sometimes simply doing a clean install could be the solution.",
	// htmls/mainframe.html:94; Page li prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.add-the-server-url-and-bearer-token-to": "Add the server URL and Bearer token to your AI client's MCP settings.",
	// htmls/mainframe.html:100; Page footer prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.at-renewal-1-shell-buys-60m-for-1":
		'<span id="billing-note">At renewal, 1 Shell buys 60m for 1 active character, 50m for 2, 45m for 3, or 40m for 4. Disconnect to stop future renewals; paid time is not refunded.</span><span>Direct runs are isolated; CODE can include up to three more characters in the same machine.</span>',
	// htmls/mainframe.html:90; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.checking-token": '<strong id="token-status" class="muted">Checking token…</strong><span id="token-status-detail" class="muted"></span>',
	// htmls/mainframe.html:82; Page nav prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.com-guide-game": '<a href="/hub">Hub</a><a href="/docs/guide/mainframe">Guide</a><a href="/">Game</a>',
	// htmls/mainframe.html:90; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.connect-an-ai": "Connect an AI",
	// htmls/mainframe.html:87; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.connecting": '<span class="dot"></span><strong id="status-title">Connecting</strong>',
	// htmls/mainframe.html:94; Page li prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.create-a-token-mainframe-keeps-it-masked-until": "Create a token. Mainframe keeps it masked until you press <strong>Reveal token</strong>.",
	// htmls/mainframe.html:92; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.create-token-reveal-token-copy-connection-revoke-token":
		'<button id="create-token" type="button" disabled>Create token</button><button id="reveal-token" type="button" style="display:none">Reveal token</button><button id="copy-token" type="button" style="display:none">Copy connection</button><button id="revoke-token" class="disconnect" type="button" disabled>Revoke token</button><a href="/docs/guide/adventure-mcp" style="padding:9px 12px">Setup guide</a>',
	// htmls/mainframe.html:91; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.first-resource": "First resource",
	// htmls/mainframe.html:90; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.give-an-ai-the-game-knowledge-code-tools": "Give an AI the game knowledge, CODE tools, and control of your owned Mainframe characters.",
	// htmls/mainframe.html:82; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.label-main-navigation": "Main navigation",
	// htmls/mainframe.html:99; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.loading-characters": "Loading characters…",
	// htmls/mainframe.html:95; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.one-token-is-active-per-account-it-is":
		"One token is active per account. It is encrypted at rest and returned only to the signed-in account. Treat it like a password. Rotating invalidates the old token immediately.",
	// htmls/mainframe.html:85; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.open-adventure-land": '<a href="/">Open Adventure Land</a>',
	// htmls/mainframe.html:85; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.open-adventure-land-sign-in-then-return-to": "Open Adventure Land, sign in, then return to Mainframe.",
	// htmls/mainframe.html:98; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.renewal-cost-1-shell-1-60m-2-50m": '<span>Renewal cost</span><strong id="cost">1 Shell · 1=60m · 2=50m · 3=45m · 4=40m</strong>',
	// htmls/mainframe.html:98; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.running": '<span>Running</span><strong id="running">—</strong>',
	// htmls/mainframe.html:91; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.server-url": "Server URL",
	// htmls/mainframe.html:85; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.sign-in-first": "Sign in first",
	// htmls/mainframe.html:94; Page li prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.tell-the-ai-to-read-the-first-resource": "Tell the AI to read the first resource and its CODE reading order, then inspect your Mainframe dashboard and exact game contracts.",
	// htmls/mainframe.html:91; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.transport": "Transport",
	// htmls/mainframe.html:87; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.waiting-for-mainframe": "Waiting for Mainframe.",
	// htmls/mainframe.html:81; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.your-characters-keep-running-in-adventure-land": "Your characters keep running in Adventure Land.",
	// htmls/mainframe.html:98; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.mainframe.your-shells": '<span>Your Shells</span><strong id="shells">—</strong>',
	// htmls/mainframe.html:97; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.mainframe.your-steam-time-is-shared-by-every-adventure":
		"Your Steam time is shared by every Adventure Land account linked to the same Steam account. One free hour replaces one Shell at renewal. Included CODE workers shorten the next renewal period according to the active group size.",
	// htmls/page.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.page.adventure-land": '<a class="gamebutton" href="/">&lt; Adventure Land</a>',
	// htmls/page.html:18; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.page.discord": "Discord!",
	// htmls/page.html:16; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.page.you-can-always-email-me-at-hello-adventure": "You can always email me at hello@adventure.land\n\n\t\t\t\t\tAlso check out our",
	// htmls/page.html:18; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.page.you-can-pm-wizard-on-discord-for-faster": "- You can PM Wizard on Discord for faster and more informal replies :)",
	// htmls/player.html:4; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.player.adventure-land": '<a class="gamebutton" href="/">&lt; Adventure Land</a>',
	// htmls/realm.html:57; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.adventure-land-map-connections-a-selectable-graph-of":
		'<svg id="realm-graph" viewBox="0 0 1500 900" role="img" aria-labelledby="realm-graph-title realm-graph-description">\n\t\t\t\t\t\t<title id="realm-graph-title">Adventure Land map connections</title>\n\t\t\t\t\t\t<desc id="realm-graph-description">A selectable graph of every live map and its direct passage or transporter connections.</desc>\n\t\t\t\t\t</svg>',
	// htmls/realm.html:19; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.adventure-land-world-reference": "Adventure Land world reference",
	// htmls/realm.html:36; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.connections": '<strong id="connection-total">—</strong><span>connections</span>',
	// htmls/realm.html:24; Page nav prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.connections-maps-monsters-game":
		'<a href="#connections">Connections</a>\n\t\t\t\t\t<a href="#maps">Maps</a>\n\t\t\t\t\t<a href="#bestiary">Monsters</a>\n\t\t\t\t\t<a href="/">Game</a>',
	// htmls/realm.html:109; Page h3 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.doors-and-arrivals": "Doors and arrivals",
	// htmls/realm.html:21; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.every-live-map-passage-monster-npc-citizen-and": "Every live map, passage, monster, NPC, citizen, and known way in. Built from the current game data.",
	// htmls/realm.html:138; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.every-monster-definition-is-shown-including-rare-and": "Every monster definition is shown, including rare and dynamic creatures without a fixed territory.",
	// htmls/realm.html:125; Page label prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.find-a-map": "Find a map",
	// htmls/realm.html:141; Page label prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.find-a-monster": "Find a monster",
	// htmls/realm.html:47; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-connection-legend": "Connection legend",
	// htmls/realm.html:90; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-map-annotation-layers": "Map annotation layers",
	// htmls/realm.html:72; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-map-annotation-legend": "Map annotation legend",
	// htmls/realm.html:95; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-map-zoom-controls": "Map zoom controls",
	// htmls/realm.html:126; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-name-id-monster-npc-or-access": "Name, id, monster, NPC, or access",
	// htmls/realm.html:142; Page placeholder attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-name-id-or-map": "Name, id, or map",
	// htmls/realm.html:23; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-realm-atlas-sections": "Realm atlas sections",
	// htmls/realm.html:31; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-realm-totals": "Realm totals",
	// htmls/realm.html:107; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-selected-map-annotations": "Selected map annotations",
	// htmls/realm.html:104; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-selected-map-with-world-annotations": "Selected map with world annotations",
	// htmls/realm.html:98; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-zoom-map-in": "Zoom map in",
	// htmls/realm.html:96; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.label-zoom-map-out": "Zoom map out",
	// htmls/realm.html:86; Page h3 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.loading-maps": "Loading maps",
	// htmls/realm.html:105; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.map-geometry-is-not-available-in-the-current": "Map geometry is not available in the current data.",
	// htmls/realm.html:68; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.map-survey": "Map survey",
	// htmls/realm.html:70; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.map-tiles-are-rendered-from-the-current-geometry":
		"Map tiles are rendered from the current geometry. Monster territory, doorways, arrivals, NPCs, and citizen routes are placed on top.",
	// htmls/realm.html:32; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.maps": '<strong id="map-total">—</strong><span>maps</span>',
	// htmls/realm.html:73; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.monster-zone-doorway-arrival-npc-citizen-transporter-drag":
		'<span><i class="map-mark monster"></i>Monster zone</span>\n\t\t\t\t\t<span><i class="map-mark doorway"></i>Doorway</span>\n\t\t\t\t\t<span><i class="map-mark arrival"></i>Arrival</span>\n\t\t\t\t\t<span><i class="map-mark npc"></i>NPC</span>\n\t\t\t\t\t<span><i class="map-mark citizen"></i>Citizen</span>\n\t\t\t\t\t<span><i class="map-mark transporter"></i>Transporter</span>\n\t\t\t\t\t<span class="map-hint">Drag to pan · Select a gold doorway to travel</span>',
	// htmls/realm.html:117; Page h3 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.monster-zones": "Monster zones",
	// htmls/realm.html:33; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.monsters": '<strong id="monster-total">—</strong><span>monsters</span>',
	// htmls/realm.html:91; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.monsters-doors-and-arrivals-npcs-and-citizens":
		'<label><input id="layer-monsters" type="checkbox" checked /> Monsters</label>\n\t\t\t\t\t\t\t\t<label><input id="layer-connections" type="checkbox" checked /> Doors and arrivals</label>\n\t\t\t\t\t\t\t\t<label><input id="layer-npcs" type="checkbox" checked /> NPCs and citizens</label>',
	// htmls/realm.html:34; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.npcs-and-citizens": '<strong id="npc-total">—</strong><span>NPCs and citizens</span>',
	// htmls/realm.html:113; Page h3 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.npcs-and-citizens-2": "NPCs and citizens",
	// htmls/realm.html:48; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.passage-one-way-passage-transporter-route-outside-underground":
		'<span><i class="legend-line passage"></i>Passage</span>\n\t\t\t\t\t<span><i class="legend-line one-way"></i>One-way passage</span>\n\t\t\t\t\t<span><i class="legend-line transport"></i>Transporter route</span>\n\t\t\t\t\t<span><i class="legend-node outdoor"></i>Outside</span>\n\t\t\t\t\t<span><i class="legend-node underground"></i>Underground</span>\n\t\t\t\t\t<span><i class="legend-node interior"></i>Interior</span>\n\t\t\t\t\t<span><i class="legend-node special"></i>Event, instance, or PvP</span>',
	// htmls/realm.html:45; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.passages-are-mapped-from-doors-transport-routes-join": "Passages are mapped from doors. Transport routes join maps served by Alia. Select a map to open it below.",
	// htmls/realm.html:20; Page h1 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.realm-atlas": "Realm Atlas",
	// htmls/realm.html:136; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.realm-bestiary": "Realm bestiary",
	// htmls/realm.html:43; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.realm.realm-connections": "Realm connections",
	// htmls/realm.html:35; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.realm.spawn-zones": '<strong id="zone-total">—</strong><span>spawn zones</span>',
	// htmls/roadmap.html:96; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.achievements-statistics-leaderboards": "Achievements/Statistics/Leaderboards",
	// htmls/roadmap.html:100; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.communicator": "Communicator",
	// htmls/roadmap.html:102; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.content-new-items-events-quests": "Content: New Items, Events, Quests",
	// htmls/roadmap.html:93; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.daily-events": "Daily Events",
	// htmls/roadmap.html:99; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.ever-since-i-ve-launched-the-game-with":
		"Ever since I've launched the game, with the exception of the Xmas Tune, the tunes and fx has been the same, going to improve the fx logic, and re-visit all the sound/fx selections at one point. It's challenging.",
	// htmls/roadmap.html:103; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.in-progress-continually-working-on-adding-new-content":
		"<b>In Progress:</b> Continually working on adding new content to the game, most of the cave entrances in game are unused at the moment. Planning on adding triggerable events like dungeons.",
	// htmls/roadmap.html:101; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.in-progress-the-friends-system-is-complete-the":
		"<b>In Progress:</b> The friends system is complete, the Communicator needs serious improvements on the interface/usability side of things. Going to add additional features to the server so players have a way to communicate, get to know new players.",
	// htmls/roadmap.html:92; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.in-progress-working-on-balance-changes-new-skills":
		'<b>In Progress:</b> Working on balance changes, new skills, new methods to improve PVP. Likely going to limit the XP exchange and introduce "Item Drops" from players. Basically, "Newly Acquired" items will have a chance to drop on death.',
	// htmls/roadmap.html:90; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.last-status-code-design-and-the-server-implementation": "<b>Last Status:</b> Code design and the server implementation is ready, working on Animations/UI.",
	// htmls/roadmap.html:95; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.last-status-the-goo-brawl-event-is-ready": '<b>Last Status:</b> The "Goo Brawl" event is ready, working on the first PVP event.',
	// htmls/roadmap.html:97; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.observing-the-gameplay-and-the-needs-of-the":
		"Observing the gameplay and the needs of the players, this feature is heavily needed and requested, I'm not 100% sure how to go forward with the Achievements and Awards, going to start with basic Statistics and Leaderboards first.",
	// htmls/roadmap.html:5; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.planned-features": "Planned Features",
	// htmls/roadmap.html:85; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.planned-features-last-update-12-02-17": 'Planned Features <span style="float:right">Last Update [12/02/17]</span>',
	// htmls/roadmap.html:89; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.purpose-a-place-to-relax": "<b>Purpose:</b> A place to relax,",
	// htmls/roadmap.html:94; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.roadmap.purpose-every-server-is-going-to-run-an":
		"<b>Purpose:</b> Every server is going to run an event every day at 9:20PM. While the game is mostly an idle/afk/coding game, these daily events will be an opportunity to socialise and have some fun.",
	// htmls/roadmap.html:91; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.pvp": "PVP",
	// htmls/roadmap.html:98; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.sound-fx": "Sound/FX",
	// htmls/roadmap.html:88; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.tavern": "Tavern",
	// htmls/roadmap.html:104; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.the-resort": "The Resort",
	// htmls/roadmap.html:105; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.this-is-the-feature-i-m-second-most":
		'This is the feature I\'m second most excited about, first one being the Tavern. The Resort is kind of like the holodecks in Star Trek. Everyone will be able to design their own maps/rooms, and hopefully Code for them too. While the "Community Map Editor" is ready, the Code part, security is the challenge.',
	// htmls/roadmap.html:87; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.roadmap.while-the-standalone-version-of-the-game-has":
		'While the standalone version of the game has been ready for some time, decided to postpone the Steam release until the game is fuller, basically, I think, "Daily Events", "Tavern", "Documented Code", "Improved Sound/FX" should be completed beforehand.',
	// htmls/runner.html:31; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.runner.initiating": "Initiating",
	// htmls/steam_purchase.html:62; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.steam_purchase.checking-your-purchase": "Checking your purchase ...",
	// htmls/steam_purchase.html:63; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.steam_purchase.keep-adventure-land-open-while-steam-finishes-the": "Keep Adventure Land open while Steam finishes the transaction.",
	// htmls/steam_purchase.html:61; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.steam_purchase.steam-purchase": "Steam Purchase",
	// htmls/steam_purchase.html:9; Page title prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.steam_purchase.steam-purchase-adventure-land": "Steam Purchase - Adventure Land",
	// htmls/vscode.html:293; Page strong prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.1-create-a-token": "1. Create a token",
	// htmls/vscode.html:297; Page strong prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.2-paste-it-in-vs-code": "2. Paste it in VS Code",
	// htmls/vscode.html:301; Page strong prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.3-activate-a-folder": "3. Activate a folder",
	// htmls/vscode.html:305; Page strong prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.4-edit-and-save": "4. Edit and save",
	// htmls/vscode.html:261; Page h1 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.adventure-land-for-vs-code": "Adventure Land for VS Code",
	// htmls/vscode.html:336; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.adventure-land-keeps-one-active-token-for-your": "Adventure Land keeps one active token for your account. Use Show token whenever you need to paste it into VS Code.",
	// htmls/vscode.html:326; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.vscode.checking-token": '<strong id="vscode-token-status">Checking token</strong><span id="vscode-token-detail"></span>',
	// htmls/vscode.html:341; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.commands-in-vs-code": "Commands in VS Code",
	// htmls/vscode.html:328; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.vscode.create-and-show-token-copy-token-show-token":
		'<button id="vscode-create-token" class="primary" type="button" disabled>Create and show token</button>\n\t\t\t\t\t\t\t\t<button id="vscode-copy-token" type="button" style="display: none">Copy token</button>\n\t\t\t\t\t\t\t\t<button id="vscode-show-token" type="button" style="display: none">Show token</button>\n\t\t\t\t\t\t\t\t<button id="vscode-revoke-token" class="warning" type="button" disabled>Revoke token</button>',
	// htmls/vscode.html:278; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Named parameters (preserve each token exactly): {"version":"extension.version"}.
	"pages.vscode.download-vsix": "Download VSIX {version}",
	// htmls/vscode.html:350; Page h3 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.file-names": "File names",
	// htmls/vscode.html:264; Page nav prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.vscode.game-mainframe-api": '<a href="/">Game</a><a href="/mainframe">Mainframe</a><a href="/docs/guide/advanced/adventure-api">API</a>',
	// htmls/vscode.html:284; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.install-from-the-marketplace-then-return-here-to": "Install from the Marketplace, then return here to create your token.",
	// htmls/vscode.html:270; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.install-the-extension": "Install the extension",
	// htmls/vscode.html:288; Page alt attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.label-adventure-land-code-slots": "Adventure Land CODE slots",
	// htmls/vscode.html:264; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.label-main-navigation": "Main navigation",
	// htmls/vscode.html:10; Page content attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.label-use-the-adventure-land-vs-code-extension-to":
		"Use the Adventure Land VS Code extension to sync CODE slots through the Adventure Land API, including full download and upload on save.",
	// htmls/vscode.html:291; Page aria-label attribute. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.label-vs-code-setup-steps": "VS Code setup steps",
	// htmls/vscode.html:351; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["name.slot.js","farm.1.js","merchant.12.js","pvp.Warrior.js",".js","libraries"].
	"pages.vscode.managed-code-files-use-name-slot-js-examples":
		'Managed CODE files use <span class="shell">name.slot.js</span>. Examples: <span class="shell">farm.1.js</span>, <span class="shell">merchant.12.js</span>, <span class="shell">pvp.Warrior.js</span>. The slot before <span class="shell">.js</span> decides where the file uploads. Files in <span class="shell">libraries</span> are read-only helpers from the game.',
	// htmls/vscode.html:282; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["Extensions: Install from VSIX..."].
	"pages.vscode.manual-install-download-the-vsix-open-command-palette":
		'Manual install: download the VSIX, open Command Palette with Ctrl+Shift+P or Cmd+Shift+P, run <span class="shell">Extensions: Install from VSIX...</span>, then choose the downloaded file. Use this in Cursor too.',
	// htmls/vscode.html:275; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.marketplace-page": "Marketplace page",
	// htmls/vscode.html:313; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.on-activation-it-downloads-every-code-slot-after":
		"On activation it downloads every CODE slot. After that it checks for remote changes, uploads offline edits when safe, and uploads managed files when you save them.",
	// htmls/vscode.html:325; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.one-token-is-active-per-account-creating-a": "One token is active per account. Creating a new one rotates the old token immediately.",
	// htmls/vscode.html:298; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["Adventure Land: Set API Token"].
	"pages.vscode.open-command-palette-and-run-adventure-land-set":
		'Open Command Palette and run <span class="shell">Adventure Land: Set API Token</span>. Paste the token there. This works in Cursor too.',
	// htmls/vscode.html:345; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.open-folder": "Open folder",
	// htmls/vscode.html:274; Page a prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.open-in-vs-code": "Open in VS Code",
	// htmls/vscode.html:344; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.pull-push-now": "Pull/push now",
	// htmls/vscode.html:302; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["Adventure Land: Activate Auto Sync Folder"].
	"pages.vscode.run-adventure-land-activate-auto-sync-folder-choose": 'Run <span class="shell">Adventure Land: Activate Auto Sync Folder</span>. Choose any local folder you want VS Code to manage.',
	// htmls/vscode.html:311; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.same-idea-as-codes": "Same idea as /codes",
	// htmls/vscode.html:314; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.saving-from-vs-code-does-not-spend-shells": "Saving from VS Code does not spend Shells and does not start Mainframe by itself.",
	// htmls/vscode.html:342; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.set-token": "Set token",
	// htmls/vscode.html:323; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"pages.vscode.sign-in": '<a class="button primary" href="/">Sign in</a>',
	// htmls/vscode.html:294; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["mcp_"].
	"pages.vscode.sign-in-here-create-a-token-below-and": 'Sign in here, create a token below, and copy it while it is visible. The token starts with <span class="shell">mcp_</span>.',
	// htmls/vscode.html:322; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.sign-in-to-adventure-land-first-then-return": "Sign in to Adventure Land first. Then return here and create a token for VS Code.",
	// htmls/vscode.html:343; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.start-sync": "Start sync",
	// htmls/vscode.html:346; Page span prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.stop-sync": "Stop sync",
	// htmls/vscode.html:262; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.sync-every-code-slot-into-a-local-folder": "Sync every CODE slot into a local folder, edit in VS Code, and upload when you save.",
	// htmls/vscode.html:312; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["adventureland","codes","characters","libraries","clash","history"].
	"pages.vscode.the-extension-creates-an-adventureland-folder-with-codes":
		'The extension creates an <span class="shell">adventureland</span> folder with <span class="shell">codes</span>, <span class="shell">characters</span>, <span class="shell">libraries</span>, and <span class="shell">clash</span> inside it. It also keeps <span class="shell">history</span> beside that folder.',
	// htmls/vscode.html:306; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.the-extension-downloads-every-code-slot-saving-a": "The extension downloads every CODE slot. Saving a managed file uploads it back to Adventure Land.",
	// htmls/vscode.html:286; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.the-marketplace-page-is-not-live-yet-the": "The Marketplace page is not live yet. The direct VSIX download will appear here when the package is available on this server.",
	// htmls/vscode.html:271; Page p prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. Locked inline code/commands: ["{id}"]. Named parameters (preserve each token exactly): {"id":"extension.id"}.
	"pages.vscode.use-in-vs-code-or-cursor-it-replaces":
		'Use <span class="shell">{id}</span> in VS Code or Cursor. It replaces the old client folder sync with API-based autosync, so it works from Steam, browser, and normal desktop editors.',
	// htmls/vscode.html:320; Page h2 prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"pages.vscode.your-token": "Your token",
	// Historical holiday email: complete postscript around its CODE-example link. Preserve the exact link, tags, styles and CODE label; translate the surrounding prose.
	"pages.contents.announcement_email.holiday_code_example":
		'Ps 3. Here\'s a <a style="color: #33BF6D" href="https://raw.githubusercontent.com/kaansoral/adventureland/master/examples/happy_holidays.js"><span style="color: #33BF6D">CODE</span></a> that automates the Xmas buff\n\t\t\t\t\tPs 4. There are some new things and new skills too!',
};
