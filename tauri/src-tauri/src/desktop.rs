use serde::Deserialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, State};
use tokio::sync::watch;

#[derive(Deserialize)]
struct Language {
    code: String,
    steam: Option<String>,
    close_confirmation: String,
}

fn languages() -> &'static [Language] {
    static LANGUAGES: OnceLock<Vec<Language>> = OnceLock::new();
    LANGUAGES.get_or_init(|| {
        serde_json::from_str(include_str!("../../resources/desktop-languages.json"))
            .expect("invalid generated desktop language registry")
    })
}

fn supported(code: &str) -> bool {
    languages().iter().any(|language| language.code == code)
}

fn steam_language(value: &str) -> Option<String> {
    languages().iter()
        .find(|language| language.steam.as_deref() == Some(value))
        .map(|language| language.code.clone())
}

pub struct DesktopLanguage {
    choice: Mutex<Option<String>>,
    steam: watch::Sender<Option<String>>,
    path: Option<PathBuf>,
    save_lock: Mutex<()>,
}

impl DesktopLanguage {
    pub fn new(path: Option<PathBuf>) -> Self {
        let choice = path.as_ref().and_then(|path| std::fs::read_to_string(path).ok())
            .map(|value| value.trim().to_owned()).filter(|value| supported(value));
        let (steam, _) = watch::channel(None);
        Self { choice: Mutex::new(choice), steam, path, save_lock: Mutex::new(()) }
    }

    pub fn cached(&self) -> Option<String> {
        self.choice.lock().ok().and_then(|choice| choice.clone())
    }

    pub fn close_confirmation(&self) -> String {
        let code = self.cached().unwrap_or_else(|| "en".into());
        languages()
            .iter()
            .find(|language| language.code == code)
            .or_else(|| languages().iter().find(|language| language.code == "en"))
            .map(|language| language.close_confirmation.clone())
            .unwrap_or_else(|| "Are you sure you want to close Adventure Land?".into())
    }

    pub fn steam_ready(&self, value: &str) {
        // Empty means unavailable. A late Steam response never changes a saved choice.
        self.steam.send_replace(Some(steam_language(value).unwrap_or_default()));
    }

    fn choose(self: &Arc<Self>, language: String, explicit: bool) -> String {
        let (language, changed) = match self.choice.lock() {
            Ok(mut choice) => {
                if !explicit && choice.is_some() { return choice.clone().unwrap(); }
                let changed = choice.as_ref() != Some(&language);
                *choice = Some(language.clone());
                (language, changed)
            }
            Err(_) => return language,
        };
        if changed {
            println!("[Tauri Language] Using {language}; cached for future launches.");
            let state = self.clone();
            std::thread::spawn(move || {
                // Serialize writes, then read the latest choice so old requests cannot win.
                let Ok(_guard) = state.save_lock.lock() else { return };
                let Some(path) = &state.path else { return };
                let Some(language) = state.cached() else { return };
                let save = || -> std::io::Result<()> {
                    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
                    let temporary = path.with_extension("tmp");
                    std::fs::write(&temporary, language)?;
                    std::fs::rename(temporary, path)
                };
                if save().is_err() {
                    eprintln!("[Tauri Language] Could not save the desktop preference; using the session cache.");
                }
            });
        }
        language
    }

    async fn resolve(self: &Arc<Self>, system: String, preferred: Option<String>) -> String {
        if let Some(language) = preferred.filter(|value| supported(value)) {
            return self.choose(language, true);
        }
        if let Some(language) = self.cached() { return language; }
        let mut steam = self.steam.subscribe();
        if steam.borrow().is_none() {
            // One notification, not a poll. No native UI or auth callback waits on this.
            let _ = tokio::time::timeout(Duration::from_millis(750), steam.changed()).await;
        }
        let language = steam.borrow().clone().filter(|value| supported(value))
            .unwrap_or_else(|| if supported(&system) { system } else { "en".into() });
        self.choose(language, false)
    }
}

#[tauri::command]
pub async fn get_desktop_language(
    state: State<'_, Arc<DesktopLanguage>>,
    system_language: String,
    preferred: Option<String>,
) -> Result<String, String> {
    Ok(state.inner().resolve(system_language, preferred).await)
}

#[tauri::command]
pub async fn get_bundled_images(app: AppHandle) -> Result<tauri::ipc::Response, String> {
    // One fixed, embedded public resource. Never accept a filesystem path from JavaScript.
    tauri::async_runtime::spawn_blocking(move || {
        app.asset_resolver().get("image-cache.bin".into())
            .map(|asset| tauri::ipc::Response::new(asset.bytes))
            .ok_or_else(|| "Bundled images unavailable".to_string())
    }).await.map_err(|_| "Bundled image read failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_steam_identifiers_and_rejects_paths() {
        assert_eq!(languages().len(), 32);
        assert_eq!(steam_language("koreana").as_deref(), Some("ko"));
        assert_eq!(steam_language("latam").as_deref(), Some("es-419"));
        assert_eq!(steam_language("tchinese").as_deref(), Some("zh-Hant"));
        assert_eq!(steam_language("brazilian").as_deref(), Some("pt-BR"));
        assert!(steam_language("filipino").is_none());
        assert!(!supported("../en"));
    }

    #[test]
    fn executable_embeds_only_public_desktop_assets() {
        let context = crate::app_context();
        let assets = context.assets();
        let bundle = assets.get(&"image-cache.bin".into()).expect("missing image bundle");
        let length = u32::from_le_bytes(bundle[..4].try_into().unwrap()) as usize;
        let manifest: serde_json::Value = serde_json::from_slice(&bundle[4..length + 4]).unwrap();
        assert_eq!(manifest["version"], 1);
        assert!(manifest["images"].as_object().unwrap().len() > 200);
        for language in languages() {
            assert!(!language.close_confirmation.is_empty());
            let key = format!("languages/{}.js", language.code);
            let phrases = assets.get(&key.into()).expect("missing desktop translation");
            assert!(std::str::from_utf8(&phrases).unwrap().contains("desktop.loading"));
        }
        assert!(assets.get(&"desktop.js".into()).is_some());
        assert!(assets.get(&"secretsandconfig/keys.js".into()).is_none());
        assert!(assets.get(&"node/server.js".into()).is_none());
        assert!(assets.get(&"languages/en/updates.js".into()).is_none());
    }

    #[test]
    fn preferences_win_over_steam_and_survive_late_results() {
        tauri::async_runtime::block_on(async {
            let state = Arc::new(DesktopLanguage::new(None));
            state.steam_ready("german");
            assert_eq!(state.resolve("tr".into(), None).await, "de");
            assert_eq!(state.resolve("tr".into(), Some("ja".into())).await, "ja");
            state.steam_ready("french");
            assert_eq!(state.resolve("tr".into(), None).await, "ja");
            let fallback = Arc::new(DesktopLanguage::new(None));
            fallback.steam_ready("");
            assert_eq!(fallback.resolve("fil".into(), None).await, "fil");
            fallback.steam_ready("english");
            assert_eq!(fallback.resolve("en".into(), None).await, "fil");
        });
    }

    #[test]
    fn close_confirmation_uses_the_cached_language() {
        tauri::async_runtime::block_on(async {
            let state = Arc::new(DesktopLanguage::new(None));
            assert_eq!(
                state.close_confirmation(),
                "Are you sure you want to close Adventure Land?"
            );
            assert_eq!(state.resolve("en".into(), Some("tr".into())).await, "tr");
            assert_eq!(
                state.close_confirmation(),
                "Adventure Land'i kapatmak istediğinizden emin misiniz?"
            );
        });
    }

    #[test]
    fn missing_steam_cannot_hold_startup() {
        tauri::async_runtime::block_on(async {
            let state = Arc::new(DesktopLanguage::new(None));
            let result = tokio::time::timeout(Duration::from_secs(2), state.resolve("tr".into(), None)).await;
            assert_eq!(result.unwrap(), "tr");
        });
    }
}
