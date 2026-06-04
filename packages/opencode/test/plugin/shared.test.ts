import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { pathToFileURL } from "url"
import { PluginLoader } from "../../src/plugin/loader"
import { parsePluginSpecifier, readPluginManifest } from "../../src/plugin/shared"

describe("parsePluginSpecifier", () => {
  test("parses standard npm package without version", () => {
    expect(parsePluginSpecifier("acme")).toEqual({
      pkg: "acme",
      version: "latest",
    })
  })

  test("parses standard npm package with version", () => {
    expect(parsePluginSpecifier("acme@1.0.0")).toEqual({
      pkg: "acme",
      version: "1.0.0",
    })
  })

  test("parses scoped npm package without version", () => {
    expect(parsePluginSpecifier("@opencode/acme")).toEqual({
      pkg: "@opencode/acme",
      version: "latest",
    })
  })

  test("parses scoped npm package with version", () => {
    expect(parsePluginSpecifier("@opencode/acme@1.0.0")).toEqual({
      pkg: "@opencode/acme",
      version: "1.0.0",
    })
  })

  test("parses package with git+https url", () => {
    expect(parsePluginSpecifier("acme@git+https://github.com/opencode/acme.git")).toEqual({
      pkg: "acme",
      version: "git+https://github.com/opencode/acme.git",
    })
  })

  test("parses scoped package with git+https url", () => {
    expect(parsePluginSpecifier("@opencode/acme@git+https://github.com/opencode/acme.git")).toEqual({
      pkg: "@opencode/acme",
      version: "git+https://github.com/opencode/acme.git",
    })
  })

  test("parses package with git+ssh url containing another @", () => {
    expect(parsePluginSpecifier("acme@git+ssh://git@github.com/opencode/acme.git")).toEqual({
      pkg: "acme",
      version: "git+ssh://git@github.com/opencode/acme.git",
    })
  })

  test("parses scoped package with git+ssh url containing another @", () => {
    expect(parsePluginSpecifier("@opencode/acme@git+ssh://git@github.com/opencode/acme.git")).toEqual({
      pkg: "@opencode/acme",
      version: "git+ssh://git@github.com/opencode/acme.git",
    })
  })

  test("parses unaliased git+ssh url", () => {
    expect(parsePluginSpecifier("git+ssh://git@github.com/opencode/acme.git")).toEqual({
      pkg: "git+ssh://git@github.com/opencode/acme.git",
      version: "",
    })
  })

  test("parses npm alias using the alias name", () => {
    expect(parsePluginSpecifier("acme@npm:@opencode/acme@1.0.0")).toEqual({
      pkg: "acme",
      version: "npm:@opencode/acme@1.0.0",
    })
  })

  test("parses bare npm protocol specifier using the target package", () => {
    expect(parsePluginSpecifier("npm:@opencode/acme@1.0.0")).toEqual({
      pkg: "@opencode/acme",
      version: "1.0.0",
    })
  })

  test("parses unversioned npm protocol specifier", () => {
    expect(parsePluginSpecifier("npm:@opencode/acme")).toEqual({
      pkg: "@opencode/acme",
      version: "latest",
    })
  })
})

describe("readPluginManifest", () => {
  test("returns undefined when manifest is absent", () => {
    expect(readPluginManifest(undefined, "acme")).toBeUndefined()
  })

  test("reads a valid plugin manifest", () => {
    expect(
      readPluginManifest(
        {
          kind: "addon",
          name: "Acme Automation",
          version: "1.0.0",
          description: "Adds automation tools",
          capabilities: ["tool", "domain.automation", "ui.session.dock"],
          permissions: ["workspace.read", "shell"],
          workspace: "project",
        },
        "acme",
      ),
    ).toEqual({
      kind: "addon",
      name: "Acme Automation",
      version: "1.0.0",
      description: "Adds automation tools",
      capabilities: ["tool", "domain.automation", "ui.session.dock"],
      permissions: ["workspace.read", "shell"],
      workspace: "project",
    })
  })

  test("rejects a manifest without capabilities", () => {
    expect(() => readPluginManifest({ name: "Acme" }, "acme")).toThrow("missing manifest.capabilities")
  })

  test("rejects unknown capabilities", () => {
    expect(() => readPluginManifest({ capabilities: ["unknown"] }, "acme")).toThrow(
      "unknown manifest.capabilities entry unknown",
    )
  })
})

describe("PluginLoader manifest", () => {
  test("loads validated manifest metadata from a v1 server plugin", async () => {
    const dir = await fs.mkdtemp(path.join(tmpdir(), "opencode-plugin-"))
    const file = path.join(dir, "plugin.ts")
    await Bun.write(
      file,
      [
        "export default {",
        '  id: "demo.plugin",',
        "  manifest: {",
        '    kind: "addon",',
        '    name: "Demo Plugin",',
        '    capabilities: ["tool", "ui.settings"],',
        '    permissions: ["shell"],',
        '    workspace: "project",',
        "  },",
        "  server: async () => ({}),",
        "}",
        "",
      ].join("\n"),
    )

    const resolved = await PluginLoader.resolve(
      {
        spec: pathToFileURL(file).href,
        options: undefined,
        deprecated: false,
      },
      "server",
    )

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return

    const loaded = await PluginLoader.load(resolved.value)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    expect(loaded.value.manifest).toEqual({
      kind: "addon",
      name: "Demo Plugin",
      version: undefined,
      description: undefined,
      capabilities: ["tool", "ui.settings"],
      permissions: ["shell"],
      workspace: "project",
    })
  })
})
