// Native stat and item calculations; parity is checked against their sources.
// The server remains authoritative. Only synthetic players with XP=0 enter here.
(function (root) {
	function nativeHelpers(G, bindings) {
		var min = Math.min,
			max = Math.max,
			round = Math.round,
			floor = Math.floor,
			prop_cache = {},
			level,
			p;
		var doublehand_types = bindings.doublehandTypes;
		function clone(value) {
			return JSON.parse(JSON.stringify(value));
		}
		function in_arr(value, array) {
			return array.includes(value);
		}
		function calculate_item_properties(item, args) {
			if (!args) args = {};
			var def = args.def || G.items[item.name],
				cls = "",
				map = "";
			if (args["class"] && def[args["class"]]) cls = args["class"];
			if (args["map"] && def[args["map"]]) map = args["map"];
			var prop_key = def.name + item.name + (def.card || "") + "|" + item.level + "|" + item.stat_type + "|" + item.p + "|" + cls + "|" + map;
			if (prop_cache[prop_key]) return prop_cache[prop_key];
			if (cls || map) def = clone(def);
			if (cls) adopt_extras(def, def[cls]);
			if (map) adopt_extras(def, def[map]);
			//#NEWIDEA: An item cache here [15/11/16]
			var prop = {
				gold: 0,
				luck: 0,
				xp: 0,
				int: 0,
				str: 0,
				dex: 0,
				vit: 0,
				for: 0,
				charisma: 0,
				cuteness: 0,
				awesomeness: 0,
				bling: 0,
				hp: 0,
				mp: 0,
				attack: 0,
				range: 0,
				armor: 0,
				incdmgamp: 0,
				resistance: 0,
				pnresistance: 0,
				firesistance: 0,
				fzresistance: 0,
				phresistance: 0,
				stresistance: 0,
				stun: 0,
				blast: 0,
				explosion: 0,
				breaks: 0,
				stat: 0,
				speed: 0,
				level: 0,
				evasion: 0,
				miss: 0,
				reflection: 0,
				lifesteal: 0,
				manasteal: 0,
				attr0: 0,
				attr1: 0,
				rpiercing: 0,
				apiercing: 0,
				crit: 0,
				critdamage: 0,
				dreturn: 0,
				frequency: 0,
				mp_cost: 0,
				mp_reduction: 0,
				output: 0,
				courage: 0,
				mcourage: 0,
				pcourage: 0,
				set: null,
				class: null,
			};
			var mult = {
				gold: 0.5,
				luck: 1,
				xp: 0.5,
				int: 1,
				str: 1,
				dex: 1,
				vit: 1,
				for: 1,
				armor: 2.25,
				resistance: 2.25,
				speed: 0.325,
				evasion: 0.325,
				reflection: 0.15,
				lifesteal: 0.15,
				manasteal: 0.04,
				rpiercing: 2.25,
				apiercing: 2.25,
				crit: 0.125,
				dreturn: 0.5,
				frequency: 0.325,
				mp_cost: -0.6,
				output: 0.175,
			};
			if (item.p == "shiny") {
				if (def.attack) {
					prop.attack += 4;
					if (doublehand_types.includes(G.items[item.name].wtype)) prop.attack += 3;
				} else if (def.stat) {
					prop.stat += 2;
				} else if (def.armor) {
					prop.armor += 12;
					prop.resistance = (prop.resistance || 0) + 10;
				} else {
					prop.dex += 1;
					prop["int"] += 1;
					prop.str += 1;
				}
			} else if (item.p == "glitched") {
				var roll = Math.random();
				if (roll < 0.33) {
					prop.dex += 1;
				} else if (roll < 0.66) {
					prop["int"] += 1;
				} else {
					prop.str += 1;
				}
			} else if (item.p && G.titles[item.p]) {
				for (var p in G.titles[item.p]) if (p in prop) prop[p] += G.titles[item.p][p];
			}
			if (def.upgrade || def.compound) {
				var u_def = def.upgrade || def.compound;
				level = item.level || 0;
				prop.level = level;
				for (var i = 1; i <= level; i++) {
					var multiplier = 1;
					if (def.upgrade) {
						if (i == 7) multiplier = 1.25;
						if (i == 8) multiplier = 1.5;
						if (i == 9) multiplier = 2;
						if (i == 10) multiplier = 3;
						if (i == 11) multiplier = 1.25;
						if (i == 12) multiplier = 1.25;
					} else if (def.compound) {
						if (i == 5) multiplier = 1.25;
						if (i == 6) multiplier = 1.5;
						if (i == 7) multiplier = 2;
						if (i >= 8) multiplier = 3;
					}
					for (p in u_def) {
						if (p == "stat") prop[p] += round(u_def[p] * multiplier);
						else prop[p] += u_def[p] * multiplier; // for weapons with float improvements [04/08/16]
						if (p == "stat" && i >= 7) prop.stat++;
					}
				}
			}
			if (item.level == 10 && prop.stat && def.tier && def.tier >= 3) prop.stat += 2;
			for (p in def)
				if (prop[p] === null) prop[p] = def[p];
				else if (prop[p] != undefined) prop[p] += def[p];
			if (item.p == "legacy" && def.legacy) {
				for (var name in def.legacy) {
					if (def.legacy[name] === null) delete prop[name];
					else prop[name] = (prop[name] || 0) + def.legacy[name];
				}
			}
			for (p in prop)
				if (!in_arr(p, ["evasion", "miss", "reflection", "dreturn", "lifesteal", "manasteal", "attr0", "attr1", "crit", "critdamage", "set", "class", "breaks"])) prop[p] = round(prop[p]);
			if (def.stat && item.stat_type) {
				prop[item.stat_type] += prop.stat * mult[item.stat_type];
				prop.stat = 0;
			}
			// for(p in prop) prop[p]=floor(prop[p]); - round probably came after this one, commenting out [13/09/16]
			prop_cache[prop_key] = prop;
			return prop;
		}

		function calculate_item_grade(def, item) {
			if (!(def.upgrade || def.compound)) return 0;
			if (((item && item.level) || 0) >= (def.grades || [9, 10, 11, 12])[3]) return 4;
			if (((item && item.level) || 0) >= (def.grades || [9, 10, 11, 12])[2]) return 3;
			if (((item && item.level) || 0) >= (def.grades || [9, 10, 11, 12])[1]) return 2;
			if (((item && item.level) || 0) >= (def.grades || [9, 10, 11, 12])[0]) return 1;
			return 0;
		}

		function adopt_extras(def, ex) {
			for (var p in ex) {
				if (p == "upgrade" || p == "compound") {
					for (var pp in ex) {
						def[p][pp] = (def[p][pp] || 0) + ex[p][pp];
					}
				} else def[p] = (def[p] || 0) + ex[p];
			}
		}

		function damage_multiplier(defense) {
			// [10/12/17]
			return min(
				1.32,
				max(
					0.05,
					1 -
						(max(0, min(100, defense)) * 0.001 +
							max(0, min(100, defense - 100)) * 0.001 +
							max(0, min(100, defense - 200)) * 0.00095 +
							max(0, min(100, defense - 300)) * 0.0009 +
							max(0, min(100, defense - 400)) * 0.00082 +
							max(0, min(100, defense - 500)) * 0.0007 +
							max(0, min(100, defense - 600)) * 0.0006 +
							max(0, min(100, defense - 700)) * 0.0005 +
							max(0, defense - 800) * 0.0004) +
						max(0, min(50, 0 - defense)) * 0.001 + // Negative's / Armor Piercing
						max(0, min(50, -50 - defense)) * 0.00075 +
						max(0, min(50, -100 - defense)) * 0.0005 +
						max(0, -150 - defense) * 0.00025,
				),
			);
		}
		return {
			characterSlots: bindings.characterSlots,
			itemProperties: function (item, args) {
				if (Object.keys(prop_cache).length > 512) prop_cache = {};
				return calculate_item_properties(item, args);
			},
			itemGrade: function (item) {
				return calculate_item_grade(G.items[item.name], item);
			},
			damageMultiplier: damage_multiplier,
		};
	}
	function create(G, helpers) {
		var min = Math.min,
			max = Math.max,
			round = Math.round,
			floor = Math.floor,
			stat,
			p,
			level;
		var goldm = 1,
			luckm = 1,
			xpm = 1,
			mode = {},
			parties = {},
			perfc = { cps: 0 };
		var character_slots = helpers.characterSlots,
			calculate_item_properties = helpers.itemProperties;
		function recalculate_vxy() {}
		function server_log() {}
		function weapon_stat_attack(type, stats, weapon_attack) {
			return weapon_attack * (type === "paladin" ? stats.str / 20 + stats.int / 40 : stats[(G.classes[type] || G.classes.merchant).main_stat] / 20);
		}
		var stat_to_attr = {
			str: "str",
			int: "int",
			dex: "dex",
			vit: "vit",
			for: "for",
			armor: "armor",
			resistance: "resistance",
			pnresistance: "pnresistance",
			firesistance: "firesistance",
			fzresistance: "fzresistance",
			phresistance: "phresistance",
			stresistance: "stresistance",
			incdmgamp: "incdmgamp",
			stun: "stun",
			blast: "blast",
			explosion: "explosion",
			evasion: "evasion",
			cuteness: "cuteness",
			bling: "bling",
			dreturn: "dreturn",
			reflection: "reflection",
			crit: "crit",
			critdamage: "critdamage",
			miss: "miss",
			avoidance: "avoidance",
			hp: "max_hp",
			mp: "max_mp",
			speed: "speed",
			lifesteal: "lifesteal",
			manasteal: "manasteal",
			apiercing: "apiercing",
			rpiercing: "rpiercing",
			output: "output",
			attack: "a_attack",
			mp_cost: "a_mp_cost",
			mp_reduction: "mp_reduction",
			xp: "xxp",
			luck: "xluck",
			gold: "xgold",
			range: "range",
			courage: "courage",
			mcourage: "mcourage",
			pcourage: "pcourage",
		};

		function apply_stats(player, prop, args) {
			for (var stat in prop) {
				if (args && args.no_range && stat == "range") {
					continue;
				}
				if (stat_to_attr[stat]) {
					player[stat_to_attr[stat]] = player[stat_to_attr[stat]] + prop[stat];
				} else if (stat == "frequency") {
					player.frequency += prop[stat] / 100.0;
				}
			}
		}

		function calculate_common_stats(entity) {
			if (entity.s.poisoned) {
				entity.frequency *= 0.9;
			}
			if (entity.s.frozen) {
				entity.frequency *= 0.3;
			}
			if (entity.speed < 1) {
				entity.speed = 1;
			}
			if (entity.s.tangled) {
				entity.speed = min(entity.speed, 24);
			}
		}

		function calculate_player_stats(player) {
			if (player.is_npc) {
				return;
			}
			player.max_xp = G.levels[player.level + ""];
			var level_up = false;
			while (player.xp >= player.max_xp) {
				level_up = true;
				player.xp -= player.max_xp;
				player.level++;
				player.p.max_xp_multiplier = 1;
				if (player.level >= 80) player.p.encouragement_reached80 = true;
				player.max_xp = G.levels[player.level + ""];
				player.hp = 0;
				achievement_logic_level(player);
			}
			if (level_up) {
				if (player.encouragement) encouragement_update(player, true);
				if (player.xp > 0) player.p.max_xp_multiplier = max(1, (player.level >= 80 ? player.encouragement_xp_carry80 : player.encouragement_xp_carry) || 1);
				if (player.level >= 80) {
					realm_broadcast("server_message", localization.message("server.server_message.is_now_level", { player: String(player.name), level: String(player.level) }, { color: "#968CFA" }));
				} else if (player.level >= 70) {
					broadcast("server_message", localization.message("server.server_message.is_now_level_2", { player: String(player.name), level: String(player.level) }, { color: "#968CFA" }));
				}
				xy_emit(player, "ui", { type: "level_up", name: player.name });
			}
			delete player.encouragement_xp_carry;
			delete player.encouragement_xp_carry80;
			//	disappearing_text(player.socket,player,"LEVEL UP!",{xy:1,size:"huge",color:"#724A8F"});
			if (player.xp < 0) {
				player.xp = 0;
				player.warnings = (player.warnings || 0) + 1;
				if (player.warnings == 2) {
					console.log("'Your monster!' logged out ->");
					player.socket.emit("game_log", localization.message("server.game_log.you_monster"));
					player.socket.disconnect();
					return;
				}
			}
			var class_def = G.classes[player.type];
			var item_attack = 0;
			var the_date = new Date();
			if (!class_def) {
				class_def = G.classes.merchant;
			} // when npc's get resend't
			player.range = class_def.range;
			player.max_hp = class_def.hp;
			player.max_mp = class_def.mp;
			["stealth"].forEach(function (prop) {
				player[prop] = false;
			});
			["a_mp_cost", "a_attack", "stones", "lifesteal", "manasteal", "incdmgamp", "mp_reduction", "stun", "blast", "explosion", "cuteness", "bling"].forEach(function (prop) {
				player[prop] = 0;
			});
			[
				"speed",
				"attack",
				"frequency",
				"mp_cost",
				"armor",
				"resistance",
				"apiercing",
				"rpiercing",
				"a",
				"aura",
				"evasion",
				"miss",
				"reflection",
				"crit",
				"critdamage",
				"dreturn",
				"computer",
				"xxp",
				"xluck",
				"xgold",
				"output",
				"courage",
				"mcourage",
				"pcourage",
				"pnresistance",
				"firesistance",
				"fzresistance",
				"phresistance",
				"stresistance",
			].forEach(function (prop) {
				player[prop] = class_def[prop] || 0;
			});
			if (!player.a) {
				player.a = {};
			} //abilities
			if (!player.aura) {
				player.aura = {};
			}
			if (player.paura) {
				for (var id in player.paura) {
					player.aura[id] = player.paura[id];
				}
			}
			for (stat in class_def.stats) {
				player[stat] = class_def.stats[stat] + player.level * class_def.lstats[stat];
				if (player.level > 40) {
					player[stat] += (player.level - 40) * class_def.lstats[stat];
				}
				if (player.level > 55) {
					player[stat] += (player.level - 55) * class_def.lstats[stat];
				}
				if (player.level > 65) {
					player[stat] += (player.level - 65) * class_def.lstats[stat];
				}
				if (player.level > 80) {
					player[stat] -= (player.level - 80) * class_def.lstats[stat];
				}
				player[stat] = floor(player[stat]);
			}
			if (!player.slots) {
				player.slots = {};
			}
			// players.citems[27]=null; //- to reproduce the bug
			while (player.items.length > 42 && !player.items[player.items.length - 1]) {
				player.items.splice(player.items.length - 1);
			}
			while (player.citems.length > 42 && !player.citems[player.citems.length - 1]) {
				player.citems.splice(player.citems.length - 1);
			}
			player.isize = 42;
			player.sets = {};
			player.esize = player.isize - player.items.length;
			player.xpm = player.goldm = player.luckm = 1;
			for (var i = 0; i < player.items.length; i++) {
				var current = player.items[i];
				if (!current) {
					player.esize++;
				} else if (current.name == "supercomputer") {
					player.tracker = player.computer = player.supercomputer = true;
				} else if (current.name == "computer") {
					player.computer = true;
				} else if (current.name == "tracker") {
					player.tracker = true;
				} else if (current.expires) {
					// &&!current.ex = ex=elixier
					if (the_date > current.expires) {
						player.items[i] = null;
						player.citems[i] = null;
					} else if (G.items[current.name].gain) {
						var prop = calculate_item_properties(current);
						player.stones++;
						player["x" + G.items[current.name].gain] = prop[G.items[current.name].gain];
					}
				}
			}
			player.monster_stats = {};
			if (player.tracker) {
				for (var name in G.monsters) {
					var mx = max((player.p.stats.monsters[name] || 0) + (player.p.stats.monsters_diff[name] || 0), (player.max_stats.monsters[name] || [0, 0])[0]);
					if (!mx || !G.monsters[name].achievements) {
						continue;
					}
					G.monsters[name].achievements.forEach(function (def) {
						if (mx < def[0]) {
							return;
						}
						if (def[1] == "stat") {
							player.monster_stats[def[2]] = (player.monster_stats[def[2]] || 0) + def[3];
						}
					});
				}
			}
			character_slots.forEach(function (slot) {
				var current = player.slots[slot];
				if (!current) {
					return;
				}
				var def = G.items[current.name];
				if (!def) {
					console.log("#X Undefined item: " + current.name + " (" + slot + ")");
					return;
				}
				var prop = calculate_item_properties(current, { class: player.type, map: player.map });
				if (prop.class && !prop.class.includes(player.type)) {
					return;
				}

				apply_stats(player, prop, { no_range: slot == "offhand" && def.type == "weapon" });
				if (prop.attack) {
					if (slot == "offhand") {
						item_attack += prop.attack * 0.7;
					} else {
						item_attack += prop.attack;
					}
				}
				if (def.ability) {
					player.a[def.ability] = {
						attr0: ((player.a[def.ability] && player.a[def.ability].attr0) || 0) + prop.attr0,
						attr1: ((player.a[def.ability] && player.a[def.ability].attr1) || 0) + prop.attr1,
					};
				}
				if (def.aura) {
					player.aura[def.aura] = { attr0: prop.attr0 || 0, attr1: prop.attr1 || 0 };
				}
				if (slot == "mainhand") {
					apply_stats(player, class_def.doublehand[def.wtype] || class_def.mainhand[def.wtype] || {});
				}
				if (slot == "offhand") {
					apply_stats(
						player,
						class_def.offhand[def.wtype] ||
							class_def.offhand[def.type] || {
								no_range: !player.slots.mainhand,
							},
					);
				}
				if (prop.set) {
					player.sets[def.set] = (player.sets[def.set] || 0) + 1;
				}
			});
			for (var set in player.sets) {
				var prop = G.sets[set] && G.sets[set][player.sets[set]];
				if (!prop) {
					continue;
				}
				apply_stats(player, prop);
			}
			for (var condition in player.s) {
				var prop = G.conditions[condition];
				apply_stats(player, player.s[condition]);
				if (!prop) {
					continue;
				}
				apply_stats(player, prop);
			}
			apply_stats(player, player.monster_stats);
			if (player.slots.mainhand && player.slots.offhand && G.items[player.slots.mainhand.name].wtype == "stars" && G.items[player.slots.offhand.name].wtype != "stars") {
				item_attack /= 3.0;
			}
			if (player.slots.cape && player.slots.cape.name == "stealthcape") {
				player.stealth = true;
			}
			item_attack = max(item_attack, 5);
			player.attack += weapon_stat_attack(player.type, player, item_attack);
			player.attack += player.a_attack;
			if (player.type == "priest") {
				player.attack *= 1.6;
			}
			if (player.type == "warrior") {
				player.courage += round(player.str / 30);
			}
			if (player.type == "priest") {
				player.mcourage += round(player.int / 30);
			}
			if (player.type == "paladin") {
				player.pcourage += round(player.str / 30 + player.int / 30);
			}
			//console.log(player.speed)
			//player.speed+=player.dex/20.0+player.str/40.0+min(player.level,40)/4.0+max(0,min(player.level-40,20))/5.0+max(0,player.level-60)/7.0
			player.speed += min(player.dex, 256) / 32.0 + min(player.str, 256) / 64.0 + min(player.level, 40) / 10.0 + max(0, min(player.level - 40, 20)) / 15.0 + max(0, min(86, player.level) - 60) / 16.0;

			player.aggro_diff = player.bling / 100 - player.cuteness / 100;

			//console.log(player.speed)
			//player.max_hp+=player.str*5+player.vit*player.level/2; //player.str*10.0+player.level*10+player.vit*25
			player.max_hp += player.str * 21 + player.vit * (48 + player.level / 3.0);
			player.max_hp = max(1, player.max_hp);
			player.max_mp = max(1, player.max_mp);
			player.max_mp += player.int * 15.0 + player.level * 5;
			//player.armor+=player.str/2.0;
			player.armor += min(player.str, 160) + max(0, player.str - 160) * 0.25;
			player.resistance += min(player.int, 180) + max(0, player.int - 180) * 0.25;
			player.frequency += min(player.level, 80) / 164.0 + min(160, player.dex) / 640.0 + max(player.dex - 160, 0) / 925.0 + player.int / 1575.0; // 120 635 1275 is the original mix
			// player.frequency=9000;
			player.attack_ms = round(1000.0 / player.frequency);
			if (player.last_attack_ms && player.attack_ms != player.last_attack_ms) {
				// server_log("skill_timeout_correction: "+player.last_attack_ms+" to "+player.attack_ms+" timeout: "+(player.attack_ms-mssince(player.last.attack)))
				player.socket.emit("skill_timeout", {
					name: "attack",
					ms: player.attack_ms - mssince(player.last.attack),
					reason: "attack_ms",
				});
			}
			player.last_attack_ms = player.attack_ms;
			player.mp_cost += min(player.level, 80) * (player.mp_cost / 10.0) + player.a_mp_cost + player.crit * 1.25 + player.lifesteal * 1.5 + player.manasteal / 5.0;
			if (player.damage_type == "physical") {
				player.mp_cost += player.apiercing / 15.0;
			} else {
				player.mp_cost += player.rpiercing / 15.0;
			}
			player.mp_cost = max(1, player.mp_cost);
			if (!player.hp && !player.rip) {
				player.hp = player.max_hp;
				player.mp = player.max_mp;
			} // used for level-ups
			if ((player.gold || 0) <= 0) {
				player.gold = 0;
			}
			player.heal = 0;
			if (player.type == "priest") {
				player.heal = player.attack;
			}
			player.output = max(5, player.output);
			if (player.output) {
				player.attack = (player.attack * player.output) / 100.0;
			}
			if (player.s.damage_received) {
				player.attack += (player.s.damage_received.amount * 4) / 100;
			}
			["attack", "heal", "hp", "mp", "max_hp", "max_mp", "range", "mp_cost", "resistance", "armor"].forEach(function (prop) {
				player[prop] = round(player[prop]);
			});
			player.hp = max(0, min(player.hp, player.max_hp));
			player.mp = max(0, min(player.mp, player.max_mp));

			if (player.party && parties[player.party]) {
				if (player.party_xp) {
					player.xxp += player.party_xp;
				}
				if (player.party_luck) {
					player.xluck += player.party_luck;
				}
				if (player.party_gold) {
					player.xgold += player.party_gold;
				}
			}

			if (goldm != 1) {
				player.xgold += (goldm - 1) * 100.0;
				player.xluck += (luckm - 1) * 100.0;
				player.xxp += (xpm - 1) * 100.0;
			}
			player.luckm = 1 + player.xluck / 100.0;
			player.xpm = 1 + player.xxp / 100.0;
			player.goldm = 1 + player.xgold / 100.0;
			["luckm", "xpm", "goldm"].forEach(function (p) {
				player[p] = max(0.01, player[p]);
			});

			if (player.tskin == "konami") {
				player.range = 120;
				player.frequency += 0.25;
				player.goldm *= 0.25;
				player.luckm += 0.25;
			}

			if (player.s.invis) {
				player.speed = max(player.speed * 0.6, player.speed - 25);
				player.attack = round(player.attack * 1.25);
			}
			if (player.s.invincible) {
				player.attack = round(player.attack * 0.45);
			}
			if (player.s.dash) {
				player.speed = 500;
			}
			calculate_common_stats(player);

			player.tax =
				(player.level > 80 && 0.01) ||
				(player.level > 80 && 0.012) ||
				(player.level > 70 && 0.02) ||
				(player.level > 60 && 0.025) ||
				(player.level > 50 && 0.03) ||
				(player.level > 20 && 0.04) ||
				0.05;

			player.fear = Math.max(0, player.targets_p - player.courage, player.targets_m - player.mcourage, player.targets_u - player.pcourage);
			const sredux = [0, 20, 40, 70, 80, 90, 100];
			player.speed -= sredux[Math.min(sredux.length - 1, player.fear)];
			if (player.fear > 2) {
				player.attack = Math.round(player.attack * 0.2);
				if (mode.fear_affects_heal) {
					player.heal = Math.round(player.heal * 0.2);
				}
			} else if (player.fear > 1) {
				player.attack = Math.round(player.attack * 0.4);
				if (mode.fear_affects_heal) {
					player.heal = Math.round(player.heal * 0.4);
				}
			} else if (player.fear) {
				player.attack = Math.round(player.attack * 0.6);
				if (mode.fear_affects_heal) {
					player.heal = Math.round(player.heal * 0.6);
				}
			}

			if (player.map == "winterland") {
				player.speed *= 0.95;
			}

			if (player.p.stand || player.s.hardshell) {
				player.speed = 10;
			}
			player.evasion = min(50, player.evasion);
			player.reflection = min((player.s.reflection && 50) || 30, player.reflection);
			player.speed = min(player.speed, player.cruise || 200000);
			player.speed = round(max(5, player.speed));
			if (!player.gold && player.gold !== 0) {
				player.gold = 0;
				server_log("#X - GOLD BUG calculate", 1);
			}
			recalculate_vxy(player);
			perfc.cps += 1;
		}
		return function project(type, level, slots, map) {
			var player = {
				type: type,
				level: level,
				xp: 0,
				gold: 0,
				hp: 0,
				mp: 0,
				items: [],
				citems: [],
				slots: JSON.parse(JSON.stringify(slots)),
				s: {},
				p: {},
				map: map || "main",
				targets_p: 0,
				targets_m: 0,
				targets_u: 0,
				damage_type: G.items[slots.mainhand && slots.mainhand.name]?.damage_type || G.classes[type].damage_type,
			};
			calculate_player_stats(player);
			return player;
		};
	}
	root.ProgressionStats = { create: create, helpers: nativeHelpers, statScrollQuantities: [1, 10, 100, 1000, 9999, 9999, 9999] };
	if (typeof module !== "undefined" && module.exports) module.exports = root.ProgressionStats;
})(typeof globalThis !== "undefined" ? globalThis : this);
