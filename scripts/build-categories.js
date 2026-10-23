// Generates the four section pages (Pakistan, World, Business & Economy,
// Sports) from the central news index. A record only appears on the section
// its category maps to — a Business story never appears under Pakistan.
// Sections with no published stories get an honest empty state.
import fs from "node:fs";
import path from "node:path";
import { page, storyCard } from "./template.js";
import {
  CATEGORIES, SITE_URL, escapeHtml, formatDateLabel,
  publishedOnly, sectionKeyFor, sortByDateDesc,
} from "./site-config.js";

export function buildCategories(root, outDir, records) {
  const published = sortByDateDesc(publishedOnly(records));
  const results = [];
  for (const cat of CATEGORIES) {
    const stories = published
      .filter((r) => sectionKeyFor(r) === cat.key)
      .map((r) => ({ ...r, dateLabel: r.dateLabel || formatDateLabel(r.date) }));

    const cards = stories.map(storyCard).join("\n");
    const heading = stories.length === 1 ? "Latest published story" : `Published stories (${stories.length})`;
    const emptyState = `<div class="empty"><strong>No published stories in this section yet.</strong> We add stories only after source checks and editorial review — we do not fill sections with unrelated or invented items. See <a href="/latest.html" style="color:#075b3b;text-decoration:underline">Latest News</a> for everything published so far.</div>`;
    const html = page({
      title: `${cat.name} | NationalNews.pk`,
      description: cat.intro,
      path: `/${cat.file}`,
      canonical: `${SITE_URL}/${cat.file}`,
      crumb: escapeHtml(cat.name),
      introHtml: `<section class="intro"><span class="eyebrow">${escapeHtml(cat.eyebrow)}</span><h1>${escapeHtml(cat.name)}</h1><p>${escapeHtml(cat.intro)}</p></section>`,
      contentHtml: stories.length
        ? `<h2 class="section">${heading}</h2>${cards}
<div class="note"><strong>Editorial note:</strong> Stories are drawn from the central news index at build time and appear only in the sections they belong to.</div>`
        : emptyState,
    });
    fs.writeFileSync(path.join(outDir, cat.file), html);
    results.push({ file: cat.file, stories: stories.length });
    console.log(`Generated ${cat.file} with ${stories.length} story(ies).`);
  }
  return results;
}
