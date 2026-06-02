import { existsSync } from 'fs';
import { join } from 'path';

/** Repo root (xander-ai-ide/) — works from apps/backend/dist after nest build. */
export function getRepoRoot(): string {
  return join(__dirname, '..', '..', '..');
}

/** Env files in load order; later files override earlier (NestJS ConfigModule). */
export function getEnvFilePaths(): string[] {
  const repoRoot = getRepoRoot();
  const backendRoot = join(__dirname, '..', '..');

  const candidates = [
    join(backendRoot, '.env'),
    join(repoRoot, '.env.production'),
    join(repoRoot, '.env.linux'),
  ];

  return candidates.filter((p) => existsSync(p));
}
