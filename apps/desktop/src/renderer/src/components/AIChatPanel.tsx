import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../lib/api';
import { useAgentStore } from '../stores/agentStore';
import { ComposerDiffPanel } from './ComposerDiffPanel';
import { ComposerChange, parseComposerResponse } from '../lib/composerUtils';
import { runAgent, AgentProgress } from '../lib/agentRunner';
import { buildRichContext, gatherComposerFiles, indexProjectForSearch } from '../lib/projectContext';
import { PendingActionsPanel } from './PendingActionsPanel';
import { applyActionsDirectly } from '../lib/parseActions';
import { GenerationProgressPanel, runProjectBuilder, runComposerStream } from './GenerationProgressPanel';
import { AgentInteractivePanel } from './agent/AgentInteractivePanel';
import { sanitizeModelsForUI, displayModelLabel } from '../lib/modelLabels';
import { useGenerationStore } from '../stores/generationStore';
import { isLargeProjectPrompt, streamClient } from '../lib/streamClient';
import { createProductionStreamHandler } from '../lib/streamActionHandler';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Zap, 
  Code, 
  FileText, 
  CheckCircle, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCw, 
  Plus, 
  File,
  Folder,
  Settings,
  ChevronDown,
  MoreVertical,
  Clock,
  Brain,
  Cpu,
  AlertTriangle
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'code' | 'file' | 'markdown';
  isStreaming?: boolean;
  codeBlocks?: Array<{
    language: string;
    code: string;
    explanation?: string;
  }>;
  references?: Array<{
    type: 'file' | 'folder';
    name: string;
    path: string;
  }>;
}

interface AIChatPanelProps {
  onCodeSuggestion?: (code: string) => void;
  onFileCreate?: (filename: string, content: string) => void;
  onComposerApply?: (path: string, content: string) => Promise<void>;
  onFileChanged?: (path: string) => void;
  onOpenFile?: (path: string, content: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
  currentFilePath?: string;
  selectedCode?: string;
  projectPath?: string | null;
  workspaceFolders?: string[];
  agentSessionId?: string | null;
  openFiles?: Array<{ filePath?: string; name: string; content: string }>;
  compact?: boolean;
  onWorkspaceReady?: (path: string) => void;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  tier?: string;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I\'m **Xander Assistant**.\n\n- **Chat**: Ask questions about your code\n- **Agent**: Deep project work — analyzes files, edits, tests, git commit/push\n- **Composer**: Multi-file edits with diff review\n\nAgent can open your last project or pick a folder on first run. Sign in via Settings for API access. **Tab** accepts inline suggestions.',
  timestamp: new Date(),
  type: 'markdown',
};

export function AIChatPanel({ onCodeSuggestion, onFileCreate, onComposerApply, onFileChanged, onOpenFile, onRunTerminal, onRefreshGit, onRefreshExplorer, currentFilePath, selectedCode, projectPath, workspaceFolders = [], agentSessionId, openFiles = [], compact, onWorkspaceReady }: AIChatPanelProps) {
  const { sessions, addMessage, updateSession } = useAgentStore();
  const { startGeneration, handleStreamEvent, isActive: isGenerating } = useGenerationStore();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [mode, setMode] = useState<'chat' | 'agent' | 'composer'>(compact ? 'agent' : 'chat');
  const [builderMode, setBuilderMode] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    ok: boolean;
    message: string;
    providers?: { openai: boolean; anthropic: boolean; google: boolean };
  }>({ ok: false, message: 'Checking...' });
  const [composerChanges, setComposerChanges] = useState<ComposerChange[]>([]);
  const [showComposerDiff, setShowComposerDiff] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([
    { id: 'auto', name: 'Auto', description: 'Smart routing by task', tier: 'router' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Advanced coding & agent', tier: 'premium' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast chat & autocomplete', tier: 'fast' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Fallback coding model', tier: 'fallback' },
    { id: 'o3-mini', name: 'o3-mini', description: 'Deep reasoning tasks', tier: 'reasoning' },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const buildContext = async (prompt: string) => {
    return buildRichContext({
      projectPath,
      workspaceFolders,
      currentFilePath,
      selectedCode,
      openFiles,
      prompt,
    });
  };

  useEffect(() => {
    apiClient.getModels().then((res) => {
      if (res?.models?.length) {
        const merged = [{ id: 'auto', name: 'Auto', description: 'Smart routing by task', tier: 'router' }, ...res.models.filter((m) => m.id !== 'auto')];
        setModels(sanitizeModelsForUI(merged));
      }
    }).catch(() => { /* use defaults */ });
  }, []);

  useEffect(() => {
    const check = () => streamClient.checkBackend().then((s) => setBackendStatus({
      ok: s.ok,
      message: s.message,
      providers: s.providers,
    }));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    indexProjectForSearch(projectPath).catch(() => { /* optional Qdrant indexing */ });
  }, [projectPath]);

  useEffect(() => {
    if (!agentSessionId) {
      setMessages([WELCOME]);
      return;
    }
    const session = sessions.find((s) => s.id === agentSessionId);
    if (session?.messages?.length) {
      setMessages(session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        type: 'markdown' as const,
      })));
      if (session.model) setSelectedModel(session.model);
      if (session.mode) setMode(session.mode);
    } else {
      setMessages([WELCOME]);
    }
  }, [agentSessionId, sessions]);

  const persistMessage = useCallback((sessionId: string | null | undefined, role: 'user' | 'assistant', content: string) => {
    if (!sessionId) return;
    addMessage(sessionId, { role, content });
  }, [addMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const actionCallbacks = {
    onFileChanged,
    onOpenFile,
    onRunTerminal,
    onRefreshGit,
    onRefreshExplorer,
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    const prompt = input;
    setInput('');
    setIsTyping(true);
    persistMessage(agentSessionId, 'user', prompt);
    if (agentSessionId) updateSession(agentSessionId, { mode, model: selectedModel });

    const aiResponseId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: aiResponseId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      type: 'markdown',
      isStreaming: true,
    }]);

    try {
      if (!apiClient.getToken()) {
        throw new Error('Sign in via Settings → General to use Xander Assistant.');
      }

      if (mode === 'agent') {
        const context = await buildContext(prompt);
        setAgentStatus('Agent starting...');

        const session = agentSessionId ? sessions.find((s) => s.id === agentSessionId) : null;
        const conversationId = session?.conversationId;

        const result = await runAgent({
          prompt,
          context,
          model: selectedModel === 'auto' ? undefined : selectedModel,
          conversationId,
          onProgress: (p: AgentProgress) => {
            if (p.type === 'tool_start') {
              setAgentStatus(p.message || `🔧 ${p.toolName}`);
            } else if (p.type === 'tool_done') {
              setAgentStatus(p.message || `✓ ${p.toolName}`);
            } else if (p.type === 'thinking') {
              setAgentStatus(p.message || 'Thinking...');
            }
          },
          onFileChanged: (path) => onFileChanged?.(path),
          onRefreshGit,
          onRefreshExplorer,
        });

        const toolSummary = result.toolCallsMade.length
          ? `\n\n---\n*Tools used: ${[...new Set(result.toolCallsMade)].join(', ')} (${result.stepsUsed} steps)*`
          : '';
        const content = result.content + toolSummary;

        setMessages(prev => prev.map(msg =>
          msg.id === aiResponseId ? { ...msg, content, isStreaming: false } : msg
        ));
        persistMessage(agentSessionId, 'assistant', content);
        if (agentSessionId && result.conversationId) {
          updateSession(agentSessionId, { conversationId: result.conversationId });
        }
        setAgentStatus(null);
      } else if (mode === 'composer' || builderMode || isLargeProjectPrompt(prompt)) {
        if (!projectPath) {
          throw new Error('Open a project folder first — Composer needs a workspace to write files.');
        }

        const context = await buildContext(prompt);
        const sourceFiles = mode === 'composer' && !builderMode && !isLargeProjectPrompt(prompt)
          ? await gatherComposerFiles(prompt, projectPath, openFiles)
          : [];

        const useProjectBuilder = builderMode || isLargeProjectPrompt(prompt);
        startGeneration();

        if (useProjectBuilder) {
          setAgentStatus('Project Builder: planning...');
          await runProjectBuilder(
            prompt,
            { ...context, repositoryPath: projectPath },
            selectedModel === 'auto' ? undefined : selectedModel,
            projectPath,
            actionCallbacks,
          );
          const genState = useGenerationStore.getState();
          const applied = genState.files.filter((f) => f.status === 'applied').length;
          const reply = applied > 0
            ? `**Project Builder** created ${applied} file(s) in your workspace. Check the explorer and Git panel.`
            : `**Project Builder** generated ${genState.files.length} file(s). Files are being written to workspace.`;
          setMessages(prev => prev.map(msg =>
            msg.id === aiResponseId ? { ...msg, content: reply, isStreaming: false } : msg
          ));
          persistMessage(agentSessionId, 'assistant', reply);
          onRefreshGit?.();
          onRefreshExplorer?.();
        } else {
          setAgentStatus('Composer: generating files...');
          await runComposerStream(
            prompt,
            sourceFiles,
            selectedModel === 'auto' ? undefined : selectedModel,
            projectPath,
            actionCallbacks,
          );
          const genState = useGenerationStore.getState();
          const applied = genState.files.filter((f) => f.status === 'applied').length;
          const reply = applied > 0
            ? `**Composer** applied ${applied} file change(s) to your workspace.`
            : `**Composer** streamed ${genState.files.length} file(s).`;
          setMessages(prev => prev.map(msg =>
            msg.id === aiResponseId ? { ...msg, content: reply, isStreaming: false } : msg
          ));
          persistMessage(agentSessionId, 'assistant', reply);
          onRefreshGit?.();
        }
        setAgentStatus(null);
      } else {
        const context = await buildContext(prompt);

        // Route large file-creation prompts in chat mode to project builder
        if (projectPath && isLargeProjectPrompt(prompt)) {
          startGeneration();
          setAgentStatus('Building project...');
          await runProjectBuilder(
            prompt,
            { ...context, repositoryPath: projectPath },
            selectedModel === 'auto' ? undefined : selectedModel,
            projectPath,
            actionCallbacks,
          );
          const genState = useGenerationStore.getState();
          const applied = genState.files.filter((f) => f.status === 'applied').length;
          const reply = `**Project Builder** created ${applied || genState.files.length} file(s) in your workspace.`;
          setMessages(prev => prev.map(msg =>
            msg.id === aiResponseId ? { ...msg, content: reply, isStreaming: false } : msg
          ));
          persistMessage(agentSessionId, 'assistant', reply);
          onRefreshGit?.();
          onRefreshExplorer?.();
          setAgentStatus(null);
          return;
        }

        let streamedContent = '';
        startGeneration();

        const streamHandler = projectPath
          ? createProductionStreamHandler(projectPath, actionCallbacks)
          : async (event: Parameters<ReturnType<typeof createProductionStreamHandler>>[0]) => {
              handleStreamEvent(event);
            };

        await apiClient.aiChatStream(
          prompt,
          context,
          selectedModel === 'auto' ? undefined : selectedModel,
          async (event) => {
            await streamHandler(event as Parameters<typeof streamHandler>[0]);
            if (event.type === 'text_delta' && event.delta) {
              streamedContent += event.delta as string;
              setMessages(prev => prev.map(msg =>
                msg.id === aiResponseId
                  ? { ...msg, content: streamedContent, isStreaming: true }
                  : msg
              ));
            }
          },
        );

        let content = streamedContent.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim() || streamedContent || 'No response';
        const genState = useGenerationStore.getState();
        const applied = genState.files.filter((f) => f.status === 'applied').length;
        if (applied > 0) {
          content += `\n\n✅ **${applied} file(s) created/edited** in workspace.`;
          onRefreshGit?.();
        }
        setMessages(prev => prev.map(msg =>
          msg.id === aiResponseId ? { ...msg, content, isStreaming: false } : msg
        ));
        persistMessage(agentSessionId, 'assistant', content);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'AI request failed';
      const errContent = `**Error:** ${errMsg}`;
      setMessages(prev => prev.map(msg =>
        msg.id === aiResponseId ? { ...msg, content: errContent, isStreaming: false } : msg
      ));
      persistMessage(agentSessionId, 'assistant', errContent);
      setAgentStatus(null);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyCodeSuggestion = (code: string) => {
    onCodeSuggestion?.(code);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    return (
      <div className={`flex items-start space-x-3 mb-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 shadow-sm">
          {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
        </div>
        
        <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
          <div className={`inline-block p-3 rounded-lg transition-all duration-150 ${
            isUser 
              ? 'bg-[var(--vscode-ai-userMessage)] text-white' 
              : 'bg-[var(--vscode-ai-assistantMessage)] text-[var(--vscode-foreground)]'
          }`}>
            {/* Markdown Content */}
            {message.type === 'markdown' ? (
              <div className="text-[13px] prose prose-invert max-w-none">
                {message.content.split('\n').map((line, index) => {
                  // Simple markdown parsing
                  if (line.startsWith('```')) {
                    return null; // Handle code blocks separately
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <strong key={index}>{line.slice(2, -2)}</strong>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4">{line.slice(2)}</li>;
                  }
                  if (line.match(/^\d+\./)) {
                    return <li key={index} className="ml-4 list-decimal">{line.slice(2)}</li>;
                  }
                  return <div key={index}>{line || <br />}</div>;
                })}
              </div>
            ) : (
              <div className="text-[13px] whitespace-pre-line">{message.content}</div>
            )}
            
            {/* Code Blocks */}
            {message.codeBlocks && message.codeBlocks.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.codeBlocks.map((block, index) => (
                  <div key={index} className="bg-[var(--vscode-ai-codeBackground)] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-[var(--vscode-editor-lineHighlightBackground)]">
                      <span className="text-[11px] font-mono text-[var(--vscode-descriptionForeground)] font-medium">
                        {block.language}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyToClipboard(block.code)}
                          className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150"
                        >
                          <Copy className="w-3.5 h-3.5 text-[var(--vscode-foreground)]" />
                        </button>
                        <button
                          onClick={() => applyCodeSuggestion(block.code)}
                          className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-[var(--vscode-foreground)]" />
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 text-[11px] font-mono overflow-x-auto">
                      <code>{block.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
            
            {/* Streaming Indicator */}
            {message.isStreaming && (
              <div className="flex items-center mt-2 text-[11px] text-[var(--vscode-ai-streaming)]">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse mr-2"></div>
                <span className="streaming-text">AI is thinking...</span>
              </div>
            )}
          </div>
          
          {/* Message Actions */}
          {!isUser && !message.isStreaming && (
            <div className="flex items-center justify-end mt-2 space-x-1.5">
              <button className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150">
                <ThumbsUp className="w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)]" />
              </button>
              <button className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150">
                <ThumbsDown className="w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)]" />
              </button>
              <button className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150">
                <RefreshCw className="w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)]" />
              </button>
            </div>
          )}
          
          <div className={`text-[11px] text-[var(--vscode-descriptionForeground)] mt-1.5 ${isUser ? 'text-right' : ''} font-medium`}>
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  const handleComposerAccept = async (path: string) => {
    const change = composerChanges.find((c) => c.path === path);
    if (!change || !onComposerApply) return;
    await onComposerApply(path, change.newContent);
    setComposerChanges((prev) =>
      prev.map((c) => (c.path === path ? { ...c, status: 'accepted' as const } : c)),
    );
  };

  const handleComposerReject = (path: string) => {
    setComposerChanges((prev) =>
      prev.map((c) => (c.path === path ? { ...c, status: 'rejected' as const } : c)),
    );
  };

  const handleComposerAcceptAll = async () => {
    for (const change of composerChanges.filter((c) => c.status === 'pending')) {
      await handleComposerAccept(change.path);
    }
  };

  const handleComposerRejectAll = () => {
    setComposerChanges((prev) => prev.map((c) => ({ ...c, status: 'rejected' as const })));
  };

  return (
    <div className={`h-full flex flex-col relative ${mode === 'agent' ? 'agent-shell' : 'bg-[var(--vscode-ai-background)] border-l border-[var(--vscode-ai-border)]'}`}>
      {mode !== 'agent' && (
      <>
      {/* Header — chat / composer / builder */}
      <div className="p-4 border-b border-[var(--vscode-ai-border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[var(--vscode-foreground)] flex items-center">
            <Sparkles className="w-4 h-4 mr-2 text-[var(--vscode-ai-streaming)]" />
            Xander Assistant
          </h3>
          <div className="flex gap-1">
            <button onClick={() => { setMode('chat'); setBuilderMode(false); }} className={`px-2 py-0.5 text-[10px] rounded ${mode === 'chat' && !builderMode ? 'bg-blue-600 text-white' : 'border border-[var(--vscode-border)]'}`}>Chat</button>
            <button onClick={() => { setMode('agent'); setBuilderMode(false); }} className={`px-2 py-0.5 text-[10px] rounded ${mode === 'agent' ? 'bg-blue-600 text-white' : 'border border-[var(--vscode-border)]'}`}>Agent</button>
            <button onClick={() => { setMode('composer'); setBuilderMode(false); }} className={`px-2 py-0.5 text-[10px] rounded ${mode === 'composer' ? 'bg-blue-600 text-white' : 'border border-[var(--vscode-border)]'}`}>Composer</button>
            <button onClick={() => { setMode('composer'); setBuilderMode(true); }} className={`px-2 py-0.5 text-[10px] rounded ${builderMode ? 'bg-purple-600 text-white' : 'border border-[var(--vscode-border)]'}`} title="Full project generation">Builder</button>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <label className="text-[11px] text-[var(--vscode-descriptionForeground)]">Model:</label>
          <div className="relative flex-1">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center px-3 py-1.5 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md text-[12px]"
            >
              {displayModelLabel(selectedModel)}
              <ChevronDown className="w-3 h-3 ml-2" />
            </button>
            {showModelMenu && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] rounded-md shadow-lg z-50 min-w-[180px]">
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelMenu(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--vscode-list-hoverBackground)]"
                  >
                    <div className="font-medium">{displayModelLabel(m.id)}</div>
                    <div className="text-[10px] opacity-60">{m.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!backendStatus.ok && (
            <span className="text-[10px] text-red-400" title={backendStatus.message}>Offline</span>
          )}
        </div>
      </div>
      </>
      )}

      {mode === 'agent' && !compact && (
        <div className="cursor-agent-tabs px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
          <button onClick={() => setMode('chat')} className="cursor-tab">Chat</button>
          <button className="cursor-tab cursor-tab-active">Agent</button>
          <button onClick={() => setMode('composer')} className="cursor-tab">Composer</button>
          <button onClick={() => { setMode('composer'); setBuilderMode(true); }} className="cursor-tab">Builder</button>
          <span className="ml-auto flex items-center gap-1.5">
            {!backendStatus.ok && <span className="w-2 h-2 rounded-full bg-red-500" title="Offline" />}
          </span>
        </div>
      )}

      {!projectPath && (builderMode || mode === 'composer') && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-orange-900/30 border border-orange-600/30 text-[11px] text-orange-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Open a folder for Composer/Builder, or Agent will prompt when you send a task.
        </div>
      )}

      {currentFilePath && mode !== 'agent' && (
        <div className="px-4 py-2 border-b border-[var(--vscode-ai-border)] text-[11px] text-[var(--vscode-descriptionForeground)] flex items-center gap-2">
          <File className="w-3.5 h-3.5" />
          Context: {currentFilePath.split(/[/\\]/).pop()}
        </div>
      )}

      {mode === 'agent' ? (
        <AgentInteractivePanel
          projectPath={projectPath ?? null}
          workspaceFolders={workspaceFolders}
          currentFilePath={currentFilePath}
          selectedCode={selectedCode}
          openFiles={openFiles}
          agentSessionId={agentSessionId}
          selectedModel={selectedModel}
          models={models}
          onModelChange={setSelectedModel}
          backendOk={backendStatus.ok}
          compact={compact}
          onFileChanged={onFileChanged}
          onOpenFile={onOpenFile}
          onRunTerminal={onRunTerminal}
          onRefreshGit={onRefreshGit}
          onRefreshExplorer={onRefreshExplorer}
          onWorkspaceReady={onWorkspaceReady}
        />
      ) : (
        <>
      {agentStatus && (
        <div className="px-4 py-2 border-b border-[var(--vscode-ai-border)] bg-[var(--vscode-editor-lineHighlightBackground)]">
          <div className="text-[11px] text-[var(--vscode-ai-streaming)] flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
            <span className="font-medium">{agentStatus}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(message => (
          <div key={message.id}>
            {renderMessage(message)}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="inline-block p-3 rounded-lg bg-[var(--vscode-ai-assistantMessage)]">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-[var(--vscode-ai-streaming)] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[var(--vscode-ai-streaming)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-[var(--vscode-ai-streaming)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--vscode-ai-border)]">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                builderMode
                  ? 'Describe a full project to generate — e.g. "Create a shoe shop management system in PHP"...'
                  : mode === 'composer'
                      ? 'Describe multi-file changes or full features...'
                      : 'Ask Xander Assistant...'
              }
              className="w-full px-3 py-2.5 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md resize-none focus:outline-none focus:border-[var(--vscode-focusBorder)] placeholder-[var(--vscode-input-placeholderForeground)] text-[13px] transition-all duration-150"
              rows={3}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-3 py-2.5 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-md hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-2.5 flex items-center font-medium">
          <Clock className="w-3 h-3 mr-1.5" />
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
        </>
      )}

      {showComposerDiff && composerChanges.length > 0 && (
        <ComposerDiffPanel
          changes={composerChanges}
          onAccept={handleComposerAccept}
          onReject={handleComposerReject}
          onAcceptAll={handleComposerAcceptAll}
          onRejectAll={handleComposerRejectAll}
          onClose={() => setShowComposerDiff(false)}
        />
      )}

      <PendingActionsPanel
        workspacePath={projectPath ?? null}
        onFileChanged={onFileChanged}
        onRunTerminal={onRunTerminal}
        onRefreshGit={onRefreshGit}
      />

      <GenerationProgressPanel
        workspacePath={projectPath ?? null}
        onFileChanged={onFileChanged}
        onOpenFile={onOpenFile}
        onRunTerminal={onRunTerminal}
        onRefreshGit={onRefreshGit}
        onRefreshExplorer={onRefreshExplorer}
      />
    </div>
  );
}
