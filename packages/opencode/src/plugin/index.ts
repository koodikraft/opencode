import type {
  Hooks,
  PluginCapability,
  PluginInput,
  Plugin as PluginInstance,
  PluginManifest,
  PluginModule,
  PluginPermission,
  WorkspaceAdapter as PluginWorkspaceAdapter,
} from "@opencode-ai/plugin"
import { Config } from "@/config/config"
import * as Log from "@opencode-ai/core/util/log"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { ServerAuth } from "@/server/auth"
import { CodexAuthPlugin } from "./openai/codex"
import { Session } from "@/session/session"
import { NamedError } from "@opencode-ai/core/util/error"
import { CopilotAuthPlugin } from "./github-copilot/copilot"
import { gitlabAuthPlugin as GitlabAuthPlugin } from "opencode-gitlab-auth"
import { PoeAuthPlugin } from "opencode-poe-auth"
import { CloudflareAIGatewayAuthPlugin, CloudflareWorkersAuthPlugin } from "./cloudflare"
import { AzureAuthPlugin } from "./azure"
import { DigitalOceanAuthPlugin } from "./digitalocean"
import { XaiAuthPlugin } from "./xai"
import { Effect, Layer, Context } from "effect"
import { EffectBridge } from "@/effect/bridge"
import { InstanceState } from "@/effect/instance-state"
import { errorMessage } from "@/util/error"
import { PluginLoader } from "./loader"
import { parsePluginSpecifier, readPluginId, readV1Plugin, resolvePluginId } from "./shared"
import { registerAdapter } from "@/control-plane/adapters"
import type { WorkspaceAdapter } from "@/control-plane/types"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { InstallationChannel } from "@opencode-ai/core/installation/version"

const log = Log.create({ service: "plugin" })

type State = {
  plugins: PluginRuntimeEntry[]
}

// Hook names that follow the (input, output) => Promise<void> trigger pattern
type TriggerName = {
  [K in keyof Hooks]-?: NonNullable<Hooks[K]> extends (input: any, output: any) => Promise<void> ? K : never
}[keyof Hooks]

type HookName = keyof Hooks
type PluginSource = PluginLoader.Loaded["source"] | "internal"
type HookPolicy = {
  capabilities?: PluginCapability[]
  permissions?: PluginPermission[]
}

export type PluginInspection = {
  id: string
  spec: string
  source: PluginSource
  target?: string
  manifest?: PluginManifest
  activeHooks: HookName[]
  blockedHooks: HookName[]
}

type PluginRuntimeEntry = PluginInspection & {
  hooks: Hooks
}

const hookPolicies: Partial<Record<HookName, HookPolicy>> = {
  tool: { capabilities: ["tool"] },
  auth: { capabilities: ["provider.adapter"], permissions: ["provider.route"] },
  provider: { capabilities: ["provider.adapter"], permissions: ["provider.route"] },
  "chat.params": { capabilities: ["provider.adapter"], permissions: ["provider.route"] },
  "chat.headers": { capabilities: ["provider.adapter"], permissions: ["provider.route"] },
  "experimental.provider.small_model": { capabilities: ["provider.adapter"], permissions: ["provider.route"] },
  event: { capabilities: ["domain.automation"] },
  config: { capabilities: ["domain.automation"] },
  "chat.message": { capabilities: ["domain.automation"] },
  "permission.ask": { capabilities: ["domain.automation"] },
  "command.execute.before": { capabilities: ["domain.automation"] },
  "tool.execute.before": { capabilities: ["domain.automation"] },
  "tool.execute.after": { capabilities: ["domain.automation"] },
  "shell.env": { capabilities: ["domain.automation"], permissions: ["shell"] },
  "experimental.chat.messages.transform": { capabilities: ["domain.automation"] },
  "experimental.chat.system.transform": { capabilities: ["domain.automation"] },
  "experimental.session.compacting": { capabilities: ["domain.automation"] },
  "experimental.compaction.autocontinue": { capabilities: ["domain.automation"] },
  "experimental.text.complete": { capabilities: ["domain.automation"] },
}

export interface Interface {
  readonly trigger: <
    Name extends TriggerName,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(
    name: Name,
    input: Input,
    output: Output,
  ) => Effect.Effect<Output>
  readonly list: () => Effect.Effect<Hooks[]>
  readonly inspect: () => Effect.Effect<PluginInspection[]>
  readonly init: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Plugin") {}

export function experimentalWebSocketsEnabled(input: { enabled: boolean; channel?: string }) {
  return input.enabled || ["local", "dev", "beta"].includes(input.channel ?? InstallationChannel)
}

// Built-in plugins that are directly imported (not installed from npm)
function internalPlugins(flags: RuntimeFlags.Info): PluginInstance[] {
  return [
    // Temporary rollout: pre-release builds use WebSockets by default; releases require explicit opt-in.
    (input) =>
      CodexAuthPlugin(input, {
        experimentalWebSockets: experimentalWebSocketsEnabled({ enabled: flags.experimentalWebSockets }),
      }),
    CopilotAuthPlugin,
    GitlabAuthPlugin,
    PoeAuthPlugin,
    CloudflareWorkersAuthPlugin,
    CloudflareAIGatewayAuthPlugin,
    AzureAuthPlugin,
    DigitalOceanAuthPlugin,
    XaiAuthPlugin,
  ]
}

function isServerPlugin(value: unknown): value is PluginInstance {
  return typeof value === "function"
}

function getServerPlugin(value: unknown) {
  if (isServerPlugin(value)) return value
  if (!value || typeof value !== "object" || !("server" in value)) return
  if (!isServerPlugin(value.server)) return
  return value.server
}

function getLegacyPlugins(mod: Record<string, unknown>) {
  const seen = new Set<unknown>()
  const result: PluginInstance[] = []

  for (const entry of Object.values(mod)) {
    if (seen.has(entry)) continue
    seen.add(entry)
    const plugin = getServerPlugin(entry)
    if (!plugin) throw new TypeError("Plugin export is not a function")
    result.push(plugin)
  }

  return result
}

function presentHookNames(hooks: Hooks): HookName[] {
  return Object.entries(hooks).flatMap(([name, value]) => {
    if (name === "dispose") return []
    if (name === "tool") {
      if (!value || typeof value !== "object" || Object.keys(value).length === 0) return []
      return ["tool"]
    }
    if (value === undefined) return []
    return [name as HookName]
  })
}

function deniedAccess(manifest: PluginManifest | undefined, policy: HookPolicy | undefined) {
  if (!manifest || !policy) return [] as string[]

  const denied: string[] = []
  for (const capability of policy.capabilities ?? []) {
    if (manifest.capabilities.includes(capability)) continue
    denied.push(`capability:${capability}`)
  }
  for (const permission of policy.permissions ?? []) {
    if (manifest.permissions?.includes(permission)) continue
    denied.push(`permission:${permission}`)
  }
  return denied
}

function hasCapability(manifest: PluginManifest | undefined, capability: PluginCapability) {
  if (!manifest) return true
  return manifest.capabilities.includes(capability)
}

function hasPermission(manifest: PluginManifest | undefined, permission: PluginPermission) {
  if (!manifest) return true
  return manifest.permissions?.includes(permission) ?? false
}

function deniedShell(spec: string, id: string): NonNullable<PluginInput["$"]> {
  const fail = () => {
    throw new Error(`Plugin ${id} (${spec}) requires manifest permission shell`)
  }

  const shell = ((..._args: Parameters<NonNullable<PluginInput["$"]>>) => fail()) as unknown as NonNullable<
    PluginInput["$"]
  >
  shell.braces = () => fail()
  shell.escape = () => fail()
  shell.env = () => shell
  shell.cwd = () => shell
  shell.nothrow = () => shell
  shell.throws = () => shell
  return shell
}

function scopedInput(base: PluginInput, spec: string, id: string, manifest: PluginManifest | undefined): PluginInput {
  return {
    ...base,
    experimental_workspace: {
      register(type: string, adapter: PluginWorkspaceAdapter) {
        if (!hasCapability(manifest, "workspace.adapter")) {
          log.warn("plugin workspace adapter blocked by manifest capability", { plugin: id, spec, type })
          return
        }
        if (!hasPermission(manifest, "workspace.write")) {
          log.warn("plugin workspace adapter blocked by manifest permission", {
            plugin: id,
            spec,
            type,
            permission: "workspace.write",
          })
          return
        }
        base.experimental_workspace.register(type, adapter)
      },
    },
    $: hasPermission(manifest, "shell") ? base.$ : deniedShell(spec, id),
  }
}

function sanitizeHooks(spec: string, id: string, manifest: PluginManifest | undefined, hooks: Hooks) {
  const next = { ...hooks }
  const blockedHooks: HookName[] = []

  for (const name of presentHookNames(hooks)) {
    const denied = deniedAccess(manifest, hookPolicies[name])
    if (!denied.length) continue
    Reflect.deleteProperty(next, name)
    blockedHooks.push(name)
    log.warn("plugin hook blocked by manifest", { plugin: id, spec, hook: name, denied })
  }

  return {
    hooks: next,
    blockedHooks,
  }
}

function createPluginEntry(
  id: string,
  spec: string,
  source: PluginSource,
  target: string | undefined,
  manifest: PluginManifest | undefined,
  hooks: Hooks,
): PluginRuntimeEntry {
  const sanitized = sanitizeHooks(spec, id, manifest, hooks)
  return {
    id,
    spec,
    source,
    target,
    manifest,
    hooks: sanitized.hooks,
    activeHooks: presentHookNames(sanitized.hooks),
    blockedHooks: sanitized.blockedHooks,
  }
}

async function applyPlugin(load: PluginLoader.Loaded, input: PluginInput) {
  const plugin = readV1Plugin(load.mod, load.spec, "server", "detect")
  if (plugin) {
    const id = await resolvePluginId(load.source, load.spec, load.target, readPluginId(plugin.id, load.spec), load.pkg)
    return [
      createPluginEntry(
        id,
        load.spec,
        load.source,
        load.target,
        load.manifest,
        await (plugin as PluginModule).server(scopedInput(input, load.spec, id, load.manifest), load.options),
      ),
    ]
  }

  return Promise.all(
    getLegacyPlugins(load.mod).map(async (server, index) =>
      {
        const id = `${load.spec}#${index + 1}`
        return createPluginEntry(
          id,
          load.spec,
          load.source,
          load.target,
          undefined,
          await server(scopedInput(input, load.spec, id, undefined), load.options),
        )
      },
    ),
  )
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2Bridge.Service
    const config = yield* Config.Service
    const flags = yield* RuntimeFlags.Service

    const state = yield* InstanceState.make<State>(
      Effect.fn("Plugin.state")(function* (ctx) {
        const loadedPlugins: PluginRuntimeEntry[] = []
        const bridge = yield* EffectBridge.make()

        function publishPluginError(message: string) {
          bridge.fork(events.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() }))
        }

        const { Server } = yield* Effect.promise(() => import("../server/server"))

        const client = createOpencodeClient({
          baseUrl: "http://localhost:4096",
          directory: ctx.directory,
          headers: ServerAuth.headers(),
          fetch: async (...args) => Server.Default().app.fetch(...args),
        })
        const cfg = yield* config.get()
        const input: PluginInput = {
          client,
          project: ctx.project,
          worktree: ctx.worktree,
          directory: ctx.directory,
          experimental_workspace: {
            register(type: string, adapter: PluginWorkspaceAdapter) {
              registerAdapter(ctx.project.id, type, adapter as WorkspaceAdapter)
            },
          },
          get serverUrl(): URL {
            return Server.url ?? new URL("http://localhost:4096")
          },
          // @ts-expect-error
          $: typeof Bun === "undefined" ? undefined : Bun.$,
        }

        for (const [index, plugin] of (flags.disableDefaultPlugins ? [] : internalPlugins(flags)).entries()) {
          const id = `internal:${plugin.name || index + 1}`
          log.info("loading internal plugin", { name: plugin.name })
          const init = yield* Effect.tryPromise({
            try: async () => createPluginEntry(id, id, "internal", undefined, undefined, await plugin(input)),
            catch: (err) => {
              log.error("failed to load internal plugin", { name: plugin.name, error: err })
            },
          }).pipe(Effect.option)
          if (init._tag === "Some") loadedPlugins.push(init.value)
        }

        const configuredPlugins = flags.pure ? [] : (cfg.plugin_origins ?? [])
        if (flags.pure && cfg.plugin_origins?.length) {
          log.info("skipping external plugins in pure mode", { count: cfg.plugin_origins.length })
        }
        if (configuredPlugins.length) yield* config.waitForDependencies()

        const loaded = yield* Effect.promise(() =>
          PluginLoader.loadExternal({
            items: configuredPlugins,
            kind: "server",
            report: {
              start(candidate) {
                log.info("loading plugin", { path: candidate.plan.spec })
              },
              missing(candidate, _retry, message) {
                log.warn("plugin has no server entrypoint", { path: candidate.plan.spec, message })
              },
              error(candidate, _retry, stage, error, resolved) {
                const spec = candidate.plan.spec
                const cause = error instanceof Error ? (error.cause ?? error) : error
                const message = stage === "load" ? errorMessage(error) : errorMessage(cause)

                if (stage === "install") {
                  const parsed = parsePluginSpecifier(spec)
                  log.error("failed to install plugin", { pkg: parsed.pkg, version: parsed.version, error: message })
                  publishPluginError(`Failed to install plugin ${parsed.pkg}@${parsed.version}: ${message}`)
                  return
                }

                if (stage === "compatibility") {
                  log.warn("plugin incompatible", { path: spec, error: message })
                  publishPluginError(`Plugin ${spec} skipped: ${message}`)
                  return
                }

                if (stage === "entry") {
                  log.error("failed to resolve plugin server entry", { path: spec, error: message })
                  publishPluginError(`Failed to load plugin ${spec}: ${message}`)
                  return
                }

                log.error("failed to load plugin", { path: spec, target: resolved?.entry, error: message })
                publishPluginError(`Failed to load plugin ${spec}: ${message}`)
              },
            },
          }),
        )
        for (const load of loaded) {
          if (!load) continue

          // Keep plugin execution sequential so hook registration and execution
          // order remains deterministic across plugin runs.
          yield* Effect.tryPromise({
            try: () => applyPlugin(load, input),
            catch: (err) => {
              const message = errorMessage(err)
              log.error("failed to load plugin", { path: load.spec, error: message })
              return message
            },
          }).pipe(
            Effect.tap((entries) =>
              Effect.sync(() => {
                loadedPlugins.push(...entries)
              }),
            ),
            Effect.catch(() => {
              // TODO: make proper events for this
              // events.publish(Session.Event.Error, {
              //   error: new NamedError.Unknown({
              //     message: `Failed to load plugin ${load.spec}: ${message}`,
              //   }).toObject(),
              // })
              return Effect.void
            }),
          )
        }

        // Notify plugins of current config
        for (const plugin of loadedPlugins) {
          yield* Effect.tryPromise({
            try: () => Promise.resolve((plugin.hooks as any).config?.(cfg)),
            catch: (err) => {
              log.error("plugin config hook failed", { error: err })
            },
          }).pipe(Effect.ignore)
        }

        const unsubscribe = yield* events.listen((event) => {
          if (event.location?.directory !== ctx.directory) return Effect.void
          return Effect.sync(() => {
            for (const plugin of loadedPlugins) {
              void plugin.hooks["event"]?.({ event: { id: event.id, type: event.type, properties: event.data } as any })
            }
          })
        })
        yield* Effect.addFinalizer(() => unsubscribe)

        yield* Effect.addFinalizer(() =>
          Effect.forEach(
            loadedPlugins,
            (plugin) =>
              Effect.tryPromise({
                try: () => Promise.resolve(plugin.hooks.dispose?.()),
                catch: (error) => {
                  log.error("plugin dispose hook failed", { error })
                },
              }).pipe(Effect.ignore),
            { discard: true },
          ),
        )

        return { plugins: loadedPlugins }
      }),
    )

    const trigger = Effect.fn("Plugin.trigger")(function* <
      Name extends TriggerName,
      Input = Parameters<Required<Hooks>[Name]>[0],
      Output = Parameters<Required<Hooks>[Name]>[1],
    >(name: Name, input: Input, output: Output) {
      if (!name) return output
      const s = yield* InstanceState.get(state)
      for (const plugin of s.plugins) {
        const fn = plugin.hooks[name] as any
        if (!fn) continue
        yield* Effect.promise(async () => fn(input, output))
      }
      return output
    })

    const list = Effect.fn("Plugin.list")(function* () {
      const s = yield* InstanceState.get(state)
      return s.plugins.map((item) => item.hooks)
    })

    const inspect = Effect.fn("Plugin.inspect")(function* () {
      const s = yield* InstanceState.get(state)
      return s.plugins.map(({ hooks: _hooks, ...item }) => item)
    })

    const init = Effect.fn("Plugin.init")(function* () {
      yield* InstanceState.get(state)
    })

    return Service.of({ trigger, list, inspect, init })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(EventV2Bridge.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(RuntimeFlags.defaultLayer),
)

export * as Plugin from "."
