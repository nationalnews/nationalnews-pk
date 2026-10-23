// Owner tool: record a safety review approval for an already-published story.
//
// Background: stories published BEFORE the Safety Guard existed (or hand-added
// via the GitHub web editor) can carry review-level policy matches. build.js
// prints a visible warning for every such record until the owner records a
// personal approval. This tool writes the same safetyReviewed audit note that
// publish.js --force writes for new stories, so the warning turns into an
// honest "override recorded" line.
//
// Usage:
//   node scripts/safety-approve.js --slug <slug> [--note "..."] [--approvedBy "..."]
//
// Rules:
//   - blocked topics can NEVER be approved (no override exists, by design)
//   - clear records need no approval (nothing to approve)
//   - review records get safetyReviewed with the actual matched topics
import fs from "node:fs";
import path from "node:path";
import { assessSafety, safetyReport, POLICY_VERSION } from "./safety-filter.js";

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NEWS_FILE = path.join(root, "news.json");

const slug = arg("--slug");
const note = arg("--note") || "Owner reviewed the full story text and approved publication.";
const approvedBy = arg("--approvedBy") || "NationalNews.pk owner";

if (!slug) {
  console.error('Usage: node scripts/safety-approve.js --slug <slug> [--note "..."] [--approvedBy "..."]');
  process.exit(1);
}

const records = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
const rec = records.find((r) => r.slug === slug);
if (!rec) {
  console.error(`ERROR: no record with slug "${slug}" in news.json.`);
  process.exit(1);
}

let bodyText = "";
try {
  const raw = fs.readFileSync(path.join(root, rec.body), "utf8");
  // strip HTML tags so the assessment sees the same text build.js sees
  bodyText = raw.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
} catch {
  console.error(`ERROR: body file not readable: ${rec.body}`);
  process.exit(1);
}

const a = assessSafety([rec.title, rec.excerpt, rec.dek, bodyText].filter(Boolean).join("\n"));

if (a.level === "blocked") {
  console.error("APPROVAL REFUSED — BLOCKED TOPIC. Blocked content has no override, ever.");
  console.error(safetyReport(a).join("\n"));
  console.error("The only correct action is to unpublish this story (remove from news.json).");
  process.exit(1);
}
if (a.level === "clear") {
  console.log(`Nothing to approve: "${slug}" assesses as CLEAR under policy v${POLICY_VERSION}.`);
  if (rec.safetyReviewed) delete rec.safetyReviewed;
  fs.writeFileSync(NEWS_FILE, `${JSON.stringify(records, null, 2)}\n`);
  process.exit(0);
}

rec.safetyReviewed = {
  level: a.level,
  topics: a.reasons.map((r) => r.id),
  matched: a.reasons.map((r) => r.label),
  approvedBy,
  approvedAt: new Date().toISOString(),
  policyVersion: `v${POLICY_VERSION}`,
  note,
};

fs.writeFileSync(NEWS_FILE, `${JSON.stringify(records, null, 2)}\n`);
console.log(`OK: safetyReviewed recorded for "${slug}"`);
console.log(`  topics: ${rec.safetyReviewed.topics.join(", ")}`);
console.log(`  approved by: ${approvedBy}`);
console.log(`  note: ${note}`);
console.log("Next: npm run build (the review warning becomes an override record), then commit news.json.");
