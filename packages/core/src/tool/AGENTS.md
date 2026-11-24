# Core Tool Architecture

`src/tool.ts` owns the Location-scoped tool service, registrations, effective lookup, execution, and terminal outcomes. This folder contains its supporting runtime modules and built-in plugins.

## Representations

- Plugin authors get schema-derived input types at the `ToolEditor.add` boundary through `Tool`.
- The heterogeneous Core registry deliberately erases registered definitions to `Tool.Info`. Use `any` at this internal boundary; do not replace it with `unknown`, JSON-value plumbing, casts, or compiled wrapper types solely to preserve type safety after registration.
- Executors return model content and metadata alongside declared machine output. Shipped built-ins and plugin tools use the same runtime shape after registration.
- `src/tool.ts` stores canonical Location registrations, derives LLM definitions, executes tools, and normalizes model content and images.
- Built-in tool plugins live in `tool/plugin`.

Do not add a second executable entry type, registry-owned executor, authorization callback, output-path callback, or legacy normalization path.

## Construction

Tool schemas use `input` and `output` terminology. Each tool carries its name, options, schemas, and executable behavior in one object.

Location-scoped built-in layers acquire `Permission.Service` and every other required Location service while the layer is constructed. The executor captures those services. Permission requests always take their requester fields from the canonical invocation context through `Permission.invocation`:

```ts
yield* permission.assert({
  action: "read",
  resources: [target.resource],
  save: ["*"],
  ...Permission.invocation(context),
})
```

Leaves own resolution, permission, and side-effect ordering. Translate only expected typed errors into `ToolFailure`; do not use `catchCause`, because interruption and defects must survive. User declines from `Permission.assert` and question dismissals travel as defects beneath leaf `mapError` blankets and resurface as typed failures at `SessionModelRequest.executeTool`; leaves must never catch or convert them. A decline with feedback (`Permission.CorrectedError`) stays typed so the leaf converts it into `ToolFailure` and the model continues.

## Registration

Built-ins, plugins, and MCP install tools through `Tool.Service.transform`, adding complete tool objects to the editor. A tool may provide a namespace, which flattens direct model names to `<namespace>_<tool>`, and defaults into CodeMode (`codemode` defaults true; `codemode: false` keeps the tool on the provider's native tool list).

Namespace descriptions are registered once through `editor.namespace(...)`. Tool options continue to reference the namespace by string name; an unregistered namespace remains valid and simply has no namespace description.

The service uses shared `State` to replay synchronous transforms in registration order against a fresh editor. `Tool.Service.reload()` rebuilds from captured source data without changing registration precedence. Registrations are scoped and return a real, idempotent `dispose` Effect:

- The latest valid active registration for the same effective name wins.
- `update` and `remove` target effective names and do nothing for missing tools. Updates preserve the name and namespace; invalid updates leave the previous definition intact. Creating a tool requires `add`.
- Disposing a registration or closing its scope removes only its transform and rebuilds from the remaining transforms, revealing any earlier definition it overrode.
- Each model request captures the effective definitions and executors it advertises; later reloads and disposal affect later snapshots. Captured executors may still reference mutable producer-owned state.

MCP owns one stable tool transform that reads its latest discovered tools. Tool-list changes update that source and reload the tool state instead of re-registering at the end of the transform order. MCP refresh therefore preserves the precedence of later plugin overrides.

Type safety ends at registration. The registry validates model input and declared output at runtime and should not carry producer schema generics through storage or execution.

`Tool.Service` is Location-scoped. Do not make the registry process-global or construct a separate application-tool service for each Location.

## Permissions

The registry has no `Permission.Service` dependency and performs no execution authorization. Registration options may attach a permission action solely to preserve whole-tool definition filtering. Most registrations default to their effective name; `edit`, `write`, and `patch` use the shared `edit` action.

Tool filtering is catalog visibility, not execution authorization. A call still executes the captured tool's leaf policy if it reaches execution.

## Output

Built-ins return complete tool responses. `Tool.Snapshot.execute` is the local execution boundary. Generic output bounding is applied by the Session runner after execution.

Producer capture remains local to producers. Shell stores combined process output in its backing file and returns a bounded tail with the full-output path when truncated.

## Voice

- A contract is the source-code, byte-determined surface that a unit exposes (including inline definitions). This is the superset.
- Voices are a subset of contract. A voice is the serialised input–output string contract with the model.

Everything a tool says to the model is defined in a voice file, never inline. DRY: each string is defined once.

Two kinds:

- **Serialization voices** — a rendered format plus its documented reading rule, and the fixed message formats for standard events (an event any tool can emit with the same meaning) — are cross-tool: defined in `tool/voices.ts`.
- **Tool voice** — everything else the tool says — is defined in `tool/plugin/<tool>-voice.ts`, beside the tool's own file.

The obligation is scoped to the change: a tool whose model-facing text is not being changed keeps its current placement.

Migration (when a tool's model-facing text is next changed):

- Inline model-facing text in a tool file moves to the voice file of its kind.
- The migrator **audits** for new shared formats: a standard event instantiated by at least one other tool is appended to `tool/voices.ts` as a fixed message format with tool-specific slots, and its instantiators are re-pointed to it; an event only this tool instantiates stays in the per-tool file until the threshold is met.

**Examples:**

- `edit-voice.ts`, `read-voice.ts`

## Functional (composition) tests

**The domain commitment.** Every cross-tool contract this domain participates in is covered by a functional test.

**Scope — what a functional test covers:**

- A functional test is a composition of units that share functional boundaries; each composition (a pipeline) SHOULD be covered by a functional test.
- Every possible composition of units SHOULD have its own unique functional test, disambiguated by the `<input-unit>-<output-unit>` name pair.
- A scope is set by the outer boundaries: `boo → foo → bar → la` subsumes the inner `foo → bar` (covered by `functional-boo-la.test.ts`), but a composition used in a different order — `bar → foo` — requires its own unique test (`functional-bar-foo.test.ts`).
- The bytes of the source implementations are the truth that both the spec's `[input, expected output][]` definition and the test's consumption SHOULD match — a functional test MUST NOT leave a real compositional scenario invisible and untested.

**Domain facts:**

- Placement: the functional tests and the functional spec are co-located in the domain test directory, `packages/core/test/`; the shared `composition.ts` harness sits in its `fixture/` subdirectory.
- Naming: a functional test is `functional-<input-unit>-<output-unit>.test.ts`; the functional spec is `functional-spec.ts`; the shared harness is `composition.ts`.
- Invocation: `bun run script/test.ts test/functional-*.test.ts` from `packages/core` — the package's sandboxed `bun test` wrapper.
- Where a LLM is a unit in the pipeline: the test is driven where the units are composed — the session runner: the tool plugins and real I/O against a temp `Location`, through `TestLLM.testLayer()` (`test/fixture/composition.ts`); the executable inverse of a model-facing rendering lives with the producer's voice (e.g. `rendered line → file bytes` via `decode` and `LinePrefix`/`GrepLine.decodeRule` in `voices.ts`).

**Examples:**

- `functional-read-edit.test.ts`, `functional-grep-edit.test.ts`
