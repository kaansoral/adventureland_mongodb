const crypto = require("node:crypto");

const ENDPOINT = "https://steamcommunity.com/openid/login";
const NAMESPACE = "http://specs.openid.net/auth/2.0";
const COOKIE = "al_steam_signup";
const LIFETIME = 20 * 60 * 1000;

// Shared fixed-provider verifier. Identity is accepted only from Steam's signed response.
function create_steam_verifier({ key, local_origin, request = fetch, now = Date.now }) {
	function origin(req) {
		const host = req.get("host");
		if (["adventure.land", "www.adventure.land", "cloudflare.adventure.land"].includes(host)) return "https://" + host;
		if (local_origin && host === new URL(local_origin).host) return new URL(local_origin).origin;
		throw new Error("failed");
	}
	async function steam_request(url, options = {}) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		try {
			const response = await request(url, { ...options, redirect: "error", signal: controller.signal });
			if (!response.ok) throw new Error();
			let text = "";
			if (response.body && response.body.getReader) {
				const reader = response.body.getReader(),
					chunks = [];
				let size = 0;
				try {
					for (;;) {
						const part = await reader.read();
						if (part.done) break;
						size += part.value.byteLength;
						if (size > 65536) {
							controller.abort();
							throw new Error();
						}
						chunks.push(Buffer.from(part.value));
					}
					text = Buffer.concat(chunks).toString("utf8");
				} finally {
					reader.releaseLock();
				}
			} else text = await response.text();
			if (Buffer.byteLength(text) > 65536) throw new Error();
			return text;
		} catch (_) {
			throw new Error("unavailable");
		} finally {
			clearTimeout(timeout);
		}
	}
	async function ownership(steamid) {
		if (!key()) throw new Error("unavailable");
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
	function start(return_to, realm) {
		return (
			ENDPOINT +
			"?" +
			new URLSearchParams({
				"openid.ns": NAMESPACE,
				"openid.mode": "checkid_setup",
				"openid.return_to": return_to,
				"openid.realm": realm + "/",
				"openid.identity": NAMESPACE + "/identifier_select",
				"openid.claimed_id": NAMESPACE + "/identifier_select",
			})
		);
	}
	async function verify(req, return_to, lifetime = LIFETIME) {
		const query = new URL(req.originalUrl, origin(req)).searchParams,
			names = [...query.keys()];
		if (new Set(names).size !== names.length || names.length > 20 || req.originalUrl.length > 8192) throw new Error("failed");
		if (query.get("openid.ns") !== NAMESPACE || query.get("openid.mode") !== "id_res" || query.get("openid.op_endpoint") !== ENDPOINT || query.get("openid.return_to") !== return_to)
			throw new Error("failed");
		const identity = query.get("openid.claimed_id") || "",
			match = /^https?:\/\/steamcommunity\.com\/openid\/id\/([0-9]{16,20})$/.exec(identity);
		if (!match || query.get("openid.identity") !== identity) throw new Error("failed");
		const signed = (query.get("openid.signed") || "").split(",");
		if (!["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"].every((name) => signed.includes(name))) throw new Error("failed");
		const nonce = query.get("openid.response_nonce") || "",
			time = Date.parse(nonce.slice(0, 20));
		if (nonce.length > 255 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z[!-~]+$/.test(nonce) || !Number.isFinite(time) || now() - time >= lifetime || time > now() + 60000) throw new Error("failed");
		const body = new URLSearchParams([...query].filter(([name]) => name.startsWith("openid.")));
		body.set("openid.mode", "check_authentication");
		const lines = (await steam_request(ENDPOINT, { method: "POST", body })).trim().split(/\r?\n/);
		const fields = lines.map((line) => line.slice(0, line.indexOf(":")));
		if (
			new Set(fields).size !== fields.length ||
			fields.some((field) => !["ns", "is_valid", "invalidate_handle"].includes(field)) ||
			!lines.includes("ns:" + NAMESPACE) ||
			!lines.includes("is_valid:true")
		)
			throw new Error("failed");
		return { steamid: match[1], nonce };
	}
	return { origin, ownership, start, verify };
}

// Steam-only OpenID verification: fixed provider, direct signature verification,
// browser-bound state and a one-use grant consumed by the signup transaction.
function create_steam_signup({ key, get_user, render, signup, purify_email, local_origin, request = fetch, now = Date.now }) {
	const verifier = create_steam_verifier({ key, local_origin, request, now });
	const attempts = new Map();
	const origin = verifier.origin;
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
	const ownership = verifier.ownership;
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
			res.redirect(303, verifier.start(callback_url(next), next.origin));
		}),
		callback: guard(async (req, res) => {
			const state = read(req),
				query = new URL(req.originalUrl, origin(req)).searchParams;
			if (!state || state.steamid || query.get("state") !== state.id || limited(req)) throw new Error("failed");
			const checked = await verifier.verify(req, callback_url(state));
			await ownership(checked.steamid);
			save(req, res, { ...state, steamid: checked.steamid });
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

module.exports = { create_steam_signup, create_steam_verifier };
