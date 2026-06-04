const pattern = /^(New session|Child session) - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function sessionTitle(title?: string, newSessionTitle?: string) {
  if (!title) return title
  const normalized = title.match(pattern)?.[1] ?? title
  if (normalized === "New session" && newSessionTitle) return newSessionTitle
  return normalized
}
