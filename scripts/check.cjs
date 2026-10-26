const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (/\.(js|cjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ["--check", file], {
        stdio: "inherit",
      });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
for (const directory of ["src", "scripts", "tests"]) check(directory);
const html = fs.readFileSync("index.html", "utf8");
for (const match of html.matchAll(/(?:src|href)="(src\/[^"#]+)"/g)) {
  if (!fs.existsSync(match[1]))
    throw new Error(`Missing page asset: ${match[1]}`);
}
console.log("PASS: JavaScript syntax and page asset references.");
