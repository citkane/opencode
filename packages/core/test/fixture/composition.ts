import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNodePlatform } from "@opencode/core/effect/app-node-platform"
import { Agent } from "@opencode/core/agent"
import { Bus } from "@opencode/core/bus"
import { Config } from "@opencode/core/config"
import { Database } from "@opencode/core/database/database"
import { Environment } from "@opencode/core/environment/index"
import { FileAccess } from "@opencode/core/file-access"
import { FileMutation } from "@opencode/core/file-mutation"
import { FileWrite } from "@opencode/core/file-write"
import { Form } from "@opencode/core/form"
import { InstructionBuiltIns } from "@opencode/core/instructions/builtins"
import { Instructions } from "@opencode/core/instructions/index"
import { InstructionDiscovery } from "@opencode/core/instruction-discovery"
import { Job } from "@opencode/core/job"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { McpInstructions } from "@opencode/core/mcp/instructions"
import { Model } from "@opencode/core/model"
import { Permission } from "@opencode/core/permission"
import { Plugin } from "@opencode/core/plugin"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { PluginSupervisor } from "@opencode/core/plugin/supervisor"
import { Project } from "@opencode/core/project"
import { ProjectTable } from "@opencode/core/project/sql"
import { ReferenceInstructions } from "@opencode/core/reference/instructions"
import { Ripgrep } from "@opencode/core/ripgrep"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { SessionCompaction } from "@opencode/core/session/compaction"
import { SessionExecution } from "@opencode/core/session/execution"
import { SessionInstructions } from "@opencode/core/session/instructions"
import { SessionInbox } from "@opencode/core/session/inbox"
import { SessionModelTransport } from "@opencode/core/session/model-transport"
import { SessionProjector } from "@opencode/core/session/projector"
import { SessionRunCoordinator } from "@opencode/core/session/run-coordinator"
import { SessionRunner } from "@opencode/core/session/runner/index"
import { SessionRunnerLLM } from "@opencode/core/session/runner/llm"
import { SessionRunnerModel } from "@opencode/core/session/runner/model"
import { SessionStore } from "@opencode/core/session/store"
import { SessionTable } from "@opencode/core/session/sql"
import { InstructionEntry } from "@opencode/core/session/instruction-entry"
import { Skill } from "@opencode/core/skill"
import { SkillInstructions } from "@opencode/core/skill/instructions"
import { Snapshot } from "@opencode/core/snapshot"
import { Tool } from "@opencode/core/tool"
import { EditTool } from "@opencode/core/tool/plugin/edit"
import { GrepTool } from "@opencode/core/tool/plugin/grep"
import { ReadTool } from "@opencode/core/tool/plugin/read"
import { WriteTool } from "@opencode/core/tool/plugin/write"
import { ReadToolFileSystem } from "@opencode/core/tool/read-filesystem"
import { LanguageModel } from "@opencode/ai/effect"
import { OpenAIChat } from "@opencode/ai/protocols/openai-chat"
import { TestLLM } from "@opencode/ai/testing"
import { ConfigCompaction } from "@opencode/schema/config/compaction"
import { Document, Info } from "@opencode/schema/config"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Context, Effect, Layer } from "effect"
import { permissionLayer } from "../lib/permission"
import { registerToolPlugin } from "../lib/tool"
import { promptLocationNode } from "./prompt-location"
import { tmpdirScoped } from "./tmpdir"

// Shared functional-tier harness: the real session loop over a real temp Location with
// the real read, grep, and edit tools registered, so a scripted model consumes the
// tools' actual rendered output instead of a hand-typed simulation of it.
class CompositionDir extends Context.Service<CompositionDir, string>()("test/CompositionDir") {}

const testLLM = TestLLM.testLayer({})

const buildLayer = (directory: string) => {
  const model = LanguageModel.make({ id: "composition-model", provider: "fake", route: OpenAIChat.route })
  const models = Layer.mock(SessionRunnerModel.Service, {
    resolve: () =>
      Effect.succeed(
        SessionRunnerModel.resolved(model, {
          capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
          cost: [],
          limit: { context: 200_000, output: 32_000 },
        }),
      ),
  })
  const promptModels = Layer.mock(Model.Service, {
    get: () => Effect.undefined,
    all: () => Effect.succeed([]),
    available: () => Effect.succeed([]),
    default: () => Effect.undefined,
    small: () => Effect.undefined,
  })
  const instructionBuiltIns = Layer.mock(InstructionBuiltIns.Service, { load: () => Effect.succeed(Instructions.empty) })
  const instructionDiscovery = Layer.mock(InstructionDiscovery.Service, {
    project: true,
    global: true,
    load: () => Effect.succeed(Instructions.empty),
  })
  const skillInstructions = Layer.mock(SkillInstructions.Service, { load: () => Effect.succeed(Instructions.empty) })
  const referenceInstructions = Layer.mock(ReferenceInstructions.Service, { load: () => Effect.succeed(Instructions.empty) })
  const mcpInstructions = Layer.mock(McpInstructions.Service, { load: () => Effect.succeed(Instructions.empty) })
  const config = Config.testLayer([
    new Document({
      type: "document",
      info: new Info({
        compaction: new ConfigCompaction.Info({
          buffer: 3_000,
          keep: new ConfigCompaction.Keep({ tokens: 1_000 }),
        }),
      }),
    }),
  ])
  const permission = permissionLayer({ assert: () => Effect.void, allows: () => Effect.succeed(true) })
  const modelTransport = Layer.succeed(
    SessionModelTransport.Service,
    SessionModelTransport.Service.of({
      bind: () => ({ execute: () => Effect.die("Unexpected WebSocket execution") }),
      close: () => Effect.void,
      closeAll: Effect.void,
    }),
  )
  const tools = Layer.effectDiscard(
    Effect.gen(function* () {
      yield* registerToolPlugin(ReadTool.Plugin)
      yield* registerToolPlugin(GrepTool.Plugin)
      yield* registerToolPlugin(EditTool.Plugin)
      yield* registerToolPlugin(WriteTool.Plugin)
    }),
  )
  const compositionTools = makeLocationNode({
    name: "test/composition-tools",
    layer: tools,
    deps: [
      Tool.node,
      ReadToolFileSystem.node,
      FileAccess.node,
      Permission.node,
      Skill.node,
      SessionInstructions.node,
      FSUtil.node,
      Location.node,
      Environment.node,
      Ripgrep.node,
      FileMutation.node,
      FileWrite.node,
    ],
  })
  const replacements: LayerNode.Replacements = [
    Snapshot.node.replace(Snapshot.noopLayer),
    LayerNodePlatform.llmClient.replace(testLLM),
    SessionRunnerModel.node.replace(models),
    InstructionBuiltIns.node.replace(instructionBuiltIns),
    InstructionDiscovery.node.replace(instructionDiscovery),
    Location.node.replace(Location.boundNode({ directory: AbsolutePath.make(directory) })),
    SkillInstructions.node.replace(skillInstructions),
    ReferenceInstructions.node.replace(referenceInstructions),
    Permission.node.replace(permission),
    Config.node.replace(config),
    PluginSupervisor.node.replace(Layer.empty),
    Plugin.node.replace(Layer.mock(Plugin.Service, { awaitActivation: Effect.void })),
    SessionModelTransport.node.replace(modelTransport),
  ]
  const runnerLayer = AppNodeBuilder.build(SessionRunnerLLM.node, [
    ...replacements,
    McpInstructions.node.replace(mcpInstructions),
  ])
  const execution = Layer.effect(
    SessionExecution.Service,
    Effect.gen(function* () {
      const sessionRunner = yield* SessionRunner.Service
      function drain(
        sessionID: Session.ID,
        force: boolean,
        continuation?: SessionRunner.Continuation,
      ): Effect.Effect<void, SessionRunner.RunError> {
        return sessionRunner
          .drain({ sessionID, force, continuation })
          .pipe(
            Effect.flatMap((result) =>
              result._tag === "Complete" ? Effect.void : drain(sessionID, false, result.continuation),
            ),
          )
      }
      const coordinator = yield* SessionRunCoordinator.make<Session.ID, SessionRunner.RunError>({
        drain: (sessionID, force) => drain(sessionID, force),
      })
      return SessionExecution.Service.of({
        active: coordinator.active,
        isActive: coordinator.isActive,
        resume: coordinator.run,
        wake: coordinator.wake,
        interrupt: (sessionID) => coordinator.interrupt(sessionID),
        awaitIdle: coordinator.awaitIdle,
      })
    }),
  ).pipe(Layer.provide(runnerLayer), Layer.orDie)
  return AppNodeBuilder.build(
    LayerNode.group([
      Database.node,
      Bus.node,
      Form.node,
      SessionProjector.node,
      SessionStore.node,
      SessionInbox.node,
      Agent.node,
      Model.node,
      Tool.node,
      PluginHooks.node,
      Job.node,
      compositionTools,
      SessionRunnerModel.node,
      InstructionBuiltIns.node,
      InstructionDiscovery.node,
      InstructionEntry.node,
      SkillInstructions.node,
      ReferenceInstructions.node,
      Config.node,
      Snapshot.node,
      SessionCompaction.node,
      LayerNodePlatform.llmClient,
      SessionRunnerLLM.node,
      SessionExecution.node,
      Session.node,
    ]),
    [
      ...replacements,
      Bus.node.replace(Bus.configured({ persist: true })),
      LocationServiceMap.node.replace(promptLocationNode),
      Model.node.replace(promptModels),
      SessionExecution.node.replace(execution),
    ],
  )
}

// Not memoized: each test run acquires a fresh tmpdir scope and session behind this layer — a
// memoize here would silently share the temp dir and session across tests in a file.
const layer = Layer.unwrap(
  tmpdirScoped().pipe(
    Effect.map((tmp) => buildLayer(tmp.path).pipe(Layer.merge(Layer.succeed(CompositionDir, tmp.path)))),
  ),
).pipe(Layer.provideMerge(testLLM))

const sessionID = Session.ID.make("ses_composition")

const setup = Effect.gen(function* () {
  const directory = yield* CompositionDir
  const { db } = yield* Database.Service
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make(directory), sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id: sessionID,
      project_id: Project.ID.global,
      slug: sessionID,
      directory,
      title: "test",
      version: "test",
    })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  const agents = yield* Agent.Service
  const session = yield* Session.Service
  const llm = yield* TestLLM.Test
  yield* agents.transform((editor) => {
    editor.update(Agent.ID.make("build"), (agent) => {
      agent.mode = "primary"
    })
  })
  const admit = (text: string) => session.prompt({ sessionID, text, resume: false })
  const resume = session.resume(sessionID)
  return {
    directory,
    sessionID,
    session,
    llm,
    admit,
    resume,
    runPrompt: Effect.fnUntraced(function* (text: string) {
      yield* admit(text)
      yield* resume
    }),
  }
})

export type Composition = Effect.Success<typeof setup>

export const composition = <A, E>(body: (c: Composition) => Effect.Effect<A, E, never>) =>
  Effect.gen(function* () {
    const c = yield* setup
    return yield* body(c)
  }).pipe(Effect.scoped, Effect.provide(layer), Effect.orDie)
