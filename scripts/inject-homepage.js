// Injects an auto-updated "Latest news" strip into the hand-maintained
// homepage (dist/index.html). The homepage carries the marker
// <!--AUTO_HEADLINES-->; this script replaces it with a section built
// from news.json (newest published stories). If nothing is published,
// the marker is removed and the homepage stays exactly as authored.
import fs from "node:fs";
import path from "node:path";
import { escapeHtml, articleUrl } from "./site-config.js";

const MAX_ITEMS = 4;

export function injectHomepage(root, outDir, records) {
  const file = path.join(outDir, "index.html");
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, "utf8");
  const marker = "<!--AUTO_HEADLINES-->";
  if (!html.includes(marker)) return false;

  const published = records
    .filter((r) => r.status === "published")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, MAX_ITEMS);

  let section = "";
  if (published.length) {
    const style = `<style>.auto-latest{margin:0 0 34px}.auto-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.auto-card{border:1px solid var(--line);border-radius:4px;padding:16px}.auto-card h3{font:700 18px/1.25 Georgia,serif;margin:6px 0 8px}.auto-card h3 a:hover{color:var(--green)}.auto-card p{margin:0 0 9px;font-size:12.5px;color:var(--muted)}@media(max-width:760px){.auto-grid{grid-template-columns:1fr}}</style>`;
    const cards = published
      .map((r) => {
        const type = escapeHtml(r.type || "News");
        const meta = escapeHtml(r.dateLabel || r.date || "");
        return `<article class="auto-card"><span class="eyebrow">${escapeHtml(r.category)} · ${type}</span><h3><a href="${escapeHtml(articleUrl(r))}">${escapeHtml(r.title)}</a></h3><p>${escapeHtml(r.excerpt)}</p><div class="meta">${meta} · Source: ${escapeHtml(r.source)}</div></article>`;
      })
      .join("");
    section = `${style}<section class="auto-latest"><div class="wrap"><div class="section-heading"><h2>Latest news</h2><small>Updated automatically · <a href="/latest.html" style="color:var(--green)">See all</a></small></div><div class="auto-grid">${cards}</div></div></section>`;
  }

  fs.writeFileSync(file, html.replace(marker, section));
  console.log(`Homepage: injected ${published.length} headline(s).`);
  return true;
}
