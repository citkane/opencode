/**
 * Model-facing exact-edit leaf. Relative paths resolve within the active
 * Location. Absolute paths inside that Location are accepted, while explicit
 * absolute external paths retain mutation capability through a separate
 * external_directory approval before edit approval.
 */
export * as EditTool from "./edit.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { FileDiff } from "@opencode/schema/file-diff"
import { Effect, Schema } from "effect"
import { LinePrefix, notFound, unableTo } from "../voices.js"
import { toolFailure } from "../runtime.js"
import { Environment } from "../../environment/index.js"
import { FileMutation } from "../../file-mutation.js"
import { Location } from "../../location.js"
import { FileAccess } from "../../file-access.js"
import { FileWrite } from "../../file-write.js"
import { Permission } from "../../permission.js"
import {
  alreadyApplied,
  ambiguity,
  closestLines,
  description,
  directoryNotFile,
  edited,
  emptyOldString,
  identicalNoOp,
  newStringDescription,
  noMatch,
  noOp,
  oldStringDescription,
  pathDescription,
  replaceAllDescription,
} from "./edit-voice.js"
import { fileDiff } from "./file-diff.js"

export const name = "edit"

export const Input = Schema.Struct({
  path: Schema.String.annotate({ description: pathDescription }),
  oldString: Schema.String.annotate({ description: oldStringDescription }),
  newString: Schema.String.annotate({ description: newStringDescription }),
  replaceAll: Schema.optionalKey(Schema.Boolean).annotate({ description: replaceAllDescription }),
})

export const Output = Schema.Struct({
  files: Schema.Array(FileDiff.Info),
  replacements: Schema.Number,
})
export type Output = typeof Output.Type

const crlf = "\r\n"

interface Match {
  readonly start: number
  readonly end: number
}

const normalizeForMatch = (value: string) =>
  value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ")

const findOccurrences = (content: string, search: string) => {
  const result: Match[] = []
  let offset = 0
  while ((offset = content.indexOf(search, offset)) !== -1) {
    result.push({ start: offset, end: offset + search.length })
    offset += search.length
  }
  return result
}

const canonLine = (line: string) => normalizeForMatch(line).replace(/[ \t]+/g, " ").trim()

/** One line's canonical form and, for each canonical character, its offset in the line. */
const canonize = (line: string) => {
  const normalized = normalizeForMatch(line)
  let text = ""
  const spans: number[] = []
  let index = 0
  while (index < normalized.length) {
    const char = normalized[index]
    if (char === " " || char === "\t") {
      const run = index
      while (index < normalized.length && (normalized[index] === " " || normalized[index] === "\t")) index++
      if (text !== "") {
        text += " "
        spans.push(run)
      }
    } else {
      text += char
      spans.push(index++)
    }
  }
  // Trailing whitespace is not canonical (canonLine trims both ends).
  while (text.endsWith(" ")) {
    text = text.slice(0, -1)
    spans.pop()
  }
  return { text, spans }
}

/** Canonical form of the LF view. Newlines are canonical characters (structure); spans holds the LF-view
 * offset of every canonical character, so a canonical match maps back through spans[start] … spans[end-1] + 1. */
const canon = (view: string) => {
  let text = ""
  const spans: number[] = []
  let offset = 0
  for (const line of view.split("\n")) {
    const { text: lineText, spans: lineSpans } = canonize(line)
    if (text !== "") {
      text += "\n"
      spans.push(offset - 1)
    }
    text += lineText
    for (const span of lineSpans) spans.push(span + offset)
    offset += line.length + 1
  }
  return { text, spans: Uint32Array.from(spans) }
}

/** The dominant line ending in text, or fallback when there is none. */
const lineEnding = (text: string, fallback: string) => {
  const crlfCount = text.split(crlf).length - 1
  const lfCount = text.split("\n").length - 1 - crlfCount
  if (crlfCount === lfCount) return fallback
  return crlfCount > lfCount ? crlf : "\n"
}

/**
 * Joins the replacement's lines with line endings taken from the matched source region. A replacement line that
 * keeps a region line (longest common subsequence, keyed canonically like the matcher) reuses that line's ending;
 * a line that changes in place reuses the ending of the line it replaces; only lines beyond those take `fallback`.
 * Unchanged context inside a match therefore keeps its bytes even in a mixed-ending file.
 */
const withRegionEndings = (region: string, replacement: string, fallback: string) => {
  const before = region.split(/\r?\n/)
  const endings = [...region.matchAll(/\r?\n/g)].map((match) => match[0])
  const after = replacement.split("\n")
  const source = alignLines(before.map(canonLine), after.map(canonLine))
  return after.map((line, index) => (index === after.length - 1 ? line : line + (endings[source[index]!] ?? fallback))).join("")
}

/**
 * The canonical tier's splice: the file's whitespace stands at every content boundary, so a mapped line takes the
 * region line's leading and trailing whitespace around the model's content; only where the region starts or ends
 * inside a line's content do the model's own boundary whitespace splice in. Endings are assigned as in
 * withRegionEndings.
 */
const withCanonicalRegion = (
  region: string,
  replacement: string,
  fallback: string,
  view: string,
  start: number,
  end: number,
) => {
  const before = region.split(/\r?\n/)
  const endings = [...region.matchAll(/\r?\n/g)].map((match) => match[0])
  const after = replacement.split("\n")
  const source = alignLines(before.map(canonLine), after.map(canonLine))
  const leftMid = start > 0 && /\S/.test(view[start - 1])
  const rightMid = end < view.length && /\S/.test(view[end])
  const splice = (line: string, index: number) => {
    const mapped = source[index]
    if (mapped === undefined) return line
    const lead = (mapped === 0 && leftMid ? line : before[mapped]).match(/^[ \t]*/)![0]
    const trail = (mapped === before.length - 1 && rightMid ? line : before[mapped]).match(/[ \t]*$/)![0]
    const mLead = line.match(/^[ \t]*/)![0]
    const mTrail = line.match(/[ \t]*$/)![0]
    return lead + line.slice(mLead.length, line.length - mTrail.length) + trail
  }
  return after
    .map((line, index) => {
      const content = splice(line, index)
      return index === after.length - 1 ? content : content + (endings[source[index]!] ?? fallback)
    })
    .join("")
}

/**
 * For each line of `after`, the index of the `before` line it keeps (longest common subsequence) or, between kept
 * lines, the line it takes the place of; undefined for lines with no counterpart.
 */
const alignLines = (before: string[], after: string[]) => {
  const width = after.length + 1
  const table = new Uint32Array((before.length + 1) * width)
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
  const result: (number | undefined)[] = []
  const gap = { before: [] as number[], after: [] as number[] }
  const flush = () => {
    gap.after.forEach((j, k) => (result[j] = gap.before[k]))
    gap.before = []
    gap.after = []
  }
  let i = 0
  let j = 0
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      flush()
      result[j++] = i++
      continue
    }
    if (table[(i + 1) * width + j] >= table[i * width + j + 1]) gap.before.push(i++)
    else gap.after.push(j++)
  }
  while (i < before.length) gap.before.push(i++)
  while (j < after.length) gap.after.push(j++)
  flush()
  return result
}

/**
 * Matches against the LF view Read shows the model, then maps offsets back to the source, so CRLF and mixed line
 * endings neither block matches nor leak into untouched regions.
 */
const matchView = (source: string, oldString: string, newString: string, replaceAll: boolean) => {
  const view = source.replaceAll(crlf, "\n")
  const removed = [...source.matchAll(/\r\n/g)].map((match, index) => match.index - index)
  const fileEnding = lineEnding(source, "\n")
  const search = oldString.replaceAll(crlf, "\n")
  const replacement = newString.replaceAll(crlf, "\n")
  const exact = findOccurrences(view, search)
  // The canonical tier is a superset of the exact tier (whitespace-variant twins included). An empty
  // canonical form (whitespace-only oldString) never matches — findOccurrences would spin on an empty needle.
  let canonical: Match[] = []
  if (exact.length === 0 || replaceAll) {
    const fileCanon = canon(view)
    const needle = canon(search).text
    if (needle !== "")
      canonical = findOccurrences(fileCanon.text, needle).map((match) => ({
        start: fileCanon.spans[match.start],
        end: fileCanon.spans[match.end - 1] + 1,
      }))
  }
  // execute selects the canonical set when replaceAll is requested or no exact match exists — the same rule here
  // picks the tier each selected match is spliced with.
  const canonicalTier = replaceAll || exact.length === 0
  return {
    exact: exact.map((match) => ({
      start: match.start + countBefore(removed, match.start),
      end: match.end + countBefore(removed, match.end),
    })),
    canonical: canonical.map((match) => ({
      start: match.start + countBefore(removed, match.start),
      end: match.end + countBefore(removed, match.end),
    })),
    replace: (match: Match) => {
      const region = source.slice(match.start, match.end)
      if (!canonicalTier) return withRegionEndings(region, replacement, lineEnding(region, fileEnding))
      return withCanonicalRegion(
        region,
        replacement,
        lineEnding(region, fileEnding),
        view,
        match.start - countBefore(removed, match.start),
        match.end - countBefore(removed, match.end),
      )
    },
  }
}

const hintLines = 12
const hintLineLength = 200

/**
 * A short hint for an oldString miss, so the next attempt can succeed without rereading the file: newString is
 * already there (often an edit that already applied), or the lines closest to oldString, numbered like Read output.
 * Lines vote for where oldString starts when they match ignoring all whitespace; at least half must agree. Only the
 * span from the first to the last line that matched is shown, so padding oldString cannot reveal the lines after it.
 */
const missHint = (source: string, oldString: string, newString: string) => {
  const view = source.replaceAll(crlf, "\n")
  const replacement = newString.replaceAll(crlf, "\n")
  if (replacement.trim().length >= 20 && normalizeForMatch(view).includes(normalizeForMatch(replacement)))
    return alreadyApplied
  const key = canonLine
  const distinct = (line: string) => /[\p{L}\p{N}]/u.test(line)
  const lines = view.split("\n")
  const search = oldString.replaceAll(crlf, "\n").split("\n")
  const positions = new Map<string, number[]>()
  lines.forEach((line, index) => {
    const value = key(line)
    if (!distinct(value)) return
    const found = positions.get(value)
    if (found) found.push(index)
    else positions.set(value, [index])
  })
  const votes = new Map<number, number>()
  const wanted = search.filter((line, offset) => {
    const value = key(line)
    if (!distinct(value)) return false
    for (const index of positions.get(value) ?? []) votes.set(index - offset, (votes.get(index - offset) ?? 0) + 1)
    return true
  }).length
  const [start, count] = [...votes].reduce((best, vote) => (vote[1] > best[1] ? vote : best), [0, 0])
  if (count === 0 || count * 2 < wanted) return
  const matched = search.flatMap((line, offset) => {
    const value = key(line)
    const index = start + offset
    return value !== "" && index >= 0 && index < lines.length && key(lines[index]) === value ? [index] : []
  })
  const from = matched[0]
  const to = Math.min(matched.at(-1)! + 1, from + hintLines)
  return [
    closestLines,
    ...lines
      .slice(from, to)
      .map(
        (line, index) =>
          `${LinePrefix.render(from + index + 1)}${line.length > hintLineLength ? `${line.slice(0, hintLineLength)}…` : line}`,
      ),
  ].join("\n")
}

/** Number of sorted positions strictly before offset. */
const countBefore = (positions: number[], offset: number) => {
  let low = 0
  let high = positions.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (positions[middle] < offset) low = middle + 1
    else high = middle
  }
  return low
}

/** Deferred edit behavior and UX integrations remain visible at the model-facing seam. */
// TODO: Publish watcher/file-edit events after watcher integration exists.
// TODO: Add snapshots / undo after design exists.
// TODO: Add LSP notification and diagnostics after LSP runtime exists.

export const Plugin = {
  id: "opencode.tool.edit",
  effect: Effect.fn("EditTool.Plugin")(function* (ctx: Context) {
    const fileMutation = yield* FileMutation.Service
    const fileWrite = yield* FileWrite.Service
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          options: { codemode: false, permission: "edit" },
          description,
          input: Input,
          output: Output,
          execute: (input, context) => {
            return Effect.gen(function* () {
              if (input.oldString === input.newString) {
                return yield* new ToolFailure({
                  message: identicalNoOp,
                })
              }
              if (input.oldString === "") {
                return yield* new ToolFailure({
                  message: emptyOldString,
                })
              }

              const target = yield* fileWrite.target(input.path, context)

              const original = yield* FileMutation.readText(environment.files, target.absolute).pipe(
                Effect.catchTag("Environment.NotFound", () =>
                  Effect.fail(new ToolFailure({ message: notFound("File", input.path) })),
                ),
                Effect.catchTag("Environment.WrongKind", (error) =>
                  error.actual === "directory"
                    ? Effect.fail(new ToolFailure({ message: directoryNotFile(input.path) }))
                    : Effect.fail(new ToolFailure({ message: unableTo("edit", input.path), error })),
                ),
              )
              const source = original.text
              // Legacy path, preserved for model input that still carries the byte: pairs differing only in
              // `\r` were once the advertised way to change line endings. The model-facing voice no longer
              // names it (content + `\n` only) — this conditional is not discoverable from the voice and
              // exists so such input (a slip, a model trained on a prior description) keeps working. It
              // applies `newString` to the exact bytes, bypassing both tiers.
              const endingsOnly = input.oldString.replaceAll("\r", "") === input.newString.replaceAll("\r", "")
              const raw = endingsOnly ? findOccurrences(source, input.oldString) : []
              const { exact, canonical, replace } = endingsOnly
                ? { exact: raw, canonical: raw, replace: () => input.newString }
                : matchView(source, input.oldString, input.newString, input.replaceAll === true)
              const selected = input.replaceAll === true ? canonical : exact.length > 0 ? exact : canonical
              const replacements = selected.length
              const replaced = (input.replaceAll === true ? selected : selected.slice(0, 1))
                .toReversed()
                .reduce(
                  (content, match) => `${content.slice(0, match.start)}${replace(match)}${content.slice(match.end)}`,
                  source,
                )
              const preview =
                replacements > 0 && (replacements === 1 || input.replaceAll === true)
                  ? fileDiff(target.resource, source, replaced)
                  : undefined
              yield* fileWrite.authorize(target, context, preview)
              if (replacements === 0) {
                // The hint shows file contents, so only when reading this file is already allowed.
                const readable = yield* permission.allows({
                  action: "read",
                  resources: [target.resource],
                  save: ["*"],
                  ...Permission.invocation(context),
                })
                const hint = readable ? missHint(source, input.oldString, input.newString) : undefined
                return yield* new ToolFailure({
                  message: noMatch(input.path, hint),
                })
              }
              if (replacements > 1 && input.replaceAll !== true) {
                return yield* new ToolFailure({
                  message: ambiguity(replacements),
                })
              }
              if (replaced === source) {
                return yield* new ToolFailure({
                  message: noOp(input.path, endingsOnly),
                })
              }
              const result = yield* fileWrite.commit(target, replaced)
              const formatted =
                result.formatted ?? (yield* FileMutation.readText(environment.files, target.absolute)).text
              return {
                files: [fileDiff(result.resource, source, formatted)],
                replacements,
              } satisfies Output
            }).pipe(
              fileMutation.withLock([FileAccess.resolvePath(location.directory, input.path)]),
              Effect.map((output) => ({
                output,
                content: edited(output.files[0]?.file, output.replacements),
                metadata: { files: output.files },
              })),
              Effect.mapError(toolFailure(unableTo("edit", input.path))),
            )
          },
        }),
      )
      .pipe(Effect.orDie)
  }),
}
