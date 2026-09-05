"use strict";

window.SteamNews = (function () {
	var banner, dialog, request, timer;
	var stopped = false;
	var news_page = "https://store.steampowered.com/news/app/777150";

	function stop_confetti() {
		clearTimeout(timer);
		document.removeEventListener("visibilitychange", stop_confetti);
		if (banner) {
			var confetti = banner.querySelector(".steam-news-confetti");
			if (confetti) confetti.remove();
		}
	}

	function close() {
		if (request) request.abort();
		request = null;
		if (dialog) {
			var previous = dialog;
			dialog = null;
			previous.close();
			previous.remove();
		}
	}

	function stop() {
		stopped = true;
		stop_confetti();
		close();
		if (banner) banner.remove();
		banner = null;
		window.removeEventListener("pagehide", stop);
	}

	function show() {
		if (stopped || window.no_html || window.character || window.inside === "game" || dialog) return;
		stop_confetti();
		dialog = document.createElement("dialog");
		dialog.className = "steam-news-dialog";
		dialog.setAttribute("aria-labelledby", "steam-news-title");
		dialog.innerHTML =
			'<div class="steam-news-toolbar"><span>NEWS FROM STEAM</span><button type="button" class="gamebutton steam-news-close" aria-label="Close Steam post">X</button></div><article class="steam-news-article"><h1 id="steam-news-title">Latest Update</h1><div class="steam-news-body" aria-live="polite">Loading the latest post...</div></article><footer><a class="gamebutton eexternal" href="' +
			news_page +
			'" target="_blank" rel="noopener noreferrer">Read on Steam &gt;</a></footer>';
		var current = dialog;
		current.querySelector("button").addEventListener("click", close);
		current.addEventListener("close", function () {
			if (dialog === current) close();
		});
		current.addEventListener("click", function (event) {
			if (event.target === current) close();
		});
		current.addEventListener("keydown", function (event) {
			event.stopPropagation();
		});
		document.body.appendChild(current);
		current.showModal();
		request = $.ajax({ url: "/steam-news", dataType: "json", timeout: 8500 })
			.done(function (post) {
				if (stopped || dialog !== current) return;
				current.querySelector("h1").textContent = post.title;
				var body = current.querySelector(".steam-news-body");
				body.innerHTML = post.html;
				var date = document.createElement("p");
				date.className = "steam-news-date";
				date.textContent = new Date(post.date * 1000).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
				body.before(date);
				current.querySelector("footer a").href = post.url;
			})
			.fail(function (_, status) {
				if (status !== "abort" && dialog === current) current.querySelector(".steam-news-body").textContent = "The post couldn't load. You can still read it on Steam below.";
			});
	}

	function init() {
		if (stopped || banner || window.no_html || window.character || window.inside === "game") return;
		banner = document.getElementById("steam-news-banner");
		if (!banner) return;
		banner.hidden = false;
		banner.querySelector("button").addEventListener("click", show);
		window.addEventListener("pagehide", stop);
		if (window.no_graphics || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		var confetti = document.createElement("div");
		confetti.className = "steam-news-confetti";
		confetti.setAttribute("aria-hidden", "true");
		var colors = ["#F4CA64", "#69D6CF", "#BA91EC", "#EE829B", "#A7D978"];
		for (var i = 0; i < 18; i++) {
			var piece = document.createElement("i");
			piece.style.left = 8 + i * 18 + "px";
			piece.style.backgroundColor = colors[i % colors.length];
			piece.style.animationDelay = -(i % 6) * 0.4 + "s";
			confetti.appendChild(piece);
		}
		banner.appendChild(confetti);
		document.addEventListener("visibilitychange", stop_confetti);
		timer = setTimeout(stop_confetti, 10000);
	}

	return { init: init, show: show, stop: stop };
})();
