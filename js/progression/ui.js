/* Progression HUD. Uses native items, sprites, INFO and service interfaces. */
(function (root) {
	"use strict";
	var runtime,
		timer,
		result,
		currentNotices = new Set(),
		announced = new Set(),
		flashTimer,
		seen = new Set(),
		pending = {},
		initialized = false,
		stateKey = "",
		folded = true,
		visible = false,
		goal = null,
		disabled = false;
	function graphics() {
		return !root.no_graphics && !root.no_html;
	}
	function t(key, args) {
		return phrase.html("progression." + key, args || {});
	}
	function statLabel(metric) {
		return phrase.definition("stat", metric === "max_hp" ? "hp" : metric, "name", metric);
	}
	function say(record) {
		if (!record) return "";
		var args = Object.assign({}, record.args);
		if (args.stat) args.stat = statLabel(args.stat);
		if (typeof args.gold === "number") args.gold = to_pretty_num(args.gold);
		return phrase.html(record.id, args);
	}
	function saved(key) {
		try {
			return storage_get(key);
		} catch (e) {
			return null;
		}
	}
	function save(key, value) {
		try {
			storage_set(key, value);
		} catch (e) {}
	}
	function adapter() {
		if (!runtime || runtime.engine.index !== ProgressionSources.get(G)) {
			if (runtime) runtime.detach();
			runtime = ProgressionRuntime.create({
				G: G,
				characterSlots: character_slots,
				doublehandTypes: doublehand_types,
				character: function () {
					return character;
				},
				realm: function () {
					return server_region + " " + server_identifier;
				},
				socket: function () {
					return root.socket;
				},
				entities: function () {
					return root.entities;
				},
				party: function () {
					return root.party;
				},
				status: function () {
					return root.S;
				},
				nextSkill: function (skill) {
					return (root.next_skill && root.next_skill[skill]) || 0;
				},
			});
		}
		return runtime;
	}
	root.progression_read = function (options) {
		return adapter().read(options);
	};
	function identity() {
		var key = "progression:" + character.name;
		if (key === stateKey) return;
		stateKey = key;
		var savedState = saved(key) || {};
		folded = true;
		visible = false;
		goal = savedState.goal || null;
		seen = new Set((savedState.seen || []).slice(-128));
		currentNotices = new Set();
		announced = new Set();
		pending = {};
		initialized = false;
	}
	function persist() {
		if (stateKey) save(stateKey, { folded: folded, goal: goal, seen: Array.from(seen).slice(-128) });
	}
	root.progression_art = function (art, portrait) {
		if (!graphics()) return "";
		if (!art) return "<div class='progression-art' aria-hidden='true'></div>";
		var icon = art.item && G.items[art.item] ? art.item : art.skill && G.skills[art.skill] && G.skills[art.skill].skin;
		if (icon) return "<div class='progression-art' aria-hidden='true'>" + item_container({ skin: icon, size: 40, bcolor: "black", draggable: false }) + "</div>";
		var npc = art.npc && G.npcs[art.npc],
			name = npc ? npc.skin : art.monster;
		if (!name) return "";
		precompute_image_positions();
		var skin = G.monsters[name] ? G.monsters[name].skin || name : name,
			dims = G.dimensions[skin] || (npc && G.dimensions.default_character) || (IID[skin] ? [IID[skin][4], IID[skin][5]] : null);
		if (!dims || !IID[skin]) return "";
		var limit = portrait ? 88 : 64,
			scale = Math.max(1, Math.min(2, Math.floor(80 / (dims[0] + 4)), Math.floor(limit / (dims[1] + 6))));
		var width = (dims[0] + 4) * scale,
			height = (dims[1] + (npc ? 0 : 6)) * scale,
			frame = Math.max(64, height);
		// Passing the native skin avoids the monster-size adjustment in sprite().
		// Both the frame and its position stay on whole pixels; no crop or resample.
		return (
			"<div class='progression-art' style='height:" +
			frame +
			"px' aria-hidden='true'><div style='position:absolute;left:" +
			Math.floor((80 - width) / 2) +
			"px;top:" +
			Math.floor((frame - height) / 2) +
			"px'>" +
			sprite(skin, {
				scale: scale + (G.monsters[skin] && G.monsters[skin].size ? 1 - G.monsters[skin].size : 0),
				width: width,
				height: height,
				overflow: !!npc,
				cx: Object.assign({}, npc && npc.cx),
				cosmetic_head_y: npc && npc.cosmetic_head_y,
			}) +
			"</div></div>"
		);
	};
	function goalLabel(g) {
		if (g.kind === "trade") return t("goal.trade") + " · " + html_escape(G.npcs[g.market].name);
		if (g.kind === "stat") return t("goal.stat", { value: to_pretty_num(g.target), stat: statLabel(g.metric) });
		if (g.kind === "item") return t("goal.item", { item: G.items[g.name].name, level: g.level || 0 });
		if (g.kind === "set") return html_escape(G.sets[g.name].name);
		if (g.kind === "gold") return t("goal.gold", { value: to_pretty_num(g.target) });
		if (["farm", "encounter"].includes(g.kind)) return t("goal." + g.kind, { monster: G.monsters[g.monster].name });
		if (g.kind === "gather") return t("goal.gather") + " · " + phrase.definition("skill", g.skill, "name", g.skill);
		return t("goal." + g.kind);
	}
	function unseen(rows, at) {
		var ids = new Set(
				rows.map(function (r) {
					return JSON.stringify(goal) + ":" + (r.notice || r.id) + ":" + (r.affordable === false ? "save" : "ready");
				}),
			),
			flash = false;
		if (!initialized) {
			// Entry establishes the baseline; only later changes announce a new path.
			ids.forEach(function (id) {
				seen.add(id);
			});
			initialized = true;
		}
		ids.forEach(function (id) {
			if (seen.has(id) || announced.has(id)) return;
			if (!pending[id]) pending[id] = at;
			if (at - pending[id] >= AdventureProgression.policy.settle) {
				announced.add(id);
				flash = true;
			}
		});
		Object.keys(pending).forEach(function (id) {
			if (!ids.has(id)) delete pending[id];
		});
		currentNotices = ids;
		return flash;
	}
	function clearFlash() {
		clearTimeout(flashTimer);
		$("#progression-guide").removeClass("new-path");
	}
	function acknowledge() {
		currentNotices.forEach(function (id) {
			seen.add(id);
		});
		pending = {};
		clearFlash();
		persist();
	}
	function rowTitle(row) {
		var event = row.event && G.events[row.event],
			theme = event && event.announcement;
		return theme && theme.title ? html_escape(phrase.definition("event", row.event, "announcement.title", theme.title)) : event ? html_escape(event.name) : say(row.title);
	}
	function rowReason(row) {
		var event = row.event && G.events[row.event];
		return event && event.type === "seasonal" && event.announcement ? html_escape(phrase.definition("event", row.event, "announcement.text", event.announcement.text)) : say(row.reason);
	}
	function render(reveal) {
		if (!graphics() || disabled || !root.character || !root.G || !G.items) return;
		identity();
		result = adapter().read({ goal: goal });
		if (!result.ready) return;
		var flash = unseen(result.rows, Date.now()),
			html;
		if (reveal || flash) visible = true;
		if (!visible) {
			$("#progression-guide").remove();
			return;
		}
		if (folded) html = "<button type='button' class='gamebutton progression-fold' onclick='btc(event); progression_fold(false)'>" + t("name") + " +</button>";
		else {
			html =
				"<div class='progression-heading'><button type='button' onclick='btc(event); progression_details()'>" +
				goalLabel(result.goal) +
				" <span class='progression-count'>" +
				(result.progress.target === null ? "" : to_pretty_num(result.progress.value) + "/" + to_pretty_num(result.progress.target)) +
				"</span><span class='progression-context'>" +
				(result.goal.kind === "trade" ? t("goal.trade_hint") : result.complete ? t("complete") : result.goal.kind === "stat" ? t("goal.hint") : t("name")) +
				"</span></button><button type='button' aria-label='" +
				t("fold") +
				"' onclick='btc(event); progression_fold(true)'>&minus;</button></div>";
			result.rows.forEach(function (row, n) {
				var destination = travelTarget(row.action);
				html +=
					"<div class='progression-row'><button type='button' class='progression-summary' onclick='btc(event); progression_details(" +
					n +
					")'>" +
					progression_art(destination && destination.type === "npc" ? { npc: destination.id } : row.art) +
					"<span class='progression-copy'><span class='progression-title'>" +
					rowTitle(row) +
					"</span><span class='progression-reason'>" +
					rowReason(row) +
					"</span></span></button><div class='progression-actions'><button type='button' class='progression-info' onclick='btc(event); progression_details(" +
					n +
					")'>INFO</button>" +
					moveButton(destination) +
					"</div></div>";
			});
		}
		var container = $("#progression-guide");
		if (!container.length) {
			$("#bottommid").prepend("<div id='progression-guide' class='enableclicks'></div>");
			container = $("#progression-guide");
			container.on("pointerdown mousedown touchstart mousemove", function (event) {
				event.stopPropagation();
			});
			bindActions(container);
		}
		if (container.data("html") !== html) container.html(html).data("html", html);
		container.toggleClass("is-folded", folded).css("margin-bottom", 8 + Math.max($(".codebbuttons").outerHeight() || 0, $(".badplaceforaui").outerHeight() || 0));
		if (flash) {
			clearFlash();
			void container[0].offsetWidth;
			container.addClass("new-path");
			flashTimer = setTimeout(clearFlash, 2500);
		}
	}
	root.progression_fold = function (value) {
		if (!graphics()) return;
		acknowledge();
		folded = !!value;
		persist();
		render(true);
	};
	root.set_progression_guide = function (enabled, initial) {
		disabled = !enabled;
		save("progression_guide", enabled ? "on" : "off");
		if (timer) clearInterval(timer);
		timer = null;
		if (!enabled && runtime) runtime.detach();
		if (!graphics()) return;
		clearFlash();
		$(".progression-setting").html(t(enabled ? "setting.on" : "setting.off"));
		if (!enabled) $("#progression-guide").remove();
		else {
			render(!initial);
			timer = setInterval(render, 1000);
		}
	};
	root.progression_set_goal = function (choice) {
		if (!graphics()) return;
		acknowledge();
		if (choice === "custom") goal = { kind: "item", name: $("#progression-item").val(), level: Number($("#progression-level").val()) || 0, quantity: 1 };
		else goal = choice === "auto" ? null : result.choices[choice];
		if (!goal && choice !== "auto") return;
		persist();
		hide_modal();
		render();
	};
	var articles = {
		hunt: "monster-hunts",
		recover: "basics",
		supplies: "shops-and-selling",
		shop: "merchant",
		market: "markets-and-trading",
		gather: "gathering",
		stat: "upgrading",
		upgrade: "upgrading",
		compound: "compounding",
		retrieve: "banking",
	};
	function sourceButton(action, label) {
		if (!label) {
			var article = articles[action.kind];
			label = article
				? phrase.html("directory.guide." + article + ".title")
				: action.kind === "craft" || action.kind === "dismantle"
					? t("recipe.open")
					: action.route
						? html_escape(G.monsters[action.route.monster].name) + " · INFO"
						: action.name && G.items[action.name]
							? html_escape(G.items[action.name].name) + " · INFO"
							: t("name");
		}
		var reference = {
			kind: action.kind,
			name: action.name,
			level: action.level,
			recipe: action.recipe,
			modal: action.modal,
			event: action.event,
			monster: action.monster,
			route: action.route && { monster: action.route.monster },
		};
		return "<button type='button' class='gamebutton gamebutton-small' data-progression-action='" + html_escape(JSON.stringify(reference)) + "'>" + label + "</button>";
	}
	function section(title, content) {
		return "<div class='divider'></div><div class='title'>" + title + "</div>" + content;
	}
	function paragraph(content) {
		return "<p>" + content + "</p>";
	}
	function materialCount(owned, needed) {
		// Keep the owned / needed ratio in this order in right-to-left text too.
		return t("materials", { owned: "\u2066" + to_pretty_num(owned), needed: to_pretty_num(needed) + "\u2069" });
	}
	function travelTarget(action) {
		if (!action || action.blocked) return null;
		var route = action.route;
		if (route && route.safe && G.maps[route.map]) return { type: "monster", id: route.monster, position: { map: route.map, x: route.x, y: route.y } };
		var npc = action.npc || (["upgrade", "compound", "stat"].includes(action.kind) ? "newupgrade" : null);
		if (npc && G.npcs[npc]) {
			var locations = adapter().engine.index.locations[npc] || [],
				location =
					locations.find(function (p) {
						return p.map === character.map;
					}) || locations[0];
			if (location) return { type: "npc", id: npc, position: { map: location.map, x: location.position[0], y: location.position[1] + 15 } };
		}
		if (action.kind === "retrieve" && G.maps.bank) return { type: "map", id: "bank" };
		return null;
	}
	function moveButton(destination) {
		if (!destination) return "";
		var definitions = destination.type === "npc" ? G.npcs : destination.type === "monster" ? G.monsters : G.maps;
		return (
			"<button type='button' class='gamebutton gamebutton-small progression-move' data-progression-travel='" +
			html_escape(JSON.stringify(destination)) +
			"' aria-label='" +
			phrase.html("docs.guide.basics.move") +
			" · " +
			html_escape(definitions[destination.id].name) +
			"'>" +
			phrase.html("docs.guide.basics.move") +
			"</button>"
		);
	}
	root.progression_travel = function (destination) {
		if (!graphics() || !root.character || !destination) return;
		acknowledge();
		smart_smart_move(destination.type, destination.id, destination.position);
	};
	function bindActions(container) {
		container.on("click", "[data-progression-travel], [data-progression-action]", function (event) {
			btc(event);
			if (this.hasAttribute("data-progression-travel")) progression_travel(JSON.parse(this.getAttribute("data-progression-travel")));
			else progression_open(JSON.parse(this.getAttribute("data-progression-action")));
		});
	}
	function destinationLine(action, visited, link) {
		var destination = travelTarget(action);
		if (!destination) return "";
		var key = JSON.stringify(destination);
		if (visited && visited.has(key)) return "";
		if (visited) visited.add(key);
		var definitions = destination.type === "npc" ? G.npcs : destination.type === "monster" ? G.monsters : G.maps,
			point = destination.position,
			art = destination.type === "map" ? "" : progression_art(destination.type === "npc" ? { npc: destination.id } : { monster: destination.id }, true);
		return (
			"<div class='progression-destination'>" +
			art +
			"<div class='progression-place'><div>" +
			html_escape(definitions[destination.id].name) +
			"</div>" +
			(point ? "<div class='progression-location'>" + html_escape(G.maps[point.map].name || point.map) + " <bdi>(" + Math.round(point.x) + ", " + Math.round(point.y) + ")</bdi></div>" : "") +
			"</div><div class='progression-destination-actions'>" +
			moveButton(destination) +
			(link ? sourceButton(action, "INFO") : "") +
			"</div></div>"
		);
	}
	function itemLine(item, detail) {
		return (
			"<div class='progression-material'>" +
			"<button type='button' class='progression-item' data-progression-action='" +
			html_escape(JSON.stringify({ kind: "inspect", name: item.name, level: item.level || 0 })) +
			"'>" +
			item_container({ skin: G.items[item.name].skin || item.name, size: 40, draggable: false }, item) +
			"<span>" +
			html_escape(G.items[item.name].name) +
			(item.level ? " +" + item.level : "") +
			" <span class='progression-item-info'>INFO</span>" +
			(detail ? "<span class='progression-quantity'>" + detail + "</span>" : "") +
			"</span></button></div>"
		);
	}
	function supplies(item, quantity, visited) {
		var owned = (character.items || []).reduce(function (n, i) {
			return Math.max(n, i && AdventureProgression.plain(i) && i.name === item ? i.q || 1 : 0);
		}, 0);
		var seller = adapter()
			.engine.index.sources(item)
			.find(function (s) {
				return s.kind === "shop" && s.currency === "gold";
			});
		return "<div class='progression-resource'>" + itemLine({ name: item }, materialCount(owned, quantity)) + (owned < quantity && seller ? destinationLine(seller, visited) : "") + "</div>";
	}
	function tree(node, depth, visited, parent) {
		if (!node || depth > 6) return "";
		// A developed item and its base copy share a source. Show the item once,
		// while retaining different quantities and every recipe ingredient.
		var duplicate = parent && parent.name === node.name && parent.quantity === node.quantity;
		var html = duplicate ? "" : itemLine({ name: node.name, level: node.level }, materialCount(node.owned, node.quantity));
		if (!node.remaining) return html;
		if (node.blocked) return html + paragraph(t("reason.blocked", { item: G.items[node.name].name }));
		var branch =
			node.alternatives.find(function (a) {
				return a === node.next || a.next === node.next;
			}) || node.alternatives[0];
		if (!branch) return html;
		if (branch.kind === "develop") {
			var development = { kind: G.items[node.name].compound ? "compound" : "upgrade" };
			html = "<div class='progression-resource'>" + html + destinationLine(development, visited, true) + "</div>";
			html += paragraph(t("expected", { copies: branch.meanCopies.toFixed(1), gold: to_pretty_num(Math.ceil(branch.meanGold)) }));
			var scrolls = new Set();
			adapter()
				.engine.development(node.name, node.level)
				.rows.forEach(function (step) {
					scrolls.add(step.scroll);
				});
			scrolls.forEach(function (name) {
				var seller = adapter()
					.engine.index.sources(name)
					.find(function (s) {
						return s.kind === "shop" && s.currency === "gold";
					});
				html += "<div class='progression-resource'>" + itemLine({ name: name }) + (seller ? destinationLine(seller, visited) : "") + "</div>";
			});
		} else if (branch.kind === "token") html += supplies(branch.token, branch.quantity, visited);
		// The active step already shows its source and recipe button.
		var recipe = branch.kind === "craft" && !visited.has("recipe:" + branch.recipe),
			destination = destinationLine(branch, visited, recipe);
		if (destination) html += "<div class='progression-resource'>" + destination + "</div>";
		if (recipe) {
			visited.add("recipe:" + branch.recipe);
			if (!destination) html += sourceButton(branch);
			if (branch.fee) html += paragraph(t("recipe", { npc: G.npcs[branch.npc].name, gold: to_pretty_num(branch.fee) }));
		}
		if (branch.inputs)
			html +=
				"<div class='progression-ingredients'>" +
				branch.inputs
					.map(function (input) {
						return "<div>" + tree(input, depth + 1, visited, node) + "</div>";
					})
					.join("") +
				"</div>";
		return html;
	}
	root.progression_open = function (a) {
		if (!graphics()) return;
		if (a.kind === "craft") return render_recipe(null, "craft", a.recipe);
		if (a.kind === "dismantle") return render_recipe(null, "dismantle", a.name);
		if (a.kind === "event" && a.modal) return open_guide(a.modal);
		if (a.kind === "event" && G.monsters[a.event]) return render_monster_info(a.event);
		if (a.kind === "farm") return render_monster_info(a.route.monster);
		if (a.kind === "prepare") return G.events[a.monster] && G.events[a.monster].modal ? open_guide(G.events[a.monster].modal) : render_monster_info(a.monster);
		if (articles[a.kind]) return open_guide(articles[a.kind]);
		if (a.name && G.items[a.name]) return render_item_info(a.name, a.level || 0);
		return open_guide("progression-guide");
	};
	function instructions(row, visited) {
		var a = row.action,
			item = a.name && G.items[a.name],
			html = "",
			details = "",
			scroll = a.scroll && G.items[a.scroll],
			npc = a.npc && G.npcs[a.npc];
		if (row.kind === "stat") html += paragraph(t("how.stat", { item: item.name, quantity: a.quantity, scroll: scroll.name, stat: statLabel(G.classes[character.ctype].main_stat) }));
		else if (row.kind === "upgrade") html += paragraph(t("how.upgrade", { item: item.name, scroll: scroll.name }));
		else if (row.kind === "compound") html += paragraph(t("how.compound", { item: item.name, level: a.level - 1, scroll: scroll.name }));
		else if (row.kind === "equip") html += paragraph(t("how.equip", { item: item.name }));
		else if (row.kind === "buy" && npc) html += paragraph(t("how.buy", { quantity: a.quantity || 1, item: item.name, npc: npc.name }));
		else if (row.kind === "supplies") html += paragraph(a.unlock ? t("how.unlock_potions") : t("how.buy", { quantity: a.quantity, item: item.name, npc: npc.name }));
		else if (row.kind === "market") {
			html += paragraph(t("how.market", { npc: npc.name }));
			if (a.quote) {
				var q = a.quote;
				details +=
					"<div class='progression-material'>" +
					item_container({ skin: q.item.name, size: 40, draggable: false }, q.item) +
					"<div>" +
					sourceButton({ name: q.item.name, level: q.item.level || 0 }) +
					"</div></div>";
				details += paragraph(t("market.quote", { quantity: q.quantity, cost: to_pretty_num(q.cost), proceeds: to_pretty_num(q.proceeds), profit: to_pretty_num(q.margin) }));
				details += paragraph(t("market.buyer", { buyer: q.buyer.seller }));
			}
		} else if (row.kind === "shop") html += paragraph(t("how.shop"));
		else if (row.kind === "craft") html += paragraph(t("how.craft", { npc: npc.name }));
		else if (row.kind === "farm") {
			var route = a.route;
			html += paragraph(character.ctype === "merchant" ? t("reason.gold") : t("how.farm", { monster: G.monsters[route.monster].name, map: G.maps[route.map].name || route.map }));
			html += paragraph(t("fight.estimate", { seconds: Math.ceil(route.seconds), loss: Math.ceil((100 * route.loss) / result.stats.max_hp) }));
			if (route.trial) html += paragraph(say(row.reason));
		} else html += paragraph(rowReason(row));
		var link = !["buy", "equip"].includes(row.kind);
		if (row.kind === "buy" && row.target && row.target.level) html += paragraph(t("reason.spares"));
		html = "<div class='progression-step'><div>" + html + "</div><div>" + (destinationLine(a, visited, link) || (link ? sourceButton(a) : "")) + "</div></div>" + details;
		if (row.kind === "craft") visited.add("recipe:" + a.recipe);
		if (scroll) html += supplies(a.scroll, row.kind === "stat" ? a.quantity : 1, visited);
		if (row.kind === "stat" && row.cost) html += paragraph(t("how.stat_shop"));
		var costs = [];
		if ((row.cost || row.kind === "stat") && !a.quote) costs.push(t("price", { gold: to_pretty_num(row.cost) }));
		if (row.cost) costs.push(t("reserve", { gold: to_pretty_num(result.reserve) }));
		if (costs.length)
			html +=
				"<div class='progression-costs'>" +
				costs
					.map(function (cost) {
						return "<span>" + cost + "</span>";
					})
					.join("") +
				"</div>";
		if (row.shortfall) html += paragraph(t("shortfall", { gold: to_pretty_num(row.shortfall) }));
		return html;
	}
	function gains(row) {
		if (!row.gain) return "";
		var html = ["stat", "equip"].includes(row.kind) ? "" : paragraph(t("gain.finish", { item: G.items[row.target.name].name, level: row.target.level || 0 }));
		var changes = [
			[row.gain.metric, row.gain.amount],
			["max_hp", row.gain.hp],
			["armor", row.gain.armor],
			["resistance", row.gain.resistance],
		];
		changes.forEach(function (pair, n) {
			if (
				!pair[1] ||
				changes.slice(0, n).some(function (prior) {
					return prior[0] === pair[0];
				})
			)
				return;
			html +=
				"<div class='progression-change'>" +
				t("gain.stat", {
					stat: "\u2068" + statLabel(pair[0]) + "\u2069",
					before: to_pretty_num(result.stats[pair[0]]),
					after: to_pretty_num(result.stats[pair[0]] + pair[1]),
					change: (pair[1] > 0 ? "+" : "") + to_pretty_num(pair[1]),
				}) +
				"</div>";
		});
		if (row.target.stat_type && row.kind !== "stat" && row.kind !== "equip") html += paragraph(t("gain.stat_needed", { stat: statLabel(row.target.stat_type) }));
		return html;
	}
	root.progression_details = function (n) {
		if (!graphics() || !result) return;
		acknowledge();
		var row = result.rows[n],
			visited = new Set(),
			html = "";
		// Event articles already contain the real instructions, rewards and CODE.
		if (row && (row.kind === "event" || (!row.gain && !row.plan && articles[row.kind] && !["supplies", "shop", "market"].includes(row.kind)))) return progression_open(row.action);
		if (row) {
			html += "<div class='progression-detail-heading'>" + progression_art(row.art, true) + "<div class='title'>" + rowTitle(row) + "</div></div>";
			var why = row.gain ? "" : paragraph(rowReason(row));
			if (row.kind === "farm" && !row.request) {
				var project = result.rows.find(function (r) {
					return r.target;
				});
				if (project) why = paragraph(t("farm.funds", { item: G.items[project.target.name].name }));
			}
			html += section(t("why"), why + gains(row));
			html += section(t("steps"), instructions(row, visited));
			if (row.plan) html += section(t("sources"), tree(row.plan.tree, 0, visited));
			if (row.kind === "farm") {
				var route = row.action.route,
					drops = (G.drops.monsters[route.monster] || []).slice();
				html += section(
					phrase.html("interface.monster_info.drops"),
					"<div class='progression-drops'>" +
						drops
							.map(function (drop) {
								return render_drop(drop, 1, "#666666");
							})
							.join("") +
						"</div>",
				);
				if ((G.drops.maps[route.map] || []).length)
					html +=
						paragraph(html_escape(G.maps[route.map].name)) +
						"<div class='progression-drops'>" +
						G.drops.maps[route.map]
							.map(function (drop) {
								return render_drop(drop, G.monsters[route.monster].hp / 1000, "#666666");
							})
							.join("") +
						"</div>";
			}
		} else {
			html += "<div class='title'>" + goalLabel(result.goal) + "</div>";
			html += paragraph(
				result.goal.kind === "trade" ? t("how.shop") : result.complete ? t("complete") : result.goal.kind === "stat" ? t("goal.explain", { stat: statLabel(result.goal.metric) }) : t("intro"),
			);
			if (result.progress.target !== null) html += "<div class='progression-change'>" + to_pretty_num(result.progress.value) + " / " + to_pretty_num(result.progress.target) + "</div>";
			else
				result.rows.forEach(function (r) {
					html += destinationLine(r.action, visited, true);
				});
			var next = result.lessons.find(function (l) {
				return !l.complete;
			});
			if (next) html += section(t("next", { step: say(next.title) }), paragraph(say(next.reason)));
			// The current suggestions link the route to places the player can use now.
			if (next)
				result.rows.forEach(function (r) {
					html += destinationLine(r.action, visited);
				});
			html += "<div class='progression-lessons'>";
			result.lessons.forEach(function (l) {
				if (l === next) return;
				html +=
					"<div class='progression-lesson'>" +
					progression_art(l.gear && l.gear[0] ? { item: l.gear[0].name } : null) +
					"<div><div class='title'>" +
					(l.complete ? "✓ " : "") +
					say(l.title) +
					"</div>" +
					paragraph(say(l.reason)) +
					"</div></div>";
			});
			html += "</div>" + section(t("choose"), "<div class='progression-choices'>");
			result.choices.forEach(function (g, i) {
				html += "<button type='button' class='gamebutton gamebutton-small' onclick='progression_set_goal(" + i + ")'>" + goalLabel(g) + "</button>";
			});
			html += "</div><p><label for='progression-item'>" + t("goal.item_select") + "</label> <select id='progression-item'>";
			Object.keys(G.items)
				.filter(function (id) {
					return !G.items[id].ignore;
				})
				.sort(function (a, b) {
					return G.items[a].name.localeCompare(G.items[b].name);
				})
				.forEach(function (id) {
					html += "<option value='" + html_escape(id) + "'>" + html_escape(G.items[id].name) + "</option>";
				});
			html +=
				"</select> <label for='progression-level'>+</label><input id='progression-level' type='number' min='0' max='12' value='0' style='width:50px'> <button type='button' class='gamebutton gamebutton-small' onclick='progression_set_goal(\"custom\")'>" +
				t("choose") +
				"</button></p><button type='button' class='gamebutton gamebutton-small' onclick='progression_set_goal(\"auto\")'>" +
				t("automatic") +
				"</button>";
		}
		render_learn_article("<div class='progression-article'>" + html + "</div>", {});
		$(".guide-article:last").addClass("progression-details");
		bindActions($(".progression-article:last"));
		position_modals();
	};
	if (typeof document !== "undefined")
		document.addEventListener("DOMContentLoaded", function () {
			if (!graphics()) return;
			disabled = saved("progression_guide") === "off";
			root.set_progression_guide(!disabled, true);
		});
})(typeof globalThis !== "undefined" ? globalThis : this);
