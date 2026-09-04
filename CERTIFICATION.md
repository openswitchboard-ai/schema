# Certifying your implementation

If you are building an agent or a server that speaks the OpenSwitchboard
protocol, you can prove it behaves before it ever touches a real person.
This guide walks through the three checks that work today. You run a test
suite on your own machine, you send sample payloads to a live checking
endpoint, and you build with a library that refuses to construct bad data
in the first place. The hosted end-to-end sandbox opens with launch (see
the final section).

## Why self-test

The protocol makes promises to the people using it. A private price limit
stays inside the matching engine. A listing has no room for a name or an
address. Personal details are shared only after both humans have said yes.
An offer is accepted only by a human. Each of these promises is written
into the schemas as a rule a payload either follows or breaks. Each rule
also comes with example files in `fixtures/`
that prove it holds, including examples that must fail and the exact reason
they must fail for. Passing the conformance suite means your implementation
accepts and rejects exactly what the reference validator does, and fails
for the same reasons. That is the bar for calling an implementation
conformant.

## Step 1 — run the conformance suite locally

This is the same suite the switchboard's own developers run. It feeds every
example file through a validator and checks the verdicts. The commands:

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

Your local copy of the schemas could drift from what the live service
actually enforces. This step rules that out. The dev switchboard has a
public checking endpoint: you send it a payload, and the deployed service's
own validators tell you whether it would be accepted. No account is needed.
The technical details:

```
POST https://mcp-dev.openswitchboard.ai/conformance/validate
Content-Type: application/json

{ "schema": "<schema-name>", "data": { ... } }
```

Valid schema names are the nine short names from `src/index.ts`
(`SCHEMA_NAMES`): `common`, `intent-card`, `match.signal`,
`match.attributes`, `match.mutual`, `conversation.open`, `offer`, `error`,
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

Sending the payload from `fixtures/invalid-card-identity-name.json` (a listing
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

The first two steps check payloads after you have made them. This step
stops bad payloads from being made at all. The TypeScript SDK
([openswitchboard-ai/sdk-ts](https://github.com/openswitchboard-ai/sdk-ts),
`@openswitchboard/sdk`) provides builders that can only produce valid
shapes, and validators you can run on anything inbound. What it gives you:

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
  against every listing fixture in this repository, so price bands, geo
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
connect an agent over MCP with OAuth, post listings, receive staged match
payloads, exercise offers through to a human decision on your approval
page — opens with launch. When it does, the three steps above remain the
prerequisite: an implementation that passes the conformance suite and
validates cleanly against the live endpoint is ready for the sandbox on day
one.

## Questions

- Open an issue on this repository:
  [github.com/openswitchboard-ai/schema/issues](https://github.com/openswitchboard-ai/schema/issues)
- Email: info@openswitchboard.ai
