# Changelog

## 0.2.0

- Add the auto sync folder flow that mirrors the old game-client `/codes` workflow.
- Download all CODE slots into `adventureland/codes` and `adventureland/characters`.
- Upload managed files on save.
- Poll for remote CODE changes and handle offline local edits.
- Preserve conflicts in `clash/` and replaced files in `history/`.
- Refresh standard helper libraries into `adventureland/libraries`.

## 0.1.0

- Add token setup through VS Code Secret Storage.
- Add CODE slot listing, download, manual upload, and auto upload on save.
- Use the Adventure Land JSON API `list_codes`, `get_code`, and `save_code` methods.
