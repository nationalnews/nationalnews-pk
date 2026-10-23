// SAFETY GUARD — content policy layer for NationalNews.pk.
//
// WHY THIS EXISTS: NationalNews.pk is an automated/aggregated news site
// operated from Pakistan. Certain topics carry real legal, regulatory or
// mob-safety risk if published without an explicit human decision by the
// site owner. This module is the single source of truth for that policy.
//
// DESIGN (three levels):
//   "clear"   — no policy term matched. Safe to move through the pipeline.
//   "review"  — sensitive topic matched (military, judiciary, sectarian,
//               conflict, politicians' legal matters, sexual violence).
//               The pipeline refuses to publish until a human explicitly
//               overrides (publish.js --force), which records an audit note.
//   "blocked" — content the site must not carry via automation at all
//               (graphic gore, incitement to violence, blasphemy content).
//               Hard refusal. No override flag. Edit SAFETY-POLICY.md lists
//               consciously if policy ever changes.
//
// Matching is intentionally conservative: review-level terms are broad so
// that borderline items get human eyes, not that they are banned. Tuning
// the lists below IS the editorial policy — version and document changes.
//
// Exports:
//   assessSafety(text) -> { level, reasons: [{id,label,level,matched}] }
//   stripHtml(html)    -> plain text for scanning body HTML
//   POLICY_VERSION     — bump when lists change meaningfully.

export const POLICY_VERSION = 1;

const TOPICS = [
  // ---------- BLOCKED: never publish via automation, no override ----------
  {
    id: "graphic-violence",
    label: "Graphic violence / gory detail",
    level: "blocked",
    terms: [
      "beheaded", "beheading", "severed head", "burned alive", "burnt alive",
      "dismembered", "charred bod", "hanged from a crane", "bodies mutilated",
      "لاش کے ٹکڑے",
    ],
  },
  {
    id: "incitement",
    label: "Incitement / calls for violence",
    level: "blocked",
    terms: [
      "death to ", "kill all ", "we will kill", "calls to kill",
      "should be killed", "qatl kiya jaye",
    ],
  },
  {
    id: "blasphemy",
    label: "Blasphemy-related content (highest risk topic)",
    level: "blocked",
    terms: [
      "blasphemy", "blasphemous", "gustakh", "gustaakh", "desecrat",
      "quran burning", "burning of the quran", "burnt quran",
      "توہینِ رسالت", "رسالت کی توہین", "گستاخ",
    ],
  },

  // ---------- REVIEW: human sign-off required before publishing ----------
  {
    id: "military-establishment",
    label: "Military / security establishment",
    level: "review",
    terms: [
      "army chief", "chief of army staff", "coas", "ghq", "ispr",
      "pakistan army", "pak army", "military", "inter-services intelligence",
      "isi director", "director general isi", "court martial", "courtmartial",
      "pakistan rangers", "sindh rangers", "frontier corps", "naval chief",
      "air chief marshal", "enforced disappearance", "missing persons case",
      "آرمی چیف", "فوج", "سیکیورٹی فورسز", "سانحہ",
    ],
  },
  {
    id: "security-incidents",
    label: "Militancy / terrorism / insurgency",
    level: "review",
    terms: [
      "ttp", "tehreek-e-taliban", "terrorist attack", "suicide bombing",
      "suicide bomber", "ied blast", "improvised explosive", "militant attack",
      "militants killed", "insurgency", "baloch liberation army",
      "balochistan liberation army", "majeed brigade", "drone strike",
      "cross-border attack", "bomb blast", "grenade attack", "ambush",
      "kidnapped", "abducted", "دہشت گرد", "خودکش حملہ",
    ],
  },
  {
    id: "judiciary",
    label: "Judiciary / courts in sensitive matters",
    level: "review",
    terms: [
      "chief justice", "supreme court", "high court", "sedition",
      "high treason", "contempt of court", "peca ordinance", "cyber crime law",
      "سپریم کورٹ", "چیف جسٹس", "عدالتِ عظمی",
    ],
  },
  {
    id: "religion-sectarian",
    label: "Religion / sectarian matters",
    level: "review",
    terms: [
      "sectarian", "shia", "sunni", "ahmadi", "ahmedi", "qadiani",
      "mosque attack", "temple attack", "church attack", "imamia",
      "mourning procession", "hate speech", "فرقہ وارانہ",
    ],
  },
  {
    id: "india-pak-conflict",
    label: "India-Pakistan conflict / defence escalation",
    level: "review",
    terms: [
      "line of control", "loc firing", "ceasefire violation", "kashmir",
      "indian army", "war with india", "missile test", "nuclear",
      "air strike", "airstrike", "airspace closed", "abhinandan",
      "برہموس", "جنگ",
    ],
  },
  {
    id: "political-legal",
    label: "Politicians' legal matters / political crisis",
    level: "review",
    terms: [
      "imran khan", "nawaz sharif", "shehbaz sharif", "asif ali zardari",
      "bilawal bhutto", "national accountability bureau", "nab summons",
      "arrest warrant for", "adiala jail", "article 6", "27th amendment",
      "26th amendment", "constitutional amendment", "confidence vote",
      "no-confidence",
    ],
  },
  {
    id: "sexual-violence",
    label: "Sexual violence / crimes against minors",
    level: "review",
    terms: [
      "rape", "gang rape", "sexual assault", "child abuse", "pedophil",
      "paedophil", "minor girl", "minor boy",
    ],
  },
];

const LATIN_TERM = /^[a-z0-9' -]+$/i;

function matchTerm(hay, term) {
  if (LATIN_TERM.test(term)) {
    const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`\\b${pattern}\\b`, "i").test(hay);
  }
  return hay.includes(term);
}

/**
 * Assess any text (headline, description, body) against the policy.
 * Returns { level: "clear"|"review"|"blocked", reasons: [...] }.
 * Level escalates: blocked > review > clear.
 */
export function assessSafety(text) {
  const hay = String(text || "").toLowerCase();
  const reasons = [];
  let level = "clear";
  if (!hay.trim()) return { level, reasons };
  for (const topic of TOPICS) {
    const matched = topic.terms.filter((term) => matchTerm(hay, term));
    if (!matched.length) continue;
    reasons.push({
      id: topic.id,
      label: topic.label,
      level: topic.level,
      matched: matched.slice(0, 6),
    });
    if (topic.level === "blocked") level = "blocked";
    else if (level === "clear") level = "review";
  }
  return { level, reasons };
}

/** Remove HTML tags so body HTML can be scanned as plain text. */
export function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Human-readable report lines for an assessment (for console output). */
export function safetyReport(assessment) {
  return assessment.reasons.map(
    (r) => `  - [${r.level}] ${r.label} — matched: ${r.matched.join(", ")}`
  );
}
