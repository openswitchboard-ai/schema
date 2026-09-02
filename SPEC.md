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
| `schema_version` | Semver of this schema package (see §11). |
| `type` | `"WANT"` or `"HAVE"`. |
| `category` | Dotted taxonomy path, e.g. `goods.bicycle.mountain` (§2). |
| `geo` | An **area**: `{ place?, bucket?, radius_km? }`. Name the locality in `place` and the switchboard resolves it (§1.1). Exact coordinates are structurally impossible. |
| `price` | Matching input only — see §3. |
| `ask` | HAVE only: a deliberate, disclosable asking price (§3). |
| `attributes` | Typed key/values from the category's vocabulary (condition, model, colour, …). |
| `urgency` | `"none" \| "days" \| "today"` — a routing hint, nothing more. |
| `visibility` | `"anonymous-until-match"` — the only value in v1. |
| `status` | `"active"` or `"latent"`. A latent card is "back pocket" intent: held by the switchboard and surfaced only when a real match appears. |
| `ttl_days` | 1–90, default 60. Expired cards produce `INTENT_EXPIRED`. |

### 1.1 Location: name the area

A card's `geo` describes an area. An agent gives `place` — the name of a
suburb, city or region, such as `Canberra`, `Newtown, NSW` or `AU-ACT` — and
the switchboard resolves that name against its own gazetteer into a centre
point, a coarse cell (`bucket`, a geohash4) and a reach in kilometres.
`radius_km` says how far the human will travel; left out, the width of the
named area stands in. Resolution happens inside the switchboard, so nobody
outside it learns what an agent looked up.

Matching then compares centre points: two cards meet when the distance
between their centres falls within the sum of their radii. An agent that
writes `Canberra` and an agent that writes `AU-ACT` therefore find each
other. Before this, a card carried only a bucket string, and two spellings
of one city were simply unequal.

An agent already holding a canonical cell may send `bucket` on its own. A
card carries at least one of the two.

The switchboard answers with what it resolved. `publish_intent`, and
`amend_intent` when the geo changed, return `location_resolved`:
`{ display, radius_km }`, where `display` is the fully qualified place —
`"Canberra, Australian Capital Territory, Australia"`. An agent reads that
back to its human as it confirms the posting, so a location that went
somewhere unintended is caught by the person who knows.

Text the switchboard will not place is refused rather than guessed at.
`LOCATION_UNRESOLVED` (§9) covers four shapes: a street address; a name the
gazetteer does not know; a bare state or territory ("ACT", "Texas"); and a
bare country or country code ("Australia", "AU", "US"). The last two are
areas nobody lives in the middle of — resolving them silently puts a card
hundreds of kilometres from the human it belongs to — so the error names what
it heard and asks for a town or city inside it. The deliberate forms still
work: `AU-ACT` and `US-CA` say plainly that the whole division is meant, and
a comma-qualified name (`Newtown, NSW`) settles itself.

`LOCATION_AMBIGUOUS` covers the rest: a bare name that several cities answer
to. `Perth` is a city in Western Australia and a city in Scotland, and
picking the bigger one silently is how a card ends up on the wrong continent.
The error carries `candidates` — up to five, largest first, each with a
`display` to put to a human and a `place` string that selects it — so the
agent can ask which one and repost with the qualified form. One case resolves
without asking: when a single candidate is at least ten times the population
of every other and no rival is a town in its own right, `Paris` is Paris.

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

Categories form a dotted tree. The v2 taxonomy (`data/taxonomy.v2.json`)
holds around 590 nodes across five top levels, each node carrying a human
label and, where it helps, a typed attribute vocabulary.

Three top levels are open:

- **`goods.*`** — secondhand consumer goods: bikes, furniture, electronics,
  appliances, clothing, sports gear, instruments, baby things, tools, books,
  toys, household and garden items, art, hobby and building materials, pet
  supplies, vehicle parts.
- **`services.*`** — everyday help between neighbours: tutoring, lessons,
  repairs, gardening, moving help, tech help, pet care, errands, creative
  work, event help, admin help.
- **`social.*`** — people to do things with: conversation, language exchange,
  activity partners, hobby groups, community and volunteering, going along to
  things, travel company, family company.

`work.*` and `property.*` are reserved. The nodes are named in the taxonomy so
the shape of those verticals is public, and cards posted under them are
rejected with `CATEGORY_PROHIBITED`.

### Reserved nodes

A single node can also be reserved, and reserving it reserves everything
beneath it. Each reserved node says why:

- `licensed-trade` — the work needs a licence in most places the switchboard
  runs. This covers `services.trades.*` (electrical, plumbing, gas fitting,
  building, roofing, motor vehicle repair and their kin), `services.health.*`,
  `services.legal.*`, `services.financial.*`, `services.driving.*` and
  `services.security.*`.
- `regulated-vertical` — a family held back deliberately at launch, pending a
  policy that does it justice. This covers `social.dating.*`,
  `social.support.*`, `services.childcare.*`, `services.food.*` and
  `goods.vehicles.*`.

The whole rule is: a category may be posted when its top level is open, the
node exists, and no node on its path — itself included — is reserved. Every
deployment applies that rule identically. There is no per-environment category
mode.

### Categories outside the taxonomy

A category that resolves to `unknown` or `reserved` is refused with
`CATEGORY_PROHIBITED`. The refusal is a taxonomy decision and nothing else
decides it. Alongside the refusal a server SHOULD name up to three of the
closest open nodes, so an agent can correct itself on the next call:

```
That category isn't in the taxonomy. Closest open ones:
goods.electronics.laptop, goods.electronics.tablet, goods.electronics.desktop.
```

Suggestions are a courtesy. A server that cannot compute them still refuses
the card the same way.

### Attributes carry the specifics

Where a distinction is an attribute of the activity rather than a kind of
thing, the taxonomy says so. Language exchange lives at
`social.language-exchange` with `language` as an attribute, so Italian and
Japanese practice sit in one node and match through the attribute. Laptops
live at `goods.electronics.laptop` with `brand`, `model`, `ram_gb` and
`storage_gb` as attributes; a MacBook Air is that node plus those values.

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
- an **offer** — a negotiation message (§6), never a card field.

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
   and the switchboard steps back to carrier role (§5).

## 5. Patched through: how the conversation travels

Once a channel is open the two people are talking, and each of them is talking
through the assistant they already use. Neither of them is given an inbox to
check or an application to open. One person says something to their own agent,
that agent hands the words to the switchboard, and the agent on the other side
collects them and passes them on to its human in the ordinary course of
conversation. Each message is carried as a `channel.message`
(`schemas/channel.message.json`).

The switchboard's part in this is carrying. A message handed to it is held
encrypted until the agent it is addressed to comes and collects it, and
collecting it is what removes it, so the moment a message has been handed over
the switchboard no longer holds it. Anything left uncollected is dropped
fourteen days after it was sent. The words themselves are never written to the
consent log, never written to the service's own logs, and never gathered into
anything an operator can read afterwards. What an operator can see is that a
channel carried some number of messages.

Because collecting a message is what deletes it, an agent gets one attempt at
each batch. An agent that fails part-way through loses that batch, and there is
no second copy anywhere to fetch it from again. This follows from keeping
nothing, and it means an agent should pass a message on to its human as soon as
it has collected it.

Every message an agent collects is wrapped and labelled as the other side's
words (§8), and that label carries the safety of this step on its own. The
switchboard does not read what passes through it, and no automatic screening
runs over a conversation between two people. An agent that receives a message
shows it to its human. Anything in it that asks for a decision — a time to
meet, a price, something more about them — is put to the human in the agent's
own words, and the human decides.

A message can be up to 4000 characters. The channel exists only between the two
accounts of a match that has reached stage 4, so an agent outside that pair can
neither send to it nor collect from it, and it stops carrying when either card
is withdrawn or when an account's agent tokens are suspended. A card that
simply reaches the end of its life leaves the channel alone, since two people
already talking should keep talking. A
deployment states its own sending rate; the reference deployment allows each
side sixty messages an hour on any one channel and answers a request past that
with `QUOTA_EXCEEDED` and a `retry_after`.

If the conversation arrives at an agreed price, the switchboard has somewhere
for it to go: a settlement (§7) holds the money until the buyer's human
confirms that what they were promised arrived.

## 6. Negotiation: offers

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
  (`RATE_LIMITED_OFFERS` throttles brute-force probing of the same kind. It
  caps offers within one match. The read surface has its own separate
  ceiling, `RATE_LIMITED`, described in §9.)

## 7. Settlement: safe hands

A settlement (`schemas/settlement.json`) moves an agreed amount from the
buyer's human to the seller's human with the switchboard holding the payment
in between. It exists only on a match that has reached stage 3.

```
proposed → approved-by-buyer / approved-by-seller → approved
         → funded → evidence-locked → confirmed → released
                                    → disputed  → refunded
```

Either human can decline an unfunded settlement; `declined`, `released` and
`refunded` are terminal.

The agent surface is deliberately thin: an agent can **propose** a settlement
and **read** its state. Everything else happens elsewhere:

- **Approval, confirmation and dispute** are recorded from the humans on
  their approval pages, behind their PIN or passkey.
- **`funded`, `released` and `refunded`** are recorded only from the payment
  provider's verified events. The buyer pays on the provider's hosted page;
  card details never touch the switchboard.
- **`evidence-locked`** freezes the seller's handover evidence (photos and a
  manifest) in a write-once store before the buyer is asked to confirm.

The enum contains no agent-level approve, release or refund state — the same
design as offers (§6): agents propose; only humans (and the payment
provider's own verified events) move money. Declines carry no reason field
here either.

Deployments without settlement handling answer `settle` calls with the
`SETTLEMENT_UNAVAILABLE` error code (§9).

## 8. Provenance labels

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

## 9. Errors: machine-readable lessons

Errors (`schemas/error.json`) are a closed vocabulary designed so an agent
can act correctly without parsing prose:

`CONSENT_REQUIRED` · `SCHEMA_VERSION_UNSUPPORTED` · `QUOTA_EXCEEDED` ·
`CATEGORY_PROHIBITED` · `STAGE_LOCKED` · `INTENT_EXPIRED` ·
`SCREENING_REJECTED` · `RATE_LIMITED` · `RATE_LIMITED_OFFERS` ·
`SETTLEMENT_UNAVAILABLE` · `LOCATION_UNRESOLVED` · `LOCATION_AMBIGUOUS`

Shape: `{ code, human_action?, retry_after?, candidates?, docs_url }`.
`human_action` tells the agent what only its human can do (e.g. approve a
consent gate); `retry_after` tells it when trying again might work;
`candidates` rides on `LOCATION_AMBIGUOUS` and lists the places a name could
have meant (§1.1).

Two of those are rate limits, and they hold different lines.
`RATE_LIMITED_OFFERS` caps offers on one match, which is what price probing
looks like (§6). `RATE_LIMITED` covers the read surface. An agent that can
wake itself can call `check_matches`, `channel_receive` and `list_intents` in
a loop for nothing, so a deployment may hold those three together to one
per-account ceiling; the reference deployment allows sixty calls an hour
across all three, counted on a sliding window. Past it the call is refused
with `RATE_LIMITED` and a `retry_after` in seconds, and an agent waits that
long before trying again. A refused `channel_receive` collects nothing and so
deletes nothing, so a waiting batch is still waiting afterwards.

## 10. Deny list

Prohibited categories are declared per jurisdiction in a machine-readable
document (`schemas/deny-list.json`): entries of
`{ jurisdiction, denied: [category-glob], reason_code, status }`. The seed
list (`data/deny-list.seed.json`) denies weapons, prescription medication and
live animals outright, and carries jurisdiction-wide screening reason codes
for stolen-goods markers and recalled goods (enforced at screening time as
`SCREENING_REJECTED` on any goods category). Grey zones — alcohol, event
tickets, wildlife products — are marked `vertical-policy-pending`: not open,
pending a per-vertical policy, rather than permanently prohibited.

## 11. Versioning and governance

The schema package is semver-versioned. Every card and payload carries
`schema_version`. Servers MUST reject an unknown MAJOR version with
`SCHEMA_VERSION_UNSUPPORTED`; MINOR and PATCH changes are additive and
backward-compatible. See `CHANGELOG.md` for history.

Governance note: the taxonomy is maintained by the operator **in public** —
benevolent-dictator for now, with a governance group planned once third-party
verticals exist. Taxonomy changes go through the process in
`CONTRIBUTING.md`.

## 12. Conformance

`npm test` validates every fixture in `fixtures/` against its schema, with
expected pass/fail **and** failure-reason assertions (an invalid fixture must
fail for the right rule, not incidentally). The same suite is exported as a
library (`runConformance`) so third-party implementations can prove they
accept and reject exactly what this specification requires.

---

*Copyright OpenSwitchboard contributors. Licensed under Apache-2.0.*
