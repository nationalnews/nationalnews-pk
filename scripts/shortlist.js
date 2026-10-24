// Editor shortlist CLI — Step 3 of the automation roadmap.
//
// Turns the raw collection queue (queue/candidates.json) into a short,
// readable shortlist so the editor can decide what to publish in seconds.
// Read-only: this tool NEVER writes to the queue, drafts or news.json.
//
// Usage:
//   npm run shortlist                                # top 12 clear candidates
//   npm run shortlist -- --category sports --limit 5
//   npm run shortlist -- --source BBC --days 2
//   npm run shortlist -- --safety all                # include review-flagged
//   npm run shortlist -- --id <candidateId>          # full detail + draft skeleton
//   npm run shortlist -- --json                      # machine-readable output
//
// Options:
//   --category <name>   filter by suggested category (e.g. Pakistan, Sports)
//   --source <substr>   filter by source name substring
//   --days <n>          only candidates published within the last n days
//   --safety <mode>     "clear" (default) or "all" — "all" also shows
//                       review-flagged items (marked REVIEW; these need
//                       owner sign-off via publish.js --force after review)
//   --limit <n>         max rows (default 12)
//   --id <id>           show one candidate in full with a starter draft JSON
//   --json              print filtered candidates as JSON instead of a table
import fs from "node:fs";
import path from "node:path";
import { assessSafety } from "./safety-filter.js";

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}
const hasFlag = (name) => args.includes(name);

const root = process.cwd();
const file = path.join(root, "queue", "candidates.json");
if (!fs.existsSync(file)) {
  console.error("No queue found. Run: npm run collect");
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const candidates = Array.isArray(raw) ? raw : raw.candidates || [];

// ---- filters -----------------------------------------------------------
let list = candidates.map((c) => {
  const a = assessSafety(`${c.headline} ${c.description || ""}`);
  return { ...c, safetyLevel: a.level, safetyTopics: a.reasons.map((r) => r.id) };
});

const category = arg("--category");
if (category) {
  const want = category.toLowerCase();
  list = list.filter((c) => String(c.suggestedCategory || "").toLowerCase() === want);
}
const source = arg("--source");
if (source) list = list.filter((c) => String(c.sourceName || "").toLowerCase().includes(source.toLowerCase()));
const days = Number(arg("--days") || 0);
if (days > 0) {
  const cutoff = Date.now() - days * 86400000;
  list = list.filter((c) => c.publishedAt && new Date(c.publishedAt).getTime() >= cutoff);
}
if (hasFlag("--safety") && arg("--safety") === "all") {
  // keep everything, review items visible but marked
} else {
  list = list.filter((c) => c.safetyLevel === "clear");
}

// newest first (undated items last)
list.sort((a, b) =>
  String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")) ||
  String(b.retrievedAt || "").localeCompare(String(a.retrievedAt || "")));

const limit = Number(arg("--limit") || 12);
list = list.slice(0, limit);

// ---- single-candidate detail ------------------------------------------
const id = arg("--id");
if (id) {
  const c = candidates.find((x) => x.id === id);
  if (!c) {
    console.error(`No candidate with id "${id}".`);
    process.exit(1);
  }
  const a = assessSafety(`${c.headline} ${c.description || ""}`);
  console.log(JSON.stringify({ ...c, safety: { level: a.level, topics: a.reasons.map((r) => r.id) } }, null, 2));
  console.log("\n--- starter draft skeleton (fill in after fact-checking, then publish) ---");
  console.log(JSON.stringify({
    slug: "your-slug-here",
    title: c.headline,
    category: c.suggestedCategory || "Pakistan",
    type: "News",
    date: (c.publishedAt || c.retrievedAt || "").slice(0, 10),
    excerpt: (c.description || "").slice(0, 180),
    dek: "",
    editor: "NationalNews.pk Desk",
    source: c.sourceName,
    sourceUrl: c.sourceUrl,
    imageUrl: c.imageUrl || undefined,
    imageAlt: c.imageAlt || undefined,
    imageCredit: c.imageCredit || undefined,
  }, null, 2));
  process.exit(0);
}

// ---- output -------------------------------------------------------------
if (hasFlag("--json")) {
  console.log(JSON.stringify(list, null, 2));
  process.exit(0);
}

if (!list.length) {
  console.log("No candidates match these filters. Try: npm run collect, or --safety all");
  process.exit(0);
}

const pad = (s, n) => String(s || "").slice(0, n).padEnd(n);
console.log(`Shortlist: ${list.length} candidate(s) (safety: ${hasFlag("--safety") ? "all" : "clear only"})\n`);
console.log(`${pad("#", 3)} ${pad("ID", 13)} ${pad("DATE", 11)} ${pad("CAT", 10)} ${pad("IMG", 4)} ${pad("SOURCE", 26)} HEADLINE`);
for (const [i, c] of list.entries()) {
  const flag = c.safetyLevel === "review" ? " [REVIEW]" : "";
  console.log(`${pad(i + 1, 3)} ${pad(c.id, 13)} ${pad((c.publishedAt || "").slice(0, 10), 11)} ${pad(c.suggestedCategory, 10)} ${pad(c.imageUrl ? "yes" : "-", 4)} ${pad(c.sourceName, 26)} ${c.headline}${flag}`);
  if (c.description) console.log(`${pad("", 3)} ${pad("", 13)} ${pad("", 11)} ${pad("", 10)} ${pad("", 4)} ${pad("", 26)} ${String(c.description).slice(0, 110)}`);
}
console.log("\nNext steps:");
console.log("  npm run shortlist -- --id <ID>      # full detail + draft skeleton");
console.log("  fact-check the source URL, write the story, then:");
console.log("  node scripts/publish.js <draft.json>   (add --force ONLY for review topics)");
