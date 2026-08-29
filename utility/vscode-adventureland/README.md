# Adventure Land CODE Sync

Auto sync Adventure Land CODE slots from VS Code or Cursor through the Adventure Land JSON API.

Setup guide: `https://adventure.land/vscode`

## Setup

1. Open `https://adventure.land/vscode`.
2. Sign in and create a token.
3. In VS Code or Cursor, run `Adventure Land: Set API Token` and paste the token.
4. Run `Adventure Land: Activate Auto Sync Folder`.
5. Choose a local folder.

The token is stored in VS Code Secret Storage. It is not written to your workspace settings.

## Auto Sync Flow

When a folder is activated, the extension creates this layout:

```text
your-folder/
  adventureland/
    characters/
    clash/
    codes/
    libraries/
    .sync.json
  history/
```

It downloads every CODE slot into `adventureland/codes` or `adventureland/characters`, and keeps the standard helper files in `adventureland/libraries`.

After that:

- Saving a managed `.js` file uploads it to Adventure Land.
- Remote changes are checked every 60 seconds and downloaded.
- Local edits made while VS Code was closed are uploaded on the next sync if the remote slot did not change.
- If local and remote both changed, the local file is copied to `adventureland/clash/` and the remote version is downloaded.
- Replaced or removed managed files are copied to `history/`.
- Library files are refreshed from the game and are not upload targets.

Files are named like `merchant.12.js`. The part before the last dot is the CODE name, and the part before `.js` is the slot.

## Commands

- `Adventure Land: Set API Token`
- `Adventure Land: Clear API Token`
- `Adventure Land: Activate Auto Sync Folder`
- `Adventure Land: Sync CODE Folder Now`
- `Adventure Land: Open Auto Sync Folder`
- `Adventure Land: Stop Auto Sync Folder`
- `Adventure Land: List CODE Slots`
- `Adventure Land: Download CODE Slot`
- `Adventure Land: Upload Current File`
- `Adventure Land: Set Default CODE Slot`
- `Adventure Land: Toggle Auto Upload on Save`
- `Adventure Land: Open Mainframe`

## Settings

- `adventureland.apiBaseUrl`: defaults to `https://adventure.land/mcp_api`
- `adventureland.codeSlot`: default target slot when the file name does not include one
- `adventureland.codeName`: default CODE name for the configured slot
- `adventureland.autoUploadOnSave`: uploads matching files when saved
- `adventureland.autoStartSync`: starts the selected sync folder when VS Code starts
- `adventureland.syncPollSeconds`: remote check interval, default `60`
- `adventureland.maxCodeBytes`: upload size guard, default `1048576`

## Install From VSIX

In VS Code or Cursor, open Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P`, run `Extensions: Install from VSIX...`, then choose the downloaded `.vsix` file.

Local development install:

```sh
npm install
npm run package
code --install-extension adventure-land-code-sync-0.2.0.vsix
```

If the Cursor command line is installed, this also works:

```sh
cursor --install-extension adventure-land-code-sync-0.2.0.vsix
```

## Publish

After the Marketplace publisher and token are configured:

```sh
npx vsce publish
```

The extension uses `POST https://adventure.land/mcp_api/save_code` with the account token in the JSON body.
