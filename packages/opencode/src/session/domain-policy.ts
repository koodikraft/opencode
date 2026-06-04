import type { Agent } from "@/agent/agent"
import type { ModelMessage } from "ai"

const DOMAIN_MODEL = {
  providerID: "opencode-go",
  modelID: "deepseek-v4-flash",
} as const

const DOMAIN_AGENT_SUBSTRINGS = ["leverage", "ravi", "domain-", "domain/"] as const

const DOMAIN_MESSAGE_TRIGGERS = ["leverage pairs", "best ravi bet", "domain:"] as const

export function isDomainAction(agent: Agent.Info | undefined, agentName: string, messages: ModelMessage[]): boolean {
  if (agent?.name) {
    if (DOMAIN_AGENT_SUBSTRINGS.some((s) => agent.name!.toLowerCase().includes(s))) return true
  }
  if (DOMAIN_AGENT_SUBSTRINGS.some((s) => agentName.toLowerCase().includes(s))) return true
  const allText = messages
    .filter((m) => m.role === "user")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ")
    .toLowerCase()
  if (DOMAIN_MESSAGE_TRIGGERS.some((t) => allText.includes(t))) return true
  return false
}

export function domainModel() {
  return DOMAIN_MODEL
}

export function domainModelProviderID() {
  return DOMAIN_MODEL.providerID
}

export function domainModelID() {
  return DOMAIN_MODEL.modelID
}

export * as DomainPolicy from "./domain-policy"
