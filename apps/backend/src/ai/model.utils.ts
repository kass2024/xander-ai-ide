const MODEL_ALIASES: Record<string, string> = {
  auto: 'gpt-4o',
  'gpt-5.1': 'gpt-4o',
  'gpt-5.1-mini': 'gpt-4o-mini',
  'gpt-4.1': 'gpt-4o',
  'gpt-4.1-mini': 'gpt-4o-mini',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-20250514',
  'claude-sonnet-4.5': 'claude-sonnet-4-20250514',
  'gemini-2.5-pro-preview-05-06': 'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  // Retired June 2026 — map old IDs to current stable models
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite-001': 'gemini-2.5-flash-lite',
};

const GEMINI_ALIASES: Record<string, string> = {
  'gemini-2.5-pro-preview-05-06': 'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite-001': 'gemini-2.5-flash-lite',
};

const GEMINI_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
] as const;

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const FALLBACK_CHAIN = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] as const;

export function normalizeOpenAIKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (trimmed.startsWith('sk-')) return trimmed;
  if (trimmed.startsWith('k-proj-')) return `s${trimmed}`;
  return trimmed;
}

export function resolveOpenAIModel(
  requested: string | undefined,
  tier: 'agent' | 'fast',
  defaults: { agent: string; fast: string },
): string {
  if (!requested || requested === 'auto') {
    return tier === 'fast' ? defaults.fast : defaults.agent;
  }
  return MODEL_ALIASES[requested] || requested;
}

export function getModelFallbacks(primary: string): string[] {
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const model of [primary, ...FALLBACK_CHAIN]) {
    if (!seen.has(model)) {
      seen.add(model);
      chain.push(model);
    }
  }
  return chain;
}

/** Map deprecated Gemini model IDs to currently available models. */
export function resolveGeminiModel(requested?: string, configuredDefault?: string): string {
  const base = configuredDefault || DEFAULT_GEMINI_MODEL;
  if (!requested || requested === 'auto') {
    return GEMINI_ALIASES[base] || base;
  }
  return GEMINI_ALIASES[requested] || requested;
}

export function getGeminiFallbacks(primary: string): string[] {
  const resolved = resolveGeminiModel(primary);
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const model of [resolved, ...GEMINI_FALLBACK_CHAIN]) {
    if (!seen.has(model)) {
      seen.add(model);
      chain.push(model);
    }
  }
  return chain;
}

export function formatOpenAIError(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; status?: number; error?: { message?: string } };
    if (err.error?.message) return err.error.message;
    if (err.message) return err.message;
  }
  return 'Failed to generate AI response';
}
