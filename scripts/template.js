// Shared HTML template for generated pages (latest, category, article pages).
// All pages share the site design system: /assets/site.css (fonts, tokens,
// components). Category color accents are applied via data-cat attributes.
import {
  SITE_URL, SITE_NAME, escapeHtml, articleUrl,
} from "./site-config.js";

const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700;8..60,800&display=swap" rel="stylesheet">`;

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/latest.html", label: "Latest News" },
  { href: "/pakistan.html", label: "Pakistan" },
  { href: "/world.html", label: "World" },
  { href: "/business.html", label: "Business" },
  { href: "/sports.html", label: "Sports" },
  { href: "/about.html", label: "About us" },
];

function navHtml(currentPath) {
  return `<nav class="nav" aria-label="Main navigation"><div class="wrap"><div class="nav-inner">${NAV_ITEMS.map((item) => {
    const current = item.href === currentPath ? ' aria-current="page"' : "";
    return `<a href="${item.href}"${current}>${item.label}</a>`;
  }).join("")}</div></div></nav>`;
}

// Default social-share image: branded 1200x630 PNG (og:image does not
// support SVG, so every page needs a raster fallback).
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-cover.png`;

// Builds the Open Graph + Twitter card block shared by every page. Article
// pages pass ogType "article" plus publishedTime/section/image overrides;
// everything else uses the site-wide defaults.
export function seoHead({
  title, description, url, ogImage = null, ogType = "website",
  ogImageAlt = null, publishedTime = null, section = null, jsonLd = null,
}) {
  const image = ogImage || DEFAULT_OG_IMAGE;
  const imageAlt = ogImageAlt || `${SITE_NAME} — Pakistan Ki Awaz`;
  const parts = [
    // Google Search Console site ownership (meta-tag method, complements
    // the uploaded verification file googlecf8400cbc1fffc0b.html).
    `<meta name="google-site-verification" content="googlecf8400cbc1fffc0b">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:locale" content="en_PK">`,
    `<meta property="og:type" content="${escapeHtml(ogType)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ];
  if (publishedTime) {
    parts.push(`<meta property="article:published_time" content="${escapeHtml(publishedTime)}">`);
  }
  if (section) {
    parts.push(`<meta property="article:section" content="${escapeHtml(section)}">`);
  }
  if (jsonLd) {
    const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    for (const block of blocks) {
      parts.push(`<script type="application/ld+json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`);
    }
  }
  return parts.join("");
}

export function page({
  title, description, path = "/", canonical = null, crumb = null,
  introHtml = "", contentHtml = "", extraHead = "",
  ogImage = null, ogType = "website", ogImageAlt = null,
  publishedTime = null, section = null, jsonLd = null,
}) {
  const canon = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "";
  const crumbs = crumb
    ? `<div class="crumb"><a href="/">Home</a> / ${crumb}</div>` : "";
  const ogUrl = canonical || `${SITE_URL}${path}`;
  const social = seoHead({ title, description, url: ogUrl, ogImage, ogType, ogImageAlt, publishedTime, section, jsonLd });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#053f29"><meta name="robots" content="index, follow">
<meta name="description" content="${escapeHtml(description)}">
<title>${escapeHtml(title)}</title>${canon}
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)} RSS" href="/rss.xml">
${FONT_LINKS}<link rel="stylesheet" href="/assets/site.css">
${social}
${extraHead}</head><body>
<div class="topline"><div class="wrap"><span>Independent journalism · Pakistan</span><span>Facts first. Context always.</span></div></div>
<header class="wrap head"><a href="/" aria-label="${escapeHtml(SITE_NAME)} home"><img class="logo" src="/logo.svg" alt="${escapeHtml(SITE_NAME)} — Pakistan Ki Awaz"></a><div class="head-note"><strong>Facts first. Context always.</strong>Independent journalism · Clear sourcing</div></header>
${navHtml(path)}
<main class="wrap">${crumbs}${introHtml}${contentHtml}</main>
<footer class="footer"><div class="wrap footer-inner"><div><img class="footer-logo" src="/logo.svg" alt="${escapeHtml(SITE_NAME)} — Pakistan Ki Awaz"><p>Independent in spirit. Careful with facts. Built for readers.</p></div><div class="footer-links"><a href="/latest.html">Latest news</a> · <a href="/about.html">About</a> · <a href="/editorial-policy.html">Editorial policy</a> · <a href="/privacy-policy.html">Privacy policy</a> · <a href="/rss.xml">RSS</a> · <a href="mailto:editor@nationalnews.pk">Contact editor</a></div><p>© <span id="year"></span> ${escapeHtml(SITE_NAME)}. All rights reserved.</p></div></footer>
<script>document.getElementById('year').textContent=new Date().getFullYear()</script>
</body></html>`;
}

export function storyCard(record) {
  const url = escapeHtml(articleUrl(record));
  const category = escapeHtml(record.category);
  const type = escapeHtml(record.type || "News");
  const image = record.imageUrl
    ? `<img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.imageAlt || record.title)}">`
    : escapeHtml(record.imageLabel || record.category);
  const credit = record.imageCredit
    ? `<span class="meta">Image: ${escapeHtml(record.imageCredit)}</span>` : "";
  return `<article class="story" ${`data-cat="${category}"`}>
<div class="art" aria-hidden="true">${image}</div>
<div><span class="eyebrow">${category} · ${type}</span>
<h2><a href="${url}">${escapeHtml(record.title)}</a></h2>
<p>${escapeHtml(record.excerpt)}</p>
<div class="meta">${escapeHtml(record.dateLabel || record.date)} · Source: ${escapeHtml(record.source)}</div>
${credit}<p style="margin-top:12px"><a class="btn" href="${url}">Read story</a></p></div></article>`;
}
