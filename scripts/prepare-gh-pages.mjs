import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const indexHtml = join(distDir, "index.html");
const notFoundHtml = join(distDir, "404.html");
const noJekyll = join(distDir, ".nojekyll");

if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, notFoundHtml);
}

writeFileSync(noJekyll, "", "utf-8");
console.log("Prepared GitHub Pages artifacts (.nojekyll, 404.html).");
