# AI Drafting — Setup Guide

Drafting is the OPTIONAL step where an AI model reads a fresh RSS candidate
and prepares a structured draft proposal (headline, summary, claims to
verify) for a human editor. **Nothing a draft produces is ever published
automatically** — an editor must fact-check it and run `publish.js`.

The drafting script is `scripts/draft-news.js`. It runs automatically inside
the "Collect news candidates" workflow, twice a day (08:00 and 16:00
Pakistan time), AFTER collection. With no credentials configured it prints
"DRAFTING SKIPPED" and the workflow still succeeds.

## Status of free/no-key options (checked 24 October 2026)

| Option | Status |
| --- | --- |
| GitHub Models (`models.github.ai`) | **RETIRED 30 July 2026.** Every request now returns a plain-text "OK" with no JSON body. Do not use. |
| Copilot CLI in Actions | **Not available on this account.** Live test on 24 Oct 2026 failed: "Your Copilot subscription does not include this feature". Enabling Copilot (possibly the free tier) at <https://github.com/settings/copilot> may unlock it later. |
| OpenAI-compatible API key | **Works today.** Any provider with a `/chat/completions` endpoint. |

## Recommended: set the three secrets (2 minutes)

1. Get an API key from any OpenAI-compatible provider, for example:
   - Z.ai — <https://api.z.ai> (base: `https://api.z.ai/api/paas/v4`, model: `glm-4-flash`)
   - OpenRouter — <https://openrouter.ai> (base: `https://openrouter.ai/api/v1`)
   - Groq — <https://console.groq.com> (base: `https://api.groq.com/openai/v1`)
2. Repo → **Settings → Secrets and variables → Actions → New repository secret**
3. Add all three:
   - `DRAFT_API_KEY` — the API key
   - `DRAFT_API_BASE` — provider base URL (no trailing slash)
   - `DRAFT_API_MODEL` — the model id (e.g. `glm-4-flash`)
4. Run the "Collect news candidates" workflow (Actions tab → Run workflow)
   or wait for the next scheduled run. Drafts appear in `drafts/`.

Cost note: `DRAFT_MAX=3` means at most 3 short model calls per run,
6 per day — a few thousand tokens. Any free tier covers it comfortably.

## What a draft looks like

See `drafts/03f6f3335a71.json` for a real example (prepared by the
assistant in-session on 24 October 2026 while no API key was configured).
Each draft contains:

- `draft.suggestedHeadline` / `category` / `summary` — the proposal
- `draft.claimsToVerify` — every factual claim the editor must check
- `draft.verificationNotes` — what is uncertain
- `draft.isSensitive` — flag for topics needing extra care

## Editor workflow for a draft

1. Read the draft and open `candidate.sourceUrl`.
2. Verify every item in `claimsToVerify` against primary sources.
3. Write the story body (`articles/<slug>.body.html`) — original text with
   attribution, per `PUBLISHING-GUIDE.md`.
4. Publish: `node scripts/publish.js <draft.json>` (the Safety Guard still
   gates every publish; `--force` is reserved for review topics the owner
   has personally read).
