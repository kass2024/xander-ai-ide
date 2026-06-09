import { analyzeProject, formatAnalysisForAgent } from './projectAnalyzer';
import { buildProjectTree } from './projectContext';
import { maskSecrets } from './secretMasking';
import type { AgentProgress } from './agentRunner';

/** Run real local scans before the LLM — agent must not start blind. */
export async function bootstrapAgentContext(
  projectPath: string,
  prompt: string,
  onProgress?: (p: AgentProgress) => void,
): Promise<{ projectSummary: string; projectTree: string; stacks: string[] }> {
  onProgress?.({ type: 'phase', phase: 'analyzing' });
  onProgress?.({ type: 'activity', message: 'Detecting project path and stack…' });

  let stacks: string[] = [];
  let projectSummary = '';
  try {
    const analysis = await analyzeProject(projectPath);
    stacks = analysis.stacks;
    projectSummary = formatAnalysisForAgent(analysis);
    onProgress?.({ type: 'activity', message: `Detected: ${stacks.join(', ') || 'unknown stack'} (${analysis.fileCount} files)` });
  } catch (e) {
    projectSummary = `Project at ${projectPath} (analysis failed: ${e instanceof Error ? e.message : 'error'})`;
  }

  onProgress?.({ type: 'activity', message: 'Scanning folder structure…' });
  let projectTree = '';
  try {
    projectTree = await buildProjectTree(projectPath, 4);
    if (projectTree) {
      projectTree = maskSecrets(projectTree);
      const lines = projectTree.split('\n').length;
      onProgress?.({ type: 'activity', message: `Indexed ${lines} entries in project tree` });
    }
  } catch { /* optional */ }

  return { projectSummary, projectTree, stacks };
}
