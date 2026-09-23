var games={
	"tarot":{
		"npc":"twitch",
		"cards":["chariot","death","devil","emperor","empress","fool","fortune","hangman","hermit","hierophant","judgment","justice","lovers","magician","moon","priestess","star","strength","sun","temperance","theworld","tower"],
		"hours":23,
	},
	"dice":{

	},
	"wheel":{
		// Fortune's Wheel: an even-money spin. Slices alternate between the two sides; the house keeps its edge from net winnings.
		"min":10000,
		"spin":4000, // ms between the spin and its settlement
		"sides":["sun","moon"],
		"slices":[
			["indigo","moon","#3D34A5"],
			["pink","sun","#FF82CE"],
			["teal","moon","#25E2CD"],
			["orange","sun","#FF7500"],
			["blue","moon","#6264DC"],
			["red","sun","#E03C28"],
			["green","moon","#20B562"],
			["gold","sun","#FFBB31"],
			["purple","moon","#A328B3"],
			["peach","sun","#F68F37"],
			["sky","moon","#98DCFF"],
			["blush","sun","#FEC9ED"],
			["pine","moon","#00604B"],
			["lemon","sun","#FFE737"],
		],
	},
	"slots":{
		// Three reels for one fixed stake. The prize draw is fair by design: the weighted prizes average exactly the stake,
		// and the house keeps only its edge from the net win. Prize weights are chances out of "draws" spins.
		"gold":1000000,
		"spin":3600, // ms between the pull and its settlement
		"draws":30000,
		"prizes":[
			["glitch",1000000000,6],
			["goldingot",100000000,60],
			["gem0",20000000,300],
			["seashell",6000000,750],
			["whiskey",3000000,900],
			["wine",2000000,1200],
			["ale",1200000,2000],
		],
		// Display strips only; the draw above decides the prize and the reels are parked to show it.
		"reels":[
			["ale","wine","gem0","ale","whiskey","seashell","ale","goldingot","wine","ale","whiskey","glitch","wine","seashell","ale","gem0","whiskey","wine","seashell","goldingot"],
			["wine","ale","seashell","whiskey","ale","goldingot","gem0","ale","wine","glitch","ale","seashell","whiskey","wine","ale","goldingot","wine","gem0","whiskey","seashell"],
			["ale","seashell","wine","ale","gem0","whiskey","goldingot","ale","wine","whiskey","ale","glitch","seashell","wine","ale","gem0","whiskey","wine","goldingot","seashell"],
		],
	},
	"poker":{
		// Tavern Hold'em: one five-seat no-limit table per Tavern. Player gold plays against player gold; the house keeps
		// only the rake from each awarded pot. Blinds follow the server tier; servers named I/II/III use their tier, every
		// other server and every PVP server uses the IV tier. Stacks are bought in for 40 to 200 big blinds.
		"seats":5,
		"blinds":{"I":[100000,200000],"II":[1000000,2000000],"III":[5000000,10000000],"IV":[10000000,20000000],"PVP":[100000000,200000000]},
		"buyin":[40,200], // in big blinds
		"rake":2, // percent of each awarded pot
		"rake_cap":10, // in big blinds, per pot
		"action_ms":20000, // the clock for every decision
		"bank_ms":30000, // a personal time bank that starts when the clock runs out, once per hand
		"grace_ms":300000, // a disconnected or sitting-out seat is kept this long, then cashed out
		"showdown_ms":10000, // pause after a hand before the next deal, long enough to enjoy a win
		"between_ms":2500, // pause between streets when no decision is left, so the run-out can be watched
		"blind_hands":2, // blinds a disconnected seat still posts before it sits out
		"stools":[[-32,16],[0,16],[32,16],[-60,-28],[60,-28]], // where a seated character stands, relative to the table's anchor
		"reach":40, // a character sits on the stool it stands next to, within this many pixels
		"block":[-48,-48,48,-1], // the table's walking obstacle, relative to the anchor; the client walks around it
		"ranks":["2","3","4","5","6","7","8","9","10","J","Q","K","A"],
		"suits":["hearts","diamonds","clubs","spades"],
		"hands":["high_card","pair","two_pair","three_of_a_kind","straight","flush","full_house","four_of_a_kind","straight_flush"],
	},
};

var cards=["2","3","4","5","6","7","8","9","10","ace","king","knight","page","queen"];
for(var i=0;i<cards.length;i++){
	var c=cards[i];
	games["tarot"]["cards"].push(c+"cups");
	games["tarot"]["cards"].push(c+"pentacles");
	games["tarot"]["cards"].push(c+"swords");
	games["tarot"]["cards"].push(c+"wands");
}

if(typeof module!=="undefined") module.exports={games:games};
