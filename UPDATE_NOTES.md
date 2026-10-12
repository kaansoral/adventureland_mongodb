# Update Notes

`update_notes.js` holds every update, newest first. An update is a **release post**: a title, a few highlights with pictures, and a list of every new, changed and removed thing in the game. The list is generated from the game definitions, so nothing is forgotten. Players see the post in the game, on the landing page and at `/allnotes`, in their own language.

Older entries (before 05/09/26) are plain one-line notes. They still show, but new updates are always releases.

## The short version

```sh
node scripts/update_notes.js sync        # add every changed definition to the pending release, write the English phrases
# write the title, highlights and notes in update_notes.js, then:
node scripts/update_notes.js sync        # again, for the text you wrote
node scripts/update_notes.js translations --out /tmp/notes    # one worksheet per language, only what is missing
node scripts/update_notes.js apply /tmp/notes                 # after filling the worksheets
node scripts/update_notes.js check       # the deploy runs this and stops if it fails
```

`sync` compares production (`https://adventure.land/data.js`) with your local definitions. Run it whenever you add or change something players can see. Run it again after you edit any text in a release. It never touches text you wrote.

## A release

A release, with parts of real ones:

```js
{
	phrase: "update.16_09_26.cave",       // update.DD_MM_YY.name, the base of every phrase ID in the release
	deployed: null,                       // the deploy writes the date; never set it by hand
	date: "[16/09/26]",                   // the day work on the release started
	priority: 2,                          // 0 minor, 1 normal (leave it out), 2 big
	title: "Cave of Many Dreams, Tavern Games and Rime Djinn",
	note: "One or two sentences.",        // optional summary, shown under the title and in the game log
	cover: "item:cave_amber",             // the picture on the UPDATE button, the landing card and the archive row
	highlights: [
		{
			key: "cave",                  // or phrase: "update.14_09_26.cave" to reuse an existing phrase
			title: "Cave of Many Dreams",
			note: "A new dungeon for your party of up to 3. ...",
			image: { src: "/images/comics/cave/1.png?v=4", width: 480, height: 270, localized: true },
		},
		{
			key: "rime_djinn",
			title: "Rime Djinn",
			note: "Rime Djinn now appear in Frozen Cove. ...",
			show: ["monster:rimedjinn", "item:djinncrown", "item:covemantle", "item:stillwaterlens"],   // drawn with the game's renderers, clickable
		},
		{
			key: "rare_monsters",
			title: "New Rare Monsters",
			show: [{ spawn: "monster:mimic", among: "monster:kobold", count: 12000 }],   // a Mimic appears after about 12000 Kobold kills
		},
	],
	changes: [
		{ new: "monster:kobold", note: "Two pairs roam Underground Cliffs." },
		{ new: "monster:mimic", among: "monster:kobold", count: 12000 },
		{ changed: "item:gloampendant", fields: { dex: [7, 6], int: [7, 6] }, note: "Gloam Pendant gives less Dexterity and Intelligence." },
		{ changed: "drop:monsters.ghost", rows: [[], [[0.05, "drapes"]]] },
		{ fixed: "blink_stretch", note: "Mage Blink no longer stretches the character." },
		{ improved: "server_frames", note: "Servers stay fast with many players." },
	],
	// steam: "https://...",                        a Read on Steam button
	// quiet: { "item:id": "why it waits" },        changed, but not listed yet
}
```

| Field | What it is |
| --- | --- |
| `phrase` | `update.DD_MM_YY.name`. `sync` starts a new release as `update.DD_MM_YY.release`; give it a real name when you write the title. Renaming later is fine: the next `sync` moves the English and the translations to the new IDs and removes the old ones. |
| `deployed` | `null` until the deploy stamps it. |
| `date` | `[DD/MM/YY]`. |
| `priority` | Which release the UPDATE button shows. See [Priority](#priority). |
| `title` | Short, names the main things. A release without a title is listed but never raises the UPDATE button. |
| `note` | Optional summary. Skip it when the highlights say it all. |
| `cover` | Any reference (below). A monster, NPC or item reads best. |
| `highlights` | The story of the release: usually 1 to 4 sections. Each needs `key` (or `phrase`), and any of `title`, `note`, `show`, `image`. |
| `changes` | The change list. `sync` writes most of it. |
| `quiet` | Definitions that changed but must not be listed yet, with the reason. `check` accepts them. |
| `steam` | Link to the matching Steam news post. |

### Change entries

- `new`, `changed`, `removed`: a reference such as `"item:ring"`. Written by `sync`.
  - `fields`: `{ path: [before, after] }`, written and refreshed by `sync`. Wording and looks (`explanation`, `cx`, `says` and the like) are left out on purpose.
  - `rows`: for drop tables, `[[rows lost], [rows gained]]`, written by `sync`.
  - `among`, `count`: for a rare monster, the monster whose kills bring it and about how many kills that takes.
  - `note`: optional, your words under the row.
- `fixed`, `improved`: a short key and a `note`. Written by hand, for anything the definitions do not show: bugs, speed, UI, server behavior.
- `phrase`: optional, to reuse an existing phrase ID instead of the derived one.

### References

`type:id`, checked against the loaded definitions:

`item`, `monster`, `map`, `npc`, `event`, `skill`, `condition`, `set`, `craft`, `dismantle`, `title`, `token`, `class`, `achievement`, `game`, `cx` (cosmetics), `table` (`levels`, `upgrades`, `compounds`, `multipliers`), `drop` (`monsters.<id>`, `maps.<id>` or a table name), `guide` (an INFO guide), `article` (a guide article), `doc` (`tutorial`, `merchant_tutorial`, `tasks`, `rewards`), `code` (a CODE function).

Each one renders with the game's own renderer: sprites and item slots, the item, monster and skill windows on click, the drop renderer, recipes at the NPC that makes them, guides that open in place.

## What `sync` lists and what it folds

It lists every added, removed or changed key in the definitions that players or CODE can see. It folds what a new entry already tells:

- the recipe, shop or token of a new item
- map spawns of a new monster, drop rows of a new item or monster
- the INFO quirk of a new guide and the guide article it opens
- drop rows that give a new cosmetic or open a new drop table

It skips render-only data (images, geometry, sprites, dimensions, animations, projectiles) and changes that are only wording or looks. It cannot see server code, the UI or performance: write those as `fixed` or `improved` yourself.

`node scripts/update_notes.js draft` prints the same list without writing anything. `--from` and `--to` take `prod`, `worktree`, a git revision or a saved `data.js` file.

## Priority

The UPDATE button shows one release: the one with the **highest priority** among the releases since the one the player last opened. On a tie, the newest wins.

- `priority: 0`: only fixes and small tweaks. Listed in the notes, never raises the button.
- leave it out (1): a normal update.
- `priority: 2`: a big one: a new zone, dungeon, class, event, system or language support.

A player who comes back after three updates sees the big one, not the latest small one. Opening that post once marks everything up to the newest as seen. A first visit only looks at the newest release.

## Writing

Write like a short announcement, not a report. Plain statements a player understands on the first read.

Good:

- New NPC: Mr. Dworf!
- Party XP share softened.
- Getting 100 monster kills unlocks monster drop rates.
- Rime Djinn now appear in Frozen Cove. When one starts forming its ice shell, break it together before it hits your party.

Not like this:

- Introduced a comprehensive rework of party experience distribution for a more balanced progression experience.
- Enhanced the Rime Djinn encounter with a dynamic shielding mechanic that rewards coordinated play.

Rules:

- Say what changed for the player and what to do. One idea per sentence.
- Use the names players see. No internal IDs in text, no design words (BiS, endgame, sidegrade, stat budget, proc).
- Give the numbers that matter: level 60, 1 in 900, 30 minutes, 3 players.
- No hype and no filler words like exciting, seamless, robust, comprehensive or enhanced.
- Do not repeat the change list. It already shows the item, its stats and where it drops. Say why a player cares or how to get it.
- Titles name the main things: "Cavalry, New Heads and Steam Sign-in".
- CODE function names keep their `()`: `get_progression()`.

Every player-visible definition is listed automatically, so highlights can stay few. Leave out refactors, tests, documentation upkeep and internal work.

## Translations

Every text in a release has a phrase ID:

| Text | ID |
| --- | --- |
| summary | `phrase` |
| title | `phrase.title` |
| highlight | `phrase.key` (or the highlight's own `phrase`), plus `.title` and `.caption` |
| change note | `phrase.` + the reference or key with non-letters as `_`, for example `update.16_09_26.cave.item_cave_amber`, or the entry's own `phrase` |

`sync` writes the English into `languages/en/updates.js` with a comment that says where the text shows. When you change English text, `sync` removes its old translations so they come up as missing. `translations --out <dir>` writes one worksheet per language (`<dir>/<code>.json`) with only the missing phrases, the English and that comment. Replace each object with the translated text and run `apply <dir>`. Translate related text together, one language at a time for bigger batches, and follow `languages/README.md` for terms: item, monster, map and NPC names stay in English.

The server sends each note with `text`, `title_text` and `caption_text` beside the English fields. A missing translation falls back to English. The interface words of the post (UPDATE, NEW, All Changes, group names) are the `client.update_notes.*` phrases in `languages/en/client.js`; `apply <dir> --domain client` writes those.

## Where players see it

- **UPDATE button**: the first button in the server strip, next to INFO and EVENT, with the release's cover. Opening the post once removes it. Seen state is stored per device as `update_seen`.
- **Landing page**: the same release as a card among the live events, before entering the game.
- **Game log**: the newest release's title (click to open) and summary.
- **Update Notes window**: releases as rows with cover, title and counts; old notes as text.
- **/allnotes**: the web archive, rendered on the server in the player's language.

Nothing is drawn without HTML (CODE characters, `no_html`). In Arabic, post text reads right to left like guide articles; sprite rows, IDs and changed values stay left to right.

## The deploy gate

`scripts/deploy.js` runs `node scripts/update_notes.js check` before it dates anything (not for staging). The check fails when:

- a changed definition is missing from the pending release, or its generated values are out of date (run `sync`)
- a reference does not resolve, a key is unknown or a date has the wrong format
- an English phrase is missing or different from the release, a phrase belongs to no note, or a language is missing a translation

When the check fails, the deploy prints its problems and stops before anything is packaged or uploaded, and the deploy aliases restart nothing. After the check and the image and map precomputes, `scripts/lock_update_notes.js` writes the deploy date into every `deployed: null` and stops the deploy if any is left. `check --offline` skips the production comparison.

## Files

| File | Role |
| --- | --- |
| `update_notes.js` | the notes and releases |
| `scripts/update_notes.js` | `sync`, `check`, `draft`, `translations`, `apply` |
| `scripts/lock_update_notes.js` | the deploy's date stamp |
| `js/functions.js` | the post, the UPDATE button and the archive (`release_*`) |
| `js/html.js` | the landing card and the server strip |
| `css/index.css` | `.release-*` styles |
| `languages/en/updates.js`, `languages/<code>/updates.json` | release text |
| `main.js`, `htmls/allnotes.html` | `/allnotes` |
| `node/test/update_notes.test.js` | the check, the stamp, the generator and the UPDATE button |

## History

On 26/09/26 the releases from 05/09/26 to 24/09/26 were rebuilt from git checkpoints and a saved copy of production's `data.js`. Their dates follow the deploys, not the commits. The one-line notes of those weeks became their highlights and change notes, and older notes were rewritten in plain words. The backfill is not complete: August content and items nobody can get yet are left out.

## Ideas for later

These came up while writing the backfill and are not built yet:

- **Grouped entries**: one change row for a set of items ("15 accessories") instead of 15 rows.
- **CODE blocks** in highlights: a short example drawn in the CODE style.
- **Guide buttons** in highlights: open the INFO guide from the post.
- **Field labels**: show short technical fields (`e`, `a`) as the game's stat names.
- **Map crops**: a small native render of a new area in a highlight.
