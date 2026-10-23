// Unit test for scripts/safety-filter.js — run: node scripts/test-safety.js
import { assessSafety, stripHtml } from "./safety-filter.js";

const cases = [
  // [text, expected level, expected topic id (optional)]
  ["PSX closes higher as rupee gains against dollar", "clear", null],
  ["Pakistani cricketer scores century against England", "clear", null],
  ["L'Oreal CEO says GLP-1 drugs are changing beauty habits", "clear", null],
  ["Army chief visits GHQ, says ISPR", "review", "military-establishment"],
  ["Security forces operation in Gwadar, ISPR confirms", "review", "military-establishment"],
  ["TTP claims suicide bombing in Peshawar", "review", "security-incidents"],
  ["Supreme Court takes up chief justice case", "review", "judiciary"],
  ["Sectarian clash leaves two injured", "review", "religion-sectarian"],
  ["Ceasefire violation along Line of Control", "review", "india-pak-conflict"],
  ["Imran Khan appears before court in NAB case", "review", "political-legal"],
  ["Man arrested over blasphemy accusations", "blocked", "blasphemy"],
  ["Protests over Quran burning outside embassy", "blocked", "blasphemy"],
  ["Victim was beheaded, police say", "blocked", "graphic-violence"],
  ["فوج کا آپریشن، آرمی چیف کی ہدایت", "review", "military-establishment"],
  ["<p>Stock market <b>rally</b> continues</p>", "clear", null], // HTML strip
];

let pass = 0, fail = 0;
for (const [text, wantLevel, wantTopic] of cases) {
  const got = assessSafety(text);
  const topicOk = !wantTopic || got.reasons.some((r) => r.id === wantTopic);
  if (got.level === wantLevel && topicOk) {
    pass += 1;
    console.log(`PASS [${got.level}] ${text}`);
  } else {
    fail += 1;
    console.log(`FAIL want=${wantLevel}${wantTopic ? "/" + wantTopic : ""} got=${got.level} topics=[${got.reasons.map((r) => r.id).join(",")}] :: ${text}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
