// The read tool's model-facing voice; read.ts makes it true.
import { LinePrefix } from "../voices.js"
import type { LineEndings } from "../read-filesystem.js"

export const description =
  "Read the contents of a file or directory. Supports text files, images, and PDFs. Images and PDFs are presented directly to the model. " +
  "Each text line is prefixed by its 1-based line number for reference; the prefix is not part of the file content. " +
  "Paged reads of a file render their lines identically to a whole read. " +
  LinePrefix.decodeRule + " " +
  "Line endings are not content: rendered lines carry no line-ending byte, the header states the file's ending style (LF / CRLF / mixed), and the render ends with its last line — no trailing empty line. " +
  "A read that cannot show the file's end ends with a truncation marker naming the next offset. " +
  "Directory entries are returned one per line. Use offset and limit to read large files or directories in sections. Prefer one larger read over many small slices, and use grep to find specific content in large files."

export const pathDescription = "File or directory to read"
export const offsetDescription = "The line or directory entry to start reading from (1-based)"
export const limitDescription = (cap: number) =>
  `The maximum number of lines or directory entries to read (defaults to and capped at ${cap})`

export const missingFolder = (folder: string, parent: string) =>
  `The folder ${folder} does not exist. The nearest folder that does is ${parent}.`
export const suggestions = (list: readonly string[]) => `Did you mean one of these?\n${list.join("\n")}`

export const binaryFileMessage = (resource: string) => `Cannot read binary file: ${resource}`
export const mediaIngestLimitMessage = (resource: string, maximumBytes: number) =>
  `Media exceeds ${maximumBytes} byte ingestion limit: ${resource}`
export const offsetOutOfRangeMessage = (offset: number, lines: number) =>
  `Offset ${offset} is out of range for this file (${lines} ${lines === 1 ? "line" : "lines"})`
export const pathKindMessage = (resource: string, expected: string) => `Path is not ${expected}: ${resource}`

export const fileHeader = (path: string, start: number, count: number, endings?: LineEndings) =>
  count === 0
    ? `Read file ${path}, 0 lines`
    : `Read file ${path}, lines ${start}-${start + count - 1}${endingsClause(endings)}`
export const directoryHeader = (path: string, start: number, count: number) =>
  count === 0
    ? `Read directory ${path}, 0 entries`
    : `Read directory ${path}, entries ${start}-${start + count - 1}`
export const truncationMarker = (next: number) => `[Output truncated. Continue reading with offset: ${next}]`

const endingsClause = (endings: LineEndings | undefined) =>
  endings === undefined ? "" : ` (${endings === "mixed" ? "mixed" : endings.toUpperCase()} line endings)`
