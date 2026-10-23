// One-off backfill: fetch og:image (or twitter:image) from each published
// story's original source URL and record it as imageUrl, so the existing
// stories get thumbnails/hero images without waiting for a new collection.
// Images stay HOTLINKED to the publisher's CDN; imageCredit records the
// publisher so attribution stays honest.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NEWS_FILE = path.join(root, "news.json");
const records = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));

const UA = "Mozilla/5.0 (compatible; NationalNewsPkBot/1.0; +https://nationalnews.pk)";
const done = [];

for (const rec of records) {
  if (rec.imageUrl || !rec.sourceUrl) continue;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(rec.sourceUrl, {
      signal: ctl.signal,
      headers: { "User-Agent": UA, "Accept": "text/html" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const og = /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i.exec(html)
      || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i.exec(html)
      || /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
    const raw = og?.[1];
    if (!raw) throw new Error("no og:image in HTML");
    const url = raw.startsWith("http") ? raw : new URL(raw, rec.sourceUrl).href;
    if (!/^https?:\/\//i.test(url)) throw new Error(`non-absolute url: ${url}`);
    rec.imageUrl = url;
    rec.imageAlt = rec.title;
    rec.imageCredit = new URL(rec.sourceUrl).hostname.replace(/^www\./, "");
    done.push(`${rec.slug} -> ${url}`);
  } catch (e) {
    done.push(`${rec.slug} -> SKIP (${e.message})`);
  }
}

fs.writeFileSync(NEWS_FILE, `${JSON.stringify(records, null, 2)}\n`);
console.log(done.join("\n"));
console.log(`\nBackfill complete: ${done.filter((d) => !d.includes("SKIP")).length}/${records.length} record(s) updated.`);
