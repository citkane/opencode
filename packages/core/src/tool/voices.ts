// Cross-tool model-content serialization voices (the toModelContent seam).
// Pure strings, no deps.
const DELIMITER = "|"

export const LinePrefix = {
  /** Prefix for one line, delimiter included: "NNN:|" */
  render: (n: number): string => `${n}:${DELIMITER}`,
  /** The invariant decode rule — derived from DELIMITER so it cannot drift from render. */
  decodeRule:
    `Line numbers are rendered as "NNN:${DELIMITER}". ` +
    `When you copy a line, strip everything up to and including the first "${DELIMITER}"; ` +
    `the text after it is the file's exact content, including any leading spaces or tabs.`,
}

export const GrepLine = {
  /** Grep preview line, delimiter included: "  Line N:|" */
  render: (n: number): string => `  Line ${n}:${DELIMITER}`,
  /** The same "strip through the first |" rule — derived from DELIMITER. */
  decodeRule:
    `Grep matches are rendered as "  Line NNN:${DELIMITER}". ` +
    `When you copy a line, strip everything up to and including the first "${DELIMITER}"; ` +
    `the text after it is the file's exact content, including any leading spaces or tabs.`,
}

// Message frames for standard events — the frame is the voice; the
// tool-specific parts are slots.
export const notFound = (subject: string, target: string) => `${subject} not found: ${target}`
export const unableTo = (action: string, target: string, postfix?: string) =>
  `Unable to ${action} ${target}${postfix ? `: ${postfix}` : ""}`

// Executable inverse of both prefix classes: the file-content bytes after the first
// DELIMITER, signalling absence when the delimiter is not present.
export const decode = (line: string): string | undefined => {
  const at = line.indexOf(DELIMITER)
  return at === -1 ? undefined : line.slice(at + DELIMITER.length)
}
