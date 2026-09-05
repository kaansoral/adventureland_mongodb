"use strict";

const NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=777150&count=1&maxlength=0&feeds=steam_community_announcements";
const NEWS_PAGE = "https://store.steampowered.com/news/app/777150";

function escape_html(value) {
	return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function safe_url(value, image = false) {
	try {
		const url = new URL(
			value
				.trim()
				.replace(/^['"]|['"]$/g, "")
				.replace("{STEAM_CLAN_IMAGE}", "https://clan.akamai.steamstatic.com/images"),
		);
		if (url.protocol !== "https:" || url.username || url.password) return "";
		if (image && !/(^|\.)(steamstatic\.com|steamcommunity\.com|steamusercontent\.com|akamaihd\.net)$/.test(url.hostname)) return "";
		return escape_html(url.href);
	} catch (_) {
		return "";
	}
}

// Only these BBCode tags can become markup. All other source text is escaped.
function render_contents(source) {
	const tags = { p: "p", h1: "h2", h2: "h2", h3: "h3", b: "strong", i: "em", u: "u", list: "ul", olist: "ol", "*": "li", quote: "blockquote", code: "pre" };
	const tokens = /\[img(?:\s+src=("[^"]*"|'[^']*'|[^\]]+))?\]([\s\S]*?)\[\/img\]|\[(\/)?(p|h1|h2|h3|b|i|u|list|olist|\*|quote|code|url)(?:=([^\]]*))?\]/gi;
	let html = "",
		offset = 0;
	const stack = [];
	for (const match of source.matchAll(tokens)) {
		html += escape_html(source.slice(offset, match.index));
		offset = match.index + match[0].length;
		if (match[2] !== undefined) {
			const src = safe_url(match[1] || match[2], true);
			if (src) html += '<img src="' + src + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
			continue;
		}
		const name = match[4].toLowerCase();
		if (match[3]) {
			const index = stack.map((tag) => tag.name).lastIndexOf(name);
			if (index !== -1) while (stack.length > index) html += "</" + stack.pop().tag + ">";
		} else {
			if (name === "*" && stack.length && stack[stack.length - 1].name === "*") html += "</" + stack.pop().tag + ">";
			const href = name === "url" && safe_url(match[5] || "");
			const tag = name === "url" ? (href ? "a" : "span") : tags[name];
			html += "<" + tag + (href ? ' href="' + href + '" target="_blank" rel="noopener noreferrer" class="eexternal"' : "") + ">";
			stack.push({ name, tag });
		}
	}
	return (
		html +
		escape_html(source.slice(offset)) +
		stack
			.reverse()
			.map(({ tag }) => "</" + tag + ">")
			.join("")
	);
}

function create_news_loader(fetch_news = fetch, now = Date.now) {
	let cached = null,
		expires = 0,
		pending = null;
	return async function latest_news() {
		if (now() < expires) return cached;
		if (pending) return pending;
		pending = (async () => {
			try {
				const response = await fetch_news(NEWS_URL, { signal: AbortSignal.timeout(6000) });
				if (!response.ok) throw new Error("Steam news unavailable");
				const data = await response.json();
				const post = data.appnews && data.appnews.newsitems && data.appnews.newsitems[0];
				if (
					!post ||
					post.appid !== 777150 ||
					post.feedname !== "steam_community_announcements" ||
					typeof post.title !== "string" ||
					typeof post.contents !== "string" ||
					!post.contents.trim() ||
					post.contents.length > 200000 ||
					!Number.isFinite(post.date)
				)
					throw new Error("Invalid Steam post");
				cached = { title: post.title, date: post.date, url: safe_url(post.url || "") || NEWS_PAGE, html: render_contents(post.contents) };
				expires = now() + 10 * 60 * 1000;
			} catch (_) {
				// Keep the last good post during outages and back off even on a cold cache.
				expires = now() + 60 * 1000;
			}
			return cached;
		})();
		try {
			return await pending;
		} finally {
			pending = null;
		}
	};
}

module.exports = { create_news_loader, render_contents };
