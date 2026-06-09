import { analyzeProject, formatAnalysisForAgent } from './projectAnalyzer';

const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  summary: string;
  fileCount: number;
  at: number;
}

const summaryCache = new Map<string, CacheEntry>();
const treeCache = new Map<string, { tree: string; at: number }>();

export async function getCachedProjectSummary(projectPath: string): Promise<string | undefined> {
  const hit = summaryCache.get(projectPath);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.summary;
  try {
    const analysis = await analyzeProject(projectPath);
    const summary = formatAnalysisForAgent(analysis);
    summaryCache.set(projectPath, { summary, fileCount: analysis.fileCount, at: Date.now() });
    return summary;
  } catch {
    return hit?.summary;
  }
}

export function peekProjectSummary(projectPath: string): string | undefined {
  const hit = summaryCache.get(projectPath);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.summary;
  return undefined;
}

export function getCachedTree(projectPath: string): string | undefined {
  const hit = treeCache.get(projectPath);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tree;
  return undefined;
}

export function setCachedTree(projectPath: string, tree: string): void {
  treeCache.set(projectPath, { tree, at: Date.now() });
}

export function invalidateProjectCache(projectPath: string): void {
  summaryCache.delete(projectPath);
  treeCache.delete(projectPath);
}
