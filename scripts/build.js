// Production build orchestrator for NationalNews.pk.
// Pipeline: validate news.json -> clean dist -> copy static pages ->
// generate latest + category + article pages -> RSS + sitemap -> link check.
// Cloudflare Pages runs this via `npm run build` (output: dist/).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNews } from "./validate-news.js";
import { buildLatest } from "./build-news.js";
import { buildCategories } from "./build-categories.js";
import { buildArticles } from "./build-articles.js";
import { buildRss, buildSitemap } from "./build-feed.js";
import { injectHomepage } from "./inject-homepage.js";
import { checkLinks } from "./check-links.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist");

// 1. Load + validate the central news index.
const newsFile = path.join(root, "news.json");
let records;
try {
  records = JSON.parse(fs.readFileSync(newsFile, "utf8"));
} catch (err) {
  console.error(`BUILD FAILED: news.json is not valid JSON — ${err.message}`);
  process.exit(1);
}
const { errors, warnings } = validateNews(records, { root });
for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length) {
  console.error(`BUILD FAILED: news.json validation errors (${errors.length}):`);
  for (const e of errors) console.error(`  ERROR: ${e}`);
  process.exit(1);
}
console.log(`news.json OK: ${records.length} record(s).`);

// 2. Clean output directory.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 3. Copy static pages and assets (hand-maintained files).
const STATIC_FILES = [
  "index.html", "404.html", "robots.txt", "_headers", "logo.svg",
  "about.html", "privacy-policy.html", "editorial-policy.html",
];
for (const file of STATIC_FILES) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}
console.log(`Copied ${STATIC_FILES.length} static file(s).`);

// 4. Generate data-driven pages.
buildLatest(root, outDir, records);
buildCategories(root, outDir, records);
const articles = buildArticles(root, outDir, records);
buildRss(root, outDir, records);
buildSitemap(root, outDir, records);
injectHomepage(root, outDir, records);

// 5. Verify all internal links resolve.
if (!checkLinks(outDir)) {
  console.error("BUILD FAILED: broken internal links.");
  process.exit(1);
}

console.log(`Build complete: dist/ ready (${articles.length} article page(s) generated).`);
