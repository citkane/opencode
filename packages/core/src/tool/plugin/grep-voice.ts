// The grep tool's model-facing voice; grep.ts makes it true.
import { GrepLine } from "../voices.js"

export const description =
  "Search file contents using ripgrep's regular expression syntax or literal text matching. Use it to locate specific code, symbols, or text patterns, and narrow searches with `path` or `include`. Returns matching file paths, line numbers, and line previews. " +
  "Previews carry the line's exact content, no line-ending byte; the render is the count line, the path header, and the previews — no blank lines, no trailing empty line; truncation note when results are truncated. " +
  GrepLine.decodeRule

export const noMatches = "No matches found"
export const foundMatches = (count: number) => `Found ${count} matches`
export const pathHeader = (path: string) => `${path}:`
export const truncationNote = (count: number) =>
  `(Results are truncated: showing first ${count} results. Consider using a more specific path or pattern.)`
