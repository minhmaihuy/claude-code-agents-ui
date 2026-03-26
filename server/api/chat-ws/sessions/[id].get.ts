import { getChatSession, loadSessionMessages } from '../../../utils/chatSessionStorage'
import { detectSdkSession, loadSdkSessionMessages } from '../../../utils/sdkSessionStorage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  try {
    const query = getQuery(event)
    const limit = query.limit ? parseInt(query.limit as string) : 50
    const offset = query.offset ? parseInt(query.offset as string) : 0

    console.log(`[GET session] Loading session ${id}, limit: ${limit}, offset: ${offset}`)

    // First, try to load as a chat-ws session
    const session = await getChatSession(id)

    // Load messages with pagination (chat-ws)
    let messagesResult = await loadSessionMessages(id, {
      limit,
      offset,
    })

    console.log(`[GET session] Chat-ws messages:`, messagesResult.total)

    // If no messages found in chat-ws, try SDK sessions
    if (messagesResult.total === 0) {
      console.log(`[GET session] No chat-ws messages, checking SDK sessions...`)
      const projectName = await detectSdkSession(id)

      if (projectName) {
        console.log(`[GET session] Found SDK session in project: ${projectName}`)
        messagesResult = await loadSdkSessionMessages(projectName, id, {
          limit,
          offset,
        })
        console.log(`[GET session] SDK messages:`, messagesResult.total)
      }
    }

    const { messages, total, hasMore } = messagesResult

    if (!session && total === 0) {
      // This should never happen now, but handle it gracefully just in case
      console.warn(`[GET session] No session data found for ${id}`)
      const now = new Date().toISOString()
      return {
        id,
        messages: [],
        createdAt: now,
        lastActivity: now,
        status: 'active',
        messageCount: 0,
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
      }
    }

    return {
      ...session,
      messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    }
  } catch (error: any) {
    console.error(`[GET session] Error loading session ${id}:`, error)

    // Return empty session on error (graceful degradation - no 404/500)
    const now = new Date().toISOString()
    return {
      id,
      messages: [],
      createdAt: now,
      lastActivity: now,
      status: 'active',
      messageCount: 0,
      pagination: {
        total: 0,
        limit: parseInt(getQuery(event).limit as string) || 50,
        offset: parseInt(getQuery(event).offset as string) || 0,
        hasMore: false,
      },
    }
  }
})
