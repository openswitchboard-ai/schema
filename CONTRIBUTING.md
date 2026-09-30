# Contributing

Thanks for helping build the open protocol for AI intent.

## Contributor Licence Agreement

Anything accepted into this repository needs a signed CLA — see [CLA.md](CLA.md).
It keeps copyright in one place, which is what makes future relicensing or
dual-licensing possible. A bot asks for it on your first pull request, and
signing is one comment.

## Ground rules

- The protocol's invariants are not up for negotiation in a PR: no identity
  fields on a want or a have, price bands never disclosed, no agent-level accept, no
  decline reasons, provenance labels on all free text. A change that weakens
  one of these needs a design discussion (open an issue) rather than a patch.
- Every schema change must ship with fixtures: at least one valid example and
  one must-fail example whose `error_contains` pins the new rule.
- `npm run lint && npm test` must be green.

## Taxonomy-change process

The taxonomy (`data/taxonomy.v2.json`) is maintained by the operator in
public — benevolent-dictator model for now; a governance group is planned
once third-party verticals exist.

1. **Open an issue** titled `taxonomy: <proposed node>` describing the node,
   its parent, its attribute vocabulary, and real demand for it (why matching
   fails without it).
2. **Discussion window** of at least 7 days for a new node; 14 days for
   renames/removals (which are breaking and ride the next MAJOR).
3. **PR** adding the node plus fixtures using it. Additive nodes land in a
   MINOR release. A new leaf needs a `phrase`, and it needs a `default_reach`
   unless it fails the three tests in SPEC §2 — in which case it carries none,
   which is the honest answer and costs nothing.
4. Reserved top levels (`work.*`, `property.*`) and reserved nodes (licensed
   trades, dating and their kin — see SPEC §2) are opened by the operator
   only, alongside a vertical policy. A PR that flips a `status` field on its
   own will be closed with a pointer back to this step.

## Versioning

Semver on the package. Additive, backward-compatible schema changes = MINOR.
Anything that makes a previously-valid document invalid = MAJOR. Servers
reject unknown MAJOR versions with `SCHEMA_VERSION_UNSUPPORTED`.
