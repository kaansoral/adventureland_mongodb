var image_size = require("image-size"),
	fs = require("fs");
var path = require("path"),
	f = require(path.resolve(__dirname, "script_functions.js"));
var images = {};

var data = f.read_file("~/adventureland/design/sprites.js");
data = data.split(".png");
delete data[data.length - 1];
data.forEach(function (file) {
	file = file.split('"');
	file = file[file.length - 1];
	file = file + ".png";
	images[file] = image_size(process.env.HOME + "/adventureland" + file);
});

// console.log(images);

f.write_file(
	"~/adventureland/design/precomputed_images.js",
	"// " + new Date() + "\nprecomputed={};precomputed.images=" + JSON.stringify(images) + "\n",
);
