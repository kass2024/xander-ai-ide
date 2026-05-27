import type { ElectronAPI } from '../../types';

/** Safe access to the Electron preload bridge (may be undefined during tests). */
export function getElectronAPI(): ElectronAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI;
}

export function requireElectronAPI(): ElectronAPI {
  const api = getElectronAPI();
  if (!api) {
    throw new Error('Electron API is not available. Restart the desktop app.');
  }
  return api;
}
