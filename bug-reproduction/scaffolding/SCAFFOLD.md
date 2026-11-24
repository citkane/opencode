# SCAFFOLD — the scout stage (edit-contract / P13)

Snapshot 2026-11-23.
This file holds what disk cannot: the loop — its purpose, directives,
vocabulary, and method. Where we are and what is next is the cursor in
BUILD.md (P13). Entry into the scope is AGENTS.md (branch root) — the
gate and the load order; what disk holds (locations, counts, the
census) is re-derived at resume.
The scout's code lives beside this file (scout/); DATA.md, one level up,
documents the fact base (data.sqlite, mine.out) and the operations.

## Purpose (absolute)

A RELIABLE bug reproduction: a document + prompt that triggers the pre-PR
byte-contract bug IN ANY FORM for observation. The face of a bug
realization is a property of it, never the unit of study. If I get
lost in the weeds and lose this — stop; that is the fallacy.

## The task

Cast the WIDEST net that catches as many genuine byte-contract candidates
as possible; then evaluate their truth to build a SANE data
population. The candidate population is rationalized by BEST EFFORT:
the clue set is the miner's net, and the DIRECTOR is the sole
intermediary between scout and net — the scout reports on parts, the
director moves the clues (add / trash / promote), the miner reads the
moved net. Every round also sniffs the current candidates for NEW
clues: the unknown cannot be known.

DEFINITION:
- SCOUT = sensor: MANDATE in, REPORT out (part-scope, N-tagged).
- MINER = mechanism: CLUE set in, CANDIDATE BODY + DIFF out — the
  candidate body is the scout's terrain, and refining the clues is how I
  steer the next scout.
- The DECISION (clue edit, mandate) is mine, on the report + miner state
  + fresh diff.
- The focused scouts (template: scout_offby.py) ride inside the focus
  rounds (R4–10): the strongest-signal clues, clue-neighborhood first,
  whole part only on ambiguity.

## Directives

- Ponder the paradox before EVERY turn: the WHOLE data population may
  hold many hidden patterns; fixating on ONE is an error and is
  dangerous.
- The per-part test is content-only: what the part says, NOT where it
  came from. The class — signal or noise — is set by the Terminology.
- DATA DOMAIN (this phase): a part's standing is a function of its
  content alone; the test applies to every part identically; session id
  is the only metadata in the data population; cost allocation is a
  later phase. The data population is the durable artifact; the
  scouts are TRANSIENT — their logic is the durable record, their
  reports are the path to the data population, NOT the data population.
- This file states each fact once, affirmatively, as current truth. When
  a statement becomes false it is replaced; the superseded form is
  deleted, NOT annotated. This file's force is its consistency, NOT any
  label.
- Statements carry their weight in the RFC 2119 lexicon — MUST, SHOULD,
  MAY, and their NOT forms — applied where the weight is non-obvious. An
  uppercase NOT is an unambiguous clarification attached to a positive
  statement.
- REASONING.md is editable only on explicit user instruction (it is the
  binder; read it). The reproduction vehicle is HELD — its prompt,
  fixture, and harness stay as they are until the data population is
  complete and evaluated (the resume flow: BUILD.md, P13); the scout's
  dispatch prompt is the only prompt authored in this loop, new per
  round.

## Terminology

- part — the unit of a sample: one line of model text in the trace DB.
- clue — a text fragment or pattern to be matched; lower case; the match
  is case agnostic.
- signal — the bug's pattern is occurring in the part's own reasoning.
- noise — the clue matched the part without signal; the report row
  carries the reason and the scout's label.
- label — the scout's classification of what kind of noise a report
  row is: a free-form string, an unbounded set, the scout's own
  decision. The scout apparatus records it; its reading is the
  director's, at evaluation.
- meta — the scout's guardrail concept: when it evaluates the context of
  a match, the part may also include the match because the match is the
  subject of the part's discussion; the evaluation targets the part's
  own reasoning. It lives in the scout's prompt — the BEWARE line of the
  dispatch (Scout method).
- The miner decides matched. The scout decides signal or noise, by
  context.
- The two stores: session_part / session_message.
- error / corruption / clean — per REASONING.md (the face axis). In the
  scout's field, error and corruption are faces of a realized signal:
  the scout marks the face by context; the director verifies it against
  the trace DB.
- Terms are hypotheses: iterate them to true or dismiss them; weight
  follows the iteration.

## The round sequence

Establish first; the evidence then shapes the POOL. The POOL's genesis
is assumption; R1–R3 stand on the sequence, and the POOL is
re-evaluated at the gate (after R3) and rewritten in this file before
R4 draws.

- R1 TRIAGE — the one round scoped on the whole (safe: the classes are
  disjoint and evidence-defined; cross-contamination has nowhere to
  go). Mandate: evaluate the given genesis-mined parts; classify each,
  in this operational order —
  - error: the known harness contract string in the next edit event;
    the oldString/newString match corroborates.
  - corruption: what remains after error; the doubt pattern (the "hmm"
    family) is the entry, the byte reasoning that results is the proof
    — confusion, reasoning over bytes, a write landing without an error.
  - noise: the remainder; each report row carries the scout's label.
  In R1 the mine stands as-is — the triage round judges faces; the
  net's rounds are the narrowing rounds. Field: a stratified sample of
  the whole mine (--per-group) + context (--context) — the scout must
  see the outcome.
- VERIFICATION (the director, after R1) — per marked row against the
  trace DB: did the error actually occur (the event carries the
  contract string)? did the corruption actually occur (a successful
  edit + byte divergence — retry, unexpected read-back, shell escape)?
  verify.py accepts the verified rows into instances; the round's
  summary rides in a director note. It produces: proof of the
  foundational mechanism (both faces real, at measurable rate); the
  top table's first rows (the top table is populated from R1 and
  grows every round); the middle conversion's face-derivation
  rehearsed by hand on real parts; the first evidence for the gate.
  Rates are window-scope (N-tagged); the verified instances are
  whole-scope facts.
- R2 / R3 CONTEXT — what surrounds the verified rows: simple direct
  edit, complex multi-step task, or a pattern not yet considered. R2 =
  the error set; R3 = the corruption set. Field = the verified set
  (--instances) + the arc (preceding user turn, build-up, tail).
  Output = POOL material.
- GATE (after R3) — discard / replace / create on the report evidence;
  the POOL is rewritten in this file before R4 draws.
- R4–10 FOCUS + NARROW — the pool's mandates, one per round; the clue
  pool narrows on the standing logic (wildcard promotion, trashcan,
  whole-checks); the focused scouts ride inside.
- SNIFF — constant, rounds 1–10: every report carries the new clues and
  new patterns found in scope; an empty list is itself a finding.
- STOP — after scout 10: I evaluate everything (coverage of what the
  reproduction needs — faces and task shapes; the net's diff; the
  pool's diff) and report to the user; the user and I decide together
  whether more scouts go, and how many.

## Scout method

- THE LOOP: the DIRECTOR owns it; it is SELF-IMPROVING, each round
  refining the clue set to reduce false positives in the candidate
  body; the OPTIMAL DATA POPULATION is determined after the loop. Per
  round, in order: (1) evaluate the report; (2) move the net (clue
  changes, whole-checked), then re-mine — skipped while the mine stands
  (R1–R3); (3) create the mandate; (4) launch the scout. The report is
  loaded into the channel (per scout_id); the decision rides on the SUM
  of the channel — one expedition is a part. Scout effort (sample size /
  tokens) SHOULD scale with the expedition's consequence — a bigger
  sample raises the report's accuracy probability. Sanity check: one or
  SOME scout reports in a batched run should surface "my mistake"-type
  logic markers; their absence at the end of the batch is a report
  problem, not a corpus absence. Convergence = the DIFF goes quiet; a
  wildcard still matching on un-promoted parts = the signal for more
  rounds.
- MANDATE: one hypothesis from the POOL, per expedition. The scout's
  marks stay content-only; the mandate scopes the scout's REASONING —
  the judgment over the sample, the pattern read, the glimpses feeding
  the net and the POOL — and its breadth sets the report's clarity: the
  judgment attaches to one causal shape. The census shape is the
  exception (R1), and it is safe where the classes are disjoint and
  evidence-defined.
- THE POOL: the director's division of the WHOLE, held in this file.
  The division is made as a consideration of what comes after the
  scout — the categories that will align to the top table's columns,
  the reproduction materials. At genesis it is an ASSUMPTION: the
  director's best inference from the task, the harness (opencode), and
  the bug (BUG.md). It is fluid: per report, the director discards
  (disproven — a new one is created), replaces (a newly gleaned
  hypothesis beats a remaining one — a swap), creates (gleaned: a
  noise label that names the shape the part belongs to is a mandate in
  seed form; or from task / harness / bug). Each round's mandate is the
  director's choice: R1–R3 from the sequence, R4–10 from the POOL's
  current state.
  Examples of the director's seed mandate — what the POOL looks like at
  genesis (its current state before R1):
  - "a direct user instruction leads directly to an error" — a simple
    edit request → a no-match error within the next turn
  - "an indirect user instruction led to a complex agent task set
    which led to an error"
  - "an editing task resulted in corruption" — a successful edit, no
    error face
  - "agentic hesitation around the byte mechanics — the 'hmm' family —
    where the bug's pattern is occurring in the part's own reasoning"
  - "the retry path: after a no-match, the reasoning re-quotes the
    read render instead of re-reading the file — the failure compounds
    across retries"
  - "the user workflow patterns that lead into the bug — the session's
    task shape (one-line edit / multi-file refactor / parallel agents)"
  - "recovery after an error: the shell-escape trajectory over the
    bytes (cat -A / sed / hexdump)"
  The bounded list corrupts the data population — the trap to avoid:
  invention stops (the division stays pre-knowledge; the whole's
  hidden patterns — the paradox — stay outside it forever); disproven
  priors contaminate later fields; the loop degenerates from
  hypothesis-refinement to list-execution; the stop rule breaks
  (list-empty ≠ whole-covered). End state: the top table is a table of
  genesis assumptions, not of the corpus.
- WILDCARD PROMOTION: a WILDCARD (generic) clue is a SEED. The scout
  FINDS specific instances; each instance is PROMOTED to its own
  LITERAL clue ("exactly N" → "exactly one"). When a round finds NO NEW
  wildcard matches outside already-promoted literals, the wildcard's
  likelihood has dropped → MOVE IT TO THE TRASHCAN; the next scout
  works a tighter net. The SCOUT REPORTS findings; I DECIDE on the
  report after each excursion. Wildcard disambiguation is post-loop
  analysis.
- DISPATCH FORM: MANDATE first, stated positively; then the REPORT
  FORMAT — declaring the round's vocabulary (which cls values this
  round uses) and the noise-label requirement; then the BEWARE line,
  in these words: "BEWARE — when you are making an evaluation on the
  context of the match, the part MAY ALSO include the match because it
  is ALSO the subject of discussion (meta)."; then ONE boundary line:
  the report's content spec IS the boundary — instances and evidence
  (quotes, counts, N tags); the report is the scout's COMPLETE OUTPUT
  (the stopping condition). A subagent has no concept of an external
  decider; naming one frames the very decision it is to withhold — the
  content spec alone draws the line. OUTPUT: the full report is loaded
  into the channel (per scout_id); the TUI returns only a compact
  handoff — N, one-line summary per section, flag any anomaly. The full
  text is never generated twice. Field files carry part keys + content
  + clue stats (+ the context sections when context is on) — all
  given; the scout reads them as given.
- FIELD FORM: field files are SELF-CONTAINED — the mech file's section
  [0] is the full clue inventory (names, tiers, verbatim patterns); the
  scout's brief points at nothing outside the two field files. Parts
  are keyed [n]; the [n]→ptr hinge (the fieldkey table) is
  director-side — the field carries keys, content, and stats; the
  loader hinges to ptr on load. The mech sections are generated by
  field.py; the scout reads them as given. The report is written
  SECTION BY SECTION (finish a section → append → next): a block above
  the runner's per-step output cap truncates, compacts, and restarts.
  Fidelity first: the scout's reasoning stays; fixes are structural,
  never finding-hints.
- Epistemics (fallacy-of-composition): a scout sample (N parts)
  generates a HYPOTHESIS; the discipline runs at two levels, both mine —
  the net (a clue change only after a whole-check: the DB is the whole,
  a regex over all matching parts costs seconds) and the division (a
  mandate earns its standing by its own expedition; the POOL is
  evaluated on report evidence). Reading is reserved for context-
  dependent judgment — my verification and the context rounds. Every
  interim number carries its N tag. A number taken over presented
  windows is window-scope: it speaks to that window; the whole-check
  speaks to the whole.
- MINE BOUNDARY: a probe at the last mine's boundary separates pre-mine
  misses (real net gaps) from post-mine misses (the next mine absorbs
  them). Recompute the boundary after each mine.
- EXPECTED DRIFT: the process adds rows to the trace DB between mines;
  the re-mine's count is higher; the re-mine absorbs the delta.
  Censuses compare to mine.out, NOT to a remembered number.
