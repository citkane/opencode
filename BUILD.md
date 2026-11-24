# BUILD — the build record (the pr-reporting scope)

**Status:** P13 (report) in flight — a trigger is on record (run 12,
error M1 ×2); the scout loop is the active thread.

**Landscape (recorded 2026-11-24):** the reproduction scope became its
own branch — `pr-reporting` (worktree
/home/michael/Work/forks/opencode-pr-reporting); the PR work was
committed to `edit-contract` (`29b11c0b98`) and pushed to origin. The
standing branch facts and the workflow between them: AGENTS.md.

**Meta context (bearing, not for loading):** the top-level coordination
lives in the user directory
`~/.opencode/plan/opencode/edit-contract/` — `PLAN.md` (the
coordinator) and `BUILD.md` (this document's predecessor: the PR-work
record). In case it is needed.

## P13 — trigger subagent failures (in flight)

**State (mechanical, 2026-11-23)** — paths below are relative to the
branch root of this scope unless stated otherwise.

- Scout loop (the active P13 thread; method:
  `bug-reproduction/scaffolding/SCAFFOLD.md`): the net is seeded from
  the protected genesis clue set; the mine is live (census:
  `mine.out`); the channel is smoke-tested end to end. Cursor: R1's
  field is unbuilt — the next action is to build it and dispatch R1
  (the round sequence in SCAFFOLD.md).

- Live specimen: `bug-reproduction/scaffolding/specimen/relay.ts` (158
  lines, sha `7b71b59c…`) — the post-run-15 state of relay v2 (15
  cues, planted bug fixed, `repair` retired). Reset between runs from
  the pristine copy below.

- Pristine reference (never edited):
  `bug-reproduction/scaffolding/specimen/relay-pristine.ts` (v2, 164
  lines, sha `d0624e72…`). After a promotion the new pristine copy
  lands here and the sha is recorded here.

- Candidate v3 (written, NOT yet the specimen, unvalidated):
  `bug-reproduction/scaffolding/specimen/relay-scaffold.ts` (206 lines,
  sha `760d2e2b…`) — 22 numbered stages (n 0–21), a per-stage `reduce`
  switch, a 22-entry verify table, a planted verify-table
  inconsistency, redundant stages present. Validate before promotion
  (Next, step 1).

- Host: the pre-PR build the user explicitly loads — `binary/old`
  (compiled by the genesis workflow; AGENTS.md).

- Subject: the default harness agent `general` (subagent spawn).
  Post-trigger confirmation: `doc-worker` (decontaminated definition —
  "Document editor.", free model; git-excluded).

- Prompt: "Update this lib so that <task>;
  bug-reproduction/scaffolding/specimen/relay.ts" — one sentence, no
  preamble (the harness prepends it), no state bullets, no mechanics,
  no counts, no anchors or line numbers, no "do not change anything
  else", no vendor framing. <task> is chosen from the current
  REASONING build, not fixed here.

- Data layer (`bug-reproduction/`): fact base (`DATA.md` ·
  `data.sqlite` · `mine.out`) · `scaffolding/scout/` (db · clues ·
  miner · field · report · verify · scout_offby · genesis-clues.json) ·
  `scaffolding/event/` (`audit.py` · `trace.py`) ·
  `scaffolding/prepr/` · `scaffolding/specimen/`.

**Next (mechanical)**

- Active thread: the scout loop — the cursor above, against the round
  sequence in SCAFFOLD.md. After the loop, ONLY when the population is
  complete AND evaluated: the generate stage (SCHEMA.md — the loop) ·
  REASONING improvement (explicit user instruction) · the held vehicle
  decision (A1 real coupling / A2 prose-carrier v4 / A3 calibration
  fire of v3) · the parked before/after vehicle (the join-artifact
  drift probe: blanks that fail pre-PR and work post-PR).

- Held thread: the vehicle flow below (steps 1–5, with the sampling
  and judgment rules) — it resumes only after the population is
  complete.

1. Decide the document (v3 as written, or the next document per the
   current REASONING); then validate: repo `tsc`
   (`node_modules/.bin/tsc --noEmit --strict --target es2022 --module
   esnext --moduleResolution bundler --ignoreConfig <file>`) passes;
   `drive()` runs clean; `run()` throws at the planted verify entry;
   `relay.ts` is still absent from the repo; and the coupling check —
   on a scratch copy, retire one no-op stage and measure the smallest
   faithful edit(s) required: the candidate passes only if the task
   forces a span over 16 lines or touches 2+ coupled regions.

2. Promote: `cp` the validated document → the live specimen; set the
   new pristine reference at `relay-pristine.ts`; record here the sha
   plus the measured properties — true no-op stages (settle ==
   precondition), the largest uniform span (lines + indent), the
   planted-bug entry. These are the numbers REASONING's claims may
   cite.

3. Fire on `general` (the prompt above).

4. Audit the run: `python3 bug-reproduction/scaffolding/event/audit.py
   <sid>` + diff live file vs pristine + tsc + runtime on the
   post-run file.

5. Judge error/corruption/clean per the rule below; append the run
   here — session id + facts, carrying the numbers later claims cite.
   **Triggered?** → confirmation run on `doc-worker`, then yield.
   **Not triggered?** → re-fire the same cell per the sampling rule
   below; at the cell's N the hand-off is to REASONING.md (build the
   next document from its current state), return to step 1.

**Sampling rule (standing):** a fixed document + prompt cell gets 3–5
fires before it is judged; the document changes only on a cell verdict;
each fire's outcome and the cell's N are recorded here. The fallacy
rule as loop procedure: a cell carries its N before any claim about
it.

**Judgment rule (mechanical)**

- Error M1: an edit whose oldString is a uniform positive indent offset
  across aligned lines, + the "Could not find oldString" error.

- Corruption M10: a COMPLETED edit whose carried lines land
  re-indented against the file's structure — verify the file's actual
  structure before judging (runs 8–11's 16→14sp re-levels were
  legitimate wrapper folds, not drift).
