import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { parseFrontmatter } from '../../utils/frontmatter'
import type { SkillFrontmatter } from '~/types'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const body = await readBody<{ filePath: string }>(event)

  if (!body.filePath || !existsSync(body.filePath)) {
    throw createError({ statusCode: 400, message: 'Valid filePath is required' })
  }

  try {
    const raw = await readFile(body.filePath, 'utf-8')
    const { frontmatter, body: contentBody } = parseFrontmatter<SkillFrontmatter>(raw)

    return {
      slug,
      frontmatter: { name: slug, ...frontmatter },
      body: contentBody,
      filePath: body.filePath,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Failed to read skill file: ${error.message}`,
    })
  }
})
