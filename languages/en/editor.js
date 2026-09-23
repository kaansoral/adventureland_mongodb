// English map editor catalog. Usage notes protect code, names and dynamic parameters.
// Keep technical control names SIZE_X, SIZE_Y, STEP, Z.OFFSET and key bindings unchanged.
// Translate quoted human button labels consistently with their matching editor control entries.
module.exports = {
	// utility/htmls/imagesets/selector.html:162; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.imagesets.selector.alert": "Alert",
	// utility/htmls/map_editor.html:157; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.add-entity": "Add Entity",
	// utility/htmls/map_editor.html:144; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only.
	"editor.map_editor.add-night-animation-blends-with-characters": 'Add Night Animation <span class="gray">[Blends with Characters]</span>',
	// utility/htmls/map_editor.html:166; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.add-zone": "Add Zone",
	// utility/htmls/map_editor.html:155; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.area": "Area",
	// utility/htmls/map_editor.html:163; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.delay": "DELAY",
	// utility/htmls/map_editor.html:139; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. The braced list gives visual examples, not parameters; translate its ordinary nouns and keep the braces.
	"editor.map_editor.dynamic-animation-blends-with-characters-single-tile":
		'Dynamic Animation <span class="ggreen">[Blends with Characters]</span> <span class="gray">[Single Tile]</span> <span class="gyellow">{Smokes, Floating, Animating Objects}</span>',
	// utility/htmls/map_editor.html:136; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. The braced list gives visual examples, not parameters; translate its ordinary nouns and keep the braces.
	"editor.map_editor.dynamic-regular-no-animations-multi-tiles":
		'Dynamic Regular <span class="gray">[No Animations]</span> <span class="ggreen">[Multi Tiles]</span> <span class="gyellow">{Roofs, Signs, Furniture}</span>',
	// utility/htmls/map_editor.html:159; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.frames": "FRAMES",
	// utility/htmls/map_editor.html:191; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.guide": "GUIDE",
	// utility/htmls/map_editor.html:182; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.info-on": "Info: ON",
	// utility/htmls/map_editor.html:161; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.interval": "INTERVAL",
	// utility/htmls/map_editor.html:156; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.line": "Line",
	// utility/htmls/map_editor.html:150; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.normal-point": "Normal Point",
	// utility/htmls/map_editor.html:148; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.polygon-special-spawn-area": "Polygon [Special Spawn, Area]",
	// utility/htmls/map_editor.html:147; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.rectangle-spawn-door-area": "Rectangle [Spawn, Door, Area]",
	// utility/htmls/map_editor.html:153; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.save": "Save",
	// utility/htmls/map_editor.html:142; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged. Fixed HTML: preserve all tags, attributes, URLs and handlers exactly. Translate visible prose only. The braced list gives visual examples, not parameters; translate its ordinary nouns and keep the braces.
	"editor.map_editor.simple-animation-over-map-under-characters-single-tile":
		'Simple Animation <span class="gray">[Over Map] [Under Characters] [Single Tile]</span> <span class="gyellow">{Waterfalls, Alien Flowers}</span>',
	// utility/htmls/map_editor.html:149; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.spawn-point-with-distance-check": "Spawn [Point with Distance Check]",
	// utility/htmls/map_editor.html:154; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.under": "Under",
	// utility/htmls/map_editor.html:189; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor.upload": "UPLOAD",
	// utility/htmls/map_editor_info.html:25; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.area-mode": "Area Mode",
	// utility/htmls/map_editor_info.html:45; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.aspiring-to-combine-code-resort-at-one-point":
		"Aspiring to combine CODE + Resort at one point, provide a basic Networking architecture to map builders, so they can create simple yet fun interactive experiences, maybe basic multiplayer games. As everything on Adventure Land, the Map Editor, Resort will improve and change over time too, keep this in mind. If you have any questions, requests, feel free to email me at hello@adventure.land. Have fun!",
	// utility/htmls/map_editor_info.html:43; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.characters-can-t-pass-lines-so-make-sure":
		"Characters can't pass lines, so make sure you place lines around your map. As a best practice, place lines ~8pixels away from actual boundaries. Your character will spawn at 0,0 - on the Red Dot, so, for the time being, build your map according to that.",
	// utility/htmls/map_editor_info.html:32; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.deleting-tiles": "Deleting Tiles",
	// utility/htmls/map_editor_info.html:38; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.entities": "Entities",
	// utility/htmls/map_editor_info.html:39; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.entities-are-things-that-can-appear-above-characters":
		'Entities are things that can appear above characters and monsters, things you can get under, for example, a tree, a chair, a house. It\'s challenging to create entities, you can\'t edit an entity, you can only create them in one run, and delete them later on. For this reason, plan the entity you are going to create beforehand and create it perfectly without any mistakes, otherwise you would need to start over. One more important thing, don\'t put any empty space below entities. (I know these are all very complicated, but you might understand these yourself with trial and error). To start an entity, press "Add Entity" and choose "Dynamic Regular", and when you are done, press "Complete", and voila, you created an entity on your map!',
	// utility/htmls/map_editor_info.html:46; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.heads-up": "Heads Up",
	// utility/htmls/map_editor_info.html:28; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.in-this-mode-everything-you-place-goes-under": "In this mode, everything you place goes under the tiles you've placed.",
	// utility/htmls/map_editor_info.html:29; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.keypress-features": "Keypress Features",
	// utility/htmls/map_editor_info.html:42; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.lines": "Lines",
	// utility/htmls/map_editor_info.html:24; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.move-around-your-map-using-arrows-you-can": "Move around your map using arrows, you can also use the +/- buttons to zoom-in/out.",
	// utility/htmls/map_editor_info.html:23; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.moving-and-zooming": "Moving and Zooming",
	// utility/htmls/map_editor_info.html:21; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.picking-and-placing": "Picking and Placing",
	// utility/htmls/map_editor_info.html:26; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.placing-tiles-one-by-one-can-be-tiresome":
		'Placing tiles one by one can be tiresome, that\'s what the "Area Mode" is for, you can place areas instead of single tiles, saves time, performance and space!',
	// utility/htmls/map_editor_info.html:44; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.plans": "Plans",
	// utility/htmls/map_editor_info.html:37; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-b-click-to-delete-zones-aim-for": "Press B + Click: To delete zones (Aim for top-left corner)",
	// utility/htmls/map_editor_info.html:35; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-c-click-to-delete-lines": "Press C + Click: To delete lines",
	// utility/htmls/map_editor_info.html:31; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-l-click-line-continuity-test": "Press L + Click: Line continuity test",
	// utility/htmls/map_editor_info.html:36; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-v-click-to-delete-entities": "Press V + Click: To delete entities",
	// utility/htmls/map_editor_info.html:33; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-x-click-to-delete-regular-tiles": "Press X + Click: To delete regular tiles",
	// utility/htmls/map_editor_info.html:30; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-y-click-select-a-default-tile-to": "Press Y + Click: Select a default tile to span everywhere",
	// utility/htmls/map_editor_info.html:34; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.press-z-click-to-delete-area-tiles": "Press Z + Click: To delete area tiles",
	// utility/htmls/map_editor_info.html:20; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.the-buttons-above-the-castle-doors-dungeon-etc":
		'The buttons above, the "castle", "doors", "dungeon" etc. are the tilesets. When you click a tileset, it\'s opened on the top right corner. You can zoom-in/out with the +/- buttons. When you activate the "M" button, you can move the tileset using arrows.',
	// utility/htmls/map_editor_info.html:19; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.tilesets": "Tilesets",
	// utility/htmls/map_editor_info.html:27; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.under-mode": "Under Mode",
	// utility/htmls/map_editor_info.html:47; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.webgl-is-a-very-moody-technology-for-example":
		"WebGL is a very moody technology, for example, the Map Editor could slow down the game even after you close the Map Editor, if you feel something is amiss, just restart your browser, and hope WebGL improves in time and we leave issues like these behind :]",
	// utility/htmls/map_editor_info.html:18; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.welcome-adventurer-this-is-our-in-house-custom":
		"Welcome Adventurer. This is our in-house, custom map editor, we use it to build the maps of Adventure Land. For this reason, it's a bit crude, hard to use, and it's quite heavy in terms of resource usage. Now that you have been warned, onto the fun stuff!",
	// utility/htmls/map_editor_info.html:22; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.you-can-pick-and-place-a-tile-of":
		'You can pick and place a tile of "SIZE_X"/"SIZE_Y" size, the default size is 16x16. You can also modify the "STEP", try setting it to 1 for example to see what it does. You need to keep the tileset open to place tiles. Just click anywhere on the map to place one tile! If you press "Y" - You can set a tile to be the default tile.',
	// utility/htmls/map_editor_info.html:40; Page div prose block. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.zones": "Zones",
	// utility/htmls/map_editor_info.html:41; Page prose. Keep Adventure Land, CODE symbols, product names, and item/NPC/map/character names unchanged.
	"editor.map_editor_info.zones-are-there-to-make-it-easier-to":
		"Zones are there to make it easier to reference areas when developing the game. They can be spawns, traps, safe zones, anything! For basic spawns, only draw a rectangle - it makes things very lightweight!",
	// utility/htmls/map_editor.js:31; place_tile visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.place_tile_invalid_interval": "Invalid interval",
	// utility/htmls/map_editor.js:187; line_check visible map-editor feedback. Parameters: {"paths":"paths"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.line_check_paths_there_is_probably_a": "{paths} paths - there is probably a gap!!",
	// utility/htmls/map_editor.js:209; map_click visible map-editor feedback. Parameters: {"value1":"rf(point[0])","value2":"rf(point[1])"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_point": "Point: [{value1},{value2}]",
	// utility/htmls/map_editor.js:216; map_click visible map-editor feedback. Parameters: {"value1":"rf(point[0])","value2":"rf(point[1])","value3":"rf(point[2])","value4":"rf(point[3])","value5":"rf(point[0]+(point[2]-point[0])/2)","value6":"rf(point[3])","value7":"rf(point[2]-point[0])","value8":"rf(point[3]-point[1])"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_rectangle_door": "Rectangle: [{value1},{value2},{value3},{value4}]<br />Door: [{value5},{value6},{value7},{value8}]",
	// utility/htmls/map_editor.js:233; map_click visible map-editor feedback. Parameters: {"p":"p","value2":"rf(min_x)","value3":"rf(min_y)","value4":"rf(max_x)","value5":"rf(max_y)"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_polygon_boundaries": "Polygon: [{p}]<br />Boundaries: [{value2},{value3},{value4},{value5}]",
	// utility/htmls/map_editor.js:247; map_click visible map-editor feedback. Parameters: {"value1":"current[0]","value2":"current[1]","value3":"current[2]"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_x_line_x_y_to": "x-line x {value1} | y {value2} to {value3}",
	// utility/htmls/map_editor.js:259; map_click visible map-editor feedback. Parameters: {"value1":"current[0]","value2":"current[1]","value3":"current[2]"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_y_line_y_x_to": "y-line y {value1} | x {value2} to {value3}",
	// utility/htmls/map_editor.js:344; map_click visible map-editor feedback. Parameters: {"value1":"JSON.stringify(def)","value2":"JSON.stringify(tile)"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_area_tile_def_tile": "area-tile def: {value1} tile: {value2}",
	// utility/htmls/map_editor.js:365; map_click visible map-editor feedback. Parameters: {"value1":"JSON.stringify(def)","value2":"JSON.stringify(tile)"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_single_tile_def_tile": "single-tile def: {value1} tile: {value2}",
	// utility/htmls/map_editor.js:484; map_click visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.map_click_default_is_set": "Default is Set",
	// utility/htmls/map_editor.js:582; save visible map-editor feedback. Parameters: {"data":"data"}. Preserve coordinates, delimiters, and fixed HTML. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.save_done_bytes": "Done! {data} bytes",
	// utility/htmls/map_editor.js:779; toggle_lines visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.toggle_lines_info_off": "Info: OFF",
	// utility/htmls/map_editor.js:806; startstop_group visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.startstop_group_complete": "Complete",
	// utility/htmls/map_editor.js:826; startstop_animation visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.startstop_animation_cancel": "Cancel",
	// utility/htmls/map_editor.js:914; register_point visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.register_point_spawn_points_need_to_be": "Spawn points need to be 12px away from lines!",
	// utility/htmls/map_editor.js:1086; redraw_map visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.redraw_map_deleted_some_faulty_tiles_this":
		"Deleted some faulty tiles, this might have happened if you shrinked your own tileset, or if you increased your tile area after selecting a tile etc.",
	// utility/htmls/map_editor.js:1130; redraw_map visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.redraw_map_deleted_some_faulty_groups_this":
		"Deleted some faulty groups, this might have happened if you shrinked your own tileset, or if you increased your tile area after selecting a tile etc.",
	// utility/htmls/map_editor.js:1167; redraw_map visible map-editor feedback. Keep tile/map names and CODE identifiers unchanged.
	"editor.message.redraw_map_deleted_some_faulty_lights_this":
		"Deleted some faulty lights, this might have happened if you shrinked your own tileset, or if you increased your tile area after selecting a tile etc.",
	// utility/htmls/map_editor.js redraw_map; map-editor warning after invalid entries are removed from map_data.nights. Nights means night animations placed with Add Night Animation, not periods of time and not a typo for tiles. Preserve tile/map names and CODE identifiers.
	"editor.message.redraw_map_deleted_some_faulty_nights_this":
		"Deleted some faulty nights, this might have happened if you shrinked your own tileset, or if you increased your tile area after selecting a tile etc.",
	// Map editor tileset upload form; save-before-upload reminder.
	"editor.upload.save_first": "Make sure you save your map before uploading a tileset",
	// Map editor tileset file submission button; applies to both native tileset layers.
	"editor.upload.button": "Upload",
};
