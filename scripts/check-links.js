// Checks every generated/copied HTML file in dist/: all internal href/src
// targets must exist in dist. Exit 1 on any broken internal link.
import fs from "node:fs";
import path from "node:path";

const ATTR_RE = /\b(?:href|src)="([^"]+)"/g;

export function checkLinks(outDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|css)$/.test(entry.name)) files.push(full);
    }
  };
  walk(outDir);

  const exists = new Set(fs.readdirSync(outDir, { recursive: true }));
  const broken = [];
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(ATTR_RE)) {
      const raw = match[1];
      if (raw.startsWith("#") || /^(https?:|mailto:|data:|tel:)/.test(raw)) continue;
      const clean = raw.split("#")[0].split("?")[0];
      if (!clean) continue;
      const target = clean.replace(/^\//, "") || "index.html";
      if (!exists.has(target)) {
        broken.push(`${path.relative(outDir, file)} -> ${raw}`);
      }
    }
  }
  if (broken.length) {
    console.error(`Link check FAILED — ${broken.length} broken internal reference(s):`);
    for (const b of broken) console.error(`  ${b}`);
    return false;
  }
  console.log(`Link check OK: ${files.length} file(s), all internal references resolve.`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = checkLinks(path.join(process.cwd(), "dist"));
  process.exit(ok ? 0 : 1);
}
