// Ownership boundary: OpenCode owns provider selection, session orchestration, and UI.
// AI Agent (mcp_server.py) owns domain data, scoring, proposals, and backend state.
// DomainPolicy is the sole policy owner for routing domain requests to the correct provider.

import type { Agent } from "@/agent/agent"
import { Effect } from "effect"
import type { ModelMessage } from "ai"

const DOMAIN_MODEL = {
  providerID: "opencode-go",
  modelID: "deepseek-v4-flash",
} as const

const FALLBACK_MODEL = {
  providerID: "ollama",
  modelID: "deepseek-v4-flash",
} as const

const DOMAIN_AGENT_SUBSTRINGS = ["leverage", "ravi", "domain-", "domain/"] as const

const DOMAIN_MESSAGE_TRIGGERS = ["leverage pairs", "best ravi bet", "domain:"] as const

export const DOMAIN_ANSWER_SHAPE = [
  "## Best Candidate",
  "State the single best opportunity or a clear no-trade/no-bet decision.",
  "",
  "## Rationale",
  "Explain why this candidate was chosen. Reference MCP tool outputs.",
  "",
  "## Main Risks",
  "List the key risks and uncertainties.",
  "",
  "## Next Step",
  "What should happen next. Never execute trades or bets automatically.",
].join("\n")

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

export function fallbackModel() {
  return FALLBACK_MODEL
}

export function isRoutedToDomainModel(providerID: string, modelID: string) {
  return providerID === DOMAIN_MODEL.providerID && modelID === DOMAIN_MODEL.modelID
}

export function isDegradedFallback(providerID: string, _modelID: string) {
  return providerID === FALLBACK_MODEL.providerID
}

export function logDomainRouting(providerID: string, modelID: string) {
  return Effect.logInfo(
    isDegradedFallback(providerID, modelID)
      ? `domain action routed to fallback provider ${providerID}/${modelID}`
      : `domain action routed to ${providerID}/${modelID}`,
  ).pipe(
    Effect.annotateLogs({
      "domain.policy": "active",
      "domain.provider": providerID,
      "domain.model": modelID,
      "domain.degraded": String(isDegradedFallback(providerID, modelID)),
    }),
  )
}

export * as DomainPolicy from "./domain-policy"
