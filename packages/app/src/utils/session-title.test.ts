import { describe, expect, test } from "bun:test"
import { sessionTitle } from "./session-title"

describe("sessionTitle", () => {
  test("localizes the generated new session title", () => {
    expect(sessionTitle("New session - 2026-06-03T15:31:13.503Z", "Uusi istunto")).toBe("Uusi istunto")
  })

  test("preserves non-generated titles", () => {
    expect(sessionTitle("Fix provider labels", "Uusi istunto")).toBe("Fix provider labels")
  })
})