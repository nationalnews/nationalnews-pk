// Adds/refreshes the Open Graph + Twitter + JSON-LD head block on the
// hand-maintained static pages (index, about, editorial policy, privacy,
// safety policy, 404). Idempotent: everything the tool manages sits between
// <!--SEO:START--> and <!--SEO:END--> markers and is regenerated on each run.
// Generated pages (latest/categories/articles) get the same block at build
// time from template.js — this script only covers files copied verbatim.
import fs from "node:fs";
import path from "node:path";
import { seoHead } from "./template.js";
import { SITE_URL } from "./site-config.js";

const root = process.cwd();

const PAGES = [
  { file: "index.html", jsonLd: [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "NationalNews.pk",
      alternateName: "Pakistan Ki Awaz",
      url: SITE_URL,
      inLanguage: "en-PK",
    },
    {
      "@context": "https://schema.org",
      "@type": "NewsMediaOrganization",
      name: "NationalNews.pk",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
      slogan: "Facts first. Context always.",
    },
  ] },
  { file: "about.html" },
  { file: "editorial-policy.html" },
  { file: "privacy-policy.html" },
  { file: "safety-policy.html" },
  { file: "404.html" },
];

const START = "<!--SEO:START-->";
const END = "<!--SEO:END-->";

let updated = 0;
for (const { file, jsonLd } of PAGES) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    console.log(`skip ${file} (missing)`);
    continue;
  }
  let html = fs.readFileSync(p, "utf8");

  // strip previous block if present
  const markerRe = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, "i");
  if (markerRe.test(html)) html = html.replace(markerRe, "");

  // extract existing title + description for og:title/og:description
  const t = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const d = /<meta\s+name="description"\s+content="([\s\S]*?)"\s*>/i.exec(html)?.[1] || "";
  const title = (t || "NationalNews.pk — Pakistan Ki Awaz").replace(/<\/?[^>]+>/g, "");

  // og:url must match the page's canonical if present, else SITE_URL/file
  const canon = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html)?.[1]
    || (file === "index.html" ? `${SITE_URL}/` : `${SITE_URL}/${file}`);

  const block = `${START}${seoHead({ title, description: d, url: canon, jsonLd: jsonLd || null })}${END}`;

  // insert after the canonical link if present, else after <title>
  if (/<link\s+rel="canonical"[^>]*>/i.test(html)) {
    html = html.replace(/(<link\s+rel="canonical"[^>]*>)/i, `$1\n${block}`);
  } else {
    html = html.replace(/(<title>[\s\S]*?<\/title>)/i, `$1\n${block}`);
  }
  fs.writeFileSync(p, html);
  updated += 1;
  console.log(`SEO head refreshed: ${file}`);
}
console.log(`Done: ${updated} static page(s) updated.`);
