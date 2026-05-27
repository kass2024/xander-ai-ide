export interface ComposerFileInput {
  path: string;
  content: string;
}

export interface ComposerChange {
  path: string;
  originalContent: string;
  newContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export function parseComposerResponse(
  result: unknown,
  sourceFiles: ComposerFileInput[],
): ComposerChange[] {
  const entries: Array<{ path: string; content: string }> = [];

  if (!result) return [];

  if (Array.isArray(result)) {
    for (const item of result) {
      if (item && typeof item === 'object' && 'path' in item && 'content' in item) {
        entries.push({ path: String((item as { path: string }).path), content: String((item as { content: string }).content) });
      }
    }
  } else   if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.changes)) {
      return (obj.changes as Array<{ path: string; content: string; originalContent?: string }>).map((c) => ({
        path: c.path,
        originalContent: c.originalContent ?? sourceFiles.find((f) => f.path.includes(c.path))?.content ?? '',
        newContent: c.content,
        status: 'pending' as const,
      }));
    }
    if (Array.isArray(obj.files)) {
      return parseComposerResponse(obj.files, sourceFiles);
    }
    for (const [path, content] of Object.entries(obj)) {
      if (path === 'changes' || path === 'files') continue;
      if (typeof content === 'string') {
        entries.push({ path, content });
      }
    }
  }

  return entries.map(({ path, content }) => {
    const normalized = path.replace(/\\/g, '/');
    const original =
      sourceFiles.find(
        (f) =>
          f.path.replace(/\\/g, '/') === normalized ||
          f.path.replace(/\\/g, '/').endsWith(normalized) ||
          normalized.endsWith(f.path.split(/[/\\]/).pop() || ''),
      )?.content ?? '';
    return {
      path,
      originalContent: original,
      newContent: content,
      status: 'pending' as const,
    };
  });
}

export function computeLineDiff(original: string, updated: string) {
  const oldLines = original.split('\n');
  const newLines = updated.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const hunks: Array<{ type: 'same' | 'add' | 'remove'; line: string; oldNum?: number; newNum?: number }> = [];

  let oi = 0;
  let ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      hunks.push({ type: 'same', line: oldLines[oi], oldNum: oi + 1, newNum: ni + 1 });
      oi++;
      ni++;
    } else if (ni < newLines.length && (oi >= oldLines.length || oldLines[oi] !== newLines[ni])) {
      hunks.push({ type: 'add', line: newLines[ni], newNum: ni + 1 });
      ni++;
    } else if (oi < oldLines.length) {
      hunks.push({ type: 'remove', line: oldLines[oi], oldNum: oi + 1 });
      oi++;
    }
  }

  const added = hunks.filter((h) => h.type === 'add').length;
  const removed = hunks.filter((h) => h.type === 'remove').length;
  return { hunks: hunks.slice(0, 200), added, removed, total: max };
}
