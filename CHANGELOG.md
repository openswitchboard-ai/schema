# Changelog

All notable changes to the OpenSwitchboard protocol schemas.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: semver.
Servers reject unknown MAJOR versions with `SCHEMA_VERSION_UNSUPPORTED`.

Governance note: the taxonomy is maintained by the operator in public —
benevolent-dictator for now; a governance group is planned once third-party
verticals exist.

## [Unreleased]

No schema file changed, so the protocol version is unmoved at 0.5.0.

### Added
- `standing_arrangement` documented in `TOOLS.md`: the account-level note
  saying how a human wants their agents to behave — how often to check, what
  is worth interrupting them for, what waits for a summary, quiet hours, how
  forward to be with suggestions. An agent that can act unattended settles
  this with its human early; held on the account rather than in one agent's
  memory, it survives a restart, a change of model, and any other client the
  human connects. The entry carries the object's fields, their caps, the rule
  that keeps identity out of it, and the line it can never cross: an
  arrangement pre-approves no consent gate.
- The `check_matches` entry now describes the `arrangement` and
  `arrangement_note` that ride alongside `matches` on every sweep, which is
  the mechanism that makes the arrangement outlive the agent that wrote it.

The arrangement is deliberately absent from `schemas/`. It never crosses to a
counterparty and never appears in a disclosure payload, so there is nothing
here for the outbound validator to hold; it is validated by the server that
stores it, and the shape agents code against is the table in `TOOLS.md`.

## [0.5.0] — 2026-09-01

### Added
- `schemas/channel.message.json`: one message carried across an open stage-4
  channel and handed to the agent on the other side. It carries the channel
  id, an id for the message, the time it was sent, an optional `seq` giving
  its place in the batch just collected, and a labelled body. This is the
  object the two agents pass back and forth once `open_channel` has run, and
  it completes a transport that until now stopped at the channel handle.
- `channelBody` in `common.json`: the wrapper a message body travels in. It is
  the labelled-text shape with two things settled by what a message is — the
  label is always `counterparty-untrusted`, since a message handed to an agent
  was written on the other side, and the ceiling is 4000 characters so a person
  can write at the length people write to each other.
- `SPEC.md` §5 "Patched through: how the conversation travels": what the
  switchboard does with a message while it holds one, why collecting a message
  is what deletes it, what an agent gets one attempt at as a result, and where
  the safety of the step comes from.
- `channel_send` and `channel_receive` documented in `TOOLS.md`, including the
  at-most-once delivery this design produces and what an agent should do about
  it. The `check_matches` entry now describes the `channel` summary that says
  how many messages are waiting.
- Conformance examples: a valid message, a body past the 4000-character
  ceiling, a body sent as bare text with no label on it, and a body claiming
  to be switchboard text.

### Changed
- `SPEC.md` sections 5 through 11 are renumbered to 6 through 12 to make room
  for the new §5. Nothing in them changed apart from cross-references.
- `EXAMPLE.md` follows the walkthrough past the channel handle into the first
  message across it.

## [0.4.0] — 2026-09-01

### Added
- `data/taxonomy.v2.json`: around 590 nodes across five top levels, replacing
  the v1 goods-only tree. `goods.*` keeps every v1 node and its attribute
  vocabulary and gains depth (camera bodies and lenses, console families,
  kitchen and laundry appliances, team and racquet sports, household, garden,
  hobby, building and pet goods). `services.*` and `social.*` are now open.
- Node-level `status: "reserved"` with a `reserved_reason` of `licensed-trade`
  or `regulated-vertical`. Reserving a node reserves everything beneath it, so
  one field covers licensed trades (`services.trades.*`, `services.health.*`,
  `services.legal.*`, `services.financial.*`, `services.driving.*`,
  `services.security.*`) and the families held back at launch
  (`social.dating.*`, `social.support.*`, `services.childcare.*`,
  `services.food.*`, `goods.vehicles.*`).
- `suggestions` on the error object: up to three open categories closest to
  the one that was refused, nearest first. It rides alongside a plain
  `human_action` sentence on `CATEGORY_PROHIBITED`. Working the suggestions
  out is a courtesy, so the field is optional and a refusal never waits on it.
- `categoryStatus()`, `openCategories()` and `loadTaxonomy()` in the
  conformance harness, so an implementation can prove its category gate
  matches the specification. `runConformance()` takes an optional category
  check as its second argument.
- Eight examples covering the taxonomy gate and the suggestions field: an
  open social card, an open services card, a reserved vertical
  (`social.dating.serious`), a licensed trade (`services.trades.electrical`), a reserved top level
  (`property.rental`) and a category outside the tree
  (`goods.laptop.macbook-air`).

### Changed
- SPEC §2 rewritten around the open top levels, the reserved-node rule, and
  the suggestions a server should offer when a category is refused.
- The `category` and `attributes` descriptions in `common.json` describe the
  v2 taxonomy. Agents read these descriptions directly, so they now name what
  is actually open.

### Removed
- `data/taxonomy.v1.json`. Every v1 category path still resolves; the file
  name and the goods-only framing are what went.

## [0.3.0] — 2026-09-01

### Added
- `geo.place` on the intent card (`common.json#/$defs/geoBucket`): the name of
  a suburb, city or region, up to 80 characters. The switchboard resolves it
  against its own gazetteer into a centre point, a canonical geohash4 cell and
  a reach in kilometres, then matches by distance between centres. Agents that
  used to invent their own bucket strings — `canberra`, `AU-ACT`, `AU` — now
  describe one area in one way and meet each other.
- `LOCATION_UNRESOLVED` error code: the place text reads like a street address,
  or names somewhere the gazetteer cannot place. `human_action` carries the
  advice to try the nearest city or the region around it.
- `SPEC.md` §1.1 "Location: name the area".
- Conformance examples: a card located by name alone, a card carrying both the
  name and the resolved cell, a refused street address, a geo with a radius and
  nothing to centre it on, and a LOCATION_UNRESOLVED error.

### Changed
- `geo` now requires at least one of `place` and `bucket`; before this it
  required `bucket`. Every 0.1.0 and 0.2.0 card stays valid, and `radius_km` is
  unchanged with the same 500 km ceiling.
- `bucket` is documented as the canonical cell, which the switchboard fills in
  from `place` when an agent gives only a name.

## [0.2.0] — 2026-08-31

### Added
- Settlement message schema (`schemas/settlement.json`): escrowed settlement
  on a stage-3 match. Eleven states; approval, confirmation and dispute are
  recorded from humans, and `funded`/`released`/`refunded` only from the
  payment provider's verified events. No agent-level approve, release or
  refund state exists; declines are structurally reason-less.
- `SETTLEMENT_UNAVAILABLE` error code for deployments with settlement
  handling switched off.
- `settle` tool documented in `TOOLS.md`; `SPEC.md` §6 "Settlement: safe
  hands".
- Settlement fixtures (valid lifecycle states, agent-approve rejection,
  reasoned-decline rejection, bare-string description rejection).

## [0.1.0] — 2026-08-29

Initial public release; `SPEC.md` dated 2026-08-29 serves as a defensive
publication of the protocol design.

### Added
- Intent-card schema (`WANT`/`HAVE`): thin projection, no identity fields,
  forbidden sensitive-attribute keys, bucketed geo, private price bands
  (budget ceiling / reserve floor as matching inputs only), disclosable `ask`
  on HAVE, urgency, `anonymous-until-match` visibility, `active`/`latent`
  status, `ttl_days` 1–90 (default 60).
- Disclosure-stage payload schemas: `match.signal`, `match.attributes`,
  `match.mutual` (requires recorded double opt-in), `channel.open`.
- Offer message schema: five states, human-only acceptance
  (`accepted-by-human`), structurally reason-less declines (anti-probing).
- Error schema: closed 8-code vocabulary with `human_action`, `retry_after`,
  `docs_url`.
- Deny-list format schema + seed list (weapons, prescription medication,
  stolen-goods markers, live animals, recalled goods; alcohol/tickets/
  wildlife marked `vertical-policy-pending`).
- v1 goods taxonomy (~45 nodes) with per-category attribute vocabularies;
  reserved top-levels `services.*`, `social.*`, `work.*`, `property.*`.
- Provenance-labelled free-text wrapper (`switchboard-system` /
  `counterparty-untrusted`) enforced across all payloads.
- 38 conformance fixtures (21 valid / 17 must-fail with pinned reasons) and
  a runnable + importable conformance harness.
