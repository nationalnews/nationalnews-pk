// OPTIONAL AI-assisted drafting step. Runs AFTER collection, BEFORE any
// human review. Reads queue/candidates.json and, only if AI credentials are
// configured via environment variables (GitHub Actions Secrets in CI),
// asks an OpenAI-compatible chat model to prepare a structured DRAFT:
// suggested headline, category, factual summary, and claims to verify.
// Drafts are written to drafts/ with status "draft". news.json is NEVER
// written by this script — publishing requires an editor's manual approval.
//
// Required env (all optional — script skips cleanly without them):
//   DRAFT_API_KEY   — API key for an OpenAI-compatible endpoint
//   DRAFT_API_BASE  — e.g. https://api.z.ai/api/paas/v4  (no trailing slash)
//   DRAFT_API_MODEL — e.g. glm-4-flash or any compatible model id
//   DRAFT_MAX       — max drafts per run (default 3)
import fs from "node:fs";
import path from "node:path";
import { similarity } from "./validate-news.js";

const root = process.cwd();
const DRAFTS_DIR = path.join(root, "drafts");
const INDEX_FILE = path.join(DRAFTS_DIR, "index.json");
const TIMEOUT_MS = 60000;
const SIMILARITY_THRESHOLD = 0.8;

const SYSTEM_PROMPT = `You are an assistant to the editors of NationalNews.pk, a Pakistani news website. You will be given a headline, description, source name and source URL from a reputable publisher's RSS feed.

Prepare a DRAFT story proposal for human editorial review. Follow these rules strictly:
- Respond with ONLY a valid JSON object, no markdown fences, no commentary.
- Do not invent facts, quotes, numbers, dates, names or official statements. Use only information present in the provided material.
- If the material is unclear, say so in verificationNotes instead of guessing.
- JSON shape:
{"suggestedHeadline": string (max 120 chars, factual, no clickbait),
 "category": one of "Pakistan" | "World" | "Business" | "Sports" | "Politics" | "Technology",
 "summary": string (2-3 factual sentences based only on the provided material),
 "claimsToVerify": [strings — each factual claim that an editor must check against a primary source before publishing],
 "verificationNotes": string (what needs checking, and what is uncertain),
 "isSensitive": boolean (true for breaking news, conflict, deaths, allegations, health, financial advice topics)}`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("model response contained no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function requestDraft(candidate, env) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const userMsg = `Headline: ${candidate.headline}\nDescription: ${candidate.description || "(none)"}\nPublisher: ${candidate.sourceName}\nSource URL: ${candidate.sourceUrl}\nPublished: ${candidate.publishedAt || "(unknown)"}`;
    const res = await fetch(`${env.DRAFT_API_BASE}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.DRAFT_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DRAFT_API_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty API response");
    return extractJson(content);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const env = process.env;
  if (!env.DRAFT_API_KEY || !env.DRAFT_API_BASE || !env.DRAFT_API_MODEL) {
    console.log("DRAFTING SKIPPED: AI credentials not configured.");
    console.log("To enable, set GitHub Actions secrets: DRAFT_API_KEY, DRAFT_API_BASE, DRAFT_API_MODEL.");
    console.log("Drafting is optional — editors can publish stories without it.");
    process.exit(0);
  }

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const candidatesFile = path.join(root, "queue", "candidates.json");
  if (!fs.existsSync(candidatesFile)) {
    console.log("DRAFTING SKIPPED: queue/candidates.json not found (run collect first).");
    process.exit(0);
  }
  const candidates = JSON.parse(fs.readFileSync(candidatesFile, "utf8"));
  const published = JSON.parse(fs.readFileSync(path.join(root, "news.json"), "utf8"));
  const index = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")) : [];
  const draftedIds = new Set(index.map((d) => d.id));
  const max = Number(env.DRAFT_MAX || 3);

  const publishedTitles = published.map((r) => r.title);
  const todo = candidates
    .filter((c) => !draftedIds.has(c.id))
    .filter((c) => !publishedTitles.some((t) => similarity(t, c.headline) >= SIMILARITY_THRESHOLD))
    .slice(0, max);

  if (!todo.length) {
    console.log("DRAFTING: no new candidates to draft.");
    process.exit(0);
  }

  let ok = 0;
  for (const candidate of todo) {
    try {
      const draft = await requestDraft(candidate, env);
      const record = {
        id: candidate.id,
        status: "draft",
        requiresEditorialApproval: true,
        disclaimer: "AI-generated draft from an RSS item. Nothing here is published until an editor verifies claims, confirms sourcing and adds an approved record to news.json.",
        candidate: {
          headline: candidate.headline,
          sourceName: candidate.sourceName,
          sourceUrl: candidate.sourceUrl,
          publishedAt: candidate.publishedAt,
          retrievedAt: candidate.retrievedAt,
        },
        draft: {
          suggestedHeadline: String(draft.suggestedHeadline || "").slice(0, 160),
          category: draft.category,
          summary: draft.summary,
          claimsToVerify: Array.isArray(draft.claimsToVerify) ? draft.claimsToVerify.slice(0, 10) : [],
          verificationNotes: draft.verificationNotes || "",
          isSensitive: Boolean(draft.isSensitive),
        },
        draftedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(DRAFTS_DIR, `${candidate.id}.json`), JSON.stringify(record, null, 2));
      index.push({ id: candidate.id, headline: candidate.headline, draftedAt: record.draftedAt });
      ok += 1;
      console.log(`  DRAFTED ${candidate.id}: ${record.draft.suggestedHeadline}`);
      await sleep(1200);
    } catch (err) {
      console.log(`  ERR draft ${candidate.id}: ${err.message}`);
    }
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  console.log(`Drafting done: ${ok}/${todo.length} draft(s) written to drafts/.`);
  console.log("REMINDER: drafts are proposals for editors. No auto-publishing exists in this repository.");
}

main().catch((err) => {
  console.error(`DRAFTING FAILED: ${err.message}`);
  process.exit(1);
});
