import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Environment } from "@opencode/core/environment/index"
import { Location } from "@opencode/core/location"
import { FileAccess } from "@opencode/core/file-access"
import { Permission } from "@opencode/core/permission"
import { Ripgrep } from "@opencode/core/ripgrep"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { GrepTool } from "@opencode/core/tool/plugin/grep"
import { description } from "@opencode/core/tool/plugin/grep-voice"
import { Tool } from "@opencode/core/tool"
import { location } from "./fixture/location"
import { withTempDir } from "./fixture/tmpdir"
import { it } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolDefinitions, toolIdentity } from "./lib/tool"

const grepToolNode = makeLocationNode({
  name: "test/grep-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(GrepTool.Plugin)),
  deps: [Tool.node, Environment.node, Ripgrep.node, Location.node, FileAccess.node, Permission.node],
})
const sessionID = Session.ID.make("ses_grep_tool_test")

const withGrepTool = <A, E, R>(directory: string, body: (registry: Tool.Interface) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const registry = yield* Tool.Service
    return yield* body(registry)
  }).pipe(
    Effect.provide(
      AppNodeBuilder.build(LayerNode.group([Tool.node, grepToolNode]), [
        Location.node.replace(
          Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make(directory) }))),
        ),
        Permission.node.replace(permissionLayer({ assert: () => Effect.void })),
      ]),
    ),
  )

describe("GrepTool", () => {
  it.live("renders an indented preview as the grep prefix plus the line's exact bytes", () =>
    withTempDir((tmp) =>
      Effect.gen(function* () {
        const file = path.join(tmp.path, "indented.txt")
        const matched = "   needle in an indented line"
        yield* Effect.promise(() => fs.writeFile(file, `header\n${matched}\n`))

        const result = yield* withGrepTool(tmp.path, (registry) =>
          executeTool(registry, {
            sessionID,
            ...toolIdentity,
            call: { type: "tool-call", id: "call-grep-indented", name: "grep", input: { pattern: "needle" } },
          }),
        )
        expect(result.status).toBe("completed")
        if (result.status !== "completed") return
        expect(result.metadata).toEqual({ matches: 1, truncated: false })
        expect(result.content).toEqual([{ type: "text", text: `Found 1 matches\n${file}:\n  Line 2:|${matched}` }])
        const content = result.content?.[0]
        const preview = content?.type === "text" ? (content.text.split("\n")[2] ?? "") : ""
        expect(preview).toBe(`  Line 2:|${matched}`)
        expect(preview.split("|", 2)[1]).toBe(matched)
      }),
    ),
  )

  it.live("pins the registered description to the grep voice", () =>
    withGrepTool(process.cwd(), (registry) =>
      Effect.gen(function* () {
        const definition = (yield* toolDefinitions(registry)).find((tool) => tool.name === "grep")
        expect(definition?.description).toBe(description)
      }),
    ),
  )
})
