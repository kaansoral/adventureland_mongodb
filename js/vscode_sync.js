(function () {
	"use strict";

	var statusNode = document.getElementById("vscode-token-status");
	if (!statusNode) return;
	var detailNode = document.getElementById("vscode-token-detail");
	var createNode = document.getElementById("vscode-create-token");
	var copyNode = document.getElementById("vscode-copy-token");
	var showNode = document.getElementById("vscode-show-token");
	var revokeNode = document.getElementById("vscode-revoke-token");
	var helpNode = document.getElementById("vscode-token-help");
	var secretNode = document.getElementById("vscode-token-secret");
	var errorNode = document.getElementById("vscode-token-error");
	var visibleToken = "";
	var tokenShown = false;
	var tokenActive = false;
	var tokenRecoverable = false;

	async function call(method, args) {
		var response = await fetch("/api/" + method, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(args || {}),
			cache: "no-store",
		});
		var result = await response.json();
		if (!response.ok || result.failed) throw result;
		return result;
	}

	function friendly(error) {
		var reason = (error && error.reason) || "request_failed";
		return (
			{
				not_logged_in: phrase("services.vscode_sync.your-session-ended-sign-in-again"),
				token_generation_failed: phrase("services.vscode_sync.the-token-could-not-be-created-try-again"),
				token_unavailable: phrase("services.vscode_sync.this-token-cannot-be-shown-rotate-it-to-create"),
				token_revoke_failed: phrase("services.vscode_sync.the-token-could-not-be-revoked-try-again"),
				rate_limited: phrase("services.vscode_sync.too-many-requests-wait-a-moment-and-try-again"),
			}[reason] || reason.replace(/_/g, " ")
		);
	}

	function showError(error) {
		errorNode.textContent = friendly(error);
		errorNode.style.display = "block";
	}

	function hideError() {
		errorNode.textContent = "";
		errorNode.style.display = "none";
	}

	function renderStatus(state) {
		var active = !!(state && state.active);
		tokenActive = active;
		tokenRecoverable = active && state.recoverable !== false;
		statusNode.textContent = active ? phrase("services.vscode_sync.token-active") : phrase("services.vscode_sync.no-active-token");
		if (active) {
			var created = state.created ? new Date(state.created) : null;
			detailNode.textContent =
				created && Number.isFinite(created.getTime()) ? phrase("services.vscode_sync.created-date", { date: created.toLocaleDateString(phrase.language) }) : phrase("services.vscode_sync.ready");
			if (visibleToken) helpNode.textContent = phrase("services.vscode_sync.copy-this-token-into-vs-code-use-show-token");
			else if (tokenRecoverable) helpNode.textContent = phrase("services.vscode_sync.use-show-token-to-reveal-the-active-token-then");
			else helpNode.textContent = phrase("services.vscode_sync.this-older-token-cannot-be-shown-rotate-it-to");
		} else {
			detailNode.textContent = phrase("services.vscode_sync.create-one-for-vs-code");
			helpNode.textContent = phrase("services.vscode_sync.create-a-token-and-this-page-will-show-it");
		}
		createNode.textContent = active ? phrase("services.vscode_sync.rotate-and-show-new-token") : phrase("services.vscode_sync.create-and-show-token");
		createNode.disabled = false;
		revokeNode.disabled = !active;
	}

	function maskToken(token) {
		token = String(token || "");
		if (token.length <= 4) return "";
		return token.slice(0, 4) + "*".repeat(token.length - 4);
	}

	function renderSecret() {
		if (!visibleToken) {
			secretNode.textContent = "";
			secretNode.style.display = "none";
			copyNode.style.display = "none";
			showNode.style.display = tokenActive ? "inline-block" : "none";
			showNode.disabled = !tokenRecoverable;
			showNode.textContent = phrase("services.vscode_sync.show-token");
			return;
		}
		secretNode.textContent = tokenShown ? visibleToken : maskToken(visibleToken);
		secretNode.style.display = "block";
		copyNode.style.display = "inline-block";
		showNode.style.display = "inline-block";
		showNode.disabled = false;
		showNode.textContent = tokenShown ? phrase("services.vscode_sync.hide-token") : phrase("services.vscode_sync.show-token");
	}

	async function refreshStatus() {
		try {
			renderStatus(await call("token_status"));
			renderSecret();
			hideError();
		} catch (error) {
			statusNode.textContent = phrase("services.vscode_sync.token-status-unavailable");
			detailNode.textContent = "";
			showError(error);
		}
	}

	createNode.onclick = async function () {
		var rotating = tokenActive;
		if (rotating && !window.confirm(phrase("services.vscode_sync.rotate-your-adventure-land-token-the-current-vs-code"))) return;
		createNode.disabled = true;
		try {
			var result = await call("generate_token");
			visibleToken = result.token;
			tokenShown = false;
			renderSecret();
			renderStatus({ active: true, created: new Date().toISOString() });
			hideError();
		} catch (error) {
			showError(error);
		} finally {
			createNode.disabled = false;
		}
	};

	copyNode.onclick = async function () {
		if (!visibleToken) return;
		try {
			await navigator.clipboard.writeText(visibleToken);
			copyNode.textContent = phrase("services.vscode_sync.copied");
			setTimeout(function () {
				copyNode.textContent = phrase("services.vscode_sync.copy-token");
			}, 1500);
		} catch (error) {
			showError({ reason: phrase("services.vscode_sync.copy-failed-select-the-token-and-copy-it-manually") });
		}
	};

	showNode.onclick = async function () {
		if (!visibleToken) {
			if (!tokenActive || !tokenRecoverable) return;
			showNode.disabled = true;
			try {
				var result = await call("reveal_token");
				visibleToken = result.token;
				tokenShown = true;
				renderStatus({ active: true, recoverable: true });
				renderSecret();
				hideError();
			} catch (error) {
				showError(error);
				renderSecret();
			}
			return;
		}
		tokenShown = !tokenShown;
		renderSecret();
	};

	revokeNode.onclick = async function () {
		if (!window.confirm(phrase("services.vscode_sync.revoke-your-adventure-land-token-vs-code-uploads-will"))) return;
		revokeNode.disabled = true;
		try {
			await call("revoke_token");
			visibleToken = "";
			tokenShown = false;
			tokenActive = false;
			tokenRecoverable = false;
			secretNode.textContent = "";
			secretNode.style.display = "none";
			copyNode.style.display = "none";
			showNode.style.display = "none";
			renderStatus({ active: false });
			hideError();
		} catch (error) {
			showError(error);
		} finally {
			revokeNode.disabled = false;
		}
	};

	refreshStatus();
})();
