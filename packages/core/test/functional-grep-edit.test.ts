import path from "path"
import fs from "fs/promises"
import { describe, expect, test } from "bun:test"
import { TestLLM } from "@opencode/ai/testing"
import { decode, GrepLine } from "@opencode/core/tool/voices"
import { edited } from "@opencode/core/tool/plugin/edit-voice"
import { foundMatches, noMatches, pathHeader } from "@opencode/core/tool/plugin/grep-voice"
import { Effect } from "effect"
import { composition } from "./fixture/composition"
import {
  F11_CONTENT,
  F11_DONE_TEXT,
  F11_FINAL,
  F11_WHOLE_HEADER,
  F1_F8_CONTENT,
  F1_F8_DRIFTS,
  F1_F8_FINAL,
  F1_F8_LINES,
  F1_F8_NEW,
  F1_F8_OLD,
  F6_F11_FINAL_LINES,
  F6_F11_LINES,
  F6_F11_NEW,
  F6_F11_OLD,
  F7_CONTENT,
  F7_DONE_TEXT,
  F7_PATTERN_MATCH,
  F7_PATTERN_MISS,
  F8_F11_PATTERN,
  FILE,
  decodeRendered,
  lastToolPart,
  toolErrorText,
  toolResult,
  toolText,
} from "./functional-spec"

describe("grep/edit composition", () => {
  test("fixes every line from the grep preview, decoding each line as a straight copy", async () => {
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
              if (edit.type === "error") throw new Error(`Unexpected edit failure: ${toolErrorText(edit)}`)
              editsDone += 1
              if (editsDone === 8) return TestLLM.text("Done", "text-done")
              if (decoded === undefined) throw new Error("Edit result arrived before the grep")
              return TestLLM.toolCall(`call-edit-${editsDone + 1}`, "edit", {
                path: FILE,
                oldString: F1_F8_DRIFTS[editsDone](decoded),
                newString: F1_F8_NEW[editsDone],
              })
            }
            const grep = toolResult(request, "grep")
            if (grep !== undefined && grep.type === "text") {
              // G1: the previews carry no terminator byte — the model decodes each line as a straight copy.
              const text = toolText(grep)
              decoded = F1_F8_LINES.map((_, n) => {
                const line = text.split("\n").find((l) => l.startsWith(GrepLine.render(n + 1)))
                if (line === undefined) throw new Error(`Rendered preview line ${n + 1} missing from the grep output`)
                const d = decode(line)
                if (d === undefined) throw new Error(`Rendered preview line ${n + 1} carries no delimiter`)
                return d
              })
              return TestLLM.toolCall("call-edit-1", "edit", {
                path: FILE,
                oldString: F1_F8_DRIFTS[0](decoded),
                newString: F1_F8_NEW[0],
              })
            }
            return TestLLM.toolCall("call-grep", "grep", { pattern: F8_F11_PATTERN, path: FILE })
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix every line of the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(10)
          // G1 (form): every preview is the line's content, terminator-free — the rendered output is the
          // count line, the path header, and the previews, with no blank lines and no trailing empty line.
          const grepLines = toolText(toolResult(requests[1], "grep")).split("\n")
          expect(grepLines[0]).toBe(foundMatches(9))
          expect(grepLines[1]).toEndWith(pathHeader(FILE))
          expect(grepLines).toHaveLength(11)
          F1_F8_LINES.forEach((line, n) => {
            expect(grepLines[2 + n]).toBe(GrepLine.render(n + 1) + line)
          })
          // The decoded lines are the file's exact lines.
          expect(decoded).toEqual(F1_F8_LINES)
          // The drift beats: the verbatim copy (X1/P1), A1, A2, A3, A4, the A6 span splice, the E7
          // re-indent, and the P2 pipe line — each drifted copy accepted, one replacement per call.
          // The outcomes array localises a failure to its beat.
          const outcomes = requests.slice(2, 10).map((request) => toolText(toolResult(request, "edit")))
          expect(outcomes).toEqual(F1_F8_DRIFTS.map(() => edited(FILE, 1)))
          // The model inverted the real preview lines through the tier's decode — a straight copy;
          // each drift is pinned exactly.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the grep output")
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

  test("recovers a no-match grep by broadening the pattern", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F7_CONTENT))
          let decoded: string | undefined
          let settled = false
          const patterns: string[] = []
          const sendGrep = (id: string, pattern: string) => {
            patterns.push(pattern)
            return TestLLM.toolCall(id, "grep", { pattern, path: FILE })
          }
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const grep = toolResult(request, "grep")
            if (grep === undefined) return sendGrep("call-grep-1", F7_PATTERN_MISS)
            if (grep.type !== "text") throw new Error(`Unexpected grep result type: ${grep.type}`)
            const text = toolText(grep)
            if (text.split("\n")[0] === noMatches) {
              // D2: the first pattern matched nothing — broaden to the line's stable fragment.
              return sendGrep("call-grep-2", F7_PATTERN_MATCH)
            }
            const preview = text.split("\n").find((line) => line.startsWith(GrepLine.render(2)))
            if (preview === undefined) throw new Error("Rendered preview line missing from the grep output")
            const line = decode(preview)
            if (line === undefined) throw new Error("Rendered preview line carries no delimiter")
            decoded = line
            settled = true
            return TestLLM.text(F7_DONE_TEXT, "text-done")
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Find the answer line in the file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(3)
          // D2: the no-match arrives as a success text carrying the voice's own line.
          expect(toolText(toolResult(requests[1], "grep")).split("\n")[0]).toBe(noMatches)
          // G1 (form): the match renders the count line, the path header, and the preview — the line's
          // content, terminator-free: the rendered text ends with the preview, no trailing empty line.
          const matchLines = toolText(toolResult(requests[2], "grep")).split("\n")
          expect(matchLines[0]).toBe(foundMatches(1))
          expect(matchLines[1]).toEndWith(pathHeader(FILE))
          expect(matchLines[2]).toBe(GrepLine.render(2) + "    the answer is 42")
          expect(matchLines).toHaveLength(3)
          // The preview is terminator-free: decoding is a straight copy of the line's content.
          expect(decoded).toBe("    the answer is 42")
          // The first no-match was genuine, the broadened pattern hits; the model issued exactly those two.
          expect(F7_CONTENT).not.toContain(F7_PATTERN_MISS)
          expect(F7_CONTENT).toContain(F7_PATTERN_MATCH)
          expect(patterns).toEqual([F7_PATTERN_MISS, F7_PATTERN_MATCH])
          expect(settled).toBe(true)
          // Grep is read-only: the file's bytes stand untouched.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F7_CONTENT)
        }),
      ),
    )
  })

  test("verifies the fix through the grep previews of the mixed-ending file", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F11_CONTENT))
          let decoded: string[] | undefined
          let previews: string[] | undefined
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
              // R1 (mixed): the whole read's header states the mixed ending style up front.
              if (text.split("\n")[0] !== F11_WHOLE_HEADER) throw new Error(`Unexpected read header: ${text.split("\n")[0]}`)
              decoded = decodeRendered(text, [1, 2, 3, 4, 5, 6])
              return sendEdit("call-edit-1", decoded[2], F6_F11_NEW)
            }
            if (part.name === "edit") {
              if (part.result.type === "error") throw new Error(`Unexpected edit failure: ${toolErrorText(part.result)}`)
              return TestLLM.toolCall("call-grep", "grep", { pattern: F8_F11_PATTERN, path: FILE })
            }
            if (part.name === "grep") {
              // G1 (mixed face): the previews carry no terminator byte — the model decodes each line
              // as a straight copy and ends in text.
              const text = toolText(part.result)
              previews = F6_F11_FINAL_LINES.map((_, n) => {
                const line = text.split("\n").find((l) => l.startsWith(GrepLine.render(n + 1)))
                if (line === undefined) throw new Error(`Rendered preview line ${n + 1} missing from the grep output`)
                const d = decode(line)
                if (d === undefined) throw new Error(`Rendered preview line ${n + 1} carries no delimiter`)
                return d
              })
              settled = true
              return TestLLM.text(F11_DONE_TEXT, "text-done")
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Fix the failed network check, then verify the fix")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(4)
          // R1 (mixed): the header states the mixed ending style, and decoding the actual render
          // recovers the file's lines.
          const wholeText = toolText(toolResult(requests[1], "read"))
          expect(wholeText.split("\n")[0]).toBe(F11_WHOLE_HEADER)
          expect(decoded).toEqual(F6_F11_LINES)
          // The fix lands as one replacement.
          expect(toolText(toolResult(requests[2], "edit"))).toBe(edited(FILE, 1))
          // G1 (mixed face): the render is the count line, the path header, and six clean previews —
          // both ending forms in one render, no blank lines and no trailing empty line.
          const grepLines = toolText(toolResult(requests[3], "grep")).split("\n")
          expect(grepLines[0]).toBe(foundMatches(6))
          expect(grepLines[1]).toEndWith(pathHeader(FILE))
          expect(grepLines).toHaveLength(8)
          F6_F11_FINAL_LINES.forEach((line, n) => {
            expect(grepLines[2 + n]).toBe(GrepLine.render(n + 1) + line)
          })
          // The decoded previews are the final file's exact lines — the fix stands at line 3.
          expect(previews).toEqual(F6_F11_FINAL_LINES)
          // Provenance: the oldString is the verbatim copy of the rendered line 3.
          const lines = decoded
          if (lines === undefined) throw new Error("The model never decoded the read output")
          expect(F6_F11_OLD).toBe(lines[2])
          expect(sentOld).toEqual([F6_F11_OLD])
          expect(sentNew).toEqual([F6_F11_NEW])
          expect(settled).toBe(true)
          // The edit kept every line's own ending: CRLF and LF as the file had them.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F11_FINAL)
        }),
      ),
    )
  })
})
