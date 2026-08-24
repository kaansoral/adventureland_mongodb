# Tauri Steam client

The Tauri client is intentionally narrow. It loads `https://adventure.land/` and creates a Steam Web API ticket so the server can link a Steam ID on first login. The permanent link is the Steam ID saved on the Adventure Land account and character; the client stores no authentication token or local file. Steam Shells purchases use the native Steam overlay and send its authorization response to the server for finalization and exactly-once delivery.

It does not expose local files, code-sync folders, screenshots, HTTP mode, Keychain access, or arbitrary navigation to the remote game page. Electron remains the client for players who use local code-folder sync.

## Steam macOS build

1. Install dependencies with `npm install`.
2. Run `npm run build:mac`.
3. Sign and notarize the `.app` with `src-tauri/Entitlements.plist` before uploading the Steam depot.

The first account link must run through Steam. Later Tauri and Web logins use the Steam ID already linked to the Adventure Land account and do not depend on another Steam ticket.

Windows Steam depots must place `binaries/steam_api64.dll` beside the executable. Linux AppImages bundle `binaries/libsteam_api.so` in `usr/lib`, and macOS bundles `binaries/libsteam_api.dylib` inside the app. These are the matching x86_64 Steamworks redistributables.

For a no-charge production verification on an admin account, set `window.steam_payment_sandbox = true` in the Inspector before opening the Shells purchase. The server ignores this flag for non-admin accounts.
