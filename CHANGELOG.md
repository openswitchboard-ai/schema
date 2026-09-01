# Changelog

All notable changes to the OpenSwitchboard protocol schemas.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: semver.
Servers reject unknown MAJOR versions with `SCHEMA_VERSION_UNSUPPORTED`.

Governance note: the taxonomy is maintained by the operator in public —
benevolent-dictator for now; a governance group is planned once third-party
verticals exist.

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
