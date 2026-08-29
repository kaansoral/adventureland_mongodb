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
		return {
			not_logged_in: "Your session ended. Sign in again.",
			token_generation_failed: "The token could not be created. Try again.",
			token_unavailable: "This token cannot be shown. Rotate it to create a visible replacement.",
			token_revoke_failed: "The token could not be revoked. Try again.",
			rate_limited: "Too many requests. Wait a moment and try again.",
		}[reason] || reason.replace(/_/g, " ");
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
		statusNode.textContent = active ? "Token active" : "No active token";
		if (active) {
			var created = state.created ? new Date(state.created) : null;
			detailNode.textContent = created && Number.isFinite(created.getTime()) ? "Created " + created.toLocaleDateString() : "Ready";
			if (visibleToken) helpNode.textContent = "Copy this token into VS Code. Use Show token to reveal the characters.";
			else if (tokenRecoverable) helpNode.textContent = "Use Show token to reveal the active token, then paste it into VS Code.";
			else helpNode.textContent = "This older token cannot be shown. Rotate it to create a visible replacement.";
		} else {
			detailNode.textContent = "Create one for VS Code";
			helpNode.textContent = "Create a token and this page will show it immediately.";
		}
		createNode.textContent = active ? "Rotate and show new token" : "Create and show token";
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
			showNode.textContent = "Show token";
			return;
		}
		secretNode.textContent = tokenShown ? visibleToken : maskToken(visibleToken);
		secretNode.style.display = "block";
		copyNode.style.display = "inline-block";
		showNode.style.display = "inline-block";
		showNode.disabled = false;
		showNode.textContent = tokenShown ? "Hide token" : "Show token";
	}

	async function refreshStatus() {
		try {
			renderStatus(await call("token_status"));
			renderSecret();
			hideError();
		} catch (error) {
			statusNode.textContent = "Token status unavailable";
			detailNode.textContent = "";
			showError(error);
		}
	}

	createNode.onclick = async function () {
		var rotating = tokenActive;
		if (rotating && !window.confirm("Rotate your Adventure Land token? The current VS Code token will stop working immediately.")) return;
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
			copyNode.textContent = "Copied";
			setTimeout(function () {
				copyNode.textContent = "Copy token";
			}, 1500);
		} catch (error) {
			showError({ reason: "Copy failed. Select the token and copy it manually." });
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
		if (!window.confirm("Revoke your Adventure Land token? VS Code uploads will stop until you set a new token.")) return;
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
