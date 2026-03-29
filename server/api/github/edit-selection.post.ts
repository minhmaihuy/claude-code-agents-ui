import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseFrontmatter } from '../../utils/frontmatter'
import { syncGithubImportSkillSymlinks } from '../../utils/githubSkillSymlinks'
import type { SkillFrontmatter } from '~/types'

export default defineEventHandler(async (event) => {
  const { owner, repo, selectedSkills } = await readBody<{
    owner: string
    repo: string
    selectedSkills?: string[]
  }>(event)

  const registry = await readImportsRegistry()
  const entry = findImport(registry, owner, repo)

  if (!entry) {
    throw createError({ statusCode: 404, message: 'Import not found' })
  }

  // If selectedSkills provided, update them
  if (selectedSkills !== undefined) {
    const previousSlugs = [...entry.selectedSkills]
    entry.selectedSkills = selectedSkills
    await writeImportsRegistry(registry)
    const symlinkSync = await syncGithubImportSkillSymlinks(entry, previousSlugs, selectedSkills)
    return { entry, symlinkSync }
  }

  // Otherwise, scan local clone for all available skills and return them
  const scanRoot = entry.targetPath
    ? join(entry.localPath, entry.targetPath)
    : entry.localPath

  if (!existsSync(scanRoot)) {
    throw createError({ statusCode: 404, message: 'Import directory not found on disk' })
  }

  const availableSkills: { slug: string; name: string; description: string; selected: boolean }[] = []

  // Prefer skills-index.json when present so slug/metadata matches the import workflow.
  // (This also avoids a potentially expensive full markdown scan.)
  const indexPathCandidates = [
    join(entry.localPath, 'skills-index.json'),
    join(scanRoot, 'skills-index.json'),
  ]
  const indexPath = indexPathCandidates.find(p => existsSync(p))

  if (indexPath) {
    try {
      const raw = await readFile(indexPath, 'utf-8')
      const index = JSON.parse(raw) as {
        skills: Array<{
          slug: string
          name?: string
          description?: unknown
          category?: string | null
          tags?: string | string[]
          files?: string[]
          path?: string
        }>
      }

      const targetPrefix = entry.targetPath || ''

      const skills = index.skills.map(s => {
        const filePath = s.files?.[0] || s.path || ''
        return {
          slug: s.slug,
          name: s.name || s.slug,
          description: typeof s.description === 'string' ? s.description.replace(/^>\s*/, '') : '',
          filePath,
        }
      })

      const filtered = targetPrefix ? skills.filter(s => s.filePath.startsWith(targetPrefix)) : skills

      for (const s of filtered) {
        if (!s.slug) continue
        availableSkills.push({
          slug: s.slug,
          name: s.name,
          description: s.description,
          selected: entry.selectedSkills.includes(s.slug),
        })
      }

      return { entry, availableSkills: availableSkills.sort((a, b) => a.name.localeCompare(b.name)) }
    } catch {
      // Fall through to filesystem scan.
    }
  }

  // Fallback: scan for markdown skill files on disk and use frontmatter.name/description.
  // This supports repos where skills are not structured as `/<skill-slug>/SKILL.md`.
  const SKIP_FILENAMES = new Set<string>([
    'README.md', 'readme.md',
    'CHANGELOG.md', 'changelog.md',
    'CONTRIBUTING.md', 'contributing.md',
    'LICENSE.md', 'license.md',
    'CODE_OF_CONDUCT.md',
  ])

  const skipLower = new Set([...SKIP_FILENAMES].map(s => s.toLowerCase()))
  const dedup = new Map<string, { slug: string; name: string; description: string; selected: boolean }>()

  const walk = async (dir: string) => {
    const items = await readdir(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue

      const fullPath = join(dir, item.name)
      if (item.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (!item.isFile()) continue
      if (!item.name.toLowerCase().endsWith('.md')) continue
      if (skipLower.has(item.name.toLowerCase())) continue

      const raw = await readFile(fullPath, 'utf-8')
      const { frontmatter } = parseFrontmatter<SkillFrontmatter>(raw)
      if (!frontmatter.name || !frontmatter.description) continue

      const rel = relative(scanRoot, fullPath)
      const parts = rel.split(/[\\/]/).filter(Boolean)
      const fileName = parts.at(-1) || item.name
      const parentDir = parts.length >= 2 ? parts.at(-2) : undefined

      let slug = (fileName.toLowerCase() === 'skill.md' && parentDir)
        ? parentDir
        : fileName.replace(/\.md$/i, '')

      if ((slug.toLowerCase() === 'skill' || !slug) && frontmatter.name) {
        slug = frontmatter.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      }

      if (!slug) continue

      // Avoid duplicates if a repo has multiple md files representing the same skill.
      if (!dedup.has(slug)) {
        dedup.set(slug, {
          slug,
          name: frontmatter.name,
          description: frontmatter.description,
          selected: entry.selectedSkills.includes(slug),
        })
      }
    }
  }

  await walk(scanRoot)

  for (const v of dedup.values()) availableSkills.push(v)

  availableSkills.sort((a, b) => a.name.localeCompare(b.name))
  return { entry, availableSkills }
})
