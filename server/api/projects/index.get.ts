import { getClaudeCodeProjects } from '../../utils/claudeCodeHistory'

export default defineEventHandler(async () => {
  try {
    const projects = await getClaudeCodeProjects()
    // The React frontend expects the array directly, based on api.projects() in api.js
    return projects
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch Claude Code projects'
    })
  }
})
