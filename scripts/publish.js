// Editorial helper: publish one story from a JSON draft file.
// Usage: node scripts/publish.js <draft.json>
//
// The draft file shape:
// {
//   "slug": "my-story-slug",             // required, lowercase-hyphenated
//   "title": "Headline text",            // required
//   "category": "Pakistan",              // required: Pakistan|World|Business|Sports
//   "date": "2026-10-24",                // required, ISO date
//   "excerpt": "One-line summary for listings.",  // required
//   "source": "BBC News",                // required
//   "sourceUrl": "https://...",          // required for published reporting
//   "type": "News",                      // optional (default "News")
//   "dek": "Standfirst text.",           // optional
//   "editor": "Editor name",             // optional (default "NationalNews.pk Desk")
//   "imageLabel": "PAKISTAN",            // optional art label
//   "seoTitle": "...", "seoDescription": "...",  // optional
//   "bodyHtml": "<p>Full story body...</p>",      // required (or "bodyFile")
//   "bodyFile": "path/to/body.html"      // alternative to bodyHtml
// }
//
// What it does:
//  1. Validates the record with the same rules as CI (validate-news.js),
//     including slug format, category whitelist, URL safety and
//     near-duplicate title detection against existing records.
//  2. Writes articles/<slug>.body.html.
//  3. Appends the record to news.json with status "published".
//  4. Reminds you to run `npm run build` before committing.
//
// It never touches queue/ or drafts/ — those belong to the collector.
import fs from "node:fs";
import path from "node:path";
import { validateNews, similarity } from "./validate-news.js";

const root = process.cwd();
const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/publish.js <draft.json>");
  process.exit(1);
}
const draftPath = path.resolve(arg);
if (!fs.existsSync(draftPath)) {
  console.error(`Draft file not found: ${draftPath}`);
  process.exit(1);
}
let draft;
try {
  draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
} catch (err) {
  console.error(`Draft file is not valid JSON: ${err.message}`);
  process.exit(1);
}

const NEWS_FILE = path.join(root, "news.json");
const records = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));

// --- basic checks before validation -----------------------------------
const problems = [];
for (const field of ["slug", "title", "category", "date", "excerpt", "source"]) {
  if (!String(draft[field] ?? "").trim()) problems.push(`missing required field "${field}"`);
}
if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
if (records.some((r) => r.slug === draft.slug)) {
  console.error(`ERROR: slug "${draft.slug}" already exists in news.json`);
  process.exit(1);
}
for (const r of records) {
  const score = similarity(draft.title, r.title);
  if (score >= 0.82) {
    console.error(`ERROR: title is a near-duplicate of existing "${r.title}" (score ${score.toFixed(2)})`);
    process.exit(1);
  }
  if (score >= 0.68) {
    console.log(`WARN: title similar to "${r.title}" (score ${score.toFixed(2)}) — confirm it is a distinct story`);
  }
}

const bodyHtml = draft.bodyHtml
  ?? (draft.bodyFile ? fs.readFileSync(path.resolve(draft.bodyFile), "utf8") : null);
if (!bodyHtml || !bodyHtml.trim()) {
  console.error('ERROR: provide "bodyHtml" or "bodyFile" with the story body');
  process.exit(1);
}

const record = {
  slug: draft.slug,
  title: draft.title,
  url: `/${draft.slug}.html`,
  body: `articles/${draft.slug}.body.html`,
  category: draft.category,
  type: draft.type || "News",
  date: draft.date,
  status: "published",
  excerpt: draft.excerpt,
  ...(draft.dek ? { dek: draft.dek } : {}),
  editor: draft.editor || "NationalNews.pk Desk",
  source: draft.source,
  ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
  ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
  imageLabel: draft.imageLabel || draft.category?.toUpperCase(),
  ...(draft.seoTitle ? { seoTitle: draft.seoTitle } : {}),
  ...(draft.seoDescription ? { seoDescription: draft.seoDescription } : {}),
};

// --- write body first (validator requires it on disk), validate, then index.
// On any validation error the body file is removed again (rollback).
const bodyFile = path.join(root, "articles", `${record.slug}.body.html`);
fs.writeFileSync(bodyFile, bodyHtml.endsWith("\n") ? bodyHtml : `${bodyHtml}\n`);

const candidate = [...records, record];
const { errors, warnings } = validateNews(candidate, { root });
for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length) {
  fs.rmSync(bodyFile, { force: true });
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error("Validation FAILED — nothing was written.");
  process.exit(1);
}

records.push(record);
fs.writeFileSync(NEWS_FILE, `${JSON.stringify(records, null, 2)}\n`);

console.log(`OK: published "${record.title}"`);
console.log(`  body -> ${path.relative(root, bodyFile)}`);
console.log(`  url  -> ${record.url}`);
console.log("Next: npm run build, then commit news.json + articles/ and push.");
