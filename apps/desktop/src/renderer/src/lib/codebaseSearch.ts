import apiClient from './api';
import { useCodebaseIndexStore } from '../stores/codebaseIndexStore';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.php', '.cs',
  '.json', '.md', '.sql', '.yaml', '.yml', '.html', '.css', '.scss', '.vue',
  '.env', '.toml', '.xml', '.sh', '.bat', '.cmd',
]);

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'release', 'out', '.cache', 'coverage']);

const CHUNK_SIZE = 1200;
const BATCH_SIZE = 80;
const MAX_FILES = 300;

export interface SemanticSearchHit {
  path: string;
  content: string;
  score?: number;
}

export async function checkSemanticSearchAvailable(): Promise<boolean> {
  if (!apiClient.getToken()) return false;
  try {
    const res = await apiClient.repoHealth();
    useCodebaseIndexStore.getState().setQdrantAvailable(!!res.qdrant);
    return !!res.qdrant;
  } catch {
    useCodebaseIndexStore.getState().setQdrantAvailable(false);
    return false;
  }
}

export async function indexProjectForSearch(
  projectPath: string,
  options?: { force?: boolean; onProgress?: (pct: number, msg: string) => void },
): Promise<{ success: boolean; chunksIndexed?: number; filesScanned?: number; message?: string }> {
  const store = useCodebaseIndexStore.getState();
  const api = window.electronAPI;

  if (!api?.walkProjectFiles || !api.readFile) {
    return { success: false, message: 'File system API unavailable' };
  }
  if (!apiClient.getToken()) {
    return { success: false, message: 'Sign in to enable semantic search' };
  }

  const qdrantOk = await checkSemanticSearchAvailable();
  if (!qdrantOk) {
    store.setStatus('unavailable', 'Qdrant not configured on backend. Set QDRANT_URL in backend .env');
    return { success: false, message: 'Semantic search unavailable — start Qdrant on port 6333' };
  }

  if (
    !options?.force &&
    store.projectPath === projectPath &&
    store.status === 'ready' &&
    store.lastIndexedAt &&
    Date.now() - new Date(store.lastIndexedAt).getTime() < 3600_000
  ) {
    return { success: true, chunksIndexed: store.chunksIndexed, message: 'Using cached index' };
  }

  store.setProject(projectPath);
  store.setStatus('indexing', 'Scanning project files...');
  options?.onProgress?.(5, 'Scanning project files...');

  const walk = await api.walkProjectFiles(projectPath);
  if (!walk.success || !walk.files) {
    store.setError('Failed to walk project files');
    return { success: false, message: 'Failed to scan project' };
  }

  const codeFiles = walk.files.filter((f) => {
    if (f.isDirectory || IGNORED.has(f.name)) return false;
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    return CODE_EXTENSIONS.has(ext);
  }).slice(0, MAX_FILES);

  const allChunks: Array<{ path: string; content: string; chunkIndex: number }> = [];

  for (let i = 0; i < codeFiles.length; i++) {
    const f = codeFiles[i];
    const pct = 5 + Math.round((i / codeFiles.length) * 40);
    store.setProgress(pct, `Reading ${f.name} (${i + 1}/${codeFiles.length})`);
    options?.onProgress?.(pct, `Reading ${f.name}...`);

    const read = await api.readFile(f.path);
    if (!read.success || !read.content || read.content.length > 512_000) continue;

    const relativePath = f.path.replace(projectPath, '').replace(/^[/\\]/, '') || f.name;
    for (let j = 0; j < read.content.length; j += CHUNK_SIZE) {
      allChunks.push({
        path: relativePath,
        content: read.content.slice(j, j + CHUNK_SIZE),
        chunkIndex: Math.floor(j / CHUNK_SIZE),
      });
    }
  }

  if (allChunks.length === 0) {
    store.setError('No indexable code files found');
    return { success: false, message: 'No code files to index' };
  }

  let totalIndexed = 0;
  const batches = Math.ceil(allChunks.length / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const batch = allChunks.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const pct = 45 + Math.round(((b + 1) / batches) * 50);
    store.setProgress(pct, `Embedding batch ${b + 1}/${batches}...`);
    options?.onProgress?.(pct, `Embedding batch ${b + 1}/${batches}...`);

    try {
      const res = await apiClient.indexRepoChunks(projectPath, batch);
      totalIndexed += res.chunksIndexed ?? batch.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Indexing failed';
      store.setError(msg);
      return { success: false, message: msg };
    }
  }

  store.setResult({ chunksIndexed: totalIndexed, filesScanned: codeFiles.length });
  options?.onProgress?.(100, `Indexed ${totalIndexed} chunks from ${codeFiles.length} files`);

  return { success: true, chunksIndexed: totalIndexed, filesScanned: codeFiles.length };
}

export async function semanticSearch(
  query: string,
  limit = 10,
): Promise<SemanticSearchHit[]> {
  if (!apiClient.getToken()) return [];
  try {
    const available = await checkSemanticSearchAvailable();
    if (!available) return [];

    const res = await apiClient.searchRepo(query, limit);
    return (res.results || []).map((r) => ({
      path: String(r.path || ''),
      content: String(r.content || ''),
      score: r.score,
    }));
  } catch {
    return [];
  }
}

export async function getSemanticContextForQuery(
  query: string,
  limit = 6,
): Promise<string | undefined> {
  const hits = await semanticSearch(query, limit);
  if (!hits.length) return undefined;
  return hits
    .map((h) => `File: ${h.path}${h.score != null ? ` (relevance: ${h.score.toFixed(3)})` : ''}\n${h.content}`)
    .join('\n---\n');
}
