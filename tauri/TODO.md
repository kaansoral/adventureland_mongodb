# Tauri Steam client

The Tauri client is intentionally narrow. It loads `https://adventure.land/` and creates a Steam Web API ticket so the server can link a Steam ID on first login. The permanent link is the Steam ID saved on the Adventure Land account and character; the client stores no authentication token or local file.

It does not expose local files, code-sync folders, screenshots, HTTP mode, Keychain access, or arbitrary navigation to the remote game page. Electron remains the client for players who use local code-folder sync.

## Steam macOS build

1. Install dependencies with `npm install`.
2. Run `npm run tauri -- build --target universal-apple-darwin --bundles app`.
3. Sign and notarize the `.app` before uploading the Steam depot.

The first account link must run through Steam. Later Tauri and Web logins use the Steam ID already linked to the Adventure Land account and do not depend on another Steam ticket.
