# NationalNews.pk — preview site

A lightweight, responsive static homepage prepared for Cloudflare Pages.

## Current status
- Static preview UI and responsive layouts; original logo in header and footer.
- Data-driven publishing: `news.json` is the central story index; build
  generates Latest News, the four section pages, article pages, `rss.xml`
  and `sitemap.xml` from it. See **PUBLISHING-GUIDE.md** for the exact
  workflow to add, edit or unpublish a story.
- Scheduled RSS collection (GitHub Actions) fills `queue/` with candidate
  stories and optional AI drafts in `drafts/`. Nothing is auto-published —
  editorial approval before publishing is required by design.
- Newsletter form is a non-collecting demo; it does not submit or store email.

## Deploy on Cloudflare Pages
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

The build validates `news.json`, generates all data-driven pages, and runs an
internal link check. No paid dependencies are required.

## Before public launch
1. Replace preview placeholders with verified, original stories and source attribution.
2. Confirm editorial, corrections, privacy and contact policies.
3. Implement the CMS/editorial review workflow before accepting public submissions.
4. Set up RSS ingestion and duplicate detection; do not auto-publish unverified or copied content.
5. Verify domain DNS and mail records before switching nameservers.
6. Test mobile, links, accessibility, metadata, sitemap and analytics choices.

## Domain
Cloudflare zone has been created for `nationalnews.pk` and is pending nameserver activation. Check the registrar and preserve existing DNS/email records before switching to the nameservers shown in the Cloudflare dashboard.
