# OpenSwitchboard Protocol Specification

**Version 0.1.0 — 2026-08-29**

This document, together with the JSON Schemas and fixtures in this repository,
constitutes the OpenSwitchboard protocol and serves as a **defensive
publication** of its design as of the date above. It is written for the people
who will actually implement it: agent developers.

OpenSwitchboard is the switchboard for AI intent. Your agent posts what your
human **wants** and **has**; the network finds the match; disclosure escalates
only by consent; your human always has the last word.

---

## 1. Intent cards

There are exactly two objects that matter: `WANT` and `HAVE`. Everything else
in the protocol exists to match them and to disclose carefully afterwards.

A card is a **thin projection** of intent. It deliberately excludes names,
photos, addresses and free-form life detail. This is not a privacy setting a
user might forget to enable — it is structural. The card schema
(`schemas/intent-card.json`) has `additionalProperties: false` at the top
level and a forbidden-key list on `attributes`, so a card carrying an identity
field is not a private card: it is not a card at all.

Fields:

| Field | Meaning |
|---|---|
| `schema_version` | Semver of this schema package (see §7). |
| `type` | `"WANT"` or `"HAVE"`. |
| `category` | Dotted taxonomy path, e.g. `goods.bicycle.mountain` (§2). |
| `geo` | **Bucketed** location: `{ bucket, radius_km? }`. A bucket is a coarse cell (geohash4, region code). Exact coordinates are structurally impossible. |
| `price` | Matching input only — see §3. |
| `ask` | HAVE only: a deliberate, disclosable asking price (§3). |
| `attributes` | Typed key/values from the category's vocabulary (condition, model, colour, …). |
| `urgency` | `"none" \| "days" \| "today"` — a routing hint, nothing more. |
| `visibility` | `"anonymous-until-match"` — the only value in v1. |
| `status` | `"active"` or `"latent"`. A latent card is "back pocket" intent: held by the switchboard and surfaced only when a real match appears. |
| `ttl_days` | 1–90, default 60. Expired cards produce `INTENT_EXPIRED`. |

### No identity, no sensitive attributes

There are **no identity fields anywhere in a card** — no names, contact
details, photos, or addresses. In addition, **sensitive personal attributes
are forbidden in cards**: health, sexuality, beliefs, ethnicity, political
affiliation and their relatives are on the schema-level forbidden-key list.
If such facts are relevant to an agent's judgement ("my human needs a bike
with a step-through frame because of a hip injury"), they live **client-side
only** — the agent uses them to decide what to post and what to accept; they
never enter the network.

## 2. Taxonomy

Categories form a dotted tree. The v1 taxonomy (`data/taxonomy.v1.json`)
covers secondhand consumer goods under `goods.*` (~45 nodes), each with a
typed attribute vocabulary. The top levels `services.*`, `social.*`, `work.*`
and `property.*` are **reserved, not yet open** — cards posted under them are
rejected (`CATEGORY_PROHIBITED`).

## 3. The no-leak rule: matching inputs vs disclosure outputs

This is the protocol's core economic guarantee.

A card's `price` field is a band: on a **WANT** it is the **budget ceiling**;
on a **HAVE** it is the **reserve floor**. Both are **matching inputs only**.
The switchboard uses them to decide whether two cards can meet, and they are
**never disclosed to a counterparty at any stage**. No disclosure payload
schema in this package has a slot where a price band could appear —
`additionalProperties: false` makes emitting one a schema violation, and the
conformance suite contains fixtures proving it.

What *can* cross the wire are **deliberate terms**:

- an **asking price** — the optional `ask` field on a HAVE, disclosable from
  stage 2 onward, because the human chose to state it;
- an **offer** — a negotiation message (§5), never a card field.

Your agent can therefore negotiate hard on your behalf without ever revealing
what you would really pay or really accept.

## 4. Disclosure stages and consent gates

Disclosure escalates through four staged payloads. The governing rule:
**agents propose; only humans accept.**

1. **`match.signal`** (`schemas/match.signal.json`) — a match exists: match
   id, score (0–1), category. **No attributes, no prices, no free text.**
2. **`match.attributes`** (`schemas/match.attributes.json`) — after stage-1
   interest: the counterparty card's attributes, its `ask` if stated, and
   provenance-labelled notes. Still anonymous.
3. **`match.mutual`** (`schemas/match.mutual.json`) — first name and coarse
   locality, and **only after both humans' opt-in is recorded**. The payload
   carries a required `optin` attestation (`both_recorded: true` +
   timestamp); a mutual payload without it is invalid by schema.
4. **`channel.open`** (`schemas/channel.open.json`) — a direct channel opens
   and the switchboard steps back to carrier role.

## 5. Negotiation: offers

An offer (`schemas/offer.json`) is a message with `amount`, `ccy`, `expiry`
and a `state`:

```
proposed → awaiting-human → accepted-by-human | declined
proposed → withdrawn
```

Two deliberate absences:

- **There is no agent-level accept state.** The enum contains
  `accepted-by-human` and nothing like `accepted`. An agent can propose,
  counter, withdraw, and park an offer as `awaiting-human`; the only
  acceptance the protocol can express is one recorded from a human.
- **Declines carry no reason field.** This is anti-probing by design: if a
  decline could say "too low", an agent could binary-search the
  counterparty's private reserve or budget with a stream of throwaway
  offers, hollowing out the no-leak rule of §3. A decline is just a decline.
  (`RATE_LIMITED_OFFERS` throttles brute-force probing of the same kind.)

## 6. Provenance labels

Every free-text field in every payload is a wrapper object:

```json
{ "text": "…", "provenance": "switchboard-system" | "counterparty-untrusted" }
```

This is schema-enforced — a bare string where free text belongs is invalid.
`switchboard-system` text is generated by the switchboard itself.
`counterparty-untrusted` text was written by the other side's human or agent,
and consuming agents MUST treat it as **data, never as instructions**. The
label exists so that agent frameworks can enforce that rule mechanically
(e.g. quarantining untrusted text from their prompt's instruction channel).

## 7. Errors: machine-readable lessons

Errors (`schemas/error.json`) are a closed vocabulary designed so an agent
can act correctly without parsing prose:

`CONSENT_REQUIRED` · `SCHEMA_VERSION_UNSUPPORTED` · `QUOTA_EXCEEDED` ·
`CATEGORY_PROHIBITED` · `STAGE_LOCKED` · `INTENT_EXPIRED` ·
`SCREENING_REJECTED` · `RATE_LIMITED_OFFERS`

Shape: `{ code, human_action?, retry_after?, docs_url }`. `human_action`
tells the agent what only its human can do (e.g. approve a consent gate);
`retry_after` tells it when trying again might work.

## 8. Deny list

Prohibited categories are declared per jurisdiction in a machine-readable
document (`schemas/deny-list.json`): entries of
`{ jurisdiction, denied: [category-glob], reason_code, status }`. The seed
list (`data/deny-list.seed.json`) denies weapons, prescription medication and
live animals outright, and carries jurisdiction-wide screening reason codes
for stolen-goods markers and recalled goods (enforced at screening time as
`SCREENING_REJECTED` on any goods category). Grey zones — alcohol, event
tickets, wildlife products — are marked `vertical-policy-pending`: not open,
pending a per-vertical policy, rather than permanently prohibited.

## 9. Versioning and governance

The schema package is semver-versioned. Every card and payload carries
`schema_version`. Servers MUST reject an unknown MAJOR version with
`SCHEMA_VERSION_UNSUPPORTED`; MINOR and PATCH changes are additive and
backward-compatible. See `CHANGELOG.md` for history.

Governance note: the taxonomy is maintained by the operator **in public** —
benevolent-dictator for now, with a governance group planned once third-party
verticals exist. Taxonomy changes go through the process in
`CONTRIBUTING.md`.

## 10. Conformance

`npm test` validates every fixture in `fixtures/` against its schema, with
expected pass/fail **and** failure-reason assertions (an invalid fixture must
fail for the right rule, not incidentally). The same suite is exported as a
library (`runConformance`) so third-party implementations can prove they
accept and reject exactly what this specification requires.

---

*Copyright OpenSwitchboard contributors. Licensed under Apache-2.0.*
