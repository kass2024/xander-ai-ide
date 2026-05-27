import { create } from 'zustand';
import { FileItem } from '../../types';
import {
  applyGitToTree,
  buildGitStatusMap,
  flattenFiles,
  parentDir,
  sortFileItems,
  updateTreeAtPath,
  GitStatus,
} from '../lib/fileTree';

interface ProjectStore {
  currentProject: string | null;
  workspaceFolders: string[];
  files: FileItem[];
  flatFiles: FileItem[];
  allProjectFiles: FileItem[];
  loading: boolean;
  loadingDirs: Set<string>;
  loadedDirs: Set<string>;
  gitMap: Map<string, GitStatus>;

  setCurrentProject: (project: string | null) => void;
  setLoading: (loading: boolean) => void;

  loadRoot: (projectPath: string) => Promise<void>;
  addWorkspaceFolder: (folderPath: string) => Promise<void>;
  loadFolderChildren: (dirPath: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  refreshParentOf: (filePath: string) => Promise<void>;
  setAllProjectFiles: (files: FileItem[]) => void;
}

async function fetchDir(dirPath: string): Promise<FileItem[]> {
  const result = await window.electronAPI.listFiles(dirPath);
  if (!result.success || !result.files) return [];
  return sortFileItems(result.files.map((f) => ({ ...f, children: f.isDirectory ? [] : undefined })));
}

function folderName(folderPath: string): string {
  return folderPath.split(/[/\\]/).pop() || folderPath;
}

function makeRootNode(folderPath: string, children: FileItem[]): FileItem {
  return {
    name: folderName(folderPath),
    path: folderPath,
    isDirectory: true,
    type: 'folder',
    children,
  };
}

async function collectProjectFiles(folderPath: string): Promise<FileItem[]> {
  const walk = await window.electronAPI.walkProjectFiles(folderPath);
  if (!walk.success || !walk.files) return [];
  return walk.files.map((f) => ({
    name: f.name,
    path: f.path,
    isDirectory: false,
    type: f.type || 'text',
  }));
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProject: null,
  workspaceFolders: [],
  files: [],
  flatFiles: [],
  allProjectFiles: [],
  loading: false,
  loadingDirs: new Set(),
  loadedDirs: new Set(),
  gitMap: new Map(),

  setCurrentProject: (project) =>
    set({
      currentProject: project,
      workspaceFolders: project ? [project] : [],
      files: [],
      flatFiles: [],
      allProjectFiles: [],
      loadedDirs: new Set(),
      loadingDirs: new Set(),
      gitMap: new Map(),
    }),

  setLoading: (loading) => set({ loading }),

  loadRoot: async (projectPath) => {
    set({
      loading: true,
      currentProject: projectPath,
      workspaceFolders: [projectPath],
      loadedDirs: new Set(),
      files: [],
    });
    try {
      const rootItems = await fetchDir(projectPath);
      const rootNode = makeRootNode(projectPath, rootItems);
      set({
        files: [rootNode],
        loadedDirs: new Set([projectPath]),
        flatFiles: flattenFiles([rootNode]),
      });
      await get().refreshGitStatus();
      set({ allProjectFiles: await collectProjectFiles(projectPath) });
    } finally {
      set({ loading: false });
    }
  },

  addWorkspaceFolder: async (folderPath) => {
    const { workspaceFolders, files } = get();
    if (workspaceFolders.includes(folderPath)) return;

    set({ loading: true });
    try {
      const rootItems = await fetchDir(folderPath);
      const rootNode = makeRootNode(folderPath, rootItems);
      const nextFolders = [...workspaceFolders, folderPath];
      const nextFiles = [...files, rootNode];
      const nextLoaded = new Set(get().loadedDirs);
      nextLoaded.add(folderPath);

      const allFiles = [...get().allProjectFiles, ...(await collectProjectFiles(folderPath))];

      set({
        workspaceFolders: nextFolders,
        currentProject: get().currentProject || folderPath,
        files: nextFiles,
        flatFiles: flattenFiles(nextFiles),
        loadedDirs: nextLoaded,
        allProjectFiles: allFiles,
      });
      await get().refreshGitStatus();
    } finally {
      set({ loading: false });
    }
  },

  loadFolderChildren: async (dirPath) => {
    const { loadedDirs, loadingDirs, gitMap, files } = get();
    if (loadedDirs.has(dirPath) || loadingDirs.has(dirPath)) return;

    set({ loadingDirs: new Set([...loadingDirs, dirPath]) });
    try {
      const children = await fetchDir(dirPath);
      const withGit = applyGitToTree(children, gitMap);
      set((s) => {
        const nextFiles = updateTreeAtPath(s.files, dirPath, withGit);
        return {
          files: nextFiles,
          flatFiles: flattenFiles(nextFiles),
          loadedDirs: new Set([...s.loadedDirs, dirPath]),
        };
      });
    } finally {
      set((s) => {
        const next = new Set(s.loadingDirs);
        next.delete(dirPath);
        return { loadingDirs: next };
      });
    }
  },

  refreshTree: async () => {
    const { workspaceFolders } = get();
    if (!workspaceFolders.length) return;
    if (workspaceFolders.length === 1) {
      await get().loadRoot(workspaceFolders[0]);
      return;
    }
    set({ loading: true });
    try {
      const roots: FileItem[] = [];
      const allFiles: FileItem[] = [];
      for (const folder of workspaceFolders) {
        const children = await fetchDir(folder);
        roots.push(makeRootNode(folder, children));
        allFiles.push(...(await collectProjectFiles(folder)));
      }
      set({
        files: roots,
        flatFiles: flattenFiles(roots),
        loadedDirs: new Set(workspaceFolders),
        allProjectFiles: allFiles,
      });
      await get().refreshGitStatus();
    } finally {
      set({ loading: false });
    }
  },

  refreshGitStatus: async () => {
    const { currentProject, files } = get();
    if (!currentProject) return;
    const status = await window.electronAPI.gitStatus(currentProject);
    if (!status.success || !status.status?.files) return;
    const gitMap = buildGitStatusMap(status.status.files, currentProject);
    set({ gitMap, files: applyGitToTree(files, gitMap) });
  },

  refreshParentOf: async (filePath) => {
    const dir = parentDir(filePath);
    if (!dir) return;
    set((s) => {
      const loadedDirs = new Set(s.loadedDirs);
      loadedDirs.delete(dir);
      return { loadedDirs };
    });
    await get().loadFolderChildren(dir);
    await get().refreshGitStatus();
  },

  setAllProjectFiles: (allProjectFiles) => set({ allProjectFiles }),
}));
