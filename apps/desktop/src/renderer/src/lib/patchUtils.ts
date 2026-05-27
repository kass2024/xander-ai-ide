/**
 * Safe file patching with in-memory backups for Undo All.
 */

export interface FileBackup {
  path: string;
  content: string;
  timestamp: number;
}

const backupStore = new Map<string, FileBackup>();

export function snapshotBeforeEdit(projectPath: string, relativePath: string, content: string): void {
  const key = `${projectPath}::${relativePath.replace(/\\/g, '/')}`;
  if (!backupStore.has(key)) {
    backupStore.set(key, { path: relativePath, content, timestamp: Date.now() });
  }
}

export function getBackup(projectPath: string, relativePath: string): string | undefined {
  const key = `${projectPath}::${relativePath.replace(/\\/g, '/')}`;
  return backupStore.get(key)?.content;
}

export function clearBackups(projectPath?: string): void {
  if (!projectPath) {
    backupStore.clear();
    return;
  }
  const prefix = `${projectPath}::`;
  for (const k of [...backupStore.keys()]) {
    if (k.startsWith(prefix)) backupStore.delete(k);
  }
}

export function getAllBackups(projectPath: string): FileBackup[] {
  const prefix = `${projectPath}::`;
  return [...backupStore.entries()]
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v);
}

/** Apply unified-diff style or search-replace patch to content. */
export function applyPatch(original: string, patch: string): string {
  if (!patch.trim()) return original;

  // SEARCH/REPLACE blocks (Cursor-style)
  const searchReplace = patch.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g);
  if (searchReplace) {
    let result = original;
    for (const block of searchReplace) {
      const m = block.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
      if (m) {
        const search = m[1];
        const replace = m[2];
        if (result.includes(search)) {
          result = result.replace(search, replace);
        }
      }
    }
    return result;
  }

  // Line-based unified diff
  if (patch.includes('@@') || patch.split('\n').some((l) => l.startsWith('+') || l.startsWith('-'))) {
    return applyUnifiedDiff(original, patch);
  }

  // Whole-file replacement hint
  if (patch.startsWith('---') || patch.startsWith('+++')) {
    return applyUnifiedDiff(original, patch);
  }

  return patch;
}

function applyUnifiedDiff(original: string, patch: string): string {
  const lines = original.split('\n');
  const patchLines = patch.split('\n');
  const result: string[] = [];
  let origIdx = 0;

  for (const pl of patchLines) {
    if (pl.startsWith('@@')) continue;
    if (pl.startsWith('+') && !pl.startsWith('+++')) {
      result.push(pl.slice(1));
    } else if (pl.startsWith('-') && !pl.startsWith('---')) {
      origIdx++;
    } else if (pl.startsWith(' ')) {
      result.push(lines[origIdx] ?? pl.slice(1));
      origIdx++;
    } else if (!pl.startsWith('---') && !pl.startsWith('+++')) {
      result.push(pl);
    }
  }

  while (origIdx < lines.length) {
    result.push(lines[origIdx++]);
  }

  return result.join('\n');
}

export function computeChangedLineRanges(
  original: string,
  updated: string,
): { added: number; removed: number; hunks: Array<{ type: 'add' | 'remove' | 'same'; line: string; oldNum?: number; newNum?: number }> } {
  const oLines = original.split('\n');
  const nLines = updated.split('\n');
  const hunks: Array<{ type: 'add' | 'remove' | 'same'; line: string; oldNum?: number; newNum?: number }> = [];
  let added = 0;
  let removed = 0;

  const max = Math.max(oLines.length, nLines.length);
  for (let i = 0; i < max; i++) {
    const o = oLines[i];
    const n = nLines[i];
    if (o === n) {
      if (o !== undefined) hunks.push({ type: 'same', line: o, oldNum: i + 1, newNum: i + 1 });
    } else if (o === undefined && n !== undefined) {
      added++;
      hunks.push({ type: 'add', line: n, newNum: i + 1 });
    } else if (n === undefined && o !== undefined) {
      removed++;
      hunks.push({ type: 'remove', line: o, oldNum: i + 1 });
    } else {
      removed++;
      added++;
      hunks.push({ type: 'remove', line: o!, oldNum: i + 1 });
      hunks.push({ type: 'add', line: n!, newNum: i + 1 });
    }
  }

  return { added, removed, hunks: hunks.slice(0, 200) };
}
