// Adventure Land — Tauri v2 backend
// 1:1 replacement for ~/thegame/electron/main.js

use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_store::StoreExt;

// ─── Constants ───────────────────────────────────────────────────────────────

const BUILD: &str = "b260621";
const STEAM_APP_ID: u32 = 777150;
const BASE_URL: &str = "https://adventure.land/";

// Toggle these for dev/recording builds (matches Electron's `dev` and `recording_mode` vars)
const DEV: bool = false;
const RECORDING_MODE: bool = false;

// Window dimensions (matches Electron: width=1440, height=900; +22 for titlebar)
const WIN_WIDTH: f64 = 1440.0;
const WIN_HEIGHT: f64 = 922.0; // 900 + 22

// ─── App state ───────────────────────────────────────────────────────────────

struct AppState {
    fullscreen: bool,
    sub_counter: u32,
    // Holds the file watcher alive for code sync (dropped = stop watching)
    watcher: Option<notify::RecommendedWatcher>,
    ide_root: Option<std::path::PathBuf>,
}

type AppStateMutex = Mutex<AppState>;

// ─── Serializable types ───────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct WindowData {
    pub platform: String,
    pub build: String,
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

fn game_url(platform_str: &str) -> String {
    let mut base = if DEV {
        "http://thegame.com/".to_string()
    } else {
        BASE_URL.to_string()
    };
    if RECORDING_MODE {
        base.push_str("?recording_mode=true&buildid=");
    } else {
        base.push_str("?buildid=");
    }
    base.push_str(&format!("{}-{}", BUILD, platform_str));
    base
}

/// Mirrors Electron's is_url_safe() — only adventure.land / thegame.com URLs allowed
fn is_url_safe(url: &str) -> bool {
    let stripped = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    stripped.starts_with("adventure.land")
        || stripped.starts_with("www.adventure.land")
        || stripped.starts_with("thegame.com")
        || stripped.starts_with("www.thegame.com")
}

// ─── Windows 7/8 detection ───────────────────────────────────────────────────
// Mirrors Electron: osf = parseFloat(require('os').release()); osf <= 6.3

fn is_windows_7_or_8() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(release) = sys_info::os_release() {
            if let Ok(ver) = release.parse::<f32>() {
                return ver <= 6.3;
            }
        }
    }
    false
}

// ─── Steam initialization ────────────────────────────────────────────────────
// Mirrors Electron: greenworks.init() → getEncryptedAppTicket('adventurelandticketv0', ...)
//
// IMPORTANT: steamworks-rs v0.11 does not yet expose ISteamUser::RequestEncryptedAppTicket
// as a safe wrapper. This implementation uses authentication_session_ticket() instead,
// which is a shorter-lived token. For production, either:
//   a) Implement the encrypted ticket via raw FFI (see steamworks-sys crate), OR
//   b) Update the server to accept session tickets as a verified alternative.
//
// The Steamworks SDK (libsteam_api.dylib/.so/.dll) must be present at build time.
// Set STEAM_SDK_LOCATION=/path/to/steamworks_sdk before running `cargo tauri build`.
// Download from: https://partner.steamgames.com/downloads/steamworks_sdk.zip

fn init_steam(app: &AppHandle) {
    let store_result = app.store("config.json");
    match steamworks::Client::init_app(STEAM_APP_ID) {
        Ok((client, single)) => {
            println!("Steam API has been initialized.");

            // Request auth session ticket (nearest equivalent to getEncryptedAppTicket)
            // TODO: Replace with encrypted app ticket when steamworks-rs adds support.
            // User data 'adventurelandticketv0' was passed to greenworks in Electron.
            let (ticket, _handle) = client
                .user()
                .authentication_session_ticket(vec![client.user().steam_id()]);
            let hex_ticket = hex::encode(ticket.data());

            if let Ok(store) = store_result {
                store.set("ticket", serde_json::Value::String(hex_ticket));
                let _ = store.save();
                println!("Steam ticket stored.");
            }

            // Run callbacks once to process any pending Steam events
            single.run_callbacks();
        }
        Err(e) => {
            eprintln!("Steam integration failed: {}", e);
            app.dialog()
                .message(format!("Steam Integration Failed: {}", e))
                .title("Adventure Land")
                .blocking_show();
        }
    }
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

/// Returns the stored Steam ticket hex string.
/// Mirrors: electron_steam_ticket() in js/functions.js:6975
/// INTEGRATION: Replace electron_steam_ticket() calls in js/functions.js:6975
///   and in js/game.js:~280 (data.ticket = tauri_steam_ticket())
#[tauri::command]
async fn get_steam_ticket(app: AppHandle) -> Result<String, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    Ok(store
        .get("ticket")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default())
}

/// Returns platform and build identifier.
/// Mirrors: electron_get_data() in js/functions.js:6986
///   and window.cdata in main.js (set on BrowserWindow)
/// INTEGRATION: Replace electron_get_data() / window.cdata reads
#[tauri::command]
async fn get_window_data() -> WindowData {
    WindowData {
        platform: "steam".to_string(),
        build: BUILD.to_string(),
    }
}

/// Creates a secondary game window (sub window for multi-character play).
/// Mirrors: ipcMain.on('create_subwindow') + create_subwindow() in main.js
/// INTEGRATION: Replace electron.ipcRenderer.send('create_subwindow') calls
#[tauri::command]
async fn create_subwindow(
    app: AppHandle,
    state: State<'_, AppStateMutex>,
) -> Result<(), String> {
    let label = {
        let mut s = state.lock().unwrap();
        s.sub_counter += 1;
        format!("sub-{}", s.sub_counter)
    };
    let platform = std::env::consts::OS;
    let url = game_url(platform);

    WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title("Adventure Land")
    .inner_size(WIN_WIDTH, WIN_HEIGHT)
    .visible(false)
    .decorations(true)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Brings the most-recently-created sub window to front.
/// Mirrors: ipcMain.on('show_subwindow') → sub.moveTop()
/// INTEGRATION: Replace electron.ipcRenderer.send('show_subwindow')
#[tauri::command]
async fn show_subwindow(app: AppHandle, state: State<'_, AppStateMutex>) -> Result<(), String> {
    let counter = state.lock().unwrap().sub_counter;
    if counter == 0 {
        return Err("No sub window exists".to_string());
    }
    let label = format!("sub-{}", counter);
    if let Some(w) = app.get_webview_window(&label) {
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Brings the main window to front.
/// Mirrors: ipcMain.on('show_mainwindow') → main.moveTop()
/// INTEGRATION: Replace electron.ipcRenderer.send('show_mainwindow')
#[tauri::command]
async fn show_mainwindow(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Returns whether the given window label is the main (not a sub) window.
/// Mirrors: electron_is_main() in js/functions.js:7014
///   (checked browserWindowOptions.sideWindow in Electron)
/// INTEGRATION: Replace electron_is_main() calls
#[tauri::command]
async fn is_main_window(label: String) -> bool {
    !label.contains("sub")
}

/// Opens a URL in the system browser.
/// Mirrors: shell.openExternal() / shell.openItem() in Electron
/// INTEGRATION: Replace electron shell.openExternal calls
#[tauri::command]
async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    app.shell().open(&url, None).map_err(|e| e.to_string())
}

/// Opens the adventure-land code sync folder in the OS file manager.
/// Mirrors: electron_open_codes() in js/functions.js:6896
/// INTEGRATION: Replace electron_open_codes() calls
#[tauri::command]
async fn open_codes_folder(
    app: AppHandle,
    state: State<'_, AppStateMutex>,
) -> Result<(), String> {
    let ide_root = state
        .lock()
        .unwrap()
        .ide_root
        .clone()
        .ok_or("Code sync not started")?;
    let path = ide_root.to_string_lossy().to_string();
    app.shell()
        .open(&format!("file://{}", path), None)
        .map_err(|e| e.to_string())
}

/// Clears app store and restarts the application.
/// Mirrors: electron_reset() in js/functions.js:6910
/// INTEGRATION: Replace electron_reset() calls
#[tauri::command]
async fn reset_app(app: AppHandle) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.clear();
    let _ = store.save();
    app.restart();
}

/// Opens DevTools for the calling window.
/// Mirrors: electron_dev_tools() in js/functions.js:6924 — ewindow.openDevTools()
/// INTEGRATION: Replace electron_dev_tools() calls
#[tauri::command]
async fn open_devtools(window: WebviewWindow) {
    window.open_devtools();
}

/// Toggles fullscreen on the calling window.
/// Mirrors: electron_fullscreen() in js/functions.js:6932 — ewindow.setFullScreen()
/// INTEGRATION: Replace electron_fullscreen() calls
#[tauri::command]
async fn toggle_fullscreen(
    window: WebviewWindow,
    state: State<'_, AppStateMutex>,
) -> Result<(), String> {
    let new_state = {
        let mut s = state.lock().unwrap();
        s.fullscreen = !s.fullscreen;
        s.fullscreen
    };
    window
        .set_fullscreen(new_state)
        .map_err(|e| e.to_string())
}

/// Captures the window contents and saves to app data dir.
/// Mirrors: electron_screenshot() in js/functions.js:6941 — capturePage()
/// INTEGRATION: Replace electron_screenshot() calls
/// Returns the path to the saved PNG file.
#[tauri::command]
async fn capture_screenshot(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<String, String> {
    let img = window.capture_image().map_err(|e| e.to_string())?;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let filename = format!("AL Screenshot {}.png", timestamp);
    let path = app_data.join(&filename);

    // tauri::image::Image → RGBA bytes → PNG
    let rgba = img.rgba().to_vec();
    let width = img.width();
    let height = img.height();

    let img_buf = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or("Failed to construct image buffer")?;
    img_buf.save(&path).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

/// Returns the stored http_mode flag (used for local testing over HTTP).
/// Mirrors: electron_get_http_mode() in js/functions.js:7003
/// INTEGRATION: Replace electron_get_http_mode() calls
#[tauri::command]
async fn get_http_mode(app: AppHandle) -> Result<bool, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    Ok(store
        .get("http_mode")
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

/// Starts the local code sync file watcher.
/// Mirrors: electron_code_sync_logic() in js/functions.js:6788
///   (uses chokidar/fs.watch in Electron; uses `notify` crate here)
/// Emits "code-file-changed" Tauri events to the frontend when files change.
/// INTEGRATION: Replace electron_code_sync_logic() calls
#[tauri::command]
async fn start_code_sync(
    app: AppHandle,
    state: State<'_, AppStateMutex>,
    user_id: String,
) -> Result<String, String> {
    use notify::{RecursiveMode, Watcher};

    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let ide_root = app_data.join(format!("autosync{}", user_id));

    // Create directory structure (mirrors electron_code_sync_logic mkdir calls)
    for sub in &[
        "adventureland/characters",
        "adventureland/codes",
        "adventureland/libraries",
        "history",
    ] {
        std::fs::create_dir_all(ide_root.join(sub)).map_err(|e| e.to_string())?;
    }

    let app_clone = app.clone();
    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                let paths: Vec<String> = event
                    .paths
                    .iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                let _ = app_clone.emit("code-file-changed", paths);
            }
        })
        .map_err(|e| e.to_string())?;

    watcher
        .watch(
            &ide_root.join("adventureland/characters"),
            RecursiveMode::NonRecursive,
        )
        .map_err(|e| e.to_string())?;
    watcher
        .watch(
            &ide_root.join("adventureland/codes"),
            RecursiveMode::NonRecursive,
        )
        .map_err(|e| e.to_string())?;

    let root_str = ide_root.to_string_lossy().to_string();
    let mut s = state.lock().unwrap();
    s.watcher = Some(watcher);
    s.ide_root = Some(ide_root);

    Ok(root_str)
}

// ─── macOS menu ──────────────────────────────────────────────────────────────
// Mirrors the darwin_menu in main.js: App / Edit / Tools submenus.
// On Windows, menus are disabled entirely via tauri.conf.json (no menu: false needed;
// Tauri's default is no menu bar on Windows when using WebviewWindow).

#[cfg(target_os = "macos")]
fn build_menu(app: &AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder, MenuItem};

    // App submenu (Adventure Land > About, Hide, etc.)
    let app_menu = SubmenuBuilder::new(app, "Adventure Land")
        .item(&PredefinedMenuItem::about(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // Edit submenu
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // Tools submenu (custom items for devtools, reload, zoom, fullscreen)
    let devtools_item = MenuItem::with_id(app, "devtools", "Inspector", true, None::<&str>)?;
    let reload_item = MenuItem::with_id(app, "reload", "Reload", true, Some("CmdOrCtrl+R"))?;
    let zoom_reset = MenuItem::with_id(app, "zoom-reset", "Actual Size", true, Some("CmdOrCtrl+0"))?;
    let zoom_in = MenuItem::with_id(app, "zoom-in", "Zoom In", true, Some("CmdOrCtrl+Plus"))?;
    let zoom_out = MenuItem::with_id(app, "zoom-out", "Zoom Out", true, Some("CmdOrCtrl+Minus"))?;
    let fullscreen = MenuItem::with_id(app, "fullscreen", "Enter Full Screen", true, Some("Ctrl+CmdOrCtrl+F"))?;

    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&devtools_item)
        .separator()
        .item(&reload_item)
        .separator()
        .item(&zoom_reset)
        .item(&zoom_in)
        .item(&zoom_out)
        .separator()
        .item(&fullscreen)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&tools_menu)
        .build()
}

// ─── App entry point ─────────────────────────────────────────────────────────

pub fn run() {
    let state = AppState {
        fullscreen: false,
        sub_counter: 0,
        watcher: None,
        ide_root: None,
    };

    tauri::Builder::default()
        .manage(AppStateMutex::new(state))
        // Plugins
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Single instance lock (Windows only, mirrors `app.requestSingleInstanceLock()`)
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();

            // ── Steam init (mirrors greenworks block in main.js) ──────────────
            init_steam(&handle);

            // ── http_mode check (mirrors `if(store.get("http_mode")) url=url.replace(...)`) ──
            let base_url = {
                let store = handle.store("config.json")?;
                let http_mode = store.get("http_mode").and_then(|v| v.as_bool()).unwrap_or(false);
                let url = if DEV { "http://thegame.com/" } else { BASE_URL };
                if http_mode { url.replace("https://", "http://") } else { url.to_string() }
            };

            let platform = std::env::consts::OS;
            let full_url = format!(
                "{}?buildid={}-{}",
                base_url, BUILD, platform
            );
            if RECORDING_MODE {
                // Rebuild with recording_mode param if needed
            }

            // ── Create loader window ──────────────────────────────────────────
            // Loader shows first while the main game page loads (mirrors Electron loader logic)
            let is_w7 = is_windows_7_or_8();
            let win7v2 = {
                let store = handle.store("config.json")?;
                store.get("win7v2").and_then(|v| v.as_bool()).unwrap_or(false)
            };
            let loader_html = if cfg!(target_os = "windows") && is_w7 && !win7v2 {
                // First time on Win7/8: show asset-extraction loader, set win7v2 flag
                let store = handle.store("config.json")?;
                store.set("win7v2", serde_json::Value::Bool(true));
                let _ = store.save();
                "w7loader.html"
            } else if cfg!(target_os = "windows") && is_w7 {
                "w7rloader.html"
            } else {
                "loader.html"
            };

            let _loader = WebviewWindowBuilder::new(
                app,
                "loader",
                tauri::WebviewUrl::App(loader_html.into()),
            )
            .title("Adventure Land")
            .inner_size(WIN_WIDTH, WIN_HEIGHT)
            .visible(false)
            .decorations(true)
            .resizable(false)
            .build()?;

            // Show loader once its DOM is ready
            {
                let loader_handle = app.get_webview_window("loader").unwrap();
                loader_handle.on_page_load(move |w, payload| {
                    if payload.event() == tauri::webview::PageLoadEvent::Finished {
                        let _ = w.show();
                    }
                });
            }

            // ── Create main game window ───────────────────────────────────────
            let main_window = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(full_url.parse()?),
            )
            .title("Adventure Land")
            .inner_size(WIN_WIDTH, WIN_HEIGHT)
            .visible(false)
            .decorations(true)
            .resizable(true)
            .build()?;

            // When main game page finishes loading: show main, close loader
            // Mirrors: main.webContents.once('dom-ready', ...) with 600ms delay
            {
                let app_h = handle.clone();
                main_window.on_page_load(move |w, payload| {
                    if payload.event() == tauri::webview::PageLoadEvent::Finished {
                        let app_inner = app_h.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(600));
                            if let Some(loader) = app_inner.get_webview_window("loader") {
                                let _ = loader.close();
                            }
                            if let Some(main) = app_inner.get_webview_window("main") {
                                let _ = main.show();
                                let _ = main.set_focus();
                            }
                        });
                    }
                });
            }

            // ── Close confirmation dialog ─────────────────────────────────────
            // Mirrors: main.on('close', ...) showMessageBoxSync confirm in main.js
            {
                let app_h = handle.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let app_inner = app_h.clone();
                        app_inner
                            .dialog()
                            .message("Are you sure you want to close Adventure Land?")
                            .title("Confirm")
                            .ok_label("Yes")
                            .cancel_label("No")
                            .show(move |confirmed| {
                                if confirmed {
                                    if let Some(w) = app_inner.get_webview_window("main") {
                                        let _ = w.destroy();
                                    }
                                }
                            });
                    }
                });
            }

            // ── macOS menu ────────────────────────────────────────────────────
            #[cfg(target_os = "macos")]
            {
                match build_menu(&handle) {
                    Ok(menu) => {
                        app.set_menu(menu)?;
                        // Handle menu item clicks
                        let h = handle.clone();
                        app.on_menu_event(move |app, event| {
                            let main = app.get_webview_window("main");
                            match event.id().as_ref() {
                                "devtools" => {
                                    if let Some(w) = &main { w.open_devtools(); }
                                }
                                "reload" => {
                                    if let Some(w) = &main {
                                        let _ = w.eval("window.location.reload()");
                                    }
                                }
                                "zoom-reset" => {
                                    if let Some(w) = &main {
                                        let _ = w.eval("document.body.style.zoom='1'");
                                    }
                                }
                                "zoom-in" => {
                                    if let Some(w) = &main {
                                        let _ = w.eval("document.body.style.zoom=(parseFloat(document.body.style.zoom||1)+0.1).toString()");
                                    }
                                }
                                "zoom-out" => {
                                    if let Some(w) = &main {
                                        let _ = w.eval("document.body.style.zoom=(parseFloat(document.body.style.zoom||1)-0.1).toString()");
                                    }
                                }
                                "fullscreen" => {
                                    if let Some(w) = &main {
                                        let current = w.is_fullscreen().unwrap_or(false);
                                        let _ = w.set_fullscreen(!current);
                                    }
                                }
                                _ => {}
                            }
                        });
                    }
                    Err(e) => eprintln!("Menu build error: {}", e),
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_steam_ticket,
            get_window_data,
            create_subwindow,
            show_subwindow,
            show_mainwindow,
            is_main_window,
            open_external,
            open_codes_folder,
            reset_app,
            open_devtools,
            toggle_fullscreen,
            capture_screenshot,
            get_http_mode,
            start_code_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Adventure Land");
}
