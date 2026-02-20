var character_types=["warrior","paladin","mage","priest","rogue","ranger","merchant"]; //,"assassin","paladin","archer","priest"]
//STR -> Warrior, Paladin - Paladin hits 50%/50% Physical/Magical - Hits magical on high ranges, can't wield heavy items
//DEX -> Assasin, Archer
//INT -> Mage, Priest - Priest can heal players aggressively + slows on damage
var gender_types=["male","female"];
var allowed_name_characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var item_grades={
	"low":{"color":"grey"},
	"mid":{"color":"blue"},
	"high":{"color":"green"},
	"rare":{"color":"orange"},
	"unique":{"color":"purple"},
};

var party_xp=[0,1,1.10,0.9,0.75,0.6,0.5,0.40,0.3];
var server_regions={
	"US":"Americas",
	"EU":"Europas",
	"ASIA":"Eastlands",
};
var server_names=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

var community_maps=[ //to look for map creator talent, to show the editor to pixel artists
	"test481612",//oragon
	"test421421",//mine
	"test468122",//range
];

var ellian_id="5941620885159936";
var hello_id="6218930913804288"; //hello@adventure.land
var inner_circle=[
	"5752754626625536", //me
	"6243983994912768", //json
	"5818821692620800", //me-sdk
];
