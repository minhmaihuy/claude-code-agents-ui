import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import { parseFrontmatter } from '../../utils/frontmatter'
import type { Skill, SkillFrontmatter } from '~/types'

interface InstalledEntry {
  installPath: string
  [key: string]: unknown
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!existsSync(path)) return null
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export default defineEventHandler(async () => {
  const skills: Skill[] = []

  // 1. Standalone skills from ~/.claude/skills/
  const skillsDir = resolveClaudePath('skills')
  if (existsSync(skillsDir)) {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    for (const dir of entries) {
      if (!dir.isDirectory()) continue
      const skillPath = join(skillsDir, dir.name, 'SKILL.md')
      if (!existsSync(skillPath)) continue

      const raw = await readFile(skillPath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)

      skills.push({
        slug: dir.name,
        frontmatter: { name: dir.name, ...frontmatter },
        body,
        filePath: skillPath,
      })
    }
  }

  // 2. Plugin skills from installed plugins
  const installedPath = resolveClaudePath('plugins', 'installed_plugins.json')
  const installed = await readJson<{ plugins: Record<string, InstalledEntry[]> }>(installedPath)

  if (installed?.plugins) {
    for (const [pluginId, entries] of Object.entries(installed.plugins)) {
      const entry = entries[0]
      if (!entry) continue

      const pluginSkillsDir = join(entry.installPath, 'skills')
      if (!existsSync(pluginSkillsDir)) continue

      const [pluginName] = pluginId.split('@')

      const skillDirs = await readdir(pluginSkillsDir, { withFileTypes: true })
      for (const dir of skillDirs) {
        if (!dir.isDirectory()) continue
        const skillPath = join(pluginSkillsDir, dir.name, 'SKILL.md')
        if (!existsSync(skillPath)) continue

        const raw = await readFile(skillPath, 'utf-8')
        const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)

        skills.push({
          slug: dir.name,
          frontmatter: {
            name: dir.name,
            ...frontmatter,
            // Tag with plugin name as agent if not already set
            agent: frontmatter.agent || pluginName,
          },
          body,
          filePath: skillPath,
        })
      }
    }
  }

  // 3. GitHub-imported skills
  const githubDir = resolveClaudePath('github')
  if (existsSync(githubDir)) {
    const registry = await readImportsRegistry()

    for (const entry of registry.imports) {
      if (!existsSync(entry.localPath)) continue

      const scanRoot = entry.targetPath
        ? join(entry.localPath, entry.targetPath)
        : entry.localPath

      if (!existsSync(scanRoot)) continue

      /** Avoid duplicates when a GitHub skill is already visible via ~/.claude/skills symlink. */
      const slugClaimed = (slug: string) => skills.some(s => s.slug === slug)

      const shouldIncludeSkill = (slug: string) => {
        return entry.selectedSkills.includes(slug)
      }

      // Prefer skills-index.json when present so we match the same slug resolution
      // used during import/selection.
      const indexPathCandidates = [join(entry.localPath, 'skills-index.json'), join(scanRoot, 'skills-index.json')]
      const indexPath = indexPathCandidates.find(p => existsSync(p))

      if (indexPath) {
        try {
          const rawIndex = await readFile(indexPath, 'utf-8')
          const index = JSON.parse(rawIndex) as {
            skills?: Array<{
              slug: string
              name?: string
              description?: unknown
              files?: string[]
              path?: string
            }>
          }

          const targetPrefix = entry.targetPath || ''
          const indexedSkills = (index.skills || [])
            .filter(s => !!s.slug)
            .filter(s => {
              if (!targetPrefix) return true
              const filePath = s.files?.[0] || s.path || ''
              return filePath.startsWith(targetPrefix)
            })

          for (const s of indexedSkills) {
            const localSkillFilePath = join(entry.localPath, s.files?.[0] || s.path || '')
            if (!existsSync(localSkillFilePath)) continue
            if (!shouldIncludeSkill(s.slug)) continue
            if (slugClaimed(s.slug)) continue

            const raw = await readFile(localSkillFilePath, 'utf-8')
            const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)
            if (!frontmatter.name || !frontmatter.description) continue

            skills.push({
              slug: s.slug,
              frontmatter: { name: s.slug, ...frontmatter },
              body,
              filePath: localSkillFilePath,
              source: 'github',
              githubRepo: `${entry.owner}/${entry.repo}`,
            })
          }

          continue
        } catch {
          // Fall through to filesystem scan.
        }
      }

      // Fallback: scan imported repo on disk for markdown skills using frontmatter.
      // This supports repos that don't store skills as `/<slug>/SKILL.md`.
      const dedup = new Map<string, Skill>()

      const walkForSkills = async (dir: string) => {
        const dirEntries = await readdir(dir, { withFileTypes: true })
        for (const item of dirEntries) {
          if (item.name.startsWith('.')) continue

          const fullPath = join(dir, item.name)
          if (item.isDirectory()) {
            await walkForSkills(fullPath)
            continue
          }

          if (!item.isFile()) continue
          if (!item.name.toLowerCase().endsWith('.md')) continue

          // Parse only once we have a candidate skill-like markdown file.
          const raw = await readFile(fullPath, 'utf-8')
          const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)
          if (!frontmatter.name || !frontmatter.description) continue

          const rel = relative(scanRoot, fullPath)
          const parts = rel.split(/[\\/]/).filter(Boolean)
          const fileName = parts.at(-1) || item.name
          const parentDir = parts.length >= 2 ? parts.at(-2) : undefined

          const slug =
            fileName.toLowerCase() === 'skill.md' && parentDir
              ? parentDir
              : fileName.replace(/\.md$/i, '')

          if (!slug) continue
          if (!shouldIncludeSkill(slug)) continue
          if (slugClaimed(slug)) continue
          if (dedup.has(slug)) continue

          dedup.set(slug, {
            slug,
            frontmatter: { name: slug, ...frontmatter },
            body,
            filePath: fullPath,
            source: 'github',
            githubRepo: `${entry.owner}/${entry.repo}`,
          })
        }
      }

      await walkForSkills(scanRoot)
      skills.push(...dedup.values())
    }
  }

  return skills.sort((a, b) => a.slug.localeCompare(b.slug))
})
