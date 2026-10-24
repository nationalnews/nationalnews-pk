#!/usr/bin/env node
// IndexNow instant indexing: notifies participating search engines
// (Bing, Seznam, Naver, Yandex, Yep) about new or changed URLs after each build.
// Docs: https://www.indexnow.org/documentation
//
// Usage: node scripts/indexnow-submit.js [--strict]
//   --strict  exit non-zero on submission failure (default: warn only, so a
//             search-engine hiccup can never fail the quality gate)
//
// What it submits:
//   - homepage, latest page and section pages (they change on every publish)
//   - every published article dated within the last 7 days
// Ownership is proven by the key file served at /<key>.txt (copied into dist/).
import fs from "node:fs";
import path from "node:path";
import { SITE_URL, CATEGORIES } from "./site-config.js";

const root = process.cwd();
const strict = process.argv.includes("--strict");

// 1. Load the IndexNow key from the root key file (<32 hex chars>.txt).
const keyFiles = fs.readdirSync(root).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (keyFiles.length !== 1) {
  console.error("IndexNow: key file <32-hex>.txt not found at repo root");
  process.exit(strict ? 1 : 0);
}
const KEY_FILE = keyFiles[0];
const KEY = fs.readFileSync(path.join(root, KEY_FILE), "utf8").trim();
const host = new URL(SITE_URL).host;

// 2. Collect URLs: pages that change on every publish + recent articles.
const urls = [
  `${SITE_URL}/`,
  `${SITE_URL}/latest.html`,
  ...CATEGORIES.map((c) => `${SITE_URL}/${c.file}`),
];

const news = JSON.parse(fs.readFileSync(path.join(root, "news.json"), "utf8"));
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
let articleCount = 0;
for (const r of news) {
  if (r.status !== "published") continue;
  const d = new Date(r.date);
  if (Number.isNaN(d.getTime()) || d < cutoff) continue;
  urls.push(`${SITE_URL}${r.url}`);
  articleCount += 1;
}

console.log(
  `IndexNow: submitting ${urls.length} URL(s) (${articleCount} recent article(s)) for host ${host}`
);

// 3. Submit to the shared IndexNow endpoint (routes to all participating engines).
const body = JSON.stringify({
  host,
  key: KEY,
  keyLocation: `${SITE_URL}/${KEY_FILE}`,
  urlList: urls,
});

try {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  console.log(`IndexNow: api.indexnow.org responded ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) {
    const text = await res.text().catch(() => "");
    console.error(`IndexNow: submission problem: ${text.slice(0, 200)}`);
    process.exit(strict ? 1 : 0);
  }
} catch (err) {
  console.error(`IndexNow: submission failed: ${err.message}`);
  process.exit(strict ? 1 : 0);
}
