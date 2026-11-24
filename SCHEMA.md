# SCHEMA — the data schema of the reproduction (top / middle / bottom)

The schema of the minimal reproduction — the top (the instance table),
the middle (the conversion), the bottom (the scout) — and the loop
between them.

Provenance: copied verbatim from PLAN.md (§Reproduction architecture).
PLAN.md remains the audit source of record; this file is the load-bearing
copy.

**Deliverable.** A corpus of document(s)/prompt(s) that reproduce the bug
reliably — a minimal reproduction, required for the PR. Reproducing is
harder than fixing: the fix is a code fact (the Bug definition above); the
reproduction needs the ARC — the ordered sequence user turn → reasoning →
edit event → tail. The trace DB holds every arc; it does not index them.

**Eureka.** The reproduction already exists in the trace DB as arcs. The
scout clues (this model's phrasing) are not the reproduction — they are the
disposable pre-filter that finds candidate reasoning parts cheaply, and
only when the filter is accurate enough does a SQL query over the arc table
return clean examples. That is the entire purpose of the scout loop.

The chain — the top defines everything below it:

- **TOP — the instance table.** One row per arc. Queryable, portable,
  durable. The minimal reproduction is read out of it.
- **MIDDLE — the conversion.** Join each validated part into its arc, and
  convert the director's natural-language mandate into the table's
  columns. Natural language is never spoken to the database; it is
  compiled to data points here, and only here.
- **BOTTOM — the scout.** Natural-language mandates in, validated signal
  parts out. The clue set is the pre-filter. Corpus-, model- and
  language-bound: discarded once the top is robust.

**The top table.** Each data point earns its place by what it feeds into
the reproduction:

| column | what it is | what it feeds |
|---|---|---|
| `class` | canonical class (task shape × pattern) — a narrowing of a director mandate | the query key (the scenario) |
| `ptr` | the anchor part / edit event | row identity, audit |
| `task` | the preceding user turn | becomes the prompt |
| `buildup` | the reasoning leading into the edit | document shape, pattern |
| `old` / `new` | the sent oldString / newString | the fixture document is built from these |
| `face` | error / corruption / clean — derived, never the query entry point | query key, the controlled prediction |
| `tail` | the parts after the edit (reaction, escape, retry) | the arc — the story |
| `bd` | the BD-n anchor | the trace to code |

The query IS the reproduction interface:
`SELECT task, buildup, old, new, tail … WHERE class=… AND face=… LIMIT 10`
→ read the arcs → write the document + prompt. Measurement has no place in
this table: if a run fires, the DB captured everything; measurement is a
trivial post-hoc extraction.

**Robustness.** The key is `(class × face)` and `face` is derived:
corruption carries no error event, yet it still has an arc (user turn →
reasoning → *successful* edit → tail) — so it is as queryable as an error.
The build-up and tail are stored: the reproduction carries the story, not
just the failure point.

**Portability.** The arc is the opencode harness's event model — the same
code in any DB, any model, any language. The clues are this corpus's
model-phrasing and do not port; the top never uses them.

**The loop.** The top says which classes it needs → the middle compiles the
mandates → the scout validates them and refines the clue set → the refined
mine is re-categorised → the top gains instances. It stops when every
scenario the reproduction needs has validated arcs; then the bottom is
discarded and the top stands.

**Open calls.** (1) Row grain: one row = the full arc, or one row = the
edit event with the arc retrieved by join. (2) `class` authorship: the
director authors the canonical class set from the mandates; the scout only
marks signal/pattern and never assigns a class.

