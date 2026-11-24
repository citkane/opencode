import path from "path"
import fs from "fs/promises"
import { describe, expect, test } from "bun:test"
import { TestLLM } from "@opencode/ai/testing"
import { Effect } from "effect"
import { composition } from "./fixture/composition"
import {
  F12_F13_F15_CONTENT,
  F12_F13_F15_F18_F19_LINES,
  F12_F13_WHOLE_HEADER,
  F12_F18_DONE_TEXT,
  F13_DONE_TEXT,
  F13_WHOLE_TEXT,
  F18_F19_CONTENT,
  F18_WHOLE_HEADER,
  FILE,
  decodeRendered,
  lastToolPart,
  toolErrorText,
  toolResult,
  toolText,
} from "./functional-spec"

describe("read/write composition", () => {
  test("reconstructs the file byte-for-byte from the whole read, across a CRLF-to-LF conversion", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F12_F13_F15_CONTENT))
          let decoded: string[] | undefined
          let lfDecoded: string[] | undefined
          let writesDone = 0
          let settled = false
          const sentContent: string[] = []

          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-read-1", "read", { path: FILE })
            if (part.name === "read") {
              const text = toolText(part.result)
              const header = text.split("\n")[0]
              if (header !== F12_F13_WHOLE_HEADER && header !== F18_WHOLE_HEADER)
                throw new Error(`Unexpected read header: ${header}`)
              const lines = decodeRendered(text, [1, 2, 3, 4, 5])
              if (header === F12_F13_WHOLE_HEADER) {
                // R1: the header states the CRLF endings up front — the clause earns its keep: it
                // is what tells the model the file is CRLF before it writes anything back.
                decoded = lines
                // C3: write the decoded lines back joined with CRLF per the header — verbatim, no
                // prefix, no line-ending byte.
                sentContent.push(decoded.join("\r\n") + "\r\n")
                return TestLLM.toolCall("call-write-1", "write", { path: FILE, content: sentContent[0] })
              }
              // R1 (LF face): the header states the LF endings — the same clause on the converted file.
              lfDecoded = lines
              // C3 (LF face): write the decoded lines back joined with LF per the header.
              sentContent.push(lfDecoded.join("\n") + "\n")
              return TestLLM.toolCall("call-write-3", "write", { path: FILE, content: sentContent[2] })
            }
            if (part.name === "write") {
              if (part.result.type === "error") throw new Error(`Unexpected write failure: ${toolErrorText(part.result)}`)
              writesDone += 1
              if (writesDone === 1) {
                // C8: the conversion — the lines the model just decoded, joined with LF.
                if (decoded === undefined) throw new Error("Conversion before the read")
                sentContent.push(decoded.join("\n") + "\n")
                return TestLLM.toolCall("call-write-2", "write", { path: FILE, content: sentContent[1] })
              }
              if (writesDone === 2) return TestLLM.toolCall("call-read-2", "read", { path: FILE })
              settled = true
              return TestLLM.text(F12_F18_DONE_TEXT, "text-done")
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Write the file back exactly as it is, then in LF, and confirm it")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(6)
          // R1 (CRLF face): the header states the CRLF endings, and decoding the actual render
          // recovers the file's lines.
          const crlfText = toolText(toolResult(requests[1], "read"))
          expect(crlfText.split("\n")[0]).toBe(F12_F13_WHOLE_HEADER)
          expect(decoded).toEqual(F12_F13_F15_F18_F19_LINES)
          // C3 (CRLF face): the write overwrote the existing file — the decoded render re-joined
          // with CRLF per the header is the file's exact bytes; write is byte-verbatim, so the
          // on-disk state the conversion then faced is exactly this.
          expect(toolText(toolResult(requests[2], "write"))).toBe(`Wrote file successfully: ${FILE}`)
          expect(sentContent[0]).toBe(F12_F13_F15_CONTENT)
          // C8: the conversion is the model's own content — the decoded lines joined with LF.
          expect(toolText(toolResult(requests[3], "write"))).toBe(`Wrote file successfully: ${FILE}`)
          expect(sentContent[1]).toBe(F18_F19_CONTENT)
          // R1 (LF face): the header states the LF endings, and decoding the actual render
          // recovers the file's lines — the composed proof that the conversion landed on disk.
          const lfText = toolText(toolResult(requests[4], "read"))
          expect(lfText.split("\n")[0]).toBe(F18_WHOLE_HEADER)
          expect(lfDecoded).toEqual(F12_F13_F15_F18_F19_LINES)
          // C3 (LF face): the write overwrote the converted file — the decoded render re-joined
          // with LF per the header is the file's exact bytes.
          expect(toolText(toolResult(requests[5], "write"))).toBe(`Wrote file successfully: ${FILE}`)
          expect(sentContent[2]).toBe(F18_F19_CONTENT)
          expect(settled).toBe(true)
          // The final file is the converted file byte-for-byte: write is verbatim, no prefix, no
          // line-ending byte.
          const lfFile = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(lfFile).toBe(F18_F19_CONTENT)
        }),
      ),
    )
  })

  test("reads back the CRLF file it just wrote and pins its fresh render", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          let decoded: string[] | undefined
          let settled = false

          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined) return TestLLM.toolCall("call-write-1", "write", { path: FILE, content: F12_F13_F15_CONTENT })
            if (part.name === "write") {
              if (part.result.type === "error") throw new Error(`Unexpected write failure: ${toolErrorText(part.result)}`)
              return TestLLM.toolCall("call-read", "read", { path: FILE })
            }
            if (part.name === "read") {
              decoded = decodeRendered(toolText(part.result), [1, 2, 3, 4, 5])
              settled = true
              return TestLLM.text(F13_DONE_TEXT, "text-done")
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Write the file, then read it back")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(3)
          // C8: the write created the new file.
          expect(toolText(toolResult(requests[1], "write"))).toBe(`Created file successfully: ${FILE}`)
          // R1: the fresh render is pinned to the byte — the header, the five N:| lines, and no
          // trailing newline.
          const readText = toolText(toolResult(requests[2], "read"))
          expect(readText).toBe(F13_WHOLE_TEXT)
          // The render decodes back to the bytes just written — the fresh render is lossless.
          expect(decoded).toEqual(F12_F13_F15_F18_F19_LINES)
          expect(settled).toBe(true)
          // The file's bytes are the content the model wrote.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F12_F13_F15_CONTENT)
        }),
      ),
    )
  })
})
