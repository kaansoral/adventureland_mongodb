# Translation catalogs

English phrases live in `en/*.js`. Each entry has a stable semantic identifier and a comment explaining where it appears, what it means, its parameters, and any fixed names or CODE. Translations use the same identifiers in `<language>/<domain>.json`. The language registry and browser/desktop locale aliases live in `js/phrases.js`.

Every new or changed player-facing feature must update its English phrases and every supported language in the same change. This includes the website, login, game UI, messages, descriptions, dialogue, tutorials, guides, public CODE documentation and player-facing tools. Developer-facing proposals, experiments, prototypes, internal scripts and operational logs are outside this scope. When prototype content enters the live product, the translation requirements apply.

Rime Djinn: all 20 new tooltip, interface, guide and release phrases are translated and proofread in all 32 supported languages. Canonical text and placeholders were checked on 2026-09-14. The stronger Rime Shatter and Cove Mantle map bonus were translated and checked on 2026-09-15.

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
| Update notes | `updates` | Translated `text` with the initial 20 notes and each requested batch; original `note` and metadata remain intact |
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

Arabic uses the registered Arabic pixel-font subset, loaded when Arabic text is rendered. Do not replace it with a system-font override. Direction changes stay scoped to guide/tutorial articles; CODE blocks and native drop ratios remain left to right. Compact Arabic HUD counters isolate their numeric runs. The shared UI layout stays simple.

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
| Thai | th | Core complete |
| Spanish — Latin America | es-419 | Core complete |
| Ukrainian | uk | Core complete |
| Italian | it | Core complete |
| Czech | cs | Core complete |
| Hungarian | hu | Core complete |
| Portuguese — Portugal | pt-PT | Core complete |
| Vietnamese | vi | Core complete |
| Swedish | sv | Core complete |
| Dutch | nl | Core complete |
| Danish | da | Core complete |
| Indonesian | id | Core complete |
| Finnish | fi | Core complete |
| Norwegian | no | Core complete |
| Romanian | ro | Core complete |
| Greek | el | Core complete |
| Bulgarian | bg | Core complete |
| Malay | ms | Core complete |
| Arabic — Modern Standard Arabic | ar | Core complete |
| Filipino | fil | Core complete |

## Historical backlog

All 32 languages include the required current-game phrases. The remaining historical entries below deliberately use English fallback. Existing translations remain intact. These counts cover missing archive translations, not current gameplay text.

| Language | Old update notes | Development archive |
| --- | ---: | ---: |
| Thai | 701 | 200 |
| Spanish — Latin America | 0 | 0 |
| Ukrainian | 701 | 687 |
| Italian | 701 | 498 |
| Czech | 701 | 663 |
| Hungarian | 701 | 687 |
| Portuguese — Portugal | 0 | 527 |
| Vietnamese | 701 | 200 |
| Swedish | 660 | 0 |
| Dutch | 660 | 0 |
| Danish | 701 | 687 |
| Indonesian | 701 | 0 |
| Finnish | 701 | 687 |
| Norwegian | 701 | 0 |
| Romanian | 701 | 687 |
| Greek | 566 | 663 |
| Bulgarian | 701 | 498 |
| Malay | 701 | 687 |
| Arabic — Modern Standard Arabic | 566 | 498 |
| Filipino | 701 | 386 |

The earlier twelve languages have no missing archive translations. Historical translation can resume by language and section without changing the current-game completion status.
