# Tauri Steam client

The Tauri client is intentionally narrow. It loads `https://adventure.land/` and creates a Steam Web API ticket so the server can link a Steam ID on first login. The permanent link is the Steam ID saved on the Adventure Land account and character; the client stores no permanent authentication token. Steam Shells purchases use Steam's authenticated overlay browser when available and otherwise open the system browser, while the game verifies and finalizes the result server-side for exactly-once delivery.

It does not expose local files, code-sync folders, screenshots, HTTP mode, Keychain access, or arbitrary navigation to the remote game page. Electron remains the client for players who use local code-folder sync.

## Steam macOS build

Every Tauri build prepares the image bundle and desktop translations automatically. To prepare them for a direct Cargo build, run `node scripts/build_desktop_languages.js` and `node scripts/build_desktop_images.js` from the repository root first.

1. Install dependencies with `npm install`.
2. Run `npm run build:mac`.
3. Sign and notarize the `.app` with `src-tauri/Entitlements.plist` before uploading the Steam depot.

The first account link must run through Steam. Later Tauri and Web logins use the Steam ID already linked to the Adventure Land account and do not depend on another Steam ticket.

Windows Steam depots must place `binaries/steam_api64.dll` beside the executable. Linux AppImages bundle `binaries/libsteam_api.so` in `usr/lib`, and macOS bundles `binaries/libsteam_api.dylib` inside the app. These are the matching x86_64 Steamworks redistributables.

For a no-charge production verification on an admin account, set `window.steam_payment_sandbox = true` in the Inspector before opening the Shells purchase. The server ignores this flag for non-admin accounts.

## Game windows

`/window` opens character selection. Deploy opens the selected character on the current realm in a native secondary window. Both use the same window builder, four-secondary-window limit, and disabled native file-drop handler so HTML inventory drops keep working. Deploy accepts only Adventure Land HTTPS character-entry URLs.

Deploy needs both the updated game JavaScript and native build `b260909a` or later. Older running binaries show an update/restart message. A web deployment alone cannot update a running native client.

## Images

The build embeds PNGs referenced by `design/sprites.js` and `design/animations.js`. It does not crawl folders or include language catalogs in the image cache. Bump the image filename or `?v=` when its pixels change.

The game reads the bundle once per page through Tauri IPC. PIXI uses local image bytes only for an exact URL/version match, keeping its original texture keys. New versions use their normal HTTPS URLs. Missing native support, corrupt images, or a stalled read fall back to normal loading; no filesystem permission or extra Linux library is needed. Inventory and character portraits reuse decoded images too. The JavaScript console reports local and remote image counts.

## Language

`GetCurrentGameLanguage()` runs once on a worker when no desktop language is cached. Detection waits at most 750 ms in the background, then uses the WebView's system language. The UI remains usable. The choice is saved as `language.txt` in Tauri's app config directory. Later launches do not query Steam again. Account and picker choices replace this preference; late Steam results cannot replace them. The game never reloads an active character to apply an automatic language choice.

Real loading-screen translations for every registered language are embedded separately in the executable. Full game catalogs remain online. Browsers retain their normal preferred-language detection and account overrides.

Steam does not register language support by scanning binary resources. In Steamworks, publish the supported **Interface** languages in the store settings and configure **Base Languages** under SteamPipe → Depots. All languages can share each platform depot. The generated `resources/desktop-languages.json` lists Steam API identifiers; Filipino is store-supported but has no Steam API identifier. In-game preferences do not change the language selected in Steam's own Properties window.

References: [Steam localization](https://partner.steamgames.com/doc/store/localization), [Steam language identifiers](https://partner.steamgames.com/doc/store/localization/languages).
