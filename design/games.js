var games={
	"tarot":{
		"npc":"twitch",
		"cards":["chariot","death","devil","emperor","empress","fool","fortune","hangman","hermit","hierophant","judgment","justice","lovers","magician","moon","priestess","star","strength","sun","temperance","theworld","tower"],
		"hours":23,
	},
	"dice":{

	},
	"wheel":{
		"gold":1000000,
		"slices":[
			["g0","gold",250000,"gold"],
			["g1","gold",500000,"gold"],
			["g2","gold",1000000,"gold"],
			["g3","gold",2000000,"gold"],
			["g4","gold",5000000,"gold"],
			["g5","gold",10000000,"gold"],
			["g6","gold",20000000,"gold"],
			["g7","gold",50000000,"gold"],
			["g7","gold",100000000,"gold"],
			["g8","gold",250000000,"gold"],
			["g9","gold",1000000000,"gold"],
			["gg","item","glitch","#1398D3"],
			["ow","item","funtoken","gold"],
		],
	},
	"slots":{
		"gold":1000000,
		"glyphs":["1","2","3","4","5","6","7","8","A","L"],
	},
};

var odds={
	"slots":1.0/640,
	"slots_good":1.0/525,
};



var cards=["2","3","4","5","6","7","8","9","10","ace","king","knight","page","queen"];
for(var i=0;i<cards.length;i++){
	var c=cards[i];
	games["tarot"]["cards"].push(c+"cups");
	games["tarot"]["cards"].push(c+"pentacles");
	games["tarot"]["cards"].push(c+"swords");
	games["tarot"]["cards"].push(c+"wands");
}

if(typeof module!=="undefined") module.exports={games:games,odds:odds};
