import { Global } from "@opencode-ai/core/global"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Flag } from "@opencode-ai/core/flag/flag"
import os from "os"
import { Duration, Effect } from "effect"
import { Config } from "@/config/config"
import { ConfigPlugin } from "@/config/plugin"
import { readPluginManifest } from "@/plugin/install"
import { inspectPluginTarget, resolvePluginTarget } from "@/plugin/shared"
import { errorMessage } from "@/util/error"
import { effectCmd } from "../../effect-cmd"
import { cmd } from "../cmd"
import { ConfigCommand } from "./config"
import { FileCommand } from "./file"
import { LSPCommand } from "./lsp"
import { RipgrepCommand } from "./ripgrep"
import { ScrapCommand } from "./scrap"
import { SkillCommand } from "./skill"
import { SnapshotCommand } from "./snapshot"
import { AgentCommand } from "./agent"
import { StartupCommand } from "./startup"
import { V2Command } from "./v2"

export const DebugCommand = cmd({
  command: "debug",
  describe: "debugging and troubleshooting tools",
  builder: (yargs) =>
    yargs
      .command(ConfigCommand)
      .command(LSPCommand)
      .command(RipgrepCommand)
      .command(FileCommand)
      .command(ScrapCommand)
      .command(SkillCommand)
      .command(SnapshotCommand)
      .command(StartupCommand)
      .command(AgentCommand)
      .command(V2Command)
      .command(InfoCommand)
      .command(PathsCommand)
      .command(WaitCommand)
      .demandCommand(),
  async handler() {},
})

const WaitCommand = effectCmd({
  command: "wait",
  describe: "wait indefinitely (for debugging)",
  handler: Effect.fn("Cli.debug.wait")(function* () {
    yield* Effect.sleep(Duration.days(1))
  }),
})

const InfoCommand = effectCmd({
  command: "info",
  describe: "show debug information",
  handler: Effect.fn("Cli.debug.info")(function* () {
    const config = yield* Config.Service.use((cfg) => cfg.get())
    const termProgram = process.env.TERM_PROGRAM
      ? `${process.env.TERM_PROGRAM}${process.env.TERM_PROGRAM_VERSION ? ` ${process.env.TERM_PROGRAM_VERSION}` : ""}`
      : undefined
    const terminal = [termProgram, process.env.TERM].filter((item): item is string => Boolean(item)).join(" / ")

    console.log(`opencode version: ${InstallationVersion}`)
    console.log(`os: ${os.type()} ${os.release()} ${os.arch()}`)
    console.log(`terminal: ${terminal || "unknown"}`)
    console.log("plugins:")
    if (Flag.OPENCODE_PURE) {
      console.log("external plugins disabled (--pure)")
      return
    }
    if (!config.plugin_origins?.length) {
      console.log("none")
      return
    }
    for (const plugin of config.plugin_origins) {
      const spec = ConfigPlugin.pluginSpecifier(plugin.spec)
      console.log(`- ${spec}`)
      const target = yield* Effect.promise(() =>
        resolvePluginTarget(spec).then(
          (item) => ({ ok: true as const, item }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
      )
      if (!target.ok) {
        console.log(`  error: ${errorMessage(target.error)}`)
        continue
      }

      const manifest = yield* Effect.promise(() =>
        readPluginManifest(target.item).then(
          (item) => item,
          (error: unknown) => ({
            ok: false as const,
            code: "manifest_read_failed" as const,
            file: target.item,
            error,
          }),
        ),
      )
      if (!manifest.ok) {
        console.log(`  manifest: ${manifest.code === "manifest_no_targets" ? "no plugin targets" : errorMessage(manifest.error)}`)
        continue
      }

      console.log(`  package: ${(manifest.package.name ?? spec) + (manifest.package.version ? `@${manifest.package.version}` : "")}`)
      console.log(`  targets: ${manifest.targets.map((item) => item.kind).join(", ")}`)

      if (!manifest.targets.some((item) => item.kind === "server")) continue

      const server = yield* Effect.promise(() =>
        inspectPluginTarget(spec, target.item, "server").then(
          (item) => ({ ok: true as const, item }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
      )
      if (!server.ok) {
        console.log(`  server: ${errorMessage(server.error)}`)
        continue
      }
      if (!server.item) continue
      if (server.item.id) console.log(`  id: ${server.item.id}`)
      if (server.item.legacy) {
        console.log("  manifest: legacy export (no metadata declared)")
        continue
      }
      if (!server.item.manifest) {
        console.log("  manifest: not declared")
        continue
      }
      if (server.item.manifest.name) console.log(`  name: ${server.item.manifest.name}`)
      console.log(`  capabilities: ${server.item.manifest.capabilities.join(", ")}`)
      console.log(`  permissions: ${server.item.manifest.permissions?.join(", ") ?? "none declared"}`)
    }
  }),
})

const PathsCommand = cmd({
  command: "paths",
  describe: "show global paths (data, config, cache, state)",
  handler() {
    for (const [key, value] of Object.entries(Global.Path)) {
      console.log(key.padEnd(10), value)
    }
  },
})
