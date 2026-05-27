import apiClient from './api';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingId = 0;

export interface AutocompleteContext {
  prefix: string;
  suffix: string;
  filename: string;
  language: string;
}

export async function fetchAICompletion(ctx: AutocompleteContext): Promise<string | null> {
  if (!apiClient.getToken()) return null;
  try {
    const result = await apiClient.aiAutocomplete(ctx);
    const text = result.completion?.trim();
    if (!text || text.length > 500) return null;
    return text;
  } catch {
    return null;
  }
}

export function debouncedAICompletion(ctx: AutocompleteContext, delayMs = 350): Promise<string | null> {
  return new Promise((resolve) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const id = ++pendingId;
    debounceTimer = setTimeout(async () => {
      const result = await fetchAICompletion(ctx);
      if (id === pendingId) resolve(result);
    }, delayMs);
  });
}

export function cancelPendingAutocomplete() {
  if (debounceTimer) clearTimeout(debounceTimer);
  pendingId++;
}
