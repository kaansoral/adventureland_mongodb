// Keep the offline desktop loader in sync with the game's phrase sources.
const fs = require("fs"),
	path = require("path"),
	root = path.resolve(__dirname, ".."),
	languages = require("../js/phrases.js"),
	output = path.join(root, "tauri/resources");

fs.mkdirSync(path.join(output, "languages"), { recursive: true });
fs.copyFileSync(path.join(root, "js/phrases.js"), path.join(output, "phrases.js"));
fs.copyFileSync(path.join(root, "js/desktop.js"), path.join(output, "desktop.js"));
// Steam API identifiers, not Web API locale codes. Filipino has store support only.
// https://partner.steamgames.com/doc/store/localization/languages
const steam = {
	en: "english", tr: "turkish", ru: "russian", es: "spanish", "pt-BR": "brazilian",
	de: "german", ja: "japanese", fr: "french", pl: "polish", ko: "koreana",
	"zh-Hans": "schinese", "zh-Hant": "tchinese", th: "thai", "es-419": "latam",
	uk: "ukrainian", it: "italian", cs: "czech", hu: "hungarian", "pt-PT": "portuguese",
	vi: "vietnamese", sv: "swedish", nl: "dutch", da: "danish", id: "indonesian",
	fi: "finnish", no: "norwegian", ro: "romanian", el: "greek", bg: "bulgarian",
	ms: "malay", ar: "arabic",
};
const catalogs = {};
for (const language of languages.languages) {
	catalogs[language.code] = language.code === "en" ? require("../languages/en/desktop.js") :
		JSON.parse(fs.readFileSync(path.join(root, "languages", language.code, "desktop.json"), "utf8"));
}
fs.writeFileSync(path.join(output, "desktop-languages.json"), JSON.stringify(languages.languages.map(language => ({
	code: language.code,
	steam: steam[language.code] || null,
	close_confirmation: catalogs[language.code]["desktop.close_confirmation"],
})), null, 2) + "\n");
for (const language of languages.languages) {
	const catalog = catalogs[language.code],
		phrases = {};
	for (const key of Object.keys(catalog)) if (key.startsWith("desktop.")) phrases[key] = catalog[key];
	fs.writeFileSync(path.join(output, "languages", language.code + ".js"), "phrase.load(" + JSON.stringify(language.code) + "," + JSON.stringify(phrases) + ");\n");
}
console.log("Desktop loading phrases prepared.");
