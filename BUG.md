# BUG — the bug definition (pre-PR state)

The object of the study, in the pre-PR state only. Every stage of the
reproduction reads this before anything else: the bug is what the corpus
reproduces, and no stage's work is meaningful without it.

Provenance: copied verbatim from PLAN.md (§Bug definition). PLAN.md remains
the audit source of record; this file is the load-bearing copy.

---

**Scope.** The bug is a complex interrelationship between a number of catalysts
and code errors. This section states what the bug is and where it is, in the
pre-PR state only — it does not evaluate the fix. All line references are the
pre-PR state: `origin/dev` @ `885df74024`, paths relative to
`packages/core/src` — `tool/plugin/edit.ts` (cited `edit.ts`),
`tool/plugin/read.ts` (`read.ts`), `tool/plugin/grep.ts` (`grep.ts`),
`ripgrep.ts`, `tool/read-filesystem.ts`. Entries carry stable IDs (`BD-…`) so
the bug statement, the measurement appendix, and other parts of this
document can reference them.
Verification tags: **[code]** line-verified against the pre-PR source ·
**[observed]** empirically observed (external tooling included) ·
**[population]** backed by measured failure data from a population of real
  sessions (external to this document) ·
**inference (N=1)** derived, part-scope — not a whole-population claim.

**Catalysts — ambiguous serialization (the producers hand the model a boundary it cannot decode)**

- **BD-1 · the read line render.** `read` renders each text line `NNN: <line>`
  (the whole-file path splits raw on `\n`, `read.ts:286`, and renders at
  `read.ts:290`). The space delimiter is the *same character class* as the
  content's leading whitespace: the prefix/content boundary is not recoverable
  by pattern, and the model is the only decoder (no code parses the prefix).
  The read description (`read.ts:49`) states the shape in prose ("as
  `<line>: <content>`") with no executable inverse rule. [code]
  **[population]** gravity of the failure: in the measured population of
  failing sessions, every error row is a uniform +1 indent drift of the
  sent lines against the file's lines — the decode habit this render
  produces.

- **BD-2 · the grep preview render.** `grep` renders each preview
  `  Line N: <text>` (`grep.ts:54`) — the same ambiguity class, a second
  producer over the same content bytes. The description (`grep.ts:79-80`)
  promises "line previews" — no format stated, no decode rule. [code]

**Spawned bytes — the grep row pipeline**

- **BD-3 · the terminator in the row bytes.** ripgrep's `lines.text` carries
  the line's own terminator (`ripgrep.ts:247-249`); observed on rg 15.2.0:
  CRLF file → `"…\r\n"`, LF file → `"…\n"`, CR-only file → the *entire file
  as one line* (`"alpha\rbravo\rcharlie\r"`). Grep renders the row verbatim
  (`grep.ts:54`) and joins rows on `\n` (`grep.ts:61`): every preview line is
  double-terminated — its own terminator plus the join's.
  [code + observed on system rg 15.2.0; the running host is confirmed
  pre-PR]

- **BD-4 · the artifact on every face, and the stray blank line as a spawned
  byte.** Every preview line is followed by a blank line (row terminator +
  join's `\n`) and the output ends with a trailing empty line; no stable
  parseable form exists. The stray blank line is *inside the copy space*: a
  model assembling a multi-line `oldString` from consecutive previews cannot
  attribute it (file content vs render artifact — nothing on the surface
  says). Outcome branches on the pre-PR trailing tier
  (`findLineOccurrences`, `edit.ts:66-95`; code-traced): the blank included
  and the file's lines adjacent → hard not-found (error face); the same
  content pair present elsewhere with a real blank between → a wrong-region
  edit (the corruption face: it completes without an error and the file's
  bytes change); the file has exactly one real blank
  between them → attribution irrecoverable in either direction. [code; the
  model's stochastic inclusion is inference — the render fact stands on its
  own]

- **BD-5 · the trajectory split on file endings — one splice, different
  spawned bytes.** LF: the blank-line artifact only; no foreign byte inside
  the previewed content. CRLF: the artifact *plus* `\r` at the end of the
  previewed content — the stray-terminator trajectory (the variance
  catalogue's A8, the stray line-ending byte). CR-only: the artifact *plus*
  the
  whole file degrading to one preview line carrying `\r` bytes as content.
  "The LF face is benign" does not hold: the artifact and the delimiter
  ambiguity (BD-1/BD-2) are face-independent; the LF face's spawn simply
  lacks the masked byte. [observed; see BD-3]

**Code errors — the matcher engine (the 3-tier design, pre-PR)**

- **BD-6 · the three-tier matcher.** exact (`edit.ts:56-63`) → typographic
  one-to-one (`edit.ts:176`, `normalizeForMatch` `edit.ts:49-55`; the
  one-to-one mapping is what preserves offsets, `edit.ts:175`) →
  trailing line-anchored tier (`edit.ts:66-95`). The defects below are
  structural — they name the design rather than a single line:

  (a) **the `trimEnd` mask** (`edit.ts:89`): the trailing tier compares lines
  via `normalizeForMatch(text.trimEnd())`. Two directions — (i) **drop**: the
  file carries trailing whitespace, the model's re-typed copy does not → the
  match passes → the splice writes the model's bytes → the file's trailing
  whitespace is deleted without an error (the headline of #62211); (ii) **accept**:
  the model carries a byte the file lacks (stray `\r`, spaces) → the match
  passes → the model's byte lands. Direction (ii) is the trajectory that
  concealed the CRLF/CR spawns (BD-5): pre-PR, the leak never surfaced as an
  error face — nothing in the loop signalled it.

  (b) **`contentEnd`** (`edit.ts:79`): a lone `\r` is excluded from the
  region end while the comparison absorbs it — one mechanism, two
  inconsistent halves; in the LF view it governs only the lone-CR line
  class.

  (c) **tab↔space and internal space-run tolerance are structurally
  inexpressible**: `normalizeForMatch` never touches `\t`; the trailing tier
  compares runs verbatim.

  (d) **mid-line regions exist only on the exact/typographic axis**: the
  typographic tier is a plain substring search over one-to-one normalized
  text; whitespace drift cannot be offset-mapped (collapse is not
  length-preserving), and the trailing tier is line-anchored
  (`edit.ts:66-95`).

  (e) **`replaceAll` replaces only the winning tier's occurrences**
  (`edit.ts:311-313`): whitespace-variant twins found only in a lower tier
  survive.

  (f) **the declared match space has two deviations.** The matcher's own doc
  (`edit.ts:164-167`): "Matches against the LF view Read shows the model."
  (i) The mask (a) accepts bytes outside that view's whitespace contract;
  (ii) the `endingsOnly` bypass (`edit.ts:306-309`) raw-searches `source` —
  a second, coexisting match space. Derived observation (inference, N=1):
  `x\r\ny` → `x\ny` on an LF file yields not-found, where the contract would
  say no-op.

  [code throughout]

- **BD-7 · the match × write defect pair.** The splice writes the model's
  line bytes verbatim — only the region's line *endings* are re-attached
  (`withRegionEndings`, `edit.ts:112-124`; the replace closure
  `edit.ts:184-185`). The mask's accepted bytes (BD-6a-ii) are the bytes
  that land; its dropped bytes (BD-6a-i) are the file's trailing whitespace
  that dies. Both sides are necessary for the corruption faces. [code]

**Code errors — the read side**

- **BD-8 · the CRLF rendering split.** The whole-file path splits raw on
  `\n` and keeps the `\r` per line (`read.ts:286-290`); the paged path
  strips it (`read-filesystem.ts:298`). The same CRLF file renders
  differently on its own two paths; the file header (`read.ts:288`) carries
  no ending-style signal. CR-only files render as one line on both paths
  (`read.ts:286`; `read-filesystem.ts:296`). [code]

**Voice — the pre-PR state of the model-facing strings**

- **BD-9.** (a) The edit description (`edit.ts:275`) frames matching as
  "finding and replacing **exact** text"; teaches the `\r` operation ("To
  change line endings themselves…"); blesses the mask's workaround ("…
  retries while ignoring … then trailing whitespace on each line"); and
  states the prefix only as "such as `1: `" — a shape without an inverse
  rule. (b) **Four-way variance** the model experiences: the description's
  tolerance ↔ the not-found error "It must match exactly, including
  whitespace and indentation" (`edit.ts:332`) ↔ hint behaviour ↔ matcher
  behaviour — the recovery signal is unreliable. (c) The non-endings no-op
  message also teaches `\r` (`edit.ts:344`) — a second teaching site.
  (d) **Not DRY**: "Unable to edit" duplicated (`edit.ts:300`/`:361`); read's
  truncation marker duplicated (`read.ts:279`/`:292`); read's `limit`
  annotation hardcodes "2000" (`read.ts:26`) where the cap is
  `MAX_READ_LINES` (`read-filesystem.ts:14`). (e) **Three producers, three
  prose-without-inverse shapes**: read (`read.ts:49`), grep
  (`grep.ts:79-80`), edit's prefix clause (`edit.ts:275`). [code]

**Amplifier**

- **BD-10 · `missHint`.** (`edit.ts:199-241`) Re-renders the closest lines in
  the *same ambiguous* `NNN: ` notation (`edit.ts:238`) — the recovery path
  is a second decode event of the same class as the failure. Its vote key
  (`edit.ts:204`) collapses every whitespace run, including tabs and `\r` —
  more lenient than every matcher tier (the typographic tier is one-to-one,
  `edit.ts:176`; the trailing tier compares runs verbatim, `edit.ts:89`) —
  the hint can vote lines the matcher can never accept. [code; "structural
  contributor to the retry loop" = inference, N=1]

**The interrelationship — how the parts combine**

The failure is born in the composition event — the model's decode of a
render into a sent span. The code decides only the face:

1. The catalysts (BD-1, BD-2) make the decode ambiguous on every face and
   every file.
2. The spawns (BD-3–BD-5) add bytes the model cannot attribute — the stray
   blank line on every face; `\r` on the CRLF and CR faces.
3. The mask (BD-6a) converts the accept direction into concealment — the
   CRLF/CR spawns never surface as errors pre-PR — and the drop direction
   into deletion without an error (#62211).
4. The splice (BD-7) writes the accepted bytes; the read split (BD-8) widens
   the gap between the model's believed bytes and the file's.
5. The voice variance (BD-9) and the hint (BD-10) shape the recovery: the
   retry re-quotes through the same ambiguous render — the failure compounds
   across retries (the population's consequence class: probe ladders, shell
   escapes after errors — measured).

A realization's face (error / corruption / concealed) is a property of that
realization, not a separate bug. One interrelationship, many faces.
