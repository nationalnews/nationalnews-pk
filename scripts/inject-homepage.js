// Injects an auto-updated front page into the hand-maintained homepage
// (dist/index.html) at the <!--AUTO_HEADLINES--> marker. Built from
// news.json (newest published stories):
//   1 lead story (hero)  +  3 "Top stories" side list  +  4 card grid.
// If nothing is published, the marker is replaced with an honest empty
// panel and the homepage stays structurally intact.
import fs from "node:fs";
import path from "node:path";
import { escapeHtml, articleUrl } from "./site-config.js";

const HERO_COUNT = 1;

const catAttr = (r) => `data-cat="${escapeHtml(r.category)}"`;

function leadHtml(r) {
  const meta = escapeHtml(r.dateLabel || r.date || "");
  const heroImg = r.imageUrl
    ? `<figure class="lead-art"><img src="${escapeHtml(r.imageUrl)}" alt="${escapeHtml(r.imageAlt || r.title)}" loading="eager">${r.imageCredit ? `<figcaption>Image: ${escapeHtml(r.imageCredit)}</figcaption>` : ""}</figure>`
    : "";
  return `<a class="lead" ${catAttr(r)} href="${escapeHtml(articleUrl(r))}" aria-label="Read: ${escapeHtml(r.title)}">
${heroImg}
<span class="eyebrow">${escapeHtml(r.category)} · ${escapeHtml(r.type || "News")}</span>
<h1>${escapeHtml(r.title)}</h1>
<p>${escapeHtml(r.excerpt)}</p>
<span class="read-more">Read the full story</span>
<div class="lead-meta">${meta} · Source: ${escapeHtml(r.source)}</div>
</a>`;
}

function sideHtml(list) {
  if (!list.length) return "";
  const items = list
    .map((r, i) => `<article class="side-story" ${catAttr(r)}><div class="side-num">${String(i + 1).padStart(2, "0")}</div><div><h3><a href="${escapeHtml(articleUrl(r))}">${escapeHtml(r.title)}</a></h3><p>${escapeHtml(r.dateLabel || r.date || "")} · ${escapeHtml(r.source)}</p></div></article>`)
    .join("");
  return `<div class="side-stories"><div class="side-stories-title">Top stories</div>${items}</div>`;
}

function gridHtml(list) {
  if (!list.length) return "";
  const cards = list
    .map((r) => {
      const thumb = r.imageUrl
        ? `<div class="auto-card-art"><img src="${escapeHtml(r.imageUrl)}" alt="${escapeHtml(r.imageAlt || r.title)}" loading="lazy"></div>`
        : "";
      return `<article class="auto-card${r.imageUrl ? "" : " no-art"}" ${catAttr(r)}>${thumb}<span class="eyebrow">${escapeHtml(r.category)} · ${escapeHtml(r.type || "News")}</span><h3><a href="${escapeHtml(articleUrl(r))}">${escapeHtml(r.title)}</a></h3><p>${escapeHtml(r.excerpt)}</p><div class="meta">${escapeHtml(r.dateLabel || r.date || "")} · Source: ${escapeHtml(r.source)}</div></article>`;
    })
    .join("");
  return `<section class="auto-latest"><div class="section-heading"><h2>Latest news</h2><small>Updated automatically · <a href="/latest.html">See all</a></small></div><div class="auto-grid">${cards}</div></section>`;
}

export function injectHomepage(root, outDir, records) {
  const file = path.join(outDir, "index.html");
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, "utf8");
  const marker = "<!--AUTO_HEADLINES-->";
  if (!html.includes(marker)) return false;

  const published = records
    .filter((r) => r.status === "published")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  let section = "";
  let sideCount = 0, gridCount = 0;
  if (published.length) {
    // Adaptive layout: with plenty of stories show 1 hero + 3 top + 4 grid;
    // with fewer, shift stories from the side list into the grid so the
    // 2-column card row never holds a single orphan card.
    const total = published.length;
    const sideTarget = total >= 8 ? 3 : total >= 5 ? 2 : Math.min(3, total - 1);
    const gridTarget = total >= 8 ? 4 : total >= 5 ? 2 : Math.max(0, total - 1 - sideTarget);
    const lead = published.slice(0, HERO_COUNT);
    const side = published.slice(HERO_COUNT, HERO_COUNT + sideTarget);
    const grid = published.slice(HERO_COUNT + sideTarget, HERO_COUNT + sideTarget + gridTarget);
    sideCount = side.length;
    gridCount = grid.length;
    section = `<div class="hero-grid">${lead.map(leadHtml).join("")}${sideHtml(side)}</div>${gridHtml(grid)}`;
  } else {
    section = `<div class="empty"><strong>No stories have been published yet.</strong> The front page fills automatically from the central news index during the site build.</div>`;
  }

  fs.writeFileSync(file, html.replace(marker, section));
  console.log(`Homepage: injected lead + ${sideCount} top stories + ${gridCount} card(s).`);
  return true;
}
