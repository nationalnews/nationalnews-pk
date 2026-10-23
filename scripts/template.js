// Shared HTML template for generated pages (latest, category, article pages).
// Keeps the existing generated-page design language: same palette, header,
// navigation and footer already used by latest.html and the category pages.
import {
  SITE_URL, SITE_NAME, escapeHtml, articleUrl,
} from "./site-config.js";

const BASE_CSS = `
:root{--green:#075b3b;--red:#c62832;--ink:#181818;--muted:#6c7078;--line:#e7e7e7;--wash:#f5f7f5}
*{box-sizing:border-box}body{margin:0;color:var(--ink);font:16px/1.6 Arial,Helvetica,sans-serif}
a{color:inherit;text-decoration:none}.wrap{width:min(1060px,calc(100% - 32px));margin:auto}
.top{background:#171717;color:#eee;font-size:12px;padding:8px 0}
.head{padding:18px 0;display:flex;align-items:center;justify-content:space-between;gap:20px}
.logo{width:min(300px,65vw);height:auto}
.nav{background:var(--green);color:white}.nav .wrap{display:flex;gap:0;overflow:auto}
.nav a{padding:12px 14px;font-size:13px;font-weight:bold;white-space:nowrap}
.nav a:hover,.nav a[aria-current="page"]{background:#03432b}
main{padding:30px 0 55px}.crumb{font-size:12px;color:var(--muted);margin-bottom:12px}
.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--red);font-weight:bold}
.intro{padding:28px;background:var(--wash);border-left:4px solid var(--green);margin-bottom:28px}
.intro h1{font:700 clamp(32px,5vw,48px)/1.1 Georgia,serif;margin:6px 0 10px}
.intro p{color:#4f5551;max-width:700px;margin:0}
.section{border-bottom:2px solid var(--ink);padding-bottom:9px;margin-bottom:16px;font:700 24px Georgia,serif}
.story{display:grid;grid-template-columns:140px 1fr;gap:18px;padding:18px 0;border-bottom:1px solid var(--line)}
.art{background:linear-gradient(135deg,#a8c5b5,#075b3b);color:#fff;display:grid;place-items:center;min-height:110px;font:800 28px Georgia,serif;overflow:hidden}
.art img{width:100%;height:100%;object-fit:cover}
.story h2{font:700 23px/1.2 Georgia,serif;margin:5px 0 8px}
.story p{margin:0 0 10px;color:var(--muted);font-size:14px}
.meta{font-size:11px;color:#777}
.btn{display:inline-block;background:var(--green);color:#fff;padding:9px 13px;font-size:12px;font-weight:bold}
.note{background:#fff8f8;border:1px solid #efd5d6;padding:15px;margin-top:24px;font-size:13px;color:#6b2529}
.empty{padding:26px;background:var(--wash);border:1px dashed var(--line);color:#4f5551;font-size:14px}
.footer{background:#063d2b;color:#e8f2ec;border-top:4px solid var(--red);padding:26px 0;font-size:12px}
.footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.footer a{color:#e8f2ec;text-decoration:underline}
@media(max-width:560px){.head{align-items:flex-start;flex-direction:column}
.story{grid-template-columns:90px 1fr;gap:12px}.art{min-height:85px}
.story h2{font-size:19px}.intro{padding:20px}}
`;

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
  return `<nav class="nav" aria-label="Main navigation"><div class="wrap">${NAV_ITEMS.map((item) => {
    const current = item.href === currentPath ? ' aria-current="page"' : "";
    return `<a href="${item.href}"${current}>${item.label}</a>`;
  }).join("")}</div></nav>`;
}

export function page({
  title, description, path = "/", canonical = null, crumb = null,
  introHtml = "", contentHtml = "", extraHead = "",
}) {
  const canon = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "";
  const crumbs = crumb
    ? `<div class="crumb"><a href="/">Home</a> / ${crumb}</div>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#075b3b"><meta name="description" content="${escapeHtml(description)}">
<title>${escapeHtml(title)}</title>${canon}
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)} RSS" href="/rss.xml">
${extraHead}<style>${BASE_CSS}</style></head><body>
<div class="top"><div class="wrap">INDEPENDENT JOURNALISM · PAKISTAN</div></div>
<header class="wrap head"><a href="/" aria-label="${escapeHtml(SITE_NAME)} home"><img class="logo" src="/logo.svg" alt="${escapeHtml(SITE_NAME)} — Pakistan Ki Awaz"></a><strong>FACTS FIRST. CONTEXT ALWAYS.</strong></header>
${navHtml(path)}
<main class="wrap">${crumbs}${introHtml}${contentHtml}</main>
<footer class="footer"><div class="wrap"><span>© <span id="year"></span> ${escapeHtml(SITE_NAME)} · Independent in spirit. Careful with facts.</span><span><a href="/latest.html">Latest news</a> · <a href="/editorial-policy.html">Editorial policy</a> · <a href="/privacy-policy.html">Privacy policy</a> · <a href="/rss.xml">RSS</a> · <a href="mailto:editor@nationalnews.pk">Contact editor</a></span></div></footer>
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
  return `<article class="story">
<div class="art" aria-hidden="true">${image}</div>
<div><span class="eyebrow">${category} · ${type}</span>
<h2><a href="${url}">${escapeHtml(record.title)}</a></h2>
<p>${escapeHtml(record.excerpt)}</p>
<div class="meta">${escapeHtml(record.dateLabel || record.date)} · Source: ${escapeHtml(record.source)}</div>
${credit}<p><a class="btn" href="${url}">Read story →</a></p></div></article>`;
}
