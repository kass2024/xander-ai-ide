/** User-facing model labels — no provider names (Cursor-style). */
export function displayModelLabel(modelId: string): string {
  if (!modelId || modelId === 'auto') return 'Auto';
  if (modelId.includes('mini') || modelId.includes('fast')) return 'Fast';
  if (modelId.includes('o3') || modelId.includes('reason')) return 'Reasoning';
  return 'Standard';
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  tier?: string;
}

/** Sanitize API model list for UI — hide Claude/Gemini/GPT branding. */
export function sanitizeModelsForUI(models: ModelOption[]): ModelOption[] {
  const seen = new Set<string>();
  const result: ModelOption[] = [];

  for (const m of models) {
    const label = displayModelLabel(m.id);
    const uiId = m.id;
    if (seen.has(uiId)) continue;
    seen.add(uiId);
    result.push({
      ...m,
      name: m.id === 'auto' ? 'Auto' : label,
      description: m.id === 'auto'
        ? 'Smart routing by task'
        : 'Balanced quality and speed',
    });
  }

  return result;
}
