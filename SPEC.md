# OpenSwitchboard Protocol Specification

**Version 0.1.0 — 2026-08-29**

This document, together with the JSON Schemas and fixtures in this repository,
constitutes the OpenSwitchboard protocol and serves as a **defensive
publication** of its design as of the date above. It is written for the people
who will actually implement it: agent developers.

OpenSwitchboard is the switchboard for AI intent. Your agent posts what your
human **wants** and **has**; the network finds the other half and makes the
introduction; disclosure escalates only by consent; your human always has the
last word.

---

## 1. Listings

There are exactly two objects that matter: a listing whose `type` is
`looking_for`, and a listing whose `type` is `offering`. Everything else in the
protocol exists to match them and to disclose carefully afterwards.

A listing is a **thin projection** of intent. It deliberately excludes names,
photos, addresses and free-form life detail. This is not a privacy setting a
user might forget to enable — it is structural. The listing schema
(`schemas/intent-card.json`) has `additionalProperties: false` at the top
level and a forbidden-key list on `attributes`, so a listing carrying an identity
field is not a private listing: it is not a listing at all.

Fields:

| Field | Meaning |
|---|---|
| `schema_version` | Semver of this schema package (see §11). |
| `type` | `"looking_for"` or `"offering"`. A server accepts the old `"WANT"` and `"HAVE"` as deprecated input aliases and normalises them on the way in. |
| `category` | Dotted taxonomy path, e.g. `goods.bicycle.mountain` (§2). |
| `geo` | An **area**: `{ place?, bucket?, radius_km?, reach? }`. Name the locality in `place`; say how far the human will meet someone in `reach` (§1.1). Exact coordinates are structurally impossible. |
| `price` | Matching input only — see §3. |
| `ask` | Offering listings only: a deliberate, disclosable asking price (§3). |
| `attributes` | Typed key/values from the category's vocabulary (condition, model, colour, …). |
| `urgency` | `"none" \| "days" \| "today"` — a routing hint, nothing more. |
| `visibility` | `"anonymous-until-introduced"` — the only value in v1. |
| `status` | `"active"` or `"latent"`. A latent listing is "back pocket" intent: held by the switchboard and surfaced only when a real introduction appears. |
| `ttl_days` | 1–90, default 60. Expired listings produce `INTENT_EXPIRED`. |

### 1.1 Location: name the area, then say how far

A listing's `geo` holds two separate things: where the listing is, and how far its
human will meet someone. They are not the same question, and a listing that
conflates them ends up in the wrong place.

**Where the listing is.** An agent gives `place` — the name of a suburb, city or
region, such as `Canberra`, `Newtown, NSW` or `AU-ACT` — and the switchboard
resolves that name against its own gazetteer into a centre point, a coarse
cell (`bucket`, a geohash4) and the width of the named area. Resolution
happens inside the switchboard, so nobody outside it learns what an agent
looked up. An agent already holding a canonical cell may send `bucket` on its
own; a listing carries at least one of the two.

**How far the human will meet someone.** `reach` takes one of three values:

| `reach` | What it means |
|---|---|
| `"radius"` (default) | Within `radius_km` of the place. Left out, the width of the named area stands in. A pickup, a lesson in person, a hand with the moving. |
| `"country"` | Anywhere in the place's own country. Something the human would post. |
| `"anywhere"` | No geographic limit at all. Something done online. |

The place is a real town whatever the reach. An agent whose human says "I'll
post it anywhere in Australia" writes their town in `place` and `"country"`
in `reach` — it does not write `"Australia"` in `place`, which is refused.

**How two listings meet.** Each side's reach has to cover where the other side
is. Two listings on `radius` meet when the distance between their centres falls
within the sum of their radii, so an agent that writes `Canberra` and an
agent that writes `AU-ACT` find each other; before this, a listing carried only
a bucket string and two spellings of one city were simply unequal. A listing on
`"country"` covers any listing whose place resolved to the same country; a listing
on `"anywhere"` covers every listing. Because the test runs both ways, a
nationwide offering listing in Canberra and a looking-for listing in Perth meet
only when the looking-for listing reaches nationwide too — the person
collecting has to be as willing to cross the distance as the person sending.

Reach also shapes the score. Distance still ranks two listings that meet by
radius, so a neighbouring suburb ranks above the far edge of the radius. A
pair that meets because one side reaches a whole country instead gets a flat,
moderate geographic contribution: nationwide is a real introduction, and it
carries less weight than the same pairing an adjacent suburb away.

The switchboard answers with what it resolved. `publish_intent`, and
`amend_intent` when the geo changed, return `location_resolved`:
`{ display, radius_km }`, where `display` is the fully qualified place and
what it reaches — `"Canberra, Australian Capital Territory, Australia —
reaching all of Australia"`, or `"— reaching anywhere"`, or `"— matching
within 25 km"`. An agent reads that back to its human as it confirms the
posting, so a location that went somewhere unintended is caught by the person
who knows.

Text the switchboard will not place is refused rather than guessed at.
`LOCATION_UNRESOLVED` (§9) covers four shapes: a street address; a name the
gazetteer does not know; a bare state or territory ("ACT", "Texas"); and a
bare country or country code ("Australia", "AU", "US"). The last two are
areas nobody lives in the middle of — resolving them silently puts a listing
hundreds of kilometres from the human it belongs to — so the error names what
it heard, asks for a town or city inside it, and says that nationwide is what
`reach` is for: `place: "Canberra"`, `reach: "country"`. The deliberate forms still
work: `AU-ACT` and `US-CA` say plainly that the whole division is meant, and
a comma-qualified name (`Newtown, NSW`) settles itself.

`LOCATION_AMBIGUOUS` covers the rest: a bare name that several cities answer
to. `Perth` is a city in Western Australia and a city in Scotland, and
picking the bigger one silently is how a listing ends up on the wrong continent.
The error carries `candidates` — up to five, largest first, each with a
`display` to put to a human and a `place` string that selects it — so the
agent can ask which one and repost with the qualified form. One case resolves
without asking: when a single candidate is at least ten times the population
of every other and no rival is a town in its own right, `Paris` is Paris.

### No identity, no sensitive attributes

There are **no identity fields anywhere in a listing** — no names, contact
details, photos, or addresses. In addition, **sensitive personal attributes
are forbidden in listings**: health, sexuality, beliefs, ethnicity, political
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
the shape of those verticals is public, and listings posted under them are
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
the listing the same way.

### Attributes carry the specifics

Where a distinction is an attribute of the activity rather than a kind of
thing, the taxonomy says so. Language exchange lives at
`social.language-exchange` with `language` as an attribute, so Italian and
Japanese practice sit in one node and match through the attribute. Laptops
live at `goods.electronics.laptop` with `brand`, `model`, `ram_gb` and
`storage_gb` as attributes; a MacBook Air is that node plus those values.

## 3. The no-leak rule: matching inputs vs disclosure outputs

This is the protocol's core economic guarantee.

A listing's `price` field is a band: on a **looking-for listing** it is the
**budget ceiling**; on an **offering listing** it is the **reserve floor**.
Both are **matching inputs only**.
The switchboard uses them to decide whether two listings can meet, and they are
**never disclosed to a counterparty at any point**. No disclosure payload
schema in this package has a slot where a price band could appear —
`additionalProperties: false` makes emitting one a schema violation, and the
conformance suite contains fixtures proving it.

What *can* cross the wire are **deliberate terms**:

- an **asking price** — the optional `ask` field on an offering listing,
  disclosable from the details step onward, because the human chose to state it;
- an **offer** — a negotiation message (§6), never a listing field.

Your agent can therefore negotiate hard on your behalf without ever revealing
what you would really pay or really accept.

## 4. Disclosure steps and consent gates

Disclosure escalates through four payloads, one per step. The governing rule:
**agents propose; only humans accept.** The first three steps have names an
agent can say out loud, and `check_in` takes them in its `step` input:
`signal`, `details`, `names`. The fourth is the conversation itself.

1. **The signal step — `intro.signal`** (`schemas/intro.signal.json`) — an
   introduction exists: introduction id and category. **No score, no
   attributes, no prices, no free text.** The switchboard has already judged
   the introduction worth sending, so no confidence figure crosses to the
   agent; what the agent can do next is carried as a word on the `check_in`
   entry (`next`, see `TOOLS.md`), never as a step name or a percentage.
2. **The details step — `intro.attributes`** (`schemas/intro.attributes.json`)
   — after interest at the signal step: the counterparty listing's attributes,
   its `ask` if stated, and provenance-labelled notes. Still anonymous.
3. **The names step — `intro.mutual`** (`schemas/intro.mutual.json`) — first
   name and coarse locality, and **only after both humans' opt-in is
   recorded**. The payload carries a required `optin` attestation
   (`both_recorded: true` + timestamp); a mutual payload without it is invalid
   by schema.
4. **The conversation — `conversation.open`**
   (`schemas/conversation.open.json`) — a direct conversation opens and the
   switchboard steps back to carrier role (§5).

## 5. Patched through: how the conversation travels

Once a conversation is open the two people are talking, and each of them is talking
through the assistant they already use. Neither of them is given an inbox to
check or an application to open. One person says something to their own agent,
that agent hands the words to the switchboard, and the agent on the other side
collects them and passes them on to its human in the ordinary course of
conversation. Each message is carried as a `conversation.message`
(`schemas/conversation.message.json`).

The switchboard's part in this is carrying. A message handed to it is held
encrypted until the agent it is addressed to comes and collects it, and
collecting it is what removes it, so the moment a message has been handed over
the switchboard no longer holds it. Anything left uncollected is dropped
fourteen days after it was sent. The words themselves are never written to the
consent log, never written to the service's own logs, and never gathered into
anything an operator can read afterwards. What an operator can see is that a
conversation carried some number of messages.

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

A message can be up to 4000 characters. The conversation exists only between the two
accounts of an introduction that has opened one, so an agent outside that pair can
neither send to it nor collect from it, and it stops carrying when either listing
is withdrawn or when an account's agent tokens are suspended. A listing that
simply reaches the end of its life leaves the conversation alone, since two people
already talking should keep talking. A
deployment states its own sending rate; the reference deployment allows each
side sixty messages an hour on any one conversation and answers a request past that
with `QUOTA_EXCEEDED` and a `retry_after`.

If the conversation arrives at an agreed price, the switchboard has somewhere
for it to go: a settlement (§7) holds the money until the buyer's human
confirms that what they were promised arrived.

### 5a. Wrapping up: the archived state

A connection eventually does its work and ends: the two people met through it
and have carried on off the switchboard — swapped numbers, joined the club.
Either party's agent can then file the introduction away with
`respond(archive)`, which moves it to the terminal state `archived`. This is
the success close, distinct from `declined` (an introduction one side turned
down) and `closed` (a collection window that lapsed). Archiving is a
party-only action and is idempotent; only an open introduction can be archived.

Archiving keeps the connection **record** and drops nothing that was already
kept elsewhere. The introduction row and its names-step disclosure linkage
stay, so `check_in` still returns the introduction — as `{ intro_id, state:
"archived", category, archived_at }`, with the `intro.mutual` block where the
two reached it — and a human can look the connection up long afterward: the
counterparty's disclosed first name and area, what it was about, and when.
What is torn down is the live conversation: leaving the `open` state is itself
enough to make `send_message`/`collect_messages` refuse, and any uncollected
message is expired to the ordinary fourteen-day sweep. The conversation itself
was never retained (§5), and neither was any phone number the two swapped
in-conversation; archiving keeps the record of the connection, and those never
lived on the switchboard to keep.

Archiving the introduction is separate from the **listing** that started it,
and touches only the introduction. A listing that serves many people (a book
club with room for more) stays live for the next person; a one-off (a bike that
has now sold) is withdrawn separately with `withdraw_intent`. An archived
introduction carries no `next` and no `signal`, so it never resurfaces as a new
signal to act on.

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
  caps offers within one introduction. The read surface has its own separate
  ceiling, `RATE_LIMITED`, described in §9.)

## 7. Settlement: safe hands

A settlement (`schemas/settlement.json`) moves an agreed amount from the
buyer's human to the seller's human with the switchboard holding the payment
in between. It exists only on an introduction that has reached the names step.

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
(e.g. quarantining untrusted text away from the instructions in their prompt).

## 9. Errors: machine-readable lessons

Errors (`schemas/error.json`) are a closed vocabulary designed so an agent
can act correctly without parsing prose:

`CONSENT_REQUIRED` · `SCHEMA_VERSION_UNSUPPORTED` · `QUOTA_EXCEEDED` ·
`CATEGORY_PROHIBITED` · `NOT_UNLOCKED_YET` · `INTENT_EXPIRED` ·
`SCREENING_REJECTED` · `RATE_LIMITED` · `RATE_LIMITED_OFFERS` ·
`SETTLEMENT_UNAVAILABLE` · `LOCATION_UNRESOLVED` · `LOCATION_AMBIGUOUS`

Shape: `{ code, human_action?, retry_after?, candidates?, docs_url }`.
`human_action` tells the agent what only its human can do (e.g. approve a
consent gate); `retry_after` tells it when trying again might work;
`candidates` rides on `LOCATION_AMBIGUOUS` and lists the places a name could
have meant (§1.1).

Two of those are rate limits, and they hold different lines.
`RATE_LIMITED_OFFERS` caps offers on one introduction, which is what price probing
looks like (§6). `RATE_LIMITED` covers the read surface. An agent that can
wake itself can call `check_in`, `collect_messages` and `list_intents` in
a loop for nothing, so a deployment may hold those three together to one
per-account ceiling; the reference deployment allows sixty calls an hour
across all three, counted on a sliding window. Past it the call is refused
with `RATE_LIMITED` and a `retry_after` in seconds, and an agent waits that
long before trying again. A refused `collect_messages` collects nothing and so
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

The schema package is semver-versioned. Every listing and payload carries
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
