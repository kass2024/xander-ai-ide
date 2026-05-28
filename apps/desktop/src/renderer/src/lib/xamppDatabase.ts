/**
 * XAMPP / local MySQL helpers (Windows). Agent uses mysql CLI when available.
 */

const XAMPP_MYSQL_PATHS = [
  'C:\\xampp\\mysql\\bin\\mysql.exe',
  'C:\\xampp\\mysql\\bin\\mariadb.exe',
  'D:\\xampp\\mysql\\bin\\mysql.exe',
];

export function findXamppMysql(): string | null {
  for (const p of XAMPP_MYSQL_PATHS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fs = (window as any).electronAPI;
      if (fs?.readFile) {
        /* existence checked via terminal in runMysql */
      }
    } catch { /* ignore */ }
  }
  return XAMPP_MYSQL_PATHS[0];
}

export interface MysqlRunOptions {
  database?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
}

function escapeSqlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/** Build a safe mysql CLI command (SELECT / SHOW / DESCRIBE only for auto-run). */
export function buildMysqlCommand(sql: string, opts: MysqlRunOptions = {}): string {
  const mysql = findXamppMysql() || 'mysql';
  const user = opts.user ?? 'root';
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 3306;
  const pass = opts.password ?? '';
  const passArg = pass ? `-p"${pass.replace(/"/g, '\\"')}"` : '';
  const dbArg = opts.database ? `-D "${opts.database.replace(/"/g, '')}"` : '';
  const safeSql = sql.replace(/"/g, '\\"');
  return `"${mysql}" -h ${host} -P ${port} -u ${user} ${passArg} ${dbArg} -e "${safeSql}" 2>&1`;
}

export function isReadOnlySql(sql: string): boolean {
  const t = sql.trim().toUpperCase();
  if (/^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|GRANT|REVOKE)\b/.test(t)) {
    return false;
  }
  return /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/.test(t);
}

export async function runMysql(
  sql: string,
  opts: MysqlRunOptions = {},
): Promise<{ success: boolean; output: string }> {
  const cmd = buildMysqlCommand(sql, opts);
  const result = await window.electronAPI.terminalCommand(cmd, undefined);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const ok = result.success && (result.exitCode === 0 || result.exitCode === undefined);
  return { success: ok, output: output || '(no output)' };
}

export async function listMysqlDatabases(opts: MysqlRunOptions = {}): Promise<string> {
  const r = await runMysql('SHOW DATABASES', opts);
  return r.output;
}

export async function describeMysqlTable(
  database: string,
  table: string,
  opts: MysqlRunOptions = {},
): Promise<string> {
  const db = escapeSqlString(database);
  const tbl = escapeSqlString(table.replace(/[^a-zA-Z0-9_]/g, ''));
  const r = await runMysql(`DESCRIBE \`${tbl}\``, { ...opts, database: db });
  return r.output;
}

export async function detectXamppConfig(projectPath?: string | null): Promise<string> {
  const parts: string[] = ['## XAMPP / MySQL'];
  const mysqlPath = findXamppMysql();
  parts.push(`MySQL CLI: ${mysqlPath ?? 'not found (install XAMPP or add mysql to PATH)'}`);

  const probe = await runMysql('SHOW DATABASES');
  if (probe.success) {
    parts.push('\n### Databases\n' + probe.output);
  } else {
    parts.push(`\nCould not connect (default root@127.0.0.1:3306). ${probe.output.slice(0, 500)}`);
    parts.push('Tip: start MySQL in XAMPP Control Panel. Set password in tool args if needed.');
  }

  if (projectPath) {
    const hints = ['.env', '.env.example', 'config/database.php', 'wp-config.php'];
    for (const rel of hints) {
      try {
        const sep = projectPath.includes('\\') ? '\\' : '/';
        const full = `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${rel.replace(/\//g, sep)}`;
        const read = await window.electronAPI.readFile(full);
        if (read.success && read.content) {
          const masked = read.content.replace(
            /(password|passwd|db_pass)[^\n]*=.*/gi,
            '$1=***',
          );
          parts.push(`\n### ${rel}\n${masked.slice(0, 1500)}`);
        }
      } catch { /* skip */ }
    }
  }
  return parts.join('\n');
}
