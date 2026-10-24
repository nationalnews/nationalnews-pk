// Generates dist/rss.xml and dist/sitemap.xml from the central news index.
import fs from "node:fs";
import path from "node:path";
import {
  SITE_URL, SITE_NAME, CATEGORIES, escapeHtml, toRfc1123,
  publishedOnly, sortByDateDesc, articleUrl,
} from "./site-config.js";

const BASE_PAGES = [
  { loc: "/", priority: "1.0" },
  { loc: "/latest.html", priority: "0.9" },
  ...CATEGORIES.map((c) => ({ loc: `/${c.file}`, priority: "0.8" })),
  { loc: "/about.html", priority: "0.4" },
  { loc: "/editorial-policy.html", priority: "0.4" },
  { loc: "/privacy-policy.html", priority: "0.3" },
];

export function buildRss(root, outDir, records) {
  const items = sortByDateDesc(publishedOnly(records)).slice(0, 30);
  const rssItems = items.map((r) => `  <item>
    <title>${escapeHtml(r.title)}</title>
    <link>${SITE_URL}${escapeHtml(articleUrl(r))}</link>
    <guid isPermaLink="true">${SITE_URL}${escapeHtml(articleUrl(r))}</guid>
    <pubDate>${toRfc1123(r.date)}</pubDate>
    <category>${escapeHtml(r.category)}</category>
    <description>${escapeHtml(r.excerpt)}</description>
  </item>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>News and explainers from ${escapeHtml(SITE_NAME)} — Pakistan Ki Awaz. Stories are published after source checks and editorial review.</description>
    <language>en-pk</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(outDir, "rss.xml"), xml);
  console.log(`Generated rss.xml with ${items.length} item(s).`);
}

// Google News sitemap — articles published in the last 48 hours only
// (Google's requirement for the News tab). Older stories remain in
// sitemap.xml. Safe to submit both in Search Console.
export function buildNewsSitemap(root, outDir, records) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const items = sortByDateDesc(publishedOnly(records))
    .filter((r) => r.body) // real article pages only
    .map((r) => ({ r, dt: new Date(`${r.date}T00:00:00+05:00`) }))
    .filter(({ dt }) => !Number.isNaN(dt.getTime()) && dt.getTime() >= cutoff);
  const urls = items.map(({ r, dt }) => `  <url>
    <loc>${SITE_URL}${escapeHtml(articleUrl(r))}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeHtml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${dt.toISOString()}</news:publication_date>
      <news:title>${escapeHtml(r.title)}</news:title>
    </news:news>
  </url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
  fs.writeFileSync(path.join(outDir, "news-sitemap.xml"), xml);
  console.log(`Generated news-sitemap.xml with ${items.length} article(s) from the last 48h.`);
}

export function buildSitemap(root, outDir, records) {
  const articles = sortByDateDesc(publishedOnly(records)).map((r) => ({
    loc: articleUrl(r),
    lastmod: r.date,
  }));
  const urls = [
    ...BASE_PAGES.map((p) => `  <url><loc>${SITE_URL}${p.loc}</loc><priority>${p.priority}</priority></url>`),
    ...CATEGORIES.map((c) => `  <url><loc>${SITE_URL}/${c.file}</loc><priority>0.8</priority></url>`),
    ...articles.map((a) => `  <url><loc>${SITE_URL}${escapeHtml(a.loc)}</loc><lastmod>${a.lastmod}</lastmod><priority>0.7</priority></url>`),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
  console.log(`Generated sitemap.xml with ${BASE_PAGES.length + CATEGORIES.length + articles.length} URL(s).`);
}
