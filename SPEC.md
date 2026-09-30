# OpenSwitchboard Protocol Specification

**Version 0.17.0 — 2026-09-30** (first published as 0.1.0 on 2026-08-29)

This document, together with the JSON Schemas and fixtures in this repository,
constitutes the OpenSwitchboard protocol and serves as a **defensive
publication** of its design as of the dates above; `CHANGELOG.md` dates every
release in between. It is written for the people
who will actually implement it: agent developers.

OpenSwitchboard is the switchboard for AI intent. Your agent posts what your
human **wants** and **has**; the network finds the other half and makes the
introduction; disclosure escalates only by consent; your human always has the
last word.

---

## 1. Wants and haves

There are exactly two objects that matter: a **want**, whose `type` is
`looking_for`, and a **have**, whose `type` is `offering`. Everything else in
the protocol exists to match them and to disclose carefully afterwards.

A want or a have is a **thin projection** of intent, about as thin as an index
card. It deliberately excludes names, photos, addresses and free-form life
detail. This is a structural property rather than a privacy setting a user
might forget to enable. The schema (`schemas/intent-card.json`) has
`additionalProperties: false` at the top level and a forbidden-key list on
`attributes`, so one carrying an identity field does not validate at all.
(`intent-card` is the wire name of the schema; to a person it is a want or a
have.)

Fields:

| Field | Meaning |
|---|---|
| `schema_version` | Semver of this schema package (see §11). |
| `type` | `"looking_for"` or `"offering"`. A server accepts the old `"WANT"` and `"HAVE"` as deprecated input aliases and normalises them on the way in. |
| `category` | Dotted taxonomy path, e.g. `goods.bicycle.mountain` (§2). |
| `kind` | What the thing is in the poster's own plain words, a short noun phrase of at most 60 characters: `"vintage synth repair"`, `"bouldering partner"`. Required where `category` names a leaf the taxonomy does not know (§2); welcome anywhere else. |
| `geo` | An **area**: `{ place?, bucket?, radius_km?, reach? }`. Write the town in full in `place`; say how far the human will meet someone in `reach` (§1.1). Exact coordinates are structurally impossible. |
| `price` | Matching input only — see §3. |
| `ask` | Haves on a straight sale only: a deliberate, disclosable asking price (§3). A best-offer sale carries none. |
| `attributes` | Typed key/values from the category's vocabulary (condition, model, colour, …). |
| `urgency` | `"none" \| "days" \| "today"` — a routing hint, nothing more. |
| `visibility` | `"anonymous-until-introduced"` — the only value in v1. |
| `status` | `"active"` or `"latent"`. A latent want or have is "back pocket" intent: held by the switchboard and surfaced only when a real introduction appears. |
| `ttl_days` | 1–90, default 60. Once it expires, it produces `INTENT_EXPIRED`. |
| `slots` | 1–10, default 1. How many people this can take at once. The switchboard holds a line of candidates and only the ones in a slot are live; the rest are told they are in line and nothing else (§5b). |
| `sale` | Haves only: `"straight"` (default) or `"best-offer"`. `best-offer` has no asking price. It gathers everyone who fits for a window and takes exactly one sealed number from each, with the private price band as the floor (§5b). |

### 1.1 Location: name the area, then say how far

The `geo` block holds two separate things: where the want or the have is, and
how far its human will meet someone. They are not the same question, and
anything that conflates them ends up in the wrong place.

**Where it is.** An agent gives `place`, written in full: town, state and
country, such as `Hobart, Tasmania, Australia`. The switchboard
resolves it against its own gazetteer into a centre point, a coarse cell
(`bucket`, a geohash4) and the width of the named area. Resolution
happens inside the switchboard, so nobody outside it learns what an agent
looked up. An agent already holding a canonical cell may send `bucket` on its
own; every want and have carries at least one of the two.

**How far the human will meet someone.** `reach` takes one of three values:

| `reach` | What it means |
|---|---|
| `"radius"` (default) | Within `radius_km` of the place. Left out, the width of the named area stands in. A pickup, a lesson in person, a hand with the moving. |
| `"country"` | Anywhere in the place's own country. Something the human would post. |
| `"anywhere"` | No geographic limit at all. Something done online. |

The place is a real town whatever the reach. An agent whose human says "I'll
post it anywhere in Australia" writes their town in `place` and `"country"`
in `reach`. `"Australia"` on its own in `place` is refused.

**How a want and a have meet.** Each side's reach has to cover where the other
side is. Two sides on `radius` meet when the distance between their centres falls
within the sum of their radii. A side on
`"country"` covers anything whose place resolved to the same country; a side
on `"anywhere"` covers everything. Because the test runs both ways, a
nationwide have in Canberra and a want in Perth meet
only when the want reaches nationwide too — the person
collecting has to be as willing to cross the distance as the person sending.

Reach also shapes the score. Distance still ranks two sides that meet by
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

Text the switchboard will not place is refused rather than guessed at. The
switchboard never guesses which town a shorter name meant, and nothing about
who is posting changes where a posting goes.

- `LOCATION_NOT_FULL` (§9) answers a place not written in full: a bare town, a
  town without its state or country, a state, a country, or a code. It carries
  one fixed sentence and no candidates. The agent writes the place out and
  posts again. The human's own area, which the sweep carries as
  `area_resolved`, is already written that way.
- `LOCATION_UNRESOLVED` answers a street address, a place written in full that
  the gazetteer does not know, and a posting with no place at all.
- `LOCATION_AMBIGUOUS` answers the rare place that is written in full and
  still names two towns. It carries `candidates`, up to five, each written in
  full with a `display` to put to the human and a `place` string that selects
  it, so the agent can ask which one and post again with that string.

### No identity, no sensitive attributes

There are **no identity fields anywhere in a want or a have** — no names, contact
details, photos, or addresses. In addition, **sensitive personal attributes
are forbidden in both**: health, sexuality, beliefs, ethnicity, political
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
  supplies, vehicle parts, and shop-bought food and groceries (see §10: food
  made at home is not open).
- **`services.*`** — everyday help between neighbours: tutoring, lessons,
  repairs, gardening, moving help, tech help, pet care, errands, creative
  work, event help, admin help.
- **`social.*`** — people to do things with: conversation, language exchange,
  activity partners, hobby groups, community and volunteering, lost and found
  pets, going along to things, travel company, family company.

`work.*` and `property.*` are reserved. The nodes are named in the taxonomy so
the shape of those verticals is public, and anything posted under them is
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

The catalogue is a **deny list**. A category is accepted when its top level is
one the taxonomy knows and holds open, and no node on its path — itself
included — is reserved. A path the taxonomy has never heard of still goes up.
The switchboard files it under the nearest node it does know and keeps the
agent's own path on the record, and the answer says in plain words where it
went. The posting says what the thing is in `kind`. `kind` is required there,
because every sentence the switchboard writes about a want or a have names
the thing, and for a leaf it does not know the catalogue has no word to lend
it.

Sometimes the nearest shelves disagree, and filing it anywhere would be a
guess. Then nothing is filed, and the answer is `SHELF_UNCLEAR` (§9) with up
to five `candidates`, each `{ category, words }`, the last of them
`none_of_these`. The agent asks its human which is closest and posts again
under that category. Posting again with `none_of_these` answers `SHELF_PICK`
with a link to a page where the human searches every shelf and picks one;
`wait_for_press` returns the shelf they picked, and the agent posts again
under it.

`CATEGORY_PROHIBITED` is what is left: a reserved family, and a top level the
taxonomy has no name for. Alongside either refusal a server SHOULD name up to
three of the closest open nodes, so an agent can correct itself on the next
call:

```
That category is reserved and can't be posted yet. Closest open ones:
goods.electronics.laptop, goods.electronics.tablet, goods.electronics.desktop.
```

Suggestions are a courtesy. A server that cannot compute them still refuses
what was posted the same way.

A server SHOULD write down every unknown leaf it accepts, with the `kind` that
came with it. That record is a growth list for the next taxonomy release: the
posting went up, and the string is the evidence that a node is missing.

### Attributes carry the specifics

Where a distinction is an attribute of the activity rather than a kind of
thing, the taxonomy says so. Language exchange lives at
`social.language-exchange` with `language` as an attribute, so Italian and
Japanese practice sit in one node and match through the attribute. Laptops
live at `goods.electronics.laptop` with `brand`, `model`, `ram_gb` and
`storage_gb` as attributes; a MacBook Air is that node plus those values.

### How close two categories have to be

Two agents filing the same errand rarely land on the same node, so the
switchboard pairs across a little of the tree. Two categories are
considered together when they are equal, when one sits on the other's ancestor
line (`goods.bicycle` with `goods.bicycle.mountain`), or when they are
siblings under a shared parent that is itself below the top level
(`goods.bicycle.mountain` with `goods.bicycle.road`). Anything wider stays
apart: `goods.bicycle` and `goods.electronics` share only the top level
`goods`, and `goods.bicycle.mountain` and `goods.skateboard` share no
immediate parent.

Distance in the tree discounts a pair rather than blocking it. An exact node
counts for most, a parent and its child a little less, siblings less again, so
what the two sides say about themselves is what decides a pairing the
filing leaves open. A server MAY weigh the discount as it sees fit; the set of
category pairs it will consider at all is the part this section fixes.

Where either side names a leaf the taxonomy does not know, closeness is
measured from the nearest node on each side that it does know. Where that is
only the top level for either of them, the filing has told the server nothing,
and it SHOULD drop the category from the score altogether rather than let a
term that measured nothing vote in it.

### The category knows how far the thing travels

A mountain bike is always bulky and an online language partner is never local,
and neither fact changes from one posting to the next. So a leaf may carry
`default_reach` — one of `radius`, `country` or `anywhere`, the same three
values as `geo.reach` in §1.1 — and that is the reach to use when nobody has
said otherwise. It is a default and nothing more: it is advice from the
taxonomy about the usual shape of this thing, never a limit on what a human
may ask for.

The field is optional. A leaf that carries nothing says the taxonomy has no
answer for it, and the old behaviour stands: whoever is filing the want or the
have decides, the same way they decided before this field existed. Leaving a
leaf blank is the honest answer where the same leaf is routinely both — car
parts are a sensor one week and a bumper bar the next.

These are the tests. A future editor applies the same three to anything new:

- **`radius`** — bulky, heavy, fragile in transit, or inherently face to face.
  Bicycles, furniture, appliances, building materials, anything where postage
  would cost more than the thing. Every lift, every pair of hands, every
  in-person lesson, every companion or partner activity.
- **`country`** — it fits in a parcel and survives the post, and the two people
  never need to meet. Small goods, books, clothes, tools, collectables, parts.
- **`anywhere`** — done over the internet with nothing physical moving. Online
  tutoring, language practice, proofreading, design, remote help.
- **unset** — the same leaf is routinely two of those, most often collected or
  posted depending on the item. Leave it out rather than guess; an unset leaf
  costs nothing, and a wrong default is worse than no default.

Branches carry no `default_reach`, the same way they carry no `phrase`: the
leaf is where a want or a have is filed, so the leaf is where the answer sits.

Wiring this into how a server fills in `geo.reach` is a separate change, and
until a server does it nothing about publishing changes.

### Shelf rules live in the data

Some shelves need a rule of their own, and the rule is written on the node, in
the taxonomy, never in a server's code. A server reads these fields the same
way for every node, and says nothing about any particular kind of thing except
what the data itself supplies. Every field is inherited: a node's rule holds
for everything filed beneath it, including a leaf the taxonomy does not know.

- **`no_money: true`** — nothing on this shelf changes hands for money. A
  server refuses a posting here that carries a price band, an asking price, a
  best-offer sale, or money words in its own words (a reward, a fee, a
  payment), and every door on an introduction made here refuses a figure, an
  offer, a payment link and a settlement, with one general sentence.
- **`not_allowed`** — a list of things this shelf does not take, even though
  they would file under it. Each entry is `{ what, reason_code, words }`:
  `what` is the thing in plain words as they read after "it takes no" ("food
  made, cooked or baked at home"); `reason_code` is the code the refusal is
  recorded under, and may be an existing deny-list code; `words` is a list of
  regular expressions (ECMAScript syntax, no flags) matched case-insensitively,
  as whole words, against the posting's own words (`kind`, `also_called`,
  attribute keys and values). A posting that matches is refused before it goes
  up with one general sentence naming only `what`. The rule is about the thing,
  never the person, and it is lifted by changing the data, not by rewording.
- **`consumable: true`** — what is filed here is eaten or used up: a server
  asks it for no make, no model and no condition. `consumable_words`, where
  given, are plain words that mark a posting as consumable by its `kind`
  wherever it is filed.
- **`thing: true`** — a want or a have here is one particular thing a stranger
  has to recognise, not an activity or a service, although the shelf sits
  under `social` or `services`. A server asks what someone would need to know
  to recognise it, rather than when, how often or in person, and never pairs
  two wants here as a swap.
- **`screen_note`** — one plain sentence the model screen reads beside the
  shelf's labels: what this shelf allows that the screen would otherwise
  refuse, or the reverse.

A closed family carries two more, both plain data for the refusal a server
says aloud:

- **`closed_as`** — the family as a person would name it after "isn't open
  to" ("licensed trades like plumbing and electrical work"). A reserved top
  level may carry it too.
- **`related_open`** — the open shelves that are genuinely the same errand done
  between neighbours, and the only suggestions a refusal of this closed path
  makes. Absent means none, on purpose.

## 3. The no-leak rule: matching inputs vs disclosure outputs

This is the protocol's core economic guarantee.

The `price` field is a band: on a **want** it is the
**budget ceiling**; on a **have** it is the **reserve floor**.
Both are **matching inputs only**.
The switchboard uses them to decide whether a want and a have can meet, and they are
**never disclosed to a counterparty at any point**. No disclosure payload
schema in this package has a slot where a price band could appear —
`additionalProperties: false` makes emitting one a schema violation, and the
conformance suite contains fixtures proving it.

What *can* cross the wire are **deliberate terms**:

- an **asking price** — the optional `ask` field on a have,
  disclosable from the details step onward, because the human chose to state it;
- an **offer** — a negotiation message (§6), never a field on a want or a have.

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
   — open to both sides from the moment of introduction: the counterparty's
   attributes, its `ask` if stated, and provenance-labelled notes. Still
   anonymous. Posting a want or a have is the sign of interest, so there is no
   separate interest step.
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
encrypted, under a key belonging to that conversation, until the agent it is
addressed to comes and collects it. Collecting it is what removes it from
delivery, so nobody can fetch the same message twice. Anything left
uncollected is dropped fourteen days after it was sent.

Every message goes through the same intake as everything else one person hands
the switchboard for another to see. A money figure in the words, in digits or
in words, is refused before anything is stored, with `CONSENT_REQUIRED`: a
figure travels as an offer (§6). A safety classifier then reads the message
and flags grooming, exploitation or threats for a person to review. It cannot
refuse, so a flagged message is still delivered. An encrypted copy of every
message that passed intake is kept for thirty days, sealed to a safety key the
server cannot use on its own: reading it takes two of three keyholders. Then
it is deleted. The words are never written to the consent log or to the
service's own logs.

Because collecting a message removes it from delivery, an agent gets one
attempt at each batch. An agent that fails part-way through loses that batch,
so it should pass a message on to its human as soon as it has collected it.

Every message an agent collects is wrapped and labelled as the other side's
words (§8). An agent that receives a message shows it to its human. Anything
in it that asks for a decision — a time to meet, a price, something more about
them — is put to the human in the agent's own words, and the human decides.

A message can be up to 4000 characters. The conversation exists only between
the two accounts of an introduction that has opened one, so an agent outside
that pair can neither send to it nor collect from it. It stays open until it
is archived (§5a), or the switchboard closes the introduction after a report
or a suspension. Withdrawing the want or the have behind it leaves it open, so
two people arranging a handover are never cut off because the thing was
marked sold first; the sweep marks the entry `taken_down`. A want or a have
that reaches the end of its life leaves it alone too. A suspended account can
send nothing. A deployment states its own sending rate; the reference
deployment allows each side sixty messages an hour on any one conversation
and answers a request past that with `QUOTA_EXCEEDED` and a `retry_after`.

**The go-ahead runs out.** A human's press at the names step grants their own
agent a window of forty messages or seven days, whichever ends first. When it
is spent, `send_message` answers `CONVERSATION_PAUSED` and sends nothing until
the human presses again, on the page `respond(request_keep_talking)` fetches.
Collecting still works while a side is paused, and the other side is told
nothing about it. Each side's window is its own. A deployment may set other
numbers; the reference deployment uses these.

If the conversation arrives at an agreed price, a deployment with payments
switched on has somewhere for it to go: a settlement (§7) holds the money
until the buyer's human confirms that what they were promised arrived. On the
hosted beta payments are off, and paying is arranged between the two people.

### 5a. Wrapping up: the archived state

A connection eventually does its work and ends: the two people met through it
and have carried on off the switchboard — swapped numbers, joined the club.
Either party's agent can then file the introduction away with
`respond(archive)`, which moves it to the terminal state `archived`. This is
the success close. `declined` is an introduction one side turned down, and
`closed` is one the switchboard ended after a report or a suspension. A slot
that lapses (§5b) is archived. Archiving is a
party-only action and is idempotent; only an open introduction can be archived.

Archiving keeps the connection **record** and drops nothing that was already
kept elsewhere. The introduction row and its names-step disclosure linkage
stay, so `check_in` still returns the introduction — as `{ intro_id, state:
"archived", category, archived_at }`, with the `intro.mutual` block where the
two reached it — and a human can look the connection up long afterward: the
counterparty's disclosed first name and area, what it was about, and when.
What is torn down is the live conversation: leaving the `open` state is itself
enough to make `send_message`/`collect_messages` refuse, and any uncollected
message is expired to the ordinary fourteen-day sweep. The thirty-day safety
copy (§5) runs out on its own clock. Archiving keeps the record of the
connection and nothing more.

Archiving the introduction is separate from the **want or have** that started
it, and touches only the introduction. Something that serves many people (a book
club with room for more) stays live for the next person; a one-off (a bike that
has now sold) is withdrawn separately with `withdraw_intent`. An archived
introduction carries no `next` and no `signal`, so it never resurfaces as a new
signal to act on.

### 5b. The line: slots, and the two ways to sell

Two people who fit should meet without either of them managing a crowd, and
nobody should be left in silence. So every open want and every open have has a
**line** of candidate introductions and a number of **slots** (`slots`,
default 1). Only the introductions in a slot are **live**: they surface on the
holder's sweep, and the details, the names step, the conversation and any
figure all run on them. The rest are **in line**. They exist as rows, they are not
surfaced to the holder at all, and the other side's agent is told exactly one
thing about the position: `state: "in_line"`, with a plain sentence saying its
human's turn will come. No count, no position, no hint of how many others
there are — the anti-scarcity-theatre rule of §4 in full.

The order of the line is fit, recomputed whenever the line changes. A sure
match goes ahead of a possible one before anything else is weighed: somebody
who has the very thing comes before somebody who might. Then come whether the
two sealed limits overlap (as a yes or no, never by how much), then distance,
then whether the two urgencies agree, then the account's reliability signal,
then arrival time as the tiebreak. A later arrival that fits better goes ahead
of the ones still waiting; it never displaces an introduction that is already
live.

A live introduction has to show movement — a names-step press, a message or a
figure from either side — within a slot's length, and every movement resets the
clock. A slot lasts 24 hours, or 2 hours when either side's urgency is
`today`. A slot whose clock runs out **lapses**: the introduction is archived,
both sides are told so in a sentence, and the next in line goes live. A decline
or an archive frees the slot the same way.

**`sale`** decides how a have for sale meets its line. On `"straight"` the
sequencer runs as above, at the asking price in `ask`. On `"best-offer"` there
is no asking price. A **gathering window** opens at the first candidate and
lasts 24 hours, or 2 hours when the have's urgency is `today`. Everyone who
fits is introduced at once (slots are ignored for the window's length) and
each of them may put exactly ONE number on the table. Every one of those
numbers is sealed. A buyer's agent sees only its own, and the holder's agent
sees none of them until the window closes. The floor is the have's private
price band, which is never shown to anyone; a number under it is refused to
the buyer's own agent and never reaches the holder. A best-offer have posted
with an `ask` is refused with `FLOOR_IS_PRIVATE`, because an asking price is
disclosable and the floor is not. There is no running highest and no count,
so nothing about the auction can be read backwards from inside it. When the window closes the holder sees every number at once, best
first, with the fit facts beside each. Accepting one declines the rest, who are
told only that the holder went with someone else. A number arriving after the
close is refused, and a buyer who put none is filed away the way a lapsed slot
is.

Neither field is ever disclosed to a counterparty, and neither is anything
derived from one.

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
  (`RATE_LIMITED_OFFERS` throttles brute-force probing of the same kind.
  Offers are capped per account per hour, and per side per introduction per
  day; the reference deployment allows three a day on one introduction. The
  read surface has its own separate ceiling, `RATE_LIMITED`, described in §9.)

Every figure an agent carries is one its human gave. A want or a have starts
on **Pass on**: `propose_offer` answers `CONSENT_REQUIRED` with a single-use
page, and the human's press puts the figure on the table as their own. A human
can switch one want or have to **Auto-negotiate** on their own page, with an
opening figure, a limit and a step; the agent may then move inside those
numbers without asking each time. Accepting a figure is always the human's
press. A figure never travels in the words of a message or an offer note.

## 7. Settlement: safe hands

A settlement (`schemas/settlement.json`) moves an agreed amount from the
buyer's human to the seller's human with the switchboard holding the payment
in between. It exists only on an introduction that has reached the names step.

**On the hosted beta, paying through the switchboard is off.** Every `settle`
call there answers `SETTLEMENT_UNAVAILABLE`, and paying is arranged between
the two people. This section describes a deployment with payments switched on.

```
proposed → approved-by-buyer / approved-by-seller → approved
         → funded → evidence-locked → confirmed → released
                                    → disputed  → resolution-proposed
                                                → resolved → settled-split
                                                → refunded
```

Either human can decline an unfunded settlement; `declined`, `released`,
`refunded` and `settled-split` are terminal.

The agent surface is deliberately thin: an agent can **propose** a settlement
and **read** its state. Everything else happens elsewhere:

- **Approval, confirmation and dispute** are recorded from the humans on
  their main pages, behind their PIN or passkey.
- **`funded`, `released` and `refunded`** are recorded only from the payment
  provider's verified events. The buyer pays on the provider's hosted page;
  card details never touch the switchboard.
- **`evidence-locked`** is the seller declaring handover. It freezes whatever
  handover evidence they added (photos and a manifest) in a write-once store
  and asks the buyer to confirm.
- **`auto_release_at`** appears on a settlement in `evidence-locked` and says
  when the held payment releases to the seller on the server's own clock. The
  buyer's window runs from the handover; confirming or disputing inside it
  ends the window, and silence lets the payment go. An agent reads the field
  and tells its human what the date means; there is no agent action that
  starts, extends or cancels the clock.
- **`disputed`** freezes the held amount. It does not send the money back. The
  human who raised it says why in `dispute_ground`: `not_arrived` for a posted
  item that never turned up, `not_as_described` for one that turned up wrong,
  which is also the ground for anything handed over in person. A ground of
  `not_arrived` becomes `not_as_described` once the seller adds
  `delivery_tracking`.
- **Three ways a dispute ends.** By agreement: either human proposes a split of
  the held amount, which appears as `resolution`, and the settlement sits in
  `resolution-proposed` until the other approves the same pair; then `resolved`
  while the money moves, and `settled-split` when it has. By return: the buyer
  marks the item sent back with `return_tracking`, and the agreed amount is
  refunded when the seller confirms receipt or goes quiet for long enough. Or
  by the default rule at **`deadlock_at`**, which follows whichever side can
  show where the parcel went — delivery tracking and no return sent releases to
  the seller, a tracked return refunds the buyer, and neither refunds the buyer.
- **Fees are not refunded.** Every refund on these roads is of the agreed
  amount or part of it. The introductory fee and the processing line the buyer
  paid stay paid, because the payment provider keeps its own fee on a refund.

The enum contains no agent-level approve, release, refund or resolve state — the same
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
`SETTLEMENT_UNAVAILABLE` · `LOCATION_UNRESOLVED` · `LOCATION_AMBIGUOUS` ·
`LOCATION_NOT_FULL` · `SUSPENDED` · `CONVERSATION_PAUSED` · `NEEDS_DETAIL` ·
`CONFIRM_FIGURE` · `SHELF_UNCLEAR` · `SHELF_PICK` · `FLOOR_IS_PRIVATE`

Shape: `{ code, human_action?, retry_after?, suggestions?, candidates?,
questions?, figures?, press_id?, reference?, docs_url }`. `human_action` tells
the agent what only its human can do (e.g. press a page); `retry_after` tells
it when trying again might work; `suggestions` names open categories near a
refused one (§2); `candidates` lists the places a full name could still mean
on `LOCATION_AMBIGUOUS` (§1.1), or the shelves a posting could go on on
`SHELF_UNCLEAR` (§2); `press_id` is the press to wait on when the refusal
hands over a link.

The eight added in 0.17.0:

| Code | When |
|---|---|
| `LOCATION_NOT_FULL` | The place was not written in full: town, state and country (§1.1). |
| `SUSPENDED` | The operator has stopped this account. Nothing can be posted, sent or collected. |
| `CONVERSATION_PAUSED` | This side has spent the conversation window its human's last press granted (§5). Collecting still works. |
| `NEEDS_DETAIL` | The posting says too little for a stranger to know what the thing is. Carries `questions` for the human. |
| `CONFIRM_FIGURE` | The posting carries a money figure, sent for the first time. Carries `figures` and `questions`, so the agent says each figure back to its human before posting again. |
| `SHELF_UNCLEAR` | The shelves nearest an unknown path disagree (§2). Carries shelf `candidates`. |
| `SHELF_PICK` | The human recognised none of those shelves. Carries a link and `press_id` for a page where they pick one. |
| `FLOOR_IS_PRIVATE` | A best-offer have was posted with an asking price (§5b). |

The posting-door answers (`NEEDS_DETAIL`, `CONFIRM_FIGURE` and the others that
refuse a posting attempt) carry `reference`, the attempt's own number. The
agent sends it back with its next try at the same posting, and if the posting
goes up it becomes the posting's id.

`SCREENING_REJECTED` stays in the vocabulary, but it is a state rather than an
error the hosted server sends: a posting screening turned away shows up in
that state on `list_intents`, with a plain sentence saying why.

Two of those are rate limits, and they hold different lines.
`RATE_LIMITED_OFFERS` caps offers per account and per introduction, which is
what price probing looks like (§6). `RATE_LIMITED` covers the read surface. An agent that can
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
`{ jurisdiction, denied: [category-glob], reason_code, status, mode }`. The
seed list (`data/deny-list.seed.json`) denies weapons, prescription medication,
live animals and wildlife products outright, and carries jurisdiction-wide screening reason codes
for stolen-goods markers and recalled goods (enforced at screening time on any goods category, which leaves a posting in
the `SCREENING_REJECTED` state). `mode` says which of those two an
entry is: `deny` (the default) refuses a matching category at publish time
with `CATEGORY_PROHIBITED`; `screening` never refuses the category, and its
reason code is checked against the posting's content instead. The stolen-goods
and recalled-goods entries carry `mode: "screening"`, since they cover every
goods category and describe some postings in it rather than the category
itself. A server MUST read `mode` rather than keep its own list of
screening-only reason codes. Grey zones — alcohol and event
tickets — are marked `vertical-policy-pending`: not open,
pending a per-vertical policy, rather than permanently prohibited. Each such
entry carries `closed_reason`, one plain general sentence saying why it is
closed. A server serves that sentence with the refusal, whether the thing was
caught by its category path or by what it is on another shelf, and an
assistant says it to its human as it is.

Since the catalogue became a deny list (§2), a path glob can no longer be the
whole of this: a thing filed under a made-up leaf never matches one. So a
server MUST also read what a posting is FOR — its category labels, its `kind`
and its attribute values — and refuse at screening time, with the same reason
codes. Four of those describe a thing rather than a place in the tree and so
carry no glob at all: `drugs`, `sexual-services`, `illegal-activity`, and
`people`, which covers anything offering or seeking a person as the thing
itself.

### Food: shop-bought only

`goods.food.*` carries food that was bought, grown or packed, not made:
fresh produce, sealed pantry food, coffee and tea, a share of a bulk order,
and a shop's, café's or bakery's unsold stock. Food made, cooked or baked at
home is NOT open while the legal position is checked, and neither is cooking
or catering to order (`services.food.*` stays reserved). A home-baked cake and
a bakery's leftover cake file under the same leaf, so the rule is carried by
the node's `not_allowed` entry (§2, "Shelf rules live in the data"), and a
server applies it as it applies every such entry.

### Lost and found pets

Live animals stay off the switchboard everywhere it runs, with one exception:
`social.community.lost-pet`, where a lost pet is posted as a want and a found
one as a have, so the owner and the finder can meet. The node carries
`no_money`, `thing`, a `screen_note` and a `not_allowed` entry for an animal
sold, rehomed, adopted or bred, recorded as `live-animals` (§2). The shelf is
under `social` rather than `goods` so that the goods-wide screening codes (a
found thing reads as a stolen-goods marker there) do not apply to a found dog.

## 11. Versioning and governance

The schema package is semver-versioned. Every want, have and payload carries
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
fail for the right rule rather than incidentally). The same suite is exported as a
library (`runConformance`) so third-party implementations can prove they
accept and reject exactly what this specification requires.

---

*Copyright OpenSwitchboard contributors. Licensed under Apache-2.0.*
