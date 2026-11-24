import path from "path"
import fs from "fs/promises"
import { describe, expect, test } from "bun:test"
import { TestLLM } from "@opencode/ai/testing"
import { decode, GrepLine, LinePrefix } from "@opencode/core/tool/voices"
import { alreadyApplied, ambiguity, closestLines, edited } from "@opencode/core/tool/plugin/edit-voice"
import { fileHeader } from "@opencode/core/tool/plugin/read-voice"
import { foundMatches } from "@opencode/core/tool/plugin/grep-voice"
import { Effect } from "effect"
import { composition } from "./fixture/composition"
import {
  F1_D1,
  F1_F8_CONTENT,
  F1_F8_DRIFTS,
  F1_F8_FINAL,
  F1_F8_LINES,
  F1_F8_NEW,
  F1_F8_OLD,
  F2_CONTENT,
  F2_DRIFTS,
  F2_FINAL,
  F2_LINES,
  F2_NEW,
  F2_OLD,
  F3_ALREADY,
  F3_B7_TEXT,
  F3_CONTENT,
  F3_HINT,
  F3_LINES,
  F3_F4_MISS,
  F3_FINAL,
  F3_NEW,
  F3_OLD,
  F3_REREAD,
  F3_STATES,
  F3_STATE_FOR,
  F4_AMBIGUOUS,
  F4_B7_TEXT,
  F4_CONTENT,
  F4_DRIFTS,
  F4_FINAL,
  F4_LINES,
  F4_MISS,
  F4_NEW,
  F4_OLD,
  F4_STATES,
  F4_STATE_FOR,
  F5_CONTENT,
  F5_DONE_TEXT,
  F5_FINAL,
  F5_LINES,
  F5_NEW,
  F5_OLD,
  F5_STATES,
  F5_STATE_FOR,
  F6_CONTENT,
  F6_DONE_TEXT,
  F6_F11_LINES,
  F6_F11_NEW,
  F6_F11_OLD,
  F6_F11_FINAL_LINES,
  F6_FINAL,
  F6_PAGE_LIMIT,
  F6_PAGE_OFFSET,
  F6_PAGE_TEXT,
  F6_WHOLE_HEADER,
  FILE,
  decodeRendered,
  lastToolPart,
  toolErrorText,
  toolResult,
  toolText,
} from "./functional-spec"

describe("read/edit composition", () => {
  test("advertises the real registered tools on the session's request", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* c.llm.push(TestLLM.text("Done", "text-done"))
          yield* c.runPrompt("Say done")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(1)
          // Risk gate: the session loop's request advertises the registered tools — a registry missing any of
          // the four fails here; a stand-in advertising the same name is caught by the glue test and the
          // tests' byte-exact pins.
          expect(requests[0]?.tools.map((tool) => tool.name)).toEqual(
            expect.arrayContaining(["read", "grep", "edit", "write"]),
          )
        }),
      ),
    )
  })

  test("executes the real read tool and renders its prefixed output into the follow-on request", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F1_F8_CONTENT))
          yield* c.llm.push(TestLLM.toolCall("call-read", "read", { path: FILE }), TestLLM.text("Done", "text-done"))
          yield* c.runPrompt("Read the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(2)
          const read = toolResult(requests[1], "read")
          expect(read?.type).toBe("text")
          const lines = toolText(read).split("\n")
          expect(lines).toContain(LinePrefix.render(1) + "context")
          const target = lines.find((line) => line.startsWith(LinePrefix.render(2)))
          if (target === undefined) throw new Error("Rendered target line missing from the read output")
          expect(decode(target)).toBe("    target line  ")
          expect(lines).toContain(LinePrefix.render(3) + "\ttabbed line")
        }),
      ),
    )
  })

  test("recovers the suggested path, then lands every documented copy drift from the real read output", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F1_F8_CONTENT))
          let decoded: string[] | undefined
          let editsDone = 0
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const edit = toolResult(request, "edit")
            if (edit !== undefined) {
              editsDone += 1
              if (editsDone === 8) return TestLLM.text("Done", "text-done")
              if (decoded === undefined) throw new Error("Edit result arrived before the read")
              return TestLLM.toolCall(`call-edit-${editsDone + 1}`, "edit", {
                path: FILE,
                oldString: F1_F8_DRIFTS[editsDone](decoded),
                newString: F1_F8_NEW[editsDone],
              })
            }
            const read = toolResult(request, "read")
            if (read !== undefined && read.type === "error") {
              // D1: retry the path the failure suggests — the suggestion list rides after the marker.
              const marker = "Did you mean one of these?\n"
              const failureText = toolErrorText(read)
              const start = failureText.indexOf(marker)
              const suggestion = start === -1 ? undefined : failureText.slice(start + marker.length).split("\n")[0]
              if (suggestion === undefined) throw new Error("No suggestion in the read failure")
              return TestLLM.toolCall("call-read-retry", "read", { path: suggestion })
            }
            if (read !== undefined && read.type === "text") {
              const text = toolText(read)
              decoded = F1_F8_LINES.map((_, n) => {
                const line = text.split("\n").find((l) => l.startsWith(LinePrefix.render(n + 1)))
                if (line === undefined) throw new Error(`Rendered line ${n + 1} missing from the read output`)
                const d = decode(line)
                if (d === undefined) throw new Error(`Rendered line ${n + 1} carries no delimiter`)
                return d
              })
              return TestLLM.toolCall("call-edit-1", "edit", {
                path: FILE,
                oldString: F1_F8_DRIFTS[0](decoded),
                newString: F1_F8_NEW[0],
              })
            }
            return TestLLM.toolCall("call-read-bak", "read", { path: "file.txt.bak" })
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix every line of the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(11)
          // D1: the wrong path fails as an error tool result carrying the voice frame naming the suggested file.
          const failedRead = toolResult(requests[1], "read")
          expect(failedRead?.type).toBe("error")
          expect(toolErrorText(failedRead)).toBe(F1_D1)
          // R1: the header states the endings, and every rendered line decodes to the line's exact content.
          const readText = toolText(toolResult(requests[2], "read"))
          expect(readText.split("\n")[0]).toBe(fileHeader(FILE, 1, 9, "crlf"))
          expect(decoded).toEqual(F1_F8_LINES)
          // The drift beats: the verbatim copy (X1/P1), A1, A2, A3, A4, the A6 span splice, the E7
          // re-indent, and the P2 pipe line — each drifted copy accepted, one replacement per call.
          // The outcomes array localises a failure to its beat.
          const outcomes = requests.slice(3, 11).map((request) => toolText(toolResult(request, "edit")))
          expect(outcomes).toEqual(F1_F8_DRIFTS.map(() => edited(FILE, 1)))
          // The model inverted the real rendered lines through the tier's decode; each drift is pinned exactly.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the read output")
          expect(F1_F8_DRIFTS.map((drift) => drift(lines))).toEqual(F1_F8_OLD)
          // Invariant: the tolerant rows' oldStrings are not exact byte substrings of the file;
          // the exact-tier rows are.
          F1_F8_OLD.forEach((old, n) => expect(F1_F8_CONTENT.includes(old)).toBe(n === 0 || n === 6 || n === 7))
          // The file keeps its own whitespace shape and CRLF endings outside the model's content.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F1_F8_FINAL)
        }),
      ),
    )
  })

  test("replaces the exact region over its canonical cousin, splices a mid-line region, and turns twin ambiguity into replaceAll", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F2_CONTENT))
          let decoded: string[] | undefined
          let editsCompleted = 0
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const edit = toolResult(request, "edit")
            if (edit !== undefined) {
              if (edit.type === "error" && toolErrorText(edit) === ambiguity(2)) {
                // B5: the ambiguity error — the voice's own bytes — directs the model to replaceAll.
                if (decoded === undefined) throw new Error("Ambiguity arrived before the read")
                return TestLLM.toolCall("call-edit-4", "edit", {
                  path: FILE,
                  oldString: F2_DRIFTS[3](decoded),
                  newString: F2_NEW[3],
                  replaceAll: true,
                })
              }
              editsCompleted += 1
              if (editsCompleted === 3) return TestLLM.text("Done", "text-done")
              if (decoded === undefined) throw new Error("Edit result arrived before the read")
              return TestLLM.toolCall(`call-edit-${editsCompleted + 1}`, "edit", {
                path: FILE,
                oldString: F2_DRIFTS[editsCompleted](decoded),
                newString: F2_NEW[editsCompleted],
              })
            }
            const read = toolResult(request, "read")
            if (read !== undefined && read.type === "text") {
              decoded = F2_LINES.map((_, n) => {
                const line = toolText(read).split("\n").find((l) => l.startsWith(LinePrefix.render(n + 1)))
                if (line === undefined) throw new Error(`Rendered line ${n + 1} missing from the read output`)
                const d = decode(line)
                if (d === undefined) throw new Error(`Rendered line ${n + 1} carries no delimiter`)
                return d
              })
              return TestLLM.toolCall("call-edit-1", "edit", {
                path: FILE,
                oldString: F2_DRIFTS[0](decoded),
                newString: F2_NEW[0],
              })
            }
            return TestLLM.toolCall("call-read", "read", { path: FILE })
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(6)
          // R1: the header states the endings, and every rendered line decodes to the file's exact bytes.
          const readText = toolText(toolResult(requests[1], "read"))
          expect(readText.split("\n")[0]).toBe(fileHeader(FILE, 1, 5, "crlf"))
          expect(decoded).toEqual(F2_LINES)
          // E1 (exact tier) and E8 (mid-line canonical splice): one replacement each.
          expect(toolText(toolResult(requests[2], "edit"))).toBe(edited(FILE, 1))
          expect(toolText(toolResult(requests[3], "edit"))).toBe(edited(FILE, 1))
          // E2: the twins report the specific ambiguity — no edit lands.
          const ambiguous = toolResult(requests[4], "edit")
          expect(ambiguous?.type).toBe("error")
          expect(toolErrorText(ambiguous)).toBe(ambiguity(2))
          // B5: replaceAll lands every twin.
          expect(toolText(toolResult(requests[5], "edit"))).toBe(edited(FILE, 2))
          // The model inverted the real rendered lines through the tier's decode; each drift is pinned exactly.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the read output")
          expect(F2_DRIFTS.map((drift) => drift(lines))).toEqual(F2_OLD)
          // Invariant: only the exact-tier row is an exact byte substring of the file.
          F2_OLD.forEach((old, n) => expect(F2_CONTENT.includes(old)).toBe(n === 0))
          // The file keeps its own whitespace: the cousin is untouched, and each twin keeps its own indent.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F2_FINAL)
        }),
      ),
    )
  })

  test("recovers each mistake from the edit tool's own failure voice and aborts when the edit is already applied", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F3_CONTENT))
          let decoded: string[] | undefined
          let fresh: string[] | undefined
          let spanOld: string | undefined
          let editSuccesses = 0
          let plainMisses = 0
          let readsSeen = 0
          let aborted = false
          const sentOld: string[] = []
          const sentNew: string[] = []
          const sendEdit = (id: string, oldString: string, newString: string) => {
            sentOld.push(oldString)
            sentNew.push(newString)
            return TestLLM.toolCall(id, "edit", { path: FILE, oldString, newString })
          }
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-read", "read", { path: FILE })
            if (part.name === "edit") {
              if (part.result.type === "error") {
                const message = toolErrorText(part.result)
                if (message.includes(closestLines)) {
                  // B1: the hint renders the closest file lines in read form; decode them and re-issue the span corrected.
                  spanOld = decodeRendered(message, [2, 3, 4]).join("\n")
                  return sendEdit("call-edit-4", spanOld, F3_NEW[3])
                }
                if (message.includes(alreadyApplied)) {
                  // E5: the edit is already applied — B7: abort in text; no further tool calls.
                  aborted = true
                  return TestLLM.text(F3_B7_TEXT, "text-done")
                }
                plainMisses += 1
                if (plainMisses === 1) {
                  // A7: the prefix residue survived the strip — strip it and retry the same edit.
                  if (decoded === undefined) throw new Error("Residue attempt before the read")
                  return sendEdit("call-edit-2", decoded[0], F3_NEW[1])
                }
                // E9's plain not-found; B2: refresh the view of the file before retrying.
                return TestLLM.toolCall("call-read-refresh", "read", { path: FILE })
              }
              editSuccesses += 1
              if (editSuccesses === 1) {
                // E4: a genuine typo inside a three-line span.
                if (decoded === undefined) throw new Error("Typo attempt before the read")
                return sendEdit(
                  "call-edit-3",
                  `${decoded[1]}\n${decoded[2].replace("gamma", "gamna")}\n${decoded[3]}`,
                  F3_NEW[2],
                )
              }
              if (editSuccesses === 2) return sendEdit("call-edit-5", "  ", F3_NEW[4])
              if (editSuccesses === 3) return TestLLM.toolCall("call-grep", "grep", { pattern: "zeta", path: FILE })
              // E5: the stuck model re-issues the span edit that already applied.
              if (spanOld === undefined) throw new Error("Re-issue before the span was established")
              return sendEdit("call-edit-8", spanOld, F3_NEW[7])
            }
            if (part.name === "grep") {
              // B3: re-locate via the preview — terminator-free, a straight copy of the line's content.
              const preview = toolText(part.result).split("\n").find((line) => line.startsWith(GrepLine.render(6)))
              if (preview === undefined) throw new Error("Rendered preview line missing from the grep output")
              const line = decode(preview)
              if (line === undefined) throw new Error("Rendered preview line carries no delimiter")
              return sendEdit("call-edit-7", line, F3_NEW[6])
            }
            if (part.name === "read") {
              readsSeen += 1
              if (readsSeen === 1) {
                decoded = decodeRendered(toolText(part.result), [1, 2, 3, 4, 5, 6])
                // A7: the read prefix residue survived the strip.
                return sendEdit("call-edit-1", `${LinePrefix.render(1)}${decoded[0]}`, F3_NEW[0])
              }
              // B2: the refresh re-read decodes the file as it stands now.
              fresh = decodeRendered(toolText(part.result), [1, 2, 3, 4, 5, 6])
              return sendEdit("call-edit-6", fresh[4], F3_NEW[5])
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(12)
          // R1: the header states the endings, and every rendered line decodes to the file's exact bytes.
          const readText = toolText(toolResult(requests[1], "read"))
          expect(readText.split("\n")[0]).toBe(fileHeader(FILE, 1, 6, "crlf"))
          expect(decoded).toEqual(F3_LINES)
          // A7: the residue oldString fails as a plain not-found — MATCH_CONTRACT, no hint.
          const residue = toolResult(requests[2], "edit")
          expect(residue?.type).toBe("error")
          expect(toolErrorText(residue)).toBe(F3_F4_MISS)
          // The stripped retry lands (exact tier).
          expect(toolText(toolResult(requests[3], "edit"))).toBe(edited(FILE, 1))
          // E4: the typo span fails with the closest lines rendered in read form inside the edit failure.
          const typo = toolResult(requests[4], "edit")
          expect(typo?.type).toBe("error")
          expect(toolErrorText(typo)).toBe(F3_HINT)
          // B1: the hint-decoded span lands.
          expect(toolText(toolResult(requests[5], "edit"))).toBe(edited(FILE, 1))
          // E9: the whitespace-only oldString — the plain not-found, no hint.
          const empty = toolResult(requests[6], "edit")
          expect(empty?.type).toBe("error")
          expect(toolErrorText(empty)).toBe(F3_F4_MISS)
          // B2: the refresh re-read decodes the file as it stands now.
          const reRead = toolResult(requests[7], "read")
          expect(toolText(reRead).split("\n")[0]).toBe(fileHeader(FILE, 1, 6, "crlf"))
          expect(fresh).toEqual(F3_REREAD)
          expect(toolText(toolResult(requests[8], "edit"))).toBe(edited(FILE, 1))
          // B3: the re-grep preview is terminator-free — the real Line N:| form, a straight copy of
          // the line's content.
          const grepText = toolText(toolResult(requests[9], "grep"))
          expect(grepText).toContain(foundMatches(1))
          expect(grepText).toContain(GrepLine.render(6) + "const zeta = 6")
          expect(toolText(toolResult(requests[10], "edit"))).toBe(edited(FILE, 1))
          // E5: the re-issue reports that its newString already stands in the file.
          const reissue = toolResult(requests[11], "edit")
          expect(reissue?.type).toBe("error")
          expect(toolErrorText(reissue)).toBe(F3_ALREADY)
          // B7: the model aborts in text; the request count ends with no follow-on tool call.
          expect(aborted).toBe(true)
          // The model inverted the real rendered output (read, hint, grep) through the tier's decode; each
          // oldString and newString is pinned exactly.
          expect(sentOld).toEqual(F3_OLD)
          expect(sentNew).toEqual(F3_NEW)
          // Invariant: the exact tier surfaces exactly the success beats — each beat's oldString checked
          // against the LF view of the state that beat faced; every failure beat matches nothing there.
          F3_OLD.forEach((old, n) =>
            expect(F3_STATES[F3_STATE_FOR[n]].join("\n").includes(old)).toBe(n === 1 || n === 3 || n === 5 || n === 6),
          )
          // B7: the re-issue left the file byte-identical.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F3_FINAL)
        }),
      ),
    )
  })

  test("widens twin ambiguity with context and aborts on a blank-line structure difference", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F4_CONTENT))
          let decoded: string[] | undefined
          let editSuccesses = 0
          let aborted = false
          const sentOld: string[] = []
          const sentNew: string[] = []

          const sendEdit = (id: string, oldString: string, newString: string) => {
            sentOld.push(oldString)
            sentNew.push(newString)
            return TestLLM.toolCall(id, "edit", { path: FILE, oldString, newString })
          }
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-read", "read", { path: FILE })
            if (part.name === "edit") {
              if (part.result.type === "error") {
                const message = toolErrorText(part.result)
                if (message === ambiguity(2)) {
                  // B4: the twins are ambiguous — widen with the context line to make the match unique.
                  if (decoded === undefined) throw new Error("Ambiguity arrived before the read")
                  return sendEdit("call-edit-2", F4_DRIFTS[1](decoded), F4_NEW[1])
                }
                // N1: the blank-line structure differs — B7: abort in text; no further tool calls.
                aborted = true
                return TestLLM.text(F4_B7_TEXT, "text-done")
              }
              editSuccesses += 1
              if (editSuccesses === 1) {
                // N1: the span the model matched has one extra blank line.
                if (decoded === undefined) throw new Error("Structure attempt before the read")
                return sendEdit("call-edit-3", F4_DRIFTS[2](decoded), F4_NEW[2])
              }
              throw new Error("Unexpected edit success")
            }
            if (part.name === "read") {
              decoded = decodeRendered(toolText(part.result), [1, 2, 3, 4, 5, 6, 7])
              // E2: the twin line re-typed at a third indent matching neither twin.
              return sendEdit("call-edit-1", F4_DRIFTS[0](decoded), F4_NEW[0])
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(5)
          // R1: the header states the endings, and every rendered line decodes to the file's exact bytes.
          const readText = toolText(toolResult(requests[1], "read"))
          expect(readText.split("\n")[0]).toBe(fileHeader(FILE, 1, 7, "crlf"))
          expect(decoded).toEqual(F4_LINES)
          // E2: the twins report the specific ambiguity — no edit lands.
          const ambiguous = toolResult(requests[2], "edit")
          expect(ambiguous?.type).toBe("error")
          expect(toolErrorText(ambiguous)).toBe(F4_AMBIGUOUS)
          // B4: the widened context disambiguates; the replacement keeps the file's indent.
          expect(toolText(toolResult(requests[3], "edit"))).toBe(edited(FILE, 1))
          // N1: the blank-line count is canonical structure — not-found, with the closest lines the hint votes for.
          const structural = toolResult(requests[4], "edit")
          expect(structural?.type).toBe("error")
          expect(toolErrorText(structural)).toBe(F4_MISS)
          // B7: the model aborts in text; the request count ends with no follow-on tool call.
          expect(aborted).toBe(true)
          // The model inverted the real rendered lines through the tier's decode; each oldString and
          // newString is pinned exactly.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the read output")
          expect(F4_DRIFTS.map((drift) => drift(lines))).toEqual(F4_OLD)
          // Invariant: every beat's oldString is not an exact byte substring of the LF view of the state
          // it faced — beats 1-2 ride the canonical tier, beat 3 matches nothing.
          F4_OLD.forEach((old, n) => expect(F4_STATES[F4_STATE_FOR[n]].join("\n").includes(old)).toBe(false))
          // B7: the structural miss left the file byte-identical to the widened edit's result.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F4_FINAL)
        }),
      ),
    )
  })

  test("keeps every line's ending while editing near the BOM and inside an LF block", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F5_CONTENT))
          let decoded: string[] | undefined
          let editSuccesses = 0
          let settled = false
          const sentOld: string[] = []
          const sentNew: string[] = []

          const sendEdit = (id: string, oldString: string, newString: string) => {
            sentOld.push(oldString)
            sentNew.push(newString)
            return TestLLM.toolCall(id, "edit", { path: FILE, oldString, newString })
          }
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-read", "read", { path: FILE })
            if (part.name === "edit") {
              if (part.result.type === "error") throw new Error(`Unexpected edit failure: ${toolErrorText(part.result)}`)
              editSuccesses += 1
              if (editSuccesses === 3) {
                settled = true
                return TestLLM.text(F5_DONE_TEXT, "text-done")
              }
              return sendEdit(`call-edit-${editSuccesses + 1}`, F5_OLD[editSuccesses], F5_NEW[editSuccesses])
            }
            if (part.name === "read") {
              const lines = decodeRendered(toolText(part.result), [1, 2, 3, 4, 5, 6, 7, 8, 9])
              decoded = lines
              return sendEdit("call-edit-1", F5_OLD[0], F5_NEW[0])
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix the file's regions")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(5)
          // R1: the header states the mixed endings, and every rendered line decodes to the file's exact bytes.
          const readText = toolText(toolResult(requests[1], "read"))
          expect(readText.split("\n")[0]).toBe(fileHeader(FILE, 1, 9, "mixed"))
          expect(decoded).toEqual(F5_LINES)
          // E12, E13, E14: each edit lands as one replacement — the outcomes array localises a
          // failure to its beat.
          const outcomes = requests.slice(2, 5).map((request) => toolText(toolResult(request, "edit")))
          expect(outcomes).toEqual(F5_OLD.map(() => edited(FILE, 1)))
          expect(settled).toBe(true)
          // Provenance: every oldString is a verbatim copy of the original decoded lines or of lines
          // the arc itself created.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the read output")
          expect(F5_OLD[0]).toBe(lines.slice(0, 2).join("\n"))
          expect(F5_OLD[1]).toBe(lines.slice(2, 5).join("\n"))
          expect(F5_OLD[2]).toBe(`MID ONE\nMID TWO\n${lines.slice(4, 8).join("\n")}`)
          expect(sentOld).toEqual(F5_OLD)
          expect(sentNew).toEqual(F5_NEW)
          // Invariant: each beat rides the exact tier — its oldString is an LF-view substring of the state it faced.
          expect(F5_STATES[F5_STATE_FOR[0]].join("\n")).toContain(F5_OLD[0])
          expect(F5_STATES[F5_STATE_FOR[1]].join("\n")).toContain(F5_OLD[1])
          expect(F5_STATES[F5_STATE_FOR[2]].join("\n")).toContain(F5_OLD[2])
          // The final file: BOM intact, every line its own ending.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F5_FINAL)
        }),
      ),
    )
  })

  test("verifies the fix by re-reading the edited region as a page", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F6_CONTENT))
          let decoded: string[] | undefined
          let settled = false
          const sentOld: string[] = []
          const sentNew: string[] = []

          const sendEdit = (id: string, oldString: string, newString: string) => {
            sentOld.push(oldString)
            sentNew.push(newString)
            return TestLLM.toolCall(id, "edit", { path: FILE, oldString, newString })
          }
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-read", "read", { path: FILE })
            if (part.name === "read") {
              const text = toolText(part.result)
              if (text.split("\n")[0] !== F6_WHOLE_HEADER) {
                // The paged re-read: the fix landed — the model ends in text.
                settled = true
                return TestLLM.text(F6_DONE_TEXT, "text-done")
              }
              decoded = decodeRendered(text, [1, 2, 3, 4, 5, 6])
              return sendEdit("call-edit-1", F6_F11_OLD, F6_F11_NEW)
            }
            if (part.name === "edit") {
              if (part.result.type === "error") throw new Error(`Unexpected edit failure: ${toolErrorText(part.result)}`)
              return TestLLM.toolCall("call-read-page", "read", { path: FILE, offset: F6_PAGE_OFFSET, limit: F6_PAGE_LIMIT })
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix the failed network check, then verify the fix")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(4)
          // R1 (whole): the header states the ending style, and decoding the actual render recovers the file's lines.
          const wholeText = toolText(toolResult(requests[1], "read"))
          expect(wholeText.split("\n")[0]).toBe(F6_WHOLE_HEADER)
          expect(decoded).toEqual(F6_F11_LINES)
          // The fix lands as one replacement.
          expect(toolText(toolResult(requests[2], "edit"))).toBe(edited(FILE, 1))
          // C6 + R1 (paged): the paged re-read renders exactly — the page's range and endings in the
          // header, the final file's lines in the body, the truncation marker naming the next offset.
          const pagedText = toolText(toolResult(requests[3], "read"))
          expect(pagedText).toBe(F6_PAGE_TEXT)
          // R1 (paged): the page's decoded lines stand in the final file at the same positions
          // (the byte form pinned in F6_PAGE_TEXT).
          expect(decodeRendered(pagedText, [2, 3, 4])).toEqual(F6_F11_FINAL_LINES.slice(1, 4))
          // Provenance: the oldString is the verbatim copy of the rendered line 3.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the read output")
          expect(F6_F11_OLD).toBe(lines[2])
          expect(sentOld).toEqual([F6_F11_OLD])
          expect(sentNew).toEqual([F6_F11_NEW])
          expect(settled).toBe(true)
          // The edit kept the file's endings: CRLF throughout.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F6_FINAL)
        }),
      ),
    )
  })
})
