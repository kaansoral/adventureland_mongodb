fn main() {
    const COMMANDS: &[&str] = &[
        "get_steam_auth",
        "get_steam_purchase_authorization",
        "create_subwindow",
        "open_external",
        "open_devtools",
        "toggle_fullscreen",
    ];

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to build the Tauri application");
}
