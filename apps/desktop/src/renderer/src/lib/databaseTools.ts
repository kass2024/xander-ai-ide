/**
 * Database / migration helpers for Laravel, plain PHP, and Node projects.
 */

export interface MigrationSpec {
  table: string;
  action: 'create' | 'alter';
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    unique?: boolean;
    default?: string;
    references?: string;
  }>;
  indexes?: string[];
}

function slug(name: string): string {
  return name.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function detectDbStack(stacks: string[]): 'laravel' | 'php' | 'node' | 'unknown' {
  if (stacks.includes('laravel')) return 'laravel';
  if (stacks.includes('php')) return 'php';
  if (stacks.includes('nodejs')) return 'node';
  return 'unknown';
}

export function generateLaravelMigration(spec: MigrationSpec, reversible = true): { up: string; down: string; filename: string } {
  const cols = spec.columns
    .map((c) => {
      let line = `$table->${c.type}('${c.name}')`;
      if (c.nullable) line += '->nullable()';
      if (c.unique) line += '->unique()';
      if (c.default != null) line += `->default('${c.default}')`;
      if (c.references) line += `->constrained()`;
      return `            ${line};`;
    })
    .join('\n');

  const up =
    spec.action === 'create'
      ? `Schema::create('${spec.table}', function (Blueprint $table) {\n            $table->id();\n${cols}\n            $table->timestamps();\n        });`
      : `Schema::table('${spec.table}', function (Blueprint $table) {\n${cols}\n        });`;

  const down =
    spec.action === 'create' && reversible
      ? `Schema::dropIfExists('${spec.table}');`
      : `// Reverse alter manually if needed`;

  const filename = `${timestamp()}_${spec.action}_${slug(spec.table)}_table.php`;
  const php = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        ${up}
    }

    public function down(): void
    {
        ${down}
    }
};
`;

  return { up: php, down, filename: `database/migrations/${filename}` };
}

export function generatePlainSqlMigration(spec: MigrationSpec): { up: string; down: string; filename: string } {
  const colDefs = spec.columns.map((c) => {
    let def = `\`${c.name}\` ${c.type.toUpperCase()}`;
    if (!c.nullable) def += ' NOT NULL';
    if (c.unique) def += ' UNIQUE';
    if (c.default != null) def += ` DEFAULT '${c.default}'`;
    return def;
  });

  const up =
    spec.action === 'create'
      ? `CREATE TABLE IF NOT EXISTS \`${spec.table}\` (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  ${colDefs.join(',\n  ')},\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP\n);`
      : spec.columns.map((c) => `ALTER TABLE \`${spec.table}\` ADD COLUMN ${c.name} ${c.type};`).join('\n');

  const down =
    spec.action === 'create'
      ? `DROP TABLE IF EXISTS \`${spec.table}\`;`
      : `-- Rollback: ALTER TABLE \`${spec.table}\` DROP COLUMN ...`;

  const filename = `${timestamp()}_${spec.action}_${slug(spec.table)}.sql`;
  return {
    up: `-- Up migration\n${up}`,
    down: `-- Down migration\n${down}`,
    filename: `database/sql/${filename}`,
  };
}

export function parseMigrationArgs(args: Record<string, unknown>): MigrationSpec | null {
  try {
    const table = String(args.table || args.table_name || '');
    if (!table) return null;
    const action = (args.action === 'alter' ? 'alter' : 'create') as 'create' | 'alter';
    const rawCols = args.columns;
    let columns: MigrationSpec['columns'] = [];
    if (Array.isArray(rawCols)) {
      columns = rawCols.map((c: Record<string, unknown>) => ({
        name: String(c.name || ''),
        type: String(c.type || 'string'),
        nullable: !!c.nullable,
        unique: !!c.unique,
        default: c.default != null ? String(c.default) : undefined,
        references: c.references ? String(c.references) : undefined,
      }));
    } else if (typeof rawCols === 'string') {
      columns = JSON.parse(rawCols);
    }
    return { table, action, columns };
  } catch {
    return null;
  }
}
