import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { ActivityBar } from './components/ActivityBar';
import { FileExplorer } from './components/FileExplorer';
import { MonacoEditor } from './components/MonacoEditor';
import { EditorTabs } from './components/EditorTabs';
import { AIChatPanel } from './components/AIChatPanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { useProjectStore } from './stores/projectStore';
import { FileItem } from '../../preload/preload';
import './styles/theme.css';

function App() {
  const [activeView, setActiveView] = useState<string>('explorer');
  const [activeTab, setActiveTab] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<Array<{ id: string; name: string; content: string; language: string }>>([]);
  const [showChat, setShowChat] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [problems, setProblems] = useState({ errors: 0, warnings: 0 });
  
  const { 
    currentProject, 
    setCurrentProject, 
    files, 
    setFiles, 
    loading,
    setLoading 
  } = useProjectStore();

  useEffect(() => {
    // Listen for file system changes
    if (window.electronAPI) {
      window.electronAPI.onFileChanged((path: string) => {
        console.log('File changed:', path);
        // Update file in openFiles if it's open
        setOpenFiles(prev => prev.map(file => 
          file.id === path ? { ...file, content: 'File changed on disk' } : file
        ));
      });

      window.electronAPI.onFileAdded((path: string) => {
        console.log('File added:', path);
        // Refresh file explorer
        if (currentProject) {
          loadFiles(currentProject);
        }
      });

      window.electronAPI.onFileDeleted((path: string) => {
        console.log('File deleted:', path);
        // Remove from open files if it's open
        setOpenFiles(prev => prev.filter(file => file.id !== path));
        // Refresh file explorer
        if (currentProject) {
          loadFiles(currentProject);
        }
      });
    }
  }, [currentProject]);

  const loadFiles = async (projectPath: string) => {
    setLoading(true);
    try {
      const result = await window.electronAPI.listFiles(projectPath);
      if (result.success && result.files) {
        setFiles(result.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = async () => {
    try {
      const projectPath = await window.electronAPI.openProjectDialog();
      if (projectPath) {
        const result = await window.electronAPI.openProject(projectPath);
        if (result.success) {
          setCurrentProject(projectPath);
          await loadFiles(projectPath);
        }
      }
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  const handleFileSelect = async (file: FileItem) => {
    if (file.isDirectory) return;

    try {
      const result = await window.electronAPI.readFile(file.path);
      if (result.success && result.content) {
        const existingFile = openFiles.find(f => f.id === file.path);
        if (!existingFile) {
          setOpenFiles(prev => [...prev, {
            id: file.path,
            name: file.name,
            content: result.content!,
            language: getFileLanguage(file.name)
          }]);
        }
        setActiveTab(file.path);
      }
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  };

  const handleFileSave = async (fileId: string, content: string) => {
    try {
      const result = await window.electronAPI.writeFile(fileId, content);
      if (result.success) {
        setOpenFiles(prev => prev.map(file => 
          file.id === fileId ? { ...file, content } : file
        ));
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const handleFolderToggle = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleCodeSuggestion = (code: string) => {
    if (currentFile) {
      const newContent = currentFile.content + '\n' + code;
      handleFileSave(currentFile.id, newContent);
      setOpenFiles(prev => prev.map(file => 
        file.id === currentFile.id ? { ...file, content: newContent } : file
      ));
    }
  };

  const handleTabClose = (fileId: string) => {
    setOpenFiles(prev => prev.filter(file => file.id !== fileId));
    if (activeTab === fileId) {
      setActiveTab(openFiles.find(f => f.id !== fileId)?.id || '');
    }
  };

  const currentFile = openFiles.find(f => f.id === activeTab);

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] font-sans">
      {/* Header */}
      <header className="h-10 bg-[#2d2d30] border-b border-[#3e3e3e] flex items-center px-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded"></div>
            <span className="font-semibold text-sm">Xander AI IDE</span>
          </div>
          {currentProject && (
            <div className="text-sm text-[#cccccc] flex items-center">
              <ChevronRight className="w-3 h-3 mx-1" />
              <span>{currentProject.split('\\').pop() || currentProject.split('/').pop()}</span>
            </div>
          )}
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenProject}
            className="px-3 py-1 text-xs bg-[#007acc] hover:bg-[#1e8ed7] rounded transition-colors"
          >
            Open Project
          </button>
          <button className="p-1 hover:bg-[#3e3e3e] rounded transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar activeView={activeView} onViewChange={setActiveView} />
        
        {/* Side Bar */}
        <SideBar
          activeView={activeView}
          files={files}
          loading={loading}
          onFileSelect={handleFileSelect}
          expandedFolders={expandedFolders}
          onFolderToggle={handleFolderToggle}
        />

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="h-10 bg-[#2d2d30] border-b border-[#3e3e3e] flex items-center overflow-x-auto">
            {openFiles.map(file => (
              <div
                key={file.id}
                className={`h-full flex items-center px-3 border-r border-[#3e3e3e] cursor-pointer transition-colors group ${
                  activeTab === file.id
                    ? 'bg-[#1e1e1e] text-white'
                    : 'text-[#cccccc] hover:text-white hover:bg-[#2a2d2e]'
                }`}
                onClick={() => setActiveTab(file.id)}
              >
                <FileText className="w-4 h-4 mr-2" />
                <span className="text-sm mr-2">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTabClose(file.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-[#3e3e3e] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1">
            {currentFile ? (
              <SimpleEditor
                content={currentFile.content}
                language={currentFile.language}
                onChange={(content: string) => {
                  setOpenFiles(prev => prev.map(file => 
                    file.id === currentFile.id ? { ...file, content } : file
                  ));
                }}
                onSave={(content: string) => handleFileSave(currentFile.id, content)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[#858585] bg-[#1e1e1e]">
                <div className="text-center">
                  <div className="text-4xl mb-4">👋</div>
                  <div className="text-xl font-semibold mb-2">Welcome to Xander AI IDE</div>
                  <div className="text-sm mb-4">Open a project to get started</div>
                  <button
                    onClick={handleOpenProject}
                    className="px-4 py-2 bg-[#007acc] hover:bg-[#1e8ed7] rounded transition-colors"
                  >
                    Open Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Chat Panel */}
        {showChat && (
          <div className="w-80 flex flex-col border-l border-[#3e3e3e]">
            <AIChatPanel 
              onCodeSuggestion={handleCodeSuggestion}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        currentFile={currentFile?.name}
        language={currentFile?.language}
        gitBranch="main"
        gitStatus="clean"
        cursorPosition={cursorPosition}
        problems={problems}
      />
    </div>
  );
}

function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
  };
  return langMap[ext || ''] || 'plaintext';
}

export default App;
