// Generates individual article pages from body fragments in articles/.
// Each record with a "body" field (e.g. "articles/my-story.body.html") gets a
// full page at /<slug>.html using the shared site template, with source
// attribution, canonical URL and related stories from the same section.
import fs from "node:fs";
import path from "node:path";
import { page } from "./template.js";
import {
  SITE_URL, escapeHtml, formatDateLabel, formatDateLong,
  publishedOnly, sectionKeyFor, sortByDateDesc, articleUrl,
} from "./site-config.js";

const ARTICLE_CSS = `
.article-body{max-width:760px}
.article-body p{margin:0 0 16px;font-size:16px}
.article-body h2{font:700 24px Georgia,serif;margin:28px 0 12px}
.article-body ul{margin:0 0 16px;padding-left:22px}
.article-body li{margin-bottom:8px}
.article-body a{color:#075b3b;text-decoration:underline}
.dek{font-size:19px;color:#4f5551;line-height:1.55;margin:0 0 14px}
.byline{font-size:12px;color:#727a75;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:22px}
.source-box{background:var(--wash);border-left:4px solid var(--green);padding:14px 16px;margin:26px 0;font-size:13px;color:#3c4540}
.related{margin-top:36px}
.related .story p{margin:0}
`;

export function buildArticles(root, outDir, records) {
  const published = sortByDateDesc(publishedOnly(records));
  const generated = [];
  for (const record of published) {
    if (!record.body) continue;
    const bodyFile = path.join(root, record.body);
    if (!fs.existsSync(bodyFile)) continue;
    const bodyHtml = fs.readFileSync(bodyFile, "utf8").trim();
    const url = articleUrl(record);
    const title = record.seoTitle || `${record.title} | NationalNews.pk`;
    const description = record.seoDescription || record.excerpt;
    const dek = record.dek || "";
    const byline = [
      `Published: ${formatDateLong(record.date)}`,
      record.editor ? `· ${escapeHtml(record.editor)}` : "",
      `· ${escapeHtml(record.category)}${record.type ? ` · ${escapeHtml(record.type)}` : ""}`,
    ].filter(Boolean).join(" ");

    const sourceBox = `<div class="source-box"><strong>Source:</strong> ${escapeHtml(record.source)}${record.sourceUrl
      ? ` · <a href="${escapeHtml(record.sourceUrl)}" rel="noopener noreferrer" target="_blank">Original report</a>` : ""}${record.retrievedAt
      ? ` · Retrieved ${escapeHtml(record.retrievedAt)}` : ""}</div>`;

    const related = published.filter((r) =>
      r.slug !== record.slug && r.body && sectionKeyFor(r) === sectionKeyFor(record)).slice(0, 3);
    const relatedHtml = related.length
      ? `<div class="related"><h2 class="section">Related in ${escapeHtml(record.category)}</h2>${related.map((r) => `
<article class="story"><div class="art" aria-hidden="true">${escapeHtml(r.imageLabel || r.category)}</div>
<div><span class="eyebrow">${escapeHtml(r.category)}</span><h2><a href="${escapeHtml(articleUrl(r))}">${escapeHtml(r.title)}</a></h2>
<div class="meta">${escapeHtml(r.dateLabel || formatDateLabel(r.date))} · Source: ${escapeHtml(r.source)}</div></div></article>`).join("")}</div>`
      : "";

    const html = page({
      title,
      description,
      path: url,
      canonical: `${SITE_URL}${url}`,
      crumb: escapeHtml(record.category),
      introHtml: `<article class="article-body"><span class="eyebrow">${escapeHtml(record.category)}${record.type ? ` · ${escapeHtml(record.type)}` : ""}</span>
<h1>${escapeHtml(record.title)}</h1>
${dek ? `<p class="dek">${escapeHtml(dek)}</p>` : ""}
<p class="byline">${byline}</p>`,
      contentHtml: `${bodyHtml}${sourceBox}${relatedHtml}</article>`,
      extraHead: `<style>${ARTICLE_CSS}</style>`,
    });
    fs.writeFileSync(path.join(outDir, `${record.slug}.html`), html);
    generated.push(url);
    console.log(`Generated article ${url}`);
  }
  return generated;
}
