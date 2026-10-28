# Translation catalogs

English phrases live in `en/*.js`. Each entry has a stable semantic identifier and a comment explaining where it appears, what it means, its parameters, and any fixed names or CODE. Translations use the same identifiers in `<language>/<domain>.json`. The language registry and browser/desktop locale aliases live in `js/phrases.js`.

Every new or changed player-facing feature must update its English phrases and every supported language in the same change. This includes the website, login, game UI, messages, descriptions, dialogue, tutorials, guides, public CODE documentation and player-facing tools. Developer-facing proposals, experiments, prototypes, internal scripts and operational logs are outside this scope. When prototype content enters the live product, the translation requirements apply.

Steam sign-in: all 14 account-choice, default-on toggle and signup phrases are translated and proofread in all 32 supported languages. Toggle states, Steam/Adventure Land names, placeholders and markup were checked on 2026-09-22.

Rime Djinn: all 20 new tooltip, interface, guide and release phrases are translated and proofread in all 32 supported languages. Canonical text and placeholders were checked on 2026-09-14. The stronger Rime Shatter and Cove Mantle map bonus were translated and checked on 2026-09-15.

Cavalry guide: all 12 revised or added rule phrases are translated and proofread in all 32 languages. Account and character levels, targeting, rescue duration, nearby-player restrictions, respawns and cooldowns were checked against the current handlers on 2026-09-21.

CODE storage: the three save errors and two guide/reference paragraphs are translated and proofread in all 32 supported languages. Storage limits, request timing and CODE identifiers were checked on 2026-09-25.

Tavern dealer: Venn's 21 table lines (drafted in ChatGPT Chat, Medium) and the guide paragraph that introduces him are translated and proofread in all 32 supported languages. The {name} placeholder, Venn's name and each language's established pot, all in and river terms are kept.

Trade offers: all 46 new or revised stand, message, trade-history, CODE reference, guide, tutorial and release phrases are translated and proofread in all 32 supported languages. The guide reuses each language's own OFFER FOR TRADE, WANTS, TITLE, ANY and TRADE labels; placeholders, markup and locked CODE were checked on 2026-09-26.

Stand removal (2026-09-29): the revised unequip description and four shared instructions are translated and proofread in all 32 languages. CODE identifiers and empty-slot requirements were checked. The shared example renders in the merchant lesson, guides and references without a character and is available through MCP. It passes regular CODE and Mainframe tests against the server's unequip handler.

Cave feedback: the shortened Cave title, its +5 magic resistance, map and target guidance, orb compounding instructions and release notes are translated and proofread in all 32 languages. All 10 changed phrases, title delivery, guide parameters and CODE identifiers were checked on 2026-09-29. Existing dialogue and comic translations are preserved.

October 5 bug fixes: 15 phrases covering Super Computer cavalry access, movement buttons, documentation links, numeric character names, Alchemy gold output, stunned item use, scroll consumption and merchant price validation are translated and proofread in all 32 languages. Fixed names, CODE identifiers, placeholders and the existing release entries are preserved.

Steam friend connections: 40 menu, confirmation, reward mail, guide and release phrases are translated in all 32 languages. The Friend Token and SHELLS amounts, permanent choice, first Steam link rule, two-week support window, placeholders and fixed names were checked on 2026-10-05.

Stunned item use (October 5): the revised condition tooltip, replacement fix note and shared Items/CODE paragraph are translated and proofread in all 32 languages. The existing disabled response, passive recovery and ordinary equipment swaps remain unchanged.

Super Computer menus (October 5): the revised release note is translated and proofread in all 32 languages. Both Network entry paths reuse existing translated controls; the selected item, Tracker and Cavalry actions were checked in every language.

Seasonal flags (October 7): the CODE reference paragraph and release note are translated and proofread in all 32 languages. Boolean values, CODE identifiers and HTML tags are preserved. The documented status example runs in Mainframe.

UPDATE button image (October 7): the fix note is translated and proofread in all 32 languages, using each language's existing button label.

Witching Season (October 18): all 206 new phrases for the Witch's Cipher, Graveyard Rising, Trick or Treat, the Headless Horseman, the Events window, the new items, conditions and emote, their guides and CODE references, and the release post are translated in all 32 languages and proofread. Each language keeps its catalog's own word for the realm and its usual form of address; realm time never uses a term that reads as UTC. Placeholders, plural forms, countdown sentences, fixed names and CODE identifiers were checked on 2026-10-18. Later that day the release post's Events window section was rewritten for the slider above chat (X,Y, live and upcoming events, season ends); its new ending is translated in all 31 languages, keeping each catalog's EVENTS label and realm word. The Graveyard and Horseman fight sections, the five resistance names shown by the new monster achievements, and the Witch's Cipher reset (a cracked recipe is forgotten, a new one starts, up to 12 Parcels a day) were then translated in all 31 languages; `{player}`, Parcel counts and `brew()` were checked, and the Trick or Treat costume list now names Green Pumpkin Head in every language. Seven guide texts were then corrected to match the game (brewing is open for the Witch's whole 28 minutes; the Headless Horseman and the Gargoyle leave after their time only once nobody has attacked them for 20 seconds; the graveyard's Mummies; one-step CODE examples) and the Events window's season line now shows the exact end in the chosen time; all are translated and proofread in all 31 languages, with placeholders, countdowns and CODE identifiers checked. The Witch's Cipher then moved to two rounds a day (06:00 and 18:00 on the realm clock, one join and one daily limit for both, up to 60 ingredients a day) and the Graveyard guide now explains the Gargoyle's Parcels: the nine changed texts and the new 60-ingredient message are translated and proofread in all 31 languages, with times, UTC, numbers, `<b>` tags and CODE identifiers checked.

Witching Season rebalance (October 20): the Witch's Cipher without joining (ingredients drop as loot, five-ingredient mixes with one clue, a Parcel for each new mix that fits every clue plus a daily crack bonus, two rounds during Halloween and a place among the daily events afterwards), the Ghost trick, the Horseman's drops and the numbers of item map and class bonuses: 31 changed or new phrases are translated and proofread in all 31 languages, and 14 retired phrases were removed from every catalog. Each language keeps its realm word and form of address; plural forms, placeholders, fixed names, CODE identifiers and the quoted values "spooked" and "ghost" were checked on 2026-10-20. The release note for the new 80% cap on Mana Cost Reduction is translated in all 31 languages with each catalog's own stat name.

## Runtime

The server reads and caches the requested language with English fallback. The browser receives only phrases needed by client JavaScript through `/phrases/<language>.js?v=<version>`.

## What gets sent

[`browser_domains` in index.js](index.js) controls browser delivery. New domains stay on the server unless explicitly included. `true` includes a domain; a list includes only the named phrase IDs or prefixes, including their plural forms.

| Text | Domain | Delivery |
| --- | --- | --- |
| Dynamic UI, tooltips and game messages | `client`, `code`, `definitions`, `editor`, `errors`, `game`, `interface`, `language`, `mainframe`, `page_actions`, `services` | The browser catalog |
| Socket message text | Selected prefixes in `server` | The browser catalog; CODE keeps the original English packet |
| Docs, guides and tutorials | `docs` | Translated HTML when the article is requested |
| Website and account page text | `pages` | Translated HTML from the page template |
| HTTP response text and email | Other phrases in `server` | Translated on the server |
| Update notes | `updates` | Translated `text`, `title_text` and `caption_text` beside each English field of the initial 20 notes and each requested batch; the English fields and metadata remain intact. `UPDATE_NOTES.md` explains the phrase IDs and the `translations`/`apply` worksheets |
| Offline desktop loading text | `desktop` | The small generated Tauri catalogs |

Two shared docs labels, `docs.guide.basics.move` and `docs.reference.source_code`, also serve client renderers and are explicitly included. Article prose stays out of the browser catalog. New shared UI labels belong in a browser domain.

Browser dictionaries and their plain/gzip JavaScript responses are cached per language in each server process. Responses use `Vary: Accept-Encoding` and 30-day public caching; the version query changes with a release. Local nginx can override browser caching. Server-rendered pages and note batches use the request's language and remain private and uncached.

When adding content, decide where it is translated first. Use server templates for article/page prose and send translated text with content fetched on demand. Add a phrase to the browser catalog only when browser code needs to look it up. Do not preload an article or archive to support one button.

After changing delivery, run:

```sh
node --test node/test/language_account.test.js node/test/language_delivery.test.js
```

These checks cover browser references, server-rendered articles, note pagination, language fallback and compression. They also report the English download size and enforce a startup size limit. Check dynamically constructed phrase IDs when changing a domain or prefix.

## Using phrases

```js
phrase("language.choose");
phrase("language.select", { language: "Türkçe" });
phrase.html("language.select", { language: user_supplied_name });
```

Use `phrase` for plain text and `phrase.html` when inserting text into HTML. The HTML helper escapes parameter values. A catalog may contain fixed HTML from an existing renderer; translations must preserve its tags, attributes, handlers, URLs, and inline CODE.

Placeholders are named, such as `{name}` or `{count}`. Their position may change with grammar. Optional `.one`, `.few`, `.many`, `.other`, and other plural-category keys follow `Intl.PluralRules` when a numeric `count` is supplied. Other parameters, including preformatted quantities, do not select plural forms; write their surrounding text so it works for every value.

Definition display uses `phrase.definition(section, id, field, original)`. It leaves the canonical game definitions intact. Proper item, NPC, monster, map and character names remain unchanged, as do Adventure Land and public CODE identifiers. Human skill, condition, class, stat and ability labels translate, and prose references must match their chosen display names. A named item and a skill with the same English words can therefore need different treatment.

Server-authored messages use `localization.message(id, parameters, fields)`. Packets retain their original English `message` and add `phrase` and `phrase_args`. UI renderers use `phrase.message(packet)`; CODE receives the original event and its original fields. Do not translate player chat, saved CODE, or arbitrary logs at a generic output function.

The language picker saves `User.language` and `User.language_set`, then reloads. A pending explicit browser choice is adopted at login; automatic browser detection does not replace an established account preference.

## Adding text

Reuse an existing phrase when both meaning and use match. Otherwise add a descriptive identifier to the appropriate English domain and call it through the existing renderer or template helper. Translate a complete sentence with named parameters rather than joining translated fragments. Keep IDs stable when wording changes.

The English comment should explain the actual action or state, where the text appears, parameter meanings, compact-control constraints, and any quoted control or proper name. Distinguish visible prose from executable examples: braces or a comment-like prefix alone do not make prose a CODE identifier. For gameplay quantities, check the actual handler and loaded definitions before describing an effect.

Keep canonical definition descriptions and their English phrase values aligned. Preserve server event names, argument shapes, raw user text, callback order and terminal Promise results. Use the established message metadata or response path appropriate to that event.

## Fonts

Arabic uses the registered Arabic pixel-font subset, loaded when Arabic text is rendered. Do not replace it with a system-font override. Direction changes stay scoped to guide/tutorial articles and the text of update posts; CODE blocks, native drop ratios, sprite rows and changed values remain left to right. Compact Arabic HUD counters isolate their numeric runs. The shared UI layout stays simple.

Existing lettering drawn into cosmetic emote artwork (JOY!, TA-DA!, BLOOM! and DISCO!) remains shared artwork. The emote controls and descriptions translate. Localized bitmap lettering is deferred; it needs suitable native glyphs and visual review rather than substitution into the current limited glyph table.

## Deferred historical text

All current game text remains required in every language: UI, messages, dialogue, descriptions, guides, tutorials, CODE documentation, account flows and current release notes. The development blog's historical prose and update notes dated before 2026 may remain in English until more translation resources are available. Archive page titles and controls still translate. The exact boundary is defined in `scope.js`.

Keep existing translations and their phrase IDs. Missing historical entries use the normal English fallback; do not fill them with copied English to claim translation coverage. Completion reports distinguish required translations from deferred archive entries and preserve saved drafts and review progress for later work.

After changing the phrase runtime, a language's desktop text, or adding a locale, run:

```sh
node scripts/build_desktop_languages.js
```

This prepares the small offline Tauri catalogs. The game itself still loads only its active language.

Tauri reads the selected Steam game language once off the UI thread, with a 750 ms deadline and system-language fallback. It caches the result across launches. Account and picker choices update the native preference too; they never trigger another Steam lookup. Only a signed-out page can reload once to apply initial detection. See [desktop behavior and Steam settings](../tauri/TODO.md#language).

## Catalog status

October 21: mail attachment limits, atomic delivery, attachment ownership, bounded Purify stack damage, exchange completion, numeric-only name restrictions and co-op boss drop notes are translated in all 32 languages. Obsolete monster-ID and exchange-timeout wording was removed.

October 20 support sweep: 13 new or revised phrases covering numeric monster IDs, simultaneous logins, town arrival, Strength, safe destruction, bank privacy, drop fractions and unavailable trade slots are translated and proofread in all 32 languages. CODE identifiers, probabilities and existing markup are preserved.

October 20 inventory and movement fixes: five release notes and four CODE reference paragraphs are translated and proofread in all 32 languages. Unsupported upgrade levels, route recalculation, empty inventory slots, message limits and equipment batch errors were checked. CODE identifiers, Promise and .catch() are preserved.

October 20 reward and CODE fixes: ten release notes and two CODE reference paragraphs are translated and proofread in all 32 languages. Glitch quantities, protected items, Cave completion, glow changes, roaming NPC positions, and the original exchange wording were checked. October 21 replaces the timeout wording with server completion replies.

October 19 support fixes: 14 retained release notes, the changed-item sale error and two CODE reference paragraphs are translated and proofread in all 32 languages. Natural poison, mail ownership, numeric character names, MAINFRAME's two-request limit and the unchanged CODE identifiers were checked. The reverted dead-character potion restriction was removed from all 32 release catalogs on October 20.

MAINFRAME pathfinding (October 16): the Spooky Town fix note is translated and proofread in all 32 languages. MAINFRAME, Spooky Town and smart_move() are preserved.

Anniversary event shutdown (October 6): ten UI, guide and release phrases are translated and proofread in all 32 languages. Cole's fallback, Computer access, NPC names, placeholders and CODE markup were checked.

October 5 inventory and CODE fixes: 16 new phrases are translated and proofread in all 32 languages. This covers grace-only offerings, missing entrance keys, both monster spawn-boundary formats and ten release entries. Item names, CODE fields, amounts and placeholders are preserved.

Account bans: the release note is translated and proofread in all 32 supported languages. The new password-login and game-authentication checks honor active bans and expired timed bans. The owner-supplied moderation reason remains verbatim account data.

Self-inflicted splash damage: the Items guide paragraph, release title and fix note are translated and proofread in all 32 languages. Self-damage, monster XP loss, PvP credit and loot ownership were checked on 2026-10-05.

Cave wall recovery: the return-position guide paragraph, release title and fix note are translated and proofread in all 32 languages. Same-floor recovery, preserved health and progress, and fallen characters staying fallen were checked on 2026-10-04.

Banking fixes: the overflow recovery and floor-key guide paragraphs, release title and two fix notes are translated and proofread in all 32 languages. Item retention, unchanged capacity, immediate pack access and the bank_store() identifier were checked on 2026-10-04.

Merchant realm changes: the guide clarification, release title and fix note are translated and proofread in all 32 languages. Merchant roles, other characters' bonuses and unchanged eligibility rules were checked on 2026-10-04.

Mail and server menu fixes: the mail collection and deletion rules, delete confirmation, release title and two fix notes are translated and proofread in all 32 languages. Receiving-account ownership, self-mail, per-account deletion and the server menu's visibility were checked on 2026-10-04.

Halloween and Cave fixes: the release title and three event and bug-fix notes are translated and proofread in all 32 languages. Completed encounters, loot errors, Amber counters and fixed names were checked on 2026-10-04.

Flaming eyes: the animation repair's release title and note are translated and proofread in all 32 languages. The note covers animation while standing still; no cosmetic names or unlock rules change.

Character slots: the slot notice and shell-charge release note are translated and proofread in all 32 languages. Slot entitlements, existing prices and negative-balance wording were checked on 2026-10-02.

Monster combat range: the geometry paragraph and release note are translated and proofread in all 32 languages. The default bounds, optional size multiplier, rounding and CODE identifiers were checked on 2026-10-02.

Encouragement loot events: the two CODE documentation paragraphs and release note are translated and proofread in all 32 languages. Reward ownership, reserved-chest timing, markup and CODE identifiers were checked on 2026-09-30.

Public chat filtering: the release note and `say()` documentation are translated and proofread in all 32 languages. Discord forwarding, saved history, the server scope and recovery after 10 minutes without public messages were checked on 2026-09-29.

| Language | Code | Status |
| --- | --- | --- |
| English | en | Complete |
| Turkish | tr | Complete |
| Russian | ru | Complete |
| Spanish — Spain | es | Complete |
| Portuguese — Brazil | pt-BR | Complete |
| German | de | Complete |
| Japanese | ja | Complete |
| French | fr | Complete |
| Polish | pl | Complete |
| Korean | ko | Complete |
| Simplified Chinese | zh-Hans | Complete |
| Traditional Chinese | zh-Hant | Complete |
| Thai | th | Complete |
| Spanish — Latin America | es-419 | Complete |
| Ukrainian | uk | Complete |
| Italian | it | Complete |
| Czech | cs | Complete |
| Hungarian | hu | Complete |
| Portuguese — Portugal | pt-PT | Complete |
| Vietnamese | vi | Complete |
| Swedish | sv | Complete |
| Dutch | nl | Complete |
| Danish | da | Complete |
| Indonesian | id | Complete |
| Finnish | fi | Complete |
| Norwegian | no | Complete |
| Romanian | ro | Complete |
| Greek | el | Complete |
| Bulgarian | bg | Complete |
| Malay | ms | Complete |
| Arabic — Modern Standard Arabic | ar | Complete |
| Filipino | fil | Complete |

## Historical backlog

All 32 languages include the required current-game phrases, and the two deferred historical sections are now translated in every one of them. Nothing in this scope falls back to English any more.

Every supported language now has 0 missing entries in both deferred sections, so the table below is retained only as a record of what the backlog contained.

| Section | Entries | Languages still missing them |
| --- | ---: | --- |
| Old update notes | 701 | none |
| Development archive | 687 | none |

The deferred scope in `scope.js` stays in place: it defines which historical prose may fall back to English if new entries are ever added there.

October 6 PR fixes: six release notes and the shared bank-result paragraph are translated and proofread in all 32 languages. Deposit and withdrawal fields, the 25% healing value, stun terminology and fixed cape names were checked. Both bank examples pass native CODE and Mainframe checks.

Button casing (October 6): the grace action uses uppercase in every language with letter case, including ADD GRACE and Turkish LÜTUF EKLE. Existing translations and uncased scripts are preserved. The Cavalry action is CALL IN CAVALRY! in English; other translations retain their meaning.
