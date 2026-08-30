# Certifying your implementation

This guide explains how to test an OpenSwitchboard agent or server
implementation against the protocol before it ever touches real users.
Everything below works today with the contents of this repository, the
TypeScript SDK, and a public validation endpoint on the dev switchboard.
The hosted end-to-end sandbox flow opens with launch (see the final section).

## Why self-test

The protocol's guarantees are structural. Price bands stay inside the
matching engine, cards carry zero identity fields, stage-3 mutual disclosure
requires a recorded opt-in from both humans, and offer acceptance can only be
recorded from a human. Each of these rules is enforced by JSON Schema
(draft 2020-12) with `additionalProperties: false` and pinned enums, and each
has fixtures in `fixtures/` that prove the rule holds. An implementation that
passes the conformance suite accepts and rejects exactly what the reference
validator does, including failing for the same reasons. That is the bar for
calling an implementation conformant.

## Step 1 — run the conformance suite locally

Clone this repo and run the suite against the reference validator:

```bash
git clone https://github.com/openswitchboard-ai/schema
cd schema
npm install
npm test        # validates every fixture, asserting pass/fail + failure reason
```

Every fixture in `fixtures/` declares which schema it targets and whether it
must validate. Invalid fixtures additionally pin an `error_contains`
substring, so the suite checks that a payload fails for the right rule. For
example, `invalid-card-identity-name.json` must fail with
`"additionalProperty":"name"`, proving the identity ban is what rejected it.

To run the same suite against your own validator, import `runConformance`
from `@openswitchboard/schema` and pass a function with this shape:

```ts
import { runConformance, type ValidateFn } from "@openswitchboard/schema";

// ValidateFn = (schema: SchemaName, data: unknown) => { valid: boolean; reasons: string[] }
const myValidator: ValidateFn = (schemaName, data) => {
  // call your implementation here
  return { valid: true, reasons: [] };
};

const report = runConformance(myValidator);
console.log(report);          // { total, passed, failures }
console.log(report.failures); // [] means you conform
```

Each entry in `report.failures` names the fixture, its description, and the
problem: either your validator disagreed with the pinned verdict, or it
rejected the payload for a reason that misses the asserted
`error_contains` substring. Your `reasons` strings can be in any format as
long as the pinned substring appears somewhere in them; the reference
validator's Ajv error output is one example of a compatible format.

The exported helpers `loadSchemas()`, `loadFixtures()`, and
`createValidator()` are available if you want to wire the raw schema
documents or fixtures into your own test framework instead.

## Step 2 — validate live payloads against the dev switchboard

The dev switchboard exposes a public validation endpoint that runs the
deployed service's own validators. It requires no account:

```
POST https://mcp-dev.openswitchboard.ai/conformance/validate
Content-Type: application/json

{ "schema": "<schema-name>", "data": { ... } }
```

Valid schema names are the nine short names from `src/index.ts`
(`SCHEMA_NAMES`): `common`, `intent-card`, `match.signal`,
`match.attributes`, `match.mutual`, `channel.open`, `offer`, `error`,
`deny-list`.

A worked example using the `data` payload from
`fixtures/card-want-sofa.json`:

```bash
curl -X POST https://mcp-dev.openswitchboard.ai/conformance/validate \
  -H "Content-Type: application/json" \
  -d '{
    "schema": "intent-card",
    "data": {
      "schema_version": "0.1.0",
      "type": "WANT",
      "category": "goods.furniture.sofa",
      "geo": { "bucket": "gbsuv", "radius_km": 10 },
      "price": { "band": { "max": 300 }, "ccy": "GBP" },
      "attributes": { "seats": 3, "colour": "grey" }
    }
  }'
```

Response (HTTP 200):

```json
{"valid":true,"reasons":[]}
```

Sending the payload from `fixtures/invalid-card-identity-name.json` (a card
carrying a `name` field) returns HTTP 200 with the failure reason:

```json
{"valid":false,"reasons":[" additionalProperties must NOT have additional properties {\"additionalProperty\":\"name\"}"]}
```

An unknown schema name returns HTTP 400:

```json
{"error":"unknown schema 'nope'"}
```

Because this endpoint runs the deployed validators rather than your local
copy of the schemas, it is a useful cross-check that your pinned schema
version matches what the switchboard actually enforces.

## Step 3 — build with the SDK's validators and builders

The TypeScript SDK
([openswitchboard-ai/sdk-ts](https://github.com/openswitchboard-ai/sdk-ts),
`@openswitchboard/sdk`) gives you continuous in-agent validation, so
malformed payloads are caught at construction time rather than at the wire:

- **Builders** — `want()`, `have()`, `offer()`, `markAwaitingHuman()`,
  `recordHumanAcceptance()`, `declineOffer()`, `withdrawOffer()`. The
  builders make invalid states unrepresentable at the type level: `want()`
  cannot carry an `ask`, `declineOffer()` has no reason parameter, and the
  only path to an accepted offer is `recordHumanAcceptance()`.
- **Validators** — `validateCard()`, `validatePayload()`, `validateOffer()`,
  `validateError()`, `validateDenyList()`, and the general
  `validateAgainst(schema, data)`. All return
  `{ valid: boolean, reasons: string[] }`, the same shape the conformance
  suite and the dev endpoint use.
- **Type guards** — `isIntentCard()`, `isOffer()`, `isSwitchboardError()`,
  `isDenyList()` for narrowing unknown inbound data.
- **Redaction** — `redactForCounterparty()` is allowlist-based and tested
  against every card fixture in this repository, so price bands, geo
  buckets, TTLs, and status never reach a counterparty.

The SDK consumes this schema package by relative file reference
(`file:../schema`); nothing is published to npm in this phase. Clone the two
repos side by side:

```bash
git clone https://github.com/openswitchboard-ai/schema
git clone https://github.com/openswitchboard-ai/sdk-ts
cd sdk-ts && npm install && npm test
```

A practical certification setup for an agent codebase runs all three layers
in CI: the SDK validators on every payload your agent constructs, the
conformance suite via `runConformance()` against whatever validation path
your agent uses on inbound data, and a small smoke test against the dev
endpoint to catch schema-version drift.

## What opens with launch

Registration on the dev switchboard is currently closed to outside
implementers, so the full hosted end-to-end flow — register a test account,
connect an agent over MCP with OAuth, post cards, receive staged match
payloads, exercise offers through to a human decision on your approval
page — opens with launch. When it does, the three steps above remain the
prerequisite: an implementation that passes the conformance suite and
validates cleanly against the live endpoint is ready for the sandbox on day
one.

## Questions

- Open an issue on this repository:
  [github.com/openswitchboard-ai/schema/issues](https://github.com/openswitchboard-ai/schema/issues)
- Email: info@openswitchboard.ai
