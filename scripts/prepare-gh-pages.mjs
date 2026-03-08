import { copyFileSync, existsSync } from "node:fs";

const source = "dist/index.html";
const target = "dist/404.html";

if (!existsSync(source)) {
  console.error("Build output not found at dist/index.html. Run npm run build first.");
  process.exit(1);
}

copyFileSync(source, target);
console.log("Prepared dist/404.html for GitHub Pages SPA fallback.");
