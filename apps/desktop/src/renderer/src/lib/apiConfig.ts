/** Production endpoints — baked into packaged desktop builds (not user-editable). */
export const PRODUCTION_API_URL = 'https://api.xanderai.online';
export const PRODUCTION_WEB_URL = 'https://xanderai.online';

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/** Always use live production API unless VITE_API_URL is set explicitly. */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv) return normalizeBase(fromEnv);
  return PRODUCTION_API_URL;
}

export function getWebBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEB_URL as string | undefined;
  if (fromEnv) return normalizeBase(fromEnv);
  return PRODUCTION_WEB_URL;
}
