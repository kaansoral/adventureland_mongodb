"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const vscode = require("vscode");

const TOKEN_KEY = "adventureland.apiToken";
const SYNC_ROOT_KEY = "adventureland.syncRoot";
const DEFAULT_API_BASE_URL = "https://adventure.land/mcp_api";
const TOKEN_PATTERN = /mcp_[A-Za-z0-9_-]{43}/;
const SLOT_PATTERN = /^[A-Za-z0-9_.+ -]{1,100}$/;
const CODE_EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);
const SYNC_CODE_EXTENSIONS = new Set([".js"]);
const MANAGED_FOLDER = "adventureland";
const CODES_FOLDER = "codes";
const CHARACTERS_FOLDER = "characters";
const LIBRARIES_FOLDER = "libraries";
const HISTORY_FOLDER = "history";
const CLASH_FOLDER = "clash";
const METADATA_FILE = ".sync.json";
const USER_AGENT = "adventure-land-code-sync/0.2.0";

let output;
let statusBar;
let syncTimer = null;
let syncRoot = "";
let syncRunning = false;
const activeUploads = new Set();

function config() {
	return vscode.workspace.getConfiguration("adventureland");
}

function apiBaseUrl() {
	return String(config().get("apiBaseUrl") || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function apiUrl(method) {
	return apiBaseUrl() + "/" + encodeURIComponent(method);
}

function tokenFromText(value) {
	const match = String(value || "").match(TOKEN_PATTERN);
	return match ? match[0] : "";
}

function codeByteLength(code) {
	return Buffer.byteLength(code, "utf8");
}

function sha256(value) {
	return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFilePart(value, fallback) {
	const cleaned = String(value || "")
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^\.+/, "")
		.slice(0, 80);
	return cleaned || fallback;
}

function sortableCodes(codes) {
	return (codes || []).slice().sort((left, right) => String(left.slot).localeCompare(String(right.slot), undefined, { numeric: true }));
}

function isNumberedCodeSlot(slot) {
	const text = String(slot || "");
	if (!/^\d+$/.test(text)) return false;
	const num = parseInt(text, 10);
	return 1 <= num && num <= 100;
}

function normalizeSyncRoot(filePath) {
	const selected = path.resolve(filePath);
	return path.basename(selected).toLowerCase() === MANAGED_FOLDER ? path.dirname(selected) : selected;
}

function managedRoot(root) {
	return path.join(root, MANAGED_FOLDER);
}

function metadataPath(root) {
	return path.join(managedRoot(root), METADATA_FILE);
}

function syncFolders(root) {
	const managed = managedRoot(root);
	return {
		root,
		managed,
		codes: path.join(managed, CODES_FOLDER),
		characters: path.join(managed, CHARACTERS_FOLDER),
		libraries: path.join(managed, LIBRARIES_FOLDER),
		history: path.join(root, HISTORY_FOLDER),
		clash: path.join(managed, CLASH_FOLDER),
	};
}

function targetRelativePath(target) {
	const folder = isNumberedCodeSlot(target.slot) ? CODES_FOLDER : CHARACTERS_FOLDER;
	return path.posix.join(MANAGED_FOLDER, folder, safeFilePart(target.name, "code") + "." + safeFilePart(target.slot, "slot") + ".js");
}

function relativePath(root, absoluteFile) {
	return path.relative(root, absoluteFile).split(path.sep).join("/");
}

function absolutePath(root, relativeFile) {
	return path.join(root, ...String(relativeFile || "").split("/"));
}

async function fileExists(file) {
	try {
		await fs.access(file);
		return true;
	} catch (error) {
		return false;
	}
}

async function readTextFile(file) {
	return fs.readFile(file, "utf8");
}

async function writeTextFile(file, text) {
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, text, "utf8");
}

async function readFileHash(file) {
	return sha256(await readTextFile(file));
}

async function removeFile(file) {
	await fs.unlink(file).catch(() => {});
}

async function ensureSyncFolders(root) {
	const folders = syncFolders(root);
	await Promise.all([
		fs.mkdir(folders.codes, { recursive: true }),
		fs.mkdir(folders.characters, { recursive: true }),
		fs.mkdir(folders.libraries, { recursive: true }),
		fs.mkdir(folders.history, { recursive: true }),
		fs.mkdir(folders.clash, { recursive: true }),
	]);
}

async function readMetadata(root) {
	try {
		const data = JSON.parse(await readTextFile(metadataPath(root)));
		if (data && data.version === 1 && data.files && typeof data.files === "object") return data;
	} catch (error) {}
	return { version: 1, files: {} };
}

async function writeMetadata(root, metadata) {
	metadata.synced_at = new Date().toISOString();
	await writeTextFile(metadataPath(root), JSON.stringify(metadata, null, 2) + "\n");
}

function inferTargetFromPath(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (!SYNC_CODE_EXTENSIONS.has(ext)) return null;
	const base = path.basename(filePath, ext);
	const dot = base.lastIndexOf(".");
	if (dot <= 0 || dot === base.length - 1) return null;
	const name = base.slice(0, dot);
	const slot = base.slice(dot + 1);
	if (!SLOT_PATTERN.test(slot)) return null;
	return { slot, name };
}

function inferTargetFromDocument(document) {
	if (!document || document.uri.scheme !== "file") return null;
	const ext = path.extname(document.uri.fsPath).toLowerCase();
	if (!CODE_EXTENSIONS.has(ext)) return null;
	return inferTargetFromPath(document.uri.fsPath);
}

function syncTargetForDocument(document) {
	if (!syncRoot || !document || document.uri.scheme !== "file") return null;
	const filePath = path.resolve(document.uri.fsPath);
	const folders = syncFolders(syncRoot);
	const inCodes = filePath.startsWith(folders.codes + path.sep);
	const inCharacters = filePath.startsWith(folders.characters + path.sep);
	if (!inCodes && !inCharacters) return null;
	return inferTargetFromPath(filePath);
}

function targetKey(uri) {
	return "target:" + uri.toString();
}

function getRememberedTarget(context, document) {
	if (!document) return null;
	const target = context.workspaceState.get(targetKey(document.uri));
	if (target && SLOT_PATTERN.test(String(target.slot || ""))) return { slot: String(target.slot), name: String(target.name || "") };
	return null;
}

async function rememberTarget(context, document, target) {
	if (!document || !target || !target.slot) return;
	await context.workspaceState.update(targetKey(document.uri), {
		slot: String(target.slot),
		name: String(target.name || ""),
	});
}

function configuredTarget(document) {
	const slot = String(config().get("codeSlot") || "").trim();
	if (!slot || !SLOT_PATTERN.test(slot)) return null;
	const name = String(config().get("codeName") || "").trim();
	return { slot, name: name || defaultCodeName(document) };
}

function defaultCodeName(document) {
	if (document && document.uri.scheme === "file") {
		const inferred = inferTargetFromDocument(document);
		if (inferred && inferred.name) return inferred.name;
		return safeFilePart(path.basename(document.uri.fsPath, path.extname(document.uri.fsPath)), "code");
	}
	return "code";
}

function explainFailure(result) {
	if (!result || !result.reason) return "Request failed.";
	const extras = result.field ? " (" + result.field + ")" : "";
	return "Adventure Land API failed: " + result.reason + extras;
}

function postJson(url, body) {
	return new Promise((resolve, reject) => {
		let parsed;
		try {
			parsed = new URL(url);
		} catch (error) {
			reject(new Error("Invalid API URL: " + url));
			return;
		}
		const transport = parsed.protocol === "http:" ? http : https;
		const payload = Buffer.from(JSON.stringify(body), "utf8");
		const request = transport.request(
			parsed,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": payload.length,
					"User-Agent": USER_AGENT,
				},
				timeout: 15000,
			},
			(response) => {
				const chunks = [];
				let received = 0;
				response.on("data", (chunk) => {
					received += chunk.length;
					if (received > 5 * 1024 * 1024) {
						request.destroy(new Error("Adventure Land API response is too large."));
						return;
					}
					chunks.push(chunk);
				});
				response.on("end", () => {
					const text = Buffer.concat(chunks).toString("utf8");
					let data;
					try {
						data = text ? JSON.parse(text) : {};
					} catch (error) {
						reject(new Error("Adventure Land API returned invalid JSON."));
						return;
					}
					if (response.statusCode === 429) {
						const wait = data.retry_after_ms ? " Retry after " + Math.ceil(data.retry_after_ms / 1000) + "s." : "";
						const error = new Error("Adventure Land API rate limit reached." + wait);
						error.retryAfterMs = Number(data.retry_after_ms) || 0;
						reject(error);
						return;
					}
					if (response.statusCode < 200 || response.statusCode >= 300) {
						reject(new Error("Adventure Land API returned HTTP " + response.statusCode + "."));
						return;
					}
					resolve(data);
				});
			},
		);
		request.on("timeout", () => request.destroy(new Error("Adventure Land API request timed out.")));
		request.on("error", reject);
		request.write(payload);
		request.end();
	});
}

async function callWithToken(token, method, fields) {
	const result = await postJson(apiUrl(method), Object.assign({ token }, fields || {}));
	if (result && result.failed) throw new Error(explainFailure(result));
	return result;
}

async function apiCall(context, method, fields, options) {
	options = options || {};
	let token = await context.secrets.get(TOKEN_KEY);
	if (!token && options.promptForToken !== false) {
		const configured = await setToken(context);
		if (configured) token = await context.secrets.get(TOKEN_KEY);
	}
	if (!token) throw new Error("Set an Adventure Land API token first.");
	return callWithToken(token, method, fields);
}

async function apiCallPaced(context, method, fields) {
	try {
		return await apiCall(context, method, fields, { promptForToken: false });
	} catch (error) {
		if (error.retryAfterMs) {
			await sleep(Math.min(Math.max(error.retryAfterMs, 1000), 30000));
			return apiCall(context, method, fields, { promptForToken: false });
		}
		throw error;
	}
}

async function setToken(context) {
	const input = await vscode.window.showInputBox({
		title: "Adventure Land API Token",
		prompt: "Paste the token from adventure.land/vscode.",
		placeHolder: "mcp_...",
		password: true,
		ignoreFocusOut: true,
		validateInput(value) {
			return tokenFromText(value) ? null : "Paste a token that starts with mcp_.";
		},
	});
	if (!input) return false;
	const token = tokenFromText(input);
	await context.secrets.store(TOKEN_KEY, token);
	try {
		const result = await callWithToken(token, "list_codes");
		vscode.window.showInformationMessage("Adventure Land token saved. Found " + (result.codes || []).length + " CODE slots.");
		updateStatus(context);
		if (syncRoot) runSync(context, "token", { silent: true, promptForToken: false });
		return true;
	} catch (error) {
		await context.secrets.delete(TOKEN_KEY);
		updateStatus(context);
		vscode.window.showErrorMessage(error.message);
		return false;
	}
}

async function clearToken(context) {
	const answer = await vscode.window.showWarningMessage("Clear the saved Adventure Land API token from VS Code?", { modal: true }, "Clear Token");
	if (answer !== "Clear Token") return;
	await context.secrets.delete(TOKEN_KEY);
	updateStatus(context);
	vscode.window.showInformationMessage("Adventure Land API token cleared.");
}

async function loadSyncRoot(context) {
	const stored = String(context.globalState.get(SYNC_ROOT_KEY) || "");
	syncRoot = stored ? path.resolve(stored) : "";
	return syncRoot;
}

async function storeSyncRoot(context, root) {
	syncRoot = root ? path.resolve(root) : "";
	await context.globalState.update(SYNC_ROOT_KEY, syncRoot || undefined);
	restartPolling(context);
	updateStatus(context);
}

async function pickSyncRoot(context) {
	const defaultUri =
		syncRoot
			? vscode.Uri.file(syncRoot)
			: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
				? vscode.workspace.workspaceFolders[0].uri
				: undefined;
	const picked = await vscode.window.showOpenDialog({
		title: "Adventure Land Auto Sync Folder",
		openLabel: "Use This Folder",
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		defaultUri,
	});
	if (!picked || !picked[0]) return "";
	return normalizeSyncRoot(picked[0].fsPath);
}

async function activateSyncFolder(context) {
	const root = await pickSyncRoot(context);
	if (!root) return;
	await storeSyncRoot(context, root);
	await ensureSyncFolders(root);
	await runSync(context, "activate", { showProgress: true, promptForToken: true });
	const answer = await vscode.window.showInformationMessage(
		"Adventure Land auto sync is active. Files live in " + path.join(root, MANAGED_FOLDER) + ".",
		"Open Folder",
	);
	if (answer === "Open Folder") await openSyncFolder(context);
}

async function stopSyncFolder(context) {
	if (!syncRoot) {
		vscode.window.showInformationMessage("Adventure Land auto sync is not active.");
		return;
	}
	await storeSyncRoot(context, "");
	vscode.window.showInformationMessage("Adventure Land auto sync stopped.");
}

async function openSyncFolder(context) {
	if (!syncRoot) {
		await activateSyncFolder(context);
		return;
	}
	await ensureSyncFolders(syncRoot);
	await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(syncRoot), false);
}

function pollMilliseconds() {
	const seconds = Math.max(15, Math.min(Number(config().get("syncPollSeconds")) || 60, 3600));
	return seconds * 1000;
}

function restartPolling(context) {
	if (syncTimer) clearInterval(syncTimer);
	syncTimer = null;
	if (!syncRoot || !config().get("autoStartSync")) return;
	syncTimer = setInterval(() => runSync(context, "timer", { silent: true, promptForToken: false }), pollMilliseconds());
}

async function archiveFile(root, relativeFile, bucket) {
	const source = absolutePath(root, relativeFile);
	if (!(await fileExists(source))) return "";
	const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
	const targetFolder = bucket === "clash" ? syncFolders(root).clash : syncFolders(root).history;
	const target = path.join(targetFolder, path.basename(relativeFile) + "." + stamp);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.copyFile(source, target);
	return target;
}

async function archiveAndRemove(root, relativeFile, bucket) {
	const archived = await archiveFile(root, relativeFile, bucket);
	await removeFile(absolutePath(root, relativeFile));
	return archived;
}

async function remoteCode(context, slot) {
	const result = await apiCallPaced(context, "get_code", { slot });
	await sleep(550);
	return result.code || {};
}

async function uploadCodeText(context, target, code) {
	const maxBytes = Number(config().get("maxCodeBytes")) || 1024 * 1024;
	const bytes = codeByteLength(code);
	if (bytes > maxBytes) throw new Error("CODE file is " + bytes + " bytes, above the configured " + maxBytes + " byte limit.");
	const result = await apiCall(context, "save_code", {
		slot: target.slot,
		name: target.name || "code",
		code,
	});
	return result.code || {};
}

function savedTargetWithVersion(saved, fallback) {
	return {
		slot: String(saved.slot || fallback.slot),
		name: String(saved.name || fallback.name || "code"),
		version: Number(saved.version) || 0,
	};
}

async function updateMetadataForFile(root, metadata, saved, relativeFile, code) {
	const entry = {
		slot: String(saved.slot),
		name: String(saved.name || ""),
		version: Number(saved.version) || 0,
		file: relativeFile,
		hash: sha256(code),
		updated_at: new Date().toISOString(),
	};
	metadata.files[entry.slot] = entry;
	await writeMetadata(root, metadata);
	return entry;
}

async function writeRemoteCode(root, metadata, codeInfo, preferredRelativeFile) {
	const target = { slot: String(codeInfo.slot), name: String(codeInfo.name || "code") };
	const relativeFile = preferredRelativeFile || targetRelativePath(target);
	await writeTextFile(absolutePath(root, relativeFile), String(codeInfo.code || ""));
	return updateMetadataForFile(
		root,
		metadata,
		{ slot: target.slot, name: target.name, version: codeInfo.version },
		relativeFile,
		String(codeInfo.code || ""),
	);
}

async function syncLibraries(context, root) {
	const result = await apiCall(context, "get_libraries", {}, { promptForToken: false });
	const libraries = (result && result.libraries) || {};
	const folders = syncFolders(root);
	let count = 0;
	for (const name of Object.keys(libraries).sort()) {
		const safeName = safeFilePart(name, "library.js");
		if (!safeName.endsWith(".js")) continue;
		const file = path.join(folders.libraries, safeName);
		const text = String(libraries[name] || "");
		if (!(await fileExists(file)) || sha256(await readTextFile(file)) !== sha256(text)) {
			await writeTextFile(file, text);
		}
		count += 1;
	}
	return count;
}

async function uploadLocalPath(context, root, metadata, relativeFile, target, source) {
	const file = absolutePath(root, relativeFile);
	const code = await readTextFile(file);
	const saved = await uploadCodeText(context, target, code);
	const savedTarget = { slot: String(saved.slot || target.slot), name: String(saved.name || target.name || "code") };
	const wantedRelative = targetRelativePath(savedTarget);
	let finalRelative = relativeFile;
	if (wantedRelative !== relativeFile) {
		const wantedAbsolute = absolutePath(root, wantedRelative);
		if ((await fileExists(wantedAbsolute)) && wantedAbsolute !== file) await archiveAndRemove(root, wantedRelative, "clash");
		await fs.mkdir(path.dirname(wantedAbsolute), { recursive: true });
		await fs.rename(file, wantedAbsolute).catch(async () => {
			await fs.copyFile(file, wantedAbsolute);
			await removeFile(file);
		});
		finalRelative = wantedRelative;
	}
	const entry = await updateMetadataForFile(root, metadata, savedTargetWithVersion(saved, savedTarget), finalRelative, code);
	output.appendLine("Uploaded " + finalRelative + " to slot " + entry.slot + " (" + entry.name + "), v" + entry.version + (source ? " [" + source + "]" : "") + ".");
	updateStatus(null, entry);
	return entry;
}

async function syncRemoteSlot(context, root, metadata, remote, localBySlot) {
	const slot = String(remote.slot);
	const name = String(remote.name || "code");
	const version = Number(remote.version) || 0;
	const entry = metadata.files[slot];
	const preferredRelative = targetRelativePath({ slot, name });
	const localMatch = localBySlot && localBySlot.get(slot);
	let localRelative = localMatch ? localMatch.relativeFile : entry && entry.file ? entry.file : preferredRelative;
	let localAbsolute = absolutePath(root, localRelative);
	let localExists = await fileExists(localAbsolute);
	let localHash = localExists ? await readFileHash(localAbsolute) : "";
	let localTarget = localExists ? inferTargetFromPath(localAbsolute) : null;

	if (entry && localExists && localRelative !== entry.file && version === Number(entry.version || 0)) {
		await uploadLocalPath(context, root, metadata, localRelative, localTarget || { slot, name }, "offline local rename");
		return;
	}

	if (entry && localExists && entry.hash && localHash !== entry.hash) {
		if (version === Number(entry.version || 0)) {
			await uploadLocalPath(context, root, metadata, localRelative, localTarget || { slot, name }, "offline local change");
			return;
		}
		const archived = await archiveFile(root, localRelative, "clash");
		output.appendLine("Remote and local both changed for slot " + slot + ". Local copy saved to " + archived + ".");
	}

	if (!entry || !localExists || version !== Number(entry.version || 0) || name !== entry.name || localRelative !== preferredRelative) {
		const codeInfo = await remoteCode(context, slot);
		const remoteText = String(codeInfo.code || "");
		const remoteHash = sha256(remoteText);

		if (!entry && (await fileExists(absolutePath(root, preferredRelative)))) {
			const existingHash = await readFileHash(absolutePath(root, preferredRelative));
			if (existingHash !== remoteHash) {
				const archived = await archiveFile(root, preferredRelative, "clash");
				output.appendLine("Existing local file for slot " + slot + " saved to " + archived + " before first download.");
			}
		}
		if (!entry && localExists && localRelative !== preferredRelative) {
			if (localHash !== remoteHash) {
				const archived = await archiveFile(root, localRelative, "clash");
				output.appendLine("Existing local file for slot " + slot + " saved to " + archived + " before first download.");
			}
			await removeFile(localAbsolute);
		}

		if (entry && localRelative !== preferredRelative && (await fileExists(localAbsolute))) await archiveAndRemove(root, localRelative, "history");
		await writeRemoteCode(root, metadata, codeInfo, preferredRelative);
		output.appendLine("Downloaded slot " + slot + " (" + name + "), v" + version + ".");
	}
}

async function listManagedFiles(root) {
	const folders = syncFolders(root);
	const results = [];
	for (const folder of [folders.codes, folders.characters]) {
		let entries = [];
		try {
			entries = await fs.readdir(folder);
		} catch (error) {
			continue;
		}
		for (const name of entries) {
			if (name.startsWith(".")) continue;
			const file = path.join(folder, name);
			const stat = await fs.stat(file).catch(() => null);
			if (!stat || !stat.isFile()) continue;
			const target = inferTargetFromPath(file);
			if (!target) continue;
			results.push({ file, relativeFile: relativePath(root, file), target });
		}
	}
	return results;
}

async function uploadNewLocalFiles(context, root, metadata, remoteSlots, files) {
	files = files || (await listManagedFiles(root));
	for (const file of files) {
		const slot = String(file.target.slot);
		if (remoteSlots.has(slot) || metadata.files[slot]) continue;
		await uploadLocalPath(context, root, metadata, file.relativeFile, file.target, "new local file");
	}
}

async function archiveMissingRemoteFiles(root, metadata, remoteSlots) {
	for (const slot of Object.keys(metadata.files)) {
		if (remoteSlots.has(slot)) continue;
		const entry = metadata.files[slot];
		if (entry && entry.file && (await fileExists(absolutePath(root, entry.file)))) {
			const archived = await archiveAndRemove(root, entry.file, "history");
			output.appendLine("Remote slot " + slot + " no longer exists. Local copy moved to " + archived + ".");
		}
		delete metadata.files[slot];
	}
}

async function syncAll(context, root) {
	await ensureSyncFolders(root);
	const metadata = await readMetadata(root);
	const list = await apiCall(context, "list_codes", {}, { promptForToken: false });
	const codes = sortableCodes(list.codes || []);
	const remoteSlots = new Set(codes.map((code) => String(code.slot)));
	const managedFiles = await listManagedFiles(root);
	const localBySlot = new Map();
	for (const file of managedFiles) {
		const slot = String(file.target.slot);
		if (!localBySlot.has(slot)) localBySlot.set(slot, file);
		else output.appendLine("Duplicate local CODE slot " + slot + ": " + file.relativeFile + " is ignored until one copy is removed.");
	}

	await uploadNewLocalFiles(context, root, metadata, remoteSlots, managedFiles);
	await archiveMissingRemoteFiles(root, metadata, remoteSlots);

	for (const code of codes) {
		await syncRemoteSlot(context, root, metadata, code, localBySlot);
	}

	await writeMetadata(root, metadata);
	const libraries = await syncLibraries(context, root);
	return { codes: codes.length, libraries };
}

async function runSync(context, reason, options) {
	options = options || {};
	if (!syncRoot) await loadSyncRoot(context);
	if (!syncRoot) {
		if (!options.silent) await activateSyncFolder(context);
		return;
	}
	const token = await context.secrets.get(TOKEN_KEY);
	if (!token) {
		if (options.promptForToken) await setToken(context);
		else updateStatus(context);
		if (!(await context.secrets.get(TOKEN_KEY))) return;
	}
	if (syncRunning) return;
	syncRunning = true;
	updateStatus(context);
	const work = async () => {
		try {
			const result = await syncAll(context, syncRoot);
			output.appendLine("Sync complete: " + result.codes + " remote CODE slots checked, " + result.libraries + " libraries updated" + (reason ? " [" + reason + "]" : "") + ".");
			if (!options.silent) vscode.window.showInformationMessage("Adventure Land sync complete: " + result.codes + " CODE slots checked.");
		} catch (error) {
			output.appendLine(error.stack || error.message);
			if (!options.silent) vscode.window.showErrorMessage(error.message);
		} finally {
			syncRunning = false;
			updateStatus(context);
		}
	};
	if (options.showProgress) {
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: "Adventure Land CODE sync", cancellable: false },
			work,
		);
	} else await work();
}

async function listCodes(context) {
	const result = await apiCall(context, "list_codes");
	const codes = sortableCodes(result.codes || []);
	if (!codes.length) {
		vscode.window.showInformationMessage("No Adventure Land CODE slots found.");
		return [];
	}
	const picked = await vscode.window.showQuickPick(
		codes.map((code) => ({
			label: "$(file-code) " + code.name,
			description: "slot " + code.slot + " / v" + code.version,
			code,
		})),
		{ title: "Adventure Land CODE Slots", placeHolder: "Choose a slot to copy its slot id." },
	);
	if (picked) {
		await vscode.env.clipboard.writeText(String(picked.code.slot));
		vscode.window.showInformationMessage("Copied Adventure Land CODE slot " + picked.code.slot + ".");
	}
	return codes;
}

async function chooseCodeTarget(context, document, title) {
	let codes = [];
	try {
		const result = await apiCall(context, "list_codes");
		codes = sortableCodes(result.codes || []);
	} catch (error) {
		output.appendLine("Could not list CODE slots before prompting: " + error.message);
	}
	const items = codes.map((code) => ({
		label: "$(file-code) " + code.name,
		description: "slot " + code.slot + " / v" + code.version,
		target: { slot: String(code.slot), name: String(code.name || "") },
	}));
	items.push({ label: "$(add) Use another slot", description: "Enter a slot and name manually", custom: true });
	const picked = await vscode.window.showQuickPick(items, {
		title: title || "Choose Adventure Land CODE Slot",
		placeHolder: "Select the remote CODE slot to replace.",
		ignoreFocusOut: true,
	});
	if (!picked) return null;
	if (!picked.custom) return picked.target;
	const slot = await vscode.window.showInputBox({
		title: "Adventure Land CODE Slot",
		prompt: "Enter a slot number, character slot, or CODE slot id.",
		value: "",
		ignoreFocusOut: true,
		validateInput(value) {
			return SLOT_PATTERN.test(String(value || "")) ? null : "Use 1-100 letters, numbers, spaces, dots, underscores, plus, or hyphen.";
		},
	});
	if (!slot) return null;
	const name = await vscode.window.showInputBox({
		title: "Adventure Land CODE Name",
		prompt: "Name shown in Adventure Land.",
		value: defaultCodeName(document),
		ignoreFocusOut: true,
	});
	if (name === undefined) return null;
	return { slot: String(slot), name: String(name || defaultCodeName(document)) };
}

async function resolveTarget(context, document, allowPrompt) {
	const syncTarget = syncTargetForDocument(document);
	if (syncTarget) return syncTarget;
	const remembered = getRememberedTarget(context, document);
	if (remembered) return remembered;
	const fromFile = inferTargetFromDocument(document);
	if (fromFile) return fromFile;
	const fromConfig = configuredTarget(document);
	if (fromConfig) return fromConfig;
	return allowPrompt ? chooseCodeTarget(context, document) : null;
}

async function uploadDocument(context, document, target, options) {
	if (!document) throw new Error("Open a JavaScript CODE file first.");
	const code = document.getText();
	const key = document.uri.toString();
	if (activeUploads.has(key)) return null;
	activeUploads.add(key);
	try {
		const saved = await uploadCodeText(context, target, code);
		const savedTarget = { slot: String(saved.slot || target.slot), name: String(saved.name || target.name || defaultCodeName(document)) };
		await rememberTarget(context, document, savedTarget);
		output.appendLine("Uploaded " + document.uri.fsPath + " to slot " + savedTarget.slot + " (" + savedTarget.name + "), v" + saved.version + ".");

		if (syncRoot) {
			const syncTarget = syncTargetForDocument(document);
			if (syncTarget) {
				const metadata = await readMetadata(syncRoot);
				const relativeFile = relativePath(syncRoot, document.uri.fsPath);
				await updateMetadataForFile(syncRoot, metadata, savedTargetWithVersion(saved, savedTarget), relativeFile, code);
			}
		}

		updateStatus(context, savedTarget);
		if (!options || !options.silent) vscode.window.showInformationMessage("Uploaded " + savedTarget.name + " to Adventure Land slot " + savedTarget.slot + ".");
		return saved;
	} finally {
		activeUploads.delete(key);
	}
}

async function uploadCurrentFile(context) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("Open a CODE file before uploading.");
		return;
	}
	const target = await resolveTarget(context, editor.document, true);
	if (!target) return;
	try {
		await uploadDocument(context, editor.document, target);
	} catch (error) {
		output.appendLine(error.stack || error.message);
		vscode.window.showErrorMessage(error.message);
	}
}

async function downloadCodeSlot(context) {
	const target = await chooseCodeTarget(context, null, "Download Adventure Land CODE Slot");
	if (!target) return;
	try {
		const result = await apiCall(context, "get_code", { slot: target.slot });
		const code = result.code || {};
		const fileName = safeFilePart(code.name, "code") + "." + safeFilePart(code.slot, "slot") + ".js";
		let defaultUri;
		if (syncRoot) defaultUri = vscode.Uri.file(path.join(syncRoot, targetRelativePath({ slot: code.slot || target.slot, name: code.name || target.name || "code" })));
		else {
			const firstFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
			defaultUri = firstFolder ? vscode.Uri.joinPath(firstFolder.uri, fileName) : vscode.Uri.file(path.join(process.cwd(), fileName));
		}
		const uri = await vscode.window.showSaveDialog({
			title: "Save Adventure Land CODE Slot",
			defaultUri,
			filters: { JavaScript: ["js"] },
		});
		if (!uri) return;
		await vscode.workspace.fs.writeFile(uri, Buffer.from(String(code.code || ""), "utf8"));
		const document = await vscode.workspace.openTextDocument(uri);
		await rememberTarget(context, document, { slot: String(code.slot || target.slot), name: String(code.name || target.name || "") });
		await vscode.window.showTextDocument(document);
		if (syncRoot && uri.fsPath.startsWith(syncRoot + path.sep)) {
			const metadata = await readMetadata(syncRoot);
			await updateMetadataForFile(
				syncRoot,
				metadata,
				savedTargetWithVersion(code, { slot: code.slot || target.slot, name: code.name || target.name || "code" }),
				relativePath(syncRoot, uri.fsPath),
				String(code.code || ""),
			);
		}
		updateStatus(context, { slot: String(code.slot || target.slot), name: String(code.name || target.name || "") });
		vscode.window.showInformationMessage("Downloaded Adventure Land CODE slot " + (code.slot || target.slot) + ".");
	} catch (error) {
		output.appendLine(error.stack || error.message);
		vscode.window.showErrorMessage(error.message);
	}
}

async function setTargetSlot(context) {
	const editor = vscode.window.activeTextEditor;
	const target = await chooseCodeTarget(context, editor && editor.document, "Default Adventure Land CODE Slot");
	if (!target) return;
	const targetScope = vscode.workspace.workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
	await config().update("codeSlot", target.slot, targetScope);
	await config().update("codeName", target.name || "", targetScope);
	if (editor) await rememberTarget(context, editor.document, target);
	updateStatus(context, target);
	vscode.window.showInformationMessage("Default Adventure Land CODE slot set to " + target.slot + ".");
}

async function toggleAutoUpload(context) {
	const enabled = !config().get("autoUploadOnSave");
	const targetScope = vscode.workspace.workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
	await config().update("autoUploadOnSave", enabled, targetScope);
	updateStatus(context);
	vscode.window.showInformationMessage("Adventure Land auto upload on save " + (enabled ? "enabled." : "disabled."));
}

async function autoUploadOnSave(context, document) {
	if (!document || document.uri.scheme !== "file") return;
	if (!CODE_EXTENSIONS.has(path.extname(document.uri.fsPath).toLowerCase())) return;
	const syncTarget = syncTargetForDocument(document);
	if (!syncTarget && !config().get("autoUploadOnSave")) return;
	const target = syncTarget || (await resolveTarget(context, document, false));
	if (!target) return;
	try {
		await uploadDocument(context, document, target, { silent: true });
	} catch (error) {
		output.appendLine(error.stack || error.message);
		vscode.window.showErrorMessage("Adventure Land upload failed: " + error.message);
	}
}

function updateStatus(context, target) {
	if (!statusBar) return;
	const auto = config().get("autoUploadOnSave");
	const rootText = syncRoot ? " synced" : "";
	const busyText = syncRunning ? " syncing" : "";
	const slot = target && target.slot ? " " + target.slot : "";
	statusBar.text = (syncRunning ? "$(sync~spin)" : syncRoot ? "$(sync)" : auto ? "$(cloud-upload)" : "$(folder)") + " AL CODE" + rootText + busyText + slot;
	statusBar.tooltip = syncRoot
		? "Adventure Land CODE Sync: " + path.join(syncRoot, MANAGED_FOLDER)
		: "Adventure Land CODE Sync: activate an auto sync folder.";
	statusBar.command = syncRoot ? "adventureland.syncNow" : "adventureland.activateSyncFolder";
	statusBar.show();
}

function register(context, command, callback) {
	context.subscriptions.push(vscode.commands.registerCommand(command, () => callback(context)));
}

async function activate(context) {
	output = vscode.window.createOutputChannel("Adventure Land CODE");
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
	context.subscriptions.push(output, statusBar);

	await loadSyncRoot(context);

	register(context, "adventureland.setToken", setToken);
	register(context, "adventureland.clearToken", clearToken);
	register(context, "adventureland.activateSyncFolder", activateSyncFolder);
	register(context, "adventureland.stopSyncFolder", stopSyncFolder);
	register(context, "adventureland.openSyncFolder", openSyncFolder);
	register(context, "adventureland.syncNow", (ctx) => runSync(ctx, "manual", { showProgress: true, promptForToken: true }));
	register(context, "adventureland.listCodeSlots", listCodes);
	register(context, "adventureland.downloadCodeSlot", downloadCodeSlot);
	register(context, "adventureland.uploadCurrentFile", uploadCurrentFile);
	register(context, "adventureland.setTargetSlot", setTargetSlot);
	register(context, "adventureland.toggleAutoUpload", toggleAutoUpload);
	register(context, "adventureland.openMainframe", () => vscode.env.openExternal(vscode.Uri.parse("https://adventure.land/mainframe")));
	register(context, "adventureland.openSetupGuide", () => vscode.env.openExternal(vscode.Uri.parse("https://adventure.land/vscode")));

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => autoUploadOnSave(context, document)));
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (!event.affectsConfiguration("adventureland")) return;
			restartPolling(context);
			updateStatus(context);
		}),
	);

	restartPolling(context);
	updateStatus(context);
	if (syncRoot && config().get("autoStartSync")) runSync(context, "startup", { silent: true, promptForToken: false });
}

function deactivate() {
	if (syncTimer) clearInterval(syncTimer);
	syncTimer = null;
}

module.exports = { activate, deactivate };
