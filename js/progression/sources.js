/* Shared acquisition facts for item INFO and progression. No account access. */
(function (root) {
	"use strict";
	var cache = new WeakMap();
	function create(G) {
		var parents = Object.create(null),
			recipes = Object.create(null),
			dismantles = Object.create(null),
			found = Object.create(null),
			locations = Object.create(null),
			routes = [];
		function questNpc(quest, fallback) {
			return (
				Object.keys(G.npcs || {}).find(function (id) {
					return !G.npcs[id].ignore && G.npcs[id].quest === quest;
				}) || fallback
			);
		}
		Object.keys(G.maps || {}).forEach(function (map) {
			var def = G.maps[map];
			if (def.ignore) return;
			(def.npcs || []).concat(def.seasonal_npcs || []).forEach(function (n) {
				(locations[n.id] || (locations[n.id] = [])).push({ map: map, position: n.position });
			});
			(def.monsters || []).forEach(function (spawn, n) {
				if (!(spawn.count > 0) || !G.monsters[spawn.type]) return;
				var boxes = spawn.boundaries || (spawn.boundary ? [[map].concat(spawn.boundary)] : []);
				boxes.forEach(function (box, i) {
					if (!G.maps[box[0]] || G.maps[box[0]].ignore) return;
					routes.push({ id: map + ":" + n + ":" + i, map: box[0], monster: spawn.type, count: spawn.count, boundary: box.slice(1), x: (box[1] + box[3]) / 2, y: (box[2] + box[4]) / 2 });
				});
			});
		});
		Object.keys(G.drops || {}).forEach(function (id) {
			var table = G.drops[id];
			if (!Array.isArray(table) || ["glitch", "lglitch"].includes(id) || id.endsWith("_bonus")) return;
			table.concat(G.drops[id + "_bonus"] || []).forEach(function (e) {
				if (!(e[0] > 0)) return;
				var child = e[1] === "open" ? e[2] : e[1];
				(parents[child] || (parents[child] = [])).push(id);
			});
		});
		Object.keys(G.craft || {}).forEach(function (id) {
			var recipe = G.craft[id],
				output = recipe.output ? recipe.output.name : id;
			(recipes[output] || (recipes[output] = [])).push({
				kind: "craft",
				recipe: id,
				npc: recipe.quest ? questNpc(recipe.quest, recipe.quest) : "craftsman",
				fee: recipe.cost,
				output: recipe.output,
				inputs: recipe.items.map(function (i) {
					return { name: i[1], quantity: i[0], level: i[2] || 0 };
				}),
			});
		});
		Object.keys(G.dismantle || {}).forEach(function (id) {
			var recipe = G.dismantle[id];
			(recipe.items || []).forEach(function (i) {
				(dismantles[i[1]] || (dismantles[i[1]] = [])).push({ kind: "dismantle", name: id, npc: "craftsman", fee: recipe.cost, quantity: i[0], level: i[2] || 0 });
			});
		});
		function sources(name) {
			if (found[name]) return found[name];
			if (!G.items[name]) return [];
			var ancestry = new Set([name]),
				queue = [name],
				result = [];
			for (var i = 0; i < queue.length; i++)
				(parents[queue[i]] || []).forEach(function (id) {
					if (!ancestry.has(id)) {
						ancestry.add(id);
						queue.push(id);
					}
				});
			function has(table) {
				if (typeof table === "string") table = (G.drops[table] || []).concat(G.drops[table + "_bonus"] || []);
				return (table || []).some(function (e) {
					return e[0] > 0 && (e[1] === name || (e[1] === "open" && ancestry.has(e[2])));
				});
			}
			Object.keys(G.npcs || {}).forEach(function (npc) {
				var def = G.npcs[npc];
				if (!def.ignore && (def.items || []).includes(name)) result.push({ kind: "shop", npc: npc, price: G.items[name].cash || G.items[name].g, currency: G.items[name].cash ? "shells" : "gold" });
			});
			Object.keys((G.drops || {}).monsters || {}).forEach(function (monster) {
				var table = G.drops.monsters[monster];
				if (!has(table)) return;
				var direct = table.find(function (e) {
					return e[0] > 0 && e[1] === name;
				});
				result.push({ kind: "monster", monster: monster, chance: direct ? direct[0] : false });
			});
			Object.keys((G.drops || {}).maps || {}).forEach(function (map) {
				if ((map === "global" || (G.maps[map] && !G.maps[map].ignore)) && has(G.drops.maps[map])) result.push({ kind: "map", map: map });
			});
			Object.keys(G.items).forEach(function (id) {
				var def = G.items[id];
				if (!def.e) return;
				for (var level = 0; level <= (def.upgrade || def.compound ? 12 : 0); level++) {
					var key = id + (def.upgrade || def.compound ? level : "");
					if (has((G.drops[key] || []).concat(G.drops[key + "_bonus"] || [])))
						result.push({ kind: "exchange", name: id, level: level, quantity: def.e, npc: def.quest ? questNpc(def.quest, "exchange") : "exchange", random: true });
				}
			});
			Object.keys(G.tokens || {}).forEach(function (token) {
				if (G.tokens[token][name] > 0)
					result.push({
						kind: "token",
						token: token,
						quantity: G.tokens[token][name],
						npc: Object.keys(G.npcs).find(function (n) {
							return G.npcs[n].token === token;
						}),
					});
			});
			result = result.concat(recipes[name] || [], dismantles[name] || []);
			if (name === "monstertoken") result.push({ kind: "hunt", npc: "monsterhunter" });
			// Sources implemented in server logic, not ordinary drop tables.
			Object.keys(G.maps || {}).forEach(function (map) {
				(G.maps[map].zones || []).forEach(function (zone) {
					if (["fishing", "mining"].includes(zone.type) && has(zone.drop))
						result.push({ kind: "gather", skill: zone.type, tool: zone.type === "fishing" ? "rod" : "pickaxe", map: map, polygon: zone.polygon });
				});
			});
			found[name] = result;
			return result;
		}
		function yields(table, name, trail) {
			trail = trail || [];
			if (trail.includes(table)) return 0;
			var entries = G.drops[table] || [],
				sum = entries.reduce(function (n, e) {
					return n + Math.max(0, e[0]);
				}, 0);
			var next = trail.concat(table);
			var ordinary = entries.reduce(function (n, e) {
				return n + (e[0] > 0 ? (e[0] / (sum || 1)) * output(e, name, next) : 0);
			}, 0);
			return (
				ordinary +
				(G.drops[table + "_bonus"] || []).reduce(function (n, e) {
					return n + Math.min(1, Math.max(0, e[0])) * output(e, name, next);
				}, 0)
			);
		}
		function output(e, name, trail) {
			return e[1] === name ? (typeof e[2] === "number" ? e[2] : 1) : e[1] === "open" ? yields(e[2], name, trail) : 0;
		}
		function dropRate(route, name, observations) {
			var m = G.monsters[route.monster],
				o = observations || {},
				luck = o.luck || 1,
				share = o.share === undefined ? 1 : o.share;
			var direct =
				((G.drops.monsters || {})[route.monster] || []).reduce(function (n, e) {
					return n + Math.min(1, e[0] * luck * share * (o.level || 1) * (o.mult || 1)) * output(e, name, []);
				}, 0) * (o.tableRolls || 1);
			return (
				direct +
				((G.drops.maps || {})[route.map] || []).reduce(function (n, e) {
					return n + Math.min(1, ((e[0] * luck * share * m.hp * (o.hpMultiplier || 1)) / 1000) * (o.luckx || 1)) * output(e, name, []);
				}, 0)
			);
		}
		function uses(name) {
			return Object.keys(G.craft || {}).filter(function (id) {
				return G.craft[id].items.some(function (i) {
					return i[1] === name;
				});
			});
		}
		return { sources: sources, routes: routes, locations: locations, recipes: recipes, dropRate: dropRate, exchangeYield: yields, uses: uses };
	}
	root.ProgressionSources = {
		create: create,
		get: function (G) {
			if (!cache.has(G)) cache.set(G, create(G));
			return cache.get(G);
		},
		invalidate: function (G) {
			cache.delete(G);
		},
	};
	if (typeof module !== "undefined" && module.exports) module.exports = root.ProgressionSources;
})(typeof globalThis !== "undefined" ? globalThis : this);
