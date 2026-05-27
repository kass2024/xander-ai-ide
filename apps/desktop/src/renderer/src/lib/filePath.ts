/** Normalize paths for deduplication (Windows-safe). */
export function normalizeFilePath(p: string): string {
  if (!p) return '';
  let n = p.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(n)) {
    n = n[0].toLowerCase() + n.slice(1);
  }
  return n.replace(/\/+$/, '');
}

export function resolveProjectPath(projectPath: string | null | undefined, filePath: string): string {
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('/')) return filePath;
  if (!projectPath) return filePath;
  const sep = projectPath.includes('\\') ? '\\' : '/';
  return `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${filePath.replace(/\//g, sep)}`;
}

export interface OpenFileLike {
  id: string;
  filePath?: string;
  name?: string;
}

export function filePathKey(file: OpenFileLike | string): string {
  if (typeof file === 'string') return normalizeFilePath(file);
  return normalizeFilePath(file.filePath || file.id);
}

export function findOpenFile<T extends OpenFileLike>(files: T[], path: string): T | undefined {
  const key = normalizeFilePath(path);
  return files.find((f) => filePathKey(f) === key);
}

export function dedupeOpenFiles<T extends OpenFileLike>(files: T[]): T[] {
  const map = new Map<string, T>();
  for (const f of files) {
    const key = filePathKey(f);
    const canonical = (f.filePath || f.id).replace(/\//g, '\\').includes('\\')
      ? (f.filePath || f.id).replace(/\//g, '\\')
      : (f.filePath || f.id).replace(/\\/g, '/');
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...f, id: canonical, filePath: f.filePath || canonical } as T);
    } else {
      map.set(key, {
        ...existing,
        ...f,
        id: canonical.length >= (existing.filePath || existing.id).length ? canonical : (existing.filePath || existing.id),
        filePath: canonical,
      } as T);
    }
  }
  return Array.from(map.values());
}
