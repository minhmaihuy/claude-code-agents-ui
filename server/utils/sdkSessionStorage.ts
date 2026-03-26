import fs from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import os from 'node:os'
import { getClaudeDir } from './claudeDir'
import type { NormalizedMessage } from '~/types'

/**
 * Get SDK session messages from Claude Code projects
 * SDK sessions are stored in ~/.claude/projects/{projectName}/*.jsonl
 * Messages are scattered across JSONL files and filtered by sessionId
 */
export async function loadSdkSessionMessages(
  projectName: string,
  sessionId: string,
  options: {
    limit?: number | null
    offset?: number
  } = {}
): Promise<{ messages: NormalizedMessage[]; total: number; hasMore: boolean }> {
  const projectDir = path.join(getClaudeDir(), 'projects', projectName)

  if (!existsSync(projectDir)) {
    console.warn(`[SDK Session] Project directory not found: ${projectDir}`)
    return { messages: [], total: 0, hasMore: false }
  }

  try {
    const files = await fs.readdir(projectDir)
    // Filter for JSONL files, excluding agent-* files (those are separate)
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl') && !file.startsWith('agent-'))

    if (jsonlFiles.length === 0) {
      return { messages: [], total: 0, hasMore: false }
    }

    const messages: any[] = []

    // Process all JSONL files to find messages for this session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file)
      const fileStream = createReadStream(jsonlFile)
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      })

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line)
            // Match messages by sessionId
            if (entry.sessionId === sessionId) {
              messages.push(entry)
            }
          } catch (parseError) {
            // Silently skip malformed JSONL lines (common with concurrent writes)
          }
        }
      }
    }

    // Sort messages by timestamp (oldest to newest)
    const sortedMessages = messages.sort((a, b) =>
      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    )

    const total = sortedMessages.length
    const limit = options.limit ?? null
    const offset = options.offset ?? 0

    // If no limit, return all messages
    if (limit === null) {
      return { messages: sortedMessages, total, hasMore: false }
    }

    // Apply pagination - offset 0 should give most recent messages
    const startIndex = Math.max(0, total - offset - limit)
    const endIndex = total - offset
    const paginatedMessages = sortedMessages.slice(startIndex, endIndex)
    const hasMore = startIndex > 0

    return {
      messages: paginatedMessages,
      total,
      hasMore,
    }
  } catch (error) {
    console.error(`[SDK Session] Error reading messages for session ${sessionId}:`, error)
    return { messages: [], total: 0, hasMore: false }
  }
}

/**
 * Detect if a session is an SDK session by checking if it exists in any project
 */
export async function detectSdkSession(sessionId: string): Promise<string | null> {
  const projectsDir = path.join(getClaudeDir(), 'projects')

  if (!existsSync(projectsDir)) {
    return null
  }

  try {
    const projects = await fs.readdir(projectsDir)

    for (const projectName of projects) {
      const projectDir = path.join(projectsDir, projectName)
      const stat = await fs.stat(projectDir)

      if (!stat.isDirectory()) continue

      // Quick check: scan first few lines of any JSONL file for this sessionId
      const files = await fs.readdir(projectDir)
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))

      for (const file of jsonlFiles.slice(0, 3)) {
        // Only check first 3 files for performance
        const jsonlFile = path.join(projectDir, file)
        const fileStream = createReadStream(jsonlFile)
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        })

        let lineCount = 0
        for await (const line of rl) {
          if (lineCount++ > 100) break // Only check first 100 lines for performance

          if (line.trim()) {
            try {
              const entry = JSON.parse(line)
              if (entry.sessionId === sessionId) {
                // Found it!
                rl.close()
                fileStream.destroy()
                return projectName
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        rl.close()
        fileStream.destroy()
      }
    }

    return null
  } catch (error) {
    console.error('[SDK Session] Error detecting SDK session:', error)
    return null
  }
}
