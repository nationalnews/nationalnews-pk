// Production build orchestrator for NationalNews.pk.
// Pipeline: validate news.json -> clean dist -> copy static pages ->
// generate latest + category + article pages -> RSS + sitemap -> link check.
// Cloudflare Pages runs this via `npm run build` (output: dist/).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNews } from "./validate-news.js";
import { assessSafety, stripHtml, safetyReport } from "./safety-filter.js";
import { buildLatest } from "./build-news.js";
import { buildCategories } from "./build-categories.js";
import { buildArticles } from "./build-articles.js";
import { buildRss, buildSitemap, buildNewsSitemap } from "./build-feed.js";
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

// 1b. Safety sweep — last line of defence. publish.js already gates new
// stories, but records hand-added via the GitHub web editor bypass it.
// blocked (without an owner safetyReviewed note) fails the build;
// review always prints a visible warning.
let sweepBlocked = 0;
let sweepReview = 0;
for (const rec of records) {
  let bodyText = "";
  try {
    bodyText = stripHtml(fs.readFileSync(path.join(root, rec.body), "utf8"));
  } catch { /* body file presence is validated elsewhere */ }
  const a = assessSafety([rec.title, rec.excerpt, rec.dek, bodyText].filter(Boolean).join("\n"));
  if (a.level === "clear") continue;
  if (rec.safetyReviewed) {
    console.log(`WARN: safety override recorded for "${rec.slug}" (topics: ${rec.safetyReviewed.topics?.join(", ")}, approved by ${rec.safetyReviewed.approvedBy}).`);
    sweepReview += 1;
  } else if (a.level === "blocked") {
    console.error(`SAFETY: "${rec.slug}" matches BLOCKED policy topics — build will fail:`);
    console.error(safetyReport(a).join("\n"));
    sweepBlocked += 1;
  } else {
    console.log(`WARN: safety review flag on "${rec.slug}" — owner approval recommended before it stays live:`);
    console.log(safetyReport(a).join("\n"));
    sweepReview += 1;
  }
}
if (sweepBlocked > 0) {
  console.error(`BUILD FAILED: ${sweepBlocked} published record(s) violate the blocked content policy (SAFETY-POLICY.md).`);
  process.exit(1);
}
console.log(`Safety sweep: 0 blocked, ${sweepReview} review-flagged record(s).`);

// 2. Clean output directory.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 3. Copy static pages and assets (hand-maintained files).
const STATIC_FILES = [
  "index.html", "404.html", "robots.txt", "_headers", "logo.svg",
  "about.html", "privacy-policy.html", "editorial-policy.html",
  "safety-policy.html", "assets/site.css", "assets/og-cover.png",
  "googlecf8400cbc1fffc0b.html", // Google Search Console ownership file
  "55487652975ed714f3bf5ca332a1d008.txt", // IndexNow ownership key (Bing/Seznam/Yandex)
];
fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
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
buildNewsSitemap(root, outDir, records);
injectHomepage(root, outDir, records);

// 5. Verify all internal links resolve.
if (!checkLinks(outDir)) {
  console.error("BUILD FAILED: broken internal links.");
  process.exit(1);
}

console.log(`Build complete: dist/ ready (${articles.length} article page(s) generated).`);
