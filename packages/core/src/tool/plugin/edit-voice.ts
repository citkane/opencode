// The edit tool's model-facing voice: stated once here; edit.ts makes it
// true. The spec-table tests pin this wording to the behaviour.
import { LinePrefix } from "../voices.js"

const MATCH_CONTRACT =
  "oldString must match the file's content and blank-line structure; whitespace shape — indentation, tabs vs. spaces, internal runs, trailing — does not need to match, and on a tolerant match the file's own indentation, trailing whitespace, and line endings are preserved."

const ENDINGS_CONTRACT =
  "Line endings follow the file — a line the edit replaces keeps its own ending, and a line it inserts takes the dominant ending of the region the match spans — the file's dominant ending when the region is even."

const UNAMBIGUITY =
  "Add more surrounding context to make oldString unique, or set replaceAll to true to replace every occurrence."

// The tool description: composed of single-owned pieces — the prefix sentence
// is owned by the "Prefix (read side)" section; the rest by this file.
export const description =
  "Edit the contents of a file by finding and replacing text. " +
  "When editing text from Read output, preserve the exact indentation (tabs or spaces) and omit the line-number prefix — it identifies the line for reference. Never include the prefix in oldString or newString. " +
  LinePrefix.decodeRule + " " +
  `Write line breaks as \\n; ${ENDINGS_CONTRACT} ` +
  `${MATCH_CONTRACT} ` +
  "The edit fails if oldString is not found. " +
  "By default, oldString must identify a UNIQUE location. Multiple matches FAIL unless replaceAll is true. " +
  `${UNAMBIGUITY} ` +
  "Use replaceAll when the change should apply to every occurrence, such as renaming a variable."

export const noMatch = (path: string, hint?: string) =>
  `Could not find oldString in ${path}. ${MATCH_CONTRACT}${hint ? `\n\n${hint}` : ""}`

export const ambiguity = (count: number) =>
  `Found ${count} matches for oldString, but expected exactly one. ${UNAMBIGUITY}`

export const noOp = (path: string, endingsOnly: boolean) =>
  endingsOnly
    ? `No changes to apply: ${path} already has those line endings.`
    : `No changes to apply: the edit leaves ${path} unchanged.`

export const pathDescription = "File to edit"
export const oldStringDescription = "Text to find in the file"
export const newStringDescription = "Text to replace oldString with (must differ from oldString)"
export const replaceAllDescription =
  "Whether to replace every occurrence of oldString. When false, oldString must occur exactly once. Defaults to false."

export const identicalNoOp = "No changes to apply: oldString and newString are identical."
export const emptyOldString = "oldString must not be empty. Use write to create or overwrite a file."
export const directoryNotFile = (path: string) => `Path is a directory, not a file: ${path}`
export const edited = (file: string, count: number) => `Edited ${file} (${count} replacement${count === 1 ? "" : "s"})`
export const alreadyApplied = "newString is already in the file, so this edit may already be applied."
export const closestLines = "The closest lines in the file:"
