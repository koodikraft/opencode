import { expect, test } from "bun:test"
import { DomainPolicy } from "@/session/domain-policy"

function codingAgent() {
  return { name: "default", mode: "primary" as const, prompt: "", permission: [], options: {} }
}

function domainAgent() {
  return { name: "domain-leveragePairs", mode: "primary" as const, prompt: "", permission: [], options: {} }
}

function emptyMessages() {
  return [{ role: "user" as const, content: "hello" }]
}

function domainMessages() {
  return [{ role: "user" as const, content: "Analyze the best leverage pairs" }]
}

function raviMessages() {
  return [{ role: "user" as const, content: "What is the best ravi bet today?" }]
}

test("detects domain action from agent name", () => {
  expect(DomainPolicy.isDomainAction(codingAgent(), "default", emptyMessages())).toBe(false)
  expect(DomainPolicy.isDomainAction(domainAgent(), "default", emptyMessages())).toBe(true)
})

test("detects domain action from agentName parameter", () => {
  expect(DomainPolicy.isDomainAction(undefined, "default", emptyMessages())).toBe(false)
  expect(DomainPolicy.isDomainAction(undefined, "domain-leveragePairs", emptyMessages())).toBe(true)
  expect(DomainPolicy.isDomainAction(undefined, "domain-ravi", emptyMessages())).toBe(true)
})

test("detects domain action from user message content", () => {
  expect(DomainPolicy.isDomainAction(codingAgent(), "default", domainMessages())).toBe(true)
  expect(DomainPolicy.isDomainAction(codingAgent(), "default", raviMessages())).toBe(true)
  expect(DomainPolicy.isDomainAction(codingAgent(), "default", emptyMessages())).toBe(false)
})

test("preserves normal provider policy for coding requests", () => {
  expect(DomainPolicy.isDomainAction(codingAgent(), "default", emptyMessages())).toBe(false)
  expect(DomainPolicy.isDomainAction(codingAgent(), "debug", emptyMessages())).toBe(false)
  expect(DomainPolicy.isDomainAction(codingAgent(), "review", emptyMessages())).toBe(false)
})

test("domainModel returns the expected fast domain route", () => {
  const model = DomainPolicy.domainModel()
  expect(model.providerID).toBe("opencode-go")
  expect(model.modelID).toBe("deepseek-v4-flash")
})
