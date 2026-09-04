// Validates every JSON block in EXAMPLE.md against its schema, so the
// walkthrough can never drift from the protocol.
import { readFileSync } from "node:fs";
import { createValidator } from "../src/index.ts";

const md = readFileSync(new URL("../EXAMPLE.md", import.meta.url), "utf8");
const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
const schemaFor = (d) =>
  d.type ? "intent-card"
  : d.code ? "error"
  : d.kind === "offer" ? "offer"
  : d.kind === "match.signal" ? "match.signal"
  : d.kind === "match.attributes" ? "match.attributes"
  : d.kind === "match.mutual" ? "match.mutual"
  : d.kind === "conversation.open" ? "conversation.open"
  : d.kind === "conversation.message" ? "conversation.message"
  : null;

const validate = createValidator();
let failures = 0;
blocks.forEach((d, i) => {
  const name = schemaFor(d);
  if (!name) { console.error(`block ${i}: no schema mapping`); failures++; return; }
  const r = validate(name, d);
  if (!r.valid) { console.error(`block ${i} (${name}):`, r.reasons); failures++; }
});
console.log(`${blocks.length} blocks checked, ${failures} failures`);
process.exit(failures ? 1 : 0);
