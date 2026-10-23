// Generates dist/latest.html from published records in news.json.
import fs from "node:fs";
import path from "node:path";
import { page, storyCard } from "./template.js";
import { escapeHtml, formatDateLabel, publishedOnly, sortByDateDesc } from "./site-config.js";

export function buildLatest(root, outDir, records) {
  const published = sortByDateDesc(publishedOnly(records));
  const withLabels = published.map((r) => ({
    ...r,
    dateLabel: r.dateLabel || formatDateLabel(r.date),
  }));
  const cards = withLabels.map(storyCard).join("\n");
  const emptyState = `<div class="empty"><strong>No stories have been published yet.</strong> This page updates automatically from the central news index during the site build.</div>`;
  const html = page({
    title: "Latest News | NationalNews.pk",
    description: "Latest published news and explainers from NationalNews.pk, with clear sourcing and context.",
    path: "/latest.html",
    canonical: "https://nationalnews.pk/latest.html",
    crumb: '<a href="/latest.html">Latest News</a>',
    introHtml: `<section class="intro"><span class="eyebrow">Verified publishing list</span><h1>Latest News &amp; Explainers</h1><p>Stories are listed from one central data file during the site build. Dates, categories, summaries and story links are maintained together for consistent updates.</p></section>`,
    contentHtml: `<h2 class="section">Published stories</h2>${cards || emptyState}
<div class="note"><strong>Our standard:</strong> We do not create placeholder headlines to make the site look busy. Stories are added after sourcing and editorial checks.</div>`,
  });
  fs.writeFileSync(path.join(outDir, "latest.html"), html);
  console.log(`Generated latest.html from ${withLabels.length} published record(s).`);
  return withLabels.length;
}
