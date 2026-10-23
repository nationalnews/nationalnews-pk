# NationalNews.pk — News Publishing Guide

This document explains how stories are published on NationalNews.pk, how the
automation assists editors, and exactly what commands to run. Read it once
before adding your first story.

## What this system is (and is not)

- It is a **git-based publishing workflow**: one central data file
  (`news.json`), one body file per article (`articles/`), and build scripts
  that generate every data-driven page.
- It is **not a full CMS** — there is no web dashboard or database. Editing
  happens in files; Cloudflare Pages builds and deploys after every push to
  `main`.
- **Nothing is auto-published.** The automation only *suggests* candidate
  stories and drafts. A story goes live only after an editor adds an approved
  record to `news.json` and pushes to `main`.

## File map

| Path | Purpose |
|------|---------|
| `news.json` | Central index of all stories (published and draft records) |
| `articles/<slug>.body.html` | Article body content (HTML fragments, no `<html>` wrapper) |
| `scripts/build.js` | Production build orchestrator (`npm run build`) |
| `scripts/validate-news.js` | Validates `news.json` (run automatically in build) |
| `scripts/collect-news.js` | RSS collector → writes `queue/candidates.json` only |
| `scripts/draft-news.js` | Optional AI drafts → writes `drafts/` only |
| `sources.json` | RSS sources the collector reads |
| `queue/` | Collected candidates (suggestions only, not published) |
| `drafts/` | AI-drafted proposals (suggestions only, not published) |
| `.github/workflows/` | Quality CI + scheduled collection |

## How to publish a new story

**Step 1 — Create the body file** `articles/my-story-slug.body.html`:

```html
<p>Opening paragraph with the key facts: what happened, where, when,
confirmed by which source.</p>
<p>Context and background. Explain the "why it matters".</p>
<h2>Subheading if needed</h2>
<p>More detail. Link to the original report where relevant.</p>
<h2>Source and attribution</h2>
<p>Based on <a href="https://original-source.example/report" rel="noopener noreferrer">Publisher's report (date)</a>.</p>
```

Rules: paragraphs and `<h2>`/`<ul>` only; no scripts, iframes, or inline
event handlers; never copy a full article from another publisher; always
attribute.

**Step 2 — Add the record to `news.json`** (keep valid JSON):

```json
{
  "slug": "my-story-slug",
  "title": "Factual headline, max ~120 characters",
  "category": "Pakistan",
  "type": "News",
  "date": "2026-10-24",
  "status": "published",
  "excerpt": "One or two sentences shown in listings (max 400 chars).",
  "dek": "Optional standfirst shown on the article page.",
  "editor": "Your name / News Desk",
  "source": "Human-readable source name",
  "sourceUrl": "https://original-source.example/report",
  "imageLabel": "LABEL",
  "seoTitle": "SEO headline | NationalNews.pk",
  "seoDescription": "Meta description up to ~160 characters."
}
```

Required fields: `slug`, `title`, `category`, `date`, `excerpt`, `source`,
`status`. Categories: `Pakistan`, `World`, `Business`, `Sports`,
`Politics` (shows on Pakistan page), `Technology` (shows on World page).
The article URL is always `/<slug>.html` — the slug is permanent, choose it
carefully. The body reference `"body": "articles/my-story-slug.body.html"`
enables page generation.

**Step 3 — Validate and preview locally:**

```bash
npm run build        # validates news.json, generates all pages, checks links
npm run validate     # validation only
```

If validation fails, the error message names the record and the problem.

**Step 4 — Publish:**

```bash
git add news.json articles/my-story-slug.body.html
git commit -m "Publish: my-story-slug"
git push origin main
```

Cloudflare Pages then builds and deploys automatically. Verify
https://nationalnews.pk afterwards (see "Verify a deployment" below).

## How to edit or unpublish a story

- **Edit:** change the record and/or body file, rebuild, push. The URL stays
  the same.
- **Unpublish:** set `"status": "draft"` (keeps history in the repo) or
  remove the record entirely. Push. The story disappears from all pages,
  RSS and sitemap on the next build. (Its URL will 404 — Cloudflare serves
  `404.html`.)
- **Fix an error after publishing:** edit, push, and add a correction note in
  the body per the editorial policy.

## What the build generates automatically

From `news.json` alone, `npm run build` regenerates:

1. `dist/latest.html` — all published stories, newest first
2. `dist/pakistan.html`, `dist/world.html`, `dist/business.html`,
   `dist/sports.html` — each shows only its own section's stories; sections
   with nothing published show an honest empty state
3. `dist/<slug>.html` — one page per story with a `body` file, including
   source attribution and related stories from the same section
4. `dist/rss.xml` — feed of the 30 newest published stories
5. `dist/sitemap.xml` — all pages plus every published article

Static pages (`index.html`, `about.html`, policies, `404.html`) are copied
as-is. A link checker fails the build if any internal link is broken.

## Automation: what it does and what it never does

**Scheduled collection** (GitHub Actions `collect-news.yml`, 08:00 & 16:00
PKT daily): reads `sources.json` RSS feeds, deduplicates against published
stories and past candidates, and commits suggestions to `queue/`. It never
writes `news.json`.

**Optional AI drafting**: if the repository secrets `DRAFT_API_KEY`,
`DRAFT_API_BASE`, `DRAFT_API_MODEL` are configured (Settings → Secrets and
variables → Actions), the same workflow asks an OpenAI-compatible model to
produce a structured draft — suggested headline, category, summary, and an
explicit list of claims an editor must verify. Drafts land in `drafts/`
marked `status: "draft"` with a mandatory-review disclaimer. Without the
secrets the step skips cleanly and costs nothing.

**Editorial approval (mandatory):** for every story — automated or manual —
an editor must verify the claims (especially anything sensitive: breaking
news, conflict, deaths, allegations, health, finance), confirm the source,
then move the approved record into `news.json` with a proper slug and body
file. The system has no path that publishes without this manual step.

**Enabling AI drafting** — cost notes: requests scale with `DRAFT_MAX` per
run × 2 runs/day; typical summarisation drafts are small (hundreds of tokens
in and out), so cost is minimal on free-tier or low-cost models. Start with
`DRAFT_MAX: "3"` and a low-cost model; increase only if the queue grows.
Never paste API keys into files, issues or chat — use GitHub Secrets only.

## Verify a deployment

1. Open https://nationalnews.pk and https://www.nationalnews.pk.
2. Check the new story appears on Latest News and its section page.
3. Confirm the article URL opens, the source link works, and RSS shows it
   (`/rss.xml`).
4. The Actions "Quality checks" run on your push should be green — it runs
   the same validation, build and link checks before/alongside deploy.

## Troubleshooting

| Error | Meaning | Fix |
|-------|---------|-----|
| `duplicate slug` | Two records share a slug | Slugs must be unique — rename one (and its URL) |
| `date ... must be a valid ISO date` | Wrong date format | Use `YYYY-MM-DD` |
| `title is near-duplicate of record N` | Possible repeat story | Confirm it is genuinely distinct, or merge/replace |
| `body file "articles/..." not found` | Missing fragment | Create the file at the exact path |
| `url ... does not exist in dist` | Custom URL points nowhere | Fix `url` or add the target file |
| Link check failure in build | Broken internal href/src | Correct the path in the named file |
