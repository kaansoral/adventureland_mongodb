fn main() {
    const COMMANDS: &[&str] = &[
        "get_steam_auth",
        "refresh_steam_auth",
        "get_steam_purchase_authorization",
        "reload_game",
        "create_subwindow",
        "create_character_window",
        "open_external",
        "open_steam_checkout",
        "open_devtools",
        "toggle_fullscreen",
        "get_desktop_language",
        "get_bundled_images",
    ];

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to build the Tauri application");
}
