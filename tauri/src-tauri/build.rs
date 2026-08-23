fn main() {
    const COMMANDS: &[&str] = &[
        "get_steam_auth",
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
