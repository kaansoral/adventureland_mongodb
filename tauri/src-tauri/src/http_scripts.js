// Runs at document start in every game frame; no matching website deployment needed.
(function () {
    "use strict";
    if (location.protocol !== "https:" ||
        !(location.hostname === "adventure.land" || location.hostname.endsWith(".adventure.land")) ||
        location.pathname !== "/runner") return;

    var active = true;
    window.addEventListener("pagehide", function () { active = false; }, { once: true });

    function install() {
        var $ = window.jQuery;
        var core = window.__TAURI__ && window.__TAURI__.core;
        // Tauri may inject its public API only in the top-level document.
        if (!core) {
            try { core = parent.__TAURI__ && parent.__TAURI__.core; } catch (_) { return; }
        }
        if (!$ || !core || !core.invoke) return;
        $.ajaxTransport("+script", function (options) {
            if (options.type !== "GET" || new URL(options.url, location.href).protocol !== "http:") return;
            var stopped = false;
            return {
                send: function (_, complete) {
                    // Catch synchronous bridge failures as well as rejected IPC promises.
                    Promise.resolve().then(function () {
                        return core.invoke("fetch_http_script", { url: new URL(options.url, location.href).href });
                    }).then(function (response) {
                        if (stopped || !active) return;
                        stopped = true;
                        var ok = response.status >= 200 && response.status < 300;
                        // jQuery 3.2 also converts failed responses: never supply their text.
                        complete(response.status, response.statusText,
                            ok ? { text: response.text } : {}, response.headers);
                    }, function (error) {
                        if (stopped || !active) return;
                        stopped = true;
                        complete(0, String(error));
                    }).catch(function (error) {
                        // Match script-tag errors without creating an unhandled promise rejection.
                        setTimeout(function () { throw error; }, 0);
                    });
                },
                abort: function () { stopped = true; }
            };
        });
    }
    // Capture runs before the runner's DOMContentLoaded handler starts user code.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { capture: true, once: true });
    } else {
        install();
    }
}());
