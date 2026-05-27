import { FileItem } from '../../types';

export type GitStatus = FileItem['gitStatus'];

export function pathSep(base: string): string {
  return base.includes('\\') ? '\\' : '/';
}

export function joinPath(base: string, name: string): string {
  const sep = pathSep(base);
  return `${base}${base.endsWith(sep) ? '' : sep}${name}`;
}

export function parentDir(filePath: string): string {
  return filePath.replace(/[/\\][^/\\]+$/, '');
}

export function sortFileItems(items: FileItem[]): FileItem[] {
  return [...items].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function mapGitIndex(status: string): GitStatus {
  if (status === 'M' || status === '?') return status === '?' ? 'untracked' : 'modified';
  if (status === 'A' || status === '??') return 'added';
  if (status === 'D') return 'deleted';
  if (status === 'R') return 'renamed';
  return 'modified';
}

export function buildGitStatusMap(
  files: Array<{ path: string; index: string; working_dir: string }>,
  projectPath: string,
): Map<string, GitStatus> {
  const map = new Map<string, GitStatus>();
  const sep = pathSep(projectPath);
  for (const f of files) {
    const full = `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${f.path.replace(/\//g, sep)}`;
    const code = f.working_dir !== ' ' ? f.working_dir : f.index;
    if (code && code !== ' ') map.set(full, mapGitIndex(code));
  }
  return map;
}

export function applyGitToTree(items: FileItem[], gitMap: Map<string, GitStatus>): FileItem[] {
  return items.map((item) => {
    const gitStatus = gitMap.get(item.path);
    const next: FileItem = gitStatus ? { ...item, gitStatus } : { ...item, gitStatus: undefined };
    if (item.children?.length) next.children = applyGitToTree(item.children, gitMap);
    return next;
  });
}

export function updateTreeAtPath(
  items: FileItem[],
  dirPath: string,
  children: FileItem[],
): FileItem[] {
  return items.map((item) => {
    if (item.path === dirPath) return { ...item, children: sortFileItems(children) };
    if (item.isDirectory && item.children && dirPath.startsWith(item.path + pathSep(item.path))) {
      return { ...item, children: updateTreeAtPath(item.children, dirPath, children) };
    }
    return item;
  });
}

export function flattenFiles(items: FileItem[]): FileItem[] {
  const out: FileItem[] = [];
  const walk = (nodes: FileItem[]) => {
    for (const n of nodes) {
      if (n.isDirectory && n.children) walk(n.children);
      else if (!n.isDirectory) out.push(n);
    }
  };
  walk(items);
  return out;
}

export function removeFromTree(items: FileItem[], targetPath: string): FileItem[] {
  return items
    .filter((item) => item.path !== targetPath)
    .map((item) =>
      item.children ? { ...item, children: removeFromTree(item.children, targetPath) } : item,
    );
}
