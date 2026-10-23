# Safety Guard — Content Policy (NationalNews.pk)

**Policy version:** v1 · **Owner:** site owner (nationalnews) · **Enforced by:** `scripts/safety-filter.js`

## Why this exists

NationalNews.pk publishes aggregated news. In Pakistan, some topics carry real
legal, regulatory or personal-safety risk when published without a deliberate
human decision by the site owner. The automation pipeline therefore never has
the final say on sensitive subjects. This document is the policy; the script
`safety-filter.js` is its enforcement. Changing the keyword lists in that file
IS a change of editorial policy — do it consciously, and record why.

## The three levels

| Level | Meaning | What the pipeline does |
|---|---|---|
| `clear` | No sensitive topic detected | Flows normally (candidate → draft → publishable) |
| `review` | Sensitive topic detected | Collector tags the item; AI drafting skips it; `publish.js` refuses until the owner personally re-runs it with `--force`, which writes a `safetyReviewed` audit note into the record |
| `blocked` | Content the site must not carry via automation | Dropped at collection (never stored in the repo), refused by `publish.js` with **no override**, and fails the build if it ever lands in `news.json` by hand-editing |

## Blocked topics (no exceptions through automation)

1. **Blasphemy-related content** — accusations, case coverage, protests over
   religious offense. Highest-risk topic for a Pakistani site; even sourced
   reporting can create legal and mob danger. (English + Urdu terms matched.)
2. **Graphic violence / gore** — beheading, burned alive, mutilation imagery.
3. **Incitement** — calls to kill, "death to X" rhetoric.

If a blocked term fires on harmless text (false positive), fix the **list** in
`safety-filter.js` with a deliberate commit — there is no per-run override.

## Review topics (publish only with owner sign-off)

1. **Military / security establishment** — army chief/COAS, GHQ, ISPR, ISI,
   Pakistan Army, military courts, rangers, frontier corps, enforced
   disappearances. (اردو: فوج، آرمی چیف، سیکیورٹی فورسز)
2. **Militancy / terrorism / insurgency** — TTP, Baloch insurgency groups,
   suicide attacks, IED blasts, abductions, drone strikes.
3. **Judiciary in sensitive matters** — chief justice, Supreme Court, high
   courts, sedition/treason, PECA/cybercrime prosecutions.
4. **Religion / sectarian matters** — Shia/Sunni/Ahmadi topics, attacks on
   places of worship, hate-speech stories.
5. **India-Pakistan conflict** — LoC/ceasefire violations, Kashmir conflict,
   missile tests, war rhetoric, nuclear matters.
6. **Politicians' legal matters / political crisis** — major leaders' arrests
   or trials, NAB cases, constitutional amendments, no-confidence motions.
7. **Sexual violence / crimes against minors.**

Review-level matches are intentionally broad. A match is not a ban — it means
"a human (the owner) must read the full story and decide." The override exists
for stories like an ISPR press release the owner judges safe, or routine court
reporting. The audit note (`safetyReviewed` in `news.json`) records who
approved what and when.

## Where it is enforced

| Stage | File | Behaviour |
|---|---|---|
| Collection (RSS) | `scripts/collect-news.js` | blocked → dropped entirely; review → kept in `queue/candidates.json` with a `safety` tag so editors see the flag |
| AI drafting | `scripts/draft-news.js` | only `clear` candidates are sent to the model |
| Publishing | `scripts/publish.js` | refuses review topics without `--force`; refuses blocked topics always; `--force` writes an audit note |
| Build (last line of defence) | `scripts/build.js` | scans every record in `news.json` (incl. hand-edits via GitHub web UI); blocked without audit note → build fails; review → visible warning |

## Operating guidance for the owner

- Default stance: **when in doubt, don't publish.** No story is worth the risk.
- For conflicts/military stories: rely on official sources (ISPR, NDMA) only,
  attribute clearly, avoid unverified casualty or blame claims — and even then,
  the owner decides personally.
- Never let automation carry allegations against individuals or institutions.
- The keyword lists are a floor, not a ceiling: the owner's judgment on the
  full text always outranks a "clear" result. The filter catches known-danger
  vocabulary; it cannot read context.

## Tuning

- Edit `scripts/safety-filter.js` (`TOPICS`), bump `POLICY_VERSION`, and update
  this file in the same commit so the policy and its enforcement stay in sync.
- Run `node -e "import('./scripts/safety-filter.js').then(m => console.log(m.assessSafety('your text here')))"` to test a phrase before committing list changes.
