import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const indexHtml = join(distDir, "index.html");
const notFoundHtml = join(distDir, "404.html");
const noJekyll = join(distDir, ".nojekyll");

if (existsSync(indexHtml)) {
  const indexContent = readFileSync(indexHtml, "utf-8");

  // GitHub Pages serves 404 for deep links. Redirect those paths to HashRouter routes.
  const redirectScript = `<script>
(function () {
  if (window.location.hash && window.location.hash.startsWith('#/')) return;
  var path = window.location.pathname || '/';
  var parts = path.split('/').filter(Boolean);
  var base = parts.length > 0 ? '/' + parts[0] : '';
  var routeParts = parts.slice(1);
  var route = routeParts.length ? '/' + routeParts.join('/') : '/';
  var search = window.location.search || '';
  window.location.replace(base + '/#' + route + search);
})();
</script>`;

  const withRedirect = indexContent.replace("</head>", `${redirectScript}\n</head>`);
  writeFileSync(notFoundHtml, withRedirect, "utf-8");
}

writeFileSync(noJekyll, "", "utf-8");
console.log("Prepared GitHub Pages artifacts (.nojekyll, 404.html).");