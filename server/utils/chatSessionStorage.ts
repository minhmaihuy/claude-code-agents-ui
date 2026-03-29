import type { NormalizedMessage, ChatSession, ChatSessionSummary } from '~/types'

/**
 * GUTTED: saveMessageToSession is no longer used.
 * The SDK handles its own storage natively.
 */
export async function saveMessageToSession(
  _sessionId: string,
  _message: NormalizedMessage
): Promise<void> {
  // NOOP: We don't write custom chat-sessions anymore
}

/**
 * GUTTED: Load messages from a session (legacy).
 * Redirects to returning empty. New logic reads from SDK project storage.
 */
export async function loadSessionMessages(
  _sessionId: string,
  _options: {
    limit?: number
    offset?: number
  } = {}
): Promise<{ messages: NormalizedMessage[]; total: number; hasMore: boolean }> {
  return { messages: [], total: 0, hasMore: false }
}

/**
 * GUTTED: List all chat sessions.
 * Returns empty. Use SDK's native session listing.
 */
export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  return []
}

/**
 * GUTTED: Get full session details.
 * Returns empty session.
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const now = new Date().toISOString()
  return {
    id: sessionId,
    agentSlug: undefined,
    workingDir: undefined,
    messages: [],
    createdAt: now,
    lastActivity: now,
    status: 'active',
    messageCount: 0,
  }
}

/**
 * GUTTED: Delete a chat session.
 * Does nothing.
 */
export async function deleteChatSession(_sessionId: string): Promise<boolean> {
  return false
}

/**
 * Get session messages (alias for provider compatibility)
 */
export async function getSessionMessages(
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<NormalizedMessage[]> {
  const result = await loadSessionMessages(sessionId, options)
  return result.messages
}

/**
 * Get total message count for a session
 */
export async function getSessionMessagesCount(_sessionId: string): Promise<number> {
  return 0
}

/**
 * Check if a session has any assistant messages
 */
export async function hasAssistantMessages(_sessionId: string): Promise<boolean> {
  return false
}
