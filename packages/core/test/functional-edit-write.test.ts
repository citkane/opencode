import path from "path"
import fs from "fs/promises"
import { describe, expect, test } from "bun:test"
import { TestLLM } from "@opencode/ai/testing"
import { Effect } from "effect"
import { composition } from "./fixture/composition"
import {
  FILE,
  F17_B6,
  F17_CONTENT,
  F17_DONE_TEXT,
  F17_FINAL,
  F17_LINES,
  F17_NEW_LINE,
  F17_WHOLE_HEADER,
  decodeRendered,
  lastToolPart,
  toolErrorText,
  toolResult,
  toolText,
} from "./functional-spec"

describe("edit/write composition", () => {
  test("falls back to a rewrite when edit rejects the empty oldString, and pins the final bytes", async () => {
    await Effect.runPromise(
      composition((c) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(path.join(c.directory, FILE), F17_CONTENT))
          let sentContent: string | undefined
          let settled = false
          // The scripted model consumes the actual rendered tool output from the request it receives.
          const responder: TestLLM.Responder = (request) => {
            const part = lastToolPart(request)
            if (part === undefined)
              // B6: the model reaches for edit with an empty oldString — it meant to write.
              return TestLLM.toolCall("call-edit", "edit", { path: FILE, oldString: "", newString: F17_NEW_LINE })
            if (part.name === "edit") {
              // B6: the empty-oldString voice is the documented edit→write handoff — delivered
              // verbatim, then followed.
              if (part.result.type !== "error") throw new Error("Unexpected edit success")
              if (toolErrorText(part.result) !== F17_B6) throw new Error(`Unexpected edit voice: ${toolErrorText(part.result)}`)
              return TestLLM.toolCall("call-read", "read", { path: FILE })
            }
            if (part.name === "read") {
              const text = toolText(part.result)
              // R1: the header states the CRLF endings — the join premise for the rewrite.
              if (text.split("\n")[0] !== F17_WHOLE_HEADER) throw new Error(`Unexpected read header: ${text.split("\n")[0]}`)
              // B6: decode the current bytes, correct the line the edit was meant to reach, and
              // rewrite the whole file with CRLF per the header.
              const lines = decodeRendered(text, [1, 2, 3, 4])
              sentContent = lines.map((line) => (line === F17_LINES[1] ? F17_NEW_LINE : line)).join("\r\n") + "\r\n"
              return TestLLM.toolCall("call-write", "write", { path: FILE, content: sentContent })
            }
            if (part.name === "write") {
              if (part.result.type === "error") throw new Error(`Unexpected write failure: ${toolErrorText(part.result)}`)
              settled = true
              return TestLLM.text(F17_DONE_TEXT, "text-done")
            }
            throw new Error(`Unexpected most recent tool: ${part.name}`)
          }
          yield* c.llm.serve(responder)
          yield* c.runPrompt("Set the mode to release")

          const requests = yield* c.llm.requests()
          expect(requests).toHaveLength(4)
          // B6: the empty-oldString voice arrives as the edit's error result — the voice's own
          // bytes, the only documented edit→write move in the tool's voice.
          const edit = toolResult(requests[1], "edit")
          expect(edit?.type).toBe("error")
          expect(toolErrorText(edit)).toBe(F17_B6)
          // R1: the header states the CRLF endings up front.
          expect(toolText(toolResult(requests[2], "read")).split("\n")[0]).toBe(F17_WHOLE_HEADER)
          // B6: the rewrite lands the corrected content — the write voice is the existing file's.
          expect(toolText(toolResult(requests[3], "write"))).toBe(`Wrote file successfully: ${FILE}`)
          expect(sentContent).toBe(F17_FINAL)
          expect(settled).toBe(true)
          // The final bytes are the model's content verbatim.
          const file = yield* Effect.promise(() => fs.readFile(path.join(c.directory, FILE), "utf8"))
          expect(file).toBe(F17_FINAL)
        }),
      ),
    )
  })
})
