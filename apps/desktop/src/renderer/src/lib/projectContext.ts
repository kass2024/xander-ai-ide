import { getSemanticContextForQuery } from './codebaseSearch';
import { analyzeProject, formatAnalysisForAgent } from './projectAnalyzer';
import { useCodebaseIndexStore } from '../stores/codebaseIndexStore';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.php', '.cs',
  '.json', '.md', '.sql', '.yaml', '.yml', '.html', '.css', '.scss', '.vue',
  '.env', '.toml', '.xml', '.sh', '.bat', '.cmd',
]);

const IGNORED = new Set([
  'node_modules', 'vendor', '.git', 'dist', 'build', '.next', 'release', 'out',
  '.cache', 'coverage', 'storage', 'logs', 'uploads', 'tmp', 'temp',
]);

export interface WorkspaceContext {
  currentFile?: string;
  currentFileContent?: string;
  selectedText?: string;
  repositoryPath?: string | null;
  workspaceFolders?: string[];
  openFiles?: string[];
  projectTree?: string;
  projectSummary?: string;
  directoryListing?: string;
  semanticContext?: string;
  agentMode?: string;
}

function resolvePath(projectPath: string | null | undefined, filePath: string): string {
  if (!projectPath) return filePath;
  if (/^[A-Za-z]:[\\\/]/.test(filePath) || filePath.startsWith('/')) return filePath;
  const sep = projectPath.includes('\\') ? '\\' : '/';
  return `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${filePath.replace(/\//g, sep)}`;
}

export async function buildProjectTree(projectPath: string, maxDepth = 3): Promise<string> {
  const api = window.electronAPI;
  if (!api?.listFiles) return '';

  async function walk(dir: string, depth: number, prefix = ''): Promise<string[]> {
    if (depth > maxDepth) return [];
    const result = await api.listFiles(dir);
    if (!result.success || !result.files) return [];

    const lines: string[] = [];
    const sorted = [...result.files].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const f of sorted) {
      if (IGNORED.has(f.name)) continue;
      lines.push(`${prefix}${f.isDirectory ? '📁 ' : '   '}${f.name}`);
      if (f.isDirectory && depth < maxDepth) {
        const sub = await walk(f.path, depth + 1, prefix + '  ');
        lines.push(...sub);
      }
    }
    return lines;
  }

  const lines = await walk(projectPath, 0);
  return lines.slice(0, 150).join('\n');
}

export async function buildRichContext(options: {
  projectPath?: string | null;
  workspaceFolders?: string[];
  currentFilePath?: string;
  selectedCode?: string;
  openFiles?: Array<{ filePath?: string; name: string; content: string }>;
  prompt?: string;
}): Promise<WorkspaceContext> {
  const { projectPath, workspaceFolders = [], currentFilePath, selectedCode, openFiles = [], prompt } = options;
  const api = window.electronAPI;

  let currentFileContent: string | undefined;
  if (currentFilePath && api?.readFile) {
    const open = openFiles.find((f) => f.filePath === currentFilePath);
    if (open?.content) {
      const lines = open.content.split('\n');
      currentFileContent = lines.length > 300
        ? lines.slice(0, 300).join('\n') + `\n... (${lines.length - 300} more lines)`
        : open.content;
    } else {
      const result = await api.readFile(currentFilePath);
      if (result.success && result.content) {
        const lines = result.content.split('\n');
        currentFileContent = lines.length > 300
          ? lines.slice(0, 300).join('\n') + `\n... (${lines.length - 300} more lines)`
          : result.content;
      }
    }
  }

  let projectTree: string | undefined;
  let projectSummary: string | undefined;
  if (projectPath) {
    projectTree = await buildProjectTree(projectPath);
    try {
      const analysis = await analyzeProject(projectPath);
      projectSummary = formatAnalysisForAgent(analysis);
    } catch {
      /* optional project analysis */
    }
  }

  let directoryListing: string | undefined;
  if (prompt && api?.listFiles) {
    const wantsListing = /list\s+files|files\s+in|show\s+files|directory|folder|structure|tree/i.test(prompt);
    if (wantsListing && projectPath) {
      const result = await api.listFiles(projectPath);
      if (result.success && result.files?.length) {
        directoryListing = `${projectPath}:\n${result.files
          .map((f) => (f.isDirectory ? `[dir]  ${f.name}` : `       ${f.name}`))
          .join('\n')}`;
      }
    }
  }

  return {
    currentFile: currentFilePath,
    currentFileContent,
    selectedText: selectedCode,
    repositoryPath: projectPath,
    workspaceFolders: workspaceFolders.length ? workspaceFolders : projectPath ? [projectPath] : [],
    openFiles: openFiles.map((f) => f.filePath || f.name).filter(Boolean),
    projectTree,
    projectSummary,
    directoryListing,
    semanticContext: prompt && projectPath && useCodebaseIndexStore.getState().status === 'ready'
      ? await getSemanticContextForQuery(prompt, 6)
      : undefined,
  };
}

export async function gatherComposerFiles(
  instruction: string,
  projectPath: string | null | undefined,
  openFiles: Array<{ filePath?: string; name: string; content: string }>,
  maxFiles = 20,
): Promise<Array<{ path: string; content: string }>> {
  const api = window.electronAPI;
  const files = new Map<string, string>();

  for (const f of openFiles) {
    if (f.filePath) files.set(f.filePath, f.content);
  }

  if (!projectPath || !api) {
    return Array.from(files.entries()).map(([path, content]) => ({ path, content }));
  }

  const keywords = instruction
    .toLowerCase()
    .match(/\b[a-z_][a-z0-9_]{2,}\b/g)
    ?.filter((w) => !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'file', 'code', 'fix', 'add', 'update', 'create', 'make', 'change'].includes(w))
    .slice(0, 5) ?? [];

  for (const keyword of keywords) {
    const search = await api.searchInProject(projectPath, keyword);
    if (search.success && search.results) {
      for (const hit of search.results.slice(0, 8)) {
        if (files.size >= maxFiles) break;
        if (files.has(hit.path)) continue;
        const ext = hit.path.slice(hit.path.lastIndexOf('.')).toLowerCase();
        if (!CODE_EXTENSIONS.has(ext)) continue;
        const read = await api.readFile(hit.path);
        if (read.success && read.content && read.content.length < 100_000) {
          files.set(hit.path, read.content);
        }
      }
    }
  }

  if (files.size < 3 && api.walkProjectFiles) {
    const walk = await api.walkProjectFiles(projectPath);
    if (walk.success && walk.files) {
      for (const f of walk.files) {
        if (files.size >= maxFiles) break;
        if (f.isDirectory || files.has(f.path)) continue;
        const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
        if (!CODE_EXTENSIONS.has(ext)) continue;
        const read = await api.readFile(f.path);
        if (read.success && read.content && read.content.length < 50_000) {
          files.set(f.path, read.content);
        }
      }
    }
  }

  return Array.from(files.entries()).map(([path, content]) => ({ path, content }));
}

export { resolvePath };
export { indexProjectForSearch } from './codebaseSearch';
