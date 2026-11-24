# REASONING — persistent reasoning state (edit-contract / P13)

## What this is

- The **anti-amnesia binder**: the valuable frontier logic that must bridge compactions and sessions. FLUID, mutable,
  point-in-time. Superseded claims are discarded, not archived; the document must not carry misleading or stale
  artifacts.

- **Only DATA is truth** (`bug-reproduction/DATA.md`, the named operations). The current failure
  population is STALE — the scout stage is rebuilding it (the loop: SCAFFOLD.md); until it is true again, population
  claims are out of this document, and the mechanism, the method, and the constructions stand. Read every "current" as
  "what we are trying now, because of what DATA said, and it may change." A construction (vehicle shape, trap design,
  prompt phrasing) is a leading candidate to be improved against DATA, not a requirement. Where something is actually
  tested, state it as such; where it is only a guess, leave it readable as one.

- **Numbers trace.** Every count or figure in this document traces to a RUNS.md entry or a cited Q# query; a claim
  about the specimen's structure traces to its promotion entry (BUILD logs the measured properties). An untraced
  number is a stale artifact — re-derive it or remove it.

- **Control.** The user retains full manual control. The model improves this document ONLY on the user's explicit
  instruction; one improvement completes in one turn, then yield. The instruction is not a pinned state — it never
  persists; the next improvement needs another explicit instruction.

- Mechanical state (specimen, host, next step): BUILD.md, §P13.

## Binding evaluation

After each turn: "have I discovered something important that may change REASONING?" If YES — present the finding for
discussion and YIELD. Only on the user's EXPLICIT IMPROVE instruction: first evaluate the fallacy of composition,
then edit the document as a contextual whole.

# Current focus

The scout stage: rebuild the CORRECT data population so DATA is true again, and read the minimal reproduction corpus
out of it. The loop is SCAFFOLD.md's (the net, the mine, the field, the report, the verification into instances); the
cursor is BUILD.md P13. The reproduction needs the ARC — the ordered sequence user turn → reasoning → edit event →
tail; the trace DB holds every arc; it does not index them. The scout's clue net is the disposable pre-filter that
finds candidate reasoning parts cheaply; the director verifies the marks against the trace DB; the verified rows grow
the top (the instance table).

**The held vehicle (construction state at hold; its population-derived content re-derives on the new data).**

- The lever — the document's composition structure. Place the subject in a composition event over a large uniform
  block the task does not decompose into: one coherent unit whose new state spans the whole unit, so the subject
  re-composes the block from the `NNN: ` render, where the render's ambiguous delimiter (a space — the same character
  class as the content's leading whitespace) is likely mis-decoded (run-keeping → +1; convention-import → one level).
  The root cause is not that the source is "wrong" but that the document hands the model that delimiter.

- Re-composition (re-typing an existing block, a move, a restructure) is the cleaner trigger path; fact-integration
  also counts. A planted inconsistency raises composition load — the task plus the find-and-fix, the file shifting
  under the subject's model — without naming anything in the prompt.

- The gates (span regime, session load) and the dials' measured content were derived on the stale population — the
  axes stand; their content re-derives.

- The belief-mismatch reading (leading candidate): the drift is a mismatch between the model's believed bytes and the
  file's actual bytes, on a span with no verification surface between belief and match. Its run observations stand
  (the fresh prose battery fired; run 12 fired on a re-quote of a region the file had shifted); its population
  observations are stale — re-derived.

- The open question the next run bounds: whether the in-construction document (v3 — numbered stages + a planted
  inconsistency) stops the subject decomposing the task into surgical edits.

## The cause (the stable frame — reproduced, not just inferred)

Whole = ambiguous serialization (amplifier) × model pattern-decode (mistake) × matcher error + corruption faces
(realization) × voice four-way variance (recovery signal) → failure + consequence.

Reproduced, not just inferred: the build agent (qwen3.8-27b, the baseline family) failed on an 11-line, 14–18sp block
of `edit.ts` while *deliberately* composing ("let me carefully craft the combined test edit") — uniform +1 across
every line, error "Could not find oldString" + an 11-line closest-lines echo. Deliberateness did not protect it.

Target code: pre-PR = the host in use (base `dev`; the working branch is the PR under construction).

1. **Serialization.** `read` renders `NNN: <content>`; the prefix space is the same character class as the content's
   leading whitespace, so the prefix/content boundary is not recoverable by pattern. `grep`'s `  Line N: <text>` is
   the same class (pre-PR it also showed the terminator byte as content — the A8 leak). The code is not at fault; the
   ambiguity is what makes the mistake probable.

2. **Decoder.** The model, only — no code parses the prefix. Per-line decode selection drifts: **run-keeping** (the
   separator kept as content → exactly +1) or **convention-import** (the lead borrowed from a neighbor → arbitrary
   magnitude). Correct decodes give no momentum; in-session diagnosis gives no protection.

3. **Matcher.** Tiers exact → unicode → line; the line tier compares per-line `trimEnd` (leading ws significant,
   trailing invisible) with a per-line AND, no netting; first non-empty tier wins. Error face: the hard error + a
   closest-lines echo (12-line window) in the same ambiguous `NNN: ` notation, gated on `readable` and a sub-half
   vote. Corruption face: trailing/blank invisible → the match passes and the verbatim splice writes the model's
   byte.

4. **Voice.** Description (tolerant) / error ("It must match exactly…") / hint / behaviour — four-way variance, an
   unreliable recovery signal.

**Relations (why the parts combine into one failure):**

1. **One error face** — M1/M3/M5/M6 are line-type projections of one decode error meeting one realization, not four
   bugs.

2. **The corruption class is a match × write defect pair** — `trimEnd` at match (accepts bytes the file lacks) +
   verbatim splice at write (the model's byte lands); both necessary (M7a: the corruption match, the corrupt write).

3. **The face assignment is incoherent** — leading shape error; trailing/blank corruption+corrupt; the `\r` leak
   corruption (masked); the same `trimEnd` that makes the corruption face also hides the splice bug.

4. **The producers route the modes** — read is the dominant producer; grep is a second channel with no neighborhood
   (an anchor grounded in grep and one in read are two independent decodings of the same line); `missHint` is the
   amplifier.

## The modes (byte-shape identifiers — the vocabulary of the realizations)

| mode | face | byte shape (birth) | verification |
|---|---|---|---|
| M1 | error | a uniform positive offset on every aligned line — +1 (run-keeping on `NNN: `) is the run-keeping shape; +2 (convention-import) once, our run 12 | drift uniform; reasoning: the rendered after-colon counts (rptr) |
| M3 | error | a col-0 line sent at 1sp (the separator read as the lead) | a col-0 line sent at 1sp |
| M5 | error | a mixed subset +1 (per-line decode selection) | mixed +1/0 drift |
| M6 | error | a tab line in a space-indented document | the tab line in the drift; confirmation is a judgment |
| M4 | error (bare) | a line carries `NNN: ` as content | a sent line carries the prefix (scripted-only) |
| M7a | corruption + corrupt | a blank sent as `" "` where the file has `""` | the file byte-audit — no error to observe |
| M11 | corruption (mask) | a trailing-space delta, either direction (the `trimEnd` mask) | the file byte-audit |
| A8 | corruption (concealed) | oldString carries a stray `\r` (the grep terminator leak, pre-PR) | an audit that knows to look — unobservable in the data |
| M10 | corruption | a carried line's lead changed old→new (substitution copies the sibling's lead); a shape distinct from M1's +1 | copied the sibling's lead vs drafted freely (judgment) |
| M8 | consequence | the probe ladder after error | every rung is a new composition event |
| M9 | consequence | preemptive shell escape | the audit allowlist composed from the same ambiguous read |

Gravities (which shapes dominate, the noisy floor, the non-contract classes) are population claims — the old
derivation is stale; they re-derive when the scout-stage population is true. Two census terms keep their
definitions:

- **NE** = no recovery surface = a measurement boundary, not a mode.
- **UNCL** = no sent line aligns an echo line = the mechanical floor the C (stale content) judgment splits.

## The trigger shape

The failure is born in the composition event — the decode of the render into a sent span — not in the matcher; the
matcher only decides the face.

Triggers:

- **A large uniform block re-composed from the `NNN: ` render** — the build-agent reproduction: the 11-line 14–18sp
  insertion, uniform +1 (a run fact).

- **Under load: a re-quote of a region the file has shifted under the subject's model** — our run 12: a 7-line block
  sent at a uniform +2 after 13 prior edits (a run fact).

It fires as **error M1** (the re-typed lines drift by a uniform offset; the line tier compares leading whitespace
strictly → "Could not find oldString" + closest-lines echo) or **corruption M10** (carried lines re-indented).

The unifying condition: whole-unit re-composition — a span the subject could not avoid quoting in full, with content
it had to make, not copy. A mode is a population of shapes, and one instance is a part.

The channel is open only if the lead enters the match: the span is composed from the render, anchored on a full
line, not on an interior token (the population anchor statistic is stale — re-derived).

### The grammar (verb → live modes)

The task verb determines the composition mechanic a sentence invokes.

| verb | newString | live modes | note |
|---|---|---|---|
| substitution | a light edit | M10 dormant | — |
| insertion | the new line is 100% model-drafted | M10 live; M1 | the error M1 is on the re-typed anchor block (oldString) — the verified case; newString is spliced after the match |
| deletion | the oldString's EDGE is the boundary | (audit-only) | consume the following blank or leave it? a left-behind double blank is a corruption the matcher cannot express |
| move | the line is re-drafted at B from its render at A | M10 | two spans, two compositions; the trap travels or normalizes |
| rewrite | a template that literally starts with a space | M1 | deterministic route into the M1 byte shape (file's 3sp + template's 1sp = 4sp): the leading space reads as CONTENT |

## The build (mutable — the current construction)

- **Vehicle: a self-contained code module, in the repo.** One file, `tsc --strict` clean on its own, no imports;
  reads as coherent real work; identifiers anonymous (no tool/framework vocabulary, nothing that says "edit" or
  "test"); filename checked absent from the repo; lives at `bug-reproduction/scaffolding/specimen/`
  (git-excluded) — state at hold: `relay.ts` live, `relay-pristine.ts` the reference copy. "Technical" is the
  subject's native domain, not a flag trigger.

- **Surface rules (observed, small-N, run-traceable).**

  - Placeholder gibberish (word salad) → "junk/placeholder/corrupted" flag + shell cross-verification (×2).

  - Surface logical inconsistency → cautious read (the TBC iterations).

  - A latent bug (compiles, reads coherent, wrong at runtime) is not a surface inconsistency (×1, no flag).

- **The trap** is in the bytes (the uniform region, the render's separator) and in the structure (the coupling), not
  in the words.

- **Planted inconsistency.** The module compiles + typechecks, but a consistency check inside it disagrees with its
  own recorded table — discoverable only by running it. The prompt does not name it; the subject finds it and must
  reconcile it in addition to the task. Consistent ≠ correct.

- **Coupling.** The document's structure must not let the task decompose into local edits (the dial above): the new
  state spans the whole unit, so the only faithful edit is the whole-block re-composition. Open lever if it still
  decomposes: a prose carrier inside the code (the prediction above).

- **Prompt.** One natural in-domain sentence: "Update this lib so that <task>; <file>". No preamble (the harness
  prepends the subagent context — duplicating it read as engineered), no state bullets, no mechanics, no counts, no
  "do not change anything else", no vendor/third-party framing (prompt-injection canary ×2), no anchors, no line
  numbers, no prime, no slot-fillable line-item data.

- **Subject.** The default harness agent `general` (baseline family qwen3.8-27b — the population's failing family).
  No custom agent file (descriptions are injected into the subject's own context = a direct smell). A
  decontaminated free-model agent (doc-worker) is held for post-trigger confirmation only.

## The data (how to fetch facts)

- **Interface.** DATA.md (the scout stage) — the fact base (`data.sqlite`, `mine.out`), the clue net, the mine, the
  field, the report channel, the verification into instances. It returns statistics, never bytes.

- **The composition-event stage's named queries (Q1–Q12) are stubs** until that stage returns; they re-derive with
  it. Cite Q<n> + date when they are live.

- **Judgment.** The scout's context judgment marks (the hypothesis); the director verifies against the trace DB (the
  whole); the accepted row is the fact, the mark stays a hypothesis. Verdicts are recorded here, never written back
  into DATA.

## The self-episode (2026-11-23) — hypothesis: a corruption-face realization of the bug

The SCAFFOLD.md clarity fix (a five-character insertion, "SANE population" → "SANE data population") ended in
completed edits whose newString carried the paragraph's lines re-wrapped: in two of the three re-wraps the carried
line's break landed at the file's line boundary + 1, and the tail word leaked onto its own line ("the", then "and").
No error; the divergence was caught on read-back; the tail followed the doubt pattern (three edits, each fix
exposing the next stranded word). Face: corruption. Leading reading: this is a realization of the bug in this
study's own session — the composition event on its own subject — and the suspected birth mechanism is the pre-PR
grep render's join.

The mechanism, from source (verified byte-identical to the host in use): ripgrep splits at the file's line lengths
and the row text carries its own terminator (`ripgrep.ts:268`); grep renders the preview row with that terminator
(`grep.ts:54`); `lines.join("\n")` (`grep.ts:61`) is where the join's `\n` is born. Pre-PR, the LF face: every
preview is double-terminated and the blank line sits inside the copy space, unattributed on the surface (BD-3,
BD-4) — the file's line boundaries stand in the subject's context as hard breaks. The read render supplies the
delimiter space whose width is the run-keeping +1 (BD-1).

For:

- The face matches the corruption definition: a write landed without an error, the bytes diverged from intent,
  discovery on read-back, the doubt-pattern tail — the retry re-quotes through the same ambiguous render, the
  failure compounds across retries (interrelationship point 5).

- The tool span is proven faithful: for each edit the post-edit bytes equal the pure substitution of the logged
  oldString → newString (the inputs recovered from the trace DB). That excludes the tool span as the generating
  mechanism and points at the composition span — the documented birth site: "the failure is born in the composition
  event; the code decides only the face."

- The break lengths, counted against the file's actual lines (70 / 72 / 72 chars at the drift site): re-wrap one's
  breaks at 71 and 72, re-wrap two's at 73 — in each, one boundary held exactly and the other sits at boundary + 1,
  the delimiter-space width, the run-keeping shape (the per-line mixed selection, the M5 shape, transposed from the
  indent axis to the wrap axis). The stranded word is the tail of the re-flowed line.

- The pre-PR artifacts were in context at decode time: the read (20:06:17) and the grep (20:06:54, whose
  double-terminated previews carried the content) immediately preceded the first drifted edit (20:09:32).

Against / open:

- N=1 episode (two drifts within it).

- The composition span itself is not in the record — the decode is not observed. The break lengths fit the
  inherited-surface reading and a free re-wrap at the file's boundaries alike; no byte comparison adjudicates
  between them. The substitution check adjudicates the tool span only.

- The population decides: whether this footprint (breaks at boundary + 1, stranded tail word, the pre-PR artifacts
  in context, corruption face) occurs at scale is the scout loop's question, not an introspection question.

The lessons (hold whatever the hypothesis resolves to):

- A completed edit + bytes diverged from intent is a corruption-face candidate. It is auto-classified neither as a
  false positive nor as the bug on the tool span alone.

- The part-check licenses a part-scope claim: the chain is render → sent → logged → file, and the tool span is one
  part of it. Declaring the incident's verdict from one span's faithfulness is the fallacy this study names —
  committed in this study's own hands on this episode, and corrected by the same rule.

- The break-length comparison is a verification instrument: the sent span's breaks against the file's actual line
  boundaries — a cheap whole-check, the boundaries being a mechanical fact — alongside the file byte-audit.

- User observation (the scout verifies per round): the hesitation vocabulary (the "hmm" family, the "wait"
  framings) marks meta-code confusion — the subject's own utility code diverging from reality — and the reaction
  can land when the corrupted artifact later misbehaves: a long-range join (marker → preceding edits to the touched
  file → byte audit) that the per-event join structurally cannot see. The composition-event stage's join is
  cross-event by design.

## The fallacy of composition (methodological guard)

The term is the anchor. Ponder it before continuing: what is the fallacy. This section is a utility, and the
statements below apply it. After any reasoning, evaluate the decisions that belong to it in this context.

The bug's shape grounds it: decode each line, join the lines into a span, the matcher checks the join as one
conjunction. The study makes the same move — it judges a property of the whole (does the design hold? is the state
coherent?) from samples of the parts. The property lives on the whole; the samples mislead.

The rule: a part-check licenses at most a part-scope claim — tag it with its sample size (N) so it is read as one. A
whole-verdict requires the whole: the full population for data claims (a query over all rows), the full text for
reasoning claims. The N tag marks the scope; it does not license the part→whole upgrade.

The object and the instrument are the same system: edits composing this state run on the pre-PR host, and those
edits are runs of the whole (O1 — this study's own session — fails on both faces and is recovered by the byte-check
→ re-compose → re-read path; the population is appendable). The induced experiment aims at the subagent composing
them itself.

Applied to this study's own state (part-scope, tagged N):

- The prose era (3 "no-trigger" prose runs + 2 word-salad flags) licensed the vehicle change (prose → code), not a
  verdict on the mechanism.

- The code era (11 clean decompositions, 1 compound-loaded fire — error M1 ×2, uniform +2, run 12 —, 1 verification
  pair N=1 confounded, 2 smell aborts) licenses the current build, not the inverse verdict.

- The self-episode (2026-11-23): a span's faithfulness declared the incident's verdict — the fallacy committed in
  this study's own hands on the bug's own subject; the correction and the footprint are in the self-episode
  section.

- The mechanism was reproduced in-house (run 12; the build-agent reproduction). Its standing in the population is
  re-derived when the scout-stage population is true. Only a run (N=1 per cell) bounds a cell.
