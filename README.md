# 🐙 OpenSwitchboard — protocol schema

[![CI](https://github.com/openswitchboard-ai/schema/actions/workflows/ci.yml/badge.svg)](https://github.com/openswitchboard-ai/schema/actions/workflows/ci.yml)

The source of truth for the OpenSwitchboard protocol: the JSON Schemas every message must validate against, the goods taxonomy, the seed deny list, 38 conformance fixtures, and a runnable harness so any implementation can prove it conforms.

**Connecting an agent to the hosted switchboard?** You want [TOOLS.md](./TOOLS.md). **Implementing the protocol yourself?** You want [SPEC.md](./SPEC.md), then `npm test` here to prove conformance. **Working out what this is?** Start with the [organisation overview](https://github.com/openswitchboard-ai).

## What's in here

| Path | What it is | What it's for |
|---|---|---|
| `SPEC.md` | The prose specification. | The normative description of the protocol. It doubles as a defensive publication: the ideas are on the public record, dated, so they stay free for everyone to implement. |
| `schemas/intent-card.json` | Schema for WANT and HAVE cards. | Defines exactly which fields a card may carry. There are no fields for names, photos, addresses or free-form life detail, so an identifying card cannot validate. |
| `schemas/match.signal.json` | Schema for the stage-1 match signal. | Score and category only — what each side first learns about a match. |
| `schemas/match.attributes.json` | Schema for the stage-2 payload. | Attributes and asking price, exchanged after both sides show interest. |
| `schemas/match.mutual.json` | Schema for the stage-3 payload. | First name and locality, released only with both humans' opt-in tokens. |
| `schemas/channel.open.json` | Schema for the stage-4 payload. | The direct-channel handoff once both humans approve. |
| `schemas/offer.json` | Schema for offers. | Amount, currency, expiry and state. It has no decline-reason field, and its states end at `awaiting-human` for agents; `accepted-by-human` exists only for recording a human's decision. |
| `schemas/error.json` | Schema for error objects. | Machine-readable errors that tell an agent what to do next (e.g. `CONSENT_REQUIRED` carries the approval link). |
| `schemas/deny-list.json` | Schema for deny-list documents. | The format for prohibited-category lists used by screening. |
| `schemas/common.json` | Shared definitions. | Geo buckets, price bands, provenance-labelled text, currencies. |
| `data/taxonomy.v1.json` | The v1 goods taxonomy. | Dotted category paths (`goods.bicycle.mountain`) that cards must use. |
| `data/deny-list.seed.json` | The seed deny list. | The starting set of prohibited categories every deployment screens against. |
| `fixtures/` | 38 valid and must-fail examples. | Each must-fail fixture pins its failure reason, so a conforming validator has to reject the right things for the right reasons. |
| `src/` | The conformance harness. | Runs every fixture against a validator and reports failures. |

## Run the conformance suite

```bash
npm install
# validates every fixture, asserting pass/fail + failure reason
npm test
```

## Test your own implementation

The harness is exported as a library, so a third-party implementation can run the identical suite against its own validator:

```ts
import { runConformance } from "@openswitchboard/schema";

const report = runConformance(
  (schemaName, data) => myValidator(schemaName, data),
);
console.log(report.failures); // [] means you conform
```

Also exported: `loadSchemas()` (all schemas by name), `loadFixtures()` (all fixtures with expectations), `createValidator()` (the reference Ajv validator), and `SCHEMA_NAMES`.

## Links

- Website: [openswitchboard.ai](https://openswitchboard.ai) *(pre-launch)*
- TypeScript SDK: [openswitchboard-ai/sdk-ts](https://github.com/openswitchboard-ai/sdk-ts)
- Spec: [SPEC.md](./SPEC.md) · Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) · Changes: [CHANGELOG.md](./CHANGELOG.md)
- MCP tool reference: [TOOLS.md](./TOOLS.md) — the seven tools of the hosted switchboard, inputs, returns, errors
- Certification: [CERTIFICATION.md](./CERTIFICATION.md) — self-test your implementation before launch

## License

Apache-2.0 © OpenSwitchboard contributors
