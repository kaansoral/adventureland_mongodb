/* Read-only client/CODE adapter. Owns only its listeners and bounded evidence. */
(function (root) {
	"use strict";
	function create(env) {
		var G = env.G,
			engine = root.AdventureProgression.create(G, root.ProgressionStats.helpers(G, env));
		var socket,
			listeners = [],
			observations = {},
			encounters = {},
			evidence = {},
			gathered = {},
			world = null,
			serial = 0,
			recent = [],
			chests = {},
			offers = {},
			buyOrders = {},
			markets = {},
			credited = null,
			last = null,
			cached = null,
			cacheKey = "";
		function now() {
			return env.now ? env.now() : Date.now();
		}
		function clone(value) {
			return JSON.parse(JSON.stringify(value));
		}
		function character() {
			return env.character() || {};
		}
		function realm() {
			return env.realm();
		}
		function worldUpdate(status) {
			var at = now(),
				previous = world && world.realm === realm() ? world : null,
				instances = {},
				times = {};
			Object.keys(status || {}).forEach(function (key) {
				var value = status[key];
				if (!engine.active(value, at)) return;
				var id = (value && (value.id || value.round || value.end)) || "";
				var before = previous && previous.status[key],
					oldId = (before && (before.id || before.round || before.end)) || "";
				instances[key] = previous && previous.instances[key] && engine.active(before, at) && id === oldId ? previous.instances[key] : at + ":" + ++serial;
				times[key] = at;
			});
			world = { status: clone(status || {}), at: at, times: times, realm: realm(), instances: instances, connected: true };
			cacheKey = "";
		}
		function snapshot(options) {
			var c = character(),
				s = {};
			["name", "id", "level", "gold", "hp", "mp", "max_hp", "max_mp", "map", "rip", "xp", "tax"].forEach(function (k) {
				s[k] = c[k];
			});
			s.ctype = c.ctype || c.type;
			s.now = now();
			s.realm = realm();
			s.slots = clone(c.slots || {});
			s.items = clone((c.items || []).slice(0, 42));
			s.conditions = clone(c.s || {});
			s.partyKey = JSON.stringify([c.party || "", Object.keys(env.party ? env.party() || {} : {}).sort()]);
			if (c.q && Object.keys(c.q).length)
				s.items.forEach(function (i) {
					if (i) i.queued = true;
				});
			s.bankItems = [];
			if (c.bank && typeof c.bank === "object")
				Object.keys(c.bank)
					.filter(function (p) {
						return /^items\d+$/.test(p);
					})
					.slice(0, 2)
					.forEach(function (pack) {
						(c.bank[pack] || []).slice(0, 42).forEach(function (i, num) {
							if (i) s.bankItems.push(Object.assign({}, i, { pack: pack, bankNum: num }));
						});
					});
			s.listings = Object.values(offers).filter(function (offer) {
				return offer.map === c.map && offer.realm === s.realm && s.now >= offer.observedAt && s.now - offer.observedAt < root.AdventureProgression.policy.fresh;
			});
			s.listings = s.listings.slice(0, 64);
			s.buyOrders = Object.values(buyOrders).slice(0, 64);
			s.markets = clone(markets);
			s.shopOpen = !!c.stand;
			s.observations = observations;
			s.encounters = encounters;
			s.eventEvidence = evidence;
			s.world = world;
			s.gathering = {};
			["fishing", "mining"].forEach(function (skill) {
				var def = G.skills[skill],
					hand = c.slots && c.slots.mainhand,
					tool = skill === "fishing" ? "rod" : "pickaxe",
					next = env.nextSkill ? env.nextSkill(skill) : Infinity;
				s.gathering[skill] = {
					ready: !!(def && (!def.class || def.class.includes(s.ctype)) && c.level >= def.level && c.mp >= def.mp && hand && hand.name === tool && Number(next) <= s.now),
					successes: gathered[skill] || 0,
				};
			});
			options = options || {};
			["goal", "spendLimit", "allowPvp"].forEach(function (key) {
				if (options[key] !== undefined) s[key] = clone(options[key]);
			});
			return engine.normalize(s);
		}
		function record(monster, s) {
			if (!s || !G.monsters[monster]) return null;
			var key = s.map + ":" + monster,
				o = observations[key];
			if (!o || o.realm !== s.realm || o.loadout !== s.loadout || s.now - o.at > root.AdventureProgression.policy.observationAge)
				o = observations[key] = {
					monster: monster,
					map: s.map,
					realm: s.realm,
					loadout: s.loadout,
					at: s.now,
					kills: 0,
					credited: 0,
					seconds: 0,
					xp: 0,
					netGold: 0,
					lootGold: 0,
					potionGold: 0,
					deaths: 0,
				};
			var keys = Object.keys(observations);
			if (keys.length > 32)
				delete observations[
					keys.sort(function (a, b) {
						return observations[a].at - observations[b].at;
					})[0]
				];
			return o;
		}
		function updatePlayer() {
			var s = snapshot();
			if (!s) return;
			if (last && last.realm === s.realm && last.loadout === s.loadout) {
				var action = recent[recent.length - 1],
					o = action && s.now - action.at < 10000 ? record(action.monster, s) : null;
				if (o) {
					if (s.rip && !last.rip) o.deaths++;
					["hpot0", "hpot1", "mpot0", "mpot1"].forEach(function (name) {
						var used = Math.max(0, engine.count(last.items.filter(Boolean), name, 0) - engine.count(s.items.filter(Boolean), name, 0));
						o.potionGold += used * G.items[name].g;
						o.netGold = o.lootGold - o.potionGold;
					});
				}
				if (credited && s.now - credited.at < 2000 && s.level === last.level && s.xp > last.xp) {
					var route = record(credited.monster, s);
					route.xp += s.xp - last.xp;
				}
			}
			last = s;
			cacheKey = "";
		}
		function listen(event, fn) {
			socket.on(event, fn);
			listeners.push([event, fn]);
		}
		function detach() {
			if (socket)
				listeners.forEach(function (pair) {
					(socket.off || socket.removeListener).call(socket, pair[0], pair[1]);
				});
			socket = null;
			listeners = [];
		}
		function marketUpdate(place, items) {
			if (!["secondhands", "lostandfound"].includes(place) || !Array.isArray(items)) return;
			var value = env.itemValue || root.calculate_item_value || root.item_value,
				mult = G.multipliers || {};
			markets[place] = {
				realm: realm(),
				observedAt: now(),
				access: true,
				items: items
					.slice(0, 64)
					.filter(function (i) {
						return i && G.items[i.name];
					})
					.map(function (i) {
						var factor = place === "lostandfound" ? mult.lostandfound_mult : G.items[i.name].cash ? mult.secondhands_cash_mult : mult.secondhands_mult;
						return Object.assign({}, clone(i), { cost: value && Number.isFinite(factor) ? value(i) * factor * (i.q || 1) : null });
					}),
			};
			cacheKey = "";
		}
		function attach() {
			var next = env.socket();
			if (!next || next === socket) return;
			detach();
			socket = next;
			world = null;
			recent = [];
			chests = {};
			offers = {};
			buyOrders = {};
			markets = {};
			observations = {};
			encounters = {};
			evidence = {};
			gathered = {};
			last = null;
			listen("server_info", worldUpdate);
			listen("game_event", function (data) {
				var name = typeof data === "string" ? data : data.name;
				if (!G.monsters[name] && !G.events[name]) return;
				if (!world || world.realm !== realm()) worldUpdate({});
				// Announcements describe this event only. They cannot refresh the rest
				// of the server status or prove combat readiness.
				world.status[name] = Object.assign({}, typeof data === "object" ? data : {}, { live: true });
				world.times[name] = now();
				world.instances[name] = now() + ":" + ++serial;
				world.connected = true;
				cacheKey = "";
			});
			listen("game_response", function (data) {
				var skill = data.cevent === "fishing_success" ? "fishing" : data.cevent === "mining_success" ? "mining" : null;
				if (skill) {
					gathered[skill] = (gathered[skill] || 0) + 1;
					cacheKey = "";
				}
			});
			listen("welcome", function (data) {
				if (data.S) worldUpdate(data.S);
			});
			listen("start", function (data) {
				if (data.s_info) worldUpdate(data.s_info);
				updatePlayer();
			});
			listen("hardcore_info", function (data) {
				worldUpdate(data.E);
			});
			listen("disconnect", function () {
				if (world) world.connected = false;
				offers = {};
				buyOrders = {};
				markets = {};
				cacheKey = "";
			});
			listen("new_map", function () {
				recent = [];
				chests = {};
				offers = {};
				credited = null;
				cacheKey = "";
			});
			// Only a packet containing trade slots can refresh a listing. The visual
			// entity timer also ticks during rendering and is not market evidence.
			listen("entities", function (data) {
				(data.players || []).forEach(function (player) {
					if (!player.slots) return;
					var id = player.id || player.name,
						current = (env.entities() || {})[id] || {};
					Object.keys(offers).forEach(function (key) {
						if (offers[key].seller === id) delete offers[key];
					});
					Object.keys(buyOrders).forEach(function (key) {
						if (buyOrders[key].seller === id) delete buyOrders[key];
					});
					if (player.stand === false || (!player.stand && !current.stand)) return;
					Object.keys(player.slots)
						.filter(function (slot) {
							return slot.startsWith("trade");
						})
						.forEach(function (slot) {
							var i = player.slots[slot];
							if (!i || i.v || i.giveaway || !(i.price > 0) || !i.rid) return;
							(i.b ? buyOrders : offers)[id + ":" + slot] = {
								name: i.name,
								level: i.level || 0,
								stat_type: i.stat_type,
								quantity: i.q || 1,
								price: i.price,
								rid: i.rid,
								seller: id,
								slot: slot,
								map: player.map || character().map,
								observedAt: now(),
								realm: realm(),
							};
						});
				});
				Object.keys(offers)
					.sort(function (a, b) {
						return offers[b].observedAt - offers[a].observedAt;
					})
					.slice(64)
					.forEach(function (key) {
						delete offers[key];
					});
				Object.keys(buyOrders)
					.sort(function (a, b) {
						return buyOrders[b].observedAt - buyOrders[a].observedAt;
					})
					.slice(64)
					.forEach(function (key) {
						delete buyOrders[key];
					});
				cacheKey = "";
			});
			listen("disappear", function (data) {
				Object.keys(offers).forEach(function (key) {
					if (offers[key].seller === data.id) delete offers[key];
				});
				Object.keys(buyOrders).forEach(function (key) {
					if (buyOrders[key].seller === data.id && buyOrders[key].map === character().map) delete buyOrders[key];
				});
				cacheKey = "";
			});
			listen("player", updatePlayer);
			listen("secondhands", function (items) {
				marketUpdate("secondhands", items);
			});
			listen("lostandfound", function (items) {
				marketUpdate("lostandfound", items);
			});
			listen("game_response", function (data) {
				if (data && data.response === "data") marketUpdate(data.place, data.items);
				if (data === "lostandfound_donate" || (data && data.response === "lostandfound_donate")) {
					markets.lostandfound = { realm: realm(), observedAt: now(), access: false };
					cacheKey = "";
				}
			});
			listen("hit", function (data) {
				var c = character(),
					entities = env.entities() || {},
					entity = entities[data.id] || entities["DEAD" + data.id];
				if ((data.hid !== c.id && data.hid !== c.name) || !entity || !G.monsters[entity.mtype || entity.type]) return;
				var s = snapshot(),
					monster = entity.mtype || entity.type,
					o = record(monster, s),
					at = now(),
					previous = recent[recent.length - 1];
				if (!o) return;
				if (previous && previous.monster === monster && at - previous.at < 10000) o.seconds += Math.max(0, at - previous.at) / 1000;
				o.at = at;
				recent.push({ monster: monster, at: at, x: entity.real_x === undefined ? entity.x : entity.real_x, y: entity.real_y === undefined ? entity.y : entity.real_y });
				recent = recent
					.filter(function (r) {
						return at - r.at < 10000;
					})
					.slice(-32);
			});
			listen("kill_credit", function (data) {
				var s = snapshot(),
					at = now(),
					hit = recent.find(function (h) {
						return h.monster === data.mtype && at - h.at < 10000;
					});
				if (!s || !G.monsters[data.mtype]) return;
				// Native credit also includes healers and tanks who never attack.
				// It can complete an encounter goal without inventing a solo farm.
				var previous = encounters[data.mtype];
				encounters[data.mtype] = { at: at, realm: s.realm, loadout: s.loadout, credited: previous && previous.realm === s.realm && previous.loadout === s.loadout ? previous.credited + 1 : 1 };
				if (!hit) {
					cacheKey = "";
					return;
				}
				var o = record(data.mtype, s);
				o.kills++;
				o.credited++;
				o.at = at;
				credited = { monster: data.mtype, at: at };
				if (world && engine.active(world.status[data.mtype], at)) {
					evidence[data.mtype] = { at: at, realm: s.realm, instance: world.instances[data.mtype], loadout: s.loadout, ready: !s.rip && s.hp > s.max_hp * 0.65, credited: o.credited };
				}
				cacheKey = "";
			});
			listen("drop", function (data) {
				var matches = recent.filter(function (h) {
						return now() - h.at < 3000 && Math.hypot(data.x - h.x, data.y - h.y) < 60;
					}),
					types = Array.from(
						new Set(
							matches.map(function (h) {
								return h.monster;
							}),
						),
					);
				if (types.length === 1 && data.map === character().map) chests[data.id] = { monster: types[0], at: now(), realm: realm() };
				Object.keys(chests).forEach(function (id) {
					if (now() - chests[id].at > 60000) delete chests[id];
				});
			});
			listen("chest_opened", function (data) {
				var chest = chests[data.id];
				delete chests[data.id];
				if (!chest || chest.realm !== realm() || now() - chest.at > 60000 || !(data.gold >= 0)) return;
				var o = record(chest.monster, snapshot());
				if (!o) return;
				o.lootGold += data.gold;
				o.netGold = o.lootGold - o.potionGold;
				cacheKey = "";
			});
			// Existing status is useful once on CODE startup. Never refresh its age
			// just because a caller asks for advice again.
			if (env.status()) worldUpdate(env.status());
		}
		function read(options) {
			attach();
			var s = snapshot(options);
			if (!s) return { version: 1, ready: false, rows: [] };
			var key = JSON.stringify([
				s.ctype,
				s.level,
				s.gold,
				s.tax,
				s.shopOpen,
				s.hp < s.max_hp * 0.35,
				s.rip,
				s.map,
				s.realm,
				s.slots,
				s.items,
				s.goal,
				s.spendLimit,
				s.allowPvp,
				Math.floor(s.now / 3000),
			]);
			if (key !== cacheKey) {
				cached = engine.evaluate(s);
				cacheKey = key;
			}
			return clone(cached);
		}
		return { read: read, snapshot: snapshot, detach: detach, attach: attach, engine: engine, worldUpdate: worldUpdate };
	}
	root.ProgressionRuntime = { create: create };
	if (typeof module !== "undefined" && module.exports) module.exports = root.ProgressionRuntime;
})(typeof globalThis !== "undefined" ? globalThis : this);
