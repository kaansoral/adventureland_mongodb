# Tauri Steam client

The Tauri client is intentionally narrow. It loads `https://adventure.land/` and creates a Steam Web API ticket so the server can link a Steam ID on first login. The permanent link is the Steam ID saved on the Adventure Land account and character; the client stores no authentication token or local file. Steam Shells purchases use Steam's authenticated overlay browser when available and otherwise open the system browser, while the game verifies and finalizes the result server-side for exactly-once delivery.

It does not expose local files, code-sync folders, screenshots, Keychain access, or arbitrary navigation to the remote game page. Electron remains the client for players who use local code-folder sync.

## Steam macOS build

1. Install dependencies with `npm install`.
2. Run `npm run build:mac`.
3. Sign and notarize the `.app` with `src-tauri/Entitlements.plist` before uploading the Steam depot.

The first account link must run through Steam. Later Tauri and Web logins use the Steam ID already linked to the Adventure Land account and do not depend on another Steam ticket.

Windows Steam depots must place `binaries/steam_api64.dll` beside the executable. Linux AppImages bundle `binaries/libsteam_api.so` in `usr/lib`, and macOS bundles `binaries/libsteam_api.dylib` inside the app. These are the matching x86_64 Steamworks redistributables.

For a no-charge production verification on an admin account, set `window.steam_payment_sandbox = true` in the Inspector before opening the Shells purchase. The server ignores this flag for non-admin accounts.

## HTTP scripts in CODE

The native client supports existing `$.getScript("http://host:port/any/path.js")` calls in CODE runners, including localhost, LAN and remote hosts. No code directory configuration or website update is required. Rust fetches HTTP scripts and the requesting runner evaluates successful responses through jQuery. HTTPS requests keep their existing browser transport; navigation still requires trusted HTTPS game URLs.

Only load scripts you trust: HTTP responses can be modified in transit. Requests do not include browser cookies or Steam credentials. Script URLs cannot contain credentials; redirects must remain HTTP/HTTPS (maximum 10), responses must be UTF-8 and at most 10 MiB, and requests time out after 30 seconds. Aborting a jqXHR suppresses execution and callbacks from late responses; the native fetch may continue until its timeout.

Run `npm test` in `tauri` and `cargo test --lib` in `tauri/src-tauri`. For native verification, serve a harmless script that increments a runner-global counter. Load it from `/runner` with `$.getScript`, verify callbacks and the counter, then repeat after CODE restart and in a secondary window. Test localhost, loopback and LAN URLs on Linux with system WebKitGTK and with `ADVENTURELAND_FORCE_BUNDLED=1`. Also smoke-test Windows. A build alone does not establish Linux runtime compatibility.
