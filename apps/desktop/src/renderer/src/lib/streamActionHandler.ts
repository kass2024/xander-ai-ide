import { StreamEvent } from './streamClient';
import { useGenerationStore } from '../stores/generationStore';
import { applyGeneratedFile, createFolderInWorkspace } from './streamFileWriter';
import { applyActionsDirectly, ActionCallbacks } from './parseActions';

/** Wraps stream events with auto-apply to workspace (production mode). */
export function createProductionStreamHandler(
  workspacePath: string,
  callbacks: ActionCallbacks,
): (event: StreamEvent) => Promise<void> {
  return async (event: StreamEvent) => {
    const { handleStreamEvent, applyFile } = useGenerationStore.getState();
    handleStreamEvent(event);

    if (event.type === 'folder_start' && event.path) {
      await createFolderInWorkspace(workspacePath, event.path);
    }

    if (event.type === 'file_complete' && event.path && event.content) {
      const result = await applyGeneratedFile(
        workspacePath,
        event.path,
        event.content,
        callbacks,
      );
      if (result.success) {
        applyFile(event.path);
      }
    }

    if (event.type === 'action' && event.action) {
      await applyActionsDirectly([event.action], workspacePath, callbacks);
    }
  };
}
