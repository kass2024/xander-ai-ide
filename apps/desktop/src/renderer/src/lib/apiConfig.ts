/** Production endpoints — baked into packaged desktop builds (not user-editable). */
export const PRODUCTION_API_URL = 'https://api.xanderai.online';
export const PRODUCTION_WEB_URL = 'https://xanderai.online';

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/** Packaged app always uses production API. Dev uses localhost unless VITE_API_URL is set. */
export function getApiBaseUrl(): string {
  if (import.meta.env.PROD) return PRODUCTION_API_URL;
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv) return normalizeBase(fromEnv);
  return 'http://localhost:3001';
}

export function getWebBaseUrl(): string {
  if (import.meta.env.PROD) return PRODUCTION_WEB_URL;
  const fromEnv = import.meta.env.VITE_WEB_URL as string | undefined;
  if (fromEnv) return normalizeBase(fromEnv);
  return 'http://localhost:3000';
}
