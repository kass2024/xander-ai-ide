import React from 'react';
import { AgentSidebar } from '../components/agent/AgentSidebar';
import { AgentInteractivePanel } from '../components/agent/AgentInteractivePanel';
import { useAgentStore } from '../stores/agentStore';
import { sanitizeModelsForUI } from '../lib/modelLabels';
import { useState, useEffect } from 'react';
import apiClient from '../lib/api';

interface AgentPageProps {
  projectPath: string | null;
  workspaceFolders?: string[];
  currentFilePath?: string;
  selectedCode?: string;
  openFiles?: Array<{ filePath?: string; name: string; content: string }>;
  onFileChanged?: (path: string) => void;
  onOpenFile?: (path: string, content: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
  onWorkspaceReady?: (path: string) => void;
  onNewAgentWindow?: () => void;
}

export function AgentPage({
  projectPath,
  workspaceFolders = [],
  currentFilePath,
  selectedCode,
  openFiles = [],
  onFileChanged,
  onOpenFile,
  onRunTerminal,
  onRefreshGit,
  onRefreshExplorer,
  onWorkspaceReady,
  onNewAgentWindow,
}: AgentPageProps) {
  const { activeSessionId, createSession, setActiveSession } = useAgentStore();
  const [selectedModel, setSelectedModel] = useState('auto');
  const [models, setModels] = useState(sanitizeModelsForUI([]));
  const [backendOk, setBackendOk] = useState(true);

  useEffect(() => {
    apiClient.getModels?.()
      .then((m) => setModels(sanitizeModelsForUI(m?.models || m || [])))
      .catch(() => setBackendOk(false));
  }, []);

  const handleNewAgent = () => {
    const id = createSession('New Agent', 'agent', projectPath || undefined);
    setActiveSession(id);
  };

  return (
    <div className="agent-page h-full flex min-h-0 bg-[#121212]">
      <div className="w-64 shrink-0">
        <AgentSidebar
          projectPath={projectPath}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSession}
          onNewAgent={handleNewAgent}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0 agent-shell">
        <AgentInteractivePanel
          agentSessionId={activeSessionId}
          projectPath={projectPath}
          workspaceFolders={workspaceFolders}
          openFiles={openFiles}
          currentFilePath={currentFilePath}
          selectedCode={selectedCode}
          selectedModel={selectedModel}
          models={models}
          onModelChange={setSelectedModel}
          backendOk={backendOk}
          compact
          onFileChanged={onFileChanged}
          onOpenFile={onOpenFile}
          onRunTerminal={onRunTerminal}
          onRefreshGit={onRefreshGit}
          onRefreshExplorer={onRefreshExplorer}
          onWorkspaceReady={onWorkspaceReady}
        />
      </div>
      {onNewAgentWindow && (
        <button
          type="button"
          className="sr-only"
          aria-hidden
          onClick={onNewAgentWindow}
        />
      )}
    </div>
  );
}
