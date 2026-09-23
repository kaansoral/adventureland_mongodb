const crypto = require("node:crypto");

const ENDPOINT = "https://steamcommunity.com/openid/login";
const NAMESPACE = "http://specs.openid.net/auth/2.0";
const COOKIE = "al_steam_signup";
const LIFETIME = 20 * 60 * 1000;

// Steam-only OpenID verification: fixed provider, direct signature verification,
// browser-bound state and a one-use grant consumed by the signup transaction.
function create_steam_signup({ key, get_user, render, signup, purify_email, local_origin, request = fetch, now = Date.now }) {
	const attempts = new Map();
	function origin(req) {
		const host = req.get("host");
		if (["adventure.land", "www.adventure.land", "cloudflare.adventure.land"].includes(host)) return "https://" + host;
		if (local_origin && host === new URL(local_origin).host) return new URL(local_origin).origin;
		throw new Error("invalid_origin");
	}
	function mac(value) {
		if (!key()) throw new Error("unavailable");
		return crypto
			.createHmac("sha256", key())
			.update("adventure-land-steam-signup\0" + value)
			.digest("hex");
	}
	function read(req) {
		try {
			const token = req.cookies && req.cookies[COOKIE];
			if (typeof token !== "string" || token.length > 2048) return null;
			const [payload, signature, extra] = token.split(".");
			if (extra || !/^[0-9a-f]{64}$/.test(signature || "")) return null;
			if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(mac(payload), "hex"))) return null;
			const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
			if (state.origin !== origin(req) || !/^[0-9a-f]{64}$/.test(state.id) || !Number.isFinite(state.time)) return null;
			if (now() - state.time >= LIFETIME || state.time > now() + 60000) return null;
			if (state.steamid !== undefined && (typeof state.steamid !== "string" || !/^[0-9]{16,20}$/.test(state.steamid))) return null;
			return state;
		} catch (_) {
			return null;
		}
	}
	function cookie_options(req) {
		return { httpOnly: true, secure: origin(req).startsWith("https:"), sameSite: "lax", path: "/steam-signup", maxAge: LIFETIME };
	}
	function save(req, res, state) {
		const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
		res.cookie(COOKIE, payload + "." + mac(payload), cookie_options(req));
	}
	function limited(req) {
		const time = now();
		for (const [ip, entry] of attempts) if (entry.until <= time) attempts.delete(ip);
		const ip = req.ip || req.socket.remoteAddress;
		let entry = attempts.get(ip);
		if (!entry) {
			if (attempts.size >= 4096) return true;
			entry = { count: 0, until: time + 5 * 60 * 1000 };
			attempts.set(ip, entry);
		}
		return ++entry.count > 20;
	}
	async function steam_request(url, options = {}) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		try {
			const response = await request(url, { ...options, redirect: "error", signal: controller.signal });
			if (!response.ok) throw new Error("unavailable");
			const text = await response.text();
			if (text.length > 65536) throw new Error("unavailable");
			return text;
		} catch (_) {
			// Never propagate request URLs, publisher keys or Steam response bodies.
			throw new Error("unavailable");
		} finally {
			clearTimeout(timeout);
		}
	}
	async function ownership(steamid) {
		const query = new URLSearchParams({ key: key(), appid: "777150", steamid });
		let result;
		try {
			result = JSON.parse(await steam_request("https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v4/?" + query));
		} catch (_) {
			throw new Error("unavailable");
		}
		if (!result || !result.appownership || typeof result.appownership.ownsapp !== "boolean") throw new Error("unavailable");
		if (!result.appownership.ownsapp || result.appownership.usercanceled === true) throw new Error("not_owned");
	}
	function callback_url(state) {
		return state.origin + "/steam-signup/callback?state=" + state.id;
	}
	function guard(action) {
		return async (req, res, next) => {
			// Keep the form's Origin header; no-referrer makes browsers send Origin: null.
			res.set({ "Cache-Control": "no-store", "Referrer-Policy": "strict-origin", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex" });
			try {
				origin(req);
				if (await get_user(req)) return res.redirect(303, "/");
				if (!key()) throw new Error("unavailable");
				if (req.method === "POST" && req.get("origin") !== origin(req)) throw new Error("failed");
				await action(req, res);
			} catch (error) {
				const reason = ["not_owned", "unavailable"].includes(error.message) ? error.message : "failed";
				res.status(reason === "unavailable" ? 503 : 400);
				try {
					await render(req, res, { error: "pages.steam_signup." + reason });
				} catch (_) {
					// Express 4 does not catch rejected async handlers. Keep its final
					// error handler free of request URLs, credentials and Steam bodies.
					next(new Error("Steam signup unavailable"));
				}
			}
		};
	}
	return {
		page: guard(async (req, res) => {
			let state = read(req);
			if (!state) state = { id: crypto.randomBytes(32).toString("hex"), time: now(), origin: origin(req) };
			save(req, res, state);
			await render(req, res, { state: state.id, verified: !!state.steamid });
		}),
		start: guard(async (req, res) => {
			const state = read(req);
			if (!state || req.body.state !== state.id) throw new Error("failed");
			if (limited(req)) throw new Error("unavailable");
			const next = { id: crypto.randomBytes(32).toString("hex"), time: now(), origin: origin(req) };
			save(req, res, next);
			const query = new URLSearchParams({
				"openid.ns": NAMESPACE,
				"openid.mode": "checkid_setup",
				"openid.return_to": callback_url(next),
				"openid.realm": next.origin + "/",
				"openid.identity": NAMESPACE + "/identifier_select",
				"openid.claimed_id": NAMESPACE + "/identifier_select",
			});
			res.redirect(303, ENDPOINT + "?" + query);
		}),
		callback: guard(async (req, res) => {
			const state = read(req),
				query = new URL(req.originalUrl, origin(req)).searchParams;
			if (!state || state.steamid || query.get("state") !== state.id || limited(req)) throw new Error("failed");
			const names = [...query.keys()];
			if (new Set(names).size !== names.length || names.length > 20 || req.originalUrl.length > 8192) throw new Error("failed");
			if (query.get("openid.ns") !== NAMESPACE || query.get("openid.mode") !== "id_res" || query.get("openid.op_endpoint") !== ENDPOINT) throw new Error("failed");
			if (query.get("openid.return_to") !== callback_url(state)) throw new Error("failed");
			const identity = query.get("openid.claimed_id") || "";
			const match = /^https?:\/\/steamcommunity\.com\/openid\/id\/([0-9]{16,20})$/.exec(identity);
			if (!match || query.get("openid.identity") !== identity) throw new Error("failed");
			const signed = (query.get("openid.signed") || "").split(",");
			if (!["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"].every((name) => signed.includes(name))) throw new Error("failed");
			const nonce = query.get("openid.response_nonce") || "";
			const time = Date.parse(nonce.slice(0, 20));
			if (nonce.length > 255 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z[!-~]+$/.test(nonce) || !Number.isFinite(time) || now() - time >= LIFETIME || time > now() + 60000) throw new Error("failed");
			const body = new URLSearchParams([...query].filter(([name]) => name.startsWith("openid.")));
			body.set("openid.mode", "check_authentication");
			const checked = await steam_request(ENDPOINT, { method: "POST", body });
			const lines = checked.trim().split(/\r?\n/);
			if (lines.filter((line) => line === "is_valid:true").length !== 1 || lines.some((line) => line.startsWith("is_valid:") && line !== "is_valid:true")) throw new Error("failed");
			await ownership(match[1]);
			// Bind the verified identity to this browser, never a client-supplied pid.
			save(req, res, { ...state, steamid: match[1] });
			res.redirect(303, "/steam-signup");
		}),
		complete: guard(async (req, res) => {
			const state = read(req);
			if (!state || !state.steamid || req.body.state !== state.id) throw new Error("failed");
			let email;
			try {
				if (typeof req.body.email !== "string" || req.body.email.length > 254) throw new Error();
				email = purify_email(req.body.email);
				if (typeof req.body.password !== "string" || req.body.password.length < 1 || req.body.password.length > 1024) throw new Error();
			} catch (_) {
				return render(req, res, { state: state.id, verified: true, error: "error.invalid_field" });
			}
			if (limited(req)) throw new Error("unavailable");
			await ownership(state.steamid);
			const result = await signup({ req, res, email, password: req.body.password, only_signup: true }, { id: state.id, steamid: state.steamid });
			if (!result.success) {
				const reason = ["already_signed_up", "email_exists", "too_many_signups_from_ip_wait", "invalid_field"].includes(result.reason) ? "error." + result.reason : "pages.steam_signup.failed";
				return render(req, res, { state: state.id, verified: true, error: reason });
			}
			const clear_options = cookie_options(req);
			delete clear_options.maxAge;
			res.clearCookie(COOKIE, clear_options);
			res.redirect(303, "/");
		}),
	};
}

module.exports = { create_steam_signup };
