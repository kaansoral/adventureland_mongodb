(function () {
	"use strict";

	var mapEntries = Object.keys(G.maps)
		.filter(function (id) {
			return !G.maps[id].ignore;
		})
		.map(function (id) {
			return [id, G.maps[id]];
		});
	var monsterEntries = Object.keys(G.monsters).map(function (id) {
		return [id, G.monsters[id]];
	});
	var mapById = {};
	var inboundByMap = {};
	var zonesByMap = {};
	var npcsByMap = {};
	var monsterMaps = {};
	var imagePromises = {};
	var tileCanvases = {};
	var spriteFrames = null;
	var requestedMap = mapIdFromPath();
	var selectedMap = requestedMap && G.maps[requestedMap] && !G.maps[requestedMap].ignore ? requestedMap : G.maps.main && !G.maps.main.ignore ? "main" : mapEntries[0][0];
	var selectedScale = 0;
	var mapObserver = null;
	var mapCards = {};
	var graphNodes = {};
	var focusRenderToken = 0;
	var focusDoorTargets = [];
	var layerState = { connections: true, monsters: true, npcs: true };
	var scaleSteps = [1 / 16, 1 / 12, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3];
	var zonePalette = ["#54bfd9", "#68bd78", "#e8bd58", "#df8754", "#a882e8", "#db6671", "#55a6e8", "#83c55b", "#d778bd", "#d69c54"];
	var annotationColors = {
		arrival: "#54bfd9",
		citizen: "#68bd78",
		doorway: "#e8bd58",
		npc: "#eef4f2",
		transporter: "#a882e8",
	};

	var specialAccess = {
		main: "Starting realm",
		abtesting: "Join the A/B Testing event with join('abtesting')",
		cgallery: "GM-only cosmetics instance",
		d_e: "Dungeon-realm entrance or an enabled Transporter destination",
		duelland: "Accept a duel challenge",
		dungeon0: "GM-only dungeon instance",
		goobrawl: "Join the Goo Brawl event with join('goobrawl')",
		jail: "Reached through a jail action; normal exits are blocked",
		resort: "Activate the lever in Holo Resort",
		shellsisland: "Client loading scene; not entered during normal play",
		ship0: "Available during the Pirate Ship event",
	};

	function mapIdFromPath() {
		var match = window.location.pathname.match(/^\/realm\/([^/]+)\/?$/);
		if (!match) return null;
		try {
			return decodeURIComponent(match[1]);
		} catch (error) {
			return null;
		}
	}

	function syncMapUrl(mapId, replace) {
		var path = "/realm/" + encodeURIComponent(mapId) + window.location.search;
		if (window.location.pathname + window.location.search === path) return;
		window.history[replace ? "replaceState" : "pushState"]({ realmMap: mapId }, "", path);
	}

	mapEntries.forEach(function (entry) {
		mapById[entry[0]] = entry[1];
		inboundByMap[entry[0]] = [];
		zonesByMap[entry[0]] = [];
		npcsByMap[entry[0]] = [];
	});

	mapEntries.forEach(function (entry) {
		var from = entry[0];
		npcsByMap[from] = (entry[1].npcs || []).map(function (placement, index) {
			var definition = G.npcs[placement.id] || {};
			var points = placement.positions || (placement.position ? [placement.position] : []);
			var category = definition.role === "citizen" ? "citizen" : definition.role === "transport" ? "transporter" : "npc";
			return {
				boundary: placement.boundary,
				category: category,
				id: placement.id,
				index: index,
				name: definition.name || placement.name || placement.id,
				points: points.map(function (point) {
					return [point[0], point[1]];
				}),
				role: definition.role || "npc",
			};
		});
		(entry[1].doors || []).forEach(function (door) {
			if (mapById[door[4]]) inboundByMap[door[4]].push({ from: from, door: door });
		});
		(entry[1].monsters || []).forEach(function (pack, packIndex) {
			if (pack.boundary) addZone(from, pack, pack.boundary, "boundary", packIndex);
			if (pack.polygon) addZone(from, pack, pack.polygon, "polygon", packIndex);
			(pack.boundaries || []).forEach(function (boundary, boundaryIndex) {
				if (mapById[boundary[0]]) addZone(boundary[0], pack, boundary.slice(1), "boundary", packIndex + "-" + boundaryIndex);
			});
		});
	});

	function addZone(mapId, pack, shape, kind, key) {
		var zone = {
			count: pack.count,
			kind: kind,
			key: mapId + "-" + pack.type + "-" + key,
			monster: pack.type,
			pack: pack,
			shape: shape,
		};
		zonesByMap[mapId].push(zone);
		if (!monsterMaps[pack.type]) monsterMaps[pack.type] = {};
		monsterMaps[pack.type][mapId] = true;
	}

	function escapeHtml(value) {
		return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function formatNumber(value) {
		if (value === undefined || value === null) return "—";
		if (value >= 1000000000) return trimNumber(value / 1000000000) + "B";
		if (value >= 1000000) return trimNumber(value / 1000000) + "M";
		if (value >= 1000) return trimNumber(value / 1000) + "K";
		return String(value);
	}

	function trimNumber(value) {
		return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
	}

	function uniqueNames(ids) {
		var seen = {};
		return ids
			.filter(function (id) {
				if (seen[id]) return false;
				seen[id] = true;
				return true;
			})
			.map(function (id) {
				return (mapById[id] && mapById[id].name) || id;
			});
	}

	function itemName(id) {
		return (G.items[id] && G.items[id].name) || id;
	}

	function unlockItemFor(mapId) {
		for (var id in G.items) {
			if (G.items[id].unlocks === mapId) return G.items[id].name || id;
		}
		return null;
	}

	function accessText(mapId) {
		var map = mapById[mapId];
		if (specialAccess[mapId]) return specialAccess[mapId];
		var keyed = inboundByMap[mapId].filter(function (link) {
			return link.door[7] === "key";
		});
		if (keyed.length) {
			return (
				"Use " +
				itemName(keyed[0].door[8]) +
				" at " +
				uniqueNames(
					keyed.map(function (link) {
						return link.from;
					}),
				).join(" or ")
			);
		}
		var accountLocked = inboundByMap[mapId].filter(function (link) {
			return link.door[7] === "ulocked";
		});
		if (accountLocked.length) {
			var keyName = unlockItemFor(mapId);
			return (keyName ? "Unlock with " + keyName + "; " : "Account unlock; ") + "enter from " + uniqueNames(accountLocked.map(linkFrom)).join(" or ");
		}
		if (G.npcs.transporter && G.npcs.transporter.places && G.npcs.transporter.places[mapId] !== undefined) return "Travel with Alia the Transporter";
		if (map.event) return "Available during the " + map.event + " event";
		if (inboundByMap[mapId].length) return "Enter from " + uniqueNames(inboundByMap[mapId].map(linkFrom)).join(", ");
		if (map.instance) return "Created as an instance";
		return "No normal entrance is defined";
	}

	function linkFrom(link) {
		return link.from;
	}

	function titleCase(value) {
		return String(value || "NPC")
			.replace(/_/g, " ")
			.replace(/\b\w/g, function (character) {
				return character.toUpperCase();
			});
	}

	function npcRole(npc) {
		if (npc.category === "transporter") return "Transporter";
		if (npc.category === "citizen") return "Citizen";
		return titleCase(npc.role);
	}

	function doorRequirement(door) {
		if (door[7] === "key") return "Consumes " + itemName(door[8]);
		if (door[7] === "ulocked") {
			var unlockName = unlockItemFor(door[4]);
			return unlockName ? "Unlock with " + unlockName : "Requires the account unlock";
		}
		if (door[7] === "protected") return "Protected passage";
		return mapById[door[4]] && mapById[door[4]].instance ? "Creates or joins an instance" : "Direct passage";
	}

	function arrivalsForMap(mapId) {
		var map = mapById[mapId];
		var grouped = {};
		function add(spawnIndex, source, type) {
			var spawn = (map.spawns || [])[spawnIndex];
			if (!spawn) return;
			var key = spawnIndex + ":" + type;
			if (!grouped[key]) grouped[key] = { sources: [], spawn: spawn, spawnIndex: spawnIndex, type: type };
			if (grouped[key].sources.indexOf(source) === -1) grouped[key].sources.push(source);
		}
		(inboundByMap[mapId] || []).forEach(function (link) {
			add(link.door[5], link.from, "passage");
		});
		var transporter = G.npcs.transporter;
		if (transporter && transporter.places && transporter.places[mapId] !== undefined) add(transporter.places[mapId], "transporter", "transport");
		return Object.keys(grouped).map(function (key) {
			var group = grouped[key];
			var names = group.sources.map(function (source) {
				return source === "transporter" ? "Transporter" : (mapById[source] && mapById[source].name) || source;
			});
			return {
				label: "From " + names.join(", "),
				sources: group.sources,
				spawn: group.spawn,
				spawnIndex: group.spawnIndex,
				type: group.type,
			};
		});
	}

	function mapCategory(mapId) {
		var map = mapById[mapId];
		if (map.event || map.instance || map.pvp) return "special";
		if (/^(level|gateway|ucliffs|uhills|mforest)/.test(mapId) || /Underground|Cave|Cove|Crypt|Tomb|Tunnel|Abyss|Deeps/.test(map.name)) return "underground";
		if (map.outside) return "outdoor";
		return "interior";
	}

	function zoneColor(monsterId) {
		var hash = 0;
		for (var i = 0; i < monsterId.length; i++) hash = (hash * 31 + monsterId.charCodeAt(i)) >>> 0;
		return zonePalette[hash % zonePalette.length];
	}

	function hexToRgba(hex, alpha) {
		return "rgba(" + parseInt(hex.slice(1, 3), 16) + "," + parseInt(hex.slice(3, 5), 16) + "," + parseInt(hex.slice(5, 7), 16) + "," + alpha + ")";
	}

	function createSvgElement(name, attributes) {
		var element = document.createElementNS("http://www.w3.org/2000/svg", name);
		for (var key in attributes) element.setAttribute(key, attributes[key]);
		return element;
	}

	function buildConnections() {
		var directLookup = {};
		var edges = [];
		mapEntries.forEach(function (entry) {
			var from = entry[0];
			(entry[1].doors || []).forEach(function (door) {
				var to = door[4];
				if (mapById[to]) directLookup[from + ">" + to] = true;
			});
		});
		var added = {};
		Object.keys(directLookup).forEach(function (key) {
			var parts = key.split(">");
			var from = parts[0];
			var to = parts[1];
			var reverse = directLookup[to + ">" + from];
			var identity = reverse ? [from, to].sort().join("<>") : key;
			if (added[identity]) return;
			added[identity] = true;
			edges.push({ from: from, to: to, type: reverse ? "passage" : "one-way" });
		});

		var transporterHosts = mapEntries
			.filter(function (entry) {
				return (entry[1].npcs || []).some(function (npc) {
					return npc.id === "transporter";
				});
			})
			.map(function (entry) {
				return entry[0];
			});
		var destinations = Object.keys((G.npcs.transporter && G.npcs.transporter.places) || {}).filter(function (id) {
			return mapById[id];
		});
		transporterHosts.forEach(function (from) {
			destinations.forEach(function (to) {
				if (from === to) return;
				var identity = [from, to].sort().join("<>transport");
				if (added[identity]) return;
				added[identity] = true;
				edges.push({ from: from, to: to, type: "transport" });
			});
		});
		return edges;
	}

	function seededPosition(index, total) {
		var angle = index * 2.399963229728653;
		var radius = 130 + 470 * Math.sqrt((index + 1) / total);
		return { x: 750 + Math.cos(angle) * radius, y: 450 + Math.sin(angle) * radius, vx: 0, vy: 0 };
	}

	function layoutGraph(edges) {
		var nodes = mapEntries.map(function (entry, index) {
			var position = seededPosition(index, mapEntries.length);
			return {
				category: mapCategory(entry[0]),
				h: 48,
				id: entry[0],
				label: entry[1].name,
				vx: position.vx,
				vy: position.vy,
				w: Math.max(92, Math.min(190, entry[1].name.length * 9 + 24)),
				x: position.x,
				y: position.y,
			};
		});
		var byId = {};
		nodes.forEach(function (node) {
			byId[node.id] = node;
		});
		for (var step = 0; step < 520; step++) {
			var cooling = 1 - step / 560;
			for (var i = 0; i < nodes.length; i++) {
				var a = nodes[i];
				for (var j = i + 1; j < nodes.length; j++) {
					var b = nodes[j];
					var dx = b.x - a.x;
					var dy = b.y - a.y;
					var distanceSquared = dx * dx + dy * dy + 0.01;
					var distance = Math.sqrt(distanceSquared);
					var minimum = (a.w + b.w) / 2 + 26;
					var force = Math.min(7, 4200 / distanceSquared);
					if (distance < minimum) force += (minimum - distance) * 0.025;
					var fx = (dx / distance) * force;
					var fy = (dy / distance) * force;
					a.vx -= fx;
					a.vy -= fy;
					b.vx += fx;
					b.vy += fy;
				}
			}
			edges.forEach(function (edge) {
				var a = byId[edge.from];
				var b = byId[edge.to];
				var dx = b.x - a.x;
				var dy = b.y - a.y;
				var distance = Math.sqrt(dx * dx + dy * dy) || 1;
				var target = edge.type === "transport" ? 250 : 155;
				var strength = edge.type === "transport" ? 0.002 : 0.008;
				var pull = (distance - target) * strength;
				var fx = (dx / distance) * pull;
				var fy = (dy / distance) * pull;
				a.vx += fx;
				a.vy += fy;
				b.vx -= fx;
				b.vy -= fy;
			});
			nodes.forEach(function (node) {
				node.vx += (750 - node.x) * 0.0008;
				node.vy += (450 - node.y) * 0.0008;
				node.vx *= 0.82;
				node.vy *= 0.82;
				node.x = Math.max(node.w / 2 + 28, Math.min(1472 - node.w / 2, node.x + node.vx * cooling));
				node.y = Math.max(node.h / 2 + 28, Math.min(872 - node.h / 2, node.y + node.vy * cooling));
			});
		}
		return { byId: byId, nodes: nodes };
	}

	function graphEdgePoints(a, b) {
		var dx = b.x - a.x;
		var dy = b.y - a.y;
		var distance = Math.sqrt(dx * dx + dy * dy) || 1;
		var ax = a.x + (dx / distance) * Math.min(a.w / 2, Math.abs(((a.h / 2) * dx) / (dy || 0.01)));
		var ay = a.y + (dy / distance) * Math.min(a.h / 2, Math.abs(((a.w / 2) * dy) / (dx || 0.01)));
		var bx = b.x - (dx / distance) * Math.min(b.w / 2, Math.abs(((b.h / 2) * dx) / (dy || 0.01)));
		var by = b.y - (dy / distance) * Math.min(b.h / 2, Math.abs(((b.w / 2) * dy) / (dx || 0.01)));
		return [ax, ay, bx, by];
	}

	function renderGraph(edges) {
		var svg = document.getElementById("realm-graph");
		var layout = layoutGraph(edges);
		var defs = createSvgElement("defs", {});
		var marker = createSvgElement("marker", { id: "realm-arrow", markerHeight: "7", markerWidth: "7", orient: "auto-start-reverse", refX: "6", refY: "3.5" });
		marker.appendChild(createSvgElement("path", { d: "M0,0 L7,3.5 L0,7 Z", fill: "#df8754" }));
		defs.appendChild(marker);
		svg.appendChild(defs);
		var edgeLayer = createSvgElement("g", { "aria-hidden": "true" });
		edges
			.slice()
			.sort(function (a, b) {
				return a.type === "transport" && b.type !== "transport" ? -1 : 1;
			})
			.forEach(function (edge) {
				var points = graphEdgePoints(layout.byId[edge.from], layout.byId[edge.to]);
				var line = createSvgElement("line", {
					class: "graph-edge " + edge.type,
					x1: points[0].toFixed(1),
					y1: points[1].toFixed(1),
					x2: points[2].toFixed(1),
					y2: points[3].toFixed(1),
				});
				if (edge.type === "one-way") line.setAttribute("marker-end", "url(#realm-arrow)");
				edgeLayer.appendChild(line);
			});
		svg.appendChild(edgeLayer);
		var nodeLayer = createSvgElement("g", {});
		layout.nodes.forEach(function (node) {
			var anchor = createSvgElement("a", { href: "/realm/" + encodeURIComponent(node.id), "data-map": node.id });
			var group = createSvgElement("g", {
				class: "graph-node " + node.category + (node.id === selectedMap ? " is-selected" : ""),
				transform: "translate(" + (node.x - node.w / 2).toFixed(1) + " " + (node.y - node.h / 2).toFixed(1) + ")",
			});
			group.appendChild(createSvgElement("rect", { height: node.h, width: node.w, x: 0, y: 0 }));
			var title = createSvgElement("text", { "text-anchor": "middle", x: node.w / 2, y: 20 });
			title.textContent = node.label.length > 20 ? node.label.slice(0, 19) + "…" : node.label;
			group.appendChild(title);
			var idText = createSvgElement("text", { class: "graph-node-id", "text-anchor": "middle", x: node.w / 2, y: 38 });
			idText.textContent = node.id;
			group.appendChild(idText);
			anchor.appendChild(group);
			nodeLayer.appendChild(anchor);
			graphNodes[node.id] = group;
		});
		svg.appendChild(nodeLayer);
		svg.addEventListener("click", function (event) {
			var anchor = event.target.closest("[data-map]");
			if (!anchor) return;
			event.preventDefault();
			selectMap(anchor.getAttribute("data-map"), true);
		});
	}

	function imageFor(url) {
		if (!imagePromises[url]) {
			imagePromises[url] = new Promise(function (resolve, reject) {
				var image = new Image();
				image.onload = function () {
					resolve(image);
				};
				image.onerror = reject;
				image.src = url;
			});
		}
		return imagePromises[url];
	}

	function tileDimensions(definition) {
		if (Array.isArray(definition[3])) return [definition[3][0], definition[3][1]];
		return [definition[3], definition[4] === undefined ? definition[3] : definition[4]];
	}

	function tileCanvas(definition, image) {
		var dimensions = tileDimensions(definition);
		var key = [definition[0], definition[1], definition[2], dimensions[0], dimensions[1]].join("|");
		if (tileCanvases[key]) return tileCanvases[key];
		var canvas = document.createElement("canvas");
		canvas.width = dimensions[0];
		canvas.height = dimensions[1];
		var context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;
		context.drawImage(image, definition[1], definition[2], dimensions[0], dimensions[1], 0, 0, dimensions[0], dimensions[1]);
		tileCanvases[key] = canvas;
		return canvas;
	}

	function geometryBounds(mapId, geometry) {
		var minX = isFinite(geometry.min_x) ? geometry.min_x : Infinity;
		var minY = isFinite(geometry.min_y) ? geometry.min_y : Infinity;
		var maxX = isFinite(geometry.max_x) ? geometry.max_x : -Infinity;
		var maxY = isFinite(geometry.max_y) ? geometry.max_y : -Infinity;
		function include(x, y) {
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
		(zonesByMap[mapId] || []).forEach(function (zone) {
			if (zone.kind === "boundary") {
				include(zone.shape[0], zone.shape[1]);
				include(zone.shape[2], zone.shape[3]);
			} else {
				zone.shape.forEach(function (point) {
					include(point[0], point[1]);
				});
			}
		});
		(mapById[mapId].doors || []).forEach(function (door) {
			include(door[0] - door[2] / 2, door[1] - door[3]);
			include(door[0] + door[2] / 2, door[1]);
		});
		(npcsByMap[mapId] || []).forEach(function (npc) {
			npc.points.forEach(function (point) {
				include(point[0], point[1]);
			});
			if (npc.boundary) {
				include(npc.boundary[0], npc.boundary[1]);
				include(npc.boundary[2], npc.boundary[3]);
			}
		});
		(mapById[mapId].spawns || []).forEach(function (spawn) {
			include(spawn[0], spawn[1]);
		});
		if (!isFinite(minX) || !isFinite(maxX)) return null;
		var padding = 24;
		return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
	}

	function drawTileArea(context, geometry, placement, images) {
		var definition = geometry.tiles[placement[0]];
		if (!definition || !images[definition[0]]) return;
		var dimensions = tileDimensions(definition);
		var tile = tileCanvas(definition, images[definition[0]]);
		if (placement[3] === undefined || placement[3] === null) {
			context.drawImage(tile, placement[1], placement[2]);
			return;
		}
		context.save();
		context.translate(placement[1], placement[2]);
		context.fillStyle = context.createPattern(tile, "repeat");
		context.fillRect(0, 0, placement[3] - placement[1] + dimensions[0], placement[4] - placement[2] + dimensions[1]);
		context.restore();
	}

	function drawMapTiles(context, geometry, bounds, images) {
		if (geometry.default !== undefined && geometry.tiles[geometry.default]) {
			var definition = geometry.tiles[geometry.default];
			var image = images[definition[0]];
			if (image) {
				var backgroundTile = tileCanvas(definition, image);
				context.save();
				context.translate(bounds.minX, bounds.minY);
				context.fillStyle = context.createPattern(backgroundTile, "repeat");
				context.fillRect(0, 0, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
				context.restore();
			}
		}
		(geometry.placements || []).forEach(function (placement) {
			drawTileArea(context, geometry, placement, images);
		});
		(geometry.animations || []).forEach(function (placement) {
			drawTileArea(context, geometry, placement, images);
		});
		(geometry.groups || []).forEach(function (group) {
			group.forEach(function (placement) {
				drawTileArea(context, geometry, placement, images);
			});
		});
	}

	function zoneCenter(zone) {
		if (zone.kind === "boundary") return [(zone.shape[0] + zone.shape[2]) / 2, (zone.shape[1] + zone.shape[3]) / 2];
		var total = zone.shape.reduce(
			function (result, point) {
				return [result[0] + point[0], result[1] + point[1]];
			},
			[0, 0],
		);
		return [total[0] / zone.shape.length, total[1] / zone.shape.length];
	}

	function canvasPoint(point, bounds, scale) {
		return [(point[0] - bounds.minX) * scale, (point[1] - bounds.minY) * scale];
	}

	function labelsOverlap(a, b) {
		return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
	}

	function shortLabel(value) {
		return value.length > 34 ? value.slice(0, 33) + "…" : value;
	}

	function drawCanvasLabel(context, value, anchorX, anchorY, color, occupied) {
		var label = shortLabel(value);
		context.font = "14px pixel, monospace";
		context.textAlign = "center";
		context.textBaseline = "middle";
		var width = context.measureText(label).width + 10;
		var height = 21;
		var placements = [
			[0, -18],
			[0, 18],
			[width / 2 + 9, 0],
			[-width / 2 - 9, 0],
			[width / 2 + 9, -18],
			[-width / 2 - 9, -18],
			[width / 2 + 9, 18],
			[-width / 2 - 9, 18],
		];
		var box = null;
		for (var i = 0; i < placements.length; i++) {
			var centerX = Math.max(width / 2 + 3, Math.min(context.canvas.width - width / 2 - 3, anchorX + placements[i][0]));
			var centerY = Math.max(height / 2 + 3, Math.min(context.canvas.height - height / 2 - 3, anchorY + placements[i][1]));
			var candidate = { h: height, w: width, x: centerX - width / 2, y: centerY - height / 2 };
			var collision = occupied.some(function (other) {
				return labelsOverlap(candidate, other);
			});
			if (!collision || i === placements.length - 1) {
				box = candidate;
				break;
			}
		}
		var labelX = box.x + box.w / 2;
		var labelY = box.y + box.h / 2;
		if (Math.abs(labelX - anchorX) > 3 || Math.abs(labelY - anchorY) > 3) {
			context.beginPath();
			context.moveTo(anchorX, anchorY);
			context.lineTo(labelX, labelY);
			context.strokeStyle = color;
			context.lineWidth = 1;
			context.stroke();
		}
		context.fillStyle = "rgba(4, 8, 10, 0.9)";
		context.fillRect(box.x, box.y, box.w, box.h);
		context.strokeStyle = color;
		context.lineWidth = 2;
		context.strokeRect(box.x, box.y, box.w, box.h);
		context.fillStyle = "#f4f7f5";
		context.fillText(label, labelX, labelY + 1);
		occupied.push(box);
		return box;
	}

	function drawZones(context, mapId, bounds, scale, labels, occupied) {
		(zonesByMap[mapId] || []).forEach(function (zone) {
			var color = zoneColor(zone.monster);
			context.save();
			context.scale(scale, scale);
			context.translate(-bounds.minX, -bounds.minY);
			context.beginPath();
			if (zone.kind === "boundary") {
				var width = Math.max(12 / scale, zone.shape[2] - zone.shape[0]);
				var height = Math.max(12 / scale, zone.shape[3] - zone.shape[1]);
				context.rect(zone.shape[0] - (width - (zone.shape[2] - zone.shape[0])) / 2, zone.shape[1] - (height - (zone.shape[3] - zone.shape[1])) / 2, width, height);
			} else {
				zone.shape.forEach(function (point, pointIndex) {
					if (pointIndex) context.lineTo(point[0], point[1]);
					else context.moveTo(point[0], point[1]);
				});
				context.closePath();
			}
			context.fillStyle = hexToRgba(color, labels ? 0.2 : 0.28);
			context.strokeStyle = color;
			context.lineWidth = (labels ? 3 : 2) / scale;
			context.fill();
			context.stroke();
			context.restore();

			if (!labels) return;
			var center = zoneCenter(zone);
			var point = canvasPoint(center, bounds, scale);
			var monster = G.monsters[zone.monster];
			var label = (monster && monster.name) || zone.monster;
			if (zone.count !== undefined) label += " ×" + zone.count;
			drawCanvasLabel(context, label, point[0], point[1], color, occupied);
		});
	}

	function drawConnections(context, mapId, bounds, scale, labels, occupied, doorTargets) {
		(mapById[mapId].doors || []).forEach(function (door) {
			var point = canvasPoint(door, bounds, scale);
			var width = Math.max(7, door[2] * scale);
			var height = Math.max(8, door[3] * scale);
			context.fillStyle = hexToRgba(annotationColors.doorway, 0.18);
			context.strokeStyle = annotationColors.doorway;
			context.lineWidth = labels ? 3 : 2;
			context.fillRect(point[0] - width / 2, point[1] - height, width, height);
			context.strokeRect(point[0] - width / 2, point[1] - height, width, height);
			var labelBox = null;
			if (labels) labelBox = drawCanvasLabel(context, "To " + ((mapById[door[4]] && mapById[door[4]].name) || door[4]), point[0], point[1] - height / 2, annotationColors.doorway, occupied);
			if (doorTargets && mapById[door[4]]) {
				doorTargets.push({
					h: Math.max(32, height),
					labelBox: labelBox,
					mapId: door[4],
					w: Math.max(28, width),
					x: point[0],
					y: point[1] - height / 2,
				});
			}
		});
		arrivalsForMap(mapId).forEach(function (arrival) {
			var point = canvasPoint(arrival.spawn, bounds, scale);
			var radius = labels ? 7 : 5;
			context.beginPath();
			context.moveTo(point[0], point[1] - radius);
			context.lineTo(point[0] + radius, point[1]);
			context.lineTo(point[0], point[1] + radius);
			context.lineTo(point[0] - radius, point[1]);
			context.closePath();
			context.fillStyle = annotationColors.arrival;
			context.strokeStyle = "#080b0d";
			context.lineWidth = 2;
			context.fill();
			context.stroke();
			if (labels) drawCanvasLabel(context, arrival.label, point[0], point[1], annotationColors.arrival, occupied);
		});
	}

	function drawNpcs(context, mapId, bounds, scale, labels, occupied) {
		(npcsByMap[mapId] || []).forEach(function (npc) {
			var color = annotationColors[npc.category];
			if (npc.boundary) {
				var boundaryStart = canvasPoint(npc.boundary, bounds, scale);
				var boundaryEnd = canvasPoint([npc.boundary[2], npc.boundary[3]], bounds, scale);
				context.save();
				context.setLineDash([5, 4]);
				context.strokeStyle = hexToRgba(color, 0.72);
				context.lineWidth = labels ? 2 : 1;
				context.strokeRect(boundaryStart[0], boundaryStart[1], boundaryEnd[0] - boundaryStart[0], boundaryEnd[1] - boundaryStart[1]);
				context.restore();
			}
			if (!npc.points.length) return;
			if (npc.points.length > 1) {
				context.save();
				context.beginPath();
				npc.points.forEach(function (routePoint, index) {
					var point = canvasPoint(routePoint, bounds, scale);
					if (index) context.lineTo(point[0], point[1]);
					else context.moveTo(point[0], point[1]);
				});
				context.setLineDash([6, 5]);
				context.strokeStyle = hexToRgba(color, labels ? 0.88 : 0.7);
				context.lineWidth = labels ? 3 : 2;
				context.stroke();
				context.restore();
			}
			var marker = canvasPoint(npc.points[0], bounds, scale);
			var radius = labels ? 7 : 5;
			context.beginPath();
			if (npc.category === "npc") context.rect(marker[0] - radius, marker[1] - radius, radius * 2, radius * 2);
			else context.arc(marker[0], marker[1], radius, 0, Math.PI * 2);
			context.fillStyle = color;
			context.strokeStyle = "#080b0d";
			context.lineWidth = 2;
			context.fill();
			context.stroke();
			if (labels) drawCanvasLabel(context, npc.name, marker[0], marker[1], color, occupied);
		});
	}

	function fitScale(width, height, maxWidth, maxHeight) {
		var availableScale = Math.min(maxWidth / width, maxHeight / height);
		var selected = scaleSteps[0];
		for (var i = 0; i < scaleSteps.length; i++) {
			if (scaleSteps[i] <= availableScale) selected = scaleSteps[i];
		}
		return selected;
	}

	function loadTilesetImages(geometry) {
		var ids = {};
		(geometry.tiles || []).forEach(function (definition) {
			if (definition && G.tilesets[definition[0]]) ids[definition[0]] = true;
		});
		return Promise.all(
			Object.keys(ids).map(function (id) {
				return imageFor(G.tilesets[id].file)
					.then(function (image) {
						return [id, image];
					})
					.catch(function () {
						return [id, null];
					});
			}),
		).then(function (entries) {
			var images = {};
			entries.forEach(function (entry) {
				images[entry[0]] = entry[1];
			});
			return images;
		});
	}

	function renderMapCanvas(canvas, mapId, options) {
		var geometry = G.geometry[mapId];
		if (!geometry || !geometry.tiles || !geometry.placements) return Promise.resolve(false);
		var bounds = geometryBounds(mapId, geometry);
		if (!bounds) return Promise.resolve(false);
		var width = bounds.maxX - bounds.minX;
		var height = bounds.maxY - bounds.minY;
		var scale = options.scale || fitScale(width, height, options.maxWidth, options.maxHeight);
		canvas.width = Math.max(1, Math.ceil(width * scale));
		canvas.height = Math.max(1, Math.ceil(height * scale));
		canvas.style.width = canvas.width + "px";
		canvas.style.height = canvas.height + "px";
		var context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;
		context.fillStyle = "#080b0d";
		context.fillRect(0, 0, canvas.width, canvas.height);
		return loadTilesetImages(geometry).then(function (images) {
			context.save();
			context.imageSmoothingEnabled = false;
			context.scale(scale, scale);
			context.translate(-bounds.minX, -bounds.minY);
			drawMapTiles(context, geometry, bounds, images);
			context.restore();
			var layers = options.layers || { connections: true, monsters: true, npcs: true };
			var occupied = [];
			if (layers.monsters) drawZones(context, mapId, bounds, scale, !!options.labels, occupied);
			if (layers.connections) drawConnections(context, mapId, bounds, scale, !!options.labels, occupied, options.doorTargets);
			if (layers.npcs) drawNpcs(context, mapId, bounds, scale, !!options.labels, occupied);
			return { bounds: bounds, scale: scale };
		});
	}

	function annotationRow(category, title, detail, suffix, mapId) {
		var titleMarkup = mapId ? '<button type="button" data-map="' + escapeHtml(mapId) + '">' + escapeHtml(title) + "</button>" : "<strong>" + escapeHtml(title) + "</strong>";
		return (
			'<div class="annotation-row"><i class="annotation-swatch ' +
			category +
			'"></i><div class="annotation-copy">' +
			titleMarkup +
			"<span>" +
			escapeHtml(detail) +
			"</span></div>" +
			(suffix ? '<span class="annotation-suffix">' + escapeHtml(suffix) + "</span>" : "") +
			"</div>"
		);
	}

	function renderConnectionList(mapId) {
		var list = document.getElementById("focus-connection-list");
		var rows = (mapById[mapId].doors || []).map(function (door) {
			var destination = (mapById[door[4]] && mapById[door[4]].name) || door[4];
			return annotationRow("doorway", "To " + destination, doorRequirement(door), "door", mapById[door[4]] ? door[4] : null);
		});
		arrivalsForMap(mapId).forEach(function (arrival) {
			var detail = (arrival.type === "transport" ? "Transporter arrival" : "Passage arrival") + " · spawn " + arrival.spawnIndex;
			rows.push(annotationRow("arrival", arrival.label, detail, "entry"));
		});
		list.innerHTML = rows.length ? rows.join("") : '<p class="zone-empty">No doorway or arrival is defined.</p>';
	}

	function renderNpcList(mapId) {
		var list = document.getElementById("focus-npc-list");
		var rows = (npcsByMap[mapId] || []).map(function (npc) {
			var detail = npcRole(npc) + " · " + npc.id;
			if (npc.points.length > 1) detail += " · " + npc.points.length + " route points";
			if (npc.boundary) detail += " · roaming area";
			return annotationRow(npc.category, npc.name, detail, "NPC");
		});
		list.innerHTML = rows.length ? rows.join("") : '<p class="zone-empty">No NPC placement is defined.</p>';
	}

	function renderZoneList(mapId) {
		var list = document.getElementById("focus-zone-list");
		var zones = zonesByMap[mapId] || [];
		if (!zones.length) {
			list.innerHTML = '<p class="zone-empty">No fixed monster territory.</p>';
			return;
		}
		list.innerHTML = zones
			.map(function (zone) {
				var monster = G.monsters[zone.monster] || { name: zone.monster };
				var count = zone.count === undefined ? "dynamic" : "×" + zone.count;
				return (
					'<div class="zone-row"><i class="zone-swatch" style="background:' +
					zoneColor(zone.monster) +
					'"></i><button type="button" data-monster="' +
					escapeHtml(zone.monster) +
					'">' +
					escapeHtml(monster.name) +
					'</button><span class="zone-count">' +
					escapeHtml(count) +
					"</span></div>"
				);
			})
			.join("");
	}

	function scaleLabel(scale) {
		if (scale >= 1) return scale + "×";
		return "1:" + Math.round(1 / scale);
	}

	function renderFocusMap() {
		var mapId = selectedMap;
		var map = mapById[mapId];
		focusDoorTargets = [];
		document.getElementById("focus-map-id").textContent = mapId;
		document.getElementById("focus-map-name").textContent = map.name;
		document.getElementById("focus-map-access").textContent = accessText(mapId);
		renderConnectionList(mapId);
		renderNpcList(mapId);
		renderZoneList(mapId);
		var canvas = document.getElementById("focus-map-canvas");
		var empty = document.getElementById("focus-map-empty");
		var geometry = G.geometry[mapId];
		if (!geometry) {
			canvas.hidden = true;
			empty.hidden = false;
			document.getElementById("map-scale").textContent = "—";
			return;
		}
		var bounds = geometryBounds(mapId, geometry);
		if (!bounds) return;
		if (!selectedScale) selectedScale = fitScale(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1260, 760);
		canvas.hidden = false;
		empty.hidden = true;
		document.getElementById("map-scale").textContent = scaleLabel(selectedScale);
		var token = ++focusRenderToken;
		var doorTargets = [];
		renderMapCanvas(canvas, mapId, { doorTargets: doorTargets, labels: true, layers: layerState, maxHeight: 760, maxWidth: 1260, scale: selectedScale }).then(function (result) {
			if (token !== focusRenderToken || !result) return;
			focusDoorTargets = doorTargets;
			canvas.setAttribute(
				"aria-label",
				map.name + " at " + scaleLabel(result.scale) + " scale with " + zonesByMap[mapId].length + " monster zones, " + (map.doors || []).length + " doors, and " + npcsByMap[mapId].length + " NPCs",
			);
		});
	}

	function selectMap(mapId, scroll, updateUrl) {
		if (!mapById[mapId]) return;
		if (mapCards[selectedMap]) mapCards[selectedMap].classList.remove("is-selected");
		if (graphNodes[selectedMap]) graphNodes[selectedMap].classList.remove("is-selected");
		selectedMap = mapId;
		selectedScale = 0;
		if (mapCards[selectedMap]) mapCards[selectedMap].classList.add("is-selected");
		if (graphNodes[selectedMap]) graphNodes[selectedMap].classList.add("is-selected");
		if (updateUrl !== false) syncMapUrl(mapId, false);
		var viewport = document.getElementById("focus-map-viewport");
		viewport.scrollLeft = 0;
		viewport.scrollTop = 0;
		renderFocusMap();
		if (scroll) document.getElementById("map-focus").scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function mapMonsterNames(mapId) {
		var seen = {};
		return (zonesByMap[mapId] || [])
			.map(function (zone) {
				return zone.monster;
			})
			.filter(function (id) {
				if (seen[id]) return false;
				seen[id] = true;
				return true;
			})
			.map(function (id) {
				return (G.monsters[id] && G.monsters[id].name) || id;
			});
	}

	function renderMapCard(mapId, map) {
		var card = document.createElement("button");
		card.type = "button";
		card.className = "map-card " + mapCategory(mapId) + (mapId === selectedMap ? " is-selected" : "");
		card.setAttribute("data-map-id", mapId);
		var monsters = mapMonsterNames(mapId);
		var npcNames = (npcsByMap[mapId] || []).map(function (npc) {
			return npc.name + " " + npc.id + " " + npcRole(npc);
		});
		card.setAttribute("data-search", [mapId, map.name, accessText(mapId)].concat(monsters, npcNames).join(" ").toLowerCase());
		card.innerHTML =
			'<span class="map-card-canvas"><canvas width="330" height="220" aria-label="' +
			escapeHtml(map.name) +
			' map preview"></canvas></span><span class="map-card-copy"><span class="map-card-title"><strong>' +
			escapeHtml(map.name) +
			"</strong><code>" +
			escapeHtml(mapId) +
			'</code></span><span class="map-card-meta">' +
			monsters.length +
			" monster" +
			(monsters.length === 1 ? "" : "s") +
			" · " +
			npcsByMap[mapId].length +
			" NPC" +
			(npcsByMap[mapId].length === 1 ? "" : "s") +
			" · " +
			(map.doors || []).length +
			" exit" +
			((map.doors || []).length === 1 ? "" : "s") +
			'</span><span class="map-card-access">' +
			escapeHtml(accessText(mapId)) +
			"</span></span>";
		card.addEventListener("click", function () {
			selectMap(mapId, true);
		});
		mapCards[mapId] = card;
		return card;
	}

	function renderMapPreview(card) {
		if (card.getAttribute("data-rendered")) return;
		card.setAttribute("data-rendered", "1");
		var mapId = card.getAttribute("data-map-id");
		var canvas = card.querySelector("canvas");
		renderMapCanvas(canvas, mapId, { labels: false, layers: { connections: true, monsters: true, npcs: true }, maxHeight: 210, maxWidth: 330 }).then(function (result) {
			if (result) return;
			var context = canvas.getContext("2d");
			context.fillStyle = "#080b0d";
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = "#9aabb0";
			context.font = "16px pixel, monospace";
			context.textAlign = "center";
			context.fillText("Geometry unavailable", canvas.width / 2, canvas.height / 2);
		});
	}

	function buildMapGrid() {
		var grid = document.getElementById("map-grid");
		mapEntries
			.slice()
			.sort(function (a, b) {
				if (a[0] === "main") return -1;
				if (b[0] === "main") return 1;
				return a[1].name.localeCompare(b[1].name);
			})
			.forEach(function (entry) {
				grid.appendChild(renderMapCard(entry[0], entry[1]));
			});
		if ("IntersectionObserver" in window) {
			mapObserver = new IntersectionObserver(
				function (entries) {
					entries.forEach(function (entry) {
						if (!entry.isIntersecting) return;
						renderMapPreview(entry.target);
						mapObserver.unobserve(entry.target);
					});
				},
				{ rootMargin: "400px" },
			);
			Object.keys(mapCards).forEach(function (id) {
				mapObserver.observe(mapCards[id]);
			});
		} else {
			Object.keys(mapCards).forEach(function (id) {
				renderMapPreview(mapCards[id]);
			});
		}
	}

	function buildSpriteFrames() {
		if (spriteFrames) return spriteFrames;
		spriteFrames = {};
		Object.keys(G.sprites).forEach(function (spriteId) {
			var definition = G.sprites[spriteId];
			if (definition.skip) return;
			var rowFrames = 4;
			var columnFrames = 3;
			if (definition.type === "animation") rowFrames = 1;
			if (definition.type === "tail") columnFrames = 4;
			if (["v_animation", "head", "hair", "hat", "s_wings", "face", "makeup", "beard", "emblem", "gravestone"].indexOf(definition.type) !== -1) columnFrames = 1;
			if (["a_makeup", "a_hat"].indexOf(definition.type) !== -1) columnFrames = 3;
			if (["emblem", "gravestone"].indexOf(definition.type) !== -1) rowFrames = 1;
			var imageInfo = G.images[definition.file.split("?")[0]] || {};
			var sheetWidth = imageInfo.width || definition.width;
			var sheetHeight = imageInfo.height || definition.height;
			if (!sheetWidth || !sheetHeight) return;
			(definition.matrix || []).forEach(function (row, rowIndex) {
				(row || []).forEach(function (skin, columnIndex) {
					if (!skin) return;
					var groupWidth = sheetWidth / definition.columns;
					var groupHeight = sheetHeight / definition.rows;
					var frameWidth = groupWidth / columnFrames;
					var frameHeight = groupHeight / rowFrames;
					var visibleWidth = frameWidth;
					var visibleHeight = frameHeight;
					var offsetX = 0;
					if (G.dimensions[skin]) {
						visibleWidth = G.dimensions[skin][0];
						visibleHeight = G.dimensions[skin][1];
						offsetX = G.dimensions[skin][2] || 0;
					}
					spriteFrames[skin] = {
						file: definition.file,
						h: visibleHeight,
						sx: columnIndex * groupWidth + (columnFrames === 1 ? 0 : frameWidth) + (frameWidth - visibleWidth) / 2 + offsetX,
						sy: rowIndex * groupHeight + frameHeight - visibleHeight,
						w: visibleWidth,
					};
				});
			});
		});
		return spriteFrames;
	}

	function renderMonsterSprite(canvas, monsterId) {
		var monster = G.monsters[monsterId];
		var frame = buildSpriteFrames()[monster.skin];
		var context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, canvas.width, canvas.height);
		if (!frame) {
			context.fillStyle = "#9aabb0";
			context.font = "18px pixel, monospace";
			context.textAlign = "center";
			context.fillText("?", canvas.width / 2, canvas.height / 2 + 6);
			return;
		}
		imageFor(frame.file)
			.then(function (image) {
				var scale = Math.max(1, Math.min(3, Math.floor(Math.min(76 / frame.w, 88 / frame.h))));
				var width = Math.round(frame.w * scale);
				var height = Math.round(frame.h * scale);
				context.drawImage(
					image,
					Math.round(frame.sx),
					Math.round(frame.sy),
					Math.round(frame.w),
					Math.round(frame.h),
					Math.round((canvas.width - width) / 2),
					canvas.height - height - 8,
					width,
					height,
				);
			})
			.catch(function () {});
	}

	function monsterLocationText(monsterId, monster) {
		var ids = Object.keys(monsterMaps[monsterId] || {});
		if (ids.length) return uniqueNames(ids).join(", ");
		if (monster.explanation) return monster.explanation;
		if (monster.respawn === -1 || monster.global || monster.announce) return "Dynamic or event spawn; no fixed territory";
		return "No fixed map territory";
	}

	function renderMonsterCard(monsterId, monster) {
		var card = document.createElement("article");
		card.className = "monster-card";
		var locations = monsterLocationText(monsterId, monster);
		card.setAttribute("data-search", [monsterId, monster.name, locations].join(" ").toLowerCase());
		card.innerHTML =
			'<div class="monster-sprite"><canvas width="86" height="112" aria-label="' +
			escapeHtml(monster.name) +
			' sprite"></canvas></div><div class="monster-copy"><div class="monster-name"><strong>' +
			escapeHtml(monster.name) +
			"</strong><code>" +
			escapeHtml(monsterId) +
			'</code></div><div class="monster-stats"><span>HP<strong>' +
			formatNumber(monster.hp) +
			"</strong></span><span>Attack<strong>" +
			formatNumber(monster.attack) +
			'</strong></span></div><p class="monster-locations">' +
			escapeHtml(locations) +
			"</p></div>";
		renderMonsterSprite(card.querySelector("canvas"), monsterId);
		return card;
	}

	function buildMonsterGrid() {
		var grid = document.getElementById("monster-grid");
		monsterEntries
			.slice()
			.sort(function (a, b) {
				return a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]);
			})
			.forEach(function (entry) {
				grid.appendChild(renderMonsterCard(entry[0], entry[1]));
			});
	}

	function bindSearch(inputId, gridId, countId, noun) {
		var input = document.getElementById(inputId);
		var grid = document.getElementById(gridId);
		var count = document.getElementById(countId);
		function filter() {
			var query = input.value.trim().toLowerCase();
			var shown = 0;
			Array.prototype.forEach.call(grid.children, function (child) {
				var visible = !query || child.getAttribute("data-search").indexOf(query) !== -1;
				child.hidden = !visible;
				if (visible) shown++;
			});
			count.textContent = shown + " " + noun + (shown === 1 ? "" : "s");
		}
		input.addEventListener("input", filter);
		filter();
	}

	function changeScale(direction) {
		var index = scaleSteps.indexOf(selectedScale);
		if (index === -1) index = scaleSteps.indexOf(1);
		index = Math.max(0, Math.min(scaleSteps.length - 1, index + direction));
		if (scaleSteps[index] === selectedScale) return;
		selectedScale = scaleSteps[index];
		renderFocusMap();
	}

	function canvasPointFromEvent(event) {
		var canvas = document.getElementById("focus-map-canvas");
		var rect = canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) * canvas.width) / rect.width,
			y: ((event.clientY - rect.top) * canvas.height) / rect.height,
		};
	}

	function pointInBox(point, box) {
		return box && point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;
	}

	function doorTargetFromEvent(event) {
		var point = canvasPointFromEvent(event);
		for (var i = focusDoorTargets.length - 1; i >= 0; i--) {
			var target = focusDoorTargets[i];
			var hitBox = { h: target.h, w: target.w, x: target.x - target.w / 2, y: target.y - target.h / 2 };
			if (pointInBox(point, hitBox) || pointInBox(point, target.labelBox)) return target;
		}
		return null;
	}

	function bindMapPanning() {
		var viewport = document.getElementById("focus-map-viewport");
		var canvas = document.getElementById("focus-map-canvas");
		var drag = null;
		viewport.addEventListener("pointerdown", function (event) {
			if (event.button !== 0 || event.target !== canvas) return;
			canvas.classList.remove("is-door-hover");
			drag = {
				door: doorTargetFromEvent(event),
				moved: false,
				pointerId: event.pointerId,
				scrollLeft: viewport.scrollLeft,
				scrollTop: viewport.scrollTop,
				x: event.clientX,
				y: event.clientY,
			};
			viewport.classList.add("is-panning");
			viewport.setPointerCapture(event.pointerId);
			event.preventDefault();
		});
		viewport.addEventListener("pointermove", function (event) {
			if (drag && drag.pointerId === event.pointerId) {
				var deltaX = event.clientX - drag.x;
				var deltaY = event.clientY - drag.y;
				if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true;
				viewport.scrollLeft = drag.scrollLeft - deltaX;
				viewport.scrollTop = drag.scrollTop - deltaY;
				event.preventDefault();
				return;
			}
			canvas.classList.toggle("is-door-hover", !!doorTargetFromEvent(event));
		});
		function finishDrag(event, cancelled) {
			if (!drag || drag.pointerId !== event.pointerId) return;
			var destination = !cancelled && !drag.moved && drag.door && doorTargetFromEvent(event);
			viewport.classList.remove("is-panning");
			if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
			drag = null;
			if (destination) selectMap(destination.mapId, false);
		}
		viewport.addEventListener("pointerup", function (event) {
			finishDrag(event, false);
		});
		viewport.addEventListener("pointercancel", function (event) {
			finishDrag(event, true);
		});
		viewport.addEventListener("pointerleave", function () {
			if (!drag) canvas.classList.remove("is-door-hover");
		});
	}

	function bindControls() {
		document.getElementById("map-zoom-out").addEventListener("click", function () {
			changeScale(-1);
		});
		document.getElementById("map-zoom-in").addEventListener("click", function () {
			changeScale(1);
		});
		[
			["layer-monsters", "monsters"],
			["layer-connections", "connections"],
			["layer-npcs", "npcs"],
		].forEach(function (control) {
			document.getElementById(control[0]).addEventListener("change", function (event) {
				layerState[control[1]] = event.target.checked;
				renderFocusMap();
			});
		});
		document.getElementById("focus-zone-list").addEventListener("click", function (event) {
			var button = event.target.closest("[data-monster]");
			if (!button) return;
			document.getElementById("monster-search").value = button.getAttribute("data-monster");
			document.getElementById("monster-search").dispatchEvent(new Event("input"));
			document.getElementById("bestiary").scrollIntoView({ behavior: "smooth", block: "start" });
		});
		document.getElementById("focus-connection-list").addEventListener("click", function (event) {
			var button = event.target.closest("[data-map]");
			if (button) selectMap(button.getAttribute("data-map"), false);
		});
		window.addEventListener("popstate", function () {
			var mapId = mapIdFromPath();
			if (mapById[mapId]) selectMap(mapId, false, false);
		});
		bindMapPanning();
	}

	function init() {
		var edges = buildConnections();
		document.getElementById("map-total").textContent = mapEntries.length;
		document.getElementById("monster-total").textContent = monsterEntries.length;
		document.getElementById("npc-total").textContent = Object.keys(npcsByMap).reduce(function (total, mapId) {
			return total + npcsByMap[mapId].length;
		}, 0);
		document.getElementById("zone-total").textContent = Object.keys(zonesByMap).reduce(function (total, mapId) {
			return total + zonesByMap[mapId].length;
		}, 0);
		document.getElementById("connection-total").textContent = edges.length;
		renderGraph(edges);
		buildMapGrid();
		buildMonsterGrid();
		bindSearch("map-search", "map-grid", "map-result-count", "map");
		bindSearch("monster-search", "monster-grid", "monster-result-count", "monster");
		bindControls();
		syncMapUrl(selectedMap, true);
		renderFocusMap();
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
})();
