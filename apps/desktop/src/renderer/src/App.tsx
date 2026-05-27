import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { TitleBar } from './components/TitleBar';
import { ActivityBar } from './components/ActivityBar';
import { FileExplorer } from './components/FileExplorer';
import type { MonacoEditorHandle } from './components/MonacoEditor';
import { EditorTabs } from './components/EditorTabs';
import { AIChatPanel } from './components/AIChatPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { BottomPanel, BottomPanelHandle, BottomPanelTab } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { GitPanel } from './components/GitPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SearchPanel } from './components/SearchPanel';
import { AgentsPanel } from './components/AgentsPanel';
import { useProjectStore } from './stores/projectStore';
import { joinPath } from './lib/fileTree';
import { dedupeOpenFiles, findOpenFile, filePathKey, resolveProjectPath } from './lib/filePath';
import { getElectronAPI } from './lib/electron';
import { useAuthStore } from './stores/authStore';
import { useBillingStore } from './stores/billingStore';
import { useAgentStore } from './stores/agentStore';
import { useCodebaseIndexStore } from './stores/codebaseIndexStore';
import { indexProjectForSearch } from './lib/codebaseSearch';
import apiClient from './lib/api';
import { MenuActionId } from './lib/menuActions';
import { FileItem } from '../types';
import './styles/theme.css';

const MonacoEditor = lazy(() =>
  import('./components/MonacoEditor').then((m) => ({ default: m.MonacoEditor })),
);

interface OpenFile {
  id: string;
  name: string;
  content: string;
  language: string;
  isDirty?: boolean;
  filePath?: string;
}

function App() {
  const [activeView, setActiveView] = useState('explorer');
  const [activeTab, setActiveTab] = useState('');
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('terminal');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [problems] = useState({ errors: 0, warnings: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [showGoToFile, setShowGoToFile] = useState(false);
  const [goToFileQuery, setGoToFileQuery] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({});
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);

  const isAgentWindow = typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('agentWindow') === '1');

  const editorRef = useRef<MonacoEditorHandle>(null);
  const bottomPanelRef = useRef<BottomPanelHandle>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    currentProject, setCurrentProject, files, loading, workspaceFolders,
    loadRoot, addWorkspaceFolder, loadFolderChildren, refreshTree, refreshGitStatus, refreshParentOf,
    allProjectFiles, loadingDirs,
  } = useProjectStore();
  const { loadSession } = useAuthStore();
  const { subscription, fetchAll } = useBillingStore();
  const { createSession, setActiveSession } = useAgentStore();
  const indexStatus = useCodebaseIndexStore((s) => s.status);
  const indexChunks = useCodebaseIndexStore((s) => s.chunksIndexed);

  useEffect(() => {
    loadSession().then(() => fetchAll());
    window.electronAPI?.windowIsMaximized().then(setIsMaximized);

    window.electronAPI?.onFileChanged((path) => {
      refreshParentOf(path);
      setOpenFiles((prev) => prev.map((f) => {
        if (f.filePath === path && f.isDirty === false) {
          window.electronAPI.readFile(path).then((r) => {
            if (r.success && r.content !== undefined) {
              setOpenFiles((p) => p.map((x) => x.id === f.id ? { ...x, content: r.content! } : x));
            }
          });
        }
        return f;
      }));
    });
    window.electronAPI?.onFileAdded((path) => refreshParentOf(path));
    window.electronAPI?.onFileDeleted((path) => {
      refreshParentOf(path);
      setOpenFiles((prev) => prev.filter((f) => f.filePath !== path));
    });

    return () => {
      window.electronAPI?.removeAllListeners('file-changed');
      window.electronAPI?.removeAllListeners('file-added');
      window.electronAPI?.removeAllListeners('file-deleted');
    };
  }, []);

  useEffect(() => {
    if (currentProject && apiClient.getToken()) {
      indexProjectForSearch(currentProject).catch(() => { /* optional */ });
    }
  }, [currentProject]);

  useEffect(() => {
    if (activeView === 'terminal') {
      setShowBottomPanel(true);
      setBottomPanelTab('terminal');
    }
    if (activeView === 'settings') {
      setShowSettings(true);
      setSettingsTab('general');
      setActiveView('explorer');
    }
  }, [activeView]);

  const loadFiles = async (projectPath: string) => {
    await loadRoot(projectPath);
  };

  const handleFolderToggle = async (folderPath: string) => {
    const isExpanded = expandedFolders.has(folderPath);
    setExpandedFolders((prev) => {
      const s = new Set(prev);
      if (s.has(folderPath)) s.delete(folderPath);
      else s.add(folderPath);
      return s;
    });
    if (!isExpanded) await loadFolderChildren(folderPath);
  };

  const pushNavHistory = (filePath: string) => {
    setNavHistory((prev) => {
      const next = prev.slice(0, navIndex + 1);
      if (next[next.length - 1] !== filePath) next.push(filePath);
      return next.slice(-50);
    });
    setNavIndex((i) => Math.min(i + 1, 49));
  };

  const openOrFocusFile = useCallback((
    filePath: string,
    content: string,
    options?: { isDirty?: boolean; activate?: boolean },
  ) => {
    const fullPath = resolveProjectPath(currentProject, filePath);
    const name = fullPath.split(/[/\\]/).pop() || fullPath;
    const activate = options?.activate !== false;

    setOpenFiles((prev) => {
      const deduped = dedupeOpenFiles(prev);
      const existing = findOpenFile(deduped, fullPath);
      if (existing) {
        return dedupeOpenFiles(deduped.map((f) =>
          filePathKey(f) === filePathKey(fullPath)
            ? {
                ...f,
                id: fullPath,
                filePath: fullPath,
                name,
                content,
                isDirty: options?.isDirty ?? f.isDirty,
              }
            : f,
        ));
      }
      return dedupeOpenFiles([...deduped, {
        id: fullPath,
        name,
        content,
        language: getFileLanguage(name),
        filePath: fullPath,
        isDirty: options?.isDirty ?? false,
      }]);
    });
    if (activate) setActiveTab(fullPath);
  }, [currentProject]);

  const openFileByPath = async (filePath: string, trackNav = true) => {
    const fullPath = resolveProjectPath(currentProject, filePath);
    const result = await window.electronAPI.readFile(fullPath);
    if (!result.success || result.content === undefined) return;
    openOrFocusFile(fullPath, result.content!, { isDirty: false });
    if (trackNav) pushNavHistory(fullPath);
  };

  const handleOpenProject = async () => {
    const projectPath = await window.electronAPI.openProjectDialog();
    if (!projectPath) return;
    const result = await window.electronAPI.openProject(projectPath);
    if (result.success) {
      setCurrentProject(projectPath);
      await loadFiles(projectPath);
      setExpandedFolders(new Set([projectPath]));
    }
  };

  const handleAddFolderToWorkspace = async () => {
    const folderPath = await window.electronAPI.openProjectDialog();
    if (!folderPath) return;
    const result = await window.electronAPI.openProject(folderPath);
    if (!result.success) return;
    if (!currentProject) {
      setCurrentProject(folderPath);
      await loadFiles(folderPath);
      setExpandedFolders(new Set([folderPath]));
      return;
    }
    await addWorkspaceFolder(folderPath);
    setExpandedFolders((prev) => new Set([...prev, folderPath]));
  };

  const handleOpenFile = async () => {
    const filePath = await window.electronAPI.openFileDialog();
    if (filePath) await openFileByPath(filePath);
  };

  const handleNewFile = async () => {
    const base = currentProject || '';
    const name = `untitled-${Date.now()}.txt`;
    const filePath = base ? joinPath(base, name) : name;
    setOpenFiles((prev) => [...prev, {
      id: filePath,
      name,
      content: '',
      language: 'plaintext',
      filePath: base ? filePath : undefined,
      isDirty: true,
    }]);
    setActiveTab(filePath);
  };

  const handleSave = async (fileId?: string) => {
    const targetId = fileId || activeTab;
    const file = openFiles.find((f) => f.id === targetId);
    if (!file) return;
    await window.electronAPI.writeFile(file.id, file.content);
    setOpenFiles((prev) => prev.map((f) => f.id === targetId ? { ...f, isDirty: false } : f));
  };

  const handleSaveAs = async () => {
    const file = openFiles.find((f) => f.id === activeTab);
    if (!file) return;
    const newPath = await window.electronAPI.saveAsDialog(file.filePath || file.name);
    if (!newPath) return;
    await window.electronAPI.writeFile(newPath, file.content);
    const name = newPath.split(/[/\\]/).pop() || newPath;
    setOpenFiles((prev) => prev.map((f) =>
      f.id === file.id ? { ...f, id: newPath, name, filePath: newPath, isDirty: false } : f
    ));
    setActiveTab(newPath);
  };

  const handleSaveAll = async () => {
    for (const file of openFiles.filter((f) => f.isDirty)) {
      await handleSave(file.id);
    }
  };

  const handleFileSelect = async (file: FileItem) => {
    if (file.isDirectory) return;
    await openFileByPath(file.path);
  };

  const handleFileSave = handleSave;

  const handleEditorChange = (fileId: string, content: string) => {
    setOpenFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, content, isDirty: true } : f));
    if (autoSave) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => handleSave(fileId), 800);
    }
  };

  const getRunCommand = (filePath: string): string | null => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const q = `"${filePath}"`;
    switch (ext) {
      case 'py': return `python ${q}`;
      case 'js': return `node ${q}`;
      case 'ts': return `npx ts-node ${q}`;
      case 'ps1': return `powershell -File ${q}`;
      case 'bat':
      case 'cmd': return q;
      default: return null;
    }
  };

  const handleTabClose = (fileId: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeTab === fileId) {
      const remaining = openFiles.filter((f) => f.id !== fileId);
      setActiveTab(remaining[0]?.id || '');
    }
  };

  const handleOpenGeneratedFile = (relativePath: string, content: string) => {
    openOrFocusFile(relativePath, content, { isDirty: true });
  };

  const handleComposerApply = async (relativePath: string, content: string) => {
    const fullPath = resolveProjectPath(currentProject, relativePath);
    await window.electronAPI.writeFile(fullPath, content);
    openOrFocusFile(fullPath, content, { isDirty: false });
    bottomPanelRef.current?.appendOutput(`[Composer] Applied ${relativePath}`);
    refreshTree();
  };

  const handleAgentFileChanged = async (filePath: string) => {
    const fullPath = resolveProjectPath(currentProject, filePath);
    const read = await window.electronAPI.readFile(fullPath);
    if (!read.success || read.content === undefined) return;
    openOrFocusFile(fullPath, read.content!, { isDirty: false });
    bottomPanelRef.current?.appendOutput(`[Agent] Updated ${fullPath.split(/[/\\]/).pop() || fullPath}`);
  };

  const toggleBreakpoint = (filePath: string, line: number) => {
    setBreakpoints((prev) => {
      const existing = prev[filePath] || [];
      const has = existing.includes(line);
      return {
        ...prev,
        [filePath]: has ? existing.filter((l) => l !== line) : [...existing, line].sort((a, b) => a - b),
      };
    });
  };

  const handleGitAction = async (action: 'pull' | 'push' | 'commit') => {
    if (!currentProject) {
      bottomPanelRef.current?.appendOutput('[Git] Open a folder first');
      setShowBottomPanel(true);
      setBottomPanelTab('output');
      return;
    }
    if (action === 'pull') {
      const r = await window.electronAPI.gitPull(currentProject);
      bottomPanelRef.current?.appendOutput(r.success ? '[Git] Pull complete' : `[Git] Pull failed: ${r.error}`);
    } else if (action === 'push') {
      const r = await window.electronAPI.gitPush(currentProject);
      bottomPanelRef.current?.appendOutput(r.success ? '[Git] Push complete' : `[Git] Push failed: ${r.error}`);
    } else {
      const msg = prompt('Commit message:');
      if (msg) {
        const r = await window.electronAPI.gitCommit(currentProject, msg);
        bottomPanelRef.current?.appendOutput(r.success ? `[Git] Committed: ${msg}` : `[Git] Commit failed: ${r.error}`);
      }
    }
    setShowBottomPanel(true);
    setBottomPanelTab('output');
  };

  const handleMenuAction = useCallback(async (action: MenuActionId) => {
    const file = openFiles.find((f) => f.id === activeTab);
    switch (action) {
      case 'file.newFile': await handleNewFile(); break;
      case 'file.newWindow': await window.electronAPI.windowNew(); break;
      case 'file.newAgentsWindow': await window.electronAPI.windowNewAgent(); break;
      case 'file.openFile': await handleOpenFile(); break;
      case 'file.openFolder': await handleOpenProject(); break;
      case 'file.addFolderToWorkspace': await handleAddFolderToWorkspace(); break;
      case 'file.save': await handleSave(); break;
      case 'file.saveAs': await handleSaveAs(); break;
      case 'file.saveAll': await handleSaveAll(); break;
      case 'file.revertFile': {
        if (file?.filePath) {
          const r = await window.electronAPI.readFile(file.filePath);
          if (r.success && r.content !== undefined) {
            handleEditorChange(file.id, r.content);
            setOpenFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, isDirty: false } : f));
          }
        }
        break;
      }
      case 'file.autoSave': setAutoSave((v) => !v); break;
      case 'file.closeEditor': if (activeTab) handleTabClose(activeTab); break;
      case 'file.closeWindow':
      case 'file.exit': await window.electronAPI.windowClose(); break;
      case 'edit.undo': editorRef.current?.undo(); break;
      case 'edit.redo': editorRef.current?.redo(); break;
      case 'edit.cut': editorRef.current?.cut(); break;
      case 'edit.copy': editorRef.current?.copy(); break;
      case 'edit.paste': editorRef.current?.paste(); break;
      case 'edit.find': editorRef.current?.find(); break;
      case 'edit.replace': editorRef.current?.replace(); break;
      case 'edit.findInFiles': setActiveView('search'); setShowSidebar(true); break;
      case 'edit.commandPalette': setShowCommandPalette(true); break;
      case 'selection.selectAll': editorRef.current?.selectAll(); break;
      case 'selection.expandSelection': editorRef.current?.expandSelection(); break;
      case 'view.toggleExplorer': setShowSidebar(true); setActiveView('explorer'); break;
      case 'view.toggleSearch': setShowSidebar(true); setActiveView('search'); break;
      case 'view.toggleAgents': setShowSidebar(true); setActiveView('agents'); setShowChat(true); break;
      case 'view.toggleAI': setShowChat((v) => !v); break;
      case 'view.toggleTerminal': setShowBottomPanel(true); setBottomPanelTab('terminal'); bottomPanelRef.current?.focusTerminal(); break;
      case 'view.toggleProblems': setShowBottomPanel(true); setBottomPanelTab('problems'); break;
      case 'view.toggleOutput': setShowBottomPanel(true); setBottomPanelTab('output'); break;
      case 'view.settings': setShowSettings(true); setSettingsTab('general'); break;
      case 'go.goToFile': setShowGoToFile(true); break;
      case 'go.goToSymbol': editorRef.current?.goToSymbol(); break;
      case 'go.goBack': {
        if (navIndex > 0) {
          const path = navHistory[navIndex - 1];
          setNavIndex(navIndex - 1);
          await openFileByPath(path, false);
        }
        break;
      }
      case 'go.goForward': {
        if (navIndex < navHistory.length - 1) {
          const path = navHistory[navIndex + 1];
          setNavIndex(navIndex + 1);
          await openFileByPath(path, false);
        }
        break;
      }
      case 'run.runFile':
      case 'terminal.runActiveFile': {
        if (file?.filePath) {
          const cmd = getRunCommand(file.filePath);
          if (cmd) {
            setShowBottomPanel(true);
            setBottomPanelTab('terminal');
            bottomPanelRef.current?.runInTerminal(cmd);
            bottomPanelRef.current?.appendOutput(`[Run] ${cmd}`);
          } else {
            bottomPanelRef.current?.appendOutput(`[Run] No runner for ${file.name}`);
            setShowBottomPanel(true);
            setBottomPanelTab('output');
          }
        }
        break;
      }
      case 'terminal.runSelectedText': {
        const sel = editorRef.current?.getSelectedText();
        if (sel?.trim()) {
          setShowBottomPanel(true);
          setBottomPanelTab('terminal');
          bottomPanelRef.current?.runInTerminal(sel.trim());
        }
        break;
      }
      case 'terminal.runBuildTask':
        setShowBottomPanel(true);
        setBottomPanelTab('terminal');
        bottomPanelRef.current?.runInTerminal('npm run build');
        break;
      case 'terminal.runTask': {
        const task = prompt('Task command (e.g. npm test):');
        if (task) {
          setShowBottomPanel(true);
          setBottomPanelTab('terminal');
          bottomPanelRef.current?.runInTerminal(task);
        }
        break;
      }
      case 'run.startDebug': {
        setShowBottomPanel(true);
        setBottomPanelTab('debug');
        const configRes = await window.electronAPI.debugGetLaunchConfigs(currentProject || '');
        const configs = configRes.configs || [];
        const config = configs[0] || {
          name: 'Debug Current File',
          type: 'node',
          request: 'launch',
        };
        const bps = currentFile?.filePath ? breakpoints[currentFile.filePath] : [];
        if (bps?.length) {
          bottomPanelRef.current?.appendDebug(`[Debug] Breakpoints: ${bps.join(', ')}`);
        }
        const startRes = await window.electronAPI.debugStart(
          currentProject || '',
          config,
          currentFile?.filePath,
        );
        if (!startRes.success) {
          bottomPanelRef.current?.appendDebug(`[Debug] ${startRes.error}`);
        }
        break;
      }
      case 'run.stop':
        await window.electronAPI.debugStop();
        bottomPanelRef.current?.appendDebug('[Debug] Stopped');
        bottomPanelRef.current?.killTerminal();
        break;
      case 'terminal.new': bottomPanelRef.current?.newTerminal(); setShowBottomPanel(true); setBottomPanelTab('terminal'); break;
      case 'terminal.split': bottomPanelRef.current?.splitTerminal(); setShowBottomPanel(true); setBottomPanelTab('terminal'); break;
      case 'terminal.clear': bottomPanelRef.current?.clearTerminal(); break;
      case 'terminal.kill': bottomPanelRef.current?.killTerminal(); break;
      case 'terminal.selectProfile': {
        const profile = prompt('Shell profile (powershell, cmd, or full path):', 'powershell');
        if (profile) {
          const shell = profile === 'cmd' ? 'cmd.exe' : profile === 'powershell' ? 'powershell.exe' : profile;
          await window.electronAPI.terminalCreate(currentProject || undefined, shell);
          bottomPanelRef.current?.newTerminal();
        }
        break;
      }
      case 'git.pull': await handleGitAction('pull'); break;
      case 'git.push': await handleGitAction('push'); break;
      case 'git.commit': await handleGitAction('commit'); break;
      case 'git.createBranch': {
        if (!currentProject) break;
        const name = prompt('New branch name:');
        if (name) {
          const r = await window.electronAPI.gitCreateBranch(currentProject, name);
          bottomPanelRef.current?.appendOutput(r.success ? `[Git] Created branch ${name}` : `[Git] ${r.error}`);
          setShowBottomPanel(true);
          setBottomPanelTab('output');
        }
        break;
      }
      case 'git.switchBranch': {
        if (!currentProject) break;
        const branches = await window.electronAPI.gitBranches(currentProject);
        const name = prompt(`Switch to branch:\n${branches.success ? branches.branches?.all?.join(', ') : ''}`);
        if (name) {
          const r = await window.electronAPI.gitSwitchBranch(currentProject, name);
          bottomPanelRef.current?.appendOutput(r.success ? `[Git] Switched to ${name}` : `[Git] ${r.error}`);
          setShowBottomPanel(true);
          setBottomPanelTab('output');
        }
        break;
      }
      case 'agent.new': {
        const id = createSession(undefined, 'agent', currentProject || undefined);
        setActiveAgentId(id);
        setActiveSession(id);
        setActiveView('agents');
        setShowSidebar(true);
        setShowChat(true);
        break;
      }
      case 'help.about':
        await window.electronAPI.showMessageBox({
          type: 'info',
          title: 'About Xander AI IDE',
          message: 'Xander AI IDE v1.0.0',
          detail: 'AI-powered coding IDE with multi-agent, terminal, and SaaS sync.',
        });
        break;
      case 'help.docs':
        await window.electronAPI.openExternal('http://localhost:3000/dashboard');
        break;
      case 'help.updates':
        await window.electronAPI.showMessageBox({
          type: 'info',
          title: 'Updates',
          message: 'You are on the latest version (1.0.0)',
        });
        break;
    }
  }, [activeTab, openFiles, currentProject, navHistory, navIndex, autoSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's' && !e.shiftKey) { e.preventDefault(); handleSave(); }
      if (mod && e.shiftKey && e.key === 'S') { e.preventDefault(); handleSaveAs(); }
      if (mod && e.key === 'o' && !e.shiftKey) { e.preventDefault(); handleOpenFile(); }
      if (mod && e.key === 'n') { e.preventDefault(); handleNewFile(); }
      if (mod && e.key === 'p') { e.preventDefault(); setShowGoToFile(true); }
      if (mod && e.key === '`') { e.preventDefault(); setShowBottomPanel(true); setBottomPanelTab('terminal'); }
      if (mod && e.shiftKey && e.key === 'E') { e.preventDefault(); setShowSidebar((v) => !v); }
      if (mod && e.shiftKey && e.key === 'P') { e.preventDefault(); setShowCommandPalette(true); }
      if (mod && e.shiftKey && e.key === 'L') { e.preventDefault(); handleMenuAction('agent.new'); }
      if (mod && e.shiftKey && e.key === 'G') { e.preventDefault(); setShowSidebar(true); setActiveView('agents'); setShowChat(true); }
      if (mod && e.shiftKey && e.key === '5') { e.preventDefault(); bottomPanelRef.current?.splitTerminal(); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); handleMenuAction('go.goBack'); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); handleMenuAction('go.goForward'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, openFiles]);

  const currentFile = openFiles.find((f) => f.id === activeTab);
  const planName = subscription?.plan?.name || 'Free';
  const workspaceName = workspaceFolders.length > 1
    ? `Workspace (${workspaceFolders.length} folders)`
    : currentProject
      ? currentProject.split(/[/\\]/).pop() || 'Workspace'
      : 'Untitled Workspace';

  const flatFiles = allProjectFiles.length > 0 ? allProjectFiles : files.filter((f) => !f.isDirectory);
  const goToResults = flatFiles.filter((f) =>
    !goToFileQuery || f.name.toLowerCase().includes(goToFileQuery.toLowerCase()) ||
    f.path.toLowerCase().includes(goToFileQuery.toLowerCase())
  ).slice(0, 20);
  const commandActions = [
    { label: 'Open Folder', action: () => handleOpenProject() },
    { label: 'New Terminal', action: () => handleMenuAction('terminal.new') },
    { label: 'Split Terminal', action: () => handleMenuAction('terminal.split') },
    { label: 'New Agent', action: () => handleMenuAction('agent.new') },
    { label: 'Semantic Codebase Search', action: () => { setShowSidebar(true); setActiveView('search'); } },
    { label: 'Re-index Project', action: () => currentProject && indexProjectForSearch(currentProject, { force: true }) },
    { label: 'Go to File', action: () => setShowGoToFile(true) },
    { label: 'Toggle Terminal', action: () => handleMenuAction('view.toggleTerminal') },
    { label: 'Run Build Task', action: () => handleMenuAction('terminal.runBuildTask') },
    { label: 'Settings', action: () => { setShowSettings(true); setSettingsTab('general'); } },
  ].filter((c) => !commandQuery || c.label.toLowerCase().includes(commandQuery.toLowerCase()));

  if (typeof window !== 'undefined' && !getElectronAPI()) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-[#ccc] p-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[#f48771] mb-3">Desktop shell failed to load</h1>
          <p className="text-sm mb-4">The Electron preload bridge is missing. Reinstall from the latest installer or run via <code className="text-[#9cdcfe]">npm run dev</code>.</p>
        </div>
      </div>
    );
  }

  if (isAgentWindow) {
    return (
      <div className="h-screen flex flex-col bg-[var(--vscode-editor-background)]">
        <div className="h-9 flex items-center px-4 border-b border-[var(--vscode-titleBar-border)] bg-[var(--vscode-titleBar-background)]">
          <span className="text-[13px] font-semibold">Xander Agents</span>
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="w-64 border-r border-[var(--vscode-sideBar-border)]">
            <AgentsPanel
              projectPath={currentProject}
              onOpenAgent={(id) => { setActiveAgentId(id); setActiveSession(id); }}
              onNewAgentWindow={() => window.electronAPI.windowNewAgent()}
            />
          </div>
          <div className="flex-1">
            <AIChatPanel
              agentSessionId={activeAgentId}
              projectPath={currentProject}
              workspaceFolders={workspaceFolders}
              openFiles={openFiles}
              currentFilePath={currentFile?.filePath}
              selectedCode={selectedCode}
              onComposerApply={handleComposerApply}
              onFileChanged={handleAgentFileChanged}
              onOpenFile={handleOpenGeneratedFile}
              onRefreshExplorer={() => refreshTree()}
              onRunTerminal={(cmd) => bottomPanelRef.current?.runInTerminal(cmd)}
              onRefreshGit={() => refreshGitStatus()}
              compact
            />
          </div>
        </div>
      </div>
    );
  }

  const renderSidebar = () => {
    switch (activeView) {
      case 'git':
        return <GitPanel projectPath={currentProject} />;
      case 'search':
        return <SearchPanel projectPath={currentProject} onOpenFile={(p) => openFileByPath(p)} />;
      case 'agents':
        return (
          <AgentsPanel
            projectPath={currentProject}
            onOpenAgent={(id) => { setActiveAgentId(id); setActiveSession(id); setShowChat(true); }}
            onNewAgentWindow={() => window.electronAPI.windowNewAgent()}
          />
        );
      case 'terminal':
        return (
          <FileExplorer
            files={files}
            loading={loading}
            onFileSelect={handleFileSelect}
            expandedFolders={expandedFolders}
            onFolderToggle={handleFolderToggle}
            loadingDirs={loadingDirs}
            workspaceName={workspaceName}
            projectPath={currentProject}
            onRefresh={() => currentProject && refreshTree()}
          />
        );
      default:
        return (
          <FileExplorer
            files={files}
            loading={loading}
            onFileSelect={handleFileSelect}
            expandedFolders={expandedFolders}
            onFolderToggle={handleFolderToggle}
            loadingDirs={loadingDirs}
            workspaceName={workspaceName}
            projectPath={currentProject}
            onRefresh={() => currentProject && refreshTree()}
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)] relative">
      <TitleBar
        workspaceName={workspaceName}
        planName={planName}
        isMaximized={isMaximized}
        onMinimize={() => window.electronAPI.windowMinimize()}
        onMaximize={async () => setIsMaximized(!!(await window.electronAPI.windowMaximize()))}
        onClose={() => window.electronAPI.windowClose()}
        onOpenSettings={(tab) => { setSettingsTab(tab || 'general'); setShowSettings(true); }}
        onMenuAction={handleMenuAction}
      />

      <div className="flex-1 flex overflow-hidden">
        <ActivityBar activeView={activeView} onViewChange={setActiveView} />

        {showSidebar && (
          <div className="w-64 border-r border-[var(--vscode-sideBar-border)] bg-[var(--vscode-sideBar-background)] overflow-hidden">
            {renderSidebar()}
          </div>
        )}

        <div className="flex-1 flex flex-col relative min-w-0">
          {dedupeOpenFiles(openFiles).length > 0 && (
            <EditorTabs
              openFiles={dedupeOpenFiles(openFiles)}
              activeTab={activeTab}
              onTabSelect={setActiveTab}
              onTabClose={handleTabClose}
            />
          )}

          <div className="flex-1 min-h-0">
            {currentFile ? (
              <Suspense fallback={
                <div className="h-full flex items-center justify-center text-[var(--vscode-descriptionForeground)]">
                  Loading editor...
                </div>
              }>
                <MonacoEditor
                  ref={editorRef}
                  content={currentFile.content}
                  language={currentFile.language}
                  filePath={currentFile.filePath}
                  breakpoints={currentFile.filePath ? breakpoints[currentFile.filePath] : []}
                  onBreakpointToggle={(line) => {
                    if (currentFile.filePath) toggleBreakpoint(currentFile.filePath, line);
                  }}
                  onChange={(c) => handleEditorChange(currentFile.id, c)}
                  onSave={(c) => { handleEditorChange(currentFile.id, c); handleFileSave(currentFile.id); }}
                  onCursorChange={(line, col) => {
                    setCursorPosition({ line, column: col });
                    setSelectedCode(editorRef.current?.getSelectedText() || '');
                  }}
                />
              </Suspense>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <h1 className="text-2xl font-semibold mb-2">Welcome to Xander AI IDE</h1>
                  <p className="text-sm mb-6 text-[var(--vscode-descriptionForeground)]">
                    Use the menu bar: File → Open Folder, or press Ctrl+O / Ctrl+P
                  </p>
                  <button onClick={handleOpenProject} className="px-4 py-2 bg-[var(--vscode-button-background)] text-white rounded">
                    Open Folder
                  </button>
                </div>
              </div>
            )}
          </div>

          {showSettings && (
            <SettingsPanel initialTab={settingsTab} onClose={() => { setShowSettings(false); fetchAll(); }} />
          )}

          {showGoToFile && (
            <div className="absolute inset-0 bg-black/50 flex items-start justify-center pt-24 z-50" onClick={() => setShowGoToFile(false)}>
              <div className="w-[520px] bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-border)] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={goToFileQuery}
                  onChange={(e) => setGoToFileQuery(e.target.value)}
                  placeholder="Go to file..."
                  className="w-full px-4 py-3 bg-transparent border-b border-[var(--vscode-border)] outline-none text-sm"
                />
                <div className="max-h-64 overflow-auto">
                  {goToResults.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => { openFileByPath(f.path); setShowGoToFile(false); setGoToFileQuery(''); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--vscode-list-hoverBackground)]"
                    >
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-[var(--vscode-descriptionForeground)] truncate">{f.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showCommandPalette && (
            <div className="absolute inset-0 bg-black/50 flex items-start justify-center pt-24 z-50" onClick={() => setShowCommandPalette(false)}>
              <div className="w-[520px] bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-border)] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  placeholder="Type a command..."
                  className="w-full px-4 py-3 bg-transparent border-b border-[var(--vscode-border)] outline-none text-sm"
                />
                <div className="max-h-64 overflow-auto">
                  {commandActions.map((cmd) => (
                    <button
                      key={cmd.label}
                      onClick={() => { cmd.action(); setShowCommandPalette(false); setCommandQuery(''); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--vscode-list-hoverBackground)]"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {showChat && (
          <ResizablePanel
            edge="left"
            defaultWidth={380}
            minWidth={300}
            maxWidth={800}
            storageKey="xander-chat-width"
            className="border-l border-[var(--vscode-panel-border)]"
          >
            <AIChatPanel
              currentFilePath={currentFile?.filePath}
              selectedCode={selectedCode}
              projectPath={currentProject}
              workspaceFolders={workspaceFolders}
              agentSessionId={activeAgentId}
              openFiles={openFiles}
              onComposerApply={handleComposerApply}
              onFileChanged={handleAgentFileChanged}
              onOpenFile={handleOpenGeneratedFile}
              onRefreshExplorer={() => refreshTree()}
              onRunTerminal={(cmd) => bottomPanelRef.current?.runInTerminal(cmd)}
              onRefreshGit={() => refreshGitStatus()}
              onCodeSuggestion={(code) => {
                if (currentFile) editorRef.current?.insertAtCursor(code);
              }}
            />
          </ResizablePanel>
        )}
      </div>

      <BottomPanel
        ref={bottomPanelRef}
        isVisible={showBottomPanel}
        onToggle={() => setShowBottomPanel(false)}
        activeTab={bottomPanelTab}
        onTabChange={setBottomPanelTab}
        projectPath={currentProject}
      />

      <StatusBar
        currentFile={currentFile?.name}
        language={currentFile?.language}
        cursorPosition={cursorPosition}
        problems={problems}
        planName={planName}
        aiStatus={apiClient.getToken() ? (indexStatus === 'ready' ? `indexed (${indexChunks})` : indexStatus) : 'disconnected'}
        onPlanClick={() => { setShowSettings(true); setSettingsTab('plan'); }}
      />
    </div>
  );
}

function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', json: 'json', md: 'markdown', html: 'html', css: 'css',
  };
  return map[ext || ''] || 'plaintext';
}

export default App;
