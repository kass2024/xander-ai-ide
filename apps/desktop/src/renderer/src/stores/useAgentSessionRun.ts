import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAgentRunStore, EMPTY_SESSION_RUN, type ToolStepStatus } from './agentRunStore';

/** Per-session agent run state — multi-agent safe. */
export function useAgentSessionRun(sessionId: string | null | undefined) {
  const sid = sessionId || '_default';

  const slice = useAgentRunStore(
    useShallow((s) => {
      const run = s.runs[sid] ?? EMPTY_SESSION_RUN;
      return {
        blocks: run.blocks,
        isRunning: run.isRunning,
        edits: run.edits,
        showFilesList: run.showFilesList,
      };
    }),
  );

  const actions = useMemo(() => {
    const store = () => useAgentRunStore.getState();
    return {
      resetRun: () => store().resetRun(sid),
      startRun: (prompt: string, imagePreviews?: string[]) => store().startRun(sid, prompt, imagePreviews),
      endRun: () => store().endRun(sid),
      setStatus: (message: string, loading?: boolean) => store().setStatus(sid, message, loading),
      clearStatus: () => store().clearStatus(sid),
      addActivity: (message: string, opts?: { toolName?: string }) => store().addActivity(sid, message, opts),
      addScreenshotAnalysis: (content: string) => store().addScreenshotAnalysis(sid, content),
      addExplored: (path: string) => store().addExplored(sid, path),
      addSearch: () => store().addSearch(sid),
      flushExplored: () => store().flushExplored(sid),
      addFileDiff: (path: string, original: string, updated: string) =>
        store().addFileDiff(sid, path, original, updated),
      addTerminal: (command: string, output: string, success: boolean, exitCode?: number) =>
        store().addTerminal(sid, command, output, success, exitCode),
      addText: (content: string) => store().addText(sid, content),
      addError: (message: string) => store().addError(sid, message),
      startToolStep: (toolName: string, label: string, detail?: string) =>
        store().startToolStep(sid, toolName, label, detail),
      finishToolStep: (stepId: string, status: ToolStepStatus, detail?: string) =>
        store().finishToolStep(sid, stepId, status, detail),
      addApprovalBlock: (opts: Parameters<ReturnType<typeof store>['addApprovalBlock']>[1]) =>
        store().addApprovalBlock(sid, opts),
      removeApprovalBlock: (blockId: string) => store().removeApprovalBlock(sid, blockId),
      toggleDiff: (blockId: string) => store().toggleDiff(sid, blockId),
      toggleFilesList: () => store().toggleFilesList(sid),
      undoAll: (projectPath: string) => store().undoAll(sid, projectPath),
      getEditedFileCount: () => store().getEditedFileCount(sid),
      isSessionRunning: (id: string) => store().isSessionRunning(id),
    };
  }, [sid]);

  return { sessionId: sid, ...slice, ...actions };
}
