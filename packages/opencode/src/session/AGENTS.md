# Domain Action Ownership Boundary

OpenCode owns: UI, orchestration, session flow, provider/model selection, and answer shaping.

AI Agent (external MCP backend at `/srv/ai-agent/`) owns: domain data gathering, scoring, proposals, approvals, and backend state.

**Rules enforced by this boundary:**

1. Domain actions (`Leverage pairs`, `Best ravi bet`) are read-only recommendations. No auto-execution from OpenCode.
2. Provider/model selection for domain actions is OpenCode's decision (`DomainPolicy`). AI Agent never selects the provider.
3. AI Agent exposes its domain data through MCP tools only. It does not control OpenCode's session flow or UI.
4. Proposal/approval flows are owned by AI Agent. OpenCode surfaces them as follow-up state, not silent execution.
5. DomainPolicy (`domain-policy.ts`) is the sole policy owner for routing domain requests to the correct provider.
