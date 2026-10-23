// Validates news.json as the central news index. Usable as a module and CLI.
// Exit code 1 on any validation error, so builds and CI can fail fast.
import fs from "node:fs";
import path from "node:path";
import { VALID_CATEGORIES, CATEGORY_ALIASES } from "./site-config.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_TAGS = /<\s*(script|iframe|object|embed|style|link|meta)\b/i;
const UNSAFE_ATTR = /on[a-z]+\s*=/i;
const REQUIRED = ["slug", "title", "category", "date", "excerpt", "source", "status"];

function textProblems(field, value, errors, index) {
  if (FORBIDDEN_TAGS.test(value)) {
    errors.push(`record ${index}: "${field}" contains forbidden HTML tag`);
  }
  if (UNSAFE_ATTR.test(value)) {
    errors.push(`record ${index}: "${field}" contains inline event handler`);
  }
}

function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// Dice coefficient over character bigrams — cheap fuzzy title similarity.
export function similarity(a, b) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const x = norm(a); const y = norm(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) || 0) + 1);
    }
    return out;
  };
  const gx = grams(x); const gy = grams(y);
  let overlap = 0;
  for (const [g, n] of gx) if (gy.has(g)) overlap += Math.min(n, gy.get(g));
  return (2 * overlap) / (gx.size + gy.size);
}

export function validateNews(records, { root = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(records)) {
    return { errors: ["news.json must be a top-level JSON array"], warnings };
  }
  const seenSlugs = new Map();
  const seenTitles = [];

  records.forEach((r, i) => {
    for (const field of REQUIRED) {
      if (!String(r[field] ?? "").trim()) {
        errors.push(`record ${i} (${r.slug || "no slug"}): missing required field "${field}"`);
      }
    }
    if (r.slug && !SLUG.test(r.slug)) {
      errors.push(`record ${i}: slug "${r.slug}" must be lowercase letters/digits/hyphens`);
    }
    if (seenSlugs.has(r.slug)) {
      errors.push(`record ${i}: duplicate slug "${r.slug}" (also used by record ${seenSlugs.get(r.slug)})`);
    } else if (r.slug) {
      seenSlugs.set(r.slug, i);
    }
    if (r.date && !(ISO_DATE.test(r.date) && !Number.isNaN(Date.parse(`${r.date}T00:00:00Z`)))) {
      errors.push(`record ${i}: date "${r.date}" must be a valid ISO date (YYYY-MM-DD)`);
    }
    if (r.status && !["draft", "published"].includes(r.status)) {
      errors.push(`record ${i}: status must be "draft" or "published"`);
    }
    if (r.category && !VALID_CATEGORIES.includes(r.category)) {
      errors.push(`record ${i}: category "${r.category}" not allowed (use one of: ${VALID_CATEGORIES.join(", ")})`);
    }
    if (r.excerpt && r.excerpt.length > 400) {
      warnings.push(`record ${i}: excerpt is longer than 400 chars — shorten it for listings`);
    }
    if (r.title && r.title.length > 140) {
      warnings.push(`record ${i}: title is longer than 140 chars`);
    }
    for (const field of ["title", "excerpt", "source", "dek", "seoTitle", "seoDescription"]) {
      if (r[field]) textProblems(field, r[field], errors, i);
    }
    if (r.sourceUrl && !validHttpUrl(r.sourceUrl)) {
      errors.push(`record ${i}: sourceUrl "${r.sourceUrl}" must be a valid http(s) URL`);
    }
    if (r.imageUrl && !validHttpUrl(r.imageUrl)) {
      errors.push(`record ${i}: imageUrl "${r.imageUrl}" must be a valid http(s) URL`);
    }
    // URL check: generated articles are /<slug>.html; anything else must exist on disk.
    if (r.url) {
      if (!r.url.startsWith("/")) {
        errors.push(`record ${i}: url "${r.url}" must be site-absolute (start with "/")`);
      } else if (r.url !== `/${r.slug}.html`) {
        const file = path.join(root, "dist", r.url);
        if (!fs.existsSync(file)) {
          errors.push(`record ${i}: url "${r.url}" points to a file that does not exist in dist`);
        }
      }
    }
    // Body fragment check: if a record declares a body file it must exist.
    if (r.body && !fs.existsSync(path.join(root, r.body))) {
      errors.push(`record ${i}: body file "${r.body}" not found`);
    }
    if (r.title) {
      for (const prev of seenTitles) {
        const score = similarity(r.title, prev.title);
        if (score >= 0.82) {
          errors.push(`record ${i}: title is near-duplicate of record ${prev.index} ("${prev.title}")`);
        } else if (score >= 0.68) {
          warnings.push(`record ${i}: title similar to record ${prev.index} ("${prev.title}") — confirm it is a distinct story`);
        }
      }
      seenTitles.push({ title: r.title, index: i });
    }
  });

  return { errors, warnings };
}

export function sectionSummary(records) {
  const counts = {};
  for (const r of records) {
    const key = CATEGORY_ALIASES[r.category] || r.category || "uncategorised";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const file = path.join(root, "news.json");
  if (!fs.existsSync(file)) {
    console.error(`news.json not found at ${file}`);
    process.exit(1);
  }
  let records;
  try {
    records = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`news.json is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  const { errors, warnings } = validateNews(records, { root });
  for (const w of warnings) console.log(`WARN: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`Validation FAILED: ${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(`Validation OK: ${records.length} record(s), ${warnings.length} warning(s).`);
}
