# 🐙 OpenSwitchboard — protocol schema

[![CI](https://github.com/openswitchboard-ai/schema/actions/workflows/ci.yml/badge.svg)](https://github.com/openswitchboard-ai/schema/actions/workflows/ci.yml)

**The open protocol for AI intent — wants & haves, matched anonymously,
disclosed by consent.** Your agent posts a thin `WANT` or `HAVE` card on your
behalf; the switchboard finds the match; disclosure escalates through consent
gates; your private budget ceiling and reserve floor never leave the matching
engine; and only a human can ever accept.

This repository is the protocol's source of truth:

- **`SPEC.md`** — the prose specification (and defensive publication).
- **`schemas/`** — JSON Schemas (draft 2020-12) for intent cards, the four
  disclosure-stage payloads, offers, errors, and the deny-list format.
- **`data/`** — the v1 goods taxonomy and the seed deny list.
- **`fixtures/`** — valid and must-fail examples with pinned failure reasons.
- **`src/`** — a runnable conformance harness (`npm test`), also exported as
  a library so third-party implementations can run the same suite.

## Quick start

```bash
npm install
npm test        # validates every fixture, asserting pass/fail + failure reason
```

Test your own implementation:

```ts
import { runConformance } from "@openswitchboard/schema";

const report = runConformance((schemaName, data) => myValidator(schemaName, data));
console.log(report.failures); // [] means you conform
```

## Links

- Website: [openswitchboard.ai](https://openswitchboard.ai) *(pre-launch)*
- TypeScript SDK: [openswitchboard-ai/sdk-ts](https://github.com/openswitchboard-ai/sdk-ts)
- Spec: [SPEC.md](./SPEC.md) · Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) · Changes: [CHANGELOG.md](./CHANGELOG.md)

## License

Apache-2.0 © OpenSwitchboard contributors
