import { resolvePath } from './projectContext';

function maskSecrets(text: string): string {
  return text.replace(
    /^(\s*(?:DATABASE_URL|DB_PASSWORD|POSTGRES_PASSWORD|MYSQL_PASSWORD|REDIS_URL|API_KEY|SECRET)[^\n=]*=).+$/gim,
    '$1***',
  );
}

function truncate(text: string, max = 6000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... (${text.length - max} more chars)`;
}

/** Read DB-related config from the workspace (no live DB connection). */
export async function inspectDatabase(projectPath: string): Promise<string> {
  const api = window.electronAPI;
  const sections: string[] = [`Project: ${projectPath}`];

  const filesToRead = [
    'prisma/schema.prisma',
    'prisma.config.js',
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'docker-compose.yaml',
    '.env.example',
    'DATABASE_SETUP.md',
  ];

  for (const rel of filesToRead) {
    try {
      const full = resolvePath(projectPath, rel);
      const read = await api.readFile(full);
      if (!read.success || read.content == null) continue;
      const body = rel.includes('.env') ? maskSecrets(read.content) : read.content;
      sections.push(`### ${rel}\n\`\`\`\n${truncate(body, 5000)}\n\`\`\``);
    } catch {
      /* missing file */
    }
  }

  const migrationDirs = [
    'database/migrations',
    'prisma/migrations',
    'db/migrate',
  ];
  for (const rel of migrationDirs) {
    try {
      const full = resolvePath(projectPath, rel);
      const list = await api.listFiles(full);
      if (!list.success || !list.files?.length) continue;
      const names = list.files
        .filter((f) => !f.isDirectory)
        .slice(0, 30)
        .map((f) => f.name)
        .join('\n  ');
      sections.push(`### ${rel}\n  ${names}${list.files.length > 30 ? '\n  ...' : ''}`);
    } catch {
      /* skip */
    }
  }

  if (sections.length === 1) {
    sections.push(
      'No standard DB config found. Check package.json scripts, ORM folders, and .env.example. Use run_terminal for `npx prisma validate` or migration status when applicable.',
    );
  }

  return sections.join('\n\n');
}
