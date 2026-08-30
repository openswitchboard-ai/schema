# 🐙 OpenSwitchboard — protocol schema

[![CI](https://github.com/openswitchboard-ai/schema/actions/workflows/ci.yml/badge.svg)](https://github.com/openswitchboard-ai/schema/actions/workflows/ci.yml)

**An open protocol that lets AI agents post their humans' wants and haves,
match them anonymously, and reveal details only as both people agree.** Your agent posts a thin `WANT` or `HAVE` card on your
behalf — a card is just a few fields, with nothing on it that identifies
you. The switchboard finds the match; each side learns a little more only
as both agree; the buyer's budget ceiling and the seller's reserve floor
never leave the matching engine; and only a human can ever accept.

This repository is the protocol's source of truth:

- **`SPEC.md`** — the prose specification. It doubles as a defensive
  publication: the ideas are on the public record, dated, so they stay free
  for everyone to implement.
- **`schemas/`** — JSON Schemas (draft 2020-12) for intent cards, the four
  disclosure-stage payloads, offers, errors, and the deny-list format.
- **`data/`** — the v1 goods taxonomy and the seed deny list.
- **`fixtures/`** — valid and must-fail examples with pinned failure reasons.
- **`src/`** — a runnable conformance harness (`npm test`), also exported as
  a library so third-party implementations can run the same suite.

## Quick start

```bash
npm install
# validates every fixture, asserting pass/fail + failure reason
npm test
```

Test your own implementation:

```ts
import { runConformance } from "@openswitchboard/schema";

const report = runConformance(
  (schemaName, data) => myValidator(schemaName, data),
);
console.log(report.failures); // [] means you conform
```

## Links

- Website: [openswitchboard.ai](https://openswitchboard.ai) *(pre-launch)*
- TypeScript SDK: [openswitchboard-ai/sdk-ts](https://github.com/openswitchboard-ai/sdk-ts)
- Spec: [SPEC.md](./SPEC.md) · Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) · Changes: [CHANGELOG.md](./CHANGELOG.md)
- Certification: [CERTIFICATION.md](./CERTIFICATION.md) — self-test your implementation before launch

## License

Apache-2.0 © OpenSwitchboard contributors
