# DATA — the scout apparatus interface

# Purpose

Fact base for the study. Current stage: the scout stage — the candidate
net over the live trace DB and the report channel that carries each
scout's findings. The composition-event stage (per-event statistics over
edit calls) is UNWIRED for the scout stage; its query definitions are
stubs, re-derived when that stage returns.

# The database

`data.sqlite` (this directory) — PERSISTENT, never deleted whole. A mine
rebuilds only `cand` / `cand_clue`.

| table | owner | content |
|---|---|---|
| `clue` | clues.py | the ACTIVE net: one row per pattern; a clue is a name with >=1 pattern |
| `trashcan` | clues.py | DEAD clues: demoted by the director after evaluating a report (a clue definitely noise, or a wildcard no longer needed). Never matched, never fielded. A record an audit may need |
| `cand` | miner.py | one row per candidate part: ptr (fetch key), store, sid (the only metadata), term_total, clues (names matched), raw_cr (reference only) |
| `cand_clue` | miner.py | per (part, clue) occurrence count |
| `mandate` | report.py | the director's hypothesis per scout, set before dispatch (a dispatch log; the mandate POOL lives in SCAFFOLD.md, never here) |
| `fieldkey` | field.py | the [n] -> ptr hinge per scout; director-only (the scout never sees a ptr) |
| `report` | report.py | one row per examined part: key, ptr, cls (signal / noise / error / corruption — per-round vocabulary, declared in the dispatch), label (noise rows: a free-form scout string, unbounded set, never validated), reason, quote |
| `report_note` | report.py | the report's prose sections (judgment first; scout and director notes) |
| `instances` | verify.py | the DIRECTOR-VERIFIED seed: key, ptr, face (error / corruption), note. The top table's population, growing per round. The scout's mark stays in report (hypothesis); the accepted row is the fact |

# Methodology

Source: `~/.local/share/opencode/opencode.db`, read-only. Two stores,
split by time (migration ~11-17), not by agent: assistant content in
`session_message` (`type:"reasoning"|"text"|"tool"`), and
`session_part`. `session_v2` carries id/title/agent/model.

- `python3 clues.py init` — seed the active clue set from
  `genesis-clues.json` (the hand-designed 87; protected).
- `python3 clues.py add NAME GRP TIER PATTERN...` — add a clue
  (director, after evaluating a report).
- `python3 clues.py trash NAME [note]` — move a clue to the trashcan
  (director; the only actor who trashes).
- `python3 clues.py list` — the active set + the trashcan.
- `python3 miner.py` — mine the active clue set over the live DB;
  rebuild cand / cand_clue; write the census to `mine.out`.
- `python3 field.py build ID [--clue NAME]... [--count N] [--window
  CHARS] [--seed N]` — the round field: `ID-mech.txt` +
  `ID-samples.txt` + the fieldkey rows.
- `python3 field.py build ID --per-group N` — stratified sample: N
  parts per clue group (each part assigned to the first group it
  matched), instead of a uniform random count.
- `python3 field.py build ID --instances FACE|all` — sample source is
  the director-verified set (instances), not the mine; for the
  context rounds that work on what verification proved.
- `python3 field.py build ID --context` — per-sample mechanical
  context: the preceding user turn, the next tool event (name, input
  summary), and its result (status + error message or success text),
  each windowed (`--ctx-window CHARS`, default 400).
- `python3 report.py mandate ID TEXT` — set the round's mandate.
- The scout appends compact JSON lines to its report file, section by
  section (one line per instance / note); `python3 report.py load ID
  FILE` folds them into the channel; `python3 report.py show [ID]`
  reads them.
- `python3 report.py note ID SECTION TEXT` — a director-authored note
  row (e.g. the verification summary of a round).
- `python3 verify.py show ID [CLS ...]` — the director's evidence per
  marked row: preceding user turn, next tool event, its result
  (default: the realized marks signal / error / corruption).
- `python3 verify.py accept ID FACE KEY...` — accept marked rows into
  instances (the verified seed). `python3 verify.py list` — the seed.

Population: every model-generated text part in which >=1 active clue
matched. The net NEVER prunes: over-inclusion costs only reading,
under-inclusion deletes signal no later stage can recover. Meaning is
deferred to the scout (the context judgment) and the middle
(categorization); the mine only finds, tags, and counts.

# The report row format

The per-round vocabulary is declared in the round's dispatch; the
loader validates against the union (signal / noise / error /
corruption) and is round-agnostic.

Instance line:
`{"key": n, "cls": "...", "label": "...", "reason": "...", "quote": "..."}`

- cls — the part-side decision; a round's dispatch declares its
  vocabulary (round 1 triage: error / corruption / noise; later
  rounds: signal / noise).
- label — noise rows only: the scout's own classification of what kind
  of noise this is. A free-form string from an unbounded set; the
  apparatus records it, never checks it, never counts it.
- reason — required for noise rows (why the clue matched without
  signal).
- quote — the evidence, verbatim.

Note line:
`{"note": "section", "text": "..."}` — the judgment section comes first
(the report opens with the mandate's judgment).

# Data (composition-event stage — STUB)

The named queries below are the only interface of the composition-event
stage. They return statistics, never bytes. Cite Q<n> + date. The SQL is
re-derived with the stage:

- Q1 mode profile (per-mode volume + span shape; document sizing)
- Q2 shape histogram (the center of gravity: what the subject composed, per mode)
- Q3 recovery surface (error events: echo presence/size/anchor, context)
- Q4 shape reliability (over a sent shape: matched vs passed; the interior fact)
- Q5 prompt boundary (which prompt attributes let the shape through)
- Q6 file contrast (the document's byte spec: what the file held, per mode)
- Q7 census (the population, appendable — cite with date)
- Q8 regime composition (class mix by session edit count)
- Q9 growth (population appendability check)
- Q10 session roster (sids are pure backreferences; title from session_v2)
- Q11 reasoning coverage (the cause channel, per event class)
- Q12 fingerprint (the tool's vocabulary in the reasoning around an event;
    the strong tier = the noMatch error sentence only; the semantic
    diagnosis layer is a judgment fetch, not a stored flag)
