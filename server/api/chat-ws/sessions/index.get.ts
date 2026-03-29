export default defineEventHandler(async () => {
  // listChatSessions is no longer used for the sidebar (now uses v2/claude-code/projects)
  // This endpoint is only used by legacy ChatV2Interface and can return empty
  return []
})
