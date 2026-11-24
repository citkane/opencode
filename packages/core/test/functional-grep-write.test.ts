import path from "path"
import fs from "fs/promises"
import { describe, expect, test } from "bun:test"
import { TestLLM } from "@opencode/ai/testing"
import { decode, GrepLine } from "@opencode/core/tool/voices"
import { foundMatches, pathHeader } from "@opencode/core/tool/plugin/grep-voice"
import { Effect } from "effect"
import { composition } from "./fixture/composition"
import {
  F12_F13_F15_CONTENT,
  F12_F13_F15_F18_F19_LINES,
  F14_CONTENT,
  F14_DONE_TEXT,
  F14_LINES,
  F14_MATCHED,
  F14_NEW_CONTENT,
  F14_NEW_FILE,
  F14_PATTERN,
  F15_F19_DONE_TEXT,
  F15_F19_PATTERN,
  F18_F19_CONTENT,
  FILE,
  lastToolPart,
  toolErrorText,
  toolResult,
  toolText,
} from "./functional-spec"

describe("grep/write composition", () => {
  test("collects the grep matches into a new file, verbatim from the decoded previews", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F14_CONTENT))
          let matched: string[] | undefined
          let settled = false
          let sentContent: string | undefined
          // G1: the previews carry no terminator byte — the model decodes each line as a straight copy.
          const decodePreviews = (text: string, fileLines: number[]) =>
            fileLines.map((n) => {
              const line = text.split("\n").find((l) => l.startsWith(GrepLine.render(n)))
              if (line === undefined) throw new Error(`Rendered preview line ${n} missing from the grep output`)
              const d = decode(line)
              if (d === undefined) throw new Error(`Rendered preview line ${n} carries no delimiter`)
              return d
            })
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-grep", "grep", { pattern: F14_PATTERN, path: FILE })
            if (part.name === "grep") {
              // C4: the collect-matches move — decode the marker's previews (the matching file lines),
              // then write them to the new file. The new file is a fresh artifact, so the model joins
              // the collected content with LF.
              matched = decodePreviews(toolText(part.result), [1, 3, 5])
              sentContent = matched.join("\n") + "\n"
              return TestLLM.toolCall("call-write", "write", { path: F14_NEW_FILE, content: sentContent })
            }
            if (part.name === "write") {
              if (part.result.type === "error") throw new Error(`Unexpected write failure: ${toolErrorText(part.result)}`)
              settled = true
              return TestLLM.text(F14_DONE_TEXT, "text-done")
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Collect the TODO lines into a new file")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(3)
          // G1 (form): the marker's render is the count line, the path header, and the three matching
          // previews — numbered by file line, the non-matching lines absent, no trailing empty line.
          const grepLines = toolText(toolResult(requests[1], "grep")).split("\n")
          expect(grepLines[0]).toBe(foundMatches(3))
          expect(grepLines[1]).toEndWith(pathHeader(FILE))
          expect(grepLines).toHaveLength(5)
          ;[1, 3, 5].forEach((n, m) => expect(grepLines[2 + m]).toBe(GrepLine.render(n) + F14_LINES[n - 1]))
          // The decoded previews are the matched lines in file order — the straight copies, terminator-free.
          expect(matched).toEqual(F14_MATCHED)
          // C4: the write created the new file; the source file is untouched (grep read, write went elsewhere).
          expect(toolText(toolResult(requests[2], "write"))).toBe(`Created file successfully: ${F14_NEW_FILE}`)
          const source = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(source).toBe(F14_CONTENT)
          // The new file's bytes are the decoded previews verbatim: what the model sent is what landed,
          // no prefix, no line-ending byte.
          expect(sentContent).toBe(F14_NEW_CONTENT)
          const collected = yield* Effect.promise(() => fs.readFile(path.join(c.directory, F14_NEW_FILE), "utf8"))
          expect(collected).toBe(F14_NEW_CONTENT)
          expect(settled).toBe(true)
        }),
      ),
    )
  })

  test("pins the fresh grep preview of the file it just wrote, across a CRLF-to-LF rewrite", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          let crlfDecoded: string[] | undefined
          let lfDecoded: string[] | undefined
          let writesDone = 0
          let grepsDone = 0
          let settled = false
          const sentContent: string[] = []
          // G1: the previews carry no terminator byte — the model decodes each line as a straight copy.
          const decodePreviews = (text: string, count: number) =>
            Array.from({ length: count }, (_, n) => {
              const line = text.split("\n").find((l) => l.startsWith(GrepLine.render(n + 1)))
              if (line === undefined) throw new Error(`Rendered preview line ${n + 1} missing from the grep output`)
              const d = decode(line)
              if (d === undefined) throw new Error(`Rendered preview line ${n + 1} carries no delimiter`)
              return d
            })
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) {
              // C8: the fresh-bytes move — write the file the model knows byte-for-byte, CRLF.
              sentContent.push(F12_F13_F15_CONTENT)
              return TestLLM.toolCall("call-write-1", "write", { path: FILE, content: F12_F13_F15_CONTENT })
            }
            if (part.name === "write") {
              if (part.result.type === "error") throw new Error(`Unexpected write failure: ${toolErrorText(part.result)}`)
              writesDone += 1
              // C8: the fresh-bytes move — grep the file the model just wrote.
              return TestLLM.toolCall(`call-grep-${writesDone}`, "grep", { pattern: F15_F19_PATTERN, path: FILE })
            }
            if (part.name === "grep") {
              // G1 (fresh face): decode every line — the blank included — as a straight copy.
              const lines = decodePreviews(toolText(part.result), F12_F13_F15_F18_F19_LINES.length)
              grepsDone += 1
              if (grepsDone === 1) {
                crlfDecoded = lines
                // C8 (LF face): the rewrite — the lines the model just decoded, joined with LF.
                sentContent.push(lines.join("\n") + "\n")
                return TestLLM.toolCall("call-write-2", "write", { path: FILE, content: sentContent[1] })
              }
              lfDecoded = lines
              settled = true
              return TestLLM.text(F15_F19_DONE_TEXT, "text-done")
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Write the file, grep every line, rewrite it in LF, and grep again")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(5)
          // C8: the write created the file.
          expect(toolText(toolResult(requests[1], "write"))).toBe(`Created file successfully: ${FILE}`)
          expect(sentContent[0]).toBe(F12_F13_F15_CONTENT)
          // G1 (fresh face): the render is the count line, the path header, and five clean previews —
          // the blank line renders as the marker alone, the tab and the trailing spaces stand, no blank
          // output lines and no trailing empty line.
          const crlfGrepLines = toolText(toolResult(requests[2], "grep")).split("\n")
          expect(crlfGrepLines[0]).toBe(foundMatches(5))
          expect(crlfGrepLines[1]).toEndWith(pathHeader(FILE))
          expect(crlfGrepLines).toHaveLength(7)
          F12_F13_F15_F18_F19_LINES.forEach((line, n) => expect(crlfGrepLines[2 + n]).toBe(GrepLine.render(n + 1) + line))
          // The decoded previews are the file's exact lines — fresh, terminator-free. The preview
          // render is content-only — the CRLF face's on-disk bytes stand on the write's verbatim
          // contract: what the model sent is what the first grep read.
          expect(crlfDecoded).toEqual(F12_F13_F15_F18_F19_LINES)
          // C8 (LF face): the rewrite overwrote the file the model just grepped.
          expect(toolText(toolResult(requests[3], "write"))).toBe(`Wrote file successfully: ${FILE}`)
          expect(sentContent[1]).toBe(F18_F19_CONTENT)
          // G1 (fresh face, LF): the same render over the converted file — the preview carries no
          // terminator byte on either face.
          const lfGrepLines = toolText(toolResult(requests[4], "grep")).split("\n")
          expect(lfGrepLines[0]).toBe(foundMatches(5))
          expect(lfGrepLines[1]).toEndWith(pathHeader(FILE))
          expect(lfGrepLines).toHaveLength(7)
          F12_F13_F15_F18_F19_LINES.forEach((line, n) => expect(lfGrepLines[2 + n]).toBe(GrepLine.render(n + 1) + line))
          expect(lfDecoded).toEqual(F12_F13_F15_F18_F19_LINES)
          expect(settled).toBe(true)
          // The LF face stands on the on-disk bytes.
          const lfFile = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(lfFile).toBe(F18_F19_CONTENT)
        }),
      ),
    )
  })
})
