const nunjucks = require("nunjucks");
const fs = require("fs");
const path = require("path");

var env = nunjucks.configure(["./common/", ".", "./templates"], {
  autoescape: true,
});

// Directory containing your templates
const templatesDir = path.resolve(__dirname, "../templates"); // adjust as needed
const outputFile = path.resolve(__dirname, "../js/templates.js");

// Helper: Recursively collect all .njk files in a directory
function getAllNjkFiles(dir, fileList = [], prepend = "") {
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllNjkFiles(filePath, fileList, file + "/" + prepend);
    } else if (file.endsWith(".njk") || file.endsWith(".nunjucks") || file.endsWith(".html")) {
      fileList.push(prepend + file);
    }
  });
  return fileList;
}

// Gather all .njk template files
const njkFiles = getAllNjkFiles(templatesDir);
console.log(njkFiles);

// Precompile
const precompiled = nunjucks.precompile("./templates", {
  env: env,
  include: ["njk", "html", "nunjucks"],
  //name: (filepath) => path.relative(templatesDir, filepath).replace(/\\/g, "/"),
});

// Write to templates.js
fs.writeFileSync(outputFile, precompiled, "utf8");

console.log(`Precompiled ${njkFiles.length} templates to ${outputFile}`);
