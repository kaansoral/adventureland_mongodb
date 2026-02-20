var sprites = {
	test: {
		//"ignore":true,
		file: "/images/tiles/characters/ninja_turtles.png",
		rows: 1,
		columns: 4,
		matrix: [
			//["test"],
			["t1", "test", "t3", "t4"],
		],
	},
	makeup1: {
		file: "/images/cosmetics/makeup/makeup1.png?v=6",
		rows: 1,
		columns: 42,
		type: "head",
		matrix: [[]], //looped below
	},
	bwhair: {
		file: "/images/cosmetics/hairdo/bwhair.png?v=2",
		rows: 1,
		columns: 1,
		type: "hair",
		matrix: [["bwhair"]],
	},
	burningeyes1: {
		file: "/images/cosmetics/beardo/burningeyes1_anim.png",
		rows: 1,
		columns: 1,
		type: "a_makeup",
		matrix: [["breyes"]],
	},
	burningeyes2: {
		file: "/images/cosmetics/beardo/burningeyes2_anim.png",
		rows: 1,
		columns: 1,
		type: "a_makeup",
		matrix: [["bbeyes"]],
	},
	bathat: {
		file: "/images/cosmetics/hats/bathat_anim.png",
		rows: 1,
		columns: 1,
		type: "a_hat",
		matrix: [["bathat"]],
	},
	gcandle: {
		file: "/images/cosmetics/hats/gcandle_anim.png",
		rows: 1,
		columns: 1,
		type: "a_hat",
		matrix: [["gcandle"]],
	},
	halo: {
		file: "/images/cosmetics/hats/halo_anim.png",
		rows: 1,
		columns: 1,
		type: "a_hat",
		matrix: [["halo"]],
	},
	kunique: {
		file: "/images/cosmetics/makeup/kunique.png?v=2",
		rows: 1,
		columns: 4,
		type: "head",
		matrix: [["bwhead", "blackhead", "testm1", "testm2"]],
	},
	mbw: {
		file: "/images/cosmetics/skins/mbw.png",
		rows: 1,
		columns: 1,
		type: "skin",
		size: "normal",
		matrix: [["mbw"]],
	},
	mabw: {
		file: "/images/cosmetics/armors/mabw.png?v=2",
		rows: 1,
		columns: 2,
		type: "armor",
		size: "normal",
		matrix: [["mabw", "nothing"]],
	},
	kglasses: {
		file: "/images/cosmetics/accessories/kglasses.png?v=3",
		rows: 1,
		columns: 4,
		type: "face",
		matrix: [["bwglasses", "tortoise_g", "catbatg", "coolblueg"]],
	},
	gravestones: {
		rskip: true,
		file: "/images/cosmetics/gravestones/gravestone.png",
		rows: 2,
		columns: 10,
		type: "gravestone",
		matrix: [
			[
				"gravestonea",
				"gravestone",
				"xgravestone0",
				"xgravestone1",
				"xgravestone2",
				"xgravestone3",
				"xgravestone4",
				null,
				null,
				null,
			],
			[null, null, null, null, null, null, null, null, null, null],
		],
	},
	deepsea: {
		//"ignore":true,
		file: "/images/tiles/monsters/deep_sea_king.png",
		rows: 1,
		columns: 1,
		matrix: [
			["deepsea"],
			//["t1","test","t3","t4"],
		],
	},
	adversaries: {
		//"ignore":true,
		file: "/images/tiles/characters/adversaries.png",
		rows: 2,
		columns: 4,
		matrix: [
			["a1", "a2", "a3", "a4"],
			["a5", "a6", "a7", "a8"],
		],
	},
	angel_wingless: {
		file: "/images/tiles/characters/angel_wingless.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "bangel", null, null],
			[null, null, null, null],
		],
	},
	jpa: {
		file: "/images/tiles/characters/winners_jpa.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "greengreen", null, "favore"],
			[null, null, null, null],
		],
	},
	jpb: {
		file: "/images/tiles/characters/winners_jpb.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "pinkie", null, "purpo"],
			[null, null, null, null],
		],
	},
	swa: {
		file: "/images/tiles/characters/sheet_winnersa.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "scarf", null, null],
			[null, null, "proft", "twig"],
		],
	},
	swb: {
		file: "/images/tiles/characters/sheet_winnersb.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, "bobo"],
			[null, null, null, null],
		],
	},
	collection1: {
		file: "/images/tiles/characters/collection1.png",
		rows: 2,
		columns: 4,
		matrix: [
			["daisy", null, null, null],
			[null, null, "cunn", "robbie"],
		],
	},
	collection2: {
		file: "/images/tiles/characters/collection2.png",
		rows: 2,
		columns: 4,
		matrix: [
			["sir", null, null, null],
			[null, null, "naked", null],
		],
	},
	// "collection3":{
	// 	"file":"/images/tiles/characters/collection3.png",
	// 	"rows":2,
	// 	"columns":4,
	// 	"matrix":[
	// 		[null,null,null,null],
	// 		[null,null,null,null],
	// 	]
	// },
	collectionx: {
		file: "/images/tiles/characters/collectionx.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "snow_angel", null, null],
			["creator", null, null, null],
		],
	},
	snowman: {
		file: "/images/tiles/monsters/snowman.png",
		rows: 1,
		columns: 1,
		matrix: [["snowman"]],
	},
	dragold: {
		file: "/images/tiles/monsters/Dragold.png?v=2",
		rows: 1,
		columns: 1,
		matrix: [["dragold"]],
	},
	bscorpion: {
		file: "/images/tiles/monsters/blackscorpion.png",
		rows: 1,
		columns: 1,
		matrix: [["bscorpion"]],
	},
	cobold: {
		file: "/images/tiles/monsters/coboldProto.png",
		rows: 1,
		columns: 1,
		matrix: [["cobold"]],
	},
	ligerx: {
		file: "/images/tiles/monsters/liger_x.png",
		rows: 1,
		columns: 1,
		matrix: [["ligerx"]],
	},
	tiger: {
		file: "/images/tiles/monsters/tiger.png",
		rows: 1,
		columns: 1,
		matrix: [["tiger"]],
	},
	slenderman: {
		file: "/images/tiles/monsters/slenderman.png",
		rows: 1,
		columns: 1,
		matrix: [["slenderman"]],
	},
	franky: {
		file: "/images/tiles/monsters/frankenstein.png",
		rows: 1,
		columns: 1,
		matrix: [["franky"]],
	},
	custom1: {
		file: "/images/tiles/characters/custom1.png?v=11",
		rows: 2,
		columns: 4,
		matrix: [
			["mwarrior2", "mranger2", "fpriest", "trexw"],
			["showoffi", "bpri", "mmage", "enterrr"],
		],
	},
	custom2: {
		file: "/images/tiles/characters/custom2.png?v=4",
		rows: 2,
		columns: 4,
		matrix: [
			["trexp", null, null, null],
			["konami", "potiongirl", "j2", null],
		],
	},
	custom3: {
		file: "/images/tiles/characters/custom3.png?v=1",
		rows: 2,
		columns: 4,
		matrix: [
			["spkc", "spkw", "bunny", "bouncer"],
			[null, null, null, null],
		],
	},
	jsonx: {
		file: "/images/tiles/characters/others/jsonX.png",
		rows: 1,
		columns: 1,
		matrix: [["jsonx"]],
	},
	mechagnome: {
		file: "/images/tiles/monsters/mecha_gnome.png",
		rows: 1,
		columns: 1,
		matrix: [["mechagnome"]],
	},
	harpy: {
		file: "/images/tiles/monsters/harpy_b_1.png",
		rows: 1,
		columns: 1,
		matrix: [["harpy"]],
	},
	harpy_fly: {
		file: "/images/tiles/monsters/harpy_b_fly_1.png",
		rows: 1,
		columns: 1,
		matrix: [["harpy_fly"]],
	},
	rharpy: {
		file: "/images/tiles/monsters/harpy_a_1.png",
		rows: 1,
		columns: 1,
		matrix: [["rharpy"]],
	},
	rharpy_fly: {
		file: "/images/tiles/monsters/harpy_a_fly_1.png",
		rows: 1,
		columns: 1,
		matrix: [["rharpy_fly"]],
	},
	ship1: {
		file: "/images/tiles/characters/others/ship2.png",
		rows: 1,
		columns: 1,
		type: "animation",
		matrix: [["ship"]],
	},
	newyear_tree: {
		file: "/images/tiles/characters/others/newyear_tree.png",
		rows: 1,
		columns: 1,
		type: "animation",
		matrix: [["newyear_tree"]],
	},
	bonus1: {
		file: "/images/tiles/characters/bonus1.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, null],
			[null, null, "mranger", "holo"],
		],
	},
	military2: {
		file: "/images/tiles/characters/military2.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "nexus", null, null],
			[null, null, "bsoldier", null],
		],
	},
	military3: {
		file: "/images/tiles/characters/military3.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, null],
			[null, "asoldier", null, null],
		],
	},
	knights: {
		file: "/images/tiles/characters/knights.png",
		rows: 2,
		columns: 4,
		matrix: [
			["pknight", null, "baron", null],
			[null, null, null, null],
		],
	},
	chara2: {
		file: "/images/tiles/characters/chara2.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, "thief", "fxrogue"],
			[null, null, "generalg", "prince"],
		],
	},
	chara3: {
		file: "/images/tiles/characters/chara3.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, "franger", "lilith"],
			[null, null, "frogue", null],
		],
	},
	chara4: {
		file: "/images/tiles/characters/chara4.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "ftokener", "grogue", null],
			["shadow", "angel", null, null],
		],
	},
	chara6: {
		file: "/images/tiles/characters/chara6.png",
		rows: 2,
		columns: 4,
		matrix: [
			["mwarrior", "mnwarrior", "mwarrior_cool", "fpaladin"],
			["fkid", "redhead", "mrogue", "mpaladin_kid"],
		],
	},
	chara7: {
		file: "/images/tiles/characters/chara7.png",
		rows: 2,
		columns: 4,
		matrix: [
			["frozenrogue", null, "fmage", null],
			["marven", "fwarrior", "blingbling", "lionsuit"],
		],
	},
	chara8: {
		file: "/images/tiles/characters/chara8.png",
		rows: 2,
		columns: 4,
		matrix: [
			["pink", "splithair", "wizard", "pwincess"],
			["greencap", null, null, null],
		],
	},
	automatron: {
		file: "/images/tiles/characters/automatron2.png",
		rows: 2,
		columns: 4,
		matrix: [
			["target_a500", "target_a750", "target_r500", "target_r750"],
			["target_ar900", "target_ar500red", null, "target"],
		],
	},
	npc1: {
		file: "/images/tiles/characters/npc1.png",
		rows: 2,
		columns: 4,
		matrix: [
			["gcitizen", "oldcitizen", null, null],
			["fisherman", null, "gemmerchant", null],
		],
	},
	npc3: {
		file: "/images/tiles/characters/npc3.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "mailman", null, null],
			[null, null, null, null],
		],
	},
	npc4: {
		file: "/images/tiles/characters/npc4.png",
		rows: 2,
		columns: 4,
		matrix: [
			["lady1", "lady2", "gabrielle", "gabriella"],
			["lady3", null, "lady4", null],
		],
	},
	npc5: {
		file: "/images/tiles/characters/npc5.png",
		rows: 2,
		columns: 4,
		matrix: [
			["npcc", "lmerchant", "mmerchant", "purplelady"],
			[null, null, null, null],
		],
	},
	npc6: {
		file: "/images/tiles/characters/npc6.png",
		rows: 2,
		columns: 4,
		matrix: [
			["showoff", "fmerchant", "npc63", "llady"],
			["renaldo", null, "lucy", null],
		],
	},
	dwarf2: {
		file: "/images/tiles/characters/dwarf2.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, null],
			["fancyd", null, null, null],
		],
	},
	tristone_m: {
		file: "/images/tiles/characters/tristone_m.png",
		rows: 2,
		columns: 4,
		matrix: [
			["tm_red", "tm_brown", "tm_yellow", "tm_green"],
			["tm_gray", "tm_blue", "tm_purple", "tm_white"],
		],
	},
	tristone_f: {
		file: "/images/tiles/characters/tristone_f.png",
		rows: 2,
		columns: 4,
		matrix: [
			["tf_pink", "tf_blue", "tf_green", "tf_orange"],
			["tf_purple", null, null, null],
		],
	},
	mystics: {
		file: "/images/tiles/characters/mystics.png",
		rows: 1,
		columns: 4,
		matrix: [["mm_blue", "mf_blue", "mm_yellow", "mf_yellow"]],
	},
	creatures1: {
		file: "/images/tiles/monsters/creatures1.png",
		rows: 1,
		columns: 4,
		matrix: [[null, null, "mummy", "booboo"]],
	},
	creatures2: {
		file: "/images/tiles/monsters/creatures2.png",
		rows: 2,
		columns: 4,
		matrix: [
			["oneeye", null, null, null],
			[null, null, null, null],
		],
	},
	jrpumpkins: {
		file: "/images/tiles/monsters/jrpumpkins.png",
		rows: 1,
		columns: 2,
		matrix: [["jr", "greenjr"]],
	},
	chara5: {
		file: "/images/tiles/characters/chara5.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, "thehelmet"],
			[null, "mpriest", "reaper", "goblin"],
		],
	},
	chests: {
		file: "/images/tiles/items/chests.png?v=2",
		rows: 2,
		columns: 12,
		matrix: [
			["chestp", "chest1", null, null, "chest2", null, null, "chest3", null, null, "chest4", null],
			[null, "chest5", null, null, "chest6", null, null, "chest7", null, null, "chest8", null],
		],
		type: "v_animation", //new logic [02/07/18]
	},
	animationc: {
		file: "/images/tiles/characters/animationc.png?v=4",
		rows: 8,
		columns: 4,
		type: "animation",
		matrix: [
			["santa", "pvptokens", null, null],
			["brewingwitch", "funtokens", null, null],
			["test_a", null, "test_b", null],
			[null, null, null, null],
			[null, null, null, null],
			[null, null, null, null],
			[null, null, null, null],
			[null, null, null, null],
		],
	},
	animation1: {
		file: "/images/tiles/characters/animation1i.png",
		rows: 8,
		columns: 4,
		type: "animation",
		matrix: [
			[null, "pflow", "sidesword", "flute"],
			[null, "fancypots", "pike", "doublesword"],
			[null, null, "daggers", "hammer"],
			[null, null, "swdagger", "miniharp"],
			["bow", "spell", "powerup", "magic"],
			["bow2", "sth1", "tricks", "yellowlady"],
			["praise", "drunk", "hairs", "yellowwarrior"],
			["femalesword", "femalelongsword", "scrolls", "double-axe"],
		],
	},
	animation2: {
		file: "/images/tiles/characters/animation2.png",
		rows: 8,
		columns: 4,
		type: "animation",
		matrix: [
			["armorguy", "zengirl", null, null],
			[null, null, null, null],
			[null, null, null, null],
			[null, "goblin_a", null, null],
			[null, null, null, null],
			[null, null, null, null],
			[null, null, null, null],
			[null, null, null, null],
		],
	},
	animation3: {
		file: "/images/tiles/characters/animation3.png",
		rows: 8,
		columns: 4,
		type: "animation",
		matrix: [
			[null, null, null, null],
			[null, null, null, null],
			[null, null, null, null],
			["geekgirl", null, null, null],
			[null, null, null, null],
			[null, "exchanger", null, null],
			[null, null, null, null],
			[null, "newupgrade", null, null],
		],
	},
	elementals: {
		file: "/images/tiles/monsters/elemental.png",
		rows: 2,
		columns: 4,
		matrix: [
			["welemental", "felemental", "nelemental", "eelemental"],
			[null, null, null, null],
		],
	},
	dknight1: {
		skip: 1,
		file: "/images/tiles/monsters/monster_dknight1.png",
		rows: 1,
		columns: 1,
		matrix: [["dknight1"]],
	},
	dknight2: {
		file: "/images/tiles/monsters/monster_dknight2.png",
		rows: 1,
		columns: 1,
		matrix: [["dknight2"]],
	},
	fairies: {
		file: "/images/tiles/monsters/fairies.png",
		rows: 2,
		columns: 4,
		matrix: [
			["greenfairy", "redfairy", "bluefairy", "darkfairy"],
			[null, null, null, null],
		],
	},
	monsterbird1: {
		file: "/images/tiles/monsters/monster_bird1.png",
		rows: 1,
		columns: 1,
		matrix: [["bigbird"]],
	},
	monsterbird2: {
		skip: 1,
		file: "/images/tiles/monsters/monster_bird2.png",
		rows: 1,
		columns: 1,
		matrix: [["blackbird"]],
	},
	monsterbird3: {
		skip: 1,
		file: "/images/tiles/monsters/monster_bird3.png",
		rows: 1,
		columns: 1,
		matrix: [["turkeybird"]],
	},
	boar: {
		file: "/images/tiles/monsters/monster_boar.png",
		rows: 1,
		columns: 1,
		matrix: [["boar"]],
	},
	cacto: {
		skip: 1,
		file: "/images/tiles/monsters/monster_cacto.png",
		rows: 1,
		columns: 1,
		matrix: [["cactusman"]],
	},
	rudolph: {
		file: "/images/tiles/monsters/rudolphi.png",
		rows: 1,
		columns: 1,
		matrix: [["rudolph"]],
	},
	elk: {
		skip: 1,
		file: "/images/tiles/monsters/monster_elk.png",
		rows: 1,
		columns: 1,
		matrix: [["elk"]],
	},
	golem1: {
		skip: 1,
		file: "/images/tiles/monsters/monster_golem1.png",
		rows: 1,
		columns: 1,
		matrix: [["stone_golem"]],
	},
	golem2: {
		skip: 1,
		file: "/images/tiles/monsters/monster_golem2.png",
		rows: 1,
		columns: 1,
		matrix: [["tree_golem"]],
	},
	// "lich":{
	// 	"file":"/images/tiles/monsters/monster_lich.png",
	// 	"rows":1,"columns":1,"matrix":[["lich"]]
	// },
	lizardman1: {
		skip: 1,
		file: "/images/tiles/monsters/monster_lizardman1.png",
		rows: 1,
		columns: 1,
		matrix: [["greenlizardman"]],
	},
	lizardman2: {
		skip: 1,
		file: "/images/tiles/monsters/monster_lizardman2.png",
		rows: 1,
		columns: 1,
		matrix: [["redlizardman"]],
	},
	stompy: {
		file: "/images/tiles/monsters/stompy3.png",
		rows: 1,
		columns: 1,
		matrix: [["stompy"]],
	},
	minotaur: {
		skip: 1,
		file: "/images/tiles/monsters/monster_minotaur.png",
		rows: 1,
		columns: 1,
		matrix: [["minotaur"]],
	},
	phoenix: {
		file: "/images/tiles/monsters/monster_phoenix.png",
		rows: 1,
		columns: 1,
		matrix: [["phoenix"]],
	},
	raptor1: {
		skip: 1,
		file: "/images/tiles/monsters/monster_raptor1.png",
		rows: 1,
		columns: 1,
		matrix: [["greenlizard"]],
	},
	raptor2: {
		skip: 1,
		file: "/images/tiles/monsters/monster_raptor2.png",
		rows: 1,
		columns: 1,
		matrix: [["redlizard"]],
	},
	grinch: {
		file: "/images/tiles/monsters/grinch.png",
		rows: 1,
		columns: 1,
		matrix: [["grinch"]],
	},
	treant: {
		skip: 1,
		file: "/images/tiles/monsters/monster_treant.png",
		rows: 1,
		columns: 1,
		matrix: [["treant"]],
	},
	wolf1: {
		file: "/images/tiles/monsters/monster_wolf1.png",
		rows: 1,
		columns: 1,
		matrix: [["wolf"]],
	},
	wolf2: {
		file: "/images/tiles/monsters/monster_wolf2.png",
		rows: 1,
		columns: 1,
		matrix: [["wolfie"]],
	},
	json: {
		file: "/images/tiles/monsters/json.png",
		rows: 1,
		columns: 1,
		matrix: [["json"]],
	},
	mcustom1: {
		file: "/images/tiles/monsters/custom1.png?v=6",
		rows: 2,
		columns: 4,
		matrix: [
			["cgoo", "crabx", "bbpompom", "gscorpion"],
			["osnake", "mole", "xscorpion", "arcticbee"],
		],
	},
	mcustom2: {
		file: "/images/tiles/monsters/custom2.png?v=5",
		rows: 2,
		columns: 4,
		matrix: [
			["pinkgooi", "pinkgoo", null, null],
			["goldenbat", "wabbit", null, "stoneworm"],
		],
	},
	goos: {
		file: "/images/tiles/monsters/goos.png",
		rows: 2,
		columns: 5,
		matrix: [
			["goo0", "goo1", "goo2", "goo3", "goo4"],
			["goo5", "goo6", "goo7", "goo8", "gooD"],
		],
	},
	monsters1: {
		file: "/images/tiles/monsters/monster1.png",
		rows: 2,
		columns: 4,
		matrix: [
			["goo", "rat", "spider", "scorpion"],
			["bloodworm", "snake", "bee", "bat"],
		],
	},
	animals1: {
		file: "/images/tiles/monsters/animals1.png",
		rows: 2,
		columns: 4,
		matrix: [
			["puppy1", "puppy2", "puppy3", "puppy4"],
			["kitty1", "kitty2", "kitty3", "kitty4"],
		],
	},
	animals2: {
		file: "/images/tiles/monsters/animals2.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, null],
			["porcupine", null, null, null],
		],
	},
	birds1: {
		file: "/images/tiles/monsters/birds1_modded.png",
		rows: 2,
		columns: 4,
		matrix: [
			["hen", "rooster", null, null],
			[null, null, null, null],
		],
	},
	goblinos: {
		file: "/images/tiles/monsters/goblinos.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, "gredpro", "ggreenpro"],
			[null, null, "gpurplepro", "gbluepro"],
		],
	},
	gking: {
		file: "/images/tiles/monsters/goblinkingb.png",
		rows: 1,
		columns: 1,
		matrix: [["gking"]],
	},
	monsterc6: {
		file: "/images/tiles/monsters/monsterc6.png?v=2",
		rows: 2,
		columns: 4,
		matrix: [
			["prat", "pppompom", "spompom", "mighty"],
			["slither", "deadgob", "pinkgoblin", "red"],
		],
	},
	tinyfairies: {
		file: "/images/tiles/monsters/tinyfairies.png",
		rows: 2,
		columns: 4,
		matrix: [
			["tinyp", null, null, null],
			[null, null, null, null],
		],
	},
	monsterc2: {
		file: "/images/tiles/monsters/monsterc2.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, "ent", null, null],
			[null, null, null, null],
		],
	},
	robots: {
		file: "/images/tiles/monsters/robots.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, "zapper0", null],
			[null, null, null, "fieldgen0"],
		],
	},
	mage: {
		file: "/images/tiles/monsters/mage.png",
		rows: 2,
		columns: 4,
		matrix: [
			["xmagefz", "xmagefi", "xmagen", "xmagex"],
			[null, null, null, null],
		],
	},
	monsters2: {
		file: "/images/tiles/monsters/monster2.png?v=3",
		rows: 2,
		columns: 4,
		matrix: [
			["crab", "tortoise", "squig", "croc"],
			["frog", "squigtoad", "poisio", "armadillo"],
		],
	},
	monsters3: {
		file: "/images/tiles/monsters/monster3c.png",
		rows: 2,
		columns: 4,
		matrix: [
			["minimush", "midimush", "plantoid", "uglyplant"],
			["iceroamer", "fireroamer", "chestm", "chestx"], //"trapchest1","trapchest2"
		],
	},
	monsters4: {
		file: "/images/tiles/monsters/monster4.png",
		rows: 2,
		columns: 4,
		matrix: [
			["ghost", null, null, "skeletor"],
			[null, null, null, null],
		],
	},
	vampires: {
		file: "/images/tiles/monsters/vampire2d.png",
		rows: 2,
		columns: 4,
		matrix: [
			["mvampire", "fvampire", null, null],
			[null, null, "vbat", null],
		],
	},
	mrpumpkin: {
		file: "/images/tiles/monsters/mr_pumpkin.png",
		rows: 1,
		columns: 1,
		matrix: [["mrpumpkin"]],
	},
	cbee: {
		file: "/images/tiles/monsters/cbee.png",
		rows: 1,
		columns: 1,
		matrix: [["cutebee"]],
	},
	icegolem: {
		file: "/images/tiles/monsters/iceGolem.png",
		rows: 1,
		columns: 1,
		matrix: [["icegolem"]],
	},
	mrgreen: {
		file: "/images/tiles/monsters/green.png",
		rows: 1,
		columns: 1,
		matrix: [["mrgreen"]],
	},
	robots1: {
		file: "/images/tiles/monsters/robots_walkin_B_1.png?v=2",
		rows: 2,
		columns: 4,
		matrix: [
			["goldenbot", "sparkbot", "targetron", null],
			[null, null, null, null],
		],
	},
	dryad: {
		file: "/images/tiles/monsters/dryad_green_1.png",
		rows: 1,
		columns: 1,
		matrix: [["dryad"]],
	},
	dinos: {
		file: "/images/tiles/monsters/mondinos_1.png",
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, null],
			["gdino", "odino", "bdino", "wdino"],
		],
	},
	spiderqueens: {
		file: "/images/tiles/monsters/giantspider.png",
		rows: 2,
		columns: 2,
		matrix: [
			["spiderbl", "spiderbr"],
			["spiderp", "spiderr"],
		],
	},
	emblems: {
		file: "/images/sprites/emblems/emblems.png?v=6",
		type: "emblem",
		rows: 2,
		columns: 10,
		matrix: [
			["c1", "c2", "c3", "c4", "b1", "r1", "rr1", "dp1", null, null],
			["m1", "m2", "m3", "m4", "b2", "br1", "o1", "j1", null, null],
		],
	},
};
var bodysets = [
	//skin
	["sskin1", "skin", "small", 8, "/images/cosmetics/skins/sskin1.png"],
	["mskin1", "skin", "normal", 8, "/images/cosmetics/skins/mskin1.png"],
	["lskin1", "skin", "large", 4, "/images/cosmetics/skins/lskin1.png"],
	//body
	["sbody1", "body", "small", 5, "/images/cosmetics/armors/sbody1.png?v=4"],
	["mbody1", "body", "normal", 8, "/images/cosmetics/armors/mbody1.png?v=2"],
	["mbody2", "body", "normal", 8, "/images/cosmetics/armors/mbody2.png?v=6"],
	["mbody3", "body", "normal", 8, "/images/cosmetics/armors/mbody3.png?v=3"],
	["mbody4", "body", "normal", 8, "/images/cosmetics/armors/mbody4.png?v=3"],
	["mbody5", "body", "normal", 8, "/images/cosmetics/armors/mbody5.png?v=3"],
	["mbody6", "body", "normal", 3, "/images/cosmetics/armors/mbody6.png"],
	//armor
	["sarmor1", "armor", "small", 8, "/images/cosmetics/armors/sarmor1.png?v=2"],
	["sarmor2", "armor", "small", 4, "/images/cosmetics/armors/sarmor2.png?v=2"],
	["marmor1", "armor", "normal", 8, "/images/cosmetics/armors/marmor1.png?v=2"],
	["marmor2", "armor", "normal", 8, "/images/cosmetics/armors/marmor2.png?v=3"],
	["marmor3", "armor", "normal", 8, "/images/cosmetics/armors/marmor3.png?v=2"],
	["marmor4", "armor", "normal", 8, "/images/cosmetics/armors/marmor4.png?v=4"],
	["marmor5", "armor", "normal", 8, "/images/cosmetics/armors/marmor5.png?v=4"],
	["marmor6", "armor", "normal", 8, "/images/cosmetics/armors/marmor6.png?v=3"],
	["marmor7", "armor", "normal", 8, "/images/cosmetics/armors/marmor7.png?v=2"],
	["marmor8", "armor", "normal", 8, "/images/cosmetics/armors/marmor8.png?v=2"],
	["marmor9", "armor", "normal", 8, "/images/cosmetics/armors/marmor9.png?v=2"],
	["marmor10", "armor", "normal", 8, "/images/cosmetics/armors/marmor10.png"],
	["marmor11", "armor", "normal", 8, "/images/cosmetics/armors/marmor11.png"],
	["marmor12", "armor", "normal", 6, "/images/cosmetics/armors/marmor12.png"],
	["larmor1", "armor", "large", 2, "/images/cosmetics/armors/larmor1.png"],
	//character
	["lchar1", "character", "large", 8, "/images/all_characters/lchar1.png"],
	["mchar16", "character", "normal", 8, "/images/all_characters/mchar16.png"],
	["schar7", "character", "small", 8, "/images/all_characters/schar7.png"],
	["xschar2", "character", "xsmall", 8, "/images/all_characters/xschar2.png"],
	["xxschar2", "character", "xxsmall", 8, "/images/all_characters/xxschar2.png"],
];

for (var si = 0; si < bodysets.length; si++) {
	var s = bodysets[si];
	sprites[s[0]] = {
		file: s[4],
		type: s[1],
		size: s[2],
		rows: 2,
		columns: 4,
		matrix: [
			[null, null, null, null],
			[null, null, null, null],
		],
	};
	var last = 0;
	var nmap = { 0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f", 6: "g", 7: "h" };
	for (var i = 0; i < 2; i++) {
		for (var j = 0; j < 4; j++) {
			if (last < s[3]) {
				sprites[s[0]]["matrix"][i][j] = s[0] + nmap[last];
				last += 1;
			}
		}
	}
}

var rowsets = [
	["hairdo1", "hair", 25, 25, "/images/cosmetics/hairdo/hairdo1.png?v=7"],
	["hairdo2", "hair", 25, 25, "/images/cosmetics/hairdo/hairdo2.png?v=7"],
	["hairdo3", "hair", 25, 25, "/images/cosmetics/hairdo/hairdo3.png?v=7"],
	["hairdo4", "hair", 25, 25, "/images/cosmetics/hairdo/hairdo4.png?v=7"],
	["hairdo5", "hair", 25, 23, "/images/cosmetics/hairdo/hairdo5.png?v=7"],
	["hairdo6", "hair", 25, 10, "/images/cosmetics/hairdo/hairdo6.png?v=3"],
	["hats1", "hat", 25, 16, "/images/cosmetics/hats/hats1.png?v=2"],
	["hats2", "hat", 25, 25, "/images/cosmetics/hats/hats2.png?v=3"],
	["hats3", "hat", 25, 24, "/images/cosmetics/hats/hats3.png?v=2"],
	["hats4", "hat", 25, 11, "/images/cosmetics/hats/hats4.png?v=4"],
	["wings1", "s_wings", 5, 5, "/images/cosmetics/wings/wings1.png"],
	//["wings2","s_wings",2,2,"/images/cosmetics/wings/wings2.png"],
	["wings3", "s_wings", 5, 5, "/images/cosmetics/wings/wings3.png?v=2"],
	["backpacks", "s_wings", 5, 5, "/images/cosmetics/wings/backpacks.png"],
	["backpacks2", "s_wings", 5, 2, "/images/cosmetics/wings/backpack2.png"],
	["tail1", "tail", 1, 1, "/images/cosmetics/tails/wolftail.png"],
	["tail2", "tail", 1, 1, "/images/cosmetics/tails/wolftail2.png"],
	["tail3", "tail", 1, 1, "/images/cosmetics/tails/wolftail3.png"],
	["smakeup", "head", 1, 1, "/images/cosmetics/makeup/smakeup.png"],
	["mmakeup", "head", 14, 14, "/images/cosmetics/makeup/malemakeup.png?v=4"],
	["fmakeup", "head", 13, 13, "/images/cosmetics/makeup/femalemakeupv2.png"],
	//["newfmakeup","head",13,2,"/images/cosmetics/makeup/fmakeup.png"],
	["face1", "face", 41, 11, "/images/cosmetics/accessories/eyeglasses.png?v=3"],
	["beard1", "beard", 41, 15, "/images/cosmetics/beardo/beard1.png?v=3"],
	["mask1", "beard", 25, 6, "/images/cosmetics/beardo/mask1.png?v=2"],
	["facemakeup", "makeup", 25, 8, "/images/cosmetics/beardo/facemakeup.png?v=2"],
	["nmmakeup", "head", 21, 21, "/images/cosmetics/makeup/male_makeup.png"],
	["nfmakeup", "head", 23, 23, "/images/cosmetics/makeup/female_makeup.png"],
	["numakeup", "head", 24, 24, "/images/cosmetics/makeup/unisex_makeup.png"],
];

for (var si = 0; si < rowsets.length; si++) {
	var s = rowsets[si];
	sprites[s[0]] = {
		file: s[4],
		type: s[1],
		rows: 1,
		columns: s[2],
		matrix: [[]],
	};
	for (var k = 0; k < s[2]; k++) sprites[s[0]]["matrix"][0].push(null);
	for (var i = 0; i < s[2]; i++) {
		var name = s[0] + ("0" + i).slice(-2);
		if (s[1] == "hat") name = name.replace("hats", "hat");
		if (i < s[3]) {
			sprites[s[0]]["matrix"][0][i] = name;
		} else {
			sprites[s[0]]["matrix"][0][i] = null;
		}
	}
}

for (var i = 0; i < 42; i++) {
	sprites["makeup1"]["matrix"][0].push("makeup1" + ("0" + i).slice(-2));
}

//for(var i=0;i<25;i++)
//	sprites["hairdo2"]["matrix"][0].push("hair2"+("0"+i).slice(-2));

// for(var i=0;i<41;i++)
// 	sprites["hairs2"]["matrix"][0].push("hair2"+("0"+i).slice(-2));

// for(var i=0;i<41;i++)
// 	sprites["hairs3"]["matrix"][0].push("hair3"+("0"+i).slice(-2));

var imagesets = {
	pack_1a: {
		size: 16,
		rows: 128,
		columns: 16,
		file: "/images/tiles/items/pack_1a.png?v=11",
	},
	pack_20: {
		size: 20,
		rows: 64,
		columns: 16,
		file: "/images/tiles/items/pack_20vt8.png",
		load: true,
	},
	skills: {
		size: 20,
		rows: 13,
		columns: 16,
		file: "/images/tiles/items/skills_20v6.png",
	},
	custom: {
		size: 20,
		rows: 9,
		columns: 7,
		file: "/images/tiles/items/custom.png?v=12",
		load: true,
	},
	community: {
		size: 20,
		rows: 9,
		columns: 7,
		file: "/images/tiles/items/community.png?v=1",
		load: true,
	},
};
var tilesets = {
	castle: { file: "/images/tiles/map/castle.png?v=2" },
	custom2: { file: "/images/tiles/map/custom2.png?v=14" },
	custom: { file: "/images/tiles/map/custom.png?v=14" },
	custom_a: { frames: 3, frame_width: 16, file: "/images/tiles/map/custom_a.png?v=5" },
	doors: { file: "/images/tiles/map/doors.png" },
	dungeon: { file: "/images/tiles/map/dungeon.png?v=5" },
	house: { file: "/images/tiles/map/house.png?v=4" },
	inside: { file: "/images/tiles/map/inside.png?v=9" },
	outside: { file: "/images/tiles/map/outside.png?v=7" },
	puzzle: { frames: 3, frame_width: 16, file: "/images/tiles/map/puzzle.png?v=7" },
	water: { frames: 3, frame_width: 48, file: "/images/tiles/map/water_updated.png?v=13" },
	winter: { file: "/images/tiles/map/winter.png?v=5" },
	fort: { file: "/images/tiles/map/fort.png?v=3" },
	beach: { file: "/images/tiles/map/beach_v2.png" },
	//"world":"/images/tiles/map/world.png",
	licht: { file: "/images/tiles/monsters/monster_lich.png" },
	stands: { file: "/images/tiles/items/stands.png?v=8" },
	new: { file: "/images/tiles/map/new.png?v=15" },
	dark: { file: "/images/tiles/map/dark_dimension.png?v=0" },
	jungle: { file: "/images/tiles/map/jungle.png?v=2" },
	ship: { file: "/images/tiles/map/ship.png" },
	ash: { file: "/images/tiles/map/ashlands.png" },
	ruins: { file: "/images/tiles/map/ruins.png?v=2" },
	tree: { file: "/images/tiles/map/tree.png" },
	lights: { file: "/images/tiles/map/lights.png?v=3", light: "yes" }, // "frames":3,"frame_width":48,
};

if (typeof module !== "undefined")
	module.exports = { sprites: sprites, bodysets: bodysets, rowsets: rowsets, imagesets: imagesets, tilesets: tilesets };
