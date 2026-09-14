const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { JSDOM } = require("jsdom");
const path = require("node:path");
const init = readFileSync(path.join(__dirname, "../src-tauri/src/http_scripts.js"), "utf8");

function runner(invoke, version = "3.2.0", url = "https://adventure.land/runner") {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url, runScripts: "dangerously" });
    const w = dom.window;
    w.__TAURI__ = { core: { invoke } };
    w.eval(init);
    w.eval(readFileSync(path.join(__dirname, `../../js/jquery/jquery-${version}.min.js`), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    return w;
}
const success = { status: 200, statusText: "OK", text: "window.loaded = (window.loaded || 0) + 1;", headers: "x-test: yes\r\n" };
const done = request => new Promise((resolve, reject) => request.done((data, status, xhr) => resolve({ data, status, xhr })).fail((xhr, status, error) => reject(new Error(String(error)))));
const fail = request => new Promise(resolve => request.fail((xhr, status, error) => resolve({ xhr, status, error })));

for (const version of ["2.2.3", "2.2.4", "3.1.0", "3.2.0"]) {
    test(`getScript callbacks, cache busting and runner execution: jQuery ${version}`, async () => {
        const calls = [];
        const w = runner((command, args) => { calls.push({ command, args }); return Promise.resolve(success); }, version);
        let callbacks = 0;
        const request = w.$.getScript("http://127.0.0.1:7106/any/path.js?x=1", () => callbacks++);
        const result = await done(request);
        assert.equal(w.loaded, 1);
        assert.equal(callbacks, 1);
        assert.equal(result.xhr, request);
        assert.equal(request.getResponseHeader("x-test"), "yes");
        assert.equal(calls[0].command, "fetch_http_script");
        const url = new URL(calls[0].args.url);
        assert.equal(url.searchParams.get("x"), "1");
        assert.ok(url.searchParams.has("_"));
        w.close();
    });
}

test("HTTP errors never evaluate their bodies with old jQuery", async () => {
    for (const status of [404, 500]) {
        const w = runner(() => Promise.resolve({ ...success, status, statusText: "Failed" }));
        const result = await fail(w.$.getScript("http://example.com/error.js"));
        assert.equal(result.xhr.status, status);
        assert.equal(w.loaded, undefined);
        w.close();
    }
});

test("native rejection and synchronous throws settle fail callbacks", async () => {
    for (const invoke of [() => Promise.reject("connection refused"), () => { throw new Error("bridge failure"); }]) {
        const w = runner(invoke);
        const result = await fail(w.$.getScript("http://localhost/a.js"));
        assert.equal(result.xhr.status, 0);
        assert.equal(w.loaded, undefined);
        w.close();
    }
});

test("abort and jQuery timeout suppress late execution and success callbacks", async () => {
    for (const timeout of [false, true]) {
        let resolve;
        const w = runner(() => new Promise(r => { resolve = r; }));
        let callbacks = 0;
        const request = w.$.ajax({ url: "http://localhost/a.js", dataType: "script", timeout: timeout ? 5 : 0 }).done(() => callbacks++);
        const failed = fail(request);
        await Promise.resolve();
        if (!timeout) request.abort();
        assert.equal((await failed).status, timeout ? "timeout" : "abort");
        resolve(success);
        await new Promise(r => setTimeout(r, 10));
        assert.equal(w.loaded, undefined);
        assert.equal(callbacks, 0);
        w.close();
    }
});

test("independent and recreated runners execute only their own script", async () => {
    const a = runner(() => Promise.resolve(success));
    const b = runner(() => Promise.resolve(success), "3.2.0", "https://eu.adventure.land/runner");
    await done(a.$.getScript("http://192.168.1.223/a.js"));
    assert.equal(a.loaded, 1);
    assert.equal(b.loaded, undefined);
    a.close();
    await done(b.$.getScript("http://remote.example/b.js"));
    assert.equal(b.loaded, 1);
    b.close();
});

test("HTTPS retains browser transport", () => {
    let calls = 0;
    const w = runner(() => { calls++; });
    const request = w.$.getScript("https://example.com/a.js");
    assert.ok(w.document.querySelector('script[src^="https://example.com/a.js"]'));
    request.abort();
    assert.equal(calls, 0);
    w.close();
});

test("untrusted origins and non-runner pages do not install the native transport", () => {
    for (const url of ["https://adventure.land.example.com/runner", "http://adventure.land/runner", "https://adventure.land/game"]) {
        let calls = 0;
        const w = runner(() => { calls++; }, "3.2.0", url);
        const request = w.$.getScript("http://example.com/a.js");
        assert.ok(w.document.querySelector('script[src^="http://example.com/a.js"]'));
        request.abort();
        assert.equal(calls, 0);
        w.close();
    }
});

test("runner teardown suppresses late native responses", async () => {
    let resolve;
    const w = runner(() => new Promise(r => { resolve = r; }));
    w.$.getScript("http://localhost/a.js");
    await Promise.resolve();
    w.dispatchEvent(new w.Event("pagehide"));
    resolve(success);
    await new Promise(r => setTimeout(r, 10));
    assert.equal(w.loaded, undefined);
    w.close();
});

test("capture initializer runs before runner user code and uses parent bridge", async () => {
    const dom = new JSDOM("<!doctype html><html><head></head></html>", { url: "https://adventure.land/runner", runScripts: "dangerously" });
    const w = dom.window;
    Object.defineProperty(w, "parent", { value: { __TAURI__: { core: { invoke: () => Promise.resolve(success) } } } });
    w.eval(init);
    w.eval(readFileSync(path.join(__dirname, "../../js/jquery/jquery-3.2.0.min.js"), "utf8"));
    let request;
    w.document.addEventListener("DOMContentLoaded", () => {
        request = w.$.getScript("http://localhost/a.js");
    }, { once: true });
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    await done(request);
    assert.equal(w.loaded, 1);
    w.close();
});
