"use strict";

const { worldError } = require("./world_schema");

const { SKILL_IDS } = require("./skill_domain");

function assertProtocol3Publication(publication) {
	if (!publication || publication.protocol !== 3 || publication.classes || publication.levels) {
		throw worldError("WORLD_PUBLICATION", "Protocol 3 publication is required and legacy class data is forbidden");
	}
	if (
		!publication.skills ||
		JSON.stringify(Object.keys(publication.skills).sort()) !== JSON.stringify([...SKILL_IDS].sort())
	) {
		throw worldError("WORLD_PUBLICATION", "Protocol 3 publication must expose exactly the seven registered skills");
	}
	if (!publication.abilities || typeof publication.abilities !== "object") {
		throw worldError("WORLD_PUBLICATION", "Protocol 3 publication is missing abilities");
	}
	return { protocol: 3, skillCount: SKILL_IDS.length, abilityCount: Object.keys(publication.abilities).length };
}

module.exports = { SKILL_IDS, assertProtocol3Publication };
