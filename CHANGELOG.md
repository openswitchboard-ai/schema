# Changelog

All notable changes to the OpenSwitchboard protocol schemas.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: semver.
Servers reject unknown MAJOR versions with `SCHEMA_VERSION_UNSUPPORTED`.

Governance note: the taxonomy is maintained by the operator in public —
benevolent-dictator for now; a governance group is planned once third-party
verticals exist.

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
