// Shared site configuration and helpers for all build/generation scripts.
export const SITE_URL = "https://nationalnews.pk";
export const SITE_NAME = "NationalNews.pk";

export const CATEGORIES = [
  {
    key: "pakistan",
    name: "Pakistan",
    file: "pakistan.html",
    eyebrow: "Pakistan",
    intro: "Public affairs, policy and issues affecting everyday life in Pakistan.",
  },
  {
    key: "world",
    name: "World",
    file: "world.html",
    eyebrow: "World",
    intro: "Global developments explained with context for readers in Pakistan.",
  },
  {
    key: "business",
    name: "Business & Economy",
    file: "business.html",
    eyebrow: "Business & Economy",
    intro: "Economic data, markets and policy explained carefully.",
  },
  {
    key: "sports",
    name: "Sports",
    file: "sports.html",
    eyebrow: "Sports",
    intro: "Competition, teams and sporting developments.",
  },
];

// Categories that map onto a generated section page. A record filed as
// "Politics" appears on the Pakistan page; "Technology" on the World page.
export const CATEGORY_ALIASES = {
  Politics: "pakistan",
  Technology: "world",
  Pakistan: "pakistan",
  World: "world",
  Business: "business",
  Sports: "sports",
};

export const VALID_CATEGORIES = Object.keys(CATEGORY_ALIASES);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// "2026-10-22" -> "22 Oct 2026"
export function formatDateLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return String(iso);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// "2026-10-22" -> "22 October 2026"
export function formatDateLong(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return String(iso);
  return `${Number(m[3])} ${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}`;
}

// "2026-10-22" -> RFC-1123 date string for RSS pubDate
export function toRfc1123(iso) {
  return new Date(`${iso}T00:00:00+05:00`).toUTCString();
}

export function articleUrl(record) {
  return record.url || `/${record.slug}.html`;
}

export function sectionKeyFor(record) {
  return CATEGORY_ALIASES[record.category] || null;
}

export function publishedOnly(records) {
  return records.filter((r) => r.status === "published");
}

export function sortByDateDesc(records) {
  return [...records].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
