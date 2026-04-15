import { useRuntimeConfig } from '#imports'

export interface AnthropicRoutingEnv {
  ANTHROPIC_BASE_URL?: string
  ANTHROPIC_AUTH_TOKEN?: string
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string
}

export function getAnthropicRoutingEnv(): AnthropicRoutingEnv {
  const config = useRuntimeConfig()

  return {
    ...(config.anthropicBaseUrl ? { ANTHROPIC_BASE_URL: config.anthropicBaseUrl } : {}),
    ...(config.anthropicAuthToken ? { ANTHROPIC_AUTH_TOKEN: config.anthropicAuthToken } : {}),
    ...(config.anthropicDefaultOpusModel ? { ANTHROPIC_DEFAULT_OPUS_MODEL: config.anthropicDefaultOpusModel } : {}),
    ...(config.anthropicDefaultSonnetModel ? { ANTHROPIC_DEFAULT_SONNET_MODEL: config.anthropicDefaultSonnetModel } : {}),
    ...(config.anthropicDefaultHaikuModel ? { ANTHROPIC_DEFAULT_HAIKU_MODEL: config.anthropicDefaultHaikuModel } : {}),
  }
}

export function withEnv<T>(fn: () => T): T {
  const env = getAnthropicRoutingEnv()
  const previous: Record<string, string | undefined> = {}

  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key]
    if (value) {
      process.env[key] = value
    }
  }

  try {
    return fn()
  } finally {
    for (const key of Object.keys(env)) {
      const oldValue = previous[key]
      if (oldValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = oldValue
      }
    }
  }
}
