/* Progression decisions. Pure, bounded snapshots; never performs game actions. */
(function (root) {
	"use strict";
	var policy = { candidates: 64, nodes: 120, depth: 6, rows: 3, fresh: 90000, observationAge: 900000, settle: 3000 };
	var body = { helmet: "helmet", chest: "coat", pants: "pants", gloves: "gloves", shoes: "shoes" };
	var weapons = { warrior: "blade", paladin: "mace", rogue: "claw", ranger: "bow", mage: "staff", priest: "staff", merchant: "staff" };
	var groups = new Set(["phoenix", "mvampire", "fvampire", "franky", "crabxx", "icegolem", "dragold", "grinch", "snowman", "mrpumpkin", "mrgreen", "pinkgoo", "slenderman", "tiger", "jr", "greenjr"]);
	function plain(i) {
		return !!i && !i.l && !i.r && !i.expires && !i.reserved && !i.queued && !i.p && !i.b && !i.giveaway;
	}
	function finite(value, fallback) {
		return typeof value === "number" && Number.isFinite(value) ? value : fallback;
	}
	function copy(value) {
		return JSON.parse(JSON.stringify(value));
	}
	function message(key, args) {
		return { id: "progression." + key, args: args || {} };
	}
	function advice(kind, key, args, more) {
		return Object.assign({ id: kind + ":" + key, kind: kind, title: message("action." + kind, args), reason: message("reason." + key, args), cost: 0, resources: [], priority: 0 }, more || {});
	}
	function create(G, helpers) {
		var maximumLevel = Math.max.apply(Math, Object.keys(G.levels).map(Number).filter(Number.isFinite));
		var index = root.ProgressionSources.get(G),
			project = root.ProgressionStats.create(G, helpers),
			costs = new Map(),
			memo = new Map();
		var slots = helpers.characterSlots.filter(function (s) {
			return !s.startsWith("trade") && s !== "elixir";
		});
		function props(i) {
			return helpers.itemProperties(i) || {};
		}
		function grade(i) {
			return helpers.itemGrade(i);
		}
		function statQuantity(i) {
			return root.ProgressionStats.statScrollQuantities[grade(i)];
		}
		function legal(type, slot, item, equipped, level) {
			var d = G.items[item.name],
				c = G.classes[type];
			if (!d || !c || d.ignore || d.level > level || (d.class && !d.class.includes(type))) return false;
			if (slot === "mainhand") return !!(c.mainhand[d.wtype] || c.doublehand[d.wtype]);
			if (slot === "offhand") {
				var main = G.items[equipped.mainhand && equipped.mainhand.name];
				return !(main && c.doublehand[main.wtype]) && !!(c.offhand[d.wtype] || c.offhand[d.type]);
			}
			return d.type === slot.replace(/[12]$/, "");
		}
		function places(item) {
			var type = G.items[item.name].type;
			return type === "weapon" || type === "tool"
				? ["mainhand", "offhand"]
				: ["source", "shield", "quiver", "misc_offhand"].includes(type)
					? ["offhand"]
					: ["ring", "earring"].includes(type)
						? [type + "1", type + "2"]
						: slots.includes(type)
							? [type]
							: [];
		}
		function calculate(type, level, equipment, map) {
			var key = type + ":" + level + ":" + map + ":" + JSON.stringify(equipment);
			if (!memo.has(key)) {
				if (memo.size >= 192) memo.clear();
				memo.set(key, project(type, level, equipment, map));
			}
			return memo.get(key);
		}
		function development(name, target) {
			var key = name + ":" + target;
			if (costs.has(key)) return costs.get(key);
			var d = G.items[name],
				compound = !!d.compound,
				table = compound ? G.compounds : G.upgrades,
				bases = 1,
				gold = 0,
				rows = [];
			if (target > 12 || target < 0 || !Number.isInteger(target) || (target && !d.upgrade && !d.compound) || !table) return null;
			for (var lv = 1; lv <= target; lv++) {
				var gr = grade({ name: name, level: lv - 1 }),
					probabilityGrade = compound && lv > 3 ? grade({ name: name, level: lv - 3 }) : grade({ name: name, level: 0 });
				var scroll = (compound ? "cscroll" : "scroll") + gr,
					chance = table[probabilityGrade] && table[probabilityGrade][lv];
				if (!G.items[scroll] || !(chance > 0 && chance <= 1)) return null;
				bases = (bases * (compound ? 3 : 1)) / chance;
				gold = (gold * (compound ? 3 : 1) + G.items[scroll].g) / chance;
				rows.push({ level: lv, chance: chance, scroll: scroll, price: G.items[scroll].g });
			}
			var result = { copies: bases, minimum: compound ? Math.pow(3, target) : 1, gold: gold, rows: rows };
			costs.set(key, result);
			return result;
		}
		function inventory(s) {
			var bag = (s.items || [])
				.slice(0, 42)
				.map(function (i, num) {
					return i && Object.assign({}, i, { num: num, location: "bag" });
				})
				.filter(plain);
			// Only explicitly observed bank packs are supplied by the adapter. They
			// remain retrieval work; never count them as ready craft ingredients.
			var bank = (s.bankItems || [])
				.slice(0, 84)
				.filter(plain)
				.map(function (i) {
					return Object.assign({}, i, { location: "bank" });
				});
			return { bag: bag, bank: bank };
		}
		function count(items, name, level, oneStack) {
			var amounts = items
				.filter(function (i) {
					return i.name === name && (i.level || 0) === (level || 0);
				})
				.map(function (i) {
					return i.q || 1;
				});
			return oneStack
				? Math.max.apply(Math, [0].concat(amounts))
				: amounts.reduce(function (a, b) {
						return a + b;
					}, 0);
		}
		function ownedEquipment(s) {
			return s.items
				.map(function (i, num) {
					return i && Object.assign({}, i, { num: num });
				})
				.filter(function (i) {
					return i && G.items[i.name] && !i.r && !i.expires && !i.queued && !i.b && !i.reserved;
				});
		}
		function reachable(s) {
			var seen = new Set([s.map || "main"]),
				queue = Array.from(seen);
			for (var i = 0; i < queue.length; i++) {
				var map = G.maps[queue[i]];
				if (!map) continue;
				(map.doors || []).forEach(function (door) {
					var target = door[4];
					if (!G.maps[target] || G.maps[target].ignore || G.maps[target].instance || (G.maps[target].pvp && !s.allowPvp) || door[7]) return;
					if (!seen.has(target)) {
						seen.add(target);
						queue.push(target);
					}
				});
				(map.npcs || []).forEach(function (n) {
					var npc = G.npcs[n.id];
					if (!npc || npc.role !== "transport") return;
					Object.keys(npc.places || {}).forEach(function (target) {
						if (G.maps[target] && !G.maps[target].ignore && (!G.maps[target].pvp || s.allowPvp) && !seen.has(target)) {
							seen.add(target);
							queue.push(target);
						}
					});
				});
			}
			return seen;
		}
		function assess(s, current, route, reach) {
			var m = G.monsters[route.monster],
				physical = current.damage_type === "physical",
				defense = physical ? m.armor || 0 : m.resistance || 0,
				pierce = physical ? current.apiercing : current.rpiercing;
			var hit = Math.max(1, current.attack * 0.9 * helpers.damageMultiplier(defense - (pierce || 0)));
			var hitChance = Math.max(0.1, (1 - (physical ? m.evasion || 0 : m.reflection || 0) / 100) * (1 - (m.avoidance || 0) / 100) * (1 - (current.miss || 0) / 100));
			var hits = Math.ceil(m.hp / hit / hitChance),
				seconds = hits / Math.max(0.1, current.frequency);
			var incoming = m.attack * 1.1 * helpers.damageMultiplier(m.damage_type === "physical" ? current.armor - (m.apiercing || 0) : current.resistance - (m.rpiercing || 0));
			var returned = physical && current.range < 75 ? Math.ceil((current.attack * 1.1 * (m.dreturn || 0)) / 100) * hits : 0;
			var loss = Math.ceil(seconds * m.frequency) * incoming + returned;
			var spend = (loss / G.items.hpot0.gives[0][1]) * G.items.hpot0.g + ((hits * current.mp_cost) / G.items.mpot0.gives[0][1]) * G.items.mpot0.g;
			var cycle = Math.max(seconds + 1.5, (m.respawn || 0) / Math.max(1, route.count));
			var obs = (s.observations || {})[route.map + ":" + route.monster],
				now = s.now;
			var fresh = obs && obs.loadout === s.loadout && obs.realm === s.realm && obs.at <= now && now - obs.at < policy.observationAge;
			var proven = fresh && obs.kills >= 8 && obs.credited >= 3 && !obs.deaths && obs.netGold >= 0;
			var reasons = [],
				group = groups.has(route.monster) || !!m.cooperative || m.special || m["1hp"];
			if (![seconds, loss, spend, cycle].every(Number.isFinite)) reasons.push("unknown");
			if (!reach.has(route.map)) reasons.push("travel");
			if (G.maps[route.map].pvp && !s.allowPvp) reasons.push("pvp");
			if (group) reasons.push("group");
			if (!proven && (seconds > 35 || loss > current.max_hp * 0.25 || incoming * 4 > current.max_hp)) reasons.push("unsafe");
			if (!proven && ((m.abilities && Object.keys(m.abilities).length) || (m.reflection && !physical))) reasons.push("mechanics");
			if (fresh && (obs.deaths || obs.netGold < 0)) reasons.push("observed_unsafe");
			var goldRules = G.drops.gold || {},
				baseGold = 1 + ((G.monster_gold || {})[route.monster] || 0) * ((goldRules.base || 0) + (goldRules.random || 0) / 2);
			return Object.assign({}, route, {
				safe: !reasons.length,
				proven: !!proven,
				trial: !proven && route.monster !== "goo" && (seconds > 12 || loss > current.max_hp * 0.12 || incoming * 8 > current.max_hp),
				reasons: reasons,
				seconds: seconds,
				loss: loss,
				spend: spend,
				cycle: cycle,
				xp: proven && obs.seconds >= 30 ? obs.xp / obs.seconds : m.xp / cycle,
				net: proven && obs.seconds >= 30 ? obs.netGold / obs.seconds : (baseGold - spend) / cycle,
				observation: fresh ? obs : null,
			});
		}
		function normalize(input) {
			var s = Object.assign({}, input),
				c = G.classes[s.ctype];
			if (!c || !Number.isFinite(s.level)) return null;
			s.now = finite(s.now, Date.now());
			s.level = Math.max(1, Math.min(maximumLevel, Math.floor(s.level)));
			s.gold = Math.max(0, finite(s.gold, 0));
			s.items = (s.items || []).slice(0, 42);
			s.slots = s.slots || {};
			s.conditions = s.conditions || {};
			s.reserve = Math.max(100 * G.items.hpot0.g + 100 * G.items.mpot0.g, Math.max(0, finite(s.spendPerMinute, 0)) * 10);
			s.budget = Math.max(0, Math.min(s.gold - s.reserve, finite(s.spendLimit, Infinity)));
			s.durable = {};
			slots.forEach(function (slot) {
				var i = s.slots[slot];
				if (i && !i.expires && !i.r && legal(s.ctype, slot, i, s.slots, s.level)) s.durable[slot] = i;
			});
			s.loadout = JSON.stringify([s.durable, s.level, s.partyKey || ""]);
			return s;
		}
		function itemName(name) {
			return G.items[name] ? G.items[name].name : name;
		}
		function acquire(request, s, routes, options) {
			var visited = 0,
				truncated = false,
				owned = inventory(s),
				order = ["shop", "craft", "token", "monster", "map", "hunt", "gather", "dismantle", "exchange"];
			function expand(req, stock, depth, trail) {
				var key = req.name + ":" + req.level,
					node = { name: req.name, level: req.level || 0, quantity: req.quantity || 1, owned: 0, alternatives: [], next: null };
				if (++visited > policy.nodes || depth > policy.depth) {
					truncated = true;
					node.blocked = "limit";
					return node;
				}
				if (!G.items[req.name]) {
					node.blocked = "source";
					return node;
				}
				var matches = stock.filter(function (i) {
					return i.name === req.name && (i.level || 0) === node.level;
				});
				if (req.stack)
					matches = matches
						.sort(function (a, b) {
							return (b.q || 1) - (a.q || 1);
						})
						.slice(0, 1);
				matches.forEach(function (i) {
					var take = Math.min(i.q, node.quantity - node.owned);
					node.owned += take;
					i.q -= take;
				});
				node.remaining = node.quantity - node.owned;
				if (!node.remaining) return node;
				if (trail.includes(key)) {
					node.blocked = "cycle";
					return node;
				}
				var nextTrail = trail.concat(key),
					bank = owned.bank.find(function (i) {
						return i.name === req.name && (i.level || 0) === node.level;
					});
				if (bank) node.alternatives.push({ kind: "retrieve", cost: 0, resources: [], priority: 110, target: bank, name: req.name, level: node.level, quantity: node.remaining });
				(s.listings || [])
					.slice(0, 64)
					.filter(function (o) {
						return (
							o.name === req.name &&
							(o.level || 0) === node.level &&
							o.quantity >= node.remaining &&
							o.price > 0 &&
							o.observedAt <= s.now &&
							s.now - o.observedAt < policy.fresh &&
							o.realm === s.realm &&
							!o.reserved
						);
					})
					.forEach(function (o) {
						node.alternatives.push({ kind: "purchase", cost: o.price * node.remaining, offer: o, name: req.name, level: node.level, resources: [], priority: 90 });
					});
				if (node.level) {
					var model = development(req.name, node.level),
						def = G.items[req.name],
						lower = stock
							.filter(function (i) {
								return i.q > 0 && i.name === req.name && (i.level || 0) < node.level;
							})
							.sort(function (a, b) {
								return (b.level || 0) - (a.level || 0);
							});
					if (!model) {
						node.blocked = "model";
						return node;
					}
					for (var lv = node.level - 1; lv >= 0; lv--) {
						var group = lower.filter(function (i) {
								return (i.level || 0) === lv;
							}),
							needed = def.compound ? 3 : 1;
						if (group.length < needed) continue;
						var row = development(req.name, lv + 1).rows[lv],
							scroll = stock.find(function (i) {
								return i.name === row.scroll && i.q > 0;
							});
						node.alternatives.push({
							kind: def.compound ? "compound" : "upgrade",
							name: req.name,
							level: lv + 1,
							scroll: row.scroll,
							cost: scroll ? 0 : row.price,
							chance: row.chance,
							resources: group
								.slice(0, needed)
								.map(function (i) {
									return { num: i.num, quantity: 1 };
								})
								.concat(scroll ? [{ num: scroll.num, quantity: 1 }] : []),
							priority: 105,
						});
						break;
					}
					var child = expand({ name: req.name, level: 0, quantity: model.minimum * node.remaining }, copy(stock), depth + 1, nextTrail);
					node.alternatives.push({
						kind: "develop",
						meanCopies: model.copies * node.remaining,
						minimum: model.minimum * node.remaining,
						meanGold: model.gold * node.remaining,
						inputs: [child],
						next: child.next,
						cost: 0,
						priority: 25,
					});
				} else
					index
						.sources(req.name)
						.slice()
						.sort(function (a, b) {
							return order.indexOf(a.kind) - order.indexOf(b.kind);
						})
						.forEach(function (source) {
							if (node.alternatives.length >= 18) return;
							var a = Object.assign({ cost: 0, resources: [], priority: 0, name: req.name, level: 0, quantity: node.remaining }, source);
							if (a.kind === "shop") {
								if (a.currency !== "gold") return;
								a.kind = "buy";
								a.cost = a.price * node.remaining;
								a.priority = 85;
							} else if (a.kind === "craft") {
								var branchStock = copy(stock);
								a.inputs = source.inputs.map(function (i) {
									return expand({ name: i.name, level: i.level, quantity: i.quantity * node.remaining, stack: true }, branchStock, depth + 1, nextTrail);
								});
								a.cost = source.fee * node.remaining;
								a.ready = a.inputs.every(function (i) {
									return !i.remaining && !i.blocked;
								});
								a.next = a.inputs
									.filter(function (i) {
										return i.remaining;
									})
									.map(function (i) {
										return i.next;
									})
									.filter(Boolean)
									.sort(function (x, y) {
										return (y.priority || 0) - (x.priority || 0);
									})[0];
								a.resources = source.inputs
									.map(function (i) {
										var own = stock.find(function (o) {
											return o.name === i.name && (o.level || 0) === i.level && o.q >= i.quantity * node.remaining;
										});
										return own ? { num: own.num, quantity: i.quantity * node.remaining } : null;
									})
									.filter(Boolean);
								a.priority = a.ready
									? 100
									: a.inputs.some(function (i) {
												return i.owned;
										  })
										? 65
										: 35;
								if (a.npc === "anniversary_baker" && !freshEvent(s, "anniversary")) {
									a.ready = false;
									a.blocked = "season";
									a.next = null;
								}
							} else if (a.kind === "token") {
								var tokens = stock.find(function (i) {
									return i.name === a.token && i.q >= source.quantity * node.remaining;
								});
								a.quantity = source.quantity * node.remaining;
								a.ready = !!tokens;
								a.priority = tokens ? 100 : 20;
								if (tokens) a.resources = [{ num: tokens.num, quantity: a.quantity }];
								else {
									a.inputs = [expand({ name: a.token, level: 0, quantity: a.quantity }, copy(stock), depth + 1, nextTrail)];
									a.next = a.inputs[0].next;
								}
								if (a.token === "pvptoken" && !tokens && !s.allowPvp) {
									a.blocked = "pvp";
									a.next = null;
								}
							} else if (a.kind === "monster" || a.kind === "map") {
								if (s.ctype === "merchant" && !["farm", "encounter"].includes((s.goal || {}).kind)) return;
								var choices = routes.filter(function (r) {
									return r.safe && (a.monster ? r.monster === a.monster : r.map === a.map) && index.dropRate(r, req.name) > 0;
								});
								choices.sort(function (x, y) {
									return index.dropRate(y, req.name) / y.cycle - index.dropRate(x, req.name) / x.cycle;
								});
								if (choices[0]) {
									a.kind = "farm";
									a.route = choices[0];
									a.rate = index.dropRate(a.route, req.name);
									a.priority = a.route.proven ? 55 : 40;
									a.meanSeconds = (node.remaining / a.rate) * a.route.cycle;
								} else {
									a.blocked = "access";
									a.priority = -10;
								}
							} else if (a.kind === "exchange") {
								var input = stock.find(function (i) {
									return i.name === a.name && (i.level || 0) === a.level && i.q >= a.quantity;
								});
								a.reward = req.name;
								a.random = true;
								a.ready = !!input;
								a.priority = input ? 60 : -5;
								if (input) a.resources = [{ num: input.num, quantity: a.quantity }];
								else {
									a.inputs = [expand({ name: a.name, level: a.level, quantity: a.quantity }, copy(stock), depth + 1, nextTrail)];
									a.next = a.inputs[0].next;
								}
							} else if (a.kind === "dismantle") {
								var spare = stock.find(function (i) {
									return i.name === a.name && (i.level || 0) === 0 && i.q > 0;
								});
								a.reward = req.name;
								a.ready = !!spare;
								a.cost = a.fee;
								a.priority = spare ? 50 : -5;
								if (spare) a.resources = [{ num: spare.num, quantity: 1 }];
							} else if (a.kind === "hunt") {
								a.ready = s.ctype !== "merchant";
								a.priority = 15;
							} else if (a.kind === "gather") {
								a.ready = !!(s.gathering && s.gathering[a.skill] && s.gathering[a.skill].ready);
								a.priority = a.ready ? 45 : -5;
							}
							node.alternatives.push(a);
						});
				node.alternatives.sort(function (a, b) {
					var first = a.inputs && a.ready !== true && a.next ? a.next : a,
						second = b.inputs && b.ready !== true && b.next ? b.next : b;
					return second.priority - first.priority || (first.meanSeconds || 0) - (second.meanSeconds || 0) || first.cost - second.cost;
				});
				var possible = node.alternatives
					.map(function (a) {
						if (a.blocked) return null;
						if (a.inputs && a.ready !== true) return a.next;
						if (["exchange", "dismantle", "gather", "token"].includes(a.kind) && !a.ready) return null;
						return a;
					})
					.filter(Boolean);
				node.next =
					possible.find(function (a) {
						return a.cost <= s.budget;
					}) ||
					possible[0] ||
					null;
				if (!node.next && !node.alternatives.length) node.blocked = "source";
				return node;
			}
			var stock = owned.bag.map(function (i) {
				return Object.assign({}, i, { q: i.q || 1 });
			});
			return { tree: expand(request, stock, 0, []), visited: Math.min(visited, policy.nodes), truncated: truncated };
		}
		function changed(s, slot, item) {
			var equipment = Object.assign({}, s.durable);
			equipment[slot] = item;
			if (slot === "mainhand" && G.classes[s.ctype].doublehand[G.items[item.name].wtype]) delete equipment.offhand;
			return equipment;
		}
		function metricFor(s) {
			return s.ctype === "priest" ? "heal" : "attack";
		}
		function gain(before, after, metric) {
			return {
				metric: metric,
				amount: Math.round((after[metric] || 0) - (before[metric] || 0)),
				hp: Math.round(after.max_hp - before.max_hp),
				armor: Math.round(after.armor - before.armor),
				resistance: Math.round(after.resistance - before.resistance),
				speed: Math.round(after.speed - before.speed),
				frequency: after.frequency - before.frequency,
			};
		}
		function goalFor(s, current) {
			var goal = s.goal || {},
				metric = metricFor(s);
			if (s.ctype === "merchant" && goal.kind === "trade") return { kind: "trade", market: goal.market === "lostandfound" ? "lostandfound" : "secondhands" };
			if (goal.kind === "stat" && ["attack", "heal", "max_hp", "armor", "resistance"].includes(goal.metric) && goal.target > 0)
				return { kind: "stat", metric: goal.metric, target: Math.min(1e9, goal.target) };
			if (goal.kind === "item" && G.items[goal.name])
				return { kind: "item", name: goal.name, level: Math.max(0, Math.min(12, Math.floor(goal.level || 0))), quantity: Math.max(1, Math.min(99999, Math.floor(goal.quantity || 1))) };
			if (goal.kind === "set" && G.sets[goal.name])
				return { kind: "set", name: goal.name, target: Math.max(1, Math.min(G.sets[goal.name].items.length, goal.target || G.sets[goal.name].items.length)) };
			if (["farm", "encounter"].includes(goal.kind) && G.monsters[goal.monster]) return { kind: goal.kind, monster: goal.monster, map: goal.map };
			if (goal.kind === "gold" && goal.target > 0) return { kind: "gold", target: Math.min(1e12, goal.target) };
			if (goal.kind === "gather" && ["fishing", "mining"].includes(goal.skill)) return { kind: "gather", skill: goal.skill };
			if (s.ctype === "merchant") return stocked(s) ? { kind: "trade", market: s.map === "woffice" ? "lostandfound" : "secondhands" } : { kind: "shop" };
			return { kind: "stat", metric: metric, target: 1000 };
		}
		function goalProgress(s, current, goal, routes) {
			if (goal.kind === "trade") return { value: s.gold, target: null };
			if (goal.kind === "stat") return { value: current[goal.metric] || 0, target: goal.target };
			if (goal.kind === "gold") return { value: s.gold, target: goal.target };
			if (goal.kind === "item")
				return {
					value: Object.values(s.durable)
						.concat(ownedEquipment(s))
						.filter(function (i) {
							return i.name === goal.name && (i.level || 0) >= goal.level;
						})
						.reduce(function (n, i) {
							return n + (i.q || 1);
						}, 0),
					target: goal.quantity,
				};
			if (goal.kind === "set")
				return {
					value: Object.values(s.durable).filter(function (i) {
						return G.sets[goal.name].items.includes(i.name);
					}).length,
					target: goal.target,
				};
			if (goal.kind === "shop") return { value: stocked(s) ? 1 : 0, target: 1 };
			if (goal.kind === "gather") return { value: (s.gathering || {})[goal.skill] && s.gathering[goal.skill].successes ? 1 : 0, target: 1 };
			var route = routes.find(function (r) {
				return r.monster === goal.monster && (!goal.map || goal.map === r.map) && r.proven;
			});
			var evidence = (s.encounters || {})[goal.monster];
			return {
				value:
					goal.kind === "encounter"
						? evidence && evidence.realm === s.realm && evidence.loadout === s.loadout && evidence.credited > 0 && evidence.at <= s.now && s.now - evidence.at < policy.observationAge
							? 1
							: 0
						: route
							? 1
							: 0,
				target: 1,
			};
		}
		// These lessons teach a small number of useful decisions. Equipment tests
		// compare the whole build, so a stronger found item can skip a lesson.
		function lessons(s, current) {
			var primary = G.classes[s.ctype].main_stat,
				metric = metricFor(s);
			function req(slot, name, level, stat) {
				return { slot: slot, name: name, level: level, stat_type: stat };
			}
			function armor(level) {
				return Object.keys(body).map(function (slot) {
					return req(slot, body[slot], level, level ? primary : undefined);
				});
			}
			function hands(level) {
				return [req("mainhand", weapons[s.ctype], level)].concat(["warrior", "rogue"].includes(s.ctype) ? [req("offhand", weapons[s.ctype], level)] : []);
			}
			function pair(type, level) {
				return [1, 2].map(function (n) {
					return req(type + n, primary + type, level);
				});
			}
			var all = [
				{ id: "foundation", gear: hands(3).slice(0, 1).concat(armor(0)) },
				{ id: "working", gear: hands(5).concat(armor(3)) },
				{ id: "amulet", gear: [req("amulet", primary + "amulet", 0)] },
				{ id: "amulet2", gear: [req("amulet", primary + "amulet", 2)] },
				{ id: "earrings", gear: pair("earring", 0) },
				{ id: "rings", gear: pair("ring", 0) },
				{ id: "rings2", gear: pair("ring", 2) },
				{ id: "earrings2", gear: pair("earring", 2) },
				{ id: "equipment", gear: hands(7).concat(armor(7), ["mage", "priest", "paladin"].includes(s.ctype) ? [req("offhand", "wbook0", 2)] : []) },
			];
			all.forEach(function (lesson) {
				lesson.missing = lesson.gear.filter(function (r) {
					if (!legal(s.ctype, r.slot, r, s.durable, s.level)) return false;
					var own = s.durable[r.slot];
					if (!own) return true;
					if (own.name === r.name && (own.level || 0) >= r.level && (!r.stat_type || own.stat_type === r.stat_type)) return false;
					var alternative = calculate(s.ctype, s.level, changed(s, r.slot, r), s.map);
					if (r.stat_type && props(own).stat && own.stat_type !== primary) return true;
					return alternative[metric] > current[metric] || alternative.max_hp > current.max_hp * 1.1 || alternative.armor > current.armor + 20;
				});
				lesson.complete = !lesson.missing.length;
				lesson.title = message("lesson." + lesson.id);
				lesson.reason = message("lesson." + lesson.id + ".why");
			});
			return all;
		}
		function candidateChanges(s, current, goal, teaching) {
			var proposals = [],
				seen = new Set(),
				primary = G.classes[s.ctype].main_stat,
				metric = goal.kind === "stat" ? goal.metric : metricFor(s);
			var bag = inventory(s).bag;
			function add(slot, item, rank, origin, num) {
				if (!legal(s.ctype, slot, item, s.durable, s.level)) return;
				var id = slot + ":" + item.name + ":" + (item.level || 0) + ":" + (item.stat_type || "");
				if (seen.has(id)) return;
				seen.add(id);
				proposals.push({ slot: slot, item: item, rank: rank, origin: origin, num: num, id: id });
			}
			ownedEquipment(s).forEach(function (i) {
				places(i).forEach(function (slot) {
					add(slot, i, 1000, "owned", i.num);
					if (plain(i) && G.items[i.name].stat && i.stat_type !== primary) add(slot, Object.assign({}, i, { stat_type: primary }), 810, "stat", i.num);
				});
			});
			slots.forEach(function (slot) {
				var own = s.durable[slot];
				if (!own) return;
				if (props(own).stat && own.stat_type !== primary && plain(own)) add(slot, Object.assign({}, own, { stat_type: primary }), 810, "stat");
				if (plain(own) && (G.items[own.name].upgrade || G.items[own.name].compound) && (own.level || 0) < (G.items[own.name].compound ? (teaching.length ? 2 : 4) : 9))
					add(slot, Object.assign({}, own, { level: (own.level || 0) + 1 }), 650, "develop");
			});
			var lesson = teaching.find(function (l) {
				return !l.complete;
			});
			if (lesson)
				lesson.missing.forEach(function (r) {
					add(r.slot, r, 900, "lesson");
				});
			// Rings and basic development can continue while a party earring source
			// is unavailable. Do not stall a player at a rare random drop.
			teaching
				.filter(function (l) {
					return l.id === "equipment" || (lesson && lesson.id === "earrings" && l.id === "rings");
				})
				.forEach(function (l) {
					l.missing.forEach(function (r) {
						add(r.slot, r, l.id === "rings" ? 850 : 500, "parallel");
					});
				});
			var setsOwned = new Set(
				Object.values(s.durable)
					.map(function (i) {
						return G.items[i.name].set;
					})
					.filter(Boolean),
			);
			Object.keys(G.items).forEach(function (name) {
				var d = G.items[name];
				if (d.ignore || d.cash || d.expires || d.event) return;
				var firstGrade = d.grades && d.grades[0];
				var level = d.compound ? 2 : d.upgrade ? (firstGrade > 0 && firstGrade < 7 ? firstGrade - 1 : [7, 5, 3][grade({ name: name, level: 0 })] || 3) : 0;
				var item = { name: name, level: level };
				if (d.stat) item.stat_type = primary;
				var ownedParts = Math.max.apply(
					Math,
					[0].concat(
						(index.recipes[name] || []).map(function (r) {
							return (
								r.inputs.reduce(function (n, part) {
									return n + Math.min(1, count(bag, part.name, part.level, true) / part.quantity);
								}, 0) / r.inputs.length
							);
						}),
					),
				);
				var ownedTokens = index.sources(name).some(function (source) {
					return source.kind === "token" && count(bag, source.token, 0, true) >= source.quantity;
				});
				places(item).forEach(function (slot) {
					if (!legal(s.ctype, slot, item, s.durable, s.level)) return;
					var p = props(item),
						old = s.durable[slot] ? props(s.durable[slot]) : {},
						relevant = (p.attack || 0) - (old.attack || 0) + (p[primary] || p.stat || 0) - (old[primary] || old.stat || 0);
					if (
						relevant <= 0 &&
						!(
							(ownedParts && (p.armor || 0) + (p.resistance || 0) - (old.armor || 0) - (old.resistance || 0) >= 10) ||
							setsOwned.has(d.set) ||
							(goal.kind === "set" && G.sets[goal.name].items.includes(name))
						)
					)
						return;
					var rank = 100 + Math.min(100, relevant) + ownedParts * 900 + (ownedTokens ? 700 : 0) + (setsOwned.has(d.set) ? 150 : 0);
					if (goal.kind === "set" && G.sets[goal.name].items.includes(name)) rank += 800;
					add(slot, item, rank, "acquire");
				});
			});
			return proposals
				.sort(function (a, b) {
					return b.rank - a.rank || a.id.localeCompare(b.id);
				})
				.slice(0, policy.candidates)
				.map(function (p) {
					var after = calculate(s.ctype, s.level, changed(s, p.slot, p.item), s.map);
					p.gain = gain(current, after, metric);
					p.stats = after;
					p.setGain = goal.kind === "set" && G.sets[goal.name].items.includes(p.item.name) && !(s.durable[p.slot] && G.sets[goal.name].items.includes(s.durable[p.slot].name)) ? 1 : 0;
					p.useful =
						p.gain.amount > 0 || p.setGain || (p.gain.amount >= 0 && p.rank >= 700 && p.gain.armor + p.gain.resistance >= 10) || (p.origin === "lesson" && (p.gain.armor > 0 || p.gain.resistance > 0));
					p.safe = after.max_hp >= current.max_hp * 0.85 && after.speed >= current.speed - 10;
					return p;
				})
				.filter(function (p) {
					return p.useful && p.safe;
				});
		}
		function fromAction(a, request, plan, extra) {
			var target = a.reward || a.name || request.name,
				args = {
					item: itemName(target),
					level: a.level || 0,
					quantity: a.quantity || 1,
					gold: Math.ceil(a.cost || 0),
					npc: G.npcs[a.npc] ? G.npcs[a.npc].name : "",
					monster: a.route ? G.monsters[a.route.monster].name : "",
					map: a.route ? G.maps[a.route.map].name || a.route.map : "",
				};
			var kind = a.kind === "buy" || a.kind === "purchase" ? "buy" : a.kind;
			var reason = a.kind === "farm" ? (a.route.trial ? "try_material" : "material") : ["upgrade", "compound"].includes(kind) ? "spares" : a.random ? "random" : "source";
			return advice(
				kind,
				reason,
				args,
				Object.assign(
					{
						id: kind + ":" + target + ":" + (a.level || 0) + ":" + (a.route ? a.route.id : a.npc || ""),
						action: a,
						cost: a.cost || 0,
						resources: a.resources || [],
						art: a.route ? { monster: a.route.monster } : { item: target },
						request: request,
						plan: plan,
						priority: a.priority || 0,
					},
					extra || {},
				),
			);
		}
		function farmAdvice(route, reason, extra) {
			return advice(
				"farm",
				reason,
				{ monster: G.monsters[route.monster].name, map: G.maps[route.map].name || route.map, item: "", quantity: 0 },
				Object.assign({ id: "farm:" + route.id + ":" + reason, art: { monster: route.monster }, action: { kind: "farm", route: route }, route: route, priority: 25 }, extra || {}),
			);
		}
		function active(value, now) {
			if (value === true) return true;
			if (!value || typeof value !== "object") return false;
			if (value.active !== undefined) return value.active === true;
			if (value.live !== undefined) return value.live === true && value.hp !== 0;
			var end = typeof value.end === "number" ? value.end : Date.parse(value.end);
			return Number.isFinite(end) && end > now;
		}
		function freshEvent(s, name) {
			var world = s.world,
				at = world && (world.times ? world.times[name] : world.at);
			return !!(world && world.connected !== false && world.realm === s.realm && Number.isFinite(at) && at <= s.now && s.now - at < policy.fresh && active(world.status[name], s.now));
		}
		function opportunities(s, goal, needs) {
			var world = s.world,
				result = [];
			if (!world || world.connected === false || world.realm !== s.realm) return result;
			Object.keys(world.status || {}).forEach(function (key) {
				var at = world.times ? world.times[key] : world.at;
				if (!Number.isFinite(at) || at > s.now || s.now - at >= policy.fresh) return;
				var status = world.status[key],
					def = G.events[key] || G.monsters[key];
				if (!def || !active(status, s.now)) return;
				var seasonal = def.type === "seasonal",
					evidence = (s.eventEvidence || {})[key];
				var checked =
					evidence &&
					evidence.realm === s.realm &&
					evidence.instance === world.instances[key] &&
					evidence.loadout === s.loadout &&
					evidence.at <= s.now &&
					s.now - evidence.at < policy.fresh &&
					evidence.ready &&
					evidence.credited > 0;
				var pvp = key === "abtesting" || key === "pvp";
				if (pvp && !s.allowPvp) return;
				var relevance = needs.some(function (name) {
					return index.sources(name).some(function (source) {
						return source.monster === key;
					});
				});
				if (goal.kind === "encounter" && goal.monster === key) relevance = true;
				// Presence is useful news; joining a fight needs observed eligibility.
				result.push(
					advice(
						"event",
						seasonal ? "season" : checked ? "event_ready" : "event_check",
						{ event: def.name },
						{
							id: "event:" + key + ":" + s.realm + ":" + world.instances[key],
							notice: "event:" + key + ":" + s.realm + ":" + (seasonal ? new Date(s.now).getUTCFullYear() : status.id || status.round || status.end || world.instances[key]),
							event: key,
							expires: Math.min(at + policy.fresh, typeof status.end === "number" ? status.end : Infinity),
							action: { kind: "event", event: key, ready: !!checked, modal: def.modal },
							art: G.items[def.sprite] ? { item: def.sprite } : { monster: def.sprite || key },
							reason: seasonal && def.announcement ? { id: "event." + key + ".announcement.text", args: {} } : message(checked ? "reason.event_ready" : "reason.event_check"),
							priority: (relevance ? 70 : 0) + (checked ? 65 : seasonal ? 30 : 5),
							relevant: relevance,
							informational: !seasonal && !checked,
						},
					),
				);
			});
			return result.sort(function (a, b) {
				return b.priority - a.priority || a.expires - b.expires;
			});
		}
		function stocked(s) {
			return (
				s.shopOpen &&
				Object.keys(s.slots).some(function (k) {
					var i = s.slots[k];
					return k.startsWith("trade") && i && !i.b && !i.giveaway && !i.v && i.price > 0;
				})
			);
		}
		function potionStock(s) {
			var stock = { hp: 0, mp: 0, locked: { hp: 0, mp: 0 } };
			s.items.forEach(function (i) {
				var def = i && G.items[i.name];
				if (!def || def.type !== "pot" || i.r || i.b || i.expires || i.reserved) return;
				(def.gives || []).forEach(function (give) {
					if (["hp", "mp"].includes(give[0]) && give[1] > 0) (i.l ? stock.locked : stock)[give[0]] += i.q || 1;
				});
			});
			return stock;
		}
		function marketAdvice(s, market) {
			function fresh(o) {
				return o && o.realm === s.realm && o.observedAt <= s.now && s.now - o.observedAt < policy.fresh;
			}
			var stock = (s.markets || {})[market],
				quotes = [],
				space = s.items.filter(Boolean).length < 42,
				reason = "market",
				quote;
			if (fresh(stock) && stock.access === false) reason = "market_unlock";
			else if (fresh(stock) && stock.items) {
				reason = "market_empty";
				stock.items.slice(0, 64).forEach(function (item) {
					if (!plain(item) || item.acl || item.gift || !item.rid || !(item.cost > 0) || item.cost > s.budget || !Number.isFinite(s.tax) || s.tax < 0 || s.tax >= 1) return;
					(s.buyOrders || []).slice(0, 64).forEach(function (bid) {
						var quantity = item.q || 1;
						if (!fresh(bid) || bid.seller === s.name || bid.name !== item.name || bid.level !== (item.level || 0) || bid.quantity < quantity || !(bid.price > 0)) return;
						var proceeds = Math.round(bid.price * quantity * (1 - s.tax));
						if (proceeds > item.cost) quotes.push({ item: item, buyer: bid, quantity: quantity, cost: item.cost, proceeds: proceeds, margin: proceeds - item.cost });
					});
				});
				quotes.sort(function (a, b) {
					return b.margin / b.cost - a.margin / a.cost || a.cost - b.cost;
				});
				quote = space && quotes[0];
				if (quote) reason = "market_found";
			}
			if (!space) {
				reason = "market_space";
				quote = null;
			}
			return advice(
				"market",
				reason,
				{ npc: G.npcs[market].name, item: quote && itemName(quote.item.name), gold: quote && quote.margin },
				{
					id: "market:" + market + (quote ? ":" + quote.item.rid + ":" + quote.buyer.rid : ":" + reason),
					art: { npc: market },
					priority: quote ? 150 : 75,
					cost: quote ? quote.cost : 0,
					action: { kind: "market", npc: market, quote: quote || null },
				},
			);
		}
		function evaluate(input) {
			var s = normalize(input);
			if (!s) return { version: 1, ready: false, rows: [] };
			var current = calculate(s.ctype, s.level, s.durable, s.map),
				reach = reachable(s);
			var routes = index.routes.map(function (r) {
				return assess(s, current, r, reach);
			});
			var goal = goalFor(s, current),
				progress = goalProgress(s, current, goal, routes),
				completed = progress.target !== null && progress.value >= progress.target;
			var merchantWork = s.ctype === "merchant" && !["stat", "set", "farm", "encounter"].includes(goal.kind);
			var teaching = s.ctype === "merchant" || goal.kind !== "stat" || current[metricFor(s)] >= 1000 ? [] : lessons(s, current);
			var result = {
				version: 1,
				ready: true,
				at: s.now,
				realm: s.realm,
				goal: goal,
				progress: progress,
				complete: completed,
				stats: current,
				reserve: s.reserve,
				budget: s.budget,
				lessons: teaching,
				rows: [],
				plans: [],
				opportunities: [],
				choices: [],
				limits: { candidates: policy.candidates, nodes: policy.nodes, depth: policy.depth },
			};
			var rows = [],
				needs = [],
				safe = routes.filter(function (r) {
					return r.safe;
				}),
				bag = inventory(s).bag;
			function addRequest(req, extra) {
				var plan = acquire(req, s, routes);
				result.plans.push(plan);
				needs.push(req.name);
				function collect(node) {
					needs.push(node.name);
					node.alternatives.forEach(function (a) {
						(a.inputs || []).forEach(collect);
					});
				}
				collect(plan.tree);
				if (plan.tree.next) rows.push(fromAction(plan.tree.next, req, plan, extra));
				else if (plan.tree.remaining)
					rows.push(
						advice(
							"inspect",
							"blocked",
							{ item: itemName(req.name) },
							{ id: "inspect:" + req.name, art: { item: req.name }, plan: plan, request: req, priority: 8, action: { kind: "inspect", name: req.name } },
						),
					);
				return plan;
			}
			if (s.rip || (s.hp !== undefined && s.hp < (s.max_hp || current.max_hp) * 0.35)) {
				result.rows = [advice("recover", "recover", {}, { id: "recover", art: { skill: s.rip ? "use_town" : "regen_hp" }, priority: 1000, action: { kind: "recover" } })];
				return result;
			}
			var pots = potionStock(s),
				low = !merchantWork && pots.hp < 20 ? "hp" : (!merchantWork || goal.kind === "gather") && pots.mp < 20 ? "mp" : null;
			if (low) {
				var name = low === "hp" ? "hpot0" : "mpot0",
					unlock = pots.locked[low] >= 20 - pots[low];
				rows.push(
					advice(
						"supplies",
						"supplies",
						{ stat: low, hp: pots.hp, mp: pots.mp },
						{
							id: "supplies:" + low + (unlock ? ":unlock" : ""),
							art: { item: name },
							priority: 1000,
							title: message(unlock ? "action.unlock_potions" : "action.supplies", { stat: low }),
							cost: unlock ? 0 : (20 - pots[low]) * G.items[name].g,
							action: { kind: "supplies", npc: unlock ? undefined : "fancypots", name: name, quantity: 20 - pots[low], unlock: unlock },
						},
					),
				);
			}
			if (!completed && goal.kind === "item")
				addRequest({ name: goal.name, level: goal.level, quantity: Math.max(1, goal.quantity - progress.value + count(bag, goal.name, goal.level)) }, { priority: 90 });
			if (!completed && ["stat", "set", "farm", "encounter"].includes(goal.kind)) {
				var candidates = candidateChanges(s, current, goal, teaching),
					ranked = [];
				// Expand only the most promising changes; every expansion is bounded.
				candidates
					.sort(function (a, b) {
						return b.rank - a.rank;
					})
					.slice(0, 16)
					.forEach(function (c) {
						var row,
							plan,
							req = { name: c.item.name, level: c.item.level || 0, quantity: 1 };
						if (c.origin === "owned")
							row = advice(
								"equip",
								"gain",
								{ item: itemName(c.item.name), level: c.item.level || 0 },
								{ action: { kind: "equip", num: c.num, slot: c.slot, name: c.item.name, level: c.item.level || 0 }, resources: [{ num: c.num, quantity: 1 }], priority: 100 },
							);
						else if (c.origin === "stat") {
							var scroll = primaryScroll(s),
								quantity = statQuantity(c.item),
								ownedScroll = bag
									.filter(function (i) {
										return i.name === scroll;
									})
									.sort(function (a, b) {
										return (b.q || 1) - (a.q || 1);
									})[0],
								availableScrolls = Math.min(quantity, ownedScroll ? ownedScroll.q || 1 : 0);
							if (!G.items[scroll] || !quantity) return;
							row = advice(
								"stat",
								"stat",
								{ item: itemName(c.item.name), stat: G.classes[s.ctype].main_stat, quantity: quantity },
								{
									action: { kind: "stat", slot: c.slot, num: c.num, name: c.item.name, scroll: scroll, quantity: quantity },
									cost: G.items[scroll].g * (quantity - availableScrolls),
									resources: (availableScrolls ? [{ num: ownedScroll.num, quantity: availableScrolls }] : []).concat(c.num !== undefined ? [{ num: c.num, quantity: 1 }] : []),
									priority: 95,
								},
							);
						} else {
							plan = acquire(req, s, routes);
							if (!plan.tree.next) {
								if (c.origin !== "lesson" && !(c.origin === "parallel" && c.rank >= 800)) return;
								row = advice("inspect", "blocked", { item: itemName(req.name) }, { action: { kind: "inspect", name: req.name }, resources: [], priority: 0 });
							} else row = fromAction(plan.tree.next, req, plan);
						}
						row.id = row.kind + ":" + c.id;
						row.art = row.art || { item: c.item.name };
						row.gain = c.gain;
						var improvement =
							c.gain.amount > 0
								? { stat: c.gain.metric, amount: c.gain.amount }
								: c.gain.armor > 0
									? { stat: "armor", amount: c.gain.armor }
									: c.gain.resistance > 0
										? { stat: "resistance", amount: c.gain.resistance }
										: c.gain.hp > 0
											? { stat: "hp", amount: c.gain.hp }
											: null;
						if (["buy", "craft", "upgrade", "compound"].includes(row.kind) && improvement)
							row.reason = message("reason.project", Object.assign({ item: itemName(c.item.name), level: c.item.level || 0 }, improvement));
						row.target = c.item;
						row.slot = c.slot;
						row.lesson = (
							teaching.find(function (l) {
								return l.missing.some(function (r) {
									return r.slot === c.slot && r.name === c.item.name;
								});
							}) || {}
						).id;
						row.plan = plan;
						var survival = Math.max(0, c.gain.armor + c.gain.resistance) / 10,
							burden =
								plan &&
								plan.tree.alternatives.find(function (a) {
									return a.kind === "develop";
								});
						row.expected = burden ? { copies: burden.meanCopies, scrollGold: burden.meanGold, minimum: burden.minimum } : null;
						var value = (c.gain.amount / Math.max(1, current[goal.metric || metricFor(s)] || 1)) * 100 + survival + c.setGain * 100;
						var readyDevelopment = ["upgrade", "compound"].includes(row.kind) && !row.cost;
						row.priority = row.kind === "equip" ? 250 + value : row.kind === "stat" && !row.cost ? 210 + value : c.origin === "lesson" ? 140 + value : 60 + value + (c.rank >= 700 ? 30 : 0);
						if (row.kind === "craft" && row.cost <= s.budget) row.priority = 180 + value;
						if (readyDevelopment) row.priority = 180 + value - 25 * Math.log(1 / row.action.chance);
						if (row.kind === "inspect") row.priority = 90 + value;
						// Compare gold with the improvement, even on a wealthy character.
						// An affordable stat scroll is not automatically a useful first purchase.
						var investment = row.cost;
						if (burden && !readyDevelopment) {
							var vendor = index.sources(c.item.name).find(function (source) {
								return source.kind === "shop" && source.currency === "gold";
							});
							investment = Math.max(investment, burden.meanGold + (vendor ? vendor.price * burden.meanCopies : 0));
						}
						if (row.kind !== "equip") row.priority -= 25 * Math.log1p(investment / Math.max(1, value) / 1000);
						if (row.cost > s.budget) row.priority -= 70;
						if (burden && !readyDevelopment && burden.meanGold > Math.max(s.budget, 10000) * 3) row.priority -= 50;
						if (burden && !readyDevelopment) row.priority -= 20 * Math.log1p(burden.meanGold / Math.max(10000, s.budget)) + 8 * Math.log2(Math.max(1, burden.meanCopies));
						ranked.push(row);
					});
				ranked.sort(function (a, b) {
					return b.priority - a.priority || a.cost - b.cost;
				});
				ranked.slice(0, 4).forEach(function (r) {
					rows.push(r);
					needs.push(r.target.name);
					if (r.plan) result.plans.push(r.plan);
				});
				// A native level projection can end the stat goal without another item.
				if (goal.kind === "stat") {
					var finish = s.level;
					while (finish < Math.min(maximumLevel, s.level + 15) && calculate(s.ctype, finish, s.durable, s.map)[goal.metric] < goal.target) finish++;
					if (finish > s.level && calculate(s.ctype, finish, s.durable, s.map)[goal.metric] >= goal.target) result.levelFinish = finish;
				}
			}
			if (!completed && goal.kind === "shop") {
				if (!count(bag, "stand0", 0) && !count(bag, "stand1", 0) && !s.shopOpen) addRequest({ name: "stand0", level: 0 }, { priority: 100 });
				else rows.push(advice("shop", "shop", {}, { id: "shop", art: { item: "stand0" }, priority: 100, action: { kind: "shop" } }));
			}
			if (!completed && goal.kind === "gather" && s.level >= G.skills[goal.skill].level) {
				var tool = goal.skill === "fishing" ? "rod" : "pickaxe";
				if (
					!Object.values(s.durable)
						.concat(bag)
						.some(function (i) {
							return i.name === tool;
						})
				)
					addRequest({ name: tool, level: 0 }, { priority: 100 });
				else
					rows.push(
						advice(
							"gather",
							"gather",
							{ skill: goal.skill },
							{ id: "gather:" + goal.skill, art: { item: tool }, priority: 90, action: { kind: "gather", skill: goal.skill, ready: !!((s.gathering || {})[goal.skill] || {}).ready } },
						),
					);
			}
			if (merchantWork) {
				var market = goal.market || (s.map === "woffice" ? "lostandfound" : "secondhands");
				var selectedMarket = marketAdvice(s, market);
				selectedMarket.priority += 10;
				rows.push(selectedMarket);
				if (stocked(s)) rows.push(advice("shop", "shop_keep", {}, { id: "shop:keep", title: message("action.shop_keep"), art: { item: "stand0" }, priority: 80, action: { kind: "shop" } }));
				if (goal.kind === "trade" || goal.kind === "gold") rows.push(marketAdvice(s, market === "secondhands" ? "lostandfound" : "secondhands"));
			}
			if (!completed && goal.kind === "encounter")
				rows.push(
					advice(
						"prepare",
						"prepare",
						{ monster: G.monsters[goal.monster].name },
						{ id: "prepare:" + goal.monster, art: { monster: goal.monster }, priority: 160, action: { kind: "prepare", monster: goal.monster } },
					),
				);
			var hunt = s.conditions.monsterhunt;
			if (s.ctype !== "merchant" && (!hunt || (hunt.sn === s.realm && hunt.ms > 0))) {
				var huntRoute =
					hunt &&
					safe.find(function (r) {
						return r.monster === hunt.id;
					});
				if (!hunt || hunt.c === 0)
					rows.push(
						advice(
							"hunt",
							hunt ? "hunt_turnin" : "hunt",
							{},
							{
								id: hunt ? "hunt:turnin" : "hunt:request",
								art: { npc: "monsterhunter" },
								priority: hunt ? 200 : needs.includes("monstertoken") ? 100 : 20,
								action: { kind: "hunt", npc: "monsterhunter" },
							},
						),
					);
				else if (huntRoute) rows.push(farmAdvice(huntRoute, "hunt_farm", { priority: 85, remaining: hunt.c }));
			}
			var income =
				s.ctype === "merchant" ||
				rows.some(function (r) {
					return r.cost > s.budget;
				}) ||
				goal.kind === "gold" ||
				s.gold < s.reserve;
			var farm = safe.slice().sort(function (a, b) {
				return (income ? b.net - a.net : b.xp - a.xp) || a.id.localeCompare(b.id);
			})[0];
			if (goal.kind === "farm")
				farm = safe.find(function (r) {
					return r.monster === goal.monster && (!goal.map || r.map === goal.map);
				});
			if (merchantWork) farm = null;
			// A deliberate early lesson: a few Goo fights, then Bees for XP and wings.
			// The estimate must still pass; a death or costly observed fight vetoes it.
			if (
				teaching.length &&
				["foundation", "working"].includes(
					(
						teaching.find(function (l) {
							return !l.complete;
						}) || {}
					).id,
				)
			) {
				var gooPractice =
					Object.values(s.observations || {}).some(function (o) {
						return o.monster === "goo" && o.kills >= 5;
					}) || s.level >= 8;
				var early = safe.find(function (r) {
					return r.monster === (gooPractice ? "bee" : "goo");
				});
				if (early) farm = early;
			}
			function farmReason(route) {
				if (route.monster === "bee" && teaching.length && !route.trial) return "bees";
				if (route.trial) return income ? "try_income" : "try_xp";
				return income ? (route.proven ? "income" : "gold") : route.proven ? "xp" : "level";
			}
			if (farm)
				rows.push(
					farmAdvice(farm, farmReason(farm), {
						priority: goal.kind === "farm" || goal.kind === "gold" ? 110 : result.levelFinish && result.levelFinish <= s.level + 3 ? 150 : 35,
					}),
				);
			else if (["farm", "encounter"].includes(goal.kind))
				rows.push(
					advice(
						"prepare",
						"prepare",
						{ monster: G.monsters[goal.monster].name },
						{ id: "prepare:" + goal.monster, art: { monster: goal.monster }, priority: 100, action: { kind: "prepare", monster: goal.monster } },
					),
				);
			result.opportunities = opportunities(s, goal, needs);
			// Reserve a row for a live opportunity without losing the stored project.
			if (result.opportunities[0]) rows.push(result.opportunities[0]);
			var reserved = {},
				spent = 0,
				ids = new Set(),
				assignedSlots = new Set(),
				chosen = [];
			rows.sort(function (a, b) {
				return b.priority - a.priority || a.id.localeCompare(b.id);
			});
			rows.forEach(function (r) {
				var identity = r.kind === "farm" ? "farm:" + (r.action.route || r.route).id : r.kind === "inspect" ? "inspect:" + (r.target || r.request).name : r.kind === "hunt" ? "hunt" : r.id;
				if (
					chosen.length >= policy.rows ||
					ids.has(identity) ||
					(r.slot && assignedSlots.has(r.slot)) ||
					r.resources.some(function (use) {
						return (reserved[use.num] || 0) + use.quantity > ((s.items[use.num] || {}).q || 1);
					})
				)
					return;
				r.resources.forEach(function (use) {
					reserved[use.num] = (reserved[use.num] || 0) + use.quantity;
				});
				if (r.slot) assignedSlots.add(r.slot);
				ids.add(identity);
				chosen.push(r);
			});
			result.rows = chosen.slice(0, policy.rows);
			if (
				farm &&
				!result.rows.some(function (r) {
					return r.kind === "farm";
				})
			)
				result.rows[Math.min(1, result.rows.length)] = farmAdvice(farm, farmReason(farm));
			if (
				result.opportunities[0] &&
				!result.rows.some(function (r) {
					return r.kind === "event";
				}) &&
				!result.rows.some(function (r) {
					return r.kind === "recover";
				})
			)
				result.rows[Math.min(2, result.rows.length)] = result.opportunities[0];
			if (
				income &&
				farm &&
				!result.rows.some(function (r) {
					return r.kind === "farm" || r.kind === "supplies";
				})
			)
				result.rows[Math.min(1, result.rows.length)] = farmAdvice(farm, farmReason(farm));
			// Only visible projects share the spending budget. Replacing a project
			// with a farm or event must release its gold reservation.
			result.rows.forEach(function (r) {
				r.affordable = r.cost <= s.budget - spent;
				r.shortfall = r.affordable ? 0 : r.cost - (s.budget - spent);
				if (r.affordable) spent += r.cost;
			});
			result.choices = [
				s.ctype === "merchant" ? { kind: "trade", market: "secondhands" } : { kind: "stat", metric: metricFor(s), target: Math.max(1000, Math.ceil((current[metricFor(s)] + 1) / 500) * 500) },
				{ kind: "gold", target: Math.max(s.reserve * 2, Math.ceil((s.gold + 1) / 100000) * 100000) },
			];
			(s.ctype === "merchant" ? [] : safe)
				.filter(function (r, n, arr) {
					return (
						arr.findIndex(function (p) {
							return p.monster === r.monster;
						}) === n
					);
				})
				.sort(function (a, b) {
					return b.xp - a.xp;
				})
				.slice(0, 3)
				.forEach(function (r) {
					result.choices.push({ kind: "farm", monster: r.monster, map: r.map });
				});
			if (s.ctype === "merchant") {
				result.choices.push({ kind: "trade", market: "lostandfound" });
				if (s.level >= G.skills.fishing.level) result.choices.push({ kind: "gather", skill: "fishing" });
				if (s.level >= G.skills.mining.level) result.choices.push({ kind: "gather", skill: "mining" });
			}
			(s.ctype === "merchant" ? [] : result.opportunities)
				.filter(function (o) {
					return G.monsters[o.event];
				})
				.slice(0, 3)
				.forEach(function (o) {
					result.choices.push({ kind: "encounter", monster: o.event });
				});
			var wornSets = new Set(
				Object.values(s.durable)
					.concat(ownedEquipment(s))
					.map(function (i) {
						return G.items[i.name].set;
					})
					.filter(Boolean),
			);
			wornSets.forEach(function (name) {
				result.choices.push({ kind: "set", name: name });
			});
			result.routes = routes;
			return result;
		}
		function primaryScroll(s) {
			return G.classes[s.ctype].main_stat + "scroll";
		}
		return {
			evaluate: evaluate,
			index: index,
			legal: legal,
			places: places,
			props: props,
			calculate: calculate,
			development: development,
			statQuantity: statQuantity,
			inventory: inventory,
			count: count,
			reachable: reachable,
			assess: assess,
			normalize: normalize,
			acquire: acquire,
			itemName: itemName,
			lessons: lessons,
			active: active,
		};
	}
	root.AdventureProgression = { create: create, plain: plain, policy: policy, message: message, advice: advice, body: body, weapons: weapons, groups: groups };
	if (typeof module !== "undefined" && module.exports) module.exports = root.AdventureProgression;
})(typeof globalThis !== "undefined" ? globalThis : this);
