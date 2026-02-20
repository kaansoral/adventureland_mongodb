env.addFilter("to_json", function (obj) {
	try {
		return JSON.stringify(obj);
	} catch (e) {
		return "{}";
	}
});

env.addFilter("to_tutorial", function (user_data) {
	try {
		return JSON.stringify(data_to_tutorial(user_data));
	} catch (e) {
		return "{}";
	}
});

env.addFilter("to_slots", function (data) {
	var slots = {};
	if (!data) return JSON.stringify(slots);
	for (var id in data) {
		if (id.startsWith("trade") || !data[id]) continue;
		var current = { name: data[id].name };
		if (data[id].level !== undefined) current.level = data[id].level;
		if (data[id].stat_type !== undefined) current.stat_type = data[id].stat_type;
		if (data[id].p !== undefined) current.p = data[id].p;
		slots[id] = current;
	}
	return JSON.stringify(slots);
});

env.addFilter("get_cx", function (obj) {
	var cx = gf(obj, "cx", {});
	return JSON.stringify(cx);
});

env.addFilter("sshorten", function (name) {
	if (!name) return "";
	return name.length > 9 ? name.slice(0, 9) + ".." : name;
});

env.addFilter("get_online_character", function (domain, key) {
	var keys = { 1: null, 2: null, 3: null, 4: null, 5: null, merchant: null };
	var order = 1;
	if (!domain || !domain.characters) return keys[key];
	for (var i = 0; i < domain.characters.length; i++) {
		var character = domain.characters[i];
		if (!character.online) continue;
		if (character.type == "merchant") {
			keys["merchant"] = character;
		} else {
			keys[order] = character;
			order++;
		}
	}
	return keys[key];
});

env.addFilter("is_user_newb", function (user) {
	if (!user) return true;
	var characters = gf(user, "characters", []);
	for (var i = 0; i < characters.length; i++) {
		if ((characters[i].level || 0) > 47) return false;
	}
	return true;
});

env.addFilter("sales_percent", function (domain) {
	if (!domain || !domain.sales) return "0.00";
	return (domain.sales * 100 / 10000.0).toFixed(2);
});

env.addFilter("to_pretty_num", to_pretty_num);
