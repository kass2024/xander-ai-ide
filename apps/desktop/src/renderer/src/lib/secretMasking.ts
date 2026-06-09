/** Mask secrets before sending tool output or context to the LLM / UI. */

const SECRET_PATTERNS: Array<{ key: RegExp; mask: string }> = [
  { key: /OPENAI_API_KEY\s*=\s*[^\s\n]+/gi, mask: 'OPENAI_API_KEY=[REDACTED]' },
  { key: /ANTHROPIC_API_KEY\s*=\s*[^\s\n]+/gi, mask: 'ANTHROPIC_API_KEY=[REDACTED]' },
  { key: /GEMINI_API_KEY\s*=\s*[^\s\n]+/gi, mask: 'GEMINI_API_KEY=[REDACTED]' },
  { key: /GOOGLE_API_KEY\s*=\s*[^\s\n]+/gi, mask: 'GOOGLE_API_KEY=[REDACTED]' },
  { key: /DB_PASSWORD\s*=\s*[^\s\n]+/gi, mask: 'DB_PASSWORD=[REDACTED]' },
  { key: /DATABASE_PASSWORD\s*=\s*[^\s\n]+/gi, mask: 'DATABASE_PASSWORD=[REDACTED]' },
  { key: /POSTGRES_PASSWORD\s*=\s*[^\s\n]+/gi, mask: 'POSTGRES_PASSWORD=[REDACTED]' },
  { key: /MYSQL_PASSWORD\s*=\s*[^\s\n]+/gi, mask: 'MYSQL_PASSWORD=[REDACTED]' },
  { key: /JWT_SECRET\s*=\s*[^\s\n]+/gi, mask: 'JWT_SECRET=[REDACTED]' },
  { key: /STRIPE_SECRET[_\w]*\s*=\s*[^\s\n]+/gi, mask: 'STRIPE_SECRET=[REDACTED]' },
  { key: /sk-[a-zA-Z0-9]{20,}/g, mask: 'sk-[REDACTED]' },
  { key: /sk_live_[a-zA-Z0-9]+/g, mask: 'sk_live_[REDACTED]' },
  { key: /sk-ant-[a-zA-Z0-9\-]+/g, mask: 'sk-ant-[REDACTED]' },
  { key: /AIza[a-zA-Z0-9_\-]{20,}/g, mask: 'AIza[REDACTED]' },
  { key: /whsec_[a-zA-Z0-9]+/g, mask: 'whsec_[REDACTED]' },
  { key: /(password|passwd|secret|api[_-]?key)\s*[:=]\s*['"]?[^'"\s\n]{8,}/gi, mask: '$1=[REDACTED]' },
];

export function maskSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { key, mask } of SECRET_PATTERNS) {
    out = out.replace(key, mask);
  }
  return out;
}
