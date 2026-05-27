export type MenuActionId =
  | 'file.newFile'
  | 'file.newWindow'
  | 'file.newAgentsWindow'
  | 'file.openFile'
  | 'file.openFolder'
  | 'file.openRecent'
  | 'file.addFolderToWorkspace'
  | 'file.save'
  | 'file.saveAs'
  | 'file.saveAll'
  | 'file.revertFile'
  | 'file.autoSave'
  | 'file.closeEditor'
  | 'file.closeWindow'
  | 'file.exit'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.find'
  | 'edit.replace'
  | 'edit.findInFiles'
  | 'edit.commandPalette'
  | 'selection.selectAll'
  | 'selection.expandSelection'
  | 'view.toggleExplorer'
  | 'view.toggleSearch'
  | 'view.toggleAgents'
  | 'view.toggleAI'
  | 'view.toggleTerminal'
  | 'view.toggleProblems'
  | 'view.toggleOutput'
  | 'view.settings'
  | 'go.goToFile'
  | 'go.goToSymbol'
  | 'go.goBack'
  | 'go.goForward'
  | 'run.runFile'
  | 'run.startDebug'
  | 'run.stop'
  | 'terminal.new'
  | 'terminal.split'
  | 'terminal.clear'
  | 'terminal.kill'
  | 'terminal.selectProfile'
  | 'terminal.runTask'
  | 'terminal.runBuildTask'
  | 'terminal.runActiveFile'
  | 'terminal.runSelectedText'
  | 'git.pull'
  | 'git.push'
  | 'git.commit'
  | 'git.createBranch'
  | 'git.switchBranch'
  | 'agent.new'
  | 'help.about'
  | 'help.docs'
  | 'help.updates';

export interface MenuItemDef {
  id?: MenuActionId;
  label: string;
  shortcut?: string;
  type?: 'separator';
  disabled?: boolean;
  checked?: boolean;
}

export interface MenuDef {
  id: string;
  label: string;
  items: MenuItemDef[];
}

export const APP_MENUS: MenuDef[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'file.newFile', label: 'New Text File', shortcut: 'Ctrl+N' },
      { id: 'file.newWindow', label: 'New Window', shortcut: 'Ctrl+Shift+N' },
      { id: 'file.newAgentsWindow', label: 'New Agents Window' },
      { type: 'separator', label: '' },
      { id: 'file.openFile', label: 'Open File...', shortcut: 'Ctrl+O' },
      { id: 'file.openFolder', label: 'Open Folder...', shortcut: 'Ctrl+K Ctrl+O' },
      { id: 'file.openRecent', label: 'Open Recent', disabled: true },
      { id: 'file.addFolderToWorkspace', label: 'Add Folder to Workspace...' },
      { type: 'separator', label: '' },
      { id: 'file.save', label: 'Save', shortcut: 'Ctrl+S' },
      { id: 'file.saveAs', label: 'Save As...', shortcut: 'Ctrl+Shift+S' },
      { id: 'file.saveAll', label: 'Save All', shortcut: 'Ctrl+K S' },
      { type: 'separator', label: '' },
      { id: 'file.revertFile', label: 'Revert File' },
      { id: 'file.autoSave', label: 'Auto Save' },
      { type: 'separator', label: '' },
      { id: 'file.closeEditor', label: 'Close Editor', shortcut: 'Ctrl+F4' },
      { id: 'file.closeWindow', label: 'Close Window', shortcut: 'Ctrl+Shift+W' },
      { id: 'file.exit', label: 'Exit', shortcut: 'Alt+F4' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'edit.undo', label: 'Undo', shortcut: 'Ctrl+Z' },
      { id: 'edit.redo', label: 'Redo', shortcut: 'Ctrl+Y' },
      { type: 'separator', label: '' },
      { id: 'edit.cut', label: 'Cut', shortcut: 'Ctrl+X' },
      { id: 'edit.copy', label: 'Copy', shortcut: 'Ctrl+C' },
      { id: 'edit.paste', label: 'Paste', shortcut: 'Ctrl+V' },
      { type: 'separator', label: '' },
      { id: 'edit.find', label: 'Find', shortcut: 'Ctrl+F' },
      { id: 'edit.replace', label: 'Replace', shortcut: 'Ctrl+H' },
      { id: 'edit.findInFiles', label: 'Find in Files', shortcut: 'Ctrl+Shift+F' },
      { type: 'separator', label: '' },
      { id: 'edit.commandPalette', label: 'Command Palette...', shortcut: 'Ctrl+Shift+P' },
    ],
  },
  {
    id: 'selection',
    label: 'Selection',
    items: [
      { id: 'selection.selectAll', label: 'Select All', shortcut: 'Ctrl+A' },
      { id: 'selection.expandSelection', label: 'Expand Selection', shortcut: 'Shift+Alt+Right' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { id: 'view.toggleExplorer', label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
      { id: 'view.toggleSearch', label: 'Search', shortcut: 'Ctrl+Shift+F' },
      { id: 'view.toggleAgents', label: 'Xander Agents', shortcut: 'Ctrl+Shift+G' },
      { id: 'view.toggleAI', label: 'Xander Assistant', shortcut: 'Ctrl+Shift+A' },
      { type: 'separator', label: '' },
      { id: 'view.toggleTerminal', label: 'Terminal', shortcut: 'Ctrl+`' },
      { id: 'view.toggleProblems', label: 'Problems', shortcut: 'Ctrl+Shift+M' },
      { id: 'view.toggleOutput', label: 'Output', shortcut: 'Ctrl+Shift+U' },
      { type: 'separator', label: '' },
      { id: 'view.settings', label: 'Settings', shortcut: 'Ctrl+,' },
    ],
  },
  {
    id: 'go',
    label: 'Go',
    items: [
      { id: 'go.goToFile', label: 'Go to File...', shortcut: 'Ctrl+P' },
      { id: 'go.goToSymbol', label: 'Go to Symbol...', shortcut: 'Ctrl+Shift+O' },
      { type: 'separator', label: '' },
      { id: 'go.goBack', label: 'Go Back', shortcut: 'Alt+Left' },
      { id: 'go.goForward', label: 'Go Forward', shortcut: 'Alt+Right' },
    ],
  },
  {
    id: 'run',
    label: 'Run',
    items: [
      { id: 'run.runFile', label: 'Run Without Debugging', shortcut: 'Ctrl+F5' },
      { id: 'run.startDebug', label: 'Start Debugging', shortcut: 'F5' },
      { id: 'run.stop', label: 'Stop Debugging', shortcut: 'Shift+F5' },
    ],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    items: [
      { id: 'terminal.new', label: 'New Terminal', shortcut: 'Ctrl+Shift+`' },
      { id: 'terminal.split', label: 'Split Terminal', shortcut: 'Ctrl+Shift+5' },
      { type: 'separator', label: '' },
      { id: 'terminal.runTask', label: 'Run Task...' },
      { id: 'terminal.runBuildTask', label: 'Run Build Task...', shortcut: 'Ctrl+Shift+B' },
      { id: 'terminal.runActiveFile', label: 'Run Active File' },
      { id: 'terminal.runSelectedText', label: 'Run Selected Text' },
      { type: 'separator', label: '' },
      { id: 'terminal.selectProfile', label: 'Select Default Profile...' },
      { id: 'terminal.clear', label: 'Clear Terminal' },
      { id: 'terminal.kill', label: 'Kill Terminal' },
    ],
  },
  {
    id: 'git',
    label: 'Git',
    items: [
      { id: 'git.pull', label: 'Pull' },
      { id: 'git.push', label: 'Push' },
      { id: 'git.commit', label: 'Commit...' },
      { type: 'separator', label: '' },
      { id: 'git.createBranch', label: 'Create Branch...' },
      { id: 'git.switchBranch', label: 'Switch Branch...' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { id: 'help.about', label: 'About Xander AI IDE' },
      { id: 'help.docs', label: 'Documentation' },
      { id: 'help.updates', label: 'Check for Updates' },
    ],
  },
];
