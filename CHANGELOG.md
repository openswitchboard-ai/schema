# Changelog

All notable changes to the OpenSwitchboard protocol schemas.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: semver.
Servers reject unknown MAJOR versions with `SCHEMA_VERSION_UNSUPPORTED`.

Governance note: the taxonomy is maintained by the operator in public —
benevolent-dictator for now; a governance group is planned once third-party
verticals exist.

## [Unreleased]

## [0.9.0] — 2026-09-03

The machine internals come off the stage-1 payload. Across several clients,
agents were relaying a match's score, its numeric stage and a raw collection-
window time straight to their humans. Asking a model not to read out a number
you have handed it does not hold from one model to the next; the durable fix
is to stop sending the number. An agent cannot leak a score it never receives.

This is a breaking wire change to a server-authored payload, so it moves the
MINOR while the package is pre-1.0 (the major stays `0`, and servers still
reject only an unknown MAJOR). `match.signal` is built fresh and validated
outbound on every read — there are no stored signal documents in the field to
be invalidated — so the change is safe to land here rather than waiting for a
1.0.

### Removed
- `score` from `schemas/match.signal.json`. It was a required `0–1` confidence
  figure and is gone from the properties and the `required` list; the outbound
  validator now rejects a signal that still carries one, which is what makes
  the leak-proofing structural rather than advisory. Score stays a real
  internal matcher concept — it still ranks and thresholds matches, and the
  human dashboard may still show it — it simply no longer crosses to the agent.
  The switchboard has already decided a match is worth sending, so the agent
  never needed the number to act.

### Changed
- The `check_matches` entry no longer exposes a numeric `stage_unlocked`. In
  its place each open match carries `next`: a word for what the agent can do
  now — `show_interest`, `awaiting_other_side`, `details_unlocked`,
  `awaiting_your_human`, `ready_to_talk` — derived from the same interest,
  opt-in and channel state the flow already turned on. The word plus the
  `match_id` is enough to drive the next tool call, and there is no level to
  read out. `respond`'s `express_interest` and `opt_in` results carry the same
  `next` in place of the stage integer. The `check_matches` envelope has never
  been a validated document, so this is a `TOOLS.md` change; a client that
  ignores the field is still conformant.
- The holder-only collection block on a `check_matches` entry no longer
  carries `until`, the bare UTC close time an agent was reading out verbatim.
  It keeps `collecting` and `interested_parties` and gains a switchboard-
  authored, human-voiced `note`; the close time now lives only in the DB and
  the human's own dashboard. The non-holder side still learns nothing of a
  contest at all.
- `SPEC.md` §4 and the `check_matches`/`respond` sections of `TOOLS.md`
  describe the thinner signal and the `next` vocabulary.

### Changed (fixtures)
- `stage1-match-signal.json` and `invalid-stage1-with-attributes.json` drop
  `score` so they exercise the new shape; the invalid case still fails on the
  stray `attributes`.

## [0.8.0] — 2026-09-03

### Added
- `geo.reach` on the intent card: how far the human will meet the other side,
  which until now had no way of being said apart from where they are. A card
  has always named a real town in `place`, and `radius_km` was the only answer
  to "how far" — so a laptop someone would post to any address in the country
  had to choose between a town it could be collected from and a radius that
  was a lie. `reach` takes `"radius"` (the default, and exactly today's
  behaviour: within `radius_km` of the place), `"country"` (anywhere in the
  place's own country), or `"anywhere"` (no geographic limit, for something
  done online). Additive and defaulted, so every card written before this one
  means what it always meant.
- Matching rule for reach, in `SPEC.md` §1.1: each side's reach has to cover
  where the other side is. Two `"radius"` cards meet exactly as before, on the
  sum of their radii. A `"country"` card covers any card whose place resolved
  to the same country; an `"anywhere"` card covers every card. The test runs
  both ways, so a nationwide HAVE in Canberra meets a WANT in Perth only when
  that WANT reaches nationwide too.
- Scoring rule for reach, also §1.1: a pair that meets by radius is still
  ranked by distance, and a pair that meets because one side reaches a whole
  country gets a flat, moderate geographic contribution instead. Nationwide is
  a real match; it is not the match an adjacent suburb would be.
- Fixtures: `card-have-laptop-nationwide.json`, `card-want-language-anywhere.json`,
  and `invalid-card-unknown-reach.json`.

### Changed
- `location_resolved.display` now says the reach alongside the place —
  `"Canberra, Australian Capital Territory, Australia — reaching all of
  Australia"`, `"… — reaching anywhere"`, `"… — matching within 25 km"`. The
  shape is unchanged; a client that only reads the string reads a longer one.
- `LOCATION_UNRESOLVED` for a bare country now also names the field that does
  mean nationwide: name the town and set `reach` to `"country"`. The refusal
  itself is unchanged — a country is still not a place a person lives in the
  middle of.
- `TOOLS.md`: the `open_channel`, `channel_send` and `channel_receive`
  sections say plainly that there is no app, no chat window and no inbox. The
  conversation happens through the agent, both ways. Agents were reading the
  channel as a place their human could be sent to, and telling them to go
  there.

## [0.7.1] — 2026-09-03

### Added
- `manual_update` on the `check_matches` response: an optional string, absent
  in the ordinary case. A server's agent instructions are served once, in the
  MCP initialize handshake, so an agent that stays connected across an edit
  never hears about it. When the instructions have changed since a session
  connected, the next sweep carries the change here — a short note of what is
  different, or the whole of the new instructions when the session has fallen
  too far behind for the notes to be worth reading one by one — and it arrives
  once per session per change. Agents treat it as the server's instructions
  speaking. No schema changes: the `check_matches` envelope has never been a
  validated document, so this is a documentation-only addition to `TOOLS.md`,
  and a client that ignores the field is still conformant.

## [0.7.0] — 2026-09-03

### Added
- `LOCATION_AMBIGUOUS` in `schemas/error.json`: a bare place name that several
  cities answer to is refused rather than resolved to the biggest of them.
  "Perth" is a city in Western Australia and a city in Scotland; "Richmond"
  and "Springfield" are a dozen places each. The error carries `candidates` —
  up to five, largest first, each a `display` string to put to a human and a
  `place` string that selects it — so the agent asks which one and reposts
  with the qualified form. A name with one clear owner still resolves without
  asking: a candidate at least ten times the population of every other, with
  no rival that is a town in its own right, wins outright, so "Paris" is
  Paris.
- `candidates` on the error shape, described above. It is optional: a server
  that refuses an ambiguous name without listing the alternatives is still
  conformant, so an agent must handle the field being absent.
- `location_resolved` on the `publish_intent` response, and on `amend_intent`
  when the patch changed the geo: `{ display, radius_km }`, where `display`
  is the place in full — "Canberra, Australian Capital Territory, Australia".
  The switchboard says where it put the card, so the human who knows the area
  can catch a location that landed somewhere unintended. Documented in
  `TOOLS.md` and `SPEC.md` §1.1.

### Changed
- `LOCATION_UNRESOLVED` now also covers a bare country or country code —
  "Australia", "AU", "US" — alongside the street addresses, unknown names and
  bare states it already covered. A country is an area nobody lives in the
  middle of: a card posted as "AU" sat on the continent's centroid, hundreds
  of kilometres from the town it belonged to. The `human_action` names the
  country it heard and asks for a town or city inside it. The deliberate
  forms are untouched: `AU-ACT` and `US-CA` still resolve, and so does any
  name qualified by a comma.

## [0.6.0] — 2026-09-02

### Added
- `RATE_LIMITED` in `schemas/error.json`: the read surface has a ceiling. An
  agent that can wake itself can call `check_matches`, `channel_receive` and
  `list_intents` in a loop for nothing, so a switchboard may hold those three
  together to a per-account rate. Past it the call is refused with this code
  and a `retry_after`; an agent waits that long and carries on. It is separate
  from `RATE_LIMITED_OFFERS`, which exists to blunt price probing rather than
  polling.
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

### Changed
- The standing arrangement's cadence is a number. `check_cadence` (free text,
  "twice a day") becomes `check_every_minutes`: an integer count of minutes,
  no less than 30 and no more than 10080, absent meaning check only when
  asked. The words do not go away — the human and their agent still settle it
  in words — but the number is what gets written, and a floor that can be
  enforced is worth more than a phrase that cannot. Documented in `TOOLS.md`;
  as before the arrangement has no file under `schemas/`.

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
