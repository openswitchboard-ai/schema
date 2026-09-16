// Render the default reach the taxonomy gives every leaf, as one static page
// to read and correct:
//   node --experimental-strip-types scripts/render-default-reach.mjs [outFile]
// Writes docs/default-reach.html by default. No JavaScript on the page and no
// styling that assumes a light screen, so it reads the same either way.
//
// The defaults themselves live on the leaves in data/taxonomy.v2.json. To
// change one, change it there and run this again.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { categoryStatus, loadTaxonomy } from "../src/index.ts";

const WHAT = {
  radius: "Collected, or done face to face.",
  country: "Posted anywhere in the country.",
  anywhere: "Done online, so distance does not matter.",
};

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const taxonomy = loadTaxonomy();
const paths = Object.keys(taxonomy.nodes);
const leaves = paths.filter(
  (p) => categoryStatus(p).status === "open" && !paths.some((o) => o !== p && o.startsWith(`${p}.`)),
);

const counts = { radius: 0, country: 0, anywhere: 0, unset: 0 };
for (const p of leaves) counts[taxonomy.nodes[p].default_reach ?? "unset"] += 1;

// Group by top level, then by the family under it, which is how a person
// reads down a page looking for the one that is wrong.
const groups = new Map();
for (const path of leaves) {
  const [top, family] = path.split(".");
  if (!groups.has(top)) groups.set(top, new Map());
  const fam = groups.get(top);
  const key = family ?? top;
  if (!fam.has(key)) fam.set(key, []);
  fam.get(key).push(path);
}

const row = (path) => {
  const node = taxonomy.nodes[path];
  const reach = node.default_reach;
  const cell = reach
    ? `<span class="pill ${reach}">${reach}</span>`
    : `<span class="pill unset">not set</span> <span class="dim">the filer decides, as before</span>`;
  return `<tr>
<td class="said"><b>${esc(node.phrase ?? node.label)}</b></td>
<td class="reach">${cell}</td>
<td class="id">${esc(path)}</td>
</tr>`;
};

const sections = [...groups]
  .map(([top, families]) => {
    const blocks = [...families]
      .map(
        ([family, members]) => `<h3>${esc(family)}</h3>
<div class="scroll"><table>
<tbody>
${members.map(row).join("\n")}
</tbody>
</table></div>`,
      )
      .join("\n");
    const n = [...families.values()].reduce((a, m) => a + m.length, 0);
    return `<section><h2>${esc(top)} <span class="dim">${n}</span></h2>
${blocks}
</section>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Default reach by category</title>
<style>
  :root { color-scheme: light dark; --ink: #17181a; --dim: #6b6f76; --rule: #d8dade; --ground: #ffffff; --band: #f5f6f8; }
  @media (prefers-color-scheme: dark) {
    :root { --ink: #e9eaec; --dim: #9aa0a8; --rule: #34373c; --ground: #17181a; --band: #1e2024; }
  }
  html { background: var(--ground); }
  body { margin: 0; padding: 32px 20px 64px; background: var(--ground); color: var(--ink);
         font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 26px; font-weight: 600; margin: 0 0 8px; }
  h2 { font-size: 20px; font-weight: 600; margin: 34px 0 4px; border-bottom: 1px solid var(--rule); padding-bottom: 6px; }
  h3 { font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--dim); margin: 20px 0 4px; }
  p.lead { color: var(--dim); margin: 0 0 6px; max-width: 64ch; }
  ul.tests { color: var(--dim); max-width: 64ch; margin: 10px 0 0; padding-left: 20px; }
  ul.tests li { margin: 0 0 4px; }
  .count { color: var(--dim); font-size: 13px; margin: 18px 0 10px; }
  .scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; }
  td { text-align: left; vertical-align: top; padding: 7px 12px; border-bottom: 1px solid var(--rule); }
  tr:nth-child(even) td { background: var(--band); }
  td.id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--dim); white-space: nowrap; text-align: right; }
  td.said { white-space: nowrap; }
  td.reach { white-space: nowrap; width: 40%; }
  .dim { color: var(--dim); font-weight: 400; font-size: 13px; }
  b { font-weight: 600; }
  .pill { display: inline-block; font-size: 11px; letter-spacing: .5px; text-transform: uppercase;
          border: 1px solid var(--rule); border-radius: 3px; padding: 1px 6px; }
  .pill.radius { border-color: #7a8794; }
  .pill.country { border-color: #6f8f5f; }
  .pill.anywhere { border-color: #5f7f9f; }
  .pill.unset { border-style: dashed; color: var(--dim); }
</style>
</head>
<body>
<div class="wrap">
<h1>Default reach by category</h1>
<p class="lead">How far a thing travels is a fact about the thing, not a judgement to be made afresh every time. A mountain bike is always bulky; an online language partner is never local. Each leaf below carries the reach to use when nobody has said otherwise.</p>
<p class="lead">It is a default and nothing else. A human who says how far they will go always wins, and a leaf marked <b>not set</b> behaves exactly as everything did before: whoever files the want or the have decides.</p>
<ul class="tests">
<li><b>radius</b> — ${esc(WHAT.radius)} Bulky, heavy, fragile in the post, or inherently in person.</li>
<li><b>country</b> — ${esc(WHAT.country)} It fits in a parcel and nobody has to meet.</li>
<li><b>anywhere</b> — ${esc(WHAT.anywhere)} Nothing physical moves.</li>
<li><b>not set</b> — routinely both, so the taxonomy says nothing rather than guessing.</li>
</ul>
<p class="count">${leaves.length} categories: ${counts.radius} radius, ${counts.country} country, ${counts.anywhere} anywhere, ${counts.unset} not set.</p>
<p class="lead">If a line looks wrong, the value lives on the leaf in <code>data/taxonomy.v2.json</code>.</p>
${sections}
</div>
</body>
</html>
`;

const out = process.argv[2] ?? join("docs", "default-reach.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${leaves.length} categories)`);
