use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const BUILD: &str = "b260823";
const STEAM_APP_ID: u32 = 777150;
const STEAM_IDENTITY: &str = "adventure-land-tauri-v1";
const BASE_URL: &str = "https://adventure.land/";
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 AdventureLandTauri/1.3.1";
#[cfg(target_os = "macos")]
const PLATFORM: &str = "darwin";
#[cfg(target_os = "windows")]
const PLATFORM: &str = "win32";
#[cfg(target_os = "linux")]
const PLATFORM: &str = "linux";
const WIN_WIDTH: f64 = 1440.0;
const WIN_HEIGHT: f64 = 922.0;

struct AppState {
    sub_counter: Mutex<u32>,
    steam_ticket: Arc<Mutex<String>>,
    steam_error: Arc<Mutex<String>>,
    steam_purchases: Arc<Mutex<HashMap<u64, bool>>>,
}

#[derive(Serialize)]
struct SteamAuthData {
    ticket: String,
    error: String,
}

#[derive(Serialize)]
struct SteamPurchaseAuthorization {
    ready: bool,
    authorized: bool,
}

fn game_url() -> String {
    format!("{BASE_URL}?buildid={BUILD}-{PLATFORM}-tauri")
}

fn reload_game_window(window: &WebviewWindow, selection: bool) -> Result<(), String> {
    let mut url = if selection {
        game_url()
            .parse::<tauri::Url>()
            .map_err(|error| error.to_string())?
    } else {
        window.url().map_err(|error| error.to_string())?
    };
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string();
    url.query_pairs_mut().append_pair("tauri_reload", &nonce);
    window.navigate(url).map_err(|error| error.to_string())
}

fn is_game_url(url: &tauri::Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    match url.host_str() {
        Some("adventure.land") => true,
        Some(host) => host.ends_with(".adventure.land"),
        None => false,
    }
}

fn is_external_url(url: &url::Url) -> bool {
    url.scheme() == "https" || url.scheme() == "mailto"
}

#[cfg(target_os = "macos")]
fn set_macos_dock_icon() {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let main_thread = MainThreadMarker::new().expect("setting the macOS Dock icon off main thread");
    let data = NSData::with_bytes(include_bytes!("../icons/icon.icns"));
    let icon =
        NSImage::initWithData(NSImage::alloc(), &data).expect("decoding the macOS Dock icon");
    let app = NSApplication::sharedApplication(main_thread);
    unsafe { app.setApplicationIconImage(Some(&icon)) };
}

fn lock_string(value: &Arc<Mutex<String>>) -> String {
    value.lock().map(|value| value.clone()).unwrap_or_default()
}

fn init_steam(
    ticket: Arc<Mutex<String>>,
    error: Arc<Mutex<String>>,
    purchases: Arc<Mutex<HashMap<u64, bool>>>,
) {
    match steamworks::Client::init_app(STEAM_APP_ID) {
        Ok(client) => {
            let callback_ticket = ticket.clone();
            let callback_error = error.clone();
            let callback =
                client.register_callback(move |response: steamworks::TicketForWebApiResponse| {
                    if response.result.is_ok() && response.ticket_len > 0 {
                        let length = response.ticket_len as usize;
                        if length <= response.ticket.len() {
                            if let Ok(mut value) = callback_ticket.lock() {
                                *value = hex::encode(&response.ticket[..length]);
                            }
                            if let Ok(mut value) = callback_error.lock() {
                                value.clear();
                            }
                            println!("[Tauri Steam] Web API ticket ready.");
                            return;
                        }
                    }
                    eprintln!("[Tauri Steam] Steam did not issue a Web API ticket.");
                    if let Ok(mut value) = callback_error.lock() {
                        *value = "Steam did not issue an authentication ticket.".to_string();
                    }
                });
            let ticket_handle = client
                .user()
                .authentication_session_ticket_for_webapi(STEAM_IDENTITY);
            let callback_purchases = purchases.clone();
            let purchase_callback = client.register_callback(
                move |response: steamworks::MicroTxnAuthorizationResponse| {
                    if response.app_id.0 != STEAM_APP_ID {
                        return;
                    }
                    if let Ok(mut values) = callback_purchases.lock() {
                        values.insert(response.order_id, response.authorized);
                    }
                    println!(
                        "[Tauri Steam] Purchase authorization received for order {}: {}.",
                        response.order_id, response.authorized
                    );
                },
            );

            std::thread::spawn(move || {
                let _callback = callback;
                let _purchase_callback = purchase_callback;
                let _ticket_handle = ticket_handle;
                loop {
                    client.run_callbacks();
                    std::thread::sleep(Duration::from_millis(50));
                }
            });
        }
        Err(_) => {
            eprintln!("[Tauri Steam] Steam is unavailable.");
            if let Ok(mut value) = error.lock() {
                *value = "Steam is unavailable. Start Adventure Land through Steam.".to_string();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{is_external_url, is_game_url, STEAM_APP_ID, STEAM_IDENTITY};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    #[test]
    fn accepts_only_adventure_land_https_urls() {
        assert!(is_game_url(&"https://adventure.land/".parse().unwrap()));
        assert!(is_game_url(
            &"https://eu.adventure.land/game".parse().unwrap()
        ));
        assert!(!is_game_url(&"http://adventure.land/".parse().unwrap()));
        assert!(!is_game_url(
            &"https://adventure.land.example.com/".parse().unwrap()
        ));
    }

    #[test]
    fn opens_only_safe_external_url_schemes() {
        assert!(is_external_url(
            &"https://store.steampowered.com/".parse().unwrap()
        ));
        assert!(is_external_url(
            &"mailto:hello@adventure.land".parse().unwrap()
        ));
        assert!(!is_external_url(&"http://example.com/".parse().unwrap()));
        assert!(!is_external_url(&"file:///tmp/example".parse().unwrap()));
    }

    #[test]
    #[ignore = "requires the Steam client and an account that owns Adventure Land"]
    fn receives_live_steam_web_api_ticket() {
        let client =
            steamworks::Client::init_app(STEAM_APP_ID).expect("Steam initialization failed");
        let result = Arc::new(Mutex::new(None));
        let callback_result = result.clone();
        let _callback =
            client.register_callback(move |response: steamworks::TicketForWebApiResponse| {
                if let Ok(mut value) = callback_result.lock() {
                    *value = Some(response.result.is_ok() && response.ticket_len > 0);
                }
            });
        let _ticket = client
            .user()
            .authentication_session_ticket_for_webapi(STEAM_IDENTITY);

        for _ in 0..200 {
            client.run_callbacks();
            if let Some(success) = *result.lock().expect("Steam ticket state unavailable") {
                assert!(success, "Steam rejected the Web API ticket request");
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        panic!("Steam did not return a Web API ticket within ten seconds");
    }
}

#[tauri::command]
async fn get_steam_auth(state: State<'_, AppState>) -> Result<SteamAuthData, String> {
    for _ in 0..50 {
        if !lock_string(&state.steam_ticket).is_empty()
            || !lock_string(&state.steam_error).is_empty()
        {
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Ok(SteamAuthData {
        ticket: lock_string(&state.steam_ticket),
        error: lock_string(&state.steam_error),
    })
}

#[tauri::command]
fn get_steam_purchase_authorization(
    order_id: String,
    state: State<'_, AppState>,
) -> Result<SteamPurchaseAuthorization, String> {
    let order_id = order_id
        .parse::<u64>()
        .map_err(|_| "Invalid Steam order ID".to_string())?;
    let authorization = state
        .steam_purchases
        .lock()
        .map_err(|_| "Steam purchase state unavailable".to_string())?
        .remove(&order_id);
    Ok(SteamPurchaseAuthorization {
        ready: authorization.is_some(),
        authorized: authorization.unwrap_or(false),
    })
}

#[tauri::command]
fn reload_game(window: WebviewWindow, selection: bool) -> Result<(), String> {
    window
        .set_title("Adventure Land - Reloading")
        .map_err(|error| error.to_string())?;
    if let Err(error) = reload_game_window(&window, selection) {
        let _ = window.set_title("Adventure Land");
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
async fn create_subwindow(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let open_subwindows = app
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with("sub-"))
        .count();
    if open_subwindows >= 4 {
        return Err("Four secondary windows are already open".to_string());
    }
    let label = {
        let mut counter = state
            .sub_counter
            .lock()
            .map_err(|_| "Window state unavailable")?;
        *counter += 1;
        format!("sub-{counter}")
    };
    let url = game_url()
        .parse()
        .map_err(|error: url::ParseError| error.to_string())?;
    WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(url))
        .title("Adventure Land")
        .inner_size(WIN_WIDTH, WIN_HEIGHT)
        .user_agent(USER_AGENT)
        .on_navigation(is_game_url)
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL")?;
    if !is_external_url(&parsed) {
        return Err("Unsupported URL".to_string());
    }
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn open_devtools(window: WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
async fn toggle_fullscreen(window: WebviewWindow) -> Result<(), String> {
    let fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    window
        .set_fullscreen(!fullscreen)
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn build_menu(app: &AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};

    let app_menu = SubmenuBuilder::new(app, "Adventure Land")
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;
    let inspector = MenuItem::with_id(app, "inspector", "Inspector", true, None::<&str>)?;
    let reload = MenuItem::with_id(app, "reload", "Reload", true, Some("CmdOrCtrl+R"))?;
    let fullscreen = MenuItem::with_id(
        app,
        "fullscreen",
        "Toggle Full Screen",
        true,
        Some("Ctrl+CmdOrCtrl+F"),
    )?;
    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&inspector)
        .item(&reload)
        .separator()
        .item(&fullscreen)
        .build()?;
    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&tools_menu)
        .build()
}

pub fn run() {
    let steam_ticket = Arc::new(Mutex::new(String::new()));
    let steam_error = Arc::new(Mutex::new(String::new()));
    let steam_purchases = Arc::new(Mutex::new(HashMap::new()));
    let state = AppState {
        sub_counter: Mutex::new(0),
        steam_ticket: steam_ticket.clone(),
        steam_error: steam_error.clone(),
        steam_purchases: steam_purchases.clone(),
    };

    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            set_macos_dock_icon();

            init_steam(steam_ticket, steam_error, steam_purchases);

            WebviewWindowBuilder::new(app, "loader", tauri::WebviewUrl::App("loader.html".into()))
                .title("Adventure Land")
                .inner_size(WIN_WIDTH, WIN_HEIGHT)
                .visible(false)
                .resizable(false)
                .on_page_load(|window, payload| {
                    if payload.event() == tauri::webview::PageLoadEvent::Finished {
                        let _ = window.show();
                    }
                })
                .build()?;

            let page_load_handle = app.handle().clone();
            let main = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(game_url().parse()?),
            )
            .title("Adventure Land")
            .inner_size(WIN_WIDTH, WIN_HEIGHT)
            .visible(false)
            .user_agent(USER_AGENT)
            .on_navigation(is_game_url)
            .on_page_load(move |window, payload| {
                if payload.event() == tauri::webview::PageLoadEvent::Finished {
                    let _ = window.set_title("Adventure Land");
                    if let Some(loader) = page_load_handle.get_webview_window("loader") {
                        let _ = loader.close();
                    }
                    if let Some(main) = page_load_handle.get_webview_window("main") {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                }
            })
            .build()?;

            let handle = app.handle().clone();
            main.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let confirmed = rfd::MessageDialog::new()
                        .set_title("Adventure Land")
                        .set_description("Are you sure you want to close Adventure Land?")
                        .set_buttons(rfd::MessageButtons::YesNo)
                        .show();
                    if confirmed == rfd::MessageDialogResult::Yes {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.destroy();
                        }
                    }
                }
            });

            #[cfg(target_os = "macos")]
            {
                app.set_menu(build_menu(app.handle())?)?;
                app.on_menu_event(|app, event| {
                    if let Some(window) = app.get_webview_window("main") {
                        match event.id().as_ref() {
                            "inspector" => window.open_devtools(),
                            "reload" => {
                                let _ = window.set_title("Adventure Land - Reloading");
                                if let Err(error) = window.eval(
                                    "if(typeof tauri_graceful_reload==='function'){tauri_graceful_reload();}else{window.__TAURI__.core.invoke('reload_game',{selection:true});}",
                                ) {
                                    eprintln!("[Tauri] Reload failed: {error}");
                                    let _ = window.set_title("Adventure Land");
                                }
                            }
                            "fullscreen" => {
                                let fullscreen = window.is_fullscreen().unwrap_or(false);
                                let _ = window.set_fullscreen(!fullscreen);
                            }
                            _ => {}
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_steam_auth,
            get_steam_purchase_authorization,
            reload_game,
            create_subwindow,
            open_external,
            open_devtools,
            toggle_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Adventure Land");
}
