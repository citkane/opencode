# AGENTS — the pr-reporting scope

**Gate:** the bug is `BUG.md` — read it first. The bug, in its pre-PR
state (BD-1 through BD-10 and their interrelationship), is understood
throughout all stages: all work in this scope is in service of
reproducing it.

**Load order (canonical):** each document is consistent in itself, given
what the load order already established; the order carries the
relationship between them.

1. `BUG.md` — the bug, in the pre-PR state only.
2. `TERMS.md` — the scope's vocabulary, defined once.
3. `SCHEMA.md` — the data schema of the reproduction (top / middle /
   bottom).
4. `REASONING.md` — the current hypothesis and the state of the
   experiment; fluid. It carries the pointer to
   `bug-reproduction/DATA.md` (the fact-base interface), which is
   off-chain.
5. `bug-reproduction/scaffolding/SCAFFOLD.md` — the method of the
   current stage (the scout loop).
6. `INCIDENTS.md` — the incident log: evidence presented, not yet
   verified — not canonical fact.

**The record:** `BUILD.md` (this directory) — the record of the NOW
state; the sanity check on what happened.

**The branches (this repo):** `dev` — the pre-PR source. `edit-contract`
— the PR work (the fix), committed `29b11c0b98` and pushed to origin.
`git show <branch>:<path>` is the source linkage to them (e.g. the
pre-PR edit tool: `git show dev:packages/core/src/tool/plugin/edit.ts`).
This branch (`pr-reporting`) is the standalone record and reference
point of the reproduction scope — it is not a merge candidate; its
history is reference history, noisy as needed. When a task needs the
`dev` or `edit-contract` tree: commit on this branch first, then
`git checkout` the other; worktrees and `git show` are equally valid
when better suited to the task.

**The binaries:** `binary/` holds the two hosts — `old` (pre-PR,
compiled from `dev`) and `new` (post-PR, compiled from `edit-contract`).
A clean pull holds neither; the genesis workflow compiles them into
`binary/`. The elected host is verified with the user at session start.

**The user directory:** `~/.opencode/plan/opencode/edit-contract/` — the
top-level coordination, outside this scope's load order. `PLAN.md` — the
coordinator of the whole process. `BUILD.md` — the record of the PR
work (the predecessor of this scope's `BUILD.md`). `RUNS.md`,
`queries.md`, `RULES.md` — user-domain documents.

**Bottom tier:** read `RULES.md` in the user directory.
