var events={
	"anniversary":{
		"name":"Ten Years of Adventure Land",
		"modal":"event-anniversary",
		"sprite":"sixcake",
		"announcement":{"title":"10 Years of Adventure","color":"#F0B742","accent":"#ED86AB","effect":"confetti","text":"Find players for cake and Anniversary Gifts."},
		"type":"seasonal",
	},
	"abtesting":{
		"name":"A/B Testing",
		"modal":"event-abtesting",
		"sprite":"thehelmet",
		"announcement":{"color":"#EC526D","accent":"#78D6A0","effect":"sparks","text":"Join the team battle."},
		"duration":8*60,
		"join":true,
		"type":"daily",
	},
	"goobrawl":{
		"name":"Goo Brawl",
		"modal":"event-goobrawl",
		"sprite":"rgoo",
		"announcement":{"color":"#F78159","accent":"#A5DC6C","effect":"bubbles","text":"Join the goo fight."},
		"duration":9*60,
		"join":true,
		"type":"daily",
	},
	"crabxx":{
		"name":"Giga Crab",
		"modal":"event-crabxx",
		"sprite":"crabxx",
		"announcement":{"color":"#F18B64","accent":"#73D5DB","effect":"splash","text":"Help take down Giga Crab."},
		"duration":60*40,
		"join":true,
		"type":"daily",
	},
	"franky":{
		"name":"Franky",
		"modal":"event-franky",
		"sprite":"franky",
		"announcement":{"color":"#9FCF6D","accent":"#C29BE7","effect":"sparks","text":"Franky is awake."},
		"duration":60*40,
		"join":true,
		"type":"nightly",
	},
	"icegolem":{
		"name":"Ice Golem",
		"modal":"event-icegolem",
		"sprite":"icegolem",
		"announcement":{"color":"#8BD4F4","accent":"#E0F6FF","effect":"snow","text":"Face the Ice Golem."},
		"duration":60*40,
		"join":true,
		"type":"nightly",
	},
	"holidayseason":{
		"name":"Holiday Season",
		"modal":"event-holidayseason",
		"sprite":"grinch",
		"announcement":{"color":"#7ACA8B","accent":"#EE8B92","effect":"snow","text":"Collect candy canes and gifts."},
		"duration":60*60*24*30,
		//"join":true,
		"type":"seasonal",
	},
	"lunarnewyear":{
		"name":"Lunar New Year",
		"modal":"event-lunarnewyear",
		"sprite":"redenvelopev4",
		"announcement":{"color":"#EF7272","accent":"#F3D16E","effect":"fireworks","text":"Envelopes are dropping across the land."},
		"duration":60*60*24*15,
		//"join":true,
		"type":"seasonal",
	},
	"valentines":{
		"name":"Valentines",
		"modal":"event-valentines",
		"sprite":"cupid",
		"announcement":{"color":"#F08AB6","accent":"#F5C8D9","effect":"hearts","text":"Candy Pops and Love Goo await."},
		"duration":60*60*24*10,
		//"join":true,
		"type":"seasonal",
	},
	"egghunt":{
		"name":"Egg Hunt",
		"modal":"event-egghunt",
		"sprite":"basketofeggs",
		"announcement":{"color":"#AFD778","accent":"#D7A1E8","effect":"confetti","text":"Hunt for eggs across the land."},
		"duration":60*60*24*15,
		//"join":true,
		"type":"seasonal",
	},
	"halloween":{
		"name":"Halloween",
		"modal":"event-halloween",
		"sprite":"candy0",
		"announcement":{"color":"#F5A05B","accent":"#AD91DC","effect":"embers","text":"Collect candy from monsters."},
		"duration":60*60*24*30,
		//"join":true,
		"type":"seasonal",
	},
};

// Seeded rooms never determine loot or votes. Reply pools are sampled on the server.
events.dreams={
	disabled:false, // Stop new admissions without interrupting parties already inside.
	"name": "Cave of Many Dreams",
	// Discovery is through Dorr and the nearby INFO button, not a global event banner.
	"announcement": false,
	"modal": "cave-of-many-dreams",
	"sprite": "stonekey",
	"type": "daily",
	"duration": 1440,
	"party": 3,
	"vote_ms": 60000,
	"xp_multiplier": 10,
	"encounters": [
		{
			"id": "e01",
			"name": "Dice in a Tin Cup",
			"actor": "dice_operator",
			"group": "mixed",
			"kind": "dice",
			"text": "Pick a bet, then roll the die once for the party. We use gold or Amber from your shared purse. The winnings shown include your stake.",
			"options": [
				{
					"id": "small",
					"label": "Bet 2,000 shared gold; roll 4–6 for 4,000",
					"effect": "dice",
					"cost": 2000,
					"win": 4000,
					"offer": true
				},
				{
					"id": "large",
					"label": "Bet 5,000 shared gold; roll 4–6 for 10,000",
					"effect": "dice",
					"cost": 5000,
					"win": 10000
				},
				{
					"id": "six",
					"label": "Bet 2,000 on a six: win 12,000",
					"effect": "dice6",
					"cost": 2000,
					"win": 12000
				},
				{
					"id": "die",
					"label": "Bet 6 Amber for a Loaded Die: win on a six",
					"effect": "die",
					"amber": 6
				},
				{
					"id": "favor",
					"label": "Roll 4–6 for a helper; 1–3 brings two guards",
					"effect": "favor"
				},
				{
					"id": "door",
					"label": "Roll for a fight: four rats or four crabs",
					"effect": "dice_room"
				}
			]
		},
		{
			"id": "e02",
			"name": "The Unclaimed Parcel",
			"actor": "archive_vendor",
			"group": "mixed",
			"kind": "parcel",
			"text": "This box has been here for days. I can sell it to you, but I should warn you: it rattles when nobody touches it.",
			"options": [
				{
					"id": "e02_0",
					"effect": "venture",
					"label": "Cut the seal. Something inside is scratching.",
					"outcomes": [
						{
							"weight": 1,
							"text": "You open the box and take what is inside.",
							"reward": "cave_parcel"
						},
						{
							"weight": 1,
							"text": "The alarm rings. Three guards come for the box.",
							"fight": [
								"cave_guard",
								3
							]
						}
					],
					"offer": true
				},
				{
					"id": "e02_1",
					"effect": "venture",
					"label": "Pry the hinges off quietly.",
					"outcomes": [
						{
							"weight": 1,
							"text": "You lifted the lid without ringing the alarm.",
							"reward": "cave_parcel"
						}
					],
					"needs": "tool"
				},
				{
					"id": "e02_2",
					"label": "Spend 20 seconds checking the trap.",
					"effect": "careful",
					"result": "We will check it for 20 seconds, then collect the supplies."
				},
				{
					"id": "e02_3",
					"effect": "venture",
					"label": "Buy the box for 2,000 shared gold",
					"outcomes": [
						{
							"weight": 1,
							"text": "The seller opens the box for you.",
							"reward": "cave_parcel"
						}
					],
					"cost": 2000
				},
				{
					"id": "e02_4",
					"effect": "venture",
					"label": "Ring the alarm and claim what the guards carry.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The guards heard the bell.",
							"fight": [
								"cave_guard",
								3
							]
						}
					]
				},
				{
					"id": "e02_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e03",
			"name": "Feed the Vault",
			"actor": "monster_handler",
			"group": "mixed",
			"kind": "lure",
			"text": "I keep rats for the wolves. You can help me clear the pen, buy some bait, or take the tame one with you.",
			"options": [
				{
					"id": "e03_0",
					"effect": "venture",
					"label": "Open the rat gate. Fight six rats for the parcel.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Six rats spill out of the feeding pen.",
							"fight": [
								"cave_rat",
								6
							]
						}
					],
					"offer": true
				},
				{
					"id": "e03_1",
					"effect": "venture",
					"label": "Put your hand through the bars.",
					"outcomes": [
						{
							"weight": 1,
							"text": "You reached the latch.",
							"reward": "cave_parcel"
						},
						{
							"weight": 1,
							"text": "A wolf caught your sleeve.",
							"fight": [
								"cave_wolf",
								2
							]
						}
					]
				},
				{
					"id": "e03_2",
					"effect": "venture",
					"label": "Buy a rattling feed tin for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep it wrapped until you need it.",
							"flags": [
								"decoy"
							]
						}
					],
					"amber": 2
				},
				{
					"id": "e03_3",
					"effect": "venture",
					"label": "Free the tame rat. Let it follow us.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The rat knows whose side it is on.",
							"ally": "cave_rat"
						}
					]
				},
				{
					"id": "e03_4",
					"effect": "venture",
					"label": "Sell the spare feed for 2,000 cave gold.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The handler counts out the gold.",
							"gold": 2000
						}
					]
				},
				{
					"id": "e03_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e04",
			"name": "The Hot Forge",
			"actor": "inventor",
			"group": "mixed",
			"kind": "forge",
			"text": "There is a supply box stuck behind the hot forge. We can force it out, buy a cooled one, or leave it alone.",
			"options": [
				{
					"id": "e04_0",
					"effect": "venture",
					"label": "Pull the box out now; the guards may hear",
					"outcomes": [
						{
							"weight": 1,
							"text": "You pull the supply box free.",
							"reward": "cave_boss"
						},
						{
							"weight": 1,
							"text": "The forge guard heard you. He calls his men.",
							"fight": [
								"cave_lockbreaker",
								1
							]
						}
					],
					"offer": true
				},
				{
					"id": "e04_1",
					"effect": "venture",
					"label": "Buy the cooled box for 4 shared Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The smith hands over the cooled supply box.",
							"reward": "cave_parcel"
						}
					],
					"amber": 4
				},
				{
					"id": "e04_2",
					"effect": "venture",
					"label": "Wake the forge keeper on purpose.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The keeper drags its hammer from the fire.",
							"fight": [
								"cave_lockbreaker",
								1
							]
						}
					]
				},
				{
					"id": "e04_3",
					"effect": "venture",
					"label": "Borrow the smith’s pry bar.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Mind the hot end.",
							"flags": [
								"tool"
							]
						}
					]
				},
				{
					"id": "e04_4",
					"effect": "venture",
					"label": "Sell the scraps to the smith for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The smith buys the scraps. The Amber goes into the shared purse.",
							"amber": 2
						}
					]
				},
				{
					"id": "e04_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e05",
			"name": "The Guard’s Contract",
			"actor": "pact_broker",
			"group": "mixed",
			"kind": "hire",
			"text": "Need another sword? Pay me now and I will fight beside you. Or take a chance on the guard offering to lead you for free.",
			"options": [
				{
					"id": "e05_0",
					"effect": "venture",
					"label": "Hire the guard for 2,000 shared gold",
					"outcomes": [
						{
							"weight": 1,
							"text": "I will watch your back.",
							"join": true
						}
					],
					"cost": 2000,
					"offer": true
				},
				{
					"id": "e05_1",
					"effect": "venture",
					"label": "Let the guard lead. No money up front.",
					"outcomes": [
						{
							"weight": 1,
							"text": "A deal is a deal. Follow me.",
							"join": true
						},
						{
							"weight": 1,
							"text": "The guard whistles. His friends step out.",
							"fight": [
								"cave_guard",
								3
							]
						}
					]
				},
				{
					"id": "e05_2",
					"effect": "venture",
					"label": "Fight the guard for the contract chest.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Then come and earn it.",
							"fight": [
								"cave_npc",
								1
							]
						}
					]
				},
				{
					"id": "e05_3",
					"effect": "venture",
					"label": "Take a route with fewer guards.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep this pass where they can see it.",
							"flags": [
								"truce"
							]
						}
					]
				},
				{
					"id": "e05_4",
					"effect": "venture",
					"label": "Buy a spare lamp for 1 Amber.",
					"outcomes": [
						{
							"weight": 1,
							"text": "You will want this below.",
							"flags": [
								"lamp"
							]
						}
					],
					"amber": 1
				},
				{
					"id": "e05_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e06",
			"name": "The Trapped Surveyor",
			"actor": "cave_cartographer",
			"group": "mixed",
			"kind": "rescue",
			"text": "Wolves have cornered {npc}. “Help me! Kill these wolves and I will share what is in my pack.” You could also wait and search the pack if the wolves kill them.",
			"options": [
				{
					"id": "save",
					"label": "Save {npc}: fight the wolves",
					"effect": "save",
					"offer": true
				},
				{
					"id": "watch",
					"label": "Wait; loot the pack if {npc} dies",
					"effect": "watch"
				},
				{
					"id": "lure",
					"label": "Draw the wolves away from {npc}",
					"effect": "lure",
					"offer": true
				},
				{
					"id": "aid",
					"label": "Save and hire {npc} for 2,000 shared gold",
					"effect": "hire",
					"cost": 2000
				},
				{
					"id": "finish",
					"label": "Attack {npc} and the wolves",
					"effect": "both"
				},
				{
					"id": "cover",
					"label": "Bring {npc} behind us; take a smaller reward",
					"effect": "cover"
				}
			]
		},
		{
			"id": "e07",
			"name": "Borrow a Uniform",
			"actor": "expedition_captain",
			"group": "mixed",
			"kind": "disguise",
			"text": "I took these coats from the guards. A coat will get you past one guardroom. The captain may notice if you take his.",
			"options": [
				{
					"id": "e07_0",
					"effect": "venture",
					"label": "Pay 2 Amber for a guard’s coat. Skip the next guardroom.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep the hood up.",
							"flags": [
								"truce"
							]
						}
					],
					"amber": 2,
					"offer": true
				},
				{
					"id": "e07_1",
					"effect": "venture",
					"label": "Steal the captain’s coat; he may catch us",
					"outcomes": [
						{
							"weight": 1,
							"text": "The captain has not noticed. Yet.",
							"flags": [
								"truce"
							],
							"gold": 2000
						},
						{
							"weight": 1,
							"text": "That coat has a bell sewn into it.",
							"fight": [
								"cave_guard",
								3
							]
						}
					]
				},
				{
					"id": "e07_2",
					"effect": "venture",
					"label": "Challenge the captain for the coat.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The captain draws both blades.",
							"fight": [
								"cave_rogue",
								1
							]
						}
					]
				},
				{
					"id": "e07_3",
					"effect": "venture",
					"label": "Take a discarded lamp from the locker.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The oil is still good.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e07_4",
					"effect": "venture",
					"label": "Search the pockets for supplies",
					"outcomes": [
						{
							"weight": 1,
							"text": "You find a bundle of supplies in the lining.",
							"reward": "cave_parcel"
						}
					]
				},
				{
					"id": "e07_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e08",
			"name": "Pick a Fighter",
			"actor": "monster_handler",
			"group": "mixed",
			"kind": "arena",
			"text": "Pick a pen and fight what is inside. Win and you get something from my supply box. There are crabs, bats, wolves—and one very large Lockbreaker.",
			"options": [
				{
					"id": "e08_0",
					"effect": "venture",
					"label": "Choose three crabs. Slow, but armored.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The crab pen opens.",
							"fight": [
								"cave_crab",
								3
							]
						}
					],
					"offer": true
				},
				{
					"id": "e08_1",
					"effect": "venture",
					"label": "Fight six bats",
					"outcomes": [
						{
							"weight": 1,
							"text": "The bats spread around the room.",
							"fight": [
								"cave_bat",
								6
							]
						}
					]
				},
				{
					"id": "e08_2",
					"effect": "venture",
					"label": "Choose the wolf pair. They move together.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Two wolves circle the party.",
							"fight": [
								"cave_wolf",
								2
							]
						}
					]
				},
				{
					"id": "e08_3",
					"effect": "venture",
					"label": "Choose the Lockbreaker. One large opponent.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The Lockbreaker steps into the ring.",
							"fight": [
								"cave_lockbreaker",
								1
							]
						}
					]
				},
				{
					"id": "e08_4",
					"effect": "venture",
					"label": "Let the handler choose your opponent.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The handler calls the fight off. Take the purse.",
							"reward": "cave_parcel",
							"gold": 3000
						},
						{
							"weight": 1,
							"text": "The handler opens two pens.",
							"fight": [
								"cave_wolf",
								4
							]
						}
					]
				},
				{
					"id": "e08_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e09",
			"name": "Finish the Golem",
			"actor": "inventor",
			"group": "mixed",
			"kind": "construct",
			"text": "This golem has not moved in years. A proper repair costs 4 Amber. That loose stone might also wake it, but I cannot promise it will like us.",
			"options": [
				{
					"id": "e09_0",
					"effect": "venture",
					"label": "Use 4 Amber to repair its chest.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The golem stands beside you.",
							"ally": "cave_sentinel"
						}
					],
					"amber": 4,
					"offer": true
				},
				{
					"id": "e09_1",
					"effect": "venture",
					"label": "Fit the loose power stone.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The golem follows your voice.",
							"ally": "cave_sentinel"
						},
						{
							"weight": 1,
							"text": "The golem mistakes you for intruders.",
							"fight": [
								"cave_sentinel",
								1
							]
						}
					]
				},
				{
					"id": "e09_2",
					"effect": "venture",
					"label": "Remove the stone while it is awake.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The golem closes its fist around the stone.",
							"fight": [
								"cave_sentinel",
								1
							]
						}
					]
				},
				{
					"id": "e09_3",
					"effect": "venture",
					"label": "Sell the broken plates for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The mechanic buys the plates and pays 2 Amber.",
							"amber": 2
						}
					]
				},
				{
					"id": "e09_4",
					"label": "Spend 20 seconds opening its storage hatch.",
					"effect": "careful",
					"result": "We will check it for 20 seconds, then collect the supplies."
				},
				{
					"id": "e09_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e10",
			"name": "The Handler and the Wolves",
			"actor": "monster_handler",
			"group": "mixed",
			"kind": "wolves",
			"text": "The red chain opens the big pen. There are six level 100 wolves inside. Try the smaller pen if you want a fight you might survive.",
			"options": [
				{
					"id": "e10_0",
					"label": "Pull the red chain: six level 100 wolves.",
					"effect": "wolves",
					"offer": true
				},
				{
					"id": "e10_1",
					"effect": "venture",
					"label": "Open the small pen instead.",
					"outcomes": [
						{
							"weight": 1,
							"text": "These wolves are younger. Still hungry.",
							"fight": [
								"cave_wolf",
								2
							]
						}
					]
				},
				{
					"id": "e10_2",
					"effect": "venture",
					"label": "Buy a tin rattle for 2 shared Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "Throw it between the guards.",
							"flags": [
								"decoy"
							]
						}
					],
					"amber": 2
				},
				{
					"id": "e10_3",
					"effect": "venture",
					"label": "Reach for the handler’s purse.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The handler was asleep.",
							"reward": "cave_parcel"
						},
						{
							"weight": 1,
							"text": "The handler was pretending.",
							"fight": [
								"cave_wolf",
								4
							]
						}
					]
				},
				{
					"id": "e10_4",
					"effect": "venture",
					"label": "Pay 2,000 cave gold for the locked crate.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep your fingers away from the red chain.",
							"reward": "cave_parcel"
						}
					],
					"cost": 2000
				},
				{
					"id": "e10_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e11",
			"name": "Two People Claim the Chest",
			"actor": "duelist",
			"group": "mixed",
			"kind": "conflict",
			"text": "{npc} carried the chest here. {rival} has its key. Both want to keep it, and neither will back down. You can help one, fight both, or let them settle it.",
			"options": [
				{
					"id": "left",
					"label": "Help {npc} fight {rival}",
					"effect": "left",
					"offer": true
				},
				{
					"id": "right",
					"label": "Help {rival} fight {npc}",
					"effect": "right",
					"offer": true
				},
				{
					"id": "neither",
					"label": "Let them fight; collect what is left",
					"effect": "neither"
				},
				{
					"id": "both",
					"label": "Fight both and take the chest",
					"effect": "both"
				},
				{
					"id": "peace",
					"label": "Pay 3,000 shared gold to stop the fight",
					"effect": "peace",
					"cost": 3000
				},
				{
					"id": "testimony",
					"label": "Help whichever fighter hits harder",
					"effect": "testimony"
				}
			]
		},
		{
			"id": "e12",
			"name": "The Bell Ropes",
			"actor": "bell_keeper",
			"group": "mixed",
			"kind": "bell",
			"text": "These ropes ring the guard bells. The short one calls three guards. The long one calls their keeper. The red one opens the wolf pen.",
			"options": [
				{
					"id": "e12_0",
					"effect": "venture",
					"label": "Pull the short rope. Wake three guards.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Three guards answer the bell.",
							"fight": [
								"cave_guard",
								3
							]
						}
					],
					"offer": true
				},
				{
					"id": "e12_1",
					"effect": "venture",
					"label": "Pull the long rope. Wake the keeper.",
					"outcomes": [
						{
							"weight": 1,
							"text": "A deeper bell answers.",
							"fight": [
								"cave_mothkeeper",
								1
							]
						}
					]
				},
				{
					"id": "e12_2",
					"label": "Cut the red rope: level 100 wolves.",
					"effect": "wolves"
				},
				{
					"id": "e12_3",
					"effect": "venture",
					"label": "Take the loose bell as a decoy.",
					"outcomes": [
						{
							"weight": 1,
							"text": "It will draw a guard away from the next fight.",
							"flags": [
								"decoy"
							]
						}
					]
				},
				{
					"id": "e12_4",
					"label": "Use a pry bar to open the bell’s base.",
					"effect": "use_tool",
					"needs": "tool"
				},
				{
					"id": "e12_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e13",
			"name": "The Strong Magnet",
			"actor": "inventor",
			"group": "mixed",
			"kind": "magnet",
			"text": "The magnet pulls loose metal out of the walls. Turn it too high and it may pull the armored sentinel over here too.",
			"options": [
				{
					"id": "e13_0",
					"effect": "venture",
					"label": "Turn the magnet all the way up.",
					"outcomes": [
						{
							"weight": 1,
							"text": "A locked case tears free of the ceiling.",
							"reward": "cave_boss"
						},
						{
							"weight": 1,
							"text": "The magnet pulls an armored sentinel toward you.",
							"fight": [
								"cave_sentinel",
								1
							]
						}
					],
					"offer": true
				},
				{
					"id": "e13_1",
					"effect": "venture",
					"label": "Sell the loose metal for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The operator buys the metal and pays 2 Amber.",
							"amber": 2
						}
					]
				},
				{
					"id": "e13_2",
					"effect": "venture",
					"label": "Pull the sentinel’s shield toward the party.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The sentinel comes with its shield.",
							"fight": [
								"cave_sentinel",
								1
							]
						}
					]
				},
				{
					"id": "e13_3",
					"effect": "venture",
					"label": "Pay 2 Amber to use the small magnet.",
					"outcomes": [
						{
							"weight": 1,
							"text": "A little box slides out of the wall.",
							"reward": "cave_parcel"
						}
					],
					"amber": 2
				},
				{
					"id": "e13_4",
					"effect": "venture",
					"label": "Take the magnetic latch to open stuck hatches",
					"outcomes": [
						{
							"weight": 1,
							"text": "It grips the next locked hatch.",
							"flags": [
								"tool"
							]
						}
					]
				},
				{
					"id": "e13_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e14",
			"name": "Two Couriers, One Badge",
			"actor": "expedition_captain",
			"group": "mixed",
			"kind": "conflict",
			"text": "{npc} and {rival} both claim this delivery. Each says the other stole it. They are about to fight over the crate.",
			"options": [
				{
					"id": "left",
					"label": "Help {npc} fight {rival}",
					"effect": "left",
					"offer": true
				},
				{
					"id": "right",
					"label": "Help {rival} fight {npc}",
					"effect": "right",
					"offer": true
				},
				{
					"id": "neither",
					"label": "Let them fight; collect what is left",
					"effect": "neither"
				},
				{
					"id": "both",
					"label": "Fight both and take the chest",
					"effect": "both"
				},
				{
					"id": "peace",
					"label": "Pay 3,000 shared gold to stop the fight",
					"effect": "peace",
					"cost": 3000
				},
				{
					"id": "testimony",
					"label": "Help whichever fighter hits harder",
					"effect": "testimony"
				}
			]
		},
		{
			"id": "e15",
			"name": "Letter to the Captain",
			"actor": "prisoner",
			"group": "mixed",
			"kind": "letter",
			"text": "I need this letter delivered to the captain. He may pay you for it. He may also blame you for what it says. Your choice.",
			"options": [
				{
					"id": "e15_0",
					"effect": "venture",
					"label": "Deliver the letter; the captain may blame us",
					"outcomes": [
						{
							"weight": 1,
							"text": "The captain pays for the message.",
							"reward": "cave_rescue",
							"gold": 3000
						},
						{
							"weight": 1,
							"text": "The letter names you as the thief.",
							"fight": [
								"cave_npc",
								2
							]
						}
					],
					"offer": true
				},
				{
					"id": "e15_1",
					"effect": "venture",
					"label": "Open the letter in front of the captain.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The captain reaches for his sword.",
							"fight": [
								"cave_npc",
								1
							]
						}
					]
				},
				{
					"id": "e15_2",
					"effect": "venture",
					"label": "Hire the messenger for 2,000 shared gold",
					"outcomes": [
						{
							"weight": 1,
							"text": "The messenger joins your party as a helper.",
							"join": true
						}
					],
					"cost": 2000
				},
				{
					"id": "e15_3",
					"effect": "venture",
					"label": "Take the messenger’s spare lamp",
					"outcomes": [
						{
							"weight": 1,
							"text": "She has already lit another.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e15_4",
					"label": "Read the letter for 20 seconds, then collect the supplies",
					"effect": "careful",
					"result": "We will check it for 20 seconds, then collect the supplies."
				},
				{
					"id": "e15_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e16",
			"name": "Trade the Crates",
			"actor": "monster_handler",
			"group": "mixed",
			"kind": "trade",
			"text": "Two crates were left on my cart. You can take the sealed one, pay to open both, or help me with the guards watching the other one.",
			"options": [
				{
					"id": "e16_0",
					"effect": "venture",
					"label": "Take the sealed crate; it may contain bats",
					"outcomes": [
						{
							"weight": 1,
							"text": "Their crate contains a parcel and 4,000 gold.",
							"reward": "cave_parcel",
							"gold": 4000
						},
						{
							"weight": 1,
							"text": "Their crate contains live bats.",
							"fight": [
								"cave_bat",
								6
							]
						}
					],
					"offer": true
				},
				{
					"id": "e16_1",
					"effect": "venture",
					"label": "Pay 3 Amber to open both crates.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The trader lets you choose a parcel.",
							"reward": "cave_parcel"
						}
					],
					"amber": 3
				},
				{
					"id": "e16_2",
					"effect": "venture",
					"label": "Take the guarded crate.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Two hired swords step in front of it.",
							"fight": [
								"cave_npc",
								2
							]
						}
					]
				},
				{
					"id": "e16_3",
					"effect": "venture",
					"label": "Sell the trader’s empty crates for 1,500 gold",
					"outcomes": [
						{
							"weight": 1,
							"text": "The trader needs the wood.",
							"gold": 1500
						}
					]
				},
				{
					"id": "e16_4",
					"effect": "venture",
					"label": "Take the loose hinges for a pry bar.",
					"outcomes": [
						{
							"weight": 1,
							"text": "They are still strong.",
							"flags": [
								"tool"
							]
						}
					]
				},
				{
					"id": "e16_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e17",
			"name": "The Copying Shadow",
			"actor": "pact_broker",
			"group": "mixed",
			"kind": "shadow",
			"text": "That dark patch copies the strongest fighter in your party. Step into it and you will have to fight the copy. There is a supply box behind it.",
			"options": [
				{
					"id": "e17_0",
					"effect": "venture",
					"label": "Step into the shadow. Fight a copy of your strongest fighter.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Your shadow steps away from your feet.",
							"shadow": true
						}
					],
					"offer": true
				},
				{
					"id": "e17_1",
					"effect": "venture",
					"label": "Throw a stone into the shadow.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The stone comes back wrapped in cloth.",
							"reward": "cave_parcel"
						},
						{
							"weight": 1,
							"text": "Something followed the stone back.",
							"fight": [
								"cave_bat",
								5
							]
						}
					]
				},
				{
					"id": "e17_2",
					"effect": "venture",
					"label": "Pay 2 Amber to keep the lamp burning.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The shadow retreats from the parcel.",
							"reward": "cave_parcel"
						}
					],
					"amber": 2
				},
				{
					"id": "e17_3",
					"effect": "venture",
					"label": "Borrow the watcher’s lamp.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep it close to the floor.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e17_4",
					"label": "Watch the shadow for 20 seconds.",
					"effect": "careful",
					"result": "We will check it for 20 seconds, then collect the supplies."
				},
				{
					"id": "e17_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e18",
			"name": "The Broken Lift",
			"actor": "inventor",
			"group": "mixed",
			"kind": "lift",
			"text": "The lift is stuck with a supply cage below us. Turn the wheel or pry open the service hatch. Something is moving down there.",
			"options": [
				{
					"id": "e18_0",
					"effect": "venture",
					"label": "Turn the lift wheel hard.",
					"outcomes": [
						{
							"weight": 1,
							"text": "A supply cage rises into reach.",
							"reward": "cave_rescue"
						},
						{
							"weight": 1,
							"text": "The cage is full of rats.",
							"fight": [
								"cave_rat",
								8
							]
						}
					],
					"offer": true
				},
				{
					"id": "e18_1",
					"effect": "venture",
					"label": "Hire the lift guard for 2,000 cave gold.",
					"outcomes": [
						{
							"weight": 1,
							"text": "I am done guarding a broken lift.",
							"join": true
						}
					],
					"cost": 2000
				},
				{
					"id": "e18_2",
					"label": "Pry open the service hatch.",
					"effect": "use_tool",
					"needs": "tool"
				},
				{
					"id": "e18_3",
					"effect": "venture",
					"label": "Sell the loose cable for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The lift keeper buys the cable and pays 2 Amber.",
							"amber": 2
						}
					]
				},
				{
					"id": "e18_4",
					"effect": "venture",
					"label": "Call down to the lower landing.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Two wolves answer from below.",
							"fight": [
								"cave_wolf",
								2
							]
						}
					]
				},
				{
					"id": "e18_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e19",
			"name": "The Farmer’s Guess",
			"actor": "fungus_farmer",
			"group": "mixed",
			"kind": "mushroom",
			"text": "I grow mushrooms to sell for Amber. The plain patch is safe. The spotted patch pays more, but picking it may wake the bats.",
			"options": [
				{
					"id": "e19_0",
					"effect": "venture",
					"label": "Pick the spotted patch; it may wake bats",
					"outcomes": [
						{
							"weight": 1,
							"text": "The farmer buys the whole basket.",
							"reward": "cave_parcel",
							"gold": 3000
						},
						{
							"weight": 1,
							"text": "The picking wakes the bats above you.",
							"fight": [
								"cave_bat",
								6
							]
						}
					],
					"offer": true
				},
				{
					"id": "e19_1",
					"effect": "venture",
					"label": "Pick the plain patch for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The farmer marks the safe patch.",
							"amber": 2
						}
					]
				},
				{
					"id": "e19_2",
					"label": "Plant a crop. Return after one minute for 3 Amber.",
					"effect": "plant"
				},
				{
					"id": "e19_3",
					"effect": "venture",
					"label": "Borrow the farmer’s empty seed tin.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The rats like these mushrooms.",
							"flags": [
								"decoy"
							]
						}
					]
				},
				{
					"id": "e19_4",
					"effect": "venture",
					"label": "Clear the farmer’s rat pen.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The farmer opens the pen.",
							"fight": [
								"cave_rat",
								6
							]
						}
					]
				},
				{
					"id": "e19_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e20",
			"name": "The Cornered Rogue",
			"actor": "prisoner",
			"group": "mixed",
			"kind": "rogue",
			"text": "Wolves are attacking a rogue with two daggers. You can save him or wait and loot his body if he dies. He keeps watching your backs, even while he fights.",
			"options": [
				{
					"id": "save",
					"label": "Save {npc}: fight the wolves",
					"effect": "save",
					"offer": true
				},
				{
					"id": "watch",
					"label": "Wait; loot the pack if {npc} dies",
					"effect": "watch"
				},
				{
					"id": "lure",
					"label": "Draw the wolves away from {npc}",
					"effect": "lure",
					"offer": true
				},
				{
					"id": "aid",
					"label": "Save and hire {npc} for 2,000 shared gold",
					"effect": "hire",
					"cost": 2000
				},
				{
					"id": "finish",
					"label": "Attack {npc} and the wolves",
					"effect": "both"
				},
				{
					"id": "cover",
					"label": "Bring {npc} behind us; take a smaller reward",
					"effect": "cover"
				}
			]
		},
		{
			"id": "e21",
			"name": "Change the Map",
			"actor": "cave_cartographer",
			"group": "mixed",
			"kind": "route",
			"text": "I sell guard passes and mark supply rooms on maps. I also know a shortcut, but three guards are using it right now.",
			"options": [
				{
					"id": "e21_0",
					"effect": "venture",
					"label": "Buy a pass for 3 shared Amber; skip one guardroom",
					"outcomes": [
						{
							"weight": 1,
							"text": "One use. Then tear it up.",
							"flags": [
								"truce"
							]
						}
					],
					"amber": 3,
					"offer": true
				},
				{
					"id": "e21_1",
					"effect": "venture",
					"label": "Take the guarded shortcut.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The shortcut ends at three guards.",
							"fight": [
								"cave_guard",
								3
							]
						}
					]
				},
				{
					"id": "e21_2",
					"effect": "venture",
					"label": "Trust the crossed-out route.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The old route still leads to a supply box.",
							"reward": "cave_parcel"
						},
						{
							"weight": 1,
							"text": "The old route belongs to wolves now.",
							"fight": [
								"cave_wolf",
								3
							]
						}
					]
				},
				{
					"id": "e21_3",
					"effect": "venture",
					"label": "Hire the mapmaker for 2,000 cave gold.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The mapmaker packs her things.",
							"join": true
						}
					],
					"cost": 2000
				},
				{
					"id": "e21_4",
					"effect": "venture",
					"label": "Take the spare lantern.",
					"outcomes": [
						{
							"weight": 1,
							"text": "Mark your way back.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e21_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e22",
			"name": "One More Turn",
			"actor": "inventor",
			"group": "mixed",
			"kind": "pressure",
			"text": "The chest is caught in this old machine. Turn the wheel to free it, or release the pressure slowly. The sentinel is sleeping beside the pipes.",
			"options": [
				{
					"id": "e22_0",
					"effect": "venture",
					"label": "Give the wheel one more turn.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The last latch opens.",
							"reward": "cave_boss"
						},
						{
							"weight": 1,
							"text": "The pressure wakes the sentinel.",
							"fight": [
								"cave_sentinel",
								1
							]
						}
					],
					"offer": true
				},
				{
					"id": "e22_1",
					"effect": "venture",
					"label": "Release all the pressure at once.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The keeper hears the pipe burst.",
							"fight": [
								"cave_lockbreaker",
								1
							]
						}
					]
				},
				{
					"id": "e22_2",
					"label": "Open the valve slowly: 20 seconds.",
					"effect": "careful",
					"result": "We will check it for 20 seconds, then collect the supplies."
				},
				{
					"id": "e22_3",
					"label": "Use a pry bar on the jammed latch.",
					"effect": "use_tool",
					"needs": "tool"
				},
				{
					"id": "e22_4",
					"effect": "venture",
					"label": "Sell the loose fittings for 2 Amber",
					"outcomes": [
						{
							"weight": 1,
							"text": "The mechanic buys the fittings and pays 2 Amber.",
							"amber": 2
						}
					]
				},
				{
					"id": "e22_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e23",
			"name": "Keep the Crate Cold",
			"actor": "expedition_captain",
			"group": "mixed",
			"kind": "escort",
			"text": "Help me get this crate to the stairs. I will pay 3,000 cave gold and share my supplies when we arrive. Or we can open it here.",
			"options": [
				{
					"id": "e23_0",
					"label": "Escort the porter to the stairs.",
					"effect": "escort",
					"offer": true
				},
				{
					"id": "e23_1",
					"effect": "venture",
					"label": "Open the crate before moving it.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The ice kept the parcel dry.",
							"reward": "cave_rescue"
						},
						{
							"weight": 1,
							"text": "The crate held sleeping crabs.",
							"fight": [
								"cave_crab",
								4
							]
						}
					]
				},
				{
					"id": "e23_2",
					"effect": "venture",
					"label": "Pay 2,000 cave gold to unload it here.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The porter breaks the ice around the parcel.",
							"reward": "cave_parcel"
						}
					],
					"cost": 2000
				},
				{
					"id": "e23_3",
					"effect": "guide",
					"label": "Ask the porter to fight beside us",
					"result": "The porter puts down the crate and joins you."
				},
				{
					"id": "e23_4",
					"effect": "venture",
					"label": "Take the spare lamp from the cart.",
					"outcomes": [
						{
							"weight": 1,
							"text": "The porter hands you the lamp.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e23_5",
					"label": "Leave this and keep going.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e24",
			"name": "The Same Prisoner Twice",
			"actor": "prisoner",
			"group": "mixed",
			"kind": "twins",
			"text": "{npc} and {rival} are dressed alike. Both claim to be the prisoner you came to find. They have drawn their weapons. Who will you help?",
			"options": [
				{
					"id": "left",
					"label": "Help {npc} fight {rival}",
					"effect": "left",
					"offer": true
				},
				{
					"id": "right",
					"label": "Help {rival} fight {npc}",
					"effect": "right",
					"offer": true
				},
				{
					"id": "neither",
					"label": "Let them fight; collect what is left",
					"effect": "neither"
				},
				{
					"id": "both",
					"label": "Fight both and take the chest",
					"effect": "both"
				},
				{
					"id": "peace",
					"label": "Pay 3,000 shared gold to stop the fight",
					"effect": "peace",
					"cost": 3000
				},
				{
					"id": "testimony",
					"label": "Help whichever fighter hits harder",
					"effect": "testimony"
				}
			]
		},
		{
			"id": "e25",
			"name": "The Prisoner and the Captain",
			"actor": "prisoner",
			"group": "mixed",
			"kind": "conflict",
			"text": "{rival} wants to put {npc} back in chains. The prisoner says the captain sold out the last patrol. They are about to fight.",
			"options": [
				{
					"id": "left",
					"label": "Help {npc} fight {rival}",
					"effect": "left",
					"offer": true
				},
				{
					"id": "right",
					"label": "Help {rival} fight {npc}",
					"effect": "right",
					"offer": true
				},
				{
					"id": "neither",
					"label": "Let them fight; collect what is left",
					"effect": "neither"
				},
				{
					"id": "both",
					"label": "Fight both and take the chest",
					"effect": "both"
				},
				{
					"id": "peace",
					"label": "Pay 3,000 shared gold to stop the fight",
					"effect": "peace",
					"cost": 3000
				},
				{
					"id": "testimony",
					"label": "Help whichever fighter hits harder",
					"effect": "testimony"
				}
			]
		},
		{
			"id": "e26",
			"name": "The Toll Patrol",
			"actor": "expedition_captain",
			"group": "bad",
			"kind": "collapse",
			"text": "Three guards step in front of you. Their captain holds out a hand. “Pay the toll. Or try getting past us.”",
			"options": [
				{
					"id": "e26_0",
					"label": "Pay the 3,000 gold toll",
					"effect": "pay",
					"cost": 3000,
					"offer": true,
					"result": "The guards take the payment and let you through."
				},
				{
					"id": "e26_1",
					"label": "Fight the three guards",
					"effect": "bad_fight",
					"offer": true,
					"result": "The three guards draw their swords."
				},
				{
					"id": "e26_2",
					"label": "Pay 2 shared Amber instead",
					"effect": "pay",
					"amber": 2,
					"result": "The guards accept the Amber and let you through."
				},
				{
					"id": "e26_3",
					"label": "Pay 1,000 gold and spend 30 seconds getting past",
					"effect": "time",
					"cost": 1000,
					"seconds": 30
				},
				{
					"id": "e26_4",
					"label": "Wait for a way past; lose 45 seconds",
					"effect": "time",
					"seconds": 45
				},
				{
					"id": "e26_5",
					"label": "Fight {npc} and six guards",
					"effect": "bad_double",
					"result": "{npc} calls in three more guards and joins the fight."
				}
			]
		},
		{
			"id": "e27",
			"name": "Stopped by a Guard",
			"actor": "collector",
			"group": "bad",
			"kind": "toll",
			"text": "This guard will not let you pass for free. Pay with cave gold or Amber, fight his men, or wait for the patrol to move.",
			"options": [
				{
					"id": "e27_0",
					"label": "Pay 3,000 shared gold to let us pass",
					"effect": "pay",
					"cost": 3000,
					"offer": true,
					"result": "The guards take the payment and let you through."
				},
				{
					"id": "e27_1",
					"label": "Fight the three guards",
					"effect": "bad_fight",
					"offer": true,
					"result": "The three guards draw their swords."
				},
				{
					"id": "e27_2",
					"label": "Pay 2 shared Amber instead",
					"effect": "pay",
					"amber": 2,
					"result": "The guards accept the Amber and let you through."
				},
				{
					"id": "e27_3",
					"label": "Pay 1,000 gold and spend 30 seconds getting past",
					"effect": "time",
					"cost": 1000,
					"seconds": 30
				},
				{
					"id": "e27_4",
					"label": "Wait for a way past; lose 45 seconds",
					"effect": "time",
					"seconds": 45
				},
				{
					"id": "e27_5",
					"label": "Fight {npc} and six guards",
					"effect": "bad_double",
					"result": "{npc} calls in three more guards and joins the fight."
				}
			]
		},
		{
			"id": "e28",
			"name": "The Rope Snaps",
			"actor": "bell_keeper",
			"group": "bad",
			"kind": "alarm",
			"text": "The alarm rope snapped. Guards are coming. The bell keeper can call them off for a fee, or you can deal with them yourself.",
			"options": [
				{
					"id": "e28_0",
					"label": "Pay 3,000 shared gold to stop the alarm",
					"effect": "pay",
					"cost": 3000,
					"offer": true,
					"result": "The guards take the payment and let you through."
				},
				{
					"id": "e28_1",
					"label": "Fight the three guards",
					"effect": "bad_fight",
					"offer": true,
					"result": "The three guards draw their swords."
				},
				{
					"id": "e28_2",
					"label": "Pay 2 shared Amber instead",
					"effect": "pay",
					"amber": 2,
					"result": "The guards accept the Amber and let you through."
				},
				{
					"id": "e28_3",
					"label": "Pay 1,000 gold and spend 30 seconds getting past",
					"effect": "time",
					"cost": 1000,
					"seconds": 30
				},
				{
					"id": "e28_4",
					"label": "Wait for a way past; lose 45 seconds",
					"effect": "time",
					"seconds": 45
				},
				{
					"id": "e28_5",
					"label": "Fight {npc} and six guards",
					"effect": "bad_double",
					"result": "{npc} calls in three more guards and joins the fight."
				}
			]
		},
		{
			"id": "e29",
			"name": "The Cargo Is Stuck",
			"actor": "expedition_captain",
			"group": "bad",
			"kind": "cargo",
			"text": "A loaded cart is stuck in the passage. Its guards want payment before they move it. You can pay, force your way past, or wait for them to unload.",
			"options": [
				{
					"id": "e29_0",
					"label": "Pay 3,000 shared gold to move the cart",
					"effect": "pay",
					"cost": 3000,
					"offer": true,
					"result": "The guards take the payment and let you through."
				},
				{
					"id": "e29_1",
					"label": "Fight the three guards",
					"effect": "bad_fight",
					"offer": true,
					"result": "The three guards draw their swords."
				},
				{
					"id": "e29_2",
					"label": "Pay 2 shared Amber instead",
					"effect": "pay",
					"amber": 2,
					"result": "The guards accept the Amber and let you through."
				},
				{
					"id": "e29_3",
					"label": "Pay 1,000 gold and spend 30 seconds getting past",
					"effect": "time",
					"cost": 1000,
					"seconds": 30
				},
				{
					"id": "e29_4",
					"label": "Wait for a way past; lose 45 seconds",
					"effect": "time",
					"seconds": 45
				},
				{
					"id": "e29_5",
					"label": "Fight {npc} and six guards",
					"effect": "bad_double",
					"result": "{npc} calls in three more guards and joins the fight."
				}
			]
		},
		{
			"id": "e30",
			"name": "The Wrong Receipt",
			"actor": "pact_broker",
			"group": "bad",
			"kind": "debt",
			"text": "The collector thinks you took a debtor’s receipt. Pay him to leave you alone, fight his guards, or wait while he checks the name.",
			"options": [
				{
					"id": "e30_0",
					"label": "Pay 3,000 shared gold to settle the debt",
					"effect": "pay",
					"cost": 3000,
					"offer": true,
					"result": "The guards take the payment and let you through."
				},
				{
					"id": "e30_1",
					"label": "Fight the three guards",
					"effect": "bad_fight",
					"offer": true,
					"result": "The three guards draw their swords."
				},
				{
					"id": "e30_2",
					"label": "Pay 2 shared Amber instead",
					"effect": "pay",
					"amber": 2,
					"result": "The guards accept the Amber and let you through."
				},
				{
					"id": "e30_3",
					"label": "Pay 1,000 gold and spend 30 seconds getting past",
					"effect": "time",
					"cost": 1000,
					"seconds": 30
				},
				{
					"id": "e30_4",
					"label": "Wait for a way past; lose 45 seconds",
					"effect": "time",
					"seconds": 45
				},
				{
					"id": "e30_5",
					"label": "Fight {npc} and six guards",
					"effect": "bad_double",
					"result": "{npc} calls in three more guards and joins the fight."
				}
			]
		},
		{
			"id": "e31",
			"name": "The Shop with One Item",
			"actor": "archive_vendor",
			"group": "positive",
			"kind": "merchant",
			"text": "I have one item for sale. Have a look. Pay with the party’s cave gold. A random member of your original party gets the item.",
			"options": [
				{
					"id": "e31_0",
					"label": "Open the shop",
					"effect": "inspect",
					"offer": true,
					"result": "The shop is open. Inspect the item, then pay with cave gold if you want it."
				},
				{
					"id": "e31_1",
					"label": "Keep our gold and move on.",
					"effect": "leave"
				},
				{
					"id": "e31_2",
					"label": "Ask where the item came from",
					"effect": "story",
					"result": "I bought it when the old shop cleared its shelves. This is the last one I have."
				},
				{
					"id": "e31_3",
					"label": "Check the price and the item",
					"effect": "inspect",
					"result": "There is one copy at the price shown. No bidding and no second sale."
				},
				{
					"id": "e31_4",
					"label": "We do not need it.",
					"effect": "leave"
				},
				{
					"id": "e31_5",
					"label": "Leave it for another day.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e32",
			"name": "Clear the Crab Pens",
			"actor": "monster_handler",
			"group": "positive",
			"kind": "hunt",
			"text": "These crabs keep breaking out of their pens. Pick a hunt. Kill all the marked crabs before time runs out and I will pay you.",
			"options": [
				{
					"id": "e32_0",
					"label": "Kill 6 crabs in 90s for supplies, 5,000 gold and 2 Amber",
					"effect": "hunt",
					"offer": true
				},
				{
					"id": "e32_1",
					"label": "Kill 12 crabs in 90s for twice the supplies",
					"effect": "hunt_double",
					"offer": true
				},
				{
					"id": "e32_2",
					"label": "Kill 3 crabs in 90s for 2 Amber",
					"effect": "hunt_quick",
					"offer": true
				},
				{
					"id": "e32_3",
					"label": "Take a helper: 6 crabs in 90s",
					"effect": "hunt_helper"
				},
				{
					"id": "e32_4",
					"label": "Take 120s to kill 6 crabs; earn 2 Amber",
					"effect": "hunt_late"
				},
				{
					"id": "e32_5",
					"label": "Skip this hunt.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e33",
			"name": "Catch the Bats",
			"actor": "bell_keeper",
			"group": "positive",
			"kind": "hunt_bats",
			"text": "The bats stole my keys again. Pick a hunt. Kill all the marked bats before time runs out and I will give you a reward.",
			"options": [
				{
					"id": "e33_0",
					"label": "Kill 8 bats in 75s for supplies, 5,000 gold and 2 Amber",
					"effect": "hunt",
					"offer": true
				},
				{
					"id": "e33_1",
					"label": "Kill 16 bats in 75s for twice the supplies",
					"effect": "hunt_double",
					"offer": true
				},
				{
					"id": "e33_2",
					"label": "Kill 4 bats in 75s for 2 Amber",
					"effect": "hunt_quick",
					"offer": true
				},
				{
					"id": "e33_3",
					"label": "Take a helper: 8 bats in 75s",
					"effect": "hunt_helper"
				},
				{
					"id": "e33_4",
					"label": "Take 105s to kill 8 bats; earn 2 Amber",
					"effect": "hunt_late"
				},
				{
					"id": "e33_5",
					"label": "Skip this hunt.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e34",
			"name": "Rats with Silver Teeth",
			"actor": "collector",
			"group": "positive",
			"kind": "hunt_rats",
			"text": "The rats are chewing through my stock. Pick a hunt. Kill all the marked rats before time runs out and I will pay you.",
			"options": [
				{
					"id": "e34_0",
					"label": "Kill 10 rats in 60s for supplies, 5,000 gold and 2 Amber",
					"effect": "hunt",
					"offer": true
				},
				{
					"id": "e34_1",
					"label": "Kill 20 rats in 60s for twice the supplies",
					"effect": "hunt_double",
					"offer": true
				},
				{
					"id": "e34_2",
					"label": "Kill 5 rats in 60s for 2 Amber",
					"effect": "hunt_quick",
					"offer": true
				},
				{
					"id": "e34_3",
					"label": "Take a helper: 10 rats in 60s",
					"effect": "hunt_helper"
				},
				{
					"id": "e34_4",
					"label": "Take 90s to kill 10 rats; earn 2 Amber",
					"effect": "hunt_late"
				},
				{
					"id": "e34_5",
					"label": "Skip this hunt.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e35",
			"name": "Move the Caravan",
			"actor": "expedition_captain",
			"group": "positive",
			"kind": "escort_safe",
			"text": "I lost the rest of my caravan. Walk me to the stairs and I will pay 3,000 cave gold and share my supplies. I can carry a weapon if you need help.",
			"options": [
				{
					"id": "e35_0",
					"label": "Walk {npc} to the stairs for a reward",
					"effect": "escort",
					"offer": true
				},
				{
					"id": "e35_1",
					"label": "Ask {npc} to join us as a fighter",
					"effect": "guide",
					"result": "{npc} draws a weapon and joins you."
				},
				{
					"id": "e35_2",
					"label": "Borrow a lamp for the walk",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep the lamp. It may help with the moths.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e35_3",
					"label": "Ask for a pry bar for the locked hatches",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Here. This one still has a good edge.",
							"flags": [
								"tool"
							]
						}
					]
				},
				{
					"id": "e35_4",
					"label": "Take 1 Amber instead of escorting",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "I can spare this much. Good luck.",
							"amber": 1
						}
					]
				},
				{
					"id": "e35_5",
					"label": "Sorry. We cannot take you with us.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e36",
			"name": "Craft with Cave Amber",
			"actor": "collector",
			"group": "positive",
			"kind": "recipes",
			"text": "Cole can turn Cave Amber into equipment. I have his recipes and a few spare materials. What would help you?",
			"options": [
				{
					"id": "e36_0",
					"label": "Show Cole’s recipes",
					"effect": "recipes",
					"offer": true,
					"result": "Take your Amber to Cole in Mainland. These are the things he can make."
				},
				{
					"id": "e36_1",
					"label": "Take a sample: 1 Amber",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Show this to Cole when you get back.",
							"amber": 1
						}
					]
				},
				{
					"id": "e36_2",
					"label": "Borrow a pry bar to find more supplies",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Use it on a locked hatch.",
							"flags": [
								"tool"
							]
						}
					]
				},
				{
					"id": "e36_3",
					"label": "Borrow the spare lamp",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The moths gather around its light.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e36_4",
					"label": "Ask the smith’s helper to join us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The smith’s helper comes with you.",
							"ally": "cave_npc"
						}
					]
				},
				{
					"id": "e36_5",
					"label": "We will visit Cole later.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e37",
			"name": "Try the Dice",
			"actor": "dice_operator",
			"group": "positive",
			"kind": "practice_dice",
			"text": "Want a free roll? Roll a six to win a chest with 1 Amber for the party. No bet this time.",
			"options": [
				{
					"id": "e37_0",
					"label": "Roll for free; a six wins 1 Amber",
					"effect": "free_die",
					"offer": true
				},
				{
					"id": "e37_1",
					"label": "Ask how the Loaded Die works",
					"effect": "story",
					"result": "Wear a Loaded Die in your orb slot. If a roll misses, it gives the party one reroll per visit."
				},
				{
					"id": "e37_2",
					"label": "Ask the dealer to roll for us",
					"effect": "free_die"
				},
				{
					"id": "e37_3",
					"label": "Ask the dealer to come along instead",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "I am tired of sitting here. Let us go.",
							"join": true
						}
					]
				},
				{
					"id": "e37_4",
					"label": "Save the game for later.",
					"effect": "leave"
				},
				{
					"id": "e37_5",
					"label": "No thanks. We do not want to roll.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e38",
			"name": "Borrow a Tool",
			"actor": "cave_cartographer",
			"group": "positive",
			"kind": "tool",
			"text": "Take something from my tool bag. A pry bar opens locked hatches. A lamp helps with the moths. I also have a noisy decoy to draw a patrol away.",
			"options": [
				{
					"id": "e38_0",
					"label": "Take a pry bar for locked hatches",
					"effect": "tool",
					"offer": true,
					"result": "You take the pry bar. It stays in your cave supplies."
				},
				{
					"id": "e38_1",
					"label": "Take a lamp for the moths",
					"effect": "lamp",
					"offer": true,
					"result": "You take the lamp. It stays in your cave supplies."
				},
				{
					"id": "e38_2",
					"label": "Take the tin rattle",
					"effect": "decoy",
					"result": "You pack the rattle. It will draw the next patrol away for eight seconds."
				},
				{
					"id": "e38_3",
					"label": "Ask the toolmaker to come with us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "I will bring my tools and watch your back.",
							"join": true
						}
					]
				},
				{
					"id": "e38_4",
					"label": "Trade the scrap for 1 Amber",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The toolmaker gives you 1 Amber for the scrap.",
							"amber": 1
						}
					]
				},
				{
					"id": "e38_5",
					"label": "We have what we need.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e39",
			"name": "The Amber Garden",
			"actor": "fungus_farmer",
			"group": "positive",
			"kind": "plant",
			"text": "These seeds grow Amber in a minute. Plant some, then return here and open the chest for 3 Amber. You can explore while they grow.",
			"options": [
				{
					"id": "e39_0",
					"label": "Plant a crop; collect 3 Amber after one minute",
					"effect": "plant",
					"offer": true,
					"result": "The seeds are planted. Come back here in a minute and open the chest to collect your Amber."
				},
				{
					"id": "e39_1",
					"label": "Take 1 Amber now instead",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Here is one from the last crop.",
							"amber": 1
						}
					]
				},
				{
					"id": "e39_2",
					"label": "Take the farmer’s spare rattle",
					"effect": "decoy",
					"result": "The rattle will draw the next patrol away for eight seconds."
				},
				{
					"id": "e39_3",
					"label": "Ask the farmhand to join us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The farmhand leaves the garden and comes with you.",
							"ally": "cave_npc"
						}
					]
				},
				{
					"id": "e39_4",
					"label": "Borrow the farmer’s spare lamp",
					"effect": "lamp",
					"result": "Take it. I have another by the seed beds."
				},
				{
					"id": "e39_5",
					"label": "Leave the seeds with the farmer.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e40",
			"name": "Practice with Wooden Swords",
			"actor": "duelist",
			"group": "positive",
			"kind": "practice",
			"text": "Want to spar? Beat me before the timer ends and you win a prize. I will stop at 1 HP, and my blows cannot kill you.",
			"options": [
				{
					"id": "e40_0",
					"label": "Try the 30-second fight for a supply prize",
					"effect": "practice",
					"offer": true
				},
				{
					"id": "e40_1",
					"label": "Try an easier fight for 1 Amber",
					"effect": "practice",
					"offer": true,
					"guard": 0.5,
					"reward_amber": 1
				},
				{
					"id": "e40_2",
					"label": "Win within 15 seconds for a supply prize",
					"effect": "practice",
					"offer": true,
					"seconds": 15
				},
				{
					"id": "e40_3",
					"label": "Ask {npc} to fight beside us instead",
					"effect": "guide",
					"result": "{npc}: A real fight sounds better. I will come with you."
				},
				{
					"id": "e40_4",
					"label": "Take a 20-second lesson and the trainer’s supplies",
					"effect": "careful",
					"result": "Watch my feet. I will give you the spare supplies when we finish."
				},
				{
					"id": "e40_5",
					"label": "No thanks. We do not want to spar.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e41",
			"name": "Trade Materials",
			"actor": "collector",
			"group": "positive",
			"kind": "exchange",
			"text": "I will trade my supply box for 2 Amber from the shared purse. Or take one of these smaller things for the road.",
			"options": [
				{
					"id": "e41_0",
					"label": "Trade 2 shared Amber for the supply box",
					"effect": "exchange",
					"offer": true,
					"amber": 2,
					"result": "The trader takes the Amber and opens the box."
				},
				{
					"id": "e41_1",
					"label": "Borrow a pry bar instead",
					"effect": "tool",
					"result": "Take the spare pry bar. No charge."
				},
				{
					"id": "e41_2",
					"label": "Take the trader’s spare lamp",
					"effect": "lamp",
					"result": "The lamp still has oil. Take it."
				},
				{
					"id": "e41_3",
					"label": "Take a tin rattle for the road",
					"effect": "decoy",
					"result": "The rattle will draw the next patrol away for eight seconds."
				},
				{
					"id": "e41_4",
					"label": "Ask the trader’s guard to join us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The guard agrees to come with you.",
							"ally": "cave_npc"
						}
					]
				},
				{
					"id": "e41_5",
					"label": "Keep our Amber.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e42",
			"name": "The Rat’s Shortcuts",
			"actor": "monster_handler",
			"group": "positive",
			"kind": "ratdoor",
			"text": "My rat keeps finding rooms the guards missed. I can mark them on your map, or let the rat follow you.",
			"options": [
				{
					"id": "e42_0",
					"label": "Mark the rooms the rat found",
					"effect": "reveal",
					"offer": true
				},
				{
					"id": "e42_1",
					"label": "Let the rat follow us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The rat follows you out of the room.",
							"ally": "cave_rat"
						}
					]
				},
				{
					"id": "e42_2",
					"label": "Borrow a lamp to check the wall",
					"effect": "lamp",
					"result": "Here. You can keep the lamp for this visit."
				},
				{
					"id": "e42_3",
					"label": "Take the pry bar by the rat’s hole",
					"effect": "tool",
					"result": "You take the pry bar from beside the wall."
				},
				{
					"id": "e42_4",
					"label": "Take the Amber the rat brought back",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The rat found 1 Amber. Open the chest to collect it.",
							"amber": 1
						}
					]
				},
				{
					"id": "e42_5",
					"label": "Leave the rat with its keeper.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e43",
			"name": "Call a Guard Away",
			"actor": "expedition_captain",
			"group": "positive",
			"kind": "decoy",
			"text": "“I used to lead those guards. Some would still listen to me. I can help you get past their camp, or come along myself.”",
			"options": [
				{
					"id": "e43_0",
					"label": "Take a message for a guard",
					"effect": "decoy",
					"offer": true,
					"result": "Take this to the next guard camp. One guard will stand down. If you have room for another helper, they will join you."
				},
				{
					"id": "e43_1",
					"label": "Ask {npc} to fight beside us",
					"effect": "guide",
					"result": "{npc}: All right. I will come with you."
				},
				{
					"id": "e43_2",
					"label": "Ask where the other travelers are",
					"travelers": true,
					"effect": "reveal"
				},
				{
					"id": "e43_3",
					"label": "Borrow {npc}’s spare lamp",
					"effect": "lamp",
					"result": "{npc} hands you a lamp."
				},
				{
					"id": "e43_4",
					"label": "Borrow {npc}’s pry bar",
					"effect": "tool",
					"result": "You take the pry bar."
				},
				{
					"id": "e43_5",
					"label": "We will deal with the guards ourselves.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e44",
			"name": "Find the Rogue",
			"actor": "archive_vendor",
			"group": "positive",
			"kind": "appraise",
			"text": "Looking for the rogue? I can mark where I saw him. Check both daggers before you decide whether to help him.",
			"options": [
				{
					"id": "e44_0",
					"label": "Mark where the rogue was seen",
					"effect": "appraise",
					"offer": true
				},
				{
					"id": "e44_1",
					"label": "Explain how to spot the rare dagger",
					"effect": "story",
					"result": "The rare dagger is called Last Word. Look at the rogue’s equipped weapons. He only drops it if monsters kill him before he turns on you."
				},
				{
					"id": "e44_2",
					"label": "Ask {npc} to join us",
					"effect": "guide",
					"result": "{npc}: I will help, but keep an eye on that rogue."
				},
				{
					"id": "e44_3",
					"label": "Borrow a lamp to see the blades",
					"effect": "lamp",
					"result": "Take the spare lamp."
				},
				{
					"id": "e44_4",
					"label": "Take a sample of the local Amber",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The appraiser leaves 1 Amber in a chest for you.",
							"amber": 1
						}
					]
				},
				{
					"id": "e44_5",
					"label": "We will look for him ourselves.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e45",
			"name": "The Lost Traveler",
			"actor": "prisoner",
			"group": "positive",
			"kind": "escort_safe",
			"text": "I cannot find the stairs. Let me follow you there and I will pay 3,000 cave gold and share the supplies I have left.",
			"options": [
				{
					"id": "e45_0",
					"label": "Walk {npc} to the stairs for a reward",
					"effect": "escort",
					"offer": true
				},
				{
					"id": "e45_1",
					"label": "Ask {npc} to join us as a fighter",
					"effect": "guide",
					"result": "{npc} draws a weapon and joins you."
				},
				{
					"id": "e45_2",
					"label": "Borrow a lamp for the walk",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Keep the lamp. It may help with the moths.",
							"flags": [
								"lamp"
							]
						}
					]
				},
				{
					"id": "e45_3",
					"label": "Ask for a pry bar for the locked hatches",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Here. This one still has a good edge.",
							"flags": [
								"tool"
							]
						}
					]
				},
				{
					"id": "e45_4",
					"label": "Take 1 Amber instead of escorting",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "I can spare this much. Good luck.",
							"amber": 1
						}
					]
				},
				{
					"id": "e45_5",
					"label": "Sorry. We cannot take you with us.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e46",
			"name": "Is It Worth the Price?",
			"actor": "collector",
			"group": "positive",
			"kind": "merchant",
			"text": "This came from a shop that closed years ago. I have one copy. Pay with the party’s cave gold. A random member of your original party gets it.",
			"options": [
				{
					"id": "e46_0",
					"label": "Open the shop",
					"effect": "inspect",
					"offer": true,
					"result": "The shop is open. Inspect the item, then pay with cave gold if you want it."
				},
				{
					"id": "e46_1",
					"label": "Keep our gold and move on.",
					"effect": "leave"
				},
				{
					"id": "e46_2",
					"label": "Ask where the item came from",
					"effect": "story",
					"result": "I bought it when the old shop cleared its shelves. This is the last one I have."
				},
				{
					"id": "e46_3",
					"label": "Check the price and the item",
					"effect": "inspect",
					"result": "There is one copy at the price shown. No bidding and no second sale."
				},
				{
					"id": "e46_4",
					"label": "We do not need it.",
					"effect": "leave"
				},
				{
					"id": "e46_5",
					"label": "Leave it for another day.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e47",
			"name": "Follow the Thread",
			"actor": "fungus_farmer",
			"group": "positive",
			"kind": "moths",
			"text": "The moths gathered around a pair of boots in the wall. A steady lamp will draw them away. Without a lamp, I can only collect some Amber for you.",
			"options": [
				{
					"id": "e47_0",
					"label": "Use our lamp to uncover the boots",
					"effect": "moths",
					"offer": true
				},
				{
					"id": "e47_1",
					"label": "Take 2 Amber without disturbing the moths",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "I found these beside the nest.",
							"amber": 2
						}
					]
				},
				{
					"id": "e47_2",
					"label": "Borrow a lamp for another moth nest",
					"effect": "lamp",
					"result": "Take this lamp. Keep it steady when you find another nest."
				},
				{
					"id": "e47_3",
					"label": "Ask the moth keeper to follow us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "Let me put the lid on this jar. I will come with you.",
							"join": true
						}
					]
				},
				{
					"id": "e47_4",
					"label": "Mark the nearby rooms on our map",
					"effect": "reveal"
				},
				{
					"id": "e47_5",
					"label": "Leave the moths alone.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e48",
			"name": "The Supply Cart",
			"actor": "cave_cartographer",
			"group": "positive",
			"kind": "merchant",
			"text": "I keep a few supplies for travelers. Today I have one item left. I take cave gold; your party shares the purchase.",
			"options": [
				{
					"id": "e48_0",
					"label": "See the item and its price",
					"effect": "inspect",
					"offer": true,
					"result": "The shop is open. You can pay from the party’s cave gold."
				},
				{
					"id": "e48_1",
					"label": "Ask what happens to leftover cave gold",
					"effect": "story",
					"result": "Spend cave gold at shops and encounters before the run ends. It stays in the cave. Unspent Amber goes to your party."
				},
				{
					"id": "e48_2",
					"label": "Ask where other merchants wait",
					"effect": "story",
					"result": "There is a shop near the doorway on every floor. Look along the upper walls."
				},
				{
					"id": "e48_3",
					"label": "Borrow a lamp for the return trip",
					"effect": "lamp",
					"result": "You take the porter’s spare lamp."
				},
				{
					"id": "e48_4",
					"label": "Take a pry bar from the supply cart",
					"effect": "tool",
					"result": "You take the spare pry bar."
				},
				{
					"id": "e48_5",
					"label": "Keep the gold in the shared purse.",
					"effect": "leave"
				}
			]
		},

		{
			"id": "e49",
			"name": "Make a Tool",
			"actor": "inventor",
			"group": "positive",
			"kind": "tool",
			"text": "I can make a pry bar from these hinges, or refill a lamp. Pick one. You can keep it for the rest of this visit.",
			"options": [
				{
					"id": "e49_0",
					"label": "Take a pry bar for locked hatches",
					"effect": "tool",
					"offer": true,
					"result": "You take the pry bar. It stays in your cave supplies."
				},
				{
					"id": "e49_1",
					"label": "Take a lamp for the moths",
					"effect": "lamp",
					"offer": true,
					"result": "You take the lamp. It stays in your cave supplies."
				},
				{
					"id": "e49_2",
					"label": "Take the tin rattle",
					"effect": "decoy",
					"result": "You pack the rattle. It will draw the next patrol away for eight seconds."
				},
				{
					"id": "e49_3",
					"label": "Ask the toolmaker to come with us",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "I will bring my tools and watch your back.",
							"join": true
						}
					]
				},
				{
					"id": "e49_4",
					"label": "Trade the scrap for 1 Amber",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "The toolmaker gives you 1 Amber for the scrap.",
							"amber": 1
						}
					]
				},
				{
					"id": "e49_5",
					"label": "We have what we need.",
					"effect": "leave"
				}
			]
		},
		{
			"id": "e50",
			"name": "Before You Leave",
			"actor": "bell_keeper",
			"group": "positive",
			"kind": "farewell",
			"text": "Take a gift before you go: some Amber, something from my supply box, or a spare tool. You only get one.",
			"options": [
				{
					"id": "e50_0",
					"label": "Take 2 Amber",
					"effect": "gift",
					"offer": true,
					"result": "Here. Open the chest to add these to the shared purse."
				},
				{
					"id": "e50_1",
					"label": "Open the little supply box",
					"effect": "venture",
					"outcomes": [
						{
							"weight": 1,
							"text": "You open the farewell gift.",
							"reward": "cave_parcel",
							"offer": true
						}
					]
				},
				{
					"id": "e50_2",
					"label": "Take a spare lamp",
					"effect": "lamp",
					"result": "Take the lamp. You may still need it."
				},
				{
					"id": "e50_3",
					"label": "Take a spare pry bar",
					"effect": "tool",
					"result": "You take the spare pry bar."
				},
				{
					"id": "e50_4",
					"label": "Ask {npc} to stay with us",
					"effect": "guide",
					"result": "{npc}: I can stay a little longer. Lead the way."
				},
				{
					"id": "e50_5",
					"label": "Thanks. We have enough.",
					"effect": "leave"
				}
			]
		}
	],
	"cast": {
		"dice_operator": [
			{
				"name": "Noll",
				"skin": "marmor10c",
				"cx": {
					"head": "makeup117",
					"hair": "hairdo103",
					"hat": "hat103",
					"chin": "beard104"
				}
			},
			{
				"name": "Bix",
				"skin": "marmor10d",
				"cx": {
					"head": "fmakeup03",
					"hair": "hairdo208",
					"hat": "hat103"
				}
			},
			{
				"name": "Carro",
				"skin": "marmor10h",
				"cx": {
					"head": "mmakeup01",
					"hair": "hairdo501",
					"hat": "hat103",
					"chin": "beard102"
				}
			}
		],
		"archive_vendor": [
			{
				"name": "Ilex",
				"skin": "mbody5b",
				"cx": {
					"head": "makeup117",
					"hair": "hairdo219",
					"hat": "hat311",
					"face": "tortoise_g",
					"back": "backpacks201"
				}
			},
			{
				"name": "Meda",
				"skin": "mbody5c",
				"cx": {
					"head": "fmakeup03",
					"hair": "hairdo420",
					"hat": "hat311",
					"face": "tortoise_g",
					"back": "backpacks201"
				}
			},
			{
				"name": "Osric",
				"skin": "mbody5b",
				"cx": {
					"head": "mmakeup01",
					"hair": "hairdo406",
					"hat": "hat311",
					"face": "bwglasses",
					"back": "backpacks201"
				}
			}
		],
		"monster_handler": [
			{
				"name": "Moss",
				"skin": "lchar1h",
				"cx": {
					"hat": "hat205",
					"back": "backpacks00"
				}
			},
			{
				"name": "Gannet",
				"skin": "lchar1h",
				"cx": {
					"hat": "hat202",
					"back": "backpacks03"
				}
			},
			{
				"name": "Burr",
				"skin": "lchar1h",
				"cx": {
					"hat": "hat208",
					"back": "backpacks01"
				}
			}
		],
		"duelist": [
			{
				"name": "Vey",
				"skin": "marmor6f",
				"cx": {
					"head": "fmakeup03",
					"hair": "hairdo105",
					"hat": "hat106"
				}
			},
			{
				"name": "Corren",
				"skin": "marmor6e",
				"cx": {
					"head": "mmakeup01",
					"hair": "hairdo206",
					"hat": "hat106"
				}
			},
			{
				"name": "Seri",
				"skin": "marmor6d",
				"cx": {
					"head": "fmakeup01",
					"hair": "hairdo116",
					"hat": "hat106"
				}
			}
		],
		"collector": [
			{
				"name": "Grumm",
				"skin": "xschar2d",
				"cx": {
					"back": "backpacks00"
				}
			},
			{
				"name": "Torren",
				"skin": "xschar2g",
				"cx": {
					"back": "backpacks03"
				}
			},
			{
				"name": "Mard",
				"skin": "xschar2h",
				"cx": {
					"back": "backpacks01"
				}
			}
		],
		"inventor": [
			{
				"name": "Pell",
				"skin": "marmor1b",
				"cx": {
					"head": "fmakeup01",
					"hair": "hairdo205",
					"hat": "hat210",
					"face": "coolblueg",
					"back": "backpacks200"
				}
			},
			{
				"name": "Neri",
				"skin": "marmor1f",
				"cx": {
					"head": "mmakeup02",
					"hair": "hairdo116",
					"hat": "hat211",
					"face": "coolblueg",
					"back": "backpacks200"
				}
			},
			{
				"name": "Hobb",
				"skin": "marmor1a",
				"cx": {
					"head": "mmakeup01",
					"hair": "hairdo219",
					"hat": "hat204",
					"face": "coolblueg",
					"back": "backpacks200"
				}
			}
		],
		"pact_broker": [
			{
				"name": "Orra",
				"skin": "mbody6b",
				"cx": {
					"head": "numakeup23"
				}
			},
			{
				"name": "Voss",
				"skin": "mbody6b",
				"cx": {
					"head": "blackhead",
					"face": "catbatg"
				}
			},
			{
				"name": "Isen",
				"skin": "mbody6b",
				"cx": {
					"head": "numakeup16"
				}
			}
		],
		"expedition_captain": [
			{
				"name": "Rusk",
				"skin": "lchar1d",
				"cx": {
					"back": "backpacks02"
				}
			},
			{
				"name": "Aldren",
				"skin": "lchar1f",
				"cx": {}
			},
			{
				"name": "Caro",
				"skin": "lchar1g",
				"cx": {}
			}
		],
		"bell_keeper": [
			{
				"name": "Dorr",
				"skin": "mm_blue",
				"cx": {}
			},
			{
				"name": "Orren",
				"skin": "mm_yellow",
				"cx": {}
			},
			{
				"name": "Nera",
				"skin": "mf_blue",
				"cx": {}
			}
		],
		"cave_cartographer": [
			{
				"name": "Senna",
				"skin": "mbody3f",
				"cx": {
					"head": "fmakeup02",
					"hair": "hairdo105",
					"hat": "hat221",
					"face": "tortoise_g",
					"back": "backpacks201"
				}
			},
			{
				"name": "Calder",
				"skin": "mbody3f",
				"cx": {
					"head": "mmakeup01",
					"hair": "hairdo116",
					"hat": "hat219",
					"face": "tortoise_g",
					"back": "backpacks201"
				}
			},
			{
				"name": "Wren",
				"skin": "mbody5d",
				"cx": {
					"head": "fmakeup01",
					"hair": "hairdo208",
					"hat": "hat221",
					"face": "bwglasses",
					"back": "backpacks201"
				}
			}
		],
		"fungus_farmer": [
			{
				"name": "Pip",
				"skin": "sarmor1c",
				"cx": {
					"head": "mmakeup04",
					"hat": "hat406",
					"back": "backpacks01"
				}
			},
			{
				"name": "Lup",
				"skin": "sarmor1c",
				"cx": {
					"head": "mmakeup05",
					"hat": "hat407",
					"back": "backpacks01"
				}
			},
			{
				"name": "Nib",
				"skin": "sarmor1b",
				"cx": {
					"head": "mmakeup04",
					"hat": "hat406",
					"back": "backpacks03"
				}
			}
		],
		"prisoner": [
			{
				"name": "Edda",
				"skin": "mbody2b",
				"cx": {
					"head": "fmakeup01",
					"hair": "hairdo105"
				}
			},
			{
				"name": "Merek",
				"skin": "mbody2b",
				"cx": {
					"head": "mmakeup02",
					"hair": "hairdo116",
					"chin": "beard100"
				}
			},
			{
				"name": "Sella",
				"skin": "mbody4c",
				"cx": {
					"head": "fmakeup03",
					"hair": "hairdo419"
				}
			}
		]
	},
	"merchant_stock": [
		["cave_tunnelaxe",6000],
		["cave_reedscythe",2500],
		[
			"broom",
			48000
		],
		[
			"tshirt0",
			16000
		],
		[
			"tshirt1",
			16000
		],
		[
			"tshirt2",
			16000
		],
		[
			"cave_loaded_die",
			10000
		],
		[
			"cave_locktooth",
			6000
		],
		[
			"cave_counterweight",
			8000
		],
		[
			"cave_mothsteps",
			6000
		],
		[
			"scroll1",
			2000
		],
		[
			"gem1",
			5000
		]
	],
	"rare": {
		"darkmage": 0.002,
		"rogue_weapon": 0.01,
		"rogue_betrayal": 0.5
	},
	"rewards": {
		"parcel": "cave_parcel",
		"rescue": "cave_rescue",
		"boss": "cave_boss",
		"finish": "cave_finish"
	},
	"gold_limit": 60000,
	"amber_limit": 36
};

// Small camps keep their own three finite packs. Their rewards still use the normal drop tables.
events.dreams.camps = [
 [
  {name:"Amber Nest",packs:[[["cave_rat",6],["cave_spider",2]],[["cave_bat",6]],[["cave_broodmother",1],["cave_spider",3]]]},
  {name:"Bat Roost",packs:[[["cave_bat",8]],[["cave_spider",6]],[["cave_broodmother",1],["cave_bat",4]]]},
 ],
 [
  {name:"Flooded Hollow",packs:[[["cave_crab",7]],[["cave_snake",6]],[["cave_scorpion",2],["cave_crab",4]]]},
  {name:"Guard Outpost",packs:[[["cave_guard",4],["cave_wolf",2]],[["cave_guard",4]],[["cave_guard",3],["cave_scorpion",3]]]},
 ],
 [
  {name:"Venom Burrow",packs:[[["cave_snake",6],["cave_scorpion",2]],[["cave_spider",6]],[["cave_broodmother",1],["cave_scorpion",3]]]},
  {name:"Deep Roost",packs:[[["cave_bat",6],["cave_spider",2]],[["cave_wolf",5]],[["cave_broodmother",1],["cave_bat",4]]]},
 ],
];
events.dreams.travelers = [
 {name:"Pip",skin:"mbody3f",cx:{head:"fmakeup02",hair:"hairdo105",back:"backpacks201"},says:["Excuse me! Heavy bag.","I came for Amber. Found mostly spiders.","The stairs are marked. I still get lost."]},
 {name:"Bram",skin:"mbody4b",cx:{head:"mmakeup01",hair:"hairdo219",hat:"hat204",back:"backpacks200"},says:["Mind the bats. They sleep until you get close.","Dorr said this would be a short walk.","You look busy. I'll keep out of the way."]},
 {name:"Lena",skin:"mbody5c",cx:{head:"fmakeup02",hair:"hairdo206",hat:"hat221"},says:["Someone down here is selling just one thing. Strange shop.","I heard shouting ahead. I took the long way.","If you find a blue scarf, it's mine."]},
];

events.dreams.cast.expedition_captain=[
 {name:"Rusk",skin:"marmor10d",cx:{head:"mmakeup01",hair:"hairdo219",hat:"hat204",back:"backpacks200"}},
 {name:"Aldren",skin:"marmor6e",cx:{head:"mmakeup04",hair:"hairdo206",back:"backpacks201"}},
 {name:"Caro",skin:"marmor1a",cx:{head:"fmakeup02",hair:"hairdo105",hat:"hat221"}},
];
events.dreams.cast.bell_keeper=[
 {name:"Orren",skin:"mbody4b",cx:{head:"mmakeup01",hair:"hairdo219",hat:"hat204"}},
 {name:"Nera",skin:"mbody3f",cx:{head:"fmakeup02",hair:"hairdo105",back:"backpacks201"}},
 {name:"Olin",skin:"mbody6b",cx:{head:"mmakeup04",hair:"hairdo206",back:"backpacks200"}},
];
