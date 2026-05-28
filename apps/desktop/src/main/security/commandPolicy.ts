const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+\/\s*$/i,
  /\brm\s+-rf\s+\/\s/i,
  /\bformat\s+[a-z]:/i,
  /\bdel\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bchmod\s+777\s+-R\s+\/\s/i,
  /\bdiskpart\b/i,
  /\bmkfs\b/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-fd/i,
];

const WARNING_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bnpm\s+publish\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+push\s+-f\b/i,
  /\btruncate\s+table\b/i,
  /\balter\s+table\b/i,
];

export function isBlockedCommand(command: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(command));
}

export function isWarningCommand(command: string): boolean {
  return WARNING_PATTERNS.some((re) => re.test(command));
}

export function validateCommand(command: string): { allowed: boolean; reason?: string; warning?: string } {
  if (!command.trim()) {
    return { allowed: false, reason: 'Empty command' };
  }
  if (isBlockedCommand(command)) {
    return { allowed: false, reason: 'This command is blocked for safety.' };
  }
  if (isWarningCommand(command)) {
    return { allowed: true, warning: 'This command may be destructive. Review carefully.' };
  }
  return { allowed: true };
}
