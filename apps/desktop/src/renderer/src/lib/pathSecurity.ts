const DANGEROUS_COMMANDS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/f\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-fd/i,
  /\bnpm\s+publish\b/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
];

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_COMMANDS.some((re) => re.test(command));
}

export function resolvePath(projectPath: string | null | undefined, filePath: string): string {
  if (!projectPath) {
    if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('/')) return filePath;
    throw new Error('Open a project folder first.');
  }
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('/')) {
    const norm = filePath.replace(/\//g, '\\').toLowerCase();
    const root = projectPath.replace(/\//g, '\\').toLowerCase();
    if (!norm.startsWith(root)) {
      throw new Error(`Path outside workspace: ${filePath}`);
    }
    return filePath;
  }
  const sep = projectPath.includes('\\') ? '\\' : '/';
  return `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${filePath.replace(/\//g, sep)}`;
}
