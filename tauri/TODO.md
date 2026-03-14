# Tauri Port — TODOs & Notes

## 🔴 Blockers (must fix before shipping)

### 1. Encrypted App Ticket (Steam login will fail)
The server validates **encrypted app tickets** — short session tickets will be rejected.

`steamworks-rs v0.11` doesn't expose `ISteamUser::RequestEncryptedAppTicket` as a safe wrapper,
but it's in the underlying C++ SDK. Fix options:

- **Option A (recommended):** Call it via raw FFI through the `steamworks-sys` crate (low-level bindings).
  Look for `ISteamUser_RequestEncryptedAppTicket` and `ISteamUser_GetEncryptedAppTicket`.
- **Option B:** Register a generic callback for `EncryptedAppTicketResponse_t` using
  `steamworks-rs`'s `register_callback` mechanism.

The user data string passed in Electron was `'adventurelandticketv0'` — keep this the same.
The server decrypts the ticket using its private key (recently rotated — see commit `1354b40`).

Current code in `lib.rs:init_steam()` uses `authentication_session_ticket()` as a placeholder.

---

### 2. Steam SDK must be present at build time
Download from Valve's partner portal:
https://partner.steamgames.com/downloads/steamworks_sdk.zip

Set env var before building:
```
export STEAM_SDK_LOCATION=/path/to/steamworks_sdk
cargo tauri build
```

---

## 🟡 Important differences from Electron

### nodeIntegration — what it was and why it's gone
In the Electron app, `nodeIntegration: true` was set on every BrowserWindow. This meant the
game's JavaScript (running in the browser window) had **direct access to Node.js APIs** —
`require('fs')`, `require('electron')`, `require('path')`, etc. — as if it were a Node script.
That's how `electron_code_sync_logic()` can call `fs.readFileSync(...)` directly in the page.

Tauri has no Node.js runtime at all. The renderer (game page) is just a browser — it can only
call Rust via `window.__TAURI__.core.invoke('command_name', args)`. All filesystem, system, and
native operations must be implemented as Rust commands and called through `invoke()`.

**Practical impact:** `electron_code_sync_logic()` and friends in `functions.js` use `require()`
heavily. The Tauri versions (`tauri_code_sync_logic()` etc.) in `js/tauri_functions.js` replace
all of that with `invoke()` calls that delegate to Rust. No `require()` anywhere in JS.

### webSecurity: false — different approach
Electron had `webSecurity: false` which disabled all cross-origin restrictions in the webview.
Tauri uses `dangerousRemoteUrls` in `tauri.conf.json` to allowlist specific domains instead.
Currently allowlisted: `adventure.land`, `*.adventure.land`, `thegame.com`, `*.thegame.com`.
Add more domains here if the game loads resources from other origins.

### screenshot API
Electron used `capturePage()` → raw PNG buffer.
Tauri uses `WebviewWindow::capture_image()` → RGBA bytes → encoded to PNG via the `image` crate.
The saved file goes to the app data directory (not a user-chosen path). Add a save dialog if needed.

---

## 🟠 Not implemented yet

### MAS (Mac App Store) build
Electron had `electron_mas_receipt()` which read the MAS receipt file from
`<app>.app/Contents/_MASReceipt/receipt` and returned it as base64 for server validation.

No MAS build is planned right now, but when it is:
- Add a `get_mas_receipt` Tauri command in `lib.rs`
- Read the receipt file via `std::fs::read(receipt_path)` and return `base64::encode(bytes)`
- Receipt path in Rust: `std::env::current_exe()` → walk up to `.app/Contents/_MASReceipt/receipt`
- Add `is_mas` detection in `js/tauri_functions.js`

### Code signing
- macOS: requires Apple Developer certificate + `codesign` + notarization. Configure in
  `tauri.conf.json` under `bundle.macOS.signingIdentity` and `bundle.macOS.providerShortName`.
- Windows: optional but removes SmartScreen warnings. Configure under `bundle.windows.certificateThumbprint`.

### Icons
`src-tauri/icons/` folder is empty. Generate icons from a 1024×1024 PNG:
```
cargo tauri icon /path/to/icon.png
```
This generates all required sizes for macOS (.icns), Windows (.ico), and Linux.

### GitHub Actions CI (cross-platform builds without physical Windows machine)
Add `.github/workflows/build.yml` using the official Tauri action:
```yaml
uses: tauri-apps/tauri-action@v0
```
This enables Windows builds from macOS/Linux via GitHub's Windows runners.
Set `STEAM_SDK_LOCATION` as a GitHub Actions secret.

---

## 🟢 Already better than Electron

- No `.node` recompile per Electron version — `steamworks-rs` links statically
- No `backgroundThrottling` issue — Tauri doesn't throttle background windows
- `disableAutoHideCursor` not needed — Tauri default behavior is correct
- Single binary output, smaller than Electron's ~150MB
