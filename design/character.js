var character = {
	appearances: [
		[
			"marmor6d",
			{
				head: "makeup117",
				hair: "hairdo105",
			},
		],
		[
			"sarmor2d",
			{
				head: "fmakeup01",
				hair: "hairdo120",
			},
		],
		[
			"marmor6d",
			{
				head: "makeup105",
				hair: "hairdo105",
			},
		],
		[
			"sarmor2d",
			{
				head: "fmakeup03",
				hair: "hairdo120",
			},
		],
		[
			"marmor4b",
			{
				head: "makeup117",
				hair: "hairdo515",
			},
		],
		[
			"marmor4b",
			{
				head: "fmakeup01",
				hair: "hairdo405",
			},
		],
		[
			"marmor4b",
			{
				head: "makeup105",
				hair: "hairdo515",
			},
		],
		[
			"marmor4b",
			{
				head: "fmakeup03",
				hair: "hairdo405",
			},
		],
		[
			"sbody1c",
			{
				head: "makeup117",
				hair: "hairdo522",
				chin: "beard112",
			},
		],
		[
			"sarmor1h",
			{
				head: "fmakeup01",
				hair: "hairdo210",
			},
		],
		[
			"sbody1c",
			{
				head: "makeup105",
				hair: "hairdo522",
				chin: "beard112",
			},
		],
		[
			"sarmor1h",
			{
				head: "fmakeup03",
				hair: "hairdo210",
			},
		],
		[
			"marmor5a",
			{
				head: "makeup117",
				hair: "hairdo106",
			},
		],
		[
			"mbody2b",
			{
				head: "fmakeup01",
				hair: "hairdo206",
				makeup: "facemakeup02",
			},
		],
		[
			"marmor5a",
			{
				head: "makeup105",
				hair: "hairdo106",
			},
		],
		[
			"mbody2b",
			{
				head: "fmakeup03",
				hair: "hairdo206",
				makeup: "facemakeup02",
			},
		],
		[
			"marmor12d",
			{
				head: "makeup117",
			},
		],
		[
			"mbody5f",
			{
				head: "fmakeup01",
			},
		],
		[
			"marmor12d",
			{
				head: "makeup105",
			},
		],
		[
			"mbody5f",
			{
				head: "fmakeup03",
			},
		],
		[
			"marmor12c",
			{
				head: "makeup117",
			},
		],
		[
			"mbody5e",
			{
				head: "fmakeup01",
			},
		],
		[
			"marmor12c",
			{
				head: "makeup105",
			},
		],
		[
			"mbody5e",
			{
				head: "fmakeup03",
			},
		],
		[
			"marmor12a",
			{
				head: "makeup117",
				hair: "hairdo521",
				hat: "hat404",
			},
		],
		[
			"marmor12b",
			{
				head: "fmakeup01",
				hair: "hairdo520",
			},
		],
		[
			"marmor12a",
			{
				head: "makeup105",
				hair: "hairdo521",
				hat: "hat404",
			},
		],
		[
			"marmor12b",
			{
				head: "fmakeup03",
				hair: "hairdo520",
			},
		],
	],
	baseline: {
		max_hp: 100,
		max_mp: 100,
		speed: 50,
		frequency: 0.3,
		inventory_size: 42,
		attack: 0,
		heal: 0,
		armor: 0,
		resistance: 0,
		str: 0,
		dex: 0,
		int: 0,
		vit: 0,
	},
	skills: {
		warrior: { level: 1, xp: 0 },
		paladin: { level: 1, xp: 0 },
		mage: { level: 1, xp: 0 },
		priest: { level: 1, xp: 0 },
		ranger: { level: 1, xp: 0 },
		rogue: { level: 1, xp: 0 },
		merchant: { level: 1, xp: 0 },
	},
	total_level: 7,
	starter: {
		weapons: ["blade", "mace", "staff", "wbook0", "bow", "claw"],
		consumables: [
			{
				name: "hpot0",
				q: 200,
				gift: 1,
			},
			{
				name: "mpot0",
				q: 200,
				gift: 1,
			},
		],
		equipment: [
			{
				name: "helmet",
				level: 0,
				gift: 1,
			},
			{
				name: "shoes",
				level: 0,
				gift: 1,
			},
		],
		slots: {},
	},
};

if (typeof module !== "undefined") module.exports = { character: character };
