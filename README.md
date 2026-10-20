# NationalNews.pk — preview site

A lightweight, responsive static homepage prepared for Cloudflare Pages.

## Current status
- Static preview UI and responsive layouts.
- Placeholder copy is explicitly labeled and is not current news.
- Newsletter form is a non-collecting demo; it does not submit or store email.
- No live RSS, database, editorial dashboard, analytics or ad integrations yet.

## Deploy on Cloudflare Pages
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

The build script copies the static files into `dist`. No paid dependencies are required.

## Before public launch
1. Replace preview placeholders with verified, original stories and source attribution.
2. Confirm editorial, corrections, privacy and contact policies.
3. Implement the CMS/editorial review workflow before accepting public submissions.
4. Set up RSS ingestion and duplicate detection; do not auto-publish unverified or copied content.
5. Verify domain DNS and mail records before switching nameservers.
6. Test mobile, links, accessibility, metadata, sitemap and analytics choices.

## Domain
Cloudflare zone has been created for `nationalnews.pk` and is pending nameserver activation. Check the registrar and preserve existing DNS/email records before switching to the nameservers shown in the Cloudflare dashboard.
