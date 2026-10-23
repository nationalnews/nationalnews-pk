// Collects candidate news items from reputable RSS sources listed in
// sources.json. Deterministic — no AI, no publishing. Output goes to
// queue/candidates.json ONLY; news.json is never touched by this script.
// Dedupe: against published stories, previous candidates, and within batch.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { similarity } from "./validate-news.js";
import { assessSafety, POLICY_VERSION } from "./safety-filter.js";

const root = process.cwd();
const QUEUE_DIR = path.join(root, "queue");
const CANDIDATES_FILE = path.join(QUEUE_DIR, "candidates.json");
const SEEN_FILE = path.join(QUEUE_DIR, "seen-links.json");
const LOG_FILE = path.join(QUEUE_DIR, "collect-log.json");
const USER_AGENT = "NationalNewsPkCollector/1.0 (+https://nationalnews.pk; contact editor@nationalnews.pk)";
const FETCH_TIMEOUT_MS = 12000;
const SOURCE_DELAY_MS = 1500;
const MAX_CANDIDATES = 120;
const SIMILARITY_THRESHOLD = 0.8;

const CATEGORY_KEYWORDS = {
  Business: ["economy", "imf", "inflation", "rupee", "state bank", "sbp", "stock", "psx", "budget", "trade", "export", "import", "market", "tax", "fbr", "gdp", "loan", " petrol", "dollar"],
  Sports: ["cricket", "pcb", "football", "hockey", "squash", "match", "tournament", "tournament", "league", "player", "coach", "world cup", "asia cup", "olympic"],
  World: ["gaza", "ukraine", "iran", "israel", "china", "india", "us ", "united states", "europe", "un ", "afghanistan", "saudi", "uae", "turkey", "global"],
  Pakistan: ["pakistan", "islamabad", "karachi", "lahore", "peshawar", "quetta", "punjab", "sindh", "balochistan", "khyber", "ispr", "ndma", "election commission", "national assembly", "senate", "chief justice"],
};

function suggestCategory(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let best = { category: "World", score: 0 };
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
    if (score > best.score) best = { category, score };
  }
  return best.category; // World is the neutral default
}

function shortId(link) {
  return crypto.createHash("sha1").update(link).digest("hex").slice(0, 12);
}

function stripCdata(text = "") {
  return String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tagContent(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return m ? stripCdata(m[1]) : "";
}

function linkFromBlock(block) {
  // RSS <link>text</link> or Atom <link href="..."/>
  const atom = /<link[^>]*href="([^"]+)"[^>]*\/?>(?:\s*<\/link>)?/i.exec(block);
  if (atom && atom[1] && !atom[1].includes("</")) return atom[1].trim();
  return tagContent(block, "link");
}

// Pull the best available image for a feed item. Priority:
//   1. media:content with medium="image" or an image/* type (largest width wins)
//   2. media:thumbnail
//   3. enclosure with an image/* type
//   4. first <img src> inside content:encoded / description
//   5. Atom <link rel="enclosure" type="image/...">
// Returns an absolute http(s) URL or null. Images are HOTLINKED (no copying);
// build/templates render a text fallback whenever imageUrl is absent, so a
// dead image URL degrades gracefully instead of breaking layout.
function absoluteUrl(u) {
  if (!u) return null;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

function imageFromBlock(block) {
  const mediaContents = [...block.matchAll(/<media:content\b[^>]*>/gi)]
    .map((m) => {
      const tag = m[0];
      const url = absoluteUrl(/url="([^"]+)"/i.exec(tag)?.[1]);
      const medium = /medium="([^"]*)"/i.exec(tag)?.[1] || "";
      const type = /type="([^"]*)"/i.exec(tag)?.[1] || "";
      const width = parseInt(/width="(\d+)"/i.exec(tag)?.[1] || "0", 10);
      if (!url) return null;
      if (medium && medium !== "image" && !type.startsWith("image/")) return null;
      if (!medium && !type.startsWith("image/") && !width) return null;
      return { url, width };
    })
    .filter(Boolean);
  if (mediaContents.length) {
    mediaContents.sort((a, b) => b.width - a.width);
    return mediaContents[0].url;
  }
  const thumb = absoluteUrl(/<media:thumbnail\b[^>]*url="([^"]+)"/i.exec(block)?.[1]);
  if (thumb) return thumb;
  const enclosure = block.match(/<enclosure\b[^>]*type="image\/[^"]*"[^>]*>/i)
    || block.match(/<enclosure\b[^>]*url="([^"]+)"[^>]*>/i);
  if (enclosure) {
    const tag = enclosure[0];
    const type = /type="([^"]*)"/i.exec(tag)?.[1] || "image/";
    const url = absoluteUrl(/url="([^"]+)"/i.exec(tag)?.[1]);
    if (url && type.startsWith("image/")) return url;
  }
  const inline = /<img\b[^>]*src=["']([^"']+)["']/i.exec(block);
  if (inline) return absoluteUrl(inline[1]);
  const atomEnc = /<link\b[^>]*rel="enclosure"[^>]*type="image\/[^"]*"[^>]*href="([^"]+)"/i.exec(block)
    || /<link\b[^>]*rel="enclosure"[^>]*href="([^"]+)"[^>]*type="image\/[^"]*"/i.exec(block);
  if (atomEnc) return absoluteUrl(atomEnc[1]);
  return null;
}

function parseFeed(xml, source) {
  const sourceName = source.name;
  // Some publishers (e.g. Geo) hotlink-protect their images (redirect to
  // homepage), which would break cards in browsers. sources.json can set
  // "images": false per source to skip image extraction entirely.
  const wantImages = source.images !== false;
  const items = [];
  const isAtom = /<feed[\s>]/i.test(xml);
  const blocks = isAtom
    ? xml.split(/<entry[\s>]/i).slice(1).map((b) => b.split(/<\/entry>/i)[0])
    : xml.split(/<item[\s>]/i).slice(1).map((b) => b.split(/<\/item>/i)[0]);
  for (const block of blocks) {
    const title = tagContent(block, "title");
    const link = linkFromBlock(block);
    if (!title || !link) continue;
    const published = tagContent(block, "pubDate") || tagContent(block, "published")
      || tagContent(block, "updated") || "";
    const description = tagContent(block, "description") || tagContent(block, "summary");
    let publishedAt = null;
    if (published) {
      const d = new Date(published);
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }
    items.push({
      id: shortId(link), sourceName, sourceUrl: link,
      headline: title, description: description.slice(0, 600),
      publishedAt, retrievedAt: new Date().toISOString(),
      suggestedCategory: suggestCategory(title, description),
      ...(wantImages ? {
        imageUrl: imageFromBlock(block),
        imageAlt: title,
        imageCredit: sourceName,
      } : {}),
    });
  }
  return items;
}

async function fetchFeed(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text(), source);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
  const { sources } = JSON.parse(fs.readFileSync(path.join(root, "sources.json"), "utf8"));
  const enabled = sources.filter((s) => s.enabled);
  console.log(`Collecting from ${enabled.length} enabled source(s)...`);

  const published = JSON.parse(fs.readFileSync(path.join(root, "news.json"), "utf8"));
  const publishedTitles = published.map((r) => r.title);
  const seenLinks = fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")) : [];
  const seenSet = new Set(seenLinks);

  const previous = fs.existsSync(CANDIDATES_FILE)
    ? JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8")) : [];
  const previousByLink = new Map(previous.map((c) => [c.sourceUrl, c]));

  let safetyBlockedCount = 0;
  const batch = [];
  const sourceResults = [];
  for (const source of enabled) {
    try {
      const items = await fetchFeed(source);
      batch.push(...items);
      sourceResults.push({ source: source.name, ok: true, items: items.length });
      console.log(`  OK  ${source.name}: ${items.length} item(s)`);
    } catch (err) {
      sourceResults.push({ source: source.name, ok: false, error: err.message });
      console.log(`  ERR ${source.name}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, SOURCE_DELAY_MS));
  }

  const failedAll = sourceResults.every((r) => !r.ok);
  if (failedAll && enabled.length > 0) {
    console.error("COLLECTION FAILED: every enabled source errored. No queue update.");
    fs.writeFileSync(LOG_FILE, JSON.stringify({ runAt: new Date().toISOString(), sourceResults, candidates: 0, note: "all sources failed" }, null, 2));
    process.exit(1);
  }

  // Dedupe: existing queue + published titles + within batch + seen links.
  const merged = [];
  const batchTitles = [];
  const batchLinks = new Set();
  for (const item of batch) {
    if (batchLinks.has(item.sourceUrl)) continue;
    batchLinks.add(item.sourceUrl);
    const dupPublished = publishedTitles.some((t) => similarity(t, item.headline) >= SIMILARITY_THRESHOLD);
    const dupBatch = batchTitles.some((t) => similarity(t, item.headline) >= SIMILARITY_THRESHOLD);
    if (dupPublished || dupBatch) continue;
    batchTitles.push(item.headline);
    // Safety Guard: assess BEFORE queueing. Blocked items (graphic gore,
    // incitement, blasphemy) are dropped entirely — they are not even
    // stored in the public repo. Review-level items are kept but tagged.
    const safety = assessSafety(`${item.headline} ${item.description || ""}`);
    if (safety.level === "blocked") {
      safetyBlockedCount += 1;
      continue;
    }
    const tagged = safety.level === "review" ? { ...item, safety } : item;
    const prior = previousByLink.get(item.sourceUrl);
    merged.push({ ...tagged, firstSeenAt: prior?.firstSeenAt || item.retrievedAt });
  }
  // Keep previously queued items not superseded by fresher batch, cap total.
  // Defensive: re-assess retained items so an old policy would still apply.
  const batchLinksFinal = new Set(merged.map((c) => c.sourceUrl));
  const retained = previous
    .filter((c) => !batchLinksFinal.has(c.sourceUrl))
    .filter((c) => assessSafety(`${c.headline} ${c.description || ""}`).level !== "blocked");
  const candidates = [...merged, ...retained].slice(0, MAX_CANDIDATES);
  const reviewQueued = candidates.filter((c) => c.safety?.level === "review").length;

  const newLinks = candidates.map((c) => c.sourceUrl);
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 2));
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...new Set([...seenLinks, ...batchLinks])].slice(-2000), null, 2));
  fs.writeFileSync(LOG_FILE, JSON.stringify({
    runAt: new Date().toISOString(),
    sourceResults,
    freshCandidates: merged.length,
    totalQueued: candidates.length,
    safety: { policyVersion: POLICY_VERSION, blockedDropped: safetyBlockedCount, reviewFlagged: reviewQueued },
  }, null, 2));

  console.log(`Collection done: ${merged.length} new candidate(s), ${candidates.length} total in queue.`);
  console.log(`Safety Guard (policy v${POLICY_VERSION}): ${safetyBlockedCount} blocked item(s) dropped, ${reviewQueued} review-flagged item(s) in queue.`);
  console.log("NOTE: candidates are suggestions only. Nothing is published until an editor adds it to news.json after review.");
}

main().catch((err) => {
  console.error(`COLLECTION FAILED: ${err.message}`);
  process.exit(1);
});
