import type { LLMRequest, ToolResultValue } from "@opencode/ai/effect"
import { decode, LinePrefix, notFound } from "@opencode/core/tool/voices"
import { alreadyApplied, ambiguity, closestLines, emptyOldString, noMatch } from "@opencode/core/tool/plugin/edit-voice"
import { fileHeader, suggestions, truncationMarker } from "@opencode/core/tool/plugin/read-voice"

export const FILE = "file.txt"

export const toolResult = (request: LLMRequest | undefined, name: string) =>
  request?.messages.flatMap((message) =>
    message.content.flatMap((part) => (part.type === "tool-result" && part.name === name ? [part.result] : [])),
  )?.at(-1)

export const toolText = (result: ToolResultValue | undefined): string =>
  result?.type === "text" && typeof result.value === "string" ? result.value : ""

export const toolErrorText = (result: ToolResultValue | undefined): string => {
  if (result?.type !== "error") return ""
  const error = (result.value as { error?: { message?: string } }).error
  return error?.message ?? ""
}

export const decodeRendered = (text: string, numbers: number[]) =>
  numbers.map((n) => {
    const line = text.split("\n").find((l) => l.startsWith(LinePrefix.render(n)))
    if (line === undefined) throw new Error(`Rendered line ${n} missing`)
    const d = decode(line)
    if (d === undefined) throw new Error(`Rendered line ${n} carries no delimiter`)
    return d
  })

export const lastToolPart = (request: LLMRequest | undefined) =>
  request?.messages
    .flatMap((message) => message.content.flatMap((part) => (part.type === "tool-result" ? [part] : [])))
    .at(-1)

export const F1_F8_LINES = [
  "context",
  "    target line  ",
  "\ttabbed line",
  "trailing  ",
  "a  b  c",
  "span first  ",
  "    span second",
  "    reindented",
  "pipe | in content",
]
export const F1_F8_CONTENT = F1_F8_LINES.join("\r\n") + "\r\n"
export const F1_F8_OLD = [
  "context",
  "      target line  ",
  "  tabbed line",
  "trailing   ",
  "a b c",
  "span first\n      span second",
  "    reindented",
  "pipe | in content",
]
export const F1_F8_NEW = [
  "context, done",
  "target, done",
  "tabbed, done",
  "trailing, done",
  "A B C",
  "span first, done\nspan second, done",
  "        reindented, wider",
  "pipe | content, done",
]
export const F1_F8_FINAL = [
  "context, done",
  "    target, done  ",
  "\ttabbed, done",
  "trailing, done  ",
  "A B C",
  "span first, done  ",
  "    span second, done",
  "        reindented, wider",
  "pipe | content, done",
].join("\r\n") + "\r\n"
export const F1_F8_DRIFTS = [
  (d: string[]) => d[0],
  (d: string[]) => d[1].replace(/^ {4}/, "      "),
  (d: string[]) => d[2].replace(/^\t/, "  "),
  (d: string[]) => d[3] + " ",
  (d: string[]) => d[4].replace(/  /g, " "),
  (d: string[]) => d[5].replace(/ +$/, "") + "\n" + d[6].replace(/^ {4}/, "      "),
  (d: string[]) => d[7],
  (d: string[]) => d[8],
]

export const F1_D1 = `${notFound("File", "file.txt.bak")}\n\n${suggestions([FILE])}`

export const F2_LINES = [
  "    alpha",
  "alpha",
  "x a  b y",
  "  gamma",
  "    gamma",
]
export const F2_CONTENT = F2_LINES.join("\r\n") + "\r\n"
export const F2_OLD = [
  "    alpha",
  "a b",
  "     gamma",
  "     gamma",
]
export const F2_NEW = [
  "alpha, done",
  "A B",
  "gamma, done",
  "gamma, done",
]
export const F2_FINAL = [
  "alpha, done",
  "alpha",
  "x A B y",
  "  gamma, done",
  "    gamma, done",
].join("\r\n") + "\r\n"
export const F2_DRIFTS = [
  (d: string[]) => d[0],
  (d: string[]) => d[2].slice(2, -2).replace(/  /g, " "),
  (d: string[]) => d[3].replace(/^ {2}/, "     "),
  (d: string[]) => d[3].replace(/^ {2}/, "     "),
]

export const F3_LINES = [
  "const alpha = 1",
  "const beta = 2",
  "const gamma = 3",
  "const delta = 4",
  "const epsilon = 5",
  "const zeta = 6",
]
export const F3_CONTENT = F3_LINES.join("\r\n") + "\r\n"
export const F3_STATES = [
  F3_LINES,
  ["const alpha = 10", "const beta = 2", "const gamma = 3", "const delta = 4", "const epsilon = 5", "const zeta = 6"],
  ["const alpha = 10", "const beta = 20", "const gamma = 30", "const delta = 40", "const epsilon = 5", "const zeta = 6"],
  ["const alpha = 10", "const beta = 20", "const gamma = 30", "const delta = 40", "const epsilon = 55", "const zeta = 6"],
  ["const alpha = 10", "const beta = 20", "const gamma = 30", "const delta = 40", "const epsilon = 55", "const zeta = 60"],
]
export const F3_STATE_FOR = [0, 0, 1, 1, 2, 2, 3, 4]
export const F3_FINAL = F3_STATES[4].join("\r\n") + "\r\n"
export const F3_REREAD = F3_STATES[2]
export const F3_OLD = [
  LinePrefix.render(1) + "const alpha = 1",
  "const alpha = 1",
  "const beta = 2\nconst gamna = 3\nconst delta = 4",
  "const beta = 2\nconst gamma = 3\nconst delta = 4",
  "  ",
  "const epsilon = 5",
  "const zeta = 6",
  "const beta = 2\nconst gamma = 3\nconst delta = 4",
]
export const F3_NEW = [
  "const alpha = 10",
  "const alpha = 10",
  "const beta = 20\nconst gamma = 30\nconst delta = 40",
  "const beta = 20\nconst gamma = 30\nconst delta = 40",
  "const epsilon = 55",
  "const epsilon = 55",
  "const zeta = 60",
  "const beta = 20\nconst gamma = 30\nconst delta = 40",
]
export const F3_F4_MISS = noMatch(FILE)
export const F3_HINT = noMatch(
  FILE,
  `${closestLines}\n${LinePrefix.render(2)}const beta = 2\n${LinePrefix.render(3)}const gamma = 3\n${LinePrefix.render(4)}const delta = 4`,
)
export const F3_ALREADY = noMatch(FILE, alreadyApplied)
export const F3_B7_TEXT = "The file already contains the replacement lines, so the edit is already applied; no further changes."

export const F4_LINES = ["alpha", "  delta", "    delta", "", "omega", "", "beta"]
export const F4_CONTENT = F4_LINES.join("\r\n") + "\r\n"
export const F4_DRIFTS = [
  (d: string[]) => d[1].replace(/^ {2}/, "     "),
  (d: string[]) => `${d[0]}\n${d[1].replace(/^ {2}/, "     ")}`,
  (d: string[]) => `${d[4]}\n\n\n${d[6]}`,
]
export const F4_OLD = ["     delta", "alpha\n     delta", "omega\n\n\nbeta"]
export const F4_NEW = ["delta, done", "alpha\ndelta, done", "omega, done\n\n\nbeta, done"]
export const F4_STATES = [F4_LINES, ["alpha", "  delta, done", "    delta", "", "omega", "", "beta"]]
export const F4_STATE_FOR = [0, 0, 1]
export const F4_FINAL = F4_STATES[1].join("\r\n") + "\r\n"
export const F4_AMBIGUOUS = ambiguity(2)
export const F4_MISS = noMatch(FILE, `${closestLines}\n${LinePrefix.render(5)}omega`)
export const F4_B7_TEXT = "The file's blank-line structure differs from the span I tried to match, so I will not edit it without a fresh read."

export const F5_LINES = ["lead", "alpha", "mid one", "mid two", "mid three", "block a", "block b", "block c", "trail"]
const F5_ENDINGS = ["\r\n", "\r\n", "\n", "\r\n", "\r\n", "\n", "\n", "\n", "\r\n"]
export const F5_CONTENT = "\uFEFF" + F5_LINES.map((line, i) => line + F5_ENDINGS[i]).join("")
export const F5_OLD = ["lead\nalpha", "mid one\nmid two\nmid three", "MID ONE\nMID TWO\nmid three\nblock a\nblock b\nblock c"]
export const F5_NEW = [
  "lead done\nalpha",
  "mid one\nMID ONE\nMID TWO\nmid three",
  "MID ONE done\nMID TWO done\nmid three\nblock a\nblock b\nextra line\nblock c",
]
export const F5_STATES = [
  F5_LINES,
  ["lead done", "alpha", "mid one", "mid two", "mid three", "block a", "block b", "block c", "trail"],
  ["lead done", "alpha", "mid one", "MID ONE", "MID TWO", "mid three", "block a", "block b", "block c", "trail"],
  [
    "lead done",
    "alpha",
    "mid one",
    "MID ONE done",
    "MID TWO done",
    "mid three",
    "block a",
    "block b",
    "extra line",
    "block c",
    "trail",
  ],
]
export const F5_STATE_FOR = [0, 1, 2]
const F5_FINAL_LINES = F5_STATES[3]
const F5_FINAL_ENDINGS = ["\r\n", "\r\n", "\n", "\r\n", "\r\n", "\r\n", "\n", "\n", "\r\n", "\n", "\r\n"]
export const F5_FINAL = "\uFEFF" + F5_FINAL_LINES.map((line, i) => line + F5_FINAL_ENDINGS[i]).join("")
export const F5_DONE_TEXT =
  "The three edits landed across the BOM, CRLF, mixed, and LF-block regions with every line keeping its own ending, so the per-line endings are preserved."

export const F6_F11_LINES = ["boot started", "disk check ok", "network failed", "retry scheduled", "network up", "boot complete"]
export const F6_CONTENT = F6_F11_LINES.join("\r\n") + "\r\n"
export const F6_F11_OLD = "network failed"
export const F6_F11_NEW = "network recovered"
export const F6_F11_FINAL_LINES = ["boot started", "disk check ok", "network recovered", "retry scheduled", "network up", "boot complete"]
export const F6_FINAL = F6_F11_FINAL_LINES.join("\r\n") + "\r\n"
export const F6_PAGE_OFFSET = 2
export const F6_PAGE_LIMIT = 3
export const F6_WHOLE_HEADER = fileHeader(FILE, 1, 6, "crlf")
export const F6_PAGE_TEXT =
  `${fileHeader(FILE, F6_PAGE_OFFSET, F6_PAGE_LIMIT, "crlf")}\n` +
  `${LinePrefix.render(2)}disk check ok\n` +
  `${LinePrefix.render(3)}network recovered\n` +
  `${LinePrefix.render(4)}retry scheduled\n` +
  truncationMarker(F6_PAGE_OFFSET + F6_PAGE_LIMIT)
export const F6_DONE_TEXT =
  "The paged re-read shows the fix standing at line 3 with the region's other lines untouched, so the edit is verified."

const F7_LINES = ["first line", "    the answer is 42", "last line"]
export const F7_CONTENT = F7_LINES.join("\r\n") + "\r\n"
export const F7_PATTERN_MISS = "the answer is forty-two"
export const F7_PATTERN_MATCH = "the answer"
export const F7_DONE_TEXT = "The broadened pattern found the line, so the target is located."

export const F8_F11_PATTERN = "."

const F11_ENDINGS = ["\r\n", "\n", "\r\n", "\r\n", "\n", "\r\n"]
export const F11_CONTENT = F6_F11_LINES.map((line, i) => line + F11_ENDINGS[i]).join("")
export const F11_FINAL = F6_F11_FINAL_LINES.map((line, i) => line + F11_ENDINGS[i]).join("")
export const F11_WHOLE_HEADER = fileHeader(FILE, 1, 6, "mixed")
export const F11_DONE_TEXT =
  "The grep previews show the fix standing at line 3 with the other lines untouched, so the edit is verified."

export const F12_F13_F15_F18_F19_LINES = ["build config", "    mode: release", "\ttabbed flag", "", "trailing  "]
export const F12_F13_F15_CONTENT = F12_F13_F15_F18_F19_LINES.join("\r\n") + "\r\n"
export const F12_F13_WHOLE_HEADER = fileHeader(FILE, 1, 5, "crlf")
export const F13_WHOLE_TEXT =
  `${fileHeader(FILE, 1, 5, "crlf")}\n` +
  `${LinePrefix.render(1)}build config\n` +
  `${LinePrefix.render(2)}    mode: release\n` +
  `${LinePrefix.render(3)}\ttabbed flag\n` +
  `${LinePrefix.render(4)}\n` +
  `${LinePrefix.render(5)}trailing  `
export const F12_F18_DONE_TEXT =
  "The writes reproduced the file byte-for-byte on both faces — CRLF per the first read header, LF per the second — so the reconstruction stands."
export const F13_DONE_TEXT =
  "The whole read of the file I just wrote renders per the read voice, so the fresh bytes are confirmed."

export const F14_LINES = [
  "TODO ship the retry",
  "const max = 3",
  "  // TODO drop the flag",
  "return max",
  "TODO log the fallback",
  "export max",
]
export const F14_CONTENT = F14_LINES.join("\r\n") + "\r\n"
export const F14_PATTERN = "TODO"
export const F14_MATCHED = ["TODO ship the retry", "  // TODO drop the flag", "TODO log the fallback"]
export const F14_NEW_FILE = "matches.txt"
export const F14_NEW_CONTENT = F14_MATCHED.join("\n") + "\n"
export const F14_DONE_TEXT = "The write reproduced the matched previews verbatim in the new file, so the collection stands."

export const F15_F19_PATTERN = "^"
export const F15_F19_DONE_TEXT =
  "The grep previews of the file I just wrote are clean and terminator-free, so the fresh bytes are confirmed."

export const F17_LINES = ["app config", "mode: debug", "retries: 3", "verbose: false"]
export const F17_CONTENT = F17_LINES.join("\r\n") + "\r\n"
export const F17_NEW_LINE = "mode: release"
export const F17_B6 = emptyOldString
export const F17_WHOLE_HEADER = fileHeader(FILE, 1, 4, "crlf")
export const F17_FINAL = ["app config", "mode: release", "retries: 3", "verbose: false"].join("\r\n") + "\r\n"
export const F17_DONE_TEXT =
  "The edit told me to use write, so I read the file and rewrote it with the corrected mode — the final bytes are my content verbatim."

export const F18_F19_CONTENT = F12_F13_F15_F18_F19_LINES.join("\n") + "\n"
export const F18_WHOLE_HEADER = fileHeader(FILE, 1, 5, "lf")

