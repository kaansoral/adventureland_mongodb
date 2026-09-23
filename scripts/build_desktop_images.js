// Bundle only image URLs used by the game definitions. No directory crawls or private files.
const fs = require("fs"), path = require("path");

function build_images(root) {
	const sprites = require(path.join(root, "design/sprites.js"));
	const { animations } = require(path.join(root, "design/animations.js"));
	const urls = [...new Set([sprites.sprites, sprites.tilesets, sprites.imagesets, animations]
		.flatMap(group => Object.values(group).map(entry => entry.file)).filter(Boolean))].sort();
	const images = {}, chunks = [];
	let offset = 0;
	for (const url of urls) {
		if (!/^\/images\/[a-zA-Z0-9_./ -]+\.png(?:\?v=[a-zA-Z0-9_.-]+)?$/.test(url)) throw new Error("Invalid bundled image URL: " + url);
		const relative = url.split("?")[0].slice(1);
		if (relative.split("/").includes("..")) throw new Error("Invalid image path: " + url);
		const filename = path.join(root, relative);
		// Reject symlinks as well as paths outside the public image tree.
		if (fs.realpathSync(filename) !== filename) throw new Error("Image is not a regular project asset: " + url);
		const bytes = fs.readFileSync(filename);
		if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Invalid PNG: " + url);
		images[url] = [offset, bytes.length];
		chunks.push(bytes);
		offset += bytes.length;
	}
	const header = Buffer.from(JSON.stringify({ version: 1, images }));
	const length = Buffer.alloc(4);
	length.writeUInt32LE(header.length);
	return Buffer.concat([length, header, ...chunks]);
}

if (require.main === module) {
	const root = fs.realpathSync(path.resolve(__dirname, ".."));
	const bundle = build_images(root);
	fs.writeFileSync(path.join(root, "tauri/resources/image-cache.bin"), bundle);
	console.log("Desktop image bundle prepared: " + bundle.length + " bytes.");
}

module.exports = { build_images };
