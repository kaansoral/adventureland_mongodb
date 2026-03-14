// tauri_functions.js — Tauri v2 drop-in for all electron_* functions
// Place this file alongside functions.js and load it via base_script.html.
//
// INTEGRATION PLAN (3 touch-points when ready to wire up):
//
// 1. js/functions.js — near `var is_electron = ...`:
//      var is_tauri = window.__TAURI__ ? 1 : 0;
//    Replace electron_*() bodies with calls to tauri_*(), or just alias:
//      if(is_tauri) { electron_steam_ticket = tauri_steam_ticket; /* etc. */ }
//
// 2. htmls/base_script.html — mirror the {% if domain.electron %} block:
//      {% if domain.tauri %}
//        <script src="/js/tauri_functions.js?v={{ version }}"></script>
//      {% endif %}
//
// 3. js/game.js:278-280 — add after the electron block:
//      if(is_tauri) {
//          data.epl = tauri_data && tauri_data.platform;
//          data.ticket = tauri_steam_ticket();
//      }

/* global __TAURI__ */

// Detection var — mirrors `var is_electron` in functions.js
var is_tauri = (typeof window !== 'undefined' && window.__TAURI__) ? 1 : 0;

// Tauri core invoke (shorthand)
var _tinvoke = is_tauri ? window.__TAURI__.core.invoke : function() { return Promise.resolve(null); };

// Cached window data fetched at startup
var tauri_data = null;

// ─── Storage ─────────────────────────────────────────────────────────────────
// Mirrors storage_get / storage_set in functions.js:6515-6547
// Uses @tauri-apps/plugin-store (backed by a JSON file in app data dir).
// Falls back to Cookies for web context (matches Electron's fallback to localStorage).
//
// NOTE: The store is async but these are kept sync-compatible where possible.
// Call tauri_storage_init() once at startup to pre-load the store.

var _tauri_store = null;

async function tauri_storage_init() {
    if (!is_tauri) return;
    try {
        const { load } = window.__TAURI_PLUGIN_STORE__;
        _tauri_store = await load('config.json', { autoSave: true });
    } catch(e) {
        console.log("tauri_storage_init: " + e);
    }
}

function storage_get(name) {
    if (is_tauri && _tauri_store) {
        try { return _tauri_store.get(name); }
        catch(e) { console.log("storage_get: " + e); }
    }
    // Fallback: cookie (matches Electron's original fallback pattern)
    try { return Cookies.get(name); } catch(e) {}
    return null;
}

function storage_set(name, value) {
    if (is_tauri && _tauri_store) {
        try { _tauri_store.set(name, value); return; }
        catch(e) { console.log("storage_set: " + e); }
    }
    try { Cookies.set(name, value, { expires: 12 * 365 }); } catch(e) {}
}

// ─── Steam ticket ─────────────────────────────────────────────────────────────
// Mirrors: electron_steam_ticket() in js/functions.js:6975
// INTEGRATION: Replace electron_steam_ticket() calls in js/functions.js:6975
//   and in js/game.js:~280 (data.ticket = tauri_steam_ticket())

function tauri_steam_ticket() {
    try { return storage_get("ticket") || ""; }
    catch(e) { console.log(e); }
    return "";
}

// ─── Window data ─────────────────────────────────────────────────────────────
// Mirrors: electron_get_data() in js/functions.js:6986
//   (reads window.cdata set on BrowserWindow in Electron main.js)
// INTEGRATION: Replace electron_get_data() / window.cdata reads
// Call tauri_fetch_data() once at startup; subsequent calls use cached value.

async function tauri_fetch_data() {
    if (!is_tauri) return {};
    try {
        tauri_data = await _tinvoke('get_window_data');
        return tauri_data;
    } catch(e) {
        console.log("tauri_fetch_data: " + e);
        return {};
    }
}

function tauri_get_data() {
    return tauri_data || {};
}

// ─── Main window check ───────────────────────────────────────────────────────
// Mirrors: electron_is_main() in js/functions.js:7014
//   (checked browserWindowOptions.sideWindow in Electron)
// INTEGRATION: Replace electron_is_main() calls

async function tauri_is_main() {
    if (!is_tauri) return true;
    try {
        const label = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
        return await _tinvoke('is_main_window', { label });
    } catch(e) {
        console.log("tauri_is_main: " + e);
        return true;
    }
}

// ─── DevTools ────────────────────────────────────────────────────────────────
// Mirrors: electron_dev_tools() in js/functions.js:6924
// INTEGRATION: Replace electron_dev_tools() calls

async function tauri_dev_tools() {
    if (!is_tauri) return;
    try { await _tinvoke('open_devtools'); }
    catch(e) { console.log("tauri_dev_tools: " + e); }
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
// Mirrors: electron_fullscreen() in js/functions.js:6932
// INTEGRATION: Replace electron_fullscreen() calls

async function tauri_fullscreen(_val) {
    if (!is_tauri) return;
    // _val is ignored server-side; Rust toggles based on its own fullscreen state.
    // If you need to force a specific state, add a `set_fullscreen(val)` command.
    try { await _tinvoke('toggle_fullscreen'); }
    catch(e) { console.log("tauri_fullscreen: " + e); }
}

// ─── Screenshot ───────────────────────────────────────────────────────────────
// Mirrors: electron_screenshot() in js/functions.js:6941
// INTEGRATION: Replace electron_screenshot() calls
// Returns the file path of the saved PNG (or null on error).

async function tauri_screenshot(_opt, cb) {
    cb = cb || function() {};
    if (!is_tauri) return cb(null);
    try {
        const path = await _tinvoke('capture_screenshot');
        cb(null, path);
        return path;
    } catch(e) {
        console.log("tauri_screenshot: " + e);
        cb(e);
    }
}

// ─── Open codes folder ────────────────────────────────────────────────────────
// Mirrors: electron_open_codes() in js/functions.js:6896
// INTEGRATION: Replace electron_open_codes() calls

async function tauri_open_codes() {
    if (!is_tauri) return;
    try { await _tinvoke('open_codes_folder'); }
    catch(e) { console.log("tauri_open_codes: " + e); }
}

// ─── Reset app ────────────────────────────────────────────────────────────────
// Mirrors: electron_reset() in js/functions.js:6910
// INTEGRATION: Replace electron_reset() calls

async function tauri_reset() {
    if (!is_tauri) return;
    try { await _tinvoke('reset_app'); }
    catch(e) { console.log("tauri_reset: " + e); }
}

// ─── Code sync ───────────────────────────────────────────────────────────────
// Mirrors: electron_code_sync_logic() in js/functions.js:6788
// Starts the Rust file watcher; listens to "code-file-changed" Tauri events.
// The event payload is an array of changed file paths.
// INTEGRATION: Replace electron_code_sync_logic() calls
//   The caller should also listen to window.__TAURI__.event.listen('code-file-changed', cb)
//   to handle file change notifications (replaces electron fs.watch callbacks).

async function tauri_code_sync_logic(user_id_arg) {
    if (!is_tauri) return;
    var uid = user_id_arg || (typeof user_id !== 'undefined' ? user_id : "0");
    try {
        var root = await _tinvoke('start_code_sync', { userId: uid });
        console.log("Tauri code sync started, root: " + root);
        return root;
    } catch(e) {
        console.log("tauri_code_sync_logic: " + e);
    }
}

// ─── HTTP mode ────────────────────────────────────────────────────────────────
// Mirrors: electron_get_http_mode() in js/functions.js:7003
// INTEGRATION: Replace electron_get_http_mode() calls

async function tauri_get_http_mode() {
    if (!is_tauri) return false;
    try { return await _tinvoke('get_http_mode'); }
    catch(e) { console.log("tauri_get_http_mode: " + e); return false; }
}

// ─── Open external URL ────────────────────────────────────────────────────────
// Mirrors: shell.openExternal() in Electron
// INTEGRATION: Replace all shell.openExternal / electron external link calls

async function tauri_open_external(url) {
    if (!is_tauri) return;
    try { await _tinvoke('open_external', { url }); }
    catch(e) { console.log("tauri_open_external: " + e); }
}

// ─── Sub window ───────────────────────────────────────────────────────────────
// Mirrors: ipcRenderer.send('create_subwindow') — main.js create_subwindow()
// INTEGRATION: Replace electron ipcRenderer.send('create_subwindow') calls

async function tauri_create_subwindow() {
    if (!is_tauri) return;
    try { await _tinvoke('create_subwindow'); }
    catch(e) { console.log("tauri_create_subwindow: " + e); }
}

// Mirrors: ipcRenderer.send('show_subwindow') — sub.moveTop()
// INTEGRATION: Replace electron ipcRenderer.send('show_subwindow') calls

async function tauri_show_subwindow() {
    if (!is_tauri) return;
    try { await _tinvoke('show_subwindow'); }
    catch(e) { console.log("tauri_show_subwindow: " + e); }
}

// Mirrors: ipcRenderer.send('show_mainwindow') — main.moveTop()
// INTEGRATION: Replace electron ipcRenderer.send('show_mainwindow') calls

async function tauri_show_mainwindow() {
    if (!is_tauri) return;
    try { await _tinvoke('show_mainwindow'); }
    catch(e) { console.log("tauri_show_mainwindow: " + e); }
}

// ─── External link click handler ─────────────────────────────────────────────
// Mirrors: Electron's 'new-window' interception for anchor clicks to external URLs.
// In Tauri, navigation to external URLs is blocked by policy; we intercept clicks
// on <a target="_blank"> or non-game-domain hrefs and route through tauri_open_external.
// INTEGRATION: Call tauri_setup_external_links() after DOM is ready.

function tauri_setup_external_links() {
    if (!is_tauri) return;
    document.addEventListener('click', function(e) {
        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        // Let in-game hrefs pass; open everything else in system browser
        var isSafe = href.indexOf('adventure.land') !== -1
            || href.indexOf('thegame.com') !== -1
            || href.startsWith('/') || href.startsWith('#') || href === '';
        if (!isSafe && (href.startsWith('http') || href.startsWith('//'))) {
            e.preventDefault();
            tauri_open_external(href);
        }
    }, true);
}

// ─── Startup init ─────────────────────────────────────────────────────────────
// Call this once when the page loads (mirrors how Electron sets up on dom-ready).
// INTEGRATION: Add to window onload or DOMContentLoaded in base_script.html tauri block:
//   if(is_tauri) tauri_init();

async function tauri_init() {
    if (!is_tauri) return;
    await tauri_storage_init();
    await tauri_fetch_data();
    tauri_setup_external_links();
}
